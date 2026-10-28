import type { Rng } from '../../utils/random';
import { ALL_DIGITS, BOX, CELLS, COL, POPCOUNT, ROW } from './grid';

/**
 * Fast backtracking solver based on bitmasks (used digits per row, column and box) with the
 * "minimum remaining values" heuristic: it always branches on the empty cell with the fewest
 * candidates. Used for uniqueness checks while generating, for validating saves and for
 * building random complete grids.
 */
interface Search {
  cells: Uint8Array;
  rows: Uint16Array;
  cols: Uint16Array;
  boxes: Uint16Array;
  empties: Uint8Array;
  emptyCount: number;
  found: number;
  limit: number;
  first: Uint8Array | null;
  rng: Rng | null;
  /** Safety valve: maximum number of search nodes before giving up (returns the count so far). */
  budget: number;
}

function setup(grid: ArrayLike<number>, limit: number, rng: Rng | null, budget: number): Search | null {
  if (grid.length !== CELLS) return null;
  const s: Search = {
    cells: new Uint8Array(CELLS),
    rows: new Uint16Array(9),
    cols: new Uint16Array(9),
    boxes: new Uint16Array(9),
    empties: new Uint8Array(CELLS),
    emptyCount: 0,
    found: 0,
    limit,
    first: null,
    rng,
    budget,
  };
  for (let i = 0; i < CELLS; i++) {
    const d = grid[i]!;
    if (!Number.isInteger(d) || d < 0 || d > 9) return null;
    if (d === 0) {
      s.empties[s.emptyCount++] = i;
      continue;
    }
    const b = 1 << (d - 1);
    const r = ROW[i]!;
    const c = COL[i]!;
    const x = BOX[i]!;
    if ((s.rows[r]! | s.cols[c]! | s.boxes[x]!) & b) return null; // duplicate digit: no solution
    s.cells[i] = d;
    s.rows[r]! |= b;
    s.cols[c]! |= b;
    s.boxes[x]! |= b;
  }
  return s;
}

/** Returns true when the search must stop (limit reached or budget exhausted). */
function dfs(s: Search, depth: number): boolean {
  if (--s.budget < 0) return true;
  if (depth === s.emptyCount) {
    s.found++;
    if (!s.first) s.first = s.cells.slice();
    return s.found >= s.limit;
  }
  // Pick the empty cell with the fewest candidates.
  let bestK = depth;
  let bestMask = 0;
  let bestCount = 10;
  for (let k = depth; k < s.emptyCount; k++) {
    const i = s.empties[k]!;
    const mask = ALL_DIGITS & ~(s.rows[ROW[i]!]! | s.cols[COL[i]!]! | s.boxes[BOX[i]!]!);
    const count = POPCOUNT[mask]!;
    if (count < bestCount) {
      bestCount = count;
      bestK = k;
      bestMask = mask;
      if (count <= 1) break;
    }
  }
  if (bestCount === 0) return false;
  const cell = s.empties[bestK]!;
  s.empties[bestK] = s.empties[depth]!;
  s.empties[depth] = cell;

  const r = ROW[cell]!;
  const c = COL[cell]!;
  const x = BOX[cell]!;
  let digits: number[] = [];
  for (let d = 0; d < 9; d++) if (bestMask & (1 << d)) digits.push(d);
  if (s.rng && digits.length > 1) digits = s.rng.shuffle(digits);

  for (const d of digits) {
    const b = 1 << d;
    s.cells[cell] = d + 1;
    s.rows[r]! |= b;
    s.cols[c]! |= b;
    s.boxes[x]! |= b;
    const stop = dfs(s, depth + 1);
    s.rows[r]! &= ~b;
    s.cols[c]! &= ~b;
    s.boxes[x]! &= ~b;
    s.cells[cell] = 0;
    if (stop) return true;
  }
  return false;
}

const DEFAULT_BUDGET = 2_000_000;

/**
 * Counts the solutions of a puzzle, stopping as soon as `limit` solutions are found
 * (use limit 2 to test uniqueness). Invalid grids (duplicates, bad values) have 0 solutions.
 */
export function countSolutions(grid: ArrayLike<number>, limit = 2): number {
  const s = setup(grid, limit, null, DEFAULT_BUDGET);
  if (!s) return 0;
  dfs(s, 0);
  return s.found;
}

export function hasUniqueSolution(grid: ArrayLike<number>): boolean {
  return countSolutions(grid, 2) === 1;
}

/** First solution found (deterministic), or null when the puzzle has none. */
export function solve(grid: ArrayLike<number>): number[] | null {
  const s = setup(grid, 1, null, DEFAULT_BUDGET);
  if (!s) return null;
  dfs(s, 0);
  return s.first ? Array.from(s.first) : null;
}

/** A uniformly shuffled complete, valid grid built by randomised backtracking. */
export function randomSolution(rng: Rng): number[] {
  const s = setup(new Array<number>(CELLS).fill(0), 1, rng, DEFAULT_BUDGET);
  if (!s) throw new Error('randomSolution: setup failed');
  dfs(s, 0);
  if (!s.first) throw new Error('randomSolution: no grid found');
  return Array.from(s.first);
}
