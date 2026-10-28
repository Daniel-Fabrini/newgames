// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nProvider';
import { updateSettings } from '../services/settings';
import { __resetStorageBackendForTests } from '../services/storage/storage';
import Game2048 from '../games/game-2048';

beforeEach(() => {
  localStorage.clear();
  __resetStorageBackendForTests();
  updateSettings({ locale: 'pt', sound: false, haptics: false });
});

afterEach(cleanup);

function boardValues(container: HTMLElement): string {
  return Array.from(container.querySelectorAll('.t48-tile:not(.is-ghost)'))
    .map((el) => `${el.getAttribute('style')}=${el.textContent}`)
    .sort()
    .join('|');
}

describe('language switching', () => {
  it('translates the game in place without resetting the board', async () => {
    const { container } = render(
      <I18nProvider>
        <Game2048 />
      </I18nProvider>,
    );
    expect(screen.getByText('Novo jogo')).toBeTruthy();

    // Play a few moves so the board differs from a fresh game.
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
      fireEvent.keyDown(window, { key });
    }
    const before = boardValues(container);
    const scoreBefore = container.querySelector('.stat-pill.is-primary .stat-pill__value')?.textContent;

    await act(async () => updateSettings({ locale: 'en' }));
    expect(screen.getByText('New game')).toBeTruthy();
    expect(boardValues(container)).toBe(before);
    expect(container.querySelector('.stat-pill.is-primary .stat-pill__value')?.textContent).toBe(scoreBefore);

    await act(async () => updateSettings({ locale: 'es' }));
    expect(screen.getByText('Nueva partida')).toBeTruthy();
    expect(boardValues(container)).toBe(before);
  });

  it('restores a saved game after remounting (app restart)', async () => {
    const first = render(
      <I18nProvider>
        <Game2048 />
      </I18nProvider>,
    );
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight']) fireEvent.keyDown(window, { key });
    const before = boardValues(first.container);
    first.unmount(); // unmount flushes the autosave

    const second = render(
      <I18nProvider>
        <Game2048 />
      </I18nProvider>,
    );
    expect(boardValues(second.container)).toBe(before);
  });
});
