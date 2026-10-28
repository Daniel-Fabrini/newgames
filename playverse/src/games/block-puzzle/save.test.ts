import { describe, expect, it } from 'vitest';
import { emptyBoard, indexOf, newGame, place, validPlacements, type GameState } from './engine';
import { shapeOf } from './shapes';
import { migrateSave, saveValidator } from './save';
import { boardFrom, isolatedHolesBoard, stateWith } from './test-utils';

const wrap = (game: unknown, elapsedMs: unknown = 1234) => JSON.parse(JSON.stringify({ game, elapsedMs })) as unknown;

function midGame(): GameState {
  let s = newGame(77);
  for (let i = 0; i < 5; i++) {
    const slot = s.tray.findIndex((p) => p !== null);
    const piece = s.tray[slot];
    if (!piece) break;
    const anchor = validPlacements(s.board, shapeOf(piece.shape))[0];
    if (!anchor) break;
    s = place(s, slot, anchor.row, anchor.col)?.state ?? s;
  }
  return s;
}

describe('block puzzle save validation', () => {
  it('accepts a fresh and an in-progress game after a JSON round trip', () => {
    const fresh = saveValidator(wrap(newGame(1)));
    expect(fresh.ok).toBe(true);
    const mid = midGame();
    expect(mid.placed).toBe(5);
    const r = saveValidator(wrap(mid));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.game).toEqual(mid);
  });

  it('accepts a finished game whose flag matches the board', () => {
    const over = stateWith(isolatedHolesBoard(), ['line2-0', null, null]);
    expect(over.over).toBe(true);
    expect(saveValidator(wrap(over)).ok).toBe(true);
  });

  it('rejects malformed boards', () => {
    const s = newGame(2);
    expect(saveValidator(wrap({ ...s, board: s.board.slice(1) })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, board: s.board.map((v, i) => (i === 3 ? 9 : v)) })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, board: s.board.map((v, i) => (i === 3 ? 0.5 : v)) })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, board: s.board.map((v, i) => (i === 3 ? -1 : v)) })).ok).toBe(false);
    // A completed row can never be saved (it would have been cleared)
    const fullRow = emptyBoard();
    for (let c = 0; c < 9; c++) fullRow[indexOf(2, c)] = 1;
    expect(saveValidator(wrap({ ...s, board: fullRow })).ok).toBe(false);
  });

  it('rejects malformed trays', () => {
    const s = newGame(3);
    expect(saveValidator(wrap({ ...s, tray: [null, null, null] })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, tray: s.tray.slice(0, 2) })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, tray: [{ id: 1, shape: 'hexagon' }, null, null] })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, tray: [{ id: 'x', shape: 'mono-0' }, null, null] })).ok).toBe(false);
  });

  it('rejects inconsistent counters and flags', () => {
    const s = newGame(4);
    expect(saveValidator(wrap({ ...s, combo: 3, maxCombo: 2 })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, score: -5 })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, over: true })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, rng: 'abc' })).ok).toBe(false);
    expect(saveValidator(wrap({ ...s, nextId: 0 })).ok).toBe(false);
    expect(saveValidator(wrap(s, -1)).ok).toBe(false);
    expect(saveValidator(JSON.parse(JSON.stringify({ game: s }))).ok).toBe(false);
    expect(saveValidator(null).ok).toBe(false);
    expect(saveValidator('garbage').ok).toBe(false);
  });
});

describe('migration from version 1 (before 3×3 squares were cleared)', () => {
  it('clears a square that was full under the old rules and keeps the rest of the game', () => {
    const rows = ['###......', '###......', '###......', '.........', '....#....', '.........', '.........', '.........', '.........'];
    const old = stateWith(boardFrom(rows), ['mono-0', 'line2-0', null], { score: 120, lines: 3, placed: 9 });
    const v1 = wrap(old);
    // Version 2 validation rejects the old board as it is…
    expect(saveValidator(v1).ok).toBe(false);
    // …the migration clears the square and the result validates.
    const migrated = migrateSave(1, v1);
    const result = saveValidator(migrated);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { game } = result.value;
    expect(game.board.filter((v) => v !== 0)).toEqual([1]);
    expect(game.board[indexOf(4, 4)]).toBe(1);
    expect(game.score).toBe(120);
    expect(game.tray.map((p) => p?.shape ?? null)).toEqual(['mono-0', 'line2-0', null]);
    expect(game.over).toBe(false);
  });

  it('discards data it cannot migrate', () => {
    expect(migrateSave(1, null)).toBeUndefined();
    expect(migrateSave(1, { game: { board: 'x' } })).toBeUndefined();
    expect(migrateSave(7, wrap(newGame(1)))).toBeUndefined();
  });
});
