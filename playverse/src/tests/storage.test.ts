// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readValue, writeValue, STORAGE_PREFIX, getStorageIssues, __resetStorageBackendForTests, clearAllValues, listKeys } from '../services/storage/storage';
import { v } from '../services/storage/schema';
import { applyMatch, emptyStats, statsValidator, recordMatch, getStats } from '../services/stats';
import { applyLevelCompletion, emptyProgress, progressValidator } from '../services/progress';
import { loadGame, saveGame, hasSavedGame, clearGame } from '../services/saves';

const schema = v.object({ a: v.int({ min: 0 }), b: v.string() });

beforeEach(() => {
  localStorage.clear();
  __resetStorageBackendForTests();
});

describe('storage', () => {
  it('round-trips validated values', () => {
    writeValue('x', { a: 1, b: 'ok' });
    expect(readValue('x', { validate: schema }, null)).toEqual({ a: 1, b: 'ok' });
  });

  it('recovers from corrupted JSON, backs it up and reports it', () => {
    localStorage.setItem(`${STORAGE_PREFIX}x`, '{not json');
    expect(readValue<unknown>('x', { validate: schema }, 'fallback')).toBe('fallback');
    expect(localStorage.getItem(`${STORAGE_PREFIX}x`)).toBeNull();
    expect(localStorage.getItem('playverse-corrupt:x')).toBe('{not json');
    expect(getStorageIssues().at(-1)).toEqual({ key: 'x', reason: 'corrupt' });
  });

  it('rejects values that fail validation', () => {
    writeValue('x', { a: -5, b: 'ok' });
    expect(readValue('x', { validate: schema }, null)).toBeNull();
    expect(getStorageIssues().at(-1)?.reason).toBe('invalid');
  });

  it('discards incompatible versions unless a migration is provided', () => {
    writeValue('x', { a: 1, b: 'old' }, 1);
    expect(readValue('x', { validate: schema, version: 2 }, null)).toBeNull();
    writeValue('y', { a: 1 }, 1);
    const migrated = readValue('y', { validate: schema, version: 2, migrate: (_v, d) => ({ ...(d as object), b: 'migrated' }) }, null);
    expect(migrated).toEqual({ a: 1, b: 'migrated' });
  });

  it('clears only PlayVerse keys', () => {
    writeValue('x', 1);
    localStorage.setItem('other-app', 'keep');
    clearAllValues();
    expect(listKeys()).toEqual([]);
    expect(localStorage.getItem('other-app')).toBe('keep');
  });
});

describe('statistics', () => {
  it('counts outcomes, streaks and best score', () => {
    let s = emptyStats();
    s = applyMatch(s, { at: 1, outcome: 'win', score: 100 }).stats;
    s = applyMatch(s, { at: 2, outcome: 'win', score: 50 }).stats;
    const third = applyMatch(s, { at: 3, outcome: 'loss', score: 150 });
    s = third.stats;
    expect(third.isNewBestScore).toBe(true);
    expect(s).toMatchObject({ played: 3, wins: 2, losses: 1, currentStreak: 0, bestStreak: 2, bestScore: 150, totalScore: 300 });
    expect(s.history[0]?.at).toBe(3);
  });

  it('aggregates game-specific metrics with their rules', () => {
    const rules = { lines: 'sum', combo: 'max', time: 'min' } as const;
    let s = applyMatch(emptyStats(), { at: 1, outcome: 'ended', metrics: { lines: 3, combo: 2, time: 5000 } }, rules).stats;
    const r = applyMatch(s, { at: 2, outcome: 'ended', metrics: { lines: 4, combo: 1, time: 4000 } }, rules);
    s = r.stats;
    expect(s.metrics).toEqual({ lines: 7, combo: 2, time: 4000 });
    expect(r.improvedMetrics).toEqual(['time']);
  });

  it('persists records across reloads (stores re-read from storage)', () => {
    recordMatch('snake', { outcome: 'ended', score: 42 });
    const raw = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}stats:snake`) ?? 'null');
    expect(raw.d.bestScore).toBe(42);
    expect(statsValidator(raw.d).ok).toBe(true);
    expect(getStats('snake').played).toBe(1);
  });

  it('rejects inconsistent statistics', () => {
    const bad = { ...emptyStats(), played: 1, wins: 3 };
    expect(statsValidator(bad).ok).toBe(false);
  });
});

describe('level progress', () => {
  it('unlocks the next level and keeps best results', () => {
    let o = applyLevelCompletion(emptyProgress(), 1, { stars: 2, moves: 20, timeMs: 30000 }, 10);
    expect(o.progress.unlocked).toBe(2);
    expect(o.firstCompletion).toBe(true);
    o = applyLevelCompletion(o.progress, 1, { stars: 1, moves: 15, timeMs: 40000 }, 20);
    expect(o.progress.completed['1']).toMatchObject({ stars: 2, bestMoves: 15, bestTimeMs: 30000 });
    expect(o.newBestMoves).toBe(true);
    expect(o.newBestTime).toBe(false);
    expect(progressValidator(o.progress).ok).toBe(true);
  });
});

describe('saved games', () => {
  const spec = { gameId: 'game-2048' as const, version: 1, validate: schema };

  it('saves, detects and restores a game', () => {
    expect(hasSavedGame('game-2048')).toBe(false);
    saveGame(spec, { a: 3, b: 'state' });
    expect(hasSavedGame('game-2048')).toBe(true);
    expect(loadGame(spec)).toEqual({ a: 3, b: 'state' });
    clearGame('game-2048');
    expect(loadGame(spec)).toBeNull();
  });

  it('returns null for a tampered save instead of crashing', () => {
    localStorage.setItem(`${STORAGE_PREFIX}save:game-2048`, JSON.stringify({ v: 1, d: { a: 'NaN' } }));
    expect(loadGame(spec)).toBeNull();
  });
});
