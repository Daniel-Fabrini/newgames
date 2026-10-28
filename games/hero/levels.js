// Ball Hero — level data: 30 hand-made career moments, then seeded
// procedural levels forever; daily challenge and training drills.
//
// Coordinates in meters: x across the pitch (negative = left on screen),
// y = distance from the goal line we attack. `run: [dx, dy]` is a planned
// run (dy < 0 runs toward goal).

import { rng } from '../../js/core/ui.js';
import { solve, explore, SHOTS_QUICK, BOX_Y } from './sim.js';

// Difficulty → AI parameters (d ≈ 0 for the first level, 1 at level 30).
export function diffParams(d) {
  const a = Math.min(1, Math.max(0, d));
  const b = Math.max(0, Math.min(0.8, d - 1));
  return {
    defSpeed: 4.3 + 1.1 * a + 0.4 * b,
    defReact: 0.42 - 0.14 * a - 0.04 * b,
    defReach: 0.8 + 0.08 * a,
    gkSpeed: 3.7 + 1.2 * a + 0.5 * b,
    gkReact: 0.33 - 0.09 * a - 0.03 * b,
    gkReach: 0.74 + 0.08 * a,
    press: 0.55 + 0.55 * a + 0.2 * b,
  };
}

// Hand-made moments. min = match minute, score = [us, them], venue H/A/N.
// goal: 'score' | 'hero' | 'assist'; bonus: list of [kind, n?].
export const HAND = [
  // ---------------- Season 1 — debut club, 4th division
  { story: 'debut', min: 84, score: [0, 0], venue: 'H', goal: 'hero', bonus: [['low'], ['curl']], att: [{ x: -2, y: 14, hero: 1 }], def: [], tut: { plan: { type: 'shot', tx: 2.9, tz: 0.4, curl: 0 } } },
  { min: 78, score: [0, 1], venue: 'A', goal: 'hero', bonus: [['passes', 1], ['top']], ball: 0, att: [{ x: -9, y: 23 }, { x: 3, y: 14, hero: 1 }], def: [{ x: -1, y: 22 }], tut: { plan: { type: 'pass', to: 1, curl: 0 } } },
  { min: 70, score: [1, 1], venue: 'H', goal: 'hero', bonus: [['curl'], ['outside']], att: [{ x: 7, y: 17.5, hero: 1 }], def: [{ x: 6.1, y: 15.1 }], tut: { plan: { type: 'shot', tx: -2.9, tz: 0.6, curl: -0.2 } } },
  { min: 88, score: [0, 0], venue: 'A', goal: 'hero', bonus: [['passes', 1], ['low']], ball: 0, att: [{ x: -7, y: 30 }, { x: 5, y: 15, hero: 1 }], def: [{ x: -1, y: 22.5 }, { x: 10, y: 9 }], tut: { plan: { type: 'pass', to: 1, curl: 0 } } },
  { story: 'firstCross', min: 90, score: [1, 1], venue: 'H', goal: 'hero', bonus: [['air'], ['top']], ball: 0, att: [{ x: -23, y: 12 }, { x: -1, y: 8.5, hero: 1 }], def: [{ x: 2.8, y: 6.2 }, { x: -10, y: 10 }], tut: { plan: { type: 'pass', to: 1, curl: 0 }, first: { type: 'shot', tx: 2.8, tz: 0.5, curl: 0 } } },
  { min: 66, score: [0, 0], venue: 'A', type: 'freekick', goal: 'hero', bonus: [['curl'], ['top']], att: [{ x: -4, y: 21, hero: 1 }], wall: 4, def: [], tut: { plan: { type: 'shot', tx: 2.9, tz: 2.0, curl: 0.15 } } },
  { min: 75, score: [1, 2], venue: 'A', goal: 'score', bonus: [['hero'], ['passes', 2]], ball: 0, att: [{ x: 0, y: 36, hero: 1, run: [2, -16] }, { x: -11, y: 28, run: [5, -14] }, { x: 11, y: 30 }], def: [{ x: -5, y: 24 }, { x: 6, y: 22 }, { x: -1, y: 15 }], tut: { plan: { type: 'pass', to: 1, curl: 0, through: true } } },
  { story: 'penalty', min: 89, score: [0, 0], venue: 'H', type: 'penalty', goal: 'hero', bonus: [['top'], ['curl']], att: [{ x: 0, y: 11.5, hero: 1 }], def: [] },
  { story: 'derby', min: 87, score: [1, 1], venue: 'A', goal: 'hero', bonus: [['passes', 2], ['curl']], att: [{ x: -6, y: 27, hero: 1 }, { x: 6, y: 24 }, { x: -14, y: 17 }], def: [{ x: -4.6, y: 24.6 }, { x: 3, y: 19 }, { x: -9.5, y: 13.5 }, { x: 7, y: 15 }] },
  { story: 'cupFinal1', comp: 'final', min: 92, score: [2, 2], venue: 'N', goal: 'hero', bonus: [['air'], ['passes', 2]], ball: 0, att: [{ x: -3, y: 33 }, { x: -16, y: 20 }, { x: 5, y: 20, hero: 1 }, { x: 14, y: 24 }], def: [{ x: -8, y: 26.5 }, { x: 2, y: 25 }, { x: -12, y: 14 }, { x: 6, y: 16.5 }, { x: 12, y: 18 }] },

  // ---------------- Season 2 — transfer, 2nd division
  { story: 'transfer1', min: 72, score: [0, 0], venue: 'H', goal: 'hero', bonus: [['passes', 2], ['low']], att: [{ x: -3, y: 25, hero: 1, run: [2, -9] }, { x: 5, y: 21 }], def: [{ x: -2.4, y: 22.7 }, { x: 3, y: 14 }, { x: -8, y: 13 }] },
  { story: 'corner', min: 81, score: [0, 1], venue: 'A', type: 'corner', goal: 'score', bonus: [['air'], ['hero']], ball: 0, att: [{ x: -33.5, y: 0.6 }, { x: -1.5, y: 9.5, hero: 1 }, { x: 4, y: 7.5 }, { x: -6, y: 12 }], def: [{ x: -0.6, y: 8 }, { x: 3.2, y: 6 }, { x: -5.2, y: 10.4 }, { x: 1, y: 13 }] },
  { story: 'assist', min: 64, score: [1, 0], venue: 'H', goal: 'assist', bonus: [['curl'], ['passes', 1]], att: [{ x: -14, y: 20, hero: 1 }, { x: 2, y: 10 }, { x: 8, y: 16 }], def: [{ x: -10.5, y: 16.5 }, { x: 3.4, y: 8.4 }, { x: 5, y: 13 }] },
  { min: 85, score: [1, 1], venue: 'A', type: 'freekick', goal: 'hero', bonus: [['top'], ['curl']], att: [{ x: 7, y: 25, hero: 1 }], wall: 5, def: [] },
  { min: 58, score: [0, 0], venue: 'H', goal: 'hero', bonus: [['passes', 3], ['air']], ball: 0, att: [{ x: -20, y: 26 }, { x: -6, y: 20, hero: 1 }, { x: 5, y: 12 }, { x: 16, y: 22 }], def: [{ x: -14, y: 22 }, { x: -4, y: 16 }, { x: 2, y: 9.5 }, { x: 8, y: 17 }, { x: 12, y: 12 }] },
  { story: 'longshot', min: 77, score: [0, 1], venue: 'A', goal: 'hero', bonus: [['outside'], ['curl']], att: [{ x: 1, y: 26, hero: 1 }, { x: -9, y: 20 }, { x: 10, y: 19 }], def: [{ x: -7, y: 16 }, { x: 8, y: 15 }, { x: -1, y: 12.5 }] },
  { min: 70, score: [2, 2], venue: 'H', goal: 'score', bonus: [['hero'], ['passes', 2]], ball: 0, att: [{ x: 0, y: 44, hero: 1, run: [1, -20] }, { x: -13, y: 40, run: [6, -18] }, { x: 12, y: 40, run: [-4, -17] }], def: [{ x: -6, y: 30 }, { x: 5, y: 28 }] },
  { story: 'cupSemi', min: 120, score: [1, 1], venue: 'N', type: 'penalty', goal: 'hero', bonus: [['low'], ['curl']], att: [{ x: 0, y: 11.5, hero: 1 }], def: [], p: { gkReact: 0.2, gkSpeed: 5.0 } },
  { min: 89, score: [0, 0], venue: 'A', goal: 'hero', bonus: [['curl'], ['passes', 1]], att: [{ x: 5, y: 21, hero: 1 }, { x: -5, y: 14 }, { x: 10, y: 12 }], def: [{ x: 4.3, y: 18.4 }, { x: -3, y: 11.5 }, { x: 8.5, y: 9.5 }, { x: 1, y: 9 }, { x: -1, y: 15 }] },
  { story: 'cupFinal2', comp: 'final', min: 90, score: [1, 1], venue: 'N', goal: 'hero', bonus: [['air'], ['passes', 3]], ball: 1, att: [{ x: -24, y: 20 }, { x: -6, y: 25 }, { x: 2, y: 14, hero: 1 }, { x: 12, y: 21 }], def: [{ x: -16, y: 18 }, { x: -4, y: 21 }, { x: 4, y: 11.5 }, { x: -3, y: 9 }, { x: 9, y: 16 }] },

  // ---------------- Season 3 — top flight + national team
  { story: 'bigClub', min: 68, score: [0, 0], venue: 'H', goal: 'hero', bonus: [['passes', 2], ['top']], ball: 0, att: [{ x: 8, y: 30 }, { x: -2, y: 22, hero: 1 }, { x: 14, y: 16 }], def: [{ x: 6, y: 26.5 }, { x: -1, y: 18.5 }, { x: 4, y: 20 }, { x: 11, y: 12 }] },
  { story: 'volley', min: 80, score: [1, 1], venue: 'A', goal: 'hero', bonus: [['air'], ['outside']], ball: 0, att: [{ x: -18, y: 29 }, { x: 2, y: 19, hero: 1 }], def: [{ x: -9, y: 24.5 }, { x: 1, y: 13 }, { x: 6.5, y: 16 }] },
  { min: 93, score: [0, 0], venue: 'H', type: 'freekick', goal: 'hero', bonus: [['top'], ['curl']], att: [{ x: 0.5, y: 19.5, hero: 1 }], wall: 5, def: [] },
  { story: 'callup', comp: 'intl', min: 76, score: [0, 0], venue: 'H', goal: 'hero', bonus: [['passes', 2], ['curl']], ball: 0, att: [{ x: -10, y: 28 }, { x: 4, y: 22, hero: 1 }, { x: 13, y: 17 }], def: [{ x: -5, y: 25 }, { x: 3, y: 19 }, { x: 9, y: 14 }, { x: -3, y: 14 }] },
  { comp: 'intl', min: 88, score: [1, 1], venue: 'A', type: 'corner', goal: 'hero', bonus: [['air'], ['top']], ball: 0, att: [{ x: 33.5, y: 0.6 }, { x: 2, y: 10.5, hero: 1 }, { x: -3, y: 8 }, { x: 6, y: 12 }], def: [{ x: 1, y: 9 }, { x: -2, y: 6.5 }, { x: 5, y: 10.5 }, { x: 3, y: 5 }] },
  { story: 'backClub', min: 83, score: [0, 0], venue: 'A', goal: 'hero', bonus: [['passes', 2], ['low']], ball: 1, att: [{ x: -13, y: 21 }, { x: -1, y: 29, hero: 1, run: [4, -13] }, { x: 12, y: 20 }], def: [{ x: -0.6, y: 26.4 }, { x: -9, y: 17 }, { x: 8.5, y: 16 }, { x: -2, y: 15 }, { x: 6, y: 9 }, { x: -4, y: 9 }] },
  { story: 'shootout', comp: 'cup', min: 120, score: [3, 3], venue: 'N', type: 'penalty', goal: 'hero', bonus: [['top'], ['curl']], att: [{ x: 0, y: 11.5, hero: 1 }], def: [], p: { gkReact: 0.18, gkSpeed: 5.4 } },
  { min: 74, score: [1, 1], venue: 'H', goal: 'score', bonus: [['hero'], ['passes', 3]], ball: 0, att: [{ x: 2, y: 46, hero: 1, run: [-1, -27] }, { x: -14, y: 42, run: [7, -20] }, { x: 14, y: 41, run: [-6, -19] }, { x: -2, y: 38 }], def: [{ x: -7, y: 31 }, { x: 6, y: 30 }, { x: 0, y: 24 }] },
  { story: 'bigDerby', min: 90, score: [2, 2], venue: 'A', goal: 'hero', bonus: [['curl'], ['passes', 3]], ball: 0, att: [{ x: -14, y: 30 }, { x: -2, y: 26 }, { x: 7, y: 21, hero: 1 }, { x: -9, y: 15 }], def: [{ x: -10, y: 27 }, { x: -1, y: 22.5 }, { x: 5, y: 17.5 }, { x: -6, y: 12 }, { x: 2, y: 10 }, { x: 10, y: 14 }] },
  { story: 'titleDecider', comp: 'final', min: 94, score: [1, 1], venue: 'H', goal: 'hero', bonus: [['air'], ['passes', 3]], ball: 0, att: [{ x: 4, y: 34 }, { x: 18, y: 22 }, { x: -6, y: 16, hero: 1 }, { x: -16, y: 24 }], def: [{ x: 8, y: 29 }, { x: 13, y: 18 }, { x: -3, y: 13 }, { x: -9, y: 20 }, { x: 2, y: 20 }, { x: 4, y: 10 }] },
];

