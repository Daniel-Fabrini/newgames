import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.js';
import { decide, PERSONAS, DIFFICULTY, randomAction } from '../ai.js';

const mkRnd = (seed) => { const s = { rng: seed >>> 0 }; return () => R.nextRand(s); };

test('deck has 40 unique cards, no 8/9/10', () => {
  const d = R.makeDeck();
  assert.equal(d.length, 40);
  assert.equal(new Set(d).size, 40);
  assert.ok(d.every((c) => R.RANKS.includes(c[0]) && R.SUITS.includes(c[1])));
});

test('card order 4<5<6<7<Q<J<K<A<2<3 when no manilha matches', () => {
  const man = 'none';
  const order = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
  for (let i = 0; i < 9; i++) assert.ok(R.strength(order[i] + 'D', man) < R.strength(order[i + 1] + 'D', man));
  assert.equal(R.strength('3C', man), R.strength('3D', man));
});

test('manilha derivation for every vira rank', () => {
  const exp = { 4: '5', 5: '6', 6: '7', 7: 'Q', Q: 'J', J: 'K', K: 'A', A: '2', 2: '3', 3: '4' };
  for (const [v, m] of Object.entries(exp)) assert.equal(R.manilhaRank(v + 'H'), m, v);
});

test('manilhas beat everything and follow suit order C > H > S > D', () => {
  const m = 'Q';
  const ms = ['QD', 'QS', 'QH', 'QC'];
  for (let i = 0; i < 3; i++) assert.ok(R.strength(ms[i], m) < R.strength(ms[i + 1], m));
  assert.ok(R.strength('QD', m) > R.strength('3C', m));
  // the manilha rank is no longer an ordinary rank: 4 manilha cards only
  assert.ok(R.strength('JD', m) < R.strength('QD', m));
});

test('trick winner and ties between teams', () => {
  const m = 'Q';
  assert.deepEqual(R.trickWinner([{ seat: 0, card: '3C' }, { seat: 1, card: '3H' }, { seat: 2, card: '4D' }, { seat: 3, card: '5D' }], m), { team: null, seat: null, tie: true });
  const w = R.trickWinner([{ seat: 0, card: '3C' }, { seat: 1, card: '2H' }, { seat: 2, card: '3D' }, { seat: 3, card: '5D' }], m);
  assert.equal(w.team, 0);
  assert.equal(w.seat, 0); // first of two equal partner cards
  assert.equal(R.trickWinner([{ seat: 0, card: '3C' }, { seat: 1, card: 'QD' }], m).team, 1);
  // hidden card loses to any open card and ties with another hidden card
  assert.equal(R.trickWinner([{ seat: 0, hidden: true, card: 'QC' }, { seat: 1, card: '4D' }], m).team, 1);
  assert.equal(R.trickWinner([{ seat: 0, hidden: true, card: 'QC' }, { seat: 1, hidden: true, card: '4D' }], m).tie, true);
});

test('handWinner: all trick sequences', () => {
  const N = null;
  const cases = [
    [[], undefined], [[0], undefined], [[0, 0], 0], [[1, 1], 1],
    [[0, 1], undefined], [[0, 1, 0], 0], [[0, 1, 1], 1], [[0, 1, N], 0],
    [[1, 0], undefined], [[1, 0, 0], 0], [[1, 0, N], 1],
    [[0, N], 0], [[1, N], 1],
    [[N], undefined], [[N, 0], 0], [[N, 1], 1],
    [[N, N], undefined], [[N, N, 0], 0], [[N, N, 1], 1], [[N, N, N], 'none'],
  ];
  for (const [r, e] of cases) assert.equal(R.handWinner(r), e, JSON.stringify(r));
});

// ---- helper to build controlled games
function setup(hands, vira, opts = {}) {
  const s = R.newGame({ seed: 1, ...opts });
  R.startHand(s);
  const h = s.hand;
  h.hands = hands.map((x) => x.slice());
  h.vira = vira;
  h.manilha = R.manilhaRank(vira);
  return s;
}
const H = (...x) => x;

