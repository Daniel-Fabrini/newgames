import { evaluate } from '../engine/eval.js';
import { PCT } from './preflop.js';

/**
 * Monte-Carlo equity of `hole` on `board` against opponents whose hands are sampled from the top `cuts[i]`
 * fraction of preflop hands (rejection sampling; cut 1 = any two cards). Deterministic given rng + iters.
 * Only uses information the hero legitimately has (own cards, board, public range assumptions).
 */
export function equity(hole, board, cuts, rng, iters = 200) {
  const nOpp = cuts.length;
  if (nOpp === 0) return 1;
  const used = new Uint8Array(52);
  for (const c of hole) used[c] = 1;
  for (const c of board) used[c] = 1;
  const rem = [];
  for (let c = 0; c < 52; c++) if (!used[c]) rem.push(c);
  const m = rem.length, need = 5 - board.length;
  const h7 = new Array(7), o7 = new Array(7);
  let score = 0;
  for (let it = 0; it < iters; it++) {
    let k = 0;
    const draw = () => { const j = k + ((rng() * (m - k)) | 0); const t = rem[k]; rem[k] = rem[j]; rem[j] = t; return rem[k++]; };
    const opp = [];
    for (let o = 0; o < nOpp; o++) {
      let a = 0, b = 0;
      for (let tries = 0; tries < 8; tries++) {
        const k0 = k;
        a = draw(); b = draw();
        if (PCT[a * 52 + b] <= cuts[o] || tries === 7) break;
        k = k0; // reject: put them back into the pool (they stay in the unsampled region)
      }
      opp.push(a, b);
    }
    const extra = [];
    for (let e = 0; e < need; e++) extra.push(draw());
    let n = 0;
    h7[n++] = hole[0]; h7[n++] = hole[1];
    for (const c of board) h7[n++] = c;
    for (const c of extra) h7[n++] = c;
    h7.length = n;
    const hs = evaluate(h7);
    let beaten = false, ties = 0;
    for (let o = 0; o < nOpp; o++) {
      o7.length = 0; o7.push(opp[o * 2], opp[o * 2 + 1]);
      for (let q = 2; q < n; q++) o7.push(h7[q]);
      const os = evaluate(o7);
      if (os > hs) { beaten = true; break; }
      if (os === hs) ties++;
    }
    if (!beaten) score += 1 / (ties + 1);
  }
  return score / iters;
}