export const HAND_COUNT = HAND.length;

export function handLevel(i) {
  const src = HAND[i];
  return { ...src, type: src.type || 'open', idx: i, seed: i * 7 + 3, p: { ...diffParams(i / 29), ...(src.p || {}) } };
}

// ------------------------------------------------------------------ procedural
const TYPES = [
  ['open', 40],
  ['wing', 16],
  ['counter', 12],
  ['freekick', 11],
  ['corner', 9],
  ['oneTwo', 8],
  ['penalty', 4],
];

function pickType(R) {
  const tot = TYPES.reduce((s, x) => s + x[1], 0);
  let r = R() * tot;
  for (const [k, w] of TYPES) {
    if ((r -= w) <= 0) return k;
  }
  return 'open';
}

const rnd = (R, a, b) => a + R() * (b - a);
const rint = (R, a, b) => Math.floor(rnd(R, a, b + 1));

function build(type, R, d) {
  const att = [];
  const def = [];
  const nDef = Math.min(7, 2 + Math.floor(d * 2.6 + R() * 1.4));
  const side = R() < 0.5 ? -1 : 1;
  let L = { type: type === 'wing' || type === 'counter' || type === 'oneTwo' ? 'open' : type, att, def };
  if (type === 'penalty') {
    att.push({ x: 0, y: 11.5, hero: 1 });
    L.goal = 'hero';
    return L;
  }
  if (type === 'freekick') {
    att.push({ x: rnd(R, -9, 9), y: rnd(R, 18.5, 27), hero: 1 });
    L.wall = Math.min(6, 3 + Math.floor(d * 2 + R() * 1.5));
    if (d > 0.6 && R() < 0.5) def.push({ x: side * rnd(R, 7, 12), y: rnd(R, 8, 13) });
    L.goal = 'hero';
    return L;
  }
  if (type === 'corner') {
    att.push({ x: side * 33.5, y: 0.6 });
    const n = 2 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) att.push({ x: rnd(R, -6, 6), y: rnd(R, 7, 13), hero: i === 0 ? 1 : 0 });
    for (let i = 0; i < Math.min(5, nDef); i++) def.push({ x: rnd(R, -7, 7), y: rnd(R, 5.5, 13) });
    L.ball = 0;
    L.goal = R() < 0.6 ? 'hero' : 'score';
    return L;
  }
  if (type === 'counter') {
    att.push({ x: rnd(R, -4, 4), y: rnd(R, 40, 48), hero: 1 });
    att.push({ x: -side * rnd(R, 10, 15), y: rnd(R, 36, 44), run: [side * rnd(R, 3, 8), -rnd(R, 14, 22)] });
    if (R() < 0.6) att.push({ x: side * rnd(R, 10, 15), y: rnd(R, 36, 44), run: [-side * rnd(R, 2, 6), -rnd(R, 12, 20)] });
    for (let i = 0; i < Math.min(4, 1 + Math.floor(nDef * 0.6)); i++) def.push({ x: rnd(R, -9, 9), y: rnd(R, 20, 33) });
    L.ball = 0;
    L.goal = R() < 0.5 ? 'score' : 'hero';
    return L;
  }
  if (type === 'wing') {
    att.push({ x: side * rnd(R, 18, 26), y: rnd(R, 8, 24) });
    att.push({ x: -side * rnd(R, 0, 5), y: rnd(R, 7, 12), hero: 1 });
    if (R() < 0.7) att.push({ x: side * rnd(R, 2, 8), y: rnd(R, 14, 22) });
    for (let i = 0; i < nDef; i++) def.push({ x: rnd(R, -9, 12) * side, y: rnd(R, 5, 20) });
    L.ball = 0;
    L.goal = 'hero';
    return L;
  }
  if (type === 'oneTwo') {
    att.push({ x: rnd(R, -6, 6), y: rnd(R, 22, 28), hero: 1, run: [rnd(R, -2, 2), -rnd(R, 7, 11)] });
    att.push({ x: side * rnd(R, 5, 10), y: rnd(R, 18, 24) });
    const h = att[0];
    def.push({ x: h.x * 0.85, y: h.y - 2.3 });
    for (let i = 1; i < nDef; i++) def.push({ x: rnd(R, -10, 10), y: rnd(R, 6, 17) });
    L.goal = 'hero';
    return L;
  }
  // open play
  const n = 2 + Math.floor(R() * 2.2);
  const carrier = { x: rnd(R, -10, 10), y: rnd(R, 24, 34) };
  att.push(carrier);
  for (let i = 0; i < n; i++) att.push({ x: rnd(R, -15, 15), y: rnd(R, 10, 24), run: R() < 0.25 ? [rnd(R, -4, 4), -rnd(R, 5, 9)] : undefined });
  const heroI = R() < 0.25 ? 0 : 1 + Math.floor(R() * n);
  att[heroI].hero = 1;
  L.ball = 0;
  def.push({ x: carrier.x * 0.9, y: carrier.y - rnd(R, 2.5, 4) });
  for (let i = 1; i < nDef; i++) {
    const m = att[1 + (i % n)];
    if (R() < 0.6) def.push({ x: m.x + rnd(R, -2.5, 2.5), y: m.y - rnd(R, 1.5, 3.5) });
    else def.push({ x: rnd(R, -12, 12), y: rnd(R, 8, 22) });
  }
  L.goal = heroI === 0 ? 'hero' : R() < 0.75 ? 'hero' : 'score';
  return L;
}

