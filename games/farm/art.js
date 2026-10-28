// All world art for Fazenda Aventura, painted with Canvas 2D in world units (see iso.js:
// a tile is 64 x 32). Static scenery (ground, forest, water, fences) is drawn into cached chunks;
// living things (crops, animals, people, buildings with smoke) are drawn every frame.
import { P } from './iso.js';

export const hash = (x, y, s = 0) => {
  let h = Math.imul((x | 0) + 1013 * s, 374761393) ^ Math.imul((y | 0) + 7919 * s, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const center = (x, y) => P(x + 0.5, y + 0.5, 0);
const TAU = Math.PI * 2;
const INK = 'rgba(52,32,14,0.6)';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// ------------------------------------------------------------------ primitives
function poly(c, pts, fill, stroke, lw = 1) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}
function line(c, x1, y1, x2, y2, col, w = 1, cap = 'round') {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = cap;
  c.stroke();
}
function ell(c, x, y, rx, ry, fill, stroke, lw = 1, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function circ(c, x, y, r, fill, stroke, lw = 1) { ell(c, x, y, r, r, fill, stroke, lw); }
function rrect(c, x, y, w, h, r, fill, stroke, lw = 1) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
// Lit ball: radial gradient from a highlight to a base colour.
function ball(c, x, y, r, light, base, dark, stroke) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, dark);
  circ(c, x, y, r, g, stroke, 1);
}
// Soft contact shadow (ambient occlusion feel).
export function shadow(c, x, y, rx, a = 0.32, ry = rx * 0.5) {
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(20,30,10,${a})`);
  g.addColorStop(0.6, `rgba(20,30,10,${a * 0.55})`);
  g.addColorStop(1, 'rgba(20,30,10,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rx, 0, TAU);
  c.fill();
  c.restore();
}
const diamond = (x, y, w = 1, h = 1, z = 0, g = 0) => [P(x - g, y - g, z), P(x + w + g, y - g, z), P(x + w + g, y + h + g, z), P(x - g, y + h + g, z)];
export function emoji(c, ch, x, y, size) {
  c.font = `${size}px ${EMOJI_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#000';
  c.fillText(ch, x, y);
}

// ------------------------------------------------------------------ ground (static)
export const GROUND = {
  grass: { base: '#7ccb45', lite: '#a8e46a', dark: '#4f9f2e', blade: ['#5aa833', '#94d85a', '#4a9128'], flowers: true },
  forest: { base: '#5ea93a', lite: '#86cc56', dark: '#3d7f25', blade: ['#4b922c', '#77bd47'], flowers: false },
  sand: { base: '#f2d48e', lite: '#fbe7b4', dark: '#d9b064', blade: ['#e2bd72', '#fff0c8'], flowers: false, pebbles: true },
  snow: { base: '#eef6fb', lite: '#ffffff', dark: '#c6dcea', blade: ['#d7e7f2', '#ffffff'], flowers: false, sparkle: true },
  canyon: { base: '#e3a565', lite: '#f6c58a', dark: '#bf7a40', blade: ['#c98a4e', '#f2bd84'], flowers: false, pebbles: true },
  ruins: { base: '#86b45a', lite: '#a9d27a', dark: '#5f8d3c', blade: ['#6e9f45', '#9dcc6c'], flowers: true },
};

// Fill a rect with the base colour, then paint per-tile patches, blades and flowers.
export function paintGround(c, rect, pal, tiles) {
  c.fillStyle = pal.base;
  c.fillRect(rect.x0 - 2, rect.y0 - 2, rect.x1 - rect.x0 + 4, rect.y1 - rect.y0 + 4);
  for (const [x, y] of tiles) {
    const [cx, cy] = center(x, y);
    const h1 = hash(x, y, 21), h2 = hash(y, x, 22);
    const px = cx + (h1 - 0.5) * 40, py = cy + (h2 - 0.5) * 20;
    const r = 34 + h1 * 40;
    const col = h2 > 0.5 ? pal.lite : pal.dark;
    c.save();
    c.translate(px, py);
    c.scale(1, 0.5);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, hexA(col, 0.5));
    g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fill();
    c.restore();
  }
  for (const [x, y] of tiles) {
    for (let k = 0; k < 9; k++) {
      const u = hash(x, y, 30 + k), v = hash(y, x, 50 + k);
      const [bx, by] = P(x + u, y + v);
      const col = pal.blade[k % pal.blade.length];
      line(c, bx, by, bx - 1.6, by - 3.6, col, 1.1);
      line(c, bx, by, bx + 1.5, by - 3.2, col, 1.1);
    }
    if (pal.flowers && hash(x, y, 70) < 0.42) {
      const n = 1 + Math.floor(hash(x, y, 71) * 3);
      for (let k = 0; k < n; k++) {
        const [fx, fy] = P(x + hash(x, y, 72 + k), y + hash(y, x, 75 + k));
        const pick = hash(x, y, 80 + k);
        const petal = pick < 0.45 ? '#ffffff' : pick < 0.7 ? '#ffe14d' : pick < 0.85 ? '#ff8fbf' : '#b48cff';
        for (let a = 0; a < 5; a++) circ(c, fx + Math.cos(a * 1.26) * 1.6, fy + Math.sin(a * 1.26) * 0.9, 1.15, petal);
        circ(c, fx, fy, 0.8, pick < 0.45 ? '#ffd23f' : '#fff6c0');
      }
    }
    if (pal.pebbles && hash(x, y, 90) < 0.3) {
      const [fx, fy] = P(x + hash(x, y, 91), y + hash(y, x, 92));
      ell(c, fx, fy, 2.6, 1.6, pal.dark);
      ell(c, fx - 0.6, fy - 0.5, 1.2, 0.6, pal.lite);
    }
    if (pal.sparkle && hash(x, y, 93) < 0.25) {
      const [fx, fy] = P(x + hash(x, y, 94), y + hash(y, x, 95));
      line(c, fx - 2, fy, fx + 2, fy, '#ffffff', 0.8);
      line(c, fx, fy - 2, fx, fy + 2, '#ffffff', 0.8);
    }
  }
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawPathTile(c, x, y) {
  poly(c, diamond(x, y, 1, 1, 0, 0.04), '#cdb98f');
  for (let k = 0; k < 7; k++) {
    const u = 0.15 + hash(x, y, 100 + k) * 0.7, v = 0.15 + hash(y, x, 110 + k) * 0.7;
    const [sx, sy] = P(x + u, y + v);
    const r = 5 + hash(x, y, 120 + k) * 3;
    ell(c, sx, sy + 0.8, r, r * 0.55, '#8f877a');
    ell(c, sx, sy, r, r * 0.55, k % 2 ? '#b8b2a6' : '#c9c3b6', 'rgba(80,70,55,0.35)', 0.6);
    ell(c, sx - r * 0.25, sy - r * 0.18, r * 0.45, r * 0.2, 'rgba(255,255,255,0.35)');
  }
}

export function drawSoilTile(c, x, y) {
  poly(c, diamond(x, y, 1, 1, 0, 0.02), '#6b4426');
  poly(c, diamond(x + 0.06, y + 0.06, 0.88, 0.88), '#8a5a33');
  for (let k = 1; k <= 4; k++) {
    const t = k / 5;
    const a = P(x + 0.08, y + t), b = P(x + 0.92, y + t);
    line(c, a[0], a[1] + 1, b[0], b[1] + 1, '#5a361c', 2.4);
    line(c, a[0], a[1] - 0.6, b[0], b[1] - 0.6, '#a87444', 1.2);
  }
}

export function drawWaterTile(c, x, y, edges, deep = false) {
  const pts = diamond(x, y, 1, 1, 0, 0.04);
  poly(c, pts, deep ? '#239fd0' : '#3cbfe0');
  for (let k = 0; k < 2; k++) {
    const [wx, wy] = P(x + 0.2 + hash(x, y, 130 + k) * 0.6, y + 0.2 + hash(y, x, 131 + k) * 0.6);
    line(c, wx - 6, wy, wx + 6, wy, 'rgba(255,255,255,0.45)', 1.2);
  }
  // shoreline foam on edges that touch land: [top-right, bottom-right, bottom-left, top-left]
  const corners = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
  const sides = [[0, 1], [1, 2], [2, 3], [3, 0]];
  edges.forEach((on, i) => {
    if (!on) return;
    const [p, q] = sides[i];
    line(c, corners[p][0], corners[p][1], corners[q][0], corners[q][1], 'rgba(255,255,255,0.75)', 3);
    line(c, corners[p][0], corners[p][1] + 2, corners[q][0], corners[q][1] + 2, 'rgba(255,255,255,0.3)', 2);
  });
}

// Lush river bank stones on a land tile next to water.
export function drawBankStones(c, x, y) {
  for (let k = 0; k < 3; k++) {
    const [sx, sy] = P(x + 0.2 + hash(x, y, 140 + k) * 0.6, y + 0.2 + hash(y, x, 141 + k) * 0.6);
    ell(c, sx, sy, 4, 2.4, '#9c968a', INK, 0.5);
  }
}

// ------------------------------------------------------------------ vegetation
export function drawPine(c, cx, cy, s = 1, seed = 0, snow = false) {
  shadow(c, cx + 4 * s, cy, 15 * s, 0.35);
  c.fillStyle = '#6b4424';
  c.fillRect(cx - 2.2 * s, cy - 10 * s, 4.4 * s, 10 * s);
  const tiers = [[0, 17, 15], [-11, 14, 13], [-21, 10, 11]];
  const dark = seed > 0.5 ? '#1f6b3a' : '#24733c';
  for (const [dy, half, hgt] of tiers) {
    const top = cy - 10 * s + dy * s - hgt * s, base = cy - 8 * s + dy * s;
    poly(c, [[cx, top], [cx + half * s, base], [cx - half * s, base]], dark, 'rgba(10,40,20,0.5)', 0.8);
    poly(c, [[cx, top], [cx - half * s, base], [cx - half * 0.15 * s, base - 1 * s]], 'rgba(120,200,110,0.35)');
    if (snow) poly(c, [[cx, top], [cx + half * 0.55 * s, top + hgt * 0.5 * s], [cx - half * 0.55 * s, top + hgt * 0.5 * s]], '#f4fbff');
  }
}
export function drawTree(c, cx, cy, s = 1, t = 0, seed = 0) {
  shadow(c, cx + 5 * s, cy, 18 * s, 0.35);
  const sw = Math.sin(t * 1.2 + seed * 7) * 0.6 * s;
  c.fillStyle = '#6e4626';
  poly(c, [[cx - 3 * s, cy], [cx - 2 * s, cy - 16 * s], [cx + 2 * s, cy - 16 * s], [cx + 3 * s, cy]], '#7a4e2a', INK, 0.6);
  const top = cy - 28 * s;
  const tint = seed > 0.66 ? ['#a9dc5c', '#3f9a34', '#1f5e26'] : seed > 0.33 ? ['#9fd45a', '#358a30', '#1b5424'] : ['#bfe56e', '#4ea83c', '#276b2a'];
  ball(c, cx - 9 * s + sw, top + 7 * s, 10 * s, ...tint, 'rgba(20,60,20,0.45)');
  ball(c, cx + 9 * s + sw, top + 7 * s, 10 * s, ...tint, 'rgba(20,60,20,0.45)');
  ball(c, cx + sw, top - 3 * s, 13 * s, ...tint, 'rgba(20,60,20,0.45)');
  ball(c, cx + sw * 0.7, top + 9 * s, 9 * s, ...tint);
  if (seed > 0.9) for (let k = 0; k < 4; k++) circ(c, cx + (hash(k, 9, seed * 99) - 0.5) * 22 * s + sw, top + (hash(9, k, seed * 77) - 0.4) * 16 * s, 1.8 * s, '#ff5a4a');
}
export function drawBush(c, cx, cy, s = 1, seed = 0, flowers = false) {
  shadow(c, cx + 2, cy, 13 * s, 0.33);
  const tint = ['#a9e06a', '#4ea83c', '#2b6e2d'];
  ball(c, cx - 6 * s, cy - 5 * s, 7 * s, ...tint, 'rgba(20,60,20,0.45)');
  ball(c, cx + 6 * s, cy - 5 * s, 7 * s, ...tint, 'rgba(20,60,20,0.45)');
  ball(c, cx, cy - 10 * s, 8.5 * s, ...tint, 'rgba(20,60,20,0.45)');
  if (flowers || seed > 0.7) for (let k = 0; k < 5; k++) circ(c, cx + (hash(k, 3, seed * 50) - 0.5) * 18 * s, cy - 4 * s - hash(3, k, seed * 40) * 12 * s, 1.5 * s, k % 2 ? '#ff7fb0' : '#ffffff');
}
export function drawRock(c, cx, cy, s = 1, col = '#a7adb5') {
  shadow(c, cx + 2, cy + 1, 15 * s, 0.35);
  const pts = [[cx - 13 * s, cy], [cx - 11 * s, cy - 9 * s], [cx - 3 * s, cy - 15 * s], [cx + 7 * s, cy - 11 * s], [cx + 13 * s, cy - 1 * s], [cx + 2 * s, cy + 3 * s]];
  poly(c, pts, col, INK, 0.9);
  poly(c, [[cx - 3 * s, cy - 15 * s], [cx + 7 * s, cy - 11 * s], [cx + 13 * s, cy - 1 * s], [cx + 2 * s, cy - 4 * s]], 'rgba(0,0,0,0.16)');
  poly(c, [[cx - 11 * s, cy - 9 * s], [cx - 3 * s, cy - 15 * s], [cx + 1 * s, cy - 7 * s], [cx - 7 * s, cy - 4 * s]], 'rgba(255,255,255,0.4)');
  ell(c, cx - 6 * s, cy - 2 * s, 2.5 * s, 1.2 * s, 'rgba(110,160,70,0.6)');
}
export function drawStump(c, cx, cy, s = 1) {
  shadow(c, cx + 2, cy, 12 * s, 0.35);
  poly(c, [[cx - 9 * s, cy - 8 * s], [cx + 9 * s, cy - 8 * s], [cx + 10 * s, cy], [cx - 10 * s, cy]], '#7b4d27', INK, 0.8);
  ell(c, cx, cy, 10 * s, 4.5 * s, '#6a3f1e');
  ell(c, cx, cy - 8 * s, 9 * s, 4.2 * s, '#d9a46c', INK, 0.8);
  ell(c, cx, cy - 8 * s, 5.5 * s, 2.5 * s, null, '#b07a45', 0.8);
  ell(c, cx, cy - 8 * s, 2 * s, 1 * s, '#b07a45');
  line(c, cx + 9 * s, cy - 3 * s, cx + 14 * s, cy - 1 * s, '#7b4d27', 2.4 * s);
}

// ------------------------------------------------------------------ fences, props
// A wooden fence run between two world points (posts and two rails).
export function drawFenceRun(c, a, b, posts = 3) {
  const lift = (p, z) => [p[0], p[1] - z];
  for (const z of [5, 10]) {
    line(c, ...lift(a, z), ...lift(b, z), '#7a5030', 3.2);
    line(c, ...lift(a, z + 0.8), ...lift(b, z + 0.8), '#c99363', 1.4);
  }
  for (let k = 0; k <= posts; k++) {
    const u = k / posts;
    const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
    rrect(c, x - 2, y - 14, 4, 14, 1, '#9a6a3e', INK, 0.6);
    rrect(c, x - 2, y - 14, 4, 2.4, 1, '#d6a774');
  }
}

export function drawHayStack(c, cx, cy) {
  shadow(c, cx + 3, cy + 1, 24, 0.35);
  const bale = (x, y, w, h) => {
    poly(c, [[x, y], [x + w, y - w * 0.25], [x + w, y - w * 0.25 - h], [x, y - h]], '#e9b949', INK, 0.8);
    poly(c, [[x, y], [x - w * 0.55, y - w * 0.3], [x - w * 0.55, y - w * 0.3 - h], [x, y - h]], '#c99528', INK, 0.8);
    poly(c, [[x, y - h], [x + w, y - w * 0.25 - h], [x + w * 0.45, y - w * 0.55 - h], [x - w * 0.55, y - w * 0.3 - h]], '#f8d66e', INK, 0.8);
    line(c, x + w * 0.3, y - w * 0.075, x + w * 0.3, y - w * 0.075 - h, '#9b6a22', 1);
    line(c, x + w * 0.7, y - w * 0.175, x + w * 0.7, y - w * 0.175 - h, '#9b6a22', 1);
    for (let k = 0; k < 4; k++) line(c, x + 2 + k * 4, y - h + 1, x + 1 + k * 4, y - h - 2, '#fff2a8', 0.8);
  };
  bale(cx - 6, cy + 4, 18, 10);
  bale(cx + 8, cy - 2, 16, 10);
  bale(cx + 1, cy - 8, 16, 10);
}
export function drawCrate(c, cx, cy, s = 1, col = '#c88a4c') {
  const w = 11 * s, h = 12 * s;
  shadow(c, cx + 2, cy, 15 * s, 0.3);
  poly(c, [[cx, cy], [cx + w, cy - w * 0.5], [cx + w, cy - w * 0.5 - h], [cx, cy - h]], col, INK, 0.8);
  poly(c, [[cx, cy], [cx - w, cy - w * 0.5], [cx - w, cy - w * 0.5 - h], [cx, cy - h]], shade(col, -30), INK, 0.8);
  poly(c, [[cx, cy - h], [cx + w, cy - w * 0.5 - h], [cx, cy - w - h], [cx - w, cy - w * 0.5 - h]], shade(col, 25), INK, 0.8);
  line(c, cx + 1, cy - 1, cx + w - 1, cy - w * 0.5 - h + 1, 'rgba(70,40,15,0.6)', 1.4);
  line(c, cx - 1, cy - 1, cx - w + 1, cy - w * 0.5 - h + 1, 'rgba(70,40,15,0.6)', 1.4);
}
export function drawCrates(c, cx, cy) {
  drawCrate(c, cx - 8, cy + 3, 1);
  drawCrate(c, cx + 8, cy + 2, 0.9, '#b97c40');
  drawCrate(c, cx - 1, cy - 9, 0.9, '#d29858');
}
export function drawBarrel(c, cx, cy, s = 1) {
  shadow(c, cx + 2, cy, 9 * s, 0.3);
  const g = c.createLinearGradient(cx - 7 * s, 0, cx + 7 * s, 0);
  g.addColorStop(0, '#7a4a24');
  g.addColorStop(0.45, '#c07d43');
  g.addColorStop(1, '#6a3e1e');
  poly(c, [[cx - 6 * s, cy], [cx - 7.5 * s, cy - 8 * s], [cx - 6 * s, cy - 16 * s], [cx + 6 * s, cy - 16 * s], [cx + 7.5 * s, cy - 8 * s], [cx + 6 * s, cy]], g, INK, 0.8);
  ell(c, cx, cy - 16 * s, 6 * s, 2.6 * s, '#a86a36', INK, 0.8);
  for (const yy of [-3, -13]) line(c, cx - 6.6 * s, cy + yy * s, cx + 6.6 * s, cy + yy * s, '#4a4a52', 1.3);
}
export function drawBarrels(c, cx, cy) {
  drawBarrel(c, cx - 7, cy - 2);
  drawBarrel(c, cx + 7, cy - 1);
  drawBarrel(c, cx, cy + 6);
}
export function drawSign(c, cx, cy) {
  shadow(c, cx + 2, cy, 8, 0.3);
  rrect(c, cx - 1.5, cy - 20, 3, 20, 1, '#7a4e2a', INK, 0.6);
  rrect(c, cx - 11, cy - 26, 22, 11, 2, '#c99363', INK, 0.9);
  circ(c, cx, cy - 20.5, 3.6, '#ffd23f', '#b07a10', 0.8);
  line(c, cx, cy - 22.3, cx, cy - 18.7, '#b07a10', 1);
}
export function drawScarecrow(c, cx, cy, t) {
  shadow(c, cx + 2, cy, 9, 0.3);
  const sw = Math.sin(t * 1.5) * 1;
  line(c, cx, cy, cx, cy - 30, '#7a5230', 2.6);
  line(c, cx - 11 + sw, cy - 23, cx + 11 + sw, cy - 23, '#7a5230', 2.2);
  poly(c, [[cx - 6, cy - 25], [cx + 6, cy - 25], [cx + 7, cy - 11], [cx - 7, cy - 11]], '#3b7fd1', INK, 0.8);
  circ(c, cx, cy - 30, 5, '#f2d2a0', INK, 0.8);
  ell(c, cx, cy - 34, 10, 3, '#e8c15c', INK, 0.8);
  ell(c, cx, cy - 37, 5, 3.6, '#d9a94a', INK, 0.8);
}
export function drawFlowerBed(c, cx, cy, t, seed = 0) {
  shadow(c, cx, cy, 12, 0.2);
  const cols = ['#ff6fa3', '#ffd23f', '#ffffff', '#b38cff', '#ff8a5c', '#ff4f6d'];
  for (let i = 0; i < 9; i++) {
    const dx = (hash(i, seed, 1) - 0.5) * 22, dy = (hash(seed, i, 2) - 0.5) * 11;
    const sw = Math.sin(t * 2 + i + seed) * 0.8;
    line(c, cx + dx, cy + dy, cx + dx + sw, cy + dy - 7, '#3f8a3c', 1.2);
    circ(c, cx + dx + sw, cy + dy - 7.5, 2.4, cols[(i + seed) % cols.length], INK, 0.4);
    circ(c, cx + dx + sw, cy + dy - 7.5, 0.9, '#fff3a0');
  }
}
export function drawPond(c, x, y, t) {
  const pts = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    const r = 0.78 + hash(k, x, 9) * 0.12;
    pts.push(P(x + 1 + Math.cos(a) * r, y + 1 + Math.sin(a) * r));
  }
  poly(c, pts.map(([px, py]) => [px, py + 1]), '#8f877a');
  poly(c, pts, '#38b4d6', 'rgba(255,255,255,0.7)', 2.4);
  const [mx, my] = P(x + 1, y + 1);
  const g = c.createRadialGradient(mx - 10, my - 6, 2, mx, my, 50);
  g.addColorStop(0, 'rgba(200,250,255,0.7)');
  g.addColorStop(1, 'rgba(20,110,160,0.1)');
  poly(c, pts, g);
  for (let k = 0; k < 2; k++) {
    const ph = (t * 0.5 + k / 2) % 1;
    ell(c, mx - 8 + k * 14, my + 3 - k * 4, 4 + ph * 9, (4 + ph * 9) * 0.5, null, `rgba(255,255,255,${0.6 * (1 - ph)})`, 1);
  }
  for (const [dx, dy] of [[-16, -2], [12, 6], [4, -8]]) {
    ell(c, mx + dx, my + dy, 4.5, 2.4, '#4fa84a', INK, 0.5);
    circ(c, mx + dx + 1, my + dy - 1, 1.3, '#ffffff');
  }
  for (let k = 0; k < 4; k++) line(c, mx + 26 + k * 2, my - 2, mx + 25 + k * 2.5, my - 14 - k * 2, '#3f8a3c', 1.4);
}

