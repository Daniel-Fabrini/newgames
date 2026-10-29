// Bisca — 2 players vs the computer, or 4 players in two teams. 40-card Portuguese deck.
//   Menu → match (single hand / best of 3 / first to 4 points) → round summary → final result.
//   Modes (ctx.mode): solo, team. Variants: Bisca de 3 (default) and Bisca de 9; optional "trocar o sete".
//   The rules live in rules.js (pure, tested), the computer players in ai.js (they only see a `view`).
//   Matches autosave to ctx.store after every card and resume with the same seeded RNG state.
import STRINGS from './strings.js';
import * as R from './rules.js';
import { chooseAction, chooseCard, wantsSwap } from './ai.js';
import { randomSeed, suitOf, rankOf, pts, RANK_LABEL, SUIT_SYM } from './deck.js';
import { cardEl } from '../_cards/card.js';
import { createHand } from '../_cards/hand.js';
import { createAnimator, motion } from '../_cards/anim.js';
import { createCardSfx } from '../_cards/sfx.js';
import { createMatchSave, createStats } from '../_cards/storage.js';
import { setCardLang, cardName } from '../_cards/decks.js';
import { playerChip, modal, resultModal, rulesModal } from '../_cards/table.js';

const SUIT_CODE = ['h', 'd', 's', 'c'];
const toCard = (c) => ({ r: RANK_LABEL[rankOf(c)], s: SUIT_CODE[suitOf(c)], id: RANK_LABEL[rankOf(c)] + SUIT_CODE[suitOf(c)] });
const fromId = (id) => SUIT_CODE.indexOf(id[1]) * 10 + RANK_LABEL.indexOf(id[0]);
const SUIT_KEY = ['suitHearts', 'suitDiamonds', 'suitSpades', 'suitClubs'];
const AVATARS = [2, 5, 11, 13];
const NAMES = ['', 'Tiago', 'Marta', 'Inês'];
const TEAM_COLOR = ['#f3c24a', '#6fb2ff'];
const POS4 = ['bottom', 'right', 'top', 'left'];

