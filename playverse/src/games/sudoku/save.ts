import { v, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import { CELLS, isCompleteSolution } from './grid';
import { DIFFICULTIES } from './generator';
import { HINT_LIMIT, MAX_CHANGES, UNDO_LIMIT, type CellChange, type HistoryEntry, type SudokuState } from './engine';
import { countSolutions, solve } from './solver';

const cellIndex = v.int({ min: 0, max: CELLS - 1 });
const digitOrEmpty = v.int({ min: 0, max: 9 });
const noteMask = v.int({ min: 0, max: 0x1ff });

const change: Validator<CellChange> = v.object({ cell: cellIndex, value: digitOrEmpty, notes: noteMask });
const historyEntry: Validator<HistoryEntry> = v.object({ changes: v.array(change, { minLength: 1, maxLength: MAX_CHANGES }) });

const distinct = (cells: readonly number[]) => new Set(cells).size === cells.length;

/**
 * Semantic checks on top of the structure:
 * - the solution is a complete valid grid and the givens are consistent with it;
 * - the givens have exactly one solution, which is the stored one;
 * - givens are kept in `values`, filled cells have no notes;
 * - hinted cells are non-given and hold the correct digit; flagged cells hold a wrong digit;
 * - undo history never touches a given cell.
 */
export function checkState(s: SudokuState): true | string {
  if (!isCompleteSolution(s.solution)) return 'solution is not a valid grid';
  for (let i = 0; i < CELLS; i++) {
    const g = s.givens[i]!;
    if (g !== 0 && g !== s.solution[i]) return `given ${i} contradicts the solution`;
    if (g !== 0 && s.values[i] !== g) return `given ${i} was changed`;
    if (s.values[i] !== 0 && s.notes[i] !== 0) return `filled cell ${i} has notes`;
  }
  if (!distinct(s.hinted) || s.hinted.some((c) => s.givens[c] !== 0 || s.values[c] !== s.solution[c])) return 'invalid hinted cells';
  if (s.hintsUsed < s.hinted.length) return 'hint counter below hinted cells';
  if (!distinct(s.flagged) || s.flagged.some((c) => s.givens[c] !== 0 || s.values[c] === 0 || s.values[c] === s.solution[c])) return 'invalid flagged cells';
  if (s.history.some((h) => h.changes.some((c) => s.givens[c.cell] !== 0))) return 'history touches a given';
  if (countSolutions(s.givens, 2) !== 1) return 'puzzle does not have a unique solution';
  const solved = solve(s.givens);
  if (!solved || solved.some((d, i) => d !== s.solution[i])) return 'stored solution does not match the puzzle';
  return true;
}

export const stateValidator: Validator<SudokuState> = v.refine(
  v.object({
    difficulty: v.literal(...DIFFICULTIES),
    seed: v.int({ min: 0, max: 0xffffffff }),
    givens: v.array(digitOrEmpty, { length: CELLS }),
    solution: v.array(v.int({ min: 1, max: 9 }), { length: CELLS }),
    values: v.array(digitOrEmpty, { length: CELLS }),
    notes: v.array(noteMask, { length: CELLS }),
    hinted: v.array(cellIndex, { maxLength: HINT_LIMIT }),
    flagged: v.array(cellIndex, { maxLength: CELLS }),
    mistakes: v.int({ min: 0, max: 100_000 }),
    hintsUsed: v.int({ min: 0, max: HINT_LIMIT }),
    history: v.array(historyEntry, { maxLength: UNDO_LIMIT }),
    solved: v.boolean(),
  }),
  checkState,
);

export interface SavedSudoku {
  game: SudokuState;
  elapsedMs: number;
}

export const saveValidator: Validator<SavedSudoku> = v.refine(
  v.object({ game: stateValidator, elapsedMs: v.number({ min: 0, max: 1000 * 60 * 60 * 24 * 30 }) }),
  (s) => !s.game.solved || 'finished games are not resumed',
);

export const saveSpec: SaveSpec<SavedSudoku> = {
  gameId: 'sudoku',
  version: 1,
  validate: saveValidator,
};
