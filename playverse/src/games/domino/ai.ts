import type { Rng } from '../../utils/random';
import { legalActionsFor, lineEnds, otherSeat, type Action, type Difficulty, type End, type LogEntry, type Placed, type RoundState, type Seat } from './engine';
import { ALL_TILES, MAX_PIP, handPips, hasNumber, isDouble, otherHalf, pipsOf, tileValue, type TileId } from './tiles';

/**
 * Computer opponent.
 *
 * The AI never receives the round state: it only gets a `PlayerView` built from public
 * information — its own hand, the tiles on the table, the boneyard COUNT, the opponent's tile
 * COUNT and the public log (plays, and the open ends whenever someone drew or passed; drawn tiles
 * are never recorded). Everything it "knows" about hidden tiles is deduced from that.
 */
export interface PlayerView {
  readonly seat: Seat;
  readonly hand: readonly TileId[];
  readonly line: readonly Placed[];
  /** The tile this player must open with (only when it is this player's turn to open). */
  readonly mustOpen: TileId | null;
  readonly boneyardCount: number;
  readonly opponentCount: number;
  readonly log: readonly LogEntry[];
}

function cloneEntry(e: LogEntry): LogEntry {
  switch (e.kind) {
    case 'play':
      return { kind: 'play', seat: e.seat, tile: e.tile, end: e.end };
    case 'draw':
      return { kind: 'draw', seat: e.seat, ends: [e.ends[0], e.ends[1]] };
    case 'pass':
      return { kind: 'pass', seat: e.seat, ends: [e.ends[0], e.ends[1]] };
  }
}

/** The only way the AI sees the game: copies of public data plus the player's own hand. */
export function viewFor(round: RoundState, seat: Seat): PlayerView {
  return {
    seat,
    hand: [...round.hands[seat]],
    line: round.line.map((p) => ({ tile: p.tile, left: p.left, right: p.right })),
    mustOpen: round.line.length === 0 && round.turn === seat && round.hands[seat].includes(round.opening) ? round.opening : null,
    boneyardCount: round.boneyard.length,
    opponentCount: round.hands[otherSeat(seat)].length,
    log: round.log.map(cloneEntry),
  };
}

export function legalFromView(view: PlayerView): Action[] {
  return legalActionsFor(view.hand, view.line, view.boneyardCount, view.mustOpen);
}

/** Tiles whose location this player cannot see (opponent's hand or boneyard). */
export function unseenTiles(view: PlayerView): TileId[] {
  const known = new Set<TileId>([...view.hand, ...view.line.map((p) => p.tile)]);
  return ALL_TILES.filter((t) => !known.has(t));
}

/**
 * Numbers the opponent certainly does not hold, deduced from the public log: when a player draws
 * or passes, none of their tiles matched either open end. Drawing brings in unknown tiles, so a
 * draw resets the inference to just the ends it was facing; passing adds to it.
 */
export function inferMissing(log: readonly LogEntry[], seat: Seat): Set<number> {
  let missing = new Set<number>();
  for (const e of log) {
    if (e.seat !== seat) continue;
    if (e.kind === 'draw') missing = new Set(e.ends);
    else if (e.kind === 'pass') for (const n of e.ends) missing.add(n);
  }
  return missing;
}

function endsAfter(view: PlayerView, tile: TileId, end: End): [number, number] {
  const ends = lineEnds(view.line);
  if (!ends) {
    const [a, b] = pipsOf(tile);
    return [a, b];
  }
  return end === 'left' ? [otherHalf(tile, ends[0]), ends[1]] : [ends[0], otherHalf(tile, ends[1])];
}

function pickBest<T>(items: readonly T[], score: (item: T) => number, rng: Rng): T {
  let best: T[] = [];
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore + 1e-9) {
      bestScore = s;
      best = [item];
    } else if (Math.abs(s - bestScore) <= 1e-9) best.push(item);
  }
  return rng.pick(best);
}

type Play = Extract<Action, { type: 'play' }>;

function followUps(hand: readonly TileId[], ends: readonly [number, number]): number {
  return hand.filter((t) => hasNumber(t, ends[0]) || hasNumber(t, ends[1])).length;
}

function distinctNumbers(hand: readonly TileId[]): number {
  const seen = new Set<number>();
  for (let n = 0; n <= MAX_PIP; n++) if (hand.some((t) => hasNumber(t, n))) seen.add(n);
  return seen.size;
}

/** Medium: heaviest tile first, doubles favoured; for a two-end tile, the end that keeps more follow-ups. */
function chooseMedium(view: PlayerView, plays: Play[], rng: Rng): Play {
  return pickBest(
    plays,
    (p) => {
      const rest = view.hand.filter((t) => t !== p.tile);
      return (tileValue(p.tile) + (isDouble(p.tile) ? 2 : 0)) * 10 + Math.min(followUps(rest, endsAfter(view, p.tile, p.end)), 9);
    },
    rng,
  );
}

