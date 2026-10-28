// Canvas rendering: track backgrounds, cached sprites, effects and the mini view.
// Everything is drawn in logical units (400 x 560) through one transform.

import { CELL, COLS, ROWS, WORLD_W, WORLD_H, TIERS, FAST, CAMO, REGEN, TOWERS, SKINS } from './data.js';
import { geometry } from './sim.js';

const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (f - r) * p);
  g = Math.round(g + (f - g) * p);
  b = Math.round(b + (f - b) * p);
  return `rgb(${r},${g},${b})`;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ sprites

const spriteCache = new Map();
function cached(key, make) {
  let v = spriteCache.get(key);
  if (!v) { v = make(); spriteCache.set(key, v); if (spriteCache.size > 900) spriteCache.clear(); }
  return v;
}

// Blob (enemy) sprite: layered jelly body with tier colour, core, rings, flags.
export function blobSprite(tier, flags, K) {
  return cached(`b${tier}|${flags}|${K.toFixed(2)}`, () => {
    const def = TIERS[tier];
    const R = def.r;
    const L = (R + 9) * 2;
    const c = mk(L * K, L * K);
    const g = c.getContext('2d');
    g.setTransform(K, 0, 0, K, (L * K) / 2, (L * K) / 2);
    // shadow
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(0, R * 0.9, R * 0.95, R * 0.3, 0, 0, 6.283); g.fill();
    // body (wobbly outline)
    const body = def.body;
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const th = (i / 48) * 6.283;
      const rr = R * (1 + 0.045 * Math.sin(3 * th + tier));
      const x = Math.cos(th) * rr;
      let y = Math.sin(th) * rr * 0.9;
      if (y > 0) y += R * 0.08 * Math.max(0, Math.sin(th * 4)) ;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    const grd = g.createRadialGradient(-R * 0.35, -R * 0.5, R * 0.1, 0, 0, R * 1.15);
    grd.addColorStop(0, shade(body, 0.6));
    grd.addColorStop(0.55, body);
    grd.addColorStop(1, shade(body, -0.35));
    g.fillStyle = grd;
    g.fill();
    g.save();
    g.clip();
    // core (layers)
    if (tier >= 1) {
      g.globalAlpha = 0.5;
      g.fillStyle = def.core;
      g.beginPath(); g.ellipse(0, R * 0.14, R * 0.5, R * 0.46, 0, 0, 6.283); g.fill();
      g.globalAlpha = 1;
    }
    for (let l = 0; l < Math.min(3, tier); l++) {
      g.strokeStyle = 'rgba(255,255,255,.22)';
      g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(0, R * 0.14, R * (0.78 - l * 0.2), R * (0.72 - l * 0.2), 0, 0, 6.283); g.stroke();
    }
    // armour band
    if (def.armor > 0) {
      const bg = g.createLinearGradient(0, R * 0.25, 0, R * 0.55);
      bg.addColorStop(0, '#f2f6ff'); bg.addColorStop(0.5, '#6b778c'); bg.addColorStop(1, '#c9d2e0');
      g.fillStyle = bg;
      g.fillRect(-R, R * 0.2, R * 2, R * 0.26);
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (let x = -R; x < R; x += R * 0.4) g.fillRect(x, R * 0.2, 1, R * 0.26);
    }
    // camouflage blotches
    if (flags & CAMO) {
      g.fillStyle = 'rgba(40,70,40,.45)';
      const rr = rng(tier * 97 + 13);
      for (let i = 0; i < 6; i++) {
        g.beginPath(); g.ellipse((rr() - 0.5) * R * 1.4, (rr() - 0.5) * R * 1.2, R * 0.22, R * 0.14, rr() * 3, 0, 6.283); g.fill();
      }
    }
    g.restore();
    // highlight
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.save(); g.rotate(-0.6);
    g.beginPath(); g.ellipse(-R * 0.42, -R * 0.42, R * 0.22, R * 0.11, 0, 0, 6.283); g.fill();
    g.restore();
    // face
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(-R * 0.28, -R * 0.02, R * 0.19, R * 0.25, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(R * 0.28, -R * 0.02, R * 0.19, R * 0.25, 0, 0, 6.283); g.fill();
    g.fillStyle = '#16121c';
    g.beginPath(); g.arc(-R * 0.24, R * 0.02, R * 0.1, 0, 6.283); g.fill();
    g.beginPath(); g.arc(R * 0.32, R * 0.02, R * 0.1, 0, 6.283); g.fill();
    g.strokeStyle = '#16121c';
    g.lineWidth = Math.max(1, R * 0.07);
    g.beginPath(); g.arc(0, R * 0.36, R * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    // flags
    if (flags & FAST) {
      g.strokeStyle = 'rgba(255,255,255,.7)';
      g.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const y = -R * 0.3 + i * R * 0.35;
        g.beginPath(); g.moveTo(-R * 1.25, y); g.lineTo(-R * 0.95 - i * 1.5, y); g.stroke();
      }
    }
    if (flags & REGEN) {
      g.fillStyle = '#ff9ccc';
      for (const [x, y] of [[R * 0.85, -R * 0.7], [R * 0.95, -R * 0.2], [-R * 0.95, -R * 0.75]]) {
        g.fillRect(x - 1.6, y - 0.5, 3.2, 1);
        g.fillRect(x - 0.5, y - 2, 1, 4);
      }
    }
    if (def.boss) {
      g.fillStyle = '#ffd34a';
      g.strokeStyle = '#8a5a00';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-R * 0.6, -R * 0.85); g.lineTo(-R * 0.6, -R * 1.35); g.lineTo(-R * 0.3, -R * 1.05);
      g.lineTo(0, -R * 1.45); g.lineTo(R * 0.3, -R * 1.05); g.lineTo(R * 0.6, -R * 1.35); g.lineTo(R * 0.6, -R * 0.85);
      g.closePath(); g.fill(); g.stroke();
    }
    return c;
  });
}

