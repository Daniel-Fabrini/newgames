// Rendered scenes: loading (photo + hit data), hit testing against the
// per-object outline polygons, and seeded target selection.
//
// Scene data (scenes/<id>.json, written by build3d/post.py):
//   { id, w, h, img, prev, items: [{ k: name key, a: asset key, b: [x, y, w, h],
//     n: visible px, v: visible fraction, t: 1 if it can be a target, p: [[x0, y0, x1, y1, …], …] }] }

import { NAMES } from '../scenes/names.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();

export const sceneUrl = (file) => new URL(`../scenes/${file}`, import.meta.url).href;
export const thumbUrl = (asset) => sceneUrl(`thumbs/${asset.replace('/', '__')}.webp`);
export const nameOf = (k, lang) => (NAMES[k] && (NAMES[k][lang] || NAMES[k].en)) || k;

function prepare(data) {
  for (const it of data.items) {
    it.polys = it.p.map((p) => Float32Array.from(p));
    // centroid of the biggest outline (area weighted)
    let best = null, bestA = -1;
    for (const p of it.polys) {
      let a = 0, cx = 0, cy = 0;
      for (let i = 0, n = p.length; i < n; i += 2) {
        const j = (i + 2) % n;
        const f = p[i] * p[j + 1] - p[j] * p[i + 1];
        a += f;
        cx += (p[i] + p[j]) * f;
        cy += (p[i + 1] + p[j + 1]) * f;
      }
      if (Math.abs(a) > bestA) {
        bestA = Math.abs(a);
        best = a ? { x: cx / (3 * a), y: cy / (3 * a) } : { x: p[0], y: p[1] };
      }
    }
    it.c = best && insideAny(it, best.x, best.y) ? best : { x: it.b[0] + it.b[2] / 2, y: it.b[1] + it.b[3] / 2 };
    if (!insideAny(it, it.c.x, it.c.y)) {
      // concave outline: use a vertex pulled slightly inwards
      const p = it.polys[0];
      it.c = { x: (p[0] * 3 + it.b[0] + it.b[2] / 2) / 4, y: (p[1] * 3 + it.b[1] + it.b[3] / 2) / 4 };
    }
    it.s = Math.max(it.b[2], it.b[3]);
    it.ease = clamp((Math.log(it.n) - Math.log(400)) / (Math.log(24000) - Math.log(400)), 0, 1) * 0.75 + clamp(it.v, 0, 1) * 0.25;
  }
  const groups = new Map();
  for (const it of data.items) {
    if (!groups.has(it.k)) groups.set(it.k, { k: it.k, items: [], pick: [] });
    const g = groups.get(it.k);
    g.items.push(it);
    if (it.t) g.pick.push(it);
  }
  for (const g of groups.values()) {
    g.pick.sort((a, b) => b.n - a.n);
    g.ease = g.pick.length ? g.pick[0].ease : 0;
  }
  data.groups = groups;
  return data;
}

export async function loadScene(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const p = (async () => {
    const res = await fetch(sceneUrl(`${def.id}.json`));
    if (!res.ok) throw new Error(`scene ${def.id}: ${res.status}`);
    const data = prepare(await res.json());
    const img = new Image();
    img.decoding = 'async';
    img.src = sceneUrl(data.img);
    await img.decode();
    return { def, data, img };
  })();
  cache.set(def.id, p);
  p.catch(() => cache.delete(def.id));
  // keep memory small: only the two most recent scenes
  while (cache.size > 2) cache.delete(cache.keys().next().value);
  return p;
}

// ---------------------------------------------------------------- geometry
function insidePoly(p, x, y) {
  let ins = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

export function insideAny(it, x, y) {
  const b = it.b;
  if (x < b[0] - 1 || y < b[1] - 1 || x > b[0] + b[2] + 1 || y > b[1] + b[3] + 1) return false;
  for (const p of it.polys) if (insidePoly(p, x, y)) return true;
  return false;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distTo(it, x, y) {
  if (insideAny(it, x, y)) return 0;
  const b = it.b;
  const out = Math.max(b[0] - x, 0, x - b[0] - b[2]) + Math.max(b[1] - y, 0, y - b[1] - b[3]);
  if (out > 400) return out;
  let d = Infinity;
  for (const p of it.polys) {
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) d = Math.min(d, segDist(x, y, p[j], p[j + 1], p[i], p[i + 1]));
  }
  return d;
}

export function tracePath(g, it) {
  g.beginPath();
  for (const p of it.polys) {
    g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.closePath();
  }
}

// ---------------------------------------------------------------- targets
// Picks `count` distinct target names. Early levels favour big, fully
// visible objects; as d (0..1) grows, smaller and more hidden ones come in.
export function pickGoals(data, { count, need = 1, d = 0, rnd, avoid = new Set(), lang = 'pt' }) {
  const mu = 0.85 - 0.62 * d;
  const pool = [];
  for (const g of data.groups.values()) {
    if (!g.pick.length || !NAMES[g.k]) continue;
    if (need > 1 && g.items.filter((it) => it.n >= 160).length < need) continue;
    let w = Math.exp(-((g.ease - mu) ** 2) / (2 * 0.22 * 0.22)) + 0.04;
    if (avoid.has(g.k)) w *= 0.15;
    pool.push({ g, w });
  }
  const out = [];
  while (out.length < count && pool.length) {
    let tot = 0;
    for (const e of pool) tot += e.w;
    let r = rnd() * tot;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r <= 0) break;
    }
    out.push(pool.splice(i, 1)[0].g);
  }
  return out.map((g) => {
    // the icon shows the most visible instance; any instance of the name counts
    const shown = g.pick[0];
    return {
      k: g.k,
      name: nameOf(g.k, lang),
      need,
      found: 0,
      shown: 0,
      items: need > 1 ? g.items.filter((it) => it.n >= 160) : g.items,
      main: shown,
      thumb: thumbUrl(shown.a),
    };
  });
}
