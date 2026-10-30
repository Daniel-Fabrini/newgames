// Pure simulation tests:  node --test games/squad/tests/sim.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, MAXD } from '../sim.js';
import { Gen } from '../gen.js';
import * as D from '../data.js';

const LO = { startN: 5, dmg: 1, rate: 1, hp: 1, rank: 0 };
const NOM = { startN: 5, dmg: 1, rate: 1 };
const mk = (o = {}) => new World({ mode: 'campaign', level: 1, seed: 1234, lo: { ...LO }, nom: { ...NOM }, hero: null, ...o });
const strip = (w) => JSON.stringify({
  crates: w.crates.map((c) => [c.x, c.z, c.v]),
  pickups: w.pickups.map((p) => [p.x, p.z, p.tier, p.hp]),
  statues: w.statues.map((p) => [p.x, p.z, p.kind, p.hp]),
  rings: w.rings.map((r) => [r.x, r.z, r.kind, r.p]),
  waves: w.waves.map((v) => [v.z, v.count, v.rate, v.cx, v.hu, v.extra, v.boss && v.boss.hp]),
});
// clear everything generated so a test can place its own objects
const empty = (w) => {
  w.crates.length = w.pickups.length = w.statues.length = w.rings.length = w.waves.length = 0;
  w.gen.done = true;
  w.start();
  w.events.length = 0;
};

test('level generation is deterministic for a seed', () => {
  for (const level of [1, 7, 23]) {
    const a = mk({ level, seed: level * 7919 + 13 });
    const b = mk({ level, seed: level * 7919 + 13 });
    assert.equal(strip(a), strip(b));
    assert.ok(a.crates.length > 5 && a.waves.length >= 2);
  }
  assert.notEqual(strip(mk({ seed: 1 })), strip(mk({ seed: 2 })));
});

test('spawning and the whole run are deterministic for a seed', () => {
  const run = () => {
    const w = mk({ level: 5, seed: 99 });
    w.start();
    for (let i = 0; i < 60 * 25; i++) {
      w.steer(Math.sin(i / 90) * 3);
      w.update(1 / 60);
      w.events.length = 0;
    }
    return JSON.stringify([w.sq.n, w.sq.z.toFixed(4), w.kills, w.enemies.length, w.enemies.slice(0, 20).map((e) => [e.x.toFixed(4), e.z.toFixed(4), e.hp.toFixed(4)])]);
  };
  assert.equal(run(), run());
});

test('every campaign level ends with a boss and survival never ends', () => {
  const w = mk({ level: 10, seed: 5 });
  w.gen.fill(w, 1e4);
  assert.ok(w.gen.done);
  assert.ok(w.waves.some((v) => v.boss && v.boss.final && v.boss.mega));
  const g = new Gen({ mode: 'endless', level: 1, seed: 3, nom: NOM });
  const sink = { sq: { n: 10, tier: 0 }, addCrate() {}, addPickup() {}, addStatue() {}, addRing() {}, waves: [], addWave(v) { this.waves.push(v); } };
  g.fill(sink, 5000);
  assert.ok(!g.done);
  assert.ok(sink.waves.filter((v) => v.boss).length >= 15);
  // difficulty escalates with distance
  const hu = sink.waves.filter((v) => !v.boss).map((v) => v.rate);
  assert.ok(hu[hu.length - 1] > hu[0]);
});

test('weapon and damage maths', () => {
  assert.equal(D.weaponDps(0), D.WEAPONS[0].dmg * D.WEAPONS[0].rate);
  assert.ok(D.weaponDps(D.MAX_TIER + 1) > D.weaponDps(D.MAX_TIER) * 1.29);
  for (let t = 1; t <= D.MAX_TIER; t++) assert.ok(D.weaponDps(t) > D.weaponDps(t - 1));
  const w = mk({ lo: { ...LO, dmg: 1.5, rate: 1.2 } });
  empty(w);
  const base = w.soldierDps();
  assert.ok(Math.abs(base - 3.2 * 1.5 * 1.2) < 1e-9);
  w.sq.dmgMul = 1.3;
  assert.ok(Math.abs(w.soldierDps() - base * 1.3) < 1e-9);
  assert.ok(Math.abs(w.dps() - w.sq.n * w.soldierDps()) < 1e-9);
});

