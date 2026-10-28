import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import {
  CLASSIC_ADDS,
  CLASSIC_HINTS,
  MAX_CELLS,
  POINTS,
  UNDO_LIMIT,
  addNumbers,
  canAdd,
  canUndo,
  challengeStars,
  evaluateStatus,
  newChallenge,
  newClassic,
  nextStage,
  removePair,
  requestHint,
  stageBonus,
  undo,
  type GameState,
} from './engine';
import { canPair, digitCount, emptyRows, findPairs, hasPair, isDigit } from './match';
import { challengeConfig, classicDigitCount } from './generator';
import { board } from './testUtils';

function stateOf(cells: number[], extra: Partial<GameState> = {}): GameState {
  const addsLeft = extra.addsLeft ?? CLASSIC_ADDS;
  return {
    mode: 'classic',
    stage: 1,
    cells,
    score: 0,
    addsLeft,
    addsUsed: 0,
    hintsLeft: CLASSIC_HINTS,
    hintsUsed: 0,
    pairsCleared: 0,
    rowsCleared: 0,
    moves: 0,
    status: evaluateStatus(cells, addsLeft),
    rng: 1,
    undo: [],
    ...extra,
  };
}

function mustRemove(state: GameState, a: number, b: number) {
  const r = removePair(state, a, b);
  if (!r.ok) throw new Error(`expected ${a},${b} to be removable (${r.reason})`);
  return r;
}

describe('new classic run', () => {
  it('starts stage 1 with 27 seeded digits, 5 additions and 3 hints', () => {
    const s = newClassic(42);
    expect(s.cells).toHaveLength(27);
    expect(s.cells.every(isDigit)).toBe(true);
    expect(hasPair(s.cells)).toBe(true);
    expect(s).toMatchObject({ mode: 'classic', stage: 1, score: 0, addsLeft: CLASSIC_ADDS, hintsLeft: CLASSIC_HINTS, status: 'playing', moves: 0 });
    expect(CLASSIC_ADDS).toBe(5);
    expect(CLASSIC_HINTS).toBe(3);
  });

  it('is deterministic for a seed and differs between seeds', () => {
    expect(newClassic(7)).toEqual(newClassic(7));
    expect(newClassic(7).cells).not.toEqual(newClassic(8).cells);
  });
});

