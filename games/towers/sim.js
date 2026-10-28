// Match simulation (pure logic, no DOM). Fixed 60 Hz timestep.
// Side 0 is the human, side 1 the CPU (in tests both may be CPU).
// Every visual reaction is reported through match.events, drained by the renderer.

import {
  CELL, COLS, ROWS, WORLD_W, WORLD_H, TIERS, FAST, CAMO, REGEN, TOWERS, SENDS,
  START_LIVES, START_COINS, SEND_STAGGER, hpScale, roundInterval, roundIncome,
  towerStats, towerInvested,
} from './data.js';
import { roundPlan } from './wave.js';

export const TICK = 1 / 60;

// ------------------------------------------------------------------ geometry

const geoCache = new WeakMap();

// Precomputes path points, segment lengths and the path cell mask of a track.
export function geometry(track) {
  if (geoCache.has(track)) return geoCache.get(track);
  const wp = track.wp;
  const px = [], py = [];
  const cells = new Set();
  const cellOf = (c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1);
  for (let i = 0; i < wp.length; i++) {
    px.push((wp[i][0] + 0.5) * CELL);
    py.push((wp[i][1] + 0.5) * CELL);
    if (i === 0) continue;
    const [c0, r0] = wp[i - 1];
    const [c1, r1] = wp[i];
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    for (let k = 0; k <= steps; k++) {
      const idx = cellOf(c0 + dc * k, r0 + dr * k);
      if (idx >= 0) cells.add(idx);
    }
  }
  const cum = [0], len = [], dirx = [], diry = [];
  for (let i = 1; i < px.length; i++) {
    const dx = px[i] - px[i - 1], dy = py[i] - py[i - 1];
    const l = Math.hypot(dx, dy) || 1;
    len.push(l);
    dirx.push(dx / l);
    diry.push(dy / l);
    cum.push(cum[i - 1] + l);
  }
  // Coverage samples along the path (used by the CPU to place towers).
  const samples = [];
  const total = cum[cum.length - 1];
  for (let s = 0; s <= total; s += 16) {
    const p = posAtRaw({ px, py, cum, len }, s);
    if (p.x >= -1 && p.x <= WORLD_W + 1 && p.y >= -1 && p.y <= WORLD_H + 1) samples.push(p);
  }
  const g = { px, py, cum, len, dirx, diry, total, cells, samples, nseg: px.length - 1, end: { x: px[px.length - 1], y: py[py.length - 1] } };
  geoCache.set(track, g);
  return g;
}

function posAtRaw(g, s) {
  let lo = 0, hi = g.len.length - 1;
  if (s <= 0) return { x: g.px[0], y: g.py[0] };
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (g.cum[mid + 1] < s) lo = mid + 1;
    else hi = mid;
  }
  const t = Math.min(1, Math.max(0, (s - g.cum[lo]) / g.len[lo]));
  return { x: g.px[lo] + (g.px[lo + 1] - g.px[lo]) * t, y: g.py[lo] + (g.py[lo + 1] - g.py[lo]) * t };
}

export function posAt(g, s) {
  return posAtRaw(g, Math.min(s, g.total));
}

// Deterministic PRNG (mulberry32).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ------------------------------------------------------------------ match

export class Match {
  // cfg: { track, seed, sending, unlocked: [towerIds], sides: [{skin, ai}, {skin, ai}], lives, coins }
  constructor(cfg) {
    this.track = cfg.track;
    this.geo = geometry(cfg.track);
    this.seed = cfg.seed || 1;
    this.rnd = mulberry32(this.seed);
    this.sending = cfg.sending !== false;
    this.unlocked = new Set(cfg.unlocked || Object.keys(TOWERS));
    this.time = 0;
    this.acc = 0;
    this.speed = 1;
    this.over = null;
    this.uid = 0;
    this.towerId = 0;
    this.events = [];
    this.sides = cfg.sides.map((sc, i) => this.makeSide(i, sc, cfg));
  }

