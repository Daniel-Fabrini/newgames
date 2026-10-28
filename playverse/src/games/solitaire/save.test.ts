import { describe, expect, it, vi } from 'vitest';
import { loadGame, saveGame } from '../../services/saves';
import { applyAction, applyMove, draw, foundationRef, legalMoves, newGame, tableauRef, type GameState } from './engine';
import { gameStateValidator, loadDrawPreference, saveDrawPreference, saveSpec } from './save';
import { columns, foundation, makeState, up } from './testing';

function played(): GameState {
  let s = newGame(5150, 3);
  for (let i = 0; i < 40; i++) {
    const moves = legalMoves(s);
    const r = applyAction(s, moves.length > 0 && i % 3 === 0 ? { type: 'move', move: moves[0] as never } : { type: 'draw' });
    if (r) s = r.state;
  }
  return s;
}

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

describe('solitaire save validation', () => {
  it('accepts a fresh deal and a game in progress with undo history', () => {
    const fresh = gameStateValidator(roundTrip(newGame(1, 1)));
    expect(fresh.ok).toBe(true);
    const s = played();
    expect(s.history.length).toBeGreaterThan(10);
    const r = gameStateValidator(roundTrip(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(s);
  });

  it('round-trips through the save service', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const s = played();
    expect(saveGame(saveSpec, { game: s, elapsedMs: 61_000 })).toBe(true);
    expect(loadGame(saveSpec)).toEqual({ game: s, elapsedMs: 61_000 });
  });

  it('rejects duplicated or missing cards', () => {
    const s = newGame(2, 1);
    const dup = { ...s, stock: [...s.stock.slice(1), s.stock[0], s.stock[0]] };
    expect(gameStateValidator(roundTrip(dup)).ok).toBe(false);
    const missing = { ...s, stock: s.stock.slice(1) };
    expect(gameStateValidator(roundTrip(missing)).ok).toBe(false);
    const extra = { ...s, waste: [{ id: 52, up: true }] };
    expect(gameStateValidator(roundTrip(extra)).ok).toBe(false);
  });

  it('rejects impossible piles', () => {
    const s = newGame(3, 1);
    const faceUpStock = { ...s, stock: s.stock.map((c) => ({ ...c, up: true })) };
    expect(gameStateValidator(roundTrip(faceUpStock)).ok).toBe(false);
    const hiddenTop = { ...s, tableau: s.tableau.map((col) => col.map((c) => ({ ...c, up: false }))) };
    expect(gameStateValidator(roundTrip(hiddenTop)).ok).toBe(false);
    const sixColumns = { ...s, tableau: s.tableau.slice(0, 6) };
    expect(gameStateValidator(roundTrip(sixColumns)).ok).toBe(false);
  });

  it('rejects a corrupted undo snapshot', () => {
    const s = draw(newGame(4, 1))?.state as GameState;
    const bad = { ...s, history: [{ ...s.history[0], piles: 'garbage' }] };
    expect(gameStateValidator(roundTrip(bad)).ok).toBe(false);
    const incomplete = { ...s, history: [{ ...s.history[0], piles: (s.history[0]?.piles ?? '').slice(2) }] };
    expect(gameStateValidator(roundTrip(incomplete)).ok).toBe(false);
  });

  it('rejects wrong field values', () => {
    const s = newGame(6, 1);
    expect(gameStateValidator(roundTrip({ ...s, draw: 2 })).ok).toBe(false);
    expect(gameStateValidator(roundTrip({ ...s, score: -5 })).ok).toBe(false);
    expect(gameStateValidator(roundTrip({ ...s, won: true })).ok).toBe(false);
    expect(gameStateValidator(null).ok).toBe(false);
    expect(gameStateValidator('x').ok).toBe(false);
  });

  it('keeps the won flag consistent with the foundations', () => {
    const s = makeState({
      foundations: [foundation('spades', 12), foundation('hearts', 13), foundation('diamonds', 13), foundation('clubs', 13)],
      tableau: columns([up('KS')]),
    });
    expect(gameStateValidator(roundTrip(s)).ok).toBe(true);
    const won = applyMove(s, { from: tableauRef(0), to: foundationRef(0), count: 1 })?.state as GameState;
    expect(gameStateValidator(roundTrip(won)).ok).toBe(true);
    expect(gameStateValidator(roundTrip({ ...won, won: false })).ok).toBe(false);
  });

  it('remembers the draw mode preference', () => {
    expect(loadDrawPreference()).toBe(1);
    saveDrawPreference(3);
    expect(loadDrawPreference()).toBe(3);
    saveDrawPreference(1);
    expect(loadDrawPreference()).toBe(1);
  });
});
