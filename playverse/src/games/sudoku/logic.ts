import {
  ALL_DIGITS,
  BOX,
  CELLS,
  COL,
  PEERS,
  POPCOUNT,
  ROW,
  UNITS,
  bit,
  firstDigit,
  forEachCombination,
  isPeer,
} from './grid';

/**
 * Human-style logical solver used to grade puzzles and to explain hints.
 *
 * It keeps a candidate mask for every empty cell and repeatedly applies the simplest technique
 * that makes progress ("simplest first"). The difficulty of a puzzle is the hardest tier that was
 * needed to finish it:
 *
 * | Tier | Techniques                                                              | Difficulty |
 * | ---- | ----------------------------------------------------------------------- | ---------- |
 * | 1    | naked single, hidden single                                             | easy       |
 * | 2    | locked candidates (pointing, claiming), naked/hidden pairs              | medium     |
 * | 3    | naked/hidden triples, X-Wing, XY-Wing, XYZ-Wing, Swordfish, quads       | hard       |
 * | 4    | Jellyfish, XY-Chain                                                     | expert     |
 * | 5    | none of the above suffices (needs bifurcation / guessing)               | expert     |
 *
 * Why XY-Wing/Swordfish are "hard" and not "expert": measured on symmetric minimal puzzles from
 * this generator, puzzles whose hardest step is a triple or an X-Wing are only ~0.3 % of the
 * output (once the X-Wing is not needed the rest usually falls to singles), while XY-Wing alone
 * is ~3.7 %. Grouping these same-level "basic advanced" techniques keeps hard puzzles varied and
 * cheap to generate; expert keeps the chain-based techniques and puzzles that need bifurcation.
 *
 * All techniques are sound eliminations, so a puzzle finished by this solver has exactly one
 * solution. Because every technique only removes candidates, the set of puzzles solvable with
 * "techniques up to tier T" does not depend on the order in which they are applied.
 */
export type TechniqueId =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'pointing'
  | 'claiming'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing'
  | 'xyWing'
  | 'xyzWing'
  | 'swordfish'
  | 'nakedQuad'
  | 'hiddenQuad'
  | 'jellyfish'
  | 'xyChain';

export type Tier = 1 | 2 | 3 | 4;
/** Tier reported when the implemented techniques cannot finish the puzzle. */
export const STUCK_TIER = 5;

export const TECHNIQUE_TIER: Record<TechniqueId, Tier> = {
  nakedSingle: 1,
  hiddenSingle: 1,
  pointing: 2,
  claiming: 2,
  nakedPair: 2,
  hiddenPair: 2,
  nakedTriple: 3,
  hiddenTriple: 3,
  xWing: 3,
  xyWing: 3,
  xyzWing: 3,
  swordfish: 3,
  nakedQuad: 3,
  hiddenQuad: 3,
  jellyfish: 4,
  xyChain: 4,
};

export interface Elimination {
  cell: number;
  digit: number;
}

/** One logical deduction: either a placement (singles) or a set of candidate eliminations. */
export interface Step {
  technique: TechniqueId;
  /** Placement made by a single. */
  placement?: { cell: number; digit: number };
  eliminations: Elimination[];
  /** Cells that form the pattern (for explanations / highlighting). */
  cells: number[];
  /** Digits that form the pattern. */
  digits: number[];
  /** Unit (0–26) where the pattern lives, when it is unit based. */
  unit?: number;
}

/** Mutable solving state: placed values and candidate masks (0 for filled cells). */
export interface LogicBoard {
  values: Uint8Array;
  cands: Uint16Array;
}

/**
 * Builds a board from a grid (0 = empty) with all candidates computed. Returns null when the
 * givens already contain a duplicate.
 */
