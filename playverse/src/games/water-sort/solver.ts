import { CAPACITY, hasUsefulMove, isSolved, unpour, type Bottles, type Move } from './engine';

/**
 * Water Sort solver: weighted A* over canonical positions.
 *
 * - Positions are memoised by a canonical key (bottles sorted), so permutations of the same
 *   bottles are explored once.
 * - Pointless pours are pruned without losing solutions: pouring out of a finished bottle,
 *   pouring a single-colour bottle into an empty one (same canonical position) and pouring into
 *   any empty bottle other than the first one (all empty bottles are equivalent).
 * - The heuristic is an admissible lower bound on the remaining pours: every run that is not at
 *   the bottom of its bottle must be poured at least once, and for each colour at most one bottle
 *   that has it at the bottom can keep it. With weight 1 the solution is optimal; larger weights
 *   trade a few extra moves for much faster searches.
 * - When the search space is exhausted without a solution, the position is proven unsolvable.
 *
 * Each bottle is packed into a 16-bit code (one 4-bit digit per unit, colour + 1, bottom digit
 * first), so a position is a small Uint16Array and its key a short string.
 */
export interface SolveOptions {
  /** Maximum number of expanded positions before giving up (status "budget"). */
  maxNodes?: number;
  /** Heuristic weight (1 = optimal). */
  weight?: number;
}

export interface SolverMove {
  from: number;
  to: number;
}

export type SolveResult =
  | { status: 'solved'; moves: SolverMove[]; expanded: number }
  | { status: 'unsolvable'; expanded: number }
  | { status: 'budget'; expanded: number };

/** Colours supported by the packed representation (digits 1..15). */
export const SOLVER_MAX_COLOURS = 15;

const CODES = 1 << (4 * CAPACITY);
const LEN = new Uint8Array(CODES);
const TOP = new Uint8Array(CODES); // top digit (colour + 1), 0 when empty
const RUN = new Uint8Array(CODES); // length of the top run
const RUNS = new Uint8Array(CODES); // number of runs
const BOTTOM = new Uint8Array(CODES); // bottom digit

for (let code = 0; code < CODES; code++) {
  let len = 0;
  while (len < CAPACITY && ((code >> (4 * len)) & 15) !== 0) len++;
  // Only well-formed codes (no gaps) are ever used; others keep zeros.
  if (code >> (4 * len) !== 0) continue;
  LEN[code] = len;
  if (len === 0) continue;
  const top = (code >> (4 * (len - 1))) & 15;
  TOP[code] = top;
  BOTTOM[code] = code & 15;
  let run = 1;
  while (run < len && ((code >> (4 * (len - 1 - run))) & 15) === top) run++;
  RUN[code] = run;
  let runs = 1;
  for (let i = 1; i < len; i++) if (((code >> (4 * i)) & 15) !== ((code >> (4 * (i - 1))) & 15)) runs++;
  RUNS[code] = runs;
}

function encodeBottle(bottle: readonly number[]): number {
  let code = 0;
  bottle.forEach((c, i) => {
    if (!Number.isInteger(c) || c < 0 || c >= SOLVER_MAX_COLOURS) throw new RangeError(`colour ${c} not supported by the solver`);
    code |= (c + 1) << (4 * i);
  });
  return code;
}

function encode(bottles: Bottles): Uint16Array {
  const out = new Uint16Array(bottles.length);
  bottles.forEach((b, i) => {
    if (b.length > CAPACITY) throw new RangeError('bottle over capacity');
    out[i] = encodeBottle(b);
  });
  return out;
}

const sortScratch: number[] = [];

function keyOf(state: Uint16Array): string {
  const a = sortScratch;
  a.length = 0;
  // Insertion sort (positions have at most ~16 bottles).
  for (let i = 0; i < state.length; i++) {
    const v = state[i] as number;
    let j = a.length;
    a.push(v);
    while (j > 0 && (a[j - 1] as number) > v) {
      a[j] = a[j - 1] as number;
      j--;
    }
    a[j] = v;
  }
  return String.fromCharCode.apply(null, a);
}

/** Canonical key of a position: order of the bottles does not matter. */
export function canonicalKey(bottles: Bottles): string {
  return keyOf(encode(bottles));
}

const bottomScratch = new Int32Array(16);

