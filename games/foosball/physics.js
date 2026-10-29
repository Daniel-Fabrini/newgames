// Foosball — pure simulation (no DOM). Units are "cm-ish": table 68 wide (x, rods run along x),
// 120 long (y). Team 0 defends the bottom goal (y = H) and attacks up; team 1 is the mirror.
// Fixed sub-steps (1/480 s), the ball can never tunnel (max speed * dt << radius).

export const T = Object.freeze({
  W: 68,
  H: 120,
  R: 2.2, // ball radius
  goalW: 24,
  goalD: 9,
  bevel: 8,
  footHX: 1.9,
  footHY: 1.7,
  footR: 0.7, // rounded foot corners
  L: 9, // leg length (foot offset = L * sin(theta))
  activeCos: 0.5, // foot is at ball level while cos(theta) >= this
  maxBall: 210,
  SUB: 1 / 480,
  slideSpeed: 130,
  slideAccel: 1800,
  thMax: 1.05,
  thWind: -0.95,
  wallE: 0.72,
  footE: 0.35,
  footMu: 0.6,
  decel: 12,
  drag: 0.4,
});

const KINDS = {
  gk: { n: 1, sp: 0, slide: 15 },
  def: { n: 2, sp: 26 },
  mid: { n: 5, sp: 13 },
  att: { n: 3, sp: 21 },
};
// top (y small) to bottom
const LAYOUT = [[1, 'gk'], [1, 'def'], [0, 'att'], [1, 'mid'], [0, 'mid'], [1, 'att'], [0, 'def'], [0, 'gk']];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const manX = (r, k) => T.W / 2 + (k - (r.n - 1) / 2) * r.sp + r.x;
export const footY = (r) => r.y + r.s * T.L * Math.sin(r.th);
export const footActive = (r) => Math.cos(r.th) >= T.activeCos;
export const goalX0 = (T.W - T.goalW) / 2;
export const goalX1 = (T.W + T.goalW) / 2;

// static wall segments (table outline with bevels + the two goal pockets)
const SEGS = (() => {
  const { W, H, bevel: b, goalD: D } = T;
  const g0 = goalX0, g1 = goalX1;
  const w = (a, bb, c, d, e = T.wallE) => ({ ax: a, ay: bb, bx: c, by: d, e });
  return [
    w(0, b, 0, H - b), w(W, b, W, H - b),
    w(0, b, b, 0), w(W - b, 0, W, b), w(0, H - b, b, H), w(W - b, H, W, H - b),
    w(b, 0, g0, 0), w(g1, 0, W - b, 0), w(b, H, g0, H), w(g1, H, W - b, H),
    w(g0, 0, g0, -D, 0.4), w(g0, -D, g1, -D, 0.15), w(g1, -D, g1, 0, 0.4),
    w(g0, H, g0, H + D, 0.4), w(g0, H + D, g1, H + D, 0.15), w(g1, H + D, g1, H, 0.4),
  ];
})();

export function createMatch(opts = {}) {
  const rng = mulberry(opts.seed ?? 1);
  const rods = LAYOUT.map(([team, kind], i) => {
    const k = KINDS[kind];
    const slide = k.slide ?? T.W / 2 - ((k.n - 1) / 2) * k.sp - 2.4;
    return {
      i, team, kind, n: k.n, sp: k.sp, slide,
      y: T.H / 2 + (i - 3.5) * 14,
      s: team === 0 ? -1 : 1,
      x: 0, tx: 0, vx: 0, th: 0, w: 0, ph: 0, power: 0.5, vmax: T.slideSpeed,
    };
  });
  const s = {
    seed: opts.seed ?? 1,
    rng,
    time: 0,
    clock: 0,
    limitGoals: opts.limitGoals ?? 5,
    limitTime: opts.limitTime ?? 180,
    sudden: !!opts.sudden,
    overtime: false,
    rods,
    ball: { x: T.W / 2, y: T.H / 2, vx: 0, vy: 0, rot: 0 },
    score: [0, 0],
    phase: 'serve', // serve | play | goal | over
    serveT: opts.countdown ?? 3,
    goalT: 0,
    serveTo: opts.firstServe ?? (rng() < 0.5 ? 0 : 1),
    lastTouch: -1,
    lastRod: -1,
    pend: null,
    winner: -1,
    reason: '',
    stuckT: 0,
    stuckN: 0,
    stats: [0, 1].map(() => ({ shots: 0, onTarget: 0, saves: 0, goals: 0, touches: 0, poss: 0 })),
    events: [],
  };
  return s;
}

