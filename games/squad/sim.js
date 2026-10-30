// Canyon-runner battle simulation (pure: no DOM, deterministic for a seed).
//
// The squad walks up a canyon road (z forward, x across, metres) and auto-fires
// straight ahead; the player only steers x. Hordes of red soldiers stream down
// from the far end. Along the road: blue +N crates (walk into them), weapon
// pedestals and golden statues (shoot their number down to 0), power-up rings
// (walk through). The renderer and UI read the state and consume `events`.

import { ZTYPES, WEAPONS, MAX_TIER, STATUES, heroStats } from './data.js';
import { Gen, ROAD } from './gen.js';
import { rng } from '../../js/core/ui.js';

export { ROAD };
export const VIEW = 56; // how far ahead (m) things are visible / spawn
export const RANGE = 38; // bullet range (m)
export const MAXD = 60; // max soldiers simulated individually (rest folded into damage)
const BSPD = 46; // bullet speed m/s
const WALK = 3.1; // squad speed when the way is clear
const VIS_RATE = 6; // max visual shots per soldier per second
const SPACING = 0.52; // formation spacing
const GOLDEN = 2.39996323;
// spatial grid for bullet hits (small enemies only)
const GX0 = -ROAD - 1;
const GCW = 0.5;
const GCOLS = Math.ceil((2 * ROAD + 2) / GCW);
const GROWS = 72; // 1 m rows from sq.z - 6
const NOP = -1;

export class World {
  // o: { mode, level, seed, lo:{startN,dmg,rate,hp,rank}, nom:{startN,dmg,rate}, hero:{id,lvl,tower}|null, killCoin }
  constructor(o) {
    this.mode = o.mode === 'endless' ? 'endless' : 'campaign';
    this.level = o.level || 1;
    this.lo = o.lo;
    this.killCoin = o.killCoin || 1;
    this.rand = rng(((o.seed >>> 0) ^ 0x9e3779b9) >>> 0);
    this.t = 0;
    this.state = 'ready';
    this.endT = 0;
    const n = Math.max(1, Math.round(o.lo.startN));
    this.sq = { x: 0, tx: 0, z: 0, n, peak: n, acc: 0, R: 0.5, tier: 0, dmgMul: 1, rateMul: 1, speed: 0, heroes: [] };
    this.sol = [];
    this.enemies = [];
    this.bullets = [];
    this.bpool = [];
    this.crates = [];
    this.pickups = [];
    this.statues = [];
    this.rings = [];
    this.waves = [];
    this.booms = [];
    this.strikes = [];
    this.missiles = [];
    this.events = [];
    this.boss = null;
    this.kills = 0;
    this.coins = 0;
    this.cratesGot = 0;
    this.unlocks = 0;
    this.heroesJoined = 0;
    this.abilityUses = 0;
    this.bossKills = 0;
    this.shieldT = 0;
    this.hitBudget = 0;
    this.seen = new Set();
    this.hero = o.hero ? { ...o.hero, st: heroStats(o.hero.id, o.hero.lvl, o.hero.tower || 1), cd: 0 } : null;
    // grid
    this.gHead = new Int32Array(GCOLS * GROWS);
    this.gNext = new Int32Array(1024);
    this.gen = new Gen({ mode: this.mode, level: this.level, seed: o.seed, nom: o.nom || { startN: n, dmg: o.lo.dmg, rate: o.lo.rate } });
    this.length = this.mode === 'campaign' ? 16 + this.gen.segs * 42 : Infinity;
    this.gen.fill(this, VIEW + 90);
    this.syncSoldiers();
    for (const s of this.sol) {
      s.ox = s.tx;
      s.oz = s.tz;
    }
  }

