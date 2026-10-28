// Runner simulation (no DOM): squad, bullets, zombies, gates, objects, boss,
// hero abilities. The renderer and the UI read its state and consume
// `events` every frame.

import { ZTYPES, heroStats } from './data.js';
import { Gen } from './gen.js';

export const ROAD = 150; // half width of the road (world units)
export const VIEW = 1550; // how far ahead things wake up / bullets fly
export const MAXD = 60; // max soldiers drawn
const BSPD = 1900;
const GOLDEN = 2.39996323;
const rnd = (a, b) => a + (b - a) * Math.random();

export function gateGood(g) {
  return g && (g.op === 'x' || (g.op === '+' && g.v >= 0));
}
export function gateLabel(g) {
  if (g.op === 'x') return '×' + g.v;
  if (g.op === '/') return '÷' + g.v;
  return (g.v >= 0 ? '+' : '−') + Math.abs(g.v);
}

export class World {
  // o: { mode, level, seed, lo:{startN,dmg,rate,hp,rank}, hero:{id,lvl,tower}|null, pNom, E0, killCoin }
  constructor(o) {
    this.mode = o.mode;
    this.level = o.level || 1;
    this.lo = o.lo;
    this.killCoin = o.killCoin || 1;
    this.t = 0;
    this.state = 'ready';
    this.endT = 0;
    this.speed = 260;
    const n = Math.max(1, Math.round(o.lo.startN));
    this.sq = { x: 0, z: 0, tx: 0, n, peak: n, acc: 0 };
    this.c = 7;
    this.R = 12;
    this.sol = [];
    this.bullets = [];
    this.bpool = [];
    this.zombies = [];
    this.gates = [];
    this.objs = [];
    this.bossQ = [];
    this.boss = null;
    this.bossStop = Infinity;
    this.events = [];
    this.kills = 0;
    this.coins = 0;
    this.crates = 0;
    this.gatesGood = 0;
    this.abilityUses = 0;
    this.bossKills = 0;
    this.buff = { dmg: 1, rate: 1 };
    this.shieldT = 0;
    this.strikes = [];
    this.missiles = [];
    this.booms = [];
    this.seen = new Set();
    this.hitBudget = 0;
    this.hero = o.hero ? { ...o.hero, st: heroStats(o.hero.id, o.hero.lvl, o.hero.tower || 1), cd: 0 } : null;
    this.gen = new Gen({ mode: o.mode, level: this.level, seed: o.seed, pNom: o.pNom, E0: o.E0 });
    this.length = this.gen.length;
    this.gen.fill(this, VIEW + 2500);
    this.syncSoldiers();
    for (const s of this.sol) {
      s.ox = s.tx;
      s.oz = s.tz;
    }
  }

  // ------------------------------------------------------------ spawning API (used by Gen)
  addZombie(type, x, z, hp, power) {
    const T = ZTYPES[type];
    this.zombies.push({
      type, x, z, hp, max: hp, power, r: T.r, w: T.w, h: T.h,
      spd: T.spd * rnd(0.88, 1.12), lat: T.lat, coin: T.coin,
      active: false, alive: true, flash: 0, ph: Math.random() * 10, off: rnd(-22, 22), v: Math.floor(Math.random() * 4),
    });
  }
  addGate(z, A, B) {
    const mk = (g, x0, x1) => (g ? { ...g, x0, x1, prog: 0, pulse: 0 } : null);
    this.gates.push({ z, h: [mk(A, -ROAD, 0), mk(B, 0, ROAD)], done: false, t: 0, pick: -1 });
  }
  addObj(kind, x, z, o) {
    this.objs.push({ kind, x, z, w: o.w, hp: o.hp, max: o.hp, power: o.power || 0, boom: o.boom || 0, reward: o.reward, amount: o.amount, alive: true, flash: 0 });
  }
  addBoss(stopZ, spec) {
    this.bossQ.push({ stopZ, spec });
  }

