import { useMemo } from 'react';
import { createStore, useStore } from './store';
import { statsStore } from './stats';
import { progressStore } from './progress';
import { hasSavedGame } from './saves';
import type { GameData, GameMeta, MetricView } from '../games/types';
import type { Formatters } from '../i18n/format';

/**
 * Aggregated, read-only view over every game's persisted data (stats + level progress).
 * A version counter is bumped whenever any underlying store changes so screens like Home and
 * Records re-render without subscribing to twenty stores individually.
 */
const version = createStore(0);
const watched = new Set<string>();

function watch(key: string, store: { subscribe(listener: () => void): () => void }) {
  if (watched.has(key)) return;
  watched.add(key);
  store.subscribe(() => version.set((v) => v + 1));
}

export function getGameData(meta: GameMeta): GameData {
  const stats = statsStore(meta.id);
  watch(`stats:${meta.id}`, stats);
  const progress: GameData['progress'] = {};
  for (const track of meta.progressTracks ?? []) {
    const store = progressStore(meta.id, track);
    watch(`progress:${meta.id}:${track}`, store);
    progress[track] = store.get();
  }
  return { stats: stats.get(), progress };
}

export function useGameData(metas: readonly GameMeta[]): GameData[] {
  const v = useStore(version);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `v` is the change signal for the stores read inside
  return useMemo(() => metas.map(getGameData), [metas, v]);
}

export function formatMetric(metric: MetricView, value: number, fmt: Formatters): string {
  switch (metric.format) {
    case 'duration':
      return fmt.clock(value);
    case 'percent':
      return fmt.percent(value);
    case 'number':
      return fmt.number(value);
  }
}

export function headlineMetric(meta: GameMeta): MetricView | undefined {
  return meta.metrics.find((x) => x.key === meta.headline);
}

export interface RecordEntry {
  meta: GameMeta;
  metric: MetricView;
  value: number;
}

export function collectRecords(metas: readonly GameMeta[], data: readonly GameData[]): RecordEntry[] {
  const out: RecordEntry[] = [];
  metas.forEach((meta, i) => {
    const d = data[i];
    if (!d) return;
    for (const metric of meta.metrics) {
      if (!metric.record) continue;
      const value = metric.value(d);
      if (value !== null) out.push({ meta, metric, value });
    }
  });
  return out;
}

export function hasAnySave(meta: GameMeta): boolean {
  return (meta.saveSlots ?? [undefined]).some((slot) => hasSavedGame(meta.id, slot));
}

/** Player experience derived from real stats (never stored separately, so it cannot drift). */
export function computeXp(data: readonly GameData[]): number {
  let xp = 0;
  for (const d of data) {
    xp += d.stats.played * 10 + d.stats.wins * 25 + d.stats.draws * 10;
    for (const p of Object.values(d.progress)) {
      for (const r of Object.values(p.completed)) xp += 15 + r.stars * 5;
    }
  }
  return xp;
}

/** Level L starts at 50·L·(L−1) XP: 0, 100, 300, 600, 1000… */
export function levelForXp(xp: number): { level: number; current: number; next: number } {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  const start = 50 * level * (level - 1);
  const end = 50 * (level + 1) * level;
  return { level, current: xp - start, next: end - start };
}
