import { describe, expect, it } from 'vitest';
import { chooseMove, evaluate, type Difficulty } from './ai';
import {
  BLACK_KING,
  BLACK_MAN,
  EMPTY,
  SQUARES,
  WHITE_KING,
  WHITE_MAN,
  applyMove,
  legalMoves,
  movePath,
  newGame,
  positionState,
  squareAt,
  type GameState,
} from './engine';
import { Rng } from '../../utils/random';

function at(name: string): number {
  return squareAt(8 - Number(name.slice(1)), name.charCodeAt(0) - 97);
}

function boardOf(pieces: Record<string, number>): number[] {
  const board = Array<number>(SQUARES).fill(EMPTY);
  for (const [name, value] of Object.entries(pieces)) board[at(name)] = value;
  return board;
}

const key = (path: readonly number[]) => path.join(',');

function ask(g: GameState, difficulty: Difficulty, rng = 1, timeMs = 25) {
  return chooseMove({ board: g.board, turn: g.turn, difficulty, rng, positions: g.positions, quietPlies: g.quietPlies, timeMs });
}

/** Random positions reached by random play from the initial position. */
function randomPositions(count: number, seed: number): GameState[] {
  const rng = new Rng(seed);
  const out: GameState[] = [];
  while (out.length < count) {
    let g = newGame();
    const plies = rng.int(0, 70);
    for (let i = 0; i < plies && !g.result; i++) g = applyMove(g, rng.pick(legalMoves(g)));
    if (!g.result) out.push(g);
  }
  return out;
}

describe('computer opponent', () => {
  it('only returns legal moves on many random positions, at every difficulty', () => {
    const positions = randomPositions(60, 11);
    for (const g of positions) {
      const legal = new Set(legalMoves(g).map((m) => key(movePath(m))));
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const res = ask(g, difficulty, positions.indexOf(g) + 1, 8);
        expect(legal.has(key(res.path))).toBe(true);
      }
    }
  });

  it('returns the only legal move immediately', () => {
    const g = positionState(boardOf({ c3: WHITE_MAN, d4: BLACK_MAN, h8: BLACK_MAN }), 'w');
    const res = ask(g, 'hard');
    expect(res.path).toEqual([at('c3'), at('e5')]);
    expect(res.nodes).toBe(0);
  });

  it('respects the majority rule (only maximal captures are candidates)', () => {
    const g = positionState(boardOf({ a3: WHITE_MAN, e3: WHITE_MAN, b4: BLACK_KING, f4: BLACK_MAN, f6: BLACK_MAN, h8: BLACK_MAN }), 'w');
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(ask(g, difficulty).path).toEqual([at('e3'), at('g5'), at('e7')]);
    }
  });

  it('does not hang a man when a safe move exists (medium and hard)', () => {
    // c3-d4 would be captured by e5 for nothing.
    const g = positionState(boardOf({ c3: WHITE_MAN, g1: WHITE_MAN, e5: BLACK_MAN, a7: BLACK_MAN }), 'w');
    for (const difficulty of ['medium', 'hard'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const res = ask(g, difficulty, seed, 80);
        expect(key(res.path)).not.toBe(key([at('c3'), at('d4')]));
      }
    }
  });

  it('finds a winning shot: sacrifice one man to capture two (medium and hard)', () => {
    // b4-c5! forces d6xb4, then a3xc5xa7 captures both black men.
    const g = positionState(boardOf({ b4: WHITE_MAN, a3: WHITE_MAN, d4: WHITE_MAN, d6: BLACK_MAN, b6: BLACK_MAN }), 'w');
    for (const difficulty of ['medium', 'hard'] as const) {
      const res = ask(g, difficulty, 3, 200);
      expect(res.path).toEqual([at('b4'), at('c5')]);
      expect(res.score).toBeGreaterThan(1000);
    }
  });

  it('reaches the configured depth for medium and searches deeper for hard', () => {
    const g = newGame();
    const medium = chooseMove({ board: g.board, turn: 'w', difficulty: 'medium', rng: 9, timeMs: 2000 });
    expect(medium.depth).toBe(5);
    const hard = chooseMove({ board: g.board, turn: 'w', difficulty: 'hard', rng: 9, timeMs: 250 });
    expect(hard.depth).toBeGreaterThanOrEqual(5);
  });

  it('is deterministic for a given RNG state and advances it', () => {
    const g = randomPositions(1, 99)[0] as GameState;
    const a = ask(g, 'easy', 1234);
    const b = ask(g, 'easy', 1234);
    expect(a.path).toEqual(b.path);
    expect(a.rng).toBe(b.rng);
  });

  it('throws when there is no legal move', () => {
    const board = boardOf({ a1: WHITE_KING });
    expect(() => chooseMove({ board, turn: 'b', difficulty: 'easy', rng: 1 })).toThrow();
  });
});

describe('evaluation', () => {
  it('is zero-sum and symmetric at the start', () => {
    const g = newGame();
    expect(evaluate(g.board, 'w')).toBe(0);
    expect(evaluate(g.board, 'b')).toBe(0);
  });

  it('values a king at about three men', () => {
    const king = evaluate(boardOf({ d4: WHITE_KING, h8: BLACK_MAN }), 'w');
    const threeMen = evaluate(boardOf({ c3: WHITE_MAN, e3: WHITE_MAN, g3: WHITE_MAN, h8: BLACK_MAN }), 'w');
    expect(Math.abs(king - threeMen)).toBeLessThan(80);
    expect(evaluate(boardOf({ d4: WHITE_KING, h8: BLACK_MAN }), 'b')).toBe(-king);
  });

  it('rewards advanced men', () => {
    const back = evaluate(boardOf({ c1: WHITE_MAN, h8: BLACK_MAN, a7: BLACK_MAN }), 'w');
    const advanced = evaluate(boardOf({ c7: WHITE_MAN, h8: BLACK_MAN, a7: BLACK_MAN }), 'w');
    expect(advanced).toBeGreaterThan(back - 10);
  });
});
