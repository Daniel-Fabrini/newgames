import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { applyAction, legalActions, newMatch, type MatchState, type Placed } from './engine';
import { ROW_GAPS, fitLayout, ghostAt, layoutUnits, slotAt, type LaidTile, type Rect } from './layout';
import { isDouble, tileId as t } from './tiles';

const EPS = 1e-6;

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > EPS && h > EPS ? w * h : 0;
}

/** Length of the shared border between two touching rectangles (0 if they do not touch). */
function sharedEdge(a: Rect, b: Rect): number {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const touchX = Math.abs(a.x + a.w - b.x) < EPS || Math.abs(b.x + b.w - a.x) < EPS;
  const touchY = Math.abs(a.y + a.h - b.y) < EPS || Math.abs(b.y + b.h - a.y) < EPS;
  if (touchX && oy > EPS) return oy;
  if (touchY && ox > EPS) return ox;
  return 0;
}

/** The two halves of a tile with their pip values. */
function halves(tile: LaidTile): { rect: Rect; value: number }[] {
  if (tile.orient === 'h') {
    const w = tile.w / 2;
    return [
      { rect: { x: tile.x, y: tile.y, w, h: tile.h }, value: tile.first },
      { rect: { x: tile.x + w, y: tile.y, w, h: tile.h }, value: tile.second },
    ];
  }
  const h = tile.h / 2;
  return [
    { rect: { x: tile.x, y: tile.y, w: tile.w, h }, value: tile.first },
    { rect: { x: tile.x, y: tile.y + h, w: tile.w, h }, value: tile.second },
  ];
}

function randomLines(count: number): { line: Placed[]; origin: number }[] {
  const out: { line: Placed[]; origin: number }[] = [];
  const rng = new Rng(2024);
  for (let g = 0; g < count; g++) {
    let m: MatchState = newMatch({ mode: 'ai', difficulty: 'easy', length: 100 }, 300 + g);
    while (!m.round.result) m = applyAction(m, rng.pick(legalActions(m.round)))!;
    out.push({ line: m.round.line, origin: m.round.origin });
  }
  return out;
}

const lines = randomLines(40);

function checkLayout(line: Placed[], origin: number, half: number, gap = 2) {
  const { tiles } = layoutUnits(line, origin, half, gap);
  expect(tiles).toHaveLength(line.length);
  tiles.forEach((tile, i) => {
    expect(tile.tile).toBe(line[i]!.tile);
    const dbl = isDouble(tile.tile);
    // Sizes: 2×1 along the orientation.
    expect(tile.orient === 'h' ? [tile.w, tile.h] : [tile.h, tile.w]).toEqual([2, 1]);
    if (dbl) expect(tile.first).toBe(tile.second);
  });
  // No overlaps.
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) expect(overlapArea(tiles[i]!, tiles[j]!)).toBe(0);
  // Neighbours touch through the matching halves.
  for (let i = 1; i < tiles.length; i++) {
    const a = tiles[i - 1]!;
    const b = tiles[i]!;
    const value = line[i]!.left;
    expect(line[i - 1]!.right).toBe(value);
    const touching = halves(a).some((ha) => ha.value === value && halves(b).some((hb) => hb.value === value && sharedEdge(ha.rect, hb.rect) > EPS));
    expect(touching).toBe(true);
    // The far half of a non-double must be the one touching (no wrong-way tiles).
    if (!isDouble(a.tile) && line[i - 1]!.left !== value) {
      const wrong = halves(a).find((h) => h.value !== value)!;
      expect(halves(b).some((hb) => sharedEdge(wrong.rect, hb.rect) > EPS)).toBe(false);
    }
  }
  // Doubles lie crosswise: neighbours touch them on a long side.
  tiles.forEach((tile, i) => {
    if (!isDouble(tile.tile)) return;
    for (const j of [i - 1, i + 1]) {
      const n = tiles[j];
      if (!n) continue;
      expect(sharedEdge(tile, n)).toBeGreaterThan(EPS);
      const longSideX = tile.orient === 'v'; // vertical double: long sides are left/right
      const touchesLeftRight = Math.abs(tile.x - (n.x + n.w)) < EPS || Math.abs(n.x - (tile.x + tile.w)) < EPS;
      expect(touchesLeftRight).toBe(longSideX);
    }
  });
  return tiles;
}

