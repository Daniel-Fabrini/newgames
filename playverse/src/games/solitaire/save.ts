import { v, type Validator } from '../../services/storage/schema';
import { readValue, writeValue } from '../../services/storage/storage';
import type { SaveSpec } from '../../services/saves';
import { DECK_SIZE, FOUNDATIONS, TABLEAU_COLUMNS, checkPiles, decodePiles, isComplete, type Card, type DrawMode, type GameState, type Snapshot } from './engine';

const card: Validator<Card> = v.object({ id: v.int({ min: 0, max: DECK_SIZE - 1 }), up: v.boolean() });
const pile = v.array(card, { maxLength: DECK_SIZE });

/** Undo history is unlimited in play; this cap only guards against absurd stored data. */
export const HISTORY_CAP = 20_000;

const snapshot: Validator<Snapshot> = v.refine(
  v.object({
    piles: v.string({ maxLength: DECK_SIZE + 20 }),
    score: v.int({ min: 0 }),
    recycles: v.int({ min: 0 }),
  }),
  (s) => {
    const decoded = decodePiles(s.piles);
    return (decoded !== null && checkPiles(decoded) === null) || 'invalid undo snapshot';
  },
);

export const gameStateValidator: Validator<GameState> = v.refine(
  v.object({
    stock: pile,
    waste: pile,
    foundations: v.array(pile, { length: FOUNDATIONS }),
    tableau: v.array(pile, { length: TABLEAU_COLUMNS }),
    seed: v.int({ min: 0 }),
    draw: v.literal(1, 3),
    score: v.int({ min: 0 }),
    moves: v.int({ min: 0 }),
    recycles: v.int({ min: 0 }),
    undos: v.int({ min: 0 }),
    history: v.array(snapshot, { maxLength: HISTORY_CAP }),
    won: v.boolean(),
  }),
  (s) => {
    const problem = checkPiles(s);
    if (problem) return problem;
    if (s.won !== isComplete(s)) return 'won flag does not match the foundations';
    return true;
  },
);

export interface SavedSolitaire {
  game: GameState;
  elapsedMs: number;
}

export const saveSpec: SaveSpec<SavedSolitaire> = {
  gameId: 'solitaire',
  version: 1,
  validate: v.object({ game: gameStateValidator, elapsedMs: v.number({ min: 0 }) }),
};

/* Remembered draw mode (small preference, separate from the saved game). */
const PREF_KEY = 'prefs:solitaire';
const prefValidator = v.object({ draw: v.literal(1, 3) });

export function loadDrawPreference(): DrawMode {
  return readValue(PREF_KEY, { validate: prefValidator }, { draw: 1 as DrawMode }).draw;
}

export function saveDrawPreference(draw: DrawMode): void {
  writeValue(PREF_KEY, { draw });
}