const ev = (s, e) => {
  s.events.push(e);
  if (s.events.length > 600) s.events.splice(0, 300);
};

// ---------------------------------------------------------------- controls (used by input and AI)
export function setRodTarget(s, i, x) {
  const r = s.rods[i];
  r.tx = clamp(x, -r.slide, r.slide);
}
export function chargeRod(s, i) {
  const r = s.rods[i];
  if (r.ph === 0 || r.ph === 3) r.ph = 1;
}
export function kickRod(s, i, power = 0.5) {
  const r = s.rods[i];
  if (r.ph === 2) return false;
  if (s.phase === 'over') return false;
  r.power = clamp(power, 0, 1);
  r.ph = 2;
  return true;
}
export const strikeOmega = (p) => 6 + 14 * p;

function updateRods(s, h) {
  for (const r of s.rods) {
    const err = r.tx - r.x;
    const vm = Math.min(r.vmax, T.slideSpeed);
    const want = clamp(err * 22, -vm, vm);
    const dv = clamp(want - r.vx, -T.slideAccel * h, T.slideAccel * h);
    r.vx += dv;
    r.x += r.vx * h;
    if (r.x > r.slide) { r.x = r.slide; r.vx = 0; }
    else if (r.x < -r.slide) { r.x = -r.slide; r.vx = 0; }
    const old = r.th;
    if (r.ph === 0) {
      r.th = old > 0 ? Math.max(0, old - 6 * h) : Math.min(0, old + 6 * h);
    } else if (r.ph === 1) {
      r.th = Math.max(T.thWind, old - 7 * h);
    } else if (r.ph === 2) {
      r.th = old + strikeOmega(r.power) * h;
      if (r.th >= T.thMax) { r.th = T.thMax; r.ph = 3; }
    } else {
      r.th = Math.max(0, old - 8 * h);
      if (r.th === 0) r.ph = 0;
    }
    r.w = (r.th - old) / h;
  }
}

function collideSegs(s, b) {
  for (const g of SEGS) {
    const dx = g.bx - g.ax, dy = g.by - g.ay;
    const l2 = dx * dx + dy * dy;
    let u = ((b.x - g.ax) * dx + (b.y - g.ay) * dy) / l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const px = g.ax + dx * u, py = g.ay + dy * u;
    let nx = b.x - px, ny = b.y - py;
    const d2 = nx * nx + ny * ny;
    if (d2 >= T.R * T.R) continue;
    let d = Math.sqrt(d2);
    if (d < 1e-6) {
      const l = Math.sqrt(l2);
      nx = -dy / l; ny = dx / l;
      if (nx * (T.W / 2 - px) + ny * (T.H / 2 - py) < 0) { nx = -nx; ny = -ny; }
      d = 0;
    } else { nx /= d; ny /= d; }
    b.x = px + nx * T.R;
    b.y = py + ny * T.R;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + g.e) * vn * nx;
      b.vy -= (1 + g.e) * vn * ny;
      const vt = b.vx * -ny + b.vy * nx;
      b.vx -= vt * 0.03 * -ny;
      b.vy -= vt * 0.03 * nx;
      if (-vn > 25) ev(s, { type: 'wall', speed: -vn });
    }
  }
}

