import test from 'node:test';
import assert from 'node:assert/strict';
import fixture, { makeFixture } from './fixtures/bank.mjs';
import { validateBank } from '../questions/schema.js';
import { LADDER, SAFE_STEPS, MODES, mainDiff, recentLimit, THEMES } from '../config.js';
import { prizeOnWrong, prizeOnStop, money } from '../prizes.js';
import { createSession, answer, next, stop, cur, currentView, useFifty, useCrowd, usePhone, useSwap, summary, serialize, restore, dailyPlan, scoreOf } from '../session.js';
import { crowdVote, fiftyFifty, offerIdols, idolHint, clueOf, HINT_VARIANTS } from '../lifelines.js';
import { IDOLS, POS } from '../idols.js';
import STRINGS from '../strings.js';
import { drawQuestion, newSelState, markUsed, presentOrder, viewOf } from '../select.js';
import { rngFrom, hashSeed, nextRand } from '../rng.js';

const bank = fixture;
const seeded = (s) => rngFrom({ rng: s >>> 0 });

test('fixture is valid (>= 60 questions)', () => {
  const r = validateBank([{ file: 'fx', list: bank }]);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors.slice(0, 3)));
  assert.ok(r.valid.length >= 60);
});

test('prize maths: all 15 steps', () => {
  assert.equal(LADDER.length, 15);
  assert.deepEqual(SAFE_STEPS, [5, 10]);
  for (let s = 1; s <= 15; s++) {
    const wrong = s > 10 ? 40000 : s > 5 ? 1000 : 0;
    assert.equal(prizeOnWrong(s), wrong, `wrong at ${s}`);
    assert.equal(prizeOnStop(s), s === 1 ? 0 : LADDER[s - 2], `stop at ${s}`);
  }
  assert.equal(money(1000000), 'R$ 1.000.000');
  assert.equal(money(1000000, 'en'), 'R$ 1,000,000');
});

test('difficulty progression 1-4,5-8,9-12,13-15', () => {
  const d = Array.from({ length: 15 }, (_, i) => mainDiff(i + 1));
  assert.deepEqual(d, [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4]);
});

function playAll(st, b, { rightUntil = 99, seed = 1 } = {}) {
  const rnd = seeded(seed);
  while (!st.done) {
    const v = currentView(st, b);
    const right = st.step + 1 <= rightUntil;
    const pick = right ? v.c : [0, 1, 2, 3].find((i) => i !== v.c);
    answer(st, b, pick, 1000);
    if (st.done) break;
    next(st, b);
    void rnd;
  }
  return st;
}

test('main mode: win pays 1.000.000; wrong at each step pays the safety amount', () => {
  const win = playAll(createSession({ mode: 'main', seed: 5, bank }), bank);
  assert.equal(win.outcome, 'won');
  assert.equal(scoreOf(win), 1000000);
  assert.equal(win.correct, 15);
  for (let s = 1; s <= 15; s++) {
    const st = playAll(createSession({ mode: 'main', seed: 100 + s, bank }), bank, { rightUntil: s - 1 });
    assert.equal(st.outcome, 'lost');
    assert.equal(scoreOf(st), prizeOnWrong(s), `step ${s}`);
    assert.equal(st.correct, s - 1);
  }
});

test('stop keeps the current prize', () => {
  const st = createSession({ mode: 'main', seed: 9, bank });
  for (let i = 0; i < 6; i++) {
    answer(st, bank, currentView(st, bank).c, 10);
    next(st, bank);
  }
  assert.equal(stop(st), LADDER[5]);
  assert.equal(st.outcome, 'stopped');
});

