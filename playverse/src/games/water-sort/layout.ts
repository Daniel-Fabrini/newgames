/**
 * Bottle layout: picks the number of rows (1–3) that gives the largest bottles that fit the
 * available stage, so up to 14 bottles fit a 360×740 phone without cropping.
 */
export const BOTTLE_RATIO = 2.6; // height / width
export const LIFT_RATIO = 0.13; // selected bottles rise by this fraction of their height
export const LABEL_PX = 18; // bottle number under each bottle
export const MAX_BOTTLE_W = 74;
export const MIN_BOTTLE_W = 18;
/** Bottles at least this wide are comfortable to tap: use the fewest rows that reach it. */
export const COMFORT_BOTTLE_W = 50;
const GAP_RATIO = 0.32; // horizontal gap as a fraction of the bottle width
const ROW_GAP_PX = 10;

export interface BottleLayout {
  /** Bottle indices per row. */
  rows: number[][];
  bottleW: number;
  bottleH: number;
  gapX: number;
  /** Vertical space taken by one row (lift headroom + bottle + label). */
  rowH: number;
  rowGap: number;
}

/** Splits bottles into rows whose lengths differ by at most one (longer rows first). */
function split(count: number, rows: number): number[][] {
  const out: number[][] = [];
  const base = Math.floor(count / rows);
  const extra = count % rows;
  let start = 0;
  for (let r = 0; r < rows; r++) {
    const len = base + (r < extra ? 1 : 0);
    out.push(Array.from({ length: len }, (_, i) => start + i));
    start += len;
  }
  return out;
}

function widthFor(width: number, height: number, count: number, rows: number): number {
  const perRow = Math.ceil(count / rows);
  const byWidth = width / (perRow + (perRow - 1) * GAP_RATIO + 0.2);
  const rowSpace = (height - (rows - 1) * ROW_GAP_PX) / rows - LABEL_PX;
  const byHeight = rowSpace / (BOTTLE_RATIO * (1 + LIFT_RATIO));
  return Math.min(byWidth, byHeight, MAX_BOTTLE_W);
}

export function computeLayout(width: number, height: number, count: number): BottleLayout {
  const n = Math.max(1, count);
  const maxRows = Math.min(3, n);
  let bestRows = 1;
  let bestW = widthFor(width, height, n, 1);
  if (bestW < COMFORT_BOTTLE_W) {
    for (let rows = 2; rows <= maxRows; rows++) {
      const w = widthFor(width, height, n, rows);
      // Prefer fewer rows unless more rows give clearly bigger bottles.
      if (w > bestW * 1.06) {
        bestW = w;
        bestRows = rows;
      }
      if (bestW >= COMFORT_BOTTLE_W) break;
    }
  }
  const bottleW = Math.max(MIN_BOTTLE_W, Math.floor(bestW));
  const bottleH = Math.round(bottleW * BOTTLE_RATIO);
  return {
    rows: split(n, bestRows),
    bottleW,
    bottleH,
    gapX: Math.round(bottleW * GAP_RATIO),
    rowH: Math.ceil(bottleH * (1 + LIFT_RATIO)) + LABEL_PX,
    rowGap: ROW_GAP_PX,
  };
}

/** Total size of a layout (used by tests to check that it fits). */
export function layoutSize(layout: BottleLayout): { width: number; height: number } {
  const perRow = Math.max(...layout.rows.map((r) => r.length));
  return {
    width: perRow * layout.bottleW + (perRow - 1) * layout.gapX,
    height: layout.rows.length * layout.rowH + (layout.rows.length - 1) * layout.rowGap,
  };
}