export function createBoard(grid: ArrayLike<number>): LogicBoard | null {
  const values = new Uint8Array(CELLS);
  const cands = new Uint16Array(CELLS).fill(ALL_DIGITS);
  for (let i = 0; i < CELLS; i++) {
    const d = grid[i]!;
    if (!d) continue;
    if (!(cands[i]! & bit(d))) return null;
    values[i] = d;
  }
  for (let i = 0; i < CELLS; i++) {
    if (values[i]) {
      cands[i] = 0;
      continue;
    }
    let mask = ALL_DIGITS;
    for (const p of PEERS[i]!) if (values[p]) mask &= ~bit(values[p]!);
    cands[i] = mask;
  }
  // A given that clashes with another given has no room left.
  for (let i = 0; i < CELLS; i++) {
    const d = values[i]!;
    if (!d) continue;
    for (const p of PEERS[i]!) if (values[p] === d) return null;
  }
  return { values, cands };
}

export function cloneBoard(b: LogicBoard): LogicBoard {
  return { values: b.values.slice(), cands: b.cands.slice() };
}

export function placeDigit(b: LogicBoard, cell: number, digit: number): void {
  b.values[cell] = digit;
  b.cands[cell] = 0;
  const m = ~bit(digit);
  for (const p of PEERS[cell]!) b.cands[p]! &= m;
}

export function applyStep(b: LogicBoard, step: Step): void {
  if (step.placement) placeDigit(b, step.placement.cell, step.placement.digit);
  for (const e of step.eliminations) b.cands[e.cell]! &= ~bit(e.digit);
}

export function isSolvedBoard(b: LogicBoard): boolean {
  for (let i = 0; i < CELLS; i++) if (!b.values[i]) return false;
  return true;
}

/** True when some empty cell has no candidate or some unit has no place left for a missing digit. */
export function hasContradiction(b: LogicBoard): boolean {
  for (let i = 0; i < CELLS; i++) if (!b.values[i] && !b.cands[i]) return true;
  for (const unit of UNITS) {
    let covered = 0;
    for (const c of unit) covered |= b.values[c] ? bit(b.values[c]!) : b.cands[c]!;
    if (covered !== ALL_DIGITS) return true;
  }
  return false;
}

/* ───────────────────────── Techniques ───────────────────────── */

export function findNakedSingle(b: LogicBoard): Step | null {
  for (let i = 0; i < CELLS; i++) {
    if (b.values[i] || POPCOUNT[b.cands[i]!] !== 1) continue;
    const digit = firstDigit(b.cands[i]!);
    return { technique: 'nakedSingle', placement: { cell: i, digit }, eliminations: [], cells: [i], digits: [digit] };
  }
  return null;
}

