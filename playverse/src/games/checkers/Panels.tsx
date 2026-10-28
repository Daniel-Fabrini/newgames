import { useEffect, useRef } from 'react';
import { Crown } from '../../components/brand/Crown';
import { useI18n } from '../../i18n';
import { notation, opponent, type Move, type Side } from './engine';

/** Small glossy disc in a side's colour (legends, player bars, setup options). */
export function MiniPiece({ side, king = false }: { side: Side; king?: boolean }) {
  return (
    <span className={`ck-mini ck-mini--${side}`} aria-hidden="true">
      {king && <Crown size={12} />}
    </span>
  );
}

interface PlayerBarProps {
  side: Side;
  name: string;
  active: boolean;
  thinking: boolean;
  captured: number;
  winner: boolean;
}

/** Name, turn indicator and capture counter of one player. */
export function PlayerBar({ side, name, active, thinking, captured, winner }: PlayerBarProps) {
  const { m, fmt } = useI18n();
  const t = m.checkers;
  const cls = ['ck-player', `ck-player--${side}`, active && 'is-active', winner && 'is-winner'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <MiniPiece side={side} />
      <span className="ck-player__name">{name}</span>
      <span className="ck-player__status" aria-live="off">
        {thinking ? (
          <>
            <span className="spinner" aria-hidden="true" /> {m.common.game.thinking}
          </>
        ) : winner ? (
          <>
            <Crown size={14} /> {m.common.game.victory}
          </>
        ) : active ? (
          t.toMove
        ) : null}
      </span>
      <span className="ck-player__captured" aria-label={t.capturedCount(captured)} title={t.capturedCount(captured)}>
        <MiniPiece side={opponent(side)} />
        <span className="tabular">×{fmt.number(captured)}</span>
      </span>
    </div>
  );
}

/** Move history in standard notation, numbered in pairs (White, Red). */
export function MoveList({ moves, className }: { moves: readonly Move[]; className?: string }) {
  const { m } = useI18n();
  const t = m.checkers;
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  if (moves.length === 0) return <p className={['ck-history', 'ck-history--empty', className].filter(Boolean).join(' ')}>{m.common.game.noHistory}</p>;

  const pairs: Array<[Move, Move | undefined]> = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i] as Move, moves[i + 1]]);
  const lastIndex = moves.length - 1;
  return (
    <ol ref={ref} className={['ck-history', className].filter(Boolean).join(' ')} aria-label={t.historyLabel}>
      {pairs.map(([white, red], i) => (
        <li key={i} className="ck-history__row">
          <span className="ck-history__num">{t.moveNumber(i + 1)}</span>
          <span className={i * 2 === lastIndex ? 'ck-history__move is-last' : 'ck-history__move'} aria-label={`${t.sides.w}: ${notation(white)}`}>
            {notation(white)}
          </span>
          {red ? (
            <span className={i * 2 + 1 === lastIndex ? 'ck-history__move is-last' : 'ck-history__move'} aria-label={`${t.sides.b}: ${notation(red)}`}>
              {notation(red)}
            </span>
          ) : (
            <span className="ck-history__move" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}
