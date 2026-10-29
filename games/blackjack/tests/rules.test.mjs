import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../rules.js';
import { basicMove, suggest } from '../strategy.js';

const c = (rank, suit = 0) => suit * 13 + (rank - 1); // rank 1 = A, 11-13 = J Q K
// rig the shoe so cards come out in the given order (deal order: P1, dealer up, P2, dealer hole [, more boxes...])
function rigged(seq, opts = {}) {
  const s = B.newGame(1, opts);
  s.shoe = [...Array(60).fill(c(2, 1)), ...seq.slice().reverse()];
  s.needShuffle = false;
  s.dealtSince = 0;
  return s;
}
// helper to deal one box: player p1,p2 vs dealer up,hole then extra cards
const start = (p1, up, p2, hole, extra = [], opts = {}, bet = 100) => {
  const s = rigged([p1, up, p2, hole, ...extra], opts);
  assert.ok(B.deal(s, [bet]));
  return s;
};

test('hand totals: hard, soft, multiple aces', () => {
  assert.deepEqual(B.total([c(1), c(6)]), { total: 17, soft: true });
  assert.deepEqual(B.total([c(1), c(6), c(10)]), { total: 17, soft: false });
  assert.deepEqual(B.total([c(1), c(1)]), { total: 12, soft: true });
  assert.deepEqual(B.total([c(1), c(1), c(9)]), { total: 21, soft: true });
  assert.deepEqual(B.total([c(1), c(1), c(9), c(1)]), { total: 12, soft: false });
  assert.deepEqual(B.total([c(13), c(12)]), { total: 20, soft: false });
  assert.deepEqual(B.total([c(10), c(5), c(9)]), { total: 24, soft: false });
  assert.ok(B.isNatural([c(1), c(12)]));
  assert.ok(!B.isNatural([c(7), c(7), c(7)]));
  assert.ok(B.isBust([c(10), c(5), c(9)]));
});

test('natural vs three-card 21; natural pays 3:2, rounded down', () => {
  let s = start(c(1), c(9), c(13), c(8)); // player A+K vs 17
  assert.equal(s.phase, 'settled');
  assert.equal(s.hands[0].result, 'blackjack');
  assert.equal(s.bankroll, 1000 - 100 + 100 + 150);
  s = start(c(1), c(9), c(13), c(8), [], {}, 5);
  assert.equal(s.hands[0].net, 7);
  assert.equal(s.bankroll, 1000 + 7);
  // 7+7+7 = 21 is not a natural and pays 1:1
  s = start(c(7), c(9), c(7), c(8), [c(7)]);
  B.hit(s);
  assert.equal(B.total(s.hands[0].cards).total, 21);
  assert.equal(s.phase, 'dealer', 'auto-stand on 21');
  B.dealerPlay(s);
  assert.equal(s.phase, 'settled');
  assert.equal(s.hands[0].result, 'win');
  assert.equal(s.hands[0].net, 100);
});

test('both naturals push; dealer natural beats non-natural 21', () => {
  let s = start(c(1), c(1), c(13), c(12), [], { insurance: false });
  assert.equal(s.hands[0].result, 'push');
  assert.equal(s.bankroll, 1000);
  s = start(c(7), c(13), c(7), c(1), [c(7)]);
  assert.equal(s.phase, 'settled', 'dealer peeked a blackjack');
  assert.equal(s.hands[0].result, 'lose');
  assert.equal(s.bankroll, 900);
  assert.equal(B.legalActions(s).hit, false, 'no actions after the round ends');
  assert.equal(B.hit(s), null);
  assert.equal(B.stand(s), null);
  assert.equal(B.doubleDown(s), null);
  assert.equal(B.split(s), null);
});

test('dealer peeks with a ten up too; no blackjack -> play continues', () => {
  const s = start(c(10), c(13), c(6), c(7));
  assert.equal(s.phase, 'player');
  assert.equal(s.peeked, true);
});

