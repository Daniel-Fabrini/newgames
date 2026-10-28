import { Rng } from '../../utils/random';
import { ALL_TILES, HAND_SIZE, MAX_PIP, handPips, hasNumber, otherHalf, pipsOf, sortTiles, tileId, tileRank, type TileId } from './tiles';

/**
 * Domino rules engine (pure, UI independent) — double-six "draw game" for two players.
 *
 * Rules implemented:
 * - 28 tiles (0|0 … 6|6) shuffled with a seeded Rng; each player receives 7 and the other 14
 *   form the face-down boneyard.
 * - Every round is opened by the player holding the highest double (6|6, else 5|5, …), who must
 *   play that tile. If neither hand holds a double, the heaviest tile opens (highest total; ties
 *   broken by the higher number, so 6|3 beats 5|4). The same rule applies to every round.
 * - On a turn the player must place a tile whose number matches one of the two open ends of the
 *   line (doubles are laid crosswise but still expose the same number). A player who cannot play
 *   must draw from the boneyard, one tile at a time, until able to play or until the boneyard is
 *   empty; still unable, the player passes. Drawing or passing while holding a playable tile is
 *   not allowed.
 * - The round ends when (a) a player places the last tile — "domino": that player scores the pips
 *   left in the opponent's hand — or (b) the game is blocked: the boneyard is empty and nobody can
 *   play. Then the player with fewer pips in hand wins and scores the opponent's pips; equal totals
 *   make a drawn round worth no points.
 * - Match: first to the target (50 / 100 / 150) wins. In "single round" mode the round result is
 *   the match result (win, loss or draw).
 */
export type Seat = 0 | 1;
export type End = 'left' | 'right';
export type Mode = 'ai' | '2p';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type MatchLength = 'single' | 50 | 100 | 150;

export const MATCH_LENGTHS: readonly MatchLength[] = [50, 100, 150, 'single'];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** A tile on the table. `left`/`right` are the pips facing the left/right end of the line. */
export interface Placed {
  tile: TileId;
  left: number;
  right: number;
}

/**
 * Public move log. Draws never record which tile was drawn: the log is shown to both players and
 * is the only history the computer opponent receives.
 */
export type LogEntry =
  | { kind: 'play'; seat: Seat; tile: TileId; end: End | 'first' }
  | { kind: 'draw'; seat: Seat; ends: [number, number] }
  | { kind: 'pass'; seat: Seat; ends: [number, number] };

export type Action = { type: 'play'; tile: TileId; end: End } | { type: 'draw' } | { type: 'pass' };

export type RoundEndReason = 'domino' | 'blocked';

export interface RoundResult {
  /** Null for a drawn (tied) blocked round. */
  winner: Seat | null;
  reason: RoundEndReason;
  points: number;
  /** Pips left in each hand when the round ended. */
  pips: [number, number];
}

export interface RoundRecord extends RoundResult {
  /** Hands revealed at the end of the round. */
  hands: [TileId[], TileId[]];
  starter: Seat;
}

export interface RoundState {
  hands: [TileId[], TileId[]];
  /** Face-down tiles; players draw from the front. */
  boneyard: TileId[];
  /** The line of play from its left end to its right end. */
  line: Placed[];
  /** Index in `line` of the opening tile (the line grows on both sides of it). */
  origin: number;
  starter: Seat;
  /** Tile that must open the round. */
  opening: TileId;
  turn: Seat;
  log: LogEntry[];
  result: RoundResult | null;
}

export interface MatchConfig {
  mode: Mode;
  difficulty: Difficulty;
  length: MatchLength;
}

export interface MatchState {
  config: MatchConfig;
  scores: [number, number];
  /** Finished rounds, oldest first. */
  rounds: RoundRecord[];
  round: RoundState;
  /** Number of the current round (1-based). */
  roundNo: number;
  rng: number;
  over: boolean;
  /** Match winner; null with `over` means a drawn single-round match. */
  winner: Seat | null;
}

export const otherSeat = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

/** Open ends [left, right] of the line, or null before the opening tile. */
export function lineEnds(line: readonly Placed[]): [number, number] | null {
  const first = line[0];
  const last = line[line.length - 1];
  return first && last ? [first.left, last.right] : null;
}

/** Ends of a non-empty line where `tile` can be placed. */
export function fitEnds(tile: TileId, ends: readonly [number, number]): End[] {
  const out: End[] = [];
  if (hasNumber(tile, ends[0])) out.push('left');
  if (hasNumber(tile, ends[1])) out.push('right');
  return out;
}

