import { Rng, hashString } from '../../utils/random';
import { CAPACITY, isUniform, type Bottles } from './engine';
import { canonicalKey, lowerBound, solve, type SolverMove } from './solver';

/**
 * Infinite, deterministic level campaign.
 *
 * Difficulty grows with the level number:
 * - colours: 3 + ⌊√((level − 1) / 1.5)⌋, capped at MAX_COLOURS (3 colours at level 1, 12 from level 123);
 * - empty bottles: 2 normally; 3 on the first level of each new colour count from 6 to 11 colours
 *   (a gentler introduction); 1 on every 10th level while there are 4–7 colours ("tight" levels);
 * - complexity: the admissible lower bound of the solution length (so no solution can be shorter)
 *   must reach `minMoves`, which rises inside each colour band and keeps rising slowly after the
 *   colour cap; starts with an already finished bottle are rejected.
 *
 * Every level is verified by the solver before it is offered: a candidate that is unsolvable,
 * too easy or that cannot be solved within the node budget is discarded and another sub-seed is
 * derived. The solver's solution length becomes the level's par.
 */
export const MAX_COLOURS = 12;
export const MAX_BOTTLES = MAX_COLOURS + 2;

export interface LevelConfig {
  level: number;
  colours: number;
  empties: number;
  /** Minimum number of pours any solution must need. */
  minMoves: number;
}

export interface GeneratedLevel {
  level: number;
  colours: number;
  empties: number;
  bottles: number[][];
  /** Length of the solver's solution. */
  par: number;
  solution: SolverMove[];
  /** Sub-seeds tried before this one was accepted (diagnostics). */
  attempts: number;
}

export function coloursFor(level: number): number {
  return Math.min(MAX_COLOURS, 3 + Math.floor(Math.sqrt(Math.max(0, level - 1) / 1.5)));
}

/** First level that uses `colours` colours. */
export function bandStart(colours: number): number {
  let level = 1;
  while (coloursFor(level) < colours) level++;
  return level;
}

/** Average admissible lower bound of a random start with `colours` colours (measured). */
const typicalBound = (colours: number) => 3.35 * colours - 2.9;

export function levelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.floor(level));
  const colours = coloursFor(n);
  const start = bandStart(colours);
  const isBandStart = n === start;
  let empties = 2;
  if (isBandStart && colours >= 6 && colours + 3 <= MAX_BOTTLES) empties = 3;
  else if (n % 10 === 0 && colours >= 4 && colours <= 7) empties = 1;

  // Progress inside the colour band (0 at its first level, 1 at its last); keeps growing slowly
  // past the colour cap.
  let progress: number;
  if (colours < MAX_COLOURS) {
    const end = bandStart(colours + 1) - 1;
    progress = end > start ? (n - start) / (end - start) : 0;
  } else {
    progress = Math.min(1.2, (n - start) / 100);
  }
  const base = typicalBound(colours);
  let minMoves: number;
  if (empties === 1) minMoves = Math.round(base - 3);
  else if (empties === 3) minMoves = Math.round(base - 2);
  else minMoves = Math.round(base - 1.5 + 3 * progress);
  return { level: n, colours, empties, minMoves: Math.max(4, minMoves) };
}

function seedFor(level: number, attempt: number): number {
  return hashString(`water-sort:${level}:${attempt}`);
}

function candidate(rng: Rng, colours: number, empties: number): number[][] {
  const ids = rng.shuffle(Array.from({ length: MAX_COLOURS }, (_, i) => i)).slice(0, colours);
  const units = rng.shuffle(ids.flatMap((c) => Array<number>(CAPACITY).fill(c)));
  const bottles: number[][] = [];
  for (let b = 0; b < colours; b++) bottles.push(units.slice(b * CAPACITY, (b + 1) * CAPACITY));
  for (let e = 0; e < empties; e++) bottles.push([]);
  return bottles;
}

/* ───────────── Structural identity (for "every level is distinct") ───────────── */

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const p of permutations(n - 1)) {
    for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  }
  return out;
}

/**
 * Exact identity of a puzzle up to bottle order and colour renaming (two levels with the same key
 * are the same puzzle in different colours). Cost grows with colours! — used for small counts.
 */