/** Boxes first (how people usually scan), then rows, then columns. */
const HIDDEN_SINGLE_ORDER = [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export function findHiddenSingle(b: LogicBoard): Step | null {
  for (const u of HIDDEN_SINGLE_ORDER) {
    const unit = UNITS[u]!;
    for (let d = 1; d <= 9; d++) {
      const m = bit(d);
      let only = -1;
      let count = 0;
      for (const c of unit) {
        if (b.values[c] === d) {
          count = 2; // already placed in this unit
          break;
        }
        if (!b.values[c] && b.cands[c]! & m) {
          only = c;
          if (++count > 1) break;
        }
      }
      if (count === 1) return { technique: 'hiddenSingle', placement: { cell: only, digit: d }, eliminations: [], cells: [only], digits: [d], unit: u };
    }
  }
  return null;
}

function cellsWith(b: LogicBoard, unit: readonly number[], digit: number): number[] {
  const m = bit(digit);
  const out: number[] = [];
  for (const c of unit) if (!b.values[c] && b.cands[c]! & m) out.push(c);
  return out;
}

function eliminate(b: LogicBoard, cells: Iterable<number>, digit: number, exclude: ReadonlySet<number>): Elimination[] {
  const m = bit(digit);
  const out: Elimination[] = [];
  for (const c of cells) if (!exclude.has(c) && !b.values[c] && b.cands[c]! & m) out.push({ cell: c, digit });
  return out;
}

/** Pointing: a digit confined to one row/column inside a box is removed from the rest of that line. */
export function findPointing(b: LogicBoard): Step | null {
  for (let u = 18; u < 27; u++) {
    for (let d = 1; d <= 9; d++) {
      const cells = cellsWith(b, UNITS[u]!, d);
      if (cells.length < 2) continue;
      const r = ROW[cells[0]!]!;
      const c = COL[cells[0]!]!;
      let line = -1;
      if (cells.every((x) => ROW[x] === r)) line = r;
      else if (cells.every((x) => COL[x] === c)) line = 9 + c;
      if (line < 0) continue;
      const elims = eliminate(b, UNITS[line]!, d, new Set(cells));
      if (elims.length) return { technique: 'pointing', eliminations: elims, cells, digits: [d], unit: u };
    }
  }
  return null;
}

/** Claiming (box/line reduction): a digit confined to one box inside a line is removed from the rest of the box. */
export function findClaiming(b: LogicBoard): Step | null {
  for (let u = 0; u < 18; u++) {
    for (let d = 1; d <= 9; d++) {
      const cells = cellsWith(b, UNITS[u]!, d);
      if (cells.length < 2) continue;
      const box = BOX[cells[0]!]!;
      if (!cells.every((x) => BOX[x] === box)) continue;
      const elims = eliminate(b, UNITS[18 + box]!, d, new Set(cells));
      if (elims.length) return { technique: 'claiming', eliminations: elims, cells, digits: [d], unit: u };
    }
  }
  return null;
}

const NAKED_IDS: Record<2 | 3 | 4, TechniqueId> = { 2: 'nakedPair', 3: 'nakedTriple', 4: 'nakedQuad' };
const HIDDEN_IDS: Record<2 | 3 | 4, TechniqueId> = { 2: 'hiddenPair', 3: 'hiddenTriple', 4: 'hiddenQuad' };

/** Naked subset: n cells of a unit whose candidates together are exactly n digits. */
export function findNakedSubset(b: LogicBoard, n: 2 | 3 | 4): Step | null {
  for (let u = 0; u < 27; u++) {
    const unit = UNITS[u]!;
    const empty = unit.filter((c) => !b.values[c]);
    if (empty.length <= n) continue;
    const pool = empty.filter((c) => POPCOUNT[b.cands[c]!]! >= 2 && POPCOUNT[b.cands[c]!]! <= n);
    if (pool.length < n) continue;
    let found: Step | null = null;
    forEachCombination(pool, n, (combo) => {
      let union = 0;
      for (const c of combo) union |= b.cands[c]!;
      if (POPCOUNT[union] !== n) return false;
      const inCombo = new Set(combo);
      const elims: Elimination[] = [];
      for (const c of empty) {
        if (inCombo.has(c)) continue;
        const hit = b.cands[c]! & union;
        if (!hit) continue;
        for (let d = 1; d <= 9; d++) if (hit & bit(d)) elims.push({ cell: c, digit: d });
      }
      if (!elims.length) return false;
      found = { technique: NAKED_IDS[n], eliminations: elims, cells: combo, digits: digitsFromMask(union), unit: u };
      return true;
    });
    if (found) return found;
  }
  return null;
}

/** Hidden subset: n digits of a unit that can only go in the same n cells. */
export function findHiddenSubset(b: LogicBoard, n: 2 | 3 | 4): Step | null {
  for (let u = 0; u < 27; u++) {
    const unit = UNITS[u]!;
    const positions: Array<{ digit: number; mask: number }> = [];
    let emptyCount = 0;
    for (let k = 0; k < 9; k++) if (!b.values[unit[k]!]) emptyCount++;
    if (emptyCount <= n) continue;
    for (let d = 1; d <= 9; d++) {
      let mask = 0;
      let placed = false;
      for (let k = 0; k < 9; k++) {
        const c = unit[k]!;
        if (b.values[c] === d) placed = true;
        else if (!b.values[c] && b.cands[c]! & bit(d)) mask |= 1 << k;
      }
      if (placed) continue;
      const count = POPCOUNT[mask]!;
      if (count >= 2 && count <= n) positions.push({ digit: d, mask });
    }
    if (positions.length < n) continue;
    let found: Step | null = null;
    forEachCombination(positions, n, (combo) => {
      let union = 0;
      let digits = 0;
      for (const p of combo) {
        union |= p.mask;
        digits |= bit(p.digit);
      }
      if (POPCOUNT[union] !== n) return false;
      const cells: number[] = [];
      const elims: Elimination[] = [];
      for (let k = 0; k < 9; k++) {
        if (!(union & (1 << k))) continue;
        const c = unit[k]!;
        cells.push(c);
        const extra = b.cands[c]! & ~digits;
        for (let d = 1; d <= 9; d++) if (extra & bit(d)) elims.push({ cell: c, digit: d });
      }
      if (!elims.length) return false;
      found = { technique: HIDDEN_IDS[n], eliminations: elims, cells, digits: digitsFromMask(digits), unit: u };
      return true;
    });
    if (found) return found;
  }
  return null;
}

const FISH_IDS: Record<2 | 3 | 4, TechniqueId> = { 2: 'xWing', 3: 'swordfish', 4: 'jellyfish' };

/** Basic fish: X-Wing (n = 2), Swordfish (n = 3) and Jellyfish (n = 4), on rows and on columns. */
export function findFish(b: LogicBoard, n: 2 | 3 | 4): Step | null {
  const technique = FISH_IDS[n];
  for (let d = 1; d <= 9; d++) {
    const m = bit(d);
    for (const byRows of [true, false]) {
      // For each base line, the mask of cover positions holding the candidate.
      const bases: Array<{ line: number; mask: number }> = [];
      for (let line = 0; line < 9; line++) {
        let mask = 0;
        for (let k = 0; k < 9; k++) {
          const c = byRows ? line * 9 + k : k * 9 + line;
          if (!b.values[c] && b.cands[c]! & m) mask |= 1 << k;
        }
        const count = POPCOUNT[mask]!;
        if (count >= 2 && count <= n) bases.push({ line, mask });
      }
      if (bases.length < n) continue;
      let found: Step | null = null;
      forEachCombination(bases, n, (combo) => {
        let union = 0;
        for (const x of combo) union |= x.mask;
        if (POPCOUNT[union] !== n) return false;
        const baseLines = new Set(combo.map((x) => x.line));
        const elims: Elimination[] = [];
        const cells: number[] = [];
        for (let k = 0; k < 9; k++) {
          if (!(union & (1 << k))) continue;
          for (let line = 0; line < 9; line++) {
            const c = byRows ? line * 9 + k : k * 9 + line;
            if (b.values[c] || !(b.cands[c]! & m)) continue;
            if (baseLines.has(line)) cells.push(c);
            else elims.push({ cell: c, digit: d });
          }
        }
        if (!elims.length) return false;
        found = { technique, eliminations: elims, cells: cells.sort((a, z) => a - z), digits: [d] };
        return true;
      });
      if (found) return found;
    }
  }
  return null;
}

/**
 * XY-Wing: a pivot {x,y} sees two pincers {x,z} and {y,z}; any cell that sees both pincers cannot
 * be z (whichever value the pivot takes, one pincer becomes z).
 */
export function findXyWing(b: LogicBoard): Step | null {
  const bivalue: number[] = [];
  for (let i = 0; i < CELLS; i++) if (!b.values[i] && POPCOUNT[b.cands[i]!] === 2) bivalue.push(i);
  for (const pivot of bivalue) {
    const pm = b.cands[pivot]!;
    const wings = bivalue.filter((c) => c !== pivot && isPeer(pivot, c) && POPCOUNT[b.cands[c]! & pm] === 1 && b.cands[c] !== pm);
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const a = wings[i]!;
        const c = wings[j]!;
        const am = b.cands[a]!;
        const cm = b.cands[c]!;
        // The pincers must share the pivot digits differently and agree on z.
        if ((am & pm) === (cm & pm)) continue;
        const z = am & ~pm;
        if (z !== (cm & ~pm) || POPCOUNT[z] !== 1) continue;
        const digit = firstDigit(z);
        const elims: Elimination[] = [];
        for (let x = 0; x < CELLS; x++) {
          if (x === a || x === c || x === pivot || b.values[x] || !(b.cands[x]! & z)) continue;
          if (isPeer(x, a) && isPeer(x, c)) elims.push({ cell: x, digit });
        }
        if (elims.length) return { technique: 'xyWing', eliminations: elims, cells: [pivot, a, c], digits: digitsFromMask(pm | z) };
      }
    }
  }
  return null;
}

