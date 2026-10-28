// Outdoor panorama painter: a wide side-view landscape in layers.
//   back  (sky + far scenery)  → drawn on its own canvas, scrolled with parallax
//   front (mid scenery, ground, foreground features, lighting) → world canvas
// Returns placement zones (sky, water, ground area, surfaces).

import * as K from './kit.js';

const { R, RI, pickR, rgba, shade, mix, lin, rrect, fillRR, ellipse, circle, poly } = K;

const SKIES = {
  day: ['#4aa8f0', '#8fd0ff', '#e6f6ff'],
  sunset: ['#3b3a8c', '#e0708a', '#ffc77a'],
  night: ['#070b26', '#1d1a4a', '#4a2f6a'],
  winter: ['#7cb8ea', '#bfe0fa', '#f2f8ff'],
  underwater: ['#0a3a6a', '#11709a', '#2bb0c8'],
  space: ['#05040f', '#120b30', '#2a1450'],
};

// ---------------------------------------------------------------- back layer
function sky(g, x0, x1, y0, y1, st, rnd, W, horizon) {
  const c = SKIES[st.sky] || SKIES.day;
  g.fillStyle = lin(g, 0, y0, 0, horizon + 40, c);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const sun = { x: W * R(rnd, 0.25, 0.75), y: horizon * R(rnd, 0.25, 0.45) };
  if (st.sky === 'night') {
    for (let i = 0; i < 260; i++) circle(g, R(rnd, x0, x1), R(rnd, y0, horizon), R(rnd, 0.6, 2.2), rgba('#ffffff', R(rnd, 0.3, 1)));
    K.glow(g, sun.x, sun.y, 260, '#b9c4ff', 0.35, 'screen');
    circle(g, sun.x, sun.y, 54, K.rad(g, sun.x - 14, sun.y - 14, 4, 54, ['#fffbe8', '#e3dcb8']));
    for (let i = 0; i < 5; i++) circle(g, sun.x + R(rnd, -30, 30), sun.y + R(rnd, -30, 30), R(rnd, 5, 10), rgba('#b8ae8a', 0.45));
    for (let i = 0; i < 4; i++) K.cloud(g, R(rnd, x0, x1), R(rnd, 60, horizon * 0.6), R(rnd, 120, 200), rnd, '#3a3266', '#241e48', 0.55);
  } else if (st.sky === 'space') {
    for (const col of ['#7b2ff7', '#00b3c7', '#ff4fa3']) K.glow(g, R(rnd, x0, x1), R(rnd, y0, horizon), R(rnd, 300, 520), col, 0.28, 'screen');
    for (let i = 0; i < 700; i++) circle(g, R(rnd, x0, x1), R(rnd, y0, horizon + 60), R(rnd, 0.5, 2), rgba('#ffffff', R(rnd, 0.3, 1)));
    for (let i = 0; i < 14; i++) {
      const sx = R(rnd, x0, x1), sy = R(rnd, y0, horizon);
      K.glow(g, sx, sy, 16, '#ffffff', 0.8, 'screen');
      K.line(g, sx - 12, sy, sx + 12, sy, rgba('#ffffff', 0.6), 1.2);
      K.line(g, sx, sy - 12, sx, sy + 12, rgba('#ffffff', 0.6), 1.2);
    }
    // planets
    const px = sun.x, py = sun.y, pr = 120;
    circle(g, px, py, pr, K.rad(g, px - pr * 0.4, py - pr * 0.4, 10, pr, ['#ffd59a', '#d97a3a', '#5a2a3a']));
    g.save();
    g.beginPath();
    g.arc(px, py, pr, 0, K.TAU);
    g.clip();
    for (let i = 0; i < 6; i++) {
      g.fillStyle = rgba(i % 2 ? '#ffffff' : '#7a3a2a', 0.12);
      g.fillRect(px - pr, py - pr + i * 40 + R(rnd, 0, 20), pr * 2, R(rnd, 8, 22));
    }
    g.restore();
    g.strokeStyle = rgba('#ffe2b0', 0.7);
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(px, py, pr * 1.8, pr * 0.35, -0.25, 0.1, Math.PI - 0.1);
    g.stroke();
    const mx = sun.x > W / 2 ? W * 0.2 : W * 0.8;
    circle(g, mx, horizon * 0.35, 46, K.rad(g, mx - 14, horizon * 0.35 - 14, 4, 46, ['#cde6ff', '#4a7ab8', '#1a2a5a']));
  } else if (st.sky === 'underwater') {
    g.save();
    g.globalCompositeOperation = 'screen';
    for (let i = 0; i < 9; i++) {
      const rx = R(rnd, x0, x1), w = R(rnd, 60, 160);
      g.fillStyle = lin(g, 0, y0, 0, horizon + 200, [rgba('#c8fbff', 0.22), rgba('#c8fbff', 0)]);
      poly(g, [rx, y0, rx + w, y0, rx + w * 2.4 + 200, horizon + 220, rx + 200, horizon + 220]);
      g.fill();
    }
    g.restore();
    for (let i = 0; i < 90; i++) {
      const bx = R(rnd, x0, x1), by = R(rnd, y0, horizon + 80), br = R(rnd, 2, 9);
      g.strokeStyle = rgba('#e8ffff', 0.35);
      g.lineWidth = 1.5;
      circle(g, bx, by, br);
      g.stroke();
      circle(g, bx - br * 0.3, by - br * 0.3, br * 0.25, rgba('#ffffff', 0.5));
    }
  } else {
    const sunC = st.sky === 'sunset' ? '#ffb46a' : '#fff4c0';
    K.glow(g, sun.x, sun.y, st.sky === 'sunset' ? 520 : 380, sunC, st.sky === 'sunset' ? 0.7 : 0.55, 'screen');
    circle(g, sun.x, sun.y, st.sky === 'sunset' ? 70 : 48, rgba('#fffbe6', 0.95));
    const n = RI(rnd, 6, 10);
    for (let i = 0; i < n; i++) {
      const cs = R(rnd, 120, 240);
      K.cloud(g, R(rnd, x0, x1), R(rnd, 60, horizon * 0.62), cs, rnd, st.sky === 'sunset' ? '#ffe0c8' : '#ffffff', st.sky === 'sunset' ? '#d98a9a' : '#cfe0f2', R(rnd, 0.7, 0.95));
    }
    // tiny far birds
    for (let i = 0; i < 8; i++) {
      const bx = R(rnd, x0, x1), by = R(rnd, 80, horizon * 0.7), s = R(rnd, 6, 12);
      g.strokeStyle = rgba('#2a3a5a', 0.6);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(bx - s, by - s * 0.4);
      g.quadraticCurveTo(bx - s * 0.4, by - s * 0.6, bx, by);
      g.quadraticCurveTo(bx + s * 0.4, by - s * 0.6, bx + s, by - s * 0.4);
      g.stroke();
    }
  }
  return sun;
}

