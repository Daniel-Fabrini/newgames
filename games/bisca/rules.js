// Bisca — pure rules engine. 2 players (seats 0 = human, 1 = AI) or 4 players in two teams
// (seats 0+2 vs 1+3). Hand size 3 ("Bisca de 3") or 9 ("Bisca de 9"). Play order: seat+1.
// State is plain JSON; every random decision uses state.rs (seeded PRNG) so saves resume exactly.
import { suitOf, rankOf, pts, mk, newDeck, shuffleInPlace, randInt, sortHand, TOTAL_POINTS } from './deck.js';

export const SEVEN = 8; // rank index of the 7
export const teamOf = (seat) => seat & 1;

export class RuleError extends Error {}

export function newMatch(opts = {}, seed = 1) {
  const players = opts.players === 4 ? 4 : 2;
  const handSize = opts.handSize === 9 ? 9 : 3;
  const s = {
    v: 1,
    rs: seed >>> 0,
    n: players,
    opts: { players, handSize, swap7: !!opts.swap7, match: ['single', 'bo3', 'p4'].includes(opts.match) ? opts.match : 'single' },
    dealer: 0,
    round: 0,
    scores: [0, 0], // pontos (game points) per team
    wins: [0, 0], // hands won per team
    rounds: [],
    phase: 'play', // play | roundEnd | matchEnd
    hands: [],
    stock: [],
    trumpCard: -1,
    trump: -1,
    trumpDrawnBy: -1,
    leader: 0,
    turn: 0,
    trick: [],
    tricks: [],
    taken: [[], []],
    points: [0, 0],
    swaps: [],
    lastRound: null,
  };
  s.dealer = opts.dealer != null ? opts.dealer % players : randInt(s, players);
  startRound(s);
  return s;
}

// Shuffle, deal `handSize` each starting with the dealer's opponent, turn up the trunfo and slide it
// under the stock: it is the very last card to be drawn.
export function startRound(s) {
  const n = s.n;
  const deck = shuffleInPlace(newDeck(), s);
  s.hands = Array.from({ length: n }, () => []);
  let i = 0;
  for (let k = 0; k < n; k++) {
    const seat = (s.dealer + 1 + k) % n;
    for (let j = 0; j < s.opts.handSize; j++) s.hands[seat].push(deck[i++]);
  }
  const rest = deck.slice(i);
  s.trumpCard = rest[0];
  s.trump = suitOf(s.trumpCard);
  s.stock = rest.slice(1).concat(rest[0]);
  s.trumpDrawnBy = -1;
  s.hands.forEach(sortHand);
  s.leader = (s.dealer + 1) % n;
  s.turn = s.leader;
  s.trick = [];
  s.tricks = [];
  s.taken = [[], []];
  s.points = [0, 0];
  s.swaps = [];
  s.phase = 'play';
  s.lastRound = null;
  return s;
}

export const stockEmpty = (s) => s.stock.length === 0;

// Stock phase: any card. Final phase (stock exhausted): follow suit if you can (no duty to trump/win).
export function legalFor(hand, trick, forced) {
  if (!trick.length || !forced) return hand.slice();
  const led = suitOf(trick[0].c);
  const follow = hand.filter((c) => suitOf(c) === led);
  return follow.length ? follow : hand.slice();
}
export const legalCards = (s, seat) => legalFor(s.hands[seat], s.trick, stockEmpty(s));

export function trickWinnerPlay(trick, trump) {
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const a = trick[i];
    const sa = suitOf(a.c);
    const sb = suitOf(best.c);
    if (sa === sb) {
      if (rankOf(a.c) > rankOf(best.c)) best = a;
    } else if (sa === trump) best = a;
  }
  return best;
}
export const trickWinner = (trick, trump) => trickWinnerPlay(trick, trump).p;

// "Trocar o sete": optional rule. The player about to lead may exchange the 7 of trunfo for the
// face-up trunfo card while at least one more card than the trunfo remains in the stock.
export function canSwap(s, seat) {
  return (
    s.opts.swap7 &&
    s.phase === 'play' &&
    s.trick.length === 0 &&
    s.turn === seat &&
    s.stock.length >= 2 &&
    s.hands[seat].includes(mk(s.trump, SEVEN)) &&
    s.trumpCard !== mk(s.trump, SEVEN)
  );
}
export function swapSeven(s, seat) {
  if (!canSwap(s, seat)) throw new RuleError('cannot swap');
  const seven = mk(s.trump, SEVEN);
  const hand = s.hands[seat];
  const got = s.trumpCard;
  hand[hand.indexOf(seven)] = got;
  sortHand(hand);
  s.stock[s.stock.length - 1] = seven;
  s.trumpCard = seven;
  s.swaps.push({ seat, got, gave: seven, trick: s.tricks.length });
  return { got, gave: seven };
}

export function playCard(s, seat, c) {
  if (s.phase !== 'play') throw new RuleError('not in play');
  if (s.trick.length >= s.n) throw new RuleError('trick pending resolution');
  if (seat !== s.turn) throw new RuleError('not your turn');
  const hand = s.hands[seat];
  const idx = hand.indexOf(c);
  if (idx < 0) throw new RuleError('card not in hand');
  if (!legalFor(hand, s.trick, stockEmpty(s)).includes(c)) throw new RuleError('must follow suit');
  hand.splice(idx, 1);
  s.trick.push({ p: seat, c });
  s.turn = s.trick.length < s.n ? (seat + 1) % s.n : -1;
  return { complete: s.trick.length === s.n };
}

