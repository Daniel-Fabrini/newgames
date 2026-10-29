// Color Rush rules engine (an original UNO-style shedding game): pure, deterministic, JSON-serialisable.
//
// Variant implemented (also shown in the in-game rules screen):
//  * 108-card deck: per colour one 0, two each of 1-9, Skip, Reverse, Draw Two (25 x 4) + 4 Wild + 4 Wild Draw Four.
//  * 7 cards each. First discard comes from the deck: a Wild Draw Four is shuffled back; Skip / Reverse /
//    Draw Two apply to the first player as in the official rules; a Wild lets the first player pick the colour.
//  * Play a card matching the active colour, the number or the symbol, or any Wild.
//  * Wild Draw Four: legally playable only with no card of the active colour. With challenges ON it may be
//    played any time (a bluff); the next player may challenge: success -> the player draws 4 (the challenger
//    plays normally), failure -> the challenger draws 6 and loses the turn. With challenges OFF it is simply
//    only playable when you hold no card of the active colour.
//  * Reverse acts as Skip with 2 players. Draw Two: next player draws 2 and loses the turn (optional stacking:
//    Draw Two on Draw Two accumulates the penalty).
//  * Unable (or unwilling) to play: draw one card; if it is playable you may play it at once, otherwise pass.
//  * "ONE!" call: when you go down to a single card you must have called before or right after playing it.
//    If an opponent catches you before the next action, you draw 2.
//  * A round ends when a hand is empty; the winner scores the points of all the other hands
//    (number = face value, Skip / Reverse / Draw Two = 20, Wild / Wild Draw Four = 50).
//  * The match is played to a target score (100 / 200 / 500).
//  * The draw pile is replenished by reshuffling the discard pile (except the top card) with the seeded PRNG.

export const COLORS = ['R', 'Y', 'G', 'B']; // index 0..3; 4 = wild
export const K_SKIP = 10;
export const K_REV = 11;
export const K_D2 = 12;
export const K_WILD = 13;
export const K_WD4 = 14;
export const HAND = 7;
export const DECK_SIZE = 108;

// ---------- seedable RNG (mulberry32; state is a plain uint32) ----------
export function rngNext(state) {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}
function rnd(s) {
  const [v, n] = rngNext(s.rng);
  s.rng = n;
  return v;
}
export function shuffleInPlace(arr, s) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- cards ----------
// A card is an integer id 0..107. Layout: 4 colours x 25 (0, 1-9 x2, skip x2, rev x2, d2 x2), then 4 wild, 4 wd4.
export function cardOf(id) {
  if (id >= 100) return { color: 4, kind: id < 104 ? K_WILD : K_WD4 };
  const c = Math.floor(id / 25);
  const r = id % 25;
  let kind;
  if (r === 0) kind = 0;
  else if (r <= 18) kind = Math.floor((r - 1) / 2) + 1;
  else kind = K_SKIP + Math.floor((r - 19) / 2);
  return { color: c, kind };
}
export const colorOf = (id) => cardOf(id).color;
export const kindOf = (id) => cardOf(id).kind;
export const isWild = (id) => id >= 100;
export const isWd4 = (id) => id >= 104;
export function cardPoints(id) {
  const k = kindOf(id);
  if (k <= 9) return k;
  if (k <= K_D2) return 20;
  return 50;
}
export const handPoints = (hand) => hand.reduce((a, id) => a + cardPoints(id), 0);
export const newDeck = () => Array.from({ length: DECK_SIZE }, (_, i) => i);

// ---------- state ----------
export const DEFAULT_OPTS = { players: 4, target: 200, challenges: true, stack: false };

export function newMatch(seed, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  o.players = o.players === 2 ? 2 : o.players === 3 ? 3 : 4;
  const s = {
    v: 1,
    rng: (seed >>> 0) || 1,
    opts: o,
    round: 0,
    scores: Array(o.players).fill(0),
    hands: [],
    draw: [],
    discard: [],
    color: 4,
    dir: 1,
    turn: 0,
    pend: 0,
    drawn: null,
    said: Array(o.players).fill(false),
    vul: null,
    chal: null,
    phase: 'turn',
    winner: null,
    last: null,
    matchWinner: null,
  };
  startRound(s);
  return s;
}

