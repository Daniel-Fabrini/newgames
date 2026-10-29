// Buraco Aberto (Brazilian rules) — pure, JSON-serialisable engine. No DOM, no Math.random.
//
// Cards: id 0..107. Two decks of 54 (52 + 2 jokers). k = id % 54; k >= 52 -> joker;
// suit = floor(k/13) (0 spades, 1 hearts, 2 diamonds, 3 clubs); rank = k%13+1 (1 = ace ... 13 = king).
// Seats: n = 4 -> 0 you, 1 left opponent, 2 partner, 3 right opponent (team = seat % 2);
//        n = 2 -> 0 you, 1 opponent (team = seat).
// A meld ("jogo") is { id, suit, cards: [{ id, r, w }] } sorted by r; r is the slot rank 1..14
// (ace low = 1, ace high = 14) and w marks a card that stands in for another (wild).
// `apply` mutates the state; `checkAction` never does. Everything is plain data.

export const SUITS = ['♠', '♥', '♦', '♣'];
export const TEAM_SIZE = 11;
export const BONUS = { clean: 200, dirty: 100, real: 500, bater: 100, noMorto: -100 };

export const cardSuit = (id) => Math.floor((id % 54) / 13);
export const cardRank = (id) => ((id % 54) % 13) + 1;
export const isJoker = (id) => id % 54 >= 52;
export const isTwo = (id) => !isJoker(id) && cardRank(id) === 2;
export const isWildCard = (id) => isJoker(id) || isTwo(id);
export function cardPoints(id) {
  if (isJoker(id)) return 50;
  const r = cardRank(id);
  if (r === 2) return 20;
  if (r === 1) return 15;
  return r >= 8 ? 10 : 5;
}
export const teamOf = (n, seat) => (n === 2 ? seat : seat % 2);
export const teamSeats = (n, team) => (n === 2 ? [team] : [team, team + 2]);

// ---------- rng ----------
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function freshSeed() {
  try {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    return b[0] | 0;
  } catch (e) {
    return (Date.now() ^ (Math.random() * 4294967296)) | 0;
  }
}

// ---------- sequence arrangement ----------
// Does card `id` fit naturally at slot rank p of a meld of suit s?
function fitsNatural(id, s, p) {
  if (isJoker(id) || cardSuit(id) !== s) return false;
  const r = cardRank(id);
  return r === p || (r === 1 && p === 14);
}
const typeKey = (id) => (isJoker(id) ? 'J' : cardSuit(id) * 20 + cardRank(id));

// Assign each card to one of the `positions` (set of slot ranks). Returns the first valid
// assignment [{id,r,w}] or null. At most `wildLeft` cards may be wild.
function place(ids, positions, s, wildLeft) {
  const used = new Array(ids.length).fill(false);
  const out = [];
  const rec = (pi, wl) => {
    if (pi === positions.length) return true;
    const p = positions[pi];
    const tried = new Set();
    for (let i = 0; i < ids.length; i++) {
      if (used[i]) continue;
      const k = typeKey(ids[i]);
      if (tried.has(k)) continue;
      if (!fitsNatural(ids[i], s, p)) continue;
      tried.add(k);
      used[i] = true;
      out.push({ id: ids[i], r: p, w: false });
      if (rec(pi + 1, wl)) return true;
      out.pop();
      used[i] = false;
    }
    if (wl > 0) {
      const tried2 = new Set();
      for (let i = 0; i < ids.length; i++) {
        if (used[i] || !isWildCard(ids[i]) || fitsNatural(ids[i], s, p)) continue;
        const k = typeKey(ids[i]);
        if (tried2.has(k)) continue;
        tried2.add(k);
        used[i] = true;
        out.push({ id: ids[i], r: p, w: true });
        if (rec(pi + 1, wl - 1)) return true;
        out.pop();
        used[i] = false;
      }
    }
    return false;
  };
  return rec(0, wildLeft) ? out.slice() : null;
}

const sig = (slots) => slots.map((c) => `${c.r}${c.w ? 'w' : ''}`).join(',');