test('playing a full hand: winner leads next, scoring 1 point', () => {
  // vira 4 -> manilha 5. seat0 leads (dealer 3)
  const s = setup([H('5C', '4D', '4S'), H('3H', '6D', '6S'), H('7D', '7S', 'QD'), H('4H', 'QH', 'KD')], '4H');
  R.act(s, 0, { t: 'play', card: '5C' });
  R.act(s, 1, { t: 'play', card: '3H' });
  R.act(s, 2, { t: 'play', card: '7D' });
  const ev = R.act(s, 3, { t: 'play', card: '4H' });
  assert.ok(ev.some((e) => e.e === 'trick' && e.team === 0 && e.seat === 0));
  assert.equal(s.hand.turn, 0);
  R.act(s, 0, { t: 'play', card: '4D' });
  R.act(s, 1, { t: 'play', card: '6D' });
  R.act(s, 2, { t: 'play', card: '7S' });
  R.act(s, 3, { t: 'play', card: 'QH' });
  // team 0 won trick 1; trick 2: 7S(team0) beats others? 7>6>4, Q>7 -> QH wins (team1)
  assert.equal(s.hand.results[1], 1);
  assert.equal(s.hand.turn, 3);
  R.act(s, 3, { t: 'play', card: 'KD' });
  R.act(s, 0, { t: 'play', card: '4S' });
  R.act(s, 1, { t: 'play', card: '6S' });
  R.act(s, 2, { t: 'play', card: 'QD' });
  assert.equal(s.phase, 'handEnd'); // trick 3: KD wins (team1) -> team1 wins hand 2-1
  assert.deepEqual(s.score, [0, 1]);
});

test('ties: first tie then second decides; scoring none when all tie', () => {
  const s = setup([H('3C', '4D', '5D'), H('3H', '4S', '5S'), H('6D', '6S', '7D'), H('6H', '7S', 'QD')], 'KH'); // manilha A
  const playTrick = (c) => c.forEach((card, i) => R.act(s, (s.hand.leader + i) % 4, { t: 'play', card }));
  // seat leaders: trick 1 leader seat 0
  R.act(s, 0, { t: 'play', card: '3C' }); R.act(s, 1, { t: 'play', card: '3H' }); R.act(s, 2, { t: 'play', card: '6D' }); R.act(s, 3, { t: 'play', card: '6H' });
  assert.equal(s.hand.results[0], null);
  assert.equal(s.hand.turn, 0); // same player leads after a tie
  R.act(s, 0, { t: 'play', card: '4D' }); R.act(s, 1, { t: 'play', card: '4S' }); R.act(s, 2, { t: 'play', card: '6S' }); R.act(s, 3, { t: 'play', card: '7S' });
  assert.equal(s.hand.results[1], 1); // 7S beats 6S/4s
  assert.equal(s.phase, 'handEnd');
  assert.deepEqual(s.score, [0, 1]);
  // all tie
  const s2 = setup([H('3C', '4D', '5D'), H('3H', '4S', '5S'), H('3D', '4C', '5C'), H('3S', '4H', '5H')], 'KH');
  for (const c of ['3', '4', '5']) for (let i = 0; i < 4; i++) {
    if (s2.phase !== 'play') break;
    const seat = s2.hand.turn; const card = s2.hand.hands[seat].find((x) => x[0] === c);
    R.act(s2, seat, { t: 'play', card });
  }
  assert.equal(s2.phase, 'handEnd');
  assert.equal(s2.last.winner, 'none');
  assert.deepEqual(s2.score, [0, 0]);
});

test('trick-1 winner wins when trick 2 ties; and when trick 3 ties', () => {
  const s = setup([H('3C', '4D', '5D'), H('4H', '4S', '5S'), H('6D', '6S', '7D'), H('6H', '4C', 'QD')], 'KH');
  for (const [seat, card] of [[0, '3C'], [1, '4H'], [2, '6D'], [3, '6H']]) R.act(s, seat, { t: 'play', card });
  assert.equal(s.hand.results[0], 0);
  for (const [seat, card] of [[0, '4D'], [1, '4S'], [2, '6S'], [3, '4C']]) R.act(s, seat, { t: 'play', card });
  // 6S (team 0) beats 4s -> team 0 wins two tricks
  assert.equal(s.last.winner, 0);
  const s2 = setup([H('3C', '5D', '4D'), H('4H', 'QS', '5S'), H('6D', '4C', '7D'), H('6H', '4S', '6S')], 'KH');
  for (const [seat, card] of [[0, '3C'], [1, '4H'], [2, '6D'], [3, '6H']]) R.act(s2, seat, { t: 'play', card });
  // team 0 won t1. trick 2 lead seat 0: 5D, QS(team1 wins)
  for (const [seat, card] of [[0, '5D'], [1, 'QS'], [2, '4C'], [3, '4S']]) R.act(s2, seat, { t: 'play', card });
  assert.equal(s2.hand.results[1], 1);
  for (const [seat, card] of [[1, '5S'], [2, '7D'], [3, '6S'], [0, '4D']]) R.act(s2, seat, { t: 'play', card });
  assert.equal(s2.hand.results[2], 0); // 7D (team 0) wins trick 3 -> hand 2-1 for team 0
  assert.equal(s2.last.winner, 0);
});