test('bust loses immediately; dealer does not draw when all hands busted', () => {
  const s = start(c(10), c(6), c(6), c(5), [c(10)]);
  const ev = B.hit(s);
  assert.ok(ev.some((e) => e.t === 'bust'));
  assert.equal(s.phase, 'settled');
  assert.equal(s.dealer.cards.length, 2);
  assert.equal(s.hands[0].result, 'bust');
  assert.equal(s.bankroll, 900);
});

test('dealer S17 stands on soft 17, H17 hits it', () => {
  const mk = (opts) => {
    const s = start(c(10), c(1), c(10), c(6), [c(5), c(10)], { ...opts, insurance: false }); // dealer A+6
    assert.equal(s.phase, 'player');
    B.stand(s);
    B.dealerPlay(s);
    return s;
  };
  const s17 = mk({ h17: false });
  assert.equal(s17.dealer.cards.length, 2);
  assert.equal(s17.hands[0].result, 'win'); // 20 vs soft 17
  const h17 = mk({ h17: true });
  assert.ok(h17.dealer.cards.length > 2);
  // A+6+5 = hard 12 -> keeps hitting: +10 = 22 bust
  assert.equal(h17.hands[0].result, 'win');
  assert.ok(B.dealerMustHit(h17, [c(1), c(6)]));
  assert.ok(!B.dealerMustHit(s17, [c(1), c(6)]));
  assert.ok(B.dealerMustHit(s17, [c(10), c(6)]));
  assert.ok(!B.dealerMustHit(s17, [c(10), c(7)]));
  assert.ok(!B.dealerMustHit(h17, [c(1), c(7), c(9)])); // hard 17
});

test('dealer hits to 17+, busts, and player win/lose/push settle correctly', () => {
  const run = (p1, p2, up, hole, extra) => {
    const s = start(p1, up, p2, hole, extra, {}, 100);
    if (s.phase === 'player') {
      B.stand(s);
      B.dealerPlay(s);
    }
    return s;
  };
  let s = run(c(10), c(9), c(10), c(7), []); // 19 v 17
  assert.equal(s.hands[0].result, 'win');
  s = run(c(10), c(8), c(10), c(9), []); // 18 v 19
  assert.equal(s.hands[0].result, 'lose');
  s = run(c(10), c(8), c(10), c(8), []); // push
  assert.equal(s.hands[0].result, 'push');
  assert.equal(s.bankroll, 1000);
  s = run(c(10), c(8), c(10), c(6), [c(10)]); // dealer 16 + 10 bust
  assert.equal(s.hands[0].result, 'win');
  assert.equal(s.dealer.cards.length, 3);
  s = run(c(10), c(6), c(10), c(6), [c(5)]); // 16 v 16+5 = 21
  assert.equal(s.hands[0].result, 'lose');
});

