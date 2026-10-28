import { useState } from 'react';
import { GAMES, GAME_META } from '../../games/registry';
import { computeXp, formatMetric, levelForXp, useGameData } from '../../services/gameData';
import { resetStats, winRate } from '../../services/stats';
import { useI18n } from '../../i18n';
import { GameIcon } from '../../components/brand/GameIcon';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { href } from '../router';
import { PageTopBar, gameStyle } from './shared';
import type { GameId } from '../../types/game';
import type { GameData } from '../../games/types';

export function StatsPage({ gameId }: { gameId?: GameId }) {
  return gameId ? <GameStatsDetail gameId={gameId} /> : <StatsOverview />;
}

function StatsOverview() {
  const { m, fmt } = useI18n();
  const s = m.common.stats;
  const data = useGameData(GAMES);
  const totals = data.reduce(
    (acc, d) => ({
      played: acc.played + d.stats.played,
      wins: acc.wins + d.stats.wins,
      time: acc.time + d.stats.totalDurationMs,
      stars: acc.stars + Object.values(d.progress).reduce((a, p) => a + Object.values(p.completed).reduce((b, r) => b + r.stars, 0), 0),
    }),
    { played: 0, wins: 0, time: 0, stars: 0 },
  );
  const xp = computeXp(data);
  const level = levelForXp(xp);

  return (
    <div className="page">
      <PageTopBar title={s.title} subtitle={s.overview} />
      <section className="level-card" aria-label={m.common.home.playerLevel(level.level)}>
        <div className="level-card__badge">
          <span className="tabular">{fmt.number(level.level)}</span>
        </div>
        <div className="level-card__text">
          <strong>{m.common.home.playerLevel(level.level)}</strong>
          <div
            className="progress"
            role="progressbar"
            aria-label={m.common.home.xpProgress(level.current, level.next)}
            aria-valuemin={0}
            aria-valuemax={level.next}
            aria-valuenow={level.current}
          >
            <span style={{ width: `${(level.current / level.next) * 100}%` }} />
          </div>
          <span className="muted small">{m.common.home.xpProgress(level.current, level.next)}</span>
        </div>
      </section>
      <p className="muted small center">{m.common.home.xpHint}</p>
      <div className="tiles">
        <Tile label={s.played} value={fmt.number(totals.played)} icon="layers" />
        <Tile label={s.wins} value={fmt.number(totals.wins)} icon="trophy" />
        <Tile label={s.starsEarned} value={fmt.number(totals.stars)} icon="star" />
        <Tile label={s.totalTime} value={totals.time > 0 ? fmt.duration(totals.time) : '—'} icon="timer" />
      </div>
      <ul className="stats-list">
        {GAMES.map((meta, i) => {
          const d = data[i]!;
          return (
            <li key={meta.id}>
              <a className="stats-row" href={href({ name: 'stats', gameId: meta.id })} style={gameStyle(meta)}>
                <span className="stats-row__art">
                  <GameIcon id={meta.id} size={36} />
                </span>
                <span className="stats-row__text">
                  <strong>{m.common.games[meta.id].name}</strong>
                  <span className="muted small">
                    {s.played}: {fmt.number(d.stats.played)}
                    {d.stats.lastPlayedAt ? ` · ${s.lastPlayed}: ${fmt.relative(d.stats.lastPlayedAt)}` : ''}
                  </span>
                </span>
                <Icon name="chevronRight" size={18} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: 'layers' | 'trophy' | 'star' | 'timer' | 'flag' | 'swap' | 'bolt' | 'chart' }) {
  return (
    <div className="tile">
      <Icon name={icon} size={20} />
      <span className="tile__value tabular">{value}</span>
      <span className="tile__label">{label}</span>
    </div>
  );
}

function GameStatsDetail({ gameId }: { gameId: GameId }) {
  const { m, fmt } = useI18n();
  const s = m.common.stats;
  const meta = GAME_META[gameId];
  const [d] = useGameData([meta]) as [GameData];
  const [confirm, setConfirm] = useState(false);
  const name = m.common.games[gameId].name;
  const st = d.stats;
  const showOutcomes = meta.progression === 'match' || meta.progression === 'puzzle';

  return (
    <div className="page">
      <PageTopBar title={name} subtitle={s.title} back />
      <div className="stats-hero" style={gameStyle(meta)}>
        <GameIcon id={gameId} size={72} />
        <a className="btn btn--gold btn--md" href={href({ name: 'game', gameId })}>
          <Icon name="play" size={18} />
          <span className="btn__label">{m.common.home.play}</span>
        </a>
      </div>
      <div className="tiles">
        <Tile label={s.played} value={fmt.number(st.played)} icon="layers" />
        {showOutcomes && <Tile label={s.wins} value={fmt.number(st.wins)} icon="trophy" />}
        {meta.progression === 'match' && <Tile label={s.losses} value={fmt.number(st.losses)} icon="flag" />}
        {meta.progression === 'match' && <Tile label={s.draws} value={fmt.number(st.draws)} icon="swap" />}
        {showOutcomes && <Tile label={s.winRate} value={st.played ? fmt.percent(winRate(st)) : '—'} icon="chart" />}
        {meta.progression === 'match' && <Tile label={s.currentStreak} value={fmt.number(st.currentStreak)} icon="bolt" />}
        <Tile label={s.totalTime} value={st.totalDurationMs > 0 ? fmt.duration(st.totalDurationMs) : '—'} icon="timer" />
      </div>
      <section className="panel">
        <h2 className="section-title">{m.common.records.title}</h2>
        <dl className="metric-list">
          {meta.metrics.map((metric) => {
            const value = metric.value(d);
            return (
              <div key={metric.key} className="metric-row">
                <dt>{metric.label(m)}</dt>
                <dd className="tabular">{value === null ? '—' : formatMetric(metric, value, fmt)}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      <section className="panel">
        <h2 className="section-title">{s.history}</h2>
        {st.history.length === 0 ? (
          <p className="muted">{s.noHistory}</p>
        ) : (
          <ol className="history-list">
            {st.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className={`history-item history-item--${h.outcome}`}>
                <span className="history-item__outcome">{s.outcome[h.outcome]}</span>
                <span className="history-item__detail tabular">
                  {h.score !== undefined && `${fmt.number(h.score)} ${m.common.game.score.toLowerCase()}`}
                  {h.score !== undefined && h.durationMs !== undefined && ' · '}
                  {h.durationMs !== undefined && fmt.clock(h.durationMs)}
                </span>
                <time className="history-item__date" dateTime={new Date(h.at).toISOString()}>
                  {fmt.relative(h.at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="center">
        <Button variant="ghost" icon="trash" onClick={() => setConfirm(true)} disabled={st.played === 0}>
          {s.resetGame}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={s.resetGameTitle(name)}
        body={s.resetGameBody}
        confirmLabel={s.resetGame}
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          resetStats(gameId);
          setConfirm(false);
          toast(s.resetGame, { tone: 'success' });
        }}
      />
    </div>
  );
}
