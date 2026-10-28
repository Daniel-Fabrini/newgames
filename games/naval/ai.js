// Sea Battle — computer admirals. They only see what a human would see
// (misses, hits, sunk ships) through rules.knowledge().
//   easy     random shots
//   medium   hunt (random) / target (finish what it hit, following the line)
//   hard     probability-density map of every remaining ship + parity hunting
//   admiral  hard + exploits the ship-size/no-touch rules and the player's
//            placement habits learned over previous battles

import { N, CELLS, neighbors8 } from './rules.js';

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

function unknownCells(grid) {
  const out = [];
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0) out.push(i);
  return out;
}

// Medium: cells next to unsunk hits, extending lines of 2+ hits first.
function targetCells(grid) {
  const isHit = (r, c) => r >= 0 && r < N && c >= 0 && c < N && grid[r * N + c] === 2;
  const isFree = (r, c) => r >= 0 && r < N && c >= 0 && c < N && grid[r * N + c] === 0;
  const line = new Set();
  const adj = new Set();
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 2) continue;
    const r = (i / N) | 0;
    const c = i % N;
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ]) {
      if (isHit(r + dr, c + dc) || isHit(r - dr, c - dc)) {
        let rr = r;
        let cc = c;
        while (isHit(rr + dr, cc + dc)) (rr += dr), (cc += dc);
        if (isFree(rr + dr, cc + dc)) line.add((rr + dr) * N + cc + dc);
        rr = r;
        cc = c;
        while (isHit(rr - dr, cc - dc)) (rr -= dr), (cc -= dc);
        if (isFree(rr - dr, cc - dc)) line.add((rr - dr) * N + cc - dc);
      }
    }
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ])
      if (isFree(r + dr, c + dc)) adj.add((r + dr) * N + c + dc);
  }
  return line.size ? [...line] : [...adj];
}

// Probability density: how many legal placements of the remaining ships cover
// each unknown cell. In target mode only placements through current hits count.
export function densityMap(K, opts = {}) {
  const { grid, remaining, touch } = K;
  const smart = !!opts.smart;
  const blocked = new Uint8Array(CELLS);
  for (let i = 0; i < CELLS; i++) if (grid[i] === 1 || grid[i] === 3 || grid[i] === 4) blocked[i] = 1;
  // nearHit[i] = 1 when a cell touches an unsunk hit (used for no-touch logic)
  const hitNear = new Uint8Array(CELLS);
  if (smart && !touch) {
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] === 3) for (const j of neighbors8(i)) if (grid[j] === 0) blocked[j] = 1;
      if (grid[i] === 2) {
        const r = (i / N) | 0;
        const c = i % N;
        for (const [dr, dc] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < N && cc >= 0 && cc < N && grid[rr * N + cc] === 0) blocked[rr * N + cc] = 1;
        }
        for (const j of neighbors8(i)) hitNear[j] = 1;
      }
    }
  }
  let hits = 0;
  for (let i = 0; i < CELLS; i++) if (grid[i] === 2) hits++;
  const target = hits > 0 && !opts.ignoreHits;
  const dens = new Float64Array(CELLS);
  const sizes = {};
  for (const L of remaining) sizes[L] = (sizes[L] || 0) + 1;
  for (const key of Object.keys(sizes)) {
    const L = +key;
    const mult = sizes[key];
    for (let dir = 0; dir < 2; dir++) {
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (dir === 0 ? c + L > N : r + L > N) continue;
          let ok = true;
          let hc = 0;
          const cells = [];
          for (let k = 0; k < L; k++) {
            const i = dir === 0 ? r * N + c + k : (r + k) * N + c;
            if (blocked[i]) {
              ok = false;
              break;
            }
            if (grid[i] === 2) hc++;
            cells.push(i);
          }
          if (!ok) continue;
          if (target && hc === 0) continue;
          if (smart && !touch) {
            // A ship may not touch a hit that is not part of it.
            let bad = false;
            for (const i of cells) {
              if (!hitNear[i] || grid[i] === 2) continue;
              for (const j of neighbors8(i)) if (grid[j] === 2 && !cells.includes(j)) bad = true;
              if (bad) break;
            }
            if (bad) continue;
          }
          const w = mult * (target ? Math.pow(10, hc) : 1);
          for (const i of cells) if (grid[i] === 0) dens[i] += w;
        }
    }
  }
  return dens;
}

function bestOf(dens, cand, rnd) {
  let best = -1;
  for (const i of cand) best = Math.max(best, dens[i]);
  if (best <= 0) return -1;
  const top = cand.filter((i) => dens[i] >= best * 0.999);
  return pick(top, rnd);
}

export function aiShot(level, K, rnd = Math.random, habits = null) {
  const unknown = unknownCells(K.grid);
  if (!unknown.length) return -1;
  if (level === 'easy') return pick(unknown, rnd);
  const hasHits = K.grid.some((v) => v === 2);
  if (level === 'medium') {
    if (hasHits) {
      const t = targetCells(K.grid);
      if (t.length) return pick(t, rnd);
    }
    return pick(unknown, rnd);
  }
  const smart = level === 'admiral';
  let dens = densityMap(K, { smart });
  let target = hasHits;
  if (hasHits && !unknown.some((i) => dens[i] > 0)) {
    dens = densityMap(K, { smart, ignoreHits: true });
    target = false;
  }
  if (!target) {
    if (smart && habits) for (const i of unknown) dens[i] *= 1 + 0.45 * (habits[i] || 0);
    // Parity: the smallest ship left always covers one cell of each colour class.
    const m = Math.min(...K.remaining);
    if (m > 1) {
      const sums = new Float64Array(m);
      for (const i of unknown) sums[(((i / N) | 0) + (i % N)) % m] += dens[i];
      let off = 0;
      for (let k = 1; k < m; k++) if (sums[k] > sums[off]) off = k;
      const par = unknown.filter((i) => (((i / N) | 0) + (i % N)) % m === off);
      const choice = bestOf(dens, par, rnd);
      if (choice >= 0) return choice;
    }
  }
  const choice = bestOf(dens, unknown, rnd);
  return choice >= 0 ? choice : pick(unknown, rnd);
}

// Updates the learned map of where this player likes to put ships (0..1 per cell).
export function learnHabits(habits, ships, cellsOf) {
  const h = Array.isArray(habits) && habits.length === CELLS ? habits.slice() : new Array(CELLS).fill(0);
  const occ = new Uint8Array(CELLS);
  for (const s of ships) for (const i of cellsOf(s)) occ[i] = 1;
  for (let i = 0; i < CELLS; i++) h[i] = Math.round((h[i] * 0.8 + occ[i] * 0.2) * 1000) / 1000;
  return h;
}
