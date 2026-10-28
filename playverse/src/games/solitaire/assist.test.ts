import { describe, expect, it } from 'vitest';
import { autoMoveFor, findHint, isStuck, stockHasPlayable } from './assist';
import { STOCK, WASTE, applyMove, foundationRef, isLegalMove, newGame, tableauRef, type Move } from './engine';
import { columns, down, downs, foundation, makePiles, up, ups } from './testing';

describe('tap to move (best destination)', () => {
  it('sends a single card to its foundation first', () => {
    const p = makePiles({ foundations: [ups('AH'), [], [], []], tableau: columns([up('2H')], [up('3S')]) });
    // 2H could also go on 3S, but the foundation wins.
    expect(autoMoveFor(p, tableauRef(0), 0)).toEqual({ from: tableauRef(0), to: foundationRef(0), count: 1 });
  });

  it('sends an Ace to the first empty foundation', () => {
    const p = makePiles({ foundations: [ups('AS'), [], [], []], waste: ups('AD') });
    expect(autoMoveFor(p, WASTE, 0)).toEqual({ from: WASTE, to: foundationRef(1), count: 1 });
  });

  it('moves a run to a column where its first card fits', () => {
    const p = makePiles({ tableau: columns([down('4C'), up('9H'), up('8S')], [up('10C')], [up('10S')]) });
    expect(autoMoveFor(p, tableauRef(0), 1)).toEqual({ from: tableauRef(0), to: tableauRef(1), count: 2 });
  });

  it('puts a King in the first empty column and other cards on a fitting column', () => {
    const p = makePiles({ waste: ups('KH'), tableau: columns([], [up('2C')]) });
    expect(autoMoveFor(p, WASTE, 0)).toEqual({ from: WASTE, to: tableauRef(0), count: 1 });
    const q = makePiles({ waste: ups('QH'), tableau: columns([], [up('KS')]) });
    expect(autoMoveFor(q, WASTE, 0)).toEqual({ from: WASTE, to: tableauRef(1), count: 1 });
  });

  it('moves a King off face-down cards to an empty column, but not a King already at the bottom', () => {
    const p = makePiles({ tableau: columns([down('5D'), up('KC')], [], [up('KH')]) });
    expect(autoMoveFor(p, tableauRef(0), 1)).toEqual({ from: tableauRef(0), to: tableauRef(1), count: 1 });
    expect(autoMoveFor(p, tableauRef(2), 0)).toBeNull();
  });

  it('moves a foundation card back to a column when possible', () => {
    const p = makePiles({ foundations: [foundation('hearts', 6), [], [], []], tableau: columns([up('7C')]) });
    expect(autoMoveFor(p, foundationRef(0), 5)).toEqual({ from: foundationRef(0), to: tableauRef(0), count: 1 });
  });

  it('uses the top waste card even if a lower fanned card is tapped', () => {
    const p = makePiles({ waste: ups('5C', '9D', 'AS') });
    expect(autoMoveFor(p, WASTE, 0)).toEqual({ from: WASTE, to: foundationRef(0), count: 1 });
  });

  it('returns null when nothing fits (the card shakes)', () => {
    const p = makePiles({ tableau: columns([up('5H')], [up('9C')]) });
    expect(autoMoveFor(p, tableauRef(0), 0)).toBeNull();
    expect(autoMoveFor(p, STOCK, 0)).toBeNull();
    expect(autoMoveFor(makePiles({ tableau: columns([down('5H'), up('2C')]) }), tableauRef(0), 0)).toBeNull(); // face-down card
  });

  it('only ever returns legal moves', () => {
    const s = newGame(321, 1);
    s.tableau.forEach((col, i) => {
      const m = autoMoveFor(s, tableauRef(i), col.length - 1);
      if (m) expect(isLegalMove(s, m)).toBe(true);
    });
  });
});