function far(g, x0, x1, horizon, st, rnd) {
  const skyLow = (SKIES[st.sky] || SKIES.day)[2];
  const haze = (c, t) => mix(c, skyLow, t);
  const bottom = horizon + 140;
  switch (st.far) {
    case 'mountains':
    case 'snowpeaks': {
      const base = st.far === 'snowpeaks' ? '#7a8fb8' : '#5f7fa6';
      for (let layer = 0; layer < 2; layer++) {
        const pts = K.ridge(g, x0, x1, horizon - 20 + layer * 50, 260 - layer * 100, bottom, rnd, { step: 120 - layer * 30, jag: 0.15, smooth: false });
        g.fillStyle = lin(g, 0, horizon - 280, 0, bottom, [haze(shade(base, -0.1 * layer), 0.55 - layer * 0.25), haze(base, 0.7 - layer * 0.2)]);
        g.fill();
        g.save();
        g.clip();
        const snowLine = horizon - (st.far === 'snowpeaks' ? 120 : 175) + layer * 50;
        g.fillStyle = lin(g, 0, horizon - 300, 0, snowLine, [rgba('#ffffff', st.far === 'snowpeaks' ? 0.95 : 0.8), rgba('#ffffff', 0.6), rgba('#ffffff', 0)]);
        g.fillRect(x0, horizon - 320, x1 - x0, snowLine - horizon + 320);
        g.restore();
      }
      break;
    }
    case 'hills':
      for (let layer = 0; layer < 3; layer++) {
        K.ridge(g, x0, x1, horizon - 10 + layer * 30, 120 - layer * 30, bottom, rnd, { step: 160 });
        g.fillStyle = haze(['#5f9a6a', '#4a8a52', '#3f7f45'][layer], 0.55 - layer * 0.18);
        g.fill();
      }
      break;
    case 'skyline': {
      let x = x0;
      while (x < x1) {
        const w = R(rnd, 50, 130), h = R(rnd, 90, 320);
        const c = haze(pickR(rnd, ['#5a6a8a', '#6a7a9a', '#4a5a7a', '#7a8aa8']), 0.45);
        g.fillStyle = c;
        g.fillRect(x, horizon + 20 - h, w, h + 120);
        if (rnd() < 0.3) g.fillRect(x + w / 2 - 3, horizon + 20 - h - 40, 6, 40);
        g.fillStyle = st.sky === 'night' ? rgba('#ffe7a0', 0.7) : rgba('#ffffff', 0.18);
        for (let wy = horizon + 30 - h; wy < horizon; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) if (rnd() < 0.55) g.fillRect(wx, wy, 7, 10);
        x += w + R(rnd, -10, 6);
      }
      break;
    }
    case 'cliffs':
      for (let layer = 0; layer < 2; layer++) {
        K.ridge(g, x0, x1, horizon - 30 + layer * 40, 160 - layer * 60, bottom, rnd, { step: 90, jag: 0.4 });
        g.fillStyle = haze(['#8a7a6a', '#7a6a5a'][layer], 0.5 - layer * 0.2);
        g.fill();
      }
      break;
    case 'rocks':
      for (let layer = 0; layer < 2; layer++) {
        K.ridge(g, x0, x1, horizon + 20 + layer * 40, 200 - layer * 60, bottom + 60, rnd, { step: 110, jag: 0.35 });
        g.fillStyle = haze(['#1d5a74', '#16485e'][layer], 0.35 - layer * 0.15);
        g.fill();
      }
      break;
    case 'moonhills':
      for (let layer = 0; layer < 2; layer++) {
        K.ridge(g, x0, x1, horizon + layer * 40, 170 - layer * 60, bottom, rnd, { step: 140, jag: 0.25, smooth: false });
        g.fillStyle = lin(g, 0, horizon - 170, 0, bottom, [['#6a6a88', '#8a8aa8'][layer], ['#3a3a52', '#4a4a62'][layer]]);
        g.fill();
      }
      break;
    default:
  }
}

// ---------------------------------------------------------------- front: mid scenery
function house(g, x, by, w, h, rnd, st, night) {
  const c = pickR(rnd, st.houses || ['#f2c14e', '#e76f51', '#f4a261', '#8ecae6', '#e9edc9', '#ffb4a2', '#b5e48c', '#ffd6a5']);
  g.fillStyle = rgba('#000000', 0.18);
  g.fillRect(x + 6, by - h + 6, w, h);
  g.fillStyle = lin(g, x, 0, x + w, 0, [shade(c, 0.08), shade(c, -0.12)]);
  g.fillRect(x, by - h, w, h);
  const roof = pickR(rnd, ['#b5452c', '#8a3a2a', '#5a4a6a', '#c0603a']);
  poly(g, [x - 8, by - h, x + w / 2, by - h - w * 0.42, x + w + 8, by - h], roof);
  poly(g, [x + w / 2, by - h - w * 0.42, x + w + 8, by - h, x + w / 2, by - h], rgba('#000000', 0.15));
  const cols = Math.max(1, Math.floor(w / 34));
  const rows = Math.max(1, Math.floor(h / 46));
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const wx = x + (w / cols) * (k + 0.5) - 8, wy = by - h + 14 + r * 44;
      if (r === rows - 1 && k === Math.floor(cols / 2) && h > 70) {
        fillRR(g, wx - 2, by - 40, 20, 40, 3, shade(c, -0.45));
        continue;
      }
      fillRR(g, wx, wy, 16, 22, 2, night && rnd() < 0.6 ? '#ffd77a' : '#3a5a7a');
      g.fillStyle = rgba('#ffffff', 0.5);
      g.fillRect(wx - 2, wy + 22, 20, 3);
    }
}

function tree(g, x, by, s, rnd, colors = ['#3f8a3a', '#2f7a32', '#58a54a']) {
  g.fillStyle = '#5a3a1e';
  g.fillRect(x - s * 0.08, by - s * 0.6, s * 0.16, s * 0.6);
  for (let i = 0; i < 5; i++) {
    const cx = x + R(rnd, -s * 0.3, s * 0.3), cy = by - s * R(rnd, 0.7, 1.05), r = s * R(rnd, 0.28, 0.4);
    circle(g, cx, cy, r, K.rad(g, cx - r * 0.3, cy - r * 0.4, r * 0.1, r * 1.1, [shade(pickR(rnd, colors), 0.15), shade(pickR(rnd, colors), -0.15)]));
  }
}

function pine(g, x, by, s, c = '#2a5a3a', snow = false) {
  g.fillStyle = '#4a2e1a';
  g.fillRect(x - s * 0.05, by - s * 0.2, s * 0.1, s * 0.2);
  for (let i = 0; i < 3; i++) {
    const ty = by - s * 0.15 - i * s * 0.28, tw = s * (0.42 - i * 0.1);
    poly(g, [x - tw, ty, x + tw, ty, x, ty - s * 0.42], shade(c, i * 0.06));
    if (snow) poly(g, [x - tw * 0.55, ty - s * 0.2, x + tw * 0.55, ty - s * 0.2, x, ty - s * 0.42], rgba('#ffffff', 0.9));
  }
}

