// Ball Hero — deterministic simulation of one match moment (no DOM).
//
// World units are meters. x runs across the pitch (screen-right positive),
// y is the distance from the attacked goal line (the goal mouth spans |x| < GW
// at y = 0, the halfway line is y = 52.5) and z is the height.
//
// The same code drives the real game (match.js) and the level solver, so every
// outcome is reproducible: no randomness, fixed time step.

export const GW = 3.66; // half goal width
export const GH = 2.44; // crossbar height
export const BR = 0.11; // ball radius
export const NET_D = 2.0; // net depth
export const BOX_X = 20.16;
export const BOX_Y = 16.5;
export const SIX_X = 9.16;
export const SIX_Y = 5.5;
export const PEN_Y = 11;
export const PITCH_X = 34;
export const HALF_Y = 52.5;
export const DT = 1 / 120;
export const RUN_SPEED = 6.6;

const ACC = 7; // defenders' acceleration (m/s²)

export const BASE_P = {
  defSpeed: 5.0, // top speed of a defender closing a lane
  defReact: 0.32, // reaction time to a pass (s)
  defReach: 0.85, // body + leg reach (m)
  gkSpeed: 4.4, // keeper hand speed (m/s)
  gkReact: 0.26,
  gkReach: 0.8,
  press: 1, // how far the nearest defender closes down a new ball carrier
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = Math.hypot;

// ------------------------------------------------------------------ curves
// Quadratic Bézier on the ground plane with an arc-length table.
export function buildCurve(p0, p2, curl) {
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const L = hyp(dx, dy) || 1e-6;
  const nx = -dy / L;
  const ny = dx / L;
  const p1 = { x: (p0.x + p2.x) / 2 + nx * 2 * curl * L, y: (p0.y + p2.y) / 2 + ny * 2 * curl * L };
  const N = 40;
  const lut = new Float64Array(N + 1);
  let px = p0.x;
  let py = p0.y;
  let acc = 0;
  for (let k = 1; k <= N; k++) {
    const t = k / N;
    const a = (1 - t) * (1 - t);
    const b = 2 * t * (1 - t);
    const c = t * t;
    const qx = a * p0.x + b * p1.x + c * p2.x;
    const qy = a * p0.y + b * p1.y + c * p2.y;
    acc += hyp(qx - px, qy - py);
    lut[k] = acc;
    px = qx;
    py = qy;
  }
  return { p0: { x: p0.x, y: p0.y }, p1, p2: { x: p2.x, y: p2.y }, lut, len: Math.max(acc, 1e-6), chord: L, curl };
}

export function curveT(c, s) {
  if (s <= 0) return 0;
  if (s >= c.len) return 1;
  const lut = c.lut;
  let lo = 0;
  let hi = lut.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (lut[m] < s) lo = m;
    else hi = m;
  }
  const f = (s - lut[lo]) / (lut[hi] - lut[lo] || 1);
  return (lo + f) / (lut.length - 1);
}

export function curvePoint(c, t, out = {}) {
  const a = (1 - t) * (1 - t);
  const b = 2 * t * (1 - t);
  const d = t * t;
  out.x = a * c.p0.x + b * c.p1.x + d * c.p2.x;
  out.y = a * c.p0.y + b * c.p1.y + d * c.p2.y;
  return out;
}

// Fits the curl of a hand-drawn path (ground points) that should go from p0 to p2.
// The drawing is first mapped (rotation + scale) so that its ends match p0/p2,
// then the Bézier control point is found by least squares.
export function fitCurl(p0, p2, pts) {
  if (!pts || pts.length < 3) return 0;
  const a0 = pts[0];
  const a1 = pts[pts.length - 1];
  const ax = a1.x - a0.x;
  const ay = a1.y - a0.y;
  const bx = p2.x - p0.x;
  const by = p2.y - p0.y;
  const la = hyp(ax, ay);
  const lb = hyp(bx, by);
  if (la < 0.5 || lb < 0.5) return 0;
  // similarity transform drawing → target chord
  const sc = lb / la;
  const ang = Math.atan2(by, bx) - Math.atan2(ay, ax);
  const cs = Math.cos(ang) * sc;
  const sn = Math.sin(ang) * sc;
  const map = (p) => {
    const x = p.x - a0.x;
    const y = p.y - a0.y;
    return { x: p0.x + x * cs - y * sn, y: p0.y + x * sn + y * cs };
  };
  // arc-length parameterization
  const m = pts.map(map);
  const cum = [0];
  for (let i = 1; i < m.length; i++) cum.push(cum[i - 1] + hyp(m[i].x - m[i - 1].x, m[i].y - m[i - 1].y));
  const total = cum[cum.length - 1] || 1;
  let nx = 0;
  let ny = 0;
  let den = 0;
  for (let i = 1; i < m.length - 1; i++) {
    const t = cum[i] / total;
    const b = 2 * t * (1 - t);
    const a = (1 - t) * (1 - t);
    const c = t * t;
    nx += b * (m[i].x - a * p0.x - c * p2.x);
    ny += b * (m[i].y - a * p0.y - c * p2.y);
    den += b * b;
  }
  if (den < 1e-6) return 0;
  const p1x = nx / den;
  const p1y = ny / den;
  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const lx = -by / lb;
  const ly = bx / lb;
  return ((p1x - mx) * lx + (p1y - my) * ly) / (2 * lb);
}

