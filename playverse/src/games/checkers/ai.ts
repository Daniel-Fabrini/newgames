import { Rng } from '../../utils/random';
import {
  QUIET_PLY_LIMIT,
  SQUARES,
  colOf,
  destination,
  generateMoves,
  isKing,
  movePath,
  opponent,
  rowOf,
  type Move,
  type Side,
} from './engine';

/**
 * Computer opponent. Pure and synchronous (it runs inside a Web Worker in the app, or on the main
 * thread as a fallback). It only ever returns a move produced by the engine's legal move generator.
 *
 * - easy: 2-ply search; plays a random legal move 30% of the time, otherwise picks randomly among the
 *   moves within 0.6 men of the best one.
 * - medium: alpha-beta, iterative deepening to 5 plies (capped at ~450 ms); ties broken at random.
 * - hard: alpha-beta with a transposition table, killer/history move ordering and iterative
 *   deepening within a ~600 ms budget.
 * Evaluation: material (king = 3 men), advancement, centre control, back-rank guard, king on the long
 * diagonal, and a bonus for trading down when ahead. Forced captures are always searched to the end
 * (quiescence), and repetitions / the 40-ply king rule count as draws inside the search.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AiRequest {
  board: readonly number[];
  turn: Side;
  difficulty: Difficulty;
  /** RNG state (kept in the game state so a restored game continues identically). */
  rng: number;
  /** Position keys since the last irreversible move (current position last), for repetition draws. */
  positions?: readonly string[];
  quietPlies?: number;
  /** Overrides the time budget (tests). */
  timeMs?: number;
}

export interface AiResult {
  /** Squares visited by the chosen move: [from, ...landings]. */
  path: number[];
  rng: number;
  /** Deepest completed search depth. */
  depth: number;
  score: number;
  nodes: number;
}

const MAN = 100;
const KING = 300;
const MATE = 100000;
const INF = 1 << 30;
const MAX_PLY = 64;

interface LevelConfig {
  maxDepth: number;
  timeMs: number;
}

const LEVELS: Record<Difficulty, LevelConfig> = {
  easy: { maxDepth: 2, timeMs: 150 },
  medium: { maxDepth: 5, timeMs: 450 },
  hard: { maxDepth: 40, timeMs: 600 },
};

/* ───────────── Evaluation tables ───────────── */

/** Advancement bonus for a white man by rows advanced from its back row (0–6). */
const ADVANCE = [0, 2, 4, 7, 11, 16, 22];
const MAN_PST_W = new Int16Array(SQUARES);
const MAN_PST_B = new Int16Array(SQUARES);
const KING_PST = new Int16Array(SQUARES);

for (let sq = 0; sq < SQUARES; sq++) {
  const r = rowOf(sq);
  const c = colOf(sq);
  const centre = c >= 2 && c <= 5 && r >= 2 && r <= 5 ? 4 : 0;
  const edge = c === 0 || c === 7 ? -2 : 0;
  MAN_PST_W[sq] = (ADVANCE[7 - r] ?? 0) + centre + edge;
  KING_PST[sq] = (r + c === 7 ? 10 : 0) + centre;
}
// Black's tables are White's rotated by 180° (square i ↔ 31 − i).
for (let sq = 0; sq < SQUARES; sq++) MAN_PST_B[sq] = MAN_PST_W[SQUARES - 1 - sq] as number;

