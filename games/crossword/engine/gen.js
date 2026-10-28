// Arrowword grid generator, shared by the build script (Node) and the runtime
// (browser worker) so the puzzle list never ends.
//
// A grid is W×H cells; each cell is a black/clue cell ('#') or a letter. Every
// run of 2+ letters is a word and gets its clue in a neighbouring black cell,
// exactly like Brazilian "cruzadas diretas":
//   across word starting at (r,c), c>0  → clue in (r,c-1), "right" slot  (→)
//   across word starting at (r,0)       → clue in (r-1,0), "below" slot  (↳)
//   down word starting at (r,c), r>0    → clue in (r-1,c), "below" slot  (↓)
//   down word starting at (0,c)         → clue in (0,c-1), "right" slot  (↱)
// Every black cell holds one or two clues (at most one per slot), every letter
// belongs to at least one word, and no word repeats in a grid. The game shows
// the same grid as a classic numbered crossword (black blocks + clue lists) by
// default, or with the clues written inside the black cells ("diretas" view).
//
// Generation has two phases:
//  1. makeTemplate: decides black/white cells (structure only, very fast),
//     following the rules above plus some taste (few adjacent blacks, few
//     2-letter words, most letters crossed).
//  2. fillTemplate: fills the word slots from the dictionary — a small CSP
//     solver (most-constrained slot first, forward checking with bitsets).

import { ALPHABETS } from './dict.js';

// ---------- deterministic randomness ----------
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function popcount32(x) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

// ---------- word index ----------
// words: [{ w, tier, clues, display }]; per length: bitsets of the words that
// have letter `a` at position `p`.
export function buildIndex(entries, lang, { maxTier = 3, maxLen = 10, minLen = 2 } = {}) {
  const alpha = ALPHABETS[lang] || ALPHABETS.en;
  const A1 = alpha.length + 1;
  const code = {};
  [...alpha].forEach((ch, i) => (code[ch] = i + 1));
  const words = [];
  for (const e of entries) {
    if (e.w.length < minLen || e.w.length > maxLen) continue;
    if ([...e.w].some((ch) => !code[ch])) continue;
    const clues = e.clues.filter((c) => c.tier <= maxTier);
    if (!clues.length) continue;
    words.push({ w: e.w, tier: Math.min(...clues.map((c) => c.tier)), clues, display: e.display });
  }
  const byLen = new Map();
  words.forEach((wd, wi) => {
    const L = wd.w.length;
    if (!byLen.has(L)) byLen.set(L, []);
    byLen.get(L).push(wi);
  });
  const lens = new Map();
  for (const [L, ids] of byLen) {
    const nW = (ids.length + 31) >>> 5;
    const bits = new Array(L * A1);
    for (let i = 0; i < L * A1; i++) bits[i] = new Uint32Array(nW);
    const all = new Uint32Array(nW);
    ids.forEach((wi, j) => {
      all[j >>> 5] |= 1 << (j & 31);
      const w = words[wi].w;
      for (let p = 0; p < L; p++) bits[p * A1 + code[w[p]]][j >>> 5] |= 1 << (j & 31);
    });
    lens.set(L, { ids: Int32Array.from(ids), nW, bits, all });
  }
  // longest slot length the dictionary can comfortably fill
  let goodMax = 2;
  while ((byLen.get(goodMax + 1) || []).length >= 30) goodMax++;
  return { lang, alpha, A1, code, words, lens, goodMax };
}

// ---------- phase 1: template ----------
const ABORT = { abort: true };

// Static check: can a black cell at (r,c) ever hold a clue?
function blackPossible(r, c, W, H) {
  const right = c + 2 <= W - 1 || (r === 0 && c + 1 <= W - 1 && H >= 2);
  const below = r + 2 <= H - 1 || (c === 0 && r + 1 <= H - 1 && W >= 2);
  return right || below;
}

