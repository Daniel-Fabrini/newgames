// Foosball — canvas renderer. The table (wood frame, felt, markings, nets, crest) is a pre-rendered 3D
// backdrop drawn once into an offscreen canvas; rods, men (3D sprites), ball, shadows and effects are
// composited live on top of it.
import { T, manX, footY, footActive, goalX0, goalX1 } from './physics.js';

export const VIEW = { mx: 13.5, my: 14 }; // margin (units) around the playfield (matches the backdrop render)
const TH_MIN = -1.0, TH_STEP = 2.1 / 15, NA = 16; // sprite angles
const CW = 108, CH = 264, SPR_W = 11.7, SPR_H = 28.6; // sprite cell (px) and its size in table units
const BALL_N = 12, BALL_PX = 120, BALL_U = 6;

let assetsP = null;
const loadImg = (name) => new Promise((res) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = new URL(`./assets/${name}`, import.meta.url).href;
});
export function loadAssets() {
  if (!assetsP) {
    assetsP = Promise.all(['backdrop.webp', 'rails.webp', 'men.webp', 'ball.webp', 'crest.webp'].map(loadImg)).then(([backdrop, rails, men, ball, crest]) => ({ backdrop, rails, men, ball, crest }));
  }
  return assetsP;
}
export const crestUrl = () => new URL('./assets/crest.webp', import.meta.url).href;

const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (hex, k) => { const [r, g, b] = hexRgb(hex); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };

