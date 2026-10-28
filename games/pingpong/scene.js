// Static venue, prerendered once per size/arena (the camera never moves):
// sky and city skyline, crowd stands, printed floor with reflections, LED boards
// and the designer table. Uses a perspective camera auto-fitted to the table.
import { TABLE_Y, HALF_W, HALF_L } from './logic.js';

const CAM = [0, 3.3, 4.6];
const TGT = [0, 0.6, -4];

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
export function shade(hex, k) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// ---------- camera ----------
export function makeCamera(W, H) {
  const fwd = norm([TGT[0] - CAM[0], TGT[1] - CAM[1], TGT[2] - CAM[2]]);
  const right = norm([-fwd[2], 0, fwd[0]]);
  right[0] = Math.abs(right[0]);
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const cam = { W, H, f: 1, cx: W / 2, cy: H / 2, ox: 0, oy: 0 };
  const raw = (x, y, z) => {
    const d = [x - CAM[0], y - CAM[1], z - CAM[2]];
    const zc = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
    return [d[0] * right[0] + d[1] * right[1] + d[2] * right[2], d[0] * up[0] + d[1] * up[1] + d[2] * up[2], zc];
  };
  // fit: near edge of the table spans ~92% of the width (limited on wide screens)
  const a = raw(-HALF_W, TABLE_Y, HALF_L);
  const b = raw(HALF_W, TABLE_Y, HALF_L);
  const wNorm = b[0] / b[2] - a[0] / a[2];
  cam.f = Math.min((W * 0.74) / wNorm, (H * 0.55) / wNorm);
  cam.cy = H * 0.66 + (a[1] / a[2]) * cam.f; // near edge at 66% of the height
  cam.proj = (x, y, z) => {
    const r = raw(x, y, z);
    if (r[2] < 0.15) return null;
    const s = cam.f / r[2];
    return [cam.cx + r[0] * s + cam.ox, cam.cy - r[1] * s + cam.oy, s];
  };
  return cam;
}
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------- texture mapping (affine triangles over a projected grid) ----------
function drawTri(g, img, p0, p1, p2, t0, t1, t2) {
  // inflate slightly against seams
  const cx = (p0[0] + p1[0] + p2[0]) / 3;
  const cy = (p0[1] + p1[1] + p2[1]) / 3;
  const inf = (p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const l = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / l) * 0.7, p[1] + (dy / l) * 0.7];
  };
  const q0 = inf(p0);
  const q1 = inf(p1);
  const q2 = inf(p2);
  g.save();
  g.beginPath();
  g.moveTo(q0[0], q0[1]);
  g.lineTo(q1[0], q1[1]);
  g.lineTo(q2[0], q2[1]);
  g.closePath();
  g.clip();
  const [u0, v0] = t0;
  const [u1, v1] = t1;
  const [u2, v2] = t2;
  const d = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(d) < 1e-9) {
    g.restore();
    return;
  }
  const a = (p0[0] * (v1 - v2) + p1[0] * (v2 - v0) + p2[0] * (v0 - v1)) / d;
  const b = (p0[1] * (v1 - v2) + p1[1] * (v2 - v0) + p2[1] * (v0 - v1)) / d;
  const c = (p0[0] * (u2 - u1) + p1[0] * (u0 - u2) + p2[0] * (u1 - u0)) / d;
  const e = (p0[1] * (u2 - u1) + p1[1] * (u0 - u2) + p2[1] * (u1 - u0)) / d;
  const tx = (p0[0] * (u1 * v2 - u2 * v1) + p1[0] * (u2 * v0 - u0 * v2) + p2[0] * (u0 * v1 - u1 * v0)) / d;
  const ty = (p0[1] * (u1 * v2 - u2 * v1) + p1[1] * (u2 * v0 - u0 * v2) + p2[1] * (u0 * v1 - u1 * v0)) / d;
  g.transform(a, b, c, e, tx, ty);
  g.drawImage(img, 0, 0);
  g.restore();
}

// world(u, v) -> [x, y, z] for u, v in 0..1; img covers the whole quad
function texQuad(g, cam, img, world, nu, nv) {
  const P = [];
  for (let j = 0; j <= nv; j++) {
    P.push([]);
    for (let i = 0; i <= nu; i++) {
      const w = world(i / nu, j / nv);
      P[j].push(cam.proj(w[0], w[1], w[2]));
    }
  }
  const W = img.width;
  const H = img.height;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = P[j][i];
      const b = P[j][i + 1];
      const c = P[j + 1][i + 1];
      const d = P[j + 1][i];
      if (!a || !b || !c || !d) continue;
      const ta = [(i / nu) * W, (j / nv) * H];
      const tb = [((i + 1) / nu) * W, (j / nv) * H];
      const tc = [((i + 1) / nu) * W, ((j + 1) / nv) * H];
      const td = [(i / nu) * W, ((j + 1) / nv) * H];
      drawTri(g, img, a, b, c, ta, tb, tc);
      drawTri(g, img, a, c, d, ta, tc, td);
    }
  }
}

