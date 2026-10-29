import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.js';
import { chooseCard, hyper0 } from '../ai.js';
import { mk, rankOf, suitOf, pts, PTS, newDeck, TOTAL_POINTS } from '../deck.js';
import * as H from './helpers.mjs';

const C = 0, O = 1, E = 2, P = 3;
const r = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, Q: 5, J: 6, K: 7, '7': 8, A: 9 };
const card = (rank, suit) => mk(suit, r[rank]);

test('strength order A > 7 > K > J > Q > 6 > 5 > 4 > 3 > 2 and points', () => {
  const order = ['A', '7', 'K', 'J', 'Q', '6', '5', '4', '3', '2'];
  for (let i = 0; i < order.length - 1; i++) assert.ok(rankOf(card(order[i], C)) > rankOf(card(order[i + 1], C)), order[i]);
  assert.equal(pts(card('A', C)), 11);
  assert.equal(pts(card('7', C)), 10);
  assert.equal(pts(card('K', C)), 4);
  assert.equal(pts(card('J', C)), 3);
  assert.equal(pts(card('Q', C)), 2);
  for (const k of ['6', '5', '4', '3', '2']) assert.equal(pts(card(k, C)), 0);
  assert.equal(newDeck().reduce((a, c) => a + pts(c), 0), TOTAL_POINTS);
  assert.equal(PTS.reduce((a, b) => a + b, 0) * 4, 120);
});

test('dealing: 10 cards each, all 40 distinct, trunfo is the dealer last card', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = R.newMatch({ dealer: seed % 4 }, seed);
    assert.deepEqual(s.hands.map((h) => h.length), [10, 10, 10, 10]);
    assert.equal(new Set(s.hands.flat()).size, 40);
    assert.ok(s.hands[s.dealer].includes(s.trumpCard));
    assert.equal(s.trump, suitOf(s.trumpCard));
    assert.equal(s.leader, (s.dealer + 1) % 4);
    assert.equal(s.turn, s.leader);
    R.checkInvariants(s);
  }
});

test('the deal is reproducible from the seed and fair-ish across seeds', () => {
  const a = R.newMatch({ dealer: 0 }, 99);
  const b = R.newMatch({ dealer: 0 }, 99);
  assert.deepEqual(a, b);
  const c = R.newMatch({ dealer: 0 }, 100);
  assert.notDeepEqual(a.hands, c.hands);
  const counts = new Array(4).fill(0);
  for (let seed = 1; seed <= 2000; seed++) counts[R.newMatch({ dealer: 0 }, seed).trump]++;
  for (const n of counts) assert.ok(n > 400 && n < 600, 'trunfo suit roughly uniform ' + counts);
});

function setup(hands, trump, leader = 0) {
  const s = R.newMatch({ dealer: (leader + 3) % 4 }, 1);
  s.hands = hands.map((h) => h.slice());
  s.trump = trump;
  s.leader = leader;
  s.turn = leader;
  s.trick = [];
  return s;
}

test('must follow suit when able; any card when void (including trunfo, no duty to trump)', () => {
  const s = setup([[card('A', C), card('2', C), card('K', O)], [card('3', C), card('Q', E), card('2', P)], [], []], E, 0);
  R.playCard(s, 0, card('2', C));
  assert.deepEqual(R.legalCards(s, 1).sort(), [card('3', C)]);
  assert.throws(() => R.playCard(s, 1, card('Q', E)), R.RuleError);
  assert.throws(() => R.playCard(s, 2, card('A', C)), R.RuleError); // not their turn
  const s2 = setup([[card('A', C)], [card('Q', E), card('2', P), card('4', O)], [], []], E, 0);
  R.playCard(s2, 0, card('A', C));
  assert.equal(R.legalCards(s2, 1).length, 3); // void: everything is legal
  assert.doesNotThrow(() => R.playCard(s2, 1, card('4', O))); // may discard even holding a trunfo
});

test('trick winner: highest trunfo, else highest card of led suit', () => {
  const t = (...cs) => cs.map((c, i) => ({ p: i, c }));
  assert.equal(R.trickWinner(t(card('K', C), card('A', C), card('2', C), card('7', C)), E), 1);
  assert.equal(R.trickWinner(t(card('K', C), card('A', O), card('2', P), card('7', E)), E), 3); // only trunfo
  assert.equal(R.trickWinner(t(card('K', C), card('2', E), card('A', E), card('7', E)), E), 2); // highest trunfo
  assert.equal(R.trickWinner(t(card('K', C), card('A', O), card('2', P), card('3', O)), E), 0); // off-suit never wins
  assert.equal(R.trickWinner(t(card('2', E), card('A', C), card('7', C), card('K', C)), E), 0); // led trunfo
  assert.equal(R.trickWinner(t(card('7', C), card('A', C), card('K', C), card('J', C)), O), 1); // A beats 7
});

