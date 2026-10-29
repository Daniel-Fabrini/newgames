// Tilt Maze logic: seeded level generation, solvability, ball physics, scoring. Pure module (no DOM).
// World units are maze cells; origin is the top-left corner of the board, y grows downwards.

export const N = 1, E = 2, S = 4, W = 8; // wall bits: set = wall present
const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
const DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
const OPP = { [N]: S, [E]: W, [S]: N, [W]: E };
const DIRS = [N, E, S, W];

export const WALL_T = 0.13; // wall thickness
export const BALL_R = 0.26;
export const HOLE_R = 0.34;
export const ACCEL = 12; // cells/s^2 at full tilt
export const FRICTION = 1.7;
export const ICE = 0.22;
export const STICKY = 6.5;

// ---------------------------------------------------------------- random
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashSeed = (n) => {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
};
export const levelSeed = (n) => hashSeed(n * 7919 + 13);
export function dailySeed(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return hashSeed(y * 10000 + m * 100 + d + 99991);
}
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------- maze
// cells: Uint8Array(cols*rows) with the closed-wall bits of every cell (all closed at first)
export function generateMaze(cols, rows, rand, braid = 0) {
  const cells = new Uint8Array(cols * rows).fill(N | E | S | W);
  const seen = new Uint8Array(cols * rows);
  const stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const x = c % cols, y = (c / cols) | 0;
    const opts = [];
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx]) opts.push(d);
    }
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[(rand() * opts.length) | 0];
    const nc = (y + DY[d]) * cols + (x + DX[d]);
    cells[c] &= ~d;
    cells[nc] &= ~OPP[d];
    seen[nc] = 1;
    stack.push(nc);
  }
  // braid: knock out some more walls so there are loops
  if (braid > 0) {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      for (const d of [E, S]) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx >= cols || ny >= rows) continue;
        if (cells[y * cols + x] & d && rand() < braid) {
          cells[y * cols + x] &= ~d;
          cells[ny * cols + nx] &= ~OPP[d];
        }
      }
    }
  }
  return { cols, rows, cells };
}

export const open = (maze, c, d) => !(maze.cells[c] & d);
export function neighbours(maze, c) {
  const x = c % maze.cols, y = (c / maze.cols) | 0;
  const out = [];
  for (const d of DIRS) if (open(maze, c, d)) out.push((y + DY[d]) * maze.cols + (x + DX[d]));
  return out;
}

