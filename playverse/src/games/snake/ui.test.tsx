// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nProvider';
import { updateSettings } from '../../services/settings';
import { loadGame } from '../../services/saves';
import { __resetStorageBackendForTests } from '../../services/storage/storage';
import SnakeGame from './index';
import { saveSpec } from './save';
import { loadPrefs } from './prefs';

beforeAll(() => {
  // jsdom has no 2D canvas: the renderer degrades to a no-op.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
});

beforeEach(() => {
  localStorage.clear();
  __resetStorageBackendForTests();
  updateSettings({ locale: 'pt', sound: false, haptics: false });
});

afterEach(cleanup);

const statValue = (container: HTMLElement, index: number) =>
  container.querySelectorAll('.stat-pill .stat-pill__value')[index]?.textContent;

describe('snake UI', () => {
  it('starts from the setup screen, keeps the run across a language change and offers to continue after a restart', async () => {
    const first = render(
      <I18nProvider>
        <SnakeGame />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Infinito' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Difícil' }));
    expect(loadPrefs()).toEqual({ mode: 'endless', difficulty: 'hard' });

    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    expect(screen.getByText('Infinito · Difícil')).toBeTruthy();
    expect(statValue(first.container, 2)).toBe('3');
    expect(screen.getByRole('img', { name: /Tabuleiro da cobra/ })).toBeTruthy();
    // Buffer a turn through the keyboard and the D-pad (the snake has not moved yet: countdown).
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.click(screen.getByRole('button', { name: 'Virar para a esquerda' }), { detail: 0 });

    await act(async () => updateSettings({ locale: 'en' }));
    expect(screen.getByText('Endless · Hard')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn left' })).toBeTruthy();
    expect(statValue(first.container, 2)).toBe('3');

    first.unmount(); // flushes the autosave
    const saved = loadGame(saveSpec);
    expect(saved?.game.mode).toBe('endless');
    expect(saved?.game.queue).toEqual(['up', 'left']);

    render(
      <I18nProvider>
        <SnakeGame />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Continue game' })).toBeTruthy();
    expect(screen.getByText('Saved run')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue game' }));
    expect(screen.getByText('Endless · Hard')).toBeTruthy();
  });

  it('pauses with the keyboard and records an abandoned run when restarting', async () => {
    render(
      <I18nProvider>
        <SnakeGame />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    fireEvent.keyDown(window, { key: 'p' });
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(screen.getByText('Reiniciar a partida?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Reiniciar' }).at(-1) as HTMLElement);
    // A run that never moved is not recorded.
    expect(localStorage.getItem('playverse:stats:snake')).toBeNull();
    expect(screen.getByText('Clássico · Média')).toBeTruthy();
  });
});
