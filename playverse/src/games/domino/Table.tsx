import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { End, Placed } from './engine';
import { fitLayout, ghostAt, type LaidTile, type Rect } from './layout';
import { DominoFace } from './Tile';
import { otherHalf, type TileId } from './tiles';

export interface EndTarget {
  end: End;
  /** Pip on the open end the tile would match. */
  value: number;
  label: string;
}

interface TableProps {
  line: readonly Placed[];
  origin: number;
  /** Tile being placed (selected or dragged) and the ends it may go to. */
  candidate: TileId | null;
  targets: readonly EndTarget[];
  onTarget: (end: End) => void;
  /** End currently under a dragged tile (highlighted). */
  hoverEnd: End | null;
  lastPlayed: TileId | null;
  inProgress: boolean;
  label: string;
  /** Moves focus to the first target when targets appear (keyboard/tap selection). */
  focusTargets: boolean;
}

const PAD = 10;

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

const boxStyle = (r: Rect): CSSProperties => ({ width: r.w, height: r.h, transform: `translate(${r.x}px, ${r.y}px)` });

function ChainTile({ tile, px, isNew }: { tile: LaidTile; px: Rect; isNew: boolean }) {
  return (
    <div className={isNew ? 'dm-chain-tile is-new' : 'dm-chain-tile'} style={boxStyle(px)}>
      <DominoFace first={tile.first} second={tile.second} orient={tile.orient} />
    </div>
  );
}

/** The table: the line of play laid out as a snake that always fits, plus drop targets for the next tile. */
export const Table = memo(function Table({ line, origin, candidate, targets, onTarget, hoverEnd, lastPlayed, inProgress, label, focusTargets }: TableProps) {
  const { ref, size } = useSize<HTMLDivElement>();
  // Big tiles on large tables; on narrow phones a little smaller so rows hold more tiles.
  const maxUnit = Math.min(46, Math.max(12, size.h / 5), Math.max(14, size.w / 11));
  const fit = useMemo(
    () => fitLayout(line, origin, size.w - PAD * 2, size.h - PAD * 2, maxUnit, inProgress),
    [line, origin, size.w, size.h, maxUnit, inProgress],
  );
  const targetRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus the first end target when a tile is selected (not on every re-render).
  useLayoutEffect(() => {
    if (focusTargets && candidate !== null) targetRefs.current[0]?.focus();
  }, [focusTargets, candidate]);

  const toPx = (r: Rect): Rect => {
    const p = fit.toPx(r);
    return { x: p.x + PAD, y: p.y + PAD, w: p.w, h: p.h };
  };

  const onTargetKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const next = (i + 1) % targets.length;
    targetRefs.current[next]?.focus();
  };

  const ready = size.w > 0 && size.h > 0;

  return (
    <div ref={ref} className="dm-table no-gesture" role="group" aria-label={label} data-dm-table="">
      <div className="dm-felt" aria-hidden="true" />
      {ready &&
        fit.units.tiles.map((tile) => <ChainTile key={tile.tile} tile={tile} px={toPx(tile)} isNew={tile.tile === lastPlayed} />)}
      {ready &&
        candidate !== null &&
        targets.map((target, i) => {
          const ghost = ghostAt(fit.units, target.end, candidate, target.value, otherHalf(candidate, target.value));
          if (!ghost) return null;
          const px = toPx(ghost);
          const cls = ['dm-target', hoverEnd === target.end && 'is-hover'].filter(Boolean).join(' ');
          return (
            <button
              key={target.end}
              ref={(el) => {
                targetRefs.current[i] = el;
              }}
              type="button"
              className={cls}
              style={boxStyle(px)}
              data-dm-end={target.end}
              aria-label={target.label}
              onClick={() => onTarget(target.end)}
              onKeyDown={(e) => onTargetKey(e, i)}
            >
              <DominoFace first={ghost.first} second={ghost.second} orient={ghost.orient} />
            </button>
          );
        })}
    </div>
  );
});
