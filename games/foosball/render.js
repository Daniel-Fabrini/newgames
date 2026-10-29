// Foosball — canvas renderer (table layer is cached; rods, men, ball, trail and confetti are drawn live).
import { T, manX, footY, footActive, goalX0, goalX1 } from './physics.js';

export const VIEW = { mx: 13.5, my: 14 }; // margin (units) around the playfield: frame + handles / goal pockets

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export function createRenderer(canvas, { reduced = false } = {}) {
  const c = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const fg = document.createElement('canvas');
  const R = { sc: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
  const trail = [];
  const parts = [];
  let shake = 0;
  let goalFlash = { team: -1, t: 0 };
  const kits = [{ main: '#e4372f' }, { main: '#2f7be4' }];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return false;
    R.dpr = dpr; R.cw = cw; R.ch = ch;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const W = T.W + VIEW.mx * 2, H = T.H + VIEW.my * 2;
    R.sc = Math.min(cw / W, ch / H);
    R.ox = (cw - T.W * R.sc) / 2;
    R.oy = (ch - T.H * R.sc) / 2;
    for (const l of [bg, fg]) { l.width = canvas.width; l.height = canvas.height; }
    paintBg();
    paintFg();
    return true;
  }

  const tf = (g) => g.setTransform(R.dpr * R.sc, 0, 0, R.dpr * R.sc, R.dpr * R.ox, R.dpr * R.oy);

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
  }

  function paintBg() {
    const g = bg.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, bg.width, bg.height);
    tf(g);
    const { W, H, goalD: D, bevel: b } = T;
    // outer wooden frame
    const fx = -6.5, fy = -D - 5, fw = W + 13, fh = H + 2 * D + 10;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = 14 * R.sc;
    g.shadowOffsetY = 4 * R.sc;
    const wood = g.createLinearGradient(fx, 0, fx + fw, 0);
    wood.addColorStop(0, '#6b3f1e'); wood.addColorStop(0.5, '#8a5a30'); wood.addColorStop(1, '#5e3519');
    g.fillStyle = wood;
    rr(g, fx, fy, fw, fh, 5);
    g.fill();
    g.restore();
    // wood grain
    g.save();
    rr(g, fx, fy, fw, fh, 5); g.clip();
    g.globalAlpha = 0.18;
    for (let i = 0; i < 46; i++) {
      const x = fx + ((i * 37.7) % fw), w = 0.25 + ((i * 13) % 5) * 0.12;
      g.fillStyle = i % 3 ? '#2a1507' : '#c58a52';
      g.fillRect(x, fy, w, fh);
    }
    g.globalAlpha = 1;
    // bevel highlight
    g.strokeStyle = 'rgba(255,214,150,.45)'; g.lineWidth = 0.5;
    rr(g, fx + 0.5, fy + 0.5, fw - 1, fh - 1, 4.6); g.stroke();
    g.restore();
    // playfield outline polygon (corner bevels)
    const poly = () => {
      g.beginPath();
      g.moveTo(b, 0); g.lineTo(goalX0, 0); g.lineTo(goalX0, 0);
      g.lineTo(goalX1, 0); g.lineTo(W - b, 0); g.lineTo(W, b); g.lineTo(W, H - b); g.lineTo(W - b, H);
      g.lineTo(goalX1, H); g.lineTo(goalX0, H); g.lineTo(b, H); g.lineTo(0, H - b); g.lineTo(0, b); g.closePath();
    };
    // dark inset behind the field
    g.fillStyle = '#1c120a';
    rr(g, -2.2, -D - 1.6, W + 4.4, H + 2 * D + 3.2, 3);
    g.fill();
    // goal pockets with nets
    for (const top of [true, false]) {
      const y0 = top ? -D : H, y1 = top ? 0 : H + D;
      const ng = g.createLinearGradient(0, y0, 0, y1);
      ng.addColorStop(top ? 0 : 1, '#0b0f12'); ng.addColorStop(top ? 1 : 0, '#26303a');
      g.fillStyle = ng;
      g.fillRect(goalX0, y0, T.goalW, D);
      g.save();
      g.beginPath(); g.rect(goalX0, y0, T.goalW, D); g.clip();
      g.strokeStyle = 'rgba(230,240,255,.28)'; g.lineWidth = 0.18;
      for (let x = goalX0; x <= goalX1; x += 1.6) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); }
      for (let y = y0; y <= y1; y += 1.6) { g.beginPath(); g.moveTo(goalX0, y); g.lineTo(goalX1, y); g.stroke(); }
      g.restore();
      for (const x of [goalX0, goalX1]) {
        g.fillStyle = '#f4f6fa';
        g.beginPath(); g.arc(x, top ? 0 : H, 0.9, 0, 7); g.fill();
      }
    }
    // grass
    g.save();
    poly(); g.clip();
    const bands = 10, bh = H / bands;
    for (let i = 0; i < bands; i++) {
      g.fillStyle = i % 2 ? '#2c8a46' : '#35a053';
      g.fillRect(0, i * bh, W, bh + 0.05);
    }
    const vg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H * 0.72);
    vg.addColorStop(0, 'rgba(255,255,255,.08)'); vg.addColorStop(1, 'rgba(0,20,0,.35)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // markings
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.55; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 10, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(W / 2, H / 2, 1, 0, 7); g.fill();
    for (const top of [true, false]) {
      const y = top ? 0 : H, d = top ? 1 : -1;
      g.beginPath(); g.rect(goalX0 - 8, top ? 0 : H - 15, T.goalW + 16, 15); g.stroke();
      g.beginPath(); g.rect(goalX0 - 1, top ? 0 : H - 6, T.goalW + 2, 6); g.stroke();
      g.beginPath(); g.arc(W / 2, y + d * 15, 6, top ? 0 : Math.PI, top ? Math.PI : Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(W / 2, y + d * 10.5, 0.6, 0, 7); g.fill();
    }
    g.restore();
    // field outline + corner bevels
    poly();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = '#3b2312';
    for (const [x0, y0, x1, y1, x2, y2] of [[0, 0, b, 0, 0, b], [W, 0, W - b, 0, W, b], [0, H, b, H, 0, H - b], [W, H, W - b, H, W, H - b]]) {
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,200,130,.55)'; g.lineWidth = 0.35;
    for (const [x1, y1, x2, y2] of [[0, b, b, 0], [W - b, 0, W, b], [0, H - b, b, H], [W - b, H, W, H - b]]) {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    // side rails (inner edge) and end walls
    g.fillStyle = '#4a2b14';
    g.fillRect(-2.2, -D - 1.6, 2.2, H + 2 * D + 3.2);
    g.fillRect(W, -D - 1.6, 2.2, H + 2 * D + 3.2);
  }

  function paintFg() {
    const g = fg.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, fg.width, fg.height);
    tf(g);
    const { W, H } = T;
    // rails over the rods with rod holes
    for (const side of [0, 1]) {
      const x = side ? W : -4.6;
      const gr = g.createLinearGradient(x, 0, x + 4.6, 0);
      if (side) { gr.addColorStop(0, '#5e3519'); gr.addColorStop(1, '#8a5a30'); }
      else { gr.addColorStop(0, '#8a5a30'); gr.addColorStop(1, '#5e3519'); }
      g.fillStyle = gr;
      g.fillRect(x, -2, 4.6, H + 4);
      g.fillStyle = 'rgba(255,214,150,.3)';
      g.fillRect(side ? W + 0.2 : -4.6 + 0.2, -2, 0.3, H + 4);
    }
  }

  function manPath(g, x, y, hw, hh) {
    rr(g, x - hw, y - hh, hw * 2, hh * 2, 0.9);
  }

  function drawRod(g, s, r, hi) {
    const { W } = T;
    const kit = kits[r.team].main;
    const col = hi ? 1 : 0;
    // bar
    const bx0 = -5 + r.x * 0.0, bx1 = W + 5;
    const bar = g.createLinearGradient(0, r.y - 0.9, 0, r.y + 0.9);
    bar.addColorStop(0, '#f4f7fb'); bar.addColorStop(0.5, '#aab4c0'); bar.addColorStop(1, '#6d7683');
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.fillRect(bx0, r.y + 0.9, bx1 - bx0, 1.1);
    if (col) {
      g.save();
      g.shadowColor = '#ffd45a'; g.shadowBlur = 10 * R.sc; g.fillStyle = '#ffd45a';
      g.fillRect(-5, r.y - 1.35, W + 10, 2.7);
      g.restore();
    }
    g.fillStyle = bar;
    g.fillRect(bx0, r.y - 0.9, bx1 - bx0, 1.8);
    const th = r.th, sinT = Math.sin(th), cosT = Math.cos(th);
    const fyOff = r.s * T.L * sinT;
    const active = footActive(r);
    for (let k = 0; k < r.n; k++) {
      const mx = manX(r, k);
      const fy = r.y + fyOff;
      const lift = 1 - cosT;
      // shadow
      g.fillStyle = 'rgba(0,0,0,.28)';
      manPath(g, mx + 0.9 + lift * 1.5, fy + 1.3 + lift * 2.2, T.footHX, T.footHY);
      g.fill();
      const lo = Math.min(r.y, fy), hi2 = Math.max(r.y, fy);
      if (hi2 - lo > 0.2) {
        g.fillStyle = 'rgba(0,0,0,.2)';
        g.fillRect(mx - 1.6 + 0.9, lo + 1.3, 3.2, hi2 - lo);
        const lg = g.createLinearGradient(mx - 1.7, 0, mx + 1.7, 0);
        lg.addColorStop(0, shade(kit, 0.75)); lg.addColorStop(0.45, shade(kit, 1.18)); lg.addColorStop(1, shade(kit, 0.7));
        g.fillStyle = lg;
        g.fillRect(mx - 1.7, lo, 3.4, hi2 - lo);
      }
      // foot (shoe)
      const sg = g.createLinearGradient(mx - T.footHX, 0, mx + T.footHX, 0);
      sg.addColorStop(0, '#15171b'); sg.addColorStop(0.5, '#3a3f48'); sg.addColorStop(1, '#14161a');
      g.globalAlpha = active ? 1 : 0.72;
      g.fillStyle = sg;
      manPath(g, mx, fy, T.footHX, T.footHY);
      g.fill();
      g.strokeStyle = kit; g.lineWidth = 0.35;
      manPath(g, mx, fy, T.footHX - 0.2, T.footHY - 0.2);
      g.stroke();
      g.globalAlpha = 1;
      // torso + head on the rod (top view)
      const ty = r.y - r.s * 1.1;
      const tg = g.createLinearGradient(mx - 2.4, ty - 1.8, mx + 2.4, ty + 1.8);
      tg.addColorStop(0, shade(kit, 1.25)); tg.addColorStop(1, shade(kit, 0.72));
      g.fillStyle = tg;
      rr(g, mx - 2.5, ty - 1.5, 5, 3, 1.5);
      g.fill();
      g.fillStyle = '#f0c9a2';
      g.beginPath(); g.arc(mx, ty, 1.3, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.beginPath(); g.arc(mx - 0.4, ty - 0.45, 0.42, 0, 7); g.fill();
    }
    // handle (rubber grip) outside the rail, on the side of the owner
    const right = r.team === 0;
    const gx = right ? W + 5.2 + (r.x / r.slide || 0) * 1.1 : -5.2 - 6.4 + (r.x / r.slide || 0) * 1.1;
    const hg = g.createLinearGradient(0, r.y - 2.2, 0, r.y + 2.2);
    hg.addColorStop(0, '#3a3a3f'); hg.addColorStop(0.5, '#17171a'); hg.addColorStop(1, '#0b0b0d');
    g.fillStyle = hg;
    rr(g, gx, r.y - 2.1, 6.4, 4.2, 1.8);
    g.fill();
    g.fillStyle = shade(kit, 1);
    g.fillRect(right ? gx + 5.1 : gx, r.y - 2.1, 1.3, 4.2);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 0.22;
    for (let i = 1; i < 5; i++) { const x = gx + i * 1; g.beginPath(); g.moveTo(x, r.y - 1.9); g.lineTo(x, r.y + 1.9); g.stroke(); }
  }

  function drawBall(g, s) {
    const b = s.ball;
    // trail
    const sp = Math.hypot(b.vx, b.vy);
    if (!reduced) {
      trail.push({ x: b.x, y: b.y });
      if (trail.length > 12) trail.shift();
      if (sp > 40) {
        for (let i = 0; i < trail.length - 1; i++) {
          const a = (i / trail.length) * Math.min(0.35, sp / 400);
          g.fillStyle = `rgba(255,255,255,${a})`;
          g.beginPath(); g.arc(trail[i].x, trail[i].y, T.R * (0.45 + 0.4 * (i / trail.length)), 0, 7); g.fill();
        }
      }
    }
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(b.x + 0.9, b.y + 1.2, T.R, T.R * 0.9, 0, 0, 7); g.fill();
    const bg2 = g.createRadialGradient(b.x - 0.7, b.y - 0.8, 0.2, b.x, b.y, T.R);
    bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(0.6, '#e9edf2'); bg2.addColorStop(1, '#9aa3ae');
    g.fillStyle = bg2;
    g.beginPath(); g.arc(b.x, b.y, T.R, 0, 7); g.fill();
    g.save();
    g.beginPath(); g.arc(b.x, b.y, T.R, 0, 7); g.clip();
    g.fillStyle = '#20242b';
    const ang = sp > 1 ? Math.atan2(b.vy, b.vx) : 0;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.6;
      const u = Math.cos(a + b.rot) * 1.1, v = Math.sin(a) * 1.1;
      const px = b.x + u * Math.cos(ang) - v * Math.sin(ang) * 0.6, py = b.y + u * Math.sin(ang) + v * Math.cos(ang) * 0.6;
      g.beginPath(); g.arc(px, py, 0.62, 0, 7); g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.2;
    g.beginPath(); g.arc(b.x, b.y, T.R, 0, 7); g.stroke();
  }

  function drawParts(g, dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 1.4 * dt; p.vy *= 1 - 1.4 * dt;
      p.rot += p.vr * dt;
      g.save();
      g.globalAlpha = Math.min(1, p.life * 1.6);
      g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.col;
      g.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s);
      g.restore();
    }
  }

  function draw(s, view, dt) {
    if (!R.cw) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(bg, 0, 0);
    tf(c);
    if (shake > 0 && !reduced) {
      shake = Math.max(0, shake - dt * 4);
      c.translate((Math.random() - 0.5) * shake * 1.4, (Math.random() - 0.5) * shake * 1.4);
    }
    // goal flash
    if (goalFlash.t > 0) {
      goalFlash.t -= dt;
      const top = goalFlash.team === 0;
      const a = Math.max(0, goalFlash.t) / 1.2;
      c.fillStyle = `rgba(255,236,160,${0.5 * a})`;
      c.fillRect(goalX0, top ? -T.goalD : T.H, T.goalW, T.goalD);
    }
    drawBall(c, s);
    const hi = view.hi || [];
    for (const r of s.rods) drawRod(c, s, r, hi.includes(r.i));
    drawParts(c, dt);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(fg, 0, 0);
    tf(c);
    // handles are drawn after rails so they stay visible outside
    for (const r of s.rods) drawHandle(c, r, hi.includes(r.i));
  }

  function drawHandle() { /* handles are part of drawRod (they sit outside the rails) */ }

  function burst(team, x, y) {
    if (reduced) return;
    const cols = [kits[team].main, '#ffd45a', '#ffffff', shade(kits[team].main, 1.3)];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 70;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, col: cols[i % cols.length], s: 0.5 + Math.random() * 0.7, life: 1.2 + Math.random() * 1.2 });
    }
  }
  const sparks = (x, y, n = 6) => {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 30;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: 4, col: '#fff3b0', s: 0.35, life: 0.35 });
    }
  };

  return {
    R, resize, draw, burst, sparks,
    setKits(a, b) { kits[0].main = a; kits[1].main = b; paintFg(); },
    shake(v = 1) { shake = Math.max(shake, v); },
    goal(team) { goalFlash = { team, t: 1.2 }; },
    clearFx() { parts.length = 0; trail.length = 0; },
    toTable(px, py) { return { x: (px - R.ox) / R.sc, y: (py - R.oy) / R.sc }; },
    toScreen(x, y) { return { x: R.ox + x * R.sc, y: R.oy + y * R.sc }; },
  };
}