test('resolveTrick: winner takes cards, leads next, points tallied', () => {
  const s = setup([[card('K', C), card('2', O)], [card('A', C), card('2', P)], [card('2', C), card('3', P)], [card('7', C), card('3', O)]], E, 0);
  for (let i = 0; i < 4; i++) R.playCard(s, i, [card('K', C), card('A', C), card('2', C), card('7', C)][i]);
  assert.equal(s.turn, -1);
  assert.throws(() => R.playCard(s, 0, card('2', O)), R.RuleError);
  const res = R.resolveTrick(s);
  assert.equal(res.winner, 1);
  assert.equal(res.points, 4 + 11 + 0 + 10);
  assert.equal(s.turn, 1);
  assert.equal(s.leader, 1);
  assert.equal(s.points[1], 25);
  assert.equal(s.taken[1].length, 4);
});

test('scoring bands: 61-90 → 1, 91-119 → 2, 120 → 4, 60-60 draw', () => {
  assert.deepEqual(R.scoreRound([61, 59]), { team: 0, jogos: 1, kind: 'normal' });
  assert.deepEqual(R.scoreRound([59, 61]), { team: 1, jogos: 1, kind: 'normal' });
  assert.equal(R.scoreRound([90, 30]).jogos, 1);
  assert.equal(R.scoreRound([91, 29]).jogos, 2);
  assert.equal(R.scoreRound([29, 91]).team, 1);
  assert.equal(R.scoreRound([119, 1]).jogos, 2);
  assert.deepEqual(R.scoreRound([120, 0]), { team: 0, jogos: 4, kind: 'bandeira' });
  assert.deepEqual(R.scoreRound([0, 120]), { team: 1, jogos: 4, kind: 'bandeira' });
  assert.deepEqual(R.scoreRound([60, 60]), { team: -1, jogos: 0, kind: 'draw' });
});

test('every round totals 120 points and 40 cards (random play)', () => {
  const rnd = H.mulberry(11);
  const bot = H.randomBot(rnd);
  for (let i = 0; i < 300; i++) {
    const s = H.playRound(i + 1, [bot, bot, bot, bot], i % 4);
    assert.equal(s.points[0] + s.points[1], 120);
    assert.equal(s.taken[0].length + s.taken[1].length, 40);
    assert.equal(s.tricks.length, 10);
    assert.equal(s.phase, 'matchEnd');
  }
});

test('match: first team to 4 jogos wins; single round ends after one round', () => {
  const rnd = H.mulberry(3);
  const bot = H.randomBot(rnd);
  for (let i = 0; i < 100; i++) {
    const s = H.playMatch(i + 1, [bot, bot, bot, bot]);
    assert.equal(s.phase, 'matchEnd');
    assert.ok(Math.max(...s.jogos) >= 4);
    // before the last round nobody had 4
    const prev = s.rounds.slice(0, -1);
    const tot = [0, 0];
    for (const rd of prev) if (rd.result.team >= 0) tot[rd.result.team] += rd.result.jogos;
    assert.ok(tot[0] < 4 && tot[1] < 4);
    assert.equal(R.matchWinner(s), s.jogos[0] > s.jogos[1] ? 0 : 1);
  }
  const single = H.playMatch(5, [bot, bot, bot, bot], { single: true });
  assert.equal(single.rounds.length, 1);
});

test('dealer rotates and the next round is dealt fresh', () => {
  const s = R.newMatch({ dealer: 2, target: 40 }, 8);
  const bot = H.greedyBot;
  while (s.phase === 'play') {
    if (s.trick.length === 4) R.resolveTrick(s);
    else R.playCard(s, s.turn, bot(R.viewFor(s, s.turn)));
  }
  assert.equal(s.phase, 'roundEnd');
  R.nextRound(s);
  assert.equal(s.dealer, 3);
  assert.equal(s.leader, 0);
  assert.equal(s.hands[0].length, 10);
  assert.equal(s.round, 1);
});

test('save/resume: JSON round trip mid-match continues identically', () => {
  const bots = [chooseCard, chooseCard, chooseCard, chooseCard];
  const run = (s, steps) => {
    for (let i = 0; i < steps && s.phase !== 'matchEnd'; i++) {
      if (s.phase === 'roundEnd') R.nextRound(s);
      else if (s.trick.length === 4) R.resolveTrick(s);
      else R.playCard(s, s.turn, bots[s.turn](R.viewFor(s, s.turn)));
    }
  };
  const a = R.newMatch({}, 77);
  run(a, 53);
  const b = JSON.parse(JSON.stringify(a));
  run(a, 1000);
  run(b, 1000);
  assert.deepEqual(a, b);
});

