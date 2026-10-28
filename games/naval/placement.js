// Sea Battle — fleet placement: drag ships from the dock onto the grid, drag
// them around, tap to rotate. Validates overlap (and touching for no-touch fleets).

import { N, FLEETS, fleetDefs, cellsOf, canPlace, occupancy, randomFleet, completeFleet } from './rules.js';
import { paintWater, paintGrid, paintFrame, paintShip, shipSprite, rr } from './render.js';

const easeOut = (k) => 1 - Math.pow(1 - k, 3);

export class PlacementView {
  // opts: { fleetId, skin, theme, ships?, onChange(allPlaced), snd, haptic }
  constructor(host, opts) {
    this.host = host;
    this.o = opts;
    this.fleetId = opts.fleetId;
    this.touch = FLEETS[this.fleetId].touch;
    const defs = fleetDefs(this.fleetId);
    this.ships = defs.map((d, k) => {
      const prev = opts.ships && opts.ships[k];
      return prev && prev.len === d.len && prev.r != null ? { ...d, r: prev.r, c: prev.c, dir: prev.dir } : { ...d, r: null, c: null, dir: 'h' };
    });
    if (this.ships.some((s) => s.r != null && !canPlace(this.ships, s, this.touch))) this.ships.forEach((s) => (s.r = s.c = null));
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'g-naval-canvas';
    this.canvas.__view = this; // handy for automated tests
    host.append(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.drag = null;
    this.anim = new Map(); // ship id → { t0, kind }
    this.t = 0;
    this.dead = false;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.bind();
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKey);
    this.canvas.remove();
  }

  allPlaced() {
    return this.ships.every((s) => s.r != null);
  }
  getShips() {
    return this.ships.map((s) => ({ ...s }));
  }
  changed() {
    if (this.o.onChange) this.o.onChange(this.allPlaced());
  }

  autoPlace() {
    const fresh = randomFleet(this.fleetId);
    if (!fresh) return;
    fresh.forEach((s, k) => {
      Object.assign(this.ships[k], { r: s.r, c: s.c, dir: s.dir });
      this.anim.set(k, { t0: this.t + k * 0.05, kind: 'drop' });
    });
    this.o.snd.whoosh();
    this.changed();
  }

  // Places only the ships still in the dock.
  fillRest() {
    const out = completeFleet(this.fleetId, this.ships);
    if (!out) return false;
    out.forEach((s, k) => {
      if (this.ships[k].r == null) this.anim.set(k, { t0: this.t, kind: 'drop' });
      Object.assign(this.ships[k], { r: s.r, c: s.c, dir: s.dir });
    });
    this.changed();
    return true;
  }

  clear() {
    this.ships.forEach((s) => {
      s.r = s.c = null;
      s.dir = 'h';
    });
    this.o.snd.whoosh();
    this.changed();
  }

  // ---------------------------------------------------------------- layout
  resize() {
    if (this.dead) return;
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.W = W;
    this.H = H;
    const pad = 14;
    const gut = 15;
    const wide = W > H * 1.08;
    let S;
    let dockW;
    if (wide) {
      S = Math.floor(Math.min(H - gut - 20, W * 0.55) / N) * N;
      dockW = Math.min(360, W - S - gut - pad * 3);
    } else {
      S = Math.floor(Math.min(W - pad * 2 - gut, 560) / N) * N;
      dockW = W - pad * 2;
    }
    // dock slots flow in rows
    const flow = (dc) => {
      const gap = dc * 0.55;
      const inner = dockW - 24;
      let x = 0;
      let row = 0;
      const pos = [];
      const order = this.ships.map((s, k) => k);
      for (const k of order) {
        const w = this.ships[k].len * dc;
        if (x > 0 && x + w > inner) {
          x = 0;
          row++;
        }
        pos[k] = { x, row, w };
        x += w + gap;
      }
      return { pos, rows: row + 1, gap };
    };
    let dc = Math.min(40, (S / N) * 0.92);
    let fl = flow(dc);
    let dockH = fl.rows * (dc + 12) + 18;
    if (!wide) {
      const maxS = H - gut - 8 - dockH - 14;
      if (S > maxS) {
        S = Math.max(150, Math.floor(maxS / N) * N);
        dc = Math.min(dc, (S / N) * 0.92);
        fl = flow(dc);
        dockH = fl.rows * (dc + 12) + 18;
      }
    }
    if (wide) {
      const gx = Math.max(pad + gut, (W - S - gut - dockW - pad * 2) / 2 + gut);
      this.grid = { x: gx, y: gut + 6, s: S };
      this.dock = { x: gx + S + pad * 2, y: gut + 6, w: dockW, h: dockH };
    } else {
      const off = Math.max(0, Math.floor((H - (gut + 6 + S + 14 + dockH)) * 0.4));
      this.grid = { x: Math.round((W - S - gut) / 2 + gut), y: gut + 6 + off, s: S };
      this.dock = { x: pad, y: this.grid.y + S + 14, w: dockW, h: dockH };
    }
    // centre each dock row
    const rowsW = [];
    fl.pos.forEach((p) => (rowsW[p.row] = Math.max(rowsW[p.row] || 0, p.x + p.w)));
    this.slots = fl.pos.map((p) => ({
      x: this.dock.x + (this.dock.w - rowsW[p.row]) / 2 + p.x,
      y: this.dock.y + 12 + p.row * (dc + 12),
      w: p.w,
      h: dc,
    }));
    this.dc = dc;
    this.usedH = wide ? Math.max(this.grid.y + S, this.dock.y + dockH) : this.dock.y + dockH;
    if (this.o.onLayout) this.o.onLayout(this);
  }

