// Procedural crowd people. A person is a plain object (see `randomPerson`);
// `drawPerson` paints one into a canvas context in world units. Figures are
// drawn in a 100-unit local space with the feet at (0, 0), facing +x.

import { mixHex, shade } from './paint.js';

export const SKIN = ['#fbe0c6', '#f2c59c', '#e2a877', '#c98a5c', '#a06a43', '#744a2c'];
export const HAIR = ['#2a1b12', '#4b2f1c', '#8a5a2b', '#c99b5a', '#e9dcb8', '#1d1d22', '#6a3d7a', '#2f4f3f', '#a0a0a8'];
export const GINGER = '#d9531e';
export const RED = '#e53a2f';
export const WHITE = '#fbf7ef';

// The one character to find: red-and-white striped sweater, round glasses,
// red bobble hat (with a white band). No other person has all three traits.
export const TARGET_TRAITS = {
  stripes: 'rw',
  glasses: 'round',
  hat: 'bobble',
  hatC: RED,
  band: WHITE,
  pom: RED,
};

const POSES = {
  stand: { r: [0.03, 0.0], l: [-0.03, 0.0], ar: [0.16, 0.12], al: [-0.16, -0.12] },
  walk: { r: [0.42, 0.12], l: [-0.4, 0.12], ar: [-0.42, 0.35], al: [0.42, 0.35] },
  wave: { r: [0.03, 0.0], l: [-0.03, 0.0], ar: [2.6, 0.45], al: [-0.2, -0.1] },
  cheer: { r: [0.12, 0.0], l: [-0.12, 0.0], ar: [2.7, 0.1], al: [-2.7, -0.1] },
  hold: { r: [0.03, 0.0], l: [-0.03, 0.0], ar: [1.25, 0.9], al: [1.25, 0.9] },
  run: { r: [0.8, -0.5], l: [-0.7, 0.6], ar: [-1.0, -0.6], al: [1.0, -0.8] },
  sit: { sit: true, r: [1.5, -1.5], l: [1.5, -1.5], ar: [0.4, 0.5], al: [-0.4, -0.5] },
  read: { r: [0.03, 0.0], l: [-0.03, 0.0], ar: [1.2, 1.0], al: [1.2, 1.0] },
  dance: { r: [0.2, 0.1], l: [-0.2, 0.1], ar: [2.5, 0.4], al: [-1.2, -0.5] },
  photo: { r: [0.03, 0.0], l: [-0.03, 0.0], ar: [1.35, 1.1], al: [0.2, 0.1] },
  lean: { r: [0.1, 0.05], l: [-0.5, -0.1], ar: [1.0, 0.2], al: [-0.3, -0.2] },
};

export const POSE_LIST = ['stand', 'stand', 'stand', 'walk', 'walk', 'walk', 'wave', 'cheer', 'hold', 'run', 'dance', 'photo', 'lean', 'read', 'sit'];

const HAT_DECOY = ['none', 'none', 'none', 'none', 'cap', 'cap', 'sun', 'helmet'];
const HAIR_STYLES = ['short', 'short', 'long', 'curly', 'bun', 'bald', 'ponytail', 'short'];
const GLASSES_DECOY = [null, null, null, null, null, 'round', 'square', 'sun'];

