// Shared scenery helpers for the theme painters. An "item" is anything drawn in
// depth order among the people: { y, draw(g), bb? }. Items with a `bb` box are
// obstacles: the character is never placed under them.

import {
  lin,
  rect,
  rrFill,
  poly,
  ellipse,
  circle,
  glow,
  shade,
  palm,
  tree,
  pine,
  lamp,
  crate,
  barrel,
  bench,
  stripedAwning,
  facade,
  windowAt,
  shadowBlob,
  mountain,
  cloud,
  hexA,
  sparkle,
} from './paint.js';

export const item = (y, draw, bb = null) => ({ y, draw, bb });

export function sky(g, W, top, bottom, h) {
  rect(g, 0, 0, W, h, lin(g, 0, 0, 0, h, [top, bottom]));
}

export function sunGlow(g, x, y, r, core = '#fff6d6', col = '#fff0b0') {
  glow(g, x, y, r * 3.2, col, 0.5);
  circle(g, x, y, r, core);
}

export function clouds(g, rnd, n, x0, x1, y0, y1, s0 = 40, s1 = 80, a = 0.85) {
  for (let i = 0; i < n; i++) {
    cloud(g, x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), s0 + rnd() * (s1 - s0), `rgba(255,255,255,${a * (0.6 + rnd() * 0.4)})`);
  }
}

export function hillRow(g, rnd, W, baseY, amp, colors, n = 6) {
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W * 1.1 - W * 0.05;
    const h = amp * (0.6 + rnd() * 0.6);
    mountain(g, x, baseY, W * (0.32 + rnd() * 0.2), h, colors[i % colors.length]);
  }
}

// A row of facades along a baseline (background buildings).
export function facadeRow(g, rnd, x0, x1, baseY, hMin, hMax, palette, o = {}) {
  let x = x0;
  while (x < x1) {
    const w = 90 + rnd() * 120;
    const h = hMin + rnd() * (hMax - hMin);
    const base = palette[(rnd() * palette.length) | 0];
    facade(g, rnd, x, baseY - h, Math.min(w, x1 - x), h, base, {
      roof: o.roof ? o.roof[(rnd() * o.roof.length) | 0] : null,
      litChance: o.litChance ?? 0.25,
      frame: o.frame,
      cw: o.cw,
      ch: o.ch,
    });
    x += w + 6;
  }
}

export function treeRow(g, rnd, x0, x1, baseY, r0, r1, colors, trunk) {
  for (let x = x0; x < x1; x += (r0 + r1) * 0.7 + rnd() * 40) {
    const r = r0 + rnd() * (r1 - r0);
    tree(g, rnd, x, baseY, r, colors[(rnd() * colors.length) | 0], trunk);
  }
}

// Items (obstacles) ---------------------------------------------------------

export function palmItem(rnd, x, y, h, leaf = '#3f9b53') {
  return item(y, (g) => palm(g, rnd, x, y, h, '#7a5230', leaf), { x0: x - h * 0.26, x1: x + h * 0.26, y0: y - h - h * 0.1, y1: y });
}

export function treeItem(rnd, x, y, r, c, trunk) {
  return item(y, (g) => tree(g, rnd, x, y, r, c, trunk), { x0: x - r * 0.7, x1: x + r * 0.7, y0: y - r * 2.2, y1: y });
}

export function pineItem(rnd, x, y, h, c) {
  return item(y, (g) => pine(g, x, y, h, c), { x0: x - h * 0.22, x1: x + h * 0.22, y0: y - h, y1: y });
}

export function lampItem(x, y, h, c, light) {
  return item(y, (g) => lamp(g, x, y, h, c, light), { x0: x - 6, x1: x + 6, y0: y - h - 4, y1: y });
}

export function parasolItem(x, y, r, c1, c2, pole = 118) {
  const top = y - pole;
  return item(
    y,
    (g) => {
      shadowBlob(g, x, y + 2, r * 1.1, r * 0.25, 0.3);
      rect(g, x - 1.6, top, 3.2, pole, '#e9e3d5');
      g.beginPath();
      g.ellipse(x, top + 2, r, r * 0.42, 0, Math.PI, Math.PI * 2);
      g.fillStyle = c1;
      g.fill();
      const n = 6;
      for (let i = 0; i < n; i++) {
        if (i % 2) continue;
        const a0 = Math.PI + (i / n) * Math.PI;
        const a1 = Math.PI + ((i + 1) / n) * Math.PI;
        g.beginPath();
        g.moveTo(x, top + 2);
        g.ellipse(x, top + 2, r, r * 0.42, 0, a0, a1);
        g.closePath();
        g.fillStyle = c2;
        g.fill();
      }
      circle(g, x, top, 2.2, '#f3e7c8');
    },
    { x0: x - r, x1: x + r, y0: top - r * 0.5, y1: y },
  );
}

// Market / food stall: striped awning on two posts with a counter.
export function stallItem(x, y, w, c1, c2, goods = []) {
  const top = y - 92;
  return item(
    y,
    (g) => {
      shadowBlob(g, x + w / 2, y + 2, w * 0.6, 4, 0.3);
      rect(g, x + 5, top + 12, 4, 80, '#4b2e18');
      rect(g, x + w - 9, top + 12, 4, 80, '#4b2e18');
      rect(g, x, y - 40, w, 8, '#7b4c28');
      rect(g, x + 2, y - 32, w - 4, 32, shade('#7b4c28', -0.12));
      for (let i = 0; i < goods.length; i++) {
        const gx = x + 12 + i * ((w - 24) / Math.max(1, goods.length - 1));
        circle(g, gx, y - 44, 5, goods[i]);
        circle(g, gx - 1.4, y - 45.8, 1.4, 'rgba(255,255,255,0.5)');
      }
      stripedAwning(g, x - 6, top, w + 12, 16, c1, c2, Math.max(4, Math.round(w / 22)));
      rect(g, x - 6, top + 14, w + 12, 2, 'rgba(0,0,0,0.2)');
    },
    { x0: x - 6, x1: x + w + 6, y0: top, y1: y },
  );
}

export function barrelItem(x, y, r, c) {
  return item(y, (g) => barrel(g, x, y, r, c), { x0: x - r, x1: x + r, y0: y - r * 2, y1: y });
}

export function crateItem(x, y, w, h, c) {
  return item(y, (g) => crate(g, x, y, w, h, c), { x0: x, x1: x + w, y0: y - h, y1: y });
}

export function benchItem(x, y, w, c) {
  return item(y, (g) => bench(g, x, y, w, c), { x0: x, x1: x + w, y0: y - 30, y1: y });
}

// Little wall of flags on a pole (background, no obstacle box).
export function flagsOnPole(g, x, y, h, c, c2) {
  rect(g, x - 1.2, y - h, 2.4, h, '#4a3524');
  poly(g, [[x, y - h], [x + 22, y - h + 5], [x, y - h + 12]], c);
  poly(g, [[x, y - h + 12], [x + 22, y - h + 17], [x, y - h + 24]], c2);
}

export function signBoard(g, x, y, w, h, c, edge = '#f2e6cf') {
  rect(g, x + w / 2 - 2, y, 4, 60, '#3a2a1c');
  rrFill(g, x - 2, y - 2, w + 4, h + 4, 4, edge);
  rrFill(g, x, y, w, h, 3, c);
}

export function gleam(g, x, y, n = 3) {
  for (let i = 0; i < n; i++) sparkle(g, x + i * 10, y - i * 6, 4 + i, '#fff8e0');
}

export { shadowBlob, ellipse, hexA, windowAt, lin };