// Collect a finished trick, draw (winner first, then in play order; the trunfo is the last card).
export function resolveTrick(s) {
  if (s.phase !== 'play' || s.trick.length !== s.n) throw new RuleError('no complete trick');
  const w = trickWinner(s.trick, s.trump);
  const points = s.trick.reduce((a, x) => a + pts(x.c), 0);
  const team = teamOf(w);
  const forced = stockEmpty(s);
  s.tricks.push({ leader: s.trick[0].p, plays: s.trick.map((x) => ({ p: x.p, c: x.c })), winner: w, points, forced });
  for (const x of s.trick) s.taken[team].push(x.c);
  s.points[team] += points;
  s.trick = [];
  const draws = [];
  for (let k = 0; k < s.n && s.stock.length; k++) {
    const seat = (w + k) % s.n;
    const c = s.stock.shift();
    s.hands[seat].push(c);
    sortHand(s.hands[seat]);
    draws.push({ p: seat, c });
    if (!s.stock.length) s.trumpDrawnBy = seat; // the last card of the stock is the trunfo card
  }
  s.leader = w;
  s.turn = w;
  const roundOver = s.hands.every((h) => h.length === 0);
  if (roundOver) endRound(s);
  return { winner: w, points, team, draws, roundOver };
}

export function scoreRound(points) {
  const [a, b] = points;
  if (a === b) return { team: -1, pontos: 0, kind: 'draw' };
  const team = a > b ? 0 : 1;
  const win = Math.max(a, b);
  if (win === TOTAL_POINTS) return { team, pontos: 4, kind: 'capote' };
  if (win >= 91) return { team, pontos: 2, kind: 'double' };
  return { team, pontos: 1, kind: 'normal' };
}

function endRound(s) {
  const res = scoreRound(s.points);
  if (res.team >= 0) {
    s.scores[res.team] += res.pontos;
    s.wins[res.team]++;
  }
  s.lastRound = { points: s.points.slice(), result: res, dealer: s.dealer, trump: s.trump, scores: s.scores.slice(), wins: s.wins.slice() };
  s.rounds.push(s.lastRound);
  s.phase = matchOver(s) ? 'matchEnd' : 'roundEnd';
}

export function matchOver(s) {
  const m = s.opts.match;
  if (m === 'single') return true;
  if (m === 'bo3') return s.wins[0] >= 2 || s.wins[1] >= 2;
  return s.scores[0] >= 4 || s.scores[1] >= 4;
}
export function matchWinner(s) {
  if (s.phase !== 'matchEnd') return -1;
  const m = s.opts.match;
  const a = m === 'single' ? s.points[0] : m === 'bo3' ? s.wins[0] : s.scores[0];
  const b = m === 'single' ? s.points[1] : m === 'bo3' ? s.wins[1] : s.scores[1];
  return a === b ? -1 : a > b ? 0 : 1;
}

export function nextRound(s) {
  if (s.phase !== 'roundEnd') throw new RuleError('round not finished');
  s.dealer = (s.dealer + 1) % s.n;
  s.round++;
  startRound(s);
  return s;
}

// Public knowledge for a seat: own hand + the face-up trunfo card + all cards played.
export function viewFor(s, seat) {
  return {
    seat,
    n: s.n,
    opts: { ...s.opts },
    hand: s.hands[seat].slice(),
    handSizes: s.hands.map((h) => h.length),
    stockCount: s.stock.length,
    trump: s.trump,
    trumpCard: s.trumpCard,
    trumpDrawnBy: s.trumpDrawnBy,
    dealer: s.dealer,
    leader: s.leader,
    trick: s.trick.map((x) => ({ p: x.p, c: x.c })),
    tricks: s.tricks.map((t) => ({ leader: t.leader, plays: t.plays.map((x) => ({ p: x.p, c: x.c })), winner: t.winner, points: t.points, forced: t.forced })),
    points: s.points.slice(),
    scores: s.scores.slice(),
    wins: s.wins.slice(),
    swaps: s.swaps.map((x) => ({ ...x })),
  };
}

export function checkInvariants(s) {
  const all = [];
  for (const h of s.hands) all.push(...h);
  for (const x of s.trick) all.push(x.c);
  for (const t of s.taken) all.push(...t);
  all.push(...s.stock);
  if (all.length !== 40 || new Set(all).size !== 40) throw new Error('card conservation broken');
  if (s.stock.length && s.stock[s.stock.length - 1] !== s.trumpCard) throw new Error('trunfo card must be last in stock');
  const inPlay = s.trick.reduce((a, x) => a + pts(x.c), 0);
  const rest = all.filter((c) => !s.taken[0].includes(c) && !s.taken[1].includes(c) && !s.trick.some((x) => x.c === c)).reduce((a, c) => a + pts(c), 0);
  if (s.points[0] + s.points[1] + inPlay + rest !== TOTAL_POINTS) throw new Error('points broken');
  return true;
}
