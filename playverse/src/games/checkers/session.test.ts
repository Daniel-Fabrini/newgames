import { describe, expect, it } from 'vitest';
import { displayPieces, humanMoveCount, undoPlies, type Session } from './session';
import { applyMove, findMove, legalMoves, newGame, squareAt, trackPieces, type GameState } from './engine';
import type { CheckersConfig } from './save';

const at = (name: string) => squareAt(8 - Number(name.slice(1)), name.charCodeAt(0) - 97);

/** Plays moves in standard 1-based notation. */
function play(list: string[]): GameState {
  let g = newGame();
  for (const n of list) {
    const move = findMove(g, n.split(/[-x]/).map((x) => Number(x) - 1));
    if (!move) throw new Error(`illegal ${n}`);
    g = applyMove(g, move);
  }
  return g;
}

const session = (game: GameState, config: Partial<CheckersConfig> = {}): Session => ({
  config: { mode: 'ai', humanSide: 'w', difficulty: 'medium', ...config },
  game,
  rng: 1,
});

describe('undo', () => {
  it('vs computer takes back the player’s last move and the computer’s reply', () => {
    expect(undoPlies(session(play(['22-18', '11-15'])))).toBe(2);
  });

  it('vs computer takes back only the player’s move while the computer is still thinking', () => {
    expect(undoPlies(session(play(['22-18', '11-15', '18x11'])))).toBe(1);
  });

  it('is unavailable before the player has moved (computer opened as White)', () => {
    expect(undoPlies(session(play(['22-18']), { humanSide: 'b' }))).toBe(0);
    expect(undoPlies(session(newGame()))).toBe(0);
    expect(undoPlies(session(play(['22-18', '11-15']), { humanSide: 'b' }))).toBe(1);
  });

  it('two players take back exactly one move', () => {
    expect(undoPlies(session(play(['22-18', '11-15']), { mode: '2p' }))).toBe(1);
    expect(undoPlies(session(newGame(), { mode: '2p' }))).toBe(0);
  });

  it('counts the player’s moves (abandoning after one counts as a loss)', () => {
    expect(humanMoveCount(session(play(['22-18'])))).toBe(1);
    expect(humanMoveCount(session(play(['22-18']), { humanSide: 'b' }))).toBe(0);
    expect(humanMoveCount(session(play(['22-18', '11-15', '18x11']), { mode: '2p' }))).toBe(3);
  });
});

describe('board display', () => {
  it('draws the current position with stable ids', () => {
    const g = play(['22-18']);
    const pieces = displayPieces(g, null, null, [], false);
    expect(pieces).toHaveLength(24);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(24);
    expect(pieces.find((p) => p.sq === at('d4'))?.id).toBe(at('c3'));
  });

  it('keeps captured pieces on the board during the playback and removes them at the end', () => {
    const g = play(['22-18', '11-15', '18x11']);
    const during = displayPieces(g, { ply: 3, step: 1 }, null, [], true);
    expect(during.find((p) => p.sq === at('e5'))?.state).toBe('taken');
    expect(during.find((p) => p.id === at('c3'))?.sq).toBe(at('f6'));
    const after = displayPieces(g, null, null, [], true);
    expect(after.find((p) => p.sq === at('e5'))?.state).toBe('ghost');
    expect(after.filter((p) => p.state !== 'ghost')).toHaveLength(23);
  });

  it('shows a partially entered capture: the piece at its last landing, captured pieces marked', () => {
    // Position from a real game with a 5-piece capture (two routes).
    const moves = [[23,18],[8,13],[21,17],[10,15],[17,8],[4,13],[20,16],[13,20],[22,17],[15,22,13],[27,23],[11,15],[25,21],[9,14],[30,25],[7,11],[31,27],[6,9],[25,22],[13,16],[21,12],[1,6],[23,19],[9,13]];
    let g = newGame();
    for (const squares of moves) g = applyMove(g, findMove(g, squares)!);
    const legal = legalMoves(g);
    expect(legal.every((m) => m.captures.length === 5)).toBe(true);
    const selection = { from: 19, path: [10] };
    const candidates = legal.filter((m) => m.from === 19 && m.path[0] === 10);
    const pieces = displayPieces(g, null, selection, candidates, false);
    const movingId = trackPieces(g.moves)[19];
    expect(pieces.find((p) => p.id === movingId)?.sq).toBe(10);
    expect(pieces.some((p) => p.sq === 19)).toBe(false);
    const taken = pieces.filter((p) => p.state === 'taken');
    expect(taken.map((p) => p.sq)).toEqual([candidates[0]?.captures[0]]);
  });
});
