import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetStorageBackendForTests } from '../../services/storage/storage';
import { loadGame, saveGame } from '../../services/saves';
import { buildModel, check, newPlay, reveal, setEntry } from './engine';
import { loadPuzzle } from './puzzles';
import {
  MAX_IN_PROGRESS,
  MAX_SOLVED,
  defaultPrefs,
  loadPrefs,
  prefsValidator,
  restorePlay,
  saveSpec,
  savePrefs,
  serializePlay,
  upsertInProgress,
  withSolved,
  type SavedPuzzle,
} from './save';
import type { Puzzle } from './types';

beforeEach(() => {
  __resetStorageBackendForTests(true);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const puzzle = loadPuzzle('es-preset-1') as Puzzle;
const model = buildModel(puzzle);
const first = model.cells.find((c) => c !== null)!;
const other = model.cells.find((c) => c !== null && c.index !== first.index)!;

function sample(): SavedPuzzle {
  let play = newPlay(model);
  play = setEntry(play, model, first.index, first.solution);
  play = setEntry(play, model, other.index, other.solution === 'Z' ? 'Y' : 'Z');
  play = check(play, model, { kind: 'all' }).play;
  return serializePlay(puzzle.id, play, 12_345.6, 1000);
}

describe('serialisation', () => {
  it('round-trips a play state through the save format', () => {
    const saved = sample();
    expect(saved.entries).toHaveLength(model.width * model.height);
    expect(saved.elapsedMs).toBe(12_346);
    const play = restorePlay(model, saved);
    expect(play).not.toBeNull();
    expect(play?.entries[first.index]).toBe(first.solution);
    expect(play?.marks[first.index]).toBe('ok');
    expect(play?.marks[other.index]).toBe('wrong');
    expect(play?.wrongFound).toBe(1);
    expect(play?.checks).toBe(1);
  });

  it('keeps the Spanish Ñ as one square', () => {
    const enye = model.cells.find((c) => c?.solution === 'Ñ');
    expect(enye).toBeTruthy();
    if (!enye) return;
    const play = setEntry(newPlay(model), model, enye.index, 'Ñ');
    const restored = restorePlay(model, serializePlay(puzzle.id, play, 0, 1));
    expect(restored?.entries[enye.index]).toBe('Ñ');
  });

  it('rejects saves that do not match the grid', () => {
    const saved = sample();
    expect(restorePlay(model, { ...saved, id: 'es-preset-2' })).toBeNull();
    expect(restorePlay(model, { ...saved, entries: saved.entries.slice(1), marks: saved.marks.slice(1) })).toBeNull();
    // A letter on a black square.
    const black = model.cells.findIndex((c) => c === null);
    const withBlack = [...saved.entries];
    withBlack[black] = 'A';
    expect(restorePlay(model, { ...saved, entries: withBlack.join('') })).toBeNull();
    // A locked square that does not hold the solution.
    const marks = [...saved.marks];
    marks[other.index] = 'v';
    expect(restorePlay(model, { ...saved, marks: marks.join('') })).toBeNull();
    // Ñ is not a letter of Portuguese grids.
    const pt = buildModel(loadPuzzle('pt-preset-1') as Puzzle);
    const cell = pt.cells.find((c) => c !== null)!;
    const entries = Array.from({ length: pt.width * pt.height }, () => '.');
    entries[cell.index] = 'Ñ';
    const marksPt = '-'.repeat(pt.width * pt.height);
    expect(restorePlay(pt, { ...saved, id: 'pt-preset-1', entries: entries.join(''), marks: marksPt })).toBeNull();
  });

  it('does not resume a solved puzzle', () => {
    const solved = reveal(newPlay(model), model, { kind: 'all' }).play;
    expect(restorePlay(model, serializePlay(puzzle.id, solved, 0, 1))).toBeNull();
  });
});

describe('save spec', () => {
  it('stores the current puzzle and the in-progress list', () => {
    const data = { currentId: puzzle.id, puzzles: [sample()] };
    saveGame(saveSpec, data);
    expect(loadGame(saveSpec)).toEqual(data);
  });

  it('rejects corrupted saves', () => {
    const bad = (value: unknown) => {
      saveGame(saveSpec, value as never);
      return loadGame(saveSpec);
    };
    expect(bad({ currentId: 'xx-1', puzzles: [] })).toBeNull();
    expect(bad({ currentId: null, puzzles: [{ ...sample(), marks: 'q'.repeat(sample().marks.length) }] })).toBeNull();
    expect(bad({ currentId: null, puzzles: [{ ...sample(), entries: '1'.repeat(sample().entries.length) }] })).toBeNull();
    expect(bad({ currentId: null, puzzles: [sample(), sample()] })).toBeNull();
    expect(bad({ currentId: null, puzzles: Array.from({ length: MAX_IN_PROGRESS + 1 }, (_, i) => ({ ...sample(), id: `pt-${i + 1}` })) })).toBeNull();
    expect(bad({ currentId: null, puzzles: [{ ...sample(), elapsedMs: -1 }] })).toBeNull();
    expect(bad('nope')).toBeNull();
  });

  it('caps the in-progress list, most recent first', () => {
    let list: SavedPuzzle[] = [];
    for (let i = 1; i <= MAX_IN_PROGRESS + 3; i++) list = upsertInProgress(list, { ...sample(), id: `en-${i}`, updatedAt: i });
    expect(list).toHaveLength(MAX_IN_PROGRESS);
    expect(list[0]?.id).toBe(`en-${MAX_IN_PROGRESS + 3}`);
    list = upsertInProgress(list, { ...sample(), id: 'en-5', updatedAt: 99 });
    expect(list[0]?.id).toBe('en-5');
    expect(list.filter((p) => p.id === 'en-5')).toHaveLength(1);
  });
});

describe('preferences', () => {
  it('default when missing and round-trip', () => {
    expect(loadPrefs()).toEqual(defaultPrefs());
    const prefs = { ...defaultPrefs(), keyboard: 'on' as const, skipFilled: false, next: { pt: 3, en: 1, es: 7 } };
    savePrefs(prefs);
    expect(loadPrefs()).toEqual(prefs);
  });

  it('repair invalid fields with defaults', () => {
    const r = prefsValidator({ next: { pt: 0 }, keyboard: 'maybe', skipFilled: 'yes', solved: { 'pt-1': { stars: 9 } } });
    expect(r.ok && r.value).toEqual(defaultPrefs());
  });

  it('keep the best result per puzzle and cap the list', () => {
    let prefs = withSolved(defaultPrefs(), 'pt-1', { stars: 2, timeMs: 90_000, accuracy: 0.8 }, 1);
    prefs = withSolved(prefs, 'pt-1', { stars: 3, timeMs: 120_000, accuracy: 0.9 }, 2);
    expect(prefs.solved['pt-1']).toEqual({ stars: 3, bestTimeMs: 90_000, bestAccuracy: 0.9, at: 2 });
    for (let i = 2; i <= MAX_SOLVED + 5; i++) prefs = withSolved(prefs, `pt-${i}`, { stars: 1, timeMs: 1, accuracy: 0.5 }, 10 + i);
    expect(Object.keys(prefs.solved)).toHaveLength(MAX_SOLVED);
    expect(prefs.solved['pt-1']).toBeUndefined();
  });
});
