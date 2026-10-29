import { describe, expect, it, vi } from 'vitest';
import { registerBackHandler, requestBack, markLevelCompleted } from '../app/embed';

describe('embed back handling', () => {
  it('asks the most recent handler first and stops at the first that handles it', () => {
    const calls: string[] = [];
    const offGame = registerBackHandler(() => (calls.push('game'), true));
    const offDialog = registerBackHandler(() => (calls.push('dialog'), true));
    requestBack();
    expect(calls).toEqual(['dialog']);
    offDialog();
    requestBack();
    expect(calls).toEqual(['dialog', 'game']);
    offGame();
  });

  it('falls through handlers that decline', () => {
    const game = vi.fn(() => true);
    const offGame = registerBackHandler(game);
    const offDialog = registerBackHandler(() => false);
    requestBack();
    expect(game).toHaveBeenCalledOnce();
    offDialog();
    offGame();
  });

  it('does nothing outside embed mode when no handler exists', () => {
    expect(() => requestBack()).not.toThrow();
    expect(() => markLevelCompleted()).not.toThrow();
  });
});