function tooClose(L) {
  const all = [...L.att, ...L.def];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) if (Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) < 1.6) return true;
  return false;
}

// Picks two bonus objectives that one successful line of play can satisfy.
function chooseBonus(sol, L, R) {
  const opts = [];
  const combos = sol.combos.map((c) => {
    const [f, p] = c.split('@');
    return { f: new Set(f ? f.split('+') : []), p: +p };
  });
  const minP = sol.minPasses;
  const can = (pred) => combos.some(pred);
  if (L.goal !== 'hero' && can((c) => c.f.has('hero'))) opts.push(['hero']);
  if (can((c) => c.f.has('curl'))) opts.push(['curl']);
  if (can((c) => c.f.has('top'))) opts.push(['top']);
  if (can((c) => c.f.has('low'))) opts.push(['low']);
  if (can((c) => c.f.has('air'))) opts.push(['air']);
  if (can((c) => c.f.has('outside'))) opts.push(['outside']);
  if (minP >= 1) opts.push(['passes', minP]);
  const ok = (a, b) =>
    combos.some((c) => {
      const test = (o) => (o[0] === 'passes' ? c.p <= o[1] : c.f.has(o[0]));
      return test(a) && test(b);
    });
  const pairs = [];
  for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) if (ok(opts[i], opts[j]) && !(opts[i][0] === 'top' && opts[j][0] === 'low')) pairs.push([opts[i], opts[j]]);
  if (pairs.length) return pairs[Math.floor(R() * pairs.length)];
  if (opts.length) return [opts[0], ['passes', Math.max(minP, 1) + 1]];
  return [['passes', minP + 1], ['low']];
}