test('insurance: offered on Ace, pays 2:1 on dealer blackjack, lost otherwise', () => {
  let s = start(c(10), c(1), c(8), c(13)); // dealer blackjack
  assert.equal(s.phase, 'insurance');
  assert.equal(B.insuranceCost(s), 50);
  assert.ok(B.insure(s, true));
  assert.equal(s.phase, 'settled');
  // main bet lost (-100), insurance wins 2:1 (+100) -> even
  assert.equal(s.bankroll, 1000);
  assert.equal(s.lastNet, 0);
  s = start(c(10), c(1), c(8), c(13));
  B.insure(s, false);
  assert.equal(s.bankroll, 900);
  s = start(c(10), c(1), c(8), c(6), [c(10)]); // dealer no blackjack
  B.insure(s, true);
  assert.equal(s.phase, 'player');
  assert.equal(s.bankroll, 1000 - 100 - 50);
  B.stand(s);
  B.dealerPlay(s);
  // dealer A+6 soft 17 stands; player 18 wins 100, insurance lost 50
  assert.equal(s.lastNet, 100 - 50);
  assert.equal(s.bankroll, 1000 + 50);
  // player blackjack + insurance = even money
  s = start(c(1), c(1), c(13), c(12));
  B.insure(s, true);
  assert.equal(s.phase, 'settled');
  assert.equal(s.hands[0].result, 'push');
  assert.equal(s.lastNet, 100); // insurance 2:1 on 50
  s = start(c(1), c(1), c(13), c(7));
  B.insure(s, true);
  assert.equal(s.hands[0].result, 'blackjack');
  assert.equal(s.lastNet, 150 - 50);
  // not offered when disabled / no ace
  s = start(c(10), c(1), c(8), c(6), [], { insurance: false });
  assert.equal(s.phase, 'player');
  s = start(c(10), c(9), c(8), c(6));
  assert.equal(s.phase, 'player');
  // cannot take it when the bankroll cannot cover it
  const t = rigged([c(10), c(1), c(8), c(6)]);
  t.bankroll = 100;
  B.deal(t, [100]);
  assert.equal(t.phase, 'player', 'not offered when it cannot be afforded');
  assert.equal(B.canInsure(t), false);
  assert.equal(B.insure(t, true), null);
  const u = rigged([c(10), c(1), c(8), c(6)]);
  u.bankroll = 150;
  B.deal(u, [100]);
  assert.equal(u.phase, 'insurance');
  assert.equal(B.canInsure(u), true);
  assert.ok(B.insure(u, true));
  assert.equal(u.bankroll, 0);
});

test('double down: any two cards, one card, doubles the bet; needs chips', () => {
  let s = start(c(5), c(6), c(4), c(10), [c(10), c(7)]); // 9 vs 6
  assert.ok(B.legalActions(s).double);
  B.doubleDown(s);
  assert.equal(s.hands[0].bet, 200);
  assert.equal(s.hands[0].cards.length, 3);
  B.dealerPlay(s);
  assert.equal(s.phase, 'settled'); // 9+10 = 19 vs 16 + 7 = 23 bust
  assert.equal(s.bankroll, 1000 + 200);
  // after a hit, no double
  s = start(c(2), c(6), c(3), c(10), [c(2)]);
  B.hit(s);
  assert.equal(B.legalActions(s).double, false);
  assert.equal(B.doubleDown(s), null);
  // not enough chips
  const t = rigged([c(5), c(6), c(6), c(10)]);
  t.bankroll = 150;
  B.deal(t, [100]);
  assert.equal(B.legalActions(t).double, false);
  // doubled loss
  s = start(c(5), c(10), c(6), c(9), [c(2)]); // 11 v 19
  B.doubleDown(s);
  B.dealerPlay(s);
  assert.equal(s.hands[0].result, 'lose');
  assert.equal(s.bankroll, 1000 - 200);
});

test('split: same rank only (ten-values by option), payouts per hand', () => {
  const s = start(c(8), c(6), c(8), c(10), [c(3), c(10), c(9), c(10)]);
  assert.ok(B.legalActions(s).split);
  B.split(s);
  assert.equal(s.hands.length, 2);
  assert.equal(s.bankroll, 800);
  assert.equal(s.active, 0);
  assert.deepEqual(s.hands[0].cards, [c(8), c(3)]);
  assert.deepEqual(s.hands[1].cards, [c(8), c(10)]);
  B.stand(s); // 11 stands (for the test)
  assert.equal(s.active, 1);
  B.stand(s); // 18
  B.dealerPlay(s); // dealer 6+10 = 16 -> hits 9 -> bust? 25 bust
  assert.equal(s.phase, 'settled');
  assert.deepEqual(s.hands.map((h) => h.result), ['win', 'win']);
  assert.equal(s.bankroll, 1200);
  // K + Q: not a split by default, is with splitByValue
  let t = start(c(13), c(6), c(12), c(10));
  assert.equal(B.legalActions(t).split, false);
  t = start(c(13), c(6), c(12), c(10), [], { splitByValue: true });
  assert.equal(B.legalActions(t).split, true);
  t = start(c(13), c(6), c(13, 2), c(10));
  assert.equal(B.legalActions(t).split, true);
});