const TOWER_BOX = 46;

// Tower base (static part): platform and body, drawn for a skin.
export function towerBase(typeId, skinId, K) {
  return cached(`tb${typeId}|${skinId}|${K.toFixed(2)}`, () => {
    const skin = SKINS[skinId] || SKINS.classic;
    const type = TOWERS[typeId];
    const L = TOWER_BOX;
    const c = mk(L * K, L * K);
    const g = c.getContext('2d');
    g.setTransform(K, 0, 0, K, (L * K) / 2, (L * K) / 2);
    // platform
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(1.5, 16, 17, 6, 0, 0, 6.283); g.fill();
    const pg = g.createRadialGradient(-4, 10, 2, 0, 12, 18);
    pg.addColorStop(0, '#8b8290'); pg.addColorStop(1, '#3b3442');
    g.fillStyle = pg;
    g.beginPath(); g.ellipse(0, 12, 17, 9, 0, 0, 6.283); g.fill();
    g.fillStyle = shade(skin.trim, -0.1);
    g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(0, 11, 14, 6.5, 0, 0, 6.283); g.fill();
    g.globalAlpha = 1;
    const wall = skin.wall, roof = skin.roof, trim = skin.trim;
    const wallG = (x0, x1) => {
      const w = g.createLinearGradient(x0, 0, x1, 0);
      w.addColorStop(0, shade(wall, 0.25)); w.addColorStop(0.55, wall); w.addColorStop(1, shade(wall, -0.3));
      return w;
    };
    switch (type.id) {
      case 'archer':
        g.fillStyle = wallG(-8, 8);
        g.fillRect(-8, -6, 16, 19);
        g.fillStyle = roof;
        g.beginPath(); g.moveTo(-11, -5); g.lineTo(0, -19); g.lineTo(11, -5); g.closePath(); g.fill();
        g.fillStyle = '#2b1d12'; g.fillRect(-2.5, -1, 5, 6);
        g.fillStyle = trim; g.fillRect(-8, 11, 16, 2);
        break;
      case 'cannon':
        g.fillStyle = wallG(-12, 12);
        g.beginPath(); g.ellipse(0, 3, 12, 10, 0, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-9, 3 + i * 4); g.lineTo(9, 3 + i * 4); g.stroke(); }
        g.fillStyle = trim;
        g.beginPath(); g.ellipse(0, -2, 9, 4, 0, 0, 6.283); g.fill();
        break;
      case 'frost': {
        const ig = g.createLinearGradient(-9, -16, 9, 12);
        ig.addColorStop(0, '#e9fdff'); ig.addColorStop(0.5, '#8fe9ff'); ig.addColorStop(1, '#2a6fa0');
        g.fillStyle = ig;
        g.beginPath(); g.moveTo(0, -16); g.lineTo(9, -2); g.lineTo(5, 12); g.lineTo(-5, 12); g.lineTo(-9, -2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 10); g.stroke();
        break;
      }
      case 'bolt':
        g.fillStyle = wallG(-7, 7);
        g.fillRect(-7, -12, 14, 24);
        g.fillStyle = trim;
        for (let y = -8; y <= 8; y += 6) g.fillRect(-7, y, 14, 2);
        g.fillStyle = roof;
        g.fillRect(-9, -14, 18, 4);
        break;
      case 'sniper':
        g.fillStyle = wallG(-4.5, 4.5);
        g.fillRect(-4.5, -14, 9, 28);
        g.fillStyle = roof;
        g.fillRect(-8, -16, 16, 4);
        g.fillStyle = trim; g.fillRect(-1, -8, 2, 4);
        break;
      case 'glue':
        g.fillStyle = wallG(-11, 11);
        g.beginPath(); g.ellipse(0, 0, 11, 13, 0, 0, 6.283); g.fill();
        g.fillStyle = '#7dff3a';
        g.beginPath(); g.ellipse(0, -10, 11, 3, 0, 0, 6.283); g.fill();
        g.beginPath(); g.arc(-7, 2, 2.4, 0, 6.283); g.arc(4, 7, 3, 0, 6.283); g.fill();
        break;
      case 'lantern':
        g.fillStyle = '#2b2430'; g.fillRect(-1.6, -4, 3.2, 20);
        g.fillStyle = roof;
        g.beginPath(); g.moveTo(-8, -15); g.lineTo(0, -21); g.lineTo(8, -15); g.closePath(); g.fill();
        g.fillStyle = trim; g.fillRect(-6, -15, 12, 11);
        g.fillStyle = 'rgba(255,240,180,.9)'; g.fillRect(-4.5, -13, 9, 7);
        g.fillStyle = '#2b2430'; g.fillRect(-7, -4, 14, 2.4);
        break;
    }
    return c;
  });
}

