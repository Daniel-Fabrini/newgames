import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { SIZE, type Cell } from './engine';
import type { Shape } from './shapes';
import type { SlotHandlers } from './Tray';

/** Public drag state (changes only when the snapped cell changes, not on every pointer move). */
export interface DragInfo {
  slot: number;
  shape: Shape;
  /** Snapped top-left board cell under the dragged piece, or null when it is away from the board. */
  anchor: Cell | null;
  /** Board cell size in px (the dragged piece is drawn at board scale). */
  pitch: number;
  /** Tray-to-board scale, used for the lift animation. */
  fromScale: number;
  /** Animating back to the tray after an invalid drop. */
  returning: boolean;
}

interface Live {
  slot: number;
  shape: Shape;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  el: HTMLElement;
  dragging: boolean;
  rect: DOMRect | null;
  pitch: number;
}

export interface DragOptions {
  enabled: boolean;
  reducedMotion: boolean;
  /** The 9×9 cell area of the board. */
  areaRef: RefObject<HTMLElement | null>;
  shapeAt: (slot: number) => Shape | null;
  onStart: (slot: number) => void;
  /** Called on release with the snapped anchor; return true if the piece was placed. */
  onDrop: (slot: number, anchor: Cell) => boolean;
}

const MOUSE_THRESHOLD = 4;
const TOUCH_THRESHOLD = 8;

/** Vertical offset between the pointer and the piece centre: touch lifts the piece above the finger. */
function liftOf(l: Live): number {
  if (l.pointerType === 'mouse') return 0;
  return (l.shape.h * l.pitch) / 2 + l.pitch * 0.9 + 14;
}

function topLeft(l: Live): { left: number; top: number } {
  return { left: l.x - (l.shape.w * l.pitch) / 2, top: l.y - liftOf(l) - (l.shape.h * l.pitch) / 2 };
}

function anchorOf(l: Live): Cell | null {
  if (!l.rect) return null;
  const { left, top } = topLeft(l);
  const cx = left + (l.shape.w * l.pitch) / 2;
  const cy = top + (l.shape.h * l.pitch) / 2;
  const r = l.rect;
  if (cx < r.left - l.pitch || cx > r.right + l.pitch || cy < r.top - l.pitch || cy > r.bottom + l.pitch) return null;
  return { row: Math.round((top - r.top) / l.pitch), col: Math.round((left - r.left) / l.pitch) };
}

const sameCell = (a: Cell | null, b: Cell | null) => a === b || (a !== null && b !== null && a.row === b.row && a.col === b.col);

/**
 * Drag & drop of tray pieces with pointer events (touch, pen and mouse). A press that does not
 * move past a small threshold is left to the button's click (tap-to-select).
 */
export function usePieceDrag(options: DragOptions) {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const live = useRef<Live | null>(null);
  const floatEl = useRef<HTMLDivElement | null>(null);
  const suppressClick = useRef(false);
  const busy = useRef(false);
  const anim = useRef<Animation | null>(null);

  useEffect(
    () => () => {
      anim.current?.cancel();
    },
    [],
  );

  const position = useCallback(() => {
    const l = live.current;
    const el = floatEl.current;
    if (!l || !el) return;
    const { left, top } = topLeft(l);
    el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, []);

  /** Ref callback for the floating piece: positions it as soon as it mounts. */
  const floatRef = useCallback(
    (el: HTMLDivElement | null) => {
      floatEl.current = el;
      if (el) position();
    },
    [position],
  );

  const end = useCallback((l: Live, cancelled: boolean) => {
    suppressClick.current = true;
    const anchor = anchorOf(l);
    if (!cancelled && anchor && opts.current.onDrop(l.slot, anchor)) {
      busy.current = false;
      setDrag(null);
      return;
    }
    const el = floatEl.current;
    if (!el || opts.current.reducedMotion || typeof el.animate !== 'function') {
      busy.current = false;
      setDrag(null);
      return;
    }
    setDrag((d) => (d ? { ...d, anchor: null, returning: true } : d));
    const slotRect = l.el.getBoundingClientRect();
    const pieceRect = l.el.querySelector('.bp-piece')?.getBoundingClientRect();
    const w = l.shape.w * l.pitch;
    const h = l.shape.h * l.pitch;
    const scale = pieceRect && w > 0 ? pieceRect.width / w : 0.6;
    const from = topLeft(l);
    const tx = slotRect.left + slotRect.width / 2 - w / 2;
    const ty = slotRect.top + slotRect.height / 2 - h / 2;
    const a = el.animate(
      [{ transform: `translate3d(${from.left}px, ${from.top}px, 0)` }, { transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})` }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
    );
    anim.current = a;
    const done = () => {
      anim.current = null;
      busy.current = false;
      setDrag(null);
    };
    a.onfinish = done;
    a.oncancel = done;
  }, []);

  const handlersFor = useCallback(
    (slot: number): SlotHandlers => ({
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        const o = opts.current;
        if (!o.enabled || busy.current || live.current) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const shape = o.shapeAt(slot);
        if (!shape) return;
        suppressClick.current = false;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* capture is best effort */
        }
        live.current = {
          slot,
          shape,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          startX: e.clientX,
          startY: e.clientY,
          x: e.clientX,
          y: e.clientY,
          el: e.currentTarget,
          dragging: false,
          rect: null,
          pitch: 0,
        };
      },
      onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
        const l = live.current;
        if (!l || e.pointerId !== l.pointerId) return;
        l.x = e.clientX;
        l.y = e.clientY;
        if (!l.dragging) {
          const threshold = l.pointerType === 'mouse' ? MOUSE_THRESHOLD : TOUCH_THRESHOLD;
          if (Math.hypot(l.x - l.startX, l.y - l.startY) < threshold) return;
          const area = opts.current.areaRef.current;
          if (!area || !opts.current.enabled) return;
          l.rect = area.getBoundingClientRect();
          l.pitch = l.rect.width / SIZE;
          l.dragging = true;
          busy.current = true;
          const pieceRect = l.el.querySelector('.bp-piece')?.getBoundingClientRect();
          const fromScale = pieceRect && l.pitch > 0 ? Math.min(1, pieceRect.width / (l.shape.w * l.pitch)) : 0.6;
          opts.current.onStart(l.slot);
          setDrag({ slot: l.slot, shape: l.shape, anchor: anchorOf(l), pitch: l.pitch, fromScale, returning: false });
          return;
        }
        position();
        const anchor = anchorOf(l);
        setDrag((d) => (d && !sameCell(d.anchor, anchor) ? { ...d, anchor } : d));
      },
      onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
        const l = live.current;
        if (!l || e.pointerId !== l.pointerId) return;
        live.current = null;
        l.x = e.clientX;
        l.y = e.clientY;
        if (l.dragging) end(l, false);
      },
      onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => {
        const l = live.current;
        if (!l || e.pointerId !== l.pointerId) return;
        live.current = null;
        if (l.dragging) end(l, true);
      },
      onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => {
        const l = live.current;
        if (!l || e.pointerId !== l.pointerId) return;
        live.current = null;
        if (l.dragging) end(l, true);
      },
    }),
    [end, position],
  );

  /** True once after a drag ended, so the click that follows the release is ignored. */
  const consumeClick = useCallback(() => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }, []);

  return { drag, floatRef, handlersFor, consumeClick };
}
