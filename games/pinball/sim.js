// Pinball Pro — 2D physics. Substepped fixed timestep (480 Hz), circle-vs-segment contacts with a
// swept "tunnel guard", kinematic flippers (rotating capsules that transfer angular velocity), bumpers,
// slingshots, drop/stand-up targets, rollovers, spinner, ramps and a plunger lane. No DOM.
import { W, H, BALL_START } from './tables.js';

export const SUB = 1 / 480;
export const R = 8; // ball radius
export const GRAV = 900;
export const VMAX = 1700;
export const PLUNGE_MIN = 380;
export const PLUNGE_MAX = 1560;
const RAMP_SPEED = 520;

const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sim {
  constructor(table) {
    this.tb = table;
    this.t = 0;
    this.acc = 0;
    this.balls = [];
    this.events = [];
    this.nextId = 1;
    this.live = true; // false after a tilt: bumpers/slings/kickback go dead
    this.flippersOn = true;
    this.flippers = table.flippers.map((f) => ({ ...f, ang: f.rest, w: 0, on: false }));
    this.drops = table.drops.map(() => ({ down: false, t: 0 }));
    this.pulse = { bumpers: table.bumpers.map(() => 0), slings: [0, 0], standups: table.standups.map(() => 0) };
    this.spinner = table.spinner ? { ang: 0, w: 0, last: 0 } : null;
    this.kickArmed = { L: true, R: true };
    this.segs = table.segs.map((s) => {
      const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
      return { ...s, ex, ey, l2: ex * ex + ey * ey, minx: Math.min(s.x1, s.x2) - R - 1, maxx: Math.max(s.x1, s.x2) + R + 1, miny: Math.min(s.y1, s.y2) - R - 1, maxy: Math.max(s.y1, s.y2) + R + 1 };
    });
    for (const r of table.ramps) {
      r.cum = [0];
      for (let i = 1; i < r.path.length; i++) r.cum.push(r.cum[i - 1] + Math.hypot(r.path[i][0] - r.path[i - 1][0], r.path[i][1] - r.path[i - 1][1]));
      r.len = r.cum[r.cum.length - 1];
    }
  }

  addBall(x, y, vx = 0, vy = 0) {
    const b = { id: this.nextId++, x, y, px: x, py: y, vx, vy, inside: {}, ramp: null, age: 0 };
    this.balls.push(b);
    return b;
  }
  serve() {
    return this.addBall(BALL_START.x, BALL_START.y);
  }
  inLane(b) {
    return b.x > 352 && b.y > 205;
  }
  setFlipper(btn, on) {
    for (const f of this.flippers) if (f.btn === btn) f.on = !!on;
  }
  resetDrops() {
    for (const d of this.drops) d.down = false;
  }
  nudge(dx, dy = -1) {
    for (const b of this.balls) {
      if (b.ramp || this.inLane(b)) continue;
      b.vx += dx * 70;
      b.vy += dy * 40;
    }
  }
  launch(power) {
    const p = clampN(power, 0, 1);
    for (const b of this.balls) {
      if (this.inLane(b) && !b.ramp && b.y > 600 && Math.hypot(b.vx, b.vy) < 150) {
        b.vy = -(PLUNGE_MIN + p * (PLUNGE_MAX - PLUNGE_MIN));
        b.vx = 0;
        this.events.push({ t: 'launch', power: p, id: b.id });
        return b;
      }
    }
    return null;
  }
  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  update(dt) {
    this.acc += Math.min(dt, 1 / 20);
    let n = 0;
    while (this.acc >= SUB && n < 24) {
      this.step(SUB);
      this.acc -= SUB;
      n++;
    }
    if (n === 24) this.acc = 0;
  }

  step(dt) {
    this.t += dt;
    const tilted = !this.live;
    // flippers
    for (const f of this.flippers) {
      const target = f.on && this.flippersOn && !tilted ? f.up : f.rest;
      const sp = (target < f.ang ? f.up_speed : f.down_speed) * dt;
      const old = f.ang;
      if (Math.abs(target - f.ang) <= sp) f.ang = target;
      else f.ang += Math.sign(target - f.ang) * sp;
      const wa = (f.ang - old) / dt;
      f.w = f.side === 'L' ? wa : -wa;
      f.dir = f.side === 'L' ? 1 : -1;
      f.tx = f.px + f.dir * f.len * Math.cos(f.ang);
      f.ty = f.py + f.len * Math.sin(f.ang);
    }
    // decay pulses
    const decay = dt * 5;
    const P = this.pulse;
    for (let i = 0; i < P.bumpers.length; i++) if (P.bumpers[i] > 0) P.bumpers[i] = Math.max(0, P.bumpers[i] - decay);
    for (let i = 0; i < 2; i++) if (P.slings[i] > 0) P.slings[i] = Math.max(0, P.slings[i] - decay);
    for (let i = 0; i < P.standups.length; i++) if (P.standups[i] > 0) P.standups[i] = Math.max(0, P.standups[i] - decay * 0.6);
    if (this.spinner) {
      const s = this.spinner;
      s.ang += s.w * dt;
      s.w *= 1 - 1.4 * dt;
      if (Math.abs(s.w) < 1.2) s.w = 0;
      const k = Math.floor(s.ang / Math.PI);
      if (k !== s.last) {
        const ticks = Math.abs(k - s.last);
        s.last = k;
        for (let i = 0; i < ticks; i++) this.events.push({ t: 'spin' });
      }
    }

    for (let bi = this.balls.length - 1; bi >= 0; bi--) {
      const b = this.balls[bi];
      b.age += dt;
      if (b.ramp) {
        this.rideRamp(b, dt);
        continue;
      }
      this.moveBall(b, dt);
      if (b.y > this.tb.drainY || b.x < -30 || b.x > W + 30 || b.y < -60 || !(b.x === b.x) || !(b.y === b.y)) {
        const lost = b.y <= this.tb.drainY;
        this.balls.splice(bi, 1);
        this.events.push({ t: 'drain', id: b.id, lost, x: b.x });
      }
    }
    if (this.balls.length > 1) this.ballBall();
  }

  rideRamp(b, dt) {
    const r = this.tb.ramps[b.ramp.i];
    b.ramp.s += RAMP_SPEED * dt;
    if (b.ramp.s >= r.len) {
      const e = r.exit;
      b.x = e.x;
      b.y = e.y;
      b.px = b.x;
      b.py = b.y;
      b.vx = e.vx;
      b.vy = e.vy;
      const i = b.ramp.i;
      b.ramp = null;
      b.inside = {};
      b.inside['r' + i] = true;
      this.events.push({ t: 'ramp', i, id: b.id });
      return;
    }
    const s = b.ramp.s;
    let k = 1;
    while (k < r.cum.length - 1 && r.cum[k] < s) k++;
    const f = (s - r.cum[k - 1]) / (r.cum[k] - r.cum[k - 1]);
    b.x = r.path[k - 1][0] + (r.path[k][0] - r.path[k - 1][0]) * f;
    b.y = r.path[k - 1][1] + (r.path[k][1] - r.path[k - 1][1]) * f;
    b.px = b.x;
    b.py = b.y;
  }

  moveBall(b, dt) {
    const tb = this.tb;
    b.vy += GRAV * dt;
    const damp = 1 - 0.05 * dt;
    b.vx *= damp;
    b.vy *= damp;
    let sp = Math.hypot(b.vx, b.vy);
    if (sp > VMAX) {
      b.vx *= VMAX / sp;
      b.vy *= VMAX / sp;
    }
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // segments
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (b.x < s.minx || b.x > s.maxx || b.y < s.miny || b.y > s.maxy) {
        // tunnel guard: the path may still cross a thin wall
        if (!this.pathCrosses(b, s)) continue;
      }
      if (s.kind === 'drop' && this.drops[s.id].down) continue;
      this.collideSeg(b, s);
    }
    // bumpers and posts
    const live = this.live;
    for (const bp of tb.bumpers) {
      const dx = b.x - bp.x, dy = b.y - bp.y;
      const rr = R + bp.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        b.x = bp.x + nx * rr;
        b.y = bp.y + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          let out = -vn * bp.e;
          if (live) out = Math.max(out, bp.kick);
          b.vx += (out - vn) * nx;
          b.vy += (out - vn) * ny;
          if (live) {
            this.pulse.bumpers[bp.id] = 1;
            this.events.push({ t: 'bumper', i: bp.id, x: bp.x, y: bp.y, sp: -vn });
          }
        }
      }
    }
    for (const bp of tb.posts) {
      const dx = b.x - bp.x, dy = b.y - bp.y;
      const rr = R + bp.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        b.x = bp.x + nx * rr;
        b.y = bp.y + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= 1.55 * vn * nx;
          b.vy -= 1.55 * vn * ny;
          if (-vn > 200) this.events.push({ t: 'wall', sp: -vn });
        }
      }
    }
    // flippers
    for (const f of this.flippers) this.collideFlipper(b, f);
    this.sensors(b);
  }

  pathCrosses(b, s) {
    if (s.oneway) return false;
    // segment-segment intersection of the ball's path with the wall
    const rx = b.x - b.px, ry = b.y - b.py;
    const den = rx * s.ey - ry * s.ex;
    if (Math.abs(den) < 1e-9) return false;
    const qx = s.x1 - b.px, qy = s.y1 - b.py;
    const t = (qx * s.ey - qy * s.ex) / den;
    const u = (qx * ry - qy * rx) / den;
    return t > 0 && t < 1 && u > 0 && u < 1;
  }

  collideSeg(b, s) {
    const rx = b.x - s.x1, ry = b.y - s.y1;
    let u = (rx * s.ex + ry * s.ey) / s.l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const cx = s.x1 + s.ex * u, cy = s.y1 + s.ey * u;
    let dx = b.x - cx, dy = b.y - cy;
    let d2 = dx * dx + dy * dy;
    const l = Math.sqrt(s.l2);
    let nx, ny;
    if (s.oneway) {
      const side = (b.px - s.x1) * s.oneway[0] + (b.py - s.y1) * s.oneway[1];
      if (side < -0.5) return;
      if (d2 >= R * R) return;
      const d = Math.sqrt(d2);
      if (d < 1e-6) {
        nx = s.oneway[0];
        ny = s.oneway[1];
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      if (nx * s.oneway[0] + ny * s.oneway[1] < 0) {
        nx = s.oneway[0];
        ny = s.oneway[1];
      }
      b.x = cx + nx * R;
      b.y = cy + ny * R;
    } else {
      // which side was the ball on before the move? (guards against tunnelling)
      const nx0 = -s.ey / l, ny0 = s.ex / l;
      const sideP = (b.px - s.x1) * nx0 + (b.py - s.y1) * ny0;
      const sideN = (b.x - s.x1) * nx0 + (b.y - s.y1) * ny0;
      const crossed = this.pathCrosses(b, s) || (sideP * sideN < 0 && u > 0 && u < 1);
      if (crossed) {
        const sg = sideP >= 0 ? 1 : -1;
        nx = nx0 * sg;
        ny = ny0 * sg;
        b.x = cx + nx * R;
        b.y = cy + ny * R;
        // put the ball on the correct side of the wall
        const along = (b.x - s.x1) * s.ex + (b.y - s.y1) * s.ey;
        void along;
      } else {
        if (d2 >= R * R) return;
        const d = Math.sqrt(d2);
        if (d < 1e-6) {
          const sg = sideP >= 0 ? 1 : -1;
          nx = nx0 * sg;
          ny = ny0 * sg;
        } else {
          nx = dx / d;
          ny = dy / d;
        }
        b.x = cx + nx * R;
        b.y = cy + ny * R;
      }
    }
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    const imp = -vn;
    let e = s.e;
    if (imp < 70) e = 0;
    let out = -vn * e;
    if (s.kind === 'sling' && this.live && imp > 100) {
      // kick away from the triangle
      const sx = (s.x1 + s.x2) / 2 - s.cen[0], sy = (s.y1 + s.y2) / 2 - s.cen[1];
      if (nx * sx + ny * sy > 0) {
        out = Math.max(out, s.kick);
        this.pulse.slings[s.id] = 1;
        this.events.push({ t: 'sling', side: s.id === 0 ? 'L' : 'R', sp: imp });
      }
    }
    b.vx += (out + imp) * nx;
    b.vy += (out + imp) * ny;
    // coulomb friction limited by the normal impulse
    const tx = -ny, ty = nx;
    const vt = b.vx * tx + b.vy * ty;
    const ft = Math.min(Math.abs(vt), 0.12 * (out + imp));
    b.vx -= Math.sign(vt) * ft * tx;
    b.vy -= Math.sign(vt) * ft * ty;
    if (s.kind === 'standup' && imp > 35) {
      this.pulse.standups[s.id] = 1;
      this.events.push({ t: 'standup', i: s.id, sp: imp });
    } else if (s.kind === 'drop' && imp > 35) {
      const d = this.drops[s.id];
      d.down = true;
      d.t = 1;
      this.events.push({ t: 'drop', i: s.id, sp: imp });
    } else if (imp > 160) {
      this.events.push({ t: 'wall', sp: imp });
    }
  }

  collideFlipper(b, f) {
    if (f.tx === undefined) return;
    const ex = f.tx - f.px, ey = f.ty - f.py;
    const l2 = ex * ex + ey * ey;
    const rx = b.x - f.px, ry = b.y - f.py;
    let u = (rx * ex + ry * ey) / l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const cx = f.px + ex * u, cy = f.py + ey * u;
    const rad = f.r0 + (f.r1 - f.r0) * u;
    let dx = b.x - cx, dy = b.y - cy;
    const rr = R + rad;
    let d2 = dx * dx + dy * dy;
    // swept guard: if the ball moved across the flipper axis this substep
    let tunnelled = false;
    if (d2 >= rr * rr) {
      const bx = b.px - f.px, by = b.py - f.py;
      const s0 = bx * ey - by * ex, s1 = rx * ey - ry * ex;
      if (s0 * s1 < 0) {
        const ux = (rx * ex + ry * ey) / l2;
        if (ux > 0 && ux < 1 && Math.abs(s1) / Math.sqrt(l2) < R + rad + 4) tunnelled = true;
      }
      if (!tunnelled) return;
    }
    let d = Math.sqrt(d2);
    let nx, ny;
    if (d < 1e-6 || tunnelled) {
      const l = Math.sqrt(l2);
      nx = -ey / l;
      ny = ex / l;
      // choose the side the ball came from
      const bx = b.px - f.px, by = b.py - f.py;
      if (bx * nx + by * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    b.x = cx + nx * rr;
    b.y = cy + ny * rr;
    // surface velocity at the contact point
    const qx = cx - f.px, qy = cy - f.py;
    const svx = -f.w * qy, svy = f.w * qx;
    const rvx = b.vx - svx, rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    const imp = -vn;
    let e = imp > 150 ? 0.34 : 0;
    const out = imp * e;
    b.vx += (imp + out) * nx;
    b.vy += (imp + out) * ny;
    // light friction against the rubber so the ball can be cradled
    const tx = -ny, ty = nx;
    const vt = rvx * tx + rvy * ty;
    const ft = Math.min(Math.abs(vt), 0.25 * (imp + out));
    b.vx -= Math.sign(vt) * ft * tx;
    b.vy -= Math.sign(vt) * ft * ty;
    if (Math.abs(f.w) > 1 && imp > 100) this.events.push({ t: 'flip', sp: imp, btn: f.btn });
    const sp2 = Math.hypot(b.vx, b.vy);
    if (sp2 > VMAX) {
      b.vx *= VMAX / sp2;
      b.vy *= VMAX / sp2;
    }
  }

  sensors(b) {
    const tb = this.tb;
    const ins = b.inside;
    const chk = (key, x, y, r) => {
      const dx = b.x - x, dy = b.y - y;
      const on = dx * dx + dy * dy < r * r;
      const was = !!ins[key];
      ins[key] = on;
      return on && !was;
    };
    for (let i = 0; i < tb.lanes.length; i++) {
      const l = tb.lanes[i];
      if (chk('l' + i, l.x, l.y, l.r)) this.events.push({ t: 'lane', i });
    }
    for (const il of tb.inlanes) if (chk('i' + il.side, il.x, il.y, il.r)) this.events.push({ t: 'inlane', side: il.side });
    for (const ol of tb.outlanes) {
      if (chk('o' + ol.side, ol.x, ol.y, ol.r)) {
        if (ol.kickback && this.kickArmed[ol.side] && this.live) {
          this.kickArmed[ol.side] = false;
          b.vx = ol.side === 'L' ? 20 : -20;
          b.vy = -1250;
          this.events.push({ t: 'kickback', side: ol.side });
        } else this.events.push({ t: 'outlane', side: ol.side });
      }
    }
    // ramps: only a ball travelling upwards at some speed gets captured
    for (let i = 0; i < tb.ramps.length; i++) {
      const e = tb.ramps[i].entry;
      if (chk('r' + i, e.x, e.y, e.r) && b.vy < -230) {
        b.ramp = { i, s: 0 };
        this.events.push({ t: 'rampEnter', i, id: b.id });
        return;
      }
    }
    // spinner: a ball crossing the plate spins it
    if (this.spinner) {
      const sp = tb.spinner;
      const on = Math.abs(b.y - sp.y) < R + 2 && Math.abs(b.x - sp.x) < sp.w / 2;
      const was = !!ins.sp;
      ins.sp = on;
      if (on && !was) {
        const v = Math.min(32, Math.hypot(b.vx, b.vy) * 0.05);
        this.spinner.w = (b.vy < 0 ? -1 : 1) * Math.max(8, v);
        this.events.push({ t: 'spinHit', v: Math.abs(this.spinner.w) });
      }
    }
  }

  ballBall() {
    const bs = this.balls;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], c = bs[j];
        if (a.ramp || c.ramp) continue;
        const dx = c.x - a.x, dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R) continue;
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        const push = (2 * R - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        c.x += nx * push;
        c.y += ny * push;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) {
          const j2 = -(1 + 0.8) * vn / 2;
          a.vx -= j2 * nx;
          a.vy -= j2 * ny;
          c.vx += j2 * nx;
          c.vy += j2 * ny;
        }
      }
    }
  }
}

// Convenience used by tests: nearest distance between a ball and a flipper axis
export function flipperGap(b, f) {
  const ex = f.tx - f.px, ey = f.ty - f.py;
  const l2 = ex * ex + ey * ey;
  let u = ((b.x - f.px) * ex + (b.y - f.py) * ey) / l2;
  u = clampN(u, 0, 1);
  const cx = f.px + ex * u, cy = f.py + ey * u;
  return Math.hypot(b.x - cx, b.y - cy) - (f.r0 + (f.r1 - f.r0) * u);
}
export { H };