/** Hard: weighted heuristics using only deducible information. */
export function scorePlay(view: PlayerView, play: Play, unseen: readonly TileId[], missing: ReadonlySet<number>): number {
  const rest = view.hand.filter((t) => t !== play.tile);
  if (rest.length === 0) return 1000;
  const after = endsAfter(view, play.tile, play.end);
  const endgame = view.boneyardCount === 0;
  let s = 0;
  // Shed weight (more urgent once the boneyard is empty and a block becomes likely).
  s += tileValue(play.tile) * (endgame ? 1 : 0.6);
  // Doubles only fit one number: get rid of them while possible.
  if (isDouble(play.tile)) s += 3;
  // Keep options for the next turn and a varied hand.
  const follow = followUps(rest, after);
  s += Math.min(follow, 3) * 1.5;
  if (follow === 0) s -= 2.5;
  s += distinctNumbers(rest) * 0.7;
  // Opponent's chances on the ends this move leaves open.
  const holdShare = view.opponentCount / Math.max(1, view.opponentCount + view.boneyardCount);
  let blockedEnds = 0;
  for (const e of new Set(after)) {
    const unseenWith = unseen.filter((t) => hasNumber(t, e)).length;
    if (unseenWith === 0) {
      s += 3;
      blockedEnds++;
    } else if (missing.has(e)) {
      s += 4;
      blockedEnds++;
    } else {
      s -= 2 * unseenWith * holdShare;
    }
  }
  if (blockedEnds === new Set(after).size) s += endgame ? 6 : 3;
  return s;
}

const SEARCH_BUDGET = 20000;

interface SearchState {
  hands: [TileId[], TileId[]];
  ends: [number, number];
  turn: 0 | 1;
}

/**
 * With an empty boneyard the opponent's hand is exactly the set of unseen tiles, so the rest of
 * the round is a perfect-information game. Alpha-beta search maximising the points balance;
 * returns null when the node budget runs out.
 */
function endgameSearch(view: PlayerView, plays: Play[]): Play | null {
  const unseen = unseenTiles(view);
  const ends = lineEnds(view.line);
  if (view.boneyardCount !== 0 || !ends || unseen.length !== view.opponentCount) return null;
  let nodes = 0;
  const exhausted = { value: false };

  // Index 0 = me, 1 = opponent. Value from my perspective.
  const terminal = (hands: [TileId[], TileId[]], domino: 0 | 1 | null): number => {
    const mine = handPips(hands[0]);
    const theirs = handPips(hands[1]);
    if (domino === 0) return theirs;
    if (domino === 1) return -mine;
    if (mine === theirs) return 0;
    return mine < theirs ? theirs : -mine;
  };

  const movesOf = (hand: readonly TileId[], e: readonly [number, number]) => {
    const out: { tile: TileId; ends: [number, number] }[] = [];
    for (const t of hand) {
      if (hasNumber(t, e[0])) out.push({ tile: t, ends: [otherHalf(t, e[0]), e[1]] });
      if (hasNumber(t, e[1]) && !(e[0] === e[1])) out.push({ tile: t, ends: [e[0], otherHalf(t, e[1])] });
    }
    return out.sort((a, b) => tileValue(b.tile) - tileValue(a.tile));
  };

  const search = (st: SearchState, alpha: number, beta: number, passes: number): number => {
    if (++nodes > SEARCH_BUDGET) {
      exhausted.value = true;
      return 0;
    }
    const hand = st.hands[st.turn];
    const moves = movesOf(hand, st.ends);
    if (moves.length === 0) {
      if (passes >= 1) return terminal(st.hands, null);
      return search({ ...st, turn: st.turn === 0 ? 1 : 0 }, alpha, beta, passes + 1);
    }
    let best = st.turn === 0 ? -Infinity : Infinity;
    for (const m of moves) {
      const nextHand = hand.filter((t) => t !== m.tile);
      const hands: [TileId[], TileId[]] = st.turn === 0 ? [nextHand, st.hands[1]] : [st.hands[0], nextHand];
      const value = nextHand.length === 0 ? terminal(hands, st.turn) : search({ hands, ends: m.ends, turn: st.turn === 0 ? 1 : 0 }, alpha, beta, 0);
      if (exhausted.value) return 0;
      if (st.turn === 0) {
        best = Math.max(best, value);
        alpha = Math.max(alpha, value);
      } else {
        best = Math.min(best, value);
        beta = Math.min(beta, value);
      }
      if (alpha >= beta) break;
    }
    return best;
  };

  let bestPlay: Play | null = null;
  let bestValue = -Infinity;
  for (const p of plays) {
    const rest = view.hand.filter((t) => t !== p.tile);
    const after = endsAfter(view, p.tile, p.end);
    const hands: [TileId[], TileId[]] = [rest, unseen];
    const value = rest.length === 0 ? terminal(hands, 0) : search({ hands, ends: after, turn: 1 }, -Infinity, Infinity, 0);
    if (exhausted.value) return null;
    if (value > bestValue) {
      bestValue = value;
      bestPlay = p;
    }
  }
  return bestPlay;
}

function chooseHard(view: PlayerView, plays: Play[], rng: Rng): Play {
  const searched = endgameSearch(view, plays);
  if (searched) return searched;
  const unseen = unseenTiles(view);
  const missing = inferMissing(view.log, otherSeat(view.seat));
  return pickBest(plays, (p) => scorePlay(view, p, unseen, missing), rng);
}

/** Picks the computer's action from its public view. Returns null when it has nothing to do. */
export function chooseAction(view: PlayerView, difficulty: Difficulty, rng: Rng): Action | null {
  const legal = legalFromView(view);
  const first = legal[0];
  if (!first) return null;
  if (first.type !== 'play') return first;
  const plays = legal.filter((a): a is Play => a.type === 'play');
  if (plays.length === 1) return first;
  switch (difficulty) {
    case 'easy':
      return rng.pick(plays);
    case 'medium':
      return chooseMedium(view, plays, rng);
    case 'hard':
      return chooseHard(view, plays, rng);
  }
}
