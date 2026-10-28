import { memo, type CSSProperties } from 'react';
import { Crown } from '../../components/brand/Crown';
import { useI18n } from '../../i18n';
import { colOf, isKing, rowOf, squareAt } from './engine';

export interface DisplayPiece {
  id: number;
  /** Square where the piece is drawn. */
  sq: number;
  value: number;
  /** taken: captured during the current sequence (still on the board); ghost: removed, fading out. */
  state?: 'taken' | 'ghost';
}

export type TargetKind = 'move' | 'capture';

interface BoardProps {
  pieces: readonly DisplayPiece[];
  /** Red (Black) at the bottom. */
  flipped: boolean;
  /** Squares holding a piece that can move now. */
  movable: ReadonlySet<number>;
  /** Square where the selected piece is drawn. */
  selected: number | null;
  targets: ReadonlyMap<number, TargetKind>;
  /** Opponent pieces that the next capture step can take. */
  victims: ReadonlySet<number>;
  /** Squares visited by the last move. */
  lastMove: readonly number[];
  /** Keyboard cursor, as a display cell index (0–63), or null when hidden. */
  cursor: number | null;
  /** Capturing is mandatory this turn (movable pieces pulse). */
  mandatory: boolean;
  onSquare: (sq: number) => void;
  onPointerUse: () => void;
}

/** Display cell (row-major, 0–63) ↔ board square, taking the orientation into account. */
export function cellToSquare(cell: number, flipped: boolean): number {
  const vr = cell >> 3;
  const vc = cell & 7;
  return flipped ? squareAt(7 - vr, 7 - vc) : squareAt(vr, vc);
}

export function squareToCell(sq: number, flipped: boolean): number {
  const r = rowOf(sq);
  const c = colOf(sq);
  return flipped ? (7 - r) * 8 + (7 - c) : r * 8 + c;
}

export const cellId = (cell: number) => `ck-cell-${cell}`;

export const Board = memo(function Board({ pieces, flipped, movable, selected, targets, victims, lastMove, cursor, mandatory, onSquare, onPointerUse }: BoardProps) {
  const { m } = useI18n();
  const t = m.checkers;
  const bySquare = new Map<number, DisplayPiece>();
  for (const p of pieces) if (p.state !== 'ghost') bySquare.set(p.sq, p);
  const last = new Set(lastMove);
  const lastTo = lastMove[lastMove.length - 1];

  const pieceName = (value: number) =>
    value === 1 ? t.pieces.wMan : value === 2 ? t.pieces.wKing : value === -1 ? t.pieces.bMan : t.pieces.bKing;

  const rows = Array.from({ length: 8 }, (_, vr) =>
    Array.from({ length: 8 }, (_, vc) => {
      const cell = vr * 8 + vc;
      const sq = cellToSquare(cell, flipped);
      if (sq < 0) return <div key={cell} role="presentation" className={cursor === cell ? 'ck-sq ck-sq--light is-cursor' : 'ck-sq ck-sq--light'} />;
      const piece = bySquare.get(sq);
      const target = targets.get(sq);
      const parts: string[] = [piece ? pieceName(piece.value) : t.emptySquare];
      if (piece?.state === 'taken') parts.push(t.states.captured);
      if (selected === sq) parts.push(t.states.selected);
      else if (movable.has(sq)) parts.push(t.states.movable);
      if (target) parts.push(t.states.target);
      if (last.has(sq)) parts.push(t.states.lastMove);
      const cls = [
        'ck-sq',
        'ck-sq--dark',
        last.has(sq) && 'is-last',
        sq === lastTo && 'is-last-to',
        target && `is-target is-target--${target}`,
        cursor === cell && 'is-cursor',
      ]
        .filter(Boolean)
        .join(' ');
      return (
        <div
          key={cell}
          id={cellId(cell)}
          role="gridcell"
          className={cls}
          aria-label={t.squareLabel(sq + 1, parts.join(', '))}
          aria-selected={selected === sq}
          onClick={() => {
            onPointerUse();
            onSquare(sq);
          }}
        >
          <span className="ck-sq__num" aria-hidden="true">
            {sq + 1}
          </span>
          {target && <span className="ck-sq__marker" aria-hidden="true" />}
        </div>
      );
    }),
  );

  return (
    <div
      className={mandatory ? 'ck-board no-gesture is-mandatory' : 'ck-board no-gesture'}
      role="grid"
      aria-label={t.boardLabel}
      tabIndex={0}
      aria-activedescendant={cursor !== null && cellToSquare(cursor, flipped) >= 0 ? cellId(cursor) : undefined}
    >
      <div className="ck-squares">
        {rows.map((row, vr) => (
          <div key={vr} role="row" className="ck-row">
            {row}
          </div>
        ))}
      </div>
      <div className="ck-pieces" aria-hidden="true">
        {pieces.map((p) => {
          const cell = squareToCell(p.sq, flipped);
          const style = { '--x': cell & 7, '--y': cell >> 3 } as CSSProperties;
          const cls = [
            'ck-piece',
            p.value > 0 ? 'ck-piece--w' : 'ck-piece--b',
            isKing(p.value) && 'is-king',
            p.state === 'taken' && 'is-taken',
            p.state === 'ghost' && 'is-ghost',
            !p.state && selected === p.sq && 'is-selected',
            !p.state && selected !== p.sq && movable.has(p.sq) && 'is-movable',
            !p.state && victims.has(p.sq) && 'is-victim',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={p.id} className={cls} style={style}>
              <div className="ck-piece__body">
                {isKing(p.value) && (
                  <span className="ck-piece__crown">
                    <Crown size={40} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
