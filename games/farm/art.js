// Everything on the farm and in expeditions is drawn in code (Canvas 2D). Coordinates are world units
// from iso.js: call these inside a transform where 1 unit = 1 world px.
import { P } from './iso.js';

export const hash = (x, y, s = 0) => {
  let h = Math.imul(x + 1013 * s, 374761393) ^ Math.imul(y + 7919 * s, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const center = (x, y) => P(x + 0.5, y + 0.5, 0);

const DEG = Math.PI / 180;
function poly(c, pts, fill) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}
function line(c, x1, y1, x2, y2, col, w = 1) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
}
function ell(c, x, y, rx, ry, col, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fillStyle = col;
  c.fill();
}
function circ(c, x, y, r, col) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = col;
  c.fill();
}
export function shadow(c, x, y, rx, a = 0.22) {
  ell(c, x, y, rx, rx * 0.46, `rgba(0,0,0,${a})`);
}
const diamond = (x, y, w = 1, h = 1, z = 0) => [P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)];

// ------------------------------------------------------------------ ground
export const PAL = {
  grass: { a: '#86d86f', b: '#6cc35a', dark: '#3f8a3c', tuft: '#4f9e45', lite: '#b8f08c', edge: 'rgba(20,50,20,0.16)' },
  lock: { a: '#5f7a4a', b: '#4e6a3c', dark: '#2f4a28', tuft: '#3c5a30', lite: '#7f9a68', edge: 'rgba(0,0,0,0.25)' },
  soil: { a: '#a8743f', b: '#8e5f32', dark: '#5e3c1f', tuft: '#6d4a25', lite: '#c99257', edge: 'rgba(40,20,0,0.25)' },
  forest: { a: '#5fae55', b: '#4a9a45', dark: '#2a5c33', tuft: '#3c8a3c', lite: '#8fd16c', edge: 'rgba(0,20,0,0.2)' },
  canyon: { a: '#dca468', b: '#c58b52', dark: '#7d4d2a', tuft: '#a86a3c', lite: '#f2c07e', edge: 'rgba(60,20,0,0.25)' },
  mine: { a: '#e4f3fa', b: '#c5e0ee', dark: '#7fa6bd', tuft: '#9cc6dc', lite: '#ffffff', edge: 'rgba(30,60,90,0.18)' },
  ruins: { a: '#cdbd9c', b: '#b5a486', dark: '#6f604a', tuft: '#8f7f63', lite: '#e8dcc0', edge: 'rgba(40,30,20,0.22)' },
  island: { a: '#f5dfa2', b: '#e6c982', dark: '#b08f55', tuft: '#c9a867', lite: '#fff3cf', edge: 'rgba(80,50,10,0.18)' },
  water: { a: '#4fc3d6', b: '#3aa9c2', dark: '#1f6f8a', tuft: '#8fe6f0', lite: '#c8f7ff', edge: 'rgba(0,50,70,0.2)' },
};

export function drawTile(c, x, y, pal, kind = 'grass', v = 0.5) {
  const pts = diamond(x, y);
  const g = c.createLinearGradient(...P(x, y), ...P(x + 1, y + 1));
  const base = kind === 'soil' ? PAL.soil : kind === 'lock' ? PAL.lock : pal;
  g.addColorStop(0, base.a);
  g.addColorStop(1, v > 0.5 ? base.b : base.a);
  poly(c, pts, g);
  if (kind === 'soil') {
    // furrows parallel to the top-left edge
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      const a = [x + t, y], b = [x, y + t];
      const p1 = P(...a, 0), p2 = P(x + 1, y + t, 0);
      const q1 = P(...b, 0), q2 = P(x + t, y + 1, 0);
      line(c, p1[0], p1[1] + 0.5, q1[0], q1[1] + 0.5, base.dark, 2.2);
      line(c, p2[0], p2[1] + 0.5, q2[0], q2[1] + 0.5, base.lite, 0.9);
    }
  } else if (kind === 'water') {
    for (let k = 0; k < 2; k++) {
      const [wx, wy] = P(x + 0.3 + k * 0.35, y + 0.6 - k * 0.2);
      ell(c, wx, wy, 9, 2.4, 'rgba(255,255,255,0.22)');
    }
  } else {
    // tufts
    for (let k = 0; k < 4; k++) {
      const hx = hash(x, y, k), hy = hash(y, x, k + 9);
      const [tx, ty] = P(x + 0.15 + hx * 0.7, y + 0.15 + hy * 0.7);
      line(c, tx, ty, tx - 1.5, ty - 3, base.tuft, 1);
      line(c, tx, ty, tx + 1.5, ty - 2.6, base.tuft, 1);
    }
    if (hash(x, y, 4) > 0.82) ell(c, ...P(x + 0.5, y + 0.5), 2.2, 1.2, base.lite);
  }
  c.strokeStyle = base.edge;
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(...pts[0]);
  for (let i = 1; i < 4; i++) c.lineTo(...pts[i]);
  c.closePath();
  c.stroke();
}