// Returns Int8Array (1 = letter, -1 = black) or null.
export function makeTemplate(W, H, rnd, opts = {}) {
  const maxSlot = Math.min(opts.maxSlot || 8, Math.max(W, H));
  const blackTarget = opts.blackTarget ?? 0.3;
  const maxNodes = opts.maxNodes || 3000;
  const N = W * H;
  const g = new Int8Array(N);
  const hl = new Uint8Array(N);
  const vl = new Uint8Array(N);
  const clR = new Uint8Array(N);
  const clB = new Uint8Array(N);
  const claimA = new Int32Array(N).fill(-1);
  const claimB = new Int32Array(N).fill(-1);
  let blacks = 0;
  let nodes = 0;
  const isW = (i) => g[i] === 1;
  const isB = (i) => g[i] === -1;

  // Is the clue slot for a run starting at (r,c) available?
  const acrossFree = (r, c, k) => (c > 0 ? isB(k - 1) && !clR[k - 1] : r > 0 && isB(k - W) && !clB[k - W]);
  const downFree = (r, c, k) => (r > 0 ? isB(k - W) && !clB[k - W] : c > 0 && isB(k - 1) && !clR[k - 1]);

  function undoClaims(k) {
    for (const v of [claimA[k], claimB[k]]) if (v >= 0) (v & 1 ? clB : clR)[v >> 1] = 0;
    claimA[k] = claimB[k] = -1;
  }
  function release(k) {
    undoClaims(k);
    if (g[k] === -1) blacks--;
    g[k] = 0;
  }
  function fail(k) {
    undoClaims(k);
    g[k] = 0;
    return false;
  }
  function claim(isRight, b, k, which) {
    (isRight ? clR : clB)[b] = 1;
    const v = b * 2 + (isRight ? 0 : 1);
    if (which === 0) claimA[k] = v;
    else claimB[k] = v;
  }

  function dead(b) {
    if (clR[b] || clB[b]) return false;
    const rb = (b / W) | 0;
    const cb = b - rb * W;
    if (cb + 2 < W && !isB(b + 1) && !isB(b + 2)) return false;
    if (rb === 0 && cb + 1 < W && H > 1 && !isB(b + 1) && !isB(b + 1 + W)) return false;
    if (rb + 2 < H && !isB(b + W) && !isB(b + 2 * W)) return false;
    if (cb === 0 && rb + 1 < H && W > 1 && !isB(b + W) && !isB(b + W + 1)) return false;
    return true;
  }

  function placeWhite(k, r, c) {
    const lh = c > 0 && isW(k - 1) ? hl[k - 1] + 1 : 1;
    const lv = r > 0 && isW(k - W) ? vl[k - W] + 1 : 1;
    if (lh > maxSlot || lv > maxSlot) return false;
    const hCan = lh >= 2 || (c + 1 < W && acrossFree(r, c, k));
    const vCan = lv >= 2 || (r + 1 < H && downFree(r, c, k));
    if (!hCan && !vCan) return false;
    if (c === W - 1 && lh === 1 && !vCan) return false;
    if (r === H - 1 && lv === 1 && !hCan) return false;
    if (lh === 2) {
      if (c - 1 > 0) {
        if (clR[k - 2]) return false;
        claim(true, k - 2, k, 0);
      } else {
        const b = k - 1 - W;
        if (r === 0 || !isB(b) || clB[b]) return false;
        claim(false, b, k, 0);
      }
    }
    if (lv === 2) {
      if (r - 1 > 0) {
        const b = k - 2 * W;
        if (clB[b]) return fail(k);
        claim(false, b, k, 1);
      } else {
        const b = c - 1;
        if (c === 0 || !isB(b) || clR[b]) return fail(k);
        claim(true, b, k, 1);
      }
    }
    g[k] = 1;
    hl[k] = lh;
    vl[k] = lv;
    return true;
  }

  function placeBlack(k, r, c) {
    if (!blackPossible(r, c, W, H)) return false;
    if (c > 0 && isW(k - 1) && hl[k - 1] === 1 && !(r > 0 && isW(k - 1 - W))) {
      // single letter across: it has to start a down word
      if (r === H - 1 || !downFree(r, c - 1, k - 1)) return false;
    }
    if (r > 0 && isW(k - W) && vl[k - W] === 1) {
      const left = c > 0 && isW(k - W - 1);
      const right = c < W - 1 && isW(k - W + 1);
      if (!left && !right) return false;
    }
    g[k] = -1;
    blacks++;
    const cand = [];
    if (r >= 1) cand.push(k - W);
    if (r >= 2) cand.push(k - 2 * W);
    if (c >= 1) cand.push(k - 1);
    if (c >= 2) cand.push(k - 2);
    if (r === 1 && c >= 1) cand.push(c - 1);
    if (c <= 1 && r >= 1) cand.push((r - 1) * W);
    for (const b of cand) {
      if (isB(b) && dead(b)) {
        blacks--;
        g[k] = 0;
        return false;
      }
    }
    return true;
  }

  function finalOk() {
    for (let i = 0; i < N; i++) if (isB(i) && !clR[i] && !clB[i]) return false;
    return true;
  }

  // probability of trying a black cell first
  function blackFirst(k, r, c) {
    const lh = c > 0 && isW(k - 1) ? hl[k - 1] : 0;
    const lv = r > 0 && isW(k - W) ? vl[k - W] : 0;
    const runP = (len, edge) => {
      if (edge) return 0.5;
      if (len === 0) return 0.08; // black next to black
      if (len === 1) return 0.18;
      if (len === 2) return 0.22;
      return Math.min(0.9, 0.3 + (len - 3) * 0.16);
    };
    let p = Math.sqrt(runP(lh, c === 0) * runP(lv, r === 0));
    // top row / left column: alternate black and letter, like real arrowwords
    if (r === 0 && c > 0) p = lh >= 1 ? 0.93 : 0.06;
    if (c === 0 && r > 0) p = lv >= 1 ? 0.93 : 0.06;
    const ratio = k ? blacks / k : blackTarget;
    p += (blackTarget - ratio) * 1.5;
    return rnd() < p;
  }

  function solve(k) {
    if (k === N) return finalOk();
    if (++nodes > maxNodes) throw ABORT;
    const r = (k / W) | 0;
    const c = k - r * W;
    const order = k === 0 ? [-1] : blackFirst(k, r, c) ? [-1, 1] : [1, -1];
    for (const v of order) {
      const ok = v === -1 ? placeBlack(k, r, c) : placeWhite(k, r, c);
      if (!ok) continue;
      if (solve(k + 1)) return true;
      release(k);
    }
    return false;
  }

  try {
    if (solve(0)) return g;
  } catch (e) {
    if (e !== ABORT) throw e;
  }
  return null;
}

