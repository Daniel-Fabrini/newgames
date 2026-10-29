// Color Rush — an original UNO-style shedding game (rules in rules.js, computer players in ai.js).
//   Menu → table (1 human + 1 or 3 computer players) → round summaries → match results.
//   Modes (ctx.mode): solo (you vs 3), duel (you vs 1). Matches autosave and resume with the same RNG state.
//   The "call-out" is ONE! (UM! / ¡UNA!); the name "UNO" never appears in the interface.

import STRINGS from './strings.js';
import * as R from './rules.js';
import * as AI from './ai.js';
import { createHand, createOpponentHand } from '../_cards/hand.js';
import { setCardState, UNO_HEX } from '../_cards/card.js';
import { setCardLang } from '../_cards/decks.js';
import { createAnimator } from '../_cards/anim.js';
import { createCardSfx } from '../_cards/sfx.js';
import { avatarEl, deckPile, discardPile, rulesModal, resultModal } from '../_cards/table.js';
import { createMatchSave, createStats } from '../_cards/storage.js';
import { randomSeed } from '../_cards/rng.js';

const SAVE_VERSION = 1;
const COLOR_KEYS = ['R', 'Y', 'G', 'B'];
const KIND_NAME = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'wild', 'wild4'];
const AVATARS = [3, 6, 9, 12, 1, 14, 5, 8];
const PACE = [1, 0.85, 1.15, 1];

// engine card id → shared-library card model
const toLib = (id) => {
  const c = R.cardOf(id);
  return { r: KIND_NAME[c.kind], s: c.color === 4 ? 'W' : COLOR_KEYS[c.color], id: String(id) };
};
const sortKey = (id) => {
  const c = R.cardOf(id);
  return c.color * 20 + c.kind;
};
const sortedIds = (hand) => hand.slice().sort((a, b) => sortKey(a) - sortKey(b));

