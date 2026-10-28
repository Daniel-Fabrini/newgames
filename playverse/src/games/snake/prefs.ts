import { readValue, writeValue } from '../../services/storage/storage';
import { v } from '../../services/storage/schema';
import { DIFFICULTIES, MODES, type Difficulty, type Mode } from './engine';

/** Last mode/difficulty chosen on the setup screen (small preference, not game progress). */
export interface SnakePrefs {
  mode: Mode;
  difficulty: Difficulty;
}

const KEY = 'prefs:snake';
const DEFAULTS: SnakePrefs = { mode: 'classic', difficulty: 'medium' };

const validator = v.object({
  mode: v.withDefault(v.literal(...MODES), DEFAULTS.mode),
  difficulty: v.withDefault(v.literal(...DIFFICULTIES), DEFAULTS.difficulty),
});

export function loadPrefs(): SnakePrefs {
  return readValue<SnakePrefs>(KEY, { validate: validator, version: 1 }, DEFAULTS);
}

export function savePrefs(prefs: SnakePrefs): void {
  writeValue(KEY, prefs, 1);
}

/** Metric key holding the best score of one mode + difficulty combination. */
export const comboKey = (mode: Mode, difficulty: Difficulty): string => `best:${mode}:${difficulty}`;