// Distance a defender covers in `tau` seconds from a standstill.
function reachIn(tau, vmax) {
  if (tau <= 0) return 0;
  const tAcc = vmax / ACC;
  if (tau <= tAcc) return 0.5 * ACC * tau * tau;
  return 0.5 * vmax * tAcc + vmax * (tau - tAcc);
}

// ------------------------------------------------------------------ world
export function createWorld(L) {
  const P = { ...BASE_P, ...(L.p || {}) };
  const heroIdx = Math.max(0, L.att.findIndex((a) => a.hero));
  const w = {
    L,
    P,
    t: 0,
    phase: 'aim',
    carrier: L.ball ?? heroIdx,
    hero: heroIdx,
    passes: 0,
    lastPasser: -1,
    att: [],
    def: [],
    gk: null,
    ball: { x: 0, y: 0, z: BR, vx: 0, vy: 0, vz: 0, spin: 0, owner: 'att', free: false, held: null },
    flight: null,
    result: null,
    events: [],
    settle: null,
    postT: 0,
    netHit: false,
  };
  L.att.forEach((a, i) =>
    w.att.push({
      i,
      x: a.x,
      y: a.y,
      hero: i === heroIdx && !!a.hero,
      run: a.run ? { x: a.x + a.run[0], y: a.y + a.run[1] } : null,
      tgt: null,
      spd: 0,
      anim: i * 1.7,
      moving: 0,
      pose: 'idle',
      poseT: 0,
      faceX: 0,
      faceY: -1,
    }),
  );
  (L.def || []).forEach((d, i) => w.def.push(makeDef(d.x, d.y, i, false)));
  const A = w.att[w.carrier];
  const ball = w.ball;
  if (L.type === 'corner') {
    ball.x = A.x + (A.x < 0 ? 0.5 : -0.5);
    ball.y = Math.max(0.35, A.y - 0.3);
  } else {
    ball.x = A.x;
    ball.y = A.y - 0.45;
  }
  if (L.type === 'freekick' && L.wall) buildWall(w, L.wall);
  // marking: each defender tracks the nearest attacker that is not on the ball
  for (const d of w.def) {
    if (d.wall) continue;
    let best = -1;
    let bd = 6;
    for (const a of w.att) {
      if (a.i === w.carrier) continue;
      const dd = hyp(a.x - d.x, a.y - d.y);
      if (dd < bd) {
        bd = dd;
        best = a.i;
      }
    }
    d.mark = best;
    if (best >= 0) {
      d.offX = d.x - w.att[best].x;
      d.offY = d.y - w.att[best].y;
    }
  }
  const home = gkHome(w, ball.x, ball.y);
  w.gk = { x: home.x, y: home.y, x0: home.x, kx: home.x, kz: 1.0, pose: 'ready', poseT: 0, anim: 0, side: 0, hold: false };
  if (L.noKeeper) w.gk = null;
  return w;
}

function makeDef(x, y, i, wall) {
  return { i, x, y, wall, tgt: null, v: 0, react: 0, anim: i * 2.3, moving: 0, pose: wall ? 'wall' : 'idle', poseT: 0, mark: -1, offX: 0, offY: 0 };
}

function buildWall(w, n) {
  const b = w.ball;
  const side = b.x > 0.5 ? 1 : b.x < -0.5 ? -1 : 1;
  const aimX = side * GW * 0.45;
  const dx = aimX - b.x;
  const dy = 0 - b.y;
  const d = hyp(dx, dy);
  const ux = dx / d;
  const uy = dy / d;
  const cx = b.x + ux * 9.15;
  const cy = b.y + uy * 9.15;
  // perpendicular, starting from the near-post side
  let px = -uy;
  let py = ux;
  if (px * side < 0) {
    px = -px;
    py = -py;
  }
  for (let k = 0; k < n; k++) {
    const off = 0.3 - k * 0.58 + (n - 1) * 0.12;
    w.def.push(makeDef(cx + px * off, cy + py * off, w.def.length, true));
  }
  w.wallSide = side;
}

export function gkHome(w, bx, by) {
  const L = w.L;
  if (L.type === 'penalty') return { x: 0, y: 0.35 };
  const d = hyp(bx, by) || 1;
  const out = clamp(0.35 + d * 0.045, 0.5, 1.6);
  // stand on the bisector of the shooting angle
  const l1 = hyp(-GW - bx, by) || 1;
  const l2 = hyp(GW - bx, by) || 1;
  let ux = (-GW - bx) / l1 + (GW - bx) / l2;
  let uy = -by / l1 - by / l2;
  const ul = hyp(ux, uy) || 1;
  ux /= ul;
  uy /= ul;
  const near = Math.sign(bx) * (GW - 0.35);
  let x = uy < -0.2 && by > out ? bx + ux * ((out - by) / uy) : near;
  const tight = clamp((Math.abs(bx) - by * 1.2 - 3) / 8, 0, 1);
  x = x * (1 - tight) + near * tight;
  if (L.type === 'freekick' && w.wallSide && by > 14) x = -w.wallSide * 0.75;
  x = clamp(x, -GW + 0.35, GW - 0.35);
  return { x, y: Math.max(0.45, out * (1 - tight) + 0.5 * tight) };
}