function mid(g, W, H, horizon, st, rnd, out) {
  const night = st.sky === 'night';
  switch (st.mid) {
    case 'sea':
    case 'harbor': {
      const seaBottom = horizon + H * (st.mid === 'harbor' ? 0.2 : 0.17);
      g.fillStyle = lin(g, 0, horizon, 0, seaBottom, ['#1f6fb0', '#2a9fd0', '#4ccbe0']);
      g.fillRect(0, horizon, W, seaBottom - horizon + 4);
      for (let i = 0; i < 260; i++) {
        const y = R(rnd, horizon + 4, seaBottom), w = R(rnd, 10, 40) * (0.5 + (y - horizon) / (seaBottom - horizon));
        g.fillStyle = rgba('#ffffff', R(rnd, 0.12, 0.35));
        g.fillRect(R(rnd, 0, W), y, w, 2);
      }
      for (let i = 0; i < 6; i++) {
        const bx = R(rnd, 0, W), by = horizon + R(rnd, 6, 20);
        poly(g, [bx, by, bx + 14, by, bx + 10, by + 4, bx + 3, by + 4], rgba('#ffffff', 0.7));
        poly(g, [bx + 7, by - 16, bx + 7, by, bx + 1, by - 2], rgba('#ffffff', 0.8));
      }
      out.seaBottom = seaBottom;
      let wx0 = 30, wx1 = W - 30;
      if (st.mid === 'harbor') {
        // hillside towns at both ends
        for (const side of [0, 1]) {
          const hx0 = side ? W * R(rnd, 0.7, 0.76) : 0, hx1 = side ? W : W * R(rnd, 0.24, 0.3);
          const top = horizon - H * 0.2;
          g.beginPath();
          g.moveTo(hx0 - (side ? 80 : 0), seaBottom + 30);
          if (side) g.quadraticCurveTo(hx0, top, hx1, top - 40);
          else g.lineTo(hx0, top - 40);
          if (side) g.lineTo(hx1, seaBottom + 30);
          else {
            g.quadraticCurveTo(hx1, top, hx1 + 80, seaBottom + 30);
          }
          g.closePath();
          g.fillStyle = lin(g, 0, top, 0, seaBottom, ['#8aa86a', '#6a8a52']);
          g.fill();
          // houses in rows
          for (let row = 0; row < 4; row++) {
            const by = top + 30 + row * ((seaBottom - top) / 4) + 40;
            let x = hx0 + (side ? 60 : 10) + R(rnd, 0, 30);
            const xEnd = hx1 - (side ? 10 : 60);
            while (x < xEnd - 50) {
              const w = R(rnd, 60, 90) * (0.75 + row * 0.08), h = R(rnd, 70, 120) * (0.75 + row * 0.08);
              house(g, x, by, w, h, rnd, st, night);
              x += w + R(rnd, 4, 14);
            }
          }
          if (side) wx1 = hx0 - 40;
          else wx0 = hx1 + 40;
        }
      }
      out.zones.push({ t: 'water', x0: wx0, x1: wx1, y0: horizon + 30, y1: seaBottom - 10, s0: 0.55, s1: 0.9 });
      // shore
      g.fillStyle = rgba('#ffffff', 0.85);
      g.beginPath();
      g.moveTo(0, seaBottom);
      for (let x = 0; x <= W; x += 40) g.lineTo(x, seaBottom + Math.sin(x * 0.02) * 6 - 3);
      g.lineTo(W, seaBottom + 14);
      g.lineTo(0, seaBottom + 14);
      g.closePath();
      g.fill();
      return seaBottom + 8;
    }
    case 'town': {
      let x = -20;
      while (x < W) {
        const w = R(rnd, 80, 140), h = R(rnd, 90, 170);
        house(g, x, horizon + 30, w, h, rnd, st, night);
        x += w + R(rnd, 6, 30);
        if (rnd() < 0.4) {
          tree(g, x + 20, horizon + 30, R(rnd, 90, 130), rnd);
          x += 50;
        }
      }
      return horizon + 30;
    }
    case 'city': {
      let x = -10;
      while (x < W) {
        const w = R(rnd, 110, 220), h = R(rnd, 200, 380);
        const c = pickR(rnd, ['#d9a07a', '#c2c8d0', '#e6c88a', '#a8b8c8', '#cf8a6a', '#9ab0a0', '#e8dcc8']);
        g.fillStyle = rgba('#000000', 0.2);
        g.fillRect(x + 8, horizon + 40 - h + 8, w, h);
        g.fillStyle = lin(g, x, 0, x + w, 0, [shade(c, 0.1), shade(c, -0.12)]);
        g.fillRect(x, horizon + 40 - h, w, h);
        g.fillStyle = shade(c, -0.3);
        g.fillRect(x - 4, horizon + 40 - h - 10, w + 8, 12);
        for (let wy = horizon + 60 - h; wy < horizon - 10; wy += 34)
          for (let wx = x + 14; wx < x + w - 20; wx += 28) {
            fillRR(g, wx, wy, 16, 22, 2, night && rnd() < 0.5 ? '#ffd77a' : lin(g, 0, wy, 0, wy + 22, ['#9ad0f0', '#3a6a8a']));
          }
        fillRR(g, x + w / 2 - 22, horizon - 20, 44, 60, 4, shade(c, -0.5));
        x += w + R(rnd, 0, 16);
      }
      return horizon + 40;
    }
    case 'trees':
    case 'campforest': {
      const n = Math.round(W / 70);
      for (let i = 0; i < n; i++) {
        const x = (i / n) * W + R(rnd, -20, 20);
        if (st.mid === 'campforest') pine(g, x, horizon + 40 + R(rnd, 0, 20), R(rnd, 160, 260), pickR(rnd, ['#1f4a32', '#2a5a3a', '#244f36']));
        else tree(g, x, horizon + 30 + R(rnd, 0, 20), R(rnd, 110, 170), rnd);
      }
      return horizon + 40;
    }
    case 'pines': {
      for (let row = 0; row < 2; row++) {
        const n = Math.round(W / (60 - row * 10));
        for (let i = 0; i < n; i++) pine(g, (i / n) * W + R(rnd, -15, 15), horizon + 20 + row * 30, R(rnd, 90, 150) * (1 + row * 0.25), row ? '#2a5a4a' : '#4a7a6a', true);
      }
      // ski lift
      const lx0 = W * R(rnd, 0.1, 0.3), lx1 = W * R(rnd, 0.6, 0.9);
      const ly0 = horizon + 60, ly1 = horizon - 220;
      K.line(g, lx0, ly0, lx1, ly1, '#2a2a2a', 3);
      for (let t = 0.1; t < 1; t += 0.12) {
        const px = K.lerp(lx0, lx1, t), py = K.lerp(ly0, ly1, t);
        K.line(g, px, py, px, py + 26, '#2a2a2a', 2);
        fillRR(g, px - 12, py + 24, 24, 10, 3, '#c0392b');
      }
      for (const [px, py] of [[lx0, ly0], [lx1, ly1]]) {
        g.fillStyle = '#5a5a6a';
        g.fillRect(px - 6, py, 12, 120);
      }
      // chalet
      const cx = W * R(rnd, 0.35, 0.65);
      house(g, cx, horizon + 50, 140, 90, rnd, { houses: ['#8a5a3a'] }, false);
      poly(g, [cx - 14, horizon + 50 - 90, cx + 70, horizon + 50 - 90 - 66, cx + 154, horizon + 50 - 90], '#ffffff');
      return horizon + 50;
    }
    case 'fun': {
      // ferris wheel
      const fx = W * R(rnd, 0.15, 0.35), fy = horizon - 120, fr = 230;
      g.strokeStyle = '#e8e0f0';
      g.lineWidth = 8;
      circle(g, fx, fy, fr);
      g.stroke();
      g.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * K.TAU;
        K.line(g, fx, fy, fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, '#d8d0e8', 3);
        fillRR(g, fx + Math.cos(a) * fr - 16, fy + Math.sin(a) * fr, 32, 26, 6, pickR(rnd, ['#e63946', '#f4a261', '#2a9d8f', '#8338ec', '#ffbe0b']));
      }
      poly(g, [fx, fy, fx - 120, horizon + 60, fx - 100, horizon + 60], '#b8b0c8');
      poly(g, [fx, fy, fx + 120, horizon + 60, fx + 100, horizon + 60], '#b8b0c8');
      circle(g, fx, fy, 16, '#ffbe0b');
      // roller coaster
      const cx0 = W * 0.52, cx1 = W * 0.97;
      const ty = (x) => horizon - 30 - Math.abs(Math.sin((x - cx0) * 0.0055)) * 190;
      for (let x = cx0; x <= cx1; x += 70) {
        K.line(g, x, ty(x), x, horizon + 60, '#9a8a9a', 6);
        if (x + 70 <= cx1) K.line(g, x, (ty(x) + horizon + 60) / 2, x + 70, (ty(x + 70) + horizon + 60) / 2, rgba('#9a8a9a', 0.7), 3);
      }
      g.strokeStyle = '#c0392b';
      g.lineWidth = 9;
      g.beginPath();
      for (let x = cx0; x <= cx1; x += 8) (x === cx0 ? g.moveTo(x, ty(x)) : g.lineTo(x, ty(x)));
      g.stroke();
      g.strokeStyle = '#ffd166';
      g.lineWidth = 2;
      g.stroke();
      // tents
      for (let i = 0; i < 4; i++) {
        const tx = W * (0.38 + i * 0.16) + R(rnd, -40, 40), tw = R(rnd, 90, 140), th = R(rnd, 110, 160);
        const c1 = pickR(rnd, ['#e63946', '#3a86ff', '#8338ec', '#ff006e']);
        for (let k = 0; k < 6; k++) poly(g, [tx, horizon + 60 - th, tx - tw / 2 + (k * tw) / 6, horizon + 60, tx - tw / 2 + ((k + 1) * tw) / 6, horizon + 60], k % 2 ? '#ffffff' : c1);
        K.line(g, tx, horizon + 60 - th, tx, horizon + 30 - th, '#3a3a3a', 3);
        poly(g, [tx, horizon + 30 - th, tx + 22, horizon + 38 - th, tx, horizon + 46 - th], '#ffbe0b');
      }
      // string lights
      for (let i = 0; i < 3; i++) {
        const sx = R(rnd, 0, W * 0.7), ex = sx + R(rnd, 300, 600);
        g.strokeStyle = '#3a3a3a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(sx, horizon - 60);
        g.quadraticCurveTo((sx + ex) / 2, horizon, ex, horizon - 60);
        g.stroke();
        for (let t = 0; t <= 1; t += 0.06) {
          const px = K.lerp(sx, ex, t), py = (1 - t) * (1 - t) * (horizon - 60) + 2 * t * (1 - t) * horizon + t * t * (horizon - 60);
          circle(g, px, py + 4, 5, pickR(rnd, ['#ffbe0b', '#ff006e', '#3a86ff', '#38b000']));
        }
      }
      return horizon + 60;
    }
    case 'barn': {
      // fields stripes between horizon and ground
      for (let i = 0; i < 5; i++) {
        const y0 = horizon + i * 22, c = pickR(rnd, ['#9cbf5a', '#c8b45a', '#7aa84a', '#d9c27a']);
        g.fillStyle = c;
        g.fillRect(0, y0, W, 24);
        for (let x = 0; x < W; x += 18) K.line(g, x, y0, x + 6, y0 + 22, rgba('#000000', 0.08), 2);
      }
      const bx = W * R(rnd, 0.55, 0.75), bw = 260, bh = 200, by = horizon + 90;
      g.fillStyle = rgba('#000000', 0.2);
      g.fillRect(bx + 10, by - bh + 10, bw, bh);
      g.fillStyle = lin(g, bx, 0, bx + bw, 0, ['#c0392b', '#9a2a1e']);
      g.fillRect(bx, by - bh, bw, bh);
      poly(g, [bx - 16, by - bh, bx + bw * 0.2, by - bh - 70, bx + bw * 0.8, by - bh - 70, bx + bw + 16, by - bh], '#5a2a1a');
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8;
      g.strokeRect(bx + bw * 0.3, by - 110, bw * 0.4, 110);
      K.line(g, bx + bw * 0.3, by - 110, bx + bw * 0.7, by, '#ffffff', 6);
      K.line(g, bx + bw * 0.7, by - 110, bx + bw * 0.3, by, '#ffffff', 6);
      // silo
      const sx = bx + bw + 30;
      g.fillStyle = lin(g, sx, 0, sx + 70, 0, ['#c8c8d0', '#8a8a98']);
      g.fillRect(sx, by - 260, 70, 260);
      circle(g, sx + 35, by - 260, 35, '#9a9aa8');
      for (const tx of [W * 0.1, W * 0.25, W * 0.92]) tree(g, tx, horizon + 70, 150, rnd);
      return horizon + 100;
    }
    case 'stalls': {
      let x = 10;
      while (x < W) {
        const w = R(rnd, 220, 320), top = horizon - 60;
        const c = pickR(rnd, ['#e63946', '#2a9d8f', '#f4a261', '#3a86ff', '#8338ec']);
        g.fillStyle = '#6a4a2a';
        g.fillRect(x + 10, top, 10, 160);
        g.fillRect(x + w - 20, top, 10, 160);
        for (let k = 0; k < 8; k++) {
          const sx = x + (k * w) / 8;
          poly(g, [sx, top, sx + w / 8, top, sx + w / 8 + 6, top + 40, sx + 6, top + 40], k % 2 ? '#ffffff' : c);
          g.beginPath();
          g.arc(sx + w / 16 + 6, top + 40, w / 16, 0, Math.PI);
          g.fillStyle = k % 2 ? '#ffffff' : c;
          g.fill();
        }
        fillRR(g, x, top + 110, w, 50, 4, shade('#8a5a32', 0.05));
        x += w + R(rnd, 20, 60);
      }
      return horizon + 100;
    }
    case 'haunted': {
      let x = -20;
      while (x < W) {
        const w = R(rnd, 110, 170), h = R(rnd, 140, 240), by = horizon + 40;
        const lean = R(rnd, -0.06, 0.06);
        g.save();
        g.translate(x + w / 2, by);
        g.rotate(lean);
        g.fillStyle = '#2a2238';
        g.fillRect(-w / 2, -h, w, h);
        poly(g, [-w / 2 - 14, -h, 0, -h - w * 0.6, w / 2 + 14, -h], '#1a1426');
        for (let k = 0; k < 4; k++) fillRR(g, -w / 2 + 18 + (k % 2) * (w - 56), -h + 26 + Math.floor(k / 2) * 60, 20, 28, 3, rnd() < 0.6 ? '#ffb347' : '#3a3050');
        g.restore();
        K.glow(g, x + w / 2, by - h / 2, 160, '#ffa040', 0.18, 'screen');
        x += w + R(rnd, 30, 120);
        if (rnd() < 0.5) {
          // dead tree
          const tx = x - 20, th = R(rnd, 160, 240);
          g.strokeStyle = '#1a1222';
          g.lineCap = 'round';
          g.lineWidth = 12;
          K.line(g, tx, horizon + 40, tx + 10, horizon + 40 - th, '#1a1222', 12);
          for (let b = 0; b < 5; b++) {
            const by2 = horizon + 40 - th * R(rnd, 0.4, 0.95);
            K.line(g, tx + 6, by2, tx + 6 + R(rnd, -70, 70), by2 - R(rnd, 30, 70), '#1a1222', 5);
          }
        }
      }
      return horizon + 40;
    }
    case 'reef': {
      for (let i = 0; i < 30; i++) {
        const x = R(rnd, 0, W), by = horizon + R(rnd, 30, 80), s = R(rnd, 60, 140);
        const c = pickR(rnd, ['#ff7a8a', '#ffb05a', '#c86ae0', '#5ad0c0', '#ff5a7a']);
        if (rnd() < 0.5) {
          K.blob(g, x, by - s * 0.4, s * 0.6, s * 0.45, rnd, 8, 0.3);
          g.fillStyle = K.rad(g, x, by - s * 0.6, 4, s, [shade(c, 0.2), shade(c, -0.3)]);
          g.fill();
        } else {
          g.strokeStyle = c;
          g.lineCap = 'round';
          for (let b = 0; b < 5; b++) {
            g.lineWidth = s * 0.08;
            g.beginPath();
            g.moveTo(x, by);
            g.quadraticCurveTo(x + R(rnd, -s * 0.5, s * 0.5), by - s * 0.5, x + R(rnd, -s * 0.6, s * 0.6), by - s * R(rnd, 0.7, 1.1));
            g.stroke();
          }
        }
      }
      for (let i = 0; i < 26; i++) {
        const x = R(rnd, 0, W), h = R(rnd, 160, 380);
        g.strokeStyle = rgba(pickR(rnd, ['#2a8a4a', '#3a9a5a', '#1f7a42']), 0.85);
        g.lineWidth = R(rnd, 6, 12);
        g.beginPath();
        g.moveTo(x, horizon + 80);
        for (let y = 0; y <= h; y += 20) g.lineTo(x + Math.sin(y * 0.04 + i) * 14, horizon + 80 - y);
        g.stroke();
      }
      return horizon + 60;
    }
    case 'domes': {
      for (let i = 0; i < 4; i++) {
        const x = W * (0.12 + i * 0.25) + R(rnd, -60, 60), r = R(rnd, 80, 140), by = horizon + 50;
        g.fillStyle = rgba('#000000', 0.3);
        ellipse(g, x + 10, by + 4, r * 1.1, 16);
        g.fill();
        g.beginPath();
        g.arc(x, by, r, Math.PI, 0);
        g.closePath();
        g.fillStyle = K.rad(g, x - r * 0.3, by - r * 0.6, 4, r * 1.2, [rgba('#d8f4ff', 0.9), rgba('#5aa0c8', 0.75), rgba('#1a3a5a', 0.9)]);
        g.fill();
        for (let k = 1; k < 4; k++) {
          g.strokeStyle = rgba('#ffffff', 0.35);
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(x, by, r * (k / 4), r, 0, Math.PI, 0);
          g.stroke();
        }
        K.glow(g, x, by - r * 0.4, r * 1.3, '#7ad8ff', 0.2, 'screen');
        if (rnd() < 0.6) {
          K.line(g, x + r * 0.8, by, x + r * 0.9, by - r * 1.8, '#9aa0b0', 4);
          circle(g, x + r * 0.9, by - r * 1.8, 8, '#ff4a4a');
          K.glow(g, x + r * 0.9, by - r * 1.8, 40, '#ff4a4a', 0.5, 'screen');
        }
      }
      return horizon + 50;
    }
    default:
      return horizon;
  }
}

