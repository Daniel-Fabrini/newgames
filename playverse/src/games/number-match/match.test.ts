import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { COLS, appendRemaining, canPair, checkPair, connection, digitsMatch, emptyRows, findPairs, firstPair, hasPair, removeRows, toRows } from './match';
import { board } from './testUtils';

const at = (row: number, col: number) => row * COLS + col;

describe('digit matching', () => {
  it('accepts equal digits and digits that add up to 10', () => {
    for (let d = 1; d <= 9; d++) {
      expect(digitsMatch(d, d)).toBe(true);
      expect(digitsMatch(d, 10 - d)).toBe(true);
    }
  });

  it('rejects other combinations and cleared cells', () => {
    expect(digitsMatch(3, 8)).toBe(false);
    expect(digitsMatch(1, 2)).toBe(false);
    expect(digitsMatch(4, 5)).toBe(false);
    expect(digitsMatch(9, 9)).toBe(true);
    expect(digitsMatch(0, 0)).toBe(false);
    expect(digitsMatch(0, 10)).toBe(false);
  });
});

describe('connectivity', () => {
  it('rule 1 — same row: adjacent, across cleared cells, blocked by a digit', () => {
    const cells = board('3..7.5..5', '123456789');
    expect(connection(cells, 0, 3)).toBe('row'); // only cleared cells between
    expect(canPair(cells, 0, 3)).toBe(true); // 3 + 7
    expect(canPair(cells, 5, 8)).toBe(true); // 5 and 5 across two cleared cells
    expect(connection(cells, 3, 5)).toBe('row');
    expect(canPair(cells, 3, 5)).toBe(false); // 7 and 5 do not match
    expect(connection(cells, 0, 5)).toBe(null); // the 7 is in the way
    expect(canPair(cells, 3, 8)).toBe(false); // blocked by the 5 at col 5
    expect(connection(cells, at(1, 0), at(1, 1))).toBe('row');
  });

  it('rule 2 — same column: adjacent, across cleared cells, blocked by a digit', () => {
    const cells = board('312456789', '.11111111', '3........', '7........', '4........');
    expect(connection(cells, at(0, 0), at(2, 0))).toBe('column');
    expect(canPair(cells, at(0, 0), at(2, 0))).toBe(true); // 3 and 3 across a cleared cell
    expect(connection(cells, at(0, 0), at(3, 0))).toBe(null); // the 3 at row 2 blocks
    expect(canPair(cells, at(2, 0), at(3, 0))).toBe(true); // 3 + 7
    expect(connection(cells, at(0, 1), at(1, 1))).toBe('column');
    expect(canPair(cells, at(1, 1), at(0, 1))).toBe(true); // order of the taps does not matter
  });

  it('rule 3 — diagonal down-right and down-left, adjacent and blocked', () => {
    const cells = board('5.......8', '.2.....2.', '..3...4..', '...9.....');
    expect(connection(cells, at(1, 1), at(2, 2))).toBe('diagonal'); // down-right
    expect(connection(cells, at(0, 0), at(3, 3))).toBe(null); // 2 and 3 in the way
    expect(connection(cells, at(0, 8), at(1, 7))).toBe('diagonal'); // down-left
    expect(canPair(cells, at(0, 8), at(1, 7))).toBe(true); // 8 + 2
    expect(connection(cells, at(0, 8), at(2, 6))).toBe(null); // the 2 at (1,7) blocks
    expect(canPair(cells, at(2, 6), at(1, 7))).toBe(false); // connected but 4 and 2 do not match
  });

  it('rule 3 — diagonals across cleared cells, in both directions', () => {
    const right = board('5........', '........1', '..5......');
    expect(connection(right, at(0, 0), at(2, 2))).toBe('diagonal');
    expect(canPair(right, at(2, 2), at(0, 0))).toBe(true);
    const left = board('1...5....', '1........', '..5......');
    expect(connection(left, at(0, 4), at(2, 2))).toBe('diagonal');
    expect(canPair(left, at(0, 4), at(2, 2))).toBe(true);
    expect(connection(left, at(2, 2), at(0, 4))).toBe('diagonal');
  });

  it('does not treat other offsets or wrapped flat steps as diagonals', () => {
    const knight = board('1....2...', '..1......');
    expect(connection(knight, at(0, 0), at(1, 2))).toBe(null);
    // Flat step of 10 from the last column lands on column 0 two rows down: not a diagonal.
    const wrapRight = board('........1', '1........', '1........');
    expect(connection(wrapRight, at(0, 8), at(2, 0))).toBe(null);
    // Flat step of 16 from column 0 lands on (1,7): not a diagonal either.
    const wrapLeft = board('5..2.....', '.......5.');
    expect(connection(wrapLeft, at(0, 0), at(1, 7))).toBe(null);
  });

  it('rule 4 — reading order wraps from the end of a row to the start of the next', () => {
    const wrap = board('123456783', '7........');
    expect(connection(wrap, at(0, 8), at(1, 0))).toBe('reading');
    expect(canPair(wrap, at(0, 8), at(1, 0))).toBe(true); // 3 + 7 across rows
    const trailing = board('12345678.', '2........');
    expect(connection(trailing, at(0, 7), at(1, 0))).toBe('reading'); // cleared cell at the end of the row
    expect(canPair(trailing, at(0, 7), at(1, 0))).toBe(true); // 8 + 2
  });

  it('rule 4 — reading order across cleared cells of two rows, and blocked', () => {
    const cells = board('2....1...', '..9......');
    expect(connection(cells, at(0, 5), at(1, 2))).toBe('reading'); // not a row/column/diagonal
    expect(canPair(cells, at(0, 5), at(1, 2))).toBe(true); // 1 + 9
    const blocked = cells.slice();
    blocked[at(0, 7)] = 4;
    expect(connection(blocked, at(0, 5), at(1, 2))).toBe(null);
    const blockedNextRow = cells.slice();
    blockedNextRow[at(1, 0)] = 6;
    expect(canPair(blockedNextRow, at(0, 5), at(1, 2))).toBe(false);
  });

  it('never wraps from the last cell back to the first one', () => {
    const cells = board('5.......1', '........5');
    expect(connection(cells, 0, cells.length - 1)).toBe(null);
    expect(canPair(cells, cells.length - 1, 0)).toBe(false);
  });

  it('works with a partial last row', () => {
    const cells = board('123456789', '1.7');
    expect(canPair(cells, at(0, 2), at(1, 2))).toBe(true); // column: 3 + 7
    expect(connection(cells, at(0, 3), at(1, 2))).toBe('diagonal'); // down-left into the partial row
    expect(canPair(cells, at(0, 0), at(1, 0))).toBe(true); // column: 1 and 1
  });

  it('reports why a pair is rejected', () => {
    const cells = board('5.35.....', '5........');
    expect(checkPair(cells, 0, 0)).toEqual({ ok: false, reason: 'same' });
    expect(checkPair(cells, 0, 1)).toEqual({ ok: false, reason: 'empty' });
    expect(checkPair(cells, 0, 2)).toEqual({ ok: false, reason: 'digits' }); // 5 and 3
    expect(checkPair(cells, 0, 3)).toEqual({ ok: false, reason: 'blocked' }); // 5 and 5 with the 3 between
    expect(checkPair(cells, 0, at(1, 0))).toEqual({ ok: true, link: 'column' });
    expect(checkPair(board('38'), 0, 1)).toEqual({ ok: false, reason: 'digits' }); // 3 and 8 are adjacent but invalid
  });

  it('rejects out-of-range indices', () => {
    const cells = board('11');
    expect(connection(cells, 0, 5)).toBe(null);
    expect(connection(cells, -1, 1)).toBe(null);
    expect(canPair(cells, 0, 2)).toBe(false);
  });
});