export function cloneWorld(w) {
  const c = { ...w };
  c.att = w.att.map((a) => ({ ...a, run: a.run ? { ...a.run } : null, tgt: a.tgt ? { ...a.tgt } : null }));
  c.def = w.def.map((d) => ({ ...d, tgt: d.tgt ? { ...d.tgt } : null }));
  c.gk = w.gk ? { ...w.gk } : null;
  c.ball = { ...w.ball };
  c.flight = null; // clones are only taken at decision points
  c.events = [];
  c.result = w.result ? { ...w.result } : null;
  c.settle = null;
  return c;
}

// ------------------------------------------------------------------ actions
// plan: { type: 'shot', tx, tz, curl }
//       { type: 'pass', to, curl, through?, loft? }
//       { type: 'space', x, y, curl }
//   + optional `next`: a shot plan taken first-time when a lofted pass arrives.
export function launch(w, plan, origin = null) {
  if (w.result) return null;
  const from = w.carrier;
  const o = origin || { x: w.ball.x, y: w.ball.y, z: w.ball.z };
  const F = buildFlight(w, plan, from, o);
  if (!F) return null;
  w.flight = F;
  w.phase = 'flight';
  w.ball.owner = null;
  w.ball.free = false;
  const A = w.att[from];
  A.pose = F.air ? (F.header ? 'header' : 'volley') : 'kick';
  A.poseT = 0;
  if (F.type !== 'shot') startRuns(w, F);
  computeIntercepts(w, F);
  w.events.push({ type: F.type === 'shot' ? 'shot' : 'pass', lofted: F.lofted, curl: F.curl, air: F.air, header: F.header, from });
  return F;
}

export function queueFirstTime(w, plan) {
  const F = w.flight;
  if (!F || F.type === 'shot' || F.receiver < 0 || F.z1 < 0.5) return false;
  F.next = plan;
  return true;
}

// can the incoming pass be finished first time (header / volley)?
export function firstTimeOpen(w) {
  const F = w.flight;
  return !!(F && F.type !== 'shot' && F.lofted && F.receiver >= 0 && F.z1 > 0.5 && !F.next && !F.gkClaim);
}

function buildFlight(w, plan, from, o) {
  const F = {
    type: plan.type,
    from,
    receiver: -1,
    curl: 0,
    lofted: false,
    air: false,
    header: false,
    s: 0,
    time: 0,
    z0: o.z,
    z1: BR,
    h: 0,
    wait: 0,
    waited: 0,
    icpt: null,
    gkClaim: false,
    next: plan.next || null,
    tx: 0,
    tz: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    gkChecked: false,
    out: false,
    outside: false,
    origin: { x: o.x, y: o.y },
  };
  if (plan.type === 'shot') {
    // a ball can only swing so far: cap the sideways bend at ~2.8 m
    const chord = hyp(plan.tx - o.x, o.y) || 1;
    const cmax = Math.min(0.25, 2.8 / chord);
    const c = clamp(plan.curl || 0, -cmax, cmax);
    F.tx = plan.tx;
    F.tz = clamp(plan.tz, BR, 4.5);
    F.curve = buildCurve(o, { x: plan.tx, y: 0 }, c);
    F.curl = c;
    F.air = o.z > 0.5;
    F.header = o.z >= 1.2;
    const L = F.curve.chord;
    F.v0 = F.header ? 15.5 : F.air ? 23.5 : 27 - 16 * Math.abs(c);
    F.v1 = F.v0 * clamp(1 - 0.006 * L, 0.8, 0.96);
    F.z1 = F.tz;
    F.h = F.header ? 0 : clamp((F.z1 - 0.3) / 2.1, 0, 1) * clamp((L - 9) / 16, 0, 1) * 2.0;
    F.outside = o.y > BOX_Y + 0.01 || Math.abs(o.x) > BOX_X;
    return F;
  }
  let target;
  let R = -1;
  let runnerT = 0;
  if (plan.type === 'pass') {
    R = plan.to;
    const B = w.att[R];
    if (!B || R === from) return null;
    if (plan.through && B.run) {
      target = { x: B.run.x, y: B.run.y };
      runnerT = hyp(B.run.x - B.x, B.run.y - B.y) / RUN_SPEED;
      B.tgt = { x: target.x, y: target.y, spd: RUN_SPEED };
      B.run = null;
    } else target = { x: B.x, y: B.y + 0.2 };
  } else {
    target = { x: plan.x, y: plan.y };
    let bestT = 3.0;
    for (const a of w.att) {
      if (a.i === from) continue;
      const tt = hyp(a.x - target.x, a.y - target.y) / RUN_SPEED;
      if (tt < bestT) {
        bestT = tt;
        R = a.i;
      }
    }
    if (Math.abs(target.x) > PITCH_X || target.y < 0 || target.y > HALF_Y + 8) {
      R = -1;
      F.out = true;
    }
    if (R >= 0) {
      runnerT = bestT;
      const B = w.att[R];
      B.tgt = { x: target.x, y: target.y + 0.2, spd: RUN_SPEED };
      B.run = null;
    }
  }
  F.receiver = R;
  const pc = Math.min(0.3, 6 / (hyp(target.x - o.x, target.y - o.y) || 1));
  const c = clamp(plan.curl || 0, -pc, pc);
  F.curve = buildCurve(o, target, c);
  F.curl = c;
  const L = F.curve.chord;
  F.lofted = plan.loft !== undefined ? !!plan.loft : autoLoft(w, F.curve, o, target);
  if (F.lofted) {
    F.v0 = clamp(8 + 0.32 * L, 10, 18);
    F.v1 = F.v0 * 0.9;
    F.h = clamp(1.4 + 0.17 * L, 2.6, 8);
    if (R >= 0) F.z1 = target.y < 12.5 && Math.abs(target.x) < 11 ? 1.85 : target.y < 22 && Math.abs(target.x) < 20.5 ? 0.95 : 0.3;
    if (Math.abs(target.x) < SIX_X - 0.5 && target.y < SIX_Y && w.gk) F.gkClaim = true;
  } else {
    F.v0 = clamp(9 + 0.6 * L, 12, 25);
    F.v1 = F.v0 * 0.65;
  }
  // time the ball to meet a runner
  if (runnerT > 0) {
    const T = flightTime(F);
    if (T < runnerT) {
      let f = T / runnerT;
      if (F.v0 * f < 8) f = 8 / F.v0;
      F.v0 *= f;
      F.v1 *= f;
      F.wait = Math.max(0, runnerT - flightTime(F));
    }
  }
  return F;
}