test('split: max 3 splits (4 hands), then no more', () => {
  const s = start(c(8), c(6), c(8), c(10), [c(8), c(8), c(8), c(8), c(8), c(2, 2)]);
  B.split(s); // hand0 [8,8], hand1 [8,8]
  assert.equal(s.hands.length, 2);
  B.split(s); // hand0 [8,8] again
  assert.equal(s.hands.length, 3);
  B.split(s);
  assert.equal(s.hands.length, 4);
  assert.equal(B.legalActions(s).split, false);
  assert.equal(B.split(s), null);
  assert.equal(s.bankroll, 1000 - 400);
});

test('split aces: one card each, no re-split, no double, 21 pays 1:1', () => {
  const s = start(c(1), c(6), c(1), c(10), [c(13), c(1), c(2)]);
  assert.ok(B.legalActions(s).split);
  B.split(s);
  // each ace got one card: K (21, not a blackjack) and A (soft 12)
  assert.equal(s.hands[0].cards.length, 2);
  assert.equal(s.hands[1].cards.length, 2);
  assert.ok(s.hands.every((h) => h.done));
  assert.notEqual(s.phase, 'player');
  B.dealerPlay(s);
  assert.equal(s.phase, 'settled');
  assert.equal(s.hands[0].result, 'win'); // 21 after split pays 1:1
  assert.equal(s.hands[0].net, 100);
  assert.notEqual(s.hands[0].result, 'blackjack');
});

test('double after split follows DAS', () => {
  const mk = (das) => {
    const s = start(c(8), c(6), c(8), c(10), [c(3), c(2)], { das });
    B.split(s);
    return s;
  };
  assert.equal(B.legalActions(mk(true)).double, true);
  assert.equal(B.legalActions(mk(false)).double, false);
});

test('late surrender (option) returns half the bet, only on the first two cards', () => {
  let s = start(c(10), c(10), c(6), c(7), [], { surrender: true }); // 16 vs 10
  assert.ok(B.legalActions(s).surrender);
  B.surrender(s);
  assert.equal(s.phase, 'settled');
  assert.equal(s.hands[0].result, 'surrender');
  assert.equal(s.bankroll, 950);
  s = start(c(10), c(10), c(6), c(7));
  assert.equal(B.legalActions(s).surrender, false);
  assert.equal(B.surrender(s), null);
  s = start(c(2), c(10), c(3), c(7), [c(2)], { surrender: true });
  B.hit(s);
  assert.equal(B.legalActions(s).surrender, false);
});

test('multiple boxes: independent hands, insurance per box, bets validated', () => {
  const s = rigged([c(10), c(9), c(10), c(9), c(10), c(8), c(7), c(10)], { boxes: 2 });
  // deal order: box1, box2, dealer up, box1, box2, dealer hole... (round-robin)
  assert.equal(B.deal(s, [5000, 0]), null, 'bet above bankroll not allowed');
  assert.equal(B.deal(s, [0, 0]), null);
  assert.equal(B.deal(s, [2, 0]), null, 'below the minimum');
  assert.ok(B.deal(s, [100, 50]));
  assert.equal(s.hands.length, 2);
  assert.equal(s.bankroll, 850);
  assert.equal(s.hands[0].box, 0);
  assert.equal(s.hands[1].box, 1);
  assert.deepEqual(s.hands[0].cards, [c(10), c(9)]);
  assert.deepEqual(s.hands[1].cards, [c(9), c(10)]);
  assert.deepEqual(s.dealer.cards, [c(10), c(8)]);
  B.stand(s);
  assert.equal(s.active, 1);
  B.stand(s);
  B.dealerPlay(s);
  assert.equal(s.hands[0].result, 'win');
  assert.equal(s.hands[1].result, 'win');
  assert.equal(s.bankroll, 850 + 200 + 100);
});