// ------------------------------------------------------------------ buildings
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
// Two visible walls of a box (front-left +y face, front-right +x face) and optional top.
function walls(c, x, y, w, h, z0, H, L, R, opt = {}) {
  const fl = [P(x, y + h, z0), P(x + w, y + h, z0), P(x + w, y + h, z0 + H), P(x, y + h, z0 + H)];
  const fr = [P(x + w, y, z0), P(x + w, y + h, z0), P(x + w, y + h, z0 + H), P(x + w, y, z0 + H)];
  poly(c, fl, L, INK, 1);
  poly(c, fr, R, INK, 1);
  if (opt.planks) {
    for (let z = z0 + 4; z < z0 + H; z += 4) {
      line(c, ...P(x, y + h, z), ...P(x + w, y + h, z), 'rgba(60,30,10,0.18)', 0.7);
      line(c, ...P(x + w, y, z), ...P(x + w, y + h, z), 'rgba(60,30,10,0.18)', 0.7);
    }
  }
  if (opt.boards) {
    for (let u = 0.1; u < 1; u += 0.1) {
      line(c, ...P(x + u * w, y + h, z0), ...P(x + u * w, y + h, z0 + H), 'rgba(60,20,10,0.25)', 0.8);
      line(c, ...P(x + w, y + u * h, z0), ...P(x + w, y + u * h, z0 + H), 'rgba(60,20,10,0.25)', 0.8);
    }
  }
  if (opt.bricks) {
    for (let z = z0 + 3, row = 0; z < z0 + H; z += 3, row++) {
      line(c, ...P(x, y + h, z), ...P(x + w, y + h, z), 'rgba(90,30,20,0.3)', 0.6);
      for (let u = (row % 2) * 0.05; u < 1; u += 0.1) line(c, ...P(x + u * w, y + h, z - 3), ...P(x + u * w, y + h, z), 'rgba(90,30,20,0.25)', 0.5);
    }
  }
  if (opt.top) poly(c, [P(x, y, z0 + H), P(x + w, y, z0 + H), P(x + w, y + h, z0 + H), P(x, y + h, z0 + H)], opt.top, INK, 1);
}
// Window on the front-left face at u (0..1 along the face) and height z.
function windowL(c, x, y, w, h, u, z, ww = 0.16, wh = 9, glass = '#9fd9f5') {
  const a = P(x + (u - ww / 2) * w, y + h, z), b = P(x + (u + ww / 2) * w, y + h, z);
  const pts = [a, b, [b[0], b[1] - wh], [a[0], a[1] - wh]];
  poly(c, pts, '#fff7e6', INK, 0.8);
  const inset = [[a[0] + 1.4, a[1] - 1.6], [b[0] - 1.4, b[1] - 0.6], [b[0] - 1.4, b[1] - wh + 1.6], [a[0] + 1.4, a[1] - wh + 0.6]];
  poly(c, inset, glass);
  line(c, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - wh + 1, '#fff7e6', 1);
  poly(c, [[a[0] + 2, a[1] - wh + 2], [a[0] + 5, a[1] - wh + 1.4], [a[0] + 2.4, a[1] - 3]], 'rgba(255,255,255,0.5)');
}
function windowR(c, x, y, w, h, u, z, ww = 0.16, wh = 9, glass = '#9fd9f5') {
  const a = P(x + w, y + (u - ww / 2) * h, z), b = P(x + w, y + (u + ww / 2) * h, z);
  poly(c, [a, b, [b[0], b[1] - wh], [a[0], a[1] - wh]], '#fff7e6', INK, 0.8);
  poly(c, [[a[0] + 1.4, a[1] - 0.6], [b[0] - 1.4, b[1] - 1.6], [b[0] - 1.4, b[1] - wh + 0.6], [a[0] + 1.4, a[1] - wh + 1.6]], glass);
}
function doorL(c, x, y, w, h, u, ww, hh, col = '#7a4a26') {
  const a = P(x + (u - ww / 2) * w, y + h, 0), b = P(x + (u + ww / 2) * w, y + h, 0);
  poly(c, [a, b, [b[0], b[1] - hh], [a[0], a[1] - hh]], col, INK, 0.9);
  circ(c, b[0] - 2.5, b[1] - hh * 0.45, 0.9, '#ffd23f');
}
// Gable roof, ridge along x, with overhang and shingle rows.
function gableRoof(c, x, y, w, h, H, RH, roof, roofDark, gable, e = 0.14) {
  const ridgeA = P(x - e, y + h / 2, H + RH), ridgeB = P(x + w + e, y + h / 2, H + RH);
  poly(c, [P(x - e, y - e, H - 2), P(x + w + e, y - e, H - 2), ridgeB, ridgeA], roofDark, INK, 1);
  poly(c, [P(x + w, y, H), P(x + w, y + h, H), P(x + w, y + h / 2, H + RH)], gable, INK, 1);
  const front = [P(x - e, y + h + e, H - 2), P(x + w + e, y + h + e, H - 2), ridgeB, ridgeA];
  poly(c, front, roof, INK, 1.1);
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    const l = lerpP(front[0], ridgeA, t), r = lerpP(front[1], ridgeB, t);
    line(c, l[0], l[1], r[0], r[1], 'rgba(40,20,10,0.25)', 1);
  }
  line(c, ridgeA[0], ridgeA[1], ridgeB[0], ridgeB[1], shade(roof.startsWith('#') ? roof : '#888888', 40), 2.2);
  // bargeboard on the gable end
  line(c, ...P(x + w + e, y + h + e, H - 2), ...ridgeB, '#f3ead6', 1.6);
  line(c, ...P(x + w + e, y - e, H - 2), ...ridgeB, '#f3ead6', 1.6);
  return { ridgeA, ridgeB };
}
const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function smoke(c, x, y, t, n = 3, scale = 1) {
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.35 + i / n) % 1;
    circ(c, x + ph * 8 * scale + Math.sin(t + i) * 2, y - ph * 30 * scale, (3 + ph * 7) * scale, `rgba(245,245,245,${0.6 * (1 - ph)})`);
  }
}
function chimney(c, x, y, z, t, col = '#9a8f86') {
  const p = P(x, y, z);
  poly(c, [[p[0] - 4, p[1]], [p[0] + 4, p[1] - 2], [p[0] + 4, p[1] - 15], [p[0] - 4, p[1] - 13]], col, INK, 0.8);
  poly(c, [[p[0] - 5, p[1] - 13], [p[0] + 5, p[1] - 15.5], [p[0] + 5, p[1] - 17.5], [p[0] - 5, p[1] - 15]], shade('#9a8f86', -20), INK, 0.6);
  smoke(c, p[0], p[1] - 19, t);
}

