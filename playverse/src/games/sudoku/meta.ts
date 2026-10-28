import { fromMetric, fromStat, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'sudoku',
  categories: ['logic', 'classic'],
  progression: 'puzzle',
  metricRules: {
    'bestTime:easy': 'min',
    'bestTime:medium': 'min',
    'bestTime:hard': 'min',
    'bestTime:expert': 'min',
    'solved:easy': 'sum',
    'solved:medium': 'sum',
    'solved:hard': 'sum',
    'solved:expert': 'sum',
  },
  headline: 'puzzlesSolved',
  metrics: [
    { key: 'puzzlesSolved', label: (m) => m.common.metrics.puzzlesSolved, value: fromStat('wins'), format: 'number', record: true },
    { key: 'bestTimeEasy', label: (m) => m.common.metrics.bestTimeEasy, value: fromMetric('bestTime:easy'), format: 'duration', record: true },
    { key: 'bestTimeMedium', label: (m) => m.common.metrics.bestTimeMedium, value: fromMetric('bestTime:medium'), format: 'duration', record: true },
    { key: 'bestTimeHard', label: (m) => m.common.metrics.bestTimeHard, value: fromMetric('bestTime:hard'), format: 'duration', record: true },
    { key: 'bestTimeExpert', label: (m) => m.common.metrics.bestTimeExpert, value: fromMetric('bestTime:expert'), format: 'duration', record: true },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
