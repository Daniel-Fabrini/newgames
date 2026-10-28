import { describe, expect, it } from 'vitest';
import { savedValidator, configValidator, type SavedCheckers } from './save';
import { applyMove, legalMoves, movePath, newGame, replay, squareAt } from './engine';
import { Rng } from '../../utils/random';

const at = (name: string) => squareAt(8 - Number(name.slice(1)), name.charCodeAt(0) - 97);

function playedGame(plies: number, seed = 1) {
  const rng = new Rng(seed);
  let g = newGame();
  for (let i = 0; i < plies && !g.result; i++) g = applyMove(g, rng.pick(legalMoves(g)));
  return g;
}

const base = (moves: number[][]): SavedCheckers => ({
  config: { mode: 'ai', humanSide: 'w', difficulty: 'hard' },
  moves,
  rng: 12345,
  elapsedMs: 4200,
});

describe('checkers save validation', () => {
  it('accepts a valid in-progress game and replays it identically', () => {
    const g = playedGame(30);
    const saved = base(g.moves.map(movePath));
    const r = savedValidator(JSON.parse(JSON.stringify(saved)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(saved);
      expect(replay(r.value.moves)?.board).toEqual(g.board);
    }
  });

  it('accepts a fresh game with no moves', () => {
    expect(savedValidator(base([])).ok).toBe(true);
  });

  it('rejects illegal move sequences', () => {
    expect(savedValidator(base([[at('c3'), at('e5')]])).ok).toBe(false);
    // Black cannot move first.
    expect(savedValidator(base([[at('f6'), at('e5')]])).ok).toBe(false);
    // A legal first move played twice is illegal (wrong side to move).
    const first = [at('c3'), at('d4')];
    expect(savedValidator(base([first, first])).ok).toBe(false);
  });

  it('rejects finished games', () => {
    // Play random games until one finishes, then try to save it.
    let finished = null;
    for (let seed = 1; seed < 200 && !finished; seed++) {
      const g = playedGame(400, seed);
      if (g.result) finished = g;
    }
    expect(finished).not.toBeNull();
    if (finished) expect(savedValidator(base(finished.moves.map(movePath))).ok).toBe(false);
  });

  it('rejects malformed data', () => {
    expect(savedValidator(null).ok).toBe(false);
    expect(savedValidator({ ...base([]), rng: -1 }).ok).toBe(false);
    expect(savedValidator({ ...base([]), elapsedMs: 'soon' }).ok).toBe(false);
    expect(savedValidator({ ...base([]), moves: [[40, 41]] }).ok).toBe(false);
    expect(savedValidator({ ...base([]), moves: [[21]] }).ok).toBe(false);
    expect(savedValidator({ ...base([]), moves: [[21.5, 17]] }).ok).toBe(false);
    expect(savedValidator({ ...base([]), config: { mode: 'online', humanSide: 'w', difficulty: 'hard' } }).ok).toBe(false);
    expect(savedValidator({ ...base([]), config: { mode: 'ai', humanSide: 'red', difficulty: 'hard' } }).ok).toBe(false);
    expect(savedValidator({ ...base([]), config: { mode: 'ai', humanSide: 'w', difficulty: 'expert' } }).ok).toBe(false);
  });

  it('validates setup preferences', () => {
    expect(configValidator({ mode: '2p', humanSide: 'b', difficulty: 'easy' }).ok).toBe(true);
    expect(configValidator({ mode: '2p', humanSide: 'x', difficulty: 'easy' }).ok).toBe(false);
  });
});
