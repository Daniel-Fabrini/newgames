// CPU player. It builds a list of candidate flicks (aimed shots at the goal,
// clearances and random sweeps), runs each one forward with the real physics
// engine and scores the resulting position. `think` is a generator so the match
// loop can spread the search over several frames without freezing the UI.

import { W, L, GX0, GX1, CAP_R, BALL_R, MAX_SPEED, cloneWorld, copyInto, flick, simulate } from './physics.js';

// Skill is open-ended (0 = beginner); every step makes the CPU more precise,
// search more shots and care more about defence.
export function aiParams(skill) {
  const s = Math.max(0, skill);
  return {
    noise: ((8.5 * Math.pow(0.7, s) + 0.18) * Math.PI) / 180,
    pnoise: 0.12 * Math.pow(0.72, s) + 0.008,
    rand: Math.round(Math.min(44, 8 + 5 * s)),
    topK: Math.max(1, Math.round(6 * Math.pow(0.58, s))),
    defense: Math.min(1.25, 0.2 + 0.17 * s),
    offsets: s >= 3 ? [-0.07, -0.035, 0, 0.035, 0.07] : s >= 1 ? [-0.05, 0, 0.05] : [0],
    powers: s >= 4 ? [0.38, 0.52, 0.66, 0.8, 0.92, 1] : s >= 2 ? [0.45, 0.65, 0.85, 1] : [0.55, 0.8, 1],
    aims: s >= 2 ? [GX0 + 4.5, (GX0 + W / 2) / 2 + 2, W / 2, (GX1 + W / 2) / 2 - 2, GX1 - 4.5] : [GX0 + 6, W / 2, GX1 - 6],
    keeper: s >= 1.5,
  };
}

function gauss(rnd) {
  return (rnd() + rnd() + rnd() - 1.5) / 0.5;
}

// Is the straight path a→b (swept by radius `rad`) clear of every body except the skipped ones?
function pathClear(bodies, ax, ay, bx, by, rad, skipA, skipB) {
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey || 1e-6;
  for (let i = 0; i < bodies.length; i++) {
    if (i === skipA || i === skipB) continue;
    const o = bodies[i];
    let t = ((o.x - ax) * ex + (o.y - ay) * ey) / len2;
    if (t <= 0 || t >= 1) continue;
    const px = ax + ex * t - o.x;
    const py = ay + ey * t - o.y;
    const rr = rad + o.r;
    if (px * px + py * py < rr * rr) return false;
  }
  return true;
}

// How dangerous is the position for `team`'s goal, given `opp` moves next? 0..1
export function threat(world, opp) {
  const bs = world.bodies;
  const b = bs[0];
  const goalY = opp === 0 ? -2 : L + 2; // the goal `opp` attacks
  let best = 0;
  for (const tx of [GX0 + 4, W / 2, GX1 - 4]) {
    const dx = tx - b.x;
    const dy = goalY - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const lane = pathClear(bs, b.x, b.y, tx, goalY, BALL_R * 0.9, 0, -1) ? 1 : 0.18;
    const gx = b.x - ux * (CAP_R + BALL_R);
    const gy = b.y - uy * (CAP_R + BALL_R);
    for (let i = 1 + opp * 5; i < 6 + opp * 5; i++) {
      const c = bs[i];
      const vx = gx - c.x;
      const vy = gy - c.y;
      const dl = Math.hypot(vx, vy) || 1;
      const cut = (vx * ux + vy * uy) / dl;
      if (cut < 0.25) continue;
      if (!pathClear(bs, c.x, c.y, gx, gy, CAP_R * 0.92, i, 0)) continue;
      const reach = Math.max(0, 1 - (dl * 0.8 + dist * 0.55) / 210);
      const t = cut * cut * reach * lane;
      if (t > best) best = t;
    }
  }
  return Math.min(1, best * 1.6);
}

