import { Rng } from '../../utils/random';
import { CELLS, countClues } from './grid';
import { STUCK_TIER, gradePuzzle, solvableWithin, type TechniqueId } from './logic';
import { hasUniqueSolution, randomSolution } from './solver';

/**
 * Puzzle generator.
 *
 * 1. A complete grid is built by randomised backtracking (seeded `Rng`).
 * 2. Clues are removed in rotationally symmetric pairs (cell i together with 80 − i), in random
 *    order, keeping a removal only when the puzzle still has a unique solution:
 *    - easy / medium: the puzzle must stay solvable by the logical solver using only the
 *      techniques of that tier or below (this also proves uniqueness, so no backtracking is
 *      needed). Digging stops at a per-difficulty clue floor (more clues for easier puzzles)
 *      once the puzzle needs the requested tier.
 *    - hard / expert: uniqueness is checked with the bitmask solver and digging continues until
 *      no clue can be removed (minimal puzzle). For hard, a puzzle that turned out harder than
 *      tier 3 gets clue pairs added back until it needs exactly tier 3.
 * 3. The result is graded with the full logical solver. If the grade is not the requested one the
 *    attempt is discarded and a new grid is tried.
 *
 * Budget and fallback: attempts stop after `maxAttempts` or `timeBudgetMs`. When no attempt hit
 * the requested grade, the puzzle whose grade is closest to the request is returned (ties go to
 * the easier one) with `exact: false`. Easy puzzles always succeed on the first attempt; the
 * tests check that the other difficulties succeed well within the budget (typically a few to a
 * few dozen attempts, see generator.test.ts for measured times).
 */
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_TIER: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

/** Maps a grader tier (1–4, or 5 = stuck) to a difficulty. */
export function difficultyOfTier(tier: number): Difficulty {
  if (tier <= 1) return 'easy';
  if (tier === 2) return 'medium';
  if (tier === 3) return 'hard';
  return 'expert';
}

/** Clue floor range per difficulty: digging stops at a random value in this range (17 = dig to minimal). */
export const CLUE_FLOOR: Record<Difficulty, readonly [number, number]> = {
  easy: [36, 40],
  medium: [29, 32],
  hard: [17, 17],
  expert: [17, 17],
};

export interface GeneratedPuzzle {
  puzzle: number[];
  solution: number[];
  /** Requested difficulty. */
  difficulty: Difficulty;
  /** Difficulty measured by the grader. */
  grade: Difficulty;
  /** Grader tier (1–4, or 5 when the implemented techniques do not finish it). */
  tier: number;
  counts: Partial<Record<TechniqueId, number>>;
  clues: number;
  attempts: number;
  /** False when the budget ran out and the fallback puzzle was returned. */
  exact: boolean;
  seed: number;
  elapsedMs: number;
}

export interface GenerateOptions {
  maxAttempts?: number;
  timeBudgetMs?: number;
  /** Clock (injectable for tests). */
  now?: () => number;
}

