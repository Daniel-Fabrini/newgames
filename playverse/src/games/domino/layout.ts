import type { End, Placed } from './engine';
import { isDouble, type TileId } from './tiles';

/**
 * Snake layout of the line of play (pure geometry, no DOM).
 *
 * Units: a tile is 2 × 1 (a double laid crosswise is 1 × 2 along the direction of travel). The
 * opening tile sits at the origin; the right arm runs east and, when it reaches the edge, turns
 * down and comes back west (and so on, a serpentine going down); the left arm mirrors it going
 * up. At every turn the next tile is placed beside the last tile's outer half so the matching
 * halves always touch. Rows are kept at least `gap` units apart so arms never overlap.
 */
export type Orient = 'h' | 'v';
type Dir = 'E' | 'W' | 'S' | 'N';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A positioned tile: `first` is the pip on the top/left half, `second` on the bottom/right half. */
export interface LaidTile extends Rect {
  tile: TileId;
  orient: Orient;
  first: number;
  second: number;
}

interface Point {
  x: number;
  y: number;
}

interface Cursor {
  /** Leading point on the centre line, where the next tile starts. */
  p: Point;
  dir: Dir;
  /** Last placed rectangle and the centre of its outer half. */
  last: Rect;
  outer: Point;
  /** Centre line of the current (or last) horizontal row. */
  rowY: number;
  horiz: 'E' | 'W';
  vert: 'S' | 'N';
  /** Minimum distance between the centre lines of consecutive rows. */
  gap: number;
}

/** Tight rows (one vertical tile per turn) and airy rows (two per turn), used when there is room. */
export const ROW_GAPS = [3, 2] as const;
const MIN_GAP = 2;
const isHoriz = (d: Dir) => d === 'E' || d === 'W';

function rectFor(p: Point, dir: Dir, dbl: boolean): { rect: Rect; outer: Point; next: Point } {
  const len = dbl ? 1 : 2;
  switch (dir) {
    case 'E':
      return {
        rect: dbl ? { x: p.x, y: p.y - 1, w: 1, h: 2 } : { x: p.x, y: p.y - 0.5, w: 2, h: 1 },
        outer: { x: p.x + len - 0.5, y: p.y },
        next: { x: p.x + len, y: p.y },
      };
    case 'W':
      return {
        rect: dbl ? { x: p.x - 1, y: p.y - 1, w: 1, h: 2 } : { x: p.x - 2, y: p.y - 0.5, w: 2, h: 1 },
        outer: { x: p.x - len + 0.5, y: p.y },
        next: { x: p.x - len, y: p.y },
      };
    case 'S':
      return {
        rect: dbl ? { x: p.x - 1, y: p.y, w: 2, h: 1 } : { x: p.x - 0.5, y: p.y, w: 1, h: 2 },
        outer: { x: p.x, y: p.y + len - 0.5 },
        next: { x: p.x, y: p.y + len },
      };
    case 'N':
      return {
        rect: dbl ? { x: p.x - 1, y: p.y - 1, w: 2, h: 1 } : { x: p.x - 0.5, y: p.y - 2, w: 1, h: 2 },
        outer: { x: p.x, y: p.y - len + 0.5 },
        next: { x: p.x, y: p.y - len },
      };
  }
}

/** Changes direction: the new centre line passes through the outer half of the last tile. */
function turn(c: Cursor, dir: Dir): Cursor {
  const { last, outer } = c;
  let p: Point;
  switch (dir) {
    case 'E':
      p = { x: last.x + last.w, y: outer.y };
      break;
    case 'W':
      p = { x: last.x, y: outer.y };
      break;
    case 'S':
      p = { x: outer.x, y: last.y + last.h };
      break;
    case 'N':
      p = { x: outer.x, y: last.y };
      break;
  }
  const next: Cursor = { ...c, p, dir };
  if (dir === 'E' || dir === 'W') {
    next.rowY = outer.y;
    next.horiz = dir;
  }
  return next;
}

