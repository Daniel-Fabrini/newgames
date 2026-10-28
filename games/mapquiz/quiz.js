// Quiz data and persistent progress: question pools, distractors, daily
// seeds, mastery per country, explorer XP / level, best results.

import { COUNTRIES } from '../../js/data/countries.js';
import { shuffle, rng } from '../../js/core/ui.js';
import { SHAPES, MAP_W } from './map-data.js';

export const CONTS = ['world', 'eu', 'as', 'af', 'na', 'sa', 'oc'];
export const PLAYABLE = COUNTRIES.filter((c) => SHAPES[c.code]);
export const BY_CODE = new Map(PLAYABLE.map((c) => [c.code, c]));

// kinds of knowledge tracked for mastery
//   name: find a named country on the map   capital: find the country of a capital
//   flag: flag <-> country                 map: recognise a highlighted country
export const KINDS = ['name', 'capital', 'flag', 'map'];

// Flags that look the same (French overseas regions use the French flag,
// Saint Helena's file is the Union Jack; Indonesia/Monaco and Chad/Romania are
// near-identical). Twins are never offered together and the territory copies
// are never asked by flag.
const FLAG_TWINS = [['FR', 'GF', 'GP', 'YT', 'RE', 'BL', 'MF', 'PM', 'WF'], ['GB', 'SH'], ['ID', 'MC'], ['TD', 'RO']];
const TWIN = new Map();
FLAG_TWINS.forEach((group, i) => group.forEach((code) => TWIN.set(code, i)));
const NO_FLAG_QUESTION = new Set(['GF', 'GP', 'YT', 'RE', 'BL', 'MF', 'PM', 'WF', 'SH']);
export const flagTwins = (a, b) => a !== b && TWIN.has(a) && TWIN.get(a) === TWIN.get(b);
export const canAskFlag = (code) => !NO_FLAG_QUESTION.has(code);

export function inCont(c, cont) {
  return cont === 'world' || c.cont === cont;
}

// Countries that can be asked. Territories (non-independent) only on request.
export function pool(cont, { territories = false, kind = 'name' } = {}) {
  return PLAYABLE.filter(
    (c) => inCont(c, cont) && (territories || c.independent) && (kind !== 'capital' || c.capital) && (kind !== 'flag' || canAskFlag(c.code)),
  );
}

export function contCodes(cont) {
  return PLAYABLE.filter((c) => inCont(c, cont)).map((c) => c.code);
}

export function mapDistance(a, b) {
  const pa = SHAPES[a].p;
  const pb = SHAPES[b].p;
  let dx = Math.abs(pa[0] - pb[0]) % MAP_W;
  dx = Math.min(dx, MAP_W - dx);
  return Math.hypot(dx, pa[1] - pb[1]);
}

