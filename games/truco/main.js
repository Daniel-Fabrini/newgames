// Truco Paulista — 2v2 (or 1v1 duel) card game.
//   Menu → match → results. Modes (ctx.mode): match (to 12), quick (to 6, up to "seis"), duel (1v1).
//   Rules engine: rules.js (pure, tested). Opponents: ai.js (sees only own cards + public info).
//   The UI plays the engine's event stream (deal, vira, play, trick, bet, accept, run, hand…) with
//   short animations; the match autosaves to ctx.store after every action and resumes exactly.

import STRINGS from './strings.js';
import * as R from './rules.js';
import { decide, PERSONAS, DIFFICULTY } from './ai.js';
import { cardEl, setFaceDown } from '../_cards/card.js';
import { setCardLang } from '../_cards/decks.js';
import { createCardSfx } from '../_cards/sfx.js';

const SAVE_VERSION = 1;
const MODES = {
  match: { n: 4, target: 12, icon: 'users', xp: [30, 12] },
  quick: { n: 4, target: 6, icon: 'clock', xp: [18, 8] },
  duel: { n: 2, target: 12, icon: 'user', xp: [26, 10] },
};
const MODE_IDS = Object.keys(MODES);
const BET_KEY = { 3: 'bet_3', 6: 'bet_6', 9: 'bet_9', 12: 'bet_12' };
const SUIT_GLYPH = { C: '♣', H: '♥', S: '♠', D: '♦' };
const toLib = (c) => ({ r: c[0], s: c[1].toLowerCase(), id: c.toLowerCase() });

