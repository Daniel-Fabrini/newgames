import { memo, type CSSProperties, type PointerEvent } from 'react';
import { Icon } from '../../components/Icon';
import { useI18n, type Messages } from '../../i18n';
import { shapeOf, type Shape } from './shapes';
import type { Tray as TrayState } from './engine';

/** Renders a shape as glossy blocks; the cell size comes from the `--cell` CSS variable. */
export function PieceView({ shape, className }: { shape: Shape; className?: string }) {
  const style = { '--w': shape.w, '--h': shape.h } as CSSProperties;
  return (
    <span className={className ? `bp-piece ${className}` : 'bp-piece'} style={style} aria-hidden="true">
      {shape.cells.map(([r, c]) => (
        <span key={`${r}-${c}`} className="bp-pcell" style={{ '--r': r, '--c': c } as CSSProperties}>
          <span className={`bp-block bp-c${shape.color}`} />
        </span>
      ))}
    </span>
  );
}

/** Localised, human readable piece name (with orientation for lines). */
export function shapeName(m: Messages, shape: Shape): string {
  const t = m.blockPuzzle;
  const base = t.shapes[shape.family];
  if (shape.family.startsWith('line')) return `${base} ${shape.w > 1 ? t.orientation.horizontal : t.orientation.vertical}`;
  return base;
}

export interface SlotHandlers {
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => void;
}

interface TrayProps {
  tray: TrayState;
  fits: readonly boolean[];
  selected: number | null;
  dragging: number | null;
  disabled: boolean;
  handlers: (slot: number) => SlotHandlers;
  onSelect: (slot: number) => void;
}

export const Tray = memo(function Tray({ tray, fits, selected, dragging, disabled, handlers, onSelect }: TrayProps) {
  const { m } = useI18n();
  const t = m.blockPuzzle;
  return (
    <div className="bp-tray no-gesture" role="group" aria-label={t.trayLabel}>
      {tray.map((piece, i) => {
        if (!piece) {
          return <button key={`empty-${i}`} type="button" className="bp-slot" disabled aria-label={t.slotEmpty(i + 1)} />;
        }
        const shape = shapeOf(piece.shape);
        const fit = fits[i] ?? false;
        const label = t.slotLabel(i + 1, shapeName(m, shape), shape.cells.length) + (fit ? '' : `, ${t.slotNoFit}`);
        const cls = ['bp-slot', selected === i && 'is-selected', !fit && 'is-nofit', dragging === i && 'is-dragging'].filter(Boolean).join(' ');
        return (
          <button
            key={`piece-${piece.id}`}
            type="button"
            className={cls}
            aria-label={label}
            aria-pressed={selected === i}
            aria-disabled={disabled || undefined}
            onClick={() => onSelect(i)}
            {...handlers(i)}
          >
            <span className="bp-slot__key" aria-hidden="true">
              {i + 1}
            </span>
            {!fit && (
              <span className="bp-slot__lock" aria-hidden="true">
                <Icon name="lock" size={14} />
              </span>
            )}
            <PieceView shape={shape} className="bp-deal" />
          </button>
        );
      })}
    </div>
  );
});
