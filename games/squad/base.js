// Isometric base: terrain, dirt roads, fences, trees and buildings drawn with
// Canvas 2D into a cached layer; animated overlays (smoke, flags, patrols,
// production bubbles, level badges) on top. Pan by dragging, tap buildings.

import { rng } from '../../js/core/ui.js';
import { BUILDINGS, GARAGES } from './data.js';

export const TW = 64;
export const TH = 32;
const N = 20;
const MARGIN = 60;
const TOPM = 170;
const BOTM = 50;
const MW = N * TW + MARGIN * 2;
const MH = N * TH + TOPM + BOTM;

let OX = MW / 2;
let OY = TOPM;
function I(gx, gy, z = 0) {
  return [(gx - gy) * (TW / 2) + OX, (gx + gy) * (TH / 2) + OY - z];
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (f >= 0) {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function path(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}
function fillP(g, pts, fill, stroke = 'rgba(20,16,12,.55)', lw = 1) {
  path(g, pts);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

// Box with visible left (+gy) and right (+gx) faces and a top.
function prism(g, x0, y0, w, h, z0, z1, col, top = null) {
  const A0 = I(x0, y0 + h, z0);
  const B0 = I(x0 + w, y0 + h, z0);
  const C0 = I(x0 + w, y0, z0);
  const A1 = I(x0, y0 + h, z1);
  const B1 = I(x0 + w, y0 + h, z1);
  const C1 = I(x0 + w, y0, z1);
  const T1 = I(x0, y0, z1);
  fillP(g, [A0, B0, B1, A1], shade(col, -0.28));
  fillP(g, [B0, C0, C1, B1], shade(col, -0.06));
  fillP(g, [T1, C1, B1, A1], top || shade(col, 0.18));
  return { A0, B0, C0, A1, B1, C1, T1 };
}
// Point on a face: left face (A0→B0, along +gx at gy=y0+h) or right face (B0→C0).
function onLeft(x0, y0, w, h, u, z) {
  return I(x0 + w * u, y0 + h, z);
}
function onRight(x0, y0, w, h, u, z) {
  return I(x0 + w, y0 + h - h * u, z);
}
function quadOn(g, face, x0, y0, w, h, u0, u1, z0, z1, fill, stroke) {
  const f = face === 'L' ? onLeft : onRight;
  fillP(g, [f(x0, y0, w, h, u0, z0), f(x0, y0, w, h, u1, z0), f(x0, y0, w, h, u1, z1), f(x0, y0, w, h, u0, z1)], fill, stroke === undefined ? 'rgba(0,0,0,.35)' : stroke, 0.8);
}
function windows(g, x0, y0, w, h, z0, z1, n, lit = 0.3, seed = 1) {
  const r = rng(seed);
  for (const face of ['L', 'R']) {
    for (let i = 0; i < n; i++) {
      const u0 = (i + 0.3) / n;
      const u1 = (i + 0.7) / n;
      const on = r() < lit;
      quadOn(g, face, x0, y0, w, h, u0, u1, z0, z1, on ? '#ffd77a' : face === 'L' ? '#24395c' : '#2f4c78');
    }
  }
}
// Hip roof with a ridge.
function roof(g, x0, y0, w, h, z, rise, col, e = 0.12, trim = null) {
  const T = I(x0 - e, y0 - e, z);
  const R = I(x0 + w + e, y0 - e, z);
  const B = I(x0 + w + e, y0 + h + e, z);
  const L = I(x0 - e, y0 + h + e, z);
  let P1;
  let P2;
  if (w >= h) {
    P1 = I(x0 + h / 2, y0 + h / 2, z + rise);
    P2 = I(x0 + w - h / 2, y0 + h / 2, z + rise);
    fillP(g, [T, R, P2, P1], shade(col, 0.1));
    fillP(g, [T, L, P1], shade(col, -0.1));
    fillP(g, [L, B, P2, P1], shade(col, -0.22));
    fillP(g, [B, R, P2], shade(col, 0.15));
  } else {
    P1 = I(x0 + w / 2, y0 + w / 2, z + rise);
    P2 = I(x0 + w / 2, y0 + h - w / 2, z + rise);
    fillP(g, [T, R, P1], shade(col, 0.1));
    fillP(g, [T, L, P2, P1], shade(col, -0.1));
    fillP(g, [L, B, P2], shade(col, -0.22));
    fillP(g, [B, R, P1, P2], shade(col, 0.15));
  }
  if (trim) {
    g.strokeStyle = trim;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(P1[0], P1[1]);
    g.lineTo(P2[0], P2[1]);
    g.stroke();
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(L[0], L[1]);
    g.lineTo(B[0], B[1]);
    g.lineTo(R[0], R[1]);
    g.stroke();
  }
  return { P1, P2 };
}
function cone(g, cx, cy, r, z, rise, col) {
  const pts = [];
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (k / 8);
    pts.push(I(cx + Math.cos(a) * r - Math.sin(a) * r * 0, cy + Math.sin(a) * r, z));
  }
  const tip = I(cx, cy, z + rise);
  const left = I(cx - r * 0.7, cy + r * 0.7, z);
  const right = I(cx + r * 0.7, cy - r * 0.7, z);
  const front = I(cx + r * 0.7, cy + r * 0.7, z);
  fillP(g, [left, front, tip], shade(col, -0.2));
  fillP(g, [front, right, tip], shade(col, 0.1));
  return { tip, pts };
}
function flagPole(g, p, h, col) {
  g.strokeStyle = '#3a3a40';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(p[0], p[1]);
  g.lineTo(p[0], p[1] - h);
  g.stroke();
  return [p[0], p[1] - h];
}
function slab(g, x0, y0, w, h, z = 4, col = '#9a9ea8') {
  prism(g, x0, y0, w, h, 0, z, col);
}

// ------------------------------------------------------------------ buildings
const BLUE = '#3f7fd8';
const GOLD = '#e8b84a';

function drawBuilding(g, id, gx, gy, w, h, lvl) {
  const big = Math.min(0.5, (lvl - 1) * 0.05);
  const trim = lvl >= 5 ? GOLD : null;
  const x0 = gx + 0.12;
  const y0 = gy + 0.12;
  const bw = w - 0.24;
  const bh = h - 0.24;
  switch (id) {
    case 'hq': {
      slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1, 5, '#a8acb6');
      const H1 = 34 * (1 + big);
      prism(g, x0 + 0.2, y0 + 0.2, bw - 0.4, bh - 0.4, 5, H1, '#d9d2c2');
      windows(g, x0 + 0.2, y0 + 0.2, bw - 0.4, bh - 0.4, 14, 26, 5, 0.4, 3);
      quadOn(g, 'L', x0 + 0.2, y0 + 0.2, bw - 0.4, bh - 0.4, 0.42, 0.58, 5, 22, '#5a3a22');
      roof(g, x0 + 0.2, y0 + 0.2, bw - 0.4, bh - 0.4, H1, 22, BLUE, 0.15, GOLD);
      // central tower
      const tx = gx + w / 2 - 0.45;
      const ty = gy + h / 2 - 0.45;
      const H2 = H1 + 40 * (1 + big);
      prism(g, tx, ty, 0.9, 0.9, H1, H2, '#e6dfcf');
      windows(g, tx, ty, 0.9, 0.9, H2 - 22, H2 - 10, 1, 1, 9);
      const c = roof(g, tx, ty, 0.9, 0.9, H2, 26, '#2f6fd0', 0.1, GOLD);
      return { top: c.P1, flag: flagPole(g, c.P1, 18), smoke: null };
    }
    case 'barracks': {
      slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1);
      const H1 = 24 * (1 + big);
      prism(g, x0, y0 + 0.25, bw, bh - 0.5, 4, H1, '#c9b48e');
      windows(g, x0, y0 + 0.25, bw, bh - 0.5, 10, 18, 3, 0.2, 5);
      quadOn(g, 'L', x0, y0 + 0.25, bw, bh - 0.5, 0.4, 0.6, 4, 16, '#4a3020');
      const r = roof(g, x0, y0 + 0.25, bw, bh - 0.5, H1, 16, BLUE, 0.12, trim);
      return { top: r.P1, flag: flagPole(g, I(gx + 0.25, gy + h - 0.3, 4), 30) };
    }
    case 'arms': {
      slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1, 4, '#8f939c');
      const H1 = 28 * (1 + big);
      prism(g, x0, y0, bw, bh, 4, H1, '#6c707a');
      quadOn(g, 'L', x0, y0, bw, bh, 0.15, 0.55, 4, 20, '#3a3e46');
      for (let k = 0; k < 4; k++) quadOn(g, 'L', x0, y0, bw, bh, 0.18 + k * 0.09, 0.24 + k * 0.09, 6, 18, '#55595f', 'rgba(0,0,0,.25)');
      windows(g, x0, y0, bw, bh, 18, 24, 2, 0.5, 7);
      // saw-tooth blue roof
      for (let k = 0; k < 3; k++) roof(g, x0 + (k * bw) / 3, y0, bw / 3, bh, H1, 12, BLUE, 0.04, trim);
      const ch = prism(g, gx + w - 0.6, gy + 0.25, 0.32, 0.32, H1, H1 + 30, '#8a5a44');
      return { top: I(gx + w / 2, gy + h / 2, H1 + 12), smoke: ch.T1 };
    }
    case 'range': {
      slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1, 3, '#b49a6a');
      // sandbag line
      for (let k = 0; k < 6; k++) prism(g, gx + 0.2 + k * 0.28, gy + h - 0.55, 0.26, 0.2, 3, 9, '#d6c08a');
      // targets
      for (let k = 0; k < 3; k++) {
        const p = I(gx + 0.4 + k * 0.55, gy + 0.35, 3);
        g.strokeStyle = '#5a4a3a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.lineTo(p[0], p[1] - 18);
        g.stroke();
        for (const [r, c] of [[7, '#f2f2f2'], [5, '#d63a3a'], [3, '#f2f2f2'], [1.5, '#d63a3a']]) {
          g.beginPath();
          g.ellipse(p[0], p[1] - 22, r, r * 1.1, 0, 0, Math.PI * 2);
          g.fillStyle = c;
          g.fill();
        }
      }
      // small shed
      prism(g, gx + w - 0.75, gy + h - 0.85, 0.6, 0.6, 3, 16 * (1 + big), '#c9b48e');
      roof(g, gx + w - 0.75, gy + h - 0.85, 0.6, 0.6, 16 * (1 + big), 10, BLUE, 0.08, trim);
      return { top: I(gx + w / 2, gy + h / 2, 30) };
    }
    case 'hospital': {
      slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1);
      const H1 = 30 * (1 + big);
      prism(g, x0, y0, bw, bh, 4, H1, '#eef1f6');
      windows(g, x0, y0, bw, bh, 12, 22, 3, 0.2, 11);
      quadOn(g, 'R', x0, y0, bw, bh, 0.38, 0.62, 4, 16, '#7aa7d8');
      const r = roof(g, x0, y0, bw, bh, H1, 16, BLUE, 0.12, trim);
      // red cross sign
      const p = [r.P1[0], r.P1[1] + 4];
      g.fillStyle = '#fff';
      g.fillRect(p[0] - 8, p[1] - 8, 16, 16);
      g.fillStyle = '#e03a3a';
      g.fillRect(p[0] - 6, p[1] - 2, 12, 4);
      g.fillRect(p[0] - 2, p[1] - 6, 4, 12);
      return { top: r.P1 };
    }
    case 'goldmine': {
      // rocky hill with a mine entrance
      const base = [I(gx, gy + h), I(gx + w, gy + h), I(gx + w, gy)];
      const hill = [base[0], I(gx + 0.3, gy + 0.6, 22), I(gx + 0.9, gy + 0.2, 30 * (1 + big)), I(gx + 1.6, gy + 0.1, 26), I(gx + w, gy + 0.3, 10), base[2], base[1]];
      fillP(g, hill, '#8a7a62');
      fillP(g, [I(gx + 0.9, gy + 0.2, 30 * (1 + big)), I(gx + 1.6, gy + 0.1, 26), I(gx + w, gy + 0.3, 10), base[2], base[1]], '#a08e72', null);
      const m = I(gx + 1, gy + h - 0.1, 0);
      g.fillStyle = '#5a3a22';
      g.fillRect(m[0] - 13, m[1] - 24, 26, 24);
      g.fillStyle = '#1a1410';
      g.beginPath();
      g.moveTo(m[0] - 9, m[1]);
      g.lineTo(m[0] - 9, m[1] - 14);
      g.quadraticCurveTo(m[0], m[1] - 22, m[0] + 9, m[1] - 14);
      g.lineTo(m[0] + 9, m[1]);
      g.fill();
      // gold pile & cart
      for (const [dx, dy] of [[0.35, 1.55], [0.55, 1.75], [0.25, 1.8], [0.45, 1.65]]) {
        const p = I(gx + dx, gy + dy, 2);
        g.beginPath();
        g.ellipse(p[0], p[1], 5, 3.5, 0, 0, Math.PI * 2);
        g.fillStyle = '#ffd24a';
        g.fill();
        g.strokeStyle = '#a8740e';
        g.lineWidth = 0.8;
        g.stroke();
      }
      prism(g, gx + 1.45, gy + 1.35, 0.4, 0.3, 3, 11, '#6a5040', '#ffcc33');
      return { top: I(gx + 0.9, gy + 0.2, 34 * (1 + big)) };
    }
    case 'factory': {
      slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1, 4, '#9a8f7e');
      const H1 = 26 * (1 + big);
      prism(g, x0, y0, bw * 0.65, bh, 4, H1, '#b08a62');
      quadOn(g, 'R', x0, y0, bw * 0.65, bh, 0.3, 0.7, 4, 18, '#4a3020');
      windows(g, x0, y0, bw * 0.65, bh, 14, 20, 2, 0.4, 13);
      roof(g, x0, y0, bw * 0.65, bh, H1, 14, BLUE, 0.1, trim);
      // log piles
      for (let k = 0; k < 3; k++) {
        for (let j = 0; j < 3 - k; j++) {
          const p = I(gx + 1.55 + j * 0.0, gy + 0.45 + j * 0.42 + k * 0.21, 4 + k * 7);
          g.beginPath();
          g.ellipse(p[0], p[1], 6, 4, 0, 0, Math.PI * 2);
          g.fillStyle = '#c99a5e';
          g.fill();
          g.strokeStyle = '#6a4a28';
          g.lineWidth = 1.2;
          g.stroke();
          g.beginPath();
          g.ellipse(p[0], p[1], 2.5, 1.6, 0, 0, Math.PI * 2);
          g.strokeStyle = '#8a6a3a';
          g.stroke();
        }
      }
      const ch = prism(g, gx + 0.25, gy + 0.25, 0.25, 0.25, H1, H1 + 22, '#7a7a80');
      return { top: I(gx + 0.7, gy + 0.9, H1 + 10), smoke: ch.T1 };
    }
    case 'tower': {
      slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1, 5, '#9aa3b0');
      const H0 = 26;
      prism(g, x0 + 0.1, y0 + 0.1, bw - 0.2, bh - 0.2, 5, H0, '#4a86d8');
      windows(g, x0 + 0.1, y0 + 0.1, bw - 0.2, bh - 0.2, 10, 20, 2, 0.6, 17);
      const H1 = H0 + 70 * (1 + big);
      prism(g, gx + 0.55, gy + 0.55, 0.9, 0.9, H0, H1, '#5c9ae8');
      for (let k = 0; k < 4; k++) windows(g, gx + 0.55, gy + 0.55, 0.9, 0.9, H0 + 10 + k * 15, H0 + 18 + k * 15, 1, 0.5, 19 + k);
      prism(g, gx + 0.4, gy + 0.4, 1.2, 1.2, H1, H1 + 8, '#2f6fd0', '#6fb0ff');
      const c = roof(g, gx + 0.5, gy + 0.5, 1, 1, H1 + 8, 30, '#2a62c4', 0.05, trim || '#9fd0ff');
      // antenna
      g.strokeStyle = '#d0d6e0';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(c.P1[0], c.P1[1]);
      g.lineTo(c.P1[0], c.P1[1] - 22);
      g.stroke();
      return { top: [c.P1[0], c.P1[1] - 22], beacon: [c.P1[0], c.P1[1] - 22] };
    }
    default:
      return { top: I(gx + w / 2, gy + h / 2, 30) };
  }
}

