// Indoor scene painter: a cozy room seen from the front — decorated back wall
// with furniture modules (bookcases, windows, shelves, fireplace…), a floor in
// perspective with a rug and a couple of furniture pieces, then warm lighting.
// Returns the placement zones where props can sit.

import * as K from './kit.js';

const { R, RI, pickR, rgba, shade, lin, rad, rrect, fillRR, ellipse, circle, poly } = K;

const BOOKS = ['#8e2b2b', '#2f5d8a', '#3f7a3a', '#c48a1c', '#5b3a7a', '#a5532a', '#1f4f4f', '#7a1f3d', '#d9c79e', '#34495e'];

// ---------------------------------------------------------------- walls
function wall(g, x, y, w, h, st, rnd) {
  const wl = st.wall;
  const c1 = wl.c1, c2 = wl.c2 || shade(c1, -0.08), acc = wl.accent || shade(c1, 0.15);
  switch (wl.type) {
    case 'paper':
      K.stripesV(g, x, y, w, h, 34, c1, c2);
      K.motif(g, x, y, w, h, 68, rgba(acc, 0.35), 'diamond');
      break;
    case 'damask':
      g.fillStyle = c1;
      g.fillRect(x, y, w, h);
      K.motif(g, x, y, w, h, 90, rgba(acc, 0.28), 'fleur');
      break;
    case 'wood':
      K.planks(g, x, y, w, h, 78, [c1, c2, shade(c1, 0.05)], rnd, true, 0.22);
      break;
    case 'brick':
      K.bricks(g, x, y, w, h, 86, 38, [c1, c2, shade(c1, -0.12), shade(c1, 0.08)], shade(c1, -0.45), rnd);
      break;
    case 'stone':
      K.bricks(g, x, y, w, h, 120, 64, [c1, c2, shade(c1, -0.1), shade(c1, 0.1)], shade(c1, -0.5), rnd, { round: 12, jitter: 0.12, offset: 0.37 });
      break;
    case 'tiles':
      K.bricks(g, x, y, w, h, 56, 56, [c1, shade(c1, 0.04), c2], shade(c1, -0.2), rnd, { round: 4, jitter: 0.03, offset: 0 });
      break;
    default: {
      g.fillStyle = c1;
      g.fillRect(x, y, w, h);
      g.save();
      g.globalAlpha = 0.12;
      for (let i = 0; i < 60; i++) {
        K.blob(g, x + rnd() * w, y + rnd() * h, R(rnd, 40, 140), R(rnd, 30, 100), rnd);
        g.fillStyle = rnd() < 0.5 ? shade(c1, 0.15) : shade(c1, -0.15);
        g.fill();
      }
      g.restore();
    }
  }
  // darker toward the ceiling
  g.fillStyle = lin(g, 0, y, 0, y + h, [[0, 'rgba(0,0,0,0.42)'], [0.35, 'rgba(0,0,0,0.08)'], [1, 'rgba(0,0,0,0.18)']]);
  g.fillRect(x, y, w, h);
}

function crownMolding(g, W, st) {
  const c = st.wood;
  g.fillStyle = lin(g, 0, 0, 0, 30, [shade(c, -0.3), shade(c, 0.1), shade(c, -0.2)]);
  g.fillRect(0, 0, W, 30);
  g.fillStyle = rgba('#000000', 0.3);
  g.fillRect(0, 30, W, 6);
}

