import { v, type Validator } from '../../services/storage/schema';
import { readValue, writeValue } from '../../services/storage/storage';
import type { SaveSpec } from '../../services/saves';
import { isSolved, type GridModel, type Mark, type PlayState } from './engine';
import { LETTERS } from './normalize';
import { isPuzzleId } from './puzzles';
import type { PuzzleLang } from './types';

/** Puzzles kept in progress at the same time (least recently played are dropped first). */
export const MAX_IN_PROGRESS = 10;
/** Solved-puzzle records kept for the puzzle list. */
export const MAX_SOLVED = 200;
const MAX_CELLS = 11 * 11;

/** One puzzle in progress, stored compactly: one character per square. */
export interface SavedPuzzle {
  id: string;
  /** Letters, `.` for an empty or black square. */
  entries: string;
  /** `-` none, `x` wrong, `v` checked right, `r` revealed. */
  marks: string;
  checks: number;
  wrongFound: number;
  elapsedMs: number;
  updatedAt: number;
}

export interface SavedCrossword {
  /** Puzzle on screen when the game was left (null once it was solved). */
  currentId: string | null;
  /** In-progress puzzles, most recent first. */
  puzzles: SavedPuzzle[];
}

const ALL_LETTERS = new Set([...LETTERS.es]);

const savedPuzzle: Validator<SavedPuzzle> = v.refine(
  v.object({
    id: v.refine(v.string({ maxLength: 24 }), (id) => isPuzzleId(id) || 'unknown puzzle id'),
    entries: v.string({ maxLength: MAX_CELLS }),
    marks: v.string({ maxLength: MAX_CELLS }),
    checks: v.int({ min: 0, max: 100_000 }),
    wrongFound: v.int({ min: 0, max: 100_000 }),
    elapsedMs: v.number({ min: 0, max: 1000 * 60 * 60 * 24 * 30 }),
    updatedAt: v.number({ min: 0 }),
  }),
  (p) => {
    if (p.entries.length !== p.marks.length) return 'entries and marks differ in length';
    if (![...p.entries].every((ch) => ch === '.' || ALL_LETTERS.has(ch))) return 'invalid letters';
    if (!/^[-xvr]*$/.test(p.marks)) return 'invalid marks';
    return true;
  },
);

export const saveSpec: SaveSpec<SavedCrossword> = {
  gameId: 'crossword',
  version: 1,
  validate: v.refine(
    v.object({
      currentId: v.nullable(v.refine(v.string({ maxLength: 24 }), (id) => isPuzzleId(id) || 'unknown puzzle id')),
      puzzles: v.array(savedPuzzle, { maxLength: MAX_IN_PROGRESS }),
    }),
    (s) => new Set(s.puzzles.map((p) => p.id)).size === s.puzzles.length || 'duplicated puzzle',
  ),
};

const MARK_TO_CHAR: Record<Mark, string> = { '': '-', wrong: 'x', ok: 'v', revealed: 'r' };
const CHAR_TO_MARK: Record<string, Mark> = { '-': '', x: 'wrong', v: 'ok', r: 'revealed' };

export function serializePlay(id: string, play: PlayState, elapsedMs: number, updatedAt: number): SavedPuzzle {
  return {
    id,
    entries: play.entries.map((e) => e || '.').join(''),
    marks: play.marks.map((m) => MARK_TO_CHAR[m]).join(''),
    checks: play.checks,
    wrongFound: play.wrongFound,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    updatedAt,
  };
}

/**
 * Rebuilds a play state for a puzzle, checking it against the grid: size, letters of the puzzle
 * language, nothing written on black squares, and locked squares holding the solution. Returns
 * null when the save does not belong to this grid or the puzzle is already solved.
 */
