import { memo, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { useI18n } from '../../i18n';
import { wordAt, type Cursor, type GridModel, type PlayState } from './engine';

interface BoardProps {
  model: GridModel;
  play: PlayState;
  cursor: Cursor;
  /** Hides letters and numbers (pause). */
  hidden: boolean;
  /** Input disabled (completed puzzle). */
  readOnly: boolean;
  onSelect: (cell: number) => void;
  boardRef: RefObject<HTMLDivElement | null>;
}

export const cellId = (index: number) => `cw-cell-${index}`;

export const Board = memo(function Board({ model, play, cursor, hidden, readOnly, onSelect, boardRef }: BoardProps) {
  const { m } = useI18n();
  const t = m.crossword;
  const activeWord = model.words[wordAt(model, cursor.cell, cursor.dir)];
  const inWord = new Set(activeWord?.cells ?? []);
  const style = { '--cols': model.width, '--rows': model.height } as CSSProperties;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    if (!target) return;
    e.preventDefault();
    boardRef.current?.focus({ preventScroll: true });
    onSelect(Number(target.dataset.cell));
  };

  const rows = Array.from({ length: model.height }, (_, r) => r);
  const cols = Array.from({ length: model.width }, (_, c) => c);

  return (
    <div
      ref={boardRef}
      className={['cw-board', 'no-gesture', hidden && 'is-hidden', readOnly && 'is-readonly'].filter(Boolean).join(' ')}
      style={style}
      role="grid"
      aria-label={t.boardLabel(model.width, model.height)}
      aria-readonly={readOnly || undefined}
      aria-activedescendant={hidden ? undefined : cellId(cursor.cell)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      lang={model.puzzle.lang}
    >
      {rows.map((r) => (
        <div role="row" className="cw-row" key={r}>
          {cols.map((c) => {
            const index = r * model.width + c;
            const cell = model.cells[index];
            if (!cell) return <div role="gridcell" key={c} className="cw-cell is-block" aria-hidden="true" />;
            const letter = hidden ? '' : (play.entries[index] ?? '');
            const mark = hidden ? '' : play.marks[index];
            const selected = index === cursor.cell && !readOnly;
            const cls = [
              'cw-cell',
              !hidden && inWord.has(index) && !readOnly && 'is-word',
              !hidden && selected && 'is-selected',
              mark === 'wrong' && 'is-wrong',
              mark === 'ok' && 'is-ok',
              mark === 'revealed' && 'is-revealed',
            ]
              .filter(Boolean)
              .join(' ');
            const markLabel = mark === 'wrong' ? t.markWrong : mark === 'ok' ? t.markOk : mark === 'revealed' ? t.markRevealed : '';
            const content = [letter || t.cellEmpty, markLabel].filter(Boolean).join(', ');
            return (
              <div
                role="gridcell"
                key={c}
                id={cellId(index)}
                data-cell={index}
                className={cls}
                aria-selected={selected}
                aria-label={t.cellLabel(r + 1, c + 1, content)}
              >
                {cell.number !== null && !hidden && <span className="cw-num">{cell.number}</span>}
                <span className="cw-letter" aria-hidden="true">
                  {letter}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      {hidden && <p className="cw-hidden-note">{t.pausedHidden}</p>}
    </div>
  );
});
