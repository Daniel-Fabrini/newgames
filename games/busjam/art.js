// Canvas artwork for Bus Jam: glossy top-down vehicles (cached sprites),
// round-headed stickmen, themed scenery, helicopter, tutorial hand and icons.
// Everything is drawn in code — no image files.

import { PALETTE } from './logic.js';

export const MYSTERY = { key: 'mystery', base: '#a2abbd', dark: '#5b6377', light: '#e3e7f0', ink: '#ffffff', sym: 'q' };

// ---------------------------------------------------------------- helpers
export function rrect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r);
  g.arcTo(x, y, x + r, y, r);
  g.closePath();
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
export function alpha(c, a) {
  const A = hex(c);
  return `rgba(${A[0]},${A[1]},${A[2]},${a})`;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ---------------------------------------------------------------- symbols
// Color-blind helper shapes, centered at (x, y) with radius r.
export function drawSymbol(g, sym, x, y, r, fill) {
  g.save();
  g.translate(x, y);
  g.fillStyle = fill;
  g.strokeStyle = fill;
  g.beginPath();
  switch (sym) {
    case 'circle':
      g.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      g.fill();
      break;
    case 'square':
      rrect(g, -r * 0.58, -r * 0.58, r * 1.16, r * 1.16, r * 0.18);
      g.fill();
      break;
    case 'triangle':
      g.moveTo(0, -r * 0.78);
      g.lineTo(r * 0.76, r * 0.56);
      g.lineTo(-r * 0.76, r * 0.56);
      g.closePath();
      g.fill();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 ? r * 0.38 : r * 0.86;
        g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      g.closePath();
      g.fill();
      break;
    case 'diamond':
      g.moveTo(0, -r * 0.84);
      g.lineTo(r * 0.62, 0);
      g.lineTo(0, r * 0.84);
      g.lineTo(-r * 0.62, 0);
      g.closePath();
      g.fill();
      break;
    case 'plus':
      rrect(g, -r * 0.22, -r * 0.74, r * 0.44, r * 1.48, r * 0.1);
      g.fill();
      rrect(g, -r * 0.74, -r * 0.22, r * 1.48, r * 0.44, r * 0.1);
      g.fill();
      break;
    case 'heart':
      g.moveTo(0, r * 0.72);
      g.bezierCurveTo(-r * 1.05, 0, -r * 0.62, -r * 0.92, 0, -r * 0.36);
      g.bezierCurveTo(r * 0.62, -r * 0.92, r * 1.05, 0, 0, r * 0.72);
      g.fill();
      break;
    case 'moon':
      g.arc(0, 0, r * 0.74, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(r * 0.36, -r * 0.2, r * 0.6, 0, Math.PI * 2);
      g.fill();
      break;
    case 'bolt':
      g.moveTo(r * 0.2, -r * 0.86);
      g.lineTo(-r * 0.5, r * 0.1);
      g.lineTo(-r * 0.02, r * 0.1);
      g.lineTo(-r * 0.22, r * 0.86);
      g.lineTo(r * 0.52, -r * 0.14);
      g.lineTo(r * 0.04, -r * 0.14);
      g.closePath();
      g.fill();
      break;
    case 'q':
      g.font = `900 ${r * 1.7}px Nunito, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 0, r * 0.08);
      break;
    default:
      break;
  }
  g.restore();
}

// ---------------------------------------------------------------- vehicles
const cache = new Map();
export function clearSprites() {
  cache.clear();
}

function glass(g, x0, x1, w0, w1) {
  // trapezoid window between x0 (width w0) and x1 (width w1)
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, '#203553');
  gr.addColorStop(0.55, '#3c6ea8');
  gr.addColorStop(1, '#9fd3ff');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x0, -w0 / 2);
  g.lineTo(x1, -w1 / 2);
  g.quadraticCurveTo(x1 + (x1 - x0) * 0.12, 0, x1, w1 / 2);
  g.lineTo(x0, w0 / 2);
  g.quadraticCurveTo(x0 + (x0 - x1) * 0.12, 0, x0, -w0 / 2);
  g.closePath();
  g.fill();
  // specular streak
  g.save();
  g.clip();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  const mx = (x0 + x1) / 2;
  const span = Math.abs(x1 - x0);
  g.beginPath();
  g.moveTo(mx - span * 0.1, -w1);
  g.lineTo(mx + span * 0.2, -w1);
  g.lineTo(mx - span * 0.05, w1);
  g.lineTo(mx - span * 0.35, w1);
  g.closePath();
  g.fill();
  g.restore();
}

function roofPanel(g, c, x0, x1, w, r) {
  const gr = g.createLinearGradient(0, -w / 2, 0, w / 2);
  gr.addColorStop(0, mix(c.base, c.dark, 0.25));
  gr.addColorStop(0.35, mix(c.base, c.light, 0.55));
  gr.addColorStop(0.65, mix(c.base, c.light, 0.3));
  gr.addColorStop(1, mix(c.base, c.dark, 0.3));
  g.fillStyle = gr;
  rrect(g, Math.min(x0, x1), -w / 2, Math.abs(x1 - x0), w, r);
  g.fill();
  // gloss
  g.fillStyle = 'rgba(255,255,255,0.28)';
  rrect(g, Math.min(x0, x1) + Math.abs(x1 - x0) * 0.1, -w * 0.36, Math.abs(x1 - x0) * 0.8, w * 0.16, w * 0.08);
  g.fill();
}

export function arrowPath(g, len, wid) {
  const head = len * 0.46;
  const shaft = wid * 0.36;
  g.beginPath();
  g.moveTo(len / 2, 0);
  g.lineTo(len / 2 - head, -wid / 2);
  g.lineTo(len / 2 - head, -shaft / 2);
  g.lineTo(-len / 2, -shaft / 2);
  g.lineTo(-len / 2, shaft / 2);
  g.lineTo(len / 2 - head, shaft / 2);
  g.lineTo(len / 2 - head, wid / 2);
  g.closePath();
}

// Geometry of the roof (where the arrow / seats go), in fractions of L.
export function roofSpan(type) {
  if (type === 'car') return [-0.27, 0.06];
  if (type === 'van') return [-0.44, 0.28];
  return [-0.46, 0.38];
}

function drawBody(g, type, c, L, W, opts) {
  const x0 = -L / 2;
  const y0 = -W / 2;
  const rad = type === 'car' ? W * 0.32 : W * 0.2;
  // body
  const gr = g.createLinearGradient(0, y0, 0, -y0);
  gr.addColorStop(0, c.dark);
  gr.addColorStop(0.14, c.base);
  gr.addColorStop(0.4, mix(c.base, c.light, 0.5));
  gr.addColorStop(0.62, c.base);
  gr.addColorStop(1, mix(c.base, c.dark, 0.7));
  g.fillStyle = gr;
  rrect(g, x0, y0, L, W, rad);
  g.fill();
  g.lineWidth = Math.max(1, W * 0.035);
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.stroke();
  // bumpers
  g.fillStyle = 'rgba(0,0,0,0.18)';
  rrect(g, L / 2 - W * 0.09, y0 + W * 0.12, W * 0.07, W * 0.76, W * 0.04);
  g.fill();
  rrect(g, x0 + W * 0.02, y0 + W * 0.12, W * 0.07, W * 0.76, W * 0.04);
  g.fill();

  if (type === 'car') {
    glass(g, L * 0.2, L * 0.05, W * 0.62, W * 0.78);
    roofPanel(g, c, L * 0.06, -L * 0.27, W * 0.74, W * 0.2);
    glass(g, -L * 0.38, -L * 0.27, W * 0.6, W * 0.72);
    // hood crease
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = Math.max(1, W * 0.04);
    g.beginPath();
    g.moveTo(L * 0.42, -W * 0.18);
    g.lineTo(L * 0.24, -W * 0.22);
    g.moveTo(L * 0.42, W * 0.18);
    g.lineTo(L * 0.24, W * 0.22);
    g.stroke();
  } else if (type === 'van') {
    glass(g, L * 0.4, L * 0.29, W * 0.66, W * 0.8);
    roofPanel(g, c, L * 0.28, -L * 0.46, W * 0.8, W * 0.16);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = Math.max(1, W * 0.03);
    for (let i = 1; i < 4; i++) {
      const x = L * 0.28 - (L * 0.74 * i) / 4;
      g.beginPath();
      g.moveTo(x, -W * 0.34);
      g.lineTo(x, W * 0.34);
      g.stroke();
    }
  } else {
    // bus / coach
    glass(g, L * 0.48, L * 0.41, W * 0.72, W * 0.84);
    roofPanel(g, c, L * 0.39, -L * 0.47, W * 0.66, W * 0.14);
    // side window bands
    for (const s of [-1, 1]) {
      g.fillStyle = '#2d4f7c';
      rrect(g, -L * 0.44, s * W * 0.41 - W * 0.05, L * 0.8, W * 0.1, W * 0.04);
      g.fill();
      g.fillStyle = 'rgba(160,215,255,0.55)';
      const panes = Math.round(L / (W * 0.62));
      for (let i = 0; i < panes; i++) {
        const px = -L * 0.43 + (i * L * 0.78) / panes;
        rrect(g, px, s * W * 0.41 - W * 0.035, (L * 0.78) / panes - W * 0.06, W * 0.04, W * 0.02);
        g.fill();
      }
    }
    // roof units
    const units = type === 'coach' ? [0.22, -0.32] : [0.14, -0.26];
    for (const f of units) {
      const ug = g.createLinearGradient(0, -W * 0.2, 0, W * 0.2);
      ug.addColorStop(0, '#ffffff');
      ug.addColorStop(1, '#c9d0db');
      g.fillStyle = ug;
      rrect(g, L * f - L * 0.07, -W * 0.19, L * 0.14, W * 0.38, W * 0.08);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.15)';
      g.lineWidth = 1;
      g.stroke();
    }
    if (type === 'coach') {
      // articulation joint
      g.fillStyle = '#2a2d36';
      rrect(g, -L * 0.07, -W * 0.5, L * 0.06, W, W * 0.05);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const x = -L * 0.065 + (i + 0.5) * L * 0.015;
        g.beginPath();
        g.moveTo(x, -W * 0.45);
        g.lineTo(x, W * 0.45);
        g.stroke();
      }
    }
  }
  // lights
  g.fillStyle = '#fff8cf';
  for (const s of [-1, 1]) {
    rrect(g, L / 2 - W * 0.11, s * W * 0.3 - W * 0.08, W * 0.1, W * 0.16, W * 0.05);
    g.fill();
  }
  g.fillStyle = '#ff3d3d';
  for (const s of [-1, 1]) {
    rrect(g, x0 + W * 0.02, s * W * 0.32 - W * 0.07, W * 0.07, W * 0.14, W * 0.03);
    g.fill();
  }
  // mirrors
  if (type !== 'bus' && type !== 'coach') {
    g.fillStyle = c.dark;
    const mx = type === 'car' ? L * 0.15 : L * 0.33;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(mx, s * (W / 2 + W * 0.05), W * 0.09, W * 0.07, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (opts.arrow) {
    const [a, b] = roofSpan(type);
    const cx = ((a + b) / 2) * L;
    const len = Math.min((b - a) * L * 0.86, W * 0.9);
    const wid = Math.min(W * 0.58, len * 0.95);
    g.save();
    g.translate(cx, 0);
    g.translate(0, W * 0.04);
    arrowPath(g, len, wid);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fill();
    g.translate(0, -W * 0.04);
    arrowPath(g, len, wid);
    g.fillStyle = '#ffffff';
    g.fill();
    g.lineJoin = 'round';
    g.lineWidth = Math.max(1, W * 0.03);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.stroke();
    g.restore();
  }
}

function wheelsAndSilhouette(g, type, c, L, W) {
  const rad = type === 'car' ? W * 0.32 : W * 0.2;
  const axles = type === 'car' ? [0.3, -0.3] : type === 'van' ? [0.32, -0.32] : type === 'bus' ? [0.33, -0.3] : [0.36, 0.05, -0.36];
  g.fillStyle = '#1d2027';
  for (const f of axles) {
    for (const s of [-1, 1]) {
      rrect(g, L * f - W * 0.17, s * (W / 2) - W * 0.1, W * 0.34, W * 0.2, W * 0.07);
      g.fill();
    }
  }
  g.fillStyle = c.dark;
  rrect(g, -L / 2, -W / 2, L, W, rad);
  g.fill();
}

// Cached sprite of a vehicle facing +x. Returns { img, w, h } (CSS px).
export function vehicleSprite(type, col, L, W, dpr, layer, opts = {}) {
  const key = `${layer}|${type}|${col.key}|${Math.round(L * 2)}|${Math.round(W * 2)}|${dpr}|${opts.arrow ? 1 : 0}`;
  let s = cache.get(key);
  if (s) return s;
  const pad = Math.ceil(W * 0.45) + 4;
  const w = L + pad * 2;
  const h = W + pad * 2;
  const cv = makeCanvas(w * dpr, h * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(w / 2, h / 2);
  if (layer === 'shadow') {
    const off = 10000;
    g.shadowColor = 'rgba(0,0,0,0.42)';
    g.shadowBlur = W * 0.32 * dpr;
    g.shadowOffsetX = off * dpr;
    g.fillStyle = '#000';
    rrect(g, -L / 2 - off + W * 0.02, -W / 2 + W * 0.04, L - W * 0.04, W - W * 0.08, W * 0.3);
    g.fill();
  } else if (layer === 'side') {
    wheelsAndSilhouette(g, type, col, L, W);
  } else {
    drawBody(g, type, col, L, W, opts);
  }
  s = { img: cv, w, h };
  cache.set(key, s);
  return s;
}

// Draws a vehicle at (x, y) rotated by `ang` (radians, 0 = facing right).
// lift (0..1) raises it (helicopter / hop): bigger shadow offset and scale.
export function drawVehicle(g, v, x, y, ang, L, W, dpr, o = {}) {
  const col = o.color;
  const lift = o.lift || 0;
  const k = 1 + lift * 0.14;
  const LL = L * k;
  const WW = W * k;
  const sprL = o.sprL || L;
  const sprW = o.sprW || W;
  const thick = W * 0.13;
  const sh = vehicleSprite(v.type, col, sprL, sprW, dpr, 'shadow');
  const side = vehicleSprite(v.type, col, sprL, sprW, dpr, 'side');
  const body = vehicleSprite(v.type, col, sprL, sprW, dpr, 'body', { arrow: o.arrow });
  const sx = LL / sprL;
  const sy = WW / sprW;
  const alphaV = o.alpha == null ? 1 : o.alpha;
  g.save();
  g.globalAlpha = alphaV * (1 - lift * 0.35);
  g.translate(x + W * 0.1 + lift * W * 0.9, y + W * 0.16 + lift * W * 1.3);
  g.rotate(ang);
  g.scale(sx * (1 + lift * 0.1), sy * (1 + lift * 0.1));
  g.drawImage(sh.img, -sh.w / 2, -sh.h / 2, sh.w, sh.h);
  g.restore();
  g.save();
  g.globalAlpha = alphaV;
  g.translate(x, y + thick);
  g.rotate(ang);
  g.scale(sx, sy);
  g.drawImage(side.img, -side.w / 2, -side.h / 2, side.w, side.h);
  g.restore();
  g.save();
  g.globalAlpha = alphaV;
  g.translate(x, y);
  g.rotate(ang);
  g.scale(sx, sy);
  g.drawImage(body.img, -body.w / 2, -body.h / 2, body.w, body.h);
  if (o.flash) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = o.flash;
  }
  g.restore();
  if (o.flash) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.globalAlpha = o.flash * 0.6;
    g.fillStyle = '#ffffff';
    rrect(g, -LL / 2, -WW / 2, LL, WW, WW * 0.25);
    g.fill();
    g.restore();
  }
}

// Seat grid on a parked vehicle (local frame, facing +x).
export function seatLayout(type, seats, L, W) {
  const [a, b] = type === 'car' ? [-0.36, 0.18] : type === 'van' ? [-0.42, 0.26] : [-0.44, 0.36];
  const rows = seats / 2;
  const pitch = ((b - a) * L) / rows;
  const r = Math.min(pitch * 0.4, W * 0.19);
  const out = [];
  for (let i = 0; i < rows; i++) {
    const x = b * L - pitch * (i + 0.5);
    out.push([x, -W * 0.21], [x, W * 0.21]);
  }
  return { pts: out, r };
}

export function drawSeats(g, v, x, y, ang, L, W, col, filled, popT) {
  const { pts, r } = seatLayout(v.type, v.seats, L, W);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  for (let i = 0; i < pts.length; i++) {
    const [sx, sy] = pts[i];
    if (i < filled) {
      const pop = i === filled - 1 && popT > 0 ? 1 + popT * 0.5 : 1;
      const rr2 = r * pop;
      const hg = g.createRadialGradient(sx - rr2 * 0.3, sy - rr2 * 0.3, rr2 * 0.1, sx, sy, rr2);
      hg.addColorStop(0, col.light);
      hg.addColorStop(0.5, col.base);
      hg.addColorStop(1, col.dark);
      g.fillStyle = hg;
      g.beginPath();
      g.arc(sx, sy, rr2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = Math.max(1, r * 0.22);
      g.stroke();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath();
      g.arc(sx, sy, r * 0.82, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  g.restore();
}

// Round badge with the color symbol (always upright).
export function drawBadge(g, x, y, r, col) {
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.arc(x, y + r * 0.15, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = col.dark;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = Math.max(1.2, r * 0.18);
  g.stroke();
  drawSymbol(g, col.sym, x, y, r * 0.66, '#ffffff');
  g.restore();
}

export function drawLockBadge(g, x, y, r, n, t) {
  g.save();
  g.translate(x, y);
  const s = 1 + Math.sin(t * 4) * 0.04;
  g.scale(s, s);
  // shackle
  g.strokeStyle = '#8a6a16';
  g.lineWidth = r * 0.32;
  g.beginPath();
  g.arc(0, -r * 0.35, r * 0.55, Math.PI, 0);
  g.stroke();
  const gr = g.createLinearGradient(0, -r * 0.5, 0, r);
  gr.addColorStop(0, '#ffe58a');
  gr.addColorStop(1, '#d39a1c');
  g.fillStyle = gr;
  rrect(g, -r * 0.95, -r * 0.4, r * 1.9, r * 1.45, r * 0.35);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#3a2a00';
  g.font = `900 ${r * 1.15}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 0, r * 0.36);
  g.restore();
}

// ---------------------------------------------------------------- stickmen
export function paxSprite(col, s, dpr) {
  const key = `pax|${col.key}|${Math.round(s * 2)}|${dpr}`;
  let sp = cache.get(key);
  if (sp) return sp;
  const w = s * 0.8;
  const h = s * 1.2;
  const cv = makeCanvas(w * dpr, h * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(w / 2, s * 1.1);
  // torso
  const tg = g.createLinearGradient(-s * 0.2, 0, s * 0.2, 0);
  tg.addColorStop(0, col.light);
  tg.addColorStop(0.35, col.base);
  tg.addColorStop(1, col.dark);
  g.fillStyle = tg;
  rrect(g, -s * 0.2, -s * 0.74, s * 0.4, s * 0.44, s * 0.17);
  g.fill();
  // head
  const hr = s * 0.21;
  const hy = -s * 0.88;
  const hg = g.createRadialGradient(-hr * 0.35, hy - hr * 0.4, hr * 0.1, 0, hy, hr * 1.05);
  hg.addColorStop(0, mix(col.light, '#ffffff', 0.4));
  hg.addColorStop(0.45, col.base);
  hg.addColorStop(1, col.dark);
  g.fillStyle = hg;
  g.beginPath();
  g.arc(0, hy, hr, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath();
  g.ellipse(-hr * 0.38, hy - hr * 0.42, hr * 0.26, hr * 0.17, -0.6, 0, Math.PI * 2);
  g.fill();
  // symbol on the torso
  drawSymbol(g, col.sym, 0, -s * 0.52, s * 0.12, col.sym === 'q' ? '#fff' : 'rgba(255,255,255,0.92)');
  sp = { img: cv, w, h, ax: w / 2, ay: s * 1.1 };
  cache.set(key, sp);
  return sp;
}

// Stickman with feet at (x, y). phase animates the legs/arms when walking.
export function drawPax(g, col, x, y, s, dpr, phase, walking, a = 1, scale = 1) {
  const sp = paxSprite(col, s, dpr);
  g.save();
  g.globalAlpha = a;
  g.translate(x, y);
  if (scale !== 1) g.scale(scale, scale);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath();
  g.ellipse(0, 0, s * 0.22, s * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  const sw = walking ? Math.sin(phase) * s * 0.11 : 0;
  const bob = walking ? Math.abs(Math.cos(phase)) * s * 0.05 : 0;
  g.lineCap = 'round';
  g.strokeStyle = col.dark;
  g.lineWidth = s * 0.13;
  g.beginPath();
  g.moveTo(-s * 0.08, -s * 0.33 - bob);
  g.lineTo(-s * 0.09 + sw, -s * 0.03);
  g.moveTo(s * 0.08, -s * 0.33 - bob);
  g.lineTo(s * 0.09 - sw, -s * 0.03);
  g.stroke();
  g.strokeStyle = col.base;
  g.lineWidth = s * 0.11;
  g.beginPath();
  g.moveTo(-s * 0.17, -s * 0.66 - bob);
  g.lineTo(-s * 0.26 - sw * 0.6, -s * 0.42 - bob);
  g.moveTo(s * 0.17, -s * 0.66 - bob);
  g.lineTo(s * 0.26 + sw * 0.6, -s * 0.42 - bob);
  g.stroke();
  g.drawImage(sp.img, -sp.ax, -sp.ay - bob, sp.w, sp.h);
  g.restore();
}

// ---------------------------------------------------------------- scenery
export const THEME_STYLES = [
  { ground: '#86cf5f', ground2: '#74bf4f', speck: '#5fae43', road: '#a3abb8', lot: '#c9ced8', lotEdge: '#eef1f5', walk: '#ece2cf', walk2: '#ddcfb5', slotRoad: '#8f97a5', deco: 'tree', leaf: ['#45b34a', '#2f9440', '#5cc95a'], trunk: '#8a5a33' },
  { ground: '#f3dfaa', ground2: '#ead08f', speck: '#e1c27b', road: '#a9b1bd', lot: '#d0d5dd', lotEdge: '#f7f3e8', walk: '#f6ecd6', walk2: '#e8d8b6', slotRoad: '#96a0ad', deco: 'palm', leaf: ['#3db05a', '#2a9147', '#57c46c'], trunk: '#a8743f', water: '#47c4e6' },
  { ground: '#d7bb68', ground2: '#c9aa55', speck: '#b8973f', road: '#a5a8b0', lot: '#cbcdd2', lotEdge: '#f0ede6', walk: '#efe1c8', walk2: '#ddc9a6', slotRoad: '#8f949f', deco: 'tree', leaf: ['#ef8a2d', '#d4572a', '#f2b33a'], trunk: '#7a4b2a' },
  { ground: '#eef4fa', ground2: '#dde8f3', speck: '#cbdcec', road: '#a4b0c0', lot: '#cdd6e2', lotEdge: '#ffffff', walk: '#e7edf4', walk2: '#d4dee9', slotRoad: '#8f9bad', deco: 'pine', leaf: ['#2f8a5a', '#236f48', '#3aa36a'], trunk: '#6b4a32' },
  { ground: '#ebbd7b', ground2: '#dfaa63', speck: '#d29a52', road: '#b0a9a2', lot: '#d6d0c8', lotEdge: '#f7efe2', walk: '#f3e3c7', walk2: '#e5cfa6', slotRoad: '#9c958e', deco: 'cactus', leaf: ['#4fa65a', '#3c8a48', '#68bd6c'], trunk: '#8a5a33' },
  { ground: '#a6db84', ground2: '#93cc71', speck: '#7fbb5d', road: '#a7abbb', lot: '#cfd1dc', lotEdge: '#f4f1f7', walk: '#f1e6ee', walk2: '#e2d2de', slotRoad: '#9095a5', deco: 'tree', leaf: ['#ff9ccc', '#f477b3', '#ffc1df'], trunk: '#8a5a33' },
];

function drawTree(g, st, x, y, r, rnd) {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(x + r * 0.25, y + r * 0.35, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  if (st.deco === 'palm') {
    g.save();
    g.translate(x, y);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.3;
      g.save();
      g.rotate(a);
      const lg = g.createLinearGradient(0, 0, r * 1.2, 0);
      lg.addColorStop(0, st.leaf[1]);
      lg.addColorStop(1, st.leaf[2]);
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(r * 0.6, -r * 0.42, r * 1.25, 0);
      g.quadraticCurveTo(r * 0.6, r * 0.2, 0, 0);
      g.fill();
      g.restore();
    }
    g.fillStyle = '#8a5a2b';
    g.beginPath();
    g.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  if (st.deco === 'pine') {
    for (let k = 0; k < 3; k++) {
      const rr2 = r * (1 - k * 0.27);
      g.fillStyle = st.leaf[k % 2];
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rad = i % 2 ? rr2 * 0.7 : rr2;
        g.lineTo(x + Math.cos(a) * rad, y - k * r * 0.12 + Math.sin(a) * rad);
      }
      g.closePath();
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      g.beginPath();
      g.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5 - r * 0.2, r * 0.16, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(x, y - r * 0.3, r * 0.22, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (st.deco === 'cactus') {
    const cg = g.createLinearGradient(x - r * 0.3, 0, x + r * 0.3, 0);
    cg.addColorStop(0, st.leaf[2]);
    cg.addColorStop(1, st.leaf[1]);
    g.fillStyle = cg;
    rrect(g, x - r * 0.25, y - r, r * 0.5, r * 1.6, r * 0.25);
    g.fill();
    rrect(g, x - r * 0.75, y - r * 0.45, r * 0.32, r * 0.75, r * 0.16);
    g.fill();
    rrect(g, x + r * 0.43, y - r * 0.75, r * 0.32, r * 0.8, r * 0.16);
    g.fill();
    rrect(g, x - r * 0.75, y + r * 0.05, r * 0.7, r * 0.28, r * 0.14);
    g.fill();
    rrect(g, x + r * 0.15, y - r * 0.15, r * 0.6, r * 0.28, r * 0.14);
    g.fill();
    g.fillStyle = '#ff7aa8';
    g.beginPath();
    g.arc(x, y - r, r * 0.16, 0, Math.PI * 2);
    g.fill();
    return;
  }
  const blobs = 6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rnd();
    const d = r * 0.42;
    const br = r * (0.5 + rnd() * 0.18);
    const tg = g.createRadialGradient(x + Math.cos(a) * d - br * 0.3, y + Math.sin(a) * d - br * 0.4, br * 0.1, x + Math.cos(a) * d, y + Math.sin(a) * d, br);
    tg.addColorStop(0, st.leaf[2]);
    tg.addColorStop(0.6, st.leaf[0]);
    tg.addColorStop(1, st.leaf[1]);
    g.fillStyle = tg;
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, br, 0, Math.PI * 2);
    g.fill();
  }
  const cg = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r * 0.7);
  cg.addColorStop(0, st.leaf[2]);
  cg.addColorStop(1, st.leaf[0]);
  g.fillStyle = cg;
  g.beginPath();
  g.arc(x, y, r * 0.62, 0, Math.PI * 2);
  g.fill();
}

function drawBush(g, st, x, y, r) {
  g.fillStyle = 'rgba(0,0,0,0.14)';
  g.beginPath();
  g.ellipse(x + r * 0.2, y + r * 0.3, r * 1.2, r * 0.7, 0, 0, Math.PI * 2);
  g.fill();
  const col = st.deco === 'pine' ? '#ffffff' : st.deco === 'cactus' ? '#c99a62' : st.leaf[1];
  const col2 = st.deco === 'pine' ? '#dfe9f3' : st.deco === 'cactus' ? '#b2834f' : st.leaf[0];
  for (const [dx, dy, k] of [[-0.55, 0.1, 0.62], [0.55, 0.1, 0.62], [0, -0.15, 0.75]]) {
    g.fillStyle = k > 0.7 ? col : col2;
    g.beginPath();
    g.arc(x + dx * r, y + dy * r, r * k, 0, Math.PI * 2);
    g.fill();
  }
}

// Static background: ground, decorations, ring road, lot, station, slot strip.
export function drawScene(g, L, st, rnd) {
  const { W, H } = L;
  // ground
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, st.ground);
  bg.addColorStop(1, st.ground2);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = st.speck;
  for (let i = 0; i < (W * H) / 900; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    g.globalAlpha = 0.35 + rnd() * 0.3;
    g.beginPath();
    g.ellipse(x, y, 1.5 + rnd() * 2.5, 1 + rnd() * 1.5, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  if (st.water) {
    const wg = g.createLinearGradient(0, 0, 0, L.ring.y0 - L.roadW / 2);
    wg.addColorStop(0, '#2fb3e0');
    wg.addColorStop(1, st.water);
    g.fillStyle = wg;
    g.fillRect(0, 0, W, Math.max(0, L.ring.y0 - L.roadW / 2 - 8));
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 2;
    for (let x = 6; x < W; x += 26) {
      const y = Math.max(4, L.ring.y0 - L.roadW / 2 - 14 - (x % 3) * 3);
      g.beginPath();
      g.arc(x, y, 5, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  }

  // ring road
  const R = L.ring;
  const rw = L.roadW;
  const rc = rw * 0.9;
  const ringPath = () => rrect(g, R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0, rc);
  g.lineJoin = 'round';
  ringPath();
  g.strokeStyle = 'rgba(0,0,0,0.15)';
  g.lineWidth = rw + 10;
  g.stroke();
  ringPath();
  g.strokeStyle = st.lotEdge;
  g.lineWidth = rw + 7;
  g.stroke();
  ringPath();
  g.strokeStyle = st.road;
  g.lineWidth = rw;
  g.stroke();
  ringPath();
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 1.5;
  g.setLineDash([rw * 0.32, rw * 0.32]);
  g.stroke();
  g.setLineDash([]);

  // lot
  const lx = L.lot.x - L.lotPad;
  const ly = L.lot.y - L.lotPad;
  const lw = L.lot.w + L.lotPad * 2;
  const lh = L.lot.h + L.lotPad * 2;
  g.fillStyle = 'rgba(0,0,0,0.12)';
  rrect(g, lx, ly + 3, lw, lh, 14);
  g.fill();
  const lg = g.createLinearGradient(0, ly, 0, ly + lh);
  lg.addColorStop(0, mix(st.lot, '#ffffff', 0.12));
  lg.addColorStop(1, st.lot);
  g.fillStyle = lg;
  rrect(g, lx, ly, lw, lh, 14);
  g.fill();
  g.strokeStyle = st.lotEdge;
  g.lineWidth = 3;
  g.stroke();
  // asphalt grain
  g.save();
  rrect(g, lx, ly, lw, lh, 14);
  g.clip();
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < (lw * lh) / 120; i++) g.fillRect(lx + rnd() * lw, ly + rnd() * lh, 1.5, 1.5);
  g.restore();
  // parking grid
  const u = L.ul;
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = Math.max(1, u * 0.035);
  g.lineCap = 'round';
  const gap = u * 0.16;
  for (let i = 0; i <= L.cols; i++) {
    for (let j = 0; j < L.rows; j++) {
      const x = L.lot.x + i * u;
      g.beginPath();
      g.moveTo(x, L.lot.y + j * u + gap);
      g.lineTo(x, L.lot.y + (j + 1) * u - gap);
      g.stroke();
    }
  }
  g.globalAlpha = 0.45;
  for (let j = 0; j <= L.rows; j++) {
    for (let i = 0; i < L.cols; i++) {
      const y = L.lot.y + j * u;
      g.beginPath();
      g.moveTo(L.lot.x + i * u + gap, y);
      g.lineTo(L.lot.x + (i + 1) * u - gap, y);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  // decorations in the free ground around the ring
  const decoSpots = [];
  const topBand = R.y0 - rw / 2 - 6;
  const sideL = R.x0 - rw / 2 - 6;
  const sideR = W - (R.x1 + rw / 2 + 6);
  const tr = Math.max(12, Math.min(26, L.ul * 0.5));
  if (topBand > tr * 0.9) for (let x = tr; x < W - tr * 0.5; x += tr * 2.6 + rnd() * tr) decoSpots.push([x, topBand / 2 + (rnd() - 0.5) * 4, tr * (0.8 + rnd() * 0.3)]);
  else if (topBand > 6) for (let x = tr; x < W; x += tr * 3.2) decoSpots.push([x, -tr * 0.2, tr * 0.8]);
  for (let y = R.y0 + tr; y < R.y1 - tr * 0.5; y += tr * 2.4 + rnd() * tr) {
    if (sideL > 4) decoSpots.push([Math.min(sideL * 0.5, sideL - tr * 0.3), y, tr * (0.75 + rnd() * 0.3)]);
    if (sideR > 4) decoSpots.push([W - Math.min(sideR * 0.5, sideR - tr * 0.3), y + tr, tr * (0.75 + rnd() * 0.3)]);
  }
  for (const [x, y, r] of decoSpots) {
    if (rnd() < 0.3) drawBush(g, st, x, y, r * 0.6);
    else drawTree(g, st, x, y, r, rnd);
  }

  // station / sidewalk with the queue
  const S = L.station;
  g.fillStyle = 'rgba(0,0,0,0.12)';
  rrect(g, S.x0, S.y0 + 3, S.x1 - S.x0, S.y1 - S.y0, 12);
  g.fill();
  g.fillStyle = st.walk;
  rrect(g, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, 12);
  g.fill();
  g.save();
  rrect(g, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, 12);
  g.clip();
  g.strokeStyle = st.walk2;
  g.lineWidth = 1;
  const tile = 20;
  for (let x = S.x0 + tile; x < S.x1; x += tile) {
    g.beginPath();
    g.moveTo(x, S.y0);
    g.lineTo(x, S.y1);
    g.stroke();
  }
  for (let y = S.y0 + tile; y < S.y1; y += tile) {
    g.beginPath();
    g.moveTo(S.x0, y);
    g.lineTo(S.x1, y);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = st.lotEdge;
  g.lineWidth = 2.5;
  rrect(g, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, 12);
  g.stroke();
  // queue ropes between the rows (open at the turns)
  for (const rope of L.ropes) {
    const [x0, x1, y] = rope;
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x0, y + 2);
    g.lineTo(x1, y + 2);
    g.stroke();
    const posts = Math.max(2, Math.round((x1 - x0) / 54) + 1);
    const step = (x1 - x0) / (posts - 1);
    g.strokeStyle = '#c8322f';
    g.lineWidth = 2.6;
    for (let i = 0; i < posts - 1; i++) {
      const a = x0 + i * step;
      g.beginPath();
      g.moveTo(a, y - 3);
      g.quadraticCurveTo(a + step / 2, y + 2, a + step, y - 3);
      g.stroke();
    }
    for (let i = 0; i < posts; i++) {
      const a = x0 + i * step;
      g.fillStyle = '#33363f';
      g.beginPath();
      g.arc(a, y - 2, 3.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f2c84b';
      g.beginPath();
      g.arc(a, y - 3, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  // boarding marker under the front of the line
  const F = L.front;
  g.fillStyle = 'rgba(255,200,40,0.9)';
  for (let i = 0; i < 2; i++) {
    const y = S.y1 - 4 - i * 6;
    g.beginPath();
    g.moveTo(F.x - 7, y - 4);
    g.lineTo(F.x, y + 1);
    g.lineTo(F.x + 7, y - 4);
    g.lineTo(F.x + 7, y - 1);
    g.lineTo(F.x, y + 4);
    g.lineTo(F.x - 7, y - 1);
    g.closePath();
    g.fill();
  }

  // slot strip (road where vehicles board)
  const B = L.slotStrip;
  const sg = g.createLinearGradient(0, B.y0, 0, B.y1);
  sg.addColorStop(0, mix(st.slotRoad, '#ffffff', 0.1));
  sg.addColorStop(1, st.slotRoad);
  g.fillStyle = sg;
  g.fillRect(0, B.y0, W, B.y1 - B.y0);
  g.fillStyle = st.lotEdge;
  g.fillRect(0, B.y0, W, 3);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, B.y0 + 3, W, 3);
  // slot wells
  for (const b of L.bays) {
    const x = b.x - b.w / 2;
    const y = b.y - b.h / 2;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    rrect(g, x, y + 1.5, b.w, b.h, 12);
    g.fill();
    const wg = g.createLinearGradient(0, y, 0, y + b.h);
    wg.addColorStop(0, '#16171c');
    wg.addColorStop(1, '#2a2c34');
    g.fillStyle = wg;
    rrect(g, x, y, b.w, b.h, 12);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.moveTo(x + 10, y + b.h - 1.5);
    g.lineTo(x + b.w - 10, y + b.h - 1.5);
    g.stroke();
  }
}

// Bus-stop sign with the number of passengers still waiting.
export function drawStopSign(g, x, y, s, n) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(2, 0, s * 0.35, s * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#5b606c';
  rrect(g, -s * 0.05, -s * 1.15, s * 0.1, s * 1.15, s * 0.04);
  g.fill();
  const gg = g.createLinearGradient(0, -s * 1.6, 0, -s * 1.05);
  gg.addColorStop(0, '#ffe27a');
  gg.addColorStop(1, '#e0a51e');
  g.fillStyle = gg;
  rrect(g, -s * 0.62, -s * 1.62, s * 1.24, s * 0.56, s * 0.14);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.stroke();
  // tiny bus glyph
  g.fillStyle = '#3a2a00';
  rrect(g, -s * 0.5, -s * 1.48, s * 0.36, s * 0.26, s * 0.05);
  g.fill();
  g.font = `900 ${s * 0.36}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), s * 0.2, -s * 1.33);
  g.restore();
}

// ---------------------------------------------------------------- helicopter
export function drawHeli(g, x, y, s, t, ang = 0) {
  g.save();
  g.translate(x + s * 0.5, y + s * 1.2);
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.beginPath();
  g.ellipse(0, 0, s * 0.8, s * 0.42, ang, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  // tail
  g.fillStyle = '#d9a21c';
  rrect(g, -s * 1.35, -s * 0.09, s * 1.0, s * 0.18, s * 0.08);
  g.fill();
  g.fillStyle = '#333842';
  g.save();
  g.translate(-s * 1.32, 0);
  g.rotate(t * 40);
  rrect(g, -s * 0.04, -s * 0.24, s * 0.08, s * 0.48, s * 0.03);
  g.fill();
  g.restore();
  // body
  const bg = g.createLinearGradient(0, -s * 0.42, 0, s * 0.42);
  bg.addColorStop(0, '#ffe680');
  bg.addColorStop(0.5, '#f7c52d');
  bg.addColorStop(1, '#c48a0c');
  g.fillStyle = bg;
  g.beginPath();
  g.ellipse(0, 0, s * 0.62, s * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = 1;
  g.stroke();
  const cg = g.createLinearGradient(s * 0.1, 0, s * 0.6, 0);
  cg.addColorStop(0, '#2c4c78');
  cg.addColorStop(1, '#a8dcff');
  g.fillStyle = cg;
  g.beginPath();
  g.ellipse(s * 0.3, 0, s * 0.28, s * 0.3, 0, -Math.PI / 2, Math.PI / 2);
  g.fill();
  // skids
  g.strokeStyle = '#3b3f48';
  g.lineWidth = s * 0.06;
  for (const sy of [-1, 1]) {
    g.beginPath();
    g.moveTo(-s * 0.45, sy * s * 0.5);
    g.lineTo(s * 0.45, sy * s * 0.5);
    g.stroke();
  }
  // rotor
  g.fillStyle = 'rgba(40,44,52,0.18)';
  g.beginPath();
  g.arc(0, 0, s * 1.15, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.rotate(t * 28);
  g.fillStyle = '#2b2f37';
  for (let i = 0; i < 2; i++) {
    g.rotate(Math.PI / 2);
    rrect(g, -s * 1.15, -s * 0.06, s * 2.3, s * 0.12, s * 0.05);
    g.fill();
  }
  g.restore();
  g.fillStyle = '#5a5f6a';
  g.beginPath();
  g.arc(0, 0, s * 0.1, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- tutorial hand
export function drawHand(g, x, y, s, t) {
  const press = (Math.sin(t * 6) + 1) / 2;
  // ripple
  g.save();
  g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - ((t * 1.6) % 1))})`;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, s * 0.2 + ((t * 1.6) % 1) * s * 0.6, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  g.save();
  g.translate(x + s * 0.08 + press * s * 0.06, y + s * 0.1 + press * s * 0.08);
  g.rotate(-0.45);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.translate(3, 4);
  handShape(g, s);
  g.fill();
  g.translate(-3, -4);
  handShape(g, s);
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = '#1b1c22';
  g.lineWidth = Math.max(1.5, s * 0.05);
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
}

function handShape(g, s) {
  g.beginPath();
  // index finger pointing up (tip at 0,0)
  g.moveTo(-s * 0.09, s * 0.05);
  g.arc(0, s * 0.05, s * 0.09, Math.PI, 0);
  g.lineTo(s * 0.09, s * 0.42);
  g.arc(s * 0.17, s * 0.42, s * 0.08, Math.PI, 0);
  g.arc(s * 0.33, s * 0.46, s * 0.08, Math.PI, 0);
  g.arc(s * 0.48, s * 0.52, s * 0.075, Math.PI, 0);
  g.lineTo(s * 0.55, s * 0.8);
  g.quadraticCurveTo(s * 0.52, s * 1.05, s * 0.28, s * 1.08);
  g.lineTo(s * 0.02, s * 1.08);
  g.quadraticCurveTo(-s * 0.2, s * 1.0, -s * 0.28, s * 0.66);
  g.lineTo(-s * 0.36, s * 0.48);
  g.arc(-s * 0.28, s * 0.44, s * 0.08, Math.PI * 1.1, Math.PI * 0.05, false);
  g.lineTo(-s * 0.09, s * 0.58);
  g.closePath();
}

// ---------------------------------------------------------------- DOM icons
export const ICONS = {
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 3.5v5h-5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.5c3.5 0 4.5 10 8 10H21"/><path d="M3 17h3.5c1.6 0 2.6-2 3.4-4.2M14.5 7H21"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/></svg>',
  heli: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="2" rx="1"/><rect x="11" y="5" width="2" height="3"/><path d="M5 12.5c0-2.5 2.6-4.5 6.5-4.5H13c3.4 0 5.5 2 5.5 4.5S16.4 17 13 17h-1.5C7.6 17 5 15 5 12.5Z"/><path d="M18 11.5h3.5v2H18z"/><rect x="20.5" y="9" width="1.6" height="7" rx=".8"/><path d="M8 18.5h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.5 9.6c1.9.3 3.2 1.3 3.5 2.9h-3.5Z" fill="#fff" opacity=".55"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4.5" y="10.5" width="15" height="11" rx="2.5"/><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><defs><linearGradient id="bjc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe98a"/><stop offset="1" stop-color="#d79b12"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#bjc)" stroke="#9c6c00" stroke-width="1.2"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#b27c00" stroke-width="1.4"/><path d="M12 8.2v7.6M9.8 10h3.4a1.6 1.6 0 0 1 0 3.2H10.6" stroke="#8a5d00" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.6 2.5c.6 3.4 4.9 5.6 4.9 10.8A5.6 5.6 0 0 1 12 19a5.6 5.6 0 0 1-5.5-5.7c0-2.3 1.1-3.9 2.3-5 .2 1.7.9 2.8 2 3.4-.3-3.3 1-6.4 1.8-9.2Z"/><path d="M12 21.5c-2.2 0-3.6-1.5-3.6-3.3 0-1.6 1.1-2.6 2-3.4.2 1 .8 1.7 1.6 1.9 0-1.5.6-2.8 1.3-3.8.4 2 2.3 3 2.3 5.3 0 1.8-1.5 3.3-3.6 3.3Z" opacity=".55"/></svg>',
  skull: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c5 0 8.5 3.4 8.5 8 0 2.5-1.1 4.4-2.8 5.5v2.5a1.5 1.5 0 0 1-1.5 1.5H15v-2h-1.5v2h-3v-2H9v2H7.8a1.5 1.5 0 0 1-1.5-1.5V16c-1.7-1.1-2.8-3-2.8-5.5 0-4.6 3.5-8 8.5-8Zm-3.4 7a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm6.8 0a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><rect x="5.5" y="9.5" width="13" height="9" rx="1.2" fill="#111"/><rect x="7" y="2.5" width="2.4" height="4.5" rx="1"/><rect x="14.6" y="2.5" width="2.4" height="4.5" rx="1"/><rect x="7.5" y="11.5" width="3" height="3" rx=".6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="8" width="18" height="4.5" rx="1.2"/><rect x="4.5" y="12.5" width="15" height="9" rx="1.5"/><rect x="10.8" y="8" width="2.4" height="13.5" fill="#000" opacity=".25"/><path d="M12 8c-1.5-3.5-5.5-4.5-6-2s3.5 2 6 2Zm0 0c1.5-3.5 5.5-4.5 6-2s-3.5 2-6 2Z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 7.2 7.3 11 11.2 4a.9.9 0 0 1 1.6 0l3.9 7 4.8-3.8a.6.6 0 0 1 1 .6l-2.2 9.7a1 1 0 0 1-1 .8H4.7a1 1 0 0 1-1-.8L1.5 7.8a.6.6 0 0 1 1-.6Z"/><rect x="4.2" y="18.6" width="15.6" height="2.4" rx="1"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.6v14.8a1 1 0 0 0 1.5.9l12-7.4a1 1 0 0 0 0-1.8l-12-7.4A1 1 0 0 0 7 4.6Z"/></svg>',
  slot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="3.5" y="4" width="11" height="16" rx="3"/><path d="M19 8v8M15 12h8"/></svg>',
};

export function paletteColor(i) {
  return PALETTE[i];
}
