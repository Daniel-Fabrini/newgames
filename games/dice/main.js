// Five Dice — an original dice-poker game (13 boxes, 3 rolls per turn).
//   Menu → (setup for local) → match → results; stats and rules are reachable everywhere.
//   Modes (ctx.mode): classic (1 player), ai (vs computer), local (2–4 hot-seat).
//   The rules live in rules.js (pure + unit-tested), the computer player in ai.js and the
//   3D dice in dice3d.js. Matches autosave to ctx.store and resume with the same RNG state.

import STRINGS from './strings.js';
import * as R from './rules.js';
import { chooseHold, chooseCategory } from './ai.js';
import * as D from './dice3d.js';

const SAVE_VERSION = 1;
const MODES = ['classic', 'ai', 'local'];
const MODE_ICON = {
  classic: '<circle cx="12" cy="8" r="3.6" fill="currentColor"/><path d="M5 20c.6-3.6 3.6-5.6 7-5.6s6.4 2 7 5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ai: '<rect x="5" y="7" width="14" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="9.5" cy="12.4" r="1.4" fill="currentColor"/><circle cx="14.5" cy="12.4" r="1.4" fill="currentColor"/><path d="M12 7V4.2M9.5 4.2h5" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
  local: '<circle cx="8.5" cy="9" r="3" fill="currentColor"/><circle cx="16" cy="10" r="2.5" fill="currentColor" opacity=".7"/><path d="M2.8 19c.4-3 2.7-4.7 5.7-4.7s5.3 1.7 5.7 4.7M14.6 15c2.9-.5 5.8.8 6.4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
const svg = (inner, cls = '') => `<svg class="g-dice-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICON = {
  help: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>'),
  stats: svg('<path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  rules: svg('<path d="M6 4h9l3 3v13H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 11h6M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  play: svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
  resume: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
};

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const store = ctx.store;
  const sfx = ctx.sfx;
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMq.matches;

  // ---------- lifecycle helpers ----------
  let disposed = false;
  const timers = new Set();
  const rafs = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const sleep = (ms) => new Promise((res) => later(res, ms));
  let scopeCleanups = [];
  const onScope = (fn) => scopeCleanups.push(fn);
  const listen = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    onScope(() => target.removeEventListener(ev, fn, opts));
  };

  function tween(from, to, ms, fn) {
    if (reduce() || from === to) return fn(to);
    const t0 = performance.now();
    let id;
    const step = (now) => {
      rafs.delete(id);
      if (disposed) return;
      const k = Math.min(1, (now - t0) / ms);
      fn(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) {
        id = requestAnimationFrame(step);
        rafs.add(id);
      }
    };
    id = requestAnimationFrame(step);
    rafs.add(id);
  }
  // animate a number element from its previous value
  function setNum(el, to, ms = 520) {
    const from = Number(el.dataset.v ?? to);
    el.dataset.v = to;
    tween(from, to, ms, (v) => (el.textContent = v));
  }

  // ---------- state ----------
  const stage = h('div', { class: 'g-dice-app' });
  root.append(stage);
  let match = null; // { g, mode, view, sel, selAt, busy, rollLock, tok, ui, dice, ... }
  let backFn = () => false;
  let dialogOpen = null; // close fn
  let keyHandler = null;
  ctx.onBack(() => {
    if (dialogOpen) {
      dialogOpen(null);
      return true;
    }
    return backFn();
  });

  const loadSave = () => {
    const s = store.get('save', null);
    if (!s || s.v !== SAVE_VERSION || !s.g || !s.g.players || s.g.over) return null;
    return s;
  };
  const getStats = () => ({ games: 0, wins: 0, best: 0, sum: 0, n: 0, fives: 0, bonuses: 0, history: [], ...(store.get('stats', {}) || {}) });
  const prefs = () => ({ mode: 'classic', names: [], count: 2, ...(store.get('prefs', {}) || {}) });
  const setPrefs = (p) => store.set('prefs', { ...prefs(), ...p });
  const catName = (c) => t('c_' + c);
  const modeName = (m) => t('mode_' + m);
  const seedNow = () => {
    try {
      return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    } catch {
      return (Math.random() * 4294967295) >>> 0 || 1;
    }
  };
  const fmtDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString(ctx.lang === 'pt' ? 'pt-BR' : ctx.lang, { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  // ---------- generic UI bits ----------
  function show(node, cls = '') {
    scopeCleanups.forEach((f) => f());
    scopeCleanups = [];
    keyHandler = null;
    if (match) match.tok++;
    ctx.setHeaderRight(null);
    clear(stage);
    node.classList.add('g-dice-screen', 'g-dice-enter');
    if (cls) node.classList.add(cls);
    stage.append(node);
    return node;
  }

  function btn(label, { cls = '', onclick, icon = '', aria } = {}) {
    return h('button', { class: `g-dice-btn ${cls}`, type: 'button', onclick, 'aria-label': aria || null }, icon ? h('span', { class: 'g-dice-btn-ico', html: icon }) : null, h('span', null, label));
  }

  // dialog: returns Promise of the chosen value (null when dismissed)
  function dialog({ title, body, actions, className = '' }) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const close = (v) => {
        if (dialogOpen !== close) return;
        dialogOpen = null;
        overlay.classList.remove('show');
        later(() => overlay.remove(), 200);
        try {
          prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
        resolve(v);
      };
      const acts = h(
        'div',
        { class: 'g-dice-dlg-actions' },
        actions.map((a) => h('button', { type: 'button', class: `g-dice-btn ${a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'}`, onclick: () => close(a.value) }, a.label)),
      );
      const box = h('div', { class: `g-dice-dlgbox ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', { class: 'g-dice-dlg-title' }, title), h('div', { class: 'g-dice-dlg-body' }, body), acts);
      const overlay = h('div', { class: 'g-dice-dlg' }, box);
      overlay.addEventListener('pointerdown', (e) => e.target === overlay && close(null));
      if (dialogOpen) dialogOpen(null);
      dialogOpen = close;
      root.append(overlay);
      requestAnimationFrame(() => {
        overlay.classList.add('show');
        const first = acts.querySelector('.primary') || acts.querySelector('button');
        first && first.focus({ preventScroll: true });
      });
    });
  }

  // ---------- rules text ----------
  function rulesBody() {
    const cats = R.CATS.map((c) => h('div', { class: 'g-dice-rrow' }, h('b', null, catName(c)), h('span', null, t('d_' + c))));
    return h(
      'div',
      { class: 'g-dice-rules' },
      h('p', null, t('ruleGoal')),
      h('h3', null, t('ruleTurnH')),
      h('p', null, t('ruleTurn')),
      h('h3', null, t('ruleCatsH')),
      h('div', { class: 'g-dice-rtable' }, cats),
      h('h3', null, t('ruleBonusH')),
      h('p', null, t('ruleBonus')),
      h('h3', null, t('ruleFiveH')),
      h('p', null, t('ruleFive')),
      h('h3', null, t('ruleJokerH')),
      h('p', null, t('ruleJoker')),
      h('h3', null, t('ruleKeysH')),
      h('p', null, t('ruleKeys')),
    );
  }
  const openRules = () => dialog({ title: t('rules'), body: rulesBody(), actions: [{ label: t('close'), value: true, primary: true }], className: 'wide' });

  // ======================================================================
  //  MENU
  // ======================================================================
  function showMenu() {
    backFn = () => false;
    const save = loadSave();
    const p = prefs();
    let mode = MODES.includes(p.mode) ? p.mode : 'classic';

    // hero: three dice idling in 3D, tap to throw them
    const heroDice = [D.makeDie(), D.makeDie(), D.makeDie()];
    const hero = h('button', { class: 'g-dice-hero', type: 'button', 'aria-label': t('heroLabel') });
    const heroStage = h('div', { class: 'g-dice-herostage' }, heroDice.map((d) => d.slot));
    hero.append(heroStage);
    const poses = [
      { v: 5, x: 0.2, cy: 0.56, s: 1.0, yaw: -18, phase: 0 },
      { v: 1, x: 0.5, cy: 0.4, s: 1.2, yaw: -34, phase: 120 },
      { v: 3, x: 0.8, cy: 0.6, s: 0.94, yaw: -10, phase: 240 },
    ];
    const layoutHero = () => {
      const W = heroStage.clientWidth || 300;
      const H = heroStage.clientHeight || 160;
      const S = Math.max(54, Math.min(78, Math.floor(W / 4.4), Math.floor(H / 1.9)));
      heroStage.style.setProperty('--s', S + 'px');
      heroDice.forEach((d, i) => {
        const q = poses[i];
        d.slot.style.transform = `translate(${Math.round(W * q.x - S / 2)}px,${Math.round(H * q.cy - S / 2)}px) scale(${q.s})`;
      });
    };
    heroDice.forEach((d, i) => {
      const q = poses[i];
      D.orient(d, q.v, { yaw: q.yaw, z: 0 });
      d.slot.style.transition = 'none';
      d.slot.classList.add('is-hero');
    });
    const startIdle = () => {
      if (reduce()) return;
      heroDice.forEach((d, i) => D.startSpin(d, { period: 16000 + i * 3500, phase: poses[i].phase }));
    };
    hero.addEventListener('click', () => {
      sfx.noise({ dur: 0.05, vol: 0.12, freq: 2200, q: 1.2 });
      heroDice.forEach((d, i) => {
        D.rollDie(d, 1 + Math.floor(Math.random() * 6), { delay: i * 60, reduce: reduce(), duration: 640 });
        later(() => d.anims.length === 0 && D.startSpin(d), 800);
        sfx.tone({ freq: 220, to: 130, dur: 0.07, type: 'triangle', vol: 0.12, delay: 0.3 + i * 0.07 });
      });
      later(() => {
        if (!reduce()) heroDice.forEach((d, i) => D.startSpin(d, { period: 16000 + i * 3500, phase: 0 }));
      }, 900);
    });

    const modeBtns = MODES.map((m) =>
      h(
        'button',
        {
          class: 'g-dice-mode',
          type: 'button',
          role: 'radio',
          'aria-checked': String(m === mode),
          onclick: () => {
            mode = m;
            setPrefs({ mode });
            modeBtns.forEach((b, i) => b.setAttribute('aria-checked', String(MODES[i] === mode)));
          },
        },
        h('span', { class: 'g-dice-mode-ico', html: svg(MODE_ICON[m]) }),
        h('b', null, modeName(m)),
        h('small', null, t('modeSub_' + m)),
      ),
    );

    const continueCard = save
      ? h(
          'button',
          { class: 'g-dice-continue', type: 'button', onclick: () => resumeMatch(save) },
          h('span', { class: 'g-dice-continue-ico', html: ICON.resume }),
          h('span', { class: 'g-dice-continue-txt' }, h('b', null, t('continue')), h('small', null, t('continueInfo', { mode: modeName(save.mode), turn: save.g.turn, total: 13, score: R.totalScore(save.g.players[0].sheet) }))),
          h('span', { class: 'g-dice-chev', html: svg('<path d="m9.5 5.5 6.5 6.5-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>') }),
        )
      : null;

    const menu = h(
      'div',
      { class: 'g-dice-menu' },
      h('header', { class: 'g-dice-brand' }, logoSvg(), h('h1', null, t('name')), h('p', null, t('tagline'))),
      hero,
      continueCard,
      h('div', { class: 'g-dice-modes', role: 'radiogroup', 'aria-label': t('modeLabel') }, modeBtns),
      btn(t('play'), { cls: 'primary lg block', icon: ICON.play, onclick: () => beginMode(mode) }),
      h('div', { class: 'g-dice-links' }, btn(t('stats'), { cls: 'link', icon: ICON.stats, onclick: showStats }), btn(t('rules'), { cls: 'link', icon: ICON.rules, onclick: openRules })),
    );
    show(menu);
    layoutHero();
    startIdle();
    const ro = new ResizeObserver(layoutHero);
    ro.observe(heroStage);
    onScope(() => {
      ro.disconnect();
      heroDice.forEach(D.stopAnims);
    });
  }

  function logoSvg() {
    const w = h('div', { class: 'g-dice-logo', 'aria-hidden': 'true' });
    w.innerHTML =
      '<svg viewBox="0 0 48 48"><defs><linearGradient id="gdl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fc2ff"/><stop offset="1" stop-color="#3f7bf0"/></linearGradient></defs><rect x="5" y="5" width="38" height="38" rx="11" fill="url(#gdl)"/><rect x="5.5" y="5.5" width="37" height="37" rx="10.5" fill="none" stroke="#fff" stroke-opacity=".35"/><g fill="#0b1020"><circle cx="16" cy="16" r="3.2"/><circle cx="32" cy="16" r="3.2"/><circle cx="24" cy="24" r="3.2"/><circle cx="16" cy="32" r="3.2"/><circle cx="32" cy="32" r="3.2"/></g></svg>';
    return w;
  }

  async function beginMode(mode) {
    const save = loadSave();
    if (save) {
      const ok = await dialog({
        title: t('replaceTitle'),
        body: h('p', null, t('replaceText')),
        actions: [
          { label: t('keepPlaying'), value: 'resume', primary: true },
          { label: t('newMatch'), value: 'new', danger: true },
        ],
      });
      if (ok === 'resume') return resumeMatch(save);
      if (ok !== 'new') return;
    }
    if (mode === 'local') return showSetup();
    startNew(mode, defaultPlayers(mode));
  }

  const defaultPlayers = (mode) => (mode === 'ai' ? [{ name: t('you') }, { name: t('computer'), ai: true }] : [{ name: t('you') }]);

  // ======================================================================
  //  LOCAL SETUP
  // ======================================================================
  function showSetup() {
    backFn = () => (showMenu(), true);
    const p = prefs();
    let count = Math.max(2, Math.min(4, p.count || 2));
    const inputs = [0, 1, 2, 3].map((i) =>
      h('input', { class: 'g-dice-input', type: 'text', maxlength: '14', autocomplete: 'off', value: p.names[i] || '', placeholder: t('playerN', { n: i + 1 }), 'aria-label': t('playerN', { n: i + 1 }) }),
    );
    const rows = inputs.map((inp, i) => h('label', { class: 'g-dice-field' }, h('span', { class: 'g-dice-field-n' }, i + 1), inp));
    const chips = [2, 3, 4].map((n) =>
      h(
        'button',
        {
          class: 'g-dice-chip',
          type: 'button',
          role: 'radio',
          'aria-checked': String(n === count),
          onclick: () => {
            count = n;
            sync();
          },
        },
        h('b', null, n),
        h('small', null, t('playersWord')),
      ),
    );
    const sync = () => {
      chips.forEach((c, i) => c.setAttribute('aria-checked', String(i + 2 === count)));
      rows.forEach((r, i) => r.classList.toggle('is-off', i >= count));
      inputs.forEach((inp, i) => (inp.disabled = i >= count));
    };
    const go = () => {
      const names = inputs.map((inp, i) => inp.value.trim() || t('playerN', { n: i + 1 }));
      setPrefs({ count, names: inputs.map((i) => i.value.trim()) });
      startNew('local', names.slice(0, count).map((name) => ({ name })));
    };
    const node = h(
      'div',
      { class: 'g-dice-setup' },
      h('header', { class: 'g-dice-pagehead' }, h('h2', null, t('setupTitle')), h('p', null, t('setupSub'))),
      h('div', { class: 'g-dice-chips', role: 'radiogroup', 'aria-label': t('playersWord') }, chips),
      h('div', { class: 'g-dice-fields' }, rows),
      h('div', { class: 'g-dice-stack' }, btn(t('start'), { cls: 'primary lg block', icon: ICON.play, onclick: go }), btn(t('back'), { cls: 'ghost block', onclick: showMenu })),
    );
    show(node);
    sync();
  }

  // ======================================================================
  //  STATS
  // ======================================================================
  function showStats() {
    backFn = () => (showMenu(), true);
    const s = getStats();
    const avg = s.n ? Math.round(s.sum / s.n) : 0;
    const tile = (label, value, accent) => h('div', { class: `g-dice-tile ${accent ? 'accent' : ''}` }, h('b', null, value), h('span', null, label));
    const hist = s.history.length
      ? h(
          'ol',
          { class: 'g-dice-hist' },
          s.history.map((e) =>
            h(
              'li',
              null,
              h('span', { class: 'g-dice-hist-date' }, fmtDate(e.t)),
              h('span', { class: 'g-dice-hist-mode' }, modeName(e.mode)),
              h('span', { class: 'g-dice-hist-vs' }, e.mode === 'classic' ? '' : e.players.map((q) => q.total).join(' · ')),
              h('b', { class: 'g-dice-hist-score' }, e.score),
              h('span', { class: `g-dice-tag ${e.result}` }, t('res_' + e.result)),
            ),
          ),
        )
      : h('p', { class: 'g-dice-empty' }, t('noHistory'));
    const node = h(
      'div',
      { class: 'g-dice-stats' },
      h('header', { class: 'g-dice-pagehead' }, h('h2', null, t('stats')), h('p', null, t('statsSub'))),
      h('div', { class: 'g-dice-tiles' }, tile(t('sBest'), s.best || '–', true), tile(t('sAvg'), s.n ? avg : '–'), tile(t('sGames'), s.games), tile(t('sWins'), s.wins), tile(t('sFives'), s.fives), tile(t('sBonuses'), s.bonuses)),
      h('h3', { class: 'g-dice-sub' }, t('sHistory')),
      hist,
      btn(t('back'), { cls: 'ghost block', onclick: showMenu }),
    );
    show(node);
  }

  // ======================================================================
  //  MATCH
  // ======================================================================
  function persist() {
    if (!match || match.g.over) return;
    store.set('save', { v: SAVE_VERSION, mode: match.mode, g: match.g, t: Date.now() });
  }

  function startNew(mode, players) {
    const g = R.newGame({ players, seed: seedNow() });
    match = { g, mode, view: null, sel: null, selAt: 0, busy: false, rollLock: false, tok: 0, fresh: true, ui: null };
    persist();
    showMatch();
  }

  function resumeMatch(save) {
    match = { g: save.g, mode: save.mode, view: null, sel: null, selAt: 0, busy: false, rollLock: false, tok: 0, fresh: false, ui: null };
    showMatch();
  }

  const cur = () => match.g.players[match.g.cur];
  const humanTurn = () => !match.g.over && !cur().ai;
  const live = (text) => {
    const el = match && match.ui && match.ui.live;
    if (!el) return;
    el.textContent = '';
    later(() => (el.textContent = text), 40);
  };

  function showMatch() {
    const g = match.g;
    const multi = g.players.length > 1;
    const M = match;
    const ui = (M.ui = { rows: {}, dice: [], strip: [] });
    backFn = () => {
      leaveMatch();
      return true;
    };

    // header "?" button (pause + rules)
    const hb = h('button', { class: 'g-dice-hbtn', type: 'button', 'aria-label': t('pause'), onclick: () => pauseMenu(), html: ICON.help });

    ui.strip = multi
      ? g.players.map((p, i) => {
          const total = h('b', { class: 'g-dice-chip-total', 'data-v': R.totalScore(p.sheet) }, R.totalScore(p.sheet));
          const b = h('button', { class: 'g-dice-pchip', type: 'button', onclick: () => viewPlayer(i) }, h('span', { class: 'g-dice-pchip-dot' }), h('span', { class: 'g-dice-pchip-name' }, p.name), total);
          b._total = total;
          return b;
        })
      : [];

    ui.turn = h('span', { class: 'g-dice-turn' });
    ui.dots = h('span', { class: 'g-dice-dots', role: 'img' }, [0, 1, 2].map(() => h('i')));
    ui.total = h('b', { class: 'g-dice-total', 'data-v': '0' }, '0');
    const hud = h(
      'div',
      { class: 'g-dice-hud' },
      multi ? h('div', { class: 'g-dice-strip', role: 'group', 'aria-label': t('players') }, ui.strip) : null,
      h('div', { class: 'g-dice-hudrow' }, h('div', { class: 'g-dice-hudl' }, ui.turn), ui.dots, h('div', { class: 'g-dice-hudr' }, h('span', null, t('total')), ui.total)),
    );

    // table with dice
    ui.table = h('div', { class: 'g-dice-table', role: 'group', 'aria-label': t('diceGroup') });
    ui.tray = h('div', { class: 'g-dice-tray' }, h('span', { class: 'g-dice-tray-label' }, t('tray')), [0, 1, 2, 3, 4].map(() => h('i')));
    ui.table.append(ui.tray);
    for (let i = 0; i < 5; i++) {
      const d = D.makeDie();
      d.jx = 0;
      d.jy = 0;
      d.slot.setAttribute('role', 'button');
      d.slot.setAttribute('tabindex', '0');
      d.slot.addEventListener('click', () => holdDie(i));
      d.slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          holdDie(i);
        }
      });
      d.slot.classList.add('is-idle');
      ui.table.append(d.slot);
      ui.dice.push(d);
    }

    // actions
    ui.actions = h('div', { class: 'g-dice-actions' });

    // sheet
    ui.live = h('div', { class: 'g-dice-sr', 'aria-live': 'polite', role: 'status' });
    ui.upperSum = h('span', { class: 'g-dice-colsum' });
    ui.lowerSum = h('span', { class: 'g-dice-colsum' });
    const mkRow = (cat) => {
      const idx = R.UPPER.indexOf(cat);
      const val = h('span', { class: 'g-dice-rv' });
      const badge = h('span', { class: 'g-dice-rbadge' });
      const r = h(
        'button',
        { class: 'g-dice-row', type: 'button', 'data-cat': cat, onclick: () => pickCat(cat), onkeydown: rowKey },
        h('span', { class: 'g-dice-rl' }, idx >= 0 ? D.miniFace(idx + 1) : null, h('span', { class: 'g-dice-rn' }, catName(cat))),
        badge,
        val,
      );
      r._val = val;
      r._badge = badge;
      ui.rows[cat] = r;
      return r;
    };
    ui.bonus = h('div', { class: 'g-dice-bonus' }, h('span', { class: 'g-dice-bl' }, t('bonus')), h('span', { class: 'g-dice-bbar' }, h('i')), h('span', { class: 'g-dice-bv' }));
    const colU = h('div', { class: 'g-dice-col' }, h('h3', { class: 'g-dice-colhead' }, h('span', null, t('upper')), ui.upperSum), R.UPPER.map(mkRow), ui.bonus);
    const colL = h('div', { class: 'g-dice-col' }, h('h3', { class: 'g-dice-colhead' }, h('span', null, t('lower')), ui.lowerSum), R.LOWER.map(mkRow));
    ui.cols = [colU, colL];
    ui.sheet = h('section', { class: 'g-dice-sheet', 'aria-label': t('sheet') }, colU, colL);

    const node = h('div', { class: 'g-dice-match' }, hud, ui.table, ui.actions, ui.sheet, ui.live);
    show(node);
    ctx.setHeaderRight(hb);

    // layout
    const ro = new ResizeObserver(() => layoutTable());
    ro.observe(ui.table);
    onScope(() => ro.disconnect());
    onScope(() => ui.dice.forEach(D.stopAnims));
    layoutTable();

    // keyboard
    keyHandler = (e) => {
      if (dialogOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (match.sel) confirmSel();
        else userRoll();
      } else if (/^[1-5]$/.test(e.key)) {
        holdDie(Number(e.key) - 1);
      } else if (e.key === 'Escape' && match.sel) {
        match.sel = null;
        renderAll();
      } else if (e.key === 'Enter' && match.sel && !(e.target && e.target.classList && e.target.classList.contains('g-dice-row'))) {
        e.preventDefault();
        confirmSel();
      }
    };
    listen(document, 'keydown', (e) => keyHandler && keyHandler(e));

    // restore dice faces
    ui.dice.forEach((d, i) => {
      D.orient(d, g.dice[i], D.randomPose());
    });
    placeDice(false);
    renderAll();
    if (M.fresh) {
      ui.dice.forEach((d, i) => {
        if (reduce()) return;
        d.slot.animate([{ opacity: 0, transform: `translate(${slotPos(i, d).x}px,${slotPos(i, d).y + 24}px) scale(.85)` }, { opacity: 1, transform: `translate(${slotPos(i, d).x}px,${slotPos(i, d).y}px) scale(1)` }], { duration: 420, delay: 120 + i * 55, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      });
    }
    live(t('turnOf', { name: cur().name }));
    if (g.players[g.cur].ai) aiTurn();
  }

  // ----- table layout -----
  function layoutTable() {
    const ui = match && match.ui;
    if (!ui || !ui.table.isConnected) return;
    const W = ui.table.clientWidth;
    if (!W) return;
    const rootH = root.clientHeight || 700;
    const S = Math.max(40, Math.min(66, Math.floor(W / 5 / 1.42), Math.floor(rootH * 0.085)));
    const extra = Math.max(36, Math.min(96, 36 + (rootH - 620) * 0.62));
    ui.S = S;
    ui.W = W;
    ui.arenaH = Math.round(S * 1.2 + extra);
    ui.table.style.setProperty('--s', S + 'px');
    ui.table.style.height = ui.arenaH + 8 + S + 28 + 'px';
    ui.tray.style.top = ui.arenaH + 8 + 'px';
    ui.tray.style.height = S + 28 + 'px';
    placeDice(false);
  }
  function slotPos(i, d) {
    const ui = match.ui;
    const col = ui.W / 5;
    const x = Math.round(col * i + (col - ui.S) / 2);
    const held = match.g.held[i] && match.g.rollsLeft < R.MAX_ROLLS;
    return held ? { x, y: ui.arenaH + 8 + 15, held: true } : { x: Math.max(2, Math.min(ui.W - ui.S - 12, x + (d.jx || 0))), y: Math.round((ui.arenaH - ui.S) / 2) + (d.jy || 0), held: false };
  }
  function placeDice(animate = true) {
    const ui = match && match.ui;
    if (!ui || !ui.S) return;
    ui.dice.forEach((d, i) => {
      const p = slotPos(i, d);
      d.slot.style.transition = animate ? '' : 'none';
      d.slot.style.transform = `translate(${p.x}px,${p.y}px) scale(${p.held ? 0.92 : 1})`;
      d.slot.classList.toggle('is-held', p.held);
      d.slot.setAttribute('aria-pressed', String(p.held));
      d.slot.setAttribute('aria-label', t('dieLabel', { n: i + 1, v: match.g.dice[i], held: p.held ? t('heldWord') : '' }));
      d.slot.setAttribute('aria-disabled', String(!canHold()));
      if (!animate) void d.slot.offsetWidth;
    });
  }
  const canHold = () => match && !match.g.over && humanTurn() && match.g.rollsLeft > 0 && match.g.rollsLeft < R.MAX_ROLLS;

  // ----- rendering -----
  function viewIdx() {
    return match.view ?? match.g.cur;
  }
  function renderAll() {
    renderHud();
    renderDice();
    renderSheet();
    renderActions();
  }
  function renderDice() {
    const ui = match.ui;
    const g = match.g;
    const idle = g.rollsLeft === R.MAX_ROLLS || g.over;
    ui.dice.forEach((d) => d.slot.classList.toggle('is-idle', idle));
    ui.table.classList.toggle('is-ai', !humanTurn());
    ui.dice.forEach((d, i) => d.slot.setAttribute('tabindex', canHold() ? '0' : '-1'));
  }
  function renderHud() {
    const ui = match.ui;
    const g = match.g;
    ui.turn.textContent = t('turn', { n: Math.min(g.turn, 13), total: 13 });
    ui.dots.setAttribute('aria-label', t('rollsLeft', { n: g.rollsLeft }));
    [...ui.dots.children].forEach((d, i) => d.classList.toggle('on', i < g.rollsLeft));
    setNum(ui.total, R.totalScore(g.players[viewIdx()].sheet));
    ui.strip.forEach((b, i) => {
      b.classList.toggle('is-cur', i === g.cur && !g.over);
      b.classList.toggle('is-view', i === viewIdx());
      b.setAttribute('aria-current', String(i === g.cur));
      b.setAttribute('aria-label', t('chipLabel', { name: g.players[i].name, score: R.totalScore(g.players[i].sheet) }));
      setNum(b._total, R.totalScore(g.players[i].sheet), 450);
    });
  }
  function pickable() {
    const g = match.g;
    return !match.busy && humanTurn() && R.hasRolled(g) && viewIdx() === g.cur;
  }
  function renderSheet() {
    const ui = match.ui;
    const g = match.g;
    const vi = viewIdx();
    const sheet = g.players[vi].sheet;
    const isCurView = vi === g.cur && !g.over;
    const pots = isCurView && R.hasRolled(g) ? R.potentials(sheet, g.dice) : null;
    const can = pickable();
    for (const c of R.CATS) {
      const row = ui.rows[c];
      const v = sheet.scores[c];
      const used = v !== null;
      const pot = pots ? pots[c] : null;
      const sel = match.sel === c && can && pot !== null;
      row.classList.toggle('is-used', used);
      row.classList.toggle('is-zero', used && v === 0);
      row.classList.toggle('is-open', !used);
      row.classList.toggle('is-locked', !used && pots !== null && pot === null);
      row.classList.toggle('is-sel', sel);
      row.classList.toggle('is-best', false);
      const shown = used ? v : pot;
      row._val.className = 'g-dice-rv' + (used ? '' : pot === null ? ' is-na' : pot === 0 ? ' is-zero' : ' is-pot');
      if (!row._val.dataset.anim) row._val.textContent = shown === null || shown === undefined ? (used ? '' : '·') : shown;
      row._badge.textContent = c === 'yahtzee' && sheet.yb ? '+' + sheet.yb * R.YAHTZEE_BONUS : '';
      row.setAttribute('aria-disabled', String(!(can && !used && pot !== null)));
      row.setAttribute('aria-pressed', String(sel));
      row.setAttribute('aria-label', used ? t('rowUsed', { cat: catName(c), pts: v }) : pot === null ? t('rowNone', { cat: catName(c) }) : t('rowPot', { cat: catName(c), pts: pot }));
    }
    const us = R.upperSum(sheet);
    const unlocked = us >= R.BONUS_NEED;
    ui.bonus.classList.toggle('is-unlocked', unlocked);
    ui.bonus.querySelector('i').style.width = Math.min(100, (us / R.BONUS_NEED) * 100) + '%';
    ui.bonus.querySelector('.g-dice-bv').textContent = unlocked ? '+' + R.BONUS_PTS : us + '/' + R.BONUS_NEED;
    ui.bonus.setAttribute('aria-label', t('bonusAria', { n: us, need: R.BONUS_NEED, pts: R.BONUS_PTS }));
    ui.upperSum.textContent = us + (unlocked ? ' + ' + R.BONUS_PTS : '');
    ui.lowerSum.textContent = R.lowerSum(sheet) + R.yahtzeeBonusPoints(sheet);
    ui.sheet.classList.toggle('is-picking', can && !match.sel);
    ui.sheet.classList.toggle('is-readonly', !isCurView);
  }
  function renderActions() {
    const ui = match.ui;
    const g = match.g;
    clear(ui.actions);
    if (g.over) return;
    const c = cur();
    if (c.ai) {
      ui.actions.append(h('div', { class: 'g-dice-aistate' }, h('span', { class: 'g-dice-pulse' }), t('aiPlaying', { name: c.name })));
      return;
    }
    if (match.sel && pickable()) {
      const pts = R.scoreFor(c.sheet, match.sel, g.dice);
      ui.actions.append(
        h('button', { class: 'g-dice-btn primary lg g-dice-confirm', type: 'button', onclick: confirmSel }, h('span', { class: 'g-dice-btn-ico', html: ICON.check }), h('span', null, t('confirm', { cat: catName(match.sel), pts })), h('em', { class: 'g-dice-btn-badge' }, '+' + pts)),
        h('button', { class: 'g-dice-btn ghost sq', type: 'button', 'aria-label': t('cancel'), onclick: () => ((match.sel = null), renderAll()), html: ICON.x }),
      );
      return;
    }
    const left = g.rollsLeft;
    const rolled = R.hasRolled(g);
    const label = left === 0 ? t('chooseCat') : rolled ? t('rollAgain') : t('roll');
    const rb = h(
      'button',
      { class: 'g-dice-btn primary lg g-dice-roll', type: 'button', disabled: left === 0 || match.rollLock || match.busy, onclick: userRoll, 'aria-label': left === 0 ? label : `${label}. ${t('rollsLeft', { n: left })}` },
      h('span', null, label),
      left > 0 ? h('em', { class: 'g-dice-btn-badge' }, left) : null,
    );
    ui.actions.append(rb);
    if (rolled && left > 0) ui.actions.append(btn(t('scoreNow'), { cls: 'ghost', onclick: scoreNow }));
  }

  // ----- interactions -----
  function viewPlayer(i) {
    match.view = i === match.g.cur ? null : match.view === i ? null : i;
    match.sel = null;
    renderAll();
  }
  function holdDie(i) {
    const g = match.g;
    if (!match || match.busy || !canHold()) return;
    if (!R.toggleHold(g, i)) return;
    sfx.tone({ freq: g.held[i] ? 760 : 520, to: g.held[i] ? 980 : 400, dur: 0.07, type: 'triangle', vol: 0.18 });
    sfx.vibrate?.(8);
    placeDice(true);
    persist();
    live(t('holdSay', { n: i + 1, v: g.dice[i], state: g.held[i] ? t('heldState') : t('releasedWord') }));
  }
  function userRoll() {
    if (!match || !humanTurn() || match.busy || match.rollLock || match.g.rollsLeft <= 0) return;
    if (match.view !== null) match.view = null;
    match.sel = null;
    performRoll();
  }
  function performRoll() {
    const g = match.g;
    const ui = match.ui;
    const changed = R.roll(g);
    persist();
    match.rollLock = true;
    later(() => {
      if (match) {
        match.rollLock = false;
        if (humanTurn()) renderActions();
      }
    }, 460);
    // visual throw
    sfx.vibrate?.([12, 40, 8]);
    for (let k = 0; k < 7; k++) sfx.noise({ dur: 0.035, vol: 0.09, freq: 1500 + Math.random() * 1800, q: 1.1, delay: k * 0.05 });
    const ro = reduce();
    changed.forEach((i, k) => {
      const d = ui.dice[i];
      d.jx = Math.round(Math.random() * 12 - 6);
      d.jy = Math.round(Math.random() * 20 - 10);
      const p = slotPos(i, d);
      d.slot.style.transition = 'none';
      d.slot.style.transform = `translate(${p.x}px,${p.y}px) scale(1)`;
      d.slot.classList.remove('is-held');
      D.rollDie(d, g.dice[i], { delay: ro ? 0 : k * 35, reduce: ro, side: i < 2 ? -1 : i > 2 ? 1 : 0 });
      sfx.tone({ freq: 210 + Math.random() * 70, to: 120, dur: 0.06, type: 'triangle', vol: 0.14, delay: 0.26 + k * 0.035 });
      sfx.noise({ dur: 0.025, vol: 0.1, freq: 3000, q: 1.5, delay: 0.27 + k * 0.035 });
    });
    ui.dice.forEach((d) => d.slot.classList.remove('is-idle'));
    placeDice(false);
    // re-apply arena jitter for rolled dice (placeDice reads d.jx/d.jy)
    renderHud();
    renderSheet();
    renderActions();
    renderDice();
    const sorted = g.dice.join(', ');
    live(t('rollSay', { dice: sorted, n: g.rollsLeft }));
  }
  function scoreNow() {
    const g = match.g;
    if (!pickable()) return;
    const pots = R.potentials(cur().sheet, g.dice);
    let best = null;
    for (const c of R.CATS) if (pots[c] !== null && (best === null || pots[c] > pots[best])) best = c;
    if (!best) return;
    match.sel = best;
    match.selAt = performance.now();
    renderSheet();
    renderActions();
    const row = match.ui.rows[best];
    row.scrollIntoView?.({ block: 'nearest' });
    row.focus({ preventScroll: true });
    live(t('suggest', { cat: catName(best), pts: pots[best] }));
  }
  function pickCat(cat) {
    if (!pickable()) {
      if (match.g.over || !humanTurn()) return;
      if (viewIdx() !== match.g.cur) return;
      if (!R.hasRolled(match.g)) ctx.ui.toast(t('rollFirst'));
      return;
    }
    const pot = R.scoreFor(cur().sheet, cat, match.g.dice);
    if (pot === null) {
      sfx.play('error');
      return;
    }
    const now = performance.now();
    if (match.sel === cat && now - match.selAt > 320) return commit(cat);
    match.sel = cat;
    match.selAt = now;
    sfx.tone({ freq: 640, to: 820, dur: 0.06, type: 'triangle', vol: 0.15 });
    renderSheet();
    renderActions();
    live(t('suggest', { cat: catName(cat), pts: pot }));
  }
  function confirmSel() {
    if (match && match.sel && pickable()) commit(match.sel);
  }
  function rowKey(e) {
    const rows = [...match.ui.cols[0].querySelectorAll('.g-dice-row'), ...match.ui.cols[1].querySelectorAll('.g-dice-row')];
    const i = rows.indexOf(e.currentTarget);
    const nU = R.UPPER.length;
    let j = -1;
    if (e.key === 'ArrowDown') j = i < nU ? (i + 1 < nU ? i + 1 : i) : i + 1 < rows.length ? i + 1 : i;
    else if (e.key === 'ArrowUp') j = i < nU ? (i > 0 ? i - 1 : i) : i > nU ? i - 1 : i;
    else if (e.key === 'ArrowRight') j = i < nU ? Math.min(nU + i, rows.length - 1) : i;
    else if (e.key === 'ArrowLeft') j = i >= nU ? Math.min(i - nU, nU - 1) : i;
    if (j >= 0) {
      e.preventDefault();
      rows[j].focus();
    } else if (e.key === ' ') {
      e.stopPropagation();
    }
  }

  // ----- scoring -----
  function commit(cat) {
    const g = match.g;
    const ui = match.ui;
    const M = match;
    const who = g.cur;
    const dice = g.dice.slice();
    const res = R.scoreCategory(g, cat);
    M.sel = null;
    M.view = who;
    M.busy = true;
    M.rollLock = true;
    const p = g.players[who];
    // sounds
    sfx.tone({ freq: 740, to: 1100, dur: 0.09, type: 'triangle', vol: 0.22 });
    sfx.tone({ freq: 1100, dur: 0.12, type: 'sine', vol: 0.14, delay: 0.07 });
    sfx.vibrate?.(res.points > 0 ? 18 : 30);
    renderSheet();
    renderHud();
    const row = ui.rows[cat];
    row.classList.add('is-flash');
    later(() => row.classList.remove('is-flash'), 900);
    row._val.dataset.anim = '1';
    row._val.className = 'g-dice-rv';
    tween(0, res.points, 420, (v) => (row._val.textContent = v));
    later(() => {
      delete row._val.dataset.anim;
    }, 460);
    live(t('scoredSay', { name: p.name, pts: res.points, cat: catName(cat) }));
    const fx = [];
    if (res.yahtzee || res.bonusYahtzee) fx.push(() => yahtzeeFx(res));
    if (res.upperBonusUnlocked) fx.push(() => bonusFx(who));
    fx.forEach((f) => f());
    persist();
    // dice go back to the arena, dim, ready for the next player
    ui.dice.forEach((d) => d.slot.classList.add('is-idle'));
    placeDice(true);
    const wait = res.yahtzee || res.bonusYahtzee ? 900 : M.g.players.length > 1 ? 800 : 380;
    renderActions();
    later(() => {
      if (match !== M) return;
      M.busy = false;
      M.rollLock = false;
      M.view = null;
      if (g.over) return finishMatch();
      renderAll();
      nextTurn();
    }, wait);
    ui.dice.forEach((d, i) => {
      // held-state lock stays only within a turn: values stay visible but dim
      d.slot.classList.remove('is-held');
    });
    return res;
  }

  async function nextTurn() {
    const g = match.g;
    live(t('turnOf', { name: cur().name }));
    const multiHuman = g.players.filter((p) => !p.ai).length > 1;
    if (g.players[g.cur].ai) return aiTurn();
    if (multiHuman) await passOverlay();
  }

  function passOverlay() {
    return new Promise((resolve) => {
      const M = match;
      const c = cur();
      const ov = h(
        'div',
        { class: 'g-dice-pass', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('turnOf', { name: c.name }) },
        h('div', { class: 'g-dice-pass-card' }, h('small', null, t('passText')), h('h2', null, c.name), h('div', { class: 'g-dice-pass-score' }, h('span', null, t('total')), h('b', null, R.totalScore(c.sheet))), btn(t('ready'), { cls: 'primary lg block', icon: ICON.play, onclick: () => ((ov.classList.remove('show')), later(() => ov.remove(), 220), M.busy = false, renderActions(), resolve()) })),
      );
      M.busy = true;
      renderActions();
      M.ui.table.parentNode.append(ov);
      requestAnimationFrame(() => {
        ov.classList.add('show');
        ov.querySelector('button').focus({ preventScroll: true });
      });
    });
  }

  // ----- computer player -----
  async function aiTurn() {
    const M = match;
    const tok = ++M.tok;
    const alive = () => match === M && M.tok === tok && !disposed;
    const g = M.g;
    M.busy = false;
    renderAll();
    await sleep(reduce() ? 250 : 650);
    if (!alive()) return;
    let guard = 0;
    while (alive() && g.rollsLeft > 0 && guard++ < 3) {
      performRoll();
      await sleep(reduce() ? 300 : 680);
      if (!alive()) return;
      if (g.rollsLeft === 0) break;
      const { held, stop } = chooseHold(cur().sheet, g.dice, g.rollsLeft);
      if (stop) break;
      R.setHeld(g, held);
      placeDice(true);
      persist();
      sfx.tone({ freq: 700, to: 900, dur: 0.06, type: 'triangle', vol: 0.12 });
      await sleep(reduce() ? 250 : 520);
    }
    if (!alive()) return;
    const cat = chooseCategory(cur().sheet, g.dice);
    M.sel = cat;
    M.view = g.cur;
    M.busy = false;
    renderSheet();
    await sleep(reduce() ? 250 : 700);
    if (!alive()) return;
    M.sel = null;
    // commit() reads pickable(); the AI bypasses it
    commit(cat);
  }

  // ----- effects -----
  function yahtzeeFx(res) {
    const ui = match.ui;
    const fx = h('div', { class: 'g-dice-yz', 'aria-hidden': 'true' }, h('div', { class: 'g-dice-yz-ring' }), h('b', null, t('yahtzeeBang')), h('span', null, res.bonusYahtzee ? t('yahtzeeBonus', { pts: R.YAHTZEE_BONUS }) : '+' + R.FIXED.yahtzee));
    const rr = root.getBoundingClientRect();
    const tb = ui.table.getBoundingClientRect();
    fx.style.top = tb.top - rr.top + 'px';
    fx.style.height = tb.height + 'px';
    fx.style.bottom = 'auto';
    root.append(fx);
    later(() => fx.classList.add('out'), 1250);
    later(() => fx.remove(), 1700);
    const rect = root.getBoundingClientRect();
    const tr = ui.table.getBoundingClientRect();
    if (!reduce()) timers.add(D.burst(root, tr.left - rect.left + tr.width / 2, tr.top - rect.top + tr.height / 2.2, { n: 46, spread: Math.min(190, rect.width * 0.5) }));
    sfx.tone({ freq: 523, dur: 0.14, type: 'triangle', vol: 0.25 });
    sfx.tone({ freq: 659, dur: 0.14, type: 'triangle', vol: 0.25, delay: 0.1 });
    sfx.tone({ freq: 784, dur: 0.16, type: 'triangle', vol: 0.25, delay: 0.2 });
    sfx.tone({ freq: 1047, dur: 0.4, type: 'sine', vol: 0.28, delay: 0.32 });
    sfx.vibrate?.([30, 50, 30, 50, 80]);
    live(t('yahtzeeBang'));
  }
  function bonusFx(who) {
    const ui = match.ui;
    ui.bonus.classList.add('is-pop');
    later(() => ui.bonus.classList.remove('is-pop'), 1400);
    if (!reduce()) {
      const rect = root.getBoundingClientRect();
      const br = ui.bonus.getBoundingClientRect();
      timers.add(D.burst(root, br.left - rect.left + br.width / 2, br.top - rect.top + br.height / 2, { n: 16, spread: 80, life: 800 }));
    }
    sfx.tone({ freq: 880, dur: 0.1, type: 'sine', vol: 0.2, delay: 0.12 });
    sfx.tone({ freq: 1175, dur: 0.22, type: 'sine', vol: 0.2, delay: 0.22 });
    const toastEl = h('div', { class: 'g-dice-banner' }, h('b', null, t('bonusUnlocked')), h('span', null, '+' + R.BONUS_PTS));
    root.append(toastEl);
    later(() => toastEl.classList.add('out'), 1500);
    later(() => toastEl.remove(), 1900);
    live(t('bonusUnlocked') + ' +' + R.BONUS_PTS);
  }

  // ----- leaving / pausing -----
  async function pauseMenu() {
    if (!match || dialogOpen) return;
    const v = await dialog({
      title: t('pause'),
      body: rulesBody(),
      className: 'wide',
      actions: [
        { label: t('resume'), value: 'resume', primary: true },
        { label: t('toMenu'), value: 'menu' },
      ],
    });
    if (v === 'menu') {
      persist();
      showMenu();
    }
  }
  async function leaveMatch() {
    if (!match) return showMenu();
    if (match.g.over) return showMenu();
    const v = await dialog({
      title: t('leaveTitle'),
      body: h('p', null, t('leaveText')),
      actions: [
        { label: t('resume'), value: 'resume', primary: true },
        { label: t('toMenu'), value: 'menu' },
      ],
    });
    if (v === 'menu') {
      persist();
      showMenu();
    }
  }

  // ======================================================================
  //  FINISH + RESULTS
  // ======================================================================
  function finishMatch() {
    const M = match;
    const g = M.g;
    const sum = R.summary(g);
    const stats = getStats();
    const human = sum.filter((r) => !r.ai);
    const first = sum[0];
    let record = false;
    let result = 'done';
    const winnerNames = sum.filter((r) => r.winner).map((r) => r.name);
    const prevN = stats.n;
    const prevSum = stats.sum;
    if (M.mode === 'ai') {
      const ai = sum[1];
      result = first.total > ai.total ? 'win' : first.total < ai.total ? 'loss' : 'tie';
      if (result === 'win') stats.wins++;
    } else if (M.mode === 'local') result = winnerNames.length > 1 ? 'tie' : 'win';
    stats.games++;
    if (M.mode !== 'local') {
      record = prevN > 0 && first.total > stats.best; // a record needs something to beat
      stats.best = Math.max(stats.best, first.total);
      stats.sum += first.total;
      stats.n++;
    }
    const fivesNow = human.reduce((a, r) => a + (r.yahtzee ? 1 : 0) + r.yb, 0);
    stats.fives += fivesNow;
    stats.bonuses += human.reduce((a, r) => a + (r.bonus > 0 ? 1 : 0), 0);
    stats.history = [{ t: Date.now(), mode: M.mode, score: first.total, result: M.mode === 'local' ? 'done' : result, players: sum.map((r) => ({ name: r.name, total: r.total })) }, ...stats.history].slice(0, 10);
    store.set('stats', stats);
    store.remove('save');
    // XP
    const top = Math.max(...sum.map((r) => r.total));
    let xp = 10 + Math.min(18, Math.floor((M.mode === 'local' ? top : first.total) / 14));
    if (M.mode === 'ai' && result === 'win') xp += 8;
    if (record) xp += 4;
    xp += Math.min(8, fivesNow * 4);
    xp = Math.max(10, Math.min(40, xp));
    try {
      ctx.addXP?.(xp);
    } catch {
      /* ignore */
    }
    showResults({ sum, mode: M.mode, result, record, winnerNames, stats, prevAvg: prevN ? Math.round(prevSum / prevN) : 0, xp });
  }

  function showResults(info) {
    backFn = () => (showMenu(), true);
    const { sum, mode, result, record, winnerNames, stats, prevAvg } = info;
    const first = sum[0];
    const ranked = sum.slice().sort((a, b) => b.total - a.total || a.index - b.index);
    const lead = ranked[0];
    let title;
    let sub;
    if (mode === 'classic') {
      title = record ? t('newRecord') : t('gameOver');
      sub = record ? t('recordSub', { n: first.total }) : prevAvg ? t(first.total >= prevAvg ? 'aboveAvg' : 'belowAvg', { n: Math.abs(first.total - prevAvg) }) : t('firstGame');
    } else if (mode === 'ai') {
      title = result === 'win' ? t('youWin') : result === 'loss' ? t('youLose') : t('tieTitle');
      sub = result === 'win' ? t('winBy', { n: first.total - sum[1].total }) : result === 'loss' ? t('loseBy', { n: sum[1].total - first.total }) : t('tieSub');
      if (record && result !== 'loss') sub += ' · ' + t('newRecord');
    } else {
      title = winnerNames.length > 1 ? t('tieTitle') : t('winnerIs', { name: lead.name });
      sub = winnerNames.length > 1 ? winnerNames.join(' · ') : t('winBy', { n: lead.total - ranked[1].total });
    }
    const big = h('b', { class: 'g-dice-final-n', 'data-v': '0' }, '0');
    const fives = sum.reduce((a, r) => a + (r.yahtzee ? 1 : 0) + r.yb, 0);
    const row = (r, i) =>
      h(
        'li',
        { class: `g-dice-prow ${r.winner && mode !== 'classic' ? 'is-win' : ''}` },
        h('span', { class: 'g-dice-prank' }, i + 1),
        h('span', { class: 'g-dice-pbody' }, h('b', { class: 'g-dice-pname' }, r.name), h('small', null, [`${t('upper')} ${r.upper}`, r.bonus ? `${t('bonus')} +${r.bonus}` : '', `${t('lower')} ${r.lower}`, r.yb ? `${t('fivesShort')} +${r.ybPoints}` : r.yahtzee ? t('fivesShort') : ''].filter(Boolean).join(' · '))),
        h('b', { class: 'g-dice-ptotal' }, r.total),
      );
    const single = sum.length === 1;
    const breakdown = single
      ? h(
          'dl',
          { class: 'g-dice-break' },
          h('div', null, h('dt', null, t('upper')), h('dd', null, first.upper)),
          h('div', { class: first.bonus ? 'on' : '' }, h('dt', null, t('bonus')), h('dd', null, first.bonus ? '+' + first.bonus : '0')),
          h('div', null, h('dt', null, t('lower')), h('dd', null, first.lower)),
          h('div', { class: first.yb ? 'on' : '' }, h('dt', null, t('ybLabel')), h('dd', null, first.yb ? '+' + first.ybPoints : '0')),
        )
      : h('ol', { class: 'g-dice-players' }, ranked.map(row));
    const chips = h(
      'div',
      { class: 'g-dice-rchips' },
      fives ? h('span', { class: 'g-dice-rchip accent' }, t('fivesChip', { n: fives })) : null,
      first.bonus && single ? h('span', { class: 'g-dice-rchip' }, t('bonusChip')) : null,
      single ? h('span', { class: 'g-dice-rchip' }, t('bestChip', { n: stats.best })) : null,
      single && stats.n ? h('span', { class: 'g-dice-rchip' }, t('avgChip', { n: Math.round(stats.sum / stats.n) })) : null,
      h('span', { class: 'g-dice-rchip xp' }, '+' + info.xp + ' XP'),
    );
    const node = h(
      'div',
      { class: 'g-dice-results' },
      h('header', { class: 'g-dice-rhead' }, h('small', null, mode === 'classic' || mode === 'ai' ? t('finalScore') : t('finalResult')), h('h2', null, title), h('p', null, sub)),
      single || mode === 'ai' ? h('div', { class: 'g-dice-final' }, big) : h('div', { class: 'g-dice-final' }, big, h('span', { class: 'g-dice-final-name' }, lead.name)),
      breakdown,
      chips,
      h('div', { class: 'g-dice-stack' }, btn(t('playAgain'), { cls: 'primary lg block', icon: ICON.play, onclick: () => (mode === 'local' ? showSetup() : startNew(mode, defaultPlayers(mode))) }), btn(t('toMenu'), { cls: 'ghost block', onclick: showMenu })),
    );
    show(node);
    if (single || mode === 'ai') setNum(big, first.total, 1100);
    else setNum(big, lead.total, 1100);
    live(title + '. ' + t('finalScore') + ' ' + (mode === 'local' ? lead.total : first.total));
    // celebration proportional to the result
    const topScore = mode === 'local' ? lead.total : first.total;
    const win = record || result === 'win' || mode === 'local' || (mode === 'classic' && topScore >= 220);
    if (win && !reduce()) {
      const rect = root.getBoundingClientRect();
      const n = record ? 70 : topScore >= 280 ? 56 : topScore >= 220 ? 40 : 28;
      const go = (nn, ms) =>
        later(() => {
          if (!node.isConnected) return;
          timers.add(D.burst(root, rect.width / 2, Math.min(190, rect.height * 0.28), { n: nn, spread: Math.min(220, rect.width * 0.6), life: 1400 }));
        }, ms);
      go(n, 350);
      if (record) go(Math.round(n * 0.7), 1000);
      sfx.play('win');
    } else if (!win) sfx.play(mode === 'ai' && result === 'loss' ? 'lose' : 'success');
    sfx.vibrate?.(win ? [20, 40, 20] : 15);
  }

  // ---------- boot ----------
  const onResize = () => match && match.ui && layoutTable();
  window.addEventListener('resize', onResize);

  const entry = ctx.mode;
  if (entry === 'classic' || entry === 'ai' || entry === 'local') {
    if (loadSave()) {
      showMenu(); // behind the "continue or new match?" dialog
      beginMode(entry);
    } else if (entry === 'local') showSetup();
    else startNew(entry, defaultPlayers(entry));
  } else showMenu();

  return () => {
    disposed = true;
    timers.forEach(clearTimeout);
    rafs.forEach(cancelAnimationFrame);
    scopeCleanups.forEach((f) => f());
    window.removeEventListener('resize', onResize);
    ctx.setHeaderRight(null);
    if (match) match.tok++;
    match = null;
  };
}
