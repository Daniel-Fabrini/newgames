import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import {
  DECK_SIZE,
  SCORE,
  STOCK,
  WASTE,
  applyAction,
  applyMove,
  autoCompletePlan,
  canAutoComplete,
  canStackOnFoundation,
  canStackOnTableau,
  canUndo,
  checkPiles,
  dealPiles,
  decodePiles,
  draw,
  encodePiles,
  foundationFor,
  foundationRef,
  isComplete,
  isLegalMove,
  isRed,
  isValidRun,
  legalMoves,
  legalTargets,
  newGame,
  rankOf,
  suitOf,
  tableauRef,
  timeBonus,
  undo,
  type GameState,
  type Move,
  type Piles,
} from './engine';
import { columns, down, downs, foundation, id, makePiles, makeState, run, up, ups } from './testing';

const piles = (s: Piles): Piles => ({ stock: s.stock, waste: s.waste, foundations: s.foundations, tableau: s.tableau });
const ids = (cards: readonly { id: number }[]) => cards.map((c) => c.id);

/** Every card face up in four valid K→A runs: the game can be finished automatically. */
function allFaceUp(): Piles {
  return makePiles({
    tableau: columns(run('spades', 'hearts', 13, 1), run('hearts', 'spades', 13, 1), run('diamonds', 'clubs', 13, 1), run('clubs', 'diamonds', 13, 1)),
  });
}

/** Foundations at 5, the four sixes in the stock, K→7 runs in the tableau. */
function sixesInStock(): Piles {
  return makePiles({
    stock: downs('6S', '6H', '6D', '6C'),
    foundations: [foundation('spades', 5), foundation('hearts', 5), foundation('diamonds', 5), foundation('clubs', 5)],
    tableau: columns(run('spades', 'hearts', 13, 7), run('hearts', 'spades', 13, 7), run('diamonds', 'clubs', 13, 7), run('clubs', 'diamonds', 13, 7)),
  });
}

describe('cards', () => {
  it('encodes 52 distinct cards with suit, rank and colour', () => {
    expect(suitOf(id('AS'))).toBe('spades');
    expect(rankOf(id('AS'))).toBe(1);
    expect(rankOf(id('KD'))).toBe(13);
    expect(suitOf(id('10C'))).toBe('clubs');
    expect(isRed(id('5H'))).toBe(true);
    expect(isRed(id('5D'))).toBe(true);
    expect(isRed(id('5S'))).toBe(false);
    expect(isRed(id('5C'))).toBe(false);
    const all = new Set(['S', 'H', 'D', 'C'].flatMap((s) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((r) => id(r + s))));
    expect(all.size).toBe(52);
  });
});

describe('deal', () => {
  it('deals 7 columns of 1..7 cards with only the top card face up and 24 cards in the stock', () => {
    const s = newGame(12345, 1);
    s.tableau.forEach((col, i) => {
      expect(col).toHaveLength(i + 1);
      col.forEach((c, j) => expect(c.up).toBe(j === i));
    });
    expect(s.stock).toHaveLength(24);
    expect(s.stock.every((c) => !c.up)).toBe(true);
    expect(s.waste).toEqual([]);
    expect(s.foundations).toEqual([[], [], [], []]);
    expect(s.score).toBe(0);
    expect(s.moves).toBe(0);
    expect(s.won).toBe(false);
  });

  it('uses each of the 52 cards exactly once', () => {
    for (const seed of [1, 2, 3, 99, 2 ** 31, 4294967295]) {
      const p = dealPiles(seed);
      const all = [p.stock, p.waste, ...p.foundations, ...p.tableau].flat().map((c) => c.id);
      expect(all).toHaveLength(DECK_SIZE);
      expect(new Set(all).size).toBe(DECK_SIZE);
      expect(checkPiles(p)).toBeNull();
    }
  });

  it('is reproducible for a seed and varies between seeds', () => {
    expect(encodePiles(dealPiles(777))).toBe(encodePiles(dealPiles(777)));
    expect(encodePiles(dealPiles(777))).not.toBe(encodePiles(dealPiles(778)));
  });

  it('remembers the seed and the draw mode', () => {
    const s = newGame(42, 3);
    expect(s.seed).toBe(42);
    expect(s.draw).toBe(3);
  });
});

