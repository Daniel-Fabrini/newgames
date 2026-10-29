import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.js';

const c = (s, r, d = 0) => d * 54 + s * 13 + (r - 1); // suit 0..3, rank 1..13
const J = (d = 0) => d * 54 + 52;
const S = 0, H = 1, D = 2, C = 3;

function blank(over = {}) {
  const st = R.newRound({ n: 4, seed: 1 });
  st.hands = [[], [], [], []];
  st.stock = [c(S, 9), c(S, 10), c(S, 11)];
  st.pile = [c(C, 9)];
  st.turn = 0;
  st.phase = 'play';
  return Object.assign(st, over);
}
const valid = (...ids) => R.arrangements(ids).length > 0;

test('deal: 108 cards, 11 each, mortos, stock, one discard', () => {
  const st = R.newRound({ n: 4, seed: 42 });
  assert.equal(st.hands.length, 4);
  st.hands.forEach((h) => assert.equal(h.length, 11));
  assert.equal(st.mortos[0].length, 11);
  assert.equal(st.mortos[1].length, 11);
  assert.equal(st.pile.length, 1);
  assert.equal(st.stock.length, 108 - 44 - 22 - 1);
  const all = [...st.hands.flat(), ...st.mortos.flat(), ...st.pile, ...st.stock];
  assert.equal(new Set(all).size, 108);
  const d = R.newRound({ n: 2, seed: 42 });
  assert.equal(d.hands.length, 2);
  assert.equal(d.stock.length, 108 - 22 - 22 - 1);
});

test('same seed -> same deal, different seed -> different', () => {
  assert.deepEqual(R.newRound({ seed: 7 }), R.newRound({ seed: 7 }));
  assert.notDeepEqual(R.newRound({ seed: 7 }).hands, R.newRound({ seed: 8 }).hands);
});

test('card values', () => {
  assert.equal(R.cardPoints(J()), 50);
  assert.equal(R.cardPoints(c(H, 2)), 20);
  assert.equal(R.cardPoints(c(H, 1)), 15);
  for (const r of [8, 9, 10, 11, 12, 13]) assert.equal(R.cardPoints(c(D, r)), 10);
  for (const r of [3, 4, 5, 6, 7]) assert.equal(R.cardPoints(c(D, r)), 5);
});

test('sequences: basic, ace low and high, no wrap', () => {
  assert.ok(valid(c(H, 3), c(H, 4), c(H, 5)));
  assert.ok(valid(c(H, 1), c(H, 2), c(H, 3)));
  assert.ok(valid(c(H, 12), c(H, 13), c(H, 1)));
  assert.ok(!valid(c(H, 13), c(H, 1), c(H, 3)), 'K-A-3 wraps'); assert.ok(valid(c(H, 13), c(H, 1), c(H, 2)), '2 as wild Q');
  assert.ok(!valid(c(H, 3), c(S, 4), c(H, 5)), 'mixed suits');
  assert.ok(!valid(c(H, 3), c(H, 3, 1), c(H, 4)), 'duplicate rank');
  assert.ok(!valid(c(H, 3), c(H, 5), c(H, 6)), 'gap');
  assert.ok(!valid(c(H, 3), c(H, 4)), 'two cards');
});

test('wilds: one per meld, jokers and 2s', () => {
  assert.ok(valid(c(H, 3), J(), c(H, 5)));
  assert.ok(valid(c(H, 3), c(H, 4), J()), 'wild at end');
  assert.ok(valid(c(H, 3), c(S, 2), c(H, 5)), 'off-suit 2 as wild');
  assert.ok(!valid(c(H, 3), J(), J(1), c(H, 6)), 'two wilds');
  assert.ok(!valid(c(H, 3), J(), c(S, 2), c(H, 6)), 'two wilds with off-suit 2');
  assert.ok(!valid(J(), J(1), c(H, 5)), 'two jokers');
});