test('selection: no repeats, category variety, difficulty plan, answer remap', () => {
  const catMax = {};
  const pos = [0, 0, 0, 0];
  for (let seed = 1; seed <= 200; seed++) {
    const st = createSession({ mode: 'main', seed, bank });
    const ids = new Set();
    const cats = [];
    while (true) {
      const v = currentView(st, bank);
      assert.ok(!ids.has(v.id), 'repeated question in session');
      ids.add(v.id);
      cats.push(v.cat);
      assert.equal(v.a[v.c], bank.find((q) => q.id === v.id).a[bank.find((q) => q.id === v.id).c], 'remap');
      pos[v.c]++;
      assert.equal(v.d, mainDiff(st.step + 1), 'difficulty');
      answer(st, bank, v.c, 1);
      if (st.done) break;
      next(st, bank);
    }
    assert.equal(ids.size, 15);
    for (let i = 1; i < cats.length; i++) assert.notEqual(cats[i], cats[i - 1], 'same category twice in a row');
    const cnt = {};
    cats.forEach((c) => (cnt[c] = (cnt[c] || 0) + 1));
    assert.ok(Math.max(...Object.values(cnt)) <= 3);
    catMax[Object.keys(cnt).length] = 1;
  }
  const tot = pos.reduce((a, b) => a + b);
  pos.forEach((p) => assert.ok(Math.abs(p / tot - 0.25) < 0.04, 'answer positions uneven ' + pos));
});

test('selection excludes recent questions and falls back gracefully', () => {
  const recent = bank.slice(0, 120).map((q) => q.id);
  const st = createSession({ mode: 'main', seed: 3, bank, recent });
  let n = 0;
  const seen = [];
  while (!st.done) {
    seen.push(cur(st).id);
    answer(st, bank, currentView(st, bank).c, 1);
    if (st.done) break;
    next(st, bank);
    n++;
  }
  assert.ok(seen.every((id) => !recent.includes(id)), 'recent question reused although pool was large');
  // tiny pool: still plays 15 questions (adjacent difficulty / other category fallbacks), no repeats
  const small = bank.filter((q) => q.id.endsWith('1') || q.id.endsWith('2') || q.id.endsWith('3')).slice(0, 20);
  const st2 = createSession({ mode: 'main', seed: 4, bank: small, recent: small.map((q) => q.id) });
  const ids = new Set();
  while (!st2.done) {
    ids.add(cur(st2).id);
    answer(st2, small, currentView(st2, small).c, 1);
    if (st2.done) break;
    if (!next(st2, small)) break;
  }
  assert.equal(ids.size, 15);
  assert.equal(recentLimit(100), 60);
  assert.equal(recentLimit(5000), 300);
});

test('lifelines: 50:50 keeps correct + one wrong', () => {
  for (let s = 1; s < 100; s++) {
    const st = createSession({ mode: 'main', seed: s, bank });
    const v = currentView(st, bank);
    const hide = useFifty(st, bank);
    assert.equal(hide.length, 2);
    assert.ok(!hide.includes(v.c));
    assert.equal(new Set(hide).size, 2);
    assert.equal(useFifty(st, bank), null, 'only one use');
  }
});

test('lifelines: crowd sums to 100, respects hidden, reliability falls with difficulty, not always right', () => {
  const rnd = seeded(77);
  const stat = {};
  for (const d of [1, 2, 3, 4]) {
    let top = 0;
    let sumCorrect = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const c = i % 4;
      const hidden = i % 5 === 0 ? [(c + 1) % 4, (c + 2) % 4] : [];
      const v = crowdVote(d, c, hidden, rnd);
      assert.equal(v.reduce((a, b) => a + b, 0), 100);
      assert.ok(v.every((x) => Number.isInteger(x) && x >= 0));
      hidden.forEach((h) => assert.equal(v[h], 0));
      if (v[c] === Math.max(...v)) top++;
      if (!hidden.length) sumCorrect += v[c];
    }
    stat[d] = { top: top / N, avg: sumCorrect / (N * 0.8) };
  }
  assert.ok(stat[1].top > 0.95 && stat[1].avg > 65 && stat[1].avg < 92, JSON.stringify(stat));
  assert.ok(stat[4].top < 0.93 && stat[4].top > 0.55, JSON.stringify(stat));
  assert.ok(stat[1].avg > stat[2].avg && stat[2].avg > stat[3].avg && stat[3].avg > stat[4].avg, JSON.stringify(stat));
  assert.ok(stat[4].avg > 30 && stat[4].avg < 62, JSON.stringify(stat));
});

