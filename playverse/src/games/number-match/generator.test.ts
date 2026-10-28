import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { newChallenge, removePair } from './engine';
import { challengeConfig, classicDigitCount, generateChallenge, randomDigits } from './generator';
import { connection, digitsMatch, hasPair, isDigit, removeRows } from './match';

const LEVELS = Array.from({ length: 40 }, (_, i) => i + 1);

/** Replays the construction in reverse through the real engine, tracking each cell's pair id across row removals. */
function solveByConstruction(level: number) {
  const layout = generateChallenge(level);
  let state = newChallenge(level);
  let ids = layout.pairIds.slice();
  const pairs = Math.max(...ids) + 1;
  for (let p = pairs - 1; p >= 0; p--) {
    const a = ids.indexOf(p);
    const b = ids.lastIndexOf(p);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    // Everything between the two halves was inserted later, so it is already cleared.
    expect(connection(state.cells, a, b)).not.toBe(null);
    const r = removePair(state, a, b);
    if (!r.ok) throw new Error(`level ${level}: pair ${p} not removable (${r.reason})`);
    ids[a] = -1;
    ids[b] = -1;
    ids = removeRows(ids, r.rowsRemoved);
    state = r.state;
    expect(ids).toHaveLength(state.cells.length);
  }
  return state;
}

/** Average number of pairs enclosing each pair (how nested the construction is). */
function averageDepth(pairIds: number[]): number {
  const open = new Set<number>();
  let total = 0;
  let pairs = 0;
  for (const id of pairIds) {
    if (open.has(id)) {
      open.delete(id);
    } else {
      total += open.size;
      pairs++;
      open.add(id);
    }
  }
  return total / pairs;
}

describe('challenge generator', () => {
  it('builds boards of matching pairs (levels 1–40)', () => {
    for (const level of LEVELS) {
      const { cells, pairIds } = generateChallenge(level);
      expect(cells).toHaveLength(challengeConfig(level).pairs * 2);
      expect(cells.every(isDigit)).toBe(true);
      expect(hasPair(cells)).toBe(true);
      for (let p = 0; p < cells.length / 2; p++) {
        const a = pairIds.indexOf(p);
        const b = pairIds.lastIndexOf(p);
        expect(b).not.toBe(a);
        expect(digitsMatch(cells[a], cells[b])).toBe(true);
      }
    }
  });

  it('every level 1–40 is solvable without additions or hints (replaying the solution)', () => {
    for (const level of LEVELS) {
      const end = solveByConstruction(level);
      expect(end.status).toBe('cleared');
      expect(end.cells).toEqual([]);
      expect(end.addsUsed).toBe(0);
      expect(end.hintsUsed).toBe(0);
      expect(end.pairsCleared).toBe(challengeConfig(level).pairs);
    }
  });

  it('is deterministic and every level is different', () => {
    expect(generateChallenge(12)).toEqual(generateChallenge(12));
    const boards = new Set(LEVELS.map((l) => generateChallenge(l).cells.join('')));
    expect(boards.size).toBe(LEVELS.length);
  });

  it('gets harder: more pairs, deeper nesting, fewer additions and hints', () => {
    for (let level = 2; level <= 60; level++) {
      const prev = challengeConfig(level - 1);
      const cur = challengeConfig(level);
      expect(cur.pairs).toBeGreaterThanOrEqual(prev.pairs);
      expect(cur.nesting).toBeGreaterThanOrEqual(prev.nesting);
      expect(cur.adds).toBeLessThanOrEqual(prev.adds);
      expect(cur.hints).toBeLessThanOrEqual(prev.hints);
      expect(cur.adds).toBeGreaterThanOrEqual(1);
      expect(cur.hints).toBeGreaterThanOrEqual(1);
    }
    expect(challengeConfig(1)).toMatchObject({ pairs: 10, adds: 3, hints: 3 });
    expect(challengeConfig(40)).toMatchObject({ pairs: 41, adds: 1, hints: 1 });
    const early = LEVELS.slice(0, 5).map((l) => averageDepth(generateChallenge(l).pairIds));
    const late = LEVELS.slice(35).map((l) => averageDepth(generateChallenge(l).pairIds));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(late)).toBeGreaterThan(mean(early) * 2);
  });

  it('handles levels beyond 40 (unbounded campaign)', () => {
    const s = newChallenge(250);
    expect(s.cells.length).toBe(challengeConfig(250).pairs * 2);
    expect(solveByConstruction(250).status).toBe('cleared');
  });
});

describe('classic generator', () => {
  it('produces seeded random digits with at least one pair', () => {
    const rng = new Rng(5);
    for (let n = 0; n < 100; n++) {
      const cells = randomDigits(rng, classicDigitCount(1 + (n % 12)));
      expect(cells.every(isDigit)).toBe(true);
      expect(hasPair(cells)).toBe(true);
    }
    expect(randomDigits(new Rng(77), 27)).toEqual(randomDigits(new Rng(77), 27));
  });
});
