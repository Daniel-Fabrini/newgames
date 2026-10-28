export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Creates a rows × cols matrix filled by `fill(row, col)`. */
export function matrix<T>(rows: number, cols: number, fill: (row: number, col: number) => T): T[][] {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => fill(r, c)));
}

/** Safe matrix read that respects `noUncheckedIndexedAccess`. */
export function cellAt<T>(grid: readonly (readonly T[])[], row: number, col: number): T | undefined {
  return grid[row]?.[col];
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}
