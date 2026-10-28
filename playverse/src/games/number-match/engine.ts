import { Rng } from '../../utils/random';
import { CLASSIC_START_DIGITS, challengeConfig, challengeSeed, classicDigitCount, generateChallenge, randomDigits } from './generator';
import { appendRemaining, checkPair, digitCount, emptyRows, firstPair, hasPair, removeRows, type Link, type Pair } from './match';

/**
 * Number Match game engine (pure, UI independent). Pairing/connectivity rules live in match.ts.
 *
 * - Removing a pair clears both cells. Every row that becomes completely cleared is removed and
 *   the rows below move up.
 * - "Add numbers" appends every remaining digit, in reading order, after the last cell. It has a
 *   limited number of uses per stage/level.
 * - A hint reveals a removable pair (limited per stage/level). When no pair exists it points to
 *   "Add numbers" instead and is not consumed.
 * - Undo reverts the last removal or addition, up to UNDO_LIMIT steps back. It is not possible
 *   after the stage/level has ended, and hints are not refunded.
 * - The stage/level is cleared when no digit is left. The game is over when no pair exists and
 *   no addition is left.
 *
 * Scoring (classic): POINTS.pair per pair, POINTS.row per removed row, and POINTS.stage × stage
 * number for clearing the board. Score accumulates across stages.
 */
export const UNDO_LIMIT = 10;
export const MAX_CELLS = 2048;
export const CLASSIC_ADDS = 5;
export const CLASSIC_HINTS = 3;
export const POINTS = { pair: 10, row: 50, stage: 250 } as const;

export type Mode = 'classic' | 'challenge';
export type Status = 'playing' | 'cleared' | 'over';

export interface Snapshot {
  cells: number[];
  score: number;
  addsLeft: number;
  addsUsed: number;
  pairsCleared: number;
  rowsCleared: number;
  moves: number;
}

export interface GameState {
  mode: Mode;
  /** Classic: current stage (1-based). Challenge: level number. */
  stage: number;
  cells: number[];
  score: number;
  addsLeft: number;
  /** Additions used in the current stage/level. */
  addsUsed: number;
  hintsLeft: number;
  /** Hints used in the current stage/level. */
  hintsUsed: number;
  /** Pairs removed in the whole run (classic) or level (challenge). */
  pairsCleared: number;
  rowsCleared: number;
  /** Actions (removals + additions) in the current stage/level. */
  moves: number;
  status: Status;
  rng: number;
  undo: Snapshot[];
}

export function stageBonus(stage: number): number {
  return POINTS.stage * Math.max(1, stage);
}

function canAddTo(cells: readonly number[], addsLeft: number): boolean {
  return addsLeft > 0 && cells.length + digitCount(cells) <= MAX_CELLS;
}

/** Cleared when no digit is left; over when no pair exists and no addition is possible. */
export function evaluateStatus(cells: readonly number[], addsLeft: number): Status {
  if (digitCount(cells) === 0) return 'cleared';
  if (!hasPair(cells) && !canAddTo(cells, addsLeft)) return 'over';
  return 'playing';
}

function base(mode: Mode, stage: number, cells: number[], adds: number, hints: number, rng: number): GameState {
  return {
    mode,
    stage,
    cells,
    score: 0,
    addsLeft: adds,
    addsUsed: 0,
    hintsLeft: hints,
    hintsUsed: 0,
    pairsCleared: 0,
    rowsCleared: 0,
    moves: 0,
    status: evaluateStatus(cells, adds),
    rng,
    undo: [],
  };
}

/** Classic run, stage 1 (27 random digits). */
export function newClassic(seed: number): GameState {
  const rng = new Rng(seed);
  const cells = randomDigits(rng, CLASSIC_START_DIGITS);
  return base('classic', 1, cells, CLASSIC_ADDS, CLASSIC_HINTS, rng.state);
}

/** After a cleared classic stage: a fresh, slightly larger board. Score and run totals carry over. */
export function nextStage(state: GameState): GameState {
  if (state.mode !== 'classic' || state.status !== 'cleared') return state;
  const rng = new Rng(state.rng);
  const stage = state.stage + 1;
  const cells = randomDigits(rng, classicDigitCount(stage));
  return {
    ...state,
    stage,
    cells,
    addsLeft: CLASSIC_ADDS,
    addsUsed: 0,
    hintsLeft: CLASSIC_HINTS,
    hintsUsed: 0,
    moves: 0,
    status: evaluateStatus(cells, CLASSIC_ADDS),
    rng: rng.state,
    undo: [],
  };
}

/** Challenge level with its constructed (always solvable) starting board. */
export function newChallenge(level: number): GameState {
  const n = Math.max(1, Math.floor(level));
  const config = challengeConfig(n);
  return base('challenge', n, generateChallenge(n).cells, config.adds, config.hints, challengeSeed(n));
}

function snapshot(state: GameState): Snapshot {
  return {
    cells: state.cells.slice(),
    score: state.score,
    addsLeft: state.addsLeft,
    addsUsed: state.addsUsed,
    pairsCleared: state.pairsCleared,
    rowsCleared: state.rowsCleared,
    moves: state.moves,
  };
}

