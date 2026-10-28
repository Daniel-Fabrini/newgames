import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import {
  applyAction,
  bestRoundPoints,
  dealRound,
  findOpening,
  hasActed,
  isBlocked,
  legalActions,
  lineEnds,
  newMatch,
  nextRound,
  placeTile,
  playableTiles,
  restartRound,
  roundFromDeal,
  scoreRound,
  type Action,
  type MatchConfig,
  type MatchState,
  type Placed,
  type RoundState,
  type Seat,
} from './engine';
import { ALL_TILES, TILES, TILE_COUNT, handPips, pipsOf, tileId as t } from './tiles';

const AI_100: MatchConfig = { mode: 'ai', difficulty: 'medium', length: 100 };

function matchWith(round: RoundState, extra: Partial<MatchState> = {}, config: MatchConfig = AI_100): MatchState {
  return { config, scores: [0, 0], rounds: [], round, roundNo: 1, rng: 1, over: false, winner: null, ...extra };
}

/** A mid-round state with an explicit table (tile bookkeeping is not needed by the rules). */
function midRound(line: Placed[], hand0: number[], hand1: number[], boneyard: number[], turn: Seat): RoundState {
  return { hands: [hand0, hand1], boneyard, line, origin: 0, starter: 0, opening: line[0]?.tile ?? 0, turn, log: [], result: null };
}

const placed = (a: number, b: number): Placed => ({ tile: t(a, b), left: a, right: b });

function rest(...used: number[][]): number[] {
  const taken = new Set(used.flat());
  return ALL_TILES.filter((x) => !taken.has(x));
}

/** Plays random legal actions until the round ends. */
function playOutRandom(match: MatchState, rng: Rng): MatchState {
  let m = match;
  for (let i = 0; i < 200 && !m.round.result; i++) {
    const action = rng.pick(legalActions(m.round));
    const next = applyAction(m, action);
    if (!next) throw new Error('legal action rejected');
    m = next;
  }
  return m;
}

describe('domino set and deal', () => {
  it('has the 28 double-six tiles exactly once', () => {
    expect(TILES).toHaveLength(28);
    const keys = new Set(TILES.map(([a, b]) => `${a}-${b}`));
    expect(keys.size).toBe(28);
    expect(TILES.every(([a, b]) => a <= b && a >= 0 && b <= 6)).toBe(true);
  });

  it('deals 7 tiles to each player and leaves 14 face down', () => {
    const r = dealRound(new Rng(5));
    expect(r.hands[0]).toHaveLength(7);
    expect(r.hands[1]).toHaveLength(7);
    expect(r.boneyard).toHaveLength(14);
    const all = [...r.hands[0], ...r.hands[1], ...r.boneyard];
    expect(new Set(all).size).toBe(TILE_COUNT);
    expect(r.line).toEqual([]);
  });

  it('is deterministic for a seed and different across seeds', () => {
    expect(dealRound(new Rng(9))).toEqual(dealRound(new Rng(9)));
    expect(dealRound(new Rng(9)).hands).not.toEqual(dealRound(new Rng(10)).hands);
  });

  it('stores the RNG state so the next round continues the sequence', () => {
    const m = newMatch(AI_100, 42);
    expect(m.rng).not.toBe(42);
    expect(newMatch(AI_100, 42)).toEqual(m);
  });
});