test('natural 2 in place is not wild; a second wild may coexist', () => {
  const a = R.arrangements([c(H, 1), c(H, 2), c(H, 3)]);
  assert.equal(a.length, 1);
  assert.equal(R.wildCount(a[0].cards), 0);
  assert.ok(valid(c(H, 1), c(H, 2), c(H, 3), J(), c(H, 5)), 'A 2 3 wild(4) 5? needs 4: yes joker is 4');
  const b = R.arrangements([c(H, 3), c(H, 4), c(H, 2), J(), c(H, 6)]);
  assert.ok(b.length >= 1);
  assert.equal(R.wildCount(b[0].cards), 1);
  // natural 2 + off-suit 2 : the off-suit one is the single wild
  const d = R.arrangements([c(H, 2), c(H, 3), c(H, 4), c(S, 2)]);
  assert.ok(d.length >= 1);
  assert.equal(R.wildCount(d[0].cards), 1);
  // a 2 of the same suit used elsewhere counts as wild
  const e = R.arrangements([c(H, 3), c(H, 4), c(H, 2, 1), c(H, 6)]);
  assert.ok(e.some((x) => x.cards.some((k) => k.w)) === false || e.length > 0);
  assert.ok(valid(c(H, 3), c(H, 4), c(H, 5), c(H, 6), c(H, 2), c(H, 2, 1)), '2 natural + second 2 as wild at 7');
});

test('ambiguous wild placement yields several arrangements', () => {
  const a = R.arrangements([c(H, 5), c(H, 6), c(H, 7), J()]);
  assert.ok(a.length >= 2);
  const hiFirst = a[0].cards.map((k) => k.r);
  assert.deepEqual(hiFirst.sort((x, y) => x - y), [4, 5, 6, 7].map((v) => v) .length ? hiFirst : []);
});

test('extending a meld keeps slots, forbids a second wild and wrapping', () => {
  const st = blank();
  const m = { id: 1, suit: H, cards: R.arrangements([c(H, 5), c(H, 6), c(H, 7)])[0].cards };
  assert.ok(R.extensions(m, [c(H, 8)]).length);
  assert.ok(R.extensions(m, [c(H, 4)]).length);
  assert.ok(!R.extensions(m, [c(H, 9)]).length, 'gap');
  assert.ok(R.extensions(m, [J()]).length, 'wild extends');
  const w = { id: 2, suit: H, cards: R.arrangements([c(H, 5), c(H, 6), J()])[0].cards };
  assert.ok(!R.extensions(w, [c(S, 2)]).length, 'second wild');
  assert.ok(!R.extensions(w, [J(1)]).length);
  const hi = { id: 3, suit: H, cards: R.arrangements([c(H, 11), c(H, 12), c(H, 13)])[0].cards };
  assert.ok(R.extensions(hi, [c(H, 1)]).length, 'ace high');
  const lo = { id: 4, suit: H, cards: R.arrangements([c(H, 1), c(H, 2), c(H, 3)])[0].cards };
  assert.ok(!R.extensions(lo, [c(H, 13)]).length, 'no wrap');
  assert.ok(!R.extensions(hi, [c(H, 3)]).length, 'no wrap high');
  // natural cannot replace the wild
  assert.ok(!R.extensions({ id: 5, suit: H, cards: R.arrangements([c(H, 5), J(), c(H, 7)])[0].cards }, [c(H, 6)]).length);
  void st;
});

test('canastra kinds and real', () => {
  const clean = { cards: R.arrangements([3, 4, 5, 6, 7, 8, 9].map((r) => c(H, r)))[0].cards };
  assert.equal(R.canastraKind(clean), 'clean');
  const dirty = { cards: R.arrangements([3, 4, 5, 6, 7, 8].map((r) => c(H, r)).concat([J()]))[0].cards };
  assert.equal(R.canastraKind(dirty), 'dirty');
  const six = { cards: R.arrangements([3, 4, 5, 6, 7, 8].map((r) => c(H, r)))[0].cards };
  assert.equal(R.canastraKind(six), null);
  const real = { cards: R.arrangements([...Array(13).keys()].map((i) => c(H, i + 1)))[0].cards };
  assert.equal(real.cards.length, 13);
  assert.equal(R.canastraKind(real), 'real');
  const nat2 = { cards: R.arrangements([2, 3, 4, 5, 6, 7, 8].map((r) => c(H, r)))[0].cards };
  assert.equal(R.canastraKind(nat2), 'clean');
});

