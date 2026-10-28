// Scene pipeline: paints a themed background, spawns the crowd (with decoys),
// places the one character where it is unobstructed, and draws everything in
// depth order into one offscreen canvas that the viewer pans and zooms.

import { rng } from '../../../js/core/ui.js';
import { randomPerson, targetPerson, hazePerson, drawPerson, isFullLook, POSE_LIST } from './people.js';
import { finish } from './paint.js';

export const W = 1200;
export const H = 1500;
export const RES = 2.2; // canvas pixels per world unit

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Difficulty knobs, all derived from one level number.
export function levelParams(lvl) {
  const L = Math.max(0, lvl | 0);
  return {
    people: Math.min(880, 470 + L * 13),
    hFar: Math.max(20, 27 - L * 0.25),
    hNear: Math.max(62, 84 - L * 0.7),
    targetMin: Math.max(44, 60 - L * 0.8),
  };
}

const boxOf = (x, y, h) => ({ x0: x - 0.3 * h, x1: x + 0.3 * h, y0: y - 1.14 * h, y1: y + 1 });
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function pickZone(zones, rnd, filter = () => true) {
  const list = zones.filter(filter);
  const total = list.reduce((s, z) => s + (z.w ?? 1) * (z.x1 - z.x0) * (z.y1 - z.y0), 0);
  let r = rnd() * total;
  for (const z of list) {
    r -= (z.w ?? 1) * (z.x1 - z.x0) * (z.y1 - z.y0);
    if (r <= 0) return z;
  }
  return list[list.length - 1];
}

// theme: { id, caption, horizon, front, paint(g, rnd, W, H) -> scene }
// scene: { zones, items: [{ y, bb?, draw(g) }], overlay: [{ draw(g) }], pal, haze, warm, skis? }
export function buildScene(theme, seed, lvl) {
  const P = levelParams(lvl);
  const rnd = rng(seed);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * RES);
  canvas.height = Math.round(H * RES);
  const g = canvas.getContext('2d');
  g.scale(RES, RES);

  const sc = theme.paint(g, rnd, W, H, RES);
  const depthAt = (y) => clamp((y - theme.horizon) / (theme.front - theme.horizon), 0, 1);

  // ---- crowd ----
  const people = [];
  for (let i = 0; i < P.people; i++) {
    const z = pickZone(sc.zones, rnd);
    const x = z.x0 + rnd() * (z.x1 - z.x0);
    const y = z.y0 + rnd() * (z.y1 - z.y0);
    const d = depthAt(y);
    const p = randomPerson(rnd, sc.pal, lvl);
    p.x = x;
    p.y = y;
    p.flip = rnd() < 0.5 ? -1 : 1;
    p.h = lerp(P.hFar, P.hNear, d) * (0.9 + rnd() * 0.2);
    if (sc.skis && rnd() < 0.2) p.skis = true;
    hazePerson(p, (1 - d) * 0.34, sc.haze);
    people.push(p);
  }

  // ---- the one character: unobstructed, mid-depth, never a full decoy look ----
  let target = null;
  for (let t = 0; t < 900 && !target; t++) {
    const z = pickZone(sc.zones, rnd, (zz) => zz.target !== false);
    const x = z.x0 + rnd() * (z.x1 - z.x0);
    const y = z.y0 + rnd() * (z.y1 - z.y0);
    const d = depthAt(y);
    if (d < (t < 600 ? 0.2 : 0.05) || d > 0.95) continue;
    const h = Math.max(P.targetMin * 0.62, lerp(P.hFar, P.hNear, d) * 1.14);
    const bb = boxOf(x, y, h);
    if (bb.x0 < 30 || bb.x1 > W - 30 || bb.y0 < theme.horizon - 40) continue;
    if (sc.items.some((it) => it.bb && overlaps(it.bb, bb))) continue;
    if (sc.overlay.some((it) => it.bb && overlaps(it.bb, bb))) continue;
    target = targetPerson(rnd, POSE_LIST[(rnd() * POSE_LIST.length) | 0]);
    target.x = x;
    target.y = y;
    target.h = h;
    target.flip = rnd() < 0.5 ? -1 : 1;
    hazePerson(target, (1 - d) * 0.2, sc.haze);
    target.bb = bb;
  }
  if (!target) throw new Error('crowd: no room for the character');
  // Clear the crowd around the character so it is never half hidden.
  for (let i = people.length - 1; i >= 0; i--) {
    if (overlaps(boxOf(people[i].x, people[i].y, people[i].h), target.bb)) people.splice(i, 1);
  }
  // Decoys may never repeat the full look.
  for (const p of people) {
    if (isFullLook(p)) p.top = { ...p.top, c: '#2f6fb3', c2: '#fbf7ef' };
  }

  // ---- draw in depth order ----
  const items = [...sc.items];
  for (const p of people) items.push({ y: p.y, draw: (gg) => drawPerson(gg, p) });
  items.push({ y: target.y, draw: (gg) => drawPerson(gg, target) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw(g);
  for (const it of sc.overlay) it.draw(g);
  finish(g, W, H, sc.warm || '#ffc070', 0.12);

  return {
    canvas,
    W,
    H,
    theme: theme.id,
    caption: theme.caption,
    target: { x: target.x, y: target.y, h: target.h, bb: target.bb },
  };
}
