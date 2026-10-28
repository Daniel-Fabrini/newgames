import { CELLS, PEERS, bit, digitCounts, findConflicts, popcount } from './grid';
import type { Difficulty } from './generator';
import { applyStep, createBoard, nextStep, type TechniqueId } from './logic';

/**
 * Sudoku game rules (pure, UI independent).
 *
 * - 9×9 grid; every row, column and 3×3 box must contain 1–9 exactly once.
 * - Given cells are locked. Cells revealed by a hint are locked too (their value is correct).
 * - Placing a digit replaces the cell's notes. When "auto notes" is on (default), the digit is
 *   also removed from the notes of every peer (same row, column or box); undo restores them.
 * - Mistakes (a digit that differs from the unique solution) are counted:
 *   - "immediate" mode: when the digit is placed (and shown at once);
 *   - "onCheck" mode: only when the player asks for a check; every wrong cell found by a check
 *     counts once and stays flagged until it is changed.
 * - Conflicts (the same digit twice in a row, column or box) are always reported: they are visible
 *   on the board anyway and do not reveal the solution.
 * - Hints are limited (HINT_LIMIT per puzzle). See `findHint` for how the cell is chosen.
 * - Undo reverts the last placement, note or erase (mistakes and hints are not refunded).
 * - The puzzle is solved when the grid equals the (unique) solution.
 */
export const HINT_LIMIT = 3;
export const UNDO_LIMIT = 200;
/** A history entry touches at most the cell and its 20 peers. */
export const MAX_CHANGES = 21;

export type ErrorMode = 'immediate' | 'onCheck';

export interface PlayOptions {
  autoNotes: boolean;
  errorMode: ErrorMode;
}

export const DEFAULT_OPTIONS: PlayOptions = { autoNotes: true, errorMode: 'immediate' };

/** Previous content of a cell, recorded for undo. */
export interface CellChange {
  cell: number;
  value: number;
  notes: number;
}

export interface HistoryEntry {
  changes: CellChange[];
}

export interface SudokuState {
  difficulty: Difficulty;
  /** Seed the puzzle was generated from (for reference / reproduction). */
  seed: number;
  givens: number[];
  solution: number[];
  values: number[];
  /** Pencil marks as 9-bit masks (bit d − 1 for digit d). */
  notes: number[];
  /** Cells revealed by hints (locked). */
  hinted: number[];
  /** Cells flagged as wrong by the last check (onCheck mode). */
  flagged: number[];
  mistakes: number;
  hintsUsed: number;
  history: HistoryEntry[];
  solved: boolean;
}

export interface NewGameInput {
  puzzle: readonly number[];
  solution: readonly number[];
  difficulty: Difficulty;
  seed: number;
}

export function newGame({ puzzle, solution, difficulty, seed }: NewGameInput): SudokuState {
  return {
    difficulty,
    seed: seed >>> 0,
    givens: puzzle.slice(),
    solution: solution.slice(),
    values: puzzle.slice(),
    notes: Array<number>(CELLS).fill(0),
    hinted: [],
    flagged: [],
    mistakes: 0,
    hintsUsed: 0,
    history: [],
    solved: false,
  };
}

export const isGiven = (s: SudokuState, cell: number): boolean => s.givens[cell] !== 0;

/** Given or revealed by a hint: the player cannot change it. */
export const isLocked = (s: SudokuState, cell: number): boolean => isGiven(s, cell) || s.hinted.includes(cell);

export const isComplete = (values: readonly number[], solution: readonly number[]): boolean => values.every((v, i) => v === solution[i]);

/** True when the player has done anything worth keeping (entries, notes, hints or mistakes). */
export function hasProgress(s: SudokuState): boolean {
  if (s.hintsUsed > 0 || s.mistakes > 0) return true;
  for (let i = 0; i < CELLS; i++) if (s.values[i] !== s.givens[i] || s.notes[i] !== 0) return true;
  return false;
}

export const hintsLeft = (s: SudokuState): number => Math.max(0, HINT_LIMIT - s.hintsUsed);

export const canUndo = (s: SudokuState): boolean => !s.solved && s.history.length > 0;

/** Wrong digits currently on the board (player entries that differ from the solution). */
export function wrongCells(s: SudokuState): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (s.values[i] !== 0 && s.givens[i] === 0 && s.values[i] !== s.solution[i]) out.push(i);
  return out;
}

/** Cells to display as mistakes for the chosen error mode. */
export function visibleErrors(s: SudokuState, mode: ErrorMode): boolean[] {
  const out = Array<boolean>(CELLS).fill(false);
  const cells = mode === 'immediate' ? wrongCells(s) : s.flagged;
  for (const c of cells) out[c] = true;
  return out;
}