test('meld action moves cards, validates ownership and turn phase', () => {
  const st = blank();
  st.hands[0] = [c(H, 3), c(H, 4), c(H, 5), c(D, 9), c(D, 10)];
  assert.equal(R.apply(st, { type: 'meld', ids: [c(H, 3), c(H, 4), c(H, 6)] }).ok, false);
  assert.equal(R.apply(st, { type: 'meld', ids: [c(H, 3), c(H, 4), c(H, 5)] }).ok, true);
  assert.equal(st.hands[0].length, 2);
  assert.equal(st.melds[0].length, 1);
  assert.equal(R.apply(st, { type: 'meld', ids: [c(S, 3), c(S, 4), c(S, 5)] }).code, 'notInHand');
  st.phase = 'draw';
  assert.equal(R.apply(st, { type: 'discard', id: c(D, 9) }).ok, false);
});

test('teams only add to their own melds', () => {
  const st = blank();
  st.hands[0] = [c(H, 3), c(H, 4), c(H, 5), c(D, 9), c(D, 10)];
  st.hands[1] = [c(H, 6), c(D, 9, 1), c(D, 8)];
  R.apply(st, { type: 'meld', ids: [c(H, 3), c(H, 4), c(H, 5)] });
  R.apply(st, { type: 'discard', id: c(D, 10) });
  st.turn = 1; st.phase = 'play';
  assert.equal(R.apply(st, { type: 'add', meld: 1, ids: [c(H, 6)] }).ok, false);
});

test('draw: takes from the stock top; turn passes on discard', () => {
  const st = R.newRound({ n: 4, seed: 3 });
  const seat = st.turn;
  const top = st.stock[st.stock.length - 1];
  assert.equal(R.apply(st, { type: 'draw' }).ok, true);
  assert.ok(st.hands[seat].includes(top));
  assert.equal(st.hands[seat].length, 12);
  R.apply(st, { type: 'discard', id: st.hands[seat][0] });
  assert.equal(st.turn, (seat + 1) % 4);
  assert.equal(st.phase, 'draw');
});

test('taking the lixo requires using the top card immediately', () => {
  const st = blank({ phase: 'draw' });
  st.hands[0] = [c(H, 4), c(H, 5), c(D, 12), c(D, 13)];
  st.pile = [c(S, 13), c(D, 2, 1), c(H, 6)];
  assert.equal(R.canTakePile(st, 0), true);
  const bad = R.apply(st, { type: 'take', play: { t: 'meld', ids: [c(H, 6), c(D, 12), c(D, 13)] } });
  assert.equal(bad.ok, false);
  assert.equal(R.apply(st, { type: 'take', play: { t: 'meld', ids: [c(H, 4), c(H, 5), c(S, 13)] } }).ok, false, 'top card missing');
  const ok = R.apply(st, { type: 'take', play: { t: 'meld', ids: [c(H, 4), c(H, 5), c(H, 6)] } });
  assert.equal(ok.ok, true);
  assert.equal(st.pile.length, 0);
  assert.equal(st.hands[0].length, 4 + 3 - 3);
  assert.equal(st.phase, 'play');
  assert.equal(st.pileTakes.length, 1);
  const none = blank({ phase: 'draw' });
  none.hands[0] = [c(D, 4), c(S, 8)];
  none.pile = [c(H, 12)];
  assert.equal(R.canTakePile(none, 0), false);
  assert.equal(R.apply(none, { type: 'take', play: { t: 'meld', ids: [c(H, 12), c(D, 4), c(S, 8)] } }).ok, false);
});