function heuristicOf(state: Uint16Array): number {
  let h = 0;
  bottomScratch.fill(0);
  for (let i = 0; i < state.length; i++) {
    const code = state[i] as number;
    if (code === 0) continue;
    h += (RUNS[code] as number) - 1;
    const b = BOTTOM[code] as number;
    bottomScratch[b] = (bottomScratch[b] as number) + 1;
  }
  for (let c = 1; c < 16; c++) {
    const n = bottomScratch[c] as number;
    if (n > 1) h += n - 1;
  }
  return h;
}

/** Admissible lower bound on the number of pours still needed (0 when solved). */
export function lowerBound(bottles: Bottles): number {
  return heuristicOf(encode(bottles));
}

function isSolvedState(state: Uint16Array): boolean {
  for (let i = 0; i < state.length; i++) {
    const code = state[i] as number;
    if (code !== 0 && (LEN[code] !== CAPACITY || RUN[code] !== CAPACITY)) return false;
  }
  return true;
}

/** Binary min-heap of node ids ordered by (priority, h). */
class Heap {
  private ids: number[] = [];
  private readonly prio: number[];
  private readonly hs: number[];

  constructor(prio: number[], hs: number[]) {
    this.prio = prio;
    this.hs = hs;
  }

  get size(): number {
    return this.ids.length;
  }

  private less(a: number, b: number): boolean {
    const pa = this.prio[a] as number;
    const pb = this.prio[b] as number;
    return pa < pb || (pa === pb && (this.hs[a] as number) < (this.hs[b] as number));
  }

  push(id: number): void {
    const ids = this.ids;
    ids.push(id);
    let i = ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(ids[i] as number, ids[parent] as number)) break;
      const tmp = ids[i] as number;
      ids[i] = ids[parent] as number;
      ids[parent] = tmp;
      i = parent;
    }
  }

  pop(): number {
    const ids = this.ids;
    const top = ids[0] as number;
    const last = ids.pop() as number;
    if (ids.length > 0) {
      ids[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < ids.length && this.less(ids[l] as number, ids[m] as number)) m = l;
        if (r < ids.length && this.less(ids[r] as number, ids[m] as number)) m = r;
        if (m === i) break;
        const tmp = ids[i] as number;
        ids[i] = ids[m] as number;
        ids[m] = tmp;
        i = m;
      }
    }
    return top;
  }
}

/** Digit `d` repeated in slots [from, from + count). */
function fill(d: number, from: number, count: number): number {
  let v = 0;
  for (let k = 0; k < count; k++) v |= d << (4 * (from + k));
  return v;
}