const svg = (inner, cls = '') => `<svg class="g-colors-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICON = {
  help: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  mute: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  stats: svg('<path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  rules: svg('<path d="M6 4h9l3 3v13H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 11h6M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  play: svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
  resume: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  skip: svg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6 18L18 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  user: svg('<circle cx="12" cy="8" r="3.6" fill="currentColor"/><path d="M5 20c.6-3.6 3.6-5.6 7-5.6s6.4 2 7 5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  users: svg('<circle cx="8.5" cy="9" r="3" fill="currentColor"/><circle cx="16" cy="10" r="2.5" fill="currentColor" opacity=".7"/><path d="M2.8 19c.4-3 2.7-4.7 5.7-4.7s5.3 1.7 5.7 4.7M14.6 15c2.9-.5 5.8.8 6.4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
};
const DIR_SVG =
  '<svg viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M100 14 A86 86 0 0 1 186 100"/><path d="M100 186 A86 86 0 0 1 14 100"/></g>' +
  '<g fill="currentColor"><path d="M186 100l-9-14h18z" transform="rotate(8 186 100)"/><path d="M14 100l9 14h-18z" transform="rotate(8 14 100)"/></g></svg>';

export async function mount(root, ctx) {
  await Promise.all([ctx.loadCSS(new URL('../_cards/cards.css', import.meta.url)), ctx.loadCSS(new URL('./style.css', import.meta.url))]);
  setCardLang(ctx.lang);
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const store = ctx.store;
  const anim = createAnimator();
  const cs = createCardSfx(ctx);
  const saveBox = createMatchSave(store, 'save', { version: SAVE_VERSION, validate: (x) => x && x.s && x.s.hands && x.meta });
  const statsBox = createStats(store, 'stats', { historyMax: 12 });
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
  const sleep = (ms) => new Promise((res) => later(res, reduce() ? Math.min(ms, 60) : ms));
  const cleanups = [];
  const listen = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => target.removeEventListener(ev, fn, opts));
  };

  // ---------- prefs / stats ----------
  const getPrefs = () => ({ mode: 'solo', level: 'normal', target: 200, challenges: true, stack: false, sound: true, ...(store.get('prefs', {}) || {}) });
  const setPrefs = (p) => store.set('prefs', { ...getPrefs(), ...p });
  cs.enabled = getPrefs().sound !== false;
  const getExtra = () => ({ rounds: 0, catches: 0, ...(store.get('extra', {}) || {}) });
  const bumpExtra = (k, n = 1) => {
    const e = getExtra();
    e[k] = (e[k] || 0) + n;
    store.set('extra', e);
  };

  // ---------- shell ----------
  const app = h('div', { class: 'g-colors-app' });
  root.append(app);
  let screen = 'menu';
  let dialogClose = null;
  let match = null; // { s, meta, mems, hand, opp[], ... }
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
      const body = node ? (typeof node === 'function' ? node(close) : node) : h('p', null, text);
      const acts = (actions || []).map((a) => h('button', { type: 'button', class: `dc-btn ${a.primary ? 'is-primary' : a.danger ? 'is-danger' : 'is-secondary'}`, onclick: () => close(a.value) }, a.label));
      const box = h('div', { class: `dt-modal g-colors-dlg ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' }, title ? h('h2', { class: 'dt-modal-title' }, title) : null, h('div', { class: 'dt-modal-body' }, body), acts.length ? h('div', { class: 'dt-modal-actions' }, acts) : null);
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

  // =====================================================================================
  // MENU
  // =====================================================================================
  function modeLabel(m) {
    return m === 'duel' ? t('duelTitle') : t('soloTitle');
  }

  function showMenu() {
    stopMatchUI();
    screen = 'menu';
    ctx.setTitle();
    setHeader(false);
    clear(app);
    app.className = 'g-colors-app is-menu';
    backFn = () => false;
    const prefs = getPrefs();
    const save = saveBox.load();
    const wrap = h('div', { class: 'g-colors-menu g-colors-enter' });

    // decorative fan of cards
    const fan = h('div', { class: 'g-colors-hero', 'aria-hidden': 'true' });
    [
      { id: 7, rot: -26, x: -86, y: 14 },
      { id: 25 + 19, rot: -13, x: -44, y: 2 },
      { id: 50 + 12, rot: 0, x: 0, y: -4 },
      { id: 75 + 23, rot: 13, x: 44, y: 2 },
      { id: 104, rot: 26, x: 86, y: 14 },
    ].forEach((c) => {
      const el = h('div', { class: 'g-colors-herocard', style: { transform: `translate(${c.x}px, ${c.y}px) rotate(${c.rot}deg)` } });
      import('../_cards/card.js').then((m) => {
        if (!disposed) el.append(m.unoCardEl(toLib(c.id), { size: 74 }));
      });
      fan.append(el);
    });
    wrap.append(fan);
    wrap.append(h('h1', { class: 'g-colors-title' }, t('name')));

    if (save) {
      wrap.append(
        h(
          'button',
          { class: 'g-colors-cont', type: 'button', onclick: () => resumeMatch(save) },
          h('span', { class: 'g-colors-cont-ico', html: ICON.resume }),
          h('span', { class: 'g-colors-cont-tx' }, h('b', null, t('continue')), h('small', null, t('continueInfo', { mode: modeLabel(save.meta.mode), round: save.s.round, score: save.s.scores[0] }))),
        ),
      );
    }

    // mode tiles
    const modes = h('div', { class: 'g-colors-modes', role: 'radiogroup', 'aria-label': t('play') });
    const modeTile = (id, ico, title, sub) =>
      h(
        'button',
        {
          type: 'button',
          class: `g-colors-mode${prefs.mode === id ? ' on' : ''}`,
          role: 'radio',
          'aria-checked': String(prefs.mode === id),
          onclick: () => {
            setPrefs({ mode: id });
            showMenu();
          },
        },
        h('span', { class: 'g-colors-mode-ico', html: ico }),
        h('b', null, title),
        h('small', null, sub),
      );
    modes.append(modeTile('solo', ICON.users, t('soloTitle'), t('soloSub')), modeTile('duel', ICON.user, t('duelTitle'), t('duelSub')));
    wrap.append(modes);

    const chipRow = (label, items, cur, onPick) =>
      h(
        'div',
        { class: 'g-colors-field' },
        h('span', { class: 'g-colors-lab' }, label),
        h(
          'div',
          { class: 'g-colors-chips', role: 'radiogroup', 'aria-label': label },
          items.map(([v, txt]) =>
            h('button', { type: 'button', role: 'radio', 'aria-checked': String(cur === v), class: `g-colors-chip${cur === v ? ' on' : ''}`, onclick: () => (onPick(v), showMenu()) }, txt),
          ),
        ),
      );
    wrap.append(
      chipRow(t('difficulty'), [['easy', t('easy')], ['normal', t('normal')], ['hard', t('hard')]], prefs.level, (v) => setPrefs({ level: v })),
      chipRow(t('target'), [[100, '100'], [200, '200'], [500, '500']], prefs.target, (v) => setPrefs({ target: v })),
    );
    const toggle = (label, sub, key) =>
      h(
        'button',
        {
          type: 'button',
          class: `g-colors-toggle${prefs[key] ? ' on' : ''}`,
          role: 'switch',
          'aria-checked': String(!!prefs[key]),
          onclick: () => {
            setPrefs({ [key]: !prefs[key] });
            showMenu();
          },
        },
        h('span', { class: 'g-colors-toggle-tx' }, h('b', null, label), h('small', null, sub)),
        h('i', { class: 'g-colors-sw' }),
      );
    wrap.append(h('div', { class: 'g-colors-opts' }, toggle(t('optChallenge'), t('optChallengeSub'), 'challenges'), toggle(t('optStack'), t('optStackSub'), 'stack')));

    wrap.append(
      h(
        'button',
        { type: 'button', class: 'g-colors-play', onclick: () => startNew(prefs.mode, true) },
        h('span', { html: ICON.play }),
        t('play'),
      ),
      h(
        'div',
        { class: 'g-colors-links' },
        h('button', { type: 'button', class: 'g-colors-link', onclick: showRules }, h('span', { html: ICON.rules }), t('rules')),
        h('button', { type: 'button', class: 'g-colors-link', onclick: showStats }, h('span', { html: ICON.stats }), t('stats')),
      ),
    );
    app.append(wrap);
  }

  function showRules() {
    const body = t('rulesBody');
    if (dialogClose) dialogClose(null);
    rulesModal({ root, title: t('rulesTitle'), sections: body.map(([title, text]) => ({ title, text })), closeLabel: t('close'), lang: ctx.lang });
  }

  function showStats() {
    const st = statsBox.get();
    const ex = getExtra();
    const rows = [
      [t('st_games'), st.games],
      [t('st_wins'), st.wins],
      [t('st_rounds'), ex.rounds],
      [t('st_best'), st.best ?? 0],
      [t('st_unos'), ex.catches],
      [t('st_streak'), st.bestStreak],
    ];
    const fmt = (ts) => {
      try {
        return new Date(ts).toLocaleDateString(ctx.lang === 'pt' ? 'pt-BR' : ctx.lang, { day: '2-digit', month: '2-digit' });
      } catch {
        return '';
      }
    };
    const body = h(
      'div',
      { class: 'g-colors-stats' },
      h('div', { class: 'g-colors-statgrid' }, rows.map(([l, v]) => h('div', { class: 'g-colors-stat' }, h('b', null, String(v)), h('small', null, l)))),
      h('h3', null, t('recent')),
      st.history.length
        ? h(
            'ul',
            { class: 'g-colors-hist' },
            st.history
              .slice()
              .reverse()
              .map((e) => h('li', { class: e.result }, h('span', null, fmt(e.t)), h('span', null, e.mode ? modeLabel(e.mode) : ''), h('b', null, e.result === 'win' ? t('win') : t('loss')), h('span', null, `${e.score ?? 0} pts`))),
          )
        : h('p', { class: 'g-colors-none' }, t('noHistory')),
    );
    ask({ title: t('statsTitle'), node: body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  }

  // =====================================================================================
  // START / RESUME
  // =====================================================================================
  async function startNew(mode, fromMenu = false) {
    const prefs = getPrefs();
    const existing = saveBox.load();
    if (existing) {
      const pick = await ask({
        title: t('replaceTitle'),
        text: t('replaceText'),
        actions: [
          { label: t('keepPlaying'), value: 'keep', primary: true },
          { label: t('newMatch'), value: 'new' },
        ],
        dismissible: true,
      });
      if (pick === 'keep') return resumeMatch(existing);
      if (pick !== 'new') return fromMenu ? undefined : showMenu();
      saveBox.clear();
    }
    const m = mode === 'duel' ? 'duel' : 'solo';
    setPrefs({ mode: m });
    const seed = randomSeed();
    const s = R.newMatch(seed, { players: m === 'duel' ? 2 : 4, target: prefs.target, challenges: !!prefs.challenges, stack: !!prefs.stack });
    // opponents: three of eight personalities, picked from the seed
    const order = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = order.length - 1; i > 0; i--) {
      const j = (seed >>> (i * 3)) % (i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const meta = { mode: m, level: prefs.level, who: order.slice(0, s.opts.players - 1), started: Date.now(), startedRound: 1, won: 0, catches: 0 };
    beginMatch(s, meta, true);
  }

  function resumeMatch(save) {
    if (dialogClose) dialogClose(null);
    beginMatch(save.s, save.meta, false);
  }

  const personaName = (idx) => {
    const names = t('names');
    return names[idx % names.length];
  };

  // =====================================================================================
  // TABLE
  // =====================================================================================
  let ui = null; // DOM refs of the table
  let busy = false;
  let catchOpen = false;
  let driving = false;
  let pickingColor = false;
  let keyHandler = null;
  let roSeen = null;

  function stopMatchUI() {
    match = null;
    ui = null;
    busy = false;
    catchOpen = false;
    driving = false;
    pickingColor = false;
    anim.skip();
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    if (roSeen) {
      roSeen.disconnect();
      roSeen = null;
    }
  }

  const players = () => match.s.opts.players;
  const nameOf = (p) => (p === 0 ? t('you') : personaName(match.meta.who[p - 1]));
  const colorName = (c) => t('c_' + COLOR_KEYS[c]);
  const seatSide = (p) => {
    const n = players();
    if (p === 0) return 'bottom';
    if (n === 2) return 'top';
    return n === 3 ? (p === 1 ? 'left' : 'right') : ['left', 'top', 'right'][p - 1];
  };

  function setHeader(inGame) {
    const box = h('div', { class: 'g-colors-hdr' });
    if (inGame) {
      const sb = h('button', { type: 'button', class: 'icon-btn', 'aria-label': cs.enabled ? t('soundOn') : t('soundOff'), title: t('sound'), html: cs.enabled ? ICON.sound : ICON.mute });
      sb.addEventListener('click', () => {
        cs.enabled = !cs.enabled;
        setPrefs({ sound: cs.enabled });
        sb.innerHTML = cs.enabled ? ICON.sound : ICON.mute;
        sb.setAttribute('aria-label', cs.enabled ? t('soundOn') : t('soundOff'));
      });
      box.append(sb, h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('rules'), title: t('rules'), html: ICON.help, onclick: showRules }));
      ctx.setHeaderRight(box);
    } else ctx.setHeaderRight(null);
  }

  function beginMatch(s, meta, fresh) {
    stopMatchUI();
    screen = 'table';
    setHeader(true);
    clear(app);
    app.className = 'g-colors-app is-table';
    const n = s.opts.players;
    match = { s, meta, mems: [], lastRoundSeen: s.round };
    buildTable(n);
    const confirmLeave = async () => {
      if (!match) return;
      if (s.phase === 'matchEnd') return showMenu();
      const v = await ask({
        title: t('leaveTitle'),
        text: t('leaveText'),
        actions: [
          { label: t('stay'), value: 'stay', primary: true },
          { label: t('leave'), value: 'leave' },
        ],
        dismissible: true,
      });
      if (v === 'leave') {
        persist();
        showMenu();
      }
    };
    backFn = () => {
      if (!match) return false;
      confirmLeave();
      return true;
    };
    freshMemories();
    syncAll(true);
    if (fresh) {
      persist();
      runDealAnimation(true).then(() => drive());
    } else {
      drive();
    }
  }

  function freshMemories() {
    const n = players();
    match.mems = Array.from({ length: n }, (_, i) => AI.createMemory(i, n));
    // a resumed or new round: memories see the visible discard only
    for (let i = 1; i < n; i++) AI.observe(match.mems[i], { t: 'flip', card: R.topCard(match.s) }, R.publicView(match.s, i));
  }

  function persist() {
    if (!match) return;
    const s = match.s;
    if (s.phase === 'matchEnd') return saveBox.clear();
    saveBox.save({ s, meta: match.meta });
  }

  function buildTable(n) {
    const s = match.s;
    const W = root.clientWidth || 390;
    const Hh = root.clientHeight || 760;
    const hw = Math.max(50, Math.min(90, Math.round(Math.min(W * 0.215, Hh * 0.115))));
    const pw = Math.max(56, Math.min(92, Math.round(Math.min(W * 0.205, Hh * 0.11))));
    const ow = Math.max(30, Math.min(40, Math.round(W * 0.095)));
    app.style.setProperty('--gc-hand', hw + 'px');
    app.style.setProperty('--gc-pile', pw + 'px');

    ui = { seats: [], opp: [] };
    const top = h('div', { class: 'g-colors-top' });
    const mid = h('div', { class: 'g-colors-mid' });
    const left = h('div', { class: 'g-colors-side is-left' });
    const right = h('div', { class: 'g-colors-side is-right' });
    const centre = h('div', { class: 'g-colors-centre' });
    mid.append(left, centre, right);

    const mkSeat = (p) => {
      const side = seatSide(p);
      const orient = side === 'left' ? 'left' : side === 'right' ? 'right' : 'top';
      const seat = h('div', { class: `g-colors-seat is-${side}`, dataset: { seat: p } });
      const av = h('div', { class: 'g-colors-av' }, avatarEl(AVATARS[match.meta.who[p - 1] % AVATARS.length], side === 'top' ? 42 : 38));
      const tag = h('div', { class: 'g-colors-tag', 'aria-hidden': 'true' }, t('unoQ'));
      const name = h('b', { class: 'g-colors-name' }, nameOf(p));
      const score = h('small', { class: 'g-colors-score' }, '0');
      const opp = createOpponentHand(seat, { count: 7, size: ow, orientation: orient, maxSpan: side === 'top' ? Math.min(220, W * 0.58) : Math.max(96, Math.min(150, Hh * 0.2)), back: 'uno', badge: true });
      const info = h('div', { class: 'g-colors-info' }, name, score);
      av.append(tag);
      seat.append(av, info);
      seat.insertBefore(opp.el, info);
      // order: avatar, hand, info
      seat.append(av);
      seat.insertBefore(av, opp.el);
      const btn = h('button', { type: 'button', class: 'g-colors-catch', 'aria-label': `${t('catchBtn')}: ${nameOf(p)}`, onclick: () => humanCatch(p) });
      seat.append(btn);
      ui.seats[p] = { el: seat, av, tag, name, score, btn, side };
      ui.opp[p] = opp;
      return seat;
    };
    for (let p = 1; p < n; p++) {
      const el = mkSeat(p);
      const side = seatSide(p);
      (side === 'top' ? top : side === 'left' ? left : right).append(el);
    }

    // centre: draw pile, discard + colour ring, direction ring
    const ring = h('div', { class: 'g-colors-ring' });
    const dirEl = h('div', { class: 'g-colors-dir', html: DIR_SVG, 'aria-hidden': 'true' });
    const draw = deckPile({ count: s.draw.length, size: pw, back: 'uno', label: '', showCount: true, onClick: () => humanDraw() });
    draw.setAttribute('aria-label', t('drawPile'));
    draw.classList.add('g-colors-draw');
    const discard = discardPile({ size: pw, lang: ctx.lang });
    discard.classList.add('g-colors-discard');
    const discardWrap = h('div', { class: 'g-colors-dwrap' }, ring, discard);
    const clabel = h('div', { class: 'g-colors-clabel', role: 'status' });
    const piles = h('div', { class: 'g-colors-piles' }, draw, discardWrap);
    centre.append(dirEl, piles, clabel);
    ui.ring = ring;
    ui.dirEl = dirEl;
    ui.draw = draw;
    ui.discard = discard;
    ui.clabel = clabel;
    ui.centre = centre;
    ui.piles = piles;

    // status + action bar
    const msg = h('div', { class: 'g-colors-msg', role: 'status', 'aria-live': 'polite' });
    const turnPill = h('div', { class: 'g-colors-turn' }, h('i', null), h('span', null, ''));
    const myAv = h('div', { class: 'g-colors-me' }, h('span', { class: 'g-colors-me-av' }, avatarEl(0, 34)), h('span', { class: 'g-colors-me-tx' }, h('b', null, t('you')), h('small', { class: 'g-colors-me-score' }, '0')));
    const unoBtn = h('button', { type: 'button', class: 'g-colors-uno', onclick: humanUno, 'aria-label': t('unoHelp') }, h('span', null, t('uno')));
    const passBtn = h('button', { type: 'button', class: 'g-colors-pass dc-btn is-secondary', onclick: humanPass }, t('pass'));
    const drawBtn = h('button', { type: 'button', class: 'g-colors-drawbtn dc-btn is-secondary', onclick: humanDraw }, t('draw'));
    const bar = h('div', { class: 'g-colors-bar' }, myAv, h('div', { class: 'g-colors-acts' }, drawBtn, passBtn), unoBtn);
    ui.msg = msg;
    ui.turnPill = turnPill;
    ui.myScore = myAv.querySelector('.g-colors-me-score');
    ui.myAv = myAv;
    ui.unoBtn = unoBtn;
    ui.passBtn = passBtn;
    ui.drawBtn = drawBtn;
    ui.bar = bar;

    const handWrap = h('div', { class: 'g-colors-handwrap' });
    ui.handWrap = handWrap;
    ui.hand = createHand(handWrap, {
      cards: [],
      size: hw,
      mode: 'fan',
      select: 'none',
      maxRows: 2,
      minStep: 0.3,
      back: 'uno',
      lang: ctx.lang,
      onActivate: (c) => humanPlay(+c.id),
      onDisabledTap: (c) => {
        const el = ui.hand.cardEl(c.id);
        if (el) anim.shake(el, 4);
        cs.error();
        const s2 = match && match.s;
        flashMsg(s2 && s2.turn === 0 && s2.phase !== 'challenge' ? t('cantPlay') : t('notYourTurn'));
      },
    });

    const fxLayer = h('div', { class: 'g-colors-fx', 'aria-hidden': 'true' });
    ui.fx = fxLayer;
    const head = h('div', { class: 'g-colors-status' }, turnPill, msg);
    app.append(top, mid, head, bar, handWrap, fxLayer);
    // card sizes follow the viewport
    if (typeof ResizeObserver !== 'undefined') {
      let lw = W;
      roSeen = new ResizeObserver(() => {
        if (!ui || !root.clientWidth) return;
        if (Math.abs(root.clientWidth - lw) > 20) {
          lw = root.clientWidth;
          const nh = Math.max(50, Math.min(90, Math.round(Math.min(lw * 0.215, root.clientHeight * 0.115))));
          app.style.setProperty('--gc-hand', nh + 'px');
          ui.hand.setSize(nh);
        }
      });
      roSeen.observe(root);
    }

    // keyboard shortcuts for desktop: D draw, P pass, U call, 1-4 colour picker is handled in the dialog
    keyHandler = (e) => {
      if (!match || dialogClose || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'd') humanDraw();
      else if (k === 'p') humanPass();
      else if (k === 'u') humanUno();
    };
    window.addEventListener('keydown', keyHandler);
  }

  // ---------- rendering helpers ----------
  function flashMsg(text, ms = 2200) {
    if (!ui) return;
    ui.msg.textContent = text;
    ui.msg.classList.add('on');
    clearTimeout(ui.msgT);
    ui.msgT = later(() => ui && ui.msg.classList.remove('on'), ms);
  }

  function syncPiles() {
    const s = match.s;
    const cards = s.discard.slice(-3).map(toLib);
    if (ui.discard._ids !== cards.map((c) => c.id).join()) {
      ui.discard.setCards(cards);
      ui.discard._ids = cards.map((c) => c.id).join();
      ui.discard._cards = cards;
    }
    ui.draw.setCount(s.draw.length);
    syncColor(s.color);
    syncDir(s.dir);
  }
  function syncColor(c) {
    ui.ring.dataset.c = c >= 0 && c < 4 ? COLOR_KEYS[c] : '';
    ui.ring.style.setProperty('--rc', UNO_HEX[COLOR_KEYS[c]] || '#555');
    ui.clabel.innerHTML = '';
    if (c >= 0 && c < 4) {
      ui.clabel.append(h('i', { style: { background: UNO_HEX[COLOR_KEYS[c]] } }), h('span', null, t('activeColor', { color: colorName(c) })));
    }
  }
  function syncDir(d) {
    ui.dirEl.classList.toggle('ccw', d < 0);
    ui.dirEl.setAttribute('title', d < 0 ? t('direction_ccw') : t('direction_cw'));
    ui.dirEl.setAttribute('data-label', d < 0 ? t('direction_ccw') : t('direction_cw'));
  }

  function syncHand(force = false) {
    const s = match.s;
    const want = sortedIds(s.hands[0]).map(String);
    const have = ui.hand.getCards().map((c) => c.id);
    if (force || want.join() !== have.join()) ui.hand.setCards(want.map((id) => toLib(+id)), { animate: false });
    refreshPlayable();
  }

  function myTurnActive() {
    const s = match.s;
    return !busy && !pickingColor && s.turn === 0 && (s.phase === 'turn' || s.phase === 'drawn');
  }

  function refreshPlayable() {
    if (!ui || !match) return;
    const s = match.s;
    const active = s.turn === 0 && (s.phase === 'turn' || s.phase === 'drawn');
    const legal = new Set(active ? R.legalPlays(s, 0).map(String) : []);
    ui.hand.setPlayable(active ? (c) => legal.has(c.id) : null);
    for (const c of ui.hand.getCards()) {
      const el = ui.hand.cardEl(c.id);
      if (el) setCardState(el, { highlight: active && !busy && legal.has(c.id) });
    }
  }

  function syncSeats() {
    const s = match.s;
    for (let p = 1; p < players(); p++) {
      const sc = ui.seats[p];
      ui.opp[p].setCount(s.hands[p].length);
      sc.score.textContent = String(s.scores[p]);
      sc.el.classList.toggle('is-turn', s.turn === p && (s.phase === 'turn' || s.phase === 'drawn' || s.phase === 'startColor' || s.phase === 'challenge'));
      sc.el.classList.toggle('is-vul', s.vul === p);
      sc.el.setAttribute('aria-label', t('cardsLabel', { name: nameOf(p), n: s.hands[p].length }));
      sc.btn.disabled = s.vul !== p;
      sc.btn.hidden = s.vul !== p;
    }
    ui.myScore.textContent = String(s.scores[0]);
    ui.myAv.classList.toggle('is-turn', s.turn === 0 && (s.phase === 'turn' || s.phase === 'drawn' || s.phase === 'startColor' || s.phase === 'challenge'));
    ui.myAv.classList.toggle('is-vul', s.vul === 0);
  }

  function syncChrome() {
    if (!ui || !match) return;
    const s = match.s;
    syncSeats();
    // turn pill
    let text = '';
    let mine = false;
    if (s.phase === 'roundEnd' || s.phase === 'matchEnd') text = '';
    else if (s.turn === 0) {
      mine = true;
      text = s.phase === 'drawn' ? t('playDrawn') : s.pend > 0 ? t('stackPending', { n: s.pend }) : t('yourTurn');
    } else text = t('turnOf', { name: nameOf(s.turn) });
    ui.turnPill.querySelector('span').textContent = text;
    ui.turnPill.classList.toggle('is-mine', mine);
    ui.turnPill.hidden = !text;
    // actions
    const active = s.turn === 0 && (s.phase === 'turn' || s.phase === 'drawn') && !busy;
    const hasLegal = active && R.legalPlays(s, 0).length > 0;
    ui.drawBtn.hidden = s.phase === 'drawn';
    ui.drawBtn.classList.toggle('is-primary', active && !hasLegal && s.phase === 'turn');
    ui.drawBtn.classList.toggle('is-secondary', !(active && !hasLegal && s.phase === 'turn'));
    ui.drawBtn.classList.toggle('is-disabled', !active);
    ui.drawBtn.setAttribute('aria-disabled', String(!active));
    ui.passBtn.hidden = s.phase !== 'drawn';
    ui.passBtn.classList.toggle('is-disabled', !active);
    ui.passBtn.setAttribute('aria-disabled', String(!active));
    ui.draw.classList.toggle('is-hint', active && !hasLegal && s.phase === 'turn');
    ui.draw.classList.toggle('is-live', active && s.phase === 'turn');
    const canUno = !!(s.vul === 0 || (s.turn === 0 && (s.phase === 'turn' || s.phase === 'drawn') && s.hands[0].length <= 2 && !s.said[0]));
    ui.unoBtn.classList.toggle('is-ready', canUno);
    ui.unoBtn.classList.toggle('is-late', s.vul === 0);
    ui.unoBtn.classList.toggle('is-said', !!s.said[0] && s.hands[0].length <= 2);
    ui.unoBtn.setAttribute('aria-disabled', String(!canUno));
    refreshPlayable();
  }

  function syncAll(initial = false) {
    if (!ui || !match) return;
    syncPiles();
    syncHand(initial);
    syncChrome();
  }

  // ---------- effects ----------
  const rectOfEl = (el) => (el ? el.getBoundingClientRect() : { left: root.getBoundingClientRect().left + root.clientWidth / 2, top: root.getBoundingClientRect().top + root.clientHeight / 2, width: 0, height: 0 });
  const seatAnchor = (p) => (p === 0 ? ui.handWrap : ui.seats[p].av);
  function relPos(el) {
    const r = el.getBoundingClientRect();
    const b = app.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  }
  function floatText(text, p, kind = '') {
    if (!ui) return;
    const pos = p === 'centre' ? relPos(ui.piles) : relPos(seatAnchor(p));
    const el = h('div', { class: `g-colors-float ${kind}`, style: { left: pos.x + 'px', top: pos.y + 'px' } }, text);
    ui.fx.append(el);
    if (reduce()) {
      el.style.transform = 'translate(-50%,-110%)';
      later(() => el.remove(), 900);
      return;
    }
    const a = el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
        { transform: 'translate(-50%,-70%) scale(1.15)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%,-120%) scale(1)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,-160%) scale(.95)', opacity: 0 },
      ],
      { duration: 1100, easing: 'ease-out' },
    );
    a.onfinish = () => el.remove();
  }
  function skipFlash(p) {
    if (!ui) return;
    const target = p === 0 ? ui.myAv : ui.seats[p].av;
    const pos = relPos(target);
    const el = h('div', { class: 'g-colors-skipfx', html: ICON.skip, style: { left: pos.x + 'px', top: pos.y + 'px' } });
    ui.fx.append(el);
    if (reduce()) return later(() => el.remove(), 600);
    const a = el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.4) rotate(-40deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.25) rotate(0)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 },
      ],
      { duration: 900, easing: 'ease-out' },
    );
    a.onfinish = () => el.remove();
  }
  function reverseSweep() {
    if (!ui) return;
    ui.dirEl.classList.remove('flip');
    void ui.dirEl.offsetWidth;
    ui.dirEl.classList.add('flip');
    later(() => ui && ui.dirEl.classList.remove('flip'), 700);
  }
  function bubble(p, text) {
    if (!ui) return;
    const pos = p === 0 ? relPos(ui.unoBtn) : relPos(ui.seats[p].av);
    const el = h('div', { class: 'g-colors-bubble', style: { left: pos.x + 'px', top: pos.y + 'px' } }, text);
    ui.fx.append(el);
    if (reduce()) return later(() => el.remove(), 900);
    const a = el.animate(
      [
        { transform: 'translate(-50%,-90%) scale(.3) rotate(-8deg)', opacity: 0 },
        { transform: 'translate(-50%,-130%) scale(1.2) rotate(4deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-140%) scale(1) rotate(-2deg)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%,-150%) scale(1)', opacity: 0 },
      ],
      { duration: 1250, easing: 'ease-out' },
    );
    a.onfinish = () => el.remove();
  }

  // ---------- event playback ----------
  async function runEvents(evs) {
    if (!evs || !match || !ui) return;
    const s = match.s;
    for (const e of evs) {
      if (!match || !ui) return;
      // computers learn from public events only
      for (let p = 1; p < players(); p++) AI.observe(match.mems[p], R.publicEvent(e, p), R.publicView(s, p));
      switch (e.t) {
        case 'play':
          await animPlay(e);
          break;
        case 'draw':
          await animDraw(e);
          break;
        case 'skip':
          cs.special('skip');
          skipFlash(e.p);
          flashMsg(t('skipped', { name: nameOf(e.p) }));
          await sleep(300);
          break;
        case 'reverse':
          cs.special('reverse');
          reverseSweep();
          syncDir(s.dir);
          flashMsg(t('reversed'));
          await sleep(260);
          break;
        case 'color':
          flashMsg(t('pickedColor', { name: nameOf(e.p), color: colorName(e.color) }));
          syncColor(e.color);
          break;
        case 'uno':
          cs.yell(2);
          bubble(e.p, t('uno'));
          if (e.p !== 0) flashMsg(t('callsUno', { name: nameOf(e.p) }));
          await sleep(120);
          break;
        case 'caught': {
          cs.error();
          const msgText = e.p === 0 ? t('caughtYou', { by: nameOf(e.by), name: nameOf(e.p) }) : e.by === 0 ? t('youCaught', { name: nameOf(e.p) }) : t('caught', { by: nameOf(e.by), name: nameOf(e.p) });
          flashMsg(msgText, 2800);
          floatText('+2', e.p, 'bad');
          break;
        }
        case 'challenge': {
          let text;
          if (!e.yes) text = t('challengeDeclined', { name: nameOf(e.p) });
          else if (e.ok) text = e.target === 0 ? t('challengeWonAgainstYou') : t('challengeWonYou', { name: nameOf(e.target) });
          else text = e.p === 0 ? t('challengeLostYou') : t('challengeLost', { name: nameOf(e.p) });
          if (e.yes) cs.special('draw');
          flashMsg(text, 3000);
          await sleep(e.yes ? 650 : 300);
          break;
        }
        case 'pass':
          flashMsg(t('passed', { name: nameOf(e.p) }));
          break;
        case 'reshuffle':
          cs.shuffle();
          flashMsg(t('reshuffled'));
          if (!reduce()) anim.pulse(ui.draw, 1.1);
          await sleep(300);
          break;
        default:
      }
    }
    if (!ui || !match) return;
    syncAll();
  }

  async function animPlay(e) {
    const s = match.s;
    const id = e.card;
    const kind = R.kindOf(id);
    let from;
    if (e.p === 0) {
      const el = ui.hand.cardEl(String(id));
      from = el ? el.getBoundingClientRect() : rectOfEl(ui.handWrap);
      ui.hand.remove(String(id));
    } else {
      const opp = ui.opp[e.p];
      const el = opp.cardEl();
      from = el ? el.getBoundingClientRect() : rectOfEl(ui.seats[e.p].av);
      opp.setCount(Math.max(0, opp.count - 1));
    }
    // new top of the discard pile
    const cards = ui.discard._cards ? ui.discard._cards.slice(-2) : [];
    const lib = toLib(id);
    const next = [...cards, lib].slice(-3);
    ui.discard._cards = next;
    ui.discard.setCards(next);
    ui.discard._ids = next.map((c) => c.id).join();
    syncColorSoon(e.color);
    cs.place();
    if (e.p !== 0) cs.deal();
    const fly = anim.flyCard(ui.discard.topEl, from, null, { duration: 380, faceDownFrom: e.p !== 0, fromRotate: e.p === 0 ? 0 : 0 });
    await fly;
    syncColor(e.color);
    if (R.isWild(id)) {
      if (!reduce()) ui.ring.animate([{ transform: 'scale(.6)', opacity: 0.2 }, { transform: 'scale(1.18)', opacity: 1, offset: 0.5 }, { transform: 'scale(1)', opacity: 1 }], { duration: 480, easing: 'ease-out' });
      cs.special('reverse');
    }
    if (kind === R.K_D2 || kind === R.K_WD4) {
      floatText(kind === R.K_D2 ? '+2' : '+4', 'centre', 'punch');
      cs.special('draw');
    }
    if (e.p !== 0 && R.isWild(id)) flashMsg(t('pickedColor', { name: nameOf(e.p), color: colorName(e.color) }));
  }
  function syncColorSoon(c) {
    ui.ring.style.setProperty('--rc', UNO_HEX[COLOR_KEYS[c]] || '#555');
  }

  async function animDraw(e) {
    const s = match.s;
    const n = e.n;
    if (!n) return;
    const deckRect = ui.draw.getBoundingClientRect();
    if (e.p === 0) {
      const before = new Set(ui.hand.getCards().map((c) => c.id));
      const want = sortedIds(s.hands[0]).map(String);
      ui.hand.setCards(want.map((id) => toLib(+id)), { animate: false });
      const fresh = want.filter((id) => !before.has(id));
      const flights = fresh.slice(0, 8).map((id, i) => {
        const el = ui.hand.cardEl(id);
        if (!el) return Promise.resolve();
        cs.deal();
        return anim.flyCard(el, deckRect, null, { duration: 340, delay: i * 110, faceDownFrom: true });
      });
      refreshPlayable();
      await Promise.all(flights);
      if (n > 1) flashMsg(t('youDrewN', { n }));
    } else {
      const opp = ui.opp[e.p];
      const base = opp.count;
      opp.setCount(base + n);
      const flights = [];
      for (let i = 0; i < Math.min(n, 8); i++) {
        const el = opp.cardEl(base + i);
        if (!el) continue;
        cs.deal();
        flights.push(anim.flyCard(el, deckRect, null, { duration: 340, delay: i * 110 }));
      }
      await Promise.all(flights);
      flashMsg(n === 1 ? t('drew1', { name: nameOf(e.p) }) : t('drewN', { name: nameOf(e.p), n }));
      if (e.why !== 'turn') {
        floatText('+' + n, e.p, 'bad');
      }
    }
    ui.draw.setCount(s.draw.length);
  }

  async function runDealAnimation(first) {
    if (!ui || !match) return;
    const s = match.s;
    busy = true;
    syncChrome();
    const n = players();
    // empty everything, then deal in rounds of seven
    ui.hand.setCards([], { animate: false });
    for (let p = 1; p < n; p++) ui.opp[p].setCount(0);
    ui.discard.setCards([]);
    ui.discard._cards = [];
    ui.discard._ids = '';
    ui.ring.dataset.c = '';
    ui.clabel.textContent = '';
    ui.draw.setCount(R.DECK_SIZE);
    await sleep(120);
    cs.shuffle();
    if (!reduce()) await Promise.all([anim.shake(ui.draw, 3)]);
    const deckRect = ui.draw.getBoundingClientRect();
    const mine = sortedIds(s.hands[0].slice(0, R.HAND + (s.hands[0].length > R.HAND ? s.hands[0].length - R.HAND : 0)));
    ui.hand.setCards(mine.map((id) => toLib(id)), { animate: false });
    const flights = [];
    const perPlayerDelay = reduce() ? 0 : 38;
    let k = 0;
    for (let r = 0; r < R.HAND; r++) {
      for (let p = 0; p < n; p++) {
        const delay = k++ * perPlayerDelay;
        if (p === 0) {
          const id = String(mine[r]);
          const el = ui.hand.cardEl(id);
          if (el) {
            flights.push(
              anim.flyCard(el, deckRect, null, { duration: 300, delay, faceDownFrom: true, onStart: () => cs.deal() }),
            );
          }
        } else {
          const opp = ui.opp[p];
          opp.setCount(r + 1);
          const el = opp.cardEl(r);
          if (el) flights.push(anim.flyCard(el, deckRect, null, { duration: 300, delay }));
        }
      }
    }
    await Promise.all(flights);
    // extra cards (first card Draw Two): the engine already gave them
    syncSeats();
    // flip the first discard
    ui.draw.setCount(s.draw.length);
    const topId = s.discard[0];
    const lib = toLib(topId);
    ui.discard._cards = [lib];
    ui.discard.setCards([lib]);
    ui.discard._ids = lib.id;
    syncColorSoon(R.cardOf(topId).color === 4 ? 4 : R.cardOf(topId).color);
    cs.flip();
    await anim.flyCard(ui.discard.topEl, deckRect, null, { duration: 380, faceDownFrom: true });
    syncAll(false);
    // first-card effects
    const k0 = R.kindOf(topId);
    if (k0 === R.K_SKIP) {
      skipFlash(s.turn === 0 ? ((s.turn - s.dir + n) % n) : ((s.turn - s.dir + n) % n));
      cs.special('skip');
    } else if (k0 === R.K_REV) {
      reverseSweep();
      cs.special('reverse');
    } else if (k0 === R.K_D2) {
      cs.special('draw');
    }
    syncColor(s.color);
    syncDir(s.dir);
    ui.discard._ids = '';
    syncAll(true);
    busy = false;
    void first;
    flashMsg(t('roundN', { n: s.round }), 1600);
    syncChrome();
  }

  // =====================================================================================
  // GAME DRIVER
  // =====================================================================================
  const aiRand = () => Math.random();

  async function drive() {
    if (driving || !match) return;
    driving = true;
    const mine = match;
    try {
      while (match === mine && !disposed) {
        const s = mine.s;
        syncChrome();
        if (s.phase === 'roundEnd' || s.phase === 'matchEnd') {
          await roundEndFlow();
          break;
        }
        if (s.phase === 'startColor') {
          if (s.turn === 0) {
            flashMsg(t('startColor'), 3000);
            const c = await chooseColor(true);
            if (c === null || match !== mine) {
              pickingColor = false;
              syncChrome();
              // keep asking until a colour is chosen
              continue;
            }
            await perform(() => R.chooseStartColor(s, 0, c));
            continue;
          }
          await sleep(500);
          const d = AI.decide(R.publicView(s, s.turn), mine.meta.level, mine.mems[s.turn], aiRand);
          await perform(() => R.chooseStartColor(s, s.turn, d.color));
          continue;
        }
        if (s.phase === 'challenge') {
          if (s.chal.by === 0) {
            const yes = await humanChallenge();
            if (match !== mine) break;
            await perform(() => R.challenge(s, 0, yes));
            continue;
          }
          await sleep(900 * paceOf(s.chal.by));
          const d = AI.decide(R.publicView(s, s.chal.by), mine.meta.level, mine.mems[s.chal.by], aiRand);
          await perform(() => R.challenge(s, s.chal.by, d.yes));
          continue;
        }
        if (s.turn === 0) break; // waiting for the human
        await aiTurn(s.turn);
      }
    } finally {
      driving = false;
      if (match === mine && ui) syncChrome();
    }
    // the human may have acted while we were finishing
    if (match === mine && ui && !busy && match.s.turn !== 0 && match.s.phase !== 'roundEnd' && match.s.phase !== 'matchEnd' && !driving) drive();
  }

  const paceOf = (p) => (match.meta.level === 'easy' ? 1.1 : match.meta.level === 'hard' ? 0.95 : 1) * (PACE[(match.meta.who[p - 1] ?? 0) % PACE.length] || 1);

  async function aiTurn(p) {
    const s = match.s;
    const level = match.meta.level;
    await sleep((620 + aiRand() * 520) * paceOf(p));
    if (!match || match.s !== s || s.turn !== p) return;
    const view = R.publicView(s, p);
    const d = AI.decide(view, level, match.mems[p], aiRand);
    if (d.type === 'play') {
      // the call-out: before playing the second-to-last card
      if (s.hands[p].length === 2 && !s.said[p]) {
        const persona = (match.meta.who[p - 1] ?? 0) % 3;
        const chance = Math.min(0.99, AI.unoCallChance(level) + (persona === 1 ? 0.04 : persona === 2 ? -0.05 : 0));
        if (aiRand() < chance) await perform(() => R.callUno(s, p), true);
      }
      await perform(() => R.play(s, p, d.card, d.color));
    } else if (d.type === 'draw') await perform(() => R.draw(s, p));
    else if (d.type === 'pass') await perform(() => R.pass(s, p));
    else if (d.type === 'challenge') await perform(() => R.challenge(s, p, d.yes));
    else if (d.type === 'startColor') await perform(() => R.chooseStartColor(s, p, d.color));
  }

  // run one engine action: persist, animate, open the catch window when somebody forgot to call
  async function perform(fn, quick = false) {
    if (!match || !ui) return false;
    const mine = match;
    busy = true;
    syncChrome();
    const ev = fn();
    if (!ev) {
      busy = false;
      syncChrome();
      return false;
    }
    persist();
    await runEvents(ev);
    if (match !== mine) return true;
    if (!quick) await catchWindow();
    busy = false;
    if (match === mine && ui) syncChrome();
    return true;
  }

  async function catchWindow() {
    const s = match.s;
    if (s.vul === null || s.phase === 'roundEnd' || s.phase === 'matchEnd') return;
    const v = s.vul;
    if (s.turn === 0) return; // the human acts next: can still call / catch until playing
    const level = match.meta.level;
    const ms = v === 0 ? 1250 + aiRand() * 650 : 2000;
    catchOpen = true;
    syncChrome();
    ui.seats[v] && ui.seats[v].el.classList.add('is-vul');
    const t0 = performance.now();
    while (match && ui && performance.now() - t0 < ms && s.vul === v && !disposed) await sleep(60);
    catchOpen = false;
    if (!match || !ui || s.vul !== v) return;
    // an opponent may spot the missing call
    const chance = AI.catchChance(level) * (v === 0 ? 1 : 0.4);
    for (let q = 1; q < players(); q++) {
      if (q === v) continue;
      if (aiRand() < chance) {
        const ev = R.catchUno(s, q, v);
        if (ev) {
          persist();
          await runEvents(ev);
        }
        break;
      }
    }
  }

  // ---------- human input ----------
  function inputOk() {
    return match && ui && !busy && !pickingColor && !dialogClose;
  }

  async function humanPlay(id) {
    if (!inputOk()) return;
    const s = match.s;
    if (!R.isPlayable(s, 0, id)) {
      const el = ui.hand.cardEl(String(id));
      if (el) anim.shake(el, 4);
      cs.error();
      flashMsg(s.turn === 0 ? t('cantPlay') : t('notYourTurn'));
      return;
    }
    let color;
    if (R.isWild(id)) {
      if (R.isWd4(id) && s.opts.challenges && R.wd4IsBluff(s, 0)) {
        const ok = await ask({
          title: t('bluffTitle'),
          text: t('bluffText'),
          actions: [
            { label: t('cancel'), value: false },
            { label: t('playAnyway'), value: true, primary: true },
          ],
          dismissible: true,
        });
        if (!ok || !match) return;
      }
      color = await chooseColor(false);
      if (color === null || !match) return;
    }
    cs.select();
    const mine = match;
    await perform(() => R.play(s, 0, id, color));
    if (match === mine) drive();
  }

  async function humanDraw() {
    if (!inputOk()) return;
    const s = match.s;
    if (s.turn !== 0 || s.phase !== 'turn') {
      cs.error();
      flashMsg(t('notYourTurn'));
      return;
    }
    const mine = match;
    await perform(() => R.draw(s, 0));
    if (match === mine) drive();
  }

  async function humanPass() {
    if (!inputOk()) return;
    const s = match.s;
    if (s.phase !== 'drawn' || s.turn !== 0) return;
    const mine = match;
    await perform(() => R.pass(s, 0));
    if (match === mine) drive();
  }

  async function humanUno() {
    if (!match || !ui || dialogClose) return;
    const s = match.s;
    const ev = R.callUno(s, 0);
    if (!ev) {
      cs.error();
      if (!ui.unoBtn.classList.contains('is-ready')) flashMsg(t('unoHelp'));
      return;
    }
    persist();
    if (!reduce()) anim.pulse(ui.unoBtn, 1.2);
    cs.yell(3);
    bubble(0, t('uno'));
    syncChrome();
  }

  async function humanCatch(p) {
    if (!match || !ui || dialogClose) return;
    const s = match.s;
    if (s.vul !== p) return;
    const ev = R.catchUno(s, 0, p);
    if (!ev) return;
    bumpExtra('catches');
    persist();
    cs.yell(2);
    // the animation may overlap the catch window: that is fine, state is already consistent
    const was = busy;
    busy = true;
    await runEvents(ev);
    busy = was;
    syncChrome();
    if (!busy) drive();
  }

  function chooseColor(isStart) {
    pickingColor = true;
    syncChrome();
    const s = match.s;
    const mineColors = [0, 0, 0, 0];
    for (const id of s.hands[0]) if (R.colorOf(id) < 4) mineColors[R.colorOf(id)]++;
    let keyOff = null;
    return ask({
      title: t('chooseColor'),
      dismissible: !isStart,
      cls: 'is-colors',
      node: (close) => {
        const grid = h('div', { class: 'g-colors-pick' });
        for (let c = 0; c < 4; c++) {
          grid.append(
            h(
              'button',
              { type: 'button', class: 'g-colors-pickbtn', 'aria-label': colorName(c), onclick: () => close(c) },
              h('i', null),
              h('span', null, colorName(c)),
              mineColors[c] ? h('small', null, String(mineColors[c])) : null,
            ),
          );
        }
        grid.querySelectorAll('.g-colors-pickbtn').forEach((b, i) => b.style.setProperty('--pc', UNO_HEX[COLOR_KEYS[i]]));
        const kh = (e) => {
          const k = '1234'.indexOf(e.key);
          if (k >= 0 && e.key) {
            e.stopPropagation();
            close(k);
          }
        };
        document.addEventListener('keydown', kh, true);
        keyOff = () => document.removeEventListener('keydown', kh, true);
        return grid;
      },
    }).then((v) => {
      if (keyOff) keyOff();
      pickingColor = false;
      if (match) syncChrome();
      return v;
    });
  }

  function humanChallenge() {
    const s = match.s;
    const target = s.chal.target;
    return ask({
      title: t('challengeTitle'),
      node: h('div', null, h('p', null, t('challengeText', { name: nameOf(target), color: colorName(s.color) })), h('p', { class: 'g-colors-prevc' }, h('i', { style: { background: UNO_HEX[COLOR_KEYS[s.chal.prevColor]] } }), t('challengePrev', { color: colorName(s.chal.prevColor) }))),
      actions: [
        { label: t('challengeNo'), value: false },
        { label: t('challengeYes'), value: true, primary: true },
      ],
      dismissible: false,
    }).then((v) => !!v);
  }

  // =====================================================================================
  // ROUND / MATCH END
  // =====================================================================================
  async function roundEndFlow() {
    const s = match.s;
    const mine = match;
    const last = s.last;
    busy = true;
    syncChrome();
    const won = last.winner === 0;
    if (s.phase === 'roundEnd' || s.phase === 'matchEnd') {
      if (!match.recorded || match.recorded !== s.round) {
        match.recorded = s.round;
        if (won) {
          bumpExtra('rounds');
          match.meta.won = (match.meta.won || 0) + 1;
        }
      }
    }
    persist();
    cs[won ? 'win' : 'lose']();
    flashMsg(won ? t('youWonRound') : t('roundWon', { name: nameOf(last.winner) }), 2600);
    await sleep(900);
    if (match !== mine) return;

    const rows = h('div', { class: 'g-colors-sb' });
    const maxScore = s.opts.target;
    const order = [...Array(players()).keys()].sort((a, b) => s.scores[b] - s.scores[a]);
    const prevScores = s.scores.map((v, i) => (i === last.winner ? v - last.points : v));
    for (const p of order) {
      const left = p === last.winner ? 0 : R.handPoints(last.hands[p]);
      const bar = h('i', { style: { width: Math.min(100, (prevScores[p] / maxScore) * 100) + '%' } });
      const val = h('b', { class: 'g-colors-sb-val' }, String(prevScores[p]));
      const row = h(
        'div',
        { class: `g-colors-sb-row${p === last.winner ? ' is-win' : ''}${p === 0 ? ' is-me' : ''}` },
        h('span', { class: 'g-colors-sb-av' }, p === 0 ? avatarEl(0, 34) : avatarEl(AVATARS[match.meta.who[p - 1] % AVATARS.length], 34)),
        h('span', { class: 'g-colors-sb-main' }, h('span', { class: 'g-colors-sb-name' }, nameOf(p), p === last.winner ? h('em', null, t('gained', { n: last.points })) : last.hands[p].length ? h('small', null, `${t('cardsN', { n: last.hands[p].length })} · ${left}`) : null), h('span', { class: 'g-colors-sb-bar' }, bar)),
        val,
      );
      rows.append(row);
      later(() => {
        bar.style.width = Math.min(100, (s.scores[p] / maxScore) * 100) + '%';
        if (p === last.winner) {
          const from = prevScores[p];
          const to = s.scores[p];
          const t0 = performance.now();
          const step = (now) => {
            if (disposed || !val.isConnected) return;
            const k = Math.min(1, (now - t0) / 700);
            val.textContent = String(Math.round(from + (to - from) * k));
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      }, 500);
    }

    if (s.phase === 'matchEnd') {
      await sleep(300);
      return matchEnd(rows);
    }
    const title = won ? t('youWonRound') : t('roundWon', { name: nameOf(last.winner) });
    const v = await ask({
      title,
      cls: 'is-sb',
      node: h('div', null, h('p', { class: 'g-colors-sb-sub' }, `${t('roundN', { n: s.round })} · ${t('toTarget', { n: s.opts.target })}`), rows),
      actions: [{ label: t('nextRound'), value: 'next', primary: true }],
      dismissible: false,
    });
    if (match !== mine || v !== 'next') return;
    const ev = R.startRound(s);
    void ev;
    freshMemories();
    persist();
    await runDealAnimation(false);
    busy = false;
    if (match === mine) drive();
  }

  async function matchEnd(rows) {
    const s = match.s;
    const mine = match;
    const winner = s.matchWinner;
    const iWon = winner === 0;
    const meta = match.meta;
    // XP and records: exactly once per finished match
    const place = [...Array(players()).keys()].sort((a, b) => s.scores[b] - s.scores[a]).indexOf(0);
    const xp = (iWon ? 30 : place === 1 ? 14 : 8) + Math.min(20, (meta.won || 0) * 3) + (s.opts.target >= 500 ? 10 : s.opts.target >= 200 ? 4 : 0);
    statsBox.record({ result: iWon ? 'win' : 'loss', score: s.scores[0], mode: meta.mode, level: meta.level, rounds: s.round });
    saveBox.clear();
    ctx.addXP?.(xp);
    cs[iWon ? 'win' : 'lose']();
    if (iWon) ctx.ui.confetti?.();
    const act = await resultModal({
      root,
      outcome: iWon ? 'win' : 'lose',
      title: iWon ? t('youWonMatch') : t('youLostMatch', { name: nameOf(winner) }),
      subtitle: `${t('finalScore')} · ${t('roundN', { n: s.round })}`,
      stats: [
        { label: t('you'), value: s.scores[0] },
        ...[...Array(players()).keys()].filter((p) => p !== 0).map((p) => ({ label: nameOf(p), value: s.scores[p] })),
        { label: 'XP', value: xp, fmt: (v) => t('xpEarned', { n: Math.round(v) }) },
      ],
      actions: [
        { label: t('menu'), value: 'menu' },
        { label: t('playAgain'), value: 'again', primary: true },
      ],
      confetti: false,
      lang: ctx.lang,
    });
    if (match !== mine) return;
    void rows;
    if (act === 'again') startNew(meta.mode);
    else showMenu();
  }

  // =====================================================================================
  showMenu();
  if (ctx.mode === 'solo' || ctx.mode === 'duel') startNew(ctx.mode, false);

  return () => {
    disposed = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    cleanups.forEach((fn) => fn());
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    if (roSeen) roSeen.disconnect();
    anim.dispose();
    ctx.setHeaderRight(null);
    ctx.setTitle();
    root.querySelectorAll('.dt-overlay, .dt-confetti').forEach((n) => n.remove());
  };
}
