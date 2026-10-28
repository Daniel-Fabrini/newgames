import type { Messages } from '../i18n';
import type { GameStats, MetricRules } from '../services/stats';
import type { LevelProgress } from '../services/progress';
import type { Category, GameId, ProgressionKind } from '../types/game';

export type MetricFormat = 'number' | 'duration' | 'percent';

/** Everything persisted about a game, used to compute the metrics shown in the UI. */
export interface GameData {
  stats: GameStats;
  /** Level progress by track name (only for games that declare `progressTracks`). */
  progress: Record<string, LevelProgress>;
}

export interface MetricView {
  key: string;
  label: (m: Messages) => string;
  /** Returns null when there is no data yet (never a fake value). */
  value: (data: GameData) => number | null;
  format: MetricFormat;
  /** Counts as a personal record (Records page, header counter). */
  record?: boolean;
}

export interface GameMeta {
  id: GameId;
  categories: readonly Category[];
  progression: ProgressionKind;
  /** How game-specific metrics are aggregated by `recordMatch`. */
  metricRules: MetricRules;
  /** Metrics shown on the statistics and records pages (in order). */
  metrics: readonly MetricView[];
  /** Metric key shown with a crown on the home card and the "continue" card. */
  headline: string;
  /** Level-progress tracks used by the game (see services/progress). */
  progressTracks?: readonly string[];
  /** Save slots the game uses; "continue" checks them. Defaults to the main slot. */
  saveSlots?: readonly (string | undefined)[];
}

/** Helpers to declare metrics concisely. */
export const fromStat =
  (field: 'bestScore' | 'wins' | 'losses' | 'draws' | 'played' | 'bestStreak' | 'totalScore' | 'totalDurationMs') =>
  (data: GameData): number | null => {
    const value = data.stats[field];
    if (value === null) return null;
    if (data.stats.played === 0) return null;
    return value;
  };

export const fromMetric =
  (key: string) =>
  (data: GameData): number | null =>
    data.stats.metrics[key] ?? null;

export const levelsCompleted =
  (track = 'main') =>
  (data: GameData): number | null => {
    const p = data.progress[track];
    if (!p) return null;
    const n = Object.keys(p.completed).length;
    return n === 0 ? null : n;
  };

export const highestLevel =
  (track = 'main') =>
  (data: GameData): number | null => {
    const p = data.progress[track];
    if (!p) return null;
    const levels = Object.keys(p.completed).map(Number);
    return levels.length === 0 ? null : Math.max(...levels);
  };

export const starsEarned =
  (track = 'main') =>
  (data: GameData): number | null => {
    const p = data.progress[track];
    if (!p) return null;
    const total = Object.values(p.completed).reduce((acc, r) => acc + r.stars, 0);
    return total === 0 ? null : total;
  };

export const fastestLevel =
  (track = 'main') =>
  (data: GameData): number | null => {
    const p = data.progress[track];
    if (!p) return null;
    const times = Object.values(p.completed)
      .map((r) => r.bestTimeMs)
      .filter((t): t is number => t !== undefined);
    return times.length === 0 ? null : Math.min(...times);
  };

export const winRateOf = (data: GameData): number | null =>
  data.stats.played === 0 ? null : data.stats.wins / data.stats.played;