function autoLoft(w, curve, o, target) {
  if (curve.chord < 7) return false;
  if (Math.abs(o.x) > 15.5 && target.y < 18 && Math.abs(target.x) < 16) return true; // a cross
  const P = w.P;
  const q = {};
  for (const d of w.def) {
    for (let s = 1.5; s <= curve.len - 1.2; s += 0.5) {
      curvePoint(curve, curveT(curve, s), q);
      if (hyp(d.x - q.x, d.y - q.y) < P.defReach + 0.75) return true;
    }
  }
  return false;
}

export function flightTimeAt(F, s) {
  const len = F.curve.len;
  const k = (F.v1 - F.v0) / len;
  if (Math.abs(k) < 1e-9) return s / F.v0;
  return Math.log((F.v0 + k * s) / F.v0) / k;
}
const flightTime = (F) => flightTimeAt(F, F.curve.len);

export function flightZ(F, u) {
  return F.z0 + (F.z1 - F.z0) * u + F.h * 4 * u * (1 - u);
}

function startRuns(w, F) {
  for (const a of w.att) {
    if (a.i === F.from || a.i === F.receiver || !a.run) continue;
    a.tgt = { x: a.run.x, y: a.run.y, spd: RUN_SPEED * 0.95 };
    a.run = null;
  }
  // markers follow the runners, a step behind
  for (const d of w.def) {
    if (d.wall || d.mark < 0) continue;
    const a = w.att[d.mark];
    if (a.tgt) d.tgt = { x: a.tgt.x + d.offX * 0.8, y: a.tgt.y + d.offY * 0.8 + 0.8, spd: RUN_SPEED * 0.8 };
  }
}

// For every defender (and the keeper on passes), find the earliest point of the
// ball's path he can reach in time. The earliest one intercepts.
function computeIntercepts(w, F) {
  const P = w.P;
  const len = F.curve.len;
  const shot = F.type === 'shot';
  const q = {};
  let best = null;
  const cands = w.def.map((d) => ({ d, keeper: false }));
  if (!shot && w.gk) cands.push({ d: w.gk, keeper: true });
  for (const { d, keeper } of cands) {
    const react = d.wall ? 0.1 : keeper ? 0.28 : shot ? P.defReact * 0.75 : P.defReact;
    const vmax = d.wall ? 1.2 : keeper ? 5 : P.defSpeed;
    const reachH = d.wall ? 2.3 : keeper ? 2.6 : 1.95;
    const step = 0.3;
    for (let s = 0.35; ; s += step) {
      const end = s >= len;
      if (end) s = len;
      curvePoint(F.curve, curveT(F.curve, s), q);
      const z = flightZ(F, s / len);
      if (z <= reachH) {
        let reach = d.wall ? 0.42 : keeper ? 1.0 : P.defReach;
        if (z > 1.1 && !d.wall && !keeper) reach -= 0.25;
        const dist = hyp(d.x - q.x, d.y - q.y) - reach;
        let tb = flightTimeAt(F, s);
        let ok;
        if (!shot && F.receiver >= 0 && s > len - 1.0) {
          // duel at the receiver's feet: defenders mostly track their man
          tb += end ? F.wait : 0;
          ok = dist <= 0.3 + Math.min(0.85, reachIn(tb - react, vmax) * 0.3);
        } else {
          if (end) tb += F.wait;
          ok = dist <= 0 || dist <= reachIn(tb - react, vmax);
        }
        if (ok) {
          if (!best || tb < best.tb) best = { d, keeper, s, tb, x: q.x, y: q.y, z };
          break;
        }
      }
      if (end) break;
    }
  }
  F.icpt = best;
  if (best && !best.keeper) {
    best.d.tgt = { x: best.x, y: best.y, spd: best.d.wall ? 1.2 : P.defSpeed, react: best.d.wall ? 0.1 : P.defReact * (shot ? 0.75 : 1), at: 0 };
  }
}