// Turret head (rotates to aim). Drawn pointing up (-y).
export function towerHead(typeId, skinId, K) {
  return cached(`th${typeId}|${skinId}|${K.toFixed(2)}`, () => {
    const skin = SKINS[skinId] || SKINS.classic;
    const L = TOWER_BOX;
    const c = mk(L * K, L * K);
    const g = c.getContext('2d');
    g.setTransform(K, 0, 0, K, (L * K) / 2, (L * K) / 2);
    switch (typeId) {
      case 'archer':
        g.strokeStyle = '#5b3a1e'; g.lineWidth = 2.4; g.lineCap = 'round';
        g.beginPath(); g.arc(0, -4, 13, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(-12.4, -4 - 5.6); g.lineTo(0, -17); g.lineTo(12.4, -9.6); g.stroke();
        break;
      case 'cannon':
        g.fillStyle = '#3b3f48';
        g.beginPath(); g.roundRect(-4, -20, 8, 20, 3); g.fill();
        g.fillStyle = '#1b1d22'; g.beginPath(); g.ellipse(0, -20, 4.5, 2.4, 0, 0, 6.283); g.fill();
        g.fillStyle = skin.trim; g.fillRect(-4.5, -9, 9, 2.4);
        break;
      case 'frost':
        break;
      case 'bolt':
        g.strokeStyle = skin.glow; g.lineWidth = 1.4;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * 6.283;
          g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); g.stroke();
        }
        break;
      case 'sniper':
        g.fillStyle = '#2a2f3d';
        g.fillRect(-2, -26, 4, 22);
        g.fillStyle = '#aab3c8';
        g.fillRect(-4, -14, 8, 4);
        g.fillStyle = skin.trim; g.beginPath(); g.arc(0, -26, 2, 0, 6.283); g.fill();
        break;
      case 'glue':
        g.fillStyle = '#4b5a3a';
        g.fillRect(-3, -18, 6, 14);
        g.fillStyle = '#9dff5a';
        g.beginPath(); g.ellipse(0, -18, 4, 2.4, 0, 0, 6.283); g.fill();
        break;
    }
    return c;
  });
}

// Small glowing orb used for projectiles and some heads.
function orb(color, r) {
  return cached(`o${color}|${r}`, () => {
    const S = Math.ceil(r * 4);
    const c = mk(S, S);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return c;
  });
}

// ------------------------------------------------------------------ background

const decoTree = (g, x, y, s, rr, dark) => {
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(x + 3, y + 6, s * 0.9, s * 0.4, 0, 0, 6.283); g.fill();
  g.fillStyle = '#6b4a2a'; g.fillRect(x - 1.5, y - 2, 3, 8);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = shade(dark, 0.1 * i - 0.05 + rr() * 0.1);
    g.beginPath(); g.arc(x + (rr() - 0.5) * 3, y - 6 - i * 3, s * (0.95 - i * 0.15), 0, 6.283); g.fill();
  }
};

