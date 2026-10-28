import { describe, expect, it } from 'vitest';
import {
  BLACK_KING,
  BLACK_MAN,
  EMPTY,
  QUIET_PLY_LIMIT,
  RAYS,
  SQUARES,
  WHITE_KING,
  WHITE_MAN,
  agreeDraw,
  applyMove,
  boardBefore,
  capturedBy,
  colOf,
  countPieces,
  destination,
  findMove,
  generateMoves,
  legalMoves,
  movePath,
  newGame,
  notation,
  play,
  positionState,
  replay,
  rowOf,
  squareAt,
  trackPieces,
  type GameState,
  type Move,
  type Side,
} from './engine';
import { Rng } from '../../utils/random';

/** Algebraic square (a1 = White's bottom-left) to 0-based index. */
function at(name: string): number {
  const col = name.charCodeAt(0) - 97;
  const rank = Number(name.slice(1));
  const sq = squareAt(8 - rank, col);
  if (sq < 0) throw new Error(`${name} is not a dark square`);
  return sq;
}

const PIECES: Record<string, number> = { w: WHITE_MAN, W: WHITE_KING, b: BLACK_MAN, B: BLACK_KING };

/** Board from a map of algebraic squares to piece letters (w/W white man/king, b/B black man/king). */
function boardOf(pieces: Record<string, string>): number[] {
  const board = Array<number>(SQUARES).fill(EMPTY);
  for (const [name, letter] of Object.entries(pieces)) board[at(name)] = PIECES[letter] as number;
  return board;
}

const state = (pieces: Record<string, string>, turn: Side = 'w', quietPlies = 0): GameState => positionState(boardOf(pieces), turn, quietPlies);

const notations = (moves: readonly Move[]) => moves.map(notation).sort();

/** Plays moves given in standard notation (1-based, "-" or "x" separated). */
function playAll(s: GameState, list: string[]): GameState {
  let current = s;
  for (const n of list) {
    const squares = n.split(/[-x]/).map((x) => Number(x) - 1);
    const next = play(current, squares);
    if (!next) throw new Error(`illegal move ${n}`);
    current = next;
  }
  return current;
}

describe('board geometry and numbering', () => {
  it('uses the standard 1–32 numbering with a dark square at the bottom-left', () => {
    expect(at('a1') + 1).toBe(29);
    expect(at('g1') + 1).toBe(32);
    expect(at('b8') + 1).toBe(1);
    expect(at('h8') + 1).toBe(4);
    expect(at('c3') + 1).toBe(22);
    expect(at('d4') + 1).toBe(18);
    expect(squareAt(7, 7)).toBe(-1); // h1 is light
    for (let sq = 0; sq < SQUARES; sq++) expect(squareAt(rowOf(sq), colOf(sq))).toBe(sq);
  });

  it('computes diagonal rays', () => {
    // Long diagonal a1–h8 from a1 going up-right.
    expect((RAYS[1]?.[at('a1')] ?? []).map((s) => s + 1)).toEqual([25, 22, 18, 15, 11, 8, 4]);
    expect(RAYS[2]?.[at('a1')]).toEqual([]);
  });
});

describe('initial position', () => {
  it('has 12 men each on the first three rows and White to move', () => {
    const g = newGame();
    expect(g.turn).toBe('w');
    expect(countPieces(g.board, 'w')).toEqual({ men: 12, kings: 0 });
    expect(countPieces(g.board, 'b')).toEqual({ men: 12, kings: 0 });
    for (let sq = 0; sq < 12; sq++) expect(g.board[sq]).toBe(BLACK_MAN);
    for (let sq = 12; sq < 20; sq++) expect(g.board[sq]).toBe(EMPTY);
    for (let sq = 20; sq < 32; sq++) expect(g.board[sq]).toBe(WHITE_MAN);
    expect(g.result).toBeNull();
  });

  it('gives White exactly the seven standard opening moves', () => {
    expect(notations(legalMoves(newGame()))).toEqual(['21-17', '22-17', '22-18', '23-18', '23-19', '24-19', '24-20'].sort());
  });

  it('gives Black seven replies after the first move', () => {
    const g = playAll(newGame(), ['22-18']);
    expect(g.turn).toBe('b');
    expect(notations(legalMoves(g))).toEqual(['10-14', '10-15', '11-15', '11-16', '12-16', '9-13', '9-14'].sort());
  });
});