const ICON = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
const ICONS = {
  last: ICON('<rect x="3.5" y="6" width="10" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10.5" y="4" width="10" height="14" rx="2" fill="#0d0e12" stroke="currentColor" stroke-width="2"/>'),
  hint: ICON('<path d="M12 3.2a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.1V17h5v-.9c0-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3.2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.8 20.2h4.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOn: ICON('<path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5Z" fill="currentColor"/><path d="M15.2 9a4.2 4.2 0 0 1 0 6M17.6 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOff: ICON('<path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5Z" fill="currentColor"/><path d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  rules: ICON('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>'),
  gear: ICON('<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  stats: ICON('<path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  resume: ICON('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  user: ICON('<circle cx="12" cy="8" r="3.8" fill="currentColor"/><path d="M4.5 20c.6-3.6 3.6-5.6 7.500-5.600s6.900 2 7.500 5.600" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  users: ICON('<circle cx="8.5" cy="9" r="3" fill="currentColor"/><circle cx="16" cy="10" r="2.5" fill="currentColor" opacity=".7"/><path d="M2.8 19c.4-3 2.7-4.700 5.700-4.700s5.300 1.700 5.700 4.700M14.600 15c2.900-.5 5.800.8 6.400 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  swap: ICON('<path d="M5 8h12l-3-3M19 16H7l3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
};

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('../_cards/cards.css', import.meta.url));
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  setCardLang(ctx.lang);
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const store = ctx.store;
  const cs = createCardSfx(ctx);
  const anim = createAnimator();
  const save = createMatchSave(store, 'match', { version: 1, validate: (s) => s && s.v === 1 && Array.isArray(s.hands) && (s.n === 2 || s.n === 4) });
  const stats = createStats(store, 'stats', { historyMax: 12 });
  const prevSpeed = motion.speed;

  const settings = { showPoints: true, oneTap: false, fast: false, sound: true, handSize: 3, format: 'bo3', swap7: false, ...(store.get('settings', {}) || {}) };
  const saveSettings = () => store.set('settings', settings);
  cs.enabled = settings.sound;
  motion.speed = settings.fast ? 2 : 1;

  // ---------- lifecycle ----------
  let disposed = false;
  let runId = 0;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const sleep = (ms) => new Promise((res) => later(res, ms / (motion.speed || 1)));
  const reduced = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  };
  const alive = (id) => !disposed && id === runId;
  const vars = (el, o) => {
    for (const k of Object.keys(o)) el.style.setProperty(k, o[k]);
    return el;
  };

  // ---------- state ----------
  let S = null;
  let screen = 'menu';
  let refs = null;
  let hand = null;
  let humanResolve = null;
  let hintTimer = 0;
  let N = 2;

  const posOf = (seat) => (N === 2 ? (seat === 0 ? 'bottom' : 'top') : POS4[seat]);
  const seatName = (seat) => (seat === 0 ? t('you') : N === 2 ? t('rival') : NAMES[seat]);
  const teamTricks = (team) => S.tricks.filter((x) => R.teamOf(x.winner) === team).length;
  const suitLabel = (s) => `${SUIT_SYM[s]} ${t(SUIT_KEY[s])}`;
  const cname = (c) => cardName(toCard(c), ctx.lang);
  const persist = () => S && save.save(S);
  const teamLabel = (team) => (N === 2 ? (team === 0 ? t('you') : t('rival')) : t(team === 0 ? 'us' : 'them'));

  function flash(text, tone = '') {
    if (!refs) return;
    const el = refs.flash;
    el.textContent = text;
    el.className = 'g-bisca-flash show ' + tone;
    clearTimeout(el._t);
    el._t = later(() => el.classList.remove('show'), 1600);
  }
  const formatLabel = (f) => t({ single: 'formatSingle', bo3: 'formatBo3', p4: 'formatP4' }[f]);
  const variantLabel = (o) => (o.handSize === 9 ? t('variant9') : t('variant3'));
  const scoreLabel = (s) => (s.opts.match === 'single' ? `${s.points[0]} × ${s.points[1]} ${t('pts', { n: '' }).trim()}` : s.opts.match === 'bo3' ? `${s.wins[0]} × ${s.wins[1]}` : `${s.scores[0]} × ${s.scores[1]}`);

  // ---------- menu ----------
  function showMenu() {
    runId++;
    screen = 'menu';
    teardownTable();
    ctx.setHeaderRight(null);
    clear(root);
    const saved = save.load();
    const fan = h('div', { class: 'g-bisca-fan', 'aria-hidden': 'true' }, [
      ['7', 'h', -16], ['A', 'c', -5], ['K', 's', 6], ['J', 'd', 17],
    ].map(([r, s, rot]) => {
      const el = cardEl({ r, s, id: r + s }, { size: 74 });
      el.style.transform = `rotate(${rot}deg) translateY(${Math.abs(rot) * 0.5}px)`;
      return el;
    }));
    const btn = (label, sub, ico, onclick, cls = '') =>
      h('button', { class: `g-bisca-mbtn ${cls}`, type: 'button', onclick }, h('span', { class: 'g-bisca-mico', html: ICONS[ico] }), h('span', { class: 'g-bisca-mtx' }, h('b', null, label), sub ? h('small', null, sub) : null));
    const summary = (extraSwap = true) => [variantLabel({ handSize: settings.handSize }), formatLabel(settings.format), settings.swap7 && extraSwap ? t('swap7') : null].filter(Boolean).join(' · ');
    root.append(h('div', { class: 'g-bisca-menu' },
      fan,
      h('h1', { class: 'g-bisca-title' }, t('name')),
      h('p', { class: 'g-bisca-tag' }, t('menuHint')),
      h('div', { class: 'g-bisca-mlist' },
        saved ? btn(t('continue'), t('continueInfo', { mode: saved.n === 4 ? t('team') : t('solo'), score: scoreLabel(saved) }), 'resume', () => resumeSaved(), 'primary') : null,
        btn(t('solo'), t('soloSub'), 'user', () => newGame('solo'), saved ? '' : 'primary'),
        btn(t('team'), t('teamSub'), 'users', () => newGame('team')),
      ),
      h('button', { type: 'button', class: 'g-bisca-summary', onclick: () => openOptions(false) }, h('span', { html: ICONS.gear }), summary()),
      h('div', { class: 'g-bisca-mlinks' },
        h('button', { type: 'button', class: 'g-bisca-link', onclick: showStats }, h('span', { html: ICONS.stats }), t('stats')),
        h('button', { type: 'button', class: 'g-bisca-link', onclick: openRules }, h('span', { html: ICONS.rules }), t('rules')),
      ),
    ));
  }

  // ---------- stats ----------
  const extra = () => ({ rounds: 0, roundsWon: 0, capotes: 0, bestRound: 0, ...(store.get('extra', {}) || {}) });
  function showStats() {
    screen = 'stats';
    clear(root);
    const st = stats.get();
    const ex = extra();
    const tile = (label, value) => h('div', { class: 'g-bisca-tile' }, h('b', null, String(value)), h('span', null, label));
    const rate = st.games ? Math.round((st.wins / st.games) * 100) + '%' : '–';
    const recent = st.history.slice().reverse().map((e) =>
      h('li', { class: `g-bisca-hrow is-${e.result}` },
        h('span', { class: 'g-bisca-hres' }, e.result === 'win' ? t('resultWin') : e.result === 'loss' ? t('resultLoss') : t('resultDraw')),
        h('span', null, `${e.team ? t('team') : t('solo')} · ${e.nine ? t('variant9') : t('variant3')}`),
        h('b', null, e.label || '')));
    root.append(h('div', { class: 'g-bisca-page' },
      h('header', { class: 'g-bisca-pagehead' }, h('h2', null, t('statsTitle'))),
      h('div', { class: 'g-bisca-tiles' }, tile(t('statGames'), st.games), tile(t('statWins'), st.wins), tile(t('statLosses'), st.losses), tile(t('statRate'), rate), tile(t('statStreak'), Math.max(0, st.bestStreak)), tile(t('statRounds'), ex.roundsWon), tile(t('statCapotes'), ex.capotes), tile(t('statBestRound'), ex.bestRound), tile(t('statDraws'), st.draws)),
      h('h3', { class: 'g-bisca-sub' }, t('statRecent')),
      recent.length ? h('ul', { class: 'g-bisca-hist' }, recent) : h('p', { class: 'g-bisca-muted' }, t('statNone')),
      h('div', { class: 'g-bisca-pagebtns' },
        h('button', { type: 'button', class: 'g-bisca-pbtn', onclick: showMenu }, t('back')),
        st.games ? h('button', { type: 'button', class: 'g-bisca-pbtn danger', onclick: async () => { if (await modal({ root, title: t('reset'), body: t('resetBody'), actions: [{ label: t('no'), value: false }, { label: t('yes'), value: true, danger: true }], lang: ctx.lang })) { stats.reset(); store.remove('extra'); showStats(); } } }, t('reset')) : null)));
  }

  // ---------- rules / options ----------
  function openRules() {
    rulesModal({ root, title: t('rulesTitle'), sections: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ title: t(`r${i}h`), text: t(`r${i}`) })), closeLabel: t('close'), lang: ctx.lang });
  }
  function openOptions(inGame) {
    const toggle = (key, label, sub, onChange) => {
      const input = h('input', { type: 'checkbox', checked: settings[key] ? true : null, onchange: () => { settings[key] = input.checked; saveSettings(); onChange && onChange(); } });
      return h('label', { class: 'g-bisca-opt' }, h('span', { class: 'g-bisca-opt-tx' }, h('b', null, label), sub ? h('small', null, sub) : null), input, h('i', { class: 'g-bisca-sw' }));
    };
    const seg = (key, label, items, onChange) => {
      const row = h('div', { class: 'g-bisca-seg', role: 'group', 'aria-label': label });
      const paint = () => [...row.children].forEach((b) => { const on = String(settings[key]) === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      items.forEach(([v, text, sub]) => row.append(h('button', { type: 'button', dataset: { v: String(v) }, onclick: () => { settings[key] = typeof v === 'number' ? v : v; saveSettings(); paint(); onChange && onChange(); } }, h('b', null, text), sub ? h('small', null, sub) : null)));
      paint();
      return h('div', { class: 'g-bisca-optblock' }, h('span', { class: 'g-bisca-optlab' }, label), row);
    };
    const body = h('div', { class: 'g-bisca-opts' },
      toggle('sound', t('sound'), null, () => { cs.enabled = settings.sound; syncSoundBtn(); }),
      toggle('showPoints', t('showPoints'), t('showPointsSub'), () => refs && S && updateHud()),
      toggle('oneTap', t('oneTapLabel'), t('oneTapSub'), () => rebuildHand()),
      toggle('fast', t('fastAnim'), null, () => { motion.speed = settings.fast ? 2 : 1; }),
      inGame ? null : seg('handSize', t('variant'), [[3, t('variant3'), t('variantSub3')], [9, t('variant9'), t('variantSub9')]], () => showMenu()),
      inGame ? null : seg('format', t('format'), [['single', t('formatSingle')], ['bo3', t('formatBo3')], ['p4', t('formatP4')]], () => showMenu()),
      inGame ? null : toggle('swap7', t('swap7'), t('swap7Sub'), () => showMenu()));
    modal({ root, title: t('optionsTitle'), body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true, lang: ctx.lang });
  }

  // ---------- game start / resume ----------
  function newGame(kind) {
    const begin = () => {
      const opts = kind === 'team' ? { players: 4, handSize: 3, swap7: settings.swap7, match: settings.format } : { players: 2, handSize: settings.handSize, swap7: settings.swap7, match: settings.format };
      S = R.newMatch(opts, randomSeed());
      save.clear();
      persist();
      enterGame(true);
    };
    if (save.exists()) {
      modal({ root, title: t('abandonTitle'), body: t('abandonBody'), actions: [{ label: t('no'), value: false }, { label: t('yes'), value: true, danger: true }], dismissible: true, lang: ctx.lang }).then((v) => v && begin());
    } else begin();
  }
  function resumeSaved() {
    const s = save.load();
    if (!s) return showMenu();
    S = s;
    enterGame(false);
  }

  // ---------- table ----------
  function teardownTable() {
    if (hand) hand.destroy();
    hand = null;
    refs = null;
    humanResolve = null;
    anim.skip();
  }

  function sizes() {
    const W = root.clientWidth || 360;
    const Hh = root.clientHeight || 640;
    const nine = S && S.opts.handSize === 9;
    const handCw = nine
      ? Math.min(Math.floor((W - 18) / 5), 84, Math.floor(Hh / 8.2))
      : Math.min(Math.floor((W - 30) / 3.5), 112, Math.floor(Hh / 6.4));
    const small = nine ? 26 : 34;
    const handBlock = Math.max(52, handCw) * 1.74 + 14;
    const tableH = Hh - 56 - 42 - handBlock - 24;
    const byHeight = N === 2 ? (tableH - 214) / 2.9 : (tableH - 150) / 3.3;
    const trick = Math.floor(Math.min(handCw * (nine ? 0.85 : 0.86), (W - 150) / (N === 4 ? 3.7 : 2), Math.max(46, byHeight)));
    return { hand: Math.max(52, handCw), trick: Math.max(46, trick), stack: small, opp: nine ? 28 : 38, W, H: Hh };
  }

  function buildTable() {
    clear(root);
    const sz = sizes();
    const seats = [];
    for (let seat = 0; seat < N; seat++) {
      const pos = posOf(seat);
      const chip = playerChip({ name: seatName(seat), avatar: AVATARS[seat], color: TEAM_COLOR[R.teamOf(seat)], size: pos === 'top' && N === 2 ? 'md' : 'sm', layout: 'col', sub: seat === 0 ? '' : N === 4 ? (seat === 2 ? t('partner') : t('rival')) : '' });
      const body = vars(h('div', { class: 'g-bisca-ohand', 'aria-hidden': 'true' }), { '--cw': sz.opp + 'px' });
      const el = h('div', { class: `g-bisca-seat ${pos} s${seat}`, dataset: { seat } }, chip, seat === 0 ? null : body);
      seats.push({ el, chip, body });
    }
    const slots = Array.from({ length: N }, (_, i) => h('div', { class: `g-bisca-slot p${i}`, dataset: { seat: i } }));
    const pile = (team) => {
      const stack = vars(h('div', { class: 'g-bisca-pstack' }), { '--cw': Math.round(sz.stack) + 'px' });
      const cnt = h('b', { class: 'g-bisca-pcnt' }, '0');
      const pts_ = h('span', { class: 'g-bisca-ppts' });
      const lab = h('span', { class: 'g-bisca-plab' }, teamLabel(team));
      const el = vars(h('div', { class: `g-bisca-pile t${team}` }, stack, h('div', { class: 'g-bisca-pinfo' }, lab, pts_, h('span', { class: 'g-bisca-pn' }, cnt, ' ', t('tricks').toLowerCase()))), { '--tc': TEAM_COLOR[team] });
      return { el, stack, cnt, pts: pts_ };
    };
    const piles = [pile(0), pile(1)];
    const stockEl = vars(h('div', { class: 'g-bisca-stock', title: t('stock') }), { '--cw': Math.round(sz.stack * 1.3) + 'px' });
    const tool = (ico, label, onclick) => h('button', { type: 'button', class: 'g-bisca-tool', 'aria-label': label, title: label, onclick, html: ICONS[ico] });
    const lastBtn = tool('last', t('lastTrick'), showLastTrick);
    const hintBtn = tool('hint', t('hint'), showHint);
    const soundBtn = tool(settings.sound ? 'soundOn' : 'soundOff', t('sound'), () => { settings.sound = !settings.sound; cs.enabled = settings.sound; saveSettings(); syncSoundBtn(); });
    const hud = { us: h('div', { class: 'g-bisca-team t0' }), them: h('div', { class: 'g-bisca-team t1' }), trump: h('div', { class: 'g-bisca-trump' }) };
    const flashEl = h('div', { class: 'g-bisca-flash', role: 'status', 'aria-live': 'polite' });
    const status = h('div', { class: 'g-bisca-status', role: 'status', 'aria-live': 'polite' });
    const swapBtn = h('button', { type: 'button', class: 'g-bisca-swap', title: t('swapTip'), onclick: onSwapTap, hidden: true }, h('span', { html: ICONS.swap }), t('swap'));
    const handBox = vars(h('div', { class: 'g-bisca-hand' }), { '--hcw': sz.hand + 'px' });
    const felt = h('div', { class: `g-bisca-table n${N}` },
      h('div', { class: 'g-bisca-felt' }),
      h('div', { class: 'g-bisca-tools' }, soundBtn, lastBtn, hintBtn, h('button', { type: 'button', class: 'g-bisca-tool', 'aria-label': t('rules'), title: t('rules'), onclick: openRules, html: ICONS.rules }), h('button', { type: 'button', class: 'g-bisca-tool', 'aria-label': t('options'), title: t('options'), onclick: () => openOptions(true), html: ICONS.gear })),
      stockEl,
      seats.map((s) => s.el),
      vars(h('div', { class: 'g-bisca-trick' }, slots), { '--cw': sz.trick + 'px' }),
      piles[0].el, piles[1].el, flashEl);
    root.append(h('div', { class: 'g-bisca-game' }, h('div', { class: 'g-bisca-hud' }, hud.us, hud.trump, hud.them), felt, h('div', { class: 'g-bisca-act' }, status, swapBtn), handBox));
    refs = { seats, slots, piles, hud, flash: flashEl, status, handBox, lastBtn, hintBtn, soundBtn, swapBtn, stockEl, felt };
    rebuildHand();
  }

  function syncSoundBtn() {
    if (refs) refs.soundBtn.innerHTML = ICONS[settings.sound ? 'soundOn' : 'soundOff'];
  }

  function rebuildHand() {
    if (!refs) return;
    if (hand) hand.destroy();
    const sz = sizes();
    hand = createHand(refs.handBox, {
      cards: [],
      size: sz.hand,
      mode: 'fan',
      arc: true,
      select: settings.oneTap ? 'none' : 'single',
      isPlayable: () => false,
      onActivate: (card) => onHumanCard(card),
      onDisabledTap: (card) => onIllegalTap(card),
      minStep: 0.3,
      lang: ctx.lang,
    });
    if (S) {
      hand.setCards(S.hands[0].map(toCard), { animate: false });
      refreshPlayable();
    }
  }

  // ---------- rendering ----------
  function renderOpp(seat) {
    const body = refs.seats[seat].body;
    const n = S.hands[seat].length;
    body.textContent = '';
    const cw = parseInt(getComputedStyle(body).getPropertyValue('--cw')) || 34;
    const pos = posOf(seat);
    if (pos === 'top') {
      const step = Math.min(cw * 0.5, Math.max(8, (Math.min(220, (sizes().W - 150)) - cw) / Math.max(1, n - 1)));
      const wrap = h('div', { class: 'g-bisca-fan2', style: { width: cw + step * Math.max(0, n - 1) + 'px', height: cw * 1.4 + 'px' } });
      for (let i = 0; i < n; i++) {
        const c = cardEl(null, { size: cw });
        c.removeAttribute('role');
        c.style.position = 'absolute';
        c.style.left = i * step + 'px';
        c.style.top = '0';
        const k = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
        c.style.transform = `rotate(${(k * Math.min(10, n * 2.5)).toFixed(1)}deg) translateY(${(k * k * 3).toFixed(1)}px)`;
        wrap.append(c);
      }
      body.append(wrap, h('b', { class: 'g-bisca-scnt' }, String(n)));
    } else {
      const layers = Math.min(3, n);
      const st = h('div', { class: 'g-bisca-sstack' });
      for (let i = 0; i < layers; i++) {
        const c = cardEl(null, { size: cw });
        c.removeAttribute('role');
        c.style.position = i ? 'absolute' : 'relative';
        c.style.left = '0';
        c.style.top = '0';
        c.style.translate = `${i * 3.5}px ${-i * 2.5}px`;
        st.append(c);
      }
      body.append(st, h('b', { class: 'g-bisca-scnt' }, String(n)));
    }
    body.classList.toggle('is-empty', n === 0);
    body.setAttribute('aria-label', `${seatName(seat)}: ${n}`);
  }

  function renderStock() {
    const el = refs.stockEl;
    el.textContent = '';
    const n = S.stock.length;
    el.classList.toggle('is-empty', n === 0);
    const cw = parseInt(getComputedStyle(el).getPropertyValue('--cw')) || 40;
    if (n === 0) {
      el.append(h('div', { class: 'g-bisca-sempty' }, h('small', null, t('stockEmpty'))));
      return;
    }
    const tr = h('div', { class: 'g-bisca-tr' }, cardEl(toCard(S.trumpCard), { size: cw, highlight: false, label: t('trunfoCard', { card: cname(S.trumpCard) }) }));
    el.append(tr);
    if (n > 1) {
      const stack = h('div', { class: 'g-bisca-sstk' });
      const layers = Math.max(1, Math.min(6, Math.ceil((n - 1) / 6)));
      for (let i = 0; i < layers; i++) {
        const c = cardEl(null, { size: cw });
        c.removeAttribute('role');
        c.style.position = i ? 'absolute' : 'relative';
        c.style.left = '0';
        c.style.top = '0';
        c.style.translate = `${-i * 0.9}px ${-i * 1.2}px`;
        stack.append(c);
      }
      el.append(stack);
    }
    el.append(h('b', { class: 'g-bisca-stcnt' }, String(n)));
    el.setAttribute('aria-label', t('stockCount', { n }));
  }

  function renderPile(team) {
    const p = refs.piles[team];
    const n = teamTricks(team);
    p.cnt.textContent = String(n);
    p.stack.textContent = '';
    const layers = Math.min(4, n);
    if (!n) p.stack.append(h('div', { class: 'g-bisca-pempty' }));
    for (let i = 0; i < layers; i++) {
      const c = cardEl(null, {});
      c.removeAttribute('role');
      c.style.position = i ? 'absolute' : 'relative';
      c.style.left = '0';
      c.style.top = '0';
      c.style.translate = `${-i * 1}px ${-i * 1.6}px`;
      p.stack.append(c);
    }
    p.pts.textContent = settings.showPoints ? t('pts', { n: S.points[team] }) : '';
    p.pts.hidden = !settings.showPoints;
  }

  function updateHud() {
    if (!refs) return;
    const { hud } = refs;
    const m = S.opts.match;
    const pips = (team) => {
      if (m === 'single') return '';
      const target = m === 'bo3' ? 2 : 4;
      const n = m === 'bo3' ? S.wins[team] : S.scores[team];
      const row = h('span', { class: 'g-bisca-pips', 'aria-label': `${m === 'bo3' ? t('handsWon') : t('gamePoints')}: ${n}` });
      for (let i = 0; i < target; i++) row.append(h('i', { class: i < n ? 'on' : '' }));
      return row;
    };
    const block = (el, team) => {
      clear(el);
      el.style.setProperty('--tc', TEAM_COLOR[team]);
      el.append(h('b', { class: 'g-bisca-tname' }, teamLabel(team)), pips(team), h('span', { class: 'g-bisca-tsub' }, settings.showPoints ? t('pts', { n: S.points[team] }) : `${t('tricks')} ${teamTricks(team)}`));
    };
    block(hud.us, 0);
    block(hud.them, 1);
    clear(hud.trump);
    hud.trump.append(h('span', { class: `g-bisca-tglyph s${S.trump}` }, SUIT_SYM[S.trump]), h('small', null, t('trunfo')));
    hud.trump.setAttribute('aria-label', t('trunfoCard', { card: suitLabel(S.trump) }));
    renderStock();
    for (const team of [0, 1]) renderPile(team);
  }

  function renderSeatsMeta() {
    for (let seat = 0; seat < N; seat++) {
      refs.seats[seat].chip.update({ role: seat === S.dealer ? 'dealer' : '' });
      refs.seats[seat].chip.title = seat === S.dealer ? t('dealerTip') : '';
      if (seat) renderOpp(seat);
    }
  }

  function setTurnUI() {
    if (!refs) return;
    refs.seats.forEach((s, i) => s.chip.update({ active: S.phase === 'play' && S.turn === i }));
    const mine = S.phase === 'play' && S.turn === 0 && S.trick.length < S.n;
    refs.hintBtn.disabled = !mine;
    refs.swapBtn.hidden = !(mine && R.canSwap(S, 0));
    if (S.phase !== 'play' || S.trick.length === S.n) {
      refs.status.textContent = '';
    } else if (S.turn === 0) {
      refs.status.textContent = S.trick.length === 0 ? t('toLead') : t('yourTurn');
      refs.status.className = 'g-bisca-status mine';
    } else {
      refs.status.textContent = t('waiting', { name: seatName(S.turn) });
      refs.status.className = 'g-bisca-status';
    }
  }

  function placeTrickCard(seat, c) {
    const slot = refs.slots[seat];
    slot.textContent = '';
    const el = cardEl(toCard(c), { size: sizes().trick, label: `${seatName(seat)}: ${cname(c)}` });
    el.removeAttribute('role');
    el.style.transform = `rotate(${(((c * 7 + seat * 3) % 9) - 4) * 1.4}deg)`;
    slot.append(el);
    return el;
  }

  function renderBoardInstant() {
    for (const s of refs.slots) s.textContent = '';
    for (const x of S.trick) placeTrickCard(x.p, x.c);
    hand.setCards(S.hands[0].map(toCard), { animate: false });
    renderSeatsMeta();
    updateHud();
    setTurnUI();
    refreshPlayable();
  }

  function refreshPlayable() {
    if (!hand) return;
    const mine = S && S.phase === 'play' && S.turn === 0 && S.trick.length < S.n;
    const legal = mine ? new Set(R.legalCards(S, 0).map((c) => toCard(c).id)) : null;
    hand.setPlayable(mine ? (card) => legal.has(card.id) : () => false);
    refs.handBox.classList.toggle('is-waiting', !mine);
  }

  // ---------- human input ----------
  function onIllegalTap(card) {
    if (!(S && S.phase === 'play' && S.turn === 0 && S.trick.length)) return;
    cs.error();
    flash(t('mustFollow', { suit: suitLabel(suitOf(S.trick[0].c)) }), 'warn');
    const el = hand.cardEl(card.id);
    if (el) anim.shake(el, 5);
  }
  function onHumanCard(card) {
    if (!humanResolve) return;
    const res = humanResolve;
    humanResolve = null;
    res({ type: 'play', c: fromId(card.id) });
  }
  function onSwapTap() {
    if (!humanResolve || !R.canSwap(S, 0)) return;
    const res = humanResolve;
    humanResolve = null;
    res({ type: 'swap' });
  }
  function showHint() {
    if (!(S && S.phase === 'play' && S.turn === 0 && S.trick.length < S.n)) return;
    const v = R.viewFor(S, 0);
    if (wantsSwap(v) && R.canSwap(S, 0)) {
      flash(t('swapTip'));
      refs.swapBtn.classList.add('hl');
      later(() => refs.swapBtn.classList.remove('hl'), 2200);
      return;
    }
    const c = chooseCard(v);
    const el = hand.cardEl(toCard(c).id);
    if (!el) return;
    cs.select();
    el.classList.add('is-hl');
    flash(t('hintOn', { card: cname(c) }));
    clearTimeout(hintTimer);
    hintTimer = later(() => el.classList.remove('is-hl'), 2600);
  }

  // ---------- last trick ----------
  function showLastTrick() {
    const last = S && S.tricks[S.tricks.length - 1];
    if (!last) {
      flash(t('noLastTrick'));
      return;
    }
    const sz = sizes();
    const cw = Math.round(Math.min(sz.hand * 0.9, (sz.W - 100) / (N === 4 ? 4.4 : 3)));
    const grid = vars(h('div', { class: 'g-bisca-lt' }, last.plays.map((x) => h('div', { class: `g-bisca-ltc${x.p === last.winner ? ' win' : ''}` }, cardEl(toCard(x.c), { size: cw, highlight: x.p === last.winner }), h('small', null, seatName(x.p))))), { '--cw': cw + 'px' });
    modal({ root, title: t('lastTrick'), body: h('div', null, grid, h('p', { class: 'g-bisca-ltsum' }, t('wonTrick', { name: seatName(last.winner) }), ` · ${t('pts', { n: last.points })}`)), actions: [{ label: t('close'), value: true, primary: true }], dismissible: true, lang: ctx.lang });
  }

  // ---------- main flow ----------
  async function enterGame(deal) {
    runId++;
    const id = runId;
    screen = 'game';
    N = S.n;
    buildTable();
    renderBoardInstant();
    if (deal) await dealAnimation(id);
    else if (S.tricks.length + S.trick.length > 0) flash(t('resumed'));
    if (!alive(id)) return;
    loop(id);
  }

  async function dealAnimation(id) {
    renderBoardInstant();
    if (reduced()) return;
    cs.shuffle();
    const fe = refs.felt.getBoundingClientRect();
    const from = { left: fe.left + fe.width / 2 - 10, top: fe.top + fe.height / 2 - 14, width: 20, height: 28 };
    const els = hand.getCards().map((c) => hand.cardEl(c.id));
    const ps = els.map((el, i) => anim.flyCard(el, from, null, { duration: 380, delay: 150 + i * 90, faceDownFrom: true, arc: 30 }));
    els.forEach((_, i) => later(() => cs.deal(), (150 + i * 90) / motion.speed));
    refs.seats.forEach((s, i) => { if (i && s.body.animate) s.body.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420 / motion.speed, delay: 120 / motion.speed, fill: 'backwards' }); });
    refs.stockEl.animate?.([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420 / motion.speed, delay: 500 / motion.speed, fill: 'backwards' });
    await Promise.all(ps);
    await sleep(250);
    if (!alive(id)) return;
    const tr = refs.stockEl.querySelector('.g-bisca-tr .dc');
    if (tr) { anim.flip(tr, false); cs.flip(); }
  }

  async function loop(id) {
    while (alive(id)) {
      if (S.phase === 'roundEnd' || S.phase === 'matchEnd') {
        await finishRound(id);
        continue;
      }
      if (S.trick.length === S.n) {
        await resolveTrickUI(id);
        continue;
      }
      const seat = S.turn;
      setTurnUI();
      refreshPlayable();
      let act;
      if (seat === 0) {
        const legal = R.legalCards(S, 0);
        if (legal.length === 1 && !R.canSwap(S, 0) && S.hands[0].length === 1) act = { type: 'play', c: legal[0] };
        else {
          cs.turn();
          act = await new Promise((res) => { humanResolve = res; });
          if (!alive(id)) return;
        }
      } else {
        await sleep(520 + ((S.tricks.length * 37 + seat * 91) % 5) * 90);
        if (!alive(id)) return;
        act = chooseAction(R.viewFor(S, seat));
      }
      if (act.type === 'swap') await swapUI(id, seat);
      else await playUI(id, seat, act.c);
    }
  }

  async function swapUI(id, seat) {
    const before = S.trumpCard;
    const res = R.swapSeven(S, seat);
    persist();
    cs.flip();
    hand.setCards(S.hands[0].map(toCard), { animate: true });
    renderStock();
    flash(t('swapDone', { name: seatName(seat), card: cname(before) }));
    const tr = refs.stockEl.querySelector('.g-bisca-tr .dc');
    if (tr) anim.pulse(tr, 1.18);
    setTurnUI();
    refreshPlayable();
    await sleep(700);
  }

  async function playUI(id, seat, c) {
    const cid = toCard(c).id;
    let fromRect;
    if (seat === 0) {
      fromRect = hand.rectOf(cid);
      hand.clearSelection();
    } else fromRect = refs.seats[seat].body.getBoundingClientRect();
    R.playCard(S, seat, c);
    persist();
    if (seat === 0) hand.remove(cid);
    else renderOpp(seat);
    refs.handBox.classList.add('is-waiting');
    hand.setPlayable(() => false);
    const el = placeTrickCard(seat, c);
    cs.place();
    setTurnUI();
    await anim.flyCard(el, fromRect, null, { duration: 380, faceDownFrom: seat !== 0, arc: seat === 0 ? 24 : 14 });
  }

  async function resolveTrickUI(id) {
    await sleep(850);
    if (!alive(id)) return;
    const winner = R.trickWinner(S.trick, S.trump);
    const winEl = refs.slots[winner].firstChild;
    const trickPts = S.trick.reduce((a, x) => a + pts(x.c), 0);
    if (winEl) winEl.classList.add('is-hl');
    const mine = R.teamOf(winner) === 0;
    flash(`${mine ? t('wonTrickUs') : t('wonTrickThem')}${trickPts ? ` · ${t('pts', { n: trickPts })}` : ''}`, mine ? 'us' : 'them');
    refs.seats.forEach((s, i) => s.chip.update({ active: i === winner }));
    refs.status.textContent = '';
    await sleep(650);
    if (!alive(id)) return;
    const team = R.teamOf(winner);
    const cards = refs.slots.map((s) => s.firstChild).filter(Boolean);
    cs.slide();
    const res = R.resolveTrick(S);
    persist();
    cards.forEach((c) => c.classList.remove('is-hl'));
    await anim.collect(cards, refs.piles[team].stack, { remove: true, duration: 420, stagger: 45 });
    if (!alive(id)) return;
    for (const s of refs.slots) s.textContent = '';
    renderPile(team);
    updateHudLight();
    if (trickPts >= 10 && mine && !reduced()) anim.pulse(refs.piles[0].el, 1.12);
    if (res.draws.length) await drawUI(id, res.draws);
    if (!alive(id)) return;
    updateHud();
    setTurnUI();
  }
  function updateHudLight() {
    // cheap refresh of counters while draws are still animating
    for (const team of [0, 1]) renderPile(team);
  }

  async function drawUI(id, draws) {
    const stockRect = refs.stockEl.getBoundingClientRect();
    const ps = [];
    // render hands with the new cards, then fly them out of the stock
    draws.forEach((d, i) => {
      if (d.p === 0) {
        const el = hand.add(toCard(d.c));
        ps.push(anim.flyCard(el, stockRect, null, { duration: 420, delay: i * 160, faceDownFrom: true, arc: 20 }));
      }
    });
    for (const seat of new Set(draws.filter((d) => d.p !== 0).map((d) => d.p))) {
      renderOpp(seat);
      const cards = [...refs.seats[seat].body.querySelectorAll('.dc')];
      draws.forEach((d, i) => {
        if (d.p === seat) {
          const idx = cards.length - 1 - draws.filter((x, j) => x.p === seat && j > i).length;
          const el = cards[Math.max(0, idx)];
          if (el) ps.push(anim.flyCard(el, stockRect, null, { duration: 420, delay: i * 160, arc: 20 }));
        }
      });
    }
    for (let i = 0; i < draws.length; i++) later(() => cs.deal(), (i * 160) / motion.speed);
    renderStock();
    await Promise.all(ps);
    hand.setCards(S.hands[0].map(toCard), { animate: false });
  }

  // ---------- round / match end ----------
  const kindLabel = (k) => t({ normal: 'kindNormal', double: 'kindDouble', capote: 'kindCapote', draw: 'kindDraw' }[k]);
  const pipsRow = (team, n, target) => {
    const row = vars(h('span', { class: 'g-bisca-pips big' }), { '--tc': TEAM_COLOR[team] });
    for (let i = 0; i < target; i++) row.append(h('i', { class: i < n ? 'on' : '' }));
    return row;
  };

  function roundBody(rd) {
    const [a, b] = rd.points;
    const res = rd.result;
    const sub = res.team < 0 ? t('roundDrawSub') : `${kindLabel(res.kind)} · ${teamLabel(res.team)}: ${res.pontos === 1 ? t('pontosWon1') : t('pontosWon', { n: res.pontos })}`;
    const bar = h('div', { class: 'g-bisca-bar', role: 'img', 'aria-label': `${teamLabel(0)} ${a}, ${teamLabel(1)} ${b}` },
      h('i', { class: 't0', style: { width: (a / 120) * 100 + '%' } }),
      h('i', { class: 't1', style: { width: (b / 120) * 100 + '%' } }),
      h('em', { class: 'mid' }, h('span', null, '60')));
    const m = S.opts.match;
    const tw = [teamTricks(0), teamTricks(1)];
    return h('div', { class: `g-bisca-rbody ${res.team === 0 ? 'win' : res.team === 1 ? 'loss' : 'draw'}` },
      h('p', { class: 'g-bisca-rsub' }, sub),
      h('div', { class: 'g-bisca-rscore' }, h('div', { class: 't0' }, h('small', null, teamLabel(0)), h('b', null, String(a))), h('div', { class: 'vs' }, '×'), h('div', { class: 't1' }, h('small', null, teamLabel(1)), h('b', null, String(b)))),
      bar,
      h('div', { class: 'g-bisca-rrow' }, h('span', null, t('cardPoints')), h('b', null, `${a} – ${b}`)),
      h('div', { class: 'g-bisca-rrow' }, h('span', null, t('tricksTaken')), h('b', null, `${tw[0]} – ${tw[1]}`)),
      m === 'single' ? null : h('div', { class: 'g-bisca-rtotal' }, h('small', null, m === 'bo3' ? t('handsWon') : t('gamePoints')), h('div', null, pipsRow(0, m === 'bo3' ? rd.wins[0] : rd.scores[0], m === 'bo3' ? 2 : 4), h('span', { class: 'vs' }, m === 'bo3' ? `${rd.wins[0]} × ${rd.wins[1]}` : `${rd.scores[0]} × ${rd.scores[1]}`), pipsRow(1, m === 'bo3' ? rd.wins[1] : rd.scores[1], m === 'bo3' ? 2 : 4))),
    );
  }

  function countRound(rd) {
    if (rd.counted) return;
    rd.counted = true;
    const ex = extra();
    ex.rounds++;
    if (rd.result.team === 0) {
      ex.roundsWon++;
      if (rd.result.kind === 'capote') ex.capotes++;
    }
    ex.bestRound = Math.max(ex.bestRound, rd.points[0]);
    store.set('extra', ex);
    persist();
  }

  async function finishRound(id) {
    const rd = S.lastRound;
    const over = S.phase === 'matchEnd';
    countRound(rd);
    const outcome = rd.result.team < 0 ? 'draw' : rd.result.team === 0 ? 'win' : 'lose';
    const title = outcome === 'win' ? t('roundWin') : outcome === 'lose' ? t('roundLoss') : t('roundDraw');
    if (!over) {
      if (outcome === 'win') cs.win(); else if (outcome === 'lose') cs.lose();
      await sleep(500);
      if (!alive(id)) return;
      await modal({ root, title, body: roundBody(rd), actions: [{ label: t('nextRound'), value: true, primary: true }], className: `g-bisca-rmodal is-${outcome}`, lang: ctx.lang });
      if (!alive(id)) return;
      R.nextRound(S);
      persist();
      renderBoardInstant();
      await dealAnimation(id);
      return;
    }
    await sleep(400);
    if (!alive(id)) return;
    await modal({ root, title, body: roundBody(rd), actions: [{ label: t('finalScore'), value: true, primary: true }], className: `g-bisca-rmodal is-${outcome}`, lang: ctx.lang });
    if (!alive(id)) return;
    const win = R.matchWinner(S);
    const result = win === 0 ? 'win' : win === 1 ? 'loss' : 'draw';
    const m = S.opts.match;
    const label = m === 'single' ? `${rd.points[0]} × ${rd.points[1]}` : m === 'bo3' ? `${S.wins[0]} × ${S.wins[1]}` : `${S.scores[0]} × ${S.scores[1]}`;
    if (!S.recorded) {
      S.recorded = true;
      stats.record({ result, score: rd.points[0], team: S.n === 4, nine: S.opts.handSize === 9, label });
      const base = m === 'single' ? 6 : 18;
      ctx.addXP?.(result === 'win' ? base : result === 'draw' ? Math.round(base / 2) : Math.round(base / 3));
      persist();
    }
    if (result === 'win') cs.win(); else if (result === 'loss') cs.lose();
    const st = stats.get();
    const team = S.n === 4;
    const v = await resultModal({
      root,
      outcome: result === 'win' ? 'win' : result === 'loss' ? 'lose' : 'draw',
      title: result === 'win' ? t('matchWin') : result === 'loss' ? t('matchLoss') : t('matchDraw'),
      subtitle: result === 'win' ? t(team ? 'matchWinSubTeam' : 'matchWinSub') : result === 'loss' ? t(team ? 'matchLossSubTeam' : 'matchLossSub') : t('matchDrawSub'),
      stats: [{ label: m === 'single' ? t('cardPoints') : t('matchScore'), value: m === 'single' ? `${rd.points[0]} – ${rd.points[1]}` : label }, { label: t('statWins'), value: st.wins }, { label: t('statStreak'), value: Math.max(0, st.bestStreak) }],
      actions: [{ label: t('menu'), value: 'menu' }, { label: t('rematch'), value: 'again', primary: true }],
      lang: ctx.lang,
    });
    if (!alive(id)) return;
    const o = { ...S.opts };
    save.clear();
    if (v === 'again') {
      S = R.newMatch(o, randomSeed());
      persist();
      enterGame(true);
    } else showMenu();
  }

  // ---------- back button ----------
  ctx.onBack(() => {
    if (screen === 'game') {
      const running = S && S.phase !== 'matchEnd';
      if (!running) {
        showMenu();
        return true;
      }
      modal({ root, title: t('confirmLeaveTitle'), body: t('confirmLeaveBody'), actions: [{ label: t('stay'), value: false, primary: true }, { label: t('leave'), value: true }], dismissible: true, lang: ctx.lang }).then((v) => {
        if (v) {
          persist();
          showMenu();
        }
      });
      return true;
    }
    if (screen === 'stats') {
      showMenu();
      return true;
    }
    return false;
  });

  const onResize = () => {
    if (screen !== 'game' || !refs) return;
    const sz = sizes();
    refs.handBox.style.setProperty('--hcw', sz.hand + 'px');
    hand.setSize(sz.hand);
  };
  window.addEventListener('resize', onResize);

  // ---------- start ----------
  if (ctx.mode === 'solo' || ctx.mode === 'team') {
    const saved = save.load();
    if (saved && saved.phase !== 'matchEnd') {
      showMenu();
      modal({ root, title: t('continue'), body: t('continueInfo', { mode: saved.n === 4 ? t('team') : t('solo'), score: scoreLabel(saved) }), actions: [{ label: t('abandonTitle'), value: 'new' }, { label: t('continue'), value: 'resume', primary: true }], lang: ctx.lang }).then((v) => {
        if (disposed) return;
        if (v === 'resume') resumeSaved();
        else { save.clear(); newGame(ctx.mode); }
      });
    } else newGame(ctx.mode);
  } else showMenu();

  return () => {
    disposed = true;
    runId++;
    window.removeEventListener('resize', onResize);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    anim.dispose();
    if (hand) hand.destroy();
    motion.speed = prevSpeed;
    ctx.setHeaderRight(null);
  };
}
