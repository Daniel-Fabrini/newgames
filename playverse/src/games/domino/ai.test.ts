import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { chooseAction, inferMissing, legalFromView, scorePlay, unseenTiles, viewFor, type PlayerView } from './ai';
import { DIFFICULTIES, applyAction, isLegal, legalActions, newMatch, nextRound, type LogEntry, type MatchState, type Placed, type RoundState } from './engine';
import { sortTiles, tileId as t } from './tiles';

const CONFIG = { mode: 'ai', difficulty: 'hard', length: 100 } as const;

/** Advances a fresh match with random legal moves for `steps` actions (or until the round ends). */
function advance(seed: number, steps: number): MatchState {
  const rng = new Rng(seed * 7 + 1);
  let m = newMatch(CONFIG, seed);
  for (let i = 0; i < steps && !m.round.result; i++) m = applyAction(m, rng.pick(legalActions(m.round)))!;
  return m;
}

/** Reassigns the tiles hidden from `seat` (opponent hand + boneyard) keeping their counts. */
function permuteHidden(round: RoundState, seat: 0 | 1, seed: number): RoundState {
  const opp = seat === 0 ? 1 : 0;
  const pool = new Rng(seed).shuffle([...round.hands[opp], ...round.boneyard]);
  const oppHand = sortTiles(pool.slice(0, round.hands[opp].length));
  const boneyard = pool.slice(round.hands[opp].length);
  const hands: [number[], number[]] = seat === 0 ? [round.hands[0], oppHand] : [oppHand, round.hands[1]];
  return { ...round, hands, boneyard };
}

