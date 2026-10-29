import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.js';
import { chooseCard, chooseAction, hyper0 } from '../ai.js';
import { mk, rankOf, suitOf, pts, newDeck, TOTAL_POINTS } from '../deck.js';
import * as H from './helpers.mjs';

const C = 0, O = 1, E = 2, P = 3;
const r = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, Q: 5, J: 6, K: 7, '7': 8, A: 9 };
const card = (rank, suit) => mk(suit, r[rank]);

test('hierarchy A > 7 > K > J > Q > 6 > 5 > 4 > 3 > 2; points total 120', () => {
  const order = ['A', '7', 'K', 'J', 'Q', '6', '5', '4', '3', '2'];
  for (let i = 0; i < 9; i++) assert.ok(rankOf(card(order[i], C)) > rankOf(card(order[i + 1], C)));
  assert.deepEqual(['A', '7', 'K', 'J', 'Q', '6'].map((k) => pts(card(k, O))), [11, 10, 4, 3, 2, 0]);
  assert.equal(newDeck().reduce((a, c) => a + pts(c), 0), TOTAL_POINTS);
});

test('deal 2p: 3 each, trunfo card face up, last in the stock (34 cards), all unique', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = R.newMatch({ players: 2, dealer: seed % 2 }, seed);
    assert.deepEqual(s.hands.map((h) => h.length), [3, 3]);
    assert.equal(s.stock.length, 34);
    assert.equal(s.stock[33], s.trumpCard);
    assert.equal(s.trump, suitOf(s.trumpCard));
    assert.equal(s.leader, (s.dealer + 1) % 2); // dealer's opponent leads
    R.checkInvariants(s);
  }
});

test('deal 4p and Bisca de 9 sizes', () => {
  const s4 = R.newMatch({ players: 4 }, 3);
  assert.deepEqual(s4.hands.map((h) => h.length), [3, 3, 3, 3]);
  assert.equal(s4.stock.length, 28);
  const s9 = R.newMatch({ players: 2, handSize: 9 }, 3);
  assert.deepEqual(s9.hands.map((h) => h.length), [9, 9]);
  assert.equal(s9.stock.length, 22);
  assert.equal(s9.stock[21], s9.trumpCard);
  R.checkInvariants(s4); R.checkInvariants(s9);
});

test('seeded deal is reproducible and the trunfo suit is uniform', () => {
  assert.deepEqual(R.newMatch({}, 5), R.newMatch({}, 5));
  const cnt = [0, 0, 0, 0];
  for (let seed = 1; seed <= 2000; seed++) cnt[R.newMatch({ dealer: 0 }, seed).trump]++;
  for (const n of cnt) assert.ok(n > 400 && n < 600, String(cnt));
});

function setup(hands, trump, stock, leader = 0, n = 2) {
  const s = R.newMatch({ players: n, dealer: (leader + n - 1) % n }, 1);
  s.hands = hands.map((h) => h.slice());
  s.trump = trump;
  s.stock = stock.slice();
  s.trumpCard = stock.length ? stock[stock.length - 1] : s.trumpCard;
  s.leader = leader; s.turn = leader; s.trick = []; s.tricks = []; s.taken = [[], []]; s.points = [0, 0];
  return s;
}

test('trick winner: highest trunfo, else highest of led suit; off-suit never wins', () => {
  const t = (...cs) => cs.map((c, i) => ({ p: i, c }));
  assert.equal(R.trickWinner(t(card('K', C), card('A', C)), E), 1);
  assert.equal(R.trickWinner(t(card('K', C), card('2', E)), E), 1);
  assert.equal(R.trickWinner(t(card('K', C), card('A', O)), E), 0);
  assert.equal(R.trickWinner(t(card('2', E), card('A', C)), E), 0);
  assert.equal(R.trickWinner(t(card('7', C), card('A', C)), E), 1);
  assert.equal(R.trickWinner(t(card('3', E), card('Q', E)), E), 1);
});