function poly(g, cam, pts, fill) {
  const q = pts.map((p) => cam.proj(p[0], p[1], p[2]));
  if (q.some((p) => !p)) return;
  g.beginPath();
  g.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) g.lineTo(q[i][0], q[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const FONT = '"Nunito", "Arial Black", system-ui, sans-serif';

// ---------- textures ----------
function floorTexture(ar, label) {
  const c = mk(1024, 900);
  const g = c.getContext('2d');
  const F = ar.floor;
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, F.a);
  grd.addColorStop(1, F.b);
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  const rnd = seeded(7 + ar.id * 13);
  g.strokeStyle = F.ink;
  g.fillStyle = F.ink;
  g.lineWidth = 10;
  if (F.pattern === 'waves') {
    for (let k = 0; k < 16; k++) {
      g.beginPath();
      const y0 = 40 + k * 56;
      for (let x = 0; x <= c.width; x += 16) g.lineTo(x, y0 + Math.sin(x / 70 + k) * 18);
      g.lineWidth = 6 + (k % 3) * 4;
      g.stroke();
    }
  } else if (F.pattern === 'rays') {
    g.save();
    g.translate(512, 470);
    for (let k = 0; k < 24; k++) {
      g.rotate((Math.PI * 2) / 24);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(900, -70);
      g.lineTo(900, 70);
      g.closePath();
      if (k % 2) g.fill();
    }
    g.restore();
  } else if (F.pattern === 'grid') {
    g.lineWidth = 5;
    for (let k = -20; k < 40; k++) {
      g.beginPath();
      g.moveTo(k * 60, 0);
      g.lineTo(k * 60 + 900, 900);
      g.stroke();
      g.beginPath();
      g.moveTo(k * 60, 900);
      g.lineTo(k * 60 + 900, 0);
      g.stroke();
    }
  } else if (F.pattern === 'stars') {
    for (let k = 0; k < 60; k++) star(g, rnd() * 1024, rnd() * 900, 10 + rnd() * 22);
    g.lineWidth = 14;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.moveTo(0, 120 + k * 130);
      g.lineTo(1024, 60 + k * 130);
      g.stroke();
    }
  } else {
    // logo: big concentric rings and swooshes
    g.lineWidth = 14;
    for (const [x, y, r] of [[150, 300, 170], [880, 620, 210], [512, 120, 90]]) {
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x, y, r - k * 40, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
  // court frame around the table
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 6;
  g.strokeRect(512 - 230, 450 - 330, 460, 640);
  // giant city name on both sides of the table (reads along the length)
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.0)';
  g.strokeStyle = 'rgba(255,255,255,0.32)';
  g.lineWidth = 7;
  g.font = `900 96px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [x, rot] of [[170, -Math.PI / 2], [854, Math.PI / 2]]) {
    g.save();
    g.translate(x, 300);
    g.rotate(rot);
    g.strokeText(label.toUpperCase(), 0, 0);
    g.restore();
  }
  g.restore();
  return c;
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function boardTexture(ar, label, len) {
  const B = ar.boards;
  const w = Math.round(256 * len);
  const c = mk(w, 128);
  const g = c.getContext('2d');
  if (B.style === 'stripes') {
    g.fillStyle = B.bg[2];
    g.fillRect(0, 0, w, 128);
    for (let x = -128; x < w; x += 64) {
      g.fillStyle = B.bg[0];
      g.beginPath();
      g.moveTo(x, 128);
      g.lineTo(x + 28, 128);
      g.lineTo(x + 92, 0);
      g.lineTo(x + 64, 0);
      g.fill();
      g.fillStyle = B.bg[1];
      g.beginPath();
      g.moveTo(x + 28, 128);
      g.lineTo(x + 38, 128);
      g.lineTo(x + 102, 0);
      g.lineTo(x + 92, 0);
      g.fill();
    }
  } else if (B.style === 'flag') {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? B.bg[1] : B.bg[0];
      g.fillRect(0, k * 16, w, 16);
    }
    g.fillStyle = B.bg[2];
    for (let x = 0; x < w; x += 512) {
      g.fillRect(x, 0, 120, 128);
      g.fillStyle = '#ffffff';
      star(g, x + 60, 64, 30);
      g.fillStyle = B.bg[2];
    }
  } else if (B.style === 'waves') {
    g.fillStyle = B.bg[0];
    g.fillRect(0, 0, w, 128);
    g.strokeStyle = B.text;
    g.lineWidth = 6;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, 24 + k * 40 + Math.sin(x / 22) * 8);
      g.stroke();
    }
  } else if (B.style === 'led') {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, shade(B.bg[0] === '#ffffff' ? '#ffffff' : B.bg[1], 1.2));
    gr.addColorStop(1, B.bg[0]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, 128);
  } else {
    const gr = g.createLinearGradient(0, 0, w, 0);
    for (let k = 0; k <= 6; k++) gr.addColorStop(k / 6, B.bg[k % 3]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, 128);
    g.globalAlpha = 0.25;
    g.fillStyle = '#ffffff';
    for (let x = 0; x < w; x += 18) g.fillRect(x, 0, 6, 128);
    g.globalAlpha = 1;
  }
  // city name repeated
  g.font = `italic 900 76px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const txt = label.toUpperCase();
  const step = Math.max(380, g.measureText(txt).width + 140);
  for (let x = step / 2; x < w; x += step) {
    if (B.style !== 'led' && B.style !== 'waves') {
      const tw = g.measureText(txt).width + 40;
      g.fillStyle = B.textBg;
      roundRect(g, x - tw / 2, 18, tw, 92, 16);
      g.fill();
    }
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.strokeText(txt, x, 68);
    g.fillStyle = B.text;
    g.fillText(txt, x, 66);
  }
  // top/bottom bevel
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, 0, w, 5);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 122, w, 6);
  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function apronTexture(ar, label) {
  const c = mk(768, 64);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, shade(ar.apron, 1.15));
  gr.addColorStop(1, shade(ar.apron, 0.7));
  g.fillStyle = gr;
  g.fillRect(0, 0, 768, 64);
  g.font = `900 44px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fillText(label.toUpperCase(), 384, 34);
  return c;
}

// ---------- backdrop ----------
function drawSky(g, cam, ar) {
  const { W, H } = cam;
  const gr = g.createLinearGradient(0, 0, 0, H * 0.45);
  if (ar.sky === 'day') {
    gr.addColorStop(0, '#5fb6f0');
    gr.addColorStop(1, '#d8f0ff');
  } else if (ar.sky === 'dusk') {
    gr.addColorStop(0, '#4b4f8f');
    gr.addColorStop(0.6, '#e98a5a');
    gr.addColorStop(1, '#ffd29a');
  } else {
    gr.addColorStop(0, '#05060e');
    gr.addColorStop(1, shade(ar.wall, 1.6));
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  if (ar.sky === 'night') {
    const rnd = seeded(3 + ar.id);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 40; i++) g.fillRect(rnd() * W, rnd() * H * 0.18, 1, 1);
  }
}

function drawSkyline(g, cam, ar) {
  const rnd = seeded(11 + ar.id * 7);
  const night = ar.sky === 'night';
  const feats = ar.skyline;
  if (feats.includes('mountain')) {
    poly(g, cam, [[-30, 0, -60], [-22, 26, -60], [-14, 30, -60], [-8, 14, -60], [-2, 0, -60]], 'rgba(60,110,90,0.85)');
    poly(g, cam, [[6, 0, -60], [12, 18, -60], [17, 20, -60], [24, 0, -60]], 'rgba(70,120,100,0.8)');
  }
  if (feats.includes('shells')) {
    for (const [x, h] of [[-6, 7], [-3, 9], [0, 6], [3, 8]]) poly(g, cam, [[x - 2.5, 2, -34], [x + 1.5, 2 + h, -34], [x + 2.5, 2, -34]], '#f5efe6');
  }
  if (feats.includes('towers') || feats.includes('industrial') || feats.includes('spire') || feats.includes('neon') || feats.includes('arches') || feats.includes('dome')) {
    const z = -26;
    for (let x = -26; x < 26; ) {
      const w = 2 + rnd() * 3.5;
      const h = 8 + rnd() * (feats.includes('industrial') ? 8 : 26);
      const col = night ? shade('#151a2e', 0.7 + rnd() * 0.6) : ar.sky === 'dusk' ? shade('#6b5a7a', 0.7 + rnd() * 0.4) : shade('#c9d6e3', 0.85 + rnd() * 0.25);
      poly(g, cam, [[x, 0, z], [x + w, 0, z], [x + w, h, z], [x, h, z]], col);
      // windows
      const p0 = cam.proj(x, h, z);
      const p1 = cam.proj(x + w, 0, z);
      if (p0 && p1) {
        const ww = p1[0] - p0[0];
        const hh = p1[1] - p0[1];
        for (let wy = 4; wy < hh - 4; wy += 6) {
          for (let wx = 3; wx < ww - 3; wx += 5) {
            if (rnd() < (night ? 0.45 : 0.6)) {
              g.fillStyle = night ? (rnd() < 0.7 ? 'rgba(255,214,140,0.85)' : 'rgba(160,210,255,0.8)') : 'rgba(80,110,150,0.5)';
              g.fillRect(p0[0] + wx, p0[1] + wy, 2, 3);
            }
          }
        }
      }
      x += w + 0.4 + rnd() * 1.2;
    }
    if (feats.includes('spire')) poly(g, cam, [[-0.9, 0, -30], [0.9, 0, -30], [0.15, 46, -30], [-0.15, 46, -30]], night ? '#1c2236' : '#8a7f95');
  }
  if (feats.includes('deco')) {
    const cols = ['#fff3c9', '#ffd6e0', '#d8f3f0', '#fff0d0'];
    for (let x = -14; x < 14; x += 5.6) {
      const h = 7 + rnd() * 3;
      const c = cols[Math.floor(rnd() * cols.length)];
      poly(g, cam, [[x, 0, -13], [x + 5, 0, -13], [x + 5, h, -13], [x, h, -13]], c);
      // horizontal bands and windows
      for (let k = 1; k < 5; k++) {
        poly(g, cam, [[x + 0.3, (h * k) / 5, -12.98], [x + 4.7, (h * k) / 5, -12.98], [x + 4.7, (h * k) / 5 + 0.35, -12.98], [x + 0.3, (h * k) / 5 + 0.35, -12.98]], 'rgba(120,180,200,0.65)');
      }
      poly(g, cam, [[x + 2, h, -13], [x + 3, h, -13], [x + 3, h + 1.6, -13], [x + 2, h + 1.6, -13]], c);
    }
  }
  if (feats.includes('pagoda')) {
    for (let k = 0; k < 5; k++) {
      const y = 4 + k * 3;
      const w = 4 - k * 0.6;
      poly(g, cam, [[6 - w, y, -20], [6 + w, y, -20], [6 + w * 0.6, y + 1.2, -20], [6 - w * 0.6, y + 1.2, -20]], '#1a0f16');
      poly(g, cam, [[6 - w * 0.55, y - 1.8, -20], [6 + w * 0.55, y - 1.8, -20], [6 + w * 0.55, y, -20], [6 - w * 0.55, y, -20]], '#2b1820');
    }
  }
  if (feats.includes('arches') || feats.includes('dome')) {
    const dome = feats.includes('dome');
    const z = -9.5;
    poly(g, cam, [[-12, 0, z], [12, 0, z], [12, 9, z], [-12, 9, z]], dome ? 'rgba(26,16,48,0.55)' : 'rgba(58,31,26,0.6)');
    for (let x = -10; x <= 10; x += 4) {
      const c = cam.proj(x, 4.5, z);
      const e = cam.proj(x + 1.5, 4.5, z);
      if (!c || !e) continue;
      const r = e[0] - c[0];
      g.fillStyle = dome ? 'rgba(140,170,255,0.35)' : 'rgba(255,190,120,0.3)';
      g.beginPath();
      g.arc(c[0], c[1], r, Math.PI, 0);
      g.lineTo(c[0] + r, c[1] + r * 2.6);
      g.lineTo(c[0] - r, c[1] + r * 2.6);
      g.closePath();
      g.fill();
      g.strokeStyle = dome ? 'rgba(200,220,255,0.6)' : 'rgba(255,220,170,0.45)';
      g.lineWidth = 1.5;
      g.stroke();
    }
  }
  if (feats.includes('palms')) {
    for (const x of [-9, -5.5, 5, 8.5, 12]) palm(g, cam, x + rnd(), -10.5 - rnd() * 2, 6 + rnd() * 2.5);
  }
  if (feats.includes('tent')) {
    const { W } = cam;
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [x0, x1] of [[-0.1, 0.45], [0.55, 1.1]]) {
      g.beginPath();
      g.moveTo(W * x0, 0);
      g.quadraticCurveTo(W * ((x0 + x1) / 2), cam.H * 0.1, W * x1, 0);
      g.closePath();
      g.fill();
    }
  }
}

function palm(g, cam, x, z, h) {
  const base = cam.proj(x, 0, z);
  const top = cam.proj(x + 0.6, h, z);
  if (!base || !top) return;
  const s = base[2];
  g.strokeStyle = '#6b4f33';
  g.lineWidth = Math.max(2, 0.28 * s);
  g.beginPath();
  g.moveTo(base[0], base[1]);
  g.quadraticCurveTo(base[0] + 0.1 * s, (base[1] + top[1]) / 2, top[0], top[1]);
  g.stroke();
  g.strokeStyle = '#2f8f4e';
  g.lineWidth = Math.max(2, 0.22 * s);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const len = 2.2 * s;
    g.beginPath();
    g.moveTo(top[0], top[1]);
    g.quadraticCurveTo(top[0] + Math.cos(a) * len * 0.6, top[1] - 0.4 * s, top[0] + Math.cos(a) * len, top[1] + Math.abs(Math.sin(a)) * len * 0.3 + 0.5 * s);
    g.stroke();
  }
}

function drawFeatureLights(g, cam, ar) {
  const feats = ar.skyline;
  const rnd = seeded(91 + ar.id);
  if (feats.includes('lanterns')) {
    for (let x = -6; x <= 6; x += 1.5) {
      const p = cam.proj(x, 3.3 + rnd() * 0.5, -7.6);
      if (!p) continue;
      const r = 0.28 * p[2];
      glow(g, p[0], p[1], r * 3.5, '#ff8a3d', 0.45);
      g.fillStyle = '#ff6a2a';
      g.beginPath();
      g.ellipse(p[0], p[1], r * 0.8, r, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (feats.includes('strings')) {
    for (let row = 0; row < 3; row++) {
      const z = -7 + row * 2.2;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = -7 + t * 14;
        const y = 5.2 - Math.sin(t * Math.PI) * 0.9 + row * 0.4;
        const p = cam.proj(x, y, z);
        if (!p) continue;
        glow(g, p[0], p[1], 6, '#fff3c4', 0.5);
        g.fillStyle = '#fffbe8';
        g.fillRect(p[0] - 1, p[1] - 1, 2, 2);
      }
    }
  }
  if (feats.includes('neon')) {
    const cols = ['#3ff0ff', '#ff3fa8', '#ffe14d', '#8a5bff'];
    for (let k = 0; k < 7; k++) {
      const x = -8 + k * 2.6 + rnd();
      const p0 = cam.proj(x, 3.4 + rnd() * 2, -8.5);
      const p1 = cam.proj(x + 1.4, 3.4, -8.5);
      if (!p0 || !p1) continue;
      const w = p1[0] - p0[0];
      const c = cols[k % cols.length];
      glow(g, p0[0] + w / 2, p0[1], w * 1.4, c, 0.35);
      g.strokeStyle = c;
      g.lineWidth = 2;
      g.strokeRect(p0[0], p0[1] - w * 0.3, w, w * 0.6);
    }
  }
  if (feats.includes('lamps') || ar.sky !== 'day') {
    for (const x of [-5, 0, 5]) {
      const p = cam.proj(x, 6.5, -6);
      if (p) glow(g, p[0], p[1], cam.W * 0.35, ar.light, 0.28);
    }
  }
}

export function glow(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(col, a));
  gr.addColorStop(1, rgba(col, 0));
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

// Dense crowd on raised stands behind a lit back wall, plus side stands.
const SKIN = ['#8d5a3b', '#c58c5c', '#e0b089', '#5a3a24', '#a86f4c', '#f0c9a0'];
const SHIRT = ['#3b4252', '#5c2b2b', '#2b3f5c', '#4a4a4a', '#6b5b3b', '#2e4a3a', '#7a7a80', '#20242c', '#8a2a3a', '#d8d8dc'];
function person(g, cam, ar, x, yb, z, rnd) {
  const hgt = (1.6 + rnd() * 0.2) * 0.62;
  const head = cam.proj(x, yb + hgt - 0.07, z);
  const sh = cam.proj(x, yb + hgt - 0.24, z);
  const hip = cam.proj(x, yb + hgt - 0.7, z);
  if (!head || !sh || !hip) return;
  const s = head[2] * 0.62;
  const bw = 0.2 * s;
  g.fillStyle = shade(SHIRT[Math.floor(rnd() * SHIRT.length)], 0.32 + rnd() * 0.22);
  g.beginPath();
  g.moveTo(hip[0] - bw * 0.85, hip[1]);
  g.lineTo(sh[0] - bw, sh[1] + 0.06 * s);
  g.quadraticCurveTo(sh[0], sh[1] - 0.05 * s, sh[0] + bw, sh[1] + 0.06 * s);
  g.lineTo(hip[0] + bw * 0.85, hip[1]);
  g.closePath();
  g.fill();
  g.fillStyle = shade(SKIN[Math.floor(rnd() * SKIN.length)], 0.42);
  g.beginPath();
  g.ellipse(head[0], head[1] - 0.02 * s, 0.11 * s, 0.13 * s, 0, 0, Math.PI * 2);
  g.fill();
  if (rnd() < 0.7) {
    g.fillStyle = '#16120f';
    g.beginPath();
    g.ellipse(head[0], head[1] - 0.06 * s, 0.115 * s, 0.09 * s, 0, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = rgba(ar.light, 0.12);
  g.fillRect(sh[0] - bw, sh[1] + 0.05 * s, bw * 2, Math.max(1, 0.025 * s));
  if (rnd() < 0.08) {
    // raised arm
    g.strokeStyle = shade(SKIN[0], 0.55);
    g.lineWidth = Math.max(1.5, 0.06 * s);
    g.beginPath();
    g.moveTo(sh[0] + bw * 0.8, sh[1] + 0.05 * s);
    g.lineTo(sh[0] + bw * 1.3, sh[1] - 0.45 * s);
    g.stroke();
  }
}

function drawCrowd(g, cam, ar, label) {
  const rnd = seeded(5 + ar.id * 3);
  poly(g, cam, [[-18, 0, -4.2], [18, 0, -4.2], [18, 1.9, -6.6], [-18, 1.9, -6.6]], shade(ar.crowdTint, 0.4));
  const people = [];
  for (let row = 0; row < 4; row++) {
    const z = -4.6 - row * 0.55;
    const yb = 0.25 + row * 0.42;
    for (let x = -17; x < 17; x += 0.32 + rnd() * 0.08) people.push([x + rnd() * 0.1, yb, z]);
  }
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      const x = side * (6.5 + row * 0.55);
      for (let z = -9; z < 3; z += 0.32 + rnd() * 0.08) people.push([x, 0.6 + row * 0.46, z + rnd() * 0.1]);
    }
  }
  people.sort((p, q) => p[2] - q[2] || Math.abs(q[0]) - Math.abs(p[0]));
  for (const [x, yb, z] of people) person(g, cam, ar, x, yb, z, rnd);
  // side walls and back wall right behind the boards, with an LED ribbon
  const wallCol = ar.sky === 'day' ? '#1c2433' : shade(ar.wall, 1.4);
  for (const side of [-1, 1]) poly(g, cam, [[side * 3.9, 0, -4.0], [side * 3.9, 0, 3.5], [side * 3.9, 1.15, 3.5], [side * 3.9, 1.15, -4.0]], shade(wallCol === '#1c2433' ? '#1c2433' : '#20202a', side < 0 ? 1 : 0.8));
  poly(g, cam, [[-16, 0, -3.95], [16, 0, -3.95], [16, 1.15, -3.95], [-16, 1.15, -3.95]], wallCol.startsWith('#') ? wallCol : wallCol);
  const ribbon = boardTexture(ar, label, 34);
  g.save();
  g.globalAlpha = 0.85;
  texQuad(g, cam, ribbon, (u, v) => [-8 + 16 * u, 1.12 - 0.34 * v, -3.94], 16, 1);
  g.restore();
  poly(g, cam, [[-16, 1.12, -3.93], [16, 1.12, -3.93], [16, 1.15, -3.93], [-16, 1.15, -3.93]], 'rgba(255,255,255,0.7)');
}

// ---------- boards ----------
const BOARD_H = 0.78;
function boardQuads() {
  return [
    { a: [-3.0, -3.7], b: [3.0, -3.7] },
    { a: [-3.4, 1.2], b: [-3.0, -3.7] },
    { a: [3.0, -3.7], b: [3.4, 1.2] },
  ];
}

function drawBoards(g, cam, ar, label, mirror) {
  for (const q of boardQuads()) {
    const len = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
    const tex = boardTexture(ar, label, len);
    const ys = mirror ? -1 : 1;
    texQuad(g, cam, tex, (u, v) => [q.a[0] + (q.b[0] - q.a[0]) * u, ys * BOARD_H * (1 - v), q.a[1] + (q.b[1] - q.a[1]) * u], 10, 1);
    if (!mirror) {
      // light spill above the boards
      const m = cam.proj((q.a[0] + q.b[0]) / 2, BOARD_H, (q.a[1] + q.b[1]) / 2);
      if (m) glow(g, m[0], m[1], cam.W * 0.25, ar.boards.text === '#ffffff' ? ar.boards.bg[0] : ar.boards.text, 0.12);
    }
  }
}

// ---------- table ----------
const TOP_T = 0.035;

function drawTableBase(g, cam, ar, mirror) {
  const ys = mirror ? -1 : 1;
  const P = (x, y, z) => [x, ys * y, z];
  const c = ar.baseColor;
  const acc = ar.baseAccent;
  const yTop = TABLE_Y - TOP_T - 0.06;
  const box = (x0, x1, y0, y1, z0, z1, col) => {
    // back-to-front: back, sides, top, front
    poly(g, cam, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], shade(col, 0.6));
    poly(g, cam, [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], shade(col, 0.8));
    poly(g, cam, [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], shade(col, 0.72));
    poly(g, cam, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], col);
  };
  const b = ar.base;
  if (b === 'posts') {
    for (const z of [-1.05, 1.05]) {
      for (const x of [-0.62, 0.62]) {
        box(x - 0.045, x + 0.045, 0.0, yTop, z - 0.045, z + 0.045, c);
        box(x - 0.055, x + 0.055, 0.0, 0.1, z - 0.055, z + 0.055, '#202024');
        box(x - 0.047, x + 0.047, yTop - 0.12, yTop - 0.06, z - 0.047, z + 0.047, acc);
      }
      box(-0.62, 0.62, yTop - 0.08, yTop, z - 0.03, z + 0.03, acc);
    }
  } else if (b === 'prism') {
    const cols = [c, acc, '#ffd400', '#7b2bd9', '#22c55e', '#ff7a1a'];
    const ring = (rx, rz, y) => Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return [Math.cos(a) * rx, y, Math.sin(a) * rz];
    });
    const top = ring(0.5, 0.95, yTop);
    const mid = ring(0.32, 0.55, yTop * 0.45);
    const bot = ring(0.55, 0.9, 0.02);
    const faces = [];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      faces.push({ pts: [top[i], top[j], mid[j], mid[i]], col: cols[i % cols.length] });
      faces.push({ pts: [mid[i], mid[j], bot[j], bot[i]], col: cols[(i + 3) % cols.length] });
    }
    faces.sort((f1, f2) => f1.pts.reduce((s, p) => s + p[2], 0) - f2.pts.reduce((s, p) => s + p[2], 0));
    for (const f of faces) {
      // triangle split for a faceted look
      poly(g, cam, [P(...f.pts[0]), P(...f.pts[1]), P(...f.pts[2])], f.col);
      poly(g, cam, [P(...f.pts[0]), P(...f.pts[2]), P(...f.pts[3])], shade(f.col.startsWith('#') ? f.col : '#888888', 0.8));
    }
    poly(g, cam, bot.map((p) => P(p[0] * 1.05, 0.005, p[2] * 1.05)), 'rgba(0,0,0,0.35)');
  } else if (b === 'drum') {
    for (const x of [-0.42, 0.42]) box(x - 0.1, x + 0.1, 0, 0.05, 0.5, 1.1, '#2a2a30');
    const R0 = 0.31;
    const yc = 0.42;
    // cylinder lying along x, seen from the front: shaded body + end caps
    const p0 = cam.proj(-0.62, ys * (yc + R0), 1.05);
    const p1 = cam.proj(0.62, ys * (yc - R0), 1.05);
    if (p0 && p1) {
      const top = Math.min(p0[1], p1[1]);
      const hh = Math.abs(p1[1] - p0[1]);
      const gr = g.createLinearGradient(0, top, 0, top + hh);
      gr.addColorStop(0, shade(c, 0.9));
      gr.addColorStop(0.35, shade('#7a7a86', 1));
      gr.addColorStop(0.6, shade(c, 1.3));
      gr.addColorStop(1, shade(c, 0.6));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(p0[0], top + hh / 2, hh * 0.18, hh / 2, 0, Math.PI / 2, Math.PI * 1.5);
      g.lineTo(p1[0], top);
      g.ellipse(p1[0], top + hh / 2, hh * 0.18, hh / 2, 0, -Math.PI / 2, Math.PI / 2);
      g.closePath();
      g.fill();
      g.fillStyle = acc;
      for (const k of [0.18, 0.78]) g.fillRect(p0[0], top + hh * k, p1[0] - p0[0], hh * 0.05);
      g.fillStyle = rgba('#ffffff', 0.85);
      g.font = `900 ${Math.round(hh * 0.32)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (!mirror) g.fillText('卓球', (p0[0] + p1[0]) / 2, top + hh * 0.5);
    }
  } else if (b === 'block') {
    box(-0.58, 0.58, 0.03, yTop, -1.0, 1.0, c);
    poly(g, cam, [P(-0.4, 0.12, 1.001), P(0.4, 0.12, 1.001), P(0.4, yTop - 0.12, 1.001), P(-0.4, yTop - 0.12, 1.001)], shade(c, 0.45));
    box(-0.62, 0.62, 0, 0.04, -1.04, 1.04, '#1c1c22');
    poly(g, cam, [P(-0.58, yTop - 0.03, 1.002), P(0.58, yTop - 0.03, 1.002), P(0.58, yTop, 1.002), P(-0.58, yTop, 1.002)], acc);
  } else if (b === 'arch') {
    for (const z of [-1.0, 1.0]) {
      const p0 = cam.proj(-0.66, ys * yTop, z);
      const p1 = cam.proj(0.66, ys * 0, z);
      if (!p0 || !p1) continue;
      const s = p0[2];
      const L = p0[0];
      const T = Math.min(p0[1], p1[1]);
      const w = p1[0] - p0[0];
      const hgt = Math.abs(p1[1] - p0[1]);
      g.save();
      g.fillStyle = shade(c, z > 0 ? 1 : 0.7);
      g.beginPath();
      g.rect(L, T, w, hgt);
      // arch opening
      const ow = 0.36 * s;
      const cxp = L + w / 2;
      const yb = mirror ? T : T + hgt;
      g.moveTo(cxp + ow, yb);
      g.lineTo(cxp + ow, yb + (mirror ? 0.32 : -0.32) * s);
      g.arc(cxp, yb + (mirror ? 0.32 : -0.32) * s, ow, 0, Math.PI, !mirror);
      g.lineTo(cxp - ow, yb);
      g.closePath();
      g.fill('evenodd');
      // sunset half-discs on both pillars
      for (const px of [L + w * 0.13, L + w * 0.87]) {
        const r = 0.16 * s;
        const py = mirror ? T + hgt * 0.35 : T + hgt * 0.65;
        for (let k = 0; k < 6; k++) {
          g.fillStyle = k % 2 ? acc : shade(acc, 0.65);
          g.fillRect(px - r, py - r + (k * r) / 3, r * 2, r / 6);
        }
        g.globalCompositeOperation = 'destination-over';
        g.globalCompositeOperation = 'source-over';
      }
      g.restore();
    }
  } else if (b === 'vlegs' || b === 'x') {
    for (const z of [-1.0, 1.0]) {
      const pairs = b === 'x'
        ? [[[-0.62, 0, z], [0.62, yTop, z]], [[0.62, 0, z], [-0.62, yTop, z]], [[-0.62, yTop * 0.5, z], [0.62, yTop * 0.5, z]]]
        : [[[-0.62, yTop, z], [-0.25, 0, z]], [[-0.25, 0, z], [0, yTop, z]], [[0, yTop, z], [0.25, 0, z]], [[0.25, 0, z], [0.62, yTop, z]]];
      for (const [i, [p, q]] of pairs.entries()) {
        const a = cam.proj(p[0], ys * p[1], p[2]);
        const d = cam.proj(q[0], ys * q[1], q[2]);
        if (!a || !d) continue;
        const col = b === 'x' ? c : i % 2 ? acc : c;
        if (b === 'vlegs' && !mirror) {
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = rgba(col, 0.35);
          g.lineWidth = Math.max(6, 0.12 * a[2]);
          g.beginPath();
          g.moveTo(a[0], a[1]);
          g.lineTo(d[0], d[1]);
          g.stroke();
          g.restore();
        }
        g.strokeStyle = col;
        g.lineWidth = Math.max(3, (b === 'x' ? 0.07 : 0.04) * a[2]);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(d[0], d[1]);
        g.stroke();
      }
    }
    g.lineCap = 'butt';
  }
}