  // ---------------------------------------------------------------- input
  bind() {
    const c = this.canvas;
    const pt = (e) => {
      const b = c.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const cs = () => this.grid.s / N;
    const gridCell = (p) => {
      const col = Math.floor((p.x - this.grid.x) / cs());
      const row = Math.floor((p.y - this.grid.y) / cs());
      return col >= 0 && row >= 0 && col < N && row < N ? { r: row, c: col } : null;
    };
    this.onDown = (e) => {
      if (this.drag) return;
      const p = pt(e);
      let ship = null;
      let grab = 0;
      let from = 'dock';
      const gc = gridCell(p);
      if (gc) {
        ship = this.ships.find((s) => s.r != null && cellsOf(s).includes(gc.r * N + gc.c));
        if (ship) {
          from = 'grid';
          grab = ship.dir === 'h' ? gc.c - ship.c : gc.r - ship.r;
        }
      }
      if (!ship) {
        const k = this.slots.findIndex((sl, k) => this.ships[k].r == null && p.x >= sl.x - 4 && p.x <= sl.x + sl.w + 4 && p.y >= sl.y - 6 && p.y <= sl.y + sl.h + 6);
        if (k >= 0) {
          ship = this.ships[k];
          grab = Math.max(0, Math.min(ship.len - 1, Math.floor((p.x - this.slots[k].x) / this.dc)));
        }
      }
      if (!ship) return;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.drag = { ship, from, grab, start: p, p, moved: false, dir: from === 'grid' ? ship.dir : 'h', orig: { r: ship.r, c: ship.c, dir: ship.dir }, touch: e.pointerType !== 'mouse' };
    };
    this.onMove = (e) => {
      const d = this.drag;
      if (!d) return;
      d.p = pt(e);
      if (!d.moved && Math.hypot(d.p.x - d.start.x, d.p.y - d.start.y) > 7) {
        d.moved = true;
        this.o.snd.pick();
      }
    };
    this.onUp = (e) => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      d.p = pt(e);
      const s = d.ship;
      if (!d.moved) {
        if (d.from === 'grid') this.rotate(s, d.grab);
        else this.dropAnywhere(s);
        return;
      }
      const snap = this.snapOf(d);
      if (snap && snap.onGrid) {
        const cand = { ...s, r: snap.r, c: snap.c, dir: d.dir };
        if (canPlace(this.ships, cand, this.touch, s)) {
          Object.assign(s, { r: snap.r, c: snap.c, dir: d.dir });
          this.anim.set(s.id, { t0: this.t, kind: 'drop' });
          this.o.snd.place();
          this.o.haptic(15);
          this.changed();
          return;
        }
        this.o.snd.bad();
        this.o.haptic([20, 40, 20]);
        Object.assign(s, d.orig);
        if (d.orig.r != null) this.anim.set(s.id, { t0: this.t, kind: 'shake' });
        return;
      }
      // dropped outside the grid → back to the dock
      if (d.from === 'grid') {
        s.r = s.c = null;
        s.dir = 'h';
        this.o.snd.whoosh();
        this.changed();
      }
    };
    this.onCancel = () => {
      if (this.drag) Object.assign(this.drag.ship, this.drag.orig);
      this.drag = null;
    };
    this.onKey = (e) => {
      if (this.drag && (e.key === 'r' || e.key === 'R' || e.key === ' ')) {
        this.drag.dir = this.drag.dir === 'h' ? 'v' : 'h';
        this.drag.grab = Math.min(this.drag.grab, this.drag.ship.len - 1);
        this.o.snd.rotate();
        e.preventDefault();
      }
    };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('keydown', this.onKey);
  }