function drawBarn(c, b, t) {
  const { x, y, w, h } = b;
  const H = 26, K = 16, RH = 30, e = 0.14;
  walls(c, x, y, w, h, 0, H, '#c8402f', '#a8321f', { boards: true });
  // gambrel gable end (+x face)
  const g = [P(x + w, y, H), P(x + w, y + h * 0.2, H + K), P(x + w, y + h / 2, H + RH), P(x + w, y + h * 0.8, H + K), P(x + w, y + h, H)];
  poly(c, g, '#b5372a', INK, 1);
  // back roof facets
  poly(c, [P(x - e, y - e, H - 1), P(x + w + e, y - e, H - 1), P(x + w + e, y + h * 0.2, H + K), P(x - e, y + h * 0.2, H + K)], '#454a57', INK, 1);
  poly(c, [P(x - e, y + h * 0.2, H + K), P(x + w + e, y + h * 0.2, H + K), P(x + w + e, y + h / 2, H + RH), P(x - e, y + h / 2, H + RH)], '#525867', INK, 1);
  // front facets
  poly(c, [P(x - e, y + h / 2, H + RH), P(x + w + e, y + h / 2, H + RH), P(x + w + e, y + h * 0.8, H + K), P(x - e, y + h * 0.8, H + K)], '#7d8494', INK, 1);
  poly(c, [P(x - e, y + h * 0.8, H + K), P(x + w + e, y + h * 0.8, H + K), P(x + w + e, y + h + e, H - 1), P(x - e, y + h + e, H - 1)], '#6a7182', INK, 1);
  for (let k = 1; k < 4; k++) {
    const u = k / 4;
    line(c, ...P(x - e, y + h * 0.8 + (h * 0.2 + e) * u, H + K - (K + 1) * u), ...P(x + w + e, y + h * 0.8 + (h * 0.2 + e) * u, H + K - (K + 1) * u), 'rgba(30,30,40,0.3)', 0.9);
  }
  // white trim on the gable
  for (let i = 0; i < 4; i++) line(c, ...g[i], ...g[i + 1], '#f6f1e6', 2);
  // big doors with white X on the gable end
  const d0 = P(x + w, y + h * 0.28, 0), d1 = P(x + w, y + h * 0.72, 0);
  const dh = 20;
  poly(c, [d0, d1, [d1[0], d1[1] - dh], [d0[0], d0[1] - dh]], '#9a2b1f', INK, 1);
  poly(c, [d0, d1, [d1[0], d1[1] - dh], [d0[0], d0[1] - dh]], null, '#f6f1e6', 1.8);
  line(c, d0[0], d0[1], d1[0], d1[1] - dh, '#f6f1e6', 1.6);
  line(c, d1[0], d1[1], d0[0], d0[1] - dh, '#f6f1e6', 1.6);
  line(c, (d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2, (d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2 - dh, '#f6f1e6', 1.4);
  // loft door with hay
  const l0 = P(x + w, y + h * 0.4, H + 3), l1 = P(x + w, y + h * 0.6, H + 3);
  poly(c, [l0, l1, [l1[0], l1[1] - 9], [l0[0], l0[1] - 9]], '#3b2416', '#f6f1e6', 1.4);
  for (let k = 0; k < 5; k++) line(c, l0[0] + 2 + k * 2.4, l0[1] - 1 - k, l0[0] + 1 + k * 2.6, l0[1] + 3 - k, '#f1c84b', 1.2);
  windowL(c, x, y, w, h, 0.3, 9, 0.12, 8);
  windowL(c, x, y, w, h, 0.72, 9, 0.12, 8);
}

function drawHouse(c, b, t, opts = {}) {
  const { x, y, w, h } = b;
  const H = 30, RH = 24;
  walls(c, x, y, w, h, 0, 6, '#a59c90', '#8b8378');
  walls(c, x, y, w, h, 6, H - 6, opts.wallL || '#f3e3bf', opts.wallR || '#dcc79b', { planks: !opts.timber });
  if (opts.timber) {
    for (const u of [0, 0.33, 0.66, 1]) line(c, ...P(x + u * w, y + h, 6), ...P(x + u * w, y + h, H), '#6b4426', 2);
    line(c, ...P(x, y + h, 18), ...P(x + w, y + h, 18), '#6b4426', 2);
    for (const u of [0, 0.5, 1]) line(c, ...P(x + w, y + u * h, 6), ...P(x + w, y + u * h, H), '#6b4426', 2);
  }
  windowL(c, x, y, w, h, 0.2, 13, 0.16, 11);
  windowL(c, x, y, w, h, 0.8, 13, 0.16, 11);
  doorL(c, x, y, w, h, 0.5, 0.18, 17, '#8a4f2a');
  windowR(c, x, y, w, h, 0.5, 13, 0.24, 11);
  // porch step and flower boxes
  const s0 = P(x + 0.4 * w, y + h + 0.12), s1 = P(x + 0.6 * w, y + h + 0.12);
  poly(c, [s0, s1, [s1[0] + 3, s1[1] - 1.5], [s0[0] + 3, s0[1] - 1.5]], '#b9b1a5', INK, 0.6);
  for (const u of [0.2, 0.8]) {
    const p = P(x + u * w, y + h + 0.04, 12);
    rrect(c, p[0] - 7, p[1] - 1, 14, 3.4, 1, '#7a4a22', INK, 0.5);
    for (let k = 0; k < 5; k++) circ(c, p[0] - 5.5 + k * 2.8, p[1] - 2, 1.7, k % 2 ? '#ff5f8a' : '#ffd23f');
  }
  const r = gableRoof(c, x, y, w, h, H, RH, opts.roof || '#9b4f2c', opts.roofDark || '#6e3519', opts.gable || '#e6d2a6');
  // dormer
  const dz = H + RH * 0.42;
  const da = P(x + w * 0.4, y + h * 0.78, dz), db = P(x + w * 0.62, y + h * 0.78, dz);
  poly(c, [da, db, [db[0], db[1] - 9], [da[0], da[1] - 9]], opts.wallL || '#f3e3bf', INK, 0.8);
  poly(c, [[da[0] - 2, da[1] - 9], [db[0] + 2, db[1] - 9], [(da[0] + db[0]) / 2, (da[1] + db[1]) / 2 - 17]], opts.roof || '#9b4f2c', INK, 0.8);
  rrect(c, (da[0] + db[0]) / 2 - 3, (da[1] + db[1]) / 2 - 7.5, 6, 6, 1, '#9fd9f5', INK, 0.5);
  chimney(c, x + w * 0.22, y + h * 0.32, H + RH * 0.6, t, '#a49a90');
  void r;
  if (opts.roses) {
    for (let k = 0; k < 26; k++) {
      const u = hash(k, 5, 3), z = 4 + hash(5, k, 4) * (H - 4);
      const [rx, ry] = P(x + u * w, y + h, z);
      if (k % 3 === 0) circ(c, rx, ry, 2.6, '#4c9a3a');
      circ(c, rx + 1, ry - 1, 1.9, k % 2 ? '#e8384f' : '#ff7aa2', 'rgba(120,10,30,0.4)', 0.4);
    }
  }
}

function drawOldHouse(c, b, t, restored) {
  if (restored) {
    drawHouse(c, b, t, { timber: true, wallL: '#f0dcae', wallR: '#d8bf8c', roof: '#a8562e', roofDark: '#7a3a1d', gable: '#e9d2a2', roses: true });
    return;
  }
  const { x, y, w, h } = b;
  const H = 26;
  walls(c, x, y, w, h, 0, H, '#4a423c', '#36302b', { boards: true });
  for (let k = 0; k < 8; k++) {
    const [sx, sy] = P(x + hash(k, 2, 1) * w, y + h, 4 + hash(2, k, 1) * (H - 6));
    ell(c, sx, sy, 5, 3, 'rgba(15,12,10,0.55)');
  }
  windowL(c, x, y, w, h, 0.25, 12, 0.18, 10, '#1b1714');
  windowL(c, x, y, w, h, 0.75, 12, 0.18, 10, '#1b1714');
  windowR(c, x, y, w, h, 0.5, 12, 0.2, 10, '#1b1714');
  // broken roof: a few charred rafters
  for (let k = 0; k < 5; k++) {
    const u = 0.1 + k * 0.2;
    line(c, ...P(x + u * w, y + h, H), ...P(x + u * w + 0.05, y + h / 2, H + 18 - (k % 2) * 8), '#2a2420', 2.4);
  }
  line(c, ...P(x, y + h / 2, H + 18), ...P(x + w * 0.55, y + h / 2, H + 18), '#2a2420', 2.6);
  // rubble and a dead tree
  for (let k = 0; k < 6; k++) {
    const [sx, sy] = P(x + 0.1 + hash(k, 7, 2) * 1.6, y + h + 0.1 + hash(7, k, 2) * 0.3);
    poly(c, [[sx - 5, sy], [sx, sy - 3], [sx + 5, sy], [sx, sy + 2]], '#3a332e', INK, 0.5);
  }
  const [tx, ty] = P(x + w + 0.3, y + 0.3);
  line(c, tx, ty, tx, ty - 26, '#5a4a3e', 3.4);
  line(c, tx, ty - 16, tx - 10, ty - 26, '#5a4a3e', 2);
  line(c, tx, ty - 20, tx + 9, ty - 31, '#5a4a3e', 2);
  line(c, tx - 5, ty - 21, tx - 9, ty - 31, '#5a4a3e', 1.4);
}

function drawMill(c, b, t) {
  const { x, y, w, h } = b;
  // stone base and a tall tower
  walls(c, x + 0.3, y + 0.3, w - 0.6, h - 0.6, 0, 8, '#b2aa9e', '#958d82');
  const tx = x + 0.55, ty = y + 0.55, tw = w - 1.1, th = h - 1.1;
  const H = 54;
  const fl = [P(tx, ty + th, 8), P(tx + tw, ty + th, 8), P(tx + tw - 0.12, ty + th - 0.12, H), P(tx + 0.12, ty + th - 0.12, H)];
  const fr = [P(tx + tw, ty, 8), P(tx + tw, ty + th, 8), P(tx + tw - 0.12, ty + th - 0.12, H), P(tx + tw - 0.12, ty + 0.12, H)];
  poly(c, fl, '#f1e6cc', INK, 1);
  poly(c, fr, '#d4c49e', INK, 1);
  for (let z = 14; z < H; z += 6) line(c, ...P(tx + 0.04, ty + th, z), ...P(tx + tw - 0.04, ty + th, z), 'rgba(80,60,30,0.15)', 0.7);
  doorL(c, tx, ty, tw, th, 0.5, 0.35, 14, '#7a4a26');
  windowL(c, tx, ty, tw, th, 0.5, 34, 0.3, 8);
  // conical cap
  const top = P(tx + tw / 2, ty + th / 2, H + 22);
  poly(c, [P(tx, ty + th, H), P(tx + tw, ty + th, H), P(tx + tw, ty, H), top], '#c2462e', INK, 1);
  poly(c, [P(tx, ty + th, H), P(tx + tw, ty + th, H), top], '#d9583a', INK, 1);
  // rotating sails on the front
  const hub = P(tx + tw, ty + th, H - 4);
  const hx = hub[0] + 4, hy = hub[1] + 2;
  const a0 = t * 0.9;
  for (let k = 0; k < 4; k++) {
    const a = a0 + k * Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const L = 34, wd = 7;
    const p1 = [hx + ca * 6, hy + sa * 6], p2 = [hx + ca * L, hy + sa * L];
    const nx = -sa * wd, ny = ca * wd;
    poly(c, [p1, p2, [p2[0] + nx, p2[1] + ny], [p1[0] + nx, p1[1] + ny]], 'rgba(255,250,235,0.92)', INK, 0.8);
    for (let s = 0.3; s < 1; s += 0.2) line(c, hx + ca * L * s, hy + sa * L * s, hx + ca * L * s + nx, hy + sa * L * s + ny, '#a07a4c', 0.7);
    line(c, hx, hy, p2[0], p2[1], '#7a4e2a', 2);
  }
  circ(c, hx, hy, 3.4, '#6b4426', INK, 0.6);
  // sacks of flour at the door
  for (const [dx, dy] of [[-10, 4], [-3, 6]]) {
    const [sx, sy] = P(x + w * 0.8, y + h, 0);
    ell(c, sx + dx, sy + dy - 4, 5, 6, '#efe6d2', INK, 0.7);
  }
}

function drawBakery(c, b, t) {
  const { x, y, w, h } = b;
  const H = 28;
  walls(c, x, y, w, h, 0, H, '#d77a52', '#b45f3c', { bricks: true });
  windowL(c, x, y, w, h, 0.25, 12, 0.22, 11, '#ffe39a');
  doorL(c, x, y, w, h, 0.65, 0.18, 18, '#6b3a1e');
  windowR(c, x, y, w, h, 0.5, 12, 0.3, 11, '#ffe39a');
  // striped awning over the front
  const a = P(x + 0.05, y + h + 0.25, 20), bpt = P(x + w * 0.48, y + h + 0.25, 20);
  const a2 = P(x + 0.05, y + h, 26), b2 = P(x + w * 0.48, y + h, 26);
  for (let k = 0; k < 6; k++) {
    const u0 = k / 6, u1 = (k + 1) / 6;
    poly(c, [lerpP(a2, b2, u0), lerpP(a2, b2, u1), lerpP(a, bpt, u1), lerpP(a, bpt, u0)], k % 2 ? '#ffffff' : '#2fa36b', INK, 0.5);
  }
  gableRoof(c, x, y, w, h, H, 20, '#3f8c6a', '#2b6b4f', '#e9b28a');
  chimney(c, x + w * 0.75, y + h * 0.3, H + 14, t, '#b5513a');
  // bread sign
  const [sx, sy] = P(x + w, y + h * 0.15, H - 6);
  circ(c, sx + 6, sy, 7, '#fff1d0', INK, 0.8);
  emoji(c, '🥖', sx + 6, sy + 0.5, 9);
}

function drawDairy(c, b, t) {
  const { x, y, w, h } = b;
  const H = 26;
  walls(c, x, y, w * 0.72, h, 0, H, '#f7f4ec', '#d9d4c6', { planks: true });
  windowL(c, x, y, w * 0.72, h, 0.3, 11, 0.24, 10);
  doorL(c, x, y, w * 0.72, h, 0.72, 0.22, 17, '#3c6e91');
  gableRoof(c, x, y, w * 0.72, h, H, 18, '#3c78a8', '#2a5677', '#eef2f6');
  // milk silo
  const [sx, sy] = P(x + w * 0.86, y + h * 0.5);
  const g = c.createLinearGradient(sx - 12, 0, sx + 12, 0);
  g.addColorStop(0, '#c9d2dc');
  g.addColorStop(0.4, '#ffffff');
  g.addColorStop(1, '#9aa6b3');
  shadow(c, sx + 4, sy, 16, 0.3);
  poly(c, [[sx - 11, sy], [sx - 11, sy - 46], [sx + 11, sy - 46], [sx + 11, sy]], g, INK, 1);
  ell(c, sx, sy, 11, 5, g, INK, 1);
  ell(c, sx, sy - 46, 11, 5, '#3c78a8', INK, 1);
  poly(c, [[sx - 11, sy - 46], [sx, sy - 58], [sx + 11, sy - 46]], '#3c78a8', INK, 1);
  for (const z of [-14, -28]) line(c, sx - 11, sy + z, sx + 11, sy + z, 'rgba(60,80,100,0.35)', 1);
  circ(c, sx, sy - 22, 6, '#ffffff', '#3c78a8', 1.2);
  emoji(c, '🥛', sx, sy - 21.5, 7);
  void t;
}

function drawSawmill(c, b, t) {
  const { x, y, w, h } = b;
  // open shed: posts and a roof
  for (const [u, v] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
    const p = P(x + u * w, y + v * h);
    rrect(c, p[0] - 2, p[1] - 26, 4, 26, 1, '#8a5a30', INK, 0.6);
  }
  // work bench and saw blade
  walls(c, x + 0.4, y + 0.6, 1.2, 0.6, 0, 8, '#a87444', '#8a5a33', { top: '#c99363' });
  const [hx, hy] = P(x + 1.05, y + 0.85, 12);
  circ(c, hx, hy, 8, '#d7dde4', INK, 0.8);
  for (let k = 0; k < 10; k++) {
    const a = t * 6 + k * TAU / 10;
    line(c, hx + Math.cos(a) * 6, hy + Math.sin(a) * 6, hx + Math.cos(a) * 9, hy + Math.sin(a) * 9, '#8d96a3', 1.4);
  }
  circ(c, hx, hy, 2, '#555');
  // logs pile
  const [lx, ly] = P(x + 0.35, y + h * 0.95);
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < 3 - k; j++) {
      const cx = lx + j * 9 + k * 4.5, cy = ly - k * 7;
      ell(c, cx, cy, 4.4, 4.4, '#d9a46c', INK, 0.6);
      ell(c, cx, cy, 2, 2, '#b07a45');
    }
  }
  gableRoof(c, x, y, w, h, 26, 14, '#7d8494', '#5c6270', '#8a5a30');
  void t;
}

