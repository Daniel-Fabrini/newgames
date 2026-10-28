import { v, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import { CELLS, TRAY_SIZE, completedLines, groupCount, hasAnyMove, lineCells, type GameState, type TrayPiece } from './engine';
import { PALETTE_SIZE, SHAPE_IDS } from './shapes';

const trayPiece: Validator<TrayPiece> = v.object({
  id: v.int({ min: 0 }),
  shape: v.literal(...SHAPE_IDS),
});

const board = v.refine(v.array(v.int({ min: 0, max: PALETTE_SIZE }), { length: CELLS }), (b) => groupCount(completedLines(b)) === 0 || 'board contains a completed group');

const gameState: Validator<GameState> = v.refine(
  v.object({
    board,
    tray: v.array(v.nullable(trayPiece), { length: TRAY_SIZE }),
    score: v.int({ min: 0 }),
    combo: v.int({ min: 0 }),
    maxCombo: v.int({ min: 0 }),
    lines: v.int({ min: 0 }),
    placed: v.int({ min: 0 }),
    over: v.boolean(),
    rng: v.int({ min: 0, max: 0xffffffff }),
    nextId: v.int({ min: 1 }),
  }),
  (s) => {
    if (s.tray.every((p) => p === null)) return 'empty tray';
    if (s.combo > s.maxCombo) return 'combo above best combo';
    if (s.over === hasAnyMove(s.board, s.tray)) return 'game-over flag inconsistent with the board';
    return true;
  },
);

export interface SavedBlockPuzzle {
  game: GameState;
  elapsedMs: number;
}

export const saveValidator: Validator<SavedBlockPuzzle> = v.object({ game: gameState, elapsedMs: v.number({ min: 0 }) });

/**
 * Version 1 saves come from before 3×3 squares were cleared, so their board may hold a full
 * square: it is cleared on load (no points) and the game-over flag is recomputed.
 */
export function migrateSave(fromVersion: number, data: unknown): unknown {
  if (fromVersion !== 1 || typeof data !== 'object' || data === null) return undefined;
  const saved = data as { game?: { board?: unknown; tray?: unknown } };
  const game = saved.game;
  if (!game || !Array.isArray(game.board) || !Array.isArray(game.tray)) return undefined;
  const board = (game.board as number[]).slice();
  for (const cell of lineCells(completedLines(board))) board[cell] = 0;
  return { ...saved, game: { ...game, board, over: !hasAnyMove(board, game.tray as GameState['tray']) } };
}

export const saveSpec: SaveSpec<SavedBlockPuzzle> = {
  gameId: 'block-puzzle',
  version: 2,
  validate: saveValidator,
  migrate: migrateSave,
};