describe('men', () => {
  it('move one square diagonally forward only', () => {
    expect(notations(legalMoves(state({ c3: 'w' })))).toEqual(['22-17', '22-18']);
    expect(notations(legalMoves(state({ f6: 'b' }, 'b')))).toEqual(['11-15', '11-16']);
    // On the edge only one direction exists.
    expect(notations(legalMoves(state({ a3: 'w' })))).toEqual(['21-17']);
  });

  it('cannot move onto occupied squares', () => {
    expect(notations(legalMoves(state({ c3: 'w', b4: 'w', d4: 'w', e5: 'w', c5: 'w', a5: 'w' })))).not.toContain('22-17');
  });

  it('capture forward by jumping an adjacent piece', () => {
    expect(notations(legalMoves(state({ c3: 'w', d4: 'b' })))).toEqual(['22x15']);
  });

  it('capture backward too', () => {
    // White man on c3 jumps the black piece on d2 landing on e1.
    const moves = legalMoves(state({ c3: 'w', d2: 'b', h8: 'b' }));
    expect(notations(moves)).toEqual(['22x31']);
    // Black man captures backward (towards its own side).
    expect(notations(legalMoves(state({ d4: 'b', e5: 'w' }, 'b')))).toEqual(['18x11']);
  });

  it('cannot capture when the landing square is occupied or off the board', () => {
    expect(legalMoves(state({ c3: 'w', d4: 'b', e5: 'b' })).every((m) => m.captures.length === 0)).toBe(true);
    expect(legalMoves(state({ g3: 'w', h4: 'b' })).every((m) => m.captures.length === 0)).toBe(true);
  });

  it('cannot capture their own pieces', () => {
    expect(legalMoves(state({ c3: 'w', d4: 'w' })).every((m) => m.captures.length === 0)).toBe(true);
  });

  it('do not capture at a distance like kings', () => {
    expect(legalMoves(state({ c3: 'w', e5: 'b' })).every((m) => m.captures.length === 0)).toBe(true);
  });
});

describe('flying kings', () => {
  it('move any number of empty squares in all four directions', () => {
    expect(notations(legalMoves(state({ a1: 'W' })))).toEqual(['29-25', '29-22', '29-18', '29-15', '29-11', '29-8', '29-4'].sort());
    const fromD4 = legalMoves(state({ d4: 'W' }));
    expect(fromD4).toHaveLength(13);
  });

  it('are blocked by any piece on the diagonal', () => {
    const moves = legalMoves(state({ a1: 'W', d4: 'w' })).filter((m) => m.from === at('a1'));
    expect(notations(moves)).toEqual(['29-22', '29-25']);
  });

  it('capture a piece at a distance and may land on any empty square beyond it', () => {
    const moves = legalMoves(state({ a1: 'W', e5: 'b' }));
    expect(notations(moves)).toEqual(['29x11', '29x4', '29x8'].sort());
    for (const m of moves) expect(m.captures).toEqual([at('e5')]);
  });

  it('cannot jump two pieces in a row or a piece with no empty square behind it', () => {
    expect(legalMoves(state({ a1: 'W', d4: 'b', e5: 'b' })).every((m) => m.captures.length === 0)).toBe(true);
    expect(legalMoves(state({ a1: 'W', h8: 'b' })).every((m) => m.captures.length === 0)).toBe(true);
  });

  it('can change direction during a multi-capture', () => {
    // a1 x c3 → lands d4/e5…; from e5 it can capture f4 → g3/h2.
    const moves = legalMoves(state({ a1: 'W', c3: 'b', f4: 'b' }));
    expect(moves.every((m) => m.captures.length === 2)).toBe(true);
    expect(notations(moves)).toEqual(['29x15x24', '29x15x28'].sort());
  });
});

