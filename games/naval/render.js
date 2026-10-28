// Sea Battle — Canvas 2D art: ship sprites (pseudo-3D top view), animated
// ocean, grid, markers, effect sprites. Everything is procedural and cached.

import { N } from './rules.js';

export const U = 72; // sprite pixels per cell (sprites are scaled down when drawn)

// ---------------------------------------------------------------- colour helpers
function hexRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function shade(hex, amt) {
  const [r, g, b] = hexRgb(hex);
  const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function mix(a, b, k) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const f = (i) => Math.round(A[i] + (B[i] - A[i]) * k);
  return '#' + [f(0), f(1), f(2)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
export function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---------------------------------------------------------------- skins & themes
// Unlock ranks live in progress.js; here only the paint.
export const SKINS = {
  grey: { hull: '#7f8a95', deck: '#9ca7b0', sup: '#cfd6db', turret: '#717d87' },
  teak: { hull: '#5d656e', deck: '#b67e49', sup: '#e2dccd', turret: '#59616a', planks: true },
  blue: { hull: '#3d6b93', deck: '#6f98b9', sup: '#c1d7e8', turret: '#345d80' },
  arctic: { hull: '#c6d4de', deck: '#e4ecf1', sup: '#ffffff', turret: '#9fb3c2', pattern: 'camo', pc: ['#7e9aaf', '#4e6f88', '#f4f8fb'] },
  dazzle: { hull: '#d5dade', deck: '#c9cfd4', sup: '#f1f2f3', turret: '#2f353b', pattern: 'dazzle', pc: ['#1b2126', '#3f5f80'] },
  rust: { hull: '#6a5b4f', deck: '#7f6b59', sup: '#a89884', turret: '#5b4b3f', pattern: 'rust', pc: ['#8f4a1f', '#4b2b16'] },
  stealth: { hull: '#2b3036', deck: '#3b4148', sup: '#555c64', turret: '#262a2f', pattern: 'facets', pc: ['#4a525b'] },
  gold: { hull: '#b8891f', deck: '#262016', sup: '#f2d47a', turret: '#c99a30', trim: '#fff0b0', pattern: 'trim' },
  enemy: { hull: '#6f6a66', deck: '#8b847d', sup: '#b8b0a7', turret: '#5f5a56' },
  silver: { hull: '#8d9aa6', deck: '#7c8996', sup: '#e9eef2', turret: '#5f6c78', planks: true },
};
export const SKIN_IDS = ['grey', 'teak', 'blue', 'arctic', 'dazzle', 'rust', 'stealth', 'gold'];

export const THEMES = {
  atlantic: { deep: '#03182e', mid: '#0a4676', hi: '#2b8fd0', wave: '#8ad6ff', line: 'rgba(150,215,255,0.20)', sweep: '120,220,255', spot: 'rgba(140,210,255,0.20)' },
  tropical: { deep: '#02343e', mid: '#06777f', hi: '#2fd1c3', wave: '#c4fff6', line: 'rgba(200,255,250,0.22)', sweep: '150,255,230', spot: 'rgba(200,255,240,0.24)' },
  night: { deep: '#01040c', mid: '#06122a', hi: '#1d3768', wave: '#86a6ea', line: 'rgba(140,170,255,0.16)', sweep: '150,180,255', spot: 'rgba(200,215,255,0.16)' },
  arctic: { deep: '#18303f', mid: '#3e6479', hi: '#9cc3d6', wave: '#ffffff', line: 'rgba(235,248,255,0.24)', sweep: '220,245,255', spot: 'rgba(255,255,255,0.22)' },
  radar: { deep: '#010e06', mid: '#032d18', hi: '#0b6a35', wave: '#5dff9a', line: 'rgba(80,255,140,0.26)', sweep: '80,255,140', spot: 'rgba(80,255,140,0.10)' },
  sunset: { deep: '#1a0a2e', mid: '#561f4e', hi: '#e0744a', wave: '#ffd3a0', line: 'rgba(255,210,170,0.20)', sweep: '255,200,140', spot: 'rgba(255,170,110,0.26)' },
  imperial: { deep: '#0b0803', mid: '#2a1f09', hi: '#7a5b17', wave: '#ffe08a', line: 'rgba(255,215,120,0.26)', sweep: '255,215,120', spot: 'rgba(255,215,120,0.16)' },
};
export const THEME_IDS = ['atlantic', 'tropical', 'night', 'arctic', 'radar', 'sunset', 'imperial'];

function skinColors(id) {
  const s = SKINS[id] || SKINS.grey;
  return {
    ...s,
    hullD: shade(s.hull, -0.5),
    hullL: shade(s.hull, 0.32),
    deckD: shade(s.deck, -0.28),
    deckL: shade(s.deck, 0.18),
    supD: shade(s.sup, -0.35),
    supL: shade(s.sup, 0.3),
    barrel: shade(s.turret, -0.45),
  };
}

// ---------------------------------------------------------------- ship sprites
const BEAM = { carrier: 0.6, battleship: 0.66, cruiser: 0.58, submarine: 0.44, destroyer: 0.52, patrol: 0.46 };

function hullPath(g, x0, x1, cy, b, bowFrac = 0.32, stern = 0.45) {
  const L = x1 - x0;
  const bow = Math.min(L * bowFrac, b * 2.1);
  const hb = b / 2;
  g.beginPath();
  g.moveTo(x0 + hb * stern, cy - hb);
  g.lineTo(x1 - bow, cy - hb);
  g.bezierCurveTo(x1 - bow * 0.4, cy - hb, x1 - bow * 0.06, cy - hb * 0.32, x1, cy);
  g.bezierCurveTo(x1 - bow * 0.06, cy + hb * 0.32, x1 - bow * 0.4, cy + hb, x1 - bow, cy + hb);
  g.lineTo(x0 + hb * stern, cy + hb);
  g.quadraticCurveTo(x0, cy + hb, x0, cy + hb * (1 - stern));
  g.lineTo(x0, cy - hb * (1 - stern));
  g.quadraticCurveTo(x0, cy - hb, x0 + hb * stern, cy - hb);
  g.closePath();
}

function beamGrad(g, cy, b, c0, c1, c2) {
  const gr = g.createLinearGradient(0, cy - b / 2, 0, cy + b / 2);
  gr.addColorStop(0, c0);
  gr.addColorStop(0.22, c1);
  gr.addColorStop(0.42, c2);
  gr.addColorStop(0.72, c1);
  gr.addColorStop(1, c0);
  return gr;
}

function patternOverlay(g, sk, x0, x1, cy, b, rnd) {
  if (!sk.pattern) return;
  const L = x1 - x0;
  g.save();
  if (sk.pattern === 'camo') {
    for (let k = 0; k < Math.round(L / 14); k++) {
      g.fillStyle = sk.pc[k % sk.pc.length];
      g.globalAlpha = 0.65;
      g.beginPath();
      const x = x0 + rnd() * L;
      const y = cy + (rnd() - 0.5) * b;
      g.ellipse(x, y, 6 + rnd() * 12, 4 + rnd() * 7, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else if (sk.pattern === 'dazzle') {
    g.globalAlpha = 0.85;
    let x = x0 - b;
    let k = 0;
    while (x < x1 + b) {
      const w = 8 + rnd() * 14;
      const sl = (rnd() - 0.5) * b * 1.6;
      g.fillStyle = sk.pc[k % sk.pc.length];
      if (k % 3 !== 2) {
        g.beginPath();
        g.moveTo(x, cy - b);
        g.lineTo(x + w, cy - b);
        g.lineTo(x + w + sl, cy + b);
        g.lineTo(x + sl, cy + b);
        g.closePath();
        g.fill();
      }
      x += w * 1.6 + rnd() * 6;
      k++;
    }
  } else if (sk.pattern === 'rust') {
    for (let k = 0; k < Math.round(L / 9); k++) {
      g.fillStyle = sk.pc[k % 2];
      g.globalAlpha = 0.35 + rnd() * 0.35;
      const x = x0 + rnd() * L;
      const y = cy + (rnd() - 0.5) * b;
      g.beginPath();
      g.ellipse(x, y, 2 + rnd() * 7, 1.5 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = sk.pc[0];
    g.globalAlpha = 0.4;
    g.lineWidth = 1.2;
    for (let k = 0; k < Math.round(L / 18); k++) {
      const x = x0 + rnd() * L;
      g.beginPath();
      g.moveTo(x, cy - b / 2);
      g.lineTo(x + (rnd() - 0.5) * 4, cy - b / 2 + 4 + rnd() * 8);
      g.stroke();
    }
  } else if (sk.pattern === 'facets') {
    g.strokeStyle = sk.pc[0];
    g.globalAlpha = 0.8;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x0 + b * 0.3, cy);
    g.lineTo(x1 - b * 0.4, cy);
    for (let x = x0 + b * 0.6; x < x1 - b; x += U * 0.55) {
      g.moveTo(x, cy - b / 2);
      g.lineTo(x + U * 0.2, cy);
      g.lineTo(x, cy + b / 2);
    }
    g.stroke();
  } else if (sk.pattern === 'trim') {
    g.globalAlpha = 0.9;
  }
  g.restore();
}

function paintHull(g, sk, x0, x1, cy, b, rnd, bowFrac) {
  hullPath(g, x0, x1, cy, b, bowFrac);
  g.fillStyle = beamGrad(g, cy, b, sk.hullD, sk.hull, sk.hullL);
  g.fill();
  // deck
  g.save();
  hullPath(g, x0 + b * 0.09, x1 - b * 0.2, cy, b * 0.76, bowFrac);
  g.fillStyle = beamGrad(g, cy, b * 0.76, sk.deckD, sk.deck, sk.deckL);
  g.fill();
  if (sk.planks) {
    g.clip();
    g.strokeStyle = 'rgba(40,20,5,0.22)';
    g.lineWidth = 0.8;
    for (let y = cy - b / 2; y < cy + b / 2; y += b * 0.085) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
    }
    for (let x = x0; x < x1; x += U * 0.33) {
      for (let y = cy - b / 2, k = 0; y < cy + b / 2; y += b * 0.085, k++) {
        const xx = x + (k % 3) * U * 0.11;
        g.beginPath();
        g.moveTo(xx, y);
        g.lineTo(xx, y + b * 0.085);
        g.stroke();
      }
    }
  }
  g.restore();
  g.save();
  hullPath(g, x0, x1, cy, b, bowFrac);
  g.clip();
  patternOverlay(g, sk, x0, x1, cy, b, rnd);
  // deck edge highlight (light from top-left)
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0 + b * 0.3, cy - b / 2 + 1.5);
  g.lineTo(x1 - b * 0.9, cy - b / 2 + 1.5);
  g.stroke();
  g.restore();
  hullPath(g, x0, x1, cy, b, bowFrac);
  g.lineWidth = 1.6;
  g.strokeStyle = sk.trim || 'rgba(0,0,0,0.55)';
  g.stroke();
}

function block(g, x, y, w, h, col, colD, colL, rad = 4) {
  g.fillStyle = 'rgba(0,0,0,0.32)';
  rr(g, x + 2.5, y + 3.5, w, h, rad);
  g.fill();
  const gr = g.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, colL);
  gr.addColorStop(0.45, col);
  gr.addColorStop(1, colD);
  g.fillStyle = gr;
  rr(g, x, y, w, h, rad);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.moveTo(x + rad, y + 1);
  g.lineTo(x + w - rad, y + 1);
  g.stroke();
}

function turret(g, x, y, r, dir, n, sk) {
  g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * r * 0.42;
    g.strokeStyle = sk.barrel;
    g.lineWidth = r * 0.26;
    g.beginPath();
    g.moveTo(x, y + off);
    g.lineTo(x + dir * r * 2.15, y + off);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.moveTo(x + dir * r * 0.9, y + off - r * 0.05);
    g.lineTo(x + dir * r * 2.05, y + off - r * 0.05);
    g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + 2, y + 3, r * 1.05, r * 0.95, 0, 0, Math.PI * 2);
  g.fill();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  gr.addColorStop(0, shade(sk.turret.startsWith('#') ? sk.turret : '#777777', 0.45));
  gr.addColorStop(0.55, sk.turret);
  gr.addColorStop(1, sk.barrel);
  g.fillStyle = gr;
  // flat-fronted turret house
  g.beginPath();
  g.moveTo(x + dir * r * 0.95, y - r * 0.72);
  g.lineTo(x + dir * r * 0.95, y + r * 0.72);
  g.quadraticCurveTo(x - dir * r * 1.2, y + r * 1.05, x - dir * r * 1.05, y);
  g.quadraticCurveTo(x - dir * r * 1.2, y - r * 1.05, x + dir * r * 0.95, y - r * 0.72);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.arc(x - dir * r * 0.3, y - r * 0.25, r * 0.18, 0, Math.PI * 2);
  g.fill();
}

function funnel(g, x, y, rw, rh, sk) {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + 3, y + 4, rw, rh, 0, 0, Math.PI * 2);
  g.fill();
  const gr = g.createLinearGradient(x, y - rh, x, y + rh);
  gr.addColorStop(0, sk.supL);
  gr.addColorStop(1, sk.supD);
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#16191c';
  g.beginPath();
  g.ellipse(x, y, rw * 0.68, rh * 0.62, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,150,60,0.25)';
  g.beginPath();
  g.ellipse(x + rw * 0.1, y + rh * 0.1, rw * 0.35, rh * 0.3, 0, 0, Math.PI * 2);
  g.fill();
}

function mast(g, x, y, len, sk) {
  g.strokeStyle = sk.supD;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x, y - len);
  g.lineTo(x, y + len);
  g.moveTo(x - len * 0.35, y - len * 0.2);
  g.lineTo(x + len * 0.35, y - len * 0.2);
  g.stroke();
  g.fillStyle = sk.supL;
  g.beginPath();
  g.ellipse(x, y - len * 0.2, len * 0.22, len * 0.12, 0.3, 0, Math.PI * 2);
  g.fill();
}