// All distinct valid ways to turn `ids` (>= 3 cards) into a brand-new meld.
export function arrangements(ids) {
  const res = [];
  const m = ids.length;
  if (m < 3 || m > 13 || new Set(ids).size !== m) return res;
  const seen = new Set();
  for (let s = 0; s < 4; s++) {
    for (let lo = 1; lo + m - 1 <= 14; lo++) {
      if (lo === 1 && m === 14) continue;
      const positions = [];
      for (let p = lo + m - 1; p >= lo; p--) positions.push(p); // high first -> wild tends to the high end
      const a = place(ids, positions, s, 1);
      if (!a) continue;
      a.sort((x, y) => x.r - y.r);
      const key = s + '|' + sig(a);
      if (seen.has(key)) continue;
      seen.add(key);
      res.push({ suit: s, cards: a });
    }
  }
  res.sort((x, y) => wildCount(x.cards) - wildCount(y.cards));
  return res;
}

export const wildCount = (cards) => cards.reduce((n, c) => n + (c.w ? 1 : 0), 0);

// All distinct valid ways to add `ids` to an existing meld (existing slots stay put).
export function extensions(meld, ids) {
  const res = [];
  const m = ids.length;
  if (m < 1 || new Set(ids).size !== m) return res;
  const lo = meld.cards[0].r;
  const hi = meld.cards[meld.cards.length - 1].r;
  if (meld.cards.length + m > 13) return res;
  const wl = 1 - wildCount(meld.cards);
  const seen = new Set();
  for (let kh = m; kh >= 0; kh--) {
    const kl = m - kh;
    if (lo - kl < 1 || hi + kh > 14) continue;
    if (lo - kl === 1 && hi + kh === 14) continue;
    const positions = [];
    for (let p = hi + kh; p > hi; p--) positions.push(p);
    for (let p = lo - 1; p >= lo - kl; p--) positions.push(p);
    const a = place(ids, positions, meld.suit, wl);
    if (!a) continue;
    const cards = meld.cards.concat(a).sort((x, y) => x.r - y.r);
    const key = sig(cards);
    if (seen.has(key)) continue;
    seen.add(key);
    res.push({ suit: meld.suit, cards });
  }
  res.sort((x, y) => wildCount(x.cards) - wildCount(y.cards));
  return res;
}

export const meldSize = (m) => m.cards.length;
export const isClean = (m) => wildCount(m.cards) === 0;
// null | 'dirty' | 'clean' | 'real'
export function canastraKind(m) {
  if (m.cards.length < 7) return null;
  if (!isClean(m)) return 'dirty';
  return m.cards.length >= 13 ? 'real' : 'clean';
}
export const meldPoints = (m) => m.cards.reduce((s, c) => s + cardPoints(c.id), 0);

// ---------- round setup ----------
export function newRound(opts = {}) {
  const n = opts.n === 2 ? 2 : 4;
  const seed = opts.seed ?? freshSeed();
  const rnd = mulberry32(seed);
  const deck = shuffled([...Array(108).keys()], rnd);
  const hands = [];
  for (let s = 0; s < n; s++) hands.push(deck.splice(0, TEAM_SIZE));
  const mortos = [deck.splice(0, TEAM_SIZE), deck.splice(0, TEAM_SIZE)];
  const pile = [deck.pop()];
  const dealer = opts.dealer ?? 0;
  return {
    v: 1,
    n,
    seed,
    cleanOut: !!opts.cleanOut,
    dealer,
    turn: (dealer + 1) % n,
    turnNo: 0,
    phase: 'draw', // draw | play | end
    hands,
    stock: deck,
    pile,
    mortos,
    mortoTaken: [false, false],
    mortoBy: [null, null],
    melds: [[], []],
    nextMeldId: 1,
    pileTakes: [], // public: { seat, ids, turnNo } — what each seat picked up from the lixo
    drew: null, // 'stock' | 'pile' this turn
    ended: null, // { reason: 'bater'|'stock'|'stop', seat, team }
  };
}

// ---------- queries ----------
export function teamCanastras(state, team) {
  return state.melds[team].filter((m) => m.cards.length >= 7);
}
export function canGoOut(state, team, extraMelds = []) {
  const all = state.melds[team].concat(extraMelds);
  return all.some((m) => {
    const k = canastraKind(m);
    return k && (!state.cleanOut || k !== 'dirty');
  });
}
const meldById = (state, team, id) => state.melds[team].find((m) => m.id === id);

// Pick the preferred arrangement: explicit index, else the first (cleanest).
function pickArr(list, idx) {
  if (!list.length) return null;
  return list[Math.min(Math.max(idx | 0, 0), list.length - 1)];
}