describe('placement rules', () => {
  it('tableau: one lower and opposite colour', () => {
    expect(canStackOnTableau(id('9H'), up('10S'))).toBe(true);
    expect(canStackOnTableau(id('9D'), up('10C'))).toBe(true);
    expect(canStackOnTableau(id('9S'), up('10H'))).toBe(true);
    expect(canStackOnTableau(id('9S'), up('10C'))).toBe(false); // same colour
    expect(canStackOnTableau(id('9H'), up('10D'))).toBe(false); // same colour
    expect(canStackOnTableau(id('8H'), up('10S'))).toBe(false); // not one lower
    expect(canStackOnTableau(id('JH'), up('10S'))).toBe(false); // higher
    expect(canStackOnTableau(id('9H'), down('10S'))).toBe(false); // face down
  });

  it('empty tableau columns accept only a King', () => {
    expect(canStackOnTableau(id('KH'), undefined)).toBe(true);
    expect(canStackOnTableau(id('KS'), undefined)).toBe(true);
    expect(canStackOnTableau(id('QH'), undefined)).toBe(false);
    expect(canStackOnTableau(id('AS'), undefined)).toBe(false);
  });

  it('foundations build up by suit from the Ace', () => {
    expect(canStackOnFoundation(id('AS'), [])).toBe(true);
    expect(canStackOnFoundation(id('2S'), [])).toBe(false);
    expect(canStackOnFoundation(id('2S'), ups('AS'))).toBe(true);
    expect(canStackOnFoundation(id('2H'), ups('AS'))).toBe(false); // other suit
    expect(canStackOnFoundation(id('3S'), ups('AS'))).toBe(false); // skips a rank
    expect(canStackOnFoundation(id('KD'), foundation('diamonds', 12))).toBe(true);
  });

  it('valid runs descend by one and alternate colours, all face up', () => {
    expect(isValidRun(ups('KS', 'QH', 'JC', '10D'))).toBe(true);
    expect(isValidRun(ups('7H'))).toBe(true);
    expect(isValidRun(ups('KS', 'QS'))).toBe(false); // same colour
    expect(isValidRun(ups('KS', 'JH'))).toBe(false); // gap
    expect(isValidRun(ups('QH', 'KS'))).toBe(false); // ascending
    expect(isValidRun([down('KS'), up('QH')])).toBe(false); // face down
    expect(isValidRun([])).toBe(false);
  });

  it('finds the foundation for a card (any empty one for an Ace)', () => {
    const p = makePiles({ foundations: [ups('AH'), [], ups('AS', '2S'), []] });
    expect(foundationFor(p, id('2H'))).toBe(0);
    expect(foundationFor(p, id('3S'))).toBe(2);
    expect(foundationFor(p, id('AD'))).toBe(1);
    expect(foundationFor(p, id('3H'))).toBeNull();
  });
});

