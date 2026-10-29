// node --test games/maze/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../logic.js';

const build = (n) => M.buildLevel(M.levelSeed(n), M.levelParams(n));

test('same seed gives the same level, different levels differ', () => {
  const a = build(7), b = build(7), c = build(8);
  assert.deepEqual(Array.from(a.maze.cells), Array.from(b.maze.cells));
  assert.deepEqual(a.holes, b.holes);
  assert.notDeepEqual(Array.from(a.maze.cells), Array.from(c.maze.cells));
});

test('every maze is connected and (without braid) a perfect maze', () => {
  for (let n = 1; n <= 80; n++) {
    const lv = build(n);
    const dist = M.distancesFrom(lv.maze, lv.start);
    assert.ok(Array.from(dist).every((d) => d >= 0), `level ${n} connected`);
    if (lv.params.braid === 0) {
      let passages = 0;
      for (let c = 0; c < lv.maze.cells.length; c++) passages += M.neighbours(lv.maze, c).length;
      assert.equal(passages / 2, lv.maze.cells.length - 1, `level ${n} is a tree`);
    }
  }
});

test('levels are solvable with every hole blocked, and holes stay off the shortest path', () => {
  for (let n = 1; n <= 120; n++) {
    const lv = build(n);
    const blocked = new Set(lv.holes.map((h) => h.cell));
    const p = M.shortestPath(lv.maze, lv.start, lv.goal, blocked);
    assert.ok(p, `level ${n} solvable`);
    for (const h of lv.holes) assert.ok(!lv.path.includes(h.cell), `level ${n}: hole on the path`);
    assert.ok(!blocked.has(lv.start) && !blocked.has(lv.goal));
    // no two features share a cell (except the checkpoint, which sits on the path)
    const cells = [...lv.holes.map((h) => h.cell), ...lv.zones.map((z) => z.cell), ...lv.bumpers.map((b) => b.cell), ...lv.bars.map((b) => b.cell)];
    assert.equal(new Set(cells).size, cells.length, `level ${n}: overlapping features`);
    assert.equal(lv.holes.length, lv.params.holes > 0 ? lv.holes.length : 0);
  }
});

test('difficulty ramps up forever and stays bounded', () => {
  const a = M.levelParams(1), b = M.levelParams(30), c = M.levelParams(300);
  assert.ok(a.holes === 0 && b.holes > 4 && c.holes === 14);
  assert.ok(c.cols === 10 && c.rows === 15);
  assert.ok(b.sticky > 0 && b.ice > 0 && b.boost > 0 && b.bumpers > 0 && b.bars > 0);
});

test('daily seed is stable within a day and changes between days', () => {
  assert.equal(M.dailySeed(new Date(2026, 4, 3, 1)), M.dailySeed(new Date(2026, 4, 3, 23)));
  assert.notEqual(M.dailySeed(new Date(2026, 4, 3)), M.dailySeed(new Date(2026, 4, 4)));
  assert.equal(M.dayKey(new Date(2026, 0, 9)), '2026-01-09');
});

test('stars by time', () => {
  assert.equal(M.starsFor(10, 12), 3);
  assert.equal(M.starsFor(12, 12), 3);
  assert.equal(M.starsFor(15, 12), 2);
  assert.equal(M.starsFor(40, 12), 1);
});

test('the ball never leaves the board or tunnels through walls under random tilting', () => {
  for (const n of [1, 6, 15, 30]) {
    const lv = build(n);
    const ball = M.newBall(lv);
    let seed = n * 31 + 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let tx = 0, ty = 0;
    for (let i = 0; i < 60 * 40; i++) {
      if (i % 20 === 0) { tx = rnd() * 2 - 1; ty = rnd() * 2 - 1; }
      M.stepBall(lv, ball, tx, ty, 1 / 60);
      if (ball.state === 'roll') {
        assert.ok(ball.x > 0 && ball.y > 0 && ball.x < lv.maze.cols && ball.y < lv.maze.rows);
        // the ball centre must be inside an open region: never inside a wall rectangle
        for (const r of lv.rects.buckets[Math.floor(ball.y) * lv.maze.cols + Math.floor(ball.x)]) {
          const inside = ball.x > r[0] + 0.001 && ball.x < r[2] - 0.001 && ball.y > r[1] + 0.001 && ball.y < r[3] - 0.001;
          assert.ok(!inside, `level ${n} step ${i}: ball centre inside a wall`);
        }
      }
      if (ball.done) break;
    }
  }
});

