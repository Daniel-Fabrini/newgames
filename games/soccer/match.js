// One match: canvas rendering, slingshot input, turns, CPU, goals, effects.

import * as P from './physics.js';
import { think } from './ai.js';
import { layout, drawStatic, drawGoals, capSprite, loadFlag, flagSrc, ballPattern, rollBall, drawBall, BALL_SKINS, SIDES } from './render.js';

const { W, L, GX0, GX1, CAP_R, BALL_R } = P;
const TURN_TIME = 15;
const MAX_DRAG = 25; // world units of pull for a full-power flick
const MIN_POWER = 0.07;

export function createMatch(host, ctx, t, o) {
  const { h } = ctx.ui;
  const sfx = ctx.sfx;
  const world = P.createWorld();
  const B = world.bodies;
  const prev = B.map((b) => ({ x: b.x, y: b.y }));
  const score = [0, 0];
  let state = 'loading';
  let stateT = 0;
  let turn = 0;
  let kickTeam = o.kickoff || 0;
  let lastShooter = 0;
  let timer = TURN_TIME;
  let lastTick = 99;
  let clock = o.timed || 0;
  let golden = false;
  let drag = null;
  let ai = null; // { gen, res, aimT }
  let paused = false;
  let destroyed = false;
  let acc = 0;
  let alpha = 0;
  let restT = 0;
  let moveT = 0;
  let timeScale = 1;
  let slow = { on: false, used: 0, target: null };
  const cam = { z: 1, fx: 0, fy: 0 };
  let shake = 0;
  let parts = [];
  let rings = [];
  let trail = [];
  const ripple = [0, 0];
  let shots = 0;
  let lastHit = 0;
  let lastWall = 0;
  let raf = 0;
  let last = 0;
  let clockT = 0;
  const pts = ballPattern();
  let ballDraw = { x: B[0].x, y: B[0].y };
  let flags = [null, null];
  let sprites = [null, null];
  let lay = null;
  let dpr = 1;
  let stat = null;
  const skin = BALL_SKINS[o.ball] || BALL_SKINS.classic;

  // ---------- DOM ----------
  const canvas = h('canvas', { class: 'g-soccer-canvas' });
  const g = canvas.getContext('2d');
  const scoreEls = [h('b', null, '0'), h('b', null, '0')];
  const sub = h('small', { class: 'g-soccer-sub' });
  const av = [0, 1].map((i) =>
    h('div', { class: `g-soccer-av side${i}`, title: o.names[i] }, h('img', { src: flagSrc(o.teams[i]), alt: o.names[i], draggable: 'false' })),
  );
  const board = h(
    'div',
    { class: 'g-soccer-board' },
    av[0],
    h('div', { class: 'g-soccer-score' }, h('div', { class: 'g-soccer-nums' }, scoreEls[0], h('span', null, '-'), scoreEls[1]), sub),
    av[1],
  );
  const banner = h('div', { class: 'g-soccer-banner' });
  const goalEl = h('div', { class: 'g-soccer-goaltext' });
  const tip = h('div', { class: 'g-soccer-tip' }, t('tipDrag'));
  const el = h('div', { class: 'g-soccer-match' }, canvas, board, banner, goalEl, tip);
  host.append(el);
  // read-only handle used by automated tests (no globals)
  el.__soccer = {
    world,
    score,
    get state() {
      return state;
    },
    get turn() {
      return turn;
    },
    get layout() {
      return lay;
    },
  };

  function updateBoard() {
    scoreEls[0].textContent = score[0];
    scoreEls[1].textContent = score[1];
    const active = state === 'aim' || state === 'moving' || state === 'timeout';
    av.forEach((a, i) => a.classList.toggle('active', active && turn === i));
    if (golden) sub.textContent = t('goldenGoal');
    else if (o.timed) {
      const s = Math.max(0, Math.ceil(clock));
      sub.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    } else sub.textContent = t('firstTo', { n: o.goals });
  }

  let bannerTimer = 0;
  function showBanner(text, cls = '', ms = 1100) {
    banner.textContent = text;
    banner.className = 'g-soccer-banner';
    void banner.offsetWidth;
    banner.className = `g-soccer-banner show ${cls}`;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('show'), ms);
  }

  // ---------- sizing ----------
  function resize() {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    lay = layout(r.width, r.height, board.offsetTop + board.offsetHeight + 4);
    stat = document.createElement('canvas');
    stat.width = canvas.width;
    stat.height = canvas.height;
    const sg = stat.getContext('2d');
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStatic(sg, lay, o.pitch);
    makeSprites();
  }
  function makeSprites() {
    if (!lay) return;
    sprites = [0, 1].map((i) => capSprite(flags[i], i, i === 0 ? o.rim : 'team', CAP_R * lay.s, dpr));
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(el);

  // ---------- helpers ----------
  const savePrev = () => {
    for (let i = 0; i < B.length; i++) {
      prev[i].x = B[i].x;
      prev[i].y = B[i].y;
    }
  };
  const dispX = (i) => prev[i].x + (B[i].x - prev[i].x) * alpha;
  const dispY = (i) => prev[i].y + (B[i].y - prev[i].y) * alpha;
  const isCpu = (team) => !!o.cpu[team];

  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    // undo the camera (identity while aiming, kept for safety)
    const x = cam.fx + (sx - cam.fx) / cam.z;
    const y = cam.fy + (sy - cam.fy) / cam.z;
    return { x: (x - lay.ox) / lay.s, y: (y - lay.oy) / lay.s };
  }

  // ---------- physics events (sounds + effects) ----------
  const ev = {
    hit(a, b, imp, x, y) {
      if (imp < 16) return;
      const now = performance.now();
      if (now - lastHit < 55) return;
      lastHit = now;
      const ball = a.kind === 'ball' || b.kind === 'ball';
      if (ball) sfx.play('hit');
      else sfx.tone({ freq: 210 + Math.random() * 50, to: 110, dur: 0.08, type: 'triangle', vol: Math.min(0.5, 0.15 + imp / 500) });
      sparks(x, y, imp > 120 ? 7 : 3, '#ffffff');
      if (imp > 140) sfx.vibrate(10);
    },
    wall(ob, imp, net, x, y) {
      const now = performance.now();
      if (net && ob.kind === 'ball') {
        ripple[y < L / 2 ? 0 : 1] = Math.min(1.4, 0.3 + imp / 120);
        sfx.noise({ dur: 0.18, vol: 0.14, freq: 2600, q: 0.5 });
        return;
      }
      if (imp < 35 || now - lastWall < 70) return;
      lastWall = now;
      sfx.noise({ dur: 0.06, vol: Math.min(0.3, imp / 600), freq: 420, q: 1.1 });
    },
    post(ob, imp, x, y) {
      if (imp < 15) return;
      sfx.tone({ freq: 1250, to: 880, dur: 0.24, type: 'square', vol: 0.1 });
      sfx.tone({ freq: 2480, dur: 0.18, type: 'sine', vol: 0.08 });
      sfx.vibrate(25);
      shake = Math.max(shake, 0.5);
      sparks(x, y, 8, '#fff6c8');
    },
    goal(team) {
      onGoal(team);
    },
  };

  function sparks(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 10 + Math.random() * 30;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.25, t: 0, size: 0.35 + Math.random() * 0.35, color, drag: 3 });
    }
  }
  function confetti(team) {
    const gy = team === 0 ? 0 : L;
    const cols = ['#f7d774', '#c9971c', '#ffffff', team === 0 ? '#e5261c' : '#1f5fe0', team === 0 ? '#f6c21a' : '#e4e8ee'];
    for (let i = 0; i < 90; i++) {
      const a = (team === 0 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 2.6;
      const sp = 30 + Math.random() * 70;
      parts.push({ x: W / 2 + (Math.random() - 0.5) * 30, y: gy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + Math.random(), t: 0, size: 0.7 + Math.random() * 0.8, color: cols[i % cols.length], drag: 1.6, conf: true, rot: Math.random() * 6 });
    }
  }

  // ---------- flow ----------
  function setState(s) {
    state = s;
    stateT = 0;
    updateBoard();
  }

  function kickoff() {
    P.resetPositions(world);
    savePrev();
    trail = [];
    acc = 0;
    setState('intro');
    sfx.play('whistle');
    showBanner(score[0] + score[1] === 0 ? t('kickoff') : turnLabel(kickTeam), 'kick', 1200);
  }

  function turnLabel(team) {
    if (o.cpu[1] && !o.cpu[0]) return team === 0 ? t('yourTurn') : t('cpuTurn');
    return t('playerTurn', { n: team + 1 });
  }

  function startTurn(team) {
    turn = team;
    timer = TURN_TIME;
    lastTick = 99;
    drag = null;
    setState('aim');
    if (isCpu(team)) {
      ai = { gen: think(P.cloneWorld(world), team, o.skill), res: null, aimT: 0 };
    } else {
      ai = null;
      if (shots > 0 || !o.hint) showBanner(turnLabel(team), '', 900);
    }
    tip.classList.toggle('show', !!o.hint && shots === 0 && !isCpu(team));
  }

  function shoot(idx, a, p) {
    const c = B[idx];
    const sp = P.MAX_SPEED * p;
    P.flick(c, Math.cos(a) * sp, Math.sin(a) * sp);
    lastShooter = turn;
    shots++;
    tip.classList.remove('show');
    sfx.play('kick');
    sfx.vibrate(12 + Math.round(p * 18));
    rings.push({ x: c.x, y: c.y, t: 0, p });
    slow = { on: false, used: 0, target: null };
    restT = 0;
    moveT = 0;
    setState('moving');
  }

  function onGoal(team) {
    if (state !== 'moving') return;
    score[team]++;
    kickTeam = 1 - team;
    setState('goal');
    sfx.play('goal');
    sfx.vibrate([60, 40, 140]);
    shake = 1.2;
    ripple[team === 0 ? 0 : 1] = 1.6;
    confetti(team);
    // keep (or start) a short slow-motion moment
    slow.on = true;
    slow.target = { x: W / 2, y: team === 0 ? 0 : L };
    goalEl.textContent = t('goal');
    goalEl.className = 'g-soccer-goaltext';
    void goalEl.offsetWidth;
    goalEl.className = `g-soccer-goaltext show side${team}`;
    scoreEls[team].classList.remove('bump');
    void scoreEls[team].offsetWidth;
    scoreEls[team].classList.add('bump');
  }

  function afterGoal() {
    goalEl.classList.remove('show');
    const scorer = 1 - kickTeam;
    if (golden || (!o.timed && score[scorer] >= o.goals)) return finish(scorer);
    if (o.timed && clock <= 0) return timeUp();
    kickoff();
  }

  function timeUp() {
    if (score[0] !== score[1]) return finish(score[0] > score[1] ? 0 : 1);
    if (!golden) {
      golden = true;
      sfx.play('whistle');
      showBanner(t('goldenGoal'), 'kick', 1500);
    }
    if (state === 'goal' || state === 'loading') kickoff();
    else startTurn(1 - lastShooter);
  }

  function afterMove() {
    if (o.timed && clock <= 0 && !golden) return timeUp();
    startTurn(1 - lastShooter);
  }

  function finish(winner) {
    setState('over');
    tip.classList.remove('show');
    sfx.play('whistle');
    showBanner(t('fullTime'), 'kick', 1400);
    setTimeout(() => {
      if (destroyed) return;
      o.onEnd && o.onEnd({ score: score.slice(), winner });
    }, 1500);
  }

  // ---------- input ----------
  function onDown(e) {
    if (paused || state !== 'aim' || isCpu(turn) || drag || !lay) return;
    const p = toWorld(e);
    let best = -1;
    let bd = CAP_R * 1.75;
    for (let i = 1 + turn * 5; i < 6 + turn * 5; i++) {
      const d = Math.hypot(B[i].x - p.x, B[i].y - p.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return;
    e.preventDefault();
    drag = { idx: best, id: e.pointerId, sx: p.x, sy: p.y, x: p.x, y: p.y };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    sfx.tone({ freq: 520, to: 700, dur: 0.06, type: 'triangle', vol: 0.18 });
    sfx.vibrate(6);
  }
  function dragShot() {
    const dx = drag.sx - drag.x;
    const dy = drag.sy - drag.y;
    const d = Math.hypot(dx, dy);
    return { a: Math.atan2(dy, dx), p: Math.min(1, d / MAX_DRAG), d };
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = toWorld(e);
    drag.x = p.x;
    drag.y = p.y;
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const s = dragShot();
    const idx = drag.idx;
    drag = null;
    if (state === 'aim' && !paused && s.p >= MIN_POWER) shoot(idx, s.a, s.p);
  }
  function onCancel(e) {
    if (drag && e.pointerId === drag.id) drag = null;
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('lostpointercapture', onCancel);

  // ---------- update ----------
  function physics(dt) {
    acc += dt * timeScale;
    let n = 0;
    while (acc >= P.DT && n < 12) {
      savePrev();
      P.step(world, ev);
      acc -= P.DT;
      n++;
      if (state !== 'moving' && state !== 'goal') break;
    }
    if (n >= 12) acc = 0;
    alpha = Math.min(1, acc / P.DT);
  }

  function checkSlowmo() {
    if (slow.on || slow.used > 1.3) return;
    const b = B[0];
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < 55) return;
    for (const top of [true, false]) {
      const gy = top ? 0 : L;
      if (top ? b.vy >= 0 : b.vy <= 0) continue;
      const tc = (gy - b.y) / b.vy;
      if (tc <= 0 || tc > 0.42 || Math.abs(gy - b.y) > 42) continue;
      const xc = b.x + b.vx * tc;
      if (xc > GX0 - 1.5 && xc < GX1 + 1.5) {
        slow.on = true;
        slow.target = { x: (b.x + W / 2) / 2, y: (b.y + gy) / 2 };
        return;
      }
    }
  }

  function update(dt) {
    stateT += dt;
    // effects
    for (const p of parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f;
      p.vy *= f;
      if (p.conf) {
        p.vy += 0;
        p.rot += dt * 8;
      }
    }
    parts = parts.filter((p) => p.t < p.life);
    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < 0.5);
    ripple[0] = Math.max(0, ripple[0] - dt * 1.6);
    ripple[1] = Math.max(0, ripple[1] - dt * 1.6);
    shake = Math.max(0, shake - dt * 2.2);

    // slow motion + camera
    if (state === 'moving') checkSlowmo();
    if (slow.on) {
      slow.used += dt;
      const b = B[0];
      const still = Math.hypot(b.vx, b.vy) < 25;
      if ((state === 'moving' && (slow.used > 1.3 || still)) || (state === 'goal' && stateT > 0.9) || state === 'aim') slow.on = false;
    }
    const tsTarget = slow.on ? 0.3 : 1;
    timeScale += (tsTarget - timeScale) * Math.min(1, dt * (slow.on ? 10 : 5));
    const zTarget = slow.on ? 1.14 : 1;
    cam.z += (zTarget - cam.z) * Math.min(1, dt * 5);
    if (slow.on && slow.target && lay) {
      const fx = lay.ox + slow.target.x * lay.s;
      const fy = lay.oy + slow.target.y * lay.s;
      cam.fx += (fx - cam.fx) * Math.min(1, dt * 6);
      cam.fy += (fy - cam.fy) * Math.min(1, dt * 6);
    }
    if (Math.abs(cam.z - 1) < 0.002 && !slow.on) cam.z = 1;

    if (o.timed && !golden && (state === 'aim' || state === 'moving')) {
      clock = Math.max(0, clock - dt);
      clockT += dt;
      if (clockT > 0.25) {
        clockT = 0;
        updateBoard();
      }
    }

    switch (state) {
      case 'intro':
        if (stateT > 1.3) startTurn(kickTeam);
        break;
      case 'aim':
        if (isCpu(turn)) runAI(dt);
        else {
          timer -= dt;
          const sec = Math.ceil(timer);
          if (sec <= 5 && sec < lastTick && sec > 0) {
            lastTick = sec;
            sfx.tone({ freq: sec <= 2 ? 1320 : 990, dur: 0.05, type: 'square', vol: 0.07 });
          }
          if (timer <= 0) {
            drag = null;
            setState('timeout');
            sfx.play('error');
            showBanner(t('timeUp'), 'warn', 1000);
          }
        }
        if (o.timed && clock <= 0 && !golden && state === 'aim' && !drag) timeUp();
        break;
      case 'timeout':
        if (stateT > 1) {
          lastShooter = turn;
          afterMove();
        }
        break;
      case 'moving':
        physics(dt);
        moveT += dt;
        if (P.isResting(world)) {
          restT += dt;
          if (restT > 0.3) afterMove();
        } else restT = 0;
        if (moveT > 14) {
          for (const b of B) {
            b.vx = b.vy = 0;
            b.moving = false;
          }
        }
        break;
      case 'goal':
        physics(dt);
        if (stateT > 2.6) afterGoal();
        break;
      default:
        break;
    }
    if (state !== 'moving' && state !== 'goal') {
      savePrev();
      alpha = 0;
    }
  }

  function runAI(dt) {
    if (!ai) return;
    if (!ai.res) {
      const t0 = performance.now();
      let r = ai.gen.next();
      while (!r.done && performance.now() - t0 < 7) r = ai.gen.next();
      if (r.done) ai.res = r.value;
      return;
    }
    if (stateT < 0.75) return;
    ai.aimT += dt;
    if (ai.aimT > 0.6) {
      const { idx, a, p } = ai.res;
      ai = null;
      shoot(idx, a, p);
    }
  }

  // ---------- drawing ----------
  function powerColor(p) {
    if (p < 0.5) return `rgb(${Math.round(80 + 350 * p)},${Math.round(220 - 10 * p)},90)`;
    return `rgb(255,${Math.round(215 - 300 * (p - 0.5))},${Math.round(90 - 100 * (p - 0.5))})`;
  }

  function raycast(cx, cy, ux, uy, r, skip, maxLen) {
    let best = maxLen;
    let hit = -1;
    for (let i = 0; i < B.length; i++) {
      if (i === skip) continue;
      const b = B[i];
      const fx = cx - b.x;
      const fy = cy - b.y;
      const R = r + b.r;
      const bq = fx * ux + fy * uy;
      const cq = fx * fx + fy * fy - R * R;
      const disc = bq * bq - cq;
      if (disc < 0) continue;
      const tt = -bq - Math.sqrt(disc);
      if (tt > 0 && tt < best) {
        best = tt;
        hit = i;
      }
    }
    let wall = false;
    const walls = [];
    if (ux > 1e-6) walls.push((W - r - cx) / ux);
    if (ux < -1e-6) walls.push((r - cx) / ux);
    if (uy > 1e-6) walls.push((L - r - cy) / uy);
    if (uy < -1e-6) walls.push((r - cy) / uy);
    for (const tw of walls) {
      if (tw > 0 && tw < best) {
        const xx = cx + ux * tw;
        const yy = cy + uy * tw;
        const mouth = (yy < r + 0.01 || yy > L - r - 0.01) && xx > GX0 && xx < GX1;
        if (mouth) continue;
        best = tw;
        hit = -1;
        wall = true;
      }
    }
    return { t: best, hit, wall };
  }

  function drawAim(idx, a, p, finger) {
    const cx = B[idx].x;
    const cy = B[idx].y;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const col = powerColor(p);
    g.save();
    // pull line back to the finger
    if (finger) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 0.35;
      g.setLineDash([1, 1]);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx - ux * p * MAX_DRAG, cy - uy * p * MAX_DRAG);
      g.stroke();
      g.setLineDash([]);
    }
    // power ring
    g.lineWidth = 0.75;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.arc(cx, cy, CAP_R + 1.6, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = col;
    g.beginPath();
    g.arc(cx, cy, CAP_R + 1.6, a - Math.PI * p, a + Math.PI * p);
    g.stroke();
    // trajectory guide
    const maxLen = 22 + 70 * p;
    const rc = raycast(cx, cy, ux, uy, CAP_R, idx, maxLen);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 0.45;
    g.setLineDash([0.1, 1.6]);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + ux * (CAP_R + 2), cy + uy * (CAP_R + 2));
    g.lineTo(cx + ux * rc.t, cy + uy * rc.t);
    g.stroke();
    g.setLineDash([]);
    if (rc.t < maxLen) {
      const gx = cx + ux * rc.t;
      const gy = cy + uy * rc.t;
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 0.3;
      g.beginPath();
      g.arc(gx, gy, CAP_R, 0, Math.PI * 2);
      g.stroke();
      if (rc.hit >= 0) {
        const b = B[rc.hit];
        let nx = b.x - gx;
        let ny = b.y - gy;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        const len = 8 + 22 * p * (b.kind === 'ball' ? 1.3 : 0.8);
        g.strokeStyle = b.kind === 'ball' ? 'rgba(247,215,116,0.95)' : 'rgba(255,255,255,0.7)';
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(b.x + nx * b.r, b.y + ny * b.r);
        g.lineTo(b.x + nx * (b.r + len), b.y + ny * (b.r + len));
        g.stroke();
      }
    }
    // arrow
    const r0 = CAP_R + 0.6;
    const len = 5 + 20 * p;
    const tipX = cx + ux * (r0 + len);
    const tipY = cy + uy * (r0 + len);
    const px = -uy;
    const py = ux;
    const w0 = 0.9;
    const w1 = 1.6 + p * 0.6;
    const hl = 3.2;
    const bx = tipX - ux * hl;
    const by = tipY - uy * hl;
    const grd = g.createLinearGradient(cx + ux * r0, cy + uy * r0, tipX, tipY);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, col);
    g.fillStyle = grd;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 0.3;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(cx + ux * r0 + px * w0, cy + uy * r0 + py * w0);
    g.lineTo(bx + px * w0 * 1.3, by + py * w0 * 1.3);
    g.lineTo(bx + px * w1 * 1.4, by + py * w1 * 1.4);
    g.lineTo(tipX, tipY);
    g.lineTo(bx - px * w1 * 1.4, by - py * w1 * 1.4);
    g.lineTo(bx - px * w0 * 1.3, by - py * w0 * 1.3);
    g.lineTo(cx + ux * r0 - px * w0, cy + uy * r0 - py * w0);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  function drawHint(time) {
    const idx = 4; // a forward of team 0
    const c = B[idx];
    const k = (time % 1.8) / 1.8;
    const pull = Math.min(1, k / 0.7);
    const fx = c.x;
    const fy = c.y + pull * 16;
    if (k < 0.7) drawAim(idx, -Math.PI / 2, pull * 0.75, false);
    g.save();
    g.globalAlpha = k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15;
    g.font = '9px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText('👆', fx, fy - 1);
    g.restore();
  }

  function draw(now) {
    if (!lay || !stat) return;
    const time = now / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // camera
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 6 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 6 : 0;
    g.translate(sx, sy);
    if (cam.z !== 1) {
      g.translate(cam.fx, cam.fy);
      g.scale(cam.z, cam.z);
      g.translate(-cam.fx, -cam.fy);
    }
    g.drawImage(stat, 0, 0, lay.cw, lay.ch);
    g.translate(lay.ox, lay.oy);
    g.scale(lay.s, lay.s);
    const s = lay.s;

    // kick shockwaves
    for (const r of rings) {
      const k = r.t / 0.5;
      g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
      g.lineWidth = 0.6;
      g.beginPath();
      g.arc(r.x, r.y, CAP_R + 1 + k * (6 + r.p * 8), 0, Math.PI * 2);
      g.stroke();
    }

    // ball trail
    const bx = dispX(0);
    const by = dispY(0);
    const bsp = Math.hypot(B[0].vx, B[0].vy);
    rollBall(pts, bx - ballDraw.x, by - ballDraw.y, BALL_R);
    ballDraw = { x: bx, y: by };
    if (bsp > 70 && (state === 'moving' || state === 'goal')) trail.push({ x: bx, y: by });
    else if (trail.length) trail.shift();
    if (trail.length > 16) trail.shift();
    if (trail.length > 1) {
      g.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const k = i / trail.length;
        g.strokeStyle = `rgba(${skin.trail},${0.45 * k})`;
        g.lineWidth = BALL_R * 2 * k * 0.9;
        g.beginPath();
        g.moveTo(trail[i - 1].x, trail[i - 1].y);
        g.lineTo(trail[i].x, trail[i].y);
        g.stroke();
      }
    }

    // active team glow under caps
    const humanAim = state === 'aim' && !isCpu(turn);
    if (state === 'aim') {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      for (let i = 1 + turn * 5; i < 6 + turn * 5; i++) {
        const grd = g.createRadialGradient(B[i].x, B[i].y, CAP_R * 0.9, B[i].x, B[i].y, CAP_R + 2.4);
        grd.addColorStop(0, `rgba(247,215,116,${0.35 + 0.25 * pulse})`);
        grd.addColorStop(1, 'rgba(247,215,116,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(B[i].x, B[i].y, CAP_R + 2.4, 0, Math.PI * 2);
        g.fill();
      }
    }

    // caps
    for (let i = 1; i < B.length; i++) {
      const sp = sprites[i <= 5 ? 0 : 1];
      if (!sp) continue;
      const x = dispX(i);
      const y = dispY(i);
      const sel = drag && drag.idx === i;
      const k = sel ? 1.08 : 1;
      const hs = (sp.half / s) * k;
      g.drawImage(sp.canvas, x - hs, y - hs, (sp.size / s) * k, (sp.size / s) * k);
    }

    // ball
    drawBall(g, bx, by, BALL_R, pts, o.ball);

    // nets & frames above everything on the pitch
    drawGoals(g, ripple, time);

    // turn timer rings
    if (humanAim) {
      const f = Math.max(0, timer / TURN_TIME);
      const col = f > 0.34 ? '#f7d774' : f > 0.15 ? '#ff9f43' : '#ff4d4d';
      for (let i = 1 + turn * 5; i < 6 + turn * 5; i++) {
        if (drag && drag.idx !== i) continue;
        g.lineWidth = 0.55;
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.arc(B[i].x, B[i].y, CAP_R + 0.85, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = col;
        g.beginPath();
        g.arc(B[i].x, B[i].y, CAP_R + 0.85, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
        g.stroke();
      }
    }

    // aiming
    if (drag && state === 'aim') {
      const sh = dragShot();
      if (sh.p >= MIN_POWER * 0.6) drawAim(drag.idx, sh.a, sh.p, true);
    } else if (state === 'aim' && ai && ai.res && stateT >= 0.75) {
      const k = Math.min(1, ai.aimT / 0.45);
      drawAim(ai.res.idx, ai.res.a, ai.res.p * k, false);
    } else if (humanAim && o.hint && shots === 0 && turn === 0) {
      drawHint(time);
    }

    // CPU thinking dots
    if (state === 'aim' && ai && (!ai.res || stateT < 0.75)) {
      const team = turn;
      const c = B[team === 0 ? 1 : 6];
      for (let i = 0; i < 3; i++) {
        const a = 0.4 + 0.6 * Math.max(0, Math.sin(time * 6 - i * 0.7));
        g.fillStyle = `rgba(247,215,116,${a})`;
        g.beginPath();
        g.arc(c.x - 2.4 + i * 2.4, c.y + (team === 1 ? -CAP_R - 3 : CAP_R + 3), 0.8, 0, Math.PI * 2);
        g.fill();
      }
    }

    // particles
    for (const p of parts) {
      const k = 1 - p.t / p.life;
      g.globalAlpha = Math.max(0, Math.min(1, k * 1.5));
      g.fillStyle = p.color;
      if (p.conf) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.restore();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // slow-motion letterbox tint
    if (timeScale < 0.95) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = (1 - timeScale) / 0.7;
      const grd = g.createRadialGradient(lay.cw / 2, lay.ch / 2, Math.min(lay.cw, lay.ch) * 0.35, lay.cw / 2, lay.ch / 2, Math.max(lay.cw, lay.ch) * 0.7);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, `rgba(0,0,0,${0.45 * k})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, lay.cw, lay.ch);
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - (last || now)) / 1000));
    last = now;
    if (!paused && state !== 'loading') update(dt);
    draw(now);
  }

  // ---------- start ----------
  Promise.all([loadFlag(o.teams[0]), loadFlag(o.teams[1])]).then((imgs) => {
    if (destroyed) return;
    flags = imgs;
    resize();
    updateBoard();
    kickoff();
  });
  updateBoard();
  raf = requestAnimationFrame(frame);

  return {
    pause() {
      paused = true;
      drag = null;
    },
    resume() {
      paused = false;
      last = 0;
    },
    get over() {
      return state === 'over';
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(bannerTimer);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('lostpointercapture', onCancel);
      ai = null;
      el.remove();
    },
  };
}

export { SIDES };