const mod = (a, n) => ((a % n) + n) % n;
export const nextSeat = (s, from = s.turn, steps = 1) => mod(from + s.dir * steps, s.opts.players);

// Deals a fresh round. Returns the list of events (deal + first-card effects).
export function startRound(s) {
  const n = s.opts.players;
  s.round++;
  s.draw = shuffleInPlace(newDeck(), s);
  s.discard = [];
  s.hands = Array.from({ length: n }, () => []);
  for (let r = 0; r < HAND; r++) for (let p = 0; p < n; p++) s.hands[p].push(s.draw.pop());
  s.said = Array(n).fill(false);
  s.vul = null;
  s.chal = null;
  s.pend = 0;
  s.drawn = null;
  s.dir = 1;
  s.winner = null;
  s.last = null;
  const first = (s.round - 1) % n;
  const dealer = mod(first - 1, n);
  // first discard: a Wild Draw Four goes back into the deck and we try again
  let top;
  for (;;) {
    top = s.draw.pop();
    if (!isWd4(top)) break;
    s.draw.push(top);
    shuffleInPlace(s.draw, s);
  }
  s.discard.push(top);
  const ev = [{ t: 'deal', round: s.round, dealer, first }];
  const c = cardOf(top);
  s.color = c.color;
  s.turn = first;
  s.phase = 'turn';
  ev.push({ t: 'flip', card: top });
  if (c.kind === K_WILD) {
    s.phase = 'startColor';
  } else if (c.kind === K_SKIP) {
    ev.push({ t: 'skip', p: first });
    s.turn = nextSeat(s, first);
  } else if (c.kind === K_REV) {
    s.dir = -1;
    // 2 players: acts as Skip (the dealer plays first); otherwise the dealer starts, going the other way
    s.turn = dealer;
    ev.push({ t: 'reverse' });
  } else if (c.kind === K_D2) {
    ev.push(...giveEv(s, first, 2, 'penalty'));
    s.turn = nextSeat(s, first);
  }
  return ev;
}

// ---------- internals ----------
function reshuffleIfNeeded(s, ev) {
  if (s.draw.length > 0 || s.discard.length <= 1) return;
  const top = s.discard.pop();
  s.draw = shuffleInPlace(s.discard.splice(0), s);
  s.discard = [top];
  if (ev) ev.push({ t: 'reshuffle', n: s.draw.length });
}
function takeCards(s, p, n, ev) {
  const got = [];
  for (let i = 0; i < n; i++) {
    reshuffleIfNeeded(s, ev);
    if (!s.draw.length) break;
    const id = s.draw.pop();
    s.hands[p].push(id);
    got.push(id);
  }
  if (got.length) s.said[p] = false;
  return got;
}
function giveEv(s, p, n, why) {
  const ev = [];
  const ids = takeCards(s, p, n, ev);
  ev.push({ t: 'draw', p, n: ids.length, ids, why });
  return ev;
}

export function topCard(s) {
  return s.discard[s.discard.length - 1];
}

// ---------- legality ----------
export function isPlayable(s, p, id) {
  if (s.phase === 'drawn') return p === s.turn && id === s.drawn;
  if (s.phase !== 'turn' || p !== s.turn) return false;
  if (!s.hands[p].includes(id)) return false;
  const c = cardOf(id);
  if (s.pend > 0) return c.kind === K_D2; // stacking: only Draw Two answers a Draw Two
  if (c.kind === K_WILD) return true;
  if (c.kind === K_WD4) return s.opts.challenges ? true : !holdsColor(s, p, s.color);
  return c.color === s.color || c.kind === kindOf(topCard(s));
}
export function holdsColor(s, p, color, except = -1) {
  return s.hands[p].some((id) => id !== except && colorOf(id) === color);
}
export const legalPlays = (s, p) => s.hands[p].filter((id) => isPlayable(s, p, id));
// true when playing this WD4 now would be a bluff (a card of the active colour is in the hand)
export const wd4IsBluff = (s, p) => holdsColor(s, p, s.color);