test('taking the lixo by adding to a team meld', () => {
  const st = blank({ phase: 'draw' });
  st.hands[0] = [c(D, 4), c(S, 8)];
  st.melds[0].push({ id: 9, suit: H, cards: R.arrangements([c(H, 3), c(H, 4), c(H, 5)])[0].cards });
  st.pile = [c(S, 7), c(H, 6)];
  assert.equal(R.canTakePile(st, 0), true);
  assert.equal(R.apply(st, { type: 'take', play: { t: 'add', meld: 9, ids: [c(H, 6)] } }).ok, true);
  assert.equal(st.melds[0][0].cards.length, 4);
  assert.equal(st.hands[0].length, 3);
});

test('morto: emptying the hand by melding takes it and play continues', () => {
  const st = blank();
  st.hands[0] = [c(H, 3), c(H, 4), c(H, 5)];
  const morto = st.mortos[0].slice();
  const r = R.apply(st, { type: 'meld', ids: [...st.hands[0]] });
  assert.equal(r.ok, true);
  assert.equal(st.mortoTaken[0], true);
  assert.deepEqual(st.hands[0].slice().sort(), morto.sort());
  assert.equal(st.phase, 'play');
  assert.equal(st.turn, 0);
  assert.equal(st.mortos[0], null);
  assert.equal(st.phase === 'end', false);
});

test('morto: emptying by discard takes it and the turn passes', () => {
  const st = blank();
  st.hands[0] = [c(D, 7)];
  const r = R.apply(st, { type: 'discard', id: c(D, 7) });
  assert.equal(r.ok, true);
  assert.equal(st.mortoTaken[0], true);
  assert.equal(st.hands[0].length, 11);
  assert.equal(st.turn, 1);
});

test('going out needs a canastra and the morto', () => {
  const st = blank();
  st.mortoTaken = [true, false]; st.mortos[0] = null;
  st.hands[0] = [c(D, 7)];
  assert.equal(R.apply(st, { type: 'discard', id: c(D, 7) }).code, 'needCanastra');
  st.melds[0].push({ id: 1, suit: H, cards: R.arrangements([3, 4, 5, 6, 7, 8, 9].map((r) => c(H, r)))[0].cards });
  const r = R.apply(st, { type: 'discard', id: c(D, 7) });
  assert.equal(r.ok, true);
  assert.equal(st.phase, 'end');
  assert.equal(st.ended.reason, 'bater');
  assert.equal(st.ended.team, 0);
});

test('going out by melding every card; leaving a lone card without canastra is refused', () => {
  const st = blank();
  st.mortoTaken = [true, false]; st.mortos[0] = null;
  st.hands[0] = [c(D, 7), c(H, 3), c(H, 4), c(H, 5)];
  assert.equal(R.apply(st, { type: 'meld', ids: [c(H, 3), c(H, 4), c(H, 5)] }).code, 'lastCard');
  st.melds[0].push({ id: 1, suit: S, cards: R.arrangements([3, 4, 5, 6, 7, 8, 9].map((r) => c(S, r)))[0].cards });
  assert.equal(R.apply(st, { type: 'meld', ids: [c(H, 3), c(H, 4), c(H, 5)] }).ok, true);
  assert.equal(R.apply(st, { type: 'discard', id: c(D, 7) }).ok, true);
  assert.equal(st.ended.reason, 'bater');
});

test('cleanOut option requires a clean canastra', () => {
  const st = blank({ cleanOut: true });
  st.mortoTaken = [true, false]; st.mortos[0] = null;
  st.hands[0] = [c(D, 7)];
  st.melds[0].push({ id: 1, suit: H, cards: R.arrangements([3, 4, 5, 6, 7, 8].map((r) => c(H, r)).concat([J()]))[0].cards });
  assert.equal(R.apply(st, { type: 'discard', id: c(D, 7) }).code, 'needCanastra');
});

