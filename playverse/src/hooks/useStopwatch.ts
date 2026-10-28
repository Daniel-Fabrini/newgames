import { useCallback, useEffect, useRef, useState } from 'react';
import { usePageVisible } from './usePageVisible';

export interface Stopwatch {
  elapsedMs: number;
  /** Reads the precise current value (for saving / recording without waiting for a re-render). */
  getElapsed(): number;
  reset(toMs?: number): void;
}

/**
 * Pausable game clock. It only runs while `running` is true AND the page is visible, and it
 * stops completely on unmount, so no timer keeps counting in the background.
 */
export function useStopwatch(running: boolean, initialMs = 0, tickMs = 250): Stopwatch {
  const visible = usePageVisible();
  const active = running && visible;
  const accumulated = useRef(initialMs);
  const segmentStart = useRef<number | null>(null);
  const [elapsedMs, setElapsed] = useState(initialMs);

  const getElapsed = useCallback(
    () => accumulated.current + (segmentStart.current === null ? 0 : performance.now() - segmentStart.current),
    [],
  );

  useEffect(() => {
    if (!active) return;
    segmentStart.current = performance.now();
    const id = window.setInterval(() => setElapsed(getElapsed()), tickMs);
    return () => {
      window.clearInterval(id);
      if (segmentStart.current !== null) accumulated.current += performance.now() - segmentStart.current;
      segmentStart.current = null;
      setElapsed(accumulated.current);
    };
  }, [active, tickMs, getElapsed]);

  const reset = useCallback((toMs = 0) => {
    accumulated.current = toMs;
    if (segmentStart.current !== null) segmentStart.current = performance.now();
    setElapsed(toMs);
  }, []);

  return { elapsedMs, getElapsed, reset };
}