  // ------------------------------------------------------------ spawning API (used by Gen)
  addCrate(x, z, v) {
    this.crates.push({ x, z, v, alive: true });
  }
  addPickup(x, z, tier, hp) {
    this.pickups.push({ x, z, tier, hp, max: hp, alive: true, flash: 0, w: 0.8 });
  }
  addStatue(x, z, kind, hp) {
    this.statues.push({ x, z, kind, hp, max: hp, alive: true, flash: 0, w: 1.4, wake: -1 });
  }
  addRing(x, z, kind, p) {
    this.rings.push({ x, z, kind, p, alive: true, t: 0 });
  }
  addWave(spec) {
    this.waves.push({ ...spec, started: false, spawned: 0, acc: 0, bossDone: !spec.boss });
  }

  spawnEnemy(type, x, z, hp, opt = {}) {
    const T = ZTYPES[type];
    const e = {
      type, x, z, hp, max: hp, r: T.r * (opt.scale || 1), pow: opt.pow || T.pow, spd: (opt.spd || T.spd) * (0.9 + 0.2 * this.rand()),
      coin: opt.coin || T.coin, big: !!(T.big || opt.boss), boss: !!opt.boss, spr: opt.spr || T.spr, scale: (opt.scale || 1) * T.scale,
      off: opt.off || 0, cx: opt.cx === undefined ? x : opt.cx, alive: true, flash: 0, ph: this.rand() * 10, stompT: 0.6, atk: 0, contact: 0,
    };
    this.enemies.push(e);
    return e;
  }

  // ------------------------------------------------------------ helpers
  emit(e) {
    this.events.push(e);
  }
  get live() {
    return this.state === 'run';
  }
  start() {
    if (this.state === 'ready') {
      this.state = 'run';
      this.emit({ t: 'start' });
    }
  }
  weapon() {
    return WEAPONS[Math.min(this.sq.tier, MAX_TIER)];
  }
  // damage multiplier from tiers beyond the last weapon
  tierBonus() {
    return Math.pow(1.3, Math.max(0, this.sq.tier - MAX_TIER));
  }
  soldierDps() {
    const w = this.weapon();
    return w.dmg * w.rate * this.tierBonus() * this.sq.dmgMul * this.sq.rateMul * this.lo.dmg * this.lo.rate;
  }
  dps() {
    let d = this.sq.n * this.soldierDps();
    for (const h of this.sq.heroes) d += STATUES[h.kind].dpsK * this.soldierDps();
    return d;
  }
  steer(x) {
    const lim = ROAD - 0.25 - Math.min(this.sq.R * 0.8, 1.6);
    this.sq.tx = Math.max(-lim, Math.min(lim, x));
  }
  see(what) {
    if (this.seen.has(what)) return;
    this.seen.add(what);
    this.emit({ t: 'see', what });
  }

  syncSoldiers(hx, hz) {
    const D = Math.min(this.sq.n, MAXD);
    while (this.sol.length < D) this.sol.push({ ox: (this.rand() - 0.5) * 0.4, oz: -0.6, tx: 0, tz: 0, fire: this.rand() * 0.3, fl: 0, ph: this.rand() });
    while (this.sol.length > D) {
      let k = this.sol.length - 1;
      if (hx !== undefined) {
        let best = Infinity;
        for (let i = 0; i < this.sol.length; i++) {
          const s = this.sol[i];
          const d = (this.sq.x + s.ox - hx) ** 2 + (this.sq.z + s.oz - hz) ** 2;
          if (d < best) {
            best = d;
            k = i;
          }
        }
      }
      const s = this.sol[k];
      this.emit({ t: 'sdie', x: this.sq.x + s.ox, z: this.sq.z + s.oz });
      this.sol.splice(k, 1);
    }
    const c = SPACING * (1 + 0.25 * Math.log10(Math.max(1, this.sq.n / MAXD)));
    for (let i = 0; i < this.sol.length; i++) {
      const rad = c * Math.sqrt(i + 0.5) * 0.62;
      const a = i * GOLDEN;
      this.sol[i].tx = Math.cos(a) * rad;
      this.sol[i].tz = Math.sin(a) * rad * 0.8;
    }
    this.sq.R = 0.3 + c * 0.62 * Math.sqrt(Math.max(1, D));
    // heroes stand on the flanks
    let l = 0;
    let r = 0;
    for (const h of this.sq.heroes) {
      if (h.side < 0) h.tx = -(this.sq.R + 0.55 + 0.9 * l++);
      else h.tx = this.sq.R + 0.55 + 0.9 * r++;
    }
  }