// Would `remaining` cards in hand after a play be a dead end? Returns an error code or null.
function handEndError(state, team, remaining, melds) {
  if (remaining === 0) {
    if (!state.mortoTaken[team] && state.mortos[team]) return null; // takes the morto
    return canGoOut(state, team, melds) ? null : 'needCanastra';
  }
  if (remaining === 1 && state.mortoTaken[team] && !canGoOut(state, team, melds)) return 'lastCard';
  return null;
}

// Can `seat` take the lixo right now? Returns the list of legal first plays (may be long).
export function pilePlays(state, seat, limit = 1e9) {
  const top = state.pile[state.pile.length - 1];
  if (top === undefined) return [];
  const team = teamOf(state.n, seat);
  const hand = state.hands[seat];
  const plays = [];
  for (const m of state.melds[team]) {
    const arrs = extensions(m, [top]);
    if (arrs.length) {
      const p = { t: 'add', meld: m.id, ids: [top], arr: 0 };
      if (playOk(state, seat, p)) plays.push(p);
    }
    if (plays.length >= limit) return plays;
  }
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const ids = [top, hand[i], hand[j]];
      if (arrangements(ids).length) {
        const p = { t: 'meld', ids, arr: 0 };
        if (playOk(state, seat, p)) plays.push(p);
        if (plays.length >= limit) return plays;
      }
    }
  }
  return plays;
}
function playOk(state, seat, play) {
  if (state.turn !== seat) return true;
  const ph = state.phase;
  state.phase = 'draw';
  const ok = checkAction(state, { type: 'take', play }).ok;
  state.phase = ph;
  return ok;
}
export function canTakePile(state, seat) {
  return pilePlays(state, seat, 1).length > 0;
}

// ---------- action validation ----------
// action: draw | take {play} | meld {ids,arr} | add {meld,ids,arr} | discard {id} | stop
// Returns { ok: true, ... } or { ok: false, code }.
export function checkAction(state, action) {
  if (state.phase === 'end') return { ok: false, code: 'ended' };
  const seat = state.turn;
  const team = teamOf(state.n, seat);
  const hand = state.hands[seat];
  const bad = (code) => ({ ok: false, code });
  switch (action.type) {
    case 'draw':
      if (state.phase !== 'draw') return bad('phase');
      if (!state.stock.length) return bad('stockEmpty');
      return { ok: true };
    case 'stop':
      if (state.phase !== 'draw' || state.stock.length) return bad('phase');
      return { ok: true };
    case 'take': {
      if (state.phase !== 'draw') return bad('phase');
      const play = action.play;
      if (!play || !state.pile.length) return bad('cantTake');
      const top = state.pile[state.pile.length - 1];
      const avail = new Set(hand.concat(state.pile));
      const ids = play.ids || [];
      if (!ids.includes(top) || new Set(ids).size !== ids.length || ids.some((x) => !avail.has(x))) return bad('cantTake');
      let after = hand.length + state.pile.length - ids.length;
      let res;
      if (play.t === 'add') {
        const m = meldById(state, team, play.meld);
        if (!m) return bad('cantTake');
        const arr = pickArr(extensions(m, ids), play.arr);
        if (!arr) return bad('cantTake');
        res = { ok: true, arr, after };
      } else {
        const arr = pickArr(arrangements(ids), play.arr);
        if (!arr) return bad('cantTake');
        res = { ok: true, arr, after };
      }
      if (after <= 1 && state.mortoTaken[team]) {
        // a lone card left would need to go out
        const extra = play.t === 'meld' ? [{ id: 0, suit: res.arr.suit, cards: res.arr.cards }] : [];
        const err = handEndError(state, team, after, extra);
        if (err) return bad(err);
      }
      return res;
    }
    case 'meld':
    case 'add': {
      if (state.phase !== 'play') return bad('phase');
      const ids = action.ids || [];
      if (!ids.length || new Set(ids).size !== ids.length || ids.some((x) => !hand.includes(x))) return bad('notInHand');
      let arr;
      let extra = [];
      if (action.type === 'meld') {
        if (ids.length < 3) return bad('tooFew');
        const list = arrangements(ids);
        arr = pickArr(list, action.arr);
        if (!arr) return bad('invalidMeld');
        extra = [{ id: 0, suit: arr.suit, cards: arr.cards }];
      } else {
        const m = meldById(state, team, action.meld);
        if (!m) return bad('noMeld');
        const list = extensions(m, ids);
        arr = pickArr(list, action.arr);
        if (!arr) return bad(extensions(m, ids).length ? 'invalidAdd' : addReason(m, ids));
        // melds after the add, for canastra detection
        extra = [{ id: m.id, suit: m.suit, cards: arr.cards }];
      }
      const others = action.type === 'add' ? state.melds[team].filter((x) => x.id !== action.meld) : state.melds[team];
      const err = handEndErrorWith(state, team, hand.length - ids.length, others.concat(extra));
      if (err) return bad(err);
      return { ok: true, arr };
    }
    case 'discard': {
      if (state.phase !== 'play') return bad('phase');
      if (!hand.includes(action.id)) return bad('notInHand');
      const left = hand.length - 1;
      if (left === 0) {
        const err = handEndError(state, team, left, state.melds[team]);
        if (err) return bad(err);
      }
      return { ok: true };
    }
    default:
      return bad('unknown');
  }
}
function handEndErrorWith(state, team, remaining, allMelds) {
  if (remaining === 0) {
    if (!state.mortoTaken[team] && state.mortos[team]) return null;
    return hasCanastra(state, allMelds) ? null : 'needCanastra';
  }
  if (remaining === 1 && state.mortoTaken[team] && !hasCanastra(state, allMelds)) return 'lastCard';
  return null;
}
function hasCanastra(state, melds) {
  return melds.some((m) => {
    const k = canastraKind(m);
    return k && (!state.cleanOut || k !== 'dirty');
  });
}
// A more specific reason for a failed add (for UI feedback).
function addReason(m, ids) {
  const wild = ids.filter(isWildCard);
  if (wildCount(m.cards) && wild.length) return 'twoWilds';
  if (m.cards.length + ids.length > 13) return 'tooLong';
  return 'invalidAdd';
}
// Reason a selection is not a legal new meld (for UI messages).
export function whyNotMeld(ids) {
  if (ids.length < 3) return 'tooFew';
  if (arrangements(ids).length) return null;
  const jokers = ids.filter(isWildCard).length;
  const naturals = ids.filter((x) => !isWildCard(x));
  const suits = new Set(naturals.map(cardSuit));
  if (suits.size > 1) return 'mixedSuits';
  if (jokers > 2) return 'twoWilds';
  return 'notSequence';
}

