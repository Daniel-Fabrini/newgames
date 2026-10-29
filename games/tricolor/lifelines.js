// Lifelines (pure functions; `rnd` is a () => [0,1) function).
import { shuffled } from './rng.js';
import { normText } from './questions/schema.js';

const ALL = [0, 1, 2, 3];
const rint = (rnd, a, b) => Math.round(a + rnd() * (b - a));

/** 50:50 — returns the two wrong display indexes to hide (correct answer + one wrong stay) */
export function fiftyFifty(c, hidden = [], rnd = Math.random) {
  const wrong = ALL.filter((i) => i !== c && !hidden.includes(i));
  return shuffled(wrong, rnd).slice(0, Math.max(0, Math.min(2, wrong.length - 1)));
}

// distributes `total` among n buckets with random weights, no bucket above `cap`
function splitCapped(total, n, cap, rnd) {
  if (n === 0) return [];
  cap = Math.max(cap, Math.ceil(total / n));
  let w = Array.from({ length: n }, () => 0.15 + rnd());
  let res = new Array(n).fill(0);
  let left = total;
  let open = [...w.keys()];
  for (let guard = 0; guard < 8 && open.length; guard++) {
    const sum = open.reduce((s, i) => s + w[i], 0);
    let over = false;
    for (const i of open) {
      const v = (left * w[i]) / sum;
      if (v > cap) {
        res[i] = cap;
        over = true;
      }
    }
    if (!over) {
      for (const i of open) res[i] = (left * w[i]) / sum;
      break;
    }
    const capped = open.filter((i) => res[i] === cap);
    left -= cap * capped.length;
    open = open.filter((i) => !capped.includes(i));
  }
  return res;
}

function roundTo100(vals) {
  const fl = vals.map(Math.floor);
  let rem = 100 - fl.reduce((a, b) => a + b, 0);
  const order = vals.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0; k = (k + 1) % order.length, rem--) fl[order[k][1]]++;
  return fl;
}

const CROWD = {
  1: { top: [70, 90], pWrong: 0.02 },
  2: { top: [55, 78], pWrong: 0.08 },
  3: { top: [42, 64], pWrong: 0.16 },
  4: { top: [33, 58], pWrong: 0.26 },
};

/** Consulta à Torcida → 4 integers totalling exactly 100 (hidden options get 0). Reliability falls with difficulty. */
export function crowdVote(d, c, hidden = [], rnd = Math.random) {
  const cfg = CROWD[d] || CROWD[2];
  const vis = ALL.filter((i) => !hidden.includes(i));
  const out = [0, 0, 0, 0];
  if (vis.length <= 1) {
    out[c] = 100;
    return out;
  }
  const wrongVis = vis.filter((i) => i !== c);
  const leaderWrong = rnd() < cfg.pWrong;
  let leader = c;
  let top = rint(rnd, cfg.top[0], cfg.top[1]);
  if (vis.length === 2) top = Math.min(95, top + Math.round((100 - top) * 0.3));
  if (leaderWrong) {
    leader = wrongVis[Math.floor(rnd() * wrongVis.length)];
    top = rint(rnd, 38, 56);
    if (vis.length === 2) top = rint(rnd, 52, 66);
  }
  const rest = vis.filter((i) => i !== leader);
  const parts = splitCapped(100 - top, rest.length, top - 1, rnd);
  if (leaderWrong) {
    // the correct answer still gets a decent second place
    const ci = rest.indexOf(c);
    const want = Math.min(top - 1, 100 - top - (rest.length - 1) * 4);
    const give = Math.max(parts[ci], Math.max(10, want * (0.6 + 0.3 * rnd())));
    const delta = give - parts[ci];
    parts[ci] = give;
    const others = rest.map((_, k) => k).filter((k) => k !== ci);
    others.forEach((k) => (parts[k] = Math.max(1, parts[k] - delta / others.length)));
    const s = parts.reduce((a, b) => a + b, 0);
    parts.forEach((_, k) => (parts[k] = (parts[k] * (100 - top)) / s));
  }
  const vals = [top, ...parts];
  const idx = [leader, ...rest];
  const ints = roundTo100(vals);
  idx.forEach((i, k) => (out[i] = ints[k]));
  return out;
}

