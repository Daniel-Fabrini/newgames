// Real 3D dice built from CSS transforms (no canvas, no libraries).
//   slot      positioned wrapper (moves between the arena and the hold tray)
//   thrower   carries the throw arc / bounce animation (perspective lives here)
//   cube      6 faces + inner core, transform-style: preserve-3d, carries the spin
// The resting pose is: fixed camera tilt, a random yaw/roll, then the rotation that puts
// the wanted face towards the viewer. Face shading is recomputed from the real orientation.

const TILT = -26; // camera tilt (deg) so the top face is visible
const FACES = [
  // [value, css transform, local normal]
  [1, 'translateZ(var(--hs))', [0, 0, 1]],
  [6, 'rotateY(180deg) translateZ(var(--hs))', [0, 0, -1]],
  [3, 'rotateY(90deg) translateZ(var(--hs))', [1, 0, 0]],
  [4, 'rotateY(-90deg) translateZ(var(--hs))', [-1, 0, 0]],
  [2, 'rotateX(90deg) translateZ(var(--hs))', [0, -1, 0]],
  [5, 'rotateX(-90deg) translateZ(var(--hs))', [0, 1, 0]],
];
// rotation [rotateX, rotateY] that brings each value to the front
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const el = (cls, tag = 'div') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

function face(v, core) {
  const f = el(core ? 'g-dice-core' : 'g-dice-face');
  if (!core) {
    for (const cell of PIPS[v]) {
      const p = el(v === 1 ? 'g-dice-pip ace' : 'g-dice-pip', 'i');
      p.style.gridArea = `${Math.floor(cell / 3) + 1} / ${(cell % 3) + 1}`;
      f.append(p);
    }
  }
  return f;
}

export function makeDie() {
  const slot = el('g-dice-slot');
  const shadow = el('g-dice-shadow');
  const ring = el('g-dice-ring');
  const thrower = el('g-dice-thrower');
  const cube = el('g-dice-cube');
  const faces = [];
  for (const [v, tr, n] of FACES) {
    const c = face(v, true);
    c.style.transform = tr.replace('var(--hs)', 'calc(var(--hs) - 3px)');
    cube.append(c);
  }
  for (const [v, tr, n] of FACES) {
    const f = face(v, false);
    f.style.transform = tr;
    faces.push({ el: f, n });
    cube.append(f);
  }
  thrower.append(cube);
  slot.append(shadow, ring, thrower);
  const die = { slot, shadow, ring, thrower, cube, faces, value: 1, pose: { yaw: -24, z: 0 }, anims: [] };
  orient(die, 1, die.pose, false);
  return die;
}

