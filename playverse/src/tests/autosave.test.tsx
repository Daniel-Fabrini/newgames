// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useAutosave, loadGame } from '../services/saves';
import { v } from '../services/storage/schema';
import { __resetStorageBackendForTests } from '../services/storage/storage';

const spec = { gameId: 'snake' as const, version: 1, validate: v.object({ n: v.int() }) };

function Saver({ n }: { n: number }) {
  // A new object every render, like games that include a running clock in the payload.
  useAutosave(spec, { n });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  __resetStorageBackendForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('keeps saving while the state changes continuously (throttle, not an endless debounce)', () => {
    const { rerender } = render(<Saver n={0} />);
    for (let i = 1; i <= 10; i++) {
      vi.advanceTimersByTime(150);
      rerender(<Saver n={i} />);
    }
    // 1.5 s of constant changes: at least one write must have happened already.
    expect(loadGame(spec)?.n).toBeGreaterThan(0);
  });

  it('flushes the latest state on unmount', () => {
    const { rerender, unmount } = render(<Saver n={1} />);
    rerender(<Saver n={7} />);
    unmount();
    expect(loadGame(spec)?.n).toBe(7);
  });
});