// ---------------------------------------------------------------- front: ground
function ground(g, W, H, top, st, rnd, horizon) {
  const gr = st.ground;
  const c1 = gr.c1, c2 = gr.c2 || shade(c1, -0.15);
  g.fillStyle = lin(g, 0, top, 0, H, [shade(c1, -0.08), c1, c2]);
  g.fillRect(0, top, W, H - top);
  const h = H - top;
  const vx = W / 2, vy = horizon - (H - horizon) * 1.4;
  switch (gr.type) {
    case 'sand':
      K.speckle(g, 0, top, W, h, 2600, [shade(c1, -0.15), shade(c1, 0.15), '#ffffff'], 0.8, 2.6, rnd, 0.5);
      g.strokeStyle = rgba(shade(c1, -0.25), 0.35);
      g.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
        const y = top + rnd() * h, x = rnd() * W, w = R(rnd, 30, 90) * (0.5 + (y - top) / h);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + w / 2, y - 6, x + w, y);
        g.stroke();
      }
      break;
    case 'grass':
      for (let i = 0; i < 60; i++) {
        K.blob(g, R(rnd, 0, W), R(rnd, top, H), R(rnd, 80, 240), R(rnd, 20, 60), rnd);
        g.fillStyle = rgba(rnd() < 0.5 ? shade(c1, 0.12) : shade(c1, -0.12), 0.35);
        g.fill();
      }
      K.blades(g, 0, top, W, h, 3200, [shade(c1, -0.25), shade(c1, 0.15), shade(c1, -0.1)], 16, rnd, 0.7);
      for (let i = 0; i < 160; i++) circle(g, R(rnd, 0, W), R(rnd, top + 10, H), R(rnd, 2, 4), pickR(rnd, ['#ffffff', '#ffe066', '#ff8fab', '#c77dff']));
      break;
    case 'snow':
      for (let i = 0; i < 40; i++) {
        K.blob(g, R(rnd, 0, W), R(rnd, top, H), R(rnd, 120, 300), R(rnd, 20, 50), rnd);
        g.fillStyle = rgba('#9ab8e0', 0.22);
        g.fill();
      }
      g.strokeStyle = rgba('#a8bcd8', 0.6);
      g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const sx = R(rnd, 0, W), dx = R(rnd, -400, 400);
        for (const o of [0, 14]) {
          g.beginPath();
          g.moveTo(sx + o, top);
          g.quadraticCurveTo(sx + dx * 0.3 + o, top + h * 0.5, sx + dx + o * 2, H);
          g.stroke();
        }
      }
      K.speckle(g, 0, top, W, h, 900, ['#ffffff'], 0.8, 2.2, rnd, 0.9);
      break;
    case 'cobble':
    case 'pavement': {
      const rows = 16;
      for (let r = 0; r < rows; r++) {
        const y0 = top + h * Math.pow(r / rows, 1.4), y1 = top + h * Math.pow((r + 1) / rows, 1.4);
        const t0 = (y0 - vy) / (H - vy), t1 = (y1 - vy) / (H - vy);
        const cols = 60;
        for (let c = -10; c < cols + 10; c++) {
          const bx0 = (c / cols) * W + (r % 2) * (W / cols / 2), bx1 = bx0 + W / cols;
          const px = (bx, t) => vx + (bx - vx) * t;
          const col = K.vary(rnd, rnd() < 0.5 ? c1 : c2, 0.06);
          if (gr.type === 'cobble') {
            const xa = px(bx0, t0), xb = px(bx1, t0), xc = px(bx1, t1), xd = px(bx0, t1);
            rrect(g, Math.min(xa, xd) + 2, y0 + 1.5, Math.max(4, (xb + xc) / 2 - (xa + xd) / 2 - 4), y1 - y0 - 3, (y1 - y0) * 0.35);
            g.fillStyle = col;
            g.fill();
          } else poly(g, [px(bx0, t0) + 1, y0 + 1, px(bx1, t0) - 1, y0 + 1, px(bx1, t1) - 1, y1 - 1, px(bx0, t1) + 1, y1 - 1], col);
        }
      }
      break;
    }
    case 'dirt':
      K.speckle(g, 0, top, W, h, 1800, [shade(c1, -0.2), shade(c1, 0.12)], 1, 3, rnd, 0.5);
      for (let i = 0; i < 50; i++) {
        K.blob(g, R(rnd, 0, W), R(rnd, top, H), R(rnd, 60, 160), R(rnd, 16, 40), rnd);
        g.fillStyle = rgba(gr.patch || '#5a8a3a', 0.45);
        g.fill();
      }
      K.blades(g, 0, top, W, h, 900, [gr.patch || '#5a8a3a', shade(gr.patch || '#5a8a3a', 0.2)], 14, rnd, 0.6);
      break;
    case 'seabed':
      K.speckle(g, 0, top, W, h, 2000, [shade(c1, -0.12), shade(c1, 0.12)], 1, 3, rnd, 0.5);
      g.save();
      g.globalCompositeOperation = 'screen';
      g.strokeStyle = rgba('#c8fbff', 0.18);
      g.lineWidth = 3;
      for (let i = 0; i < 120; i++) {
        const x = R(rnd, 0, W), y = R(rnd, top, H), s = R(rnd, 30, 70);
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + s * 0.3, y - s * 0.3, x + s * 0.6, y + s * 0.3, x + s, y);
        g.stroke();
      }
      g.restore();
      for (let i = 0; i < 14; i++) {
        K.blob(g, R(rnd, 0, W), R(rnd, top + 40, H), R(rnd, 40, 90), R(rnd, 24, 46), rnd);
        g.fillStyle = lin(g, 0, top, 0, H, ['#4a6a7a', '#2a4a5a']);
        g.fill();
      }
      break;
    case 'moon':
      K.speckle(g, 0, top, W, h, 1400, [shade(c1, -0.15), shade(c1, 0.1)], 1, 3, rnd, 0.5);
      for (let i = 0; i < 26; i++) {
        const y = R(rnd, top + 20, H - 20), k = 0.4 + (y - top) / h, x = R(rnd, 0, W), r = R(rnd, 40, 110) * k;
        ellipse(g, x, y, r, r * 0.32, rgba('#000000', 0.25));
        ellipse(g, x, y + r * 0.05, r * 0.86, r * 0.24, shade(c1, -0.2));
        g.strokeStyle = rgba('#ffffff', 0.3);
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.32, 0, 0.1, Math.PI - 0.1);
        g.stroke();
      }
      break;
    default:
      K.speckle(g, 0, top, W, h, 1400, [shade(c1, -0.15), shade(c1, 0.1)], 1, 3, rnd, 0.5);
  }
  // aerial perspective: haze near the horizon
  g.fillStyle = lin(g, 0, top, 0, top + h * 0.35, [rgba(mix(c1, '#ffffff', 0.4), 0.35), rgba(c1, 0)]);
  g.fillRect(0, top, W, h * 0.35);
}