function drawKitchen(c, b, t) {
  const { x, y, w, h } = b;
  const H = 28;
  walls(c, x, y, w, h, 0, H, '#f5d27a', '#d9b05a', { planks: true });
  windowL(c, x, y, w, h, 0.28, 12, 0.24, 11, '#ffe9a3');
  doorL(c, x, y, w, h, 0.72, 0.2, 18, '#a8332a');
  windowR(c, x, y, w, h, 0.5, 12, 0.3, 11, '#ffe9a3');
  const a = P(x, y + h + 0.3, 19), bpt = P(x + w, y + h + 0.3, 19);
  const a2 = P(x, y + h, 26), b2 = P(x + w, y + h, 26);
  for (let k = 0; k < 10; k++) {
    const u0 = k / 10, u1 = (k + 1) / 10;
    poly(c, [lerpP(a2, b2, u0), lerpP(a2, b2, u1), lerpP(a, bpt, u1), lerpP(a, bpt, u0)], k % 2 ? '#ffffff' : '#e0453a', INK, 0.5);
  }
  gableRoof(c, x, y, w, h, H, 20, '#8a3b8f', '#62286a', '#f5d27a');
  chimney(c, x + w * 0.3, y + h * 0.3, H + 14, t, '#a49a90');
  chimney(c, x + w * 0.75, y + h * 0.3, H + 14, t + 1.3, '#a49a90');
}

