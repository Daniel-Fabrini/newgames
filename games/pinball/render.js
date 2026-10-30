// Pinball Pro — Canvas 2D renderer: baked playfield art, lit inserts, bumpers, targets, flippers, ramps,
// chrome ball with trail, sparks, cheap bloom, dot-matrix display and fireworks.
import { W, H, XC } from './tables.js';
import { R } from './sim.js';

const TAU = Math.PI * 2;

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
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

function outline(g) {
  g.beginPath();
  g.moveTo(14, 200);
  g.arc(200, 200, 186, Math.PI, TAU);
  g.lineTo(386, H);
  g.lineTo(14, H);
  g.closePath();
}

export function createRenderer(canvas, tb, opts = {}) {
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  const th = tb.theme;
  const reduced = !!opts.reduced;
  let k = 1, ox = 0, oy = 0, dpr = 1, cw = 0, ch = 0;
  const trails = new Map();
  const parts = [];
  const pops = [];
  let lastT = 0;
  const art = opts.art || null;
  const rampLayer = document.createElement('canvas');

  function resize(w, h, ratio) {
    dpr = ratio;
    cw = w;
    ch = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    k = Math.min(w / W, h / H);
    ox = (w - W * k) / 2;
    oy = (h - H * k) / 2;
    base.width = Math.max(2, Math.round(W * k * dpr));
    base.height = Math.max(2, Math.round(H * k * dpr));
    if (art) bakeArt();
    else bake();
  }
  const toTable = (px, py) => ({ x: (px - ox) / k, y: (py - oy) / k });

  // ------------------------------------------------------------------ pre-rendered artwork (Blender) scaled once
  function bakeArt() {
    const g = bctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, base.width, base.height);
    g.drawImage(art.base, 0, 0, base.width, base.height);
    rampLayer.width = base.width;
    rampLayer.height = base.height;
    const r = rampLayer.getContext('2d');
    r.imageSmoothingQuality = 'high';
    r.drawImage(art.ramp, 0, 0, base.width, base.height);
  }

  // ------------------------------------------------------------------ baked art
  function bake() {
    const g = bctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, base.width, base.height);
    g.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    g.save();
    outline(g);
    g.clip();
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, th.bg0);
    bg.addColorStop(1, th.bg1);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const rnd = mulberry(tb.id === 'neon' ? 7 : 99);
    if (tb.id === 'neon') {
      // neon grid floor + rings
      g.lineWidth = 0.7;
      g.strokeStyle = rgba(th.glow2, 0.1);
      for (let x = -400; x < 800; x += 28) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 240, H);
        g.stroke();
        g.beginPath();
        g.moveTo(x + 240, 0);
        g.lineTo(x, H);
        g.stroke();
      }
      for (const [cx, cy, r, c, a] of [[182, 300, 74, th.glow, 0.28], [182, 300, 118, th.glow2, 0.2], [182, 300, 160, th.glow, 0.14], [182, 520, 60, th.glow2, 0.2]]) {
        g.lineWidth = 3;
        g.strokeStyle = rgba(c, a);
        g.beginPath();
        g.arc(cx, cy, r, 0, TAU);
        g.stroke();
        g.lineWidth = 9;
        g.strokeStyle = rgba(c, a * 0.18);
        g.stroke();
      }
      const rg = g.createRadialGradient(182, 330, 10, 182, 330, 240);
      rg.addColorStop(0, rgba(th.glow, 0.22));
      rg.addColorStop(1, rgba(th.glow, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
      // sunset stripes
      for (let i = 0; i < 6; i++) {
        g.fillStyle = rgba(th.glow2, 0.05 + i * 0.012);
        g.fillRect(40, 440 + i * 14, 270, 4 + i);
      }
      g.font = '900 30px "Nunito", system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = rgba(th.glow2, 0.9);
      g.shadowColor = th.glow2;
      g.shadowBlur = 14;
      g.fillText('NEON', 182, 506);
      g.shadowColor = th.glow;
      g.fillStyle = rgba('#ffffff', 0.9);
      g.font = '900 15px "Nunito", system-ui, sans-serif';
      g.fillText('ARCADE', 182, 526);
      g.shadowBlur = 0;
    } else {
      for (let i = 0; i < 160; i++) {
        const x = rnd() * W, y = rnd() * H, r = rnd() * 1.4 + 0.2;
        g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      for (const [cx, cy, r, c, a] of [[120, 420, 170, th.glow2, 0.22], [280, 200, 150, th.glow, 0.2], [200, 600, 140, th.glow, 0.12]]) {
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, rgba(c, a));
        rg.addColorStop(1, rgba(c, 0));
        g.fillStyle = rg;
        g.fillRect(0, 0, W, H);
      }
      // planet with ring
      const pg = g.createRadialGradient(136, 420, 4, 150, 436, 60);
      pg.addColorStop(0, '#9fd0ff');
      pg.addColorStop(0.6, '#3b6fd0');
      pg.addColorStop(1, '#10224f');
      g.fillStyle = pg;
      g.beginPath();
      g.arc(150, 436, 44, 0, TAU);
      g.fill();
      g.strokeStyle = rgba('#e7d8ff', 0.6);
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(150, 436, 78, 17, -0.35, 0, TAU);
      g.stroke();
      g.font = '900 26px "Nunito", system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = rgba(th.glow, 0.9);
      g.shadowColor = th.glow;
      g.shadowBlur = 12;
      g.fillText('SPACE', 182, 560);
      g.fillStyle = '#fff';
      g.font = '900 13px "Nunito", system-ui, sans-serif';
      g.fillText('STATION', 182, 578);
      g.shadowBlur = 0;
    }
    // launch lane plate
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.fillRect(350, 200, 36, H);
    g.fillStyle = rgba(th.rail, 0.1);
    for (let y = 230; y < 770; y += 26) g.fillRect(363, y, 12, 3);
    // drain shade
    const dg = g.createLinearGradient(0, 735, 0, H);
    dg.addColorStop(0, 'rgba(0,0,0,0)');
    dg.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = dg;
    g.fillRect(14, 735, 336, H - 735);
    // inlane / outlane stripes
    for (const m of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const x = m > 0 ? 24 + 0 : 340;
        g.fillStyle = rgba(th.glow2, 0.1);
        g.fillRect(x - 4, 556 + i * 12, 8, 5);
      }
    }
    // slingshots
    for (const s of tb.slings) {
      const gr = g.createLinearGradient(s.pts[0][0], s.pts[0][1], s.pts[2][0], s.pts[2][1]);
      gr.addColorStop(0, rgba(th.glow, 0.5));
      gr.addColorStop(1, rgba(th.glow2, 0.35));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(s.pts[0][0], s.pts[0][1]);
      g.lineTo(s.pts[1][0], s.pts[1][1]);
      g.lineTo(s.pts[2][0], s.pts[2][1]);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 2;
      g.stroke();
    }
    // lane base plates
    for (const l of tb.lanes) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(l.x, l.y, 12, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(th.rail, 0.5);
      g.lineWidth = 1.5;
      g.stroke();
    }
    for (const p of tb.deco.inserts || []) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.beginPath();
      g.arc(p[0], p[1], 7, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(th.rail, 0.35);
      g.lineWidth = 1.2;
      g.stroke();
    }
    // walls (shadow, body, highlight)
    const walls = tb.segs.filter((s) => s.kind === 'wall' || s.kind === 'gate');
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [w, c, dx, dy] of [[7, 'rgba(0,0,0,0.55)', 2, 3], [4.6, th.rail, 0, 0], [1.5, 'rgba(255,255,255,0.65)', -0.7, -0.8]]) {
      g.lineWidth = w;
      g.strokeStyle = c;
      g.beginPath();
      for (const s of walls) {
        g.moveTo(s.x1 + dx, s.y1 + dy);
        g.lineTo(s.x2 + dx, s.y2 + dy);
      }
      g.stroke();
    }
    g.restore();
    // frame
    outline(g);
    g.lineWidth = 3;
    g.strokeStyle = rgba(th.rail, 0.8);
    g.stroke();
  }

  // ------------------------------------------------------------------ helpers
  const glowCache = new Map();
  function glowSprite(color) {
    let g = glowCache.get(color);
    if (!g) {
      g = document.createElement('canvas');
      g.width = g.height = 64;
      const x = g.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(color, 1));
      gr.addColorStop(0.35, rgba(color, 0.5));
      gr.addColorStop(1, rgba(color, 0));
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      glowCache.set(color, g);
    }
    return g;
  }
  function glow(c, x, y, r, color, a) {
    if (a <= 0.01) return;
    const prev = c.globalAlpha;
    c.globalAlpha = Math.min(1, a) * prev;
    c.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    c.globalAlpha = prev;
  }
  function hull(c, px, py, r0, tx, ty, r1) {
    const dx = tx - px, dy = ty - py;
    const l = Math.hypot(dx, dy);
    const b = Math.atan2(dy, dx);
    const phi = Math.acos((r0 - r1) / l);
    c.beginPath();
    c.arc(px, py, r0, b + phi, b - phi + TAU);
    c.arc(tx, ty, r1, b - phi, b + phi);
    c.closePath();
  }
  function spark(x, y, color, n = 8, sp = 160, life = 0.45) {
    if (reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n && parts.length < 400; i++) {
      const a = Math.random() * TAU, v = sp * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c: color, s: 1 + Math.random() * 1.6 });
    }
  }
  function popup(x, y, text, color = '#fff') {
    if (pops.length < 14) pops.push({ x, y, text, c: color, t: 0 });
  }

  // ------------------------------------------------------------------ frame
  function draw(game, now) {
    if (art) return drawArt(game, now);
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    const sim = game.sim;
    const tsec = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    let sx = 0, sy = 0;
    if (game.shake > 0 && !reduced) {
      sx = (Math.random() - 0.5) * 7 * game.shake;
      sy = (Math.random() - 0.5) * 7 * game.shake;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(ox + sx, oy + sy);
    ctx.scale(k, k);
    ctx.drawImage(base, 0, 0, W, H);

    ctx.save();
    outline(ctx);
    ctx.clip();

    // ----- inserts / lights (additive)
    ctx.globalCompositeOperation = 'lighter';
    const chase = Math.floor(tsec * 6);
    (tb.deco.inserts || []).forEach((p, i) => {
      let on = 0;
      if (game.mbLit) on = (i + chase) % 4 === 0 ? 1 : 0.25;
      else if (game.multiball) on = (i + chase) % 2 ? 0.9 : 0.2;
      else on = game.mult > i ? 0.9 : 0.12;
      glow(ctx, p[0], p[1], on > 0.5 ? 20 : 9, i % 2 ? th.glow : th.glow2, on);
    });
    tb.lanes.forEach((l, i) => {
      const lit = game.lanes[i];
      const skill = game.skillT > 0 && game.skillOpen && i === game.skillLane;
      const blink = skill ? (Math.sin(tsec * 12) > 0 ? 1 : 0.15) : 0;
      const a = lit ? 1 : blink;
      if (a > 0) glow(ctx, l.x, l.y, 22, skill && !lit ? '#ffffff' : th.glow2, a);
    });
    // kickback / save lights
    for (const ol of tb.outlanes) {
      if (ol.kickback && sim.kickArmed[ol.side] && sim.live) glow(ctx, ol.x, ol.y - 26, 14, '#7dffb0', 0.55 + 0.35 * Math.sin(tsec * 6));
    }
    if (game.saver > 0 && game.phase === 'play') glow(ctx, XC, 758, 26, '#ffb340', Math.sin(tsec * (game.saver < 3 ? 14 : 5)) > -0.2 ? 0.9 : 0.1);
    if (game.mbLit) glow(ctx, tb.ramps[0].entry.x, tb.ramps[0].entry.y, 26, '#ff4d6d', 0.6 + 0.4 * Math.sin(tsec * 9));
    ctx.globalCompositeOperation = 'source-over';
    // lane letters
    ctx.font = '900 13px "Nunito", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    tb.lanes.forEach((l, i) => {
      ctx.fillStyle = game.lanes[i] ? '#10131a' : rgba(th.rail, 0.8);
      ctx.fillText(l.ch, l.x, l.y + 0.5);
    });

    // ----- standup targets
    tb.standups.forEach((s, i) => {
      const p = sim.pulse.standups[i];
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l = Math.hypot(dx, dy);
      const nx = -dy / l, ny = dx / l;
      const sgn = s.x1 < XC ? 1 : -1;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(s.x1 + 1.5, s.y1 + 2);
      ctx.lineTo(s.x2 + 1.5, s.y2 + 2);
      ctx.stroke();
      ctx.strokeStyle = p > 0 ? '#ffffff' : '#ff7a3d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x1 - 1 * nx * sgn, s.y1 - 1 * ny * sgn);
      ctx.lineTo(s.x2 - 1 * nx * sgn, s.y2 - 1 * ny * sgn);
      ctx.stroke();
      ctx.restore();
    });
    // ----- drop targets
    tb.drops.forEach((d, i) => {
      const st = sim.drops[i];
      const face = d.face === 'L' ? -1 : 1;
      ctx.save();
      ctx.translate(d.x, d.y);
      if (st.down) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-2, -8, 4, 16);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(-4 + 2, -8.5 + 2.5, 8, 17);
        const gr = ctx.createLinearGradient(-5 * face, 0, 5 * face, 0);
        gr.addColorStop(0, '#ffe38a');
        gr.addColorStop(1, '#d1771f');
        ctx.fillStyle = gr;
        ctx.fillRect(-4 + (face < 0 ? -3 : 0), -8.5, 7, 17);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-4 + (face < 0 ? -3 : 0), -8.5, 7, 17);
      }
      ctx.restore();
    });
    // ----- spinner
    if (tb.spinner && sim.spinner) {
      const sp = tb.spinner;
      const c = Math.abs(Math.cos(sim.spinner.ang));
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(sp.x - sp.w / 2 + 2, sp.y - 1 + 3, sp.w, 3);
      ctx.fillStyle = th.rail;
      ctx.fillRect(sp.x - sp.w / 2, sp.y - 1 - c * 5, sp.w, 2 + c * 5);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(sp.x - sp.w / 2, sp.y - 1 - c * 5, sp.w, 1);
      ctx.fillStyle = '#222';
      ctx.fillRect(sp.x - sp.w / 2 - 3, sp.y - 3, 3, 6);
      ctx.fillRect(sp.x + sp.w / 2, sp.y - 3, 3, 6);
    }
    // ----- posts
    for (const p of tb.posts) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(p.x + 1.5, p.y + 2.5, p.r + 1, 0, TAU);
      ctx.fill();
      const gr = ctx.createRadialGradient(p.x - 1.5, p.y - 1.5, 0.5, p.x, p.y, p.r + 1);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, '#8b95a8');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    // ----- slingshot pulse
    for (const s of tb.slings) {
      const p = sim.pulse.slings[s.side === 'L' ? 0 : 1];
      if (p > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba('#ffffff', p);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.pts[0][0], s.pts[0][1]);
        ctx.lineTo(s.pts[2][0], s.pts[2][1]);
        ctx.stroke();
        glow(ctx, (s.pts[0][0] + s.pts[2][0]) / 2, (s.pts[0][1] + s.pts[2][1]) / 2, 34, th.glow, p * 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // ----- pop bumpers
    tb.bumpers.forEach((b, i) => {
      const p = sim.pulse.bumpers[i];
      const rr = b.r;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(b.x + 2.5, b.y + 4, rr + 1, 0, TAU);
      ctx.fill();
      // skirt
      const sg = ctx.createRadialGradient(b.x, b.y, rr * 0.5, b.x, b.y, rr);
      sg.addColorStop(0, '#1b1b26');
      sg.addColorStop(1, '#3b3b4d');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = th.rail;
      ctx.lineWidth = 2;
      ctx.stroke();
      const capR = (rr - 5) * (1 + p * 0.1);
      const cg = ctx.createRadialGradient(b.x - capR * 0.35, b.y - capR * 0.4, 1, b.x, b.y, capR);
      const c0 = i % 2 ? th.glow2 : th.glow;
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(0.35, c0);
      cg.addColorStop(1, rgba(c0, 0.45));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, capR, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, capR * 0.6, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, b.x, b.y, rr * (1.6 + p), c0, 0.25 + p * 0.65);
      ctx.globalCompositeOperation = 'source-over';
    });
    // ----- plunger
    const pull = game.phase === 'ready' ? game.charge : 0;
    const py = 777 + pull * 20;
    ctx.strokeStyle = '#9aa2b4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(369, py + 3);
    for (let i = 0; i < 6; i++) ctx.lineTo(369 + (i % 2 ? 7 : -7), py + 3 + ((H - py) * (i + 1)) / 6);
    ctx.stroke();
    const plg = ctx.createLinearGradient(357, 0, 381, 0);
    plg.addColorStop(0, '#6a7285');
    plg.addColorStop(0.5, '#f0f3fa');
    plg.addColorStop(1, '#6a7285');
    ctx.fillStyle = plg;
    ctx.fillRect(357, py, 24, 6);
    // ----- flippers
    for (const f of sim.flippers) {
      if (f.tx === undefined) {
        f.tx = f.px + (f.side === 'L' ? 1 : -1) * f.len * Math.cos(f.ang);
        f.ty = f.py + f.len * Math.sin(f.ang);
      }
      const act = f.on && sim.flippersOn && sim.live;
      ctx.save();
      ctx.translate(2, 3.5);
      hull(ctx, f.px, f.py, f.r0, f.tx, f.ty, f.r1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.restore();
      hull(ctx, f.px, f.py, f.r0, f.tx, f.ty, f.r1);
      const gr = ctx.createLinearGradient(f.px, f.py - f.r0, f.px, f.py + f.r0 + 6);
      gr.addColorStop(0, act ? '#ffffff' : '#fff6da');
      gr.addColorStop(0.5, act ? '#ffd24a' : '#f0be3a');
      gr.addColorStop(1, '#a8741a');
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,20,0,0.65)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // rubber stripe
      ctx.strokeStyle = 'rgba(30,18,4,0.55)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.px + (f.tx - f.px) * 0.18, f.py + (f.ty - f.py) * 0.18);
      ctx.lineTo(f.px + (f.tx - f.px) * 0.82, f.py + (f.ty - f.py) * 0.82);
      ctx.stroke();
      ctx.fillStyle = '#2a2a33';
      ctx.beginPath();
      ctx.arc(f.px, f.py, 3, 0, TAU);
      ctx.fill();
      if (act) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, (f.px + f.tx) / 2, (f.py + f.ty) / 2, 36, '#ffd24a', 0.3);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // ----- balls
    for (const b of sim.balls) {
      let tr = trails.get(b.id);
      if (!tr) trails.set(b.id, (tr = []));
      tr.push(b.x, b.y);
      if (tr.length > 22) tr.splice(0, 2);
      if (b.ramp) continue;
      // trail
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 260 && !reduced) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < tr.length - 2; i += 2) {
          const a = (i / tr.length) * Math.min(1, (sp - 200) / 900) * 0.4;
          ctx.fillStyle = rgba(th.glow2, a);
          ctx.beginPath();
          ctx.arc(tr[i], tr[i + 1], R * (0.35 + 0.6 * (i / tr.length)), 0, TAU);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      let by = b.y;
      if (game.phase === 'ready' && sim.inLane(b)) by += game.charge * 20;
      drawBall(b.x, by, 1, 0);
    }
    for (const id of [...trails.keys()]) if (!sim.balls.some((b) => b.id === id)) trails.delete(id);

    // ----- ramp (raised guide) + ball riding it
    for (let ri = 0; ri < tb.ramps.length; ri++) {
      const r = tb.ramps[ri];
      const pts = r.path;
      const off = (d) => {
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          let dx = b[0] - a[0], dy = b[1] - a[1];
          const l = Math.hypot(dx, dy) || 1;
          dx /= l;
          dy /= l;
          out.push([pts[i][0] - dy * d, pts[i][1] + dx * d]);
        }
        return out;
      };
      const line = (arr) => {
        ctx.beginPath();
        arr.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      };
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.save();
      ctx.translate(4, 7);
      line(pts);
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = 27;
      ctx.stroke();
      ctx.restore();
      line(pts);
      ctx.strokeStyle = rgba(th.glow2, 0.2);
      ctx.lineWidth = 25;
      ctx.stroke();
      line(pts);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 17;
      ctx.stroke();
      for (const d of [-12.5, 12.5]) {
        line(off(d));
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 4.5;
        ctx.save();
        ctx.translate(1.5, 2.5);
        ctx.stroke();
        ctx.restore();
        line(off(d));
        ctx.strokeStyle = th.rail;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // flow arrows (animated)
      ctx.fillStyle = rgba(th.rail, 0.5);
      let acc = (tsec * 80) % 60;
      for (let s = acc; s < r.len; s += 60) {
        let q = 1;
        while (q < r.cum.length - 1 && r.cum[q] < s) q++;
        const f = (s - r.cum[q - 1]) / (r.cum[q] - r.cum[q - 1]);
        const x = pts[q - 1][0] + (pts[q][0] - pts[q - 1][0]) * f, y = pts[q - 1][1] + (pts[q][1] - pts[q - 1][1]) * f;
        const a = Math.atan2(pts[q][1] - pts[q - 1][1], pts[q][0] - pts[q - 1][0]);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    for (const b of sim.balls) {
      if (!b.ramp) continue;
      // shadow on the playfield, ball raised
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(b.x + 4, b.y + 9, R * 0.95, R * 0.7, 0, 0, TAU);
      ctx.fill();
      drawBall(b.x - 1, b.y - 5, 1.18, 1);
    }

    drawFx(game, dt, tsec);
    ctx.restore();
  }

  // ------------------------------------------------------------------ live layer over the pre-rendered art
  const SPR = { flip: [0, 0, 224, 160, -32, -40, 112, 80], drop: [248, 40, 64, 80, -16, -20, 32, 40], ball: [356, 56, 48, 48, -12, -12, 24, 24] };
  function sprite(key, x, y, rot = 0, mirror = false, scale = 1) {
    const q = SPR[key];
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (mirror) ctx.scale(-1, 1);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(art.spr, q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7]);
    ctx.restore();
  }
  function insertLevel(n, game, tsec) {
    const step = Math.floor(tsec * 7);
    switch (n.group) {
      case 'mult':
        return n.idx < game.mult ? 0.95 : 0.04;
      case 'ring':
        return game.mbLit || game.multiball ? (((n.idx - step) % 12) + 12) % 12 < 3 ? 1 : 0.15 : 0.3 + 0.2 * Math.sin(tsec * 2 + n.idx * 0.5);
      case 'arrow':
        return game.mbLit || game.multiball ? (((n.idx - step) % 6) + 6) % 6 === 0 ? 1 : 0.2 : 0.22 + 0.12 * Math.sin(tsec * 3 - n.idx);
      case 'mission':
        if (game.allClear || n.idx < game.mi) return 1;
        if (n.idx === game.mi) return Math.sin(tsec * 6) > -0.1 ? 1 : 0.2;
        return 0.08;
      default:
        return 0.2 + 0.2 * Math.sin(tsec * 2 + n.idx * 1.7);
    }
  }
  function drawArt(game, now) {
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    const sim = game.sim;
    const tsec = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    let sx = 0, sy = 0;
    if (game.shake > 0 && !reduced) {
      sx = (Math.random() - 0.5) * 7 * game.shake;
      sy = (Math.random() - 0.5) * 7 * game.shake;
    }
    ctx.translate(ox + sx, oy + sy);
    ctx.scale(k, k);
    ctx.drawImage(base, 0, 0, W, H);
    // dark surround outside the table outline (hides the render's glossy veil there)
    ctx.fillStyle = '#05050a';
    ctx.beginPath();
    ctx.rect(-10, -10, W + 20, H + 20);
    ctx.moveTo(14, 200);
    ctx.arc(200, 200, 186, Math.PI, TAU);
    ctx.lineTo(386, H + 10);
    ctx.lineTo(14, H + 10);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.save();
    outline(ctx);
    ctx.clip();
    // ----- lights (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (const n of art.inserts) {
      const a = insertLevel(n, game, tsec);
      if (a < 0.05) continue;
      glow(ctx, n.x, n.y, n.r * 3.4, n.color, Math.min(1, a) * 0.75);
      if (a > 0.5) glow(ctx, n.x, n.y, n.r * 1.5, '#ffffff', a * 0.55);
    }
    tb.lanes.forEach((l, i) => {
      const lit = game.lanes[i];
      const skill = game.skillT > 0 && game.skillOpen && i === game.skillLane;
      const a = lit ? 1 : skill ? (Math.sin(tsec * 12) > 0 ? 1 : 0.1) : 0.12;
      glow(ctx, l.x, l.y, 24, skill && !lit ? '#ffffff' : l.color, a * 0.85);
      if (a > 0.5) glow(ctx, l.x, l.y, 10, '#ffffff', 0.6);
    });
    for (const ol of tb.outlanes) {
      if (ol.kickback && sim.kickArmed[ol.side] && sim.live) glow(ctx, ol.x, ol.y - 26, 15, '#7dffb0', 0.55 + 0.35 * Math.sin(tsec * 6));
    }
    if (game.saver > 0 && game.phase === 'play') glow(ctx, XC, 742, 14, '#ffb340', Math.sin(tsec * (game.saver < 3 ? 14 : 5)) > -0.2 ? 0.95 : 0.1);
    if (game.mbLit) glow(ctx, tb.ramps[0].entry.x, tb.ramps[0].entry.y, 28, '#ff4d6d', 0.6 + 0.4 * Math.sin(tsec * 9));
    tb.standups.forEach((s, i) => {
      const p = sim.pulse.standups[i];
      if (p > 0) {
        ctx.strokeStyle = rgba('#ffffff', p);
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        glow(ctx, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, 22, '#ffb36b', p * 0.8);
      }
    });
    for (const s of tb.slings) {
      const p = sim.pulse.slings[s.side === 'L' ? 0 : 1];
      if (p > 0) {
        ctx.strokeStyle = rgba('#ffffff', p);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.pts[0][0], s.pts[0][1]);
        ctx.lineTo(s.pts[2][0], s.pts[2][1]);
        ctx.stroke();
        glow(ctx, (s.pts[0][0] + s.pts[2][0]) / 2, (s.pts[0][1] + s.pts[2][1]) / 2, 36, '#ffd0a0', p * 0.8);
      }
    }
    tb.bumpers.forEach((b, i) => {
      const p = sim.pulse.bumpers[i];
      glow(ctx, b.x, b.y, b.r * 1.5, '#ffffff', 0.08 + p * 0.5);
      if (p > 0) {
        ctx.strokeStyle = rgba('#ffffff', p * 0.9);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 2 + (1 - p) * 8, 0, TAU);
        ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    // ----- drop targets that are up
    tb.drops.forEach((d, i) => {
      if (!sim.drops[i].down) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(d.x - 2 + 2, d.y - 8.5 + 3, 6, 17);
        sprite('drop', d.x, d.y);
      }
    });
    // ----- spinner
    if (tb.spinner && sim.spinner) {
      const sp = tb.spinner;
      const c = Math.abs(Math.cos(sim.spinner.ang));
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(sp.x - sp.w / 2 + 2, sp.y - 1 + 3, sp.w, 3);
      const gr = ctx.createLinearGradient(0, sp.y - 6, 0, sp.y + 2);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, '#a9b3c6');
      ctx.fillStyle = gr;
      ctx.fillRect(sp.x - sp.w / 2, sp.y - 1 - c * 5, sp.w, 2 + c * 5);
      ctx.fillStyle = '#2a2a33';
      ctx.fillRect(sp.x - sp.w / 2 - 3, sp.y - 3, 3, 6);
      ctx.fillRect(sp.x + sp.w / 2, sp.y - 3, 3, 6);
    }
    // ----- plunger
    const pull = game.phase === 'ready' ? game.charge : 0;
    const py = 777 + pull * 20;
    ctx.strokeStyle = '#9aa2b4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(369, py + 3);
    for (let i = 0; i < 6; i++) ctx.lineTo(369 + (i % 2 ? 7 : -7), py + 3 + ((H - py) * (i + 1)) / 6);
    ctx.stroke();
    const plg = ctx.createLinearGradient(357, 0, 381, 0);
    plg.addColorStop(0, '#6a7285');
    plg.addColorStop(0.5, '#f0f3fa');
    plg.addColorStop(1, '#6a7285');
    ctx.fillStyle = plg;
    ctx.fillRect(357, py, 24, 6);
    // ----- flippers
    for (const f of sim.flippers) {
      if (f.tx === undefined) {
        f.tx = f.px + (f.side === 'L' ? 1 : -1) * f.len * Math.cos(f.ang);
        f.ty = f.py + f.len * Math.sin(f.ang);
      }
      ctx.save();
      ctx.translate(3, 5);
      hull(ctx, f.px, f.py, f.r0 + 1, f.tx, f.ty, f.r1 + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.restore();
      const sc = f.len / 60;
      const pose = flipperSpritePose(f);
      sprite('flip', f.px, f.py, pose.rot, pose.mirror, 1);
      void sc;
      if (f.on && sim.flippersOn && sim.live) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, (f.px + f.tx) / 2, (f.py + f.ty) / 2, 34, '#ffe08a', 0.28);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // ----- balls
    for (const b of sim.balls) {
      let tr = trails.get(b.id);
      if (!tr) trails.set(b.id, (tr = []));
      tr.push(b.x, b.y);
      if (tr.length > 22) tr.splice(0, 2);
      if (b.ramp) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 260 && !reduced) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < tr.length - 2; i += 2) {
          const a = (i / tr.length) * Math.min(1, (sp - 200) / 900) * 0.35;
          ctx.fillStyle = rgba('#bfe6ff', a);
          ctx.beginPath();
          ctx.arc(tr[i], tr[i + 1], R * (0.35 + 0.6 * (i / tr.length)), 0, TAU);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      let by = b.y;
      if (game.phase === 'ready' && sim.inLane(b)) by += game.charge * 20;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(b.x + 2.8, by + 4, R * 0.95, R * 0.8, 0, 0, TAU);
      ctx.fill();
      sprite('ball', b.x, by);
    }
    for (const id of [...trails.keys()]) if (!sim.balls.some((b) => b.id === id)) trails.delete(id);
    // ----- ramp layer + the ball riding it
    ctx.drawImage(rampLayer, 0, 0, W, H);
    for (const b of sim.balls) {
      if (!b.ramp) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(b.x + 4, b.y + 9, R * 0.95, R * 0.7, 0, 0, TAU);
      ctx.fill();
      sprite('ball', b.x - 1, b.y - 6, 0, false, 1.2);
    }
    // glass glare
    ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createLinearGradient(0, 0, W, H * 0.6);
    gg.addColorStop(0, 'rgba(255,255,255,0.0)');
    gg.addColorStop(0.35, 'rgba(255,255,255,0.07)');
    gg.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    gg.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    drawFx(game, dt, tsec);
    if (globalThis.__pinballDebug) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#00ff66';
      ctx.beginPath();
      for (const s of sim.segs) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();
      ctx.strokeStyle = '#00e5ff';
      for (const f of sim.flippers) {
        hull(ctx, f.px, f.py, f.r0, f.tx, f.ty, f.r1);
        ctx.stroke();
      }
      for (const b of tb.bumpers) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFx(game, dt, tsec) {
    // ----- sparks, popups
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      const a = p.life / p.max;
      ctx.strokeStyle = rgba(p.c, a);
      ctx.lineWidth = p.s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '900 14px "Nunito", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt;
      if (p.t > 1) {
        pops.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - p.t * p.t;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(p.text, p.x, p.y - p.t * 30);
      ctx.fillStyle = p.c;
      ctx.fillText(p.text, p.x, p.y - p.t * 30);
      ctx.globalAlpha = 1;
    }
    // tilt overlay
    if (game.tilted) {
      ctx.fillStyle = `rgba(255,40,40,${0.12 + 0.08 * Math.sin(tsec * 10)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBall(x, y, s, raised) {
    const r = R * s;
    if (!raised) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(x + 2.6, y + 3.6, r * 0.95, r * 0.8, 0, 0, TAU);
      ctx.fill();
    }
    const gr = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.35, '#d7dde8');
    gr.addColorStop(0.8, '#6d7686');
    gr.addColorStop(1, '#2e3440');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x - r * 0.4, y - r * 0.42, r * 0.2, 0, TAU);
    ctx.fill();
  }

  return { resize, draw, spark, popup, toTable, get k() { return k; }, get ox() { return ox; }, get oy() { return oy; } };
}

// Flipper sprite pose. The sprite points along +x from its pivot. ctx applies rotate() and then scale(-1,1)
// to the sprite's local points, so a mirrored (right) flipper must be rotated by -ang to end at the collider tip
// (px - len*cos(ang), py + len*sin(ang)).
export function flipperSpritePose(f) {
  return f.side === 'L' ? { rot: f.ang, mirror: false } : { rot: -f.ang, mirror: true };
}
// where the sprite's local point (u, v) lands on the table for a pose (same order as the canvas transform)
export function spritePoint(f, pose, u, v) {
  const x = pose.mirror ? -u : u;
  const c = Math.cos(pose.rot), s = Math.sin(pose.rot);
  return { x: f.px + x * c - v * s, y: f.py + x * s + v * c };
}

// ---------------------------------------------------------------------- dot matrix display
export function createDMD(canvas) {
  const ctx = canvas.getContext('2d');
  const COLS = 112, ROWS = 24;
  const buf = document.createElement('canvas');
  buf.width = COLS;
  buf.height = ROWS;
  const bx = buf.getContext('2d', { willReadFrequently: true });
  let key = '';
  let dpr = 1, w = 0, h = 0;
  let grid = null;
  function resize(ww, hh, ratio) {
    dpr = ratio;
    w = ww;
    h = hh;
    canvas.width = Math.round(ww * ratio);
    canvas.height = Math.round(hh * ratio);
    canvas.style.width = ww + 'px';
    canvas.style.height = hh + 'px';
    key = '';
  }
  function raster(main, sub) {
    bx.clearRect(0, 0, COLS, ROWS);
    bx.fillStyle = '#fff';
    bx.textAlign = 'center';
    bx.textBaseline = 'middle';
    const two = !!sub;
    let size = two ? 13 : 19;
    const f = (s, wt) => `${wt} ${s}px "Courier New", ui-monospace, monospace`;
    bx.font = f(size, 'bold');
    while (bx.measureText(main).width > COLS - 4 && size > 7) {
      size--;
      bx.font = f(size, 'bold');
    }
    bx.fillText(main, COLS / 2, two ? 7 : ROWS / 2 + 1);
    if (two) {
      let s2 = 10;
      bx.font = f(s2, 'bold');
      while (bx.measureText(sub).width > COLS - 4 && s2 > 6) {
        s2--;
        bx.font = f(s2, 'bold');
      }
      bx.fillText(sub, COLS / 2, 18);
    }
    const d = bx.getImageData(0, 0, COLS, ROWS).data;
    grid = new Uint8Array(COLS * ROWS);
    for (let i = 0; i < COLS * ROWS; i++) grid[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  }
  function show(main, sub, color = '#ffb347') {
    const kk = main + '|' + (sub || '') + '|' + color;
    if (kk === key) return;
    key = kk;
    raster(main, sub);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(0, 0, w, h);
    const cx = w / COLS, cy = h / ROWS;
    const rr = Math.min(cx, cy) * 0.42;
    ctx.fillStyle = 'rgba(255,150,40,0.07)';
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (grid[y * COLS + x]) continue;
      ctx.beginPath();
      ctx.arc((x + 0.5) * cx, (y + 0.5) * cy, rr, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!grid[y * COLS + x]) continue;
      ctx.moveTo((x + 0.5) * cx + rr, (y + 0.5) * cy);
      ctx.arc((x + 0.5) * cx, (y + 0.5) * cy, rr, 0, TAU);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  return { resize, show };
}

// ---------------------------------------------------------------------- fireworks (screen space overlay)
export function createFireworks(canvas) {
  const ctx = canvas.getContext('2d');
  let parts = [];
  let w = 0, h = 0, dpr = 1, acc = 0, active = false;
  function resize(ww, hh, ratio) {
    w = ww;
    h = hh;
    dpr = ratio;
    canvas.width = Math.round(ww * ratio);
    canvas.height = Math.round(hh * ratio);
    canvas.style.width = ww + 'px';
    canvas.style.height = hh + 'px';
  }
  function burst() {
    const x = w * (0.15 + Math.random() * 0.7), y = h * (0.1 + Math.random() * 0.4);
    const hue = Math.floor(Math.random() * 360);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU, v = 90 + Math.random() * 120;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + Math.random() * 0.4, max: 1.5, hue });
    }
  }
  function start() {
    active = true;
    acc = 0;
  }
  function stop() {
    active = false;
    parts = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function tick(dt) {
    if (!active && !parts.length) return;
    acc -= dt;
    if (active && acc <= 0) {
      burst();
      acc = 0.55 + Math.random() * 0.5;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.1 * dt;
      p.vy = p.vy * (1 - 1.1 * dt) + 70 * dt;
      ctx.fillStyle = `hsla(${p.hue},95%,62%,${Math.max(0, p.life / p.max)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  return { resize, start, stop, tick };
}