  // Where the dragged ship would land (top-left cell), following the finger.
  snapOf(d) {
    const cs = this.grid.s / N;
    const lift = d.touch ? cs * 1.15 : 0;
    const px = d.p.x;
    const py = d.p.y - lift;
    // the grabbed cell sits under the (lifted) pointer
    const gc = Math.floor((px - this.grid.x) / cs);
    const gr = Math.floor((py - this.grid.y) / cs);
    const r = d.dir === 'h' ? gr : gr - d.grab;
    const c = d.dir === 'h' ? gc - d.grab : gc;
    const onGrid = px >= this.grid.x - cs * 0.5 && px <= this.grid.x + this.grid.s + cs * 0.5 && py >= this.grid.y - cs * 0.5 && py <= this.grid.y + this.grid.s + cs * 0.5;
    // clamp into the board so a drop near the edge still fits
    const len = d.ship.len;
    const rr2 = Math.max(0, Math.min(N - (d.dir === 'v' ? len : 1), r));
    const cc2 = Math.max(0, Math.min(N - (d.dir === 'h' ? len : 1), c));
    return { r: rr2, c: cc2, onGrid, px, py };
  }

  rotate(s, grab) {
    const nd = s.dir === 'h' ? 'v' : 'h';
    const pr = s.dir === 'h' ? s.r : s.r + grab;
    const pc = s.dir === 'h' ? s.c + grab : s.c;
    // keep the tapped cell fixed if possible, otherwise slide along the new axis
    const order = [grab];
    for (let k = 0; k < s.len; k++) if (k !== grab) order.push(k);
    for (const k of order) {
      const cand = { ...s, dir: nd, r: nd === 'v' ? pr - k : pr, c: nd === 'h' ? pc - k : pc };
      if (canPlace(this.ships, cand, this.touch, s)) {
        Object.assign(s, { r: cand.r, c: cand.c, dir: nd });
        this.anim.set(s.id, { t0: this.t, kind: 'spin' });
        this.o.snd.rotate();
        this.changed();
        return true;
      }
    }
    this.anim.set(s.id, { t0: this.t, kind: 'shake' });
    this.o.snd.bad();
    this.o.haptic([20, 40, 20]);
    return false;
  }

  dropAnywhere(s) {
    // tap on a docked ship = put it somewhere free on the board
    const out = completeFleet(
      this.fleetId,
      this.ships.filter((x) => x.r != null || x === s),
    );
    const placed = out && out.find((x) => x.id === s.id);
    if (!placed) {
      this.o.snd.bad();
      return;
    }
    Object.assign(s, { r: placed.r, c: placed.c, dir: placed.dir });
    this.anim.set(s.id, { t0: this.t, kind: 'drop' });
    this.o.snd.place();
    this.changed();
  }

  // ---------------------------------------------------------------- drawing
  frame(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.draw();
  }

