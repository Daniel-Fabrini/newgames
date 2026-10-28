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
// belongs to at least one word, and no word repeats in a grid. The same grid is
// shown as a classic numbered crossword (black blocks + clue lists) by default.
//
// The filler walks the cells in reading order and decides "black or letter"
// for each one, keeping every horizontal and vertical run a valid prefix of a
// dictionary word (trie), with randomized ordering and restarts.

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

// ---------- word index (trie over the grid alphabet) ----------
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
  let total = 1;
  for (const w of words) total += w.w.length;
  const child = new Int32Array(total * A1);
  const wordAt = new Int32Array(total);
  let nNodes = 1;
  words.forEach((wd, wi) => {
    let n = 0;
    for (const ch of wd.w) {
      const L = code[ch];
      let nx = child[n * A1 + L];
      if (!nx) {
        nx = nNodes++;
        child[n * A1 + L] = nx;
      }
      n = nx;
    }
    wordAt[n] = wi + 1;
  });
  const minRem = new Uint8Array(nNodes);
  const count = new Int32Array(nNodes);
  for (let n = nNodes - 1; n >= 0; n--) {
    let mr = 99;
    let cnt = wordAt[n] ? 1 : 0;
    for (let L = 1; L < A1; L++) {
      const ch = child[n * A1 + L];
      if (ch) {
        mr = Math.min(mr, 1 + minRem[ch]);
        cnt += count[ch];
      }
    }
    minRem[n] = wordAt[n] ? 0 : mr;
    count[n] = cnt;
  }
  return { lang, alpha, A1, code, words, child, wordAt, minRem, count, nNodes };
}

// ---------- the filler ----------
const ABORT = { abort: true };

// Static check: can a black cell at (r,c) ever hold a clue?
function blackPossible(r, c, W, H) {
  const right = c + 2 <= W - 1 || (r === 0 && c + 1 <= W - 1 && H >= 2);
  const below = r + 2 <= H - 1 || (c === 0 && r + 1 <= H - 1 && W >= 2);
  return right || below;
}

