// Goo Builder — deterministic soft-body simulation (XPBD strands + circle nodes), pure logic, no DOM.
// World units: y grows downwards. A goo ball is a circle node; a strand is a compliant distance constraint.

export const DT = 1 / 60;
export const SUB = 6;
export const ITER = 2;
export const G = 900;
export const STRAND_K = 15000; // force per unit strain
export const BREAK_STRAIN = 0.62;
export const MAX_SPEED = 1300;
export const TYPE_IDS = ['goo', 'balloon', 'heavy', 'tacky', 'stake'];

export const TYPES = {
  goo: { r: 15, m: 1, max: 3, reach: 135, lift: 0, damp: 0.9996, color: '#7bd65a', dark: '#3f9a2c' },
  balloon: { r: 15, m: 0.5, max: 2, reach: 135, lift: 2.5, damp: 0.995, color: '#58b8ff', dark: '#2b7fd0' },
  heavy: { r: 19, m: 3, max: 3, reach: 135, lift: 0, damp: 0.9996, color: '#a98cf0', dark: '#6a4cc0' },
  tacky: { r: 15, m: 1, max: 3, reach: 135, lift: 0, damp: 0.9996, color: '#ffc43d', dark: '#d98a0b', removable: true },
  stake: { r: 13, m: 1, max: 2, reach: 135, lift: 0, damp: 0.9996, color: '#ff7b6b', dark: '#d1443a', pin: true },
};
export const STAKE_REACH = 46;

// ------------------------------------------------------------------ geometry
const hyp = Math.hypot;

function polyBBox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// closest point on polygon boundary: out = [dist, cx, cy]
function closestOnPoly(x, y, pts, out) {
  let best = Infinity, bx = 0, by = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0], ay = pts[j][1], ex = pts[i][0] - ax, ey = pts[i][1] - ay;
    const l2 = ex * ex + ey * ey;
    let u = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const cx = ax + ex * u, cy = ay + ey * u;
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < best) {
      best = d;
      bx = cx;
      by = cy;
    }
  }
  out[0] = Math.sqrt(best);
  out[1] = bx;
  out[2] = by;
  return out;
}

function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / den;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

function segHitsPoly(ax, ay, bx, by, pts, bb) {
  if (Math.max(ax, bx) < bb[0] || Math.min(ax, bx) > bb[2] || Math.max(ay, by) < bb[1] || Math.min(ay, by) > bb[3]) return false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (segIntersect(ax, ay, bx, by, pts[j][0], pts[j][1], pts[i][0], pts[i][1])) return true;
  }
  return false;
}

// ------------------------------------------------------------------ simulation
const _o = [0, 0, 0];

export function createSim(level, opts = {}) {
  return new Sim(level, opts);
}

export class Sim {
  constructor(level, opts = {}) {
    this.level = level;
    this.sandbox = !!opts.sandbox;
    this.terrain = (level.terrain || []).map((pts) => ({ pts, bb: polyBBox(pts) }));
    this.hazards = (level.hazards || []).map((hz) => ({ ...hz, bb: polyBBox(hz.pts) }));
    this.movers = (level.movers || []).map((m) => ({ ...m, pts: m.pts.map((p) => [p[0] + m.cx, p[1] + m.cy]), bb: [0, 0, 0, 0] }));
    this.pendulums = level.pendulums || [];
    this.winds = level.winds || [];
    this.killY = level.killY ?? 1400;
    this.dynamic = this.movers.length + this.pendulums.length + this.winds.length > 0;
    this.events = [];
    this.nodes = [];
    this.strands = [];
    this.log = [];
    this.history = [];
    this.time = 0;
    this.nextId = 1;
    this.used = 0;
    this.lost = 0;
    this.left = {};
    for (const k of TYPE_IDS) this.left[k] = this.sandbox ? Infinity : level.stock?.[k] || 0;
    this.calm = 0;
    this.hold = 0;
    this.status = 'play';
    this.statusAt = 0;
    this.connTick = 0;
    this.height = 0;
    this.pipeTouch = 0;
    this.grid = new Map();
    for (const a of level.anchors || []) this._addNode('base', a[0], a[1], true);
    this._updateMovers(0);
    this._markConnected();
  }