/**
 * XYZ-Wing: a pivot {x,y,z} sees two pincers {x,z} and {y,z}; a cell that sees the pivot and both
 * pincers cannot be z.
 */
export function findXyzWing(b: LogicBoard): Step | null {
  for (let pivot = 0; pivot < CELLS; pivot++) {
    if (b.values[pivot] || POPCOUNT[b.cands[pivot]!] !== 3) continue;
    const pm = b.cands[pivot]!;
    const wings: number[] = [];
    for (const p of PEERS[pivot]!) {
      const m = b.cands[p]!;
      if (!b.values[p] && POPCOUNT[m] === 2 && (m & ~pm) === 0) wings.push(p);
    }
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const a = wings[i]!;
        const c = wings[j]!;
        const am = b.cands[a]!;
        const cm = b.cands[c]!;
        if (am === cm || (am | cm) !== pm) continue;
        const z = am & cm;
        const digit = firstDigit(z);
        const elims: Elimination[] = [];
        for (const x of PEERS[pivot]!) {
          if (x === a || x === c || b.values[x] || !(b.cands[x]! & z)) continue;
          if (isPeer(x, a) && isPeer(x, c)) elims.push({ cell: x, digit });
        }
        if (elims.length) return { technique: 'xyzWing', eliminations: elims, cells: [pivot, a, c], digits: digitsFromMask(pm) };
      }
    }
  }
  return null;
}