function drawTableTop(g, cam, ar, label) {
  const y = TABLE_Y;
  const yb = TABLE_Y - TOP_T;
  // side faces (left/right) and near face
  poly(g, cam, [[-HALF_W, yb, -HALF_L], [-HALF_W, yb, HALF_L], [-HALF_W, y, HALF_L], [-HALF_W, y, -HALF_L]], shade(ar.edge, 1.3));
  poly(g, cam, [[HALF_W, yb, -HALF_L], [HALF_W, yb, HALF_L], [HALF_W, y, HALF_L], [HALF_W, y, -HALF_L]], shade(ar.edge, 1.1));
  // apron under the near edge with the city name
  const apron = apronTexture(ar, label);
  texQuad(g, cam, apron, (u, v) => [-HALF_W + 0.04 + (HALF_W * 2 - 0.08) * u, yb - 0.11 * v, HALF_L - 0.03], 6, 1);
  poly(g, cam, [[-HALF_W, yb, HALF_L], [HALF_W, yb, HALF_L], [HALF_W, y, HALF_L], [-HALF_W, y, HALF_L]], ar.edge);
  // white rim on the near edge
  poly(g, cam, [[-HALF_W, y - 0.008, HALF_L + 0.001], [HALF_W, y - 0.008, HALF_L + 0.001], [HALF_W, y, HALF_L + 0.001], [-HALF_W, y, HALF_L + 0.001]], 'rgba(255,255,255,0.9)');
  // top surface with sheen
  const q = [cam.proj(-HALF_W, y, -HALF_L), cam.proj(HALF_W, y, -HALF_L), cam.proj(HALF_W, y, HALF_L), cam.proj(-HALF_W, y, HALF_L)];
  const gr = g.createLinearGradient(0, q[0][1], 0, q[2][1]);
  gr.addColorStop(0, shade(ar.table, 0.82));
  gr.addColorStop(0.55, shade(ar.table, 1.04));
  gr.addColorStop(1, shade(ar.table, 0.92));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]);
  g.closePath();
  g.fill();
  // venue light reflection on the top
  g.save();
  g.clip();
  const m = cam.proj(0.15, y, -0.6);
  glow(g, m[0], m[1], cam.W * 0.45, '#ffffff', 0.13);
  g.restore();
  // lines
  const L = (x0, z0, x1, z1, w) => poly(g, cam, [[x0 - w, y + 0.001, z0], [x0 + w, y + 0.001, z0], [x1 + w, y + 0.001, z1], [x1 - w, y + 0.001, z1]], 'rgba(255,255,255,0.95)');
  const Lz = (z, w) => poly(g, cam, [[-HALF_W, y + 0.001, z - w], [HALF_W, y + 0.001, z - w], [HALF_W, y + 0.001, z + w], [-HALF_W, y + 0.001, z + w]], 'rgba(255,255,255,0.95)');
  L(0, -HALF_L, 0, HALF_L, 0.004);
  L(-HALF_W + 0.01, -HALF_L, -HALF_W + 0.01, HALF_L, 0.01);
  L(HALF_W - 0.01, -HALF_L, HALF_W - 0.01, HALF_L, 0.01);
  Lz(-HALF_L + 0.01, 0.01);
  Lz(HALF_L - 0.01, 0.01);
}