test('stock phase: no obligation to follow suit', () => {
  const s = setup([[card('A', C), card('2', O), card('3', P)], [card('K', C), card('2', P), card('5', O)]], E, [card('2', E), card('3', E)]);
  R.playCard(s, 0, card('2', O));
  assert.equal(R.legalCards(s, 1).length, 3);
  assert.doesNotThrow(() => R.playCard(s, 1, card('2', P)));
});

test('draw order: winner first, loser next, trunfo card is the very last card drawn', () => {
  const s = setup([[card('A', C), card('2', O)], [card('K', C), card('2', P)]], E, [card('5', P), card('6', O), card('7', E)]);
  R.playCard(s, 0, card('A', C)); R.playCard(s, 1, card('K', C));
  let res = R.resolveTrick(s);
  assert.equal(res.winner, 0);
  assert.deepEqual(res.draws, [{ p: 0, c: card('5', P) }, { p: 1, c: card('6', O) }]);
  assert.equal(s.stock.length, 1);
  assert.equal(s.leader, 0);
  R.playCard(s, 0, card('2', O)); R.playCard(s, 1, card('2', P)); // led O, loser off-suit → leader wins
  res = R.resolveTrick(s);
  assert.equal(res.winner, 0);
  assert.deepEqual(res.draws, [{ p: 0, c: card('7', E) }]); // last stock card (trunfo) goes to who draws last... here only one left
  assert.equal(s.stock.length, 0);
});

test('with an even stock the loser of the last stock trick receives the trunfo card', () => {
  const s = R.newMatch({ players: 2, dealer: 0 }, 21);
  let lastDraws;
  while (s.stock.length) {
    const v = R.viewFor(s, s.turn);
    R.playCard(s, s.turn, chooseCard(v));
    if (s.trick.length === 2) lastDraws = R.resolveTrick(s).draws;
  }
  assert.equal(lastDraws.length, 2);
  assert.equal(lastDraws[1].c, s.trumpCard); // second (loser) drew the trunfo
  assert.equal(s.trumpDrawnBy, lastDraws[1].p);
});

test('final phase: must follow suit when able, free when void; no duty to trump or to win', () => {
  const s = setup([[card('2', C)], [card('A', C), card('3', E), card('4', P)]], E, []);
  s.hands[0] = [card('2', C), card('5', O), card('6', O)];
  R.playCard(s, 0, card('2', C));
  assert.deepEqual(R.legalCards(s, 1), [card('A', C)]);
  assert.throws(() => R.playCard(s, 1, card('3', E)), R.RuleError);
  const s2 = setup([[card('2', C), card('5', O), card('6', O)], [card('9' in r ? '2' : '2', E), card('3', E), card('4', P)]], E, []);
  R.playCard(s2, 0, card('2', C));
  assert.equal(R.legalCards(s2, 1).length, 3); // void in copas: anything, trunfo not compulsory
  assert.doesNotThrow(() => R.playCard(s2, 1, card('4', P)));
  // may play a lower card of the led suit even when a higher one wins
  const s3 = setup([[card('5', C), card('5', O), card('6', O)], [card('A', C), card('2', C), card('4', P)]], E, []);
  R.playCard(s3, 0, card('5', C));
  assert.deepEqual(R.legalCards(s3, 1).sort(), [card('2', C), card('A', C)].sort());
});

test('scoring: >60 wins, 61-90 → 1, 91-119 → 2, 120 capote → 4, 60-60 draw', () => {
  assert.equal(R.scoreRound([61, 59]).pontos, 1);
  assert.equal(R.scoreRound([90, 30]).pontos, 1);
  assert.equal(R.scoreRound([91, 29]).pontos, 2);
  assert.equal(R.scoreRound([119, 1]).pontos, 2);
  assert.deepEqual(R.scoreRound([0, 120]), { team: 1, pontos: 4, kind: 'capote' });
  assert.deepEqual(R.scoreRound([60, 60]), { team: -1, pontos: 0, kind: 'draw' });
});

