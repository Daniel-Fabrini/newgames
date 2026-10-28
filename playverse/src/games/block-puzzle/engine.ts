import { Rng } from '../../utils/random';
import { SHAPES, shapeOf, type Shape } from './shapes';

/**
 * Block Puzzle rules engine (pure, UI independent).
 *
 * Rules implemented:
 * - 9×9 board. The tray holds 3 pieces; a new set of 3 is dealt only after all 3 are placed.
 * - Pieces never rotate. A piece can be placed only fully inside the board on empty cells.
 * - After each placement every complete row, column and 3×3 square (the nine shaded boxes) is
 *   cleared at the same time; a cell that belongs to several of them is cleared once.
 * - Scoring: +1 point per block placed; clearing L groups at once (rows, columns and squares all
 *   count) gives 10 × L² points, multiplied by the combo. The combo counts consecutive placements
 *   that clear at least one group (1, 2, 3…); a placement that clears nothing resets it to 0.
 * - The game is over when none of the pieces left in the tray fits anywhere on the board.
 * - Generation: weighted random with a seeded Rng stored in the state. Big pieces (5+ blocks)
 *   become rarer when the board is crowded. When a trio is dealt and at least one shape of the
 *   library fits the board, at least one piece of the trio is guaranteed to fit (bounded
 *   re-rolls, then a forced fitting piece). It never guarantees that all three fit.
 */
export const SIZE = 9;
export const CELLS = SIZE * SIZE;
/** Side of the 3×3 squares; boxes are numbered 0–8 in reading order. */
export const BOX = 3;
export const TRAY_SIZE = 3;
export const LINE_POINTS = 10;
/** Whole-trio re-rolls attempted before forcing a fitting piece. */
export const MAX_REROLLS = 12;
/** Fill ratio from which big pieces start to get rarer, and where they reach the minimum weight. */
export const CROWD_START = 0.35;
export const CROWD_FULL = 0.65;
export const CROWD_MIN_FACTOR = 0.2;

export interface Cell {
  row: number;
  col: number;
}

export interface TrayPiece {
  /** Unique id (React keys / deal animation). */
  id: number;
  shape: string;
}

export type Tray = (TrayPiece | null)[];

export interface GameState {
  /** Row-major 9×9 board: 0 = empty, otherwise the palette colour of the block. */
  board: number[];
  tray: Tray;
  score: number;
  /** Consecutive placements that cleared at least one group. */
  combo: number;
  maxCombo: number;
  /** Groups (rows + columns + 3×3 squares) cleared in this game. */
  lines: number;
  /** Pieces placed in this game. */
  placed: number;
  over: boolean;
  rng: number;
  nextId: number;
}

export const indexOf = (row: number, col: number) => row * SIZE + col;

export function emptyBoard(): number[] {
  return Array<number>(CELLS).fill(0);
}

export function canPlace(board: readonly number[], shape: Shape, row: number, col: number): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (board[indexOf(r, c)] !== 0) return false;
  }
  return true;
}

/** All top-left anchors where the shape can be placed. */
export function validPlacements(board: readonly number[], shape: Shape): Cell[] {
  const out: Cell[] = [];
  for (let row = 0; row <= SIZE - shape.h; row++) {
    for (let col = 0; col <= SIZE - shape.w; col++) if (canPlace(board, shape, row, col)) out.push({ row, col });
  }
  return out;
}

export function fitsAnywhere(board: readonly number[], shape: Shape): boolean {
  for (let row = 0; row <= SIZE - shape.h; row++) {
    for (let col = 0; col <= SIZE - shape.w; col++) if (canPlace(board, shape, row, col)) return true;
  }
  return false;
}

/** Board cells covered by the shape at an anchor (cells outside the board are included). */
export function footprint(shape: Shape, row: number, col: number): Cell[] {
  return shape.cells.map(([dr, dc]) => ({ row: row + dr, col: col + dc }));
}

/** Complete groups: row and column numbers, and 3×3 box numbers (0–8, reading order). */
export interface Lines {
  rows: number[];
  cols: number[];
  boxes: number[];
}