export function drawBuilding(c, b, t, extra = {}) {
  const cx = P(b.x + b.w / 2, b.y + b.h / 2);
  shadow(c, cx[0] + 10, cx[1] + 6, 62 * b.w / 2, 0.38);
  if (b.t === 'barn') drawBarn(c, b, t);
  else if (b.t === 'house') drawHouse(c, b, t);
  else if (b.t === 'oldhouse') drawOldHouse(c, b, t, extra.restored);
  else if (b.t === 'mill') drawMill(c, b, t);
  else if (b.t === 'bakery') drawBakery(c, b, t);
  else if (b.t === 'dairy') drawDairy(c, b, t);
  else if (b.t === 'sawmill') drawSawmill(c, b, t);
  else if (b.t === 'kitchen') drawKitchen(c, b, t);
}

// ------------------------------------------------------------------ pens and animals
export function drawPenBack(c, b) {
  const { x, y, w, h } = b;
  drawFenceRun(c, P(x + 0.05, y + 0.05), P(x + w - 0.05, y + 0.05), 4);
  drawFenceRun(c, P(x + 0.05, y + 0.05), P(x + 0.05, y + h - 0.05), 4);
}
export function drawPenFront(c, b) {
  const { x, y, w, h } = b;
  drawFenceRun(c, P(x + w - 0.05, y + 0.05), P(x + w - 0.05, y + h - 0.05), 4);
  drawFenceRun(c, P(x + 0.05, y + h - 0.05), P(x + w - 0.05, y + h - 0.05), 4);
}
export function drawPenProps(c, b, kind) {
  const { x, y } = b;
  // shelter in the back corner
  if (kind === 'chicken') {
    walls(c, x + 0.15, y + 0.15, 0.7, 0.6, 0, 12, '#d1503a', '#a83c2b', { boards: true });
    gableRoof(c, x + 0.15, y + 0.15, 0.7, 0.6, 12, 9, '#6a7182', '#4e5463', '#d1503a', 0.08);
    const [dx, dy] = P(x + 0.5, y + 0.75, 0);
    poly(c, [[dx - 3, dy], [dx + 3, dy - 1.5], [dx + 3, dy - 8], [dx - 3, dy - 6.5]], '#3b2416');
  } else {
    walls(c, x + 0.12, y + 0.12, 0.75, 0.55, 0, 14, '#b88454', '#94663c', { boards: true });
    gableRoof(c, x + 0.12, y + 0.12, 0.75, 0.55, 14, 9, '#7a5030', '#5a3a20', '#b88454', 0.08);
  }
  // water trough
  const [tx, ty] = P(x + 1.55, y + 0.5);
  poly(c, [[tx - 12, ty], [tx + 2, ty - 7], [tx + 2, ty - 12], [tx - 12, ty - 5]], '#8a5a30', INK, 0.7);
  poly(c, [[tx - 12, ty - 5], [tx + 2, ty - 12], [tx + 6, ty - 10], [tx - 8, ty - 3]], '#9a6a3e', INK, 0.7);
  poly(c, [[tx - 10, ty - 5.5], [tx + 1, ty - 11], [tx + 4, ty - 9.8], [tx - 7, ty - 4.3]], '#5fc8e6');
}

