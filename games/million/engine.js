// Road to a Million — pure game logic: prize ladder, money formatting,
// lifelines (cards, students, audience), player level and the question pool.

import { shuffle } from '../../js/core/ui.js';
import { genQuestion, GEN_SET } from './gen.js';

// ---------- prize ladder ----------
export const PRIZES = [1e3, 2e3, 3e3, 4e3, 5e3, 1e4, 2e4, 3e4, 4e4, 5e4, 1e5, 2e5, 3e5, 4e5, 5e5, 1e6];
export const LAST = PRIZES.length - 1;
export const TIME_PER_Q = 45;
export const SKIPS = 3;

// Difficulty of question index i (0-based): 1–5 easy, 6–10 medium, 11–15 hard, 16 very hard.
export const levelD = (i) => (i < 5 ? 1 : i < 10 ? 2 : i < 15 ? 3 : 4);
// Indexes whose correct answer closes a block of the ladder (5, 10, 15).
export const isMilestone = (i) => i === 4 || i === 9 || i === 14;

// What the player gets at question i: answering right, stopping, answering wrong.
export function stakes(i) {
  const stop = i > 0 ? PRIZES[i - 1] : 0;
  return { right: PRIZES[i], stop, wrong: i === LAST ? 0 : Math.floor(stop / 2) };
}

// ---------- money ----------
const nf = {};
function num(n, locale, opts = {}) {
  const key = locale + JSON.stringify(opts);
  if (!nf[key]) {
    try {
      nf[key] = new Intl.NumberFormat(locale, { useGrouping: 'always', ...opts });
    } catch {
      nf[key] = new Intl.NumberFormat(locale, opts);
    }
  }
  return nf[key].format(n);
}

// pt: "R$ 5 mil", "R$ 2,5 mil", "R$ 1 milhão"; en/es: "$ 5,000" / "$ 5.000".
export function money(n, lang, { upper = false } = {}) {
  n = Math.max(0, Math.round(n));
  if (lang === 'pt') {
    let s;
    // Non-breaking spaces keep "R$ 5 mil" on one line.
    if (n >= 1e6) {
      const m = n / 1e6;
      s = `R$\u00a0${num(m, 'pt-BR', { maximumFractionDigits: 1 })}\u00a0${m < 2 ? 'milhão' : 'milhões'}`;
    } else if (n >= 1000) s = `R$\u00a0${num(n / 1000, 'pt-BR', { maximumFractionDigits: 1 })}\u00a0mil`;
    else s = `R$\u00a0${n}`;
    return upper ? s.toUpperCase() : s;
  }
  return '$\u00a0' + num(n, lang === 'es' ? 'es-ES' : 'en-US');
}

