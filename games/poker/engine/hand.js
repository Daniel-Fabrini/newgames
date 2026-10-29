// No-Limit Hold'em single-hand state machine. Pure, JSON-serialisable, mutation-in-place for speed.
// See games/poker/API.md for the shapes. Seats are indexes into state.players (table order, clockwise).
import { evaluate, describe } from './eval.js';
import { mulberry32, shuffle, freshDeck } from './rng.js';

const STREETS = ['preflop', 'flop', 'turn', 'river'];

/**
 * createHand({ players:[{id, stack, name?}], button, sb, bb, ante=0, seed?|rng?, handNo=1 })
 * `players` = seated players with stack > 0, in clockwise seat order; `button` = index into that array.
 * Button/blind rule (documented): the button moves to the next occupied seat each hand; blinds are always
 * the next two occupied seats after the button (no dead blinds, nobody skips or double-pays the big blind).
 * Heads-up: button = small blind, acts first preflop and last postflop.
 */
export function createHand(opts) {
  const { players, button, sb, bb, ante = 0, handNo = 1 } = opts;
  const n = players.length;
  if (n < 2) throw new Error('need >= 2 players');
  const rng = opts.rng || mulberry32(opts.seed ?? 1);
  const deck = shuffle(freshDeck(), rng);
  const st = {
    v: 1, handNo, n, button, sb, bb, ante, street: 'preflop', board: [], deck, deckPos: 0,
    currentBet: 0, lastRaise: bb, toAct: -1, lastAggressor: -1, phase: 'betting', result: null,
    sbIdx: -1, bbIdx: -1, log: [],
    players: players.map((p, i) => ({
      i, id: p.id, name: p.name || null, stack: p.stack, startStack: p.stack, bet: 0, committed: 0,
      folded: false, allIn: false, hole: [], needsAct: true, canRaise: true, last: null, showed: false,
    })),
  };
  const ev = [];
  const next = (i) => (i + 1) % n;
  if (n === 2) { st.sbIdx = button; st.bbIdx = next(button); }
  else { st.sbIdx = next(button); st.bbIdx = next(st.sbIdx); }
  ev.push({ t: 'hand_start', handNo, button, sbIdx: st.sbIdx, bbIdx: st.bbIdx, sb, bb, ante, stacks: st.players.map((p) => p.stack) });
  // deal two hole cards, one at a time starting left of the button
  for (let r = 0; r < 2; r++) for (let k = 1; k <= n; k++) st.players[(button + k) % n].hole.push(st.deck[st.deckPos++]);
  ev.push({ t: 'deal_hole' });
  if (ante > 0) for (const p of st.players) { const a = Math.min(ante, p.stack); p.stack -= a; p.committed += a; if (p.stack === 0) p.allIn = true; ev.push({ t: 'post', p: p.i, kind: 'ante', amount: a }); }
  const post = (idx, amt, kind) => {
    const p = st.players[idx]; const a = Math.min(amt, p.stack);
    p.stack -= a; p.bet += a; p.committed += a; if (p.stack === 0) p.allIn = true;
    ev.push({ t: 'post', p: idx, kind, amount: a, allIn: p.allIn });
  };
  post(st.sbIdx, sb, 'sb'); post(st.bbIdx, bb, 'bb');
  st.currentBet = Math.max(...st.players.map((p) => p.bet));
  for (const p of st.players) if (p.allIn) p.needsAct = false;
  const first = n === 2 ? st.sbIdx : next(st.bbIdx);
  advance(st, first, ev);
  st.log.push(...ev);
  return { state: st, events: ev };
}

const canActNow = (p) => !p.folded && !p.allIn;

