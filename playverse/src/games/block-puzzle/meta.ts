import { fromMetric, fromStat, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'block-puzzle',
  categories: ['puzzle'],
  progression: 'score',
  metricRules: { linesCleared: 'sum', maxCombo: 'max', bestLines: 'max', piecesPlaced: 'sum' },
  headline: 'bestScore',
  metrics: [
    { key: 'bestScore', label: (m) => m.common.metrics.bestScore, value: fromStat('bestScore'), format: 'number', record: true },
    { key: 'maxCombo', label: (m) => m.common.metrics.maxCombo, value: fromMetric('maxCombo'), format: 'number', record: true },
    { key: 'bestLines', label: (m) => m.common.metrics.bestLines, value: fromMetric('bestLines'), format: 'number', record: true },
    { key: 'linesCleared', label: (m) => m.common.metrics.linesCleared, value: fromMetric('linesCleared'), format: 'number' },
    { key: 'piecesPlaced', label: (m) => m.blockPuzzle.totalPiecesPlaced, value: fromMetric('piecesPlaced'), format: 'number' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