function windows(g, x, y, w, h) {
  g.fillStyle = '#132230';
  rr(g, x, y, w, h, 1.5);
  g.fill();
  g.fillStyle = 'rgba(160,220,255,0.55)';
  for (let k = 0; k < 4; k++) g.fillRect(x + 1 + k * (w / 4), y + 1, w / 4 - 2, Math.max(1, h * 0.35));
}

function drawWarship(g, cls, len, sk, rnd) {
  const L = len * U;
  const cy = U / 2;
  const b = BEAM[cls] * U;
  const x0 = U * 0.08;
  const x1 = L - U * 0.04;
  paintHull(g, sk, x0, x1, cy, b, rnd, cls === 'patrol' ? 0.45 : 0.3);
  const at = (f) => x0 + (x1 - x0) * f;
  if (cls === 'battleship') {
    turret(g, at(0.18), cy, b * 0.26, -1, 3, sk);
    turret(g, at(0.3), cy, b * 0.28, -1, 3, sk);
    block(g, at(0.38), cy - b * 0.26, at(0.6) - at(0.38), b * 0.52, sk.sup, sk.supD, sk.supL, 5);
    funnel(g, at(0.45), cy, b * 0.2, b * 0.15, sk);
    block(g, at(0.53), cy - b * 0.22, at(0.66) - at(0.53), b * 0.44, sk.sup, sk.supD, sk.supL, 4);
    windows(g, at(0.63), cy - b * 0.18, b * 0.08, b * 0.36);
    mast(g, at(0.57), cy, b * 0.3, sk);
    turret(g, at(0.72), cy, b * 0.28, 1, 3, sk);
    turret(g, at(0.84), cy, b * 0.26, 1, 3, sk);
    // secondary guns
    g.fillStyle = sk.barrel;
    for (const f of [0.36, 0.44, 0.52]) {
      g.beginPath();
      g.arc(at(f), cy - b * 0.36, b * 0.06, 0, Math.PI * 2);
      g.arc(at(f), cy + b * 0.36, b * 0.06, 0, Math.PI * 2);
      g.fill();
    }
  } else if (cls === 'cruiser') {
    turret(g, at(0.18), cy, b * 0.26, -1, 2, sk);
    block(g, at(0.36), cy - b * 0.24, at(0.6) - at(0.36), b * 0.48, sk.sup, sk.supD, sk.supL, 5);
    funnel(g, at(0.43), cy, b * 0.18, b * 0.14, sk);
    windows(g, at(0.565), cy - b * 0.17, b * 0.08, b * 0.34);
    mast(g, at(0.51), cy, b * 0.28, sk);
    turret(g, at(0.7), cy, b * 0.27, 1, 2, sk);
    turret(g, at(0.82), cy, b * 0.25, 1, 2, sk);
  } else if (cls === 'destroyer') {
    turret(g, at(0.16), cy, b * 0.24, -1, 1, sk);
    g.fillStyle = sk.barrel;
    rr(g, at(0.27), cy - b * 0.14, at(0.36) - at(0.27), b * 0.28, 3);
    g.fill();
    block(g, at(0.4), cy - b * 0.24, at(0.66) - at(0.4), b * 0.48, sk.sup, sk.supD, sk.supL, 5);
    funnel(g, at(0.47), cy, b * 0.17, b * 0.14, sk);
    windows(g, at(0.62), cy - b * 0.17, b * 0.07, b * 0.34);
    mast(g, at(0.56), cy, b * 0.3, sk);
    turret(g, at(0.79), cy, b * 0.26, 1, 1, sk);
  } else {
    // patrol boat
    block(g, at(0.32), cy - b * 0.27, at(0.62) - at(0.32), b * 0.54, sk.sup, sk.supD, sk.supL, 5);
    windows(g, at(0.57), cy - b * 0.2, b * 0.09, b * 0.4);
    mast(g, at(0.45), cy, b * 0.3, sk);
    turret(g, at(0.76), cy, b * 0.2, 1, 1, sk);
    g.fillStyle = sk.barrel;
    g.beginPath();
    g.arc(at(0.16), cy, b * 0.09, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCarrier(g, len, sk, rnd) {
  const L = len * U;
  const cy = U / 2;
  const b = BEAM.carrier * U;
  const x0 = U * 0.08;
  const x1 = L - U * 0.04;
  hullPath(g, x0 + U * 0.1, x1, cy + U * 0.02, b * 0.86, 0.22);
  g.fillStyle = beamGrad(g, cy, b, sk.hullD, sk.hull, sk.hullL);
  g.fill();
  // flight deck with an angled landing area towards port (top)
  const dTop = cy - U * 0.4;
  const dBot = cy + U * 0.3;
  g.beginPath();
  g.moveTo(x0, cy - U * 0.16);
  g.lineTo(x0 + U * 0.25, dTop + U * 0.04);
  g.lineTo(x0 + (x1 - x0) * 0.52, dTop);
  g.lineTo(x0 + (x1 - x0) * 0.66, cy - U * 0.26);
  g.lineTo(x1 - U * 0.3, cy - U * 0.25);
  g.quadraticCurveTo(x1 - U * 0.02, cy - U * 0.2, x1 - U * 0.04, cy);
  g.quadraticCurveTo(x1 - U * 0.02, cy + U * 0.2, x1 - U * 0.3, cy + U * 0.25);
  g.lineTo(x0 + U * 0.3, dBot);
  g.lineTo(x0, cy + U * 0.2);
  g.closePath();
  const deckCol = sk.pattern === 'trim' ? '#2a2418' : mix(sk.deck.startsWith('#') ? sk.deck : '#8a8a8a', '#30353a', 0.65);
  const dg = g.createLinearGradient(0, dTop, 0, dBot);
  dg.addColorStop(0, shade(deckCol, 0.12));
  dg.addColorStop(0.5, deckCol);
  dg.addColorStop(1, shade(deckCol, -0.3));
  g.fillStyle = dg;
  g.fill();
  g.save();
  g.clip();
  patternOverlay(g, { ...sk, pattern: sk.pattern === 'dazzle' || sk.pattern === 'camo' ? null : sk.pattern }, x0, x1, cy, U, rnd);
  // markings
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 1.4;
  g.setLineDash([7, 6]);
  g.beginPath();
  g.moveTo(x0 + U * 0.3, cy + U * 0.02);
  g.lineTo(x1 - U * 0.35, cy + U * 0.02);
  g.stroke();
  g.beginPath();
  g.moveTo(x0 + U * 0.25, cy + U * 0.08);
  g.lineTo(x0 + (x1 - x0) * 0.55, dTop + U * 0.1);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(255,214,90,0.7)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x0 + U * 0.2, cy - U * 0.12);
  g.lineTo(x0 + (x1 - x0) * 0.5, dTop + U * 0.06);
  g.moveTo(x0 + U * 0.2, cy + U * 0.17);
  g.lineTo(x1 - U * 0.4, cy + U * 0.17);
  g.stroke();
  // elevators
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x0 + (x1 - x0) * 0.3, cy + U * 0.2, U * 0.32, U * 0.1);
  g.fillRect(x0 + (x1 - x0) * 0.78, cy - U * 0.24, U * 0.3, U * 0.09);
  g.restore();
  g.strokeStyle = sk.trim || 'rgba(0,0,0,0.55)';
  g.lineWidth = 1.4;
  g.stroke();
  // parked aircraft
  const plane = (x, y, s, rot) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.translate(1.5, 2);
    g.beginPath();
    g.moveTo(s, 0);
    g.lineTo(-s * 0.2, -s * 0.9);
    g.lineTo(-s * 0.35, -s * 0.9);
    g.lineTo(-s * 0.15, 0);
    g.lineTo(-s * 0.35, s * 0.9);
    g.lineTo(-s * 0.2, s * 0.9);
    g.closePath();
    g.fill();
    g.translate(-1.5, -2);
    g.fillStyle = sk.supL;
    g.fill();
    g.fillRect(-s * 0.9, -s * 0.08, s * 1.7, s * 0.16);
    g.fillRect(-s * 0.95, -s * 0.35, s * 0.18, s * 0.7);
    g.restore();
  };
  for (let k = 0; k < 3; k++) plane(x1 - U * (0.55 + k * 0.42), cy - U * 0.08 + (k % 2) * U * 0.14, U * 0.13, 0.15);
  plane(x0 + U * 0.6, cy - U * 0.05, U * 0.13, -0.5);
  // island on starboard (bottom)
  const ix = x0 + (x1 - x0) * 0.58;
  block(g, ix, cy + U * 0.2, U * 0.75, U * 0.16, sk.sup, sk.supD, sk.supL, 3);
  funnel(g, ix + U * 0.48, cy + U * 0.28, U * 0.07, U * 0.05, sk);
  mast(g, ix + U * 0.22, cy + U * 0.28, U * 0.12, sk);
  windows(g, ix + U * 0.66, cy + U * 0.22, U * 0.05, U * 0.12);
}