// Builds the colour and trait description of a random crowd member.
// `pal` supplies the theme's clothing colours and props. `lvl` raises the
// chance of decoys that share one or two traits with the target.
export function randomPerson(rnd, pal, lvl) {
  const pick = (a) => a[(rnd() * a.length) | 0];
  const boost = Math.min(lvl, 25);
  const stripeP = 0.1 + boost * 0.006;
  const roundP = 0.14 + boost * 0.006;
  const bobbleP = 0.08 + boost * 0.003;

  // Tops: red-and-white stripes (the target's look, shared by some decoys),
  // other stripes, or plain / patterned clothes.
  let top;
  let pat;
  if (rnd() < stripeP) {
    pat = 'hstripe';
    top = rnd() < 0.45 ? { c: RED, c2: WHITE } : { c: pick(['#2f6fb3', '#3aa36b', '#e5b93a', '#2c4a86', '#f08a24', '#7a4bc2', '#17a2b8']), c2: WHITE };
  } else {
    pat = pick(['solid', 'solid', 'solid', 'vstripe', 'dots', 'hoops', 'jacket', 'zig']);
    top = { c: pick(pal.tops), c2: pick(pal.tops2 || [WHITE]) };
  }

  // Glasses: round is the target's; decoys wear round, square, sun or none.
  let glasses = rnd() < roundP ? 'round' : pick(GLASSES_DECOY);

  // Hats: bobbles (sometimes red), a red beanie without bobble (near miss), or others.
  let hat;
  const hatRoll = rnd();
  if (hatRoll < bobbleP) {
    const hc = rnd() < 0.2 ? RED : pick(['#2f6fb3', '#3aa36b', '#e5b93a', '#8e4bc2', '#f08a24', '#0e7c86']);
    hat = { t: 'bobble', c: hc, band: rnd() < 0.5 ? WHITE : shade(hc, -0.35), pom: hc };
  } else if (hatRoll < bobbleP + 0.025) {
    hat = { t: 'beanie', c: RED, band: RED, pom: null };
  } else {
    hat = { t: pick(HAT_DECOY), c: pick(['#f2d15c', '#5b3a86', '#1f6f5c', '#3a4a68', '#d9d4c2', RED, RED, '#2e2e36']), band: WHITE, pom: null };
  }

  // Never reproduce the complete target look: break the combination.
  const rw = pat === 'hstripe' && top.c === RED;
  if (rw && glasses === 'round' && hat.t === 'bobble' && hat.c === RED) glasses = pick(['square', 'sun', null]);

  const bottomType = rnd() < 0.2 ? 'shorts' : rnd() < 0.08 ? 'dress' : 'pants';
  return {
    pose: pick(POSE_LIST),
    child: rnd() < 0.08,
    skin: pick(SKIN),
    hair: { c: rnd() < 0.07 ? GINGER : pick(HAIR), s: pick(HAIR_STYLES), curls: false },
    top: { c: top.c, c2: top.c2, pat, sleeve: rnd() < 0.5 ? 'long' : 'short' },
    bottom: { c: pick(pal.pants), t: bottomType },
    shoe: pick(['#3b2a20', '#1d1d22', '#ffffff', '#8a2f2f', '#5b3a22']),
    hat,
    glasses,
    glassC: pick(['#2a1a0e', '#1c1c1e', '#8a6a2a']),
    prop: rnd() < 0.3 ? pick(pal.props) : null,
    propC: pick(pal.propC || ['#e53a2f', '#3aa36b', '#2f6fb3', '#f2d15c']),
    propHand: rnd() < 0.5 ? 0 : 1,
    skis: false,
  };
}

// The target person. `pose` and colours are fixed; traits from TARGET_TRAITS.
export function targetPerson(rnd, pose) {
  return {
    pose: pose || 'wave',
    child: false,
    skin: '#f4cba2',
    hair: { c: GINGER, s: 'short', curls: true },
    top: { c: RED, c2: WHITE, pat: 'hstripe', sleeve: 'long' },
    bottom: { c: '#2c4a86', t: 'pants' },
    shoe: '#4a2f1c',
    hat: { t: 'bobble', c: RED, band: WHITE, pom: RED },
    glasses: 'round',
    glassC: '#3b2414',
    prop: null,
    propC: RED,
    propHand: 0,
    skis: false,
    target: true,
  };
}

// True when a person matches every trait of the target (must never happen for decoys).
export function isFullLook(p) {
  return (
    p.top.pat === 'hstripe' &&
    p.top.c === RED &&
    p.top.c2 === WHITE &&
    p.glasses === 'round' &&
    p.hat.t === 'bobble' &&
    p.hat.c === RED
  );
}

// Applies atmospheric haze: far people get paler and bluer toward `hazeC`.
export function hazePerson(p, t, hazeC) {
  const m = (c) => (c ? mixHex(c, hazeC, t) : c);
  p.skin = m(p.skin);
  p.hair = { ...p.hair, c: m(p.hair.c) };
  p.top = { ...p.top, c: m(p.top.c), c2: m(p.top.c2) };
  p.bottom = { ...p.bottom, c: m(p.bottom.c) };
  p.shoe = m(p.shoe);
  p.hat = { ...p.hat, c: m(p.hat.c), band: m(p.hat.band), pom: m(p.hat.pom) };
  p.glassC = m(p.glassC);
  p.propC = m(p.propC);
  return p;
}

