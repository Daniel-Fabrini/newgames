import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { ALL_DIGITS, CELLS, bit, cellAt, parseGrid } from './grid';
import {
  STUCK_TIER,
  TECHNIQUES,
  TECHNIQUE_TIER,
  applyStep,
  createBoard,
  findClaiming,
  findFish,
  findHiddenSingle,
  findHiddenSubset,
  findNakedSingle,
  findNakedSubset,
  findPointing,
  findXyChain,
  findXyWing,
  findXyzWing,
  gradePuzzle,
  hasContradiction,
  isSolvedBoard,
  nextStep,
  solvableWithin,
  type Elimination,
  type LogicBoard,
  type TechniqueId,
} from './logic';
import { countSolutions, solve } from './solver';
import { digPuzzle } from './generator';
import { EXAMPLES } from './fixtures';

/** Empty board where every cell can hold any digit (patterns are carved by hand). */
function blank(): LogicBoard {
  return { values: new Uint8Array(CELLS), cands: new Uint16Array(CELLS).fill(ALL_DIGITS) };
}
const mask = (...digits: number[]) => digits.reduce((m, d) => m | bit(d), 0);
const at = cellAt;
function removeDigit(b: LogicBoard, cells: number[], digit: number) {
  for (const c of cells) b.cands[c]! &= ~bit(digit);
}
const sortElims = (e: Elimination[]) => e.map((x) => `${x.cell}:${x.digit}`).sort();
const elimsOf = (pairs: Array<[number, number, number]>) => pairs.map(([r, c, d]) => `${at(r, c)}:${d}`).sort();
const row = (r: number) => Array.from({ length: 9 }, (_, c) => at(r, c));
const col = (c: number) => Array.from({ length: 9 }, (_, r) => at(r, c));

describe('logical solver: candidate setup', () => {
  it('computes candidates from the givens', () => {
    const b = createBoard(parseGrid(EXAMPLES.easy))!;
    // r1c1 (empty): row has 3,2,6; column has 9,7,8; box has 3,9,1 → {4,5}
    expect(b.cands[0]).toBe(mask(4, 5));
    expect(b.cands[2]).toBe(0); // given
    expect(hasContradiction(b)).toBe(false);
  });

  it('rejects givens that repeat a digit', () => {
    const g = parseGrid(EXAMPLES.easy);
    g[0] = 3; // row 1 already has a 3
    expect(createBoard(g)).toBeNull();
    expect(gradePuzzle(g).invalid).toBe(true);
  });
});

