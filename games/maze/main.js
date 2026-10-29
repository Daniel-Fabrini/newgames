// Tilt Maze — roll a steel ball through endless procedural mazes by tilting the phone (or dragging / arrows).
// Modes (ctx.mode): undefined -> menu, 'classic' -> campaign (continue), 'daily' -> today's maze, 'timed' -> time attack.
import STRINGS from './strings.js';
import * as M from './logic.js';
import { createBoard } from './render.js';

const ICON = {
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.4" height="14" rx="1.2" fill="currentColor"/><rect x="13.6" y="5" width="4.4" height="14" rx="1.2" fill="currentColor"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  touch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.6 1.6 0 0 1 3.2 0V11m0-1.2a1.6 1.6 0 0 1 3.2.2v1.4m0-.8a1.6 1.6 0 0 1 3.2.3V15c0 3.5-2.2 6-5.8 6-2.7 0-4.2-1.4-5.5-3.6L5 13.4a1.5 1.5 0 0 1 2.4-1.7L9 13.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sndOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sndOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (s) => (Math.round(s * 10) / 10).toFixed(1);
const PAGE = 30;

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const { h, clear, toast, modal } = ctx.ui;
  const store = ctx.store;
  const safeGet = (k, d) => {
    try {
      return store.get(k, d);
    } catch {
      return d;
    }
  };
  const safeSet = (k, v) => {
    try {
      store.set(k, v);
    } catch {
      /* storage unavailable */
    }
  };
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ saved data
  const prog = { level: 1, stars: {}, best: {}, ...(safeGet('prog', null) || {}) };
  const daily = { last: null, streak: 0, days: {}, ...(safeGet('daily', null) || {}) };
  const timedRec = { best: 0, runs: 0, ...(safeGet('timed', null) || {}) };
  const ctl = { sensor: 'auto', ...(safeGet('ctl', null) || {}) };
  const saveProg = () => safeSet('prog', prog);

  // ------------------------------------------------------------------ DOM
  const app = h('div', { class: 'g-maze-app' });
  const hud = h('div', { class: 'g-maze-hud' });
  const stage = h('div', { class: 'g-maze-stage' });
  const boardEl = h('div', { class: 'g-maze-board' });
  const canvas = h('canvas', { class: 'g-maze-canvas', role: 'img', 'aria-label': t('boardLabel') });
  boardEl.append(canvas);
  stage.append(boardEl);
  const readyMsg = h('div', { class: 'g-maze-ready', hidden: true });
  const joy = h('div', { class: 'g-maze-joy', hidden: true }, h('i'));
  const bottom = h('div', { class: 'g-maze-bottom' });
  const banner = h('div', { class: 'g-maze-banner', hidden: true });
  const menu = h('div', { class: 'g-maze-menu', hidden: true });
  const pauseEl = h('div', { class: 'g-maze-pause', hidden: true });
  app.append(hud, stage, readyMsg, joy, bottom, banner, menu, pauseEl);
  root.append(app);
  const board = createBoard(canvas);

  // ------------------------------------------------------------------ audio
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const sfx = {
    play: (n) => active() && ctx.sfx.play(n),
    tone: (o) => active() && ctx.sfx.tone(o),
    noise: (o) => active() && ctx.sfx.noise(o),
    vibrate: (p) => active() && ctx.sfx.vibrate(p),
  };
  const sndBtn = h('button', { class: 'g-maze-snd', type: 'button', onclick: () => {
    ctx.sfx.muted = !ctx.sfx.muted;
    refreshSnd();
    if (!ctx.sfx.muted) sfx.play('select');
  } });
  function refreshSnd() {
    const on = !ctx.sfx.muted;
    sndBtn.innerHTML = on ? ICON.sndOn : ICON.sndOff;
    sndBtn.setAttribute('aria-label', on ? t('soundOn') : t('soundOff'));
    sndBtn.setAttribute('aria-pressed', String(on));
    sndBtn.title = t('sound');
  }
  refreshSnd();
  ctx.setHeaderRight(sndBtn);

  // ------------------------------------------------------------------ state
  let alive = true;
  let mode = null;
  let phase = 'menu'; // menu | play | paused | won | over
  let level = null;
  let levelNo = 1;
  let ball = null;
  let fx = [];
  let tilt = { x: 0, y: 0 };
  let uiTime = 0;
  let wonT = 0;
  let timed = null; // { bank, cleared, score }
  let dailyInfo = null;
  let lastRoll = 0;
  let lastHud = '';
  let lastPos = [0, 0];
  let cellPx = 40;
  let pageIdx = Math.floor((prog.level - 1) / PAGE);

  // ------------------------------------------------------------------ input: stick, keys, sensor
  const stick = { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const keys = { x: 0, y: 0, down: new Set() };
  const sensor = { avail: false, needPerm: false, enabled: false, gx: 0, gy: 0, n0x: 0, n0y: 0, hasNeutral: false, fx: 0, fy: 0, x: 0, y: 0, seen: 0 };
  if (typeof window.DeviceOrientationEvent !== 'undefined') {
    sensor.needPerm = typeof window.DeviceOrientationEvent.requestPermission === 'function';
  }
  const screenAngle = () => {
    const a = (screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : window.orientation) || 0;
    return ((a % 360) + 360) % 360;
  };
  const onOrient = (e) => {
    if (e.beta == null || e.gamma == null) return;
    const b = e.beta, g = e.gamma;
    let gx, gy;
    switch (screenAngle()) {
      case 90: gx = b; gy = -g; break;
      case 180: gx = -g; gy = -b; break;
      case 270: gx = -b; gy = g; break;
      default: gx = g; gy = b;
    }
    sensor.gx = gx;
    sensor.gy = gy;
    sensor.seen++;
    if (!sensor.avail) {
      sensor.avail = true;
      if (ctl.sensor !== 'off') sensor.enabled = true;
      renderBottom();
    }
    if (!sensor.hasNeutral) calibrate(true);
  };
  function calibrate(silent) {
    sensor.n0x = sensor.gx;
    sensor.n0y = sensor.gy;
    sensor.fx = sensor.fy = 0;
    sensor.hasNeutral = true;
    if (!silent) {
      toast(t('calibrated'));
      sfx.play('select');
    }
  }
  async function enableSensor() {
    if (sensor.needPerm) {
      try {
        const r = await window.DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') {
          toast(t('sensorDenied'));
          return;
        }
      } catch {
        toast(t('sensorDenied'));
        return;
      }
    }
    ctl.sensor = 'auto';
    safeSet('ctl', ctl);
    sensor.enabled = true;
    sensor.hasNeutral = false;
    setTimeout(() => {
      if (alive && !sensor.avail) toast(t('sensorNone'));
    }, 1200);
    renderBottom();
  }
  window.addEventListener('deviceorientation', onOrient);

  const MAXDEG = 17;
  function readTilt(dt) {
    let x = 0, y = 0;
    if (stick.on) {
      x = stick.x;
      y = stick.y;
    } else if (sensor.enabled && sensor.avail && sensor.hasNeutral) {
      // low-pass the raw angles, then map the deviation from the calibrated pose to [-1, 1]
      const k = Math.min(1, dt * 14);
      sensor.fx += (sensor.gx - sensor.n0x - sensor.fx) * k;
      sensor.fy += (sensor.gy - sensor.n0y - sensor.fy) * k;
      const dz = (v) => (Math.abs(v) < 1.2 ? 0 : v - Math.sign(v) * 1.2);
      x = clamp(dz(sensor.fx) / MAXDEG, -1, 1);
      y = clamp(dz(sensor.fy) / MAXDEG, -1, 1);
    }
    const kx = (keys.down.has('ArrowRight') || keys.down.has('d') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('a') ? 1 : 0);
    const ky = (keys.down.has('ArrowDown') || keys.down.has('s') ? 1 : 0) - (keys.down.has('ArrowUp') || keys.down.has('w') ? 1 : 0);
    keys.x += (kx - keys.x) * Math.min(1, dt * 9);
    keys.y += (ky - keys.y) * Math.min(1, dt * 9);
    x += keys.x;
    y += keys.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  const R_STICK = 62;
  const onPointerDown = (e) => {
    if (phase !== 'play' || e.target.closest('button, .g-maze-pause, .g-maze-menu')) return;
    if (stick.on) return;
    const r = app.getBoundingClientRect();
    stick.on = true;
    stick.id = e.pointerId;
    stick.ox = e.clientX - r.left;
    stick.oy = e.clientY - r.top;
    stick.x = stick.y = 0;
    joy.hidden = false;
    joy.style.left = stick.ox + 'px';
    joy.style.top = stick.oy + 'px';
    joy.firstChild.style.transform = 'translate(0px,0px)';
    try { app.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e) => {
    if (!stick.on || e.pointerId !== stick.id) return;
    const r = app.getBoundingClientRect();
    let dx = e.clientX - r.left - stick.ox, dy = e.clientY - r.top - stick.oy;
    const l = Math.hypot(dx, dy);
    const k = l > R_STICK ? R_STICK / l : 1;
    // gentle response curve
    const m = Math.min(1, l / R_STICK);
    const curve = m < 0.12 ? 0 : Math.pow((m - 0.12) / 0.88, 1.15);
    stick.x = (dx / (l || 1)) * curve;
    stick.y = (dy / (l || 1)) * curve;
    joy.firstChild.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  };
  const onPointerUp = (e) => {
    if (!stick.on || e.pointerId !== stick.id) return;
    stick.on = false;
    stick.x = stick.y = 0;
    joy.hidden = true;
  };
  app.addEventListener('pointerdown', onPointerDown);
  app.addEventListener('pointermove', onPointerMove);
  app.addEventListener('pointerup', onPointerUp);
  app.addEventListener('pointercancel', onPointerUp);
  app.style.touchAction = 'none';

  const onKeyDown = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) {
      if (phase === 'play') e.preventDefault();
      keys.down.add(k);
    } else if (k === 'r' && (phase === 'play' || phase === 'paused')) restartLevel();
    else if (k === 'p' || k === 'Escape') {
      if (phase === 'play') pause();
      else if (phase === 'paused') resume();
    }
  };
  const onKeyUp = (e) => keys.down.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  const onVis = () => {
    if (document.hidden && phase === 'play') pause();
  };
  document.addEventListener('visibilitychange', onVis);

  // ------------------------------------------------------------------ layout
  function layout() {
    const w = root.clientWidth, hgt = root.clientHeight;
    if (!w || !hgt || !level) return;
    const topPad = hud.offsetHeight + 14;
    const botPad = (bottom.offsetHeight || 64) + 16;
    const availW = w - 22, availH = hgt - topPad - botPad;
    const cp = Math.max(18, Math.floor(Math.min(availW / level.width, availH / level.height)));
    cellPx = cp;
    board.setLevel(level, cp, Math.min(window.devicePixelRatio || 1, 2));
    stage.style.top = topPad + 'px';
    stage.style.bottom = botPad + 'px';
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(root);

  // ------------------------------------------------------------------ level lifecycle
  const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

  function loadLevel(n, opts = {}) {
    levelNo = n;
    if (mode === 'daily') {
      const d = new Date();
      const dn = 6 + (dayOfYear(d) % 20);
      level = M.buildLevel(M.dailySeed(d), M.levelParams(dn));
      dailyInfo = { key: M.dayKey(d), n: dn };
    } else {
      level = M.buildLevel(M.levelSeed(n), M.levelParams(n));
    }
    ball = M.newBall(level);
    fx = [];
    tilt = { x: 0, y: 0 };
    lastPos = [ball.x, ball.y];
    wonT = 0;
    stick.on = false;
    joy.hidden = true;
    clear(menu);
    menu.hidden = true;
    pauseEl.hidden = true;
    phase = 'play';
    layout();
    buildHud();
    renderBottom();
    readyMsg.hidden = false;
    readyMsg.textContent = sensor.enabled && sensor.avail ? t('ready') : t('readyTouch');
    if (sensor.hasNeutral) calibrate(true);
    if (!opts.silent && mode === 'timed' && timed) bannerShow(t('level', { n: timed.cleared + 1 }));
  }

  function startMode(m, n) {
    mode = m;
    if (m === 'classic') loadLevel(n || prog.level);
    else if (m === 'daily') loadLevel(1);
    else if (m === 'timed') {
      timed = { bank: 55, cleared: 0, score: 0 };
      loadLevel(1, { silent: true });
    }
  }

  function restartLevel() {
    if (phase === 'won' || phase === 'over' || phase === 'menu') return;
    const keepTimed = mode === 'timed' ? timed : null;
    loadLevel(levelNo, { silent: true });
    timed = keepTimed;
  }

  function pause() {
    if (phase !== 'play') return;
    phase = 'paused';
    stick.on = false;
    joy.hidden = true;
    clear(pauseEl);
    pauseEl.hidden = false;
    pauseEl.append(
      h(
        'div',
        { class: 'g-maze-pause-card' },
        h('h2', null, t('paused')),
        h('button', { class: 'btn primary big block', type: 'button', onclick: resume }, t('resume')),
        h('button', { class: 'btn big block', type: 'button', onclick: () => { restartLevel(); } }, t('restart')),
        h('button', { class: 'btn big block', type: 'button', onclick: () => { showMenu(); } }, t('toMenu')),
      ),
    );
  }
  function resume() {
    if (phase !== 'paused') return;
    pauseEl.hidden = true;
    phase = 'play';
  }

  // ------------------------------------------------------------------ HUD
  const pills = {};
  function buildHud() {
    clear(hud);
    const pill = (key, label, cls = '') => {
      const el = h('div', { class: 'g-maze-pill ' + cls }, h('small', null, label), h('b', null, '–'));
      pills[key] = el;
      return el;
    };
    const first = mode === 'daily' ? t('daily') : mode === 'timed' ? t('timed') : t('level', { n: levelNo });
    pills.lv = h('div', { class: 'g-maze-pill lv' }, h('small', null, mode === 'timed' ? t('levelsCleared', { n: timed ? timed.cleared : 0 }) : mode === 'daily' ? M.dayKey() : ' '), h('b', null, mode === 'classic' ? t('level', { n: levelNo }) : first));
    hud.append(pills.lv, pill('time', mode === 'timed' ? t('time') : t('time')), pill('falls', t('falls')), pill('par', t('par')));
    lastHud = '';
    updateHud(true);
  }
  function updateHud(force) {
    if (!pills.time || !ball) return;
    let timeStr, timeCls = '';
    if (mode === 'timed' && timed) {
      timeStr = Math.max(0, timed.bank).toFixed(1);
      timeCls = timed.bank < 10 ? 'low' : '';
    } else timeStr = fmt(ball.time);
    const key = [timeStr, ball.falls, levelNo, timed && timed.cleared].join('|');
    if (!force && key === lastHud) return;
    lastHud = key;
    pills.time.querySelector('b').textContent = timeStr;
    pills.time.classList.toggle('low', timeCls === 'low');
    pills.falls.querySelector('b').textContent = String(ball.falls);
    pills.par.querySelector('b').textContent = fmt(level.par);
    if (mode === 'timed' && timed) pills.lv.querySelector('small').textContent = t('levelsCleared', { n: timed.cleared });
  }

  function renderBottom() {
    clear(bottom);
    if (phase === 'menu') return;
    const mk = (cls, icon, label, on, extra = {}) => h('button', { class: 'g-maze-btn ' + cls, type: 'button', 'aria-label': label, title: label, onclick: on, ...extra }, h('span', { html: icon }), h('em', null, label));
    bottom.append(mk('', ICON.restart, t('restart'), restartLevel));
    const mid = h('div', { class: 'g-maze-mid' });
    const sensorOn = sensor.enabled && sensor.avail;
    if (sensor.avail || sensor.needPerm || true) {
      mid.append(
        mk(sensorOn ? 'on' : '', sensorOn ? ICON.phone : ICON.touch, sensorOn ? t('ctlTilt') : t('ctlTouch'), () => {
          if (sensor.avail) {
            sensor.enabled = !sensor.enabled;
            ctl.sensor = sensor.enabled ? 'auto' : 'off';
            safeSet('ctl', ctl);
            if (sensor.enabled) calibrate(true);
            toast(sensor.enabled ? t('sensorOn') : t('sensorOff'));
            renderBottom();
          } else enableSensor();
        }),
      );
    }
    if (sensorOn) mid.append(mk('', ICON.target, t('calibrate'), () => calibrate(false)));
    bottom.append(mid, mk('', ICON.pause, t('pause'), pause));
  }

  let bannerTimer = 0;
  function bannerShow(text) {
    banner.textContent = text;
    banner.hidden = false;
    banner.classList.remove('go');
    void banner.offsetWidth;
    banner.classList.add('go');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (banner.hidden = true), 1500);
  }

  // ------------------------------------------------------------------ events from the physics
  let lastKnock = 0;
  function handleEvents(events) {
    const now = performance.now();
    for (const e of events) {
      if (e.type === 'hit') {
        if (now - lastKnock > 45) {
          lastKnock = now;
          const v = clamp(e.v, 1, 8);
          sfx.tone({ freq: 200 + v * 28, to: 120 + v * 10, dur: 0.07, type: 'triangle', vol: 0.05 + v * 0.03 });
          sfx.noise({ dur: 0.04, vol: 0.03 + v * 0.015, freq: 1800, q: 1.3 });
          if (v > 3) sfx.vibrate(Math.round(8 + v * 2));
        }
      } else if (e.type === 'bumper') {
        sfx.tone({ freq: 420, to: 880, dur: 0.1, type: 'sine', vol: 0.3 });
        sfx.vibrate(14);
        fx.push({ x: ball.x, y: ball.y, age: 0, life: 0.4, size: 0.5, color: '#ff8a7a' });
      } else if (e.type === 'boost') {
        sfx.play('whoosh');
        sfx.vibrate(16);
        fx.push({ x: ball.x, y: ball.y, age: 0, life: 0.5, size: 0.6, color: '#7dffb0' });
      } else if (e.type === 'fall') {
        sfx.tone({ freq: 520, to: 90, dur: 0.5, type: 'sine', vol: 0.35 });
        sfx.vibrate([30, 30, 60]);
      } else if (e.type === 'respawn') {
        sfx.play('pop');
        fx.push({ x: ball.x, y: ball.y, age: 0, life: 0.55, size: 0.7, color: '#ffe08a' });
      } else if (e.type === 'checkpoint') {
        sfx.play('coin');
        sfx.vibrate(20);
        fx.push({ x: ball.x, y: ball.y, age: 0, life: 0.7, size: 0.9, color: '#7dffb0' });
        bannerShow(t('checkpoint'));
      } else if (e.type === 'goal') {
        onGoal();
      }
    }
  }

  function onGoal() {
    if (phase !== 'play') return;
    phase = 'won';
    wonT = 0;
    sfx.play('win');
    sfx.vibrate([40, 40, 40, 40, 120]);
    const [gx, gy] = M.cellCentre(level.maze, level.goal);
    for (let i = 0; i < 3; i++) fx.push({ x: gx, y: gy, age: -i * 0.12, life: 0.9, size: 1.2 + i * 0.5, color: '#ffe08a' });
    readyMsg.hidden = true;
    setTimeout(() => alive && phase === 'won' && finishLevel(), mode === 'timed' ? 650 : 900);
  }

  async function finishLevel() {
    const time = ball.time;
    const stars = M.starsFor(time, level.par);
    if (mode === 'timed') {
      const bonus = Math.round(8 + level.par * 0.55);
      timed.bank += bonus;
      timed.cleared++;
      timed.score += 100 + stars * 20 + Math.max(0, Math.round(level.par - time) * 2);
      toast(t('bonusTime', { n: bonus }));
      sfx.play('success');
      loadLevel(levelNo + 1, { silent: false });
      return;
    }
    let newBest = false;
    if (mode === 'classic') {
      if ((prog.stars[levelNo] || 0) < stars) prog.stars[levelNo] = stars;
      if (!prog.best[levelNo] || time < prog.best[levelNo]) {
        newBest = !!prog.best[levelNo];
        prog.best[levelNo] = Math.round(time * 10) / 10;
      }
      prog.level = Math.max(prog.level, levelNo + 1);
      saveProg();
      ctx.addXP?.(6 + stars * 4 + Math.min(10, Math.floor(levelNo / 5)));
    } else if (mode === 'daily') {
      const key = dailyInfo.key;
      const old = daily.days[key];
      if (!old || time < old.time) {
        newBest = !!old;
        daily.days[key] = { time: Math.round(time * 10) / 10, stars };
      }
      if (!old) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        daily.streak = daily.last === M.dayKey(y) ? daily.streak + 1 : daily.last === key ? daily.streak : 1;
        daily.last = key;
        ctx.addXP?.(18 + Math.min(20, daily.streak * 2));
      }
      safeSet('daily', daily);
    }
    if (stars === 3) ctx.ui.confetti?.();
    const starsEl = h('div', { class: 'g-maze-stars' }, [1, 2, 3].map((i) => h('span', { class: 'g-maze-star' + (i <= stars ? ' on' : ''), style: { animationDelay: 0.15 * i + 's' } }, '★')));
    const body = h(
      'div',
      { class: 'g-maze-result' },
      starsEl,
      h('p', { class: 'big' }, t('yourTime', { t: fmt(time) })),
      newBest ? h('p', { class: 'newbest' }, t('newBest')) : null,
      h('p', { class: 'muted' }, t('parTime', { t: fmt(level.par) }) + ' · ' + t('fallsN', { n: ball.falls })),
      mode === 'daily' && daily.streak ? h('p', { class: 'muted' }, t('streak', { n: daily.streak })) : null,
    );
    const actions =
      mode === 'classic'
        ? [{ label: t('next'), value: 'next', primary: true }, { label: t('retry'), value: 'retry' }, { label: t('toMenu'), value: 'menu' }]
        : [{ label: t('dailyAgain'), value: 'retry', primary: true }, { label: t('toMenu'), value: 'menu' }];
    const res = await modal({ title: mode === 'daily' ? t('dailyDone') : t('levelComplete'), body, actions, dismissible: false });
    if (!alive) return;
    if (res === 'next') loadLevel(levelNo + 1, { silent: true });
    else if (res === 'retry') loadLevel(levelNo, { silent: true });
    else showMenu();
  }

  async function timeUp() {
    if (phase === 'over') return;
    phase = 'over';
    sfx.play('lose');
    sfx.vibrate([80, 40, 80]);
    readyMsg.hidden = true;
    timedRec.runs++;
    const nb = timed.cleared > timedRec.best;
    if (nb) timedRec.best = timed.cleared;
    safeSet('timed', timedRec);
    ctx.addXP?.(clamp(5 + timed.cleared * 5, 5, 70));
    const body = h(
      'div',
      { class: 'g-maze-result' },
      h('p', { class: 'big' }, t('timedResult', { n: timed.cleared })),
      h('p', null, t('timedScore', { n: timed.score })),
      nb && timed.cleared > 0 ? h('p', { class: 'newbest' }, t('newBest')) : h('p', { class: 'muted' }, t('best') + ': ' + timedRec.best),
    );
    if (nb && timed.cleared > 0) ctx.ui.confetti?.();
    const res = await modal({ title: t('timeUp'), body, actions: [{ label: t('playAgain'), value: 'again', primary: true }, { label: t('toMenu'), value: 'menu' }], dismissible: false });
    if (!alive) return;
    if (res === 'again') startMode('timed');
    else showMenu();
  }

  // ------------------------------------------------------------------ menu
  function showMenu() {
    phase = 'menu';
    stick.on = false;
    joy.hidden = true;
    readyMsg.hidden = true;
    pauseEl.hidden = true;
    clear(hud);
    clear(bottom);
    pills.time = null;
    ctx.setTitle?.();
    menu.hidden = false;
    // a calm backdrop board
    if (!level) {
      mode = 'classic';
      level = M.buildLevel(M.levelSeed(prog.level), M.levelParams(prog.level));
      ball = M.newBall(level);
      layout();
    }
    renderMenu();
  }

  function renderMenu() {
    clear(menu);
    const todayKey = M.dayKey();
    const todayRec = daily.days[todayKey];
    const maxLv = prog.level;
    const pages = Math.max(1, Math.ceil((maxLv + 3) / PAGE));
    if (pageIdx >= pages) pageIdx = pages - 1;
    const first = pageIdx * PAGE + 1;
    const grid = h('div', { class: 'level-grid g-maze-grid' });
    for (let i = first; i < first + PAGE; i++) {
      const done = prog.stars[i] > 0;
      const unlocked = i <= maxLv;
      grid.append(
        h(
          'button',
          { class: 'level-btn' + (done ? ' done' : '') + (i === maxLv ? ' current' : '') + (!unlocked ? ' locked' : ''), type: 'button', disabled: !unlocked, 'aria-label': t('level', { n: i }), onclick: () => startMode('classic', i) },
          String(i),
          h('small', null, done ? '★'.repeat(prog.stars[i]) + '☆'.repeat(3 - prog.stars[i]) : unlocked ? '·' : '🔒'),
        ),
      );
    }
    const card = h(
      'div',
      { class: 'g-maze-menu-card' },
      h('h2', { class: 'g-maze-title' }, t('menuTitle')),
      h('p', { class: 'muted g-maze-sub' }, t('menuSub')),
      h('button', { class: 'btn primary big block', type: 'button', onclick: () => startMode('classic', prog.level) }, prog.level > 1 ? t('continueLevel', { n: prog.level }) : t('startLevel', { n: 1 })),
      h(
        'div',
        { class: 'g-maze-modes' },
        h(
          'button',
          { class: 'g-maze-mode', type: 'button', onclick: () => startMode('daily') },
          h('b', null, '📅 ' + t('daily')),
          h('small', null, todayRec ? t('bestToday') + ': ' + fmt(todayRec.time) + 's ' + '★'.repeat(todayRec.stars) : t('dailySub')),
          daily.streak ? h('small', { class: 'gold' }, t('streak', { n: daily.streak })) : null,
        ),
        h('button', { class: 'g-maze-mode', type: 'button', onclick: () => startMode('timed') }, h('b', null, '⏱️ ' + t('timed')), h('small', null, timedRec.best ? t('best') + ': ' + t('levelsCleared', { n: timedRec.best }) : t('timedSub'))),
      ),
      h('div', { class: 'g-maze-label' }, t('levels')),
      grid,
      h(
        'div',
        { class: 'g-maze-pager' },
        h('button', { class: 'chip', type: 'button', disabled: pageIdx === 0, onclick: () => { pageIdx--; renderMenu(); }, 'aria-label': '‹' }, '‹'),
        h('span', null, t('page', { n: pageIdx + 1 })),
        h('button', { class: 'chip', type: 'button', disabled: pageIdx >= pages - 1, onclick: () => { pageIdx++; renderMenu(); }, 'aria-label': '›' }, '›'),
      ),
      h(
        'div',
        { class: 'g-maze-ctl' },
        h('div', { class: 'g-maze-label' }, t('controls')),
        h(
          'div',
          { class: 'chips g-maze-chips' },
          h('button', { class: 'chip' + (sensor.enabled && sensor.avail ? ' active' : ''), type: 'button', onclick: async () => {
            if (sensor.avail) {
              sensor.enabled = !sensor.enabled;
              ctl.sensor = sensor.enabled ? 'auto' : 'off';
              safeSet('ctl', ctl);
              toast(sensor.enabled ? t('sensorOn') : t('sensorOff'));
              renderMenu();
            } else {
              await enableSensor();
              if (!sensor.avail && !sensor.needPerm) toast(t('sensorNone'));
              renderMenu();
            }
          } }, '📱 ' + (sensor.avail || sensor.needPerm ? (sensor.enabled && sensor.avail ? t('sensorOn') : t('enableSensor')) : t('ctlTouch'))),
          h('button', { class: 'chip', type: 'button', onclick: () => calibrate(false) }, '🎯 ' + t('calibrate')),
        ),
      ),
      h('details', { class: 'g-maze-how' }, h('summary', null, t('howTo')), h('ul', null, [t('how1'), t('how2'), t('how3'), t('how4')].map((s) => h('li', null, s))), h('p', { class: 'small muted' }, t('keys'))),
    );
    menu.append(card);
  }

  // ------------------------------------------------------------------ main loop
  let raf = 0;
  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    let dt = Math.min(1 / 20, (now - last) / 1000);
    last = now;
    if (!level || !root.clientWidth) return;
    uiTime += dt;
    if (phase === 'menu' || phase === 'paused') {
      board.draw({ t: uiTime, ball, tilt: { x: 0, y: 0 }, fx });
      return;
    }
    const inp = readTilt(dt);
    // smooth what the board and the ball see
    const k = Math.min(1, dt * 18);
    tilt.x += (inp.x - tilt.x) * k;
    tilt.y += (inp.y - tilt.y) * k;
    if (phase === 'play') {
      const px = ball.x, py = ball.y;
      const ev = M.stepBall(level, ball, tilt.x, tilt.y, dt);
      if (ball.state === 'roll') board.roll(ball, ball.x - px, ball.y - py);
      if (ball.started && !readyMsg.hidden) readyMsg.hidden = true;
      handleEvents(ev);
      // rolling rumble
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp > 0.8 && ball.state === 'roll' && now - lastRoll > 90) {
        lastRoll = now;
        sfx.noise({ dur: 0.07, vol: Math.min(0.06, sp * 0.008), freq: 180 + sp * 45, q: 0.6 });
      }
      if (mode === 'timed' && timed && ball.started && phase === 'play') {
        timed.bank -= dt;
        if (timed.bank <= 0) {
          timed.bank = 0;
          timeUp();
        }
      }
    } else if (phase === 'won') {
      wonT += dt;
      // the ball is drawn into the goal
      const [gx, gy] = M.cellCentre(level.maze, level.goal);
      ball.x += (gx - ball.x) * Math.min(1, dt * 10);
      ball.y += (gy - ball.y) * Math.min(1, dt * 10);
    }
    for (const f of fx) f.age += dt;
    fx = fx.filter((f) => f.age < f.life);
    // board tilt in 3D (the canvas is a flat plane, CSS does the perspective)
    const amp = reduced ? 3.5 : 10;
    boardEl.style.transform = `rotateX(${(-tilt.y * amp).toFixed(2)}deg) rotateY(${(tilt.x * amp).toFixed(2)}deg)`;
    board.draw({ t: uiTime, ball, tilt, fx });
    updateHud();
  }

  ctx.onBack(() => {
    if (phase === 'menu') return false;
    if (phase === 'play') {
      pause();
      return true;
    }
    if (phase === 'paused') {
      showMenu();
      return true;
    }
    showMenu();
    return true;
  });

  root.__maze = { M, get level() { return level; }, get ball() { return ball; }, get state() { return { phase, mode, levelNo, tilt, timed }; }, sensor, startMode };

  // ------------------------------------------------------------------ start
  if (ctx.mode === 'classic' || ctx.mode === 'daily' || ctx.mode === 'timed') startMode(ctx.mode);
  else showMenu();
  raf = requestAnimationFrame(frame);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('deviceorientation', onOrient);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('visibilitychange', onVis);
    clearTimeout(bannerTimer);
    ctx.setHeaderRight(null);
  };
}