const decoRock = (g, x, y, s, rr, col) => {
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(x + 2, y + 5, s, s * 0.4, 0, 0, 6.283); g.fill();
  g.fillStyle = shade(col, -0.2 + rr() * 0.15);
  g.beginPath();
  g.moveTo(x - s, y + 4); g.lineTo(x - s * 0.6, y - s * 0.8); g.lineTo(x + s * 0.3, y - s); g.lineTo(x + s, y - s * 0.2); g.lineTo(x + s * 0.8, y + 4);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.beginPath(); g.moveTo(x - s * 0.5, y - s * 0.6); g.lineTo(x + s * 0.2, y - s * 0.9); g.lineTo(x, y - s * 0.3); g.closePath(); g.fill();
};

const decoPine = (g, x, y, s, rr) => {
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.beginPath(); g.ellipse(x + 2, y + 6, s * 0.8, s * 0.35, 0, 0, 6.283); g.fill();
  g.fillStyle = '#5b4632'; g.fillRect(x - 1, y, 2, 6);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i === 2 ? '#eef7ff' : '#2f6b4f';
    g.beginPath(); g.moveTo(x - s * (1 - i * 0.2), y + 2 - i * s * 0.6); g.lineTo(x + s * (1 - i * 0.2), y + 2 - i * s * 0.6); g.lineTo(x, y - s * 1.4 - i * s * 0.1 + s * 0.3); g.closePath(); g.fill();
  }
};

const decoPalm = (g, x, y, s, rr) => {
  g.strokeStyle = '#7a5530'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x, y + 6); g.quadraticCurveTo(x + 3, y, x + 1, y - 7); g.stroke();
  g.strokeStyle = '#2f9e4b'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.283 + rr();
    g.beginPath(); g.moveTo(x + 1, y - 7); g.quadraticCurveTo(x + Math.cos(a) * s * 0.6, y - 7 + Math.sin(a) * s * 0.4 - 2, x + Math.cos(a) * s, y - 7 + Math.sin(a) * s * 0.6); g.stroke();
  }
};

const decoReed = (g, x, y, s, rr) => {
  g.strokeStyle = '#6f8f3a'; g.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    g.beginPath(); g.moveTo(x + i * 2, y + 4); g.lineTo(x + i * 2 + (rr() - 0.5) * 3, y - s * (0.8 + rr() * 0.6)); g.stroke();
  }
  g.fillStyle = '#7a4a22';
  g.beginPath(); g.ellipse(x, y - s * 0.6, 1.6, 3, 0, 0, 6.283); g.fill();
};

const decoCandy = (g, x, y, s, rr) => {
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.beginPath(); g.ellipse(x + 2, y + 5, s, s * 0.4, 0, 0, 6.283); g.fill();
  const cols = ['#ff5f9e', '#8af0d0', '#ffd34a', '#b07bff'];
  g.fillStyle = cols[Math.floor(rr() * cols.length)];
  g.beginPath(); g.arc(x, y - 2, s, Math.PI, 0); g.lineTo(x + s, y + 4); g.lineTo(x - s, y + 4); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.beginPath(); g.ellipse(x - s * 0.4, y - s * 0.6, s * 0.25, s * 0.15, -0.5, 0, 6.283); g.fill();
};

const decoCloud = (g, x, y, s) => {
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.beginPath(); g.arc(x, y, s * 0.8, 0, 6.283); g.arc(x - s * 0.9, y + s * 0.3, s * 0.6, 0, 6.283); g.arc(x + s * 0.9, y + s * 0.3, s * 0.65, 0, 6.283); g.fill();
};

const WATER = {
  desert: ['#5bc8e8', '#2f8fb8'], snow: ['#bfe9ff', '#7fc2ea'], lava: ['#ff7a1a', '#c4300f'],
  swamp: ['#3b5b3a', '#1f3328'], candy: ['#6b3a2a', '#3e1f16'],
};