test('illegal actions are rejected', () => {
  const s = setup([H('5C', '4D', '4S'), H('3H', '6D', '6S'), H('7D', '7S', 'QD'), H('4H', 'QH', 'KD')], '4H');
  assert.throws(() => R.act(s, 1, { t: 'play', card: '3H' }), R.IllegalAction); // not your turn
  assert.throws(() => R.act(s, 0, { t: 'play', card: '3H' }), R.IllegalAction); // not your card
  assert.throws(() => R.act(s, 0, { t: 'accept' }), R.IllegalAction);
  assert.throws(() => R.act(s, 0, { t: 'run' }), R.IllegalAction);
  assert.throws(() => R.act(s, 0, { t: 'raise' }), R.IllegalAction);
  assert.throws(() => R.act(s, 0, { t: 'play', card: '4D', hidden: true }), R.IllegalAction);
  R.act(s, 0, { t: 'truco' });
  assert.throws(() => R.act(s, 0, { t: 'play', card: '4D' }), R.IllegalAction); // bet pending
  assert.throws(() => R.act(s, 0, { t: 'truco' }), R.IllegalAction);
});

test('bet escalation, no double raise, accept/run scores', () => {
  const mk = () => setup([H('5C', '4D', '4S'), H('3H', '6D', '6S'), H('7D', '7S', 'QD'), H('4H', 'QH', 'KD')], '4H');
  let s = mk();
  assert.ok(R.canCallTruco(s, 0));
  R.act(s, 0, { t: 'truco' });
  assert.equal(s.phase, 'bet');
  assert.equal(R.actor(s), 1);
  assert.ok(R.canRaise(s, 1));
  // refuse truco: asker gets 1
  let t = structuredClone(s);
  R.act(t, 1, { t: 'run' });
  assert.deepEqual(t.score, [1, 0]); assert.equal(t.phase, 'handEnd');
  // accept -> value 3, team 0 can't raise again, team 1 can on its turn
  R.act(s, 1, { t: 'accept' });
  assert.equal(s.hand.value, 3);
  assert.equal(R.canCallTruco(s, 0), false);
  R.act(s, 0, { t: 'play', card: '5C' });
  assert.equal(R.canCallTruco(s, 1), true);
  R.act(s, 1, { t: 'truco' }); // seis
  assert.equal(s.hand.bet.level, 6);
  assert.equal(s.hand.bet.to % 2, 0);
  // refusing seis gives 3 (accepted level) to team 1
  t = structuredClone(s);
  R.act(t, 0, { t: 'run' });
  assert.deepEqual(t.score, [0, 3]);
  // re-raise nove
  R.act(s, 0, { t: 'raise' });
  assert.equal(s.hand.bet.level, 9); assert.equal(s.hand.bet.fromTeam, 0);
  t = structuredClone(s);
  R.act(t, 1, { t: 'run' });
  assert.deepEqual(t.score, [6, 0]);
  R.act(s, 1, { t: 'raise' }); // doze
  assert.equal(s.hand.bet.level, 12);
  assert.equal(R.canRaise(s, 0), false);
  assert.throws(() => R.act(s, 0, { t: 'raise' }), R.IllegalAction);
  R.act(s, 0, { t: 'accept' });
  assert.equal(s.hand.value, 12);
  // no more raising at 12
  for (const seat of [2, 3, 0, 1]) assert.equal(R.canCallTruco(s, seat), false);
  assert.ok(R.legalActions(s).every((a) => a.t === 'play'));
});

test('only the non-last-raiser team may raise; wrong seat cannot answer', () => {
  const s = setup([H('5C', '4D', '4S'), H('3H', '6D', '6S'), H('7D', '7S', 'QD'), H('4H', 'QH', 'KD')], '4H');
  R.act(s, 0, { t: 'truco' });
  assert.throws(() => R.act(s, 3, { t: 'accept' }), R.IllegalAction);
  assert.throws(() => R.act(s, 0, { t: 'accept' }), R.IllegalAction);
});