describe('legal moves', () => {
  const position = () =>
    makeState({
      stock: downs('2C'),
      waste: ups('4D', 'QD', 'AH'),
      foundations: [ups('AS'), ups('AC'), [], []],
      tableau: columns([down('3H'), up('KC'), up('QH'), up('JS')], [down('9C'), up('10H')], [], [up('2S')], [down('5C'), up('KH')], [up('KS')], [down('8D'), up('QS')]),
    });

  it('waste → foundation and waste → tableau use only the top waste card', () => {
    const s = position();
    expect(isLegalMove(s, { from: WASTE, to: foundationRef(2), count: 1 })).toBe(true); // AH on empty foundation
    expect(isLegalMove(s, { from: WASTE, to: foundationRef(0), count: 1 })).toBe(false); // AH on AS
    expect(isLegalMove(s, { from: WASTE, to: tableauRef(2), count: 1 })).toBe(false); // AH on empty column
    expect(isLegalMove(s, { from: WASTE, to: tableauRef(2), count: 2 })).toBe(false); // two waste cards
    const s2 = { ...s, waste: ups('4D', 'JD') };
    expect(isLegalMove(s2, { from: WASTE, to: tableauRef(6), count: 1 })).toBe(true); // JD on QS
    expect(isLegalMove(s2, { from: WASTE, to: tableauRef(1), count: 1 })).toBe(false); // JD on 10H
  });

  it('tableau → foundation only moves the top card', () => {
    const s = position();
    expect(isLegalMove(s, { from: tableauRef(3), to: foundationRef(0), count: 1 })).toBe(true); // 2S on AS
    expect(isLegalMove(s, { from: tableauRef(3), to: foundationRef(1), count: 1 })).toBe(false); // 2S on AC
    const s2 = { ...s, tableau: columns([up('3S'), up('2H')]), foundations: [ups('AS'), ups('AH'), [], []] };
    expect(isLegalMove(s2, { from: tableauRef(0), to: foundationRef(1), count: 1 })).toBe(true);
    expect(isLegalMove(s2, { from: tableauRef(0), to: foundationRef(1), count: 2 })).toBe(false);
  });

  it('tableau → tableau moves any valid face-up run whose first card fits', () => {
    const s = position();
    // QH-JS run onto KS (column 5).
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(5), count: 2 })).toBe(true);
    // Whole KC-QH-JS run to the empty column.
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(2), count: 3 })).toBe(true);
    // Only JS cannot go on KS.
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(5), count: 1 })).toBe(false);
    // Including the face-down card is never allowed.
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(2), count: 4 })).toBe(false);
    // More cards than the column holds.
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(2), count: 9 })).toBe(false);
    // Same column.
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(0), count: 1 })).toBe(false);
  });

  it('empty columns accept only a King or a run starting with a King', () => {
    const s = position();
    expect(isLegalMove(s, { from: tableauRef(4), to: tableauRef(2), count: 1 })).toBe(true); // KH
    expect(isLegalMove(s, { from: tableauRef(1), to: tableauRef(2), count: 1 })).toBe(false); // 10H
    expect(isLegalMove(s, { from: tableauRef(6), to: tableauRef(2), count: 1 })).toBe(false); // QS
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(2), count: 2 })).toBe(false); // QH-JS
  });

  it('rejects runs that do not alternate or descend', () => {
    const s = makeState({ tableau: columns([up('KH'), up('QH')], [up('KS')], []) });
    expect(isLegalMove(s, { from: tableauRef(0), to: tableauRef(2), count: 2 })).toBe(false);
  });

  it('foundation → tableau moves the top foundation card back', () => {
    const s = makeState({ foundations: [foundation('hearts', 5), ups('AS'), [], []], tableau: columns([up('6S')], [up('6H')]) });
    expect(isLegalMove(s, { from: foundationRef(0), to: tableauRef(0), count: 1 })).toBe(true);
    expect(isLegalMove(s, { from: foundationRef(0), to: tableauRef(1), count: 1 })).toBe(false);
    expect(isLegalMove(s, { from: foundationRef(0), to: tableauRef(0), count: 2 })).toBe(false);
    expect(isLegalMove(s, { from: foundationRef(1), to: foundationRef(2), count: 1 })).toBe(false); // foundation → foundation
    expect(isLegalMove(s, { from: foundationRef(2), to: tableauRef(0), count: 1 })).toBe(false); // empty foundation
  });

  it('never moves from the stock or onto the stock/waste, and rejects bad references', () => {
    const s = position();
    expect(isLegalMove(s, { from: STOCK, to: tableauRef(2), count: 1 })).toBe(false);
    expect(isLegalMove(s, { from: tableauRef(3), to: WASTE, count: 1 })).toBe(false);
    expect(isLegalMove(s, { from: tableauRef(3), to: STOCK, count: 1 })).toBe(false);
    expect(isLegalMove(s, { from: tableauRef(3), to: foundationRef(0), count: 0 })).toBe(false);
    expect(isLegalMove(s, { from: tableauRef(9), to: foundationRef(0), count: 1 })).toBe(false);
    expect(isLegalMove(s, { from: tableauRef(3), to: foundationRef(4), count: 1 })).toBe(false);
  });

  it('lists only legal moves and finds the expected ones', () => {
    const s = position();
    const moves = legalMoves(s);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(isLegalMove(s, m)).toBe(true);
    const has = (m: Move) => moves.some((x) => JSON.stringify(x) === JSON.stringify(m));
    expect(has({ from: WASTE, to: foundationRef(2), count: 1 })).toBe(true);
    expect(has({ from: tableauRef(0), to: tableauRef(5), count: 2 })).toBe(true);
    expect(legalTargets(s, tableauRef(4), 1)).toEqual([tableauRef(2)]);
  });

  it('applyMove refuses illegal moves', () => {
    const s = position();
    expect(applyMove(s, { from: tableauRef(1), to: tableauRef(2), count: 1 })).toBeNull();
  });
});

