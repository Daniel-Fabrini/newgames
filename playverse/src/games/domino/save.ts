import { v, type Result, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import {
  findOpening,
  isBlocked,
  lineEnds,
  scoreRound,
  type LogEntry,
  type MatchConfig,
  type MatchState,
  type Placed,
  type RoundRecord,
  type RoundResult,
  type RoundState,
  type Seat,
} from './engine';
import { HAND_SIZE, MAX_PIP, TILE_COUNT, pipsOf, type TileId } from './tiles';

const tile: Validator<TileId> = v.int({ min: 0, max: TILE_COUNT - 1 });
const pip = v.int({ min: 0, max: MAX_PIP });
const seat: Validator<Seat> = v.literal(0, 1);
const count = v.int({ min: 0, max: 10000 });

function pair<T>(item: Validator<T>): Validator<[T, T]> {
  const arr = v.array(item, { length: 2 });
  return (input, path = ''): Result<[T, T]> => {
    const r = arr(input, path);
    return r.ok ? { ok: true, value: [r.value[0] as T, r.value[1] as T] } : r;
  };
}

const hand = v.array(tile, { maxLength: TILE_COUNT });

const placed: Validator<Placed> = v.refine(v.object({ tile, left: pip, right: pip }), (p) => {
  const [a, b] = pipsOf(p.tile);
  return (p.left === a && p.right === b) || (p.left === b && p.right === a) || 'placed tile does not match its pips';
});

const logEntry: Validator<LogEntry> = v.union(
  v.object({ kind: v.literal('play'), seat, tile, end: v.literal('left', 'right', 'first') }),
  v.object({ kind: v.literal('draw'), seat, ends: pair(pip) }),
  v.object({ kind: v.literal('pass'), seat, ends: pair(pip) }),
);

const roundResultShape = {
  winner: v.nullable(seat),
  reason: v.literal('domino', 'blocked'),
  points: count,
  pips: pair(count),
};

const roundResult: Validator<RoundResult> = v.object(roundResultShape);

const roundRecord: Validator<RoundRecord> = v.object({ ...roundResultShape, hands: pair(hand), starter: seat });

const sameResult = (a: RoundResult, b: RoundResult) =>
  a.winner === b.winner && a.reason === b.reason && a.points === b.points && a.pips[0] === b.pips[0] && a.pips[1] === b.pips[1];

/** Semantic checks: every tile exactly once, a consistent line, a valid opening and result. */
export function checkRound(r: RoundState): true | string {
  const all = [...r.hands[0], ...r.hands[1], ...r.boneyard, ...r.line.map((p) => p.tile)];
  if (all.length !== TILE_COUNT || new Set(all).size !== TILE_COUNT) return 'tiles are not all accounted for exactly once';
  for (let i = 1; i < r.line.length; i++) {
    if ((r.line[i - 1] as Placed).right !== (r.line[i] as Placed).left) return 'line halves do not match';
  }
  const plays = r.log.filter((e) => e.kind === 'play');
  if (plays.length !== r.line.length) return 'log does not match the line';
  for (const s of [0, 1] as const) {
    const drew = r.log.filter((e) => e.kind === 'draw' && e.seat === s).length;
    const played = plays.filter((e) => e.seat === s).length;
    if (r.hands[s].length !== HAND_SIZE + drew - played) return 'hand size does not match the log';
  }
  if (r.line.length === 0) {
    if (r.origin !== 0 || r.log.length > 0 || r.result) return 'invalid empty line';
    const opening = findOpening(r.hands);
    if (opening.seat !== r.starter || opening.tile !== r.opening || r.turn !== r.starter) return 'invalid opening';
  } else {
    if (r.origin >= r.line.length || r.line[r.origin]?.tile !== r.opening) return 'invalid origin';
    const first = plays[0];
    if (!first || first.tile !== r.opening || first.seat !== r.starter || first.end !== 'first') return 'invalid opening play';
  }
  if (r.result) {
    const dominoBy = r.result.reason === 'domino' ? r.result.winner : null;
    if (r.result.reason === 'domino' && (dominoBy === null || r.hands[dominoBy].length > 0)) return 'invalid domino result';
    if (r.result.reason === 'blocked' && !isBlocked(r)) return 'invalid blocked result';
    if (!sameResult(r.result, scoreRound(r.hands, dominoBy))) return 'round result does not match the hands';
  } else if (r.line.length > 0) {
    if (r.hands[0].length === 0 || r.hands[1].length === 0 || isBlocked(r) || !lineEnds(r.line)) return 'round should be over';
  }
  return true;
}

const roundState: Validator<RoundState> = v.refine(
  v.object({
    hands: pair(hand),
    boneyard: v.array(tile, { maxLength: TILE_COUNT }),
    line: v.array(placed, { maxLength: TILE_COUNT }),
    origin: v.int({ min: 0, max: TILE_COUNT - 1 }),
    starter: seat,
    opening: tile,
    turn: seat,
    log: v.array(logEntry, { maxLength: 200 }),
    result: v.nullable(roundResult),
  }),
  checkRound,
);

const config: Validator<MatchConfig> = v.object({
  mode: v.literal('ai', '2p'),
  difficulty: v.literal('easy', 'medium', 'hard'),
  length: v.literal('single', 50, 100, 150),
});

export function checkMatch(m: MatchState): true | string {
  const finished = m.round.result !== null;
  if (m.rounds.length !== m.roundNo - (finished ? 0 : 1)) return 'round count mismatch';
  const totals: [number, number] = [0, 0];
  for (const r of m.rounds) if (r.winner !== null) totals[r.winner] += r.points;
  if (totals[0] !== m.scores[0] || totals[1] !== m.scores[1]) return 'scores do not match the rounds';
  if (m.over && !finished) return 'match over during a round';
  if (m.config.length === 'single') {
    if (m.roundNo !== 1 || m.over !== finished) return 'invalid single-round match';
    if (m.over && m.winner !== (m.round.result?.winner ?? null)) return 'invalid single-round winner';
  } else {
    const target = m.config.length;
    const reached = ([0, 1] as const).filter((s) => m.scores[s] >= target);
    if (m.over !== reached.length > 0) return 'target state mismatch';
    if (m.over && m.winner !== reached[0]) return 'invalid match winner';
  }
  return true;
}

const matchState: Validator<MatchState> = v.refine(
  v.object({
    config,
    scores: pair(count),
    rounds: v.array(roundRecord, { maxLength: 500 }),
    round: roundState,
    roundNo: v.int({ min: 1, max: 501 }),
    rng: v.int({ min: 0 }),
    over: v.boolean(),
    winner: v.nullable(seat),
  }),
  checkMatch,
);

export interface SavedDomino {
  match: MatchState;
  elapsedMs: number;
}

export const saveValidator: Validator<SavedDomino> = v.object({ match: matchState, elapsedMs: v.number({ min: 0 }) });

export const saveSpec: SaveSpec<SavedDomino> = {
  gameId: 'domino',
  version: 1,
  validate: saveValidator,
};
