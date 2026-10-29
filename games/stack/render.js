// Block Tower renderer: Canvas 2D with a hand-made perspective projection, painter's sort,
// procedural wood textures (affine mapped), directional lighting and soft ground shadows.
import { W, H, L } from './sim.js';

const TAU = Math.PI * 2;
const LIGHT = (() => {
  const l = [0.45, 1.0, 0.35];
  const n = Math.hypot(...l);
  return l.map((c) => c / n);
})();

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------- wood textures
const TONES = [
  { base: [224, 178, 112], dark: [150, 96, 44] },
  { base: [213, 160, 92], dark: [138, 84, 36] },
  { base: [234, 192, 128], dark: [160, 108, 52] },
];

function makeLong(tone, seed) {
  const w = 320, h = 96;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const r = rng(seed);
  const [br, bg, bb] = tone.base;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgb(${br + 10},${bg + 8},${bb + 6})`);
  grad.addColorStop(0.5, `rgb(${br},${bg},${bb})`);
  grad.addColorStop(1, `rgb(${br - 14},${bg - 14},${bb - 10})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // broad growth bands
  for (let i = 0; i < 7; i++) {
    const y = r() * h, th = 4 + r() * 14;
    g.fillStyle = `rgba(${tone.dark[0]},${tone.dark[1]},${tone.dark[2]},${0.05 + r() * 0.09})`;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
    for (let x = w; x >= 0; x -= 16) g.lineTo(x, y + th + Math.sin(x * 0.02 + i + 1) * 3);
    g.closePath();
    g.fill();
  }
  // fine grain lines
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const y = r() * h;
    const amp = 0.6 + r() * 2.2, fr = 0.01 + r() * 0.03, ph = r() * TAU;
    g.strokeStyle = `rgba(${tone.dark[0] - 30},${tone.dark[1] - 30},${tone.dark[2] - 10},${0.07 + r() * 0.2})`;
    g.lineWidth = 0.5 + r() * 1.3;
    g.beginPath();
    for (let x = -4; x <= w + 4; x += 8) {
      const yy = y + Math.sin(x * fr + ph) * amp;
      if (x === -4) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  // light streaks
  for (let i = 0; i < 18; i++) {
    const y = r() * h;
    g.strokeStyle = `rgba(255,240,205,${0.05 + r() * 0.1})`;
    g.lineWidth = 0.8 + r();
    g.beginPath();
    g.moveTo(r() * w * 0.5, y);
    g.lineTo(w * (0.4 + r() * 0.6), y + (r() - 0.5) * 3);
    g.stroke();
  }
  // pores
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${tone.dark[0] - 40},${tone.dark[1] - 40},20,${0.1 + r() * 0.2})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 4, 0.6);
  }
  return c;
}