  setCount(n, hx, hz) {
    const before = this.sq.n;
    this.sq.n = Math.max(0, Math.min(99999, Math.round(n)));
    if (this.sq.n > this.sq.peak) this.sq.peak = this.sq.n;
    this.syncSoldiers(hx, hz);
    return this.sq.n - before;
  }

  hurt(power, x, z) {
    if (!this.live) return 0;
    if (this.shieldT > 0) {
      this.emit({ t: 'shieldHit', x, z });
      return 0;
    }
    this.sq.acc += power / this.lo.hp;
    let lost = Math.floor(this.sq.acc + 1e-9);
    if (lost <= 0) {
      this.emit({ t: 'graze', x, z });
      return 0;
    }
    this.sq.acc -= lost;
    const fromSquad = Math.min(lost, this.sq.n);
    if (fromSquad > 0) {
      this.emit({ t: 'lost', n: fromSquad, x, z });
      this.setCount(this.sq.n - fromSquad, x, z);
      lost -= fromSquad;
    }
    // heroes soak the rest once the squad is gone
    while (lost > 0 && this.sq.heroes.length) {
      const h = this.sq.heroes[0];
      const d = Math.min(lost, h.hp);
      h.hp -= d;
      lost -= d;
      if (h.hp <= 0) {
        this.sq.heroes.shift();
        this.emit({ t: 'heroDie', kind: h.kind, x: this.sq.x + h.ox, z: this.sq.z });
        this.syncSoldiers();
      }
    }
    if (this.sq.n <= 0 && !this.sq.heroes.length) this.lose();
    return fromSquad;
  }

  lose() {
    if (this.state !== 'run') return;
    this.state = 'lost';
    this.endT = this.t;
    this.emit({ t: 'lose' });
  }
  win() {
    if (this.state !== 'run') return;
    this.state = 'won';
    this.endT = this.t;
    this.emit({ t: 'win' });
    for (const e of this.enemies) if (e.alive) this.killEnemy(e, false);
  }

