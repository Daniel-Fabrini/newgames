import { beforeAll, describe, expect, it } from 'vitest';
import { CAPACITY, checkPour, isBottleDone, isSolved, isWellFormed, pour, type Bottles } from './engine';
import {
  MAX_BOTTLES,
  MAX_COLOURS,
  bandStart,
  clearLevelCache,
  coloursFor,
  exactStructuralKey,
  generateLevel,
  levelConfig,
  structuralInvariant,
  type GeneratedLevel,
} from './levels';
import { lowerBound, solve } from './solver';

const LEVELS = 60;
const levels: GeneratedLevel[] = [];

beforeAll(() => {
  clearLevelCache();
  for (let n = 1; n <= LEVELS; n++) levels.push(generateLevel(n));
});

/** Replays a solution with the rules engine only (independent of the solver's internals). */
function replayToEnd(start: Bottles, moves: readonly { from: number; to: number }[]): number[][] {
  let bottles = start.map((b) => b.slice());
  for (const m of moves) {
    expect(checkPour(bottles, m.from, m.to).ok).toBe(true);
    bottles = pour(bottles, m.from, m.to)!.bottles;
  }
  return bottles;
}

describe(`generated levels 1..${LEVELS}`, () => {
  it('are well formed and match their configuration', () => {
    for (const lv of levels) {
      const config = levelConfig(lv.level);
      expect(isWellFormed(lv.bottles, MAX_COLOURS)).toBe(true);
      expect(new Set(lv.bottles.flat()).size).toBe(config.colours);
      expect(lv.colours).toBe(config.colours);
      expect(lv.empties).toBe(config.empties);
      expect(lv.bottles.length).toBe(config.colours + config.empties);
      expect(lv.bottles.filter((b) => b.length === 0)).toHaveLength(config.empties);
      expect(lv.bottles.length).toBeLessThanOrEqual(MAX_BOTTLES);
    }
  });

  it('never start with a finished bottle or an already solved position', () => {
    for (const lv of levels) {
      expect(isSolved(lv.bottles)).toBe(false);
      for (const b of lv.bottles) if (b.length > 0) expect(isBottleDone(b)).toBe(false);
      for (const b of lv.bottles) expect(b.length === 0 || b.length === CAPACITY).toBe(true);
    }
  });

  it('are solvable: the stored solution replays to a win and its length is the par', () => {
    for (const lv of levels) {
      const end = replayToEnd(lv.bottles, lv.solution);
      expect(isSolved(end)).toBe(true);
      expect(lv.par).toBe(lv.solution.length);
    }
  });

  it('are also solved by a fresh, independent solver run', () => {
    for (const lv of levels) {
      const r = solve(lv.bottles, { weight: 2, maxNodes: 50_000 });
      expect(r.status).toBe('solved');
      if (r.status === 'solved') expect(isSolved(replayToEnd(lv.bottles, r.moves))).toBe(true);
    }
  });

  it('are not trivially short: no solution can be shorter than the level minimum', () => {
    for (const lv of levels) {
      const { minMoves } = levelConfig(lv.level);
      expect(lowerBound(lv.bottles)).toBeGreaterThanOrEqual(minMoves);
      expect(lv.par).toBeGreaterThanOrEqual(minMoves);
      expect(lv.par).toBeGreaterThanOrEqual(lowerBound(lv.bottles));
    }
  });

  it('are deterministic', () => {
    clearLevelCache();
    for (const n of [1, 2, 7, 10, 15, 33, 60]) {
      const again = generateLevel(n);
      const first = levels[n - 1] as GeneratedLevel;
      expect(again.bottles).toEqual(first.bottles);
      expect(again.par).toBe(first.par);
      expect(again.solution).toEqual(first.solution);
    }
  });

  it('are all different puzzles (even ignoring bottle order and colour renaming)', () => {
    const invariants = new Set(levels.map((lv) => structuralInvariant(lv.bottles)));
    expect(invariants.size).toBe(levels.length);
    const small = levels.filter((lv) => lv.colours <= 6);
    expect(new Set(small.map((lv) => exactStructuralKey(lv.bottles))).size).toBe(small.length);
    // Sanity check of the identity functions: renaming colours / reordering bottles is the same puzzle.
    const lv = levels[4] as GeneratedLevel;
    const renamed = lv.bottles.map((b) => b.map((c) => (c + 5) % MAX_COLOURS)).reverse();
    expect(exactStructuralKey(renamed)).toBe(exactStructuralKey(lv.bottles));
    expect(structuralInvariant(renamed)).toBe(structuralInvariant(lv.bottles));
  });
});

describe('difficulty curve', () => {
  it('starts with 3 colours and grows monotonically towards 12', () => {
    expect(coloursFor(1)).toBe(3);
    let prev = coloursFor(1);
    for (let n = 2; n <= 600; n++) {
      const c = coloursFor(n);
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c - prev).toBeLessThanOrEqual(1);
      prev = c;
    }
    expect(coloursFor(600)).toBe(MAX_COLOURS);
    expect(bandStart(MAX_COLOURS)).toBeLessThan(150);
  });

  it('gets harder on average: more colours and longer solutions', () => {
    const avg = (from: number, to: number, f: (lv: GeneratedLevel) => number) => {
      const slice = levels.slice(from - 1, to);
      return slice.reduce((a, lv) => a + f(lv), 0) / slice.length;
    };
    const colours = [avg(1, 20, (l) => l.colours), avg(21, 40, (l) => l.colours), avg(41, 60, (l) => l.colours)];
    expect(colours[0]).toBeLessThan(colours[1] as number);
    expect(colours[1]).toBeLessThan(colours[2] as number);
    const par = [avg(1, 20, (l) => l.par), avg(21, 40, (l) => l.par), avg(41, 60, (l) => l.par)];
    expect(par[0]).toBeLessThan(par[1] as number);
    expect(par[1]).toBeLessThan(par[2] as number);
  });

  it('raises the minimum solution length inside a colour band', () => {
    const start = bandStart(8);
    const end = bandStart(9) - 1;
    const inner = Array.from({ length: end - start + 1 }, (_, i) => levelConfig(start + i)).filter((c) => c.empties === 2);
    expect((inner.at(-1) as { minMoves: number }).minMoves).toBeGreaterThan((inner[0] as { minMoves: number }).minMoves);
  });

  it('uses 2 empty bottles normally, 1 on tight levels and 3 when a new colour count starts', () => {
    expect(levelConfig(1).empties).toBe(2);
    expect(levelConfig(10).empties).toBe(1);
    expect(levelConfig(20).empties).toBe(1);
    expect(levelConfig(bandStart(6)).empties).toBe(3);
    expect(levelConfig(bandStart(6) + 1).empties).toBe(2);
    for (let n = 1; n <= 400; n++) {
      const c = levelConfig(n);
      expect(c.colours + c.empties).toBeLessThanOrEqual(MAX_BOTTLES);
      expect(c.empties).toBeGreaterThanOrEqual(1);
    }
  });

  it('generates high levels quickly', () => {
    clearLevelCache();
    const times: number[] = [];
    for (let n = 300; n < 310; n++) {
      const t0 = performance.now();
      const lv = generateLevel(n);
      times.push(performance.now() - t0);
      expect(lv.colours).toBe(MAX_COLOURS);
      expect(isSolved(replayToEnd(lv.bottles, lv.solution))).toBe(true);
    }
    // Typically a few ms each; generous bound for slow CI machines.
    expect(Math.max(...times)).toBeLessThan(400);
  });
});