function drawGarage(g, id, gx, gy, w, h, owned) {
  if (!owned) {
    // construction plot
    fillP(g, [I(gx + 0.1, gy + 0.1), I(gx + w - 0.1, gy + 0.1), I(gx + w - 0.1, gy + h - 0.1), I(gx + 0.1, gy + h - 0.1)], '#a58a5e', 'rgba(60,40,20,.5)');
    for (let k = 0; k <= 4; k++) {
      const p = I(gx + 0.1 + ((w - 0.2) * k) / 4, gy + h - 0.1);
      g.fillStyle = '#ffb020';
      g.fillRect(p[0] - 1.5, p[1] - 10, 3, 10);
    }
    const a = I(gx + 0.1, gy + h - 0.1, 7);
    const b = I(gx + w - 0.1, gy + h - 0.1, 7);
    g.strokeStyle = '#ffb020';
    g.lineWidth = 2;
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
    g.setLineDash([]);
    return { top: I(gx + w / 2, gy + h / 2, 20) };
  }
  if (id === 'tank') {
    slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1, 3, '#8f939c');
    prism(g, gx + 0.15, gy + 0.15, w - 0.3, 0.9, 3, 24, '#7a8a5a');
    roof(g, gx + 0.15, gy + 0.15, w - 0.3, 0.9, 24, 10, '#4a6a3a', 0.06, GOLD);
    // tank parked in front
    prism(g, gx + 0.45, gy + 1.15, 1.1, 0.6, 3, 9, '#3b4a2a');
    prism(g, gx + 0.55, gy + 1.2, 0.9, 0.5, 9, 15, '#6f8a3a');
    prism(g, gx + 0.8, gy + 1.3, 0.4, 0.3, 15, 21, '#7f9a4a');
    const a = I(gx + 1.2, gy + 1.45, 18);
    const b = I(gx + 1.95, gy + 1.45, 18);
    g.strokeStyle = '#3b4a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
    return { top: I(gx + w / 2, gy + h / 2, 34) };
  }
  if (id === 'jet') {
    fillP(g, [I(gx, gy), I(gx + w, gy), I(gx + w, gy + h), I(gx, gy + h)], '#5a5f6a', 'rgba(0,0,0,.4)');
    for (let k = 0; k < 4; k++) {
      const a = I(gx + 0.3 + k * 0.7, gy + h / 2);
      const b = I(gx + 0.6 + k * 0.7, gy + h / 2);
      g.strokeStyle = '#f2f2f2';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
    // parked jet (top view on the iso plane)
    const c = I(gx + w / 2, gy + h / 2, 4);
    g.save();
    g.translate(c[0], c[1]);
    g.scale(1, 0.5);
    g.rotate(-Math.PI / 4);
    g.beginPath();
    const s = 1.1;
    const pts = [0, -26, 4, -16, 18, -4, 18, 2, 4, 0, 5, 8, 10, 11, -10, 11, -5, 8, -4, 0, -18, 2, -18, -4, -4, -16];
    g.moveTo(pts[0] * s, pts[1] * s);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * s, pts[i + 1] * s);
    g.closePath();
    g.fillStyle = '#b9c6d4';
    g.fill();
    g.strokeStyle = '#3a4250';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
    return { top: I(gx + w / 2, gy + h / 2, 28) };
  }
  // missile silo
  slab(g, gx + 0.05, gy + 0.05, w - 0.1, h - 0.1, 4, '#8f939c');
  const c = I(gx + w / 2, gy + h / 2, 4);
  g.beginPath();
  g.ellipse(c[0], c[1], 26, 13, 0, 0, Math.PI * 2);
  g.fillStyle = '#4a4e58';
  g.fill();
  g.strokeStyle = '#2a2e36';
  g.stroke();
  // gantry
  g.strokeStyle = '#c9971c';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(c[0] + 14, c[1]);
  g.lineTo(c[0] + 14, c[1] - 50);
  g.moveTo(c[0] + 20, c[1] - 3);
  g.lineTo(c[0] + 20, c[1] - 50);
  for (let k = 0; k < 5; k++) {
    g.moveTo(c[0] + 14, c[1] - 8 - k * 10);
    g.lineTo(c[0] + 20, c[1] - 14 - k * 10);
  }
  g.stroke();
  // missile
  const gr = g.createLinearGradient(c[0] - 6, 0, c[0] + 6, 0);
  gr.addColorStop(0, '#9aa3ad');
  gr.addColorStop(0.5, '#f2f5f8');
  gr.addColorStop(1, '#7a828c');
  g.fillStyle = gr;
  g.fillRect(c[0] - 6, c[1] - 52, 12, 46);
  g.beginPath();
  g.moveTo(c[0] - 6, c[1] - 52);
  g.lineTo(c[0], c[1] - 66);
  g.lineTo(c[0] + 6, c[1] - 52);
  g.fillStyle = '#d6342a';
  g.fill();
  g.fillStyle = '#d6342a';
  g.fillRect(c[0] - 6, c[1] - 30, 12, 4);
  return { top: [c[0], c[1] - 66] };
}

