// Word search engine — pure functions, no DOM (also imported by the node tests).
//
// A puzzle is generated deterministically from (theme words, level config, seed):
// targets are placed first (longest first, overlapping more as levels go up),
// then a couple of extra theme words ("bonus" words), then decoy fragments of
// the targets, then the remaining cells are filled with letters weighted by the
// language's letter frequency. The result is verified: every target appears in
// the grid exactly once (in any of the 8 directions) and no blocked word shows up.

import { PACKS, THEMES, THEME_BY_ID } from './themes.js';

// [dr, dc] — unlock order: → ↓ ↘ ↗ ← ↑ ↖ ↙
export const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];

export const CHAPTER_LEN = 6;

// Deterministic PRNG (mulberry32).
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Grid form of a word: uppercase A–Z only (Ç→C, Ã→A, Ñ→N…).
export function toKey(word) {
  return String(word)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function parseWords(str) {
  return String(str || '')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

// Letter frequencies (approximate, per 1000) used for the filler letters.
const FREQ = {
  pt: 'A146 E126 O107 S78 R65 I62 N50 D50 M47 U46 T43 C39 L28 P25 V17 G13 H13 Q10 B10 F10 Z5 J4 X3 K1 W1 Y1',
  en: 'E127 T91 A82 O75 I70 N67 S63 H61 R60 D43 L40 C28 U28 M24 W24 F22 G20 Y20 P19 B15 V10 K8 J2 X2 Q1 Z1',
  es: 'E137 A125 O87 S80 R69 N67 I62 D59 L50 C47 T46 U39 M32 P25 B14 G10 V9 Y9 Q9 H7 F7 Z5 J4 X2 K1 W1',
};
const FREQ_TABLES = {};
function freqTable(lang) {
  if (!FREQ_TABLES[lang]) {
    const entries = (FREQ[lang] || FREQ.en).split(' ').map((s) => [s[0], Number(s.slice(1))]);
    const total = entries.reduce((n, [, w]) => n + w, 0);
    let acc = 0;
    FREQ_TABLES[lang] = entries.map(([ch, w]) => {
      acc += w / total;
      return [ch, acc];
    });
  }
  return FREQ_TABLES[lang];
}
function randomLetter(lang, rnd) {
  const table = freqTable(lang);
  const x = rnd();
  for (const [ch, acc] of table) if (x <= acc) return ch;
  return table[table.length - 1][0];
}

// A few words that must never show up by accident in the filler letters.
const BLOCKED = {
  pt: ['PUTA', 'MERDA', 'CU', 'PORRA', 'CARALHO', 'BOSTA', 'XOTA', 'PICA', 'BUCETA', 'VIADO', 'CORNO', 'FODA', 'FODE'],
  en: ['FUCK', 'SHIT', 'CUNT', 'DICK', 'COCK', 'PISS', 'TWAT', 'SLUT', 'WHORE', 'FAG', 'NIGGER', 'BITCH', 'ASS'],
  es: ['PUTA', 'MIERDA', 'COÑO', 'POLLA', 'CULO', 'PENE', 'CABRON', 'JODER', 'VERGA', 'PUTO', 'MARICON', 'CHINGA'],
};
const BLOCKED_KEYS = {};
function blockedKeys(lang) {
  if (!BLOCKED_KEYS[lang]) BLOCKED_KEYS[lang] = (BLOCKED[lang] || []).map(toKey).filter((k) => k.length >= 3);
  return BLOCKED_KEYS[lang];
}

// ---------------------------------------------------------------- difficulty
// Grid grows 6×6 → 12×12, more words, directions unlock gradually, decoys appear.
export function levelConfig(level) {
  const L = Math.max(1, level | 0);
  const size = L <= 3 ? 6 : L <= 8 ? 7 : L <= 16 ? 8 : L <= 28 ? 9 : L <= 45 ? 10 : L <= 70 ? 11 : 12;
  const byGrid = { 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11 };
  let count = L <= 2 ? 4 : byGrid[size];
  if (L > 90) count += (L % 3); // 11–13 words on the biggest grids
  const dirs = L <= 4 ? 2 : L <= 10 ? 3 : L <= 18 ? 4 : L <= 30 ? 6 : L <= 45 ? 7 : 8;
  const decoys = L < 12 ? 0 : Math.min(8, Math.floor((L - 6) / 6));
  const bonus = L < 5 ? 0 : L < 25 ? 1 : 2;
  const overlap = Math.min(0.75, 0.15 + L / 120);
  return { size, count, dirs, decoys, bonus, overlap };
}

export const DAILY_CONFIG = { size: 12, count: 13, dirs: 8, decoys: 8, bonus: 2, overlap: 0.7 };

export function timedConfig(gridNo) {
  return gridNo <= 1
    ? { size: 8, count: 6, dirs: 3, decoys: 0, bonus: 0, overlap: 0.3 }
    : { size: 8, count: 6, dirs: gridNo <= 3 ? 4 : 6, decoys: 2, bonus: 0, overlap: 0.4 };
}

// ---------------------------------------------------------------- progression
// Endless numbered levels grouped in chapters of 6; each chapter is a theme pack
// (6 themes). After every pack a new "season" starts with reshuffled themes.
export function levelInfo(level) {
  const L = Math.max(1, level | 0);
  const chapter = Math.floor((L - 1) / CHAPTER_LEN); // 0-based, endless
  const within = (L - 1) % CHAPTER_LEN;
  const packIdx = chapter % PACKS.length;
  const season = Math.floor(chapter / PACKS.length);
  const pack = PACKS[packIdx];
  const themeId = pack.themes[(within + season) % pack.themes.length];
  return { level: L, chapter, within, season, pack, theme: THEME_BY_ID[themeId], first: chapter * CHAPTER_LEN + 1 };
}

export function chapterInfo(chapter) {
  const packIdx = chapter % PACKS.length;
  return { chapter, pack: PACKS[packIdx], season: Math.floor(chapter / PACKS.length), first: chapter * CHAPTER_LEN + 1, last: (chapter + 1) * CHAPTER_LEN };
}

export function levelSeed(level, lang) {
  return hashStr(`ws:${lang}:L${level}`);
}

export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dailyTheme(dateKey) {
  return THEMES[hashStr(`daily:${dateKey}`) % THEMES.length];
}

// ---------------------------------------------------------------- generation
function conflicts(a, b) {
  // a word inside another one (either way round) would appear twice in the grid
  if (a.length > b.length) [a, b] = [b, a];
  if (b.includes(a)) return true;
  const ra = a.split('').reverse().join('');
  return b.includes(ra);
}

// Counts the distinct occurrences of `key` in the grid (palindromes count once).
export function countOccurrences(grid, size, key) {
  const seen = new Set();
  const n = key.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r * size + c] !== key[0]) continue;
      for (const [dr, dc] of DIRS) {
        const er = r + dr * (n - 1);
        const ec = c + dc * (n - 1);
        if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
        let ok = true;
        for (let i = 1; i < n; i++) {
          if (grid[(r + dr * i) * size + (c + dc * i)] !== key[i]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          const a = r * size + c;
          const b = er * size + ec;
          seen.add(a < b ? `${a}-${b}` : `${b}-${a}`);
        }
      }
    }
  }
  return seen.size;
}