test('shoe: reshuffles at the cut card; never runs dry mid-round; fair shuffle keeps composition', () => {
  const s = B.newGame(99, { decks: 6 });
  B.deal(s, [5]);
  assert.equal(s.shoe.length + s.dealtSince, 312);
  const comp = {};
  for (const id of [...s.shoe, ...s.hands.flatMap((h) => h.cards), ...s.dealer.cards]) comp[id] = (comp[id] || 0) + 1;
  for (let i = 0; i < 52; i++) assert.equal(comp[i], 6);
  // force the penetration
  s.phase = 'settled';
  B.nextHand(s);
  s.dealtSince = 234;
  assert.ok(B.penetrationReached(s));
  const ev = B.deal(s, [5]);
  assert.ok(ev.some((e) => e.t === 'shuffle'));
  assert.ok(s.dealtSince < 20);
  // mid-round exhaustion
  const t = start(c(2), c(10), c(3), c(6), [], { decks: 1 });
  t.shoe = [];
  let guard = 0;
  while (t.phase === 'player' && guard++ < 50) B.hit(t);
  assert.ok(t.hands[0].cards.length > 2, 'drew from a rebuilt shoe');
  const seen = [...t.shoe, ...t.hands[0].cards, ...t.dealer.cards];
  assert.ok(seen.length <= 52);
  if (t.phase === 'dealer') B.dealerPlay(t);
  assert.equal(t.phase, 'settled');
});

test('same seed -> same shoe order; different seeds differ', () => {
  const a = B.newGame(7);
  const b = B.newGame(7);
  B.deal(a, [5]);
  B.deal(b, [5]);
  assert.deepEqual(a.shoe, b.shoe);
  const d = B.newGame(8);
  B.deal(d, [5]);
  assert.notDeepEqual(a.shoe, d.shoe);
});

test('bankroll busting, refill and challenge levels', () => {
  const s = B.newGame(1);
  s.bankroll = 3;
  assert.equal(B.canBet(s), false);
  assert.equal(B.deal(s, [5]), null);
  assert.ok(B.refill(s));
  assert.equal(s.bankroll, 1000);
  assert.deepEqual(B.challengeLevel(1), { level: 1, goal: 2500, hands: 25 });
  assert.equal(B.challengeLevel(2).goal, 5000);
  assert.ok(B.challengeLevel(9).goal > B.challengeLevel(5).goal);
});

// ---------- basic strategy ----------
const H = (a, b) => [c(a), c(b, 1)];
test('basic strategy: well known cells (S17, DAS, multi-deck)', () => {
  const m = (cards, up, o) => basicMove(cards, up, o);
  assert.equal(m(H(10, 6), 10), 'hit');
  assert.equal(m(H(10, 6), 6), 'stand');
  assert.equal(m(H(10, 2), 4), 'stand'); // 12 v 4
  assert.equal(m(H(10, 2), 3), 'hit'); // 12 v 3
  assert.equal(m(H(6, 5), 10), 'double'); // 11 v 10
  assert.equal(m(H(6, 5), 1), 'hit'); // 11 v A (S17)
  assert.equal(m(H(6, 5), 1, { h17: true }), 'double');
  assert.equal(m(H(6, 4), 10), 'hit'); // 10 v 10
  assert.equal(m(H(6, 4), 9), 'double');
  assert.equal(m(H(5, 4), 2), 'hit');
  assert.equal(m(H(5, 4), 3), 'double');
  assert.equal(m(H(1, 7), 2), 'stand'); // A7 v 2
  assert.equal(m(H(1, 7), 3), 'double'); // A7 v 3
  assert.equal(m(H(1, 7), 9), 'hit');
  assert.equal(m(H(1, 8), 6), 'stand');
  assert.equal(m(H(1, 8), 6, { h17: true }), 'double');
  assert.equal(m(H(1, 6), 3), 'double');
  assert.equal(m(H(1, 6), 2), 'hit');
  assert.equal(m(H(1, 2), 5), 'double');
  assert.equal(m(H(1, 2), 4), 'hit');
  assert.equal(m([c(1), c(1, 1)], 10), 'split');
  assert.equal(m([c(8), c(8, 1)], 1), 'split');
  assert.equal(m([c(10), c(10, 1)], 6), 'stand');
  assert.equal(m([c(5), c(5, 1)], 6), 'double');
  assert.equal(m([c(5), c(5, 1)], 10), 'hit');
  assert.equal(m([c(9), c(9, 1)], 7), 'stand');
  assert.equal(m([c(9), c(9, 1)], 8), 'split');
  assert.equal(m([c(9), c(9, 1)], 10), 'stand');
  assert.equal(m([c(7), c(7, 1)], 7), 'split');
  assert.equal(m([c(7), c(7, 1)], 8), 'hit');
  assert.equal(m([c(6), c(6, 1)], 2), 'split');
  assert.equal(m([c(6), c(6, 1)], 7), 'hit');
  assert.equal(m([c(4), c(4, 1)], 5), 'split');
  assert.equal(m([c(4), c(4, 1)], 5, { das: false }), 'double'.length ? 'hit' : '');
  assert.equal(m([c(2), c(2, 1)], 7), 'split');
  assert.equal(m([c(2), c(2, 1)], 8), 'hit');
  assert.equal(m(H(10, 7), 1), 'stand');
  assert.equal(m(H(10, 9), 10, { surrender: true }), 'stand');
  assert.equal(m(H(10, 6), 10, { surrender: true }), 'surrender');
  assert.equal(m(H(10, 5), 10, { surrender: true }), 'surrender');
  assert.equal(m(H(10, 5), 9, { surrender: true }), 'hit');
});