const genCache = new Map();

// Endless career level n (n ≥ HAND_COUNT) or any seeded challenge.
export function genLevel(seed, d, forceType) {
  const key = seed + ':' + d.toFixed(3) + ':' + (forceType || '');
  if (genCache.has(key)) return genCache.get(key);
  const R = rng(seed * 2654435761 + 97);
  const p = diffParams(d);
  let out = null;
  const first = forceType || pickType(R);
  for (const type of [first, first, 'freekick']) {
    for (let attempt = 0; attempt < 10 && !out; attempt++) {
      const L = build(type, R, d);
      if (tooClose(L)) continue;
      L.p = p;
      const needHero = L.goal === 'hero';
      const maxPasses = type === 'penalty' || type === 'freekick' ? 0 : type === 'corner' || type === 'wing' ? 1 : 2;
      const sol = solve(L, { maxPasses, needHero, shots: SHOTS_QUICK, curls: [-0.2, 0, 0.2], budget: 900, air: true });
      if (!sol.ok) continue;
      // too easy? a direct shot by the carrier shouldn't win open-play moments
      if (d > 0.35 && (type === 'open' || type === 'oneTwo' || type === 'wing') && sol.minPasses === 0) continue;
      sol.combos = explore(L, sol.seq, needHero);
      if (!sol.combos.length) continue;
      if (type === 'freekick') sol.combos = sol.combos.map((c) => c.replace(/\+?outside/, ''));
      L.bonus = chooseBonus(sol, L, R);
      L.minPasses = sol.minPasses;
      L.kind = type;
      out = L;
    }
    if (out) break;
  }
  if (!out) {
    out = { type: 'penalty', kind: 'penalty', att: [{ x: 0, y: 11.5, hero: 1 }], def: [], goal: 'hero', bonus: [['low'], ['curl']], p };
  }
  out.seed = seed;
  out.type = out.type || 'open';
  genCache.set(key, out);
  return out;
}