// ------------------------------------------------------------------ stepping
export function step(w, dt = DT) {
  w.t += dt;
  for (const a of w.att) {
    a.poseT += dt;
    if (a.tgt) moveEnt(a, a.tgt, dt, a.tgt.spd);
    else a.moving = Math.max(0, a.moving - dt * 4);
  }
  for (const d of w.def) {
    d.poseT += dt;
    if (d.tgt) {
      if (d.tgt.react !== undefined) {
        d.tgt.at += dt;
        if (d.tgt.at < d.tgt.react) continue;
        d.v = Math.min(d.tgt.spd, d.v + ACC * dt);
        moveEnt(d, d.tgt, dt, d.v);
      } else moveEnt(d, d.tgt, dt, d.tgt.spd);
    } else d.moving = Math.max(0, d.moving - dt * 4);
  }
  if (w.gk) w.gk.poseT += dt;
  if (w.phase === 'flight') stepFlight(w, dt);
  else if (w.phase === 'settle') stepSettle(w, dt);
  else if (w.phase === 'post') stepPost(w, dt);
}

function moveEnt(e, tgt, dt, spd) {
  const dx = tgt.x - e.x;
  const dy = tgt.y - e.y;
  const d = hyp(dx, dy);
  const m = spd * dt;
  if (d <= m || d < 1e-4) {
    e.x = tgt.x;
    e.y = tgt.y;
    e.tgt = null;
    if (e.v !== undefined) e.v = 0;
    return true;
  }
  e.x += (dx / d) * m;
  e.y += (dy / d) * m;
  e.moving = Math.min(1, e.moving + dt * 6);
  e.anim += m * 1.9;
  e.faceX = dx / d;
  e.faceY = dy / d;
  return false;
}

const tmp = {};
function stepFlight(w, dt) {
  const F = w.flight;
  const b = w.ball;
  F.time += dt;
  const len = F.curve.len;
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  if (F.s < len) {
    const v = F.v0 + (F.v1 - F.v0) * (F.s / len);
    F.s = Math.min(len, F.s + v * dt);
    b.spin += (v * dt) / 0.35;
  } else F.waited += dt;
  const u = F.s / len;
  curvePoint(F.curve, curveT(F.curve, F.s), tmp);
  b.x = tmp.x;
  b.y = tmp.y;
  b.z = flightZ(F, u);
  if (F.s < len) {
    F.vx = (b.x - px) / dt;
    F.vy = (b.y - py) / dt;
    F.vz = (b.z - pz) / dt;
  }
  // left the field before reaching its target (over the goal line or touchline)
  if (F.s < len - 0.05 && (b.y < -BR * 2 || Math.abs(b.x) > PITCH_X + 0.3 || b.y > HALF_Y * 2)) {
    outOfPlay(w, F);
    return;
  }
  // interception / block
  if (F.icpt && F.time >= F.icpt.tb) {
    intercept(w, F);
    return;
  }
  if (F.type === 'shot') {
    stepKeeper(w, F, dt);
    if (w.gk && F.time > 0.05 && keeperSaves(w, F)) return;
    if (F.s >= len) goalLine(w, F);
  } else if (F.s >= len && F.waited >= F.wait - 1e-9) arrive(w, F);
}

function stepKeeper(w, F, dt) {
  const k = w.gk;
  if (!k) return;
  if (F.time < w.P.gkReact) return;
  const b = w.ball;
  const vx = F.vx;
  const vy = F.vy;
  const vz = F.vz;
  const v2 = vx * vx + vy * vy;
  if (v2 < 1) return;
  // where does the ball (straight-line guess) pass closest to him?
  let tc = ((k.kx - b.x) * vx + (k.y - b.y) * vy) / v2;
  if (tc < 0) tc = 0;
  let px = b.x + vx * tc;
  let pz = b.z + vz * tc;
  let spd = w.P.gkSpeed;
  const xg = vy < -0.5 ? b.x + vx * (b.y / -vy) : px;
  if (Math.abs(xg) > GW + 0.6) {
    // reads it going wide: only covers his post
    px = clamp(px, -GW + 0.6, GW - 0.6);
    spd *= 0.65;
  }
  pz = clamp(pz, 0.2, 2.35);
  const dx = px - k.kx;
  const dz = pz - k.kz;
  const d = hyp(dx, dz);
  const m = Math.min(d, spd * dt);
  if (d > 1e-6) {
    k.kx += (dx / d) * m;
    k.kz += (dz / d) * m;
  }
  // step toward a ball crossing in front of him
  const py = clamp(b.y + vy * tc, 0.3, 4.5);
  const my = py - k.y;
  if (Math.abs(my) > 0.05) k.y += Math.sign(my) * Math.min(Math.abs(my), spd * 0.55 * dt);
  k.kx = clamp(k.kx, -GW - 0.3, GW + 0.3);
  const off = k.kx - k.x0;
  if (Math.abs(off) > 0.55 || k.kz < 0.55 || k.kz > 1.75) {
    if (k.pose !== 'dive') {
      k.pose = 'dive';
      k.poseT = 0;
    }
    k.side = Math.sign(off) || 1;
  }
  k.x = k.x0 + off * 0.75;
}