// Fills a W×H grid. Returns { cells: Int8Array (-1 black, letter codes), words } or null.
export function fillGrid(index, W, H, rnd, opts = {}) {
  const { child, wordAt, minRem, count, A1 } = index;
  const nWords = index.words.length;
  const maxNodes = opts.maxNodes || 60000;
  const allow = opts.allow || null; // (wordIndex) => boolean, extra filter (usage caps)
  const blackTarget = opts.blackTarget ?? 0.3;
  const twoPenalty = opts.twoPenalty ?? 0.6;
  const N = W * H;
  const g = new Int8Array(N);
  const hn = new Int32Array(N);
  const vn = new Int32Array(N);
  const hl = new Uint8Array(N);
  const vl = new Uint8Array(N);
  const clR = new Uint8Array(N);
  const clB = new Uint8Array(N);
  const used = new Uint8Array(nWords);
  // per-cell undo info
  const claimA = new Int32Array(N).fill(-1);
  const claimB = new Int32Array(N).fill(-1);
  const doneA = new Int32Array(N).fill(-1);
  const doneB = new Int32Array(N).fill(-1);
  let blacks = 0;
  let nodes = 0;

  const isBlack = (i) => g[i] === -1;

  function wordOk(node) {
    if (node <= 0) return -1;
    const wi = wordAt[node] - 1;
    if (wi < 0 || used[wi]) return -1;
    if (allow && !allow(wi)) return -1;
    return wi;
  }

  function claim(slotArr, b, k, which) {
    slotArr[b] = 1;
    if (which === 0) claimA[k] = slotArr === clR ? b * 2 : b * 2 + 1;
    else claimB[k] = slotArr === clR ? b * 2 : b * 2 + 1;
  }

  function release(k) {
    for (const v of [claimA[k], claimB[k]]) {
      if (v >= 0) (v & 1 ? clB : clR)[v >> 1] = 0;
    }
    if (doneA[k] >= 0) used[doneA[k]] = 0;
    if (doneB[k] >= 0) used[doneB[k]] = 0;
    claimA[k] = claimB[k] = doneA[k] = doneB[k] = -1;
    if (g[k] === -1) blacks--;
    g[k] = 0;
  }

  // Can black cell b still receive a clue, given the cells filled so far?
  function dead(b) {
    if (clR[b] || clB[b]) return false;
    const rb = (b / W) | 0;
    const cb = b - rb * W;
    if (cb + 2 < W && !isBlack(b + 1) && !isBlack(b + 2)) return false;
    if (rb === 0 && cb + 1 < W && H > 1 && !isBlack(b + 1) && !isBlack(b + 1 + W)) return false;
    if (rb + 2 < H && !isBlack(b + W) && !isBlack(b + 2 * W)) return false;
    if (cb === 0 && rb + 1 < H && W > 1 && !isBlack(b + W) && !isBlack(b + W + 1)) return false;
    return true;
  }

  function placeLetter(k, r, c, L) {
    // horizontal
    let nh;
    let lh;
    if (c > 0 && g[k - 1] > 0) {
      const p = hn[k - 1];
      if (p < 0) return false;
      nh = child[p * A1 + L];
      if (!nh) return false;
      lh = hl[k - 1] + 1;
      if (!wordAt[nh] && minRem[nh] > W - 1 - c) return false;
    } else {
      nh = child[L] || -1;
      lh = 1;
      if (nh > 0 && minRem[nh] > W - 1 - c) nh = -1;
    }
    // vertical
    let nv;
    let lv;
    if (r > 0 && g[k - W] > 0) {
      const p = vn[k - W];
      if (p < 0) return false;
      nv = child[p * A1 + L];
      if (!nv) return false;
      lv = vl[k - W] + 1;
      if (!wordAt[nv] && minRem[nv] > H - 1 - r) return false;
    } else {
      nv = child[L] || -1;
      lv = 1;
      if (nv > 0 && minRem[nv] > H - 1 - r) nv = -1;
    }
    // a letter must be able to belong to some word
    if (lh === 1 && nh < 0 && lv === 1 && nv < 0) return false;
    if (c === W - 1 && lh === 1 && lv === 1 && (nv < 0 || r === H - 1)) return false;
    if (r === H - 1 && lv === 1 && lh === 1 && (nh < 0 || c === W - 1)) return false;
    // word births: claim the clue slot
    if (lh === 2) {
      const s = c - 1;
      if (s > 0) {
        const b = k - 2;
        if (clR[b]) return false;
        claim(clR, b, k, 0);
      } else {
        if (r === 0) return false;
        const b = k - 1 - W;
        if (!isBlack(b) || clB[b]) return false;
        claim(clB, b, k, 0);
      }
    }
    if (lv === 2) {
      const s = r - 1;
      let b;
      let arr;
      if (s > 0) {
        b = k - 2 * W;
        arr = clB;
      } else {
        if (c === 0) return fail(k);
        b = c - 1;
        arr = clR;
        if (!isBlack(b)) return fail(k);
      }
      if (arr[b]) return fail(k);
      claim(arr, b, k, 1);
    }
    // runs ending at the grid edge
    if (c === W - 1 && lh >= 2) {
      const wi = wordOk(nh);
      if (wi < 0) return fail(k);
      used[wi] = 1;
      doneA[k] = wi;
    }
    if (r === H - 1 && lv >= 2) {
      const wi = wordOk(nv);
      if (wi < 0) return fail(k);
      used[wi] = 1;
      doneB[k] = wi;
    }
    g[k] = L;
    hn[k] = nh;
    hl[k] = lh;
    vn[k] = nv;
    vl[k] = lv;
    return true;
  }

  // undo partial work of a failed placement
  function fail(k) {
    for (const v of [claimA[k], claimB[k]]) if (v >= 0) (v & 1 ? clB : clR)[v >> 1] = 0;
    if (doneA[k] >= 0) used[doneA[k]] = 0;
    if (doneB[k] >= 0) used[doneB[k]] = 0;
    claimA[k] = claimB[k] = doneA[k] = doneB[k] = -1;
    g[k] = 0;
    return false;
  }

  function placeBlack(k, r, c) {
    if (!blackPossible(r, c, W, H)) return false;
    // horizontal run ending at (r, c-1)
    if (c > 0 && g[k - 1] > 0) {
      if (hl[k - 1] >= 2) {
        const wi = wordOk(hn[k - 1]);
        if (wi < 0) return false;
        used[wi] = 1;
        doneA[k] = wi;
      } else if (!(r > 0 && g[k - 1 - W] > 0)) {
        // single letter across: it must continue downwards
        if (r === H - 1 || vn[k - 1] <= 0) return fail(k);
      }
    }
    // vertical run ending at (r-1, c)
    if (r > 0 && g[k - W] > 0) {
      if (vl[k - W] >= 2) {
        const wi = wordOk(vn[k - W]);
        if (wi < 0) return fail(k);
        used[wi] = 1;
        doneB[k] = wi;
      } else {
        const left = c > 0 && g[k - W - 1] > 0;
        const right = c < W - 1 && g[k - W + 1] > 0;
        if (!left && !right) return fail(k);
      }
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
      if (g[b] === -1 && dead(b)) {
        blacks--;
        return fail(k);
      }
    }
    return true;
  }

  function finalOk() {
    for (let i = 0; i < N; i++) if (g[i] === -1 && !clR[i] && !clB[i]) return false;
    return true;
  }

  // Ordered options for cell k: letter codes, and -1 for black.
  function options(k, r, c) {
    const out = [];
    const hMid = c > 0 && g[k - 1] > 0;
    const vMid = r > 0 && g[k - W] > 0;
    const hp = hMid ? hn[k - 1] : 0;
    const vp = vMid ? vn[k - W] : 0;
    if (!(hMid && hp < 0) && !(vMid && vp < 0)) {
      for (let L = 1; L < A1; L++) {
        let sh;
        let sv;
        if (hMid) {
          const ch = child[hp * A1 + L];
          if (!ch) continue;
          sh = Math.log(1 + count[ch]) + (wordAt[ch] ? 0.3 : 0);
        } else {
          const ch = child[L];
          sh = ch ? Math.log(1 + count[ch]) * 0.6 : -0.5;
        }
        if (vMid) {
          const ch = child[vp * A1 + L];
          if (!ch) continue;
          sv = Math.log(1 + count[ch]) + (wordAt[ch] ? 0.3 : 0);
        } else {
          const ch = child[L];
          sv = ch ? Math.log(1 + count[ch]) * 0.6 : -0.5;
        }
        let edge = 0;
        // Along the top row / left column a letter inside a word forces a
        // black cell next to it (no clue fits there): prefer the alternating
        // "black, letter, black" frame of real arrowword grids.
        if (r === 0 && hMid) edge -= 1.6;
        if (c === 0 && vMid) edge -= 1.6;
        out.push({ v: L, s: sh + sv + edge + rnd() * 2.2 });
      }
    }
    // black cell desirability
    if (blackPossible(r, c, W, H)) {
      let s = 2.2;
      const lhPrev = hMid ? hl[k - 1] : 0;
      const lvPrev = vMid ? vl[k - W] : 0;
      if (hMid) {
        if (lhPrev >= 2) s += wordAt[hp] ? 1.2 + 0.25 * lhPrev - (lhPrev === 2 ? twoPenalty : 0) : -9;
        else s -= 1.2;
      } else if (c > 0) s -= 2.2; // two blacks side by side
      if (vMid) {
        if (lvPrev >= 2) s += wordAt[vp] ? 1.2 + 0.25 * lvPrev - (lvPrev === 2 ? twoPenalty : 0) : -9;
        else s -= 1.2;
      } else if (r > 0) s -= 2.2;
      const ratio = k ? blacks / k : 0;
      s += (blackTarget - ratio) * 14;
      out.push({ v: -1, s: s + rnd() * 2.2 });
    }
    out.sort((a, b) => b.s - a.s);
    return out;
  }

  let maxK = 0;
  function solve(k) {
    if (k > maxK) {
      maxK = k;
      if (opts.stats) opts.stats.snap = Array.from(g);
    }
    if (k === N) return finalOk();
    if (++nodes > maxNodes) throw ABORT;
    const r = (k / W) | 0;
    const c = k - r * W;
    for (const o of options(k, r, c)) {
      const ok = o.v === -1 ? placeBlack(k, r, c) : placeLetter(k, r, c, o.v);
      if (!ok) continue;
      if (solve(k + 1)) return true;
      release(k);
    }
    return false;
  }

  let ok = false;
  try {
    ok = solve(0);
  } catch (e) {
    if (e !== ABORT) throw e;
  }
  if (opts.stats) {
    opts.stats.maxK = maxK;
    opts.stats.nodes = nodes;
  }
  if (!ok) return null;
  return { W, H, cells: g, nodes };
}