  // ---- nodes
  _addNode(type, x, y, fixed) {
    const T = TYPES[type] || { r: 14, m: 1, damp: 1, lift: 0 };
    const n = {
      id: this.nextId++, type, x, y, px: x, py: y, vx: 0, vy: 0, r: type === 'base' ? 13 : T.r,
      inv: fixed ? 0 : 1 / T.m, fixed: !!fixed, alive: true, conn: !!fixed, cx: 0, cy: 0, hit: false, age: 0,
    };
    this.nodes.push(n);
    return n;
  }
  nodeById(id) {
    for (const n of this.nodes) if (n.id === id) return n;
    return null;
  }
  aliveNodes() {
    return this.nodes.filter((n) => n.alive);
  }
  get placeable() {
    let s = 0;
    for (const k of TYPE_IDS) s += this.left[k];
    return s;
  }

  // ---- movers / hazards
  _moverOffset(m, T) {
    const a = 2 * Math.PI * (T / m.period + (m.phase || 0));
    const s = Math.sin(a);
    return [(m.ax || 0) * s, (m.ay || 0) * s];
  }
  _updateMovers(T) {
    for (const m of this.movers) {
      const [ox, oy] = this._moverOffset(m, T);
      m.ox = ox;
      m.oy = oy;
      m.wpts = m.pts.map((p) => [p[0] + ox, p[1] + oy]);
      m.bb = polyBBox(m.wpts);
    }
  }
  pendulumPos(p, T) {
    const th = (p.amp || 0.8) * Math.sin(2 * Math.PI * (T / p.period + (p.phase || 0)));
    return [p.px + Math.sin(th) * p.len, p.py + Math.cos(th) * p.len];
  }

  // ---- placement logic (also used by the UI for the ghost preview)
  blockedAt(x, y, r) {
    const T = this.time * DT;
    for (const t of this.terrain) {
      if (x + r < t.bb[0] || x - r > t.bb[2] || y + r < t.bb[1] || y - r > t.bb[3]) continue;
      if (pointInPoly(x, y, t.pts)) return 'blocked';
      closestOnPoly(x, y, t.pts, _o);
      if (_o[0] < r - 3) return 'blocked';
    }
    for (const m of this.movers) {
      if (pointInPoly(x, y, m.wpts)) return 'blocked';
      closestOnPoly(x, y, m.wpts, _o);
      if (_o[0] < r + 2) return 'blocked';
    }
    for (const p of this.pendulums) {
      const [qx, qy] = this.pendulumPos(p, T);
      if (hyp(x - qx, y - qy) < r + p.r + 4) return 'blocked';
    }
    for (const hz of this.hazards) {
      if (this._hazardHit(hz, x, y, r * 0.6)) return 'hazard';
    }
    if (y > this.killY - 40) return 'hazard';
    return null;
  }
  _hazardHit(hz, x, y, r) {
    if (x + r < hz.bb[0] || x - r > hz.bb[2] || y + r < hz.bb[1] || y - r > hz.bb[3]) return false;
    if (pointInPoly(x, y, hz.pts)) return true;
    closestOnPoly(x, y, hz.pts, _o);
    return _o[0] < r;
  }
  _losClear(ax, ay, bx, by) {
    // shorten a little so strands that start on a surface are not rejected by that surface
    const dx = bx - ax, dy = by - ay, d = hyp(dx, dy) || 1;
    const k = 7 / d;
    const sx = ax + dx * k, sy = ay + dy * k, ex = bx - dx * k, ey = by - dy * k;
    for (const t of this.terrain) if (segHitsPoly(sx, sy, ex, ey, t.pts, t.bb)) return false;
    for (const m of this.movers) if (segHitsPoly(sx, sy, ex, ey, m.wpts, m.bb)) return false;
    return true;
  }
  stakeSnap(x, y) {
    let best = null, bd = STAKE_REACH;
    for (const t of this.terrain) {
      if (x < t.bb[0] - bd || x > t.bb[2] + bd || y < t.bb[1] - bd || y > t.bb[3] + bd) continue;
      closestOnPoly(x, y, t.pts, _o);
      let d = _o[0];
      const inside = pointInPoly(x, y, t.pts);
      if (inside) d = 0;
      if (d < bd) {
        bd = d;
        best = [_o[1], _o[2], inside];
      }
    }
    if (!best) return null;
    // sit on the surface: step out of the polygon along the direction from the surface point to the cursor (or its normal)
    let nx = x - best[0], ny = y - best[1];
    let l = hyp(nx, ny);
    if (best[2] || l < 0.5) {
      // choose the outward normal by probing
      let ox = 0, oy = -1, found = false;
      for (let a = 0; a < 16 && !found; a++) {
        const ang = (a / 16) * Math.PI * 2 - Math.PI / 2;
        const px = best[0] + Math.cos(ang) * 4, py = best[1] + Math.sin(ang) * 4;
        let inside = false;
        for (const t of this.terrain) if (pointInPoly(px, py, t.pts)) inside = true;
        if (!inside) {
          ox = Math.cos(ang);
          oy = Math.sin(ang);
          found = true;
        }
      }
      nx = ox;
      ny = oy;
      l = 1;
    }
    nx /= l;
    ny /= l;
    const r = TYPES.stake.r;
    return [best[0] + nx * (r - 4), best[1] + ny * (r - 4)];
  }

