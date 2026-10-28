import { v, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import { MAX_CELLS, UNDO_LIMIT, type GameState, type Mode, type Snapshot } from './engine';
import { digitCount, emptyRows } from './match';

export interface SavedNumberMatch {
  game: GameState;
  elapsedMs: number;
}

/** Digits 1–9 or 0 (cleared); a completely cleared row can never be stored (it is always removed). */
const cells: Validator<number[]> = v.refine(v.array(v.int({ min: 0, max: 9 }), { maxLength: MAX_CELLS }), (c) => emptyRows(c).length === 0 || 'board has an empty row');

const snapshot: Validator<Snapshot> = v.object({
  cells,
  score: v.int({ min: 0 }),
  addsLeft: v.int({ min: 0, max: 99 }),
  addsUsed: v.int({ min: 0, max: 99 }),
  pairsCleared: v.int({ min: 0 }),
  rowsCleared: v.int({ min: 0 }),
  moves: v.int({ min: 0 }),
});

function gameState(mode: Mode): Validator<GameState> {
  return v.refine(
    v.object({
      mode: v.literal(mode),
      stage: v.int({ min: 1, max: 100_000 }),
      cells,
      score: v.int({ min: 0 }),
      addsLeft: v.int({ min: 0, max: 99 }),
      addsUsed: v.int({ min: 0, max: 99 }),
      hintsLeft: v.int({ min: 0, max: 99 }),
      hintsUsed: v.int({ min: 0, max: 99 }),
      pairsCleared: v.int({ min: 0 }),
      rowsCleared: v.int({ min: 0 }),
      moves: v.int({ min: 0 }),
      status: v.literal('playing', 'cleared', 'over'),
      rng: v.int({ min: 0, max: 0xffffffff }),
      undo: v.array(snapshot, { maxLength: UNDO_LIMIT }),
    }),
    (g) => {
      const digits = digitCount(g.cells);
      if (g.status === 'cleared') return digits === 0 || 'cleared board still has digits';
      if (digits === 0) return 'board without digits must be cleared';
      return true;
    },
  );
}

const saved = (mode: Mode): Validator<SavedNumberMatch> => v.object({ game: gameState(mode), elapsedMs: v.number({ min: 0 }) });

export const classicSave: SaveSpec<SavedNumberMatch> = {
  gameId: 'number-match',
  slot: 'classic',
  version: 1,
  validate: saved('classic'),
};

export const challengeSave: SaveSpec<SavedNumberMatch> = {
  gameId: 'number-match',
  slot: 'challenge',
  version: 1,
  validate: saved('challenge'),
};

export const saveSpecFor = (mode: Mode): SaveSpec<SavedNumberMatch> => (mode === 'classic' ? classicSave : challengeSave);