test('every round: 40 cards, 120 points, stock exhausted (random play, all variants)', () => {
  const rnd = H.mulberry(9);
  const bot = H.randomBot(rnd);
  for (const o of [{ players: 2 }, { players: 4 }, { players: 2, handSize: 9 }, { players: 4, handSize: 9 }, { players: 2, swap7: true }]) {
    for (let i = 0; i < 100; i++) {
      const s = H.playMatch(i + 1, new Array(o.players).fill(bot), { ...o, match: 'single' });
      assert.equal(s.points[0] + s.points[1], 120);
      assert.equal(s.taken[0].length + s.taken[1].length, 40);
      assert.equal(s.stock.length, 0);
    }
  }
});

test('match formats: single, best of 3 hands, first to 4 pontos', () => {
  const rnd = H.mulberry(2);
  const bot = H.randomBot(rnd);
  for (let i = 0; i < 60; i++) {
    const a = H.playMatch(i + 1, [bot, bot], { match: 'single' });
    assert.equal(a.rounds.length, 1);
    const b = H.playMatch(i + 1, [bot, bot], { match: 'bo3' });
    assert.ok(Math.max(...b.wins) === 2);
    assert.ok(b.rounds.slice(0, -1).every(() => true));
    const c = H.playMatch(i + 1, [bot, bot], { match: 'p4' });
    assert.ok(Math.max(...c.scores) >= 4);
    const before = [0, 0];
    for (const rd of c.rounds.slice(0, -1)) if (rd.result.team >= 0) before[rd.result.team] += rd.result.pontos;
    assert.ok(before[0] < 4 && before[1] < 4);
    assert.ok(R.matchWinner(c) >= 0 || c.scores[0] === c.scores[1]);
  }
});

test('trocar o sete: only when leading, holding the 7 of trunfo, stock >= 2, option on', () => {
  const stock = [card('3', P), card('A', E)];
  const mkS = (opt) => {
    const s = R.newMatch({ players: 2, swap7: opt, dealer: 1 }, 1);
    s.trump = E; s.stock = stock.slice(); s.trumpCard = card('A', E);
    s.hands = [[card('7', E), card('2', C), card('3', C)], [card('K', O), card('2', O), card('4', P)]];
    s.leader = 0; s.turn = 0; s.trick = [];
    return s;
  };
  assert.equal(R.canSwap(mkS(false), 0), false);
  const s = mkS(true);
  assert.equal(R.canSwap(s, 0), true);
  assert.equal(R.canSwap(s, 1), false);
  const res = R.swapSeven(s, 0);
  assert.equal(res.got, card('A', E));
  assert.ok(s.hands[0].includes(card('A', E)) && !s.hands[0].includes(card('7', E)));
  assert.equal(s.trumpCard, card('7', E));
  assert.equal(s.stock[s.stock.length - 1], card('7', E)); // the 7 is now the last card
  assert.equal(R.canSwap(s, 0), false); // can't swap again
  assert.throws(() => R.swapSeven(s, 0), R.RuleError);
  // not when only the trunfo is left in stock
  const s2 = mkS(true); s2.stock = [card('A', E)];
  assert.equal(R.canSwap(s2, 0), false);
  // not mid-trick
  const s3 = mkS(true); R.playCard(s3, 0, card('2', C));
  assert.equal(R.canSwap(s3, 1), false);
  R.checkInvariants(Object.assign(R.newMatch({ swap7: true }, 3)));
});

test('swap keeps card conservation through whole games (fuzz, swap on)', () => {
  let swaps = 0;
  for (let i = 0; i < 300; i++) {
    const s = H.playMatch(i + 1, [H.aiBot, H.aiBot], { swap7: true, match: 'single' });
    swaps += s.rounds.length && 0;
  }
  // force a scenario where the AI swaps for an Ace
  const s = R.newMatch({ players: 2, swap7: true, dealer: 1 }, 1);
  s.trump = E; s.trumpCard = card('A', E); s.stock = [card('3', P), card('4', P), card('A', E)];
  s.hands = [[card('7', E), card('2', C), card('3', C)], [card('K', O), card('2', O), card('4', O)]];
  s.leader = 0; s.turn = 0;
  const all = [...s.hands.flat(), ...s.stock];
  const view = R.viewFor(s, 0);
  assert.deepEqual(chooseAction(view), { type: 'swap' });
});