describe('auto-flip and scoring', () => {
  it('turns up the exposed face-down card and scores +5 for it', () => {
    const s = makeState({ foundations: [ups('AS'), [], [], []], tableau: columns([down('7H'), up('2S')]) });
    const r = applyMove(s, { from: tableauRef(0), to: foundationRef(0), count: 1 });
    expect(r).not.toBeNull();
    expect(r?.flipped?.id).toBe(id('7H'));
    expect(r?.state.tableau[0]).toEqual(ups('7H'));
    expect(r?.points).toBe(SCORE.toFoundation + SCORE.flip);
    expect(r?.state.score).toBe(15);
  });

  it('does not flip when a face-up card remains', () => {
    const s = makeState({ tableau: columns([down('4C'), up('KH'), up('QS')], [up('KD')]) });
    const r = applyMove(s, { from: tableauRef(0), to: tableauRef(1), count: 1 });
    expect(r?.flipped).toBeNull();
    expect(r?.state.tableau[0]).toEqual([down('4C'), up('KH')]);
    expect(r?.state.tableau[1]).toEqual(ups('KD', 'QS'));
    expect(r?.points).toBe(0);
  });

  it('flips after moving a whole run off face-down cards', () => {
    const s = makeState({ tableau: columns([down('4C'), down('9D'), up('KH'), up('QS')], []) });
    const r = applyMove(s, { from: tableauRef(0), to: tableauRef(1), count: 2 });
    expect(r?.state.tableau[0]).toEqual([down('4C'), up('9D')]);
    expect(r?.state.tableau[1]).toEqual(ups('KH', 'QS'));
    expect(r?.state.score).toBe(SCORE.flip);
  });

  it('scores waste → tableau +5 and waste → foundation +10', () => {
    const s = makeState({ waste: ups('AD', 'QH'), tableau: columns([up('KS')]) });
    const a = applyMove(s, { from: WASTE, to: tableauRef(0), count: 1 });
    expect(a?.state.score).toBe(5);
    const b = a && applyMove(a.state, { from: WASTE, to: foundationRef(0), count: 1 });
    expect(b?.state.score).toBe(15);
    expect(b?.state.waste).toEqual([]);
    expect(b?.state.foundations[0]).toEqual(ups('AD'));
  });

  it('scores foundation → tableau −15 and never goes below 0', () => {
    const s = makeState({ score: 20, foundations: [foundation('hearts', 5), [], [], []], tableau: columns([up('6S')], [up('5C')]) });
    const a = applyMove(s, { from: foundationRef(0), to: tableauRef(0), count: 1 });
    expect(a?.state.score).toBe(5);
    expect(a?.points).toBe(SCORE.foundationToTableau);
    const b = a && applyMove(a.state, { from: foundationRef(0), to: tableauRef(1), count: 1 });
    expect(b?.state.score).toBe(0);
  });

  it('tableau → tableau without a flip scores nothing', () => {
    const s = makeState({ score: 7, tableau: columns([up('QH')], [up('KS')]) });
    expect(applyMove(s, { from: tableauRef(0), to: tableauRef(1), count: 1 })?.state.score).toBe(7);
  });

  it('counts every action as a move', () => {
    let s = newGame(5, 1);
    s = draw(s)?.state ?? s;
    expect(s.moves).toBe(1);
    s = undo(s);
    expect(s.moves).toBe(2);
    expect(s.undos).toBe(1);
  });

  it('time bonus is 700 000 / seconds, counting at least 30 seconds', () => {
    expect(timeBonus(100_000)).toBe(7000);
    expect(timeBonus(700_000)).toBe(1000);
    expect(timeBonus(10_000)).toBe(Math.round(700_000 / 30));
    expect(timeBonus(0)).toBe(Math.round(700_000 / 30));
  });
});