function collideFeet(s, b) {
  const { footHX: hx, footHY: hy, footR: rr } = T;
  const ihx = hx - rr, ihy = hy - rr;
  const lim = T.R + rr;
  for (const r of s.rods) {
    if (!footActive(r)) continue;
    const fy = footY(r);
    if (Math.abs(b.y - fy) > hy + T.R + 1) continue;
    const fvy = r.s * T.L * Math.cos(r.th) * r.w;
    for (let k = 0; k < r.n; k++) {
      const fx = manX(r, k);
      if (Math.abs(b.x - fx) > hx + T.R + 1) continue;
      let dx = b.x - fx, dy = b.y - fy;
      const cx = clamp(dx, -ihx, ihx), cy = clamp(dy, -ihy, ihy);
      let nx = dx - cx, ny = dy - cy;
      let d2 = nx * nx + ny * ny;
      if (d2 >= lim * lim) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-6) {
        // centre inside the core box: push out along the cheapest axis
        const px = ihx - Math.abs(dx), py = ihy - Math.abs(dy);
        if (px < py) { nx = dx >= 0 ? 1 : -1; ny = 0; d = 0; }
        else { nx = 0; ny = dy >= 0 ? 1 : -1; d = 0; }
        b.x = fx + cx + nx * lim * 1.0001;
        b.y = fy + cy + ny * lim * 1.0001;
      } else {
        nx /= d; ny /= d;
        b.x = fx + cx + nx * lim * 1.0001;
        b.y = fy + cy + ny * lim * 1.0001;
      }
      const rvx = b.vx - r.vx, rvy = b.vy - fvy;
      const vn = rvx * nx + rvy * ny;
      if (vn >= 0) continue;
      const e = -vn < 25 ? 0 : T.footE;
      const j = -(1 + e) * vn;
      b.vx += nx * j;
      b.vy += ny * j;
      const tx = -ny, ty = nx;
      const vt = rvx * tx + rvy * ty;
      const jt = clamp(-vt, -T.footMu * j, T.footMu * j);
      b.vx += tx * jt;
      b.vy += ty * jt;
      touch(s, r, -vn);
    }
  }
}

function touch(s, r, impact) {
  const b = s.ball, st = s.stats[r.team];
  if (impact < 1.5 && s.lastTouch === r.team) return;
  const first = s.lastTouch !== r.team || s.lastRod !== r.i;
  s.lastTouch = r.team;
  s.lastRod = r.i;
  if (impact > 8) {
    ev(s, { type: 'touch', team: r.team, rod: r.i, speed: impact, x: b.x, y: b.y });
    if (first) st.touches++;
  }
  // saves: touching the ball shortly after the opponent's shot
  if (s.pend && s.pend.team !== r.team && s.time - s.pend.t < 2.5) {
    st.saves++;
    ev(s, { type: 'save', team: r.team });
    s.pend = null;
  }
  const sp = Math.hypot(b.vx, b.vy);
  if (impact > 25 && sp > 85 && b.vy * r.s > 0) {
    const goalY = r.s < 0 ? 0 : T.H;
    const dist = Math.abs(goalY - b.y);
    if (dist < 80) {
      const xg = b.x + b.vx * (dist / Math.abs(b.vy));
      if (xg > goalX0 - 8 && xg < goalX1 + 8) {
        st.shots++;
        s.pend = { team: r.team, t: s.time };
        ev(s, { type: 'shot', team: r.team });
      }
    }
  }
}

function moveBall(s, h, feet) {
  const b = s.ball;
  b.x += b.vx * h;
  b.y += b.vy * h;
  let sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    const ns = Math.max(0, sp - T.decel * h) * (1 - T.drag * h);
    const k = ns / sp;
    b.vx *= k; b.vy *= k;
    sp = ns;
  }
  if (feet) collideFeet(s, b);
  collideSegs(s, b);
  if (feet) collideFeet(s, b);
  sp = Math.hypot(b.vx, b.vy);
  if (sp > T.maxBall) {
    const k = T.maxBall / sp;
    b.vx *= k; b.vy *= k;
  }
  b.rot += (sp * h) / T.R;
  // hard invariant: the ball can never leave the table
  const lim = T.goalD - 0.5;
  if (!(b.x > 0 && b.x < T.W && b.y > -lim && b.y < T.H + lim) || !Number.isFinite(b.x + b.y + b.vx + b.vy)) {
    resetBall(s);
  }
}

function resetBall(s) {
  const b = s.ball;
  b.x = T.W / 2; b.y = T.H / 2; b.vx = 0; b.vy = 0;
  s.stuckT = 0; s.stuckN = 0;
}