test('save/resume: JSON round trip mid-match continues identically', () => {
  const run = (s, steps) => {
    for (let i = 0; i < steps && s.phase !== 'matchEnd'; i++) {
      if (s.phase === 'roundEnd') R.nextRound(s);
      else if (s.trick.length === s.n) R.resolveTrick(s);
      else H.stepBot(s, new Array(s.n).fill(H.aiBot));
    }
  };
  for (const o of [{ players: 2, match: 'p4', swap7: true }, { players: 4, match: 'bo3' }]) {
    const a = R.newMatch(o, 31);
    run(a, 47);
    const b = JSON.parse(JSON.stringify(a));
    run(a, 2000); run(b, 2000);
    assert.deepEqual(a, b);
  }
});

test('views never leak hidden hands or the stock', () => {
  const s = R.newMatch({ players: 2 }, 12);
  const v = R.viewFor(s, 0);
  const json = JSON.stringify(v);
  assert.ok(!('hands' in v) && !('stock' in v) && !json.includes('"stock"'));
  assert.equal(v.stockCount, 34);
  assert.deepEqual(v.hand, s.hands[0]);
});

test('AI never peeks: decision unchanged when hidden cards are shuffled among hands and stock', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const o = { players: seed % 3 === 0 ? 4 : 2, swap7: seed % 2 === 0, handSize: seed % 10 === 0 ? 9 : 3 };
    const s = R.newMatch(o, seed);
    const steps = (seed * 7) % 70;
    for (let i = 0; i < steps && s.phase === 'play'; i++) {
      if (s.trick.length === s.n) R.resolveTrick(s);
      else H.stepBot(s, new Array(s.n).fill(H.aiBot));
    }
    if (s.phase !== 'play' || s.trick.length === s.n) continue;
    const seat = s.turn;
    const a1 = chooseAction(R.viewFor(s, seat));
    // permute all hidden cards (other hands + stock except the face-up trunfo at the bottom, + known certain ones)
    const s2 = JSON.parse(JSON.stringify(s));
    if (s.stock.length === 0) continue; // in the final phase hidden hands are fully determined by counting
    const hiddenPos = [];
    for (let p = 0; p < s.n; p++) if (p !== seat) for (let k = 0; k < s.hands[p].length; k++) hiddenPos.push(['h', p, k]);
    for (let k = 0; k < s.stock.length - 1; k++) hiddenPos.push(['s', 0, k]);
    const vals = hiddenPos.map(([t, p, k]) => (t === 'h' ? s.hands[p][k] : s.stock[k])).reverse();
    // keep swapped-in known cards where they are (they are legitimately known to belong to that player)
    const known = new Set(s.swaps.filter((w) => w.seat !== seat).map((w) => w.got));
    if (known.size) continue;
    hiddenPos.forEach(([t, p, k], i) => { if (t === 'h') s2.hands[p][k] = vals[i]; else s2.stock[k] = vals[i]; });
    const a2 = chooseAction(R.viewFor(s2, seat));
    assert.deepEqual(a2, a1, 'seed ' + seed);
  }
});