/** Board indices of the cells of 3×3 box `box`. */
export function boxCells(box: number): number[] {
  const top = Math.floor(box / BOX) * BOX;
  const left = (box % BOX) * BOX;
  const out: number[] = [];
  for (let r = 0; r < BOX; r++) for (let c = 0; c < BOX; c++) out.push(indexOf(top + r, left + c));
  return out;
}

export function completedLines(board: readonly number[]): Lines {
  const rows: number[] = [];
  const cols: number[] = [];
  const boxes: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < SIZE; j++) {
      if (board[indexOf(i, j)] === 0) rowFull = false;
      if (board[indexOf(j, i)] === 0) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
    if (boxCells(i).every((cell) => board[cell] !== 0)) boxes.push(i);
  }
  return { rows, cols, boxes };
}

/** Number of groups (rows + columns + squares) in a clear. */
export function groupCount(lines: Lines): number {
  return lines.rows.length + lines.cols.length + lines.boxes.length;
}

/** Rows, columns and squares that placing the shape at the anchor would complete (the anchor must be valid). */
export function linesAfterPlacing(board: readonly number[], shape: Shape, row: number, col: number): Lines {
  if (!canPlace(board, shape, row, col)) return { rows: [], cols: [], boxes: [] };
  const next = board.slice();
  for (const [dr, dc] of shape.cells) next[indexOf(row + dr, col + dc)] = shape.color;
  return completedLines(next);
}

/** Cells (indices) belonging to the given rows, columns and squares, each counted once. */
export function lineCells(lines: Lines): number[] {
  const set = new Set<number>();
  for (const r of lines.rows) for (let c = 0; c < SIZE; c++) set.add(indexOf(r, c));
  for (const c of lines.cols) for (let r = 0; r < SIZE; r++) set.add(indexOf(r, c));
  for (const b of lines.boxes) for (const cell of boxCells(b)) set.add(cell);
  return [...set].sort((a, b) => a - b);
}

/** Points for clearing `lines` groups at once with the given (already incremented) combo. */
export function lineClearPoints(lines: number, combo: number): number {
  if (lines <= 0) return 0;
  return LINE_POINTS * lines * lines * Math.max(1, combo);
}

export function fillRatio(board: readonly number[]): number {
  let filled = 0;
  for (const v of board) if (v !== 0) filled++;
  return filled / CELLS;
}

/** Multiplier applied to big-piece weights: 1 on an open board, down to CROWD_MIN_FACTOR when crowded. */
export function crowdFactor(fill: number): number {
  if (fill <= CROWD_START) return 1;
  if (fill >= CROWD_FULL) return CROWD_MIN_FACTOR;
  const t = (fill - CROWD_START) / (CROWD_FULL - CROWD_START);
  return 1 - t * (1 - CROWD_MIN_FACTOR);
}

/** Generation weights of every library shape for the given board (same order as SHAPES). */
export function shapeWeights(board: readonly number[]): number[] {
  const factor = crowdFactor(fillRatio(board));
  return SHAPES.map((s) => (s.big ? s.weight * factor : s.weight));
}

function rollTrio(rng: Rng, weights: readonly number[]): Shape[] {
  return Array.from({ length: TRAY_SIZE }, () => rng.weighted(SHAPES, weights));
}

/**
 * Deals three shape ids for the board. If any library shape fits, at least one of the three
 * fits: up to MAX_REROLLS whole-trio re-rolls, then one random slot is replaced by a weighted
 * pick among the fitting shapes. Only one fitting piece is guaranteed, never all three.
 */
export function dealTrio(board: readonly number[], rng: Rng): string[] {
  const weights = shapeWeights(board);
  const fits = new Map<string, boolean>();
  const fitsShape = (s: Shape) => {
    let f = fits.get(s.id);
    if (f === undefined) {
      f = fitsAnywhere(board, s);
      fits.set(s.id, f);
    }
    return f;
  };
  let trio = rollTrio(rng, weights);
  const fitting = SHAPES.filter(fitsShape);
  if (fitting.length === 0) return trio.map((s) => s.id);
  for (let i = 0; i < MAX_REROLLS && !trio.some(fitsShape); i++) trio = rollTrio(rng, weights);
  if (!trio.some(fitsShape)) {
    const fittingWeights = fitting.map((s) => weights[SHAPES.indexOf(s)] ?? s.weight);
    const slot = rng.int(0, TRAY_SIZE - 1);
    trio = trio.map((s, i) => (i === slot ? rng.weighted(fitting, fittingWeights) : s));
  }
  return trio.map((s) => s.id);
}