// ---------- from a filled grid to a puzzle ----------

// Words of a grid string ('#' = black). Returns [{ dir, cells:[k..], text, clueCell, slot }].
export function gridWords(grid, W, H) {
  const words = [];
  const at = (r, c) => grid[r * W + c];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (at(r, c) === '#') continue;
      // across start
      if ((c === 0 || at(r, c - 1) === '#') && c + 1 < W && at(r, c + 1) !== '#') {
        const cells = [];
        for (let x = c; x < W && at(r, x) !== '#'; x++) cells.push(r * W + x);
        const clueCell = c > 0 ? r * W + c - 1 : r > 0 ? (r - 1) * W : -1;
        words.push({ dir: 0, cells, text: cells.map((i) => grid[i]).join(''), clueCell, slot: c > 0 ? 0 : 1 });
      }
      // down start
      if ((r === 0 || at(r - 1, c) === '#') && r + 1 < H && at(r + 1, c) !== '#') {
        const cells = [];
        for (let y = r; y < H && at(y, c) !== '#'; y++) cells.push(y * W + c);
        const clueCell = r > 0 ? (r - 1) * W + c : c > 0 ? c - 1 : -1;
        words.push({ dir: 1, cells, text: cells.map((i) => grid[i]).join(''), clueCell, slot: r > 0 ? 1 : 0 });
      }
    }
  }
  return words;
}