function placements(grid, size, key, dirs) {
  const out = [];
  const n = key.length;
  for (const [dr, dc] of dirs) {
    for (let r = 0; r < size; r++) {
      const er = r + dr * (n - 1);
      if (er < 0 || er >= size) continue;
      for (let c = 0; c < size; c++) {
        const ec = c + dc * (n - 1);
        if (ec < 0 || ec >= size) continue;
        let ok = true;
        let overlap = 0;
        for (let i = 0; i < n; i++) {
          const ch = grid[(r + dr * i) * size + (c + dc * i)];
          if (ch) {
            if (ch !== key[i]) {
              ok = false;
              break;
            }
            overlap++;
          }
        }
        if (ok && overlap < n) out.push({ r, c, dr, dc, overlap });
      }
    }
  }
  return out;
}

function choosePlacement(list, rnd, overlapBias) {
  if (!list.length) return null;
  const crossing = list.filter((p) => p.overlap > 0);
  if (crossing.length && rnd() < overlapBias) return crossing[Math.floor(rnd() * crossing.length)];
  return list[Math.floor(rnd() * list.length)];
}

function write(grid, size, key, p) {
  for (let i = 0; i < key.length; i++) grid[(p.r + p.dr * i) * size + (p.c + p.dc * i)] = key[i];
}

