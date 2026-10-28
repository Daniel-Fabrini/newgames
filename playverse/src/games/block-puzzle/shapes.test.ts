import { describe, expect, it } from 'vitest';
import { BIG_PIECE_CELLS, PALETTE_SIZE, SHAPES, SHAPE_IDS, cellsKey, isShapeId, orientations, shapeOf, type ShapeFamily } from './shapes';

const countBy = (family: ShapeFamily) => SHAPES.filter((s) => s.family === family).length;

describe('block puzzle shape library', () => {
  it('contains every required family with all its distinct orientations', () => {
    expect(countBy('mono')).toBe(1);
    for (const f of ['line2', 'line3', 'line4', 'line5'] as const) expect(countBy(f)).toBe(2);
    expect(countBy('square2')).toBe(1);
    expect(countBy('square3')).toBe(1);
    expect(countBy('corner3')).toBe(4);
    expect(countBy('l4')).toBe(4);
    expect(countBy('j4')).toBe(4);
    expect(countBy('t4')).toBe(4);
    expect(countBy('s4')).toBe(2);
    expect(countBy('z4')).toBe(2);
    expect(countBy('corner5')).toBe(4);
    expect(SHAPES).toHaveLength(35);
  });

  it('has horizontal and vertical lines', () => {
    for (const n of [2, 3, 4, 5]) {
      const lines = SHAPES.filter((s) => s.family === `line${n}`);
      expect(lines.map((s) => [s.w, s.h]).sort()).toEqual([[1, n], [n, 1]].sort());
    }
  });

  it('has unique ids and no two identical shapes', () => {
    expect(new Set(SHAPE_IDS).size).toBe(SHAPES.length);
    expect(new Set(SHAPES.map((s) => cellsKey(s.cells))).size).toBe(SHAPES.length);
  });

  it('stores normalised, connected cells that match the bounding box', () => {
    for (const s of SHAPES) {
      const rows = s.cells.map((c) => c[0]);
      const cols = s.cells.map((c) => c[1]);
      expect(Math.min(...rows)).toBe(0);
      expect(Math.min(...cols)).toBe(0);
      expect(Math.max(...rows) + 1).toBe(s.h);
      expect(Math.max(...cols) + 1).toBe(s.w);
      expect(new Set(s.cells.map(([r, c]) => `${r},${c}`)).size).toBe(s.cells.length);
      // Orthogonally connected (flood fill from the first cell reaches every cell)
      const keys = new Set(s.cells.map(([r, c]) => `${r},${c}`));
      const first = s.cells[0] as readonly [number, number];
      const seen = new Set([`${first[0]},${first[1]}`]);
      const stack = [first];
      while (stack.length) {
        const [r, c] = stack.pop() as readonly [number, number];
        for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]] as const) {
          const k = `${nr},${nc}`;
          if (keys.has(k) && !seen.has(k)) {
            seen.add(k);
            stack.push([nr, nc]);
          }
        }
      }
      expect(seen.size).toBe(s.cells.length);
    }
  });

  it('gives every shape a palette colour, a positive weight and the right size class', () => {
    for (const s of SHAPES) {
      expect(s.color).toBeGreaterThanOrEqual(1);
      expect(s.color).toBeLessThanOrEqual(PALETTE_SIZE);
      expect(s.weight).toBeGreaterThan(0);
      expect(s.big).toBe(s.cells.length >= BIG_PIECE_CELLS);
    }
    expect(SHAPES.filter((s) => s.big).map((s) => s.family).sort()).toEqual(
      ['corner5', 'corner5', 'corner5', 'corner5', 'line5', 'line5', 'square3'].sort(),
    );
  });

  it('dedupes symmetric rotations', () => {
    expect(orientations([[0, 0], [0, 1], [1, 0], [1, 1]])).toHaveLength(1);
    expect(orientations([[0, 1], [0, 2], [1, 0], [1, 1]])).toHaveLength(2);
    expect(orientations([[0, 0], [0, 1], [0, 2], [1, 1]])).toHaveLength(4);
  });

  it('looks shapes up by id', () => {
    expect(shapeOf('square3-0').cells).toHaveLength(9);
    expect(isShapeId('mono-0')).toBe(true);
    expect(isShapeId('nope')).toBe(false);
    expect(() => shapeOf('nope')).toThrow();
  });
});