export function drawPerson(g, p) {
  const k = p.h / 100;
  g.save();
  g.translate(p.x, p.y);
  g.scale(p.flip * k, k);
  if (!p.noShadow) {
    g.beginPath();
    g.ellipse(0, 0.4, 17, 3.6, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(18,10,4,0.28)';
    g.fill();
  }
  drawFigure(g, p);
  g.restore();
}

const INK = 'rgba(28,16,10,0.42)';

export function drawFigure(g, p) {
  const pose = POSES[p.pose] || POSES.stand;
  const sit = !!pose.sit;
  const hipY = sit ? -24 : -44;
  const sY = hipY - 30;
  const hr = p.child ? 12.5 : 10.5;
  const hY = sY - 10 - (p.child ? 2 : 0);

  // ---- legs (feet on the ground) ----
  const legDefs = [
    { x: 5, a: pose.r },
    { x: -5, a: pose.l },
  ];
  const feet = [];
  for (const L of legDefs) {
    const [a1, a2] = L.a;
    const L1 = sit ? 22 : 21;
    const vert = -hipY;
    const c1 = Math.cos(a1);
    let L2 = (vert - L1 * c1) / Math.cos(a1 + a2);
    if (!isFinite(L2) || L2 < 8) L2 = sit ? 22 : 21;
    const kx = L.x + L1 * Math.sin(a1);
    const ky = hipY + L1 * c1;
    const fx = kx + L2 * Math.sin(a1 + a2);
    const fy = ky + L2 * Math.cos(a1 + a2);
    feet.push([fx, fy]);
    if (p.bottom.t === 'dress') continue;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (p.bottom.t === 'shorts') {
      g.strokeStyle = p.bottom.c;
      g.lineWidth = 9.4;
      g.beginPath();
      g.moveTo(L.x, hipY);
      g.lineTo(kx, ky);
      g.stroke();
      g.strokeStyle = p.skin;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(kx, ky);
      g.lineTo(fx, fy - 1);
      g.stroke();
    } else {
      g.strokeStyle = p.bottom.c;
      g.lineWidth = 9.4;
      g.beginPath();
      g.moveTo(L.x, hipY);
      g.lineTo(kx, ky);
      g.lineTo(fx, fy - 1);
      g.stroke();
    }
  }
  if (p.bottom.t === 'dress') {
    // skirt
    g.beginPath();
    g.moveTo(-9.5, hipY + 1);
    g.lineTo(9.5, hipY + 1);
    g.lineTo(15, -2);
    g.quadraticCurveTo(0, 1, -15, -2);
    g.closePath();
    g.fillStyle = p.bottom.c;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.8;
    g.stroke();
  }
  for (const [fx, fy] of feet) {
    g.beginPath();
    g.ellipse(fx + 2.2, fy - 0.8, 4.2, 2.3, 0, 0, Math.PI * 2);
    g.fillStyle = p.shoe;
    g.fill();
  }
  if (p.skis) {
    g.strokeStyle = '#d8462c';
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-14, 1.5);
    g.lineTo(18, 1.5);
    g.stroke();
    g.lineCap = 'butt';
  }

  // ---- back hair ----
  const hairC = p.hair.c;
  if (p.hair.s === 'long') {
    rrFillLocal(g, -hr - 1.6, hY - 2, 2 * hr + 3.2, 27, 4, hairC);
  } else if (p.hair.s === 'ponytail') {
    g.beginPath();
    g.ellipse(-hr - 1.8, hY + 6, 3.2, 8, 0.2, 0, Math.PI * 2);
    g.fillStyle = hairC;
    g.fill();
  }

  // ---- arms ----
  const shoulders = [
    { x: 12, a: pose.ar, side: 0 },
    { x: -12, a: pose.al, side: 1 },
  ];
  const hands = [null, null];
  for (const s of shoulders) {
    const [a1, a2] = s.a;
    const sx = s.x;
    const sy = sY + 2;
    const ex = sx + 15 * Math.sin(a1);
    const ey = sy + 15 * Math.cos(a1);
    const hx = ex + 14 * Math.sin(a1 + a2);
    const hy = ey + 14 * Math.cos(a1 + a2);
    hands[s.side] = [hx, hy];
    g.lineCap = 'round';
    g.strokeStyle = p.top.c;
    g.lineWidth = 7.6;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(ex, ey);
    g.stroke();
    g.strokeStyle = p.top.sleeve === 'long' ? p.top.c : p.skin;
    g.lineWidth = 6.2;
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo(hx, hy);
    g.stroke();
    if (p.top.sleeve === 'long') {
      g.strokeStyle = shade(p.top.c, -0.12);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(hx + (hx - ex) * 0.12, hy + (hy - ey) * 0.12);
      g.lineTo(hx + (hx - ex) * 0.25, hy + (hy - ey) * 0.25);
      g.stroke();
    }
    circle2(g, hx, hy, 3.4, p.skin);
  }
  g.lineCap = 'butt';

  // ---- torso ----
  torsoPath(g, sY, hipY);
  g.fillStyle = p.top.c;
  g.fill();
  g.save();
  torsoPath(g, sY, hipY);
  g.clip();
  const c2 = p.top.c2;
  if (p.top.pat === 'hstripe') {
    for (let y = sY + 1; y < hipY; y += 6) rectLocal(g, -16, y, 32, 3, c2);
  } else if (p.top.pat === 'hoops') {
    for (let y = sY + 3; y < hipY; y += 9) rectLocal(g, -16, y, 32, 4.5, c2);
  } else if (p.top.pat === 'vstripe') {
    for (let x = -14; x < 14; x += 5) rectLocal(g, x, sY, 2.4, hipY - sY, c2);
  } else if (p.top.pat === 'dots') {
    for (let y = sY + 4; y < hipY; y += 6) for (let x = -10; x <= 10; x += 6) circle2(g, x + ((y / 6) % 2) * 3, y, 1.3, c2);
  } else if (p.top.pat === 'zig') {
    g.strokeStyle = c2;
    g.lineWidth = 2.2;
    for (let y = sY + 4; y < hipY; y += 7) {
      g.beginPath();
      g.moveTo(-14, y);
      for (let x = -14; x <= 14; x += 7) g.lineTo(x + 3.5, y + (((x + 14) / 7) % 2 ? 3.5 : 0));
      g.stroke();
    }
  } else if (p.top.pat === 'jacket') {
    rectLocal(g, -1, sY, 2, hipY - sY, shade(p.top.c, 0.35));
    rectLocal(g, -13, sY, 26, 4, shade(p.top.c, -0.2));
  }
  rectLocal(g, -14, sY, 6, hipY - sY, 'rgba(255,240,215,0.14)');
  rectLocal(g, 8, sY, 7, hipY - sY, 'rgba(0,0,0,0.14)');
  g.restore();
  torsoPath(g, sY, hipY);
  g.strokeStyle = INK;
  g.lineWidth = 0.9;
  g.stroke();

  // ---- neck & head ----
  rectLocal(g, -3, sY - 3, 6, 6, shade(p.skin, -0.12));
  g.beginPath();
  g.ellipse(-hr - 0.6, hY + 1, 2.4, 3, 0, 0, Math.PI * 2);
  g.ellipse(hr + 0.6, hY + 1, 2.4, 3, 0, 0, Math.PI * 2);
  g.fillStyle = p.skin;
  g.fill();
  g.beginPath();
  g.arc(0, hY, hr, 0, Math.PI * 2);
  g.fillStyle = p.skin;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.7;
  g.stroke();
  if (p.hair.curls) {
    for (let i = 0; i < 3; i++) {
      circle2(g, -hr - 1.2 + i * 0.4, hY - 5 + i * 3.5, 2.5, hairC);
      circle2(g, hr + 1.2 - i * 0.4, hY - 4.5 + i * 3.2, 2.4, hairC);
    }
  }

  // ---- hair on top ----
  hairTop(g, p, hY, hr);

  // ---- face ----
  circle2(g, -3.6, hY + 0.8, 1.15, '#1e1412');
  circle2(g, 3.6, hY + 0.8, 1.15, '#1e1412');
  circle2(g, -5.8, hY + 3.6, 1.6, 'rgba(235,110,100,0.35)');
  circle2(g, 5.8, hY + 3.6, 1.6, 'rgba(235,110,100,0.35)');
  g.beginPath();
  g.arc(0, hY + 3.8, 2.3, 0.2 * Math.PI, 0.8 * Math.PI);
  g.strokeStyle = '#7a3b2e';
  g.lineWidth = 0.9;
  g.stroke();

  // ---- glasses ----
  if (p.glasses) glassesOn(g, p, hY);

  // ---- hat ----
  hatOn(g, p, hY, hr);

  // ---- props in hand ----
  if (p.prop && hands[p.propHand]) {
    const [hx, hy] = hands[p.propHand];
    propOn(g, p, p.prop, hx, hy);
  }
}

