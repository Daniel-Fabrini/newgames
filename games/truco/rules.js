// Truco Paulista — pure rules engine (no DOM). JSON-serialisable state, seedable RNG.
//
// Cards are 2-char strings: rank + suit, e.g. '3C' (3 of clubs), 'QH'.
// Ranks weakest→strongest (before manilhas): 4 5 6 7 Q J K A 2 3.
// Suits (manilha order, strongest first): C paus/clubs (zap) > H copas/hearts > S espadas/spades > D ouros/diamonds.
//
// State machine (state.phase):
//   'play'    – state.hand.turn must play a card (or call truco if allowed)
//   'bet'     – state.hand.bet is pending; seat bet.to must accept / run / raise
//   'onze'    – "mão de onze": the team at 11 decides to play (accept) or run
//   'handEnd' – the hand is over (state.last has the result); call nextHand()
//   'gameEnd' – a team reached the target (state.winner)
// Dealing, vira reveal and trick resolution happen synchronously inside startHand()/act() and are
// reported as events: deal, vira, play, trick, bet, accept, raise, run, onze, hand, game.

export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUITS = ['D', 'S', 'H', 'C']; // weakest→strongest for manilhas (index = strength)
export const LEVELS = [1, 3, 6, 9, 12];
export const BET_NAMES = { 3: 'truco', 6: 'seis', 9: 'nove', 12: 'doze' };

export const rankOf = (c) => c[0];
export const suitOf = (c) => c[1];
export const teamOf = (seat) => seat % 2;

export function makeDeck() {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  return d; // 40 cards
}

export function manilhaRank(viraCard) {
  const r = typeof viraCard === 'string' && viraCard.length === 2 ? viraCard[0] : viraCard;
  return RANKS[(RANKS.indexOf(r) + 1) % RANKS.length];
}

export const isManilha = (card, manilha) => card[0] === manilha;

/** Strength of a card for a given manilha rank. Manilhas 100+suit, others 0..9. */
export function strength(card, manilha) {
  if (card[0] === manilha) return 100 + SUITS.indexOf(card[1]);
  return RANKS.indexOf(card[0]);
}

// ---------- RNG (mulberry32, state is a single uint32 stored in the game state) ----------
export function nextRand(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function shuffleInPlace(arr, state) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function realSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch {
    return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  }
}

// ---------- pure trick / hand logic ----------
/** Trick winner. plays = [{seat, card, hidden}] → { team: 0|1|null, seat, tie } . Hidden cards strength -1. */
export function trickWinner(plays, manilha, n = 4) {
  let best = -2;
  for (const p of plays) best = Math.max(best, p.hidden ? -1 : strength(p.card, manilha));
  const top = plays.filter((p) => (p.hidden ? -1 : strength(p.card, manilha)) === best);
  const teams = new Set(top.map((p) => teamOf(p.seat)));
  if (teams.size > 1) return { team: null, seat: null, tie: true };
  return { team: teamOf(top[0].seat), seat: top[0].seat, tie: false };
}

/**
 * Hand winner from trick results (array of 0|1|null per finished trick, null = tie).
 * Returns 0|1 (winning team), 'none' (nobody scores) or undefined (undecided yet).
 */
export function handWinner(res) {
  const [a, b, c] = res;
  if (a === undefined) return undefined;
  if (a !== null) {
    if (b === undefined) return undefined;
    if (b === null) return a; // trick 2 tied after trick 1 was won
    if (b === a) return a;
    if (c === undefined) return undefined;
    return c === null ? a : c; // trick 3 tie → winner of trick 1
  }
  // trick 1 tied
  if (b === undefined) return undefined;
  if (b !== null) return b;
  if (c === undefined) return undefined;
  return c === null ? 'none' : c;
}

// ---------- game state ----------
export class IllegalAction extends Error {}
const bad = (m) => {
  throw new IllegalAction(m);
};

export function newGame(opts = {}) {
  const n = opts.n === 2 ? 2 : 4;
  const target = opts.target || 12;
  const s = {
    v: 1,
    n,
    target,
    maxLevel: target >= 12 ? 12 : 6,
    closed: !!opts.closed,
    humanSeats: opts.humanSeats || [0],
    rng: (opts.seed ?? realSeed()) >>> 0,
    score: [0, 0],
    dealer: opts.dealer ?? n - 1,
    handNo: 0,
    phase: 'play',
    winner: null,
    last: null,
    hand: null,
    stats: { hands: 0, tricks: [0, 0], trucos: [0, 0], runs: [0, 0] },
  };
  return s;
}

export function seatsOf(s) {
  return Array.from({ length: s.n }, (_, i) => i);
}
export const nextSeat = (s, seat) => (seat + 1) % s.n;

