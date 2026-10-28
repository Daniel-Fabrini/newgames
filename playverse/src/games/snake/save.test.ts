import { beforeEach, describe, expect, it } from 'vitest';
import { __resetStorageBackendForTests, writeValue } from '../../services/storage/storage';
import { loadGame, saveGame } from '../../services/saves';
import { DIRECTIONS, newGame, step, turn, type GameState } from './engine';
import { checkState, gameStateValidator, saveSpec } from './save';
import { comboKey, loadPrefs, savePrefs } from './prefs';
import { Rng } from '../../utils/random';

beforeEach(() => {
  __resetStorageBackendForTests(true);
});

/** A run in progress with some food eaten. */
function midRun(seed = 11, mode: GameState['mode'] = 'classic'): GameState {
  const inputs = new Rng(seed);
  let s = newGame(seed, { mode, difficulty: 'medium' });
  for (let i = 0; i < 300; i++) {
    const head = s.snake[0];
    if (s.food && head) {
      const dx = s.food.x - head.x;
      const dy = s.food.y - head.y;
      s = turn(s, dx !== 0 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    }
    if (inputs.bool(0.1)) s = turn(s, inputs.pick(DIRECTIONS));
    const next = step(s);
    if (next.status !== 'playing') break;
    s = next;
  }
  return s;
}

const valid = (s: unknown) => gameStateValidator(s).ok;

describe('snake save validation', () => {
  it('accepts fresh and in-progress runs, also after a JSON round trip', () => {
    const fresh = newGame(1, { mode: 'endless', difficulty: 'easy' });
    expect(valid(fresh)).toBe(true);
    const s = midRun();
    expect(s.foodEaten).toBeGreaterThan(0);
    expect(checkState(s)).toBe(true);
    expect(valid(JSON.parse(JSON.stringify(s)))).toBe(true);
    const turned = turn(turn(s, s.dir === 'up' || s.dir === 'down' ? 'left' : 'up'), s.dir);
    expect(valid(turned)).toBe(true);
  });

  it('accepts an endless-mode snake that crosses an edge', () => {
    let s = newGame(3, { mode: 'endless', difficulty: 'hard' });
    for (let i = 0; i < 12; i++) s = step(s);
    expect(s.status).toBe('playing');
    expect(s.snake.some((p) => p.x === 0) && s.snake.some((p) => p.x === 16)).toBe(true);
    expect(valid(s)).toBe(true);
  });

  it('rejects finished runs', () => {
    const s = midRun();
    expect(valid({ ...s, status: 'over', cause: 'wall' })).toBe(false);
    expect(valid({ ...s, status: 'won', food: null })).toBe(false);
  });

  it('rejects corrupted positions', () => {
    const s = midRun();
    const [head, second] = s.snake;
    expect(head && second).toBeTruthy();
    // overlapping segments
    expect(valid({ ...s, snake: [head, head, ...s.snake.slice(2)] })).toBe(false);
    // non contiguous body
    expect(valid({ ...s, snake: [{ x: (head!.x + 5) % 17, y: head!.y }, ...s.snake.slice(1)] })).toBe(false);
    // out of bounds
    expect(valid({ ...s, snake: [{ x: 17, y: 0 }, ...s.snake.slice(1)] })).toBe(false);
    // food on the snake
    expect(valid({ ...s, food: { ...second! } })).toBe(false);
    // missing food while playing
    expect(valid({ ...s, food: null })).toBe(false);
    // bonus on the food
    expect(valid({ ...s, bonus: { ...s.food!, ticksLeft: 3 } })).toBe(false);
    // direction that does not match the head (would allow a reversal into the neck)
    const wrongDir = s.dir === 'up' ? 'left' : 'up';
    expect(valid({ ...s, dir: wrongDir, queue: [] })).toBe(false);
  });

  it('rejects invalid buffers, scores and field types', () => {
    const s = midRun();
    expect(valid({ ...s, queue: [s.dir] })).toBe(false);
    expect(valid({ ...s, queue: ['up', 'left', 'down'] })).toBe(false);
    expect(valid({ ...s, score: s.score + 1 })).toBe(false);
    expect(valid({ ...s, foodEaten: s.foodEaten + 1 })).toBe(false);
    expect(valid({ ...s, bonusEaten: s.foodEaten })).toBe(false);
    expect(valid({ ...s, mode: 'arcade' })).toBe(false);
    expect(valid({ ...s, difficulty: 'expert' })).toBe(false);
    expect(valid({ ...s, timeMs: -5 })).toBe(false);
    expect(valid({ ...s, rng: 1.5 })).toBe(false);
    expect(valid({ ...s, snake: 'nope' })).toBe(false);
    expect(valid(null)).toBe(false);
  });

  it('saves and restores through the storage layer and drops corrupted saves', () => {
    const s = midRun(21, 'endless');
    expect(saveGame(saveSpec, { game: s })).toBe(true);
    expect(loadGame(saveSpec)).toEqual({ game: s });
    writeValue('save:snake', { game: { ...s, snake: [] } }, saveSpec.version);
    expect(loadGame(saveSpec)).toBeNull();
    writeValue('save:snake', { game: s }, saveSpec.version + 1);
    expect(loadGame(saveSpec)).toBeNull();
  });
});

describe('snake preferences', () => {
  it('remembers the last mode and difficulty and falls back to defaults', () => {
    expect(loadPrefs()).toEqual({ mode: 'classic', difficulty: 'medium' });
    savePrefs({ mode: 'endless', difficulty: 'hard' });
    expect(loadPrefs()).toEqual({ mode: 'endless', difficulty: 'hard' });
    writeValue('prefs:snake', { mode: 'warp', difficulty: 'easy' });
    expect(loadPrefs()).toEqual({ mode: 'classic', difficulty: 'easy' });
  });

  it('builds per-combination metric keys', () => {
    expect(comboKey('endless', 'hard')).toBe('best:endless:hard');
  });
});
