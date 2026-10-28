import { memo, useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { swipeDirection } from '../../hooks/useSwipe';
import type { Direction, GameState } from './engine';
import { SnakeRenderer, type StepClock, type Theme } from './render';

/** Minimum drag distance (px) for a swipe; after each turn the drag origin resets, so turns can be chained. */
const SWIPE_THRESHOLD = 20;

interface BoardProps {
  game: GameState;
  clock: RefObject<StepClock>;
  /** True while the snake is moving (drives the animation loop). */
  running: boolean;
  /** Turns are accepted (run in progress, no dialog open). */
  inputEnabled: boolean;
  theme: Theme;
  reduced: boolean;
  label: string;
  onTurn: (dir: Direction) => void;
  children?: ReactNode;
}

export const Board = memo(function Board({ game, clock, running, inputEnabled, theme, reduced, label, onTurn, children }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<SnakeRenderer | null>(null);
  const latest = useRef({ game, reduced, running });
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    latest.current = { game, reduced, running };
  });

  const drawNow = useCallback(() => {
    const r = renderer.current;
    const c = clock.current;
    if (!r || !c) return;
    const { game: g, reduced: red, running: run } = latest.current;
    const now = performance.now();
    if (!run) c.popups = [];
    const t = run && g.ticks > 0 ? Math.min(1, Math.max(0, (now - c.at) / c.interval)) : 1;
    r.draw(g, c, { t, now, reduced: red });
  }, [clock]);

  // Renderer + crisp sizing (devicePixelRatio) that follows the element size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = new SnakeRenderer(canvas);
    renderer.current = r;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      r.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      drawNow();
    };
    resize();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    ro?.observe(canvas);
    const dprQuery = typeof window.matchMedia === 'function' ? window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
    dprQuery?.addEventListener('change', resize);
    return () => {
      ro?.disconnect();
      dprQuery?.removeEventListener('change', resize);
      renderer.current = null;
    };
  }, [drawNow]);

  useEffect(() => {
    renderer.current?.setTheme(theme);
    drawNow();
  }, [theme, drawNow]);

  // Animation loop only while the snake moves; otherwise redraw when something changes.
  useEffect(() => {
    if (!running) {
      drawNow();
      return;
    }
    let raf = 0;
    const loop = () => {
      drawNow();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, drawNow]);

  useEffect(() => {
    if (!running) drawNow();
  }, [game, reduced, running, drawNow]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!inputEnabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is optional */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId || !inputEnabled) return;
    const dir = swipeDirection(e.clientX - s.x, e.clientY - s.y, SWIPE_THRESHOLD);
    if (dir) {
      onTurn(dir);
      swipe.current = { id: s.id, x: e.clientX, y: e.clientY };
    }
  };

  const endSwipe = () => {
    swipe.current = null;
  };

  const cls = ['sn-board', 'no-gesture', `sn-board--${game.mode}`, game.status === 'over' && 'is-crashed', game.status === 'won' && 'is-won'].filter(Boolean).join(' ');

  return (
    <div className={cls} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endSwipe} onPointerCancel={endSwipe} onLostPointerCapture={endSwipe}>
      <canvas ref={canvasRef} className="sn-canvas" role="img" aria-label={label} />
      {children}
    </div>
  );
});