function pushUndo(state: GameState): Snapshot[] {
  return [...state.undo, snapshot(state)].slice(-UNDO_LIMIT);
}

export type RemoveFailure = 'inactive' | 'same' | 'empty' | 'digits' | 'blocked';

export type RemoveResult =
  | {
      ok: true;
      state: GameState;
      gained: number;
      link: Link;
      /** Board with the pair cleared but before empty rows were removed (for animations). */
      beforeCollapse: number[];
      /** Indices (in `beforeCollapse`) of the rows that were removed. */
      rowsRemoved: number[];
      stageCleared: boolean;
    }
  | { ok: false; state: GameState; reason: RemoveFailure };

export function removePair(state: GameState, a: number, b: number): RemoveResult {
  if (state.status !== 'playing') return { ok: false, state, reason: 'inactive' };
  const check = checkPair(state.cells, a, b);
  if (!check.ok) return { ok: false, state, reason: check.reason };

  const beforeCollapse = state.cells.slice();
  beforeCollapse[a] = 0;
  beforeCollapse[b] = 0;
  const rowsRemoved = emptyRows(beforeCollapse);
  const cells = removeRows(beforeCollapse, rowsRemoved);
  const status = evaluateStatus(cells, state.addsLeft);
  const stageCleared = status === 'cleared';
  const gained = POINTS.pair + POINTS.row * rowsRemoved.length + (stageCleared ? stageBonus(state.stage) : 0);

  return {
    ok: true,
    gained,
    link: check.link,
    beforeCollapse,
    rowsRemoved,
    stageCleared,
    state: {
      ...state,
      cells,
      score: state.score + gained,
      pairsCleared: state.pairsCleared + 1,
      rowsCleared: state.rowsCleared + rowsRemoved.length,
      moves: state.moves + 1,
      status,
      undo: stageCleared ? [] : pushUndo(state),
    },
  };
}

export type AddResult = { ok: true; state: GameState; added: number; firstNew: number } | { ok: false; state: GameState; reason: 'inactive' | 'none-left' | 'full' };

export function canAdd(state: GameState): boolean {
  return state.status === 'playing' && canAddTo(state.cells, state.addsLeft);
}

export function addNumbers(state: GameState): AddResult {
  if (state.status !== 'playing') return { ok: false, state, reason: 'inactive' };
  if (state.addsLeft <= 0) return { ok: false, state, reason: 'none-left' };
  if (!canAddTo(state.cells, state.addsLeft)) return { ok: false, state, reason: 'full' };
  const cells = appendRemaining(state.cells);
  const addsLeft = state.addsLeft - 1;
  return {
    ok: true,
    added: cells.length - state.cells.length,
    firstNew: state.cells.length,
    state: {
      ...state,
      cells,
      addsLeft,
      addsUsed: state.addsUsed + 1,
      moves: state.moves + 1,
      status: evaluateStatus(cells, addsLeft),
      undo: pushUndo(state),
    },
  };
}

export function canUndo(state: GameState): boolean {
  return state.status === 'playing' && state.undo.length > 0;
}

/** Reverts the last removal or addition (an undone addition is refunded; hints are not). */
export function undo(state: GameState): GameState {
  const prev = state.undo[state.undo.length - 1];
  if (!prev || state.status !== 'playing') return state;
  return {
    ...state,
    cells: prev.cells.slice(),
    score: prev.score,
    addsLeft: prev.addsLeft,
    addsUsed: prev.addsUsed,
    pairsCleared: prev.pairsCleared,
    rowsCleared: prev.rowsCleared,
    moves: prev.moves,
    status: evaluateStatus(prev.cells, prev.addsLeft),
    undo: state.undo.slice(0, -1),
  };
}

export type HintResult =
  | { kind: 'pair'; pair: Pair; state: GameState }
  | { kind: 'add'; state: GameState }
  | { kind: 'none'; reason: 'inactive' | 'no-hints'; state: GameState };

/**
 * Reveals the first removable pair in reading order and uses one hint. When there is no pair it
 * points to "Add numbers" without using a hint.
 */
export function requestHint(state: GameState): HintResult {
  if (state.status !== 'playing') return { kind: 'none', reason: 'inactive', state };
  const pair = firstPair(state.cells);
  if (!pair) return canAdd(state) ? { kind: 'add', state } : { kind: 'none', reason: 'inactive', state };
  if (state.hintsLeft <= 0) return { kind: 'none', reason: 'no-hints', state };
  return { kind: 'pair', pair, state: { ...state, hintsLeft: state.hintsLeft - 1, hintsUsed: state.hintsUsed + 1 } };
}

/** Challenge stars: 3 without additions or hints, 2 with up to two in total, 1 otherwise. */
export function challengeStars(addsUsed: number, hintsUsed: number): number {
  const used = addsUsed + hintsUsed;
  if (used === 0) return 3;
  return used <= 2 ? 2 : 1;
}
