import { describe, expect, it } from 'vitest';
import { parseGrid } from './grid';
import { applyHint, findHint, newGame, placeDigit, toggleNote, type SudokuState } from './engine';
import { saveValidator, stateValidator } from './save';
import { prefsValidator, defaultPrefs } from './prefs';
import { EXAMPLES } from './fixtures';
import { solve } from './solver';

function playedGame(): SudokuState {
  const puzzle = parseGrid(EXAMPLES.easy);
  let s = newGame({ puzzle, solution: solve(puzzle)!, difficulty: 'medium', seed: 99 });
  const empty = s.values.findIndex((v) => v === 0);
  const other = s.values.findIndex((v, i) => v === 0 && i > empty + 3);
  s = placeDigit(s, empty, s.solution[empty] === 9 ? 1 : s.solution[empty]! + 1, { autoNotes: true, errorMode: 'onCheck' }).state;
  s = toggleNote(s, other, 5);
  s = applyHint(s, findHint(s, other)!);
  return s;
}

/** Round-trips through JSON like the storage layer does. */
const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

function mutate(fn: (s: SudokuState) => void): unknown {
  const s = roundTrip(playedGame()) as SudokuState;
  fn(s);
  return { game: s, elapsedMs: 1000 };
}

describe('save validation', () => {
  it('accepts a real in-progress game', () => {
    const s = playedGame();
    const r = saveValidator(roundTrip({ game: s, elapsedMs: 65_000 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.game).toEqual(s);
  });

  it('rejects structural corruption', () => {
    const bad = [
      mutate((s) => s.values.pop()),
      mutate((s) => (s.values[0] = 10)),
      mutate((s) => (s.notes[0] = 512)),
      mutate((s) => (s.notes[0] = -1)),
      mutate((s) => (s.values[1] = 1.5)),
      mutate((s) => ((s as unknown as { difficulty: string }).difficulty = 'insane')),
      mutate((s) => (s.hintsUsed = 99)),
      mutate((s) => (s.history = [{ changes: [] }])),
      { game: playedGame(), elapsedMs: -5 },
      null,
      'nope',
    ];
    for (const value of bad) expect(saveValidator(value).ok).toBe(false);
  });

  it('rejects givens that are inconsistent with the solution or were changed', () => {
    const given = parseGrid(EXAMPLES.easy).findIndex((d) => d !== 0);
    expect(saveValidator(mutate((s) => (s.givens[given] = (s.givens[given]! % 9) + 1))).ok).toBe(false);
    expect(saveValidator(mutate((s) => (s.values[given] = (s.values[given]! % 9) + 1))).ok).toBe(false);
  });

  it('rejects an invalid solution or one that does not match the puzzle', () => {
    expect(saveValidator(mutate((s) => ([s.solution[0], s.solution[1]] = [s.solution[1]!, s.solution[0]!]))).ok).toBe(false);
    // A different valid grid (digits relabelled) is consistent with no givens of the puzzle.
    expect(
      saveValidator(
        mutate((s) => {
          s.solution = s.solution.map((d) => (d % 9) + 1);
        }),
      ).ok,
    ).toBe(false);
  });

  it('rejects puzzles without a unique solution', () => {
    expect(
      saveValidator(
        mutate((s) => {
          s.givens = s.givens.map(() => 0);
          s.values = s.values.map(() => 0);
          s.hinted = [];
          s.flagged = [];
          s.history = [];
        }),
      ).ok,
    ).toBe(false);
  });

  it('rejects inconsistent hints, flags, notes and history', () => {
    const given = parseGrid(EXAMPLES.easy).findIndex((d) => d !== 0);
    expect(saveValidator(mutate((s) => s.hinted.push(given))).ok).toBe(false);
    expect(saveValidator(mutate((s) => (s.flagged = [given]))).ok).toBe(false);
    expect(
      saveValidator(
        mutate((s) => {
          const correct = s.values.findIndex((v, i) => v !== 0 && s.givens[i] === 0 && v === s.solution[i]);
          s.flagged = [correct];
        }),
      ).ok,
    ).toBe(false);
    expect(saveValidator(mutate((s) => (s.notes[given] = 1))).ok).toBe(false);
    expect(saveValidator(mutate((s) => s.history.push({ changes: [{ cell: given, value: 0, notes: 0 }] }))).ok).toBe(false);
  });

  it('does not resume finished games', () => {
    expect(saveValidator(mutate((s) => (s.solved = true))).ok).toBe(false);
    expect(stateValidator(roundTrip(playedGame())).ok).toBe(true);
  });
});

describe('preferences', () => {
  it('fall back per field', () => {
    const r = prefsValidator({ difficulty: 'hard', errorMode: 'bogus', autoNotes: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ...defaultPrefs(), difficulty: 'hard' });
  });
});
