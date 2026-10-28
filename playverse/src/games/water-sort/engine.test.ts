import { describe, expect, it } from 'vitest';
import {
  CAPACITY,
  canUndo,
  checkPour,
  createLevelState,
  hasUsefulMove,
  isBottleDone,
  isSolved,
  isWellFormed,
  legalMoves,
  markHintUsed,
  movesOf,
  playPour,
  pour,
  replay,
  restartLevel,
  starsFor,
  starThresholds,
  topRunLength,
  undoPour,
  unpour,
  type Bottles,
} from './engine';

// Colour ids: 0 = A, 1 = B, 2 = C. Bottles are bottom → top.
const A = 0;
const B = 1;
const C = 2;

describe('pour legality', () => {
  const bottles: Bottles = [[A, B, B], [B], [], [A, A, C, C], [C]];

  it('rejects out-of-range or non-integer bottles', () => {
    expect(checkPour(bottles, -1, 0)).toEqual({ ok: false, reason: 'invalid-bottle' });
    expect(checkPour(bottles, 0, 9)).toEqual({ ok: false, reason: 'invalid-bottle' });
    expect(checkPour(bottles, 0.5, 1)).toEqual({ ok: false, reason: 'invalid-bottle' });
  });

  it('rejects pouring a bottle into itself', () => {
    expect(checkPour(bottles, 0, 0)).toEqual({ ok: false, reason: 'same-bottle' });
  });

  it('rejects an empty source', () => {
    expect(checkPour(bottles, 2, 1)).toEqual({ ok: false, reason: 'source-empty' });
  });

  it('rejects a full target', () => {
    expect(checkPour(bottles, 4, 3)).toEqual({ ok: false, reason: 'target-full' });
  });

  it('rejects a target whose top colour differs', () => {
    expect(checkPour(bottles, 0, 4)).toEqual({ ok: false, reason: 'colour-mismatch' });
    expect(checkPour(bottles, 4, 1)).toEqual({ ok: false, reason: 'colour-mismatch' });
  });

  it('allows pouring into an empty bottle', () => {
    expect(checkPour(bottles, 0, 2)).toEqual({ ok: true, amount: 2, colour: B });
  });

  it('allows pouring onto the same colour', () => {
    expect(checkPour(bottles, 1, 0)).toEqual({ ok: true, amount: 1, colour: B });
    expect(checkPour(bottles, 0, 1)).toEqual({ ok: true, amount: 2, colour: B });
  });

  it('allows any legal pour by the rules, even pointless ones (a finished bottle into an empty one)', () => {
    expect(checkPour([[A, A, A, A], []], 0, 1)).toEqual({ ok: true, amount: 4, colour: A });
  });

  it('lists every legal pour', () => {
    const moves = legalMoves([[A, B], [B], []]);
    expect(moves).toEqual([
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 0 },
      { from: 1, to: 2 },
    ]);
  });
});

describe('amount poured', () => {
  it('moves the whole contiguous top run when there is room', () => {
    const res = pour([[A, B, B, B], [B], []], 0, 2);
    expect(res?.move.amount).toBe(3);
    expect(res?.bottles).toEqual([[A], [B], [B, B, B]]);
  });

  it('is limited by the free space in the target', () => {
    const res = pour([[A, B, B, B], [C, C, B]], 0, 1);
    expect(res?.move.amount).toBe(1);
    expect(res?.bottles).toEqual([[A, B, B], [C, C, B, B]]);
    const two = pour([[B, B, B], [C, B]], 0, 1);
    expect(two?.move.amount).toBe(2);
    expect(two?.bottles).toEqual([[B], [C, B, B, B]]);
  });

  it('only takes the top run, never the colour below it', () => {
    const res = pour([[B, A, B], []], 0, 1);
    expect(res?.move.amount).toBe(1);
    expect(res?.bottles).toEqual([[B, A], [B]]);
  });

  it('measures the top run', () => {
    expect(topRunLength([])).toBe(0);
    expect(topRunLength([A])).toBe(1);
    expect(topRunLength([A, B, B])).toBe(2);
    expect(topRunLength([B, B, B, B])).toBe(4);
  });

  it('returns null for illegal pours and never mutates the input', () => {
    const input = [[A, B], [C]];
    const copy = JSON.parse(JSON.stringify(input));
    expect(pour(input, 0, 1)).toBeNull();
    pour(input, 1, 0);
    expect(input).toEqual(copy);
  });

  it('unpour exactly reverses a pour', () => {
    const before = [[A, B, B], [B], [C, A]];
    const res = pour(before, 0, 1);
    expect(res).not.toBeNull();
    expect(unpour(res!.bottles, res!.move)).toEqual(before);
    expect(unpour(res!.bottles, { ...res!.move, colour: C })).toBeNull();
  });
});

