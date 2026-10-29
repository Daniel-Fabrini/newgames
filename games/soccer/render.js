// Drawing: wooden table + pitch (pre-rendered per turf style), caps
// (pre-rendered sprites with a flag emblem), the rolling ball, nets, previews.

import { W, L, GOAL_D, GX0, GX1, POST_R } from './physics.js';
import { rng } from '../../js/core/ui.js';
import { byCode, flagUrl } from '../../js/data/countries.js';
import { isClub, kitOf, crestUrl } from './teams.js';


// ---------- colour helpers ----------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---------- flags ----------
const flagCache = new Map();
function loadImg(src, key) {
  if (flagCache.has(key)) return flagCache.get(key);
  const p = new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  flagCache.set(key, p);
  return p;
}
// Emblem for the discs: the flag of a national team, or the simplified crest of a club.
export function loadFlag(code) {
  if (isClub(code)) return loadImg(crestUrl(code, false), code + ':s');
  const c = byCode(code);
  return loadImg(c ? flagUrl(c) : '', code);
}
// Full crest (with stars) for the pitch watermark.
export function loadCrest(code) {
  return loadImg(crestUrl(code, true), code + ':f');
}
// Source for <img> badges: flag, or the full club crest.
export function flagSrc(code) {
  if (isClub(code)) return crestUrl(code, true);
  const c = byCode(code);
  return c ? flagUrl(c) : '';
}

// ---------- pitch styles (turf only; the wooden table is always the same) ----------
export const STYLES = {
  classic: { grass: ['#3fa535', '#4cb63f'], line: 'rgba(255,255,255,0.92)', lw: 0.5, light: 'day', pocket: '#2c6b25', tex: 0.45 },
  felt: { grass: ['#2e8a3e', '#2e8a3e'], line: 'rgba(250,244,220,0.92)', lw: 0.45, light: 'lamp', pocket: '#20602b', tex: 0.25 },
  night: { grass: ['#1f6e33', '#257a3a'], line: 'rgba(235,245,255,0.92)', lw: 0.5, light: 'flood', pocket: '#174f28', tex: 0.4 },
  sand: { grass: ['#e6cd92', '#e0c486'], line: 'rgba(25,100,190,0.95)', lw: 0.7, light: 'sun', pocket: '#b89c62', sand: true, tex: 0.18 },
  court: { grass: ['#cf8f52', '#c7854a'], line: 'rgba(255,255,255,0.95)', lw: 0.55, light: 'indoor', pocket: '#8e5a30', area: 'rgba(40,110,220,0.5)', wood: true },
  ice: { grass: ['#dcefff', '#cfe6fb'], line: 'rgba(220,40,60,0.85)', lw: 0.55, light: 'ice', pocket: '#9cc3e6', tex: 0.2, ice: true },
};

export const FRAME = 4.6; // wooden border around the pitch (world units)

// Pitch placement inside a cw×ch canvas, leaving `top` px for the scoreboard.
export function layout(cw, ch, top = 0) {
  const worldW = W + 2 * FRAME;
  const worldH = L + 2 * (GOAL_D + 2.6);
  const s = Math.min(cw / worldW, (ch - top - 6) / worldH);
  return { s, ox: (cw - W * s) / 2, oy: top + (ch - top - L * s) / 2, cw, ch, top };
}

function roundRect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function noisePattern(g, colors, density, size = 96, seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const r = rng(seed);
  for (let i = 0; i < size * size * density; i++) {
    x.fillStyle = colors[(r() * colors.length) | 0];
    x.fillRect((r() * size) | 0, (r() * size) | 0, 1 + (r() < 0.3 ? 1 : 0), 1);
  }
  return g.createPattern(c, 'repeat');
}

