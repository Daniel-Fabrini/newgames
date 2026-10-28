import { describe, expect, it } from 'vitest';
import { addNumbers, newChallenge, newClassic, removePair, UNDO_LIMIT, type GameState } from './engine';
import { findPairs } from './match';
import { challengeSave, classicSave, saveSpecFor } from './save';

function played(state: GameState, steps: number): GameState {
  let s = state;
  for (let i = 0; i < steps; i++) {
    const pair = findPairs(s.cells)[0];
    if (pair) {
      const r = removePair(s, pair[0], pair[1]);
      if (r.ok) s = r.state;
    } else {
      s = addNumbers(s).state;
    }
  }
  return s;
}

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

describe('number match saves', () => {
  it('accepts classic and challenge games in progress after a JSON round trip', () => {
    const classic = { game: played(newClassic(5), 12), elapsedMs: 4321 };
    const r = classicSave.validate(roundTrip(classic));
    expect(r).toEqual({ ok: true, value: classic });
    const challenge = { game: played(newChallenge(7), 5), elapsedMs: 10 };
    expect(challengeSave.validate(roundTrip(challenge))).toEqual({ ok: true, value: challenge });
    expect(saveSpecFor('classic')).toBe(classicSave);
    expect(saveSpecFor('challenge')).toBe(challengeSave);
    expect(classicSave.slot).toBe('classic');
    expect(challengeSave.slot).toBe('challenge');
  });

  it('keeps the slots separate (a challenge cannot load as classic and vice versa)', () => {
    expect(classicSave.validate(roundTrip({ game: newChallenge(1), elapsedMs: 0 })).ok).toBe(false);
    expect(challengeSave.validate(roundTrip({ game: newClassic(1), elapsedMs: 0 })).ok).toBe(false);
  });

  it('rejects corrupted or inconsistent data', () => {
    const good = newClassic(9);
    const bad = (patch: Partial<GameState> | Record<string, unknown>, elapsedMs: unknown = 0) =>
      classicSave.validate(roundTrip({ game: { ...good, ...patch }, elapsedMs })).ok;
    expect(bad({})).toBe(true);
    expect(bad({ cells: [...good.cells.slice(1), 10] })).toBe(false); // not a digit
    expect(bad({ cells: [1, 2.5] })).toBe(false);
    expect(bad({ cells: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] })).toBe(false); // fully cleared row must have been removed
    expect(bad({ cells: [] })).toBe(false); // playing without digits
    expect(bad({ status: 'cleared' })).toBe(false); // cleared with digits left
    expect(bad({ status: 'cleared', cells: [] })).toBe(true);
    expect(bad({ status: 'paused' })).toBe(false);
    expect(bad({ score: -5 })).toBe(false);
    expect(bad({ stage: 0 })).toBe(false);
    expect(bad({ addsLeft: -1 })).toBe(false);
    expect(bad({ rng: 'x' })).toBe(false);
    expect(bad({ undo: Array.from({ length: UNDO_LIMIT + 1 }, () => ({ cells: [1], score: 0, addsLeft: 1, addsUsed: 0, pairsCleared: 0, rowsCleared: 0, moves: 0 })) })).toBe(false);
    expect(bad({ undo: [{ cells: [1], score: 0 }] })).toBe(false);
    expect(bad({}, -1)).toBe(false);
    expect(bad({}, 'soon')).toBe(false);
    expect(classicSave.validate(null).ok).toBe(false);
    expect(classicSave.validate({ elapsedMs: 0 }).ok).toBe(false);
  });
});
