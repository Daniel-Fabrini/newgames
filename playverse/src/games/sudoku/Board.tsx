import { memo, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { useI18n } from '../../i18n';
import { BOX, CELLS, COL, ROW, bit, digitsOf } from './grid';

export interface BoardProps {
  givens: readonly number[];
  values: readonly number[];
  notes: readonly number[];
  hinted: readonly number[];
  errors: readonly boolean[];
  conflicts: readonly boolean[];
  selected: number | null;
  highlightSame: boolean;
  /** Hide digits (pause). */
  hidden: boolean;
  /** Cell revealed by the latest hint (short highlight). */
  flash: number | null;
  solved: boolean;
  onSelect: (cell: number) => void;
}

const NOTE_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** CSS grid position: tracks 4 and 8 are the thick box separators. */
const placement = (cell: number): CSSProperties => {
  const r = ROW[cell]!;
  const c = COL[cell]!;
  return { gridRow: r + 1 + Math.floor(r / 3), gridColumn: c + 1 + Math.floor(c / 3) };
};

export const Board = memo(function Board({ givens, values, notes, hinted, errors, conflicts, selected, highlightSame, hidden, flash, solved, onSelect }: BoardProps) {
  const { m, fmt } = useI18n();
  const t = m.sudoku;
  const ref = useRef<HTMLDivElement>(null);
  const selValue = selected !== null ? values[selected]! : 0;

  // Keep DOM focus on the selected cell while the board has focus (keyboard navigation).
  useEffect(() => {
    const root = ref.current;
    if (!root || selected === null || !root.contains(document.activeElement)) return;
    const el = root.querySelector<HTMLElement>(`[data-cell="${selected}"]`);
    if (el && el !== document.activeElement) el.focus();
  }, [selected]);

  const cells: ReactElement[] = [];
  for (let i = 0; i < CELLS; i++) {
    const value = values[i]!;
    const given = givens[i] !== 0;
    const isHint = hinted.includes(i);
    const related = selected !== null && i !== selected && (ROW[i] === ROW[selected] || COL[i] === COL[selected] || BOX[i] === BOX[selected]);
    const same = highlightSame && selValue !== 0 && value === selValue && i !== selected;
    const error = !hidden && errors[i] === true;
    const conflict = !hidden && conflicts[i] === true;
    const cls = [
      'sd-cell',
      given ? 'is-given' : value ? (isHint ? 'is-hinted' : 'is-entry') : 'is-empty',
      i === selected && 'is-selected',
      related && 'is-related',
      same && 'is-same',
      error && 'is-error',
      conflict && 'is-conflict',
      flash === i && 'is-flash',
    ]
      .filter(Boolean)
      .join(' ');

    let content: string;
    if (hidden) content = t.board.empty;
    else if (value) {
      const parts = [fmt.number(value)];
      if (given) parts.push(t.board.given);
      else if (isHint) parts.push(t.board.hinted);
      if (error) parts.push(t.board.wrong);
      if (conflict) parts.push(t.board.conflict);
      content = parts.join(', ');
    } else if (notes[i]) content = t.board.notes(fmt.list(digitsOf(notes[i]!).map((d) => fmt.number(d))));
    else content = t.board.empty;

    cells.push(
      <div
        key={i}
        role="gridcell"
        data-cell={i}
        className={cls}
        style={placement(i)}
        tabIndex={i === (selected ?? 0) ? 0 : -1}
        aria-selected={i === selected}
        aria-readonly={given || isHint || solved}
        aria-label={t.board.cell(ROW[i]! + 1, COL[i]! + 1, content)}
        onClick={() => onSelect(i)}
      >
        {!hidden && value !== 0 && (
          <span className="sd-digit" aria-hidden="true">
            {fmt.number(value)}
          </span>
        )}
        {!hidden && value === 0 && notes[i] !== 0 && (
          <span className="sd-notes" aria-hidden="true">
            {NOTE_DIGITS.map((d) => (
              <span key={d} className={highlightSame && d === selValue ? 'is-match' : undefined}>
                {notes[i]! & bit(d) ? fmt.number(d) : ''}
              </span>
            ))}
          </span>
        )}
        {error && (
          <span className="sd-badge sd-badge--error" aria-hidden="true">
            ×
          </span>
        )}
        {conflict && !error && (
          <span className="sd-badge sd-badge--conflict" aria-hidden="true">
            !
          </span>
        )}
      </div>,
    );
  }

  // Rows for assistive technology; `display: contents` keeps the visual grid flat.
  const rows = Array.from({ length: 9 }, (_, r) => (
    <div role="row" key={r} className="sd-row">
      {cells.slice(r * 9, r * 9 + 9)}
    </div>
  ));

  return (
    <div className={['sd-board', 'no-gesture', hidden && 'is-hidden', solved && 'is-solved'].filter(Boolean).join(' ')}>
      <div ref={ref} className="sd-grid" role="grid" aria-label={hidden ? t.board.hiddenLabel : t.board.label} aria-readonly={solved}>
        {rows}
      </div>
    </div>
  );
});