describe('win detection', () => {
  it('is won when every bottle is empty or full of one colour', () => {
    expect(isSolved([[A, A, A, A], [B, B, B, B], []])).toBe(true);
    expect(isSolved([[], []])).toBe(true);
  });

  it('is not won when a full bottle has mixed colours', () => {
    expect(isSolved([[A, A, A, B], [B, B, B, A], []])).toBe(false);
  });

  it('is not won while a single-colour bottle is only partially filled', () => {
    expect(isSolved([[A, A, A], [A], [B, B, B, B]])).toBe(false);
    expect(isBottleDone([A, A, A])).toBe(false);
    expect(isBottleDone([A, A, A, A])).toBe(true);
    expect(isBottleDone([])).toBe(true);
  });

  it('flags the winning pour and blocks further pours', () => {
    const s = createLevelState(1, [[A, A, A], [B, B, B, B], [A]], 1);
    const r = playPour(s, 2, 0);
    expect(r.ok && r.won).toBe(true);
    if (!r.ok) throw new Error('expected a legal pour');
    expect(r.state.won).toBe(true);
    expect(playPour(r.state, 0, 2)).toEqual({ ok: false, reason: 'finished' });
    expect(canUndo(r.state)).toBe(false);
  });
});

describe('level play state', () => {
  const start = [[A, B, A, B], [B, A, B, A], [], []];

  it('counts one move per pour and records the history', () => {
    let s = createLevelState(3, start, 6);
    const r1 = playPour(s, 0, 2);
    if (!r1.ok) throw new Error('legal');
    s = r1.state;
    expect(movesOf(s)).toBe(1);
    expect(s.history).toEqual([{ from: 0, to: 2, amount: 1, colour: B }]);
    expect(s.initial).toEqual(start);
  });

  it('does not count illegal pours', () => {
    const s = createLevelState(3, start, 6);
    const r = playPour(s, 2, 0);
    expect(r).toEqual({ ok: false, reason: 'source-empty' });
    expect(movesOf(s)).toBe(0);
  });

  it('undo takes pours back one by one, down to the start position', () => {
    let s = createLevelState(3, start, 6);
    const snapshots = [s.bottles];
    for (const [from, to] of [
      [0, 2],
      [1, 3],
      [0, 3],
      [1, 2],
    ] as const) {
      const r = playPour(s, from, to);
      if (!r.ok) throw new Error(`illegal ${from}→${to}: ${r.reason}`);
      s = r.state;
      snapshots.push(s.bottles);
    }
    expect(movesOf(s)).toBe(4);
    for (let i = snapshots.length - 2; i >= 0; i--) {
      expect(canUndo(s)).toBe(true);
      s = undoPour(s);
      expect(s.bottles).toEqual(snapshots[i]);
      expect(movesOf(s)).toBe(i);
    }
    expect(canUndo(s)).toBe(false);
    expect(undoPour(s)).toBe(s);
  });

  it('restart returns to the start position as a fresh attempt', () => {
    let s = markHintUsed(createLevelState(3, start, 6));
    const r = playPour(s, 0, 2);
    if (!r.ok) throw new Error('legal');
    s = restartLevel(r.state);
    expect(s.bottles).toEqual(start);
    expect(s.history).toEqual([]);
    expect(s.hintsUsed).toBe(0);
    expect(s.par).toBe(6);
  });

  it('replay re-applies a history and rejects an illegal one', () => {
    expect(replay(start, [{ from: 0, to: 2 }])).toEqual([[A, B, A], [B, A, B, A], [B], []]);
    expect(replay(start, [{ from: 2, to: 0 }])).toBeNull();
  });

  it('knows when no useful move is left', () => {
    expect(hasUsefulMove([[A, B, A, B], [B, A, B, A]])).toBe(false);
    // Only moving a single-colour bottle into an empty one is possible: not useful.
    expect(hasUsefulMove([[A, B, A, B], [B, A, B, A], [C, C, C, C], []])).toBe(true);
    expect(hasUsefulMove([[A, A, A, A], []])).toBe(false);
    expect(hasUsefulMove([[A, B], [B]])).toBe(true);
  });

  it('validates positions', () => {
    expect(isWellFormed([[A, A, B, B], [B, B, A, A], []], 12)).toBe(true);
    expect(isWellFormed([[A, A, B], [B, B, A, A], []], 12)).toBe(false); // 3 A units
    expect(isWellFormed([[A, A, A, A, A]], 12)).toBe(false); // over capacity
    expect(isWellFormed([[12, 12, 12, 12]], 12)).toBe(false); // colour out of range
    expect(isWellFormed([[], []], 12)).toBe(false);
    expect(CAPACITY).toBe(4);
  });
});

describe('stars', () => {
  it('uses par plus slack for 3 and 2 stars', () => {
    expect(starThresholds(10)).toEqual({ three: 12, two: 16 });
    expect(starThresholds(40)).toEqual({ three: 46, two: 60 });
    expect(starsFor(10, 10, 0)).toBe(3);
    expect(starsFor(12, 10, 0)).toBe(3);
    expect(starsFor(13, 10, 0)).toBe(2);
    expect(starsFor(16, 10, 0)).toBe(2);
    expect(starsFor(17, 10, 0)).toBe(1);
    expect(starsFor(200, 10, 0)).toBe(1);
  });

  it('caps the stars at 2 when hints were used', () => {
    expect(starsFor(10, 10, 1)).toBe(2);
    expect(starsFor(14, 10, 3)).toBe(2);
    expect(starsFor(30, 10, 1)).toBe(1);
  });
});