describe('mandatory capture and majority rule', () => {
  it('forbids simple moves when a capture exists', () => {
    const moves = legalMoves(state({ c3: 'w', g3: 'w', d4: 'b' }));
    expect(moves).toHaveLength(1);
    expect(notation(moves[0] as Move)).toBe('22x15');
  });

  it('applies to kings and men alike', () => {
    const moves = legalMoves(state({ a1: 'W', g3: 'w', h4: 'b', f2: 'b' }));
    expect(moves.every((m) => m.captures.length > 0)).toBe(true);
  });

  it('requires the sequence that captures the most pieces', () => {
    // a3 can capture one piece (b4); e3 can capture two (f4, f6).
    const moves = legalMoves(state({ a3: 'w', e3: 'w', b4: 'b', f4: 'b', f6: 'b' }));
    expect(notations(moves)).toEqual(['23x16x7']);
  });

  it('counts kings and men the same (no preference for capturing kings)', () => {
    const moves = legalMoves(state({ a3: 'w', e3: 'w', b4: 'B', f4: 'b', f6: 'b' }));
    expect(notations(moves)).toEqual(['23x16x7']);
  });

  it('lets the player choose freely among sequences with the same count', () => {
    // Two different single captures are both legal.
    const moves = legalMoves(state({ c3: 'w', g3: 'w', d4: 'b', h4: 'b', f4: 'b' }));
    expect(moves.every((m) => m.captures.length === 1)).toBe(true);
    expect(moves.length).toBeGreaterThan(1);
  });

  it('forces multi-captures to be completed', () => {
    const moves = legalMoves(state({ c3: 'w', d4: 'b', d6: 'b' }));
    expect(notations(moves)).toEqual(['22x15x6']);
    expect(play(state({ c3: 'w', d4: 'b', d6: 'b' }), [at('c3'), at('e5')])).toBeNull();
  });
});

describe('Turkish strike rule', () => {
  it('never jumps the same piece twice', () => {
    // After c3xe5 a man could otherwise jump d4 back again.
    const moves = legalMoves(state({ c3: 'w', d4: 'b' }));
    expect(moves).toHaveLength(1);
    expect(moves[0]?.captures).toEqual([at('d4')]);
  });

  it('keeps captured pieces on the board until the end of the sequence (they block)', () => {
    // a1xe5xg3xe1 captures c3, f4, f2. From e1 the captured c3 still blocks the diagonal, so b4 cannot
    // be taken — if pieces were removed immediately the king would capture four.
    const s = state({ a1: 'W', c3: 'b', f4: 'b', f2: 'b', b4: 'b' });
    const moves = legalMoves(s);
    expect(notations(moves)).toEqual(['29x15x24x31']);
    const after = applyMove(s, moves[0] as Move);
    expect(after.board[at('c3')]).toBe(EMPTY);
    expect(after.board[at('f4')]).toBe(EMPTY);
    expect(after.board[at('f2')]).toBe(EMPTY);
    expect(after.board[at('b4')]).toBe(BLACK_MAN);
    expect(after.board[at('e1')]).toBe(WHITE_KING);
  });

  it('treats the starting square as empty during the sequence', () => {
    // King on c3 captures around a square of four pieces and may pass over/return to c3.
    const s = state({ c3: 'W', d4: 'b', f4: 'b', f2: 'b', d2: 'b' });
    const moves = legalMoves(s);
    expect(moves.every((m) => m.captures.length === 4)).toBe(true);
    expect(moves.some((m) => destination(m) === at('c3'))).toBe(true);
  });

  it('produces sequences whose captured pieces are all distinct opponents', () => {
    const rng = new Rng(77);
    for (let game = 0; game < 25; game++) {
      let g = newGame();
      for (let ply = 0; ply < 120 && !g.result; ply++) {
        const moves = legalMoves(g);
        for (const m of moves) {
          expect(new Set(m.captures).size).toBe(m.captures.length);
          for (const c of m.captures) expect(Math.sign(g.board[c] as number)).toBe(g.turn === 'w' ? -1 : 1);
          expect(m.path).toHaveLength(Math.max(1, m.captures.length));
        }
        g = applyMove(g, rng.pick(moves));
      }
    }
  });
});

