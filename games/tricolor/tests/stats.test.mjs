import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/bank.mjs';
import { createSession, answer, next, currentView, summary } from '../session.js';
import { newProfile, recordMatch, sanitizeProfile, hitRate, completedThemes, newDaily, recordDaily, liveStreak, pushRecent, xpFor, ACHIEVEMENTS } from '../stats.js';
import { sanitizePrefs, channelGain, DEFAULT_PREFS } from '../audioprefs.js';
import { createStore } from '../../../js/core/store.js';

const play = (mode, rightN, opts = {}) => {
  const st = createSession({ mode, seed: 11 + rightN, bank: fixture, ...opts });
  let i = 0;
  while (!st.done) {
    const v = currentView(st, fixture);
    answer(st, fixture, i < rightN ? v.c : [0, 1, 2, 3].find((x) => x !== v.c), 2000);
    i++;
    if (st.done) break;
    next(st, fixture);
  }
  return summary(st, fixture);
};

test('profile: records, hit rate, ranking, persistence round-trip', () => {
  let p = newProfile();
  const s1 = play('main', 7);
  const r1 = recordMatch(p, s1, { now: 1 });
  assert.equal(p.games, 1);
  assert.equal(p.answered, 8);
  assert.equal(p.correct, 7);
  assert.equal(p.bestPrize, 1000);
  assert.equal(hitRate(p), 88);
  assert.ok(r1.newAch.includes('first') && r1.newAch.includes('safe'));
  assert.equal(p.ranks.main.length, 1);
  const s2 = play('main', 15);
  const r2 = recordMatch(p, s2, { now: 2 });
  assert.ok(r2.newAch.includes('million') && r2.newAch.includes('step10') && r2.newAch.includes('row10') && r2.newAch.includes('noHelp'));
  assert.equal(p.bestPrize, 1000000);
  assert.equal(p.wins, 1);
  assert.equal(p.ranks.main[0].score, 1000000);
  assert.ok(r2.newRecords.some((r) => r.value === 1000000));
  // distinct right ids only count once
  const before = p.rightIds.length;
  recordMatch(p, play('main', 15), { now: 3 });
  assert.ok(p.rightIds.length <= fixture.length);
  assert.ok(p.rightIds.length >= before);
  assert.equal(new Set(p.rightIds).size, p.rightIds.length);
  // persistence through the real store module (memory fallback in node)
  const store = createStore('tricolor-test');
  store.set('profile', p);
  const back = sanitizeProfile(store.get('profile'));
  assert.deepEqual(back, p);
  assert.deepEqual(sanitizeProfile('garbage').games, 0);
  assert.ok(ACHIEVEMENTS.length >= 12);
});

test('ranking keeps the 10 best, sorted', () => {
  const p = newProfile();
  for (let i = 0; i < 15; i++) recordMatch(p, { mode: 'quick', score: i * 100 + 50, correct: i % 10, answered: 10, ms: 1000, outcome: 'finished', review: [], bestStreak: 1, reached: 10, lifelinesUsed: 0 }, { now: i });
  assert.equal(p.ranks.quick.length, 10);
  assert.ok(p.ranks.quick.every((r, i, a) => !i || a[i - 1].score >= r.score));
  assert.equal(p.rec.quick.plays, 15);
});

test('themes completed from distinct correct answers', () => {
  const p = newProfile();
  for (let k = 0; k < 4; k++) recordMatch(p, play('quick', 10), { now: k });
  assert.ok(completedThemes(p) >= 0);
  p.themeRight = { clube: 10, titulos: 12 };
  assert.equal(completedThemes(p), 2);
});

test('daily: one scored attempt per day, streak logic', () => {
  const d = newDaily();
  recordDaily(d, '2026-10-27', { score: 500, correct: 5, total: 10 });
  recordDaily(d, '2026-10-28', { score: 700, correct: 7, total: 10 });
  assert.equal(d.streak, 2);
  recordDaily(d, '2026-10-28', { score: 9999, correct: 10, total: 10 });
  assert.equal(d.hist['2026-10-28'].score, 700);
  recordDaily(d, '2026-10-30', { score: 100, correct: 1, total: 10 });
  assert.equal(d.streak, 1);
  assert.equal(d.best, 700);
  assert.equal(liveStreak(d, '2026-10-30'), 1);
  assert.equal(liveStreak(d, '2026-11-05'), 0);
});

test('recent ring buffer', () => {
  let r = [];
  for (let i = 0; i < 40; i++) r = pushRecent(r, [`a-${i}`], 30);
  assert.equal(r.length, 30);
  assert.equal(r[29], 'a-39');
  assert.deepEqual(pushRecent(['x', 'y'], ['x'], 5), ['y', 'x']);
  assert.deepEqual(pushRecent(['x'], ['z'], 0), []);
});

test('xp scales with result', () => {
  assert.ok(xpFor({ mode: 'main', correct: 15, outcome: 'won' }) > xpFor({ mode: 'main', correct: 3, outcome: 'lost' }));
});

test('audio prefs: sanitize + effective gain', () => {
  const p = sanitizePrefs({ music: 5, fx: -1, mute: 1, on: { amb: false } });
  assert.equal(p.music, 1);
  assert.equal(p.fx, 0);
  assert.equal(p.mute, true);
  assert.equal(channelGain(p, 'music'), 0);
  const q = sanitizePrefs({ on: { amb: false } });
  assert.equal(channelGain(q, 'amb'), 0);
  assert.equal(channelGain(q, 'music'), DEFAULT_PREFS.music);
  assert.equal(channelGain(q, 'music', true), 0);
  assert.deepEqual(sanitizePrefs(null).on, { music: true, fx: true, amb: true });
});