// Three wrong options for `target`. `near` (0..1) = share of geographic
// neighbours (harder); the rest come from the same continent when possible.
export function distractors(target, candidates, rnd = Math.random, near = 0.34, n = 3) {
  const others = candidates.filter((c) => c.code !== target.code && !flagTwins(c.code, target.code));
  const out = [];
  const sorted = others
    .map((c) => ({ c, d: mapDistance(target.code, c.code) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);
  const nNear = Math.round(n * near + rnd() * 0.3);
  for (const { c } of shuffle(sorted, rnd)) {
    if (out.length >= nNear) break;
    out.push(c);
  }
  const sameCont = shuffle(
    others.filter((c) => c.cont === target.cont && !out.includes(c)),
    rnd,
  );
  const rest = shuffle(
    others.filter((c) => !out.includes(c) && !sameCont.includes(c)),
    rnd,
  );
  for (const c of [...sameCont, ...rest]) {
    if (out.length >= n) break;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- dates
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Daily challenge: same 10 questions for everybody on a given date.
export function dailyQuestions(key = dayKey()) {
  const rnd = rng(hashString('mapquiz:' + key));
  const all = PLAYABLE.filter((c) => c.independent);
  const easy = shuffle(
    all.filter((c) => c.level === 1),
    rnd,
  );
  const hard = shuffle(
    all.filter((c) => c.level !== 1),
    rnd,
  );
  const picks = [...easy.slice(0, 5), ...hard.slice(0, 5)];
  const ordered = [picks[0], picks[5], picks[1], picks[2], picks[6], picks[3], picks[7], picks[4], picks[8], picks[9]];
  const pictures = ['map', 'flag', 'map', 'capital', 'flag', 'map', 'capital', 'flag', 'map', 'flag'];
  return ordered.map((c, i) => {
    const picture = pictures[i] === 'capital' && !c.capital ? 'map' : pictures[i];
    return { code: c.code, picture, options: shuffle([c, ...distractors(c, all, rnd, 0.5)], rnd).map((o) => o.code) };
  });
}

// ---------------------------------------------------------------- explorer level
export function xpForLevel(level) {
  return 80 + (level - 1) * 40;
}

export function levelInfo(xp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  let need = xpForLevel(1);
  while (rest >= need) {
    rest -= need;
    level++;
    need = xpForLevel(level);
  }
  return { level, into: rest, need, progress: rest / need };
}

export const RANKS = [1, 3, 6, 10, 15, 22, 30, 40, 55, 75];
export function rankIndex(level) {
  let i = 0;
  RANKS.forEach((from, k) => {
    if (level >= from) i = k;
  });
  return i;
}

// ---------------------------------------------------------------- persistent progress
export class Progress {
  constructor(store) {
    this.store = store;
  }

  // mastery: 0..3 per country per kind
  get mastery() {
    return this.store.get('mastery', {});
  }

  masteryOf(kind, code) {
    const m = this.mastery[kind];
    return (m && m[code]) || 0;
  }

  // result: 'first' (right first time) | 'late' (right after mistakes) | 'miss'
  recordAnswer(kind, code, result) {
    const all = this.mastery;
    const m = all[kind] || (all[kind] = {});
    const v = m[code] || 0;
    if (result === 'first') m[code] = Math.min(3, v + 1);
    else if (result === 'miss') m[code] = Math.max(0, v - 1);
    this.store.set('mastery', all);
  }

  masteryPct(kinds, cont, territories = false) {
    const list = [].concat(kinds);
    const all = this.mastery;
    let sum = 0;
    let max = 0;
    for (const kind of list) {
      const m = all[kind] || {};
      for (const c of pool(cont, { territories, kind })) {
        sum += Math.min(3, m[c.code] || 0);
        max += 3;
      }
    }
    return max ? sum / max : 0;
  }

  // Prefer countries that are not mastered yet.
  pickQuestions(list, kind, n, rnd = Math.random) {
    const scored = shuffle(list, rnd).map((c) => ({ c, w: this.masteryOf(kind, c.code) + rnd() * 1.6 }));
    scored.sort((a, b) => a.w - b.w);
    return shuffle(
      scored.slice(0, n).map((x) => x.c),
      rnd,
    );
  }

  // best results
  best(key) {
    return this.store.get('best', {})[key] || null;
  }

  // keeps the better of the two results according to `better(a, b)`
  saveBest(key, result, better) {
    const all = this.store.get('best', {});
    const prev = all[key];
    const isNew = !prev || better(result, prev);
    if (isNew) {
      all[key] = result;
      this.store.set('best', all);
    }
    return isNew;
  }

  // explorer XP
  get xp() {
    return this.store.get('xp', 0);
  }

  addXP(n) {
    const before = levelInfo(this.xp);
    const total = this.xp + Math.max(0, Math.round(n));
    this.store.set('xp', total);
    return { before, after: levelInfo(total) };
  }

  // explore mode: discovered countries
  get seen() {
    return new Set(this.store.get('seen', []));
  }

  markSeen(code) {
    const s = this.seen;
    if (s.has(code)) return false;
    s.add(code);
    this.store.set('seen', [...s]);
    return true;
  }

  // daily challenge
  get daily() {
    return this.store.get('daily', { last: null, streak: 0, best: 0, history: {} });
  }

  dailyStreak() {
    const d = this.daily;
    if (!d.last) return 0;
    const today = dayKey();
    const yesterday = dayKey(new Date(Date.now() - 864e5));
    return d.last === today || d.last === yesterday ? d.streak : 0;
  }

  saveDaily(stars, correct) {
    const d = this.daily;
    const today = dayKey();
    if (d.history[today] !== undefined) return false;
    const yesterday = dayKey(new Date(Date.now() - 864e5));
    d.streak = d.last === yesterday ? d.streak + 1 : 1;
    d.best = Math.max(d.best || 0, d.streak);
    d.last = today;
    d.history[today] = { stars, correct };
    const keys = Object.keys(d.history).sort();
    while (keys.length > 60) delete d.history[keys.shift()];
    this.store.set('daily', d);
    return true;
  }

  dailyResult(key = dayKey()) {
    return this.daily.history[key] || null;
  }

  // simple settings
  setting(key, fallback) {
    return this.store.get('set:' + key, fallback);
  }

  setSetting(key, value) {
    this.store.set('set:' + key, value);
  }
}