export const ANIMAL_SCALE = { chicken: 0.8, cow: 1.35, sheep: 1.15, pig: 1.05 };
export function drawAnimal(c, kind, wx, wy, dir, t, ph, moving) {
  const s = ANIMAL_SCALE[kind];
  const bob = Math.abs(Math.sin(t * (moving ? 9 : 2.2) + ph)) * (moving ? 1.6 : 0.5);
  shadow(c, wx, wy, 11 * s, 0.38);
  c.save();
  c.translate(wx, wy - bob);
  c.scale(dir * s, s);
  const legs = moving ? Math.sin(t * 12 + ph) * 1.4 : 0;
  const O = 'rgba(40,25,15,0.7)';
  if (kind === 'chicken') {
    line(c, -1.5, -2, -1.5 + legs * 0.4, 0, '#e8a33d', 1);
    line(c, 1.5, -2, 1.5 - legs * 0.4, 0, '#e8a33d', 1);
    ell(c, -0.5, -6, 6, 4.8, '#fffaf0', O, 0.7);
    poly(c, [[-6, -8], [-9, -12], [-5, -9]], '#f1ead8', O, 0.6);
    ell(c, -1.5, -6, 3.4, 2.4, '#e9dfcc');
    circ(c, 4, -11, 3.2, '#fffaf0', O, 0.7);
    poly(c, [[3, -14], [4.5, -16.5], [5.5, -14], [6.5, -15.5], [6.5, -13]], '#e0262c');
    poly(c, [[6.8, -11.5], [9.4, -10.6], [6.8, -9.6]], '#f7a233');
    circ(c, 5, -11.8, 0.7, '#1b1b1b');
    ell(c, 6.4, -8.6, 0.9, 1.4, '#e0262c');
  } else if (kind === 'cow') {
    for (const [lx, ly] of [[-6, -4], [-3, -4], [4, -4], [7, -4]]) {
      rrect(c, lx - 1.1 + (lx > 0 ? legs : -legs) * 0.3, ly, 2.4, 5, 0.8, '#f6f4ee', O, 0.5);
      rrect(c, lx - 1.1 + (lx > 0 ? legs : -legs) * 0.3, ly + 3.4, 2.4, 1.8, 0.5, '#3a3a3a');
    }
    rrect(c, -10, -15, 20, 12, 6, '#fbfbf7', O, 0.8);
    ell(c, -4, -11, 4.5, 3.4, '#2b2b2b');
    ell(c, 3, -13, 3, 2.2, '#2b2b2b');
    ell(c, -8, -7, 2.6, 2, '#2b2b2b');
    ell(c, 1, -4.5, 3, 1.8, '#f2a7b5', O, 0.4);
    line(c, -10, -13, -13, -6 + Math.sin(t * 3 + ph) * 1.5, '#fbfbf7', 1.2);
    circ(c, -13, -6 + Math.sin(t * 3 + ph) * 1.5, 1.2, '#2b2b2b');
    // head
    ell(c, 11, -16, 4.8, 5.6, '#2b2b2b', O, 0.7);
    ell(c, 11.5, -14.5, 2.4, 4, '#fbfbf7');
    ell(c, 12.2, -11.4, 3.6, 2.6, '#f2a7b5', O, 0.5);
    circ(c, 11.2, -11.4, 0.5, '#7a3a4a');
    circ(c, 13.2, -11.4, 0.5, '#7a3a4a');
    ell(c, 6.6, -19, 2.6, 1.3, '#2b2b2b', O, 0.5, -0.4);
    poly(c, [[9, -21], [8, -24.5], [10.4, -21.6]], '#f1e3c4', O, 0.4);
    poly(c, [[13, -21], [14.6, -24.4], [14.4, -21]], '#f1e3c4', O, 0.4);
    circ(c, 9.6, -17, 0.8, '#ffffff');
    circ(c, 9.7, -17, 0.45, '#111');
    line(c, 9, -10.6, 12, -10.2, '#2a6fc9', 1.2);
    circ(c, 10.5, -9.4, 1.4, '#f2c230', O, 0.4);
  } else if (kind === 'sheep') {
    line(c, -4, -4, -4 - legs * 0.3, 0, '#3b3b45', 1.6);
    line(c, -1, -4, -1 + legs * 0.3, 0, '#3b3b45', 1.6);
    line(c, 3, -4, 3 + legs * 0.3, 0, '#3b3b45', 1.6);
    line(c, 6, -4, 6 - legs * 0.3, 0, '#3b3b45', 1.6);
    for (const [dx, dy, r] of [[-6, -9, 4.2], [-2, -12, 4.6], [3, -12, 4.6], [6, -9, 4], [-3, -6.5, 4], [2, -6.5, 4]]) circ(c, dx, dy, r, '#f7f6f0', O, 0.6);
    for (const [dx, dy, r] of [[-2, -12, 3.2], [3, -12, 3]]) circ(c, dx - 0.8, dy - 0.8, r * 0.6, '#ffffff');
    ell(c, 9, -11, 3.4, 4, '#3b3b45', O, 0.6);
    ell(c, 7, -14, 2, 1, '#3b3b45');
    circ(c, 10, -12, 0.7, '#ffffff');
  } else if (kind === 'pig') {
    line(c, -5, -3, -5 - legs * 0.3, 0, '#e58da1', 2.2);
    line(c, -1, -3, -1 + legs * 0.3, 0, '#e58da1', 2.2);
    line(c, 3, -3, 3 + legs * 0.3, 0, '#e58da1', 2.2);
    line(c, 6, -3, 6 - legs * 0.3, 0, '#e58da1', 2.2);
    ell(c, 0, -8, 10, 6.4, '#f8b9c6', O, 0.7);
    ell(c, -2, -11, 5, 2.2, 'rgba(255,255,255,0.4)');
    ell(c, 10, -8, 3.2, 2.6, '#f29bb0', O, 0.6);
    circ(c, 9.4, -8.2, 0.6, '#8a3c4f');
    circ(c, 11, -8, 0.6, '#8a3c4f');
    poly(c, [[5, -13], [8, -17], [8.4, -12]], '#f09aae', O, 0.5);
    circ(c, 6.6, -10.6, 0.8, '#1b1b1b');
    c.beginPath();
    c.arc(-11, -10, 2.2, 0, Math.PI * 1.5);
    c.strokeStyle = '#f09aae';
    c.lineWidth = 1.2;
    c.stroke();
  }
  c.restore();
}