export const conflicts = (s: SudokuState): boolean[] => findConflicts(s.values);

/** How many of each digit (1–9) are on the board. Index 0 is unused. */
export const placedCounts = (s: SudokuState): number[] => digitCounts(s.values);

function record(s: SudokuState, changes: CellChange[]): HistoryEntry[] {
  return [...s.history, { changes }].slice(-UNDO_LIMIT);
}

/** Changes for clearing `digit` from the notes of the cell's peers. */
function peerNoteChanges(s: SudokuState, cell: number, digit: number): CellChange[] {
  const m = bit(digit);
  const out: CellChange[] = [];
  for (const p of PEERS[cell]!) if (s.values[p] === 0 && s.notes[p]! & m) out.push({ cell: p, value: s.values[p]!, notes: s.notes[p]! });
  return out;
}

export type PlaceStatus = 'ignored' | 'placed' | 'wrong' | 'solved';

export interface PlaceResult {
  state: SudokuState;
  status: PlaceStatus;
}

export function placeDigit(s: SudokuState, cell: number, digit: number, opts: PlayOptions = DEFAULT_OPTIONS): PlaceResult {
  if (s.solved || cell < 0 || cell >= CELLS || !Number.isInteger(digit) || digit < 1 || digit > 9) return { state: s, status: 'ignored' };
  if (isLocked(s, cell) || s.values[cell] === digit) return { state: s, status: 'ignored' };
  const changes: CellChange[] = [{ cell, value: s.values[cell]!, notes: s.notes[cell]! }];
  const values = s.values.slice();
  const notes = s.notes.slice();
  values[cell] = digit;
  notes[cell] = 0;
  if (opts.autoNotes) {
    for (const ch of peerNoteChanges(s, cell, digit)) {
      changes.push(ch);
      notes[ch.cell] = notes[ch.cell]! & ~bit(digit);
    }
  }
  const wrong = digit !== s.solution[cell];
  const counted = wrong && opts.errorMode === 'immediate';
  const solved = isComplete(values, s.solution);
  const state: SudokuState = {
    ...s,
    values,
    notes,
    flagged: s.flagged.filter((c) => c !== cell),
    mistakes: s.mistakes + (counted ? 1 : 0),
    history: record(s, changes),
    solved,
  };
  return { state, status: solved ? 'solved' : counted ? 'wrong' : 'placed' };
}

/** Toggles a pencil mark. Only empty, unlocked cells take notes. */
export function toggleNote(s: SudokuState, cell: number, digit: number): SudokuState {
  if (s.solved || cell < 0 || cell >= CELLS || digit < 1 || digit > 9 || isLocked(s, cell) || s.values[cell] !== 0) return s;
  const notes = s.notes.slice();
  notes[cell] = notes[cell]! ^ bit(digit);
  return { ...s, notes, history: record(s, [{ cell, value: 0, notes: s.notes[cell]! }]) };
}

/** Clears the player's digit, or the notes when the cell has no digit. */
export function erase(s: SudokuState, cell: number): SudokuState {
  if (s.solved || cell < 0 || cell >= CELLS || isLocked(s, cell)) return s;
  if (s.values[cell] === 0 && s.notes[cell] === 0) return s;
  const values = s.values.slice();
  const notes = s.notes.slice();
  values[cell] = 0;
  notes[cell] = 0;
  return {
    ...s,
    values,
    notes,
    flagged: s.flagged.filter((c) => c !== cell),
    history: record(s, [{ cell, value: s.values[cell]!, notes: s.notes[cell]! }]),
  };
}

/** Reverts the last action. Cells locked since then (hints) are left untouched. */
export function undo(s: SudokuState): SudokuState {
  const entry = s.history[s.history.length - 1];
  if (!entry || s.solved) return s;
  const values = s.values.slice();
  const notes = s.notes.slice();
  const touched = new Set<number>();
  for (const ch of entry.changes) {
    if (isLocked(s, ch.cell)) continue;
    values[ch.cell] = ch.value;
    notes[ch.cell] = ch.notes;
    touched.add(ch.cell);
  }
  return { ...s, values, notes, flagged: s.flagged.filter((c) => !touched.has(c)), history: s.history.slice(0, -1) };
}

/** Clears every entry, note and hint, and resets the counters (same puzzle). */
export function restart(s: SudokuState): SudokuState {
  return {
    ...s,
    values: s.givens.slice(),
    notes: Array<number>(CELLS).fill(0),
    hinted: [],
    flagged: [],
    mistakes: 0,
    hintsUsed: 0,
    history: [],
    solved: false,
  };
}

export interface CheckResult {
  state: SudokuState;
  /** Wrong cells currently on the board. */
  wrong: number;
  /** Wrong cells not flagged by a previous check (added to the mistakes counter). */
  newlyFound: number;
}

