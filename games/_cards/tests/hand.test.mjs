import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../hand.js';

test('27 cards fit 360px without clipping in 1 row', () => {
  const L = computeLayout({ n: 27, W: 360, cw: 56, pad: 8 });
  const last = L.positions[26];
  assert.ok(last.x + 56 <= 360 - 8 + 0.5, String(last.x));
  assert.ok(L.positions[0].x >= 8 - 0.5);
});
test('step capped for few cards and hand centred', () => {
  const L = computeLayout({ n: 3, W: 400, cw: 72 });
  assert.ok(L.step <= 72 * 0.72 + 1e-6);
  const left = L.positions[0].x, right = 400 - (L.positions[2].x + 72);
  assert.ok(Math.abs(left - right) < 0.5);
});
test('2 rows when step too small', () => {
  const L = computeLayout({ n: 27, W: 360, cw: 56, maxRows: 2 });
  assert.equal(L.rows, 2);
  assert.ok(L.height > 56 * 1.4);
  for (const p of L.positions) assert.ok(p.x >= 0 && p.x + 56 <= 360 + 0.5);
});
test('single card and empty', () => {
  assert.equal(computeLayout({ n: 0, W: 300, cw: 60 }).positions.length, 0);
  assert.equal(computeLayout({ n: 1, W: 300, cw: 60 }).positions[0].rot, 0);
});
