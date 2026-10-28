export const GAME_IDS = [
  'block-puzzle',
  'water-sort',
  'snake',
  'number-match',
  'game-2048',
  'solitaire',
  'checkers',
  'domino',
  'sudoku',
  'crossword',
] as const;

export type GameId = (typeof GAME_IDS)[number];

export function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && (GAME_IDS as readonly string[]).includes(value);
}

export const CATEGORIES = ['puzzle', 'logic', 'classic', 'board', 'cards'] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * How a game progresses:
 * - `score`: endless runs, compared by score (Block Puzzle, Snake, 2048)
 * - `levels`: campaign with unlockable levels (Water Sort, Number Match challenges)
 * - `match`: discrete matches with win/loss/draw (Checkers, Domino, Solitaire)
 * - `puzzle`: individual puzzles solved against the clock (Sudoku, Crossword)
 */
export type ProgressionKind = 'score' | 'levels' | 'match' | 'puzzle';

/** Result of a finished match/run as stored in statistics. */
export type Outcome = 'win' | 'loss' | 'draw' | 'ended';