function outsideView(g, x, y, w, h, kind, rnd) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const skies = {
    day: ['#6ec3f5', '#cdeeff'],
    night: ['#0b1238', '#33296b'],
    dusk: ['#f6a35c', '#7c4a9e'],
    sea: ['#7fd0ff', '#e2f5ff'],
  };
  const [s1, s2] = skies[kind] || skies.day;
  g.fillStyle = lin(g, 0, y, 0, y + h, [s1, s2]);
  g.fillRect(x, y, w, h);
  if (kind === 'night') {
    for (let i = 0; i < 40; i++) circle(g, x + rnd() * w, y + rnd() * h * 0.7, R(rnd, 0.6, 1.8), rgba('#ffffff', R(rnd, 0.4, 1)));
    const mx = x + w * R(rnd, 0.25, 0.75), my = y + h * 0.28;
    K.glow(g, mx, my, 60, '#cfd8ff', 0.5, 'screen');
    circle(g, mx, my, 18, '#f4f1d8');
    circle(g, mx + 7, my - 4, 15, s1);
  } else {
    const sx = x + w * R(rnd, 0.2, 0.8), sy = y + h * 0.3;
    K.glow(g, sx, sy, 80, kind === 'dusk' ? '#ffd27a' : '#fff6c8', 0.7, 'screen');
    for (let i = 0; i < 2; i++) K.cloud(g, x + rnd() * w, y + h * R(rnd, 0.15, 0.45), R(rnd, 50, 80), rnd, '#ffffff', '#dbe8f5', 0.85);
  }
  if (kind === 'sea') {
    g.fillStyle = lin(g, 0, y + h * 0.6, 0, y + h, ['#2a8fd0', '#155d9c']);
    g.fillRect(x, y + h * 0.6, w, h * 0.4);
    for (let i = 0; i < 14; i++) K.line(g, x + rnd() * w, y + h * R(rnd, 0.65, 0.98), x + rnd() * w * 0.2 + 10, y + h * R(rnd, 0.65, 0.98), rgba('#ffffff', 0.25), 1.5);
  } else {
    const hill = kind === 'night' ? '#1c2a4a' : kind === 'dusk' ? '#5a3a5a' : '#6aa86a';
    K.ridge(g, x, x + w, y + h * 0.72, h * 0.18, y + h, rnd, { step: 30 });
    g.fillStyle = shade(hill, 0.12);
    g.fill();
    K.ridge(g, x, x + w, y + h * 0.86, h * 0.14, y + h, rnd, { step: 22 });
    g.fillStyle = hill;
    g.fill();
    for (let i = 0; i < 5; i++) {
      const tx = x + rnd() * w, ty = y + h * R(rnd, 0.8, 0.95);
      circle(g, tx, ty - 14, R(rnd, 10, 16), shade(hill, -0.2));
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- modules
// Each module draws itself inside [x0, x1] and pushes zones / lights.

function bookcase(g, x0, x1, fy, rnd, st, out) {
  const top = st.top + R(rnd, -10, 30);
  const bx0 = x0 + 14, bx1 = x1 - 14, bw = bx1 - bx0, bottom = fy + 26;
  const wood = st.wood, dark = st.woodDark;
  g.fillStyle = rgba('#000000', 0.28);
  rrect(g, bx0 + 10, top + 14, bw, bottom - top, 6);
  g.fill();
  g.fillStyle = lin(g, bx0, 0, bx1, 0, [shade(wood, -0.18), wood, shade(wood, 0.1), wood, shade(wood, -0.22)]);
  g.fillRect(bx0, top, bw, bottom - top);
  fillRR(g, bx0 - 12, top - 20, bw + 24, 24, 4, lin(g, 0, top - 20, 0, top + 4, [shade(wood, 0.2), shade(wood, -0.15)]));
  const ix0 = bx0 + 16, ix1 = bx1 - 16, iy0 = top + 14, iy1 = bottom - 48;
  g.fillStyle = lin(g, 0, iy0, 0, iy1, [shade(dark, -0.25), dark]);
  g.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
  const n = K.clamp(Math.round((iy1 - iy0) / 150), 3, 5);
  const gap = (iy1 - iy0) / n;
  for (let k = 1; k <= n; k++) {
    const sy = iy0 + gap * k;
    K.softShadow(g, ix0, iy0 + gap * (k - 1), ix1 - ix0, 26, 0.45);
    // painted books on part of the shelf
    if (rnd() < 0.75) {
      const span = (ix1 - ix0) * R(rnd, 0.25, 0.55);
      let bx = rnd() < 0.5 ? ix0 + 4 : ix1 - span - 4;
      const end = bx + span;
      while (bx < end - 10) {
        const w = R(rnd, 9, 18), hb = (gap - 12) * R(rnd, 0.55, 0.86);
        const c = pickR(rnd, BOOKS);
        g.fillStyle = lin(g, bx, 0, bx + w, 0, [shade(c, -0.2), shade(c, 0.12), c, shade(c, -0.25)]);
        g.fillRect(bx, sy - 12 - hb, w, hb);
        g.fillStyle = rgba('#f2d48a', 0.55);
        g.fillRect(bx + 1, sy - 12 - hb + hb * 0.15, w - 2, 2);
        g.fillRect(bx + 1, sy - 12 - hb * 0.25, w - 2, 2);
        bx += w + R(rnd, 0, 2);
      }
    }
    g.fillStyle = lin(g, 0, sy - 12, 0, sy + 4, [shade(wood, 0.22), wood, shade(wood, -0.3)]);
    g.fillRect(ix0 - 4, sy - 12, ix1 - ix0 + 8, 16);
    K.softShadow(g, ix0, sy + 4, ix1 - ix0, 14, 0.35);
    out.zones.push({ t: 'shelf', x0: ix0 + 10, x1: ix1 - 10, y: sy - 12, maxS: Math.min(gap * 0.74, 78), depth: 4 });
  }
  g.fillStyle = lin(g, 0, iy1, 0, bottom, [shade(wood, 0.05), shade(wood, -0.25)]);
  g.fillRect(bx0, iy1 + 4, bw, bottom - iy1 - 4);
  g.fillStyle = rgba('#000000', 0.25);
  g.fillRect(bx0 + 10, iy1 + 16, bw - 20, 3);
}

function windowModule(g, x0, x1, fy, rnd, st, out) {
  const cx = (x0 + x1) / 2;
  const ww = Math.min(250, (x1 - x0) * 0.62);
  const wy = st.top + 50;
  const wh = Math.min(300, (fy - wy) * 0.5);
  const wx = cx - ww / 2;
  outsideView(g, wx, wy, ww, wh, st.outside, rnd);
  const fc = st.frame || '#efe6d2';
  g.fillStyle = fc;
  const t = 14;
  g.fillRect(wx - t, wy - t, ww + t * 2, t);
  g.fillRect(wx - t, wy + wh, ww + t * 2, t);
  g.fillRect(wx - t, wy - t, t, wh + t * 2);
  g.fillRect(wx + ww, wy - t, t, wh + t * 2);
  g.fillRect(cx - 5, wy, 10, wh);
  g.fillRect(wx, wy + wh * 0.45 - 5, ww, 10);
  g.strokeStyle = rgba('#ffffff', 0.18);
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(wx + 20, wy + wh * 0.4);
  g.lineTo(wx + ww * 0.4, wy + 10);
  g.moveTo(wx + ww * 0.55, wy + wh * 0.4);
  g.lineTo(wx + ww * 0.9, wy + 10);
  g.stroke();
  // sill
  fillRR(g, wx - 26, wy + wh + t - 4, ww + 52, 18, 3, lin(g, 0, wy + wh, 0, wy + wh + 30, [shade(fc, 0.1), shade(fc, -0.25)]));
  K.softShadow(g, wx - 20, wy + wh + t + 14, ww + 40, 16, 0.35);
  out.zones.push({ t: 'shelf', x0: wx - 14, x1: wx + ww + 14, y: wy + wh + t - 4, maxS: 54, depth: 3 });
  out.windows.push({ x: wx, y: wy, w: ww, h: wh });
  // curtains
  const cc = st.curtain || '#8c1c2c';
  const rodY = wy - t - 24;
  K.line(g, wx - 70, rodY, wx + ww + 70, rodY, '#c9a14a', 6);
  circle(g, wx - 72, rodY, 7, '#e3c06a');
  circle(g, wx + ww + 72, rodY, 7, '#e3c06a');
  for (const side of [-1, 1]) {
    const ox = side < 0 ? wx - 64 : wx + ww + 64;
    const inner = side < 0 ? wx + 22 : wx + ww - 22;
    const bottomY = wy + wh + 80;
    const tieY = wy + wh * 0.62;
    g.beginPath();
    g.moveTo(ox, rodY);
    g.lineTo(inner, rodY);
    g.quadraticCurveTo(inner - side * 6, tieY - 40, ox + side * -36, tieY);
    g.quadraticCurveTo(ox - side * -20, tieY + 60, ox - side * 6, bottomY);
    g.lineTo(ox + side * 10, bottomY);
    g.closePath();
    const xs = Math.min(ox, inner), xe = Math.max(ox, inner);
    const gr = g.createLinearGradient(xs, 0, xe, 0);
    for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? shade(cc, -0.28) : shade(cc, 0.12));
    g.fillStyle = gr;
    g.fill();
    fillRR(g, ox + side * -40, tieY - 6, 24, 12, 5, '#d9b44a');
  }
  // valance
  g.fillStyle = lin(g, 0, rodY - 6, 0, rodY + 34, [shade(cc, 0.15), shade(cc, -0.2)]);
  g.beginPath();
  g.moveTo(wx - 70, rodY - 6);
  g.lineTo(wx + ww + 70, rodY - 6);
  g.lineTo(wx + ww + 70, rodY + 26);
  const nS = 6;
  for (let i = nS; i >= 0; i--) {
    const px = wx - 70 + ((ww + 140) * i) / nS;
    g.quadraticCurveTo(px + (ww + 140) / nS / 2, rodY + 44, px, rodY + 26);
  }
  g.closePath();
  g.fill();
  // dresser under the window
  dresser(g, cx, Math.min(ww + 70, x1 - x0 - 24), fy - 150, fy + 24, rnd, st, out);
}

function dresser(g, cx, w, top, bottom, rnd, st, out) {
  const x = cx - w / 2;
  const wood = st.wood2 || st.wood;
  g.fillStyle = rgba('#000000', 0.25);
  g.fillRect(x + 8, top + 10, w, bottom - top);
  g.fillStyle = lin(g, x, 0, x + w, 0, [shade(wood, -0.15), shade(wood, 0.08), shade(wood, -0.2)]);
  g.fillRect(x, top, w, bottom - top - 14);
  fillRR(g, x - 8, top - 12, w + 16, 16, 3, lin(g, 0, top - 12, 0, top + 4, [shade(wood, 0.25), shade(wood, -0.1)]));
  const rows = 2;
  const dh = (bottom - top - 36) / rows;
  for (let r = 0; r < rows; r++) {
    const dy = top + 10 + r * dh;
    const cols = w > 220 ? 2 : 1;
    for (let c = 0; c < cols; c++) {
      const dw = (w - 24 - (cols - 1) * 8) / cols;
      const dx = x + 12 + c * (dw + 8);
      fillRR(g, dx, dy, dw, dh - 8, 4, lin(g, 0, dy, 0, dy + dh, [shade(wood, 0.1), shade(wood, -0.12)]));
      circle(g, dx + dw / 2, dy + (dh - 8) / 2, 4.5, '#e3c06a');
    }
  }
  g.fillStyle = shade(wood, -0.35);
  g.fillRect(x + 6, bottom - 14, 12, 14);
  g.fillRect(x + w - 18, bottom - 14, 12, 14);
  out.zones.push({ t: 'shelf', x0: x + 6, x1: x + w - 6, y: top - 12, maxS: 72, depth: 6 });
}

function shelvesModule(g, x0, x1, fy, rnd, st, out) {
  const n = 3;
  const span = fy - st.top - 120;
  for (let i = 0; i < n; i++) {
    const y = st.top + 90 + (span * (i + 0.4)) / n + R(rnd, -15, 15);
    const sx0 = x0 + R(rnd, 14, 40), sx1 = x1 - R(rnd, 14, 40);
    const wood = st.wood;
    K.softShadow(g, sx0, y + 12, sx1 - sx0, 22, 0.4);
    fillRR(g, sx0, y, sx1 - sx0, 14, 3, lin(g, 0, y, 0, y + 14, [shade(wood, 0.25), shade(wood, -0.2)]));
    for (const bx of [sx0 + 24, sx1 - 24]) poly(g, [bx - 4, y + 14, bx + 4, y + 14, bx + 4, y + 44, bx - 4, y + 22], shade(st.woodDark, 0.1));
    out.zones.push({ t: 'shelf', x0: sx0 + 8, x1: sx1 - 8, y, maxS: Math.min(span / n - 26, 70), depth: 3 });
  }
  // a low chest of drawers at the bottom
  if (rnd() < 0.6) dresser(g, (x0 + x1) / 2, Math.min(x1 - x0 - 30, 240), fy - 120, fy + 24, rnd, st, out);
}

function painting(g, x, y, w, h, rnd) {
  const kind = RI(rnd, 0, 3);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  if (kind === 0) {
    g.fillStyle = lin(g, 0, y, 0, y + h, ['#7fb6d9', '#f3dca8']);
    g.fillRect(x, y, w, h);
    circle(g, x + w * 0.7, y + h * 0.3, h * 0.12, '#ffe08a');
    K.ridge(g, x, x + w, y + h * 0.7, h * 0.25, y + h, rnd, { step: w / 6 });
    g.fillStyle = '#5f8a4e';
    g.fill();
    K.ridge(g, x, x + w, y + h * 0.85, h * 0.15, y + h, rnd, { step: w / 5 });
    g.fillStyle = '#3f6a3a';
    g.fill();
  } else if (kind === 1) {
    g.fillStyle = lin(g, 0, y, 0, y + h, ['#3a2a20', '#1b120c']);
    g.fillRect(x, y, w, h);
    ellipse(g, x + w / 2, y + h * 0.42, w * 0.16, h * 0.2, '#e0b48c');
    ellipse(g, x + w / 2, y + h * 0.95, w * 0.34, h * 0.32, '#5a2a3a');
    ellipse(g, x + w / 2, y + h * 0.3, w * 0.19, h * 0.12, '#3a2414');
  } else if (kind === 2) {
    g.fillStyle = lin(g, 0, y, 0, y + h, ['#2b3a4a', '#0f1820']);
    g.fillRect(x, y, w, h);
    ellipse(g, x + w * 0.5, y + h * 0.8, w * 0.35, h * 0.08, '#6a4a2a');
    for (let i = 0; i < 4; i++) circle(g, x + w * R(rnd, 0.3, 0.7), y + h * R(rnd, 0.5, 0.7), w * R(rnd, 0.07, 0.12), pickR(rnd, ['#c0392b', '#e67e22', '#f1c40f', '#27ae60']));
  } else {
    g.fillStyle = lin(g, 0, y, 0, y + h, ['#87c4e8', '#d7eef8']);
    g.fillRect(x, y, w, h);
    g.fillStyle = '#2b78b8';
    g.fillRect(x, y + h * 0.6, w, h * 0.4);
    poly(g, [x + w * 0.45, y + h * 0.58, x + w * 0.62, y + h * 0.58, x + w * 0.58, y + h * 0.66, x + w * 0.48, y + h * 0.66], '#6b3d1f');
    poly(g, [x + w * 0.53, y + h * 0.2, x + w * 0.53, y + h * 0.56, x + w * 0.38, y + h * 0.54], '#fffaf0');
  }
  g.restore();
}

function goldFrame(g, x, y, w, h, t = 14) {
  g.fillStyle = rgba('#000000', 0.3);
  g.fillRect(x - t + 8, y - t + 10, w + t * 2, h + t * 2);
  g.fillStyle = lin(g, x - t, y - t, x + w + t, y + h + t, ['#f2d27a', '#a87a24', '#e8c463', '#7a5418']);
  g.fillRect(x - t, y - t, w + t * 2, h + t * 2);
  g.strokeStyle = rgba('#5a3a0a', 0.6);
  g.lineWidth = 2;
  g.strokeRect(x - t + 4, y - t + 4, w + t * 2 - 8, h + t * 2 - 8);
  g.strokeRect(x - 2, y - 2, w + 4, h + 4);
}

function wallClock(g, cx, cy, r) {
  g.fillStyle = rgba('#000000', 0.3);
  circle(g, cx + 6, cy + 8, r + 8);
  g.fill();
  circle(g, cx, cy, r + 8, lin(g, cx - r, cy - r, cx + r, cy + r, ['#9a6a34', '#4a2a10']));
  circle(g, cx, cy, r, rad(g, cx - r * 0.3, cy - r * 0.3, 2, r, ['#fffaf0', '#e6dcc4']));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * K.TAU;
    K.line(g, cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, '#3a2a1a', i % 3 ? 2 : 4);
  }
  K.line(g, cx, cy, cx + r * 0.45, cy - r * 0.3, '#2a1a0a', 4);
  K.line(g, cx, cy, cx - r * 0.1, cy - r * 0.7, '#2a1a0a', 3);
  circle(g, cx, cy, 4, '#c9a14a');
}