// The wooden table (screen px), with grain, outer edge and an inner bevel around the pitch.
function drawTable(g, lay) {
  const { s, ox, oy, cw, ch } = lay;
  const x0 = Math.max(2, ox - FRAME * s);
  const x1 = Math.min(cw - 2, ox + (W + FRAME) * s);
  const y0 = 2;
  const y1 = ch - 2;
  const rad = Math.min(16, s * 3.5);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 14;
  const wood = g.createLinearGradient(x0, 0, x1, 0);
  wood.addColorStop(0, '#9a5422');
  wood.addColorStop(0.18, '#c97c3b');
  wood.addColorStop(0.5, '#d68d48');
  wood.addColorStop(0.82, '#c47637');
  wood.addColorStop(1, '#94501f');
  g.fillStyle = wood;
  roundRect(g, x0, y0, x1 - x0, y1 - y0, rad);
  g.fill();
  g.restore();
  // grain
  g.save();
  roundRect(g, x0, y0, x1 - x0, y1 - y0, rad);
  g.clip();
  const r = rng(77);
  for (let i = 0; i < 90; i++) {
    const yy = y0 + r() * (y1 - y0);
    const amp = 1 + r() * 3;
    g.strokeStyle = r() < 0.5 ? 'rgba(90,40,10,0.22)' : 'rgba(255,220,170,0.12)';
    g.lineWidth = 0.6 + r() * 1.2;
    g.beginPath();
    g.moveTo(x0, yy);
    for (let x = x0; x <= x1 + 20; x += 20) g.lineTo(x, yy + Math.sin(x * 0.03 + i) * amp);
    g.stroke();
  }
  // knots
  for (let i = 0; i < 5; i++) {
    const kx = x0 + r() * (x1 - x0);
    const ky = y0 + r() * (y1 - y0);
    g.strokeStyle = 'rgba(90,40,10,0.2)';
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.ellipse(kx, ky, k * 4, k * 1.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // varnish sheen
  const sh = g.createLinearGradient(0, y0, 0, y1);
  sh.addColorStop(0, 'rgba(255,240,210,0.18)');
  sh.addColorStop(0.5, 'rgba(255,240,210,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = sh;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.restore();
  // outer edge: dark line + light bevel
  g.lineWidth = 2;
  g.strokeStyle = '#4a240b';
  roundRect(g, x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2, rad);
  g.stroke();
  g.lineWidth = 1.2;
  g.strokeStyle = 'rgba(255,214,160,0.45)';
  roundRect(g, x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6, rad - 2);
  g.stroke();
  // inner bevel around the playing surface (the walls the caps bounce on)
  const b = 1.5 * s;
  const px = ox - b;
  const py = oy - b;
  const pw = W * s + b * 2;
  const ph = L * s + b * 2;
  g.save();
  g.fillStyle = '#5a2c0e';
  roundRect(g, px, py, pw, ph, b);
  g.fill();
  const bev = g.createLinearGradient(px, py, px + pw, py + ph);
  bev.addColorStop(0, 'rgba(0,0,0,0.45)');
  bev.addColorStop(1, 'rgba(255,200,140,0.25)');
  g.strokeStyle = bev;
  g.lineWidth = b * 0.9;
  roundRect(g, px + b * 0.45, py + b * 0.45, pw - b * 0.9, ph - b * 0.9, b * 0.6);
  g.stroke();
  g.strokeStyle = 'rgba(255,220,170,0.5)';
  g.lineWidth = 1;
  roundRect(g, px - 0.5, py - 0.5, pw + 1, ph + 1, b);
  g.stroke();
  g.restore();
}

function drawSurface(g, st, lay) {
  g.save();
  g.beginPath();
  g.rect(0, 0, W, L);
  g.clip();
  if (st.wood) {
    const r = rng(9);
    const pw = 4.2;
    for (let x = 0; x < W; x += pw) {
      const v = (r() - 0.5) * 0.1;
      g.fillStyle = shade(st.grass[0], v);
      g.fillRect(x, 0, pw, L);
      let y = -r() * 30;
      while (y < L) {
        g.fillStyle = 'rgba(70,35,10,0.35)';
        g.fillRect(x, y, pw, 0.12);
        y += 22 + r() * 25;
      }
      g.fillStyle = 'rgba(70,35,10,0.3)';
      g.fillRect(x, 0, 0.1, L);
    }
    const sh = g.createLinearGradient(0, 0, W, L);
    sh.addColorStop(0, 'rgba(255,255,255,0.12)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(255,255,255,0.08)');
    g.fillStyle = sh;
    g.fillRect(0, 0, W, L);
  } else {
    const bands = 12;
    const bh = L / bands;
    for (let i = 0; i < bands; i++) {
      g.fillStyle = st.grass[i % 2];
      g.fillRect(0, i * bh, W, bh + 0.05);
    }
    const pat = st.sand
      ? noisePattern(g, ['rgba(120,90,40,0.25)', 'rgba(255,255,255,0.3)', 'rgba(160,120,60,0.2)'], st.tex, 96, 3)
      : st.ice
        ? noisePattern(g, ['rgba(255,255,255,0.6)', 'rgba(150,190,230,0.25)'], st.tex, 96, 4)
        : noisePattern(g, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.07)', 'rgba(20,60,10,0.15)'], st.tex, 96, 5);
    g.save();
    g.scale(1 / lay.s, 1 / lay.s);
    g.fillStyle = pat;
    g.fillRect(0, 0, W * lay.s, L * lay.s);
    g.restore();
    if (st.ice) {
      // skate scratches
      const r = rng(11);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 0.12;
      for (let i = 0; i < 40; i++) {
        const x = r() * W;
        const y = r() * L;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + r() * 10 - 5, y + r() * 6, x + r() * 20 - 10, y + r() * 14 - 7);
        g.stroke();
      }
    }
  }
  if (st.area) {
    g.fillStyle = st.area;
    g.fillRect(18, 0, 64, 24);
    g.fillRect(18, L - 24, 64, 24);
    g.beginPath();
    g.arc(W / 2, L / 2, 14, 0, Math.PI * 2);
    g.fill();
  }
  // soft shadow cast by the wooden walls onto the pitch
  const e = 3;
  for (const [x, y, w, h, gx0, gy0, gx1, gy1] of [
    [0, 0, W, e, 0, 0, 0, e],
    [0, 0, e, L, 0, 0, e, 0],
    [W - e, 0, e, L, W, 0, W - e, 0],
    [0, L - e, W, e, 0, L, 0, L - e],
  ]) {
    const grd = g.createLinearGradient(gx0, gy0, gx1, gy1);
    grd.addColorStop(0, 'rgba(0,0,0,0.28)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
  }
  g.restore();
}

function drawMarkings(g, st) {
  g.save();
  g.strokeStyle = st.line;
  g.fillStyle = st.line;
  g.lineWidth = st.lw;
  const i = 1.4; // lines are inset a little from the wooden walls
  g.strokeRect(i, i, W - i * 2, L - i * 2);
  g.beginPath();
  g.moveTo(i, L / 2);
  g.lineTo(W - i, L / 2);
  g.stroke();
  g.beginPath();
  g.arc(W / 2, L / 2, 14, 0, Math.PI * 2);
  g.stroke();
  for (const top of [true, false]) {
    const y0 = top ? i : L - i;
    const d = top ? 1 : -1;
    g.beginPath();
    g.moveTo(18, y0);
    g.lineTo(18, y0 + d * 23);
    g.lineTo(82, y0 + d * 23);
    g.lineTo(82, y0);
    g.stroke();
    g.beginPath();
    g.moveTo(31, y0);
    g.lineTo(31, y0 + d * 8);
    g.lineTo(69, y0 + d * 8);
    g.lineTo(69, y0);
    g.stroke();
    const py = y0 + d * 15.5;
    const a = Math.asin(7.5 / 12);
    g.beginPath();
    if (top) g.arc(W / 2, py, 12, a, Math.PI - a);
    else g.arc(W / 2, py, 12, Math.PI + a, -a);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, py, 0.6, 0, Math.PI * 2);
    g.fill();
  }
  const cr = 3;
  for (const [x, y, a0] of [
    [i, i, 0],
    [W - i, i, Math.PI / 2],
    [W - i, L - i, Math.PI],
    [i, L - i, Math.PI * 1.5],
  ]) {
    g.beginPath();
    g.arc(x, y, cr, a0, a0 + Math.PI / 2);
    g.stroke();
  }
  g.beginPath();
  g.arc(W / 2, L / 2, 0.75, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// Subtle club crest watermark inside the centre circle.
function drawMark(g, img) {
  const h = 21;
  const w = (h * img.naturalWidth) / (img.naturalHeight || 1);
  g.save();
  g.globalAlpha = 0.2;
  g.drawImage(img, W / 2 - w / 2, L / 2 - h / 2 + 0.5, w, h);
  g.restore();
}

function drawPockets(g, st) {
  for (const top of [true, false]) {
    const y = top ? -GOAL_D : L;
    g.fillStyle = st.pocket;
    g.fillRect(GX0, y, GX1 - GX0, GOAL_D);
    const grd = g.createLinearGradient(0, top ? 0 : L, 0, top ? -GOAL_D : L + GOAL_D);
    grd.addColorStop(0, 'rgba(0,0,0,0.05)');
    grd.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = grd;
    g.fillRect(GX0, y, GX1 - GX0, GOAL_D);
  }
}

function drawLighting(g, st) {
  g.save();
  g.beginPath();
  g.rect(0, 0, W, L);
  g.clip();
  if (st.light === 'flood') {
    g.globalCompositeOperation = 'lighter';
    for (const [x, y] of [
      [-10, -10],
      [W + 10, -10],
      [-10, L + 10],
      [W + 10, L + 10],
    ]) {
      const grd = g.createRadialGradient(x, y, 0, x, y, 95);
      grd.addColorStop(0, 'rgba(200,225,255,0.22)');
      grd.addColorStop(1, 'rgba(200,225,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, L);
    }
    g.globalCompositeOperation = 'source-over';
  } else {
    const warm = st.light === 'lamp' || st.light === 'sun';
    const grd = g.createRadialGradient(W * 0.45, L * 0.42, 5, W / 2, L / 2, 120);
    grd.addColorStop(0, warm ? 'rgba(255,240,190,0.2)' : 'rgba(255,255,235,0.16)');
    grd.addColorStop(1, 'rgba(255,255,235,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, L);
  }
  const v = g.createRadialGradient(W / 2, L / 2, L * 0.3, W / 2, L / 2, L * 0.64);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, st.light === 'flood' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.26)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, L);
  g.restore();
}

// Renders the static table + pitch for a turf style into a cw×ch (css px) context.
export function drawStatic(g, lay, styleId, mark) {
  const st = STYLES[styleId] || STYLES.classic;
  g.fillStyle = '#0a0a0c';
  g.fillRect(0, 0, lay.cw, lay.ch);
  drawTable(g, lay);
  g.save();
  g.translate(lay.ox, lay.oy);
  g.scale(lay.s, lay.s);
  drawSurface(g, st, lay);
  drawPockets(g, st);
  drawMarkings(g, st);
  if (mark) drawMark(g, mark);
  drawLighting(g, st);
  g.restore();
}

// Nets, goal frames and posts (drawn every frame, above the caps).
export function drawGoals(g, ripple, time) {
  for (let k = 0; k < 2; k++) {
    const top = k === 0;
    const y0 = top ? 0 : L;
    const d = top ? -1 : 1;
    const amp = ripple[k];
    g.save();
    // white mesh
    g.strokeStyle = 'rgba(255,255,255,0.78)';
    g.lineWidth = 0.17;
    g.beginPath();
    for (let x = GX0 + 1.3; x < GX1 - 0.4; x += 1.3) {
      const w = amp * Math.sin(time * 30 + x * 0.6) * 0.6;
      g.moveTo(x, y0);
      g.quadraticCurveTo(x + w, y0 + d * GOAL_D * 0.6, x + w * 0.4, y0 + d * GOAL_D);
    }
    for (let y = 1.3; y < GOAL_D; y += 1.3) {
      const w = amp * Math.sin(time * 30 + y) * 0.8 * (y / GOAL_D);
      g.moveTo(GX0, y0 + d * y + w);
      g.lineTo(GX1, y0 + d * y + w);
    }
    g.stroke();
    // frame (side bars and back bar) with a soft shadow
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 3;
    g.shadowOffsetX = 1;
    g.shadowOffsetY = 2;
    g.strokeStyle = '#f4f6f8';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(GX0, y0);
    g.lineTo(GX0, y0 + d * GOAL_D);
    g.lineTo(GX1, y0 + d * GOAL_D);
    g.lineTo(GX1, y0);
    g.stroke();
    // crossbar
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(GX0, y0);
    g.lineTo(GX1, y0);
    g.stroke();
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(160,170,180,0.9)';
    g.lineWidth = 0.25;
    g.beginPath();
    g.moveTo(GX0, y0 + 0.35);
    g.lineTo(GX1, y0 + 0.35);
    g.stroke();
    for (const x of [GX0, GX1]) {
      const pg = g.createRadialGradient(x - 0.4, y0 - 0.4, 0.1, x, y0, POST_R);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(1, '#aab3bc');
      g.fillStyle = pg;
      g.beginPath();
      g.arc(x, y0, POST_R, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// ---------- caps ----------
// side 0 = red dome with a yellow ring, side 1 = blue dome with a white ring.
export const SIDES = [
  { dome: ['#ff7a66', '#e5261c', '#7d0c05'], well: '#3a0905', ring: ['#fff3a6', '#f6c21a', '#a87900'], side: '#8a6200' },
  { dome: ['#7fb0ff', '#1f5fe0', '#0a2a7a'], well: '#06173f', ring: ['#ffffff', '#e4e8ee', '#97a1ad'], side: '#6b7480' },
];

function ringFill(g, rim, sd, r) {
  const lin = (stops) => {
    const grd = g.createLinearGradient(-r, -r, r, r);
    stops.forEach((c, i) => grd.addColorStop(i / (stops.length - 1), c));
    return grd;
  };
  if (rim === 'silver') return lin(['#ffffff', '#a7b0ba', '#eef2f5', '#6f7882']);
  if (rim === 'gold') return lin(['#fff5bf', '#d9a21b', '#ffe27a', '#9a6b00']);
  if (rim === 'carbon') {
    const c = document.createElement('canvas');
    c.width = c.height = 6;
    const x = c.getContext('2d');
    x.fillStyle = '#1c1f26';
    x.fillRect(0, 0, 6, 6);
    x.fillStyle = '#343a46';
    x.fillRect(0, 0, 3, 3);
    x.fillRect(3, 3, 3, 3);
    return g.createPattern(c, 'repeat');
  }
  if (rim === 'neon') return '#16121f';
  if (rim === 'rainbow') {
    if (g.createConicGradient) {
      const grd = g.createConicGradient(0, 0, 0);
      ['#ff3b3b', '#ffb13b', '#fff23b', '#3bff6e', '#3bc8ff', '#7a3bff', '#ff3bd8', '#ff3b3b'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c));
      return grd;
    }
    return lin(['#ff3b3b', '#fff23b', '#3bff6e', '#3bc8ff', '#ff3bd8']);
  }
  const grd = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  grd.addColorStop(0, sd.ring[0]);
  grd.addColorStop(0.55, sd.ring[1]);
  grd.addColorStop(1, sd.ring[2]);
  return grd;
}

// Pre-renders a cap (with its drop shadow) of radius rPx css pixels.
// `img` is the team flag, shown as a small emblem in the middle of the dome.
export function capSprite(img, side, rim, rPx, dpr, kit) {
  const sd = kit ? { ...(SIDES[side] || SIDES[0]), ...kit } : SIDES[side] || SIDES[0];
  const r = rPx;
  const pad = Math.ceil(r * 0.5);
  const size = Math.ceil((r * 2 + pad * 2) * dpr);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(r + pad, r + pad);
  // soft drop shadow
  const sh = g.createRadialGradient(r * 0.14, r * 0.28, r * 0.55, r * 0.14, r * 0.28, r * 1.25);
  sh.addColorStop(0, 'rgba(0,0,0,0.5)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.arc(r * 0.14, r * 0.28, r * 1.25, 0, Math.PI * 2);
  g.fill();
  // thickness of the ring
  g.fillStyle = rim === 'team' || !rim ? sd.side : rim === 'gold' ? '#6b4a00' : rim === 'silver' ? '#4a525b' : '#07060c';
  g.beginPath();
  g.arc(0, r * 0.14, r, 0, Math.PI * 2);
  g.fill();
  // ring top face
  if (rim === 'neon') {
    g.save();
    g.shadowColor = sd.dome[1];
    g.shadowBlur = r * 0.7;
  }
  g.fillStyle = ringFill(g, rim, sd, r);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  if (rim === 'neon') {
    g.restore();
    g.strokeStyle = sd.dome[0];
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    g.stroke();
  }
  // ring gloss
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.clip();
  const rg = g.createLinearGradient(0, -r, 0, 0);
  rg.addColorStop(0, 'rgba(255,255,255,0.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(-r, -r, r * 2, r);
  g.restore();
  // the well the dome sits in
  g.fillStyle = sd.well;
  g.beginPath();
  g.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  g.fill();
  // dome
  const dr = r * 0.6;
  const dy = -r * 0.04;
  const dg = g.createRadialGradient(-dr * 0.35, dy - dr * 0.45, dr * 0.08, 0, dy, dr);
  dg.addColorStop(0, sd.dome[0]);
  dg.addColorStop(0.55, sd.dome[1]);
  dg.addColorStop(1, sd.dome[2]);
  g.fillStyle = dg;
  g.beginPath();
  g.arc(0, dy, dr, 0, Math.PI * 2);
  g.fill();
  // club kit: red / black bands on the white dome (clipped to the dome)
  if (kit && kit.bands) {
    g.save();
    g.beginPath();
    g.arc(0, dy, dr, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = kit.bands[0];
    g.fillRect(-dr, dy - dr, dr * 2, dr * 0.5);
    g.fillStyle = kit.bands[1];
    g.fillRect(-dr, dy + dr * 0.5, dr * 2, dr * 0.5);
    g.restore();
  }
  // club crest emblem (shield, drawn as is) or flag emblem (round)
  if (img && kit) {
    const eh = dr * 1.22;
    const ew = (eh * img.naturalWidth) / (img.naturalHeight || 1);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = r * 0.08;
    g.shadowOffsetY = r * 0.03;
    g.drawImage(img, -ew / 2, dy - eh / 2 + dr * 0.02, ew, eh);
    g.restore();
  } else if (img) {
    const er = dr * 0.5;
    g.save();
    g.beginPath();
    g.arc(0, dy, er, 0, Math.PI * 2);
    g.clip();
    const fh = er * 2.05;
    const fw = (fh * 4) / 3;
    g.drawImage(img, -fw / 2, dy - fh / 2, fw, fh);
    const ins = g.createRadialGradient(0, dy - er * 0.2, er * 0.5, 0, dy, er * 1.05);
    ins.addColorStop(0, 'rgba(0,0,0,0)');
    ins.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = ins;
    g.fillRect(-er, dy - er, er * 2, er * 2);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = Math.max(0.8, r * 0.05);
    g.beginPath();
    g.arc(0, dy, er, 0, Math.PI * 2);
    g.stroke();
  }
  // dome gloss
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath();
  g.ellipse(-dr * 0.12, dy - dr * 0.5, dr * 0.62, dr * 0.32, -0.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(-dr * 0.45, dy - dr * 0.5, dr * 0.16, dr * 0.09, -0.7, 0, Math.PI * 2);
  g.fill();
  // crisp edge
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = Math.max(1, r * 0.04);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();
  return { canvas: c, half: r + pad, size: r * 2 + pad * 2 };
}

// ---------- ball ----------
export const BALL_SKINS = {
  classic: { base: '#ffffff', patch: '#1d2030', trail: '255,255,255' },
  retro: { base: '#c07a3c', patch: '#8a4a1c', stitch: '#f6dcb0', trail: '230,180,120' },
  rainbow: { base: '#ffffff', patches: ['#ff3b3b', '#ffb13b', '#ffe23b', '#3bd96e', '#3bb2ff', '#8a5bff'], trail: '255,120,220' },
  neon: { base: '#141a2c', patch: '#39ff88', glow: true, trail: '57,255,136' },
  gold: { base: '#ffd84a', patch: '#b07d00', trail: '255,210,80' },
  fire: { base: '#ff8a1f', patch: '#d62d0a', trail: '255,120,30', fire: true },
};

// The 12 pentagon centres of a football (icosahedron vertices), rotated as it rolls.
export function ballPattern() {
  const p = (1 + Math.sqrt(5)) / 2;
  const v = [
    [-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0],
    [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p],
    [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1],
  ];
  return v.map(([x, y, z]) => {
    const n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  });
}

// Rolls the pattern by a ground displacement (dx, dy) of a ball of radius r.
export function rollBall(pts, dx, dy, r) {
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return;
  const th = d / r;
  const ux = dx / d;
  const uy = dy / d;
  // axis k = (-uy, ux, 0)
  const kx = -uy;
  const ky = ux;
  const c = Math.cos(th);
  const s = Math.sin(th);
  for (const v of pts) {
    const [x, y, z] = v;
    const kv = kx * x + ky * y;
    // k × v
    const cx = ky * z;
    const cy = -kx * z;
    const cz = kx * y - ky * x;
    v[0] = x * c + cx * s + kx * kv * (1 - c);
    v[1] = y * c + cy * s + ky * kv * (1 - c);
    v[2] = z * c + cz * s;
  }
}

export function drawBall(g, x, y, r, pts, skinId) {
  const sk = BALL_SKINS[skinId] || BALL_SKINS.classic;
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + r * 0.3, y + r * 0.45, r * 1.05, r * 0.9, 0.3, 0, Math.PI * 2);
  g.fill();
  g.save();
  if (sk.glow) {
    g.shadowColor = sk.patch;
    g.shadowBlur = 10;
  }
  if (sk.fire) {
    g.shadowColor = '#ff6a00';
    g.shadowBlur = 12;
  }
  g.fillStyle = sk.base;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  const pr = r * 0.4;
  for (let i = 0; i < pts.length; i++) {
    const [px, py, pz] = pts[i];
    if (pz < -0.25) continue;
    const ang = Math.atan2(py, px);
    g.fillStyle = sk.patches ? sk.patches[i % sk.patches.length] : sk.patch;
    g.beginPath();
    g.ellipse(x + px * r, y + py * r, Math.max(0.06, pz) * pr + 0.05, pr, ang, 0, Math.PI * 2);
    g.fill();
    if (sk.stitch && pz > 0.2) {
      g.strokeStyle = sk.stitch;
      g.lineWidth = r * 0.06;
      g.stroke();
    }
  }
  // 3D shading
  const sh = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,0.55)');
  sh.addColorStop(0.45, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = sh;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = r * 0.07;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
}

// Small standalone previews for menus/shop.
export function ballPreview(skinId, px = 56) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = px * dpr;
  c.style.width = c.style.height = px + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const pts = ballPattern();
  rollBall(pts, 0.6, 0.9, 1);
  drawBall(g, px / 2 - 2, px / 2 - 3, px * 0.33, pts, skinId);
  return c;
}

export function pitchPreview(styleId, w = 96, h = 132) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const lay = layout(w, h, 0);
  drawStatic(g, lay, styleId);
  g.save();
  g.translate(lay.ox, lay.oy);
  g.scale(lay.s, lay.s);
  drawGoals(g, [0, 0], 0);
  g.restore();
  return c;
}

export async function capPreview(code, side, rim, px = 52) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const img = code ? await loadFlag(code) : null;
  const sp = capSprite(img, side, rim, px * 0.4, dpr, code ? kitOf(code) : null);
  const c = document.createElement('canvas');
  c.width = c.height = px * dpr;
  c.style.width = c.style.height = px + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.drawImage(sp.canvas, px / 2 - sp.half, px / 2 - sp.half - px * 0.05, sp.size, sp.size);
  return c;
}
