import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, shuffle, randomSeed, seedFrom } from '../rng.js';

test('same seed → same sequence', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});
test('state save/restore resumes identically', () => {
  const a = createRng(7);
  for (let i = 0; i < 10; i++) a.next();
  const saved = JSON.parse(JSON.stringify(a.state));
  const expect = [a.next(), a.next(), a.int(1000)];
  const b = createRng(999);
  b.state = saved;
  assert.deepEqual([b.next(), b.next(), b.int(1000)], expect);
  const c = createRng(1).restore(saved);
  assert.equal(c.next(), expect[0]);
});
test('int range and distribution', () => {
  const r = createRng(1);
  const cnt = new Array(6).fill(0);
  for (let i = 0; i < 60000; i++) { const v = r.int(6); assert.ok(v >= 0 && v < 6); cnt[v]++; }
  for (const c of cnt) assert.ok(Math.abs(c - 10000) < 500, String(cnt));
});
test('shuffle is a permutation, deterministic, does not mutate', () => {
  const src = Array.from({ length: 52 }, (_, i) => i);
  const a = shuffle(src, createRng(5)), b = shuffle(src, createRng(5));
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort((x, y) => x - y), src);
  assert.notDeepEqual(a, src);
  assert.equal(src[0], 0);
});
test('shuffle uniformity (3 elements, all 6 permutations)', () => {
  const r = createRng(11); const m = new Map();
  for (let i = 0; i < 30000; i++) { const k = shuffle([0, 1, 2], r).join(); m.set(k, (m.get(k) || 0) + 1); }
  assert.equal(m.size, 6);
  for (const v of m.values()) assert.ok(Math.abs(v - 5000) < 400);
});
test('randomSeed / seedFrom', () => {
  const s = randomSeed();
  assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32);
  assert.equal(seedFrom('abc'), seedFrom('abc'));
  assert.notEqual(seedFrom('abc'), seedFrom('abd'));
  assert.equal(createRng('x').seed, seedFrom('x'));
});
