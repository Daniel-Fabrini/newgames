// Run with: node games/soccer/formations.test.mjs
import assert from 'node:assert/strict';
import { FORMATIONS, FORMATION_IDS, layoutFormation, validLayout, validMatchup, pickFormations, makeAiStyle, hashSeed, rng } from './formations.js';
import * as P from './physics.js';
import { thinkNow } from './ai.js';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('ok -', name);
};

ok('every base formation is valid, has 4 outfield discs and a keeper behind', () => {
  assert.ok(FORMATIONS.length >= 6);
  for (const f of FORMATIONS) {
    assert.equal(f.pts.length, 4, f.id);
    const l = layoutFormation(f.id);
    assert.equal(l.length, 5);
    assert.ok(validLayout(l), 'base ' + f.id);
    for (const [, y] of l.slice(1)) assert.ok(y < l[0][1], 'keeper behind ' + f.id);
  }
});

ok('jittered layouts stay valid, inside own half, non-overlapping (many seeds)', () => {
  for (const id of FORMATION_IDS)
    for (let seed = 1; seed <= 300; seed++) {
      const l = layoutFormation(id, rng(seed));
      assert.ok(validLayout(l), `${id} seed ${seed}`);
      for (const [x, y] of l) assert.ok(y > P.L / 2 && x > P.CAP_R && x < P.W - P.CAP_R);
    }
});

ok('both sides together never overlap (all pairs, reflected)', () => {
  for (const a of FORMATION_IDS)
    for (const b of FORMATION_IDS) for (let s = 1; s <= 20; s++) assert.ok(validMatchup(layoutFormation(a, rng(s)), layoutFormation(b, rng(s + 99))), `${a} vs ${b}`);
});

ok('deterministic by seed', () => {
  for (const seed of [1, 7, 12345, 4000000000]) {
    assert.deepEqual(pickFormations(rng(seed)), pickFormations(rng(seed)));
    assert.deepEqual(layoutFormation('2-1-1', rng(seed)), layoutFormation('2-1-1', rng(seed)));
    assert.deepEqual(makeAiStyle(rng(seed)), makeAiStyle(rng(seed)));
  }
  assert.equal(hashSeed(1, 2, 'a'), hashSeed(1, 2, 'a'));
  assert.notEqual(hashSeed(1, 2, 'a'), hashSeed(1, 3, 'a'));
});

ok('variety across seeds (every formation shows up for both sides, many distinct pairs)', () => {
  const seen = [new Set(), new Set()];
  const pairs = new Set();
  for (let s = 0; s < 400; s++) {
    const p = pickFormations(rng(hashSeed(42, s)));
    p.forEach((id, i) => seen[i].add(id));
    pairs.add(p.join('|'));
  }
  assert.equal(seen[0].size, FORMATION_IDS.length);
  assert.equal(seen[1].size, FORMATION_IDS.length);
  assert.ok(pairs.size >= 30, 'pairs ' + pairs.size);
});

ok('lock fixes your side only; prev formation is avoided', () => {
  const sides = new Set();
  for (let s = 0; s < 100; s++) {
    const p = pickFormations(rng(s), { lock: '3-1' });
    assert.equal(p[0], '3-1');
    sides.add(p[1]);
  }
  assert.ok(sides.size > 3);
  for (let s = 0; s < 100; s++) {
    const p = pickFormations(rng(s), { prev: ['2-2', '1-3'] });
    assert.notEqual(p[0], '2-2');
    assert.notEqual(p[1], '1-3');
  }
  assert.equal(pickFormations(rng(1), { lock: 'bogus' })[0] !== 'bogus', true);
});

ok('AI style is bounded and fills the three labels', () => {
  const labels = new Set();
  for (let s = 0; s < 200; s++) {
    const a = makeAiStyle(rng(s));
    assert.ok(a.aggr >= -1 && a.aggr <= 1 && a.jit >= 0.9 && a.jit <= 1.3 && Math.abs(a.aimShift) <= 3.5);
    labels.add(a.label);
  }
  assert.equal(labels.size, 3);
});

ok('physics world uses the layouts and resets to them (team 1 mirrored)', () => {
  const forms = [layoutFormation('3-1'), layoutFormation('1-1-2')];
  const w = P.createWorld(forms);
  const check = () => {
    for (let t = 0; t < 2; t++)
      forms[t].forEach(([x, y], i) => {
        const c = w.bodies[1 + t * 5 + i];
        assert.equal(c.x, t ? P.W - x : x);
        assert.equal(c.y, t ? P.L - y : y);
      });
  };
  check();
  w.bodies[3].x = 5;
  w.bodies[0].x = 10;
  P.resetPositions(w);
  check();
  const f2 = [layoutFormation('2-2', rng(3)), layoutFormation('1-3', rng(4))];
  P.resetPositions(w, f2);
  assert.equal(w.bodies[6].x, P.W - f2[1][0][0]);
  assert.equal(P.createWorld().bodies.length, 11); // default call still works
});

ok('CPU can think (with a style) in every formation without overlap at the start', () => {
  for (const id of FORMATION_IDS) {
    const w = P.createWorld([layoutFormation(id, rng(5)), layoutFormation(id, rng(6))]);
    const r = thinkNow(w, 1, 2, rng(9), makeAiStyle(rng(2)));
    assert.ok(r.idx >= 6 && r.idx <= 10 && Number.isFinite(r.a));
  }
});

console.log(`${n} tests passed`);