function pathway(g, W, H, top, st, rnd) {
  if (!st.path) return;
  const cx = W * R(rnd, 0.3, 0.7);
  const c = st.pathColor || '#d9c29a';
  if (st.path === 'road') {
    const y0 = top + (H - top) * 0.55, y1 = top + (H - top) * 0.82;
    g.fillStyle = lin(g, 0, y0, 0, y1, ['#4a4f58', '#3a3f48']);
    g.fillRect(0, y0, W, y1 - y0);
    g.fillStyle = '#c8ccd2';
    g.fillRect(0, y0 - 14, W, 14);
    g.fillRect(0, y1, W, 16);
    for (let x = 0; x < W; x += 120) fillRR(g, x, (y0 + y1) / 2 - 4, 60, 8, 3, '#f2d24a');
    const zx = W * R(rnd, 0.2, 0.8);
    for (let k = 0; k < 7; k++) g.fillStyle = '#f4f4f4', g.fillRect(zx + k * 28, y0 + 6, 16, y1 - y0 - 12);
    return;
  }
  // winding path from the horizon to the bottom
  g.fillStyle = c;
  g.beginPath();
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, y = top + (H - top) * t;
    pts.push([cx + Math.sin(t * 3 + rnd()) * 260 * t, y, 20 + t * 150]);
  }
  g.moveTo(pts[0][0] - pts[0][2], pts[0][1]);
  for (const [x, y, w] of pts) g.lineTo(x - w, y);
  for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] + pts[i][2], pts[i][1]);
  g.closePath();
  g.fill();
  g.strokeStyle = rgba(shade(c, -0.3), 0.5);
  g.lineWidth = 4;
  g.stroke();
  K.speckle(g, cx - 400, top, 800, H - top, 400, [shade(c, -0.2), shade(c, 0.15)], 1, 3, rnd, 0.6);
}

