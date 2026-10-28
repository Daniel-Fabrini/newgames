import { describe, expect, it } from 'vitest';
import { canMove, continueAfterWin, move, newGame, slide, toGrid, undo, type GameState, type Tile, SIZE } from './engine';

/** Builds tiles from a value matrix (0 = empty). */
function tilesFrom(grid: number[][]): Tile[] {
  const tiles: Tile[] = [];
  let id = 1;
  grid.forEach((row, r) => row.forEach((value, c) => value && tiles.push({ id: id++, value, row: r, col: c })));
  return tiles;
}

function stateFrom(grid: number[][], extra: Partial<GameState> = {}): GameState {
  const tiles = tilesFrom(grid);
  return { tiles, ghosts: [], score: 0, moves: 0, won: false, keepPlaying: false, over: false, rng: 42, nextId: tiles.length + 1, undo: [], undosUsed: 0, ...extra };
}

const row = (values: number[]) => [values, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

describe('2048 slide/merge rules', () => {
  it('merges each pair once: [2,2,2,2] → [4,4,0,0]', () => {
    const r = slide(tilesFrom(row([2, 2, 2, 2])), 'left', 100);
    expect(toGrid(r.tiles)[0]).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(8);
  });

  it('does not chain merges: [2,2,4,0] → [4,4,0,0], not 8', () => {
    const r = slide(tilesFrom(row([2, 2, 4, 0])), 'left', 100);
    expect(toGrid(r.tiles)[0]).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(4);
  });

  it('resolves merges from the destination side: [2,2,2,0] left → [4,2,0,0], right → [0,0,2,4]', () => {
    expect(toGrid(slide(tilesFrom(row([2, 2, 2, 0])), 'left', 100).tiles)[0]).toEqual([4, 2, 0, 0]);
    expect(toGrid(slide(tilesFrom(row([2, 2, 2, 0])), 'right', 100).tiles)[0]).toEqual([0, 0, 2, 4]);
  });

  it('merges across gaps: [2,0,0,2] → [4,0,0,0]', () => {
    expect(toGrid(slide(tilesFrom(row([2, 0, 0, 2])), 'left', 100).tiles)[0]).toEqual([4, 0, 0, 0]);
  });

  it('[4,4,8,8] → [8,16,0,0] with score 24', () => {
    const r = slide(tilesFrom(row([4, 4, 8, 8])), 'left', 100);
    expect(toGrid(r.tiles)[0]).toEqual([8, 16, 0, 0]);
    expect(r.gained).toBe(24);
  });

  it('moves vertically', () => {
    const grid = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const up = toGrid(slide(tilesFrom(grid), 'up', 100).tiles).map((r) => r[0]);
    const down = toGrid(slide(tilesFrom(grid), 'down', 100).tiles).map((r) => r[0]);
    expect(up).toEqual([4, 4, 0, 0]);
    expect(down).toEqual([0, 0, 4, 4]);
  });

  it('reports no movement when nothing can slide', () => {
    const r = slide(tilesFrom(row([2, 4, 8, 16])), 'left', 100);
    expect(r.moved).toBe(false);
  });
});

describe('2048 game flow', () => {
  it('starts with two tiles', () => {
    const s = newGame(1);
    expect(s.tiles).toHaveLength(2);
    expect(s.tiles.every((t) => t.value === 2 || t.value === 4)).toBe(true);
  });

  it('is deterministic for a seed', () => {
    expect(toGrid(newGame(7).tiles)).toEqual(toGrid(newGame(7).tiles));
  });

  it('spawns exactly one tile after a valid move', () => {
    const s = stateFrom(row([2, 0, 0, 0]));
    const r = move(s, 'right');
    expect(r.moved).toBe(true);
    expect(r.state.tiles).toHaveLength(2);
    expect(r.state.moves).toBe(1);
  });

  it('does not spawn or count a move when the board does not change', () => {
    const s = stateFrom(row([2, 0, 0, 0]));
    const r = move(s, 'left');
    expect(r.moved).toBe(false);
    expect(r.state).toBe(s);
  });

  it('adds merged values to the score', () => {
    const r = move(stateFrom(row([2, 2, 0, 0])), 'left');
    expect(r.state.score).toBe(4);
    expect(r.gained).toBe(4);
  });

  it('detects the win at 2048 and blocks moves until the player continues', () => {
    const s = stateFrom(row([1024, 1024, 0, 0]));
    const r = move(s, 'left');
    expect(r.justWon).toBe(true);
    expect(r.state.won).toBe(true);
    expect(move(r.state, 'right').moved).toBe(false);
    const cont = continueAfterWin(r.state);
    expect(move(cont, 'right').moved).toBe(true);
    // Reaching 2048 again does not re-trigger the win
    expect(move(cont, 'right').justWon).toBe(false);
  });

  it('detects game over when the board is full without merges', () => {
    const full = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(tilesFrom(full))).toBe(false);
    const almost = full.map((r) => r.slice());
    almost[3]![3] = 4;
    expect(canMove(tilesFrom(almost))).toBe(true);
  });

  it('flags game over after the last possible move', () => {
    const grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 0],
    ];
    // Moving right fills the gap with a spawned tile; the result is over unless the spawn creates a pair.
    let s = stateFrom(grid);
    for (let seed = 1; seed < 50; seed++) {
      const r = move({ ...s, rng: seed }, 'right');
      expect(r.moved).toBe(true);
      expect(r.state.over).toBe(!canMove(r.state.tiles));
      s = stateFrom(grid);
    }
  });

  it('undo restores the previous board, score and random sequence', () => {
    const s0 = stateFrom(row([2, 2, 0, 0]));
    const s1 = move(s0, 'left').state;
    const back = undo(s1);
    expect(toGrid(back.tiles)).toEqual(toGrid(s0.tiles));
    expect(back.score).toBe(0);
    expect(back.undosUsed).toBe(1);
    // Repeating the same move yields the same spawn (no re-rolling through undo)
    expect(toGrid(move(back, 'left').state.tiles)).toEqual(toGrid(s1.tiles));
  });

  it('keeps every tile inside the board through a long random game', () => {
    let s = newGame(123);
    const dirs = ['left', 'up', 'right', 'down'] as const;
    for (let i = 0; i < 500 && !s.over; i++) {
      s = move(s, dirs[i % 4]!).state;
      const positions = new Set(s.tiles.map((t) => t.row * SIZE + t.col));
      expect(positions.size).toBe(s.tiles.length);
      expect(s.tiles.every((t) => t.row >= 0 && t.row < SIZE && t.col >= 0 && t.col < SIZE)).toBe(true);
      expect(s.tiles.every((t) => Number.isInteger(Math.log2(t.value)))).toBe(true);
    }
  });
});