describe('starting player rule', () => {
  it('the highest double opens, whoever holds it', () => {
    const h0 = [t(5, 5), t(0, 1), t(0, 2), t(0, 3), t(0, 4), t(0, 5), t(0, 6)];
    const h1 = [t(6, 6), t(1, 2), t(1, 3), t(1, 4), t(1, 5), t(1, 6), t(2, 3)];
    expect(findOpening([h0, h1])).toEqual({ seat: 1, tile: t(6, 6) });
    const h1b = [t(4, 4), t(1, 2), t(1, 3), t(1, 4), t(1, 5), t(1, 6), t(2, 3)];
    expect(findOpening([h0, h1b])).toEqual({ seat: 0, tile: t(5, 5) });
  });

  it('without doubles, the heaviest tile opens (ties broken by the higher number)', () => {
    const h0 = [t(5, 4), t(0, 1), t(0, 2)];
    const h1 = [t(6, 3), t(1, 2), t(0, 3)];
    expect(findOpening([h0, h1])).toEqual({ seat: 1, tile: t(6, 3) });
    expect(findOpening([[t(6, 5)], [t(6, 4)]])).toEqual({ seat: 0, tile: t(6, 5) });
  });

  it('the starter must play that tile first and nothing else is legal', () => {
    const h0 = [t(5, 5), t(0, 1), t(0, 2), t(0, 3), t(0, 4), t(0, 5), t(0, 6)];
    const h1 = [t(6, 6), t(1, 2), t(1, 3), t(1, 4), t(1, 5), t(1, 6), t(2, 3)];
    const round = roundFromDeal([h0, h1], rest(h0, h1));
    expect(round.turn).toBe(1);
    expect(round.opening).toBe(t(6, 6));
    expect(legalActions(round)).toEqual([{ type: 'play', tile: t(6, 6), end: 'left' }]);
    const m = matchWith(round);
    expect(applyAction(m, { type: 'play', tile: t(1, 6), end: 'left' })).toBeNull();
    expect(applyAction(m, { type: 'draw' })).toBeNull();
    const after = applyAction(m, { type: 'play', tile: t(6, 6), end: 'right' });
    expect(after?.round.line).toEqual([{ tile: t(6, 6), left: 6, right: 6 }]);
    expect(after?.round.turn).toBe(0);
    expect(after?.round.log[0]).toEqual({ kind: 'play', seat: 1, tile: t(6, 6), end: 'first' });
  });

  it('applies the same rule to every round of a match', () => {
    let m = newMatch({ ...AI_100, length: 150 }, 7);
    const rng = new Rng(3);
    for (let i = 0; i < 4 && !m.over; i++) {
      expect(findOpening(m.round.hands)).toEqual({ seat: m.round.starter, tile: m.round.opening });
      m = playOutRandom(m, rng);
      if (!m.over) m = nextRound(m) as MatchState;
    }
  });
});

describe('placing tiles', () => {
  it('a tile matching both ends can go on either side, oriented so halves match', () => {
    const both = midRound([placed(3, 4), placed(4, 5)], [t(3, 5)], [t(0, 0)], [], 0);
    expect(playableTiles(both).get(t(3, 5))).toEqual(['left', 'right']);
    const left = placeTile(both.line, t(3, 5), 'left');
    expect(left.line[0]).toEqual({ tile: t(3, 5), left: 5, right: 3 });
    expect(left.prepended).toBe(true);
    expect(lineEnds(left.line)).toEqual([5, 5]);
    const right = placeTile(both.line, t(3, 5), 'right');
    expect(right.line[2]).toEqual({ tile: t(3, 5), left: 5, right: 3 });
    expect(lineEnds(right.line)).toEqual([3, 3]);
    expect(legalActions(both)).toEqual([
      { type: 'play', tile: t(3, 5), end: 'left' },
      { type: 'play', tile: t(3, 5), end: 'right' },
    ]);
  });

  it('rejects a tile on an end it does not match', () => {
    const r = midRound([placed(3, 4)], [t(4, 6), t(1, 2)], [t(0, 0)], [t(2, 2)], 0);
    const m = matchWith(r);
    expect(applyAction(m, { type: 'play', tile: t(4, 6), end: 'left' })).toBeNull();
    expect(applyAction(m, { type: 'play', tile: t(1, 2), end: 'right' })).toBeNull();
    const ok = applyAction(m, { type: 'play', tile: t(4, 6), end: 'right' });
    expect(lineEnds(ok!.round.line)).toEqual([3, 6]);
    expect(ok!.round.turn).toBe(1);
  });

  it('a double keeps the same number on the open end and keeps the origin index in sync', () => {
    const r = midRound([placed(2, 4)], [t(2, 2), t(0, 6)], [t(1, 1)], [t(5, 5)], 0);
    const m = applyAction(matchWith(r), { type: 'play', tile: t(2, 2), end: 'left' })!;
    expect(m.round.line[0]).toEqual({ tile: t(2, 2), left: 2, right: 2 });
    expect(lineEnds(m.round.line)).toEqual([2, 4]);
    expect(m.round.origin).toBe(1);
    expect(m.round.line[m.round.origin]?.tile).toBe(t(2, 4));
  });

  it('every placed line keeps touching halves equal through random games', () => {
    const rng = new Rng(11);
    for (let g = 0; g < 30; g++) {
      const m = playOutRandom(newMatch(AI_100, 1000 + g), rng);
      const line = m.round.line;
      for (let i = 1; i < line.length; i++) expect(line[i - 1]!.right).toBe(line[i]!.left);
      for (const p of line) expect([p.left, p.right].sort()).toEqual([...pipsOf(p.tile)].sort());
      const all = [...m.round.hands[0], ...m.round.hands[1], ...m.round.boneyard, ...line.map((p) => p.tile)];
      expect(new Set(all).size).toBe(28);
    }
  });
});