// Move to the next actor starting the scan at `from` (inclusive); closes rounds / streets / hand as needed.
function advance(st, from, ev) {
  for (;;) {
    const alive = st.players.filter((p) => !p.folded);
    if (alive.length === 1) return finishUncontested(st, alive[0], ev);
    const actors = alive.filter((p) => !p.allIn);
    let roundOver = false;
    if (actors.length === 0) roundOver = true;
    else if (actors.length === 1 && actors[0].bet >= st.currentBet) roundOver = true;
    else {
      let found = -1;
      for (let k = 0; k < st.n; k++) {
        const i = (from + k) % st.n; const p = st.players[i];
        if (canActNow(p) && p.needsAct) { found = i; break; }
      }
      if (found >= 0) { st.toAct = found; return; }
      roundOver = true;
    }
    if (roundOver) {
      if (st.street === 'river') return showdown(st, ev);
      // collect bets, deal next street
      for (const p of st.players) p.bet = 0;
      st.currentBet = 0; st.lastRaise = st.bb;
      const idx = STREETS.indexOf(st.street) + 1;
      st.street = STREETS[idx];
      const num = st.street === 'flop' ? 3 : 1;
      const cards = [];
      for (let k = 0; k < num; k++) cards.push(st.deck[st.deckPos++]);
      st.board.push(...cards);
      ev.push({ t: 'street', street: st.street, cards, board: st.board.slice(), pot: totalPot(st) });
      const nowActors = st.players.filter((p) => canActNow(p));
      for (const p of st.players) { p.needsAct = canActNow(p); p.canRaise = true; p.last = null; }
      if (nowActors.length >= 2) st.lastAggressor = -1; // betting will happen on this street
      // first to act postflop: first live player left of button
      from = (st.button + 1) % st.n;
    }
  }
}

export function totalPot(st) { let s = 0; for (const p of st.players) s += p.committed; return s; }

export function legalActions(st) {
  if (st.phase !== 'betting' || st.toAct < 0) return null;
  const p = st.players[st.toAct];
  const toCall = Math.max(0, st.currentBet - p.bet);
  const maxTo = p.bet + p.stack;
  const canRaise = p.canRaise && p.stack > toCall;
  let minTo = st.currentBet + st.lastRaise;
  if (minTo > maxTo) minTo = maxTo;
  return {
    idx: st.toAct, id: p.id, toCall, canFold: true, canCheck: toCall === 0, canCall: toCall > 0,
    callAmount: Math.min(toCall, p.stack), canRaise, isBet: st.currentBet === 0,
    minRaiseTo: canRaise ? minTo : null, maxRaiseTo: canRaise ? maxTo : null, allInTo: maxTo,
    pot: totalPot(st), stack: p.stack, bet: p.bet, canAllIn: canRaise || (p.stack <= toCall),
  };
}

/** Returns null when legal, else an error string. action = {type:'fold'|'check'|'call'|'bet'|'raise'|'allin', to?} */
export function validateAction(st, a) {
  const L = legalActions(st);
  if (!L) return 'no action expected';
  if (!a || typeof a.type !== 'string') return 'bad action';
  switch (a.type) {
    case 'fold': return null;
    case 'check': return L.canCheck ? null : 'cannot check';
    case 'call': return L.canCall ? null : 'nothing to call';
    case 'allin': return L.canAllIn ? null : 'all-in not allowed (betting not reopened)';
    case 'bet': case 'raise': {
      if (!L.canRaise) return 'cannot raise';
      const to = a.to;
      if (!Number.isInteger(to)) return 'to must be an integer';
      if (to > L.maxRaiseTo) return 'raise above stack';
      if (to < L.minRaiseTo) return 'raise below minimum';
      return null;
    }
    default: return 'unknown action';
  }
}

