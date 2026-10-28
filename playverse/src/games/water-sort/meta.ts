import { fromMetric, fromStat, levelsCompleted, starsEarned, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'water-sort',
  categories: ['puzzle', 'logic'],
  progression: 'levels',
  progressTracks: ['main'],
  metricRules: { moves: 'sum', perfectLevels: 'sum' },
  headline: 'levelsCompleted',
  metrics: [
    { key: 'levelsCompleted', label: (m) => m.common.metrics.levelsCompleted, value: levelsCompleted('main'), format: 'number', record: true },
    { key: 'starsEarned', label: (m) => m.common.metrics.starsEarned, value: starsEarned('main'), format: 'number', record: true },
    { key: 'perfectLevels', label: (m) => m.common.metrics.perfectLevels, value: fromMetric('perfectLevels'), format: 'number' },
    { key: 'totalMoves', label: (m) => m.common.metrics.totalMoves, value: fromMetric('moves'), format: 'number' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
