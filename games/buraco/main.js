// Buraco Aberto — Brazilian canasta-style rummy for 4 players (2 teams) or a 1v1 duel.
//   Menu → match (rounds to 1500/3000) → round summary → result. Matches autosave and resume
//   exactly (the engine is pure and the computer players are deterministic).
//   Rules: rules.js (pure + tested) · computer players: ai.js · shared card UI: ../_cards/.
//   Modes (ctx.mode): team (4 players), duel (2 players).

import STRINGS from './strings.js';
import * as R from './rules.js';
import { chooseAction } from './ai.js';
import { createHand } from '../_cards/hand.js';
import { cardEl, setCardState } from '../_cards/card.js';
import { setCardLang } from '../_cards/decks.js';
import * as T from '../_cards/table.js';
import { createCardSfx } from '../_cards/sfx.js';
import { createMatchSave, createStats } from '../_cards/storage.js';

const SAVE_VERSION = 1;
const SUIT_KEY = ['s', 'h', 'd', 'c'];
const RANK_KEY = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const SUIT_SYM = ['♠', '♥', '♦', '♣'];
const SUIT_SORT = [0, 1, 3, 2]; // alternating colours
const toCard = (id) =>
  R.isJoker(id) ? { r: 'X', s: id < 54 ? 'r' : 'b', id: String(id) } : { r: RANK_KEY[R.cardRank(id) - 1], s: SUIT_KEY[R.cardSuit(id)], id: String(id) };
const rankLabel = (r) => (r === 1 || r === 14 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r));
const cardText = (id) => (R.isJoker(id) ? '🃏' : rankLabel(R.cardRank(id)) + SUIT_SYM[R.cardSuit(id)]);