describe('logical techniques on hand-made candidate patterns', () => {
  it('naked single', () => {
    const b = blank();
    b.cands[at(4, 4)] = mask(7);
    expect(findNakedSingle(b)).toMatchObject({ technique: 'nakedSingle', placement: { cell: at(4, 4), digit: 7 } });
  });

  it('hidden single (scans boxes first)', () => {
    const b = blank();
    removeDigit(b, row(2).filter((c) => c !== at(2, 6)), 8);
    const step = findHiddenSingle(b);
    expect(step).toMatchObject({ technique: 'hiddenSingle', placement: { cell: at(2, 6), digit: 8 }, unit: 2 });
  });

  it('pointing: a digit confined to one row of a box leaves the rest of the row', () => {
    const b = blank();
    removeDigit(b, [at(0, 2), at(1, 0), at(1, 1), at(1, 2), at(2, 0), at(2, 1), at(2, 2)], 5);
    const step = findPointing(b)!;
    expect(step.technique).toBe('pointing');
    expect(step.digits).toEqual([5]);
    expect(step.cells).toEqual([at(0, 0), at(0, 1)]);
    expect(sortElims(step.eliminations)).toEqual(elimsOf([3, 4, 5, 6, 7, 8].map((c) => [0, c, 5])));
  });

  it('claiming: a digit confined to one box inside a row leaves the rest of the box', () => {
    const b = blank();
    removeDigit(b, row(0).slice(3), 3);
    const step = findClaiming(b)!;
    expect(step.technique).toBe('claiming');
    expect(step.unit).toBe(0);
    expect(sortElims(step.eliminations)).toEqual(elimsOf([1, 2].flatMap((r) => [0, 1, 2].map((c) => [r, c, 3] as [number, number, number]))));
  });

  it('naked pair', () => {
    const b = blank();
    b.cands[at(0, 0)] = mask(1, 2);
    b.cands[at(0, 1)] = mask(1, 2);
    const step = findNakedSubset(b, 2)!;
    expect(step.technique).toBe('nakedPair');
    expect(step.digits).toEqual([1, 2]);
    expect(step.eliminations).toHaveLength(7 * 2);
    expect(step.eliminations.every((e) => e.cell >= 2 && e.cell <= 8)).toBe(true);
  });

  it('hidden pair', () => {
    const b = blank();
    removeDigit(b, row(0).slice(2), 1);
    removeDigit(b, row(0).slice(2), 2);
    const step = findHiddenSubset(b, 2)!;
    expect(step.technique).toBe('hiddenPair');
    expect(step.cells).toEqual([0, 1]);
    expect(step.eliminations).toHaveLength(2 * 7);
    applyStep(b, step);
    expect(b.cands[0]).toBe(mask(1, 2));
    expect(b.cands[1]).toBe(mask(1, 2));
  });

  it('naked triple ({1,2}, {2,3}, {1,3})', () => {
    const b = blank();
    b.cands[at(0, 0)] = mask(1, 2);
    b.cands[at(0, 1)] = mask(2, 3);
    b.cands[at(0, 2)] = mask(1, 3);
    expect(findNakedSubset(b, 2)).toBeNull();
    const step = findNakedSubset(b, 3)!;
    expect(step.technique).toBe('nakedTriple');
    expect(step.digits).toEqual([1, 2, 3]);
    expect(step.eliminations).toHaveLength(6 * 3);
  });

  it('hidden triple and hidden quad', () => {
    const b = blank();
    for (const d of [1, 2, 3]) removeDigit(b, row(0).slice(3), d);
    const triple = findHiddenSubset(b, 3)!;
    expect(triple.technique).toBe('hiddenTriple');
    expect(triple.cells).toEqual([0, 1, 2]);
    expect(triple.eliminations).toHaveLength(3 * 6);

    const q = blank();
    for (const d of [1, 2, 3, 4]) removeDigit(q, col(5).slice(4), d);
    const quad = findHiddenSubset(q, 4)!;
    expect(quad.technique).toBe('hiddenQuad');
    expect(quad.cells).toEqual([5, 14, 23, 32]);
    expect(quad.eliminations).toHaveLength(4 * 5);
  });

  it('naked quad', () => {
    const b = blank();
    b.cands[at(8, 0)] = mask(1, 2);
    b.cands[at(8, 3)] = mask(2, 3);
    b.cands[at(8, 5)] = mask(3, 4);
    b.cands[at(8, 8)] = mask(1, 4);
    expect(findNakedSubset(b, 3)).toBeNull();
    const step = findNakedSubset(b, 4)!;
    expect(step.technique).toBe('nakedQuad');
    expect(step.eliminations).toHaveLength(5 * 4);
  });

  it('X-Wing on rows', () => {
    const b = blank();
    removeDigit(b, row(1).filter((c) => c !== at(1, 2) && c !== at(1, 7)), 4);
    removeDigit(b, row(5).filter((c) => c !== at(5, 2) && c !== at(5, 7)), 4);
    const step = findFish(b, 2)!;
    expect(step.technique).toBe('xWing');
    expect(step.cells).toEqual([at(1, 2), at(1, 7), at(5, 2), at(5, 7)].sort((a, z) => a - z));
    const expected = [0, 2, 3, 4, 6, 7, 8].flatMap((r) => [2, 7].map((c) => [r, c, 4] as [number, number, number]));
    expect(sortElims(step.eliminations)).toEqual(elimsOf(expected));
  });

  it('X-Wing on columns', () => {
    const b = blank();
    removeDigit(b, col(0).filter((c) => c !== at(3, 0) && c !== at(6, 0)), 9);
    removeDigit(b, col(4).filter((c) => c !== at(3, 4) && c !== at(6, 4)), 9);
    const step = findFish(b, 2)!;
    expect(step.technique).toBe('xWing');
    expect(step.eliminations.every((e) => e.digit === 9 && (Math.floor(e.cell / 9) === 3 || Math.floor(e.cell / 9) === 6))).toBe(true);
    expect(step.eliminations).toHaveLength(14);
  });

  it('Swordfish and Jellyfish', () => {
    const b = blank();
    const keep = (r: number, cols: number[]) => removeDigit(b, row(r).filter((c) => !cols.includes(c % 9)), 7);
    keep(0, [1, 4]);
    keep(3, [4, 8]);
    keep(6, [1, 8]);
    expect(findFish(b, 2)).toBeNull();
    const sword = findFish(b, 3)!;
    expect(sword.technique).toBe('swordfish');
    expect(sword.eliminations).toHaveLength(6 * 3);
    expect(sword.eliminations.every((e) => [1, 4, 8].includes(e.cell % 9) && ![0, 3, 6].includes(Math.floor(e.cell / 9)))).toBe(true);

    const j = blank();
    const keepJ = (r: number, cols: number[]) => removeDigit(j, row(r).filter((c) => !cols.includes(c % 9)), 9);
    keepJ(0, [0, 1]);
    keepJ(2, [1, 2]);
    keepJ(4, [2, 3]);
    keepJ(6, [3, 0]);
    expect(findFish(j, 3)).toBeNull();
    const jelly = findFish(j, 4)!;
    expect(jelly.technique).toBe('jellyfish');
    expect(jelly.eliminations).toHaveLength(5 * 4);
  });

  it('XY-Wing', () => {
    const b = blank();
    b.cands[at(0, 0)] = mask(1, 2); // pivot
    b.cands[at(0, 4)] = mask(1, 3); // pincer (row)
    b.cands[at(4, 0)] = mask(2, 3); // pincer (column)
    const step = findXyWing(b)!;
    expect(step.technique).toBe('xyWing');
    expect(step.cells).toEqual([at(0, 0), at(0, 4), at(4, 0)]);
    expect(sortElims(step.eliminations)).toEqual(elimsOf([[4, 4, 3]]));
  });

  it('XYZ-Wing', () => {
    const b = blank();
    b.cands[at(0, 0)] = mask(1, 2, 3); // pivot
    b.cands[at(0, 4)] = mask(1, 3);
    b.cands[at(1, 1)] = mask(2, 3);
    const step = findXyzWing(b)!;
    expect(step.technique).toBe('xyzWing');
    expect(sortElims(step.eliminations)).toEqual(elimsOf([
      [0, 1, 3],
      [0, 2, 3],
    ]));
  });

  it('XY-Chain of four cells', () => {
    const b = blank();
    b.cands[at(0, 0)] = mask(1, 2);
    b.cands[at(0, 5)] = mask(2, 3);
    b.cands[at(4, 5)] = mask(3, 4);
    b.cands[at(4, 1)] = mask(4, 1);
    expect(findXyWing(b)).toBeNull();
    const step = findXyChain(b)!;
    expect(step.technique).toBe('xyChain');
    expect(step.cells).toHaveLength(4);
    expect(sortElims(step.eliminations)).toEqual(elimsOf([
      [0, 1, 1],
      [1, 1, 1],
      [2, 1, 1],
      [3, 0, 1],
      [4, 0, 1],
      [5, 0, 1],
    ]));
  });

  it('finds nothing on a fresh board', () => {
    const b = blank();
    for (const t of TECHNIQUES) expect(t.find(b)).toBeNull();
  });
});

