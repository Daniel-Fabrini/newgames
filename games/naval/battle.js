// Sea Battle — battle screen canvas: two boards (target big on top, the other
// small below; they swap smoothly), animated sea, ships, shells, splashes,
// explosions with fire and smoke, sinking ships, radar sweep and the aim reticle.

import { N, CELLS, cellsOf, cellName } from './rules.js';
import { paintWater, paintGrid, paintFrame, paintShip, paintMiss, paintFire, paintHitPeg, FX, sweepSprite, shipSprite, shipTint, rr } from './render.js';

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);

export class BattleView {
  // opts: { match, viewer, theme, skins:[a,b], label(owner) → string, onFire(i), snd, haptic(ms) }
  constructor(host, opts) {
    this.host = host;
    this.o = opts;
    this.m = opts.match;
    this.viewer = opts.viewer ?? 0;
    this.theme = opts.theme;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'g-naval-canvas';
    host.append(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.modeK = 0; // 0: target board big · 1: own board big
    this.modeTarget = 0;
    this.parts = [];
    this.shells = [];
    this.hiddenShots = new Set();
    this.hiddenSunk = new Set();
    this.sinking = new Map();
    this.fresh = new Map();
    this.reveal = false;
    this.interactive = false;
    this.alert = false;
    this.aim = -1;
    this.hover = -1;
    this.shake = 0;
    this.t = 0;
    this.smokeAcc = 0;
    this.dead = false;
    this.waiters = [];
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.bindInput();
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.remove();
  }

  get enemy() {
    return 1 - this.viewer;
  }

  setViewer(v) {
    this.viewer = v;
    this.modeK = this.modeTarget = 0;
    this.parts = [];
  }

  // 'attack' = target board big, 'defend' = own board big
  setMode(mode, instant = false) {
    this.modeTarget = mode === 'defend' ? 1 : 0;
    if (instant) this.modeK = this.modeTarget;
    return this.wait(instant ? 0 : 420);
  }

  wait(ms) {
    return new Promise((res) => {
      this.waiters.push({ at: this.t + ms / 1000, res });
    });
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
    const pad = 12;
    const gut = 15;
    const L = {};
    if (W > H * 1.08) {
      // landscape: big board left, side column right
      let S = Math.min(H - pad * 2 - gut - 34, W * 0.56);
      S = Math.floor(S / N) * N;
      const left = Math.max(pad + gut, (W - S - 300) / 2);
      L.big = { x: left, y: pad + gut, s: S };
      L.strip = { x: left, y: L.big.y + S + 8, w: S, h: 22 };
      const cx = left + S + 28;
      const cw = Math.min(320, W - cx - pad);
      L.banner = { x: cx, y: pad, w: cw, h: 46 };
      const s2 = Math.floor(Math.min(cw * 0.75, (H - 140) * 0.55) / N) * N;
      L.small = { x: cx + (cw - s2) / 2, y: pad + 46 + 30, s: s2 };
      L.smallLabel = { x: L.small.x, y: L.small.y - 9 };
      L.log = { x: cx, y: L.small.y + s2 + 12, w: cw, h: Math.max(60, H - (L.small.y + s2 + 12) - pad) };
    } else {
      const top = 58;
      const stripH = 30;
      const minBottom = Math.min(170, Math.max(120, H * 0.21));
      let S = Math.min(W - pad * 2 - gut, H - top - gut - stripH - minBottom - 14, 560);
      S = Math.floor(S / N) * N;
      const bx = Math.round((W - S - gut) / 2 + gut);
      L.banner = { x: Math.max(pad, bx - gut), y: 8, w: Math.min(W - pad * 2, S + gut), h: 44 };
      L.big = { x: bx, y: top + gut, s: S };
      L.strip = { x: bx - gut, y: L.big.y + S + 7, w: S + gut, h: 22 };
      const y0 = L.strip.y + stripH;
      const avail = H - y0 - 12;
      let s2 = Math.min(avail - 16, (S + gut) * 0.46);
      s2 = Math.max(80, Math.floor(s2 / N) * N);
      L.small = { x: bx - gut + 2, y: y0 + 16, s: s2 };
      L.smallLabel = { x: L.small.x, y: y0 + 8 };
      const lx = L.small.x + s2 + 12;
      L.log = { x: lx, y: y0, w: bx + S - lx, h: Math.max(60, Math.min(avail, s2 + 16)) };
    }
    this.L = L;
    if (this.o.onLayout) this.o.onLayout(L);
  }

  rectOf(owner) {
    const e = ease(this.modeK);
    const { big, small } = this.L;
    const k = owner === this.enemy ? e : 1 - e;
    return { x: lerp(big.x, small.x, k), y: lerp(big.y, small.y, k), s: lerp(big.s, small.s, k) };
  }

  bigOwner() {
    return this.modeK < 0.5 ? this.enemy : this.viewer;
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const c = this.canvas;
    const cellAt = (e, owner) => {
      const b = c.getBoundingClientRect();
      const x = e.clientX - b.left;
      const y = e.clientY - b.top;
      const r = this.rectOf(owner);
      const cs = r.s / N;
      const col = Math.floor((x - r.x) / cs);
      const row = Math.floor((y - r.y) / cs);
      if (col < 0 || row < 0 || col >= N || row >= N) return -1;
      return row * N + col;
    };
    let pressing = false;
    let pressedSmall = false;
    this.onDown = (e) => {
      if (this.modeK !== this.modeTarget) return;
      const big = this.bigOwner();
      const small = 1 - big;
      if (cellAt(e, small) >= 0 && this.o.onSwap) {
        pressedSmall = true;
        return;
      }
      if (!this.interactive || big !== this.enemy) return;
      const i = cellAt(e, big);
      if (i < 0) return;
      pressing = true;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.aim = i;
    };
    this.onMove = (e) => {
      if (pressing) {
        const i = cellAt(e, this.enemy);
        this.aim = i;
      } else if (e.pointerType === 'mouse') {
        this.hover = this.interactive && this.bigOwner() === this.enemy ? cellAt(e, this.enemy) : -1;
        c.style.cursor = this.hover >= 0 ? 'crosshair' : 'default';
      }
    };
    this.onUp = (e) => {
      if (pressedSmall) {
        pressedSmall = false;
        if (cellAt(e, 1 - this.bigOwner()) >= 0) this.o.onSwap();
        return;
      }
      if (!pressing) return;
      pressing = false;
      const i = cellAt(e, this.enemy);
      this.aim = -1;
      if (i >= 0 && this.interactive && this.bigOwner() === this.enemy) this.o.onFire(i);
    };
    this.onCancel = () => {
      pressing = false;
      pressedSmall = false;
      this.aim = -1;
    };
    this.onLeave = () => {
      this.hover = -1;
    };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('pointerleave', this.onLeave);
  }

  // ---------------------------------------------------------------- effects
  addPart(p) {
    if (this.parts.length > 520) this.parts.shift();
    p.age = 0;
    p.delay = p.delay || 0;
    this.parts.push(p);
  }

  splash(owner, i) {
    const x = (i % N) + 0.5;
    const y = ((i / N) | 0) + 0.5;
    this.addPart({ o: owner, kind: 'foam', x, y, s0: 0.25, s1: 1.5, life: 0.75 });
    this.addPart({ o: owner, kind: 'ring', x, y, s0: 0.1, s1: 0.95, life: 0.9, a: 0.8 });
    this.addPart({ o: owner, kind: 'ring', x, y, s0: 0.05, s1: 0.7, life: 0.9, a: 0.6, delay: 0.18 });
    for (let k = 0; k < 16; k++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(0.6, 2.2);
      this.addPart({ o: owner, kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - rand(1.6, 3.4), ay: 8, s0: rand(0.08, 0.16), s1: 0.05, life: rand(0.55, 0.9) });
    }
    this.addPart({ o: owner, kind: 'steam', x, y: y - 0.1, vy: -0.4, s0: 0.4, s1: 1.1, life: 0.9, a: 0.6 });
  }

  explode(owner, i, big = false) {
    const x = (i % N) + 0.5;
    const y = ((i / N) | 0) + 0.5;
    const m = big ? 1.5 : 1;
    this.addPart({ o: owner, kind: 'flash', x, y, s0: 0.5, s1: 2.6 * m, life: 0.28 });
    this.addPart({ o: owner, kind: 'ring', x, y, s0: 0.1, s1: 1.4 * m, life: 0.45, a: 0.9, col: '255,170,70' });
    for (let k = 0; k < 7; k++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(0.2, 0.9) * m;
      this.addPart({ o: owner, kind: 'fire', x: x + rand(-0.15, 0.15), y: y + rand(-0.15, 0.15), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, s0: rand(0.4, 0.7) * m, s1: rand(0.9, 1.4) * m, life: rand(0.45, 0.8) });
    }
    for (let k = 0; k < 18; k++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(1.5, 4.5) * m;
      this.addPart({ o: owner, kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, ay: 4, s0: rand(0.1, 0.2), s1: 0.04, life: rand(0.4, 0.9) });
    }
    for (let k = 0; k < 6; k++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(0.8, 2.6);
      this.addPart({ o: owner, kind: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.6, ay: 6, s0: rand(0.05, 0.1), s1: 0.05, life: rand(0.6, 1), rot: rand(0, 6), vr: rand(-12, 12) });
    }
    for (let k = 0; k < 5; k++) {
      this.addPart({ o: owner, kind: 'smoke', x: x + rand(-0.2, 0.2), y: y + rand(-0.2, 0.2), vx: rand(-0.1, 0.25), vy: rand(-0.5, -0.2), s0: 0.5, s1: rand(1.3, 1.9) * m, life: rand(1.3, 2.2), delay: 0.12 + k * 0.05, a: 0.85 });
    }
  }

  sinkFx(owner, ship) {
    const cells = cellsOf(ship);
    for (const i of cells) {
      const x = (i % N) + 0.5;
      const y = ((i / N) | 0) + 0.5;
      this.addPart({ o: owner, kind: 'ring', x, y, s0: 0.2, s1: 1.1, life: 1.2, a: 0.5, delay: rand(0, 0.5) });
      for (let k = 0; k < 6; k++) {
        this.addPart({ o: owner, kind: 'bubble', x: x + rand(-0.35, 0.35), y: y + rand(-0.35, 0.35), vy: rand(-0.25, -0.05), s0: rand(0.04, 0.09), s1: rand(0.1, 0.16), life: rand(0.5, 0.9), delay: rand(0.2, 1.6) });
      }
      this.addPart({ o: owner, kind: 'steam', x, y, vx: 0.15, vy: -0.4, s0: 0.5, s1: 1.4, life: 1.6, a: 0.55, delay: rand(0.1, 0.6) });
    }
  }

  muzzle(owner, x, y) {
    this.addPart({ o: owner, kind: 'flash', x, y, s0: 0.3, s1: 1.4, life: 0.18 });
    this.addPart({ o: owner, kind: 'smoke', x, y, vx: 0.2, vy: -0.3, s0: 0.3, s1: 1.0, life: 0.9, a: 0.6 });
  }

  // Fires a shell from the attacker's side to cell i of the defender board.
  // `res` is the already-resolved result; the markers stay hidden until impact.
  shoot(attacker, i, res) {
    const def = 1 - attacker;
    this.hiddenShots.add(def + ':' + i);
    if (res.res === 'sunk') this.hiddenSunk.add(def + ':' + res.ship.id);
    let from;
    const ab = this.m.boards[attacker];
    const afloat = ab.ships.filter((s) => !s.sunk);
    if (attacker === this.viewer && afloat.length) {
      const s = afloat[Math.floor(Math.random() * afloat.length)];
      const cells = cellsOf(s);
      const bow = s.dir === 'h' ? cells[cells.length - 1] : cells[0];
      const k = s.dir === 'h' ? 0.75 : 0.25;
      from = { o: attacker, x: (bow % N) + (s.dir === 'h' ? k : 0.5), y: ((bow / N) | 0) + (s.dir === 'h' ? 0.5 : k) };
      this.muzzle(attacker, from.x, from.y);
    } else {
      from = { o: attacker, x: rand(3, 7), y: -0.2 };
      this.muzzle(attacker, from.x, from.y + 0.2);
    }
    this.o.snd.cannon();
    return new Promise((resolve) => {
      this.shells.push({
        from,
        o: def,
        i,
        t: 0,
        dur: 0.62,
        trail: [],
        land: () => {
          this.hiddenShots.delete(def + ':' + i);
          this.fresh.set(def + ':' + i, this.t);
          const bigView = this.bigOwner() === def;
          if (res.res === 'miss') {
            this.splash(def, i);
            this.o.snd.splash();
            this.wait(330).then(resolve);
          } else {
            this.explode(def, i, res.res === 'sunk');
            this.o.snd.boom(res.res === 'sunk');
            this.shake = Math.max(this.shake, (res.res === 'sunk' ? 9 : 5) * (bigView ? 1 : 0.5));
            this.o.haptic(res.res === 'sunk' ? [40, 40, 90] : def === this.viewer ? 70 : 35);
            this.wait(420).then(resolve);
          }
        },
      });
    });
  }

  sink(owner, ship) {
    const key = owner + ':' + ship.id;
    this.hiddenSunk.delete(key);
    this.sinking.set(key, this.t);
    this.sinkFx(owner, ship);
    this.o.snd.groan();
    return this.wait(1500).then(() => {
      this.sinking.delete(key);
    });
  }

  // ---------------------------------------------------------------- loop
  frame(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
  }

  update(dt) {
    this.t += dt;
    if (this.modeK !== this.modeTarget) {
      const d = dt / 0.42;
      this.modeK = this.modeK < this.modeTarget ? Math.min(this.modeTarget, this.modeK + d) : Math.max(this.modeTarget, this.modeK - d);
    }
    this.shake *= Math.pow(0.0015, dt);
    if (this.shake < 0.2) this.shake = 0;
    for (const p of this.parts) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      p.vx = (p.vx || 0) + (p.ax || 0) * dt;
      p.vy = (p.vy || 0) + (p.ay || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.kind === 'drop' || p.kind === 'spark' || p.kind === 'fire') {
        p.vx *= Math.pow(0.3, dt);
      }
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const sh of this.shells) {
      sh.t += dt;
      if (sh.t >= sh.dur && !sh.done) {
        sh.done = true;
        sh.land();
      }
    }
    this.shells = this.shells.filter((s) => !s.done || s.t < s.dur + 0.12);
    // smoke from burning ships
    this.smokeAcc += dt;
    if (this.smokeAcc > 0.16) {
      this.smokeAcc = 0;
      for (let o = 0; o < 2; o++) {
        const b = this.m.boards[o];
        for (let i = 0; i < CELLS; i++) {
          if (b.shots[i] !== 2 || this.hiddenShots.has(o + ':' + i)) continue;
          const s = b.ships[b.map[i]];
          const sunk = s.sunk && !this.hiddenSunk.has(o + ':' + s.id);
          if (Math.random() > (sunk ? 0.08 : 0.5)) continue;
          this.addPart({ o, kind: 'smoke', x: (i % N) + 0.5 + rand(-0.15, 0.15), y: ((i / N) | 0) + 0.4, vx: rand(0.1, 0.3), vy: rand(-0.55, -0.3), s0: 0.25, s1: rand(0.9, 1.3), life: rand(1.2, 1.8), a: sunk ? 0.4 : 0.7 });
        }
      }
    }
    if (this.waiters.length) {
      const due = this.waiters.filter((w) => w.at <= this.t);
      if (due.length) {
        this.waiters = this.waiters.filter((w) => w.at > this.t);
        due.forEach((w) => w.res());
      }
    }
  }

