// Table tennis simulation: ball physics (gravity, drag, Magnus spin, bounces,
// net), rally rules, serve flow, AI opponents and the match state machine.
// Units are metres and seconds. Side 0 = player (z > 0), side 1 = opponent (z < 0).

export const G = 9.81;
export const R = 0.02;
export const TABLE_Y = 0.76;
export const HALF_W = 0.7625;
export const HALF_L = 1.37;
export const NET_TOP = TABLE_Y + 0.1525;
export const NET_HALF = 0.9125;
export const IDEAL_Z = 1.42; // best contact distance from the table end
const MAG = 0.0022; // Magnus strength
const DRAG = 0.05;
const MAX_SPIN = 170;
const SIDE_MAX = 140;
const SUB = 1 / 240;
const HIST_LEN = 1.2;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Opponent profiles. Tiers scale forever: errors shrink and power grows.
export const STYLES = ['chopper', 'smasher', 'spin'];

export function aiProfile(tier, style) {
  const t = Math.max(0, tier);
  return {
    style,
    tier: t,
    timeErr: Math.max(0.01, 0.1 * Math.exp(-0.2 * t)),
    aimErr: Math.max(0.025, 0.36 * Math.exp(-0.2 * t)),
    miss: Math.max(0.015, 0.1 * Math.exp(-0.2 * t)),
    power: 0.92 + Math.min(0.5, 0.03 * t),
    speed: 2.6 + Math.min(4, 0.2 * t),
    smashChance: Math.min(0.9, 0.2 + 0.05 * t),
  };
}

function ballAt(p, v) {
  return { p: [...p], v: [...v], w: [0, 0, 0], rest: false, restT: 0 };
}

// Predicts the first table contact of a shot (ignores the net) for aiming.
function simLanding(p0, v0, w0) {
  let p = [...p0];
  let v = [...v0];
  const h = 1 / 240;
  for (let i = 0; i < 600; i++) {
    const sp = Math.hypot(v[0], v[1], v[2]);
    const ax = MAG * (w0[1] * v[2] - w0[2] * v[1]) - DRAG * sp * v[0];
    const ay = -G + MAG * (w0[2] * v[0] - w0[0] * v[2]) - DRAG * sp * v[1];
    const az = MAG * (w0[0] * v[1] - w0[1] * v[0]) - DRAG * sp * v[2];
    v = [v[0] + ax * h, v[1] + ay * h, v[2] + az * h];
    p = [p[0] + v[0] * h, p[1] + v[1] * h, p[2] + v[2] * h];
    if (v[1] < 0 && p[1] - R <= TABLE_Y) return { x: p[0], z: p[2] };
    if (p[1] < 0) return null;
  }
  return null;
}

export class Match {
  // cfg: { mode: 'match'|'serve'|'rally'|'target', bestOf, tier, style, eq:{power,control,spin,move,rubber}, firstServer }
  constructor(cfg) {
    this.cfg = {
      mode: 'match',
      bestOf: 3,
      tier: 0,
      style: 'spin',
      firstServer: 0,
      eq: { power: 1, control: 1, spin: 1, move: 1, rubber: 1 },
      ...cfg,
    };
    this.ai = aiProfile(this.cfg.tier, this.cfg.style);
    this.time = 0;
    this.score = [0, 0];
    this.sets = [0, 0];
    this.setNo = 1;
    this.firstSrv = this.cfg.firstServer;
    this.events = [];
    this.hist = [];
    this.ball = ballAt([0, 0.98, IDEAL_Z], [0, 0, 0]);
    this.ball.hold = true;
    this.phase = 'serveWait'; // serveWait | toss | rally | point | over
    this.pauseT = 0;
    this.lastHit = -1;
    this.bounces = [0, 0];
    this.served = false;
    this.rally = 0;
    this.rallyBest = 0;
    this.px = 0; // player paddle lateral position (tracks the ball)
    this.aiX = 0;
    this.aiPlan = null;
    this.aiTried = false;
    this.aiTimer = 0;
    this.pendingSet = false;
    this.slowmo = 1;
    this.lastPoint = null;
    this.tossT = 0;
    this.pointsPlayed = 0;
    this.startServe();
  }

