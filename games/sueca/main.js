// Sueca — 4 players, 2 teams (you + partner vs two computer opponents), 40-card Portuguese deck.
//   Menu → match (first to 4 jogos) or a single hand → round summary → final result.
//   Modes (ctx.mode): match, round. The rules live in rules.js (pure, tested), the computer players in ai.js.
//   Matches autosave to ctx.store after every card and resume with the same seeded RNG state.
import STRINGS from './strings.js';
import * as R from './rules.js';
import { chooseCard } from './ai.js';
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
const AVATARS = [0, 3, 6, 9]; // seat → avatar id
const NAMES = ['', 'Tiago', 'Marta', 'Inês'];
const SEAT_KEY = ['you', 'seatRight', 'partner', 'seatLeft'];
const TEAM_COLOR = ['#f3c24a', '#6fb2ff'];

const ICON = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
const ICONS = {
  last: ICON('<rect x="3.5" y="6" width="10" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10.5" y="4" width="10" height="14" rx="2" fill="#0d0e12" stroke="currentColor" stroke-width="2"/>'),
  hint: ICON('<path d="M12 3.2a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.1V17h5v-.9c0-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3.2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.8 20.2h4.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOn: ICON('<path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5Z" fill="currentColor"/><path d="M15.2 9a4.2 4.2 0 0 1 0 6M17.6 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOff: ICON('<path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5Z" fill="currentColor"/><path d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  rules: ICON('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>'),
  gear: ICON('<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  stats: ICON('<path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  play: ICON('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
  resume: ICON('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  one: ICON('<path d="M9 7.5 12.5 5v14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  trophy: ICON('<path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.500 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.500M12 14v4M8.500 20h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
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
  const save = createMatchSave(store, 'match', { version: 1, validate: (s) => s && s.v === 1 && Array.isArray(s.hands) && s.hands.length === 4 });
  const stats = createStats(store, 'stats', { historyMax: 12 });
  const prevSpeed = motion.speed;

  const settings = { showPoints: false, oneTap: false, fast: false, sound: true, ...(store.get('settings', {}) || {}) };
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

  // ---------- state ----------
  let S = null; // engine state
  let screen = 'menu';
  let refs = null; // table DOM refs
  let hand = null;
  let humanResolve = null;
  let hintTimer = 0;

  const alive = (id) => !disposed && id === runId;

  // ---------- helpers ----------
  const flash = (text, tone = '') => {
    if (!refs) return;
    const el = refs.flash;
    el.textContent = text;
    el.className = 'g-sueca-flash show ' + tone;
    clearTimeout(el._t);
    el._t = later(() => el.classList.remove('show'), 1500);
  };
  const seatName = (seat) => (seat === 0 ? t('you') : NAMES[seat]);
  const teamTricks = (team) => S.tricks.filter((x) => R.teamOf(x.winner) === team).length;
  const suitLabel = (s) => `${SUIT_SYM[s]} ${t(SUIT_KEY[s])}`;
  const cname = (c) => cardName(toCard(c), ctx.lang);

  function persist() {
    if (S) save.save(S);
  }

  // ---------- menu ----------
  function showMenu() {
    runId++;
    screen = 'menu';
    teardownTable();
    ctx.setHeaderRight(null);
    clear(root);
    const saved = save.load();
    const fan = h('div', { class: 'g-sueca-fan', 'aria-hidden': 'true' }, [
      ['A', 's', -18], ['7', 'h', -6], ['K', 'd', 6], ['J', 'c', 18],
    ].map(([r, s, rot]) => {
      const el = cardEl({ r, s, id: r + s }, { size: 74 });
      el.style.transform = `rotate(${rot}deg) translateY(${Math.abs(rot) * 0.5}px)`;
      return el;
    }));
    const btn = (label, sub, ico, onclick, cls = '') =>
      h('button', { class: `g-sueca-mbtn ${cls}`, type: 'button', onclick }, h('span', { class: 'g-sueca-mico', html: ICONS[ico] }), h('span', { class: 'g-sueca-mtx' }, h('b', null, label), sub ? h('small', null, sub) : null));
    const menu = h('div', { class: 'g-sueca-menu' },
      fan,
      h('h1', { class: 'g-sueca-title' }, t('name')),
      h('p', { class: 'g-sueca-tag' }, t('menuHint')),
      h('div', { class: 'g-sueca-mlist' },
        saved ? btn(t('continue'), t('continueInfo', { round: saved.round + 1, us: saved.jogos[0], them: saved.jogos[1] }), 'resume', () => resumeSaved(), 'primary') : null,
        btn(t('newMatch'), t('newMatchSub'), 'trophy', () => newGame({ single: false }), saved ? '' : 'primary'),
        btn(t('single'), t('singleSub'), 'one', () => newGame({ single: true })),
      ),
      h('div', { class: 'g-sueca-mlinks' },
        h('button', { type: 'button', class: 'g-sueca-link', onclick: showStats }, h('span', { html: ICONS.stats }), t('stats')),
        h('button', { type: 'button', class: 'g-sueca-link', onclick: openRules }, h('span', { html: ICONS.rules }), t('rules')),
        h('button', { type: 'button', class: 'g-sueca-link', onclick: openOptions }, h('span', { html: ICONS.gear }), t('options')),
      ),
    );
    root.append(menu);
  }

  // ---------- stats ----------
  const extra = () => ({ rounds: 0, roundsWon: 0, bandeiras: 0, capotes: 0, bestRound: 0, ...(store.get('extra', {}) || {}) });
  function showStats() {
    screen = 'stats';
    clear(root);
    const st = stats.get();
    const ex = extra();
    const tile = (label, value) => h('div', { class: 'g-sueca-tile' }, h('b', null, String(value)), h('span', null, label));
    const rate = st.games ? Math.round((st.wins / st.games) * 100) + '%' : '–';
    const recent = st.history.slice().reverse().map((e) =>
      h('li', { class: `g-sueca-hrow is-${e.result}` },
        h('span', { class: 'g-sueca-hres' }, e.result === 'win' ? t('resultWin') : e.result === 'loss' ? t('resultLoss') : t('resultDraw')),
        h('span', null, e.single ? t('single') : t('newMatch')),
        h('b', null, e.single ? `${e.pts?.[0] ?? 0} × ${e.pts?.[1] ?? 0}` : `${e.jogos?.[0] ?? 0} × ${e.jogos?.[1] ?? 0}`)));
    root.append(h('div', { class: 'g-sueca-page' },
      h('header', { class: 'g-sueca-pagehead' }, h('h2', null, t('statsTitle'))),
      h('div', { class: 'g-sueca-tiles' }, tile(t('statGames'), st.games), tile(t('statWins'), st.wins), tile(t('statLosses'), st.losses), tile(t('statRate'), rate), tile(t('statStreak'), Math.max(0, st.bestStreak)), tile(t('statRounds'), ex.roundsWon), tile(t('statBandeiras'), ex.bandeiras), tile(t('statCapotes'), ex.capotes), tile(t('statBestRound'), ex.bestRound)),
      h('h3', { class: 'g-sueca-sub' }, t('statRecent')),
      recent.length ? h('ul', { class: 'g-sueca-hist' }, recent) : h('p', { class: 'g-sueca-muted' }, t('statNone')),
      h('div', { class: 'g-sueca-pagebtns' },
        h('button', { type: 'button', class: 'g-sueca-pbtn', onclick: showMenu }, t('back')),
        st.games ? h('button', { type: 'button', class: 'g-sueca-pbtn danger', onclick: async () => { if (await modal({ root, title: t('reset'), body: t('resetBody'), actions: [{ label: t('no'), value: false }, { label: t('yes'), value: true, danger: true }], lang: ctx.lang })) { stats.reset(); store.remove('extra'); showStats(); } } }, t('reset')) : null)));
  }

  // ---------- rules / options ----------
  function openRules() {
    rulesModal({
      root,
      title: t('rulesTitle'),
      sections: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ title: t(`r${i}h`), text: t(`r${i}`) })),
      closeLabel: t('close'),
      lang: ctx.lang,
    });
  }
  function openOptions() {
    const toggle = (key, label, sub, onChange) => {
      const input = h('input', { type: 'checkbox', checked: settings[key] ? true : null, onchange: () => { settings[key] = input.checked; saveSettings(); onChange && onChange(); } });
      return h('label', { class: 'g-sueca-opt' }, h('span', { class: 'g-sueca-opt-tx' }, h('b', null, label), sub ? h('small', null, sub) : null), input, h('i', { class: 'g-sueca-sw' }));
    };
    modal({
      root,
      title: t('optionsTitle'),
      body: h('div', { class: 'g-sueca-opts' },
        toggle('sound', t('sound'), null, () => { cs.enabled = settings.sound; syncSoundBtn(); }),
        toggle('showPoints', t('showPoints'), t('showPointsSub'), () => updateHud()),
        toggle('oneTap', t('oneTapLabel'), t('oneTapSub'), () => rebuildHand()),
        toggle('fast', t('fastAnim'), null, () => { motion.speed = settings.fast ? 2 : 1; })),
      actions: [{ label: t('close'), value: true, primary: true }],
      dismissible: true,
      lang: ctx.lang,
    });
  }

  // ---------- game start / resume ----------
  function newGame(opts) {
    const begin = () => {
      S = R.newMatch({ single: opts.single }, randomSeed());
      S.opts.fresh = true;
      save.clear();
      persist();
      enterGame(true);
    };
    if (save.exists()) {
      modal({ root, title: t('newMatch'), body: t('abandonBody'), actions: [{ label: t('no'), value: false }, { label: t('yes'), value: true, danger: true }], dismissible: true, lang: ctx.lang }).then((v) => v && begin());
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
    const hand = Math.max(50, Math.min(Math.floor((W - 18) / 5.5), 84, Math.floor(Hh / 8)));
    return { hand, trick: Math.round(hand * 0.8), stack: Math.round(hand * 0.5), W, H: Hh };
  }

  function buildTable() {
    clear(root);
    const sz = sizes();
    const seatEl = (seat) => {
      const chip = playerChip({ name: seatName(seat), avatar: AVATARS[seat], color: TEAM_COLOR[R.teamOf(seat)], size: seat === 2 ? 'md' : 'sm', layout: 'col', sub: seat === 0 ? '' : t(SEAT_KEY[seat]) });
      const stack = h('div', { class: 'g-sueca-stack', style: { '--cw': sz.stack + 'px' }, 'aria-hidden': 'true' });
      const tcard = h('div', { class: 'g-sueca-tcard', title: t('trunfo') });
      const el = h('div', { class: `g-sueca-seat s${seat}`, dataset: { seat } }, chip, seat === 0 ? null : stack, tcard);
      return { el, chip, stack, tcard };
    };
    const seats = [0, 1, 2, 3].map(seatEl);
    const slots = [0, 1, 2, 3].map((i) => h('div', { class: `g-sueca-slot p${i}`, dataset: { seat: i } }));
    const pile = (team) => {
      const stack = h('div', { class: 'g-sueca-pstack', style: { '--cw': Math.round(sz.stack * 0.9) + 'px' } });
      const cnt = h('b', { class: 'g-sueca-pcnt' }, '0');
      const lab = h('span', { class: 'g-sueca-plab' }, t(team === 0 ? 'us' : 'them'));
      const pts_ = h('span', { class: 'g-sueca-ppts' });
      return { el: h('div', { class: `g-sueca-pile t${team}`, style: { '--tc': TEAM_COLOR[team] } }, stack, h('div', { class: 'g-sueca-pinfo' }, lab, h('span', { class: 'g-sueca-pn' }, cnt, ' ', t('tricks').toLowerCase()), pts_)), stack, cnt, pts_ };
    };
    const piles = [pile(0), pile(1)];
    const tool = (ico, label, onclick) => h('button', { type: 'button', class: 'g-sueca-tool', 'aria-label': label, title: label, onclick, html: ICONS[ico] });
    const lastBtn = tool('last', t('lastTrick'), showLastTrick);
    const hintBtn = tool('hint', t('hint'), showHint);
    const soundBtn = tool(settings.sound ? 'soundOn' : 'soundOff', t('sound'), () => { settings.sound = !settings.sound; cs.enabled = settings.sound; saveSettings(); syncSoundBtn(); });
    const optBtn = tool('gear', t('options'), openOptions);
    const rulesBtn = tool('rules', t('rules'), openRules);
    const hud = {
      us: h('div', { class: 'g-sueca-team t0' }),
      them: h('div', { class: 'g-sueca-team t1' }),
      trump: h('div', { class: 'g-sueca-trump' }),
      round: h('div', { class: 'g-sueca-round' }),
    };
    const flashEl = h('div', { class: 'g-sueca-flash', role: 'status', 'aria-live': 'polite' });
    const status = h('div', { class: 'g-sueca-status', role: 'status', 'aria-live': 'polite' });
    const handBox = h('div', { class: 'g-sueca-hand', style: { '--hcw': sz.hand + 'px' } });
    const felt = h('div', { class: 'g-sueca-table' },
      h('div', { class: 'g-sueca-felt' }),
      h('div', { class: 'g-sueca-tools l' }, lastBtn, hintBtn),
      h('div', { class: 'g-sueca-tools r' }, soundBtn, rulesBtn, optBtn),
      seats.map((s) => s.el),
      h('div', { class: 'g-sueca-trick', style: { '--cw': sz.trick + 'px' } }, slots),
      piles[0].el, piles[1].el, flashEl);
    const game = h('div', { class: 'g-sueca-game' }, h('div', { class: 'g-sueca-hud' }, hud.us, hud.trump, hud.them), felt, status, handBox);
    root.append(game);
    refs = { game, seats, slots, piles, hud, flash: flashEl, status, handBox, lastBtn, hintBtn, soundBtn, felt };
    ctx.setHeaderRight(null);
    rebuildHand();
  }

  function syncSoundBtn() {
    if (!refs) return;
    refs.soundBtn.innerHTML = ICONS[settings.sound ? 'soundOn' : 'soundOff'];
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
      lang: ctx.lang,
    });
    if (S) {
      hand.setCards(S.hands[0].map(toCard), { animate: false });
      refreshPlayable();
    }
  }

  // ---------- rendering ----------
  function renderStack(seat) {
    const st = refs.seats[seat].stack;
    const n = S.hands[seat].length;
    st.textContent = '';
    const layers = Math.min(3, n);
    for (let i = 0; i < layers; i++) {
      const c = cardEl(null, { size: parseInt(getComputedStyle(st).getPropertyValue('--cw')) || 30 });
      c.removeAttribute('role');
      c.style.position = i ? 'absolute' : 'relative';
      c.style.left = '0';
      c.style.top = '0';
      c.style.translate = `${i * 3.5}px ${-i * 2.5}px`;
      st.append(c);
    }
    st.append(h('b', { class: 'g-sueca-scnt' }, String(n)));
    st.classList.toggle('is-empty', n === 0);
    st.setAttribute('aria-label', `${seatName(seat)}: ${n}`);
  }

  function renderPile(team) {
    const p = refs.piles[team];
    const n = teamTricks(team);
    p.cnt.textContent = String(n);
    p.stack.textContent = '';
    const layers = Math.min(4, n);
    if (!n) p.stack.append(h('div', { class: 'g-sueca-pempty' }));
    for (let i = 0; i < layers; i++) {
      const c = cardEl(null, {});
      c.removeAttribute('role');
      c.style.position = i ? 'absolute' : 'relative';
      c.style.left = '0';
      c.style.top = '0';
      c.style.translate = `${-i * 1}px ${-i * 1.6}px`;
      p.stack.append(c);
    }
    p.pts.textContent = settings.showPoints ? t('pointsInTrick', { n: S.points[team] }) : '';
    p.pts.hidden = !settings.showPoints;
  }

  function updateHud() {
    if (!refs) return;
    const { hud } = refs;
    const pips = (team) => {
      if (S.opts.single) return null;
      const target = S.opts.target;
      const row = h('span', { class: 'g-sueca-pips', 'aria-label': `${t('jogos')}: ${S.jogos[team]}` });
      for (let i = 0; i < target; i++) row.append(h('i', { class: i < S.jogos[team] ? 'on' : '' }));
      return row;
    };
    const teamBlock = (el, team) => {
      clear(el);
      el.style.setProperty('--tc', TEAM_COLOR[team]);
      el.append(h('b', { class: 'g-sueca-tname' }, t(team === 0 ? 'us' : 'them')), pips(team), h('span', { class: 'g-sueca-tsub' }, `${t('tricks')} ${teamTricks(team)}`, settings.showPoints ? ` · ${S.points[team]} ${t('points').toLowerCase()}` : ''));
    };
    teamBlock(hud.us, 0);
    teamBlock(hud.them, 1);
    clear(hud.trump);
    hud.trump.dataset.suit = String(S.trump);
    hud.trump.append(h('span', { class: `g-sueca-tglyph s${S.trump}` }, SUIT_SYM[S.trump]), h('small', null, t('trunfo')));
    hud.trump.setAttribute('aria-label', t('trunfoCard', { card: suitLabel(S.trump) }));
    hud.round.textContent = t('round', { n: S.round + 1 });
    for (const team of [0, 1]) renderPile(team);
  }

  function renderSeatsMeta() {
    for (let seat = 0; seat < 4; seat++) {
      const sr = refs.seats[seat];
      sr.chip.update({ role: seat === S.dealer ? 'dealer' : '' });
      sr.chip.title = seat === S.dealer ? t('dealerTip') : '';
      sr.tcard.textContent = '';
      sr.tcard.classList.toggle('on', seat === S.dealer);
      if (seat === S.dealer) {
        const played = S.tricks.some((tr) => tr.plays.some((x) => x.c === S.trumpCard)) || S.trick.some((x) => x.c === S.trumpCard);
        if (!played) {
          const c = cardEl(toCard(S.trumpCard), { size: Math.round(sizes().stack * 0.95), highlight: true, label: t('trunfoCard', { card: cname(S.trumpCard) }) });
          sr.tcard.append(c, h('small', null, t('trunfo')));
        } else sr.tcard.classList.remove('on');
      }
      if (seat) renderStack(seat);
    }
  }

  function setTurnUI() {
    if (!refs) return;
    refs.seats.forEach((s, i) => s.chip.update({ active: S.phase === 'play' && S.turn === i }));
    refs.hintBtn.disabled = !(S.phase === 'play' && S.turn === 0);
    if (S.phase !== 'play') refs.status.textContent = '';
    else if (S.trick.length === 4) refs.status.textContent = '';
    else if (S.turn === 0) {
      refs.status.textContent = S.trick.length === 0 ? t('toLead') : t('yourTurn');
      refs.status.className = 'g-sueca-status mine';
    } else {
      refs.status.textContent = t('waiting', { name: seatName(S.turn) });
      refs.status.className = 'g-sueca-status';
    }
  }

  function placeTrickCard(seat, c, rotSeed = 0) {
    const slot = refs.slots[seat];
    slot.textContent = '';
    const el = cardEl(toCard(c), { size: sizes().trick, label: `${seatName(seat)}: ${cname(c)}` });
    el.removeAttribute('role');
    const rot = (((c * 7 + seat * 3 + rotSeed) % 9) - 4) * 1.4;
    el.style.transform = `rotate(${rot}deg)`;
    slot.append(el);
    return el;
  }

  function renderBoardInstant() {
    for (const s of refs.slots) s.textContent = '';
    for (const x of S.trick) placeTrickCard(x.p, x.c).classList.add('g-sueca-played');
    hand.setCards(S.hands[0].map(toCard), { animate: false });
    renderSeatsMeta();
    updateHud();
    setTurnUI();
    refreshPlayable();
  }

  function refreshPlayable() {
    if (!hand) return;
    const mine = S && S.phase === 'play' && S.turn === 0 && S.trick.length < 4;
    const legal = mine ? new Set(R.legalCards(S, 0).map((c) => toCard(c).id)) : null;
    hand.setPlayable(mine ? (card) => legal.has(card.id) : () => false);
    // when it is not our turn the cards should not look "disabled"
    refs.handBox.classList.toggle('is-waiting', !mine);
    const only = mine && R.legalCards(S, 0);
    refs.handBox.classList.toggle('is-forced', !!mine && only.length < S.hands[0].length);
  }

  // ---------- human input ----------
  function onIllegalTap(card) {
    if (!(S && S.phase === 'play' && S.turn === 0)) return;
    cs.error();
    const led = suitOf(S.trick[0].c);
    flash(t('mustFollow', { suit: suitLabel(led) }), 'warn');
    const el = hand.cardEl(card.id);
    if (el) anim.shake(el, 5);
  }
  function onHumanCard(card) {
    if (!humanResolve) return;
    const res = humanResolve;
    humanResolve = null;
    res(fromId(card.id));
  }
  function showHint() {
    if (!(S && S.phase === 'play' && S.turn === 0 && S.trick.length < 4)) return;
    const c = chooseCard(R.viewFor(S, 0));
    const id = toCard(c).id;
    const el = hand.cardEl(id);
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
    const grid = h('div', { class: 'g-sueca-lt', style: { '--cw': Math.round(sz.hand * 0.82) + 'px' } },
      last.plays.map((x) => h('div', { class: `g-sueca-ltc p${x.p}${x.p === last.winner ? ' win' : ''}` }, cardEl(toCard(x.c), { size: Math.round(sz.hand * 0.82), highlight: x.p === last.winner }), h('small', null, seatName(x.p)))));
    modal({
      root,
      title: t('lastTrick'),
      body: h('div', null, grid, h('p', { class: 'g-sueca-ltsum' }, t('wonTrick', { name: seatName(last.winner) }), ` · ${t('pointsInTrick', { n: last.points })}`)),
      actions: [{ label: t('close'), value: true, primary: true }],
      dismissible: true,
      lang: ctx.lang,
    });
  }

  // ---------- main flow ----------
  async function enterGame(deal) {
    runId++;
    const id = runId;
    screen = 'game';
    buildTable();
    renderBoardInstant();
    if (deal) await dealAnimation(id);
    else if (S.phase === 'play' && S.tricks.length + S.trick.length > 0) flash(t('resumed'));
    if (!alive(id)) return;
    loop(id);
  }

  async function dealAnimation(id) {
    hand.setCards(S.hands[0].map(toCard), { animate: false });
    renderSeatsMeta();
    updateHud();
    if (reduced()) return;
    cs.shuffle();
    const centre = refs.felt.getBoundingClientRect();
    const from = { left: centre.left + centre.width / 2 - 10, top: centre.top + centre.height / 2 - 14, width: 20, height: 28 };
    const els = hand.getCards().map((c) => hand.cardEl(c.id));
    const ps = els.map((el, i) => anim.flyCard(el, from, null, { duration: 380, delay: 150 + i * 70, faceDownFrom: true, arc: 30 }));
    for (let i = 0; i < 10; i++) later(() => cs.deal(), (150 + i * 70) / motion.speed);
    refs.seats.forEach((s, i) => { if (i) s.stack.animate?.([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400 / motion.speed, delay: 120 / motion.speed, fill: 'backwards' }); });
    await Promise.all(ps);
    if (!alive(id)) return;
    const tc = refs.seats[S.dealer].tcard.firstChild;
    if (tc) {
      anim.flip(tc, false);
      cs.flip();
    }
    await sleep(350);
  }

  async function loop(id) {
    while (alive(id)) {
      if (S.phase === 'roundEnd' || S.phase === 'matchEnd') {
        await finishRound(id);
        continue;
      }
      if (S.trick.length === 4) {
        await resolveTrickUI(id);
        continue;
      }
      const seat = S.turn;
      setTurnUI();
      refreshPlayable();
      let c;
      if (seat === 0) {
        if (S.trick.length === 0 && S.hands[0].length === 1) c = S.hands[0][0];
        else {
          cs.turn();
          c = await new Promise((res) => { humanResolve = res; });
          if (!alive(id)) return;
        }
      } else {
        await sleep(520 + ((S.tricks.length * 37 + seat * 91) % 5) * 90);
        if (!alive(id)) return;
        c = chooseCard(R.viewFor(S, seat));
      }
      await playUI(id, seat, c);
    }
  }

  async function playUI(id, seat, c) {
    const cid = toCard(c).id;
    let fromRect;
    if (seat === 0) {
      fromRect = hand.rectOf(cid);
      hand.clearSelection();
    } else fromRect = refs.seats[seat].stack.getBoundingClientRect();
    R.playCard(S, seat, c);
    persist();
    if (seat === 0) hand.remove(cid);
    else renderStack(seat);
    refs.handBox.classList.add('is-waiting');
    hand.setPlayable(() => false);
    const el = placeTrickCard(seat, c);
    cs.place();
    refs.seats[S.dealer].tcard.classList.toggle('on', !(c === S.trumpCard) && S.dealer >= 0);
    if (c === S.trumpCard) refs.seats[S.dealer].tcard.textContent = '';
    setTurnUI();
    await anim.flyCard(el, fromRect, null, { duration: 380, faceDownFrom: seat !== 0, arc: seat === 0 ? 24 : 14 });
    el.classList.add('g-sueca-played');
  }

  async function resolveTrickUI(id) {
    await sleep(850);
    if (!alive(id)) return;
    const winner = R.trickWinner(S.trick, S.trump);
    const winEl = refs.slots[winner].firstChild;
    const pointsInTrick = S.trick.reduce((a, x) => a + pts(x.c), 0);
    if (winEl) winEl.classList.add('is-hl');
    const mine = R.teamOf(winner) === 0;
    flash(mine ? t('wonTrickUs') : t('wonTrickThem'), mine ? 'us' : 'them');
    refs.seats.forEach((s, i) => s.chip.update({ active: i === winner }));
    refs.status.textContent = '';
    await sleep(700);
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
    updateHud();
    if (pointsInTrick >= 10 && res.team === 0 && !reduced()) anim.pulse(refs.piles[0].el, 1.12);
  }

  // ---------- round / match end ----------
  const kindLabel = (k) => t({ normal: 'kindNormal', capote: 'kindCapote', bandeira: 'kindBandeira', draw: 'kindDraw' }[k]);

  function pipsRow(team, n, target) {
    const row = h('span', { class: 'g-sueca-pips big', style: { '--tc': TEAM_COLOR[team] } });
    for (let i = 0; i < target; i++) row.append(h('i', { class: i < n ? 'on' : '' }));
    return row;
  }

  function roundBody(rd, final) {
    const [a, b] = rd.points;
    const res = rd.result;
    const head = res.team < 0 ? t('roundDraw') : res.team === 0 ? t('roundWin') : t('roundLoss');
    const sub = res.team < 0 ? t('roundDrawSub') : `${kindLabel(res.kind)} · ${res.jogos === 1 ? t('jogosWon1') : t('jogosWon', { n: res.jogos })}`;
    const bar = h('div', { class: 'g-sueca-bar', role: 'img', 'aria-label': `${t('us')} ${a}, ${t('them')} ${b}` },
      h('i', { class: 't0', style: { width: (a / 120) * 100 + '%' } }),
      h('i', { class: 't1', style: { width: (b / 120) * 100 + '%' } }),
      h('em', { class: 'mid' }, h('span', null, '60')));
    return h('div', { class: `g-sueca-rbody ${res.team === 0 ? 'win' : res.team === 1 ? 'loss' : 'draw'}` },
      h('p', { class: 'g-sueca-rsub' }, sub),
      h('div', { class: 'g-sueca-rscore' }, h('div', { class: 't0' }, h('small', null, t('us')), h('b', null, String(a))), h('div', { class: 'vs' }, '×'), h('div', { class: 't1' }, h('small', null, t('them')), h('b', null, String(b)))),
      bar,
      h('div', { class: 'g-sueca-rrow' }, h('span', null, t('cardPoints')), h('b', null, `${a} – ${b}`)),
      h('div', { class: 'g-sueca-rrow' }, h('span', null, t('tricksTaken')), h('b', null, `${rd.tricksWon[0]} – ${rd.tricksWon[1]}`)),
      S.opts.single ? null : h('div', { class: 'g-sueca-rtotal' }, h('small', null, t('jogos')), h('div', null, pipsRow(0, rd.jogos[0], S.opts.target), h('span', { class: 'vs' }, `${rd.jogos[0]} × ${rd.jogos[1]}`), pipsRow(1, rd.jogos[1], S.opts.target))),
    );
  }

  function countRound(rd) {
    if (rd.counted) return;
    rd.counted = true;
    const ex = extra();
    ex.rounds++;
    if (rd.result.team === 0) {
      ex.roundsWon++;
      if (rd.result.kind === 'bandeira') ex.bandeiras++;
      if (rd.result.kind === 'capote') ex.capotes++;
    }
    ex.bestRound = Math.max(ex.bestRound, rd.points[0]);
    store.set('extra', ex);
    persist();
  }

  async function finishRound(id) {
    const rd = S.lastRound;
    const matchOver = S.phase === 'matchEnd';
    countRound(rd);
    const outcome = rd.result.team < 0 ? 'draw' : rd.result.team === 0 ? 'win' : 'lose';
    if (!matchOver) {
      if (outcome === 'win') cs.win(); else if (outcome === 'lose') cs.lose();
      await sleep(500);
      if (!alive(id)) return;
      await modal({ root, title: outcome === 'win' ? t('roundWin') : outcome === 'lose' ? t('roundLoss') : t('roundDraw'), body: roundBody(rd), actions: [{ label: t('nextRound'), value: true, primary: true }], className: `g-sueca-rmodal is-${outcome}`, lang: ctx.lang });
      if (!alive(id)) return;
      R.nextRound(S);
      persist();
      renderBoardInstant();
      await dealAnimation(id);
      return;
    }
    // match over
    await sleep(400);
    if (!alive(id)) return;
    await modal({ root, title: outcome === 'win' ? t('roundWin') : outcome === 'lose' ? t('roundLoss') : t('roundDraw'), body: roundBody(rd), actions: [{ label: t('finalScore'), value: true, primary: true }], className: `g-sueca-rmodal is-${outcome}`, lang: ctx.lang });
    if (!alive(id)) return;
    const win = R.matchWinner(S);
    const result = win === 0 ? 'win' : win === 1 ? 'loss' : 'draw';
    if (!S.recorded) {
      S.recorded = true;
      stats.record({ result, score: S.jogos[0], single: S.opts.single, jogos: S.jogos.slice(), pts: S.opts.single ? rd.points.slice() : null });
      ctx.addXP?.(S.opts.single ? (result === 'win' ? 8 : 3) : result === 'win' ? 25 : result === 'draw' ? 8 : 10);
      persist();
    }
    if (result === 'win') cs.win(); else if (result === 'loss') cs.lose();
    const st = stats.get();
    const v = await resultModal({
      root,
      outcome: result === 'win' ? 'win' : result === 'loss' ? 'lose' : 'draw',
      title: result === 'win' ? t('matchWin') : result === 'loss' ? t('matchLoss') : t('matchDraw'),
      subtitle: result === 'win' ? t('matchWinSub') : result === 'loss' ? t('matchLossSub') : t('matchDrawSub'),
      stats: S.opts.single ? [{ label: t('cardPoints'), value: `${rd.points[0]} – ${rd.points[1]}` }, { label: t('statWins'), value: st.wins }] : [{ label: t('jogos'), value: `${S.jogos[0]} – ${S.jogos[1]}` }, { label: t('statRounds'), value: S.rounds.filter((x) => x.result.team === 0).length + ' / ' + S.rounds.length }, { label: t('statWins'), value: st.wins }],
      actions: [{ label: t('menu'), value: 'menu' }, { label: t('rematch'), value: 'again', primary: true }],
      lang: ctx.lang,
    });
    if (!alive(id)) return;
    const single = S.opts.single;
    save.clear();
    if (v === 'again') {
      S = R.newMatch({ single }, randomSeed());
      persist();
      enterGame(true);
    } else showMenu();
    // loop() of this run ends because runId changed
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

  // ---------- resize ----------
  const onResize = () => {
    if (screen !== 'game' || !refs) return;
    const sz = sizes();
    refs.handBox.style.setProperty('--hcw', sz.hand + 'px');
    hand.setSize(sz.hand);
  };
  window.addEventListener('resize', onResize);

  // ---------- start ----------
  if (ctx.mode === 'match' || ctx.mode === 'round') {
    const saved = save.load();
    if (saved && ctx.mode === (saved.opts.single ? 'round' : 'match') && saved.phase !== 'matchEnd') {
      showMenu();
      newGame({ single: ctx.mode === 'round' });
    } else newGame({ single: ctx.mode === 'round' });
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