// ---------- applying ----------
function removeFrom(arr, ids) {
  for (const id of ids) {
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
  }
}
function takeMorto(state, seat, events) {
  const team = teamOf(state.n, seat);
  const m = state.mortos[team];
  state.hands[seat] = state.hands[seat].concat(m);
  state.mortos[team] = null;
  state.mortoTaken[team] = true;
  state.mortoBy[team] = seat;
  events.push({ k: 'morto', seat, team, count: m.length });
}
function endRound(state, reason, seat, events) {
  state.phase = 'end';
  state.ended = { reason, seat, team: seat == null ? null : teamOf(state.n, seat) };
  events.push({ k: 'end', reason, seat });
}

export function apply(state, action) {
  const chk = checkAction(state, action);
  if (!chk.ok) return { ok: false, code: chk.code, events: [] };
  const seat = state.turn;
  const team = teamOf(state.n, seat);
  const events = [];
  const hand = state.hands[seat];
  switch (action.type) {
    case 'draw': {
      const id = state.stock.pop();
      hand.push(id);
      state.phase = 'play';
      state.drew = 'stock';
      events.push({ k: 'draw', seat, id });
      break;
    }
    case 'stop':
      endRound(state, 'stop', null, events);
      break;
    case 'take': {
      const pile = state.pile;
      const ids = pile.slice();
      state.pileTakes.push({ seat, ids: ids.slice(), turnNo: state.turnNo });
      state.hands[seat] = hand.concat(pile);
      state.pile = [];
      state.phase = 'play';
      state.drew = 'pile';
      events.push({ k: 'take', seat, ids });
      const p = action.play;
      commitPlay(state, seat, team, p.t === 'add' ? { type: 'add', meld: p.meld, ids: p.ids } : { type: 'meld', ids: p.ids }, chk.arr, events);
      afterHandChange(state, seat, team, events, false);
      break;
    }
    case 'meld':
    case 'add':
      commitPlay(state, seat, team, action, chk.arr, events);
      afterHandChange(state, seat, team, events, false);
      break;
    case 'discard': {
      removeFrom(hand, [action.id]);
      state.pile.push(action.id);
      events.push({ k: 'discard', seat, id: action.id });
      if (hand.length === 0) {
        if (!state.mortoTaken[team]) {
          takeMorto(state, seat, events);
        } else {
          events.push({ k: 'bater', seat, team });
          endRound(state, 'bater', seat, events);
          break;
        }
      }
      nextTurn(state, events);
      break;
    }
  }
  return { ok: true, events };
}
function commitPlay(state, seat, team, act, arr, events) {
  removeFrom(state.hands[seat], act.ids);
  if (act.type === 'meld') {
    const meld = { id: state.nextMeldId++, suit: arr.suit, cards: arr.cards.map((c) => ({ ...c })) };
    state.melds[team].push(meld);
    events.push({ k: 'meld', seat, team, meld: meld.id, ids: act.ids.slice() });
  } else {
    const meld = meldById(state, team, act.meld);
    const before = canastraKind(meld);
    meld.cards = arr.cards.map((c) => ({ ...c }));
    events.push({ k: 'add', seat, team, meld: meld.id, ids: act.ids.slice() });
    if (!before && canastraKind(meld)) events.push({ k: 'canastra', seat, team, meld: meld.id, kind: canastraKind(meld) });
    return;
  }
  const meld = state.melds[team][state.melds[team].length - 1];
  if (canastraKind(meld)) events.push({ k: 'canastra', seat, team, meld: meld.id, kind: canastraKind(meld) });
}
function afterHandChange(state, seat, team, events) {
  const hand = state.hands[seat];
  if (hand.length === 0) {
    if (!state.mortoTaken[team] && state.mortos[team]) takeMorto(state, seat, events);
    else {
      // validated earlier: going out by melding every card
      events.push({ k: 'bater', seat, team });
      endRound(state, 'bater', seat, events);
    }
  }
}
function nextTurn(state, events) {
  state.turn = (state.turn + 1) % state.n;
  state.turnNo++;
  state.phase = 'draw';
  state.drew = null;
  if (!state.stock.length && !canTakePile(state, state.turn)) endRound(state, 'stock', null, events);
}

