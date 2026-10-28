import { Rng } from '../../utils/random';

/**
 * 2048 rules engine (pure, UI independent).
 *
 * Rules implemented:
 * - 4×4 board; tiles are powers of two.
 * - A move slides every tile as far as possible in the chosen direction.
 * - Two tiles with the same value merge into one with double the value; each tile can take part
 *   in at most one merge per move, and merges are resolved starting from the side the tiles move
 *   towards (so [2,2,2,0] moved left becomes [4,2,0,0]).
 * - The merged value is added to the score.
 * - A new tile (2 with 90% probability, 4 with 10%) appears in a random empty cell only after a
 *   move that changed the board.
 * - Reaching 2048 wins the game; the player may keep playing afterwards.
 * - The game is over when no move can change the board.
 */
export const SIZE = 4;
export const WIN_VALUE = 2048;
export const UNDO_LIMIT = 10;

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  /** True when the tile was created by a merge in the last move (for the "pop" animation). */
  merged?: boolean;
  /** True when the tile was spawned after the last move. */
  spawned?: boolean;
}

export interface Snapshot {
  tiles: Tile[];
  score: number;
  won: boolean;
  rng: number;
  nextId: number;
}

export interface GameState {
  tiles: Tile[];
  /** Tiles consumed by the last move's merges, positioned at their destination (animation only). */
  ghosts: Tile[];
  score: number;
  moves: number;
  won: boolean;
  /** The player chose to continue after reaching 2048. */
  keepPlaying: boolean;
  over: boolean;
  rng: number;
  nextId: number;
  undo: Snapshot[];
  undosUsed: number;
}

export function newGame(seed: number): GameState {
  let state: GameState = {
    tiles: [],
    ghosts: [],
    score: 0,
    moves: 0,
    won: false,
    keepPlaying: false,
    over: false,
    rng: seed >>> 0,
    nextId: 1,
    undo: [],
    undosUsed: 0,
  };
  state = spawnTile(state);
  state = spawnTile(state);
  return state;
}

/** Board as a matrix of values (0 = empty). */
export function toGrid(tiles: readonly Tile[]): number[][] {
  const grid = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
  for (const t of tiles) {
    const row = grid[t.row];
    if (row) row[t.col] = t.value;
  }
  return grid;
}

export function emptyCells(tiles: readonly Tile[]): Array<{ row: number; col: number }> {
  const taken = new Set(tiles.map((t) => t.row * SIZE + t.col));
  const out: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) out.push({ row: Math.floor(i / SIZE), col: i % SIZE });
  return out;
}

export function spawnTile(state: GameState): GameState {
  const cells = emptyCells(state.tiles);
  if (cells.length === 0) return state;
  const rng = new Rng(state.rng);
  const cell = rng.pick(cells);
  const value = rng.next() < 0.9 ? 2 : 4;
  const tile: Tile = { id: state.nextId, value, row: cell.row, col: cell.col, spawned: true };
  return { ...state, tiles: [...state.tiles, tile], rng: rng.state, nextId: state.nextId + 1 };
}

/** Cells of each line, ordered from the edge tiles move towards. */
function lines(direction: Direction): Array<Array<{ row: number; col: number }>> {
  const out: Array<Array<{ row: number; col: number }>> = [];
  for (let i = 0; i < SIZE; i++) {
    const line: Array<{ row: number; col: number }> = [];
    for (let j = 0; j < SIZE; j++) {
      switch (direction) {
        case 'left':
          line.push({ row: i, col: j });
          break;
        case 'right':
          line.push({ row: i, col: SIZE - 1 - j });
          break;
        case 'up':
          line.push({ row: j, col: i });
          break;
        case 'down':
          line.push({ row: SIZE - 1 - j, col: i });
          break;
      }
    }
    out.push(line);
  }
  return out;
}

export interface SlideResult {
  tiles: Tile[];
  ghosts: Tile[];
  gained: number;
  moved: boolean;
  nextId: number;
}