function torsoPath(g, sY, hipY) {
  g.beginPath();
  g.moveTo(-13, sY);
  g.lineTo(13, sY);
  g.quadraticCurveTo(14.5, (sY + hipY) / 2, 10.5, hipY + 1);
  g.lineTo(-10.5, hipY + 1);
  g.quadraticCurveTo(-14.5, (sY + hipY) / 2, -13, sY);
  g.closePath();
}

function rectLocal(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function circle2(g, x, y, r, c) {
  if (c === 'transparent') return;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = c;
  g.fill();
}

function rrFillLocal(g, x, y, w, h, r, c) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
  g.fillStyle = c;
  g.fill();
}

function hairTop(g, p, hY, hr) {
  const s = p.hair.s;
  const c = p.hair.c;
  if (s === 'bald') return;
  if (s === 'curly') {
    for (let a = Math.PI * 1.02; a < Math.PI * 2; a += 0.42) {
      circle2(g, Math.cos(a) * hr * 0.92, hY + Math.sin(a) * hr * 0.92, 3.1, c);
    }
  }
  g.beginPath();
  g.ellipse(0, hY - 1.2, hr + 0.7, hr * 0.92, 0, Math.PI, Math.PI * 2);
  g.fillStyle = c;
  g.fill();
  if (s === 'bun') circle2(g, 0, hY - hr - 1.2, 4.2, c);
  if (s === 'short' && !p.hair.curls) {
    // little fringe
    g.beginPath();
    g.moveTo(-hr + 1, hY - 2);
    g.quadraticCurveTo(0, hY - 4.5, hr - 1, hY - 2);
    g.lineTo(hr - 2, hY - 1);
    g.quadraticCurveTo(0, hY - 3.3, -hr + 2, hY - 1);
    g.closePath();
    g.fill();
  }
}