  /** Where would a goo of `type` dropped at (x,y) attach? Returns {valid, reason, x, y, links:[{id,x,y,d}]}. */
  preview(type, x, y) {
    const T = TYPES[type];
    if (!T) return { valid: false, reason: 'type', x, y, links: [] };
    const res = { valid: false, reason: null, x, y, links: [], type };
    if (this.status !== 'play') {
      res.reason = 'over';
      return res;
    }
    if (!this.sandbox && this.left[type] <= 0) {
      res.reason = 'stock';
      return res;
    }
    if (T.pin) {
      const sp = this.stakeSnap(x, y);
      if (!sp) {
        res.reason = 'noground';
        return res;
      }
      res.x = sp[0];
      res.y = sp[1];
    }
    const r = T.r;
    const block = this.blockedAt(res.x, res.y, T.pin ? 6 : r);
    if (block && !T.pin) {
      res.reason = block;
      return res;
    }
    if (T.pin) {
      const hz = this.hazards.some((h) => this._hazardHit(h, res.x, res.y, 6));
      if (hz) {
        res.reason = 'hazard';
        return res;
      }
    }
    const cands = [];
    for (const n of this.nodes) {
      if (!n.alive) continue;
      const d = hyp(n.x - res.x, n.y - res.y);
      if (d < r + n.r + 3) {
        res.reason = 'close';
        return res;
      }
      if (d <= T.reach && this._losClear(res.x, res.y, n.x, n.y)) cands.push({ n, d });
    }
    cands.sort((a, b) => a.d - b.d || a.n.id - b.n.id);
    const take = [];
    for (const c of cands) {
      if (take.length >= T.max) break;
      if (take.length === 2 && c.d > take[1].d * 1.28) break;
      take.push(c);
    }
    if (T.pin) {
      while (take.length > 1) take.pop();
    }
    res.links = take.map((c) => ({ id: c.n.id, x: c.n.x, y: c.n.y, d: c.d }));
    if (!T.pin && res.links.length === 0) {
      res.reason = 'far';
      return res;
    }
    res.valid = true;
    return res;
  }

  _snapshotForUndo() {
    this.history.push(this.snapshot());
    if (this.history.length > 60) this.history.shift();
  }