function launch(s) {
  const b = s.ball;
  const sgn = s.serveTo === 0 ? 1 : -1;
  b.vx = (s.rng() - 0.5) * 14;
  b.vy = sgn * 22;
  s.phase = 'play';
  s.pend = null;
  ev(s, { type: 'serve', team: s.serveTo });
}

function finish(s, reason) {
  s.phase = 'over';
  s.reason = reason;
  const [a, c] = s.score;
  s.winner = a > c ? 0 : c > a ? 1 : -1;
  if (s.winner < 0 && reason === 'coin') {
    const sa = s.stats[0].shots + s.stats[0].saves, sb = s.stats[1].shots + s.stats[1].saves;
    s.winner = sa !== sb ? (sa > sb ? 0 : 1) : s.rng() < 0.5 ? 0 : 1;
  }
  ev(s, { type: 'over', winner: s.winner, reason });
}

function goalScored(s, team) {
  s.score[team]++;
  const st = s.stats[team];
  st.goals++;
  if (s.pend && s.pend.team === team) st.onTarget++;
  else st.shots++, st.onTarget++;
  s.pend = null;
  s.phase = 'goal';
  s.goalT = 2.4;
  s.serveTo = 1 - team;
  ev(s, { type: 'goal', team, score: s.score.slice() });
}

function sub(s, h) {
  s.time += h;
  updateRods(s, h);
  const b = s.ball;
  if (s.phase === 'serve') {
    const before = Math.ceil(s.serveT);
    s.serveT -= h;
    if (Math.ceil(s.serveT) !== before && s.serveT > 0) ev(s, { type: 'count', n: Math.ceil(s.serveT) });
    if (s.serveT <= 0) launch(s);
    return;
  }
  moveBall(s, h, s.phase !== 'goal');
  if (s.phase === 'play') {
    s.clock += h;
    if (s.lastTouch >= 0) s.stats[s.lastTouch].poss += h;
    if (b.y < -T.R * 0.9) goalScored(s, 0);
    else if (b.y > T.H + T.R * 0.9) goalScored(s, 1);
    else {
      if (s.pend && s.time - s.pend.t > 4) s.pend = null;
      // anti-stuck: slow ball for ~3 s -> nudge, then re-serve from the centre
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < 5) {
        s.stuckT += h;
        if (s.stuckT > 3) {
          s.stuckT = 0;
          s.stuckN++;
          if (s.stuckN >= 2) {
            resetBall(s);
            s.phase = 'serve';
            s.serveT = 1;
            s.serveTo = s.rng() < 0.5 ? 0 : 1;
            ev(s, { type: 'reset' });
          } else {
            const a = s.rng() * Math.PI * 2;
            b.vx = Math.cos(a) * 38; b.vy = Math.sin(a) * 38;
            ev(s, { type: 'nudge' });
          }
        }
      } else {
        s.stuckT = 0;
        if (sp > 25) s.stuckN = 0;
      }
      if (s.limitTime && s.clock >= s.limitTime) {
        if (!s.overtime) {
          if (s.score[0] !== s.score[1]) finish(s, 'time');
          else if (s.sudden) { s.overtime = true; ev(s, { type: 'overtime' }); }
          else finish(s, 'time');
        } else if (s.clock - s.limitTime > 60) finish(s, 'coin');
      }
    }
  } else if (s.phase === 'goal') {
    s.goalT -= h;
    if (s.goalT <= 0) {
      const done = (s.limitGoals && (s.score[0] >= s.limitGoals || s.score[1] >= s.limitGoals)) || s.overtime;
      if (done) finish(s, s.overtime && !(s.limitGoals && Math.max(...s.score) >= s.limitGoals) ? 'golden' : 'goals');
      else {
        resetBall(s);
        s.phase = 'serve';
        s.serveT = 1.2;
        s.lastTouch = -1;
      }
    }
  }
}

export function stepMatch(s, dt) {
  let rem = dt;
  while (rem > 1e-9) {
    const h = Math.min(T.SUB, rem);
    sub(s, h);
    rem -= h;
  }
}

export function possession(s) {
  const a = s.stats[0].poss, b = s.stats[1].poss;
  return a + b > 0 ? a / (a + b) : 0.5;
}

export function timeLeft(s) {
  return s.limitTime ? Math.max(0, s.limitTime - s.clock) : Infinity;
}