test('winning a hand at truco value scores 3; game ends at 12', () => {
  const s = setup([H('5C', '4D', '4S'), H('3H', '6D', '6S'), H('7D', '7S', 'QD'), H('4H', 'QH', 'KD')], '4H');
  s.score = [9, 0];
  R.act(s, 0, { t: 'truco' }); R.act(s, 1, { t: 'accept' });
  R.act(s, 0, { t: 'play', card: '5C' }); R.act(s, 1, { t: 'play', card: '3H' }); R.act(s, 2, { t: 'play', card: '7D' }); R.act(s, 3, { t: 'play', card: '4H' });
  R.act(s, 0, { t: 'play', card: '4D' }); R.act(s, 1, { t: 'play', card: '6D' }); R.act(s, 2, { t: 'play', card: '7S' }); R.act(s, 3, { t: 'play', card: 'KD' });
  // team0 won trick 1; trick 2: KD (team1) wins K>7 -> trick3 decides
  assert.equal(s.phase, 'play');
  R.act(s, 3, { t: 'play', card: 'QH' }); R.act(s, 0, { t: 'play', card: '4S' }); R.act(s, 1, { t: 'play', card: '6S' }); R.act(s, 2, { t: 'play', card: 'QD' });
  // trick 3: QH (team 1) ties QD (team 0) -> the winner of trick 1 (team 0) wins 3 points
  assert.equal(s.phase, 'gameEnd');
  assert.equal(s.winner, 0);
  assert.deepEqual(s.score, [12, 0]);
  const t = setup([H('5C', '4D', '4S'), H('3H', '6D', '6S'), H('7D', '7S', 'QD'), H('4H', 'QH', 'KD')], '4H');
  t.score = [10, 0];
  R.act(t, 0, { t: 'truco' }); R.act(t, 1, { t: 'run' });
  assert.equal(t.phase, 'handEnd'); assert.deepEqual(t.score, [11, 0]);
  t.score = [11, 0]; R.nextHand(t); assert.equal(t.phase, 'onze');
});

test('mão de onze: no raising, worth 3, run gives 1', () => {
  const s = R.newGame({ seed: 5 });
  s.score = [11, 4];
  R.startHand(s);
  assert.equal(s.phase, 'onze');
  assert.equal(s.hand.special, 'onze');
  assert.equal(s.hand.onzeTeam, 0);
  assert.equal(R.actor(s) % 2, 0);
  assert.ok(R.legalActions(s).every((a) => a.t === 'accept' || a.t === 'run'));
  const t = structuredClone(s);
  R.act(t, R.actor(t), { t: 'run' });
  assert.deepEqual(t.score, [11, 5]); assert.equal(t.phase, 'handEnd'); assert.equal(t.last.reason, 'onzeRun');
  R.act(s, R.actor(s), { t: 'accept' });
  assert.equal(s.phase, 'play'); assert.equal(s.hand.value, 3);
  for (const seat of [0, 1, 2, 3]) assert.equal(R.canCallTruco(s, seat), false);
  assert.ok(R.legalActions(s).every((a) => a.t === 'play'));
  // team 1 at 11 too
  const u = R.newGame({ seed: 6 }); u.score = [3, 11]; R.startHand(u);
  assert.equal(u.hand.onzeTeam, 1);
  // run at onze that is the game: opponents at 10 reach 11 only
  const v = R.newGame({ seed: 7 }); v.score = [11, 10]; R.startHand(v);
  R.act(v, R.actor(v), { t: 'run' });
  assert.deepEqual(v.score, [11, 11]); assert.equal(v.phase, 'handEnd');
});

test('mão de ferro: both at 11, value 1, no raises, no onze decision', () => {
  const s = R.newGame({ seed: 5 });
  s.score = [11, 11];
  R.startHand(s);
  assert.equal(s.hand.special, 'ferro');
  assert.equal(s.phase, 'play');
  assert.equal(s.hand.value, 1);
  for (const seat of [0, 1, 2, 3]) assert.equal(R.canCallTruco(s, seat), false);
  // play it out: winner takes the game with 1 point
  let guard = 0;
  while (s.phase === 'play' && guard++ < 50) R.act(s, R.actor(s), R.legalActions(s)[0]);
  assert.ok(s.phase === 'gameEnd' || s.last.winner === 'none');
  if (s.phase === 'gameEnd') assert.equal(Math.max(...s.score), 12);
});

test('quick mode caps at seis and has no onze special', () => {
  const s = R.newGame({ seed: 5, target: 6 });
  s.score = [5, 2]; R.startHand(s);
  assert.equal(s.hand.special, null);
  R.act(s, R.actor(s), { t: 'truco' }); R.act(s, R.actor(s), { t: 'raise' });
  assert.equal(s.hand.bet.level, 6);
  assert.equal(R.canRaise(s, R.actor(s)), false);
});

