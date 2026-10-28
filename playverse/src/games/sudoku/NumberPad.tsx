import { memo } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';

interface NumberPadProps {
  /** Placed count per digit (index 1–9). */
  counts: readonly number[];
  notesMode: boolean;
  disabled: boolean;
  onDigit: (digit: number) => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Big digit buttons showing how many of each digit are still missing. */
export const NumberPad = memo(function NumberPad({ counts, notesMode, disabled, onDigit }: NumberPadProps) {
  const { m, fmt } = useI18n();
  const t = m.sudoku.pad;
  return (
    <div className={notesMode ? 'sd-pad is-notes' : 'sd-pad'} role="group" aria-label={t.label}>
      {DIGITS.map((d) => {
        const left = Math.max(0, 9 - (counts[d] ?? 0));
        const complete = left === 0;
        const label = complete ? t.complete(d) : notesMode ? t.note(d) : t.place(d, left);
        return (
          <button
            key={d}
            type="button"
            className="sd-key"
            disabled={disabled || complete}
            aria-label={label}
            title={label}
            onClick={() => onDigit(d)}
          >
            <span className="sd-key__digit" aria-hidden="true">
              {fmt.number(d)}
            </span>
            <span className="sd-key__left" aria-hidden="true">
              {complete ? <Icon name="check" size={14} /> : fmt.number(left)}
            </span>
          </button>
        );
      })}
    </div>
  );
});