export function solve(bottles: Bottles, options: SolveOptions = {}): SolveResult {
  const maxNodes = options.maxNodes ?? 50_000;
  const weight = options.weight ?? 1.5;
  const start = encode(bottles);
  if (isSolvedState(start)) return { status: 'solved', moves: [], expanded: 0 };
  const size = start.length;

  const startKey = keyOf(start);
  const states: Uint16Array[] = [start];
  const keys: string[] = [startKey];
  const parent: number[] = [-1];
  const moveFrom: number[] = [-1];
  const moveTo: number[] = [-1];
  const g: number[] = [0];
  const hs: number[] = [heuristicOf(start)];
  const prio: number[] = [weight * (hs[0] as number)];
  const best = new Map<string, number>([[startKey, 0]]);
  const heap = new Heap(prio, hs);
  heap.push(0);
  let expanded = 0;
  const bottoms = new Int32Array(16);

  while (heap.size > 0) {
    if (expanded >= maxNodes) return { status: 'budget', expanded };
    const id = heap.pop();
    const depth = g[id] as number;
    // Skip stale entries (the position was reached again with fewer moves).
    if ((best.get(keys[id] as string) as number) < depth) continue;
    const state = states[id] as Uint16Array;
    const parentH = hs[id] as number;
    expanded++;

    let firstEmpty = -1;
    bottoms.fill(0);
    for (let i = 0; i < size; i++) {
      const code = state[i] as number;
      if (code === 0) {
        if (firstEmpty < 0) firstEmpty = i;
      } else {
        const b = BOTTOM[code] as number;
        bottoms[b] = (bottoms[b] as number) + 1;
      }
    }

    for (let i = 0; i < size; i++) {
      const s = state[i] as number;
      const len = LEN[s] as number;
      if (len === 0) continue;
      const run = RUN[s] as number;
      const uniform = run === len;
      if (uniform && len === CAPACITY) continue;
      const top = TOP[s] as number;

      for (let j = 0; j < size; j++) {
        if (j === i) continue;
        const t = state[j] as number;
        const tl = LEN[t] as number;
        if (tl === CAPACITY) continue;
        let amount: number;
        if (tl === 0) {
          if (uniform || j !== firstEmpty) continue;
          amount = run;
        } else {
          if (TOP[t] !== top) continue;
          amount = Math.min(run, CAPACITY - tl);
        }
        const child = state.slice();
        child[i] = s & ~fill(15, len - amount, amount);
        child[j] = t | fill(top, tl, amount);
        const childG = depth + 1;
        const key = keyOf(child);
        const known = best.get(key);
        if (known !== undefined && known <= childG) continue;
        best.set(key, childG);

        // Incremental heuristic: only the source and the target changed.
        let h = parentH;
        if (amount === run && amount < len) h--; // the source's top run is gone
        if (amount === len && (bottoms[top] as number) > 1) h--; // source emptied: one fewer duplicate bottom
        if (tl === 0 && (bottoms[top] as number) - (amount === len ? 1 : 0) >= 1) h++; // new duplicate bottom

        const childId = states.length;
        states.push(child);
        keys.push(key);
        parent.push(id);
        moveFrom.push(i);
        moveTo.push(j);
        g.push(childG);
        hs.push(h);
        prio.push(childG + weight * h);

        if (h === 0 && isSolvedState(child)) {
          const moves: SolverMove[] = [];
          for (let n = childId; n > 0; n = parent[n] as number) moves.push({ from: moveFrom[n] as number, to: moveTo[n] as number });
          moves.reverse();
          return { status: 'solved', moves, expanded };
        }
        heap.push(childId);
      }
    }
  }
  return { status: 'unsolvable', expanded };
}

export type HintResult = { status: 'move'; from: number; to: number; remaining: number } | { status: 'unsolvable' } | { status: 'unknown' };

/**
 * Next move of a solution from the current position. "unsolvable" is a proof (the whole search
 * space was explored); "unknown" means no solution was found within the node budget.
 */
export function findHint(bottles: Bottles): HintResult {
  for (const opts of [
    { weight: 1.5, maxNodes: 20_000 },
    { weight: 5, maxNodes: 80_000 },
  ]) {
    const result = solve(bottles, opts);
    if (result.status === 'unsolvable') return { status: 'unsolvable' };
    if (result.status === 'solved') {
      const first = result.moves[0];
      return first ? { status: 'move', from: first.from, to: first.to, remaining: result.moves.length } : { status: 'unknown' };
    }
  }
  return { status: 'unknown' };
}

/** Why a position can no longer lead to a win. */
export type DeadEnd = 'no-moves' | 'unsolvable';

/** Node budget for the automatic check after each pour (a few milliseconds on a phone). */
export const DEAD_END_NODES = 30_000;

/**
 * Detects a dead end: either no useful pour is left, or the solver explored every reachable
 * position without finding a solution (a proof). When the search runs out of budget the position
 * is treated as still playable, so the player is never told to give up on a solvable level.
 */
export function deadEnd(bottles: Bottles, maxNodes = DEAD_END_NODES): DeadEnd | null {
  if (isSolved(bottles)) return null;
  if (!hasUsefulMove(bottles)) return 'no-moves';
  return solve(bottles, { weight: 1.5, maxNodes }).status === 'unsolvable' ? 'unsolvable' : null;
}

/**
 * How many pours must be undone, from the end of `history`, to reach a position that is not a
 * dead end. Returns null when even the start position is a dead end (never the case for
 * generated levels, which are verified solvable).
 */
export function poursToSolvable(current: Bottles, history: readonly Move[], maxNodes = DEAD_END_NODES): number | null {
  let bottles: Bottles = current;
  for (let steps = 1; steps <= history.length; steps++) {
    const move = history[history.length - steps] as Move;
    const previous = unpour(bottles, move);
    if (!previous) return null;
    bottles = previous;
    if (deadEnd(bottles, maxNodes) === null) return steps;
  }
  return null;
}
