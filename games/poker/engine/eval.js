// Hand evaluator. Cards are ints 0..51: rank = c >> 2 (0 = deuce ... 12 = ace), suit = c & 3.
// Score = category * 2^20 + 5 packed nibbles of tiebreak ranks; higher is better.
// Categories: 0 high card, 1 pair, 2 two pair, 3 trips, 4 straight, 5 flush, 6 full house, 7 quads, 8 straight flush (ace-high = royal).
export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs'; // clubs diamonds hearts spades
export const CAT_NAMES = ['high_card', 'pair', 'two_pair', 'trips', 'straight', 'flush', 'full_house', 'quads', 'straight_flush'];
export const rankOf = (c) => c >> 2;
export const suitOf = (c) => c & 3;
export const cardStr = (c) => RANKS[c >> 2] + SUITS[c & 3];
export function parseCard(s) {
  const r = RANKS.indexOf(s[0].toUpperCase()), u = SUITS.indexOf(s[1].toLowerCase());
  if (r < 0 || u < 0) throw new Error('bad card ' + s);
  return r * 4 + u;
}
export const parseCards = (s) => (Array.isArray(s) ? s : s.trim().split(/\s+/)).map(parseCard);

const cnt = new Int8Array(13);
const pack = (cat, a, b = 0, c = 0, d = 0, e = 0) => (cat << 20) | (a << 16) | (b << 12) | (c << 8) | (d << 4) | e;

// highest straight top rank (0..12, wheel = 3 meaning 5-high) from a 13-bit mask, or -1
function straightTop(mask) {
  // add ace-low bit
  const m = (mask << 1) | (mask >> 12 & 1);
  for (let top = 12; top >= 3; top--) {
    const need = 0x1F << (top - 3); // ranks top-4..top live at bits top-3..top+1 (bit 0 = ace-low)
    if ((m & need) === need) return top;
  }
  return -1;
}

/** Evaluate best 5 of up to 7 cards (>=5). */
export function evaluate(cards) {
  const n = cards.length;
  cnt.fill(0);
  const suitMask = [0, 0, 0, 0], suitCnt = [0, 0, 0, 0];
  let mask = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i], r = c >> 2, s = c & 3;
    cnt[r]++; mask |= 1 << r; suitMask[s] |= 1 << r; suitCnt[s]++;
  }
  // flush / straight flush
  let fs = -1;
  for (let s = 0; s < 4; s++) if (suitCnt[s] >= 5) { fs = s; break; }
  if (fs >= 0) {
    const sm = suitMask[fs];
    const st = straightTop(sm);
    if (st >= 0) return pack(8, st);
    // top five ranks of flush
    const rs = [];
    for (let r = 12; r >= 0 && rs.length < 5; r--) if (sm >> r & 1) rs.push(r);
    return pack(5, rs[0], rs[1], rs[2], rs[3], rs[4]);
  }
  // group by counts
  let quad = -1, trip = -1, trip2 = -1, pair = -1, pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const k = cnt[r];
    if (k === 4) quad = r;
    else if (k === 3) { if (trip < 0) trip = r; else if (trip2 < 0) trip2 = r; }
    else if (k === 2) { if (pair < 0) pair = r; else if (pair2 < 0) pair2 = r; }
  }
  const kick = (excl1, excl2, excl3, num) => { // best `num` kickers not in excluded ranks (cnt>0)
    const out = [];
    for (let r = 12; r >= 0 && out.length < num; r--) if (cnt[r] > 0 && r !== excl1 && r !== excl2 && r !== excl3) out.push(r);
    while (out.length < num) out.push(0);
    return out;
  };
  if (quad >= 0) { const k = kick(quad, -1, -1, 1); return pack(7, quad, k[0]); }
  if (trip >= 0 && (trip2 >= 0 || pair >= 0)) {
    const p = trip2 >= 0 ? (pair > trip2 ? pair : trip2) : pair;
    return pack(6, trip, p);
  }
  const st = straightTop(mask);
  if (st >= 0) return pack(4, st);
  if (trip >= 0) { const k = kick(trip, -1, -1, 2); return pack(3, trip, k[0], k[1]); }
  if (pair >= 0 && pair2 >= 0) { const k = kick(pair, pair2, -1, 1); return pack(2, pair, pair2, k[0]); }
  if (pair >= 0) { const k = kick(pair, -1, -1, 3); return pack(1, pair, k[0], k[1], k[2]); }
  const k = kick(-1, -1, -1, 5);
  return pack(0, k[0], k[1], k[2], k[3], k[4]);
}
export const categoryOf = (score) => score >> 20;
/** {cat, key, ranks:[...]} description, with royal flush flagged. */
export function describe(score) {
  const cat = score >> 20;
  const ranks = [score >> 16 & 15, score >> 12 & 15, score >> 8 & 15, score >> 4 & 15, score & 15];
  let key = CAT_NAMES[cat];
  if (cat === 8 && ranks[0] === 12) key = 'royal_flush';
  return { cat, key, ranks };
}
/** Best five cards (array of 5 ints) among up to 7 — for UI highlighting. */
export function bestFive(cards) {
  const target = evaluate(cards);
  if (cards.length === 5) return cards.slice();
  const n = cards.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (n === 7 || (n === 6 && i === j - 1 + 0 && false)) { /* fallthrough */ }
    const rest = cards.filter((_, k) => k !== i && k !== j);
    if (n === 7) { if (evaluate(rest) === target) return rest; }
  }
  if (n === 6) for (let i = 0; i < n; i++) { const rest = cards.filter((_, k) => k !== i); if (evaluate(rest) === target) return rest; }
  return cards.slice(0, 5);
}
