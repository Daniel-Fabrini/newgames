import { Rng } from '../../utils/random';
import type { Dir } from './types';

/**
 * Criss-cross layout generator (pure and deterministic for a given seed and word list).
 *
 * Placement rules (the same ones the validator enforces):
 * - every new word crosses at least one word already on the grid, at a shared letter;
 * - a crossing square is shared by exactly one across and one down word;
 * - squares of a new word that are not crossings have no neighbours at the sides, so words never
 *   run side by side in parallel and never create accidental two-letter words;
 * - the squares just before the first letter and just after the last letter stay empty, so no
 *   word touches the end of another;
 * - the whole grid fits in MAX_SIZE × MAX_SIZE.
 * Because each word is attached to the existing grid, the result is always connected.
 */
export const MAX_SIZE = 11;
/** Generated grids are at most 11 wide and 9 tall: landscape shapes leave room for the clue bar and keyboard on phones. */
export const GEN_MAX_WIDTH = 11;
export const GEN_MAX_HEIGHT = 9;
export const MIN_WORDS = 8;
export const MAX_WORDS = 14;
export const MIN_LEN = 3;
export const MAX_LEN = 9;

export interface LayoutWord {
  answer: string;
  dir: Dir;
  row: number;
  col: number;
}

export interface Layout {
  width: number;
  height: number;
  words: LayoutWord[];
}

export interface GenerateOptions {
  maxWidth?: number;
  maxHeight?: number;
  minWords?: number;
  maxWords?: number;
}

const CANVAS = 2 * MAX_SIZE + 12;
const ATTEMPTS = 24;
/** Candidate words with at least one legal placement compared at each step. */
const CANDIDATES_PER_STEP = 40;

class Canvas {
  readonly letters: (string | null)[] = new Array<string | null>(CANVAS * CANVAS).fill(null);
  readonly across = new Uint8Array(CANVAS * CANVAS);
  readonly down = new Uint8Array(CANVAS * CANVAS);
  readonly byLetter = new Map<string, number[]>();
  minR = CANVAS;
  maxR = -1;
  minC = CANVAS;
  maxC = -1;

  at(r: number, c: number): string | null {
    if (r < 0 || c < 0 || r >= CANVAS || c >= CANVAS) return null;
    return this.letters[r * CANVAS + c] ?? null;
  }

  /** Number of crossings of a legal placement, or -1 when the placement is not allowed. */
  check(word: string, r: number, c: number, dir: Dir, maxW: number, maxH: number): number {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    const len = word.length;
    const endR = r + dr * (len - 1);
    const endC = c + dc * (len - 1);
    if (r < 1 || c < 1 || endR >= CANVAS - 1 || endC >= CANVAS - 1) return -1;
    if (this.at(r - dr, c - dc) !== null || this.at(endR + dr, endC + dc) !== null) return -1;
    const minR = Math.min(this.minR, r);
    const maxR = Math.max(this.maxR, endR);
    const minC = Math.min(this.minC, c);
    const maxC = Math.max(this.maxC, endC);
    if (maxR - minR + 1 > maxH || maxC - minC + 1 > maxW) return -1;
    let crossings = 0;
    for (let i = 0; i < len; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const k = rr * CANVAS + cc;
      const existing = this.letters[k] ?? null;
      if (existing !== null) {
        if (existing !== word[i]) return -1;
        if ((dir === 'across' ? this.across[k] : this.down[k]) === 1) return -1;
        crossings++;
      } else if (dir === 'across') {
        if (this.at(rr - 1, cc) !== null || this.at(rr + 1, cc) !== null) return -1;
      } else if (this.at(rr, cc - 1) !== null || this.at(rr, cc + 1) !== null) {
        return -1;
      }
    }
    if (this.maxR >= 0 && (crossings === 0 || crossings === len)) return -1;
    return crossings;
  }

  place(word: string, r: number, c: number, dir: Dir): void {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    for (let i = 0; i < word.length; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const k = rr * CANVAS + cc;
      const ch = word[i] as string;
      if (this.letters[k] === null) {
        this.letters[k] = ch;
        const list = this.byLetter.get(ch);
        if (list) list.push(k);
        else this.byLetter.set(ch, [k]);
      }
      if (dir === 'across') this.across[k] = 1;
      else this.down[k] = 1;
      this.minR = Math.min(this.minR, rr);
      this.maxR = Math.max(this.maxR, rr);
      this.minC = Math.min(this.minC, cc);
      this.maxC = Math.max(this.maxC, cc);
    }
  }

  area(): number {
    return (this.maxR - this.minR + 1) * (this.maxC - this.minC + 1);
  }
}

interface Placement {
  word: string;
  row: number;
  col: number;
  dir: Dir;
  score: number;
}

