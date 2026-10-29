// Block Tower simulation: the tower, pulling, placing and collapse detection on top of phys.js.
// Pure module (no DOM) so it also runs in node tests. Units: block = W x H x L = 1 x 0.6 x 3.
import { World, Body } from './phys.js';

export const W = 1;
export const H = 0.6;
export const L = 3;
export const GAP = 0.012; // lateral gap between neighbours at the start
export const LAYERS = 18;
export const SLOTS = [-(W + GAP), 0, W + GAP];

// friction: wood on wood; pull: how much of it a block being pulled keeps (the "loose block" effect)
export const DIFFICULTY = {
  steady: { friction: 0.62, pull: 0.2, removed: 0 },
  normal: { friction: 0.5, pull: 0.2, removed: 0 },
  wobbly: { friction: 0.4, pull: 0.2, removed: 4 },
};

const GRAVITY = 40;
export const STEP = 1 / 60;
const QODD = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const QEVEN = [0, 0, 0, 1];

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function createSim(diffId = 'normal', saved = null) {
  const diff = DIFFICULTY[diffId] || DIFFICULTY.normal;
  const world = new World({ gravity: [0, -GRAVITY, 0] });
  world.substeps = 6;
  world.contactHertz = 60;
  world.contactDamping = 10;
  world.pushMax = 3;
  world.linDamp = 0.05;
  world.angDamp = 0.15;
  world.add(new Body({ pos: [0, -1, 0], half: [40, 1, 40], isStatic: true, friction: 0.9 }));

  const blocks = []; // { id, body, layer, slot, state: 'tower'|'hand'|'out', variant, loose }
  let nextId = 0;
  const events = { onImpact: null };
  world.onImpact = (speed, a, b) => {
    if (events.onImpact) events.onImpact(speed, a.userData || b.userData);
  };

  function addBlock(layer, slot, pos, quat) {
    const body = new Body({ pos, quat: quat || (layer % 2 === 1 ? QODD : QEVEN), half: [L / 2, H / 2, W / 2], mass: 1, friction: diff.friction });
    const id = nextId++;
    const b = { id, body, layer, slot, state: 'tower', variant: id % 3, loose: 0.55 + hash(id + 1) * 0.9 };
    body.userData = b;
    world.add(body);
    blocks.push(b);
    return b;
  }

  function slotPos(layer, slot) {
    const y = layer * (H + 0.004) + H / 2 + 0.002;
    return layer % 2 === 0 ? [0, y, SLOTS[slot]] : [SLOTS[slot], y, 0];
  }

  if (saved && saved.blocks) {
    for (const s of saved.blocks) addBlock(s.layer, s.slot, s.p.slice(), s.q.slice());
  } else {
    for (let l = 0; l < LAYERS; l++) for (let s = 0; s < 3; s++) addBlock(l, s, slotPos(l, s));
    // "wobbly": a few blocks are missing from the lower half from the start
    const holes = [[3, 1], [6, 1], [9, 1], [12, 1], [8, 0]].slice(0, diff.removed);
    for (const [l, s] of holes) {
      const b = blocks.find((o) => o.layer === l && o.slot === s);
      if (b) {
        world.remove(b.body);
        blocks.splice(blocks.indexOf(b), 1);
      }
    }
  }

  let acc = 0;
  const handlers = [];
  function stepOnce() {
    for (const h of handlers) h(STEP);
    world.step(STEP);
  }
  function update(dt) {
    acc += Math.min(dt, 0.05);
    let n = 0;
    while (acc >= STEP && n < 3) {
      stepOnce();
      acc -= STEP;
      n++;
    }
    if (n === 3) acc = 0;
  }

  // Highest layer index, how many blocks it holds and the highest complete layer.
  function topLayerInfo() {
    const count = new Map();
    for (const b of blocks) if (b.state === 'tower') count.set(b.layer, (count.get(b.layer) || 0) + 1);
    let top = -1;
    for (const l of count.keys()) top = Math.max(top, l);
    let complete = -1;
    for (const [l, n] of count) if (n >= 3) complete = Math.max(complete, l);
    return { top, topCount: count.get(top) || 0, complete, count };
  }

  const sim = {
    world, blocks, diff, events, handlers, update, stepOnce, addBlock, slotPos, topLayerInfo,
    get time() { return world.time; },
    get asleep() { return world.asleep; },
    // quality levels used by the frame-time governor: 0 best ... 2 cheapest
    setQuality(q) {
      const L = [[6, 60], [4, 40], [3, 30]][Math.max(0, Math.min(2, q))];
      world.substeps = L[0];
      world.contactHertz = L[1];
    },
    settle(sec = 1.5) { for (let i = 0; i < sec / STEP; i++) stepOnce(); },
    maxSpeed() { let m = 0; for (const b of blocks) m = Math.max(m, Math.hypot(b.body.v[0], b.body.v[1], b.body.v[2]), Math.hypot(b.body.w[0], b.body.w[1], b.body.w[2]) * 0.5); return m; },
    serialize() {
      const r4 = (n) => Math.round(n * 1e4) / 1e4;
      return { diff: diffId, blocks: blocks.filter((b) => b.state === 'tower').map((b) => ({ layer: b.layer, slot: b.slot, p: b.body.p.map(r4), q: b.body.q.map(r4) })) };
    },
    axisOf(b) {
      const a = b.body.ax[0];
      return [a[0], a[1], a[2]];
    },
  };

  // Is this block one the player may take? (not in the highest complete layer, nor above it)
  sim.canTake = (b) => {
    if (b.state !== 'tower') return false;
    const { complete, top } = topLayerInfo();
    if (b.layer >= complete) return false;
    if (top === complete) return b.layer < complete;
    return true;
  };

  // ---- pulling: a force-limited spring along the block's axis, so it really drags its neighbours
  let pull = null; // { b, axis, origin, target, along, maxForce }
  handlers.push(() => {
    if (!pull) return;
    const body = pull.b.body;
    world.wake();
    const along = (body.p[0] - pull.origin[0]) * pull.axis[0] + (body.p[2] - pull.origin[2]) * pull.axis[2];
    const vAlong = body.v[0] * pull.axis[0] + body.v[2] * pull.axis[2];
    let a = 70 * (pull.target - along) - 16 * vAlong;
    a = Math.max(-pull.maxForce, Math.min(pull.maxForce, a));
    body.f[0] += pull.axis[0] * a * body.mass;
    body.f[2] += pull.axis[2] * a * body.mass;
    pull.along = along;
  });
  sim.beginPull = (b) => {
    const ax = sim.axisOf(b);
    const len = Math.hypot(ax[0], ax[2]);
    pull = { b, axis: [ax[0] / len, 0, ax[2] / len], origin: [b.body.p[0], 0, b.body.p[2]], target: 0, along: 0, maxForce: 260 };
    b.state = 'hand';
    b.body.friction = diff.friction * (diff.pull * b.loose) ** 2;
    b.body.angDamp = 5;
    world.wake();
    return pull;
  };
  sim.setPullTarget = (v) => {
    if (pull) pull.target = Math.max(-(L * 1.2), Math.min(L * 1.2, v));
  };
  sim.pullState = () => pull;
  sim.endPull = () => {
    if (pull) {
      pull.b.body.friction = diff.friction;
      pull.b.body.angDamp = 0;
      if (pull.b.state === 'hand') pull.b.state = 'tower';
    }
    pull = null;
  };
  // Block is fully out when its centre is beyond the footprint by half its length.
  sim.isClear = (b) => Math.max(Math.abs(b.body.p[0]), Math.abs(b.body.p[2])) > L + 0.05;

  // ---- placing on top
  sim.placeSpot = () => {
    const { top, topCount } = topLayerInfo();
    let layer = top;
    let surface = 0;
    for (const b of blocks) if (b.state === 'tower' && b.layer === top) surface = Math.max(surface, b.body.p[1] + H / 2);
    let slot;
    if (topCount >= 3 || top < 0) {
      layer = top + 1;
      slot = 1;
    } else {
      const used = new Set();
      for (const b of blocks) if (b.state === 'tower' && b.layer === top) {
        const lat = top % 2 === 0 ? b.body.p[2] : b.body.p[0];
        let best = 0, bd = 9;
        SLOTS.forEach((s, i) => { const d = Math.abs(s - lat); if (d < bd) { bd = d; best = i; } });
        used.add(best);
      }
      slot = [1, 0, 2].find((s) => !used.has(s));
    }
    const p = slotPos(layer, slot);
    const y = layer === top ? surface - H / 2 : surface + H / 2;
    p[1] = y + 0.01;
    return { layer, slot, pos: p, surface };
  };

  // The pulled block lifts straight up, glides over the tower, waits for it to settle and drops on top.
  sim.lift = (b, spot, onDone) => {
    sim.endPull();
    b.state = 'out';
    const body = b.body;
    body.setKinematic(true);
    body.v.fill(0);
    body.w.fill(0);
    const from = body.p.slice();
    const fromQ = body.q.slice();
    const toQ = spot.layer % 2 === 1 ? QODD : QEVEN;
    const hover = spot.pos[1] + 1.2;
    const clearY = Math.max(from[1], spot.surface + H * 2.4);
    let t = 0;
    const dUp = 0.55, dOver = 0.6;
    const ease = (k) => k * k * (3 - 2 * k);
    const h = (dt) => {
      t += dt;
      const before = body.p.slice();
      if (t < dUp) {
        body.p[1] = from[1] + (clearY - from[1]) * ease(t / dUp);
      } else if (t < dUp + dOver) {
        const e = ease((t - dUp) / dOver);
        body.p[0] = from[0] + (spot.pos[0] - from[0]) * e;
        body.p[2] = from[2] + (spot.pos[2] - from[2]) * e;
        body.p[1] = clearY + (hover - clearY) * e;
        // slerp-free blend: yaw by 90 degrees between even and odd layers
        const q = fromQ.map((c, i) => c + (toQ[i] - c) * e);
        body.setQuat(q);
      }
      body.v[0] = (body.p[0] - before[0]) / dt;
      body.v[1] = (body.p[1] - before[1]) / dt;
      body.v[2] = (body.p[2] - before[2]) / dt;
      const waited = t - dUp - dOver;
      if (waited > 0.3 && (waited > 2.2 || sim.isSettled())) {
        handlers.splice(handlers.indexOf(h), 1);
        const s2 = sim.placeSpot();
        body.p[0] = s2.pos[0]; body.p[1] = s2.pos[1] + 0.3; body.p[2] = s2.pos[2];
        body.setQuat(s2.layer % 2 === 1 ? QODD : QEVEN);
        body.setKinematic(false);
        body.friction = diff.friction;
        body.v.fill(0);
        body.v[1] = -1;
        body.w.fill(0);
        world.wake();
        b.layer = s2.layer;
        b.slot = s2.slot;
        b.state = 'tower';
        b.placedAt = world.time;
        onDone && onDone(b);
      }
    };
    handlers.push(h);
  };

  // Fallen-block detection. Ignores blocks in hand. Returns the first offender or null.
  sim.collapsed = () => {
    for (const b of blocks) {
      if (b.state !== 'tower') continue;
      const p = b.body.p;
      if (b.layer >= 2 && p[1] < H * 1.25 && world.time - (b.placedAt ?? -9) > 0.3) return b;
      if (Math.max(Math.abs(p[0]), Math.abs(p[2])) > L * 1.35 && p[1] < H * 2.2) return b;
      if (p[1] < H * 0.3) return b;
    }
    return null;
  };
  // Is the tower still moving?
  sim.isSettled = () => {
    if (world.asleep) return true;
    for (const b of blocks) if (b.state === 'tower') {
      const v = b.body.v, w = b.body.w;
      if (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] > 0.04 || w[0] * w[0] + w[1] * w[1] + w[2] * w[2] > 0.09) return false;
    }
    return true;
  };
  sim.removeBlock = (b) => {
    world.remove(b.body);
    blocks.splice(blocks.indexOf(b), 1);
  };
  sim.heightLayers = () => topLayerInfo().top + 1;
  return sim;
}