// ---------- actions (each returns an event list, or null when the action is illegal) ----------
function clearVul(s) {
  s.vul = null;
}

export function chooseStartColor(s, p, color) {
  if (s.phase !== 'startColor' || p !== s.turn || !(color >= 0 && color < 4)) return null;
  s.color = color;
  s.phase = 'turn';
  return [{ t: 'color', p, color }];
}

export function play(s, p, id, color) {
  if (!isPlayable(s, p, id)) return null;
  const c = cardOf(id);
  if (c.color === 4 && !(color >= 0 && color < 4)) return null;
  clearVul(s);
  const ev = [];
  const n = s.opts.players;
  const prevColor = s.color;
  const bluff = c.kind === K_WD4 ? holdsColor(s, p, prevColor, id) : false;
  const wasPend = s.pend;
  s.hands[p].splice(s.hands[p].indexOf(id), 1);
  s.discard.push(id);
  s.drawn = null;
  s.phase = 'turn';
  s.color = c.color === 4 ? color : c.color;
  ev.push({ t: 'play', p, card: id, color: s.color });
  if (s.hands[p].length === 1 && !s.said[p]) s.vul = p;
  let resolved = true;
  switch (c.kind) {
    case K_SKIP: {
      const v = nextSeat(s);
      ev.push({ t: 'skip', p: v });
      s.turn = nextSeat(s, s.turn, 2);
      break;
    }
    case K_REV:
      s.dir = -s.dir;
      ev.push({ t: 'reverse' });
      if (n === 2) {
        ev.push({ t: 'skip', p: nextSeat(s) });
        s.turn = p;
      } else s.turn = nextSeat(s);
      break;
    case K_D2:
      if (s.opts.stack) {
        s.pend = wasPend + 2;
        s.turn = nextSeat(s);
      } else {
        const v = nextSeat(s);
        ev.push(...giveEv(s, v, 2, 'penalty'));
        s.turn = nextSeat(s, s.turn, 2);
      }
      break;
    case K_WILD:
      s.turn = nextSeat(s);
      break;
    case K_WD4:
      if (s.opts.challenges) {
        s.chal = { by: nextSeat(s), target: p, bluff, prevColor };
        s.phase = 'challenge';
        s.turn = s.chal.by;
        resolved = false;
      } else {
        ev.push(...giveEv(s, nextSeat(s), 4, 'penalty'));
        s.turn = nextSeat(s, s.turn, 2);
      }
      break;
    default:
      s.turn = nextSeat(s);
  }
  if (resolved) checkRoundEnd(s, p, ev);
  return ev;
}

// The next player answers a Wild Draw Four.
export function challenge(s, p, yes) {
  if (s.phase !== 'challenge' || !s.chal || s.chal.by !== p) return null;
  clearVul(s);
  const { target, bluff } = s.chal;
  const ev = [];
  s.chal = null;
  s.phase = 'turn';
  if (!yes) {
    ev.push({ t: 'challenge', p, yes: false });
    ev.push(...giveEv(s, p, 4, 'penalty'));
    s.turn = nextSeat(s, p);
  } else if (bluff) {
    ev.push({ t: 'challenge', p, yes: true, ok: true, target });
    ev.push(...giveEv(s, target, 4, 'challenge'));
    s.turn = p; // the challenger plays normally
  } else {
    ev.push({ t: 'challenge', p, yes: true, ok: false, target });
    ev.push(...giveEv(s, p, 6, 'challenge'));
    s.turn = nextSeat(s, p);
  }
  checkRoundEnd(s, target, ev);
  return ev;
}