  makeSide(index, sc, cfg) {
    const grid = new Uint8Array(COLS * ROWS);
    const map = this.track.map;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = map[r][c];
        grid[r * COLS + c] = ch === '.' ? 0 : 1;
      }
    }
    for (const idx of this.geo.cells) grid[idx] = 1;
    return {
      index,
      skin: sc.skin || 'classic',
      ai: sc.ai || null,
      aiTimer: 0.5,
      grid,
      towers: [],
      enemies: [],
      enemyFree: [],
      projs: [],
      projFree: [],
      zones: [],
      pending: [],
      lives: cfg.lives || START_LIVES,
      coins: cfg.coins || START_COINS,
      round: 0,
      timer: 6,
      sendIncome: 0,
      pops: 0,
      leaks: 0,
      sent: 0,
      built: 0,
      dmgDone: 0,
      lastSend: -99,
    };
  }

  // -------------------------------------------------------------- driving

  // Advances by a frame duration (seconds), in fixed ticks, scaled by speed.
  update(frameDt) {
    if (this.over) return;
    this.acc += Math.min(frameDt, 0.1) * this.speed;
    let guard = 0;
    while (this.acc >= TICK && guard++ < 12) {
      this.step(TICK);
      this.acc -= TICK;
      if (this.over) break;
    }
  }

  step(dt) {
    if (this.over) return;
    this.time += dt;
    for (const side of this.sides) {
      side.timer -= dt;
      if (side.timer <= 0) this.startRound(side);
      if (side.ai) {
        side.aiTimer -= dt;
        if (side.aiTimer <= 0) {
          side.aiTimer = side.ai.interval;
          side.ai.think(this, side);
        }
      }
      this.spawnPending(side);
      this.computeBuffs(side);
    }
    for (const side of this.sides) {
      this.updateEnemies(side, dt);
      this.updateTowers(side, dt);
      this.updateProjs(side, dt);
      this.updateZones(side, dt);
      this.compact(side);
    }
    this.checkEnd();
  }

  checkEnd() {
    const [a, b] = this.sides;
    if (a.lives > 0 && b.lives > 0) return;
    let winner;
    if (a.lives <= 0 && b.lives <= 0) winner = a.round === b.round ? -1 : (a.round > b.round ? 0 : 1);
    else winner = a.lives > 0 ? 0 : 1;
    this.over = { winner, time: this.time };
    this.events.push({ type: 'over', winner });
  }

  drainEvents() {
    const e = this.events;
    if (e.length) this.events = [];
    return e;
  }

  // -------------------------------------------------------------- rounds

  startRound(side) {
    side.round++;
    side.coins += roundIncome(side.round) + side.sendIncome;
    const plan = roundPlan(side.round, this.rnd);
    const hp = hpScale(side.round);
    for (const en of plan.entries) {
      side.pending.push({ t: this.time + en.t, tier: en.tier, flags: en.flags, hp });
    }
    side.timer = roundInterval(side.round);
    this.events.push({ type: 'round', side: side.index, round: side.round });
  }

  // Early call of the next round: small bonus, round starts on the next tick.
  callRound(sideIdx) {
    const side = this.sides[sideIdx];
    if (this.over || side.timer <= 0) return { ok: false };
    side.coins += 4 + side.round * 2;
    side.timer = 0;
    return { ok: true };
  }

  spawnPending(side) {
    const p = side.pending;
    if (!p.length) return;
    let w = 0;
    for (let i = 0; i < p.length; i++) {
      const item = p[i];
      if (item.t <= this.time) this.spawnEnemy(side, item);
      else p[w++] = item;
    }
    p.length = w;
  }

  spawnEnemy(side, item) {
    const def = TIERS[item.tier];
    const e = side.enemyFree.pop() || {};
    e.uid = ++this.uid;
    e.dead = false;
    e.tier = item.tier;
    e.def = def;
    e.flags = item.flags;
    e.maxHp = Math.max(1, Math.round(def.hp * item.hp));
    e.hp = e.maxHp;
    e.armor = def.armor;
    e.base = def.speed * (item.flags & FAST ? 1.7 : 1);
    e.s = 0;
    e.seg = 0;
    e.x = this.geo.px[0];
    e.y = this.geo.py[0];
    e.slowMul = 1;
    e.slowT = 0;
    e.stunT = 0;
    e.shred = 0;
    e.shredT = 0;
    e.acid = 0;
    e.burnDps = 0;
    e.burnT = 0;
    e.sinceHit = 99;
    e.regenAcc = 0;
    e.revealT = 0;
    e.flashT = 0;
    e.bounty = def.bounty;
    e.leak = def.leak;
    e.wob = (e.uid * 0.7) % 6.283;
    side.enemies.push(e);
  }

  // -------------------------------------------------------------- enemies

  updateEnemies(side, dt) {
    const g = this.geo;
    const zones = side.zones;
    for (const e of side.enemies) {
      if (e.dead) continue;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) { e.slowT = 0; e.slowMul = 1; }
      }
      if (e.stunT > 0) e.stunT -= dt;
      if (e.shredT > 0) {
        e.shredT -= dt;
        if (e.shredT <= 0) { e.shred = 0; e.acid = 0; }
        else if (e.acid > 0) e.hp -= e.acid * dt;
      }
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * dt;
        if (e.burnT <= 0) e.burnDps = 0;
      }
      e.sinceHit += dt;
      e.flashT -= dt;
      e.revealT -= dt;
      if (e.flags & REGEN && e.hp < e.maxHp && e.sinceHit > 1.2) {
        e.regenAcc += dt;
        if (e.regenAcc >= 0.6) {
          e.regenAcc -= 0.6;
          e.hp = Math.min(e.maxHp, e.hp + 1);
        }
      }
      if (e.hp <= 0) { this.pop(side, e); continue; }

      let mul = e.slowT > 0 ? e.slowMul : 1;
      for (let z = 0; z < zones.length; z++) {
        const zn = zones[z];
        if (dist(e.x, e.y, zn.x, zn.y) < zn.r && zn.slow < mul) mul = zn.slow;
      }
      if (e.def.boss) mul = 1 - (1 - mul) * 0.5;
      const v = e.stunT > 0 ? 0 : e.base * mul;
      e.s += v * dt;
      if (e.s >= g.total) {
        e.dead = true;
        side.lives -= e.leak;
        side.leaks++;
        this.events.push({ type: 'leak', side: side.index, x: g.end.x, y: g.end.y, boss: !!e.def.boss, cost: e.leak });
        continue;
      }
      while (e.seg < g.nseg - 1 && e.s >= g.cum[e.seg + 1]) e.seg++;
      const t = (e.s - g.cum[e.seg]) / g.len[e.seg];
      e.x = g.px[e.seg] + (g.px[e.seg + 1] - g.px[e.seg]) * t;
      e.y = g.py[e.seg] + (g.py[e.seg + 1] - g.py[e.seg]) * t;
    }
  }

  pop(side, e) {
    if (e.dead) return;
    e.dead = true;
    side.pops++;
    let bonus = 0;
    for (const t of side.towers) {
      if (t.st.kind === 'lantern' && t.st.sorte > 0 && dist(t.x, t.y, e.x, e.y) <= t.st.range) bonus += t.st.sorte;
    }
    const bounty = Math.round(e.bounty * (1 + bonus));
    side.coins += bounty;
    this.events.push({ type: 'pop', side: side.index, x: e.x, y: e.y, tier: e.tier, boss: !!e.def.boss, bounty, flags: e.flags });
  }

  // Damage with armor: each hit does at least 1, armor and shred subtract.
  damage(side, e, amount, armorIgnore = 0) {
    if (e.dead || amount <= 0) return;
    const armor = Math.max(0, e.armor - e.shred - armorIgnore);
    const d = Math.max(1, amount - armor);
    e.hp -= d;
    e.sinceHit = 0;
    e.flashT = 0.08;
    side.dmgDone += d;
    if (e.hp <= 0) this.pop(side, e);
  }

  applySlow(e, mul, dur) {
    if (e.slowT <= 0) e.slowMul = mul;
    else e.slowMul = Math.min(e.slowMul, mul);
    e.slowT = Math.max(e.slowT, dur);
  }

  applyStatus(e, p) {
    if (e.dead) return;
    if (p.slow > 0 && p.slow < 1) this.applySlow(e, p.slow, p.slowDur);
    if (p.stun > 0 && !e.def.boss) e.stunT = Math.max(e.stunT, p.stun);
    if (p.burnDps > 0) {
      e.burnDps = Math.max(e.burnDps, p.burnDps);
      e.burnT = Math.max(e.burnT, p.burnDur);
    }
    if (p.shredMax > 0) {
      e.shred = Math.min(p.shredMax, e.shred + 1);
      e.shredT = Math.max(e.shredT, p.shredDur);
      e.acid = Math.max(e.acid, p.acid);
    }
  }

  // -------------------------------------------------------------- towers

  computeBuffs(side) {
    const towers = side.towers;
    for (const t of towers) { t.buff = 0; t.haste = 0; }
    for (const L of towers) {
      if (L.st.kind !== 'lantern') continue;
      const r = L.st.range;
      for (const t of towers) {
        if (t === L || t.st.kind === 'lantern') continue;
        if (dist(t.x, t.y, L.x, L.y) <= r) {
          if (L.st.buff > t.buff) t.buff = L.st.buff;
          if (L.st.haste > t.haste) t.haste = L.st.haste;
        }
      }
      for (const e of side.enemies) {
        if (!e.dead && dist(e.x, e.y, L.x, L.y) <= r) e.revealT = 0.2;
      }
    }
  }

  visible(e, st) {
    return !(e.flags & CAMO) || st.kind === 'sniper' || e.revealT > 0;
  }

  updateTowers(side, dt) {
    for (const t of side.towers) {
      t.recoil = Math.max(0, t.recoil - dt);
      if (t.st.kind === 'lantern') continue;
      t.cdT -= dt;
      if (t.cdT > 0) continue;
      const st = t.st;
      const targets = this.pickTargets(side, t, st.multi || 1);
      if (!targets.length) continue;
      this.fire(side, t, targets);
      t.cdT = st.cd * (1 - t.haste);
    }
  }

  pickTargets(side, t, n) {
    const st = t.st;
    const r2 = st.range * st.range;
    const out = [];
    for (let k = 0; k < n; k++) {
      let best = null, bestKey = -Infinity;
      for (const e of side.enemies) {
        if (e.dead || !this.visible(e, st)) continue;
        if (out.indexOf(e) >= 0) continue;
        const dx = e.x - t.x, dy = e.y - t.y;
        if (dx * dx + dy * dy > r2) continue;
        const key = t.pri === 'last' ? -e.s : t.pri === 'strong' ? e.hp : e.s;
        if (key > bestKey) { bestKey = key; best = e; }
      }
      if (!best) break;
      out.push(best);
    }
    return out;
  }

  fire(side, t, list) {
    const st = t.st;
    const dmg = st.dmg * (1 + t.buff);
    const first = list[0];
    t.aim = Math.atan2(first.y - t.y, first.x - t.x);
    t.recoil = 0.12;
    switch (st.kind) {
      case 'arrow':
      case 'sniper':
      case 'frost':
      case 'glue':
        for (const e of list) {
          this.pushProj(side, t, e, {
            kind: st.kind, speed: st.speed, dmg, pierce: st.pierce || 0, armorIgnore: st.armorIgnore || 0,
            splash: st.splash || 0, slow: st.slow || 0, slowDur: st.slowDur || 0, stun: st.stun || 0,
            shredMax: st.shredMax || 0, shredDur: st.shredDur || 0, acid: st.acid || 0,
            burnDps: st.burnDps || 0, burnDur: st.burnDur || 0, puddle: st.puddle || 0, puddleDur: st.puddleDur || 0,
          });
        }
        break;
      case 'shell': {
        // Lead the target: predict where it will be when the shell lands.
        const flight = dist(t.x, t.y, first.x, first.y) / st.speed;
        const p = posAt(this.geo, first.s + first.base * flight * (first.slowT > 0 ? first.slowMul : 1));
        const p2 = this.pushProj(side, t, first, {
          kind: 'shell', speed: st.speed, dmg, splash: st.splash, burnDps: st.burnDps, burnDur: st.burnDur, armorIgnore: 0,
        });
        p2.tx = p.x; p2.ty = p.y; p2.target = null;
        break;
      }
      case 'bolt': {
        const hits = [first];
        for (let k = 1; k < st.chain; k++) {
          const last = hits[hits.length - 1];
          let best = null, bd = st.chainRange * st.chainRange;
          for (const e of side.enemies) {
            if (e.dead || hits.indexOf(e) >= 0 || !this.visible(e, st)) continue;
            const d2 = (e.x - last.x) ** 2 + (e.y - last.y) ** 2;
            if (d2 <= bd) { bd = d2; best = e; }
          }
          if (!best) break;
          hits.push(best);
        }
        const pts = [{ x: t.x, y: t.y }];
        for (let k = 0; k < hits.length; k++) {
          const e = hits[k];
          pts.push({ x: e.x, y: e.y });
          this.damage(side, e, dmg * Math.pow(0.9, k));
          if (st.stun > 0 && !e.def.boss) e.stunT = Math.max(e.stunT, st.stun);
        }
        this.events.push({ type: 'bolt', side: side.index, pts });
        break;
      }
    }
  }

  pushProj(side, t, target, props) {
    const p = side.projFree.pop() || {};
    p.dead = false;
    p.x = t.x;
    p.y = t.y;
    p.vx = 0;
    p.vy = 0;
    p.target = target;
    p.uid = target.uid;
    p.tx = 0;
    p.ty = 0;
    p.life = 2.5;
    p.pierce = 0;
    p.armorIgnore = 0;
    p.splash = 0;
    p.slow = 0;
    p.slowDur = 0;
    p.stun = 0;
    p.shredMax = 0;
    p.shredDur = 0;
    p.acid = 0;
    p.burnDps = 0;
    p.burnDur = 0;
    p.puddle = 0;
    p.puddleDur = 0;
    p.owner = t.id;
    Object.assign(p, props);
    side.projs.push(p);
    return p;
  }

  updateProjs(side, dt) {
    for (const p of side.projs) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.kind === 'shell') {
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        const step = p.speed * dt;
        if (d <= step || p.life <= 0) {
          p.dead = true;
          this.explode(side, p, p.tx, p.ty, p.splash || 22, null);
        } else {
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
          p.vx = dx / d;
          p.vy = dy / d;
        }
        continue;
      }
      const tgt = p.target;
      if (p.life <= 0 || !tgt || tgt.dead || tgt.uid !== p.uid) { p.dead = true; continue; }
      const dx = tgt.x - p.x, dy = tgt.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = p.speed * dt;
      p.vx = dx / d;
      p.vy = dy / d;
      if (d <= step + 4) {
        p.dead = true;
        this.hit(side, p, tgt);
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  hit(side, p, e) {
    this.damage(side, e, p.dmg, p.armorIgnore);
    this.applyStatus(e, p);
    if (p.splash > 0) this.explode(side, p, e.x, e.y, p.splash, e);
    if (p.pierce > 0) {
      let n = p.pierce;
      for (const o of side.enemies) {
        if (n <= 0) break;
        if (o.dead || o === e) continue;
        if (dist(o.x, o.y, e.x, e.y) <= 26) {
          this.damage(side, o, p.dmg, p.armorIgnore);
          this.applyStatus(o, p);
          n--;
        }
      }
    }
    if (p.puddle > 0) side.zones.push({ x: e.x, y: e.y, r: p.puddle, t: p.puddleDur, slow: p.slow || 0.4 });
    if (!(p.splash > 0)) this.events.push({ type: 'hit', side: side.index, x: e.x, y: e.y, kind: p.kind });
  }

  explode(side, p, x, y, r, skip) {
    const r2 = r * r;
    for (const o of side.enemies) {
      if (o.dead || o === skip) continue;
      if ((o.x - x) ** 2 + (o.y - y) ** 2 <= r2) {
        this.damage(side, o, p.dmg, p.armorIgnore);
        this.applyStatus(o, p);
      }
    }
    if (skip) this.applyStatus(skip, p);
    this.events.push({ type: 'boom', side: side.index, x, y, r, kind: p.kind });
  }

  updateZones(side, dt) {
    for (const z of side.zones) z.t -= dt;
  }

  compact(side) {
    const en = side.enemies;
    let w = 0;
    for (let i = 0; i < en.length; i++) {
      const e = en[i];
      if (e.dead) side.enemyFree.push(e);
      else en[w++] = e;
    }
    en.length = w;
    const pr = side.projs;
    w = 0;
    for (let i = 0; i < pr.length; i++) {
      const p = pr[i];
      if (p.dead) { p.target = null; side.projFree.push(p); }
      else pr[w++] = p;
    }
    pr.length = w;
    const zn = side.zones;
    w = 0;
    for (let i = 0; i < zn.length; i++) if (zn[i].t > 0) zn[w++] = zn[i];
    zn.length = w;
  }

  // -------------------------------------------------------------- actions

  canBuild(sideIdx, typeId, col, row) {
    const side = this.sides[sideIdx];
    const type = TOWERS[typeId];
    if (!type || !this.unlocked.has(typeId)) return 'locked';
    if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= COLS || row >= ROWS) return 'blocked';
    const v = side.grid[row * COLS + col];
    if (v === 1) return 'blocked';
    if (v === 2) return 'occupied';
    if (side.coins < type.cost) return 'coins';
    return null;
  }

  build(sideIdx, typeId, col, row) {
    const reason = this.canBuild(sideIdx, typeId, col, row);
    if (reason) return { ok: false, reason };
    const side = this.sides[sideIdx];
    const type = TOWERS[typeId];
    const t = {
      id: ++this.towerId, type: typeId, col, row,
      x: (col + 0.5) * CELL, y: (row + 0.5) * CELL,
      a: 0, b: 0, st: towerStats(type, 0, 0), invested: type.cost,
      cdT: 0.3, recoil: 0, aim: -Math.PI / 2, buff: 0, haste: 0, pri: type.pri,
    };
    side.towers.push(t);
    side.grid[row * COLS + col] = 2;
    side.coins -= type.cost;
    side.built++;
    this.events.push({ type: 'build', side: sideIdx, x: t.x, y: t.y });
    return { ok: true, tower: t };
  }

  findTower(sideIdx, id) {
    return this.sides[sideIdx].towers.find((t) => t.id === id) || null;
  }

  // Path 'A' or 'B'. At most one path may reach tier 3.
  upgradeReason(sideIdx, id, path) {
    const t = this.findTower(sideIdx, id);
    if (!t) return 'gone';
    const type = TOWERS[t.type];
    const tier = path === 'A' ? t.a : t.b;
    const other = path === 'A' ? t.b : t.a;
    if (tier >= 3) return 'max';
    if (tier + 1 === 3 && other >= 3) return 'max';
    const cost = type[path][tier].cost;
    if (this.sides[sideIdx].coins < cost) return 'coins';
    return null;
  }

  upgrade(sideIdx, id, path) {
    const reason = this.upgradeReason(sideIdx, id, path);
    if (reason) return { ok: false, reason };
    const side = this.sides[sideIdx];
    const t = this.findTower(sideIdx, id);
    const type = TOWERS[t.type];
    const tier = path === 'A' ? t.a : t.b;
    const cost = type[path][tier].cost;
    if (path === 'A') t.a++; else t.b++;
    t.st = towerStats(type, t.a, t.b);
    t.invested += cost;
    side.coins -= cost;
    this.events.push({ type: 'upgrade', side: sideIdx, x: t.x, y: t.y });
    return { ok: true };
  }

  sell(sideIdx, id) {
    const side = this.sides[sideIdx];
    const t = this.findTower(sideIdx, id);
    if (!t) return { ok: false };
    const refund = Math.floor(t.invested * 0.7);
    side.coins += refund;
    side.grid[t.row * COLS + t.col] = 0;
    side.towers.splice(side.towers.indexOf(t), 1);
    this.events.push({ type: 'sell', side: sideIdx, x: t.x, y: t.y, refund });
    return { ok: true, refund };
  }

  setPriority(sideIdx, id, pri) {
    const t = this.findTower(sideIdx, id);
    if (t) t.pri = pri;
  }

  sendReason(fromIdx, optIdx) {
    if (!this.sending || this.over) return 'disabled';
    const opt = SENDS[optIdx];
    const from = this.sides[fromIdx];
    if (!opt) return 'blocked';
    if (from.round < opt.unlock) return 'locked';
    if (from.coins < opt.cost) return 'coins';
    return null;
  }

  // Sends a group from `fromIdx` to the opponent's track.
  send(fromIdx, optIdx) {
    const reason = this.sendReason(fromIdx, optIdx);
    if (reason) return { ok: false, reason };
    const opt = SENDS[optIdx];
    const from = this.sides[fromIdx];
    const to = this.sides[1 - fromIdx];
    from.coins -= opt.cost;
    from.sendIncome += opt.inc;
    from.sent++;
    from.lastSend = this.time;
    const hp = hpScale(from.round);
    for (let i = 0; i < opt.count; i++) {
      to.pending.push({ t: this.time + i * SEND_STAGGER, tier: opt.tier, flags: opt.flags, hp });
    }
    this.events.push({ type: 'send', side: fromIdx, opt: optIdx, target: 1 - fromIdx });
    return { ok: true };
  }

  // -------------------------------------------------------------- queries

  stats(sideIdx) {
    const s = this.sides[sideIdx];
    return {
      round: s.round, lives: s.lives, coins: s.coins, pops: s.pops, leaks: s.leaks,
      sent: s.sent, built: s.built, dmg: s.dmgDone, income: roundIncome(s.round) + s.sendIncome,
      towers: s.towers.length, enemies: s.enemies.length, time: this.time,
    };
  }
}

export { CELL, COLS, ROWS, WORLD_W, WORLD_H, towerInvested };