const rad = (d) => (d * Math.PI) / 180;
// Apply CSS-like rotations (listed outermost first) to a vector.
function rotate(v, ops) {
  let [x, y, z] = v;
  for (let i = ops.length - 1; i >= 0; i--) {
    const [axis, deg] = ops[i];
    const c = Math.cos(rad(deg));
    const s = Math.sin(rad(deg));
    if (axis === 'x') [y, z] = [y * c - z * s, y * s + z * c];
    else if (axis === 'y') [x, z] = [x * c + z * s, -x * s + z * c];
    else [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

const LIGHT = (() => {
  const l = [-0.3, -0.62, 0.78];
  const n = Math.hypot(...l);
  return l.map((x) => x / n);
})();

export function poseTransform(value, pose, extra = null) {
  const [a, b] = FACE_ROT[value];
  const e = extra || { x: 0, y: 0, z: 0, a: 0, b: 0 };
  return `rotateX(${TILT}deg) rotateY(${pose.yaw + e.y}deg) rotateZ(${pose.z + e.z}deg) rotateX(${a + e.a}deg) rotateY(${b + e.b}deg)`;
}

function shade(die, value, pose, delay) {
  const [a, b] = FACE_ROT[value];
  const ops = [['x', TILT], ['y', pose.yaw], ['z', pose.z], ['x', a], ['y', b]];
  for (const f of die.faces) {
    const n = rotate(f.n, ops);
    const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    f.el.style.setProperty('--sh', ((1 - d) * 0.3).toFixed(3));
    f.el.style.transitionDelay = delay ? delay + 'ms' : '0ms';
  }
}

// Set the resting orientation instantly (or with the shading easing in).
export function orient(die, value, pose = die.pose, withShade = true) {
  die.value = value;
  die.pose = pose;
  die.cube.style.transform = poseTransform(value, pose);
  shade(die, value, pose, 0);
}

export const randomPose = () => ({ yaw: -22 + (Math.random() * 16 - 8), z: Math.random() * 8 - 4 });

export function stopAnims(die) {
  for (const a of die.anims) a.cancel();
  die.anims = [];
}

// Throw a die so that it lands showing `value`. Resolves visually in ~560 ms (+delay).
export function rollDie(die, value, { delay = 0, reduce = false, duration = 560, side = 0 } = {}) {
  stopAnims(die);
  const pose = randomPose();
  die.value = value;
  die.pose = pose;
  die.cube.style.transform = poseTransform(value, pose);
  shade(die, value, pose, reduce ? 0 : delay + duration * 0.8);
  if (reduce) {
    die.anims.push(die.thrower.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 170, delay: Math.min(delay, 60), fill: 'backwards' }));
    return;
  }
  const dir = side || (Math.random() < 0.5 ? -1 : 1);
  const sx = dir * (36 + Math.random() * 64);
  const sy = -(80 + Math.random() * 40);
  const spin = () => (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 2));
  const from = poseTransform(value, pose, { x: 0, y: spin(), z: spin(), a: spin(), b: spin() });
  const to = poseTransform(value, pose);
  die.anims.push(
    die.cube.animate([{ transform: from }, { transform: to }], { duration, delay, easing: 'cubic-bezier(.16,.62,.3,1)', fill: 'backwards' }),
  );
  const j = (Math.random() * 14 - 7) | 0;
  const arc = [
    { transform: `translate(${sx}px,${sy}px) scale(1.32)`, opacity: 0, offset: 0, easing: 'cubic-bezier(.55,0,.85,.55)' },
    { opacity: 1, offset: 0.08 },
    { transform: `translate(${j * 0.6}px,0) scale(1)`, opacity: 1, offset: 0.5, easing: 'cubic-bezier(.2,.7,.3,1)' },
    { transform: `translate(${-j * 0.3}px,-13px) scale(1.05)`, offset: 0.68, easing: 'cubic-bezier(.6,0,.9,.5)' },
    { transform: 'translate(0,0) scale(1)', offset: 0.84, easing: 'cubic-bezier(.2,.7,.3,1)' },
    { transform: 'translate(0,-3px) scale(1.01)', offset: 0.92, easing: 'ease-in' },
    { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 1 },
  ];
  die.anims.push(die.thrower.animate(arc, { duration, delay, fill: 'backwards' }));
  die.anims.push(
    die.shadow.animate(
      [
        { transform: 'translate(-50%,0) scale(1.7,1.4)', opacity: 0, offset: 0 },
        { transform: 'translate(-50%,0) scale(1,1)', opacity: 1, offset: 0.5 },
        { transform: 'translate(-50%,0) scale(1.3,1.15)', opacity: 0.55, offset: 0.68 },
        { transform: 'translate(-50%,0) scale(1,1)', opacity: 1, offset: 0.84 },
        { transform: 'translate(-50%,0) scale(1,1)', opacity: 1, offset: 1 },
      ],
      { duration, delay, fill: 'backwards' },
    ),
  );
}

// Slow idle tumble for the menu hero.
export function startSpin(die, { period = 14000, phase = 0 } = {}) {
  stopAnims(die);
  const base = die.pose;
  const a = poseTransform(die.value, base, { x: 0, y: phase, z: 0, a: 0, b: 0 });
  const b = poseTransform(die.value, base, { x: 0, y: phase + 360, z: 0, a: 0, b: 0 });
  die.anims.push(die.cube.animate([{ transform: a }, { transform: b }], { duration: period, iterations: Infinity }));
  die.anims.push(
    die.thrower.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-9px)' }, { transform: 'translateY(0)' }],
      { duration: 3600 + phase * 8, iterations: Infinity, easing: 'ease-in-out' },
    ),
  );
}

// Small restrained particle burst (DOM + WAAPI), cleaned up by itself.
export function burst(host, x, y, { n = 24, colors = ['#7fb0ff', '#fffaf0', '#4f8cff', '#cfd8ee'], spread = 150, life = 1100 } = {}) {
  const layer = el('g-dice-burst');
  host.append(layer);
  for (let i = 0; i < n; i++) {
    const p = el('g-dice-particle', 'i');
    const ang = Math.random() * Math.PI * 2;
    const dist = spread * (0.35 + Math.random() * 0.65);
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = colors[i % colors.length];
    p.style.width = 4 + Math.random() * 5 + 'px';
    p.style.height = p.style.width;
    if (i % 3 === 0) p.style.borderRadius = '2px';
    layer.append(p);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 30;
    p.animate(
      [
        { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(.9) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.08}px,${dy + 60}px) scale(.4) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: life * (0.7 + Math.random() * 0.5), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    );
  }
  return setTimeout(() => layer.remove(), life * 1.3);
}

export function miniFace(v) {
  const f = el('g-dice-mini');
  for (const cell of PIPS[v]) {
    const p = el('', 'i');
    p.style.gridArea = `${Math.floor(cell / 3) + 1} / ${(cell % 3) + 1}`;
    f.append(p);
  }
  return f;
}