  // ------------------------------------------------------------ helpers
  emit(e) {
    this.events.push(e);
  }
  get live() {
    return this.state === 'run' || this.state === 'boss';
  }
  start() {
    if (this.state === 'ready') {
      this.state = 'run';
      this.emit({ t: 'start' });
    }
  }
  dps() {
    return this.sq.n * this.lo.dmg * this.buff.dmg * this.lo.rate * this.buff.rate;
  }
  steer(x) {
    const lim = ROAD - Math.min(this.R * 0.7, 60);
    this.sq.tx = Math.max(-lim, Math.min(lim, x));
  }

  syncSoldiers(hx, hz) {
    const D = Math.min(this.sq.n, MAXD);
    while (this.sol.length < D) this.sol.push({ ox: rnd(-3, 3), oz: rnd(-3, 3), tx: 0, tz: 0, born: this.t, fire: Math.random() * 0.4, fl: 0 });
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
    const n = this.sq.n;
    this.c = 7 + 1.6 * Math.log10(Math.max(1, n / MAXD));
    this.R = this.c * Math.sqrt(Math.max(1, D)) + 7;
    for (let i = 0; i < this.sol.length; i++) {
      const rad = this.c * Math.sqrt(i + 0.5);
      const a = i * GOLDEN;
      this.sol[i].tx = Math.cos(a) * rad;
      this.sol[i].tz = Math.sin(a) * rad * 0.85;
    }
  }

  setCount(n, hx, hz) {
    const before = this.sq.n;
    this.sq.n = Math.max(0, Math.min(99999, Math.round(n)));
    if (this.sq.n > this.sq.peak) this.sq.peak = this.sq.n;
    this.syncSoldiers(hx, hz);
    if (this.sq.n <= 0 && this.live) this.lose();
    return this.sq.n - before;
  }

  hurt(power, x, z) {
    if (!this.live) return 0;
    if (this.shieldT > 0) {
      this.emit({ t: 'shieldHit', x, z });
      return 0;
    }
    this.sq.acc += power / this.lo.hp;
    const lost = Math.floor(this.sq.acc + 1e-9);
    if (lost > 0) {
      this.sq.acc -= lost;
      const real = Math.min(lost, this.sq.n);
      this.emit({ t: 'lost', n: real, x, z });
      this.setCount(this.sq.n - lost, x, z);
      return real;
    }
    this.emit({ t: 'graze', x, z });
    return 0;
  }

  lose() {
    this.state = 'lost';
    this.endT = this.t;
    this.emit({ t: 'lose' });
  }

  killZombie(e, credit = true) {
    if (!e.alive) return;
    e.alive = false;
    if (credit) {
      this.kills++;
      this.coins += e.coin * this.killCoin;
    }
    this.emit({ t: credit ? 'kill' : 'bite', x: e.x, z: e.z, type: e.type, big: !!ZTYPES[e.type].bar });
    if (e.type === 'bloater') this.booms.push({ x: e.x, z: e.z, r: 95, dmg: e.max * 2.5, kind: 'bloat', bossMul: 0.2 });
  }

  damageZombie(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.07;
    if (e.hp <= 0) this.killZombie(e);
  }

  breakObj(o, reward) {
    if (!o.alive) return;
    o.alive = false;
    if (o.kind === 'barrel') {
      this.booms.push({ x: o.x, z: o.z, r: 115, dmg: o.boom, kind: 'barrel', bossMul: 0.3 });
    } else if (o.kind === 'crate') {
      if (reward && this.live) {
        this.crates++;
        if (o.reward === 'rate') this.buff.rate *= 1 + o.amount;
        else if (o.reward === 'dmg') this.buff.dmg *= 1 + o.amount;
        else this.setCount(this.sq.n + o.amount);
        this.emit({ t: 'crate', x: o.x, z: o.z, kind: o.reward, amount: o.amount });
      } else this.emit({ t: 'crateMiss', x: o.x, z: o.z });
    } else {
      this.emit({ t: 'wallBreak', x: o.x, z: o.z, w: o.w });
    }
  }

  damageObj(o, dmg) {
    o.hp -= dmg;
    o.flash = 0.07;
    if (o.hp <= 0) this.breakObj(o, true);
  }