// Word slots of a template / grid. `isBlack(i)` decides black cells.
function slotsOf(isBlack, W, H) {
  const slots = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const k = r * W + c;
      if (isBlack(k)) continue;
      if ((c === 0 || isBlack(k - 1)) && c + 1 < W && !isBlack(k + 1)) {
        const cells = [];
        for (let x = c; x < W && !isBlack(r * W + x); x++) cells.push(r * W + x);
        slots.push({ dir: 0, cells, clueCell: c > 0 ? k - 1 : r > 0 ? k - W : -1, slot: c > 0 ? 0 : 1 });
      }
      if ((r === 0 || isBlack(k - W)) && r + 1 < H && !isBlack(k + W)) {
        const cells = [];
        for (let y = r; y < H && !isBlack(y * W + c); y++) cells.push(y * W + c);
        slots.push({ dir: 1, cells, clueCell: r > 0 ? k - W : c > 0 ? k - 1 : -1, slot: r > 0 ? 1 : 0 });
      }
    }
  }
  return slots;
}

export function templateStats(tpl, W, H) {
  const slots = slotsOf((i) => tpl[i] === -1, W, H);
  return statsFromSlots(slots, (i) => tpl[i] === -1, W, H);
}

function statsFromSlots(slots, isBlack, W, H) {
  const N = W * H;
  const member = new Uint8Array(N);
  for (const s of slots) for (const k of s.cells) member[k]++;
  let letters = 0;
  let crossed = 0;
  let blacks = 0;
  for (let i = 0; i < N; i++) {
    if (isBlack(i)) blacks++;
    else {
      letters++;
      if (member[i] >= 2) crossed++;
    }
  }
  const twos = slots.filter((s) => s.cells.length === 2).length;
  const avgLen = slots.reduce((a, s) => a + s.cells.length, 0) / Math.max(1, slots.length);
  const longest = Math.max(0, ...slots.map((s) => s.cells.length));
  return { words: slots.length, letters, blacks, crossed, crossRatio: crossed / Math.max(1, letters), blackRatio: blacks / N, twos, twoRatio: twos / Math.max(1, slots.length), avgLen, longest };
}