  draw() {
    const g = this.g;
    const { W, H, dpr } = this;
    if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (this.shake) g.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    const big = this.bigOwner();
    this.drawBoard(1 - big, false);
    this.drawBoard(big, true);
    this.drawLabels();
    this.drawStrip();
    this.drawShells();
  }

  drawBoard(owner, isBig) {
    const g = this.g;
    const r = this.rectOf(owner);
    const cs = r.s / N;
    const b = this.m.boards[owner];
    const t = this.t;
    const mine = owner === this.viewer;
    const target = owner === this.enemy && isBig && this.modeK === 0;
    const glow = this.alert && mine && isBig ? 0.55 + 0.4 * Math.sin(t * 6) : target && this.interactive ? 0.55 : 0.25;
    paintFrame(g, r.x, r.y, r.s, r.s, glow);
    if (this.alert && mine && isBig) {
      g.save();
      g.strokeStyle = `rgba(255,74,92,${0.35 + 0.3 * Math.sin(t * 6)})`;
      g.lineWidth = 2;
      rr(g, r.x - 4, r.y - 4, r.s + 8, r.s + 8, 11);
      g.stroke();
      g.restore();
    }
    paintWater(g, r.x, r.y, r.s, r.s, cs, this.theme, t + owner * 13, 6);
    paintGrid(g, r.x, r.y, cs, this.theme, { radar: owner === this.enemy });
    g.save();
    rr(g, r.x, r.y, r.s, r.s, 6);
    g.clip();
    // halo hints (cells known to be empty around sunk ships)
    g.fillStyle = 'rgba(200,225,255,0.35)';
    for (let i = 0; i < CELLS; i++) {
      if (!b.halo[i] || b.shots[i]) continue;
      if (this.hiddenSunk.size) {
        const s = b.ships.find((x) => x.sunk && cellsOf(x).some((c) => Math.abs((c % N) - (i % N)) <= 1 && Math.abs(((c / N) | 0) - ((i / N) | 0)) <= 1));
        if (s && this.hiddenSunk.has(owner + ':' + s.id)) continue;
      }
      g.beginPath();
      g.arc(r.x + (i % N) * cs + cs / 2, r.y + ((i / N) | 0) * cs + cs / 2, Math.max(1.2, cs * 0.06), 0, Math.PI * 2);
      g.fill();
    }
    // ships
    const skin = this.o.skins[owner];
    for (const s of b.ships) {
      const key = owner + ':' + s.id;
      const sunkShown = s.sunk && !this.hiddenSunk.has(key);
      const visible = mine || sunkShown || this.reveal;
      if (!visible) continue;
      const sinkT = this.sinking.get(key);
      if (sinkT !== undefined) {
        const k = Math.min(1, (t - sinkT) / 1.4);
        paintShip(g, s, r.x, r.y, cs, skin, { t, sink: Math.max(0.001, ease(k)) });
      } else if (sunkShown) {
        paintShip(g, s, r.x, r.y, cs, skin, { t, wreck: true, alpha: 0.85 });
      } else {
        paintShip(g, s, r.x, r.y, cs, skin, { t, wake: true, alpha: mine ? 1 : 0.78 });
      }
    }
    // markers
    for (let i = 0; i < CELLS; i++) {
      const v = b.shots[i];
      if (!v || this.hiddenShots.has(owner + ':' + i)) continue;
      const cx = r.x + (i % N) * cs + cs / 2;
      const cy = r.y + ((i / N) | 0) * cs + cs / 2;
      const ft = this.fresh.get(owner + ':' + i);
      const fresh = ft !== undefined ? Math.max(0, 1 - (t - ft) / 0.6) : 0;
      if (v === 1) {
        paintMiss(g, cx, cy, cs, t, i, fresh);
      } else {
        const s = b.ships[b.map[i]];
        const sunk = s.sunk && !this.hiddenSunk.has(owner + ':' + s.id);
        if (sunk) {
          paintFire(g, cx, cy, cs, t, i, 0.3);
        } else {
          if (!mine) paintHitPeg(g, cx, cy, cs);
          paintFire(g, cx, cy, cs, t, i, 1);
        }
      }
    }
    // pulsing rings on cells the opponent just hit (pass-and-play recap)
    if (this.recap && this.recap.owner === owner) {
      const age = t - this.recap.t0;
      if (age < 4) {
        g.strokeStyle = `rgba(255,214,90,${0.9 * (1 - age / 4)})`;
        g.lineWidth = 2;
        for (const i of this.recap.cells) {
          const cx = r.x + (i % N) * cs + cs / 2;
          const cy = r.y + ((i / N) | 0) * cs + cs / 2;
          g.beginPath();
          g.arc(cx, cy, cs * (0.35 + 0.15 * Math.sin(age * 6)), 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
    // radar sweep over the target board
    if (owner === this.enemy && !this.reveal) {
      const sw = sweepSprite(this.theme);
      const ang = t * 1.25;
      const R = r.s * 0.72;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = isBig ? 0.9 : 0.6;
      g.translate(r.x + r.s / 2, r.y + r.s / 2);
      g.rotate(ang);
      g.drawImage(sw, -R, -R, R * 2, R * 2);
      g.restore();
      // blips on burning targets as the beam passes
      const fx = FX();
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < CELLS; i++) {
        if (b.shots[i] !== 2 || this.hiddenShots.has(owner + ':' + i)) continue;
        const cx = r.x + (i % N) * cs + cs / 2;
        const cy = r.y + ((i / N) | 0) * cs + cs / 2;
        let d = (ang - Math.atan2(cy - r.y - r.s / 2, cx - r.x - r.s / 2)) % (Math.PI * 2);
        if (d < 0) d += Math.PI * 2;
        if (d < 1.4) {
          g.globalAlpha = 1 - d / 1.4;
          const s = cs * 1.1;
          g.drawImage(fx.gold, cx - s / 2, cy - s / 2, s, s);
        }
      }
      g.restore();
    }
    this.drawParts(owner, r, cs);
    g.restore();
    // reticle
    const aim = this.aim >= 0 ? this.aim : this.hover;
    if (owner === this.enemy && isBig && aim >= 0 && this.interactive && this.modeK === 0) this.drawReticle(r, cs, aim, b);
  }

  drawParts(owner, r, cs) {
    const g = this.g;
    const fx = FX();
    for (const p of this.parts) {
      if (p.o !== owner || p.delay > 0) continue;
      const k = p.age / p.life;
      const s = lerp(p.s0, p.s1 ?? p.s0, k) * cs;
      const x = r.x + p.x * cs;
      const y = r.y + p.y * cs;
      const a = (p.a ?? 1) * (1 - k);
      g.globalAlpha = Math.max(0, a);
      switch (p.kind) {
        case 'fire':
        case 'flash':
        case 'spark':
          g.globalCompositeOperation = 'lighter';
          g.drawImage(p.kind === 'fire' ? fx.fire : p.kind === 'flash' ? fx.flash : fx.spark, x - s / 2, y - s / 2, s, s);
          g.globalCompositeOperation = 'source-over';
          break;
        case 'smoke':
          g.globalAlpha = Math.max(0, (p.a ?? 1) * Math.min(1, k * 5) * (1 - k));
          g.drawImage(fx.smoke, x - s / 2, y - s / 2, s, s);
          break;
        case 'steam':
          g.drawImage(fx.steam, x - s / 2, y - s / 2, s, s);
          break;
        case 'foam':
          g.drawImage(fx.foam, x - s / 2, y - s / 2, s, s);
          break;
        case 'drop':
          g.drawImage(fx.drop, x - s, y - s, s * 2, s * 2);
          break;
        case 'ring':
          g.strokeStyle = `rgba(${p.col || '230,245,255'},1)`;
          g.lineWidth = Math.max(1, cs * 0.05 * (1 - k));
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.stroke();
          break;
        case 'bubble':
          g.strokeStyle = 'rgba(220,240,255,0.9)';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.stroke();
          break;
        case 'debris':
          g.save();
          g.translate(x, y);
          g.rotate(p.rot);
          g.fillStyle = '#1d1a18';
          g.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
          g.restore();
          break;
      }
    }
    g.globalAlpha = 1;
  }

  drawReticle(r, cs, i, b) {
    const g = this.g;
    const cx = r.x + (i % N) * cs;
    const cy = r.y + ((i / N) | 0) * cs;
    const bad = b.shots[i] || b.halo[i];
    const col = bad ? '255,90,90' : '247,215,116';
    g.save();
    g.fillStyle = `rgba(${col},0.08)`;
    g.fillRect(r.x, cy, r.s, cs);
    g.fillRect(cx, r.y, cs, r.s);
    const p = 1 + 0.08 * Math.sin(this.t * 10);
    const m = cs * 0.5;
    g.translate(cx + m, cy + m);
    g.scale(p, p);
    g.strokeStyle = `rgba(${col},1)`;
    g.lineWidth = 2;
    g.shadowColor = `rgba(${col},0.8)`;
    g.shadowBlur = 8;
    const e = m * 1.05;
    const l = m * 0.45;
    g.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      g.moveTo(sx * e, sy * e + -sy * l);
      g.lineTo(sx * e, sy * e);
      g.lineTo(sx * e + -sx * l, sy * e);
    }
    g.stroke();
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(0, 0, m * 0.42, 0, Math.PI * 2);
    g.moveTo(-m * 0.7, 0);
    g.lineTo(-m * 0.2, 0);
    g.moveTo(m * 0.2, 0);
    g.lineTo(m * 0.7, 0);
    g.moveTo(0, -m * 0.7);
    g.lineTo(0, -m * 0.2);
    g.moveTo(0, m * 0.2);
    g.lineTo(0, m * 0.7);
    g.stroke();
    g.restore();
    // coordinate tag
    const name = cellName(i);
    g.save();
    g.font = '900 12px Nunito, system-ui, sans-serif';
    const tw = g.measureText(name).width + 12;
    let tx = cx + cs / 2 - tw / 2;
    tx = Math.max(r.x, Math.min(r.x + r.s - tw, tx));
    const ty = cy - 22 < r.y - 14 ? cy + cs + 4 : cy - 22;
    const gr = g.createLinearGradient(0, ty, 0, ty + 18);
    gr.addColorStop(0, '#fff0a8');
    gr.addColorStop(1, '#d99a17');
    g.fillStyle = gr;
    rr(g, tx, ty, tw, 18, 9);
    g.fill();
    g.fillStyle = '#1a1102';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, tx + tw / 2, ty + 9.5);
    g.restore();
  }

  drawLabels() {
    const g = this.g;
    const { big } = this.L;
    const cs = big.s / N;
    g.save();
    g.font = `800 ${Math.max(9, Math.min(12, cs * 0.34))}px Nunito, system-ui, sans-serif`;
    g.fillStyle = 'rgba(243,194,74,0.85)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = 0; k < N; k++) {
      g.fillText('ABCDEFGHIJ'[k], big.x + k * cs + cs / 2, big.y - 9);
      g.fillText(String(k + 1), big.x - 10, big.y + k * cs + cs / 2);
    }
    // small board caption
    const small = 1 - this.bigOwner();
    const sl = this.L.smallLabel;
    g.textAlign = 'left';
    g.font = '900 10px Nunito, system-ui, sans-serif';
    g.fillStyle = 'rgba(243,194,74,0.95)';
    const txt = this.o.label(small).toUpperCase();
    g.fillText(txt, sl.x, sl.y);
    if (this.o.onSwap && this.interactive !== null) {
      const w = g.measureText(txt).width;
      g.fillStyle = 'rgba(207,200,182,0.7)';
      g.font = '800 10px Nunito, system-ui, sans-serif';
      g.fillText(' ⇅', sl.x + w + 2, sl.y);
    }
    g.restore();
  }

