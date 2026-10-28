import { describe, expect, it } from 'vitest';
import { createLevelState, playPour, type LevelState } from './engine';
import { fromSave, prefsValidator, saveValidator, toSave, type SavedWaterSort } from './save';
import { generateLevel } from './levels';

function inProgress(): { state: LevelState; save: SavedWaterSort } {
  const lv = generateLevel(4);
  let state = createLevelState(4, lv.bottles, lv.par);
  for (const m of lv.solution.slice(0, 3)) {
    const r = playPour(state, m.from, m.to);
    if (!r.ok) throw new Error('solution move must be legal');
    state = r.state;
  }
  state = { ...state, hintsUsed: 1 };
  return { state, save: toSave(state, 12_345.6) };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('water sort save', () => {
  it('accepts a consistent in-progress level and restores it exactly', () => {
    const { state, save } = inProgress();
    const r = saveValidator(clone(save));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.elapsedMs).toBe(12_346);
    const restored = fromSave(r.value);
    expect(restored).toEqual({ ...state, won: false });
  });

  it('accepts a level that has not been touched yet', () => {
    const lv = generateLevel(2);
    expect(saveValidator(clone(toSave(createLevelState(2, lv.bottles, lv.par), 0))).ok).toBe(true);
  });

  it('rejects bottles that do not match the history', () => {
    const { save } = inProgress();
    const bad = clone(save);
    bad.bottles = clone(save.initial);
    expect(saveValidator(bad).ok).toBe(false);
  });

  it('rejects a history with an illegal pour or a wrong record', () => {
    const { save } = inProgress();
    const illegal = clone(save);
    const empty = illegal.initial.findIndex((b) => b.length === 0);
    illegal.history = [{ from: empty, to: 0, amount: 1, colour: 0 }, ...illegal.history];
    expect(saveValidator(illegal).ok).toBe(false);
    const wrongAmount = clone(save);
    (wrongAmount.history[0] as { amount: number }).amount = 4;
    expect(saveValidator(wrongAmount).ok).toBe(false);
  });

  it('rejects finished levels (they are never resumed)', () => {
    const lv = generateLevel(3);
    let state = createLevelState(3, lv.bottles, lv.par);
    for (const m of lv.solution) {
      const r = playPour(state, m.from, m.to);
      if (!r.ok) throw new Error('legal');
      state = r.state;
    }
    expect(state.won).toBe(true);
    expect(saveValidator(clone(toSave(state, 1000))).ok).toBe(false);
  });

  it('rejects malformed positions and wrong types', () => {
    const { save } = inProgress();
    const missingUnit = clone(save);
    missingUnit.initial[0] = (missingUnit.initial[0] as number[]).slice(0, 3);
    expect(saveValidator(missingUnit).ok).toBe(false);
    const overflow = clone(save);
    overflow.initial[0] = [0, 0, 0, 0, 0];
    expect(saveValidator(overflow).ok).toBe(false);
    const badColour = clone(save) as unknown as { initial: number[][] };
    (badColour.initial[0] as number[])[0] = 99;
    expect(saveValidator(badColour).ok).toBe(false);
    expect(saveValidator({ ...clone(save), level: 0 }).ok).toBe(false);
    expect(saveValidator({ ...clone(save), elapsedMs: -1 }).ok).toBe(false);
    expect(saveValidator({ ...clone(save), hintsUsed: 'x' }).ok).toBe(false);
    expect(saveValidator(null).ok).toBe(false);
    expect(saveValidator('garbage').ok).toBe(false);
  });

  it('validates the symbols preference with a safe default', () => {
    expect(prefsValidator({ symbols: false })).toEqual({ ok: true, value: { symbols: false } });
    expect(prefsValidator({ symbols: 'yes' })).toEqual({ ok: true, value: { symbols: true } });
    expect(prefsValidator(null).ok).toBe(false);
  });
});
