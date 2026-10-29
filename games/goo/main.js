// Goo Builder — physics building puzzle. Modes (ctx.mode): undefined -> menu, 'campaign' -> continue, 'worlds' -> level select, 'sandbox' -> free build.
import STRINGS from './strings.js';
import { Sim, replay, TYPES, TYPE_IDS, DT } from './sim.js';
import { LEVELS, WORLDS, SANDBOX, levelById } from './levels.js';
import { createRenderer, Particles, drawGoo } from './render.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ICON = {
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H4v5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.6 11.5A8 8 0 1 1 7 17.7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  sndOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sndOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
const TNAME = { goo: 'tGoo', balloon: 'tBalloon', heavy: 'tHeavy', tacky: 'tTacky', stake: 'tStake' };
const TDESC = { goo: 'dGoo', balloon: 'dBalloon', heavy: 'dHeavy', tacky: 'dTacky', stake: 'dStake' };

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
  const prog = { stars: {}, best: {}, wins: 0, ...(safeGet('prog', null) || {}) };
  const saveProg = () => safeSet('prog', prog);
  const totalStars = () => Object.values(prog.stars).reduce((a, b) => a + b, 0);
  const cleared = (id) => (prog.stars[id] || 0) > 0;
  const unlocked = (i) => i === 0 || cleared(LEVELS[i - 1].id);
  const firstOpen = () => {
    for (let i = 0; i < LEVELS.length; i++) if (!cleared(LEVELS[i].id)) return i;
    return -1;
  };

  // ------------------------------------------------------------------ DOM
  const app = h('div', { class: 'g-goo-app' });
  const canvas = h('canvas', { class: 'g-goo-canvas', role: 'img', 'aria-label': t('boardLabel') });
  const hud = h('div', { class: 'g-goo-hud', hidden: true });
  const info = h('div', { class: 'g-goo-info', hidden: true });
  const msg = h('div', { class: 'g-goo-msg', hidden: true, role: 'status' });
  const coach = h('div', { class: 'g-goo-coach', hidden: true });
  const tray = h('div', { class: 'g-goo-tray', hidden: true, role: 'toolbar', 'aria-label': t('tray') });
  const overlay = h('div', { class: 'g-goo-overlay', hidden: true });
  app.append(canvas, hud, info, msg, coach, tray, overlay);
  root.append(app);
  const renderer = createRenderer(canvas);
  const particles = new Particles();

  // ------------------------------------------------------------------ audio
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const sfx = {
    play: (n) => active() && ctx.sfx.play(n),
    tone: (o) => active() && ctx.sfx.tone(o),
    noise: (o) => active() && ctx.sfx.noise(o),
    vibrate: (p) => active() && ctx.sfx.vibrate(p),
  };
  const sndBtn = h('button', { class: 'g-goo-snd', type: 'button', onclick: () => {
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
  let lastPlace = 0;
  const sPlace = (type) => {
    const f = type === 'balloon' ? 700 : type === 'heavy' ? 180 : type === 'tacky' ? 420 : type === 'stake' ? 260 : 340;
    sfx.tone({ freq: f, to: f * 1.7, dur: 0.11, type: 'sine', vol: 0.22 });
    sfx.noise({ dur: 0.07, vol: 0.12, freq: 700, q: 1 });
    sfx.vibrate(10);
  };
  const sSnap = () => {
    sfx.noise({ dur: 0.1, vol: 0.28, freq: 2600, q: 2 });
    sfx.tone({ freq: 1000, to: 220, dur: 0.14, type: 'triangle', vol: 0.18 });
    sfx.vibrate([14, 20, 10]);
  };
  const sDie = () => {
    sfx.noise({ dur: 0.25, vol: 0.25, freq: 500, q: 0.8 });
    sfx.tone({ freq: 500, to: 90, dur: 0.25, type: 'sine', vol: 0.2 });
    sfx.vibrate(30);
  };
  const sWin = () => {
    [523, 659, 784, 1046].forEach((f, i) => sfx.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.22, delay: i * 0.1 }));
    sfx.vibrate([30, 40, 30, 40, 60]);
  };

  // ------------------------------------------------------------------ state
  let alive = true;
  let phase = 'menu'; // menu | select | play | won | lost | paused
  let lv = null; // current level def
  let sim = null;
  let cam = { x: 360, y: 400, s: 0.5 };
  let fitS = 0.5;
  let time = 0;
  let acc = 0;
  let last = 0;
  let raf = 0;
  let shake = 0;
  let born = new Map();
  let ghost = null;
  let armed = null;
  let drag = null; // {type, pid, sx, sy, started, touch}
  let ret = null; // return-to-tray animation
  let hover = null;
  let winTime = 0;
  let endTimer = 0;
  let msgTimer = 0;
  let coachStep = -1;
  let tutorialShown = new Set();
  let pageWorld = 1;
  let lastHud = '';
  let lastSnapMsg = 0;
  let resultShown = false;

  // ------------------------------------------------------------------ camera
  function viewRect() {
    const W = canvas.clientWidth || root.clientWidth, H = canvas.clientHeight || root.clientHeight;
    const top = 92, bottom = lv && lv.sandbox ? 112 : 112;
    return { W, H, top, bottom, availH: Math.max(120, H - top - bottom) };
  }
  // the part of the level that matters (tight vertical range so the action is as large as possible)
  function viewBox(def) {
    const b = def.bounds;
    let y0 = Infinity;
    for (const poly of def.terrain || []) {
      let m = Infinity;
      for (const p of poly) m = Math.min(m, p[1]);
      if (m < def.killY - 100) y0 = Math.min(y0, m);
    }
    if (def.pipe) y0 = Math.min(y0, def.pipe.y - 70);
    if (def.goal && def.goal.type === 'height') y0 = Math.min(y0, def.goal.y - 20);
    for (const p of def.pendulums || []) y0 = Math.min(y0, p.py - 20);
    for (const hz of def.hazards || []) for (const p of hz.pts) y0 = Math.min(y0, p[1]);
    for (const m of def.movers || []) y0 = Math.min(y0, m.cy - (m.ay || 0) - 60);
    y0 = isFinite(y0) ? Math.max(b[1], y0 - 150) : b[1];
    return [b[0], y0, b[2], Math.min(b[3], def.killY + 20)];
  }
  function fitCam() {
    if (!lv) return;
    const { W, H, top, availH } = viewRect();
    const b = viewBox(lv);
    const bw = b[2] - b[0], bh = b[3] - b[1];
    fitS = Math.min(W / bw, availH / bh) * 0.97;
    cam.s = fitS;
    cam.x = (b[0] + b[2]) / 2;
    const cyAvail = top + availH / 2;
    cam.y = (b[1] + b[3]) / 2 - (cyAvail - H / 2) / cam.s;
  }
  function clampCam() {
    const b = lv.bounds;
    cam.s = clamp(cam.s, fitS * 0.75, Math.max(fitS * 3, 1.8));
    cam.x = clamp(cam.x, b[0] - 140, b[2] + 140);
    cam.y = clamp(cam.y, b[1] - 260, b[3] + 260);
  }
  const toWorld = (px, py) => {
    const r = canvas.getBoundingClientRect();
    return [(px - r.left - r.width / 2) / cam.s + cam.x, (py - r.top - r.height / 2) / cam.s + cam.y];
  };
  const toScreen = (wx, wy) => {
    const r = canvas.getBoundingClientRect();
    return [(wx - cam.x) * cam.s + r.width / 2 + r.left, (wy - cam.y) * cam.s + r.height / 2 + r.top];
  };
  function zoomAt(px, py, k) {
    const [wx, wy] = toWorld(px, py);
    cam.s *= k;
    clampCam();
    const r = canvas.getBoundingClientRect();
    cam.x = wx - (px - r.left - r.width / 2) / cam.s;
    cam.y = wy - (py - r.top - r.height / 2) / cam.s;
    clampCam();
  }

  // ------------------------------------------------------------------ saving of the running level
  function saveRun() {
    if (!sim || !lv) return;
    safeSet('run', { id: lv.id, log: sim.log });
  }
  function clearRun() {
    safeSet('run', null);
  }

  // ------------------------------------------------------------------ overlay helpers
  function showOverlay(node, cls = '') {
    clear(overlay);
    overlay.className = 'g-goo-overlay ' + cls;
    overlay.append(node);
    overlay.hidden = false;
  }
  function hideOverlay() {
    overlay.hidden = true;
    clear(overlay);
  }
  function say(text, ms = 1800, kind = '') {
    msg.textContent = text;
    msg.className = 'g-goo-msg ' + kind;
    msg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => (msg.hidden = true), ms);
  }

  // ------------------------------------------------------------------ menu / select
  const starsText = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);

  function showMenu() {
    phase = 'menu';
    stopPlayUI();
    ctx.setTitle();
    const idx = firstOpen();
    const run = safeGet('run', null);
    const contLv = run && levelById(run.id) ? levelById(run.id) : idx >= 0 ? LEVELS[idx] : LEVELS[LEVELS.length - 1];
    const blobs = h('div', { class: 'g-goo-hero' },
      ...['goo', 'balloon', 'heavy', 'tacky', 'goo'].map((ty, i) => {
        const cv = iconCanvas(ty, 64);
        cv.className = 'g-goo-heroblob b' + i;
        return cv;
      }));
    const el = h('div', { class: 'g-goo-menu' },
      blobs,
      h('h1', { class: 'g-goo-title' }, t('title')),
      h('p', { class: 'g-goo-sub' }, t('menuSub')),
      h('div', { class: 'g-goo-menubtns' },
        h('button', { class: 'btn primary big block', onclick: () => startLevel(contLv, { resume: true }) }, t('continueLv', { name: t('lv_' + contLv.id) })),
        h('button', { class: 'btn big block', onclick: showSelect }, t('levels') + '  ·  ★ ' + totalStars() + '/' + LEVELS.length * 3),
        h('button', { class: 'btn big block ghost', onclick: () => startSandbox() }, t('sandbox')),
        h('button', { class: 'btn block ghost', onclick: showHow }, t('howTo'))),
    );
    hideOverlay();
    clear(app.querySelector('.g-goo-menuhost') || (() => {
      const m = h('div', { class: 'g-goo-menuhost' });
      app.append(m);
      return m;
    })()).append(el);
    app.querySelector('.g-goo-menuhost').hidden = false;
    canvas.style.visibility = 'hidden';
  }
  function hideMenuHost() {
    const m = app.querySelector('.g-goo-menuhost');
    if (m) m.hidden = true;
    canvas.style.visibility = '';
  }
  function showHow() {
    const types = h('div', { class: 'g-goo-types' }, ...TYPE_IDS.map((ty) => {
      const cv = iconCanvas(ty, 44);
      return h('div', { class: 'g-goo-typerow' }, cv, h('div', null, h('b', null, t(TNAME[ty])), h('span', null, t(TDESC[ty]))));
    }));
    modal({
      title: t('howTo'),
      body: h('div', { class: 'g-goo-how' }, h('p', { style: 'white-space:pre-line' }, t('howBody')), h('h4', null, t('types')), types, h('p', { class: 'small muted' }, t('keys'))),
      actions: [{ label: 'OK', value: true, primary: true }],
      dismissible: true,
    });
  }

  function showSelect() {
    phase = 'select';
    stopPlayUI();
    hideOverlay();
    ctx.setTitle();
    const host = app.querySelector('.g-goo-menuhost') || (() => {
      const m = h('div', { class: 'g-goo-menuhost' });
      app.append(m);
      return m;
    })();
    host.hidden = false;
    canvas.style.visibility = 'hidden';
    const w = WORLDS.find((x) => x.id === pageWorld);
    const tabs = h('div', { class: 'g-goo-tabs', role: 'tablist' }, ...WORLDS.map((wd) => {
      const first = LEVELS.findIndex((l) => l.world === wd.id);
      const lock = !unlocked(first);
      return h('button', {
        class: 'g-goo-tab' + (wd.id === pageWorld ? ' on' : '') + (lock ? ' lock' : ''), role: 'tab', 'aria-selected': String(wd.id === pageWorld),
        'aria-label': t('world', { n: wd.id }) + ' ' + t(wd.key), onclick: () => {
          pageWorld = wd.id;
          showSelect();
        },
      }, h('span', null, wd.icon), h('small', null, String(wd.id)));
    }));
    const grid = h('div', { class: 'g-goo-grid' }, ...LEVELS.filter((l) => l.world === pageWorld).map((l) => {
      const i = LEVELS.indexOf(l);
      const lock = !unlocked(i);
      const st = prog.stars[l.id] || 0;
      const cur = !lock && !cleared(l.id);
      return h('button', {
        class: 'g-goo-lvl' + (lock ? ' locked' : '') + (cur ? ' current' : '') + (st ? ' done' : ''), disabled: lock,
        'aria-label': t('lv_' + l.id) + ' — ' + (lock ? t('locked') : starsText(st)),
        onclick: () => startLevel(l, { resume: true }),
      }, h('b', null, lock ? '🔒' : String(l.num)), h('span', null, t('lv_' + l.id)), h('small', null, starsText(st)));
    }));
    const el = h('div', { class: 'g-goo-select' },
      h('div', { class: 'g-goo-selhead' }, h('h2', null, w.icon + ' ' + t('world', { n: w.id }) + ' · ' + t(w.key)), h('span', { class: 'g-goo-starsum' }, '★ ' + totalStars() + '/' + LEVELS.length * 3)),
      tabs, grid,
      h('div', { class: 'g-goo-selfoot' }, h('button', { class: 'btn ghost', onclick: showMenu }, t('menu')), h('button', { class: 'btn ghost', onclick: () => startSandbox() }, t('sandbox'))));
    clear(host).append(el);
  }

  // ------------------------------------------------------------------ tray + HUD
  function iconCanvas(type, size) {
    const cv = h('canvas', { width: size * 2, height: size * 2, style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
    const c = cv.getContext('2d');
    c.scale(2, 2);
    drawGoo(c, size / 2, size / 2 - (type === 'balloon' ? 3 : 0), size * 0.34, type, { t: 0, lookx: 0.2, looky: 0.1 });
    return cv;
  }

  let chips = {};
  function buildTray() {
    clear(tray);
    chips = {};
    const types = TYPE_IDS.filter((ty) => lv.sandbox || (lv.stock[ty] || 0) > 0);
    types.forEach((ty, i) => {
      const badge = h('span', { class: 'g-goo-badge' }, '0');
      const chip = h('button', {
        class: 'g-goo-chip', type: 'button', 'data-type': ty, 'aria-label': t(TNAME[ty]) + ' — ' + t(TDESC[ty]), title: t(TNAME[ty]) + ': ' + t(TDESC[ty]),
        onpointerdown: (e) => onChipDown(e, ty, chip), onkeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleArm(ty);
          }
        },
      }, iconCanvas(ty, 52), h('span', { class: 'g-goo-chipname' }, t(TNAME[ty])), badge, h('kbd', null, String(i + 1)));
      chips[ty] = { chip, badge };
      tray.append(chip);
    });
    tray.hidden = false;
  }
  function refreshTray() {
    for (const ty in chips) {
      const n = sim.left[ty];
      const txt = n === Infinity ? '∞' : String(n);
      if (chips[ty].badge.textContent !== txt) chips[ty].badge.textContent = txt;
      chips[ty].chip.classList.toggle('empty', n <= 0);
      chips[ty].chip.classList.toggle('armed', armed === ty);
      chips[ty].chip.classList.toggle('drag', !!(drag && drag.started && drag.type === ty));
    }
  }

  let hudRefs = null;
  function buildHud() {
    clear(hud);
    clear(info);
    const mkBtn = (cls, ico, label, fn) => h('button', { class: 'g-goo-ib ' + cls, type: 'button', 'aria-label': label, title: label, onclick: fn }, h('span', { html: ico }));
    const setIcon = (b, ico) => (b.firstChild.innerHTML = ico);
    const pauseB = mkBtn('pause', '', t('pause'), openPause);
    const undoB = mkBtn('undo', '', t('undo'), doUndo);
    const restartB = mkBtn('restart', '', t('restart'), askRestart);
    const fitB = mkBtn('fit', '', t('fit'), () => {
      fitCam();
    });
    setIcon(pauseB, ICON.menu);
    setIcon(undoB, ICON.undo);
    setIcon(restartB, ICON.restart);
    setIcon(fitB, ICON.fit);
    const title = h('div', { class: 'g-goo-ttl' }, h('b', null, lv.sandbox ? t('sandbox') : t('lv_' + lv.id)), h('small', null, lv.sandbox ? '' : t('world', { n: lv.world }) + ' · ' + lv.num + '/6'));
    hud.append(pauseB, title, undoB, restartB, fitB);
    const piece = h('div', { class: 'g-goo-pill' }, h('small', null, t('used')), h('b', null, '0'));
    const left = h('div', { class: 'g-goo-pill' }, h('small', null, t('left')), h('b', null, '0'));
    const needPill = h('div', { class: 'g-goo-pill need' }, h('small', null, t('need')), h('b', null, '0'));
    const prog2 = h('div', { class: 'g-goo-pill wide', hidden: true }, h('small', null, t('height')), h('div', { class: 'g-goo-bar' }, h('i')));
    const starp = h('div', { class: 'g-goo-pill stars' }, h('small', null, ''), h('b', null, '★★★'));
    info.append(piece, left, needPill, prog2, starp);
    hudRefs = { piece: piece.lastChild, left: left.lastChild, need: needPill.lastChild, needPill, prog: prog2, bar: prog2.querySelector('i'), star: starp.lastChild, starSmall: starp.firstChild, undoB };
    if (lv.sandbox) {
      left.hidden = needPill.hidden = starp.hidden = true;
    }
    if (lv.goal && lv.goal.type === 'height') {
      prog2.hidden = false;
    }
    hud.hidden = false;
    info.hidden = false;
  }
  function refreshHud() {
    if (!sim || !hudRefs) return;
    const left = sim.placeable;
    const st = lv.sandbox ? 3 : sim.stars();
    const key = [sim.used, left === Infinity ? 'i' : left, st, Math.round(sim.progress() * 100), sim.history.length].join('|');
    if (key === lastHud) return;
    lastHud = key;
    hudRefs.piece.textContent = String(sim.used);
    hudRefs.left.textContent = left === Infinity ? '∞' : String(left);
    hudRefs.need.textContent = '🟢×' + (lv.need || 0);
    hudRefs.star.textContent = starsText(st);
    hudRefs.starSmall.textContent = lv.sandbox ? '' : st === 3 ? '≤' + lv.stars[0] : st === 2 ? '≤' + lv.stars[1] : '';
    hudRefs.bar.style.width = Math.round(sim.progress() * 100) + '%';
    hudRefs.undoB.disabled = sim.history.length === 0;
  }
  function stopPlayUI() {
    hud.hidden = true;
    info.hidden = true;
    tray.hidden = true;
    coach.hidden = true;
    msg.hidden = true;
    ghost = null;
    drag = null;
    armed = null;
    ret = null;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // ------------------------------------------------------------------ level lifecycle
  function startLevel(def, { resume = false, fresh = false } = {}) {
    hideMenuHost();
    hideOverlay();
    lv = def;
    renderer.setLevel(lv);
    const opts = { sandbox: !!lv.sandbox };
    sim = new Sim(lv, opts);
    born = new Map();
    particles.list.length = 0;
    const run = safeGet('run', null);
    if (resume && !fresh && run && run.id === lv.id && Array.isArray(run.log) && run.log.length) {
      try {
        sim = replay(lv, run.log, opts);
      } catch {
        sim = new Sim(lv, opts);
      }
    }
    for (const n of sim.nodes) if (n.type !== 'base') born.set(n.id, -10);
    phase = 'play';
    resultShown = false;
    acc = 0;
    armed = null;
    drag = null;
    ghost = null;
    ret = null;
    lastHud = '';
    ctx.setTitle();
    buildHud();
    buildTray();
    fitCam();
    refreshTray();
    refreshHud();
    startCoach();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    canvas.style.visibility = '';
  }
  function startSandbox() {
    startLevel(SANDBOX, { resume: true });
    say(t('sandboxHint'), 3500);
  }
  function restartLevel() {
    clearRun();
    startLevel(lv, { fresh: true });
    sfx.play('whoosh');
  }
  function askRestart() {
    if (!sim) return;
    if (sim.used === 0 && sim.status === 'play') {
      restartLevel();
      return;
    }
    modal({ title: t('restart'), body: t('confirmRestart'), actions: [{ label: t('cancel'), value: false }, { label: t('yes'), value: true, primary: true }], dismissible: true }).then((v) => {
      if (v && alive) restartLevel();
    });
  }
  function doUndo() {
    if (!sim || (sim.status !== 'play' && sim.status !== 'lost')) return;
    if (sim.undo()) {
      sfx.play('select');
      sfx.vibrate(8);
      if (phase === 'lost') {
        phase = 'play';
        hideOverlay();
        resultShown = false;
      }
      saveRun();
      refreshTray();
      lastHud = '';
    }
  }
  function openPause() {
    if (phase !== 'play') return;
    phase = 'paused';
    const el = h('div', { class: 'g-goo-card' },
      h('h2', null, t('pause')),
      h('button', { class: 'btn primary big block', onclick: closePause }, t('resume')),
      h('button', { class: 'btn big block', onclick: () => {
        closePause();
        askRestart();
      } }, t('restart')),
      h('button', { class: 'btn big block ghost', onclick: () => {
        saveRun();
        lv.sandbox ? showMenu() : showSelect();
      } }, t(lv.sandbox ? 'menu' : 'back')),
      h('button', { class: 'btn block ghost', onclick: showHow }, t('howTo')));
    showOverlay(el, 'dim');
  }
  function closePause() {
    if (phase !== 'paused') return;
    phase = 'play';
    hideOverlay();
    last = performance.now();
  }

  // ------------------------------------------------------------------ coach marks / hints
  function startCoach() {
    coachStep = -1;
    coach.hidden = true;
    if (lv.sandbox) return;
    if (lv.tutorial === 1 && sim.used === 0) {
      coachStep = 0;
      showCoach('coach1', true);
      return;
    }
    const hk = 'hint_' + lv.id;
    if (STRINGS.en[hk] && !cleared(lv.id) && sim.used === 0 && !tutorialShown.has(lv.id)) {
      tutorialShown.add(lv.id);
      showCoach(hk, false);
      coachStep = 90;
    }
  }
  function showCoach(key, hand) {
    clear(coach);
    coach.append(h('div', { class: 'g-goo-coachbox' }, h('span', { class: 'g-goo-bulb' }, '💡'), h('span', null, t(key))), ...(hand ? [h('div', { class: 'g-goo-hand', 'aria-hidden': 'true' }, '👆')] : []));
    coach.hidden = false;
  }
  function coachEvent(ev) {
    if (coachStep < 0) return;
    if (coachStep === 0 && ev === 'drag') {
      coachStep = 1;
      showCoach('coach2', false);
    } else if (coachStep <= 1 && ev === 'placed') {
      coachStep = 2;
      showCoach('coach3', false);
    } else if (coachStep === 2 && ev === 'placed' && sim.used >= 4) {
      coachStep = -1;
      coach.hidden = true;
    } else if (coachStep === 90 && ev === 'placed') {
      coachStep = -1;
      coach.hidden = true;
    }
  }

  // ------------------------------------------------------------------ input: tray drag, canvas pan/pinch, tap
  const ptrs = new Map();
  let pinch = null;
  let tap = null;

  function toggleArm(ty) {
    if (phase !== 'play') return;
    armed = armed === ty ? null : ty;
    ghost = null;
    sfx.play('tap');
    if (armed) say(t('armed', { name: t(TNAME[ty]) }) + ' · ' + t('tapToPlace'), 2200);
    refreshTray();
  }

  function onChipDown(e, ty, chip) {
    if (phase !== 'play' || (e.button !== undefined && e.button > 0)) return;
    if (!sim.sandbox && sim.left[ty] <= 0) {
      sfx.play('error');
      say(t('r_stock'), 1200, 'bad');
      return;
    }
    e.preventDefault();
    drag = { type: ty, pid: e.pointerId, sx: e.clientX, sy: e.clientY, started: false, touch: e.pointerType !== 'mouse', chip };
    try {
      chip.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function updateGhostFromPointer(px, py) {
    const off = drag.touch ? 58 : 0;
    const [wx, wy] = toWorld(px, py - off);
    const pv = sim.preview(drag.type, wx, wy);
    ghost = { type: drag.type, x: wx, y: wy, pv };
  }

  function onWinMove(e) {
    if (drag && e.pointerId === drag.pid) {
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 9) return;
        drag.started = true;
        sfx.play('select');
        coachEvent('drag');
        refreshTray();
      }
      updateGhostFromPointer(e.clientX, e.clientY);
      return;
    }
    if (armed && e.pointerType === 'mouse' && !ptrs.size && phase === 'play') {
      const rr = canvas.getBoundingClientRect();
      if (e.clientX >= rr.left && e.clientX <= rr.right && e.clientY >= rr.top && e.clientY <= rr.bottom) {
        const [wx, wy] = toWorld(e.clientX, e.clientY);
        ghost = { type: armed, x: wx, y: wy, pv: sim.preview(armed, wx, wy) };
      } else ghost = null;
    }
    // hover on removable goo
    if (e.pointerType === 'mouse' && sim && phase === 'play') {
      const [wx, wy] = toWorld(e.clientX, e.clientY);
      hover = hitRemovable(wx, wy);
      canvas.style.cursor = hover ? 'pointer' : '';
    }
  }
  function onWinUp(e) {
    if (drag && e.pointerId === drag.pid) {
      const d = drag;
      drag = null;
      try {
        d.chip.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!d.started) {
        toggleArm(d.type);
        refreshTray();
        return;
      }
      const trayTop = tray.getBoundingClientRect().top;
      const inTray = e.clientY > trayTop - 4;
      const pv = ghost && ghost.pv;
      if (!inTray && pv && pv.valid && phase === 'play') {
        doPlace(d.type, ghost.x, ghost.y);
      } else {
        if (!inTray && pv && !pv.valid && phase === 'play') {
          sfx.play('error');
          say(t('r_' + pv.reason), 1700, 'bad');
        }
        // hop back to the tray chip
        const cr = d.chip.getBoundingClientRect();
        const off = d.touch ? 58 : 0;
        ret = { type: d.type, fx: e.clientX, fy: e.clientY - off, tx: cr.left + cr.width / 2, ty: cr.top + cr.height / 2, t0: performance.now() };
      }
      ghost = null;
      refreshTray();
      return;
    }
  }
  function doPlace(type, x, y) {
    const r = sim.place(type, x, y);
    if (!r.ok) {
      sfx.play('error');
      say(t('r_' + r.reason), 1500, 'bad');
      return false;
    }
    born.set(r.node.id, time);
    sPlace(type);
    particles.burst(r.node.x, r.node.y, 7, { color: [TYPES[type].color, '#fff'], speed: 120, size: 3, life: 0.5, g: 200, up: 40, shape: 'puff' });
    coachEvent('placed');
    saveRun();
    refreshTray();
    lastHud = '';
    return true;
  }
  function hitRemovable(wx, wy) {
    if (!sim) return null;
    let best = null, bd = 1e9;
    for (const n of sim.nodes) {
      if (!n.alive || !TYPES[n.type] || !TYPES[n.type].removable) continue;
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < n.r + 14 / cam.s && d < bd) {
        bd = d;
        best = n.id;
      }
    }
    return best;
  }

  function onCanvasDown(e) {
    if (phase !== 'play') return;
    canvas.setPointerCapture?.(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now() });
    if (ptrs.size === 1) tap = { id: e.pointerId, moved: false };
    else {
      tap = null;
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  }
  function onCanvasMove(e) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptrs.size >= 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if (pinch.d > 0) zoomAt(cx, cy, d / pinch.d);
      cam.x -= (cx - pinch.cx) / cam.s;
      cam.y -= (cy - pinch.cy) / cam.s;
      clampCam();
      pinch.d = d;
      pinch.cx = cx;
      pinch.cy = cy;
      return;
    }
    if (tap && tap.id === e.pointerId) {
      if (!tap.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) tap.moved = true;
      if (tap.moved) {
        cam.x -= dx / cam.s;
        cam.y -= dy / cam.s;
        clampCam();
      }
    }
  }
  function onCanvasUp(e) {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!p) return;
    if (tap && tap.id === e.pointerId) {
      const wasTap = !tap.moved;
      tap = null;
      if (wasTap && phase === 'play') handleTap(e.clientX, e.clientY, e.pointerType);
    }
  }
  function handleTap(px, py, ptype) {
    const [wx, wy] = toWorld(px, py);
    const id = hitRemovable(wx, wy);
    if (id !== null && sim.removeNode(id)) {
      sfx.play('pop');
      sfx.vibrate(10);
      particles.burst(wx, wy, 8, { color: TYPES.tacky.color, speed: 140, size: 3, life: 0.5, shape: 'puff' });
      saveRun();
      refreshTray();
      lastHud = '';
      return;
    }
    if (armed) {
      const off = ptype === 'mouse' ? 0 : 0;
      const pv = sim.preview(armed, wx, wy - off);
      if (pv.valid) doPlace(armed, wx, wy - off);
      else {
        sfx.play('error');
        say(t('r_' + pv.reason), 1500, 'bad');
        ghost = null;
      }
    }
  }
  function onWheel(e) {
    if (phase !== 'play') return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0012));
  }
  function onKey(e) {
    if (!alive || phase !== 'play' || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const step = 60 / cam.s;
    if (k === 'z') doUndo();
    else if (k === 'r') askRestart();
    else if (k === 'f') fitCam();
    else if (k === 'escape') {
      if (armed) toggleArm(armed);
      else openPause();
    } else if (k === '+' || k === '=') zoomAt(root.clientWidth / 2, root.clientHeight / 2, 1.15);
    else if (k === '-') zoomAt(root.clientWidth / 2, root.clientHeight / 2, 1 / 1.15);
    else if (k === 'arrowleft') (cam.x -= step, clampCam());
    else if (k === 'arrowright') (cam.x += step, clampCam());
    else if (k === 'arrowup') (cam.y -= step, clampCam());
    else if (k === 'arrowdown') (cam.y += step, clampCam());
    else if (/^[1-5]$/.test(k)) {
      const ty = Object.keys(chips)[Number(k) - 1];
      if (ty) toggleArm(ty);
    } else return;
    e.preventDefault();
  }
  canvas.addEventListener('pointerdown', onCanvasDown);
  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerup', onCanvasUp);
  canvas.addEventListener('pointercancel', onCanvasUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointermove', onWinMove);
  window.addEventListener('pointerup', onWinUp);
  window.addEventListener('pointercancel', onWinUp);
  window.addEventListener('keydown', onKey);
  const onResize = () => {
    if (lv && phase !== 'menu' && phase !== 'select') {
      const ratio = cam.s / (fitS || 1);
      const cx = cam.x, cy = cam.y;
      fitCam();
      cam.s = fitS * ratio;
      cam.x = cx;
      cam.y = cy;
      clampCam();
    }
  };
  window.addEventListener('resize', onResize);

  // ------------------------------------------------------------------ events from the simulation
  let lastSndT = -1;
  function handleEvents() {
    const evs = sim.events;
    if (!evs.length) return;
    const quiet = time - lastSndT < 0.07; // never stack dozens of sounds in one frame
    let sounded = false;
    for (const ev of evs) {
      if (ev.k === 'snap') {
        if (!quiet && !sounded) sSnap();
        sounded = true;
        particles.burst(ev.x, ev.y, 12, { color: ['#fff', '#ffd54a', '#ff8a4a'], speed: 260, size: 2.6, life: 0.55, g: 300, shape: 'star' });
        shake = reduced ? 0 : 0.6;
        if (time - lastSnapMsg > 2.5) {
          lastSnapMsg = time;
          say(t('snap'), 1200, 'bad');
        }
      } else if (ev.k === 'die') {
        if (ev.why !== 'remove') {
          if (!quiet && !sounded) sDie();
          sounded = true;
          const col = ev.why === 'spikes' ? '#ff5a4a' : '#ffc86a';
          particles.burst(ev.x, Math.min(ev.y, sim.killY - 20), 16, { color: [TYPES[ev.type]?.color || '#fff', col, '#fff'], speed: 250, size: 3.4, life: 0.8, g: 700, up: 220, shape: 'dot' });
          shake = reduced ? 0 : 0.35;
          if (time - lastSnapMsg > 2) {
            lastSnapMsg = time;
            say(t('popped'), 1200, 'bad');
          }
        }
      } else if (ev.k === 'win') onWin();
      else if (ev.k === 'lose') onLose();
    }
    if (sounded) lastSndT = time;
    evs.length = 0;
  }

  function onWin() {
    phase = 'won';
    winTime = time;
    sWin();
    ctx.ui.confetti?.();
    const p = lv.pipe;
    if (p) particles.burst(p.x, p.y - 10, 40, { color: ['#f7d774', '#9dffcf', '#fff'], speed: 330, size: 4, life: 1.2, g: 420, up: 120, shape: 'star' });
    clearRun();
    const st = sim.stars();
    const prev = prog.stars[lv.id] || 0;
    const prevBest = prog.best[lv.id];
    const newBest = prevBest === undefined || sim.used < prevBest;
    if (st > prev) prog.stars[lv.id] = st;
    if (newBest) prog.best[lv.id] = sim.used;
    prog.wins = (prog.wins || 0) + 1;
    saveProg();
    ctx.addXP?.(prev === 0 ? 20 + st * 6 : st > prev ? 10 : 4);
    clearTimeout(endTimer);
    endTimer = setTimeout(() => alive && phase === 'won' && showWin(st, newBest), 1700);
  }
  function showWin(st, newBest) {
    if (resultShown) return;
    resultShown = true;
    const idx = LEVELS.indexOf(lv);
    const hasNext = idx >= 0 && idx < LEVELS.length - 1;
    const starEls = [1, 2, 3].map((i) => h('span', { class: 'g-goo-star' + (i <= st ? ' on' : ''), style: `animation-delay:${i * 0.18}s` }, '★'));
    const el = h('div', { class: 'g-goo-card result' },
      h('h2', null, t('win')),
      h('div', { class: 'g-goo-stars' }, ...starEls),
      h('p', null, t('usedPieces', { n: sim.used })),
      h('p', { class: 'muted small' }, newBest ? t('newBest') : t('bestPieces', { n: prog.best[lv.id] ?? sim.used })),
      st < 3 ? h('p', { class: 'muted small' }, t('threeStars', { n: lv.stars[0] })) : null,
      hasNext ? h('button', { class: 'btn primary big block', onclick: () => startLevel(LEVELS[idx + 1], { fresh: true }) }, t('next')) : h('p', { class: 'muted' }, t('allDone')),
      h('button', { class: 'btn big block', onclick: restartLevel }, t('retry')),
      h('button', { class: 'btn block ghost', onclick: () => {
        pageWorld = lv.world;
        showSelect();
      } }, t('back')));
    showOverlay(el, 'dim');
    sfx.play('levelup');
  }
  function onLose() {
    phase = 'lost';
    sfx.play('lose');
    sfx.vibrate([40, 60, 40]);
    clearRun();
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      if (!alive || phase !== 'lost') return;
      const el = h('div', { class: 'g-goo-card result' },
        h('div', { class: 'big-emoji' }, '😵'),
        h('h2', null, t('lose')),
        h('p', { class: 'muted' }, t('loseSub')),
        h('button', { class: 'btn primary big block', onclick: restartLevel }, t('retry')),
        h('button', { class: 'btn big block', onclick: doUndo, disabled: sim.history.length === 0 }, t('undo')),
        h('button', { class: 'btn block ghost', onclick: () => {
          pageWorld = lv.world;
          showSelect();
        } }, t('back')));
      showOverlay(el, 'dim');
    }, 900);
  }

  // ------------------------------------------------------------------ main loop
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    if (phase === 'paused' || !sim) {
      return;
    }
    acc += dt;
    let n = 0;
    const t0 = performance.now();
    while (acc >= DT && n < 5) {
      sim.step();
      acc -= DT;
      n++;
      if (performance.now() - t0 > 11) break;
    }
    if (acc > 0.25) acc = 0;
    handleEvents();
    particles.update(dt);
    shake = Math.max(0, shake - dt * 2.4);
    // return-to-tray hop
    let g = ghost;
    if (ret) {
      const k = Math.min(1, (now - ret.t0) / 320);
      const e = 1 - Math.pow(1 - k, 3);
      const px = ret.fx + (ret.tx - ret.fx) * e, py = ret.fy + (ret.ty - ret.fy) * e - Math.sin(k * Math.PI) * 38;
      const [wx, wy] = toWorld(px, py);
      g = { type: ret.type, x: wx, y: wy, pv: { valid: true, x: wx, y: wy, links: [] }, bare: true };
      if (k >= 1) ret = null;
    }
    renderer.draw({ sim, cam, time, ghost: g, particles, born, hover, winTime, shake, vignette: true });
    refreshHud();
    if (n && (n & 1)) refreshTray();
  }

  // ------------------------------------------------------------------ navigation
  ctx.onBack(() => {
    if (!overlay.hidden && phase === 'paused') {
      closePause();
      return true;
    }
    if (phase === 'play' || phase === 'won' || phase === 'lost' || phase === 'paused') {
      if (phase === 'play') saveRun();
      if (lv && lv.sandbox) showMenu();
      else showSelect();
      return true;
    }
    if (phase === 'select') {
      showMenu();
      return true;
    }
    return false;
  });

  // test hooks (used by the Playwright run and unit helpers)
  window.__goo = { get sim() { return sim; }, get cam() { return cam; }, get lv() { return lv; }, get phase() { return phase; }, startLevel, LEVELS, toScreen, doPlace, saveRun };

  // ------------------------------------------------------------------ boot
  const mode = ctx.mode;
  if (mode === 'sandbox') startSandbox();
  else if (mode === 'worlds') {
    const i = firstOpen();
    pageWorld = i >= 0 ? LEVELS[i].world : 1;
    showSelect();
  } else if (mode === 'campaign') {
    const run = safeGet('run', null);
    const i = firstOpen();
    if (run && levelById(run.id)) startLevel(levelById(run.id), { resume: true });
    else if (i >= 0) startLevel(LEVELS[i], { resume: true });
    else showSelect();
  } else showMenu();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    clearTimeout(msgTimer);
    clearTimeout(endTimer);
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
    window.removeEventListener('pointercancel', onWinUp);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    delete window.__goo;
    ctx.setHeaderRight(null);
  };
}
