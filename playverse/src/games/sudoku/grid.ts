/**
 * Sudoku grid primitives shared by the solver, the logical grader, the generator and the game engine.
 *
 * A grid is an array of 81 numbers in row-major order (cell = row * 9 + col); 0 means empty.
 * Candidate sets are 9-bit masks where bit (d - 1) stands for digit d.
 */
export const SIZE = 9;
export const CELLS = 81;
/** Mask with the 9 digits set. */
export const ALL_DIGITS = 0x1ff;

export type UnitKind = 'row' | 'col' | 'box';

export const rowOf = (cell: number): number => Math.floor(cell / SIZE);
export const colOf = (cell: number): number => cell % SIZE;
export const boxOf = (cell: number): number => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);
export const cellAt = (row: number, col: number): number => row * SIZE + col;

export const ROW = Uint8Array.from({ length: CELLS }, (_, i) => rowOf(i));
export const COL = Uint8Array.from({ length: CELLS }, (_, i) => colOf(i));
export const BOX = Uint8Array.from({ length: CELLS }, (_, i) => boxOf(i));

/**
 * The 27 units: rows are 0–8, columns 9–17 and boxes 18–26. Each unit lists its 9 cells in
 * reading order.
 */
export const UNITS: readonly (readonly number[])[] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => cellAt(r, c))),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => cellAt(r, c))),
  ...Array.from({ length: SIZE }, (_, b) =>
    Array.from({ length: SIZE }, (_, k) => cellAt(Math.floor(b / 3) * 3 + Math.floor(k / 3), (b % 3) * 3 + (k % 3))),
  ),
];

export function unitKind(unit: number): UnitKind {
  return unit < 9 ? 'row' : unit < 18 ? 'col' : 'box';
}

/** 0-based index of the unit within its kind (row 0–8, column 0–8, box 0–8). */
export function unitIndex(unit: number): number {
  return unit % 9;
}

export const rowUnit = (cell: number): number => ROW[cell]!;
export const colUnit = (cell: number): number => 9 + COL[cell]!;
export const boxUnit = (cell: number): number => 18 + BOX[cell]!;

/** The 20 peers of every cell (same row, column or box, excluding the cell itself). */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set<number>([...UNITS[rowUnit(i)]!, ...UNITS[colUnit(i)]!, ...UNITS[boxUnit(i)]!]);
  set.delete(i);
  return [...set].sort((a, b) => a - b);
});

/** IS_PEER[a * 81 + b] === 1 when a and b share a unit (and a !== b). */
export const IS_PEER = (() => {
  const out = new Uint8Array(CELLS * CELLS);
  PEERS.forEach((peers, a) => peers.forEach((b) => (out[a * CELLS + b] = 1)));
  return out;
})();

export const isPeer = (a: number, b: number): boolean => IS_PEER[a * CELLS + b] === 1;

/** Number of set bits for every 9-bit mask. */
export const POPCOUNT = Uint8Array.from({ length: 512 }, (_, m) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
});

export const bit = (digit: number): number => 1 << (digit - 1);
export const popcount = (mask: number): number => POPCOUNT[mask & ALL_DIGITS]!;

/** Digits (1–9) contained in a mask, ascending. */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= SIZE; d++) if (mask & bit(d)) out.push(d);
  return out;
}

/** Smallest digit of a non-empty mask. */
export function firstDigit(mask: number): number {
  for (let d = 1; d <= SIZE; d++) if (mask & bit(d)) return d;
  return 0;
}

/** Calls `fn` for each k-combination of `items` (k ≤ items.length). */
export function forEachCombination<T>(items: readonly T[], k: number, fn: (combo: T[]) => boolean | void): boolean {
  const combo: T[] = [];
  const rec = (start: number): boolean => {
    if (combo.length === k) return fn(combo.slice()) === true;
    for (let i = start; i <= items.length - (k - combo.length); i++) {
      combo.push(items[i] as T);
      if (rec(i + 1)) return true;
      combo.pop();
    }
    return false;
  };
  return rec(0);
}

/** Parses an 81-character string ('.' or '0' for empty cells, whitespace ignored). */
export function parseGrid(text: string): number[] {
  const chars = text.replace(/\s+/g, '');
  if (chars.length !== CELLS) throw new Error(`parseGrid: expected 81 cells, got ${chars.length}`);
  return [...chars].map((ch) => {
    if (ch === '.' || ch === '0') return 0;
    const d = Number(ch);
    if (!Number.isInteger(d) || d < 1 || d > 9) throw new Error(`parseGrid: invalid character "${ch}"`);
    return d;
  });
}

export function formatGrid(grid: readonly number[]): string {
  return grid.map((d) => (d ? String(d) : '.')).join('');
}

export function countClues(grid: readonly number[]): number {
  let n = 0;
  for (const d of grid) if (d !== 0) n++;
  return n;
}

/** True when every value is an integer 0–9 and the array has 81 cells. */
export function isGridShape(grid: readonly number[]): boolean {
  return grid.length === CELLS && grid.every((d) => Number.isInteger(d) && d >= 0 && d <= 9);
}

/** True when the grid is completely filled and every unit holds the digits 1–9 exactly once. */
export function isCompleteSolution(grid: readonly number[]): boolean {
  if (grid.length !== CELLS) return false;
  for (const unit of UNITS) {
    let seen = 0;
    for (const cell of unit) {
      const d = grid[cell]!;
      if (!Number.isInteger(d) || d < 1 || d > 9) return false;
      seen |= bit(d);
    }
    if (seen !== ALL_DIGITS) return false;
  }
  return true;
}

/**
 * Cells whose (non-zero) value is repeated somewhere in their row, column or box.
 * Returned as a boolean per cell.
 */
export function findConflicts(values: readonly number[]): boolean[] {
  const out = Array<boolean>(CELLS).fill(false);
  for (const unit of UNITS) {
    const byDigit = new Map<number, number[]>();
    for (const cell of unit) {
      const d = values[cell]!;
      if (!d) continue;
      const list = byDigit.get(d);
      if (list) list.push(cell);
      else byDigit.set(d, [cell]);
    }
    for (const cells of byDigit.values()) if (cells.length > 1) for (const c of cells) out[c] = true;
  }
  return out;
}

/** How many times each digit (index 1–9) appears in the grid. Index 0 is unused. */
export function digitCounts(values: readonly number[]): number[] {
  const counts = Array<number>(10).fill(0);
  for (const d of values) if (d >= 1 && d <= 9) counts[d] = (counts[d] ?? 0) + 1;
  return counts;
}
