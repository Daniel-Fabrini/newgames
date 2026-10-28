import { Rng } from '../../utils/random';

/**
 * Snake rules engine (pure, UI independent).
 *
 * Rules implemented:
 * - The board is a grid (17×17 by default). The snake starts with 3 segments in the middle-left
 *   of the board, heading right, and moves exactly one cell per tick.
 * - Direction changes are buffered: up to 2 turns can be queued, one is applied per tick.
 *   A turn equal to the current/last queued direction (duplicate) or its opposite (180° reversal)
 *   is ignored, so the snake can never fold back onto its neck — but two quick turns (e.g. up
 *   then left while heading right) perform a legal U-turn over two ticks.
 * - Modes: `classic` — leaving the board (wall) or hitting the body ends the run;
 *   `endless` — the edges wrap around to the opposite side; only self-collision ends the run.
 * - Self-collision: the head may move into the cell the tail occupies at the start of the tick,
 *   because the tail moves away in the same tick. That cell is only blocked when the snake grows
 *   on that tick, which can only happen by eating food — and food never lies on the snake — so
 *   "chasing your own tail" is always legal. Any other body cell is fatal.
 * - Eating food grows the snake by one segment on the same tick (the tail stays in place) and adds
 *   the difficulty's points (10 / 15 / 20). New food appears on a random free cell (seeded Rng).
 * - Every 5th food spawns a bonus star on another free cell for 35 ticks. Eating it adds 5× the
 *   food points and does not grow the snake. If it is not eaten in time it disappears.
 * - Speed: the tick interval starts at the difficulty's `startMs` and drops by `accelMs` per food
 *   eaten, never below `minMs`.
 * - Win: the snake fills every cell of the board.
 */
export type Mode = 'classic' | 'endless';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Status = 'playing' | 'over' | 'won';
export type DeathCause = 'wall' | 'self';

export const MODES: readonly Mode[] = ['classic', 'endless'];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const COLS = 17;
export const ROWS = 17;
export const MAX_SIZE = 40;
export const INITIAL_LENGTH = 3;
export const MAX_QUEUE = 2;
export const BONUS_EVERY = 5;
export const BONUS_TICKS = 35;
export const BONUS_MULTIPLIER = 5;

export interface SpeedProfile {
  /** Tick interval at the start of a run (ms per cell). */
  startMs: number;
  /** Interval reduction per food eaten (ms). */
  accelMs: number;
  /** Fastest possible interval (ms). */
  minMs: number;
  /** Points per food. */
  points: number;
}

export const SPEEDS: Record<Difficulty, SpeedProfile> = {
  easy: { startMs: 200, accelMs: 2, minMs: 120, points: 10 },
  medium: { startMs: 150, accelMs: 3, minMs: 85, points: 15 },
  hard: { startMs: 110, accelMs: 3, minMs: 65, points: 20 },
};

export interface Point {
  x: number;
  y: number;
}

export interface Bonus extends Point {
  /** Ticks remaining before the bonus disappears. */
  ticksLeft: number;
}

export interface GameState {
  cols: number;
  rows: number;
  mode: Mode;
  difficulty: Difficulty;
  /** Segments, head first. */
  snake: Point[];
  /** Direction applied on the last tick (the way the head is facing). */
  dir: Direction;
  /** Buffered turns, applied one per tick (max MAX_QUEUE). */
  queue: Direction[];
  /** Null only when the board is full (won). */
  food: Point | null;
  bonus: Bonus | null;
  score: number;
  foodEaten: number;
  bonusEaten: number;
  ticks: number;
  /** Game time survived: sum of the intervals of every tick played (ms). */
  timeMs: number;
  status: Status;
  cause: DeathCause | null;
  rng: number;
}

export const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
const keyOf = (p: Point, cols: number) => p.y * cols + p.x;

export function inBounds(p: Point, cols: number, rows: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
}

/** Tick interval for the current state (ms). */
export function intervalMs(difficulty: Difficulty, foodEaten: number): number {
  const s = SPEEDS[difficulty];
  return Math.max(s.minMs, s.startMs - s.accelMs * foodEaten);
}

export const foodPoints = (difficulty: Difficulty): number => SPEEDS[difficulty].points;
export const bonusPoints = (difficulty: Difficulty): number => SPEEDS[difficulty].points * BONUS_MULTIPLIER;

/** Free cells (not snake and not in `exclude`), in reading order. */
export function freeCells(cols: number, rows: number, snake: readonly Point[], exclude: readonly (Point | null)[] = []): Point[] {
  const taken = new Set<number>();
  for (const p of snake) taken.add(keyOf(p, cols));
  for (const p of exclude) if (p) taken.add(keyOf(p, cols));
  const out: Point[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!taken.has(y * cols + x)) out.push({ x, y });
  return out;
}

/** Picks a random free cell; returns null when none is left. */
function pickFree(rng: Rng, cols: number, rows: number, snake: readonly Point[], exclude: readonly (Point | null)[]): Point | null {
  const cells = freeCells(cols, rows, snake, exclude);
  return cells.length === 0 ? null : rng.pick(cells);
}