function framesModule(g, x0, x1, fy, rnd, st, out) {
  const w = x1 - x0;
  const pw = w * R(rnd, 0.5, 0.64), ph = pw * R(rnd, 0.7, 0.85);
  const px = x0 + (w - pw) / 2 + R(rnd, -20, 20), py = st.top + 70;
  goldFrame(g, px, py, pw, ph);
  painting(g, px, py, pw, ph, rnd);
  const below = py + ph + 30;
  if (rnd() < 0.6) wallClock(g, x0 + w * (rnd() < 0.5 ? 0.2 : 0.8), below + 70, 38);
  else {
    const sw = pw * 0.35, sh = sw * 1.25, sx = x0 + w * (rnd() < 0.5 ? 0.12 : 0.88) - sw / 2;
    goldFrame(g, sx, below + 20, sw, sh, 8);
    painting(g, sx, below + 20, sw, sh, rnd);
  }
  dresser(g, (x0 + x1) / 2, Math.min(w - 30, 300), fy - 150, fy + 24, rnd, st, out);
}

function fireplace(g, x0, x1, fy, rnd, st, out) {
  const cx = (x0 + x1) / 2;
  const fw = Math.min(x1 - x0 - 30, 340);
  const fx = cx - fw / 2, top = fy - 300;
  K.bricks(g, fx, top, fw, fy + 24 - top, 70, 34, ['#9a5a40', '#8a4a34', '#a8664a'], '#4a2a20', rnd);
  g.fillStyle = lin(g, fx, 0, fx + fw, 0, ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)']);
  g.fillRect(fx, top, fw, fy + 24 - top);
  const ox = fx + 54, ow = fw - 108, oy = top + 80, ob = fy + 14;
  g.beginPath();
  g.moveTo(ox, ob);
  g.lineTo(ox, oy + 40);
  g.quadraticCurveTo(ox + ow / 2, oy - 30, ox + ow, oy + 40);
  g.lineTo(ox + ow, ob);
  g.closePath();
  g.fillStyle = lin(g, 0, oy, 0, ob, ['#120a06', '#2a1408']);
  g.fill();
  // logs and fire
  for (let i = 0; i < 3; i++) fillRR(g, ox + 20 + i * (ow - 60) / 3, ob - 26 - (i % 2) * 14, (ow - 40) / 2.2, 18, 9, '#5a3418');
  const flames = ['#ff5a1a', '#ff8a2a', '#ffc040', '#fff0a0'];
  flames.forEach((c, i) => {
    for (let k = 0; k < 4 - i; k++) {
      const fxp = ox + ow * (0.25 + 0.5 * rnd()), fh = (ob - oy) * (0.55 - i * 0.1) * R(rnd, 0.7, 1);
      g.beginPath();
      g.moveTo(fxp - 26 + i * 5, ob - 20);
      g.quadraticCurveTo(fxp - 28, ob - 20 - fh * 0.6, fxp + R(rnd, -8, 8), ob - 20 - fh);
      g.quadraticCurveTo(fxp + 28, ob - 20 - fh * 0.6, fxp + 26 - i * 5, ob - 20);
      g.closePath();
      g.fillStyle = c;
      g.fill();
    }
  });
  out.lights.push({ x: cx, y: ob - 60, r: 420, color: '#ff8a30', a: 0.42 });
  // mantel
  fillRR(g, fx - 26, top - 26, fw + 52, 28, 4, lin(g, 0, top - 26, 0, top + 2, [shade(st.wood, 0.25), shade(st.wood, -0.2)]));
  K.softShadow(g, fx - 10, top + 2, fw + 20, 20, 0.45);
  out.zones.push({ t: 'shelf', x0: fx - 14, x1: fx + fw + 14, y: top - 26, maxS: 72, depth: 5 });
  // mirror above
  const mw = fw * 0.6, mh = Math.min(top - st.top - 80, 220);
  if (mh > 80) {
    const my = top - 50 - mh;
    g.save();
    g.beginPath();
    g.ellipse(cx, my + mh / 2, mw / 2 + 12, mh / 2 + 12, 0, 0, K.TAU);
    g.fillStyle = lin(g, cx - mw, 0, cx + mw, 0, ['#f2d27a', '#8a6420', '#e8c463']);
    g.fill();
    g.beginPath();
    g.ellipse(cx, my + mh / 2, mw / 2, mh / 2, 0, 0, K.TAU);
    g.fillStyle = lin(g, cx - mw / 2, my, cx + mw / 2, my + mh, ['#b9d4de', '#5d7f8c', '#a9c6d2']);
    g.fill();
    g.restore();
  }
  // hearth
  fillRR(g, fx - 30, fy + 18, fw + 60, 22, 4, '#6a5a50');
}