function glassesOn(g, p, hY) {
  g.lineWidth = 1.1;
  g.strokeStyle = p.glassC;
  if (p.glasses === 'round') {
    for (const x of [-3.7, 3.7]) {
      g.beginPath();
      g.arc(x, hY + 0.8, 3.1, 0, Math.PI * 2);
      g.fillStyle = 'rgba(190,230,255,0.16)';
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-0.6, hY + 0.5);
    g.lineTo(0.6, hY + 0.5);
    g.stroke();
  } else if (p.glasses === 'square') {
    for (const x of [-7.3, 0.9]) {
      rrFillLocal(g, x, hY - 2.1, 6.4, 5.6, 1.2, 'rgba(190,230,255,0.12)');
      g.beginPath();
      g.roundRect ? g.roundRect(x, hY - 2.1, 6.4, 5.6, 1.2) : g.rect(x, hY - 2.1, 6.4, 5.6);
      g.stroke();
    }
  } else if (p.glasses === 'sun') {
    rrFillLocal(g, -7.4, hY - 1.8, 6.6, 4.8, 1.4, '#101015');
    rrFillLocal(g, 0.8, hY - 1.8, 6.6, 4.8, 1.4, '#101015');
    rectLocal(g, -0.8, hY + 0.2, 1.6, 0.8, '#101015');
  }
}

