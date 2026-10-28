/** Shared crossword types (pure data, no React). */
export type PuzzleLang = 'pt' | 'en' | 'es';
export const PUZZLE_LANGS: readonly PuzzleLang[] = ['pt', 'en', 'es'];

export type Dir = 'across' | 'down';

/** One word of a language's word bank. */
export interface BankEntry {
  /** Normalised answer: uppercase A–Z (plus Ñ in Spanish), no accents, no spaces. */
  answer: string;
  /** Natural spelling shown once the word is solved (e.g. "coração"). */
  display: string;
  clue: string;
}

/** A word placed on the grid. Rows/columns are 0-based; `number` is the printed clue number. */
export interface PlacedWord {
  number: number;
  dir: Dir;
  row: number;
  col: number;
  answer: string;
  clue: string;
  display: string;
}

export interface Puzzle {
  /** `pt-preset-1`, `en-42`… */
  id: string;
  lang: PuzzleLang;
  kind: 'preset' | 'generated';
  /** Preset number (1-based) or generated sequence number (1-based). */
  n: number;
  width: number;
  height: number;
  words: PlacedWord[];
}

/** Hand-written preset: explicit positions and clues plus a drawing of the solved grid. */
export interface PresetSpec {
  /** Solved grid, one string per row, `.` for empty squares. */
  rows: readonly string[];
  words: ReadonlyArray<{ number: number; dir: Dir; row: number; col: number; answer: string; clue: string }>;
}