const svg = (inner) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">${inner}</svg>`;
const ICON = {
  help: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  mute: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  stats: svg('<path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  rules: svg('<path d="M6 4h9l3 3v13H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 11h6M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  resume: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  team: svg('<circle cx="8.5" cy="9" r="3" fill="currentColor"/><circle cx="16" cy="10" r="2.5" fill="currentColor" opacity=".7"/><path d="M2.8 19c.4-3 2.7-4.7 5.7-4.7s5.3 1.7 5.7 4.7M14.6 15c2.9-.5 5.8.8 6.4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  duel: svg('<circle cx="12" cy="8" r="3.6" fill="currentColor"/><path d="M5 20c.6-3.6 3.6-5.6 7-5.6s6.4 2 7 5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
};

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('../_cards/cards.css', import.meta.url));
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  setCardLang(ctx.lang);
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const store = ctx.store;
  const sfx = createCardSfx(ctx);
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMq.matches;
  const matchSave = createMatchSave(store, 'match', {
    version: SAVE_VERSION,
    validate: (s) => s && s.state && Array.isArray(s.scores) && s.state.hands,
  });
  const stats = createStats(store, 'stats', { historyMax: 24 });

  // ---------- settings ----------
  const DEFAULTS = { target: 3000, level: 'normal', cleanOut: false, fast: false, sound: true };
  const settings = { ...DEFAULTS, ...(store.get('settings', {}) || {}) };
  sfx.enabled = settings.sound !== false;
  // no vibration before the first user gesture (browsers block it and log errors)
  const activated = () => !!(navigator.userActivation ? navigator.userActivation.hasBeenActive : true);
  sfx.haptics = activated();
  const onFirstTap = () => (sfx.haptics = true);
  window.addEventListener('pointerdown', onFirstTap, { once: true });
  const saveSettings = () => store.set('settings', settings);

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
  const sleep = (ms) => new Promise((res) => later(res, reduce() ? Math.min(ms, 60) : settings.fast ? ms * 0.45 : ms));
  let scope = []; // cleanups for the current screen
  const onScope = (fn) => scope.push(fn);
  const endScope = () => {
    scope.forEach((f) => {
      try {
        f();
      } catch (e) {
        /* ignore */
      }
    });
    scope = [];
  };
  const listen = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    onScope(() => target.removeEventListener(ev, fn, opts));
  };
  let view = 'menu'; // menu | match
  let runToken = 0;

  // ---------- helpers ----------
  const lang = ctx.lang;
  const you = t('you');
  const names4 = [you, t('nameL'), t('nameP'), t('nameR')];
  const seatName = (n, seat) => (n === 2 ? (seat === 0 ? you : t('nameD')) : names4[seat]);
  const teamName = (n, team) => (n === 2 ? (team === 0 ? you : t('nameD')) : team === 0 ? t('us') : t('them'));
  function setHeader(extra) {
    const wrap = h('div', { class: 'g-buraco-hdr' });
    if (extra) wrap.append(extra);
    const snd = h('button', { class: 'icon-btn g-buraco-hbtn', 'aria-label': t('sound'), 'aria-pressed': String(sfx.enabled), html: sfx.enabled ? ICON.sound : ICON.mute });
    snd.onclick = () => {
      sfx.enabled = !sfx.enabled;
      settings.sound = sfx.enabled;
      saveSettings();
      snd.innerHTML = sfx.enabled ? ICON.sound : ICON.mute;
      snd.setAttribute('aria-pressed', String(sfx.enabled));
      if (sfx.enabled) sfx.select();
    };
    const hp = h('button', { class: 'icon-btn g-buraco-hbtn', 'aria-label': t('rules'), html: ICON.help, onclick: () => showRules() });
    wrap.append(snd, hp);
    ctx.setHeaderRight(wrap);
  }

  // ======================================================================
  // MENU
  // ======================================================================
  function showMenu() {
    runToken++;
    endScope();
    view = 'menu';
    ctx.setTitle();
    setHeader();
    ctx.onBack(() => false);
    clear(root);
    const saved = matchSave.load();
    const st = stats.get();
    const screen = h('div', { class: 'screen g-buraco-menu' });
    const hero = h(
      'div',
      { class: 'g-buraco-hero' },
      h('div', { class: 'g-buraco-hero-cards', 'aria-hidden': 'true' }, [
        { r: '7', s: 'h' },
        { r: '8', s: 'h' },
        { r: '9', s: 'h' },
        { r: 'X', s: 'r' },
        { r: 'J', s: 'h' },
      ].map((c, i) => {
        const el = cardEl({ ...c, id: 'hero' + i }, { size: 62 });
        el.style.setProperty('--i', i);
        return el;
      })),
      h('div', { class: 'g-buraco-hero-t' }, t('menuTag')),
    );
    const list = h('div', { class: 'list' });
    if (saved) {
      const sc = saved.scores;
      list.append(
        h('button', { class: 'list-item g-buraco-resume', onclick: () => startMatch(null, saved) },
          h('span', { class: 'li-icon', html: ICON.resume }),
          h('span', { class: 'li-body' }, h('div', { class: 'li-title' }, t('resume')), h('div', { class: 'li-sub' }, t('resumeSub', { n: saved.round, a: sc[0], b: sc[1], target: saved.target }))),
        ),
      );
    }
    const item = (icon, title, sub, fn) =>
      h('button', { class: 'list-item', onclick: fn }, h('span', { class: 'li-icon', html: icon }), h('span', { class: 'li-body' }, h('div', { class: 'li-title' }, title), h('div', { class: 'li-sub' }, sub)));
    list.append(item(ICON.team, t('modeTeam'), t('modeTeamSub'), () => newMatch(4)), item(ICON.duel, t('modeDuel'), t('modeDuelSub'), () => newMatch(2)));
    const opts = h('div', { class: 'card g-buraco-opts' });
    const chipRow = (label, key, values, fmt) => {
      const row = h('div', { class: 'g-buraco-opt' }, h('div', { class: 'g-buraco-opt-l' }, label));
      const chips = h('div', { class: 'chips' });
      for (const v of values) {
        const b = h('button', { class: 'chip' + (settings[key] === v ? ' active' : ''), 'aria-pressed': String(settings[key] === v) }, fmt(v));
        b.onclick = () => {
          settings[key] = v;
          saveSettings();
          [...chips.children].forEach((c, i) => {
            const on = values[i] === v;
            c.classList.toggle('active', on);
            c.setAttribute('aria-pressed', String(on));
          });
          sfx.select();
        };
        chips.append(b);
      }
      row.append(chips);
      return row;
    };
    opts.append(
      h('div', { class: 'section-title' }, t('options')),
      chipRow(t('optTarget'), 'target', [1500, 3000], (v) => String(v)),
      chipRow(t('optLevel'), 'level', ['easy', 'normal', 'hard'], (v) => t('lvl_' + v)),
      chipRow(t('optOut'), 'cleanOut', [false, true], (v) => (v ? t('outClean') : t('outAny'))),
      chipRow(t('optAnim'), 'fast', [false, true], (v) => (v ? t('animFast') : t('animNormal'))),
    );
    const foot = h(
      'div',
      { class: 'row g-buraco-foot' },
      h('button', { class: 'btn ghost', onclick: () => showStats() }, h('span', { html: ICON.stats }), ' ', t('stats')),
      h('button', { class: 'btn ghost', onclick: () => showRules() }, h('span', { html: ICON.rules }), ' ', t('rules')),
    );
    screen.append(hero, list, opts, foot, h('p', { class: 'muted small g-buraco-note' }, st.games ? t('menuRecord', { w: st.wins, g: st.games }) : t('noMoney')));
    root.append(screen);
  }

  async function newMatch(n) {
    const saved = matchSave.load();
    if (saved) {
      const ok = await T.modal({
        root,
        title: t('replaceTitle'),
        body: t('replaceBody'),
        actions: [
          { label: t('cancel'), value: false },
          { label: t('startNew'), value: true, danger: true },
        ],
      });
      if (!ok) return;
    }
    startMatch(n, null);
  }

  // ======================================================================
  // MATCH
  // ======================================================================
  let match = null; // { n, target, level, cleanOut, round, scores, rounds, dealer, state, summary }
  let G = null; // ui refs

  function startMatch(n, resumed) {
    if (resumed) match = resumed;
    else {
      const dealer = 0;
      match = {
        v: SAVE_VERSION,
        n,
        target: settings.target,
        level: settings.level,
        cleanOut: !!settings.cleanOut,
        round: 1,
        scores: [0, 0],
        rounds: [],
        dealer,
        canastras: [0, 0],
        state: null,
        summary: null,
      };
      match.state = R.newRound({ n, dealer, cleanOut: match.cleanOut });
      persist();
    }
    buildGame();
  }

  function persist() {
    if (!match) return;
    try {
      matchSave.save(match);
    } catch (e) {
      /* storage may be unavailable */
    }
  }

  // ---------- layout / build ----------
  function buildGame() {
    runToken++;
    endScope();
    view = 'match';
    clear(root);
    ctx.setTitle();
    const n = match.n;
    const st = () => match.state;

    // header: help + sound (+ history)
    setHeader();
    ctx.onBack(() => {
      confirmLeave();
      return true;
    });

    const W = root.clientWidth || 360;
    const Hh = root.clientHeight || 700;
    const handCw = Math.max(46, Math.min(72, Math.floor(W / 6.5))) - (Hh < 700 ? 3 : 0);
    const meldCw = Math.max(32, Math.min(44, Math.floor(W / 10)));
    const oppCw = Math.max(26, Math.min(34, Math.floor(W / 13)));

    const screen = h('div', { class: 'g-buraco-table' });
    // HUD
    const scoreUs = h('b', { class: 'g-buraco-sc-v' }, '0');
    const scoreThem = h('b', { class: 'g-buraco-sc-v' }, '0');
    const hud = h(
      'button',
      { class: 'g-buraco-hud', 'aria-label': t('scoreHistory') },
      h('span', { class: 'g-buraco-sc is-us' }, h('i', null, teamName(n, 0)), scoreUs),
      h('span', { class: 'g-buraco-mid' }, h('i', { class: 'g-buraco-round' }), h('i', { class: 'g-buraco-target' })),
      h('span', { class: 'g-buraco-sc is-them' }, h('i', null, teamName(n, 1)), scoreThem),
    );
    hud.onclick = () => showHistory();
    // opponents strip
    const oppSeats = n === 4 ? [1, 2, 3] : [1];
    const chips = {};
    const strip = h('div', { class: 'g-buraco-opps' });
    for (const s of oppSeats) {
      const chip = T.playerChip({ name: seatName(n, s), avatar: T.avatarIdForName(seatName(n, s)), size: 'sm', layout: 'col', color: R.teamOf(n, s) === 0 ? '#7fd1b0' : '#e08a9a' });
      const cnt = h('span', { class: 'g-buraco-cnt' }, '11');
      const wrap = h('div', { class: 'g-buraco-opp', 'data-seat': s }, chip, cnt);
      chips[s] = { chip, cnt, wrap };
      strip.append(wrap);
    }
    // meld areas
    const mkArea = (team) => {
      const title = h('span', { class: 'g-buraco-area-t' }, teamName(n, team));
      const info = h('span', { class: 'g-buraco-area-i' });
      const morto = h('span', { class: 'g-buraco-morto', title: t('morto') });
      const head = h('div', { class: 'g-buraco-area-h' }, title, info, morto);
      const melds = h('div', { class: 'g-buraco-melds' });
      const area = h('section', { class: 'g-buraco-area ' + (team === 0 ? 'is-us' : 'is-them'), 'aria-label': teamName(n, team) }, head, melds);
      return { area, info, morto, melds };
    };
    const areaThem = mkArea(1);
    const areaUs = mkArea(0);
    // centre
    const stockPile = T.deckPile({ count: 41, size: 46, back: 'emerald', label: t('stock') });
    stockPile.classList.add('g-buraco-stock');
    stockPile.tabIndex = 0;
    stockPile.setAttribute('role', 'button');
    const pileCard = T.discardPile({ size: 46 });
    const pileWrap = h('div', { class: 'g-buraco-pilewrap' }, pileCard, h('div', { class: 'dt-pile-label g-buraco-pl' }, t('pile')), h('span', { class: 'g-buraco-pilecnt' }, '0'));
    pileWrap.tabIndex = 0;
    pileWrap.setAttribute('role', 'button');
    const peek = h('button', { class: 'g-buraco-peek', 'aria-label': t('viewPile'), html: ICON.eye, onclick: (e) => (e.stopPropagation(), showPile()) });
    pileWrap.append(peek);
    const turnInd = T.turnIndicator('', {});
    const hint = h('div', { class: 'g-buraco-hint', role: 'status', 'aria-live': 'polite' });
    const lastLine = h('button', { class: 'g-buraco-last', onclick: () => showLog(), 'aria-label': t('log') });
    const info = h('div', { class: 'g-buraco-info' }, turnInd, hint, lastLine);
    const centre = h('div', { class: 'g-buraco-centre' }, stockPile, pileWrap, info);
    // actions
    const bar = T.actionBar([], { onDisabled: (reason) => { sfx.error(); ctx.ui.toast(reason, 2400); } });
    bar.classList.add('g-buraco-bar');
    // hand
    const handBox = h('div', { class: 'g-buraco-hand' });
    screen.append(hud, strip, areaThem.area, centre, areaUs.area, bar, handBox);
    root.append(screen);

    const sortModeKey = 'suit';
    G = {
      n, screen, hud, scoreUs, scoreThem, chips, areaThem, areaUs, stockPile, pileCard, pileWrap, turnInd, hint, lastLine, bar, handBox, handCw, meldCw, oppCw,
      hand: null, handOrder: [], sortMode: sortModeKey, taking: false, busy: false, log: [], lastShown: '', sel: [], roundEl: hud.querySelector('.g-buraco-round'), targetEl: hud.querySelector('.g-buraco-target'),
    };
    G.hand = createHand(handBox, {
      cards: [],
      mode: 'fan',
      arc: true,
      size: handCw,
      select: 'multi',
      maxRows: 2,
      minStep: 0.3,
      draggable: true,
      dragToPlay: true,
      lang,
      onChange: (cards) => {
        G.sel = cards.map((c) => Number(c.id));
        sfx.select();
        refreshControls();
      },
      onActivate: (card) => {
        // double click / Enter / drag up = discard that card
        if (!myTurn() || st().phase !== 'play') return;
        humanDiscard(Number(card.id));
      },
    });
    onScope(() => G.hand && G.hand.destroy());
    const stockGo = () => humanDraw();
    stockPile.addEventListener('click', stockGo);
    stockPile.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), stockGo()));
    const pileGo = () => humanTapPile();
    pileWrap.addEventListener('click', pileGo);
    pileWrap.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pileGo()));
    // desktop shortcuts
    listen(window, 'keydown', (e) => {
      if (view !== 'match' || e.target.closest?.('.dt-overlay') || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'b') humanMeld();
      else if (k === 'o') sortHand();
      else if (k === 'delete' || k === 'x') humanDiscardSelected();
    });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => G && G.hand && G.hand.layout()) : null;
    if (ro) {
      ro.observe(handBox);
      onScope(() => ro.disconnect());
    }

    // initial render
    const s0 = st();
    G.handOrder = sortIds(s0.hands[0].slice(), G.sortMode);
    G.hand.setCards(G.handOrder.map(toCard), { animate: false });
    render(true);
    if (s0.phase === 'end') {
      later(() => roundOver(true), 300);
      return;
    }
    if (match.rounds.length === 0 && s0.turnNo === 0 && s0.turn === (s0.dealer + 1) % n) sfx.shuffle();
    nextStep();
  }

  const myTurn = () => match && match.state.phase !== 'end' && match.state.turn === 0 && !G.busy;

  // ---------- hand ordering ----------
  function sortIds(ids, mode) {
    const key = (id) => {
      if (R.isJoker(id)) return [9, 99, id];
      const s = SUIT_SORT.indexOf(R.cardSuit(id));
      const r = R.cardRank(id);
      return mode === 'rank' ? [r, s, id] : [s, r, id];
    };
    return ids.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
  }
  function sortHand() {
    if (!G || view !== 'match') return;
    G.sortMode = G.sortMode === 'suit' ? 'rank' : 'suit';
    G.handOrder = sortIds(G.hand.getCards().map((c) => Number(c.id)), G.sortMode);
    G.hand.setCards(G.handOrder.map(toCard));
    sfx.slide();
    ctx.ui.toast(G.sortMode === 'suit' ? t('sortedSuit') : t('sortedRank'), 1100);
    refreshControls();
  }
  function syncHand(highlightNew = true) {
    const ids = match.state.hands[0];
    const have = new Set(ids);
    const kept = G.handOrder.filter((id) => have.has(id));
    const keptSet = new Set(kept);
    const fresh = ids.filter((id) => !keptSet.has(id));
    let order = kept.concat(fresh);
    if (fresh.length >= 3) order = sortIds(order.slice(), G.sortMode);
    const changed = order.length !== G.handOrder.length || order.some((x, i) => x !== G.handOrder[i]);
    G.handOrder = order;
    if (changed) {
      // preserve selection of still-present cards
      const sel = new Set(G.sel.filter((id) => have.has(id)));
      G.hand.setCards(order.map(toCard), { animate: true });
      sel.forEach((id) => G.hand.select(String(id)));
      G.sel = [...sel];
    }
    if (highlightNew && fresh.length) {
      fresh.forEach((id) => {
        const el = G.hand.cardEl(String(id));
        if (el) setCardState(el, { highlight: true });
      });
      later(() => fresh.forEach((id) => {
        const el = G.hand.cardEl(String(id));
        if (el) setCardState(el, { highlight: false });
      }), 1700);
    }
  }

  // ---------- rendering ----------
  function meldEl(m, team, cw, opts = {}) {
    const kind = R.canastraKind(m);
    const step = Math.round(cw * 0.5);
    const el = h('button', {
      class: `g-buraco-meld ${kind ? 'is-can is-' + kind : ''}${opts.mine ? ' is-mine' : ''}`,
      'data-meld': m.id,
      'data-team': team,
      style: { width: `${cw + step * (m.cards.length - 1) + 4}px` },
      'aria-label': meldLabel(m, kind),
    });
    el.style.setProperty('--cw', cw + 'px');
    m.cards.forEach((c, i) => {
      const ce = cardEl(toCard(c.id), { size: cw, lang });
      ce.removeAttribute('role');
      ce.style.position = 'absolute';
      ce.style.left = 2 + i * step + 'px';
      ce.style.top = '3px';
      ce.style.zIndex = String(i + 1);
      if (c.w) {
        ce.classList.add('g-buraco-wildcard');
        ce.append(h('span', { class: 'g-buraco-wtag' }, rankLabel(c.r)));
      }
      el.append(ce);
    });
    if (kind) el.append(h('span', { class: 'g-buraco-tag' }, kind === 'real' ? '★' : kind === 'clean' ? '200' : '100'));
    return el;
  }
  function meldLabel(m, kind) {
    const txt = m.cards.map((c) => (c.w ? `(${cardText(c.id)} = ${rankLabel(c.r)})` : cardText(c.id))).join(' ');
    return `${SUIT_SYM[m.suit]} ${txt}${kind ? ' · ' + t('can_' + kind) : ''}`;
  }

  let renderedMelds = { 0: '\u0000', 1: '\u0000' };
  function renderMelds(team, area, cw, mine, freshIds) {
    const s = match.state;
    const sig = s.melds[team].map((m) => m.id + ':' + m.cards.map((c) => c.id + (c.w ? 'w' : '')).join('.')).join('|');
    const wasSig = renderedMelds[team];
    if (sig !== wasSig) {
      const prevScroll = area.melds.scrollTop;
      clear(area.melds);
      for (const m of s.melds[team]) {
        const el = meldEl(m, team, cw, { mine });
        if (freshIds && freshIds.has(m.id)) el.classList.add('is-new');
        if (mine) el.addEventListener('click', () => humanAdd(m.id));
        else el.disabled = true;
        area.melds.append(el);
      }
      area.melds.scrollTop = prevScroll;
      if (freshIds && freshIds.size) {
        const last = area.melds.querySelector('.is-new');
        if (last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
      }
      renderedMelds[team] = sig;
    }
    const cans = s.melds[team].filter((m) => R.canastraKind(m)).length;
    area.info.textContent = `${t('nMelds', { n: s.melds[team].length })}${cans ? ' · ' + t('nCanastras', { n: cans }) : ''}`;
    const taken = s.mortoTaken[team];
    area.morto.className = 'g-buraco-morto ' + (taken ? 'is-taken' : 'is-avail');
    area.morto.textContent = taken ? t('mortoTaken') : t('mortoLeft');
  }

  function render(first = false, freshMelds = null) {
    const s = match.state;
    const n = match.n;
    renderedMelds = first ? { 0: '\u0000', 1: '\u0000' } : renderedMelds;
    G.scoreUs.textContent = String(match.scores[0]);
    G.scoreThem.textContent = String(match.scores[1]);
    G.roundEl.textContent = t('roundN', { n: match.round });
    G.targetEl.textContent = t('targetN', { n: match.target });
    for (const seat of Object.keys(G.chips).map(Number)) {
      const c = G.chips[seat];
      const cnt = s.hands[seat].length;
      c.chip.update({ active: s.turn === seat && s.phase !== 'end', sub: R.teamOf(n, seat) === 1 && !s.mortoTaken[1] && false ? '' : undefined });
      c.cnt.textContent = t('nCards', { n: cnt });
      c.wrap.classList.toggle('is-active', s.turn === seat && s.phase !== 'end');
    }
    renderMelds(1, G.areaThem, G.oppCw, false, freshMelds);
    renderMelds(0, G.areaUs, G.meldCw, true, freshMelds);
    G.stockPile.setCount(s.stock.length);
    G.stockPile.setAttribute('aria-label', `${t('stock')}: ${s.stock.length}`);
    const pile = s.pile.map(toCard);
    G.pileCard.setCards(pile.slice(-3).length ? pile : [], { straight: false });
    G.pileWrap.querySelector('.g-buraco-pilecnt').textContent = String(s.pile.length);
    G.pileWrap.setAttribute('aria-label', `${t('pile')}: ${s.pile.length}${s.pile.length ? ', ' + t('top') + ' ' + cardText(s.pile[s.pile.length - 1]) : ''}`);
    syncHand();
    refreshControls();
  }

  function setHint(text) {
    G.hint.textContent = text;
  }
  function pushLog(text, tone) {
    G.log.push(text);
    if (G.log.length > 60) G.log.shift();
    G.lastLine.textContent = text;
    G.lastLine.dataset.tone = tone || '';
  }

  // Controls depend on phase + selection.
  function refreshControls() {
    if (!G || view !== 'match') return;
    const s = match.state;
    const mine = s.turn === 0 && s.phase !== 'end' && !G.busy;
    const sel = G.sel.filter((id) => s.hands[0].includes(id));
    // meld targets glow
    const menu = [];
    G.areaUs.melds.querySelectorAll('.g-buraco-meld').forEach((el) => {
      let ok = false;
      if (mine && (sel.length || G.taking)) {
        const m = s.melds[0].find((x) => x.id === Number(el.dataset.meld));
        const ids = G.taking ? [s.pile[s.pile.length - 1], ...sel] : sel;
        ok = !!m && R.extensions(m, ids).length > 0;
      }
      el.classList.toggle('is-ok', ok);
    });
    // turn indicator and hint
    if (s.phase === 'end') {
      G.turnInd.set(t('roundEnded'), {});
      setHint('');
    } else if (s.turn === 0) {
      G.turnInd.set(t('yourTurn'), { mine: true });
      if (G.busy) setHint('');
      else if (G.taking) setHint(t('hintTaking'));
      else if (s.phase === 'draw') setHint(s.stock.length ? t('hintDraw') : t('hintDrawEmpty'));
      else setHint(sel.length ? t('hintSel', { n: sel.length }) : t('hintPlay'));
    } else {
      G.turnInd.set(t('turnOf', { name: seatName(match.n, s.turn) }), {});
      setHint('');
    }
    G.stockPile.classList.toggle('is-ready', mine && s.phase === 'draw' && !!s.stock.length && !G.taking);
    G.pileWrap.classList.toggle('is-ready', mine && s.phase === 'draw' && s.pile.length > 0 && !G.taking);
    G.pileWrap.classList.toggle('is-taking', G.taking);
    // buttons
    const acts = [];
    if (!mine) {
      acts.push({ id: 'wait', label: s.phase === 'end' ? t('roundEnded') : t('waiting'), kind: 'secondary', disabled: true });
      acts.push({ id: 'sort', label: t('sort'), kind: 'secondary', onClick: sortHand });
    } else if (G.taking) {
      acts.push({ id: 'cancel', label: t('cancel'), kind: 'secondary', onClick: cancelTaking });
      acts.push({ id: 'takego', label: t('takeAndMeld'), kind: 'primary', onClick: confirmTaking });
    } else if (s.phase === 'draw') {
      const canTake = s.pile.length > 0 && R.canTakePile(s, 0);
      acts.push({ id: 'draw', label: s.stock.length ? t('draw') : t('end'), kind: 'primary', onClick: s.stock.length ? humanDraw : humanStop });
      acts.push({ id: 'take', label: t('takePile'), kind: 'secondary', disabled: !canTake, reason: s.pile.length ? t('err_cantTake') : t('pileEmpty'), onClick: humanTapPile });
      acts.push({ id: 'sort', label: t('sort'), kind: 'secondary', onClick: sortHand });
    } else {
      const why = sel.length < 3 ? t('whyFew') : R.whyNotMeld(sel);
      const chk = !why ? R.checkAction(s, { type: 'meld', ids: sel }) : null;
      const reason = why ? t('why_' + why) : chk && !chk.ok ? t('err_' + chk.code) : '';
      acts.push({ id: 'meld', label: t('meld'), kind: 'primary', disabled: !!(why || (chk && !chk.ok)), reason: sel.length ? reason : t('whySelect'), onClick: humanMeld });
      acts.push({ id: 'discard', label: t('discard'), kind: 'secondary', disabled: sel.length !== 1, reason: t('whyDiscard'), onClick: humanDiscardSelected });
      acts.push({ id: 'sort', label: t('sort'), kind: 'secondary', onClick: sortHand });
      acts.push({ id: 'tip', label: t('tip'), kind: 'secondary', onClick: humanTip });
    }
    G.bar.setAll(acts);
    void menu;
  }

  // ---------- actions (human) ----------
  function shake(el) {
    if (!el || reduce() || !el.animate) return;
    el.animate([{ translate: '0' }, { translate: '-5px' }, { translate: '5px' }, { translate: '-3px' }, { translate: '0' }], { duration: 260 });
  }
  function fail(code, el) {
    sfx.error();
    ctx.ui.toast(t('err_' + code) || t('err_unknown'), 2200);
    shake(el || G.bar);
  }

  async function chooseArrangement(list, ids) {
    // distinct by wild position; natural-only variants are equivalent
    const seen = new Map();
    for (let i = 0; i < list.length; i++) {
      const w = list[i].cards.find((c) => c.w);
      const key = w ? w.r : 'n';
      if (!seen.has(key)) seen.set(key, i);
    }
    const opts = [...seen.entries()];
    if (opts.length < 2) return 0;
    const actions = opts.map(([key, idx]) => {
      const w = list[idx].cards.find((c) => c.w);
      return { label: w ? t('wildAs', { card: rankLabel(w.r) + SUIT_SYM[list[idx].suit] }) : t('natural'), value: idx };
    });
    actions.push({ label: t('cancel'), value: -1 });
    const v = await T.modal({ root, title: t('wildWhere'), body: t('wildWhereBody'), actions, dismissible: true });
    return v === null || v === undefined ? -1 : v;
  }

  async function exec(action) {
    const s = match.state;
    const chk = R.checkAction(s, action);
    if (!chk.ok) {
      fail(chk.code);
      return false;
    }
    G.busy = true;
    const fromRect = action.type === 'discard' && G.hand.cardEl(String(action.id)) ? G.hand.cardEl(String(action.id)).getBoundingClientRect() : null;
    const res = R.apply(s, action);
    persist();
    G.sel = [];
    G.hand.clearSelection();
    G.taking = false;
    handleEvents(res.events, 0, fromRect);
    G.busy = false;
    render(false, freshMeldIds(res.events));
    if (match.state.phase === 'end') {
      later(() => roundOver(false), 900);
      return true;
    }
    nextStep();
    return true;
  }
  const freshMeldIds = (events) => new Set(events.filter((e) => e.k === 'meld' || e.k === 'add').map((e) => e.meld));

  function humanDraw() {
    if (!myTurn()) return;
    const s = match.state;
    if (G.taking) return cancelTaking();
    if (s.phase !== 'draw') return fail('phase');
    if (!s.stock.length) return fail('stockEmpty');
    exec({ type: 'draw' });
  }
  function humanStop() {
    if (!myTurn()) return;
    T.modal({ root, title: t('endTitle'), body: t('endBody'), actions: [{ label: t('cancel'), value: false }, { label: t('end'), value: true, danger: true }] }).then((ok) => ok && exec({ type: 'stop' }));
  }
  function humanTapPile() {
    if (!myTurn()) return;
    const s = match.state;
    if (G.taking) return cancelTaking();
    if (s.phase !== 'draw') return;
    if (!s.pile.length) {
      ctx.ui.toast(t('pileEmpty'), 1600);
      return;
    }
    const plays = R.pilePlays(s, 0);
    if (!plays.length) {
      sfx.error();
      shake(G.pileWrap);
      ctx.ui.toast(t('err_cantTake'), 2600);
      return;
    }
    G.taking = true;
    sfx.select();
    // pre-select the cards of the best "new meld" play when there is no simple add
    const adds = plays.filter((p) => p.t === 'add');
    G.hand.clearSelection();
    if (!adds.length) {
      let best = null;
      let bw = 9;
      for (const p of plays) {
        const w = R.wildCount(R.arrangements(p.ids)[0].cards);
        if (w < bw) {
          bw = w;
          best = p;
        }
      }
      if (best) {
        best.ids.slice(1).forEach((id) => G.hand.select(String(id)));
      }
    }
    refreshControls();
  }
  function cancelTaking() {
    G.taking = false;
    G.hand.clearSelection();
    refreshControls();
  }
  async function confirmTaking() {
    const s = match.state;
    const top = s.pile[s.pile.length - 1];
    const sel = G.sel.slice();
    let play = null;
    if (sel.length) {
      const ids = [top, ...sel];
      const list = R.arrangements(ids);
      if (!list.length) return fail('cantTake', G.bar);
      const arr = await chooseArrangement(list, ids);
      if (arr < 0) return;
      play = { t: 'meld', ids, arr };
    } else {
      const plays = R.pilePlays(s, 0).filter((p) => p.t === 'add');
      if (!plays.length) {
        ctx.ui.toast(t('hintTaking'), 2200);
        return;
      }
      // prefer the meld that becomes a canastra, else the longest
      plays.sort((a, b) => meldLen(s, b) - meldLen(s, a));
      play = plays[0];
      const m = s.melds[0].find((x) => x.id === play.meld);
      const list = R.extensions(m, [top]);
      const arr = await chooseArrangement(list, [top]);
      if (arr < 0) return;
      play = { ...play, arr };
    }
    exec({ type: 'take', play });
  }
  const meldLen = (s, p) => (s.melds[0].find((x) => x.id === p.meld) || { cards: [] }).cards.length;

  async function humanMeld() {
    if (!myTurn()) return;
    const s = match.state;
    if (G.taking) return confirmTaking();
    if (s.phase !== 'play') return;
    const ids = G.sel.slice();
    if (ids.length < 3) return fail('tooFew', G.bar);
    const list = R.arrangements(ids);
    if (!list.length) return fail(R.whyNotMeld(ids) === 'mixedSuits' ? 'mixedSuits' : 'notSequence', G.bar);
    const arr = await chooseArrangement(list, ids);
    if (arr < 0) return;
    exec({ type: 'meld', ids, arr });
  }
  async function humanAdd(meldId) {
    if (!myTurn()) return;
    const s = match.state;
    const m = s.melds[0].find((x) => x.id === meldId);
    if (!m) return;
    if (G.taking) {
      const top = s.pile[s.pile.length - 1];
      const ids = [top, ...G.sel];
      const list = R.extensions(m, ids);
      if (!list.length) return fail('invalidAdd', G.areaUs.melds);
      const arr = await chooseArrangement(list, ids);
      if (arr < 0) return;
      return exec({ type: 'take', play: { t: 'add', meld: meldId, ids, arr } });
    }
    if (s.phase !== 'play') return ctx.ui.toast(t('hintDraw'), 1600);
    const ids = G.sel.slice();
    if (!ids.length) {
      ctx.ui.toast(t('hintAddSel'), 1800);
      return;
    }
    const list = R.extensions(m, ids);
    if (!list.length) {
      const chk = R.checkAction(s, { type: 'add', meld: meldId, ids });
      sfx.error();
      shake(G.areaUs.melds.querySelector(`[data-meld="${meldId}"]`));
      ctx.ui.toast(t('err_' + (chk.code || 'invalidAdd')), 2200);
      return;
    }
    const arr = await chooseArrangement(list, ids);
    if (arr < 0) return;
    exec({ type: 'add', meld: meldId, ids, arr });
  }
  function humanDiscardSelected() {
    if (!myTurn() || match.state.phase !== 'play') return;
    if (G.sel.length !== 1) return fail('tooFew', G.bar);
    humanDiscard(G.sel[0]);
  }
  function humanDiscard(id) {
    if (!myTurn() || match.state.phase !== 'play') return;
    exec({ type: 'discard', id });
  }
  function humanTip() {
    if (!myTurn()) return;
    const s = match.state;
    const hand = s.hands[0];
    G.hand.clearSelection();
    // 1) a natural card that fits one of our melds
    for (const m of s.melds[0]) {
      for (const id of hand) {
        if (R.isJoker(id)) continue;
        const list = R.extensions(m, [id]);
        if (list.length && R.wildCount(list[0].cards) === R.wildCount(m.cards)) {
          G.hand.select(String(id));
          ctx.ui.toast(t('tipAdd'), 1800);
          return;
        }
      }
    }
    // 2) a natural run
    const run = naturalRunsLazy(hand)[0];
    if (run) {
      run.forEach((id) => G.hand.select(String(id)));
      ctx.ui.toast(t('tipRun'), 1800);
      return;
    }
    ctx.ui.toast(t('tipNone'), 2000);
  }
  let naturalRunsFn = null;
  import('./ai.js').then((m) => (naturalRunsFn = m.naturalRuns));
  const naturalRunsLazy = (hand) => (naturalRunsFn ? naturalRunsFn(hand) : []);

  // ---------- events → sound, banners, log, flights ----------
  function handleEvents(events, sourceSeat, fromRect) {
    const n = match.n;
    for (const e of events) {
      const who = seatName(n, e.seat ?? sourceSeat);
      switch (e.k) {
        case 'draw':
          sfx.deal();
          if (e.seat !== 0) {
            pushLog(t('log_draw', { name: who }));
            flyBack(e.seat, G.stockPile, true);
          }
          break;
        case 'take': {
          sfx.slide();
          pushLog(t('log_take', { name: who, n: e.ids.length }), 'hot');
          if (e.seat !== 0) flyBack(e.seat, G.pileWrap, true);
          break;
        }
        case 'meld':
          sfx.place();
          pushLog(t('log_meld', { name: who, cards: meldCardsText(e.ids) }));
          break;
        case 'add':
          sfx.place();
          pushLog(t('log_add', { name: who, cards: e.ids.map(cardText).join(' ') }));
          break;
        case 'discard':
          sfx.place();
          pushLog(t('log_discard', { name: who, card: cardText(e.id) }));
          if (e.seat === 0) {
            if (fromRect) flyTo(toCard(e.id), fromRect, G.pileCard);
          } else flyFromSeat(e.seat, toCard(e.id), G.pileCard);
          break;
        case 'morto':
          sfx.chipStack(4);
          pushLog(t('log_morto', { name: who }), 'hot');
          T.banner(root, e.seat === 0 ? t('gotMorto') : t('tookMorto', { name: who }), { sub: t('mortoSub'), tone: R.teamOf(n, e.seat) === 0 ? 'good' : 'gold', ms: 1700 });
          break;
        case 'canastra':
          sfx.chipStack(6);
          if (sfx.haptics) ctx.sfx.vibrate?.([20, 40, 20]);
          pushLog(t('log_canastra', { name: who, kind: t('can_' + e.kind) }), 'hot');
          T.banner(root, t('canastraBanner', { kind: t('can_' + e.kind) }), { sub: R.teamOf(n, e.seat) === 0 ? t('ourTeam') : t('theirTeam'), tone: R.teamOf(n, e.seat) === 0 ? 'good' : 'bad', ms: 1500 });
          break;
        case 'bater':
          pushLog(t('log_bater', { name: who }), 'hot');
          break;
        case 'end':
          if (e.reason === 'stock') pushLog(t('log_stock'), 'hot');
          if (e.reason === 'stop') pushLog(t('log_stop', { name: who }), 'hot');
          break;
      }
    }
  }
  const meldCardsText = (ids) => ids.slice(0, 6).map(cardText).join(' ') + (ids.length > 6 ? '…' : '');

  // minimal card flights (fixed-position ghost, ignored with reduced motion)
  function ghost(card, w) {
    const el = cardEl(card, { size: w, faceDown: !card, lang, back: 'emerald' });
    el.removeAttribute('role');
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '2147483000';
    el.style.pointerEvents = 'none';
    document.body.append(el);
    return el;
  }
  function flyTo(card, fromRect, toEl) {
    if (reduce() || !toEl || !toEl.getBoundingClientRect) return;
    const to = toEl.getBoundingClientRect();
    const w = to.width;
    const g = ghost(card, w);
    const hide = toEl.topEl || null;
    if (hide) hide.style.visibility = 'hidden';
    const a = g.animate(
      [
        { transform: `translate(${fromRect.left}px, ${fromRect.top}px) scale(${fromRect.width / w})` },
        { transform: `translate(${to.left}px, ${to.top}px) scale(1)` },
      ],
      { duration: settings.fast ? 180 : 330, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' },
    );
    const done = () => {
      g.remove();
      if (hide) hide.style.visibility = '';
    };
    a.onfinish = done;
    a.oncancel = done;
    later(done, 700);
  }
  function seatRect(seat) {
    const c = G.chips[seat];
    if (c) return c.wrap.getBoundingClientRect();
    // partner-less layouts: use the top of the table
    return G.screen.getBoundingClientRect();
  }
  function flyFromSeat(seat, card, toEl) {
    const r = seatRect(seat);
    flyTo(card, { left: r.left + r.width / 2 - 12, top: r.top + r.height / 2 - 17, width: 24 }, toEl);
  }
  function flyBack(seat, fromEl, down) {
    if (reduce() || !fromEl) return;
    const from = fromEl.getBoundingClientRect();
    const to = seatRect(seat);
    const w = 34;
    const g = ghost(null, w);
    const a = g.animate(
      [
        { transform: `translate(${from.left + from.width / 2 - w / 2}px, ${from.top + from.height / 2 - w * 0.7}px) scale(1)`, opacity: 1 },
        { transform: `translate(${to.left + to.width / 2 - w / 2}px, ${to.top + to.height / 2 - w * 0.7}px) scale(.75)`, opacity: 0.2 },
      ],
      { duration: settings.fast ? 180 : 330, easing: 'ease-in', fill: 'forwards' },
    );
    a.onfinish = () => g.remove();
    a.oncancel = () => g.remove();
    later(() => g.remove(), 700);
    void down;
  }

  // ---------- turn driver (computer players) ----------
  async function nextStep() {
    const token = ++runToken;
    const s = match.state;
    if (s.phase === 'end') return;
    refreshControls();
    if (s.turn === 0) {
      if (s.phase === 'draw' && s.turnNo !== G.lastTurnNoticed) {
        G.lastTurnNoticed = s.turnNo;
        sfx.turn?.();
      }
      return;
    }
    G.busy = true;
    refreshControls();
    await sleep(520);
    while (token === runToken && !disposed && view === 'match') {
      const st2 = match.state;
      if (st2.phase === 'end' || st2.turn === 0) break;
      const seat = st2.turn;
      const action = chooseAction(st2, match.level);
      if (!action) break;
      const res = R.apply(st2, action);
      if (!res.ok) break; // cannot happen (fuzzed), but never loop forever
      persist();
      handleEvents(res.events, seat, null);
      render(false, freshMeldIds(res.events));
      if (match.state.phase === 'end') break;
      await sleep(action.type === 'draw' ? 520 : action.type === 'take' ? 950 : action.type === 'discard' ? 620 : 800);
    }
    if (token !== runToken || disposed) return;
    G.busy = false;
    if (match.state.phase === 'end') {
      refreshControls();
      later(() => roundOver(false), 900);
      return;
    }
    render();
    if (match.state.turn === 0) {
      sfx.turn?.();
      G.sel.length || void 0;
    }
  }

  // ======================================================================
  // ROUND END / MATCH END
  // ======================================================================
  async function roundOver(resumed) {
    if (disposed || view !== 'match') return;
    const s = match.state;
    const n = match.n;
    if (!match.summary) {
      const sc = R.scoreRound(s);
      match.scores = [match.scores[0] + sc[0].total, match.scores[1] + sc[1].total];
      for (let team = 0; team < 2; team++) match.canastras[team] += sc[team].canastras.clean + sc[team].canastras.dirty + sc[team].canastras.real;
      match.rounds.push({ round: match.round, totals: [sc[0].total, sc[1].total], reason: s.ended.reason, team: s.ended.team });
      match.summary = { sc, reason: s.ended.reason, seat: s.ended.seat, team: s.ended.team };
      // lifetime counters
      const ext = store.get('ext', { rounds: 0, roundsWon: 0, canastras: 0, baters: 0, real: 0 });
      ext.rounds++;
      if (sc[0].total > sc[1].total) ext.roundsWon++;
      ext.canastras += sc[0].canastras.clean + sc[0].canastras.dirty + sc[0].canastras.real;
      ext.real += sc[0].canastras.real;
      if (s.ended.reason === 'bater' && s.ended.team === 0) ext.baters++;
      store.set('ext', ext);
      persist();
    }
    const { sc } = match.summary;
    const winner = R.matchWinner(match.scores, match.target);
    const row = (label, a, b, cls) => h('tr', { class: cls || '' }, h('th', null, label), h('td', null, fmt(a)), h('td', null, fmt(b)));
    const fmt = (v) => (typeof v === 'number' ? (v > 0 ? '+' + v : String(v)) : v);
    const plain = (v) => String(v);
    const body = h('div', { class: 'g-buraco-sum' });
    const reasonTxt =
      match.summary.reason === 'bater'
        ? t('sumBater', { name: seatName(n, match.summary.seat) })
        : match.summary.reason === 'stock'
          ? t('sumStock')
          : t('sumStop');
    body.append(h('p', { class: 'g-buraco-sum-r' }, reasonTxt));
    const can = (x) => `${x.clean}·${x.dirty}·${x.real}`;
    body.append(
      h(
        'table',
        { class: 'g-buraco-tbl' },
        h('thead', null, h('tr', null, h('th'), h('th', null, teamName(n, 0)), h('th', null, teamName(n, 1)))),
        h(
          'tbody',
          null,
          row(t('sumMelds'), sc[0].meldPts, sc[1].meldPts),
          row(t('sumCanastras') + ' (' + t('sumCanLegend') + ')', sc[0].canastraPts, sc[1].canastraPts),
          h('tr', { class: 'is-sub' }, h('th', null, ''), h('td', null, can(sc[0].canastras)), h('td', null, can(sc[1].canastras))),
          row(t('sumBaterB'), sc[0].bater, sc[1].bater),
          row(t('sumHand'), -sc[0].handPts, -sc[1].handPts),
          row(t('sumMorto'), sc[0].morto, sc[1].morto),
          row(t('sumRound'), sc[0].total, sc[1].total, 'is-total'),
          h('tr', { class: 'is-game' }, h('th', null, t('sumGame', { n: match.target })), h('td', null, plain(match.scores[0])), h('td', null, plain(match.scores[1]))),
        ),
      ),
    );
    render();
    if (match.summary.reason === 'bater') sfx.chipStack(5);
    const actions = winner === null ? [{ label: t('nextRound'), value: 'next', primary: true }] : [{ label: t('seeResult'), value: 'result', primary: true }];
    const tie = winner === null && match.scores.some((v) => v >= match.target);
    if (tie) body.append(h('p', { class: 'muted small' }, t('tieExtra')));
    await T.modal({ root, title: t('roundSummary', { n: match.round }), body, actions, className: 'g-buraco-summodal' });
    if (disposed || view !== 'match') return;
    if (winner !== null) return finishMatch(winner);
    // next round
    match.round++;
    match.dealer = (match.dealer + 1) % n;
    match.summary = null;
    match.state = R.newRound({ n, dealer: match.dealer, cleanOut: match.cleanOut });
    persist();
    G.handOrder = [];
    G.hand.setCards([], { animate: false });
    renderedMelds = { 0: '\u0000', 1: '\u0000' };
    G.sel = [];
    G.log = [];
    G.lastLine.textContent = '';
    render(true);
    sfx.shuffle();
    T.banner(root, t('roundN', { n: match.round }), { sub: t('newRoundSub'), ms: 1200 });
    nextStep();
    void resumed;
  }

  async function finishMatch(winner) {
    const n = match.n;
    const won = winner === 0;
    const rounds = match.rounds.length;
    matchSave.clear();
    stats.record({ result: won ? 'win' : 'loss', score: match.scores[0], extra: { n, them: match.scores[1], rounds, target: match.target, level: match.level } });
    ctx.addXP?.(won ? (n === 4 ? 40 : 30) : 15);
    if (won) sfx.win();
    else sfx.lose();
    const ext = store.get('ext', {});
    void ext;
    const choice = await T.modal({
      root,
      title: won ? t('youWin') : t('youLose'),
      body: h(
        'div',
        { class: 'g-buraco-final' },
        h('p', { class: 'g-buraco-final-sc' }, `${teamName(n, 0)} ${match.scores[0]} × ${match.scores[1]} ${teamName(n, 1)}`),
        h('p', { class: 'muted' }, t('finalSub', { r: rounds, c: match.canastras[0] })),
      ),
      actions: [
        { label: t('toMenu'), value: 'menu' },
        { label: t('playAgain'), value: 'again', primary: true },
      ],
      className: won ? 'is-win' : 'is-lose',
    });
    if (won) ctx.ui.confetti?.();
    if (disposed) return;
    if (choice === 'again') {
      const keep = match;
      match = null;
      startMatch(keep.n, null);
    } else {
      match = null;
      showMenu();
    }
  }

  // ======================================================================
  // DIALOGS
  // ======================================================================
  async function confirmLeave() {
    const s = match && match.state;
    if (!match) return showMenu();
    const ok = await T.modal({
      root,
      title: t('leaveTitle'),
      body: t('leaveBody'),
      actions: [
        { label: t('stay'), value: false, primary: true },
        { label: t('leave'), value: true },
      ],
      dismissible: true,
    });
    if (ok) {
      persist();
      void s;
      match = null;
      showMenu();
    }
  }

  function showRules() {
    const sec = (k) => ({ title: t('r_' + k + '_t'), items: [1, 2, 3, 4, 5, 6, 7].map((i) => t(`r_${k}_${i}`)).filter((x) => x && !x.startsWith('r_')) });
    T.rulesModal({ root, title: t('rules'), sections: ['goal', 'melds', 'turn', 'lixo', 'morto', 'score', 'ui'].map(sec), closeLabel: t('close'), lang });
  }

  function showStats() {
    const st = stats.get();
    const ext = store.get('ext', { rounds: 0, roundsWon: 0, canastras: 0, baters: 0, real: 0 });
    const rows = [
      [t('stGames'), st.games],
      [t('stWins'), st.wins],
      [t('stLosses'), st.losses],
      [t('stRate'), st.games ? Math.round((st.wins / st.games) * 100) + '%' : '—'],
      [t('stBest'), st.best ?? '—'],
      [t('stStreak'), `${st.streak} (${t('stBestStreak')} ${st.bestStreak})`],
      [t('stRounds'), `${ext.roundsWon}/${ext.rounds}`],
      [t('stCanastras'), `${ext.canastras} (${ext.real} ${t('can_real').toLowerCase()})`],
      [t('stBaters'), ext.baters],
    ];
    const body = h('div', { class: 'g-buraco-stats' });
    body.append(h('div', { class: 'g-buraco-st-grid' }, rows.map(([k, v]) => h('div', { class: 'g-buraco-st' }, h('span', null, k), h('b', null, String(v))))));
    const hist = st.history.slice().reverse().slice(0, 8);
    if (hist.length) {
      body.append(
        h('div', { class: 'section-title' }, t('stRecent')),
        h('ul', { class: 'g-buraco-hist' }, hist.map((e) => h('li', { class: e.result === 'win' ? 'is-win' : 'is-loss' }, h('span', null, e.result === 'win' ? '✔' : '✖'), h('span', null, `${e.score} × ${e.extra ? e.extra.them : '?'}`), h('span', { class: 'muted' }, e.extra ? (e.extra.n === 2 ? t('duelShort') : t('teamShort')) + ' · ' + e.extra.target : '')))),
      );
    }
    T.modal({ root, title: t('stats'), body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  }

  function showHistory() {
    if (!match) return;
    const n = match.n;
    const body = h('div', { class: 'g-buraco-histm' });
    if (!match.rounds.length) body.append(h('p', { class: 'muted' }, t('noRoundsYet')));
    else
      body.append(
        h(
          'table',
          { class: 'g-buraco-tbl' },
          h('thead', null, h('tr', null, h('th', null, t('roundShort')), h('th', null, teamName(n, 0)), h('th', null, teamName(n, 1)))),
          h('tbody', null, match.rounds.map((r) => h('tr', null, h('th', null, String(r.round)), h('td', null, String(r.totals[0])), h('td', null, String(r.totals[1]))))),
          h('tfoot', null, h('tr', { class: 'is-total' }, h('th', null, t('total')), h('td', null, String(match.scores[0])), h('td', null, String(match.scores[1])))),
        ),
      );
    body.append(h('p', { class: 'muted small' }, t('targetN', { n: match.target }) + ' · ' + (match.cleanOut ? t('outClean') : t('outAny')) + ' · ' + t('lvl_' + match.level)));
    T.modal({ root, title: t('scoreHistory'), body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  }

  function showPile() {
    if (!match) return;
    const s = match.state;
    const body = h('div', { class: 'g-buraco-pilev' });
    if (!s.pile.length) body.append(h('p', { class: 'muted' }, t('pileEmpty')));
    else {
      const grid = h('div', { class: 'g-buraco-pilegrid' });
      s.pile.forEach((id) => {
        const c = cardEl(toCard(id), { size: 40, lang });
        grid.append(c);
      });
      body.append(h('p', { class: 'muted small' }, t('pileInfo', { n: s.pile.length })), grid);
    }
    T.modal({ root, title: t('pile'), body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  }

  function showLog() {
    if (!G) return;
    const body = h('div', { class: 'g-buraco-log' }, G.log.length ? G.log.slice().reverse().map((l) => h('div', { class: 'g-buraco-log-l' }, l)) : h('p', { class: 'muted' }, t('noLog')));
    T.modal({ root, title: t('log'), body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  }

  // ======================================================================
  // ENTRY
  // ======================================================================
  const saved0 = matchSave.load();
  if (ctx.mode === 'team' || ctx.mode === 'duel') {
    const n = ctx.mode === 'duel' ? 2 : 4;
    if (saved0 && saved0.n === n) {
      showMenu();
      T.modal({
        root,
        title: t('resume'),
        body: t('resumeSub', { n: saved0.round, a: saved0.scores[0], b: saved0.scores[1], target: saved0.target }),
        actions: [
          { label: t('startNew'), value: 'new' },
          { label: t('resume'), value: 'resume', primary: true },
        ],
      }).then((resume) => {
        if (disposed) return;
        if (resume === 'resume') startMatch(null, saved0);
        else if (resume === 'new') startMatch(n, null);
      });
    } else startMatch(n, null);
  } else {
    showMenu();
  }

  return () => {
    disposed = true;
    runToken++;
    timers.forEach(clearTimeout);
    timers.clear();
    endScope();
    ctx.setHeaderRight(null);
    window.removeEventListener('pointerdown', onFirstTap);
    document.querySelectorAll('.dc-fly-layer').forEach((el) => el.remove());
  };
}
