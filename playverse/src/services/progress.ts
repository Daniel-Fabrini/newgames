import { createPersistedStore, useStore, type PersistedStore } from './store';
import { v, type Validator } from './storage/schema';
import type { GameId } from '../types/game';

/**
 * Level-based progression for games with campaigns (Water Sort, Number Match challenges…).
 * Levels are 1-based. Completing level N unlocks level N+1.
 */
export interface LevelResult {
  stars: number; // 0–3
  bestMoves?: number;
  bestTimeMs?: number;
  bestScore?: number;
  completedAt: number;
}

export interface LevelProgress {
  /** Highest unlocked level. */
  unlocked: number;
  /** Level the player was last on (for "continue"). */
  current: number;
  completed: Record<string, LevelResult>;
}

export const emptyProgress = (): LevelProgress => ({ unlocked: 1, current: 1, completed: {} });

const levelResult: Validator<LevelResult> = v.object({
  stars: v.int({ min: 0, max: 3 }),
  bestMoves: v.optional(v.int({ min: 0 })),
  bestTimeMs: v.optional(v.number({ min: 0 })),
  bestScore: v.optional(v.number()),
  completedAt: v.number({ min: 0 }),
});

export const progressValidator: Validator<LevelProgress> = v.object({
  unlocked: v.int({ min: 1 }),
  current: v.int({ min: 1 }),
  completed: v.record(levelResult, { dropInvalid: true }),
});

const stores = new Map<string, PersistedStore<LevelProgress>>();

/** `track` lets a game keep several independent campaigns (e.g. "challenges"). */
export function progressStore(gameId: GameId, track = 'main'): PersistedStore<LevelProgress> {
  const key = `progress:${gameId}:${track}`;
  let store = stores.get(key);
  if (!store) {
    store = createPersistedStore(key, { validate: progressValidator, version: 1 }, emptyProgress);
    stores.set(key, store);
  }
  return store;
}

export interface CompleteLevelInput {
  stars: number;
  moves?: number;
  timeMs?: number;
  score?: number;
}

export interface CompleteLevelOutcome {
  progress: LevelProgress;
  firstCompletion: boolean;
  improvedStars: boolean;
  newBestMoves: boolean;
  newBestTime: boolean;
}

/** Pure reducer used by `completeLevel` (exported for tests). */
export function applyLevelCompletion(prev: LevelProgress, level: number, input: CompleteLevelInput, at = Date.now()): CompleteLevelOutcome {
  const key = String(level);
  const before = prev.completed[key];
  const stars = Math.max(0, Math.min(3, Math.round(input.stars)));
  const merged: LevelResult = {
    stars: Math.max(before?.stars ?? 0, stars),
    completedAt: before?.completedAt ?? at,
  };
  const bestMoves = minDefined(before?.bestMoves, input.moves);
  const bestTimeMs = minDefined(before?.bestTimeMs, input.timeMs);
  const bestScore = maxDefined(before?.bestScore, input.score);
  if (bestMoves !== undefined) merged.bestMoves = bestMoves;
  if (bestTimeMs !== undefined) merged.bestTimeMs = bestTimeMs;
  if (bestScore !== undefined) merged.bestScore = bestScore;
  const progress: LevelProgress = {
    unlocked: Math.max(prev.unlocked, level + 1),
    current: Math.max(prev.current, level + 1),
    completed: { ...prev.completed, [key]: merged },
  };
  return {
    progress,
    firstCompletion: before === undefined,
    improvedStars: stars > (before?.stars ?? 0),
    newBestMoves: input.moves !== undefined && (before?.bestMoves === undefined || input.moves < before.bestMoves),
    newBestTime: input.timeMs !== undefined && (before?.bestTimeMs === undefined || input.timeMs < before.bestTimeMs),
  };
}

function minDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

export function completeLevel(gameId: GameId, level: number, input: CompleteLevelInput, track = 'main'): CompleteLevelOutcome {
  const store = progressStore(gameId, track);
  const outcome = applyLevelCompletion(store.get(), level, input);
  store.set(outcome.progress);
  return outcome;
}

export function setCurrentLevel(gameId: GameId, level: number, track = 'main'): void {
  const store = progressStore(gameId, track);
  store.set((p) => (level >= 1 && level <= p.unlocked && p.current !== level ? { ...p, current: level } : p));
}

export function isLevelUnlocked(progress: LevelProgress, level: number): boolean {
  return level >= 1 && level <= progress.unlocked;
}

export function totalStars(progress: LevelProgress): number {
  return Object.values(progress.completed).reduce((acc, r) => acc + r.stars, 0);
}

export function useLevelProgress(gameId: GameId, track = 'main'): LevelProgress {
  return useStore(progressStore(gameId, track));
}

export function reloadAllProgress(): void {
  for (const store of stores.values()) store.reload();
}
