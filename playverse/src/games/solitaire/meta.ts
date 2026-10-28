import { fromMetric, fromStat, winRateOf, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'solitaire',
  categories: ['cards', 'classic'],
  progression: 'match',
  metricRules: { bestTimeMs: 'min' },
  headline: 'wins',
  metrics: [
    { key: 'wins', label: (m) => m.common.metrics.wins, value: fromStat('wins'), format: 'number', record: true },
    { key: 'bestTime', label: (m) => m.common.metrics.bestTime, value: fromMetric('bestTimeMs'), format: 'duration', record: true },
    { key: 'bestScore', label: (m) => m.common.metrics.bestScore, value: fromStat('bestScore'), format: 'number', record: true },
    { key: 'winRate', label: (m) => m.common.metrics.winRate, value: winRateOf, format: 'percent' },
    { key: 'bestStreak', label: (m) => m.common.metrics.bestStreak, value: fromStat('bestStreak'), format: 'number' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
