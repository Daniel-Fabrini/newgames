import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.js';
import { chooseHold, chooseCategory } from '../ai.js';

const sheetWith = (scores = {}, yb = 0) => {
  const s = R.createSheet();
  Object.assign(s.scores, scores);
  s.yb = yb;
  return s;
};

test('upper categories sum the matching faces', () => {
  assert.equal(R.rawScore('ones', [1, 1, 3, 4, 1]), 3);
  assert.equal(R.rawScore('sixes', [6, 6, 6, 6, 6]), 30);
  assert.equal(R.rawScore('fours', [1, 2, 3, 5, 6]), 0);
  assert.equal(R.rawScore('twos', [2, 2, 5, 5, 2]), 6);
});

test('three / four of a kind sum all dice', () => {
  assert.equal(R.rawScore('three', [3, 3, 3, 4, 5]), 18);
  assert.equal(R.rawScore('three', [3, 3, 4, 4, 5]), 0);
  assert.equal(R.rawScore('three', [3, 3, 3, 3, 3]), 15);
  assert.equal(R.rawScore('three', [2, 2, 2, 2, 6]), 14);
  assert.equal(R.rawScore('four', [2, 2, 2, 2, 6]), 14);
  assert.equal(R.rawScore('four', [2, 2, 2, 6, 6]), 0);
  assert.equal(R.rawScore('four', [6, 6, 6, 6, 6]), 30);
});

test('full house: exactly 3+2; five of a kind does not count by itself', () => {
  assert.equal(R.rawScore('full', [2, 2, 3, 3, 3]), 25);
  assert.equal(R.rawScore('full', [6, 1, 6, 1, 6]), 25);
  assert.equal(R.rawScore('full', [2, 2, 2, 2, 3]), 0);
  assert.equal(R.rawScore('full', [4, 4, 4, 4, 4]), 0);
  assert.equal(R.rawScore('full', [1, 2, 2, 3, 3]), 0);
});

test('straights', () => {
  assert.equal(R.rawScore('small', [1, 2, 3, 4, 6]), 30);
  assert.equal(R.rawScore('small', [1, 2, 3, 4, 4]), 30); // 1-2-3-4 + duplicate
  assert.equal(R.rawScore('small', [3, 4, 5, 6, 6]), 30);
  assert.equal(R.rawScore('small', [2, 3, 4, 5, 5]), 30);
  assert.equal(R.rawScore('small', [1, 2, 3, 5, 6]), 0);
  assert.equal(R.rawScore('small', [1, 2, 4, 5, 6]), 0);
  assert.equal(R.rawScore('small', [1, 1, 3, 3, 5]), 0);
  assert.equal(R.rawScore('small', [1, 2, 3, 4, 5]), 30); // small inside large
  assert.equal(R.rawScore('small', [2, 3, 4, 5, 6]), 30);
  assert.equal(R.rawScore('large', [1, 2, 3, 4, 5]), 40);
  assert.equal(R.rawScore('large', [2, 3, 4, 5, 6]), 40);
  assert.equal(R.rawScore('large', [5, 4, 3, 2, 1]), 40);
  assert.equal(R.rawScore('large', [1, 2, 3, 4, 6]), 0);
  assert.equal(R.rawScore('large', [1, 2, 3, 4, 4]), 0);
  assert.equal(R.rawScore('large', [1, 3, 4, 5, 6]), 0);
});

test('five of a kind and chance', () => {
  assert.equal(R.rawScore('yahtzee', [5, 5, 5, 5, 5]), 50);
  assert.equal(R.rawScore('yahtzee', [5, 5, 5, 5, 4]), 0);
  assert.equal(R.rawScore('chance', [1, 2, 3, 4, 6]), 16);
  assert.equal(R.rawScore('chance', [6, 6, 6, 6, 6]), 30);
});