function keeperSaves(w, F) {
  const k = w.gk;
  const b = w.ball;
  const R = w.P.gkReach;
  const dx = (b.x - k.kx) / (R * 1.05);
  const dy = (b.y - k.y) / 0.6;
  const dz = (b.z - k.kz) / (R * 1.3);
  let n = dx * dx + dy * dy + dz * dz;
  // standing keeper: the body blocks too
  if (n > 1 && Math.abs(b.x - k.x) < 0.42 && Math.abs(b.y - k.y) < 0.45 && b.z < 1.95) n = 0.9;
  if (n > 1) return false;
  const speed = hyp(F.vx, F.vy, F.vz);
  w.flight = null;
  w.phase = 'post';
  w.postT = 0;
  b.free = true;
  if (n < 0.35 && speed < 24 && b.z < 2.3) {
    // caught
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    b.held = 'gk';
    k.pose = Math.abs(k.kx - k.x0) > 0.6 ? 'dive' : 'catch';
    k.hold = true;
  } else {
    b.vx = (Math.sign(b.x - k.kx) || 1) * 5.5;
    b.vy = 6;
    b.vz = 3;
  }
  w.result = { ok: false, reason: 'saved', goal: false };
  w.events.push({ type: 'save', caught: !!b.held });
  return true;
}

function goalLine(w, F) {
  const b = w.ball;
  const ax = Math.abs(b.x);
  const z = b.z;
  w.flight = null;
  w.phase = 'post';
  w.postT = 0;
  b.free = true;
  b.vx = F.vx;
  b.vy = F.vy;
  b.vz = F.vz;
  const shooter = w.att[F.from];
  if (ax <= GW - BR && z <= GH - BR) {
    const assist = w.lastPasser >= 0 && w.lastPasser !== F.from ? w.lastPasser : -1;
    w.result = {
      ok: true,
      goal: true,
      scorer: F.from,
      hero: !!shooter.hero,
      assist,
      heroAssist: assist >= 0 && !!w.att[assist].hero,
      curl: Math.abs(F.curl) * F.curve.chord >= 1.0,
      air: F.air,
      header: F.header,
      outside: F.outside,
      top: ax > GW - 1.0 && z > GH - 0.95,
      low: z < 0.55,
      passes: w.passes,
      x: b.x,
      z,
    };
    w.events.push({ type: 'goal', x: b.x, z });
    for (const a of w.att) {
      a.tgt = null;
      if (a.i === F.from) {
        a.pose = 'celebrate';
        a.poseT = 0;
      }
    }
    if (w.gk && w.gk.pose !== 'dive') w.gk.pose = 'beaten';
    return;
  }
  if (ax <= GW + BR + 0.05 && z <= GH + BR) {
    // woodwork
    const bar = z > GH - BR && ax <= GW;
    w.result = { ok: false, reason: bar ? 'bar' : 'post', goal: false };
    if (bar) {
      b.vz = Math.abs(b.vz) * 0.5 + 2;
      b.vy = Math.abs(b.vy) * 0.35;
    } else {
      b.vy = Math.abs(b.vy) * 0.45;
      b.vx = -Math.sign(b.x) * (2 + Math.abs(b.vx) * 0.3);
    }
    b.y = 0.12;
    w.events.push({ type: 'post' });
    return;
  }
  w.result = { ok: false, reason: z > GH ? 'over' : 'wide', goal: false };
  w.events.push({ type: 'miss' });
}

function outOfPlay(w, F) {
  const b = w.ball;
  w.flight = null;
  w.phase = 'post';
  w.postT = 0;
  b.free = true;
  b.vx = F.vx;
  b.vy = F.vy;
  b.vz = F.vz;
  w.result = { ok: false, reason: F.type === 'shot' ? 'wide' : 'out', goal: false };
  w.events.push({ type: F.type === 'shot' ? 'miss' : 'lost' });
}

function intercept(w, F) {
  const I = F.icpt;
  const b = w.ball;
  w.flight = null;
  w.phase = 'post';
  w.postT = 0;
  b.free = true;
  if (I.keeper) {
    b.held = 'gk';
    b.vx = b.vy = b.vz = 0;
    w.gk.pose = 'catch';
    w.gk.hold = true;
    w.result = { ok: false, reason: 'claimed', goal: false };
    w.events.push({ type: 'save', caught: true });
    return;
  }
  const d = I.d;
  d.tgt = null;
  d.pose = d.wall ? 'wallhit' : b.z > 1.2 ? 'header' : 'tackle';
  d.poseT = 0;
  // the ball is cleared back up the pitch
  const dir = d.x === 0 ? 1 : Math.sign(d.x);
  b.vx = dir * (d.wall ? 2.5 : 4);
  b.vy = d.wall ? 7 : 13;
  b.vz = d.wall ? 2.5 : 5;
  w.result = { ok: false, reason: F.type === 'shot' ? 'blocked' : 'intercepted', goal: false, by: d.i };
  w.events.push({ type: 'intercept', shot: F.type === 'shot', wall: d.wall });
}