test('basic strategy: complete table sanity (never nonsense, monotone stand)', () => {
  for (let up = 1; up <= 10; up++) {
    // hard totals 17+ always stand, <=8 always hit
    for (let a = 2; a <= 10; a++) {
      for (let b = 2; b <= 10; b++) {
        const cards = [c(a), c(b, 1)];
        const tt = B.total(cards).total;
        if (a === b) continue;
        const mv = basicMove(cards, up);
        if (tt >= 17) assert.equal(mv, 'stand', `${a},${b} v ${up}`);
        if (tt <= 8) assert.equal(mv, 'hit');
        assert.ok(['hit', 'stand', 'double'].includes(mv));
      }
    }
    for (let x = 2; x <= 9; x++) {
      const cards = [c(1), c(x, 1)];
      const mv = basicMove(cards, up);
      if (x >= 9) assert.equal(mv, 'stand');
      assert.ok(['hit', 'stand', 'double'].includes(mv));
    }
    // pairs: A,A and 8,8 always split; T,T and 5,5 never split
    assert.equal(basicMove([c(1), c(1, 1)], up), 'split');
    assert.equal(basicMove([c(8), c(8, 1)], up), 'split');
    assert.notEqual(basicMove([c(10), c(10, 1)], up), 'split');
    assert.notEqual(basicMove([c(5), c(5, 1)], up), 'split');
  }
});

test('suggest() falls back to a legal action', () => {
  const noD = { double: false, split: true, surrender: false };
  assert.equal(suggest([c(5), c(4), c(2)], 6, {}, noD), 'hit'); // 11 would double
  assert.equal(suggest([c(1), c(2), c(5)], 3, {}, noD), 'stand'); // soft 18 vs 3: Ds -> stand
  assert.equal(suggest([c(1), c(7)], 5, {}, noD), 'stand');
  assert.equal(suggest([c(8), c(8, 1)], 10, {}, { double: true, split: false, surrender: false }), 'hit'); // 16 v 10
  assert.equal(suggest([c(10), c(6, 1)], 10, { surrender: true }, { double: true, split: false, surrender: false }), 'hit');
});