test('upper bonus boundary 62 / 63', () => {
  // 62: ones 3, twos 6, threes 9, fours 12, fives 15, sixes 17? use 18 -> adjust
  const s62 = sheetWith({ ones: 2, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
  assert.equal(R.upperSum(s62), 62);
  assert.equal(R.upperBonus(s62), 0);
  const s63 = sheetWith({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
  assert.equal(R.upperSum(s63), 63);
  assert.equal(R.upperBonus(s63), 35);
  assert.equal(R.totalScore(s63), 98);
  const s64 = sheetWith({ ones: 4, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
  assert.equal(R.upperBonus(s64), 35);
});

test('upper bonus unlock is reported once and computed on the sheet', () => {
  const g = R.newGame({ players: [{ name: 'A' }], seed: 5 });
  const s = g.players[0].sheet;
  Object.assign(s.scores, { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15 });
  g.dice = [6, 6, 6, 1, 2];
  g.rollsLeft = 2;
  const r = R.scoreCategory(g, 'sixes');
  assert.equal(r.points, 18);
  assert.equal(r.upperBonusUnlocked, true);
});

test('joker: matching upper box forced when open', () => {
  const s = sheetWith({ yahtzee: 50 });
  const dice = [4, 4, 4, 4, 4];
  assert.deepEqual(R.allowedCats(s, dice), ['fours']);
  assert.equal(R.scoreFor(s, 'fours', dice), 20);
  assert.equal(R.scoreFor(s, 'full', dice), null);
});

test('joker: upper box filled -> any open lower box with full values', () => {
  const s = sheetWith({ yahtzee: 50, fours: 8 });
  const dice = [4, 4, 4, 4, 4];
  const al = R.allowedCats(s, dice);
  assert.ok(al.every((c) => R.LOWER.includes(c)));
  assert.equal(R.scoreFor(s, 'full', dice), 25);
  assert.equal(R.scoreFor(s, 'small', dice), 30);
  assert.equal(R.scoreFor(s, 'large', dice), 40);
  assert.equal(R.scoreFor(s, 'three', dice), 20);
  assert.equal(R.scoreFor(s, 'four', dice), 20);
  assert.equal(R.scoreFor(s, 'chance', dice), 20);
  assert.equal(R.scoreFor(s, 'ones', dice), null);
});

test('joker: lower full too -> upper boxes score 0', () => {
  const s = sheetWith({ yahtzee: 0, fours: 8, three: 1, four: 1, full: 1, small: 1, large: 1, chance: 1 });
  const dice = [4, 4, 4, 4, 4];
  const al = R.allowedCats(s, dice);
  assert.deepEqual(al, ['ones', 'twos', 'threes', 'fives', 'sixes']);
  assert.equal(R.scoreFor(s, 'sixes', dice), 0);
});

test('joker does not apply while the yahtzee box is open', () => {
  const s = sheetWith({});
  const dice = [4, 4, 4, 4, 4];
  assert.equal(R.isJoker(s, dice), false);
  assert.equal(R.scoreFor(s, 'full', dice), 0);
  assert.equal(R.allowedCats(s, dice).length, 13);
  assert.equal(R.scoreFor(s, 'yahtzee', dice), 50);
});

test('yahtzee bonus +100 only when the box holds 50', () => {
  const g = R.newGame({ players: [{ name: 'A' }], seed: 1 });
  const sh = g.players[0].sheet;
  sh.scores.yahtzee = 50;
  g.dice = [3, 3, 3, 3, 3];
  g.rollsLeft = 1;
  const r = R.scoreCategory(g, 'threes');
  assert.equal(r.bonusYahtzee, true);
  assert.equal(r.joker, true);
  assert.equal(sh.yb, 1);
  assert.equal(R.totalScore(sh), 50 + 15 + 100);
  // box with 0: joker but no bonus
  const g2 = R.newGame({ players: [{ name: 'A' }], seed: 1 });
  g2.players[0].sheet.scores.yahtzee = 0;
  g2.dice = [3, 3, 3, 3, 3];
  g2.rollsLeft = 1;
  const r2 = R.scoreCategory(g2, 'threes');
  assert.equal(r2.bonusYahtzee, false);
  assert.equal(g2.players[0].sheet.yb, 0);
});

test('first yahtzee scored in the yahtzee box gives no bonus', () => {
  const g = R.newGame({ players: [{ name: 'A' }], seed: 1 });
  g.dice = [2, 2, 2, 2, 2];
  g.rollsLeft = 0;
  const r = R.scoreCategory(g, 'yahtzee');
  assert.equal(r.points, 50);
  assert.equal(r.yahtzee, true);
  assert.equal(r.bonusYahtzee, false);
});

test('a category cannot be filled twice; must roll first', () => {
  const g = R.newGame({ players: [{ name: 'A' }], seed: 9 });
  assert.throws(() => R.scoreCategory(g, 'chance'));
  R.roll(g);
  R.scoreCategory(g, 'chance');
  R.roll(g);
  assert.throws(() => R.scoreCategory(g, 'chance'));
});

test('rolls: max 3, holds respected, holds unavailable before first roll', () => {
  const g = R.newGame({ players: [{ name: 'A' }], seed: 42 });
  assert.equal(R.toggleHold(g, 0), false);
  R.roll(g);
  assert.equal(g.rollsLeft, 2);
  assert.equal(R.toggleHold(g, 0), true);
  assert.equal(R.toggleHold(g, 2), true);
  const keep = [g.dice[0], g.dice[2]];
  const changed = R.roll(g);
  assert.deepEqual(changed, [1, 3, 4]);
  assert.equal(g.dice[0], keep[0]);
  assert.equal(g.dice[2], keep[1]);
  R.toggleHold(g, 0); // unlock
  assert.equal(g.held[0], false);
  R.roll(g);
  assert.equal(g.rollsLeft, 0);
  assert.throws(() => R.roll(g));
  assert.equal(R.toggleHold(g, 1), false);
  g.dice.forEach((d) => assert.ok(d >= 1 && d <= 6));
});

test('turn advance resets holds and rolls; players alternate; turn counter', () => {
  const g = R.newGame({ players: [{ name: 'A' }, { name: 'B' }], seed: 3 });
  R.roll(g);
  R.toggleHold(g, 1);
  R.scoreCategory(g, 'chance');
  assert.equal(g.cur, 1);
  assert.equal(g.turn, 1);
  assert.equal(g.rollsLeft, 3);
  assert.deepEqual(g.held, [false, false, false, false, false]);
  R.roll(g);
  R.scoreCategory(g, 'chance');
  assert.equal(g.cur, 0);
  assert.equal(g.turn, 2);
});

function playGame(seed, players, pick) {
  const g = R.newGame({ players, seed });
  let guard = 0;
  while (!g.over && guard++ < 1000) {
    R.roll(g);
    const sheet = R.currentSheet(g);
    R.scoreCategory(g, pick(sheet, g.dice));
  }
  return g;
}

test('game ends after 13 turns, one per category', () => {
  const g = playGame(77, [{ name: 'A' }], (s, d) => R.allowedCats(s, d)[0]);
  assert.equal(g.over, true);
  assert.equal(g.turn, 13);
  assert.ok(R.isSheetFull(g.players[0].sheet));
  assert.throws(() => R.roll(g));
  const g3 = playGame(78, [{ name: 'A' }, { name: 'B' }, { name: 'C' }], (s, d) => R.allowedCats(s, d)[0]);
  assert.equal(g3.over, true);
  assert.equal(g3.turn, 13);
  const sm = R.summary(g3);
  assert.equal(sm.filter((r) => r.rank === 1).length >= 1, true);
  assert.equal(sm.find((r) => r.winner).total, Math.max(...sm.map((r) => r.total)));
});

test('potentials: used/not allowed are null, others match scoreFor', () => {
  const s = sheetWith({ chance: 20 });
  const p = R.potentials(s, [1, 2, 3, 4, 5]);
  assert.equal(p.chance, null);
  assert.equal(p.large, 40);
  assert.equal(p.small, 30);
  assert.equal(p.ones, 1);
  assert.equal(p.full, 0);
});

test('save/restore determinism', () => {
  const g = R.newGame({ players: [{ name: 'A' }, { name: 'B', ai: true }], seed: 2024 });
  R.roll(g);
  R.toggleHold(g, 0);
  R.roll(g);
  const copy = R.restore(R.serialize(g));
  const a = [];
  const b = [];
  for (let i = 0; i < 20; i++) {
    R.roll(g);
    a.push(g.dice.join(''));
    g.rollsLeft = 3;
    g.held = g.held.map(() => false);
    R.roll(copy);
    b.push(copy.dice.join(''));
    copy.rollsLeft = 3;
    copy.held = copy.held.map(() => false);
  }
  assert.deepEqual(a, b);
  // same seed same sequence, different seed different
  const x = R.newGame({ players: [{ name: 'A' }], seed: 5 });
  const y = R.newGame({ players: [{ name: 'A' }], seed: 5 });
  R.roll(x);
  R.roll(y);
  assert.deepEqual(x.dice, y.dice);
});

test('rng is roughly uniform', () => {
  let s = 12345;
  const c = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 12000; i++) {
    const [r, n] = R.rngNext(s);
    s = n;
    c[Math.floor(r * 6)]++;
  }
  c.forEach((n) => assert.ok(n > 1800 && n < 2200, String(n)));
});

test('AI: holds the four sixes, goes for straights, scores sensibly', () => {
  const s = R.createSheet();
  const h1 = chooseHold(s, [6, 6, 6, 6, 2], 2);
  assert.deepEqual(h1.held, [true, true, true, true, false]);
  const h2 = chooseHold(s, [1, 2, 3, 4, 6], 2);
  assert.equal(h2.held[4], false);
  assert.equal(chooseHold(s, [1, 2, 3, 4, 5], 2).stop, true);
  assert.equal(chooseCategory(s, [5, 5, 5, 5, 5]), 'yahtzee');
  assert.equal(chooseCategory(s, [1, 2, 3, 4, 5]), 'large');
  // forced to waste: sacrifice ones rather than yahtzee/large
  const s2 = sheetWith({ chance: 10, three: 10, four: 10, full: 0, small: 0 });
  assert.equal(chooseCategory(s2, [2, 3, 3, 6, 6]) !== 'yahtzee', true);
  const s3 = sheetWith({ twos: 4, threes: 6, fours: 8, fives: 10, sixes: 12, three: 1, four: 1, full: 1, small: 1, large: 1, chance: 1 });
  const g = R.newGame({ players: [{ name: 'A' }], seed: 1 });
  g.players[0].sheet = s3;
  g.dice = [2, 3, 4, 6, 6];
  g.rollsLeft = 0;
  assert.equal(chooseCategory(s3, g.dice), 'ones'); // only ones & yahtzee left: sacrifice the cheaper box
});

test('AI plays complete games with a sensible average', () => {
  let total = 0;
  const N = 6;
  for (let seed = 1; seed <= N; seed++) {
    const g = R.newGame({ players: [{ name: 'AI', ai: true }], seed });
    while (!g.over) {
      let guard = 0;
      while (g.rollsLeft > 0 && guard++ < 3) {
        R.roll(g);
        if (g.rollsLeft === 0) break;
        const { held, stop } = chooseHold(R.currentSheet(g), g.dice, g.rollsLeft);
        if (stop) break;
        R.setHeld(g, held);
      }
      R.scoreCategory(g, chooseCategory(R.currentSheet(g), g.dice));
    }
    total += R.totalScore(g.players[0].sheet);
  }
  const avg = total / N;
  assert.ok(avg > 170 && avg < 380, 'avg ' + avg);
});
