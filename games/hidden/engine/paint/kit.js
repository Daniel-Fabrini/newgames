// Small drawing helpers shared by the indoor and outdoor scene painters.
// Everything is drawn in world units on a 2D context that is already scaled.

export const TAU = Math.PI * 2;
export const R = (rnd, a, b) => a + (b - a) * rnd();
export const RI = (rnd, a, b) => Math.floor(R(rnd, a, b + 1));
export const pickR = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ---- colors ----
export function hex(c) {
  const s = c.replace('#', '');
  const n = parseInt(s.length === 3 ? s.replace(/./g, '$&$&') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(c, a = 1) {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
}
export function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export const shade = (c, t) => (t < 0 ? mix(c, '#000000', -t) : mix(c, '#ffffff', t));
export function vary(rnd, c, amt = 0.08) {
  return shade(c, (rnd() - 0.5) * 2 * amt);
}

export function lin(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s, i) => (Array.isArray(s) ? gr.addColorStop(s[0], s[1]) : gr.addColorStop(i / Math.max(1, stops.length - 1), s)));
  return gr;
}
export function rad(g, x, y, r0, r1, stops) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach((s, i) => (Array.isArray(s) ? gr.addColorStop(s[0], s[1]) : gr.addColorStop(i / Math.max(1, stops.length - 1), s)));
  return gr;
}

// ---- shapes ----
export function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export function fillRR(g, x, y, w, h, r, fill) {
  rrect(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}
export function ellipse(g, x, y, rx, ry, fill) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
}
export function circle(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
}
export function poly(g, pts, fill) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
}
export function line(g, x0, y0, x1, y1, color, w = 1) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
}

// Irregular rounded blob.
export function blob(g, x, y, rx, ry, rnd, n = 9, irr = 0.25) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + (rnd() - 0.5) * 2 * irr;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n];
    const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) g.moveTo(mx, my);
    else g.quadraticCurveTo(p[0], p[1], mx, my);
  }
  g.closePath();
}

// Silhouette along the x axis: y(x) = base - amplitude * noise, filled down to `bottom`.
export function ridge(g, x0, x1, base, amp, bottom, rnd, { step = 40, jag = 0.5, smooth = true } = {}) {
  const pts = [];
  let y = base - amp * rnd();
  for (let x = x0 - step; x <= x1 + step; x += step * R(rnd, 0.6, 1.4)) {
    y = base - amp * clamp(lerp(rnd(), (base - y) / Math.max(1, amp), 1 - jag), 0, 1);
    pts.push([x, y]);
  }
  g.beginPath();
  g.moveTo(x0 - step, bottom);
  if (smooth) {
    g.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
  } else {
    for (const p of pts) g.lineTo(p[0], p[1]);
  }
  g.lineTo(x1 + step, bottom);
  g.closePath();
  return pts;
}

// Soft light (additive) spot.
export function glow(g, x, y, r, color, a = 0.5, op = 'lighter') {
  g.save();
  g.globalCompositeOperation = op;
  g.fillStyle = rad(g, x, y, 0, r, [[0, rgba(color, a)], [0.4, rgba(color, a * 0.45)], [1, rgba(color, 0)]]);
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

export function vignette(g, W, H, a = 0.5, color = '#000000', cx = W / 2, cy = H / 2) {
  const r = Math.hypot(W, H) * 0.62;
  g.fillStyle = rad(g, cx, cy, r * 0.45, r, [[0, rgba(color, 0)], [1, rgba(color, a)]]);
  g.fillRect(0, 0, W, H);
}

export function speckle(g, x0, y0, w, h, n, colors, rMin, rMax, rnd, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    const r = R(rnd, rMin, rMax);
    g.beginPath();
    g.arc(x0 + rnd() * w, y0 + rnd() * h, r, 0, TAU);
    g.fill();
  }
  g.restore();
}

// Grass blades.
export function blades(g, x0, y0, w, h, n, colors, len, rnd, alpha = 0.8) {
  g.save();
  g.globalAlpha = alpha;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * w, y = y0 + rnd() * h;
    const k = 0.6 + ((y - y0) / Math.max(1, h)) * 0.8;
    const l = len * k * R(rnd, 0.6, 1.2);
    g.strokeStyle = colors[i % colors.length];
    g.lineWidth = 2.2 * k;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + R(rnd, -4, 4), y - l * 0.6, x + R(rnd, -8, 8), y - l);
    g.stroke();
  }
  g.restore();
}

// Puffy cloud.
export function cloud(g, x, y, s, rnd, color = '#ffffff', shadowC = '#c9d9ee', a = 0.95) {
  g.save();
  g.globalAlpha = a;
  const n = RI(rnd, 4, 7);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const px = x + (i - (n - 1) / 2) * s * 0.42 + R(rnd, -s * 0.1, s * 0.1);
    const r = s * R(rnd, 0.28, 0.48) * (1 - Math.abs(i - (n - 1) / 2) / n);
    parts.push([px, y - r * 0.3, r]);
  }
  for (const [px, py, r] of parts) circle(g, px, py + r * 0.18, r, shadowC);
  for (const [px, py, r] of parts) {
    g.fillStyle = rad(g, px - r * 0.2, py - r * 0.4, r * 0.1, r * 1.1, [color, shade(color, -0.04)]);
    circle(g, px, py, r);
    g.fill();
  }
  g.restore();
}