describe('promotion', () => {
  it('promotes a man that ends its move on the far row', () => {
    const s = state({ c7: 'w', h4: 'b' });
    const after = playAll(s, ['6-1']);
    expect(after.board[at('b8')]).toBe(WHITE_KING);
    const black = playAll(state({ d2: 'b', h8: 'w' }, 'b'), ['26-30']);
    expect(black.board[at('c1')]).toBe(BLACK_KING);
  });

  it('promotes at the end of a capture that finishes on the far row', () => {
    const after = playAll(state({ b6: 'w', c7: 'b', a1: 'b' }), ['9x2']);
    expect(after.board[at('d8')]).toBe(WHITE_KING);
  });

  it('does not promote a man that passes the far row and keeps capturing', () => {
    // b6 x c7 lands on d8, then must continue backward over e7 to f6, and stays a man.
    const s = state({ b6: 'w', c7: 'b', e7: 'b', a1: 'b' });
    const moves = legalMoves(s);
    expect(notations(moves)).toEqual(['9x2x11']);
    expect(moves[0]?.promotes).toBe(false);
    const after = applyMove(s, moves[0] as Move);
    expect(after.board[at('f6')]).toBe(WHITE_MAN);
  });

  it('keeps capturing as a man (not as a flying king) after touching the far row', () => {
    // A king on d8 could take g5 at a distance; the man that just arrived there cannot.
    const s = state({ b6: 'w', c7: 'b', g5: 'b', a1: 'b' });
    const moves = legalMoves(s);
    expect(notations(moves)).toEqual(['9x2']);
    expect(moves[0]?.promotes).toBe(true);
  });
});

describe('end of game', () => {
  it('a player with no pieces loses', () => {
    const after = playAll(state({ c3: 'w', d4: 'b' }), ['22x15']);
    expect(after.result).toEqual({ winner: 'w', reason: 'no-pieces' });
    expect(legalMoves(after)).toEqual([]);
  });

  it('a player with no legal move loses', () => {
    // Black's only man on h2 is blocked by g1 and cannot capture it (no square beyond).
    const after = playAll(state({ a1: 'W', g1: 'w', h2: 'b' }), ['29-25']);
    expect(after.result).toEqual({ winner: 'w', reason: 'no-moves' });
  });

  it('detects a position where the side to move is already blocked', () => {
    const s = state({ a7: 'w', b8: 'b', c7: 'w', d6: 'w' }, 'b');
    expect(s.result).toEqual({ winner: 'w', reason: 'no-moves' });
  });

  it('Black wins too', () => {
    const after = playAll(state({ d4: 'b', c3: 'w' }, 'b'), ['18x25']);
    expect(after.result).toEqual({ winner: 'b', reason: 'no-pieces' });
  });

  it('ignores moves after the game ended', () => {
    const over = playAll(state({ c3: 'w', d4: 'b' }), ['22x15']);
    const move = generateMoves(over.board, over.turn)[0];
    if (move) expect(applyMove(over, move)).toBe(over);
  });
});