/**
 * Applies the turning rules before placing a tile of the given kind. A double in a row also
 * reserves room for the tile after it, so a turn never starts from a double's short side (it
 * becomes the first tile of the vertical stretch instead, still laid crosswise).
 */
function prepare(c: Cursor, dbl: boolean, half: number): Cursor {
  let next = c;
  if (isHoriz(c.dir)) {
    const need = dbl ? 3 : 2;
    const out = c.dir === 'E' ? c.p.x + need > half : c.p.x - need < -half;
    if (out) next = turn(c, c.vert);
  } else {
    // Turn back once the rows are far enough apart; a double that would end the vertical stretch
    // (and so be left with only its short side free) starts the next row instead.
    const dist = Math.abs(c.outer.y - c.rowY);
    if (dist >= c.gap || (dbl && dist >= MIN_GAP && dist + 1 >= c.gap)) next = turn(c, c.horiz === 'E' ? 'W' : 'E');
  }
  if (next === c || !dbl) return next;
  // A crosswise double right after a corner is shifted outwards by half a unit so that it only
  // touches the outer half of the previous tile.
  const shift = c.dir === 'E' || c.dir === 'S' ? 0.5 : -0.5;
  const p = isHoriz(c.dir) ? { x: next.p.x + shift, y: next.p.y } : { x: next.p.x, y: next.p.y + shift };
  return { ...next, p, rowY: isHoriz(next.dir) ? p.y : next.rowY };
}

function laid(tile: TileId, rect: Rect, dir: Dir, near: number, far: number, dbl: boolean): LaidTile {
  const orient: Orient = dbl ? (isHoriz(dir) ? 'v' : 'h') : isHoriz(dir) ? 'h' : 'v';
  // Near half faces back along the direction of travel.
  const forward = dir === 'E' || dir === 'S';
  return { tile, ...rect, orient, first: forward ? near : far, second: forward ? far : near };
}

function place(c: Cursor, tile: TileId, near: number, far: number, half: number): { tile: LaidTile; cursor: Cursor } {
  const dbl = near === far;
  const cur = prepare(c, dbl, half);
  const { rect, outer, next } = rectFor(cur.p, cur.dir, dbl);
  return { tile: laid(tile, rect, cur.dir, near, far, dbl), cursor: { ...cur, p: next, last: rect, outer } };
}

export interface UnitLayout {
  tiles: LaidTile[];
  /** Where the next tile would go at each end (null before the opening tile). */
  cursors: { left: Cursor; right: Cursor } | null;
  half: number;
  gap: number;
}

/** Lays out the line in units for a row half-width of `half` units. */
export function layoutUnits(line: readonly Placed[], origin: number, half: number, gap = 2): UnitLayout {
  const start = line[origin];
  if (!start) return { tiles: [], cursors: null, half, gap };
  const dbl = isDouble(start.tile);
  const rect: Rect = dbl ? { x: -0.5, y: -1, w: 1, h: 2 } : { x: -1, y: -0.5, w: 2, h: 1 };
  const tiles: LaidTile[] = [{ tile: start.tile, ...rect, orient: dbl ? 'v' : 'h', first: start.left, second: start.right }];
  let right: Cursor = { p: { x: rect.x + rect.w, y: 0 }, dir: 'E', last: rect, outer: { x: rect.x + rect.w - 0.5, y: 0 }, rowY: 0, horiz: 'E', vert: 'S', gap };
  let left: Cursor = { p: { x: rect.x, y: 0 }, dir: 'W', last: rect, outer: { x: rect.x + 0.5, y: 0 }, rowY: 0, horiz: 'W', vert: 'N', gap };
  for (let i = origin + 1; i < line.length; i++) {
    const p = line[i] as Placed;
    const r = place(right, p.tile, p.left, p.right, half);
    tiles.push(r.tile);
    right = r.cursor;
  }
  for (let i = origin - 1; i >= 0; i--) {
    const p = line[i] as Placed;
    const r = place(left, p.tile, p.right, p.left, half);
    tiles.unshift(r.tile);
    left = r.cursor;
  }
  return { tiles, cursors: { left, right }, half, gap };
}

