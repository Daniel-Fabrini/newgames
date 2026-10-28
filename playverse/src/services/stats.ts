import { useStore } from './store';
import { createPersistedStore, type PersistedStore } from './store';
import { v, type Validator } from './storage/schema';
import type { GameId, Outcome } from '../types/game';

/**
 * Common statistics with game-specific metrics.
 *
 * Every game records finished matches through `recordMatch`. Generic counters (played, wins,
 * streaks, best score, time) are maintained here; game-specific values are aggregated
 * according to the `MetricRule`s the game declares (e.g. `linesCleared: 'sum'`, `maxCombo: 'max'`,
 * `bestTime:easy: 'min'`).
 */
export type MetricAggregation = 'sum' | 'max' | 'min' | 'last';
export type MetricRules = Record<string, MetricAggregation>;

export interface MatchRecord {
  at: number;
  outcome: Outcome;
  score?: number;
  durationMs?: number;
  /** Free-form variant label, e.g. "easy", "draw-3", "classic". */
  variant?: string;
  metrics?: Record<string, number>;
}

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  totalDurationMs: number;
  bestScore: number | null;
  totalScore: number;
  metrics: Record<string, number>;
  history: MatchRecord[];
  lastPlayedAt: number | null;
}

export const HISTORY_LIMIT = 30;

export function emptyStats(): GameStats {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalDurationMs: 0,
    bestScore: null,
    totalScore: 0,
    metrics: {},
    history: [],
    lastPlayedAt: null,
  };
}

const count = v.int({ min: 0 });
const metricsValidator = v.record(v.number(), { dropInvalid: true });
const matchValidator: Validator<MatchRecord> = v.object({
  at: v.number({ min: 0 }),
  outcome: v.literal('win', 'loss', 'draw', 'ended'),
  score: v.optional(v.number()),
  durationMs: v.optional(v.number({ min: 0 })),
  variant: v.optional(v.string({ maxLength: 40 })),
  metrics: v.optional(metricsValidator),
});

export const statsValidator: Validator<GameStats> = v.refine(
  v.object({
    played: count,
    wins: count,
    losses: count,
    draws: count,
    currentStreak: count,
    bestStreak: count,
    totalDurationMs: v.number({ min: 0 }),
    bestScore: v.nullable(v.number()),
    totalScore: v.number(),
    metrics: metricsValidator,
    history: v.array(matchValidator, { maxLength: HISTORY_LIMIT }),
    lastPlayedAt: v.nullable(v.number({ min: 0 })),
  }),
  (s) => s.wins + s.losses + s.draws <= s.played || 'outcome counters exceed played',
);

export interface RecordResult {
  stats: GameStats;
  isNewBestScore: boolean;
  previousBestScore: number | null;
  /** Metric keys whose aggregated value improved (for "new record" badges). */
  improvedMetrics: string[];
}

/** Pure reducer: applies a finished match to the statistics. */
export function applyMatch(prev: GameStats, match: MatchRecord, rules: MetricRules = {}): RecordResult {
  const next: GameStats = { ...prev, metrics: { ...prev.metrics } };
  next.played += 1;
  if (match.outcome === 'win') {
    next.wins += 1;
    next.currentStreak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.currentStreak);
  } else if (match.outcome === 'loss') {
    next.losses += 1;
    next.currentStreak = 0;
  } else if (match.outcome === 'draw') {
    next.draws += 1;
  }
  if (match.durationMs !== undefined) next.totalDurationMs += Math.max(0, match.durationMs);

  let isNewBestScore = false;
  if (match.score !== undefined) {
    next.totalScore += match.score;
    if (prev.bestScore === null || match.score > prev.bestScore) {
      isNewBestScore = match.score > 0;
      next.bestScore = match.score;
    }
  }

  const improvedMetrics: string[] = [];
  for (const [key, value] of Object.entries(match.metrics ?? {})) {
    if (!Number.isFinite(value)) continue;
    const rule = rules[key] ?? 'last';
    const current = next.metrics[key];
    let updated: number;
    switch (rule) {
      case 'sum':
        updated = (current ?? 0) + value;
        break;
      case 'max':
        updated = current === undefined ? value : Math.max(current, value);
        if (current === undefined || value > current) improvedMetrics.push(key);
        break;
      case 'min':
        updated = current === undefined ? value : Math.min(current, value);
        if (current === undefined || value < current) improvedMetrics.push(key);
        break;
      case 'last':
        updated = value;
        break;
    }
    next.metrics[key] = updated;
  }

  next.history = [match, ...prev.history].slice(0, HISTORY_LIMIT);
  next.lastPlayedAt = match.at;
  return { stats: next, isNewBestScore, previousBestScore: prev.bestScore, improvedMetrics };
}

const stores = new Map<GameId, PersistedStore<GameStats>>();

export function statsStore(gameId: GameId): PersistedStore<GameStats> {
  let store = stores.get(gameId);
  if (!store) {
    store = createPersistedStore(`stats:${gameId}`, { validate: statsValidator, version: 1 }, emptyStats);
    stores.set(gameId, store);
  }
  return store;
}

export function getStats(gameId: GameId): GameStats {
  return statsStore(gameId).get();
}

/** Records a finished match and returns record information for the end-of-game screen. */
export function recordMatch(
  gameId: GameId,
  match: Omit<MatchRecord, 'at'> & { at?: number },
  rules: MetricRules = {},
): RecordResult {
  const store = statsStore(gameId);
  const result = applyMatch(store.get(), { ...match, at: match.at ?? Date.now() }, rules);
  store.set(result.stats);
  return result;
}

export function resetStats(gameId: GameId): void {
  statsStore(gameId).set(emptyStats());
}

export function reloadAllStats(): void {
  for (const store of stores.values()) store.reload();
}

export function useGameStats(gameId: GameId): GameStats {
  return useStore(statsStore(gameId));
}

export function winRate(stats: GameStats): number {
  return stats.played === 0 ? 0 : stats.wins / stats.played;
}