/** Whether each tray piece fits somewhere on the board (false for empty slots). */
export function trayFits(board: readonly number[], tray: Tray): boolean[] {
  return tray.map((p) => (p ? fitsAnywhere(board, shapeOf(p.shape)) : false));
}

export function hasAnyMove(board: readonly number[], tray: Tray): boolean {
  return tray.some((p) => p !== null && fitsAnywhere(board, shapeOf(p.shape)));
}

export function newGame(seed: number): GameState {
  const rng = new Rng(seed >>> 0);
  const board = emptyBoard();
  const tray = dealTrio(board, rng).map((shape, i) => ({ id: i + 1, shape }));
  return { board, tray, score: 0, combo: 0, maxCombo: 0, lines: 0, placed: 0, over: false, rng: rng.state, nextId: tray.length + 1 };
}

/** Top-left anchor that keeps the shape inside the board. */
export function clampAnchor(shape: Shape, row: number, col: number): Cell {
  return {
    row: Math.min(Math.max(row, 0), SIZE - shape.h),
    col: Math.min(Math.max(col, 0), SIZE - shape.w),
  };
}

/**
 * Anchor used by tap/click placement: the tapped cell is the centre of the piece's bounding box
 * (for an even width/height, the cell just left of/above the centre), shifted to stay inside
 * the board near the edges.
 */
export function anchorForTap(shape: Shape, row: number, col: number): Cell {
  return clampAnchor(shape, row - Math.floor((shape.h - 1) / 2), col - Math.floor((shape.w - 1) / 2));
}

export interface ClearedCell {
  index: number;
  color: number;
}

export interface PlaceOutcome {
  state: GameState;
  /** Board indices of the blocks just placed. */
  placed: number[];
  /** Cells removed by the clear, with the colour they had. */
  cleared: ClearedCell[];
  rows: number[];
  cols: number[];
  /** 3×3 squares cleared (0–8, reading order). */
  boxes: number[];
  /** Groups cleared by this placement (rows + columns + squares). */
  lines: number;
  gained: number;
  combo: number;
  /** A new trio was dealt after this placement. */
  dealt: boolean;
}

/** Places the tray piece in `slot` with its top-left at (row, col). Returns null when illegal. */
export function place(state: GameState, slot: number, row: number, col: number): PlaceOutcome | null {
  if (state.over) return null;
  const piece = state.tray[slot];
  if (!piece) return null;
  const shape = shapeOf(piece.shape);
  if (!canPlace(state.board, shape, row, col)) return null;

  const board = state.board.slice();
  const placed: number[] = [];
  for (const [dr, dc] of shape.cells) {
    const i = indexOf(row + dr, col + dc);
    board[i] = shape.color;
    placed.push(i);
  }

  const groups = completedLines(board);
  const { rows, cols, boxes } = groups;
  const cleared = lineCells(groups).map((index) => ({ index, color: board[index] ?? 0 }));
  for (const c of cleared) board[c.index] = 0;
  const lines = groupCount(groups);
  const combo = lines > 0 ? state.combo + 1 : 0;
  const gained = shape.cells.length + lineClearPoints(lines, combo);

  let tray: Tray = state.tray.map((p, i) => (i === slot ? null : p));
  const rng = new Rng(state.rng);
  let nextId = state.nextId;
  let dealt = false;
  if (tray.every((p) => p === null)) {
    tray = dealTrio(board, rng).map((id) => ({ id: nextId++, shape: id }));
    dealt = true;
  }

  const next: GameState = {
    board,
    tray,
    score: state.score + gained,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    lines: state.lines + lines,
    placed: state.placed + 1,
    over: !hasAnyMove(board, tray),
    rng: rng.state,
    nextId,
  };
  return { state: next, placed, cleared, rows, cols, boxes, lines, gained, combo, dealt };
}