export function exactStructuralKey(bottles: Bottles): string {
  const used = [...new Set(bottles.flat())].sort((a, b) => a - b);
  let best: string | null = null;
  for (const perm of permutations(used.length)) {
    const map = new Map(used.map((c, i) => [c, perm[i] as number]));
    const key = canonicalKey(bottles.map((b) => b.map((c) => map.get(c) as number)));
    if (best === null || key < best) best = key;
  }
  return best ?? '';
}

/**
 * Invariant under bottle order and colour renaming: equal puzzles always get equal keys, so
 * different keys prove that two puzzles are different. Cheap for any number of colours.
 */
export function structuralInvariant(bottles: Bottles): string {
  const pattern = (b: readonly number[]) => {
    const seen = new Map<number, number>();
    return b.map((c) => (seen.has(c) ? seen.get(c) : (seen.set(c, seen.size), seen.size - 1))).join('');
  };
  const colourSig = new Map<number, string>();
  const places = new Map<number, string[]>();
  bottles.forEach((b) => {
    const p = pattern(b);
    b.forEach((c, depth) => {
      const list = places.get(c) ?? [];
      list.push(`${depth}:${b.length}:${p}`);
      places.set(c, list);
    });
  });
  for (const [c, list] of places) colourSig.set(c, list.sort().join('/'));
  return bottles
    .map((b) => b.map((c) => colourSig.get(c)).join('|'))
    .sort()
    .join('#');
}

/** Colour counts up to this use the exact identity check against earlier levels of their band. */
const EXACT_GUARD_COLOURS = 5;

/* ───────────── Generation ───────────── */

const cache = new Map<number, GeneratedLevel>();
const CACHE_LIMIT = 48;

/** Forgets generated levels (tests use it to check determinism from scratch). */
export function clearLevelCache(): void {
  cache.clear();
}

/**
 * Solves a candidate within a node budget: near-optimal first (tight par), then a faster
 * weighting. Candidates that are unsolvable or too expensive to verify are rejected; `generous`
 * (only used by the safety valve) allows a much larger budget.
 */
function verify(bottles: Bottles, generous: boolean): SolverMove[] | null {
  const stages = [
    { weight: 1, maxNodes: 1_000 },
    { weight: 1.5, maxNodes: 3_000 },
    ...(generous ? [{ weight: 3, maxNodes: 60_000 }] : []),
  ];
  for (const opts of stages) {
    const result = solve(bottles, opts);
    if (result.status === 'solved') return result.moves;
    if (result.status === 'unsolvable') return null;
  }
  return null;
}

export function generateLevel(level: number): GeneratedLevel {
  const n = Math.max(1, Math.floor(level));
  const cached = cache.get(n);
  if (cached) return cached;
  const config = levelConfig(n);

  const taken = new Set<string>();
  if (config.colours <= EXACT_GUARD_COLOURS) {
    for (let m = bandStart(config.colours); m < n; m++) {
      const prev = generateLevel(m);
      if (prev.colours === config.colours) taken.add(exactStructuralKey(prev.bottles));
    }
  }

  for (let attempt = 0; ; attempt++) {
    // Safety valve (never needed in practice): relax the requirements slowly so generation always ends.
    const minMoves = config.minMoves - Math.floor(attempt / 400);
    const empties = attempt >= 1200 ? Math.max(config.empties, 2) : config.empties;
    const rng = new Rng(seedFor(n, attempt));
    const bottles = candidate(rng, config.colours, empties);
    if (bottles.some((b) => b.length === CAPACITY && isUniform(b))) continue;
    if (lowerBound(bottles) < minMoves) continue;
    if (taken.size > 0 && taken.has(exactStructuralKey(bottles))) continue;
    const solution = verify(bottles, attempt >= 400);
    if (!solution || solution.length < minMoves) continue;
    const generated: GeneratedLevel = {
      level: n,
      colours: config.colours,
      empties,
      bottles,
      par: solution.length,
      solution,
      attempts: attempt + 1,
    };
    cache.set(n, generated);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as number);
    return generated;
  }
}