describe('stock and waste', () => {
  it('draw 1 turns the top stock card onto the waste', () => {
    const s = newGame(9, 1);
    const top = s.stock[s.stock.length - 1];
    const r = draw(s);
    expect(r?.kind).toBe('draw');
    expect(r?.state.stock).toHaveLength(23);
    expect(r?.state.waste).toEqual([{ id: top?.id, up: true }]);
    expect(r?.drawn.map((c) => c.id)).toEqual([top?.id]);
  });

  it('draw 3 turns three cards; the third from the top becomes the playable card', () => {
    const s = newGame(9, 3);
    const stockIds = ids(s.stock);
    const r = draw(s);
    expect(r?.state.stock).toHaveLength(21);
    expect(ids(r?.state.waste ?? [])).toEqual([stockIds[23], stockIds[22], stockIds[21]]);
    expect(r?.state.waste.every((c) => c.up)).toBe(true);
  });

  it('draw 3 takes the remaining cards when fewer than three are left', () => {
    const s = makeState({ draw: 3, stock: downs('5H', '9C'), waste: ups('2D') });
    const r = draw(s);
    expect(r?.state.stock).toEqual([]);
    expect(r?.state.waste).toEqual(ups('2D', '9C', '5H'));
  });

  it('recycles the waste back into the stock in the original order (draw 1: −100)', () => {
    let s: GameState = { ...newGame(31, 1), score: 150 };
    const original = ids(s.stock);
    for (let i = 0; i < 24; i++) s = draw(s)?.state ?? s;
    expect(s.stock).toEqual([]);
    expect(s.waste).toHaveLength(24);
    const r = draw(s);
    expect(r?.kind).toBe('recycle');
    expect(r?.points).toBe(SCORE.recycleDraw1);
    expect(r?.state.score).toBe(50);
    expect(r?.state.recycles).toBe(1);
    expect(r?.state.waste).toEqual([]);
    expect(ids(r?.state.stock ?? [])).toEqual(original);
    expect(r?.state.stock.every((c) => !c.up)).toBe(true);
  });

  it('draw 3 recycling costs −20 and passes repeat identically (unlimited)', () => {
    let s: GameState = { ...newGame(31, 3), score: 30 };
    const passTops: number[][] = [];
    for (let pass = 0; pass < 3; pass++) {
      const tops: number[] = [];
      while (s.stock.length > 0) {
        s = draw(s)?.state ?? s;
        tops.push(s.waste[s.waste.length - 1]?.id ?? -1);
      }
      passTops.push(tops);
      const r = draw(s);
      expect(r?.kind).toBe('recycle');
      s = r?.state ?? s;
    }
    expect(passTops[0]).toHaveLength(8);
    expect(passTops[1]).toEqual(passTops[0]);
    expect(passTops[2]).toEqual(passTops[0]);
    expect(s.recycles).toBe(3);
    expect(s.score).toBe(0); // 30 − 20 → 10 − 20 → 0
  });

  it('cannot draw when both stock and waste are empty', () => {
    expect(draw(makeState())).toBeNull();
  });
});

