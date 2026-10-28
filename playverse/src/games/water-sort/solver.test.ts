import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { checkPour, createLevelState, isSolved, legalMoves, playPour, pour, replay, type Bottles } from './engine';
import { generateLevel } from './levels';
import { canonicalKey, deadEnd, findHint, lowerBound, poursToSolvable, solve } from './solver';

function randomPuzzle(rng: Rng, colours: number, empties: number): number[][] {
  const units = rng.shuffle(Array.from({ length: colours * 4 }, (_, i) => Math.floor(i / 4)));
  const out: number[][] = [];
  for (let b = 0; b < colours; b++) out.push(units.slice(b * 4, b * 4 + 4));
  for (let e = 0; e < empties; e++) out.push([]);
  return out;
}

/** Independent breadth-first search (no pruning, no heuristic): optimal number of pours or null. */
function bfsOptimal(start: Bottles, limit = 200_000): number | null {
  const key = (b: Bottles) => b.map((x) => x.join('')).sort().join('|');
  let frontier: number[][][] = [start.map((b) => b.slice())];
  const seen = new Set([key(start)]);
  for (let depth = 0; frontier.length > 0; depth++) {
    const next: number[][][] = [];
    for (const state of frontier) {
      if (isSolved(state)) return depth;
      for (let i = 0; i < state.length; i++) {
        for (let j = 0; j < state.length; j++) {
          const r = pour(state, i, j);
          if (!r) continue;
          const k = key(r.bottles);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(r.bottles);
          if (seen.size > limit) throw new Error('bfs limit');
        }
      }
    }
    frontier = next;
  }
  return null;
}