function counter(g, x0, x1, fy, rnd, st, out) {
  const wood = st.wood2 || st.wood;
  const top = st.top + 20;
  const ct = fy - 210;
  // upper cabinets
  const uh = 190;
  const n = Math.max(1, Math.round((x1 - x0) / 140));
  const dw = (x1 - x0 - 20) / n;
  for (let i = 0; i < n; i++) {
    const dx = x0 + 10 + i * dw;
    fillRR(g, dx + 3, top, dw - 6, uh, 6, lin(g, dx, 0, dx + dw, 0, [shade(wood, 0.1), wood, shade(wood, -0.15)]));
    fillRR(g, dx + 14, top + 12, dw - 28, uh - 24, 4, rgba('#000000', 0.12));
    fillRR(g, dx + dw / 2 - 3, top + uh - 50, 6, 30, 3, '#d4c08a');
  }
  K.softShadow(g, x0 + 10, top + uh, x1 - x0 - 20, 30, 0.4);
  // open shelf between
  const sy = top + uh + 120;
  if (sy < ct - 90) {
    fillRR(g, x0 + 16, sy, x1 - x0 - 32, 12, 3, shade(wood, 0.15));
    K.softShadow(g, x0 + 16, sy + 12, x1 - x0 - 32, 14, 0.35);
    out.zones.push({ t: 'shelf', x0: x0 + 24, x1: x1 - 24, y: sy, maxS: 62, depth: 3 });
  }
  // counter top + lower cabinets
  g.fillStyle = lin(g, 0, ct + 18, 0, fy + 24, [shade(wood, -0.05), shade(wood, -0.3)]);
  g.fillRect(x0 + 6, ct + 18, x1 - x0 - 12, fy + 24 - ct - 18);
  for (let i = 0; i < n; i++) {
    const dx = x0 + 10 + i * dw;
    fillRR(g, dx + 6, ct + 34, dw - 12, fy - ct - 30, 5, lin(g, 0, ct, 0, fy, [shade(wood, 0.08), shade(wood, -0.12)]));
    fillRR(g, dx + dw / 2 - 16, ct + 50, 32, 6, 3, '#d4c08a');
  }
  const slab = st.slab || '#e9e2d6';
  fillRR(g, x0, ct, x1 - x0, 20, 4, lin(g, 0, ct, 0, ct + 20, [shade(slab, 0.1), shade(slab, -0.18)]));
  out.zones.push({ t: 'shelf', x0: x0 + 10, x1: x1 - 10, y: ct + 2, maxS: 80, depth: 8 });
}

function display(g, x0, x1, fy, rnd, st, out) {
  const wood = st.wood;
  const cx0 = x0 + 18, cx1 = x1 - 18, top = st.top + 50, base = fy - 110;
  g.fillStyle = rgba('#000000', 0.3);
  g.fillRect(cx0 + 10, top + 12, cx1 - cx0, fy + 24 - top);
  g.fillStyle = lin(g, 0, top, 0, base, [shade(st.velvet || '#5a1a2a', -0.3), st.velvet || '#5a1a2a']);
  g.fillRect(cx0, top, cx1 - cx0, base - top);
  const n = 3;
  const gap = (base - top) / n;
  for (let k = 1; k <= n; k++) {
    const y = top + gap * k;
    if (k < n) {
      g.fillStyle = rgba('#e8f6ff', 0.5);
      g.fillRect(cx0 + 8, y - 6, cx1 - cx0 - 16, 6);
    }
    out.zones.push({ t: 'shelf', x0: cx0 + 16, x1: cx1 - 16, y: y - 6, maxS: Math.min(gap * 0.72, 74), depth: 3 });
    out.lights.push({ x: (cx0 + cx1) / 2, y: y - gap + 10, r: 140, color: '#fff2c8', a: 0.18 });
  }
  g.strokeStyle = lin(g, cx0, 0, cx1, 0, ['#d9b04c', '#8a6420', '#d9b04c']);
  g.lineWidth = 10;
  g.strokeRect(cx0, top, cx1 - cx0, base - top);
  g.strokeStyle = rgba('#ffffff', 0.16);
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(cx0 + 20, base - 20);
  g.lineTo(cx0 + (cx1 - cx0) * 0.4, top + 20);
  g.stroke();
  g.fillStyle = lin(g, 0, base, 0, fy + 24, [shade(wood, 0.1), shade(wood, -0.25)]);
  g.fillRect(cx0 - 8, base, cx1 - cx0 + 16, fy + 24 - base);
  fillRR(g, (cx0 + cx1) / 2 - 40, base + 30, 80, 24, 3, lin(g, 0, base + 30, 0, base + 54, ['#f2d27a', '#a87a24']));
}

function pegboard(g, x0, x1, fy, rnd, st, out) {
  const bx = x0 + 18, bw = x1 - x0 - 36, by = st.top + 60, bh = fy - 260 - by;
  g.fillStyle = rgba('#000000', 0.25);
  g.fillRect(bx + 8, by + 10, bw, bh);
  g.fillStyle = lin(g, 0, by, 0, by + bh, ['#d4ad74', '#b88c55']);
  g.fillRect(bx, by, bw, bh);
  for (let y = by + 16; y < by + bh - 8; y += 26) for (let x = bx + 16; x < bx + bw - 8; x += 26) circle(g, x, y, 3, '#7a5a34');
  g.strokeStyle = '#8a6a44';
  g.lineWidth = 8;
  g.strokeRect(bx, by, bw, bh);
  // tool silhouettes
  g.fillStyle = rgba('#3a2a1a', 0.22);
  for (let i = 0; i < 4; i++) {
    const tx = bx + 40 + (i * (bw - 80)) / 3, ty = by + R(rnd, 30, bh - 120);
    fillRR(g, tx - 5, ty, 10, 90, 4, rgba('#3a2a1a', 0.22));
    fillRR(g, tx - 20, ty, 40, 18, 6, rgba('#3a2a1a', 0.22));
  }
  // workbench
  const top = fy - 170;
  const wood = st.wood2 || st.wood;
  fillRR(g, x0 + 6, top, x1 - x0 - 12, 26, 4, lin(g, 0, top, 0, top + 26, [shade(wood, 0.25), shade(wood, -0.15)]));
  for (const lx of [x0 + 20, x1 - 40]) {
    g.fillStyle = shade(wood, -0.3);
    g.fillRect(lx, top + 26, 20, fy + 24 - top - 26);
  }
  fillRR(g, x0 + 20, fy - 50, x1 - x0 - 40, 14, 3, shade(wood, -0.05));
  out.zones.push({ t: 'shelf', x0: x0 + 14, x1: x1 - 14, y: top, maxS: 80, depth: 8 });
}

