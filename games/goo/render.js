// Goo Builder — Canvas 2D renderer: backdrop, terrain, hazards, strands, glossy goo balls, ghost preview, particles.
import { TYPES, pointInPoly } from './sim.js';
import { WORLDS } from './levels.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpColor(a, b, t) {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(mix(A[0], B[0], t))},${Math.round(mix(A[1], B[1], t))},${Math.round(mix(A[2], B[2], t))})`;
}
function shade(c, k) {
  const A = hex(c);
  const f = (v) => Math.round(clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
  return `rgb(${f(A[0])},${f(A[1])},${f(A[2])})`;
}

// ------------------------------------------------------------------ particles (world space)
export class Particles {
  constructor() {
    this.list = [];
  }
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread ?? 1) : Math.random() * TAU;
      const sp = (o.speed ?? 160) * (0.35 + Math.random() * 0.9);
      this.list.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0), life: 0, max: (o.life ?? 0.7) * (0.6 + Math.random() * 0.8),
        r: (o.size ?? 3) * (0.6 + Math.random() * 0.8), color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color || '#fff',
        g: o.g ?? 500, shape: o.shape || 'dot', spin: (Math.random() - 0.5) * 12, rot: Math.random() * TAU,
      });
    }
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life += dt;
      if (p.life >= p.max) {
        l[i] = l[l.length - 1];
        l.pop();
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 1 - 0.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }
  draw(c) {
    for (const p of this.list) {
      const k = 1 - p.life / p.max;
      c.globalAlpha = clamp(k * 1.6, 0, 1);
      c.fillStyle = p.color;
      if (p.shape === 'rect') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        c.restore();
      } else if (p.shape === 'star') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        const r = p.r * (0.6 + k * 0.6);
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const rr = i % 2 ? r * 0.4 : r;
          const a = (i / 8) * TAU;
          c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.fill();
        c.restore();
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.r * (p.shape === 'puff' ? 1 + (1 - k) * 1.5 : 0.5 + k * 0.5), 0, TAU);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ goo ball
export function drawGoo(c, x, y, r, type, o = {}) {
  const T = TYPES[type] || { color: '#9aa', dark: '#566' };
  const t = o.t || 0;
  const sq = o.squash || 0; // -1..1 vertical squash
  c.save();
  c.translate(x, y);
  if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  const sx = 1 + sq * 0.12, sy = 1 - sq * 0.12;
  c.scale(sx, sy);
  if (type === 'stake') {
    // peg that sticks into the terrain
    c.fillStyle = '#6a2a24';
    c.beginPath();
    c.moveTo(-r * 0.45, r * 0.1);
    c.lineTo(r * 0.45, r * 0.1);
    c.lineTo(0, r * 1.25);
    c.closePath();
    c.fill();
  }
  if (type === 'balloon') {
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(0, r * 0.95);
    c.quadraticCurveTo(r * 0.3, r * 1.4, 0, r * 1.7);
    c.stroke();
    c.fillStyle = T.dark;
    c.beginPath();
    c.moveTo(0, r * 0.85);
    c.lineTo(-r * 0.22, r * 1.12);
    c.lineTo(r * 0.22, r * 1.12);
    c.closePath();
    c.fill();
  }
  const rr = type === 'balloon' ? r * 1.06 : r;
  const g = c.createRadialGradient(-rr * 0.35, -rr * 0.45, rr * 0.1, 0, 0, rr * 1.05);
  g.addColorStop(0, shade(T.color, 0.55));
  g.addColorStop(0.45, T.color);
  g.addColorStop(1, T.dark);
  c.fillStyle = g;
  c.strokeStyle = shade(T.dark, -0.45);
  c.lineWidth = Math.max(1.6, r * 0.12);
  c.beginPath();
  if (type === 'heavy') {
    // rounded stone
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU, k = 1 + (i % 2 ? -0.05 : 0.04);
      c.lineTo(Math.cos(a) * rr * k, Math.sin(a) * rr * k);
    }
    c.closePath();
  } else c.arc(0, 0, rr, 0, TAU);
  c.fill();
  c.stroke();
  // gloss
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath();
  c.ellipse(-rr * 0.38, -rr * 0.5, rr * 0.26, rr * 0.14, -0.6, 0, TAU);
  c.fill();
  if (type === 'tacky') {
    c.fillStyle = shade(T.color, 0.1);
    for (const d of [-0.5, 0.15, 0.6]) {
      c.beginPath();
      c.ellipse(d * rr, rr * 0.92, rr * 0.13, rr * 0.2 + Math.sin(t * 3 + d * 5) * 1.2, 0, 0, TAU);
      c.fill();
    }
  }
  // eyes
  const blink = o.blink;
  const lx = clamp(o.lookx || 0, -1, 1), ly = clamp(o.looky || 0, -1, 1);
  const ey = -rr * 0.12, ex = rr * 0.36, er = rr * (type === 'heavy' ? 0.26 : 0.3);
  for (const s of [-1, 1]) {
    c.fillStyle = '#fff';
    c.beginPath();
    if (blink) c.ellipse(s * ex, ey, er, er * 0.12, 0, 0, TAU);
    else c.ellipse(s * ex, ey, er, er * 1.1, 0, 0, TAU);
    c.fill();
    if (!blink) {
      c.fillStyle = '#1b1426';
      c.beginPath();
      c.arc(s * ex + lx * er * 0.45, ey + ly * er * 0.45 + er * 0.1, er * 0.5, 0, TAU);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(s * ex + lx * er * 0.45 - er * 0.15, ey + ly * er * 0.45 - er * 0.12, er * 0.15, 0, TAU);
      c.fill();
    }
  }
  if (type === 'heavy') {
    c.strokeStyle = '#2a1850';
    c.lineWidth = rr * 0.12;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-ex - er, ey - er * 1.2);
    c.lineTo(-ex + er * 0.8, ey - er * 0.6);
    c.moveTo(ex + er, ey - er * 1.2);
    c.lineTo(ex - er * 0.8, ey - er * 0.6);
    c.stroke();
  }
  // mouth
  c.strokeStyle = shade(T.dark, -0.5);
  c.lineWidth = Math.max(1.2, rr * 0.08);
  c.lineCap = 'round';
  c.beginPath();
  if (o.worried) c.arc(0, rr * 0.55, rr * 0.18, Math.PI * 1.15, Math.PI * 1.85);
  else c.arc(0, rr * 0.22, rr * 0.2, 0.25, Math.PI - 0.25);
  c.stroke();
  c.restore();
}

