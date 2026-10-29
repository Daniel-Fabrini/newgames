// node --test games/goo/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, replay, playSolution, TYPES, TYPE_IDS, G, DT } from '../sim.js';
import { LEVELS, WORLDS, SANDBOX, levelById } from '../levels.js';
import STRINGS from '../strings.js';
import SOL from '../solutions.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const arena = (extra = {}) => ({
  id: 't', world: 1, bounds: [0, 0, 720, 900], killY: 900,
  terrain: [rect(-200, 620, 220, 1500), rect(480, 620, 920, 1500)],
  anchors: [[40, 612], [100, 612], [160, 612]],
  pipe: { x: 600, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 1, stock: { goo: 30, heavy: 10, balloon: 5, tacky: 5, stake: 5 }, stars: [10, 12],
  ...extra,
});
const settle = (sim, n = 600) => {
  let w = 0;
  while (sim.calm < 30 && w++ < n) sim.step();
};
const key = (sim) => JSON.stringify(sim.nodes.map((n) => [n.id, n.alive, +n.x.toFixed(6), +n.y.toFixed(6)]));

test('a goo dropped near the anchors attaches to the nearest points and the structure settles', () => {
  const s = new Sim(arena());
  const r = s.place('goo', 100, 540);
  assert.ok(r.ok);
  assert.ok(r.links.length >= 2);
  settle(s);
  assert.ok(s.calm >= 30);
  const n = r.node;
  assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
  assert.ok(n.y < 612, 'hangs above the ground on its strands');
});

test('a small triangulated cantilever stays up (no snaps, bounded sag)', () => {
  const s = new Sim(arena());
  const seq = [[100, 540], [170, 540], [160, 470], [230, 520], [240, 450]];
  for (const [x, y] of seq) {
    assert.ok(s.place('goo', x, y).ok, `place ${x},${y}`);
    settle(s);
  }
  s.step(300);
  assert.equal(s.strands.filter((q) => q.alive).length, s.strands.length);
  assert.equal(s.lost, 0);
  for (const n of s.nodes) assert.ok(n.alive && n.y < 700, 'node ' + n.id + ' fell');
});

test('an overloaded hanging chain of heavy stones snaps and the stones are lost', () => {
  const lv = arena({ terrain: [], anchors: [[150, 100]], killY: 1000, pipe: { x: 800, y: 600, r: 32 } });
  const s = new Sim(lv);
  let snaps = 0;
  for (const y of [225, 350, 475, 600, 725]) {
    const r = s.place('heavy', 150, y);
    if (!r.ok) break;
    s.step(90);
    snaps += s.events.filter((e) => e.k === 'snap').length;
  }
  s.step(500);
  snaps += s.events.filter((e) => e.k === 'snap').length;
  assert.ok(snaps > 0, 'something snapped');
  assert.ok(s.lost > 0 || s.nodes.some((n) => n.alive && n.y > 800), 'stones fell');
});

test('energy and speeds stay bounded (no explosion) under random building', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const s = new Sim(arena({ stock: { goo: 60, heavy: 20, balloon: 10, tacky: 5, stake: 5 } }));
  let maxSpeed = 0;
  for (let i = 0; i < 40; i++) {
    const type = TYPE_IDS[(rnd() * 3) | 0];
    for (let tries = 0; tries < 20; tries++) {
      const ns = s.nodes.filter((n) => n.alive);
      const base = ns[(rnd() * ns.length) | 0];
      const r = s.place(type, base.x + (rnd() - 0.5) * 220, base.y - rnd() * 150);
      if (r.ok) break;
    }
    for (let k = 0; k < 90; k++) {
      s.step();
      for (const n of s.nodes) {
        if (!n.alive) continue;
        assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), 'finite');
        maxSpeed = Math.max(maxSpeed, Math.hypot(n.vx, n.vy));
      }
    }
  }
  assert.ok(maxSpeed <= 1300 + 1, 'speed clamp ' + maxSpeed);
  assert.ok(Number.isFinite(s.energy()));
  settle(s, 2000);
  // after settling nothing is flying around
  for (const n of s.nodes) if (n.alive && !n.fixed) assert.ok(Math.hypot(n.vx, n.vy) < 40 || s.calm < 30, 'still moving');
});