function wardrobe(g, x0, x1, fy, rnd, st, out) {
  const wood = st.wood2 || st.wood;
  const wx = x0 + 16, ww = x1 - x0 - 32, top = st.top + 70;
  g.fillStyle = rgba('#000000', 0.3);
  g.fillRect(wx + 10, top + 12, ww, fy + 24 - top);
  g.fillStyle = lin(g, wx, 0, wx + ww, 0, [shade(wood, -0.15), shade(wood, 0.1), shade(wood, -0.2)]);
  g.fillRect(wx, top, ww, fy + 24 - top);
  fillRR(g, wx - 12, top - 20, ww + 24, 24, 4, shade(wood, 0.2));
  const dw = (ww - 30) / 2;
  for (let i = 0; i < 2; i++) {
    const dx = wx + 10 + i * (dw + 10);
    fillRR(g, dx, top + 14, dw, fy - top - 40, 6, lin(g, dx, 0, dx + dw, 0, [shade(wood, 0.12), shade(wood, -0.1)]));
    if (i === 1) {
      fillRR(g, dx + 18, top + 40, dw - 36, fy - top - 110, 30, lin(g, dx, top, dx + dw, fy, ['#c6dde6', '#6f8f9c', '#b2cbd6']));
      g.strokeStyle = rgba('#ffffff', 0.35);
      g.lineWidth = 6;
      K.line(g, dx + 30, top + 140, dx + dw - 40, top + 60, rgba('#ffffff', 0.3), 6);
    } else fillRR(g, dx + 16, top + 34, dw - 32, fy - top - 90, 6, rgba('#000000', 0.1));
    fillRR(g, dx + (i ? 8 : dw - 14), top + (fy - top) / 2 - 20, 6, 40, 3, '#e3c06a');
  }
  out.zones.push({ t: 'shelf', x0: wx, x1: wx + ww, y: top - 20, maxS: 66, depth: 3 });
}

function archWindow(g, x0, x1, fy, rnd, st, out) {
  const cx = (x0 + x1) / 2, ww = Math.min(220, (x1 - x0) * 0.6), wy = st.top + 40, wh = Math.min(420, fy - wy - 220);
  const x = cx - ww / 2;
  const arch = () => {
    g.beginPath();
    g.moveTo(x, wy + wh);
    g.lineTo(x, wy + ww / 2);
    g.arc(cx, wy + ww / 2, ww / 2, Math.PI, 0);
    g.lineTo(x + ww, wy + wh);
    g.closePath();
  };
  g.save();
  arch();
  g.clip();
  const colors = st.glass || ['#2b4fa8', '#7a2a9a', '#2a8a7a', '#c99a2a', '#a82a3a'];
  const cs = 34;
  for (let yy = wy; yy < wy + wh; yy += cs) for (let xx = x; xx < x + ww; xx += cs) {
    g.fillStyle = pickR(rnd, colors);
    g.fillRect(xx, yy, cs, cs);
  }
  g.strokeStyle = '#1a1410';
  g.lineWidth = 3;
  for (let yy = wy; yy < wy + wh; yy += cs) K.line(g, x, yy, x + ww, yy, '#1a1410', 3);
  for (let xx = x; xx < x + ww; xx += cs) K.line(g, xx, wy, xx, wy + wh, '#1a1410', 3);
  g.fillStyle = rgba('#ffffff', 0.12);
  g.fillRect(x, wy, ww, wh);
  g.restore();
  arch();
  g.strokeStyle = shade(st.wall.c1, -0.4);
  g.lineWidth = 16;
  g.stroke();
  out.lights.push({ x: cx, y: wy + wh * 0.5, r: 300, color: '#b8a8ff', a: 0.22 });
  fillRR(g, x - 26, wy + wh, ww + 52, 20, 3, shade(st.wall.c1, -0.25));
  out.zones.push({ t: 'shelf', x0: x - 14, x1: x + ww + 14, y: wy + wh, maxS: 56, depth: 3 });
  dresser(g, cx, Math.min(x1 - x0 - 30, ww + 80), fy - 140, fy + 24, rnd, st, out);
}

function portholes(g, x0, x1, fy, rnd, st, out) {
  const n = (x1 - x0) > 260 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / n, cy = st.top + 150, r = 62;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, K.TAU);
    g.clip();
    outsideView(g, cx - r, cy - r, r * 2, r * 2, 'sea', rnd);
    g.restore();
    g.lineWidth = 18;
    g.strokeStyle = lin(g, cx - r, cy - r, cx + r, cy + r, ['#f2d27a', '#8a6420', '#e8c463']);
    g.beginPath();
    g.arc(cx, cy, r + 6, 0, K.TAU);
    g.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * K.TAU;
      circle(g, cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6), 3.5, '#5a4010');
    }
    out.windows.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
  }
  shelvesModule(g, x0, x1, fy, rnd, { ...st, top: st.top + 230 }, out);
}

function piano(g, x0, x1, fy, rnd, st, out) {
  const pw = Math.min(x1 - x0 - 30, 340), px = (x0 + x1) / 2 - pw / 2, top = fy - 300;
  const c = st.pianoColor || '#231612';
  g.fillStyle = rgba('#000000', 0.35);
  g.fillRect(px + 10, top + 12, pw, fy + 24 - top);
  g.fillStyle = lin(g, px, 0, px + pw, 0, [shade(c, 0.05), shade(c, 0.25), shade(c, 0)]);
  g.fillRect(px, top, pw, fy + 24 - top);
  fillRR(g, px - 10, top - 16, pw + 20, 20, 4, shade(c, 0.3));
  const ky = fy - 140;
  g.fillStyle = shade(c, 0.2);
  g.fillRect(px - 16, ky - 8, pw + 32, 14);
  g.fillStyle = '#f6f1e6';
  g.fillRect(px - 10, ky + 6, pw + 20, 34);
  for (let k = px - 10; k < px + pw + 10; k += 14) K.line(g, k, ky + 6, k, ky + 40, '#9a9080', 1.5);
  for (let k = px - 3, i = 0; k < px + pw + 6; k += 14, i++) if (i % 7 !== 2 && i % 7 !== 6) g.fillStyle = '#111', g.fillRect(k, ky + 6, 8, 20);
  fillRR(g, px + pw * 0.25, top + 40, pw * 0.5, 70, 4, rgba('#f2e2c0', 0.25));
  out.zones.push({ t: 'shelf', x0: px, x1: px + pw, y: top - 16, maxS: 70, depth: 4 });
  out.lights.push({ x: px + pw / 2, y: top - 40, r: 200, color: '#ffd28a', a: 0.2 });
}

function cubbies(g, x0, x1, fy, rnd, st, out) {
  const cx0 = x0 + 14, cx1 = x1 - 14, top = st.top + 60, bottom = fy + 24;
  const cols = (cx1 - cx0) > 260 ? 3 : 2;
  const rows = 4;
  const frame = st.frame || '#f4efe6';
  g.fillStyle = rgba('#000000', 0.28);
  g.fillRect(cx0 + 10, top + 12, cx1 - cx0, bottom - top);
  g.fillStyle = frame;
  g.fillRect(cx0, top, cx1 - cx0, bottom - top);
  const cw = (cx1 - cx0 - 14) / cols, chh = (bottom - top - 40) / rows;
  const pastel = st.pastel || ['#ffb3c6', '#a0d8ef', '#b9f3c5', '#ffe39f', '#d7b9ff', '#ffc9a3'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx0 + 7 + c * cw + 5, y = top + 7 + r * chh + 5;
      g.fillStyle = lin(g, 0, y, 0, y + chh - 10, [shade(pickR(rnd, pastel), -0.25), pickR(rnd, pastel)]);
      g.fillRect(x, y, cw - 10, chh - 10);
      K.softShadow(g, x, y, cw - 10, 20, 0.3);
    }
    out.zones.push({ t: 'shelf', x0: cx0 + 16, x1: cx1 - 16, y: top + 7 + (r + 1) * chh - 5, maxS: Math.min(chh * 0.72, 74), depth: 3 });
  }
}

