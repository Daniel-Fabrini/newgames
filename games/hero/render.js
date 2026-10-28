// Ball Hero — pseudo-3D broadcast renderer (Canvas 2D).
// A pinhole camera behind/above the attacking team looks down the pitch
// toward the goal (-y). Everything is projected from world meters.

import { GW, GH, NET_D, PITCH_X, HALF_Y, BOX_X, BOX_Y, SIX_X, SIX_Y, PEN_Y, BR } from './sim.js';

const FIG = 1.55; // players are drawn bigger than life so they read on a phone
const BALL_VIS = 2.5;

export class View {
  constructor() {
    this.W = 390;
    this.H = 700;
    this.dpr = 1;
    this.fov = (46 * Math.PI) / 180;
    this.F = 600;
    this.H0 = 350;
    this.cx = 0;
    this.cy = 60;
    this.cz = 25;
    this.setPitch(0.6);
  }
  setPitch(th) {
    this.th = th;
    this.ct = Math.cos(th);
    this.st = Math.sin(th);
  }
  resize(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.F = H / (2 * Math.tan(this.fov / 2));
    // wide screens: keep a sensible focal length
    this.F = Math.min(this.F, Math.max(W, H) * 2.2);
    this.H0 = H * 0.5;
  }
  setCam(tx, ty, dist) {
    this.tx = tx;
    this.ty = ty;
    this.dist = dist;
    this.cx = tx;
    this.cy = ty + dist * this.ct;
    this.cz = dist * this.st;
  }
  depth(y, z) {
    return (this.cy - y) * this.ct + (this.cz - z) * this.st;
  }
  // projects into `o` = { x, y, d (depth), k (px per meter) }; returns false behind the camera
  p(x, y, z, o) {
    const dy = this.cy - y;
    const d = dy * this.ct + (this.cz - z) * this.st;
    if (d < 0.2) {
      o.d = d;
      return false;
    }
    const up = dy * this.st + (z - this.cz) * this.ct;
    const k = this.F / d;
    o.x = this.W / 2 + (x - this.cx) * k;
    o.y = this.H0 - up * k;
    o.d = d;
    o.k = k;
    return true;
  }
  // screen → ground point (z = 0)
  ground(sx, sy) {
    const a = (sx - this.W / 2) / this.F;
    const b = (this.H0 - sy) / this.F;
    const dz = this.st - b * this.ct;
    if (dz <= 1e-4) return null;
    const t = this.cz / dz;
    return { x: this.cx + t * a, y: this.cy - t * (this.ct + b * this.st) };
  }
  // screen → goal-mouth plane (y = 0)
  goalPlane(sx, sy) {
    const a = (sx - this.W / 2) / this.F;
    const b = (this.H0 - sy) / this.F;
    const dy = this.ct + b * this.st;
    if (dy <= 1e-4) return null;
    const t = this.cy / dy;
    return { x: this.cx + t * a, z: this.cz + t * (b * this.ct - this.st) };
  }
}

// ------------------------------------------------------------------ helpers
const P0 = { x: 0, y: 0, d: 0, k: 0 };
const P1 = { x: 0, y: 0, d: 0, k: 0 };

