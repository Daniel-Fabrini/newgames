// Block Tower — pull a block out of a 54-block wooden tower, stack it on top, don't let it fall.
// Modes (ctx.mode): undefined -> menu, 'solo' -> 1 player, 'duo' -> pass-and-play for 2.
import STRINGS from './strings.js';
import { createSim, DIFFICULTY, LAYERS, L } from './sim.js';
import { createRenderer } from './render.js';

const ICON = {
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.4 4.5l-.6 5.2 5-1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  pull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v13M6 12l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  push: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V7M6 12l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sndOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sndOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

const TAU = Math.PI * 2;
const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

  const rec = { best: { steady: 0, normal: 0, wobbly: 0 }, high: 0, games: 0, duoGames: 0, ...(safeGet('rec', null) || {}) };
  rec.best = { steady: 0, normal: 0, wobbly: 0, ...(rec.best || {}) };
  const prefs = { diff: 'normal', ...(safeGet('prefs', null) || {}) };
  if (!DIFFICULTY[prefs.diff]) prefs.diff = 'normal';
  const saveRec = () => safeSet('rec', rec);

  // ------------------------------------------------------------------ DOM
  const app = h('div', { class: 'g-stack-app' });
  const canvas = h('canvas', { class: 'g-stack-canvas', tabindex: '0', role: 'application', 'aria-label': t('canvasLabel') });
  const hudTop = h('div', { class: 'g-stack-hud' });
  const hint = h('div', { class: 'g-stack-hint', 'aria-live': 'polite' });
  const banner = h('div', { class: 'g-stack-banner', hidden: true });
  const bottom = h('div', { class: 'g-stack-bottom' });
  const menu = h('div', { class: 'g-stack-menu', hidden: true });
  app.append(canvas, hudTop, hint, banner, bottom, menu);
  root.append(app);

  const renderer = createRenderer(canvas);

  // ------------------------------------------------------------------ audio
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const sfx = {
    play: (n) => active() && ctx.sfx.play(n),
    tone: (o) => active() && ctx.sfx.tone(o),
    noise: (o) => active() && ctx.sfx.noise(o),
    vibrate: (p) => active() && ctx.sfx.vibrate(p),
  };
  let lastKnock = 0;
  function knock(speed, pos) {
    const now = performance.now();
    if (now - lastKnock < 38) return;
    lastKnock = now;
    const v = Math.min(0.5, 0.07 + speed * 0.035);
    const f = 120 + Math.random() * 90;
    sfx.tone({ freq: f * 1.7, to: f, dur: 0.07, type: 'triangle', vol: v });
    sfx.noise({ dur: 0.05, vol: v * 0.7, freq: 500 + Math.random() * 500, q: 1.6 });
    if (speed > 4 && pos) renderer.spawnDust(pos, Math.min(6, Math.round(speed)), 0.7);
  }

  // header: sound toggle (follows / updates the app setting)
  const sndBtn = h('button', { class: 'g-stack-snd', type: 'button', onclick: () => {
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

  // ------------------------------------------------------------------ game state
  let alive = true;
  let mode = ctx.mode === 'duo' ? 'duo' : 'solo';
  let diff = prefs.diff;
  let sim = null;
  let phase = 'menu'; // menu | select | pull | lift | settle | over
  let sel = null; // selected block
  let pulling = false;
  let scores = [0, 0];
  let player = 0;
  let moves = 0;
  let snapshot = null;
  let settleT = 0;
  let stableT = 0;
  let overT = 0;
  let overShown = false;
  let flash = null;
  let shake = 0;
  let outSign = 1;
  let hold = 0;
  let camAuto = true;
  let uz = 1; // user zoom
  let yawT = renderer.cam.yaw;
  let pitchT = 0.5;
  let zoomT = 1;
  let tyT = 5;
  let guideDir = 0;
  let menuSim = null;
  let simMs = 0;
  let quality = 0;
  let lastScrape = 0;
  let uiTime = 0;
  let dragStats = { perfect: false };

  const top = () => Math.max(0, sim ? sim.topLayerInfo().top : LAYERS - 1);

  function newSim(saved) {
    sim = createSim(diff, saved || null);
    sim.events.onImpact = (speed, blk) => knock(speed, blk ? blk.body.p : null);
    if (!saved) {
      // pre-settle silently so the first frame shows the tower at rest
      sim.settle(0.5);
      let k = 0;
      while (!sim.asleep && k++ < 240) sim.stepOnce();
    }
    quality = 0;
    sim.setQuality(0);
  }

  function resetState() {
    sel = null;
    pulling = false;
    scores = [0, 0];
    player = 0;
    moves = 0;
    snapshot = null;
    overShown = false;
    flash = null;
    shake = 0;
    hold = 0;
    camAuto = true;
    guideDir = 0;
    phase = 'select';
  }

  function startGame(saved) {
    clear(menu);
    menu.hidden = true;
    if (saved) {
      mode = saved.mode;
      diff = saved.diff;
      newSim(saved.sim);
      resetState();
      scores = saved.scores || [0, 0];
      player = saved.player || 0;
      moves = saved.moves || 0;
      toast(t('resumed'));
    } else {
      newSim(null);
      resetState();
      safeSet('save:' + mode, null);
    }
    prefs.diff = diff;
    safeSet('prefs', prefs);
    renderer.cam.ty = (top() * 0.604 + 0.6) * 0.5;
    tyT = renderer.cam.ty;
    zoomT = 1;
    renderer.cam.zoom = 1;
    buildHud();
    updateHud();
    if (mode === 'duo') showBanner(t('turnOf', { name: t('player', { n: player + 1 }) }));
  }

  function saveGame() {
    if (!sim || phase === 'over') return;
    safeSet('save:' + mode, { v: 1, mode, diff, sim: sim.serialize(), scores, player, moves });
  }

  // ------------------------------------------------------------------ HUD
  const pills = {};
  function buildHud() {
    clear(hudTop);
    pills.p0 = h('div', { class: 'g-stack-pill' }, h('small', null, mode === 'duo' ? t('player', { n: 1 }) : t('score')), h('b', null, '0'));
    pills.p1 = h('div', { class: 'g-stack-pill' }, h('small', null, mode === 'duo' ? t('player', { n: 2 }) : t('best')), h('b', null, '0'));
    pills.layers = h('div', { class: 'g-stack-pill mid' }, h('small', null, t('layers')), h('b', null, String(LAYERS)));
    hudTop.append(pills.p0, pills.layers, pills.p1);
    clear(bottom);
    const mk = (cls, icon, label, on) => h('button', { class: 'g-stack-btn ' + cls, type: 'button', 'aria-label': label, title: label, ...on }, h('span', { html: icon }), h('em', null, label));
    const restartBtn = mk('', ICON.restart, t('restart'), { onclick: askRestart });
    const camBtn = mk('', ICON.cam, t('resetCam'), { onclick: resetCamera });
    const holdBtn = (dir, icon, label) => {
      const b = mk('hold', icon, label, {});
      const on = (e) => {
        e.preventDefault();
        hold = dir;
        b.classList.add('on');
        try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      };
      const off = () => {
        if (hold === dir) hold = 0;
        b.classList.remove('on');
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      return b;
    };
    pills.pull = holdBtn(1, ICON.pull, t('pullOut'));
    pills.push = holdBtn(-1, ICON.push, t('pushIn'));
    const mid = h('div', { class: 'g-stack-holds' }, pills.push, pills.pull);
    pills.holds = mid;
    bottom.append(restartBtn, mid, camBtn);
  }

  function updateHud() {
    if (!pills.p0) return;
    const bestNow = rec.best[diff] || 0;
    if (mode === 'duo') {
      pills.p0.querySelector('b').textContent = String(scores[0]);
      pills.p1.querySelector('b').textContent = String(scores[1]);
      pills.p0.classList.toggle('act', player === 0 && phase !== 'over');
      pills.p1.classList.toggle('act', player === 1 && phase !== 'over');
    } else {
      pills.p0.querySelector('b').textContent = String(scores[0]);
      pills.p1.querySelector('b').textContent = String(Math.max(bestNow, scores[0]));
      pills.p0.classList.add('act');
    }
    pills.layers.querySelector('b').textContent = String(sim ? top() + 1 : LAYERS);
    const showHolds = !!sel && (phase === 'select' || phase === 'pull');
    pills.holds.classList.toggle('show', showHolds);
    let msg = '';
    if (phase === 'select') msg = sel ? t('hintPull') : t('hintSelect');
    else if (phase === 'pull') msg = t('hintPull');
    else if (phase === 'lift') msg = t('hintLift');
    else if (phase === 'settle') msg = t('hintSettle');
    else if (phase === 'over') msg = t('collapsed');
    if (hint.textContent !== msg) hint.textContent = msg;
    hint.hidden = phase === 'menu';
  }

  let bannerTimer = 0;
  function showBanner(text) {
    banner.textContent = text;
    banner.hidden = false;
    banner.classList.remove('go');
    void banner.offsetWidth;
    banner.classList.add('go');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (banner.hidden = true), 1600);
  }

  const floaters = new Set();
  function floatText(text, cls = '') {
    const el = h('div', { class: 'g-stack-float ' + cls }, text);
    app.append(el);
    floaters.add(el);
    setTimeout(() => {
      el.remove();
      floaters.delete(el);
    }, 1300);
  }

  // ------------------------------------------------------------------ camera
  function resetCamera() {
    camAuto = true;
    uz = 1;
    pitchT = 0.5;
    if (sel) alignToBlock(sel);
    else yawT = renderer.cam.yaw;
    sfx.play('tap');
  }

  function alignToBlock(b) {
    const a = b.body.ax[0];
    const len = Math.hypot(a[0], a[2]) || 1;
    const cur = [Math.sin(renderer.cam.yaw), Math.cos(renderer.cam.yaw)];
    let c = [a[0] / len, a[2] / len];
    if (c[0] * cur[0] + c[1] * cur[1] < 0) c = [-c[0], -c[1]];
    // look slightly off-axis so the neighbouring layers keep their depth
    const target = Math.atan2(c[0], c[1]) + 0.0;
    yawT = renderer.cam.yaw + angDiff(renderer.cam.yaw, target);
    outSign = c[0] * a[0] / len + c[1] * a[2] / len > 0 ? 1 : -1;
    // the camera sits on the +c side, so pulling towards the camera = moving along +c
    guideDir = outSign;
  }

  function cameraStep(dt) {
    const cam = renderer.cam;
    cam.vshift += (0 - cam.vshift) * Math.min(1, dt * 6);
    const k = Math.min(1, dt * 5);
    if (camAuto || sel) cam.yaw += angDiff(cam.yaw, yawT) * k;
    else yawT = cam.yaw;
    cam.pitch += (pitchT - cam.pitch) * k;
    let zt = zoomT * uz;
    let ty = tyT;
    cam.zoom += (zt - cam.zoom) * k;
    cam.ty += (ty - cam.ty) * k;
  }

  function cameraTargets() {
    const tp = top();
    const topY = tp * 0.604 + 0.6;
    if (phase === 'select' || phase === 'pull') {
      if (sel) {
        zoomT = 0.7;
        tyT = clamp(sel.body.p[1], 2.2, Math.max(3, topY - 1.5));
        pitchT = 0.46;
      } else {
        zoomT = 1;
        tyT = topY * 0.5;
        pitchT = 0.5;
      }
    } else if (phase === 'lift' || phase === 'settle') {
      zoomT = 0.82;
      tyT = Math.max(3, topY * 0.78);
    } else if (phase === 'over') {
      zoomT = 1.5;
      tyT = topY * 0.25;
      pitchT = 0.62;
    } else {
      zoomT = 1.05;
      tyT = topY * 0.5;
    }
  }

  // ------------------------------------------------------------------ interaction
  function canPlay() {
    return phase === 'select' || phase === 'pull';
  }

  function selectBlock(b) {
    if (!canPlay() || pulling) return;
    if (!b) {
      if (sel) {
        sel = null;
        guideDir = 0;
        updateHud();
      }
      return;
    }
    if (b === sel) return;
    if (!sim.canTake(b)) {
      flash = { b, t: 0 };
      toast(t('cantTake'));
      sfx.play('error');
      sfx.vibrate(25);
      return;
    }
    sel = b;
    sfx.play('select');
    sfx.vibrate(12);
    camAuto = true;
    alignToBlock(b);
    updateHud();
  }

  function cycleSelection(dir) {
    if (!canPlay() || pulling) return;
    const cands = sim.blocks.filter((b) => sim.canTake(b)).sort((a, b) => a.layer - b.layer || a.slot - b.slot);
    if (!cands.length) return;
    let i = sel ? cands.indexOf(sel) : -1;
    i = (i + dir + cands.length) % cands.length;
    selectBlock(cands[i]);
  }

  function beginPullIfNeeded() {
    if (pulling || !sel || !canPlay()) return false;
    pulling = true;
    phase = 'pull';
    snapshot = sim.blocks.filter((b) => b !== sel).map((b) => [b, b.body.p[0], b.body.p[1], b.body.p[2]]);
    sim.beginPull(sel);
    updateHud();
    return true;
  }

  function releasePull() {
    if (!pulling) return;
    pulling = false;
    sim.endPull();
    if (phase === 'pull') phase = 'select';
    hold = 0;
    updateHud();
  }

  function doLift() {
    const b = sel;
    pulling = false;
    phase = 'lift';
    sel = null;
    guideDir = 0;
    hold = 0;
    camAuto = true;
    sfx.play('whoosh');
    sfx.vibrate(18);
    const spot = sim.placeSpot();
    sim.lift(b, spot, () => {
      phase = 'settle';
      settleT = 0;
      stableT = 0;
      sfx.play('pop');
      sfx.vibrate(10);
      updateHud();
    });
    updateHud();
  }

  // pointers
  const ptrs = new Map();
  let drag = null;
  let pinch = null;
  const rect = () => canvas.getBoundingClientRect();
  canvas.style.touchAction = 'none';

  const onDown = (e) => {
    if (phase === 'menu') return;
    canvas.setPointerCapture?.(e.pointerId);
    const r = rect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    ptrs.set(e.pointerId, { x, y });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), uz };
      drag = null;
      return;
    }
    if (ptrs.size > 2) return;
    const hit = canPlay() && !pulling ? renderer.pick(x, y) : phase === 'pull' ? renderer.pick(x, y) : null;
    drag = { id: e.pointerId, x0: x, y0: y, x, y, t0: performance.now(), hit, mode: sel && hit === sel && canPlay() ? 'pull?' : 'orbit?', moved: false, s: null };
    canvas.focus?.({ preventScroll: true });
  };
  const onMove = (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const r = rect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const dx = x - p.x, dy = y - p.y;
    p.x = x;
    p.y = y;
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      uz = clamp(pinch.uz * (pinch.d / Math.max(10, d)), 0.55, 1.7);
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    drag.x = x;
    drag.y = y;
    if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) > 6) {
      drag.moved = true;
      if (drag.mode === 'pull?') {
        drag.mode = 'pull';
        let s = renderer.axisScreen(sel, 1);
        let l = Math.hypot(s[0], s[1]);
        if (l < 14) {
          s = l < 0.5 ? [0, 1] : [s[0] / l, s[1] / l];
          s = [s[0] * 14, s[1] * 14];
          l = 14;
        }
        drag.s = s;
        drag.l2 = l * l;
        beginPullIfNeeded();
      } else drag.mode = 'orbit';
    }
    if (drag.mode === 'pull' && pulling) {
      const along = ((x - drag.x0) * drag.s[0] + (y - drag.y0) * drag.s[1]) / drag.l2;
      sim.setPullTarget(along);
    } else if (drag.mode === 'orbit') {
      camAuto = false;
      const cam = renderer.cam;
      cam.yaw -= dx * 0.009;
      yawT = cam.yaw;
      pitchT = clamp(pitchT + dy * 0.005, 0.12, 1.25);
    }
  };
  const onUp = (e) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    if (d.mode === 'pull' && pulling) {
      releasePull();
    } else if (!d.moved && performance.now() - d.t0 < 600) {
      if (canPlay() && !pulling) selectBlock(d.hit);
    }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      uz = clamp(uz * (e.deltaY > 0 ? 1.08 : 0.92), 0.55, 1.7);
    },
    { passive: false },
  );

  const keys = new Set();
  const onKey = (e) => {
    if (phase === 'menu') return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key;
    if (e.type === 'keydown') {
      if (k === 'Tab') {
        e.preventDefault();
        cycleSelection(e.shiftKey ? -1 : 1);
      } else if (k === 'Escape') selectBlock(null);
      else if (k === 'q' || k === 'Q') {
        hold = -1;
        keys.add('q');
      } else if (k === 'e' || k === 'E') {
        hold = 1;
        keys.add('e');
      } else if (k === '+' || k === '=') uz = clamp(uz * 0.92, 0.55, 1.7);
      else if (k === '-') uz = clamp(uz * 1.08, 0.55, 1.7);
      else if (k.startsWith('Arrow')) {
        e.preventDefault();
        keys.add(k);
        camAuto = false;
      }
    } else {
      keys.delete(k.toLowerCase?.() === 'q' || k.toLowerCase?.() === 'e' ? k.toLowerCase() : k);
      if ((k === 'q' || k === 'Q' || k === 'e' || k === 'E') && !keys.has('q') && !keys.has('e')) hold = 0;
      if (k === 'q' || k === 'Q') keys.delete('q');
      if (k === 'e' || k === 'E') keys.delete('e');
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // ------------------------------------------------------------------ turn logic
  function finishTurn() {
    // clean-pull bonus: nothing else moved much while the block came out
    let maxDisp = 0;
    if (snapshot) for (const [b, x, y, z] of snapshot) if (b.state === 'tower' && b.body) maxDisp = Math.max(maxDisp, Math.hypot(b.body.p[0] - x, b.body.p[2] - z));
    snapshot = null;
    const tp = top();
    const extra = Math.max(0, tp + 1 - LAYERS);
    let pts = 10 + extra * 4;
    const perfect = maxDisp < 0.18;
    if (perfect) pts += 5;
    scores[player] += pts;
    moves++;
    floatText(t('pts', { n: pts }), perfect ? 'good' : '');
    if (perfect) floatText(t('perfect'), 'sub');
    sfx.play(perfect ? 'coin' : 'success');
    if (mode === 'duo') {
      player = 1 - player;
      showBanner(t('passPhone', { name: t('player', { n: player + 1 }) }));
    }
    phase = 'select';
    sel = null;
    guideDir = 0;
    camAuto = true;
    updateHud();
    saveGame();
  }

  function gameOver() {
    if (phase === 'over') return;
    phase = 'over';
    overT = 0;
    pulling = false;
    sel = null;
    hold = 0;
    guideDir = 0;
    sim.endPull();
    shake = 1;
    sfx.play('explosion');
    sfx.vibrate([60, 40, 120, 40, 60]);
    renderer.spawnDust([0, 1, 0], 26, 1.6);
    safeSet('save:' + mode, null);
    updateHud();
  }

  async function showResult() {
    overShown = true;
    const layers = top() + 1;
    rec.games++;
    rec.high = Math.max(rec.high, layers);
    let title, body;
    if (mode === 'duo') {
      rec.duoGames++;
      const loser = player;
      const winner = 1 - loser;
      title = t('wins', { name: t('player', { n: winner + 1 }) });
      body = h('div', { class: 'g-stack-result' }, h('p', null, t('loses', { name: t('player', { n: loser + 1 }) })), h('div', { class: 'g-stack-res-row' }, h('span', null, t('player', { n: 1 })), h('b', null, String(scores[0]))), h('div', { class: 'g-stack-res-row' }, h('span', null, t('player', { n: 2 })), h('b', null, String(scores[1]))));
      ctx.addXP?.(clamp(10 + moves * 2, 10, 40));
      ctx.ui.confetti?.();
    } else {
      const score = scores[0];
      const nb = score > (rec.best[diff] || 0);
      if (nb) rec.best[diff] = score;
      title = t('gameOver');
      body = h(
        'div',
        { class: 'g-stack-result' },
        h('p', { class: 'big' }, t('youScored', { n: score })),
        nb ? h('p', { class: 'newbest' }, t('newBest')) : h('p', { class: 'muted' }, t('best') + ': ' + rec.best[diff]),
        h('p', { class: 'muted' }, t('towerHeight', { n: layers }) + ' · ' + t('blocksMoved', { n: moves })),
      );
      ctx.addXP?.(clamp(6 + Math.round(score / 6), 6, 80));
      if (nb) ctx.ui.confetti?.();
    }
    saveRec();
    const res = await modal({ title, body, actions: [{ label: t('playAgain'), value: 'again', primary: true }, { label: t('toMenu'), value: 'menu' }], dismissible: false });
    if (!alive) return;
    if (res === 'again') startGame(null);
    else showMenu();
  }

  async function askRestart() {
    if (phase === 'menu') return;
    const r = await modal({ title: t('restartAsk'), body: t('restartBody'), actions: [{ label: t('cancel'), value: 'no' }, { label: t('yes'), value: 'yes', primary: true }], dismissible: true });
    if (r === 'yes' && alive) startGame(null);
  }

  // ------------------------------------------------------------------ menu
  function showMenu() {
    phase = 'menu';
    sel = null;
    pulling = false;
    hold = 0;
    ctx.setTitle?.();
    clear(bottom);
    clear(hudTop);
    hint.hidden = true;
    pills.p0 = null;
    if (!menuSim) {
      menuSim = createSim('normal');
      menuSim.settle(0.5);
      let k = 0;
      while (!menuSim.asleep && k++ < 240) menuSim.stepOnce();
    }
    menu.hidden = false;
    clear(menu);
    const saves = { solo: safeGet('save:solo', null), duo: safeGet('save:duo', null) };
    const chips = (items, cur, on, cls = '') =>
      h('div', { class: 'chips g-stack-chips ' + cls }, items.map((it) => h('button', { class: 'chip' + (it.id === cur ? ' active' : ''), type: 'button', onclick: () => on(it.id) }, it.label)));
    const render = () => {
      const bestNow = rec.best[diff] || 0;
      clear(menu);
      const c = h(
        'div',
        { class: 'g-stack-menu-card' },
        h('h2', { class: 'g-stack-title' }, t('menuTitle')),
        h('p', { class: 'muted g-stack-sub' }, t('menuSub')),
        chips([{ id: 'solo', label: t('modeSolo') }, { id: 'duo', label: t('modeDuo') }], mode, (id) => { mode = id; render(); }, 'modes'),
        h('div', { class: 'g-stack-label' }, t('difficulty')),
        chips([{ id: 'steady', label: t('steady') }, { id: 'normal', label: t('normal') }, { id: 'wobbly', label: t('wobbly') }], diff, (id) => { diff = id; render(); }),
        h('p', { class: 'small muted g-stack-desc' }, t(diff + 'Desc')),
        h('div', { class: 'g-stack-stats' }, h('div', null, h('small', null, t('best')), h('b', null, String(bestNow))), h('div', null, h('small', null, t('highest')), h('b', null, String(Math.max(rec.high, LAYERS)))), h('div', null, h('small', null, t('games')), h('b', null, String(rec.games)))),
        saves[mode] ? h('button', { class: 'btn big block', type: 'button', onclick: () => startGame(saves[mode]) }, t('continue')) : null,
        h('button', { class: 'btn primary big block', type: 'button', onclick: () => startGame(null) }, saves[mode] ? t('newGame') : t('start')),
        h('details', { class: 'g-stack-how' }, h('summary', null, t('howTo')), h('ul', null, [t('how1'), t('how2'), t('how3'), t('how4')].map((s) => h('li', null, s))), h('p', { class: 'small muted' }, t('keys'))),
      );
      menu.append(c);
    };
    render();
    camAuto = true;
    uz = 1;
  }

  // ------------------------------------------------------------------ main loop
  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    uiTime += dt;
    if (!root.clientWidth || !root.clientHeight) return;
    if (phase === 'menu') {
      const cam = renderer.cam;
      cam.yaw += dt * 0.25;
      cam.pitch += (0.42 - cam.pitch) * 0.05;
      cam.zoom += (1.5 - cam.zoom) * 0.05;
      cam.ty += ((17 * 0.604 + 0.6) * 0.5 - cam.ty) * 0.05;
      cam.vshift += (-0.2 - cam.vshift) * 0.08;
      renderer.draw(menuSim, { time: uiTime, dt });
      return;
    }
    // keyboard camera
    if (keys.size) {
      const cam = renderer.cam;
      if (keys.has('ArrowLeft')) cam.yaw += dt * 1.8;
      if (keys.has('ArrowRight')) cam.yaw -= dt * 1.8;
      if (keys.has('ArrowUp')) pitchT = clamp(pitchT - dt * 1.2, 0.12, 1.25);
      if (keys.has('ArrowDown')) pitchT = clamp(pitchT + dt * 1.2, 0.12, 1.25);
      yawT = cam.yaw;
    }
    // hold buttons drive the pull target
    if (hold && sel && canPlay()) {
      beginPullIfNeeded();
      const ps = sim.pullState();
      if (ps) sim.setPullTarget(ps.target + hold * outSign * 1.7 * dt);
    }
    const t0 = performance.now();
    sim.update(dt);
    simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;
    if (quality < 2 && simMs > 9 && !sim.asleep) {
      // frame-time governor: slower phones get fewer solver sub-steps
      quality++;
      simMs = 0;
      sim.setQuality(quality);
    }
    if (pulling) {
      const ps = sim.pullState();
      if (ps && sim.isClear(ps.b)) doLift();
      else if (ps) {
        const sp = Math.hypot(ps.b.body.v[0], ps.b.body.v[2]);
        if (sp > 0.4 && now - lastScrape > 110) {
          lastScrape = now;
          sfx.noise({ dur: 0.07, vol: 0.05 + Math.min(0.08, sp * 0.03), freq: 420 + Math.random() * 300, q: 0.7 });
          sfx.vibrate(4);
        }
      }
    }
    if (phase === 'settle') {
      settleT += dt;
      if (sim.isSettled()) stableT += dt;
      else stableT = 0;
      if (stableT > 0.6 || settleT > 7) finishTurn();
    }
    if (phase !== 'over' && phase !== 'menu') {
      if (sim.collapsed()) gameOver();
    }
    if (phase === 'over') {
      overT += dt;
      shake = Math.max(0, shake - dt * 1.3);
      if (overT > 1.9 && !overShown) showResult();
    }
    if (flash) {
      flash.t += dt;
      if (flash.t > 0.5) flash = null;
    }
    cameraTargets();
    cameraStep(dt);
    // redraw policy: always while something moves, otherwise at a low rate
    const moving = !sim.asleep || sel || flash || phase === 'lift' || phase === 'settle' || shake > 0 || Math.abs(renderer.cam.yaw - yawT) > 0.002 || Math.abs(renderer.cam.zoom - zoomT * uz) > 0.002 || Math.abs(renderer.cam.ty - tyT) > 0.01;
    if (moving || now - lastDraw > 120 || drag) {
      lastDraw = now;
      renderer.draw(sim, { time: uiTime, dt, selected: sel, flash, guide: sel && !pulling && phase === 'select' ? guideDir : 0, shake });
    }
    updateHud();
  }

  // ------------------------------------------------------------------ layout
  function layout() {
    const w = root.clientWidth, hgt = root.clientHeight;
    if (!w || !hgt) return;
    renderer.resize(w, hgt, Math.min(window.devicePixelRatio || 1, 2));
    lastDraw = 0;
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();

  ctx.onBack(() => {
    if (phase === 'menu') return false;
    if (sel && phase === 'select') {
      selectBlock(null);
      return true;
    }
    saveGame();
    showMenu();
    return true;
  });

  root.__stack = { get sim() { return sim; }, renderer, get state() { return { phase, sel, pulling, scores, player, moves, mode, diff }; }, selectBlock, finishTurn };

  // ------------------------------------------------------------------ start
  const entry = ctx.mode === 'solo' || ctx.mode === 'duo' ? ctx.mode : null;
  if (entry) {
    mode = entry;
    const saved = safeGet('save:' + mode, null);
    if (saved && saved.sim && saved.v === 1) startGame(saved);
    else startGame(null);
  } else {
    showMenu();
  }
  raf = requestAnimationFrame(frame);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    clearTimeout(bannerTimer);
    saveGame();
    ctx.setHeaderRight(null);
    for (const el of floaters) el.remove();
  };
}
