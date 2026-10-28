// Button-soccer physics: circles on a walled table with two goal pockets.
// World units: the pitch is W wide and L long (between the goal lines); y grows
// downwards. Team 0 defends the bottom goal (y = L) and attacks the top one
// (y = 0); team 1 is the opposite. The same code runs the live match and the
// CPU's look-ahead simulations, so it avoids allocations in the hot loop.

export const W = 100;
export const L = 170;
export const GOAL_W = 32;
export const GOAL_D = 7;
export const GX0 = (W - GOAL_W) / 2;
export const GX1 = (W + GOAL_W) / 2;
export const CAP_R = 5.2;
export const BALL_R = 2.6;
export const POST_R = 1.1;
export const MAX_SPEED = 235; // launch speed of a full-power flick
export const DT = 1 / 120; // fixed physics step

const CAP = { m: 1, mu: 60, k: 1.05, e: 0.9 };
const BALL = { m: 0.42, mu: 34, k: 0.82, e: 0.9 };
const WALL_E = 0.68;
const POST_E = 0.62;
const NET_E = 0.25;
const REST_SPEED = 1.6;

// Kick-off formation for team 0 (bottom); team 1 is mirrored.
export const FORMATION = [
  [50, 159], // keeper
  [29, 139],
  [71, 139],
  [34, 104],
  [66, 104],
];

// Static walls as segments: [ax, ay, bx, by, nx, ny, e] — n is the normal
// pointing into the playable area (used when a centre sits exactly on a wall).
const SEGS = [];
function seg(ax, ay, bx, by, nx, ny, e) {
  SEGS.push([ax, ay, bx, by, nx, ny, e]);
}
seg(0, 0, 0, L, 1, 0, WALL_E); // left touchline
seg(W, 0, W, L, -1, 0, WALL_E); // right touchline
seg(0, 0, GX0, 0, 0, 1, WALL_E); // top end line, left of the goal
seg(GX1, 0, W, 0, 0, 1, WALL_E);
seg(0, L, GX0, L, 0, -1, WALL_E); // bottom end line
seg(GX1, L, W, L, 0, -1, WALL_E);
// goal pockets: side netting and back netting
seg(GX0, 0, GX0, -GOAL_D, 1, 0, NET_E);
seg(GX1, 0, GX1, -GOAL_D, -1, 0, NET_E);
seg(GX0, -GOAL_D, GX1, -GOAL_D, 0, 1, NET_E);
seg(GX0, L, GX0, L + GOAL_D, 1, 0, NET_E);
seg(GX1, L, GX1, L + GOAL_D, -1, 0, NET_E);
seg(GX0, L + GOAL_D, GX1, L + GOAL_D, 0, -1, NET_E);
export const POSTS = [
  [GX0, 0],
  [GX1, 0],
  [GX0, L],
  [GX1, L],
];

function body(kind, team, x, y) {
  const p = kind === 'ball' ? BALL : CAP;
  return { kind, team, x, y, vx: 0, vy: 0, r: kind === 'ball' ? BALL_R : CAP_R, m: p.m, im: 1 / p.m, mu: p.mu, k: p.k, e: p.e, moving: false };
}

// bodies[0] is the ball, 1..5 are team 0, 6..10 are team 1.
export function createWorld() {
  const bodies = [body('ball', -1, W / 2, L / 2)];
  for (let t = 0; t < 2; t++) for (const [x, y] of FORMATION) bodies.push(body('cap', t, t ? W - x : x, t ? L - y : y));
  return { bodies, goal: -1, time: 0 };
}

export function resetPositions(world) {
  const b = world.bodies;
  b[0].x = W / 2;
  b[0].y = L / 2;
  for (let t = 0; t < 2; t++)
    FORMATION.forEach(([x, y], i) => {
      const c = b[1 + t * 5 + i];
      c.x = t ? W - x : x;
      c.y = t ? L - y : y;
    });
  for (const o of b) {
    o.vx = o.vy = 0;
    o.moving = false;
  }
  world.goal = -1;
  world.time = 0;
}

export function teamCaps(world, team) {
  return world.bodies.slice(1 + team * 5, 6 + team * 5);
}

export function cloneWorld(world) {
  return { bodies: world.bodies.map((o) => ({ ...o })), goal: world.goal, time: world.time };
}

export function copyInto(dst, src) {
  for (let i = 0; i < src.bodies.length; i++) {
    const a = dst.bodies[i];
    const b = src.bodies[i];
    a.x = b.x;
    a.y = b.y;
    a.vx = b.vx;
    a.vy = b.vy;
    a.moving = b.moving;
  }
  dst.goal = src.goal;
  dst.time = src.time;
}

export function isResting(world) {
  for (const o of world.bodies) if (o.moving) return false;
  return true;
}

export function flick(o, vx, vy) {
  o.vx = vx;
  o.vy = vy;
  o.moving = true;
}