  get server() {
    const pts = this.score[0] + this.score[1];
    const f = this.firstSrv;
    return pts < 20 ? (f + Math.floor(pts / 2)) % 2 : (f + pts) % 2;
  }

  get needsToss() {
    return this.phase === 'serveWait' && this.server === 0;
  }

  // True when the next point could end the set for either side.
  get matchPoint() {
    const [a, b] = this.score;
    const winNext = (x, y) => x + 1 >= 11 && x + 1 - y >= 2;
    return winNext(a, b) || winNext(b, a);
  }

  setTarget() {
    return Math.ceil(this.cfg.bestOf / 2);
  }

  // Serve setup: the ball waits in the server's hand until the toss.
  startServe() {
    this.served = false;
    this.lastHit = -1;
    this.bounces = [0, 0];
    this.rally = 0;
    this.aiPlan = null;
    this.aiTried = false;
    this.phase = 'serveWait';
    this.ball = ballAt([0, 0.98, this.server === 0 ? 1.45 : -1.45], [0, 0, 0]);
    this.ball.hold = true;
    this.aiTimer = this.server === 1 ? 0.9 : 0;
    this.hist = [];
  }

  toss() {
    if (this.phase !== 'serveWait' || this.server !== 0) return false;
    this.doToss();
    return true;
  }

  doToss() {
    const b = this.ball;
    b.hold = false;
    b.v = [0, 3.5, 0];
    b.w = [0, 0, 0];
    b.p[1] = 0.98;
    this.phase = 'toss';
    this.tossT = this.time;
  }

  // Player swipe. `shot` = {aim -1..1, depth 0..1, power 0..1, top, back, side (0..1 / -1..1), smash}
  // `tc` = game time at which the swing contacted the ball.
  swipe(shot, tc) {
    if (this.phase !== 'toss' && this.phase !== 'rally') return null;
    if (this.ball.hold) return null;
    const s = this.sampleAt(tc);
    if (!s) return { ok: false, q: 0, reason: 'late' };
    if (s.last === 0) return { ok: false, q: 0, reason: 'early' };
    if (s.p[2] < 0.55 || s.v[2] < -1.5) return { ok: false, q: 0, reason: 'away' };
    const ideal = this.served ? 0.98 : 1.3;
    const qz = 1 - Math.abs(s.p[2] - IDEAL_Z) / 0.42;
    const qy = 1 - Math.abs(s.p[1] - ideal) / 0.5;
    const q = clamp((qz * 0.6 + qy * 0.4), 0, 1);
    if (q < 0.12) return { ok: false, q, reason: 'timing', early: s.p[2] < IDEAL_Z };
    this.restore(s);
    const shotInfo = this.applyShot(0, shot, q, this.cfg.eq.control, this.cfg.eq.spin);
    // fast-forward the physics from the contact moment to now, keeping history
    let rem = this.time - tc;
    let tt = tc;
    while (rem > SUB && this.phase !== 'point' && this.phase !== 'over') {
      tt += SUB;
      rem -= SUB;
      this.stepPhysics(SUB);
      this.pushHist(tt);
    }
    return { ok: true, q, ...shotInfo };
  }

