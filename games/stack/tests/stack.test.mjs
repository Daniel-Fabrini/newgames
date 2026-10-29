// node --test games/stack/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Body, World, boxBox } from '../phys.js';
import { createSim, LAYERS, H, W, L } from '../sim.js';

const block = (p, odd = false) =>
  new Body({ pos: p, quat: odd ? [0, Math.SQRT1_2, 0, Math.SQRT1_2] : [0, 0, 0, 1], half: [L / 2, H / 2, W / 2], mass: 1 });

test('box/box: crossing blocks give a 4 point manifold with an upward normal', () => {
  const m = boxBox(block([0, 0.3, 0]), block([0, 0.895, 0], true));
  assert.ok(m);
  assert.equal(m.pts.length, 4);
  assert.ok(m.n[1] > 0.99);
  for (const p of m.pts) assert.ok(Math.abs(Math.abs(p.p[0]) - 0.5) < 1e-6 && Math.abs(Math.abs(p.p[2]) - 0.5) < 1e-6);
});

test('box/box: separated blocks do not collide, order of A and B flips the normal', () => {
  assert.equal(boxBox(block([0, 0.3, 0]), block([0, 2, 0])), null);
  const m = boxBox(block([0, 0.895, 0], true), block([0, 0.3, 0]));
  assert.ok(m.n[1] < -0.99);
});

test('box/box: a tilted block resting on an edge uses edge/edge or face contacts without NaN', () => {
  const a = block([0, 0.3, 0]);
  const b = block([0, 0.9, 0]);
  b.setQuat([0.2, 0.3, 0.1, 0.9]);
  const m = boxBox(a, b);
  if (m) for (const p of m.pts) assert.ok(p.p.every(Number.isFinite) && Number.isFinite(p.depth));
});

test('a dropped block lands on the ground, stops and sleeps', () => {
  const w = new World({ gravity: [0, -40, 0] });
  w.add(new Body({ pos: [0, -1, 0], half: [20, 1, 20], isStatic: true, friction: 0.8 }));
  const b = w.add(block([0, 2, 0]));
  for (let i = 0; i < 240; i++) w.step(1 / 60);
  assert.ok(Math.abs(b.p[1] - H / 2) < 0.03, 'rests on its largest face, y=' + b.p[1]);
  assert.ok(w.asleep);
});

for (const diff of ['steady', 'normal', 'wobbly']) {
  test(`the ${diff} tower stands by itself and goes to sleep`, () => {
    const sim = createSim(diff);
    sim.settle(1);
    let k = 0;
    while (!sim.asleep && k++ < 600) sim.stepOnce();
    assert.ok(sim.asleep, 'tower comes to rest');
    assert.equal(sim.collapsed(), null);
    for (const b of sim.blocks) {
      const q = sim.slotPos(b.layer, b.slot);
      assert.ok(Math.hypot(b.body.p[0] - q[0], b.body.p[2] - q[2]) < 0.3, 'no block drifted');
      assert.ok(b.body.up()[1] > 0.99, 'no block tilted');
    }
    assert.equal(sim.blocks.length, 54 - sim.diff.removed);
  });
}

test('which blocks can be taken: nothing in the top complete layer or above', () => {
  const sim = createSim('normal');
  const get = (l, s) => sim.blocks.find((b) => b.layer === l && b.slot === s);
  assert.equal(sim.canTake(get(LAYERS - 1, 1)), false);
  assert.equal(sim.canTake(get(LAYERS - 2, 1)), true);
  assert.equal(sim.canTake(get(0, 0)), true);
});

test('pull a block out, it is lifted onto the top layer, the tower survives', () => {
  const sim = createSim('steady');
  sim.settle(1);
  while (!sim.asleep) sim.stepOnce();
  const b = sim.blocks.find((o) => o.layer === 12 && o.slot === 1);
  const pull = sim.beginPull(b);
  let t = 0;
  let out = false;
  for (let i = 0; i < 60 * 10 && !out; i++) {
    t += 1 / 60;
    sim.setPullTarget(t * 1.5);
    sim.stepOnce();
    out = sim.isClear(b);
  }
  assert.ok(out, 'block came out (along=' + pull.along.toFixed(2) + ')');
  assert.equal(sim.collapsed(), null);
  const spot = sim.placeSpot();
  assert.equal(spot.layer, LAYERS);
  let dropped = false;
  sim.lift(b, spot, () => (dropped = true));
  let k = 0;
  while (!(dropped && sim.asleep) && k++ < 60 * 20) sim.stepOnce();
  assert.ok(dropped && sim.asleep, 'placed and at rest');
  assert.equal(sim.collapsed(), null);
  assert.equal(sim.topLayerInfo().top, LAYERS);
  assert.equal(b.layer, LAYERS);
});

test('removing the base blocks makes the tower fall and collapse is detected', () => {
  const sim = createSim('normal');
  sim.settle(0.5);
  for (const [l, s] of [[0, 1], [0, 2], [1, 0], [1, 1]]) sim.removeBlock(sim.blocks.find((o) => o.layer === l && o.slot === s));
  sim.world.wake();
  let hit = null;
  for (let i = 0; i < 60 * 6 && !hit; i++) {
    sim.stepOnce();
    hit = sim.collapsed();
  }
  assert.ok(hit, 'collapse detected');
});

test('save / restore keeps the tower standing', () => {
  const a = createSim('normal');
  a.settle(1);
  while (!a.asleep) a.stepOnce();
  const saved = JSON.parse(JSON.stringify(a.serialize()));
  const b = createSim('normal', saved);
  for (let i = 0; i < 180; i++) b.stepOnce();
  assert.equal(b.blocks.length, 54);
  assert.equal(b.collapsed(), null);
  const x = a.blocks.find((o) => o.layer === 10 && o.slot === 1).body.p;
  const y = b.blocks.find((o) => o.layer === 10 && o.slot === 1).body.p;
  assert.ok(Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 0.15);
});