// Lock overlay (farm): dark tint over unbought land.
export function drawLockTint(c, x, y) {
  poly(c, diamond(x, y), 'rgba(4,6,10,0.28)');
}

// ------------------------------------------------------------------ small props
export function drawBush(c, cx, cy, s = 1, col = '#3f9a45', seed = 0) {
  shadow(c, cx, cy, 11 * s);
  const hi = '#7fd06a';
  circ(c, cx - 5 * s, cy - 5 * s, 5.6 * s, col);
  circ(c, cx + 5 * s, cy - 4 * s, 5.2 * s, col);
  circ(c, cx, cy - 10 * s, 6.4 * s, col);
  circ(c, cx - 2 * s, cy - 12 * s, 2.4 * s, hi);
  circ(c, cx + 3 * s + seed, cy - 7 * s, 1.8 * s, '#2c6e33');
}
export function drawStump(c, cx, cy, s = 1) {
  shadow(c, cx, cy, 9 * s);
  ell(c, cx, cy - 4 * s, 8 * s, 4 * s, '#8b5a2b');
  c.fillStyle = '#7a4a22';
  c.fillRect(cx - 8 * s, cy - 4 * s, 16 * s, 4 * s);
  ell(c, cx, cy - 8 * s, 8 * s, 4 * s, '#c48a4f');
  ell(c, cx, cy - 8 * s, 4.6 * s, 2.2 * s, '#a86c39');
  ell(c, cx, cy - 8 * s, 1.6 * s, 0.9 * s, '#d9a46c');
}
export function drawRock(c, cx, cy, s = 1, col = '#9aa0a8') {
  shadow(c, cx, cy, 13 * s);
  poly(c, [[cx - 11 * s, cy], [cx - 9 * s, cy - 9 * s], [cx - 2 * s, cy - 13 * s], [cx + 6 * s, cy - 9 * s], [cx + 11 * s, cy], [cx, cy + 3 * s]], col);
  poly(c, [[cx - 2 * s, cy - 13 * s], [cx + 6 * s, cy - 9 * s], [cx + 11 * s, cy], [cx + 1 * s, cy - 3 * s]], 'rgba(0,0,0,0.18)');
  poly(c, [[cx - 9 * s, cy - 9 * s], [cx - 2 * s, cy - 13 * s], [cx + 1 * s, cy - 6 * s]], 'rgba(255,255,255,0.35)');
  ell(c, cx + 5 * s, cy - 2 * s, 3 * s, 1.6 * s, 'rgba(0,0,0,0.12)');
}
export function drawTree(c, cx, cy, s, t, seed = 0) {
  shadow(c, cx, cy, 10 * s);
  const sw = Math.sin(t * 1.3 + seed * 6) * 0.8 * s;
  c.fillStyle = '#6b4424';
  c.fillRect(cx - 2 * s, cy - 13 * s, 4 * s, 13 * s);
  const top = cy - 20 * s;
  circ(c, cx + sw * 0.5, top + 4 * s, 9 * s, '#2f7d3a');
  circ(c, cx - 6 * s + sw, top + 6 * s, 7 * s, '#3b9046');
  circ(c, cx + 6 * s + sw, top + 6 * s, 7 * s, '#3b9046');
  circ(c, cx + sw, top - 2 * s, 8 * s, '#49a553');
  circ(c, cx - 3 * s + sw, top - 5 * s, 3 * s, '#7fd06a');
}
export function drawFlowers(c, cx, cy, t, seed = 0) {
  shadow(c, cx, cy, 8, 0.15);
  const cols = ['#ff6fa3', '#ffd23f', '#ffffff', '#b38cff', '#ff8a5c'];
  for (let i = 0; i < 6; i++) {
    const dx = (hash(i, seed, 1) - 0.5) * 16, dy = (hash(seed, i, 2) - 0.5) * 8;
    const sw = Math.sin(t * 2 + i + seed) * 0.8;
    line(c, cx + dx, cy + dy, cx + dx + sw, cy + dy - 5, '#3f8a3c', 1);
    circ(c, cx + dx + sw, cy + dy - 5.5, 2.2, cols[(i + seed) % cols.length]);
  }
}
export function drawScarecrow(c, cx, cy, t) {
  shadow(c, cx, cy, 8);
  c.fillStyle = '#7a5230';
  c.fillRect(cx - 1, cy - 26, 2.4, 26);
  c.fillRect(cx - 9, cy - 22, 18, 2.2);
  poly(c, [[cx - 4, cy - 22], [cx + 4, cy - 22], [cx + 5, cy - 9], [cx - 5, cy - 9]], '#e1622e');
  circ(c, cx, cy - 27, 4.2, '#f2d2a0');
  ell(c, cx, cy - 31, 8, 2.6, '#e8c15c');
  circ(c, cx, cy - 33, 3, '#d9a94a');
}
export function drawHay(c, cx, cy) {
  shadow(c, cx, cy, 11);
  for (const [dx, col] of [[-6, '#e7c04a'], [5, '#f1d060']]) {
    ell(c, cx + dx, cy - 7, 7, 7, col);
    ell(c, cx + dx, cy - 7, 7, 7, 'rgba(0,0,0,0)');
    line(c, cx + dx - 5, cy - 9, cx + dx + 5, cy - 5, 'rgba(120,80,20,0.4)', 1);
    line(c, cx + dx - 6, cy - 5, cx + dx + 4, cy - 10, 'rgba(120,80,20,0.4)', 1);
  }
}
export function drawPond(c, x, y, t) {
  const pts = diamond(x + 0.15, y + 0.15, 1.7, 1.7, 0);
  poly(c, pts, '#2b8fb0');
  const g = c.createRadialGradient(...P(x + 1, y + 1), 4, ...P(x + 1, y + 1), 60);
  g.addColorStop(0, 'rgba(160,240,255,0.7)');
  g.addColorStop(1, 'rgba(0,60,90,0)');
  poly(c, pts, g);
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.6 + k / 3) % 1;
    const [rx, ry] = P(x + 0.5 + k * 0.4, y + 1.2 - k * 0.3);
    c.beginPath();
    c.ellipse(rx, ry, 4 + ph * 8, (4 + ph * 8) * 0.5, 0, 0, Math.PI * 2);
    c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`;
    c.lineWidth = 1;
    c.stroke();
  }
  for (const [dx, dy] of [[0.5, 0.4], [1.2, 1.3], [0.7, 1.4]]) {
    const [lx, ly] = P(x + dx, y + dy);
    ell(c, lx, ly, 3.2, 1.6, '#3f9a4a');
  }
}

// ------------------------------------------------------------------ crops
export function drawCrop(c, x, y, id, frac, t) {
  const [cx, cy] = center(x, y);
  const seed = hash(x, y, 3);
  const s = 0.4 + 0.6 * Math.min(1, frac);
  const sway = Math.sin(t * 1.8 + seed * 6.28) * 1.4 * (0.4 + frac);
  const ready = frac >= 1;
  const green = '#6fb13a', dgreen = '#3f8a2c';
  shadow(c, cx, cy, 13 * s, 0.14);
  if (id === 'wheat') {
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * 4 + (hash(i, x, y) - 0.5) * 2;
      const h = (12 + hash(i, y, x) * 6) * s;
      const sx = sway * (0.5 + i * 0.08);
      line(c, cx + ox, cy, cx + ox + sx, cy - h, i % 2 ? green : dgreen, 1.3);
      const hx = cx + ox + sx, hy = cy - h;
      ell(c, hx, hy - 2.6 * s, 1.5 * s, 3.2 * s, ready ? '#f5cf4a' : '#d9c35a', sx * 0.04);
    }
  } else if (id === 'carrot') {
    for (let i = 0; i < 5; i++) {
      const a = (-70 + i * 35) * DEG;
      const L = (10 + hash(i, x, y) * 3) * s;
      const ex = cx + Math.cos(a - Math.PI / 2) * L * 0.9 + sway * 0.4, ey = cy - Math.abs(Math.sin(a)) * L - 4 * s;
      c.beginPath();
      c.moveTo(cx, cy);
      c.quadraticCurveTo(cx + (ex - cx) * 0.2, cy - L * 0.7, ex, ey);
      c.strokeStyle = i % 2 ? green : dgreen;
      c.lineWidth = 2.2;
      c.stroke();
    }
    if (frac > 0.75) ell(c, cx, cy - 1, 4.4 * s, 2.6 * s, '#ff8a3d');
  } else if (id === 'corn') {
    for (let i = 0; i < 3; i++) {
      const bx = cx + (i - 1) * 7;
      const h = (22 + hash(i, x, y) * 4) * s;
      line(c, bx, cy, bx + sway * 0.6 * (i - 1), cy - h, dgreen, 1.6);
      for (const sd of [-1, 1]) {
        c.beginPath();
        c.moveTo(bx + sway * 0.3, cy - h * 0.4);
        c.quadraticCurveTo(bx + sd * 8 * s, cy - h * 0.7, bx + sd * 9 * s + sway * 0.5, cy - h * 0.2);
        c.strokeStyle = green;
        c.lineWidth = 2;
        c.stroke();
      }
      if (frac > 0.55) ell(c, bx + sway * 0.2, cy - h * 0.6, 2.2 * s, 4.2 * s, '#ffd23f');
    }
  } else if (id === 'strawberry') {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05;
      circ(c, cx + Math.cos(a) * 7 * s + sway * 0.3, cy - 4 * s + Math.sin(a) * 3, 4.2 * s, i % 2 ? green : dgreen);
    }
    circ(c, cx + sway * 0.3, cy - 7 * s, 5 * s, green);
    if (frac > 0.5) {
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 0.4;
        circ(c, cx + Math.cos(a) * 6 * s, cy - 3 * s + Math.sin(a) * 3.5, 1.9, '#ff3d5e');
      }
    }
  } else if (id === 'pumpkin') {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + 0.2;
      ell(c, cx + Math.cos(a) * 11 * s, cy + Math.sin(a) * 5 * s, 4.4 * s, 2.2 * s, i % 2 ? green : dgreen, a);
    }
    if (frac > 0.3) ell(c, cx - 3 + sway * 0.2, cy - 3 * s, 6 * s * frac, 4.6 * s * frac, '#ff9a1f');
    if (frac > 0.6) ell(c, cx + 4, cy - 2 * s, 4 * s * frac, 3.4 * s * frac, '#ffb347');
  }
  if (ready) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + seed * 6);
    ell(c, cx, cy, 16, 8, `rgba(255,236,120,${0.12 + 0.12 * pulse})`);
    sparkle(c, cx + 9, cy - 22 - pulse * 2, 3 + pulse, t);
  }
}

export function sparkle(c, x, y, r, t) {
  const a = 0.6 + 0.4 * Math.sin(t * 6 + x);
  c.save();
  c.globalAlpha = a;
  c.beginPath();
  c.moveTo(x, y - r);
  c.lineTo(x + r * 0.28, y);
  c.lineTo(x, y + r);
  c.lineTo(x - r * 0.28, y);
  c.closePath();
  c.moveTo(x - r, y);
  c.lineTo(x, y + r * 0.28);
  c.lineTo(x + r, y);
  c.lineTo(x, y - r * 0.28);
  c.closePath();
  c.fillStyle = '#fff3b0';
  c.fill();
  c.restore();
}

// ------------------------------------------------------------------ prisms and buildings
const BPAL = {
  house: { L: '#f4e7c8', R: '#d9c59b', roof: '#9a4f2c', roofR: '#7d3e22', trim: '#ffffff', H: 20, RH: 12 },
  barn: { L: '#cf3d33', R: '#9c2a24', roof: '#3d4452', roofR: '#2b303b', trim: '#f4f0e6', H: 20, RH: 14 },
  mill: { L: '#f0e2bd', R: '#cdb88c', roof: '#b84a2c', roofR: '#8c351e', trim: '#fff7e0', H: 26, RH: 12 },
  bakery: { L: '#f7c98e', R: '#d89f63', roof: '#a2402c', roofR: '#7b2d1e', trim: '#fff4e0', H: 22, RH: 12 },
  dairy: { L: '#fbfaf5', R: '#d8d6cf', roof: '#3c6e91', roofR: '#2a5170', trim: '#3c6e91', H: 22, RH: 12 },
  sawmill: { L: '#b07a45', R: '#86572a', roof: '#66707d', roofR: '#4b535e', trim: '#e0c08a', H: 20, RH: 11 },
  kitchen: { L: '#f0d9a6', R: '#c9ad74', roof: '#7a3b8c', roofR: '#5b2a68', trim: '#fff0c7', H: 24, RH: 13 },
  hut: { L: '#e8d8b4', R: '#c4ae82', roof: '#9a4f2c', roofR: '#7d3e22', trim: '#fff', H: 10, RH: 8 },
};

function gableBlock(c, x, y, w, h, pal, t, opts = {}) {
  const H = pal.H, RH = pal.RH;
  // walls
  poly(c, [P(x, y + h, 0), P(x + w, y + h, 0), P(x + w, y + h, H), P(x, y + h, H)], pal.L);
  poly(c, [P(x + w, y, 0), P(x + w, y + h, 0), P(x + w, y + h, H), P(x + w, y, H)], pal.R);
  // back roof slope, gable end, front roof slope
  const ridgeA = P(x, y + h / 2, H + RH), ridgeB = P(x + w, y + h / 2, H + RH);
  poly(c, [P(x, y, H), P(x + w, y, H), ridgeB, ridgeA], pal.roofR);
  poly(c, [P(x, y + h, H), P(x + w, y + h, H), ridgeB, ridgeA], pal.roof);
  poly(c, [P(x + w, y, H), P(x + w, y + h, H), ridgeB], pal.roofR);
  line(c, ridgeA[0], ridgeA[1], ridgeB[0], ridgeB[1], 'rgba(0,0,0,0.25)', 1.2);
  // trim lines on the front wall
  line(c, ...P(x, y + h, H * 0.92), ...P(x + w, y + h, H * 0.92), pal.trim, 1.4);
  // windows (front-left wall)
  const fL = (u, z) => P(x + u * w, y + h, z);
  const fR = (u, z) => P(x + w, y + u * h, z);
  if (!opts.noWindows) {
    for (const u of [0.22, 0.78]) {
      const a = fL(u - 0.08, H * 0.3), b = fL(u + 0.08, H * 0.82);
      poly(c, [a, fL(u + 0.08, H * 0.3), b, fL(u - 0.08, H * 0.82)], '#ffe9a3');
      line(c, ...fL(u, H * 0.3), ...fL(u, H * 0.82), pal.trim, 0.8);
    }
    const a = fR(0.5 - 0.1, H * 0.35), b = fR(0.5 + 0.1, H * 0.8);
    poly(c, [a, fR(0.5 + 0.1, H * 0.35), b, fR(0.5 - 0.1, H * 0.8)], '#ffe9a3');
  }
  // door on the front wall
  const d1 = fL(0.5 - 0.1, 0), d2 = fL(0.5 + 0.1, H * 0.5);
  poly(c, [d1, fL(0.5 + 0.1, 0), d2, fL(0.5 - 0.1, H * 0.5)], '#4a2a16');
  if (opts.xDoor) {
    const xa = fL(0.5 - 0.1, H * 0.5), xb = fL(0.5 + 0.1, 0);
    line(c, ...xa, ...xb, pal.trim, 1);
    line(c, ...fL(0.5 - 0.1, 0), ...fL(0.5 + 0.1, H * 0.5), pal.trim, 1);
  }
  if (opts.chimney) {
    const cx0 = P(x + w * 0.25, y + h * 0.3, H + RH * 0.45);
    c.fillStyle = '#7a4a3a';
    c.fillRect(cx0[0] - 2.5, cx0[1] - 9, 5, 9);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.45 + i / 3) % 1;
      circ(c, cx0[0] + ph * 4, cx0[1] - 11 - ph * 20, 2.5 + ph * 4, `rgba(240,240,240,${0.5 * (1 - ph)})`);
    }
  }
}

export function drawBuilding(c, b, t) {
  const pal = BPAL[b.t];
  const x = b.x, y = b.y, w = b.w, h = b.h;
  shadow(c, ...P(x + w / 2, y + h / 2), 34, 0.25);
  gableBlock(c, x, y, w, h, pal, t, {
    xDoor: b.t === 'barn',
    chimney: ['house', 'bakery', 'kitchen', 'sawmill'].includes(b.t),
  });
  const top = P(x + w / 2, y + h / 2, pal.H + pal.RH + 4);
  if (b.t === 'mill') {
    const hub = P(x + w, y + h / 2, pal.H * 0.7);
    for (let k = 0; k < 4; k++) {
      const a = t * 1.2 + k * Math.PI / 2;
      line(c, hub[0], hub[1], hub[0] + Math.cos(a) * 15, hub[1] + Math.sin(a) * 15, '#fff7e0', 2.4);
    }
    circ(c, hub[0], hub[1], 2.5, '#6b4424');
  }
  if (b.t === 'sawmill') {
    const hub = P(x + w, y + h / 2, pal.H * 0.5);
    circ(c, hub[0], hub[1], 7, '#c9ced6');
    for (let k = 0; k < 8; k++) {
      const a = t * 4 + k * Math.PI / 4;
      line(c, hub[0], hub[1], hub[0] + Math.cos(a) * 7, hub[1] + Math.sin(a) * 4, '#8d96a3', 1.5);
    }
  }
  if (b.t === 'house') {
    // flower boxes
    for (const u of [0.22, 0.78]) {
      const p = P(x + u * w, y + h + 0.05, 2);
      poly(c, [[p[0] - 6, p[1]], [p[0] + 6, p[1]], [p[0] + 5, p[1] + 3], [p[0] - 5, p[1] + 3]], '#7a4a22');
      circ(c, p[0] - 3, p[1] - 1.5, 2, '#ff6fa3');
      circ(c, p[0] + 2, p[1] - 2, 2, '#ffd23f');
    }
  }
  if (b.t === 'barn' || b.t === 'house') {
    // loft/door arch detail is handled by walls; nothing more
  }
  // badge
  const badge = {
    house: '🏡', barn: '', mill: '⚙️', bakery: '🥖', dairy: '🧈', sawmill: '🪚', kitchen: '🍳',
  }[b.t];
  if (badge) {
    const bob = Math.sin(t * 2.2) * 1.5;
    c.font = '15px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(10,10,12,0.75)';
    c.beginPath();
    c.arc(top[0], top[1] - 6 + bob, 11, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(243,194,74,0.8)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#fff';
    c.fillText(badge, top[0], top[1] - 5.5 + bob);
  }
}

export function drawHut(c, x, y) {
  gableBlock(c, x + 0.1, y + 0.1, 0.8, 0.8, BPAL.hut, 0, { noWindows: true });
}

// Paddock fence around a 2x2 pen plus its animals.
export function drawFence(c, x, y, w, h) {
  const posts = [];
  const edge = (a, b) => {
    for (const u of [0, 0.5, 1]) {
      const p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      posts.push(P(p[0], p[1], 0));
    }
  };
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (let i = 0; i < 4; i++) edge(corners[i], corners[(i + 1) % 4]);
  for (let z of [5, 9]) {
    for (let i = 0; i < 4; i++) {
      const a = P(...corners[i], z), b = P(...corners[(i + 1) % 4], z);
      line(c, a[0], a[1], b[0], b[1], '#f1e2bd', 1.6);
    }
  }
  for (const [px, py] of posts) {
    c.fillStyle = '#c99a5b';
    c.fillRect(px - 1.4, py - 11, 2.8, 11);
  }
}

// ------------------------------------------------------------------ animals
export const ANIMAL_SCALE = { chicken: 0.55, cow: 1, sheep: 0.85, pig: 0.75 };
export function drawAnimal(c, kind, wx, wy, dir, t, ph, moving) {
  const s = ANIMAL_SCALE[kind];
  const bob = Math.abs(Math.sin(t * (moving ? 9 : 2.5) + ph)) * (moving ? 1.8 : 0.7) * s;
  const yy = wy - bob;
  shadow(c, wx, wy, 7 * s, 0.22);
  c.save();
  c.translate(wx, yy);
  c.scale(dir, 1);
  const legs = moving ? Math.sin(t * 12 + ph) * 1.6 * s : 0;
  if (kind === 'chicken') {
    line(c, -1, 0, -1 + legs * 0.3, 0.2, '#e8a33d', 0.9);
    line(c, 1.2, 0, 1.2 - legs * 0.3, 0.2, '#e8a33d', 0.9);
    ell(c, 0, -4 * s, 4.2 * s, 3.3 * s, '#fffaf0');
    ell(c, -0.5, -4.3 * s, 2.2 * s, 2 * s, '#e9dfcc');
    circ(c, 2.8 * s, -8.2 * s, 2.3 * s, '#fffaf0');
    circ(c, 2.1 * s, -10.6 * s, 1.1 * s, '#e0262c');
    poly(c, [[4.8 * s, -8.4 * s], [6.6 * s, -7.6 * s], [4.8 * s, -6.9 * s]], '#f7a233');
    circ(c, 3.5 * s, -8.8 * s, 0.6 * s, '#1b1b1b');
  } else if (kind === 'cow') {
    line(c, -4, -3, -4 + legs * 0.4, 0, '#2a2a2a', 2);
    line(c, 4, -3, 4 - legs * 0.4, 0, '#2a2a2a', 2);
    line(c, -2.5, -3, -2.5 - legs * 0.4, 0, '#2a2a2a', 2);
    line(c, 2.5, -3, 2.5 + legs * 0.4, 0, '#2a2a2a', 2);
    ell(c, 0, -8.5, 9.5, 5.2, '#fbfbf7');
    ell(c, -3, -9, 3.4, 2.6, '#2b2b2b');
    ell(c, 3.5, -10.5, 2.4, 2, '#2b2b2b');
    ell(c, 9, -12, 4.4, 3.8, '#fbfbf7');
    ell(c, 11.2, -10.6, 2.1, 1.5, '#f2a7b5');
    circ(c, 8, -13, 0.7, '#1b1b1b');
    poly(c, [[7, -15.5], [5.8, -18], [8.2, -16]], '#d9d9d9');
  } else if (kind === 'sheep') {
    line(c, -2.5, -2, -2.5 - legs * 0.3, 0, '#3b3b45', 1.4);
    line(c, 2.5, -2, 2.5 + legs * 0.3, 0, '#3b3b45', 1.4);
    for (const [dx, dy, r] of [[-3, -7, 3.6], [0, -9, 3.8], [3.2, -7, 3.6], [-1.5, -4.6, 3.2], [1.8, -4.4, 3.1]]) circ(c, dx * s, dy * s, r * s, '#f4f4ee');
    circ(c, 5.2 * s, -8 * s, 2.8 * s, '#3b3b45');
    circ(c, 6.2 * s, -8.8 * s, 0.6 * s, '#fff');
  } else if (kind === 'pig') {
    line(c, -4, -2.5, -4 - legs * 0.3, 0, '#e58da1', 2);
    line(c, 3.5, -2.5, 3.5 + legs * 0.3, 0, '#e58da1', 2);
    ell(c, 0, -6.5, 8, 5.4, '#f7b3c2');
    ell(c, 8, -6, 2.6, 2, '#f29bb0');
    circ(c, 8.6, -6.4, 0.5, '#8a3c4f');
    circ(c, 9.2, -5.4, 0.5, '#8a3c4f');
    poly(c, [[4, -10.5], [6.5, -13.5], [6.5, -9.5]], '#f09aae');
    circ(c, 4.8, -8.8, 0.6, '#1b1b1b');
    c.beginPath();
    c.arc(-8, -8, 2, 0, Math.PI * 1.4);
    c.strokeStyle = '#f7b3c2';
    c.lineWidth = 1;
    c.stroke();
  }
  c.restore();
}

// Speech bubble with an emoji and a count, above a building/pen.
export function bubble(c, wx, wy, emoji, n, t) {
  const bob = Math.sin(t * 4) * 1.6;
  const x = wx, y = wy - 4 + bob;
  c.fillStyle = 'rgba(255,250,235,0.97)';
  c.strokeStyle = 'rgba(243,194,74,0.95)';
  c.lineWidth = 1.4;
  c.beginPath();
  c.roundRect ? c.roundRect(x - 14, y - 13, 28, 20, 8) : c.rect(x - 14, y - 13, 28, 20);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(x - 3, y + 7);
  c.lineTo(x, y + 11);
  c.lineTo(x + 3, y + 7);
  c.fillStyle = 'rgba(255,250,235,0.97)';
  c.fill();
  c.font = '13px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#1a1a1a';
  c.fillText(emoji, x - 4, y - 3);
  if (n > 1) {
    c.font = '900 9px sans-serif';
    c.fillStyle = '#b9790c';
    c.fillText('×' + n, x + 8, y + 4);
  }
}

// Progress ring (0..1) for busy pens/buildings.
export function ring(c, wx, wy, frac, r = 9) {
  c.beginPath();
  c.arc(wx, wy, r, 0, Math.PI * 2);
  c.fillStyle = 'rgba(10,10,12,0.7)';
  c.fill();
  c.beginPath();
  c.arc(wx, wy, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, frac)));
  c.strokeStyle = '#f3c24a';
  c.lineWidth = 2.6;
  c.lineCap = 'round';
  c.stroke();
}

export function drawLockPad(c, x, y, t) {
  const [cx, cy] = center(x, y);
  const bob = Math.sin(t * 3 + x) * 1.2;
  c.fillStyle = 'rgba(10,10,12,0.8)';
  c.beginPath();
  c.arc(cx, cy - 16 + bob, 9, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#f3c24a';
  c.lineWidth = 1.6;
  c.stroke();
  c.fillStyle = '#f3c24a';
  c.beginPath();
  c.roundRect ? c.roundRect(cx - 4, cy - 16.5 + bob, 8, 6.5, 1.5) : c.rect(cx - 4, cy - 16.5 + bob, 8, 6.5);
  c.fill();
  c.beginPath();
  c.arc(cx, cy - 18.5 + bob, 2.6, Math.PI, 0);
  c.strokeStyle = '#f3c24a';
  c.lineWidth = 1.6;
  c.stroke();
}

// ------------------------------------------------------------------ expedition covers and goal
export function drawCover(c, x, y, kind, t) {
  const [cx, cy] = center(x, y);
  const s = 1;
  switch (kind) {
    case 'bush': drawBush(c, cx, cy, s, '#2f7a3a', hash(x, y, 2)); break;
    case 'vine': {
      poly(c, diamond(x + 0.22, y + 0.22, 0.56, 0.56, 6), '#8a8f97');
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.moveTo(cx - 8 + k * 6, cy - 6);
        c.quadraticCurveTo(cx - 6 + k * 6 + Math.sin(t + k) * 2, cy - 14, cx - 2 + k * 6, cy - 10);
        c.strokeStyle = '#3d9a47';
        c.lineWidth = 2;
        c.stroke();
      }
      break;
    }
    case 'debris':
      shadow(c, cx, cy, 11);
      line(c, cx - 9, cy - 2, cx + 9, cy - 6, '#6b4424', 3);
      line(c, cx - 8, cy - 7, cx + 8, cy + 1, '#8a5a30', 3);
      line(c, cx - 3, cy + 1, cx + 6, cy - 9, '#7a4a22', 2.4);
      ell(c, cx + 4, cy - 1, 2.4, 1.4, '#c0832f');
      break;
    case 'rock': drawRock(c, cx, cy, s, '#9aa3ad'); break;
    case 'boulder': drawRock(c, cx, cy, 1.35, '#7d8590'); break;
    case 'rubble':
      shadow(c, cx, cy, 12);
      poly(c, [[cx - 9, cy], [cx - 4, cy - 6], [cx + 2, cy - 2], [cx - 2, cy + 1]], '#b6a88a');
      poly(c, [[cx + 1, cy], [cx + 8, cy - 5], [cx + 11, cy], [cx + 4, cy + 2]], '#a39678');
      c.fillStyle = '#c9bb9c';
      c.fillRect(cx - 3, cy - 16, 5, 12);
      c.fillStyle = '#9d907a';
      c.fillRect(cx - 3, cy - 16, 2, 12);
      break;
    case 'ice':
      shadow(c, cx, cy, 12);
      for (const [dx, h] of [[-6, 16], [0, 22], [6, 13]]) {
        poly(c, [[cx + dx - 4, cy], [cx + dx, cy - h], [cx + dx + 4, cy], [cx + dx, cy + 2]], 'rgba(170,225,255,0.92)');
        poly(c, [[cx + dx, cy - h], [cx + dx + 4, cy], [cx + dx, cy + 2]], 'rgba(80,140,200,0.5)');
        line(c, cx + dx - 1, cy - h + 3, cx + dx - 1, cy - 3, 'rgba(255,255,255,0.8)', 1);
      }
      break;
    case 'palm':
      shadow(c, cx, cy, 9);
      c.beginPath();
      c.moveTo(cx, cy);
      c.quadraticCurveTo(cx + 4, cy - 12, cx + 8, cy - 22);
      c.strokeStyle = '#8b5a2b';
      c.lineWidth = 3;
      c.stroke();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.55 + Math.sin(t * 1.5 + k) * 0.08;
        c.beginPath();
        c.moveTo(cx + 8, cy - 22);
        c.quadraticCurveTo(cx + 8 + Math.cos(a) * 9, cy - 22 + Math.sin(a) * 4 - 5, cx + 8 + Math.cos(a) * 14, cy - 22 + Math.sin(a) * 10);
        c.strokeStyle = '#2f9a4a';
        c.lineWidth = 2.6;
        c.stroke();
      }
      break;
    default:
      drawBush(c, cx, cy, s);
  }
}

export function drawItemOnTile(c, x, y, emoji, t) {
  const [cx, cy] = center(x, y);
  const bob = Math.sin(t * 3 + x * 2) * 1.2;
  shadow(c, cx, cy, 8, 0.2);
  c.font = '18px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(emoji, cx, cy - 6 + bob);
}

export function drawChest(c, x, y, t) {
  const [cx, cy] = center(x, y);
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + x);
  ell(c, cx, cy, 16, 8, `rgba(255,220,90,${0.14 + 0.14 * pulse})`);
  shadow(c, cx, cy, 10);
  c.fillStyle = '#8b4f1c';
  c.fillRect(cx - 9, cy - 10, 18, 9);
  c.fillStyle = '#f3c24a';
  c.fillRect(cx - 9, cy - 10, 18, 2);
  c.beginPath();
  c.arc(cx, cy - 10, 9, Math.PI, 0);
  c.fillStyle = '#b06a2a';
  c.fill();
  c.fillStyle = '#ffd868';
  c.fillRect(cx - 1.6, cy - 12, 3.2, 5);
  c.fillRect(cx - 9, cy - 9, 18, 1.3);
}

export function drawGoal(c, x, y, kind, color, t) {
  const [cx, cy] = center(x, y);
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
  c.beginPath();
  c.ellipse(cx, cy, 20 + pulse * 3, 10 + pulse * 1.5, 0, 0, Math.PI * 2);
  c.strokeStyle = `rgba(255,230,120,${0.5 + 0.4 * pulse})`;
  c.lineWidth = 2.5;
  c.stroke();
  ell(c, cx, cy, 16, 8, 'rgba(255,230,120,0.15)');
  shadow(c, cx, cy, 10);
  c.fillStyle = '#e8d8a4';
  c.fillRect(cx - 4, cy - 26, 8, 26);
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(cx + 1, cy - 26, 3, 26);
  const wave = Math.sin(t * 5) * 2;
  poly(c, [[cx + 4, cy - 26], [cx + 18 + wave, cy - 22], [cx + 4, cy - 16]], color);
  c.font = '11px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
}

export function drawFog(c, x, y, t) {
  const pts = diamond(x, y);
  poly(c, pts, 'rgba(8,6,16,0.86)');
  const [cx, cy] = center(x, y);
  const a = 0.05 + 0.03 * Math.sin(t * 0.8 + x * 3 + y);
  ell(c, cx + Math.sin(t + x) * 3, cy, 14, 7, `rgba(120,110,190,${a})`);
}

export function drawAdventurer(c, x, y, t, moving) {
  const [cx, cy] = center(x, y);
  const bob = Math.abs(Math.sin(t * 6)) * 1.5;
  shadow(c, cx, cy, 8);
  const py = cy - bob;
  c.fillStyle = '#6b3d1f';
  c.fillRect(cx - 5, py - 14, 4, 9);
  ell(c, cx, py - 10, 5, 6, '#e0463a');
  ell(c, cx, py - 17, 4, 4.2, '#f2c9a0');
  c.fillStyle = '#7a4a22';
  c.fillRect(cx - 8, py - 22, 16, 2.4);
  ell(c, cx, py - 22, 5, 3, '#8a5a30');
  c.fillStyle = '#2a2a33';
  c.fillRect(cx - 3, py - 2, 2.2, 3);
  c.fillRect(cx + 1, py - 2, 2.2, moving ? 1.8 : 3);
}