// A villager; carry: null | 'crate' | 'hay' | 'basket'.
export function drawPerson(c, wx, wy, t, dir, look = 0, carry = null, moving = true) {
  const sw = moving ? Math.sin(t * 9) : 0;
  shadow(c, wx, wy, 9, 0.4);
  c.save();
  c.translate(wx, wy - Math.abs(sw) * 1.2);
  c.scale(dir, 1);
  const O = 'rgba(40,25,15,0.75)';
  const shirt = ['#c0392b', '#2e86c1', '#27ae60', '#f39c12'][look % 4];
  const hair = ['#4a2c1a', '#2b1d14', '#8a5a2b', '#1d1d1d'][look % 4];
  // legs
  rrect(c, -3.6 + sw * 1.5, -11, 3, 11, 1.2, '#4b3a2e', O, 0.6);
  rrect(c, 0.6 - sw * 1.5, -11, 3, 11, 1.2, '#5a4636', O, 0.6);
  rrect(c, -4 + sw * 1.5, -1.6, 4, 2, 1, '#2a1d14');
  rrect(c, 0.4 - sw * 1.5, -1.6, 4, 2, 1, '#2a1d14');
  // body
  rrect(c, -5, -24, 10, 14, 3.5, shirt, O, 0.7);
  rrect(c, -5, -24, 10, 14, 3.5, null, null);
  poly(c, [[-2, -24], [2, -24], [0, -20]], '#ffffff');
  if (look % 2 === 0) { rrect(c, -5, -21, 2.6, 10, 1, '#2b2b2b'); rrect(c, 2.4, -21, 2.6, 10, 1, '#2b2b2b'); }
  // head
  circ(c, 0, -29, 5.2, '#f1c39a', O, 0.7);
  ell(c, -0.2, -32.5, 5.6, 3.2, hair);
  if (look % 3 === 1) ell(c, -4.4, -28.5, 1.8, 4, hair);
  circ(c, 2.4, -29, 0.7, '#222');
  ell(c, 3.4, -26.6, 1.3, 0.6, '#c06a5a');
  // arms and load
  if (carry) {
    line(c, -4, -22, -3, -32, '#f1c39a', 2.4);
    line(c, 4, -22, 4, -32, '#f1c39a', 2.4);
    if (carry === 'crate') drawCrate(c, 0, -32, 0.75);
    else if (carry === 'hay') { rrect(c, -8, -42, 16, 10, 2, '#e9b949', O, 0.7); line(c, -8, -37, 8, -37, '#9b6a22', 1); }
    else { ell(c, 0, -35, 8, 4, '#b07a45', O, 0.7); circ(c, -3, -38, 2.4, '#ff5a4a'); circ(c, 2, -38, 2.4, '#ffd23f'); }
  } else {
    line(c, -5, -21, -6 - sw * 2, -12, '#f1c39a', 2.4);
    line(c, 5, -21, 6 + sw * 2, -12, '#f1c39a', 2.4);
  }
  c.restore();
}

// ------------------------------------------------------------------ crops
export function drawCrop(c, x, y, id, frac, t) {
  const seed = hash(x, y, 3);
  const g = Math.min(1, frac);
  const ready = frac >= 1;
  const sway = (k) => Math.sin(t * 1.6 + seed * 6 + k * 0.7) * 1.4 * (0.3 + g);
  const spots = [];
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) spots.push([0.16 + r * 0.22 + (hash(r, q, x + y) - 0.5) * 0.06, 0.16 + q * 0.22 + (hash(q, r, x - y) - 0.5) * 0.06, r * 4 + q]);
  spots.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  for (const [u, v, k] of spots) {
    const [px, py] = P(x + u, y + v);
    const sw = sway(k);
    if (id === 'wheat') {
      const hgt = 6 + g * 16;
      const stalk = ready ? '#d9a62c' : g > 0.6 ? '#b9c24a' : '#6fb13a';
      for (const dx of [-2.4, 0, 2.4]) {
        line(c, px + dx, py, px + dx + sw, py - hgt, stalk, 1.2);
        if (g > 0.35) ell(c, px + dx + sw, py - hgt - 2.5, 1.7, 4, ready ? '#f6cd48' : g > 0.6 ? '#d8cf5c' : '#9fd060', 'rgba(120,80,10,0.5)', 0.4, sw * 0.05);
      }
    } else if (id === 'carrot') {
      for (let a = -1; a <= 1; a++) {
        c.beginPath();
        c.moveTo(px, py);
        c.quadraticCurveTo(px + a * 3, py - 6 * (0.4 + g), px + a * 5 + sw, py - 10 * (0.4 + g));
        c.strokeStyle = a ? '#4ea83c' : '#6cc04a';
        c.lineWidth = 2.2;
        c.stroke();
      }
      if (g > 0.7) ell(c, px, py - 0.5, 2.6, 1.6, '#ff8a3d', INK, 0.4);
    } else if (id === 'corn') {
      if (k % 2) continue;
      const hgt = 8 + g * 26;
      line(c, px, py, px + sw, py - hgt, '#4f9a32', 2);
      for (const sd of [-1, 1]) {
        c.beginPath();
        c.moveTo(px + sw * 0.4, py - hgt * 0.45);
        c.quadraticCurveTo(px + sd * 8, py - hgt * 0.7, px + sd * 10 + sw, py - hgt * 0.3);
        c.strokeStyle = '#6cc04a';
        c.lineWidth = 2;
        c.stroke();
      }
      if (g > 0.55) ell(c, px + 2 + sw * 0.5, py - hgt * 0.62, 2.4, 5, '#ffd23f', INK, 0.5);
    } else if (id === 'strawberry') {
      if (k % 2) continue;
      ball(c, px, py - 3 * (0.4 + g), 5 * (0.5 + g * 0.5), '#9fe06a', '#4ea83c', '#2b6e2d');
      if (g > 0.5) { circ(c, px - 2.4, py - 2, 1.8, '#ff3d5e', INK, 0.3); circ(c, px + 2.6, py - 3, 1.8, '#ff3d5e', INK, 0.3); }
    } else if (id === 'pumpkin') {
      if (k % 3) continue;
      ell(c, px - 4, py - 1, 4, 2, '#4ea83c');
      ell(c, px + 4, py - 1, 4, 2, '#3e8f30');
      if (g > 0.25) {
        const r = 2 + g * 5;
        ell(c, px, py - r * 0.7, r * 1.25, r, ready ? '#ff8f1f' : '#f2b440', INK, 0.6);
        line(c, px, py - r * 1.6, px, py - r * 0.1, 'rgba(160,70,0,0.5)', 0.8);
        line(c, px, py - r * 1.7, px + 1, py - r * 2.1, '#4e8a2a', 1.4);
      }
    }
  }
  if (ready) {
    const [cx, cy] = center(x, y);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + seed * 6);
    sparkle(c, cx + 12, cy - 26 - pulse * 2, 3 + pulse * 1.5, t);
    sparkle(c, cx - 14, cy - 20 + pulse * 2, 2.4, t + 1);
  }
}

export function sparkle(c, x, y, r, t) {
  c.save();
  c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6 + x);
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
  c.fillStyle = '#fffbd0';
  c.fill();
  c.restore();
}

// White speech bubble with an emoji (like "needs water" / "ready").
export function bubble(c, wx, wy, ch, n, t) {
  const bob = Math.sin(t * 3.4) * 2;
  const x = wx, y = wy + bob;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.25)';
  c.shadowBlur = 4;
  c.shadowOffsetY = 2;
  rrect(c, x - 15, y - 30, 30, 26, 9, '#ffffff');
  c.restore();
  poly(c, [[x - 5, y - 5], [x + 5, y - 5], [x, y + 2]], '#ffffff');
  emoji(c, ch, x, y - 16.5, 17);
  if (n > 1) {
    circ(c, x + 13, y - 28, 6.5, '#f3c24a', '#9a6a08', 0.8);
    c.font = '900 8px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#1a1102';
    c.fillText(String(n), x + 13, y - 27.6);
  }
}

export function ring(c, wx, wy, frac, r = 9) {
  circ(c, wx, wy, r, 'rgba(255,255,255,0.92)', 'rgba(0,0,0,0.2)', 1);
  c.beginPath();
  c.arc(wx, wy, r - 2.6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, frac)));
  c.strokeStyle = '#2fb35a';
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.stroke();
}