function arrive(w, F) {
  const R = F.receiver;
  const b = w.ball;
  if (R < 0) {
    w.flight = null;
    w.phase = 'post';
    w.postT = 0;
    b.free = true;
    b.vx = F.vx * 0.3;
    b.vy = F.vy * 0.3;
    b.vz = 0;
    w.result = { ok: false, reason: F.out ? 'out' : 'nobody', goal: false };
    w.events.push({ type: 'lost' });
    return;
  }
  if (F.gkClaim && w.gk) {
    w.flight = null;
    w.phase = 'post';
    w.postT = 0;
    b.free = true;
    b.held = 'gk';
    w.gk.pose = 'catch';
    w.gk.hold = true;
    w.gk.kx = b.x;
    w.gk.x = b.x;
    w.gk.y = Math.max(0.5, b.y - 0.3);
    w.result = { ok: false, reason: 'claimed', goal: false };
    w.events.push({ type: 'save', caught: true });
    return;
  }
  const A = w.att[R];
  A.tgt = null;
  w.passes++;
  w.lastPasser = F.from;
  w.carrier = R;
  w.flight = null;
  // runners still on their way stop where they are
  if (F.next) {
    const plan = F.next;
    w.phase = 'aim';
    const o = { x: b.x, y: b.y, z: b.z };
    resetKeeper(w);
    launch(w, plan, o);
    return;
  }
  b.owner = 'att';
  b.z = BR;
  b.x = A.x;
  b.y = A.y - 0.45;
  w.phase = 'settle';
  w.events.push({ type: 'control', to: R });
  startSettle(w);
}

function resetKeeper(w) {
  const k = w.gk;
  if (!k) return;
  k.x0 = k.x;
  k.kx = k.x;
  k.kz = 1.0;
  k.pose = 'ready';
}

// After a reception the nearest defender closes the ball down and the keeper
// takes a new position. Final positions are computed up front so the solver
// can skip the animation.
function startSettle(w) {
  const P = w.P;
  const A = w.att[w.carrier];
  const moves = [];
  let near = null;
  let nd = 11;
  for (const d of w.def) {
    if (d.wall) continue;
    const dd = hyp(d.x - A.x, d.y - A.y);
    if (dd < nd) {
      nd = dd;
      near = d;
    }
  }
  if (near && P.press > 0) {
    const gx = -A.x;
    const gy = -A.y;
    const gl = hyp(gx, gy) || 1;
    const tx = A.x + (gx / gl) * 2.1;
    const ty = A.y + (gy / gl) * 2.1;
    const dx = tx - near.x;
    const dy = ty - near.y;
    const dl = hyp(dx, dy);
    const cap = 2.6 * P.press;
    const f = dl > cap ? cap / dl : 1;
    moves.push({ e: near, x: near.x + dx * f, y: near.y + dy * f });
  }
  // a reception ends any planned marking runs
  for (const d of w.def) if (d.tgt && d.tgt.react === undefined) moves.push({ e: d, x: d.tgt.x, y: d.tgt.y });
  for (const a of w.att) if (a.tgt) moves.push({ e: a, x: a.tgt.x, y: a.tgt.y });
  const k = w.gk;
  let kh = null;
  if (k) {
    kh = gkHome(w, w.ball.x, w.ball.y);
    moves.push({ e: k, x: kh.x, y: kh.y, keeper: true });
  }
  w.settle = { t: 0, dur: 0.6, moves: moves.map((m) => ({ ...m, sx: m.e.x, sy: m.e.y })) };
  for (const d of w.def) d.tgt = null;
  for (const a of w.att) a.tgt = null;
}

function stepSettle(w, dt) {
  const S = w.settle;
  S.t += dt;
  const f = clamp(S.t / S.dur, 0, 1);
  const e = f * f * (3 - 2 * f);
  for (const m of S.moves) {
    const nx = m.sx + (m.x - m.sx) * e;
    const ny = m.sy + (m.y - m.sy) * e;
    const ent = m.e;
    const dd = hyp(nx - ent.x, ny - ent.y);
    if (dd > 1e-4) {
      ent.anim = (ent.anim || 0) + dd * 1.9;
      ent.moving = Math.min(1, (ent.moving || 0) + dt * 6);
    }
    ent.x = nx;
    ent.y = ny;
  }
  if (f >= 1) finishSettle(w);
}

export function finishSettle(w) {
  const S = w.settle;
  if (S) for (const m of S.moves) {
    m.e.x = m.x;
    m.e.y = m.y;
  }
  w.settle = null;
  resetKeeper(w);
  for (const d of w.def) {
    d.v = 0;
    if (d.mark >= 0 && !d.wall) {
      const a = w.att[d.mark];
      d.offX = d.x - a.x;
      d.offY = d.y - a.y;
    }
  }
  const A = w.att[w.carrier];
  w.ball.x = A.x;
  w.ball.y = A.y - 0.45;
  w.ball.z = BR;
  w.phase = 'aim';
}

function stepPost(w, dt) {
  w.postT += dt;
  const b = w.ball;
  if (b.held === 'gk' && w.gk) {
    const k = w.gk;
    b.x = k.kx;
    b.y = k.y;
    b.z = Math.max(BR, k.kz);
    return;
  }
  if (!b.free) return;
  b.vz -= 9.8 * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.spin += (hyp(b.vx, b.vy) * dt) / 0.35;
  if (b.z < BR) {
    b.z = BR;
    if (b.vz < -1.2) {
      b.vz = -b.vz * 0.45;
      w.events.push({ type: 'bounce' });
    } else b.vz = 0;
    const f = Math.pow(0.4, dt);
    b.vx *= f;
    b.vy *= f;
  }
  if (w.result && w.result.goal) {
    if (b.y < 0) {
      if (b.y < -NET_D + BR + 0.15) {
        b.y = -NET_D + BR + 0.15;
        if (!w.netHit) {
          w.netHit = true;
          w.events.push({ type: 'net', x: b.x, z: b.z });
        }
        b.vy = Math.abs(b.vy) * 0.08;
        b.vx *= 0.3;
        b.vz *= 0.3;
      }
      if (Math.abs(b.x) > GW - BR) {
        b.x = Math.sign(b.x) * (GW - BR);
        b.vx = -b.vx * 0.2;
      }
      const roof = GH - BR - (0.35 * -b.y) / NET_D;
      if (b.z > roof) {
        b.z = roof;
        b.vz = -Math.abs(b.vz) * 0.2;
      }
    }
  } else if (b.y < -4.2) {
    b.y = -4.2;
    b.vy = Math.abs(b.vy) * 0.2;
  }
}