const XY_CHAIN_MAX_CELLS = 12;
const XY_CHAIN_NODE_BUDGET = 20000;

/**
 * XY-Chain: a chain of bivalue cells, each seeing the next and sharing the digit that links them.
 * If the first cell is not z then the last one must be z, so any cell that sees both ends cannot
 * be z. Chains of 3 cells are XY-Wings (found earlier); this looks for chains of 4+ cells.
 */
export function findXyChain(b: LogicBoard): Step | null {
  const bivalue: number[] = [];
  for (let i = 0; i < CELLS; i++) if (!b.values[i] && POPCOUNT[b.cands[i]!] === 2) bivalue.push(i);
  if (bivalue.length < 4) return null;
  const neighbours = new Map<number, number[]>();
  for (const a of bivalue) neighbours.set(a, bivalue.filter((c) => c !== a && isPeer(a, c) && (b.cands[c]! & b.cands[a]!) !== 0));
  let budget = XY_CHAIN_NODE_BUDGET;
  const path: number[] = [];
  const onPath = new Set<number>();
  let result: Step | null = null;

  const extend = (cell: number, link: number, z: number): boolean => {
    if (--budget < 0) return true;
    for (const next of neighbours.get(cell)!) {
      if (onPath.has(next) || !(b.cands[next]! & link)) continue;
      const other = b.cands[next]! & ~link;
      path.push(next);
      onPath.add(next);
      if (other === z && path.length >= 4) {
        const start = path[0]!;
        const digit = firstDigit(z);
        const elims: Elimination[] = [];
        for (let x = 0; x < CELLS; x++) {
          if (onPath.has(x) || b.values[x] || !(b.cands[x]! & z)) continue;
          if (isPeer(x, start) && isPeer(x, next)) elims.push({ cell: x, digit });
        }
        if (elims.length) {
          result = { technique: 'xyChain', eliminations: elims, cells: path.slice(), digits: [digit] };
          return true;
        }
      }
      if (path.length < XY_CHAIN_MAX_CELLS && extend(next, other, z)) return true;
      path.pop();
      onPath.delete(next);
    }
    return false;
  };

  for (const start of bivalue) {
    const m = b.cands[start]!;
    for (const z of [m & -m, m & (m - 1)]) {
      path.length = 0;
      onPath.clear();
      path.push(start);
      onPath.add(start);
      if (extend(start, m & ~z, z)) return result;
    }
  }
  return null;
}