test('illegal moves are rejected: wrong phase, missing card', () => {
  const s = R.newMatch({ dealer: 0 }, 4);
  assert.throws(() => R.playCard(s, s.turn, 999), R.RuleError);
  assert.throws(() => R.resolveTrick(s), R.RuleError);
  assert.throws(() => R.nextRound(s), R.RuleError);
});

test('AI always plays legally and games terminate (fuzz, mixed bots)', () => {
  const rnd = H.mulberry(2024);
  const mixed = [chooseCard, H.randomBot(rnd), chooseCard, H.greedyBot];
  for (let i = 0; i < 1500; i++) {
    const order = i % 3 === 0 ? [chooseCard, chooseCard, chooseCard, chooseCard] : mixed;
    const checked = order.map((b) => (v) => {
      const c = b(v);
      assert.ok(R.legalFor(v.hand, v.trick).includes(c), 'illegal AI card');
      return c;
    });
    const s = H.playMatch(i + 1, checked, { single: i % 2 === 0 });
    assert.equal(s.taken[0].length + s.taken[1].length, 40);
    assert.ok(s.rounds.every((rd) => rd.points[0] + rd.points[1] === 120));
  }
});

test('AI is deterministic given its view and independent of hidden hands', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = R.newMatch({}, seed);
    // advance a few random-ish plies
    const steps = seed % 25;
    for (let i = 0; i < steps && s.phase === 'play'; i++) {
      if (s.trick.length === 4) R.resolveTrick(s);
      else R.playCard(s, s.turn, chooseCard(R.viewFor(s, s.turn)));
    }
    if (s.phase !== 'play' || s.trick.length === 4) continue;
    const seat = s.turn;
    const v = R.viewFor(s, seat);
    // the view must not contain other hands at all
    const json = JSON.stringify(v);
    for (let o = 0; o < 4; o++) if (o !== seat) assert.ok(!('hands' in v));
    assert.ok(!json.includes('"hands"') && !json.includes('"initial"'));
    const c1 = chooseCard(v);
    // re-deal the hidden cards among the others (same sizes): decision must not change
    const hidden = [];
    for (let o = 0; o < 4; o++) if (o !== seat) hidden.push(...s.hands[o]);
    hidden.reverse();
    const s2 = JSON.parse(JSON.stringify(s));
    let k = 0;
    for (let o = 0; o < 4; o++) if (o !== seat) s2.hands[o] = hidden.slice(k, (k += s.hands[o].length));
    assert.equal(chooseCard(R.viewFor(s2, seat)), c1);
  }
});

test('AI heuristics: gives points to a partner who is winning for sure, takes cheap wins', () => {
  // partner (seat 2) leads... build: seat 0 leads, seat 1 plays low, seat 2 (partner) plays A of led suit, seat 3 (us last)
  const s = setup([[], [], [], []], E, 0);
  s.hands[3] = [card('7', O), card('2', O), card('K', P)];
  s.hands[0] = [card('A', C)]; s.hands[1] = [card('3', C)]; s.hands[2] = [card('6', C)];
  // we are seat 0's partner? seat 3 partner is seat 1. make seat 1 winning: seat1 plays A
  s.trick = [{ p: 0, c: card('2', C) }, { p: 1, c: card('A', C) }, { p: 2, c: card('3', C) }];
  s.turn = 3;
  s.hands[3] = [card('7', C), card('4', C), card('K', P)];
  const c = chooseCard(R.viewFor(s, 3));
  assert.equal(c, card('7', C)); // last to play, partner holds the master card → carga (10 points)
  // opponent winning with a 5, we can beat it with the 6: use the cheapest winner
  const s2 = setup([[], [], [], []], E, 0);
  s2.trick = [{ p: 0, c: card('5', C) }, { p: 1, c: card('2', C) }, { p: 2, c: card('3', C) }];
  s2.turn = 3;
  s2.hands[3] = [card('A', C), card('6', C), card('K', P)];
  assert.equal(chooseCard(R.viewFor(s2, 3)), card('6', C));
  assert.ok(hyper0(10, 3, 3) < 1 && hyper0(10, 0, 3) === 1);
});

test('AI beats random and greedy opponents over many rounds', () => {
  const rnd = H.mulberry(5);
  for (const [name, opp, min] of [['random', H.randomBot(rnd), 0.6], ['greedy', H.greedyBot, 0.5]]) {
    let aw = 0, bw = 0;
    for (let i = 0; i < 600; i++) {
      const sw = i % 2;
      const bots = sw ? [opp, chooseCard, opp, chooseCard] : [chooseCard, opp, chooseCard, opp];
      const s = H.playRound(500 + i, bots, i % 4);
      const a = sw ? s.points[1] : s.points[0], b = sw ? s.points[0] : s.points[1];
      if (a > b) aw++; else if (b > a) bw++;
    }
    assert.ok(aw / (aw + bw) > min, `${name}: ${aw}/${bw}`);
  }
});