/** Slides and merges without spawning. Exported for tests. */
export function slide(tiles: readonly Tile[], direction: Direction, nextId: number): SlideResult {
  const byPos = new Map<number, Tile>();
  for (const t of tiles) byPos.set(t.row * SIZE + t.col, t);
  const result: Tile[] = [];
  const ghosts: Tile[] = [];
  let gained = 0;
  let moved = false;
  let id = nextId;

  for (const line of lines(direction)) {
    const present = line.map((c) => byPos.get(c.row * SIZE + c.col)).filter((t): t is Tile => t !== undefined);
    let target = 0;
    let i = 0;
    while (i < present.length) {
      const current = present[i] as Tile;
      const next = present[i + 1];
      const dest = line[target] as { row: number; col: number };
      if (next && next.value === current.value) {
        const value = current.value * 2;
        gained += value;
        ghosts.push({ ...current, row: dest.row, col: dest.col, merged: false, spawned: false });
        ghosts.push({ ...next, row: dest.row, col: dest.col, merged: false, spawned: false });
        result.push({ id: id++, value, row: dest.row, col: dest.col, merged: true });
        moved = true;
        i += 2;
      } else {
        if (current.row !== dest.row || current.col !== dest.col) moved = true;
        result.push({ ...current, row: dest.row, col: dest.col, merged: false, spawned: false });
        i += 1;
      }
      target++;
    }
  }
  return { tiles: result, ghosts, gained, moved, nextId: id };
}

export function canMove(tiles: readonly Tile[]): boolean {
  if (tiles.length < SIZE * SIZE) return true;
  const grid = toGrid(tiles);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r]?.[c];
      if (v === grid[r]?.[c + 1] || v === grid[r + 1]?.[c]) return true;
    }
  }
  return false;
}

export function maxTile(tiles: readonly Tile[]): number {
  return tiles.reduce((m, t) => Math.max(m, t.value), 0);
}

export interface MoveOutcome {
  state: GameState;
  moved: boolean;
  gained: number;
  /** True on the move that first reaches 2048. */
  justWon: boolean;
}

export function move(state: GameState, direction: Direction): MoveOutcome {
  if (state.over || (state.won && !state.keepPlaying)) return { state, moved: false, gained: 0, justWon: false };
  const slid = slide(state.tiles, direction, state.nextId);
  if (!slid.moved) return { state, moved: false, gained: 0, justWon: false };

  const snapshot: Snapshot = { tiles: state.tiles.map(cleanTile), score: state.score, won: state.won, rng: state.rng, nextId: state.nextId };
  let next: GameState = {
    ...state,
    tiles: slid.tiles,
    ghosts: slid.ghosts,
    score: state.score + slid.gained,
    moves: state.moves + 1,
    nextId: slid.nextId,
    undo: [...state.undo, snapshot].slice(-UNDO_LIMIT),
  };
  next = spawnTile(next);
  const reached = maxTile(next.tiles) >= WIN_VALUE;
  const justWon = reached && !state.won;
  next = { ...next, won: state.won || reached, over: !canMove(next.tiles) };
  return { state: next, moved: true, gained: slid.gained, justWon };
}

function cleanTile(t: Tile): Tile {
  return { id: t.id, value: t.value, row: t.row, col: t.col };
}

export function canUndo(state: GameState): boolean {
  return state.undo.length > 0;
}

/** Restores the previous position. The random sequence is restored too, so undo cannot be used to re-roll spawns. */
export function undo(state: GameState): GameState {
  const prev = state.undo[state.undo.length - 1];
  if (!prev) return state;
  return {
    ...state,
    tiles: prev.tiles.map(cleanTile),
    ghosts: [],
    score: prev.score,
    won: prev.won,
    keepPlaying: prev.won ? state.keepPlaying : false,
    over: false,
    rng: prev.rng,
    nextId: prev.nextId,
    moves: Math.max(0, state.moves - 1),
    undo: state.undo.slice(0, -1),
    undosUsed: state.undosUsed + 1,
  };
}

export function continueAfterWin(state: GameState): GameState {
  return { ...state, keepPlaying: true };
}
