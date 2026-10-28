import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import {
  BONUS_EVERY,
  BONUS_MULTIPLIER,
  BONUS_TICKS,
  COLS,
  DIFFICULTIES,
  DIRECTIONS,
  INITIAL_LENGTH,
  MAX_QUEUE,
  ROWS,
  SPEEDS,
  directionBetween,
  freeCells,
  intervalMs,
  newGame,
  samePoint,
  step,
  turn,
  type Direction,
  type GameState,
  type Point,
} from './engine';

const P = (x: number, y: number): Point => ({ x, y });

/** Builds a playing state from explicit cells (head first). */
function make(cells: Array<[number, number]>, extra: Partial<GameState> = {}): GameState {
  return {
    cols: COLS,
    rows: ROWS,
    mode: 'classic',
    difficulty: 'medium',
    snake: cells.map(([x, y]) => P(x, y)),
    dir: 'right',
    queue: [],
    food: P(0, 0),
    bonus: null,
    score: 0,
    foodEaten: 0,
    bonusEaten: 0,
    ticks: 0,
    timeMs: 0,
    status: 'playing',
    cause: null,
    rng: 12345,
    ...extra,
  };
}

const run = (state: GameState, n: number): GameState => {
  let s = state;
  for (let i = 0; i < n; i++) s = step(s);
  return s;
};

function assertConsistent(s: GameState): void {
  const keys = new Set(s.snake.map((p) => p.y * s.cols + p.x));
  expect(keys.size).toBe(s.snake.length);
  for (const p of s.snake) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThan(s.cols);
    expect(p.y).toBeLessThan(s.rows);
  }
  if (s.food) expect(s.snake.some((p) => samePoint(p, s.food as Point))).toBe(false);
  if (s.bonus) {
    const b = s.bonus;
    expect(s.snake.some((p) => samePoint(p, b))).toBe(false);
    if (s.food) expect(samePoint(b, s.food)).toBe(false);
  }
}

describe('new game', () => {
  it('starts with a 3-segment snake heading right in the middle row', () => {
    const s = newGame(7, { mode: 'classic', difficulty: 'easy' });
    expect(s.snake).toEqual([P(6, 8), P(5, 8), P(4, 8)]);
    expect(s.snake).toHaveLength(INITIAL_LENGTH);
    expect(s.dir).toBe('right');
    expect(s.status).toBe('playing');
    expect(s.score).toBe(0);
    expect(s.cols).toBe(17);
    expect(s.rows).toBe(17);
    assertConsistent(s);
  });

  it('places the first food on a free cell for every seed', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = newGame(seed, { mode: 'endless', difficulty: 'hard' });
      expect(s.food).not.toBeNull();
      assertConsistent(s);
    }
  });

  it('rejects boards that are too small for the starting snake', () => {
    expect(() => newGame(1, { mode: 'classic', difficulty: 'easy', cols: 2, rows: 5 })).toThrow();
    expect(() => newGame(1, { mode: 'classic', difficulty: 'easy', cols: 3, rows: 1 })).toThrow();
  });
});

describe('movement', () => {
  it('moves one cell per tick in the current direction, keeping its length', () => {
    const s = make([
      [5, 5],
      [4, 5],
      [3, 5],
    ], { food: P(0, 0) });
    const n = step(s);
    expect(n.snake).toEqual([P(6, 5), P(5, 5), P(4, 5)]);
    expect(n.ticks).toBe(1);
    expect(n.timeMs).toBe(intervalMs('medium', 0));
    const m = run(n, 3);
    expect(m.snake).toEqual([P(9, 5), P(8, 5), P(7, 5)]);
  });

  it('moves in all four directions', () => {
    const base = make([
      [5, 5],
      [4, 5],
      [3, 5],
    ]);
    expect(step(turn(base, 'up')).snake[0]).toEqual(P(5, 4));
    expect(step(turn(base, 'down')).snake[0]).toEqual(P(5, 6));
    expect(step(base).snake[0]).toEqual(P(6, 5));
    const goingLeft = make(
      [
        [5, 5],
        [6, 5],
        [7, 5],
      ],
      { dir: 'left' },
    );
    expect(step(goingLeft).snake[0]).toEqual(P(4, 5));
  });

  it('does nothing once the run is over', () => {
    const over = make([[1, 1], [0, 1], [0, 0]], { status: 'over', cause: 'wall' });
    expect(step(over)).toBe(over);
    expect(turn(over, 'up')).toBe(over);
  });

  it('does not mutate the input state', () => {
    const s = newGame(99, { mode: 'endless', difficulty: 'medium' });
    const copy = structuredClone(s);
    run(turn(turn(s, 'up'), 'left'), 30);
    expect(s).toEqual(copy);
  });
});