// Career level i (0-based): hand-made first, then procedural with rising difficulty.
export function careerLevel(i) {
  if (i < HAND_COUNT) return handLevel(i);
  const d = Math.min(1.8, 1 + (i - HAND_COUNT) / 70);
  const L = genLevel(1000 + i * 31, d);
  return { ...L, ...careerMoment(i), idx: i };
}

// Cheap match context (minute, score, venue) without generating the level.
export function careerMoment(i) {
  if (i < HAND_COUNT) {
    const H = HAND[i];
    return { min: H.min, score: H.score, venue: H.venue };
  }
  const k = i % 10;
  return { min: k === 9 ? 88 + (i % 5) : 60 + ((i * 7) % 33), score: k === 9 ? [1, 1] : scoreFor(i), venue: k === 9 ? 'N' : i % 2 ? 'A' : 'H' };
}

export function isGenerated(i) {
  return i < HAND_COUNT || genCache.has(1000 + i * 31 + ':' + Math.min(1.8, 1 + (i - HAND_COUNT) / 70).toFixed(3) + ':');
}

function scoreFor(i) {
  const R = rng(i * 13 + 5);
  const a = Math.floor(R() * 3);
  const b = a + (R() < 0.5 ? 0 : R() < 0.5 ? 1 : -Math.min(a, 1));
  return [a, Math.max(0, b)];
}