// ------------------------------------------------------------------ solver
// Used to validate generated levels and (offline) the hand-made ones.
function runToDecision(w) {
  for (let g = 0; g < 4000; g++) {
    if (w.result) return;
    if (w.phase === 'aim') return;
    if (w.phase === 'settle') {
      finishSettle(w);
      continue;
    }
    step(w, DT);
  }
}

export const SHOTS_FULL = (() => {
  const out = [];
  for (const tx of [-3.3, -2.9, -2.3, 2.3, 2.9, 3.3]) for (const tz of [0.3, 1.25, 2.15]) for (const curl of [-0.2, -0.1, 0, 0.1, 0.2]) out.push({ type: 'shot', tx, tz, curl });
  return out;
})();
export const SHOTS_QUICK = (() => {
  const out = [];
  for (const tx of [-3.2, -2.7, 2.7, 3.2]) for (const tz of [0.3, 2.1]) for (const curl of [-0.16, 0, 0.16]) out.push({ type: 'shot', tx, tz, curl });
  return out;
})();
export const HEADERS = (() => {
  const out = [];
  for (const tx of [-3.2, -2.6, 2.6, 3.2]) for (const tz of [0.3, 2.0]) out.push({ type: 'shot', tx, tz, curl: 0 });
  return out;
})();

function passPlans(w, curls) {
  const out = [];
  for (const a of w.att) {
    if (a.i === w.carrier) continue;
    for (const curl of curls) {
      out.push({ type: 'pass', to: a.i, curl });
      if (a.run) out.push({ type: 'pass', to: a.i, curl, through: true });
    }
  }
  return out;
}

// Breadth-first search for a goal with as few passes as possible.
// Returns { ok, minPasses, seq, facts } where facts lists which shot
// properties (curl, top, air…) can finish the found sequences.
export function solve(L, opt = {}) {
  const maxPasses = opt.maxPasses ?? 2;
  const shots = opt.shots || SHOTS_QUICK;
  const curls = opt.curls || [-0.2, 0, 0.2];
  const needHero = opt.needHero ?? false;
  const budget = { n: opt.budget ?? 20000 };
  const root = createWorld(L);
  const goals = [];
  let frontier = [{ w: root, seq: [] }];
  const wanted = (r) => r && r.goal && (!needHero || r.hero);
  for (let depth = 0; depth <= maxPasses; depth++) {
    const next = [];
    for (const node of frontier) {
      if (node.w.result) continue;
      for (const sh of shots) {
        if (budget.n-- <= 0) break;
        const c = cloneWorld(node.w);
        launch(c, sh);
        runToDecision(c);
        if (wanted(c.result)) goals.push({ seq: [...node.seq, sh], r: c.result });
      }
      if (depth < maxPasses || opt.air) {
        for (const pp of passPlans(node.w, curls)) {
          if (budget.n-- <= 0) break;
          const c = cloneWorld(node.w);
          const F = launch(c, pp);
          if (!F) continue;
          if (F.lofted && F.z1 > 0.5 && F.receiver >= 0) {
            for (const hd of HEADERS) {
              if (budget.n-- <= 0) break;
              const c2 = cloneWorld(node.w);
              launch(c2, { ...pp, next: hd });
              runToDecision(c2);
              if (wanted(c2.result)) goals.push({ seq: [...node.seq, { ...pp, next: hd }], r: c2.result });
            }
          }
          if (depth < maxPasses) {
            runToDecision(c);
            if (!c.result) next.push({ w: c, seq: [...node.seq, pp] });
          }
        }
      }
    }
    if (goals.length && !opt.exhaustive) break;
    frontier = next;
    if (!frontier.length) break;
  }
  if (!goals.length) return { ok: false };
  const minPasses = Math.min(...goals.map((g) => g.r.passes));
  const facts = { curl: false, top: false, low: false, air: false, outside: false, hero: false, heroAssist: false };
  const combos = new Set();
  for (const g of goals) {
    for (const k of Object.keys(facts)) if (g.r[k]) facts[k] = true;
    combos.add(['curl', 'top', 'low', 'air', 'outside', 'hero', 'heroAssist'].filter((k) => g.r[k]).join('+') + '@' + g.r.passes);
  }
  const best = goals.find((g) => g.r.passes === minPasses);
  return { ok: true, minPasses, seq: best.seq, facts, combos: [...combos], goals: goals.length };
}

// Replays a sequence of plans; used by tests.
export function replay(L, plans) {
  const w = createWorld(L);
  for (const p of plans) {
    if (w.result) break;
    launch(w, p);
    runToDecision(w);
  }
  return w;
}