function drawSub(g, len, sk) {
  const L = len * U;
  const cy = U / 2;
  const b = BEAM.submarine * U;
  const x0 = U * 0.16;
  const x1 = L - U * 0.08;
  const body = mix(sk.hull.startsWith('#') ? sk.hull : '#555555', '#15181b', 0.62);
  // pressure hull: long capsule
  const path = () => {
    g.beginPath();
    g.moveTo(x0 + b * 0.5, cy - b / 2);
    g.lineTo(x1 - b * 0.9, cy - b / 2);
    g.bezierCurveTo(x1 - b * 0.2, cy - b / 2, x1, cy - b * 0.2, x1, cy);
    g.bezierCurveTo(x1, cy + b * 0.2, x1 - b * 0.2, cy + b / 2, x1 - b * 0.9, cy + b / 2);
    g.lineTo(x0 + b * 0.5, cy + b / 2);
    g.bezierCurveTo(x0 + b * 0.1, cy + b / 2, x0 - b * 0.3, cy + b * 0.12, x0 - b * 0.35, cy);
    g.bezierCurveTo(x0 - b * 0.3, cy - b * 0.12, x0 + b * 0.1, cy - b / 2, x0 + b * 0.5, cy - b / 2);
    g.closePath();
  };
  // tail fins
  g.strokeStyle = shade(body, -0.3);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0 - b * 0.2, cy - b * 0.55);
  g.lineTo(x0 - b * 0.2, cy + b * 0.55);
  g.stroke();
  path();
  g.fillStyle = beamGrad(g, cy, b, shade(body, -0.5), body, shade(body, 0.35));
  g.fill();
  g.strokeStyle = sk.trim || 'rgba(0,0,0,0.6)';
  g.lineWidth = 1.4;
  g.stroke();
  // deck casing
  g.fillStyle = 'rgba(255,255,255,0.08)';
  rr(g, x0 + b * 0.3, cy - b * 0.12, x1 - x0 - b * 1.2, b * 0.24, b * 0.12);
  g.fill();
  if (sk.pattern === 'trim' || sk.pattern === 'camo' || sk.pattern === 'dazzle') {
    g.save();
    path();
    g.clip();
    g.globalAlpha = 0.35;
    g.fillStyle = sk.trim || sk.pc[0];
    for (let x = x0; x < x1; x += U * 0.5) g.fillRect(x, cy - b, U * 0.18, b * 2);
    g.restore();
  }
  // sail (conning tower)
  const sx = x0 + (x1 - x0) * 0.6;
  g.strokeStyle = shade(body, -0.35);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(sx + U * 0.05, cy - b * 0.62);
  g.lineTo(sx + U * 0.05, cy + b * 0.62);
  g.stroke();
  block(g, sx - U * 0.2, cy - b * 0.2, U * 0.42, b * 0.4, shade(body, 0.25), shade(body, -0.35), shade(body, 0.5), b * 0.2);
  g.fillStyle = 'rgba(200,230,255,0.4)';
  g.beginPath();
  g.arc(sx + U * 0.12, cy, 1.6, 0, Math.PI * 2);
  g.fill();
  // waterline sheen: the hull sits half-submerged
  g.save();
  path();
  g.clip();
  const wg = g.createLinearGradient(0, cy - b / 2, 0, cy + b / 2);
  wg.addColorStop(0, 'rgba(120,200,255,0.0)');
  wg.addColorStop(0.75, 'rgba(60,140,200,0.0)');
  wg.addColorStop(1, 'rgba(60,140,200,0.35)');
  g.fillStyle = wg;
  g.fillRect(0, 0, L, U);
  g.restore();
}