// ---------- phone a friend ----------
export const ROLES = ['exPlayer', 'coach', 'fan', 'journalist', 'director'];

const KIND_W = {
  1: { sure: 0.62, lean: 0.14, narrow: 0.06, exclude: 0.06, context: 0.12 },
  2: { sure: 0.42, lean: 0.18, narrow: 0.14, exclude: 0.08, context: 0.18 },
  3: { sure: 0.24, lean: 0.2, narrow: 0.22, exclude: 0.1, context: 0.24 },
  4: { sure: 0.1, lean: 0.14, narrow: 0.3, exclude: 0.18, context: 0.28 },
};

const sentences = (s) => String(s || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** a sentence of the explanation with the answer masked, or null when it cannot be masked safely */
export function maskedClue(view) {
  const correct = view.a[view.c];
  const cn = normText(correct);
  if (!cn) return null;
  const ctoks = cn.split(' ').filter((w) => w.length >= 3 || /^\d+$/.test(w));
  for (const sent of sentences(view.exp)) {
    let out = sent;
    // mask the whole answer, then each significant token (accent-insensitive via loose regex)
    const loose = (w) => escRe(w).replace(/a/g, '[aáàâãä]').replace(/e/g, '[eéèêë]').replace(/i/g, '[iíìîï]').replace(/o/g, '[oóòôõö]').replace(/u/g, '[uúùûü]').replace(/c/g, '[cç]');
    const full = correct
      .split(/\s+/)
      .map((w) => loose(normText(w)))
      .filter(Boolean)
      .join('[\\s\\-]+');
    if (full) out = out.replace(new RegExp(full, 'gi'), '…');
    for (const w of ctoks) out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${loose(w)}(?![\\p{L}\\p{N}])`, 'giu'), '$1…');
    out = out.replace(/(…[\s,]*){2,}/g, '… ');
    const left = normText(out);
    if (ctoks.some((w) => (' ' + left + ' ').includes(' ' + w + ' '))) continue; // still leaks
    const real = out.replace(/…/g, '').replace(/\s+/g, ' ').trim();
    if (real.length < 25 || !out.includes('…')) continue; // too empty, or answer not even present → no real clue
    if (out.length > 200) continue;
    return out;
  }
  return null;
}

/**
 * Hint from the friend on the phone. Always truthful: it only restates the correct answer, narrows
 * the options, rules out a wrong one, or quotes the (masked) historical explanation. Confidence
 * drops with difficulty; at d3/d4 it often does not name the answer at all.
 * @returns {{role:string, kind:'sure'|'lean'|'narrow'|'exclude'|'context', letters:number[], quote?:string}}
 */
export function phoneHint(view, d, hidden = [], rnd = Math.random) {
  const role = ROLES[Math.floor(rnd() * ROLES.length)];
  const vis = ALL.filter((i) => !hidden.includes(i));
  const wrongVis = vis.filter((i) => i !== view.c);
  const w = KIND_W[d] || KIND_W[2];
  const kinds = Object.keys(w);
  let r = rnd();
  let kind = kinds[kinds.length - 1];
  for (const k of kinds) {
    r -= w[k];
    if (r < 0) {
      kind = k;
      break;
    }
  }
  if (vis.length <= 2 && (kind === 'narrow' || kind === 'exclude')) kind = rnd() < 0.5 ? 'lean' : 'sure';
  if (kind === 'context') {
    const quote = maskedClue(view);
    if (quote) return { role, kind, letters: [], quote };
    kind = vis.length > 2 ? 'narrow' : 'lean';
  }
  if (kind === 'narrow') {
    const other = wrongVis[Math.floor(rnd() * wrongVis.length)];
    return { role, kind, letters: [view.c, other].sort((a, b) => a - b) };
  }
  if (kind === 'exclude') return { role, kind, letters: [wrongVis[Math.floor(rnd() * wrongVis.length)]] };
  return { role, kind, letters: [view.c] };
}
