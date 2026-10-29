// Preflop hand ranking: Chen-formula score -> combo-weighted percentile (0 = AA, ~1 = 32o).
// PCT[c1*52+c2] gives the percentile for any two hole cards (order independent).
const chenPoints = (r) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
function chen(r1, r2, suited) {
  const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  let s = chenPoints(hi);
  if (hi === lo) return Math.max(5, s * 2) + 0.01 * hi;
  if (suited) s += 2;
  const gap = hi - lo - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) s += 1;
  return Math.ceil(s) + 0.01 * hi + 0.0001 * lo;
}
const classes = [];
for (let a = 0; a < 13; a++) for (let b = a; b < 13; b++) {
  if (a === b) classes.push({ a, b, suited: false, combos: 6, score: chen(a, b, false) });
  else { classes.push({ a, b, suited: true, combos: 4, score: chen(a, b, true) }); classes.push({ a, b, suited: false, combos: 12, score: chen(a, b, false) }); }
}
classes.sort((x, y) => y.score - x.score);
let acc = 0;
for (const c of classes) { c.pct = (acc + c.combos / 2) / 1326; acc += c.combos; }
const byKey = new Map(classes.map((c) => [c.a * 26 + c.b * 2 + (c.suited ? 1 : 0), c]));
export const PCT = new Float32Array(52 * 52);
for (let x = 0; x < 52; x++) for (let y = 0; y < 52; y++) {
  if (x === y) continue;
  const rx = x >> 2, ry = y >> 2, suited = (x & 3) === (y & 3);
  const a = Math.min(rx, ry), b = Math.max(rx, ry);
  PCT[x * 52 + y] = byKey.get(a * 26 + b * 2 + (suited && a !== b ? 1 : 0)).pct;
}
export const preflopPct = (hole) => PCT[hole[0] * 52 + hole[1]];
