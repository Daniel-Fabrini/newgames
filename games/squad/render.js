// Canvas 2D renderer for the canyon battle: a real pinhole camera looking down
// the road, textured road drawn in perspective strips, rock pillars as
// billboards, and every unit/prop drawn from pre-rendered Blender atlases,
// depth-sorted (far → near) with soft shadows, tracers and particles.

import { THEMES, STATUES, fmt } from './data.js';
import { ROAD, VIEW } from './sim.js';
import { LANE_X } from './gen.js';
import { themed } from './assets.js';

const PITCH = (47 * Math.PI) / 180;
const CAM_H = 13; // camera height (m)
const CAM_BACK = 9.6; // camera distance behind the squad (m)
const CT = Math.cos(PITCH);
const ST = Math.sin(PITCH);
const TEX_M = 7; // road texture tile size in metres
const PILLAR_STEP = 3.1;
const TAU = Math.PI * 2;

function hash(i) {
  let x = (i * 374761393) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function glowCanvas(r, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

export class Renderer {
  // o: { assets, themeIndex, t, preview }
  constructor(cv, o) {
    this.cv = cv;
    this.g = cv.getContext('2d');
    this.A = o.assets;
    this.t = o.t;
    this.th = THEMES[o.themeIndex || 0];
    this.tx = themed(this.A, this.th);
    this.preview = !!o.preview;
    this.W = 360;
    this.H = 640;
    this.k = 1;
    this.time = 0;
    this.camZ = 0;
    this.camX = 0;
    this.shake = 0;
    this.parts = [];
    this.texts = [];
    this.corpses = [];
    this.pedestals = []; // emptied pedestals that stay on the road
    this.wakes = []; // statues coming alive
    this.flyGuns = [];
    this.dl = []; // draw list
    this.crateCache = new Map();
    this.dmgAcc = new WeakMap();
    this.numCache = new Map();
    this.flash = glowCanvas(32, [[0, 'rgba(255,255,235,1)'], [0.25, 'rgba(255,220,120,.9)'], [0.6, 'rgba(255,150,40,.35)'], [1, 'rgba(255,120,0,0)']]);
    this.fire = glowCanvas(64, [[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,190,70,.95)'], [0.65, 'rgba(240,90,20,.5)'], [1, 'rgba(120,30,0,0)']]);
    this.smoke = glowCanvas(64, [[0, 'rgba(90,80,75,.55)'], [0.6, 'rgba(110,100,95,.25)'], [1, 'rgba(120,110,100,0)']]);
    this.dust = glowCanvas(32, [[0, 'rgba(235,215,185,.7)'], [1, 'rgba(235,215,185,0)']]);
    this.goldGlow = glowCanvas(64, [[0, 'rgba(255,240,170,.95)'], [0.4, 'rgba(255,200,60,.5)'], [1, 'rgba(255,170,0,0)']]);
    this.blueGlow = glowCanvas(64, [[0, 'rgba(170,220,255,.9)'], [0.45, 'rgba(70,150,255,.45)'], [1, 'rgba(40,100,255,0)']]);
    this.shadowC = glowCanvas(32, [[0, 'rgba(40,25,10,.55)'], [0.55, 'rgba(40,25,10,.35)'], [1, 'rgba(40,25,10,0)']]);
  }

  resize(w, h, dpr) {
    this.W = w;
    this.H = h;
    this.k = dpr;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    // focal length: road fills the width at the squad's depth
    const d0 = CAM_H * ST + CAM_BACK * CT;
    this.F = (Math.min(w, h * 0.62) * 0.9 * d0) / (2 * ROAD);
    // squad sits at ~74% of the height
    const v0 = -CAM_H * CT + CAM_BACK * ST;
    this.cy = h * 0.74 + (this.F * v0) / d0;
    this.s0 = this.F / d0; // px per metre at the squad
    // road rows (screen y -> ground depth)
    this.rows = [];
    const yTop = this.groundY(VIEW + 6);
    const depthAt = (y) => {
      const kk = (this.cy - y) / this.F;
      return (CAM_H * (kk * ST + CT)) / (ST - kk * CT);
    };
    // band height grows toward the camera (each band samples its exact source span)
    for (let y = Math.max(0, Math.floor(yTop)), step = 2; y < h; y += step) {
      step = y < h * 0.3 ? 2 : y < h * 0.5 ? 3 : y < h * 0.7 ? 4 : 6;
      const dz = depthAt(y + step * 0.5);
      const d = CAM_H * ST + dz * CT;
      // dzSpan: metres of road covered by this band (source rows to sample)
      this.rows.push({ y, h: step + 0.5, dz, ps: this.F / d, dzSpan: Math.max(0.001, depthAt(y) - depthAt(y + step)) });
    }
    this.yFar = yTop;
  }

  groundY(dzFromSquad) {
    const dz = dzFromSquad + CAM_BACK;
    const d = CAM_H * ST + dz * CT;
    const v = -CAM_H * CT + dz * ST;
    return this.cy - (this.F * v) / d;
  }

  // project world point → this.px, this.py, this.ps (px per metre); false if behind camera
  P(x, y, z) {
    const dy = y - CAM_H;
    const dz = z - this.camZ;
    const d = -dy * ST + dz * CT;
    if (d < 0.5) return false;
    const v = dy * CT + dz * ST;
    this.ps = this.F / d;
    this.px = this.W / 2 + (x - this.camX) * this.ps;
    this.py = this.cy - v * this.ps;
    return true;
  }

  frameOf(img, name) {
    return this.A.F[img][name];
  }

  // draw atlas frame `name` with its anchor at (px,py), `m` = metres→px scale multiplier
  spr(imgEl, fr, px, py, m, flip, alpha) {
    const g = this.g;
    const k = m / fr[6];
    const w = fr[2] * k;
    const h = fr[3] * k;
    if (alpha !== undefined) g.globalAlpha = alpha;
    if (flip) {
      g.save();
      g.translate(px, py);
      g.scale(-1, 1);
      g.drawImage(imgEl, fr[0], fr[1], fr[2], fr[3], -fr[4] * k, -fr[5] * k, w, h);
      g.restore();
    } else g.drawImage(imgEl, fr[0], fr[1], fr[2], fr[3], px - fr[4] * k, py - fr[5] * k, w, h);
    if (alpha !== undefined) g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ events → effects
  handle(events, w) {
    for (const e of events) {
      switch (e.t) {
        case 'hit':
          this.sparks(e.x, e.y, e.z, e.k >= 2 ? (e.k === 3 ? 'gold' : 'steel') : e.big ? 'big' : 'hit', e.k >= 2 ? 3 : 2);
          if (e.k === 1 && e.big && e.o) {
            // damage on big targets is summed and shown a few times per second
            const a = this.dmgAcc.get(e.o) || { d: 0, t: 0 };
            a.d += e.dmg;
            if (this.time - a.t > 0.28) {
              this.text(e.x + (Math.random() - 0.5) * 0.8, e.y + 0.5, e.z, '-' + fmt(Math.max(1, Math.round(a.d))), '#fff', 0.6, 0.75);
              a.d = 0;
              a.t = this.time;
            }
            this.dmgAcc.set(e.o, a);
          }
          break;
        case 'kill':
          if (this.corpses.length < 160) this.corpses.push({ x: e.x, z: e.z, t: this.time, spr: e.spr, scale: e.scale, big: e.big, flip: Math.random() < 0.5 });
          this.puff(e.x, e.z, e.big ? 6 : 2);
          if (e.big) this.shake = Math.max(this.shake, 0.3);
          break;
        case 'sdie':
          this.puff(e.x, e.z, 3, '#5fa0ff');
          break;
        case 'crate':
          this.text(e.x, 1.6, e.z, `+${e.v}`, '#7fc3ff', 0.75, 0.9);
          for (let i = 0; i < 6; i++) this.part({ kind: 'chip', x: e.x, y: 0.5, z: e.z, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 0.6, col: i % 2 ? '#4f9bff' : '#bfe0ff', s: 0.12 });
          break;
        case 'ring':
          this.text(w.sq.x, 2.6, w.sq.z + 1, `${this.t(e.kind === 'rate' ? 'ringRate' : 'ringDmg', { p: e.p })}`, '#ffd34d', 0.9, 1.4);
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * TAU;
            this.part({ kind: 'beam', x: e.x + Math.cos(a) * 1.1, y: 0.2, z: e.z + Math.sin(a) * 0.6, vx: 0, vy: 4 + Math.random() * 5, vz: 0, life: 0.7, col: '#ffd34d', s: 0.06 });
          }
          break;
        case 'weapon': {
          this.pedestals.push({ x: e.x, z: e.z, kind: 'ped_small' });
          this.flyGuns.push({ x: e.x, z: e.z, t: this.time, tier: e.tier });
          this.burst(e.x, 1.4, e.z, 'blue');
          this.text(e.x, 2.6, e.z, this.t('wpn_' + Math.min(5, e.tier)), '#bfe3ff', 0.75, 1.4);
          break;
        }
        case 'heroJoin':
          this.pedestals.push({ x: e.x, z: e.z, kind: 'ped_big' });
          this.wakes.push({ x: e.x, z: e.z, kind: e.kind, t: this.time, flip: e.x > 0 });
          this.burst(e.x, 2.4, e.z, 'gold');
          break;
        case 'heroDie':
          this.burst(e.x, 1.2, e.z, 'blue');
          break;
        case 'boom':
          this.explosion(e.x, e.z, e.r, e.kind);
          break;
        case 'stomp':
          this.shake = Math.max(this.shake, e.boss ? 0.45 : 0.25);
          this.puff(e.x, e.z, 8);
          break;
        case 'shieldHit':
          this.sparks(e.x, 1, e.z, 'blue', 3);
          break;
        case 'lost':
          this.shake = Math.max(this.shake, 0.12);
          break;
        default:
          break;
      }
    }
  }

  part(p) {
    if (this.parts.length > 420) return;
    p.age = 0;
    this.parts.push(p);
  }
  sparks(x, y, z, kind, n) {
    const col = kind === 'gold' ? '#ffd34d' : kind === 'steel' ? '#e8f0ff' : kind === 'blue' ? '#8fd0ff' : '#fff1b0';
    for (let i = 0; i < n; i++) this.part({ kind: 'spark', x, y, z: z - 0.2, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, vz: -Math.random() * 4, life: 0.18 + Math.random() * 0.12, col, s: 0.05 });
    if (kind === 'gold') for (let i = 0; i < 2; i++) this.part({ kind: 'chip', x, y, z: z - 0.3, vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 4, vz: -Math.random() * 3, life: 0.6, col: i ? '#ffcf40' : '#ffe680', s: 0.1 });
    this.part({ kind: 'flash', x, y, z: z - 0.2, life: 0.08, s: kind === 'big' || kind === 'gold' || kind === 'steel' ? 0.9 : 0.55 });
  }
  puff(x, z, n, col) {
    for (let i = 0; i < n; i++) this.part({ kind: col ? 'chip' : 'dust', x: x + (Math.random() - 0.5) * 0.5, y: 0.3, z, vx: (Math.random() - 0.5) * 2, vy: 0.5 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1, life: 0.5 + Math.random() * 0.3, col, s: col ? 0.1 : 0.7 });
  }
  burst(x, y, z, kind) {
    const cols = kind === 'gold' ? ['#ffd34d', '#fff2a8', '#ffb300'] : ['#7fc3ff', '#e0f2ff', '#3f8cff'];
    for (let i = 0; i < 30; i++) this.part({ kind: 'chip', x, y: y * Math.random(), z, vx: (Math.random() - 0.5) * 7, vy: 2 + Math.random() * 6, vz: (Math.random() - 0.5) * 5, life: 0.9, col: cols[i % 3], s: 0.13 });
    for (let i = 0; i < 18; i++) this.part({ kind: 'beam', x: x + (Math.random() - 0.5) * 1.6, y: 0.1, z: z + (Math.random() - 0.5) * 1, vx: 0, vy: 5 + Math.random() * 6, vz: 0, life: 0.8, col: cols[0], s: 0.06 });
    this.part({ kind: 'glow', x, y: y * 0.6, z, life: 0.6, s: 3.2, gold: kind === 'gold' });
  }
  explosion(x, z, r, kind) {
    const big = r > 2;
    this.part({ kind: 'fire', x, y: 0.6, z, life: 0.45, s: r * 1.5 });
    for (let i = 0; i < (big ? 7 : 4); i++) this.part({ kind: 'smoke', x: x + (Math.random() - 0.5) * r, y: 0.5, z: z + (Math.random() - 0.5) * r * 0.6, vx: 0, vy: 1.2, vz: 0, life: 0.9 + Math.random() * 0.5, s: r * (0.6 + Math.random() * 0.5) });
    for (let i = 0; i < 10; i++) this.part({ kind: 'spark', x, y: 0.5, z, vx: (Math.random() - 0.5) * 12, vy: 2 + Math.random() * 7, vz: (Math.random() - 0.5) * 8, life: 0.4, col: '#ffcf6a', s: 0.07 });
    this.shake = Math.max(this.shake, big ? 0.35 : 0.15);
  }
  text(x, y, z, s, col, size, life) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, z, s, col, size, life, age: 0 });
  }

  // ------------------------------------------------------------ cached text plates
  crateImg(v) {
    let c = this.crateCache.get(v);
    if (c) return c;
    const fr = this.A.F.props.crate;
    c = document.createElement('canvas');
    c.width = fr[2];
    c.height = fr[3];
    const g = c.getContext('2d');
    g.drawImage(this.A.img.props, fr[0], fr[1], fr[2], fr[3], 0, 0, fr[2], fr[3]);
    const face = fr[7].face;
    g.font = `900 ${Math.round(fr[2] * 0.36)}px Nunito, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = '#0d3a8c';
    g.strokeText(`+${v}`, face[0], face[1] + 1);
    g.fillStyle = '#fff';
    g.fillText(`+${v}`, face[0], face[1] + 1);
    this.crateCache.set(v, c);
    return c;
  }

  // ------------------------------------------------------------ frame
  frame(w, dt) {
    this.time += dt;
    const g = this.g;
    const k = this.k;
    const sq = w.sq;
    this.camZ = sq.z - CAM_BACK;
    this.camX = sq.x * 0.18;
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const a = this.shake * 9;
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
    }
    g.setTransform(k, 0, 0, k, sx * k, sy * k);
    this.drawGround(w);
    this.drawPillars(sq.z);
    this.drawWorld(w, dt);
    this.drawTracers(w);
    this.drawParts(dt);
    this.drawTexts(dt);
    this.drawHaze();
    g.setTransform(k, 0, 0, k, 0, 0);
  }

  drawGround(w) {
    const g = this.g;
    const th = this.th;
    const W = this.W;
    const H = this.H;
    // sky / far haze
    const sky = g.createLinearGradient(0, 0, 0, Math.max(10, this.yFar + 40));
    sky.addColorStop(0, th.sky);
    sky.addColorStop(1, th.haze);
    g.fillStyle = sky;
    g.fillRect(-20, -20, W + 40, H + 40);
    // canyon floor beyond the road
    g.fillStyle = th.ground2;
    g.fillRect(-20, this.yFar, W + 40, H - this.yFar + 20);
    // road in perspective strips
    const tex = this.tx.road;
    const tw = tex.width;
    const thh = tex.height;
    const pxPerM = thh / TEX_M; // tile is TEX_M metres tall, 2·TEX_M wide
    const camZ = this.camZ;
    const cx = W / 2 - this.camX * 0; // camX applied per row
    const edge = th.edge;
    for (const r of this.rows) {
      const z = camZ + r.dz;
      let v = (z * pxPerM) % thh;
      if (v < 0) v += thh;
      v = thh - v;
      if (v < 1) v = thh; // wrap: never sample above the tile
      const sh = Math.max(1, Math.min(r.dzSpan * pxPerM, v));
      const xl = cx + (-ROAD - 0.15 - this.camX) * r.ps;
      const xr = cx + (ROAD + 0.15 - this.camX) * r.ps;
      // source x span: the road width in metres on the (2× wide) tile
      const sw = Math.min(tw, (2 * ROAD + 0.3) * pxPerM);
      g.drawImage(tex, 0, v - sh, sw, sh, xl, r.y, xr - xl, r.h);
    }
    // soft dark bands along both edges (ambient occlusion from the walls)
    for (const sd of [-1, 1]) {
      g.globalAlpha = 0.16;
      this.line3(sd * (ROAD - 0.45), 0, 0, 0.9, '#3a2a1a', 0.16);
      this.line3(sd * (ROAD - 0.15), 0, 0, 0.3, '#3a2a1a', 0.22);
    }
    // curbs + lane rail
    this.line3(-ROAD - 0.15, ROAD + 0.15, 0.0, 0.32, edge, 0.55);
    this.line3(ROAD + 0.15, ROAD + 0.15, 0.0, 0.32, edge, 0.55);
    this.laneRail(w);
  }

  // thick line along the road at lateral x, from squad-6 to far
  line3(x, _x2, y, width, col, alpha) {
    const g = this.g;
    g.fillStyle = col;
    g.globalAlpha = alpha;
    g.beginPath();
    const z0 = this.camZ + 2;
    const z1 = this.camZ + CAM_BACK + VIEW + 6;
    this.P(x - width / 2, y, z0);
    g.moveTo(this.px, this.py);
    this.P(x - width / 2, y, z1);
    g.lineTo(this.px, this.py);
    this.P(x + width / 2, y, z1);
    g.lineTo(this.px, this.py);
    this.P(x + width / 2, y, z0);
    g.lineTo(this.px, this.py);
    g.fill();
    g.globalAlpha = 1;
  }

  laneRail(w) {
    // a low metal rail separating the reinforcement lane on the right
    const g = this.g;
    const x = LANE_X - 0.95;
    const z0 = this.camZ + 2;
    const z1 = this.camZ + CAM_BACK + VIEW + 6;
    g.strokeStyle = 'rgba(60,55,50,.55)';
    g.lineWidth = 1;
    g.beginPath();
    for (const yy of [0.32, 0.5]) {
      this.P(x, yy, z0);
      g.moveTo(this.px, this.py);
      this.P(x, yy, z1);
      g.lineTo(this.px, this.py);
    }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    this.P(x + 0.04, 0.52, z0);
    g.moveTo(this.px, this.py);
    this.P(x + 0.04, 0.52, z1);
    g.lineTo(this.px, this.py);
    g.stroke();
    // posts
    g.fillStyle = 'rgba(70,64,58,.7)';
    const start = Math.ceil(z0 / 2.5) * 2.5;
    for (let z = start; z < z1; z += 2.5) {
      if (!this.P(x, 0.52, z)) continue;
      const top = this.py;
      const ps = this.ps;
      this.P(x, 0, z);
      g.fillRect(this.px - ps * 0.05, top, Math.max(1, ps * 0.1), this.py - top);
    }
  }

  drawPillars(sqz) {
    const g = this.g;
    const rocks = this.tx.rocks;
    const RF = this.A.F.rocks;
    const names = ['rock0', 'rock1', 'rock2', 'rock3', 'rock4', 'rock5'];
    const z0 = this.camZ + 3;
    const z1 = this.camZ + CAM_BACK + VIEW + 16;
    const i0 = Math.floor(z0 / PILLAR_STEP);
    const i1 = Math.ceil(z1 / PILLAR_STEP);
    for (let i = i1; i >= i0; i--) {
      for (const side of [-1, 1]) {
        const hsh = hash(i * 2 + (side > 0 ? 1 : 0));
        const z = i * PILLAR_STEP + hsh * 1.2;
        const x = side * (ROAD + 2.9 + hsh * 1.1);
        if (!this.P(x, 0, z)) continue;
        const fr = RF[names[Math.floor(hsh * 997) % names.length]];
        const sc = 0.95 + ((hsh * 7.3) % 1) * 0.4;
        this.spr(rocks, fr, this.px, this.py + this.ps * 0.8, this.ps * sc, side > 0);
      }
    }
    // dark gap between road edge and the walls
    g.globalAlpha = 1;
  }

  drawWorld(w, dt) {
    const sq = w.sq;
    const dl = this.dl;
    dl.length = 0;
    const zMax = this.camZ + CAM_BACK + VIEW + 4;
    const zMin = this.camZ + 2.2;
    const push = (z, kind, o) => {
      if (z < zMin || z > zMax) return;
      dl.push({ z, kind, o });
    };
    for (const c of w.crates) if (c.alive) push(c.z, 1, c);
    for (const p of w.pickups) if (p.alive) push(p.z, 2, p);
    for (const p of w.statues) if (p.alive) push(p.z, 3, p);
    for (const p of this.pedestals) push(p.z, 4, p);
    for (const p of this.wakes) push(p.z, 5, p);
    for (const e of w.enemies) if (e.alive) push(e.z, 6, e);
    const now = this.time;
    let cj = 0;
    for (const c of this.corpses) {
      if (now - c.t < 1.6 && c.z > zMin - 2) {
        this.corpses[cj++] = c;
        push(c.z + 0.05, 7, c);
      }
    }
    this.corpses.length = cj;
    for (const s of w.sol) push(sq.z + s.oz, 8, s);
    for (const h of sq.heroes) push(sq.z + h.oz, 9, h);
    dl.sort((a, b) => b.z - a.z);
    // ground layer: rings + shadows first
    for (const r of w.rings) if (r.alive && r.z > zMin && r.z < zMax) this.drawRing(r);
    this.drawShadows(w);
    for (const d of dl) {
      switch (d.kind) {
        case 1:
          this.drawCrate(d.o);
          break;
        case 2:
          this.drawPickup(d.o);
          break;
        case 3:
          this.drawStatue(d.o, w);
          break;
        case 4:
          this.drawPed(d.o);
          break;
        case 5:
          this.drawWake(d.o);
          break;
        case 6:
          this.drawEnemy(d.o);
          break;
        case 7:
          this.drawCorpse(d.o);
          break;
        case 8:
          this.drawSoldier(d.o, sq, w);
          break;
        default:
          this.drawHero(d.o, sq, w);
      }
    }
    this.wakes = this.wakes.filter((x) => now - x.t < 0.9);
    this.pedestals = this.pedestals.filter((p) => p.z > zMin - 4);
    this.drawFlyGuns(w);
    this.drawAbility(w);
    this.drawBars(w);
    this.drawSquadBadge(w);
  }

  drawShadows(w) {
    const g = this.g;
    const sh = this.shadowC;
    const sq = w.sq;
    const one = (x, z, r) => {
      if (!this.P(x, 0, z)) return;
      const rw = r * this.ps * 2.2;
      if (rw < 9) return; // too small to matter far away
      g.drawImage(sh, this.px - rw / 2, this.py - rw * 0.22, rw, rw * 0.44);
    };
    for (const s of w.sol) one(sq.x + s.ox, sq.z + s.oz, 0.38);
    for (const h of sq.heroes) one(sq.x + h.ox, sq.z + h.oz, 0.6);
    // the horde: one path of flat ellipses (a single fill instead of hundreds of blits)
    g.fillStyle = 'rgba(50,30,12,.26)';
    g.beginPath();
    for (const e of w.enemies) {
      if (!e.alive || !this.P(e.x, 0, e.z)) continue;
      const rx = e.r * this.ps * (e.boss ? 0.95 : e.big ? 1.15 * e.scale : 1.05 * e.scale);
      g.moveTo(this.px + rx, this.py);
      g.ellipse(this.px, this.py, rx, rx * 0.42, 0, 0, TAU);
    }
    g.fill();
  }

  drawCrate(c) {
    if (!this.P(c.x, 0, c.z)) return;
    const fr = this.A.F.props.crate;
    const im = this.crateImg(c.v);
    const k = (this.ps * 0.95) / fr[6];
    this.g.drawImage(im, this.px - fr[4] * k, this.py - fr[5] * k, fr[2] * k, fr[3] * k);
  }

  number(px, py, size, txt, flash) {
    const g = this.g;
    g.font = `900 ${Math.max(9, size) | 0}px Nunito, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, size * 0.16);
    g.strokeStyle = 'rgba(30,30,36,.9)';
    g.strokeText(txt, px, py);
    g.fillStyle = flash ? '#fff6c0' : '#ffffff';
    g.fillText(txt, px, py);
  }

  drawPickup(p) {
    if (!this.P(p.x, 0, p.z)) return;
    const PF = this.A.F.props;
    const img = this.A.img.props;
    const fr = PF.ped_small;
    const ps = this.ps * 1.35;
    const bx = this.px;
    const by = this.py;
    this.spr(img, fr, bx, by, ps);
    const kk = ps / fr[6];
    this.number(bx - fr[4] * kk + fr[7].face[0] * kk, by - fr[5] * kk + fr[7].face[1] * kk, ps * 0.5, fmt(Math.ceil(p.hp)), p.flash > 0);
    // floating weapon with glow
    const top = by - fr[5] * kk + fr[7].top[1] * kk;
    const bob = Math.sin(this.time * 3 + p.z) * ps * 0.08;
    const g = this.g;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.3 + 0.12 * Math.sin(this.time * 5);
    const gw = ps * 1.8;
    g.drawImage(this.blueGlow, bx - gw / 2, top - ps * 0.75 - gw / 2 + bob, gw, gw);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const wf = PF['w' + Math.min(4, p.tier - 1)];
    this.spr(img, wf, bx, top - ps * 0.45 + bob, ps * 1.15, p.x > 0);
  }

  drawStatue(s, w) {
    if (!this.P(s.x, 0, s.z)) return;
    const img = this.A.img.props;
    const fr = this.A.F.props.ped_big;
    const ps = this.ps * 1.55;
    const bx = this.px;
    const by = this.py;
    const kk = ps / fr[6];
    const topY = by - fr[5] * kk + fr[7].top[1] * kk;
    const flip = s.x > 0;
    const hf = this.A.F.heroes[`h${s.kind}_statue`];
    // shake a little when hit
    const jx = s.flash > 0 ? (Math.random() - 0.5) * ps * 0.06 : 0;
    this.spr(this.A.img.heroes, hf, bx + jx, topY + ps * 0.08, ps * 1.75, flip);
    if (s.flash > 0) {
      const g = this.g;
      g.globalCompositeOperation = 'lighter';
      this.spr(this.A.img.heroes, hf, bx + jx, topY + ps * 0.08, ps * 1.75, flip, 0.3);
      g.globalCompositeOperation = 'source-over';
    }
    this.spr(img, fr, bx, by, ps);
    this.number(bx - fr[4] * kk + fr[7].face[0] * kk, by - fr[5] * kk + fr[7].face[1] * kk, ps * 0.72, fmt(Math.ceil(s.hp)), s.flash > 0);
  }

  drawPed(p) {
    if (!this.P(p.x, 0, p.z)) return;
    this.spr(this.A.img.props, this.A.F.props[p.kind], this.px, this.py, this.ps * (p.kind === 'ped_big' ? 1.55 : 1.35));
  }

  drawWake(o) {
    // statue turning into a live hero: colour wipes up from the feet
    if (!this.P(o.x, 0, o.z)) return;
    const u = Math.min(1, (this.time - o.t) / 0.55);
    const fr = this.A.F.props.ped_big;
    const ps = this.ps * 1.55;
    const kk = ps / fr[6];
    const topY = this.py - fr[5] * kk + fr[7].top[1] * kk;
    const hs = this.A.F.heroes[`h${o.kind}_statue`];
    const hl = this.A.F.heroes[`h${o.kind}_live`];
    const g = this.g;
    const m = ps * 1.75;
    const k2 = m / hl[6];
    const hTop = topY + ps * 0.08 - hl[5] * k2;
    const cut = topY + ps * 0.08 - (hl[3] * k2 + 4) * u;
    const fade = this.time - o.t > 0.55 ? 1 - (this.time - o.t - 0.55) / 0.35 : 1;
    g.save();
    g.beginPath();
    g.rect(this.px - 400, cut, 800, 2000);
    g.clip();
    this.spr(this.A.img.heroes, hl, this.px, topY + ps * 0.08, m, o.flip, Math.max(0, fade));
    g.restore();
    if (u < 1) {
      g.save();
      g.beginPath();
      g.rect(this.px - 400, hTop - 400, 800, cut - hTop + 400);
      g.clip();
      this.spr(this.A.img.heroes, hs, this.px, topY + ps * 0.08, m, o.flip);
      g.restore();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.8;
      g.fillStyle = '#ffe680';
      g.fillRect(this.px - m * 0.7, cut - 2, m * 1.4, 4);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }

  enemyImg(spr) {
    if (spr === 'org' || spr === 'orgbru') return this.A.img.unitsOrg;
    if (spr === 'blk' || spr === 'blkbru') return this.A.img.unitsBlk;
    return this.A.img.units;
  }

  drawEnemy(e) {
    if (!this.P(e.x, 0, e.z)) return;
    const base = e.spr === 'blk' ? 'shd' : e.spr === 'org' ? 'red' : e.spr.endsWith('bru') ? 'bru' : e.spr;
    const n = e.big && (e.contact > 0 && e.atk <= 0) ? 0 : Math.floor(e.ph * 2.2) & 7;
    const fr = this.A.F.units[`${base}_${n}`];
    const img = this.enemyImg(e.spr);
    const m = this.ps * e.scale * (e.atk > 0 ? 1.06 : 1);
    this.spr(img, fr, this.px, this.py, m);
    if (e.flash > 0) {
      const g = this.g;
      g.globalCompositeOperation = 'lighter';
      this.spr(img, fr, this.px, this.py, m, false, 0.5);
      g.globalCompositeOperation = 'source-over';
    }
  }

  drawCorpse(c) {
    if (!this.P(c.x, 0, c.z)) return;
    const age = this.time - c.t;
    const n = Math.min(3, Math.floor(age / 0.07));
    const fr = this.A.F.units[`${c.big ? 'dbru' : 'dead'}_${n}`];
    const a = age > 1.1 ? Math.max(0, 1 - (age - 1.1) / 0.5) : 1;
    this.spr(this.A.img.units, fr, this.px, this.py, this.ps * c.scale, c.flip, a);
  }

  drawSoldier(s, sq, w) {
    const x = sq.x + s.ox;
    const z = sq.z + s.oz;
    if (!this.P(x, 0, z)) return;
    const n = Math.floor(s.ph * 8) & 7;
    const fr = this.A.F.units[`blue_${sq.speed > 0.4 || w.state !== 'run' ? n : (n & 1) * 2}`];
    const ps = this.ps;
    this.spr(this.A.img.units, fr, this.px, this.py, ps);
    if (s.fl > 0) {
      const g = this.g;
      this.P(x + 0.1, 1.38, z + 0.75);
      const r = this.ps * 0.32;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.85;
      g.drawImage(this.flash, this.px - r, this.py - r, r * 2, r * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }

  drawHero(h, sq, w) {
    if (this.time - (h.seenT || (h.seenT = this.time)) < 0.5 && w.t - h.born < 0.6) return; // still on the pedestal (wake anim)
    const x = sq.x + h.ox;
    const z = sq.z + h.oz;
    if (!this.P(x, 0, z)) return;
    const n = Math.floor(h.ph * 6) % 6;
    const fr = this.A.F.heroes[`h${h.kind}_${n}`];
    const g = this.g;
    // gold aura under heroes
    const rw = this.ps * 1.8;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35;
    g.drawImage(this.goldGlow, this.px - rw / 2, this.py - rw * 0.2, rw, rw * 0.4);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.spr(this.A.img.heroes, fr, this.px, this.py, this.ps * 1.12);
    if (h.fl > 0) {
      this.P(x + 0.2, 1.5, z + 1.0);
      const r = this.ps * (h.kind === 'rocket' ? 1.1 : 0.8);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.flash, this.px - r, this.py - r, r * 2, r * 2);
      g.globalCompositeOperation = 'source-over';
    }
  }

  drawRing(r) {
    if (!this.P(r.x, 0, r.z)) return;
    const g = this.g;
    const fr = this.A.F.props.ring;
    const ps = this.ps;
    const bx = this.px;
    const by = this.py;
    const pulse = 1 + 0.05 * Math.sin(this.time * 6 + r.z);
    g.globalCompositeOperation = 'lighter';
    const gw = ps * 3.4;
    g.globalAlpha = 0.6;
    g.drawImage(this.goldGlow, bx - gw / 2, by - gw * 0.2, gw, gw * 0.4);
    g.globalAlpha = 1;
    this.spr(this.A.img.props, fr, bx, by, ps * pulse);
    // vertical light streaks
    const t = this.time;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + t * 0.8;
      const xx = bx + Math.cos(a) * ps * 1.1;
      const yy = by + Math.sin(a) * ps * 0.45;
      const hh = ps * (1.4 + 0.8 * Math.sin(t * 4 + i * 1.7));
      const gr = g.createLinearGradient(0, yy - hh, 0, yy);
      gr.addColorStop(0, 'rgba(255,220,90,0)');
      gr.addColorStop(1, 'rgba(255,220,90,.55)');
      g.fillStyle = gr;
      g.fillRect(xx - ps * 0.05, yy - hh, ps * 0.1, hh);
    }
    g.globalCompositeOperation = 'source-over';
    const label = this.t(r.kind === 'rate' ? 'ringRate' : 'ringDmg', { p: r.p });
    const size = Math.max(10, ps * 0.62);
    g.font = `900 ${size | 0}px Nunito, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, size * 0.18);
    g.strokeStyle = 'rgba(40,24,0,.85)';
    g.strokeText(label, bx, by - ps * 2.2);
    g.fillStyle = '#ffe9a0';
    g.fillText(label, bx, by - ps * 2.2);
  }

  drawFlyGuns(w) {
    const sq = w.sq;
    const PF = this.A.F.props;
    this.flyGuns = this.flyGuns.filter((f) => this.time - f.t < 0.6);
    for (const f of this.flyGuns) {
      const u = (this.time - f.t) / 0.6;
      const e = u * u * (3 - 2 * u);
      const x = f.x + (sq.x - f.x) * e;
      const z = f.z + (sq.z - f.z) * e;
      const y = 1.6 + Math.sin(u * Math.PI) * 3;
      if (!this.P(x, y, z)) continue;
      this.spr(this.A.img.props, PF['w' + Math.min(4, f.tier - 1)], this.px, this.py, this.ps * (1.2 - 0.5 * u));
    }
  }

  drawTracers(w) {
    const g = this.g;
    const list = w.bullets;
    if (!list.length) return;
    const tierCol = ['#ffe9a8', '#fff1b0', '#ffd36b', '#ffb84a', '#ffcf5a', '#6ff6ff'][Math.min(5, w.sq.tier)];
    g.globalCompositeOperation = 'lighter';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? '#fffbe8' : tierCol;
      g.globalAlpha = pass ? 0.9 : 0.35;
      g.lineCap = 'round';
      for (const kind of [0, 1, 2]) {
        g.beginPath();
        let any = false;
        let lw = 0;
        for (const b of list) {
          if (b.kind !== kind) continue;
          if (!this.P(b.x, 1.35, b.z)) continue;
          const x1 = this.px;
          const y1 = this.py;
          const ps = this.ps;
          this.P(b.x, 1.35, b.z - (kind ? 1.4 : 0.9));
          g.moveTo(x1, y1);
          g.lineTo(this.px, this.py);
          lw += ps;
          any = true;
        }
        if (!any) continue;
        const avg = lw / list.length;
        g.lineWidth = Math.max(pass ? 1 : 1.5, avg * (kind === 2 ? 0.16 : kind ? 0.08 : 0.034) * (pass ? 1 : 3));
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.lineCap = 'butt';
  }

  drawParts(dt) {
    const g = this.g;
    let j = 0;
    const list = this.parts;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      list[j++] = p;
      if (p.vx !== undefined) {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.y += p.vy * dt;
        if (p.kind === 'chip' || p.kind === 'spark') {
          p.vy -= 14 * dt;
          if (p.y < 0.03) {
            p.y = 0.03;
            p.vy *= -0.3;
            p.vx *= 0.6;
            p.vz *= 0.6;
          }
        }
      }
      if (!this.P(p.x, p.y, p.z)) continue;
      const u = p.age / p.life;
      const ps = this.ps;
      switch (p.kind) {
        case 'spark':
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = p.col;
          g.globalAlpha = 1 - u;
          g.fillRect(this.px - 1, this.py - 1, Math.max(2, ps * p.s), Math.max(2, ps * p.s));
          break;
        case 'chip':
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = p.col || '#c9b79c';
          g.globalAlpha = 1 - u * u;
          g.fillRect(this.px - ps * p.s * 0.5, this.py - ps * p.s * 0.5, ps * p.s, ps * p.s * 0.8);
          break;
        case 'beam': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = (1 - u) * 0.8;
          g.fillStyle = p.col;
          g.fillRect(this.px - ps * p.s * 0.5, this.py, ps * p.s, ps * 0.9);
          break;
        }
        case 'flash': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 1 - u;
          const r = ps * p.s;
          g.drawImage(this.flash, this.px - r, this.py - r, r * 2, r * 2);
          break;
        }
        case 'glow': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 1 - u;
          const r = ps * p.s * (0.6 + u);
          g.drawImage(p.gold ? this.goldGlow : this.blueGlow, this.px - r, this.py - r, r * 2, r * 2);
          break;
        }
        case 'fire': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 1 - u;
          const r = ps * p.s * (0.5 + u * 0.8);
          g.drawImage(this.fire, this.px - r, this.py - r * 1.2, r * 2, r * 2);
          break;
        }
        case 'smoke': {
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = (1 - u) * 0.8;
          const r = ps * p.s * (0.6 + u);
          g.drawImage(this.smoke, this.px - r, this.py - r, r * 2, r * 2);
          break;
        }
        default: {
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = (1 - u) * 0.8;
          const r = ps * p.s * (0.5 + u);
          g.drawImage(this.dust, this.px - r, this.py - r * 0.6, r * 2, r * 1.2);
        }
      }
    }
    list.length = j;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  drawTexts(dt) {
    const g = this.g;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    let j = 0;
    for (const t of this.texts) {
      t.age += dt;
      if (t.age >= t.life) continue;
      this.texts[j++] = t;
      if (!this.P(t.x, t.y + t.age * 1.2, t.z)) continue;
      const u = t.age / t.life;
      const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.5 : 1.1 - Math.min(0.1, (u - 0.15) * 0.3);
      const size = Math.max(11, this.ps * t.size * pop);
      g.font = `900 ${size | 0}px Nunito, system-ui, sans-serif`;
      g.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      g.lineWidth = Math.max(2, size * 0.17);
      g.strokeStyle = 'rgba(20,20,28,.85)';
      g.strokeText(t.s, this.px, this.py);
      g.fillStyle = t.col;
      g.fillText(t.s, this.px, this.py);
    }
    this.texts.length = j;
    g.globalAlpha = 1;
  }

  drawBars(w) {
    const g = this.g;
    for (const e of w.enemies) {
      if (!e.alive || !e.big || e.boss) continue;
      if (!this.P(e.x, e.r * 3.2 * e.scale + 0.3, e.z)) continue;
      const bw = this.ps * 1.4;
      const bh = Math.max(3, this.ps * 0.14);
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(this.px - bw / 2 - 1, this.py - 1, bw + 2, bh + 2);
      g.fillStyle = '#ff3b4e';
      g.fillRect(this.px - bw / 2, this.py, (bw * Math.max(0, e.hp)) / e.max, bh);
    }
  }

  drawSquadBadge(w) {
    const sq = w.sq;
    if (!sq.n && !sq.heroes.length) return;
    if (!this.P(sq.x, 2.4 + sq.R * 0.3, sq.z - 0.2)) return;
    const g = this.g;
    const txt = fmt(sq.n);
    g.font = '900 14px Nunito, system-ui, sans-serif';
    const tw = g.measureText(txt).width + 16;
    const x = this.px;
    const y = this.py;
    g.fillStyle = 'rgba(16,40,96,.88)';
    g.beginPath();
    if (g.roundRect) g.roundRect(x - tw / 2, y - 11, tw, 22, 11);
    else g.rect(x - tw / 2, y - 11, tw, 22);
    g.fill();
    g.strokeStyle = '#7fb8ff';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(txt, x, y + 1);
  }

  drawAbility(w) {
    const g = this.g;
    const sq = w.sq;
    if (w.shieldT > 0) {
      if (this.P(sq.x, 0.2, sq.z)) {
        const r = this.ps * (sq.R + 0.9);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.35 + 0.15 * Math.sin(this.time * 10);
        g.drawImage(this.blueGlow, this.px - r, this.py - r * 0.9, r * 2, r * 1.3);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
    }
    for (const m of w.missiles) {
      if (!this.P(m.x, m.y, m.z)) continue;
      g.fillStyle = '#e8e8f0';
      const s = this.ps * 0.35;
      g.fillRect(this.px - s / 2, this.py - s, s, s * 2);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.flash, this.px - s * 1.5, this.py + s * 0.4, s * 3, s * 3);
      g.globalCompositeOperation = 'source-over';
      this.part({ kind: 'smoke', x: m.x, y: m.y, z: m.z - 0.3, vx: 0, vy: 0.3, vz: 0, life: 0.6, s: 0.5 });
    }
    if (w.strikes.length) {
      // jet silhouette sweeping up the road
      const s0 = w.strikes[0];
      const u = 1 - Math.max(0, s0.t - w.t) / 0.5;
      if (this.P(sq.x, 7, sq.z + 4 + u * 30)) {
        const s = this.ps * 2.2;
        g.fillStyle = 'rgba(30,40,60,.92)';
        g.beginPath();
        g.moveTo(this.px, this.py - s);
        g.lineTo(this.px + s * 0.9, this.py + s * 0.4);
        g.lineTo(this.px + s * 0.15, this.py + s * 0.2);
        g.lineTo(this.px, this.py + s * 0.6);
        g.lineTo(this.px - s * 0.15, this.py + s * 0.2);
        g.lineTo(this.px - s * 0.9, this.py + s * 0.4);
        g.closePath();
        g.fill();
      }
    }
  }

  drawHaze() {
    const g = this.g;
    const th = this.th;
    const y0 = this.yFar;
    const y1 = this.groundY(34);
    const gr = g.createLinearGradient(0, y0 - 40, 0, y1);
    gr.addColorStop(0, th.haze);
    gr.addColorStop(0.2, th.haze + 'aa');
    gr.addColorStop(1, th.haze + '00');
    g.fillStyle = gr;
    g.fillRect(-20, -20, this.W + 40, y1 + 20);
    if (th.dark > 0) {
      g.fillStyle = `rgba(20,10,40,${th.dark * 0.35})`;
      g.fillRect(-20, -20, this.W + 40, this.H + 40);
    }
    // vignette at the bottom corners
    const vg = g.createRadialGradient(this.W / 2, this.H * 0.55, this.H * 0.3, this.W / 2, this.H * 0.55, this.H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = vg;
    g.fillRect(-20, -20, this.W + 40, this.H + 40);
  }
}