describe('forced draw and pass', () => {
  const h0 = [t(6, 6), t(0, 0), t(0, 1), t(0, 2), t(0, 3), t(0, 4), t(0, 5)];
  const h1 = [t(1, 1), t(1, 2), t(1, 3), t(1, 4), t(1, 5), t(2, 2), t(2, 3)];

  function opened(): MatchState {
    const bone = [t(2, 4), t(2, 5), t(1, 6), ...rest(h0, h1, [t(2, 4), t(2, 5), t(1, 6)])];
    const m = matchWith(roundFromDeal([h0, h1], bone));
    return applyAction(m, { type: 'play', tile: t(6, 6), end: 'left' })!;
  }

  it('without a playable tile the only legal action is to draw', () => {
    const m = opened();
    expect(m.round.turn).toBe(1);
    expect(legalActions(m.round)).toEqual([{ type: 'draw' }]);
    expect(applyAction(m, { type: 'pass' })).toBeNull();
    expect(applyAction(m, { type: 'play', tile: t(1, 1), end: 'left' })).toBeNull();
  });

  it('draws one tile at a time until one fits, then must play (no more drawing)', () => {
    let m = opened();
    m = applyAction(m, { type: 'draw' })!;
    expect(m.round.hands[1]).toContain(t(2, 4));
    expect(m.round.turn).toBe(1);
    expect(m.round.boneyard).toHaveLength(13);
    m = applyAction(m, { type: 'draw' })!;
    expect(legalActions(m.round)).toEqual([{ type: 'draw' }]);
    m = applyAction(m, { type: 'draw' })!;
    expect(m.round.hands[1]).toContain(t(1, 6));
    expect(applyAction(m, { type: 'draw' })).toBeNull();
    expect(legalActions(m.round).every((a) => a.type === 'play' && a.tile === t(1, 6))).toBe(true);
    // Draws are logged publicly with the ends faced, never with the tile drawn.
    const draws = m.round.log.filter((e) => e.kind === 'draw');
    expect(draws).toHaveLength(3);
    expect(draws[0]).toEqual({ kind: 'draw', seat: 1, ends: [6, 6] });
    expect(JSON.stringify(draws)).not.toContain('tile');
  });

  it('with an empty boneyard and no playable tile the player passes', () => {
    const others = rest([t(6, 6)], [t(0, 6), t(1, 6), t(2, 6), t(3, 6), t(4, 6), t(5, 6)]);
    const h1Pass = others.slice(0, 10);
    const h0Pass = [t(0, 6), t(1, 6), t(2, 6), t(3, 6), t(4, 6), t(5, 6), ...others.slice(10)];
    const r = midRound([placed(6, 6)], h0Pass, h1Pass, [], 1);
    const m = matchWith(r);
    expect(legalActions(r)).toEqual([{ type: 'pass' }]);
    expect(applyAction(m, { type: 'draw' })).toBeNull();
    const after = applyAction(m, { type: 'pass' })!;
    expect(after.round.turn).toBe(0);
    expect(after.round.result).toBeNull();
    expect(after.round.log.at(-1)).toEqual({ kind: 'pass', seat: 1, ends: [6, 6] });
    // Passing is not allowed while holding a playable tile.
    expect(applyAction(after, { type: 'pass' })).toBeNull();
  });
});

