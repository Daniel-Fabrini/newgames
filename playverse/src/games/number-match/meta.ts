import { fromMetric, fromStat, levelsCompleted, starsEarned, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'number-match',
  categories: ['puzzle', 'logic'],
  progression: 'score',
  progressTracks: ['challenges'],
  saveSlots: ['classic', 'challenge'],
  metricRules: { pairsCleared: 'sum', highestStage: 'max', rowsCleared: 'sum' },
  headline: 'bestScore',
  metrics: [
    { key: 'bestScore', label: (m) => m.common.metrics.bestScore, value: fromStat('bestScore'), format: 'number', record: true },
    { key: 'highestStage', label: (m) => m.common.metrics.highestStage, value: fromMetric('highestStage'), format: 'number', record: true },
    { key: 'challengesCompleted', label: (m) => m.common.metrics.challengesCompleted, value: levelsCompleted('challenges'), format: 'number', record: true },
    { key: 'challengeStars', label: (m) => m.common.metrics.starsEarned, value: starsEarned('challenges'), format: 'number' },
    { key: 'pairsCleared', label: (m) => m.common.metrics.pairsCleared, value: fromMetric('pairsCleared'), format: 'number' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
