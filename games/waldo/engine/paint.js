// Drawing primitives for the procedural scene painter. Everything is in world
// units (the painter scales its context once); colours are '#rrggbb' strings.

export function hexRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

export function mixHex(a, b, t) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return '#' + A.map((v, i) => toHex(v + (B[i] - v) * t)).join('');
}

// amt in [-1, 1]: negative darkens, positive lightens.
export function shade(c, amt) {
  return amt >= 0 ? mixHex(c, '#ffffff', amt) : mixHex(c, '#000000', -amt);
}

// Linear gradient from a list of colours spread evenly.
export function lin(g, x0, y0, x1, y1, colors) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  colors.forEach((c, i) => gr.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c));
  return gr;
}

export function rad(g, x, y, r0, r1, colors) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  colors.forEach((c, i) => gr.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c));
  return gr;
}

export function rect(g, x, y, w, h, fill) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}

export function rrPath(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

export function rrFill(g, x, y, w, h, r, fill) {
  rrPath(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

export function poly(g, pts, fill) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

export function ellipse(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

export function circle(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

export function hexA(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Soft round light spot.
export function glow(g, x, y, r, color, alpha = 0.6) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, hexA(color, alpha));
  gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// Soft contact shadow under something standing on the ground.
export function shadowBlob(g, x, y, rx, ry = rx * 0.28, a = 0.28) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = `rgba(20,12,6,${a})`;
  g.fill();
}

// Repeating texture tile. The tile covers `size` world units and is rendered
// at the canvas resolution `res` (canvas px per world unit).
export function makeTex(rnd, kind, base, accent, res = 2.2, size = 128) {
  const px = Math.round(size * res);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const s = res;
  g.fillStyle = base;
  g.fillRect(0, 0, px, px);
  const n = Math.round((size * size) / 14);
  const speck = (count, rmin, rmax, col, alpha) => {
    for (let i = 0; i < count; i++) {
      const x = rnd() * px;
      const y = rnd() * px;
      const r = (rmin + rnd() * (rmax - rmin)) * s;
      g.globalAlpha = alpha * (0.5 + rnd() * 0.5);
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  if (kind === 'sand') {
    speck(n * 2, 0.4, 1.1, accent, 0.5);
    speck(n / 2, 0.5, 1.4, shade(base, -0.12), 0.45);
    speck(n / 3, 0.5, 1.2, shade(base, 0.14), 0.4);
  } else if (kind === 'snow') {
    speck(n * 1.5, 0.4, 1.2, accent, 0.7);
    speck(n / 3, 0.6, 1.6, shade(base, -0.1), 0.35);
  } else if (kind === 'grass') {
    speck(n * 2, 0.3, 0.9, accent, 0.55);
    g.strokeStyle = accent;
    g.lineWidth = 0.8 * s;
    for (let i = 0; i < n / 2; i++) {
      const x = rnd() * px;
      const y = rnd() * px;
      g.globalAlpha = 0.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 6 * s, y - (2 + rnd() * 4) * s);
      g.stroke();
    }
    g.globalAlpha = 1;
  } else if (kind === 'stone' || kind === 'cobble') {
    const cell = kind === 'stone' ? 32 : 22;
    g.strokeStyle = shade(base, -0.3);
    g.lineWidth = 1.4 * s;
    for (let row = 0; row * cell < size + cell; row++) {
      const off = row % 2 ? cell / 2 : 0;
      for (let col = -1; col * cell < size + cell; col++) {
        const x = (col * cell + off) * s;
        const y = row * cell * s;
        const jit = (rnd() - 0.5) * 0.12;
        g.fillStyle = shade(base, jit);
        g.fillRect(x + 0.7 * s, y + 0.7 * s, (cell - 1.4) * s, (cell - 1.4) * s);
        g.strokeRect(x, y, cell * s, cell * s);
      }
    }
    speck(n / 2, 0.3, 0.9, accent, 0.35);
  } else if (kind === 'wood') {
    for (let y = 0; y < px; y += 14 * s) {
      g.fillStyle = shade(base, (rnd() - 0.5) * 0.14);
      g.fillRect(0, y, px, 14 * s);
      g.strokeStyle = shade(base, -0.25);
      g.lineWidth = 1 * s;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(px, y);
      g.stroke();
      g.strokeStyle = hexA(accent, 0.25);
      for (let k = 0; k < 3; k++) {
        const gy = y + (3 + rnd() * 9) * s;
        g.beginPath();
        g.moveTo(0, gy);
        g.bezierCurveTo(px * 0.3, gy + rnd() * 3 * s, px * 0.6, gy - rnd() * 3 * s, px, gy);
        g.stroke();
      }
    }
  } else if (kind === 'water') {
    g.strokeStyle = accent;
    g.lineWidth = 1.2 * s;
    for (let i = 0; i < n / 2; i++) {
      const x = rnd() * px;
      const y = rnd() * px;
      g.globalAlpha = 0.35 + rnd() * 0.3;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 5 * s, y - 2 * s, x + 10 * s, y);
      g.stroke();
    }
    g.globalAlpha = 1;
  } else if (kind === 'tile') {
    const cell = 16;
    for (let row = 0; row * cell * s < px; row++) {
      for (let col = 0; col * cell * s < px; col++) {
        g.fillStyle = (row + col) % 2 ? accent : base;
        g.fillRect(col * cell * s, row * cell * s, cell * s, cell * s);
      }
    }
  } else {
    speck(n, 0.4, 1, accent, 0.4);
  }
  return c;
}

// Fills a rectangle with a repeating texture (tile -> world units).
export function fillTex(g, x, y, w, h, tex, res = 2.2, size = 128) {
  const pat = g.createPattern(tex, 'repeat');
  if (pat.setTransform) pat.setTransform(new DOMMatrix([1 / res, 0, 0, 1 / res, 0, 0]));
  g.fillStyle = pat;
  g.fillRect(x, y, w, h);
  return size;
}

// Scattered little dots (grass tufts, pebbles, confetti) for extra richness.
export function speckle(g, rnd, x, y, w, h, count, colors, rmin = 0.5, rmax = 1.5, alpha = 0.7) {
  for (let i = 0; i < count; i++) {
    g.globalAlpha = alpha * (0.4 + rnd() * 0.6);
    g.fillStyle = colors[(rnd() * colors.length) | 0];
    g.beginPath();
    g.arc(x + rnd() * w, y + rnd() * h, rmin + rnd() * (rmax - rmin), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

// Facade of a building: gradient body, cornice, roof line and a window grid.
export function facade(g, rnd, x, y, w, h, base, o = {}) {
  g.fillStyle = lin(g, x, 0, x + w, 0, [shade(base, -0.16), base, shade(base, 0.04), shade(base, -0.1)]);
  g.fillRect(x, y, w, h);
  rect(g, x - 4, y - 7, w + 8, 9, shade(base, -0.28));
  rect(g, x - 4, y + 2, w + 8, 2, shade(base, 0.2));
  if (o.roof) rect(g, x - 8, y - 12, w + 16, 6, o.roof);
  if (o.windows !== false) windowGrid(g, rnd, x, y + 14, w, h - 26, o);
  if (o.door) door(g, x + w * o.door.at, y + h - (o.door.h || 34), o.door.w || 18, o.door.h || 34, o.door.c || '#3b2415');
}

export function windowGrid(g, rnd, x, y, w, h, o = {}) {
  const cw = o.cw || 18;
  const ch = o.ch || 24;
  const cols = Math.max(1, Math.floor((w - 8) / (cw + 10)));
  const rows = Math.max(1, Math.floor((h - 6) / (ch + 12)));
  const gx = (w - cols * cw) / (cols + 1);
  const gy = (h - rows * ch) / (rows + 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + gx + c * (cw + gx);
      const wy = y + gy + r * (ch + gy);
      if (o.skipDoor && o.door && Math.abs(wx + cw / 2 - (x + w * o.door.at)) < 16 && wy > y + h - 60) continue;
      const lit = rnd() < (o.litChance ?? 0.22);
      windowAt(g, wx, wy, cw, ch, lit, o.frame || '#f2e6cf', o.awnings && rnd() < 0.3 ? o.awnings : null);
    }
  }
}

export function windowAt(g, x, y, w, h, lit, frame = '#f2e6cf', awning = null) {
  rect(g, x - 2, y - 2, w + 4, h + 4, frame);
  g.fillStyle = lit ? lin(g, 0, y, 0, y + h, ['#ffe7a0', '#f5b84a']) : lin(g, 0, y, 0, y + h, ['#34506e', '#152437']);
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(x + w * 0.2, y + h);
  g.lineTo(x + w * 0.55, y);
  g.stroke();
  rect(g, x + w / 2 - 0.7, y, 1.4, h, frame);
  if (awning) {
    stripedAwning(g, x - 4, y - 4, w + 8, 7, awning[0], awning[1], 4);
  }
  rect(g, x - 4, y + h + 2, w + 8, 3, shade(frame, -0.2));
}

export function door(g, x, y, w, h, c) {
  rect(g, x, y, w, h, c);
  rect(g, x + 2, y + 2, w - 4, h - 2, shade(c, 0.1));
  circle(g, x + w - 4, y + h / 2, 1.2, '#f1c75a');
}

// Scalloped striped awning across x..x+w.
export function stripedAwning(g, x, y, w, h, c1, c2, n = 6) {
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? c2 : c1;
    g.fillRect(x + i * sw, y, sw + 0.5, h);
    g.beginPath();
    g.arc(x + i * sw + sw / 2, y + h, sw / 2, 0, Math.PI);
    g.fill();
  }
  rect(g, x, y - 1, w, 1.4, shade(c1, -0.4));
}

// Round-crowned tree made of overlapping blobs.
export function tree(g, rnd, x, y, r, c, trunk = '#5a3b22') {
  rect(g, x - r * 0.1, y - r * 0.2, r * 0.2, r * 1.2, trunk);
  const blobs = 7;
  for (let i = 0; i < blobs; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.45;
    const bx = x + Math.cos(a) * d;
    const by = y - r * 0.9 + Math.sin(a) * d * 0.7;
    circle(g, bx, by, r * (0.38 + rnd() * 0.22), shade(c, -0.18 + rnd() * 0.12));
  }
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.4;
    circle(g, x + Math.cos(a) * d - r * 0.12, y - r * 1.05 + Math.sin(a) * d * 0.6, r * 0.2, shade(c, 0.12 + rnd() * 0.1));
  }
}

export function pine(g, x, y, h, c) {
  rect(g, x - 2, y - h * 0.12, 4, h * 0.14, '#4a2f1b');
  for (let i = 0; i < 4; i++) {
    const top = y - h + i * h * 0.2;
    const wdt = h * (0.2 + i * 0.09);
    poly(g, [[x, top], [x + wdt / 2, top + h * 0.32], [x - wdt / 2, top + h * 0.32]], shade(c, -0.06 * i));
  }
}

export function palm(g, rnd, x, y, h, c = '#7a5230', leaf = '#3f9b53') {
  g.strokeStyle = c;
  g.lineWidth = Math.max(2.5, h * 0.05);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + h * 0.15, y - h * 0.5, x + h * 0.05, y - h);
  g.stroke();
  const tx = x + h * 0.05;
  const ty = y - h;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5 + (rnd() - 0.5) * 0.2;
    const len = h * (0.36 + rnd() * 0.1);
    g.strokeStyle = shade(leaf, (rnd() - 0.5) * 0.2);
    g.lineWidth = h * 0.07;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - len * 0.2, tx + Math.cos(a) * len, ty + Math.sin(a) * len + len * 0.35);
    g.stroke();
  }
  g.lineCap = 'butt';
}

// Bunting strung between two points with a sag.
export function bunting(g, x0, y0, x1, y1, sag, colors, n = 14, flag = 7) {
  g.strokeStyle = 'rgba(40,30,20,0.6)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  g.stroke();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1;
    const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
    poly(g, [[bx - flag * 0.5, by], [bx + flag * 0.5, by], [bx, by + flag * 1.2]], colors[i % colors.length]);
  }
}

