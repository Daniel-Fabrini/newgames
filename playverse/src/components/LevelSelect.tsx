import { useState } from 'react';
import { Icon } from './Icon';
import { IconButton } from './Button';
import { useI18n } from '../i18n';
import type { LevelProgress } from '../services/progress';

interface LevelSelectProps {
  progress: LevelProgress;
  onSelect: (level: number) => void;
  /** Total levels when the campaign is finite; omit for generated, unbounded campaigns. */
  total?: number;
  pageSize?: number;
}

/**
 * Paged level grid with locked/unlocked/completed states and stars.
 * For unbounded campaigns, pages continue as long as levels are unlocked.
 */
export function LevelSelect({ progress, onSelect, total, pageSize = 20 }: LevelSelectProps) {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const lastVisible = total ?? Math.max(progress.unlocked + 4, pageSize);
  const pages = Math.max(1, Math.ceil(lastVisible / pageSize));
  const [page, setPage] = useState(() => Math.min(pages - 1, Math.floor((progress.current - 1) / pageSize)));
  const first = page * pageSize + 1;
  const levels = Array.from({ length: pageSize }, (_, i) => first + i).filter((l) => l <= lastVisible);

  return (
    <div className="level-select">
      <div className="level-select__grid">
        {levels.map((level) => {
          const result = progress.completed[String(level)];
          const locked = level > progress.unlocked;
          const current = level === progress.current && !result;
          const label = locked
            ? `${g.levelN(level)} — ${g.locked}`
            : result
              ? `${g.levelN(level)} — ${g.completed}, ${g.starsOf(result.stars, 3)}`
              : g.levelN(level);
          return (
            <button
              key={level}
              type="button"
              className={['level-tile', locked && 'is-locked', result && 'is-done', current && 'is-current'].filter(Boolean).join(' ')}
              disabled={locked}
              onClick={() => onSelect(level)}
              aria-label={label}
            >
              {locked ? <Icon name="lock" size={18} /> : <span className="level-tile__num tabular">{fmt.number(level)}</span>}
              {result && (
                <span className="level-tile__stars" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <Icon key={i} name="star" size={11} filled={i < result.stars} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="level-select__pager">
          <IconButton icon="chevronLeft" label={g.previousPage} size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} />
          <span className="tabular">
            {fmt.number(first)}–{fmt.number(Math.min(first + pageSize - 1, lastVisible))}
          </span>
          <IconButton icon="chevronRight" label={g.nextPage} size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} />
        </div>
      )}
    </div>
  );
}
