import { describe, expect, it } from 'vitest';
import { foundationRef, newGame, tableauRef } from './engine';
import { columnX, computeMetrics, fanOffsets, layoutBoard, pickDropTarget } from './layout';
import { columns, downs, makePiles, run } from './testing';

describe('solitaire layout', () => {
  it('fits seven columns on a 360 px wide phone', () => {
    const m = computeMetrics(348, 520);
    expect(columnX(m, 6) + m.cardW).toBeLessThanOrEqual(348);
    expect(m.cardW).toBeGreaterThanOrEqual(40);
    expect(m.cardH).toBe(Math.round(m.cardW * 1.4));
  });

  it('is limited by height on wide, short screens and centred horizontally', () => {
    const m = computeMetrics(1200, 300);
    expect(m.cardH * 2 + m.rowGap).toBeLessThan(300);
    expect(m.originX).toBeGreaterThan(0);
    expect(m.originX * 2 + m.cardW * 7 + m.gap * 6).toBeLessThanOrEqual(1201);
  });

  it('compresses long columns so the last card is never cut off', () => {
    for (const [w, h] of [
      [348, 480],
      [720, 300],
      [1200, 560],
      [348, 200],
    ] as const) {
      const m = computeMetrics(w, h);
      const longest = makePiles({ tableau: columns([...downs('2C', '3C', '4C', '5C', '6C', '7C'), ...run('spades', 'hearts', 13, 1)]) });
      const layout = layoutBoard(longest, 1, m);
      expect(layout.columnBottoms[0]).toBeLessThanOrEqual(h + 0.5);
      const off = fanOffsets(m, 6, 13);
      expect(off.down).toBeGreaterThanOrEqual(0);
      expect(off.up).toBeGreaterThan(0);
    }
  });

  it('keeps generous offsets for short columns', () => {
    const m = computeMetrics(348, 520);
    const off = fanOffsets(m, 3, 2);
    expect(off.up).toBeCloseTo(m.cardH * 0.3);
  });

  it('places every card exactly once', () => {
    const s = newGame(11, 3);
    const layout = layoutBoard(s, 3, computeMetrics(800, 500));
    expect(layout.cards).toHaveLength(52);
    expect(new Set(layout.cards.map((c) => c.id)).size).toBe(52);
  });

  it('fans the last three waste cards in draw 3', () => {
    const m = computeMetrics(800, 500);
    let s = newGame(11, 3);
    s = { ...s, waste: s.stock.slice(0, 5).map((c) => ({ ...c, up: true })), stock: s.stock.slice(5) };
    const waste = layoutBoard(s, 3, m).cards.filter((c) => c.pile.kind === 'waste');
    expect(waste.map((c) => c.x - columnX(m, 1))).toEqual([0, 0, 0, m.fanX, m.fanX * 2]);
    const single = layoutBoard(s, 1, m).cards.filter((c) => c.pile.kind === 'waste');
    expect(single.every((c) => c.x === columnX(m, 1))).toBe(true);
  });

  it('picks the drop target the dragged card overlaps most', () => {
    const m = computeMetrics(700, 500);
    const over = { x: columnX(m, 2) + m.cardW * 0.3, y: m.tableauY + 20, w: m.cardW, h: m.cardH };
    expect(pickDropTarget(m, over, [tableauRef(2), tableauRef(3)])).toEqual(tableauRef(2));
    expect(pickDropTarget(m, { ...over, x: columnX(m, 2) + m.cardW * 0.8 }, [tableauRef(3)])).toEqual(tableauRef(3));
    expect(pickDropTarget(m, { x: columnX(m, 4), y: 0, w: m.cardW, h: m.cardH }, [foundationRef(1)])).toEqual(foundationRef(1));
    expect(pickDropTarget(m, { x: -500, y: -500, w: 10, h: 10 }, [tableauRef(0)])).toBeNull();
  });
});
