import { GAMES } from '../../games/registry';
import { collectRecords, formatMetric, useGameData } from '../../services/gameData';
import { useI18n } from '../../i18n';
import { GameIcon } from '../../components/brand/GameIcon';
import { Crown } from '../../components/brand/Crown';
import { Icon } from '../../components/Icon';
import { href } from '../router';
import { EmptyState, PageTopBar, gameStyle } from './shared';

export function RecordsPage() {
  const { m, fmt } = useI18n();
  const data = useGameData(GAMES);
  const records = collectRecords(GAMES, data);

  return (
    <div className="page">
      <PageTopBar title={m.common.records.title} subtitle={m.common.records.subtitle} actions={<span className="badge-gold">{m.common.records.count(records.length)}</span>} />
      {records.length === 0 && <EmptyState icon={<Crown size={48} detailed />} text={m.common.records.empty} />}
      <ul className="records-list">
        {GAMES.map((meta, i) => {
          const d = data[i];
          if (!d) return null;
          const rows = meta.metrics.filter((metric) => metric.record).map((metric) => ({ metric, value: metric.value(d) }));
          const hasAny = rows.some((r) => r.value !== null);
          return (
            <li key={meta.id} className={hasAny ? 'record-card' : 'record-card is-empty'} style={gameStyle(meta)}>
              <a className="record-card__head" href={href({ name: 'stats', gameId: meta.id })}>
                <span className="record-card__art">
                  <GameIcon id={meta.id} size={40} />
                </span>
                <span className="record-card__name">{m.common.games[meta.id].name}</span>
                <Icon name="chevronRight" size={18} />
              </a>
              {hasAny ? (
                <dl className="record-card__rows">
                  {rows
                    .filter((r) => r.value !== null)
                    .map(({ metric, value }) => (
                      <div key={metric.key} className="record-row">
                        <dt>{metric.label(m)}</dt>
                        <dd className="tabular">
                          <Crown size={14} /> {formatMetric(metric, value as number, fmt)}
                        </dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p className="record-card__none">{m.common.home.noRecordYet}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