// ------------------------------------------------------------------ renderer
export function createRenderer(canvas) {
  const c = canvas.getContext('2d', { alpha: false });
  let W = 0, H = 0, dpr = 1;
  let level = null, world = WORLDS[0];
  let terrainPaths = [];
  let topEdges = [];
  let clouds = [];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    W = w;
    H = h;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    return true;
  }

  function setLevel(lv) {
    level = lv;
    world = WORLDS.find((w) => w.id === lv.world) || WORLDS[0];
    terrainPaths = [];
    topEdges = [];
    for (const pts of lv.terrain || []) {
      const p = new Path2D();
      pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
      p.closePath();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const q of pts) {
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]);
        y1 = Math.max(y1, q[1]);
      }
      terrainPaths.push({ p, y0, y1, x0, x1 });
      const edges = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const ax = pts[j][0], ay = pts[j][1], bx = pts[i][0], by = pts[i][1];
        const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
        let nx = dy / l, ny = -dx / l;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (pointInPoly(mx + nx * 3, my + ny * 3, pts)) {
          nx = -nx;
          ny = -ny;
        }
        if (ny < -0.35 && Math.abs(my) < 1400 && l > 4) edges.push([ax, ay, bx, by]);
      }
      topEdges.push(edges);
    }
    clouds = [];
    for (let i = 0; i < 7; i++) clouds.push({ x: (i * 197) % 900, y: 40 + ((i * 83) % 280), s: 0.7 + ((i * 37) % 10) / 12, v: 6 + (i % 4) * 3 });
  }

  function backdrop(cam, time) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, world.sky[0]);
    g.addColorStop(1, world.sky[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // sun / moon glow
    const wid = world.id;
    const gx = W * 0.78, gy = H * 0.2;
    const rg = c.createRadialGradient(gx, gy, 2, gx, gy, H * 0.35);
    rg.addColorStop(0, wid === 3 ? 'rgba(255,200,120,0.55)' : wid === 5 ? 'rgba(255,230,160,0.35)' : 'rgba(255,255,255,0.55)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, W, H);
    if (wid === 5 || wid === 3) {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97.3) % W, sy = (i * 53.7) % (H * 0.6);
        c.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * 1.3 + i));
        c.fillRect(sx, sy, 2, 2);
      }
      c.globalAlpha = 1;
    }
    if (wid <= 2) {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (const cl of clouds) {
        const x = ((cl.x + time * cl.v - cam.x * cam.s * 0.1) % (W + 240)) - 120;
        const y = cl.y * (H / 700) + 20 - cam.y * 0.02 * cam.s;
        const k = cl.s * 26 * (W / 400);
        c.beginPath();
        c.arc(x, y, k, 0, TAU);
        c.arc(x + k * 1.1, y - k * 0.4, k * 0.9, 0, TAU);
        c.arc(x + k * 2.1, y, k * 0.8, 0, TAU);
        c.rect(x, y, k * 2.1, k * 0.8);
        c.fill();
      }
    }
    // parallax hills
    for (const [layer, col, amp, par, base] of [[0, world.far, 46, 0.18, 0.66], [1, world.mid, 36, 0.32, 0.74]]) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, H);
      const ox = cam.x * cam.s * par;
      const oy = (cam.y - 400) * cam.s * par * 0.4;
      for (let x = 0; x <= W + 8; x += 8) {
        const wx = x + ox + layer * 130;
        const y = H * base - oy + Math.sin(wx * 0.006 + layer) * amp + Math.sin(wx * 0.017 + layer * 3) * amp * 0.35;
        c.lineTo(x, y);
      }
      c.lineTo(W, H);
      c.fill();
    }
    if (wid === 4) {
      // slowly turning gears
      c.strokeStyle = 'rgba(255,255,255,0.08)';
      c.lineWidth = 8;
      for (let i = 0; i < 3; i++) {
        const gx2 = W * (0.2 + i * 0.35) - cam.x * 0.06 * cam.s, gy2 = H * (0.28 + (i % 2) * 0.15);
        c.save();
        c.translate(gx2, gy2);
        c.rotate(time * 0.15 * (i % 2 ? 1 : -1));
        c.setLineDash([10, 14]);
        c.beginPath();
        c.arc(0, 0, 54 + i * 14, 0, TAU);
        c.stroke();
        c.restore();
      }
      c.setLineDash([]);
    }
  }

  function terrain(cam) {
    for (let i = 0; i < terrainPaths.length; i++) {
      const tp = terrainPaths[i];
      const g = c.createLinearGradient(0, tp.y0, 0, Math.min(tp.y1, tp.y0 + 900));
      g.addColorStop(0, world.soil[0]);
      g.addColorStop(1, world.soil[1]);
      c.fillStyle = g;
      c.fill(tp.p);
      c.save();
      c.clip(tp.p);
      c.strokeStyle = 'rgba(0,0,0,0.22)';
      c.lineWidth = 16;
      c.lineJoin = 'round';
      c.stroke(tp.p);
      // subtle strata lines
      c.strokeStyle = 'rgba(255,255,255,0.05)';
      c.lineWidth = 3;
      for (let y = tp.y0 + 36; y < Math.min(tp.y1, tp.y0 + 700); y += 46) {
        c.beginPath();
        for (let x = tp.x0; x <= Math.min(tp.x1, tp.x0 + 1600); x += 40) c.lineTo(x, y + Math.sin(x * 0.03 + y) * 4);
        c.stroke();
      }
      c.restore();
      c.lineCap = 'round';
      for (const e of topEdges[i]) {
        c.strokeStyle = shade(world.top, -0.35);
        c.lineWidth = 15;
        c.beginPath();
        c.moveTo(e[0], e[1] + 3);
        c.lineTo(e[2], e[3] + 3);
        c.stroke();
        c.strokeStyle = world.top;
        c.lineWidth = 10;
        c.beginPath();
        c.moveTo(e[0], e[1] + 1);
        c.lineTo(e[2], e[3] + 1);
        c.stroke();
        c.strokeStyle = shade(world.top, 0.45);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(e[0], e[1] - 2);
        c.lineTo(e[2], e[3] - 2);
        c.stroke();
      }
    }
  }

  function spikesDraw(hz, time) {
    const pts = hz.pts;
    const x0 = pts[0][0], y0 = pts[0][1], x1 = pts[2][0], y1 = pts[2][1];
    const w = x1 - x0, h = y1 - y0;
    c.fillStyle = '#3a2024';
    c.fillRect(x0, y0, w, h);
    const n = Math.max(2, Math.round(w / 26));
    const sw = w / n;
    const up = hz.dir !== 'down';
    for (let i = 0; i < n; i++) {
      const bx = x0 + i * sw;
      const gr = c.createLinearGradient(bx, 0, bx + sw, 0);
      gr.addColorStop(0, '#e9eef5');
      gr.addColorStop(0.5, '#a9b4c4');
      gr.addColorStop(1, '#5b6678');
      c.fillStyle = gr;
      c.beginPath();
      if (up) {
        c.moveTo(bx, y1);
        c.lineTo(bx + sw / 2, y0 - 6);
        c.lineTo(bx + sw, y1);
      } else {
        c.moveTo(bx, y0);
        c.lineTo(bx + sw / 2, y1 + 6);
        c.lineTo(bx + sw, y0);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1.2;
      c.stroke();
    }
    c.fillStyle = '#d63a3a';
    c.globalAlpha = 0.55 + 0.25 * Math.sin(time * 4);
    c.fillRect(x0, up ? y1 - 4 : y0, w, 4);
    c.globalAlpha = 1;
  }

  function fluid(cam, time, killY) {
    const wid = world.id;
    const cols = { 1: ['#4fc3f7', '#0b5d99'], 2: ['#e6f3ff', '#7ea4e8'], 3: ['#ffb12b', '#c81e0e'], 4: ['#b8ff5a', '#2f8f1d'], 5: ['#b66bff', '#2a0f66'] }[wid];
    const left = cam.x - W / cam.s, right = cam.x + W / cam.s;
    const top = killY - 18;
    for (let layer = 0; layer < 2; layer++) {
      const g = c.createLinearGradient(0, top, 0, top + 300);
      g.addColorStop(0, layer ? cols[0] : shade(cols[0], 0.25));
      g.addColorStop(1, cols[1]);
      c.fillStyle = g;
      c.globalAlpha = layer ? 0.9 : 0.75;
      c.beginPath();
      c.moveTo(left, top + 800);
      for (let x = left; x <= right; x += 14) c.lineTo(x, top + layer * 10 + Math.sin(x * 0.025 + time * (1.6 + layer) + layer * 2) * 6);
      c.lineTo(right, top + 800);
      c.fill();
    }
    c.globalAlpha = 1;
    if (wid === 3) {
      c.fillStyle = '#ffe28a';
      for (let i = 0; i < 12; i++) {
        const bx = left + ((i * 131 + time * 14) % (right - left));
        const by = top + 14 + ((i * 47 + time * 20) % 40);
        c.globalAlpha = 0.5;
        c.beginPath();
        c.arc(bx, by, 3 + (i % 3), 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  function pipeDraw(p, time, glow, need) {
    const bodyH = 120;
    const grad = c.createLinearGradient(p.x - p.r, 0, p.x + p.r, 0);
    grad.addColorStop(0, '#1f8a5b');
    grad.addColorStop(0.35, '#58e0a0');
    grad.addColorStop(1, '#14603f');
    c.fillStyle = grad;
    c.strokeStyle = '#0a3a26';
    c.lineWidth = 3;
    c.beginPath();
    c.rect(p.x - p.r + 4, p.y + 4, p.r * 2 - 8, bodyH);
    c.fill();
    c.stroke();
    // golden rim
    const rg = c.createLinearGradient(p.x - p.r - 6, 0, p.x + p.r + 6, 0);
    rg.addColorStop(0, '#c9971c');
    rg.addColorStop(0.4, '#f7d774');
    rg.addColorStop(1, '#a57512');
    c.fillStyle = rg;
    c.beginPath();
    c.ellipse(p.x, p.y + 4, p.r + 7, 13, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = '#041a12';
    c.beginPath();
    c.ellipse(p.x, p.y + 3, p.r - 1, 8.5, 0, 0, TAU);
    c.fill();
    // swirl glow
    const k = 0.5 + 0.5 * Math.sin(time * 3);
    c.globalAlpha = 0.25 + 0.25 * k + glow * 0.5;
    const gg = c.createRadialGradient(p.x, p.y, 4, p.x, p.y - 20, p.r * 2.4);
    gg.addColorStop(0, '#9dffcf');
    gg.addColorStop(1, 'rgba(157,255,207,0)');
    c.fillStyle = gg;
    c.beginPath();
    c.arc(p.x, p.y - 10, p.r * 2.4, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
    // bobbing arrow
    c.fillStyle = '#f7d774';
    c.strokeStyle = '#7a5410';
    c.lineWidth = 2;
    const ay = p.y - p.r - 26 + Math.sin(time * 3) * 5;
    c.beginPath();
    c.moveTo(p.x, ay + 16);
    c.lineTo(p.x - 12, ay);
    c.lineTo(p.x - 5, ay);
    c.lineTo(p.x - 5, ay - 12);
    c.lineTo(p.x + 5, ay - 12);
    c.lineTo(p.x + 5, ay);
    c.lineTo(p.x + 12, ay);
    c.closePath();
    c.fill();
    c.stroke();
  }

  function goalLine(g, time, bounds, done) {
    const y = g.y;
    c.save();
    c.setLineDash([16, 12]);
    c.lineDashOffset = -time * 20;
    c.strokeStyle = done ? '#7dff9a' : '#f7d774';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(bounds[0] - 400, y);
    c.lineTo(bounds[2] + 400, y);
    c.stroke();
    c.restore();
    c.fillStyle = done ? '#7dff9a' : '#f7d774';
    c.font = '800 20px Nunito, system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText('★', bounds[0] + 14, y - 10);
  }

  function windDraw(w, time) {
    const k = w.period ? 0.5 + 0.5 * Math.sin(TAU * (time / w.period + (w.phase || 0))) : 1;
    c.save();
    c.beginPath();
    c.rect(w.x, w.y, w.w, w.h);
    c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    const dir = Math.sign(w.fx || 1);
    for (let i = 0; i < 16; i++) {
      const y = w.y + ((i * 83.7) % w.h);
      const sp = 260 + (i % 4) * 60;
      const x = w.x + ((i * 61 + time * sp * (0.4 + k)) % (w.w + 160));
      const xx = dir > 0 ? x : w.x + w.w - (x - w.x);
      c.globalAlpha = (0.12 + 0.4 * k) * (0.5 + 0.5 * ((i * 7) % 3) / 2);
      c.beginPath();
      c.moveTo(xx - 40 * dir, y);
      c.lineTo(xx, y);
      c.stroke();
    }
    c.restore();
    c.globalAlpha = 1;
  }

  function moverDraw(m) {
    const p = m.wpts;
    c.beginPath();
    p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
    c.closePath();
    const x0 = m.bb[0], y0 = m.bb[1], y1 = m.bb[3];
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#e8d28a');
    g.addColorStop(0.5, '#a8832c');
    g.addColorStop(1, '#5b4310');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = '#2d210a';
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = x0 + 10; x < m.bb[2] - 6; x += 22) c.fillRect(x, (y0 + y1) / 2 - 2, 8, 4);
  }

  function pendulumDraw(p, pos) {
    c.strokeStyle = '#2b2530';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(p.px, p.py);
    c.lineTo(pos[0], pos[1]);
    c.stroke();
    c.strokeStyle = '#c6cbd6';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(p.px, p.py);
    c.lineTo(pos[0], pos[1]);
    c.stroke();
    c.fillStyle = '#f7d774';
    c.beginPath();
    c.arc(p.px, p.py, 9, 0, TAU);
    c.fill();
    c.save();
    c.translate(pos[0], pos[1]);
    c.fillStyle = '#9aa3b4';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(a - 0.17) * p.r * 0.9, Math.sin(a - 0.17) * p.r * 0.9);
      c.lineTo(Math.cos(a) * (p.r + 9), Math.sin(a) * (p.r + 9));
      c.lineTo(Math.cos(a + 0.17) * p.r * 0.9, Math.sin(a + 0.17) * p.r * 0.9);
      c.fill();
    }
    const g = c.createRadialGradient(-p.r * 0.3, -p.r * 0.35, 3, 0, 0, p.r);
    g.addColorStop(0, '#f0f3f8');
    g.addColorStop(0.5, '#6c7587');
    g.addColorStop(1, '#262b36');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, p.r, 0, TAU);
    c.fill();
    c.strokeStyle = '#14171f';
    c.lineWidth = 2.5;
    c.stroke();
    c.restore();
  }

  function strandDraw(s) {
    const a = s.a, b = s.b;
    const st = clamp((s.strain || 0) / 0.5, 0, 1);
    const col = st > 0.02 ? lerpColor('#2b2236', '#ff4a3a', st) : '#2b2236';
    c.lineCap = 'round';
    c.strokeStyle = col;
    c.lineWidth = 6 - st * 2.2;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    const ta = TYPES[a.type]?.color || '#bbb', tb = TYPES[b.type]?.color || '#bbb';
    c.strokeStyle = st > 0.35 ? lerpColor('#e8d6ff', '#ffb0a0', st) : 'rgba(235,225,255,0.55)';
    c.lineWidth = 2 - st * 0.6;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    void ta;
    void tb;
  }

  function baseNode(n) {
    const g = c.createRadialGradient(n.x - 4, n.y - 5, 2, n.x, n.y, n.r);
    g.addColorStop(0, '#f2f2f6');
    g.addColorStop(0.5, '#8d93a3');
    g.addColorStop(1, '#3c4150');
    c.fillStyle = g;
    c.strokeStyle = '#1b1d26';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(n.x, n.y, n.r, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = '#2a2d38';
    c.beginPath();
    c.arc(n.x, n.y, 3.6, 0, TAU);
    c.fill();
  }

  /**
   * frame: { sim, cam:{x,y,s}, time, ghost, particles, born:Map, hover, win:{t}, fitTop, shake }
   */
  function draw(f) {
    if (!level || !resize()) return;
    const { sim, cam, time } = f;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(cam, time);
    c.save();
    let sx = 0, sy = 0;
    if (f.shake > 0) {
      sx = (Math.random() - 0.5) * f.shake * 8;
      sy = (Math.random() - 0.5) * f.shake * 8;
    }
    c.translate(W / 2 + sx, H / 2 + sy);
    c.scale(cam.s, cam.s);
    c.translate(-cam.x, -cam.y);

    for (const w of level.winds || []) windDraw(w, time);
    if (level.goal && level.goal.type === 'height') goalLine(level.goal, time, level.bounds, sim.status === 'won');
    terrain(cam);
    for (const hz of level.hazards || []) spikesDraw(hz, time);
    if (level.pipe) pipeDraw(level.pipe, time, sim.pipeTouch / 30, level.need);
    for (const m of sim.movers) moverDraw(m);
    for (const p of sim.pendulums) pendulumDraw(p, sim.pendulumPos(p, sim.time / 60));
    fluid(cam, time, sim.killY);

    // strands then nodes
    for (const s of sim.strands) if (s.alive) strandDraw(s);
    const born = f.born;
    for (const n of sim.nodes) {
      if (!n.alive) continue;
      if (n.type === 'base') {
        baseNode(n);
        continue;
      }
      const sp = Math.hypot(n.vx, n.vy);
      const blink = (time * 0.9 + n.id * 1.7) % 4 < 0.13;
      let lookx = n.vx / 260, looky = n.vy / 260 - 0.1;
      if (sp < 25 && level.pipe) {
        const dx = level.pipe.x - n.x, dy = level.pipe.y - n.y, l = Math.hypot(dx, dy) || 1;
        lookx = dx / l * 0.7;
        looky = dy / l * 0.7;
      }
      let squash = 0;
      const b0 = born && born.get(n.id);
      if (b0 !== undefined) {
        const a = time - b0;
        if (a < 0.8) squash = Math.sin(a * 22) * Math.exp(-a * 6) * 1.6;
      }
      const hv = f.hover === n.id;
      drawGoo(c, n.x, n.y, n.r, n.type, { t: time, blink, lookx, looky, squash, worried: sp > 180 || (n.conn === false && !n.fixed) });
      if (TYPES[n.type]?.removable) {
        c.strokeStyle = hv ? '#fff' : 'rgba(255,255,255,0.6)';
        c.lineWidth = 2;
        c.setLineDash([4, 5]);
        c.lineDashOffset = -time * 8;
        c.beginPath();
        c.arc(n.x, n.y, n.r + 5, 0, TAU);
        c.stroke();
        c.setLineDash([]);
      }
      if (n.type === 'stake') {
        c.fillStyle = 'rgba(255,255,255,0.0)';
      }
    }

    // goal reserve goos (saved ones) celebrate / fly to the pipe
    drawReserve(f);

    // ghost
    if (f.ghost) drawGhost(f.ghost, time);
    f.particles.draw(c);
    c.restore();

    if (f.vignette) {
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.38)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
  }

  function drawReserve(f) {
    const lv = level;
    const need = lv.need || 0;
    if (!need || lv.sandbox) return;
    const sim = f.sim;
    const a0 = (lv.anchors && lv.anchors[0]) || [60, 600];
    const gx = lv.bounds[0] + 22;
    // ground height at that x = anchor y + 8
    const gy = a0[1] + 8 - 15;
    const pipe = lv.pipe;
    const wonT = sim.status === 'won' ? f.time - f.winTime : -1;
    for (let i = 0; i < need; i++) {
      let x = gx + i * 4, y = gy;
      if (wonT >= 0 && pipe) {
        const k = clamp((wonT - i * 0.28) / 1.3, 0, 1);
        if (k >= 1) continue;
        const px = pipe.x, py = pipe.y;
        x = mix(gx, px, k);
        y = mix(gy, py, k) - Math.sin(k * Math.PI) * 140 - Math.abs(Math.sin(k * 14)) * 22;
      } else if (wonT >= 0) {
        y = gy - Math.abs(Math.sin(wonT * 8 + i)) * 26;
      } else {
        x += i * 0;
        y = gy - Math.max(0, Math.sin(f.time * 2.4 + i * 1.7)) * 6;
      }
      if (!pipe || wonT >= 0 || i === 0 || true) drawGoo(c, x - (wonT < 0 ? 0 : 0), y, 15, 'goo', { t: f.time, lookx: 0.8, looky: -0.1, blink: (f.time * 0.9 + i * 2.1) % 4 < 0.13 });
    }
  }

  function drawGhost(g, time) {
    const pv = g.pv;
    const T = TYPES[g.type];
    const valid = pv && pv.valid;
    const px = pv && pv.x !== undefined ? pv.x : g.x, py = pv && pv.y !== undefined ? pv.y : g.y;
    if (valid) {
      c.save();
      c.setLineDash([7, 7]);
      c.lineDashOffset = -time * 24;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineCap = 'round';
      for (const l of pv.links) {
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(l.x, l.y);
        c.stroke();
      }
      c.setLineDash([]);
      c.lineWidth = 3;
      c.strokeStyle = '#f7d774';
      for (const l of pv.links) {
        c.beginPath();
        c.arc(l.x, l.y, 22, 0, TAU);
        c.stroke();
      }
      c.restore();
    }
    drawGoo(c, g.drawX ?? px, g.drawY ?? py, T.r, g.type, { t: time, alpha: valid ? 0.88 : 0.5, lookx: 0, looky: 0.5, squash: 0.2, worried: !valid });
    if (!valid) {
      c.strokeStyle = '#ff5a4a';
      c.lineWidth = 4;
      c.lineCap = 'round';
      const r = T.r * 0.7;
      c.beginPath();
      c.moveTo(px - r, py - r);
      c.lineTo(px + r, py + r);
      c.moveTo(px + r, py - r);
      c.lineTo(px - r, py + r);
      c.stroke();
    }
    if (valid && T.reach) {
      c.strokeStyle = 'rgba(247,215,116,0.35)';
      c.lineWidth = 2;
      c.setLineDash([3, 8]);
      c.beginPath();
      c.arc(px, py, T.reach, 0, TAU);
      c.stroke();
      c.setLineDash([]);
    }
  }

  return { setLevel, draw, resize, get size() { return [W, H]; } };
}