export interface NewGameOptions {
  mode: Mode;
  difficulty: Difficulty;
  cols?: number;
  rows?: number;
}

export function newGame(seed: number, { mode, difficulty, cols = COLS, rows = ROWS }: NewGameOptions): GameState {
  if (cols < INITIAL_LENGTH || rows < 1 || cols > MAX_SIZE || rows > MAX_SIZE || cols * rows <= INITIAL_LENGTH) throw new Error('invalid board size');
  const y = Math.floor(rows / 2);
  const headX = Math.min(cols - 1, Math.max(INITIAL_LENGTH - 1, Math.floor(cols / 2) - 2));
  const snake: Point[] = Array.from({ length: INITIAL_LENGTH }, (_, i) => ({ x: headX - i, y }));
  const rng = new Rng(seed >>> 0);
  const food = pickFree(rng, cols, rows, snake, []);
  return {
    cols,
    rows,
    mode,
    difficulty,
    snake,
    dir: 'right',
    queue: [],
    food,
    bonus: null,
    score: 0,
    foodEaten: 0,
    bonusEaten: 0,
    ticks: 0,
    timeMs: 0,
    status: 'playing',
    cause: null,
    rng: rng.state,
  };
}

/** Direction the snake will have after all buffered turns. */
export function lastDirection(state: GameState): Direction {
  return state.queue[state.queue.length - 1] ?? state.dir;
}

/**
 * Buffers a direction change. Ignored (same state returned) when the run is not in progress,
 * the buffer is full, or the direction duplicates/reverses the last buffered direction.
 */
export function turn(state: GameState, dir: Direction): GameState {
  if (state.status !== 'playing') return state;
  if (state.queue.length >= MAX_QUEUE) return state;
  const last = lastDirection(state);
  if (dir === last || dir === OPPOSITE[last]) return state;
  return { ...state, queue: [...state.queue, dir] };
}

/** Next head position (wrapping in endless mode; may be out of bounds in classic mode). */
export function nextHead(state: GameState, dir: Direction): Point {
  const head = state.snake[0] as Point;
  const v = VECTORS[dir];
  const p = { x: head.x + v.x, y: head.y + v.y };
  if (state.mode === 'endless') {
    p.x = (p.x + state.cols) % state.cols;
    p.y = (p.y + state.rows) % state.rows;
  }
  return p;
}

/** Advances the game by one tick. Pure: returns a new state (or the same one when not playing). */
export function step(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  const [queued, ...rest] = state.queue;
  const dir = queued ?? state.dir;
  const target = nextHead(state, dir);
  const elapsed = intervalMs(state.difficulty, state.foodEaten);
  const base = { ...state, dir, queue: rest, ticks: state.ticks + 1, timeMs: state.timeMs + elapsed };

  if (!inBounds(target, state.cols, state.rows)) return { ...base, status: 'over', cause: 'wall' };

  const eats = state.food !== null && samePoint(target, state.food);
  // The tail leaves its cell this tick unless the snake grows (see the rules above).
  const body = eats ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => samePoint(p, target))) return { ...base, status: 'over', cause: 'self' };

  const snake = [target, ...body];
  const rng = new Rng(state.rng);
  let { score, foodEaten, bonusEaten } = state;
  let food = state.food;
  let bonus: Bonus | null = state.bonus;

  if (bonus && samePoint(bonus, target)) {
    score += bonusPoints(state.difficulty);
    bonusEaten += 1;
    bonus = null;
  } else if (bonus) {
    bonus = bonus.ticksLeft > 1 ? { ...bonus, ticksLeft: bonus.ticksLeft - 1 } : null;
  }

  if (eats) {
    score += foodPoints(state.difficulty);
    foodEaten += 1;
    if (snake.length >= state.cols * state.rows) {
      return { ...base, snake, food: null, bonus: null, score, foodEaten, bonusEaten, status: 'won', rng: rng.state };
    }
    food = pickFree(rng, state.cols, state.rows, snake, [bonus]);
    if (!food && bonus) {
      // The bonus sits on the only free cell left: food takes priority.
      food = { x: bonus.x, y: bonus.y };
      bonus = null;
    }
    if (foodEaten % BONUS_EVERY === 0 && !bonus) {
      const cell = pickFree(rng, state.cols, state.rows, snake, [food]);
      if (cell) bonus = { ...cell, ticksLeft: BONUS_TICKS };
    }
  }

  return { ...base, snake, food, bonus, score, foodEaten, bonusEaten, rng: rng.state };
}

/** Direction from `from` to the adjacent cell `to` (taking wrap-around into account), or null. */
export function directionBetween(from: Point, to: Point, cols: number, rows: number, wrap: boolean): Direction | null {
  for (const d of DIRECTIONS) {
    const v = VECTORS[d];
    let x = from.x + v.x;
    let y = from.y + v.y;
    if (wrap) {
      x = (x + cols) % cols;
      y = (y + rows) % rows;
    }
    if (x === to.x && y === to.y) return d;
  }
  return null;
}

export const snakeLength = (state: GameState): number => state.snake.length;
export const isFinished = (state: GameState): boolean => state.status !== 'playing';