// Advances the world by one fixed step (DT), sub-stepping so nothing moves
// more than ~1 unit per sub-step (no tunnelling through walls or the ball).
// `ev` (optional) receives collision callbacks for sounds and effects.
export function step(world, ev) {
  const bs = world.bodies;
  const n = bs.length;
  let vmax = 0;
  for (let i = 0; i < n; i++) {
    const o = bs[i];
    if (!o.moving) continue;
    const s = o.vx * o.vx + o.vy * o.vy;
    if (s > vmax) vmax = s;
  }
  if (vmax === 0) return;
  vmax = Math.sqrt(vmax);
  const sub = Math.min(24, Math.max(1, Math.ceil((vmax * DT) / 0.9)));
  const h = DT / sub;
  for (let s = 0; s < sub; s++) {
    // integrate + rolling friction
    for (let i = 0; i < n; i++) {
      const o = bs[i];
      if (!o.moving) continue;
      o.x += o.vx * h;
      o.y += o.vy * h;
      const sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy);
      const ns = sp - (o.mu + o.k * sp) * h;
      if (ns <= REST_SPEED * 0.5) {
        o.vx = o.vy = 0;
        o.moving = false;
      } else {
        const f = ns / sp;
        o.vx *= f;
        o.vy *= f;
      }
    }
    // body vs body
    for (let i = 0; i < n; i++) {
      const a = bs[i];
      for (let j = i + 1; j < n; j++) {
        const b = bs[j];
        if (!a.moving && !b.moving) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const nx = dx / d;
        const ny = dy / d;
        const tot = a.im + b.im;
        const ov = rr - d;
        a.x -= (nx * ov * a.im) / tot;
        a.y -= (ny * ov * a.im) / tot;
        b.x += (nx * ov * b.im) / tot;
        b.y += (ny * ov * b.im) / tot;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const e = Math.min(a.e, b.e);
          const jn = (-(1 + e) * rv) / tot;
          a.vx -= jn * nx * a.im;
          a.vy -= jn * ny * a.im;
          b.vx += jn * nx * b.im;
          b.vy += jn * ny * b.im;
          a.moving = b.moving = true;
          if (ev && ev.hit) ev.hit(a, b, -rv, a.x + nx * a.r, a.y + ny * a.r);
        }
      }
    }
    // walls, nets and posts (only for bodies near the edges)
    for (let i = 0; i < n; i++) {
      const o = bs[i];
      if (!o.moving) continue;
      const r = o.r;
      const m = r + POST_R + 0.2;
      if (o.x > r + 0.05 && o.x < W - r - 0.05 && o.y > m && o.y < L - m) continue;
      for (let k = 0; k < SEGS.length; k++) {
        const sg = SEGS[k];
        const ax = sg[0];
        const ay = sg[1];
        const ex = sg[2] - ax;
        const ey = sg[3] - ay;
        let tt = ((o.x - ax) * ex + (o.y - ay) * ey) / (ex * ex + ey * ey);
        tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        const px = ax + ex * tt;
        const py = ay + ey * tt;
        let dx = o.x - px;
        let dy = o.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) {
          dx = sg[4];
          dy = sg[5];
          d = 1;
        }
        const nx = dx / d;
        const ny = dy / d;
        o.x = px + nx * r;
        o.y = py + ny * r;
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) {
          const e = sg[6];
          o.vx -= (1 + e) * vn * nx;
          o.vy -= (1 + e) * vn * ny;
          // a little grip along the wall
          const tx = -ny;
          const ty = nx;
          const vt = o.vx * tx + o.vy * ty;
          o.vx -= vt * 0.06 * tx;
          o.vy -= vt * 0.06 * ty;
          if (ev && ev.wall) ev.wall(o, -vn, e === NET_E, px, py);
        }
      }
      for (let k = 0; k < 4; k++) {
        const p = POSTS[k];
        const dx = o.x - p[0];
        const dy = o.y - p[1];
        const rr = r + POST_R;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const nx = dx / d;
        const ny = dy / d;
        o.x = p[0] + nx * rr;
        o.y = p[1] + ny * rr;
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) {
          o.vx -= (1 + POST_E) * vn * nx;
          o.vy -= (1 + POST_E) * vn * ny;
          if (ev && ev.post) ev.post(o, -vn, p[0], p[1]);
        }
      }
      // failsafe: never leave the table
      const inPocketX = o.x > GX0 && o.x < GX1;
      if (o.x < r) o.x = r;
      if (o.x > W - r) o.x = W - r;
      if (!inPocketX) {
        if (o.y < -0.5) {
          o.y = r;
          if (o.vy < 0) o.vy = -o.vy * WALL_E;
        } else if (o.y > L + 0.5) {
          o.y = L - r;
          if (o.vy > 0) o.vy = -o.vy * WALL_E;
        }
      } else {
        if (o.y < -GOAL_D + r - 0.5) o.y = -GOAL_D + r;
        if (o.y > L + GOAL_D - r + 0.5) o.y = L + GOAL_D - r;
      }
    }
    // goal: the ball must completely cross the goal line
    if (world.goal < 0) {
      const b = bs[0];
      if (b.y < -b.r && b.x > GX0 && b.x < GX1) {
        world.goal = 0;
        if (ev && ev.goal) ev.goal(0);
      } else if (b.y > L + b.r && b.x > GX0 && b.x < GX1) {
        world.goal = 1;
        if (ev && ev.goal) ev.goal(1);
      }
    }
  }
  world.time += DT;
}

// Runs a world until everything stops, a goal happens or maxT seconds pass.
export function simulate(world, maxT = 6, stopOnGoal = true) {
  const steps = Math.ceil(maxT / DT);
  for (let i = 0; i < steps; i++) {
    step(world, null);
    if (stopOnGoal && world.goal >= 0) return i;
    if (isResting(world)) return i;
  }
  return steps;
}
