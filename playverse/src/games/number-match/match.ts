/**
 * Number Match grid geometry and pairing rules (pure, UI independent).
 *
 * The grid is stored as a flat array in reading order (left → right, top → bottom) with
 * `COLS` cells per row; the last row may be partial. Each cell holds a digit 1–9 or `CLEARED`
 * (0): a cleared cell is empty but still occupies its position.
 *
 * Two cells form a removable pair when:
 * - their digits are equal or add up to 10 (1+9, 2+8, 3+7, 4+6, 5+5), AND
 * - they are connected, i.e. only cleared cells lie between them along one of these lines:
 *   1. the same row;
 *   2. the same column;
 *   3. the same diagonal (down-right or down-left);
 *   4. reading order (left → right, top → bottom), which links the end of one row with the
 *      start of the next. There is no wrap from the last cell back to the first one.
 */
export const COLS = 9;
export const CLEARED = 0;

export type Link = 'row' | 'column' | 'diagonal' | 'reading';
export type Pair = readonly [number, number];

export const rowOf = (index: number): number => Math.floor(index / COLS);
export const colOf = (index: number): number => index % COLS;
export const rowCount = (cells: readonly number[]): number => Math.ceil(cells.length / COLS);

export function isDigit(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 9;
}

/** Equal digits or digits that add up to 10. */
export function digitsMatch(a: number | undefined, b: number | undefined): boolean {
  return isDigit(a) && isDigit(b) && (a === b || a + b === 10);
}

/** True when every cell strictly between `from` and `to` (stepping by `step`) is cleared. */
function pathClear(cells: readonly number[], from: number, to: number, step: number): boolean {
  for (let k = from + step; k < to; k += step) if (cells[k] !== CLEARED) return false;
  return true;
}

/**
 * How two positions are connected (ignoring their digits), or null when they are not.
 * A same-row pair is reported as `row`; `reading` is used for pairs on different rows linked
 * through the end of a row and the start of the next.
 */
export function connection(cells: readonly number[], a: number, b: number): Link | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  const i = Math.min(a, b);
  const j = Math.max(a, b);
  if (i < 0 || j >= cells.length) return null;
  const ri = rowOf(i);
  const rj = rowOf(j);
  const ci = colOf(i);
  const cj = colOf(j);
  // In the same row, the row path and the reading-order path are the same cells.
  if (ri === rj) return pathClear(cells, i, j, 1) ? 'row' : null;
  if (ci === cj && pathClear(cells, i, j, COLS)) return 'column';
  const dr = rj - ri;
  if (cj - ci === dr && pathClear(cells, i, j, COLS + 1)) return 'diagonal';
  if (ci - cj === dr && pathClear(cells, i, j, COLS - 1)) return 'diagonal';
  if (pathClear(cells, i, j, 1)) return 'reading';
  return null;
}

export type PairCheck = { ok: true; link: Link } | { ok: false; reason: 'same' | 'empty' | 'digits' | 'blocked' };

/** Full validation of a pair, with the reason when it cannot be removed. */
export function checkPair(cells: readonly number[], a: number, b: number): PairCheck {
  if (a === b) return { ok: false, reason: 'same' };
  if (!isDigit(cells[a]) || !isDigit(cells[b])) return { ok: false, reason: 'empty' };
  if (!digitsMatch(cells[a], cells[b])) return { ok: false, reason: 'digits' };
  const link = connection(cells, a, b);
  return link ? { ok: true, link } : { ok: false, reason: 'blocked' };
}

export function canPair(cells: readonly number[], a: number, b: number): boolean {
  return checkPair(cells, a, b).ok;
}

/**
 * The first non-cleared cell after `from` in each forward direction: reading order, column,
 * down-right and down-left diagonals. Every connection between `from` and a later cell is
 * one of these (the cells in between must be cleared), so scanning them finds all pairs.
 */
export function forwardNeighbours(cells: readonly number[], from: number): number[] {
  const out: number[] = [];
  for (let k = from + 1; k < cells.length; k++) {
    if (cells[k] !== CLEARED) {
      out.push(k);
      break;
    }
  }
  const col = colOf(from);
  for (const [step, dc] of [
    [COLS, 0],
    [COLS + 1, 1],
    [COLS - 1, -1],
  ] as const) {
    let k = from;
    let c = col;
    for (;;) {
      k += step;
      c += dc;
      if (k >= cells.length || c < 0 || c >= COLS) break;
      if (cells[k] !== CLEARED) {
        out.push(k);
        break;
      }
    }
  }
  return out;
}

/** Every removable pair (i < j), sorted by first then second index. */
export function findPairs(cells: readonly number[]): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (!isDigit(v)) continue;
    const partners = [...new Set(forwardNeighbours(cells, i))].filter((j) => digitsMatch(v, cells[j])).sort((x, y) => x - y);
    for (const j of partners) out.push([i, j]);
  }
  return out;
}

/** First removable pair in reading order (used by hints), or null. */
export function firstPair(cells: readonly number[]): Pair | null {
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (!isDigit(v)) continue;
    const partners = forwardNeighbours(cells, i).filter((j) => digitsMatch(v, cells[j]));
    if (partners.length > 0) return [i, Math.min(...partners)];
  }
  return null;
}

export function hasPair(cells: readonly number[]): boolean {
  return firstPair(cells) !== null;
}

export function digitCount(cells: readonly number[]): number {
  let n = 0;
  for (const v of cells) if (isDigit(v)) n++;
  return n;
}

/** Rows (including a partial last row) whose cells are all cleared. */
export function emptyRows(cells: readonly number[]): number[] {
  const out: number[] = [];
  for (let r = 0; r < rowCount(cells); r++) {
    const row = cells.slice(r * COLS, r * COLS + COLS);
    if (row.every((v) => v === CLEARED)) out.push(r);
  }
  return out;
}

/** Removes whole rows; later rows move up and keep their columns. Works for any per-cell array. */
export function removeRows<T>(items: readonly T[], rows: readonly number[]): T[] {
  if (rows.length === 0) return items.slice();
  const drop = new Set(rows);
  return items.filter((_, i) => !drop.has(rowOf(i)));
}

/** Remaining digits in reading order. */
export function remainingDigits(cells: readonly number[]): number[] {
  return cells.filter(isDigit);
}

/** "Add numbers": appends every remaining digit, in reading order, after the last cell. */
export function appendRemaining(cells: readonly number[]): number[] {
  return [...cells, ...remainingDigits(cells)];
}

/** Splits the flat grid into rows (the last one may be shorter). */
export function toRows(cells: readonly number[]): number[][] {
  const rows: number[][] = [];
  for (let r = 0; r < rowCount(cells); r++) rows.push(cells.slice(r * COLS, r * COLS + COLS));
  return rows;
}