// ---------- phase 2: fill ----------
// Returns Int8Array of letter codes (-1 for black) or null.
export function fillTemplate(index, tpl, W, H, rnd, opts = {}) {
  const { lens, A1 } = index;
  const maxNodes = opts.maxNodes || 4000;
  const allow = opts.allow || null; // (wordIndex) => boolean
  const pref = opts.pref || null; // (wordIndex) => score bonus (higher = preferred)
  const N = W * H;
  const slots = slotsOf((i) => tpl[i] === -1, W, H);
  const S = slots.length;
  for (const s of slots) if (!lens.has(s.cells.length)) return null;
  const cellSlots = Array.from({ length: N }, () => []);
  slots.forEach((s, si) => s.cells.forEach((k, p) => cellSlots[k].push([si, p])));
  const letters = new Int8Array(N);
  const assigned = new Int32Array(S).fill(-1);
  // per-length masks: allowed and used words
  const allowMask = new Map();
  const used = new Map();
  for (const [L, info] of lens) {
    const m = new Uint32Array(info.nW);
    info.ids.forEach((wi, j) => {
      if (!allow || allow(wi)) m[j >>> 5] |= 1 << (j & 31);
    });
    allowMask.set(L, m);
    used.set(L, new Uint32Array(info.nW));
  }
  let maxW = 1;
  for (const info of lens.values()) maxW = Math.max(maxW, info.nW);
  const scratch = new Uint32Array(maxW);
  let nodes = 0;

  function candBits(si, out) {
    const s = slots[si];
    const L = s.cells.length;
    const info = lens.get(L);
    const nW = info.nW;
    const am = allowMask.get(L);
    const um = used.get(L);
    for (let i = 0; i < nW; i++) out[i] = am[i] & ~um[i];
    for (let p = 0; p < L; p++) {
      const a = letters[s.cells[p]];
      if (!a) continue;
      const b = info.bits[p * A1 + a];
      for (let i = 0; i < nW; i++) out[i] &= b[i];
    }
    let n = 0;
    for (let i = 0; i < nW; i++) if (out[i]) n += popcount32(out[i]);
    return n;
  }

  function solve(depth) {
    if (++nodes > maxNodes) throw ABORT;
    // most constrained open slot
    let best = -1;
    let bestN = 1e9;
    let bestTie = 0;
    for (let si = 0; si < S; si++) {
      if (assigned[si] >= 0) continue;
      const n = candBits(si, scratch);
      if (n === 0) return false;
      const tie = rnd() + slots[si].cells.length * 0.05;
      if (n < bestN || (n === bestN && tie > bestTie)) {
        best = si;
        bestN = n;
        bestTie = tie;
      }
    }
    if (best < 0) return true;
    const s = slots[best];
    const L = s.cells.length;
    const info = lens.get(L);
    const bits = new Uint32Array(info.nW);
    candBits(best, bits);
    const list = [];
    for (let i = 0; i < info.nW; i++) {
      let x = bits[i];
      while (x) {
        const t = x & -x;
        const j = (i << 5) + (31 - Math.clz32(t));
        const wi = info.ids[j];
        list.push({ j, wi, s: rnd() + (pref ? pref(wi) : 0) });
        x ^= t;
      }
    }
    list.sort((a, b) => b.s - a.s);
    const limit = Math.min(list.length, depth < 2 ? 12 : 24);
    const um = used.get(L);
    for (let n = 0; n < limit; n++) {
      const { j, wi } = list[n];
      const w = index.words[wi].w;
      const newly = [];
      for (let p = 0; p < L; p++) {
        const k = s.cells[p];
        if (!letters[k]) {
          letters[k] = index.code[w[p]];
          newly.push(k);
        }
      }
      assigned[best] = j;
      um[j >>> 5] |= 1 << (j & 31);
      // forward check the crossing slots
      let ok = true;
      for (const k of newly) {
        for (const [si] of cellSlots[k]) {
          if (si === best || assigned[si] >= 0) continue;
          if (candBits(si, scratch) === 0) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (ok && solve(depth + 1)) return true;
      um[j >>> 5] &= ~(1 << (j & 31));
      assigned[best] = -1;
      for (const k of newly) letters[k] = 0;
    }
    return false;
  }

  let ok = false;
  try {
    ok = solve(0);
  } catch (e) {
    if (e !== ABORT) throw e;
  }
  if (opts.stats) opts.stats.nodes = nodes;
  if (!ok) return null;
  const out = new Int8Array(N);
  for (let i = 0; i < N; i++) out[i] = tpl[i] === -1 ? -1 : letters[i];
  return out;
}

// ---------- grid helpers ----------

// Words of a grid string ('#' = black): [{ dir, cells, text, clueCell, slot }].
export function gridWords(grid, W, H) {
  return slotsOf((i) => grid[i] === '#', W, H).map((s) => ({ ...s, text: s.cells.map((k) => grid[k]).join('') }));
}

export function gridStats(grid, W, H) {
  const isBlack = (i) => grid[i] === '#';
  return statsFromSlots(slotsOf(isBlack, W, H), isBlack, W, H);
}

export function quality(st) {
  return st.crossRatio * 4 + st.avgLen * 0.9 - st.twoRatio * 3 - Math.abs(st.blackRatio - 0.3) * 6 + Math.min(st.longest, 8) * 0.15;
}

// Chooses one clue per word. `level` 1..3 shifts the choice towards later
// (harder) clues; cells holding two clues prefer shorter ones so they stay
// legible in the "diretas" view.
function pickClue(word, level, rnd, twoInCell, clueUse) {
  const options = word.clues.filter((c) => c.tier <= level);
  const list = options.length ? options : word.clues;
  let best = list[0];
  let bestScore = -1e9;
  list.forEach((c, i) => {
    let s = rnd() * 1.5;
    if (level === 1) s -= i * 2.5;
    else if (level === 2) s -= i * 0.6;
    else s += i * 0.8 + (c.tier - 1) * 0.8;
    const len = c.t.length;
    if (twoInCell) s -= Math.max(0, len - 14) * 0.35;
    else s -= Math.max(0, len - 20) * 0.3;
    if (clueUse) s -= (clueUse.get(word.w + '|' + c.t) || 0) * 0.7;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  });
  return best.t;
}

// Compact puzzle object stored in data files / produced at runtime:
//   { w, h, g: 'grid string', c: [[clueCell, slot(0 right|1 below), dir(0 across|1 down), 'clue'], ...] }
export function makePuzzle(cells, W, H, index, rnd, { level = 1, clueUse = null } = {}) {
  const grid = Array.from(cells, (v) => (v === -1 ? '#' : index.alpha[v - 1])).join('');
  const words = gridWords(grid, W, H);
  const perCell = new Map();
  for (const w of words) perCell.set(w.clueCell, (perCell.get(w.clueCell) || 0) + 1);
  const byText = new Map(index.words.map((w) => [w.w, w]));
  const c = words
    .map((w) => {
      const entry = byText.get(w.text);
      const text = pickClue(entry, level, rnd, perCell.get(w.clueCell) > 1, clueUse);
      if (clueUse) clueUse.set(entry.w + '|' + text, (clueUse.get(entry.w + '|' + text) || 0) + 1);
      return [w.clueCell, w.slot, w.dir, text];
    })
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { w: W, h: H, g: grid, c };
}

// Structural + dictionary validation. `dict` maps word → entry ({clues:[{t}]}).
// Returns a list of problems (empty when the puzzle is valid).
export function validatePuzzle(p, dict) {
  const errs = [];
  const { w: W, h: H, g } = p;
  if (!g || g.length !== W * H) return ['grid size mismatch'];
  const words = gridWords(g, W, H);
  const N = W * H;
  const member = new Uint8Array(N);
  const seen = new Set();
  for (const w of words) {
    if (w.clueCell < 0 || g[w.clueCell] !== '#') errs.push(`word ${w.text} has no clue cell`);
    for (const k of w.cells) member[k]++;
    if (seen.has(w.text)) errs.push(`duplicate word ${w.text}`);
    seen.add(w.text);
    if (dict && !dict.has(w.text)) errs.push(`word not in dictionary: ${w.text}`);
  }
  for (let i = 0; i < N; i++) if (g[i] !== '#' && !member[i]) errs.push(`cell ${i} is in no word`);
  const slots = new Set();
  const byKey = new Map(words.map((w) => [`${w.clueCell}:${w.slot}:${w.dir}`, w]));
  for (const [cell, slot, dir, text] of p.c) {
    const key = `${cell}:${slot}:${dir}`;
    const w = byKey.get(key);
    if (!w) errs.push(`clue without word at ${key}`);
    if (slots.has(`${cell}:${slot}`)) errs.push(`slot used twice at ${cell}:${slot}`);
    slots.add(`${cell}:${slot}`);
    if (w && dict) {
      const e = dict.get(w.text);
      if (e && !e.clues.some((c) => c.t === text)) errs.push(`clue "${text}" not listed for ${w.text}`);
    }
    if (!text || !String(text).trim()) errs.push(`empty clue at ${key}`);
  }
  if (p.c.length !== words.length) errs.push(`clue count ${p.c.length} != word count ${words.length}`);
  for (let i = 0; i < N; i++) {
    if (g[i] !== '#') continue;
    if (!slots.has(`${i}:0`) && !slots.has(`${i}:1`)) errs.push(`black cell ${i} holds no clue`);
  }
  return errs;
}

// Generates one puzzle; deterministic for a given seed. Several templates are
// tried; each template gets a few fill attempts; the best fill by quality wins.
export function generatePuzzle(index, o) {
  const { W, H, seed, level = 1, maxSlot = 8, blackTarget = 0.3, minCross = 0.72, maxTwo = 0.42 } = o;
  const templates = o.templates || 40;
  const fillsPerTemplate = o.fillsPerTemplate || 3;
  const wanted = o.fills || 1;
  const rnd = mulberry32(seed);
  const slotMax = Math.max(4, Math.min(maxSlot, index.goodMax));
  let best = null;
  let bestQ = -1e9;
  let found = 0;
  for (let t = 0; t < templates && found < wanted; t++) {
    const tpl = makeTemplate(W, H, rnd, { maxSlot: slotMax, blackTarget });
    if (!tpl) continue;
    const ts = templateStats(tpl, W, H);
    if (ts.crossRatio < minCross || ts.twoRatio > maxTwo || ts.blackRatio > blackTarget + 0.1) continue;
    for (let f = 0; f < fillsPerTemplate; f++) {
      const cells = fillTemplate(index, tpl, W, H, rnd, { maxNodes: o.maxNodes || 2500, allow: o.allow, pref: o.pref });
      if (!cells) continue;
      const q = quality(ts) + rnd() * 0.01;
      found++;
      if (q > bestQ) {
        bestQ = q;
        best = cells;
      }
      break;
    }
  }
  if (!best) return null;
  const p = makePuzzle(best, W, H, index, rnd, { level, clueUse: o.clueUse || null });
  p.q = Math.round(bestQ * 100) / 100;
  return p;
}