describe('removing pairs', () => {
  it('clears both cells (they keep their place) and scores POINTS.pair', () => {
    const r = mustRemove(stateOf(board('11234')), 0, 1);
    expect(r.state.cells).toEqual([0, 0, 2, 3, 4]);
    expect(r.gained).toBe(POINTS.pair);
    expect(r.state.score).toBe(10);
    expect(r.state.pairsCleared).toBe(1);
    expect(r.state.moves).toBe(1);
    expect(r.state.undo).toHaveLength(1);
    expect(r.rowsRemoved).toEqual([]);
  });

  it('accepts sum-10 pairs in any tap order', () => {
    const r = mustRemove(stateOf(board('5372')), 2, 1); // 7 then 3
    expect(r.state.cells).toEqual([5, 0, 0, 2]);
  });

  it('rejects digits that neither match nor add up to 10 (3 and 8) without changing the state', () => {
    const s = stateOf(board('3811'));
    const r = removePair(s, 0, 1);
    expect(r).toEqual({ ok: false, state: s, reason: 'digits' });
  });

  it('rejects blocked pairs, cleared cells and the same cell', () => {
    const s = stateOf(board('525'));
    expect(removePair(s, 0, 2)).toMatchObject({ ok: false, reason: 'blocked' });
    const holes = stateOf(board('1.1'));
    expect(removePair(holes, 0, 1)).toMatchObject({ ok: false, reason: 'empty' });
    expect(removePair(holes, 0, 0)).toMatchObject({ ok: false, reason: 'same' });
    expect(removePair(holes, 0, 2).ok).toBe(true);
  });

  it('removes a completely cleared row; rows below move up; adds the row bonus', () => {
    const r = mustRemove(stateOf(board('1.......9', '123456789', '55')), 0, 8);
    expect(r.rowsRemoved).toEqual([0]);
    expect(r.beforeCollapse.slice(0, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.state.cells).toEqual(board('123456789', '55'));
    expect(r.gained).toBe(POINTS.pair + POINTS.row);
    expect(r.state.rowsCleared).toBe(1);
  });

  it('can remove two rows with one pair', () => {
    const r = mustRemove(stateOf(board('........3', '7........', '123456789')), 8, 9);
    expect(r.rowsRemoved).toEqual([0, 1]);
    expect(r.state.cells).toEqual(board('123456789'));
    expect(r.gained).toBe(POINTS.pair + 2 * POINTS.row);
    expect(r.state.rowsCleared).toBe(2);
  });

  it('removes a cleared partial last row too', () => {
    const r = mustRemove(stateOf(board('123456789', '4.6')), 9, 11);
    expect(r.rowsRemoved).toEqual([1]);
    expect(r.state.cells).toEqual(board('123456789'));
  });

  it('ignores moves once the stage has ended', () => {
    const over = stateOf(board('12'), { addsLeft: 0 });
    expect(over.status).toBe('over');
    expect(removePair(over, 0, 1)).toMatchObject({ ok: false, reason: 'inactive' });
  });
});

describe('stage completion and scoring', () => {
  it('clears the stage when no digit is left and adds POINTS.stage × stage', () => {
    const r = mustRemove(stateOf(board('46'), { score: 100 }), 0, 1);
    expect(r.stageCleared).toBe(true);
    expect(r.state.status).toBe('cleared');
    expect(r.state.cells).toEqual([]);
    expect(r.gained).toBe(POINTS.pair + POINTS.row + stageBonus(1));
    expect(r.state.score).toBe(100 + 10 + 50 + 250);
    expect(canUndo(r.state)).toBe(false);
  });

  it('scales the clear bonus with the stage', () => {
    const r = mustRemove(stateOf(board('46'), { stage: 3 }), 0, 1);
    expect(r.gained).toBe(10 + 50 + 750);
    expect(POINTS).toEqual({ pair: 10, row: 50, stage: 250 });
  });

  it('next stage starts a fresh, slightly larger board and keeps the score', () => {
    const cleared = mustRemove(newClassicWithBoard(board('46')), 0, 1).state;
    const s2 = nextStage(cleared);
    expect(s2.stage).toBe(2);
    expect(s2.cells).toHaveLength(classicDigitCount(2));
    expect(classicDigitCount(2)).toBe(30);
    expect(s2.score).toBe(cleared.score);
    expect(s2.pairsCleared).toBe(1);
    expect(s2).toMatchObject({ addsLeft: CLASSIC_ADDS, addsUsed: 0, hintsLeft: CLASSIC_HINTS, hintsUsed: 0, moves: 0, status: 'playing', undo: [] });
    expect(s2.rng).not.toBe(cleared.rng);
    // Grids keep growing by 3 digits per stage up to 54.
    expect(classicDigitCount(1)).toBe(27);
    expect(classicDigitCount(10)).toBe(54);
    expect(classicDigitCount(50)).toBe(54);
  });

  it('nextStage does nothing unless the classic stage was cleared', () => {
    const s = newClassic(3);
    expect(nextStage(s)).toBe(s);
  });
});

function newClassicWithBoard(cells: number[]): GameState {
  return { ...newClassic(11), cells, status: evaluateStatus(cells, CLASSIC_ADDS) };
}

describe('adding numbers', () => {
  it('appends the remaining digits in reading order after the last cell and uses one addition', () => {
    const s = stateOf(board('1.2......', '3..'));
    const r = addNumbers(s);
    if (!r.ok) throw new Error('add failed');
    expect(r.state.cells).toEqual([...board('1.2......', '3..'), 1, 2, 3]);
    expect(r.added).toBe(3);
    expect(r.firstNew).toBe(12);
    expect(r.state.addsLeft).toBe(CLASSIC_ADDS - 1);
    expect(r.state.addsUsed).toBe(1);
    expect(r.state.moves).toBe(1);
    expect(r.state.undo).toHaveLength(1);
  });

  it('cannot add when no additions are left', () => {
    const s = stateOf(board('11'), { addsLeft: 0 });
    expect(canAdd(s)).toBe(false);
    expect(addNumbers(s)).toMatchObject({ ok: false, reason: 'none-left' });
  });

  it('refuses to grow beyond the cell limit', () => {
    const big = Array.from({ length: MAX_CELLS - 10 }, (_, i) => (i % 9) + 1);
    const s = stateOf(big);
    expect(canAdd(s)).toBe(false);
    expect(addNumbers(s)).toMatchObject({ ok: false, reason: 'full' });
  });
});

describe('game over detection', () => {
  it('keeps playing without pairs while additions remain', () => {
    expect(evaluateStatus(board('123'), 1)).toBe('playing');
    expect(evaluateStatus(board('123'), 0)).toBe('over');
    expect(evaluateStatus(board('113'), 0)).toBe('playing');
    expect(evaluateStatus([], 0)).toBe('cleared');
  });

  it('ends the game after the last addition when it creates no pair', () => {
    const r = addNumbers(stateOf(board('123'), { addsLeft: 1 }));
    if (!r.ok) throw new Error('add failed');
    expect(r.state.cells).toEqual([1, 2, 3, 1, 2, 3]);
    expect(r.state.status).toBe('over');
    expect(canUndo(r.state)).toBe(false);
  });

  it('ends the game when a removal leaves no pair and no addition', () => {
    const r = mustRemove(stateOf(board('1123'), { addsLeft: 0 }), 0, 1);
    expect(r.state.status).toBe('over');
  });
});

describe('hints', () => {
  it('reveals a valid pair and uses one hint', () => {
    const s = stateOf(board('12346'));
    const h = requestHint(s);
    if (h.kind !== 'pair') throw new Error('expected a pair');
    expect(h.pair).toEqual([3, 4]);
    expect(canPair(s.cells, h.pair[0], h.pair[1])).toBe(true);
    expect(h.state.hintsLeft).toBe(CLASSIC_HINTS - 1);
    expect(h.state.hintsUsed).toBe(1);
  });

  it('points to "add numbers" without using a hint when there is no pair', () => {
    const s = stateOf(board('123'));
    const h = requestHint(s);
    expect(h.kind).toBe('add');
    expect(h.state.hintsLeft).toBe(CLASSIC_HINTS);
  });

  it('gives nothing when no hint is left', () => {
    expect(requestHint(stateOf(board('11'), { hintsLeft: 0 }))).toMatchObject({ kind: 'none', reason: 'no-hints' });
  });

  it('always finds a valid pair on random boards', () => {
    const rng = new Rng(9);
    for (let n = 0; n < 200; n++) {
      const s = newClassic(rng.int(1, 1e9));
      const h = requestHint(s);
      if (h.kind !== 'pair') throw new Error('classic boards start with a pair');
      expect(canPair(s.cells, h.pair[0], h.pair[1])).toBe(true);
    }
  });
});

describe('undo', () => {
  it('reverts a removal (board, score, counters)', () => {
    const s0 = stateOf(board('1.......9', '123456789', '55'));
    const s1 = mustRemove(s0, 0, 8).state;
    const back = undo(s1);
    expect(back.cells).toEqual(s0.cells);
    expect(back.score).toBe(0);
    expect(back.pairsCleared).toBe(0);
    expect(back.rowsCleared).toBe(0);
    expect(back.moves).toBe(0);
    expect(back.undo).toHaveLength(0);
  });

  it('reverts an addition and refunds it, but not hints', () => {
    const s0 = stateOf(board('123'));
    const hinted = requestHint(stateOf(board('1122'))).state;
    expect(hinted.hintsLeft).toBe(CLASSIC_HINTS - 1);
    const r = addNumbers(s0);
    if (!r.ok) throw new Error('add failed');
    const back = undo(r.state);
    expect(back.cells).toEqual(s0.cells);
    expect(back.addsLeft).toBe(CLASSIC_ADDS);
    expect(back.addsUsed).toBe(0);
    const afterHint = mustRemove(hinted, 0, 1).state;
    expect(undo(afterHint).hintsLeft).toBe(CLASSIC_HINTS - 1);
  });

  it(`keeps at most ${UNDO_LIMIT} steps`, () => {
    let s = stateOf(Array.from({ length: 40 }, () => 5));
    for (let i = 0; i < 14; i++) {
      const pair = findPairs(s.cells)[0];
      if (!pair) throw new Error('expected a pair');
      s = mustRemove(s, pair[0], pair[1]).state;
    }
    expect(s.undo).toHaveLength(UNDO_LIMIT);
    let steps = 0;
    while (canUndo(s)) {
      s = undo(s);
      steps++;
    }
    expect(steps).toBe(UNDO_LIMIT);
    expect(s.pairsCleared).toBe(4);
    expect(undo(s)).toBe(s);
  });
});

describe('challenges', () => {
  it('uses the level configuration for additions and hints', () => {
    for (const level of [1, 13, 25, 40]) {
      const s = newChallenge(level);
      const config = challengeConfig(level);
      expect(s).toMatchObject({ mode: 'challenge', stage: level, addsLeft: config.adds, hintsLeft: config.hints, status: 'playing', score: 0 });
      expect(s.cells).toHaveLength(config.pairs * 2);
    }
  });

  it('awards stars by additions and hints used', () => {
    expect(challengeStars(0, 0)).toBe(3);
    expect(challengeStars(1, 0)).toBe(2);
    expect(challengeStars(1, 1)).toBe(2);
    expect(challengeStars(0, 3)).toBe(1);
    expect(challengeStars(2, 1)).toBe(1);
  });
});

describe('random play-through', () => {
  it('keeps every invariant through long classic runs and is deterministic', () => {
    const play = (seed: number) => {
      const rng = new Rng(seed);
      let s = newClassic(seed);
      const trace: string[] = [];
      for (let step = 0; step < 400 && s.status !== 'over'; step++) {
        if (s.status === 'cleared') {
          s = nextStage(s);
          continue;
        }
        const pairs = findPairs(s.cells);
        const before = s.score;
        if (pairs.length > 0 && !(canAdd(s) && rng.bool(0.04))) {
          const pair = rng.pick(pairs);
          s = mustRemove(s, pair[0], pair[1]).state;
        } else {
          const r = addNumbers(s);
          expect(r.ok).toBe(true);
          s = r.state;
        }
        expect(s.score).toBeGreaterThanOrEqual(before);
        expect(emptyRows(s.cells)).toEqual([]);
        expect(s.cells.length).toBeLessThanOrEqual(MAX_CELLS);
        expect(s.cells.every((v) => v === 0 || isDigit(v))).toBe(true);
        expect(s.status).toBe(evaluateStatus(s.cells, s.addsLeft));
        if (s.status === 'cleared') expect(digitCount(s.cells)).toBe(0);
        trace.push(`${s.stage}:${s.score}:${s.cells.length}`);
      }
      return trace.join('|');
    };
    for (const seed of [1, 2, 3, 99]) expect(play(seed)).toBe(play(seed));
  });
});

describe('help texts', () => {
  it('document the real limits and scoring constants in every language', async () => {
    const { numberMatch: pt } = await import('../../i18n/pt/numberMatch');
    const { numberMatch: en } = await import('../../i18n/en/numberMatch');
    const { numberMatch: es } = await import('../../i18n/es/numberMatch');
    const numbers = [POINTS.pair, POINTS.row, POINTS.stage, UNDO_LIMIT, CLASSIC_ADDS, CLASSIC_HINTS, classicDigitCount(1), classicDigitCount(99)];
    for (const texts of [pt, en, es]) {
      const all = texts.help.sections.flatMap((s) => s.items).join(' ');
      for (const n of numbers) expect(all).toMatch(new RegExp(`\\b${n}\\b`));
    }
  });
});