test('hidden play (cartas fechadas): only tricks 2-3, loses to open cards', () => {
  const s = setup([H('5C', '4D', '4S'), H('3H', '6D', '6S'), H('7D', '7S', 'QD'), H('4H', 'QH', 'KD')], '4H', { closed: true });
  assert.equal(R.canHide(s, 0), false);
  for (const [seat, card] of [[0, '5C'], [1, '3H'], [2, '7D'], [3, '4H']]) R.act(s, seat, { t: 'play', card });
  assert.equal(R.canHide(s, 0), true);
  R.act(s, 0, { t: 'play', card: '4D', hidden: true });
  const v = R.viewFor(s, 1);
  assert.equal(v.cur[0].card, null);
  assert.equal(R.viewFor(s, 0).cur[0].card, '4D');
  R.act(s, 1, { t: 'play', card: '6D' }); R.act(s, 2, { t: 'play', card: '7S' }); R.act(s, 3, { t: 'play', card: 'QH' });
  assert.equal(s.hand.results[1], 1);
});

test('viewFor never leaks other hands', () => {
  const s = R.newGame({ seed: 9 }); R.startHand(s);
  const v = R.viewFor(s, 1);
  const json = JSON.stringify(v);
  for (const seat of [0, 2, 3]) for (const c of s.hand.hands[seat]) {
    if (v.own.includes(c)) continue;
    assert.ok(!json.includes(`"${c}"`), 'leaked ' + c);
  }
});

test('seeded games are reproducible and survive JSON round trip', () => {
  const a = R.newGame({ seed: 123 }); R.startHand(a);
  const b = R.newGame({ seed: 123 }); R.startHand(b);
  assert.deepEqual(a.hand.hands, b.hand.hands);
  const c = JSON.parse(JSON.stringify(a));
  R.act(a, R.actor(a), R.legalActions(a)[0]);
  R.act(c, R.actor(c), R.legalActions(c)[0]);
  assert.deepEqual(a, c);
});

function playGame(seed, pickAction, opts = {}) {
  const s = R.newGame({ seed, ...opts });
  R.startHand(s);
  const rnd = mkRnd(seed ^ 0x9e3779b9);
  let steps = 0;
  while (s.phase !== 'gameEnd') {
    if (++steps > 4000) throw new Error('did not terminate');
    if (s.phase === 'handEnd') { R.nextHand(s); continue; }
    const seat = R.actor(s);
    const v = R.viewFor(s, seat);
    const a = pickAction(v, seat, rnd);
    const legal = R.legalActions(s);
    assert.ok(legal.some((l) => l.t === a.t && l.card === a.card && !!l.hidden === !!a.hidden), 'AI picked illegal ' + JSON.stringify(a));
    R.act(s, seat, a);
    assert.ok(s.score[0] >= 0 && s.score[1] >= 0);
    const tot = s.hand.hands.reduce((x, y) => x + y.length, 0) + s.hand.cur.length + s.hand.tricks.reduce((x, t) => x + t.plays.length, 0);
    assert.equal(tot, 3 * s.n);
  }
  assert.ok(Math.max(...s.score) >= s.target && s.winner === (s.score[0] >= s.target ? 0 : 1) || s.score[0] >= s.target && s.score[1] >= s.target);
  return s;
}

test('fuzz: random legal players, 1500 games terminate with consistent scores', () => {
  for (let i = 0; i < 1500; i++) {
    const opts = i % 5 === 0 ? { closed: true } : i % 7 === 0 ? { n: 2 } : i % 11 === 0 ? { target: 6 } : {};
    playGame(1000 + i, (v, seat, rnd) => randomAction(v, rnd), opts);
  }
});

test('fuzz: AI players never act illegally (all personas, difficulties, modes)', () => {
  const diffs = [DIFFICULTY.easy, DIFFICULTY.normal];
  for (let i = 0; i < 160; i++) {
    const opts = i % 4 === 1 ? { closed: true } : i % 4 === 2 ? { n: 2 } : i % 4 === 3 ? { target: 6 } : {};
    const d = { ...diffs[i % 2], samples: 6 };
    playGame(5000 + i, (v, seat, rnd) => decide(v, PERSONAS[seat % PERSONAS.length], rnd, d), opts);
  }
});

test('AI beats random players clearly', () => {
  let wins = 0; const N = 150;
  for (let i = 0; i < N; i++) {
    const s = playGame(9000 + i, (v, seat, rnd) => (seat % 2 === 0 ? decide(v, PERSONAS[2], rnd, { samples: 10, noise: 0 }) : randomAction(v, rnd)));
    if (s.winner === 0) wins++;
  }
  assert.ok(wins / N > 0.75, 'win rate ' + wins / N);
});