describe('draws', () => {
  const shuffle = ['29-25', '28-32', '25-29', '32-28'];

  it('threefold repetition of the same position with the same side to move', () => {
    const s = state({ a1: 'W', h2: 'B' });
    const twice = playAll(s, shuffle);
    expect(twice.result).toBeNull(); // second occurrence
    const almost = playAll(twice, shuffle.slice(0, 3));
    expect(almost.result).toBeNull();
    const third = playAll(almost, shuffle.slice(3));
    expect(third.result).toEqual({ winner: null, reason: 'repetition' });
  });

  it('a man move or capture resets the repetition history', () => {
    const s = state({ a1: 'W', h2: 'B', a5: 'w', h8: 'b' });
    let g = playAll(s, shuffle);
    expect(g.positions).toHaveLength(5);
    g = playAll(g, ['13-9']);
    expect(g.positions).toHaveLength(1);
  });

  it('20 moves by each player with only kings moving and no capture', () => {
    const s = state({ a1: 'W', h2: 'B' }, 'w', QUIET_PLY_LIMIT - 1);
    const after = playAll(s, ['29-25']);
    expect(after.quietPlies).toBe(QUIET_PLY_LIMIT);
    expect(after.result).toEqual({ winner: null, reason: 'king-moves' });
  });

  it('counts king moves and resets on a man move or a capture', () => {
    let g = playAll(state({ a1: 'W', h2: 'B', a5: 'w', h8: 'b' }), ['29-25', '28-32']);
    expect(g.quietPlies).toBe(2);
    g = playAll(g, ['13-9']); // white man moves
    expect(g.quietPlies).toBe(0);
    const capture = playAll(state({ a1: 'W', e5: 'b', h2: 'B' }, 'w', 30), ['29x8']);
    expect(capture.quietPlies).toBe(0);
    expect(capture.result).toBeNull();
  });

  it('plays 40 king plies without repetition to a draw', () => {
    // White cycles over 3 squares and Black over 4, so no position occurs three times within 40 plies.
    const white = ['29-25', '25-22', '22-29'];
    const black = ['28-32', '32-27', '27-24', '24-28'];
    let g = state({ a1: 'W', h2: 'B' });
    for (let ply = 0; ply < QUIET_PLY_LIMIT; ply++) {
      expect(g.result).toBeNull();
      const m = ply % 2 === 0 ? white[(ply / 2) % 3] : black[((ply - 1) / 2) % 4];
      g = playAll(g, [m as string]);
    }
    expect(g.quietPlies).toBe(QUIET_PLY_LIMIT);
    expect(g.result).toEqual({ winner: null, reason: 'king-moves' });
  });

  it('draw by agreement', () => {
    const g = agreeDraw(newGame());
    expect(g.result).toEqual({ winner: null, reason: 'agreement' });
    expect(agreeDraw(g)).toBe(g);
  });
});

describe('notation, replay and helpers', () => {
  it('writes simple moves with "-" and captures with every landing square', () => {
    const s = state({ c3: 'w', d4: 'b', f6: 'b' });
    const moves = legalMoves(s);
    expect(notations(moves)).toEqual(['22x15x8']);
    expect(movePath(moves[0] as Move).map((x) => x + 1)).toEqual([22, 15, 8]);
    expect(notation(legalMoves(newGame()).find((m) => m.from === at('c3') && destination(m) === at('d4')) as Move)).toBe('22-18');
  });

  it('finds moves by their visited squares and rejects illegal ones', () => {
    const g = newGame();
    expect(findMove(g, [at('c3'), at('d4')])).toBeDefined();
    expect(findMove(g, [at('c3'), at('e5')])).toBeUndefined();
    expect(play(g, [at('d6'), at('c5')])).toBeNull(); // Black piece, White to move
  });

  it('replays a game from the move list and rejects illegal lists', () => {
    const rng = new Rng(3);
    let g = newGame();
    for (let i = 0; i < 40 && !g.result; i++) g = applyMove(g, rng.pick(legalMoves(g)));
    const again = replay(g.moves.map(movePath));
    expect(again?.board).toEqual(g.board);
    expect(again?.turn).toBe(g.turn);
    expect(again?.positions).toEqual(g.positions);
    expect(replay([[at('c3'), at('e5')]])).toBeNull();
  });

  it('tracks piece identities through moves and captures', () => {
    const g = playAll(newGame(), ['22-18', '11-15', '18x11']);
    const ids = trackPieces(g.moves);
    expect(ids[at('f6')]).toBe(at('c3')); // the c3 man is now on f6
    expect(ids[at('e5')]).toBe(-1); // captured
    expect(ids.filter((id) => id >= 0)).toHaveLength(23);
  });

  it('reconstructs the board before a move', () => {
    const g = playAll(newGame(), ['22-18', '11-15', '18x11']);
    const last = g.moves[g.moves.length - 1] as Move;
    const before = playAll(newGame(), ['22-18', '11-15']);
    expect(boardBefore(g.board, last)).toEqual(before.board);
  });

  it('counts captured pieces', () => {
    const g = playAll(newGame(), ['22-18', '11-15', '18x11']);
    expect(capturedBy(g.board, 'w')).toBe(1);
    expect(capturedBy(g.board, 'b')).toBe(0);
  });
});
