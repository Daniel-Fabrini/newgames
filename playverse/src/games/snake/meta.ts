import { fromMetric, fromStat, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'snake',
  categories: ['classic'],
  progression: 'score',
  metricRules: {
    maxLength: 'max',
    longestSurvivalMs: 'max',
    'best:classic': 'max',
    'best:endless': 'max',
    // Best score per mode + difficulty (shown on the setup screen and the game-over dialog).
    'best:classic:easy': 'max',
    'best:classic:medium': 'max',
    'best:classic:hard': 'max',
    'best:endless:easy': 'max',
    'best:endless:medium': 'max',
    'best:endless:hard': 'max',
    foodEaten: 'sum',
  },
  headline: 'bestScore',
  metrics: [
    { key: 'bestScore', label: (m) => m.common.metrics.bestScore, value: fromStat('bestScore'), format: 'number', record: true },
    { key: 'maxLength', label: (m) => m.common.metrics.maxLength, value: fromMetric('maxLength'), format: 'number', record: true },
    { key: 'longestSurvival', label: (m) => m.common.metrics.longestSurvival, value: fromMetric('longestSurvivalMs'), format: 'duration', record: true },
    { key: 'bestClassic', label: (m) => m.common.metrics.bestClassic, value: fromMetric('best:classic'), format: 'number' },
    { key: 'bestEndless', label: (m) => m.common.metrics.bestEndless, value: fromMetric('best:endless'), format: 'number' },
    { key: 'foodEaten', label: (m) => m.common.metrics.foodEaten, value: fromMetric('foodEaten'), format: 'number' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