// Background (ground, water, obstacles, path) drawn once per track and size.
export function buildBackground(track, width, height, dpr) {
  const scale = Math.min(width / WORLD_W, height / WORLD_H);
  const K = scale * dpr;
  const c = mk(width * dpr, height * dpr);
  const g = c.getContext('2d');
  const ox = (width - WORLD_W * scale) / 2, oy = (height - WORLD_H * scale) / 2;
  g.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
  // Sky/ground gradient over full canvas (world space)
  const bgG = g.createLinearGradient(0, 0, 0, WORLD_H);
  bgG.addColorStop(0, track.bg[0]);
  bgG.addColorStop(1, track.bg[1]);
  g.save();
  g.scale(scale, scale);
  g.fillStyle = bgG;
  g.fillRect(-width / scale, -height / scale, (width * 3) / scale, (height * 3) / scale);
  const rr = rng(track.id.length * 977 + track.map.length);
  // ground speckles
  g.fillStyle = track.grass;
  g.globalAlpha = 0.35;
  for (let i = 0; i < 160; i++) {
    g.beginPath(); g.ellipse(rr() * WORLD_W, rr() * WORLD_H, 2 + rr() * 3, 1 + rr() * 1.5, 0, 0, 6.283); g.fill();
  }
  g.globalAlpha = 1;
  const geo = geometry(track);
  // path: edge then surface then dashed centre
  if (track.theme !== 'sky') {
    const pathLine = (w, col) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(geo.px[0], geo.py[0]);
      for (let i = 1; i < geo.px.length; i++) g.lineTo(geo.px[i], geo.py[i]);
      g.stroke();
    };
    g.save();
    g.globalAlpha = 0.35; g.translate(3, 5); pathLine(CELL * 0.98, '#000'); g.restore();
    pathLine(CELL * 0.98, track.edge);
    pathLine(CELL * 0.82, track.path);
    g.setLineDash([6, 8]);
    pathLine(2, 'rgba(255,255,255,.35)');
    g.setLineDash([]);
  } else {
    // sky: floating path as a plank bridge
    const pathLine = (w, col) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(geo.px[0], geo.py[0]);
      for (let i = 1; i < geo.px.length; i++) g.lineTo(geo.px[i], geo.py[i]);
      g.stroke();
    };
    g.globalAlpha = 0.3; pathLine(CELL * 0.98 + 6, '#0a3a66'); g.globalAlpha = 1;
    pathLine(CELL * 0.98, track.edge);
    pathLine(CELL * 0.82, track.path);
    g.setLineDash([4, 6]); pathLine(2, 'rgba(120,80,30,.45)'); g.setLineDash([]);
  }
  // buildable slot marks
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let r = 0; r < ROWS; r++) for (let c2 = 0; c2 < COLS; c2++) {
    const idx = r * COLS + c2;
    if (track.map[r][c2] === '.' && !geo.cells.has(idx)) {
      g.beginPath(); g.arc((c2 + 0.5) * CELL, (r + 0.5) * CELL, 15, 0, 6.283); g.fill();
    }
  }
  // obstacles and water
  const items = [];
  for (let r = 0; r < ROWS; r++) for (let c2 = 0; c2 < COLS; c2++) {
    const ch = track.map[r][c2];
    if (ch === '.') continue;
    items.push([ch, (c2 + 0.5) * CELL, (r + 0.5) * CELL, c2, r]);
  }
  if (track.theme === 'sky') {
    for (const [ch, x, y] of items) if (ch === '~') decoCloud(g, x, y, 18 + rr() * 6);
  } else {
    // water first (ground layer), then the props sorted by y
    for (const [ch, x, y, c2, r] of items) {
      if (ch !== '~') continue;
      const [w1, w2] = WATER[track.theme] || ['#4aa3d6', '#2a6f9c'];
      const pg = g.createRadialGradient(x - 6, y - 6, 4, x, y, CELL * 0.7);
      pg.addColorStop(0, w1); pg.addColorStop(1, w2);
      g.fillStyle = pg;
      g.beginPath(); g.roundRect(c2 * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.ellipse(x - 6, y - 8, 7, 2.5, -0.3, 0, 6.283); g.fill();
    }
    items.sort((a, b) => a[2] - b[2]);
    for (const [ch, x, y] of items) {
      if (ch !== '#') continue;
      const r2 = rng((x * 13 + y * 7) | 0);
      switch (track.deco) {
        case 'tree': decoTree(g, x, y + 4, 9, r2, track.theme === 'snow' ? '#f5fbff' : '#2f8a3e'); break;
        case 'rock':
          decoRock(g, x, y + 4, 10, r2, track.theme === 'lava' ? '#2b2220' : '#b98a55'); break;
        case 'pine': decoPine(g, x, y + 4, 8, r2); break;
        case 'palm': decoTree(g, x, y + 4, 10, r2, '#1f7a3a'); decoPalm(g, x + 2, y + 6, 9, r2); break;
        case 'reed': decoReed(g, x, y + 6, 12, r2); break;
        case 'candy': decoCandy(g, x, y + 4, 10, r2); break;
        default: decoTree(g, x, y + 4, 9, r2, '#2f8a3e');
      }
    }
  }
  g.restore();
  return { canvas: c, scale, ox, oy, width, height, dpr };
}

// Track preview card for the track picker (no DOM dependency beyond canvas).
export function drawTrackPreview(canvas, track) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 120, h = canvas.clientHeight || 120;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const bg = buildBackground(track, w, h, dpr);
  const g = canvas.getContext('2d');
  g.drawImage(bg.canvas, 0, 0, canvas.width, canvas.height);
}

// ------------------------------------------------------------------ board view