  // Fleet status of the big board's owner.
  drawStrip() {
    const g = this.g;
    const st = this.L.strip;
    const owner = this.bigOwner();
    const b = this.m.boards[owner];
    const total = b.ships.reduce((a, s) => a + s.len, 0);
    const gap = 6;
    const avail = st.w - gap * (b.ships.length - 1) - 54;
    const cw = Math.max(5, Math.min(15, avail / total));
    const h = cw;
    let x = st.x + (st.w - 54 - (total * cw + gap * (b.ships.length - 1))) / 2;
    const y = st.y + (st.h - h) / 2;
    const mine = owner === this.viewer;
    g.save();
    for (const s of b.ships) {
      const w = s.len * cw;
      const sunk = s.sunk && !this.hiddenSunk.has(owner + ':' + s.id);
      if (sunk) {
        g.globalAlpha = 0.45;
        g.drawImage(shipSprite(s.cls, s.len, this.o.skins[owner], 'wreck'), x, y, w, h);
        g.globalAlpha = 1;
        g.strokeStyle = '#ff4a5c';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 2, y + h / 2);
        g.lineTo(x + w - 2, y + h / 2);
        g.stroke();
      } else if (mine) {
        g.drawImage(shipSprite(s.cls, s.len, this.o.skins[owner], 'body'), x, y, w, h);
        if (s.hits) {
          g.fillStyle = '#ff7a2f';
          for (let k = 0; k < s.hits; k++) {
            g.beginPath();
            g.arc(x + w - (k + 0.5) * cw, y + h + 1, 1.6, 0, Math.PI * 2);
            g.fill();
          }
        }
      } else {
        g.drawImage(shipTint(s.cls, s.len, 'grey', '#f3c24a'), x, y, w, h);
      }
      x += w + gap;
    }
    const left = b.ships.filter((s) => !(s.sunk && !this.hiddenSunk.has(owner + ':' + s.id))).length;
    g.font = '900 13px Nunito, system-ui, sans-serif';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = mine ? '#cfc8b6' : '#f3c24a';
    g.fillText(`${left}/${b.ships.length}`, st.x + st.w, st.y + st.h / 2 + 1);
    g.restore();
  }

  drawShells() {
    const g = this.g;
    const fx = FX();
    for (const sh of this.shells) {
      const fr = this.rectOf(sh.from.o);
      const tr = this.rectOf(sh.o);
      const fcs = fr.s / N;
      const tcs = tr.s / N;
      const x0 = fr.x + sh.from.x * fcs;
      const y0 = fr.y + sh.from.y * fcs;
      const x1 = tr.x + ((sh.i % N) + 0.5) * tcs;
      const y1 = tr.y + (((sh.i / N) | 0) + 0.5) * tcs;
      const k = Math.min(1, sh.t / sh.dur);
      const e = k;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const hgt = Math.min(140, dist * 0.45);
      const x = lerp(x0, x1, e);
      const y = lerp(y0, y1, e) - Math.sin(k * Math.PI) * hgt;
      if (!sh.done) {
        sh.trail.push([x, y]);
        if (sh.trail.length > 14) sh.trail.shift();
      } else if (sh.trail.length) sh.trail.shift();
      g.save();
      g.lineCap = 'round';
      for (let n = 1; n < sh.trail.length; n++) {
        const a = n / sh.trail.length;
        g.strokeStyle = `rgba(255,${180 + 60 * a | 0},${90 + 120 * a | 0},${a * 0.7})`;
        g.lineWidth = 1 + a * 3;
        g.beginPath();
        g.moveTo(sh.trail[n - 1][0], sh.trail[n - 1][1]);
        g.lineTo(sh.trail[n][0], sh.trail[n][1]);
        g.stroke();
      }
      if (!sh.done) {
        // ground shadow of the shell
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath();
        g.ellipse(lerp(x0, x1, e), lerp(y0, y1, e), 3, 2, 0, 0, Math.PI * 2);
        g.fill();
        const s = 10 + Math.sin(k * Math.PI) * 10;
        g.globalCompositeOperation = 'lighter';
        g.drawImage(fx.spark, x - s, y - s, s * 2, s * 2);
        g.fillStyle = '#fffbe8';
        g.beginPath();
        g.arc(x, y, 2.6 + Math.sin(k * Math.PI) * 1.4, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }
}