// ------------------------------------------------------------------ scenery
function tree(g, gx, gy, k = 1, col = '#3f8a34') {
  const p = I(gx, gy);
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.beginPath();
  g.ellipse(p[0] + 3, p[1], 13 * k, 6 * k, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6a4628';
  g.fillRect(p[0] - 2 * k, p[1] - 12 * k, 4 * k, 12 * k);
  for (const [dx, dy, r, f] of [[-6, -16, 9, -0.12], [6, -17, 9, -0.05], [0, -25, 11, 0.08], [-3, -31, 7, 0.22]]) {
    g.beginPath();
    g.arc(p[0] + dx * k, p[1] + dy * k, r * k, 0, Math.PI * 2);
    g.fillStyle = shade(col, f);
    g.fill();
    g.strokeStyle = 'rgba(15,40,10,.45)';
    g.lineWidth = 1;
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.beginPath();
  g.arc(p[0] - 4 * k, p[1] - 30 * k, 3 * k, 0, Math.PI * 2);
  g.fill();
}
function fenceSeg(g, ax, ay, bx, by) {
  // palisade along a tile edge
  const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) * 4));
  for (let i = 0; i < n; i++) {
    const u0 = i / n;
    const u1 = (i + 1) / n;
    const x0 = ax + (bx - ax) * u0;
    const y0 = ay + (by - ay) * u0;
    const x1 = ax + (bx - ax) * u1;
    const y1 = ay + (by - ay) * u1;
    const p0 = I(x0, y0);
    const p1 = I(x1, y1);
    const top0 = I(x0, y0, 15);
    const top1 = I(x1, y1, 15);
    fillP(g, [p0, p1, top1, top0], i % 2 ? '#c9a46a' : '#d9b67a', 'rgba(80,50,20,.55)', 0.8);
    g.fillStyle = '#e8cc92';
    g.beginPath();
    g.moveTo(top0[0], top0[1]);
    g.lineTo((top0[0] + top1[0]) / 2, (top0[1] + top1[1]) / 2 - 3);
    g.lineTo(top1[0], top1[1]);
    g.fill();
  }
}