// BFS: shortest path of cell indices from a to b avoiding the blocked set; null when there is none
export function shortestPath(maze, a, b, blocked = null) {
  const prev = new Int32Array(maze.cols * maze.rows).fill(-2);
  prev[a] = -1;
  const q = [a];
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    if (c === b) break;
    for (const n of neighbours(maze, c)) {
      if (prev[n] !== -2 || (blocked && blocked.has(n))) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  if (prev[b] === -2) return null;
  const path = [];
  for (let c = b; c !== -1; c = prev[c]) path.push(c);
  return path.reverse();
}

export function distancesFrom(maze, a) {
  const dist = new Int32Array(maze.cols * maze.rows).fill(-1);
  dist[a] = 0;
  const q = [a];
  for (let i = 0; i < q.length; i++) for (const n of neighbours(maze, q[i])) if (dist[n] < 0) {
    dist[n] = dist[q[i]] + 1;
    q.push(n);
  }
  return dist;
}

// ---------------------------------------------------------------- level parameters (endless)
export function levelParams(n) {
  n = Math.max(1, Math.floor(n));
  const holes = n < 3 ? 0 : Math.min(2 + Math.floor((n - 3) / 2), 14);
  return {
    n,
    cols: Math.min(10, 5 + Math.floor((n - 1) / 4)),
    rows: Math.min(15, 7 + Math.floor((n - 1) / 3)),
    braid: n < 6 ? 0 : Math.min(0.28, (n - 5) * 0.012),
    holes,
    sticky: n < 5 ? 0 : Math.min(1 + Math.floor((n - 5) / 4), 6),
    ice: n < 7 ? 0 : Math.min(1 + Math.floor((n - 7) / 4), 6),
    boost: n < 9 ? 0 : Math.min(1 + Math.floor((n - 9) / 4), 5),
    bumpers: n < 11 ? 0 : Math.min(1 + Math.floor((n - 11) / 4), 6),
    bars: n < 14 ? 0 : Math.min(1 + Math.floor((n - 14) / 5), 4),
    checkpoints: holes >= 9 ? 2 : holes >= 4 ? 1 : 0,
  };
}

// ---------------------------------------------------------------- level builder
const idx = (maze, x, y) => y * maze.cols + x;
const cx = (maze, c) => c % maze.cols;
const cy = (maze, c) => (c / maze.cols) | 0;
const centre = (maze, c) => [cx(maze, c) + 0.5, cy(maze, c) + 0.5];

export function buildLevel(seed, params) {
  const rand = rng(seed);
  const p = params;
  const maze = generateMaze(p.cols, p.rows, rand, p.braid);
  const start = idx(maze, 0, p.rows - 1);
  const dist = distancesFrom(maze, start);
  let goal = start;
  for (let c = 0; c < dist.length; c++) if (dist[c] > dist[goal] || (dist[c] === dist[goal] && rand() < 0.5)) goal = c;
  const path = shortestPath(maze, start, goal);
  const onPath = new Set(path);
  const used = new Set([start, goal]);
  const take = (arr) => {
    const i = (rand() * arr.length) | 0;
    return arr.splice(i, 1)[0];
  };
  const all = [];
  for (let c = 0; c < dist.length; c++) all.push(c);
  const near = (a, b) => Math.abs(cx(maze, a) - cx(maze, b)) + Math.abs(cy(maze, a) - cy(maze, b));

  // holes: never on the shortest path, away from the start; preferably next to it
  const holes = [];
  const holeCells = new Set();
  const offPath = all.filter((c) => !onPath.has(c) && near(c, start) > 2 && near(c, goal) > 1);
  const adj = offPath.filter((c) => neighbours(maze, c).some((n) => onPath.has(n)));
  let guard = 0;
  while (holes.length < p.holes && (adj.length || offPath.length) && guard++ < 500) {
    const pool = adj.length && rand() < 0.65 ? adj : offPath;
    if (!pool.length) break;
    const c = take(pool);
    const other = pool === adj ? offPath : adj;
    const oi = other.indexOf(c);
    if (oi >= 0) other.splice(oi, 1);
    if (holeCells.has(c)) continue;
    holeCells.add(c);
    used.add(c);
    const [hx, hy] = centre(maze, c);
    holes.push({ cell: c, x: hx, y: hy, r: HOLE_R });
  }
  // the shortest path still exists with holes blocked (it avoids them by construction); keep the proof for tests
  const pathCells = path.slice(1, -1).filter((c) => !used.has(c));

  const zones = []; // { cell, kind: 'sticky'|'ice'|'boost', dir? }
  const pickPath = () => {
    if (!pathCells.length) return -1;
    const i = (rand() * pathCells.length) | 0;
    const c = pathCells.splice(i, 1)[0];
    used.add(c);
    return c;
  };
  for (let i = 0; i < p.sticky; i++) { const c = pickPath(); if (c >= 0) zones.push({ cell: c, kind: 'sticky' }); }
  for (let i = 0; i < p.ice; i++) { const c = pickPath(); if (c >= 0) zones.push({ cell: c, kind: 'ice' }); }
  // boost pads point along the path (only on straight pieces)
  const pi = new Map(path.map((c, i) => [c, i]));
  const straight = pathCells.filter((c) => {
    const i = pi.get(c);
    const a = path[i - 1], b = path[i + 1];
    return cx(maze, a) - cx(maze, c) === cx(maze, c) - cx(maze, b) && cy(maze, a) - cy(maze, c) === cy(maze, c) - cy(maze, b);
  });
  for (let i = 0; i < p.boost && straight.length; i++) {
    const c = take(straight);
    const j = pathCells.indexOf(c);
    if (j >= 0) pathCells.splice(j, 1);
    used.add(c);
    const k = pi.get(c);
    const nxt = path[k + 1];
    zones.push({ cell: c, kind: 'boost', dir: [cx(maze, nxt) - cx(maze, c), cy(maze, nxt) - cy(maze, c)] });
  }

  // moving bumpers live in dead ends / side corridors that are not on the path
  const bumpers = [];
  const deadEnds = offPath.filter((c) => !used.has(c) && neighbours(maze, c).length === 1);
  const side = offPath.filter((c) => !used.has(c) && neighbours(maze, c).length === 2);
  for (let i = 0; i < p.bumpers && (deadEnds.length || side.length); i++) {
    const pool = deadEnds.length ? deadEnds : side;
    const c = take(pool);
    if (used.has(c)) continue;
    used.add(c);
    const [bx, by] = centre(maze, c);
    // oscillate along the open axis
    const horizontal = open(maze, c, E) || open(maze, c, W);
    bumpers.push({ cell: c, x: bx, y: by, r: 0.17, axis: horizontal ? [1, 0] : [0, 1], amp: 0.2, speed: 1.6 + rand() * 1.2, phase: rand() * 6.28 });
  }

  // wiper gates on straight pieces of the path (swing from wall to wall, open about 2/3 of the time)
  const bars = [];
  const gateCells = pathCells.filter((c) => !used.has(c) && straight.includes(c));
  for (let i = 0; i < p.bars && gateCells.length; i++) {
    const c = take(gateCells);
    used.add(c);
    const horizontalRun = open(maze, c, E) && open(maze, c, W);
    const [mx, my] = centre(maze, c);
    // pivot in the middle of one side wall
    const px = horizontalRun ? mx : mx - 0.5;
    const py = horizontalRun ? my - 0.5 : my;
    bars.push({ cell: c, px, py, len: 0.9, axis: horizontalRun ? 0 : 1, speed: 1.2 + rand() * 0.5, phase: rand() * 6.28 });
  }

  // checkpoints along the path
  const checkpoints = [];
  if (p.checkpoints) {
    for (let i = 1; i <= p.checkpoints; i++) {
      const k = Math.round((path.length * i) / (p.checkpoints + 1));
      const c = path[k];
      if (c !== start && c !== goal && !holeCells.has(c)) {
        const [x, y] = centre(maze, c);
        checkpoints.push({ cell: c, x, y });
      }
    }
  }

  const level = { seed, params: p, maze, start, goal, path, holes, zones, bumpers, bars, checkpoints, width: p.cols, height: p.rows };
  level.rects = buildRects(level);
  level.par = parTime(level);
  return level;
}

export function parTime(level) {
  const L = level.path.length - 1;
  const p = level.params;
  const z = (k) => level.zones.filter((q) => q.kind === k).length;
  return Math.round((3 + L * 0.45 + p.holes * 0.4 + level.bars.length * 0.9 + z('sticky') * 0.5 + z('ice') * 0.2) * 10) / 10;
}
export function starsFor(time, par) {
  if (time <= par) return 3;
  if (time <= par * 1.7) return 2;
  return 1;
}

// ---------------------------------------------------------------- walls as rectangles
function buildRects(level) {
  const { maze } = level;
  const T = WALL_T / 2;
  const rects = []; // [x0,y0,x1,y1]
  const { cols, rows, cells } = maze;
  // horizontal lines (between rows) and vertical lines (between columns)
  for (let y = 0; y <= rows; y++) {
    let x = 0;
    while (x < cols) {
      const wall = y === 0 ? true : y === rows ? true : !!(cells[(y - 1) * cols + x] & S);
      if (!wall) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < cols && (y === 0 || y === rows || !!(cells[(y - 1) * cols + x1 + 1] & S))) x1++;
      rects.push([x - T, y - T, x1 + 1 + T, y + T]);
      x = x1 + 1;
    }
  }
  for (let x = 0; x <= cols; x++) {
    let y = 0;
    while (y < rows) {
      const wall = x === 0 ? true : x === cols ? true : !!(cells[y * cols + x - 1] & E);
      if (!wall) { y++; continue; }
      let y1 = y;
      while (y1 + 1 < rows && (x === 0 || x === cols || !!(cells[(y1 + 1) * cols + x - 1] & E))) y1++;
      rects.push([x - T, y - T, x + T, y1 + 1 + T]);
      y = y1 + 1;
    }
  }
  // spatial buckets
  const buckets = Array.from({ length: cols * rows }, () => []);
  const m = BALL_R + 0.05;
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r[0] - m)), x1 = Math.min(cols - 1, Math.floor(r[2] + m));
    const y0 = Math.max(0, Math.floor(r[1] - m)), y1 = Math.min(rows - 1, Math.floor(r[3] + m));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) buckets[y * cols + x].push(r);
  }
  return { list: rects, buckets };
}

