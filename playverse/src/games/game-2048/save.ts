import { v, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import { SIZE, type GameState, type Snapshot, type Tile } from './engine';

const isPowerOfTwo = (n: number) => n >= 2 && (n & (n - 1)) === 0;

const tile: Validator<Tile> = v.refine(
  v.object({
    id: v.int({ min: 0 }),
    value: v.int({ min: 2, max: 2 ** 20 }),
    row: v.int({ min: 0, max: SIZE - 1 }),
    col: v.int({ min: 0, max: SIZE - 1 }),
    merged: v.optional(v.boolean()),
    spawned: v.optional(v.boolean()),
  }),
  (t) => isPowerOfTwo(t.value) || 'tile value must be a power of two',
);

const uniquePositions = (tiles: readonly Tile[]) => new Set(tiles.map((t) => t.row * SIZE + t.col)).size === tiles.length;

const board = v.refine(v.array(tile, { maxLength: SIZE * SIZE }), (tiles) => uniquePositions(tiles) || 'overlapping tiles');

const snapshot: Validator<Snapshot> = v.object({
  tiles: board,
  score: v.int({ min: 0 }),
  won: v.boolean(),
  rng: v.int({ min: 0 }),
  nextId: v.int({ min: 1 }),
});

export interface Saved2048 {
  game: GameState;
  elapsedMs: number;
}

const gameState: Validator<GameState> = v.object({
  tiles: board,
  ghosts: v.array(tile, { maxLength: SIZE * SIZE * 2 }),
  score: v.int({ min: 0 }),
  moves: v.int({ min: 0 }),
  won: v.boolean(),
  keepPlaying: v.boolean(),
  over: v.boolean(),
  rng: v.int({ min: 0 }),
  nextId: v.int({ min: 1 }),
  undo: v.array(snapshot, { maxLength: 50 }),
  undosUsed: v.int({ min: 0 }),
});

export const saveSpec: SaveSpec<Saved2048> = {
  gameId: 'game-2048',
  version: 1,
  validate: v.object({ game: gameState, elapsedMs: v.number({ min: 0 }) }),
};
