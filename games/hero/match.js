// Ball Hero — one playable match moment: canvas, camera, drawing input,
// slow motion, effects and sounds on top of the deterministic sim.

import * as S from './sim.js';
import * as R from './render.js';

const { GW, GH } = S;
const TAU = Math.PI * 2;

export function createMatch(host, cfg) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-hero-canvas';
  host.append(canvas);
  const g = canvas.getContext('2d');
  const view = new R.View();
  const assets = R.makeAssets(cfg.kits.home.shirt, cfg.kits.away.shirt, cfg.adText || ['DA GAMES']);
  const sfx = cfg.sfx;
  const t = cfg.t;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let level = cfg.level;
  let world = null;
  let fx = null;
  let stroke = null;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let dead = false;
  let resultSent = false;
  let doneAt = 0;
  let introT = 0;
  let clock = 0;
  let nextMurmur = 0;
  let hintPulse = 0;
  let paused = false;
  const cam = { tx: 0, ty: 20, dist: 50, th: 0.6, ready: false };
  const looks = { att: [], def: [] };

  // ------------------------------------------------------------------ setup
  function buildLooks() {
    const home = cfg.kits.home;
    const away = cfg.kits.away;
    const pool = [9, 7, 11, 8, 10, 5, 4, 6, 3, 2].filter((n) => n !== cfg.heroNum);
    const nums = world.att.map((a, i) => pool[i % pool.length]);
    looks.att = world.att.map((a, i) => {
      const base = a.hero ? cfg.heroLook : R.npcLook(i + 3 + (level.seed || 0));
      return {
        ...home,
        skin: base.skin,
        hair: base.hair,
        hairColor: base.hairColor,
        boots: a.hero ? cfg.heroLook.boots : '#15151a',
        num: a.hero ? cfg.heroNum : nums[i],
        front: false,
      };
    });
    looks.def = world.def.map((d, i) => {
      const base = R.npcLook(i + 40 + (level.seed || 0));
      const dummy = level.dummies;
      return dummy
        ? { shirt: '#ff8a1f', shirt2: '#1a1a1a', shorts: '#2a2a2a', socks: '#ff8a1f', boots: '#111', skin: '#d6d6dc', hair: 'bald', hairColor: '#ccc', front: true, pattern: 'band' }
        : { ...away, skin: base.skin, hair: base.hair, hairColor: base.hairColor, boots: '#111', front: true };
    });
    const gk = cfg.kits.gk;
    const base = R.npcLook(77 + (level.seed || 0));
    looks.gk = { shirt: gk.shirt, shirt2: gk.shirt2, shorts: gk.shorts, socks: gk.socks, boots: '#111', skin: base.skin, hair: base.hair, hairColor: base.hairColor, gloves: gk.gloves, front: true, pattern: 'plain' };
  }

  function reset(newLevel) {
    if (newLevel) level = newLevel;
    world = S.createWorld(level);
    fx = { t: 0, ripple: null, postShake: 0, crowdJump: 0, shake: 0, flash: 0, parts: [], confetti: [], trail: [], plan: null, planT: 0, banner: null, slow: 1, goalAt: 0 };
    stroke = null;
    acc = 0;
    resultSent = false;
    doneAt = 0;
    introT = 0;
    buildLooks();
    const d = desired(true);
    cam.tx = d.tx;
    cam.ty = d.ty + 14;
    cam.dist = d.dist * 1.45;
    cam.th = d.th;
    cam.ready = true;
    if (cfg.onState) cfg.onState('intro');
    sfx.play('whistle');
  }

  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    view.resize(W, H, dpr);
  }

  // ------------------------------------------------------------------ camera
  const PP = { x: 0, y: 0, d: 0, k: 0 };
  function fits(pts, m) {
    for (const p of pts) {
      if (!view.p(p.x, p.y, p.z, PP)) return false;
      if (PP.x < m.l || PP.x > W - m.r || PP.y < m.t || PP.y > H - m.b) return false;
    }
    return true;
  }
  function fit(pts, m, minD = 14, maxD = 130) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    let tx = (x0 + x1) / 2;
    let ty = (y0 + y1) / 2;
    let dist = 40;
    for (let it = 0; it < 4; it++) {
      let lo = minD;
      let hi = maxD;
      view.setCam(tx, ty, hi);
      if (fits(pts, m)) {
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          view.setCam(tx, ty, mid);
          if (fits(pts, m)) hi = mid;
          else lo = mid;
        }
      }
      dist = hi;
      view.setCam(tx, ty, dist);
      let bx0 = Infinity;
      let bx1 = -Infinity;
      let by0 = Infinity;
      let by1 = -Infinity;
      for (const p of pts) {
        if (!view.p(p.x, p.y, p.z, PP)) continue;
        bx0 = Math.min(bx0, PP.x);
        bx1 = Math.max(bx1, PP.x);
        by0 = Math.min(by0, PP.y);
        by1 = Math.max(by1, PP.y);
      }
      if (!view.p(tx, ty, 0, PP)) break;
      const k = PP.k;
      const spT = by0 - m.t;
      const spB = H - m.b - by1;
      const spL = bx0 - m.l;
      const spR = W - m.r - bx1;
      // keep the action low on screen; spare room goes to the stadium above
      ty += ((spT - spB) / 2 / (k * view.st)) * 0.85 - (Math.max(0, spB) * 0.5) / (k * view.st);
      tx += ((spL - spR) / 2 / k) * 0.85;
    }
    return { tx, ty, dist };
  }

  function desired(intro) {
    const w = world;
    const pts = [];
    const add = (x, y, z = 0) => pts.push({ x, y, z });
    add(-GW - 1.5, -1, GH + 1.2);
    add(GW + 1.5, -1, GH + 1.2);
    add(0, -2.4, 0);
    const b = w.ball;
    const m = { l: 14, r: 14, t: H * 0.15 + 8, b: H * 0.08 + 8 };
    if (intro || w.phase === 'aim' || w.phase === 'settle') {
      const A = w.att[w.carrier];
      add(A.x, A.y + 2.2);
      add(A.x - 1.2, A.y + 1);
      add(A.x + 1.2, A.y + 1);
      for (const a of w.att) {
        add(a.x, a.y + 1.4);
        add(a.x, a.y, 2.7);
        if (a.run) add(a.run.x, a.run.y);
      }
      for (const d of w.def) add(d.x, d.y, 2.7);
      if (level.type === 'corner') m.l = m.r = 6;
    } else if (w.phase === 'flight') {
      const F = w.flight;
      add(b.x, b.y + 2, 0);
      add(b.x, b.y, b.z + 1);
      if (F.type === 'shot') {
        m.t = H * 0.2;
      } else {
        const p2 = F.curve.p2;
        add(p2.x, p2.y + 2);
        add(p2.x, p2.y, 2.8);
      }
    } else {
      add(b.x, b.y + 2, 0);
      add(b.x, b.y, b.z + 0.5);
      if (w.result && w.result.goal) {
        const A = w.att[w.result.scorer];
        add(A.x, A.y + 2);
        add(A.x, A.y, 3);
        m.t = H * 0.22;
      }
    }
    // try a few camera pitches: steeper angles spread the action vertically,
    // flatter ones look more like TV; pick the best compromise
    let best = null;
    for (const th of [0.55, 0.65, 0.75, 0.85]) {
      view.setPitch(th);
      const r = fit(pts, m);
      r.th = th;
      view.setCam(r.tx, r.ty, r.dist);
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of pts) {
        if (!view.p(p.x, p.y, p.z, PP)) continue;
        y0 = Math.min(y0, PP.y);
        y1 = Math.max(y1, PP.y);
      }
      const fill = (y1 - y0) / (H - m.t - m.b);
      r.score = r.dist * (1 + 0.3 * (th - 0.55)) * (1 + 0.6 * Math.max(0, 0.85 - fill));
      if (!best || r.score < best.score) best = r;
    }
    view.setPitch(cam.th);
    return best;
  }

  function updateCamera(dt) {
    if (stroke) return; // keep the frame still while drawing
    const d = desired(false);
    const shot = world.flight && world.flight.type === 'shot';
    const rate = world.phase === 'aim' ? 3.2 : shot ? 4.5 : 2.6;
    const a = 1 - Math.exp(-dt * (introT < 1.2 ? 1.8 : rate));
    cam.tx += (d.tx - cam.tx) * a;
    cam.ty += (d.ty - cam.ty) * a;
    cam.dist += (d.dist - cam.dist) * a;
    cam.th += (d.th - cam.th) * a;
  }

  function applyCamera() {
    view.setPitch(cam.th);
    let sx = 0;
    let sy = 0;
    if (fx.shake > 0) {
      sx = Math.sin(clock * 61) * fx.shake * 0.25;
      sy = Math.cos(clock * 47) * fx.shake * 0.25;
    }
    view.setCam(cam.tx + sx, cam.ty + sy, cam.dist);
  }

  // ------------------------------------------------------------------ input
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function screenOf(x, y, z = 0) {
    const o = { x: 0, y: 0, d: 0, k: 0 };
    return view.p(x, y, z, o) ? o : null;
  }
  function bodyOf(a) {
    return screenOf(a.x, a.y, 0.95 * R.FIG);
  }

  function onDown(e) {
    if (dead || paused || !world || world.result || introT < 0.55) return;
    const p = local(e);
    let mode = null;
    if (world.phase === 'aim') {
      const A = world.att[world.carrier];
      const bs = screenOf(world.ball.x, world.ball.y, 0.1);
      const as = bodyOf(A);
      const rad = Math.max(54, (as ? as.k : 10) * R.FIG * 1.15);
      const near = (s) => s && Math.hypot(s.x - p.x, s.y - p.y) < rad;
      if (near(bs) || near(as)) mode = 'aim';
      else {
        hintPulse = 1;
        if (cfg.onHint) cfg.onHint('startAtBall');
      }
    } else if (world.phase === 'flight' && S.firstTimeOpen(world)) {
      const F = world.flight;
      const ts = screenOf(F.curve.p2.x, F.curve.p2.y, 0.9 * R.FIG);
      const rad = Math.max(70, (ts ? ts.k : 10) * 2.4);
      if (ts && Math.hypot(ts.x - p.x, ts.y - p.y) < rad) mode = 'first';
    }
    if (!mode) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    stroke = { mode, id: e.pointerId, pts: [{ x: p.x, y: p.y, g: view.ground(p.x, p.y) }], len: 0, tick: 0 };
    if (cfg.onState) cfg.onState('drawing');
  }

  function onMove(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const p = local(e);
    const lp = stroke.pts[stroke.pts.length - 1];
    const d = Math.hypot(p.x - lp.x, p.y - lp.y);
    if (d < 4) return;
    stroke.len += d;
    if (stroke.pts.length < 400) stroke.pts.push({ x: p.x, y: p.y, g: view.ground(p.x, p.y) });
    stroke.tick += d;
    if (stroke.tick > 46) {
      stroke.tick = 0;
      sfx.tone({ freq: 900 + Math.min(900, stroke.len), dur: 0.025, type: 'sine', vol: 0.05 });
    }
  }

  function onUp(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const s = stroke;
    stroke = null;
    if (cfg.onState) cfg.onState('play');
    if (s.len < 26 || world.result) return;
    const plan = planFromStroke(s);
    if (!plan) {
      if (cfg.onHint) cfg.onHint(s.mode === 'first' ? 'firstNeedsGoal' : 'noTarget');
      return;
    }
    if (s.mode === 'first') {
      if (S.queueFirstTime(world, plan)) {
        fx.plan = previewOf(plan, { x: world.flight.curve.p2.x, y: world.flight.curve.p2.y, z: world.flight.z1 });
        fx.planT = 0;
        sfx.tone({ freq: 660, to: 990, dur: 0.12, type: 'triangle', vol: 0.18 });
      }
      return;
    }
    const F = S.launch(world, plan);
    if (F) {
      fx.plan = previewOf(plan, null, F);
      fx.planT = 0;
      hintPulse = 0;
    }
  }

  function planFromStroke(s) {
    const pts = s.pts;
    const end = pts[pts.length - 1];
    const w = world;
    const origin = s.mode === 'first' ? { x: w.flight.curve.p2.x, y: w.flight.curve.p2.y } : { x: w.ball.x, y: w.ball.y };
    const from = s.mode === 'first' ? w.flight.receiver : w.carrier;
    const gp = view.goalPlane(end.x, end.y);
    const gr = R.goalRect(view);
    const gh = gr ? gr.y1 - gr.y0 : 40;
    const inGoal = gr && end.x > gr.x0 - 30 && end.x < gr.x1 + 30 && end.y < gr.y1 + 16 && end.y > gr.y0 - gh * 1.3;
    const strictGoal = gr && end.x > gr.x0 && end.x < gr.x1 && end.y < gr.y1 + 4 && end.y > gr.y0 - 4;
    const ground = pts.map((p) => p.g).filter(Boolean);
    // teammate under the finger?
    let mate = -1;
    let md = Infinity;
    if (s.mode === 'aim' && !strictGoal) {
      for (const a of w.att) {
        if (a.i === from) continue;
        const bs = bodyOf(a);
        if (!bs) continue;
        const d = Math.hypot(bs.x - end.x, bs.y - end.y);
        const rad = Math.max(34, bs.k * R.FIG * 1.1);
        if (d < rad && d < md) {
          md = d;
          mate = a.i;
        }
        if (a.run) {
          const rs = screenOf(a.run.x, a.run.y, 0);
          if (rs) {
            const d2 = Math.hypot(rs.x - end.x, rs.y - end.y);
            if (d2 < Math.max(36, rs.k * 2.2) && d2 < md) {
              md = d2;
              mate = a.i + 1000;
            }
          }
        }
      }
    }
    if (mate >= 0) {
      const through = mate >= 1000;
      const idx = through ? mate - 1000 : mate;
      const A = w.att[idx];
      const tgt = through ? A.run : { x: A.x, y: A.y };
      let curl = S.fitCurl(origin, tgt, ground);
      curl = Math.abs(curl) < 0.03 ? 0 : S.clamp(curl, -0.3, 0.3);
      return { type: 'pass', to: idx, curl, through };
    }
    if (inGoal && gp) {
      let tx = gp.x;
      let tz = gp.z;
      // friendly: lines that end just outside the frame are pulled inside
      const ax = Math.abs(tx);
      if (ax > GW - 0.15 && ax <= GW + 0.3) tx = Math.sign(tx) * (GW - 0.17);
      if (tz > GH - 0.15 && tz <= GH + 0.25) tz = GH - 0.17;
      tz = Math.max(0.15, tz);
      const gpts = ground.filter((q) => q.y > 0.6);
      let curl = S.fitCurl(origin, { x: tx, y: 0 }, [...gpts, { x: tx, y: 0 }]);
      curl = Math.abs(curl) < 0.03 ? 0 : S.clamp(curl, -0.25, 0.25);
      return { type: 'shot', tx, tz, curl };
    }
    if (s.mode === 'first') return null;
    const gEnd = end.g;
    if (!gEnd) return null;
    let curl = S.fitCurl(origin, gEnd, ground);
    curl = Math.abs(curl) < 0.03 ? 0 : S.clamp(curl, -0.3, 0.3);
    return { type: 'space', x: gEnd.x, y: gEnd.y, curl };
  }

  // 3D points of the actual flight, for the trajectory preview
  function previewOf(plan, origin, F) {
    const f = F || null;
    let curve;
    let zf;
    if (f) {
      curve = f.curve;
      zf = (u) => S.flightZ(f, u);
    } else {
      // first-time shot: approximate
      const p2 = { x: plan.tx, y: 0 };
      curve = S.buildCurve(origin, p2, plan.curl || 0);
      zf = (u) => origin.z + (plan.tz - origin.z) * u;
    }
    const pts = [];
    const q = {};
    for (let i = 0; i <= 36; i++) {
      const u = i / 36;
      S.curvePoint(curve, S.curveT(curve, u * curve.len), q);
      pts.push({ x: q.x, y: q.y, z: zf(u) });
    }
    return { pts, shot: plan.type === 'shot', curl: Math.abs(plan.curl || 0) >= 0.07 };
  }

  // ------------------------------------------------------------------ events → sound / fx
  function crowd(kind) {
    if (kind === 'roar') {
      sfx.noise({ dur: 2.6, vol: 0.32, freq: 700, q: 0.35 });
      sfx.noise({ dur: 2.2, vol: 0.22, freq: 1500, q: 0.5, delay: 0.1 });
      sfx.noise({ dur: 1.8, vol: 0.18, freq: 380, q: 0.4, delay: 0.25 });
    } else if (kind === 'ooh') {
      sfx.noise({ dur: 1.1, vol: 0.16, freq: 520, q: 0.6 });
      sfx.tone({ freq: 210, to: 160, dur: 0.9, type: 'sine', vol: 0.05 });
    } else if (kind === 'groan') {
      sfx.noise({ dur: 1.3, vol: 0.13, freq: 330, q: 0.5 });
    } else if (kind === 'murmur') {
      sfx.noise({ dur: 1.6, vol: 0.025, freq: 460, q: 0.3 });
    }
  }

  function grass(x, y, n, col = '#7fd06b') {
    for (let i = 0; i < n; i++) {
      fx.parts.push({ x, y, z: 0.05, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 1.5 + Math.random() * 2.5, life: 0.5 + Math.random() * 0.3, col, s: 0.06 });
    }
  }

  function handleEvents() {
    const evs = world.events;
    if (!evs.length) return;
    world.events = [];
    for (const ev of evs) {
      if (ev.type === 'pass') {
        sfx.tone({ freq: 150, to: 70, dur: 0.1, type: 'sine', vol: ev.lofted ? 0.55 : 0.42 });
        sfx.noise({ dur: 0.04, vol: 0.18, freq: 2200 });
        if (ev.lofted) sfx.noise({ dur: 0.35, vol: 0.08, freq: 900, q: 0.5, delay: 0.05 });
        const A = world.att[ev.from];
        grass(A.x, A.y - 0.4, 6);
        if (cfg.onEvent) cfg.onEvent(ev);
      } else if (ev.type === 'shot') {
        sfx.play('kick');
        sfx.noise({ dur: 0.4, vol: 0.12, freq: 1300, q: 0.6, delay: 0.03 });
        if (ev.air) sfx.tone({ freq: 240, to: 120, dur: 0.12, type: 'triangle', vol: 0.35 });
        sfx.vibrate(18);
        crowd('ooh');
        const A = world.att[ev.from];
        grass(A.x, A.y - 0.4, 10);
        fx.trail = [];
        if (cfg.onEvent) cfg.onEvent(ev);
      } else if (ev.type === 'control') {
        sfx.tone({ freq: 300, to: 180, dur: 0.06, type: 'sine', vol: 0.25 });
      } else if (ev.type === 'intercept') {
        sfx.play('hit');
        sfx.tone({ freq: 120, to: 60, dur: 0.12, type: 'sine', vol: 0.5 });
        sfx.vibrate(30);
        crowd('groan');
        banner(ev.shot ? (ev.wall ? 'failWall' : 'failBlocked') : 'failIntercepted', 'bad');
      } else if (ev.type === 'save') {
        sfx.noise({ dur: 0.09, vol: 0.4, freq: 900, q: 1 });
        sfx.tone({ freq: 200, to: 90, dur: 0.12, type: 'sine', vol: 0.4 });
        sfx.vibrate(30);
        crowd('groan');
        banner(world.result && world.result.reason === 'claimed' ? 'failClaimed' : 'failSaved', 'bad');
      } else if (ev.type === 'goal') {
        sfx.play('goal');
        crowd('roar');
        sfx.vibrate([70, 50, 140]);
        fx.flash = 1;
        fx.shake = 1;
        fx.crowdJump = 1;
        fx.goalAt = clock;
        spawnConfetti();
        if (cfg.onEvent) cfg.onEvent(ev);
      } else if (ev.type === 'net') {
        fx.ripple = { x: ev.x, z: ev.z, t: 0 };
        sfx.noise({ dur: 0.35, vol: 0.28, freq: 2600, q: 0.7 });
      } else if (ev.type === 'post') {
        sfx.tone({ freq: 1180, to: 900, dur: 0.5, type: 'square', vol: 0.12 });
        sfx.tone({ freq: 2350, dur: 0.35, type: 'sine', vol: 0.12 });
        sfx.vibrate(50);
        fx.postShake = 1;
        fx.shake = 0.6;
        crowd('ooh');
        banner(world.result.reason === 'bar' ? 'failBar' : 'failPost', 'bad');
      } else if (ev.type === 'miss') {
        crowd('groan');
        banner(world.result.reason === 'over' ? 'failOver' : 'failWide', 'bad');
      } else if (ev.type === 'lost') {
        sfx.play('error');
        banner(world.result.reason === 'out' ? 'failOut' : 'failNobody', 'bad');
      } else if (ev.type === 'bounce') {
        sfx.tone({ freq: 140, to: 80, dur: 0.06, type: 'sine', vol: 0.15 });
      }
    }
  }

  function banner(key, kind) {
    if (cfg.onBanner) cfg.onBanner(key, kind);
  }

  function spawnConfetti() {
    const cols = ['#ffd768', '#fff1b8', '#f3c24a', '#ffffff', cfg.kits.home.shirt, cfg.kits.home.shirt2];
    for (let i = 0; i < 140; i++) {
      fx.confetti.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.5,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 120,
        a: Math.random() * TAU,
        va: (Math.random() - 0.5) * 12,
        s: 4 + Math.random() * 5,
        c: cols[i % cols.length],
        life: 3 + Math.random(),
      });
    }
  }

  // ------------------------------------------------------------------ loop
  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dtReal = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (paused) {
      draw();
      return;
    }
    clock += dtReal;
    introT += dtReal;
    fx.t = clock;

    // time scale (slow motion)
    let ts = 1;
    const F = world.flight;
    if (F && F.type === 'shot') {
      const remain = (F.curve.len - F.s) / Math.max(5, F.v0);
      if (remain < 0.42) ts = 0.36;
    } else if (F && S.firstTimeOpen(world)) {
      const u = F.s / F.curve.len;
      if (u > 0.3) ts = stroke && stroke.mode === 'first' ? (u > 0.93 ? 0 : 0.12) : 0.3;
    } else if (F && F.next && F.s / F.curve.len > 0.6) ts = 0.45;
    if (world.result && world.result.goal && clock - fx.goalAt < 0.25) ts = 0.25;
    fx.slow += (ts - fx.slow) * Math.min(1, dtReal * 10);
    if (ts === 0) fx.slow = 0;

    if (introT > 0.55 || !level.auto) {
      acc += dtReal * fx.slow;
      let n = 0;
      while (acc >= S.DT && n < 12) {
        S.step(world, S.DT);
        acc -= S.DT;
        n++;
        if (world.flight && world.flight.type === 'shot') {
          const b = world.ball;
          fx.trail.push({ x: b.x, y: b.y, z: b.z });
          if (fx.trail.length > 26) fx.trail.shift();
        }
      }
      if (n >= 12) acc = 0;
    }
    if (world.flight && world.flight.type !== 'shot' && fx.trail.length) fx.trail.length = 0;
    if (world.phase === 'post' && world.result && world.result.goal && world.ball.y > -2.2) {
      const b = world.ball;
      fx.trail.push({ x: b.x, y: b.y, z: b.z });
      if (fx.trail.length > 26) fx.trail.shift();
    }
    handleEvents();

    // auto action (training crosses)
    if (level.auto && world.phase === 'aim' && !world.result && introT > 0.9 && !fx.autoDone) {
      fx.autoDone = true;
      const F2 = S.launch(world, level.auto);
      if (F2) fx.plan = previewOf(level.auto, null, F2);
    }

    // effects timers
    if (fx.ripple) {
      fx.ripple.t += dtReal;
      if (fx.ripple.t > 2.2) fx.ripple = null;
    }
    fx.postShake = Math.max(0, fx.postShake - dtReal * 2);
    fx.shake = Math.max(0, fx.shake - dtReal * 2.2);
    fx.flash = Math.max(0, fx.flash - dtReal * 2.5);
    fx.crowdJump = Math.max(0, fx.crowdJump - dtReal * 0.35);
    fx.planT += dtReal;
    hintPulse = Math.max(0, hintPulse - dtReal * 0.8);
    for (const p of fx.parts) {
      p.vz -= 9.8 * dtReal;
      p.x += p.vx * dtReal;
      p.y += p.vy * dtReal;
      p.z = Math.max(0, p.z + p.vz * dtReal);
      p.life -= dtReal;
    }
    fx.parts = fx.parts.filter((p) => p.life > 0);
    for (const c of fx.confetti) {
      c.x += c.vx * dtReal;
      c.y += c.vy * dtReal;
      c.vx *= 0.99;
      c.a += c.va * dtReal;
      c.life -= dtReal;
    }
    fx.confetti = fx.confetti.filter((c) => c.life > 0 && c.y < H + 20);

    // ambience
    if (clock > nextMurmur) {
      nextMurmur = clock + 1.5;
      if (!world.result) crowd('murmur');
    }

    if (introT > 1.0 && cfg.onState && !fx.introDone) {
      fx.introDone = true;
      cfg.onState('play');
    }

    // result → hand over after the moment plays out
    if (world.result && !resultSent) {
      if (!doneAt) doneAt = clock + (world.result.goal ? 2.6 : 1.5);
      if (clock >= doneAt) {
        resultSent = true;
        if (cfg.onResult) cfg.onResult({ ...world.result, passes: world.passes });
      }
    }

    updateCamera(dtReal);
    draw();
  }

  // ------------------------------------------------------------------ drawing
  const SP = { x: 0, y: 0, d: 0, k: 0 };
  function draw() {
    applyCamera();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    R.drawBackground(g, view, assets, fx);
    R.drawPitch(g, view, assets, fx);
    const w = world;
    const aim = w.phase === 'aim' && !w.result && introT > 0.4;

    // ground marks
    if (aim || w.phase === 'settle') {
      for (const d of w.def) {
        if (d.wall) continue;
        R.groundEllipse(g, view, d.x, d.y, w.P.defReach + 0.35, 'rgba(255,60,80,0.10)', 'rgba(255,90,100,0.28)', 1.2);
      }
      for (const a of w.att) if (a.run) R.groundArrow(g, view, a.x, a.y, a.run.x, a.run.y, 'rgba(255,255,255,0.75)', clock);
    }
    const hero = w.att.find((a) => a.hero);
    if (hero && !(w.result && w.result.goal)) R.groundEllipse(g, view, hero.x, hero.y, 0.95, 'rgba(243,194,74,0.18)', 'rgba(255,215,104,0.85)', 2);
    if (aim) {
      const A = w.att[w.carrier];
      const pul = (Math.sin(clock * 5) + 1) / 2;
      R.groundEllipse(g, view, A.x, A.y - 0.2, 1.3 + pul * 0.35 + hintPulse * 0.8, null, `rgba(255,255,255,${0.35 + pul * 0.45})`, 2.5);
    }
    if (w.flight && w.flight.type !== 'shot' && w.flight.receiver >= 0) {
      const p2 = w.flight.curve.p2;
      const open = S.firstTimeOpen(w);
      const pul = (Math.sin(clock * 9) + 1) / 2;
      R.groundEllipse(g, view, p2.x, p2.y, open ? 1.2 + pul * 0.5 : 0.9, open ? 'rgba(255,215,104,0.22)' : null, open ? 'rgba(255,225,130,0.95)' : 'rgba(255,255,255,0.5)', open ? 3 : 1.5);
    }

    // goal (net behind, ball in the net, roof, frame)
    R.drawNet(g, view, fx, 'back');
    const ballIn = w.ball.y < -0.05;
    if (ballIn) {
      R.drawBallShadow(g, view, w.ball);
      drawTrail();
      R.drawBall(g, view, w.ball);
    }
    R.drawNet(g, view, fx, 'roof');
    if (level.targets) drawTargets();
    R.drawGoalFrame(g, view, fx);

    // players + ball, far to near
    const items = [];
    for (const a of w.att) items.push({ d: view.depth(a.y, 0), k: 'a', e: a });
    for (const d of w.def) items.push({ d: view.depth(d.y, 0), k: 'd', e: d });
    if (w.gk) items.push({ d: view.depth(w.gk.y, 0), k: 'g', e: w.gk });
    if (!ballIn) items.push({ d: view.depth(w.ball.y - 0.15, 0), k: 'b' });
    items.sort((p, q) => q.d - p.d);
    const heroOut = {};
    if (!ballIn) R.drawBallShadow(g, view, w.ball);
    for (const it of items) {
      if (it.k === 'a') R.drawFigure(g, view, it.e, looks.att[it.e.i], it.e.hero ? { out: heroOut } : {});
      else if (it.k === 'd') {
        const e = it.e;
        const jump = e.wall && w.flight && w.flight.type === 'shot' ? { ...e, pose: 'header', poseT: Math.min(0.5, w.flight.time * 1.4) } : e;
        R.drawFigure(g, view, jump, looks.def[e.i]);
      } else if (it.k === 'g') {
        const k = it.e;
        R.drawFigure(g, view, { ...k, x: k.pose === 'dive' ? k.x : k.x, kz: k.kz }, looks.gk);
      } else {
        drawTrail();
        R.drawBall(g, view, w.ball);
      }
    }

    // particles
    for (const p of fx.parts) {
      if (!view.p(p.x, p.y, p.z, SP)) continue;
      g.fillStyle = p.col;
      g.globalAlpha = Math.min(1, p.life * 2);
      const s = Math.max(1.5, SP.k * p.s);
      g.fillRect(SP.x - s / 2, SP.y - s / 2, s, s);
    }
    g.globalAlpha = 1;

    R.drawLighting(g, view);

    // planned trajectory preview (fades as the ball travels)
    if (fx.plan && fx.planT < 1.6) {
      const a = Math.max(0, 1 - fx.planT / 1.6);
      const pts = [];
      for (const q of fx.plan.pts) if (view.p(q.x, q.y, q.z, SP)) pts.push({ x: SP.x, y: SP.y });
      g.setLineDash([2, 9]);
      g.lineCap = 'round';
      g.strokeStyle = `rgba(255,226,120,${0.85 * a})`;
      g.lineWidth = 4;
      g.beginPath();
      pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.stroke();
      g.setLineDash([]);
    }

    // hero label
    if (hero && heroOut.hx !== undefined && (aim || w.phase === 'settle') && cfg.heroName) {
      const bob = Math.sin(clock * 3) * 2;
      const x = heroOut.hx;
      const y = heroOut.hy - 8 + bob;
      g.font = '900 12px Nunito, system-ui, sans-serif';
      const tw = g.measureText(cfg.heroName).width;
      const pw = tw + 16;
      const gr2 = g.createLinearGradient(0, y - 20, 0, y);
      gr2.addColorStop(0, '#fff0a8');
      gr2.addColorStop(1, '#d9a21f');
      g.fillStyle = gr2;
      roundRect(x - pw / 2, y - 21, pw, 18, 9);
      g.fill();
      g.fillStyle = '#1a1102';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(cfg.heroName, x, y - 11.5);
      g.beginPath();
      g.moveTo(x - 5, y - 3);
      g.lineTo(x + 5, y - 3);
      g.lineTo(x, y + 3);
      g.closePath();
      g.fillStyle = '#d9a21f';
      g.fill();
    }

    // first-time prompt
    if (S.firstTimeOpen(w) && w.flight.s / w.flight.curve.len > 0.25) {
      const p2 = w.flight.curve.p2;
      if (view.p(p2.x, p2.y, 2.6 * R.FIG, SP)) {
        const pul = 1 + Math.sin(clock * 10) * 0.06;
        const label = t(w.flight.z1 > 1.2 ? 'promptHeader' : 'promptVolley');
        g.save();
        g.translate(SP.x, SP.y - 6);
        g.scale(pul, pul);
        g.font = '1000 16px Nunito, system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 5;
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.strokeText(label, 0, 0);
        g.fillStyle = '#ffe27a';
        g.fillText(label, 0, 0);
        g.restore();
      }
    }

    // tutorial ghost
    if (cfg.tutorial && !w.result) drawTutorial();

    // the stroke being drawn
    if (stroke) {
      drawStrokeTarget();
      R.goldStroke(g, stroke.pts, 1, 1);
      const e = stroke.pts[stroke.pts.length - 1];
      g.fillStyle = '#fff6cf';
      g.beginPath();
      g.arc(e.x, e.y, 6, 0, TAU);
      g.fill();
    }

    // off-screen teammates
    if (aim) {
      for (const a of w.att) {
        if (a.i === w.carrier) continue;
        const s = bodyOf(a);
        if (!s) continue;
        if (s.x >= 6 && s.x <= W - 6) continue;
        const x = Math.max(16, Math.min(W - 16, s.x));
        const y = Math.max(H * 0.18, Math.min(H * 0.85, s.y));
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.beginPath();
        g.arc(x, y, 13, 0, TAU);
        g.fill();
        g.strokeStyle = cfg.kits.home.shirt;
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = '#fff';
        g.font = '900 11px Nunito, system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(looks.att[a.i].num), x, y + 0.5);
      }
    }

    // confetti + flash
    for (const c of fx.confetti) {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.a);
      g.fillStyle = c.c;
      g.globalAlpha = Math.min(1, c.life);
      g.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2);
      g.restore();
    }
    g.globalAlpha = 1;
    if (fx.flash > 0) {
      g.fillStyle = `rgba(255,240,200,${fx.flash * 0.35})`;
      g.fillRect(0, 0, W, H);
    }
    if (fx.slow < 0.6 && !w.result) {
      // slow-motion letterbox tint
      const a = (0.6 - fx.slow) / 0.6;
      g.fillStyle = `rgba(0,0,0,${0.35 * a})`;
      g.fillRect(0, 0, W, 10 + 18 * a);
      g.fillRect(0, H - 10 - 18 * a, W, 10 + 18 * a);
    }
  }

  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawTrail() {
    const tr = fx.trail;
    if (tr.length < 2) return;
    let prev = null;
    g.lineCap = 'round';
    for (let i = 0; i < tr.length; i++) {
      const q = tr[i];
      if (!view.p(q.x, q.y, q.z * 0.92 + S.BR * 1.5, SP)) {
        prev = null;
        continue;
      }
      const cur = { x: SP.x, y: SP.y, k: SP.k };
      if (prev) {
        const f = i / tr.length;
        g.strokeStyle = `rgba(255,236,170,${f * 0.55})`;
        g.lineWidth = Math.max(1, f * cur.k * 0.3);
        g.beginPath();
        g.moveTo(prev.x, prev.y);
        g.lineTo(cur.x, cur.y);
        g.stroke();
      }
      prev = cur;
    }
  }

  function drawTargets() {
    for (const tg of level.targets) {
      if (!view.p(tg.x, -0.02, tg.z, SP)) continue;
      const r = Math.max(6, tg.r * SP.k);
      const pul = (Math.sin(clock * 4 + tg.x) + 1) / 2;
      g.fillStyle = tg.hit ? 'rgba(80,255,140,0.35)' : `rgba(255,215,104,${0.18 + pul * 0.12})`;
      g.beginPath();
      g.arc(SP.x, SP.y, r, 0, TAU);
      g.fill();
      g.strokeStyle = tg.hit ? '#5dffa0' : '#ffd768';
      g.lineWidth = 2.5;
      g.stroke();
      g.beginPath();
      g.arc(SP.x, SP.y, r * 0.55, 0, TAU);
      g.stroke();
      g.fillStyle = '#fff';
      g.font = `900 ${Math.max(10, r * 0.7) | 0}px Nunito, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('+' + tg.pts, SP.x, SP.y + 1);
    }
  }

  function drawStrokeTarget() {
    const e = stroke.pts[stroke.pts.length - 1];
    const gr = R.goalRect(view);
    const w = world;
    // goal target
    if (gr) {
      const gh = gr.y1 - gr.y0;
      const inGoal = e.x > gr.x0 - 30 && e.x < gr.x1 + 30 && e.y < gr.y1 + 16 && e.y > gr.y0 - gh * 1.3;
      if (inGoal) {
        g.strokeStyle = 'rgba(255,226,120,0.95)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(e.x, e.y, 14, 0, TAU);
        g.moveTo(e.x - 20, e.y);
        g.lineTo(e.x - 8, e.y);
        g.moveTo(e.x + 8, e.y);
        g.lineTo(e.x + 20, e.y);
        g.moveTo(e.x, e.y - 20);
        g.lineTo(e.x, e.y - 8);
        g.moveTo(e.x, e.y + 8);
        g.lineTo(e.x, e.y + 20);
        g.stroke();
        g.fillStyle = 'rgba(255,226,120,0.12)';
        g.fillRect(gr.x0, gr.y0, gr.x1 - gr.x0, gr.y1 - gr.y0);
        return;
      }
    }
    if (stroke.mode !== 'aim') return;
    for (const a of w.att) {
      if (a.i === w.carrier) continue;
      const bs = bodyOf(a);
      if (!bs) continue;
      if (Math.hypot(bs.x - e.x, bs.y - e.y) < Math.max(34, bs.k * R.FIG * 1.1)) {
        R.groundEllipse(g, view, a.x, a.y, 1.1, 'rgba(255,226,120,0.25)', '#ffe27a', 3);
      }
      if (a.run) {
        const rs = screenOf(a.run.x, a.run.y, 0);
        if (rs && Math.hypot(rs.x - e.x, rs.y - e.y) < Math.max(36, rs.k * 2.2)) R.groundEllipse(g, view, a.run.x, a.run.y, 1.1, 'rgba(255,226,120,0.25)', '#ffe27a', 3);
      }
    }
  }

  function drawTutorial() {
    const tu = cfg.tutorial;
    const w = world;
    let pts = null;
    if (tu.first) {
      if (!S.firstTimeOpen(w) || w.flight.s / w.flight.curve.len < 0.3 || stroke) return;
      const p2 = w.flight.curve.p2;
      pts = demoPoints({ x: p2.x, y: p2.y }, tu.first);
    } else {
      if (w.phase !== 'aim' || stroke || w.passes !== (tu.after || 0)) return;
      pts = demoPoints({ x: w.ball.x, y: w.ball.y }, tu.plan);
    }
    if (!pts || pts.length < 2) return;
    const cyc = (clock % 2.2) / 1.6;
    const n = Math.max(2, Math.min(pts.length, Math.floor(pts.length * Math.min(1, cyc))));
    const show = pts.slice(0, n);
    g.globalAlpha = cyc > 1 ? Math.max(0, 1 - (cyc - 1) * 2) : 1;
    g.setLineDash([3, 10]);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    show.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
    g.stroke();
    g.setLineDash([]);
    const hd = show[show.length - 1];
    g.font = '30px system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('👆', hd.x - 10, hd.y - 4);
    g.globalAlpha = 1;
  }

  function demoPoints(o, plan) {
    const w = world;
    let tgt;
    let z1 = 0;
    if (plan.type === 'shot') {
      tgt = { x: plan.tx, y: 0 };
      z1 = plan.tz;
    } else if (plan.type === 'pass') {
      const A = w.att[plan.to];
      tgt = plan.through && A.run ? A.run : { x: A.x, y: A.y };
    } else return null;
    const c = S.buildCurve(o, tgt, plan.curl || 0);
    const q = {};
    const out = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      S.curvePoint(c, S.curveT(c, u * c.len), q);
      const z = plan.type === 'shot' ? z1 * Math.pow(u, 3) : plan.type === 'pass' ? 0.9 * R.FIG * u : 0;
      if (view.p(q.x, q.y, z, SP)) out.push({ x: SP.x, y: SP.y });
    }
    return out;
  }

  // ------------------------------------------------------------------ lifecycle
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  resize();
  reset();
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  raf = requestAnimationFrame(frame);

  return {
    restart(newLevel) {
      reset(newLevel);
    },
    setPaused(p) {
      paused = !!p;
      last = 0;
    },
    get world() {
      return world;
    },
    get view() {
      return view;
    },
    // test hook: perform a plan as if drawn
    play(plan) {
      if (world.phase === 'aim' && !world.result) {
        const F = S.launch(world, plan);
        if (F) fx.plan = previewOf(plan, null, F);
        return !!F;
      }
      if (plan.type === 'shot' && S.firstTimeOpen(world)) return S.queueFirstTime(world, plan);
      return false;
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.remove();
    },
  };
}
