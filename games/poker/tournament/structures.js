// Blind structures, payout ladders, points. Pure helpers.
const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
export function niceRound(x) {
  if (x <= 10) return Math.max(1, Math.round(x));
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  let best = NICE[0] * mag, bd = Infinity;
  for (const n of [...NICE, 10]) { const v = n * mag; const d = Math.abs(v - x); if (d < bd) { bd = d; best = v; } }
  return Math.round(best);
}
/**
 * makeStructure({bb, levels, growth, anteFrom, anteRatio, handsPerLevel, handsPerLevelFinal})
 * -> {levels:[{sb,bb,ante}], handsPerLevel, handsPerLevelFinal}. Levels beyond the list extrapolate by `growth` (see levelAt).
 */
export function makeStructure({ bb = 20, levels = 14, growth = 1.45, anteFrom = 5, anteRatio = 0.125, handsPerLevel = 8, handsPerLevelFinal = null } = {}) {
  const out = [];
  for (let k = 0; k < levels; k++) {
    const b = niceRound(bb * Math.pow(growth, k));
    const sb = Math.max(1, Math.floor(b / 2));
    out.push({ sb, bb: b, ante: k >= anteFrom ? niceRound(b * anteRatio) : 0 });
  }
  return { levels: out, growth, handsPerLevel, handsPerLevelFinal: handsPerLevelFinal || handsPerLevel };
}
export function levelAt(structure, k) {
  const L = structure.levels;
  if (k < L.length) return L[k];
  const last = L[L.length - 1]; const f = Math.pow(structure.growth || 1.5, k - L.length + 1);
  const bb = niceRound(last.bb * f);
  return { sb: Math.floor(bb / 2), bb, ante: niceRound(bb * 0.15) };
}
/** Payout fractions (sum 1) for the paid places. */
export function payoutLadder(entrants, kind = 'auto') {
  let paid;
  if (kind === 'wta') paid = 1;
  else if (entrants <= 3) paid = 1;
  else if (entrants <= 6) paid = 2;
  else if (entrants <= 9) paid = 3;
  else paid = Math.max(3, Math.round(entrants * 0.14));
  paid = Math.min(paid, entrants);
  if (paid === 1) return [1];
  const w = []; for (let k = 0; k < paid; k++) w.push(1 / Math.pow(k + 0.85, entrants <= 9 ? 1.05 : 1.25));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}
/** Integer prize amounts per place (index 0 = 1st), summing exactly to pool. */
export function prizeAmounts(pool, ladder) {
  const amt = ladder.map((f) => Math.floor(pool * f));
  let rem = pool - amt.reduce((a, b) => a + b, 0);
  for (let k = 0; rem > 0; k = (k + 1) % amt.length) { amt[k]++; rem--; }
  return amt;
}
/** Ranking points for a finish. mult = event multiplier. */
export function placePoints({ place, entrants, tableSize = 9, paid = 1, ko = 0, mult = 1 }) {
  if (!place || place < 1) return 0;
  const pct = entrants > 1 ? (entrants - place) / (entrants - 1) : 1;
  let pts = pct * pct * 60;
  if (place === 1) pts += 40;
  else if (place === 2) pts += 18;
  if (place <= Math.min(tableSize, entrants)) pts += 12;
  if (place <= paid) pts += 8;
  pts += ko * 3;
  return Math.round(pts * mult);
}