// ---------------------------------------------------------------- ball physics
export function newBall(level) {
  const [x, y] = centre(level.maze, level.start);
  return { x, y, vx: 0, vy: 0, r: BALL_R, state: 'roll', fall: 0, fallHole: null, spawn: [x, y], cp: -1, boostCool: 0, time: 0, falls: 0, started: false, done: false };
}

export const bumperPos = (b, t) => {
  const s = Math.sin(t * b.speed + b.phase) * b.amp;
  return [b.x + b.axis[0] * s, b.y + b.axis[1] * s, b.axis[0] * Math.cos(t * b.speed + b.phase) * b.amp * b.speed, b.axis[1] * Math.cos(t * b.speed + b.phase) * b.amp * b.speed];
};
export const barAngle = (b, t) => {
  // swings between the two walls: angle 0 = along +axis, PI = along -axis; PI/2 blocks the corridor
  return (Math.PI / 2) * (1 + Math.sin(t * b.speed + b.phase));
};
export function barSegment(b, t) {
  const a = barAngle(b, t);
  // axis 0: corridor runs along x, the bar hangs from the wall at the top (pivot y = cell top) into the cell
  // axis 1: corridor runs along y, the bar hangs from the left wall
  let dx, dy;
  if (b.axis === 0) { dx = Math.cos(a); dy = Math.sin(a); } else { dx = Math.sin(a); dy = Math.cos(a); }
  const w = (Math.PI / 2) * b.speed * Math.cos(t * b.speed + b.phase);
  return { x0: b.px, y0: b.py, x1: b.px + dx * b.len, y1: b.py + dy * b.len, dx, dy, w };
}

