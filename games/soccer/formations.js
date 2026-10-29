// Kick-off formations. Each side has a goalkeeper plus four outfield discs, so a
// formation is named by its outfield lines (e.g. "2-1-1"). Coordinates are for the
// team defending the bottom goal (team 0); team 1 is the point reflection.
// layoutFormation() adds a small seeded jitter and re-validates, so no two matches
// open exactly alike while every layout stays legal and balanced.

import { W, L, CAP_R, BALL_R } from './physics.js';
import { rng } from '../../js/core/ui.js';

export const KEEPER = [50, 159];

export const FORMATIONS = [
  { id: '2-2', pts: [[29, 139], [71, 139], [34, 104], [66, 104]] },
  { id: '3-1', pts: [[22, 138], [50, 134], [78, 138], [50, 104]] },
  { id: '1-3', pts: [[50, 139], [22, 106], [50, 112], [78, 106]] },
  { id: '2-1-1', pts: [[30, 140], [70, 140], [50, 122], [50, 104]] },
  { id: '1-2-1', pts: [[50, 140], [28, 122], [72, 122], [50, 104]] },
  { id: '1-1-2', pts: [[50, 138], [50, 120], [32, 104], [68, 104]] },
  { id: '1-1-1-1', pts: [[50, 141], [35, 127], [65, 116], [50, 104]] },
];
export const FORMATION_IDS = FORMATIONS.map((f) => f.id);
export const formationById = (id) => FORMATIONS.find((f) => f.id === id) || FORMATIONS[0];

export const MIN_SEP = 2 * CAP_R + 2.5; // discs never start touching each other
const X_MIN = CAP_R + 4;
const X_MAX = W - CAP_R - 4;
const Y_FRONT = 102.5; // outside the centre circle (own half only)
const Y_BACK = 148;

// Checks one side's 5 start positions [keeper, o1..o4] (team-0 space).
export function validLayout(p) {
  if (!Array.isArray(p) || p.length !== 5) return false;
  const [k, ...o] = p;
  if (k[0] < 42 || k[0] > 58 || k[1] < 156 || k[1] > 162) return false;
  let sx = 0;
  for (const [x, y] of o) {
    if (x < X_MIN || x > X_MAX || y < Y_FRONT || y > Y_BACK) return false;
    if (k[1] - y < MIN_SEP) return false; // keeper stays behind everybody
    if (Math.hypot(x - W / 2, y - L / 2) < CAP_R + BALL_R + 8) return false;
    sx += x;
  }
  if (Math.abs(sx / 4 - W / 2) > 4) return false; // left/right balance
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]) < MIN_SEP) return false;
  return true;
}

// Both sides together: nothing of team 1 (reflected) overlaps team 0 either.
export function validMatchup(a, b) {
  if (!validLayout(a) || !validLayout(b)) return false;
  for (const [x, y] of a) for (const [bx, by] of b) if (Math.hypot(x - (W - bx), y - (L - by)) < MIN_SEP) return false;
  return true;
}

// Start positions for formation `id`: [keeper, o1..o4]. `rnd` (optional) adds a jitter.
export function layoutFormation(id, rnd) {
  const base = [KEEPER, ...formationById(id).pts].map((p) => [p[0], p[1]]);
  if (!rnd) return base;
  for (let tries = 0; tries < 30; tries++) {
    const flip = rnd() < 0.5;
    const out = base.map(([x, y], i) => {
      const jx = (rnd() - 0.5) * (i === 0 ? 5 : 5.5);
      const jy = (rnd() - 0.5) * (i === 0 ? 2.5 : 4.5);
      return [(flip ? W - x : x) + jx, y + jy];
    });
    if (validLayout(out)) return out.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }
  return base;
}

// Picks one formation per side. `lock` fixes the player's (side 0); `prev` = previous pair
// (avoided so consecutive matches never repeat the same shape for a side).
export function pickFormations(rnd, { lock = null, prev = null } = {}) {
  const out = [];
  for (let s = 0; s < 2; s++) {
    if (s === 0 && lock && FORMATION_IDS.includes(lock)) {
      out.push(lock);
      continue;
    }
    const pool = FORMATION_IDS.filter((id) => !(prev && prev[s] === id));
    out.push(pool[Math.floor(rnd() * pool.length)]);
  }
  return out;
}

export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e37;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Per-match CPU temperament, drawn from the match seed. Bounds keep it fair (it only
// shifts the CPU's style/precision a little, never beyond its skill-level aim).
export function makeAiStyle(rnd) {
  const aggr = rnd() * 2 - 1; // -1 cautious .. +1 attacking
  return {
    aggr,
    jit: 0.9 + rnd() * 0.4, // aim-error multiplier
    aimShift: (rnd() - 0.5) * 7, // sideways bias of the goal targets (world units)
    kBonus: rnd() < 0.5 ? 0 : 1, // sometimes picks a less obvious top shot
    label: aggr > 0.35 ? 'attacking' : aggr < -0.35 ? 'cautious' : 'balanced',
  };
}

export { rng };