export function lamp(g, x, y, h, c = '#2b2b30', light = '#ffe2a0') {
  rect(g, x - 1.6, y - h, 3.2, h, c);
  rect(g, x - 5, y - h - 2, 10, 3, c);
  glow(g, x, y - h + 2, 40, light, 0.35);
  circle(g, x, y - h + 4, 3, light);
}

export function crate(g, x, y, w, h, c) {
  rrFill(g, x, y - h, w, h, 2, c);
  g.strokeStyle = shade(c, -0.3);
  g.lineWidth = 1.2;
  g.strokeRect(x + 2, y - h + 2, w - 4, h - 4);
  g.beginPath();
  g.moveTo(x + 2, y - h + 2);
  g.lineTo(x + w - 2, y - 2);
  g.stroke();
}

export function barrel(g, x, y, r, c) {
  ellipse(g, x, y, r, r * 0.3, shade(c, -0.25));
  rrFill(g, x - r, y - r * 2, r * 2, r * 2, r * 0.3, c);
  ellipse(g, x, y - r * 2, r, r * 0.3, shade(c, 0.15));
  g.strokeStyle = 'rgba(30,20,10,0.6)';
  g.lineWidth = 1.2;
  for (const k of [0.4, 1.2, 1.7]) {
    g.beginPath();
    g.moveTo(x - r, y - r * k);
    g.lineTo(x + r, y - r * k);
    g.stroke();
  }
}