export function applyAction(st, a) {
  const err = validateAction(st, a);
  if (err) throw new Error('illegal action: ' + err);
  const L = legalActions(st);
  const idx = st.toAct, p = st.players[idx];
  const ev = [];
  let type = a.type;
  if (type === 'allin') type = L.canRaise ? 'raise' : 'call';
  let to = type === 'raise' || type === 'bet' ? (a.type === 'allin' ? L.maxRaiseTo : a.to) : null;
  if (type === 'fold') { p.folded = true; p.needsAct = false; p.last = 'fold'; ev.push({ t: 'action', p: idx, type: 'fold', street: st.street }); }
  else if (type === 'check') { p.needsAct = false; p.last = 'check'; ev.push({ t: 'action', p: idx, type: 'check', street: st.street }); }
  else if (type === 'call') {
    const amt = Math.min(L.toCall, p.stack);
    p.stack -= amt; p.bet += amt; p.committed += amt; if (p.stack === 0) p.allIn = true;
    p.needsAct = false; p.last = p.allIn ? 'allin' : 'call';
    ev.push({ t: 'action', p: idx, type: 'call', amount: amt, to: p.bet, allIn: p.allIn, street: st.street });
  } else {
    const amt = to - p.bet;
    const wasBet = st.currentBet === 0;
    const inc = to - st.currentBet;
    p.stack -= amt; p.bet = to; p.committed += amt; if (p.stack === 0) p.allIn = true;
    p.needsAct = false;
    const full = inc >= st.lastRaise;
    if (full) {
      st.lastRaise = inc;
      for (const o of st.players) if (o !== p && canActNow(o)) { o.needsAct = true; o.canRaise = true; }
    } else {
      for (const o of st.players) if (o !== p && canActNow(o)) { if (!o.needsAct) o.canRaise = false; o.needsAct = true; }
    }
    st.currentBet = to; st.lastAggressor = idx;
    p.last = p.allIn ? 'allin' : (wasBet ? 'bet' : 'raise');
    ev.push({ t: 'action', p: idx, type: wasBet ? 'bet' : 'raise', amount: amt, to, allIn: p.allIn, full, street: st.street });
  }
  advance(st, (idx + 1) % st.n, ev);
  st.log.push(...ev);
  return ev;
}

/** Build the (side) pots from committed chips. Returns {pots:[{amount, eligible:[idx]}], uncalled:[{p, amount}]}. */
export function buildPots(st) {
  const ps = st.players;
  const levels = [...new Set(ps.filter((p) => p.committed > 0).map((p) => p.committed))].sort((a, b) => a - b);
  const pots = []; const uncalled = [];
  let prev = 0;
  for (const L of levels) {
    let amount = 0; const contributors = [];
    for (const p of ps) { const c = Math.min(p.committed, L) - Math.min(p.committed, prev); if (c > 0) { amount += c; contributors.push(p.i); } }
    const eligible = ps.filter((p) => !p.folded && p.committed >= L).map((p) => p.i);
    prev = L;
    if (amount === 0) continue;
    if (eligible.length === 1 && contributors.length === 1 && contributors[0] === eligible[0]) { uncalled.push({ p: eligible[0], amount }); continue; }
    if (eligible.length === 0) { if (pots.length) pots[pots.length - 1].amount += amount; continue; }
    const last = pots[pots.length - 1];
    if (last && last.eligible.length === eligible.length && last.eligible.every((x, k) => x === eligible[k])) last.amount += amount;
    else pots.push({ amount, eligible });
  }
  return { pots, uncalled };
}

/** Live pot breakdown for display while the hand is running (uncalled excess not yet removed). */
export function potInfo(st) { const b = buildPots(st); return { total: totalPot(st), main: b.pots[0] || null, pots: b.pots, uncalled: b.uncalled }; }

function finishUncontested(st, winner, ev) {
  const { pots, uncalled } = buildPots(st);
  const total = totalPot(st);
  const returned = uncalled.reduce((s, u) => s + u.amount, 0);
  for (const u of uncalled) { ev.push({ t: 'uncalled', p: u.p, amount: u.amount }); }
  winner.stack += total;
  const shares = [{ p: winner.i, amount: total - returned }];
  ev.push({ t: 'award', pot: 0, amount: total - returned, winners: shares, uncontested: true });
  st.toAct = -1; st.phase = 'done';
  return finish(st, ev, { showdown: false, pots: [{ amount: total - returned, eligible: [winner.i], winners: [winner.i], shares }], uncalled, reveals: [], uncontestedWinner: winner.i });
}