/** Static evaluation from the point of view of `side`. */
export function evaluate(b: ArrayLike<number>, side: Side): number {
  let wm = 0;
  let wk = 0;
  let bm = 0;
  let bk = 0;
  let pst = 0;
  let wBack = 0;
  let bBack = 0;
  for (let sq = 0; sq < SQUARES; sq++) {
    const p = b[sq] as number;
    if (p === 0) continue;
    if (p === 1) {
      wm++;
      pst += MAN_PST_W[sq] as number;
      if (sq >= 28) wBack++;
    } else if (p === 2) {
      wk++;
      pst += KING_PST[sq] as number;
    } else if (p === -1) {
      bm++;
      pst -= MAN_PST_B[sq] as number;
      if (sq < 4) bBack++;
    } else {
      bk++;
      pst -= KING_PST[sq] as number;
    }
  }
  const wMat = wm * MAN + wk * KING;
  const bMat = bm * MAN + bk * KING;
  const total = wm + wk + bm + bk;
  let score = wMat - bMat + pst;
  // Back-rank guards matter while the opponent still has men that could promote.
  const guard = total > 12 ? 6 : 3;
  if (bm > 0) score += wBack * guard;
  if (wm > 0) score -= bBack * guard;
  // When ahead, trading pieces brings the win closer.
  if (wMat !== bMat && total < 24) score += Math.sign(wMat - bMat) * (24 - total) * 3;
  return side === 'w' ? score : 0 - score;
}

/* ───────────── Hashing ───────────── */

const zr = new Rng(0x2545f491);
const randomInt = () => Math.floor(zr.next() * 0x100000000) | 0;
const Z1 = Int32Array.from({ length: SQUARES * 5 }, randomInt);
const Z2 = Int32Array.from({ length: SQUARES * 5 }, randomInt);
const SIDE1 = randomInt();
const SIDE2 = randomInt();

let h1 = 0;
let h2 = 0;
function hash(b: ArrayLike<number>, side: Side): void {
  let a = side === 'b' ? SIDE1 : 0;
  let c = side === 'b' ? SIDE2 : 0;
  for (let sq = 0; sq < SQUARES; sq++) {
    const p = b[sq] as number;
    if (p !== 0) {
      const idx = sq * 5 + p + 2;
      a ^= Z1[idx] as number;
      c ^= Z2[idx] as number;
    }
  }
  h1 = a;
  h2 = c;
}

const KEY_VALUES: Record<string, number> = { B: -2, b: -1, '.': 0, w: 1, W: 2 };

function hashKey(key: string): number {
  const board: number[] = [];
  for (let i = 0; i < SQUARES; i++) board.push(KEY_VALUES[key[i] ?? '.'] ?? 0);
  hash(board, key.endsWith(':b') ? 'b' : 'w');
  return h1;
}

/* ───────────── Search ───────────── */

function make(b: Int8Array, m: Move): void {
  b[m.from] = 0;
  for (const c of m.captures) b[c] = 0;
  b[destination(m)] = m.promotes ? m.piece * 2 : m.piece;
}

function unmake(b: Int8Array, m: Move): void {
  b[destination(m)] = 0;
  for (let i = 0; i < m.captures.length; i++) b[m.captures[i] as number] = m.captured[i] as number;
  b[m.from] = m.piece;
}

const signature = (m: Move): number => m.from | (destination(m) << 5) | (m.captures.length << 10);

