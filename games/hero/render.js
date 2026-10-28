// Ball Hero — broadcast-style pseudo-3D renderer (Canvas 2D).
// A low chase camera (with yaw) behind the attacker looks toward the goal.
// Everything is projected from world meters; textures are mapped with
// subdivided affine cells for perspective.

import { GW, GH, NET_D, PITCH_X, HALF_Y, BOX_X, BOX_Y, SIX_X, SIX_Y, PEN_Y, BR } from './sim.js';

const FIG = 1.06; // near-real proportions: the camera is close, players are big
const BALL_VIS = 1.7;

export class View {
  constructor() {
    this.W = 390;
    this.H = 700;
    this.dpr = 1;
    this.fov = (62 * Math.PI) / 180;
    this.F = 600;
    this.H0 = 350;
    this.cx = 0;
    this.cy = 30;
    this.cz = 6;
    this.setRig(0, 30, 6, 0, 0.3);
  }
  setRig(cx, cy, cz, yaw, pitch) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.yaw = yaw;
    this.fx = Math.sin(yaw);
    this.fy = -Math.cos(yaw);
    this.rx = Math.cos(yaw);
    this.ry = Math.sin(yaw);
    this.th = pitch;
    this.ct = Math.cos(pitch);
    this.st = Math.sin(pitch);
  }
  resize(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.F = H / (2 * Math.tan(this.fov / 2));
    // landscape screens: keep the horizontal view reasonable
    this.F = Math.min(this.F, W * 1.25 + H * 0.2);
    this.H0 = H * 0.5;
  }
  depth(x, y, z) {
    const along = (x - this.cx) * this.fx + (y - this.cy) * this.fy;
    return along * this.ct - (z - this.cz) * this.st;
  }
  // projects into `o` = { x, y, d (depth), k (px per meter) }; false when behind
  p(x, y, z, o) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const along = dx * this.fx + dy * this.fy;
    const side = dx * this.rx + dy * this.ry;
    const dz = z - this.cz;
    const d = along * this.ct - dz * this.st;
    if (d < 0.15) {
      o.d = d;
      return false;
    }
    const up = along * this.st + dz * this.ct;
    const k = this.F / d;
    o.x = this.W / 2 + side * k;
    o.y = this.H0 - up * k;
    o.d = d;
    o.k = k;
    return true;
  }
  ray(sx, sy) {
    const a = (sx - this.W / 2) / this.F;
    const b = (this.H0 - sy) / this.F;
    const along = this.ct + b * this.st;
    return { x: a * this.rx + along * this.fx, y: a * this.ry + along * this.fy, z: b * this.ct - this.st };
  }
  // screen → ground point (z = 0)
  ground(sx, sy) {
    const r = this.ray(sx, sy);
    if (r.z >= -1e-4) return null;
    const t = -this.cz / r.z;
    return { x: this.cx + t * r.x, y: this.cy + t * r.y };
  }
  // screen → goal-mouth plane (y = 0)
  goalPlane(sx, sy) {
    const r = this.ray(sx, sy);
    if (r.y >= -1e-4) return null;
    const t = -this.cy / r.y;
    return { x: this.cx + t * r.x, z: this.cz + t * r.z };
  }
}

// ------------------------------------------------------------------ helpers
const P0 = { x: 0, y: 0, d: 0, k: 0 };
const P1 = { x: 0, y: 0, d: 0, k: 0 };
const P2 = { x: 0, y: 0, d: 0, k: 0 };