function showdown(st, ev) {
  const alive = st.players.filter((p) => !p.folded);
  const scores = new Map();
  for (const p of alive) scores.set(p.i, evaluate(p.hole.concat(st.board)));
  const { pots, uncalled } = buildPots(st);
  for (const u of uncalled) { st.players[u.p].stack += u.amount; ev.push({ t: 'uncalled', p: u.p, amount: u.amount }); }
  // reveal order: last aggressor first, else first live player left of the button
  let first = st.lastAggressor >= 0 && !st.players[st.lastAggressor].folded ? st.lastAggressor : -1;
  if (first < 0) for (let k = 1; k <= st.n; k++) { const i = (st.button + k) % st.n; if (!st.players[i].folded) { first = i; break; } }
  const order = [];
  for (let k = 0; k < st.n; k++) { const i = (first + k) % st.n; if (!st.players[i].folded) order.push(i); }
  const anyAllIn = alive.some((p) => p.allIn);
  const reveals = []; let bestShown = -1;
  for (const i of order) {
    const sc = scores.get(i);
    const mucked = !anyAllIn && sc < bestShown;
    if (!mucked) { st.players[i].showed = true; if (sc > bestShown) bestShown = sc; }
    reveals.push({ p: i, hole: mucked ? null : st.players[i].hole.slice(), score: mucked ? null : sc, hand: mucked ? null : describe(sc).key, mucked });
  }
  ev.push({ t: 'showdown', order, reveals });
  const outPots = [];
  pots.forEach((pot, k) => {
    let best = -1; for (const i of pot.eligible) best = Math.max(best, scores.get(i));
    const winners = pot.eligible.filter((i) => scores.get(i) === best);
    const base = Math.floor(pot.amount / winners.length); let rem = pot.amount - base * winners.length;
    const amounts = new Map(winners.map((i) => [i, base]));
    // odd chips: one at a time starting with the first winner left of the button
    for (let q = 1; q <= st.n && rem > 0; q++) { const i = (st.button + q) % st.n; if (amounts.has(i)) { amounts.set(i, amounts.get(i) + 1); rem--; } }
    const shares = winners.map((i) => ({ p: i, amount: amounts.get(i) }));
    for (const s of shares) st.players[s.p].stack += s.amount;
    outPots.push({ amount: pot.amount, eligible: pot.eligible, winners, shares, hand: describe(best).key });
    ev.push({ t: 'award', pot: k, amount: pot.amount, eligible: pot.eligible, winners: shares, hand: describe(best).key });
  });
  st.toAct = -1; st.phase = 'done';
  return finish(st, ev, { showdown: true, pots: outPots, uncalled, reveals, uncontestedWinner: -1 });
}

function finish(st, ev, res) {
  res.results = st.players.map((p) => ({ p: p.i, id: p.id, delta: p.stack - p.startStack, stack: p.stack, folded: p.folded, busted: p.stack === 0 }));
  res.total = res.pots.reduce((s, x) => s + x.amount, 0);
  st.result = res;
  ev.push({ t: 'hand_end', results: res.results });
}

/** Play the hand to the end with a chooser (state, legal) => action. Useful for tests / simulation. */
export function playOut(st, choose) {
  let guard = 0;
  while (st.phase === 'betting') { applyAction(st, choose(st, legalActions(st))); if (++guard > 500) throw new Error('hand did not terminate'); }
  return st.result;
}

/** State as visible to seat `viewer` (or null = spectator): hides deck and unrevealed hole cards. */
export function publicView(st, viewer = null) {
  const c = JSON.parse(JSON.stringify(st, (k, v) => (k === 'deck' ? undefined : v)));
  for (const p of c.players) if (p.i !== viewer && !p.showed) p.hole = p.hole.map(() => -1);
  return c;
}
/** Everything the AI at seat `idx` is allowed to know. */
export function viewFor(st, idx) {
  const me = st.players[idx];
  return {
    me: idx, hole: me.hole.slice(), board: st.board.slice(), street: st.street, n: st.n, button: st.button,
    sbIdx: st.sbIdx, bbIdx: st.bbIdx, bb: st.bb, sb: st.sb, ante: st.ante, currentBet: st.currentBet, lastRaise: st.lastRaise,
    pot: totalPot(st), lastAggressor: st.lastAggressor, handNo: st.handNo,
    players: st.players.map((p) => ({ i: p.i, id: p.id, stack: p.stack, startStack: p.startStack, bet: p.bet, committed: p.committed, folded: p.folded, allIn: p.allIn, last: p.last })),
    history: st.log.filter((e) => e.t === 'action').map((e) => ({ p: e.p, type: e.type, to: e.to, amount: e.amount, street: e.street })),
    legal: legalActions(st),
  };
}
