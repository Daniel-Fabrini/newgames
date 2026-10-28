import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameId } from '../types/game';
import type { GameMeta } from './types';
import { meta as blockPuzzle } from './block-puzzle/meta';
import { meta as waterSort } from './water-sort/meta';
import { meta as snake } from './snake/meta';
import { meta as numberMatch } from './number-match/meta';
import { meta as game2048 } from './game-2048/meta';
import { meta as solitaire } from './solitaire/meta';
import { meta as checkers } from './checkers/meta';
import { meta as domino } from './domino/meta';
import { meta as sudoku } from './sudoku/meta';
import { meta as crossword } from './crossword/meta';

/** Catalogue order (home grid). Metadata is small and loaded eagerly; game code is lazy-loaded. */
export const GAMES: readonly GameMeta[] = [
  blockPuzzle,
  waterSort,
  snake,
  numberMatch,
  solitaire,
  checkers,
  domino,
  sudoku,
  game2048,
  crossword,
];

export const GAME_META: Record<GameId, GameMeta> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameMeta>;

export const GAME_COMPONENTS: Record<GameId, LazyExoticComponent<ComponentType>> = {
  'block-puzzle': lazy(() => import('./block-puzzle')),
  'water-sort': lazy(() => import('./water-sort')),
  snake: lazy(() => import('./snake')),
  'number-match': lazy(() => import('./number-match')),
  'game-2048': lazy(() => import('./game-2048')),
  solitaire: lazy(() => import('./solitaire')),
  checkers: lazy(() => import('./checkers')),
  domino: lazy(() => import('./domino')),
  sudoku: lazy(() => import('./sudoku')),
  crossword: lazy(() => import('./crossword')),
};