// ------------------------------------------------------------------ map layout
const ROADS = new Set();
for (let i = 1; i < N - 1; i++) {
  for (const c of [7, 11]) {
    ROADS.add(`${c},${i}`);
    ROADS.add(`${i},${c}`);
  }
  ROADS.add(`${i},${17}`);
  ROADS.add(`${2},${i}`);
}
function occupied(save) {
  const occ = new Set();
  const mark = (gx, gy, w, h) => {
    for (let x = gx - 1; x <= gx + w; x++) for (let y = gy - 1; y <= gy + h; y++) occ.add(`${x},${y}`);
  };
  for (const b of BUILDINGS) mark(b.gx, b.gy, b.w, b.h);
  for (const b of GARAGES) mark(b.gx, b.gy, b.w, b.h);
  return occ;
}

export class BaseView {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.zoom = 1;
    this.cam = { x: MW / 2, y: MH / 2 + 20 };
    this.vel = { x: 0, y: 0 };
    this.anchors = {};
    this.time = 0;
    this.parts = [];
    this.walkers = [];
    const r = rng(77);
    const loops = [
      [[7.5, 2.5], [7.5, 16.5], [11.5, 16.5], [11.5, 2.5]],
      [[2.5, 7.5], [16.5, 7.5], [16.5, 11.5], [2.5, 11.5]],
      [[2.5, 17.5], [17.5, 17.5], [17.5, 11.5], [2.5, 11.5]],
    ];
    for (let i = 0; i < 7; i++) this.walkers.push({ loop: loops[i % 3], seg: Math.floor(r() * 4), u: r(), spd: 0.35 + r() * 0.25 });
    this.clouds = [0, 1, 2].map((i) => ({ x: r() * MW, y: r() * MH, r: 140 + r() * 120, v: 8 + r() * 10 }));
    this.bindInput();
  }

  bindInput() {
    const cv = this.cv;
    let down = null;
    this.onDown = (e) => {
      cv.setPointerCapture?.(e.pointerId);
      down = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, t: performance.now(), moved: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() };
      this.vel.x = this.vel.y = 0;
    };
    this.onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      down.moved = Math.max(down.moved, Math.hypot(dx, dy));
      this.cam.x = down.cx - dx / this.zoom;
      this.cam.y = down.cy - dy / this.zoom;
      const now = performance.now();
      const dt = Math.max(1, now - down.lt);
      this.vel.x = (-(e.clientX - down.lx) / this.zoom / dt) * 1000;
      this.vel.y = (-(e.clientY - down.ly) / this.zoom / dt) * 1000;
      down.lx = e.clientX;
      down.ly = e.clientY;
      down.lt = now;
      this.clamp();
    };
    this.onUp = (e) => {
      if (!down) return;
      const tap = down.moved < 9 && performance.now() - down.t < 500;
      if (tap) {
        this.vel.x = this.vel.y = 0;
        const rect = cv.getBoundingClientRect();
        this.tap(e.clientX - rect.left, e.clientY - rect.top);
      } else if (performance.now() - down.lt > 80) this.vel.x = this.vel.y = 0;
      down = null;
    };
    this.onWheel = (e) => {
      e.preventDefault();
      this.cam.x += e.deltaX / this.zoom;
      this.cam.y += e.deltaY / this.zoom;
      this.clamp();
    };
    cv.addEventListener('pointerdown', this.onDown);
    cv.addEventListener('pointermove', this.onMove);
    cv.addEventListener('pointerup', this.onUp);
    cv.addEventListener('pointercancel', this.onUp);
    cv.addEventListener('wheel', this.onWheel, { passive: false });
  }

  destroy() {
    const cv = this.cv;
    cv.removeEventListener('pointerdown', this.onDown);
    cv.removeEventListener('pointermove', this.onMove);
    cv.removeEventListener('pointerup', this.onUp);
    cv.removeEventListener('pointercancel', this.onUp);
    cv.removeEventListener('wheel', this.onWheel);
    this.layer = null;
  }

  clamp() {
    const hw = this.W / 2 / this.zoom;
    const hh = this.H / 2 / this.zoom;
    const minX = Math.min(MW / 2, hw + 10);
    const maxX = Math.max(MW / 2, MW - hw - 10);
    const minY = Math.min(MH / 2, hh + 40);
    const maxY = Math.max(MH / 2, MH - hh + 30);
    this.cam.x = Math.max(minX, Math.min(maxX, this.cam.x));
    this.cam.y = Math.max(minY, Math.min(maxY, this.cam.y));
  }

  resize(w, h, dpr, padTop = 0, padBottom = 0) {
    this.W = w;
    this.H = h;
    this.dpr = dpr;
    this.padTop = padTop;
    this.padBottom = padBottom;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    const z = Math.max(0.72, Math.min(1.25, w / 470));
    if (Math.abs(z - this.zoom) > 0.01 || !this.layer) {
      this.zoom = z;
      if (this.save) this.rebuild(this.save);
    }
    this.clamp();
  }

  focus(id) {
    const a = this.anchors[id];
    if (!a) return;
    this.cam.x = a.cx;
    this.cam.y = a.cy - 20;
    this.clamp();
  }

  // Render the static map layer.
  rebuild(save) {
    this.save = save;
    const R = Math.min(2, this.zoom * (this.dpr || 1));
    this.R = R;
    const c = this.layer || document.createElement('canvas');
    c.width = Math.round(MW * R);
    c.height = Math.round(MH * R);
    const g = c.getContext('2d');
    g.setTransform(R, 0, 0, R, 0, 0);
    g.lineJoin = 'round';
    OX = MW / 2;
    OY = TOPM;
    // background beyond the map
    const bg = g.createLinearGradient(0, 0, 0, MH);
    bg.addColorStop(0, '#3e6b2c');
    bg.addColorStop(1, '#2f5622');
    g.fillStyle = bg;
    g.fillRect(0, 0, MW, MH);
    const r = rng(1234);
    // grass tiles
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const k = r();
        const col = k < 0.33 ? '#7cb342' : k < 0.66 ? '#74ab3c' : '#82b948';
        fillP(g, [I(x, y), I(x + 1, y), I(x + 1, y + 1), I(x, y + 1)], col, 'rgba(60,100,30,.12)', 0.6);
      }
    }
    // map edge (cliff)
    fillP(g, [I(0, N), I(N, N), I(N, N, -18), I(0, N, -18)], '#6a4a2a', null);
    fillP(g, [I(N, 0), I(N, N), I(N, N, -18), I(N, 0, -18)], '#7a5a34', null);
    // plaza under HQ
    const hq = BUILDINGS[0];
    fillP(g, [I(hq.gx - 0.5, hq.gy - 0.5), I(hq.gx + hq.w + 0.5, hq.gy - 0.5), I(hq.gx + hq.w + 0.5, hq.gy + hq.h + 0.5), I(hq.gx - 0.5, hq.gy + hq.h + 0.5)], '#b9a98a', 'rgba(90,70,40,.4)');
    // dirt roads
    for (const key of ROADS) {
      const [x, y] = key.split(',').map(Number);
      fillP(g, [I(x - 0.04, y - 0.04), I(x + 1.04, y - 0.04), I(x + 1.04, y + 1.04), I(x - 0.04, y + 1.04)], '#c9a46a', null);
    }
    for (const key of ROADS) {
      const [x, y] = key.split(',').map(Number);
      const p = I(x + 0.5, y + 0.5);
      g.fillStyle = 'rgba(140,100,50,.25)';
      g.beginPath();
      g.ellipse(p[0] + (r() - 0.5) * 12, p[1] + (r() - 0.5) * 6, 6, 2.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    // grass tufts / flowers
    const occ = occupied(save);
    for (let i = 0; i < 260; i++) {
      const x = r() * N;
      const y = r() * N;
      if (ROADS.has(`${Math.floor(x)},${Math.floor(y)}`)) continue;
      const p = I(x, y);
      if (r() < 0.15) {
        g.fillStyle = ['#ffe36a', '#ff8ab0', '#ffffff'][Math.floor(r() * 3)];
        g.beginPath();
        g.arc(p[0], p[1] - 1, 1.6, 0, Math.PI * 2);
        g.fill();
      } else {
        g.strokeStyle = 'rgba(40,90,20,.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(p[0] - 2, p[1]);
        g.lineTo(p[0] - 3, p[1] - 4);
        g.moveTo(p[0], p[1]);
        g.lineTo(p[0], p[1] - 5);
        g.moveTo(p[0] + 2, p[1]);
        g.lineTo(p[0] + 3, p[1] - 4);
        g.stroke();
      }
    }
    // depth-sorted objects
    const objs = [];
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const key = `${x},${y}`;
        if (ROADS.has(key) || occ.has(key)) continue;
        const edge = x <= 1 || y <= 1 || x >= N - 2 || y >= N - 2;
        const p = edge ? 0.75 : 0.12;
        if (r() < p) objs.push({ d: x + y + 1, draw: () => tree(g, x + 0.5 + (r() - 0.5) * 0.3, y + 0.5 + (r() - 0.5) * 0.3, 0.85 + r() * 0.35, ['#3f8a34', '#4a9a3a', '#357a2c'][Math.floor(r() * 3)]) });
        else if (!edge && r() < 0.05) {
          objs.push({
            d: x + y + 1,
            draw: () => {
              const q = I(x + 0.5, y + 0.5);
              g.fillStyle = '#9a9488';
              g.beginPath();
              g.ellipse(q[0], q[1] - 3, 7, 4.5, 0, 0, Math.PI * 2);
              g.fill();
              g.strokeStyle = 'rgba(0,0,0,.3)';
              g.stroke();
            },
          });
        }
      }
    }
    // palisade around the core (gaps on roads)
    for (let i = 3; i < 19; i++) {
      if (![7, 11, 17].includes(i)) {
        objs.push({ d: i + 3 + 0.5, draw: () => fenceSeg(g, i, 3, i + 1, 3) });
        objs.push({ d: 3 + i + 0.5, draw: () => fenceSeg(g, 3, i, 3, i + 1) });
      }
    }
    this.anchors = {};
    for (const b of BUILDINGS) {
      objs.push({
        d: b.gx + b.w + b.gy + b.h - 1,
        draw: () => {
          const a = drawBuilding(g, b.id, b.gx, b.gy, b.w, b.h, save.bld[b.id]);
          this.anchor(b.id, b, a);
        },
      });
    }
    for (const b of GARAGES) {
      objs.push({
        d: b.gx + b.w + b.gy + b.h - 1,
        draw: () => {
          const a = drawGarage(g, b.id, b.gx, b.gy, b.w, b.h, save.heroes[b.id].own);
          this.anchor('hero:' + b.id, b, a);
        },
      });
    }
    objs.sort((a, b) => a.d - b.d);
    for (const o of objs) o.draw();
    this.layer = c;
  }

  anchor(id, b, a) {
    const top = a.top || I(b.gx + b.w / 2, b.gy + b.h / 2, 30);
    const L = I(b.gx, b.gy + b.h);
    const Rr = I(b.gx + b.w, b.gy);
    const B = I(b.gx + b.w, b.gy + b.h);
    this.anchors[id] = {
      id,
      top,
      flag: a.flag,
      smoke: a.smoke,
      beacon: a.beacon,
      cx: (L[0] + Rr[0]) / 2,
      cy: (top[1] + B[1]) / 2,
      x0: L[0],
      x1: Rr[0],
      y0: top[1] - 10,
      y1: B[1],
      d: b.gx + b.gy + b.w + b.h,
    };
  }

  toScreen(mx, my) {
    return [(mx - this.cam.x) * this.zoom + this.W / 2, (my - this.cam.y) * this.zoom + this.H / 2 + (this.padTop - this.padBottom) / 2];
  }
  toMap(sx, sy) {
    return [(sx - this.W / 2) / this.zoom + this.cam.x, (sy - this.H / 2 - (this.padTop - this.padBottom) / 2) / this.zoom + this.cam.y];
  }

  tap(sx, sy) {
    // bubbles first
    for (const bb of this.bubbles || []) {
      if (Math.hypot(sx - bb.x, sy - bb.y) < 28) {
        this.hooks.onCollect(bb.kind, bb.x, bb.y);
        return;
      }
    }
    const [mx, my] = this.toMap(sx, sy);
    let best = null;
    for (const a of Object.values(this.anchors)) {
      if (mx >= a.x0 && mx <= a.x1 && my >= a.y0 && my <= a.y1) {
        if (!best || a.d > best.d) best = a;
      }
    }
    if (best) {
      this.selected = best.id;
      this.selT = 0;
      this.hooks.onTap(best.id);
    }
  }

  celebrate(id) {
    const a = this.anchors[id];
    if (!a) return;
    for (let i = 0; i < 26; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      this.parts.push({ x: a.top[0], y: a.top[1] + 10, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80, life: 1 + Math.random() * 0.5, max: 1.4, col: ['#f7d774', '#ffffff', '#c9971c'][i % 3], star: true });
    }
    this.badgePop = { id, t: 0 };
  }

  frame(dt, info) {
    // info: { bubbles: [{id, kind, amount, full}], upgradable: Set, levels: {id: lvl} }
    if (!this.layer) return;
    this.time += dt;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const W = this.W;
    const H = this.H;
    // inertia
    if (Math.abs(this.vel.x) + Math.abs(this.vel.y) > 5) {
      this.cam.x += this.vel.x * dt;
      this.cam.y += this.vel.y * dt;
      const f = Math.exp(-dt * 4);
      this.vel.x *= f;
      this.vel.y *= f;
      this.clamp();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2f5622';
    ctx.fillRect(0, 0, W, H);
    const z = this.zoom;
    const R = this.R;
    const [mx0, my0] = this.toMap(0, 0);
    const sw = W / z;
    const sh = H / z;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.layer, mx0 * R, my0 * R, sw * R, sh * R, 0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + (this.padTop - this.padBottom) / 2 * 0, H / 2 + (this.padTop - this.padBottom) / 2);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);
    OX = MW / 2;
    OY = TOPM;

    // walking patrols
    for (const wk of this.walkers) {
      const L = wk.loop;
      const a = L[wk.seg];
      const b = L[(wk.seg + 1) % L.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      wk.u += (wk.spd * dt) / Math.max(1, len) * 2;
      if (wk.u >= 1) {
        wk.u = 0;
        wk.seg = (wk.seg + 1) % L.length;
      }
      const x = a[0] + (b[0] - a[0]) * wk.u;
      const y = a[1] + (b[1] - a[1]) * wk.u;
      const p = I(x, y);
      const step = Math.sin(this.time * 10 + wk.spd * 50) * 1.2;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22335a';
      ctx.fillRect(p[0] - 2.2, p[1] - 5 + step * 0.3, 1.8, 5);
      ctx.fillRect(p[0] + 0.4, p[1] - 5 - step * 0.3, 1.8, 5);
      ctx.fillStyle = '#3f6fd8';
      ctx.fillRect(p[0] - 3, p[1] - 11, 6, 7);
      ctx.fillStyle = '#4f7a3a';
      ctx.beginPath();
      ctx.arc(p[0], p[1] - 12.5, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // smoke, flags, beacons
    for (const a of Object.values(this.anchors)) {
      if (a.smoke && Math.random() < dt * 3) this.parts.push({ x: a.smoke[0], y: a.smoke[1] - 2, vx: 6 + Math.random() * 6, vy: -18 - Math.random() * 10, life: 2.2, max: 2.2, col: 'smoke', r: 3 });
      if (a.flag) {
        const f = a.flag;
        ctx.fillStyle = '#d63a3a';
        ctx.beginPath();
        ctx.moveTo(f[0], f[1]);
        for (let k = 0; k <= 6; k++) ctx.lineTo(f[0] + k * 2.6, f[1] + Math.sin(this.time * 6 - k * 0.8) * 1.6);
        for (let k = 6; k >= 0; k--) ctx.lineTo(f[0] + k * 2.6, f[1] + 9 + Math.sin(this.time * 6 - k * 0.8) * 1.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f7d774';
        ctx.beginPath();
        ctx.arc(f[0] + 8, f[1] + 4.5 + Math.sin(this.time * 6 - 2.4) * 1.6, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (a.beacon) {
        const on = Math.sin(this.time * 4) > 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(a.beacon[0], a.beacon[1], 0, a.beacon[0], a.beacon[1], 14);
        g.addColorStop(0, on ? 'rgba(255,80,60,.95)' : 'rgba(255,80,60,.35)');
        g.addColorStop(1, 'rgba(255,80,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(a.beacon[0] - 14, a.beacon[1] - 14, 28, 28);
        ctx.restore();
      }
    }

    // particles (smoke / celebration stars)
    const keep = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      keep.push(p);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const u = p.life / p.max;
      if (p.col === 'smoke') {
        p.r += dt * 6;
        ctx.fillStyle = `rgba(220,220,225,${0.45 * u})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        p.vy += 160 * dt;
        ctx.globalAlpha = Math.min(1, u * 1.5);
        ctx.fillStyle = p.col;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.time * 6);
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 ? 1.6 : 4;
          const ang = (k / 10) * Math.PI * 2;
          ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
    this.parts = keep.length > 300 ? keep.slice(-300) : keep;

    // cloud shadows
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x - c.r > MW) c.x = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, 'rgba(0,0,20,.10)');
      g.addColorStop(1, 'rgba(0,0,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r, c.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // selection glow
    if (this.selected && this.anchors[this.selected]) {
      this.selT = (this.selT || 0) + dt;
      if (this.selT < 1.2) {
        const a = this.anchors[this.selected];
        ctx.strokeStyle = `rgba(247,215,116,${0.9 * (1 - this.selT / 1.2)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(a.cx, a.y1 - (a.y1 - a.cy) * 0.35, (a.x1 - a.x0) * 0.55, (a.x1 - a.x0) * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // level badges, upgrade arrows, bubbles (screen space, crisp)
    this.bubbles = [];
    const levels = info.levels || {};
    for (const a of Object.values(this.anchors)) {
      const [sx, sy] = this.toScreen(a.top[0], a.top[1]);
      if (sx < -40 || sx > W + 40 || sy < -60 || sy > H + 60) continue;
      const lvl = levels[a.id];
      if (lvl) {
        let k = 1;
        if (this.badgePop && this.badgePop.id === a.id) {
          this.badgePop.t += dt;
          const u = this.badgePop.t / 0.6;
          if (u < 1) k = 1 + Math.sin(u * Math.PI) * 0.6;
        }
        const bx = sx;
        const by = sy - 14;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(k, k);
        const gr = ctx.createLinearGradient(0, -11, 0, 11);
        gr.addColorStop(0, '#f7d774');
        gr.addColorStop(1, '#c9971c');
        ctx.fillStyle = 'rgba(10,10,12,.9)';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = gr;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f7d774';
        ctx.font = '900 11px Nunito, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(lvl), 0, 1);
        ctx.restore();
      }
      if (info.upgradable && info.upgradable.has(a.id)) {
        const bob = Math.sin(this.time * 5) * 3;
        const ax = sx + 15;
        const ay = sy - 28 + bob;
        ctx.fillStyle = '#2fd38a';
        ctx.strokeStyle = '#0b4a2c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 8);
        ctx.lineTo(ax + 7, ay);
        ctx.lineTo(ax + 3, ay);
        ctx.lineTo(ax + 3, ay + 7);
        ctx.lineTo(ax - 3, ay + 7);
        ctx.lineTo(ax - 3, ay);
        ctx.lineTo(ax - 7, ay);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    for (const b of info.bubbles || []) {
      const a = this.anchors[b.id];
      if (!a) continue;
      const [sx, sy0] = this.toScreen(a.top[0], a.top[1]);
      const sy = sy0 - 44 + Math.sin(this.time * 3 + sx) * 3;
      this.bubbles.push({ x: sx, y: sy, kind: b.kind });
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(12,12,16,.92)';
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.moveTo(-6, 16);
      ctx.lineTo(0, 25);
      ctx.lineTo(6, 16);
      ctx.fill();
      const gr = ctx.createLinearGradient(0, -19, 0, 19);
      gr.addColorStop(0, '#f7d774');
      gr.addColorStop(1, '#c9971c');
      ctx.strokeStyle = b.full ? '#2fd38a' : gr;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.stroke();
      if (b.kind === 'gold') drawGoldIcon(ctx, 0, -1, 1);
      else drawMatIcon(ctx, 0, -1, 1);
      ctx.restore();
    }
  }
}

// Small resource icons for canvas bubbles.
export function drawGoldIcon(ctx, x, y, k) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const bar = (dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(dx - 7, dy + 3);
    ctx.lineTo(dx + 7, dy + 3);
    ctx.lineTo(dx + 5, dy - 3);
    ctx.lineTo(dx - 5, dy - 3);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, dy - 3, 0, dy + 3);
    g.addColorStop(0, '#ffe680');
    g.addColorStop(1, '#d99a12');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#7a5200';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  bar(-4, 4);
  bar(5, 4);
  bar(0.5, -2);
  ctx.restore();
}
export function drawMatIcon(ctx, x, y, k) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  for (const [dx, dy] of [[-5, 3], [5, 3], [0, -3]]) {
    ctx.beginPath();
    ctx.ellipse(dx, dy, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c99a5e';
    ctx.fill();
    ctx.strokeStyle = '#6a4a28';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(dx, dy, 2.2, 1.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Thumbnail of a building for upgrade cards.
export function buildingThumb(id, lvl, size = 72, garage = false, owned = true) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  const g = c.getContext('2d');
  const def = garage ? GARAGES.find((b) => b.id === id) : BUILDINGS.find((b) => b.id === id);
  const w = def.w;
  const h = def.h;
  const span = (w + h) * (TW / 2);
  const k = (size * 0.92) / Math.max(span, 110);
  g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  const saveOX = OX;
  const saveOY = OY;
  OX = size / k / 2 - ((w - h) * TW) / 4;
  OY = size / k - ((w + h) * TH) / 2 - 8;
  g.lineJoin = 'round';
  if (garage) drawGarage(g, id, 0, 0, w, h, owned);
  else drawBuilding(g, id, 0, 0, w, h, lvl);
  OX = saveOX;
  OY = saveOY;
  return c;
}