describe('undo', () => {
  it('restores piles and score after a move with a flip', () => {
    const s = makeState({ foundations: [ups('AS'), [], [], []], tableau: columns([down('7H'), up('2S')]) });
    const r = applyMove(s, { from: tableauRef(0), to: foundationRef(0), count: 1 });
    expect(r).not.toBeNull();
    const back = undo(r?.state as GameState);
    expect(piles(back)).toEqual(piles(s));
    expect(back.score).toBe(0);
    expect(back.history).toEqual([]);
  });

  it('restores the score lost by a recycle and the recycle counter', () => {
    const s = makeState({ score: 120, draw: 1, waste: ups('2H', '9S') });
    const r = draw(s);
    expect(r?.state.score).toBe(20);
    const back = undo(r?.state as GameState);
    expect(back.score).toBe(120);
    expect(back.recycles).toBe(0);
    expect(back.waste).toEqual(ups('2H', '9S'));
    expect(back.stock).toEqual([]);
  });

  it('restores a score that was clamped at 0', () => {
    const s = makeState({ score: 10, foundations: [foundation('hearts', 2), [], [], []], tableau: columns([up('3S')]) });
    const r = applyMove(s, { from: foundationRef(0), to: tableauRef(0), count: 1 });
    expect(r?.state.score).toBe(0);
    expect(undo(r?.state as GameState).score).toBe(10);
  });

  it('is unlimited: random play keeps every invariant and can be undone back to the deal', () => {
    const rng = new Rng(2024);
    for (const mode of [1, 3] as const) {
      const start = newGame(rng.int(0, 2 ** 31), mode);
      let s = start;
      for (let i = 0; i < 300; i++) {
        const moves = legalMoves(s);
        const action = moves.length > 0 && rng.bool(0.6) ? { type: 'move' as const, move: rng.pick(moves) } : { type: 'draw' as const };
        const r = applyAction(s, action);
        if (!r) continue;
        expect(checkPiles(r.state)).toBeNull();
        s = r.state;
        if (s.won) break;
      }
      expect(s.history.length).toBeGreaterThan(50);
      while (canUndo(s)) s = undo(s);
      expect(encodePiles(s)).toBe(encodePiles(start));
      expect(s.score).toBe(0);
      expect(s.recycles).toBe(0);
    }
  });

  it('does nothing without history', () => {
    const s = newGame(3, 1);
    expect(undo(s)).toBe(s);
    expect(canUndo(s)).toBe(false);
  });
});

describe('win', () => {
  const almost = () =>
    makeState({
      score: 100,
      foundations: [foundation('spades', 12), foundation('hearts', 13), foundation('diamonds', 13), foundation('clubs', 13)],
      tableau: columns([up('KS')]),
    });

  it('is detected when the last card reaches the foundations', () => {
    const s = almost();
    expect(isComplete(s)).toBe(false);
    const r = applyMove(s, { from: tableauRef(0), to: foundationRef(0), count: 1 });
    expect(r?.won).toBe(true);
    expect(r?.state.won).toBe(true);
    expect(r?.state.score).toBe(110);
    expect(isComplete(r?.state as GameState)).toBe(true);
    expect(checkPiles(r?.state as GameState)).toBeNull();
  });

  it('ends the game: no more moves, draws or undo', () => {
    const r = applyMove(almost(), { from: tableauRef(0), to: foundationRef(0), count: 1 });
    const won = r?.state as GameState;
    expect(applyMove(won, { from: foundationRef(0), to: tableauRef(0), count: 1 })).toBeNull();
    expect(draw({ ...won, stock: [] })).toBeNull();
    expect(canUndo(won)).toBe(false);
    expect(undo(won)).toBe(won);
  });
});