describe('round end and scoring', () => {
  it('domino: playing the last tile wins and scores the pips left in the opponent hand', () => {
    const r = midRound([placed(5, 5)], [t(0, 5)], [t(2, 2), t(3, 4)], [t(1, 1)], 0);
    const m = applyAction(matchWith(r), { type: 'play', tile: t(0, 5), end: 'right' })!;
    expect(m.round.result).toEqual({ winner: 0, reason: 'domino', points: 11, pips: [0, 11] });
    expect(m.scores).toEqual([11, 0]);
    expect(m.rounds).toHaveLength(1);
    expect(m.rounds[0]?.hands[1]).toEqual([t(2, 2), t(3, 4)]);
    expect(m.over).toBe(false);
    expect(applyAction(m, { type: 'draw' })).toBeNull();
  });

  it('blocked: the lower pip total wins and scores the opponent pips', () => {
    const r = midRound([placed(5, 5)], [t(0, 5), t(1, 1)], [t(2, 2), t(3, 4)], [], 0);
    const m = applyAction(matchWith(r), { type: 'play', tile: t(0, 5), end: 'right' })!;
    expect(isBlocked(m.round)).toBe(true);
    expect(m.round.result).toEqual({ winner: 0, reason: 'blocked', points: 11, pips: [2, 11] });
    expect(m.scores).toEqual([11, 0]);
  });

  it('blocked with higher pips loses', () => {
    expect(scoreRound([[t(6, 6)], [t(1, 2)]], null)).toEqual({ winner: 1, reason: 'blocked', points: 12, pips: [12, 3] });
  });

  it('blocked with equal totals is a drawn round worth no points', () => {
    const r = midRound([placed(5, 5)], [t(0, 5), t(1, 3)], [t(2, 2)], [], 0);
    const m = applyAction(matchWith(r), { type: 'play', tile: t(0, 5), end: 'left' })!;
    expect(m.round.result).toEqual({ winner: null, reason: 'blocked', points: 0, pips: [4, 4] });
    expect(m.scores).toEqual([0, 0]);
    expect(m.over).toBe(false);
  });

  it('is not blocked while the boneyard still has tiles (players must draw)', () => {
    const r = midRound([placed(5, 5)], [t(1, 1)], [t(2, 2)], [t(3, 3)], 0);
    expect(isBlocked(r)).toBe(false);
    expect(legalActions(r)).toEqual([{ type: 'draw' }]);
  });

  it('a draw that empties the boneyard can block the game', () => {
    const r = midRound([placed(5, 5), placed(5, 0)], [t(1, 1)], [t(2, 2)], [t(3, 3)], 0);
    const m = applyAction(matchWith(r), { type: 'draw' })!;
    expect(m.round.result?.reason).toBe('blocked');
    expect(m.round.result?.pips).toEqual([8, 4]);
    expect(m.round.result?.winner).toBe(1);
  });

  it('random rounds always end with a consistent result', () => {
    const rng = new Rng(77);
    for (let g = 0; g < 60; g++) {
      const m = playOutRandom(newMatch(AI_100, g), rng);
      const res = m.round.result!;
      expect(res).not.toBeNull();
      expect(res.pips).toEqual([handPips(m.round.hands[0]), handPips(m.round.hands[1])]);
      if (res.reason === 'domino') expect(m.round.hands[res.winner!]).toHaveLength(0);
      else expect(isBlocked(m.round)).toBe(true);
    }
  });
});