test('simulation is deterministic: same inputs give identical states', () => {
  const run = () => {
    const s = new Sim(arena());
    for (const [x, y] of [[100, 540], [170, 540], [160, 470], [230, 520]]) {
      s.place('goo', x, y);
      s.step(77);
    }
    s.place('balloon', 200, 430);
    s.step(300);
    return key(s);
  };
  assert.equal(run(), run());
});

test('attach selection: nearest nodes, reach limit, spacing, terrain blocking, line of sight, stake needs ground', () => {
  const s = new Sim(arena());
  let pv = s.preview('goo', 100, 540);
  assert.ok(pv.valid);
  assert.ok(pv.links.length >= 2 && pv.links.length <= 3);
  // sorted by distance
  for (let i = 1; i < pv.links.length; i++) assert.ok(pv.links[i].d >= pv.links[i - 1].d);
  assert.equal(s.preview('goo', 400, 400).reason, 'far');
  assert.equal(s.preview('goo', 100, 606).reason, 'close');
  assert.equal(s.preview('goo', 100, 660).reason, 'blocked');
  assert.equal(s.preview('stake', 100, 300).reason, 'noground');
  const sp = s.preview('stake', -100, 640);
  assert.ok(sp.valid, 'stake snaps onto the terrain surface');
  assert.ok(Math.abs(sp.y - 620) < 14);
  // line of sight: a slab between the goo and the anchors blocks the strands
  const open = new Sim(arena({ anchors: [[100, 612], [160, 612]] }));
  assert.equal(open.preview('goo', 130, 500).valid, true);
  const slab = new Sim(arena({ anchors: [[100, 612], [160, 612]], terrain: [rect(-200, 620, 220, 1500), rect(60, 545, 200, 575)] }));
  assert.equal(slab.preview('goo', 130, 500).valid, false, 'no strand may cross the slab');
  // stock exhaustion
  const s3 = new Sim(arena({ stock: { goo: 1 } }));
  assert.ok(s3.place('goo', 100, 540).ok);
  assert.equal(s3.preview('goo', 170, 540).reason, 'stock');
});

test('only tacky goo can be removed and removing refunds the piece', () => {
  const s = new Sim(arena());
  const a = s.place('tacky', 100, 540).node;
  const b = s.place('goo', 170, 540).node;
  assert.equal(s.used, 2);
  assert.equal(s.canRemove(b.id), false);
  assert.equal(s.canRemove(a.id), true);
  assert.ok(s.removeNode(a.id));
  assert.equal(s.used, 1);
  assert.equal(s.left.tacky, 5);
  assert.equal(a.alive, false);
});

test('undo restores the exact previous state, restart yields a fresh sim', () => {
  const s = new Sim(arena());
  s.place('goo', 100, 540);
  s.step(120);
  const before = JSON.stringify(s.snapshot());
  s.place('goo', 170, 540);
  s.step(50);
  assert.ok(s.undo());
  assert.equal(JSON.stringify(s.snapshot()), before);
  assert.equal(s.log.length, 1);
  assert.equal(s.used, 1);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
  const fresh = new Sim(arena());
  assert.equal(JSON.stringify(s.snapshot().nodes.length), JSON.stringify(fresh.snapshot().nodes.length));
});

test('save/restore: snapshot round trip and replaying the saved log reproduces the state', () => {
  const lv = arena();
  const s = new Sim(lv);
  for (const [x, y] of [[100, 540], [170, 540], [160, 470]]) {
    s.place('goo', x, y);
    s.step(60);
  }
  const t = s.addTacky ? 0 : 0;
  void t;
  s.place('tacky', 230, 520);
  s.step(100);
  const snap = JSON.parse(JSON.stringify(s.snapshot()));
  const s2 = new Sim(lv);
  s2.restore(snap);
  s.step(100);
  s2.step(100);
  assert.equal(key(s), key(s2));
  // log (as saved in ctx.store: JSON) replays to the same state
  const log = JSON.parse(JSON.stringify(s.log));
  const r = replay(lv, log);
  r.step(s.time - r.time);
  assert.equal(key(r), key(s));
});