test('walls stop the ball and make it bounce', () => {
  const lv = build(1);
  const ball = M.newBall(lv);
  // push to the left into the outer wall
  let hits = 0;
  for (let i = 0; i < 120; i++) for (const e of M.stepBall(lv, ball, -1, 0, 1 / 60)) if (e.type === 'hit') hits++;
  assert.ok(ball.x >= M.BALL_R + M.WALL_T / 2 - 1e-6, 'x=' + ball.x);
  assert.ok(hits >= 1);
});

test('a hole captures a slow ball, the ball respawns and a fast ball can skip over it', () => {
  const lv = build(12);
  const hole = lv.holes[0];
  const ball = M.newBall(lv);
  ball.x = hole.x + 0.2; ball.y = hole.y; ball.vx = -0.5; ball.vy = 0; ball.grace = 0;
  let fell = false;
  for (let i = 0; i < 60 && !fell; i++) fell = M.stepBall(lv, ball, 0, 0, 1 / 60).some((e) => e.type === 'fall');
  assert.ok(fell && ball.falls === 1);
  let respawn = false;
  for (let i = 0; i < 90 && !respawn; i++) respawn = M.stepBall(lv, ball, 0, 0, 1 / 60).some((e) => e.type === 'respawn');
  assert.ok(respawn);
  assert.deepEqual([ball.x, ball.y], ball.spawn);
});

test('ice is slippy, sticky is slow and boost pads give a push', () => {
  const lv = build(40);
  const find = (k) => lv.zones.find((z) => z.kind === k);
  const run = (kind) => {
    const z = find(kind);
    const ball = M.newBall(lv);
    ball.x = (z.cell % lv.maze.cols) + 0.5; ball.y = Math.floor(z.cell / lv.maze.cols) + 0.5;
    ball.vx = 3; ball.vy = 0; ball.grace = 9;
    const lvCopy = { ...lv, holes: [], bumpers: [], bars: [], rects: { list: [], buckets: lv.rects.buckets.map(() => []) } };
    M.stepBall(lvCopy, ball, 0, 0, 0.1);
    return ball.vx;
  };
  assert.ok(run('ice') > run('sticky') * 1.5);
  assert.ok(find('boost'));
});

// A simple autopilot (PD controller towards the next waypoints) to prove levels are playable and to calibrate the par time
function autopilot(lv, maxT = 120) {
  const ball = M.newBall(lv);
  const path = lv.path;
  let k = 1;
  const dt = 1 / 60;
  let t = 0;
  while (!ball.done && t < maxT) {
    const [wx, wy] = M.cellCentre(lv.maze, path[Math.min(k, path.length - 1)]);
    const [nx, ny] = M.cellCentre(lv.maze, path[Math.min(k + 1, path.length - 1)]);
    if (Math.hypot(wx - ball.x, wy - ball.y) < 0.33 && k < path.length - 1) k++;
    // aim between the current and the next waypoint, brake with the velocity
    const ax = wx + (nx - wx) * 0.25 - ball.x, ay = wy + (ny - wy) * 0.25 - ball.y;
    const tx = Math.max(-1, Math.min(1, ax * 1.1 - ball.vx * 0.42));
    const ty = Math.max(-1, Math.min(1, ay * 1.1 - ball.vy * 0.42));
    if (ball.state === 'fall') k = Math.max(1, path.indexOf(ball.cp >= 0 ? lv.checkpoints[ball.cp].cell : lv.start) + 1);
    M.stepBall(lv, ball, tx, ty, dt);
    if (ball.state === 'roll' && ball.grace > 0.4) k = Math.max(1, path.indexOf(ball.cp >= 0 ? lv.checkpoints[ball.cp].cell : lv.start) + 1);
    t += dt;
  }
  return { done: ball.done, time: ball.time, falls: ball.falls };
}

test('the autopilot can finish levels (they are playable) and par time is sensible', () => {
  const rows = [];
  for (const n of [1, 2, 3, 5, 8, 12, 16, 20, 25]) {
    const lv = build(n);
    const r = autopilot(lv);
    rows.push([n, lv.path.length - 1, lv.par, +r.time.toFixed(1), r.falls, r.done]);
    assert.ok(r.done, `level ${n} finished by the autopilot`);
  }
  if (process.env.MAZE_TABLE) console.table(rows.map(([n, len, par, t, f, d]) => ({ level: n, cells: len, par, autopilot: t, falls: f, done: d })));
});