// words: theme words (display form, accents kept). Returns
// { size, grid: string[] (row-major letters), words: [{ word, key, r, c, dr, dc }], bonus: [{ word, key }] }
export function generatePuzzle({ words, size, count, dirs = 8, decoys = 0, bonus = 0, overlap = 0.4, seed = 1, lang = 'en' }) {
  const rnd = rng(seed);
  const dirList = DIRS.slice(0, Math.max(1, Math.min(8, dirs)));
  const pool = [];
  const seenKeys = new Set();
  for (const w of words) {
    const key = toKey(w);
    if (key.length < 3 || key.length > size || seenKeys.has(key)) continue;
    seenKeys.add(key);
    pool.push({ word: w, key });
  }
  const want = Math.min(count, pool.length);
  const blocked = blockedKeys(lang);
  let best = null;

  for (let attempt = 0; attempt < 60; attempt++) {
    const order = shuffle(pool, rnd);
    const chosen = [];
    for (const item of order) {
      if (chosen.length >= want) break;
      if (chosen.some((o) => conflicts(o.key, item.key))) continue;
      chosen.push(item);
    }
    const reserve = order.filter((o) => !chosen.includes(o) && !chosen.some((c) => conflicts(c.key, o.key)));
    const grid = new Array(size * size).fill('');
    const placed = [];
    const queue = chosen.slice().sort((a, b) => b.key.length - a.key.length);
    // spread directions: try a random unused direction first for variety
    for (let qi = 0; qi < queue.length; qi++) {
      const item = queue[qi];
      const opts = placements(grid, size, item.key, dirList);
      let p = null;
      if (opts.length) {
        const used = new Set(placed.map((w) => `${w.dr},${w.dc}`));
        const fresh = opts.filter((o) => !used.has(`${o.dr},${o.dc}`));
        p = fresh.length && rnd() < 0.5 ? choosePlacement(fresh, rnd, overlap) : choosePlacement(opts, rnd, overlap);
      }
      if (!p) {
        // try a replacement word that fits
        const alt = reserve.find((o) => !placed.some((w) => conflicts(w.key, o.key)) && placements(grid, size, o.key, dirList).length);
        if (!alt) continue;
        reserve.splice(reserve.indexOf(alt), 1);
        queue.push(alt);
        continue;
      }
      write(grid, size, item.key, p);
      placed.push({ word: item.word, key: item.key, r: p.r, c: p.c, dr: p.dr, dc: p.dc });
    }
    if (placed.length < want) {
      if (!best || placed.length > best.placedCount) best = { placedCount: placed.length };
      continue;
    }

    // bonus words: other theme words that don't clash with the targets
    const bonusPlaced = [];
    const bonusPool = shuffle(
      pool.filter((o) => !placed.some((w) => w.key === o.key || conflicts(w.key, o.key))),
      rnd,
    );
    for (const item of bonusPool) {
      if (bonusPlaced.length >= bonus) break;
      if (bonusPlaced.some((b) => conflicts(b.key, item.key))) continue;
      const opts = placements(grid, size, item.key, DIRS).filter((o) => o.overlap > 0 || rnd() < 0.5);
      const p = choosePlacement(opts, rnd, 0.8);
      if (!p) continue;
      write(grid, size, item.key, p);
      bonusPlaced.push(item);
    }

    // decoys: fragments of the target words scattered around
    for (let i = 0; i < decoys; i++) {
      const w = placed[Math.floor(rnd() * placed.length)];
      const cut = w.key.length >= 6 ? 2 : 1;
      const frag = w.key.slice(0, w.key.length - cut - (rnd() < 0.4 ? 1 : 0));
      if (frag.length < 2) continue;
      const opts = placements(grid, size, frag, dirList);
      const p = choosePlacement(opts, rnd, 0.2);
      if (p) write(grid, size, frag, p);
    }

    // fill + verify (a few refills before giving up on this layout)
    const fixed = grid.slice();
    const letterPool = placed.map((w) => w.key).join('');
    for (let fill = 0; fill < 12; fill++) {
      const g = fixed.slice();
      for (let i = 0; i < g.length; i++) {
        if (g[i]) continue;
        g[i] = decoys > 0 && rnd() < 0.22 ? letterPool[Math.floor(rnd() * letterPool.length)] : randomLetter(lang, rnd);
      }
      if (!placed.every((w) => countOccurrences(g, size, w.key) === 1)) continue;
      if (blocked.some((b) => countOccurrences(g, size, b) > 0)) continue;
      // every other theme word that happens to be in the grid counts as a bonus word
      const bonusFound = pool.filter(
        (o) => !placed.some((w) => w.key === o.key || conflicts(w.key, o.key)) && countOccurrences(g, size, o.key) > 0,
      );
      return {
        size,
        grid: g,
        words: placed,
        bonus: bonusFound.map((o) => ({ word: o.word, key: o.key })),
        seed,
      };
    }
  }
  // Fallback (never expected): smaller word count.
  if (count > 3) return generatePuzzle({ words, size, count: count - 1, dirs, decoys: 0, bonus: 0, overlap, seed: seed + 1, lang });
  throw new Error('wordsearch: could not generate a puzzle');
}

// Cells covered by a placed word.
export function wordCells(w) {
  const out = [];
  for (let i = 0; i < w.key.length; i++) out.push([w.r + w.dr * i, w.c + w.dc * i]);
  return out;
}

// Puzzle for a numbered level in a language. `lists` = { themeId: 'WORD WORD …' }.
export function levelPuzzle(level, lang, lists) {
  const info = levelInfo(level);
  const cfg = levelConfig(level);
  const words = parseWords(lists[info.theme.id]);
  const puzzle = generatePuzzle({ words, ...cfg, seed: levelSeed(level, lang), lang });
  return { ...puzzle, info, cfg };
}

export function dailyPuzzle(dateKey, lang, lists) {
  const theme = dailyTheme(dateKey);
  const words = parseWords(lists[theme.id]);
  const puzzle = generatePuzzle({ words, ...DAILY_CONFIG, seed: hashStr(`daily:${lang}:${dateKey}`), lang });
  return { ...puzzle, theme, cfg: DAILY_CONFIG };
}

export function timedPuzzle(gridNo, themeId, seed, lang, lists) {
  const cfg = timedConfig(gridNo);
  const words = parseWords(lists[themeId]);
  const puzzle = generatePuzzle({ words, ...cfg, seed, lang });
  return { ...puzzle, theme: THEME_BY_ID[themeId], cfg };
}

export { PACKS, THEMES, THEME_BY_ID };
