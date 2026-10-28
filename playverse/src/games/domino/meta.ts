import { fromMetric, fromStat, winRateOf, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'domino',
  categories: ['board', 'classic'],
  progression: 'match',
  metricRules: { points: 'sum', bestRound: 'max' },
  headline: 'wins',
  metrics: [
    { key: 'wins', label: (m) => m.common.metrics.wins, value: fromStat('wins'), format: 'number', record: true },
    { key: 'bestStreak', label: (m) => m.common.metrics.bestStreak, value: fromStat('bestStreak'), format: 'number', record: true },
    { key: 'bestRound', label: (m) => m.common.metrics.bestRound, value: fromMetric('bestRound'), format: 'number', record: true },
    { key: 'totalPoints', label: (m) => m.common.metrics.totalPoints, value: fromMetric('points'), format: 'number' },
    { key: 'losses', label: (m) => m.common.metrics.losses, value: fromStat('losses'), format: 'number' },
    { key: 'draws', label: (m) => m.common.metrics.draws, value: fromStat('draws'), format: 'number' },
    { key: 'winRate', label: (m) => m.common.metrics.winRate, value: winRateOf, format: 'percent' },
  ],
};
