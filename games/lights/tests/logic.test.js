import test from 'node:test';
import assert from 'node:assert/strict';
import { padAt, sequence, timing, roundScore, judge, createRun, MODES } from '../logic.js';

test('sequence is deterministic and prefix-stable', () => {
  const a = sequence(1234, 4, 30);
  const b = sequence(1234, 4, 30);
  assert.deepEqual(a, b);
  assert.deepEqual(sequence(1234, 4, 10), a.slice(0, 10));
  assert.notDeepEqual(sequence(1235, 4, 30), a);
});

test('pads stay in range and use every pad', () => {
  for (const pads of [4, 6]) {
    const s = sequence(99, pads, 400);
    assert.ok(s.every((p) => Number.isInteger(p) && p >= 0 && p < pads));
    assert.equal(new Set(s).size, pads);
  }
  assert.equal(padAt(5, 4, 3), padAt(5, 4, 3));
});

test('timing gets faster every few rounds and never below the floor', () => {
  for (const mode of Object.keys(MODES)) {
    const m = MODES[mode];
    let prev = Infinity;
    for (let r = 1; r < 80; r++) {
      const t = timing(mode, r);
      assert.ok(t.on <= prev);
      assert.ok(t.on >= m.minOn && t.gap >= m.minGap);
      prev = t.on;
    }
    assert.equal(timing(mode, 1).on, m.on);
    assert.ok(timing(mode, m.every + 1).on < m.on);
    assert.equal(timing(mode, m.every).on, m.on);
  }
  assert.ok(timing('fast', 1).on < timing('classic', 1).on);
});

test('scoring grows with round, streak and mode', () => {
  assert.ok(roundScore('classic', 5, 0) > roundScore('classic', 4, 0));
  assert.ok(roundScore('classic', 5, 3) > roundScore('classic', 5, 0));
  assert.ok(roundScore('expert', 5, 0) > roundScore('classic', 5, 0));
  assert.equal(roundScore('classic', 5, 99), roundScore('classic', 5, 20));
});

test('judge', () => {
  assert.equal(judge([1, 2, 3], 0, 1), 'next');
  assert.equal(judge([1, 2, 3], 2, 3), 'complete');
  assert.equal(judge([1, 2, 3], 1, 0), 'wrong');
});

test('a perfect run advances rounds and scores', () => {
  const run = createRun({ mode: 'classic', seed: 7 });
  for (let round = 1; round <= 12; round++) {
    const seq = run.seq();
    assert.equal(seq.length, round);
    let last;
    for (const p of seq) last = run.press(p);
    assert.equal(last.result, 'round');
  }
  assert.equal(run.completed, 12);
  assert.equal(run.streak, 12);
  assert.ok(run.score > 0);
});

test('strict mode ends on the first mistake', () => {
  const run = createRun({ mode: 'fast', strict: true, seed: 3 });
  const wrong = (run.seq()[0] + 1) % 4;
  assert.equal(run.press(wrong).result, 'over');
  assert.equal(run.status, 'over');
  assert.equal(run.press(0).result, 'over');
});

test('relaxed mode gives 3 lives, resets streak and replays', () => {
  const run = createRun({ mode: 'classic', seed: 11 });
  for (const p of run.seq()) run.press(p); // round 1 ok
  assert.equal(run.streak, 1);
  const w = (run.seq()[0] + 1) % 4;
  assert.equal(run.press(w).result, 'retry');
  assert.equal(run.streak, 0);
  assert.equal(run.lives, 2);
  assert.equal(run.idx, 0);
  assert.equal(run.press(w).result, 'retry');
  assert.equal(run.press(w).result, 'over');
});

test('expert uses six pads', () => {
  const run = createRun({ mode: 'expert', seed: 2 });
  assert.equal(run.pads, 6);
  assert.ok(sequence(2, run.pads, 100).some((p) => p >= 4));
});