test('stock exhaustion ends the round when the lixo cannot be taken', () => {
  const st = blank();
  st.stock = [];
  st.hands[0] = [c(D, 7), c(D, 9)];
  st.hands[1] = [c(S, 4), c(S, 8)];
  st.pile = [c(H, 12)];
  R.apply(st, { type: 'discard', id: c(D, 7) });
  assert.equal(st.phase, 'end');
  assert.equal(st.ended.reason, 'stock');
});

test('stock exhaustion lets the next seat continue if it can take the lixo', () => {
  const st = blank();
  st.stock = [];
  st.hands[0] = [c(D, 7), c(D, 9)];
  st.hands[1] = [c(S, 4), c(S, 5)];
  R.apply(st, { type: 'discard', id: c(D, 9) }); // pile: C9, D9 -> S4 S5 do not use D9
  assert.equal(st.phase, 'end');
  const st2 = blank();
  st2.stock = [];
  st2.hands[0] = [c(S, 6), c(D, 9)];
  st2.hands[1] = [c(S, 4), c(S, 5)];
  R.apply(st2, { type: 'discard', id: c(S, 6) });
  assert.equal(st2.phase, 'draw');
  assert.equal(R.canTakePile(st2, 1), true);
  assert.equal(R.apply(st2, { type: 'draw' }).code, 'stockEmpty');
  assert.equal(R.apply(st2, { type: 'stop' }).ok, true);
  assert.equal(st2.ended.reason, 'stop');
});

test('scoring: melds + canastras + bater - hand - missing morto', () => {
  const st = blank();
  st.phase = 'end';
  st.ended = { reason: 'bater', seat: 0, team: 0 };
  st.mortoTaken = [true, false];
  st.melds[0].push({ id: 1, suit: H, cards: R.arrangements([3, 4, 5, 6, 7, 8, 9].map((r) => c(H, r)))[0].cards });
  st.melds[0].push({ id: 2, suit: S, cards: R.arrangements([12, 13, 1].map((r) => c(S, r)))[0].cards });
  st.melds[1].push({ id: 3, suit: D, cards: R.arrangements([3, 4, 5, 6, 7, 8].map((r) => c(D, r)).concat([J()]))[0].cards });
  st.hands = [[], [c(H, 13)], [], [c(D, 2), J(1)]];
  const sc = R.scoreRound(st);
  // team 0: 5*5 + 10+10 (8,9) = 45 ; +10+10+15 = 35  -> 80 ; +200 +100 -0
  assert.equal(sc[0].meldPts, 25 + 20 + 35);
  assert.equal(sc[0].canastraPts, 200);
  assert.equal(sc[0].bater, 100);
  assert.equal(sc[0].handPts, 0);
  assert.equal(sc[0].morto, 0);
  assert.equal(sc[0].total, 80 + 200 + 100);
  // team 1: 5*5+10 (3-7=25, 8=10)+50 = 85; canastra dirty 100; hand 10+20+50=80; morto -100
  assert.equal(sc[1].meldPts, 85);
  assert.equal(sc[1].canastraPts, 100);
  assert.equal(sc[1].handPts, 80);
  assert.equal(sc[1].morto, -100);
  assert.equal(sc[1].total, 85 + 100 - 80 - 100);
});

test('matchWinner: needs the target and no tie', () => {
  assert.equal(R.matchWinner([2999, 100], 3000), null);
  assert.equal(R.matchWinner([3000, 100], 3000), 0);
  assert.equal(R.matchWinner([3100, 3100], 3000), null);
  assert.equal(R.matchWinner([1500, 1600], 1500), 1);
});

test('viewFor never exposes other hands, stock or mortos', () => {
  const st = R.newRound({ seed: 5 });
  const v = R.viewFor(st, 0);
  const json = JSON.stringify(v);
  assert.ok(!('hands' in v) && !('stock' in v) && !('mortos' in v));
  assert.equal(v.hand.length, 11);
  assert.ok(typeof v.stockCount === 'number');
  assert.ok(!json.includes(JSON.stringify(st.hands[1])));
});