test('bullets hit the first enemy in their column and kill it', () => {
  const w = mk();
  empty(w);
  w.setCount(1);
  const far = w.spawnEnemy('grunt', 0, 20, 1, {});
  const near = w.spawnEnemy('grunt', 0, 12, 1, {});
  const side = w.spawnEnemy('grunt', 3.5, 11, 1, {});
  far.spd = near.spd = side.spd = 0;
  w.sq.speed = 0;
  for (let i = 0; i < 40 && near.alive; i++) w.update(1 / 60);
  assert.equal(near.alive, false);
  assert.equal(far.alive, true);
  assert.equal(side.alive, true);
  assert.ok(w.kills === 1 && w.coins > 0);
  assert.ok(w.events.some((e) => e.t === 'kill'));
});

test('enemies touching the squad kill soldiers; defeat at zero', () => {
  const w = mk();
  empty(w);
  w.setCount(3);
  for (let i = 0; i < 3; i++) {
    const e = w.spawnEnemy('grunt', w.sq.x, w.sq.z + 0.2, 1e9, {});
    e.spd = 0;
  }
  w.update(1 / 60);
  assert.equal(w.sq.n, 0);
  assert.equal(w.state, 'lost');
  assert.ok(w.events.some((e) => e.t === 'lose'));
});

test('soldier health from upgrades absorbs hits', () => {
  const w = mk({ lo: { ...LO, hp: 2 } });
  empty(w);
  w.setCount(4);
  w.hurt(1, 0, 0);
  assert.equal(w.sq.n, 4);
  w.hurt(1, 0, 0);
  assert.equal(w.sq.n, 3);
});

test('+N crates and power-up rings', () => {
  const w = mk();
  empty(w);
  const n0 = w.sq.n;
  w.addCrate(w.sq.x, w.sq.z + 0.2, 1);
  w.addCrate(w.sq.x, w.sq.z + 0.3, 2);
  w.addRing(w.sq.x, w.sq.z + 0.1, 'dmg', 30);
  w.addRing(w.sq.x, w.sq.z + 0.2, 'rate', 20);
  w.update(1 / 60);
  assert.equal(w.sq.n, n0 + 3);
  assert.equal(w.cratesGot, 2);
  assert.ok(Math.abs(w.sq.dmgMul - 1.3) < 1e-9);
  assert.ok(Math.abs(w.sq.rateMul - 1.2) < 1e-9);
  // formation is capped but the count is not
  w.setCount(500);
  assert.equal(w.sol.length, MAXD);
  assert.equal(w.sq.n, 500);
});

test('shooting a weapon pedestal to zero upgrades the squad weapon', () => {
  const w = mk();
  empty(w);
  w.addPickup(w.sq.x, w.sq.z + 8, 1, 20);
  const p = w.pickups[0];
  let t = 0;
  while (p.alive && t < 20) {
    w.update(1 / 60);
    t += 1 / 60;
  }
  assert.equal(p.alive, false);
  assert.equal(w.sq.tier, 1);
  assert.ok(w.events.some((e) => e.t === 'weapon' && e.tier === 1));
  assert.ok(t < 5, 'took ' + t);
});

test('a golden statue comes alive at 0 HP and fights for the squad', () => {
  const w = mk();
  empty(w);
  const dps0 = w.dps();
  w.addStatue(w.sq.x, w.sq.z + 9, 'heavy', 30);
  let t = 0;
  while (w.statues[0] && w.statues[0].alive && t < 20) {
    w.update(1 / 60);
    t += 1 / 60;
  }
  assert.equal(w.sq.heroes.length, 1);
  assert.equal(w.sq.heroes[0].kind, 'heavy');
  assert.ok(w.events.some((e) => e.t === 'heroJoin'));
  assert.ok(Math.abs(w.dps() - (dps0 + D.STATUES.heavy.dpsK * w.soldierDps())) < 1e-6);
  // heroes soak hits after the soldiers are gone
  w.setCount(0);
  w.hurt(1, 0, 0);
  assert.equal(w.state, 'run');
  assert.ok(w.sq.heroes[0].hp < D.STATUES.heavy.hp);
});