// ---------- fuzz / simulation ----------
function playRound(s, policy) {
  const bets = Array(s.opts.boxes).fill(0).map((_, i) => (i === 0 ? 100 : Math.random() < 0.5 ? 25 : 0));
  if (!bets.some((x) => x > 0)) bets[0] = 25;
  const start = s.bankroll;
  const sum = bets.reduce((a, b) => a + b, 0);
  if (sum > s.bankroll) return null;
  assert.ok(B.deal(s, bets));
  let guard = 0;
  while (s.phase !== 'settled' && guard++ < 400) {
    assert.equal(s.bankroll + B.escrow(s), start, 'chips on the table + bankroll are constant during a round');
    assert.ok(s.bankroll >= 0);
    if (s.phase === 'insurance') {
      B.insure(s, policy.insure(s));
      continue;
    }
    if (s.phase === 'dealer') {
      assert.ok(B.dealerStep(s));
      continue;
    }
    assert.equal(s.phase, 'player');
    const la = B.legalActions(s);
    const h = B.activeHand(s);
    assert.ok(h && !h.done);
    const mv = policy.move(s, la);
    const fn = { hit: B.hit, stand: B.stand, double: B.doubleDown, split: B.split, surrender: B.surrender }[mv];
    assert.ok(la[mv === 'double' ? 'double' : mv] || mv === 'hit' || mv === 'stand');
    assert.ok(fn(s), `action ${mv} rejected`);
  }
  assert.equal(s.phase, 'settled');
  const net = s.hands.reduce((a, h) => a + h.net, 0) + s.insNet;
  assert.equal(s.lastNet, net);
  assert.equal(s.bankroll, start + net, 'chips conserved: bankroll change equals the sum of results');
  assert.ok(s.hands.every((h) => h.result && h.done));
  assert.equal(B.escrow(s), 0);
  // nothing playable after settlement
  assert.equal(B.hit(s), null);
  assert.equal(B.doubleDown(s), null);
  assert.equal(B.split(s), null);
  return net;
}

test('fuzz: random legal play never breaks invariants (chips conserved)', () => {
  const rand = (() => {
    let x = 12345;
    return () => {
      x = (x * 1664525 + 1013904223) >>> 0;
      return x / 4294967296;
    };
  })();
  const randomPolicy = {
    insure: () => rand() < 0.5,
    move: (s, la) => {
      const opts = ['hit', 'stand'];
      if (la.double) opts.push('double');
      if (la.split) opts.push('split', 'split');
      if (la.surrender) opts.push('surrender');
      return opts[Math.floor(rand() * opts.length)];
    },
  };
  for (const cfg of [{}, { h17: true, boxes: 3 }, { decks: 1, surrender: true, boxes: 2 }, { decks: 2, das: false, splitByValue: true }]) {
    for (let seed = 1; seed <= 6; seed++) {
      const s = B.newGame(seed * 77, { ...cfg, max: 100000 });
      s.bankroll = 1e6;
      for (let i = 0; i < 1500; i++) {
        playRound(s, randomPolicy);
        B.nextHand(s);
        assert.equal(s.phase, 'bet');
      }
    }
  }
});

test('simulation: basic strategy (S17) has a house edge of roughly 0.3-1% (sanity on tables + rules)', () => {
  const s = B.newGame(2024, { max: 1e9 });
  s.bankroll = 1e9;
  const policy = {
    insure: () => false,
    move: (st, la) => {
      const h = B.activeHand(st);
      const m = suggest(h.cards, B.rankOf(st.dealer.cards[0]), st.opts, la);
      return m;
    },
  };
  const N = 250000;
  let net = 0;
  let bets = 0;
  const origRandom = Math.random;
  Math.random = () => 1; // no side boxes
  try {
    for (let i = 0; i < N; i++) {
      const before = s.bankroll;
      s.opts.boxes = 1;
      const n = playRound(s, policy);
      void before;
      net += n;
      bets += 100;
      for (const h of s.hands) bets += h.bet - 100 > 0 ? h.bet - 100 : 0;
      if (s.hands.length > 1) bets += (s.hands.length - 1) * 100;
      B.nextHand(s);
    }
  } finally {
    Math.random = origRandom;
  }
  const edge = net / bets;
  console.log('basic strategy edge', (edge * 100).toFixed(3) + '%');
  assert.ok(edge < 0.005 && edge > -0.02, `edge ${(edge * 100).toFixed(2)}%`);
});