describe('walls (classic) versus wrap-around (endless)', () => {
  const edges: Array<{ dir: Direction; cells: Array<[number, number]>; wrapped: Point }> = [
    { dir: 'right', cells: [[16, 5], [15, 5], [14, 5]], wrapped: P(0, 5) },
    { dir: 'left', cells: [[0, 5], [1, 5], [2, 5]], wrapped: P(16, 5) },
    { dir: 'up', cells: [[5, 0], [5, 1], [5, 2]], wrapped: P(5, 16) },
    { dir: 'down', cells: [[5, 16], [5, 15], [5, 14]], wrapped: P(5, 0) },
  ];

  for (const { dir, cells, wrapped } of edges) {
    it(`classic: moving ${dir} off the board ends the run (wall)`, () => {
      const s = make(cells, { dir, food: P(9, 9) });
      const n = step(s);
      expect(n.status).toBe('over');
      expect(n.cause).toBe('wall');
      expect(n.snake).toEqual(s.snake);
    });

    it(`endless: moving ${dir} off the board wraps to the opposite edge`, () => {
      const s = make(cells, { dir, mode: 'endless', food: P(9, 9) });
      const n = step(s);
      expect(n.status).toBe('playing');
      expect(n.snake[0]).toEqual(wrapped);
      expect(n.snake).toHaveLength(3);
    });
  }

  it('endless: eats food across the edge', () => {
    const s = make([[16, 5], [15, 5], [14, 5]], { mode: 'endless', food: P(0, 5) });
    const n = step(s);
    expect(n.foodEaten).toBe(1);
    expect(n.snake).toEqual([P(0, 5), P(16, 5), P(15, 5), P(14, 5)]);
  });

  it('endless: self-collision still ends the run, also through a wrapped edge', () => {
    // Head (0,5) heading down; the body continues across the left edge on column 16.
    const s = make([[0, 5], [0, 4], [16, 4], [16, 5], [16, 6]], { mode: 'endless', dir: 'down', food: P(8, 8) });
    const n = step(turn(s, 'left'));
    expect(n.status).toBe('over');
    expect(n.cause).toBe('self');
  });
});

describe('self collision', () => {
  it('hitting a body segment ends the run', () => {
    // Head (5,5) heading left; turning down hits (5,6), which is not the tail.
    const s = make([[5, 5], [6, 5], [6, 6], [5, 6], [4, 6]], { dir: 'left', food: P(0, 0) });
    const n = step(turn(s, 'down'));
    expect(n.status).toBe('over');
    expect(n.cause).toBe('self');
    expect(n.snake).toEqual(s.snake);
  });

  it('moving into the tail cell is legal because the tail moves away on the same tick', () => {
    // 2×2 loop: the head (5,5) moves down into the tail cell (5,6).
    let s = make([[5, 5], [6, 5], [6, 6], [5, 6]], { dir: 'left', food: P(0, 0) });
    s = step(turn(s, 'down'));
    expect(s.status).toBe('playing');
    expect(s.snake).toEqual([P(5, 6), P(5, 5), P(6, 5), P(6, 6)]);
    // Keep chasing the tail around the loop for several laps.
    const loop: Direction[] = ['right', 'up', 'left', 'down'];
    for (let i = 0; i < 12; i++) {
      s = step(turn(s, loop[i % 4] as Direction));
      expect(s.status).toBe('playing');
      assertConsistent(s);
    }
  });

  it('when the snake grows the tail stays, so the snake gets longer instead of moving the tail', () => {
    const s = make([[5, 5], [4, 5], [3, 5]], { food: P(6, 5) });
    const n = step(s);
    expect(n.snake).toEqual([P(6, 5), P(5, 5), P(4, 5), P(3, 5)]);
  });

  it('a 180° reversal is ignored, so the head never runs into its neck', () => {
    const s = make([[5, 5], [4, 5], [3, 5]]);
    const n = step(turn(s, 'left'));
    expect(n.status).toBe('playing');
    expect(n.snake[0]).toEqual(P(6, 5));
  });
});

