// Procedural expedition maps. Deterministic for a given (region, index, seed).
import { REGIONS, COVERS } from './data.js';
import { rng } from '../../js/core/ui.js';

export function makeMap(regionId, n, seed) {
  const reg = REGIONS.find((r) => r.id === regionId);
  const R = rng(seed);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const size = Math.min(13, 6 + Math.floor(n / 2));
  const w = size, h = size;
  const I = (x, y) => y * w + x;

  const sx = Math.floor(w / 2), sy = h - 1;
  const gx = Math.floor(R() * w), gy = 0;

  // Random self-avoiding walk from start to goal (greedy with noise).
  let path = null;
  for (let attempt = 0; attempt < 200 && !path; attempt++) {
    const vis = new Set([I(sx, sy)]);
    const p = [[sx, sy]];
    let cx = sx, cy = sy, steps = 0;
    while ((cx !== gx || cy !== gy) && steps < 400) {
      const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]
        .filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h && !vis.has(I(x, y)));
      if (!nb.length) break;
      const score = ([x, y]) => Math.abs(x - gx) + Math.abs(y - gy) + R() * 2.4;
      nb.sort((a, b) => score(a) - score(b));
      const [nx, ny] = nb[0];
      vis.add(I(nx, ny));
      p.push([nx, ny]);
      cx = nx; cy = ny; steps++;
    }
    if (cx === gx && cy === gy) path = p;
  }
  if (!path) { // fallback: L-shaped path
    path = [];
    for (let x = sx; x !== gx; x += Math.sign(gx - sx)) path.push([x, sy]);
    for (let y = sy; y >= gy; y--) path.push([gx, y]);
  }
  const onPath = new Set(path.map(([x, y]) => I(x, y)));

  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ cover: null, hard: 0, item: null, open: false, goal: false });
  const startI = I(sx, sy), goalI = I(gx, gy);
  tiles[startI].open = true;
  tiles[goalI].goal = true;

  const amount = () => 1 + Math.floor(R() * 2) + Math.floor(n / 6);
  for (let i = 0; i < w * h; i++) {
    if (i === startI) continue;
    const t = tiles[i];
    const pathT = onPath.has(i);
    const coverP = i === goalI ? 0.6 : pathT ? 0.7 : 0.42;
    if (R() < coverP) {
      t.cover = pick(reg.covers);
      t.hard = COVERS[t.cover];
    }
    if (i === goalI) continue;
    const roll = R();
    if (roll < 0.07) {
      t.item = { chest: true, coins: 20 + 8 * n + Math.floor(R() * 20), gems: R() < 0.45 ? 1 + (R() < 0.2 ? 1 : 0) : 0 };
    } else if (roll < (pathT ? 0.3 : 0.22)) {
      const [id] = pick(reg.items);
      t.item = { id, n: amount() };
    }
  }
  // Make sure the item table is actually used for a few guaranteed resources.
  const [firstId] = reg.items[0];
  const spot = Math.floor(R() * w * h);
  if (!tiles[spot].item && spot !== startI && spot !== goalI) tiles[spot].item = { id: firstId, n: amount() };

  return { w, h, tiles, start: startI, goal: goalI, sx, sy, gx, gy, region: regionId, n };
}