export function draw(s, p) {
  if (p !== s.turn || s.phase !== 'turn') return null;
  clearVul(s);
  const ev = [];
  if (s.pend > 0) {
    const k = s.pend;
    s.pend = 0;
    ev.push(...giveEv(s, p, k, 'penalty'));
    s.turn = nextSeat(s, p);
    return ev;
  }
  const ids = takeCards(s, p, 1, ev);
  ev.push({ t: 'draw', p, n: ids.length, ids, why: 'turn', color: s.color });
  const id = ids[0];
  if (id !== undefined && canPlayDrawn(s, p, id)) {
    s.phase = 'drawn';
    s.drawn = id;
  } else {
    ev.push({ t: 'pass', p, drew: true, color: s.color });
    s.turn = nextSeat(s, p);
  }
  return ev;
}
function canPlayDrawn(s, p, id) {
  const c = cardOf(id);
  if (c.kind === K_WILD) return true;
  if (c.kind === K_WD4) return s.opts.challenges ? true : !holdsColor(s, p, s.color);
  return c.color === s.color || c.kind === kindOf(topCard(s));
}

export function pass(s, p) {
  if (s.phase !== 'drawn' || p !== s.turn) return null;
  clearVul(s);
  s.phase = 'turn';
  s.drawn = null;
  s.turn = nextSeat(s, p);
  return [{ t: 'pass', p, drew: true, color: s.color }];
}

export function callUno(s, p) {
  if (s.phase === 'roundEnd' || s.phase === 'matchEnd') return null;
  if (s.vul === p) {
    s.vul = null;
    s.said[p] = true;
    return [{ t: 'uno', p, late: true }];
  }
  if (p === s.turn && (s.phase === 'turn' || s.phase === 'drawn') && s.hands[p].length <= 2 && s.hands[p].length >= 1 && !s.said[p]) {
    s.said[p] = true;
    return [{ t: 'uno', p, late: false }];
  }
  return null;
}

export function catchUno(s, by, target) {
  if (s.vul === null || s.vul !== target || by === target) return null;
  s.vul = null;
  const ev = [{ t: 'caught', by, p: target }];
  ev.push(...giveEv(s, target, 2, 'caught'));
  return ev;
}

function checkRoundEnd(s, p, ev) {
  if (s.hands[p].length !== 0) return;
  s.winner = p;
  let pts = 0;
  s.hands.forEach((h, i) => {
    if (i !== p) pts += handPoints(h);
  });
  s.scores[p] += pts;
  s.last = { winner: p, points: pts, hands: s.hands.map((h) => h.slice()) };
  s.vul = null;
  s.chal = null;
  s.pend = 0;
  if (s.scores[p] >= s.opts.target) {
    s.phase = 'matchEnd';
    s.matchWinner = p;
  } else s.phase = 'roundEnd';
  ev.push({ t: 'roundEnd', winner: p, points: pts, match: s.phase === 'matchEnd' });
}

// ---------- public view (what a seat may legitimately know) ----------
export function publicView(s, p) {
  return {
    seat: p,
    n: s.opts.players,
    opts: s.opts,
    hand: s.hands[p].slice(),
    counts: s.hands.map((h) => h.length),
    scores: s.scores.slice(),
    top: topCard(s),
    color: s.color,
    dir: s.dir,
    turn: s.turn,
    phase: s.phase,
    pend: s.pend,
    drawn: s.turn === p ? s.drawn : null,
    drawLeft: s.draw.length,
    chal: s.chal ? { by: s.chal.by, target: s.chal.target, prevColor: s.chal.prevColor } : null,
    vul: s.vul,
    said: s.said.slice(),
    legal: s.turn === p ? legalPlays(s, p) : [],
  };
}
// strip hidden card identities from an event for a given seat
export function publicEvent(e, seat) {
  if (e.t === 'draw' && e.p !== seat) {
    const { ids, ...rest } = e;
    return rest;
  }
  return e;
}

// ---------- deck integrity helper (used by tests) ----------
export function allCards(s) {
  return [...s.draw, ...s.discard, ...s.hands.flat()].sort((a, b) => a - b);
}
