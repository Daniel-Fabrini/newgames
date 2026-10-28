import { memo, useEffect, useRef } from 'react';
import { IconButton } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { LOCALE_INFO, useI18n } from '../../i18n';
import { isWordConfirmed, isWordFilled, type GridModel, type PlayState, type WordModel } from './engine';
import type { Dir } from './types';

interface ClueBarProps {
  word: WordModel | undefined;
  lang: keyof typeof LOCALE_INFO;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  canToggle: boolean;
  disabled: boolean;
}

/** Current clue (number + direction + text) with previous/next arrows; tapping the text switches direction. */
export function ClueBar({ word, lang, onPrev, onNext, onToggle, canToggle, disabled }: ClueBarProps) {
  const { m } = useI18n();
  const t = m.crossword;
  const ref = word ? t.clueRef(word.number, t.dir[word.dir]) : '';
  return (
    <div className="cw-cluebar">
      <IconButton icon="chevronLeft" label={t.prevClue} onClick={onPrev} disabled={disabled} size="sm" />
      <button
        type="button"
        className="cw-cluebar__text"
        onClick={onToggle}
        disabled={disabled || !canToggle}
        aria-label={canToggle ? `${t.toggleDirection}. ${ref}: ${word?.clue ?? ''}` : `${ref}: ${word?.clue ?? ''}`}
      >
        <span className="cw-cluebar__ref">
          {ref}
          {canToggle && <Icon name="swap" size={14} />}
        </span>
        <span className="cw-cluebar__clue" lang={LOCALE_INFO[lang].intl}>
          {word?.clue}
        </span>
      </button>
      <IconButton icon="chevronRight" label={t.nextClue} onClick={onNext} disabled={disabled} size="sm" />
    </div>
  );
}

interface ClueListProps {
  model: GridModel;
  play: PlayState;
  activeWord: number;
  onPick: (word: number) => void;
  /** Scroll the active clue into view (side panel). */
  follow?: boolean;
}

/** Full clue list split into Across and Down; tapping a clue jumps to it. */
export const ClueList = memo(function ClueList({ model, play, activeWord, onPick, follow }: ClueListProps) {
  const { m } = useI18n();
  const t = m.crossword;
  const listRef = useRef<HTMLDivElement>(null);
  const intl = LOCALE_INFO[model.puzzle.lang].intl;

  useEffect(() => {
    if (!follow) return;
    const el = listRef.current?.querySelector<HTMLElement>('.cw-clue.is-active');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeWord, follow]);

  const section = (dir: Dir, title: string) => (
    <section className="cw-clues__section" aria-label={title}>
      <h3 className="cw-clues__title">{title}</h3>
      <ul className="cw-clues__list">
        {model.words
          .filter((w) => w.dir === dir)
          .map((w) => {
            const active = w.index === activeWord;
            const filled = isWordFilled(play, model, w.index);
            const confirmed = isWordConfirmed(play, model, w.index);
            return (
              <li key={w.index}>
                <button
                  type="button"
                  className={['cw-clue', active && 'is-active', filled && 'is-filled'].filter(Boolean).join(' ')}
                  aria-current={active || undefined}
                  onClick={() => onPick(w.index)}
                >
                  <span className="cw-clue__num">{w.number}</span>
                  <span className="cw-clue__body">
                    <span className="cw-clue__text" lang={intl}>
                      {w.clue}
                    </span>
                    {confirmed && (
                      <span className="cw-clue__solution" lang={intl}>
                        {t.solution(w.display)}
                      </span>
                    )}
                  </span>
                  {filled && <Icon name="check" size={16} className="cw-clue__check" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );

  return (
    <div className="cw-clues" ref={listRef}>
      {section('across', t.across)}
      {section('down', t.down)}
    </div>
  );
});