const MODULES = { bookcase, window: windowModule, shelves: shelvesModule, frames: framesModule, fireplace, counter, display, pegboard, wardrobe, arch: archWindow, portholes, piano, cubbies };

// ---------------------------------------------------------------- floor
function floor(g, W, H, fy, rnd, st) {
  const f = st.floor;
  const vx = W / 2, vy = fy - (H - fy) * 2.2;
  g.save();
  g.beginPath();
  g.rect(0, fy, W, H - fy);
  g.clip();
  if (f.type === 'tiles' || f.type === 'checker') {
    g.fillStyle = f.c1;
    g.fillRect(0, fy, W, H - fy);
    const rows = 9;
    const ys = [];
    for (let i = 0; i <= rows; i++) ys.push(fy + (H - fy) * Math.pow(i / rows, 1.35));
    const cols = 14;
    for (let r = 0; r < rows; r++) {
      for (let c = -4; c < cols + 4; c++) {
        if ((r + c) % 2) continue;
        const bx0 = (c / cols) * W, bx1 = ((c + 1) / cols) * W;
        const t0 = (ys[r] - vy) / (H - vy), t1 = (ys[r + 1] - vy) / (H - vy);
        const px = (bx, t) => vx + (bx - vx) * t;
        poly(g, [px(bx0, t0), ys[r], px(bx1, t0), ys[r], px(bx1, t1), ys[r + 1], px(bx0, t1), ys[r + 1]], f.c2);
      }
    }
  } else if (f.type === 'stone') {
    g.fillStyle = f.c1;
    g.fillRect(0, fy, W, H - fy);
    let y = fy;
    let row = 0;
    while (y < H) {
      const hgt = 26 + ((y - fy) / (H - fy)) * 70;
      let x = -R(rnd, 0, 80);
      while (x < W) {
        const w = R(rnd, 0.8, 1.6) * hgt * 1.6;
        fillRR(g, x + 3, y + 3, w - 6, hgt - 6, 8, K.vary(rnd, rnd() < 0.5 ? f.c1 : f.c2, 0.08));
        x += w;
      }
      y += hgt;
      row++;
    }
  } else if (f.type === 'carpet') {
    g.fillStyle = lin(g, 0, fy, 0, H, [shade(f.c1, -0.15), f.c1]);
    g.fillRect(0, fy, W, H - fy);
    K.speckle(g, 0, fy, W, H - fy, 900, [shade(f.c1, 0.08), shade(f.c1, -0.08)], 1, 3, rnd, 0.5);
  } else {
    // planks converging to the vanishing point
    g.fillStyle = f.c1;
    g.fillRect(0, fy, W, H - fy);
    const n = 13;
    for (let i = -6; i < n + 6; i++) {
      const bx0 = (i / n) * W, bx1 = ((i + 1) / n) * W;
      const tt = (fy - vy) / (H - vy);
      const p = (bx, t) => vx + (bx - vx) * t;
      const c = K.vary(rnd, i % 2 ? f.c1 : f.c2, 0.06);
      poly(g, [p(bx0, tt), fy, p(bx1, tt), fy, bx1, H, bx0, H], c);
      K.line(g, p(bx0, tt), fy, bx0, H, rgba(shade(f.c1, -0.5), 0.5), 2);
      // staggered joints
      for (let k = 0; k < 3; k++) {
        const jy = fy + (H - fy) * R(rnd, 0.05, 0.95);
        const jt = (jy - vy) / (H - vy);
        K.line(g, p(bx0, jt), jy, p(bx1, jt), jy, rgba(shade(f.c1, -0.5), 0.45), 2);
      }
    }
  }
  // shading: darker far away, light pool in the middle
  g.fillStyle = lin(g, 0, fy, 0, H, [[0, 'rgba(0,0,0,0.45)'], [0.3, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0.25)']]);
  g.fillRect(0, fy, W, H - fy);
  g.restore();
  // baseboard
  g.fillStyle = lin(g, 0, fy - 4, 0, fy + 20, [shade(st.woodDark, 0.25), shade(st.woodDark, -0.2)]);
  g.fillRect(0, fy - 4, W, 22);
  K.softShadow(g, 0, fy + 18, W, 30, 0.4);
}

function rug(g, W, H, fy, rnd, st) {
  const cols = st.rug;
  if (!cols) return;
  const cx = W * R(rnd, 0.35, 0.65), cy = fy + (H - fy) * R(rnd, 0.45, 0.62);
  const rx = W * R(rnd, 0.32, 0.42), ry = (H - fy) * R(rnd, 0.16, 0.22);
  if (rnd() < 0.5) {
    g.fillStyle = rgba('#000000', 0.25);
    ellipse(g, cx + 6, cy + 10, rx, ry);
    g.fill();
    for (let i = 0; i < 6; i++) ellipse(g, cx, cy, rx * (1 - i * 0.14), ry * (1 - i * 0.14), cols[i % cols.length]);
    g.save();
    g.globalAlpha = 0.25;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * K.TAU;
      circle(g, cx + Math.cos(a) * rx * 0.78, cy + Math.sin(a) * ry * 0.78, 6, '#ffffff');
    }
    g.restore();
  } else {
    const top = cy - ry, bot = cy + ry;
    const k = 0.82;
    const pts = [cx - rx * k, top, cx + rx * k, top, cx + rx, bot, cx - rx, bot];
    g.fillStyle = rgba('#000000', 0.25);
    poly(g, pts.map((v, i) => v + (i % 2 ? 10 : 6)));
    g.fill();
    poly(g, pts, cols[0]);
    const inset = (t) => [cx - rx * k * t, top + ry * (1 - t), cx + rx * k * t, top + ry * (1 - t), cx + rx * t, bot - ry * (1 - t), cx - rx * t, bot - ry * (1 - t)];
    poly(g, inset(0.86), cols[1]);
    poly(g, inset(0.7), cols[2] || cols[0]);
    poly(g, inset(0.4), cols[1]);
    g.fillStyle = cols[1];
    for (let x = cx - rx; x < cx + rx; x += 9) g.fillRect(x, bot, 3, 12);
  }
}

// ---------------------------------------------------------------- furniture on the floor
function furniturePiece(type, g, cx, by, rnd, st, out) {
  const wood = st.wood2 || st.wood;
  const shadowE = (w) => {
    g.fillStyle = rad(g, cx, by, 0, w * 0.6, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
    ellipse(g, cx, by, w * 0.6, 22);
    g.fill();
  };
  if (type === 'table') {
    const rx = R(rnd, 115, 160), top = by - 150;
    shadowE(rx * 2);
    g.fillStyle = shade(wood, -0.3);
    g.fillRect(cx - 12, top, 24, by - top - 6);
    ellipse(g, cx, by - 6, 60, 10, shade(wood, -0.35));
    if (st.cloth) {
      g.beginPath();
      g.moveTo(cx - rx, top);
      g.lineTo(cx + rx, top);
      g.lineTo(cx + rx * 1.02, top + 70);
      for (let i = 10; i >= 0; i--) g.quadraticCurveTo(cx - rx + (i + 0.5) * (rx * 0.2), top + 84, cx - rx * 1.02 + i * rx * 0.2, top + 70);
      g.closePath();
      g.fillStyle = lin(g, cx - rx, 0, cx + rx, 0, [shade(st.cloth, -0.2), st.cloth, shade(st.cloth, -0.25)]);
      g.fill();
    }
    ellipse(g, cx, top, rx, 26, lin(g, 0, top - 26, 0, top + 26, [shade(st.cloth || wood, 0.18), shade(st.cloth || wood, -0.12)]));
    out.zones.push({ t: 'shelf', x0: cx - rx * 0.82, x1: cx + rx * 0.82, y: top - 6, maxS: 72, depth: 18 });
    out.holes.push({ x0: cx - rx, x1: cx + rx, y0: top - 30, y1: by + 4 });
  } else if (type === 'desk') {
    const w = R(rnd, 240, 300), top = by - 160, x = cx - w / 2;
    shadowE(w);
    g.fillStyle = shade(wood, -0.2);
    g.fillRect(x + 10, top + 20, w - 20, 26);
    g.fillRect(x + 10, top + 20, 18, by - top - 20);
    fillRR(g, x + w * 0.55, top + 20, w * 0.42, by - top - 20, 4, lin(g, 0, top, 0, by, [shade(wood, 0.05), shade(wood, -0.2)]));
    for (let i = 0; i < 3; i++) {
      const dy = top + 30 + i * ((by - top - 40) / 3);
      fillRR(g, x + w * 0.58, dy, w * 0.36, (by - top - 50) / 3, 3, shade(wood, 0.08));
      circle(g, x + w * 0.76, dy + (by - top - 50) / 6, 4, '#e3c06a');
    }
    fillRR(g, x - 8, top, w + 16, 22, 4, lin(g, 0, top, 0, top + 22, [shade(wood, 0.3), shade(wood, -0.1)]));
    out.zones.push({ t: 'shelf', x0: x, x1: x + w, y: top, maxS: 74, depth: 10 });
    out.holes.push({ x0: x - 10, x1: x + w + 10, y0: top - 20, y1: by + 4 });
  } else if (type === 'chest') {
    const w = R(rnd, 170, 210), h = 120, x = cx - w / 2, top = by - h;
    shadowE(w);
    fillRR(g, x, top, w, h, 10, lin(g, 0, top, 0, by, [shade(wood, 0.1), shade(wood, -0.3)]));
    fillRR(g, x - 6, top - 10, w + 12, 40, 14, lin(g, 0, top - 10, 0, top + 30, [shade(wood, 0.3), shade(wood, -0.05)]));
    for (const bx of [x + 24, x + w - 36]) fillRR(g, bx, top - 10, 12, h + 10, 3, '#b8933a');
    fillRR(g, cx - 14, top + 22, 28, 30, 4, '#d9b04c');
    out.zones.push({ t: 'shelf', x0: x + 4, x1: x + w - 4, y: top - 10, maxS: 70, depth: 8 });
    out.holes.push({ x0: x - 8, x1: x + w + 8, y0: top - 20, y1: by + 4 });
  } else if (type === 'armchair' || type === 'sofa') {
    const w = type === 'sofa' ? R(rnd, 320, 380) : R(rnd, 190, 220), x = cx - w / 2;
    const seat = by - 95, back = by - 240;
    const c = st.upholstery || '#7a2a2a';
    shadowE(w);
    fillRR(g, x + 16, back, w - 32, seat - back + 30, 30, lin(g, 0, back, 0, seat, [shade(c, 0.12), shade(c, -0.15)]));
    fillRR(g, x + 20, seat - 10, w - 40, 50, 16, lin(g, 0, seat - 10, 0, seat + 40, [shade(c, 0.2), shade(c, -0.1)]));
    for (const ax of [x, x + w - 46]) fillRR(g, ax, seat - 40, 46, by - seat + 20, 18, lin(g, ax, 0, ax + 46, 0, [shade(c, 0.1), shade(c, -0.25)]));
    g.fillStyle = shade(wood, -0.3);
    g.fillRect(x + 20, by - 22, 14, 22);
    g.fillRect(x + w - 34, by - 22, 14, 22);
    out.zones.push({ t: 'shelf', x0: x + 50, x1: x + w - 50, y: seat + 4, maxS: 64, depth: 10 });
    out.holes.push({ x0: x, x1: x + w, y0: back, y1: by + 4 });
  } else if (type === 'crates') {
    const s = R(rnd, 110, 130);
    let top = by;
    const n = RI(rnd, 1, 2);
    for (let i = 0; i < n; i++) {
      const x = cx - s / 2 + (i ? R(rnd, -20, 20) : 0);
      top -= s;
      if (i === 0) shadowE(s * 1.4);
      fillRR(g, x, top, s, s, 4, lin(g, 0, top, 0, top + s, [shade(st.crate || '#b8864e', 0.1), shade(st.crate || '#b8864e', -0.2)]));
      for (let k = 1; k < 4; k++) K.line(g, x, top + (s * k) / 4, x + s, top + (s * k) / 4, rgba('#3a2410', 0.5), 2);
      g.strokeStyle = rgba('#3a2410', 0.55);
      g.lineWidth = 6;
      g.strokeRect(x + 3, top + 3, s - 6, s - 6);
      out.zones.push({ t: 'shelf', x0: x + 6, x1: x + s - 6, y: top, maxS: 66, depth: 6 });
    }
    out.holes.push({ x0: cx - s, x1: cx + s, y0: top - 10, y1: by + 4 });
  } else if (type === 'barrel') {
    const w = R(rnd, 100, 120), h = 150, x = cx - w / 2, top = by - h;
    shadowE(w * 1.3);
    g.beginPath();
    g.moveTo(x + 8, top);
    g.quadraticCurveTo(x - 10, top + h / 2, x + 8, by);
    g.lineTo(x + w - 8, by);
    g.quadraticCurveTo(x + w + 10, top + h / 2, x + w - 8, top);
    g.closePath();
    g.fillStyle = lin(g, x, 0, x + w, 0, [shade(wood, -0.3), shade(wood, 0.15), shade(wood, -0.3)]);
    g.fill();
    for (const hy of [top + 18, by - 22]) fillRR(g, x - 2, hy, w + 4, 10, 3, '#4a4a4a');
    ellipse(g, cx, top, w / 2 - 8, 12, shade(wood, -0.1));
    out.zones.push({ t: 'shelf', x0: x + 10, x1: x + w - 10, y: top, maxS: 62, depth: 6 });
    out.holes.push({ x0: x - 8, x1: x + w + 8, y0: top - 20, y1: by + 4 });
  } else if (type === 'bed') {
    const w = R(rnd, 380, 440), x = cx - w / 2, top = by - 150;
    shadowE(w);
    fillRR(g, x - 10, top - 120, 40, by - top + 120, 8, shade(wood, -0.1));
    fillRR(g, x, top, w, by - top - 20, 14, '#f4efe6');
    const bl = st.blanket || '#4a7ab8';
    fillRR(g, x + w * 0.3, top - 6, w * 0.72, by - top - 10, 18, lin(g, 0, top, 0, by, [shade(bl, 0.15), shade(bl, -0.15)]));
    fillRR(g, x + 30, top - 34, w * 0.24, 46, 20, '#ffffff');
    g.fillStyle = shade(wood, -0.3);
    g.fillRect(x + w - 30, by - 30, 18, 30);
    out.zones.push({ t: 'shelf', x0: x + 40, x1: x + w - 20, y: top + 6, maxS: 70, depth: 30 });
    out.holes.push({ x0: x - 10, x1: x + w + 10, y0: top - 130, y1: by + 4 });
  } else if (type === 'pedestal') {
    const w = 96, top = by - 180, x = cx - w / 2;
    shadowE(w * 1.4);
    fillRR(g, x - 10, by - 24, w + 20, 24, 3, '#d8d0c4');
    g.fillStyle = lin(g, x, 0, x + w, 0, ['#cfc6b8', '#f4efe6', '#b8ae9e']);
    g.fillRect(x, top + 20, w, by - top - 44);
    fillRR(g, x - 10, top, w + 20, 24, 3, '#e8e0d4');
    out.zones.push({ t: 'shelf', x0: x - 4, x1: x + w + 4, y: top, maxS: 80, depth: 4 });
    out.holes.push({ x0: x - 12, x1: x + w + 12, y0: top - 20, y1: by + 4 });
  } else if (type === 'pastry') {
    const w = R(rnd, 300, 360), x = cx - w / 2, top = by - 170;
    shadowE(w);
    fillRR(g, x, top + 40, w, by - top - 40, 8, lin(g, 0, top, 0, by, [shade(wood, 0.05), shade(wood, -0.25)]));
    fillRR(g, x + 10, top - 60, w - 20, 100, 10, rgba('#dff4ff', 0.35));
    g.strokeStyle = rgba('#ffffff', 0.5);
    g.lineWidth = 3;
    g.strokeRect(x + 10, top - 60, w - 20, 100);
    out.zones.push({ t: 'shelf', x0: x + 20, x1: x + w - 20, y: top + 38, maxS: 58, depth: 4 });
    out.zones.push({ t: 'shelf', x0: x + 20, x1: x + w - 20, y: top - 60, maxS: 66, depth: 4 });
    out.holes.push({ x0: x - 4, x1: x + w + 4, y0: top - 80, y1: by + 4 });
  }
}

function pendantLamp(g, x, st, out, len) {
  K.line(g, x, 0, x, len, '#1a1410', 3);
  const c = st.lampShade || '#2f5a3a';
  poly(g, [x - 26, len, x + 26, len, x + 60, len + 56, x - 60, len + 56], c);
  g.fillStyle = lin(g, x - 60, 0, x + 60, 0, [rgba('#000000', 0.3), rgba('#ffffff', 0.15), rgba('#000000', 0.3)]);
  poly(g, [x - 26, len, x + 26, len, x + 60, len + 56, x - 60, len + 56]);
  g.fill();
  ellipse(g, x, len + 56, 60, 10, '#fff1c4');
  out.lights.push({ x, y: len + 70, r: 360, color: '#ffcf7a', a: 0.45 });
}

// ---------------------------------------------------------------- main
export function paintIndoor(g, W, H, rnd, st) {
  const out = { zones: [], lights: [], windows: [], holes: [] };
  const fy = Math.round(H * (st.floorY || 0.5));
  st = { top: 70, ...st };
  wall(g, 0, 0, W, fy + 10, st, rnd);
  if (st.ceiling !== 'attic') crownMolding(g, W, st);
  if (st.wainscot) {
    const wy = fy - 150;
    K.planks(g, 0, wy, W, fy - wy, 90, [st.wainscot, shade(st.wainscot, -0.06)], rnd, true, 0.12);
    g.fillStyle = shade(st.wainscot, 0.2);
    g.fillRect(0, wy - 8, W, 12);
  }
  // wall modules
  const n = W > 1080 ? 4 : 3;
  const weights = Array.from({ length: n }, () => R(rnd, 0.85, 1.25));
  const sum = weights.reduce((a, b) => a + b, 0);
  const pool = st.modules.slice();
  const chosen = [];
  for (const m of st.must || []) chosen.push(m);
  while (chosen.length < n) {
    let m = pickR(rnd, pool);
    if (chosen.length && chosen[chosen.length - 1] === m && pool.length > 1) m = pickR(rnd, pool);
    chosen.push(m);
  }
  const count = K.clamp(chosen.length, 1, n);
  const mods = [];
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  let x = 6;
  for (let i = 0; i < count; i++) {
    const w = ((W - 12) * weights[i]) / sum;
    mods.push({ type: chosen[i], x0: x, x1: x + w });
    x += w;
  }
  for (const m of mods) (MODULES[m.type] || bookcase)(g, m.x0, m.x1, fy, rnd, st, out);
  if (st.ceiling === 'attic') {
    for (const side of [0, 1]) {
      const pts = side ? [W, 0, W - W * 0.34, 0, W, fy * 0.62] : [0, 0, W * 0.34, 0, 0, fy * 0.62];
      g.save();
      poly(g, pts);
      g.clip();
      K.planks(g, 0, 0, W, fy, 60, [shade(st.woodDark, 0.1), st.woodDark], rnd, false, 0.25);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, W, fy);
      g.restore();
      const [ax, ay, bx, by2, cx, cy] = pts;
      K.line(g, bx, by2, cx, cy, shade(st.wood, 0.1), 22);
      K.line(g, bx, by2, cx, cy, rgba('#000000', 0.3), 4);
    }
    // filter zones that are under the slopes
    const blocked = (px, py) => py < fy * 0.62 * (1 - Math.min(px, W - px) / (W * 0.34)) + 30;
    out.zones = out.zones.filter((z) => {
      while (z.x1 - z.x0 > 40 && blocked(z.x0, z.y - (z.maxS || 50))) z.x0 += 10;
      while (z.x1 - z.x0 > 40 && blocked(z.x1, z.y - (z.maxS || 50))) z.x1 -= 10;
      return z.x1 - z.x0 > 50;
    });
  }
  if (st.ceiling === 'beams') {
    for (let bx = R(rnd, 40, 120); bx < W; bx += R(rnd, 260, 340)) {
      g.fillStyle = lin(g, bx, 0, bx + 40, 0, [shade(st.woodDark, -0.2), shade(st.woodDark, 0.15), shade(st.woodDark, -0.25)]);
      g.fillRect(bx, 0, 40, fy * 0.08);
    }
    g.fillStyle = lin(g, 0, 0, 0, 44, [shade(st.woodDark, 0.1), shade(st.woodDark, -0.3)]);
    g.fillRect(0, 0, W, 40);
  }
  floor(g, W, H, fy, rnd, st);
  rug(g, W, H, fy, rnd, st);
  // floor furniture
  const furn = st.furniture || [];
  if (furn.length) {
    const k = rnd() < 0.55 ? 2 : 1;
    const slots = k === 2 ? [W * R(rnd, 0.2, 0.3), W * R(rnd, 0.7, 0.8)] : [W * R(rnd, 0.3, 0.7)];
    const pool = furn.slice();
    const pieces = slots.map((sx) => {
      const type = pickR(rnd, pool);
      if (pool.length > 1) pool.splice(pool.indexOf(type), 1);
      return { sx, by: fy + (H - fy) * R(rnd, 0.32, 0.55), type };
    });
    pieces.sort((a, b) => a.by - b.by);
    for (const p of pieces) furniturePiece(p.type, g, p.sx, p.by, rnd, st, out);
  }
  if (st.lamp) {
    const lx = W * R(rnd, 0.3, 0.7);
    pendantLamp(g, lx, st, out, R(rnd, 60, 120));
  }
  // ---- lighting
  for (const wdw of out.windows) {
    g.save();
    g.globalCompositeOperation = 'screen';
    const bx = wdw.x + wdw.w / 2;
    g.fillStyle = lin(g, 0, wdw.y, 0, H, [rgba(st.beam || '#fff3d0', 0.16), rgba(st.beam || '#fff3d0', 0)]);
    poly(g, [wdw.x, wdw.y + wdw.h * 0.2, wdw.x + wdw.w, wdw.y + wdw.h * 0.2, bx + wdw.w * 1.4 + 120, H, bx - wdw.w * 0.4 + 120, H]);
    g.fill();
    g.restore();
    K.speckle(g, wdw.x, wdw.y + wdw.h, wdw.w * 1.6, H - wdw.y - wdw.h, 40, ['#fff6da'], 0.8, 2.2, rnd, 0.35);
  }
  for (const l of out.lights) K.glow(g, l.x, l.y, l.r, l.color, l.a, 'screen');
  if (st.grade) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = st.grade;
    g.fillRect(0, 0, W, H);
    g.restore();
  }
  K.vignette(g, W, H, st.vignette ?? 0.55, '#120804', W / 2, H * 0.48);
  // zones: the whole floor area, avoiding the furniture bodies
  out.zones.push({ t: 'area', x0: 24, x1: W - 24, y0: fy + 44, y1: H - 14, s0: 0.9, s1: 1.22, holes: out.holes });
  // a few items hung/leaning on the wall gaps are added as a sparse "wall" zone
  out.zones.push({ t: 'wall', x0: 30, x1: W - 30, y0: st.top + 40, y1: fy - 40 });
  return { zones: out.zones, horizon: fy };
}
