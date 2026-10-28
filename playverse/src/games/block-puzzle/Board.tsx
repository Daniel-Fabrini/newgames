import { memo, useRef, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { useI18n } from '../../i18n';
import { SIZE, indexOf, type Cell } from './engine';

export interface Preview {
  /** In-board cells covered by the previewed piece. */
  cells: ReadonlySet<number>;
  valid: boolean;
  color: number;
  /** Cells of the rows/columns the placement would clear. */
  clear: ReadonlySet<number>;
}

export interface Effects {
  id: number;
  placed: readonly number[];
  cleared: ReadonlyArray<{ index: number; color: number; delay: number }>;
  rows: readonly number[];
  cols: readonly number[];
  /** 3×3 squares cleared (0–8, reading order). */
  boxes: readonly number[];
  gained: number;
  /** Groups cleared (rows + columns + squares). */
  lines: number;
  combo: number;
  /** Popup position in cell units (centre of the placed piece). */
  x: number;
  y: number;
  /** Position of the placed piece along rows/columns, as a percentage, for the sweep origin. */
  originX: number;
  originY: number;
}

interface BoardProps {
  board: readonly number[];
  preview: Preview | null;
  fx: Effects | null;
  /** A piece is selected: hovering previews and tapping places. */
  placing: boolean;
  over: boolean;
  reducedMotion: boolean;
  areaRef: RefObject<HTMLDivElement | null>;
  onHover: (cell: Cell | null) => void;
  onTapCell: (cell: Cell) => void;
}

const ROWS = Array.from({ length: SIZE }, (_, i) => i);

function cellAt(el: HTMLElement, e: PointerEvent): Cell | null {
  const r = el.getBoundingClientRect();
  const col = Math.floor(((e.clientX - r.left) / r.width) * SIZE);
  const row = Math.floor(((e.clientY - r.top) / r.height) * SIZE);
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
  return { row, col };
}

export const Board = memo(function Board({ board, preview, fx, placing, over, reducedMotion, areaRef, onHover, onTapCell }: BoardProps) {
  const { m, fmt } = useI18n();
  const t = m.blockPuzzle;
  const pressed = useRef<number | null>(null);
  const popped = new Set(fx?.placed ?? []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!placing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressed.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
    onHover(cellAt(e.currentTarget, e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!placing) return;
    if (e.pointerType === 'mouse' || pressed.current === e.pointerId) onHover(cellAt(e.currentTarget, e));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (pressed.current !== e.pointerId) return;
    pressed.current = null;
    const cell = cellAt(e.currentTarget, e);
    if (e.pointerType !== 'mouse') onHover(null);
    if (cell && placing) onTapCell(cell);
  };
  const onPointerCancel = () => {
    pressed.current = null;
    onHover(null);
  };
  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && pressed.current === null) onHover(null);
  };

  return (
    <div className={over ? 'bp-board is-over' : 'bp-board'}>
      <div
        ref={areaRef}
        className={placing ? 'bp-area no-gesture is-placing' : 'bp-area no-gesture'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
      >
        <div className="bp-cells" role="grid" aria-label={t.boardLabel} aria-readonly="true">
          {ROWS.map((r) => (
            <div role="row" key={r} className="bp-row">
              {ROWS.map((c) => {
                const i = indexOf(r, c);
                const value = board[i] ?? 0;
                const inPreview = preview?.cells.has(i) ?? false;
                const alt = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 1;
                const cls = [
                  'bp-cell',
                  alt && 'is-alt',
                  preview?.clear.has(i) && 'is-hl',
                  inPreview && !preview?.valid && 'is-bad',
                ]
                  .filter(Boolean)
                  .join(' ');
                const pop = popped.has(i) && value !== 0;
                return (
                  <div
                    role="gridcell"
                    key={pop ? `${c}-${fx?.id}` : c}
                    className={cls}
                    aria-label={t.cellLabel(r + 1, c + 1, value ? t.cellFilled : t.cellEmpty)}
                  >
                    {value !== 0 ? (
                      <span className={pop ? `bp-block bp-c${value} is-pop` : `bp-block bp-c${value}`} />
                    ) : (
                      inPreview && preview?.valid && <span className={`bp-block bp-c${preview.color} is-ghost`} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {fx && (
          <div className="bp-fx" aria-hidden="true">
            {!reducedMotion &&
              fx.rows.map((row) => <span key={`r${fx.id}-${row}`} className="bp-sweep is-row" style={{ '--i': row, '--origin': `${fx.originX}%` } as CSSProperties} />)}
            {!reducedMotion &&
              fx.cols.map((col) => <span key={`c${fx.id}-${col}`} className="bp-sweep is-col" style={{ '--i': col, '--origin': `${fx.originY}%` } as CSSProperties} />)}
            {!reducedMotion &&
              fx.boxes.map((box) => (
                <span key={`q${fx.id}-${box}`} className="bp-sweep is-box" style={{ '--br': Math.floor(box / 3), '--bc': box % 3 } as CSSProperties} />
              ))}
            {!reducedMotion &&
              fx.cleared.map((cell) => (
                <span
                  key={`v${fx.id}-${cell.index}`}
                  className="bp-vanish"
                  style={{ '--r': Math.floor(cell.index / SIZE), '--c': cell.index % SIZE, '--d': `${cell.delay}ms` } as CSSProperties}
                >
                  <span className={`bp-block bp-c${cell.color}`} />
                </span>
              ))}
            <span key={`p${fx.id}`} className={reducedMotion ? 'bp-pop is-static' : 'bp-pop'} style={{ '--x': fx.x, '--y': fx.y } as CSSProperties}>
              <strong>{fmt.number(fx.gained, { signDisplay: 'always' })}</strong>
              {fx.lines > 0 && <small>{t.clearsPopup(fx.rows.length + fx.cols.length, fx.boxes.length)}</small>}
            </span>
            {fx.combo >= 2 && (
              <span key={`b${fx.id}`} className={['bp-burst', fx.y < 4 && 'is-low', reducedMotion && 'is-static'].filter(Boolean).join(' ')}>
                {t.combo(fx.combo)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