function circleVsRect(ball, r, e, ev) {
  const px = Math.min(Math.max(ball.x, r[0]), r[2]);
  const py = Math.min(Math.max(ball.y, r[1]), r[3]);
  let dx = ball.x - px, dy = ball.y - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= ball.r * ball.r) return;
  let d = Math.sqrt(d2);
  let nx, ny;
  if (d > 1e-7) {
    nx = dx / d;
    ny = dy / d;
  } else {
    // centre inside the rectangle: leave by the closest side
    const l = ball.x - r[0], rr = r[2] - ball.x, t = ball.y - r[1], b = r[3] - ball.y;
    const m = Math.min(l, rr, t, b);
    if (m === l) { nx = -1; ny = 0; d = -l; } else if (m === rr) { nx = 1; ny = 0; d = -rr; } else if (m === t) { nx = 0; ny = -1; d = -t; } else { nx = 0; ny = 1; d = -b; }
  }
  const push = ball.r - d;
  ball.x += nx * push;
  ball.y += ny * push;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    const bounce = -vn > 0.9 ? e : 0;
    ball.vx -= (1 + bounce) * vn * nx;
    ball.vy -= (1 + bounce) * vn * ny;
    // a little scrubbing on the tangential component
    const tx = -ny, ty = nx;
    const vt = ball.vx * tx + ball.vy * ty;
    ball.vx -= vt * 0.03 * tx;
    ball.vy -= vt * 0.03 * ty;
    if (-vn > 1.2 && ev) ev.push({ type: 'hit', v: -vn });
  }
}

function circleVsSegment(ball, seg, thick, vel, e, ev) {
  const sx = seg.x1 - seg.x0, sy = seg.y1 - seg.y0;
  const l2 = sx * sx + sy * sy;
  let t = ((ball.x - seg.x0) * sx + (ball.y - seg.y0) * sy) / l2;
  t = Math.max(0, Math.min(1, t));
  const qx = seg.x0 + sx * t, qy = seg.y0 + sy * t;
  const dx = ball.x - qx, dy = ball.y - qy;
  const rr = ball.r + thick;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d, ny = dy / d;
  ball.x += nx * (rr - d);
  ball.y += ny * (rr - d);
  // velocity of the bar at the contact point (rotation about the pivot)
  const bvx = -seg.w * (qy - seg.y0) * (seg.rot || 1), bvy = seg.w * (qx - seg.x0) * (seg.rot || 1);
  const rvx = ball.vx - vel[0] - bvx, rvy = ball.vy - vel[1] - bvy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
    if (-vn > 1.2 && ev) ev.push({ type: 'hit', v: -vn });
  }
  return true;
}

export function zoneAt(level, x, y) {
  const c = Math.floor(y) * level.maze.cols + Math.floor(x);
  for (const z of level.zones) if (z.cell === c) return z;
  return null;
}