/** Adds a tile to the line, oriented so that the matching halves touch. */
export function placeTile(line: readonly Placed[], tile: TileId, end: End): { line: Placed[]; prepended: boolean } {
  const ends = lineEnds(line);
  if (!ends) {
    const [a, b] = pipsOf(tile);
    return { line: [{ tile, left: a, right: b }], prepended: false };
  }
  if (end === 'left') {
    const match = ends[0];
    if (!hasNumber(tile, match)) throw new Error('Tile does not match the left end');
    return { line: [{ tile, left: otherHalf(tile, match), right: match }, ...line], prepended: true };
  }
  const match = ends[1];
  if (!hasNumber(tile, match)) throw new Error('Tile does not match the right end');
  return { line: [...line, { tile, left: match, right: otherHalf(tile, match) }], prepended: false };
}

/** Who opens the round and with which tile (highest double, else heaviest tile). */
export function findOpening(hands: readonly (readonly TileId[])[]): { seat: Seat; tile: TileId } {
  for (let d = MAX_PIP; d >= 0; d--) {
    const id = tileId(d, d);
    for (const seat of [0, 1] as const) if (hands[seat]?.includes(id)) return { seat, tile: id };
  }
  let best: { seat: Seat; tile: TileId } | null = null;
  for (const seat of [0, 1] as const) {
    for (const tile of hands[seat] ?? []) if (!best || tileRank(tile) > tileRank(best.tile)) best = { seat, tile };
  }
  if (!best) throw new Error('Cannot open a round with empty hands');
  return best;
}

/** Shuffles the set and deals a new round. */
export function dealRound(rng: Rng): RoundState {
  const deck = rng.shuffle(ALL_TILES);
  const hands: [TileId[], TileId[]] = [sortTiles(deck.slice(0, HAND_SIZE)), sortTiles(deck.slice(HAND_SIZE, HAND_SIZE * 2))];
  return roundFromDeal(hands, deck.slice(HAND_SIZE * 2));
}

/** Builds a round from explicit hands and boneyard (used by dealRound and tests). */
export function roundFromDeal(hands: [TileId[], TileId[]], boneyard: TileId[]): RoundState {
  const { seat, tile } = findOpening(hands);
  return { hands, boneyard, line: [], origin: 0, starter: seat, opening: tile, turn: seat, log: [], result: null };
}

export function newMatch(config: MatchConfig, seed: number): MatchState {
  const rng = new Rng(seed);
  const round = dealRound(rng);
  return { config: { ...config }, scores: [0, 0], rounds: [], round, roundNo: 1, rng: rng.state, over: false, winner: null };
}

/**
 * Legal actions for a hand given the public table: the forced opening tile, otherwise every
 * (tile, end) that matches; a draw only when nothing fits and the boneyard has tiles; a pass only
 * when nothing fits and the boneyard is empty.
 */
export function legalActionsFor(hand: readonly TileId[], line: readonly Placed[], boneyardCount: number, mustOpen: TileId | null): Action[] {
  const ends = lineEnds(line);
  if (!ends) return mustOpen !== null && hand.includes(mustOpen) ? [{ type: 'play', tile: mustOpen, end: 'left' }] : [];
  const plays: Action[] = [];
  for (const tile of hand) for (const end of fitEnds(tile, ends)) plays.push({ type: 'play', tile, end });
  if (plays.length > 0) return plays;
  return boneyardCount > 0 ? [{ type: 'draw' }] : [{ type: 'pass' }];
}

export function legalActions(round: RoundState): Action[] {
  if (round.result) return [];
  return legalActionsFor(round.hands[round.turn], round.line, round.boneyard.length, round.line.length === 0 ? round.opening : null);
}

/** Playable tiles of the player to move, with the ends each one fits. */
export function playableTiles(round: RoundState): Map<TileId, End[]> {
  const out = new Map<TileId, End[]>();
  for (const a of legalActions(round)) {
    if (a.type !== 'play') continue;
    const list = out.get(a.tile) ?? [];
    list.push(a.end);
    out.set(a.tile, list);
  }
  return out;
}

function canPlay(hand: readonly TileId[], ends: readonly [number, number]): boolean {
  return hand.some((t) => hasNumber(t, ends[0]) || hasNumber(t, ends[1]));
}

/** Boneyard empty and neither player holds a tile that fits. */
export function isBlocked(round: RoundState): boolean {
  const ends = lineEnds(round.line);
  if (!ends || round.boneyard.length > 0) return false;
  return !canPlay(round.hands[0], ends) && !canPlay(round.hands[1], ends);
}