  sampleAt(tc) {
    const h = this.hist;
    if (!h.length || tc < h[0].t - 0.03) return null;
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].t <= tc) return h[i];
    }
    return h[0];
  }

  restore(s) {
    const b = this.ball;
    b.p = [...s.p];
    b.v = [...s.v];
    b.w = [...s.w];
    b.rest = false;
    b.hold = false;
    this.lastHit = s.last;
    this.bounces = [...s.bounces];
    this.served = s.served;
    this.hist = this.hist.filter((e) => e.t <= s.t);
  }

  // Core stroke: turns the shot parameters into outgoing ball velocity and spin.
  applyShot(side, P, q, control, spinEq) {
    const b = this.ball;
    const s = side === 0 ? -1 : 1; // direction of travel
    const eqP = this.cfg.eq.power;
    const rub = this.cfg.eq.rubber;
    const smash = !!P.smash && b.p[1] > TABLE_Y + 0.2;
    const errA = side === 0 ? (0.05 + 0.2 * (1 - q)) / (0.8 + 0.4 * control) : this.ai.aimErr * (1.4 - q * 0.6);
    const aim = clamp((P.aim || 0) + gauss() * errA, -1, 1);
    const depth = clamp(P.depth ?? 0.5, 0, 1);
    const pw = (side === 0 ? eqP : this.ai.power) * clamp((P.power ?? 0.6) * (0.55 + 0.45 * q), 0.05, 1.15);
    const top = clamp((P.top || 0) * (0.55 + 0.45 * q) * (0.85 + 0.2 * spinEq) * (0.7 + 0.3 * rub), 0, 1);
    const back = clamp((P.back || 0) * (0.55 + 0.45 * q) * (0.85 + 0.2 * spinEq) * (0.7 + 0.3 * rub), 0, 1);
    const side_ = clamp((P.side || 0) * (0.5 + 0.5 * q) * (0.85 + 0.2 * spinEq) * (0.7 + 0.3 * rub), -1, 1);

    const zt = smash ? s * (0.95 + 0.3 * depth) : s * (0.35 + 0.9 * depth);
    const xt = clamp(aim * 0.62, -0.7, 0.7);
    let sh = smash ? 9 + 6 * pw : 4.2 + 7 * pw;
    const p0 = b.p;
    const w0 = [s * (top - back) * MAX_SPIN, 0, s * side_ * SIDE_MAX];
    const yEnd = TABLE_Y + R + 0.005;
    // velocity for a given horizontal speed: arc with clearance over the net
    const build = (speed) => {
      const D = Math.hypot(zt - p0[2], xt - p0[0]);
      const T = Math.max(0.16, D / speed);
      const vx = (xt - p0[0]) / T;
      const vz = (zt - p0[2]) / T;
      let vy = (yEnd - p0[1] + 0.5 * G * T * T) / T;
      const tn = -p0[2] / vz;
      if (tn > 0 && tn < T) {
        const need = NET_TOP + R + 0.045;
        const yAt = p0[1] + vy * tn - 0.5 * G * tn * tn;
        if (yAt < need) vy = Math.max(vy, (need - p0[1] + 0.5 * G * tn * tn) / tn);
      }
      return [vx, vy, vz];
    };
    // correct the speed so that the predicted first bounce lands where aimed (drag, Magnus)
    let v = build(sh);
    for (let it = 0; it < 3; it++) {
      const land = simLanding(p0, v, w0);
      if (!land) break;
      const want = zt - p0[2];
      const got = land.z - p0[2];
      if (Math.abs(got) < 0.04) break;
      sh *= clamp(want / got, 0.75, 1.35);
      v = build(sh);
    }
    b.v = v;
    b.w = w0;
    b.rest = false;
    b.hold = false;
    this.lastHit = side;
    this.bounces = [0, 0];
    this.served = true;
    this.phase = 'rally';
    if (side === 0) this.aiTried = false;
    this.rally++;
    if (side === 0) this.rallyBest = Math.max(this.rallyBest, this.rally);
    const kind = Math.abs(side_) > 0.35 ? 'side' : top - back > 0.2 ? 'top' : back - top > 0.2 ? 'back' : 'flat';
    const ev = { type: 'hit', side, q, smash, kind, power: pw, top, back, side: side, p: [...b.p] };
    this.events.push(ev);
    return { smash, kind, power: pw, top, back, side: side_, depth };
  }

  // Opponent swing decided by its own timing and style.
  aiSwing() {
    const b = this.ball;
    const t = this.ai.tier;
    const st = this.ai.style;
    const rnd = Math.random;
    const q = clamp(1 - Math.abs(b.p[2] + IDEAL_Z) / 0.45, 0.2, 1);
    let P;
    if (st === 'chopper') {
      P = {
        aim: -Math.sign(this.px || 0.01) * (0.45 + 0.4 * rnd()),
        depth: 0.2 + 0.3 * rnd(),
        power: 0.3 + 0.18 * rnd(),
        back: 0.6 + 0.4 * rnd(),
        top: 0,
        side: 0,
      };
    } else if (st === 'smasher') {
      const high = b.p[1] > TABLE_Y + 0.17 && rnd() < this.ai.smashChance;
      P = high
        ? { aim: rnd() * 2 - 1, depth: 0.9, power: 0.9, top: 0.7, smash: true }
        : { aim: rnd() * 2 - 1, depth: 0.5 + 0.5 * rnd(), power: 0.6 + 0.25 * rnd(), top: 0.4 + 0.4 * rnd() };
    } else {
      P = {
        aim: rnd() * 2 - 1,
        depth: rnd(),
        power: 0.5 + 0.3 * rnd(),
        top: 0.5 + 0.5 * rnd(),
        side: (rnd() * 2 - 1) * (0.5 + 0.1 * Math.min(t, 5)),
      };
    }
    if (this.phase === 'toss') {
      P = { aim: rnd() * 2 - 1, depth: 0.5, power: 0.55, top: 0.3 + 0.4 * rnd(), side: rnd() * 2 - 1 };
    }
    // Miss chance (whiff) falls with tier.
    if (rnd() < this.ai.miss * (1.5 - q)) return false;
    this.applyShot(1, P, q, 1, 1);
    this.aiTimer = 0;
    return true;
  }

  // ---------- main update ----------
  update(dt) {
    if (this.phase === 'point') {
      this.pauseT -= dt;
      this.time += dt;
      if (this.pauseT <= 0) this.nextPoint();
      return;
    }
    if (this.phase === 'over') return;
    const scaled = dt * this.slowmo;
    let rem = scaled;
    while (rem > 1e-7) {
      const h = Math.min(SUB, rem);
      this.tick(h);
      rem -= h;
      if (this.phase === 'point' || this.phase === 'over') break;
    }
  }

  tick(h) {
    this.time += h;
    // paddles
    const b = this.ball;
    const maxStep = 5.5 * h * (0.8 + 0.2 * this.cfg.eq.move);
    this.px += clamp(b.p[0] - this.px, -maxStep, maxStep);
    this.aiX += clamp(b.p[0] - this.aiX, -this.ai.speed * h, this.ai.speed * h);

    if (this.phase === 'serveWait') {
      if (this.server === 1 && this.aiTimer > 0) {
        this.aiTimer -= h;
        if (this.aiTimer <= 0) this.doToss();
      }
    } else if (this.phase === 'toss') {
      // opponent serve: swing at the peak
      if (this.server === 1 && b.v[1] <= 0.4 && !b.hold) {
        this.aiServe();
      }
      if (b.v[1] < 0 && b.p[1] < 0.88 && !this.served && this.phase === 'toss') {
        this.serveMiss();
      }
    }

    // opponent return: one swing attempt per incoming ball, at its planned contact point
    if (this.phase === 'rally' && this.cfg.mode !== 'serve' && this.lastHit !== 1 && !b.hold) {
      if (b.v[2] < -0.3 && b.p[2] < -0.7 && !this.aiTried) {
        if (this.aiPlan === null) this.aiPlan = -IDEAL_Z + gauss() * this.ai.timeErr;
        if (b.p[2] <= this.aiPlan) {
          this.aiTried = true;
          this.aiPlan = null;
          this.aiSwing();
        }
      }
    }
    if (b.rest) {
      b.restT += h;
      if (b.restT > 1.2 && this.phase === 'rally') {
        const side = b.p[2] > 0 ? 0 : 1;
        this.endPoint(1 - side, 'out');
        return;
      }
    }
    this.stepPhysics(h);
    if (this.phase === 'point' || this.phase === 'over') return;
    this.pushHist(this.time);
  }

  pushHist(t) {
    const b = this.ball;
    this.hist.push({
      t,
      p: [...b.p],
      v: [...b.v],
      w: [...b.w],
      last: this.lastHit,
      served: this.served,
      bounces: [...this.bounces],
    });
    const cut = t - HIST_LEN;
    while (this.hist.length && this.hist[0].t < cut) this.hist.shift();
  }

  aiServe() {
    const P = {
      aim: Math.random() * 2 - 1,
      depth: 0.4 + 0.5 * Math.random(),
      power: 0.45 + 0.25 * Math.random(),
      top: Math.random() < 0.5 ? 0.6 : 0,
      back: Math.random() < 0.5 ? 0.6 : 0,
      side: (Math.random() * 2 - 1) * 0.7,
    };
    this.applyShot(1, P, 1, 1, 1);
    this.events.push({ type: 'serve', side: 1 });
  }

  serveMiss() {
    if (this.cfg.mode === 'serve') {
      this.endPoint(this.server === 0 ? 1 : 0, 'serveMiss', true);
      return;
    }
    this.endPoint(this.server === 0 ? 1 : 0, 'serveMiss');
  }

  // Ball physics + rules; events feed the rules state machine.
  stepPhysics(h) {
    const b = this.ball;
    if (b.hold || this.phase === 'point' || this.phase === 'over') return;
    const p0 = [...b.p];
    const [vx, vy, vz] = b.v;
    const [wx, wy, wz] = b.w;
    const sp = Math.hypot(vx, vy, vz);
    const ax = MAG * (wy * vz - wz * vy) - DRAG * sp * vx;
    const ay = -G + MAG * (wz * vx - wx * vz) - DRAG * sp * vy;
    const az = MAG * (wx * vy - wy * vx) - DRAG * sp * vz;
    b.v[0] = vx + ax * h;
    b.v[1] = vy + ay * h;
    b.v[2] = vz + az * h;
    b.p[0] += b.v[0] * h;
    b.p[1] += b.v[1] * h;
    b.p[2] += b.v[2] * h;
    const dec = Math.exp(-0.25 * h);
    b.w[0] *= dec;
    b.w[1] *= dec;
    b.w[2] *= dec;
    if (b.v[1] > 0) b.rest = false;

    // net
    if ((p0[2] > 0) !== (b.p[2] > 0)) {
      const f = p0[2] / (p0[2] - b.p[2]);
      const yc = p0[1] + (b.p[1] - p0[1]) * f - R;
      const xc = p0[0] + (b.p[0] - p0[0]) * f;
      if (Math.abs(xc) < NET_HALF + 0.05 && yc <= NET_TOP) {
        if (yc > NET_TOP - 0.012 && this.served) {
          // net cord: the ball trickles over
          this.events.push({ type: 'cord' });
          b.v[2] *= 0.35;
          b.v[1] = Math.max(0.2, b.v[1] * 0.3);
          b.p[2] = Math.sign(p0[2]) * 0.004;
        } else {
          this.netTouch();
          return;
        }
      }
    }

    // table
    const insideX = Math.abs(b.p[0]) <= HALF_W + 0.004;
    const insideZ = Math.abs(b.p[2]) <= HALF_L;
    if (b.v[1] < 0 && b.p[1] - R <= TABLE_Y) {
      if (!this.served) {
        if (b.p[1] - R < TABLE_Y - 0.02 || !insideX || !insideZ) {
          // serve toss fell without a hit
          if (b.p[1] < 0.88) this.serveMiss();
          return;
        }
      }
      if (insideX && insideZ) {
        if (b.rest) {
          b.p[1] = TABLE_Y + R;
          b.v[1] = 0;
          b.v[0] *= 0.85;
          b.v[2] *= 0.85;
        } else {
          this.bounceOn(b.p[2] > 0 ? 0 : 1, b.p[0], b.p[2]);
          if (this.phase === 'point' || this.phase === 'over') return;
        }
      } else if (this.served) {
        this.outBall();
        return;
      }
    }
    if (b.p[1] - R < 0 && this.phase !== 'point') {
      if (this.served) this.outBall();
      return;
    }
    if (Math.abs(b.p[0]) > 4 || Math.abs(b.p[2]) > 6) {
      if (this.served) this.outBall();
    }
  }

  bounceOn(H, x, z) {
    const b = this.ball;
    const [wx, , wz] = b.w;
    const topness = clamp(-wx / MAX_SPIN, 0, 1);
    const backness = clamp(wx / MAX_SPIN, 0, 1);
    // contact-point slip gives friction; topspin dips, backspin grips and checks
    const sx = b.v[0] + wz * R;
    const sz = b.v[2] - wx * R;
    b.v[0] -= 0.12 * sx;
    b.v[2] -= 0.12 * sz;
    b.v[1] = -b.v[1] * (0.88 - 0.14 * topness + 0.08 * backness);
    b.p[1] = TABLE_Y + R;
    b.w[0] *= 0.7;
    b.w[2] *= 0.7;
    this.events.push({ type: 'bounce', side: H, x, z });
    if (this.served && H === this.lastHit) {
      this.endPoint(1 - H, 'ownBounce');
      return;
    }
    if (this.served) {
      this.bounces[H]++;
      if (this.bounces[H] >= 2) {
        this.endPoint(1 - H, 'doubleBounce');
        return;
      }
    }
    if (b.v[1] < 0.25) {
      b.v[1] = 0;
      b.rest = true;
      b.restT = 0;
    }
  }

  netTouch() {
    if (!this.served) {
      this.let();
      return;
    }
    if (this.lastHit >= 0) this.endPoint(1 - this.lastHit, 'net');
  }

  let() {
    this.events.push({ type: 'let' });
    this.startServe();
  }

  outBall() {
    if (this.lastHit >= 0) this.endPoint(1 - this.lastHit, 'out');
    else this.endPoint(this.server === 0 ? 1 : 0, 'out');
  }

  // ---------- scoring ----------
  endPoint(winner, reason, practiceFail = false) {
    if (this.phase === 'point' || this.phase === 'over') return;
    this.lastPoint = { winner, reason, rally: this.rally };
    this.phase = 'point';
    this.pauseT = 1.3;
    this.events.push({ type: 'point', winner, reason, rally: this.rally, practiceFail });
    if (this.cfg.mode !== 'match') {
      this.pointsPlayed++;
      return;
    }
    this.score[winner]++;
    this.pointsPlayed++;
    const [a, b] = this.score;
    if (Math.max(a, b) >= 11 && Math.abs(a - b) >= 2) {
      const w = a > b ? 0 : 1;
      this.sets[w]++;
      this.events.push({ type: 'set', winner: w, score: [a, b] });
      if (this.sets[w] >= this.setTarget()) {
        this.phase = 'over';
        this.events.push({ type: 'match', winner: w });
        this.pauseT = 0;
      } else {
        this.pauseT = 2.2;
        this.pendingSet = true;
      }
    }
  }

  nextPoint() {
    if (this.pendingSet) {
      this.pendingSet = false;
      this.setNo++;
      this.firstSrv = 1 - this.firstSrv;
      this.score = [0, 0];
    }
    this.startServe();
  }

}
