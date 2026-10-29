// Blackjack rules engine: pure, deterministic, JSON-serialisable, virtual chips only.
//
// Default table rules (all shown in the in-game rules screen):
//  * 6-deck shoe, cut card at 75% penetration (the shoe is reshuffled before the next hand once reached).
//    Options: 1 / 2 / 6 decks.
//  * Dealer stands on soft 17 (S17); option H17 (hits soft 17).
//  * Blackjack (Ace + ten-value on the first two cards, not after a split) pays 3:2 (fractions rounded down).
//  * Dealer peeks for blackjack with an Ace or ten-value card up. Insurance (max half the bet, pays 2:1) is
//    offered when the dealer shows an Ace.
//  * Double down on any first two cards (also after a split when DAS is on, the default).
//  * Split any pair of the same rank (option: any two ten-value cards), up to 3 splits (4 hands). Split Aces get
//    one card only and cannot be re-split. A 21 after a split pays 1:1 (not a blackjack).
//  * Late surrender (lose half the bet) is optional, off by default.
//  * Push on equal totals. A player 21 with three or more cards loses to nothing but a dealer blackjack.
//  * 1-3 boxes can be played at once; each box can split on its own.

export const DEFAULT_OPTS = {
  decks: 6,
  h17: false,
  das: true,
  splitByValue: false,
  surrender: false,
  insurance: true,
  boxes: 1,
  maxSplits: 3,
  min: 5,
  max: 5000,
  pen: 0.75,
};
export const START_BANKROLL = 1000;
export const CHIPS = [5, 25, 100, 500, 1000];