function makeEnd(tone, seed) {
  const s = 96;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = `rgb(${tone.base[0] - 8},${tone.base[1] - 8},${tone.base[2] - 6})`;
  g.fillRect(0, 0, s, s);
  const cx = s * (0.2 + r() * 0.6), cy = s * (0.9 + r() * 1.2);
  for (let rad = 6; rad < s * 2.4; rad += 3 + r() * 4) {
    g.strokeStyle = `rgba(${tone.dark[0] - 20},${tone.dark[1] - 24},${tone.dark[2] - 8},${0.18 + r() * 0.32})`;
    g.lineWidth = 0.8 + r() * 1.6;
    g.beginPath();
    g.arc(cx, cy, rad, 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(90,50,16,${0.05 + r() * 0.12})`;
    g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
  return c;
}

let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = { long: TONES.map((t, i) => makeLong(t, 11 + i * 97)), end: TONES.map((t, i) => makeEnd(t, 5 + i * 31)) };
  return TEX;
}

// ---------------------------------------------------------------- renderer
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const tex = textures();
  const shadowCanvas = document.createElement('canvas');
  const sctx = shadowCanvas.getContext('2d');
  const cam = { yaw: 0.6, pitch: 0.5, zoom: 1, ty: 5.2, dist: 26, shake: 0 };
  let cw = 300, ch = 500, dpr = 1;
  let focal = 800;
  // per-frame camera basis
  let C = [0, 0, 0], Fv = [0, 0, -1], Rv = [1, 0, 0], Uv = [0, 1, 0];
  let faces = []; // for picking (front to back order)
  let bg = null;
  const particles = [];

  function resize(w, h, ratio) {
    cw = Math.max(1, Math.floor(w * ratio));
    ch = Math.max(1, Math.floor(h * ratio));
    dpr = ratio;
    canvas.width = cw;
    canvas.height = ch;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    shadowCanvas.width = Math.max(8, Math.ceil(cw / 4));
    shadowCanvas.height = Math.max(8, Math.ceil(ch / 4));
    focal = ch * 1.5;
    bg = null;
  }

  function fitDistance(topY) {
    const ht = Math.max(7, topY + 2.8);
    const dv = (ht * focal) / (0.78 * ch);
    const dh = (8.2 * focal) / (0.94 * cw);
    return Math.max(dv, dh);
  }

  function setupCamera(topY, ox = 0, oy = 0) {
    const d = fitDistance(topY) * cam.zoom;
    cam.dist = d;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const T = [0, cam.ty, 0];
    C = [T[0] + d * cp * Math.sin(cam.yaw), T[1] + d * sp, T[2] + d * cp * Math.cos(cam.yaw)];
    Fv = [(T[0] - C[0]) / d, (T[1] - C[1]) / d, (T[2] - C[2]) / d];
    // right = normalize(f x up)
    let rx = Fv[1] * 0 - Fv[2] * 1, ry = Fv[2] * 0 - Fv[0] * 0, rz = Fv[0] * 1 - Fv[1] * 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    Rv = [rx / rl, ry / rl, rz / rl];
    Uv = [Rv[1] * Fv[2] - Rv[2] * Fv[1], Rv[2] * Fv[0] - Rv[0] * Fv[2], Rv[0] * Fv[1] - Rv[1] * Fv[0]];
    cam.ox = cw / 2 + ox;
    cam.oy = ch * 0.5 + oy;
  }

  function proj(p, out) {
    const rx = p[0] - C[0], ry = p[1] - C[1], rz = p[2] - C[2];
    const zc = rx * Fv[0] + ry * Fv[1] + rz * Fv[2];
    const xc = rx * Rv[0] + ry * Rv[1] + rz * Rv[2];
    const yc = rx * Uv[0] + ry * Uv[1] + rz * Uv[2];
    const k = focal / Math.max(0.5, zc);
    out[0] = cam.ox + xc * k;
    out[1] = cam.oy - yc * k;
    out[2] = zc;
    return out;
  }

  const FACE_DEF = [
    // axis, uAxis, vAxis
    { a: 0, u: 2, v: 1, end: true },
    { a: 1, u: 0, v: 2, end: false },
    { a: 2, u: 0, v: 1, end: false },
  ];

  function blockFaces(b, list) {
    const body = b.body;
    const ax = body.ax, e = body.e, p = body.p;
    for (const def of FACE_DEF) {
      for (const s of [1, -1]) {
        const n = [ax[def.a][0] * s, ax[def.a][1] * s, ax[def.a][2] * s];
        const ctr = [p[0] + n[0] * e[def.a], p[1] + n[1] * e[def.a], p[2] + n[2] * e[def.a]];
        // back-face culling
        if (n[0] * (C[0] - ctr[0]) + n[1] * (C[1] - ctr[1]) + n[2] * (C[2] - ctr[2]) <= 0) continue;
        const U = ax[def.u], V = ax[def.v], eu = e[def.u], ev = e[def.v];
        const q = [
          [ctr[0] - U[0] * eu - V[0] * ev, ctr[1] - U[1] * eu - V[1] * ev, ctr[2] - U[2] * eu - V[2] * ev],
          [ctr[0] + U[0] * eu - V[0] * ev, ctr[1] + U[1] * eu - V[1] * ev, ctr[2] + U[2] * eu - V[2] * ev],
          [ctr[0] + U[0] * eu + V[0] * ev, ctr[1] + U[1] * eu + V[1] * ev, ctr[2] + U[2] * eu + V[2] * ev],
          [ctr[0] - U[0] * eu + V[0] * ev, ctr[1] - U[1] * eu + V[1] * ev, ctr[2] - U[2] * eu + V[2] * ev],
        ].map((pt) => proj(pt, [0, 0, 0]));
        list.push({ b, n, q, def, s });
      }
    }
  }

  function background() {
    if (!bg) {
      bg = document.createElement('canvas');
      bg.width = cw;
      bg.height = ch;
      const g = bg.getContext('2d');
      const lg = g.createLinearGradient(0, 0, 0, ch);
      lg.addColorStop(0, '#15120b');
      lg.addColorStop(0.55, '#0c0b08');
      lg.addColorStop(1, '#050505');
      g.fillStyle = lg;
      g.fillRect(0, 0, cw, ch);
      const rg = g.createRadialGradient(cw / 2, ch * 0.42, 0, cw / 2, ch * 0.42, Math.max(cw, ch) * 0.7);
      rg.addColorStop(0, 'rgba(247,215,116,0.10)');
      rg.addColorStop(1, 'rgba(247,215,116,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, cw, ch);
    }
    ctx.drawImage(bg, 0, 0);
  }

  function drawTable() {
    const R = 8.2;
    const pts = [];
    const tmp = [0, 0, 0];
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * TAU;
      pts.push(proj([Math.cos(a) * R, 0, Math.sin(a) * R], [0, 0, 0]));
    }
    const o = proj([0, 0, 0], tmp);
    const rim = proj([R, 0, 0], [0, 0, 0]);
    const rad = Math.max(40, Math.hypot(rim[0] - o[0], (rim[1] - o[1]) * 3.2));
    ctx.save();
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    // table thickness (side) below
    const below = pts.map((q) => [q[0], q[1] + 0.5 * focal / Math.max(1, q[2])]);
    ctx.save();
    ctx.beginPath();
    below.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fillStyle = '#0a0907';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.translate(o[0], o[1]);
    ctx.scale(1, 0.31);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, '#2b2418');
    g.addColorStop(0.7, '#1a150d');
    g.addColorStop(1, '#0e0b07');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g;
    // fill with a simple gradient aligned in screen space instead (path is already in screen coords)
    const lg = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], rad);
    lg.addColorStop(0, '#2d2619');
    lg.addColorStop(0.65, '#1b160d');
    lg.addColorStop(1, '#0d0a06');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 * dpr);
    ctx.strokeStyle = 'rgba(247,215,116,0.55)';
    ctx.stroke();
    ctx.restore();
    // inner thin ring
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 56; i++) {
      const a = (i / 56) * TAU;
      const q = proj([Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2], [0, 0, 0]);
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.strokeStyle = 'rgba(247,215,116,0.12)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.stroke();
    ctx.restore();
  }

  // Ground shadow: the convex outline of every block projected along the light onto y = 0,
  // painted into a small canvas that is scaled up (cheap blur).
  function drawShadows(blocks) {
    const sw = shadowCanvas.width, sh = shadowCanvas.height;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, sw, sh);
    sctx.setTransform(sw / cw, 0, 0, sh / ch, 0, 0);
    sctx.fillStyle = 'rgba(0,0,0,1)';
    sctx.beginPath();
    const lx = -LIGHT[0] / LIGHT[1], lz = -LIGHT[2] / LIGHT[1];
    for (const b of blocks) {
      const ax = b.body.ax, e = b.body.e, p = b.body.p;
      const pts = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const x = p[0] + sx * e[0] * ax[0][0] + sy * e[1] * ax[1][0] + sz * e[2] * ax[2][0];
        const y = p[1] + sx * e[0] * ax[0][1] + sy * e[1] * ax[1][1] + sz * e[2] * ax[2][1] + 0;
        const z = p[2] + sx * e[0] * ax[0][2] + sy * e[1] * ax[1][2] + sz * e[2] * ax[2][2];
        const yy = Math.max(0, y);
        pts.push(proj([x + lx * yy, 0, z + lz * yy], [0, 0, 0]));
      }
      const hull = convexHull(pts);
      hull.forEach((q, i) => (i ? sctx.lineTo(q[0], q[1]) : sctx.moveTo(q[0], q[1])));
      sctx.closePath();
    }
    sctx.fill('nonzero');
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shadowCanvas, 0, 0, sw, sh, 0, 0, cw, ch);
    ctx.restore();
  }

  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [];
    for (const q of p) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    const up = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
      up.push(q);
    }
    up.pop();
    lo.pop();
    return lo.concat(up);
  }

  function drawFace(f, sel) {
    const q = f.q;
    const b = f.b;
    const t = f.def.end ? tex.end[b.variant] : tex.long[b.variant];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(q[0][0], q[0][1]);
    ctx.lineTo(q[1][0], q[1][1]);
    ctx.lineTo(q[2][0], q[2][1]);
    ctx.lineTo(q[3][0], q[3][1]);
    ctx.closePath();
    ctx.clip();
    const tw = t.width, th = t.height;
    // random-ish offset into the texture so every block looks different
    const off = ((b.id * 53) % 97) / 97;
    const sw = f.def.end ? tw : tw * 0.72;
    const sx = f.def.end ? 0 : off * (tw - sw);
    const e0x = q[1][0] - q[0][0], e0y = q[1][1] - q[0][1];
    const e1x = q[3][0] - q[0][0], e1y = q[3][1] - q[0][1];
    // slightly oversize to avoid hairline gaps
    ctx.setTransform((e0x / sw) , (e0y / sw), (e1x / th), (e1y / th), q[0][0], q[0][1]);
    ctx.drawImage(t, sx, 0, sw, th, -0.6, -0.6, sw + 1.2, th + 1.2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // lighting
    const lam = Math.max(0, f.n[0] * LIGHT[0] + f.n[1] * LIGHT[1] + f.n[2] * LIGHT[2]);
    const dark = 0.62 * (1 - lam) + 0.06;
    ctx.fillStyle = `rgba(14,8,2,${dark.toFixed(3)})`;
    ctx.fill();
    if (lam > 0.55) {
      ctx.fillStyle = `rgba(255,236,190,${((lam - 0.55) * 0.22).toFixed(3)})`;
      ctx.fill();
    }
    // ambient occlusion toward the lower edge of side faces
    if (f.def.a !== 1) {
      const lo = q[0][1] > q[3][1] ? [q[0], q[3]] : [q[3], q[0]];
      // gradient from the upper to lower edge
      const g = ctx.createLinearGradient((q[0][0] + q[1][0]) / 2, Math.min(q[0][1], q[3][1]), (q[2][0] + q[3][0]) / 2, Math.max(q[0][1], q[3][1]));
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = g;
      ctx.fill();
      void lo;
    }
    ctx.restore();
    // thin bevel
    ctx.beginPath();
    ctx.moveTo(q[0][0], q[0][1]);
    ctx.lineTo(q[1][0], q[1][1]);
    ctx.lineTo(q[2][0], q[2][1]);
    ctx.lineTo(q[3][0], q[3][1]);
    ctx.closePath();
    ctx.lineWidth = Math.max(0.8, dpr * 0.8);
    ctx.strokeStyle = lamEdge(f);
    ctx.stroke();
  }
  function lamEdge(f) {
    return f.n[1] > 0.5 ? 'rgba(255,240,200,0.35)' : 'rgba(40,22,6,0.55)';
  }

  function outline(blockFacesList, color, glow, width) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14 * dpr;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * dpr;
    for (const f of blockFacesList) {
      const q = f.q;
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      ctx.lineTo(q[1][0], q[1][1]);
      ctx.lineTo(q[2][0], q[2][1]);
      ctx.lineTo(q[3][0], q[3][1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw(sim, st) {
    const time = st.time || 0;
    const top = Math.max(0, sim.topLayerInfo().top);
    const topY = top * 0.604 + 0.6;
    const shakeX = st.shake ? (Math.random() - 0.5) * st.shake * dpr * 14 : 0;
    const shakeY = st.shake ? (Math.random() - 0.5) * st.shake * dpr * 14 : 0;
    setupCamera(topY, shakeX, shakeY);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    background();
    drawTable();
    const blocks = sim.blocks.slice();
    drawShadows(blocks);
    // painter's order: far to near by distance to the camera
    const order = blocks
      .map((b) => {
        const p = b.body.p;
        return { b, d: (p[0] - C[0]) ** 2 + (p[1] - C[1]) ** 2 + (p[2] - C[2]) ** 2 };
      })
      .sort((x, y) => y.d - x.d);
    faces = [];
    const selFaces = [];
    const flashFaces = [];
    for (const { b } of order) {
      const list = [];
      blockFaces(b, list);
      // within a block: far faces first (all remaining faces are front-facing, draw sides before top)
      list.sort((x, y) => x.q[0][2] + x.q[2][2] - (y.q[0][2] + y.q[2][2]) < 0 ? 1 : -1);
      for (const f of list) drawFace(f);
      if (st.selected === b) {
        for (const f of list) selFaces.push(f);
      }
      if (st.flash && st.flash.b === b) for (const f of list) flashFaces.push(f);
      for (const f of list) faces.push(f);
    }
    faces.reverse(); // near first for picking
    if (selFaces.length) {
      // glow wash then outline
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      for (const f of selFaces) {
        const q = f.q;
        ctx.beginPath();
        ctx.moveTo(q[0][0], q[0][1]);
        ctx.lineTo(q[1][0], q[1][1]);
        ctx.lineTo(q[2][0], q[2][1]);
        ctx.lineTo(q[3][0], q[3][1]);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,214,102,${(0.12 + pulse * 0.1).toFixed(3)})`;
        ctx.fill();
      }
      ctx.restore();
      outline(selFaces, '#ffd666', 'rgba(255,200,60,0.9)', 2.4);
    }
    if (flashFaces.length) outline(flashFaces, '#ff5a5a', 'rgba(255,60,60,0.9)', 2.6);
    // direction guide for the selected block
    if (st.guide && st.selected) drawGuide(st.selected, st.guide, time);
    drawParticles(st.dt || 0.016);
  }

  function drawGuide(b, dir, time) {
    const body = b.body;
    const a = body.ax[0];
    const sgn = dir;
    const p0 = [body.p[0] + a[0] * sgn * L * 0.62, body.p[1] + a[1] * sgn * L * 0.62, body.p[2] + a[2] * sgn * L * 0.62];
    const k = 1.1 + 0.25 * Math.sin(time * 4);
    const p1 = [body.p[0] + a[0] * sgn * (L * 0.62 + k), body.p[1], body.p[2] + a[2] * sgn * (L * 0.62 + k)];
    const s0 = proj(p0, [0, 0, 0]), s1 = proj(p1, [0, 0, 0]);
    const ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]);
    const len = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
    if (len < 6) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,214,102,0.9)';
    ctx.fillStyle = 'rgba(255,214,102,0.9)';
    ctx.lineWidth = 3 * dpr;
    ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.lineDashOffset = -time * 24;
    ctx.beginPath();
    ctx.moveTo(s0[0], s0[1]);
    ctx.lineTo(s1[0], s1[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(s1[0], s1[1]);
    ctx.rotate(ang);
    const hs = 9 * dpr;
    ctx.beginPath();
    ctx.moveTo(hs, 0);
    ctx.lineTo(-hs * 0.6, hs * 0.7);
    ctx.lineTo(-hs * 0.6, -hs * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function spawnDust(pos, n, power = 1) {
    const s = proj(pos, [0, 0, 0]);
    for (let i = 0; i < n && particles.length < 90; i++) {
      const a = Math.random() * TAU;
      const sp = (20 + Math.random() * 60) * power * dpr;
      particles.push({ x: s[0], y: s[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 20 * dpr, life: 0, max: 0.5 + Math.random() * 0.5, size: (3 + Math.random() * 6) * dpr });
    }
  }

  function drawParticles(dt) {
    if (!particles.length) return;
    ctx.save();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy = p.vy * 0.96 + 12 * dpr * dt;
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = k * 0.5;
      ctx.fillStyle = '#e9cf9a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.4 - k * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function pick(x, y) {
    const px = x * dpr, py = y * dpr;
    for (const f of faces) {
      const q = f.q;
      let inside = true;
      let sign = 0;
      for (let i = 0; i < 4; i++) {
        const a = q[i], b = q[(i + 1) % 4];
        const cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
        if (cr !== 0) {
          const sg = cr > 0 ? 1 : -1;
          if (sign === 0) sign = sg;
          else if (sg !== sign) {
            inside = false;
            break;
          }
        }
      }
      if (inside) return f.b;
    }
    return null;
  }

  // screen-space direction (px per world unit, CSS pixels) of the long axis of a block
  function axisScreen(b, sign = 1) {
    const body = b.body;
    const a = body.ax[0];
    const p0 = proj(body.p, [0, 0, 0]);
    const p1 = proj([body.p[0] + a[0] * sign, body.p[1] + a[1] * sign, body.p[2] + a[2] * sign], [0, 0, 0]);
    return [(p1[0] - p0[0]) / dpr, (p1[1] - p0[1]) / dpr];
  }

  function worldToScreen(p) {
    const s = proj(p, [0, 0, 0]);
    return [s[0] / dpr, s[1] / dpr];
  }

  return { cam, resize, draw, pick, axisScreen, worldToScreen, spawnDust, get dpr() { return dpr; } };
}