export class BoardRenderer {
  constructor(canvas, { mini = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mini = mini;
    this.dpr = 1;
    this.w = 0; this.h = 0;
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.bg = null;
    this.track = null;
    this.fx = { parts: [], rings: [], texts: [], bolts: [] };
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
  }

  resize(w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = Math.min(w / WORLD_W, h / WORLD_H);
    this.ox = (w - WORLD_W * this.scale) / 2;
    this.oy = (h - WORLD_H * this.scale) / 2;
    this.bg = null;
    spriteCache.clear();
  }

  setTrack(track) {
    if (this.track !== track) { this.track = track; this.bg = null; }
  }

  // Canvas px -> logical world coordinates
  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    return { x: (x - this.ox) / this.scale, y: (y - this.oy) / this.scale };
  }

  ensureBg() {
    if (!this.bg && this.track) this.bg = buildBackground(this.track, this.w, this.h, this.dpr);
  }

  // Effects from match events (called once per frame with the drained list).
  consume(events, sideIdx) {
    for (const ev of events) {
      if (ev.side !== sideIdx) continue;
      switch (ev.type) {
        case 'pop': this.popFx(ev); break;
        case 'leak': this.leakFx(ev); break;
        case 'boom': this.boomFx(ev); break;
        case 'hit': this.spark(ev.x, ev.y, '#fff7c2', 3); break;
        case 'bolt': this.bolts(ev); break;
        case 'build': this.puff(ev.x, ev.y, '#f3d27a', 8); break;
        case 'upgrade': this.spark(ev.x, ev.y, '#ffe27a', 14); this.text(ev.x, ev.y - 22, '▲', '#ffe27a', 16); break;
        case 'sell': this.text(ev.x, ev.y - 20, '+' + ev.refund, '#ffd34a', 15); break;
        default: break;
      }
    }
  }

  popFx(ev) {
    const col = TIERS[ev.tier].body;
    this.spark(ev.x, ev.y, col, ev.boss ? 26 : 7);
    this.spark(ev.x, ev.y, '#ffffff', 3);
    this.fx.rings.push({ x: ev.x, y: ev.y, r0: 6, r1: ev.boss ? 60 : 24, life: 0.35, max: 0.35, color: col });
    if (ev.bounty > 0) this.text(ev.x, ev.y - 14, '+' + ev.bounty, '#ffd34a', 13);
    if (this.fx.rings.length > 60) this.fx.rings.splice(0, 20);
  }

  leakFx(ev) {
    this.shake = Math.min(12, this.shake + (ev.boss ? 9 : 4));
    this.flash = 0.25;
    this.spark(ev.x, ev.y, '#ff5a6a', 16);
    this.text(ev.x, ev.y - 16, '-' + ev.cost, '#ff5a6a', 16);
  }

  boomFx(ev) {
    const col = ev.kind === 'frost' ? '#9ff0ff' : ev.kind === 'glue' ? '#9dff5a' : '#ffb35a';
    this.fx.rings.push({ x: ev.x, y: ev.y, r0: 4, r1: Math.max(14, ev.r), life: 0.3, max: 0.3, color: col });
    this.spark(ev.x, ev.y, col, 12);
    this.puff(ev.x, ev.y, 'rgba(255,220,160,.8)', 5);
  }

  bolts(ev) {
    this.fx.bolts.push({ pts: ev.pts, life: 0.18, max: 0.18 });
    if (this.fx.bolts.length > 40) this.fx.bolts.shift();
  }