const svg = (inner, cls = '') => `<svg class="tr-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICON = {
  help: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>'),
  stats: svg('<path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  order: svg('<path d="M6 18V8M12 18V5M18 18v-7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  soundOn: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOff: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  play: svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M4 20L20 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
};

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  await ctx.loadCSS(new URL('../_cards/cards.css', import.meta.url));
  setCardLang(ctx.lang);
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const store = ctx.store;
  const cs = createCardSfx(ctx);
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMq.matches;

  // ---------- lifecycle ----------
  let disposed = false;
  let runId = 0; // bumps whenever a match loop is abandoned
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const sleep = (ms) => new Promise((res) => later(res, reduce() ? Math.min(ms, 120) : ms));
  let scopeCleanups = [];
  const listen = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    scopeCleanups.push(() => target.removeEventListener(ev, fn, opts));
  };
  const runScope = () => {
    const c = scopeCleanups;
    scopeCleanups = [];
    c.forEach((f) => f());
  };

  // ---------- persistence ----------
  const prefs = () => ({ diff: 'normal', closed: false, sound: true, mode: 'match', ...(store.get('prefs', {}) || {}) });
  const setPrefs = (p) => store.set('prefs', { ...prefs(), ...p });
  const getStats = () => ({ games: 0, wins: 0, losses: 0, hands: 0, handsWon: 0, trucos: 0, streak: 0, best: 0, history: [], ...(store.get('stats', {}) || {}) });
  const loadSave = () => {
    const s = store.get('save', null);
    return s && s.v === SAVE_VERSION && s.state && s.state.hand ? s : null;
  };
  cs.enabled = prefs().sound !== false;

  // ---------- match model ----------
  let m = null; // { mode, state, ai:{rng}, diff, personas:[id per seat], tally:{hands,handsWon}, done }
  let disp = null; // what is on screen (driven by the event stream)
  let ui = null; // dom refs for the game screen
  let humanWait = null; // { resolve, legal }
  let showingOverlay = null;

  const seatName = (seat) => {
    if (seat === 0) return t('you');
    if (m.state.n === 4 && seat === 2) return personaName(seat);
    return personaName(seat);
  };
  const personaName = (seat) => t('p_' + m.personas[seat]);
  const teamName = (team) => (m.state.n === 2 ? (team === 0 ? t('you') : personaName(1)) : team === 0 ? t('us') : t('them'));
  const pos = (seat) => {
    if (m.state.n === 2) return seat === 0 ? 'bottom' : 'top';
    return ['bottom', 'left', 'top', 'right'][seat];
  };
  const aiRnd = () => R.nextRand(m.ai);

  function newMatch(mode) {
    const cfg = MODES[mode];
    const p = prefs();
    const seed = R.realSeed();
    const state = R.newGame({ n: cfg.n, target: cfg.target, seed, closed: !!p.closed, humanSeats: [0] });
    const ai = { rng: (seed ^ 0xa5a5a5a5) >>> 0 };
    const order = PERSONAS.map((x) => x.id);
    const off = (seed >>> 3) % order.length;
    const personas = [null, order[off], order[(off + 1) % 4], order[(off + 2) % 4]];
    m = { mode, state, ai, diff: p.diff || 'normal', personas, tally: { hands: 0, handsWon: 0, trucos: 0 }, done: false };
  }
  function save() {
    if (!m || m.done) return;
    store.set('save', { v: SAVE_VERSION, mode: m.mode, state: m.state, ai: m.ai, diff: m.diff, personas: m.personas, tally: m.tally, t: Date.now() });
  }

  // ---------- helpers ----------
  const modeLabel = (id) => t('mode_' + id);
  function btn(cls, label, onclick, attrs = {}) {
    return h('button', { class: cls, type: 'button', onclick, ...attrs }, label);
  }
  function sec(title, body) {
    return h('section', { class: 'tr-sec' }, h('h3', null, title), body);
  }

  // ---------- menu ----------
  function showMenu() {
    runId++;
    runScope();
    humanWait = null;
    m = null;
    clear(root);
    ctx.setTitle();
    ctx.onBack(() => false);
    ctx.setHeaderRight(headerRight(false));
    const p = prefs();
    const sv = loadSave();
    const modeBtns = MODE_IDS.map((id) =>
      h(
        'button',
        { class: 'tr-mode', type: 'button', onclick: () => startMode(id) },
        h('span', { class: 'tr-mode-ico' }, h('span', { class: 'tr-mode-glyph' }, id === 'duel' ? '1v1' : id === 'quick' ? '6' : '12')),
        h('span', { class: 'tr-mode-body' }, h('b', null, modeLabel(id)), h('small', null, t('modeSub_' + id))),
        h('span', { class: 'tr-mode-go' }, h('span', { html: ICON.play })),
      ),
    );
    modeBtns.forEach((b) => (b.querySelector('.tr-mode-go span').innerHTML = ICON.play));
    const diffChips = ['easy', 'normal', 'hard'].map((d) =>
      h('button', { class: 'tr-chip' + (p.diff === d ? ' on' : ''), type: 'button', 'aria-pressed': p.diff === d ? 'true' : 'false', onclick: () => { setPrefs({ diff: d }); showMenu(); } }, t('diff_' + d)),
    );
    const closedSw = h('button', { class: 'tr-switch' + (p.closed ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': p.closed ? 'true' : 'false', 'aria-label': t('closedCards'), onclick: () => { setPrefs({ closed: !p.closed }); showMenu(); } }, h('i'));
    const menu = h(
      'div',
      { class: 'tr-menu' },
      h('div', { class: 'tr-menu-hero' }, h('div', { class: 'tr-menu-cards', 'aria-hidden': 'true' }, ...['3C', 'QH', '4D'].map((c, i) => h('div', { class: 'tr-menu-card c' + i }, cardEl(toLib(c), { size: 64 })))), h('h2', null, t('tagline'))),
      sv
        ? h(
            'button',
            { class: 'tr-continue', type: 'button', onclick: () => resumeSaved() },
            h('span', { class: 'tr-continue-ico', html: ICON.play }),
            h('span', { class: 'tr-continue-body' }, h('b', null, t('continue')), h('small', null, t('continueInfo', { mode: modeLabel(sv.mode), us: sv.state.score[0], them: sv.state.score[1] }))),
          )
        : null,
      h('div', { class: 'tr-menu-sec' }, h('div', { class: 'tr-menu-label' }, t('modeLabel')), ...modeBtns),
      h('div', { class: 'tr-menu-sec' }, h('div', { class: 'tr-menu-label' }, t('difficulty')), h('div', { class: 'tr-chips' }, ...diffChips)),
      h('div', { class: 'tr-menu-sec tr-opt' }, h('div', { class: 'tr-opt-body' }, h('b', null, t('closedCards')), h('small', null, t('closedCardsSub'))), closedSw),
      h('div', { class: 'tr-menu-foot' }, btn('tr-linkbtn', [h('span', { html: ICON.stats }), t('stats')], showStats), btn('tr-linkbtn', [h('span', { html: ICON.help }), t('rules')], showRules)),
    );
    root.append(h('div', { class: 'g-tr' }, menu));
    modeBtns.length && null;
  }

  function headerRight(inGame) {
    const soundBtn = h('button', { class: 'tr-hbtn', type: 'button', 'aria-label': cs.enabled ? t('soundOn') : t('soundOff'), onclick: () => {
      cs.enabled = !cs.enabled;
      setPrefs({ sound: cs.enabled });
      soundBtn.innerHTML = cs.enabled ? ICON.soundOn : ICON.soundOff;
      soundBtn.setAttribute('aria-label', cs.enabled ? t('soundOn') : t('soundOff'));
    } });
    soundBtn.innerHTML = cs.enabled ? ICON.soundOn : ICON.soundOff;
    const helpBtn = h('button', { class: 'tr-hbtn', type: 'button', 'aria-label': t('rules'), onclick: showRules });
    helpBtn.innerHTML = ICON.help;
    return h('div', { class: 'tr-hright' }, soundBtn, helpBtn);
  }

  async function startMode(mode) {
    const sv = loadSave();
    if (sv) {
      const r = await ctx.ui.modal({ title: t('replaceTitle'), body: t('replaceText'), actions: [{ label: t('keepPlaying'), value: 'keep', primary: true }, { label: t('newMatch'), value: 'new', danger: true }, { label: t('cancel'), value: null }] });
      if (r === 'keep') return resumeSaved();
      if (r !== 'new') return;
      store.remove('save');
    }
    newMatch(mode);
    beginMatch(true);
  }
  function resumeSaved() {
    const sv = loadSave();
    if (!sv) return showMenu();
    m = { mode: sv.mode, state: sv.state, ai: sv.ai, diff: sv.diff, personas: sv.personas, tally: sv.tally || { hands: 0, handsWon: 0, trucos: 0 }, done: false };
    beginMatch(false);
  }

  // ---------- game screen ----------
  function buildGame() {
    runScope();
    clear(root);
    const n = m.state.n;
    const seatEl = (seat) => {
      const p = pos(seat);
      const avatar = h('div', { class: 'tr-av team' + R.teamOf(seat) }, seat === 0 ? '★' : personaName(seat)[0]);
      const name = h('div', { class: 'tr-sname' }, seatName(seat));
      const cards = h('div', { class: 'tr-sc' });
      const bubble = h('div', { class: 'tr-bubble', 'aria-live': 'polite' });
      const el = h('div', { class: `tr-seat s-${p} team${R.teamOf(seat)}`, 'data-seat': seat }, avatar, name, cards, bubble);
      return { el, avatar, cards, bubble };
    };
    const seats = [];
    for (let s = 0; s < n; s++) seats[s] = seatEl(s);
    const slots = [];
    const center = h('div', { class: 'tr-center' });
    for (let s = 0; s < n; s++) {
      const slot = h('div', { class: `tr-slot p-${pos(s)}` });
      slots[s] = slot;
      center.append(slot);
    }
    const centerMsg = h('div', { class: 'tr-cmsg', 'aria-live': 'polite' });
    const table = h('div', { class: 'tr-table' }, h('div', { class: 'tr-rail' }), center, centerMsg, ...seats.filter((_, i) => i !== 0).map((x) => x.el), seats[0].el);
    // hud
    const plate = (team) => {
      const num = h('div', { class: 'tr-pnum', 'data-v': '0' }, '0');
      const pips = h('div', { class: 'tr-pips' }, ...Array.from({ length: m.state.target }, () => h('i')));
      const el = h('div', { class: 'tr-plate team' + team }, h('div', { class: 'tr-pname' }, teamName(team)), num, pips);
      return { el, num, pips };
    };
    const plates = [plate(0), plate(1)];
    const viraBox = h('div', { class: 'tr-vira' });
    const manilhaPill = h('div', { class: 'tr-mpill' });
    const hud = h('div', { class: 'tr-hud' }, plates[0].el, h('div', { class: 'tr-vmid' }, viraBox, manilhaPill), plates[1].el);
    // strip
    const valueChip = h('div', { class: 'tr-value' });
    const marks = [0, 1, 2].map((i) => h('div', { class: 'tr-mark', title: t('trickN', { n: i + 1 }) }, h('span', null, i + 1)));
    const orderBtn = h('button', { class: 'tr-orderbtn', type: 'button', onclick: showOrder, 'aria-label': t('order') }, h('span', { html: ICON.order }), h('span', null, t('order')));
    const strip = h('div', { class: 'tr-strip' }, valueChip, h('div', { class: 'tr-marks' }, ...marks), orderBtn);
    const status = h('div', { class: 'tr-status', role: 'status', 'aria-live': 'polite' });
    const actions = h('div', { class: 'tr-actions' });
    const hand = h('div', { class: 'tr-hand', role: 'group', 'aria-label': t('yourCards') });
    const overlay = h('div', { class: 'tr-overlay' });
    const game = h('div', { class: 'g-tr tr-game', 'data-n': n }, hud, strip, table, status, actions, hand, overlay);
    root.append(game);
    ui = { game, hud, plates, viraBox, manilhaPill, valueChip, marks, orderBtn, table, seats, slots, center, centerMsg, status, actions, hand, overlay };
    // size cards to the available space
    const fit = () => {
      const w = game.clientWidth || 360;
      const hh = game.clientHeight || 640;
      const cw = Math.max(64, Math.min(96, Math.floor((w - 40) / 3.35), Math.floor(hh * 0.15)));
      game.style.setProperty('--hand-cw', cw + 'px');
      game.style.setProperty('--play-cw', Math.max(48, Math.min(70, Math.floor(w * 0.15))) + 'px');
    };
    fit();
    listen(window, 'resize', fit);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ro.observe(game);
      scopeCleanups.push(() => ro.disconnect());
    }
    listen(document, 'keydown', onKey);
    ctx.setHeaderRight(headerRight(true));
    ctx.setTitle(modeLabel(m.mode));
    ctx.onBack(() => {
      if (!m || m.done) return false;
      if (showingOverlay === 'end') return false;
      ctx.ui.modal({ title: t('leaveTitle'), body: t('leaveText'), actions: [{ label: t('leave'), value: true, primary: true }, { label: t('stay'), value: false }] }).then((ok) => {
        if (ok) {
          save();
          showMenu();
        }
      });
      return true;
    });
  }

  // disp: the displayed model
  function syncDisp() {
    const s = m.state;
    const hd = s.hand;
    disp = {
      score: s.score.slice(),
      value: s.phase === 'handEnd' || s.phase === 'gameEnd' ? (s.last ? s.last.value : hd.value) : hd.value,
      results: hd.results.slice(),
      vira: hd.vira,
      manilha: hd.manilha,
      counts: hd.hands.map((x) => x.length),
      mine: hd.hands[0].slice(),
      center: hd.cur.map((p) => ({ ...p })),
      turn: s.phase === 'play' ? hd.turn : null,
      special: hd.special,
      blind: hd.special === 'ferro',
      dealt: true,
    };
    renderAll();
  }

  function renderAll() {
    renderHud();
    renderSeats();
    renderCenter();
    renderHand();
    renderStatus();
  }

  function renderHud() {
    if (!ui || !disp) return;
    const s = m.state;
    for (const tm of [0, 1]) {
      const pl = ui.plates[tm];
      const from = Number(pl.num.dataset.v);
      pl.num.dataset.v = disp.score[tm];
      if (from !== disp.score[tm]) {
        pl.num.textContent = disp.score[tm];
        if (!reduce()) pl.num.animate([{ transform: 'scale(1.5)', color: '#fff' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      } else pl.num.textContent = disp.score[tm];
      [...pl.pips.children].forEach((p, i) => p.classList.toggle('on', i < disp.score[tm]));
      pl.el.classList.toggle('lead', disp.score[tm] > disp.score[1 - tm]);
      pl.el.classList.toggle('eleven', s.target >= 12 && disp.score[tm] === s.target - 1);
    }
    clear(ui.viraBox);
    if (disp.vira && disp.dealt) ui.viraBox.append(cardEl(toLib(disp.vira), { size: 44 }));
    const rl = disp.manilha;
    ui.manilhaPill.innerHTML = '';
    if (rl) ui.manilhaPill.append(h('span', { class: 'tr-mlabel' }, t('manilha')), h('b', null, rl));
    ui.valueChip.textContent = t('value', { n: disp.value });
    ui.valueChip.dataset.lvl = disp.value;
    ui.marks.forEach((mk, i) => {
      const r = disp.results[i];
      mk.className = 'tr-mark' + (r === undefined ? '' : r === null ? ' tie' : r === 0 ? ' us' : ' them') + (r === undefined && i === disp.results.length ? ' now' : '');
    });
  }

  function renderSeats() {
    if (!ui || !disp) return;
    const n = m.state.n;
    for (let s = 0; s < n; s++) {
      const sd = ui.seats[s];
      sd.el.classList.toggle('active', disp.turn === s);
      if (s === 0) continue;
      clear(sd.cards);
      for (let i = 0; i < disp.counts[s]; i++) sd.cards.append(h('div', { class: 'tr-mini', style: { '--i': i } }, cardEl(null, { size: 34 })));
    }
  }

  function renderCenter() {
    if (!ui || !disp) return;
    for (const slot of ui.slots) clear(slot);
    for (const p of disp.center) {
      const el = playCardEl(p);
      ui.slots[p.seat].append(el);
    }
  }
  function playCardEl(p) {
    const el = cardEl(p.card ? toLib(p.card) : null, { faceDown: !!p.hidden || !p.card });
    el.classList.add('tr-played');
    el.style.setProperty('--tilt', ((p.seat * 7) % 5) - 2 + 'deg');
    el.dataset.seat = p.seat;
    if (p.hidden) el.append(h('span', { class: 'tr-hid', html: ICON.eye }));
    return el;
  }

  function renderHand() {
    if (!ui || !disp) return;
    clear(ui.hand);
    const myTurn = m.state.phase === 'play' && m.state.hand.turn === 0 && humanWait && humanWait.kind === 'play';
    disp.mine.forEach((c, i) => {
      const down = disp.blind;
      const el = cardEl(toLib(c), { faceDown: down, lang: ctx.lang });
      const b = h('button', { class: 'tr-hc' + (myTurn ? ' can' : ''), type: 'button', 'data-card': c, 'aria-label': down ? `${t('yourCards')} ${i + 1}` : el.getAttribute('aria-label'), disabled: !myTurn, style: { '--i': i }, onclick: () => playCard(c) }, el);
      el.removeAttribute('role');
      ui.hand.append(b);
    });
  }

  function renderStatus(text) {
    if (!ui) return;
    ui.status.textContent = text || '';
  }

  // ---------- animations ----------
  function seatOrigin(seat) {
    if (seat === 0) {
      const b = ui.hand.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, s: 1.4 };
    }
    const r = ui.seats[seat].cards.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: 0.6 };
  }
  function flyIn(el, from) {
    if (reduce() || !from) return;
    const r = el.getBoundingClientRect();
    const dx = from.x - (r.left + r.width / 2);
    const dy = from.y - (r.top + r.height / 2);
    el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${from.s}) rotate(${from.x < r.left ? -14 : 14}deg)`, opacity: 0.7 }, { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.25,1)' });
  }
  function bubble(seat, text, kind = '') {
    const sd = ui.seats[seat];
    const el = h('div', { class: 'bub ' + kind }, text);
    clear(sd.bubble);
    sd.bubble.append(el);
    if (!reduce()) el.animate([{ transform: 'scale(.4) rotate(-6deg)', opacity: 0 }, { transform: 'scale(1.18) rotate(2deg)', opacity: 1, offset: 0.5 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], { duration: 360, easing: 'ease-out' });
    later(() => el.remove(), 1500);
  }
  function banner(text, kind = '') {
    const el = h('div', { class: 'tr-banner ' + kind }, text);
    ui.centerMsg.append(el);
    if (!reduce()) el.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    later(() => {
      if (reduce()) return el.remove();
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => el.remove();
    }, 1300);
  }

  async function present(events) {
    const myRun = runId;
    const alive = () => myRun === runId && !disposed;
    for (const ev of events) {
      if (!alive()) return;
      switch (ev.e) {
        case 'deal': {
          syncDispDeal();
          cs.shuffle?.();
          if (!reduce()) ui.game.classList.add('dealing');
          cs.deal?.();
          if (ev.special === 'ferro') banner(t('ferroBanner'), 'info');
          await sleep(520);
          ui.game.classList.remove('dealing');
          break;
        }
        case 'vira': {
          disp.vira = ev.card;
          disp.manilha = ev.manilha;
          disp.dealt = true;
          renderHud();
          const v = ui.viraBox.firstChild;
          if (v && !reduce()) v.animate([{ transform: 'rotateY(90deg) scale(1.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out' });
          cs.flip?.();
          await sleep(480);
          break;
        }
        case 'onze':
          banner(t('onzeBanner'), 'info');
          break;
        case 'play': {
          disp.counts[ev.seat]--;
          if (ev.seat === 0) {
            const i = disp.mine.indexOf(ev.card);
            if (i >= 0) disp.mine.splice(i, 1);
          }
          const from = seatOrigin(ev.seat);
          disp.center.push({ seat: ev.seat, card: ev.hidden && ev.seat !== 0 ? null : ev.card, hidden: ev.hidden });
          if (ev.seat === 0) renderHand();
          renderSeats();
          renderCenter();
          const el = ui.slots[ev.seat].firstChild;
          if (el) {
            flyIn(el, from);
            if (disp.blind && ev.seat === 0) {
              setFaceDown(el, true);
              later(() => setFaceDown(el, false), 200);
            }
            if (disp.blind && ev.seat !== 0) {
              // blind hand: everybody's card is revealed when played
              const c = toLib(ev.card);
              later(() => { el._card = c; el.dataset.id = c.id; setFaceDown(el, false); }, 200);
            }
          }
          cs.place?.();
          await sleep(ev.seat === 0 ? 280 : 360);
          break;
        }
        case 'trick': {
          const wslot = ev.seat === null ? null : ui.slots[ev.seat].firstChild;
          disp.turn = null;
          renderSeats();
          if (ev.tie) {
            ui.slots.forEach((sl) => sl.firstChild && sl.firstChild.classList.add('tied'));
            banner(t('tie'), 'tie');
            cs.error?.();
          } else {
            wslot && wslot.classList.add('winner');
            ui.slots.forEach((sl, i) => i !== ev.seat && sl.firstChild && sl.firstChild.classList.add('lost'));
            ui.seats[ev.seat].el.classList.add('won');
            later(() => ui.seats[ev.seat]?.el.classList.remove('won'), 900);
            cs.slide?.();
          }
          await sleep(900);
          if (!alive()) return;
          // sweep toward the winner
          if (!reduce()) {
            const target = ev.seat === null ? null : ui.seats[ev.seat].el.getBoundingClientRect();
            ui.slots.forEach((sl) => {
              const c = sl.firstChild;
              if (!c) return;
              const r = c.getBoundingClientRect();
              const dx = target ? target.left + target.width / 2 - (r.left + r.width / 2) : 0;
              const dy = target ? target.top + target.height / 2 - (r.top + r.height / 2) : 0;
              c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
            });
            await sleep(300);
          }
          disp.center = [];
          disp.results.push(ev.team);
          renderCenter();
          renderHud();
          await sleep(120);
          break;
        }
        case 'bet':
        case 'raise': {
          const label = t('btnBet', { bet: t(BET_KEY[ev.level]) });
          bubble(ev.seat, label, 'shout lvl' + ev.level + ' team' + R.teamOf(ev.seat));
          ui.game.classList.add('shake' + (ev.level >= 9 ? '2' : ''));
          later(() => ui.game.classList.remove('shake', 'shake2'), 420);
          cs.yell?.(ev.level >= 9 ? 3 : ev.level >= 6 ? 2 : 1);
          ctx.sfx.vibrate?.(ev.level >= 9 ? [30, 40, 60] : 25);
          renderStatus(t('answerOther', { name: seatName(ev.to) }));
          await sleep(950);
          break;
        }
        case 'accept': {
          if (ev.onze) {
            bubble(ev.seat, t('shoutOnzePlay'), 'say team' + R.teamOf(ev.seat));
            disp.value = 3;
          } else {
            bubble(ev.seat, t('shoutAccept'), 'say team' + R.teamOf(ev.seat));
            disp.value = ev.level;
          }
          renderHud();
          cs.select?.();
          await sleep(650);
          break;
        }
        case 'run': {
          bubble(ev.seat, t('shoutRun'), 'say run team' + R.teamOf(ev.seat));
          cs.fold?.();
          await sleep(700);
          break;
        }
        case 'hand': {
          disp.score = m.state.score.slice();
          disp.turn = null;
          disp.mine = [];
          disp.counts = disp.counts.map(() => 0);
          m.tally.hands++;
          if (ev.winner === 0) m.tally.handsWon++;
          renderHud();
          renderSeats();
          break;
        }
        default:
          break;
      }
    }
  }
  function syncDispDeal() {
    // state is exactly at the start of the hand when a 'deal' event is presented
    const s = m.state;
    const hd = s.hand;
    disp = {
      score: s.score.slice(),
      value: hd.value,
      results: [],
      vira: null,
      manilha: null,
      counts: hd.hands.map((x) => x.length),
      mine: hd.hands[0].slice(),
      center: [],
      turn: null,
      special: hd.special,
      blind: hd.special === 'ferro',
      dealt: false,
    };
    renderAll();
    ui.hand.querySelectorAll('.tr-hc').forEach((b, i) => !reduce() && b.animate([{ transform: 'translateY(-60px) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: i * 90, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' }));
    ui.seats.forEach((sd, i) => i && sd.cards.querySelectorAll('.tr-mini').forEach((c, k) => !reduce() && c.animate([{ transform: 'translateY(30px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, delay: (i * 3 + k) * 40, easing: 'ease-out', fill: 'backwards' })));
  }

  // ---------- input ----------
  function playCard(card) {
    if (!humanWait || humanWait.kind !== 'play') return;
    const hidden = hideNext && R.canHide(m.state, 0);
    submit({ t: 'play', card, ...(hidden ? { hidden: true } : {}) });
  }
  let hideNext = false;
  function submit(action) {
    if (!humanWait) return;
    const ok = humanWait.legal.some((l) => l.t === action.t && l.card === action.card && !!l.hidden === !!action.hidden);
    if (!ok) return;
    const w = humanWait;
    humanWait = null;
    ui.actions.classList.remove('on');
    w.resolve(action);
  }
  let kbUsed = false;
  function onKey(e) {
    kbUsed = true;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-overlay')) return;
    const k = e.key.toLowerCase();
    if (showingOverlay === 'hand' || showingOverlay === 'onze') {
      if (k === 'enter' && overlayAction) {
        e.preventDefault();
        overlayAction();
      }
      return;
    }
    if (!humanWait) return;
    if (humanWait.kind === 'play' && ['1', '2', '3'].includes(k)) {
      const c = disp.mine[Number(k) - 1];
      if (c) playCard(c);
    } else if (k === 't') {
      const a = humanWait.legal.find((l) => l.t === 'truco' || l.t === 'raise');
      if (a) submit({ t: a.t });
    } else if (k === 'a' || k === 'enter') {
      if (humanWait.kind === 'bet') submit({ t: 'accept' });
    } else if (k === 'c') {
      if (humanWait.kind === 'bet') submit({ t: 'run' });
    } else if (k === 'h' && humanWait.kind === 'play' && R.canHide(m.state, 0)) toggleHide();
  }
  let overlayAction = null;

  function toggleHide() {
    hideNext = !hideNext;
    renderActions();
  }

  function renderActions() {
    if (!ui) return;
    const w = humanWait;
    clear(ui.actions);
    ui.actions.classList.toggle('on', !!w);
    if (!w) return;
    const s = m.state;
    if (w.kind === 'play') {
      const tr = w.legal.find((l) => l.t === 'truco');
      if (R.canHide(s, 0)) ui.actions.append(h('button', { class: 'tr-act hide' + (hideNext ? ' on' : ''), type: 'button', 'aria-pressed': hideNext ? 'true' : 'false', onclick: toggleHide }, h('span', { html: ICON.eye }), hideNext ? t('hideCardOn') : t('hideCard')));
      if (tr) ui.actions.append(h('button', { class: 'tr-act bet', type: 'button', 'data-lvl': R.nextLevel(s.hand.value), onclick: () => submit({ t: 'truco' }) }, t('btnBet', { bet: t(BET_KEY[R.nextLevel(s.hand.value)]) }).toUpperCase()));
    } else if (w.kind === 'bet') {
      const rz = w.legal.find((l) => l.t === 'raise');
      ui.actions.append(h('button', { class: 'tr-act ok', type: 'button', onclick: () => submit({ t: 'accept' }) }, t('btnAccept').toUpperCase()), h('button', { class: 'tr-act run', type: 'button', onclick: () => submit({ t: 'run' }) }, t('btnRun').toUpperCase()));
      if (rz) ui.actions.append(h('button', { class: 'tr-act bet', type: 'button', 'data-lvl': R.nextLevel(s.hand.bet.level), onclick: () => submit({ t: 'raise' }) }, t('btnRaise', { bet: t(BET_KEY[R.nextLevel(s.hand.bet.level)]) }).toUpperCase()));
    }
  }

  function waitHuman() {
    const s = m.state;
    const legal = R.legalActions(s);
    const kind = s.phase === 'bet' ? 'bet' : s.phase === 'onze' ? 'onze' : 'play';
    return new Promise((resolve) => {
      humanWait = { kind, legal, resolve };
      disp.turn = s.phase === 'play' ? 0 : null;
      hideNext = false;
      renderSeats();
      renderHand();
      renderActions();
      if (kind === 'play') renderStatus(disp.blind ? t('turnYouBlind') : t('turnYou'));
      else if (kind === 'bet') renderStatus(t('answerYou', { name: seatName(s.hand.bet.from), bet: t(BET_KEY[s.hand.bet.level]) }));
      if (kind === 'play') cs.turn?.();
      // focus first card for keyboard users
      if (kind === 'play' && kbUsed) later(() => ui.hand.querySelector('.tr-hc:not([disabled])')?.focus({ preventScroll: true }), 50);
    });
  }

  // ---------- AI ----------
  async function aiAct(seat) {
    const s = m.state;
    const pid = m.personas[seat] || m.personas[1];
    const persona = PERSONAS.find((p) => p.id === pid) || PERSONAS[2];
    disp.turn = s.phase === 'play' ? seat : null;
    renderSeats();
    renderHand();
    renderStatus(s.phase === 'play' ? t('turnOther', { name: seatName(seat) }) : t('answerOther', { name: seatName(seat) }));
    const think = s.phase === 'play' ? 520 + aiRnd() * 480 : 700 + aiRnd() * 600;
    await sleep(think);
    const view = R.viewFor(s, seat);
    return decide(view, persona, aiRnd, DIFFICULTY[m.diff] || DIFFICULTY.normal);
  }

  // ---------- main loop ----------
  async function beginMatch(fresh) {
    runId++;
    const myRun = runId;
    buildGame();
    hideNext = false;
    humanWait = null;
    showingOverlay = null;
    const s = m.state;
    try {
      if (fresh) {
        const ev = R.startHand(s);
        save();
        disp = null;
        await present(ev);
      } else {
        syncDisp();
      }
      while (myRun === runId && !disposed) {
        const phase = s.phase;
        if (phase === 'handEnd' || phase === 'gameEnd') {
          await showHandResult();
          if (myRun !== runId) return;
          if (phase === 'gameEnd') {
            await finishMatch();
            return;
          }
          const ev = R.nextHand(s);
          save();
          await present(ev);
          continue;
        }
        if (!disp) syncDisp();
        // mão de onze decision
        const seat = R.actor(s);
        let action;
        if (phase === 'onze') {
          action = await handleOnze(seat);
        } else if (s.humanSeats.includes(seat)) {
          action = await waitHuman();
        } else {
          action = await aiAct(seat);
        }
        if (myRun !== runId || disposed) return;
        const ev = R.act(s, seat, action);
        save();
        renderActions();
        await present(ev);
        if (myRun !== runId || disposed) return;
        if (s.phase === 'play') {
          disp.turn = s.hand.turn;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ---------- overlays ----------
  function closeOverlay() {
    showingOverlay = null;
    overlayAction = null;
    if (ui) {
      clear(ui.overlay);
      ui.overlay.classList.remove('on');
    }
  }
  function showOverlay(kind, node) {
    showingOverlay = kind;
    clear(ui.overlay);
    ui.overlay.append(node);
    ui.overlay.classList.add('on');
  }

  async function handleOnze(seat) {
    const s = m.state;
    const hd = s.hand;
    const ours = R.teamOf(seat) === 0;
    disp.turn = null;
    renderSeats();
    renderHand();
    if (hd.special === 'onze') bubble(seat, '11', 'say team' + R.teamOf(seat));
    if (s.humanSeats.includes(seat)) {
      const mates = hd.hands.map((x, i) => [i, x]).filter(([i]) => i !== 0 && R.teamOf(i) === 0);
      return new Promise((resolve) => {
        humanWait = null;
        const done = (a) => {
          closeOverlay();
          resolve(a);
        };
        const row = (label, cards) => h('div', { class: 'tr-onze-row' }, h('small', null, label), h('div', { class: 'tr-onze-cards' }, ...cards.map((c) => cardEl(toLib(c), { size: 66 }))));
        const node = h(
          'div',
          { class: 'tr-card tr-onze', role: 'dialog', 'aria-label': t('onzeTitle') },
          h('h3', null, t('onzeTitle')),
          h('p', null, t('onzeText')),
          row(t('yourCards'), hd.hands[0]),
          ...mates.map(([, cards]) => row(t('matesCards'), cards)),
          h('div', { class: 'tr-card-actions' }, btn('tr-act ok', t('onzePlay').toUpperCase(), () => done({ t: 'accept' })), btn('tr-act run', t('onzeRun').toUpperCase(), () => done({ t: 'run' }))),
        );
        overlayAction = () => done({ t: 'accept' });
        showOverlay('onze', node);
        renderStatus('');
      });
    }
    renderStatus(t('onzeOther', { team: teamName(R.teamOf(seat)) }));
    const a = await aiAct(seat);
    return a;
  }

  async function showHandResult() {
    const s = m.state;
    const last = s.last;
    if (!last) return;
    if (!disp) syncDisp();
    disp.score = s.score.slice();
    renderHud();
    renderStatus('');
    humanWait = null;
    renderActions();
    const w = last.winner;
    const us = w === 0;
    const title = w === 'none' ? t('handNone') : us ? t('handWonUs') : t('handWonThem');
    let reason = '';
    if (last.reason === 'run') reason = t('reasonRun', { name: teamName(1 - w) });
    else if (last.reason === 'onzeRun') reason = t('reasonOnzeRun');
    if (m.state.n === 2 && last.reason === 'run') reason = t('reasonRun', { name: w === 0 ? personaName(1) : t('you') });
    if (w === 0) cs.win?.();
    else if (w === 1) cs.lose?.();
    const gameOver = s.phase === 'gameEnd';
    await new Promise((resolve) => {
      const go = () => {
        closeOverlay();
        resolve();
      };
      const node = h(
        'div',
        { class: 'tr-card tr-result ' + (w === 'none' ? 'none' : us ? 'us' : 'them'), role: 'dialog', 'aria-label': title },
        h('div', { class: 'tr-result-pts' }, w === 'none' ? '=' : '+' + last.points),
        h('h3', null, title),
        reason ? h('p', null, reason) : null,
        h('div', { class: 'tr-result-marks' }, ...last.results.map((r, i) => h('span', { class: 'tr-mark ' + (r === null ? 'tie' : r === 0 ? 'us' : 'them') }, h('span', null, i + 1)))),
        btn('tr-act ok', (gameOver ? t('finalScore') : t('next')).toUpperCase(), go, { autofocus: true }),
      );
      overlayAction = go;
      showOverlay('hand', node);
      if (kbUsed) later(() => node.querySelector('button')?.focus({ preventScroll: true }), 60);
    });
  }

  async function finishMatch() {
    const s = m.state;
    m.done = true;
    store.remove('save');
    const win = s.winner === 0;
    const cfg = MODES[m.mode];
    const xp = win ? cfg.xp[0] : cfg.xp[1];
    const st = getStats();
    st.games++;
    if (win) {
      st.wins++;
      st.streak++;
      st.best = Math.max(st.best, st.streak);
    } else {
      st.losses++;
      st.streak = 0;
    }
    st.hands += m.tally.hands;
    st.handsWon += m.tally.handsWon;
    st.trucos += s.stats.trucos[0];
    st.history = [{ mode: m.mode, win, score: s.score.slice(), t: Date.now() }, ...(st.history || [])].slice(0, 12);
    store.set('stats', st);
    ctx.addXP?.(xp);
    if (win) {
      ctx.ui.confetti?.();
      ctx.sfx.play('win');
    } else ctx.sfx.play('lose');
    await new Promise((resolve) => {
      showingOverlay = 'end';
      const node = h(
        'div',
        { class: 'tr-card tr-end ' + (win ? 'win' : 'loss'), role: 'dialog', 'aria-label': win ? t('gameWon') : t('gameLost') },
        h('div', { class: 'tr-end-crown', html: win ? '♛' : '♣' }),
        h('h2', null, win ? t('gameWon') : t('gameLost')),
        h('p', null, win ? t('gameWonSub') : t('gameLostSub')),
        h('div', { class: 'tr-end-score' }, h('div', { class: 'team0' }, h('small', null, teamName(0)), h('b', null, String(s.score[0]))), h('span', null, '×'), h('div', { class: 'team1' }, h('small', null, teamName(1)), h('b', null, String(s.score[1])))),
        h('div', { class: 'tr-end-meta' }, h('span', null, t('recapHands', { w: m.tally.handsWon, n: m.tally.hands })), h('span', null, t('recapTrucos', { n: s.stats.trucos[0] }))),
        h('div', { class: 'tr-end-xp' }, t('xpLine', { n: xp })),
        h('div', { class: 'tr-card-actions' }, btn('tr-act ok', t('again').toUpperCase(), () => { closeOverlay(); newMatch(m.mode); beginMatch(true); resolve(); }), btn('tr-act ghost', t('toMenu').toUpperCase(), () => { closeOverlay(); showMenu(); resolve(); })),
      );
      showOverlay('end', node);
    });
  }

  // ---------- modals: rules, order, stats ----------
  function sheet(title, body, onClose) {
    const close = () => {
      wrap.remove();
      onClose?.();
    };
    const wrap = h(
      'div',
      { class: 'g-tr tr-sheet-wrap', onclick: (e) => e.target === wrap && close() },
      h('div', { class: 'tr-sheet', role: 'dialog', 'aria-label': title }, h('div', { class: 'tr-sheet-head' }, h('h2', null, title), h('button', { class: 'tr-x', type: 'button', 'aria-label': t('close'), onclick: close }, '×')), h('div', { class: 'tr-sheet-body' }, body)),
    );
    const esc = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', esc);
        close();
      }
    };
    document.addEventListener('keydown', esc);
    scopeCleanupsGlobal.push(() => {
      document.removeEventListener('keydown', esc);
      wrap.remove();
    });
    root.append(wrap);
    wrap.querySelector('.tr-x').focus({ preventScroll: true });
  }
  const scopeCleanupsGlobal = [];

  function showRules() {
    const body = h('div', { class: 'tr-rules' });
    for (let i = 1; i <= 8; i++) body.append(h('h4', null, t('r_h' + i)), h('p', null, t('r_' + i)));
    sheet(t('rulesTitle'), body);
  }

  function showOrder() {
    const man = disp && disp.manilha ? disp.manilha : null;
    const ranks = ['3', '2', 'A', 'K', 'J', 'Q', '7', '6', '5', '4'];
    const body = h('div', { class: 'tr-order' });
    if (man) {
      body.append(h('h4', null, t('orderManilhas', { r: man })), h('p', { class: 'muted' }, t('orderManilhasSub')));
      body.append(h('div', { class: 'tr-order-man' }, ...['C', 'H', 'S', 'D'].map((su, i) => h('div', { class: 'tr-om' }, cardEl(toLib(man + su), { size: 54 }), h('small', null, `${i + 1}. ${t('suit_' + su)}`)))));
    }
    body.append(h('h4', null, t('orderStrong')), h('div', { class: 'tr-order-rank' }, ...ranks.map((r, i) => h('div', { class: 'tr-or' + (r === man ? ' is-man' : '') }, h('b', null, r), h('i', null, String(ranks.length - i))))));
    body.append(h('p', { class: 'muted' }, t('orderNote')));
    sheet(t('orderTitle'), body);
  }

  function showStats() {
    const st = getStats();
    const rate = st.games ? Math.round((st.wins / st.games) * 100) + '%' : '–';
    const cell = (k, v) => h('div', { class: 'tr-stat' }, h('b', null, String(v)), h('small', null, t(k)));
    const hist = st.history && st.history.length
      ? st.history.map((x) => h('div', { class: 'tr-hist ' + (x.win ? 'w' : 'l') }, h('b', null, x.win ? t('st_win') : t('st_loss')), h('span', null, modeLabel(x.mode)), h('em', null, `${x.score[0]} × ${x.score[1]}`)))
      : [h('p', { class: 'muted' }, t('st_none'))];
    const body = h(
      'div',
      { class: 'tr-stats' },
      h('div', { class: 'tr-stat-grid' }, cell('st_games', st.games), cell('st_wins', st.wins), cell('st_losses', st.losses), cell('st_rate', rate), cell('st_hands', st.handsWon), cell('st_trucos', st.trucos), cell('st_streak', st.best)),
      h('h4', null, t('st_recent')),
      ...hist,
      btn('tr-linkbtn danger', t('st_reset'), async () => {
        const ok = await ctx.ui.modal({ title: t('st_reset'), body: t('st_resetAsk'), actions: [{ label: t('st_reset'), value: true, danger: true }, { label: t('cancel'), value: false }] });
        if (ok) {
          store.remove('stats');
          document.querySelector('.tr-sheet-wrap')?.remove();
          showStats();
        }
      }),
    );
    sheet(t('statsTitle'), body);
  }

  // ---------- start ----------
  const entryMode = ctx.mode && MODES[ctx.mode] ? ctx.mode : null;
  if (entryMode) {
    const sv = loadSave();
    if (sv && sv.mode === entryMode) resumeSaved();
    else if (sv) startMode(entryMode).then(() => { if (!m) showMenu(); });
    else {
      newMatch(entryMode);
      beginMatch(true);
    }
  } else showMenu();

  return () => {
    disposed = true;
    runId++;
    timers.forEach(clearTimeout);
    timers.clear();
    runScope();
    scopeCleanupsGlobal.forEach((f) => f());
    ctx.setHeaderRight(null);
    ctx.setTitle();
  };
}
