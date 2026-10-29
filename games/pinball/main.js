// Pinball Pro — a modern arcade pinball machine (2 tables), custom 2D physics at 480 Hz.
// Modes (ctx.mode): undefined -> menu, 'classic' -> Neon Arcade, 'space' -> Space Station (if unlocked), 'missions' -> mission run.
import STRINGS from './strings.js';
import { Game, rankFor, SCORE } from './rules.js';
import { Sim } from './sim.js';
import { makeTable, TABLE_IDS, UNLOCK, XC } from './tables.js';
import { createRenderer, createDMD, createFireworks } from './render.js';
import * as Rec from './records.js';

const ICON = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.4" height="14" rx="1.2" fill="currentColor"/><rect x="13.6" y="5" width="4.4" height="14" rx="1.2" fill="currentColor"/></svg>',
  sndOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sndOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
const MSG_KEY = {
  ballN: 'dmdBall', ready: 'dmdReady', danger: 'dmdDanger', tilt: 'dmdTilt', combo: 'dmdCombo', mult: 'dmdMult',
  missionDone: 'dmdMission', allClear: 'dmdAllClear', bank: 'dmdBank', mbLit: 'dmdMbLit', multiball: 'dmdMulti',
  jackpot: 'dmdJackpot', saved: 'dmdSaved', kickback: 'dmdKick', ramp: 'dmdRamp', skill: 'dmdSkill', reset: 'dmdReset',
};
const TABLE_NAME = { neon: 'tableNeon', space: 'tableSpace' };
const TABLE_SUB = { neon: 'tableNeonSub', space: 'tableSpaceSub' };
const fmt = (n) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');

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
  let rec = Rec.normalize(safeGet('rec', null));
  const saveRec = () => safeSet('rec', rec);

  // ------------------------------------------------------------------ DOM
  const app = h('div', { class: 'g-pinball-app' });
  const scoreEl = h('div', { class: 'g-pinball-score', 'aria-live': 'off' }, '0');
  const ballPill = h('div', { class: 'g-pinball-pill' });
  const multPill = h('div', { class: 'g-pinball-pill g-pinball-mult' });
  const pauseBtn = h('button', { class: 'g-pinball-ibtn', type: 'button', 'aria-label': t('pause'), onclick: () => pauseGame() });
  pauseBtn.innerHTML = ICON.pause;
  const hud = h('div', { class: 'g-pinball-hud' }, h('div', { class: 'g-pinball-scorebox' }, h('small', {}, t('scoreLabel')), scoreEl), ballPill, multPill, pauseBtn);
  const dmdCanvas = h('canvas', { class: 'g-pinball-dmd', role: 'status', 'aria-label': 'display' });
  const dmdWrap = h('div', { class: 'g-pinball-dmdwrap' }, dmdCanvas);
  const canvas = h('canvas', { class: 'g-pinball-canvas', role: 'img', 'aria-label': t('tableLabel') });
  const plungerBtn = h('button', { class: 'g-pinball-plunger', type: 'button', 'aria-label': t('plungerAria') }, h('b', {}, t('plunger')), h('i'));
  const nudgeBtn = h('button', { class: 'g-pinball-nudge', type: 'button', 'aria-label': t('nudgeAria') }, t('nudge'));
  const hintL = h('div', { class: 'g-pinball-fbtn left', 'aria-hidden': 'true', title: t('leftFlipper') }, h('i'));
  const hintR = h('div', { class: 'g-pinball-fbtn right', 'aria-hidden': 'true', title: t('rightFlipper') }, h('i'));
  const stage = h('div', { class: 'g-pinball-stage', role: 'group', 'aria-label': t('leftFlipper') + ' / ' + t('rightFlipper') }, canvas, hintL, hintR, plungerBtn, nudgeBtn);
  const fwCanvas = h('canvas', { class: 'g-pinball-fw', 'aria-hidden': 'true' });
  const menu = h('div', { class: 'g-pinball-menu', hidden: true });
  const overlay = h('div', { class: 'g-pinball-overlay', hidden: true });
  const backbox = h('div', { class: 'g-pinball-backbox' }, hud, dmdWrap);
  app.append(backbox, stage, fwCanvas, menu, overlay);
  root.append(app);

  const dmd = createDMD(dmdCanvas);
  const fw = createFireworks(fwCanvas);

  // ------------------------------------------------------------------ audio
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const sfx = {
    play: (n) => active() && ctx.sfx.play(n),
    tone: (o) => active() && ctx.sfx.tone(o),
    noise: (o) => active() && ctx.sfx.noise(o),
    vibrate: (p) => active() && ctx.sfx.vibrate(p),
  };
  const lastSnd = {};
  const gate = (key, ms) => {
    const n = performance.now();
    if (n - (lastSnd[key] || 0) < ms) return false;
    lastSnd[key] = n;
    return true;
  };
  const sndBtn = h('button', { class: 'g-pinball-snd', type: 'button', onclick: () => {
    ctx.sfx.muted = !ctx.sfx.muted;
    refreshSnd();
    if (!ctx.sfx.muted) sfx.play('select');
  } });
  function refreshSnd() {
    const on = !ctx.sfx.muted;
    sndBtn.innerHTML = on ? ICON.sndOn : ICON.sndOff;
    sndBtn.setAttribute('aria-label', on ? t('soundOn') : t('soundOff'));
    sndBtn.setAttribute('aria-pressed', String(on));
  }
  refreshSnd();
  ctx.setHeaderRight(sndBtn);

  // ------------------------------------------------------------------ state
  let alive = true;
  let ui = 'menu'; // menu | play | paused | result
  let game = null;
  let rend = null;
  let missionsRun = false;
  let finished = false;
  let shownScore = 0;
  let lastFrame = 0;
  let raf = 0;
  let selTable = rec.last;
  let nudgeSide = 1;
  let bonusTick = 0;
  let lastHud = '';
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  const padPointers = new Map();
  const keysDown = new Set();

  // ------------------------------------------------------------------ pre-rendered table art (Blender) with procedural fallback
  const artCache = {};
  function loadArt(id) {
    if (artCache[id]) return artCache[id];
    const u = (n) => new URL('./art/' + n, import.meta.url).href;
    const img = (src) => new Promise((res, rej) => {
      const i = new Image();
      i.decoding = 'async';
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('img ' + src));
      i.src = src;
    });
    artCache[id] = Promise.all([img(u(`base_${id}.webp`)), img(u(`ramp_${id}.webp`)), img(u(`sprites_${id}.webp`)), fetch(u(`inserts_${id}.json`)).then((r) => r.json())])
      .then(([base, ramp, spr, inserts]) => ({ base, ramp, spr, inserts, url: u(`base_${id}.webp`) }))
      .catch(() => null);
    return artCache[id];
  }

  // ------------------------------------------------------------------ layout
  function layout() {
    if (!alive) return;
    const w = root.clientWidth, hh = root.clientHeight;
    if (!w || !hh) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const dmdW = Math.min(w - 44, 380);
    const dmdH = Math.round(Math.min(44, Math.max(32, hh * 0.048)));
    dmdWrap.style.height = dmdH + 'px';
    dmdWrap.style.width = dmdW + 'px';
    dmd.resize(dmdW, dmdH, dpr);
    const bbH = backbox.offsetHeight || 112;
    const sh = hh - bbH - 4;
    const sw = Math.min(w, Math.floor(sh / 2));
    stage.style.height = sh + 'px';
    stage.style.width = sw + 'px';
    if (rend) rend.resize(sw, sh, dpr);
    fw.resize(w, hh, dpr);
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(root);

  // ------------------------------------------------------------------ helpers
  const tableLocked = (id) => !Rec.isUnlocked(rec, id);
  const missionText = (tb, i, full) => {
    const m = tb.missions[i];
    if (!m) return '';
    const goal = game && i === game.mi ? game.missionGoal() : m.goal;
    return full ? t('m_' + m.id, { goal }) : t('s_' + m.id);
  };

  // ------------------------------------------------------------------ menu
  function thumb(id, locked) {
    const wrap = h('div', { class: 'g-pinball-thumb' + (locked ? ' locked' : ''), 'aria-hidden': 'true' });
    loadArt(id).then((art) => {
      if (!alive) return;
      if (art) {
        const im = h('img', { src: art.url, alt: '', draggable: 'false' });
        wrap.append(im);
        return;
      }
      const tb = makeTable(id);
      const c = h('canvas', {});
      const r = createRenderer(c, tb, { reduced: true });
      r.resize(92, 184, 2);
      r.draw({ sim: new Sim(tb), phase: 'ready', charge: 0, lanes: tb.lanes.map((_, i) => i === 1), mbLit: false, multiball: false, mult: 2, saver: 0, skillT: 0, skillOpen: false, tilted: false, shake: 0 }, 1000);
      wrap.append(c);
    });
    return wrap;
  }
  function showMenu() {
    ui = 'menu';
    fw.stop();
    hideOverlay();
    app.classList.add('in-menu');
    menu.hidden = false;
    clear(menu);
    const sc = h('div', { class: 'g-pinball-menuscroll' });
    sc.append(h('div', { class: 'g-pinball-logo' }, h('h2', {}, t('menuTitle')), h('p', {}, t('menuSub'))));
    // tables
    const cards = h('div', { class: 'g-pinball-tables', role: 'radiogroup', 'aria-label': t('tables') });
    for (const id of TABLE_IDS) {
      const locked = tableLocked(id);
      const sel = selTable === id && !locked;
      const best = rec.best[id];
      const prog = Rec.unlockProgress(rec, id);
      const card = h('button', {
        class: 'g-pinball-tcard' + (sel ? ' sel' : '') + (locked ? ' locked' : ''),
        type: 'button',
        role: 'radio',
        'aria-checked': String(sel),
        'aria-disabled': String(locked),
        onclick: () => {
          if (locked) {
            toast(t('unlockHint', { score: fmt(prog.scoreGoal), m: prog.missionsGoal, have: prog.missions, need: prog.missionsGoal }));
            sfx.play('error');
            return;
          }
          selTable = id;
          sfx.play('select');
          showMenu();
        },
      },
      thumb(id, locked),
      h('div', { class: 'g-pinball-tinfo' },
        h('b', {}, t(TABLE_NAME[id])),
        h('span', {}, t(TABLE_SUB[id])),
        locked
          ? h('em', { class: 'lock' }, t('locked') + ' · ' + t('unlockHint', { score: fmt(prog.scoreGoal), m: prog.missionsGoal, have: prog.missions, need: prog.missionsGoal }))
          : h('em', {}, t('best') + ': ' + (best ? fmt(best) : t('noScore')))));
      if (locked) {
        const lk = h('i', { class: 'g-pinball-lockicon' });
        lk.innerHTML = ICON.lock;
        card.append(lk);
      }
      cards.append(card);
    }
    sc.append(cards);
    sc.append(h('button', { class: 'btn primary big block', type: 'button', onclick: () => startGame(selTable, false) }, t('start')));
    sc.append(h('button', { class: 'btn ghost block g-pinball-mbtn', type: 'button', onclick: () => startGame(selTable, true) }, h('span', {}, t('startMissions')), h('small', {}, t('startMissionsSub'))));
    // options
    const opts = h('div', { class: 'g-pinball-card' });
    opts.append(h('div', { class: 'g-pinball-sec' }, t('options')));
    const row1 = h('div', { class: 'g-pinball-row' }, h('span', {}, t('balls')));
    const chips = h('div', { class: 'chips' });
    for (const n of [3, 5]) {
      chips.append(h('button', { class: 'chip' + (rec.settings.balls === n ? ' active' : ''), type: 'button', 'aria-pressed': String(rec.settings.balls === n), onclick: () => {
        rec.settings.balls = n;
        saveRec();
        sfx.play('tap');
        showMenu();
      } }, t('ballsN', { n })));
    }
    row1.append(chips);
    const row2 = h('div', { class: 'g-pinball-row' }, h('span', {}, h('b', {}, t('shake')), h('small', {}, t('shakeSub'))));
    row2.append(h('button', { class: 'chip' + (rec.settings.shake ? ' active' : ''), type: 'button', 'aria-pressed': String(rec.settings.shake), onclick: () => {
      rec.settings.shake = !rec.settings.shake;
      saveRec();
      sfx.play('tap');
      if (rec.settings.shake) enableMotion();
      showMenu();
    } }, rec.settings.shake ? t('on') : t('off')));
    const row3 = h('div', { class: 'g-pinball-row' }, h('span', {}, t('sound')));
    const snd2 = h('button', { class: 'chip' + (!ctx.sfx.muted ? ' active' : ''), type: 'button', 'aria-pressed': String(!ctx.sfx.muted), onclick: () => {
      ctx.sfx.muted = !ctx.sfx.muted;
      refreshSnd();
      showMenu();
    } }, !ctx.sfx.muted ? t('on') : t('off'));
    row3.append(snd2);
    opts.append(row1, row2, row3);
    sc.append(opts);
    // stats
    sc.append(h('div', { class: 'g-pinball-card g-pinball-statsline' },
      h('span', {}, t('gamesPlayed', { n: rec.games })),
      h('span', {}, t('missionsDone', { n: rec.missions })),
      h('span', {}, t('bestMissions') + ': ' + (rec.bestMissions[selTable] ? fmt(rec.bestMissions[selTable]) : t('noScore')))));
    // how to
    const how = h('details', { class: 'g-pinball-card g-pinball-how' }, h('summary', {}, t('howTo')));
    for (let i = 1; i <= 7; i++) how.append(h('p', {}, t('how' + i)));
    sc.append(how);
    menu.append(sc);
  }

  // ------------------------------------------------------------------ game flow
  let starting = false;
  async function startGame(tableId, missions) {
    if (starting) return;
    if (tableLocked(tableId)) {
      toast(t('lockedMsg'));
      tableId = 'neon';
    }
    selTable = tableId;
    rec.last = tableId;
    saveRec();
    starting = true;
    const art = await loadArt(tableId);
    starting = false;
    if (!alive) return;
    missionsRun = missions;
    finished = false;
    game = new Game({ table: tableId, balls: rec.settings.balls, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, missionsMode: missions });
    rend = createRenderer(canvas, game.tb, { reduced, art });
    ui = 'play';
    menu.hidden = true;
    app.classList.remove('in-menu');
    hideOverlay();
    fw.stop();
    shownScore = 0;
    lastHud = '';
    padPointers.clear();
    keysDown.clear();
    app.classList.add('first');
    layout();
    ctx.setTitle(t(TABLE_NAME[tableId]));
    if (rec.settings.shake) enableMotion();
    lastFrame = performance.now();
  }
  function hideOverlay() {
    overlay.hidden = true;
    clear(overlay);
  }
  function pauseGame() {
    if (ui !== 'play') return;
    ui = 'paused';
    releaseAll();
    overlay.hidden = false;
    clear(overlay);
    const tb = game.tb;
    const list = h('ol', { class: 'g-pinball-mlist' });
    tb.missions.forEach((m, i) => {
      const done = game.mround > 0 || i < game.mi;
      const cur = i === game.mi && !game.allClear;
      list.append(h('li', { class: (done ? 'done' : '') + (cur ? ' cur' : '') }, h('span', {}, missionText(tb, i, true)), cur ? h('em', {}, game.mp + '/' + game.missionGoal()) : h('em', {}, done ? '✓' : '')));
    });
    overlay.append(h('div', { class: 'g-pinball-panel' },
      h('h3', {}, t('paused')),
      h('div', { class: 'g-pinball-sec' }, t('missionsTitle')),
      list,
      h('div', { class: 'g-pinball-actions' },
        h('button', { class: 'btn primary block', type: 'button', onclick: resumeGame }, t('resume')),
        h('button', { class: 'btn ghost block', type: 'button', onclick: () => startGame(game.tableId, missionsRun) }, t('restart')),
        h('button', { class: 'btn ghost block', type: 'button', onclick: async () => {
          const ok = await modal({ title: t('confirmQuit'), body: t('confirmQuitBody'), actions: [{ label: t('cancel'), value: false }, { label: t('quit'), value: true, danger: true }] });
          if (ok) showMenu();
        } }, t('quit')))));
  }
  function resumeGame() {
    if (ui !== 'paused') return;
    ui = 'play';
    hideOverlay();
    lastFrame = performance.now();
  }
  function releaseAll() {
    padPointers.clear();
    keysDown.clear();
    if (game) {
      game.pressFlipper('L', false);
      game.pressFlipper('R', false);
      game.plunger(false);
    }
    plungerBtn.classList.remove('down');
    hintL.classList.remove('down');
    hintR.classList.remove('down');
  }

  function finishGame() {
    if (finished) return;
    finished = true;
    const result = game.result();
    const r = Rec.applyResult(rec, result);
    rec = r.rec;
    saveRec();
    const xp = Rec.xpFor(result.score);
    ctx.addXP?.(xp);
    ui = 'result';
    releaseAll();
    overlay.hidden = false;
    clear(overlay);
    const st = result.stats;
    const lines = h('div', { class: 'g-pinball-lines' },
      h('div', {}, h('span', {}, t('bonusTotal')), h('b', {}, fmt(st.bonus))),
      h('div', {}, h('span', {}, t('missionsCleared')), h('b', {}, st.missions + '/' + game.tb.missions.length)),
      h('div', {}, h('span', {}, t('rampsHit')), h('b', {}, String(st.ramps))),
      h('div', {}, h('span', {}, t('maxCombo')), h('b', {}, 'x' + st.maxCombo)),
      h('div', {}, h('span', {}, t('multiballs')), h('b', {}, String(st.multiballs))));
    const big = h('div', { class: 'g-pinball-bigscore' }, '0');
    const panel = h('div', { class: 'g-pinball-panel result' },
      h('h3', {}, result.allClear ? t('dmdAllClear') : t('gameOver')),
      h('div', { class: 'g-pinball-sec' }, t('finalScore')),
      big,
      r.newRecord ? h('div', { class: 'g-pinball-badge' }, t('newRecord')) : null,
      h('div', { class: 'g-pinball-rank' }, t('rank') + ': ', h('b', {}, t('rank' + result.rank))),
      lines,
      r.unlockedNow.length ? h('div', { class: 'g-pinball-unlock' }, t('unlockedNow', { name: t(TABLE_NAME[r.unlockedNow[0]]) })) : null,
      h('div', { class: 'g-pinball-xp' }, t('xp', { n: xp })),
      h('div', { class: 'g-pinball-actions' },
        h('button', { class: 'btn primary block', type: 'button', onclick: () => startGame(result.table, missionsRun) }, t('playAgain')),
        h('button', { class: 'btn ghost block', type: 'button', onclick: showMenu }, t('toMenu'))));
    overlay.append(panel);
    // count-up
    const t0 = performance.now();
    const step = (now) => {
      if (!alive || ui !== 'result') return;
      const f = Math.min(1, (now - t0) / 1400);
      big.textContent = fmt(result.score * (1 - Math.pow(1 - f, 3)));
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    if (r.newRecord || result.rank >= 3) {
      fw.start();
      sfx.play('win');
    } else sfx.play('lose');
    sfx.vibrate([30, 40, 30]);
    if (r.unlockedNow.length) toast(t('unlockedNow', { name: t(TABLE_NAME[r.unlockedNow[0]]) }));
  }

  // ------------------------------------------------------------------ input
  function sideOf(e) {
    const r = stage.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? 'L' : 'R';
  }
  function syncFlippers() {
    if (!game || ui !== 'play') return;
    const sides = new Set(padPointers.values());
    for (const k of keysDown) {
      if (k === 'z' || k === 'arrowleft' || k === 'q') sides.add('L');
      if (k === 'm' || k === 'arrowright' || k === '/' || k === 'l') sides.add('R');
    }
    game.pressFlipper('L', sides.has('L'));
    game.pressFlipper('R', sides.has('R'));
    hintL.classList.toggle('down', sides.has('L'));
    hintR.classList.toggle('down', sides.has('R'));
  }
  stage.addEventListener('pointerdown', (e) => {
    if (ui !== 'play' || e.target.closest('button')) return;
    e.preventDefault();
    if (game.phase === 'bonus' && game.bonusT > 0.5) {
      game.finishBonus();
      return;
    }
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    padPointers.set(e.pointerId, sideOf(e));
    app.classList.remove('first');
    syncFlippers();
  });
  stage.addEventListener('pointermove', (e) => {
    if (padPointers.has(e.pointerId)) {
      padPointers.set(e.pointerId, sideOf(e));
      syncFlippers();
    }
  });
  const endPad = (e) => {
    if (padPointers.delete(e.pointerId)) syncFlippers();
  };
  stage.addEventListener('pointerup', endPad);
  stage.addEventListener('pointercancel', endPad);
  stage.addEventListener('lostpointercapture', endPad);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  const plungeDown = (e) => {
    if (ui !== 'play') return;
    e.preventDefault();
    e.stopPropagation();
    try {
      plungerBtn.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    plungerBtn.classList.add('down');
    game.plunger(true);
    sfx.play('tap');
  };
  const plungeUp = (e) => {
    e.stopPropagation();
    plungerBtn.classList.remove('down');
    if (game) game.plunger(false);
  };
  plungerBtn.addEventListener('pointerdown', plungeDown);
  plungerBtn.addEventListener('pointerup', plungeUp);
  plungerBtn.addEventListener('pointercancel', plungeUp);
  plungerBtn.addEventListener('lostpointercapture', plungeUp);
  const doNudge = () => {
    if (ui !== 'play' || !game) return;
    nudgeSide = -nudgeSide;
    game.nudge(nudgeSide);
  };
  nudgeBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    doNudge();
  });
  // keyboard
  const onKeyDown = (e) => {
    if (!alive) return;
    const k = e.key.toLowerCase();
    if (ui === 'play') {
      if (e.repeat && k !== 'n') {
        if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'z', 'm'].includes(k)) e.preventDefault();
        return;
      }
      if (k === ' ' || k === 'spacebar') {
        e.preventDefault();
        if (game.phase === 'bonus') game.finishBonus();
        else {
          game.plunger(true);
          plungerBtn.classList.add('down');
        }
      } else if (k === 'n' || k === 'arrowup') {
        e.preventDefault();
        doNudge();
      } else if (k === 'p') pauseGame();
      else if (['z', 'm', 'arrowleft', 'arrowright', 'q', '/', 'l'].includes(k)) {
        e.preventDefault();
        keysDown.add(k);
        app.classList.remove('first');
        syncFlippers();
      }
    } else if (ui === 'paused' && (k === 'p')) resumeGame();
  };
  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    if (ui === 'play') {
      if (k === ' ' || k === 'spacebar') {
        game.plunger(false);
        plungerBtn.classList.remove('down');
      }
      if (keysDown.delete(k)) syncFlippers();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // shake to nudge
  let lastShake = 0;
  let motionOn = false;
  const onMotion = (e) => {
    if (!rec.settings.shake || ui !== 'play') return;
    const a = e.acceleration || e.accelerationIncludingGravity;
    if (!a) return;
    const m = Math.hypot(a.x || 0, a.y || 0, e.acceleration ? a.z || 0 : 0);
    const now = performance.now();
    if (m > (e.acceleration ? 14 : 28) && now - lastShake > 700) {
      lastShake = now;
      game.nudge(a.x >= 0 ? -1 : 1);
    }
  };
  async function enableMotion() {
    if (motionOn) return;
    try {
      const DM = window.DeviceMotionEvent;
      if (DM && typeof DM.requestPermission === 'function') {
        const r = await DM.requestPermission();
        if (r !== 'granted') return;
      }
      window.addEventListener('devicemotion', onMotion);
      motionOn = true;
    } catch {
      /* not available */
    }
  }
  const onVis = () => {
    if (document.hidden && ui === 'play') pauseGame();
  };
  document.addEventListener('visibilitychange', onVis);

  // ------------------------------------------------------------------ effects (sounds, sparks, popups)
  function handleFx(list) {
    const tb = game.tb;
    const sl = (side) => tb.slings.find((s) => s.side === side);
    for (const e of list) {
      switch (e.t) {
        case 'flipUp':
          if (gate('flip', 40)) {
            sfx.tone({ freq: 150, to: 70, dur: 0.07, type: 'square', vol: 0.3 });
            sfx.noise({ dur: 0.03, vol: 0.18, freq: 1500, q: 0.8 });
            sfx.vibrate(8);
          }
          break;
        case 'bumper':
          sfx.tone({ freq: 480 + e.i * 170, to: 700 + e.i * 200, dur: 0.12, type: 'triangle', vol: 0.4 });
          sfx.noise({ dur: 0.03, vol: 0.12, freq: 3000, q: 1.5 });
          rend.spark(e.x, e.y, e.i % 2 ? game.tb.theme.glow2 : game.tb.theme.glow, 9, 190);
          if (gate('bv', 60)) sfx.vibrate(10);
          break;
        case 'sling': {
          const s = sl(e.side);
          const p = s.pts;
          rend.spark((p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2, '#ffffff', 6, 150);
          sfx.tone({ freq: 300, to: 190, dur: 0.07, type: 'square', vol: 0.22 });
          sfx.noise({ dur: 0.04, vol: 0.14, freq: 2200 });
          break;
        }
        case 'standup': {
          const s = tb.standups[e.i];
          rend.spark((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, '#ff9a55', 8, 150);
          rend.popup((s.x1 + s.x2) / 2 + (s.x1 < XC ? 20 : -20), (s.y1 + s.y2) / 2, '+' + fmt(SCORE.standup * game.mult), '#ffb36b');
          sfx.tone({ freq: 880, dur: 0.1, type: 'sine', vol: 0.35 });
          sfx.vibrate(12);
          break;
        }
        case 'drop': {
          const d = tb.drops[e.i];
          rend.spark(d.x, d.y, '#ffd24a', 8, 130);
          sfx.noise({ dur: 0.05, vol: 0.3, freq: 1600, q: 1 });
          sfx.tone({ freq: 330 - e.i * 20, to: 200, dur: 0.1, type: 'square', vol: 0.2 });
          sfx.vibrate(14);
          break;
        }
        case 'bank':
          rend.popup(tb.drops[0].x + (tb.drops[0].face === 'L' ? -40 : 40), tb.drops[0].y, '+' + fmt(SCORE.bank * game.mult), '#ffe14d');
          [523, 659, 784].forEach((f, i) => sfx.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.3, delay: i * 0.07 }));
          break;
        case 'spin':
          if (gate('spin', 28)) sfx.tone({ freq: 1500 + Math.random() * 200, dur: 0.02, type: 'square', vol: 0.07 });
          break;
        case 'lane': {
          const l = tb.lanes[e.i];
          rend.spark(l.x, l.y, tb.theme.glow2, 6, 100);
          sfx.tone({ freq: 620 + e.i * 90, dur: 0.1, type: 'sine', vol: 0.32 });
          break;
        }
        case 'lanesDone':
          [660, 880, 1100].forEach((f, i) => sfx.tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.3, delay: i * 0.06 }));
          break;
        case 'inlane':
          sfx.tone({ freq: 420, dur: 0.05, type: 'sine', vol: 0.16 });
          break;
        case 'outlane':
          sfx.tone({ freq: 240, to: 160, dur: 0.15, type: 'sawtooth', vol: 0.18 });
          break;
        case 'kickback':
          sfx.noise({ dur: 0.25, vol: 0.3, freq: 700, q: 0.6 });
          sfx.tone({ freq: 90, to: 200, dur: 0.18, type: 'sine', vol: 0.5 });
          sfx.vibrate(30);
          break;
        case 'rampEnter':
          sfx.noise({ dur: 0.5, vol: 0.28, freq: 1100, q: 0.5 });
          sfx.tone({ freq: 300, to: 900, dur: 0.45, type: 'sine', vol: 0.18 });
          break;
        case 'ramp': {
          const ex = tb.ramps[e.i].exit;
          rend.spark(ex.x, ex.y, '#ffffff', 12, 180);
          rend.popup(ex.x - 30, ex.y + 10, '+' + fmt(SCORE.ramp * game.mult), '#8fe3ff');
          sfx.tone({ freq: 700, to: 1200, dur: 0.12, type: 'triangle', vol: 0.3 });
          sfx.vibrate(20);
          break;
        }
        case 'wall':
          if (gate('wall', 70)) sfx.tone({ freq: 700 + Math.random() * 120, to: 400, dur: 0.035, type: 'triangle', vol: Math.min(0.2, 0.04 + e.sp / 9000) });
          break;
        case 'plunge':
          sfx.noise({ dur: 0.12, vol: 0.35, freq: 600, q: 0.7 });
          sfx.tone({ freq: 140, to: 50, dur: 0.15, type: 'sine', vol: 0.6 });
          sfx.vibrate(24);
          break;
        case 'combo':
          sfx.tone({ freq: 500 + Math.min(e.n, 10) * 70, dur: 0.1, type: 'square', vol: 0.18 });
          break;
        case 'mult':
          [440, 554, 659, 880].forEach((f, i) => sfx.tone({ freq: f, dur: 0.1, type: 'square', vol: 0.16, delay: i * 0.05 }));
          break;
        case 'mission':
        case 'skill':
        case 'allClear':
          [523, 659, 784, 1047, 1319].forEach((f, i) => sfx.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.34, delay: i * 0.08 }));
          sfx.vibrate([20, 30, 20]);
          break;
        case 'multiball':
        case 'jackpot':
          [392, 523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => sfx.tone({ freq: f, dur: 0.14, type: 'square', vol: 0.2, delay: i * 0.07 }));
          sfx.vibrate([30, 30, 60]);
          break;
        case 'saved':
          sfx.tone({ freq: 660, dur: 0.12, type: 'triangle', vol: 0.3 });
          sfx.tone({ freq: 440, dur: 0.18, type: 'triangle', vol: 0.3, delay: 0.1 });
          break;
        case 'nudge':
          sfx.noise({ dur: 0.12, vol: 0.3, freq: 300, q: 0.4 });
          sfx.tone({ freq: 80, dur: 0.1, type: 'sine', vol: 0.4 });
          sfx.vibrate(25);
          break;
        case 'tilt':
          sfx.tone({ freq: 160, to: 90, dur: 0.7, type: 'sawtooth', vol: 0.4 });
          sfx.vibrate([80, 40, 80, 40, 200]);
          break;
        case 'drain':
          if (!e.lost && game.saver <= 0 && game.phase === 'play') {
            sfx.tone({ freq: 330, to: 70, dur: 0.55, type: 'sawtooth', vol: 0.28 });
            sfx.vibrate(60);
          }
          break;
        case 'bonus':
          bonusTick = 0;
          break;
        case 'over':
          break;
        default:
      }
    }
  }

  // ------------------------------------------------------------------ DMD content
  function dmdContent() {
    if (ui === 'paused') return [t('dmdPaused'), null, '#ffb347'];
    if (game.phase === 'bonus' && game.bonusInfo) {
      const bi = game.bonusInfo;
      if (bi.tilt) return [t('dmdNoBonus'), t('tiltLine'), '#ff5a4a'];
      const f = Math.min(1, game.bonusT / 1.8);
      return [t('dmdBonus') + ' ' + fmt(bi.total * (1 - Math.pow(1 - f, 2))), t('bonusLine', { base: fmt(bi.base), mult: bi.mult }), '#ffd24a'];
    }
    if (game.phase === 'over') return [t('dmdGameOver'), null, '#ff5a4a'];
    if (game.msg.t > 0 && game.msg.key) {
      const key = MSG_KEY[game.msg.key];
      const col = game.msg.key === 'tilt' || game.msg.key === 'danger' ? '#ff4a3d' : game.msg.key === 'jackpot' || game.msg.key === 'multiball' ? '#ffe14d' : '#ffb347';
      let txt = t(key, game.msg.params);
      if (game.msg.key === 'ballN') {
        txt = t('dmdBall', { n: game.ballNo });
      }
      const blink = game.msg.t < 0.35 && Math.floor(game.msg.t * 20) % 2 ? 1 : 0;
      return blink ? [' ', null, col] : [txt, game.msg.key === 'ballN' ? t('holdHint') : null, col];
    }
    if (game.phase === 'ready') return [t('holdHint'), t('ball') + ' ' + game.ballNo + '/' + game.ballsTotal, '#ffb347'];
    // idle: the active mission
    if (game.allClear) return [t('dmdAllClear'), null, '#ffe14d'];
    const m = game.tb.missions[game.mi];
    if (m) {
      const label = t('s_' + m.id);
      return [label + ' ' + game.mp + '/' + game.missionGoal(), 'x' + game.mult + (game.combo >= 2 ? '  COMBO ' + game.combo : '') + (game.mbLit ? '  ML' : ''), '#ffb347'];
    }
    return ['x' + game.mult, null, '#ffb347'];
  }

  // ------------------------------------------------------------------ frame loop
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    fw.tick(dt);
    if (!game || ui === 'menu') return;
    if (ui === 'play') {
      game.update(dt);
      const fx = game.takeFx();
      if (fx.length) handleFx(fx);
      if (game.phase === 'bonus' && gate('btick', 140) && game.bonusT < 1.8) sfx.tone({ freq: 900 + game.bonusT * 300, dur: 0.03, type: 'square', vol: 0.07 });
      if (game.phase === 'over') finishGame();
    }
    // HUD
    const diff = game.score - shownScore;
    shownScore = Math.abs(diff) < 1 ? game.score : shownScore + diff * Math.min(1, dt * 9);
    const hs = fmt(shownScore);
    const hk = hs + '|' + game.ballNo + '|' + game.mult + '|' + game.ballsTotal;
    if (hk !== lastHud) {
      lastHud = hk;
      scoreEl.textContent = hs;
      ballPill.innerHTML = '';
      ballPill.append(h('small', {}, t('ball')), h('b', {}, Math.min(game.ballNo, game.ballsTotal) + '/' + game.ballsTotal));
      multPill.innerHTML = '';
      multPill.append(h('small', {}, 'MULT'), h('b', {}, 'x' + game.mult));
    }
    // plunger button
    const showPl = ui === 'play' && game.phase === 'ready';
    plungerBtn.classList.toggle('hide', !showPl);
    if (showPl) plungerBtn.style.setProperty('--p', String(game.charge));
    nudgeBtn.classList.toggle('hide', !(game.phase === 'play'));
    nudgeBtn.classList.toggle('warn', game.tiltMeter >= 2);
    const [m1, m2, col] = dmdContent();
    dmd.show(m1, m2, col);
    rend.draw(game, now);
  }

  // ------------------------------------------------------------------ back button
  ctx.onBack(() => {
    if (ui === 'play') {
      pauseGame();
      return true;
    }
    if (ui === 'paused') {
      resumeGame();
      return true;
    }
    if (ui === 'result') {
      showMenu();
      return true;
    }
    return false;
  });

  // ------------------------------------------------------------------ start
  layout();
  if (ctx.mode === 'space') {
    if (tableLocked('space')) {
      toast(t('lockedMsg'));
      startGame('neon', false);
    } else startGame('space', false);
  } else if (ctx.mode === 'classic') startGame('neon', false);
  else if (ctx.mode === 'missions') startGame(tableLocked(rec.last) ? 'neon' : rec.last, true);
  else showMenu();
  lastFrame = performance.now();
  raf = requestAnimationFrame(frame);
  void UNLOCK;
  void rankFor;

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('devicemotion', onMotion);
    document.removeEventListener('visibilitychange', onVis);
    ctx.setHeaderRight(null);
    ctx.setTitle();
    fw.stop();
  };
}