test('goals: height goal wins when held; running out of goo loses', () => {
  const lv = arena({ pipe: undefined, goal: { type: 'height', y: 575, base: 620 }, stock: { goo: 3 } });
  const s = new Sim(lv);
  s.place('goo', 100, 530);
  settle(s);
  s.place('goo', 160, 520);
  settle(s);
  s.step(200);
  assert.equal(s.status, 'won');
  const lv2 = arena({ stock: { goo: 1 } });
  const s2 = new Sim(lv2);
  s2.place('goo', 100, 540);
  s2.step(400);
  assert.equal(s2.status, 'lost');
});

test('hazards kill goo: spikes and the kill line', () => {
  const lv = arena({ hazards: [{ kind: 'spikes', dir: 'up', pts: rect(220, 700, 480, 760) }], killY: 900 });
  const s = new Sim(lv);
  s.place('goo', 100, 540);
  s.place('goo', 175, 470);
  s.nodes.find((n) => n.type === 'goo' && n.alive).y = 720;
  s.nodes.find((n) => n.type === 'goo' && n.alive).x = 300;
  s.step(2);
  assert.ok(s.lost >= 1, 'spike popped a goo');
});

test('moving platforms, pendulums and wind are simulated and deterministic', () => {
  const lv = arena({
    movers: [{ pts: rect(-50, -14, 50, 14), cx: 350, cy: 560, ax: 60, ay: 30, period: 4, phase: 0 }],
    pendulums: [{ px: 350, py: 150, len: 300, r: 30, amp: 0.7, period: 3, phase: 0 }],
    winds: [{ x: 200, y: 300, w: 300, h: 500, fx: 300, fy: 0, period: 3 }],
  });
  const run = () => {
    const s = new Sim(lv);
    s.place('goo', 100, 540);
    s.step(400);
    return key(s) + s.time;
  };
  assert.equal(run(), run());
  const s = new Sim(lv);
  const p0 = s.pendulumPos(lv.pendulums[0], 0), p1 = s.pendulumPos(lv.pendulums[0], 0.7);
  assert.notDeepEqual(p0, p1);
});

// ------------------------------------------------------------------ campaign data
test('campaign has 5 worlds x 6 levels with unique ids, strings in all languages', () => {
  assert.equal(LEVELS.length, 30);
  assert.equal(WORLDS.length, 5);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 30);
  for (const w of WORLDS) assert.equal(LEVELS.filter((l) => l.world === w.id).length, 6);
  for (const lang of ['pt', 'en', 'es']) {
    for (const l of LEVELS) assert.ok(STRINGS[lang]['lv_' + l.id], `${lang} name ${l.id}`);
    for (const w of WORLDS) assert.ok(STRINGS[lang][w.key]);
  }
  // pt/en/es have the same keys
  const keys = (o) => Object.keys(o).sort().join();
  assert.equal(keys(STRINGS.pt), keys(STRINGS.en));
  assert.equal(keys(STRINGS.pt), keys(STRINGS.es));
});

test('sandbox has no goal and unlimited stock', () => {
  const s = new Sim(SANDBOX, { sandbox: true });
  assert.equal(s.left.goo, Infinity);
  for (let i = 0; i < 3; i++) assert.ok(s.place('goo', 100 + i * 70, 540).ok);
  s.step(600);
  assert.equal(s.status, 'play');
});

for (const lv of LEVELS) {
  test(`level ${lv.id}: reference solution exists and wins headlessly`, () => {
    assert.ok(SOL[lv.id], 'missing solution for ' + lv.id);
    const sol = lv.solution;
    assert.ok(Array.isArray(sol) && sol.length > 0);
    const used = {};
    for (const p of sol) used[p.type] = (used[p.type] || 0) + 1;
    for (const [ty, n] of Object.entries(used)) assert.ok((lv.stock[ty] || 0) >= n, `stock of ${ty}`);
    assert.ok(lv.stars[0] <= lv.stars[1]);
    assert.equal(lv.stars[0], sol.length, 'three stars = reference solution length');
    const res = playSolution(lv, sol);
    assert.equal(res.error, undefined);
    assert.equal(res.sim.status, 'won', `${lv.id} solution must win (status ${res.sim.status})`);
    assert.equal(res.sim.stars(), 3);
    // the same solution also wins through the undo/replay path used by saves
    const again = replay(lv, res.sim.log);
    again.step(res.sim.time - again.time);
    assert.equal(again.status, 'won');
  });
}