export function startHand(s) {
  if (s.phase === 'gameEnd') bad('game over');
  s.handNo++;
  s.dealer = s.handNo === 1 ? s.dealer : nextSeat(s, s.dealer);
  const deck = shuffleInPlace(makeDeck(), s);
  const hands = [];
  for (let i = 0; i < s.n; i++) hands.push(deck.splice(0, 3));
  const vira = deck.shift();
  const sp = specialFor(s);
  const hand = {
    no: s.handNo,
    hands,
    vira,
    manilha: manilhaRank(vira),
    value: sp === 'onze' ? 3 : 1,
    special: sp, // null | 'onze' | 'ferro'
    onzeTeam: sp === 'onze' ? (s.score[0] === s.target - 1 ? 0 : 1) : null,
    leader: nextSeat(s, s.dealer),
    turn: nextSeat(s, s.dealer),
    cur: [], // plays of the trick in progress [{seat, card, hidden}]
    tricks: [], // finished tricks [{plays, team, seat}]
    results: [], // 0|1|null
    lastRaiser: null, // team that made the latest raise
    bet: null, // {from, fromTeam, level, to}
    played: [], // every face-up card played this hand (public)
  };
  s.hand = hand;
  s.last = null;
  s.phase = sp === 'onze' ? 'onze' : 'play';
  const ev = [
    { e: 'deal', dealer: s.dealer, no: s.handNo, special: sp },
    { e: 'vira', card: vira, manilha: hand.manilha },
  ];
  if (sp === 'onze') ev.push({ e: 'onze', team: hand.onzeTeam });
  return ev;
}

function specialFor(s) {
  const e = s.target - 1;
  if (s.target < 12) return null;
  if (s.score[0] === e && s.score[1] === e) return 'ferro';
  if (s.score[0] === e || s.score[1] === e) return 'onze';
  return null;
}

export function nextHand(s) {
  if (s.phase !== 'handEnd') bad('hand not finished');
  return startHand(s);
}

/** The seat that must act now, or null. */
export function actor(s) {
  if (s.phase === 'play') return s.hand.turn;
  if (s.phase === 'bet') return s.hand.bet.to;
  if (s.phase === 'onze') return responderFor(s, s.hand.onzeTeam, s.hand.leader);
  return null;
}

/** The seat of `team` that answers a request made from seat `from`: a human seat if the team has one, else the next one in order. */
export function responderFor(s, team, from) {
  const seats = seatsOf(s).filter((x) => teamOf(x) === team);
  const hum = seats.find((x) => s.humanSeats.includes(x));
  if (hum !== undefined) return hum;
  let x = from;
  for (let i = 0; i < s.n; i++) {
    x = nextSeat(s, x);
    if (teamOf(x) === team) return x;
  }
  return seats[0];
}

export function canCallTruco(s, seat) {
  const h = s.hand;
  return (
    s.phase === 'play' &&
    h.turn === seat &&
    !h.special &&
    h.value < s.maxLevel &&
    h.lastRaiser !== teamOf(seat) &&
    h.cur.length < s.n
  );
}
export function nextLevel(level) {
  const i = LEVELS.indexOf(level);
  return LEVELS[i + 1];
}
export function canRaise(s, seat) {
  return s.phase === 'bet' && s.hand.bet.to === seat && s.hand.bet.level < s.maxLevel;
}
export function canHide(s, seat) {
  const h = s.hand;
  return s.closed && s.phase === 'play' && h.turn === seat && h.tricks.length >= 1 && !h.special;
}

/** All legal actions for the actor. */
export function legalActions(s) {
  const seat = actor(s);
  if (seat === null) return [];
  const h = s.hand;
  const out = [];
  if (s.phase === 'play') {
    for (const c of h.hands[seat]) {
      out.push({ t: 'play', card: c });
      if (canHide(s, seat)) out.push({ t: 'play', card: c, hidden: true });
    }
    if (canCallTruco(s, seat)) out.push({ t: 'truco' });
  } else if (s.phase === 'bet') {
    out.push({ t: 'accept' }, { t: 'run' });
    if (canRaise(s, seat)) out.push({ t: 'raise' });
  } else if (s.phase === 'onze') {
    out.push({ t: 'accept' }, { t: 'run' });
  }
  return out;
}

function award(s, team, points, reason, ev) {
  if (team !== 'none') {
    s.score[team] += points;
  } else points = 0;
  s.stats.hands++;
  s.last = { winner: team, points, reason, no: s.hand.no, value: s.hand.value, results: s.hand.results.slice() };
  s.phase = 'handEnd';
  s.hand.bet = null;
  ev.push({ e: 'hand', winner: team, points, reason });
  if (team !== 'none' && s.score[team] >= s.target) {
    s.phase = 'gameEnd';
    s.winner = team;
    ev.push({ e: 'game', winner: team });
  }
}