/** "Check" for onCheck mode: flags wrong cells and counts the ones not flagged before. */
export function checkBoard(s: SudokuState): CheckResult {
  const wrong = wrongCells(s);
  const newly = wrong.filter((c) => !s.flagged.includes(c));
  return { state: { ...s, flagged: wrong, mistakes: s.mistakes + newly.length }, wrong: wrong.length, newlyFound: newly.length };
}

/* ───────────────────────── Hints ───────────────────────── */

export type HintKind = 'mistake' | 'selected' | 'logic' | 'reveal';

export interface Hint {
  cell: number;
  digit: number;
  /**
   * - mistake: the cell held a wrong digit, which the hint corrects;
   * - selected: the selected empty cell is filled;
   * - logic: the next cell a human can deduce from the current board;
   * - reveal: the logic of the solver is stuck; the most constrained cell is revealed.
   */
  kind: HintKind;
  /** Technique that places the digit when it follows directly from the current board. */
  technique: TechniqueId | null;
  /** Unit (0–26) of a hidden single. */
  unit?: number;
  /** Elimination techniques needed before the placement (in order, without repeats). */
  support: TechniqueId[];
}

const MAX_HINT_STEPS = 400;

/**
 * Chooses and explains a hint:
 * 1. the selected cell when it is unlocked and empty or wrong;
 * 2. otherwise the first wrong digit on the board;
 * 3. otherwise the next cell the logical solver deduces from the correct entries (singles,
 *    after any eliminations it needs), with the technique that proves it;
 * 4. when the logic is stuck (expert puzzles that need bifurcation), the empty cell with the
 *    fewest candidates is revealed.
 * Wrong entries are ignored by the logic (only correct digits are used as facts).
 */
export function findHint(s: SudokuState, selected: number | null = null): Hint | null {
  if (s.solved) return null;
  let target: number | null = null;
  let kind: HintKind = 'logic';
  if (selected !== null && selected >= 0 && selected < CELLS && !isLocked(s, selected) && s.values[selected] !== s.solution[selected]) {
    target = selected;
    kind = s.values[selected] ? 'mistake' : 'selected';
  } else {
    const wrong = wrongCells(s);
    if (wrong.length) {
      target = wrong[0]!;
      kind = 'mistake';
    }
  }

  const facts = s.values.map((v, i) => (v === s.solution[i] ? v : 0));
  const board = createBoard(facts);
  const support: TechniqueId[] = [];
  let direct = true;
  if (board) {
    for (let k = 0; k < MAX_HINT_STEPS; k++) {
      const step = nextStep(board, 4);
      if (!step) break;
      if (step.placement) {
        const { cell } = step.placement;
        if (target === null || cell === target) {
          const explained = target === null || (direct && kind !== 'mistake');
          return {
            cell,
            digit: s.solution[cell]!,
            kind: target === null ? 'logic' : kind,
            technique: explained ? step.technique : null,
            unit: explained ? step.unit : undefined,
            support: explained ? support : [],
          };
        }
        direct = false; // the target needs other cells first: no single-step explanation
        applyStep(board, step);
        continue;
      }
      if (!support.includes(step.technique)) support.push(step.technique);
      applyStep(board, step);
    }
  }
  if (target !== null) return { cell: target, digit: s.solution[target]!, kind, technique: null, support: [] };

  // Stuck: reveal the most constrained empty cell.
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < CELLS; i++) {
    if (s.values[i] === s.solution[i]) continue;
    const count = board ? popcount(board.cands[i]!) || 10 : 9;
    if (count < bestCount) {
      bestCount = count;
      best = i;
    }
  }
  if (best < 0) return null;
  return { cell: best, digit: s.solution[best]!, kind: 'reveal', technique: null, support: [] };
}

/** Applies a hint: fills (and locks) the cell with the correct digit. */
export function applyHint(s: SudokuState, hint: Hint, opts: PlayOptions = DEFAULT_OPTIONS): SudokuState {
  if (s.solved || hintsLeft(s) <= 0 || isGiven(s, hint.cell) || s.hinted.includes(hint.cell)) return s;
  const digit = s.solution[hint.cell]!;
  const values = s.values.slice();
  const notes = s.notes.slice();
  values[hint.cell] = digit;
  notes[hint.cell] = 0;
  if (opts.autoNotes) for (const ch of peerNoteChanges(s, hint.cell, digit)) notes[ch.cell] = notes[ch.cell]! & ~bit(digit);
  return {
    ...s,
    values,
    notes,
    hinted: [...s.hinted, hint.cell],
    flagged: s.flagged.filter((c) => c !== hint.cell),
    hintsUsed: s.hintsUsed + 1,
    solved: isComplete(values, s.solution),
  };
}