test('idols: 15 valid entries', () => {
  assert.equal(IDOLS.length, 15);
  assert.equal(new Set(IDOLS.map((i) => i.id)).size, 15);
  for (const i of IDOLS) {
    assert.ok(i.name && POS[i.pos] && /\d{4}/.test(i.years) && i.from <= i.to && i.initials.length >= 2 && /^https:\/\/pt\.wikipedia\.org\//.test(i.url), i.id);
  }
});

test('phone: 3 distinct idols offered, hint ALWAYS points to the correct letter and text, clue comes from exp', () => {
  const rnd = seeded(5);
  for (let i = 0; i < 800; i++) {
    const q = bank[i % bank.length];
    const v = viewOf(q, [0, 1, 2, 3].sort(() => rnd() - 0.5));
    const off = offerIdols(v, rnd);
    assert.equal(new Set(off).size, 3);
    off.forEach((id) => assert.ok(IDOLS.some((x) => x.id === id)));
    const h = idolHint(v, off[i % 3], rnd);
    assert.equal(h.letter, v.c);
    assert.equal(h.answer, v.a[v.c]);
    assert.ok(h.variant >= 0 && h.variant < HINT_VARIANTS);
    if (h.clue) assert.ok(v.exp.startsWith(h.clue.slice(0, 20)));
  }
  const coachQ = { ...bank[0], cat: 'tecnicos' };
  let coaches = 0;
  for (let i = 0; i < 100; i++) coaches += offerIdols(viewOf(coachQ, [0, 1, 2, 3]), rnd).some((id) => IDOLS.find((x) => x.id === id).coach) ? 1 : 0;
  assert.equal(coaches, 100);
  const eraQ = { ...bank[0], when: '1943' };
  assert.ok(offerIdols(viewOf(eraQ, [0, 1, 2, 3]), seeded(1)).includes('leonidas'));
  assert.equal(clueOf(''), null);
});

test('phone strings exist in pt/en/es with the same number of variants and placeholders', () => {
  for (const lang of ['pt', 'en', 'es'])
    for (const tone of ['calm', 'direct', 'vet'])
      for (let n = 0; n < HINT_VARIANTS; n++) {
        const s = STRINGS[lang][`hint.${tone}.${n}`];
        assert.ok(s && s.includes('{letter}') && s.includes('{ans}'), `${lang} hint.${tone}.${n}`);
      }
});

test('swap: same step & difficulty, new question, old one not reused, lifelines still work', () => {
  for (let s = 1; s <= 60; s++) {
    const st = createSession({ mode: 'main', seed: s, bank });
    for (let i = 0; i < (s % 9); i++) {
      answer(st, bank, currentView(st, bank).c, 1);
      next(st, bank);
    }
    const before = currentView(st, bank);
    const step = st.step;
    assert.ok(useSwap(st, bank));
    const after = currentView(st, bank);
    assert.notEqual(after.id, before.id);
    assert.equal(after.d, before.d);
    assert.equal(st.step, step);
    assert.equal(st.qs.length, step + 1);
    assert.equal(useSwap(st, bank), false);
    assert.ok(useFifty(st, bank));
    assert.ok(useCrowd(st, bank).reduce((a, b) => a + b) === 100);
    assert.ok(usePhone(st, bank));
    // finish and make sure the swapped-out question never shows up again
    const seen = new Set([before.id]);
    while (!st.done) {
      const v = currentView(st, bank);
      if (v.id !== after.id) assert.ok(!seen.has(v.id));
      seen.add(v.id);
      answer(st, bank, v.c, 1);
      if (st.done) break;
      next(st, bank);
    }
    assert.ok(![...st.qs.map((e) => e.id)].includes(before.id));
  }
});

test('resume: serialised state continues identically', () => {
  const a = createSession({ mode: 'main', seed: 321, bank });
  for (let i = 0; i < 4; i++) {
    answer(a, bank, currentView(a, bank).c, 5);
    next(a, bank);
  }
  useFifty(a, bank);
  const raw = JSON.parse(JSON.stringify(serialize(a)));
  const b = restore(raw, bank);
  assert.ok(b);
  assert.deepEqual(b.hidden, a.hidden);
  next2(a);
  next2(b);
  assert.deepEqual(a.qs.map((e) => e.id), b.qs.map((e) => e.id));
  function next2(st) {
    for (let i = 0; i < 3; i++) {
      answer(st, bank, currentView(st, bank).c, 5);
      next(st, bank);
    }
  }
});

test('quick / themes / time / expert / daily modes', () => {
  const q = createSession({ mode: 'quick', seed: 1, bank });
  while (!q.done) {
    answer(q, bank, currentView(q, bank).c, 1000);
    if (q.done) break;
    next(q, bank);
  }
  assert.equal(q.correct, 10);
  assert.ok(q.points >= 1000);
  const th = createSession({ mode: 'themes', seed: 2, bank, themeId: 'titulos' });
  const cats = new Set(THEMES.find((t) => t.id === 'titulos').cats);
  while (!th.done) {
    assert.ok(cats.has(currentView(th, bank).cat));
    answer(th, bank, 0, 5);
    if (th.done) break;
    next(th, bank);
  }
  assert.equal(th.qs.length, 10);
  const ex = createSession({ mode: 'expert', seed: 3, bank });
  while (!ex.done) {
    assert.ok(currentView(ex, bank).d >= 3);
    answer(ex, bank, currentView(ex, bank).c, 5);
    if (ex.done) break;
    next(ex, bank);
  }
  assert.equal(ex.outcome, 'won');
  const tm = createSession({ mode: 'time', seed: 4, bank });
  const t0 = tm.timeLeft;
  const v = currentView(tm, bank);
  const r = answer(tm, bank, [0, 1, 2, 3].find((i) => i !== v.c), 100);
  assert.equal(tm.timeLeft, t0 - 8);
  assert.ok(!r.ended);
  next(tm, bank);
  for (let i = 0; i < 5; i++) {
    answer(tm, bank, currentView(tm, bank).c, 1);
    next(tm, bank);
  }
  assert.equal(tm.timeLeft, t0 - 8 + 5, 'streak bonus after 5');
});

test('daily plan is deterministic, has 10 distinct questions and avoids yesterday', () => {
  const p1 = dailyPlan('2026-10-29', bank);
  const p2 = dailyPlan('2026-10-29', bank);
  assert.deepEqual(p1, p2);
  assert.equal(p1.length, 10);
  assert.equal(new Set(p1.map((p) => p.id)).size, 10);
  const y = dailyPlan('2026-10-28', bank);
  assert.ok(p1.every((p) => !y.some((x) => x.id === p.id)));
  const p3 = dailyPlan('2026-10-30', bank);
  assert.notDeepEqual(p1.map((p) => p.id), p3.map((p) => p.id));
  const st = createSession({ mode: 'daily', seed: 1, bank, preset: p1 });
  assert.deepEqual(st.qs.map((e) => e.id), [p1[0].id]);
  assert.equal(hashSeed('a'), hashSeed('a'));
  assert.ok(nextRand({ rng: 1 }) !== nextRand({ rng: 2 }));
});

test('summary aggregates the match', () => {
  const st = playAll(createSession({ mode: 'main', seed: 8, bank }), bank, { rightUntil: 7 });
  const s = summary(st, bank);
  assert.equal(s.correct, 7);
  assert.equal(s.answered, 8);
  assert.equal(s.prize, 1000);
  assert.equal(s.review.length, 8);
  assert.equal(s.hit, Math.round((7 / 8) * 100));
});