  draw() {
    const g = this.g;
    const { W, H, dpr } = this;
    if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const { x, y, s } = this.grid;
    const cs = s / N;
    const t = this.t;
    const d = this.drag && this.drag.moved ? this.drag : null;
    paintFrame(g, x, y, s, s, 0.4);
    paintWater(g, x, y, s, s, cs, this.o.theme, t, 6);
    paintGrid(g, x, y, cs, this.o.theme);
    // labels
    g.save();
    g.font = `800 ${Math.max(9, Math.min(12, cs * 0.34))}px Nunito, system-ui, sans-serif`;
    g.fillStyle = 'rgba(243,194,74,0.85)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = 0; k < N; k++) {
      g.fillText('ABCDEFGHIJ'[k], x + k * cs + cs / 2, y - 9);
    }
    g.textAlign = 'right';
    for (let k = 0; k < N; k++) g.fillText(String(k + 1), x - 5, y + k * cs + cs / 2);
    g.restore();
    // forbidden halo for no-touch fleets
    if (!this.touch) {
      const occ = occupancy(this.ships, d ? d.ship : null, false);
      g.save();
      g.fillStyle = d ? 'rgba(255,74,92,0.16)' : 'rgba(0,0,0,0.18)';
      for (let i = 0; i < N * N; i++) if (occ[i] === 2) g.fillRect(x + (i % N) * cs + 1, y + ((i / N) | 0) * cs + 1, cs - 2, cs - 2);
      g.restore();
    }
    // snap preview
    let snap = null;
    if (d) {
      snap = this.snapOf(d);
      if (snap.onGrid) {
        const cand = { ...d.ship, r: snap.r, c: snap.c, dir: d.dir };
        const ok = canPlace(this.ships, cand, this.touch, d.ship);
        g.save();
        g.fillStyle = ok ? 'rgba(47,210,122,0.28)' : 'rgba(255,74,92,0.32)';
        g.strokeStyle = ok ? 'rgba(47,210,122,0.9)' : 'rgba(255,74,92,0.9)';
        g.lineWidth = 2;
        rr(g, x + cand.c * cs + 1, y + cand.r * cs + 1, (cand.dir === 'h' ? cand.len : 1) * cs - 2, (cand.dir === 'v' ? cand.len : 1) * cs - 2, 5);
        g.fill();
        g.stroke();
        g.restore();
        snap.ok = ok;
      }
    }
    // placed ships
    g.save();
    rr(g, x, y, s, s, 6);
    g.clip();
    for (const sh of this.ships) {
      if (sh.r == null || (d && d.ship === sh)) continue;
      const a = this.anim.get(sh.id);
      let ox = 0;
      let lift = 0;
      if (a) {
        const k = (t - a.t0) / 0.4;
        if (k >= 1) this.anim.delete(sh.id);
        else if (k >= 0) {
          if (a.kind === 'shake') ox = Math.sin(k * Math.PI * 6) * cs * 0.15 * (1 - k);
          else lift = 1 - easeOut(k);
        }
      }
      paintShip(g, sh, x + ox, y, cs, this.o.skin, { t, wake: true, lift });
    }
    g.restore();
    // dock
    this.drawDock();
    // dragged ship follows the finger
    if (d) {
      const sh = { ...d.ship, dir: d.dir, r: 0, c: 0 };
      const px = snap.px;
      const py = snap.py;
      const ox = px - (d.dir === 'h' ? (d.grab + 0.5) * cs : cs / 2);
      const oy = py - (d.dir === 'v' ? (d.grab + 0.5) * cs : cs / 2);
      paintShip(g, sh, ox, oy, cs, this.o.skin, { t, lift: 1, tint: snap.onGrid ? (snap.ok ? '#2fd27a' : '#ff4a5c') : null });
    }
  }

  drawDock() {
    const g = this.g;
    const { x, y, w, h } = this.dock;
    g.save();
    rr(g, x, y, w, h, 14);
    const bg = g.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#17171b');
    bg.addColorStop(1, '#0d0d10');
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = 'rgba(233,189,82,0.42)';
    g.lineWidth = 1;
    g.stroke();
    this.ships.forEach((s, k) => {
      const sl = this.slots[k];
      const inDock = s.r == null && !(this.drag && this.drag.moved && this.drag.ship === s);
      if (!inDock) {
        g.setLineDash([4, 4]);
        g.strokeStyle = 'rgba(243,194,74,0.22)';
        rr(g, sl.x, sl.y + sl.h * 0.15, sl.w, sl.h * 0.7, sl.h * 0.35);
        g.stroke();
        g.setLineDash([]);
        return;
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(sl.x + sl.w / 2 + 2, sl.y + sl.h * 0.62, sl.w / 2, sl.h * 0.28, 0, 0, Math.PI * 2);
      g.fill();
      const bob = Math.sin(this.t * 2 + k) * 1.2;
      g.drawImage(shipSprite(s.cls, s.len, this.o.skin, 'body'), sl.x, sl.y + bob, sl.w, sl.h);
    });
    g.restore();
  }
}
