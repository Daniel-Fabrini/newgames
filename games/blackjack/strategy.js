// Textbook basic strategy for the table rules in rules.js (multi-deck, dealer peeks, DAS by default).
// basicMove(cards, upRank, opts) → 'hit' | 'stand' | 'double' | 'split' | 'surrender'
// The raw chart answer is then reduced to something the current hand may actually do (see `suggest`).
import { total, valueOf, rankOf } from './rules.js';

// dealer up-card value 2..11 (11 = Ace)
export const upValue = (rank) => (rank === 1 ? 11 : Math.min(10, rank));
const between = (u, a, b) => u >= a && u <= b;

// pairs: returns true when the chart says split (value is 2..11 for the pair's card value, A = 11)
function splitPair(v, u, o) {
  switch (v) {
    case 11:
      return true;
    case 10:
      return false;
    case 9:
      return between(u, 2, 6) || u === 8 || u === 9;
    case 8:
      return true;
    case 7:
      return between(u, 2, 7);
    case 6:
      return o.das ? between(u, 2, 6) : between(u, 3, 6);
    case 5:
      return false;
    case 4:
      return o.das ? between(u, 5, 6) : false;
    case 3:
    case 2:
      return o.das ? between(u, 2, 7) : between(u, 4, 7);
    default:
      return false;
  }
}

export function basicMove(cards, upRank, opts = {}) {
  const o = { h17: false, das: true, surrender: false, ...opts };
  const u = upValue(upRank);
  const { total: tt, soft } = total(cards);
  // pairs
  if (!o.noSplit && cards.length === 2 && (opts.splitByValue ? valueOf(cards[0]) === valueOf(cards[1]) : rankOf(cards[0]) === rankOf(cards[1]))) {
    const v = valueOf(cards[0]) === 1 ? 11 : valueOf(cards[0]);
    if (splitPair(v, u, o)) return 'split';
  }
  if (o.surrender && cards.length === 2 && !soft) {
    if (tt === 16 && (u === 9 || u === 10 || u === 11)) return 'surrender';
    if (tt === 15 && (u === 10 || (o.h17 && u === 11))) return 'surrender';
    if (tt === 17 && u === 11 && o.h17) return 'surrender';
  }
  if (soft) {
    if (tt >= 20) return 'stand';
    if (tt === 19) return o.h17 && u === 6 ? 'double' : 'stand'; // A8: Ds vs 6 when H17 (stand if cannot double)
    if (tt === 18) {
      if (between(u, 3, 6)) return 'double'; // Ds
      if (u === 2) return o.h17 ? 'double' : 'stand';
      if (u === 7 || u === 8) return 'stand';
      return 'hit';
    }
    if (tt === 17) return between(u, 3, 6) ? 'double' : 'hit';
    if (tt === 16 || tt === 15) return between(u, 4, 6) ? 'double' : 'hit';
    if (tt === 14 || tt === 13) return between(u, 5, 6) ? 'double' : 'hit';
    return 'hit';
  }
  if (tt >= 17) return 'stand';
  if (tt >= 13) return between(u, 2, 6) ? 'stand' : 'hit';
  if (tt === 12) return between(u, 4, 6) ? 'stand' : 'hit';
  if (tt === 11) return u <= 10 || o.h17 ? 'double' : 'hit';
  if (tt === 10) return u <= 9 ? 'double' : 'hit';
  if (tt === 9) return between(u, 3, 6) ? 'double' : 'hit';
  return 'hit';
}

// Move to show as a hint: falls back to the closest legal action given `legal` = { double, split, surrender }.
export function suggest(cards, upRank, opts = {}, legal = { double: true, split: true, surrender: false }) {
  let m = basicMove(cards, upRank, opts);
  if (m === 'surrender' && !legal.surrender) m = basicMove(cards, upRank, { ...opts, surrender: false });
  if (m === 'split' && !legal.split) m = basicMove(cards, upRank, { ...opts, noSplit: true });
  if (m === 'double' && !legal.double) {
    const { total: tt, soft } = total(cards);
    const u = upValue(upRank);
    // "Ds" cells (soft 18 vs 3-6 (2 when H17), soft 19 vs 6 when H17) stand when doubling is impossible
    const ds = soft && ((tt === 18 && (between(u, 3, 6) || (u === 2 && opts.h17))) || (tt === 19 && opts.h17 && u === 6));
    m = ds ? 'stand' : 'hit';
  }
  return m;
}