describe('pair search', () => {
  function bruteForce(cells: number[]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) if (canPair(cells, i, j)) out.push([i, j]);
    return out;
  }

  it('finds exactly the pairs a brute-force check finds, on many random boards', () => {
    const rng = new Rng(2024);
    for (let n = 0; n < 300; n++) {
      const length = rng.int(1, 60);
      const cells = Array.from({ length }, () => (rng.bool(0.45) ? 0 : rng.int(1, 9)));
      const expected = bruteForce(cells);
      expect(findPairs(cells)).toEqual(expected);
      expect(hasPair(cells)).toBe(expected.length > 0);
      expect(firstPair(cells)).toEqual(expected.length > 0 ? expected.reduce((best, p) => (p[0] < best[0] || (p[0] === best[0] && p[1] < best[1]) ? p : best)) : null);
    }
  });

  it('returns no pair for a board without matches', () => {
    expect(findPairs(board('123'))).toEqual([]);
    expect(firstPair(board('123'))).toBe(null);
    expect(hasPair(board('1234'))).toBe(false);
    // 1/3 and 2/4 share columns, 1/4 and 2/3 diagonals, 2/3 reading order: none of them match.
    expect(hasPair(board('12.......', '34.......'))).toBe(false);
  });

  it('firstPair returns the earliest pair in reading order', () => {
    expect(firstPair(board('12346'))).toEqual([3, 4]); // 4 + 6
  });
});

describe('rows and additions', () => {
  it('detects fully cleared rows (including a partial last row)', () => {
    expect(emptyRows(board('1........', '.........', '..'))).toEqual([1, 2]);
    expect(emptyRows(board('123456789'))).toEqual([]);
  });

  it('removes rows so later rows move up and keep their columns', () => {
    const cells = board('123456789', '.........', '987654321', '12');
    expect(toRows(removeRows(cells, [1]))).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [9, 8, 7, 6, 5, 4, 3, 2, 1],
      [1, 2],
    ]);
  });

  it('appends the remaining digits in reading order after the last cell (after trailing cleared cells)', () => {
    const cells = board('1.2......', '3..');
    expect(appendRemaining(cells)).toEqual([...cells, 1, 2, 3]);
  });
});