describe('AI view (public information only)', () => {
  it('contains the own hand, the table, counts and the public log — nothing else', () => {
    const m = advance(3, 9);
    const view = viewFor(m.round, 1);
    expect(Object.keys(view).sort()).toEqual(['boneyardCount', 'hand', 'line', 'log', 'mustOpen', 'opponentCount', 'seat']);
    expect(view.hand).toEqual(m.round.hands[1]);
    expect(view.boneyardCount).toBe(m.round.boneyard.length);
    expect(view.opponentCount).toBe(m.round.hands[0].length);
    const hidden = new Set([...m.round.hands[0], ...m.round.boneyard]);
    expect(view.hand.some((x) => hidden.has(x))).toBe(false);
    expect(view.line.some((p) => hidden.has(p.tile))).toBe(false);
    for (const e of view.log) if (e.kind !== 'play') expect(Object.keys(e).sort()).toEqual(['ends', 'kind', 'seat']);
  });

  it('is a copy: mutating it does not touch the game state', () => {
    const m = advance(4, 5);
    const view = viewFor(m.round, 1) as unknown as { hand: number[]; line: Placed[] };
    view.hand.push(99);
    view.line.pop();
    expect(m.round.hands[1]).not.toContain(99);
    expect(viewFor(m.round, 1).line).toHaveLength(m.round.line.length);
  });

  it('is identical, and so is every decision, when the hidden tiles are permuted', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const m = advance(seed, seed % 23);
      if (m.round.result) continue;
      const seat = m.round.turn;
      const view = viewFor(m.round, seat);
      for (let k = 0; k < 3; k++) {
        const permuted = permuteHidden(m.round, seat, seed * 31 + k);
        const other = viewFor(permuted, seat);
        expect(other).toEqual(view);
        for (const difficulty of DIFFICULTIES) {
          const a = chooseAction(view, difficulty, new Rng(seed));
          const b = chooseAction(other, difficulty, new Rng(seed));
          expect(b).toEqual(a);
        }
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe('AI decisions', () => {
  it('always picks a legal action, for every difficulty, over complete matches', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let g = 0; g < 6; g++) {
        let m = newMatch({ ...CONFIG, difficulty, length: 50 }, 500 + g);
        const rng = new Rng(g);
        for (let guard = 0; guard < 2000 && !m.over; guard++) {
          if (m.round.result) {
            m = nextRound(m)!;
            continue;
          }
          const action = chooseAction(viewFor(m.round, m.round.turn), difficulty, rng);
          expect(action).not.toBeNull();
          expect(isLegal(m.round, action!)).toBe(true);
          m = applyAction(m, action!)!;
          expect(m).not.toBeNull();
        }
        expect(m.over).toBe(true);
      }
    }
  });

  it('only draws or passes when forced', () => {
    const view: PlayerView = {
      seat: 1,
      hand: [t(1, 1), t(2, 3)],
      line: [{ tile: t(6, 6), left: 6, right: 6 }],
      mustOpen: null,
      boneyardCount: 4,
      opponentCount: 6,
      log: [],
    };
    expect(chooseAction(view, 'hard', new Rng(1))).toEqual({ type: 'draw' });
    expect(chooseAction({ ...view, boneyardCount: 0 }, 'easy', new Rng(1))).toEqual({ type: 'pass' });
    const canPlay = { ...view, hand: [t(1, 6), t(2, 3)] };
    expect(chooseAction(canPlay, 'easy', new Rng(1))).toMatchObject({ type: 'play', tile: t(1, 6) });
  });

  it('opens with the forced tile', () => {
    const view: PlayerView = { seat: 0, hand: [t(6, 6), t(0, 1)], line: [], mustOpen: t(6, 6), boneyardCount: 14, opponentCount: 7, log: [] };
    expect(legalFromView(view)).toEqual([{ type: 'play', tile: t(6, 6), end: 'left' }]);
    expect(chooseAction(view, 'medium', new Rng(2))).toEqual({ type: 'play', tile: t(6, 6), end: 'left' });
  });

  it('medium plays the heaviest tile, favouring doubles', () => {
    const base: PlayerView = {
      seat: 1,
      hand: [t(3, 1), t(3, 6), t(3, 3)],
      line: [{ tile: t(3, 4), left: 3, right: 4 }],
      mustOpen: null,
      boneyardCount: 5,
      opponentCount: 5,
      log: [],
    };
    // 6|3 (9 pips) beats 3|3 (6 pips + double bonus 2).
    expect(chooseAction(base, 'medium', new Rng(1))).toMatchObject({ tile: t(3, 6) });
    const withDouble = { ...base, hand: [t(3, 1), t(4, 4), t(3, 5)] };
    // 4|4 (8 + 2) is preferred over 5|3 (8).
    expect(chooseAction(withDouble, 'medium', new Rng(1))).toMatchObject({ tile: t(4, 4) });
  });

  it('infers missing numbers from public draws and passes', () => {
    const log: LogEntry[] = [
      { kind: 'play', seat: 0, tile: t(6, 6), end: 'first' },
      { kind: 'draw', seat: 1, ends: [6, 6] },
      { kind: 'play', seat: 1, tile: t(6, 2), end: 'right' },
      { kind: 'pass', seat: 0, ends: [6, 2] },
    ];
    expect([...inferMissing(log, 1)]).toEqual([6]);
    expect([...inferMissing(log, 0)].sort()).toEqual([2, 6]);
    // A later draw brings unknown tiles: only the newly faced ends are certain.
    const later: LogEntry[] = [...log, { kind: 'draw', seat: 0, ends: [3, 2] }];
    expect([...inferMissing(later, 0)].sort()).toEqual([2, 3]);
  });

  it('hard blocks numbers the opponent lacks and avoids ends the opponent probably holds', () => {
    const view: PlayerView = {
      seat: 1,
      hand: [t(6, 2), t(6, 5)],
      line: [{ tile: t(4, 6), left: 4, right: 6 }],
      mustOpen: null,
      boneyardCount: 8,
      opponentCount: 6,
      // The opponent drew while facing 4 and 2: they hold neither.
      log: [{ kind: 'draw', seat: 0, ends: [4, 2] }],
    };
    const missing = inferMissing(view.log, 0);
    expect([...missing].sort()).toEqual([2, 4]);
    // 6|2 leaves (4, 2): both ends unplayable for the opponent, even though 6|5 is heavier.
    expect(chooseAction(view, 'hard', new Rng(1))).toEqual({ type: 'play', tile: t(6, 2), end: 'right' });
    // Medium only looks at weight.
    expect(chooseAction(view, 'medium', new Rng(1))).toEqual({ type: 'play', tile: t(6, 5), end: 'right' });

    const unseen = unseenTiles(view);
    const play = { type: 'play', tile: t(6, 5), end: 'right' } as const;
    expect(scorePlay(view, play, unseen, new Set([5]))).toBeGreaterThan(scorePlay(view, play, unseen, new Set()));
    // Counting tiles: if no unseen tile has a 5, opening a 5 is safe.
    const fives = new Set([t(5, 0), t(5, 1), t(5, 2), t(5, 3), t(5, 4), t(5, 5)]);
    const no5 = unseen.filter((x) => !fives.has(x));
    expect(scorePlay(view, play, no5, new Set())).toBeGreaterThan(scorePlay(view, play, unseen, new Set()));
  });

  it('hard plays the endgame optimally once the boneyard is empty (deduces the opponent hand)', () => {
    /** Exact value of the rest of the round for `me`, by brute force over the real engine. */
    const value = (m: MatchState, me: 0 | 1): number => {
      const res = m.round.result;
      if (res) return res.winner === null ? 0 : res.winner === me ? res.points : -res.points;
      const outcomes = legalActions(m.round).map((a) => value(applyAction(m, a)!, me));
      return m.round.turn === me ? Math.max(...outcomes) : Math.min(...outcomes);
    };
    let checked = 0;
    for (let seed = 1; seed <= 300 && checked < 25; seed++) {
      let m = newMatch(CONFIG, seed);
      const rng = new Rng(seed);
      while (!m.round.result && (m.round.boneyard.length > 0 || m.round.turn !== 1)) m = applyAction(m, rng.pick(legalActions(m.round)))!;
      if (m.round.result || m.round.hands[0].length + m.round.hands[1].length > 11) continue;
      const plays = legalActions(m.round).filter((a) => a.type === 'play');
      if (plays.length < 2) continue;
      const view = viewFor(m.round, 1);
      expect(unseenTiles(view).sort((a, b) => a - b)).toEqual([...m.round.hands[0]].sort((a, b) => a - b));
      const best = Math.max(...plays.map((a) => value(applyAction(m, a)!, 1)));
      const action = chooseAction(view, 'hard', new Rng(seed))!;
      expect(value(applyAction(m, action)!, 1)).toBe(best);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('hard wins more often than easy', () => {
    let hardPoints = 0;
    let easyPoints = 0;
    for (let g = 0; g < 40; g++) {
      let m = newMatch({ ...CONFIG, length: 'single' }, 9000 + g);
      const rng = new Rng(g);
      while (!m.round.result) {
        const seat = m.round.turn;
        const action = chooseAction(viewFor(m.round, seat), seat === 0 ? 'hard' : 'easy', rng)!;
        m = applyAction(m, action)!;
      }
      hardPoints += m.scores[0];
      easyPoints += m.scores[1];
    }
    expect(hardPoints).toBeGreaterThan(easyPoints);
  });
});