describe('solver', () => {
  it('returns an empty solution for a solved position', () => {
    expect(solve([[0, 0, 0, 0], []])).toEqual({ status: 'solved', moves: [], expanded: 0 });
  });

  it('finds a solution that replays to a win', () => {
    const start = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [],
      [],
    ];
    const r = solve(start, { weight: 1 });
    expect(r.status).toBe('solved');
    if (r.status !== 'solved') return;
    const end = replay(start, r.moves);
    expect(end).not.toBeNull();
    expect(isSolved(end!)).toBe(true);
  });

  it('proves positions without solution unsolvable', () => {
    expect(solve([[0, 1, 0, 1], [1, 0, 1, 0]]).status).toBe('unsolvable');
    // One empty bottle is not enough here (confirmed by the independent BFS).
    const stuck = [[0, 1, 2, 2], [1, 1, 0, 0], [1, 2, 2, 0], []];
    expect(bfsOptimal(stuck)).toBeNull();
    expect(solve(stuck, { weight: 1 }).status).toBe('unsolvable');
  });

  it('reports "budget" when the node budget runs out', () => {
    const rng = new Rng(3);
    expect(solve(randomPuzzle(rng, 9, 2), { maxNodes: 1 }).status).toBe('budget');
  });

  it('with weight 1 finds optimal solutions (checked against an independent BFS) and never prunes a solution away', () => {
    const rng = new Rng(42);
    for (let t = 0; t < 25; t++) {
      const colours = 3 + (t % 2);
      const empties = t % 5 === 0 ? 1 : 2;
      const puzzle = randomPuzzle(rng, colours, empties);
      const optimal = bfsOptimal(puzzle);
      const r = solve(puzzle, { weight: 1, maxNodes: 200_000 });
      if (optimal === null) {
        expect(r.status).toBe('unsolvable');
      } else {
        expect(r.status).toBe('solved');
        if (r.status === 'solved') expect(r.moves.length).toBe(optimal);
      }
    }
  });

  it('uses an admissible lower bound', () => {
    expect(lowerBound([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(0);
    expect(lowerBound([[0, 1], [1, 0], [0, 1], [1, 0]])).toBe(4 + 2);
    const rng = new Rng(7);
    for (let t = 0; t < 30; t++) {
      const puzzle = randomPuzzle(rng, 3 + (t % 5), 2);
      const r = solve(puzzle, { weight: 1, maxNodes: 100_000 });
      if (r.status === 'solved') expect(r.moves.length).toBeGreaterThanOrEqual(lowerBound(puzzle));
    }
  });

  it('memoises canonical positions: bottle order does not matter', () => {
    expect(canonicalKey([[0, 1], [], [1, 1, 0]])).toBe(canonicalKey([[1, 1, 0], [0, 1], []]));
    expect(canonicalKey([[0, 1], []])).not.toBe(canonicalKey([[1, 0], []]));
  });

  it('solves large positions (12 colours) quickly', () => {
    const rng = new Rng(2024);
    for (let t = 0; t < 5; t++) {
      const puzzle = randomPuzzle(rng, 12, 2);
      const r = solve(puzzle, { weight: 1.5, maxNodes: 20_000 });
      expect(r.status).toBe('solved');
      if (r.status === 'solved') expect(isSolved(replay(puzzle, r.moves)!)).toBe(true);
    }
  });
});

describe('hints', () => {
  it('gives a legal move that keeps the position solvable', () => {
    const rng = new Rng(11);
    for (let t = 0; t < 10; t++) {
      let position = randomPuzzle(rng, 6, 2);
      // Follow the hints all the way: they must lead to a win.
      for (let step = 0; step < 100 && !isSolved(position); step++) {
        const hint = findHint(position);
        expect(hint.status).toBe('move');
        if (hint.status !== 'move') break;
        expect(checkPour(position, hint.from, hint.to).ok).toBe(true);
        position = pour(position, hint.from, hint.to)!.bottles;
      }
      expect(isSolved(position)).toBe(true);
    }
  });

  it('says so when the position cannot be solved any more', () => {
    expect(findHint([[0, 1, 0, 1], [1, 0, 1, 0]])).toEqual({ status: 'unsolvable' });
  });
});

describe('dead-end detection', () => {
  // Level 18 position reported from a phone: legal pours remain (e.g. blue 3 → 2) but no solution.
  // Colours: 0 grey, 1 orange, 2 lime, 3 blue, 4 dark green, 5 yellow (bottom → top).
  const reported = [[0, 1, 1, 1], [2, 3], [2, 3, 3, 3], [4, 2, 2], [5, 1], [0, 0, 0], [5, 5, 5], [4, 4, 4]];

  it('proves the reported position unsolvable even though legal pours remain', () => {
    expect(legalMoves(reported).length).toBeGreaterThan(0);
    expect(deadEnd(reported)).toBe('unsolvable');
  });

  it('reports no-moves when no useful pour exists', () => {
    expect(deadEnd([[0, 1, 0, 1], [1, 0, 1, 0]])).toBe('no-moves');
  });

  it('never flags solved or solvable positions', () => {
    expect(deadEnd([[0, 0, 0, 0], [1, 1, 1, 1], []])).toBeNull();
    for (let level = 1; level <= 30; level++) expect(deadEnd(generateLevel(level).bottles)).toBeNull();
  });

  it('counts the pours to undo to get back to a solvable position', () => {
    // Play random legal pours from several levels until a dead end, then check the count against
    // a brute-force replay of every prefix of the history.
    const rng = new Rng(7);
    let checked = 0;
    for (let level = 3; level <= 40 && checked < 8; level++) {
      const { bottles: start } = generateLevel(level);
      let state = createLevelState(level, start, 0);
      for (let step = 0; step < 60 && !deadEnd(state.bottles); step++) {
        const moves = legalMoves(state.bottles);
        if (moves.length === 0) break;
        const { from, to } = rng.pick(moves);
        const result = playPour(state, from, to);
        if (result.ok) state = result.state;
      }
      if (!deadEnd(state.bottles)) continue;
      const steps = poursToSolvable(state.bottles, state.history);
      expect(steps).not.toBeNull();
      const n = state.history.length;
      const prefixAlive = (k: number) => deadEnd(replay(start, state.history.slice(0, k)) as number[][]) === null;
      expect(prefixAlive(n - (steps as number))).toBe(true);
      for (let k = n - (steps as number) + 1; k <= n; k++) expect(prefixAlive(k)).toBe(false);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('runs fast enough to check after every pour', () => {
    const started = performance.now();
    for (let level = 100; level < 110; level++) deadEnd(generateLevel(level).bottles);
    expect((performance.now() - started) / 10).toBeLessThan(150);
  });
});