/** Rectangle the next tile (double or not) would occupy at an end. */
export function slotAt(layout: UnitLayout, end: End, dbl: boolean): Rect | null {
  if (!layout.cursors) return null;
  const c = prepare(layout.cursors[end], dbl, layout.half);
  return rectFor(c.p, c.dir, dbl).rect;
}

/** A ghost tile showing how `tile` would sit at `end` (`near` = matched pip, `far` = the other). */
export function ghostAt(layout: UnitLayout, end: End, tile: TileId, near: number, far: number): LaidTile | null {
  if (!layout.cursors) return null;
  return place(layout.cursors[end], tile, near, far, layout.half).tile;
}

export function bounds(rects: readonly Rect[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!Number.isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

export interface FittedLayout {
  /** Pixel size of one unit (a tile's short side). */
  unit: number;
  units: UnitLayout;
  /** Converts a unit rectangle to pixels inside the container. */
  toPx(r: Rect): Rect;
}

const MIN_HALF = 3;
const EDGE_MARGIN = 0.25;

/** Largest unit (≤ maxUnit) at which the layout with the given row gap fits. */
function fitUnits(line: readonly Placed[], origin: number, w: number, h: number, maxUnit: number, withSlots: boolean, gap: number) {
  let unit = Math.max(1, Math.min(maxUnit, w / (2 * (MIN_HALF + EDGE_MARGIN))));
  let units = layoutUnits(line, origin, MIN_HALF, gap);
  let box = bounds([]);
  for (let i = 0; i < 80; i++) {
    const half = Math.max(MIN_HALF, w / unit / 2 - EDGE_MARGIN);
    units = layoutUnits(line, origin, half, gap);
    const rects: Rect[] = [...units.tiles];
    if (withSlots && units.cursors) {
      for (const end of ['left', 'right'] as const) {
        for (const dbl of [false, true]) {
          const s = slotAt(units, end, dbl);
          if (s) rects.push(s);
        }
      }
    }
    box = bounds(rects);
    const bw = box.maxX - box.minX + 0.3;
    const bh = box.maxY - box.minY + 0.3;
    const fit = Math.min(w / bw, h / bh);
    if (fit >= unit - 1e-6 || unit <= 1) break;
    unit = Math.max(1, Math.min(unit * 0.97, fit));
  }
  return { unit, units, box };
}

/**
 * Chooses the largest unit (≤ maxUnit) for which the whole line — plus the slots for the next
 * tile at both ends when `withSlots` — fits inside width × height pixels, and centres it.
 * Airy rows are preferred while they cost no tile size.
 */
export function fitLayout(line: readonly Placed[], origin: number, width: number, height: number, maxUnit: number, withSlots: boolean): FittedLayout {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let best: ReturnType<typeof fitUnits> | null = null;
  for (const gap of ROW_GAPS) {
    const candidate = fitUnits(line, origin, w, h, maxUnit, withSlots, gap);
    if (!best || candidate.unit > best.unit * 1.001) best = candidate;
  }
  const { unit, units, box } = best as ReturnType<typeof fitUnits>;
  // Centre the tiles themselves, then shift just enough to keep the next-tile slots inside.
  const tiles = units.tiles.length > 0 ? bounds(units.tiles) : box;
  const place = (size: number, tMin: number, tMax: number, aMin: number, aMax: number) => {
    const centred = (size - (tMax - tMin) * unit) / 2 - tMin * unit;
    const lo = -aMin * unit;
    const hi = size - aMax * unit;
    return lo > hi ? (lo + hi) / 2 : Math.min(Math.max(centred, lo), hi);
  };
  const offX = place(w, tiles.minX, tiles.maxX, box.minX, box.maxX);
  const offY = place(h, tiles.minY, tiles.maxY, box.minY, box.maxY);
  return {
    unit,
    units,
    toPx: (r) => ({ x: offX + r.x * unit, y: offY + r.y * unit, w: r.w * unit, h: r.h * unit }),
  };
}