function autoplay(w, secs) {
  w.start();
  for (let i = 0; i < 60 * secs && w.state === 'run'; i++) {
    const sq = w.sq;
    const close = w.enemies.filter((e) => e.alive && e.z - sq.z < 9);
    const it = [...w.pickups, ...w.statues].find((p) => p.alive && p.z - sq.z < 30 && p.z > sq.z);
    const rg = w.rings.find((g) => g.alive && g.z - sq.z < 8 && g.z > sq.z);
    const cr = w.crates.find((c) => c.alive && c.z - sq.z < 6 && c.z > sq.z);
    let tx = 0;
    if (close.length > 2) tx = close.reduce((a, e) => a + e.x, 0) / close.length;
    else if (rg) tx = rg.x;
    else if (it) tx = it.x;
    else if (cr) tx = cr.x;
    w.steer(tx);
    w.update(1 / 60);
    w.events.length = 0;
  }
  return w;
}

test('level completion: a well-played early level is won by beating the boss', () => {
  for (const level of [1, 2, 4]) {
    const n = D.nominalStats(level);
    const nom = { startN: n.startN, dmg: n.dmg, rate: n.rate / 2.6 };
    const w = autoplay(new World({ mode: 'campaign', level, seed: level * 7919 + 13, lo: { ...nom, hp: n.hp, rank: 0 }, nom, hero: null }), 240);
    assert.equal(w.state, 'won', `level ${level}`);
    assert.equal(w.bossKills, 1);
    assert.ok(w.sq.z >= w.length);
  }
});

test('defeat: standing in the lane without upgrades loses a later level', () => {
  const n = D.nominalStats(12);
  const nom = { startN: n.startN, dmg: n.dmg, rate: n.rate / 2.6 };
  const w = new World({ mode: 'campaign', level: 12, seed: 7, lo: { startN: 3, dmg: 1, rate: 1, hp: 1, rank: 0 }, nom, hero: null });
  w.start();
  for (let i = 0; i < 60 * 240 && w.state === 'run'; i++) {
    w.steer(-0.5);
    w.update(1 / 60);
    w.events.length = 0;
  }
  assert.equal(w.state, 'lost');
});

test('meta hero abilities fire and recharge', () => {
  for (const id of ['tank', 'jet', 'missile']) {
    const w = mk({ hero: { id, lvl: 3, tower: 2 } });
    empty(w);
    for (let i = 0; i < 30; i++) w.spawnEnemy('grunt', (i % 5) - 2, 12 + i * 0.3, 5, {}).spd = 0;
    assert.equal(w.useAbility(), true);
    assert.equal(w.useAbility(), false);
    for (let i = 0; i < 120; i++) w.update(1 / 60);
    assert.ok(w.events.some((e) => e.t === 'boom'), id);
  }
});

test('perf: a tick with 400 enemies, 60 soldiers and full fire stays cheap', () => {
  const w = mk({ level: 20 });
  empty(w);
  w.setCount(200);
  w.sq.tier = 4;
  for (let i = 0; i < 400; i++) {
    const e = w.spawnEnemy(i % 7 ? 'grunt' : 'shield', (Math.random() - 0.5) * 8, 14 + (i / 400) * 40, 1e6, {});
    e.spd = 0.01;
  }
  w.spawnEnemy('brute', 0, 30, 1e9, {});
  for (let i = 0; i < 60; i++) w.update(1 / 60); // warm up: bullets in flight
  const N = 300;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    w.update(1 / 60);
    w.events.length = 0;
  }
  const ms = (performance.now() - t0) / N;
  assert.ok(w.enemies.length >= 400);
  assert.ok(w.bullets.length > 150, 'bullets ' + w.bullets.length);
  assert.ok(ms < 2.5, `tick took ${ms.toFixed(3)} ms`);
  console.log(`  400-unit tick: ${ms.toFixed(3)} ms, ${w.bullets.length} bullets`);
});

test('save defaults and migration keep meta progression', () => {
  const s = D.defaultSave(0);
  assert.equal(s.v, D.SAVE_VERSION);
  const m = D.migrateSave({ ...s, gold: 999, level: 7, bld: { ...s.bld, arms: 4 } }, 0);
  assert.equal(m.gold, 999);
  assert.equal(m.level, 7);
  assert.equal(m.bld.arms, 4);
  const st = D.playerStats(m);
  assert.ok(st.dmg > 1);
  assert.equal(D.themeFor(1).id, 'canyon');
  assert.equal(D.bossFor(1).id, 'juggernaut');
});
