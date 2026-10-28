import { memo, useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { useI18n } from '../../i18n';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { COLS, colOf, isDigit, rowCount, rowOf, type Pair } from './match';

export interface Pulse {
  cells: readonly number[];
  token: number;
}

interface BoardProps {
  cells: readonly number[];
  selected: number | null;
  hint: Pair | null;
  /** Rows currently collapsing (animation of removed rows). */
  collapsing: readonly number[];
  /** Cells that were just cleared (burst animation). */
  burst: Pulse | null;
  /** Cells involved in an invalid attempt (shake). */
  error: Pulse | null;
  /** Cell to scroll into view. */
  reveal: Pulse | null;
  cursor: number;
  onCursor: (index: number) => void;
  onActivate: (index: number) => void;
  disabled: boolean;
  gridRef: RefObject<HTMLDivElement | null>;
}

interface CellProps {
  index: number;
  value: number;
  label: string;
  digit: string;
  selected: boolean;
  hinted: boolean;
  burstToken: number | undefined;
  errorToken: number | undefined;
  focusable: boolean;
  onActivate: (index: number) => void;
  onFocusCell: (index: number) => void;
}

const Cell = memo(function Cell({ index, value, label, digit, selected, hinted, burstToken, errorToken, focusable, onActivate, onFocusCell }: CellProps) {
  const filled = isDigit(value);
  const cls = ['nm-cell', filled ? 'is-digit' : 'is-cleared', selected && 'is-selected', hinted && 'is-hint', errorToken !== undefined && 'is-error'].filter(Boolean).join(' ');
  return (
    <div
      role="gridcell"
      className={cls}
      data-index={index}
      data-d={filled ? value : undefined}
      tabIndex={focusable ? 0 : -1}
      aria-selected={filled ? selected : undefined}
      aria-label={label}
      onClick={() => onActivate(index)}
      onFocus={() => onFocusCell(index)}
    >
      {filled ? (
        <span key={errorToken ?? 'digit'} className={errorToken !== undefined ? 'nm-cell__digit is-shake' : 'nm-cell__digit'} aria-hidden="true">
          {digit}
        </span>
      ) : (
        <span className="nm-cell__hole" aria-hidden="true" />
      )}
      {burstToken !== undefined && <span key={burstToken} className="nm-cell__burst" aria-hidden="true" />}
    </div>
  );
});

const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };

/**
 * The scrollable number grid (9 columns). Implements the ARIA grid pattern with a roving
 * tabindex: arrows move the cursor, Enter/Space activates the cell under it.
 */
export const Board = memo(function Board({ cells, selected, hint, collapsing, burst, error, reveal, cursor, onCursor, onActivate, disabled, gridRef }: BoardProps) {
  const { m, fmt } = useI18n();
  const t = m.numberMatch;
  const reduced = useReducedMotion();
  const hadFocus = useRef(false);
  const rows = rowCount(cells);
  const cur = Math.max(0, Math.min(cursor, cells.length - 1));

  const cellAt = useCallback((index: number) => gridRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null, [gridRef]);

  const activate = useCallback(
    (index: number) => {
      if (!disabled) onActivate(index);
    },
    [disabled, onActivate],
  );

  // Keep keyboard focus on the grid when the focused cell disappears (row removed).
  useEffect(() => {
    if (!hadFocus.current) return;
    const active = document.activeElement;
    if (active === null || active === document.body) cellAt(cur)?.focus();
  }, [cells, cur, cellAt]);

  useEffect(() => {
    if (!reveal) return;
    const el = cellAt(reveal.cells[0] ?? 0);
    el?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [reveal, cellAt, reduced]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (cells.length === 0) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(cur);
      return;
    }
    let next: number | null = null;
    const step = KEY_STEPS[e.key];
    if (step !== undefined) {
      next = cur + step;
      // Moving down into a shorter last row lands on its last cell.
      if (step === COLS && next >= cells.length && rowOf(cur) < rows - 1) next = cells.length - 1;
    } else if (e.key === 'Home') next = rowOf(cur) * COLS;
    else if (e.key === 'End') next = Math.min(cells.length - 1, rowOf(cur) * COLS + COLS - 1);
    if (next === null) return;
    e.preventDefault();
    if (next < 0 || next >= cells.length) return;
    onCursor(next);
    cellAt(next)?.focus();
  };

  const hinted = new Set(hint ?? []);
  const bursting = new Set(burst?.cells ?? []);
  const shaking = new Set(error?.cells ?? []);
  const collapsingRows = new Set(collapsing);

  return (
    <div className="nm-board">
      <div
        ref={gridRef}
        className="nm-grid"
        role="grid"
        aria-label={t.gridLabel(rows)}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onFocus={() => {
          hadFocus.current = true;
        }}
        onBlur={(e) => {
          if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) hadFocus.current = false;
        }}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} role="row" className={collapsingRows.has(r) ? 'nm-row is-collapsing' : 'nm-row'}>
            {cells.slice(r * COLS, r * COLS + COLS).map((value, c) => {
              const index = r * COLS + c;
              const digit = isDigit(value) ? fmt.number(value) : '';
              const isHint = hinted.has(index);
              const base = t.cellLabel(rowOf(index) + 1, colOf(index) + 1, digit || t.cellCleared);
              return (
                <Cell
                  key={c}
                  index={index}
                  value={value}
                  digit={digit}
                  label={isHint ? `${base}, ${t.cellHint}` : base}
                  selected={selected === index}
                  hinted={isHint}
                  burstToken={bursting.has(index) ? burst?.token : undefined}
                  errorToken={shaking.has(index) ? error?.token : undefined}
                  focusable={index === cur}
                  onActivate={activate}
                  onFocusCell={onCursor}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