// ---------------------------------------------------------------- foreground features
function feature(type, g, x, by, k, rnd, st, out) {
  const hole = (x0, x1, y0, y1) => out.holes.push({ x0, x1, y0, y1 });
  const shadowE = (w) => {
    g.fillStyle = K.rad(g, x, by, 0, w * 0.6, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
    ellipse(g, x, by, w * 0.6, 18 * k);
    g.fill();
  };
  if (type === 'umbrella') {
    const h = 260 * k, r = 140 * k;
    const c = pickR(rnd, ['#e63946', '#3a86ff', '#ff9f1c', '#2ec4b6', '#8338ec']);
    shadowE(r * 2);
    fillRR(g, x - r * 0.9, by - 14 * k, r * 1.8, 30 * k, 6, pickR(rnd, ['#ffd166', '#06d6a0', '#ef476f', '#118ab2']));
    K.line(g, x, by, x + 10 * k, by - h, '#f4f1e8', 7 * k);
    const ty = by - h, cx = x + 10 * k, ry = r * 0.42;
    g.save();
    g.beginPath();
    g.ellipse(cx, ty, r, ry, 0, Math.PI, 0);
    for (let i = 8; i > 0; i--) g.quadraticCurveTo(cx - r + (i - 0.5) * (r / 4), ty + 16 * k, cx - r + (i - 1) * (r / 4), ty);
    g.closePath();
    g.fillStyle = c;
    g.fill();
    g.clip();
    for (let i = 1; i < 8; i += 2) poly(g, [cx, ty - ry, cx - r + i * (r / 4), ty + 20 * k, cx - r + (i + 1) * (r / 4), ty + 20 * k], '#ffffff');
    g.fillStyle = K.rad(g, cx - r * 0.3, ty - ry, 4, r * 1.2, [rgba('#ffffff', 0.35), rgba('#000000', 0.25)]);
    g.fillRect(cx - r, ty - ry, r * 2, ry + 20 * k);
    g.restore();
    circle(g, cx, ty - ry, 5 * k, '#f4f1e8');
    hole(x - r, x + r, ty, by - 20 * k);
  } else if (type === 'bench') {
    const w = 220 * k;
    shadowE(w);
    for (const lx of [x - w * 0.4, x + w * 0.4 - 10 * k]) g.fillStyle = '#3a3a3a', g.fillRect(lx, by - 70 * k, 10 * k, 70 * k);
    fillRR(g, x - w / 2, by - 76 * k, w, 14 * k, 3, '#a8703a');
    for (let i = 0; i < 2; i++) fillRR(g, x - w / 2, by - (120 + i * 22) * k, w, 14 * k, 3, '#b8803a');
    out.zones.push({ t: 'shelf', x0: x - w / 2 + 10, x1: x + w / 2 - 10, y: by - 76 * k, maxS: 64 * k, depth: 4 });
    hole(x - w / 2, x + w / 2, by - 140 * k, by);
  } else if (type === 'table') {
    const w = 240 * k;
    shadowE(w);
    const cloth = pickR(rnd, ['#e63946', '#2a9d8f', '#3a86ff', '#f4a261']);
    g.fillStyle = '#6a4a2a';
    g.fillRect(x - w * 0.42, by - 100 * k, 12 * k, 100 * k);
    g.fillRect(x + w * 0.42 - 12 * k, by - 100 * k, 12 * k, 100 * k);
    fillRR(g, x - w / 2, by - 108 * k, w, 50 * k, 4, cloth);
    g.fillStyle = rgba('#ffffff', 0.35);
    for (let i = 0; i < 8; i++) g.fillRect(x - w / 2 + (i * w) / 8, by - 108 * k, w / 16, 50 * k);
    out.zones.push({ t: 'shelf', x0: x - w / 2 + 8, x1: x + w / 2 - 8, y: by - 108 * k, maxS: 66 * k, depth: 6 * k });
    hole(x - w / 2, x + w / 2, by - 130 * k, by);
  } else if (type === 'stall') {
    const w = 300 * k;
    shadowE(w);
    const c = pickR(rnd, ['#e63946', '#2a9d8f', '#f4a261', '#3a86ff']);
    g.fillStyle = '#5a3a1a';
    g.fillRect(x - w / 2 + 6, by - 300 * k, 12 * k, 300 * k);
    g.fillRect(x + w / 2 - 18 * k, by - 300 * k, 12 * k, 300 * k);
    for (let i = 0; i < 8; i++) {
      const sx = x - w / 2 + (i * w) / 8;
      poly(g, [sx, by - 310 * k, sx + w / 8, by - 310 * k, sx + w / 8, by - 270 * k, sx, by - 270 * k], i % 2 ? '#ffffff' : c);
    }
    fillRR(g, x - w / 2, by - 110 * k, w, 110 * k, 6, lin(g, 0, by - 110 * k, 0, by, ['#b8864e', '#7a5430']));
    for (let i = 1; i < 4; i++) K.line(g, x - w / 2, by - 110 * k + i * 27 * k, x + w / 2, by - 110 * k + i * 27 * k, rgba('#3a2410', 0.4), 2);
    out.zones.push({ t: 'shelf', x0: x - w / 2 + 10, x1: x + w / 2 - 10, y: by - 110 * k, maxS: 66 * k, depth: 6 * k });
    hole(x - w / 2, x + w / 2, by - 310 * k, by);
  } else if (type === 'dock') {
    const w = 360 * k;
    const top = out.seaBottom ? out.seaBottom - 50 : by - 60;
    g.fillStyle = '#5a3a20';
    for (let i = 0; i < 5; i++) g.fillRect(x - w / 2 + (i * w) / 4 - 6, top, 12, by - top + 10);
    K.planks(g, x - w / 2, top - 30, w, 34, 30, ['#a87a4a', '#9a6a3a'], rnd, true, 0.2);
    out.zones.push({ t: 'shelf', x0: x - w / 2 + 10, x1: x + w / 2 - 10, y: top - 26, maxS: 60, depth: 6 });
  } else if (type === 'tent') {
    const w = 220 * k, h = 160 * k;
    shadowE(w);
    const c = pickR(rnd, ['#e76f51', '#2a9d8f', '#f4a261', '#457b9d']);
    poly(g, [x - w / 2, by, x, by - h, x + w / 2, by], c);
    poly(g, [x, by - h, x + w / 2, by, x + w * 0.15, by], shade(c, -0.2));
    poly(g, [x - w * 0.12, by, x, by - h * 0.55, x + w * 0.12, by], '#2a1a10');
    hole(x - w / 2, x + w / 2, by - h, by);
  } else if (type === 'campfire') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * K.TAU;
      ellipse(g, x + Math.cos(a) * 46 * k, by + Math.sin(a) * 14 * k, 14 * k, 9 * k, '#7a7a7a');
    }
    fillRR(g, x - 40 * k, by - 12 * k, 80 * k, 14 * k, 6, '#5a3418');
    for (const [c, s] of [['#ff5a1a', 1], ['#ffa030', 0.7], ['#fff0a0', 0.4]]) {
      g.beginPath();
      g.moveTo(x - 30 * k * s, by - 6 * k);
      g.quadraticCurveTo(x - 20 * k * s, by - 70 * k * s, x, by - 100 * k * s);
      g.quadraticCurveTo(x + 20 * k * s, by - 70 * k * s, x + 30 * k * s, by - 6 * k);
      g.closePath();
      g.fillStyle = c;
      g.fill();
    }
    out.lights.push({ x, y: by - 40 * k, r: 300 * k, color: '#ff8a30', a: 0.45 });
    hole(x - 50 * k, x + 50 * k, by - 100 * k, by + 10 * k);
  } else if (type === 'grave') {
    const w = 70 * k, h = 100 * k;
    shadowE(w * 1.4);
    g.fillStyle = lin(g, x - w / 2, 0, x + w / 2, 0, ['#6a6a7a', '#4a4a5a']);
    g.beginPath();
    g.moveTo(x - w / 2, by);
    g.lineTo(x - w / 2, by - h + w / 2);
    g.arc(x, by - h + w / 2, w / 2, Math.PI, 0);
    g.lineTo(x + w / 2, by);
    g.closePath();
    g.fill();
    K.line(g, x - w * 0.2, by - h * 0.6, x + w * 0.2, by - h * 0.6, rgba('#2a2a3a', 0.6), 4 * k);
    hole(x - w / 2, x + w / 2, by - h, by);
  } else if (type === 'boulder') {
    const w = R(rnd, 120, 200) * k, h = w * 0.55;
    shadowE(w);
    K.blob(g, x, by - h / 2, w / 2, h / 2, rnd, 8, 0.15);
    g.fillStyle = K.rad(g, x - w * 0.2, by - h * 0.8, 4, w * 0.7, [shade(st.rock || '#9a9a9a', 0.25), st.rock || '#9a9a9a', shade(st.rock || '#9a9a9a', -0.4)]);
    g.fill();
    g.strokeStyle = rgba('#000000', 0.18);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x - w * 0.1, by - h * 0.9);
    g.lineTo(x, by - h * 0.55);
    g.lineTo(x + w * 0.12, by - h * 0.45);
    g.stroke();
    out.zones.push({ t: 'shelf', x0: x - w * 0.3, x1: x + w * 0.3, y: by - h * 0.9, maxS: 56 * k, depth: 4 });
    hole(x - w / 2, x + w / 2, by - h, by);
  } else if (type === 'lamp') {
    const h = 300 * k;
    K.line(g, x, by, x, by - h, '#2a2a32', 8 * k);
    fillRR(g, x - 16 * k, by - h - 30 * k, 32 * k, 34 * k, 6, '#2a2a32');
    circle(g, x, by - h - 14 * k, 10 * k, '#ffe7a0');
    out.lights.push({ x, y: by - h - 14 * k, r: 160 * k, color: '#ffd27a', a: st.sky === 'night' ? 0.5 : 0.15 });
  } else if (type === 'fence') {
    const w = 400 * k;
    for (let i = 0; i <= 10; i++) fillRR(g, x - w / 2 + (i * w) / 10, by - 70 * k, 14 * k, 70 * k, 3, st.fence || '#f4f1e8');
    fillRR(g, x - w / 2, by - 56 * k, w + 14 * k, 10 * k, 2, st.fence || '#f4f1e8');
    fillRR(g, x - w / 2, by - 28 * k, w + 14 * k, 10 * k, 2, st.fence || '#f4f1e8');
  } else if (type === 'towel') {
    const w = 220 * k, hgt = 60 * k;
    const c = pickR(rnd, ['#ef476f', '#118ab2', '#ffd166', '#06d6a0']);
    poly(g, [x - w / 2 + 20 * k, by - hgt, x + w / 2 + 20 * k, by - hgt, x + w / 2, by, x - w / 2, by], c);
    g.fillStyle = rgba('#ffffff', 0.6);
    for (let i = 1; i < 5; i += 2) poly(g, [x - w / 2 + (i * w) / 5 + 20 * k * 1, by - hgt, x - w / 2 + ((i + 1) * w) / 5 + 20 * k, by - hgt, x - w / 2 + ((i + 1) * w) / 5, by, x - w / 2 + (i * w) / 5, by]);
  } else if (type === 'snowman_hill' || type === 'drift') {
    const w = R(rnd, 200, 360) * k;
    K.blob(g, x, by - 20 * k, w / 2, 40 * k, rnd, 8, 0.2);
    g.fillStyle = lin(g, 0, by - 60 * k, 0, by, ['#ffffff', '#cfe0f4']);
    g.fill();
  } else if (type === 'flowerbed') {
    const w = 200 * k;
    ellipse(g, x, by, w / 2, 26 * k, '#6a4a2a');
    for (let i = 0; i < 24; i++) circle(g, x + R(rnd, -w * 0.45, w * 0.45), by + R(rnd, -18, 14) * k, 7 * k, pickR(rnd, ['#ff5d8f', '#ffd23f', '#ffffff', '#c77dff', '#ff8c42']));
  } else if (type === 'pond') {
    const w = 360 * k;
    ellipse(g, x, by, w / 2 + 12, 52 * k + 8, '#c9b48a');
    ellipse(g, x, by, w / 2, 52 * k, lin(g, 0, by - 52 * k, 0, by + 52 * k, ['#3a9ad0', '#2a7ab0']));
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = rgba('#ffffff', 0.35);
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x + R(rnd, -w * 0.3, w * 0.3), by + R(rnd, -20, 20) * k, 30 * k, 8 * k, 0, 0, K.TAU);
      g.stroke();
    }
    out.zones.push({ t: 'water', x0: x - w * 0.4, x1: x + w * 0.4, y0: by - 30 * k, y1: by + 30 * k, s0: k * 0.8, s1: k * 0.9 });
    hole(x - w / 2 - 10, x + w / 2 + 10, by - 56 * k, by + 56 * k);
  } else if (type === 'carousel') {
    const w = 300 * k, h = 260 * k;
    shadowE(w);
    poly(g, [x - w / 2, by - h * 0.7, x, by - h, x + w / 2, by - h * 0.7], '#e63946');
    for (let i = 0; i < 8; i++) poly(g, [x, by - h, x - w / 2 + (i * w) / 8, by - h * 0.7, x - w / 2 + ((i + 1) * w) / 8, by - h * 0.7], i % 2 ? '#ffffff' : '#e63946');
    for (let i = 0; i <= 6; i++) K.line(g, x - w / 2 + 10 + (i * (w - 20)) / 6, by - h * 0.7, x - w / 2 + 10 + (i * (w - 20)) / 6, by - 30 * k, '#e8c463', 5 * k);
    fillRR(g, x - w / 2, by - 30 * k, w, 30 * k, 6, '#8338ec');
    hole(x - w / 2, x + w / 2, by - h, by);
  } else if (type === 'rocket_pad') {
    const w = 160 * k;
    ellipse(g, x, by, w, 26 * k, '#5a5a6a');
    ellipse(g, x, by - 4, w * 0.8, 18 * k, '#7a7a8a');
    for (let i = 0; i < 6; i++) circle(g, x + Math.cos(i) * w * 0.7, by + Math.sin(i) * 16 * k, 4 * k, '#ffcc33');
  }
}