function bestPlacementFor(canvas: Canvas, word: string, rng: Rng, maxW: number, maxH: number): Placement | null {
  let best: Placement | null = null;
  const seen = new Set<number>();
  const area = canvas.area();
  for (let i = 0; i < word.length; i++) {
    const cells = canvas.byLetter.get(word[i] as string);
    if (!cells) continue;
    for (const k of cells) {
      const hasAcross = canvas.across[k] === 1;
      const hasDown = canvas.down[k] === 1;
      if (hasAcross && hasDown) continue;
      const dir: Dir = hasAcross ? 'down' : 'across';
      const r0 = Math.floor(k / CANVAS);
      const c0 = k % CANVAS;
      const row = dir === 'down' ? r0 - i : r0;
      const col = dir === 'across' ? c0 - i : c0;
      const key = (row * CANVAS + col) * 2 + (dir === 'down' ? 1 : 0);
      if (seen.has(key)) continue;
      seen.add(key);
      const crossings = canvas.check(word, row, col, dir, maxW, maxH);
      if (crossings < 1) continue;
      const endR = row + (dir === 'down' ? word.length - 1 : 0);
      const endC = col + (dir === 'across' ? word.length - 1 : 0);
      const newArea =
        (Math.max(canvas.maxR, endR) - Math.min(canvas.minR, row) + 1) * (Math.max(canvas.maxC, endC) - Math.min(canvas.minC, col) + 1);
      const score = crossings * 25 + word.length * 2 - (newArea - area) * 0.35 + rng.next() * 4;
      if (!best || score > best.score) best = { word, row, col, dir, score };
    }
  }
  return best;
}

function attempt(words: readonly string[], rng: Rng, opts: Required<GenerateOptions>): Canvas & { placed: LayoutWord[] } {
  const canvas = new Canvas() as Canvas & { placed: LayoutWord[] };
  canvas.placed = [];
  const order = rng.shuffle(words);
  const target = rng.int(Math.min(opts.maxWords, opts.minWords + 2), opts.maxWords - 1);
  const used = new Set<string>();

  const first = order.find((w) => w.length >= 5 && w.length <= Math.min(8, opts.maxWidth, opts.maxHeight)) ?? order[0];
  if (!first) return canvas;
  const firstDir: Dir = rng.bool() ? 'across' : 'down';
  const mid = Math.floor(CANVAS / 2);
  const start = mid - Math.floor(first.length / 2);
  const r = firstDir === 'across' ? mid : start;
  const c = firstDir === 'across' ? start : mid;
  canvas.place(first, r, c, firstDir);
  canvas.placed.push({ answer: first, dir: firstDir, row: r, col: c });
  used.add(first);

  while (canvas.placed.length < target) {
    let best: Placement | null = null;
    let found = 0;
    for (const word of order) {
      if (used.has(word)) continue;
      const p = bestPlacementFor(canvas, word, rng, opts.maxWidth, opts.maxHeight);
      if (!p) continue;
      if (!best || p.score > best.score) best = p;
      if (++found >= CANDIDATES_PER_STEP) break;
    }
    if (!best) break;
    canvas.place(best.word, best.row, best.col, best.dir);
    canvas.placed.push({ answer: best.word, dir: best.dir, row: best.row, col: best.col });
    used.add(best.word);
  }
  return canvas;
}

/** Clue numbers in reading order: squares that start an across and/or down word, row by row. */
export function numberWords(words: ReadonlyArray<{ row: number; col: number }>): number[] {
  const starts = [...new Set(words.map((w) => w.row * 1000 + w.col))].sort((a, b) => a - b);
  const numberOf = new Map(starts.map((s, i) => [s, i + 1]));
  return words.map((w) => numberOf.get(w.row * 1000 + w.col) ?? 0);
}

/**
 * Builds a criss-cross layout from a list of answers. Returns null only when no layout with at
 * least `minWords` words could be found (which does not happen with the shipped word banks).
 */
export function generateLayout(answers: readonly string[], seed: number, options: GenerateOptions = {}): Layout | null {
  const opts: Required<GenerateOptions> = {
    maxWidth: options.maxWidth ?? MAX_SIZE,
    maxHeight: options.maxHeight ?? MAX_SIZE,
    minWords: options.minWords ?? MIN_WORDS,
    maxWords: options.maxWords ?? MAX_WORDS,
  };
  const pool = [...new Set(answers)].filter((w) => w.length >= MIN_LEN && w.length <= Math.min(MAX_LEN, Math.max(opts.maxWidth, opts.maxHeight)));
  const rng = new Rng(seed);
  for (let i = 0; i < ATTEMPTS; i++) {
    const canvas = attempt(pool, rng, opts);
    if (canvas.placed.length >= opts.minWords) {
      const words = canvas.placed.map((w) => ({ ...w, row: w.row - canvas.minR, col: w.col - canvas.minC }));
      return { width: canvas.maxC - canvas.minC + 1, height: canvas.maxR - canvas.minR + 1, words };
    }
  }
  return null;
}
