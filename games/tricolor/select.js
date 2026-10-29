// Question selection engine (pure, seeded, JSON-serialisable state).
import { shuffled } from './rng.js';

/** selection state kept inside a session: { used:[ids], catCounts:{}, lastCat:null } */
export const newSelState = () => ({ used: [], catCounts: {}, lastCat: null });

const adjacent = (d) => {
  const out = [d];
  for (let k = 1; k <= 3; k++) {
    if (d - k >= 1) out.push(d - k);
    if (d + k <= 4) out.push(d + k);
  }
  return out;
};

/**
 * Draws one question. Order of relaxation: exact difficulty first (strict variety → relax
 * the per-category cap → relax "not twice in a row"), then adjacent difficulties; all of that
 * first excluding recently-seen questions, and only then allowing them.
 * Never returns a question already used in this session.
 */
export function drawQuestion(bank, sel, { d, cats = null, maxPerCat = 3, recent = null, rnd }) {
  const used = new Set(sel.used);
  const rec = recent instanceof Set ? recent : new Set(recent || []);
  const base = bank.filter((q) => !used.has(q.id) && (!cats || cats.includes(q.cat)));
  for (const allowRecent of [false, true]) {
    const pool = allowRecent ? base : base.filter((q) => !rec.has(q.id));
    if (!pool.length) continue;
    for (const dd of adjacent(d)) {
      const pd = pool.filter((q) => q.d === dd);
      if (!pd.length) continue;
      for (const strict of [2, 1, 0]) {
        let c = pd;
        if (strict >= 2) c = c.filter((q) => (sel.catCounts[q.cat] || 0) < maxPerCat);
        if (strict >= 1 && sel.lastCat) {
          const noRepeat = c.filter((q) => q.cat !== sel.lastCat);
          c = noRepeat.length || strict >= 2 ? noRepeat : c; // strict 1: only relax if impossible
        }
        if (!c.length) continue;
        return pickWeighted(c, sel, rnd);
      }
    }
  }
  return null;
}

// pick a category (less-used categories more likely), then a random question inside it
function pickWeighted(list, sel, rnd) {
  const byCat = new Map();
  for (const q of list) {
    if (!byCat.has(q.cat)) byCat.set(q.cat, []);
    byCat.get(q.cat).push(q);
  }
  const cats = [...byCat.keys()];
  const w = cats.map((c) => 1 / (1 + (sel.catCounts[c] || 0)));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  let k = 0;
  for (; k < cats.length - 1; k++) {
    r -= w[k];
    if (r < 0) break;
  }
  const arr = byCat.get(cats[k]);
  return arr[Math.floor(rnd() * arr.length)];
}

export function markUsed(sel, q) {
  sel.used.push(q.id);
  sel.catCounts[q.cat] = (sel.catCounts[q.cat] || 0) + 1;
  sel.lastCat = q.cat;
}

/**
 * Chooses the display order of the 4 answers. `order[i]` = original index shown at slot i.
 * The slot of the correct answer is taken from a shuffled bag of [0..3] (even spread across a session).
 */
export function presentOrder(q, bagHolder, rnd) {
  if (!bagHolder.bag || !bagHolder.bag.length) bagHolder.bag = shuffled([0, 1, 2, 3], rnd);
  const slot = bagHolder.bag.pop();
  const others = shuffled([0, 1, 2, 3].filter((i) => i !== q.c), rnd);
  const order = [];
  for (let i = 0; i < 4; i++) order.push(i === slot ? q.c : others.pop());
  return order;
}

/** UI-ready view of a question for a given order. `c` is remapped to the display position. */
export function viewOf(q, order) {
  return { id: q.id, q: q.q, a: order.map((i) => q.a[i]), c: order.indexOf(q.c), cat: q.cat, d: q.d, exp: q.exp, src: q.src, when: q.when };
}