// ---------------------------------------------------------------- main
export function paintOutdoorBack(g, W, H, rnd, st, margin) {
  const horizon = Math.round(H * (st.horizon || 0.28));
  const sun = sky(g, -margin.x, W + margin.x, -margin.y, horizon + 200, st, rnd, W, horizon);
  far(g, -margin.x, W + margin.x, horizon, st, rnd);
  return { horizon, sun };
}

export function paintOutdoorFront(g, W, H, rnd, st, back) {
  const out = { zones: [], lights: [], holes: [], seaBottom: 0 };
  const horizon = back.horizon;
  const groundTop = mid(g, W, H, horizon, st, rnd, out);
  ground(g, W, H, groundTop, st, rnd, horizon);
  pathway(g, W, H, groundTop, st, rnd);
  // features in perspective, back to front
  const feats = [];
  for (const f of st.features || []) {
    const [type, count] = f.split(':');
    const n = Number(count || 1);
    for (let i = 0; i < n; i++) feats.push({ type, x: R(rnd, 0.05, 0.95) * W, t: R(rnd, 0.15, 0.85) });
  }
  // spread features horizontally
  feats.sort((a, b) => a.x - b.x);
  feats.forEach((f, i) => (f.x = ((i + 0.5) / feats.length) * W + R(rnd, -60, 60)));
  feats.sort((a, b) => a.t - b.t);
  for (const f of feats) {
    const by = groundTop + (H - groundTop) * f.t;
    const k = K.lerp(0.62, 1.2, f.t);
    feature(f.type, g, f.x, by, k, rnd, st, out);
  }
  // lighting
  for (const l of out.lights) K.glow(g, l.x, l.y, l.r, l.color, l.a, 'screen');
  if (back.sun && (st.sky === 'day' || st.sky === 'sunset' || st.sky === 'winter')) {
    g.save();
    g.globalCompositeOperation = 'screen';
    g.fillStyle = K.rad(g, back.sun.x, back.sun.y, 0, W * 0.5, [[0, rgba(st.sky === 'sunset' ? '#ffb070' : '#fff2c0', 0.28)], [1, rgba('#fff2c0', 0)]]);
    g.fillRect(0, horizon - 300, W, H - horizon + 300);
    g.restore();
  }
  if (st.sky === 'night') {
    g.fillStyle = rgba('#0a0620', 0.35);
    g.fillRect(0, groundTop - 400, W, H);
    for (let i = 0; i < 14; i++) {
      K.blob(g, R(rnd, 0, W), R(rnd, groundTop, H), R(rnd, 200, 400), R(rnd, 30, 60), rnd);
      g.fillStyle = rgba('#c8c0e8', 0.06);
      g.fill();
    }
  }
  if (st.sky === 'underwater') {
    g.save();
    g.globalCompositeOperation = 'screen';
    g.strokeStyle = rgba('#c8fbff', 0.12);
    g.lineWidth = 4;
    for (let i = 0; i < 80; i++) {
      const x = R(rnd, 0, W), y = R(rnd, horizon - 200, H), s = R(rnd, 40, 90);
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + s * 0.3, y - s * 0.4, x + s * 0.7, y + s * 0.4, x + s, y);
      g.stroke();
    }
    g.restore();
  }
  // vignette (only the bottom part: the back layer carries the sky)
  g.save();
  g.globalCompositeOperation = 'source-atop';
  K.vignette(g, W, H, st.vignette ?? 0.4, '#0a0604', W / 2, H * 0.4);
  g.restore();
  const z = out.zones;
  z.push({ t: 'area', x0: 24, x1: W - 24, y0: groundTop + 16, y1: H - 14, s0: 0.78, s1: 1.2, holes: out.holes });
  z.push({ t: 'sky', x0: 60, x1: W - 60, y0: H * 0.06, y1: Math.max(H * 0.12, horizon - 90) });
  return { zones: z, horizon, groundTop };
}
