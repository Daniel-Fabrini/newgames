// Per-frame renderer: prerendered venue (scene.js) + net, ball with shadow and
// trail, the opponent's paddle, your floating paddle with a rainbow swing ribbon,
// sparks and crowd flashes. First-person camera, no bodies.
import { R, TABLE_Y, HALF_W, HALF_L, NET_TOP, clamp } from './logic.js';
import { ARENAS } from './arenas.js';
import { makeCamera, buildScene, glow, rgba } from './scene.js';

export { ARENAS };

const BALL_SKINS = {
  std: { fill: '#fdfdfb', glow: null, trail: [235, 240, 255] },
  fire: { fill: '#ffe2a6', glow: '#ff7a1a', trail: [255, 140, 40] },
  ice: { fill: '#eaf8ff', glow: '#7fd8ff', trail: [120, 210, 255] },
  neon: { fill: '#fff0fa', glow: '#ff4fd8', trail: [255, 80, 200] },
};
const RAINBOW = ['#ff3b3b', '#ff9f1a', '#ffe14d', '#3ddc84', '#3fb6ff', '#8a5bff'];
const NET_X = HALF_W + 0.15;

export function createRenderer(canvas, arena0, label0) {
  const ctx = canvas.getContext('2d');
  let arena = arena0;
  let label = label0 || '';
  let W = 390;
  let H = 780;
  let dpr = 1;
  let cam = null;
  let scene = null;
  const particles = [];
  const flashes = [];
  let shake = 0;
  let time = 0;
  const pad = { x: 0, y: 0, ang: -0.5, init: false };
  const padTrail = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(300, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cam = makeCamera(W, H);
    scene = buildScene(cam, arena, label, dpr);
    pad.init = false;
  }

  function setArena(a, lbl) {
    arena = a;
    if (lbl) label = lbl;
    resize();
  }

  const proj = (x, y, z) => cam.proj(x, y, z);

  // ---------- net ----------
  function drawNet() {
    const bl = proj(-NET_X, TABLE_Y, 0);
    const br = proj(NET_X, TABLE_Y, 0);
    const tl = proj(-NET_X, NET_TOP, 0);
    const tr = proj(NET_X, NET_TOP, 0);
    if (!bl || !br || !tl || !tr) return;
    ctx.fillStyle = 'rgba(16,18,28,0.55)';
    ctx.beginPath();
    ctx.moveTo(bl[0], bl[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.lineTo(tl[0], tl[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 1; i < 60; i++) {
      const x = tl[0] + ((tr[0] - tl[0]) * i) / 60;
      ctx.moveTo(x, tl[1]);
      ctx.lineTo(x, bl[1]);
    }
    for (let j = 1; j < 5; j++) {
      const y = tl[1] + ((bl[1] - tl[1]) * j) / 5;
      ctx.moveTo(tl[0], y);
      ctx.lineTo(tr[0], y);
    }
    ctx.stroke();
    // tape
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, 0.022 * tl[2]);
    ctx.beginPath();
    ctx.moveTo(tl[0], tl[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.stroke();
    // posts and clamps
    for (const [b, t] of [[bl, tl], [br, tr]]) {
      ctx.strokeStyle = '#1b1c22';
      ctx.lineWidth = Math.max(3, 0.03 * b[2]);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1] + 0.03 * b[2]);
      ctx.lineTo(t[0], t[1]);
      ctx.stroke();
      ctx.fillStyle = arena.apron;
      ctx.fillRect(b[0] - 0.025 * b[2], b[1] - 0.01 * b[2], 0.05 * b[2], 0.035 * b[2]);
    }
  }

  // ---------- ball ----------
  function drawBallShadow(b) {
    const inside = Math.abs(b.p[0]) <= HALF_W && Math.abs(b.p[2]) <= HALF_L && b.p[1] >= TABLE_Y;
    const surfY = inside ? TABLE_Y : 0;
    const h = b.p[1] - surfY;
    const k = clamp(1 - h * 0.45, 0.35, 1);
    const a = clamp(0.55 - h * 0.3, 0.08, 0.55);
    const q = proj(b.p[0], surfY + 0.002, b.p[2]);
    if (!q) return;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], R * q[2] * 1.7 * k, R * q[2] * 0.8 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBall(b, skin, trail) {
    const bs = BALL_SKINS[skin] || BALL_SKINS.std;
    if (trail && trail.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = proj(trail[i - 1][0], trail[i - 1][1], trail[i - 1][2]);
        const c = proj(trail[i][0], trail[i][1], trail[i][2]);
        if (!a || !c) continue;
        const k = i / trail.length;
        ctx.strokeStyle = `rgba(${bs.trail[0]},${bs.trail[1]},${bs.trail[2]},${(skin === 'std' ? 0.35 : 0.6) * k})`;
        ctx.lineWidth = Math.max(1.5, R * c[2] * 2 * k);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    const q = proj(b.p[0], b.p[1], b.p[2]);
    if (!q) return;
    const r = Math.max(3, R * q[2] * 1.25);
    if (bs.glow) {
      glow(ctx, q[0], q[1], r * 3.2, bs.glow, 0.7);
    }
    const grd = ctx.createRadialGradient(q[0] - r * 0.35, q[1] - r * 0.4, r * 0.1, q[0], q[1], r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.6, bs.fill);
    grd.addColorStop(1, '#bfc3cc');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- paddles ----------
  function drawPaddle(x, y, r, ang, rubber, wrap, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // soft drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.2, y + r * 0.35, r * 0.95, r * 0.8, ang, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // handle
    const hw = r * 0.34;
    const hl = r * 1.15;
    const hg = ctx.createLinearGradient(-hw / 2, 0, hw / 2, 0);
    hg.addColorStop(0, '#8a5a2b');
    hg.addColorStop(0.5, '#d6a066');
    hg.addColorStop(1, '#7a4c22');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.45, r * 0.8);
    ctx.lineTo(hw * 0.45, r * 0.8);
    ctx.lineTo(hw / 2, r * 0.8 + hl);
    ctx.quadraticCurveTo(0, r * 0.8 + hl + hw * 0.5, -hw / 2, r * 0.8 + hl);
    ctx.closePath();
    ctx.fill();
    // colourful wrap
    ctx.save();
    ctx.clip();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = wrap[k % wrap.length];
      ctx.beginPath();
      const y0 = r * 1.15 + k * hl * 0.16;
      ctx.moveTo(-hw, y0);
      ctx.lineTo(hw, y0 - hw * 0.6);
      ctx.lineTo(hw, y0 - hw * 0.6 + hl * 0.08);
      ctx.lineTo(-hw, y0 + hl * 0.08);
      ctx.fill();
    }
    ctx.restore();
    // blade edge (wood) and rubber
    ctx.fillStyle = '#5a3a1e';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.03, r * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();
    const rg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    rg.addColorStop(0, rubber === 'red' ? '#ff5a52' : '#4a4a52');
    rg.addColorStop(0.55, rubber === 'red' ? '#d61f26' : '#1f1f25');
    rg.addColorStop(1, rubber === 'red' ? '#8e0f14' : '#0c0c10');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    // specular sheen
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.45, r * 0.28, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPadTrail() {
    if (padTrail.length < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const w = W * 0.012;
    for (let c = 0; c < RAINBOW.length; c++) {
      const off = (c - RAINBOW.length / 2) * w;
      ctx.strokeStyle = RAINBOW[c];
      for (let i = 1; i < padTrail.length; i++) {
        const a = padTrail[i - 1];
        const b = padTrail[i];
        const age = Math.min(a.t, b.t);
        const al = clamp(1 - age / 0.32, 0, 1) * (i / padTrail.length);
        if (al <= 0) continue;
        ctx.globalAlpha = al * 0.85;
        ctx.lineWidth = w * 1.1;
        ctx.beginPath();
        ctx.moveTo(a.x + off * 0.6, a.y + off);
        ctx.lineTo(b.x + off * 0.6, b.y + off);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  function updatePlayerPaddle(m, st, dt) {
    const b = m.ball;
    // ready pose: low on the forehand side, following the ball laterally
    const ready = proj(clamp(m.px, -0.9, 0.9) * 0.7 + 0.6, 0.9, 1.75) || [W * 0.7, H * 0.85];
    let tx = ready[0];
    let ty = ready[1];
    let ta = -0.55;
    const comming = m.phase === 'rally' && m.lastHit === 1 && b.v[2] > 0 && b.p[2] > 0.2;
    if (comming || m.phase === 'toss') {
      const bp = proj(b.p[0] + 0.12, Math.max(b.p[1], TABLE_Y + 0.05), Math.min(b.p[2], 1.9));
      if (bp) {
        const k = m.phase === 'toss' ? 0.5 : clamp((b.p[2] - 0.2) / 1.3, 0, 0.75);
        tx += (bp[0] + W * 0.05 - tx) * k;
        ty += (bp[1] + W * 0.08 - ty) * k;
      }
    }
    if (st.finger) {
      tx = st.finger.x + W * 0.04;
      ty = st.finger.y - W * 0.02;
    }
    const sw = st.swing.player || 0;
    if (sw > 0) {
      // swing: brush up and across, blade turns over
      tx += Math.sin(sw * Math.PI) * W * 0.06;
      ty -= Math.sin(sw * Math.PI) * W * 0.18;
      ta = -0.55 + (1 - sw) * 0.9;
    }
    if (!pad.init) {
      pad.x = tx;
      pad.y = ty;
      pad.init = true;
    }
    const k = 1 - Math.exp(-dt * (st.finger ? 30 : sw > 0 ? 22 : 9));
    const nx = pad.x + (tx - pad.x) * k;
    const ny = pad.y + (ty - pad.y) * k;
    const speed = Math.hypot(nx - pad.x, ny - pad.y) / Math.max(dt, 1e-3);
    pad.x = nx;
    pad.y = ny;
    pad.ang += (ta - pad.ang) * k;
    for (const p of padTrail) p.t += dt;
    if (speed > W * 1.4) padTrail.push({ x: pad.x, y: pad.y, t: 0 });
    while (padTrail.length && (padTrail[0].t > 0.32 || padTrail.length > 24)) padTrail.shift();
  }

  // ---------- particles ----------
  function spark(x, y, z, power, color, count) {
    const n = count || Math.round(6 + power * 22);
    for (let i = 0; i < n && particles.length < 220; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * (1.2 + power * 3);
      particles.push({ x, y, z, vx: Math.cos(a) * sp * 0.6, vy: Math.random() * sp * 0.7 + 0.2, vz: Math.sin(a) * sp * 0.6, life: 0.35 + Math.random() * 0.35, t: 0, color, size: 0.01 + Math.random() * 0.01 });
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
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const q = proj(p.x, p.y, p.z);
      if (!q) continue;
      const a = 1 - p.t / p.life;
      ctx.fillStyle = rgba(p.color, a);
      ctx.beginPath();
      ctx.arc(q[0], q[1], Math.max(1, p.size * q[2] * (0.6 + a)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function crowdFlashes(dt, excite) {
    if (Math.random() < dt * (0.6 + excite * 6)) {
      const a = proj(0, 2.0, -7.0);
      const b = proj(0, 5.0, -10.0);
      if (a && b) flashes.push({ x: Math.random() * W, y: b[1] + Math.random() * (a[1] - b[1]), t: 0 });
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      if (f.t > 0.18) {
        flashes.splice(i, 1);
        continue;
      }
      glow(ctx, f.x, f.y, 10, '#ffffff', 0.9 * (1 - f.t / 0.18));
    }
  }

  // ---------- main draw ----------
  function draw(st, dt) {
    time += dt;
    shake = Math.max(0, shake - dt * 30);
    if (st.shake) shake = Math.max(shake, st.shake);
    const sx = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake > 0 ? (Math.random() * 2 - 1) * shake * 0.6 : 0;
    updateParticles(dt);
    const m = st.match;
    const b = m.ball;
    updatePlayerPaddle(m, st, dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    cam.ox = sx;
    cam.oy = sy;
    ctx.drawImage(scene, sx, sy, W, H);
    crowdFlashes(dt, st.excite || 0);

    // opponent paddle (far side)
    const op = proj(m.aiX + 0.22, 1.0 + (st.swing.ai || 0) * 0.12, -1.7);
    if (op) drawPaddle(op[0], op[1], 0.09 * op[2] * 1.1, 0.6 - (st.swing.ai || 0) * 0.8, 'red', ['#ffffff', '#d61f26'], 0.95);

    const showBall = !(b.hold && m.phase === 'serveWait' && m.server === 0) || true;
    if (showBall) drawBallShadow(b);
    const behind = b.p[2] < 0;
    if (behind) drawBall(b, st.ballSkin, st.trail);
    drawNet();
    if (!behind) drawBall(b, st.ballSkin, st.trail);
    drawParticles();
    drawPadTrail();
    pad.x = Math.min(pad.x, W - W * 0.11);
    drawPaddle(pad.x, pad.y, W * 0.095, pad.ang, 'black', ['#ff3fa8', '#3fd0ff', '#ffe14d']);
    cam.ox = 0;
    cam.oy = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    draw,
    resize,
    setArena,
    spark,
    proj: (x, y, z) => cam.proj(x, y, z),
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

export function withAlpha(hex, a) {
  return rgba(hex, a);
}
