import { useEffect, useRef, type RefObject } from 'react';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/** Pure helper (tested): resolves a drag vector into a direction when it exceeds the threshold. */
export function swipeDirection(dx: number, dy: number, threshold: number): SwipeDirection | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * Detects swipes on an element with pointer events (touch, pen and mouse drag).
 * Apply the `.no-gesture` class to the element so the browser does not scroll while swiping.
 */
export function useSwipe<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onSwipe: (direction: SwipeDirection) => void,
  { threshold = 24, enabled = true }: { threshold?: number; enabled?: boolean } = {},
): void {
  const handler = useRef(onSwipe);
  useEffect(() => {
    handler.current = onSwipe;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number; id: number } | null = null;
    let fired = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      fired = false;
    };
    const move = (e: PointerEvent) => {
      if (!start || fired || e.pointerId !== start.id) return;
      const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y, threshold);
      if (dir) {
        fired = true;
        handler.current(dir);
      }
    };
    const end = () => {
      start = null;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
  }, [ref, threshold, enabled]);
}
