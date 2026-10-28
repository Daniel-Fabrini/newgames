import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { CELLS, countClues, isCompleteSolution } from './grid';
import { DIFFICULTIES, DIFFICULTY_TIER, difficultyOfTier, digPuzzle, generatePuzzle, isDifficulty, type Difficulty } from './generator';
import { gradePuzzle, solvableWithin } from './logic';
import { countSolutions, solve } from './solver';

const SEEDS = [11, 2024, 987654321];

describe('difficulty helpers', () => {
  it('maps tiers to difficulties', () => {
    expect(difficultyOfTier(1)).toBe('easy');
    expect(difficultyOfTier(2)).toBe('medium');
    expect(difficultyOfTier(3)).toBe('hard');
    expect(difficultyOfTier(4)).toBe('expert');
    expect(difficultyOfTier(5)).toBe('expert');
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('insane')).toBe(false);
  });
});

describe.each(DIFFICULTIES)('generator: %s', (difficulty: Difficulty) => {
  const results = SEEDS.map((seed) => generatePuzzle(difficulty, seed));

  it('produces valid puzzles with a unique solution that matches the stored one', () => {
    for (const r of results) {
      expect(r.puzzle).toHaveLength(CELLS);
      expect(isCompleteSolution(r.solution)).toBe(true);
      r.puzzle.forEach((d, i) => d && expect(d).toBe(r.solution[i]));
      expect(countSolutions(r.puzzle)).toBe(1);
      expect(solve(r.puzzle)).toEqual(r.solution);
    }
  });

  it('grades exactly as requested (techniques, not only clue count)', () => {
    for (const r of results) {
      expect(r.exact).toBe(true);
      expect(r.grade).toBe(difficulty);
      const g = gradePuzzle(r.puzzle);
      expect(difficultyOfTier(g.tier)).toBe(difficulty);
      const tier = DIFFICULTY_TIER[difficulty];
      if (tier > 1) expect(solvableWithin(r.puzzle, tier - 1)).toBe(false);
      if (tier < 4) expect(solvableWithin(r.puzzle, tier)).toBe(true);
    }
  });

  it('uses rotational symmetry and sensible clue counts', () => {
    for (const r of results) {
      for (let i = 0; i < CELLS; i++) expect(r.puzzle[i] === 0).toBe(r.puzzle[CELLS - 1 - i] === 0);
      const clues = countClues(r.puzzle);
      expect(clues).toBe(r.clues);
      expect(clues).toBeGreaterThanOrEqual(17);
      if (difficulty === 'easy') expect(clues).toBeGreaterThanOrEqual(34);
      else expect(clues).toBeLessThanOrEqual(36);
    }
  });

  it('is deterministic for a seed', () => {
    const again = generatePuzzle(difficulty, SEEDS[0]!);
    expect(again.puzzle).toEqual(results[0]!.puzzle);
    expect(again.solution).toEqual(results[0]!.solution);
    expect(new Set(results.map((r) => r.puzzle.join(''))).size).toBe(SEEDS.length);
  });
});

describe('generator budget and fallback', () => {
  it('easy succeeds on the first attempt', () => {
    for (const seed of SEEDS) expect(generatePuzzle('easy', seed).attempts).toBe(1);
  });

  it('falls back to the closest grade when the attempt budget runs out', () => {
    // Find a seed whose first hard attempt does not grade as hard.
    let seed = 1;
    while (difficultyOfTier(digPuzzle('hard', new Rng(seed)).tier) === 'hard') seed++;
    const r = generatePuzzle('hard', seed, { maxAttempts: 1 });
    expect(r.attempts).toBe(1);
    expect(r.exact).toBe(false);
    expect(r.grade).not.toBe('hard');
    // Still a valid, unique puzzle.
    expect(countSolutions(r.puzzle)).toBe(1);
  });

  it('stops when the time budget is exhausted', () => {
    let t = 0;
    const clock = () => (t += 1000);
    let seed = 1;
    while (difficultyOfTier(digPuzzle('expert', new Rng(seed)).tier) === 'expert') seed++;
    const r = generatePuzzle('expert', seed, { timeBudgetMs: 500, now: clock });
    expect(r.attempts).toBe(1);
    expect(r.exact).toBe(false);
  });
});