describe('growth and scoring', () => {
  it('eating food grows the snake by one, adds points and respawns food on a free cell', () => {
    const s = make([[5, 5], [4, 5], [3, 5]], { food: P(6, 5) });
    const n = step(s);
    expect(n.snake).toHaveLength(4);
    expect(n.foodEaten).toBe(1);
    expect(n.score).toBe(SPEEDS.medium.points);
    expect(n.food).not.toBeNull();
    expect(n.food).not.toEqual(P(6, 5));
    assertConsistent(n);
  });

  it('awards more points per food on harder difficulties', () => {
    const gained = DIFFICULTIES.map((difficulty) => step(make([[5, 5], [4, 5], [3, 5]], { food: P(6, 5), difficulty })).score);
    expect(gained).toEqual([10, 15, 20]);
  });

  it('spawns a bonus after every 5th food, worth 5× the points without growing the snake', () => {
    const cells: Array<[number, number]> = [[7, 5], [6, 5], [5, 5], [4, 5], [3, 5], [2, 5], [1, 5]];
    const s = make(cells, { foodEaten: BONUS_EVERY - 1, food: P(8, 5) });
    const n = step(s);
    expect(n.foodEaten).toBe(BONUS_EVERY);
    expect(n.bonus).not.toBeNull();
    expect(n.bonus?.ticksLeft).toBe(BONUS_TICKS);
    assertConsistent(n);

    const withBonus = make([[5, 5], [4, 5], [3, 5]], { food: P(0, 0), bonus: { x: 6, y: 5, ticksLeft: 10 } });
    const ate = step(withBonus);
    expect(ate.bonus).toBeNull();
    expect(ate.bonusEaten).toBe(1);
    expect(ate.score).toBe(SPEEDS.medium.points * BONUS_MULTIPLIER);
    expect(ate.snake).toHaveLength(3);
  });

  it('the bonus disappears when its time runs out', () => {
    let s = make([[5, 5], [4, 5], [3, 5]], { food: P(0, 0), bonus: { x: 9, y: 12, ticksLeft: 3 } });
    s = step(s);
    expect(s.bonus?.ticksLeft).toBe(2);
    s = step(s);
    expect(s.bonus?.ticksLeft).toBe(1);
    s = step(s);
    expect(s.bonus).toBeNull();
    expect(s.score).toBe(0);
  });
});

describe('input buffering', () => {
  const base = () => make([[5, 5], [4, 5], [3, 5]], { food: P(0, 0) });

  it('ignores reversals and duplicates', () => {
    const s = base();
    expect(turn(s, 'left')).toBe(s);
    expect(turn(s, 'right')).toBe(s);
    const up = turn(s, 'up');
    expect(up.queue).toEqual(['up']);
    expect(turn(up, 'up')).toBe(up);
    // A reversal of the last *buffered* direction is ignored too.
    expect(turn(up, 'down')).toBe(up);
  });

  it(`buffers at most ${MAX_QUEUE} turns and applies one per tick`, () => {
    let s = turn(turn(base(), 'up'), 'left');
    expect(s.queue).toEqual(['up', 'left']);
    expect(turn(s, 'down')).toBe(s);
    s = step(s);
    expect(s.dir).toBe('up');
    expect(s.snake[0]).toEqual(P(5, 4));
    expect(s.queue).toEqual(['left']);
    s = step(s);
    expect(s.dir).toBe('left');
    expect(s.snake[0]).toEqual(P(4, 4));
    expect(s.queue).toEqual([]);
    expect(s.status).toBe('playing');
  });

  it('two quick turns make a legal U-turn over two ticks', () => {
    const s = run(turn(turn(base(), 'down'), 'left'), 2);
    expect(s.snake).toEqual([P(4, 6), P(5, 6), P(5, 5)]);
    expect(s.status).toBe('playing');
  });

  it('accepts new turns after the buffer drains', () => {
    let s = turn(turn(base(), 'up'), 'left');
    s = step(s);
    s = turn(s, 'down');
    expect(s.queue).toEqual(['left', 'down']);
  });
});

