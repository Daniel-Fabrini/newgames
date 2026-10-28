import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { End } from './engine';
import { DominoFace } from './Tile';
import { pipsOf, type TileId } from './tiles';

export interface DropInfo {
  /** End target under the pointer, or the nearest one when dropped elsewhere on the table. */
  end: End | null;
  overTable: boolean;
}

interface HandProps {
  tiles: readonly TileId[];
  playable: ReadonlyMap<TileId, End[]>;
  selected: TileId | null;
  justDrawn: TileId | null;
  /** The player may act now (otherwise every tile is shown dimmed and taps are rejected). */
  active: boolean;
  label: string;
  tileLabel: (tile: TileId, playable: boolean, isNew: boolean) => string;
  onTap: (tile: TileId) => void;
  onDragStart: (tile: TileId) => void;
  onDragHover: (end: End | null) => void;
  onDrop: (tile: TileId, drop: DropInfo) => void;
  onDragCancel: () => void;
}

interface DragState {
  tile: TileId;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
}

const DRAG_THRESHOLD = 10;

function findDrop(x: number, y: number): DropInfo {
  const el = document.elementFromPoint(x, y);
  const target = el?.closest<HTMLElement>('[data-dm-end]');
  if (target) return { end: target.dataset.dmEnd === 'left' ? 'left' : 'right', overTable: true };
  const overTable = Boolean(el?.closest('[data-dm-table]'));
  if (!overTable) return { end: null, overTable: false };
  let best: { end: End; d: number } | null = null;
  for (const node of document.querySelectorAll<HTMLElement>('[data-dm-end]')) {
    const r = node.getBoundingClientRect();
    const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
    const end: End = node.dataset.dmEnd === 'left' ? 'left' : 'right';
    if (!best || d < best.d) best = { end, d };
  }
  return { end: best?.end ?? null, overTable: true };
}

/** The player's tiles: tap to play/select, drag onto an end, arrow keys to move between tiles. */
export function Hand({ tiles, playable, selected, justDrawn, active, label, tileLabel, onTap, onDragStart, onDragHover, onDrop, onDragCancel }: HandProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClick = useRef(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the newly drawn tile in view.
  useEffect(() => {
    if (justDrawn === null) return;
    const i = tiles.indexOf(justDrawn);
    buttons.current[i]?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [justDrawn, tiles]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, tile: TileId) => {
    if (!active || !playable.has(tile) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    setDrag({ tile, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false });
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (!drag.active && dist < DRAG_THRESHOLD) return;
    if (!drag.active) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best effort */
      }
      onDragStart(drag.tile);
    }
    setDrag({ ...drag, x: e.clientX, y: e.clientY, active: true });
    onDragHover(findDrop(e.clientX, e.clientY).end);
  };

  const finishDrag = (e: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const wasActive = drag.active;
    setDrag(null);
    if (!wasActive) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    if (cancelled) {
      onDragCancel();
      return;
    }
    onDrop(drag.tile, findDrop(e.clientX, e.clientY));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    const current = buttons.current.findIndex((b) => b === document.activeElement);
    let next = current;
    if (e.key === 'ArrowLeft') next = Math.max(0, current - 1);
    if (e.key === 'ArrowRight') next = Math.min(tiles.length - 1, current + 1);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tiles.length - 1;
    e.preventDefault();
    buttons.current[next]?.focus();
  };

  return (
    <div className="dm-hand" role="group" aria-label={label} onKeyDown={onKeyDown}>
      <div className="dm-hand__scroll">
        {tiles.map((tile, i) => {
          const [lo, hi] = pipsOf(tile);
          const canPlay = active && playable.has(tile);
          const isNew = tile === justDrawn;
          const cls = [
            'dm-hand-tile',
            canPlay ? 'is-playable' : 'is-dim',
            selected === tile && 'is-selected',
            isNew && 'is-new',
            drag?.active && drag.tile === tile && 'is-dragging',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={tile}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              className={cls}
              aria-label={tileLabel(tile, canPlay, isNew)}
              aria-pressed={selected === tile}
              aria-disabled={!canPlay}
              onPointerDown={(e) => onPointerDown(e, tile)}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => finishDrag(e, false)}
              onPointerCancel={(e) => finishDrag(e, true)}
              onClick={() => {
                if (suppressClick.current) return;
                onTap(tile);
              }}
            >
              <DominoFace first={hi} second={lo} orient="v" />
            </button>
          );
        })}
      </div>
      {drag?.active &&
        createPortal(
          <div className="dm-drag-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }} aria-hidden="true">
            <DominoFace first={pipsOf(drag.tile)[1]} second={pipsOf(drag.tile)[0]} orient="v" />
          </div>,
          document.body,
        )}
    </div>
  );
}