export function bench(g, x, y, w, c = '#8a5a2e') {
  shadowBlob(g, x + w / 2, y + 2, w * 0.55, 3, 0.3);
  rect(g, x + 3, y - 10, 3, 10, '#3a2412');
  rect(g, x + w - 6, y - 10, 3, 10, '#3a2412');
  rrFill(g, x, y - 16, w, 4, 1.5, c);
  rrFill(g, x, y - 26, w, 4, 1.5, shade(c, 0.05));
}

export function cloud(g, x, y, s, c = 'rgba(255,255,255,0.8)') {
  g.fillStyle = c;
  for (const [dx, dy, r] of [[0, 0, 1], [-1.1, 0.3, 0.7], [1.2, 0.2, 0.8], [0.4, -0.6, 0.8], [-0.5, 0.2, 0.6]]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    g.fill();
  }
}

// Distant hills / skyline silhouette: a ridge through the given heights.
export function ridge(g, W, baseY, amp, color, rnd, seg = 12) {
  g.beginPath();
  g.moveTo(0, baseY);
  let y = baseY - amp * rnd();
  for (let x = 0; x <= W + 1; x += W / seg) {
    y = baseY - amp * (0.4 + rnd() * 0.6);
    g.lineTo(x, y);
  }
  g.lineTo(W, baseY + 200);
  g.lineTo(0, baseY + 200);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

export function mountain(g, x, baseY, w, h, c, snow) {
  poly(g, [[x - w / 2, baseY], [x, baseY - h], [x + w / 2, baseY]], c);
  if (snow) {
    poly(g, [[x - w * 0.12, baseY - h * 0.78], [x, baseY - h], [x + w * 0.12, baseY - h * 0.78], [x + w * 0.04, baseY - h * 0.7], [x - w * 0.04, baseY - h * 0.72]], snow);
  }
}

export function sparkle(g, x, y, r, c = '#fff6d0') {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

// Warm light wash and dark vignette over the whole finished scene.
export function finish(g, W, H, warm = '#ffb347', warmA = 0.1) {
  g.fillStyle = lin(g, 0, 0, W, H, [hexA(warm, warmA), hexA(warm, 0), hexA('#1a0c04', 0.05)]);
  g.fillRect(0, 0, W, H);
  g.fillStyle = rad(g, W / 2, H * 0.45, W * 0.35, W * 0.85, ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(10,4,0,0.45)']);
  g.fillRect(0, 0, W, H);
}