// ------------------------------------------------------------------ expeditions
export function drawCloudTile(c, x, y) {
  const [cx, cy] = center(x, y);
  for (let k = 0; k < 4; k++) {
    const dx = (hash(x, y, 200 + k) - 0.5) * 40, dy = (hash(y, x, 210 + k) - 0.5) * 18;
    const r = 18 + hash(x, y, 220 + k) * 12;
    const g = c.createRadialGradient(cx + dx - r * 0.3, cy + dy - 14 - r * 0.4, r * 0.2, cx + dx, cy + dy - 10, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#eef4fa');
    g.addColorStop(1, '#cfdceb');
    circ(c, cx + dx, cy + dy - 10, r, g);
  }
}

export function drawCover(c, x, y, kind, t, snow = false) {
  const [cx, cy] = center(x, y);
  const seed = hash(x, y, 2);
  switch (kind) {
    case 'bush': drawBush(c, cx, cy, 1.2, seed); break;
    case 'vine': {
      drawRock(c, cx, cy, 1, '#b8b0a0');
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.moveTo(cx - 12 + k * 7, cy - 2);
        c.quadraticCurveTo(cx - 9 + k * 7, cy - 18, cx - 5 + k * 6, cy - 12);
        c.strokeStyle = '#3d9a47';
        c.lineWidth = 2.2;
        c.stroke();
        circ(c, cx - 5 + k * 6, cy - 12, 2, '#5cbf4f');
      }
      break;
    }
    case 'debris': {
      shadow(c, cx, cy, 16, 0.35);
      const planks = [[-14, -3, 12, -9, '#8a5a30'], [-12, -10, 13, 1, '#a8703a'], [-4, 2, 8, -15, '#7a4a22'], [-10, -6, 10, -4, '#b07d48']];
      for (const [a, b2, cc, d, col] of planks) { line(c, cx + a, cy + b2, cx + cc, cy + d, '#3b2416', 5.2); line(c, cx + a, cy + b2, cx + cc, cy + d, col, 3.8); }
      drawBarrel(c, cx + 10, cy + 2, 0.7);
      break;
    }
    case 'rock': drawRock(c, cx, cy, 1.2, snow ? '#c7d3dd' : '#a7adb5'); break;
    case 'boulder': drawRock(c, cx, cy, 1.6, snow ? '#b6c5d2' : '#8e959f'); break;
    case 'rubble': {
      shadow(c, cx, cy, 15, 0.35);
      for (let k = 0; k < 5; k++) {
        const dx = (hash(k, x, 4) - 0.5) * 22, dy = (hash(y, k, 4) - 0.5) * 8;
        poly(c, [[cx + dx - 6, cy + dy], [cx + dx - 2, cy + dy - 6], [cx + dx + 5, cy + dy - 4], [cx + dx + 6, cy + dy + 1]], k % 2 ? '#c9bb9c' : '#b0a283', INK, 0.6);
      }
      rrect(c, cx - 4, cy - 22, 8, 18, 1, '#d8ccad', INK, 0.8);
      rrect(c, cx - 6, cy - 24, 12, 4, 1, '#e8dcbd', INK, 0.8);
      break;
    }
    case 'ice': {
      shadow(c, cx, cy, 14, 0.3);
      for (const [dx, hgt] of [[-7, 18], [0, 26], [7, 15]]) {
        poly(c, [[cx + dx - 5, cy], [cx + dx, cy - hgt], [cx + dx + 5, cy], [cx + dx, cy + 2]], 'rgba(170,225,255,0.95)', 'rgba(60,120,180,0.6)', 0.8);
        poly(c, [[cx + dx, cy - hgt], [cx + dx + 5, cy], [cx + dx, cy + 2]], 'rgba(80,140,200,0.45)');
        line(c, cx + dx - 1.4, cy - hgt + 4, cx + dx - 1.4, cy - 3, 'rgba(255,255,255,0.9)', 1);
      }
      break;
    }
    case 'palm': drawPalm(c, cx, cy, t, seed); break;
    case 'crate': drawCrates(c, cx, cy); break;
    default: drawBush(c, cx, cy, 1.1, seed);
  }
}

export function drawPalm(c, cx, cy, t, seed = 0) {
  shadow(c, cx + 6, cy, 16, 0.32);
  c.beginPath();
  c.moveTo(cx - 2, cy);
  c.quadraticCurveTo(cx + 6, cy - 16, cx + 10, cy - 34);
  c.lineTo(cx + 13, cy - 34);
  c.quadraticCurveTo(cx + 9, cy - 16, cx + 3, cy);
  c.closePath();
  c.fillStyle = '#9a6a3e';
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.7;
  c.stroke();
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.62 + Math.sin(t * 1.4 + k + seed) * 0.06;
    const ex = cx + 11 + Math.cos(a) * 20, ey = cy - 34 + Math.sin(a) * 9 + 6;
    c.beginPath();
    c.moveTo(cx + 11, cy - 34);
    c.quadraticCurveTo(cx + 11 + Math.cos(a) * 12, cy - 40 + Math.sin(a) * 6, ex, ey);
    c.strokeStyle = '#2e8f45';
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = '#59c065';
    c.lineWidth = 1.6;
    c.stroke();
  }
  circ(c, cx + 10, cy - 32, 2.2, '#7a4a22');
  circ(c, cx + 13, cy - 31, 2.2, '#7a4a22');
}

export function drawChest(c, cx, cy, t, open = false) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + cx);
  ell(c, cx, cy, 20, 10, `rgba(255,220,90,${0.18 + 0.15 * pulse})`);
  shadow(c, cx + 2, cy, 13, 0.35);
  poly(c, [[cx - 12, cy - 2], [cx + 2, cy + 4], [cx + 2, cy - 7], [cx - 12, cy - 13]], '#8b4f1c', INK, 0.8);
  poly(c, [[cx + 2, cy + 4], [cx + 13, cy - 1], [cx + 13, cy - 12], [cx + 2, cy - 7]], '#a85f24', INK, 0.8);
  // coins spilling over the rim
  for (let k = 0; k < 6; k++) circ(c, cx - 7 + k * 3.4, cy - 12 - (k % 2) * 2, 2.4, '#ffd84a', '#b8860b', 0.5);
  poly(c, [[cx - 12, cy - 13], [cx + 2, cy - 7], [cx + 13, cy - 12], [cx + 6, cy - 22], [cx - 7, cy - 24]], open ? '#6a3a14' : '#b06a2a', INK, 0.8);
  line(c, cx - 12, cy - 9, cx + 2, cy - 3, '#f3c24a', 2);
  line(c, cx + 2, cy - 3, cx + 13, cy - 8, '#f3c24a', 2);
  rrect(c, cx, cy - 8, 4, 5, 1, '#ffd868', INK, 0.5);
}

export function drawGoldPile(c, cx, cy, s = 1) {
  shadow(c, cx, cy, 18 * s, 0.3);
  poly(c, [[cx - 18 * s, cy], [cx - 8 * s, cy - 14 * s], [cx + 2 * s, cy - 20 * s], [cx + 12 * s, cy - 10 * s], [cx + 18 * s, cy]], '#f2c230', '#9a6a08', 0.9);
  poly(c, [[cx - 8 * s, cy - 14 * s], [cx + 2 * s, cy - 20 * s], [cx, cy - 8 * s]], '#ffe680');
  for (let k = 0; k < 8; k++) circ(c, cx + (hash(k, 1, s * 9) - 0.5) * 30 * s, cy - 2 - hash(1, k, s * 9) * 10 * s, 2.4 * s, '#ffd84a', '#b8860b', 0.5);
}

// A beached wooden ship (decoration and goal of island expeditions).
export function drawShip(c, cx, cy, t, s = 1) {
  shadow(c, cx + 6, cy + 6, 70 * s, 0.35, 22 * s);
  const hull = [[cx - 62 * s, cy - 18 * s], [cx + 58 * s, cy - 34 * s], [cx + 70 * s, cy - 44 * s], [cx + 40 * s, cy - 6 * s], [cx - 40 * s, cy + 10 * s]];
  poly(c, hull, '#8a4f24', INK, 1.4);
  for (let k = 1; k < 5; k++) line(c, cx - 58 * s + k * 2, cy - 18 * s + k * 5 * s, cx + 52 * s - k * 3, cy - 32 * s + k * 5 * s, 'rgba(50,25,10,0.4)', 1);
  poly(c, [[cx - 62 * s, cy - 18 * s], [cx + 58 * s, cy - 34 * s], [cx + 52 * s, cy - 40 * s], [cx - 56 * s, cy - 24 * s]], '#b9773e', INK, 1);
  // deck crates and chest
  drawCrate(c, cx - 18 * s, cy - 26 * s, 1.1 * s, '#d29858');
  drawCrate(c, cx + 6 * s, cy - 32 * s, 0.9 * s);
  // mast with torn sail
  line(c, cx - 4 * s, cy - 28 * s, cx - 8 * s, cy - 110 * s, '#6b4426', 3.4 * s);
  line(c, cx - 30 * s, cy - 92 * s, cx + 18 * s, cy - 100 * s, '#6b4426', 2.2 * s);
  const flap = Math.sin(t * 2) * 3;
  poly(c, [[cx - 28 * s, cy - 90 * s], [cx + 16 * s, cy - 98 * s], [cx + 12 * s + flap, cy - 58 * s], [cx - 6 * s, cy - 62 * s], [cx - 24 * s + flap, cy - 54 * s]], 'rgba(245,236,214,0.95)', INK, 1);
  for (let k = 0; k < 3; k++) line(c, cx - 8 * s, cy - 110 * s, cx - 60 * s + k * 6, cy - 22 * s, 'rgba(60,40,20,0.6)', 0.7);
  line(c, cx + 58 * s, cy - 34 * s, cx + 90 * s, cy - 44 * s, '#6b4426', 2 * s);
}

export function drawExplorer(c, x, y, t) {
  const [cx, cy] = center(x, y);
  const bob = Math.sin(t * 2.4) * 0.6;
  shadow(c, cx, cy, 10, 0.4);
  c.save();
  c.translate(cx, cy + bob);
  const O = 'rgba(40,25,15,0.75)';
  rrect(c, -4, -14, 3.4, 14, 1.4, '#7a5a3a', O, 0.6);
  rrect(c, 0.6, -14, 3.4, 14, 1.4, '#6e5034', O, 0.6);
  rrect(c, -4.4, -3, 4, 3, 1, '#3b2416');
  rrect(c, 0.4, -3, 4, 3, 1, '#3b2416');
  rrect(c, -5.4, -28, 10.8, 15, 3.5, '#f4f0e6', O, 0.7);
  poly(c, [[-1.5, -28], [1.5, -28], [0, -23]], '#c0392b');
  rrect(c, -5.4, -17, 10.8, 2.4, 1, '#6b4426');
  line(c, -5, -25, -7, -15, '#e2a87e', 2.4);
  line(c, 5, -25, 7, -15, '#e2a87e', 2.4);
  ell(c, 0, -33, 5.4, 5.8, '#e2a87e', O, 0.7);
  ell(c, 0, -36.5, 6, 3.4, '#2b1d14');
  ell(c, -4.4, -30, 2, 6.4, '#2b1d14');
  ell(c, 4.4, -30, 2, 6.4, '#2b1d14');
  circ(c, -1.8, -33, 0.7, '#222');
  circ(c, 1.8, -33, 0.7, '#222');
  c.restore();
}
