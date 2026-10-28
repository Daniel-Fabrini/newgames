import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SegmentedControl } from '../../components/Controls';
import { Flag } from '../../components/brand/Flag';
import { LOCALE_INFO, useI18n } from '../../i18n';
import { PRESETS, parsePuzzleId, presetId } from './puzzles';
import type { SolvedRecord } from './save';
import { PUZZLE_LANGS, type PuzzleLang } from './types';

export interface InProgressItem {
  id: string;
  /** Filled fraction 0..1. */
  filled: number;
  elapsedMs: number;
  current: boolean;
}

interface PuzzlePickerProps {
  open: boolean;
  onClose: () => void;
  uiLang: PuzzleLang;
  inProgress: readonly InProgressItem[];
  solved: Readonly<Record<string, SolvedRecord>>;
  onOpen: (id: string) => void;
  onNewGrid: () => void;
}

export function usePuzzleName() {
  const { m } = useI18n();
  return (id: string) => {
    const ref = parsePuzzleId(id);
    if (!ref) return id;
    return ref.kind === 'preset' ? m.crossword.puzzleName.preset(ref.n) : m.crossword.puzzleName.generated(ref.n);
  };
}

/** "Grids" sheet: new generated grid, puzzles in progress and the starter grids of each language. */
export function PuzzlePicker({ open, onClose, uiLang, inProgress, solved, onOpen, onNewGrid }: PuzzlePickerProps) {
  const { m, fmt } = useI18n();
  const t = m.crossword;
  const nameOf = usePuzzleName();
  const [presetLang, setPresetLang] = useState<PuzzleLang>(uiLang);
  const progressById = new Map(inProgress.map((p) => [p.id, p]));

  const langOf = (id: string): PuzzleLang => parsePuzzleId(id)?.lang ?? uiLang;

  return (
    <Modal open={open} onClose={onClose} title={t.gridsTitle} size="md" icon={<Icon name="grid" size={22} />} className="cw-picker">
      <p className="cw-picker__intro">{t.gridsIntro}</p>
      <div className="cw-picker__new">
        <Button variant="primary" size="lg" block icon="plus" onClick={onNewGrid}>
          {t.newGridIn(t.langName[uiLang])}
        </Button>
        <p className="cw-picker__hint">{t.newGridHint(t.langName[uiLang])}</p>
      </div>

      <section className="cw-picker__section" aria-labelledby="cw-inprogress-title">
        <h3 id="cw-inprogress-title">{t.inProgress}</h3>
        {inProgress.length === 0 ? (
          <p className="cw-picker__empty">{t.noneInProgress}</p>
        ) : (
          <ul className="cw-picker__list">
            {inProgress.map((p) => (
              <li key={p.id}>
                <button type="button" className={p.current ? 'cw-pick is-current' : 'cw-pick'} onClick={() => onOpen(p.id)} aria-current={p.current || undefined}>
                  <Flag locale={langOf(p.id)} size={26} />
                  <span className="cw-pick__body">
                    <span className="cw-pick__name">{nameOf(p.id)}</span>
                    <span className="cw-pick__meta">
                      {t.langName[langOf(p.id)]} · {t.filledPct(fmt.percent(p.filled))} · {fmt.clock(p.elapsedMs)}
                    </span>
                  </span>
                  {p.current ? <span className="cw-pick__tag">{t.statusCurrent}</span> : <Icon name="chevronRight" size={20} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cw-picker__section" aria-labelledby="cw-starter-title">
        <h3 id="cw-starter-title">{t.starterGrids}</h3>
        <SegmentedControl
          label={t.starterLanguage}
          size="sm"
          value={presetLang}
          onChange={setPresetLang}
          options={PUZZLE_LANGS.map((l) => ({ value: l, label: LOCALE_INFO[l].label }))}
        />
        <ul className="cw-picker__list">
          {PRESETS[presetLang].map((_, i) => {
            const id = presetId(presetLang, i + 1);
            const record = solved[id];
            const progress = progressById.get(id);
            const status = progress
              ? progress.current
                ? t.statusCurrent
                : t.filledPct(fmt.percent(progress.filled))
              : record
                ? `${t.statusSolved} · ${t.bestTimeShort(fmt.clock(record.bestTimeMs))}`
                : t.statusNew;
            return (
              <li key={id}>
                <button type="button" className={progress?.current ? 'cw-pick is-current' : 'cw-pick'} onClick={() => onOpen(id)}>
                  <span className={record ? 'cw-pick__badge is-solved' : 'cw-pick__badge'} aria-hidden="true">
                    {record ? <Icon name="check" size={18} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="cw-pick__body">
                    <span className="cw-pick__name">{nameOf(id)}</span>
                    <span className="cw-pick__meta">{status}</span>
                  </span>
                  {record && (
                    <span className="cw-pick__stars" role="img" aria-label={m.common.game.starsOf(record.stars, 3)}>
                      {[0, 1, 2].map((s) => (
                        <Icon key={s} name="star" size={16} filled={s < record.stars} className={s < record.stars ? 'is-on' : ''} />
                      ))}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </Modal>
  );
}
