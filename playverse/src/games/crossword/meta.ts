import { fromMetric, fromStat, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'crossword',
  categories: ['logic', 'puzzle'],
  progression: 'puzzle',
  metricRules: { bestTimeMs: 'min', bestAccuracy: 'max', wordsSolved: 'sum' },
  headline: 'puzzlesSolved',
  metrics: [
    { key: 'puzzlesSolved', label: (m) => m.common.metrics.puzzlesSolved, value: fromStat('wins'), format: 'number', record: true },
    { key: 'bestTime', label: (m) => m.common.metrics.bestTime, value: fromMetric('bestTimeMs'), format: 'duration', record: true },
    { key: 'bestAccuracy', label: (m) => m.common.metrics.bestAccuracy, value: fromMetric('bestAccuracy'), format: 'percent', record: true },
    { key: 'wordsSolved', label: (m) => m.common.metrics.wordsSolved, value: fromMetric('wordsSolved'), format: 'number' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