function polyPath(g, v, pts) {
  const near = 0.4;
  const cam = pts.map(([x, y, z]) => ({ x, y, z, d: v.depth(x, y, z) }));
  const out = [];
  for (let i = 0; i < cam.length; i++) {
    const a = cam[i];
    const b = cam[(i + 1) % cam.length];
    const ain = a.d >= near;
    const bin = b.d >= near;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (near - a.d) / (b.d - a.d);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  if (out.length < 3) return false;
  for (let i = 0; i < out.length; i++) {
    v.p(out[i].x, out[i].y, out[i].z, P0);
    if (i === 0) g.moveTo(P0.x, P0.y);
    else g.lineTo(P0.x, P0.y);
  }
  g.closePath();
  return true;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let gg = (n >> 8) & 255;
  let b = n & 255;
  if (f < 0) {
    r *= 1 + f;
    gg *= 1 + f;
    b *= 1 + f;
  } else {
    r += (255 - r) * f;
    gg += (255 - gg) * f;
    b += (255 - b) * f;
  }
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}

// Texture-maps img (src rect) onto a world quad p00 (top-left), p10, p01, p11
// with nx × ny affine cells. Cells fully off screen are skipped.
function texQuad(g, v, img, sx, sy, sw, sh, p00, p10, p01, p11, nx, ny, jitter) {
  const dpr = v.dpr;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cw = sw / nx;
  const ch = sh / ny;
  const grid = [];
  for (let j = 0; j <= ny; j++) {
    const row = [];
    const L = lerp(p00, p01, j / ny);
    const R = lerp(p10, p11, j / ny);
    for (let i = 0; i <= nx; i++) {
      const q = lerp(L, R, i / nx);
      const o = { x: 0, y: 0, d: 0, k: 0 };
      row.push(v.p(q[0], q[1], q[2], o) ? o : null);
    }
    grid.push(row);
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const A = grid[j][i];
      const B = grid[j][i + 1];
      const C = grid[j + 1][i];
      const D = grid[j + 1][i + 1];
      if (!A || !B || !C || !D) continue;
      const minX = Math.min(A.x, B.x, C.x, D.x);
      const maxX = Math.max(A.x, B.x, C.x, D.x);
      const minY = Math.min(A.y, B.y, C.y, D.y);
      const maxY = Math.max(A.y, B.y, C.y, D.y);
      if (maxX < 0 || minX > v.W || maxY < 0 || minY > v.H) continue;
      const jy = jitter ? jitter(j) : 0;
      g.setTransform((dpr * (B.x - A.x)) / cw, (dpr * (B.y - A.y)) / cw, (dpr * (C.x - A.x)) / ch, (dpr * (C.y - A.y)) / ch, dpr * A.x, dpr * (A.y + jy));
      g.drawImage(img, sx + i * cw, sy + j * ch, cw, ch, -0.6, -0.6, cw + 1.2, ch + 1.2);
    }
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ------------------------------------------------------------------ assets
export function makeAssets(homeColor, awayColor, adText) {
  const R = seeded(11);
  // crowd: one 60 m wide tile, both tiers; pre-blurred for depth of field
  const cw = 1536;
  const ch = 768;
  const raw = document.createElement('canvas');
  raw.width = cw;
  raw.height = ch;
  const g = raw.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, '#2a2f3f');
  sky.addColorStop(1, '#3c4152');
  g.fillStyle = sky;
  g.fillRect(0, 0, cw, ch);
  const palette = [homeColor, homeColor, homeColor, homeColor, '#ffffff', '#f2f2f2', '#e8e8e8', shade(homeColor, -0.35), shade(homeColor, 0.45), '#1d1d24', '#3b3f52', awayColor, '#f5d04a', '#2c6fd6', '#d63a3a'];
  const skins = ['#f1c7a3', '#e2ad84', '#c58a60', '#9a6641', '#6f472b', '#f6d2b2'];
  const hairs = ['#1d150f', '#3a2618', '#6b4a2a', '#c99a5a', '#111111', '#8a8a8a'];
  const rows = 58;
  const rh = ch / rows;
  const band = [27, 29];
  for (let r = 0; r < rows; r++) {
    const y = (r + 1) * rh;
    if (r >= band[0] && r < band[1]) continue;
    const lower = r > band[1];
    const light = lower ? 0.75 + 0.25 * ((r - band[1]) / (rows - band[1])) : 0.55 + 0.25 * (r / band[0]);
    g.fillStyle = r % 2 ? '#41475a' : '#4a5064';
    g.fillRect(0, y - rh, cw, rh);
    for (let x = 3 + (r % 2) * 4; x < cw; x += 9.2) {
      if (x % 256 < 12) continue;
      if (R() < 0.04) continue;
      const col = palette[(R() * palette.length) | 0];
      const jx = x + (R() - 0.5) * 3;
      const jyy = (R() - 0.5) * 2;
      const bw = 7;
      g.fillStyle = shade(col, light - 1);
      rr(g, jx - bw / 2, y - rh * 0.66 + jyy, bw, rh * 0.7, 3);
      g.fill();
      // arms up (celebrating fans)
      if (R() < 0.16) {
        g.fillRect(jx - bw / 2 - 1, y - rh * 1.15 + jyy, 2, rh * 0.55);
        g.fillRect(jx + bw / 2 - 1, y - rh * 1.15 + jyy, 2, rh * 0.55);
      }
      g.fillStyle = shade(skins[(R() * skins.length) | 0], light - 1);
      g.beginPath();
      g.arc(jx, y - rh * 0.78 + jyy, rh * 0.25, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = shade(hairs[(R() * hairs.length) | 0], light - 1);
      g.beginPath();
      g.arc(jx, y - rh * 0.86 + jyy, rh * 0.22, Math.PI, 0);
      g.fill();
      if (R() < 0.05) {
        g.fillStyle = col === '#ffffff' ? homeColor : '#ffffff';
        g.fillRect(jx - 10, y - rh * 1.2, 20, 3);
      }
    }
  }
  // aisles
  for (let x = 0; x < cw; x += 256) {
    g.fillStyle = '#8b8f9a';
    g.fillRect(x, 0, 12, ch);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < ch; y += rh) g.fillRect(x, y, 12, 1.5);
  }
  // tier fascia with LED ribbon
  const by = band[0] * rh;
  const bh = (band[1] - band[0]) * rh;
  g.fillStyle = '#20232c';
  g.fillRect(0, by, cw, bh);
  for (let x = 0, i = 0; x < cw; x += 192, i++) {
    g.fillStyle = i % 2 ? '#1b5fd1' : '#d8262c';
    g.fillRect(x + 2, by + bh * 0.22, 188, bh * 0.56);
    g.fillStyle = '#ffffff';
    g.font = `italic 900 ${Math.round(bh * 0.42)}px Nunito, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(adText[i % adText.length], x + 96, by + bh * 0.52);
  }
  // upper tier sits in the roof's shade
  const sh = g.createLinearGradient(0, 0, 0, by);
  sh.addColorStop(0, 'rgba(10,12,22,0.55)');
  sh.addColorStop(1, 'rgba(10,12,22,0.12)');
  g.fillStyle = sh;
  g.fillRect(0, 0, cw, by);
  // depth of field: soften
  const crowd = document.createElement('canvas');
  crowd.width = cw;
  crowd.height = ch;
  const cg = crowd.getContext('2d');
  cg.filter = 'blur(0.9px)';
  cg.drawImage(raw, 0, 0);
  cg.filter = 'none';

  // LED boards (red / blue / white panels)
  const ad = document.createElement('canvas');
  ad.width = 2048;
  ad.height = 64;
  const a = ad.getContext('2d');
  const panels = [
    ['#d8262c', '#ffffff'],
    ['#1b5fd1', '#ffffff'],
    ['#ffffff', '#d8262c'],
    ['#11a650', '#ffffff'],
  ];
  for (let i = 0, x = 0; x < 2048; i++, x += 256) {
    const [bg, fg] = panels[i % panels.length];
    const gr = a.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, shade(bg, 0.15));
    gr.addColorStop(1, shade(bg, -0.15));
    a.fillStyle = gr;
    a.fillRect(x, 0, 256, 64);
    a.fillStyle = fg;
    a.font = 'italic 900 34px Nunito, system-ui, sans-serif';
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    a.fillText(adText[i % adText.length], x + 128, 34);
    a.fillStyle = 'rgba(0,0,0,0.25)';
    a.fillRect(x + 254, 0, 2, 64);
  }
  a.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < 64; y += 3) a.fillRect(0, y, 2048, 1);

  // grass texture tile (screen-space detail)
  const grain = document.createElement('canvas');
  grain.width = 160;
  grain.height = 160;
  const gr = grain.getContext('2d');
  for (let n = 0; n < 2600; n++) {
    gr.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,30,0,0.07)';
    gr.fillRect(R() * 160, R() * 160, 1, 1 + R() * 3);
  }
  return { crowd, ad, grain, patterns: {}, flags: makeFlags(homeColor, awayColor) };
}

function makeFlags(home, away) {
  const R = seeded(5);
  const designs = [
    [home, '#ffffff', home],
    ['#ffffff', home, '#ffffff'],
    [home, shade(home, -0.4)],
    ['#ffffff', '#d8262c'],
    [home, '#ffffff'],
  ];
  const flags = [];
  for (let i = 0; i < 9; i++) {
    flags.push({ x: -42 + i * 10.5 + (R() - 0.5) * 4, y: -11 - R() * 14, ph: R() * 6, d: designs[i % designs.length], w: 1.7 + R() * 0.8 });
  }
  void away;
  return flags;
}

// Pitch line quads (world space), built once.
let LINE_QUADS = null;
function lineQuads() {
  if (LINE_QUADS) return LINE_QUADS;
  const q = [];
  const w = 0.065;
  const seg = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = Math.hypot(dx, dy);
    const nx = (-dy / l) * w;
    const ny = (dx / l) * w;
    const n = Math.max(1, Math.ceil(l / 6));
    for (let i = 0; i < n; i++) {
      const a = i / n;
      const b = (i + 1) / n;
      const ax = x1 + dx * a;
      const ay = y1 + dy * a;
      const bx = x1 + dx * b;
      const by = y1 + dy * b;
      q.push([
        [ax + nx, ay + ny, 0],
        [bx + nx, by + ny, 0],
        [bx - nx, by - ny, 0],
        [ax - nx, ay - ny, 0],
      ]);
    }
  };
  const arc = (cx, cy, r, a0, a1, n) => {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      seg(cx + Math.cos(t0) * r, cy + Math.sin(t0) * r, cx + Math.cos(t1) * r, cy + Math.sin(t1) * r);
    }
  };
  const L = HALF_Y * 2;
  seg(-PITCH_X, 0, PITCH_X, 0);
  seg(-PITCH_X, 0, -PITCH_X, L);
  seg(PITCH_X, 0, PITCH_X, L);
  seg(-PITCH_X, HALF_Y, PITCH_X, HALF_Y);
  seg(-BOX_X, 0, -BOX_X, BOX_Y);
  seg(BOX_X, 0, BOX_X, BOX_Y);
  seg(-BOX_X, BOX_Y, BOX_X, BOX_Y);
  seg(-SIX_X, 0, -SIX_X, SIX_Y);
  seg(SIX_X, 0, SIX_X, SIX_Y);
  seg(-SIX_X, SIX_Y, SIX_X, SIX_Y);
  const a = Math.acos((BOX_Y - PEN_Y) / 9.15);
  arc(0, PEN_Y, 9.15, Math.PI / 2 - a, Math.PI / 2 + a, 16);
  arc(0, HALF_Y, 9.15, 0, Math.PI * 2, 40);
  arc(-PITCH_X, 0, 1, 0, Math.PI / 2, 5);
  arc(PITCH_X, 0, 1, Math.PI / 2, Math.PI, 5);
  LINE_QUADS = q;
  return q;
}

// ------------------------------------------------------------------ background
export function drawBackground(g, v, A, fx) {
  const W = v.W;
  const H = v.H;
  const sky = g.createLinearGradient(0, 0, 0, H * 0.5);
  sky.addColorStop(0, '#0d1424');
  sky.addColorStop(1, '#27324a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  const jump = fx.crowdJump || 0;
  const jit = jump ? (j) => Math.sin(fx.t * 17 + j * 1.9) * jump * 2.2 : null;
  const tex = A.crowd;
  // base colour under the stands so tiny gaps between texture cells never show
  g.beginPath();
  if (polyPath(g, v, [
    [-120, -50, 30],
    [120, -50, 30],
    [120, -8, 1.1],
    [-120, -8, 1.1],
  ])) {
    g.fillStyle = '#5a5866';
    g.fill();
  }
  for (const s of [-1, 1]) {
    g.beginPath();
    if (polyPath(g, v, [
      [s * 72, -50, 30],
      [s * 72, 140, 30],
      [s * 40, 140, 1.1],
      [s * 40, -50, 1.1],
    ])) {
      g.fillStyle = '#4f4e5c';
      g.fill();
    }
  }
  // main stand behind the goal: three 60 m tiles
  for (let t = 0; t < 6; t++) {
    const x0 = -108 + t * 36;
    texQuad(g, v, tex, 0, 0, tex.width, tex.height, [x0, -50, 30], [x0 + 36, -50, 30], [x0, -8, 1.1], [x0 + 36, -8, 1.1], 8, 16, jit);
  }
  // side stands
  for (const s of [-1, 1]) {
    for (let t = 0; t < 3; t++) {
      const y0 = -48 + t * 60;
      const xin = s * 40;
      const xout = s * 72;
      if (s < 0) texQuad(g, v, tex, 0, 0, tex.width, tex.height, [xout, y0 + 60, 30], [xout, y0, 30], [xin, y0 + 60, 1.1], [xin, y0, 1.1], 7, 8, jit);
      else texQuad(g, v, tex, 0, 0, tex.width, tex.height, [xout, y0, 30], [xout, y0 + 60, 30], [xin, y0, 1.1], [xin, y0 + 60, 1.1], 7, 8, jit);
    }
  }
  // roof edge + floodlight bars
  g.beginPath();
  if (polyPath(g, v, [
    [-120, -50, 30],
    [120, -50, 30],
    [120, -54, 36],
    [-120, -54, 36],
  ])) {
    g.fillStyle = '#0b0f1a';
    g.fill();
  }
  for (let i = -5; i <= 5; i++) {
    if (!v.p(i * 11, -50.5, 30.6, P0)) continue;
    const r = Math.max(3, P0.k * 0.9);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const lg = g.createRadialGradient(P0.x, P0.y, 0, P0.x, P0.y, r * 9);
    lg.addColorStop(0, 'rgba(255,252,235,0.75)');
    lg.addColorStop(0.2, 'rgba(255,245,210,0.22)');
    lg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = lg;
    g.fillRect(P0.x - r * 9, P0.y - r * 9, r * 18, r * 18);
    g.restore();
    g.fillStyle = '#fffdf2';
    g.fillRect(P0.x - r * 1.6, P0.y - r * 0.4, r * 3.2, r * 0.8);
  }
  // waving flags in the stand
  for (const f of A.flags) drawFlag(g, v, f, fx.t, jump);
}

function drawFlag(g, v, f, t, jump) {
  const z0 = 1.2 + ((-f.y - 8) / 42) * 28.9;
  const pole = 2.6;
  if (!v.p(f.x, f.y, z0, P0) || !v.p(f.x, f.y, z0 + pole, P1)) return;
  if (P1.y > v.H || P0.y < -50) return;
  g.strokeStyle = '#cfcfcf';
  g.lineWidth = Math.max(1, P0.k * 0.05);
  g.beginPath();
  g.moveTo(P0.x, P0.y);
  g.lineTo(P1.x, P1.y);
  g.stroke();
  const n = 8;
  const top = [];
  const bot = [];
  const amp = 0.45 + jump * 0.35;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const wave = Math.sin(t * (4 + jump * 4) + f.ph + u * 5) * amp * u;
    if (!v.p(f.x + u * f.w, f.y + wave, z0 + pole + wave * 0.3, P0)) return;
    top.push({ x: P0.x, y: P0.y });
    if (!v.p(f.x + u * f.w, f.y + wave, z0 + pole - f.w * 0.62 + wave * 0.3, P0)) return;
    bot.push({ x: P0.x, y: P0.y });
  }
  const stripes = f.d.length;
  for (let s = 0; s < stripes; s++) {
    const a = s / stripes;
    const b = (s + 1) / stripes;
    g.beginPath();
    for (let i = 0; i <= n; i++) g.lineTo(top[i].x + (bot[i].x - top[i].x) * a, top[i].y + (bot[i].y - top[i].y) * a);
    for (let i = n; i >= 0; i--) g.lineTo(top[i].x + (bot[i].x - top[i].x) * b, top[i].y + (bot[i].y - top[i].y) * b);
    g.closePath();
    g.fillStyle = f.d[s];
    g.fill();
  }
  // fold shading
  g.beginPath();
  for (let i = 0; i <= n; i++) g.lineTo(top[i].x, top[i].y);
  for (let i = n; i >= 0; i--) g.lineTo(bot[i].x, bot[i].y);
  g.closePath();
  const sh = g.createLinearGradient(top[0].x, top[0].y, top[n].x, top[n].y);
  for (let i = 0; i <= 4; i++) sh.addColorStop(i / 4, `rgba(0,0,0,${0.18 * (0.5 + 0.5 * Math.sin(t * 4 + f.ph + i * 1.25))})`);
  g.fillStyle = sh;
  g.fill();
}

// ------------------------------------------------------------------ pitch
export function drawPitch(g, v, A) {
  const W = v.W;
  const H = v.H;
  // surround (track) and grass
  g.beginPath();
  if (polyPath(g, v, [
    [-40, -8, 0],
    [40, -8, 0],
    [40, 160, 0],
    [-40, 160, 0],
  ])) {
    g.fillStyle = '#2f7a2c';
    g.fill();
  }
  g.beginPath();
  polyPath(g, v, [
    [-PITCH_X - 3, -6, 0],
    [PITCH_X + 3, -6, 0],
    [PITCH_X + 3, 160, 0],
    [-PITCH_X - 3, 160, 0],
  ]);
  g.fillStyle = '#3c9535';
  g.fill();
  // mowing stripes across the pitch
  g.beginPath();
  const band = 5.5;
  for (let i = -1; i * band < 130; i += 2) {
    const ya = Math.max(-6, i * band);
    const yb = (i + 1) * band;
    if (yb <= ya) continue;
    polyPath(g, v, [
      [-PITCH_X - 3, ya, 0],
      [PITCH_X + 3, ya, 0],
      [PITCH_X + 3, yb, 0],
      [-PITCH_X - 3, yb, 0],
    ]);
  }
  g.fillStyle = '#56b74b';
  g.fill();
  // lines + spots
  g.beginPath();
  for (const q of lineQuads()) polyPath(g, v, q);
  for (const [sx, sy, r] of [
    [0, PEN_Y, 0.15],
    [0, HALF_Y, 0.2],
  ]) {
    const ring = [];
    for (let i = 0; i < 12; i++) ring.push([sx + Math.cos((i / 12) * Math.PI * 2) * r, sy + Math.sin((i / 12) * Math.PI * 2) * r, 0]);
    polyPath(g, v, ring);
  }
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fill();
  // corner flags
  for (const s of [-1, 1]) {
    if (!v.p(s * PITCH_X, 0, 0, P0) || !v.p(s * PITCH_X, 0, 1.5, P1)) continue;
    g.strokeStyle = '#f2f2f2';
    g.lineWidth = Math.max(1, P0.k * 0.04);
    g.beginPath();
    g.moveTo(P0.x, P0.y);
    g.lineTo(P1.x, P1.y);
    g.stroke();
    const fw = Math.max(4, P1.k * 0.35);
    g.fillStyle = '#ff3b2f';
    g.fillRect(P1.x, P1.y, fw * -s, fw * 0.7);
    g.fillStyle = '#ffd400';
    g.fillRect(P1.x, P1.y, (fw * -s) / 2, fw * 0.35);
  }
  // LED boards behind the goal and along the touchlines
  const ad = A.ad;
  // only the faces turned toward the camera
  if (v.cy > -6) texQuad(g, v, ad, 0, 0, ad.width, ad.height, [-45, -6, 1.0], [45, -6, 1.0], [-45, -6, 0], [45, -6, 0], 12, 1);
  if (v.cx > -37) texQuad(g, v, ad, 0, 0, ad.width, ad.height, [-37, 60, 1.0], [-37, -6, 1.0], [-37, 60, 0], [-37, -6, 0], 9, 1);
  if (v.cx < 37) texQuad(g, v, ad, 0, 0, ad.width, ad.height, [37, -6, 1.0], [37, 60, 1.0], [37, -6, 0], [37, 60, 0], 9, 1);
  // grass detail
  if (!A.patterns.grain) A.patterns.grain = g.createPattern(A.grain, 'repeat');
  let top = Infinity;
  for (const [x, y] of [
    [-40, -6],
    [40, -6],
    [0, -6],
    [-40, 40],
    [40, 40],
  ]) {
    if (v.p(x, y, 0, P0)) top = Math.min(top, P0.y);
  }
  if (top < H) {
    top = Math.max(0, top);
    g.fillStyle = A.patterns.grain;
    g.fillRect(0, top, W, H - top);
    // aerial haze near the far end, darker close to the camera
    const hz = g.createLinearGradient(0, top, 0, H);
    hz.addColorStop(0, 'rgba(210,235,200,0.16)');
    hz.addColorStop(0.35, 'rgba(255,255,255,0)');
    hz.addColorStop(1, 'rgba(0,25,0,0.22)');
    g.fillStyle = hz;
    g.fillRect(0, top, W, H - top);
  }
}

export function drawLighting(g, v) {
  const W = v.W;
  const H = v.H;
  const lg = g.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  lg.addColorStop(0, 'rgba(255,255,240,0.05)');
  lg.addColorStop(0.6, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ goal + net
function netDisp(fx, x, z) {
  const r = fx.ripple;
  if (!r) return 0;
  const t = r.t;
  const dd = (x - r.x) * (x - r.x) + (z - r.z) * (z - r.z) * 1.4;
  const env = Math.exp(-dd / 1.1);
  if (env < 0.01) return 0;
  return env * (0.7 * Math.exp(-t * 2.2) + 0.3 * Math.sin(t * 15) * Math.exp(-t * 3.2));
}

function netLine(g, v, fx, a, b, n) {
  const rip = !!fx.ripple;
  const steps = rip ? n : 1;
  let first = true;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a[0] + (b[0] - a[0]) * t;
    let y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    if (rip && y < -0.05) y -= netDisp(fx, x, z) * Math.min(1, -y / NET_D);
    if (!v.p(x, y, z, P0)) {
      first = true;
      continue;
    }
    if (first) g.moveTo(P0.x, P0.y);
    else g.lineTo(P0.x, P0.y);
    first = false;
  }
}

const BT = GH - 0.3;

export function drawNet(g, v, fx, part) {
  const step = 0.18;
  g.beginPath();
  if (part === 'back') {
    for (let x = -GW; x <= GW + 1e-6; x += step) netLine(g, v, fx, [x, -NET_D, 0], [x, -NET_D, BT], 8);
    for (let z = step; z <= BT; z += step) netLine(g, v, fx, [-GW, -NET_D, z], [GW, -NET_D, z], 18);
    for (const s of [-1, 1]) {
      for (let y = -NET_D; y <= 0; y += step) {
        const zt = GH + ((BT - GH) * -y) / NET_D;
        netLine(g, v, fx, [s * GW, y, 0], [s * GW, y, zt], 6);
      }
      for (let z = step; z < GH; z += step) {
        const yEnd = z <= BT ? -NET_D : (-NET_D * (GH - z)) / (GH - BT);
        netLine(g, v, fx, [s * GW, 0, z], [s * GW, yEnd, z], 4);
      }
    }
  } else {
    for (let x = -GW; x <= GW + 1e-6; x += step) netLine(g, v, fx, [x, 0, GH], [x, -NET_D, BT], 5);
    for (let y = -step; y >= -NET_D; y -= step) {
      const z = GH + ((BT - GH) * -y) / NET_D;
      netLine(g, v, fx, [-GW, y, z], [GW, y, z], 18);
    }
  }
  const lw = v.p(0, -1, 1, P0) ? Math.max(0.6, P0.k * 0.022) : 1;
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(255,255,255,0.72)';
  g.stroke();
  if (part === 'back') {
    g.beginPath();
    for (const s of [-1, 1]) {
      if (v.p(s * GW, -NET_D, 0, P0) && v.p(s * GW, -NET_D, BT, P1)) {
        g.moveTo(P0.x, P0.y);
        g.lineTo(P1.x, P1.y);
      }
      if (v.p(s * GW, 0, GH, P0) && v.p(s * GW, -NET_D, BT, P1)) {
        g.moveTo(P0.x, P0.y);
        g.lineTo(P1.x, P1.y);
      }
    }
    if (v.p(-GW, -NET_D, BT, P0) && v.p(GW, -NET_D, BT, P1)) {
      g.moveTo(P0.x, P0.y);
      g.lineTo(P1.x, P1.y);
    }
    g.lineWidth = lw * 2.4;
    g.strokeStyle = 'rgba(235,235,240,0.9)';
    g.stroke();
  }
}

export function drawGoalFrame(g, v, fx) {
  const shake = fx.postShake ? Math.sin(fx.t * 70) * fx.postShake * 0.05 : 0;
  const pts = [
    [-GW, 0, 0],
    [-GW, 0, GH],
    [GW, 0, GH],
    [GW, 0, 0],
  ].map(([x, y, z]) => {
    const o = { x: 0, y: 0, d: 0, k: 0 };
    v.p(x + shake, y, z, o);
    return o;
  });
  if (pts.some((p) => !p.k)) return;
  const k = (pts[0].k + pts[3].k) / 2;
  const w = Math.max(2.5, 0.12 * k);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // contact shadow
  g.strokeStyle = 'rgba(0,30,0,0.28)';
  g.lineWidth = w * 1.4;
  g.beginPath();
  g.moveTo(pts[0].x + w, pts[0].y + w * 0.3);
  g.lineTo(pts[3].x + w, pts[3].y + w * 0.3);
  g.stroke();
  const path = (o) => {
    g.beginPath();
    g.moveTo(pts[0].x + o, pts[0].y);
    g.lineTo(pts[1].x + o, pts[1].y + o);
    g.lineTo(pts[2].x + o, pts[2].y + o);
    g.lineTo(pts[3].x + o, pts[3].y);
  };
  path(w * 0.15);
  g.strokeStyle = '#a9adb8';
  g.lineWidth = w;
  g.stroke();
  path(-w * 0.12);
  g.strokeStyle = '#ffffff';
  g.lineWidth = w * 0.62;
  g.stroke();
  g.lineCap = 'butt';
}

export function goalRect(v) {
  const c = [
    [-GW, 0, GH],
    [GW, 0, GH],
    [-GW, 0, 0],
    [GW, 0, 0],
  ];
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let k = 0;
  for (const [x, y, z] of c) {
    if (!v.p(x, y, z, P0)) return null;
    x0 = Math.min(x0, P0.x);
    x1 = Math.max(x1, P0.x);
    y0 = Math.min(y0, P0.y);
    y1 = Math.max(y1, P0.y);
    k = P0.k;
  }
  return { x0, y0, x1, y1, k };
}

// ------------------------------------------------------------------ players
const SKINS = ['#f3cfae', '#e0ac85', '#c48a5e', '#9a6440', '#6e4428', '#f0c29a'];
const HAIRS = ['#1b1410', '#2b1d14', '#4a3020', '#121212', '#6b4a2a', '#d8b46a'];
export function npcLook(seed) {
  const r = seeded(seed * 97 + 13);
  return {
    skin: SKINS[(r() * SKINS.length) | 0],
    hairColor: HAIRS[(r() * HAIRS.length) | 0],
    hair: ['short', 'short', 'buzz', 'curly', 'bald', 'short', 'fringe', 'long'][(r() * 8) | 0],
  };
}

// Draws one figure at its world position. ent: { x, y, anim, moving, pose, poseT, side, kz }
export function drawFigure(g, v, ent, look, opt = {}) {
  if (!v.p(ent.x, ent.y, 0, P0)) return;
  const fx = P0.x;
  const fy = P0.y;
  const boost = Math.max(1, 13 / (P0.k * FIG));
  const k = P0.k * FIG * boost;
  if (!v.p(ent.x, ent.y, 1.85, P1)) return;
  let ux = P1.x - fx;
  let uy = P1.y - fy;
  const ul = Math.hypot(ux, uy) || 1;
  const kh = Math.max((ul / 1.85) * FIG * boost, k * 0.9);
  ux /= ul;
  uy /= ul;
  const dpr = v.dpr;
  const pose = ent.pose || 'idle';
  const t = ent.poseT || 0;
  if (fy < -k * 3 || fy > v.H + k * 2.5 || fx < -k * 2 || fx > v.W + k * 2) return;
  const lift = pose === 'celebrate' ? Math.abs(Math.sin(t * 7)) * 0.3 : pose === 'header' || pose === 'volley' ? Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.45 : 0;

  // soft contact shadow, cast toward the camera-right (floodlights behind)
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sr = k * (0.55 - lift * 0.3);
  const sg = g.createRadialGradient(fx + k * 0.12, fy + k * 0.04, 0, fx + k * 0.12, fy + k * 0.04, sr);
  sg.addColorStop(0, 'rgba(0,20,0,0.42)');
  sg.addColorStop(1, 'rgba(0,20,0,0)');
  g.fillStyle = sg;
  g.beginPath();
  g.ellipse(fx + k * 0.12, fy + k * 0.04, sr, sr * 0.36, 0, 0, Math.PI * 2);
  g.fill();

  const rx = -uy;
  const ry = ux;
  g.setTransform(dpr * rx * k, dpr * ry * k, -dpr * ux * kh, -dpr * uy * kh, dpr * fx, dpr * fy);
  drawBody(g, ent, look, lift);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opt.out) {
    opt.out.x = fx;
    opt.out.y = fy;
    opt.out.hx = fx + ux * 2.05 * kh;
    opt.out.hy = fy + uy * 2.05 * kh;
    opt.out.k = k;
  }
}

// Limb as a round-capped tapered capsule with cylinder shading.
function limb(g, x1, y1, x2, y2, w1, w2, col, dark) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / l;
  const ny = dx / l;
  const a = Math.atan2(dy, dx);
  g.beginPath();
  g.arc(x1, y1, w1, a + Math.PI / 2, a + (Math.PI * 3) / 2);
  g.arc(x2, y2, w2, a - Math.PI / 2, a + Math.PI / 2);
  g.closePath();
  const wm = Math.max(w1, w2);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // light comes from the upper left
  const s = nx < 0 ? 1 : -1;
  const gr = g.createLinearGradient(mx - s * nx * wm, my - s * ny * wm, mx + s * nx * wm, my + s * ny * wm);
  gr.addColorStop(0, col);
  gr.addColorStop(0.45, col);
  gr.addColorStop(1, dark);
  g.fillStyle = gr;
  g.fill();
}

// Body in local meters (X right, Y down, origin at the feet). Caller sets the transform.
export function drawBody(g, ent, look, lift = 0) {
  const pose = ent.pose || 'idle';
  const t = ent.poseT || 0;
  const m = ent.moving || 0;
  const ph = ent.anim || 0;
  const front = !!look.front;
  let rot = 0;
  let oy = -lift;
  let ox = 0;
  if (pose === 'dive') {
    const a = Math.min(1, t / 0.28);
    rot = (ent.side || 1) * a * 1.25;
    oy = -Math.min(1, Math.max(0, (ent.kz || 1) - 0.6)) * a * 0.75;
    ox = (ent.side || 1) * a * 0.4;
  } else if (pose === 'beaten') rot = (ent.side || 1) * 0.12;
  else if (pose === 'tackle') {
    const a = Math.min(1, t / 0.2);
    rot = (ent.side || 1) * a * 0.55;
    oy = a * 0.25;
  } else if (pose === 'kick' && t < 0.45) rot = -0.12 * Math.min(1, t / 0.12);
  g.save();
  g.translate(ox, oy);
  if (rot) {
    g.translate(0, -0.95);
    g.rotate(rot);
    g.translate(0, 0.95);
  }
  const skin = look.skin;
  const skinD = shade(skin, -0.28);
  const shirt = look.shirt;
  const shirtD = shade(shirt, -0.3);
  const shorts = look.shorts;
  const shortsD = shade(shorts, -0.3);
  const socks = look.socks;
  const socksD = shade(socks, -0.3);

  // ---- joints
  const s1 = Math.sin(ph);
  const c1 = Math.cos(ph);
  let hip = -0.93 - Math.abs(c1) * 0.04 * m;
  const hipL = { x: -0.085, y: hip };
  const hipR = { x: 0.085, y: hip };
  let fL = { x: -0.11 - s1 * 0.025 * m, y: -Math.max(0, s1) * 0.3 * m };
  let fR = { x: 0.11 - s1 * 0.025 * m, y: -Math.max(0, -s1) * 0.3 * m };
  let bendL = 0.05 + Math.max(0, s1) * 0.18 * m;
  let bendR = 0.05 + Math.max(0, -s1) * 0.18 * m;
  let shY = -1.47;
  let hL = { x: -0.25, y: -0.97 + s1 * 0.13 * m };
  let hR = { x: 0.25, y: -0.97 - s1 * 0.13 * m };
  let elbowOut = 0.02;
  if (pose === 'kick' && t < 0.45) {
    const a = Math.min(1, t / 0.12);
    fR = { x: 0.06, y: -0.62 * a + 0.05 };
    bendR = 0.02;
    fL = { x: -0.13, y: 0 };
    hL = { x: -0.5, y: -1.28 };
    hR = { x: 0.42, y: -1.1 };
  } else if (pose === 'volley' && t < 0.5) {
    fR = { x: 0.32, y: -0.85 };
    bendR = 0.02;
    hL = { x: -0.55, y: -1.4 };
    hR = { x: 0.5, y: -1.25 };
  } else if (pose === 'header' && t < 0.6) {
    fL = { x: -0.14, y: -0.12 };
    fR = { x: 0.16, y: -0.22 };
    bendL = bendR = 0.12;
    hL = { x: -0.42, y: -1.32 };
    hR = { x: 0.42, y: -1.32 };
  } else if (pose === 'celebrate') {
    hL = { x: -0.42, y: -2.1 };
    hR = { x: 0.42, y: -2.1 };
    elbowOut = 0.12;
  } else if (pose === 'wall') {
    hL = { x: -0.05, y: -0.98 };
    hR = { x: 0.05, y: -0.98 };
    elbowOut = 0.1;
  } else if (pose === 'dive') {
    hL = { x: -0.25, y: -2.05 };
    hR = { x: 0.25, y: -2.05 };
  } else if (pose === 'catch') {
    hL = { x: -0.1, y: -1.32 };
    hR = { x: 0.1, y: -1.32 };
  } else if (pose === 'ready' || look.gloves) {
    hL = { x: -0.4, y: -1.08 };
    hR = { x: 0.4, y: -1.08 };
    bendL = bendR = 0.12;
    hip += 0.05;
    hipL.y = hipR.y = hip;
    shY += 0.05;
  } else if (pose === 'sad') {
    hL = { x: -0.2, y: -1.0 };
    hR = { x: 0.2, y: -1.0 };
  }

  // ---- legs (thigh in shorts color at top, skin, sock, boot)
  const leg = (H, F, bend, side) => {
    const kx = (H.x + F.x) / 2 + side * bend * 0.35;
    const ky = (H.y + F.y) / 2 - bend * 0.4;
    limb(g, H.x, H.y + 0.05, kx, ky, 0.095, 0.064, skin, skinD);
    limb(g, kx, ky, F.x, F.y - 0.07, 0.07, 0.044, skin, skinD);
    // sock from below the knee
    const sx = kx + (F.x - kx) * 0.22;
    const sy = ky + (F.y - 0.07 - ky) * 0.22;
    limb(g, sx, sy, F.x, F.y - 0.08, 0.06, 0.045, socks, socksD);
    // sock stripe
    // boot
    g.fillStyle = look.boots;
    g.beginPath();
    g.ellipse(F.x + (front ? 0 : side * 0.005), F.y - 0.035, 0.062, 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(F.x - 0.02, F.y - 0.055, 0.025, 0.012, 0, 0, Math.PI * 2);
    g.fill();
  };
  leg(hipL, fL, bendL, -1);
  leg(hipR, fR, bendR, 1);

  // ---- shorts
  g.fillStyle = shorts;
  g.beginPath();
  g.moveTo(-0.175, hip - 0.13);
  g.lineTo(0.175, hip - 0.13);
  g.lineTo(0.2, hip + 0.16);
  g.lineTo(0.02, hip + 0.18);
  g.lineTo(0, hip + 0.06);
  g.lineTo(-0.02, hip + 0.18);
  g.lineTo(-0.2, hip + 0.16);
  g.closePath();
  g.fill();
  g.fillStyle = shortsD;
  g.beginPath();
  g.moveTo(0.04, hip - 0.13);
  g.lineTo(0.175, hip - 0.13);
  g.lineTo(0.2, hip + 0.16);
  g.lineTo(0.05, hip + 0.17);
  g.closePath();
  g.fill();
  if (!front && look.num) {
    g.save();
    g.scale(0.01, 0.01);
    g.font = '900 9px Nunito, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = look.numColor || '#fff';
    g.globalAlpha = 0.9;
    g.fillText(String(look.num), 12, (hip + 0.1) * 100);
    g.restore();
  }

  // ---- arms (behind the torso for a back view is not needed: draw after for readability)
  const shL = { x: -0.225, y: shY + 0.05 };
  const shR = { x: 0.225, y: shY + 0.05 };
  const arm = (S, Hh, side) => {
    const ex = (S.x + Hh.x) / 2 + side * elbowOut;
    const ey = (S.y + Hh.y) / 2 + 0.02;
    limb(g, S.x, S.y, ex, ey, 0.064, 0.05, skin, skinD);
    limb(g, ex, ey, Hh.x, Hh.y, 0.05, 0.038, skin, skinD);
    // sleeve
    const mx = S.x + (ex - S.x) * 0.55;
    const my = S.y + (ey - S.y) * 0.55;
    limb(g, S.x, S.y, mx, my, 0.072, 0.062, shirt, shirtD);
    if (look.gloves) {
      g.fillStyle = look.gloves;
      g.beginPath();
      g.arc(Hh.x, Hh.y, 0.06, 0, Math.PI * 2);
      g.fill();
    }
  };

  // ---- torso
  const torso = () => {
    g.beginPath();
    g.moveTo(-0.24, shY + 0.03);
    g.quadraticCurveTo(0, shY - 0.07, 0.24, shY + 0.03);
    g.quadraticCurveTo(0.215, shY + 0.26, 0.17, hip - 0.1);
    g.lineTo(-0.17, hip - 0.1);
    g.quadraticCurveTo(-0.215, shY + 0.26, -0.24, shY + 0.03);
    g.closePath();
  };
  arm(shL, hL, -1);
  arm(shR, hR, 1);
  torso();
  g.fillStyle = shirt;
  g.fill();
  if (look.pattern && look.pattern !== 'plain') {
    g.save();
    torso();
    g.clip();
    g.fillStyle = look.shirt2;
    if (look.pattern === 'stripes') for (let x = -0.21; x < 0.25; x += 0.12) g.fillRect(x, shY - 0.1, 0.055, 0.7);
    else if (look.pattern === 'hoops') for (let y = shY + 0.04; y < hip; y += 0.12) g.fillRect(-0.3, y, 0.6, 0.055);
    else if (look.pattern === 'sash') {
      g.beginPath();
      g.moveTo(-0.3, shY + 0.02);
      g.lineTo(-0.17, shY - 0.05);
      g.lineTo(0.3, hip - 0.12);
      g.lineTo(0.17, hip + 0.02);
      g.closePath();
      g.fill();
    } else if (look.pattern === 'halves') g.fillRect(0, shY - 0.1, 0.4, 0.7);
    else if (look.pattern === 'band') g.fillRect(-0.3, shY + 0.02, 0.6, 0.06);
    g.restore();
  }
  // fabric shading: right side darker, top highlight, folds
  g.save();
  torso();
  g.clip();
  const tg = g.createLinearGradient(-0.22, 0, 0.22, 0);
  tg.addColorStop(0, 'rgba(255,255,255,0.18)');
  tg.addColorStop(0.45, 'rgba(255,255,255,0)');
  tg.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = tg;
  g.fillRect(-0.3, shY - 0.1, 0.6, 0.8);
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 0.012;
  g.beginPath();
  g.moveTo(-0.08, hip - 0.12);
  g.quadraticCurveTo(-0.05, shY + 0.3, -0.1, shY + 0.18);
  g.moveTo(0.1, hip - 0.12);
  g.quadraticCurveTo(0.06, shY + 0.32, 0.12, shY + 0.2);
  g.stroke();
  g.restore();

  if (!front && look.num) {
    g.save();
    g.scale(0.01, 0.01);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = look.numColor || '#fff';
    if (look.name) {
      g.font = '900 6.5px Nunito, system-ui, sans-serif';
      g.fillText(look.name, 0, (shY + 0.11) * 100);
    }
    g.font = '900 24px Nunito, system-ui, sans-serif';
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.strokeText(String(look.num), 0, (shY + 0.3) * 100);
    g.fillText(String(look.num), 0, (shY + 0.3) * 100);
    g.restore();
  } else if (front) {
    // crest + small number + collar
    g.fillStyle = look.shirt2 || '#fff';
    g.beginPath();
    g.arc(-0.09, shY + 0.15, 0.028, 0, Math.PI * 2);
    g.fill();
    if (look.num) {
      g.save();
      g.scale(0.01, 0.01);
      g.font = '900 7px Nunito, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = look.numColor || '#fff';
      g.fillText(String(look.num), 9, (shY + 0.17) * 100);
      g.restore();
    }
  }
  // collar
  g.strokeStyle = look.shirt2 || shirtD;
  g.lineWidth = 0.02;
  g.beginPath();
  if (front) {
    g.moveTo(-0.06, shY - 0.02);
    g.lineTo(0, shY + 0.06);
    g.lineTo(0.06, shY - 0.02);
  } else {
    g.moveTo(-0.07, shY - 0.025);
    g.quadraticCurveTo(0, shY, 0.07, shY - 0.025);
  }
  g.stroke();

  // ---- neck + head
  const hy = -1.68;
  limb(g, 0, shY + 0.02, 0, hy + 0.07, 0.052, 0.05, skin, skinD);
  // back hair mass (front view, voluminous styles)
  if (front && (look.hair === 'afro' || look.hair === 'curly' || look.hair === 'long')) {
    g.fillStyle = look.hairColor;
    g.beginPath();
    if (look.hair === 'long') g.ellipse(0, hy + 0.05, 0.13, 0.17, 0, 0, Math.PI * 2);
    else g.arc(0, hy - 0.04, look.hair === 'afro' ? 0.17 : 0.14, 0, Math.PI * 2);
    g.fill();
  }
  // ears
  g.fillStyle = skinD;
  g.beginPath();
  g.ellipse(-0.1, hy + 0.01, 0.022, 0.035, 0, 0, Math.PI * 2);
  g.ellipse(0.1, hy + 0.01, 0.022, 0.035, 0, 0, Math.PI * 2);
  g.fill();
  // head
  const hgr = g.createRadialGradient(-0.03, hy - 0.04, 0.01, 0, hy, 0.13);
  hgr.addColorStop(0, shade(skin, 0.12));
  hgr.addColorStop(1, skinD);
  g.fillStyle = hgr;
  g.beginPath();
  g.ellipse(0, hy, 0.1, 0.122, 0, 0, Math.PI * 2);
  g.fill();
  if (front) {
    // jaw shading, brows, eyes, nose, mouth
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.beginPath();
    g.ellipse(0, hy + 0.07, 0.07, 0.04, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = shade(look.hairColor, 0.05);
    g.fillRect(-0.06, hy - 0.025, 0.04, 0.012);
    g.fillRect(0.02, hy - 0.025, 0.04, 0.012);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.ellipse(-0.036, hy - 0.002, 0.013, 0.006, 0, 0, Math.PI * 2);
    g.ellipse(0.036, hy - 0.002, 0.013, 0.006, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a1a10';
    g.beginPath();
    g.arc(-0.035, hy - 0.002, 0.0055, 0, Math.PI * 2);
    g.arc(0.037, hy - 0.002, 0.0055, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = skinD;
    g.beginPath();
    g.moveTo(0, hy + 0.0);
    g.lineTo(0.016, hy + 0.04);
    g.lineTo(-0.008, hy + 0.042);
    g.closePath();
    g.fill();
    g.strokeStyle = shade(skin, -0.45);
    g.lineWidth = 0.008;
    g.beginPath();
    g.moveTo(-0.025, hy + 0.068);
    g.quadraticCurveTo(0, hy + 0.077, 0.025, hy + 0.068);
    g.stroke();
  }
  drawHair(g, look, front, hy);
  if (look.beard && front) {
    g.fillStyle = look.hairColor;
    g.globalAlpha = look.beard === 'stubble' ? 0.35 : 0.9;
    g.beginPath();
    g.ellipse(0, hy + 0.07, 0.085, 0.055, 0, 0, Math.PI);
    g.fill();
    g.globalAlpha = 1;
  }
  g.restore();
}

function drawHair(g, look, front, hy) {
  const c = look.hairColor;
  const st = look.hair;
  if (st === 'bald') {
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.beginPath();
    g.ellipse(-0.03, hy - 0.07, 0.035, 0.02, -0.4, 0, Math.PI * 2);
    g.fill();
    return;
  }
  g.fillStyle = c;
  if (st === 'buzz') {
    g.globalAlpha = 0.8;
    g.beginPath();
    g.ellipse(0, hy - 0.02, 0.1, 0.11, 0, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath();
    g.fill();
    if (!front) {
      g.beginPath();
      g.ellipse(0, hy, 0.1, 0.1, 0, 0, Math.PI);
      g.fill();
    }
    g.globalAlpha = 1;
    return;
  }
  // cap
  g.beginPath();
  g.ellipse(0, hy - 0.025, 0.106, 0.118, 0, Math.PI, Math.PI * 2);
  g.closePath();
  g.fill();
  if (!front) {
    g.beginPath();
    g.ellipse(0, hy - 0.005, 0.104, 0.12, 0, 0, Math.PI * 2);
    g.fill();
    // nape fade
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.ellipse(0, hy + 0.07, 0.07, 0.035, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c;
  } else {
    g.fillRect(-0.106, hy - 0.04, 0.025, 0.06);
    g.fillRect(0.081, hy - 0.04, 0.025, 0.06);
  }
  if (st === 'curly' || st === 'afro') {
    const r = st === 'afro' ? 0.17 : 0.135;
    if (!front) {
      g.beginPath();
      g.arc(0, hy - 0.04, r, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.ellipse(0, hy - 0.09, r * 0.95, r * 0.55, 0, Math.PI, 0);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = front ? 3 : 0; i < 7; i++) {
      g.beginPath();
      g.arc(Math.cos(i * 0.95) * r * 0.65, hy - 0.06 + Math.sin(i * 0.95) * r * 0.55, 0.018, 0, Math.PI * 2);
      g.fill();
    }
  } else if (st === 'mohawk') {
    g.beginPath();
    g.moveTo(-0.035, hy - 0.08);
    g.quadraticCurveTo(0, hy - 0.3, 0.05, hy - 0.2);
    g.lineTo(0.035, hy - 0.08);
    g.closePath();
    g.fill();
  } else if (st === 'spiky') {
    g.beginPath();
    for (let i = -2; i <= 2; i++) {
      g.moveTo(i * 0.045 - 0.03, hy - 0.08);
      g.lineTo(i * 0.055, hy - 0.2 + Math.abs(i) * 0.025);
      g.lineTo(i * 0.045 + 0.03, hy - 0.08);
    }
    g.fill();
  } else if (st === 'long') {
    if (!front) {
      g.beginPath();
      g.moveTo(-0.11, hy - 0.02);
      g.quadraticCurveTo(-0.12, hy + 0.22, 0, hy + 0.25);
      g.quadraticCurveTo(0.12, hy + 0.22, 0.11, hy - 0.02);
      g.closePath();
      g.fill();
    } else {
      g.fillRect(-0.12, hy - 0.04, 0.035, 0.2);
      g.fillRect(0.085, hy - 0.04, 0.035, 0.2);
    }
  } else if (st === 'bun') {
    g.beginPath();
    g.arc(0, hy - 0.14, 0.055, 0, Math.PI * 2);
    g.fill();
  } else if (st === 'fringe') {
    g.beginPath();
    g.ellipse(front ? 0.02 : -0.02, hy - 0.085, 0.115, 0.05, front ? -0.3 : 0.3, 0, Math.PI * 2);
    g.fill();
  } else {
    // short: slight quiff
    g.beginPath();
    g.ellipse(0.01, hy - 0.1, 0.09, 0.04, -0.15, Math.PI, Math.PI * 2);
    g.fill();
  }
  const hl = g.createLinearGradient(-0.1, hy - 0.12, 0.1, hy);
  hl.addColorStop(0, 'rgba(255,255,255,0.22)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.beginPath();
  g.ellipse(-0.03, hy - 0.08, 0.06, 0.03, -0.4, 0, Math.PI * 2);
  g.fill();
}

// Full-body render for menus.
export function drawAvatar(g, dpr, cx, cy, scale, look, ent = {}) {
  g.save();
  g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * cx, dpr * cy);
  const sg = g.createRadialGradient(0.05, 0, 0, 0.05, 0, 0.55);
  sg.addColorStop(0, 'rgba(0,0,0,0.45)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sg;
  g.beginPath();
  g.ellipse(0.05, 0.01, 0.55, 0.13, 0, 0, Math.PI * 2);
  g.fill();
  drawBody(g, { pose: 'idle', anim: 0, moving: 0, ...ent }, look, 0);
  g.restore();
}

// ------------------------------------------------------------------ ball
export function drawBallShadow(g, v, b) {
  if (!v.p(b.x, b.y, 0, P0)) return;
  const r = Math.max(2.5, BR * BALL_VIS * P0.k);
  const f = 1 / (1 + b.z * 0.4);
  g.fillStyle = `rgba(0,25,0,${0.4 * f})`;
  g.beginPath();
  g.ellipse(P0.x + r * 0.25, P0.y + r * 0.05, r * 1.15 * f + 1, r * 0.42 * f + 0.5, 0, 0, Math.PI * 2);
  g.fill();
}

export function drawBall(g, v, b, vel) {
  if (!v.p(b.x, b.y, b.z * 0.95 + BR * (BALL_VIS - 1), P0)) return;
  const r = Math.max(3.6, BR * BALL_VIS * P0.k);
  const x = P0.x;
  const y = P0.y;
  // motion blur: ghost copies along the screen velocity
  if (vel && (vel.x || vel.y)) {
    const sp = Math.hypot(vel.x, vel.y);
    if (sp > r * 1.2) {
      const n = 5;
      for (let i = n; i >= 1; i--) {
        const f = i / n;
        g.fillStyle = `rgba(255,255,255,${0.12 * (1 - f) + 0.04})`;
        g.beginPath();
        g.arc(x - vel.x * f * 0.9, y - vel.y * f * 0.9, r * (1 - f * 0.25), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.65, '#ececf2');
  grd.addColorStop(1, '#9fa3b0');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  const sp = b.spin || 0;
  for (let i = 0; i < 4; i++) {
    const a = sp + i * 1.57;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(sp * 0.7 + i * 1.9) * r * 0.5;
    g.fillStyle = i % 2 ? '#1b1c22' : '#d8262c';
    g.beginPath();
    for (let j = 0; j < 5; j++) {
      const aa = a + (j * Math.PI * 2) / 5;
      const qx = px + Math.cos(aa) * r * 0.27;
      const qy = py + Math.sin(aa) * r * 0.27;
      if (j) g.lineTo(qx, qy);
      else g.moveTo(qx, qy);
    }
    g.closePath();
    g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  return { x, y, r };
}

// ------------------------------------------------------------------ ground marks
export function groundEllipse(g, v, x, y, r, fill, stroke, lw = 2) {
  if (!v.p(x, y, 0, P0)) return null;
  g.beginPath();
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (!v.p(x + Math.cos(a) * r, y + Math.sin(a) * r, 0, P1)) return null;
    if (i) g.lineTo(P1.x, P1.y);
    else g.moveTo(P1.x, P1.y);
  }
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
  return { x: P0.x, y: P0.y, k: P0.k };
}

// Dotted white path on the grass (runs, previews), dots scaled by depth.
export function groundDots(g, v, pts, color = 'rgba(255,255,255,0.92)', spacing = 0.55, t = 0) {
  let acc = (t * 2) % spacing;
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const q = pts[i];
    const seg = Math.hypot(q.x - prev.x, q.y - prev.y);
    while (acc <= seg) {
      const f = seg ? acc / seg : 0;
      const x = prev.x + (q.x - prev.x) * f;
      const y = prev.y + (q.y - prev.y) * f;
      const z = (prev.z || 0) + ((q.z || 0) - (prev.z || 0)) * f;
      if (v.p(x, y, z, P2)) {
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(P2.x, P2.y, Math.max(1.4, P2.k * 0.09), Math.max(1, P2.k * 0.05), 0, 0, Math.PI * 2);
        g.fill();
      }
      acc += spacing;
    }
    acc -= seg;
    prev = q;
  }
}

export function groundArrow(g, v, x1, y1, x2, y2, color, t) {
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push({ x: x1 + ((x2 - x1) * i) / 12, y: y1 + ((y2 - y1) * i) / 12 });
  groundDots(g, v, pts.slice(0, -1), color, 0.6, t);
  // arrow head on the ground
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const tri = [
    [x2 + ux * 0.6, y2 + uy * 0.6, 0],
    [x2 - uy * 0.55 - ux * 0.3, y2 + ux * 0.55 - uy * 0.3, 0],
    [x2 + uy * 0.55 - ux * 0.3, y2 - ux * 0.55 - uy * 0.3, 0],
  ];
  g.beginPath();
  if (polyPath(g, v, tri)) {
    g.fillStyle = color;
    g.fill();
  }
}

// Bright glowing stroke through screen points with an arrow head.
export function goldStroke(g, pts, alpha = 1, width = 1) {
  if (pts.length < 2) return;
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      g.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  path();
  g.strokeStyle = `rgba(255,200,40,${0.22 * alpha})`;
  g.lineWidth = 22 * width;
  g.stroke();
  g.strokeStyle = `rgba(255,230,90,${0.5 * alpha})`;
  g.lineWidth = 11 * width;
  g.stroke();
  g.strokeStyle = `rgba(255,255,255,${alpha})`;
  g.lineWidth = 5 * width;
  g.stroke();
  // arrow head
  const a = pts[Math.max(0, pts.length - 4)];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const s = 16 * width;
  g.fillStyle = `rgba(255,255,255,${alpha})`;
  g.strokeStyle = `rgba(255,200,40,${0.8 * alpha})`;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(b.x + Math.cos(ang) * s * 0.7, b.y + Math.sin(ang) * s * 0.7);
  g.lineTo(b.x + Math.cos(ang + 2.4) * s, b.y + Math.sin(ang + 2.4) * s);
  g.lineTo(b.x + Math.cos(ang - 2.4) * s, b.y + Math.sin(ang - 2.4) * s);
  g.closePath();
  g.stroke();
  g.fill();
}

// Glossy floating gold star (targets / objectives).
export function drawStar(g, x, y, r, t = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(t * 2) * 0.12);
  const glow = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2);
  glow.addColorStop(0, 'rgba(255,240,150,0.55)');
  glow.addColorStop(1, 'rgba(255,240,150,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 2, 0, Math.PI * 2);
  g.fill();
  const star = (rad) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr2 = i % 2 ? rad * 0.48 : rad;
      g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    g.closePath();
  };
  star(r);
  g.fillStyle = '#c98a00';
  g.fill();
  star(r * 0.86);
  const sg = g.createLinearGradient(0, -r, 0, r);
  sg.addColorStop(0, '#fff7a8');
  sg.addColorStop(0.5, '#ffd21f');
  sg.addColorStop(1, '#f0a400');
  g.fillStyle = sg;
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(-r * 0.2, -r * 0.35, r * 0.28, r * 0.12, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export { FIG };
