import { memo } from 'react';
import { isRed, rankOf, suitOf, type Suit } from './engine';

/** Suit symbols drawn as SVG (consistent on every platform, never emoji). */
export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {suit === 'hearts' && <path d="M12 21.4C6.1 17 2.4 13.6 2.4 9.2 2.4 6.1 4.8 3.7 7.7 3.7c1.8 0 3.3.9 4.3 2.4 1-1.5 2.5-2.4 4.3-2.4 2.9 0 5.3 2.4 5.3 5.5 0 4.4-3.7 7.8-9.6 12.2z" />}
      {suit === 'diamonds' && <path d="M12 1.8c2.3 3.7 5 7 8 10.2-3 3.2-5.7 6.5-8 10.2-2.3-3.7-5-7-8-10.2 3-3.2 5.7-6.5 8-10.2z" />}
      {suit === 'spades' && (
        <path d="M12 1.9C9.2 5.9 3.2 9.2 3.2 13.8c0 2.7 2.1 4.6 4.6 4.6 1.4 0 2.6-.6 3.3-1.5L9.9 22h4.2l-1.2-5.1c.7.9 1.9 1.5 3.3 1.5 2.5 0 4.6-1.9 4.6-4.6 0-4.6-6-7.9-8.8-11.9z" />
      )}
      {suit === 'clubs' && (
        <>
          <circle cx="12" cy="7" r="4.4" />
          <circle cx="6.9" cy="13.6" r="4.4" />
          <circle cx="17.1" cy="13.6" r="4.4" />
          <path d="M10.6 11.5h2.8l1.1 10.5h-5z" />
        </>
      )}
    </svg>
  );
}

interface CardFaceProps {
  id: number;
  up: boolean;
  /** Rank index (A, 2…10, J, Q, K) in the active language. */
  rankLabel: string;
}

/** Card face (rank + suit in the corner, large suit or court emblem in the centre) or the PlayVerse back. */
export const CardFace = memo(function CardFace({ id, up, rankLabel }: CardFaceProps) {
  if (!up) {
    return (
      <span className="sol-card__back">
        <span className="sol-card__back-emblem" />
      </span>
    );
  }
  const suit = suitOf(id);
  const rank = rankOf(id);
  const court = rank > 10;
  return (
    <span className={isRed(id) ? 'sol-card__face is-red' : 'sol-card__face is-black'} data-rank={rank}>
      <span className="sol-card__index">
        <span className="sol-card__rank">{rankLabel}</span>
        <SuitIcon suit={suit} className="sol-card__suit" />
      </span>
      {court ? (
        <span className="sol-card__court">
          <span className="sol-card__court-rank">{rankLabel}</span>
          <SuitIcon suit={suit} className="sol-card__court-suit" />
        </span>
      ) : (
        <SuitIcon suit={suit} className={rank === 1 ? 'sol-card__pip is-ace' : 'sol-card__pip'} />
      )}
      <span className="sol-card__index is-bottom">
        <span className="sol-card__rank">{rankLabel}</span>
        <SuitIcon suit={suit} className="sol-card__suit" />
      </span>
    </span>
  );
});
