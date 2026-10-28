import { createPersistedStore, useStore } from '../../services/store';
import { v, type Validator } from '../../services/storage/schema';
import { DIFFICULTIES, type Difficulty } from './generator';
import type { ErrorMode } from './engine';

/** Small per-game preferences (validated; each field falls back on its own). */
export interface SudokuPrefs {
  /** Last difficulty chosen on the setup screen. */
  difficulty: Difficulty;
  errorMode: ErrorMode;
  /** Remove a placed digit from the notes of its peers. */
  autoNotes: boolean;
  /** Highlight cells (and notes) with the same digit as the selected cell. */
  highlightSame: boolean;
}

export const defaultPrefs = (): SudokuPrefs => ({ difficulty: 'easy', errorMode: 'immediate', autoNotes: true, highlightSame: true });

export const prefsValidator: Validator<SudokuPrefs> = (input, path) => {
  const d = defaultPrefs();
  return v.object({
    difficulty: v.withDefault(v.literal(...DIFFICULTIES), d.difficulty),
    errorMode: v.withDefault(v.literal('immediate', 'onCheck'), d.errorMode),
    autoNotes: v.withDefault(v.boolean(), d.autoNotes),
    highlightSame: v.withDefault(v.boolean(), d.highlightSame),
  })(input, path);
};

export const prefsStore = createPersistedStore<SudokuPrefs>('prefs:sudoku', { validate: prefsValidator, version: 1 }, defaultPrefs);

export function useSudokuPrefs(): SudokuPrefs {
  return useStore(prefsStore);
}

export function updatePrefs(patch: Partial<SudokuPrefs>): void {
  prefsStore.set((prev) => ({ ...prev, ...patch }));
}
