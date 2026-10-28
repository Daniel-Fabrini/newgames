// Pseudo-3D canvas renderer: camera behind the player's end of the table, arena
// backdrop with crowd and lights, table, net, ball with its shadow, stylized players.
import { R, TABLE_Y, HALF_W, HALF_L, NET_TOP, NET_HALF, clamp } from './logic.js';

export const ARENAS = [
  { id: 0, key: 'arenaName0', table: '#1d5fb0', tableEdge: '#0f3a73', floor: '#1b130b', wall: '#0a1a33', light: '#ffd27a', crowd: ['#e4574b', '#f5c04a', '#3ec3c9', '#f08fb8', '#9ad46b'], glow: '#ffb84d' },
  { id: 1, key: 'arenaName1', table: '#122a4f', tableEdge: '#0a1830', floor: '#07070d', wall: '#060818', light: '#3fe6ff', crowd: ['#ff3dbf', '#3fe6ff', '#8f5bff', '#ffe14d', '#3dff9e'], glow: '#3fe6ff' },
  { id: 2, key: 'arenaName2', table: '#7a1f1f', tableEdge: '#4a1010', floor: '#1d0b0b', wall: '#2a0808', light: '#ff6b3d', crowd: ['#ffd24a', '#ff6b3d', '#d7263d', '#ffffff', '#3a7bd5'], glow: '#ff6b3d' },
  { id: 3, key: 'arenaName3', table: '#1b6b68', tableEdge: '#0c3f3d', floor: '#0b1a1b', wall: '#082229', light: '#8ff0e8', crowd: ['#f4a261', '#2a9d8f', '#e9c46a', '#e76f51', '#ffffff'], glow: '#8ff0e8' },
  { id: 4, key: 'arenaName4', table: '#8a5a12', tableEdge: '#5a3a08', floor: '#1d1205', wall: '#2b1a05', light: '#ffc13d', crowd: ['#ffb703', '#fb8500', '#f25c54', '#ffffff', '#43aa8b'], glow: '#ffc13d' },
  { id: 5, key: 'arenaName5', table: '#2c5f8a', tableEdge: '#1a3b59', floor: '#0c1520', wall: '#0e2236', light: '#bfe9ff', crowd: ['#a8dadc', '#457b9d', '#f1faee', '#e63946', '#ffffff'], glow: '#bfe9ff' },
  { id: 6, key: 'arenaName6', table: '#2e6b3a', tableEdge: '#1b4224', floor: '#0b1a0f', wall: '#0c2415', light: '#7dff9a', crowd: ['#70e000', '#38b000', '#ffd60a', '#ffffff', '#9ef01a'], glow: '#7dff9a' },
  { id: 7, key: 'arenaName7', table: '#0f7c8c', tableEdge: '#085966', floor: '#f2d7a0', wall: '#1d8fb0', light: '#fff3b0', crowd: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#ffffff'], glow: '#fff3b0' },
  { id: 8, key: 'arenaName8', table: '#2a1b5c', tableEdge: '#180f38', floor: '#070512', wall: '#0c0a24', light: '#b388ff', crowd: ['#b388ff', '#ff80c0', '#80d8ff', '#ffe082', '#ffffff'], glow: '#b388ff' },
  { id: 9, key: 'arenaName9', table: '#5b4a1c', tableEdge: '#3a2f10', floor: '#120c04', wall: '#1d1606', light: '#ffd768', crowd: ['#f7d774', '#c9971c', '#ffffff', '#8e5a1a', '#fff1b8'], glow: '#ffd768' },
];

const CAM_POS = [0, 2.05, 5.0];
const CAM_TGT = [0, 0.78, -0.2];
const BALL_SKINS = {
  std: { fill: '#fdfdfb', glow: null, trail: null },
  fire: { fill: '#ffe2a6', glow: '#ff7a1a', trail: [255, 140, 40] },
  ice: { fill: '#eaf8ff', glow: '#7fd8ff', trail: [120, 210, 255] },
  neon: { fill: '#fff0fa', glow: '#ff4fd8', trail: [255, 80, 200] },
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Deterministic PRNG for crowd placement.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createRenderer(canvas, arena0) {
  const ctx = canvas.getContext('2d');
  let W = 390;
  let H = 844;
  let dpr = 1;
  let f = 600;
  let cx = 195;
  let cy = 422;
  let arena = arena0;
  let basis = null;
  let crowd = [];
  const particles = [];
  let shake = 0;
  let excite = 0;
  let time = 0;

  function buildBasis() {
    const fwd = norm(sub(CAM_TGT, CAM_POS));
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    basis = { fwd, right, up };
  }

  // Projects a world point to screen pixels. Returns [sx, sy, scale] or null.
  function proj(x, y, z) {
    const d = [x - CAM_POS[0], y - CAM_POS[1], z - CAM_POS[2]];
    const zc = dot(d, basis.fwd);
    if (zc < 0.2) return null;
    const xc = dot(d, basis.right);
    const yc = dot(d, basis.up);
    const s = f / zc;
    return [cx + xc * s + shakeX(), cy - yc * s + shakeY(), s];
  }
  const jit = () => (shake > 0 ? (Math.random() * 2 - 1) * shake : 0);
  let sx0 = 0;
  let sy0 = 0;
  const shakeX = () => sx0;
  const shakeY = () => sy0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(300, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    f = Math.min(W * 1.75, H * 1.0);
    cx = W / 2;
    cy = H * 0.5;
    buildBasis();
    buildCrowd();
  }

  function buildCrowd() {
    const rnd = seeded(42 + arena.id * 17);
    crowd = [];
    for (let i = 0; i < 230; i++) {
      const row = Math.floor(rnd() * 5);
      const side = rnd();
      let x, y, z;
      if (side < 0.62) {
        x = -6 + rnd() * 12;
        y = 0.6 + row * 0.42 + rnd() * 0.1;
        z = -6.2 - row * 0.3;
      } else {
        x = side < 0.81 ? -4.4 - row * 0.3 : 4.4 + row * 0.3;
        y = 0.6 + row * 0.42 + rnd() * 0.1;
        z = -3.5 + rnd() * 7.5;
      }
      crowd.push({ x, y, z, c: arena.crowd[Math.floor(rnd() * arena.crowd.length)], ph: rnd() * 6.28, hair: rnd() < 0.5 });
    }
  }

  function setArena(a) {
    arena = a;
    buildCrowd();
  }

  // ---------- backdrop ----------
  function drawBackdrop(t, exc) {
    // wall gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(arena.wall, 0.4));
    g.addColorStop(0.45, arena.wall);
    g.addColorStop(1, arena.floor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // light beams from the top
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const bx = W * (0.2 + i * 0.3) + Math.sin(t * 0.4 + i) * 20;
      const gr = ctx.createRadialGradient(bx, -40, 10, bx, -40, H * 0.9);
      gr.addColorStop(0, withAlpha(arena.light, 0.28 + 0.06 * exc));
      gr.addColorStop(1, withAlpha(arena.light, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    const wg = ctx.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.3, W * 0.9);
    wg.addColorStop(0, withAlpha(arena.light, 0.3));
    wg.addColorStop(1, withAlpha(arena.light, 0));
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, H);
    // back wall (z = -6.2) and crowd stand rows
    const wallQ = [proj(-6, 0, -6.4), proj(6, 0, -6.4), proj(6, 4.5, -6.4), proj(-6, 4.5, -6.4)];
    if (wallQ.every(Boolean)) {
      ctx.fillStyle = shade(arena.wall, 0.15);
      ctx.beginPath();
      ctx.moveTo(wallQ[0][0], wallQ[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(wallQ[i][0], wallQ[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    // side stands
    for (const sx of [-1, 1]) {
      const q = [proj(sx * 4.4, 0, -3.5), proj(sx * 4.4, 0, 4), proj(sx * 4.4, 3.2, 4), proj(sx * 4.4, 3.2, -3.5)];
      if (q.every(Boolean)) {
        ctx.fillStyle = shade(arena.wall, 0.08);
        ctx.beginPath();
        ctx.moveTo(q[0][0], q[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]);
        ctx.closePath();
        ctx.fill();
      }
    }

    // floor
    const fq = [proj(-6, 0, -6.4), proj(6, 0, -6.4), proj(6, 0, 6), proj(-6, 0, 6)];
    if (fq.every(Boolean)) {
      const fg = ctx.createLinearGradient(0, fq[0][1], 0, H);
      fg.addColorStop(0, shade(arena.floor, 1.6));
      fg.addColorStop(1, shade(arena.floor, 0.6));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fq[0][0], fq[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(fq[i][0], fq[i][1]);
      ctx.closePath();
      ctx.fill();
    }

    // crowd (behind everything else)
    for (const p of crowd) {
      const q = proj(p.x, p.y + (excite > 0.1 ? Math.abs(Math.sin(t * 6 + p.ph)) * 0.12 * exc : 0), p.z);
      if (!q) continue;
      const s = q[2];
      const r = Math.max(2, 0.13 * s);
      ctx.fillStyle = shade(p.c, 0.55);
      ctx.fillRect(q[0] - r * 1.1, q[1], r * 2.2, r * 3.2);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(q[0], q[1] - r * 0.25, r, 0, Math.PI * 2);
      ctx.fill();
      if (p.hair) {
        ctx.fillStyle = '#20150c';
        ctx.beginPath();
        ctx.arc(q[0], q[1] - r * 0.55, r * 0.9, Math.PI, 0);
        ctx.fill();
      }
    }
  }

  function drawFloorShadowSpot(x, z, rad, alpha) {
    const q = proj(x, 0.002, z);
    if (!q) return;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], rad * q[2] * 1.5, rad * q[2] * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- table ----------
  function drawTable() {
    // legs
    const legs = [
      [-HALF_W + 0.07, -HALF_L + 0.07],
      [HALF_W - 0.07, -HALF_L + 0.07],
      [-HALF_W + 0.07, HALF_L - 0.07],
      [HALF_W - 0.07, HALF_L - 0.07],
    ];
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 1;
    for (const [lx, lz] of legs) {
      const a = proj(lx, TABLE_Y, lz);
      const b = proj(lx, 0, lz);
      if (!a || !b) continue;
      ctx.lineWidth = Math.max(2, 0.05 * a[2]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    // apron (front face, near end)
    const top = [
      proj(-HALF_W, TABLE_Y, -HALF_L),
      proj(HALF_W, TABLE_Y, -HALF_L),
      proj(HALF_W, TABLE_Y, HALF_L),
      proj(-HALF_W, TABLE_Y, HALF_L),
    ];
    if (top.some((p) => !p)) return;
    // thickness: near edge side face
    const bottomNear = [proj(-HALF_W, TABLE_Y - 0.025, HALF_L), proj(HALF_W, TABLE_Y - 0.025, HALF_L)];
    if (bottomNear[0] && bottomNear[1]) {
      ctx.fillStyle = arena.tableEdge;
      ctx.beginPath();
      ctx.moveTo(top[3][0], top[3][1]);
      ctx.lineTo(top[2][0], top[2][1]);
      ctx.lineTo(bottomNear[1][0], bottomNear[1][1]);
      ctx.lineTo(bottomNear[0][0], bottomNear[0][1]);
      ctx.closePath();
      ctx.fill();
    }
    // surface
    const tg = ctx.createLinearGradient(0, top[0][1], 0, top[2][1]);
    tg.addColorStop(0, shade(arena.table, 1.25));
    tg.addColorStop(1, shade(arena.table, 0.85));
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(top[i][0], top[i][1]);
    ctx.closePath();
    ctx.fill();
    // lines
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, 0.012 * (top[0][2] + top[2][2]) * 0.5);
    const line = (a, b) => {
      const p = proj(a[0], TABLE_Y + 0.001, a[1]);
      const q = proj(b[0], TABLE_Y + 0.001, b[1]);
      if (!p || !q) return;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    };
    line([0, -HALF_L], [0, HALF_L]);
    line([-HALF_W, -HALF_L + 0.01], [HALF_W, -HALF_L + 0.01]);
    line([-HALF_W, HALF_L - 0.01], [HALF_W, HALF_L - 0.01]);
    line([-HALF_W + 0.01, -HALF_L], [-HALF_W + 0.01, HALF_L]);
    line([HALF_W - 0.01, -HALF_L], [HALF_W - 0.01, HALF_L]);
  }

  function drawNet() {
    const bl = proj(-NET_HALF, TABLE_Y, 0);
    const br = proj(NET_HALF, TABLE_Y, 0);
    const tl = proj(-NET_HALF, NET_TOP, 0);
    const tr = proj(NET_HALF, NET_TOP, 0);
    if (!bl || !br || !tl || !tr) return;
    // posts
    ctx.strokeStyle = '#d8d8de';
    ctx.lineWidth = Math.max(1.5, 0.02 * bl[2]);
    ctx.beginPath();
    ctx.moveTo(bl[0], bl[1]);
    ctx.lineTo(tl[0], tl[1]);
    ctx.moveTo(br[0], br[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.stroke();
    // mesh
    ctx.fillStyle = 'rgba(245,245,250,0.22)';
    ctx.beginPath();
    ctx.moveTo(bl[0], bl[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.lineTo(tl[0], tl[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const a = proj(-NET_HALF + ((2 * NET_HALF) * i) / 8, TABLE_Y, 0);
      const b = proj(-NET_HALF + ((2 * NET_HALF) * i) / 8, NET_TOP, 0);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    // white tape
    ctx.strokeStyle = '#f6f6f8';
    ctx.lineWidth = Math.max(2, 0.018 * tl[2]);
    ctx.beginPath();
    ctx.moveTo(tl[0], tl[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.stroke();
  }

  // ---------- players ----------
  // side 0 = player (near), 1 = opponent (far). fx.swing = 0..1 (swing progress)
  function drawPlayer(side, paddleX, paddleY, paddleZ, swing, look) {
    const zb = side === 0 ? 2.6 : -2.6;
    const shirt = side === 0 ? look.shirt : look.shirt2;
    const skin = look.skin;
    const hip = [paddleX * 0.25, 0.92, zb];
    const shoulder = [paddleX * 0.35 + (side === 0 ? 0.12 : -0.12), 1.36, zb + (side === 0 ? -0.06 : 0.06)];
    const head = [paddleX * 0.3, 1.6, zb];
    const hand = [paddleX, paddleY, paddleZ];
    // elbow pushed out
    const elbow = [(shoulder[0] + hand[0]) / 2 + (side === 0 ? 0.22 : -0.22), (shoulder[1] + hand[1]) / 2 + 0.06, (shoulder[2] + hand[2]) / 2 + (side === 0 ? 0.22 : -0.22)];
    const legL = [hip[0] - 0.12, 0, zb];
    const legR = [hip[0] + 0.12, 0, zb];
    const wob = Math.sin(time * 4 + (side ? 1 : 0)) * 0.015;
    const pts = {
      hip: proj(hip[0], hip[1] + wob, hip[2]),
      sh: proj(shoulder[0], shoulder[1], shoulder[2]),
      head: proj(head[0], head[1] + wob, head[2]),
      el: proj(elbow[0], elbow[1], elbow[2]),
      hand: proj(hand[0], hand[1], hand[2]),
      lf: proj(legL[0], legL[1], legL[2]),
      rf: proj(legR[0], legR[1], legR[2]),
    };
    if (!pts.hip || !pts.sh || !pts.head) return;
    const s = pts.hip[2];
    // legs (shorts) and shoes
    ctx.lineCap = 'round';
    ctx.strokeStyle = look.shorts;
    ctx.lineWidth = Math.max(3, 0.1 * s);
    ctx.beginPath();
    ctx.moveTo(pts.hip[0] - 0.12 * s, pts.hip[1]);
    ctx.lineTo(pts.lf[0], pts.lf[1]);
    ctx.moveTo(pts.hip[0] + 0.12 * s, pts.hip[1]);
    ctx.lineTo(pts.rf[0], pts.rf[1]);
    ctx.stroke();
    ctx.strokeStyle = look.shoe;
    ctx.lineWidth = Math.max(2, 0.06 * s);
    ctx.beginPath();
    ctx.moveTo(pts.lf[0], pts.lf[1] - 0.05 * s);
    ctx.lineTo(pts.lf[0] + 0.03 * s, pts.lf[1]);
    ctx.moveTo(pts.rf[0], pts.rf[1] - 0.05 * s);
    ctx.lineTo(pts.rf[0] + 0.03 * s, pts.rf[1]);
    ctx.stroke();
    // torso
    ctx.strokeStyle = shirt;
    ctx.lineWidth = Math.max(4, 0.17 * s);
    ctx.beginPath();
    ctx.moveTo(pts.hip[0], pts.hip[1]);
    ctx.lineTo(pts.sh[0], pts.sh[1]);
    ctx.stroke();
    // arm (sleeve, then skin forearm)
    if (pts.el && pts.hand) {
      ctx.strokeStyle = shirt;
      ctx.lineWidth = Math.max(2, 0.07 * s);
      ctx.beginPath();
      ctx.moveTo(pts.sh[0], pts.sh[1]);
      ctx.lineTo(pts.el[0], pts.el[1]);
      ctx.stroke();
      ctx.strokeStyle = skin;
      ctx.lineWidth = Math.max(2, 0.06 * s);
      ctx.beginPath();
      ctx.moveTo(pts.el[0], pts.el[1]);
      ctx.lineTo(pts.hand[0], pts.hand[1]);
      ctx.stroke();
      // paddle
      const rx = Math.max(4, 0.085 * pts.hand[2]);
      const ry = rx * 1.05;
      const tilt = side === 0 ? -0.35 : 0.35;
      ctx.save();
      ctx.translate(pts.hand[0], pts.hand[1]);
      ctx.rotate(tilt + swing * 0.5);
      ctx.fillStyle = look.rubber;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.wood;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(pts.head[0], pts.head[1], Math.max(4, 0.1 * s), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(pts.head[0], pts.head[1] - 0.03 * s, Math.max(4, 0.1 * s), Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.lineCap = 'butt';
  }

  // ---------- ball ----------
  function drawBall(b, skin, trail) {
    const bs = BALL_SKINS[skin] || BALL_SKINS.std;
    // trail: list of world positions oldest→newest
    if (trail && trail.length > 1 && bs.trail) {
      for (let i = 1; i < trail.length; i++) {
        const a = proj(trail[i - 1][0], trail[i - 1][1], trail[i - 1][2]);
        const c = proj(trail[i][0], trail[i][1], trail[i][2]);
        if (!a || !c) continue;
        const k = i / trail.length;
        ctx.strokeStyle = `rgba(${bs.trail[0]},${bs.trail[1]},${bs.trail[2]},${0.55 * k})`;
        ctx.lineWidth = Math.max(1.5, 0.035 * c[2] * k * 2);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.stroke();
      }
    }
    const q = proj(b.p[0], b.p[1], b.p[2]);
    if (!q) return;
    const r = Math.max(2, R * q[2]);
    if (bs.glow) {
      const g = ctx.createRadialGradient(q[0], q[1], r * 0.5, q[0], q[1], r * 3);
      g.addColorStop(0, withAlpha(bs.glow, 0.7));
      g.addColorStop(1, withAlpha(bs.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q[0], q[1], r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const grd = ctx.createRadialGradient(q[0] - r * 0.35, q[1] - r * 0.4, r * 0.1, q[0], q[1], r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.6, bs.fill);
    grd.addColorStop(1, '#c9ccd4');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBallShadow(b) {
    const inside = Math.abs(b.p[0]) <= HALF_W && Math.abs(b.p[2]) <= HALF_L;
    const surfY = inside && b.p[1] > TABLE_Y ? TABLE_Y : 0;
    const h = b.p[1] - surfY;
    const k = clamp(1 - h * 0.55, 0.25, 1);
    const a = clamp(0.5 - h * 0.25, 0.05, 0.5);
    const q = proj(b.p[0], surfY + 0.002, b.p[2]);
    if (!q) return;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], R * q[2] * 1.6 * k, R * q[2] * 0.9 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- particles ----------
  function spark(x, y, z, power, color, count) {
    const n = count || Math.round(6 + power * 22);
    for (let i = 0; i < n && particles.length < 220; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * (1.2 + power * 3);
      particles.push({
        x, y, z,
        vx: Math.cos(a) * sp * 0.6,
        vy: Math.random() * sp * 0.7 + 0.2,
        vz: Math.sin(a) * sp * 0.6 + (Math.random() - 0.5),
        life: 0.4 + Math.random() * 0.4,
        t: 0,
        color,
        size: 0.012 + Math.random() * 0.012,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t > p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vy -= 6 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(TABLE_Y, p.y + p.vy * dt);
      p.z += p.vz * dt;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const q = proj(p.x, p.y, p.z);
      if (!q) continue;
      const a = 1 - p.t / p.life;
      ctx.fillStyle = withAlpha(p.color, a);
      ctx.beginPath();
      ctx.arc(q[0], q[1], Math.max(1, p.size * q[2] * (0.6 + a * 0.6)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- main draw ----------
  // state: { match, look, ballSkin, swing: {player, ai}, trail, eff: {shake, excite, slow} }
  function draw(st, dt) {
    time += dt;
    shake = Math.max(0, shake - dt * 30);
    if (st.shake) shake = Math.max(shake, st.shake);
    sx0 = jit();
    sy0 = jit() * 0.6;
    excite = st.excite || 0;
    updateParticles(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackdrop(time, excite);
    const m = st.match;
    const b = m.ball;

    // far player, table, net, near player
    drawPlayer(1, m.aiX, 0.98, -1.55, st.swing.ai || 0, st.look.ai);
    drawFloorShadowSpot(0, 0, 0.5, 0.12);
    drawTable();
    drawNet();
    if (!b.hold || m.phase !== 'serveWait') drawBallShadow(b);
    if (st.trail && st.trail.length) drawBall(b, st.ballSkin, st.trail);
    else drawBall(b, st.ballSkin, null);
    drawParticles();
    drawPlayer(0, m.px, 0.98, 1.55, st.swing.player || 0, st.look.player);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function getProj(x, y, z) {
    return proj(x, y, z);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    draw,
    resize,
    setArena,
    spark,
    proj: getProj,
    get W() {
      return W;
    },
    get H() {
      return H;
    },
    shakeNow(v) {
      shake = Math.max(shake, v);
    },
    destroy() {
      window.removeEventListener('resize', resize);
    },
  };
}

// helpers for colours
export function withAlpha(hex, a) {
  if (hex.startsWith('rgba')) return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}

export function shade(hex, k) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = clamp(Math.round(((n >> 16) & 255) * k), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * k), 0, 255);
  const b = clamp(Math.round((n & 255) * k), 0, 255);
  return `rgb(${r},${g},${b})`;
}