interface Candidate {
  puzzle: number[];
  solution: number[];
  tier: number;
  counts: Partial<Record<TechniqueId, number>>;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Hard puzzles are not softened beyond this many clues. */
const HARD_MAX_CLUES = 34;

/** Rotationally symmetric partner of a cell. */
const mirror = (i: number) => CELLS - 1 - i;

/**
 * Removes clue pairs in random order while `keep` accepts the result; stops early when `done`
 * returns true. Mutates and returns `puzzle`.
 */
function dig(puzzle: number[], rng: Rng, keep: (p: number[]) => boolean, done: (p: number[], clues: number) => boolean): number[] {
  const order = rng.shuffle(Array.from({ length: Math.ceil(CELLS / 2) }, (_, i) => i));
  let clues = countClues(puzzle);
  for (const i of order) {
    if (done(puzzle, clues)) break;
    const j = mirror(i);
    const a = puzzle[i]!;
    const b = puzzle[j]!;
    if (!a) continue;
    puzzle[i] = 0;
    puzzle[j] = 0;
    if (keep(puzzle)) clues -= i === j ? 1 : 2;
    else {
      puzzle[i] = a;
      puzzle[j] = b;
    }
  }
  return puzzle;
}

/** True when the puzzle needs exactly `tier` (assuming it is solvable within `tier`). */
const needsTier = (puzzle: number[], tier: number) => tier === 1 || !solvableWithin(puzzle, tier - 1);

/**
 * Adds clue pairs back (from the solution) to a puzzle that is harder than `target` until it
 * needs exactly `target`. At every step all missing pairs are tried: one that hits the target
 * ends the search; otherwise the pair that lets the logical solver progress furthest while the
 * puzzle is still too hard is kept. Pairs that would make it too easy are never kept.
 * Returns false when the target cannot be reached this way.
 */
function soften(puzzle: number[], solution: readonly number[], target: number, rng: Rng, maxClues: number): boolean {
  while (countClues(puzzle) < maxClues) {
    const empty = rng.shuffle(Array.from({ length: Math.ceil(CELLS / 2) }, (_, i) => i).filter((i) => puzzle[i] === 0));
    let best = -1;
    let bestProgress = -1;
    for (const i of empty) {
      const j = mirror(i);
      puzzle[i] = solution[i]!;
      puzzle[j] = solution[j]!;
      const graded = gradePuzzle(puzzle, target);
      if (graded.solved && needsTier(puzzle, target)) return true;
      if (!graded.solved) {
        const progress = countClues(graded.values);
        if (progress > bestProgress) {
          bestProgress = progress;
          best = i;
        }
      }
      puzzle[i] = 0;
      puzzle[j] = 0;
    }
    if (best < 0) return false;
    puzzle[best] = solution[best]!;
    puzzle[mirror(best)] = solution[mirror(best)]!;
  }
  return false;
}

/**
 * One generation attempt from a fresh random grid.
 * - easy / medium: digging constrained to puzzles solvable with techniques of that tier.
 * - hard: dig to a minimal unique puzzle; if it is harder than hard, add clues back until it
 *   needs exactly tier 3 (constrained digging alone lands on tier 3 too rarely).
 * - expert: dig to a minimal unique puzzle.
 */
export function digPuzzle(difficulty: Difficulty, rng: Rng): Candidate {
  const solution = randomSolution(rng);
  const target = DIFFICULTY_TIER[difficulty];
  const [lo, hi] = CLUE_FLOOR[difficulty];
  const floor = rng.int(lo, hi);
  let puzzle = solution.slice();
  if (target <= 2) {
    puzzle = dig(
      puzzle,
      rng,
      (p) => solvableWithin(p, target),
      (p, clues) => clues <= floor && needsTier(p, target),
    );
  } else {
    puzzle = dig(puzzle, rng, hasUniqueSolution, (_p, clues) => clues <= floor);
    if (target === 3) {
      const tier = gradePuzzle(puzzle, 4).tier;
      if (tier > 3) soften(puzzle, solution, 3, rng, HARD_MAX_CLUES);
    }
  }
  const grade = gradePuzzle(puzzle, 4);
  return { puzzle, solution, tier: grade.tier, counts: grade.counts };
}

/** Generates a puzzle of the requested difficulty (deterministic for a seed unless the time budget runs out). */
export function generatePuzzle(difficulty: Difficulty, seed: number, options: GenerateOptions = {}): GeneratedPuzzle {
  const { maxAttempts = 400, timeBudgetMs = 8000, now: clock = now } = options;
  const started = clock();
  const rng = new Rng(seed);
  const target = DIFFICULTY_TIER[difficulty];
  let best: Candidate | null = null;
  let attempts = 0;

  const distance = (c: Candidate) => (Math.min(c.tier, STUCK_TIER - 1) === target ? 0 : Math.abs(c.tier - target));

  while (attempts < maxAttempts) {
    attempts++;
    const candidate = digPuzzle(difficulty, rng);
    const d = distance(candidate);
    if (!best || d < distance(best) || (d === distance(best) && candidate.tier < best.tier)) best = candidate;
    if (d === 0) break;
    if (clock() - started > timeBudgetMs) break;
  }
  const chosen = best as Candidate;
  const grade = difficultyOfTier(chosen.tier);
  return {
    puzzle: chosen.puzzle,
    solution: chosen.solution,
    difficulty,
    grade,
    tier: chosen.tier,
    counts: chosen.counts,
    clues: countClues(chosen.puzzle),
    attempts,
    exact: grade === difficulty,
    seed,
    elapsedMs: Math.round(clock() - started),
  };
}
