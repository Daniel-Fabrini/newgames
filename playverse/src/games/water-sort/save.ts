import { v, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import { CAPACITY, isSolved, isWellFormed, pour, sameBottles, type LevelState, type Move } from './engine';
import { MAX_BOTTLES, MAX_COLOURS } from './levels';

/** In-progress level as saved: the level state plus the stopwatch. */
export interface SavedWaterSort {
  level: number;
  initial: number[][];
  par: number;
  bottles: number[][];
  history: Move[];
  hintsUsed: number;
  elapsedMs: number;
}

export const HISTORY_LIMIT = 5000;
const MAX_SAVED_BOTTLES = MAX_BOTTLES + 2;

const colour = v.int({ min: 0, max: MAX_COLOURS - 1 });
const bottle = v.array(colour, { maxLength: CAPACITY });
const bottles = v.array(bottle, { minLength: 2, maxLength: MAX_SAVED_BOTTLES });

const move: Validator<Move> = v.object({
  from: v.int({ min: 0, max: MAX_SAVED_BOTTLES - 1 }),
  to: v.int({ min: 0, max: MAX_SAVED_BOTTLES - 1 }),
  amount: v.int({ min: 1, max: CAPACITY }),
  colour,
});

/** Replays the history from the start position: every pour must be legal and match the record. */
function consistent(s: SavedWaterSort): boolean | string {
  if (!isWellFormed(s.initial, MAX_COLOURS)) return 'malformed start position';
  if (s.bottles.length !== s.initial.length) return 'bottle count changed';
  if (isSolved(s.initial)) return 'start position already solved';
  let current: number[][] = s.initial.map((b) => b.slice());
  for (const m of s.history) {
    const res = pour(current, m.from, m.to);
    if (!res || res.move.amount !== m.amount || res.move.colour !== m.colour) return 'history does not replay';
    current = res.bottles;
  }
  if (!sameBottles(current, s.bottles)) return 'bottles do not match the history';
  if (isSolved(s.bottles)) return 'finished levels are not resumed';
  return true;
}

export const saveValidator: Validator<SavedWaterSort> = v.refine(
  v.object({
    level: v.int({ min: 1 }),
    initial: bottles,
    par: v.int({ min: 1, max: 1000 }),
    bottles,
    history: v.array(move, { maxLength: HISTORY_LIMIT }),
    hintsUsed: v.int({ min: 0 }),
    elapsedMs: v.number({ min: 0 }),
  }),
  consistent,
);

export const saveSpec: SaveSpec<SavedWaterSort> = {
  gameId: 'water-sort',
  version: 1,
  validate: saveValidator,
};

export function toSave(state: LevelState, elapsedMs: number): SavedWaterSort {
  return {
    level: state.level,
    initial: state.initial,
    par: state.par,
    bottles: state.bottles,
    history: state.history,
    hintsUsed: state.hintsUsed,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
  };
}

export function fromSave(saved: SavedWaterSort): LevelState {
  return {
    level: saved.level,
    initial: saved.initial.map((b) => b.slice()),
    par: saved.par,
    bottles: saved.bottles.map((b) => b.slice()),
    history: saved.history.map((m) => ({ ...m })),
    hintsUsed: saved.hintsUsed,
    won: false,
  };
}

/* ───────────── Small preference: show symbols on the liquids ───────────── */

export interface WaterSortPrefs {
  symbols: boolean;
}

export const PREFS_KEY = 'prefs:water-sort';
export const PREFS_VERSION = 1;
export const defaultPrefs: WaterSortPrefs = { symbols: true };
export const prefsValidator: Validator<WaterSortPrefs> = v.object({ symbols: v.withDefault(v.boolean(), true) });
