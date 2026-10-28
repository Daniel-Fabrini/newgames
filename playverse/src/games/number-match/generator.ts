import { Rng, hashString } from '../../utils/random';
import { hasPair } from './match';

/**
 * Board generation for Number Match.
 *
 * Classic stages: random digits 1–9 (seeded). A board without any pair is re-rolled so a stage
 * never starts stuck.
 *
 * Challenges: boards are built so they are GUARANTEED to be solvable without adding numbers.
 * Starting from an empty sequence, each step inserts a matching pair (equal digits or digits
 * that add up to 10) as two adjacent cells at some position of the sequence. Removing the pairs
 * in reverse insertion order always works: when a pair is removed, every cell that was inserted
 * between its two halves came later and has therefore already been cleared, so the two halves
 * are connected in reading order. Removing fully cleared rows keeps reading order intact, so
 * the argument still holds after rows collapse.
 * Difficulty rises with the level: more pairs, a higher chance of inserting a pair inside the
 * existing sequence (deeper nesting instead of side-by-side pairs) and fewer additions/hints.
 */
export const MAX_CLASSIC_DIGITS = 54;
export const CLASSIC_START_DIGITS = 27;

/** Digits at the start of a classic stage: 27 on stage 1, +3 per stage, up to 54. */
export function classicDigitCount(stage: number): number {
  return Math.min(MAX_CLASSIC_DIGITS, CLASSIC_START_DIGITS + 3 * (Math.max(1, stage) - 1));
}

/** Random digits with at least one available pair (re-rolled otherwise). */
export function randomDigits(rng: Rng, count: number): number[] {
  let cells: number[] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    cells = Array.from({ length: count }, () => rng.int(1, 9));
    if (hasPair(cells)) return cells;
  }
  return cells;
}

export interface ChallengeConfig {
  /** Pairs inserted by the generator (the board starts with twice as many digits). */
  pairs: number;
  /** Probability of inserting a pair at a random position instead of appending it. */
  nesting: number;
  adds: number;
  hints: number;
}

export const MAX_CHALLENGE_PAIRS = 45;

export function challengeConfig(level: number): ChallengeConfig {
  const n = Math.max(1, Math.floor(level));
  return {
    pairs: Math.min(MAX_CHALLENGE_PAIRS, 9 + Math.ceil(n * 0.8)),
    nesting: Math.min(0.95, 0.25 + n * 0.02),
    adds: Math.max(1, 3 - Math.floor((n - 1) / 12)),
    hints: Math.max(1, 3 - Math.floor((n - 1) / 15)),
  };
}

export function challengeSeed(level: number): number {
  return hashString(`number-match:challenge:${level}`);
}

export interface ChallengeLayout {
  cells: number[];
  /** Insertion index of the pair each cell belongs to; removing pairs from the highest index down solves the board. */
  pairIds: number[];
}

export function generateChallenge(level: number): ChallengeLayout {
  const config = challengeConfig(level);
  const rng = new Rng(challengeSeed(level));
  const seq: Array<{ digit: number; pair: number }> = [];
  for (let p = 0; p < config.pairs; p++) {
    const a = rng.int(1, 9);
    const b = rng.bool(0.5) ? 10 - a : a;
    const [first, second] = rng.bool(0.5) ? [a, b] : [b, a];
    const at = rng.bool(config.nesting) ? rng.int(0, seq.length) : seq.length;
    seq.splice(at, 0, { digit: first, pair: p }, { digit: second, pair: p });
  }
  return { cells: seq.map((c) => c.digit), pairIds: seq.map((c) => c.pair) };
}