// Draws a world polygon (array of [x,y,z]) clipped against the near plane.
function polyPath(g, v, pts) {
  const near = 0.5;
  const cam = pts.map(([x, y, z]) => ({ x, y, z, d: v.depth(y, z) }));
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

export function shade(hex, f) {
  // f < 0 darkens, f > 0 lightens
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

// ------------------------------------------------------------------ static assets
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

export function makeAssets(homeColor, awayColor, adText) {
  const R = seeded(7);
  // crowd texture (behind the goal): one 60 m wide tile, ~0.5 m per fan
  const cw = 2048;
  const ch = 512;
  const crowd = document.createElement('canvas');
  crowd.width = cw;
  crowd.height = ch;
  const g = crowd.getContext('2d');
  g.fillStyle = '#0a0a10';
  g.fillRect(0, 0, cw, ch);
  const palette = [homeColor, homeColor, homeColor, homeColor, '#e9e9ee', '#c9c9d2', '#2a2a33', '#3b3b46', '#55556a', awayColor, '#d9b24a'];
  const skins = ['#e9c3a0', '#cf9a72', '#a87048', '#74492e', '#e2b28a'];
  const rows = 48;
  const rh = ch / rows;
  const band0 = 21;
  const band1 = 24;
  for (let r = 0; r < rows; r++) {
    const y = (r + 1) * rh;
    if (r >= band0 && r < band1) continue;
    // seat-row step shading
    g.fillStyle = r % 2 ? '#0d0d14' : '#101018';
    g.fillRect(0, y - rh, cw, rh);
    const depthLight = 0.45 + 0.55 * (r / rows);
    for (let x = 4 + (r % 2) * 8; x < cw; x += 17) {
      if (x % 341 < 14) continue; // aisle
      if (R() < 0.06) continue; // empty seat
      const col = palette[(R() * palette.length) | 0];
      const jx = x + (R() - 0.5) * 4;
      g.globalAlpha = 0.5 + 0.5 * depthLight;
      g.fillStyle = col;
      rr(g, jx - 6, y - rh * 0.62, 12, rh * 0.62, 3);
      g.fill();
      g.fillStyle = skins[(R() * skins.length) | 0];
      g.beginPath();
      g.arc(jx, y - rh * 0.72, rh * 0.26, 0, Math.PI * 2);
      g.fill();
      if (R() < 0.07) {
        // scarf held up
        g.fillStyle = col === homeColor ? '#ffffff' : homeColor;
        g.fillRect(jx - 9, y - rh * 1.1, 18, 2.5);
      }
    }
  }
  g.globalAlpha = 1;
  // aisles (stairs)
  for (let x = 0; x < cw; x += 341) {
    g.fillStyle = '#26262e';
    g.fillRect(x + 1, 0, 11, ch);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < ch; y += rh) g.fillRect(x + 1, y, 11, 1);
  }
  // tier band with an LED ribbon
  const by0 = band0 * rh;
  const bh = (band1 - band0) * rh;
  const bgd = g.createLinearGradient(0, by0, 0, by0 + bh);
  bgd.addColorStop(0, '#1b1b22');
  bgd.addColorStop(1, '#0b0b10');
  g.fillStyle = bgd;
  g.fillRect(0, by0, cw, bh);
  const led = g.createLinearGradient(0, by0 + bh * 0.35, 0, by0 + bh * 0.75);
  led.addColorStop(0, '#fff2b8');
  led.addColorStop(1, '#c98a10');
  g.fillStyle = led;
  g.fillRect(0, by0 + bh * 0.4, cw, bh * 0.28);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  for (let x = 0; x < cw; x += 6) g.fillRect(x, by0 + bh * 0.4, 1, bh * 0.28);
  // haze: back rows darker
  const sh = g.createLinearGradient(0, 0, 0, ch);
  sh.addColorStop(0, 'rgba(0,0,4,0.7)');
  sh.addColorStop(0.45, 'rgba(0,0,4,0.35)');
  sh.addColorStop(1, 'rgba(0,0,0,0.1)');
  g.fillStyle = sh;
  g.fillRect(0, 0, cw, ch);

  // small crowd pattern for side stands
  const side = document.createElement('canvas');
  side.width = 96;
  side.height = 64;
  const s = side.getContext('2d');
  s.fillStyle = '#0d0d13';
  s.fillRect(0, 0, 96, 64);
  for (let y = 6; y < 64; y += 8) {
    for (let x = (y / 8) % 2 ? 3 : 7; x < 96; x += 8) {
      s.fillStyle = palette[(R() * palette.length) | 0];
      s.globalAlpha = 0.5;
      s.fillRect(x - 2.5, y - 1, 5, 4);
      s.globalAlpha = 0.6;
      s.fillStyle = skins[(R() * skins.length) | 0];
      s.beginPath();
      s.arc(x, y - 3, 1.7, 0, 7);
      s.fill();
    }
  }
  s.globalAlpha = 1;

  // LED ad board strip
  const ad = document.createElement('canvas');
  ad.width = 1024;
  ad.height = 48;
  const a = ad.getContext('2d');
  const ag = a.createLinearGradient(0, 0, 0, 48);
  ag.addColorStop(0, '#16120a');
  ag.addColorStop(1, '#050505');
  a.fillStyle = ag;
  a.fillRect(0, 0, 1024, 48);
  a.font = '900 26px Nunito, system-ui, sans-serif';
  a.textBaseline = 'middle';
  const words = adText;
  let x = 10;
  let i = 0;
  while (x < 1024) {
    const wd = words[i % words.length];
    const gold = i % 2 === 0;
    const tg = a.createLinearGradient(0, 10, 0, 38);
    tg.addColorStop(0, gold ? '#fff1b0' : '#ffffff');
    tg.addColorStop(1, gold ? '#d99a18' : '#c9c9d4');
    a.fillStyle = tg;
    a.fillText(wd, x, 25);
    x += a.measureText(wd).width + 26;
    a.fillStyle = '#f3c24a';
    a.beginPath();
    a.arc(x - 13, 25, 3, 0, 7);
    a.fill();
    i++;
  }
  a.fillStyle = 'rgba(255,255,255,0.06)';
  for (let yy = 0; yy < 48; yy += 3) a.fillRect(0, yy, 1024, 1);

  // grass grain (screen-space overlay)
  const grain = document.createElement('canvas');
  grain.width = 128;
  grain.height = 128;
  const gr = grain.getContext('2d');
  for (let n = 0; n < 1400; n++) {
    gr.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    gr.fillRect(R() * 128, R() * 128, 1 + R() * 1.5, 1 + R() * 2.5);
  }

  return { crowd, side, ad, grain, patterns: {} };
}

// Pitch line quads (world space), built once.
let LINE_QUADS = null;
function lineQuads() {
  if (LINE_QUADS) return LINE_QUADS;
  const q = [];
  const w = 0.07;
  const seg = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = Math.hypot(dx, dy);
    const nx = (-dy / l) * w;
    const ny = (dx / l) * w;
    // split long segments so near-plane clipping stays accurate
    const n = Math.max(1, Math.ceil(l / 12));
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
  // penalty box
  seg(-BOX_X, 0, -BOX_X, BOX_Y);
  seg(BOX_X, 0, BOX_X, BOX_Y);
  seg(-BOX_X, BOX_Y, BOX_X, BOX_Y);
  seg(-SIX_X, 0, -SIX_X, SIX_Y);
  seg(SIX_X, 0, SIX_X, SIX_Y);
  seg(-SIX_X, SIX_Y, SIX_X, SIX_Y);
  // penalty arc (outside the box only)
  const a = Math.acos((BOX_Y - PEN_Y) / 9.15);
  arc(0, PEN_Y, 9.15, Math.PI / 2 - a, Math.PI / 2 + a, 12);
  arc(0, HALF_Y, 9.15, 0, Math.PI * 2, 28);
  // penalty spot + center spot
  arc(0, PEN_Y, 0.12, 0, Math.PI * 2, 6);
  arc(0, HALF_Y, 0.15, 0, Math.PI * 2, 6);
  // corner arcs
  arc(-PITCH_X, 0, 1, 0, Math.PI / 2, 4);
  arc(PITCH_X, 0, 1, Math.PI / 2, Math.PI, 4);
  // far-side box (other half) for completeness
  seg(-BOX_X, L, -BOX_X, L - BOX_Y);
  seg(BOX_X, L, BOX_X, L - BOX_Y);
  seg(-BOX_X, L - BOX_Y, BOX_X, L - BOX_Y);
  LINE_QUADS = q;
  return q;
}

// ------------------------------------------------------------------ scene
export function drawBackground(g, v, A, fx) {
  const W = v.W;
  const H = v.H;
  // sky
  const sky = g.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#05060c');
  sky.addColorStop(1, '#10131f');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // stand behind the goal: a sloped plane rendered in strips, tiled every 30 m
  const strips = 16;
  const y0 = -7.5;
  const y1 = -46;
  const z0 = 1.2;
  const z1 = 24;
  const tex = A.crowd;
  const jump = fx.crowdJump || 0;
  const tileM = 60;
  for (let i = 0; i < strips; i++) {
    const ua = i / strips;
    const ub = (i + 1) / strips;
    const ya = y0 + (y1 - y0) * ua;
    const za = z0 + (z1 - z0) * ua;
    const yb = y0 + (y1 - y0) * ub;
    const zb = z0 + (z1 - z0) * ub;
    if (!v.p(-60, ya, za, P0) || !v.p(-60, yb, zb, P1)) continue;
    const top = P1.y;
    const bot = P0.y;
    if (bot < -40 || top > H) continue;
    const k = (P0.k + P1.k) / 2;
    const xL = v.W / 2 + (-60 - v.cx) * k;
    const tw = tileM * k;
    const sy = (tex.height * (strips - 1 - i)) / strips;
    const jy = jump ? Math.sin(fx.t * 18 + i * 1.7) * jump * (bot - top) * 0.14 : 0;
    const first = Math.max(0, Math.floor(-xL / tw));
    for (let tI = first; tI < 2; tI++) {
      const x = xL + tI * tw;
      if (x > W) break;
      g.drawImage(tex, 0, sy, tex.width, tex.height / strips, x, top + jy, tw + 0.5, bot - top + 1);
    }
  }
  // camera flashes during celebrations
  if (jump > 0.05 && v.p(0, -20, 10, P0)) {
    const n = Math.round(jump * 14);
    for (let i = 0; i < n; i++) {
      const fxp = (Math.sin(fx.t * 31 + i * 12.9898) * 43758.5453) % 1;
      const fyp = (Math.sin(fx.t * 17 + i * 78.233) * 12543.123) % 1;
      const x = Math.abs(fxp) * W;
      const y = P0.y - Math.abs(fyp) * P0.k * 14;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  // roof edge
  if (v.p(0, y1, z1, P0)) {
    const ry = P0.y;
    if (ry > -20) {
      g.fillStyle = '#030305';
      g.fillRect(0, 0, W, ry + 1);
      const rg = g.createLinearGradient(0, ry - 14, 0, ry + 4);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(243,194,74,0.18)');
      g.fillStyle = rg;
      g.fillRect(0, ry - 14, W, 18);
      g.fillStyle = 'rgba(255,236,180,0.5)';
      g.fillRect(0, ry, W, Math.max(1, P0.k * 0.15));
    }
  }

  // side stands (x = ±40 … ±75), pattern-filled
  if (!A.patterns.side) A.patterns.side = g.createPattern(A.side, 'repeat');
  for (const s of [-1, 1]) {
    g.beginPath();
    if (polyPath(g, v, [
      [s * 39, -46, 1],
      [s * 39, 140, 1],
      [s * 75, 140, 26],
      [s * 75, -46, 26],
    ])) {
      g.fillStyle = A.patterns.side;
      g.fill();
      g.fillStyle = 'rgba(5,5,10,0.45)';
      g.fill();
    }
  }
  // floodlights
  for (const s of [-1, 1]) {
    if (!v.p(s * 52, -50, 38, P0)) continue;
    const r = Math.max(50, P0.k * 26);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const lg = g.createRadialGradient(P0.x, P0.y, 0, P0.x, P0.y, r * 2.4);
    lg.addColorStop(0, 'rgba(255,248,220,0.55)');
    lg.addColorStop(0.15, 'rgba(255,230,170,0.22)');
    lg.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = lg;
    g.fillRect(P0.x - r * 2.4, P0.y - r * 2.4, r * 4.8, r * 4.8);
    g.restore();
    // lamp panel
    const pw = Math.max(10, P0.k * 7);
    const ph = pw * 0.45;
    g.fillStyle = '#fffbe8';
    g.shadowColor = 'rgba(255,240,200,0.9)';
    g.shadowBlur = 16;
    rr(g, P0.x - pw / 2, P0.y - ph / 2, pw, ph, 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(200,190,160,0.6)';
    for (let i = 1; i < 4; i++) g.fillRect(P0.x - pw / 2 + (pw * i) / 4, P0.y - ph / 2, 1, ph);
  }
}

export function drawPitch(g, v, A, fx) {
  const W = v.W;
  const H = v.H;
  // surroundings (track + grass beyond the lines)
  g.beginPath();
  if (polyPath(g, v, [
    [-39, -7.5, 0],
    [39, -7.5, 0],
    [39, 160, 0],
    [-39, 160, 0],
  ])) {
    g.fillStyle = '#1d5a2a';
    g.fill();
  }
  // pitch base
  g.beginPath();
  polyPath(g, v, [
    [-PITCH_X - 2.5, -4.8, 0],
    [PITCH_X + 2.5, -4.8, 0],
    [PITCH_X + 2.5, 160, 0],
    [-PITCH_X - 2.5, 160, 0],
  ]);
  g.fillStyle = '#2f8f3c';
  g.fill();
  // mowing stripes (bands across the pitch)
  const band = 5.25;
  g.beginPath();
  const yMax = Math.min(160, v.cy);
  for (let i = -1; i * band < yMax; i += 2) {
    const ya = Math.max(-4.8, i * band);
    const yb = (i + 1) * band;
    if (yb <= ya) continue;
    polyPath(g, v, [
      [-PITCH_X - 2.5, ya, 0],
      [PITCH_X + 2.5, ya, 0],
      [PITCH_X + 2.5, yb, 0],
      [-PITCH_X - 2.5, yb, 0],
    ]);
  }
  g.fillStyle = '#3aa047';
  g.fill();
  // subtle lengthwise stripes for a checkered cut
  g.beginPath();
  for (let i = -4; i < 4; i += 2) {
    polyPath(g, v, [
      [i * 8.5, -4.8, 0],
      [(i + 1) * 8.5, -4.8, 0],
      [(i + 1) * 8.5, yMax, 0],
      [i * 8.5, yMax, 0],
    ]);
  }
  g.fillStyle = 'rgba(255,255,255,0.035)';
  g.fill();
  // lines
  g.beginPath();
  for (const q of lineQuads()) polyPath(g, v, q);
  g.fillStyle = 'rgba(255,255,255,0.86)';
  g.fill();

  // ad boards behind the goal (vertical plane at y = -5)
  if (v.p(-30, -5, 0.95, P0) && v.p(30, -5, 0, P1)) {
    g.drawImage(A.ad, P0.x, P0.y, P1.x - P0.x, P1.y - P0.y);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(P0.x, P1.y, P1.x - P0.x, Math.max(1, (P1.y - P0.y) * 0.18));
  }
  // side boards
  for (const s of [-1, 1]) {
    g.beginPath();
    if (polyPath(g, v, [
      [s * 37.5, -5, 0],
      [s * 37.5, -5, 0.95],
      [s * 37.5, 140, 0.95],
      [s * 37.5, 140, 0],
    ])) {
      g.fillStyle = '#0b0b0e';
      g.fill();
      g.strokeStyle = 'rgba(243,194,74,0.55)';
      g.lineWidth = 1.2;
      g.stroke();
    }
  }

  // grain + lighting
  if (!A.patterns.grain) A.patterns.grain = g.createPattern(A.grain, 'repeat');
  g.fillStyle = A.patterns.grain;
  g.globalAlpha = 0.8;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  void fx;
}

export function drawLighting(g, v) {
  const W = v.W;
  const H = v.H;
  // floodlit pool + vignette
  const lg = g.createRadialGradient(W * 0.5, H * 0.38, 10, W * 0.5, H * 0.45, Math.max(W, H) * 0.85);
  lg.addColorStop(0, 'rgba(255,250,225,0.07)');
  lg.addColorStop(0.55, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.5)');
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
  return env * (0.65 * Math.exp(-t * 2.2) + 0.28 * Math.sin(t * 15) * Math.exp(-t * 3.2));
}

function netLine(g, v, fx, a, b, n) {
  // a, b: [x,y,z]; subdivided so the ripple can bend it
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

const BT = GH - 0.35; // back top of the net

export function drawNet(g, v, fx, part) {
  g.beginPath();
  if (part === 'back') {
    // back panel
    for (let x = -GW; x <= GW + 1e-6; x += GW / 11) netLine(g, v, fx, [x, -NET_D, 0], [x, -NET_D, BT], 8);
    for (let z = 0.3; z <= BT; z += 0.3) netLine(g, v, fx, [-GW, -NET_D, z], [GW, -NET_D, z], 16);
    // side panels
    for (const s of [-1, 1]) {
      for (let y = -NET_D; y <= 0; y += NET_D / 6) {
        const zt = GH + ((BT - GH) * -y) / NET_D;
        netLine(g, v, fx, [s * GW, y, 0], [s * GW, y, zt], 6);
      }
      for (let z = 0.3; z < GH; z += 0.3) {
        const yEnd = z <= BT ? -NET_D : (-NET_D * (GH - z)) / (GH - BT);
        netLine(g, v, fx, [s * GW, 0, z], [s * GW, yEnd, z], 4);
      }
    }
  } else {
    // roof
    for (let x = -GW; x <= GW + 1e-6; x += GW / 11) netLine(g, v, fx, [x, 0, GH], [x, -NET_D, BT], 5);
    for (let y = -NET_D / 4; y >= -NET_D; y -= NET_D / 4) {
      const z = GH + ((BT - GH) * -y) / NET_D;
      netLine(g, v, fx, [-GW, y, z], [GW, y, z], 16);
    }
  }
  const lw = v.p(0, -1, 1, P0) ? Math.max(0.6, P0.k * 0.025) : 1;
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(240,240,248,0.5)';
  g.stroke();
  if (part === 'back') {
    // back stanchions
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
    g.lineWidth = lw * 2;
    g.strokeStyle = 'rgba(220,220,230,0.65)';
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
  const k = (pts[0].k + pts[3].k) / 2;
  const w = Math.max(2, 0.12 * k);
  // shadow on the grass
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(pts[0].x + w * 0.6, pts[0].y + w * 0.2);
  g.lineTo(pts[3].x + w * 0.6, pts[3].y + w * 0.2);
  g.stroke();
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  g.lineTo(pts[1].x, pts[1].y);
  g.lineTo(pts[2].x, pts[2].y);
  g.lineTo(pts[3].x, pts[3].y);
  g.strokeStyle = '#d7d9e2';
  g.lineWidth = w;
  g.stroke();
  g.strokeStyle = '#ffffff';
  g.lineWidth = w * 0.5;
  g.beginPath();
  g.moveTo(pts[0].x - w * 0.15, pts[0].y);
  g.lineTo(pts[1].x - w * 0.15, pts[1].y - w * 0.15);
  g.lineTo(pts[2].x - w * 0.15, pts[2].y - w * 0.15);
  g.lineTo(pts[3].x - w * 0.15, pts[3].y);
  g.stroke();
  g.lineCap = 'butt';
}

// Screen rectangle of the goal mouth (used for input).
export function goalRect(v) {
  const a = { x: 0, y: 0, d: 0, k: 0 };
  const b = { x: 0, y: 0, d: 0, k: 0 };
  if (!v.p(-GW, 0, GH, a) || !v.p(GW, 0, 0, b)) return null;
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y, k: b.k };
}

// ------------------------------------------------------------------ players
const SKINS = ['#f3cfae', '#e0ac85', '#c48a5e', '#9a6440', '#6e4428', '#f0c29a'];
const HAIRS = ['#1b1410', '#2b1d14', '#4a3020', '#121212', '#6b4a2a', '#d8b46a'];
export function npcLook(seed) {
  const r = seeded(seed * 97 + 13);
  return {
    skin: SKINS[(r() * SKINS.length) | 0],
    hairColor: HAIRS[(r() * HAIRS.length) | 0],
    hair: ['short', 'short', 'buzz', 'curly', 'bald', 'short', 'long'][(r() * 7) | 0],
  };
}

// Draws one figure. ent: { x, y, z?, anim, moving, pose, poseT, side }
// look: { shirt, shirt2, shorts, socks, boots, skin, hair, hairColor, num, pattern, gloves, front }
export function drawFigure(g, v, ent, look, opt = {}) {
  if (!v.p(ent.x, ent.y, 0, P0)) return;
  const fx = P0.x;
  const fy = P0.y;
  const k = P0.k * FIG;
  if (!v.p(ent.x, ent.y, 1.8, P1)) return;
  let ux = P1.x - fx;
  let uy = P1.y - fy;
  const ul = Math.hypot(ux, uy) || 1;
  // billboard: never squash figures much under steep cameras
  const kh = Math.max((ul / 1.8) * FIG, k * 0.86);
  ux /= ul;
  uy /= ul;
  const dpr = v.dpr;
  const pose = ent.pose || 'idle';
  const t = ent.poseT || 0;
  const m = ent.moving || 0;
  const ph = ent.anim || 0;

  // shadow (ground space)
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lift = pose === 'celebrate' ? Math.abs(Math.sin(t * 7)) * 0.35 : pose === 'header' || pose === 'volley' ? Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.4 : 0;
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath();
  g.ellipse(fx + k * 0.12, fy + k * 0.05, k * (0.42 - lift * 0.3), k * 0.15, 0, 0, Math.PI * 2);
  g.fill();

  // local frame: X right (m), Y down (m), origin at the feet
  const rx = -uy;
  const ry = ux;
  g.setTransform(dpr * rx * k, dpr * ry * k, -dpr * ux * kh, -dpr * uy * kh, dpr * fx, dpr * fy);

  let rot = 0;
  let oy = -lift;
  let ox = 0;
  if (pose === 'dive') {
    const a = Math.min(1, t / 0.28);
    rot = (ent.side || 1) * a * 1.2;
    oy = -Math.min(1, Math.max(0, (ent.kz || 1) - 0.6)) * a * 0.7;
    ox = (ent.side || 1) * a * 0.35;
  } else if (pose === 'beaten') {
    rot = (ent.side || 1) * 0.15;
  } else if (pose === 'tackle') {
    const a = Math.min(1, t / 0.2);
    rot = (ent.side || 1) * a * 0.5;
    oy = a * 0.25;
  }
  g.translate(ox, oy);
  if (rot) {
    g.translate(0, -0.9);
    g.rotate(rot);
    g.translate(0, 0.9);
  }

  const front = !!look.front;
  const outline = 'rgba(0,0,0,0.35)';
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // --- legs
  const run = m;
  const s1 = Math.sin(ph);
  let fL = { x: -0.13, y: 0 };
  let fR = { x: 0.13, y: 0 };
  fL.y = -Math.max(0, s1) * 0.24 * run - 0.04 * run;
  fR.y = -Math.max(0, -s1) * 0.24 * run - 0.04 * run;
  fL.x -= s1 * 0.03 * run;
  fR.x -= s1 * 0.03 * run;
  let hipY = -0.92 - Math.abs(Math.cos(ph)) * 0.04 * run;
  let armL = { x: -0.32, y: -1.0 + s1 * 0.12 * run };
  let armR = { x: 0.32, y: -1.0 - s1 * 0.12 * run };
  if (pose === 'kick' && t < 0.45) {
    const a = Math.min(1, t / 0.12);
    fR = { x: 0.12, y: -0.55 * a + 0.1 };
    armL = { x: -0.5, y: -1.25 };
    armR = { x: 0.42, y: -1.05 };
  } else if (pose === 'volley' && t < 0.5) {
    fR = { x: 0.28, y: -0.75 };
    armL = { x: -0.55, y: -1.35 };
    armR = { x: 0.48, y: -1.2 };
  } else if (pose === 'header' && t < 0.6) {
    fL = { x: -0.15, y: -0.1 };
    fR = { x: 0.15, y: -0.18 };
    armL = { x: -0.45, y: -1.3 };
    armR = { x: 0.45, y: -1.3 };
  } else if (pose === 'celebrate') {
    armL = { x: -0.42, y: -2.05 };
    armR = { x: 0.42, y: -2.05 };
  } else if (pose === 'wall') {
    armL = { x: -0.06, y: -0.95 };
    armR = { x: 0.06, y: -0.95 };
  } else if (pose === 'dive' || pose === 'catch') {
    armL = { x: -0.3, y: -2.0 };
    armR = { x: 0.3, y: -2.0 };
    if (pose === 'catch') {
      armL = { x: -0.12, y: -1.35 };
      armR = { x: 0.12, y: -1.35 };
    }
  } else if (pose === 'ready' || look.gloves) {
    armL = { x: -0.42, y: -1.05 };
    armR = { x: 0.42, y: -1.05 };
  } else if (pose === 'sad') {
    armL = { x: -0.22, y: -0.95 };
    armR = { x: 0.22, y: -0.95 };
  }

  const leg = (hx, f) => {
    const kx = (hx + f.x) / 2 + (hx < 0 ? -0.02 : 0.02);
    const ky = (hipY + f.y) / 2 - 0.03;
    g.lineWidth = 0.15;
    g.strokeStyle = look.skin;
    g.beginPath();
    g.moveTo(hx, hipY + 0.08);
    g.lineTo(kx, ky);
    g.stroke();
    g.strokeStyle = look.socks;
    g.lineWidth = 0.14;
    g.beginPath();
    g.moveTo(kx, ky + 0.04);
    g.lineTo(f.x, f.y - 0.07);
    g.stroke();
    // boot
    g.fillStyle = look.boots;
    g.beginPath();
    g.ellipse(f.x, f.y - 0.03, 0.09, 0.06, 0, 0, Math.PI * 2);
    g.fill();
  };
  leg(-0.1, fL);
  leg(0.1, fR);

  // shorts
  g.fillStyle = look.shorts;
  rr(g, -0.23, hipY - 0.12, 0.46, 0.27, 0.06);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0.06, hipY - 0.12, 0.17, 0.27);

  // arms behind torso when seen from the back? keep them on top for readability
  const shY = -1.44;
  const torso = () => {
    g.beginPath();
    g.moveTo(-0.26, shY);
    g.quadraticCurveTo(0, shY - 0.07, 0.26, shY);
    g.lineTo(0.22, hipY - 0.06);
    g.lineTo(-0.22, hipY - 0.06);
    g.closePath();
  };
  // arms
  const arm = (sx, h) => {
    const ex = (sx + h.x) / 2 + (sx < 0 ? -0.03 : 0.03);
    const ey = (shY + 0.06 + h.y) / 2;
    g.strokeStyle = look.shirt;
    g.lineWidth = 0.13;
    g.beginPath();
    g.moveTo(sx, shY + 0.06);
    g.lineTo(ex, ey);
    g.stroke();
    g.strokeStyle = look.gloves ? look.shirt : look.skin;
    g.lineWidth = 0.1;
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo(h.x, h.y);
    g.stroke();
    if (look.gloves) {
      g.fillStyle = look.gloves;
      g.beginPath();
      g.arc(h.x, h.y, 0.075, 0, Math.PI * 2);
      g.fill();
    }
  };
  arm(-0.24, armL);
  arm(0.24, armR);

  // torso with kit pattern
  torso();
  g.fillStyle = look.shirt;
  g.fill();
  if (look.pattern && look.pattern !== 'plain') {
    g.save();
    torso();
    g.clip();
    g.fillStyle = look.shirt2;
    if (look.pattern === 'stripes') for (let x = -0.24; x < 0.3; x += 0.16) g.fillRect(x, shY - 0.1, 0.07, 0.7);
    else if (look.pattern === 'hoops') for (let y = shY + 0.02; y < hipY; y += 0.15) g.fillRect(-0.3, y, 0.6, 0.07);
    else if (look.pattern === 'sash') {
      g.beginPath();
      g.moveTo(-0.3, shY + 0.02);
      g.lineTo(-0.16, shY - 0.05);
      g.lineTo(0.3, hipY - 0.1);
      g.lineTo(0.16, hipY + 0.02);
      g.closePath();
      g.fill();
    } else if (look.pattern === 'halves') g.fillRect(0, shY - 0.1, 0.4, 0.7);
    else if (look.pattern === 'band') g.fillRect(-0.3, shY + 0.16, 0.6, 0.1);
    g.restore();
  }
  // shading + collar
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.beginPath();
  g.moveTo(0.06, shY - 0.03);
  g.quadraticCurveTo(0.2, shY - 0.02, 0.26, shY);
  g.lineTo(0.22, hipY - 0.06);
  g.lineTo(0.06, hipY - 0.06);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(-0.2, shY + 0.02, 0.4, 0.06);
  torso();
  g.strokeStyle = outline;
  g.lineWidth = 0.025;
  g.stroke();

  // number on the back / small crest on the front
  if (!front && look.num) {
    g.save();
    g.scale(0.01, 0.01);
    g.font = '900 30px Nunito, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = look.numColor || '#fff';
    g.fillText(String(look.num), 0, -118);
    g.restore();
  } else if (front) {
    g.fillStyle = look.shirt2;
    g.beginPath();
    g.arc(-0.1, shY + 0.14, 0.035, 0, Math.PI * 2);
    g.fill();
  }

  // head
  const hy = -1.64;
  g.fillStyle = look.skin;
  g.beginPath();
  g.arc(0, hy, 0.135, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = look.skin;
  g.fillRect(-0.05, hy + 0.08, 0.1, 0.1);
  drawHair(g, look, front, hy);
  if (front) {
    g.fillStyle = 'rgba(30,20,15,0.75)';
    g.fillRect(-0.06, hy + 0.0, 0.03, 0.028);
    g.fillRect(0.03, hy + 0.0, 0.03, 0.028);
  }
  g.strokeStyle = outline;
  g.lineWidth = 0.02;
  g.beginPath();
  g.arc(0, hy, 0.135, 0, Math.PI * 2);
  g.stroke();

  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opt.out) {
    opt.out.x = fx;
    opt.out.y = fy;
    opt.out.hx = fx + ux * 2.05 * kh;
    opt.out.hy = fy + uy * 2.05 * kh;
    opt.out.k = k;
  }
}

function drawHair(g, look, front, hy) {
  const c = look.hairColor;
  const st = look.hair;
  g.fillStyle = c;
  if (st === 'bald') {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.arc(-0.04, hy - 0.06, 0.05, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (st === 'buzz') {
    g.globalAlpha = 0.75;
    g.beginPath();
    g.arc(0, hy - 0.01, 0.138, Math.PI * 1.05, Math.PI * 1.95);
    g.closePath();
    g.fill();
    if (!front) g.fillRect(-0.13, hy - 0.03, 0.26, 0.09);
    g.globalAlpha = 1;
    return;
  }
  // base cap of hair
  g.beginPath();
  g.arc(0, hy - 0.015, 0.148, Math.PI * 1.0, Math.PI * 2.0);
  g.closePath();
  g.fill();
  if (!front) {
    g.beginPath();
    g.ellipse(0, hy + 0.0, 0.142, 0.12, 0, 0, Math.PI);
    g.fill();
  } else {
    g.fillRect(-0.148, hy - 0.04, 0.05, 0.08);
    g.fillRect(0.098, hy - 0.04, 0.05, 0.08);
  }
  if (st === 'curly' || st === 'afro') {
    const r = st === 'afro' ? 0.2 : 0.165;
    g.beginPath();
    g.arc(0, hy - 0.05, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(Math.cos(i * 1.1) * r * 0.6, hy - 0.05 + Math.sin(i * 1.1) * r * 0.6, 0.025, 0, Math.PI * 2);
      g.fill();
    }
  } else if (st === 'mohawk') {
    g.beginPath();
    g.moveTo(-0.04, hy - 0.12);
    g.lineTo(0, hy - 0.3);
    g.lineTo(0.04, hy - 0.12);
    g.closePath();
    g.fill();
    g.fillRect(-0.04, hy - 0.2, 0.08, 0.2);
  } else if (st === 'spiky') {
    g.beginPath();
    for (let i = -2; i <= 2; i++) {
      g.moveTo(i * 0.06 - 0.04, hy - 0.1);
      g.lineTo(i * 0.07, hy - 0.26 + Math.abs(i) * 0.03);
      g.lineTo(i * 0.06 + 0.04, hy - 0.1);
    }
    g.fill();
  } else if (st === 'long') {
    g.fillRect(-0.15, hy - 0.04, 0.3, front ? 0.12 : 0.3);
    if (front) {
      g.fillRect(-0.16, hy - 0.04, 0.06, 0.28);
      g.fillRect(0.1, hy - 0.04, 0.06, 0.28);
    }
  } else if (st === 'bun') {
    g.beginPath();
    g.arc(0, hy - 0.17, 0.07, 0, Math.PI * 2);
    g.fill();
  } else if (st === 'fringe') {
    g.beginPath();
    g.ellipse(front ? 0.03 : -0.02, hy - 0.1, 0.15, 0.07, front ? -0.3 : 0.3, 0, Math.PI * 2);
    g.fill();
  }
  // highlight
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath();
  g.ellipse(-0.04, hy - 0.1, 0.06, 0.025, -0.4, 0, Math.PI * 2);
  g.fill();
}

// ------------------------------------------------------------------ ball
export function drawBallShadow(g, v, b) {
  if (!v.p(b.x, b.y, 0, P0)) return;
  const r = Math.max(2.5, BR * BALL_VIS * P0.k);
  const f = 1 / (1 + b.z * 0.35);
  g.fillStyle = `rgba(0,0,0,${0.35 * f})`;
  g.beginPath();
  g.ellipse(P0.x + r * 0.3, P0.y + r * 0.1, r * 1.1 * f + 1, r * 0.45 * f + 0.5, 0, 0, Math.PI * 2);
  g.fill();
}

export function drawBall(g, v, b) {
  if (!v.p(b.x, b.y, b.z * 0.92 + BR * (BALL_VIS - 1), P0)) return;
  const r = Math.max(3.2, BR * BALL_VIS * P0.k);
  const x = P0.x;
  const y = P0.y;
  const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.7, '#e9e9ef');
  grd.addColorStop(1, '#a9acb8');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  // rotating panels
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#1b1c22';
  const sp = b.spin || 0;
  for (let i = 0; i < 4; i++) {
    const a = sp + i * 1.57;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(sp * 0.7 + i * 1.9) * r * 0.5;
    g.beginPath();
    for (let j = 0; j < 5; j++) {
      const aa = a + (j * Math.PI * 2) / 5;
      const qx = px + Math.cos(aa) * r * 0.26;
      const qy = py + Math.sin(aa) * r * 0.26;
      if (j) g.lineTo(qx, qy);
      else g.moveTo(qx, qy);
    }
    g.closePath();
    g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  return { x, y, r };
}

// ------------------------------------------------------------------ ground marks
export function groundEllipse(g, v, x, y, r, fill, stroke, lw = 2) {
  if (!v.p(x, y, 0, P0)) return null;
  // project a world circle: sample a few points
  g.beginPath();
  const n = 20;
  let ok = true;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (!v.p(x + Math.cos(a) * r, y + Math.sin(a) * r, 0, P1)) {
      ok = false;
      break;
    }
    if (i) g.lineTo(P1.x, P1.y);
    else g.moveTo(P1.x, P1.y);
  }
  if (!ok) return null;
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

// Dashed arrow on the ground (teammate runs).
export function groundArrow(g, v, x1, y1, x2, y2, color, t) {
  const n = 14;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    if (v.p(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 0, P0)) pts.push({ x: P0.x, y: P0.y, k: P0.k });
  }
  if (pts.length < 2) return;
  g.setLineDash([7, 6]);
  g.lineDashOffset = -t * 30;
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
  g.setLineDash([]);
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const s = Math.max(7, b.k * 0.9);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(b.x + Math.cos(ang) * s * 0.4, b.y + Math.sin(ang) * s * 0.4);
  g.lineTo(b.x + Math.cos(ang + 2.5) * s, b.y + Math.sin(ang + 2.5) * s);
  g.lineTo(b.x + Math.cos(ang - 2.5) * s, b.y + Math.sin(ang - 2.5) * s);
  g.closePath();
  g.fill();
}

// Glowing gold stroke through screen points.
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
  g.strokeStyle = `rgba(255,190,40,${0.16 * alpha})`;
  g.lineWidth = 18 * width;
  g.stroke();
  g.strokeStyle = `rgba(255,205,70,${0.38 * alpha})`;
  g.lineWidth = 9 * width;
  g.stroke();
  g.strokeStyle = `rgba(255,236,150,${0.95 * alpha})`;
  g.lineWidth = 4.2 * width;
  g.stroke();
  g.strokeStyle = `rgba(255,255,255,${0.9 * alpha})`;
  g.lineWidth = 1.6 * width;
  g.stroke();
}

export { FIG };