describe('hints', () => {
  const asMove = (h: ReturnType<typeof findHint>): Move | null => (h && h.kind === 'move' ? h.move : null);

  it('prefers a foundation move that turns up a card', () => {
    const p = makePiles({ foundations: [ups('AS'), [], [], []], waste: ups('AH'), tableau: columns([down('9C'), up('2S')]) });
    expect(asMove(findHint(p, 1))).toEqual({ from: tableauRef(0), to: foundationRef(0), count: 1 });
  });

  it('suggests moving a whole run that uncovers a face-down card', () => {
    const p = makePiles({ tableau: columns([down('3D'), up('8H'), up('7S')], [up('9C')]) });
    expect(asMove(findHint(p, 1))).toEqual({ from: tableauRef(0), to: tableauRef(1), count: 2 });
  });

  it('suggests any foundation move, then the waste card to a column', () => {
    expect(asMove(findHint(makePiles({ waste: ups('AD') }), 1))).toEqual({ from: WASTE, to: foundationRef(0), count: 1 });
    expect(asMove(findHint(makePiles({ waste: ups('QD'), tableau: columns([up('KS')]) }), 1))).toEqual({ from: WASTE, to: tableauRef(0), count: 1 });
  });

  it('suggests emptying a column only when a King is waiting for it', () => {
    const others = [[up('9C')], [up('9S')], [up('4H')], [up('4D')]];
    const p = makePiles({ tableau: [[up('QD')], [up('KS')], [down('2C'), up('KH')], ...others] });
    expect(asMove(findHint(p, 1))).toEqual({ from: tableauRef(0), to: tableauRef(1), count: 1 });
    // Without a King waiting, moving the lone Queen around is not useful.
    const q = makePiles({ tableau: [[up('QD')], [up('KS')], [up('7H')], ...others] });
    expect(findHint(q, 1)).toBeNull();
  });

  it('suggests a King uncovering a face-down card to go to an empty column', () => {
    const p = makePiles({ tableau: columns([down('2C'), up('KH')]) });
    expect(asMove(findHint(p, 1))).toEqual({ from: tableauRef(0), to: tableauRef(1), count: 1 });
  });

  it('suggests splitting a run when the card underneath can then go to a foundation', () => {
    const p = makePiles({ foundations: [ups('AS', '2S'), [], [], []], tableau: columns([up('4D'), up('3S'), up('2H')], [up('3C')]) });
    expect(asMove(findHint(p, 1))).toEqual({ from: tableauRef(0), to: tableauRef(1), count: 1 });
  });

  it('suggests drawing when the stock holds a playable card, recycling when it is empty', () => {
    const p = makePiles({ stock: downs('AC'), tableau: columns([up('5H')]) });
    expect(findHint(p, 1)).toEqual({ kind: 'draw' });
    const q = makePiles({ waste: ups('AC', '9H'), tableau: columns([up('5H')]) });
    expect(findHint(q, 1)).toEqual({ kind: 'recycle' });
  });

  it('does not suggest drawing when no card in the stock can ever be played', () => {
    const p = makePiles({ stock: downs('9H', '9D'), tableau: columns([up('5H')]) });
    expect(stockHasPlayable(p, 1)).toBe(false);
    expect(findHint(p, 1)).toBeNull();
  });

  it('respects draw 3 reachability', () => {
    // Draw 3 turns the three cards at once: the Ace ends on top of the waste.
    expect(stockHasPlayable(makePiles({ stock: downs('AC', '9H', '9D'), tableau: columns([up('5H')]) }), 3)).toBe(true);
    // With four cards the first draw shows 9S and the second one the Ace.
    expect(stockHasPlayable(makePiles({ stock: downs('AC', '9S', '9H', '9D'), tableau: columns([up('5H')]) }), 3)).toBe(true);
    // An Ace in the middle of a group of three is never exposed in draw 3, but it is in draw 1.
    const buried = makePiles({ stock: downs('9C', 'AC', '9S', '9H', '9D', '10H'), tableau: columns([up('5H')]) });
    expect(stockHasPlayable(buried, 3)).toBe(false);
    expect(stockHasPlayable(buried, 1)).toBe(true);
  });

  it('hints are always legal on real deals', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = newGame(seed, 3);
      for (let i = 0; i < 40; i++) {
        const h = findHint(s, s.draw);
        if (!h) break;
        if (h.kind === 'move') {
          expect(isLegalMove(s, h.move)).toBe(true);
          s = applyMove(s, h.move)?.state ?? s;
        } else break;
      }
    }
  });
});

describe('stuck detection (no more useful moves)', () => {
  // Column tops are all 5s and 9s: none can go on another, no foundation move (no Aces showing),
  // and the stock holds nothing that fits anywhere.
  const blockedTableau = columns(
    [down('2D'), up('5S')],
    [down('3D'), up('5C')],
    [down('4H'), up('5H')],
    [down('6S'), up('5D')],
    [down('7S'), up('9C')],
    [down('8C'), up('9S')],
    [down('10D'), up('9H')],
  );

  it('detects a position where nothing can be played, even after cycling the stock', () => {
    const p = makePiles({ tableau: blockedTableau, stock: downs('QS', 'JD', '3C'), waste: ups('KD') });
    expect(isStuck(p, 1)).toBe(true);
    expect(isStuck(p, 3)).toBe(true);
  });

  it('is not stuck when a stock card can be played after drawing', () => {
    const p = makePiles({ tableau: blockedTableau, stock: downs('QS', '4H', '3C') });
    expect(isStuck(p, 1)).toBe(false);
  });

  it('is not stuck when bringing a foundation card back unlocks a play', () => {
    // 5S (stock) only fits on 6H, which is on its foundation; moving 6H onto 7C makes room.
    const p = makePiles({
      foundations: [foundation('hearts', 6), [], [], []],
      tableau: columns([down('2D'), up('7C')], [down('3D'), up('9S')]),
      stock: downs('5S'),
    });
    expect(findHint(p, 1)).toBeNull();
    expect(isStuck(p, 1)).toBe(false);
  });

  it('never reports a finished game or a fresh deal with a playable Ace as stuck', () => {
    const done = makePiles({ foundations: [foundation('spades', 13), foundation('hearts', 13), foundation('diamonds', 13), foundation('clubs', 13)] });
    expect(isStuck(done, 1)).toBe(false);
    let freshStuck = 0;
    for (let seed = 1; seed <= 200; seed++) if (isStuck(newGame(seed, 1), 1)) freshStuck++;
    // Draw-1 deals almost always have a playable card somewhere in the stock cycle.
    expect(freshStuck).toBeLessThanOrEqual(2);
  });
});