// Advance the ball by dt seconds with tilt (tx, ty) in [-1, 1]. Returns the list of events.
export function stepBall(level, ball, tx, ty, dt) {
  const ev = [];
  if (ball.done) return ev;
  const tl = Math.hypot(tx, ty);
  if (tl > 1) { tx /= tl; ty /= tl; }
  if (!ball.started && tl > 0.05) ball.started = true;
  if (ball.started) ball.time += dt;
  if (ball.state === 'fall') {
    ball.fall += dt;
    const h = ball.fallHole;
    ball.x += (h.x - ball.x) * Math.min(1, dt * 14);
    ball.y += (h.y - ball.y) * Math.min(1, dt * 14);
    ball.vx = ball.vy = 0;
    if (ball.fall > 0.6) {
      ball.state = 'roll';
      ball.x = ball.spawn[0];
      ball.y = ball.spawn[1];
      ball.fall = 0;
      ball.fallHole = null;
      ball.grace = 0.5;
      ev.push({ type: 'respawn' });
    }
    return ev;
  }
  const sub = Math.max(4, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 0.06));
  const h = dt / sub;
  const maze = level.maze;
  for (let s = 0; s < sub; s++) {
    ball.simT = (ball.simT || 0) + h;
    const zone = zoneAt(level, ball.x, ball.y);
    const fr = zone ? (zone.kind === 'ice' ? ICE : zone.kind === 'sticky' ? STICKY : FRICTION) : FRICTION;
    ball.vx += tx * ACCEL * h;
    ball.vy += ty * ACCEL * h;
    const damp = Math.exp(-fr * h);
    ball.vx *= damp;
    ball.vy *= damp;
    if (ball.boostCool > 0) ball.boostCool -= h;
    if (zone && zone.kind === 'boost' && ball.boostCool <= 0) {
      ball.vx += zone.dir[0] * 7;
      ball.vy += zone.dir[1] * 7;
      ball.boostCool = 0.5;
      ev.push({ type: 'boost' });
    }
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    // moving obstacles first (they may push the ball into a wall, which is resolved after)
    const t = ball.simT;
    for (const b of level.bumpers) {
      const [bx, by, bvx, bvy] = bumperPos(b, t);
      const dx = ball.x - bx, dy = ball.y - by;
      const rr = ball.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 1e-6;
        const nx = dx / d, ny = dy / d;
        ball.x += nx * (rr - d);
        ball.y += ny * (rr - d);
        const vn = (ball.vx - bvx) * nx + (ball.vy - bvy) * ny;
        if (vn < 0) {
          ball.vx -= (1 + 1.1) * vn * nx;
          ball.vy -= (1 + 1.1) * vn * ny;
          const sp = Math.hypot(ball.vx, ball.vy);
          if (sp < 3) { ball.vx *= 3 / (sp || 1); ball.vy *= 3 / (sp || 1); }
          ev.push({ type: 'bumper', v: -vn });
        }
      }
    }
    for (const b of level.bars) {
      const seg = barSegment(b, t);
      seg.rot = b.axis === 0 ? 1 : -1;
      circleVsSegment(ball, seg, 0.055, [0, 0], 0.4, ev);
    }
    // static walls (two passes handle corners)
    const cx0 = Math.min(maze.cols - 1, Math.max(0, Math.floor(ball.x)));
    const cy0 = Math.min(maze.rows - 1, Math.max(0, Math.floor(ball.y)));
    const bucket = level.rects.buckets[cy0 * maze.cols + cx0];
    for (let pass = 0; pass < 2; pass++) for (const r of bucket) circleVsRect(ball, r, 0.36, pass === 0 ? ev : null);
    // hard bounds: never leave the board
    ball.x = Math.min(maze.cols - 0.2, Math.max(0.2, ball.x));
    ball.y = Math.min(maze.rows - 0.2, Math.max(0.2, ball.y));
  }
  if (ball.grace > 0) ball.grace -= dt;
  // holes
  if (!(ball.grace > 0)) {
    for (const hole of level.holes) {
      const dx = hole.x - ball.x, dy = hole.y - ball.y;
      const d = Math.hypot(dx, dy);
      if (d < hole.r) {
        const k = (1 - d / hole.r) * 22 * dt;
        ball.vx += (dx / (d || 1)) * k * 4;
        ball.vy += (dy / (d || 1)) * k * 4;
        if (d < hole.r * 0.62 && Math.hypot(ball.vx, ball.vy) < 7) {
          ball.state = 'fall';
          ball.fall = 0;
          ball.fallHole = hole;
          ball.falls++;
          ev.push({ type: 'fall', hole });
          return ev;
        }
      }
    }
  }
  // checkpoints and goal
  level.checkpoints.forEach((c, i) => {
    if (i > ball.cp && Math.hypot(c.x - ball.x, c.y - ball.y) < 0.45) {
      ball.cp = i;
      ball.spawn = [c.x, c.y];
      ev.push({ type: 'checkpoint', index: i });
    }
  });
  const [gx, gy] = centre(maze, level.goal);
  const gd = Math.hypot(gx - ball.x, gy - ball.y);
  if (gd < 0.4) {
    // gentle pull into the goal
    ball.vx += ((gx - ball.x) / (gd || 1)) * 10 * dt;
    ball.vy += ((gy - ball.y) / (gd || 1)) * 10 * dt;
    if (gd < 0.22 || Math.hypot(ball.vx, ball.vy) < 1.2) {
      ball.done = true;
      ev.push({ type: 'goal' });
    }
  }
  return ev;
}

export function levelCell(level, x, y) {
  return Math.floor(y) * level.maze.cols + Math.floor(x);
}
export { centre as cellCentre };