/** Removes capture sequences that reach the same final position by a different route. */
function dedupe(moves: Move[]): Move[] {
  if ((moves[0]?.captures.length ?? 0) < 2) return moves;
  const seen = new Set<string>();
  return moves.filter((m) => {
    const key = `${m.from}:${destination(m)}:${m.captures.slice().sort((a, b) => a - b).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface TTEntry {
  check: number;
  depth: number;
  score: number;
  flag: 0 | 1 | 2; // exact, lower bound, upper bound
  best: number;
}

const TT_LIMIT = 300_000;

class Search {
  readonly b: Int8Array;
  nodes = 0;
  aborted = false;
  private readonly deadline: number;
  private readonly tt = new Map<number, TTEntry>();
  private readonly killers: number[][] = Array.from({ length: MAX_PLY + 1 }, () => [0, 0]);
  private readonly history = new Int32Array(1024);
  /** Hashes of the positions on the current line (game history since the last irreversible move first). */
  private readonly stack: number[];
  private readonly useTT: boolean;

  constructor(board: readonly number[], deadline: number, historyHashes: number[], useTT: boolean) {
    this.b = Int8Array.from(board);
    this.deadline = deadline;
    this.stack = historyHashes;
    this.useTT = useTT;
  }

  private timeUp(): boolean {
    if ((this.nodes & 1023) === 0 && performance.now() > this.deadline) this.aborted = true;
    return this.aborted;
  }

  private order(moves: Move[], ply: number, ttBest: number): number[] {
    const killers = this.killers[ply] ?? [0, 0];
    const scores = moves.map((m, i) => {
      if (i === ttBest) return 1e9;
      let s = 0;
      for (const v of m.captured) s += isKing(v) ? 30 : 10;
      if (m.promotes) s += 5e5;
      const sig = signature(m);
      if (sig === killers[0]) s += 2e5;
      else if (sig === killers[1]) s += 1e5;
      s += Math.min(9e4, this.history[(m.from << 5) | destination(m)] as number);
      return s;
    });
    return moves.map((_, i) => i).sort((a, b) => (scores[b] as number) - (scores[a] as number));
  }

  /** Negamax alpha-beta. `repStart` is the first stack index reachable without an irreversible move. */
  search(side: Side, depth: number, alpha: number, beta: number, ply: number, quiet: number, repStart: number): number {
    this.nodes++;
    if (this.timeUp()) return 0;
    const b = this.b;
    hash(b, side);
    const key = h1;
    const check = h2;
    for (let i = repStart; i < this.stack.length; i++) if (this.stack[i] === key) return 0;
    if (quiet >= QUIET_PLY_LIMIT) return 0;

    const moves = dedupe(generateMoves(b, side));
    if (moves.length === 0) return -MATE + ply;
    const forcedCapture = (moves[0]?.captures.length ?? 0) > 0;
    if ((depth <= 0 && !forcedCapture) || ply >= MAX_PLY) return evaluate(b, side);

    const alphaOrig = alpha;
    let ttBest = -1;
    if (this.useTT) {
      const entry = this.tt.get(key);
      if (entry && entry.check === check) {
        ttBest = entry.best;
        if (entry.depth >= depth) {
          let s = entry.score;
          if (s > MATE - 1000) s -= ply;
          else if (s < -MATE + 1000) s += ply;
          if (entry.flag === 0) return s;
          if (entry.flag === 1 && s >= beta) return s;
          if (entry.flag === 2 && s <= alpha) return s;
        }
      }
    }

    const extension = moves.length === 1 && ply < 40 ? 1 : 0;
    const next = opponent(side);
    this.stack.push(key);
    let best = -INF;
    let bestIndex = -1;
    for (const i of this.order(moves, ply, ttBest)) {
      const m = moves[i] as Move;
      const irreversible = m.captures.length > 0 || !isKing(m.piece);
      make(b, m);
      const score = -this.search(
        next,
        depth - 1 + extension,
        -beta,
        -alpha,
        ply + 1,
        irreversible ? 0 : quiet + 1,
        irreversible ? this.stack.length : repStart,
      );
      unmake(b, m);
      if (this.aborted) {
        this.stack.pop();
        return 0;
      }
      if (score > best) {
        best = score;
        bestIndex = i;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (m.captures.length === 0) {
          const killers = this.killers[ply];
          const sig = signature(m);
          if (killers && killers[0] !== sig) {
            killers[1] = killers[0] as number;
            killers[0] = sig;
          }
          const h = (m.from << 5) | destination(m);
          this.history[h] = (this.history[h] as number) + depth * depth;
        }
        break;
      }
    }
    this.stack.pop();

    if (this.useTT) {
      if (this.tt.size > TT_LIMIT) this.tt.clear();
      let stored = best;
      if (stored > MATE - 1000) stored += ply;
      else if (stored < -MATE + 1000) stored -= ply;
      const flag: 0 | 1 | 2 = best <= alphaOrig ? 2 : best >= beta ? 1 : 0;
      this.tt.set(key, { check, depth, score: stored, flag, best: bestIndex });
    }
    return best;
  }

  /** Scores every root move with a full window (used by the easy level). */
  scoreAll(side: Side, moves: Move[], depth: number, quiet: number): number[] {
    hash(this.b, side);
    this.stack.push(h1);
    const next = opponent(side);
    const scores = moves.map((m) => {
      const irreversible = m.captures.length > 0 || !isKing(m.piece);
      make(this.b, m);
      const s = -this.search(next, depth - 1, -INF, INF, 1, irreversible ? 0 : quiet + 1, irreversible ? this.stack.length : 0);
      unmake(this.b, m);
      return s;
    });
    this.stack.pop();
    return scores;
  }

  /** One alpha-beta iteration at the root over `order`; returns [bestIndex, score] or null if aborted. */
  root(side: Side, moves: Move[], order: number[], depth: number, quiet: number): { index: number; score: number; scores: Map<number, number> } | null {
    hash(this.b, side);
    this.stack.push(h1);
    const next = opponent(side);
    let alpha = -INF;
    let bestIndex = order[0] as number;
    const scores = new Map<number, number>();
    for (const i of order) {
      const m = moves[i] as Move;
      const irreversible = m.captures.length > 0 || !isKing(m.piece);
      make(this.b, m);
      // Search with alpha - 1 so moves equal to the best get an exact score (for random tie-breaking).
      const s = -this.search(next, depth - 1, -INF, -(alpha - 1), 1, irreversible ? 0 : quiet + 1, irreversible ? this.stack.length : 0);
      unmake(this.b, m);
      if (this.aborted) {
        this.stack.pop();
        return null;
      }
      scores.set(i, s);
      if (s > alpha) {
        alpha = s;
        bestIndex = i;
      }
    }
    this.stack.pop();
    return { index: bestIndex, score: alpha, scores };
  }
}

/** Chooses a move for `req.turn`. Throws when the side to move has no legal move. */
export function chooseMove(req: AiRequest): AiResult {
  const rng = new Rng(req.rng);
  const legal = generateMoves(req.board, req.turn);
  if (legal.length === 0) throw new Error('chooseMove: no legal moves');
  const moves = dedupe(legal);
  const level = LEVELS[req.difficulty];
  const quiet = req.quietPlies ?? 0;
  const result = (m: Move, depth: number, score: number, nodes: number): AiResult => ({ path: movePath(m), rng: rng.state, depth, score, nodes });

  if (moves.length === 1) return result(moves[0] as Move, 0, 0, 0);

  const positions = req.positions ?? [];
  const historyHashes = positions.slice(0, -1).map(hashKey);
  const deadline = performance.now() + (req.timeMs ?? level.timeMs);

  if (req.difficulty === 'easy') {
    const search = new Search(req.board, deadline, historyHashes, false);
    const scores = search.scoreAll(req.turn, moves, level.maxDepth, quiet);
    if (rng.next() < 0.3) return result(rng.pick(moves), level.maxDepth, 0, search.nodes);
    const best = Math.max(...scores);
    const candidates = moves.filter((_, i) => (scores[i] as number) >= best - 60);
    const pick = rng.pick(candidates);
    return result(pick, level.maxDepth, scores[moves.indexOf(pick)] as number, search.nodes);
  }

  const search = new Search(req.board, deadline, historyHashes, req.difficulty === 'hard');
  let order = rng.shuffle(moves.map((_, i) => i));
  let bestIndex = order[0] as number;
  let bestScore = 0;
  let completed = 0;
  for (let depth = 1; depth <= level.maxDepth; depth++) {
    const iteration = search.root(req.turn, moves, order, depth, quiet);
    if (!iteration) break;
    completed = depth;
    bestScore = iteration.score;
    // Random choice among the moves that share the best score (variety without weakening play).
    const tied = order.filter((i) => iteration.scores.get(i) === iteration.score);
    bestIndex = tied.length > 1 ? rng.pick(tied) : iteration.index;
    order = [bestIndex, ...order.filter((i) => i !== bestIndex).sort((a, b) => (iteration.scores.get(b) ?? -INF) - (iteration.scores.get(a) ?? -INF))];
    if (Math.abs(bestScore) > MATE - 1000) break;
  }
  return result(moves[bestIndex] as Move, completed, bestScore, search.nodes);
}