export function restorePlay(model: GridModel, saved: SavedPuzzle): PlayState | null {
  const size = model.width * model.height;
  const letters = [...saved.entries];
  const markChars = [...saved.marks];
  if (saved.id !== model.puzzle.id || letters.length !== size || markChars.length !== size) return null;
  const allowed = LETTERS[model.puzzle.lang];
  const entries: string[] = [];
  const marks: Mark[] = [];
  for (let i = 0; i < size; i++) {
    const cell = model.cells[i];
    const ch = letters[i] as string;
    const mark = CHAR_TO_MARK[markChars[i] as string] ?? '';
    if (!cell) {
      if (ch !== '.' || mark !== '') return null;
    } else {
      if (ch !== '.' && !allowed.includes(ch)) return null;
      if ((mark === 'ok' || mark === 'revealed') && ch !== cell.solution) return null;
      if (mark === 'wrong' && (ch === '.' || ch === cell.solution)) return null;
    }
    entries.push(ch === '.' ? '' : ch);
    marks.push(mark);
  }
  const play: PlayState = { entries, marks, checks: saved.checks, wrongFound: saved.wrongFound, completed: false };
  return isSolved(play, model) ? null : play;
}

// ───────────── Preferences and solved list (small values, own storage key) ─────────────

export type KeyboardPref = 'auto' | 'on' | 'off';

export interface SolvedRecord {
  stars: number;
  bestTimeMs: number;
  bestAccuracy: number;
  at: number;
}

export interface CrosswordPrefs {
  /** Next generated grid number per language for "New grid". */
  next: Record<PuzzleLang, number>;
  keyboard: KeyboardPref;
  skipFilled: boolean;
  solved: Record<string, SolvedRecord>;
}

export const PREFS_KEY = 'crossword:prefs';

export const defaultPrefs = (): CrosswordPrefs => ({ next: { pt: 1, en: 1, es: 1 }, keyboard: 'auto', skipFilled: true, solved: {} });

const solvedRecord: Validator<SolvedRecord> = v.object({
  stars: v.int({ min: 1, max: 3 }),
  bestTimeMs: v.number({ min: 0 }),
  bestAccuracy: v.number({ min: 0, max: 1 }),
  at: v.number({ min: 0 }),
});

const nextNumber = v.int({ min: 1, max: 9_999_999 });

export const prefsValidator: Validator<CrosswordPrefs> = v.object({
  next: v.withDefault(v.object({ pt: nextNumber, en: nextNumber, es: nextNumber }), { pt: 1, en: 1, es: 1 }),
  keyboard: v.withDefault(v.literal('auto', 'on', 'off'), 'auto'),
  skipFilled: v.withDefault(v.boolean(), true),
  solved: v.withDefault(
    v.refine(v.record(solvedRecord, { dropInvalid: true }), (r) => Object.keys(r).every(isPuzzleId) || 'unknown puzzle id'),
    {},
  ),
});

export function loadPrefs(): CrosswordPrefs {
  return readValue(PREFS_KEY, { validate: prefsValidator, version: 1 }, defaultPrefs());
}

export function savePrefs(prefs: CrosswordPrefs): void {
  writeValue(PREFS_KEY, prefs, 1);
}

/** Adds a solved result, keeping the best time/accuracy/stars and the most recent MAX_SOLVED ids. */
export function withSolved(prefs: CrosswordPrefs, id: string, result: { stars: number; timeMs: number; accuracy: number }, at: number): CrosswordPrefs {
  const before = prefs.solved[id];
  const record: SolvedRecord = {
    stars: Math.max(before?.stars ?? 1, result.stars),
    bestTimeMs: Math.min(before?.bestTimeMs ?? Infinity, Math.round(result.timeMs)),
    bestAccuracy: Math.max(before?.bestAccuracy ?? 0, result.accuracy),
    at,
  };
  const entries = Object.entries({ ...prefs.solved, [id]: record })
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_SOLVED);
  return { ...prefs, solved: Object.fromEntries(entries) };
}

/** Puts `entry` first in the in-progress list (replacing the same id) and applies the cap. */
export function upsertInProgress(list: readonly SavedPuzzle[], entry: SavedPuzzle): SavedPuzzle[] {
  return [entry, ...list.filter((p) => p.id !== entry.id)].slice(0, MAX_IN_PROGRESS);
}
