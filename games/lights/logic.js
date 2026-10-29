// Pure Light Echo logic (no DOM): deterministic seeded sequence, tempo curve, scoring, run state.

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MODES = {
  classic: { pads: 4, on: 620, gap: 250, minOn: 300, minGap: 110, every: 4, mult: 1 },
  fast: { pads: 4, on: 420, gap: 170, minOn: 190, minGap: 70, every: 3, mult: 1.25 },
  expert: { pads: 6, on: 560, gap: 210, minOn: 260, minGap: 90, every: 4, mult: 1.5 },
};
export const LIVES = { relaxed: 3, strict: 1 };

/** The pad at position i of the sequence for a seed (independent of other positions). */
export function padAt(seed, pads, i) {
  return Math.floor(mulberry((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0)() * pads);
}
export function sequence(seed, pads, len) {
  return Array.from({ length: len }, (_, i) => padAt(seed, pads, i));
}

/** Milliseconds a pad stays lit and the gap between lights at a given round (1-based). */
export function timing(mode, round) {
  const m = MODES[mode];
  const step = Math.floor((round - 1) / m.every);
  const k = Math.pow(0.92, step);
  return { on: Math.max(m.minOn, Math.round(m.on * k)), gap: Math.max(m.minGap, Math.round(m.gap * k)), step };
}

export function roundScore(mode, round, streak) {
  return Math.floor((10 * round + 5 * Math.min(streak, 20)) * MODES[mode].mult);
}

/** Compare the player's idx-th press with the sequence. */
export function judge(seq, idx, pad) {
  if (seq[idx] !== pad) return 'wrong';
  return idx === seq.length - 1 ? 'complete' : 'next';
}

export function createRun({ mode = 'classic', strict = false, seed = 1 } = {}) {
  const m = MODES[mode];
  const run = {
    mode,
    strict,
    seed,
    pads: m.pads,
    round: 1,
    idx: 0,
    lives: strict ? LIVES.strict : LIVES.relaxed,
    streak: 0,
    bestStreak: 0,
    score: 0,
    status: 'playing', // playing | over
    seq() {
      return sequence(seed, m.pads, run.round);
    },
    timing() {
      return timing(mode, run.round);
    },
    /** Rounds fully repeated so far. */
    get completed() {
      return run.round - 1;
    },
    press(pad) {
      if (run.status !== 'playing') return { result: 'over' };
      const r = judge(run.seq(), run.idx, pad);
      if (r === 'next') {
        run.idx++;
        return { result: 'ok' };
      }
      if (r === 'complete') {
        const points = roundScore(mode, run.round, run.streak);
        run.score += points;
        run.streak++;
        run.bestStreak = Math.max(run.bestStreak, run.streak);
        run.round++;
        run.idx = 0;
        return { result: 'round', points };
      }
      run.lives--;
      run.streak = 0;
      run.idx = 0;
      if (run.lives <= 0) {
        run.status = 'over';
        return { result: 'over' };
      }
      return { result: 'retry' };
    },
  };
  return run;
}
