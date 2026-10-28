import { useEffect, useRef } from 'react';

/**
 * Calls `step()` at a fixed interval using requestAnimationFrame with an accumulator, so game
 * speed is independent of the display refresh rate (60/90/120 Hz). After a long frame it
 * catches up at most `maxCatchUp` steps instead of fast-forwarding the game.
 */
export function useFixedStep(step: () => void, intervalMs: number, running: boolean, maxCatchUp = 3): void {
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += now - last;
      last = now;
      let steps = 0;
      while (acc >= intervalMs && steps < maxCatchUp) {
        stepRef.current();
        acc -= intervalMs;
        steps++;
      }
      if (steps === maxCatchUp) acc = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [intervalMs, running, maxCatchUp]);
}