function hatOn(g, p, hY, hr) {
  const h = p.hat;
  if (!h || h.t === 'none') return;
  const top = hY - hr * 0.92 - 3.7;
  if (h.t === 'cap') {
    g.beginPath();
    g.ellipse(0, hY - 2.4, hr + 1.1, hr * 0.92, 0, Math.PI, Math.PI * 2);
    g.fillStyle = h.c;
    g.fill();
    rrFillLocal(g, -1, hY - 3.4, hr + 6.5, 2.5, 1.2, shade(h.c, -0.22));
  } else if (h.t === 'sun') {
    g.beginPath();
    g.ellipse(0, hY - 3.4, hr + 7.2, 2.8, 0, 0, Math.PI * 2);
    g.fillStyle = shade(h.c, -0.08);
    g.fill();
    g.beginPath();
    g.ellipse(0, hY - 4.6, hr + 1.8, hr * 0.9, 0, Math.PI, Math.PI * 2);
    g.fillStyle = h.c;
    g.fill();
  } else if (h.t === 'helmet') {
    g.beginPath();
    g.ellipse(0, hY - 2.6, hr + 1.6, hr * 0.98, 0, Math.PI, Math.PI * 2);
    g.fillStyle = h.c;
    g.fill();
    rrFillLocal(g, -hr - 1.6, hY - 5.2, 2 * hr + 3.2, 1.6, 0.8, shade(h.c, -0.3));
  } else {
    // beanie / bobble: dome, a band across the forehead and an optional pom
    g.beginPath();
    g.ellipse(0, hY - 3.6, hr + 1.2, hr * 0.9 + 0.5, 0, Math.PI, Math.PI * 2);
    g.fillStyle = h.c;
    g.fill();
    rrFillLocal(g, -hr - 1.3, hY - 5.4, 2 * hr + 2.6, 3.4, 1.4, h.band || WHITE);
    rrFillLocal(g, -hr - 1.3, hY - 5.4, 2 * hr + 2.6, 0.9, 0.5, 'rgba(0,0,0,0.12)');
    if (h.t === 'bobble') {
      circle2(g, 0, top - 1.5, 4.3, h.pom || h.c);
      circle2(g, -1.4, top - 2.6, 1.2, 'rgba(255,255,255,0.45)');
    }
  }
}