// ---------- seedable RNG (mulberry32; state is a uint32) ----------
export function rngNext(state) {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}
export function shuffleInPlace(arr, s) {
  for (let i = arr.length - 1; i > 0; i--) {
    const [v, n] = rngNext(s.rng);
    s.rng = n;
    const j = Math.floor(v * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- cards: id 0..51, rank 1..13 (1 = Ace), suit 0..3 ----------
export const rankOf = (id) => (id % 13) + 1;
export const suitOf = (id) => Math.floor(id / 13) % 4;
export const valueOf = (id) => Math.min(10, rankOf(id));
export const isTen = (id) => valueOf(id) === 10;
export const isAce = (id) => rankOf(id) === 1;

// { total, soft } best total of a list of cards (Aces 1 or 11 automatically)
export function total(cards) {
  let sum = 0;
  let aces = 0;
  for (const id of cards) {
    sum += valueOf(id);
    if (isAce(id)) aces++;
  }
  let soft = false;
  if (aces > 0 && sum + 10 <= 21) {
    sum += 10;
    soft = true;
  }
  return { total: sum, soft };
}
export const isBust = (cards) => total(cards).total > 21;
export const isNatural = (cards) => cards.length === 2 && total(cards).total === 21;

// ---------- state ----------
export function newGame(seed, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  if (![1, 2, 6].includes(o.decks)) o.decks = 6;
  o.boxes = Math.max(1, Math.min(3, o.boxes | 0 || 1));
  const s = {
    v: 1,
    rng: (seed >>> 0) || 1,
    opts: o,
    shoe: [],
    dealtSince: 0,
    needShuffle: true,
    bankroll: opts.bankroll ?? START_BANKROLL,
    phase: 'bet', // bet | insurance | player | dealer | settled
    boxes: [], // bet per box (0 = not played)
    hands: [], // { cards, bet, box, split, fromAce, doubled, done, result, net, surrendered }
    active: -1,
    dealer: { cards: [], hole: false }, // hole: true once the hole card is face up
    insurance: [], // per box insurance stake
    insNet: 0,
    round: 0,
    lastNet: 0,
    peeked: false,
  };
  return s;
}

export const cardsTotal = (s) => s.opts.decks * 52;
function freshShoe(s, excluding = []) {
  const shoe = [];
  for (let d = 0; d < s.opts.decks; d++) for (let i = 0; i < 52; i++) shoe.push(i);
  // when the shoe has to be rebuilt mid-round, cards on the table are removed (one copy each)
  for (const id of excluding) {
    const k = shoe.indexOf(id);
    if (k >= 0) shoe.splice(k, 1);
  }
  return shuffleInPlace(shoe, s);
}
function takeCard(s, ev) {
  if (!s.shoe.length) {
    const onTable = [...s.hands.flatMap((h) => h.cards), ...s.dealer.cards];
    s.shoe = freshShoe(s, onTable);
    s.dealtSince = onTable.length;
    s.needShuffle = false;
    if (ev) ev.push({ t: 'shuffle', mid: true });
  }
  s.dealtSince++;
  return s.shoe.pop();
}
export const penetrationReached = (s) => s.dealtSince >= Math.floor(cardsTotal(s) * s.opts.pen);

// ---------- betting ----------
export function betLimits(s) {
  return { min: s.opts.min, max: Math.min(s.opts.max, s.bankroll) };
}
// can the player afford at least a minimum bet?
export const canBet = (s) => s.bankroll >= s.opts.min;
export function validateBets(s, bets) {
  if (s.phase !== 'bet') return false;
  const b = bets.slice(0, s.opts.boxes);
  while (b.length < s.opts.boxes) b.push(0);
  let sum = 0;
  let any = false;
  for (const x of b) {
    if (!Number.isInteger(x) || x < 0) return false;
    if (x === 0) continue;
    if (x < s.opts.min || x > s.opts.max) return false;
    any = true;
    sum += x;
  }
  return any && sum <= s.bankroll ? b : false;
}

// Starts a round: takes the bets, deals, handles insurance offer / peek / naturals.
export function deal(s, bets) {
  const b = validateBets(s, bets);
  if (!b) return null;
  const ev = [];
  if (s.needShuffle || penetrationReached(s) || s.shoe.length < 6 + 8 * s.opts.boxes) {
    s.shoe = freshShoe(s);
    s.dealtSince = 0;
    s.needShuffle = false;
    ev.push({ t: 'shuffle' });
  }
  s.round++;
  s.boxes = b.slice();
  s.hands = [];
  s.insurance = Array(s.opts.boxes).fill(0);
  s.insNet = 0;
  s.dealer = { cards: [], hole: false };
  s.peeked = false;
  s.lastNet = 0;
  b.forEach((bet, box) => {
    if (bet > 0) {
      s.bankroll -= bet;
      s.hands.push({ cards: [], bet, box, split: false, fromAce: false, doubled: false, done: false, result: null, net: 0, surrendered: false });
    }
  });
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < s.hands.length; i++) {
      const c = takeCard(s, ev);
      s.hands[i].cards.push(c);
      ev.push({ t: 'deal', to: i, card: c });
    }
    const c = takeCard(s, ev);
    s.dealer.cards.push(c);
    ev.push({ t: 'deal', to: 'dealer', card: c, hidden: r === 1 });
  }
  s.active = -1;
  const up = s.dealer.cards[0];
  if (s.opts.insurance && isAce(up) && s.bankroll >= 1 && s.hands.some((h) => Math.floor(h.bet / 2) <= s.bankroll)) {
    s.phase = 'insurance';
    return ev;
  }
  afterInsurance(s, ev);
  return ev;
}

export const insuranceCost = (s) => s.hands.reduce((a, h) => a + Math.floor(h.bet / 2), 0);
export const canInsure = (s) => s.phase === 'insurance' && s.bankroll >= insuranceCost(s) && insuranceCost(s) > 0;

export function insure(s, take) {
  if (s.phase !== 'insurance') return null;
  const ev = [];
  if (take) {
    if (!canInsure(s)) return null;
    for (const h of s.hands) {
      const st = Math.floor(h.bet / 2);
      s.insurance[h.box] = st;
      s.bankroll -= st;
    }
    ev.push({ t: 'insure', amount: insuranceCost(s) });
  } else ev.push({ t: 'noInsure' });
  afterInsurance(s, ev);
  return ev;
}

function dealerHasBJ(s) {
  return isNatural(s.dealer.cards);
}
function afterInsurance(s, ev) {
  const up = s.dealer.cards[0];
  if (isAce(up) || isTen(up)) {
    s.peeked = true;
    if (dealerHasBJ(s)) {
      s.dealer.hole = true;
      ev.push({ t: 'peek', blackjack: true });
      for (const h of s.hands) h.done = true;
      settle(s, ev);
      return;
    }
    ev.push({ t: 'peek', blackjack: false });
  }
  // insurance stakes are lost when the dealer has no blackjack
  s.insNet = -s.insurance.reduce((a, b) => a + b, 0);
  s.phase = 'player';
  for (const h of s.hands) if (isNatural(h.cards)) h.done = true;
  advance(s, ev);
}

// move to the next hand that needs a decision; when none is left, play the dealer / settle
function advance(s, ev) {
  const i = s.hands.findIndex((h) => !h.done);
  if (i >= 0) {
    s.active = i;
    s.phase = 'player';
    const h = s.hands[i];
    if (h.cards.length === 2 && total(h.cards).total === 21) {
      // 21 after a split: stands automatically
      h.done = true;
      return advance(s, ev);
    }
    return;
  }
  s.active = -1;
  const live = s.hands.some((h) => !h.surrendered && !isBust(h.cards) && !(!h.split && isNatural(h.cards)));
  s.phase = 'dealer';
  if (!live) {
    s.dealer.hole = true;
    ev.push({ t: 'reveal' });
    settle(s, ev);
  }
}

// ---------- player actions ----------
export function activeHand(s) {
  return s.active >= 0 ? s.hands[s.active] : null;
}
const boxHands = (s, box) => s.hands.filter((h) => h.box === box).length;

export function canSplit(s) {
  const h = activeHand(s);
  if (!h || s.phase !== 'player' || h.cards.length !== 2 || h.done) return false;
  if (boxHands(s, h.box) >= 1 + s.opts.maxSplits) return false;
  if (s.bankroll < h.bet) return false;
  const [a, b] = h.cards;
  const same = s.opts.splitByValue ? valueOf(a) === valueOf(b) : rankOf(a) === rankOf(b);
  if (!same) return false;
  return true;
}
export function canDouble(s) {
  const h = activeHand(s);
  if (!h || s.phase !== 'player' || h.cards.length !== 2 || h.done) return false;
  if (h.fromAce) return false; // split Aces receive a single card
  if (h.split && !s.opts.das) return false;
  return s.bankroll >= h.bet;
}
export function canSurrender(s) {
  const h = activeHand(s);
  return !!h && s.opts.surrender && s.phase === 'player' && h.cards.length === 2 && !h.split && s.hands.filter((x) => x.box === h.box).length === 1 && !h.done;
}
export function legalActions(s) {
  const h = activeHand(s);
  const ok = !!h && s.phase === 'player' && !h.done;
  return { hit: ok, stand: ok, double: canDouble(s), split: canSplit(s), surrender: canSurrender(s) };
}

export function hit(s) {
  if (!legalActions(s).hit) return null;
  const ev = [];
  const h = activeHand(s);
  const c = takeCard(s, ev);
  h.cards.push(c);
  ev.push({ t: 'deal', to: s.active, card: c });
  const tt = total(h.cards).total;
  if (tt > 21) {
    ev.push({ t: 'bust', hand: s.active });
    h.done = true;
    advance(s, ev);
  } else if (tt === 21) {
    h.done = true;
    advance(s, ev);
  }
  return ev;
}
export function stand(s) {
  if (!legalActions(s).stand) return null;
  activeHand(s).done = true;
  const ev = [{ t: 'stand', hand: s.active }];
  advance(s, ev);
  return ev;
}
export function doubleDown(s) {
  if (!canDouble(s)) return null;
  const ev = [];
  const h = activeHand(s);
  s.bankroll -= h.bet;
  h.bet *= 2;
  h.doubled = true;
  const c = takeCard(s, ev);
  h.cards.push(c);
  ev.push({ t: 'double', hand: s.active });
  ev.push({ t: 'deal', to: s.active, card: c });
  if (isBust(h.cards)) ev.push({ t: 'bust', hand: s.active });
  h.done = true;
  advance(s, ev);
  return ev;
}
export function split(s) {
  if (!canSplit(s)) return null;
  const ev = [];
  const i = s.active;
  const h = s.hands[i];
  s.bankroll -= h.bet;
  const ace = isAce(h.cards[0]);
  const second = { cards: [h.cards.pop()], bet: h.bet, box: h.box, split: true, fromAce: ace, doubled: false, done: false, result: null, net: 0, surrendered: false };
  h.split = true;
  h.fromAce = ace;
  s.hands.splice(i + 1, 0, second);
  ev.push({ t: 'split', hand: i });
  const c1 = takeCard(s, ev);
  h.cards.push(c1);
  ev.push({ t: 'deal', to: i, card: c1 });
  const c2 = takeCard(s, ev);
  second.cards.push(c2);
  ev.push({ t: 'deal', to: i + 1, card: c2 });
  if (ace) {
    // split Aces receive exactly one card each and cannot be re-split or doubled
    h.done = true;
    second.done = true;
  }
  advance(s, ev);
  return ev;
}
export function surrender(s) {
  if (!canSurrender(s)) return null;
  const h = activeHand(s);
  h.surrendered = true;
  h.done = true;
  const ev = [{ t: 'surrender', hand: s.active }];
  advance(s, ev);
  return ev;
}

// ---------- dealer ----------
// Does the dealer draw with these cards under the table rules?
export function dealerMustHit(s, cards = s.dealer.cards) {
  const { total: t, soft } = total(cards);
  if (t < 17) return true;
  if (t === 17 && soft && s.opts.h17) return true;
  return false;
}
// One dealer step: reveal the hole card first, then draw one card per call. Returns events,
// or null if it is not the dealer's turn. Settles when the dealer stands/busts.
export function dealerStep(s) {
  if (s.phase !== 'dealer') return null;
  const ev = [];
  if (!s.dealer.hole) {
    s.dealer.hole = true;
    ev.push({ t: 'reveal' });
    return ev;
  }
  if (dealerMustHit(s)) {
    const c = takeCard(s, ev);
    s.dealer.cards.push(c);
    ev.push({ t: 'deal', to: 'dealer', card: c });
    return ev;
  }
  settle(s, ev);
  return ev;
}
export function dealerPlay(s) {
  const all = [];
  let guard = 0;
  while (s.phase === 'dealer' && guard++ < 60) all.push(...dealerStep(s));
  return all;
}

// ---------- settlement ----------
export function handResult(s, h) {
  const d = total(s.dealer.cards).total;
  const dBJ = dealerHasBJ(s);
  const p = total(h.cards).total;
  if (h.surrendered) return 'surrender';
  if (p > 21) return 'bust';
  const pBJ = !h.split && isNatural(h.cards);
  if (pBJ && dBJ) return 'push';
  if (pBJ) return 'blackjack';
  if (dBJ) return 'lose';
  if (d > 21) return 'win';
  if (p > d) return 'win';
  if (p === d) return 'push';
  return 'lose';
}
export function payout(h, result) {
  // returns { back, net } : chips returned to the bankroll and net profit of the hand
  switch (result) {
    case 'blackjack': {
      const win = Math.floor(h.bet * 1.5);
      return { back: h.bet + win, net: win };
    }
    case 'win':
      return { back: h.bet * 2, net: h.bet };
    case 'push':
      return { back: h.bet, net: 0 };
    case 'surrender': {
      const half = Math.floor(h.bet / 2);
      return { back: half, net: -(h.bet - half) };
    }
    default:
      return { back: 0, net: -h.bet };
  }
}
function settle(s, ev) {
  const dBJ = dealerHasBJ(s);
  let net = 0;
  for (const h of s.hands) {
    h.result = handResult(s, h);
    const { back, net: n } = payout(h, h.result);
    s.bankroll += back;
    h.net = n;
    net += n;
  }
  // insurance: pays 2:1 when the dealer has blackjack
  let insNet = 0;
  s.insurance.forEach((st) => {
    if (st > 0) {
      if (dBJ) {
        s.bankroll += st * 3;
        insNet += st * 2;
      } else insNet -= st;
    }
  });
  s.insNet = insNet;
  s.lastNet = net + insNet;
  s.phase = 'settled';
  s.active = -1;
  ev.push({ t: 'settle', net: s.lastNet, results: s.hands.map((h) => h.result) });
}

// back to betting for the next hand
export function nextHand(s) {
  if (s.phase !== 'settled') return null;
  s.phase = 'bet';
  s.hands = [];
  s.active = -1;
  s.dealer = { cards: [], hole: false };
  s.insurance = [];
  return [];
}
export function refill(s, amount = START_BANKROLL) {
  if (s.phase !== 'bet') return null;
  s.bankroll = amount;
  return [{ t: 'refill' }];
}

// chips currently committed on the table (for conservation checks)
export function escrow(s) {
  if (s.phase === 'settled' || s.phase === 'bet') return 0;
  return s.hands.reduce((a, h) => a + h.bet, 0) + s.insurance.reduce((a, b) => a + b, 0);
}

// ---------- challenge mode ----------
// level -> { goal, hands }; the bankroll restarts at 1000 for every level
export function challengeLevel(level) {
  const L = Math.max(1, level | 0);
  const table = [
    [2500, 25],
    [5000, 35],
    [7500, 45],
    [10000, 50],
    [15000, 60],
  ];
  if (L <= table.length) return { level: L, goal: table[L - 1][0], hands: table[L - 1][1] };
  return { level: L, goal: 15000 + 5000 * (L - 5), hands: 60 + 5 * (L - 5) };
}
