// Sueca — pure rules engine (4 players, 2 teams: seats 0+2 vs 1+3; seat 0 is the human).
// Play goes anticlockwise: seat order 0 → 1 → 2 → 3 is bottom → right → top → left.
// State is plain JSON; every random decision uses state.rs (seeded PRNG), so saves resume exactly.
import { suitOf, rankOf, pts, newDeck, shuffleInPlace, randInt, sortHand, TOTAL_POINTS } from './deck.js';

export const teamOf = (seat) => seat & 1;
export const partnerOf = (seat) => (seat + 2) & 3;
export const nextSeat = (seat) => (seat + 1) & 3;

export function newMatch(opts = {}, seed = 1) {
  const single = !!opts.single;
  const s = {
    v: 1,
    rs: seed >>> 0,
    opts: { single, target: single ? 1 : opts.target || 4 },
    dealer: 0,
    round: 0,
    jogos: [0, 0],
    rounds: [],
    phase: 'play', // play | roundEnd | matchEnd
    hands: [[], [], [], []],
    trumpCard: -1,
    trump: -1,
    leader: 0,
    turn: 0,
    trick: [],
    tricks: [],
    taken: [[], []],
    points: [0, 0],
    lastRound: null,
  };
  s.dealer = opts.dealer != null ? opts.dealer & 3 : randInt(s, 4);
  startRound(s, opts.cutAt);
  return s;
}

// Shuffle, cut (by the player to the dealer's right = next in play order) and deal 3-4-3.
// The last card dealt belongs to the dealer: it is turned face up and gives the trunfo.
export function startRound(s, cutAt) {
  const deck = shuffleInPlace(newDeck(), s);
  const k = cutAt != null ? cutAt : 1 + randInt(s, 39);
  const cut = deck.slice(k).concat(deck.slice(0, k));
  s.hands = [[], [], [], []];
  let i = 0;
  for (const batch of [3, 4, 3]) {
    for (let n = 0; n < 4; n++) {
      const seat = (s.dealer + 1 + n) & 3;
      for (let j = 0; j < batch; j++) s.hands[seat].push(cut[i++]);
    }
  }
  s.trumpCard = cut[39];
  s.trump = suitOf(s.trumpCard);
  s.hands.forEach(sortHand);
  s.initial = s.hands.map((h) => h.slice());
  s.leader = (s.dealer + 1) & 3;
  s.turn = s.leader;
  s.trick = [];
  s.tricks = [];
  s.taken = [[], []];
  s.points = [0, 0];
  s.phase = 'play';
  s.lastRound = null;
  return s;
}

// Cards the seat may play. Following suit is mandatory when possible (no renúncia).
export function legalFor(hand, trick) {
  if (!trick.length) return hand.slice();
  const led = suitOf(trick[0].c);
  const follow = hand.filter((c) => suitOf(c) === led);
  return follow.length ? follow : hand.slice();
}
export const legalCards = (s, seat) => legalFor(s.hands[seat], s.trick);

// Winner of a complete or partial trick: highest trunfo, else highest card of the led suit.
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

export class RuleError extends Error {}

export function playCard(s, seat, c) {
  if (s.phase !== 'play') throw new RuleError('not in play');
  if (s.trick.length >= 4) throw new RuleError('trick pending resolution');
  if (seat !== s.turn) throw new RuleError('not your turn');
  const hand = s.hands[seat];
  const idx = hand.indexOf(c);
  if (idx < 0) throw new RuleError('card not in hand');
  if (!legalFor(hand, s.trick).includes(c)) throw new RuleError('must follow suit');
  hand.splice(idx, 1);
  s.trick.push({ p: seat, c });
  if (s.trick.length < 4) s.turn = nextSeat(seat);
  else s.turn = -1;
  return { complete: s.trick.length === 4 };
}

// Collect a finished trick: the winner takes the cards and leads next.
export function resolveTrick(s) {
  if (s.phase !== 'play' || s.trick.length !== 4) throw new RuleError('no complete trick');
  const w = trickWinner(s.trick, s.trump);
  const points = s.trick.reduce((a, x) => a + pts(x.c), 0);
  const team = teamOf(w);
  s.tricks.push({ leader: s.trick[0].p, plays: s.trick.map((x) => ({ p: x.p, c: x.c })), winner: w, points });
  for (const x of s.trick) s.taken[team].push(x.c);
  s.points[team] += points;
  s.trick = [];
  s.leader = w;
  s.turn = w;
  const roundOver = s.tricks.length === 10;
  if (roundOver) endRound(s);
  return { winner: w, points, team, roundOver };
}

// Jogos for a round: >60 wins; 61–90 → 1, 91–119 → 2 (capote), 120 → 4 (bandeira); 60–60 → draw.
export function scoreRound(points) {
  const [a, b] = points;
  if (a === b) return { team: -1, jogos: 0, kind: 'draw' };
  const team = a > b ? 0 : 1;
  const win = Math.max(a, b);
  if (win === TOTAL_POINTS) return { team, jogos: 4, kind: 'bandeira' };
  if (win >= 91) return { team, jogos: 2, kind: 'capote' };
  return { team, jogos: 1, kind: 'normal' };
}

function endRound(s) {
  const res = scoreRound(s.points);
  if (res.team >= 0) s.jogos[res.team] += res.jogos;
  const tricksWon = [0, 0];
  for (const t of s.tricks) tricksWon[teamOf(t.winner)]++;
  s.lastRound = { points: s.points.slice(), result: res, tricksWon, dealer: s.dealer, trump: s.trump, jogos: s.jogos.slice() };
  s.rounds.push(s.lastRound);
  s.phase = s.opts.single || s.jogos[0] >= s.opts.target || s.jogos[1] >= s.opts.target ? 'matchEnd' : 'roundEnd';
}

export function nextRound(s, cutAt) {
  if (s.phase !== 'roundEnd') throw new RuleError('round not finished');
  s.dealer = nextSeat(s.dealer);
  s.round++;
  startRound(s, cutAt);
  return s;
}

export const matchWinner = (s) => (s.phase !== 'matchEnd' ? -1 : s.jogos[0] === s.jogos[1] ? -1 : s.jogos[0] > s.jogos[1] ? 0 : 1);

// What a seat is allowed to know: own hand + everything played face up. Never other hands.
export function viewFor(s, seat) {
  return {
    seat,
    hand: s.hands[seat].slice(),
    trump: s.trump,
    trumpCard: s.trumpCard,
    dealer: s.dealer,
    leader: s.leader,
    trick: s.trick.map((x) => ({ p: x.p, c: x.c })),
    tricks: s.tricks.map((t) => ({ leader: t.leader, plays: t.plays.map((x) => ({ p: x.p, c: x.c })), winner: t.winner, points: t.points })),
    points: s.points.slice(),
    jogos: s.jogos.slice(),
    target: s.opts.target,
  };
}

// Sanity check used by tests: every card exactly once, points add to 120.
export function checkInvariants(s) {
  const all = [];
  for (const h of s.hands) all.push(...h);
  for (const x of s.trick) all.push(x.c);
  for (const t of s.taken) all.push(...t);
  if (all.length !== 40 || new Set(all).size !== 40) throw new Error('card conservation broken');
  const inPlay = s.trick.reduce((a, x) => a + pts(x.c), 0);
  if (s.points[0] + s.points[1] + inPlay + s.hands.flat().reduce((a, c) => a + pts(c), 0) !== TOTAL_POINTS) throw new Error('points broken');
  return true;
}
