// Everything the game remembers: stars and records per set/mode, per-flag
// mastery (spaced repetition), player XP/level, daily challenge, survival
// records, saved runs and flashcard marks. Backed by ctx.store.

import { todayKey, dayDiff } from './data.js';

// Hours until a flag is due again after reaching each mastery box (1..5).
const INTERVAL_H = [0, 4, 24, 72, 168, 504];
export const MASTERED_BOX = 4;
export const MAX_BOX = 5;

const KINDS = { flags: 'f', caps: 'c' };
const nowMin = () => Math.floor(Date.now() / 60000);

// XP needed to go from level L to L+1. Grows forever.
export const xpForLevel = (L) => 30 + 15 * (L - 1);

export function levelInfo(xp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, into: rest, need: xpForLevel(level) };
}

const RANKS = [1, 5, 10, 15, 20, 30, 40, 50, 75];
export function rankIndex(level) {
  let i = 0;
  while (i < RANKS.length - 1 && level >= RANKS[i + 1]) i++;
  return i;
}

export function createProgress(store) {
  const rec = store.get('rec', {}) || {};
  const mast = Object.assign({ f: {}, c: {} }, store.get('mast', {}) || {});
  let xp = +store.get('xp', 0) || 0;
  const daily = Object.assign({ last: null, streak: 0, best: 0, res: {} }, store.get('daily', {}) || {});
  const surv = Object.assign({ flags: 0, caps: 0 }, store.get('surv', {}) || {});
  const fc = new Set(store.get('fc', []) || []);
  const totals = Object.assign({ answers: 0, correct: 0, games: 0 }, store.get('totals', {}) || {});

  let mastTimer = null;
  const saveMast = () => {
    clearTimeout(mastTimer);
    mastTimer = setTimeout(() => store.set('mast', mast), 250);
  };

  const P = {
    // ----- stars & records -----
    rec(setId, mode) {
      return (rec[setId] && rec[setId][mode]) || null;
    },
    saveRec(setId, mode, { stars = 0, best = 0 }) {
      const r = (rec[setId] ||= {});
      const old = r[mode] || { s: 0, b: 0, n: 0 };
      const out = { newBest: best > old.b && old.n > 0, newStars: stars > old.s, oldStars: old.s, oldBest: old.b };
      r[mode] = { s: Math.max(old.s, stars), b: Math.max(old.b, best), n: old.n + 1 };
      store.set('rec', rec);
      return out;
    },
    setStars(setId) {
      return Object.values(rec[setId] || {}).reduce((s, r) => s + (r.s || 0), 0);
    },
    totalStars() {
      let s = 0;
      for (const id of Object.keys(rec)) s += P.setStars(id);
      return s;
    },

    // ----- mastery (spaced repetition, Leitner boxes 0..5) -----
    entry(kind, code) {
      return mast[KINDS[kind]][code] || null;
    },
    box(kind, code) {
      const e = mast[KINDS[kind]][code];
      return e ? e[0] : 0;
    },
    // Records an answer. Returns { box, up, down }.
    answer(kind, code, ok) {
      const m = mast[KINDS[kind]];
      const now = nowMin();
      const e = m[code] || [0, 0, 0, 0]; // box, due (minutes), right, wrong
      const before = e[0];
      if (ok) {
        e[2]++;
        if (e[1] <= now) {
          e[0] = Math.min(MAX_BOX, e[0] + 1);
          e[1] = now + INTERVAL_H[e[0]] * 60;
        }
      } else {
        e[3]++;
        e[0] = Math.max(0, e[0] - 2);
        e[1] = now;
      }
      m[code] = e;
      saveMast();
      totals.answers++;
      if (ok) totals.correct++;
      return { box: e[0], up: e[0] > before, down: e[0] < before };
    },
    // Flashcard "repeat later": the flag becomes due for review now.
    markWeak(kind, code) {
      const m = mast[KINDS[kind]];
      const e = m[code] || [0, 0, 0, 0];
      e[1] = nowMin();
      m[code] = e;
      saveMast();
    },
    setStats(set) {
      let learned = 0;
      let mastered = 0;
      for (const c of set.items) {
        const b = P.box(set.kind, c.code);
        if (b >= 1) learned++;
        if (b >= MASTERED_BOX) mastered++;
      }
      const n = set.items.length || 1;
      return { learned, mastered, total: set.items.length, pct: learned / n, mpct: mastered / n };
    },
    // Weak or due flags, most urgent first: [{ kind, code, box }]
    dueList() {
      const now = nowMin();
      const out = [];
      for (const kind of Object.keys(KINDS)) {
        for (const [code, e] of Object.entries(mast[KINDS[kind]])) {
          if (e[1] <= now) out.push({ kind, code, box: e[0], due: e[1], wrong: e[3] });
        }
      }
      out.sort((a, b) => a.box - b.box || b.wrong - a.wrong || a.due - b.due);
      return out;
    },
    // Minutes until the next flag becomes due (null when nothing is scheduled).
    nextDueIn() {
      const now = nowMin();
      let min = Infinity;
      for (const k of Object.values(KINDS)) for (const e of Object.values(mast[k])) if (e[1] > now) min = Math.min(min, e[1] - now);
      return min === Infinity ? null : min;
    },
    counts(kind) {
      let learned = 0;
      let mastered = 0;
      for (const e of Object.values(mast[KINDS[kind]])) {
        if (e[0] >= 1) learned++;
        if (e[0] >= MASTERED_BOX) mastered++;
      }
      return { learned, mastered };
    },

    // ----- XP / level -----
    get xp() {
      return xp;
    },
    addXp(n) {
      const before = xp;
      xp += Math.max(0, Math.round(n));
      store.set('xp', xp);
      return { before, after: xp };
    },

    // ----- totals -----
    countGame() {
      totals.games++;
      store.set('totals', totals);
    },
    get totals() {
      return totals;
    },

    // ----- daily challenge -----
    dailyToday() {
      return daily.res[todayKey()] || null;
    },
    dailyStreak() {
      if (!daily.last) return 0;
      const gap = dayDiff(daily.last, todayKey());
      return gap <= 1 ? daily.streak : 0;
    },
    saveDaily(result) {
      const key = todayKey();
      if (daily.res[key]) return { first: false, streak: P.dailyStreak() };
      const gap = daily.last ? dayDiff(daily.last, key) : 99;
      daily.streak = gap === 1 ? daily.streak + 1 : 1;
      daily.last = key;
      daily.best = Math.max(daily.best, result.score);
      daily.res[key] = result;
      const keys = Object.keys(daily.res).sort();
      while (keys.length > 60) delete daily.res[keys.shift()];
      store.set('daily', daily);
      return { first: true, streak: daily.streak };
    },
    get dailyBest() {
      return daily.best;
    },

    // ----- survival -----
    survivalBest(kind) {
      return surv[kind] || 0;
    },
    saveSurvival(kind, score) {
      const old = surv[kind] || 0;
      if (score > old) {
        surv[kind] = score;
        store.set('surv', surv);
      }
      return { newBest: score > old && score > 0, old };
    },

    // ----- saved runs (classic modes) -----
    run(setId, mode) {
      return store.get(`run:${setId}:${mode}`, null);
    },
    saveRun(setId, mode, run) {
      store.set(`run:${setId}:${mode}`, run);
    },
    clearRun(setId, mode) {
      store.remove(`run:${setId}:${mode}`);
    },

    // ----- flashcards -----
    fcKnows(code) {
      return fc.has(code);
    },
    fcMark(code, known) {
      if (known) fc.add(code);
      else fc.delete(code);
      store.set('fc', [...fc]);
    },

    flush() {
      clearTimeout(mastTimer);
      store.set('mast', mast);
    },
  };
  return P;
}
