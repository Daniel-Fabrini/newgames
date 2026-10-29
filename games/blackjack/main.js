// Blackjack — a premium virtual-chip table (rules in rules.js, basic strategy in strategy.js).
//   Menu → table. Modes (ctx.mode): classic (endless bankroll) and challenge (reach a chip goal in N hands).
//   The table autosaves after every action and resumes with the same shoe and RNG state.
//   Chips are virtual; there is no real money anywhere.

import STRINGS from './strings.js';
import * as B from './rules.js';
import { suggest } from './strategy.js';
import { cardEl } from '../_cards/card.js';
import { setCardLang } from '../_cards/decks.js';
import { createAnimator } from '../_cards/anim.js';
import { createCardSfx } from '../_cards/sfx.js';
import { chipEl, chipStack, countUp, rulesModal } from '../_cards/table.js';
import { createMatchSave } from '../_cards/storage.js';
import { randomSeed } from '../_cards/rng.js';

const SAVE_VERSION = 1;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const SUITS = ['s', 'h', 'd', 'c'];
let uidSeq = 1;
const toLib = (id, uid) => ({ r: RANKS[B.rankOf(id) - 1], s: SUITS[B.suitOf(id)], id: `${id}-${uid}` });

const svg = (inner, cls = '') => `<svg class="g-bj-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICON = {
  help: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  mute: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  stats: svg('<path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  rules: svg('<path d="M6 4h9l3 3v13H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 11h6M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  hist: svg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  play: svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
  resume: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  coin: svg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"/>'),
  trophy: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 5M17 6h3c0 3-1.5 4.5-3.5 5M12 14v4M8.5 20h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
};

export async function mount(root, ctx) {
  await Promise.all([ctx.loadCSS(new URL('../_cards/cards.css', import.meta.url)), ctx.loadCSS(new URL('./style.css', import.meta.url))]);
  setCardLang(ctx.lang);
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const store = ctx.store;
  const anim = createAnimator();
  const cs = createCardSfx(ctx);
  const saveBox = createMatchSave(store, 'save', { version: SAVE_VERSION, validate: (x) => x && x.s && x.s.shoe && x.meta });
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMq.matches;

  // ---------- lifecycle ----------
  let disposed = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const sleep = (ms) => new Promise((res) => later(res, reduce() ? Math.min(ms, 50) : ms));

  // ---------- prefs / stats ----------
  const getPrefs = () => ({ mode: 'classic', decks: 6, h17: false, das: true, surrender: false, boxes: 1, hint: false, sound: true, ...(store.get('prefs', {}) || {}) });
  const setPrefs = (p) => store.set('prefs', { ...getPrefs(), ...p });
  cs.enabled = getPrefs().sound !== false;
  const getStats = () => ({ hands: 0, wins: 0, losses: 0, pushes: 0, bj: 0, busts: 0, best: 1000, big: 0, level: 1, ...(store.get('stats', {}) || {}) });
  const getHist = () => store.get('hist', []) || [];

  // ---------- shell ----------
  const app = h('div', { class: 'g-bj-app' });
  root.append(app);
  let dialogClose = null;
  let backFn = () => false;
  ctx.onBack(() => {
    if (dialogClose) {
      dialogClose(null);
      return true;
    }
    return backFn();
  });

  const ask = ({ title, text, node, actions, dismissible = false, cls = '' }) =>
    new Promise((resolve) => {
      const prev = document.activeElement;
      const close = (v) => {
        if (dialogClose !== close) return;
        dialogClose = null;
        overlay.classList.remove('show');
        later(() => overlay.remove(), 160);
        if (prev && prev.focus && prev.isConnected) prev.focus({ preventScroll: true });
        resolve(v);
      };
      const body = node || h('p', null, text);
      const acts = (actions || []).map((a) => h('button', { type: 'button', class: `dc-btn ${a.primary ? 'is-primary' : a.danger ? 'is-danger' : 'is-secondary'}`, onclick: () => close(a.value) }, a.label));
      const box = h('div', { class: `dt-modal g-bj-dlg ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' }, title ? h('h2', { class: 'dt-modal-title' }, title) : null, h('div', { class: 'dt-modal-body' }, body), acts.length ? h('div', { class: 'dt-modal-actions' }, acts) : null);
      const overlay = h('div', { class: 'dt-overlay', style: { zIndex: 1000 } }, box);
      if (dismissible) overlay.addEventListener('click', (e) => e.target === overlay && close(null));
      if (dialogClose) dialogClose(null);
      dialogClose = close;
      root.append(overlay);
      requestAnimationFrame(() => {
        overlay.classList.add('show');
        (box.querySelector('.is-primary') || box.querySelector('button'))?.focus({ preventScroll: true });
      });
    });

  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ctx.lang === 'en' ? ',' : '.');
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

  // =====================================================================================
  // MENU
  // =====================================================================================
  let table = null; // { s, meta, vm, ui... }
  let ui = null;
  let busy = false;
  let keyHandler = null;
  let roSeen = null;

  function setHeader(inGame) {
    if (!inGame) return ctx.setHeaderRight(null);
    const box = h('div', { class: 'g-bj-hdr' });
    const sb = h('button', { type: 'button', class: 'icon-btn', 'aria-label': cs.enabled ? t('soundOn') : t('soundOff'), title: t('sound'), html: cs.enabled ? ICON.sound : ICON.mute });
    sb.addEventListener('click', () => {
      cs.enabled = !cs.enabled;
      setPrefs({ sound: cs.enabled });
      sb.innerHTML = cs.enabled ? ICON.sound : ICON.mute;
      sb.setAttribute('aria-label', cs.enabled ? t('soundOn') : t('soundOff'));
    });
    box.append(
      sb,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('history'), title: t('history'), html: ICON.hist, onclick: showHistory }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('rules'), title: t('rules'), html: ICON.help, onclick: showRules }),
    );
    ctx.setHeaderRight(box);
  }

  const modeName = (m) => (m === 'challenge' ? t('challengeTitle') : t('classicTitle'));

  function stopTable() {
    table = null;
    ui = null;
    busy = false;
    anim.skip();
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    if (roSeen) roSeen.disconnect();
    roSeen = null;
  }

  async function leaveToMenu() {
    await awardSession();
    showMenu();
  }

  function showMenu() {
    stopTable();
    ctx.setTitle();
    setHeader(false);
    clear(app);
    app.className = 'g-bj-app is-menu';
    backFn = () => false;
    const prefs = getPrefs();
    const save = saveBox.load();
    const st = getStats();
    const wrap = h('div', { class: 'g-bj-menu g-bj-enter' });

    const hero = h('div', { class: 'g-bj-hero', 'aria-hidden': 'true' });
    [
      { id: 0, uid: 1, rot: -10, x: -30 },
      { id: 12, uid: 2, rot: 8, x: 22 },
    ].forEach((c) => {
      const el = h('div', { class: 'g-bj-herocard', style: { transform: `translate(${c.x}px,0) rotate(${c.rot}deg)` } }, cardEl(toLib(c.id, c.uid), { size: 84 }));
      hero.append(el);
    });
    hero.append(h('div', { class: 'g-bj-herochips' }, [5, 25, 100].map((d) => chipEl({ denom: d, size: 38 }))));
    wrap.append(hero, h('h1', { class: 'g-bj-title' }, t('name')));

    if (save) {
      wrap.append(
        h(
          'button',
          { class: 'g-bj-cont', type: 'button', onclick: () => resume(save) },
          h('span', { class: 'g-bj-cont-ico', html: ICON.resume }),
          h('span', { class: 'g-bj-cont-tx' }, h('b', null, t('continue')), h('small', null, t('continueInfo', { mode: modeName(save.meta.mode), chips: fmt(save.s.bankroll), hands: save.meta.session ? save.meta.session.hands : 0 }))),
        ),
      );
    }
    const modeTile = (id, ico, title, sub) =>
      h(
        'button',
        { type: 'button', class: `g-bj-mode${prefs.mode === id ? ' on' : ''}`, role: 'radio', 'aria-checked': String(prefs.mode === id), onclick: () => (setPrefs({ mode: id }), showMenu()) },
        h('span', { class: 'g-bj-mode-ico', html: ico }),
        h('b', null, title),
        h('small', null, sub),
      );
    const cl = B.challengeLevel(st.level);
    wrap.append(
      h('div', { class: 'g-bj-modes', role: 'radiogroup' }, modeTile('classic', ICON.coin, t('classicTitle'), t('classicSub')), modeTile('challenge', ICON.trophy, t('challengeTitle'), `${t('levelN', { n: cl.level })} · ${t('goalInfo', { goal: fmt(cl.goal), hands: cl.hands })}`)),
    );

    const chipRow = (label, items, cur, onPick) =>
      h(
        'div',
        { class: 'g-bj-field' },
        h('span', { class: 'g-bj-lab' }, label),
        h('div', { class: 'g-bj-chips', role: 'radiogroup', 'aria-label': label }, items.map(([v, txt]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(cur === v), class: `g-bj-chip${cur === v ? ' on' : ''}`, onclick: () => (onPick(v), showMenu()) }, txt))),
      );
    const toggle = (label, sub, key) =>
      h(
        'button',
        { type: 'button', class: `g-bj-toggle${prefs[key] ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!prefs[key]), onclick: () => (setPrefs({ [key]: !prefs[key] }), showMenu()) },
        h('span', { class: 'g-bj-toggle-tx' }, h('b', null, label), sub ? h('small', null, sub) : null),
        h('i', { class: 'g-bj-sw' }),
      );
    wrap.append(
      h('div', { class: 'g-bj-sect' }, t('options')),
      chipRow(t('decks'), [[1, '1'], [2, '2'], [6, '6']], prefs.decks, (v) => setPrefs({ decks: v })),
      chipRow(t('boxes'), [[1, '1'], [2, '2'], [3, '3']], prefs.boxes, (v) => setPrefs({ boxes: v })),
      h('div', { class: 'g-bj-opts' }, toggle(t('h17'), t('h17Sub'), 'h17'), toggle(t('das'), '', 'das'), toggle(t('surrender'), t('surrenderSub'), 'surrender'), toggle(t('hintOpt'), t('hintOptSub'), 'hint')),
      h('button', { type: 'button', class: 'g-bj-play', onclick: () => startNew(prefs.mode, true) }, h('span', { html: ICON.play }), t('play')),
      h('div', { class: 'g-bj-links' }, h('button', { type: 'button', class: 'g-bj-link', onclick: showRules }, h('span', { html: ICON.rules }), t('rules')), h('button', { type: 'button', class: 'g-bj-link', onclick: showStats }, h('span', { html: ICON.stats }), t('stats')), h('button', { type: 'button', class: 'g-bj-link', onclick: showHistory }, h('span', { html: ICON.hist }), t('history'))),
    );
    app.append(wrap);
  }

  function showRules() {
    if (dialogClose) dialogClose(null);
    rulesModal({ root, title: t('rulesTitle'), sections: t('rulesBody').map(([title, text]) => ({ title, text })), closeLabel: t('close'), lang: ctx.lang });
  }

  function sparkline(values) {
    if (values.length < 2) return null;
    const w = 300;
    const hgt = 70;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(hgt - 6 - ((v - min) / span) * (hgt - 12)).toFixed(1)}`).join(' ');
    return h('div', { class: 'g-bj-spark', html: `<svg viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none" role="img" aria-label="${t('graph')}"><polyline points="${pts}" fill="none" stroke="#f3c24a" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><polyline points="0,${hgt} ${pts} ${w},${hgt}" fill="rgba(243,194,74,.14)" stroke="none"/></svg>` });
  }

  function showStats() {
    const st = getStats();
    const rate = st.hands ? Math.round((st.wins / st.hands) * 100) : 0;
    const rows = [
      [t('st_hands'), fmt(st.hands)],
      [t('st_wins'), fmt(st.wins)],
      [t('st_losses'), fmt(st.losses)],
      [t('st_pushes'), fmt(st.pushes)],
      [t('st_bj'), fmt(st.bj)],
      [t('st_busts'), fmt(st.busts)],
      [t('st_best'), fmt(st.best)],
      [t('st_big'), fmt(st.big)],
      [t('st_rate'), rate + '%'],
    ];
    const hist = getHist();
    const g = sparkline(hist.map((x) => x.chips));
    const body = h('div', { class: 'g-bj-stats' }, h('div', { class: 'g-bj-statgrid' }, rows.map(([l, v]) => h('div', { class: 'g-bj-stat' }, h('b', null, v), h('small', null, l)))), g ? h('div', null, h('h3', null, t('graph')), g) : null);
    ask({ title: t('stats'), node: body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  }

  function showHistory() {
    const hist = getHist().slice().reverse();
    const body = hist.length
      ? h(
          'ul',
          { class: 'g-bj-hist' },
          hist.slice(0, 40).map((e) => h('li', { class: e.net > 0 ? 'win' : e.net < 0 ? 'lose' : 'push' }, h('span', { class: 'g-bj-hist-r' }, e.res.map((r) => t('r_' + r)).join(' · ')), h('small', null, t('vs', { p: e.p.join('/'), d: e.d })), h('b', null, signed(e.net)))),
        )
      : h('p', { class: 'g-bj-none' }, t('noHistory'));
    ask({ title: t('history'), node: body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  }

  // =====================================================================================
  // START / RESUME / SESSION
  // =====================================================================================
  const tableOpts = (p) => ({ decks: p.decks, h17: !!p.h17, das: !!p.das, surrender: !!p.surrender, boxes: p.boxes, max: 5000 });

  async function startNew(mode, fromMenu) {
    const existing = saveBox.load();
    if (existing) {
      const pick = await ask({
        title: t('replaceTitle'),
        text: t('replaceText'),
        actions: [
          { label: t('keepPlaying'), value: 'keep', primary: true },
          { label: t('newTable'), value: 'new' },
        ],
        dismissible: true,
      });
      if (pick === 'keep') return resume(existing);
      if (pick !== 'new') return fromMenu ? undefined : showMenu();
      await awardSession(existing.meta);
      saveBox.clear();
    }
    const prefs = getPrefs();
    const m = mode === 'challenge' ? 'challenge' : 'classic';
    setPrefs({ mode: m });
    const s = B.newGame(randomSeed(), tableOpts(prefs));
    const meta = { mode: m, hint: !!prefs.hint, session: { hands: 0, start: s.bankroll, xpHands: 0 }, lastBets: [], recorded: 0 };
    if (m === 'challenge') meta.challenge = { ...B.challengeLevel(getStats().level), used: 0 };
    begin(s, meta, true);
  }

  function resume(save) {
    if (dialogClose) dialogClose(null);
    begin(save.s, save.meta, false);
  }

  function persist() {
    if (!table) return;
    saveBox.save({ s: table.s, meta: table.meta });
  }

  async function awardSession(meta = table && table.meta) {
    if (!meta || meta.mode !== 'classic' || !meta.session) return;
    const n = meta.session.hands - (meta.session.xpHands || 0);
    if (n >= 5) {
      const profit = (table ? table.s.bankroll : 1000) - meta.session.start;
      const xp = Math.min(40, 5 + Math.floor(n / 3) + Math.max(0, Math.floor(profit / 250)));
      meta.session.xpHands = meta.session.hands;
      ctx.addXP?.(xp);
      persist();
    }
  }

  // =====================================================================================
  // TABLE
  // =====================================================================================
  function begin(s, meta, fresh) {
    stopTable();
    setHeader(true);
    clear(app);
    app.className = 'g-bj-app is-table';
    table = { s, meta, vm: null, bets: (meta.lastBets && meta.lastBets.slice()) || [], active: 0, hintMove: null, handCount: 0 };
    if (!table.bets.length || table.bets.length !== s.opts.boxes) table.bets = Array(s.opts.boxes).fill(0);
    buildTable();
    const confirmLeave = async () => {
      if (!table) return;
      const midHand = !['bet', 'settled'].includes(table.s.phase);
      const v = await ask({
        title: t('leaveTitle'),
        text: midHand || true ? t('leaveText') : '',
        actions: [
          { label: t('stay'), value: 'stay', primary: true },
          { label: t('leave'), value: 'leave' },
        ],
        dismissible: true,
      });
      if (v === 'leave') {
        persist();
        await leaveToMenu();
      }
    };
    backFn = () => {
      if (!table) return false;
      confirmLeave();
      return true;
    };
    syncVm();
    paint();
    renderControls();
    if (['dealer'].includes(s.phase)) dealerLoop();
    else if (s.phase === 'settled') settledView(false);
    void fresh;
    checkBust();
  }

  function buildTable() {
    const W = root.clientWidth || 390;
    ui = {};
    const hud = h('div', { class: 'g-bj-hud' });
    const bal = h('div', { class: 'g-bj-bal' }, h('span', { class: 'g-bj-bal-ico', html: ICON.coin }), h('span', { class: 'g-bj-bal-tx' }, h('small', null, t('balance')), h('b', { class: 'g-bj-bal-v' }, fmt(table.s.bankroll))));
    const mid = h('div', { class: 'g-bj-hudmid' });
    const shoe = h('div', { class: 'g-bj-shoe', 'aria-label': t('shoeLeft', { n: table.s.shoe.length }) }, h('i', { class: 'g-bj-shoe-cards' }), h('span', { class: 'g-bj-shoe-bar' }, h('i', null), h('em', null)));
    hud.append(bal, mid, shoe);
    const dealer = h('div', { class: 'g-bj-dealer' }, h('div', { class: 'g-bj-zone-lab' }, t('dealer'), h('span', { class: 'g-bj-total g-bj-dtotal' })), h('div', { class: 'g-bj-dcards' }));
    const felt = h('div', { class: 'g-bj-felt' });
    const arc = h(
      'div',
      { class: 'g-bj-arc', 'aria-hidden': 'true' },
      h('div', { class: 'g-bj-arcsvg', html: `<svg viewBox="0 0 300 70"><defs><path id="gbjarc" d="M20 56 Q150 4 280 56"/></defs><text font-size="12.5" font-weight="900" letter-spacing="2.6" fill="rgba(243,194,74,.72)" text-anchor="middle"><textPath href="#gbjarc" startOffset="50%">${t('paysLine')}</textPath></text></svg>` }),
      h('small', null, t('insLine')),
      h('small', { class: 'g-bj-rule' }, table.s.opts.h17 ? t('ruleLineH17') : t('ruleLine')),
    );
    const banner = h('div', { class: 'g-bj-banner', role: 'status', 'aria-live': 'polite' });
    felt.append(arc, banner);
    const players = h('div', { class: 'g-bj-players' });
    const controls = h('div', { class: 'g-bj-controls' });
    const fx = h('div', { class: 'g-bj-fx', 'aria-hidden': 'true' });
    app.append(hud, dealer, felt, players, controls, fx);
    Object.assign(ui, { hud, bal, balV: bal.querySelector('.g-bj-bal-v'), mid, shoe, dealer, dcards: dealer.querySelector('.g-bj-dcards'), dtotal: dealer.querySelector('.g-bj-dtotal'), felt, banner, players, controls, fx, W });
    keyHandler = (e) => {
      if (!table || dialogClose || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'h') act('hit');
      else if (k === 's') act('stand');
      else if (k === 'd') act('double');
      else if (k === 'p') act('split');
      else if (k === 'enter') primaryKey();
    };
    window.addEventListener('keydown', keyHandler);
    if (typeof ResizeObserver !== 'undefined') {
      let lw = W;
      roSeen = new ResizeObserver(() => {
        if (table && Math.abs(root.clientWidth - lw) > 20) {
          lw = root.clientWidth;
          paint();
        }
      });
      roSeen.observe(root);
    }
    updateHud();
  }

  // ---------- view model (mirrors the engine progressively while events animate) ----------
  function snapHand(hd) {
    return { cards: hd.cards.map((id) => ({ id, uid: uidSeq++ })), bet: hd.bet, box: hd.box, result: hd.result, net: hd.net, done: hd.done, doubled: hd.doubled, surrendered: hd.surrendered, split: hd.split };
  }
  function syncVm() {
    const s = table.s;
    const keepUids = table.vm ? table.vm : null;
    void keepUids;
    table.vm = {
      hands: s.hands.map(snapHand),
      dealer: { cards: s.dealer.cards.map((id) => ({ id, uid: uidSeq++ })), hole: s.dealer.hole },
      active: s.active,
      phase: s.phase,
    };
  }

  function dealerTotalText(vm) {
    const shown = vm.dealer.hole ? vm.dealer.cards.map((c) => c.id) : vm.dealer.cards.slice(0, 1).map((c) => c.id);
    if (!shown.length) return '';
    const r = B.total(shown);
    if (!vm.dealer.hole) return String(B.valueOf(shown[0]) === 1 ? 11 : B.valueOf(shown[0]));
    if (r.total > 21) return `${r.total}`;
    if (vm.dealer.cards.length === 2 && r.total === 21) return 'BJ';
    return r.soft ? t('soft', { n: r.total }) : t('hard', { n: r.total });
  }
  function handTotalText(hd) {
    const ids = hd.cards.map((c) => c.id);
    if (!ids.length) return '';
    const r = B.total(ids);
    if (r.total > 21) return t('bustWord');
    if (ids.length === 2 && r.total === 21 && !hd.split) return t('bjWord');
    return r.soft && r.total < 21 ? t('soft', { n: r.total }) : String(r.total);
  }

  function cardWidth() {
    const n = Math.max(table.vm.hands.length, table.s.opts.boxes);
    const W = ui.W;
    const base = n <= 1 ? 74 : n === 2 ? 60 : n === 3 ? 50 : 44;
    return Math.max(34, Math.min(base, Math.round(W * (n <= 1 ? 0.2 : 0.17))));
  }

  // flights: array of { zone:'d'|'p', hand, k, hidden }
  function paint(flights = []) {
    if (!ui || !table) return;
    const vm = table.vm;
    const s = table.s;
    const cw = cardWidth();
    ui.W = root.clientWidth || ui.W;
    // dealer
    clear(ui.dcards);
    vm.dealer.cards.forEach((c, k) => {
      const down = k === 1 && !vm.dealer.hole;
      const el = cardEl(toLib(c.id, c.uid), { size: cw, faceDown: down, lang: ctx.lang });
      el.dataset.slot = `d:${k}`;
      if (k) el.style.marginLeft = `${-Math.round(cw * 0.45)}px`;
      ui.dcards.append(el);
    });
    ui.dtotal.textContent = dealerTotalText(vm);
    ui.dtotal.hidden = !vm.dealer.cards.length;
    // players
    clear(ui.players);
    const betting = vm.phase === 'bet';
    if (betting) {
      const boxes = s.opts.boxes;
      for (let i = 0; i < boxes; i++) {
        const amt = table.bets[i] || 0;
        const spot = h(
          'button',
          { type: 'button', class: `g-bj-spot${table.active === i ? ' is-active' : ''}${amt ? ' has-bet' : ''}`, 'aria-label': `${boxes > 1 ? t('handN', { n: i + 1 }) + ': ' : ''}${t('bet')} ${amt}`, 'aria-pressed': String(table.active === i), onclick: () => (table.active = i, paint(), renderControls()) },
          boxes > 1 ? h('em', null, t('handN', { n: i + 1 })) : null,
          amt ? chipStack({ amount: amt, size: 34, maxPerStack: 6, maxStacks: 3 }) : h('span', { class: 'g-bj-spot-empty' }, t('bet')),
          amt ? h('b', { class: 'g-bj-spot-amt' }, fmt(amt)) : null,
        );
        spot.dataset.box = i;
        ui.players.append(spot);
      }
    } else {
      vm.hands.forEach((hd, i) => {
        const el = h('div', { class: `g-bj-hand${vm.active === i ? ' is-active' : ''}${hd.result ? ' res-' + hd.result : ''}`, dataset: { hand: i } });
        const cards = h('div', { class: 'g-bj-hcards' });
        hd.cards.forEach((c, k) => {
          const ce = cardEl(toLib(c.id, c.uid), { size: cw, lang: ctx.lang });
          ce.dataset.slot = `p${i}:${k}`;
          if (k) ce.style.marginLeft = `${-Math.round(cw * 0.5)}px`;
          if (hd.doubled && k === 2) ce.classList.add('is-dbl');
          cards.append(ce);
        });
        const tt = handTotalText(hd);
        el.append(cards, h('span', { class: `g-bj-total${tt === t('bustWord') ? ' is-bust' : ''}${tt === t('bjWord') ? ' is-bj' : ''}`, hidden: !tt }, tt));
        if (hd.bet) el.append(h('div', { class: 'g-bj-hbet' }, chipStack({ amount: hd.bet, size: 22, maxPerStack: 5, maxStacks: 3 }), h('b', null, fmt(hd.bet))));
        if (hd.result) {
          const label = t('r_' + hd.result);
          el.append(h('div', { class: `g-bj-tag is-${hd.result}` }, h('b', null, label), h('small', null, signed(hd.net))));
        }
        ui.players.append(el);
      });
      if (vm.hands.length > 1) ui.players.dataset.many = '1';
      else delete ui.players.dataset.many;
    }
    ui.players.style.setProperty('--gb-cw', cw + 'px');
    // flights
    const shoeRect = ui.shoe.getBoundingClientRect();
    const ps = [];
    for (const f of flights) {
      const sel = f.zone === 'd' ? `[data-slot="d:${f.k}"]` : `[data-slot="p${f.hand}:${f.k}"]`;
      const el = (f.zone === 'd' ? ui.dcards : ui.players).querySelector(sel);
      if (el) {
        cs.deal();
        ps.push(anim.flyCard(el, shoeRect, null, { duration: 330, faceDownFrom: true, fromRotate: -6 }).then(() => (f.flip ? null : null)));
      }
    }
    updateHud();
    return Promise.all(ps);
  }

  function updateHud() {
    if (!ui || !table) return;
    const s = table.s;
    const left = s.shoe.length;
    const total = B.cardsTotal(s);
    const cut = Math.floor(total * s.opts.pen);
    const pct = Math.max(0, Math.min(100, ((total - left) / total) * 100));
    ui.shoe.querySelector('.g-bj-shoe-bar i').style.width = pct + '%';
    ui.shoe.querySelector('.g-bj-shoe-bar em').style.left = (cut / total) * 100 + '%';
    ui.shoe.setAttribute('aria-label', t('shoeLeft', { n: left }));
    ui.shoe.title = t('shoeLeft', { n: left });
    // centre of the HUD: challenge goal or session result
    clear(ui.mid);
    if (table.meta.mode === 'challenge') {
      const c = table.meta.challenge;
      const pct2 = Math.max(0, Math.min(100, ((s.bankroll - 0) / c.goal) * 100));
      ui.mid.append(h('div', { class: 'g-bj-goal' }, h('span', null, `${t('levelN', { n: c.level })} · ${t('goal', { goal: fmt(c.goal) })}`), h('span', { class: 'g-bj-goalbar' }, h('i', { style: { width: pct2 + '%' } })), h('small', null, t('handsLeft', { n: Math.max(0, c.hands - c.used) }))));
    } else {
      const prof = s.bankroll - table.meta.session.start;
      ui.mid.append(h('div', { class: `g-bj-prof${prof > 0 ? ' up' : prof < 0 ? ' down' : ''}` }, h('small', null, t('sessionProfit')), h('b', null, signed(prof))));
    }
  }

  function setBalance(animateFrom) {
    const v = table.s.bankroll;
    if (animateFrom !== undefined) countUp(ui.balV, v, { from: animateFrom, ms: 700, fmt: (x) => fmt(x) });
    else {
      ui.balV.dataset.val = String(v);
      ui.balV.textContent = fmt(v);
    }
  }

  function say(text, ms = 1900, tone = '') {
    if (!ui) return;
    ui.banner.textContent = text;
    ui.banner.className = `g-bj-banner on ${tone}`;
    clearTimeout(ui.bannerT);
    ui.bannerT = later(() => ui && ui.banner.classList.remove('on'), ms);
  }

  // ---------- controls ----------
  function btn(label, cls, onclick, opts = {}) {
    const b = h('button', { type: 'button', class: `g-bj-btn ${cls}${opts.disabled ? ' is-disabled' : ''}`, 'aria-disabled': opts.disabled ? 'true' : null, onclick: () => (opts.disabled ? opts.onDisabled && opts.onDisabled() : onclick()) }, opts.icon ? h('span', { html: opts.icon }) : null, h('span', null, label));
    if (opts.id) b.dataset.act = opts.id;
    return b;
  }

  function renderControls() {
    if (!ui || !table) return;
    const s = table.s;
    clear(ui.controls);
    const c = ui.controls;
    if (s.phase === 'bet') {
      const lim = B.betLimits(s);
      const total = table.bets.reduce((a, b) => a + b, 0);
      c.append(h('div', { class: 'g-bj-betinfo' }, h('b', null, total ? `${t('totalBet')}: ${fmt(total)}` : t('placeBet')), h('small', null, t('minMax', { min: s.opts.min, max: fmt(Math.min(s.opts.max, s.bankroll)) }))));
      const tray = h('div', { class: 'g-bj-tray', role: 'group', 'aria-label': t('bet') });
      for (const d of B.CHIPS) {
        const afford = total + d <= s.bankroll && (table.bets[table.active] || 0) + d <= lim.max + (table.bets[table.active] || 0) && (table.bets[table.active] || 0) + d <= s.opts.max;
        const b = h('button', { type: 'button', class: `g-bj-chipbtn${afford ? '' : ' is-off'}`, 'aria-label': `${t('bet')} +${d}`, 'aria-disabled': afford ? null : 'true', onclick: () => addChip(d, b) }, chipEl({ denom: d, size: 54 }));
        tray.append(b);
      }
      c.append(tray);
      const last = table.meta.lastBets || [];
      const canRepeat = last.reduce((a, b) => a + b, 0) > 0 && last.reduce((a, b) => a + b, 0) <= s.bankroll;
      const canDouble = total > 0 && total * 2 <= s.bankroll;
      const ok = total >= s.opts.min && total <= s.bankroll;
      c.append(
        h(
          'div',
          { class: 'g-bj-row' },
          btn(t('clear'), 'is-ghost', clearBets, { disabled: !total }),
          btn(t('repeat'), 'is-ghost', repeatBets, { disabled: !canRepeat }),
          btn(t('double2x'), 'is-ghost', doubleBets, { disabled: !canDouble }),
        ),
        btn(t('deal'), 'is-primary is-big', () => dealNow(), { disabled: !ok, onDisabled: () => say(total ? t('noChips') : t('needBet', { min: s.opts.min }), 1600), id: 'deal' }),
      );
    } else if (s.phase === 'insurance') {
      const cost = B.insuranceCost(s);
      c.append(h('div', { class: 'g-bj-ins' }, h('b', null, t('insuranceQ')), h('p', null, t('insuranceText', { cost }))));
      c.append(h('div', { class: 'g-bj-row' }, btn(t('noInsure'), 'is-ghost', () => insure(false)), btn(t('insure', { cost }), 'is-primary', () => insure(true), { disabled: !B.canInsure(s), onDisabled: () => say(t('noChips'), 1400) })));
    } else if (s.phase === 'player') {
      const la = B.legalActions(s);
      const grid = h('div', { class: 'g-bj-actions' });
      grid.append(
        btn(t('hit'), 'is-act', () => act('hit'), { disabled: !la.hit || busy, id: 'hit' }),
        btn(t('stand'), 'is-act', () => act('stand'), { disabled: !la.stand || busy, id: 'stand' }),
        btn(t('doubleDown'), 'is-act', () => act('double'), { disabled: !la.double || busy, id: 'double' }),
        btn(t('split'), 'is-act', () => act('split'), { disabled: !la.split || busy, id: 'split' }),
      );
      c.append(grid);
      const extra = h('div', { class: 'g-bj-row' });
      if (s.opts.surrender) extra.append(btn(t('surrenderBtn'), 'is-ghost', () => act('surrender'), { disabled: !la.surrender || busy, id: 'surrender' }));
      if (table.meta.hint) extra.append(btn(t('hint'), 'is-ghost is-hint', showHint, { icon: ICON.bulb, disabled: busy, id: 'hint' }));
      if (extra.children.length) c.append(extra);
      if (table.hintMove) {
        const b = grid.querySelector(`[data-act="${table.hintMove}"]`);
        if (b) b.classList.add('is-suggest');
      }
    } else if (s.phase === 'dealer') {
      c.append(h('div', { class: 'g-bj-wait' }, h('span', { class: 'g-bj-dots' }, h('i'), h('i'), h('i'))));
    } else if (s.phase === 'settled') {
      renderSettledControls();
    }
  }

  function renderSettledControls() {
    const s = table.s;
    const c = ui.controls;
    clear(c);
    const net = s.lastNet;
    c.append(h('div', { class: `g-bj-result${net > 0 ? ' up' : net < 0 ? ' down' : ''}` }, h('b', null, net > 0 ? `+${fmt(net)}` : net < 0 ? `−${fmt(-net)}` : '0'), h('small', null, t('net', { n: '' }).trim())));
    const bets = table.bets.slice();
    const sum = bets.reduce((a, b) => a + b, 0);
    c.append(
      h(
        'div',
        { class: 'g-bj-row' },
        btn(t('nextHand'), 'is-ghost', () => nextHand(false), { id: 'next' }),
        btn(t('rebet'), 'is-primary', () => nextHand(true), { disabled: sum <= 0 || sum > s.bankroll, id: 'rebet' }),
      ),
    );
  }

  function primaryKey() {
    if (!table || busy) return;
    const s = table.s;
    if (s.phase === 'bet') dealNow();
    else if (s.phase === 'settled') nextHand(table.bets.reduce((a, b) => a + b, 0) > 0 && table.bets.reduce((a, b) => a + b, 0) <= s.bankroll);
  }

  // ---------- betting ----------
  function addChip(d, srcEl) {
    if (!table || busy || table.s.phase !== 'bet') return;
    const s = table.s;
    const total = table.bets.reduce((a, b) => a + b, 0);
    const cur = table.bets[table.active] || 0;
    if (total + d > s.bankroll || cur + d > s.opts.max) {
      cs.error();
      say(total + d > s.bankroll ? t('noChips') : t('minMax', { min: s.opts.min, max: fmt(s.opts.max) }), 1400);
      return;
    }
    table.bets[table.active] = cur + d;
    cs.chipSingle();
    paint();
    renderControls();
    const spot = ui.players.querySelector(`[data-box="${table.active}"]`);
    if (srcEl && spot && !reduce()) anim.chipToss(srcEl, spot, { count: 1, denom: d, size: 26, duration: 340 });
  }
  function clearBets() {
    table.bets = table.bets.map(() => 0);
    cs.fold();
    paint();
    renderControls();
  }
  function repeatBets() {
    const last = table.meta.lastBets || [];
    table.bets = Array(table.s.opts.boxes)
      .fill(0)
      .map((_, i) => last[i] || 0);
    cs.chipStack(3);
    paint();
    renderControls();
  }
  function doubleBets() {
    const total = table.bets.reduce((a, b) => a + b, 0);
    if (total * 2 > table.s.bankroll) return;
    table.bets = table.bets.map((b) => Math.min(table.s.opts.max, b * 2));
    cs.chipStack(4);
    paint();
    renderControls();
  }

  // ---------- engine actions ----------
  function applyEvent(e) {
    const vm = table.vm;
    const s = table.s;
    switch (e.t) {
      case 'deal': {
        if (e.to === 'dealer') {
          vm.dealer.cards.push({ id: e.card, uid: uidSeq++ });
          return [{ zone: 'd', k: vm.dealer.cards.length - 1 }];
        }
        const hd = vm.hands[e.to];
        hd.cards.push({ id: e.card, uid: uidSeq++ });
        return [{ zone: 'p', hand: e.to, k: hd.cards.length - 1 }];
      }
      case 'split': {
        const hd = vm.hands[e.hand];
        const moved = hd.cards.pop();
        vm.hands.splice(e.hand + 1, 0, { cards: [moved], bet: hd.bet, box: hd.box, result: null, net: 0, done: false, doubled: false, split: true });
        hd.split = true;
        return [];
      }
      case 'double':
        vm.hands[e.hand].bet *= 2;
        vm.hands[e.hand].doubled = true;
        return [];
      case 'reveal':
        return [];
      case 'settle':
        s.hands.forEach((hd, i) => {
          if (vm.hands[i]) {
            vm.hands[i].result = hd.result;
            vm.hands[i].net = hd.net;
          }
        });
        return [];
      default:
        return [];
    }
  }

  async function playEvents(evs) {
    if (!table || !ui) return;
    const s = table.s;
    const bankBefore = Number(ui.balV.dataset.val ?? s.bankroll);
    for (const e of evs) {
      if (!table || !ui) return;
      if (e.t === 'shuffle') {
        cs.shuffle();
        say(e.mid ? t('cutCard') : t('shuffling'), 1100);
        if (!reduce()) await anim.shake(ui.shoe, 4);
        continue;
      }
      if (e.t === 'peek') {
        if (e.blackjack) {
          say(t('dealerPeek'), 1800, 'bad');
          await revealHole();
        } else say(t('dealerNoPeek'), 1200);
        continue;
      }
      if (e.t === 'bust') {
        cs.error();
        continue;
      }
      if (e.t === 'insure' || e.t === 'surrender') {
        cs.chipSingle();
        continue;
      }
      const fl = applyEvent(e);
      if (e.t === 'reveal') {
        await revealHole();
        continue;
      }
      if (e.t === 'settle') {
        paint();
        await settleFx(s, bankBefore);
        continue;
      }
      if (e.t === 'deal') {
        await paint(fl.map((f) => ({ ...f, hand: f.hand })));
        await sleep(e.to === 'dealer' ? 90 : 60);
        continue;
      }
      if (e.t === 'split') {
        cs.chipSingle();
        paint();
        await sleep(240);
        continue;
      }
      if (e.t === 'double') {
        cs.chipStack(3);
        paint();
        await sleep(160);
        continue;
      }
    }
    if (!table || !ui) return;
    syncVm();
    paint();
    updateHud();
  }

  async function revealHole() {
    const vm = table.vm;
    vm.dealer.hole = false;
    paint();
    vm.dealer.hole = true;
    const el = ui.dcards.querySelector('[data-slot="d:1"]');
    if (el) {
      cs.flip();
      await anim.flip(el, false);
    }
    paint();
    await sleep(160);
  }

  async function settleFx(s, bankBefore) {
    const net = s.lastNet;
    // chips travel to the winner
    if (!reduce()) {
      const handsEls = [...ui.players.querySelectorAll('.g-bj-hand')];
      handsEls.forEach((el, i) => {
        const hd = s.hands[i];
        if (!hd) return;
        if (hd.net > 0) anim.chipToss(ui.dealer, el, { count: Math.min(5, 2 + Math.floor(hd.net / 100)), denom: hd.net >= 500 ? 100 : 25, size: 24, duration: 520 });
        else if (hd.net < 0) anim.chipToss(el, ui.dealer, { count: 3, denom: 5, size: 24, duration: 520 });
      });
    }
    if (net > 0) {
      cs.chipStack(6);
      later(() => cs.win(), 250);
      say(`${t(s.hands.some((x) => x.result === 'blackjack') ? 'r_blackjack' : 'r_win')}  +${fmt(net)}`, 2200, 'good');
    } else if (net < 0) {
      cs.lose();
      say(`${t('r_lose')}  −${fmt(-net)}`, 2200, 'bad');
    } else {
      cs.check();
      say(t('r_push'), 1800);
    }
    setBalance(bankBefore);
    await sleep(500);
  }

  async function run(fn) {
    if (!table || busy) return false;
    busy = true;
    table.hintMove = null;
    const ev = fn();
    renderControls();
    if (!ev) {
      busy = false;
      renderControls();
      return false;
    }
    persist();
    const mine = table;
    await playEvents(ev);
    if (table !== mine) return true;
    busy = false;
    afterAction();
    return true;
  }

  function afterAction() {
    if (!table) return;
    const s = table.s;
    renderControls();
    if (s.phase === 'dealer') dealerLoop();
    else if (s.phase === 'settled') settledView(true);
    persist();
  }

  async function dealNow() {
    if (!table || busy) return;
    const s = table.s;
    const bets = table.bets.slice();
    if (!B.validateBets(s, bets)) return;
    table.meta.lastBets = bets.slice();
    const startBank = s.bankroll;
    // chips leave the bankroll right away
    syncVmForDeal(bets);
    const mine = table;
    const ok = await run(() => B.deal(s, bets));
    if (!ok || table !== mine) return;
    setBalance(startBank);
  }
  function syncVmForDeal(bets) {
    const s = table.s;
    table.vm = { hands: [], dealer: { cards: [], hole: false }, active: -1, phase: 'player' };
    bets.forEach((b, box) => {
      if (b > 0) table.vm.hands.push({ cards: [], bet: b, box, result: null, net: 0, done: false, doubled: false, split: false });
    });
    void s;
  }

  async function insure(take) {
    await run(() => B.insure(table.s, take));
  }

  async function act(kind) {
    if (!table || busy || table.s.phase !== 'player') return;
    const s = table.s;
    const la = B.legalActions(s);
    const map = { hit: B.hit, stand: B.stand, double: B.doubleDown, split: B.split, surrender: B.surrender };
    if (!la[kind]) {
      cs.error();
      return;
    }
    cs.select();
    const before = s.bankroll;
    await run(() => map[kind](s));
    if (table && s.bankroll !== before && kind !== 'stand') setBalance(before);
  }

  function showHint() {
    if (!table || busy || table.s.phase !== 'player') return;
    const s = table.s;
    const hd = B.activeHand(s);
    if (!hd) return;
    const mv = suggest(hd.cards, B.rankOf(s.dealer.cards[0]), s.opts, B.legalActions(s));
    table.hintMove = mv === 'surrender' ? 'surrender' : mv;
    say(t('hintSay', { move: t('mv_' + mv) }), 3200);
    cs.select();
    renderControls();
  }

  async function dealerLoop() {
    if (!table || busy) return;
    busy = true;
    const mine = table;
    renderControls();
    await sleep(380);
    let guard = 0;
    while (table === mine && mine.s.phase === 'dealer' && guard++ < 40) {
      const before = mine.s.bankroll;
      const ev = B.dealerStep(mine.s);
      if (!ev) break;
      persist();
      await playEvents(ev);
      void before;
      if (mine.s.phase === 'dealer') await sleep(520);
    }
    if (table !== mine) return;
    busy = false;
    afterAction();
  }

  // settled: record statistics once per hand, challenge / bust checks
  async function settledView(fresh) {
    const s = table.s;
    const meta = table.meta;
    if (meta.recorded !== s.round) {
      meta.recorded = s.round;
      recordHand();
    }
    setBalance();
    renderControls();
    if (!fresh) {
      say(s.lastNet > 0 ? `${t('r_win')}  +${fmt(s.lastNet)}` : s.lastNet < 0 ? `${t('r_lose')}  −${fmt(-s.lastNet)}` : t('r_push'), 1800);
      ui.dtotal.textContent = dealerTotalText(table.vm);
    }
    persist();
    await challengeCheck();
    if (table && table.s.phase === 'settled') await checkBustAfter();
  }

  function recordHand() {
    const s = table.s;
    const st = getStats();
    st.hands++;
    for (const hd of s.hands) {
      if (hd.result === 'win' || hd.result === 'blackjack') st.wins++;
      else if (hd.result === 'push') st.pushes++;
      else st.losses++;
      if (hd.result === 'blackjack') st.bj++;
      if (hd.result === 'bust') st.busts++;
    }
    st.best = Math.max(st.best, s.bankroll);
    st.big = Math.max(st.big, s.lastNet);
    store.set('stats', st);
    const hist = getHist();
    hist.push({ t: Date.now(), res: s.hands.map((x) => x.result), net: s.lastNet, p: s.hands.map((x) => B.total(x.cards).total), d: B.total(s.dealer.cards).total, chips: s.bankroll });
    while (hist.length > 60) hist.shift();
    store.set('hist', hist);
    table.meta.session.hands++;
    if (table.meta.mode === 'challenge') table.meta.challenge.used++;
  }

  async function challengeCheck() {
    if (!table || table.meta.mode !== 'challenge' || table.meta.challengeDone === table.s.round) return;
    const s = table.s;
    const c = table.meta.challenge;
    const mine = table;
    let result = null;
    if (s.bankroll >= c.goal) result = 'done';
    else if (c.used >= c.hands || s.bankroll < s.opts.min) result = 'fail';
    if (!result) return;
    table.meta.challengeDone = s.round;
    await sleep(1100);
    if (table !== mine) return;
    if (result === 'done') {
      const st = getStats();
      st.level = Math.max(st.level, c.level + 1);
      store.set('stats', st);
      const xp = 20 + 8 * c.level;
      cs.win();
      ctx.ui.confetti?.();
      ctx.addXP?.(xp);
      saveBox.clear();
      const v = await ask({
        title: t('levelDone', { n: c.level }),
        node: h('div', { class: 'g-bj-done' }, h('p', null, t('levelDoneText', { chips: fmt(s.bankroll), used: c.used })), h('b', { class: 'g-bj-xp' }, t('xpEarned', { n: xp }))),
        actions: [
          { label: t('toMenu'), value: 'menu' },
          { label: t('nextLevel'), value: 'next', primary: true },
        ],
      });
      if (table !== mine) return;
      if (v === 'next') startChallengeLevel(c.level + 1);
      else showMenu();
    } else {
      ctx.addXP?.(5);
      saveBox.clear();
      cs.lose();
      const v = await ask({
        title: t('levelFail'),
        text: t('levelFailText', { goal: fmt(c.goal) }),
        actions: [
          { label: t('toMenu'), value: 'menu' },
          { label: t('retry'), value: 'retry', primary: true },
        ],
      });
      if (table !== mine) return;
      if (v === 'retry') startChallengeLevel(c.level);
      else showMenu();
    }
  }

  function startChallengeLevel(level) {
    const prefs = getPrefs();
    const s = B.newGame(randomSeed(), tableOpts(prefs));
    const meta = { mode: 'challenge', hint: !!prefs.hint, session: { hands: 0, start: s.bankroll, xpHands: 0 }, lastBets: [], recorded: 0, challenge: { ...B.challengeLevel(level), used: 0 } };
    begin(s, meta, true);
  }

  async function checkBustAfter() {
    await checkBust();
  }
  async function checkBust() {
    if (!table || table.meta.mode === 'challenge') return;
    const s = table.s;
    if (!['bet', 'settled'].includes(s.phase)) return;
    if (s.bankroll >= s.opts.min) return;
    const mine = table;
    cs.lose();
    const v = await ask({
      title: t('bustTitle'),
      text: t('bustText'),
      actions: [
        { label: t('toMenu'), value: 'menu' },
        { label: t('refill'), value: 'refill', primary: true },
      ],
    });
    if (table !== mine) return;
    await awardSession();
    if (v === 'refill') {
      if (s.phase === 'settled') B.nextHand(s);
      B.refill(s);
      table.bets = Array(s.opts.boxes).fill(0);
      table.meta.lastBets = [];
      table.meta.session = { hands: 0, start: s.bankroll, xpHands: 0 };
      syncVm();
      paint();
      setBalance();
      renderControls();
      persist();
    } else {
      saveBox.clear();
      showMenu();
    }
  }

  function nextHand(rebet) {
    if (!table || busy) return;
    const s = table.s;
    if (s.phase !== 'settled') return;
    // collect the table
    B.nextHand(s);
    syncVm();
    if (!rebet) table.bets = Array(s.opts.boxes).fill(0);
    else {
      const last = table.meta.lastBets || [];
      table.bets = Array(s.opts.boxes).fill(0).map((_, i) => last[i] || 0);
    }
    table.hintMove = null;
    ui.banner.classList.remove('on');
    if (!reduce() && ui.players.children.length) {
      // soft sweep of the old cards
      const cards = [...ui.players.querySelectorAll('.dc'), ...ui.dcards.querySelectorAll('.dc')];
      const mine = table;
      const done = anim.collect(cards, ui.shoe, { remove: false, duration: 260, stagger: 18 });
      busy = true;
      done.then(() => {
        busy = false;
        if (table !== mine) return;
        paint();
        renderControls();
        setBalance();
        persist();
        if (rebet) dealNow();
        else checkBust();
      });
      return;
    }
    paint();
    renderControls();
    setBalance();
    persist();
    if (rebet) dealNow();
    else checkBust();
  }

  // =====================================================================================
  showMenu();
  if (ctx.mode === 'classic' || ctx.mode === 'challenge') startNew(ctx.mode, false);

  return () => {
    disposed = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    if (roSeen) roSeen.disconnect();
    anim.dispose();
    ctx.setHeaderRight(null);
    ctx.setTitle();
    root.querySelectorAll('.dt-overlay, .dt-confetti').forEach((n) => n.remove());
  };
}