describe('auto-complete', () => {
  it('finishes a position where every card is face up', () => {
    const s = makeState({ ...allFaceUp() });
    expect(checkPiles(s)).toBeNull();
    const plan = autoCompletePlan(s);
    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(52);
    let cur = s;
    for (const action of plan ?? []) {
      const r = applyAction(cur, action);
      expect(r).not.toBeNull();
      cur = r?.state as GameState;
    }
    expect(cur.won).toBe(true);
    expect(cur.score).toBe(52 * SCORE.toFoundation);
  });

  it('draws from the stock when needed (draw 1 and draw 3)', () => {
    for (const mode of [1, 3] as const) {
      const s = makeState({ ...sixesInStock(), draw: mode });
      expect(checkPiles(s)).toBeNull();
      const plan = autoCompletePlan(s);
      expect(plan).not.toBeNull();
      expect(plan?.some((a) => a.type === 'draw')).toBe(true);
      let cur = s;
      for (const action of plan ?? []) cur = applyAction(cur, action)?.state ?? cur;
      expect(cur.won).toBe(true);
      expect(cur.recycles).toBe(0);
    }
  });

  it('is not offered while face-down cards remain', () => {
    const s = makeState({ ...allFaceUp() });
    const tableau = s.tableau.map((c) => c.slice());
    tableau[0] = tableau[0]?.map((c, i) => (i === 0 ? { ...c, up: false } : c)) ?? [];
    expect(canAutoComplete({ ...s, tableau })).toBe(false);
    expect(canAutoComplete(newGame(1, 1))).toBe(false);
  });

  it('is not offered when finishing would need a recycle', () => {
    const s = makeState({ waste: ups('6S', '7S'), foundations: [foundation('spades', 5), [], [], []] });
    expect(autoCompletePlan(s)).toBeNull();
  });

  it('is not offered on a finished game', () => {
    const s = makeState({ foundations: [foundation('spades', 13), foundation('hearts', 13), foundation('diamonds', 13), foundation('clubs', 13)], won: true });
    expect(canAutoComplete(s)).toBe(false);
  });
});

describe('encoding and integrity', () => {
  it('round-trips piles through the compact encoding', () => {
    let s = newGame(88, 3);
    s = draw(s)?.state ?? s;
    const text = encodePiles(s);
    expect(text.length).toBe(52 + 12);
    expect(decodePiles(text)).toEqual(piles(s));
  });

  it('rejects malformed encodings', () => {
    expect(decodePiles('')).toBeNull();
    expect(decodePiles('abc')).toBeNull();
    expect(decodePiles(',,,,,,,,,,,,!')).toBeNull(); // unknown card code
    const text = encodePiles(dealPiles(4));
    const missing = decodePiles(text.slice(1));
    expect(missing && checkPiles(missing)).toMatch(/52/);
    const duplicate = decodePiles(text.replace(text.charAt(0), text.charAt(text.length - 1)));
    expect(duplicate && checkPiles(duplicate)).toMatch(/duplicate/);
  });

  it('detects impossible positions', () => {
    const ok = dealPiles(10);
    expect(checkPiles(ok)).toBeNull();
    expect(checkPiles({ ...ok, stock: ok.stock.slice(1) })).toMatch(/52/);
    expect(checkPiles({ ...ok, stock: [...ok.stock.slice(1), ok.stock[2] as never] })).toMatch(/duplicate/);
    expect(checkPiles({ ...ok, stock: ok.stock.map((c, i) => (i === 0 ? { ...c, up: true } : c)) })).toMatch(/stock/);
    expect(checkPiles({ ...ok, tableau: ok.tableau.map((col) => col.map((c) => ({ ...c, up: false }))) })).toMatch(/top card/);
    expect(checkPiles({ ...ok, foundations: ok.foundations.slice(1) })).toMatch(/foundations/);
    const s = makePiles({ ...allFaceUp() });
    expect(checkPiles({ ...s, tableau: [[...(s.tableau[0] ?? []).slice(1), (s.tableau[0] ?? [])[0] as never], ...s.tableau.slice(1)] })).toMatch(/run/);
    const badFoundation = makePiles({ ...allFaceUp() });
    const t0 = badFoundation.tableau[0] ?? [];
    expect(checkPiles({ ...badFoundation, foundations: [[t0[0] as never], [], [], []], tableau: [t0.slice(1), ...badFoundation.tableau.slice(1)] })).toMatch(/foundation/);
  });
});