/** Apply an action by `seat`. Mutates state, returns events. Throws IllegalAction when invalid. */
export function act(s, seat, a) {
  if (s.phase === 'handEnd' || s.phase === 'gameEnd') bad('no action possible in ' + s.phase);
  if (actor(s) !== seat) bad('not your turn');
  const h = s.hand;
  const ev = [];
  const team = teamOf(seat);
  switch (a.t) {
    case 'play': {
      if (s.phase !== 'play') bad('cannot play now');
      const i = h.hands[seat].indexOf(a.card);
      if (i < 0) bad('card not in hand');
      if (a.hidden && !canHide(s, seat)) bad('hidden play not allowed');
      h.hands[seat].splice(i, 1);
      const play = { seat, card: a.card, hidden: !!a.hidden };
      h.cur.push(play);
      if (!play.hidden) h.played.push(a.card);
      ev.push({ e: 'play', seat, card: a.card, hidden: play.hidden });
      if (h.cur.length === s.n) resolveTrick(s, ev);
      else h.turn = nextSeat(s, seat);
      return ev;
    }
    case 'truco': {
      if (!canCallTruco(s, seat)) bad('cannot raise now');
      const level = nextLevel(h.value);
      h.bet = { from: seat, fromTeam: team, level, to: responderFor(s, 1 - team, seat) };
      h.lastRaiser = team;
      s.phase = 'bet';
      s.stats.trucos[team]++;
      ev.push({ e: 'bet', seat, level, to: h.bet.to });
      return ev;
    }
    case 'raise': {
      if (!canRaise(s, seat)) bad('cannot re-raise');
      const level = nextLevel(h.bet.level);
      h.value = h.bet.level; // the previous level was accepted implicitly (it is the value to refuse at)
      h.bet = { from: seat, fromTeam: team, level, to: responderFor(s, 1 - team, seat) };
      h.lastRaiser = team;
      s.stats.trucos[team]++;
      ev.push({ e: 'raise', seat, level, to: h.bet.to });
      return ev;
    }
    case 'accept': {
      if (s.phase === 'onze') {
        s.phase = 'play';
        ev.push({ e: 'accept', seat, level: 3, onze: true });
        return ev;
      }
      if (s.phase !== 'bet') bad('nothing to accept');
      h.value = h.bet.level;
      ev.push({ e: 'accept', seat, level: h.value });
      h.bet = null;
      s.phase = 'play';
      return ev;
    }
    case 'run': {
      if (s.phase === 'onze') {
        s.stats.runs[team]++;
        ev.push({ e: 'run', seat, onze: true });
        award(s, 1 - team, 1, 'onzeRun', ev);
        return ev;
      }
      if (s.phase !== 'bet') bad('nothing to run from');
      // refusing: the asking team scores the value before the raise
      const pts = h.value;
      const asker = h.bet.fromTeam;
      s.stats.runs[team]++;
      ev.push({ e: 'run', seat });
      award(s, asker, pts, 'run', ev);
      return ev;
    }
    default:
      bad('unknown action ' + a.t);
  }
}

function resolveTrick(s, ev) {
  const h = s.hand;
  const w = trickWinner(h.cur, h.manilha, s.n);
  const trick = { plays: h.cur, team: w.team, seat: w.seat };
  h.tricks.push(trick);
  h.results.push(w.team);
  if (w.team !== null) s.stats.tricks[w.team]++;
  h.cur = [];
  ev.push({ e: 'trick', idx: h.tricks.length - 1, team: w.team, seat: w.seat, tie: w.tie });
  const hw = handWinner(h.results);
  if (hw !== undefined) {
    award(s, hw, h.value, hw === 'none' ? 'none' : 'tricks', ev);
    return;
  }
  // winner leads next; on a tie the same player leads again
  h.leader = w.tie ? h.leader : w.seat;
  h.turn = h.leader;
}

/** Public information visible to `seat` — never includes other seats' cards. */
export function viewFor(s, seat) {
  const h = s.hand;
  const strip = (p) => ({ seat: p.seat, card: p.hidden && p.seat !== seat ? null : p.card, hidden: !!p.hidden });
  return {
    n: s.n,
    seat,
    team: teamOf(seat),
    target: s.target,
    maxLevel: s.maxLevel,
    closed: s.closed,
    score: s.score.slice(),
    phase: s.phase,
    own: h.hands[seat].slice(),
    vira: h.vira,
    manilha: h.manilha,
    value: h.value,
    special: h.special,
    onzeTeam: h.onzeTeam,
    turn: h.turn,
    leader: h.leader,
    cur: h.cur.map(strip),
    tricks: h.tricks.map((t) => ({ team: t.team, seat: t.seat, plays: t.plays.map(strip) })),
    results: h.results.slice(),
    lastRaiser: h.lastRaiser,
    bet: h.bet ? { from: h.bet.from, fromTeam: h.bet.fromTeam, level: h.bet.level, to: h.bet.to } : null,
    played: h.played.slice(),
    cardsLeft: h.hands.map((x) => x.length),
    // in mão de onze the team at 11 may look at its partner's cards (rule), nothing else
    mates: s.phase === 'onze' && teamOf(seat) === h.onzeTeam ? Object.fromEntries(h.hands.map((x, i) => [i, x.slice()]).filter(([i]) => i !== seat && teamOf(i) === teamOf(seat))) : null,
    legal: actor(s) === seat ? legalActions(s) : [],
  };
}