// Wood planks inside a rect (vertical or horizontal), with grain.
export function planks(g, x, y, w, h, size, colors, rnd, vertical = true, grain = 0.18) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const n = Math.ceil((vertical ? w : h) / size) + 1;
  for (let i = 0; i < n; i++) {
    const c = vary(rnd, pickR(rnd, colors), 0.06);
    const px = vertical ? x + i * size : x;
    const py = vertical ? y : y + i * size;
    const pw = vertical ? size : w;
    const ph = vertical ? h : size;
    g.fillStyle = vertical ? lin(g, px, 0, px + pw, 0, [shade(c, 0.06), c, shade(c, -0.1)]) : lin(g, 0, py, 0, py + ph, [shade(c, 0.06), c, shade(c, -0.1)]);
    g.fillRect(px, py, pw, ph);
    // grain
    g.strokeStyle = rgba(shade(c, -0.35), grain);
    g.lineWidth = 1.4;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      if (vertical) {
        const gx = px + R(rnd, 4, pw - 4);
        g.moveTo(gx, py);
        for (let yy = py; yy <= py + ph; yy += 40) g.lineTo(gx + Math.sin(yy * 0.02 + k) * 3, yy);
      } else {
        const gy = py + R(rnd, 4, ph - 4);
        g.moveTo(px, gy);
        for (let xx = px; xx <= px + pw; xx += 40) g.lineTo(xx, gy + Math.sin(xx * 0.02 + k) * 3);
      }
      g.stroke();
    }
    // knot
    if (rnd() < 0.3) {
      const kx = vertical ? px + pw / 2 : px + R(rnd, 0, pw);
      const ky = vertical ? py + R(rnd, 0, ph) : py + ph / 2;
      ellipse(g, kx, ky, vertical ? 4 : 7, vertical ? 7 : 4, rgba(shade(c, -0.4), 0.35));
    }
    // gap
    g.fillStyle = rgba(shade(c, -0.55), 0.6);
    if (vertical) g.fillRect(px - 1, py, 2, ph);
    else g.fillRect(px, py - 1, pw, 2);
  }
  g.restore();
}

// Bricks / stones / tiles in a rect.
export function bricks(g, x, y, w, h, bw, bh, colors, mortar, rnd, { round = 2, jitter = 0.08, offset = 0.5 } = {}) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = mortar;
  g.fillRect(x, y, w, h);
  let row = 0;
  for (let yy = y; yy < y + h; yy += bh, row++) {
    const off = (row % 2) * bw * offset;
    for (let xx = x - off; xx < x + w; xx += bw) {
      const c = vary(rnd, pickR(rnd, colors), jitter);
      g.fillStyle = lin(g, 0, yy, 0, yy + bh, [shade(c, 0.07), c, shade(c, -0.08)]);
      rrect(g, xx + 2, yy + 2, bw - 4, bh - 4, round);
      g.fill();
    }
  }
  g.restore();
}

export function stripesV(g, x, y, w, h, sw, c1, c2) {
  g.fillStyle = c1;
  g.fillRect(x, y, w, h);
  g.fillStyle = c2;
  for (let xx = x; xx < x + w; xx += sw * 2) g.fillRect(xx, y, sw, h);
}

// Repeating small motif (dots / diamonds / fleurs) used for wallpaper.
export function motif(g, x, y, w, h, step, color, kind = 'diamond') {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = color;
  let row = 0;
  for (let yy = y + step / 2; yy < y + h + step; yy += step, row++) {
    for (let xx = x + (row % 2 ? step / 2 : 0); xx < x + w + step; xx += step) {
      if (kind === 'dot') circle(g, xx, yy, step * 0.08, color);
      else if (kind === 'fleur') {
        ellipse(g, xx, yy - step * 0.12, step * 0.07, step * 0.15, color);
        ellipse(g, xx - step * 0.12, yy + step * 0.02, step * 0.12, step * 0.06, color);
        ellipse(g, xx + step * 0.12, yy + step * 0.02, step * 0.12, step * 0.06, color);
        circle(g, xx, yy + step * 0.12, step * 0.04, color);
      } else poly(g, [xx, yy - step * 0.14, xx + step * 0.1, yy, xx, yy + step * 0.14, xx - step * 0.1, yy], color);
    }
  }
  g.restore();
}

// Shadow cast below a shelf / object onto the wall.
export function softShadow(g, x, y, w, h, a = 0.35) {
  g.fillStyle = lin(g, 0, y, 0, y + h, [rgba('#000000', a), rgba('#000000', 0)]);
  g.fillRect(x, y, w, h);
}