  spark(x, y, color, n) {
    const P = this.fx.parts;
    for (let i = 0; i < n && P.length < 420; i++) {
      const a = Math.random() * 6.283, s = 40 + Math.random() * 120;
      P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0.4 + Math.random() * 0.3, max: 0.7, color, size: 1.6 + Math.random() * 1.8, g: 220, sq: true });
    }
  }

  puff(x, y, color, n) {
    const P = this.fx.parts;
    for (let i = 0; i < n && P.length < 420; i++) {
      const a = Math.random() * 6.283, s = 10 + Math.random() * 30;
      P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 8, life: 0.45, max: 0.45, color, size: 4 + Math.random() * 3, g: -10, sq: false });
    }
  }

  text(x, y, s, color, size) {
    this.fx.texts.push({ x, y, s, color, size, life: 0.9, max: 0.9 });
    if (this.fx.texts.length > 40) this.fx.texts.shift();
  }

  // Advances effects by dt (seconds of real time).
  tick(dt) {
    this.time += dt;
    const fx = this.fx;
    let w = 0;
    for (let i = 0; i < fx.parts.length; i++) {
      const p = fx.parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.97;
      fx.parts[w++] = p;
    }
    fx.parts.length = w;
    w = 0;
    for (const r of fx.rings) { r.life -= dt; if (r.life > 0) fx.rings[w++] = r; }
    fx.rings.length = w;
    w = 0;
    for (const t of fx.texts) { t.life -= dt; t.y -= 26 * dt; if (t.life > 0) fx.texts[w++] = t; }
    fx.texts.length = w;
    w = 0;
    for (const b of fx.bolts) { b.life -= dt; if (b.life > 0) fx.bolts[w++] = b; }
    fx.bolts.length = w;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt);
  }

  // Full board render. state: { placing, hoverCol, hoverRow, hoverOk, hoverReason, selected (tower id), rangeOnly }
  render(match, side, state) {
    const ctx = this.ctx;
    this.ensureBg();
    const dpr = this.dpr, sc = this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.bg) return;
    ctx.drawImage(this.bg.canvas, 0, 0);
    const K = sc * dpr;
    let sx = 0, sy = 0;
    if (this.shake > 0.1) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    ctx.setTransform(K, 0, 0, K, (this.ox * dpr) + sx * K, (this.oy * dpr) + sy * K);

    // Placement highlight and range previews
    if (state.placing && state.hoverCol !== undefined && state.hoverCol >= 0) {
      const type = TOWERS[state.placing];
      const cx = (state.hoverCol + 0.5) * CELL, cy = (state.hoverRow + 0.5) * CELL;
      ctx.fillStyle = state.hoverOk ? 'rgba(90,255,150,.35)' : 'rgba(255,60,80,.45)';
      ctx.fillRect(state.hoverCol * CELL + 2, state.hoverRow * CELL + 2, CELL - 4, CELL - 4);
      this.rangeCircle(cx, cy, type.base.range, state.hoverOk ? '#bff7d0' : '#ff8a96');
    }
    if (state.selected) {
      const t = side.towers.find((x) => x.id === state.selected);
      if (t) this.rangeCircle(t.x, t.y, t.st.range, '#ffe27a');
    }

    // Zones (goo puddles)
    for (const z of side.zones) {
      const a = Math.min(1, z.t) * 0.5 + 0.1 * Math.sin(this.time * 6);
      ctx.fillStyle = `rgba(120,255,80,${0.22 * a + 0.1})`;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.7, 0, 0, 6.283); ctx.fill();
    }

    // Towers
    const skin = side.skin;
    for (const t of side.towers) {
      const base = towerBase(t.type, skin, K);
      const L = TOWER_BOX;
      ctx.drawImage(base, t.x - L / 2, t.y - L / 2, L, L);
      if (t.st.kind !== 'lantern') {
        const head = towerHead(t.type, skin, K);
        ctx.save();
        ctx.translate(t.x, t.y - 2);
        ctx.rotate(t.aim + Math.PI / 2 + (t.recoil > 0 ? 0 : 0));
        const kick = t.recoil > 0 ? t.recoil * 14 : 0;
        ctx.drawImage(head, -L / 2, -L / 2 + kick, L, L);
        ctx.restore();
      }
      if (t.type === 'frost' || t.type === 'bolt') {
        const col = t.type === 'frost' ? '#9fefff' : '#fff27a';
        const pulse = 0.7 + 0.3 * Math.sin(this.time * 5 + t.id);
        const o = orb(col, 6);
        ctx.globalAlpha = 0.85 * pulse;
        ctx.drawImage(o, t.x - 9, t.y - 22, 18, 18);
        ctx.globalAlpha = 1;
      }
      if (t.st.kind === 'lantern') {
        const pulse = 0.8 + 0.2 * Math.sin(this.time * 4 + t.id);
        ctx.globalAlpha = 0.5 * pulse;
        ctx.drawImage(orb('#ffd58a', 9), t.x - 16, t.y - 30, 32, 32);
        ctx.globalAlpha = 1;
      }
      // Upgrade pips: gold for path A, cyan-ish for path B.
      for (let i = 0; i < t.a; i++) { ctx.fillStyle = '#ffd34a'; ctx.beginPath(); ctx.arc(t.x - 12 + i * 4.5, t.y + 19, 1.9, 0, 6.283); ctx.fill(); }
      for (let i = 0; i < t.b; i++) { ctx.fillStyle = '#7ff0ff'; ctx.beginPath(); ctx.arc(t.x + 12 - i * 4.5, t.y + 19, 1.9, 0, 6.283); ctx.fill(); }
      if (t.buff > 0) {
        ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.time * 4 + t.id);
        ctx.strokeStyle = '#ffd58a'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(t.x, t.y, 19, 0, 6.283); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (state.selected === t.id) {
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(t.x, t.y, 22, 0, 6.283); ctx.stroke();
      }
    }

    // Enemies
    const wob = this.time;
    for (const e of side.enemies) {
      if (e.dead) continue;
      const visible = !(e.flags & CAMO) || e.revealT > 0 || side.index === 1;
      const def = e.def;
      const size = def.r * 2 + 18;
      const squash = 1 + 0.06 * Math.sin(wob * 9 + e.wob);
      const sp = blobSprite(e.tier, e.flags, K);
      const ps = size;
      ctx.globalAlpha = visible ? 1 : 0.28;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(1 / squash, squash);
      ctx.drawImage(sp, -ps / 2, -ps / 2, ps, ps);
      if (e.flashT > 0) {
        ctx.globalAlpha = Math.min(1, e.flashT * 9) * (visible ? 1 : 0.28);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, def.r, 0, 6.283); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (e.hp < e.maxHp && visible) {
        const w = def.r * 2;
        const f = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(e.x - w / 2, e.y - def.r - 9, w, 3.4);
        ctx.fillStyle = f > 0.5 ? '#6dff7a' : f > 0.25 ? '#ffd34a' : '#ff5a6a';
        ctx.fillRect(e.x - w / 2, e.y - def.r - 9, w * f, 3.4);
      }
      if (e.shred > 0) {
        ctx.fillStyle = '#9dff5a';
        for (let i = 0; i < e.shred; i++) { ctx.fillRect(e.x - 6 + i * 4, e.y + def.r + 3, 2.4, 2.4); }
      }
      if (e.slowT > 0 && e.slowMul < 1) {
        ctx.fillStyle = 'rgba(160,240,255,.7)';
        ctx.beginPath(); ctx.arc(e.x + def.r * 0.8, e.y - def.r * 0.8, 2.2, 0, 6.283); ctx.fill();
      }
      if (e.stunT > 0) {
        ctx.fillStyle = '#fff27a';
        ctx.beginPath(); ctx.arc(e.x, e.y - def.r - 12, 2.6, 0, 6.283); ctx.fill();
      }
    }

    // Projectiles
    for (const p of side.projs) {
      if (p.dead) continue;
      if (p.kind === 'arrow') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = '#f7e2a8'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9); ctx.lineTo(p.x, p.y); ctx.stroke();
      } else if (p.kind === 'sniper') {
        ctx.strokeStyle = 'rgba(200,240,255,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * 22, p.y - p.vy * 22); ctx.lineTo(p.x, p.y); ctx.stroke();
      } else if (p.kind === 'shell') {
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 4, 3.5, 2, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#2b2f38';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, 6.283); ctx.fill();
      } else {
        const col = p.kind === 'frost' ? '#9fefff' : '#9dff5a';
        const o = orb(col, 5);
        ctx.drawImage(o, p.x - 6, p.y - 6, 12, 12);
      }
    }

    // Lightning
    for (const b of this.fx.bolts) {
      const a = b.life / b.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffe85a'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath();
      b.pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Rings
    for (const r of this.fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = r.color; ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Particles
    for (const p of this.fx.parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.sq) ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * a), 0, 6.283); ctx.fill(); }
    }
    ctx.globalAlpha = 1;

    // Floating texts (screen-scaled font)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.fx.texts) {
      ctx.globalAlpha = Math.min(1, t.life / t.max * 1.6);
      ctx.font = `900 ${t.size}px Nunito, system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.s, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.s, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // Leak flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,40,70,${this.flash * 0.6})`;
      ctx.fillRect(-20, -20, WORLD_W + 40, WORLD_H + 40);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  rangeCircle(x, y, r, color) {
    const ctx = this.ctx;
    const K = this.scale * this.dpr;
    ctx.setTransform(K, 0, 0, K, this.ox * this.dpr, this.oy * this.dpr);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Mini view of the rival's board: track, towers as dots, enemies as dots.
  renderMini(match, side) {
    const ctx = this.ctx;
    this.ensureBg();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.bg) return;
    ctx.drawImage(this.bg.canvas, 0, 0);
    const K = this.scale * this.dpr;
    ctx.setTransform(K, 0, 0, K, this.ox * this.dpr, this.oy * this.dpr);
    for (const t of side.towers) {
      ctx.fillStyle = SKINS[side.skin] ? SKINS[side.skin].trim : '#ffd34a';
      ctx.fillRect(t.x - 9, t.y - 9, 18, 18);
    }
    for (const e of side.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = TIERS[e.tier].body;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.def.boss ? 22 : e.def.r * 0.9, 0, 6.283); ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

export { FAST, CAMO, REGEN, TOWER_BOX };