function drawFloor(g, cam, ar, label) {
  const tex = floorTexture(ar, label);
  // floor area x in [-7, 7], z in [-5, 4]
  texQuad(g, cam, tex, (u, v) => [-7 + 14 * u, 0, -5 + 9 * v], 12, 12);
}

// Full static layer.
export function buildScene(cam, ar, label, dpr) {
  const c = mk(Math.round(cam.W * dpr), Math.round(cam.H * dpr));
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSky(g, cam, ar);
  drawSkyline(g, cam, ar);
  drawFeatureLights(g, cam, ar);
  drawCrowd(g, cam, ar, label);
  drawFloor(g, cam, ar, label);
  // glossy reflections of boards and table base
  g.save();
  g.globalAlpha = 0.22;
  drawBoards(g, cam, ar, label, true);
  drawTableBase(g, cam, ar, true);
  g.restore();
  // soft light pools on the floor
  const pc = cam.proj(0, 0, -0.3);
  glow(g, pc[0], pc[1], cam.W * 0.75, ar.light, 0.16);
  drawBoards(g, cam, ar, label, false);
  // table shadow on the floor
  const s0 = cam.proj(0, 0, 0);
  const s1 = cam.proj(1.1, 0, 0);
  const s2 = cam.proj(0, 0, 1.6);
  if (s0 && s1 && s2) {
    g.save();
    g.translate(s0[0], s0[1]);
    g.scale(1, Math.abs(s2[1] - s0[1]) / Math.abs(s1[0] - s0[0]) || 0.4);
    const rr = Math.abs(s1[0] - s0[0]);
    const sg = g.createRadialGradient(0, 0, rr * 0.2, 0, 0, rr);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(0, 0, rr, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  drawTableBase(g, cam, ar, false);
  drawTableTop(g, cam, ar, label);
  // vignette
  const vg = g.createRadialGradient(cam.W / 2, cam.H * 0.55, cam.H * 0.3, cam.W / 2, cam.H * 0.55, cam.H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg;
  g.fillRect(0, 0, cam.W, cam.H);
  return c;
}
