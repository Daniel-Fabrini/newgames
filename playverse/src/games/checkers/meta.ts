import { fromMetric, fromStat, winRateOf, type GameMeta } from '../types';

export const meta: GameMeta = {
  id: 'checkers',
  categories: ['board', 'classic'],
  progression: 'match',
  metricRules: { vsComputerWins: 'sum' },
  headline: 'wins',
  metrics: [
    { key: 'wins', label: (m) => m.common.metrics.wins, value: fromStat('wins'), format: 'number', record: true },
    { key: 'bestStreak', label: (m) => m.common.metrics.bestStreak, value: fromStat('bestStreak'), format: 'number', record: true },
    { key: 'vsComputerWins', label: (m) => m.common.metrics.vsComputerWins, value: fromMetric('vsComputerWins'), format: 'number' },
    { key: 'losses', label: (m) => m.common.metrics.losses, value: fromStat('losses'), format: 'number' },
    { key: 'draws', label: (m) => m.common.metrics.draws, value: fromStat('draws'), format: 'number' },
    { key: 'winRate', label: (m) => m.common.metrics.winRate, value: winRateOf, format: 'percent' },
    { key: 'played', label: (m) => m.common.metrics.played, value: fromStat('played'), format: 'number' },
  ],
};