// Grid statistics used to rank candidate fills.
export function gridStats(grid, W, H) {
  const words = gridWords(grid, W, H);
  const N = W * H;
  const inWords = new Uint8Array(N);
  for (const w of words) for (const k of w.cells) inWords[k]++;
  let letters = 0;
  let crossed = 0;
  let blacks = 0;
  for (let i = 0; i < N; i++) {
    if (grid[i] === '#') blacks++;
    else {
      letters++;
      if (inWords[i] >= 2) crossed++;
    }
  }
  const twos = words.filter((w) => w.text.length === 2).length;
  const avgLen = words.reduce((a, w) => a + w.text.length, 0) / Math.max(1, words.length);
  const longest = Math.max(0, ...words.map((w) => w.text.length));
  return { words: words.length, letters, blacks, crossed, crossRatio: crossed / Math.max(1, letters), blackRatio: blacks / N, twos, twoRatio: twos / Math.max(1, words.length), avgLen, longest };
}

export function quality(st) {
  return st.crossRatio * 4 + st.avgLen * 0.9 - st.twoRatio * 3 - Math.abs(st.blackRatio - 0.3) * 6 + Math.min(st.longest, 8) * 0.15;
}

// Chooses one clue per word. `level` 1..3 shifts the choice towards later
// (harder) clues; `shortFor` is a set of clue cells that hold two clues, where
// shorter clues are preferred so they stay legible inside the grid.
function pickClue(word, level, rnd, twoInCell, clueUse) {
  const options = word.clues.filter((c) => c.tier <= level);
  const list = options.length ? options : word.clues;
  let best = null;
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

// Builds the compact puzzle object stored in data files / produced at runtime:
//   { w, h, g: 'grid string', c: [[clueCell, slot(0 right|1 below), dir(0 across|1 down), 'clue'], ...] }
export function makePuzzle(fill, index, rnd, { level = 1, clueUse = null } = {}) {
  const { W, H, cells } = fill;
  const grid = [...cells].map((v) => (v === -1 ? '#' : index.alpha[v - 1])).join('');
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
  if (g.length !== W * H) return ['grid size mismatch'];
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
  // clues ↔ words, one per slot
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
    if (!text || !text.trim()) errs.push(`empty clue at ${key}`);
  }
  if (p.c.length !== words.length) errs.push(`clue count ${p.c.length} != word count ${words.length}`);
  for (let i = 0; i < N; i++) {
    if (g[i] !== '#') continue;
    if (!slots.has(`${i}:0`) && !slots.has(`${i}:1`)) errs.push(`black cell ${i} holds no clue`);
  }
  return errs;
}

// Generates one puzzle: several fills, keeps the best by quality.
// Deterministic for a given seed. Returns the puzzle or null.
export function generatePuzzle(index, { W, H, seed, level = 1, tries = 6, fills = 2, maxNodes = 40000, allow = null, clueUse = null, minQuality = -99, blackTarget = 0.3 }) {
  const rnd = mulberry32(seed);
  let best = null;
  let bestQ = -1e9;
  let found = 0;
  for (let t = 0; t < tries && found < fills; t++) {
    const fill = fillGrid(index, W, H, rnd, { maxNodes, allow, blackTarget });
    if (!fill) continue;
    const grid = [...fill.cells].map((v) => (v === -1 ? '#' : index.alpha[v - 1])).join('');
    const st = gridStats(grid, W, H);
    const q = quality(st);
    if (q < minQuality) continue;
    found++;
    if (q > bestQ) {
      bestQ = q;
      best = { fill, st, q };
    }
  }
  if (!best) return null;
  const p = makePuzzle(best.fill, index, rnd, { level, clueUse });
  p.q = Math.round(best.q * 100) / 100;
  return p;
}
