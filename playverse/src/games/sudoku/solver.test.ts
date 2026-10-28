import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import {
  CELLS,
  PEERS,
  UNITS,
  countClues,
  digitCounts,
  digitsOf,
  findConflicts,
  formatGrid,
  isCompleteSolution,
  parseGrid,
  popcount,
  unitKind,
} from './grid';
import { countSolutions, hasUniqueSolution, randomSolution, solve } from './solver';
import { EXAMPLES } from './fixtures';

describe('grid helpers', () => {
  it('builds 27 units of 9 distinct cells and 20 peers per cell', () => {
    expect(UNITS).toHaveLength(27);
    for (const unit of UNITS) expect(new Set(unit).size).toBe(9);
    expect(unitKind(0)).toBe('row');
    expect(unitKind(9)).toBe('col');
    expect(unitKind(26)).toBe('box');
    expect(UNITS[18]).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20]);
    for (let i = 0; i < CELLS; i++) {
      expect(PEERS[i]).toHaveLength(20);
      expect(PEERS[i]).not.toContain(i);
    }
  });

  it('parses and formats grids', () => {
    const g = parseGrid(EXAMPLES.easy);
    expect(g).toHaveLength(81);
    expect(formatGrid(g).replace(/\./g, '0')).toBe(EXAMPLES.easy);
    expect(countClues(g)).toBe(32);
    expect(() => parseGrid('123')).toThrow();
    expect(() => parseGrid('x'.repeat(81))).toThrow();
  });

  it('counts bits and lists digits of masks', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0x1ff)).toBe(9);
    expect(digitsOf(0b101000001)).toEqual([1, 7, 9]);
  });

  it('detects duplicate digits in rows, columns and boxes', () => {
    const g = Array<number>(81).fill(0);
    g[0] = 5;
    g[8] = 5; // same row
    g[40] = 3;
    g[76] = 3; // same column (col 4)
    g[60] = 7;
    g[80] = 7; // same box (box 8)
    g[30] = 9; // alone
    const c = findConflicts(g);
    expect([0, 8, 40, 76, 60, 80].every((i) => c[i])).toBe(true);
    expect(c[30]).toBe(false);
    expect(c.filter(Boolean)).toHaveLength(6);
  });

  it('counts placed digits', () => {
    const counts = digitCounts(parseGrid(EXAMPLES.easy));
    expect(counts.slice(1).reduce((a, b) => a + b, 0)).toBe(32);
  });

  it('validates complete solutions', () => {
    const solved = solve(parseGrid(EXAMPLES.easy))!;
    expect(isCompleteSolution(solved)).toBe(true);
    const broken = solved.slice();
    [broken[0], broken[1]] = [broken[1]!, broken[0]!];
    expect(isCompleteSolution(broken)).toBe(false);
    expect(isCompleteSolution(solved.slice(0, 80))).toBe(false);
  });
});

describe('bitmask solver', () => {
  it('solves known puzzles to a valid grid that keeps the givens', () => {
    for (const text of [EXAMPLES.easy, EXAMPLES.xWing, EXAMPLES.inkala, EXAMPLES.easterMonster]) {
      const puzzle = parseGrid(text);
      const solution = solve(puzzle)!;
      expect(isCompleteSolution(solution)).toBe(true);
      puzzle.forEach((d, i) => d && expect(solution[i]).toBe(d));
    }
    expect(formatGrid(solve(parseGrid(EXAMPLES.easy))!)).toBe(EXAMPLES.easySolution);
  });

  it('confirms uniqueness of proper puzzles', () => {
    for (const text of [EXAMPLES.easy, EXAMPLES.xWing, EXAMPLES.inkala, EXAMPLES.goldenNugget]) {
      expect(countSolutions(parseGrid(text))).toBe(1);
      expect(hasUniqueSolution(parseGrid(text))).toBe(true);
    }
  });

  it('detects multiple solutions', () => {
    const solution = parseGrid(EXAMPLES.easySolution);
    // Removing a "deadly rectangle" (two digits swappable in two rows and two boxes) gives 2 solutions.
    const p = solution.slice();
    let found = false;
    outer: for (let r1 = 0; r1 < 9; r1++) {
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (Math.floor(r1 / 3) === Math.floor(r2 / 3)) continue;
        for (let c1 = 0; c1 < 9; c1++) {
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            if (Math.floor(c1 / 3) !== Math.floor(c2 / 3)) continue;
            const a = solution[r1 * 9 + c1];
            const b = solution[r1 * 9 + c2];
            if (solution[r2 * 9 + c1] === b && solution[r2 * 9 + c2] === a) {
              for (const i of [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2]) p[i] = 0;
              found = true;
              break outer;
            }
          }
        }
      }
    }
    expect(found).toBe(true);
    expect(countSolutions(p, 2)).toBe(2);
    expect(hasUniqueSolution(p)).toBe(false);
    expect(countSolutions(p, 5)).toBe(2);
    // An empty grid has a huge number of solutions: the count stops at the limit.
    expect(countSolutions(Array<number>(81).fill(0), 3)).toBe(3);
  });

  it('reports no solution for contradictory or malformed grids', () => {
    const dup = parseGrid(EXAMPLES.easy);
    const empty = dup.findIndex((d) => d === 0);
    dup[empty] = dup.find((d, i) => d !== 0 && PEERS[empty]!.includes(i))!;
    expect(countSolutions(dup)).toBe(0);
    expect(solve(dup)).toBeNull();
    expect(countSolutions([1, 2, 3])).toBe(0);
    expect(countSolutions(Array<number>(81).fill(10))).toBe(0);
  });

  it('builds random complete grids deterministically from the seed', () => {
    const a = randomSolution(new Rng(42));
    const b = randomSolution(new Rng(42));
    const c = randomSolution(new Rng(43));
    expect(isCompleteSolution(a)).toBe(true);
    expect(isCompleteSolution(c)).toBe(true);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