describe('food spawning', () => {
  it('never spawns food or a bonus on the snake during long random runs', () => {
    const driver = new Rng(2024);
    let s = newGame(1, { mode: 'endless', difficulty: 'hard', cols: 8, rows: 8 });
    let deaths = 0;
    for (let i = 0; i < 4000; i++) {
      if (driver.bool(0.3)) s = turn(s, driver.pick(DIRECTIONS));
      // Steer towards the food half of the time so the snake grows and the board fills up.
      if (s.food && driver.bool(0.5)) {
        const head = s.snake[0] as Point;
        const dx = s.food.x - head.x;
        const dy = s.food.y - head.y;
        s = turn(s, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      }
      s = step(s);
      assertConsistent(s);
      if (s.status !== 'playing') {
        deaths++;
        s = newGame(i + 2, { mode: i % 2 ? 'endless' : 'classic', difficulty: 'easy', cols: 8, rows: 8 });
      }
    }
    expect(deaths).toBeGreaterThan(0);
  });

  it('uses the only free cell when the board is almost full', () => {
    // 5×1 board: snake (2,0),(1,0),(0,0) → free cells (3,0) and (4,0).
    const g = newGame(5, { mode: 'classic', difficulty: 'easy', cols: 5, rows: 1 });
    expect([P(3, 0), P(4, 0)]).toContainEqual(g.food);
    const s = make([[2, 0], [1, 0], [0, 0]], { cols: 5, rows: 1, food: P(3, 0) });
    const n = step(s);
    expect(freeCells(5, 1, n.snake)).toEqual([P(4, 0)]);
    expect(n.food).toEqual(P(4, 0));
    expect(step(n).status).toBe('won');
  });

  it('food takes the bonus cell when that is the only free cell left', () => {
    // 3×2 board, snake of 4, food ahead, bonus on the last free cell.
    const s = make([[1, 0], [0, 0], [0, 1], [1, 1]], { cols: 3, rows: 2, food: P(2, 0), bonus: { x: 2, y: 1, ticksLeft: 5 }, foodEaten: 1 });
    const n = step(s);
    expect(n.status).toBe('playing');
    expect(n.food).toEqual(P(2, 1));
    expect(n.bonus).toBeNull();
  });
});

describe('speed progression', () => {
  it('starts at the difficulty speed, accelerates per food and is capped at the minimum interval', () => {
    for (const d of DIFFICULTIES) {
      const { startMs, accelMs, minMs } = SPEEDS[d];
      expect(intervalMs(d, 0)).toBe(startMs);
      expect(intervalMs(d, 1)).toBe(startMs - accelMs);
      expect(intervalMs(d, 1000)).toBe(minMs);
      let prev = Infinity;
      for (let n = 0; n < 200; n++) {
        const ms = intervalMs(d, n);
        expect(ms).toBeLessThanOrEqual(prev);
        expect(ms).toBeGreaterThanOrEqual(minMs);
        prev = ms;
      }
    }
  });

  it('harder difficulties are faster at every point of a run', () => {
    for (let n = 0; n < 100; n++) {
      expect(intervalMs('hard', n)).toBeLessThan(intervalMs('medium', n));
      expect(intervalMs('medium', n)).toBeLessThan(intervalMs('easy', n));
    }
  });

  it('accumulates game time using the interval of each tick', () => {
    const s = make([[5, 5], [4, 5], [3, 5]], { food: P(6, 5), difficulty: 'hard' });
    const n = run(s, 2);
    expect(n.foodEaten).toBe(1);
    expect(n.timeMs).toBe(intervalMs('hard', 0) + intervalMs('hard', 1));
  });
});

describe('determinism', () => {
  function play(seed: number): GameState[] {
    const inputs = new Rng(77);
    let s = newGame(seed, { mode: 'endless', difficulty: 'medium' });
    const out: GameState[] = [];
    for (let i = 0; i < 400 && s.status === 'playing'; i++) {
      if (inputs.bool(0.25)) s = turn(s, inputs.pick(DIRECTIONS));
      s = step(s);
      out.push(s);
    }
    return out;
  }

  it('the same seed and inputs always produce the same run', () => {
    expect(play(4242)).toEqual(play(4242));
  });

  it('different seeds produce different food positions', () => {
    const foods = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(newGame(i + 1, { mode: 'classic', difficulty: 'easy' }).food)));
    expect(foods.size).toBeGreaterThan(5);
  });
});

describe('winning', () => {
  it('fills a tiny board and wins', () => {
    const s = newGame(3, { mode: 'classic', difficulty: 'easy', cols: 4, rows: 1 });
    expect(s.food).toEqual(P(3, 0));
    const n = step(s);
    expect(n.status).toBe('won');
    expect(n.snake).toHaveLength(4);
    expect(n.food).toBeNull();
    expect(n.score).toBe(10);
  });

  // Hamiltonian cycle of a 4×4 board: following it the snake can never collide.
  const CYCLE: Point[] = [
    [0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [1, 2],
    [2, 2], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1],
  ].map(([x, y]) => P(x as number, y as number));

  for (const mode of ['classic', 'endless'] as const) {
    it(`${mode}: following a Hamiltonian cycle fills the 4×4 board and wins`, () => {
      let s = make([[2, 0], [1, 0], [0, 0]], { cols: 4, rows: 4, mode, food: P(3, 3), rng: 9 });
      let guard = 0;
      while (s.status === 'playing' && guard++ < 5000) {
        const head = s.snake[0] as Point;
        const idx = CYCLE.findIndex((p) => samePoint(p, head));
        const next = CYCLE[(idx + 1) % CYCLE.length] as Point;
        const dir = directionBetween(head, next, 4, 4, false) as Direction;
        s = step(turn(s, dir));
        assertConsistent(s);
      }
      expect(s.status).toBe('won');
      expect(s.snake).toHaveLength(16);
      expect(s.foodEaten).toBe(13);
      expect(s.food).toBeNull();
      expect(s.score).toBe(13 * SPEEDS.medium.points + s.bonusEaten * SPEEDS.medium.points * BONUS_MULTIPLIER);
      // Nothing happens after the win.
      expect(step(s)).toBe(s);
    });
  }
});