/** Scores a finished round (domino by `seat`, or blocked when `seat` is null). */
export function scoreRound(hands: readonly [readonly TileId[], readonly TileId[]], dominoBy: Seat | null): RoundResult {
  const pips: [number, number] = [handPips(hands[0]), handPips(hands[1])];
  if (dominoBy !== null) return { winner: dominoBy, reason: 'domino', points: pips[otherSeat(dominoBy)], pips };
  if (pips[0] === pips[1]) return { winner: null, reason: 'blocked', points: 0, pips };
  const winner: Seat = pips[0] < pips[1] ? 0 : 1;
  return { winner, reason: 'blocked', points: pips[otherSeat(winner)], pips };
}

function sameAction(a: Action, b: Action, opening: boolean): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'play' && b.type === 'play') return a.tile === b.tile && (opening || a.end === b.end);
  return true;
}

export function isLegal(round: RoundState, action: Action): boolean {
  return legalActions(round).some((a) => sameAction(a, action, round.line.length === 0));
}

function finishRound(match: MatchState, round: RoundState, dominoBy: Seat | null): MatchState {
  const result = scoreRound(round.hands, dominoBy);
  const scores: [number, number] = [...match.scores];
  if (result.winner !== null) scores[result.winner] += result.points;
  const record: RoundRecord = { ...result, pips: [...result.pips], hands: [[...round.hands[0]], [...round.hands[1]]], starter: round.starter };
  let over = false;
  let winner: Seat | null = null;
  if (match.config.length === 'single') {
    over = true;
    winner = result.winner;
  } else {
    const target = match.config.length;
    for (const seat of [0, 1] as const) {
      if (scores[seat] >= target) {
        over = true;
        winner = seat;
      }
    }
  }
  return { ...match, scores, rounds: [...match.rounds, record], round: { ...round, result }, over, winner };
}

/**
 * Applies an action for the player to move. Returns null when the action is not legal (wrong
 * tile, wrong end, voluntary draw/pass, round or match already over).
 */
export function applyAction(match: MatchState, action: Action): MatchState | null {
  const round = match.round;
  if (match.over || round.result || !isLegal(round, action)) return null;
  const seat = round.turn;
  const ends = lineEnds(round.line);

  if (action.type === 'play') {
    const placed = placeTile(round.line, action.tile, action.end);
    const hand = round.hands[seat].filter((t) => t !== action.tile);
    const hands: [TileId[], TileId[]] = seat === 0 ? [hand, round.hands[1]] : [round.hands[0], hand];
    const next: RoundState = {
      ...round,
      hands,
      line: placed.line,
      origin: placed.prepended ? round.origin + 1 : round.origin,
      log: [...round.log, { kind: 'play', seat, tile: action.tile, end: ends ? action.end : 'first' }],
      turn: otherSeat(seat),
    };
    if (hand.length === 0) return finishRound(match, next, seat);
    if (isBlocked(next)) return finishRound(match, next, null);
    return { ...match, round: next };
  }

  if (!ends) return null;
  if (action.type === 'draw') {
    const [drawn, ...rest] = round.boneyard;
    if (drawn === undefined) return null;
    const hand = sortTiles([...round.hands[seat], drawn]);
    const hands: [TileId[], TileId[]] = seat === 0 ? [hand, round.hands[1]] : [round.hands[0], hand];
    const next: RoundState = { ...round, hands, boneyard: rest, log: [...round.log, { kind: 'draw', seat, ends: [ends[0], ends[1]] }] };
    if (isBlocked(next)) return finishRound(match, next, null);
    return { ...match, round: next };
  }

  const next: RoundState = { ...round, log: [...round.log, { kind: 'pass', seat, ends: [ends[0], ends[1]] }], turn: otherSeat(seat) };
  if (isBlocked(next)) return finishRound(match, next, null);
  return { ...match, round: next };
}

/** Deals the next round after a finished (non-final) round. */
export function nextRound(match: MatchState): MatchState | null {
  if (match.over || !match.round.result) return null;
  const rng = new Rng(match.rng);
  const round = dealRound(rng);
  return { ...match, round, roundNo: match.roundNo + 1, rng: rng.state };
}

/** Re-deals the current, unfinished round; scores and previous rounds are kept. */
export function restartRound(match: MatchState): MatchState | null {
  if (match.over || match.round.result) return null;
  const rng = new Rng(match.rng);
  const round = dealRound(rng);
  return { ...match, round, rng: rng.state };
}

/** True once `seat` has taken any action in the match (used to decide whether restarting abandons it). */
export function hasActed(match: MatchState, seat: Seat): boolean {
  return match.rounds.length > 0 || match.round.log.some((e) => e.seat === seat);
}

/** Highest number of points `seat` scored in a single round of the match (0 when none). */
export function bestRoundPoints(match: MatchState, seat: Seat): number {
  return match.rounds.reduce((best, r) => (r.winner === seat ? Math.max(best, r.points) : best), 0);
}