// ---------- scoring ----------
export function scoreRound(state) {
  const out = [];
  const teams = state.n === 2 ? 2 : 2;
  for (let team = 0; team < teams; team++) {
    const melds = state.melds[team];
    const meldPts = melds.reduce((s, m) => s + meldPoints(m), 0);
    const canastras = { clean: 0, dirty: 0, real: 0 };
    for (const m of melds) {
      const k = canastraKind(m);
      if (k) canastras[k]++;
    }
    const canastraPts = canastras.clean * BONUS.clean + canastras.dirty * BONUS.dirty + canastras.real * BONUS.real;
    const bater = state.ended && state.ended.reason === 'bater' && state.ended.team === team ? BONUS.bater : 0;
    let handPts = 0;
    for (const s of teamSeats(state.n, team)) for (const id of state.hands[s]) handPts += cardPoints(id);
    const morto = state.mortoTaken[team] ? 0 : BONUS.noMorto;
    out.push({ team, meldPts, canastras, canastraPts, bater, handPts, morto, total: meldPts + canastraPts + bater - handPts + morto });
  }
  return out;
}

// ---------- match helpers ----------
export function matchWinner(scores, target) {
  const best = Math.max(...scores);
  if (best < target) return null;
  const top = scores.filter((s) => s === best).length;
  return top > 1 ? null : scores.indexOf(best);
}

// ---------- AI view: what a seat is allowed to know ----------
export function viewFor(state, seat) {
  return {
    n: state.n,
    seat,
    team: teamOf(state.n, seat),
    turn: state.turn,
    phase: state.phase,
    cleanOut: state.cleanOut,
    hand: state.hands[seat].slice(),
    handCounts: state.hands.map((h) => h.length),
    melds: state.melds,
    pile: state.pile.slice(),
    pileTakes: state.pileTakes,
    stockCount: state.stock.length,
    mortoTaken: state.mortoTaken.slice(),
    mortoLeft: state.mortos.map((m) => (m ? m.length : 0)),
    turnNo: state.turnNo,
  };
}