function evaluate(sim, team, P, start) {
  if (sim.goal === team) return 100000 - sim.time * 100;
  if (sim.goal === 1 - team) return -100000;
  const bs = sim.bodies;
  const b = bs[0];
  const atkY = team === 0 ? 0 : L;
  const ownY = team === 0 ? L : 0;
  const dAtk = Math.hypot(b.x - W / 2, b.y - atkY);
  const dOwn = Math.hypot(b.x - W / 2, b.y - ownY);
  let s = (dOwn - dAtk) * 0.9;
  // being near the opponent goal mouth is worth extra
  if (dAtk < 45) s += (45 - dAtk) * 1.2;
  // danger in front of our own goal
  if (dOwn < 50) s -= (50 - dOwn) * 1.6 * P.defense;
  // what can the opponent do next turn?
  s -= 260 * P.defense * threat(sim, 1 - team);
  // keep somebody home
  if (P.keeper) {
    const kx = W / 2;
    const ky = team === 0 ? L - 9 : 9;
    let kd = 1e9;
    for (let i = 1 + team * 5; i < 6 + team * 5; i++) kd = Math.min(kd, Math.hypot(bs[i].x - kx, bs[i].y - ky));
    s -= Math.max(0, kd - 10) * 1.1 * P.defense;
  }
  // caps stuck inside their own goal are useless
  for (let i = 1 + team * 5; i < 6 + team * 5; i++) {
    const c = bs[i];
    if ((team === 0 && c.y > L) || (team === 1 && c.y < 0)) s -= 25;
  }
  // a shot that never touches the ball is usually a waste
  if (Math.abs(b.x - start.x) + Math.abs(b.y - start.y) < 0.5) s -= 18;
  return s;
}

function addAimed(list, world, team, idx, P, tx, ty, powers, offsets) {
  const b = world.bodies[0];
  const c = world.bodies[idx];
  const dx = tx - b.x;
  const dy = ty - b.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const gx = b.x - ux * (CAP_R + BALL_R * 0.98);
  const gy = b.y - uy * (CAP_R + BALL_R * 0.98);
  const vx = gx - c.x;
  const vy = gy - c.y;
  const dl = Math.hypot(vx, vy) || 1;
  if ((vx * ux + vy * uy) / dl < 0.15) return; // can't cut it that thin
  const a = Math.atan2(vy, vx);
  for (const o of offsets) for (const p of powers) list.push({ idx, a: a + o * (8 / Math.max(8, dl)), p });
}

export function* think(world, team, skill, rnd = Math.random) {
  const P = aiParams(skill);
  const bs = world.bodies;
  const b = bs[0];
  const atkY = team === 0 ? -3 : L + 3;
  const cands = [];
  for (let idx = 1 + team * 5; idx < 6 + team * 5; idx++) {
    const c = bs[idx];
    // shots at goal
    for (const ax of P.aims) addAimed(cands, world, team, idx, P, ax, atkY, P.powers, P.offsets);
    // straight at the ball
    const a0 = Math.atan2(b.y - c.y, b.x - c.x);
    for (const p of [0.4, 0.7, 1]) cands.push({ idx, a: a0, p });
    // clearances towards the wings
    for (const sx of [2, W - 2]) addAimed(cands, world, team, idx, P, sx, b.y + (team === 0 ? -40 : 40), [0.7, 1], [0]);
    // random sweep (blocks, bank shots, repositioning)
    for (let k = 0; k < P.rand; k++) cands.push({ idx, a: rnd() * Math.PI * 2, p: 0.3 + rnd() * 0.7 });
  }
  const sim = cloneWorld(world);
  const start = { x: b.x, y: b.y };
  for (let i = 0; i < cands.length; i++) {
    const cd = cands[i];
    copyInto(sim, world);
    sim.goal = -1;
    sim.time = 0;
    flick(sim.bodies[cd.idx], Math.cos(cd.a) * MAX_SPEED * cd.p, Math.sin(cd.a) * MAX_SPEED * cd.p);
    simulate(sim, 5);
    cd.score = evaluate(sim, team, P, start);
    yield (i + 1) / cands.length;
  }
  cands.sort((x, y) => y.score - x.score);
  const best = cands[0];
  let pick = cands[Math.floor(rnd() * Math.min(P.topK, cands.length))];
  // never pick a disaster when something sane exists; always take a sure goal on higher skills
  if (pick.score < best.score - 400 || (best.score > 50000 && skill >= 2.5)) pick = best;
  const a = pick.a + gauss(rnd) * P.noise;
  const p = Math.max(0.15, Math.min(1, pick.p * (1 + gauss(rnd) * P.pnoise)));
  return { idx: pick.idx, a, p, score: pick.score, n: cands.length };
}

// Runs the whole search synchronously (used by tests).
export function thinkNow(world, team, skill, rnd) {
  const g = think(world, team, skill, rnd);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
