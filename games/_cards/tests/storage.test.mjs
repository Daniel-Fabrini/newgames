import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchSave, createStats } from '../storage.js';
const mem = () => { const m = new Map(); return { get: (k, f = null) => (m.has(k) ? m.get(k) : f), set: (k, v) => m.set(k, JSON.parse(JSON.stringify(v))), remove: (k) => m.delete(k) }; };

test('match save roundtrip, version & validation', () => {
  const st = mem();
  const s = createMatchSave(st, 'm', { version: 2, validate: (x) => x.ok });
  assert.equal(s.load(), null);
  s.save({ ok: true, n: 1 });
  assert.deepEqual(s.load(), { ok: true, n: 1 });
  assert.equal(createMatchSave(st, 'm', { version: 3 }).load(), null);
  s.save({ ok: false });
  assert.equal(s.load(), null); assert.equal(s.exists(), false);
  s.save({ ok: true }); s.clear(); assert.equal(s.load(), null);
});
test('stats', () => {
  const s = createStats(mem(), 'st', { historyMax: 3 });
  s.record({ result: 'win', score: 10 }); s.record({ result: 'win', score: 30 });
  let r = s.record({ result: 'loss', score: 5 });
  assert.equal(r.games, 3); assert.equal(r.wins, 2); assert.equal(r.best, 30); assert.equal(r.streak, -1); assert.equal(r.bestStreak, 2);
  s.record({ result: 'draw' }); r = s.record({ result: 'win' });
  assert.equal(r.history.length, 3); assert.equal(r.draws, 1); assert.ok(r.history[0].t > 0);
});