// Daily challenge: one special seeded moment per date (YYYYMMDD).
export function dailyLevel(dateKey, progressD = 0.6) {
  const seed = Number(String(dateKey).replace(/\D/g, '')) || 1;
  const R = rng(seed);
  const d = Math.min(1.3, Math.max(0.45, progressD + 0.15));
  const types = ['open', 'wing', 'freekick', 'counter', 'corner', 'oneTwo'];
  const L = genLevel(seed, d, types[Math.floor(R() * types.length)]);
  return { ...L, idx: -1, daily: true, min: 85 + (seed % 9), score: [1, 1], venue: seed % 2 ? 'H' : 'A' };
}

// ------------------------------------------------------------------ training drills
export const DRILLS = ['targets', 'curl', 'header'];

export function drillLevel(kind, ball, seed) {
  const R = rng(seed * 7919 + ball * 104729);
  const p = { ...diffParams(0.35) };
  if (kind === 'targets') {
    const x = rnd(R, -12, 12);
    const y = rnd(R, 13, 24);
    const targets = [
      { x: -2.9, z: 1.85, r: 0.55, pts: 3 },
      { x: 2.9, z: 1.85, r: 0.55, pts: 3 },
      { x: -2.9, z: 0.5, r: 0.55, pts: 2 },
      { x: 2.9, z: 0.5, r: 0.55, pts: 2 },
    ];
    return { type: 'open', drill: kind, att: [{ x, y, hero: 1 }], def: [], targets, p: { ...p, gkSpeed: 4.6, gkReact: 0.26 }, seed };
  }
  if (kind === 'curl') {
    const x = rnd(R, -10, 10);
    const y = rnd(R, 16, 25);
    const d = Math.hypot(x, y);
    const n = 1 + Math.floor(R() * 2) + (ball > 5 ? 1 : 0);
    const def = [];
    for (let i = 0; i < n; i++) {
      const f = 0.18 + i * 0.16 + R() * 0.08;
      def.push({ x: x * (1 - f) + rnd(R, -0.8, 0.8), y: y * (1 - f) });
    }
    void d;
    return { type: 'open', drill: kind, att: [{ x, y, hero: 1 }], def, dummies: true, p: { ...p, defReact: 0.2, defSpeed: 2.2 }, seed };
  }
  // header: a teammate crosses automatically, draw the header
  const side = R() < 0.5 ? -1 : 1;
  const hx = rnd(R, -4, 4);
  const hy = rnd(R, 6.5, 11);
  const def = ball > 3 ? [{ x: hx + rnd(R, -3, 3), y: hy + rnd(R, -3.5, -2.2) }] : [];
  return {
    type: 'open',
    drill: kind,
    att: [{ x: side * rnd(R, 20, 26), y: rnd(R, 8, 18) }, { x: hx, y: hy, hero: 1 }],
    ball: 0,
    def,
    auto: { type: 'pass', to: 1, curl: 0, loft: true },
    p: { ...p, gkSpeed: 3.6 },
    seed,
  };
}

export { BOX_Y };