  damageBoss(dmg) {
    const b = this.boss;
    if (!b || !b.alive) return;
    b.hp -= dmg;
    b.flash = 0.06;
    if (b.hp <= 0) {
      b.hp = 0;
      b.alive = false;
      b.deadT = this.t;
      this.bossKills++;
      this.coins += b.spec.coin;
      this.emit({ t: 'bossDie', x: b.x, z: b.z, coin: b.spec.coin });
      if (this.mode === 'campaign') {
        this.state = 'won';
        this.endT = this.t;
        this.emit({ t: 'win' });
        // remaining zombies flee/die
        for (const e of this.zombies) if (e.alive && e.active) this.killZombie(e, false);
      } else {
        this.state = 'run';
        this.bossStop = Infinity;
      }
    }
  }

  explode(bm) {
    this.emit({ t: 'boom', x: bm.x, z: bm.z, r: bm.r, kind: bm.kind });
    const r = bm.r;
    for (const e of this.zombies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - bm.x, e.z - bm.z);
      if (d < r + e.r) {
        e.active = true;
        this.damageZombie(e, bm.dmg * (1 - 0.5 * Math.min(1, d / r)));
      }
    }
    for (const o of this.objs) {
      if (!o.alive) continue;
      if (Math.abs(o.x - bm.x) < r + o.w && Math.abs(o.z - bm.z) < r) {
        if (o.kind === 'barrel') this.breakObj(o, true);
        else this.damageObj(o, bm.dmg * 0.6);
      }
    }
    const b = this.boss;
    if (b && b.alive && Math.hypot(b.x - bm.x, b.z - bm.z) < r + b.r) this.damageBoss(bm.dmg * bm.bossMul);
  }

  // ------------------------------------------------------------ hero
  useAbility() {
    const h = this.hero;
    if (!h || h.cd > 0 || !this.live) return false;
    h.cd = h.st.cd;
    this.abilityUses++;
    const dps = this.dps();
    const sq = this.sq;
    if (h.id === 'tank') {
      this.shieldT = h.st.dur;
      this.booms.push({ x: sq.x, z: sq.z + 30, r: h.st.radius, dmg: dps * h.st.k, kind: 'shock', bossMul: 0.3 });
    } else if (h.id === 'jet') {
      const lane = sq.x;
      for (let i = 0; i < 7; i++) this.strikes.push({ t: this.t + 0.5 + i * 0.11, x: lane + rnd(-18, 18), dz: 240 + i * 175, dmg: dps * h.st.k, r: h.st.radius });
    } else {
      // densest group (or the boss)
      let best = null;
      let bestScore = 0;
      for (const e of this.zombies) {
        if (!e.alive || e.z - sq.z > VIEW - 150 || e.z < sq.z + 40) continue;
        let score = 0;
        for (const f of this.zombies) if (f.alive && Math.abs(f.x - e.x) < 150 && Math.abs(f.z - e.z) < 150) score += 1 + f.hp / (dps + 1);
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }
      let tx = sq.x;
      let tz = sq.z + 700;
      let target = null;
      if (this.boss && this.boss.alive && this.boss.z - sq.z < VIEW && bestScore < 6) {
        target = this.boss;
      } else if (best) target = best;
      if (target) {
        tx = target.x;
        tz = target.z;
      }
      this.missiles.push({ x0: sq.x, z0: sq.z + 10, tx, tz, target, t0: this.t, dur: 0.8, dmg: dps * h.st.k, r: h.st.radius, x: sq.x, z: sq.z, y: 20 });
    }
    this.emit({ t: 'ability', id: h.id, x: sq.x });
    return true;
  }

  see(what) {
    if (this.seen.has(what)) return;
    this.seen.add(what);
    this.emit({ t: 'see', what });
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.t += dt;
    const sq = this.sq;
    const live = this.live;
    this.hitBudget = 14;

    if (this.mode === 'endless') {
      this.speed = 260 + Math.min(120, sq.z / 220);
      this.gen.fill(this, sq.z + VIEW + 2500);
    }

    // boss queue → spawn the boss entity when it comes into view
    if (!this.boss && this.bossQ.length && this.bossQ[0].stopZ + 820 - sq.z < VIEW + 200) {
      const q = this.bossQ.shift();
      const s = q.spec;
      this.boss = { spec: s, x: 0, z: q.stopZ + 820, hp: s.hp, max: s.hp, r: s.r, alive: true, active: false, flash: 0, ph: 0, stompT: 1, minT: 2, deadT: 0, atk: 0 };
      this.bossStop = q.stopZ;
    }

    if (live) {
      if (this.state === 'run') {
        let step = this.speed * dt;
        if (sq.z + step >= this.bossStop) {
          step = Math.max(0, this.bossStop - sq.z);
          this.state = 'boss';
          if (this.boss) this.boss.active = true;
          this.emit({ t: 'bossStart', id: this.boss && this.boss.spec.id });
        }
        sq.z += step;
      }
      sq.x += (sq.tx - sq.x) * Math.min(1, dt * 14);
    }

    // formation
    const k = Math.min(1, dt * 9);
    for (const s of this.sol) {
      s.ox += (s.tx - s.ox) * k;
      s.oz += (s.tz - s.oz) * k;
      if (s.fl > 0) s.fl -= dt;
    }

    // firing
    if (live) {
      const rate = this.lo.rate * this.buff.rate;
      const rs = Math.min(5, rate);
      const D = this.sol.length;
      const dmg = (this.lo.dmg * this.buff.dmg * (rate / rs) * sq.n) / Math.max(1, D);
      const iv = 1 / rs;
      let shots = 0;
      for (const s of this.sol) {
        s.fire -= dt;
        if (s.fire <= 0) {
          s.fire += iv * rnd(0.85, 1.15);
          if (s.fire < 0) s.fire = iv * 0.5;
          s.fl = 0.05;
          const b = this.bpool.pop() || {};
          b.x = sq.x + s.ox + 3;
          b.z = sq.z + s.oz + 8;
          b.vx = rnd(-18, 18);
          b.dmg = dmg;
          this.bullets.push(b);
          shots++;
        }
      }
      if (shots) this.emit({ t: 'shoot', n: shots });
    }

    this.updateBullets(dt);
    this.updateZombies(dt, live);
    if (live) this.updateGates();
    this.updateObjs(dt, live);
    this.updateBoss(dt, live);
    this.updateHero(dt, live);

    // explosions (chains resolve over frames)
    if (this.booms.length) {
      const list = this.booms;
      this.booms = [];
      for (const bm of list) this.explode(bm);
    }

    // cleanup
    if (this.zombies.length > 20) {
      let j = 0;
      for (const e of this.zombies) if (e.alive && e.z > sq.z - 160) this.zombies[j++] = e;
      this.zombies.length = j;
    }
    if (this.objs.length) this.objs = this.objs.filter((o) => o.alive && o.z > sq.z - 220);
    if (this.gates.length && this.gates[0].z < sq.z - 500) this.gates.shift();
  }

  updateBullets(dt) {
    const sq = this.sq;
    const maxZ = sq.z + VIEW;
    const zs = this.zombies;
    const objs = this.objs;
    const boss = this.boss && this.boss.alive ? this.boss : null;
    const gates = this.gates;
    const list = this.bullets;
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const z0 = b.z;
      b.z += BSPD * dt;
      b.x += b.vx * dt;
      let hit = null;
      let hitKind = 0;
      let hz = Infinity;
      for (let q = 0; q < zs.length; q++) {
        const e = zs[q];
        if (!e.alive || e.z > maxZ) continue;
        const r = e.r;
        if (e.z - r > b.z || e.z + r < z0 || Math.abs(e.x - b.x) > r) continue;
        if (e.z < hz) {
          hz = e.z;
          hit = e;
          hitKind = 1;
        }
      }
      for (let q = 0; q < objs.length; q++) {
        const o = objs[q];
        if (!o.alive || o.z > maxZ) continue;
        if (o.z - 14 > b.z || o.z + 14 < z0 || Math.abs(o.x - b.x) > o.w) continue;
        if (o.z < hz) {
          hz = o.z;
          hit = o;
          hitKind = 2;
        }
      }
      if (boss && boss.z < maxZ) {
        const r = boss.r;
        if (!(boss.z - r * 0.6 > b.z || boss.z + r * 0.6 < z0 || Math.abs(boss.x - b.x) > r * 0.9) && boss.z < hz) {
          hz = boss.z;
          hit = boss;
          hitKind = 3;
        }
      }
      for (let q = 0; q < gates.length; q++) {
        const g = gates[q];
        if (g.done || g.z > maxZ || !(z0 < g.z && b.z >= g.z) || g.z > hz) continue;
        const half = b.x < 0 ? g.h[0] : g.h[1];
        if (half && half.shoot) {
          hit = half;
          hitKind = 4;
          hz = g.z;
        }
      }
      if (hit) {
        if (hitKind === 1) this.damageZombie(hit, b.dmg);
        else if (hitKind === 2) this.damageObj(hit, b.dmg);
        else if (hitKind === 3) this.damageBoss(b.dmg);
        else {
          hit.prog += b.dmg;
          hit.pulse = 0.12;
          while (hit.prog >= hit.step) {
            hit.prog -= hit.step;
            hit.v += 1;
          }
        }
        if (this.hitBudget > 0 && hitKind !== 4) {
          this.hitBudget--;
          this.emit({ t: 'hit', x: b.x, z: hz, k: hitKind, y: hitKind === 3 ? hit.r * 1.4 : hitKind === 1 ? hit.h * 0.6 : 12 });
        }
        this.bpool.push(b);
        continue;
      }
      if (b.z > maxZ) {
        this.bpool.push(b);
        continue;
      }
      list[j++] = b;
    }
    list.length = j;
  }

  updateZombies(dt, live) {
    const sq = this.sq;
    const wake = VIEW - 120;
    for (const e of this.zombies) {
      if (!e.alive) continue;
      e.ph += dt;
      if (e.flash > 0) e.flash -= dt;
      if (!e.active) {
        if (e.z - sq.z < wake && this.state !== 'ready') {
          e.active = true;
          if (ZTYPES[e.type].bar) this.see(e.type);
        }
        continue;
      }
      if (this.state === 'won') continue;
      e.z -= e.spd * dt;
      const want = sq.x + e.off;
      const dx = want - e.x;
      const m = e.lat * dt;
      e.x += Math.max(-m, Math.min(m, dx));
      if (e.x > ROAD - 8) e.x = ROAD - 8;
      else if (e.x < -ROAD + 8) e.x = -ROAD + 8;
      if (!live) continue;
      const ddx = e.x - sq.x;
      const ddz = e.z - sq.z;
      const rr = this.R + e.r;
      if (ddx * ddx + ddz * ddz < rr * rr) {
        if (this.shieldT > 0) {
          this.killZombie(e, true);
          this.emit({ t: 'shieldHit', x: e.x, z: e.z });
        } else {
          this.killZombie(e, false);
          this.hurt(e.power, e.x, e.z);
          if (e.type === 'bloater') this.emit({ t: 'boom', x: e.x, z: e.z, r: 60, kind: 'bloat' });
        }
      }
    }
  }

  updateGates() {
    const sq = this.sq;
    for (const g of this.gates) {
      if (g.done) continue;
      if (g.z - sq.z < 1250) {
        if (g.h.some((h) => h && h.shoot)) this.see('shootGate');
        else this.see('gate');
      }
      for (const h of g.h) if (h && h.pulse > 0) h.pulse -= 1 / 60;
      if (sq.z >= g.z) {
        g.done = true;
        g.t = this.t;
        const side = sq.x < 0 ? 0 : 1;
        g.pick = side;
        const h = g.h[side];
        if (!h) continue;
        const good = gateGood(h);
        const before = sq.n;
        const after = Gen.apply(before, h);
        if (good) this.gatesGood++;
        this.emit({ t: 'gate', good, label: gateLabel(h), x: sq.x, z: sq.z, delta: after - before });
        this.setCount(after);
      }
    }
  }

  updateObjs(dt, live) {
    const sq = this.sq;
    for (const o of this.objs) {
      if (!o.alive) continue;
      if (o.flash > 0) o.flash -= dt;
      if (o.z - sq.z < 1200) this.see(o.kind);
      if (!live) continue;
      if (Math.abs(o.z - sq.z) < this.R * 0.5 + 12 && Math.abs(o.x - sq.x) < o.w + this.R * 0.75) {
        if (o.kind === 'crate') this.breakObj(o, false);
        else {
          if (this.shieldT <= 0) this.hurt(o.power, o.x, o.z);
          else this.emit({ t: 'shieldHit', x: o.x, z: o.z });
          this.breakObj(o, false);
        }
      }
    }
  }

  updateBoss(dt, live) {
    const b = this.boss;
    if (!b) return;
    b.ph += dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.atk > 0) b.atk -= dt;
    if (!b.alive) {
      if (this.t - b.deadT > 2.5) this.boss = null;
      return;
    }
    const sq = this.sq;
    if (b.z - sq.z < 1300) this.see('boss');
    if (!b.active || !live) return;
    const contact = this.R + b.r * 0.8;
    const dz = b.z - sq.z;
    if (dz > contact + 0.5) {
      b.z -= Math.min(dz - contact, b.spec.spd * dt);
      b.walking = true;
    } else b.walking = false;
    const dx = sq.x - b.x;
    b.x += Math.max(-40 * dt, Math.min(40 * dt, dx));
    // minions
    const mn = b.spec.minion;
    if (mn) {
      b.minT -= dt;
      if (b.minT <= 0) {
        b.minT = mn.every;
        for (let i = 0; i < mn.count; i++) {
          this.addZombie(mn.type, Math.max(-ROAD + 10, Math.min(ROAD - 10, b.x + rnd(-110, 110))), b.z - b.r - rnd(10, 60), mn.hp, mn.power);
          const e = this.zombies[this.zombies.length - 1];
          e.active = true;
        }
        this.emit({ t: 'summon', x: b.x, z: b.z });
      }
    }
    // stomp attack when touching the squad
    if (!b.walking) {
      b.contactT = (b.contactT || 0) + dt;
      b.stompT -= dt;
      if (b.stompT <= 0) {
        b.stompT = 1.25;
        b.atk = 0.35;
        this.emit({ t: 'stomp', x: b.x, z: b.z - b.r });
        // always at least one soldier; enrages the longer the fight lasts
        this.hurt(Math.max(b.spec.power * (1 + b.contactT / 10), this.lo.hp * 1.01), b.x, b.z - b.r);
      }
    }
  }

  updateHero(dt, live) {
    const h = this.hero;
    const sq = this.sq;
    if (h && live && h.cd > 0) h.cd = Math.max(0, h.cd - dt);
    if (this.shieldT > 0) this.shieldT = Math.max(0, this.shieldT - dt);
    if (this.strikes.length) {
      const rest = [];
      for (const s of this.strikes) {
        if (this.t >= s.t) this.booms.push({ x: s.x, z: sq.z + s.dz, r: s.r, dmg: s.dmg, kind: 'bomb', bossMul: 0.12 });
        else rest.push(s);
      }
      this.strikes = rest;
    }
    if (this.missiles.length) {
      const rest = [];
      for (const m of this.missiles) {
        if (m.target && m.target.alive !== false) {
          m.tx = m.target.x;
          m.tz = m.target.z;
        }
        const u = Math.min(1, (this.t - m.t0) / m.dur);
        m.px = m.x;
        m.pz = m.z;
        m.py = m.y;
        m.x = m.x0 + (m.tx - m.x0) * u;
        m.z = m.z0 + (m.tz - m.z0) * u;
        m.y = 20 + Math.sin(Math.PI * u) * 260;
        if (u >= 1) this.booms.push({ x: m.tx, z: m.tz, r: m.r, dmg: m.dmg, kind: 'missile', bossMul: 0.35 });
        else rest.push(m);
      }
      this.missiles = rest;
    }
  }
}
