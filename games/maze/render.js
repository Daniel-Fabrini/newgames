// Tilt Maze renderer (Canvas 2D): cached floor + wall shadows, extruded gold walls with tilt parallax,
// steel ball with a rolling texture, holes, zones, bumpers, wiper gates, goal and checkpoints.
import { WALL_T, BALL_R, bumperPos, barSegment, cellCentre } from './logic.js';

const TAU = Math.PI * 2;
const WALL_H = 0.34;
const SLICES = 6;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBoard(canvas) {
  const ctx = canvas.getContext('2d');
  const floor = document.createElement('canvas');
  const fctx = floor.getContext('2d');
  let level = null;
  let cp = 40; // css pixels per cell
  let dpr = 1;
  let S = 40; // device pixels per cell
  // rolling texture: three marks on the sphere
  const marks = [[0.2, 0.1, 0.97], [-0.7, 0.5, 0.5], [0.6, -0.65, 0.45]].map((v) => norm(v));
  function norm(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function setLevel(lv, cellCss, ratio) {
    level = lv;
    cp = cellCss;
    dpr = ratio;
    S = cp * dpr;
    canvas.width = Math.round(lv.width * S);
    canvas.height = Math.round(lv.height * S);
    canvas.style.width = lv.width * cp + 'px';
    canvas.style.height = lv.height * cp + 'px';
    floor.width = canvas.width;
    floor.height = canvas.height;
    bakeFloor();
  }

  function bakeFloor() {
    const g = fctx;
    const w = floor.width, h = floor.height;
    // brushed dark steel plate
    const base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#1c1c22');
    base.addColorStop(0.5, '#131318');
    base.addColorStop(1, '#0b0b0e');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = mulberry(level.seed ^ 0x9e3779b9);
    g.lineWidth = 1;
    for (let i = 0; i < w / 3; i++) {
      g.strokeStyle = `rgba(255,255,255,${(0.012 + r() * 0.025).toFixed(3)})`;
      const y = r() * h;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (r() - 0.5) * 6);
      g.stroke();
    }
    // faint cell grid
    g.strokeStyle = 'rgba(243,194,74,0.045)';
    g.lineWidth = Math.max(1, dpr * 0.8);
    g.beginPath();
    for (let x = 1; x < level.width; x++) { g.moveTo(x * S, 0); g.lineTo(x * S, h); }
    for (let y = 1; y < level.height; y++) { g.moveTo(0, y * S); g.lineTo(w, y * S); }
    g.stroke();
    const { cols } = level.maze;
    // zones (static part)
    for (const z of level.zones) {
      const x = (z.cell % cols) * S, y = Math.floor(z.cell / cols) * S;
      if (z.kind === 'sticky') {
        const gr = g.createRadialGradient(x + S / 2, y + S / 2, S * 0.1, x + S / 2, y + S / 2, S * 0.7);
        gr.addColorStop(0, 'rgba(214,150,40,0.38)');
        gr.addColorStop(1, 'rgba(160,100,20,0.25)');
        g.fillStyle = gr;
        g.fillRect(x + S * 0.04, y + S * 0.04, S * 0.92, S * 0.92);
        g.fillStyle = 'rgba(255,214,120,0.35)';
        const rr = mulberry(z.cell * 77 + 3);
        for (let i = 0; i < 26; i++) {
          g.beginPath();
          g.arc(x + S * (0.12 + rr() * 0.76), y + S * (0.12 + rr() * 0.76), S * (0.012 + rr() * 0.022), 0, TAU);
          g.fill();
        }
      } else if (z.kind === 'ice') {
        const gr = g.createLinearGradient(x, y, x + S, y + S);
        gr.addColorStop(0, 'rgba(150,225,255,0.42)');
        gr.addColorStop(1, 'rgba(70,150,220,0.28)');
        g.fillStyle = gr;
        g.fillRect(x + S * 0.04, y + S * 0.04, S * 0.92, S * 0.92);
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = Math.max(1, dpr);
        g.beginPath();
        g.moveTo(x + S * 0.18, y + S * 0.3); g.lineTo(x + S * 0.42, y + S * 0.18);
        g.moveTo(x + S * 0.55, y + S * 0.82); g.lineTo(x + S * 0.84, y + S * 0.62);
        g.moveTo(x + S * 0.3, y + S * 0.7); g.lineTo(x + S * 0.4, y + S * 0.6);
        g.stroke();
      }
    }
    // holes: dark wells
    for (const hole of level.holes) {
      const hx = hole.x * S, hy = hole.y * S, hr = hole.r * S;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.8)';
      g.shadowBlur = hr * 0.5;
      g.beginPath();
      g.arc(hx, hy, hr, 0, TAU);
      g.fillStyle = '#000';
      g.fill();
      g.restore();
      const gr = g.createRadialGradient(hx - hr * 0.2, hy - hr * 0.25, hr * 0.1, hx, hy, hr);
      gr.addColorStop(0, '#000');
      gr.addColorStop(0.7, '#050403');
      gr.addColorStop(1, '#1d1608');
      g.beginPath();
      g.arc(hx, hy, hr, 0, TAU);
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = Math.max(1.5, dpr * 1.6);
      g.strokeStyle = 'rgba(243,194,74,0.7)';
      g.stroke();
      g.beginPath();
      g.arc(hx, hy, hr * 0.74, 0, TAU);
      g.lineWidth = Math.max(1, dpr * 0.8);
      g.strokeStyle = 'rgba(243,194,74,0.16)';
      g.stroke();
    }
    // wall shadows on the plate
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.filter = `blur(${Math.max(2, S * 0.07)}px)`;
    g.beginPath();
    for (const r of level.rects.list) g.rect((r[0] + 0.1) * S, (r[1] + 0.16) * S, (r[2] - r[0]) * S, (r[3] - r[1]) * S);
    g.fill();
    g.restore();
    // start pad
    const [sx, sy] = cellCentre(level.maze, level.start);
    g.beginPath();
    g.arc(sx * S, sy * S, S * 0.34, 0, TAU);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.setLineDash([S * 0.08, S * 0.07]);
    g.lineWidth = Math.max(1.2, dpr * 1.3);
    g.stroke();
    g.setLineDash([]);
  }

  function wallPath(ox, oy, sc, cxm, cym) {
    ctx.beginPath();
    for (const r of level.rects.list) {
      const x0 = (cxm + (r[0] - cxm) * sc + ox) * S, y0 = (cym + (r[1] - cym) * sc + oy) * S;
      const x1 = (cxm + (r[2] - cxm) * sc + ox) * S, y1 = (cym + (r[3] - cym) * sc + oy) * S;
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  const sideCols = ['#241a06', '#2e2208', '#3a2b0c', '#4a380f', '#5e4512', '#745717'];

  function draw(st) {
    if (!level) return;
    const { t, ball, tilt, fx } = st;
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(floor, 0, 0);
    const cols = level.maze.cols;
    // animated zone parts: boost chevrons
    for (const z of level.zones) {
      if (z.kind !== 'boost') continue;
      const x = (z.cell % cols) * S, y = Math.floor(z.cell / cols) * S;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + S * 0.05, y + S * 0.05, S * 0.9, S * 0.9);
      ctx.clip();
      ctx.fillStyle = 'rgba(47,210,122,0.16)';
      ctx.fillRect(x, y, S, S);
      ctx.translate(x + S / 2, y + S / 2);
      ctx.rotate(Math.atan2(z.dir[1], z.dir[0]));
      ctx.strokeStyle = 'rgba(120,255,176,0.9)';
      ctx.lineWidth = Math.max(2, S * 0.07);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = -1; i <= 1; i++) {
        const off = ((t * 0.9 + i * 0.34) % 1) - 0.5;
        const px = off * S * 0.9;
        ctx.globalAlpha = 1 - Math.abs(off) * 1.5;
        ctx.beginPath();
        ctx.moveTo(px - S * 0.1, -S * 0.2);
        ctx.lineTo(px + S * 0.07, 0);
        ctx.lineTo(px - S * 0.1, S * 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // goal
    const [gx, gy] = cellCentre(level.maze, level.goal);
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.save();
    const gg = ctx.createRadialGradient(gx * S, gy * S, S * 0.05, gx * S, gy * S, S * (0.5 + pulse * 0.08));
    gg.addColorStop(0, 'rgba(255,240,170,0.95)');
    gg.addColorStop(0.45, 'rgba(255,200,70,0.55)');
    gg.addColorStop(1, 'rgba(255,200,70,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(gx * S, gy * S, S * (0.55 + pulse * 0.08), 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, S * 0.05);
    ctx.strokeStyle = '#ffe9a0';
    ctx.beginPath();
    ctx.arc(gx * S, gy * S, S * 0.3, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a0';
    star(ctx, gx * S, gy * S, S * 0.16, S * 0.07, t * 0.8);
    ctx.restore();
    // checkpoints
    level.checkpoints.forEach((c, i) => {
      const reached = ball.cp >= i;
      ctx.save();
      ctx.translate(c.x * S, c.y * S);
      ctx.strokeStyle = reached ? '#7dffb0' : 'rgba(255,255,255,0.55)';
      ctx.fillStyle = reached ? '#2fd27a' : 'rgba(243,194,74,0.8)';
      ctx.lineWidth = Math.max(1.5, S * 0.04);
      ctx.beginPath();
      ctx.moveTo(-S * 0.05, S * 0.22);
      ctx.lineTo(-S * 0.05, -S * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-S * 0.05, -S * 0.22);
      ctx.lineTo(S * 0.2, -S * 0.12);
      ctx.lineTo(-S * 0.05, -S * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    // ball shadow, then ball (rests on the plate, below the walls)
    drawBall(ball, tilt, t);
    // moving obstacles
    const px = -(tilt.x * 0.12), py = -(tilt.y * 0.12);
    for (const b of level.bumpers) {
      const [bx, by] = bumperPos(b, ball.simT || t);
      drawBumper(bx, by, b.r, px, py);
    }
    // extruded walls with parallax. Tops move away from the board centre (perspective) and against the tilt.
    const cxm = level.width / 2, cym = level.height / 2;
    for (let s = 0; s <= SLICES; s++) {
      const k = s / SLICES;
      const sc = 1 + 0.05 * k;
      const ox = tilt.x * -0.2 * k - 0.04 * k, oy = tilt.y * -0.2 * k - 0.07 * k;
      wallPath(ox, oy, sc, cxm, cym);
      if (s < SLICES) {
        ctx.fillStyle = sideCols[s];
        ctx.fill();
      } else {
        const gr = ctx.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, '#fff0a8');
        gr.addColorStop(0.35, '#f1c64a');
        gr.addColorStop(0.7, '#d6a02a');
        gr.addColorStop(1, '#a8761a');
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.lineWidth = Math.max(1, dpr * 0.8);
        ctx.strokeStyle = 'rgba(255,248,210,0.55)';
        ctx.stroke();
      }
    }
    // wiper gates sit above the plate: draw them over the walls' base
    for (const b of level.bars) drawBar(b, ball.simT || t, px, py);
    // fx: little ripples
    if (fx && fx.length) {
      ctx.save();
      for (const f of fx) {
        if (f.age < 0) continue;
        const k = f.age / f.life;
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = Math.max(1.5, S * 0.04) * (1 - k * 0.5);
        ctx.beginPath();
        ctx.arc(f.x * S, f.y * S, S * (0.1 + k * f.size), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function star(g, x, y, R, r, rot) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 ? r : R;
      g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath();
    g.fill();
  }

  function drawBumper(bx, by, br, px, py) {
    const x = (bx + px * 0.5) * S, y = (by + py * 0.5) * S, r = br * S;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.5, y + r * 0.65, r * 1.05, r * 0.85, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, '#ffb3a0');
    g.addColorStop(0.45, '#e2483a');
    g.addColorStop(1, '#7a1710');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.05, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, S * 0.035);
    ctx.strokeStyle = '#f3c24a';
    ctx.stroke();
    ctx.restore();
  }

  function drawBar(b, t, px, py) {
    const seg = barSegment(b, t);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = S * 0.14;
    ctx.beginPath();
    ctx.moveTo((seg.x0 + 0.06) * S, (seg.y0 + 0.1) * S);
    ctx.lineTo((seg.x1 + 0.06) * S, (seg.y1 + 0.1) * S);
    ctx.stroke();
    const x0 = (seg.x0 + px) * S, y0 = (seg.y0 + py) * S, x1 = (seg.x1 + px) * S, y1 = (seg.y1 + py) * S;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#d6a02a');
    ctx.strokeStyle = '#6a4f14';
    ctx.lineWidth = S * 0.15;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = g;
    ctx.lineWidth = S * 0.1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.fillStyle = '#2a1f08';
    ctx.beginPath();
    ctx.arc(x0, y0, S * 0.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBall(ball, tilt, t) {
    const r = ball.r * S;
    let scale = 1, alpha = 1;
    let bx = ball.x, by = ball.y;
    if (ball.state === 'fall') {
      const k = Math.min(1, ball.fall / 0.6);
      scale = 1 - k * 0.85;
      alpha = 1 - k * 0.5;
    }
    const x = bx * S, y = by * S;
    const lift = 0.1 * S;
    ctx.save();
    ctx.globalAlpha = alpha;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.28 * scale + tilt.x * -r * 0.2, y + r * 0.42 * scale + tilt.y * -r * 0.2 + lift * 0.3, r * 0.98 * scale, r * 0.9 * scale, 0, 0, TAU);
    ctx.fill();
    // body
    const R = r * scale;
    const g = ctx.createRadialGradient(x - R * 0.38, y - R * 0.42 - lift * 0.2, R * 0.05, x, y - lift * 0.2, R * 1.05);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, '#dfe6ee');
    g.addColorStop(0.55, '#8b97a6');
    g.addColorStop(0.9, '#323a46');
    g.addColorStop(1, '#14181e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - lift * 0.2, R, 0, TAU);
    ctx.fill();
    // rolling marks
    if (ball.rot) {
      for (const m of ball.rot) {
        if (m[2] <= 0.05) continue;
        ctx.globalAlpha = alpha * Math.min(1, m[2] * 1.4) * 0.45;
        ctx.fillStyle = '#10151b';
        ctx.beginPath();
        ctx.ellipse(x + m[0] * R * 0.86, y - lift * 0.2 + m[1] * R * 0.86, R * 0.13 * m[2] + 0.5, R * 0.13 * m[2] + 0.5, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }
    // rim light + specular
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1, R * 0.06);
    ctx.beginPath();
    ctx.arc(x, y - lift * 0.2, R * 0.96, Math.PI * 0.1, Math.PI * 0.7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(x - R * 0.36, y - R * 0.42 - lift * 0.2, R * 0.2, R * 0.13, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // advance the rolling marks by the distance travelled
  function roll(ball, dx, dy) {
    if (!ball.rot) ball.rot = marks.map((m) => m.slice());
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    // rotation axis perpendicular to the motion in the plane, angle = distance / radius
    const ax = -dy / d, ay = dx / d;
    const ang = d / ball.r;
    const c = Math.cos(ang), s = Math.sin(ang);
    for (const m of ball.rot) {
      // Rodrigues with axis (ax, ay, 0)
      const dot = ax * m[0] + ay * m[1];
      const cx = ay * m[2], cy = -ax * m[2], cz = ax * m[1] - ay * m[0];
      const nx = m[0] * c + cx * s + ax * dot * (1 - c);
      const ny = m[1] * c + cy * s + ay * dot * (1 - c);
      const nz = m[2] * c + cz * s;
      const l = Math.hypot(nx, ny, nz);
      m[0] = nx / l; m[1] = ny / l; m[2] = nz / l;
    }
  }

  return { setLevel, draw, roll, get cell() { return cp; } };
}