function digitsFromMask(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

/** Techniques in the order they are tried (simplest first). */
export const TECHNIQUES: ReadonlyArray<{ id: TechniqueId; find: (b: LogicBoard) => Step | null }> = [
  { id: 'nakedSingle', find: findNakedSingle },
  { id: 'hiddenSingle', find: findHiddenSingle },
  { id: 'pointing', find: findPointing },
  { id: 'claiming', find: findClaiming },
  { id: 'nakedPair', find: (b) => findNakedSubset(b, 2) },
  { id: 'hiddenPair', find: (b) => findHiddenSubset(b, 2) },
  { id: 'nakedTriple', find: (b) => findNakedSubset(b, 3) },
  { id: 'hiddenTriple', find: (b) => findHiddenSubset(b, 3) },
  { id: 'xWing', find: (b) => findFish(b, 2) },
  { id: 'xyWing', find: findXyWing },
  { id: 'xyzWing', find: findXyzWing },
  { id: 'swordfish', find: (b) => findFish(b, 3) },
  { id: 'nakedQuad', find: (b) => findNakedSubset(b, 4) },
  { id: 'hiddenQuad', find: (b) => findHiddenSubset(b, 4) },
  { id: 'jellyfish', find: (b) => findFish(b, 4) },
  { id: 'xyChain', find: findXyChain },
];

/** The simplest applicable step using techniques up to `maxTier`, or null when stuck. */
export function nextStep(b: LogicBoard, maxTier: number = 4): Step | null {
  for (const t of TECHNIQUES) {
    if (TECHNIQUE_TIER[t.id] > maxTier) break;
    const step = t.find(b);
    if (step) return step;
  }
  return null;
}

export interface GradeResult {
  /** True when the techniques up to `maxTier` finished the grid. */
  solved: boolean;
  /** Hardest tier used (1–4), or STUCK_TIER (5) when not solved. */
  tier: number;
  /** How many times each technique was applied. */
  counts: Partial<Record<TechniqueId, number>>;
  steps: number;
  /** The givens contradict each other or lead to a contradiction. */
  invalid: boolean;
  /** Final board (solved grid when `solved`). */
  values: number[];
}

/** Solves as far as possible with techniques up to `maxTier` and reports what was needed. */
export function gradePuzzle(grid: ArrayLike<number>, maxTier: number = 4): GradeResult {
  const b = createBoard(grid);
  if (!b) return { solved: false, tier: STUCK_TIER, counts: {}, steps: 0, invalid: true, values: Array.from(grid) };
  const counts: Partial<Record<TechniqueId, number>> = {};
  let tier = 1;
  let steps = 0;
  for (;;) {
    if (isSolvedBoard(b)) break;
    if (hasContradiction(b)) return { solved: false, tier: STUCK_TIER, counts, steps, invalid: true, values: Array.from(b.values) };
    const step = nextStep(b, maxTier);
    if (!step) break;
    applyStep(b, step);
    steps++;
    counts[step.technique] = (counts[step.technique] ?? 0) + 1;
    tier = Math.max(tier, TECHNIQUE_TIER[step.technique]);
  }
  const solved = isSolvedBoard(b);
  return { solved, tier: solved ? tier : STUCK_TIER, counts, steps, invalid: false, values: Array.from(b.values) };
}

/** True when the puzzle can be finished with techniques up to `maxTier` (which implies a unique solution). */
export function solvableWithin(grid: ArrayLike<number>, maxTier: number): boolean {
  return gradePuzzle(grid, maxTier).solved;
}
