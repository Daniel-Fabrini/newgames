import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import { applyAction, legalActions, newMatch, nextRound, type MatchState } from './engine';
import { saveValidator } from './save';
import { tileId as t } from './tiles';

function played(seed: number, steps: number, length: MatchState['config']['length'] = 100): MatchState {
  const rng = new Rng(seed);
  let m = newMatch({ mode: 'ai', difficulty: 'hard', length }, seed);
  for (let i = 0; i < steps && !m.over; i++) {
    if (m.round.result) m = nextRound(m)!;
    else m = applyAction(m, rng.pick(legalActions(m.round)))!;
  }
  return m;
}

const roundTrip = (m: MatchState, elapsedMs = 1234) => saveValidator(JSON.parse(JSON.stringify({ match: m, elapsedMs })));

describe('domino save validation', () => {
  it('accepts real states at every stage (new, mid-round, finished round, later rounds)', () => {
    for (const steps of [0, 1, 5, 12, 30, 60, 120]) {
      for (const seed of [1, 2, 3]) {
        const m = played(seed, steps);
        const r = roundTrip(m);
        expect(r.ok, r.ok ? '' : r.error).toBe(true);
        if (r.ok) expect(r.value.match).toEqual(m);
      }
    }
  });

  it('accepts finished single-round matches', () => {
    const m = played(4, 200, 'single');
    expect(m.over).toBe(true);
    expect(roundTrip(m).ok).toBe(true);
  });

  it('rejects a duplicated or missing tile', () => {
    const m = played(5, 6);
    const dup = structuredClone(m);
    dup.round.boneyard[0] = dup.round.hands[0][0]!;
    expect(roundTrip(dup).ok).toBe(false);
    const missing = structuredClone(m);
    missing.round.boneyard.pop();
    expect(roundTrip(missing).ok).toBe(false);
  });

  it('rejects a tampered line, hand or log', () => {
    const m = played(6, 8);
    expect(m.round.line.length).toBeGreaterThan(1);
    const flipped = structuredClone(m);
    const p = flipped.round.line[0]!;
    [p.left, p.right] = [p.right, p.left];
    expect(roundTrip(flipped).ok).toBe(false);
    const wrongPips = structuredClone(m);
    wrongPips.round.line[0]!.tile = (wrongPips.round.line[0]!.tile + 1) % 28;
    expect(roundTrip(wrongPips).ok).toBe(false);
    const swapped = structuredClone(m);
    // Move one tile from a hand to the boneyard: counts no longer match the log.
    swapped.round.boneyard.push(swapped.round.hands[1].pop()!);
    expect(roundTrip(swapped).ok).toBe(false);
    const badLog = structuredClone(m);
    badLog.round.log.pop();
    expect(roundTrip(badLog).ok).toBe(false);
  });

  it('rejects inconsistent scores, results and opening', () => {
    const m = played(7, 400);
    const scores = structuredClone(m);
    scores.scores[0] += 5;
    expect(roundTrip(scores).ok).toBe(false);
    const fresh = newMatch({ mode: '2p', difficulty: 'easy', length: 50 }, 8);
    const wrongStarter = structuredClone(fresh);
    wrongStarter.round.turn = wrongStarter.round.turn === 0 ? 1 : 0;
    wrongStarter.round.starter = wrongStarter.round.turn;
    expect(roundTrip(wrongStarter).ok).toBe(false);
    const fakeResult = structuredClone(fresh);
    fakeResult.round.result = { winner: 0, reason: 'domino', points: 10, pips: [0, 10] };
    expect(roundTrip(fakeResult).ok).toBe(false);
  });

  it('rejects garbage', () => {
    expect(saveValidator(null).ok).toBe(false);
    expect(saveValidator({ match: { config: { mode: 'ai' } }, elapsedMs: 0 }).ok).toBe(false);
    const m = played(9, 3);
    const badTile = structuredClone(m);
    badTile.round.hands[0][0] = t(6, 6) + 50;
    expect(roundTrip(badTile).ok).toBe(false);
    expect(roundTrip(m, -5).ok).toBe(false);
  });
});