  killEnemy(e, credit = true) {
    if (!e.alive) return;
    e.alive = false;
    if (credit) {
      this.kills++;
      this.coins += e.coin * this.killCoin;
    }
    this.emit({ t: 'kill', x: e.x, z: e.z, spr: e.spr, scale: e.scale, big: e.big, credit });
    if (e.boss) {
      this.bossKills++;
      this.coins += e.coin;
      this.emit({ t: 'bossDie', x: e.x, z: e.z, coin: e.coin });
      if (this.boss === e) this.boss = null;
      if (e.final && this.mode === 'campaign') this.win();
    }
  }

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.06;
    if (e.hp <= 0) this.killEnemy(e);
  }

  hitItem(it, dmg, kind) {
    it.hp -= dmg;
    it.flash = 0.08;
    if (it.hp > 0) return;
    it.hp = 0;
    it.alive = false;
    if (kind === 'pickup') {
      const before = this.sq.tier;
      this.sq.tier = Math.max(this.sq.tier + 1, it.tier);
      this.unlocks++;
      this.emit({ t: 'weapon', tier: this.sq.tier, from: before, x: it.x, z: it.z });
    } else {
      this.unlocks++;
      this.heroesJoined++;
      const st = STATUES[it.kind];
      const h = { kind: it.kind, hp: Math.max(1, Math.round(st.hp * this.lo.hp)), fire: 0.2, ox: it.x - this.sq.x, oz: it.z - this.sq.z, tx: 0, side: it.x < this.sq.x ? -1 : 1, fl: 0, ph: 0, born: this.t };
      this.sq.heroes.push(h);
      this.syncSoldiers();
      this.emit({ t: 'heroJoin', kind: it.kind, x: it.x, z: it.z });
    }
  }

  explode(bm) {
    this.emit({ t: 'boom', x: bm.x, z: bm.z, r: bm.r, kind: bm.kind });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - bm.x, e.z - bm.z);
      if (d < bm.r + e.r) this.damageEnemy(e, bm.dmg * (e.boss ? bm.bossMul : 1) * (1 - 0.4 * Math.min(1, d / bm.r)));
    }
  }

  // ------------------------------------------------------------ meta hero ability
  useAbility() {
    const h = this.hero;
    if (!h || h.cd > 0 || !this.live) return false;
    h.cd = h.st.cd;
    this.abilityUses++;
    const dps = this.dps();
    const sq = this.sq;
    if (h.id === 'tank') {
      this.shieldT = h.st.dur;
      this.booms.push({ x: sq.x, z: sq.z + 2, r: h.st.radius / 30, dmg: dps * h.st.k, kind: 'shock', bossMul: 0.3 });
    } else if (h.id === 'jet') {
      for (let i = 0; i < 8; i++) this.strikes.push({ t: this.t + 0.45 + i * 0.1, x: sq.x + (this.rand() - 0.5) * 1.2, dz: 8 + i * 4.2, dmg: dps * h.st.k, r: h.st.radius / 30 });
    } else {
      // densest group in view
      let best = null;
      let bestScore = 0;
      for (const e of this.enemies) {
        if (!e.alive || e.z - sq.z > VIEW - 6 || e.z < sq.z + 2) continue;
        let score = e.boss ? 4 : 0;
        for (const f of this.enemies) if (f.alive && Math.abs(f.x - e.x) < 3 && Math.abs(f.z - e.z) < 3) score += 1;
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }
      const tx = best ? best.x : sq.x;
      const tz = best ? best.z : sq.z + 25;
      this.missiles.push({ x0: sq.x, z0: sq.z + 0.5, tx, tz, target: best, t0: this.t, dur: 0.8, dmg: dps * h.st.k, r: h.st.radius / 30, x: sq.x, z: sq.z, y: 1 });
    }
    this.emit({ t: 'ability', id: h.id, x: sq.x });
    return true;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.t += dt;
    const sq = this.sq;
    const live = this.live;
    this.hitBudget = 10;
    this.gen.fill(this, sq.z + VIEW + 90);

    // movement: walk while the way is clear, creep when enemies are close
    let near = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dz = e.z - sq.z;
      if (dz > -1 && dz < near && Math.abs(e.x - sq.x) < 3.5 + e.r) near = dz;
    }
    const want = !live ? 0 : near < 9 ? 0 : near < 22 ? 0.9 : WALK;
    sq.speed += (want - sq.speed) * Math.min(1, dt * 3);
    if (live) {
      sq.z += sq.speed * dt;
      sq.x += (sq.tx - sq.x) * Math.min(1, dt * 10);
    }

    // formation easing
    const k = Math.min(1, dt * 8);
    for (const s of this.sol) {
      s.ox += (s.tx - s.ox) * k;
      s.oz += (s.tz - s.oz) * k;
      if (s.fl > 0) s.fl -= dt;
      s.ph += dt * (0.9 + sq.speed * 0.45);
    }
    for (const h of sq.heroes) {
      const kk = Math.min(1, dt * 3);
      h.ox += (h.tx - h.ox) * kk;
      h.oz += (-0.25 - h.oz) * kk;
      if (h.fl > 0) h.fl -= dt;
      h.ph += dt * (0.8 + sq.speed * 0.35);
    }

    this.updateWaves(dt, live);
    if (live) this.fire(dt);
    this.buildGrid();
    this.updateBullets(dt);
    this.updateEnemies(dt, live);
    if (live) this.updateItems(dt);
    this.updateAbility(dt, live);
    if (this.booms.length) {
      const list = this.booms;
      this.booms = [];
      for (const bm of list) this.explode(bm);
    }
    // cleanup
    if (this.enemies.length) {
      let j = 0;
      for (const e of this.enemies) if (e.alive && e.z > sq.z - 4) this.enemies[j++] = e;
      this.enemies.length = j;
    }
    const minZ = sq.z - 6;
    if (this.crates.length && (this.crates[0].z < minZ || !this.crates[0].alive)) this.crates = this.crates.filter((c) => c.alive && c.z > minZ);
    if (this.pickups.length) this.pickups = this.pickups.filter((p) => p.alive && p.z > minZ);
    if (this.statues.length) this.statues = this.statues.filter((p) => p.alive && p.z > minZ);
    if (this.rings.length) this.rings = this.rings.filter((p) => p.alive && p.z > minZ);
    if (this.waves.length && this.waves[0].started && this.waves[0].spawned >= this.waves[0].count && this.waves[0].bossDone) this.waves.shift();
  }

  updateWaves(dt, live) {
    const sq = this.sq;
    for (const w of this.waves) {
      if (!w.started) {
        if (sq.z + 4 >= w.z && live) {
          w.started = true;
          // marching column: rows of `rowN` soldiers, `gap` metres apart
          w.rowN = Math.max(2, Math.round(w.width / 0.62));
          w.gap = Math.max(0.55, Math.min(2.2, (ZTYPES.grunt.spd * w.rowN) / w.rate));
          // the head of the column is already in sight when the wave starts
          for (let z = sq.z + 26; z < sq.z + VIEW + 2 && w.spawned < w.count; z += w.gap) this.spawnRow(w, z);
          this.emit({ t: 'wave', boss: !!w.boss, n: w.count });
        } else continue;
      }
      if (!live) continue;
      if (w.spawned < w.count) {
        w.acc += (w.rate / w.rowN) * dt;
        while (w.acc >= 1 && w.spawned < w.count) {
          w.acc -= 1;
          this.spawnRow(w, sq.z + VIEW + 2);
        }
        if (w.spawned >= w.count) {
          for (const ex of w.extra) {
            const T = ZTYPES[ex];
            this.spawnEnemy(ex, w.cx + (this.rand() - 0.5), sq.z + VIEW + 3, w.hu * T.hpW, { cx: w.cx });
            this.see(ex);
          }
        }
      }
      if (w.boss && !w.bossDone && w.spawned >= w.count * 0.6) {
        w.bossDone = true;
        const b = w.boss;
        const e = this.spawnEnemy('brute', w.cx, sq.z + VIEW + 4, b.hp, { boss: true, scale: b.scale, spd: b.spd, pow: b.pow, coin: b.coin, spr: b.spr, cx: w.cx });
        e.final = b.final;
        e.id = b.id;
        e.mega = b.mega;
        e.minion = b.minion;
        e.minT = 2.5;
        this.boss = e;
        this.emit({ t: 'bossStart', id: b.id });
        this.see('boss');
      }
    }
  }

  spawnRow(w, z) {
    const types = w.types;
    let tot = 0;
    for (const o of types) tot += o[1];
    const n = Math.min(w.rowN, w.count - w.spawned);
    for (let j = 0; j < n; j++) {
      let r = this.rand() * tot;
      let type = types[0][0];
      for (const o of types) {
        r -= o[1];
        if (r <= 0) {
          type = o[0];
          break;
        }
      }
      // staggered rows with loose jitter so the column reads as a crowd, not a block
      const stag = w.rowI & 1 ? 0.5 : 0;
      const off = (j + stag - (w.rowN - 1) / 2) * (w.width / w.rowN) + (this.rand() - 0.5) * 0.45;
      const x = Math.max(-ROAD + 0.4, Math.min(ROAD - 0.4, w.cx + off));
      this.spawnEnemy(type, x, z + (this.rand() - 0.5) * w.gap * 0.9, w.hu * ZTYPES[type].hpW, { off, cx: w.cx });
    }
    w.spawned += n;
    w.rowI = (w.rowI || 0) + 1;
  }

  fire(dt) {
    const sq = this.sq;
    const w = this.weapon();
    const rate = w.rate * sq.rateMul * this.lo.rate;
    const vr = Math.min(VIS_RATE, rate);
    const D = this.sol.length;
    const perShot = w.dmg * this.tierBonus() * sq.dmgMul * this.lo.dmg * (rate / vr) * (sq.n / Math.max(1, D));
    const iv = 1 / vr;
    let shots = 0;
    for (const s of this.sol) {
      s.fire -= dt;
      if (s.fire <= 0) {
        s.fire += iv * (0.85 + 0.3 * this.rand());
        if (s.fire < 0) s.fire = iv * 0.5;
        s.fl = 0.05;
        this.shot(sq.x + s.ox + 0.1, sq.z + s.oz + 0.5, perShot, 0);
        shots++;
      }
    }
    const sd = this.soldierDps();
    for (const h of sq.heroes) {
      const st = STATUES[h.kind];
      h.fire -= dt;
      if (h.fire <= 0) {
        h.fire += 1 / st.rate;
        h.fl = 0.07;
        this.shot(sq.x + h.ox + 0.15, sq.z + h.oz + 0.8, (st.dpsK * sd) / st.rate, h.kind === 'rocket' ? 2 : 1);
        shots++;
      }
    }
    if (shots) this.emit({ t: 'shoot', n: shots, tier: sq.tier });
  }

  shot(x, z, dmg, kind) {
    const b = this.bpool.pop() || {};
    b.x = x;
    b.z = z;
    b.z0 = z;
    b.vx = (this.rand() - 0.5) * 0.25;
    b.dmg = dmg;
    b.kind = kind;
    b.max = this.sq.z + RANGE;
    this.bullets.push(b);
  }

  buildGrid() {
    const head = this.gHead;
    head.fill(NOP);
    const es = this.enemies;
    if (this.gNext.length < es.length) this.gNext = new Int32Array(es.length * 2);
    const next = this.gNext;
    const z0 = this.sq.z - 6;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (!e.alive || e.big) continue;
      const c = Math.floor((e.x - GX0) / GCW);
      const r = Math.floor(e.z - z0);
      if (c < 0 || c >= GCOLS || r < 0 || r >= GROWS) continue;
      const k = r * GCOLS + c;
      next[i] = head[k];
      head[k] = i;
    }
  }

  // first live thing hit by a bullet moving from z0 to z1 along x
  updateBullets(dt) {
    const sq = this.sq;
    const es = this.enemies;
    const head = this.gHead;
    const next = this.gNext;
    const gz0 = sq.z - 6;
    const list = this.bullets;
    const items = this.pickups.length || this.statues.length;
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const z0 = b.z;
      b.z += BSPD * dt;
      b.x += b.vx * dt;
      const z1 = b.z;
      let hit = null;
      let hz = Infinity;
      let hk = 0;
      // small enemies via grid
      const c = Math.floor((b.x - GX0) / GCW);
      const r0 = Math.max(0, Math.floor(z0 - gz0) - 1);
      const r1 = Math.min(GROWS - 1, Math.floor(z1 - gz0) + 1);
      for (let r = r0; r <= r1 && !hit; r++) {
        for (let cc = c - 1; cc <= c + 1; cc++) {
          if (cc < 0 || cc >= GCOLS) continue;
          for (let q = head[r * GCOLS + cc]; q !== NOP; q = next[q]) {
            const e = es[q];
            if (!e.alive) continue;
            if (e.z - e.r > z1 || e.z + e.r < z0 || Math.abs(e.x - b.x) > e.r) continue;
            if (e.z < hz) {
              hz = e.z;
              hit = e;
              hk = 1;
            }
          }
        }
      }
      // big enemies (bosses, brutes)
      for (let q = 0; q < es.length; q++) {
        const e = es[q];
        if (!e.big || !e.alive || e.z >= hz) continue;
        if (e.z - e.r > z1 || e.z + e.r * 0.5 < z0 || Math.abs(e.x - b.x) > e.r * 0.9) continue;
        hz = e.z;
        hit = e;
        hk = 1;
      }
      if (items) {
        for (const p of this.pickups) {
          if (!p.alive || p.z >= hz || p.z > z1 || p.z < z0 - 0.5 || Math.abs(p.x - b.x) > p.w) continue;
          hz = p.z;
          hit = p;
          hk = 2;
        }
        for (const p of this.statues) {
          if (!p.alive || p.z >= hz || p.z > z1 || p.z < z0 - 0.5 || Math.abs(p.x - b.x) > p.w) continue;
          hz = p.z;
          hit = p;
          hk = 3;
        }
      }
      if (hit) {
        if (b.kind === 2) {
          this.booms.push({ x: b.x, z: hz, r: STATUES.rocket.splash, dmg: b.dmg, kind: 'rocket', bossMul: 1 });
          if (hk !== 1) this.hitItem(hit, b.dmg, hk === 2 ? 'pickup' : 'statue');
        } else if (hk === 1) this.damageEnemy(hit, b.dmg);
        else this.hitItem(hit, b.dmg, hk === 2 ? 'pickup' : 'statue');
        if (hk !== 1 || hit.big || this.hitBudget > 0) {
          if (hk === 1 && !hit.big) this.hitBudget--;
          this.emit({ t: 'hit', o: hit, x: b.x, z: hz, k: hk, big: hk !== 1 || hit.big, dmg: b.dmg, y: hk === 1 ? hit.r * 2.4 * (hit.big ? 1.2 : 1) : hk === 2 ? 1.0 : 1.9 });
        }
        this.bpool.push(b);
        continue;
      }
      if (b.z > b.max) {
        this.bpool.push(b);
        continue;
      }
      list[j++] = b;
    }
    list.length = j;
  }

  updateEnemies(dt, live) {
    const sq = this.sq;
    const R = sq.R;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.ph += dt * (e.spd * 0.9);
      if (e.flash > 0) e.flash -= dt;
      if (e.atk > 0) e.atk -= dt;
      if (this.state === 'won') continue;
      const dz = e.z - sq.z;
      // marching column: drift toward the squad lane as they get close
      const follow = dz < 34 ? 1 : 0.35;
      // the column funnels onto the squad as it charges (edges converge into the fire)
      const squeeze = dz < 30 ? Math.max(0.2, (dz - 3) / 27) : 1;
      const want = e.cx + (sq.x - e.cx) * follow + e.off * squeeze;
      const m = (e.big ? 0.8 : 1.3) * dt;
      e.x += Math.max(-m, Math.min(m, want - e.x));
      if (e.x > ROAD - 0.35) e.x = ROAD - 0.35;
      else if (e.x < -ROAD + 0.35) e.x = -ROAD + 0.35;
      const reach = R * 0.75 + e.r;
      const inLane = Math.abs(e.x - sq.x) < R + e.r * 0.8;
      if (e.big) {
        if (dz > reach || !inLane || !live) e.z -= e.spd * dt;
        else if (live) {
          e.contact += dt;
          e.stompT -= dt;
          if (e.stompT <= 0) {
            e.stompT = 1.1;
            e.atk = 0.35;
            this.emit({ t: 'stomp', x: e.x, z: e.z - e.r, boss: e.boss });
            this.hurt(Math.max(e.pow * (1 + e.contact / 12), this.lo.hp * 1.01), e.x, e.z - e.r);
          }
        }
        if (e.boss && e.minion && live && dz < VIEW - 4) {
          e.minT -= dt;
          if (e.minT <= 0) {
            e.minT = e.minion.every;
            for (let i = 0; i < e.minion.count; i++) {
              const off = (this.rand() - 0.5) * 3;
              this.spawnEnemy(e.minion.type, Math.max(-ROAD + 0.4, Math.min(ROAD - 0.4, e.x + off)), e.z - e.r - 0.5 - this.rand(), e.minion.hp, { off, cx: e.x });
            }
            this.emit({ t: 'summon', x: e.x, z: e.z });
          }
        }
        continue;
      }
      e.z -= e.spd * dt;
      if (!live) continue;
      if (dz < reach && dz > -R && inLane) {
        if (this.shieldT > 0) {
          this.killEnemy(e, true);
          this.emit({ t: 'shieldHit', x: e.x, z: e.z });
        } else {
          this.killEnemy(e, false);
          this.hurt(e.pow, e.x, e.z);
        }
      }
    }
  }

  updateItems(dt) {
    const sq = this.sq;
    const R = sq.R;
    for (const c of this.crates) {
      if (!c.alive) continue;
      const dz = c.z - sq.z;
      if (dz > 30) break; // crates are ordered by z
      if (dz < 20) this.see('crate');
      if (Math.abs(dz) < R * 0.7 + 0.45 && Math.abs(c.x - sq.x) < R + 0.55) {
        c.alive = false;
        this.cratesGot++;
        const d = this.setCount(sq.n + c.v);
        this.emit({ t: 'crate', x: c.x, z: c.z, v: c.v, d });
      }
    }
    for (const p of this.pickups) {
      if (p.flash > 0) p.flash -= dt;
      if (p.alive && p.z - sq.z < 30) this.see('pickup');
    }
    for (const p of this.statues) {
      if (p.flash > 0) p.flash -= dt;
      if (p.alive && p.z - sq.z < 32) this.see('statue');
    }
    for (const g of this.rings) {
      g.t += dt;
      if (!g.alive) continue;
      const dz = g.z - sq.z;
      if (dz < 26) this.see('ring');
      if (Math.abs(dz) < 0.6 && Math.abs(g.x - sq.x) < 1.25 + R * 0.4) {
        g.alive = false;
        if (g.kind === 'rate') sq.rateMul *= 1 + g.p / 100;
        else sq.dmgMul *= 1 + g.p / 100;
        this.emit({ t: 'ring', kind: g.kind, p: g.p, x: g.x, z: g.z });
      }
    }
  }

  updateAbility(dt, live) {
    const h = this.hero;
    const sq = this.sq;
    if (h && live && h.cd > 0) h.cd = Math.max(0, h.cd - dt);
    if (this.shieldT > 0) this.shieldT = Math.max(0, this.shieldT - dt);
    if (this.strikes.length) {
      const rest = [];
      for (const s of this.strikes) {
        if (this.t >= s.t) this.booms.push({ x: s.x, z: sq.z + s.dz, r: s.r, dmg: s.dmg, kind: 'bomb', bossMul: 0.15 });
        else rest.push(s);
      }
      this.strikes = rest;
    }
    if (this.missiles.length) {
      const rest = [];
      for (const m of this.missiles) {
        if (m.target && m.target.alive) {
          m.tx = m.target.x;
          m.tz = m.target.z;
        }
        const u = Math.min(1, (this.t - m.t0) / m.dur);
        m.x = m.x0 + (m.tx - m.x0) * u;
        m.z = m.z0 + (m.tz - m.z0) * u;
        m.y = 1 + Math.sin(Math.PI * u) * 9;
        if (u >= 1) this.booms.push({ x: m.tx, z: m.tz, r: m.r, dmg: m.dmg, kind: 'missile', bossMul: 0.35 });
        else rest.push(m);
      }
      this.missiles = rest;
    }
  }
}
