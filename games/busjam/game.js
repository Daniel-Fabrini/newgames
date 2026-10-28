// Runtime of one Bus Jam level: layout, animation loop, input, rules and boosters.
// main.js owns the DOM chrome (HUD, booster buttons, panels) and listens to events.

import { PALETTE, sweep, overlap, contactDistance, dirAngle, dirVec, solve, reshuffleQueue } from './logic.js';
import * as art from './art.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const angLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const SLOT_LEN = { car: 0.64, van: 0.76, bus: 0.86, coach: 0.92 };

// ---------------------------------------------------------------- paths
class Path {
  constructor(pts, radius) {
    const P = [pts[0]];
    for (const p of pts.slice(1)) {
      const q = P[P.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) P.push(p);
    }
    const out = [P[0]];
    for (let i = 1; i < P.length - 1; i++) {
      const A = P[i - 1];
      const B = P[i];
      const C = P[i + 1];
      const l1 = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const l2 = Math.hypot(C[0] - B[0], C[1] - B[1]);
      const d1 = [(B[0] - A[0]) / l1, (B[1] - A[1]) / l1];
      const d2 = [(C[0] - B[0]) / l2, (C[1] - B[1]) / l2];
      const turn = Math.acos(clamp(d1[0] * d2[0] + d1[1] * d2[1], -1, 1));
      if (turn < 0.01) {
        out.push(B);
        continue;
      }
      const cut = Math.min(radius * Math.tan(Math.min(turn, 2.6) / 2), l1 * (i === 1 ? 0.9 : 0.5), l2 * (i === P.length - 2 ? 0.9 : 0.5));
      const B1 = [B[0] - d1[0] * cut, B[1] - d1[1] * cut];
      const B2 = [B[0] + d2[0] * cut, B[1] + d2[1] * cut];
      out.push(B1);
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        out.push([a * B1[0] + b * B[0] + c * B2[0], a * B1[1] + b * B[1] + c * B2[1]]);
      }
    }
    if (P.length > 1) out.push(P[P.length - 1]);
    this.pts = out;
    this.cum = [0];
    for (let i = 1; i < out.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
    this.length = this.cum[this.cum.length - 1];
  }
  pos(d) {
    const { pts, cum } = this;
    if (pts.length === 1) return [pts[0][0], pts[0][1]];
    d = clamp(d, 0, this.length);
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= d) lo = m;
      else hi = m;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const t = (d - cum[lo]) / seg;
    return [lerp(pts[lo][0], pts[hi][0], t), lerp(pts[lo][1], pts[hi][1], t)];
  }
  at(d) {
    const [x, y] = this.pos(d);
    const a = this.pos(d - 3);
    const b = this.pos(d + 3);
    return { x, y, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
}

// ---------------------------------------------------------------- game
export class Game {
  constructor(host, opts) {
    this.host = host;
    this.def = opts.def;
    this.sfx = opts.sfx;
    this.t = opts.t;
    this.emit = opts.onEvent || (() => {});
    this.hints = !!opts.hints;
    this.theme = art.THEME_STYLES[(this.def.theme || 0) % art.THEME_STYLES.length];
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'g-busjam-canvas';
    this.g = this.canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.probe = document.createElement('div');
    this.probe.className = 'g-busjam-probe';
    host.append(this.canvas, this.probe);
    this.time = 0;
    this.raf = 0;
    this.last = 0;
    this.dead = false;
    this.paused = false;
    this.reset();

    this.onDown = (e) => this.pointerDown(e);
    this.onUp = (e) => this.pointerUp(e);
    this.onCancel = () => (this.down = null);
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onCancel);
    this.ro = new ResizeObserver(() => this.relayout());
    this.ro.observe(host);
    this.onVis = () => {
      this.last = 0;
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.layout();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  reset() {
    const def = this.def;
    this.vehicles = def.vehicles.map((v) => ({
      ...v,
      col: PALETTE[v.color],
      state: 'lot',
      bay: -1,
      seq: 0,
      assigned: 0,
      arrived: 0,
      revealed: !v.mystery,
      unlocked: !v.lock,
      bump: null,
      wobble: 0,
      wiggle: 0,
      popT: 0,
      seatPop: 0,
      path: null,
      dist: 0,
      speed: 0,
      lift: 0,
      departIn: -1,
      x: 0,
      y: 0,
      ang: 0,
      L: 0,
      W: 0,
    }));
    this.bays = [];
    for (let i = 0; i < def.slots + def.locked; i++) this.bays.push({ locked: i >= def.slots, vid: -1, flash: 0, unlockT: 0, glow: 0 });
    this.queue = def.queue.slice();
    this.qpos = this.queue.map((_, i) => i);
    this.qhop = this.queue.map(() => 0);
    this.total = this.queue.length;
    this.walkers = [];
    this.particles = [];
    this.heli = null;
    this.pickMode = false;
    this.snapshots = [];
    this.over = null;
    this.seq = 0;
    this.departed = 0;
    this.boardT = 0;
    this.stuckT = 0;
    this.winT = 0;
    this.hintId = -1;
    this.hintT = 0;
    this.moves = 0;
    this.boostersUsed = 0;
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    this.canvas.remove();
    this.probe.remove();
    art.clearSprites();
  }

  // ------------------------------------------------------------ layout
  layout() {
    const host = this.host;
    const W = Math.max(200, host.clientWidth);
    const H = Math.max(300, host.clientHeight);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.dpr = dpr;
    for (const c of [this.canvas, this.bg]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    const safeB = this.probe.offsetHeight || 0;
    const def = this.def;
    const gw = Math.min(W, 500);
    const ox = (W - gw) / 2;
    const L = { W, H, gw, ox, cols: def.cols, rows: def.rows };

    // boarding slots row (bottom), boosters on both sides
    const nb = this.bays.length;
    const side = 10;
    const boost = clamp(gw * 0.135, 46, 60);
    const areaW = gw - 2 * side - 2 * boost - 16;
    const sg = 6;
    const sw = Math.min(66, (areaW - sg * (nb - 1)) / nb);
    const sh = Math.min(sw * 1.4, 86);
    const rowCY = H - safeB - 12 - sh / 2;
    const totalW = nb * sw + (nb - 1) * sg;
    L.bays = this.bays.map((_, i) => ({ x: ox + gw / 2 - totalW / 2 + sw / 2 + i * (sw + sg), y: rowCY, w: sw, h: sh }));
    L.boost = { size: boost, y: rowCY - boost / 2, left: ox + side, right: ox + gw - side - boost };
    L.slotStrip = { y0: rowCY - sh / 2 - 10, y1: H };

    // station with the passenger line
    const ps = clamp(gw / 15, 20, 30);
    const rowsQ = H < 560 ? 2 : 3;
    const rowGap = ps * 1.08;
    const feet0 = L.slotStrip.y0 - 9;
    const stY1 = L.slotStrip.y0 - 2;
    const stY0 = feet0 - (rowsQ - 1) * rowGap - ps * 1.12 - 4;
    L.station = { x0: ox + 6, x1: ox + gw - 6, y0: stY0, y1: stY1 };
    L.ps = ps;
    const sp = ps * 0.68;
    L.sp = sp;
    const qx0 = ox + 18;
    const qx1 = ox + gw - 18;
    L.front = { x: ox + gw / 2, y: feet0 };
    const rowsY = [];
    for (let k = 0; k < rowsQ; k++) rowsY.push(feet0 - k * rowGap);
    const poly = [[L.front.x, rowsY[0]]];
    for (let k = 0; k < rowsQ; k++) {
      const xEnd = k % 2 === 0 ? qx1 : qx0;
      poly.push([xEnd, rowsY[k]]);
      if (k < rowsQ - 1) poly.push([xEnd, rowsY[k + 1]]);
    }
    const qpath = new Path(poly, 0.01);
    L.qpts = [];
    for (let d = 0; d <= qpath.length + 0.01; d += sp) L.qpts.push(qpath.pos(d));
    L.ropes = [];
    for (let k = 0; k < rowsQ - 1; k++) {
      const y = rowsY[k + 1] + 3;
      if (k % 2 === 0) L.ropes.push([qx0 - 6, qx1 - sp * 1.3, y]);
      else L.ropes.push([qx0 + sp * 1.3, qx1 + 6, y]);
    }
    L.sign = { x: ox + 26, y: rowsY[0] };

    // ring road + lot in the remaining space
    const top = 4;
    const bottom = stY0 - 4;
    const mside = clamp(gw * 0.035, 8, 18);
    const lotPad = 5;
    const curb = 5;
    const ulW = (gw - 2 * mside - 2 * lotPad - 2 * curb) / (def.cols + 1.7);
    const ulH = (bottom - top - 2 * lotPad - 2 * curb) / (def.rows + 1.7);
    const ul = Math.max(12, Math.min(ulW, ulH, 60));
    const roadW = ul * 0.82;
    L.ul = ul;
    L.roadW = roadW;
    L.lotPad = lotPad;
    const lw = def.cols * ul;
    const lh = def.rows * ul;
    const midY = (top + bottom) / 2;
    L.lot = { x: ox + gw / 2 - lw / 2, y: midY - lh / 2, w: lw, h: lh };
    const e = lotPad + 3 + roadW / 2;
    L.ring = { x0: L.lot.x - e, y0: L.lot.y - e, x1: L.lot.x + lw + e, y1: L.lot.y + lh + e };
    this.L = L;
    this.drawStatic();
    this.emit('layout', L);
  }

  relayout() {
    if (this.dead) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (this.L && Math.abs(w - this.L.W) < 1 && Math.abs(h - this.L.H) < 1) return;
    this.settle();
    art.clearSprites();
    this.layout();
  }

  drawStatic() {
    const g = this.bg.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.L.W, this.L.H);
    let s = (this.def.level || 1) * 9301 + 49297;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    art.drawScene(g, this.L, this.theme, rnd);
  }

  lotPos(v) {
    return { x: this.L.lot.x + v.cx * this.L.ul, y: this.L.lot.y + v.cy * this.L.ul };
  }
  lotDims(v) {
    return { L: v.len * this.L.ul * 0.9, W: this.L.ul * 0.72 };
  }
  slotDims(v) {
    const b = this.L.bays[0];
    return { L: b.h * SLOT_LEN[v.type], W: b.w * 0.6 };
  }

  // ------------------------------------------------------------ rules
  inLot(v) {
    return v.state === 'lot';
  }
  isLocked(v) {
    return (v.lock || 0) > this.departed;
  }
  blockersIn(v) {
    return this.def.blockers[v.id].filter((j) => this.vehicles[j].state === 'lot');
  }
  exitable(v) {
    return v.state === 'lot' && !this.isLocked(v) && this.blockersIn(v).length === 0;
  }
  freeBay() {
    return this.bays.findIndex((b) => !b.locked && b.vid < 0);
  }
  openSlots() {
    return this.bays.filter((b) => !b.locked).length;
  }
  boarded() {
    return this.total - this.queue.length;
  }

  solverState() {
    const parked = this.vehicles
      .filter((v) => v.bay >= 0 && v.assigned < v.seats && v.state !== 'gone' && v.state !== 'depart')
      .sort((a, b) => a.seq - b.seq)
      .map((v) => ({ id: v.id, rem: v.seats - v.assigned }));
    return {
      inLot: this.vehicles.filter((v) => v.state === 'lot').map((v) => v.id),
      parked,
      departed: this.departed,
      slots: this.openSlots(),
      queue: this.queue.slice(),
    };
  }

  computeHint() {
    const st = this.solverState();
    const front = this.queue[0];
    const res = solve(this.def, st, 6000);
    if (res.ok && res.moves.length) return res.moves[0];
    const ex = this.vehicles.filter((v) => this.exitable(v));
    const m = ex.find((v) => v.color === front);
    return m ? m.id : ex.length ? ex[0].id : -1;
  }

  updateHint() {
    if (!this.hints || this.over) {
      this.hintId = -1;
      return;
    }
    this.hintId = this.queue.length ? this.computeHint() : -1;
  }

  // ------------------------------------------------------------ snapshots (undo)
  snapshot() {
    return {
      vs: this.vehicles.map((v) => {
        let st = v.state;
        if (st === 'lot') st = 'lot';
        else if (st === 'gone' || st === 'depart' || v.assigned >= v.seats) st = 'gone';
        else st = 'parked';
        return { state: st, bay: st === 'parked' ? v.bay : -1, seq: v.seq, assigned: v.assigned };
      }),
      queue: this.queue.slice(),
      seq: this.seq,
      departed: this.departed,
    };
  }

  restore(s) {
    this.walkers = [];
    this.heli = null;
    this.pickMode = false;
    this.over = null;
    this.stuckT = 0;
    this.winT = 0;
    for (const b of this.bays) b.vid = -1;
    s.vs.forEach((o, i) => {
      const v = this.vehicles[i];
      v.state = o.state;
      v.bay = o.bay;
      v.seq = o.seq;
      v.assigned = o.assigned;
      v.arrived = o.assigned;
      v.bump = null;
      v.path = null;
      v.lift = 0;
      v.departIn = -1;
      v.wobble = 0;
      v.wiggle = 0;
      if (o.state === 'parked') this.bays[o.bay].vid = v.id;
      if (o.state === 'lot') {
        v.popT = 1;
        const p = this.lotPos(v);
        this.puff(p.x, p.y, 6, '#ffffff');
      }
    });
    this.queue = s.queue.slice();
    this.qpos = this.queue.map((_, i) => i);
    this.qhop = this.queue.map(() => 0);
    this.seq = s.seq;
    this.departed = s.departed;
    for (const v of this.vehicles) {
      v.revealed = !v.mystery || v.state !== 'lot' || this.blockersIn(v).length === 0;
      v.unlocked = !this.isLocked(v);
    }
    this.updateHint();
  }

  // Instantly finishes running animations (used on resize).
  settle() {
    for (const v of this.vehicles) {
      v.bump = null;
      if (v.state === 'drive' || v.state === 'wait' || v.state === 'heli') {
        v.state = 'parked';
        v.lift = 0;
        v.path = null;
      } else if (v.state === 'depart') {
        v.state = 'gone';
        if (v.bay >= 0 && this.bays[v.bay].vid === v.id) this.bays[v.bay].vid = -1;
      }
    }
    if (this.heli) this.heli = null;
    for (const w of this.walkers) this.vehicles[w.vid].arrived++;
    this.walkers = [];
    for (const v of this.vehicles) if (v.state === 'parked' && v.arrived >= v.seats && v.departIn < 0) v.departIn = 0.2;
  }

  // ------------------------------------------------------------ input
  pointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = this.canvas.getBoundingClientRect();
    this.down = { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
  }
  pointerUp(e) {
    if (!this.down || this.down.id !== e.pointerId) return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const d = this.down;
    this.down = null;
    if (Math.hypot(x - d.x, y - d.y) > 18) return;
    this.tap(x, y);
  }

  vehicleAt(x, y) {
    const L = this.L;
    const lx = (x - L.lot.x) / L.ul;
    const ly = (y - L.lot.y) / L.ul;
    let best = null;
    let bestD = Infinity;
    for (const v of this.vehicles) {
      if (v.state !== 'lot') continue;
      const [ux, uy] = dirVec(v.dir);
      const dx = lx - v.cx;
      const dy = ly - v.cy;
      const along = Math.abs(dx * ux + dy * uy) - (v.len / 2 - 0.08);
      const side = Math.abs(-dx * uy + dy * ux) - 0.4;
      const dist = Math.hypot(Math.max(0, along), Math.max(0, side));
      if (dist < bestD) {
        bestD = dist;
        best = v;
      }
    }
    return bestD <= 0.3 ? best : null;
  }

  tap(x, y) {
    if (this.over || this.paused) return;
    for (let i = 0; i < this.bays.length; i++) {
      const b = this.L.bays[i];
      if (this.bays[i].locked && Math.abs(x - b.x) < b.w / 2 + 4 && Math.abs(y - b.y) < b.h / 2 + 4) {
        this.emit('slotTap');
        return;
      }
    }
    const v = this.vehicleAt(x, y);
    if (this.pickMode) {
      if (v) this.heliPick(v);
      return;
    }
    if (v) this.tapVehicle(v);
  }

  tapVehicle(v) {
    if (v.state !== 'lot' || v.bump) return;
    const sfx = this.sfx;
    if (this.isLocked(v)) {
      v.wiggle = 1;
      sfx.play('error');
      sfx.vibrate(25);
      this.emit('locked', { n: v.lock - this.departed });
      return;
    }
    const blockers = this.blockersIn(v);
    if (blockers.length) {
      let best = Infinity;
      let who = null;
      for (const j of blockers) {
        const d = contactDistance(v, this.vehicles[j]);
        if (d < best) {
          best = d;
          who = this.vehicles[j];
        }
      }
      if (!isFinite(best)) best = 0.3;
      v.bump = { phase: 'go', d: 0, max: Math.max(this.L.ul * 0.12, best * this.L.ul - 1), speed: 0, t: 0, who };
      sfx.play('tap');
      this.emit('bump');
      return;
    }
    const bay = this.freeBay();
    if (bay < 0) {
      for (const b of this.bays) if (!b.locked) b.flash = 1;
      v.wiggle = 0.6;
      sfx.play('error');
      sfx.vibrate([20, 40, 20]);
      this.emit('slotsFull');
      return;
    }
    this.send(v, bay, 'drive');
  }

  send(v, bay, mode) {
    this.snapshots.push(this.snapshot());
    if (this.snapshots.length > 40) this.snapshots.shift();
    v.bay = bay;
    v.seq = ++this.seq;
    this.bays[bay].vid = v.id;
    this.departed++;
    this.moves++;
    if (!v.revealed) this.reveal(v);
    const p = this.lotPos(v);
    const d = this.lotDims(v);
    v.x = p.x;
    v.y = p.y;
    v.ang = dirAngle(v.dir);
    v.L = d.L;
    v.W = d.W;
    if (mode === 'drive') {
      v.state = 'wait';
      v.waitT = 0;
      this.sfx.play('select');
      this.sfx.tone({ freq: 120, to: 220, dur: 0.32, type: 'sawtooth', vol: 0.06 });
    } else {
      v.state = 'heli';
    }
    this.hintId = -1;
    this.emit('move', { id: v.id });
  }

  reveal(v) {
    v.revealed = true;
    v.popT = 1;
    const p = v.state === 'lot' ? this.lotPos(v) : v;
    this.sparkle(p.x, p.y, v.col.base, 10);
    this.sfx.play('pop');
  }

  // Can the vehicle start driving without passing through one that is still moving out?
  pathClear(v) {
    const sw = sweep(v);
    const L = this.L;
    for (const u of this.vehicles) {
      if (u === v) continue;
      let obb = null;
      if (u.state === 'wait' && u.seq < v.seq) {
        obb = { cx: u.cx, cy: u.cy, ...unitVec(dirAngle(u.dir)), hl: u.len / 2, hw: 0.4 };
      } else if (u.state === 'drive' && u.path) {
        const cx = (u.x - L.lot.x) / L.ul;
        const cy = (u.y - L.lot.y) / L.ul;
        if (cx < -1.5 || cy < -1.5 || cx > L.cols + 1.5 || cy > L.rows + 1.5) continue;
        obb = { cx, cy, ...unitVec(u.ang), hl: u.L / L.ul / 2 + 0.05, hw: u.W / L.ul / 2 + 0.05 };
      }
      if (obb && overlap(sw, obb)) return false;
    }
    return true;
  }

  startDrive(v) {
    const L = this.L;
    const S = this.lotPos(v);
    const [fx, fy] = dirVec(v.dir);
    const R = L.ring;
    let t = Infinity;
    if (fx > 1e-6) t = Math.min(t, (R.x1 - S.x) / fx);
    if (fx < -1e-6) t = Math.min(t, (R.x0 - S.x) / fx);
    if (fy > 1e-6) t = Math.min(t, (R.y1 - S.y) / fy);
    if (fy < -1e-6) t = Math.min(t, (R.y0 - S.y) / fy);
    const P = { x: clamp(S.x + fx * t, R.x0, R.x1), y: clamp(S.y + fy * t, R.y0, R.y1) };
    const bay = L.bays[v.bay];
    const T = { x: bay.x, y: R.y1 };
    const w = R.x1 - R.x0;
    const h = R.y1 - R.y0;
    const per = 2 * (w + h);
    const sOf = (p) => {
      if (Math.abs(p.y - R.y0) < 0.6) return p.x - R.x0;
      if (Math.abs(p.x - R.x1) < 0.6) return w + (p.y - R.y0);
      if (Math.abs(p.y - R.y1) < 0.6) return w + h + (R.x1 - p.x);
      return 2 * w + h + (R.y1 - p.y);
    };
    const corners = [
      [R.x0, R.y0, 0],
      [R.x1, R.y0, w],
      [R.x1, R.y1, w + h],
      [R.x0, R.y1, 2 * w + h],
    ];
    const sP = sOf(P);
    const sT = sOf(T);
    const cw = (sT - sP + per) % per;
    const ccw = (per - cw) % per;
    const tangent = (s) => {
      const m = ((s % per) + per) % per;
      if (m < w) return [1, 0];
      if (m < w + h) return [0, 1];
      if (m < 2 * w + h) return [-1, 0];
      return [0, -1];
    };
    const tcw = tangent(sP + 0.5);
    const pen = (sign) => (fx * tcw[0] * sign + fy * tcw[1] * sign < -0.3 ? L.ul * 3 : 0);
    const useCw = cw + pen(1) <= ccw + pen(-1);
    const pts = [[S.x, S.y], [P.x, P.y]];
    const passed = [];
    for (const c of corners) {
      if (useCw) {
        const dc = (c[2] - sP + per) % per;
        if (dc > 0.5 && dc < cw - 0.5) passed.push([dc, c]);
      } else {
        const dc = (sP - c[2] + per) % per;
        if (dc > 0.5 && dc < ccw - 0.5) passed.push([dc, c]);
      }
    }
    passed.sort((a, b) => a[0] - b[0]);
    for (const [, c] of passed) pts.push([c[0], c[1]]);
    pts.push([T.x, T.y], [bay.x, bay.y]);
    v.path = new Path(pts, L.roadW * 0.95);
    v.dist = 0;
    v.speed = 0;
    v.hopLen = Math.max(1, bay.y - R.y1);
    v.state = 'drive';
    this.sfx.play('whoosh');
  }

  // ------------------------------------------------------------ boosters
  canUse(kind) {
    if (this.over === 'win') return 'cantNow';
    if (kind === 'undo') return this.snapshots.length ? '' : 'noUndo';
    if (kind === 'slot') return this.bays.some((b) => b.locked) ? '' : 'noLockedSlot';
    if (kind === 'heli') {
      if (this.heli) return 'cantNow';
      if (this.freeBay() < 0) return 'heliNeedSlot';
      if (!this.vehicles.some((v) => v.state === 'lot')) return 'cantNow';
      return '';
    }
    if (kind === 'shuffle') return this.queue.length > 1 && !this.heli ? '' : 'cantNow';
    return '';
  }

  useUndo() {
    const s = this.snapshots.pop();
    if (!s) return false;
    this.restore(s);
    this.boostersUsed++;
    this.sfx.play('whoosh');
    this.emit('undo');
    return true;
  }

  useSlot() {
    const b = this.bays.find((x) => x.locked);
    if (!b) return false;
    b.locked = false;
    b.unlockT = 1;
    const i = this.bays.indexOf(b);
    const r = this.L.bays[i];
    this.sparkle(r.x, r.y, '#ffd34d', 22);
    this.sfx.play('levelup');
    this.boostersUsed++;
    if (this.over === 'fail') this.over = null;
    this.stuckT = 0;
    return true;
  }

  useShuffle() {
    const st = this.solverState();
    const seed = (Math.random() * 1e9) | 0;
    const q = reshuffleQueue(this.def, st, seed);
    if (q.length !== this.queue.length) return false;
    this.queue = q;
    this.qhop = this.queue.map((_, i) => 0.6 + Math.min(i, 40) * 0.012);
    for (let i = 0; i < Math.min(this.L.qpts.length, this.queue.length); i++) {
      const p = this.qPoint(this.qpos[i]);
      if (p && i % 3 === 0) this.puff(p.x, p.y - this.L.ps * 0.5, 2, '#ffffff');
    }
    this.sfx.play('whoosh');
    this.sfx.play('pop');
    this.boostersUsed++;
    if (this.over === 'fail') this.over = null;
    this.stuckT = 0;
    this.updateHint();
    return true;
  }

  startHeliPick() {
    this.pickMode = true;
    this.hintId = -1;
  }
  cancelPick() {
    this.pickMode = false;
  }

  heliPick(v) {
    const bay = this.freeBay();
    if (bay < 0) {
      this.emit('heliNoSlot');
      return;
    }
    this.pickMode = false;
    this.emit('heliPicked');
    this.boostersUsed++;
    const from = this.lotPos(v);
    const wasLocked = this.isLocked(v);
    this.send(v, bay, 'heli');
    if (wasLocked) v.unlocked = true;
    const b = this.L.bays[bay];
    this.heli = { v, t: 0, from, to: { x: b.x, y: b.y }, a0: dirAngle(v.dir), rotorT: 0 };
    this.sfx.play('whoosh');
  }

  // ------------------------------------------------------------ effects
  puff(x, y, n, color = '#ffffff') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 10 + Math.random() * 30;
      this.particles.push({ kind: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 8, life: 0, max: 0.5 + Math.random() * 0.3, size: 4 + Math.random() * 5, color });
    }
  }
  sparkle(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 110;
      this.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0, max: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 3, color: Math.random() < 0.5 ? color : '#fff6c8' });
    }
  }
  confetti(x, y, n = 18) {
    const cols = ['#ffd34d', '#ff5fa2', '#3fd0ff', '#7bff8a', '#ffffff', '#ff8a3d'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const s = 120 + Math.random() * 160;
      this.particles.push({ kind: 'conf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.9 + Math.random() * 0.5, size: 3 + Math.random() * 3, color: cols[i % cols.length], rot: Math.random() * 6 });
    }
  }

  qPoint(p) {
    const pts = this.L.qpts;
    if (p < 0) p = 0;
    const i = Math.floor(p);
    if (i >= pts.length - 1) return i >= pts.length ? null : { x: pts[i][0], y: pts[i][1] };
    const t = p - i;
    return { x: lerp(pts[i][0], pts[i + 1][0], t), y: lerp(pts[i][1], pts[i + 1][1], t) };
  }

  // ------------------------------------------------------------ main loop
  loop(ts) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 0.016;
    this.last = ts;
    if (!this.paused) this.update(dt);
    this.render();
  }

  update(dt) {
    this.time += dt;
    const L = this.L;
    const ul = L.ul;
    const vmax = clamp(ul * 15, 380, 720);

    for (const v of this.vehicles) {
      if (v.popT > 0) v.popT = Math.max(0, v.popT - dt * 3);
      if (v.seatPop > 0) v.seatPop = Math.max(0, v.seatPop - dt * 5);
      if (v.wobble > 0) v.wobble = Math.max(0, v.wobble - dt * 2.6);
      if (v.wiggle > 0) v.wiggle = Math.max(0, v.wiggle - dt * 2.4);

      if (v.bump) {
        const b = v.bump;
        if (b.phase === 'go') {
          b.speed = Math.min(vmax * 0.85, b.speed + vmax * 5 * dt);
          b.d += b.speed * dt;
          if (b.d >= b.max) {
            b.d = b.max;
            b.phase = 'hit';
            b.t = 0;
            this.sfx.play('hit');
            this.sfx.vibrate(30);
            if (b.who) b.who.wobble = 1;
            const p = this.lotPos(v);
            const [fx, fy] = dirVec(v.dir);
            const tip = (v.len / 2) * ul + b.d;
            this.sparkle(p.x + fx * tip, p.y + fy * tip, '#ffe066', 7);
          }
        } else if (b.phase === 'hit') {
          b.t += dt;
          if (b.t > 0.14) b.phase = 'back';
        } else {
          b.d -= Math.max(40, b.d * 7) * dt;
          if (b.d <= 0) v.bump = null;
        }
      }

      if (v.state === 'wait') {
        v.waitT += dt;
        if (this.pathClear(v) || v.waitT > 2.5) this.startDrive(v);
      }

      if (v.state === 'drive') {
        const p = v.path;
        const remain = p.length - v.dist;
        const inHop = remain < v.hopLen + 2;
        const cap = inHop ? vmax * 0.75 : vmax;
        v.speed = Math.min(cap, v.speed + vmax * 3.2 * dt);
        v.speed = Math.min(v.speed, Math.sqrt(2 * vmax * 3 * Math.max(0, remain)) + 40);
        v.dist = Math.min(p.length, v.dist + v.speed * dt);
        const a = p.at(v.dist);
        v.x = a.x;
        v.y = a.y;
        v.ang = a.ang;
        const ld = this.lotDims(v);
        const sd = this.slotDims(v);
        const k = clamp(1 - (p.length - v.dist) / v.hopLen, 0, 1);
        v.hopK = k;
        v.lift = Math.sin(Math.PI * k) * 0.9;
        v.L = lerp(ld.L, sd.L, smooth(k));
        v.W = lerp(ld.W, sd.W, smooth(k));
        if (Math.random() < dt * 14 && k === 0) {
          const back = v.L / 2;
          this.particles.push({ kind: 'puff', x: v.x - Math.cos(v.ang) * back, y: v.y - Math.sin(v.ang) * back, vx: -Math.cos(v.ang) * 20, vy: -Math.sin(v.ang) * 20, life: 0, max: 0.45, size: 3 + Math.random() * 3, color: '#ffffff' });
        }
        if (v.dist >= p.length - 0.01) this.arrive(v);
      }

      if (v.state === 'parked' && v.departIn >= 0) {
        v.departIn -= dt;
        if (v.departIn < 0) this.depart(v);
      }

      if (v.state === 'depart') {
        v.speed = Math.min(vmax * 1.1, v.speed + vmax * 2.6 * dt);
        v.dist += v.speed * dt;
        const b = L.bays[v.bay];
        v.y = b.y + v.dist;
        if (v.bay >= 0 && this.bays[v.bay].vid === v.id && v.dist > b.h / 2 + v.L / 2 + 2) this.bays[v.bay].vid = -1;
        if (Math.random() < dt * 20) this.particles.push({ kind: 'puff', x: v.x + (Math.random() - 0.5) * 6, y: v.y - v.L / 2, vx: 0, vy: -30, life: 0, max: 0.4, size: 3 + Math.random() * 3, color: '#ffffff' });
        if (v.y - v.L > L.H + 20) v.state = 'gone';
      }
    }

    // helicopter
    if (this.heli) this.updateHeli(dt);

    // mystery / locks
    for (const v of this.vehicles) {
      if (v.state !== 'lot') continue;
      if (!v.revealed && this.blockersIn(v).length === 0) this.reveal(v);
      if (!v.unlocked && !this.isLocked(v)) {
        v.unlocked = true;
        v.popT = 1;
        const p = this.lotPos(v);
        this.sparkle(p.x, p.y, '#ffd34d', 14);
        this.sfx.play('success');
      }
    }

    // queue walking
    for (let i = 0; i < this.queue.length; i++) {
      if (this.qpos[i] > i) this.qpos[i] = Math.max(i, this.qpos[i] - dt * 10);
      if (this.qhop[i] > 0) this.qhop[i] = Math.max(0, this.qhop[i] - dt * 2.2);
    }

    // boarding
    this.boardT -= dt;
    if (this.boardT <= 0 && this.queue.length && this.qpos[0] < 0.35 && !this.over) {
      const c = this.queue[0];
      let target = null;
      for (const v of this.vehicles) {
        if (v.bay < 0 || v.color !== c || v.assigned >= v.seats) continue;
        if (v.state !== 'parked' && v.state !== 'drive' && v.state !== 'heli' && v.state !== 'wait') continue;
        if (!target || v.seq < target.seq) target = v;
      }
      if (target && target.state === 'parked') this.board(target);
    }

    // walkers
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      w.t += dt;
      if (w.t >= w.dur) {
        this.walkers.splice(i, 1);
        const v = this.vehicles[w.vid];
        v.arrived++;
        v.seatPop = 1;
        this.sfx.tone({ freq: 480 + v.arrived * 55, dur: 0.06, type: 'triangle', vol: 0.16 });
        if (v.arrived >= v.seats && v.departIn < 0) v.departIn = 0.35;
      }
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark' || p.kind === 'conf') p.vy += 260 * dt;
      if (p.kind === 'puff') {
        p.vx *= 0.95;
        p.vy *= 0.95;
      }
      if (p.rot != null) p.rot += dt * 8;
    }

    for (const b of this.bays) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 1.6);
      if (b.unlockT > 0) b.unlockT = Math.max(0, b.unlockT - dt * 1.4);
      if (b.glow > 0) b.glow = Math.max(0, b.glow - dt * 1.5);
    }

    this.checkEnd(dt);
    if (this.hints && !this.over) {
      this.hintT -= dt;
      if (this.hintT <= 0) {
        this.hintT = 0.6;
        const moving = this.vehicles.some((v) => v.state === 'wait' || v.state === 'drive' || v.state === 'heli');
        if (!moving) this.updateHint();
        else this.hintId = -1;
      }
    }
  }

  board(v) {
    this.queue.shift();
    this.qpos.shift();
    this.qhop.shift();
    v.assigned++;
    const F = this.L.front;
    const b = this.L.bays[v.bay];
    const tx = b.x;
    const ty = b.y - b.h * 0.18;
    const dist = Math.hypot(tx - F.x, ty - F.y);
    this.walkers.push({ vid: v.id, col: v.col, x0: F.x, y0: F.y, x1: tx, y1: ty, t: 0, dur: clamp(dist / (this.L.ps * 15), 0.22, 0.6) });
    this.boardT = 0.085;
    this.emit('board', { n: this.boarded(), total: this.total });
  }

  arrive(v) {
    v.state = 'parked';
    const b = this.L.bays[v.bay];
    const sd = this.slotDims(v);
    v.x = b.x;
    v.y = b.y;
    v.ang = Math.PI / 2;
    v.L = sd.L;
    v.W = sd.W;
    v.lift = 0;
    v.popT = 1;
    this.bays[v.bay].glow = 1;
    this.puff(b.x, b.y + b.h * 0.3, 6, '#ffffff');
    this.sfx.play('pop');
    this.sfx.vibrate(12);
    this.emit('park', { id: v.id });
  }

  depart(v) {
    v.state = 'depart';
    v.speed = 0;
    v.dist = 0;
    const b = this.L.bays[v.bay];
    this.confetti(b.x, b.y - b.h * 0.2, 16);
    this.sparkle(b.x, b.y, v.col.light, 10);
    this.sfx.tone({ freq: 440, dur: 0.09, type: 'square', vol: 0.09 });
    this.sfx.tone({ freq: 440, dur: 0.12, type: 'square', vol: 0.09, delay: 0.13 });
    this.sfx.play('success');
    this.sfx.vibrate(18);
    this.emit('depart', { id: v.id });
  }

  updateHeli(dt) {
    const H = this.heli;
    H.t += dt;
    H.rotorT += dt;
    const v = H.v;
    const t = H.t;
    const ld = this.lotDims(v);
    const sd = this.slotDims(v);
    if (Math.floor(H.t / 0.11) !== Math.floor((H.t - dt) / 0.11)) this.sfx.noise({ dur: 0.05, vol: 0.06, freq: 260, q: 0.7 });
    if (t < 0.55) {
      v.x = H.from.x;
      v.y = H.from.y;
      v.lift = 0;
    } else if (t < 0.85) {
      v.lift = easeOut((t - 0.55) / 0.3);
    } else if (t < 1.75) {
      const k = easeInOut((t - 0.85) / 0.9);
      v.x = lerp(H.from.x, H.to.x, k);
      v.y = lerp(H.from.y, H.to.y, k) - Math.sin(Math.PI * k) * 30;
      v.ang = angLerp(H.a0, Math.PI / 2, k);
      v.L = lerp(ld.L, sd.L, k);
      v.W = lerp(ld.W, sd.W, k);
      v.lift = 1;
    } else if (t < 2.05) {
      v.x = H.to.x;
      v.y = H.to.y;
      v.lift = 1 - easeOut((t - 1.75) / 0.3);
    } else if (v.state === 'heli') {
      this.arrive(v);
    }
    if (t < 0.85) {
      v.ang = H.a0;
      v.L = ld.L;
      v.W = ld.W;
    }
    if (t > 2.7) this.heli = null;
  }

  checkEnd(dt) {
    if (this.over) return;
    const moving =
      this.walkers.length ||
      this.heli ||
      this.vehicles.some((v) => v.state === 'wait' || v.state === 'drive' || v.state === 'heli' || v.state === 'depart' || (v.state === 'parked' && v.assigned >= v.seats));
    if (!this.queue.length) {
      if (!moving && this.vehicles.every((v) => v.state === 'gone')) {
        this.winT += dt;
        if (this.winT > 0.25) {
          this.over = 'win';
          this.hintId = -1;
          this.emit('win', { moves: this.moves, boosters: this.boostersUsed });
        }
      }
      return;
    }
    if (moving || this.freeBay() >= 0 || this.qpos[0] > 0.4) {
      this.stuckT = 0;
      return;
    }
    const c = this.queue[0];
    const ok = this.vehicles.some((v) => v.state === 'parked' && v.color === c && v.assigned < v.seats);
    if (ok) {
      this.stuckT = 0;
      return;
    }
    this.stuckT += dt;
    if (this.stuckT > 0.45) {
      this.over = 'fail';
      this.pickMode = false;
      this.hintId = -1;
      for (const b of this.bays) if (!b.locked) b.flash = 1;
      this.emit('fail');
    }
  }

  resume() {
    if (this.over === 'fail') this.over = null;
    this.stuckT = 0;
  }

  // ------------------------------------------------------------ rendering
  render() {
    const g = this.g;
    const L = this.L;
    const dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(this.bg, 0, 0, L.W, L.H);
    const ul = L.ul;
    const time = this.time;

    // lot vehicles (+ waiting ones), back to front
    const lotList = this.vehicles.filter((v) => v.state === 'lot' || v.state === 'wait').sort((a, b) => a.cy - b.cy);
    for (const v of lotList) this.drawLotVehicle(v);

    if (this.pickMode) {
      g.save();
      const pulse = 0.5 + Math.sin(time * 6) * 0.5;
      g.strokeStyle = `rgba(255,214,90,${0.45 + pulse * 0.5})`;
      g.lineWidth = 3;
      for (const v of lotList) {
        if (v.state !== 'lot') continue;
        const p = this.lotPos(v);
        const d = this.lotDims(v);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(dirAngle(v.dir));
        art.rrect(g, -d.L / 2 - 3, -d.W / 2 - 3, d.L + 6, d.W + 6, d.W * 0.35);
        g.stroke();
        g.restore();
      }
      g.restore();
    }

    // bays overlays
    for (let i = 0; i < this.bays.length; i++) this.drawBay(i);

    // driving (on the road, not yet hopping)
    const drivers = this.vehicles.filter((v) => v.state === 'drive' && (v.hopK || 0) === 0);
    for (const v of drivers) this.drawMoving(v);

    // parked + departing
    for (const v of this.vehicles) if (v.state === 'parked' || v.state === 'depart') this.drawParked(v);

    // queue
    this.drawQueue();

    // walkers
    for (const w of this.walkers) {
      const k = clamp(w.t / w.dur, 0, 1);
      const e = easeInOut(k);
      const x = lerp(w.x0, w.x1, e);
      const y = lerp(w.y0, w.y1, e) - Math.sin(Math.PI * k) * L.ps * 0.35;
      const sc = k > 0.75 ? 1 - (k - 0.75) * 2 : 1;
      art.drawPax(g, w.col, x, y, L.ps, dpr, time * 18 + w.vid, true, k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1, sc);
    }

    // hopping vehicles and helicopter cargo above everything on the ground
    for (const v of this.vehicles) if (v.state === 'drive' && (v.hopK || 0) > 0) this.drawMoving(v);
    if (this.heli) {
      const H = this.heli;
      const v = H.v;
      if (v.state === 'heli') this.drawMoving(v);
      this.drawHelicopter(H);
    }

    // particles
    for (const p of this.particles) {
      const k = p.life / p.max;
      g.save();
      if (p.kind === 'puff') {
        g.globalAlpha = (1 - k) * 0.7;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (1 + k * 1.4), 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === 'spark') {
        g.globalAlpha = 1 - k;
        g.fillStyle = p.color;
        g.translate(p.x, p.y);
        g.rotate(k * 4);
        art.drawSymbol(g, 'star', 0, 0, p.size * 1.6, p.color);
      } else {
        g.globalAlpha = 1 - k * k;
        g.fillStyle = p.color;
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
      }
      g.restore();
    }

    // tutorial hand
    if (this.hintId >= 0 && !this.over) {
      const v = this.vehicles[this.hintId];
      if (v && v.state === 'lot') {
        const p = this.lotPos(v);
        g.save();
        g.globalAlpha = 0.35 + Math.sin(time * 5) * 0.15;
        g.fillStyle = '#fff3b0';
        g.beginPath();
        g.arc(p.x, p.y, ul * 0.7, 0, Math.PI * 2);
        g.fill();
        g.restore();
        art.drawHand(g, p.x, p.y, Math.max(34, ul * 0.95), time);
      }
    }
  }

  drawLotVehicle(v) {
    const g = this.g;
    const ul = this.L.ul;
    const p = this.lotPos(v);
    const d = this.lotDims(v);
    let ang = dirAngle(v.dir);
    let x = p.x;
    let y = p.y;
    if (v.bump) {
      const [fx, fy] = dirVec(v.dir);
      x += fx * v.bump.d;
      y += fy * v.bump.d;
      if (v.bump.phase === 'hit') {
        x += (Math.random() - 0.5) * 2.5;
        y += (Math.random() - 0.5) * 2.5;
      }
    }
    if (v.wobble > 0) ang += Math.sin(this.time * 38) * 0.07 * v.wobble;
    if (v.wiggle > 0) {
      ang += Math.sin(this.time * 45) * 0.09 * v.wiggle;
    }
    const pop = v.popT > 0 ? 1 + Math.sin(v.popT * Math.PI) * 0.12 : 1;
    const col = v.revealed ? v.col : art.MYSTERY;
    art.drawVehicle(g, v, x, y, ang, d.L * pop, d.W * pop, this.dpr, { color: col, arrow: true, sprL: d.L, sprW: d.W });
    // badge (color symbol / mystery / lock)
    const back = d.L * (v.type === 'car' ? -0.31 : -0.37);
    const bx = x + Math.cos(ang) * back;
    const by = y + Math.sin(ang) * back;
    if (this.isLocked(v)) {
      art.drawLockBadge(g, bx, by, d.W * 0.3, v.lock - this.departed, this.time);
    } else {
      art.drawBadge(g, bx, by, d.W * 0.22, col);
    }
    void ul;
  }

  drawMoving(v) {
    const g = this.g;
    const ld = this.lotDims(v);
    const sd = this.slotDims(v);
    const late = v.state === 'drive' ? (v.hopK || 0) > 0.5 : v.state === 'heli' && this.heli && this.heli.t > 1.3;
    const spr = late ? sd : ld;
    art.drawVehicle(g, v, v.x, v.y, v.ang, v.L, v.W, this.dpr, { color: v.col, arrow: !late, lift: v.lift, sprL: spr.L, sprW: spr.W });
  }

  drawParked(v) {
    const g = this.g;
    const sd = this.slotDims(v);
    let x = v.x;
    let y = v.y;
    let Lh = sd.L;
    let Wd = sd.W;
    if (v.state === 'parked') {
      const b = this.L.bays[v.bay];
      x = b.x;
      y = b.y;
      if (v.popT > 0) {
        const s = Math.sin(v.popT * Math.PI);
        Lh *= 1 - s * 0.12;
        Wd *= 1 + s * 0.14;
      }
      if (v.seatPop > 0) {
        Lh *= 1 + v.seatPop * 0.04;
        Wd *= 1 + v.seatPop * 0.04;
      }
    }
    art.drawVehicle(g, v, x, y, Math.PI / 2, Lh, Wd, this.dpr, { color: v.col, arrow: false, sprL: sd.L, sprW: sd.W });
    art.drawSeats(g, v, x, y, Math.PI / 2, Lh, Wd, v.col, v.arrived, v.seatPop);
    art.drawBadge(g, x, y + Lh * 0.4, Wd * 0.26, v.col);
  }

  drawBay(i) {
    const g = this.g;
    const b = this.L.bays[i];
    const s = this.bays[i];
    const x = b.x - b.w / 2;
    const y = b.y - b.h / 2;
    if (s.glow > 0) {
      g.save();
      g.globalAlpha = s.glow * 0.8;
      g.strokeStyle = '#ffd34d';
      g.lineWidth = 3;
      art.rrect(g, x - 2, y - 2, b.w + 4, b.h + 4, 13);
      g.stroke();
      g.restore();
    }
    if (s.flash > 0) {
      g.save();
      g.globalAlpha = s.flash * (0.5 + 0.5 * Math.sin(this.time * 20));
      g.strokeStyle = '#ff4d5e';
      g.lineWidth = 3;
      art.rrect(g, x - 1, y - 1, b.w + 2, b.h + 2, 12);
      g.stroke();
      g.restore();
    }
    if (s.locked || s.unlockT > 0) {
      g.save();
      const k = s.locked ? 0 : 1 - s.unlockT;
      g.globalAlpha = 1 - k;
      const cx = b.x;
      const cy = b.y - b.h * 0.08 - k * 30;
      const r = Math.min(b.w, b.h) * 0.24;
      // padlock
      g.strokeStyle = '#d7a628';
      g.lineWidth = r * 0.34;
      g.beginPath();
      g.arc(cx, cy - r * 0.35, r * 0.58, Math.PI, 0);
      g.stroke();
      const gr = g.createLinearGradient(0, cy - r * 0.4, 0, cy + r);
      gr.addColorStop(0, '#ffe58a');
      gr.addColorStop(1, '#c9971c');
      g.fillStyle = gr;
      art.rrect(g, cx - r, cy - r * 0.4, r * 2, r * 1.5, r * 0.35);
      g.fill();
      g.fillStyle = '#4a3600';
      g.beginPath();
      g.arc(cx, cy + r * 0.25, r * 0.2, 0, Math.PI * 2);
      g.fill();
      // label (booster count or price)
      if (s.locked && this.slotLabel) {
        g.font = `900 ${Math.max(10, b.w * 0.22)}px Nunito, system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#f7d774';
        g.fillText(this.slotLabel, cx, b.y + b.h * 0.33);
      }
      g.restore();
    }
  }

  drawQueue() {
    const g = this.g;
    const L = this.L;
    const n = this.queue.length;
    const vis = L.qpts.length;
    const time = this.time;
    const count = Math.min(n, vis + 1);
    for (let i = count - 1; i >= 0; i--) {
      const pos = this.qpos[i];
      if (pos > vis - 1 + 0.999) continue;
      const p = this.qPoint(Math.min(pos, vis - 1));
      if (!p) continue;
      const a = pos > vis - 1 ? clamp(vis - pos, 0, 1) : 1;
      const walking = pos - i > 0.02;
      const hop = this.qhop[i] > 0 && this.qhop[i] < 0.6 ? Math.sin((this.qhop[i] / 0.6) * Math.PI) * L.ps * 0.45 : 0;
      const idle = !walking && i < 6 ? Math.sin(time * 3 + i) * 0.6 : 0;
      art.drawPax(g, PALETTE[this.queue[i]], p.x, p.y - hop + idle * 0.3, L.ps, this.dpr, time * 16 + i * 1.7, walking, a, i === 0 ? 1.08 : 1);
    }
    // remaining counter
    if (n > vis) {
      const last = L.qpts[vis - 1];
      const txt = '+' + (n - vis);
      g.save();
      g.font = `900 ${Math.round(L.ps * 0.45)}px Nunito, system-ui, sans-serif`;
      const tw = g.measureText(txt).width + 12;
      const x = Math.min(L.ox + L.gw - tw - 4, last[0] - tw / 2);
      const y = last[1] - L.ps * 1.45;
      g.fillStyle = 'rgba(16,16,20,0.82)';
      art.rrect(g, x, y, tw, L.ps * 0.62, L.ps * 0.31);
      g.fill();
      g.strokeStyle = 'rgba(247,215,116,0.8)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#f7d774';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt, x + tw / 2, y + L.ps * 0.32);
      g.restore();
    }
    art.drawStopSign(g, L.sign.x, L.sign.y, L.ps * 1.15, n);
  }

  drawHelicopter(H) {
    const g = this.g;
    const v = H.v;
    const s = Math.max(16, this.L.ul * 0.55);
    const t = H.t;
    let hx;
    let hy;
    const start = { x: this.L.W + 60, y: -40 };
    const end = { x: -80, y: -60 };
    if (t < 0.55) {
      const k = easeOut(t / 0.55);
      hx = lerp(start.x, H.from.x, k);
      hy = lerp(start.y, H.from.y - 14, k);
    } else if (t < 2.05) {
      hx = v.x;
      hy = v.y - 14 - v.lift * 8;
    } else {
      const k = clamp((t - 2.05) / 0.65, 0, 1);
      hx = lerp(H.to.x, end.x, k * k);
      hy = lerp(H.to.y - 14, end.y, k * k);
    }
    if (t > 0.5 && t < 2.1) {
      g.save();
      g.strokeStyle = '#2b2f37';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(v.x, v.y - v.lift * 4);
      g.stroke();
      g.fillStyle = '#ffd34d';
      g.beginPath();
      g.arc(v.x, v.y - v.lift * 4, 3, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    art.drawHeli(g, hx, hy, s, H.rotorT, t < 0.55 ? 2.6 : t > 2.05 ? 3.6 : -Math.PI / 2);
  }
}

function unitVec(a) {
  return { ux: Math.cos(a), uy: Math.sin(a) };
}