export function createRenderer(canvas, { reduced = false } = {}) {
  const c = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const fg = document.createElement('canvas');
  const R = { sc: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
  const trail = [];
  const parts = [];
  let shake = 0;
  let goalFlash = { team: -1, t: 0 };
  let punch = 0;
  let A = null; // assets
  let menCan = null, menShadow = null, oppCan = null; // sprite atlases
  const kits = [{ main: '#e4372f' }, { main: '#2f7cff' }];
  let clock = 0;

  // ---------------------------------------------------------------- assets / sprites
  function setAssets(a) {
    A = a && a.backdrop && a.men && a.ball ? a : null;
    if (!A) return false;
    menCan = document.createElement('canvas');
    menCan.width = A.men.width; menCan.height = A.men.height;
    menCan.getContext('2d').drawImage(A.men, 0, 0);
    // soft silhouette used for the cast shadows (down-sampled black copy, up-scaled when drawn)
    menShadow = document.createElement('canvas');
    menShadow.width = Math.ceil(A.men.width / 3); menShadow.height = Math.ceil(A.men.height / 3);
    const g = menShadow.getContext('2d');
    g.drawImage(A.men, 0, 0, menShadow.width, menShadow.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#000';
    g.fillRect(0, 0, menShadow.width, menShadow.height);
    oppCan = null;
    return true;
  }

  /** Re-colour the blue opponent kit to another colour (tournament teams). */
  function setOpponentKit(hex) {
    kits[1].main = hex;
    if (!menCan) return;
    oppCan = null;
    if (hex.toLowerCase() === '#2f7cff' || hex.toLowerCase() === '#2f7be4') return;
    const w = menCan.width, h = CH;
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const g = o.getContext('2d');
    g.drawImage(menCan, 0, CH, w, h, 0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    const [tr, tg, tb] = hexRgb(hex);
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      // blue-dominant pixels belong to the kit (skin, hair, shoes and white parts are left alone)
      if (b > r * 1.35 && b > gg * 1.12 && b > 70) {
        const k = Math.min(1.5, (0.299 * r + 0.587 * gg + 0.114 * b) / 120);
        const hi = Math.max(0, k - 1);
        d[i] = Math.min(255, tr * Math.min(1, k) + 255 * hi);
        d[i + 1] = Math.min(255, tg * Math.min(1, k) + 255 * hi);
        d[i + 2] = Math.min(255, tb * Math.min(1, k) + 255 * hi);
      }
    }
    g.putImageData(id, 0, 0);
    oppCan = o;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    paintLayers();
    return true;
  }
  const tf = (g) => g.setTransform(R.dpr * R.sc, 0, 0, R.dpr * R.sc, R.dpr * R.ox, R.dpr * R.oy);

  // dark stadium hall: floodlight cones, blurred crowd bokeh, floor glow
  function ambience(g, w, h) {
    const bgG = g.createRadialGradient(w / 2, h * 0.45, h * 0.05, w / 2, h * 0.5, h * 0.75);
    bgG.addColorStop(0, '#1d2230'); bgG.addColorStop(0.55, '#0c0e15'); bgG.addColorStop(1, '#040507');
    g.fillStyle = bgG; g.fillRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.globalCompositeOperation = 'lighter';
    for (const fx of [0.12, 0.88]) {
      const cone = g.createLinearGradient(w * fx, 0, w * (fx < 0.5 ? 0.55 : 0.45), h * 0.8);
      cone.addColorStop(0, 'rgba(255,244,210,.22)'); cone.addColorStop(1, 'rgba(255,244,210,0)');
      g.fillStyle = cone;
      g.beginPath(); g.moveTo(w * fx - w * 0.04, 0); g.lineTo(w * fx + w * 0.04, 0); g.lineTo(w * (fx < 0.5 ? 0.95 : 0.05), h * 0.8); g.lineTo(w * (fx < 0.5 ? 0.2 : 0.8), h * 0.8); g.closePath(); g.fill();
    }
    const cols = ['255,214,102', '228,55,47', '255,255,255', '90,140,255'];
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = h * (0.02 + rnd() * 0.16 + (i % 2) * 0.8), r = (3 + rnd() * 9) * R.dpr;
      const gg = g.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(${cols[i % 4]},${0.12 + rnd() * 0.18})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
  }

  function paintLayers() {
    const g = bg.getContext('2d'), f = fg.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); f.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, bg.width, bg.height); f.clearRect(0, 0, fg.width, fg.height);
    tf(g); tf(f);
    g.imageSmoothingQuality = 'high'; f.imageSmoothingQuality = 'high';
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    ambience(g, bg.width, bg.height);
    g.restore();
    if (A) {
      g.drawImage(A.backdrop, -VIEW.mx, -VIEW.my, T.W + VIEW.mx * 2, T.H + VIEW.my * 2);
      if (A.rails) f.drawImage(A.rails, -VIEW.mx, -VIEW.my, T.W + VIEW.mx * 2, T.H + VIEW.my * 2);
    } else {
      g.fillStyle = '#2a8c47';
      g.fillRect(0, 0, T.W, T.H);
    }
  }

  // ---------------------------------------------------------------- rods and men
  function chrome(g, x0, x1, y, th, hi, charge, spec = 0) {
    if (hi || charge > 0) {
      g.save();
      g.shadowColor = charge > 0 ? `rgba(255,${160 - 60 * charge | 0},40,1)` : '#ffd45a';
      g.shadowBlur = (hi ? 9 : 4) * R.sc * (1 + charge * 1.3);
      g.fillStyle = charge > 0 ? '#ffb347' : '#ffd45a';
      g.globalAlpha = 0.55 + 0.35 * Math.sin(clock * 6) * 0.5 + charge * 0.3;
      g.fillRect(x0, y - th * 0.8, x1 - x0, th * 1.6);
      g.restore();
    }
    const gr = g.createLinearGradient(0, y - th, 0, y + th);
    gr.addColorStop(0, '#f8fbff'); gr.addColorStop(0.18, '#aeb8c6'); gr.addColorStop(0.42, '#fdfdff');
    gr.addColorStop(0.62, '#6b7686'); gr.addColorStop(0.85, '#c8d0dc'); gr.addColorStop(1, '#4a5361');
    g.fillStyle = gr;
    g.fillRect(x0, y - th, x1 - x0, th * 2);
    if (x1 - x0 > 30) {
      const px = x0 + (((spec * 17 + clock * 6) % (x1 - x0 + 24)) - 12);
      const sg = g.createLinearGradient(px - 7, 0, px + 7, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg; g.fillRect(px - 7, y - th * 0.7, 14, th * 0.55);
    }
  }

  function drawRodBar(g, r, hi, charge) {
    // soft shadow of the bar on the felt
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(0, r.y + 0.9, T.W, 1.5);
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.fillRect(0, r.y + 1.6, T.W, 1.4);
    chrome(g, 0, T.W, r.y, 0.78, hi, charge, r.x);
  }

  function drawOutside(g, r, hi, charge) {
    const right = r.team === 0;
    const k = r.slide ? r.x / r.slide : 0;
    const W = T.W;
    const edge = right ? W + 6.5 : -6.5;
    const gx = right ? W + 7.2 + k * 1.2 : -7.2 + k * 1.2 - 6.6;
    // bar from the frame edge to the grip, and the short free end on the other side
    chrome(g, right ? edge - 0.2 : gx + 6.0, right ? gx + 1 : edge + 0.2, r.y, 0.78, hi, charge);
    const ext = 2.2 + (right ? -k : k) * 1.2;
    const far = right ? -6.5 : W + 6.5;
    chrome(g, right ? far - ext : far - 0.2, right ? far + 0.2 : far + ext, r.y, 0.78, false, 0);
    chrome(g, right ? far - ext - 0.5 : far + ext - 0.1, right ? far - ext + 0.1 : far + ext + 0.5, r.y, 1.05, false, 0);
    // rubber grip
    const hg = g.createLinearGradient(0, r.y - 2.3, 0, r.y + 2.3);
    hg.addColorStop(0, '#4b4b52'); hg.addColorStop(0.35, '#202024'); hg.addColorStop(0.7, '#0d0d10'); hg.addColorStop(1, '#2a2a30');
    g.save();
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 3 * R.sc; g.shadowOffsetY = 1.2 * R.sc;
    g.fillStyle = hg;
    g.beginPath(); g.roundRect ? g.roundRect(gx, r.y - 2.15, 6.6, 4.3, 1.9) : g.rect(gx, r.y - 2.15, 6.6, 4.3); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 0.2;
    for (let i = 1; i < 6; i++) { const x = gx + i * 1.0; g.beginPath(); g.moveTo(x, r.y - 1.9); g.lineTo(x, r.y + 1.9); g.stroke(); }
    // wooden knob at the end of the grip + chrome ferrule on the frame side
    const kx = right ? gx + 6.0 : gx;
    const wg = g.createLinearGradient(0, r.y - 2.15, 0, r.y + 2.15);
    wg.addColorStop(0, '#c98c4a'); wg.addColorStop(0.5, '#8a5222'); wg.addColorStop(1, '#4e2b10');
    g.fillStyle = wg;
    g.beginPath(); g.roundRect ? g.roundRect(kx, r.y - 2.15, 0.6, 4.3, 0.3) : g.rect(kx, r.y - 2.15, 0.6, 4.3); g.fill();
    g.fillStyle = kits[r.team].main;
    g.fillRect(right ? gx + 4.9 : gx + 1.1, r.y - 2.15, 0.6, 4.3);
    chrome(g, right ? gx - 0.5 : gx + 6.6, right ? gx : gx + 7.1, r.y, 1.35, false, 0);
  }

  function drawMen(g, s, r) {
    const idx = Math.max(0, Math.min(NA - 1, Math.round((r.th - TH_MIN) / TH_STEP)));
    const lift = 1 - Math.cos(r.th);
    const active = footActive(r);
    const src = r.team === 1 && oppCan ? oppCan : menCan;
    const sy = r.team === 1 && oppCan ? 0 : r.team * CH;
    const fy = footY(r);
    for (let k = 0; k < r.n; k++) {
      const mx = manX(r, k);
      // contact shadow under the foot + soft cast shadow of the whole figure
      g.save();
      g.globalAlpha = 0.5 - 0.25 * lift;
      const cg = g.createRadialGradient(mx + 0.4, fy + 0.5, 0.3, mx + 0.4, fy + 0.5, 3.6);
      cg.addColorStop(0, 'rgba(0,0,0,.7)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cg;
      g.fillRect(mx - 4, fy - 4, 8.4, 8.4);
      g.globalAlpha = 0.34;
      const ox = 1.0 + lift * 2.2, oy = 1.5 + lift * 2.6;
      g.drawImage(menShadow, (idx * CW) / 3, (r.team * CH) / 3, CW / 3, CH / 3, mx - SPR_W / 2 + ox - 0.4, r.y - SPR_H / 2 + oy - 0.4, SPR_W + 0.8, SPR_H + 0.8);
      g.restore();
    }
    for (let k = 0; k < r.n; k++) {
      const mx = manX(r, k);
      if (!active) g.globalAlpha = 0.9;
      g.drawImage(src, idx * CW, sy, CW, CH, mx - SPR_W / 2, r.y - SPR_H / 2, SPR_W, SPR_H);
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- ball
  function drawBall(g, s) {
    const b = s.ball;
    const sp = Math.hypot(b.vx, b.vy);
    if (!reduced) {
      trail.push({ x: b.x, y: b.y });
      if (trail.length > 14) trail.shift();
      if (sp > 45) {
        for (let i = 0; i < trail.length - 1; i++) {
          const f = i / trail.length;
          g.fillStyle = `rgba(255,255,255,${f * Math.min(0.32, sp / 450)})`;
          g.beginPath(); g.arc(trail[i].x, trail[i].y, T.R * (0.35 + 0.5 * f), 0, 7); g.fill();
        }
      }
    } else trail.length = 0;
    // shadow
    const sg = g.createRadialGradient(b.x + 0.5, b.y + 0.8, 0.2, b.x + 0.7, b.y + 1.0, T.R * 1.9);
    sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(0.55, 'rgba(0,0,0,.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg;
    g.fillRect(b.x - 5, b.y - 4, 10, 10);
    if (A) {
      const fr = Math.floor(((((b.rot / (Math.PI * 2)) % 1) + 1) % 1) * BALL_N) % BALL_N;
      const ang = sp > 1 ? Math.atan2(b.vy, b.vx) - Math.PI / 2 : 0;
      g.save();
      g.translate(b.x, b.y); g.rotate(ang);
      g.drawImage(A.ball, fr * BALL_PX, 0, BALL_PX, BALL_PX, -BALL_U / 2, -BALL_U / 2, BALL_U, BALL_U);
      g.restore();
    } else {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, T.R, 0, 7); g.fill();
    }
  }

  // ---------------------------------------------------------------- effects
  function drawParts(g, dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - (p.drag || 1.4) * dt; p.vy *= 1 - (p.drag || 1.4) * dt;
      p.rot += p.vr * dt;
      g.save();
      const a = Math.min(1, p.life / (p.fade || 0.6));
      g.globalAlpha = a * (p.alpha ?? 1);
      g.translate(p.x, p.y);
      if (p.dust) {
        const rr = p.s * (1 + (1 - p.life / p.max) * 2.2);
        const dg = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        dg.addColorStop(0, p.col); dg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = dg; g.fillRect(-rr, -rr, rr * 2, rr * 2);
      } else {
        g.rotate(p.rot);
        g.fillStyle = p.col;
        g.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s);
      }
      g.restore();
    }
  }

  function drawNet(g, dt) {
    if (goalFlash.t <= 0) return;
    goalFlash.t -= dt;
    const top = goalFlash.team === 0;
    const k = Math.max(0, goalFlash.t) / 1.3;
    const y0 = top ? -T.goalD : T.H;
    g.save();
    g.beginPath(); g.rect(goalX0, y0, T.goalW, T.goalD); g.clip();
    g.fillStyle = `rgba(255,236,160,${0.45 * k * k})`;
    g.fillRect(goalX0, y0, T.goalW, T.goalD);
    g.strokeStyle = `rgba(255,255,255,${0.85 * k})`;
    g.lineWidth = 0.22;
    const ph = (1 - k) * 14;
    for (let i = 0; i <= 15; i++) {
      const x = goalX0 + (i * T.goalW) / 15;
      g.beginPath();
      for (let j = 0; j <= 10; j++) {
        const y = y0 + (j * T.goalD) / 10;
        const w = Math.sin(ph - j * 0.9 - i * 0.35) * 0.9 * k;
        j ? g.lineTo(x + w, y) : g.moveTo(x + w, y);
      }
      g.stroke();
    }
    for (let j = 0; j <= 6; j++) {
      const y = y0 + (j * T.goalD) / 6;
      g.beginPath();
      for (let i = 0; i <= 15; i++) {
        const x = goalX0 + (i * T.goalW) / 15;
        const w = Math.sin(ph - j * 0.9 - i * 0.35) * 0.9 * k;
        i ? g.lineTo(x, y + w) : g.moveTo(x, y + w);
      }
      g.stroke();
    }
    g.restore();
  }

  function draw(s, view, dt) {
    if (!R.cw) return;
    clock += dt;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    let sx = 0, sy = 0;
    if (shake > 0 && !reduced) {
      shake = Math.max(0, shake - dt * 4.2);
      sx = (Math.random() - 0.5) * shake * 1.6; sy = (Math.random() - 0.5) * shake * 1.6;
    }
    const pk = punch > 0 && !reduced ? (punch = Math.max(0, punch - dt * 2.2), Math.sin(punch * Math.PI) * 0.035) : 0;
    c.save();
    if (pk) { c.translate(canvas.width / 2, canvas.height / 2); c.scale(1 + pk, 1 + pk); c.translate(-canvas.width / 2, -canvas.height / 2); }
    c.drawImage(bg, sx * R.sc * R.dpr, sy * R.sc * R.dpr);
    if (view.poss === 0 || view.poss === 1) {
      const col = view.poss === 0 ? '228,55,47' : kitRgb(1);
      const pg = c.createLinearGradient(0, view.poss === 0 ? canvas.height : 0, 0, view.poss === 0 ? canvas.height * 0.7 : canvas.height * 0.3);
      pg.addColorStop(0, `rgba(${col},${0.22 + 0.08 * Math.sin(clock * 4)})`); pg.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = pg; c.fillRect(0, 0, canvas.width, canvas.height);
    }
    tf(c);
    c.translate(sx, sy);
    drawBall(c, s);
    const hi = view.hi || [], ch = view.charge || {};
    for (const r of s.rods) drawRodBar(c, r, hi.includes(r.i), ch[r.i] || 0);
    if (A) for (const r of s.rods) drawMen(c, s, r);
    // rails cover the rods where they enter the frame
    c.save();
    c.setTransform(1, 0, 0, 1, sx * R.sc * R.dpr, sy * R.sc * R.dpr);
    c.drawImage(fg, 0, 0);
    c.restore();
    for (const r of s.rods) drawOutside(c, r, hi.includes(r.i), ch[r.i] || 0);
    drawNet(c, dt);
    drawParts(c, dt);
    c.restore();
    if (goalFlash.t > 0.9 && !reduced) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = `rgba(255,255,255,${(goalFlash.t - 0.9) * 1.6})`;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  const kitRgb = (i) => hexRgb(kits[i].main).join(',');

  // ---------------------------------------------------------------- fx api
  function burst(team, x, y) {
    if (reduced) return;
    const main = kits[team].main;
    const cols = team === 0 ? ['#d8202a', '#ffffff', '#111111', '#ff4a52', '#ffffff'] : [main, '#ffd45a', '#ffffff', shade(main, 1.3), '#111111'];
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 80;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, col: cols[i % cols.length], s: 0.5 + Math.random() * 0.8, life: 1.3 + Math.random() * 1.3, max: 2, fade: 0.7 });
    }
  }
  const sparks = (x, y, n = 6) => {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 14 + Math.random() * 40;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: 4, col: '#fff3b0', s: 0.3, life: 0.32, max: 0.32, fade: 0.2, drag: 5 });
    }
    parts.push({ x, y, vx: 0, vy: 0, rot: 0, vr: 0, col: 'rgba(255,255,255,.7)', s: 1.2, life: 0.28, max: 0.28, fade: 0.2, dust: true, drag: 1, alpha: 0.7 });
  };
  const dust = (x, y) => {
    if (reduced) return;
    parts.push({ x, y, vx: 0, vy: 0, rot: 0, vr: 0, col: 'rgba(230,240,225,.65)', s: 1.6, life: 0.5, max: 0.5, fade: 0.4, dust: true, drag: 1, alpha: 0.6 });
  };

  return {
    R, resize, draw, burst, sparks, dust, setAssets, setOpponentKit,
    get hasAssets() { return !!A; },
    setKits(a, b) { kits[0].main = a; kits[1].main = b; },
    shake(v = 1) { shake = Math.max(shake, v); },
    goal(team) { goalFlash = { team, t: 1.3 }; punch = 1; },
    clearFx() { parts.length = 0; trail.length = 0; },
    toTable(px, py) { return { x: (px - R.ox) / R.sc, y: (py - R.oy) / R.sc }; },
    toScreen(x, y) { return { x: R.ox + x * R.sc, y: R.oy + y * R.sc }; },
  };
}
