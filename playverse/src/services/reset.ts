import { listKeys, removeValue } from './storage/storage';
import { reloadAllStats } from './stats';
import { reloadAllProgress } from './progress';

/** Deletes records, statistics, level progress and saved games. Settings and profile are kept. */
export function resetAllProgress(): void {
  for (const key of listKeys()) {
    if (key.startsWith('stats:') || key.startsWith('progress:') || key.startsWith('save:')) removeValue(key);
  }
  reloadAllStats();
  reloadAllProgress();
}
