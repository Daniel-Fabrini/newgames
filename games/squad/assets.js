// Loads the Blender-rendered sprite atlases (assets/*.webp + atlas.js) once and
// prepares derived images: tinted enemy variants and per-theme rock/road copies.

import { ATLAS } from './atlas.js';

let promise = null;

function loadImg(name) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('asset ' + name));
    im.src = new URL(`./assets/${name}.webp`, import.meta.url).href;
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Copy of `im` drawn through a CSS filter (falls back to a manual tint where
// ctx.filter is unsupported).
export function filtered(im, filter, fallbackTint) {
  const c = canvas(im.width, im.height);
  const g = c.getContext('2d');
  const can = filter && filter !== 'none' && typeof g.filter === 'string';
  if (can) g.filter = filter;
  g.drawImage(im, 0, 0);
  if (can) g.filter = 'none';
  else if (fallbackTint) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = fallbackTint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

export function loadAssets() {
  if (promise) return promise;
  promise = Promise.all(['units', 'heroes', 'props', 'rocks', 'road'].map(loadImg)).then(([units, heroes, props, rocks, road]) => {
    const A = { F: ATLAS, img: { units, heroes, props, rocks, road }, themeCache: new Map() };
    // enemy colour variants (orange runners, black elites)
    A.img.unitsOrg = filtered(units, 'hue-rotate(28deg) saturate(1.25) brightness(1.08)', 'rgba(255,140,0,.35)');
    A.img.unitsBlk = filtered(units, 'saturate(0.35) brightness(0.48) contrast(1.2)', 'rgba(20,20,30,.55)');
    return A;
  });
  promise.catch(() => {
    promise = null;
  });
  return promise;
}

// Per-theme rock atlas + road texture (cached).
export function themed(A, th) {
  let t = A.themeCache.get(th.id);
  if (t) return t;
  const rocks = th.rock && th.rock !== 'none' ? filtered(A.img.rocks, th.rock) : A.img.rocks;
  const r = A.img.road;
  // two tiles side by side: the road is ~10 m wide, the tile 7 m
  const road = canvas(r.width * 2, r.height);
  const g = road.getContext('2d');
  g.drawImage(r, 0, 0);
  g.drawImage(r, r.width, 0);
  const [cr, cg, cb] = th.road;
  // retint: multiply by theme colour relative to the base concrete colour
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${Math.min(255, Math.round((cr / 204) * 255))},${Math.min(255, Math.round((cg / 192) * 255))},${Math.min(255, Math.round((cb / 174) * 255))})`;
  g.fillRect(0, 0, road.width, road.height);
  g.globalCompositeOperation = 'source-over';
  t = { rocks, road };
  A.themeCache.set(th.id, t);
  return t;
}
