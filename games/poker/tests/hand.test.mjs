import test from 'node:test';
import assert from 'node:assert/strict';
import { createHand, applyAction, legalActions, validateAction, potInfo, publicView, playOut } from '../engine/hand.js';
import { parseCards } from '../engine/eval.js';
import { mulberry32 } from '../engine/rng.js';

function mk(stacks, { button = 0, sb = 10, bb = 20, ante = 0, holes, board, seed = 1 } = {}) {
  const { state } = createHand({ players: stacks.map((s, i) => ({ id: 'p' + i, stack: s })), button, sb, bb, ante, seed });
  if (holes) holes.forEach((h, i) => { state.players[i].hole = parseCards(h); });
  if (board) { const b = parseCards(board); b.forEach((c, k) => { state.deck[state.deckPos + k] = c; }); }
  return state;
}
const A = (st, type, to) => applyAction(st, to == null ? { type } : { type, to });
const sum = (st) => st.players.reduce((s, p) => s + p.stack, 0);

test('blinds, button and first actor: 3+ players', () => {
  const st = mk([1000, 1000, 1000, 1000], { button: 0 });
  assert.equal(st.sbIdx, 1); assert.equal(st.bbIdx, 2); assert.equal(st.toAct, 3);
  assert.equal(st.players[1].bet, 10); assert.equal(st.players[2].bet, 20);
  assert.equal(st.players[1].stack, 990);
});
test('heads-up: button is SB and acts first preflop, last postflop', () => {
  const st = mk([1000, 1000], { button: 0 });
  assert.equal(st.sbIdx, 0); assert.equal(st.bbIdx, 1); assert.equal(st.toAct, 0);
  A(st, 'call'); A(st, 'check'); // flop
  assert.equal(st.street, 'flop'); assert.equal(st.toAct, 1, 'BB acts first postflop heads-up');
  A(st, 'check'); A(st, 'check');
  assert.equal(st.street, 'turn'); assert.equal(st.toAct, 1);
});
test('postflop first actor is first live player left of the button; folded players skipped', () => {
  const st = mk([1000, 1000, 1000, 1000], { button: 0 }); // sb1 bb2, utg3
  A(st, 'call'); A(st, 'fold'); // p3 call, p0 fold
  A(st, 'call'); A(st, 'check'); // sb call, bb check
  assert.equal(st.street, 'flop'); assert.equal(st.toAct, 1);
});
test('big blind has the option when limped to', () => {
  const st = mk([1000, 1000, 1000], { button: 0 }); // p0 btn, sb p1, bb p2, utg p0
  A(st, 'call'); A(st, 'call');
  assert.equal(st.toAct, 2); assert.equal(st.street, 'preflop');
  const L = legalActions(st); assert.ok(L.canCheck && L.canRaise);
  A(st, 'raise', 60);
  assert.equal(st.toAct, 0, 'others must respond to the raise');
});
test('min-raise equals the size of the last raise; min bet postflop is the big blind', () => {
  const st = mk([5000, 5000, 5000], { button: 0 });
  let L = legalActions(st); assert.equal(L.minRaiseTo, 40);
  A(st, 'raise', 100); // raise of 80
  L = legalActions(st); assert.equal(L.minRaiseTo, 180);
  assert.ok(validateAction(st, { type: 'raise', to: 179 }));
  assert.equal(validateAction(st, { type: 'raise', to: 180 }), null);
  A(st, 'raise', 300); // +200
  L = legalActions(st); assert.equal(L.minRaiseTo, 500);
  A(st, 'call'); A(st, 'call');
  assert.equal(st.street, 'flop');
  L = legalActions(st); assert.equal(L.minRaiseTo, 20); assert.ok(L.isBet);
  assert.ok(validateAction(st, { type: 'bet', to: 19 }));
  A(st, 'bet', 100); L = legalActions(st); assert.equal(L.minRaiseTo, 200);
});
test('illegal actions are rejected', () => {
  const st = mk([1000, 1000, 1000]);
  assert.ok(validateAction(st, { type: 'check' })); // facing the big blind
  assert.throws(() => A(st, 'check'));
  assert.throws(() => A(st, 'raise', 30));
  assert.throws(() => A(st, 'raise', 5000));
  assert.throws(() => A(st, 'bogus'));
});
test('short all-in (incomplete raise) does not reopen betting for players who already acted', () => {
  const st = mk([1000, 1000, 130, 1000], { button: 3, sb: 10, bb: 20 }); // sb p0, bb p1, utg p2(short), p3 btn
  // order: p2 first (UTG)
  A(st, 'raise', 100); // p2 raises to 100 (inc 80)... p2 has 130 total
  assert.equal(st.toAct, 3);
  A(st, 'call'); // p3 calls 100
  A(st, 'call'); // p0 (sb) calls 100
  // p1 (bb) acts: all-in? p1 has 1000. Make a different scenario below for the actual test
  assert.equal(st.toAct, 1);
  A(st, 'call');
  assert.equal(st.street, 'flop');
});
test('incomplete all-in raise: players who acted may only call/fold, others still may raise', () => {
  // p0 btn(1000), p1 sb(1000), p2 bb(1000), p3 utg(1000), p4 short 150, button=0 => seats: sb p1, bb p2, utg p3, p4, p0
  const st = mk([1000, 1000, 1000, 1000, 150], { button: 0, sb: 10, bb: 20 });
  assert.equal(st.toAct, 3);
  A(st, 'raise', 100); // p3 opens to 100 (inc 80)
  assert.equal(st.toAct, 4);
  A(st, 'allin'); // p4 all-in to 150: increment 50 < 80 => incomplete
  const lastRaise = st.lastRaise; assert.equal(lastRaise, 80);
  assert.equal(st.currentBet, 150);
  assert.equal(st.toAct, 0);
  assert.ok(legalActions(st).canRaise, 'p0 has not acted yet and may raise');
  A(st, 'call'); // p0 calls 150
  A(st, 'fold'); // p1 sb
  A(st, 'fold'); // p2 bb
  assert.equal(st.toAct, 3, 'p3 must respond to the extra 50');
  const L = legalActions(st);
  assert.equal(L.canRaise, false, 'betting was not reopened for p3');
  assert.ok(L.canCall && L.callAmount === 50);
  assert.throws(() => A(st, 'raise', 400));
  assert.throws(() => A(st, 'allin'));
  A(st, 'call');
  assert.equal(st.street, 'flop');
});
test('a full all-in raise reopens the betting', () => {
  const st = mk([1000, 1000, 1000, 1000, 400], { button: 0 });
  A(st, 'raise', 100); // p3
  A(st, 'allin'); // p4 to 400 (inc 300 >= 80): full raise
  assert.equal(st.lastRaise, 300);
  A(st, 'fold'); A(st, 'fold'); A(st, 'fold');
  assert.equal(st.toAct, 3);
  const L = legalActions(st); assert.ok(L.canRaise); assert.equal(L.minRaiseTo, 700);
});
test('all-in for less than the minimum raise is legal only as all-in', () => {
  const st = mk([1000, 1000, 70], { button: 0 }); // utg p0, sb p1, bb p2 ... p2 short bb
  A(st, 'raise', 100);
  A(st, 'fold');
  assert.equal(st.toAct, 2);
  const L = legalActions(st);
  assert.equal(L.canRaise, false); // cannot cover the raise: no raise options
  assert.equal(L.callAmount, 50); assert.ok(L.toCall > L.stack && L.canAllIn);
  A(st, 'allin'); // all-in call for less
  assert.equal(st.players[2].allIn, true);
});
test('uncalled bet is returned and the winner of a fold-out is paid correctly', () => {
  const st = mk([1000, 1000, 1000], { button: 0 });
  A(st, 'raise', 300); A(st, 'fold'); A(st, 'fold');
  assert.equal(st.phase, 'done');
  assert.equal(st.result.uncalled.length, 1);
  assert.equal(st.result.uncalled[0].amount, 300 - 20);
  assert.equal(st.players[0].stack, 1000 + 30); // wins SB+BB
  assert.equal(sum(st), 3000);
});
test('side pots: 4 players all-in with different stacks, correct eligibility, uncalled returned', () => {
  // holes: p0 best, p1 second, p2 third, p3 worst. stacks 100/200/300/500
  const st = mk([100, 200, 300, 500], { button: 3, sb: 5, bb: 10, holes: ['As Ah', 'Kd Kh', 'Qd Qh', '7c 2d'], board: '3c 4d 9s Jc 8h' });
  // sb p0? button 3 => sb p0, bb p1, utg p2
  while (st.phase === 'betting') applyActionSafe(st);
  const r = st.result;
  assert.equal(r.pots.length, 3);
  assert.deepEqual(r.pots.map((p) => p.amount), [400, 300, 200]);
  assert.deepEqual(r.pots.map((p) => p.eligible), [[0, 1, 2, 3], [1, 2, 3], [2, 3]]);
  assert.deepEqual(r.pots.map((p) => p.winners), [[0], [1], [2]]);
  assert.equal(r.uncalled.length, 1); assert.deepEqual(r.uncalled[0], { p: 3, amount: 200 });
  assert.equal(st.players[0].stack, 400); assert.equal(st.players[1].stack, 300); assert.equal(st.players[2].stack, 200); assert.equal(st.players[3].stack, 200);
  assert.equal(sum(st), 1100);
});
function applyActionSafe(st) { const L = legalActions(st); applyAction(st, L.canAllIn ? { type: 'allin' } : L.canCall ? { type: 'call' } : { type: 'check' }); }
test('side pots with 6 players, one folded dead money, split pot in a side pot', () => {
  const st = mk([300, 300, 150, 600, 600, 50], { button: 5, sb: 5, bb: 10, holes: ['Ah Ad', 'Ac As', '2c 2d', 'Kd Kh', 'Qs Qd', '7h 8h'], board: '3c 5d 9s Jc 4h' });
  // sb p0, bb p1, utg p2, p3, p4, p5(btn). p3 folds preflop with dead money? make p3 raise then fold
  A(st, 'allin'); // p2 all-in 150
  A(st, 'raise', 600); // p3 raises to 600 (all-in)
  A(st, 'fold'); // p4 folds
  A(st, 'allin'); // p5 all-in 50 (call, shorter)
  A(st, 'allin'); // p0 sb all-in 300 (call)
  A(st, 'allin'); // p1 all-in 300
  assert.equal(st.phase, 'done');
  const r = st.result;
  // p0 and p1 both hold aces: they split every pot they are eligible for and win
  assert.equal(sum(st), 2000);
  assert.ok(r.pots.every((p) => p.amount > 0));
  const p0 = st.players[0].stack, p1 = st.players[1].stack;
  assert.equal(p0, p1);
  assert.equal(st.players[3].stack, 300, 'p3 gets back uncalled 300');
  assert.equal(st.players[2].stack, 0); assert.equal(st.players[5].stack, 0);
  // eligibility: p4 folded and is not eligible anywhere
  assert.ok(r.pots.every((p) => !p.eligible.includes(4)));
  // pot split: total won by p0+p1 = everything minus uncalled 300
  assert.equal(p0 + p1, 1100); // 1400 committed minus 300 uncalled, all won by the two aces
});
test('odd chip allocation (explicit): 3 chips split between two winners', () => {
  // stacks 1000 each, p2 folds after posting blind: pot = 5 (sb) + 10 (bb)... craft with antes
  const st = mk([1000, 1000, 1000], { button: 0, sb: 5, bb: 10, ante: 1, holes: ['Ah Kh', 'Ad Kd', '2c 3d'], board: 'As Ks Qs 7c 7d' });
  // button p0, sb p1, bb p2, utg p0. antes 1 each. p0 calls 10, p1 calls (5 more), p2 checks. Pot = 3 + 30 = 33 -> then p2 folds on flop
  A(st, 'call'); A(st, 'call'); A(st, 'check');
  assert.equal(st.street, 'flop');
  // flop: p1 first, p2, p0. p1 check, p2 bets, p0 calls? simpler: p1 check, p2 fold, p0 check => showdown pot 33 between p0,p1
  A(st, 'check'); A(st, 'fold'); A(st, 'check'); A(st, 'check'); A(st, 'check'); A(st, 'check'); A(st, 'check');
  assert.equal(st.phase, 'done');
  const r = st.result; assert.equal(r.total, 33);
  const w = r.pots[0].shares; assert.equal(w.length, 2);
  // odd chip goes to first winner left of the button (button p0 => p1 is first left)
  const s1 = w.find((x) => x.p === 1).amount, s0 = w.find((x) => x.p === 0).amount;
  assert.equal(s1, 17); assert.equal(s0, 16);
  assert.equal(sum(st), 3000);
});
test('showdown order: last aggressor shows first; losing hands may be mucked (no all-in)', () => {
  const st = mk([1000, 1000], { button: 0, holes: ['Ah Ad', 'Kh Kd'], board: '2c 7d 9s Jc 4h' });
  A(st, 'call'); A(st, 'check'); // preflop
  A(st, 'check'); A(st, 'check'); // flop
  A(st, 'check'); A(st, 'check'); // turn
  A(st, 'bet', 100); A(st, 'call'); // river: BB (p1) acts first, bets; p0 calls
  const sd = st.log.find((e) => e.t === 'showdown');
  assert.equal(sd.order[0], 1, 'last aggressor (p1) shows first');
  const r0 = sd.reveals.find((r) => r.p === 0);
  assert.equal(r0.mucked, false); // winner shows
  const r1 = sd.reveals.find((r) => r.p === 1);
  assert.equal(r1.mucked, false); // shown first
  assert.equal(st.players[0].stack, 1120);
});
test('losing hand can be mucked when the winner already showed and nobody is all-in', () => {
  const st = mk([1000, 1000], { button: 0, holes: ['Kh Kd', 'Ah Ad'], board: '2c 7d 9s Jc 4h' });
  A(st, 'call'); A(st, 'check'); A(st, 'check'); A(st, 'check'); A(st, 'check'); A(st, 'check'); A(st, 'check'); A(st, 'check');
  const sd = st.log.find((e) => e.t === 'showdown');
  assert.equal(sd.order[0], 1); // no aggression: first live player left of the button = p1
  assert.equal(sd.reveals.find((r) => r.p === 0).mucked, true);
});
test('everyone all-in preflop: board runs out and hand completes', () => {
  const st = mk([500, 500, 500], { holes: ['Ah Ad', 'Kh Kd', 'Qh Qd'], board: '2c 7d 9s Jc 4h' });
  A(st, 'allin'); A(st, 'allin'); A(st, 'allin');
  assert.equal(st.phase, 'done'); assert.equal(st.board.length, 5);
  assert.equal(st.players[0].stack, 1500);
});
test('blinds all-in short: short big blind and callers, no action when everyone is all-in', () => {
  const st = mk([15, 1000, 1000], { button: 2, sb: 10, bb: 20, holes: ['Ah Ad', 'Kh Kd', 'Qh Qd'], board: '2c 7d 9s Jc 4h' });
  // sb p0 (15 -> posts 10), bb p1 20, utg p2
  A(st, 'call'); // p2 calls 20
  A(st, 'allin'); // p0 sb: remaining 5 -> all in calling 15 total? toCall = 10; stack 5 => all-in short
  A(st, 'check'); // bb option
  assert.equal(st.street, 'flop');
});
test('wheel straight wins showdown against a pair', () => {
  const st = mk([100, 100], { button: 0, holes: ['Ah 2d', 'Kc Kd'], board: '3c 4d 5s 9c Jh' });
  A(st, 'allin'); A(st, 'call');
  assert.equal(st.result.pots[0].winners[0], 0);
  assert.equal(st.result.pots[0].hand, 'straight');
});
test('antes are posted by all players and counted in the pot (not as a bet)', () => {
  const st = mk([1000, 1000, 1000], { button: 0, sb: 10, bb: 20, ante: 5 });
  assert.equal(st.players.reduce((s, p) => s + p.committed, 0), 15 + 30);
  assert.equal(st.players[0].bet, 0); assert.equal(st.players[0].committed, 5);
  assert.equal(potInfo(st).total, 45);
});
test('publicView hides the deck and other players\' hole cards', () => {
  const st = mk([1000, 1000, 1000]);
  const v = publicView(st, 0);
  assert.equal(v.deck, undefined);
  assert.ok(v.players[0].hole.every((c) => c >= 0)); assert.ok(v.players[1].hole.every((c) => c === -1));
});
test('fuzz: random legal play conserves chips, terminates, results consistent (incl. all-ins)', () => {
  const rng = mulberry32(99);
  for (let h = 0; h < 4000; h++) {
    const n = 2 + Math.floor(rng() * 8);
    const stacks = [...Array(n)].map(() => 1 + Math.floor(rng() * (rng() < 0.3 ? 60 : 2000)));
    const total = stacks.reduce((a, b) => a + b, 0);
    const { state: st } = createHand({ players: stacks.map((s, i) => ({ id: 'p' + i, stack: s })), button: Math.floor(rng() * n), sb: 10, bb: 20, ante: rng() < 0.3 ? 3 : 0, rng });
    let g = 0;
    while (st.phase === 'betting') {
      const L = legalActions(st); const r = rng(); let a;
      if (r < 0.15) a = L.canCheck ? { type: 'check' } : { type: 'fold' };
      else if (r < 0.55) a = L.canCheck ? { type: 'check' } : { type: 'call' };
      else if (r < 0.9 && L.canRaise) a = { type: L.isBet ? 'bet' : 'raise', to: L.minRaiseTo + Math.floor(rng() * (L.maxRaiseTo - L.minRaiseTo + 1)) };
      else if (L.canAllIn) a = { type: 'allin' };
      else a = L.canCheck ? { type: 'check' } : { type: 'call' };
      assert.equal(validateAction(st, a), null);
      applyAction(st, a);
      assert.ok(++g < 400);
    }
    assert.equal(sum(st), total);
    const res = st.result;
    assert.equal(res.results.reduce((s, r) => s + r.delta, 0), 0);
    for (const p of st.players) assert.ok(p.stack >= 0);
    for (const pot of res.pots) { assert.ok(pot.winners.length >= 1); assert.equal(pot.shares.reduce((s, x) => s + x.amount, 0), pot.amount); for (const w of pot.winners) assert.ok(!st.players[w].folded); }
    assert.equal(st.players.reduce((s, p) => s + p.committed, 0), res.pots.reduce((s, p) => s + p.amount, 0) + res.uncalled.reduce((s, u) => s + u.amount, 0));
  }
});
test('playOut helper terminates a passive hand', () => {
  const { state } = createHand({ players: [{ id: 'a', stack: 100 }, { id: 'b', stack: 100 }], button: 0, sb: 1, bb: 2, seed: 5 });
  const r = playOut(state, (s, L) => (L.canCheck ? { type: 'check' } : { type: 'call' }));
  assert.ok(r.total > 0);
});