export const fmtInt = (n, lang) => num(Math.round(n), lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US');

// ---------- lifelines ----------
export const CARD_REMOVES = { A: 1, 2: 2, 3: 3, K: 0 };
export const dealCards = (rnd = Math.random) => shuffle(['A', '2', '3', 'K'], rnd);

// Picks `n` wrong options (among the visible ones) to remove.
export function eliminate(ok, hidden, n, rnd = Math.random) {
  const wrong = [0, 1, 2, 3].filter((i) => i !== ok && !hidden.has(i));
  return shuffle(wrong, rnd).slice(0, Math.min(n, wrong.length));
}

const visibleOpts = (hidden) => [0, 1, 2, 3].filter((i) => !hidden.has(i));

// Three students suggest an answer. Accuracy drops with difficulty.
export function studentAdvice(d, ok, hidden, rnd = Math.random) {
  const acc = [0, 0.9, 0.74, 0.55, 0.42][d] || 0.5;
  const vis = visibleOpts(hidden);
  return [0, 1, 2].map(() => {
    const right = rnd() < acc;
    const others = vis.filter((i) => i !== ok);
    const pick = right || !others.length ? ok : others[Math.floor(rnd() * others.length)];
    const r = rnd();
    const conf = pick === ok ? (r < 0.5 + 0.1 * (4 - d) ? 'sure' : r < 0.85 ? 'think' : 'guess') : r < 0.15 ? 'sure' : r < 0.55 ? 'think' : 'guess';
    return { pick, conf };
  });
}

// Audience placards: percentages per option (hidden ones get 0), skewed to the
// right answer — less reliably on hard questions.
export function audienceVotes(d, ok, hidden, rnd = Math.random) {
  const vis = visibleOpts(hidden);
  const w = [0, 0, 0, 0];
  const base = [0, [52, 34], [38, 30], [22, 30], [18, 26]][d] || [30, 30];
  for (const i of vis) w[i] = i === ok ? base[0] + rnd() * base[1] : 6 + rnd() * (d >= 3 ? 34 : 22);
  // On hard questions the crowd is sometimes fooled by one wrong option.
  if (d >= 3 && rnd() < 0.22) {
    const wrong = vis.filter((i) => i !== ok);
    if (wrong.length) w[wrong[Math.floor(rnd() * wrong.length)]] += 18 + rnd() * 14;
  }
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const pct = w.map((x) => Math.round((x / sum) * 100));
  const diff = 100 - pct.reduce((a, b) => a + b, 0);
  const top = pct.indexOf(Math.max(...pct));
  pct[top] += diff;
  return pct;
}

// ---------- player level ----------
export function levelFromXp(xp) {
  let level = 1;
  let need = 120;
  let left = Math.max(0, xp);
  while (left >= need) {
    left -= need;
    level++;
    need = Math.round(need * 1.1 + 20);
  }
  return { level, into: left, need, progress: left / need };
}

// ---------- question pool ----------
const SEEN_MAX = 3000;

// The pool picks questions by difficulty, avoiding ids seen in recent games and
// mixing in procedurally generated country questions so it never runs dry.
export function createPool(bank, store) {
  let seen = store.get('seen', []);
  if (!Array.isArray(seen)) seen = [];
  const seenAt = new Map(seen.map((id, i) => [id, i]));
  let dirty = false;

  function markSeen(id) {
    if (seenAt.has(id)) {
      const idx = seen.indexOf(id);
      if (idx >= 0) seen.splice(idx, 1);
    }
    seen.push(id);
    if (seen.length > SEEN_MAX) seen = seen.slice(seen.length - SEEN_MAX);
    seenAt.clear();
    seen.forEach((x, i) => seenAt.set(x, i));
    dirty = true;
  }

  function flush() {
    if (!dirty) return;
    dirty = false;
    store.set('seen', seen);
  }

  function prepare(raw, rnd) {
    const order = shuffle([0, 1, 2, 3], rnd);
    return {
      id: raw.id,
      set: raw.set,
      d: raw.d,
      q: raw.q,
      img: raw.img || null,
      a: order.map((i) => raw.a[i]),
      ok: order.indexOf(raw.ok),
    };
  }

  function fromGen(d, exclude, rnd, preferUnseen = true) {
    for (let k = 0; k < 24; k++) {
      const g = genQuestion(d, rnd);
      if (!g || exclude.has(g.id)) continue;
      if (preferUnseen && seenAt.has(g.id) && k < 18) continue;
      return g;
    }
    return null;
  }

  // opts: { exclude: Set, sets: [..] | null, genChance, lastSet }
  function pick(d, { exclude = new Set(), sets = null, genChance = 0.14, lastSet = null, rnd = Math.random } = {}) {
    const onlyGen = sets && sets.length === 1 && sets[0] === GEN_SET;
    const allowGen = !sets || sets.includes(GEN_SET);
    if (onlyGen) {
      const g = fromGen(d, exclude, rnd);
      return g && prepare(g, rnd);
    }
    const inSets = (q) => !sets || sets.includes(q.set);
    let cands = bank.filter((q) => q.d === d && inSets(q) && !exclude.has(q.id));
    // Thin set at this difficulty: borrow from neighbouring levels.
    if (!cands.length) {
      for (const dd of [d - 1, d + 1, d - 2, d + 2, d - 3, d + 3]) {
        cands = bank.filter((q) => q.d === dd && inSets(q) && !exclude.has(q.id));
        if (cands.length) break;
      }
    }
    const unseen = cands.filter((q) => !seenAt.has(q.id));
    if (allowGen && (!unseen.length || rnd() < genChance)) {
      const g = fromGen(d, exclude, rnd, true);
      if (g && (!seenAt.has(g.id) || !unseen.length)) return prepare(g, rnd);
    }
    let list = unseen;
    if (!list.length) {
      // Everything was seen: take the questions seen longest ago.
      list = cands.slice().sort((a, b) => (seenAt.get(a.id) ?? -1) - (seenAt.get(b.id) ?? -1));
      list = list.slice(0, Math.max(1, Math.ceil(list.length * 0.3)));
    }
    if (!list.length) {
      const g = fromGen(d, exclude, rnd, false);
      return g ? prepare(g, rnd) : null;
    }
    const varied = lastSet ? list.filter((q) => q.set !== lastSet) : list;
    const from = varied.length ? varied : list;
    return prepare(from[Math.floor(rnd() * from.length)], rnd);
  }

  const count = (set) => (set === GEN_SET ? Infinity : bank.filter((q) => q.set === set).length);

  return { pick, markSeen, flush, count, size: bank.length };
}