  place(type, x, y) {
    const pv = this.preview(type, x, y);
    if (!pv.valid) return { ok: false, reason: pv.reason };
    this._snapshotForUndo();
    const T = TYPES[type];
    const n = this._addNode(type, pv.x, pv.y, !!T.pin);
    for (const l of pv.links) this._addStrand(n, this.nodeById(l.id));
    if (!this.sandbox) this.left[type]--;
    this.used++;
    this.log.push({ t: this.time, a: 'p', type, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    this.calm = 0;
    this.hold = 0;
    this._markConnected();
    this.events.push({ k: 'place', x: n.x, y: n.y, type, id: n.id });
    return { ok: true, node: n, links: pv.links };
  }

  _addStrand(a, b) {
    const L = hyp(a.x - b.x, a.y - b.y);
    this.strands.push({ a, b, L, alpha: L / STRAND_K, lam: 0, over: 0, alive: true });
  }

  canRemove(id) {
    const n = this.nodeById(id);
    return !!(n && n.alive && TYPES[n.type]?.removable && this.status === 'play');
  }
  removeNode(id) {
    if (!this.canRemove(id)) return false;
    this._snapshotForUndo();
    const n = this.nodeById(id);
    this._kill(n, 'remove');
    if (!this.sandbox) this.left[n.type]++;
    this.used--;
    this.log.push({ t: this.time, a: 'r', id });
    this.calm = 0;
    this.hold = 0;
    this._cleanup();
    this._markConnected();
    return true;
  }

  undo() {
    if (!this.history.length) return false;
    const log = this.log.slice(0, -1);
    const evs = this.events;
    this.restore(this.history.pop());
    this.log = log;
    this.events = evs;
    this.events.push({ k: 'undo' });
    return true;
  }

  _kill(n, why) {
    if (!n.alive) return;
    n.alive = false;
    this.events.push({ k: 'die', x: n.x, y: n.y, why, type: n.type });
    if (why !== 'remove') this.lost++;
    for (const s of this.strands) if (s.a === n || s.b === n) s.alive = false;
  }
  _cleanup() {
    if (this.strands.some((s) => !s.alive)) this.strands = this.strands.filter((s) => s.alive);
    if (this.nodes.length > 400 && this.nodes.some((n) => !n.alive)) {
      // dead nodes stay until the list gets long; ids stay unique
      this.nodes = this.nodes.filter((n) => n.alive);
    }
  }

  // ---- connectivity (flood from fixed nodes along strands)
  _markConnected() {
    const adj = new Map();
    for (const s of this.strands) {
      if (!s.alive) continue;
      (adj.get(s.a) || adj.set(s.a, []).get(s.a)).push(s.b);
      (adj.get(s.b) || adj.set(s.b, []).get(s.b)).push(s.a);
    }
    for (const n of this.nodes) n.conn = false;
    const stack = [];
    for (const n of this.nodes) if (n.alive && n.fixed) {
      n.conn = true;
      stack.push(n);
    }
    while (stack.length) {
      const n = stack.pop();
      const nb = adj.get(n);
      if (!nb) continue;
      for (const m of nb) if (!m.conn && m.alive) {
        m.conn = true;
        stack.push(m);
      }
    }
  }

  // ---- stepping
  step(count = 1) {
    for (let i = 0; i < count; i++) this._step1();
  }

  _step1() {
    this.time++;
    if (this.status !== 'play' && this.status !== 'ending') {
      // keep animating loosely after the game is decided: structure sleeps
      if (!this.dynamic) return;
    }
    const sleeping = !this.dynamic && this.calm > 50;
    if (sleeping) {
      this.calm++;
      this._checkGoal();
      return;
    }
    const h = DT / SUB;
    const T0 = (this.time - 1) * DT;
    const live = [];
    for (const n of this.nodes) if (n.alive) live.push(n);
    for (let s = 0; s < SUB; s++) {
      const Tt = T0 + ((s + 1) / SUB) * DT;
      if (this.movers.length) this._updateMovers(Tt);
      this._substep(live, h, Tt);
    }
    // hazards & kill line
    for (const n of live) {
      if (!n.alive) continue;
      if (n.y > this.killY) {
        this._kill(n, 'lava');
        continue;
      }
      for (const hz of this.hazards) {
        if (this._hazardHit(hz, n.x, n.y, n.r * 0.55)) {
          this._kill(n, hz.kind || 'spikes');
          break;
        }
      }
    }
    // strand breaking bookkeeping happens in substeps; clean dead ones
    this._cleanup();
    let maxV = 0;
    for (const n of live) {
      if (!n.alive || n.fixed) continue;
      const v = n.vx * n.vx + n.vy * n.vy;
      if (v > maxV) maxV = v;
    }
    if (maxV < 9) this.calm++;
    else this.calm = 0;
    if (++this.connTick >= 4) {
      this.connTick = 0;
      this._markConnected();
    }
    this._checkGoal();
  }

  _windAt(n, Tt) {
    let ax = 0, ay = 0;
    for (const w of this.winds) {
      if (n.x < w.x || n.x > w.x + w.w || n.y < w.y || n.y > w.y + w.h) continue;
      let k = 1;
      if (w.period) k = 0.5 + 0.5 * Math.sin(2 * Math.PI * (Tt / w.period + (w.phase || 0)));
      const sc = n.type === 'heavy' ? 0.35 : n.type === 'balloon' ? 1.4 : 1;
      ax += (w.fx || 0) * k * sc;
      ay += (w.fy || 0) * k * sc;
    }
    return [ax, ay];
  }

  _substep(live, h, Tt) {
    for (const n of live) {
      if (!n.alive || n.fixed) continue;
      const ty = TYPES[n.type];
      let ay = G - (ty.lift ? G * ty.lift : 0);
      let ax = 0;
      if (this.winds.length) {
        const w = this._windAt(n, Tt);
        ax += w[0];
        ay += w[1];
      }
      n.vy += ay * h;
      n.vx += ax * h;
      const dmp = ty.damp;
      n.vx *= dmp;
      n.vy *= dmp;
      const sp = hyp(n.vx, n.vy);
      if (sp > MAX_SPEED) {
        n.vx *= MAX_SPEED / sp;
        n.vy *= MAX_SPEED / sp;
      }
      n.px = n.x;
      n.py = n.y;
      n.x += n.vx * h;
      n.y += n.vy * h;
      n.hit = false;
    }
    for (const s of this.strands) s.lam = 0;
    this._buildGrid(live);
    const strands = this.strands;
    for (let it = 0; it < ITER; it++) {
      this._solveStrands(strands, h);
      this._collideNodes(live);
      this._collideWorld(live, Tt);
    }
    // velocities, friction
    const ih = 1 / h;
    for (const n of live) {
      if (!n.alive || n.fixed) continue;
      n.vx = (n.x - n.px) * ih;
      n.vy = (n.y - n.py) * ih;
      if (n.hit) {
        const vn = n.vx * n.cx + n.vy * n.cy;
        let tx = n.vx - vn * n.cx, ty2 = n.vy - vn * n.cy;
        const fr = 0.06;
        tx *= 1 - fr;
        ty2 *= 1 - fr;
        const nn = vn < 0 ? vn * 0.05 : vn;
        n.vx = tx + nn * n.cx;
        n.vy = ty2 + nn * n.cy;
      }
    }
    // strand damping (structural) + break check
    for (const s of strands) {
      if (!s.alive) continue;
      const a = s.a, b = s.b;
      const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy) || 1e-6;
      const ux = dx / d, uy = dy / d;
      const w = a.inv + b.inv;
      if (w > 0) {
        const rel = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
        const imp = (rel * 0.06) / w;
        a.vx += ux * imp * a.inv;
        a.vy += uy * imp * a.inv;
        b.vx -= ux * imp * b.inv;
        b.vy -= uy * imp * b.inv;
      }
      const strain = (d - s.L) / s.L;
      if (strain > BREAK_STRAIN) {
        if (++s.over >= 3) {
          s.alive = false;
          this.events.push({ k: 'snap', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          this.calm = 0;
        }
      } else if (s.over > 0) s.over--;
      s.strain = strain;
    }
    if (this.events.length > 300) this.events.splice(0, this.events.length - 300);
  }

  _solveStrands(strands, h) {
    const ih2 = 1 / (h * h);
    for (const s of strands) {
      if (!s.alive) continue;
      const a = s.a, b = s.b;
      const w = a.inv + b.inv;
      if (w === 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = hyp(dx, dy);
      if (d < 1e-6) continue;
      const C = d - s.L;
      const at = s.alpha * ih2;
      const dl = (-C - at * s.lam) / (w + at);
      s.lam += dl;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * dl * a.inv;
      a.y -= ny * dl * a.inv;
      b.x += nx * dl * b.inv;
      b.y += ny * dl * b.inv;
    }
  }

  _buildGrid(live) {
    const g = this.grid;
    g.clear();
    const CS = 44;
    for (const n of live) {
      if (!n.alive) continue;
      const key = Math.floor(n.x / CS) * 8192 + Math.floor(n.y / CS);
      const arr = g.get(key);
      if (arr) arr.push(n);
      else g.set(key, [n]);
    }
  }

  _collideNodes(live) {
    const CS = 44;
    const g = this.grid;
    for (const a of live) {
      if (!a.alive) continue;
      const cx = Math.floor(a.x / CS), cy = Math.floor(a.y / CS);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const arr = g.get((cx + ox) * 8192 + (cy + oy));
          if (!arr) continue;
          for (const b of arr) {
            if (b.id <= a.id || !b.alive) continue;
            const w = a.inv + b.inv;
            if (w === 0) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const min = (a.r + b.r) * 0.98;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 < 1e-8) continue;
            const d = Math.sqrt(d2);
            const k = (min - d) / d / w;
            a.x -= dx * k * a.inv;
            a.y -= dy * k * a.inv;
            b.x += dx * k * b.inv;
            b.y += dy * k * b.inv;
            if (a.fixed) {
              b.hit = true;
              b.cx = dx / d;
              b.cy = dy / d;
            } else if (b.fixed) {
              a.hit = true;
              a.cx = -dx / d;
              a.cy = -dy / d;
            }
          }
        }
      }
    }
  }

  _pushPoly(n, pts, bb) {
    const r = n.r;
    if (n.x + r < bb[0] || n.x - r > bb[2] || n.y + r < bb[1] || n.y - r > bb[3]) return;
    closestOnPoly(n.x, n.y, pts, _o);
    const d = _o[0];
    const inside = pointInPoly(n.x, n.y, pts);
    if (!inside && d >= r) return;
    let nx, ny;
    if (inside) {
      nx = _o[1] - n.x;
      ny = _o[2] - n.y;
      const l = hyp(nx, ny) || 1;
      nx /= l;
      ny /= l;
      n.x = _o[1] + nx * r;
      n.y = _o[2] + ny * r;
      nx = (n.x - _o[1]) / r;
      ny = (n.y - _o[2]) / r;
    } else {
      nx = (n.x - _o[1]) / d;
      ny = (n.y - _o[2]) / d;
      n.x = _o[1] + nx * r;
      n.y = _o[2] + ny * r;
    }
    n.hit = true;
    n.cx = nx;
    n.cy = ny;
  }

  _collideWorld(live, Tt) {
    for (const n of live) {
      if (!n.alive || n.fixed) continue;
      for (const t of this.terrain) this._pushPoly(n, t.pts, t.bb);
      for (const m of this.movers) this._pushPoly(n, m.wpts, m.bb);
      for (const p of this.pendulums) {
        const [qx, qy] = this.pendulumPos(p, Tt);
        const dx = n.x - qx, dy = n.y - qy;
        const d = hyp(dx, dy), min = n.r + p.r;
        if (d < min && d > 1e-6) {
          n.x = qx + (dx / d) * min;
          n.y = qy + (dy / d) * min;
        }
      }
    }
  }

  // ---- goals
  _connectedMinY() {
    let y = Infinity;
    for (const n of this.nodes) if (n.alive && n.conn && !n.fixed) y = Math.min(y, n.y);
    return y;
  }
  _checkGoal() {
    const lv = this.level;
    const g = lv.goal;
    if (this.sandbox || !g) return;
    if (this.status === 'play') {
      let ok = false;
      if (g.type === 'pipe') {
        const p = lv.pipe;
        for (const n of this.nodes) {
          if (!n.alive || n.fixed || !n.conn) continue;
          if (hyp(n.x - p.x, n.y - p.y) < p.r + n.r * 0.5) {
            ok = true;
            break;
          }
        }
        this.pipeTouch = ok ? this.pipeTouch + 1 : 0;
        ok = this.pipeTouch >= 30;
      } else if (g.type === 'height') {
        const y = this._connectedMinY();
        this.height = y;
        this.pipeTouch = y <= g.y ? this.pipeTouch + 1 : 0;
        ok = this.pipeTouch >= 80;
      }
      if (ok) {
        this.status = 'won';
        this.statusAt = this.time;
        this.events.push({ k: 'win' });
        return;
      }
      if (this.placeable <= 0 && this.calm >= 90) {
        this.status = 'lost';
        this.statusAt = this.time;
        this.events.push({ k: 'lose' });
      }
    }
  }

  /** Progress 0..1 toward the goal, for the HUD. */
  progress() {
    const g = this.level.goal;
    if (!g) return 0;
    if (g.type === 'height') {
      const y = this._connectedMinY();
      const base = g.base ?? this.level.bounds?.[3] ?? 600;
      if (!isFinite(y)) return 0;
      return Math.max(0, Math.min(1, (base - y) / (base - g.y)));
    }
    return Math.min(1, this.pipeTouch / 30);
  }

  stars() {
    const s = this.level.stars || [99, 99];
    return this.used <= s[0] ? 3 : this.used <= s[1] ? 2 : 1;
  }

  // ---- snapshot / restore
  snapshot() {
    const idx = new Map();
    const nodes = this.nodes.map((n, i) => {
      idx.set(n, i);
      return { ...n };
    });
    const strands = this.strands.map((s) => ({ a: idx.get(s.a), b: idx.get(s.b), L: s.L, alpha: s.alpha, lam: 0, over: s.over, alive: s.alive }));
    return {
      nodes, strands, time: this.time, nextId: this.nextId, used: this.used, lost: this.lost, left: { ...this.left },
      calm: this.calm, hold: this.hold, status: this.status, statusAt: this.statusAt, pipeTouch: this.pipeTouch,
      connTick: this.connTick, log: this.log.map((e) => ({ ...e })),
    };
  }
  restore(s) {
    this.nodes = s.nodes.map((n) => ({ ...n }));
    this.strands = s.strands.map((q) => ({ a: this.nodes[q.a], b: this.nodes[q.b], L: q.L, alpha: q.alpha, lam: 0, over: q.over, alive: q.alive }));
    this.time = s.time;
    this.nextId = s.nextId;
    this.used = s.used;
    this.lost = s.lost;
    this.left = { ...s.left };
    this.calm = s.calm;
    this.hold = s.hold;
    this.status = s.status;
    this.statusAt = s.statusAt;
    this.pipeTouch = s.pipeTouch;
    this.connTick = s.connTick;
    this.log = s.log.map((e) => ({ ...e }));
    this._updateMovers(this.time * DT);
    this._markConnected();
  }

  /** Total mechanical energy-ish measure (used by tests: must not explode). */
  energy() {
    let e = 0;
    for (const n of this.nodes) {
      if (!n.alive || n.fixed) continue;
      const m = 1 / n.inv;
      e += 0.5 * m * (n.vx * n.vx + n.vy * n.vy) + m * G * -n.y * (TYPES[n.type]?.lift ? 0 : 1);
    }
    for (const s of this.strands) {
      if (!s.alive) continue;
      const d = hyp(s.a.x - s.b.x, s.a.y - s.b.y) - s.L;
      e += 0.5 * (STRAND_K / s.L) * d * d;
    }
    return e;
  }
}

/** Replays a log of placements headlessly. Returns the sim after `until` extra steps. */
export function replay(level, log, opts = {}) {
  const sim = new Sim(level, opts);
  for (const e of log) {
    while (sim.time < e.t) sim.step();
    if (e.a === 'r') sim.removeNode(e.id);
    else {
      const r = sim.place(e.type, e.x, e.y);
      if (!r.ok) throw new Error('replay: placement rejected ' + r.reason + ' at t=' + e.t);
    }
  }
  return sim;
}

/** Plays a reference solution: placements are done after the structure calms down. */
export function playSolution(level, sol, maxWait = 600) {
  const sim = new Sim(level);
  for (const p of sol) {
    let w = 0;
    while (sim.calm < (p.wait ?? 30) && w < maxWait && sim.status === 'play') {
      sim.step();
      w++;
    }
    if (sim.status !== 'play') break;
    const r = sim.place(p.type, p.x, p.y);
    if (!r.ok) return { sim, error: 'rejected ' + r.reason, at: p };
  }
  let w = 0;
  while (sim.status === 'play' && w < 900) {
    sim.step();
    w++;
  }
  return { sim };
}