function propOn(g, p, name, hx, hy) {
  const c = p.propC;
  g.lineWidth = 1;
  switch (name) {
    case 'balloon': {
      g.strokeStyle = 'rgba(40,30,20,0.55)';
      g.beginPath();
      g.moveTo(hx, hy);
      g.quadraticCurveTo(hx + 6, hy - 12, hx + 3, hy - 26);
      g.stroke();
      g.beginPath();
      g.ellipse(hx + 3, hy - 33, 6.2, 7.6, 0, 0, Math.PI * 2);
      g.fillStyle = c;
      g.fill();
      circle2(g, hx + 0.8, hy - 37, 1.6, 'rgba(255,255,255,0.6)');
      break;
    }
    case 'icecream': {
      g.beginPath();
      g.moveTo(hx - 3.6, hy - 2);
      g.lineTo(hx + 3.6, hy - 2);
      g.lineTo(hx, hy + 8);
      g.closePath();
      g.fillStyle = '#d9a25b';
      g.fill();
      circle2(g, hx, hy - 5, 4.8, c);
      circle2(g, hx - 1.6, hy - 6.4, 1.4, 'rgba(255,255,255,0.5)');
      break;
    }
    case 'bag': {
      rrFillLocal(g, hx - 4.5, hy - 1, 9, 9, 1.6, c);
      g.strokeStyle = shade(c, -0.3);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(hx, hy - 1, 3, Math.PI, 0);
      g.stroke();
      break;
    }
    case 'book': {
      rrFillLocal(g, hx - 4.5, hy - 5, 9, 7, 0.8, c);
      rectLocal(g, hx - 3.5, hy - 4, 7, 5, '#f7efdc');
      break;
    }
    case 'camera': {
      rrFillLocal(g, hx - 5, hy - 5, 10, 7, 1.4, '#2b2b30');
      circle2(g, hx, hy - 1.5, 2.2, '#7fb6e6');
      break;
    }
    case 'umbrella': {
      g.strokeStyle = '#2e2420';
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx - 2, hy - 38);
      g.stroke();
      g.beginPath();
      g.ellipse(hx - 2, hy - 38, 17, 7, 0, Math.PI, Math.PI * 2);
      g.fillStyle = c;
      g.fill();
      for (let i = -2; i <= 2; i += 2) {
        g.beginPath();
        g.moveTo(hx - 2 + i * 4, hy - 38);
        g.lineTo(hx - 2 + i * 4.4, hy - 44.2);
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.stroke();
      }
      break;
    }
    case 'flag': {
      g.strokeStyle = '#3a2a1c';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx, hy - 34);
      g.stroke();
      poly3(g, [[hx, hy - 34], [hx + 13, hy - 30], [hx, hy - 26]], c);
      break;
    }
    case 'cup': {
      rrFillLocal(g, hx - 3, hy - 7, 6, 8, 1, c);
      rectLocal(g, hx - 3.4, hy - 8, 6.8, 1.6, '#f4f1ea');
      break;
    }
    case 'basket': {
      rrFillLocal(g, hx - 6, hy - 4, 12, 8, 2, '#b57a3c');
      g.strokeStyle = '#7d4f22';
      g.lineWidth = 0.9;
      for (let x = -4; x <= 4; x += 3) {
        g.beginPath();
        g.moveTo(hx + x, hy - 4);
        g.lineTo(hx + x, hy + 4);
        g.stroke();
      }
      break;
    }
    case 'suitcase': {
      rrFillLocal(g, hx - 6, hy - 6, 12, 10, 1.6, c);
      g.strokeStyle = '#1e1e24';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(hx - 2.4, hy - 6);
      g.lineTo(hx - 2.4, hy - 9);
      g.lineTo(hx + 2.4, hy - 9);
      g.lineTo(hx + 2.4, hy - 6);
      g.stroke();
      break;
    }
    case 'board': {
      g.strokeStyle = c;
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(hx - 12, hy + 12);
      g.lineTo(hx + 6, hy - 22);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(hx - 9, hy + 9);
      g.lineTo(hx + 4, hy - 17);
      g.stroke();
      g.lineCap = 'butt';
      break;
    }
    case 'fish': {
      g.beginPath();
      g.ellipse(hx, hy - 2, 7, 3.4, -0.2, 0, Math.PI * 2);
      g.fillStyle = c;
      g.fill();
      poly3(g, [[hx - 6, hy - 2], [hx - 11, hy - 6], [hx - 11, hy + 2]], c);
      break;
    }
    case 'bread': {
      g.beginPath();
      g.ellipse(hx, hy - 3, 11, 3.6, -0.35, 0, Math.PI * 2);
      g.fillStyle = '#d99a4a';
      g.fill();
      break;
    }
    case 'megaphone': {
      poly3(g, [[hx, hy - 6], [hx + 10, hy - 12], [hx + 10, hy + 1], [hx, hy - 3]], c);
      break;
    }
    case 'ticket': {
      rrFillLocal(g, hx - 5, hy - 4, 10, 6, 1, c);
      break;
    }
    default:
      break;
  }
}

function poly3(g, pts, c) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = c;
  g.fill();
}

export const PROP_NAMES = ['balloon', 'icecream', 'bag', 'book', 'camera', 'umbrella', 'flag', 'cup', 'basket', 'suitcase', 'board', 'fish', 'bread', 'megaphone', 'ticket'];

// Portrait of the character for menus and the tray. Draws centred on (cx, cy)
// with the feet at cy + size * 0.44.
export function drawPortrait(g, p, cx, cy, size) {
  const h = size * 0.86;
  g.save();
  g.translate(cx, cy + size * 0.44 - h * 0.02);
  const k = h / 100;
  g.scale(k, k);
  g.beginPath();
  g.ellipse(0, 0.4, 17, 3.6, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(18,10,4,0.3)';
  g.fill();
  drawFigure(g, p);
  g.restore();
}

