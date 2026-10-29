// Block Tower physics world (cannon-es rigid bodies). Pure module: no DOM, so it runs in node tests.
// Units: block = W x H x L = 1 x 0.6 x 3. Layer l is "even" (length along X) or "odd" (length along Z).
import * as C from './vendor/cannon-es.js';

export const W = 1;
export const H = 0.6;
export const L = 3;
export const GAP = 0.012; // lateral gap between neighbours at the start
export const LAYERS = 18;
export const SLOTS = [-(W + GAP), 0, W + GAP];

export const DIFFICULTY = {
  steady: { friction: 0.45, damping: 0.18, removed: 0, label: 'steady' },
  normal: { friction: 0.36, damping: 0.1, removed: 0, label: 'normal' },
  wobbly: { friction: 0.28, damping: 0.04, removed: 3, label: 'wobbly' },
};

const GRAVITY = 50;
const STEP = 1 / 120;

const _v = new C.Vec3();

export function createSim(diffId = 'normal', saved = null) {
  const diff = DIFFICULTY[diffId] || DIFFICULTY.normal;
  const world = new C.World({ gravity: new C.Vec3(0, -GRAVITY, 0) });
  world.allowSleep = true;
  world.broadphase = new C.SAPBroadphase(world);
  world.defaultContactMaterial.contactEquationStiffness = 2e7;
  world.defaultContactMaterial.contactEquationRelaxation = 4;
  world.defaultContactMaterial.frictionEquationStiffness = 2e7;
  world.defaultContactMaterial.frictionEquationRelaxation = 4;
  world.solver.iterations = 18;
  world.solver.tolerance = 1e-4;

  const wood = new C.Material('wood');
  const floorMat = new C.Material('floor');
  world.addContactMaterial(new C.ContactMaterial(wood, wood, { friction: diff.friction, restitution: 0.02, contactEquationStiffness: 2e7, contactEquationRelaxation: 4, frictionEquationStiffness: 2e7, frictionEquationRelaxation: 4 }));
  world.addContactMaterial(new C.ContactMaterial(wood, floorMat, { friction: 0.8, restitution: 0.04 }));

  const floor = new C.Body({ mass: 0, material: floorMat });
  floor.addShape(new C.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  // cannon-es clamps friction in impulse units (it ignores dt) and not by the real normal load, so the friction
  // scale is (load above the contact) x dt: this gives Coulomb-like friction that is stronger low in the tower.
  let topIdx = LAYERS - 1;
  world.narrowphase.frictionScale = (a, b) => {
    const la = a.userData ? a.userData.layer : -1;
    const lb = b.userData ? b.userData.layer : -1;
    let k;
    if (la < 0 || lb < 0) k = Math.max(1, (topIdx + 1) / 3) * 0.9;
    else if (la === lb) k = 0.3;
    else k = Math.max(0.5, (topIdx - Math.min(la, lb) + 0.6) / 7.2);
    return k * world.dt;
  };

  const shape = new C.Box(new C.Vec3(L / 2, H / 2, W / 2));
  const blocks = []; // { id, body, layer, slot, state: 'tower'|'hand'|'out', variant }
  let nextId = 0;
  const events = { onImpact: null };

  function addBlock(layer, slot, pos, quat, extra = {}) {
    const body = new C.Body({ mass: 1, material: wood, shape, linearDamping: diff.damping * 0.2, angularDamping: diff.damping });
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.35;
    body.sleepTimeLimit = 0.5;
    body.position.set(pos[0], pos[1], pos[2]);
    if (quat) body.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    else if (layer % 2 === 1) body.quaternion.setFromEuler(0, Math.PI / 2, 0);
    world.addBody(body);
    const b = { id: nextId++, body, layer, slot, state: 'tower', variant: nextId % 3, ...extra };
    body.userData = b;
    body.addEventListener('collide', (e) => {
      if (!events.onImpact) return;
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.5) events.onImpact(v, b);
    });
    blocks.push(b);
    return b;
  }

  function slotPos(layer, slot) {
    const y = layer * (H + 0.004) + H / 2 + 0.002;
    return layer % 2 === 0 ? [0, y, SLOTS[slot]] : [SLOTS[slot], y, 0];
  }

  if (saved && saved.blocks) {
    for (const s of saved.blocks) addBlock(s.layer, s.slot, [s.p[0], s.p[1], s.p[2]], [s.q[0], s.q[1], s.q[2], s.q[3]]);
  } else {
    for (let l = 0; l < LAYERS; l++) for (let s = 0; s < 3; s++) addBlock(l, s, slotPos(l, s));
  }

  let acc = 0;
  let time = 0;
  const handlers = [];
  let stepN = 0;
  function stepOnce() {
    if (stepN++ % 12 === 0) topIdx = Math.max(0, topLayerInfo().top);
    for (const h of handlers) h(STEP);
    world.step(STEP);
    time += STEP;
  }
  function update(dt) {
    acc += Math.min(dt, 0.05);
    let n = 0;
    while (acc >= STEP && n < 6) {
      stepOnce();
      acc -= STEP;
      n++;
    }
    if (n === 6) acc = 0;
  }

  const sim = {
    world, blocks, diff, events, get time() { return time; },
    update, stepOnce, handlers,
    addBlock, slotPos,
    axisOf(b, out = new C.Vec3()) {
      b.body.quaternion.vmult(_axisX, out);
      return out;
    },
    topLayerInfo,
    settle(sec = 1.5) { for (let i = 0; i < sec / STEP; i++) stepOnce(); },
    maxSpeed() { let m = 0; for (const b of blocks) m = Math.max(m, b.body.velocity.length(), b.body.angularVelocity.length() * 0.5); return m; },
    serialize() {
      return { diff: diffId, blocks: blocks.filter((b) => b.state === 'tower').map((b) => ({ layer: b.layer, slot: b.slot, p: [b.body.position.x, b.body.position.y, b.body.position.z].map(r4), q: [b.body.quaternion.x, b.body.quaternion.y, b.body.quaternion.z, b.body.quaternion.w].map(r4) })) };
    },
  };
  const r4 = (n) => Math.round(n * 1e4) / 1e4;
  const _axisX = new C.Vec3(1, 0, 0);

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

  // Is this block one the player may take? (not in the highest complete layer, nor above it)
  sim.canTake = (b) => {
    if (b.state !== 'tower') return false;
    const { complete, top, count } = topLayerInfo();
    if (b.layer >= complete) return false;
    if (top === complete) return b.layer < complete;
    return true;
  };

  // ---- pulling ----
  let pull = null; // { b, axis, origin, target, max }
  handlers.push((dt) => {
    if (!pull) return;
    const b = pull.b.body;
    // Drive the block along its axis with a force-limited spring: it really pushes its neighbours.
    const pos = b.position;
    const along = (pos.x - pull.origin.x) * pull.axis.x + (pos.z - pull.origin.z) * pull.axis.z;
    const err = pull.target - along;
    const vAlong = b.velocity.x * pull.axis.x + b.velocity.z * pull.axis.z;
    let a = 90 * err - 16 * vAlong;
    const maxF = pull.maxForce;
    a = Math.max(-maxF, Math.min(maxF, a));
    b.force.x += pull.axis.x * a * b.mass;
    b.force.z += pull.axis.z * a * b.mass;
    // keep it straight: damp yaw/tilt a bit while held
    b.angularVelocity.scale(0.9, b.angularVelocity);
    pull.along = along;
  });

  // Sleeping neighbours would glue a pulled block in place (and flipping sleep states makes the tower creep),
  // so every body stays awake while a turn is in progress and may sleep again once it has settled.
  sim.keepAwake = (on) => {
    for (const o of blocks) {
      o.body.allowSleep = !on;
      if (on) o.body.wakeUp();
    }
  };
  sim.beginPull = (b) => {
    const axis = sim.axisOf(b);
    axis.y = 0;
    axis.normalize();
    sim.keepAwake(true);
    pull = { b, axis, origin: new C.Vec3(b.body.position.x, 0, b.body.position.z), target: 0, along: 0, maxForce: 900 };
    b.state = 'hand';
    return pull;
  };
  sim.setPullTarget = (v) => {
    if (pull) pull.target = Math.max(-(L * 1.2), Math.min(L * 1.2, v));
  };
  sim.pullState = () => pull;
  sim.endPull = () => {
    pull = null;
  };
  // Block is fully out when its centre is beyond the footprint by the half length.
  sim.isClear = (b) => Math.max(Math.abs(b.body.position.x), Math.abs(b.body.position.z)) > L / 2 + L / 2 + 0.05;

  // ---- placing on top ----
  sim.placeSpot = () => {
    const { top, topCount } = topLayerInfo();
    let layer = top;
    let surface = 0;
    for (const b of blocks) if (b.state === 'tower' && b.layer === top) surface = Math.max(surface, b.body.position.y + H / 2);
    if (top < 0) layer = 0;
    let slot;
    if (topCount >= 3 || top < 0) {
      layer = top + 1;
      slot = 1;
    } else {
      const used = new Set();
      for (const b of blocks) if (b.state === 'tower' && b.layer === top) {
        const lat = top % 2 === 0 ? b.body.position.z : b.body.position.x;
        let best = 0, bd = 9;
        SLOTS.forEach((s, i) => { const d = Math.abs(s - lat); if (d < bd) { bd = d; best = i; } });
        used.add(best);
      }
      slot = [1, 0, 2].find((s) => !used.has(s));
    }
    const p = slotPos(layer, slot);
    p[1] = surface + (layer === top ? -H / 2 + H / 2 : H / 2) + (layer === top ? 0 : 0);
    // when adding to the same layer, surface is the top of that layer's blocks - H (same height); else on top of surface
    const y = layer === top ? surface - H / 2 : surface + H / 2;
    p[1] = y + 0.01;
    return { layer, slot, pos: p, surface };
  };

  // Called when the pulled block is clear: becomes a kinematic hand block that glides to the top.
  sim.lift = (b, spot, onDone) => {
    pull = null;
    b.state = 'out';
    const body = b.body;
    body.type = C.Body.KINEMATIC;
    body.mass = 0;
    body.updateMassProperties();
    body.velocity.setZero();
    body.angularVelocity.setZero();
    const from = body.position.clone();
    const fromQ = body.quaternion.clone();
    const toQ = new C.Quaternion();
    if (spot.layer % 2 === 1) toQ.setFromEuler(0, Math.PI / 2, 0);
    const hover = spot.pos[1] + 1.4;
    const hoverY = Math.max(from.y, hover) + 0.4;
    let t = 0;
    const dur = 0.85;
    const h = (dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      const e = k * k * (3 - 2 * k);
      // arc: up then over
      const kk = Math.min(1, e * 1.3);
      body.position.x = from.x + (spot.pos[0] - from.x) * e;
      body.position.z = from.z + (spot.pos[2] - from.z) * e;
      body.position.y = (1 - e) * from.y + e * hover + Math.sin(Math.PI * e) * (hoverY - hover + 0.6) * 0.0 + (1 - Math.abs(2 * e - 1)) * 0.0;
      body.position.y = from.y + (hoverY - from.y) * Math.min(1, e * 2.2) * (e < 0.5 ? 1 : 1) - (hoverY - hover) * Math.max(0, (e - 0.5) * 2);
      body.quaternion.slerp(toQ, 0.15, body.quaternion);
      body.velocity.setZero();
      if (k >= 1) {
        handlers.splice(handlers.indexOf(h), 1);
        // drop it
        body.type = C.Body.DYNAMIC;
        body.mass = 1;
        body.updateMassProperties();
        body.quaternion.copy(toQ);
        body.velocity.set(0, -2, 0);
        body.angularVelocity.setZero();
        body.wakeUp();
        b.layer = spot.layer;
        b.slot = spot.slot;
        b.state = 'tower';
        b.placedAt = time;
        onDone && onDone(b);
      }
    };
    handlers.push(h);
  };

  // Fallen-block detection. Ignores blocks in hand. Returns the first offender or null.
  sim.collapsed = () => {
    for (const b of blocks) {
      if (b.state !== 'tower') continue;
      const p = b.body.position;
      // a tower block that got down to the floor from above the first layers, or flew off
      if (b.layer >= 2 && p.y < H * 1.25 && time - (b.placedAt ?? -9) > 0.3) return b;
      if (Math.max(Math.abs(p.x), Math.abs(p.z)) > L * 1.35 && p.y < H * 2.2) return b;
      if (p.y < H * 0.3) return b;
    }
    return null;
  };
  // Is the tower still moving?
  sim.isSettled = () => {
    for (const b of blocks) if (b.state === 'tower' && b.body.sleepState !== C.Body.SLEEPING) {
      if (b.body.velocity.lengthSquared() > 0.04 || b.body.angularVelocity.lengthSquared() > 0.09) return false;
    }
    return true;
  };
  sim.removeBlock = (b) => {
    world.removeBody(b.body);
    blocks.splice(blocks.indexOf(b), 1);
  };
  sim.heightLayers = () => topLayerInfo().top + 1;
  return sim;
}