describe('match flow', () => {
  const finishing = (config: MatchConfig, scores: [number, number], hand1: number[]) =>
    matchWith(midRound([placed(5, 5)], [t(0, 5)], hand1, [t(1, 1)], 0), { scores, rounds: [] }, config);

  it('reaching the target wins the match', () => {
    const before = finishing(AI_100, [0, 0], [t(6, 6), t(3, 4)]);
    // Pretend previous rounds gave 95 points.
    const m = applyAction({ ...before, scores: [95, 0] }, { type: 'play', tile: t(0, 5), end: 'left' })!;
    expect(m.scores[0]).toBe(114);
    expect(m.over).toBe(true);
    expect(m.winner).toBe(0);
    expect(nextRound(m)).toBeNull();
  });

  it('below the target the match continues with a new deal', () => {
    const m = applyAction(finishing(AI_100, [0, 0], [t(1, 2)]), { type: 'play', tile: t(0, 5), end: 'left' })!;
    expect(m.over).toBe(false);
    const n = nextRound(m)!;
    expect(n.roundNo).toBe(2);
    expect(n.round.result).toBeNull();
    expect(n.round.line).toEqual([]);
    expect(n.scores).toEqual([3, 0]);
    expect(n.rng).not.toBe(m.rng);
  });

  it('single round: the round result is the match result, including draws', () => {
    const single: MatchConfig = { mode: 'ai', difficulty: 'easy', length: 'single' };
    const win = applyAction(finishing(single, [0, 0], [t(1, 2)]), { type: 'play', tile: t(0, 5), end: 'left' })!;
    expect(win.over).toBe(true);
    expect(win.winner).toBe(0);
    const tie = matchWith(midRound([placed(5, 5)], [t(0, 5), t(1, 3)], [t(2, 2)], [], 0), {}, single);
    const drawn = applyAction(tie, { type: 'play', tile: t(0, 5), end: 'left' })!;
    expect(drawn.over).toBe(true);
    expect(drawn.winner).toBeNull();
  });

  it('plays complete matches to the target', () => {
    const rng = new Rng(5);
    for (const length of [50, 100] as const) {
      let m = newMatch({ ...AI_100, length }, 99);
      for (let i = 0; i < 100 && !m.over; i++) {
        m = playOutRandom(m, rng);
        if (!m.over) m = nextRound(m)!;
      }
      expect(m.over).toBe(true);
      expect(Math.max(...m.scores)).toBeGreaterThanOrEqual(length);
      expect(m.scores[m.winner!]).toBeGreaterThanOrEqual(length);
      expect(m.rounds.reduce((s, r) => s + r.points, 0)).toBe(m.scores[0] + m.scores[1]);
    }
  });

  it('restarting a round re-deals but keeps the score', () => {
    const m = { ...newMatch(AI_100, 3), scores: [20, 10] as [number, number] };
    const r = restartRound(m)!;
    expect(r.scores).toEqual([20, 10]);
    expect(r.round.hands).not.toEqual(m.round.hands);
    expect(r.roundNo).toBe(1);
  });

  it('tracks whether a player has acted and the best round', () => {
    const m = newMatch(AI_100, 3);
    expect(hasActed(m, 0)).toBe(false);
    const won = applyAction(finishing(AI_100, [0, 0], [t(6, 6)]), { type: 'play', tile: t(0, 5), end: 'left' })!;
    expect(hasActed(won, 0)).toBe(true);
    expect(bestRoundPoints(won, 0)).toBe(12);
    expect(bestRoundPoints(won, 1)).toBe(0);
  });

  it('rejects any action after the match is over', () => {
    const single: MatchConfig = { mode: '2p', difficulty: 'easy', length: 'single' };
    const over = applyAction(finishing(single, [0, 0], [t(1, 2)]), { type: 'play', tile: t(0, 5), end: 'left' })!;
    const actions: Action[] = [{ type: 'draw' }, { type: 'pass' }];
    for (const a of actions) expect(applyAction(over, a)).toBeNull();
    expect(restartRound(over)).toBeNull();
  });
});
