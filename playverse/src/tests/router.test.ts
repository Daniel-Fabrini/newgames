import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../app/router';
import { GAME_IDS } from '../types/game';

describe('router', () => {
  it('parses and serialises every route', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(parseHash('#/records')).toEqual({ name: 'records' });
    expect(parseHash('#/stats/sudoku')).toEqual({ name: 'stats', gameId: 'sudoku' });
    expect(parseHash('#/game/unknown')).toEqual({ name: 'not-found' });
    for (const id of GAME_IDS) {
      const route = { name: 'game', gameId: id } as const;
      expect(parseHash(routeToHash(route))).toEqual(route);
    }
  });
});