describe('snake layout', () => {
  it('lays out the opening tile at the centre, doubles crosswise', () => {
    const one = layoutUnits([{ tile: t(6, 6), left: 6, right: 6 }], 0, 8).tiles;
    expect(one[0]).toMatchObject({ x: -0.5, y: -1, w: 1, h: 2, orient: 'v' });
    const reg = layoutUnits([{ tile: t(2, 5), left: 5, right: 2 }], 0, 8).tiles;
    expect(reg[0]).toMatchObject({ x: -1, y: -0.5, w: 2, h: 1, orient: 'h', first: 5, second: 2 });
  });

  it('never overlaps, keeps matching halves together and doubles crosswise, for many widths', () => {
    for (const { line, origin } of lines) for (const half of [3, 4.5, 6, 8, 11, 15]) for (const gap of ROW_GAPS) checkLayout(line, origin, half, gap);
  });

  it('turns at the edges (rows stay within the half width, up to a crosswise double)', () => {
    for (const { line, origin } of lines.slice(0, 15)) {
      const tiles = layoutUnits(line, origin, 6).tiles;
      for (const tile of tiles) {
        expect(tile.x).toBeGreaterThanOrEqual(-6.5 - EPS);
        expect(tile.x + tile.w).toBeLessThanOrEqual(6.5 + EPS);
      }
      if (line.length > 12) expect(new Set(tiles.map((x) => x.y)).size).toBeGreaterThan(3);
    }
  });

  it('the next-tile slots and ghosts do not overlap the line and touch the open ends', () => {
    for (const { line, origin } of lines.slice(0, 20)) {
      const units = layoutUnits(line.slice(0, Math.max(1, line.length - 1)), origin >= line.length - 1 ? 0 : origin, 5);
      const placed = units.tiles;
      for (const end of ['left', 'right'] as const) {
        for (const dbl of [false, true]) {
          const slot = slotAt(units, end, dbl)!;
          for (const p of placed) expect(overlapArea(slot, p)).toBe(0);
          const neighbour = end === 'left' ? placed[0]! : placed[placed.length - 1]!;
          expect(sharedEdge(slot, neighbour)).toBeGreaterThan(EPS);
        }
      }
      const ghost = ghostAt(units, 'right', t(1, 2), 1, 2)!;
      expect(ghost.w * ghost.h).toBe(2);
    }
  });

  it('fits the whole line (and the next slots) inside the container, scaling down when long', () => {
    for (const [w, h] of [
      [340, 300],
      [360, 220],
      [900, 420],
      [300, 520],
    ] as const) {
      let previousUnit = Infinity;
      const { line, origin } = lines.reduce((a, b) => (b.line.length > a.line.length ? b : a));
      for (let n = 1; n <= line.length; n++) {
        // Grow the line from the opening outward, as in a real game.
        const left = Math.max(0, origin - Math.floor(n / 2));
        const sub = line.slice(left, Math.min(line.length, left + n));
        const o = origin - left;
        if (o < 0 || o >= sub.length) continue;
        const fit = fitLayout(sub, o, w, h, 36, true);
        expect(fit.unit).toBeLessThanOrEqual(36);
        const rects = fit.units.tiles.map((r) => fit.toPx(r));
        for (const end of ['left', 'right'] as const) for (const dbl of [false, true]) rects.push(fit.toPx(slotAt(fit.units, end, dbl)!));
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(-0.5);
          expect(r.y).toBeGreaterThanOrEqual(-0.5);
          expect(r.x + r.w).toBeLessThanOrEqual(w + 0.5);
          expect(r.y + r.h).toBeLessThanOrEqual(h + 0.5);
        }
        // The scale only shrinks as the line grows (small wobble allowed when the next-tile slot turns a corner).
        expect(fit.unit).toBeLessThanOrEqual(previousUnit * 1.2 + 1e-6);
        previousUnit = fit.unit;
      }
      expect(previousUnit).toBeGreaterThan(5);
    }
  });
});
