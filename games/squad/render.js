// Runner renderer: pseudo-3D road with perspective, depth-sorted sprites,
// themed scenery, lighting, particles, popups and camera effects.

import { Sprites, drawSpr } from './sprites.js';
import { THEMES, ENDLESS_ZONE, RANK_COLORS, ZTYPES, fmt } from './data.js';
import { ROAD, VIEW, gateGood, gateLabel } from './sim.js';

const D0 = 1600;
const CELL = 260;
const TAU = Math.PI * 2;

function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const PAL_KEYS = ['ground', 'ground2', 'walk', 'walk2', 'road', 'road2', 'line', 'curbA', 'curbB', 'fog', 'glow'];
function palOf(theme) {
  const p = { dark: theme.dark };
  for (const k of PAL_KEYS) p[k] = hexRgb(theme[k]);
  return p;
}
const css = (c, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

export class Renderer {
  // opts: { mode, level, themeIndex, rank, t }
  constructor(canvas, opts) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.t = opts.t;
    this.spr = new Sprites();
    this.helmet = RANK_COLORS[(opts.rank || 0) % RANK_COLORS.length];
    this.pal = palOf(THEMES[opts.themeIndex || 0]);
    this.themeIdx = opts.themeIndex || 0;
    this.parts = [];
    this.pool = [];
    this.pops = [];
    this.rings = [];
    this.decals = [];
    this.jets = [];
    this.chain = [];
    this.amb = [];
    this.shake = 0;
    this.camX = 0;
    this.pull = 0;
    this.labelK = 1;
    this.lastN = -1;
    this.time = 0;
    this.items = [];
    this.flashes = [];
    this.P = { x: 0, y: 0, s: 1 };
    this.cw = 1;
    this.ch = 1;
  }

  resize(w, h, dpr) {
    this.cw = w;
    this.ch = h;
    this.dpr = dpr;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    if (this.opts.preview) {
      this.s0 = (w * 0.62) / (ROAD * 2);
      this.sY = h * 1.08;
    } else {
      this.s0 = Math.min((w * 0.8) / (ROAD * 2), h / 560);
      this.sY = h * 0.77;
    }
    const K = 0.72 * this.s0 * D0;
    this.hY = Math.min(this.sY - K, -0.28 * this.sY);
    this.F = this.s0 * D0;
    this.Hc = (this.sY - this.hY) * D0;
    this.cx = w / 2;
    // vignette
    const v = document.createElement('canvas');
    v.width = Math.max(1, Math.round(w / 2));
    v.height = Math.max(1, Math.round(h / 2));
    const g = v.getContext('2d');
    const gr = g.createRadialGradient(v.width / 2, v.height * 0.55, Math.min(v.width, v.height) * 0.35, v.width / 2, v.height * 0.55, Math.max(v.width, v.height) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = gr;
    g.fillRect(0, 0, v.width, v.height);
    this.vign = v;
    this.initAmbient();
  }

  // pixels per world unit for a given world drag distance
  get pxPerUnit() {
    return this.s0;
  }

  proj(x, z, y = 0) {
    let d = z - this.camZ;
    if (d < 40) d = 40;
    const s = this.F / d;
    const P = this.P;
    P.s = s;
    P.x = this.cx + (x - this.camX) * s + this.sx;
    P.y = this.hY + this.Hc / d + this.sy - y * s;
    return P;
  }

  themeAt(z) {
    if (this.opts.mode !== 'endless') return this.themeIdx;
    return Math.floor(Math.max(0, z) / ENDLESS_ZONE) % THEMES.length;
  }

  // ------------------------------------------------------------ particles
  part(o) {
    if (this.parts.length > 520) return null;
    const p = this.pool.pop() || {};
    p.x = o.x;
    p.y = o.y || 0;
    p.z = o.z;
    p.vx = o.vx || 0;
    p.vy = o.vy || 0;
    p.vz = o.vz || 0;
    p.life = p.max = o.life || 0.6;
    p.size = o.size || 3;
    p.grow = o.grow || 0;
    p.col = o.col || '#fff';
    p.add = !!o.add;
    p.g = o.g === undefined ? 600 : o.g;
    p.drag = o.drag || 0;
    p.sh = o.sh || 'c';
    p.rot = o.rot || 0;
    p.vr = o.vr || 0;
    p.img = o.img || null;
    p.fade = o.fade === undefined ? 1 : o.fade;
    this.parts.push(p);
    return p;
  }
  burst(x, z, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (o.speed || 200) * (0.4 + Math.random() * 0.8);
      this.part({
        ...o,
        x,
        z,
        y: y + (Math.random() - 0.5) * (o.spreadY || 4),
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp * 0.7,
        vy: (o.up || 150) * (0.5 + Math.random()),
        col: Array.isArray(o.col) ? o.col[i % o.col.length] : o.col,
        size: (o.size || 3) * (0.6 + Math.random() * 0.8),
        life: (o.life || 0.6) * (0.7 + Math.random() * 0.6),
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 12,
      });
    }
  }
  popup(text, x, z, y, col, size = 30, life = 1) {
    this.pops.push({ text, x, z, y, col, size, t: 0, life });
    if (this.pops.length > 14) this.pops.shift();
  }
  decal(x, z, r, col, a = 0.55) {
    this.decals.push({ x, z, r, col, a, rot: Math.random() * TAU });
    if (this.decals.length > 70) this.decals.shift();
  }
  boom(x, z, r, kind) {
    const toxic = kind === 'bloat';
    const shock = kind === 'shock';
    const big = r > 120;
    if (!shock) {
      this.part({ x, z, y: 18, life: 0.16, size: r * 1.6, grow: r * 3, add: true, g: 0, img: 'white', fade: 1 });
      this.part({ x, z, y: 22, life: 0.55, size: r * 0.9, grow: r * 1.4, add: true, g: 0, img: toxic ? 'green' : 'fire' });
      this.burst(x, z, 14, big ? 22 : 14, { col: toxic ? ['#d8ff5a', '#9be03a', '#f4ffb0'] : ['#ffd36b', '#ff8a1e', '#ff5a1e', '#fff1b0'], speed: r * 2.2, up: 380, life: 0.6, size: 5, add: true, g: 300, drag: 1.5 });
      this.burst(x, z, 16, big ? 14 : 9, { col: toxic ? ['rgba(120,160,60,.55)'] : ['rgba(70,64,60,.6)', 'rgba(110,100,95,.55)'], speed: r * 0.9, up: 120, life: 1.3, size: 14, grow: 40, g: -40, drag: 2, sh: 'c' });
      this.burst(x, z, 10, big ? 16 : 10, { col: ['#2b2420', '#4a3a30', '#5a5048'], speed: r * 2.6, up: 420, life: 1, size: 3.5, sh: 'r', g: 900 });
      this.decal(x, z, r * 0.55, toxic ? [70, 110, 20] : [20, 16, 14], 0.6);
    } else {
      this.burst(x, z, 10, 26, { col: ['#bfe4ff', '#6fb8ff', '#ffffff'], speed: r * 3, up: 160, life: 0.5, size: 3, add: true, g: 200, drag: 2 });
    }
    this.rings.push({ x, z, r0: 10, r1: r * (shock ? 1.2 : 1.1), t: 0, life: shock ? 0.45 : 0.4, col: shock ? '#8fd0ff' : toxic ? '#d8ff5a' : '#ffd9a0' });
    this.shake = Math.min(22, this.shake + (shock ? 6 : r / 10));
  }

  // ------------------------------------------------------------ events
  handle(events, w) {
    const t = this.t;
    for (const e of events) {
      switch (e.t) {
        case 'hit':
          if (e.k === 1 || e.k === 3) this.burst(e.x, e.z - 4, e.y, 2, { col: ['#5f8f2e', '#8a1f1f', '#a7d35a'], speed: 90, up: 120, life: 0.35, size: 2.4 });
          else this.burst(e.x, e.z - 6, e.y, 2, { col: ['#ffe9a0', '#ffd36b'], speed: 160, up: 160, life: 0.25, size: 1.8, add: true });
          break;
        case 'kill': {
          const T = ZTYPES[e.type];
          const n = e.big ? 22 : 9;
          this.burst(e.x, e.z, T.h * 0.5, n, { col: ['#5f8f2e', '#3a5a1c', '#8a1f1f', '#a7d35a'], speed: e.big ? 260 : 170, up: 220, life: 0.7, size: e.big ? 4.5 : 3 });
          this.decal(e.x, e.z, T.r * 1.3, Math.random() < 0.5 ? [70, 20, 18] : [60, 80, 25], 0.5);
          if (e.big) {
            this.shake = Math.min(18, this.shake + 6);
            this.popup('+' + T.coin * (w ? w.killCoin : 1), e.x, e.z, T.h + 10, '#ffd36b', 22, 0.9);
          }
          break;
        }
        case 'bite':
          this.burst(e.x, e.z, 14, 6, { col: ['#5f8f2e', '#8a1f1f'], speed: 120, up: 160, life: 0.5, size: 2.6 });
          break;
        case 'sdie':
          this.burst(e.x, e.z, 12, 5, { col: ['#2d5bd0', '#5b93ff', '#22335a', '#b3261e'], speed: 150, up: 260, life: 0.8, size: 2.6, sh: 'r' });
          this.burst(e.x, e.z, 10, 3, { col: ['#c42b22', '#8a1515'], speed: 80, up: 120, life: 0.6, size: 2.2 });
          this.decal(e.x, e.z, 8, [110, 15, 15], 0.45);
          break;
        case 'lost':
          this.popup('−' + e.n, w.sq.x + (Math.random() - 0.5) * 30, w.sq.z, 46, '#ff5470', 26, 0.8);
          this.shake = Math.min(14, this.shake + 3);
          this.hurtFlash = 0.25;
          break;
        case 'gate': {
          const col = e.good ? ['#7fc0ff', '#3d8bff', '#d6ecff'] : ['#ff8a8a', '#ff3b4f', '#ffd0d0'];
          this.burst(e.x, e.z + 6, 40, 26, { col, speed: 260, up: 260, life: 0.8, size: 4.5, sh: 'r', g: 700 });
          this.popup((e.delta >= 0 ? '+' : '−') + fmt(Math.abs(e.delta)), w.sq.x, w.sq.z, 70, e.good ? '#7cf0b8' : '#ff5470', 40, 1.1);
          this.labelK = 1.6;
          if (!e.good) this.shake = Math.min(14, this.shake + 7);
          break;
        }
        case 'crate': {
          this.burst(e.x, e.z, 18, 16, { col: ['#8a9c4a', '#5b6b2c', '#c9971c'], speed: 220, up: 320, life: 0.9, size: 3.5, sh: 'r' });
          this.burst(e.x, e.z, 22, 18, { col: ['#fff3b0', '#ffd36b'], speed: 200, up: 260, life: 0.8, size: 2.4, add: true, g: 100 });
          const txt = e.kind === 'troops' ? t('crateTroops', { n: e.amount }) : t(e.kind === 'rate' ? 'crateRate' : 'crateDmg', { p: Math.round(e.amount * 100) });
          this.popup(txt, e.x, e.z, 70, '#ffd36b', 22, 1.4);
          break;
        }
        case 'crateMiss':
          this.burst(e.x, e.z, 16, 12, { col: ['#8a9c4a', '#5b6b2c'], speed: 180, up: 260, life: 0.7, size: 3, sh: 'r' });
          break;
        case 'wallBreak':
          this.burst(e.x, e.z, 20, 26, { col: ['#c9c9cf', '#8f8f97', '#d6c08a', '#f2c230'], speed: 280, up: 340, life: 1, size: 4.5, sh: 'r' });
          this.burst(e.x, e.z, 14, 8, { col: ['rgba(200,190,170,.5)'], speed: 100, up: 60, life: 1.2, size: 16, grow: 30, g: -20, drag: 2 });
          this.shake = Math.min(16, this.shake + 7);
          break;
        case 'boom':
          this.boom(e.x, e.z, e.r, e.kind);
          break;
        case 'shieldHit':
          this.burst(e.x, e.z, 18, 6, { col: ['#bfe4ff', '#6fb8ff'], speed: 160, up: 120, life: 0.35, size: 2.4, add: true });
          break;
        case 'stomp':
          this.rings.push({ x: e.x, z: e.z, r0: 20, r1: 150, t: 0, life: 0.45, col: '#ffcf8a' });
          this.burst(e.x, e.z, 6, 14, { col: ['rgba(150,130,110,.6)'], speed: 220, up: 60, life: 0.9, size: 12, grow: 26, g: -10, drag: 2.5 });
          this.shake = Math.min(24, this.shake + 12);
          break;
        case 'summon':
          this.burst(e.x, e.z - 30, 30, 14, { col: ['rgba(160,80,200,.55)', 'rgba(90,40,120,.5)'], speed: 120, up: 80, life: 1, size: 14, grow: 24, g: -30, drag: 2 });
          break;
        case 'bossDie':
          for (let i = 0; i < 7; i++) this.chain.push({ t: i * 0.18, x: e.x + (Math.random() - 0.5) * 90, z: e.z + (Math.random() - 0.5) * 60, r: 80 + Math.random() * 60 });
          this.popup('+' + e.coin, e.x, e.z, 150, '#ffd36b', 34, 1.6);
          break;
        case 'ability':
          if (e.id === 'jet') this.jets.push({ t0: this.time, x: e.x });
          if (e.id === 'tank') this.shieldPop = 0.4;
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------ ambient
  initAmbient() {
    this.amb = [];
    for (let i = 0; i < 46; i++) this.amb.push({ x: Math.random() * this.cw, y: Math.random() * this.ch, s: Math.random(), p: Math.random() * TAU });
  }
  drawAmbient(ctx, dt, kind) {
    const W = this.cw;
    const H = this.ch;
    ctx.save();
    for (const a of this.amb) {
      a.p += dt;
      let vx = 0;
      let vy = 0;
      let col;
      let r = 1 + a.s * 1.8;
      let add = false;
      if (kind === 'snow') {
        vx = Math.sin(a.p * 1.3) * 18;
        vy = 40 + a.s * 50;
        col = 'rgba(255,255,255,.85)';
        r = 1.2 + a.s * 2.4;
      } else if (kind === 'sand') {
        vx = 120 + a.s * 120;
        vy = 18;
        col = 'rgba(255,230,180,.35)';
      } else if (kind === 'embers') {
        vx = Math.sin(a.p) * 14;
        vy = -24 - a.s * 26;
        col = `rgba(255,${140 + (a.s * 80) | 0},60,${0.5 + 0.4 * Math.sin(a.p * 3)})`;
        add = true;
      } else if (kind === 'spores') {
        vx = Math.sin(a.p * 0.7) * 16;
        vy = -10 - a.s * 10;
        col = `rgba(210,255,110,${0.35 + 0.3 * Math.sin(a.p * 2)})`;
        add = true;
        r = 1.5 + a.s * 2;
      } else {
        vx = 8 + Math.sin(a.p * 0.5) * 8;
        vy = 6;
        col = 'rgba(255,240,210,.28)';
      }
      a.x += vx * dt;
      a.y += vy * dt;
      if (a.x > W + 10) a.x = -10;
      if (a.x < -10) a.x = W + 10;
      if (a.y > H + 10) a.y = -10;
      if (a.y < -10) a.y = H + 10;
      ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      ctx.fillStyle = col;
      if (kind === 'sand') ctx.fillRect(a.x, a.y, 8 + a.s * 10, 1.2);
      else {
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ frame
  frame(w, dt) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    this.time += dt;
    const sq = w.sq;
    const time = this.time;

    // theme palette (smoothly blended in survival mode)
    const ti = this.themeAt(sq.z + 600);
    if (ti !== this.themeIdx) {
      this.themeIdx = ti;
      this.palFrom = this.pal;
      this.palTo = palOf(THEMES[ti]);
      this.palK = 0;
    }
    if (this.palTo) {
      this.palK = Math.min(1, this.palK + dt / 1.6);
      const p = { dark: this.palFrom.dark + (this.palTo.dark - this.palFrom.dark) * this.palK };
      for (const k of PAL_KEYS) p[k] = this.palFrom[k].map((v, i) => v + (this.palTo[k][i] - v) * this.palK);
      this.pal = p;
      if (this.palK >= 1) this.palTo = null;
    }
    const pal = this.pal;
    const theme = THEMES[this.themeIdx];

    // camera
    const wantPull = w.state === 'boss' || (w.boss && w.boss.alive && w.boss.z - sq.z < 900) ? 280 : 0;
    this.pull += (wantPull - this.pull) * Math.min(1, dt * 1.6);
    this.camZ = sq.z - D0 - this.pull;
    this.camX += (sq.x * 0.28 - this.camX) * Math.min(1, dt * 3);
    this.shake *= Math.exp(-dt * 7);
    this.sx = (Math.random() - 0.5) * this.shake;
    this.sy = (Math.random() - 0.5) * this.shake;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.cw;
    const H = this.ch;
    const zNear = this.camZ + this.Hc / (H + 30 - this.hY);
    const zFar = this.camZ + this.Hc / (-this.hY);

    // ---- ground
    ctx.fillStyle = css(pal.ground);
    ctx.fillRect(0, 0, W, H);
    const BAND = 180;
    ctx.fillStyle = css(pal.ground2);
    for (let z = Math.floor(zNear / BAND) * BAND; z < zFar; z += BAND) {
      if (Math.floor(z / BAND) % 2) continue;
      const y0 = this.proj(0, z + BAND).y;
      const y1 = this.proj(0, z).y;
      ctx.fillRect(0, y0, W, y1 - y0 + 1);
    }
    // sidewalks
    const quad = (x0, x1, z0, z1, fill) => {
      const a = this.proj(x0, z0);
      const ax = a.x;
      const ay = a.y;
      const b = this.proj(x1, z0);
      const bx = b.x;
      const c = this.proj(x1, z1);
      const cx = c.x;
      const cy = c.y;
      const d = this.proj(x0, z1);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, ay);
      ctx.lineTo(cx, cy);
      ctx.lineTo(d.x, cy);
      ctx.closePath();
      ctx.fill();
    };
    for (const sgn of [-1, 1]) quad(sgn * ROAD, sgn * (ROAD + 46), zNear, zFar, css(pal.walk));
    const SEAM = 70;
    ctx.strokeStyle = css(pal.walk2);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let z = Math.floor(zNear / SEAM) * SEAM; z < zFar; z += SEAM) {
      for (const sgn of [-1, 1]) {
        const a = this.proj(sgn * ROAD, z);
        const ax = a.x;
        const ay = a.y;
        const b = this.proj(sgn * (ROAD + 46), z);
        ctx.moveTo(ax, ay);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
    // road
    {
      const a = this.proj(-ROAD, zNear);
      const ax = a.x;
      const ay = a.y;
      const b = this.proj(ROAD, zNear);
      const bx = b.x;
      const c = this.proj(ROAD, zFar);
      const cx = c.x;
      const cy = c.y;
      const d = this.proj(-ROAD, zFar);
      const gr = ctx.createLinearGradient(0, cy, 0, ay);
      gr.addColorStop(0, css(pal.road));
      gr.addColorStop(1, css(pal.road2));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, ay);
      ctx.lineTo(cx, cy);
      ctx.lineTo(d.x, cy);
      ctx.closePath();
      ctx.fill();
    }
    // curbs
    const CURB = 52;
    for (let z = Math.floor(zNear / CURB) * CURB; z < zFar; z += CURB) {
      const col = Math.floor(z / CURB) % 2 ? css(pal.curbA) : css(pal.curbB);
      quad(-ROAD - 9, -ROAD + 1, z, z + CURB, col);
      quad(ROAD - 1, ROAD + 9, z, z + CURB, col);
    }
    // asphalt patches & cracks
    const PC = 300;
    for (let c = Math.floor(zNear / PC); c * PC < zFar; c++) {
      const h1 = hash(c * 7 + 3);
      const h2 = hash(c * 13 + 5);
      const P = this.proj((h1 - 0.5) * 220, c * PC + h2 * PC);
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath();
      ctx.ellipse(P.x, P.y, 26 * P.s * (0.6 + h2), 9 * P.s * (0.6 + h1), 0, 0, TAU);
      ctx.fill();
      if (h1 > 0.5) {
        const Q = this.proj((h2 - 0.5) * 240, c * PC + h1 * 120);
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.lineWidth = Math.max(1, 1.5 * Q.s);
        ctx.beginPath();
        ctx.moveTo(Q.x, Q.y);
        ctx.lineTo(Q.x + 14 * Q.s, Q.y - 3 * Q.s);
        ctx.lineTo(Q.x + 22 * Q.s, Q.y + 1 * Q.s);
        ctx.lineTo(Q.x + 34 * Q.s, Q.y - 2 * Q.s);
        ctx.stroke();
      }
    }
    // lane markings
    ctx.fillStyle = css(pal.line, 0.85);
    const DASH = 170;
    for (let z = Math.floor(zNear / DASH) * DASH; z < zFar; z += DASH) quad(-3.5, 3.5, z, z + 80, css(pal.line, 0.85));
    quad(-ROAD + 12, -ROAD + 16, zNear, zFar, css(pal.line, 0.55));
    quad(ROAD - 16, ROAD - 12, zNear, zFar, css(pal.line, 0.55));
    // finish / boss line
    if (Number.isFinite(w.bossStop) && w.bossStop < zFar && w.bossStop > zNear) {
      for (let i = 0; i < 12; i++) quad(-ROAD + i * 25, -ROAD + (i + 1) * 25, w.bossStop + 30, w.bossStop + 54, i % 2 ? 'rgba(20,20,20,.85)' : 'rgba(255,210,80,.9)');
    }
    // themed ground details
    if (theme.id === 'toxic' || theme.id === 'snow' || theme.id === 'desert') {
      const GC = 340;
      for (let c = Math.floor(zNear / GC); c * GC < zFar; c++) {
        const h = hash(c * 31 + 11);
        const side = h < 0.5 ? -1 : 1;
        const P = this.proj(side * (ROAD + 90 + h * 120), c * GC + 80);
        if (theme.id === 'toxic') {
          ctx.fillStyle = 'rgba(150,230,40,.5)';
          ctx.beginPath();
          ctx.ellipse(P.x, P.y, 44 * P.s, 13 * P.s, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(220,255,140,.45)';
          ctx.beginPath();
          ctx.ellipse(P.x - 8 * P.s, P.y - 2 * P.s, 18 * P.s, 4 * P.s, 0, 0, TAU);
          ctx.fill();
        } else {
          const Q = this.proj(side * (ROAD - 6), c * GC + 140);
          ctx.fillStyle = theme.id === 'snow' ? 'rgba(255,255,255,.75)' : 'rgba(225,195,140,.55)';
          ctx.beginPath();
          ctx.ellipse(Q.x, Q.y, 36 * Q.s, 7 * Q.s, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    // decals (blood, scorch)
    for (const dc of this.decals) {
      if (dc.z < zNear - 50 || dc.z > zFar) continue;
      const P = this.proj(dc.x, dc.z);
      ctx.fillStyle = css(dc.col, dc.a);
      ctx.beginPath();
      ctx.ellipse(P.x, P.y, dc.r * P.s, dc.r * 0.42 * P.s, dc.rot * 0.1, 0, TAU);
      ctx.fill();
    }

    // ---- props (far to near)
    this.drawProps(ctx, zNear, zFar);

    // ---- shadows
    const shadow = (x, z, r) => {
      const P = this.proj(x, z);
      const ww = r * 2.6 * P.s;
      ctx.drawImage(this.spr.shadow, P.x - ww / 2, P.y - ww * 0.19, ww, ww * 0.38);
    };
    for (const e of w.zombies) if (e.alive && e.z < zFar && e.z > zNear) shadow(e.x, e.z, e.r);
    for (const s of w.sol) shadow(sq.x + s.ox, sq.z + s.oz, 7);
    if (w.boss) shadow(w.boss.x, w.boss.z, w.boss.r * 1.1);

    // boss danger ring
    if (w.boss && w.boss.alive) {
      const b = w.boss;
      const P = this.proj(b.x, b.z);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,60,50,${0.35 + 0.25 * Math.sin(time * 6)})`;
      ctx.lineWidth = 3 * P.s;
      ctx.beginPath();
      ctx.ellipse(P.x, P.y, b.r * 1.6 * P.s, b.r * 0.55 * P.s, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // ---- entities, depth sorted
    const items = this.items;
    items.length = 0;
    for (const e of w.zombies) if (e.alive && e.z < zFar + 40 && e.z > zNear - 40) items.push({ z: e.z, k: 1, o: e });
    for (const o of w.objs) if (o.alive && o.z < zFar && o.z > zNear) items.push({ z: o.z, k: 2, o });
    for (const g of w.gates) if (g.z < zFar && g.z > zNear && (!g.done || w.t - g.t < 0.3)) items.push({ z: g.z, k: 3, o: g });
    if (w.boss) items.push({ z: w.boss.z, k: 4, o: w.boss });
    for (let i = 0; i < w.sol.length; i++) items.push({ z: sq.z + w.sol[i].oz, k: 5, o: w.sol[i], i });
    items.sort((a, b) => b.z - a.z);
    this.flashes.length = 0;
    const running = w.live;
    for (const it of items) {
      if (it.k === 1) this.drawZombie(ctx, it.o, running || w.state === 'lost');
      else if (it.k === 2) this.drawObj(ctx, it.o);
      else if (it.k === 3) this.drawGate(ctx, it.o, w);
      else if (it.k === 4) this.drawBoss(ctx, it.o);
      else this.drawSoldier(ctx, it.o, it.i, w);
    }

    // missiles in flight
    for (const m of w.missiles) {
      const P = this.proj(m.x, m.z, m.y);
      const px = P.x;
      const py = P.y;
      const s = P.s;
      const Q = this.proj(m.px === undefined ? m.x : m.px, m.pz === undefined ? m.z - 10 : m.pz, m.py === undefined ? m.y - 10 : m.py);
      const ang = Math.atan2(py - Q.y, px - Q.x) + Math.PI / 2;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      const sp = this.spr.missile();
      ctx.drawImage(sp.c, -sp.ax * s * 1.8, -sp.ay * s * 1.8 + 18 * s, sp.w * s * 1.8, sp.h * s * 1.8);
      ctx.restore();
      this.part({ x: m.x, z: m.z - 6, y: m.y, life: 0.7, size: 7, grow: 18, col: 'rgba(200,200,200,.5)', g: -20, drag: 1 });
      this.part({ x: m.x, z: m.z - 6, y: m.y, life: 0.18, size: 9, col: '#ffb347', add: true, g: 0 });
    }

    // ---- particles
    this.updateParts(ctx, dt, false);

    // ---- night darkness
    if (pal.dark > 0.01) {
      const P = this.proj(sq.x, sq.z + 260);
      const g = ctx.createRadialGradient(P.x, P.y, 40, P.x, P.y, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(4,6,18,0)');
      g.addColorStop(0.35, `rgba(4,6,18,${pal.dark * 0.35})`);
      g.addColorStop(1, `rgba(4,6,18,${pal.dark})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // ---- additive light pass
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // bullets
    if (w.bullets.length) {
      ctx.strokeStyle = 'rgba(255,214,120,.9)';
      ctx.lineCap = 'round';
      ctx.beginPath();
      let lw = 2;
      for (const b of w.bullets) {
        const A = this.proj(b.x, b.z, 15);
        const ax = A.x;
        const ay = A.y;
        lw = Math.max(1.2, 2.4 * A.s);
        const B = this.proj(b.x - b.vx * 0.02, b.z - 60, 15);
        ctx.moveTo(ax, ay);
        ctx.lineTo(B.x, B.y);
      }
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    // muzzle flashes
    const mg = this.spr.glow.muzzle;
    for (const f of this.flashes) {
      const r = 16 * f.s;
      ctx.drawImage(mg, f.x - r, f.y - r, r * 2, r * 2);
    }
    // lamp glows at night
    if (pal.dark > 0.3 && this.lampGlows) {
      const lg = this.spr.glow.lamp;
      for (const L of this.lampGlows) ctx.drawImage(lg, L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    // explosion rings
    for (const r of this.rings) {
      r.t += dt;
      const u = r.t / r.life;
      if (u >= 1) continue;
      const P = this.proj(r.x, r.z);
      const rad = (r.r0 + (r.r1 - r.r0) * (1 - (1 - u) * (1 - u))) * P.s;
      ctx.strokeStyle = r.col;
      ctx.globalAlpha = 1 - u;
      ctx.lineWidth = 5 * P.s * (1 - u) + 1;
      ctx.beginPath();
      ctx.ellipse(P.x, P.y, rad, rad * 0.4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.rings = this.rings.filter((r) => r.t < r.life);
    this.updateParts(ctx, dt, true);
    ctx.restore();

    // shield dome
    if (w.shieldT > 0) this.drawShield(ctx, w);

    // jets (airstrike flyover)
    for (const j of this.jets) {
      const u = (this.time - j.t0) / 1.4;
      if (u > 1) continue;
      const z = sq.z - 250 + u * 2700;
      const S = this.proj(j.x, z);
      const ss = S.s;
      ctx.globalAlpha = 0.35;
      ctx.drawImage(this.spr.shadow, S.x - 40 * ss, S.y - 12 * ss, 80 * ss, 24 * ss);
      ctx.globalAlpha = 1;
      const P = this.proj(j.x, z, 230);
      const sp = this.spr.jet();
      drawSpr(ctx, sp, P.x, P.y, P.s * 1.6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = this.spr.glow.fire;
      ctx.drawImage(g, P.x - 14 * P.s, P.y - 6 * P.s, 28 * P.s, 28 * P.s);
      ctx.restore();
    }
    this.jets = this.jets.filter((j) => this.time - j.t0 < 1.4);

    // chained boss explosions
    if (this.chain.length) {
      for (const c of this.chain) {
        c.t -= dt;
        if (c.t <= 0) this.boom(c.x, c.z, c.r, 'boss');
      }
      this.chain = this.chain.filter((c) => c.t > 0);
    }

    // ---- fog & atmosphere
    {
      const yEnd = this.proj(0, sq.z + VIEW * 0.72).y;
      const g = ctx.createLinearGradient(0, 0, 0, Math.max(40, yEnd));
      g.addColorStop(0, css(pal.fog, 0.96));
      g.addColorStop(0.55, css(pal.fog, 0.45));
      g.addColorStop(1, css(pal.fog, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, Math.max(40, yEnd));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(W / 2, -H * 0.05, 10, W / 2, -H * 0.05, H * 0.55);
      gl.addColorStop(0, css(pal.glow, 0.32));
      gl.addColorStop(1, css(pal.glow, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, W, H * 0.6);
      ctx.restore();
    }
    this.drawAmbient(ctx, dt, theme.ambient);
    ctx.drawImage(this.vign, 0, 0, W, H);
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt;
      ctx.fillStyle = `rgba(255,40,60,${Math.max(0, this.hurtFlash) * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }

    // ---- overlays: HP bars, squad label, popups
    this.drawBars(ctx, w, zNear, zFar);
    this.drawLabel(ctx, w, dt);
    this.drawPops(ctx, dt);
  }

  drawProps(ctx, zNear, zFar) {
    const W = this.cw;
    const night = this.pal.dark > 0.3;
    this.lampGlows = [];
    const c0 = Math.floor(zNear / CELL) - 1;
    const c1 = Math.ceil(zFar / CELL);
    for (let c = c1; c >= c0; c--) {
      const z = c * CELL;
      const ti = this.themeAt(z);
      const th = THEMES[ti];
      for (const side of [-1, 1]) {
        for (let row = 1; row >= 0; row--) {
          const h = hash(c * 4 + (side > 0 ? 1 : 0) + row * 2 + 97);
          if (row === 1 && (h > 0.55 || (th.id !== 'city' && th.id !== 'night'))) continue;
          if (row === 0 && h > 0.88) continue;
          const h2 = hash(c * 9 + side * 5 + row * 3 + 7);
          let kind = row === 1 ? 'building' : th.props[Math.floor(h2 * th.props.length)];
          let x;
          if (kind === 'lamp') x = side * (ROAD + 30);
          else if (kind === 'cone') x = side * (ROAD + 18);
          else if (kind === 'building') x = side * (ROAD + (row ? 330 : 175) + h * 40);
          else x = side * (ROAD + 70 + h2 * 150);
          if (kind === 'building' && night) kind = 'building_n';
          const zz = z + h * CELL * 0.6;
          if (zz < zNear - 60 || zz > zFar) continue;
          const sp = this.spr.prop(kind, th.id, Math.floor(h2 * 3));
          if (!sp) continue;
          const P = this.proj(x, zz);
          const wpx = sp.w * P.s;
          if (P.x + wpx < -10 || P.x - wpx > W + 10) continue;
          const flip = side < 0 && (kind === 'lamp' || kind === 'car' || kind === 'wreck');
          if (flip) {
            ctx.save();
            ctx.translate(P.x, 0);
            ctx.scale(-1, 1);
            drawSpr(ctx, sp, 0, P.y, P.s);
            ctx.restore();
          } else drawSpr(ctx, sp, P.x, P.y, P.s);
          if (kind === 'lamp' && night) {
            const L = this.proj(x - side * 11, zz, 92);
            this.lampGlows.push({ x: L.x, y: L.y, r: 70 * L.s });
          }
        }
      }
    }
  }

  drawSoldier(ctx, s, i, w) {
    const sq = w.sq;
    const x = sq.x + s.ox;
    const z = sq.z + s.oz;
    const P = this.proj(x, z);
    let k = 1;
    const age = w.t - s.born;
    if (age < 0.25) {
      const u = age / 0.25;
      k = 1 + 0.3 * Math.sin(u * Math.PI) - (1 - u) * 0.6;
    }
    const moving = w.state === 'run';
    const frame = moving ? Math.floor(w.t * 9 + i * 0.37) % 2 : 0;
    let y = P.y;
    if (moving) y -= Math.abs(Math.sin(w.t * 14 + i)) * 1.4 * P.s;
    if (w.state === 'won') y -= Math.abs(Math.sin(w.t * 9 + i * 0.7)) * 9 * P.s;
    const sp = this.spr.soldier(frame, this.helmet);
    drawSpr(ctx, sp, P.x, y, P.s * k);
    if (s.fl > 0) this.flashes.push({ x: P.x + 6.4 * P.s * k, y: y - 29 * P.s * k, s: P.s });
  }

  drawZombie(ctx, e, anim) {
    const P = this.proj(e.x, e.z);
    const T = ZTYPES[e.type];
    let frame = 0;
    let bob = 0;
    if (e.active && anim) {
      const f = e.ph * (e.spd / 14);
      frame = Math.floor(f) % 2;
      bob = Math.abs(Math.sin(f * Math.PI)) * 1.5;
    } else {
      bob = Math.sin(e.ph * 2) * 0.6;
    }
    const sp = this.spr.zombie(e.type, frame, e.v, e.flash > 0);
    drawSpr(ctx, sp, P.x, P.y - bob * P.s, P.s);
    if (T.bar && e.hp < e.max) e._bar = true;
  }

  drawObj(ctx, o) {
    const P = this.proj(o.x, o.z);
    const sp = this.spr.obj(o.kind, o.reward, o.flash > 0);
    drawSpr(ctx, sp, P.x, P.y, P.s);
    if (o.kind === 'wall' && o.hp < o.max) {
      const dmg = 1 - o.hp / o.max;
      ctx.strokeStyle = 'rgba(30,30,30,.7)';
      ctx.lineWidth = Math.max(1, 1.6 * P.s);
      ctx.beginPath();
      for (let k = 0; k < Math.ceil(dmg * 5); k++) {
        const bx = P.x + (-50 + k * 24) * P.s;
        ctx.moveTo(bx, P.y - 30 * P.s);
        ctx.lineTo(bx + 6 * P.s, P.y - 20 * P.s);
        ctx.lineTo(bx - 2 * P.s, P.y - 10 * P.s);
      }
      ctx.stroke();
    }
    if (o.kind === 'crate') {
      // beacon glow so players notice it
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = this.spr.glow.muzzle;
      const r = (34 + 6 * Math.sin(this.time * 5)) * P.s;
      ctx.globalAlpha = 0.35;
      ctx.drawImage(g, P.x - r, P.y - 18 * P.s - r, r * 2, r * 2);
      ctx.restore();
    }
  }

  drawBoss(ctx, b) {
    const P = this.proj(b.x, b.z);
    const sc = b.spec.scale || 1;
    let y = P.y;
    let sx = 1;
    let sy = 1;
    if (!b.alive) {
      const u = Math.min(1, (this.time - (b._dieT || (b._dieT = this.time))) / 1.2);
      ctx.globalAlpha = 1 - u;
      sy = 1 - u * 0.6;
      sx = 1 + u * 0.2;
    }
    let frame = 0;
    if (b.walking || !b.active) frame = Math.floor(b.ph * (b.walking ? 3 : 1.5)) % 2;
    if (b.atk > 0) {
      const u = 1 - b.atk / 0.35;
      y -= Math.sin(u * Math.PI) * 18 * P.s;
    } else y -= Math.abs(Math.sin(b.ph * 3)) * 2 * P.s;
    const sp = this.spr.boss(b.spec.id, frame, b.flash > 0);
    ctx.drawImage(sp.c, P.x - sp.ax * P.s * sc * sx, y - sp.ay * P.s * sc * sy, sp.w * P.s * sc * sx, sp.h * P.s * sc * sy);
    ctx.globalAlpha = 1;
  }

  drawGate(ctx, g, w) {
    const fadeU = g.done ? Math.min(1, (w.t - g.t) / 0.3) : 0;
    const alpha = 1 - fadeU;
    if (alpha <= 0) return;
    const H = 74;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 2; i++) {
      const h = g.h[i];
      if (!h) continue;
      const good = gateGood(h);
      const A = this.proj(h.x0 + 7, g.z, H);
      const ax = A.x;
      const ay = A.y;
      const s = A.s;
      const B = this.proj(h.x1 - 7, g.z, 6);
      const bx = B.x;
      const by = B.y;
      const pw = bx - ax;
      const ph = by - ay;
      const gr = ctx.createLinearGradient(0, ay, 0, by);
      if (good) {
        gr.addColorStop(0, 'rgba(110,180,255,.78)');
        gr.addColorStop(1, 'rgba(40,110,240,.5)');
      } else {
        gr.addColorStop(0, 'rgba(255,110,120,.78)');
        gr.addColorStop(1, 'rgba(220,30,60,.5)');
      }
      ctx.fillStyle = gr;
      ctx.fillRect(ax, ay, pw, ph);
      ctx.fillStyle = good ? 'rgba(200,230,255,.55)' : 'rgba(255,210,215,.55)';
      ctx.fillRect(ax, ay, pw, Math.max(2, 5 * s));
      ctx.strokeStyle = good ? 'rgba(190,225,255,.95)' : 'rgba(255,200,205,.95)';
      ctx.lineWidth = Math.max(1.5, 3 * s);
      ctx.strokeRect(ax, ay, pw, ph);
      if (g.done && g.pick === i) {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
        ctx.fillRect(ax, ay, pw, ph);
      }
      // label
      const pulse = h.pulse > 0 ? 1 + h.pulse * 2 : 1;
      const fs = Math.max(10, 34 * s * pulse);
      ctx.font = `1000 ${fs}px Nunito, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = ax + pw / 2;
      const cy = ay + ph * (h.shoot ? 0.62 : 0.52);
      ctx.lineWidth = Math.max(2, 5 * s);
      ctx.strokeStyle = 'rgba(8,12,30,.75)';
      const label = gateLabel(h);
      ctx.strokeText(label, cx, cy);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, cx, cy);
      if (h.shoot) {
        // crosshair + "+1" badge: shoot this gate to raise it
        const r = 9 * s;
        const qy = ay + ph * 0.24;
        ctx.strokeStyle = '#ffd36b';
        ctx.lineWidth = Math.max(1.2, 2.2 * s);
        ctx.beginPath();
        ctx.arc(cx - 12 * s, qy, r, 0, TAU);
        ctx.moveTo(cx - 12 * s - r * 1.4, qy);
        ctx.lineTo(cx - 12 * s + r * 1.4, qy);
        ctx.moveTo(cx - 12 * s, qy - r * 1.4);
        ctx.lineTo(cx - 12 * s, qy + r * 1.4);
        ctx.stroke();
        ctx.font = `1000 ${Math.max(8, 15 * s)}px Nunito, system-ui, sans-serif`;
        ctx.fillStyle = '#ffd36b';
        ctx.fillText('+1', cx + 12 * s, qy);
      }
    }
    // posts
    for (const x of [-ROAD, 0, ROAD]) {
      if ((x < 0 && !g.h[0]) || (x > 0 && !g.h[1]) || (x === 0 && !g.h[0] && !g.h[1])) continue;
      const A = this.proj(x - 4, g.z, H + 10);
      const ax = A.x;
      const ay = A.y;
      const s = A.s;
      const B = this.proj(x + 4, g.z, 0);
      const gr = ctx.createLinearGradient(ax, 0, B.x, 0);
      gr.addColorStop(0, '#5a5f6b');
      gr.addColorStop(0.5, '#c9cdd6');
      gr.addColorStop(1, '#3a3e48');
      ctx.fillStyle = gr;
      ctx.fillRect(ax, ay, B.x - ax, B.y - ay);
      ctx.fillStyle = '#f7d774';
      ctx.fillRect(ax - 1.5 * s, ay - 3 * s, B.x - ax + 3 * s, 4 * s);
    }
    ctx.globalAlpha = 1;
  }

  drawShield(ctx, w) {
    const sq = w.sq;
    const P = this.proj(sq.x, sq.z);
    const rx = (w.R + 22) * P.s;
    const blink = w.shieldT < 1 ? 0.5 + 0.5 * Math.sin(this.time * 30) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.globalCompositeOperation = 'lighter';
    const cy = P.y - 18 * P.s;
    const g = ctx.createRadialGradient(P.x, cy, rx * 0.2, P.x, cy, rx);
    g.addColorStop(0, 'rgba(80,160,255,.05)');
    g.addColorStop(0.8, 'rgba(90,170,255,.18)');
    g.addColorStop(1, 'rgba(150,210,255,.45)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(P.x, cy, rx, rx * 0.78, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,220,255,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(170,220,255,.35)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(P.x, cy, rx * (0.35 + k * 0.22), rx * 0.78, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBars(ctx, w, zNear, zFar) {
    const bar = (x, y, wpx, hpx, f, col) => {
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(x - wpx / 2 - 1, y - 1, wpx + 2, hpx + 2);
      ctx.fillStyle = col;
      ctx.fillRect(x - wpx / 2, y, wpx * Math.max(0, f), hpx);
    };
    for (const e of w.zombies) {
      if (!e.alive || !ZTYPES[e.type].bar || e.z > zFar || e.z < zNear) continue;
      const P = this.proj(e.x, e.z, e.h + 6);
      bar(P.x, P.y, 34 * P.s, Math.max(3, 4 * P.s), e.hp / e.max, '#ff4d5e');
    }
    for (const o of w.objs) {
      if (!o.alive || o.kind === 'barrel' || o.z > zFar || o.z < zNear) continue;
      const P = this.proj(o.x, o.z, o.kind === 'wall' ? 50 : 42);
      bar(P.x, P.y, (o.kind === 'wall' ? 80 : 38) * P.s, Math.max(3, 4.5 * P.s), o.hp / o.max, o.kind === 'crate' ? '#ffd36b' : '#ff9f43');
    }
  }

  drawLabel(ctx, w, dt) {
    const sq = w.sq;
    if (sq.n !== this.lastN) {
      if (this.lastN >= 0) this.labelK = Math.max(this.labelK, 1.35);
      this.lastN = sq.n;
    }
    this.labelK += (1 - this.labelK) * Math.min(1, dt * 8);
    if (sq.n <= 0) return;
    const P = this.proj(sq.x, sq.z + w.R * 0.8, 34);
    const s = Math.max(0.8, P.s) * this.labelK;
    const txt = fmt(sq.n);
    ctx.font = `1000 ${17 * s}px Nunito, system-ui, sans-serif`;
    const tw = ctx.measureText(txt).width;
    const wpx = tw + 30 * s;
    const hpx = 25 * s;
    const x = P.x - wpx / 2;
    const y = P.y - hpx;
    ctx.fillStyle = 'rgba(12,12,16,.88)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, wpx, hpx, hpx / 2) : ctx.rect(x, y, wpx, hpx);
    ctx.fill();
    const gr = ctx.createLinearGradient(x, y, x, y + hpx);
    gr.addColorStop(0, '#f7d774');
    gr.addColorStop(1, '#c9971c');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();
    // helmet icon
    ctx.fillStyle = this.helmet;
    ctx.beginPath();
    ctx.arc(x + 12 * s, y + hpx / 2 + 1.5 * s, 5.5 * s, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x + 5.5 * s, y + hpx / 2 + 1 * s, 13 * s, 2 * s);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, x + 21 * s, y + hpx / 2 + 1 * s);
  }

  drawPops(ctx, dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      p.t += dt;
      const u = p.t / p.life;
      if (u >= 1) continue;
      const P = this.proj(p.x, p.z, p.y);
      const k = u < 0.15 ? 0.5 + (u / 0.15) * 0.7 : 1.2 - Math.min(0.2, (u - 0.15) * 0.6);
      const fs = p.size * k;
      ctx.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      ctx.font = `1000 ${fs}px Nunito, system-ui, sans-serif`;
      const y = P.y - u * 50;
      ctx.lineWidth = Math.max(3, fs * 0.16);
      ctx.strokeStyle = 'rgba(10,8,4,.85)';
      ctx.strokeText(p.text, P.x, y);
      ctx.fillStyle = p.col;
      ctx.fillText(p.text, P.x, y);
    }
    ctx.globalAlpha = 1;
    this.pops = this.pops.filter((p) => p.t < p.life);
  }

  updateParts(ctx, dt, additive) {
    const list = this.parts;
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.add !== additive) {
        list[j++] = p;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        continue;
      }
      if (p.drag) {
        const f = Math.exp(-p.drag * dt);
        p.vx *= f;
        p.vz *= f;
        if (p.g <= 0) p.vy *= f;
      }
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0) {
        p.y = 0;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
      list[j++] = p;
      const P = this.proj(p.x, p.z, p.y);
      const u = p.life / p.max;
      const a = p.fade ? Math.min(1, u * 1.6) : 1;
      const sz = Math.max(0.5, p.size * P.s);
      if (p.img) {
        ctx.globalAlpha = a;
        const g = this.spr.glow[p.img];
        ctx.drawImage(g, P.x - sz, P.y - sz, sz * 2, sz * 2);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      if (p.sh === 'r') {
        ctx.save();
        ctx.translate(P.x, P.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-sz, -sz * 0.6, sz * 2, sz * 1.2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(P.x, P.y, sz, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    list.length = j;
  }
}
