import { memo } from 'react';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import type { PuzzleLang } from './types';

const LAYOUTS: Record<PuzzleLang, readonly string[]> = {
  pt: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  es: ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'],
};

interface KeyboardProps {
  lang: PuzzleLang;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  onToggle: () => void;
  disabled: boolean;
}

/** On-screen QWERTY keyboard for touch devices (the Spanish layout includes Ñ). */
export const Keyboard = memo(function Keyboard({ lang, onLetter, onBackspace, onToggle, disabled }: KeyboardProps) {
  const { m } = useI18n();
  const t = m.crossword;
  const rows = LAYOUTS[lang];
  return (
    <div className="cw-keyboard no-gesture" role="group" aria-label={t.keyboardLabel} data-cols={Math.max(...rows.map((r) => [...r].length))}>
      {rows.map((row, i) => (
        <div className="cw-keyboard__row" key={row}>
          {i === rows.length - 1 && (
            <button type="button" className="cw-key cw-key--wide" onClick={onToggle} disabled={disabled} aria-label={t.toggleDirection} title={t.toggleDirection}>
              <Icon name="swap" size={20} />
            </button>
          )}
          {[...row].map((letter) => (
            <button type="button" key={letter} className="cw-key" onClick={() => onLetter(letter)} disabled={disabled}>
              {letter}
            </button>
          ))}
          {i === rows.length - 1 && (
            <button type="button" className="cw-key cw-key--wide" onClick={onBackspace} disabled={disabled} aria-label={t.backspace} title={t.backspace}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M21 5H8.5L2 12l6.5 7H21a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                <path d="m11 9 6 6M17 9l-6 6" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
});
