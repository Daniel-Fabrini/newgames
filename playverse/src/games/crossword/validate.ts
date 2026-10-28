import { MAX_SIZE, MIN_LEN, numberWords } from './layout';
import { isValidAnswer } from './normalize';
import type { BankEntry, Dir, PuzzleLang } from './types';

export interface CheckableWord {
  number: number;
  dir: Dir;
  row: number;
  col: number;
  answer: string;
  clue?: string;
}

export interface CheckablePuzzle {
  width: number;
  height: number;
  words: readonly CheckableWord[];
}

export interface ValidateOptions {
  lang: PuzzleLang;
  /** When given, every answer must exist in the bank with exactly its clue. */
  bank?: ReadonlyMap<string, BankEntry>;
  /** Expected drawing of the solved grid (`.` = empty square). */
  rows?: readonly string[];
  minWords?: number;
  maxWords?: number;
}

const runKey = (dir: Dir, row: number, col: number, len: number) => `${dir}:${row}:${col}:${len}`;

/**
 * Strict puzzle validator. It rebuilds the grid from the word list and returns every problem it
 * finds (an empty list means the puzzle is valid):
 * - size within MAX_SIZE, words inside the grid, allowed letters only, no repeated answers;
 * - every crossing square holds the same letter for both words;
 * - every horizontal/vertical run of two or more letters is exactly one listed word (so no words
 *   run side by side and no word touches another word's ends);
 * - every word crosses another word and the grid is connected, with no empty margin rows/columns;
 * - clue numbers follow reading order of the start squares (shared by across/down when needed);
 * - optionally, every answer exists in the bank with its clue and the grid matches a drawing.
 */
export function validatePuzzle(puzzle: CheckablePuzzle, options: ValidateOptions): string[] {
  const errors: string[] = [];
  const { width, height, words } = puzzle;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_SIZE || height > MAX_SIZE) {
    return [`invalid size ${width}×${height}`];
  }
  if (options.minWords !== undefined && words.length < options.minWords) errors.push(`too few words (${words.length})`);
  if (options.maxWords !== undefined && words.length > options.maxWords) errors.push(`too many words (${words.length})`);

  const grid: (string | null)[] = new Array<string | null>(width * height).fill(null);
  const owners: number[][] = Array.from({ length: width * height }, () => []);
  const answers = new Set<string>();

  words.forEach((w, idx) => {
    const label = `${w.number}-${w.dir}`;
    if (w.dir !== 'across' && w.dir !== 'down') {
      errors.push(`${label}: invalid direction`);
      return;
    }
    if (w.answer.length < MIN_LEN) errors.push(`${label}: answer too short`);
    if (!isValidAnswer(w.answer, options.lang)) errors.push(`${label}: invalid letters in "${w.answer}"`);
    if (answers.has(w.answer)) errors.push(`${label}: repeated answer "${w.answer}"`);
    answers.add(w.answer);
    for (let i = 0; i < w.answer.length; i++) {
      const r = w.row + (w.dir === 'down' ? i : 0);
      const c = w.col + (w.dir === 'across' ? i : 0);
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= height || c >= width) {
        errors.push(`${label}: outside the grid`);
        return;
      }
      const k = r * width + c;
      const ch = w.answer[i] as string;
      const existing = grid[k];
      if (existing !== null && existing !== undefined && existing !== ch) errors.push(`${label}: crossing mismatch at ${r},${c} (${existing}/${ch})`);
      else grid[k] = ch;
      for (const other of owners[k] ?? []) {
        if (words[other]?.dir === w.dir) errors.push(`${label}: overlaps ${words[other]?.number}-${w.dir}`);
      }
      owners[k]?.push(idx);
    }
  });
  if (errors.length > 0) return errors;

  // Every run of 2+ letters must be exactly one listed word, and every word must be such a run.
  const wordRuns = new Set(words.map((w) => runKey(w.dir, w.row, w.col, w.answer.length)));
  const runs = new Set<string>();
  const filled = (r: number, c: number) => r >= 0 && c >= 0 && r < height && c < width && grid[r * width + c] !== null;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (filled(r, c) && !filled(r, c - 1)) {
        let len = 0;
        while (filled(r, c + len)) len++;
        if (len >= 2) runs.add(runKey('across', r, c, len));
      }
      if (filled(r, c) && !filled(r - 1, c)) {
        let len = 0;
        while (filled(r + len, c)) len++;
        if (len >= 2) runs.add(runKey('down', r, c, len));
      }
    }
  }
  for (const run of runs) if (!wordRuns.has(run)) errors.push(`illegal adjacency: letters ${run} do not form a listed word`);
  for (const w of words) {
    if (!runs.has(runKey(w.dir, w.row, w.col, w.answer.length))) errors.push(`${w.number}-${w.dir}: touches another word`);
  }

  // Crossings and connectivity (union–find over words sharing a square).
  const parent = words.map((_, i) => i);
  const find = (i: number): number => {
    let x = i;
    while (parent[x] !== x) x = parent[x] as number;
    return x;
  };
  const crossed = new Array<boolean>(words.length).fill(false);
  for (const list of owners) {
    if (list.length < 2) continue;
    for (const i of list) crossed[i] = true;
    const [a, b] = list as [number, number];
    parent[find(a)] = find(b);
  }
  words.forEach((w, i) => {
    if (!crossed[i] && words.length > 1) errors.push(`${w.number}-${w.dir}: does not cross any word`);
  });
  if (words.length > 0 && new Set(words.map((_, i) => find(i))).size !== 1) errors.push('grid is not connected');

  // No empty margins.
  for (let r = 0; r < height; r++) if (!grid.slice(r * width, (r + 1) * width).some((x) => x !== null)) errors.push(`row ${r} is empty`);
  for (let c = 0; c < width; c++) {
    let any = false;
    for (let r = 0; r < height; r++) if (grid[r * width + c] !== null) any = true;
    if (!any) errors.push(`column ${c} is empty`);
  }

  // Numbering in reading order.
  const expected = numberWords(words);
  words.forEach((w, i) => {
    if (w.number !== expected[i]) errors.push(`${w.number}-${w.dir}: expected number ${expected[i]}`);
  });

  if (options.bank) {
    for (const w of words) {
      const entry = options.bank.get(w.answer);
      if (!entry) errors.push(`${w.number}-${w.dir}: "${w.answer}" is not in the word bank`);
      else if (w.clue !== entry.clue) errors.push(`${w.number}-${w.dir}: clue does not match the word bank`);
    }
  }

  if (options.rows) {
    const rows = options.rows;
    if (rows.length !== height || rows.some((row) => [...row].length !== width)) errors.push('drawing does not match the grid size');
    else {
      for (let r = 0; r < height; r++) {
        const chars = [...(rows[r] as string)];
        for (let c = 0; c < width; c++) {
          const drawn = chars[c] === '.' ? null : (chars[c] ?? null);
          const actual = grid[r * width + c] ?? null;
          if (drawn !== null && actual === null) errors.push(`square ${r},${c} belongs to no word`);
          else if (drawn !== actual) errors.push(`drawing differs at ${r},${c}`);
        }
      }
    }
  }
  return errors;
}