const spriteCache = new Map();

// Body sprite: len*U x U, bow pointing right (+x).
export function shipSprite(cls, len, skinId, variant = 'body') {
  const key = `${cls}|${len}|${skinId}|${variant}`;
  let c = spriteCache.get(key);
  if (c) return c;
  if (variant === 'body') {
    c = mk(len * U, U);
    const g = c.getContext('2d');
    const sk = skinColors(skinId);
    const rnd = seeded(hashStr(key));
    if (cls === 'carrier') drawCarrier(g, len, sk, rnd);
    else if (cls === 'submarine') drawSub(g, len, sk);
    else drawWarship(g, cls, len, sk, rnd);
  } else if (variant === 'wreck') {
    const body = shipSprite(cls, len, skinId, 'body');
    c = mk(body.width, body.height);
    const g = c.getContext('2d');
    g.drawImage(body, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(6,14,22,0.62)';
    g.fillRect(0, 0, c.width, c.height);
    const rnd = seeded(hashStr(key));
    for (let k = 0; k < len * 3; k++) {
      const x = rnd() * c.width;
      const y = U * (0.3 + rnd() * 0.4);
      const r = U * (0.08 + rnd() * 0.14);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  } else if (variant === 'shadow') {
    const body = shipSprite(cls, len, skinId, 'body');
    const P = U * 0.25;
    c = mk(body.width + P * 2, body.height + P * 2);
    const g = c.getContext('2d');
    g.shadowColor = 'rgba(0,0,0,0.75)';
    g.shadowBlur = U * 0.12;
    g.shadowOffsetX = c.width;
    g.drawImage(body, P - c.width, P);
    c.pad = P;
  } else if (variant === 'silhouette') {
    const body = shipSprite(cls, len, skinId, 'body');
    c = mk(body.width, body.height);
    const g = c.getContext('2d');
    g.drawImage(body, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
  }
  spriteCache.set(key, c);
  return c;
}

// Draws one ship on a board. (x, y) = board origin in px, cs = cell size px.
// opts: { wreck, alpha, wake, t, sink (0..1 sinking progress), lift, tint }
export function paintShip(g, s, x, y, cs, skinId, opts = {}) {
  const t = opts.t || 0;
  const L = s.len * cs;
  const k = cs / U;
  const sink = opts.sink || 0;
  g.save();
  g.globalAlpha = opts.alpha ?? 1;
  const ox = x + s.c * cs;
  const oy = y + s.r * cs;
  const place = () => {
    if (s.dir === 'h') g.translate(ox, oy);
    else {
      g.translate(ox, oy + L);
      g.rotate(-Math.PI / 2);
    }
  };
  const bob = opts.wreck || sink ? 0 : Math.sin(t * 1.7 + s.id * 1.3) * cs * 0.025;
  const lift = opts.lift || 0;
  // shadow (screen-space offset so light comes from the same side for both orientations)
  if (!opts.wreck && sink < 0.5) {
    const sh = shipSprite(s.cls, s.len, skinId, 'shadow');
    g.save();
    g.translate(cs * (0.05 + lift * 0.25), cs * (0.08 + lift * 0.35));
    place();
    g.globalAlpha *= (1 - sink * 2) * (0.85 - lift * 0.3);
    g.drawImage(sh, -sh.pad * k, -sh.pad * k + bob, sh.width * k, sh.height * k);
    g.restore();
  }
  place();
  if (opts.wake && !opts.wreck && !sink) paintWake(g, s, cs, t);
  if (sink) {
    // tilt, settle and fade under the surface
    const e = sink;
    g.translate(L / 2, cs / 2);
    g.rotate(Math.sin(e * Math.PI) * 0.12 * (s.id % 2 ? 1 : -1));
    g.scale(1 - e * 0.12, 1 - e * 0.18);
    g.translate(-L / 2, -cs / 2);
    g.globalAlpha *= 1 - e * 0.25;
    g.drawImage(shipSprite(s.cls, s.len, skinId, 'body'), 0, 0, L, cs);
    g.globalAlpha = (opts.alpha ?? 1) * Math.min(1, e * 1.3);
    g.drawImage(shipSprite(s.cls, s.len, skinId, 'wreck'), 0, 0, L, cs);
  } else {
    if (lift) {
      g.translate(L / 2, cs / 2);
      g.scale(1 + lift * 0.06, 1 + lift * 0.06);
      g.translate(-L / 2, -cs / 2);
    }
    g.drawImage(shipSprite(s.cls, s.len, skinId, opts.wreck ? 'wreck' : 'body'), 0, bob, L, cs);
    if (opts.tint) {
      // coloured overlay for placement validity
      g.globalAlpha = 0.5;
      g.drawImage(tintCanvas(shipSprite(s.cls, s.len, skinId, 'silhouette'), opts.tint), 0, bob, L, cs);
    }
  }
  g.restore();
}

export function shipTint(cls, len, skinId, color) {
  return tintCanvas(shipSprite(cls, len, skinId, 'silhouette'), color);
}

const tintCache = new Map();
function tintCanvas(sil, color) {
  const key = sil.width + 'x' + sil.height + color;
  let c = tintCache.get(key);
  if (c) return c;
  c = mk(sil.width, sil.height);
  const g = c.getContext('2d');
  g.drawImage(sil, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}

// Foam around the hull and a short wake behind the stern (sprite space, scaled to cs).
function paintWake(g, s, cs, t) {
  const L = s.len * cs;
  const b = BEAM[s.cls] * cs;
  const cy = cs / 2;
  const ph = (t * 0.9 + s.id * 0.37) % 1;
  g.save();
  g.lineCap = 'round';
  // stern wake: two diverging foam trails
  for (let k = 0; k < 3; k++) {
    const p = (ph + k / 3) % 1;
    const len = cs * (0.15 + p * 0.5);
    g.strokeStyle = `rgba(235,248,255,${0.32 * (1 - p)})`;
    g.lineWidth = Math.max(1, cs * 0.06 * (1 - p * 0.5));
    g.beginPath();
    g.moveTo(cs * 0.12, cy - b * 0.32);
    g.quadraticCurveTo(cs * 0.05 - len * 0.5, cy - b * 0.4, cs * 0.12 - len, cy - b * (0.42 + p * 0.5));
    g.moveTo(cs * 0.12, cy + b * 0.32);
    g.quadraticCurveTo(cs * 0.05 - len * 0.5, cy + b * 0.4, cs * 0.12 - len, cy + b * (0.42 + p * 0.5));
    g.stroke();
  }
  // churned water at the stern
  g.fillStyle = 'rgba(230,246,255,0.18)';
  g.beginPath();
  g.ellipse(cs * 0.06, cy, cs * 0.16, b * 0.4, 0, 0, Math.PI * 2);
  g.fill();
  // bow wave
  g.strokeStyle = `rgba(240,250,255,${0.35 + 0.15 * Math.sin(t * 3 + s.id)})`;
  g.lineWidth = Math.max(1, cs * 0.045);
  g.beginPath();
  g.moveTo(L - cs * 0.02, cy);
  g.quadraticCurveTo(L - cs * 0.2, cy - b * 0.55, L - cs * 0.55, cy - b * 0.62);
  g.moveTo(L - cs * 0.02, cy);
  g.quadraticCurveTo(L - cs * 0.2, cy + b * 0.55, L - cs * 0.55, cy + b * 0.62);
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- ocean
const oceanCache = new Map();
function oceanTextures(themeId) {
  let o = oceanCache.get(themeId);
  if (o) return o;
  const th = THEMES[themeId] || THEMES.atlantic;
  const S = 256;
  const rnd = seeded(hashStr(themeId));
  const a = mk(S, S);
  const ga = a.getContext('2d');
  ga.lineCap = 'round';
  for (let k = 0; k < 90; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 14 + rnd() * 34;
    const amp = 1.5 + rnd() * 2.5;
    const alpha = 0.1 + rnd() * 0.26;
    const lw = 0.8 + rnd() * 1.8;
    for (let dx = -S; dx <= S; dx += S)
      for (let dy = -S; dy <= S; dy += S) {
        ga.strokeStyle = th.wave;
        ga.globalAlpha = alpha;
        ga.lineWidth = lw;
        ga.beginPath();
        ga.moveTo(x + dx, y + dy);
        ga.quadraticCurveTo(x + dx + len / 2, y + dy - amp * 2, x + dx + len, y + dy);
        ga.stroke();
      }
  }
  const b = mk(S, S);
  const gb = b.getContext('2d');
  for (let k = 0; k < 70; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 0.6 + rnd() * 1.6;
    for (let dx = -S; dx <= S; dx += S)
      for (let dy = -S; dy <= S; dy += S) {
        gb.fillStyle = '#ffffff';
        gb.globalAlpha = 0.25 + rnd() * 0.5;
        gb.beginPath();
        gb.ellipse(x + dx, y + dy, r * 3, r, 0, 0, Math.PI * 2);
        gb.fill();
      }
  }
  // caustic net
  gb.globalAlpha = 0.12;
  gb.strokeStyle = th.wave;
  gb.lineWidth = 1;
  for (let k = 0; k < 40; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 8 + rnd() * 20;
    for (let dx = -S; dx <= S; dx += S)
      for (let dy = -S; dy <= S; dy += S) {
        gb.beginPath();
        gb.arc(x + dx, y + dy, r, rnd() * 6, rnd() * 6 + 1.2);
        gb.stroke();
      }
  }
  o = { a, b, pats: new WeakMap() };
  oceanCache.set(themeId, o);
  return o;
}

function patternFor(g, o, which) {
  let p = o.pats.get(g);
  if (!p) {
    p = { a: g.createPattern(o.a, 'repeat'), b: g.createPattern(o.b, 'repeat') };
    o.pats.set(g, p);
  }
  return p[which];
}

export function paintWater(g, x, y, w, h, cs, themeId, t, radius = 8) {
  const th = THEMES[themeId] || THEMES.atlantic;
  const o = oceanTextures(themeId);
  g.save();
  rr(g, x, y, w, h, radius);
  g.clip();
  const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h);
  gr.addColorStop(0, th.mid);
  gr.addColorStop(1, th.deep);
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  const sc = Math.max(0.35, cs / 36);
  const drawPat = (which, ox, oy, alpha) => {
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(sc, sc);
    const mx = ((ox % 256) + 256) % 256;
    const my = ((oy % 256) + 256) % 256;
    g.translate(mx, my);
    g.fillStyle = patternFor(g, o, which);
    g.fillRect(-mx, -my, w / sc, h / sc);
    g.restore();
  };
  drawPat('a', t * 7, t * 3.5, 0.9);
  drawPat('a', -t * 4 + 90, t * 6 + 40, 0.45);
  drawPat('b', t * 2.5, -t * 4, 0.35 + 0.15 * Math.sin(t * 1.3));
  // soft light spot (sun / moon reflection) + vignette
  const sp = g.createRadialGradient(x + w * 0.28, y + h * 0.2, 0, x + w * 0.28, y + h * 0.2, w * 0.75);
  sp.addColorStop(0, th.spot);
  sp.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sp;
  g.fillRect(x, y, w, h);
  const vg = g.createRadialGradient(x + w / 2, y + h / 2, w * 0.35, x + w / 2, y + h / 2, w * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = vg;
  g.fillRect(x, y, w, h);
  g.restore();
}

export function paintGrid(g, x, y, cs, themeId, opts = {}) {
  const th = THEMES[themeId] || THEMES.atlantic;
  const S = cs * N;
  g.save();
  if (opts.radar) {
    g.strokeStyle = `rgba(${th.sweep},0.10)`;
    g.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      g.beginPath();
      g.arc(x + S / 2, y + S / 2, (S / 2) * (k / 3) * 1.0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.strokeStyle = th.line;
  g.lineWidth = 1;
  g.beginPath();
  for (let k = 1; k < N; k++) {
    const p = Math.round(k * cs) + 0.5;
    g.moveTo(x + p, y);
    g.lineTo(x + p, y + S);
    g.moveTo(x, y + p);
    g.lineTo(x + S, y + p);
  }
  g.stroke();
  // little crosses at intersections for a nautical-chart feel
  if (cs > 22) {
    g.strokeStyle = `rgba(${th.sweep},0.28)`;
    g.beginPath();
    for (let r = 1; r < N; r++)
      for (let c = 1; c < N; c++) {
        const px = x + c * cs;
        const py = y + r * cs;
        g.moveTo(px - 2.5, py + 0.5);
        g.lineTo(px + 2.5, py + 0.5);
        g.moveTo(px + 0.5, py - 2.5);
        g.lineTo(px + 0.5, py + 2.5);
      }
    g.stroke();
  }
  g.restore();
}

// Gold-trimmed frame behind a board.
export function paintFrame(g, x, y, w, h, glow = 0.35) {
  const pad = Math.max(3, w * 0.012);
  g.save();
  g.shadowColor = `rgba(243,194,74,${glow * 0.6})`;
  g.shadowBlur = 16;
  rr(g, x - pad, y - pad, w + pad * 2, h + pad * 2, 10);
  const bg = g.createLinearGradient(0, y - pad, 0, y + h + pad);
  bg.addColorStop(0, '#1b1b20');
  bg.addColorStop(1, '#0c0c0f');
  g.fillStyle = bg;
  g.fill();
  g.shadowBlur = 0;
  const gg = g.createLinearGradient(0, y - pad, 0, y + h + pad);
  gg.addColorStop(0, '#f7d774');
  gg.addColorStop(0.5, '#c9971c');
  gg.addColorStop(1, '#f2c75a');
  g.strokeStyle = gg;
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- effect sprites
let FXC = null;
function radial(size, stops) {
  const c = mk(size, size);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}
export function FX() {
  if (FXC) return FXC;
  FXC = {
    fire: radial(64, [
      [0, 'rgba(255,252,225,1)'],
      [0.22, 'rgba(255,210,90,0.95)'],
      [0.5, 'rgba(255,110,20,0.6)'],
      [1, 'rgba(255,40,0,0)'],
    ]),
    glow: radial(64, [
      [0, 'rgba(255,120,40,0.7)'],
      [0.5, 'rgba(255,70,20,0.25)'],
      [1, 'rgba(255,60,0,0)'],
    ]),
    flash: radial(64, [
      [0, 'rgba(255,255,255,1)'],
      [0.3, 'rgba(255,240,180,0.9)'],
      [1, 'rgba(255,200,80,0)'],
    ]),
    smoke: radial(64, [
      [0, 'rgba(58,58,62,0.8)'],
      [0.55, 'rgba(45,45,50,0.4)'],
      [1, 'rgba(40,40,44,0)'],
    ]),
    steam: radial(64, [
      [0, 'rgba(235,242,250,0.75)'],
      [1, 'rgba(230,240,250,0)'],
    ]),
    foam: radial(64, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.5, 'rgba(225,245,255,0.55)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    drop: radial(16, [
      [0, 'rgba(255,255,255,1)'],
      [0.55, 'rgba(205,238,255,0.85)'],
      [1, 'rgba(200,235,255,0)'],
    ]),
    spark: radial(16, [
      [0, 'rgba(255,255,235,1)'],
      [0.5, 'rgba(255,190,60,0.9)'],
      [1, 'rgba(255,120,0,0)'],
    ]),
    gold: radial(32, [
      [0, 'rgba(255,240,170,1)'],
      [0.45, 'rgba(243,194,74,0.7)'],
      [1, 'rgba(243,194,74,0)'],
    ]),
  };
  return FXC;
}

const sweepCache = new Map();
export function sweepSprite(themeId) {
  let c = sweepCache.get(themeId);
  if (c) return c;
  const th = THEMES[themeId] || THEMES.atlantic;
  const S = 256;
  c = mk(S, S);
  const g = c.getContext('2d');
  const cx = S / 2;
  const span = 1.1;
  const steps = 48;
  for (let k = 0; k < steps; k++) {
    const a0 = -span + (span * k) / steps;
    const a1 = -span + (span * (k + 1)) / steps + 0.01;
    g.fillStyle = `rgba(${th.sweep},${0.28 * Math.pow(k / steps, 2.2)})`;
    g.beginPath();
    g.moveTo(cx, cx);
    g.arc(cx, cx, cx, a0, a1);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = `rgba(${th.sweep},0.75)`;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx, cx);
  g.lineTo(S, cx);
  g.stroke();
  sweepCache.set(themeId, c);
  return c;
}

// Persistent miss marker (white buoy ring).
export function paintMiss(g, cx, cy, cs, t, seed, fresh = 0) {
  const r = cs * 0.13;
  g.save();
  g.strokeStyle = `rgba(220,240,255,${0.28 + 0.12 * Math.sin(t * 2 + seed)})`;
  g.lineWidth = Math.max(1, cs * 0.035);
  g.beginPath();
  g.arc(cx, cy, r * (1.9 + 0.25 * Math.sin(t * 2 + seed)), 0, Math.PI * 2);
  g.stroke();
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(1, '#a9c7dc');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, r * (1 + fresh * 0.6), 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// Burning hit: crater + flickering flames (additive).
export function paintFire(g, cx, cy, cs, t, seed, power = 1) {
  const fx = FX();
  g.save();
  g.fillStyle = 'rgba(20,8,4,0.55)';
  g.beginPath();
  g.arc(cx, cy, cs * 0.24, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.55 * power;
  const gs = cs * (1.25 + 0.12 * Math.sin(t * 7 + seed));
  g.drawImage(fx.glow, cx - gs / 2, cy - gs / 2, gs, gs);
  for (let k = 0; k < 3; k++) {
    const f = 0.5 + 0.5 * Math.sin(t * (8 + k * 3) + seed * 2.3 + k * 2.1);
    const s = cs * (0.38 + 0.22 * f) * power;
    const ox = Math.sin(t * 5 + k * 2 + seed) * cs * 0.06;
    const oy = -k * cs * 0.07 - f * cs * 0.04;
    g.globalAlpha = 0.85 * power;
    g.drawImage(fx.fire, cx - s / 2 + ox, cy - s / 2 + oy, s, s);
  }
  g.restore();
}

// Red peg for a hit on a ship that is still afloat (enemy board).
export function paintHitPeg(g, cx, cy, cs) {
  g.save();
  const r = cs * 0.15;
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 0, cx, cy, r);
  gr.addColorStop(0, '#ffb3a6');
  gr.addColorStop(0.5, '#ff3b30');
  gr.addColorStop(1, '#8a0f08');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
