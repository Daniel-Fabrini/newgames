import { fromMetric, fromStat, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'game-2048',
  categories: ['puzzle', 'classic'],
  progression: 'score',
  metricRules: { bestTile: 'max', moves: 'sum' },
  headline: 'bestScore',
  metrics: [
    { key: 'bestScore', label: (m) => m.common.metrics.bestScore, value: fromStat('bestScore'), format: 'number', record: true },
    { key: 'bestTile', label: (m) => m.common.metrics.bestTile, value: fromMetric('bestTile'), format: 'number', record: true },
    { key: 'reached2048', label: (m) => m.common.metrics.reached2048, value: fromStat('wins'), format: 'number' },
    { key: 'totalMoves', label: (m) => m.common.metrics.totalMoves, value: fromMetric('moves'), format: 'number' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
