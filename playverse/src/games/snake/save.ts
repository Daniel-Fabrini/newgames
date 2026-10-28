import { v, type Validator } from '../../services/storage/schema';
import type { SaveSpec } from '../../services/saves';
import {
  BONUS_EVERY,
  BONUS_TICKS,
  DIFFICULTIES,
  DIRECTIONS,
  INITIAL_LENGTH,
  MAX_QUEUE,
  MAX_SIZE,
  MODES,
  OPPOSITE,
  bonusPoints,
  directionBetween,
  foodPoints,
  inBounds,
  samePoint,
  type Bonus,
  type Direction,
  type GameState,
  type Point,
} from './engine';

const coord = v.int({ min: 0, max: MAX_SIZE - 1 });
const point: Validator<Point> = v.object({ x: coord, y: coord });
const bonus: Validator<Bonus> = v.object({ x: coord, y: coord, ticksLeft: v.int({ min: 1, max: BONUS_TICKS }) });
const direction = v.literal(...DIRECTIONS);

/** Semantic checks: a saved run must be a reachable, in-progress position. */
export function checkState(s: GameState): true | string {
  const { cols, rows, snake } = s;
  if (s.status !== 'playing' || s.cause !== null) return 'finished runs are not resumable';
  if (snake.length < INITIAL_LENGTH || snake.length >= cols * rows) return 'invalid snake length';
  if (snake.length !== INITIAL_LENGTH + s.foodEaten) return 'length does not match food eaten';
  if (!snake.every((p) => inBounds(p, cols, rows))) return 'snake out of bounds';
  if (new Set(snake.map((p) => p.y * cols + p.x)).size !== snake.length) return 'snake overlaps itself';
  const wrap = s.mode === 'endless';
  for (let i = 1; i < snake.length; i++) {
    if (directionBetween(snake[i] as Point, snake[i - 1] as Point, cols, rows, wrap) === null) return 'snake is not contiguous';
  }
  if (directionBetween(snake[1] as Point, snake[0] as Point, cols, rows, wrap) !== s.dir) return 'direction does not match the head';
  let last: Direction = s.dir;
  for (const d of s.queue) {
    if (d === last || d === OPPOSITE[last]) return 'invalid buffered turn';
    last = d;
  }
  if (!s.food || !inBounds(s.food, cols, rows) || snake.some((p) => samePoint(p, s.food as Point))) return 'invalid food';
  if (s.bonus) {
    const b = s.bonus;
    if (!inBounds(b, cols, rows) || samePoint(b, s.food) || snake.some((p) => samePoint(p, b))) return 'invalid bonus';
  }
  if (s.score !== s.foodEaten * foodPoints(s.difficulty) + s.bonusEaten * bonusPoints(s.difficulty)) return 'score does not match';
  if (s.bonusEaten > Math.floor(s.foodEaten / BONUS_EVERY)) return 'too many bonuses';
  if (s.ticks < s.foodEaten) return 'tick count too low';
  return true;
}

export const gameStateValidator: Validator<GameState> = v.refine(
  v.object({
    cols: v.int({ min: INITIAL_LENGTH, max: MAX_SIZE }),
    rows: v.int({ min: 1, max: MAX_SIZE }),
    mode: v.literal(...MODES),
    difficulty: v.literal(...DIFFICULTIES),
    snake: v.array(point, { minLength: INITIAL_LENGTH, maxLength: MAX_SIZE * MAX_SIZE }),
    dir: direction,
    queue: v.array(direction, { maxLength: MAX_QUEUE }),
    food: v.nullable(point),
    bonus: v.nullable(bonus),
    score: v.int({ min: 0 }),
    foodEaten: v.int({ min: 0 }),
    bonusEaten: v.int({ min: 0 }),
    ticks: v.int({ min: 0 }),
    timeMs: v.number({ min: 0 }),
    status: v.literal('playing', 'over', 'won'),
    cause: v.nullable(v.literal('wall', 'self')),
    rng: v.int({ min: 0, max: 0xffffffff }),
  }),
  checkState,
);

export interface SavedSnake {
  game: GameState;
}

export const saveSpec: SaveSpec<SavedSnake> = {
  gameId: 'snake',
  version: 1,
  validate: v.object({ game: gameStateValidator }),
};