test('AI always plays legally and games terminate (fuzz all variants)', () => {
  const rnd = H.mulberry(77);
  const variants = [{ players: 2 }, { players: 2, swap7: true }, { players: 4 }, { players: 2, handSize: 9 }, { players: 4, handSize: 9, swap7: true }];
  for (let i = 0; i < 1200; i++) {
    const o = variants[i % variants.length];
    const check = (b) => (v) => {
      const act = b(v);
      if (act.type === 'play') assert.ok(R.legalFor(v.hand, v.trick, v.stockCount === 0).includes(act.c), 'illegal AI card');
      return act;
    };
    const bots = Array.from({ length: o.players }, (_, k) => check(k % 2 === 0 || i % 4 === 0 ? H.aiBot : k % 3 === 1 ? H.greedyBot : H.randomBot(rnd)));
    const s = H.playMatch(i + 1, bots, { ...o, match: i % 3 === 0 ? 'single' : i % 3 === 1 ? 'bo3' : 'p4' });
    assert.equal(s.phase, 'matchEnd');
    assert.ok(s.rounds.every((rd) => rd.points[0] + rd.points[1] === 120));
  }
});

test('AI tactics: takes a 10-point card cheaply, dumps junk on a worthless trick, exact endgame', () => {
  // opponent led the 7 of copas (10); I hold A copas and a trunfo 2: win with the Ace (no trunfo needed)
  const s = setup([[card('A', C), card('2', E), card('3', P)], [card('7', C), card('4', O), card('5', O)]], E, [card('3', O), card('4', E)], 1);
  s.turn = 1; R.playCard(s, 1, card('7', C));
  assert.equal(chooseCard(R.viewFor(s, 0)), card('A', C));
  // worthless 2 led: do not waste a trunfo (or spend a card on it)
  const s2 = setup([[card('Q', O), card('2', E), card('3', P)], [card('2', C), card('4', O), card('5', O)]], E, [card('3', O), card('4', E)], 1);
  s2.turn = 1; R.playCard(s2, 1, card('2', C));
  assert.equal(chooseCard(R.viewFor(s2, 0)), card('3', P));
  assert.ok(hyper0(10, 2, 3) < 1);
});

test('endgame solver is optimal (matches brute force on random 2-player endgames)', () => {
  // brute force minimax using the engine itself with true hidden hands
  const value = (s, me) => {
    const total = (st) => st.points[me] - st.points[1 - me];
    if (s.phase !== 'play') return total(s);
    if (s.trick.length === 2) { const c = JSON.parse(JSON.stringify(s)); R.resolveTrick(c); return value(c, me); }
    const moves = R.legalCards(s, s.turn);
    const vals = moves.map((m) => { const c = JSON.parse(JSON.stringify(s)); R.playCard(c, c.turn, m); return value(c, me); });
    return s.turn === me ? Math.max(...vals) : Math.min(...vals);
  };
  let checked = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const s = R.newMatch({ players: 2 }, seed);
    while (s.stock.length) {
      if (s.trick.length === 2) R.resolveTrick(s);
      else R.playCard(s, s.turn, R.legalCards(s, s.turn)[seed % R.legalCards(s, s.turn).length]);
    }
    if (s.trick.length === 2) R.resolveTrick(s);
    if (s.phase !== 'play') continue;
    const seat = s.turn;
    const c = chooseCard(R.viewFor(s, seat));
    const base = JSON.parse(JSON.stringify(s));
    const vOf = (m) => { const x = JSON.parse(JSON.stringify(base)); R.playCard(x, seat, m); return value(x, seat); };
    const best = Math.max(...R.legalCards(s, seat).map(vOf));
    assert.equal(vOf(c), best, `seed ${seed}`);
    checked++;
  }
  assert.ok(checked > 50);
});

test('AI beats random and greedy over many hands', () => {
  const rnd = H.mulberry(5);
  for (const [opp, min] of [[H.randomBot(rnd), 0.7], [H.greedyBot, 0.6]]) {
    let aw = 0, bw = 0;
    for (let i = 0; i < 400; i++) {
      const sw = i % 2;
      const s = H.playMatch(900 + i, sw ? [opp, H.aiBot] : [H.aiBot, opp], { dealer: i % 2, match: 'single' });
      const a = sw ? s.points[1] : s.points[0], b = sw ? s.points[0] : s.points[1];
      if (a > b) aw++; else if (b > a) bw++;
    }
    assert.ok(aw / (aw + bw) > min, `${aw}/${bw}`);
  }
});
