import { v, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import { SQUARES, replay, type Side } from './engine';
import type { Difficulty } from './ai';

export type Mode = 'ai' | '2p';

export interface CheckersConfig {
  mode: Mode;
  /** Colour played by the human in "vs computer" mode (White always moves first). */
  humanSide: Side;
  difficulty: Difficulty;
}

/**
 * Saved game: only the configuration and the list of moves are stored. On load the game is
 * replayed from the initial position with the rules engine, so a tampered or corrupted save
 * (any illegal move) is rejected, and finished games are never resumed.
 */
export interface SavedCheckers {
  config: CheckersConfig;
  /** Each move as the squares visited: [from, ...landings] (0-based). */
  moves: number[][];
  /** RNG state of the computer opponent. */
  rng: number;
  elapsedMs: number;
}

export const configValidator: Validator<CheckersConfig> = v.object({
  mode: v.literal('ai', '2p'),
  humanSide: v.literal('w', 'b'),
  difficulty: v.literal('easy', 'medium', 'hard'),
});

const square = v.int({ min: 0, max: SQUARES - 1 });
/** The longest possible capture takes 12 pieces, so a move visits at most 13 squares. */
const movePathValidator = v.array(square, { minLength: 2, maxLength: 13 });

export const savedValidator: Validator<SavedCheckers> = v.refine(
  v.object({
    config: configValidator,
    moves: v.array(movePathValidator, { maxLength: 4000 }),
    rng: v.int({ min: 0, max: 0xffffffff }),
    elapsedMs: v.number({ min: 0 }),
  }),
  (s) => {
    const game = replay(s.moves);
    if (!game) return 'illegal move sequence';
    if (game.result) return 'game already finished';
    return true;
  },
);

export const saveSpec: SaveSpec<SavedCheckers> = {
  gameId: 'checkers',
  version: 1,
  validate: savedValidator,
};

/** Storage key of the last setup choices (a small preference, not a save). */
export const SETUP_KEY = 'checkers:setup';