describe('grading known puzzles', () => {
  const grade = (text: string) => gradePuzzle(parseGrid(text));

  it('rates singles-only puzzles as tier 1', () => {
    for (const text of [EXAMPLES.easy, EXAMPLES.wikipedia]) {
      const g = grade(text);
      expect(g.solved).toBe(true);
      expect(g.tier).toBe(1);
      expect(Object.keys(g.counts).sort()).toEqual(expect.arrayContaining(['nakedSingle']));
      expect(g.values).toEqual(solve(parseGrid(text)));
    }
  });

  it('needs an X-Wing for the SudokuWiki example', () => {
    const g = grade(EXAMPLES.xWing);
    expect(g.solved).toBe(true);
    expect(g.tier).toBe(3);
    expect(g.counts.xWing).toBeGreaterThan(0);
    expect(solvableWithin(parseGrid(EXAMPLES.xWing), 2)).toBe(false);
    expect(g.values).toEqual(solve(parseGrid(EXAMPLES.xWing)));
  });

  const cases: Array<[keyof typeof EXAMPLES, TechniqueId, number]> = [
    ['pointingAndPair', 'nakedPair', 2],
    ['claiming', 'claiming', 2],
    ['hiddenPair', 'hiddenPair', 2],
    ['nakedTriple', 'nakedTriple', 3],
    ['hiddenTriple', 'hiddenTriple', 3],
    ['generatedXWing', 'xWing', 3],
    ['xyWing', 'xyWing', 3],
    ['xyzWing', 'xyzWing', 3],
    ['swordfish', 'swordfish', 3],
    ['nakedQuad', 'nakedQuad', 3],
    ['xyChain', 'xyChain', 4],
  ];
  it.each(cases)('%s needs %s (tier %i)', (key, technique, tier) => {
    const puzzle = parseGrid(EXAMPLES[key]);
    const g = gradePuzzle(puzzle);
    expect(countSolutions(puzzle)).toBe(1);
    expect(g.solved).toBe(true);
    expect(g.tier).toBe(tier);
    expect(g.counts[technique]).toBeGreaterThan(0);
    expect(solvableWithin(puzzle, tier - 1)).toBe(false);
    expect(g.values).toEqual(solve(puzzle));
  });

  it('cannot finish the famous hardest puzzles without bifurcation (expert), although they are unique', () => {
    for (const text of [EXAMPLES.inkala, EXAMPLES.easterMonster, EXAMPLES.goldenNugget]) {
      const g = grade(text);
      expect(countSolutions(parseGrid(text))).toBe(1);
      expect(g.solved).toBe(false);
      expect(g.invalid).toBe(false);
      expect(g.tier).toBe(STUCK_TIER);
    }
  });

  it('respects the tier limit', () => {
    const g = gradePuzzle(parseGrid(EXAMPLES.xWing), 2);
    expect(g.solved).toBe(false);
    expect(Object.keys(g.counts).every((t) => TECHNIQUE_TIER[t as TechniqueId] <= 2)).toBe(true);
  });
});

describe('soundness', () => {
  it('never places or eliminates against the solution on generated puzzles', () => {
    const rng = new Rng(2025);
    const used = new Set<string>();
    for (let k = 0; k < 40; k++) {
      const { puzzle, solution } = digPuzzle(k % 2 ? 'expert' : 'hard', rng);
      const b = createBoard(puzzle)!;
      for (let guard = 0; guard < 300 && !isSolvedBoard(b); guard++) {
        const step = nextStep(b);
        if (!step) break;
        used.add(step.technique);
        if (step.placement) expect(solution[step.placement.cell]).toBe(step.placement.digit);
        for (const e of step.eliminations) expect(solution[e.cell]).not.toBe(e.digit);
        applyStep(b, step);
        for (let i = 0; i < CELLS; i++) if (!b.values[i]) expect(b.cands[i]! & bit(solution[i]!)).not.toBe(0);
      }
    }
    expect(used.size).toBeGreaterThan(4);
  });
});
