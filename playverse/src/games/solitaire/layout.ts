import { FOUNDATIONS, TABLEAU_COLUMNS, faceDownCount, foundationRef, tableauRef, type DrawMode, type PileRef, type Piles, STOCK, WASTE } from './engine';

/**
 * Board geometry (pure): card size from the available space, positions of every card and
 * hit areas for drag & drop. Columns fan out and compress vertically so that nothing is ever
 * cut off, whatever the length of a column.
 */
export const CARD_RATIO = 1.4;
export const MAX_CARD_WIDTH = 112;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Metrics {
  width: number;
  height: number;
  cardW: number;
  cardH: number;
  gap: number;
  rowGap: number;
  /** Left edge of the first column (the board is centred horizontally). */
  originX: number;
  tableauY: number;
  /** Horizontal offset between the fanned waste cards in draw 3. */
  fanX: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function computeMetrics(width: number, height: number): Metrics {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const gap = Math.round(clamp(w * 0.012, 3, 14));
  const rowGap = Math.max(8, Math.round(gap * 1.6));
  const byWidth = (w - gap * (TABLEAU_COLUMNS - 1)) / TABLEAU_COLUMNS;
  // Keep room for the top row plus a reasonably fanned column.
  const byHeight = (h - rowGap) / 3.1 / CARD_RATIO;
  const cardW = Math.max(18, Math.floor(Math.min(byWidth, byHeight, MAX_CARD_WIDTH)));
  const cardH = Math.round(cardW * CARD_RATIO);
  const contentW = cardW * TABLEAU_COLUMNS + gap * (TABLEAU_COLUMNS - 1);
  return {
    width: w,
    height: h,
    cardW,
    cardH,
    gap,
    rowGap,
    originX: Math.max(0, Math.floor((w - contentW) / 2)),
    tableauY: cardH + rowGap,
    fanX: Math.round(cardW * 0.4),
  };
}

export const columnX = (m: Metrics, col: number): number => m.originX + col * (m.cardW + m.gap);

/** Base slot of a pile (where its first card sits). */
export function slotRect(m: Metrics, ref: PileRef): Rect {
  switch (ref.kind) {
    case 'stock':
      return { x: columnX(m, 0), y: 0, w: m.cardW, h: m.cardH };
    case 'waste':
      return { x: columnX(m, 1), y: 0, w: m.cardW, h: m.cardH };
    case 'foundation':
      return { x: columnX(m, 3 + ref.index), y: 0, w: m.cardW, h: m.cardH };
    case 'tableau':
      return { x: columnX(m, ref.index), y: m.tableauY, w: m.cardW, h: m.cardH };
  }
}

/** Vertical offsets between face-down and face-up cards of a column, compressed to fit. */
export function fanOffsets(m: Metrics, down: number, up: number): { down: number; up: number } {
  const avail = Math.max(0, m.height - m.tableauY - m.cardH);
  const upGaps = Math.max(0, up - 1);
  let d = Math.max(4, m.cardH * 0.12);
  let u = Math.max(12, m.cardH * 0.3);
  const fits = () => d * down + u * upGaps <= avail + 0.01;
  if (fits()) return { down: d, up: u };
  const minDown = Math.max(3, m.cardH * 0.05);
  if (down > 0) d = Math.max(minDown, (avail - u * upGaps) / down);
  if (fits()) return { down: d, up: u };
  d = down > 0 ? Math.min(minDown, avail / down) : d;
  u = upGaps > 0 ? Math.max(0, (avail - d * down) / upGaps) : u;
  return { down: d, up: u };
}

export interface Placement {
  id: number;
  up: boolean;
  x: number;
  y: number;
  z: number;
  pile: PileRef;
  index: number;
}

export interface BoardLayout {
  metrics: Metrics;
  cards: Placement[];
  /** Bottom edge of each tableau column (last card). */
  columnBottoms: number[];
}

export function layoutBoard(p: Piles, draw: DrawMode, m: Metrics): BoardLayout {
  const cards: Placement[] = [];
  const stock = slotRect(m, STOCK);
  p.stock.forEach((c, i) => cards.push({ id: c.id, up: c.up, x: stock.x, y: stock.y, z: 1 + i, pile: STOCK, index: i }));

  const waste = slotRect(m, WASTE);
  const fanned = draw === 3 ? Math.min(3, p.waste.length) : 1;
  p.waste.forEach((c, i) => {
    const k = Math.max(0, i - (p.waste.length - fanned));
    cards.push({ id: c.id, up: c.up, x: waste.x + k * m.fanX, y: waste.y, z: 100 + i, pile: WASTE, index: i });
  });

  for (let f = 0; f < FOUNDATIONS; f++) {
    const ref = foundationRef(f);
    const r = slotRect(m, ref);
    (p.foundations[f] ?? []).forEach((c, i) => cards.push({ id: c.id, up: c.up, x: r.x, y: r.y, z: 200 + i, pile: ref, index: i }));
  }

  const columnBottoms: number[] = [];
  for (let t = 0; t < TABLEAU_COLUMNS; t++) {
    const ref = tableauRef(t);
    const col = p.tableau[t] ?? [];
    const r = slotRect(m, ref);
    const down = faceDownCount(col);
    const off = fanOffsets(m, down, col.length - down);
    let y = r.y;
    col.forEach((c, i) => {
      cards.push({ id: c.id, up: c.up, x: r.x, y, z: 300 + i, pile: ref, index: i });
      if (i < col.length - 1) y += c.up ? off.up : off.down;
    });
    columnBottoms.push(col.length > 0 ? y + m.cardH : r.y + m.cardH);
  }
  return { metrics: m, cards, columnBottoms };
}

/** Generous drop area of a pile: the whole column below the top row for the tableau. */
export function dropRect(m: Metrics, ref: PileRef): Rect {
  const base = slotRect(m, ref);
  const half = m.gap / 2;
  if (ref.kind === 'tableau') return { x: base.x - half, y: base.y - m.rowGap / 2, w: m.cardW + m.gap, h: Math.max(m.cardH, m.height - base.y + m.rowGap / 2) };
  return { x: base.x - half, y: base.y, w: m.cardW + m.gap, h: m.cardH + m.rowGap / 2 };
}

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The candidate pile that the dragged card overlaps the most (null when none). */
export function pickDropTarget(m: Metrics, dragged: Rect, candidates: readonly PileRef[]): PileRef | null {
  let best: PileRef | null = null;
  let bestArea = 0;
  for (const ref of candidates) {
    const area = overlapArea(dragged, dropRect(m, ref));
    if (area > bestArea) {
      bestArea = area;
      best = ref;
    }
  }
  return best;
}

/** Cards whose pile or position in the pile differs between two positions (used to raise moving cards). */
export function changedCards(a: Piles, b: Piles): Set<number> {
  const where = (p: Piles) => {
    const map = new Map<number, string>();
    const add = (pile: readonly { id: number }[], key: string) => pile.forEach((c, i) => map.set(c.id, `${key}:${i}`));
    add(p.stock, 's');
    add(p.waste, 'w');
    p.foundations.forEach((f, i) => add(f, `f${i}`));
    p.tableau.forEach((t, i) => add(t, `t${i}`));
    return map;
  };
  const before = where(a);
  const out = new Set<number>();
  for (const [id, pos] of where(b)) if (before.get(id) !== pos) out.add(id);
  return out;
}
