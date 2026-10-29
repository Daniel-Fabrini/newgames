// Button Soccer — flick soccer with caps. Menus, career, cup, shop, results.
// The match itself lives in match.js; physics.js / ai.js / render.js do the rest.

import STRINGS from './strings.js';
import { TEAMS, PITCHES, BALLS, RIMS, levelFromXP, tierStyle, roman, CHAMPIONS_TIER, QUICK_SKILL, LEAGUE_SIZE } from './data.js';
import * as C from './career.js';
import { createMatch } from './match.js';
import { capPreview, ballPreview, pitchPreview, flagSrc } from './render.js';
import { teamName, isClub, kitOf } from './teams.js';
import { FORMATIONS, FORMATION_IDS, layoutFormation, pickFormations, hashSeed, rng } from './formations.js';

const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="currentColor" aria-hidden="true">${body}</svg>`;
const ICON = {
  user: svg('<circle cx="12" cy="7.5" r="4.6"/><path d="M3 21.5c0-5.2 4-8.2 9-8.2s9 3 9 8.2z"/>'),
  users: svg('<circle cx="8.5" cy="8" r="3.8"/><circle cx="16.6" cy="7.2" r="3.2"/><path d="M1.5 20.5c0-4.4 3.2-7 7-7s7 2.6 7 7z"/><path d="M15.8 12.6c3.6-.4 6.7 1.9 6.7 6.2h-5.3c-.2-2.5-1.2-4.6-2.9-5.9z"/>'),
  trophy: svg('<path d="M6.5 2.5h11v2h3.8v2.6c0 3-2.1 5.2-4.9 5.6a6 6 0 0 1-3.9 3.6v2.4h3.6v3h-8.2v-3h3.6v-2.4a6 6 0 0 1-3.9-3.6C4.8 12.3 2.7 10.1 2.7 7.1V4.5h3.8zm-1.9 4v.6c0 1.6 1 2.9 2.4 3.4-.3-1.1-.5-2.4-.5-3.6v-.4zm14.8 0h-1.9v.4c0 1.2-.2 2.5-.5 3.6 1.4-.5 2.4-1.8 2.4-3.4z"/>'),
  career: svg('<path d="M3 21v-5h5v5zm6.5 0v-9h5v9zM16 21V7h5v14z"/><path d="M4 11.5 10.5 5l3 3L19 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  shop: svg('<path d="M5 8h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9" fill="none" stroke="currentColor" stroke-width="2"/>'),
  star: svg('<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>'),
  help: svg('<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-.1 13.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM12.2 6c-2.3 0-3.9 1.3-4 3.4h2.4c.1-.9.7-1.4 1.5-1.4.9 0 1.5.5 1.5 1.3 0 .7-.3 1.1-1.3 1.7-1.1.7-1.6 1.4-1.5 2.7v.6h2.3v-.5c0-.8.3-1.1 1.3-1.7 1.1-.7 1.8-1.5 1.8-2.9C16.2 7.3 14.6 6 12.2 6z"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z"/>'),
  lock: svg('<path d="M6 10h12v11H6z"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  check: svg('<path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  dice: svg('<path fill-rule="evenodd" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>'),
  left: svg('<path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  right: svg('<path d="M9 4.5 16.5 12 9 19.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  coin: svg('<circle cx="12" cy="12" r="10.5" fill="#a87400"/><circle cx="12" cy="11.2" r="9.6" fill="url(#gsc)"/><circle cx="12" cy="11.2" r="6.6" fill="none" stroke="#a87400" stroke-width="1.4" opacity=".55"/><path d="m12 6.8 1.3 2.7 3 .4-2.2 2.1.5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.2-2.1 3-.4z" fill="#a87400" opacity=".7"/><defs><linearGradient id="gsc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".5" stop-color="#f7d774"/><stop offset="1" stop-color="#c9971c"/></linearGradient></defs>'),
  medal: svg('<path d="M7 2h4l1 4-2.5 3.5L6 3z M17 2h-4l-1 4 2.5 3.5L18 3z"/><circle cx="12" cy="15.5" r="6.5"/>'),
  ball: svg('<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 5.2-3.4 2.5 1.3 4h4.2l1.3-4zM12 3.6c-.9 0-1.8.1-2.6.4L12 5.6 14.6 4c-.8-.3-1.7-.4-2.6-.4zM4.6 8.1A8.4 8.4 0 0 0 3.6 12l2.5 1.7.9-3.7zm14.8 0-2.4 1.9.9 3.7 2.5-1.7c0-1.4-.4-2.7-1-3.9zM8 16.4l-2.9.4a8.4 8.4 0 0 0 3.6 3.2zm8 0-.7 3.6a8.4 8.4 0 0 0 3.6-3.2z"/>'),
};
const icon = (h, name, cls = '') => h('span', { class: `g-soccer-ic ${cls}`, html: ICON[name] });

const DEFAULTS = () => ({
  coins: 0,
  v: 2,
  team: 'SPFC',
  formLock: null, // null = random formation every match
  lastForm: null,
  seedBase: Math.floor(Math.random() * 4294967296),
  matchNo: 0,
  owned: { teams: TEAMS.filter((x) => x.p === 0).map((x) => x.code), pitch: ['classic'], ball: ['classic'], rim: ['team'] },
  equip: { pitch: 'classic', ball: 'classic', rim: 'team' },
  quick: { diff: 0, len: 2 },
  pvp: { len: 2, p2: 'AR' },
  career: null,
  cup: null,
  prof: { xp: 0, rp: 0, titles: 0, cups: 0, promos: 0, legends: 0, best: 0 },
  stats: { played: 0, wins: 0, losses: 0, gf: 0, ga: 0, streak: 0, bestStreak: 0 },
  seenHelp: false,
  hinted: false,
});

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const { h, clear, modal, toast } = ctx.ui;
  const sfx = ctx.sfx;

  // ---------- save ----------
  const S = (() => {
    const d = DEFAULTS();
    const s = ctx.store.get('save', null);
    if (!s || typeof s !== 'object') return d;
    const out = { ...d, ...s };
    for (const k of ['owned', 'equip', 'quick', 'pvp', 'prof', 'stats']) out[k] = { ...d[k], ...(s[k] || {}) };
    for (const k of ['teams', 'pitch', 'ball', 'rim']) if (!Array.isArray(out.owned[k])) out.owned[k] = d.owned[k];
    // migration: v2 adds the clubs (São Paulo FC becomes the default team) and formations
    if (!(s.v >= 2)) {
      if (out.team === 'BR') out.team = 'SPFC';
      out.v = 2;
    }
    for (const x of TEAMS) if (x.p === 0 && !out.owned.teams.includes(x.code)) out.owned.teams.push(x.code);
    if (!out.owned.teams.includes(out.team) || !TEAMS.some((x) => x.code === out.team)) out.team = 'SPFC';
    if (!FORMATION_IDS.includes(out.formLock)) out.formLock = null;
    if (!Array.isArray(out.lastForm)) out.lastForm = null;
    if (!Number.isFinite(out.seedBase)) out.seedBase = Math.floor(Math.random() * 4294967296);
    if (!Number.isFinite(out.matchNo)) out.matchNo = 0;
    return out;
  })();
  const save = () => ctx.store.set('save', S);

  const tname = (code) => teamName(code, ctx.pick);
  const tierName = (tier) =>
    tier < CHAMPIONS_TIER ? t('division', { n: CHAMPIONS_TIER - tier }) : tier === CHAMPIONS_TIER ? t('champions') : t('legend', { n: roman(tier - CHAMPIONS_TIER) });
  const fmt = (n) => Math.round(n).toLocaleString(ctx.lang === 'en' ? 'en-US' : ctx.lang === 'es' ? 'es-ES' : 'pt-BR');

  let alive = true;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  // Counts a number up inside an element.
  function countUp(el, from, to, ms = 900, prefix = '', suffix = '') {
    const t0 = performance.now();
    const stepFn = (now) => {
      if (!alive) return;
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = prefix + fmt(from + (to - from) * e) + suffix;
      if (k < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }

  // ---------- header ----------
  const coinNum = h('b', null, fmt(S.coins));
  const coinPill = h('button', { class: 'g-soccer-coins', 'aria-label': t('coins'), onclick: () => (match ? null : open('shop')) }, icon(h, 'coin'), coinNum);
  const helpBtn = h('button', { class: 'icon-btn g-soccer-helpbtn', 'aria-label': t('howTo'), title: t('howTo'), html: ICON.help, onclick: () => showHelp() });
  let shownCoins = S.coins;
  function refreshCoins(animate = true) {
    if (animate && shownCoins !== S.coins) {
      countUp(coinNum, shownCoins, S.coins, 900);
      coinPill.classList.remove('bump');
      void coinPill.offsetWidth;
      coinPill.classList.add('bump');
    } else coinNum.textContent = fmt(S.coins);
    shownCoins = S.coins;
  }
  function header(kind) {
    if (kind === 'match') ctx.setHeaderRight(helpBtn);
    else ctx.setHeaderRight(coinPill);
  }

  // ---------- navigation ----------
  const ENTRY = { '1p': 'quick1', '2p': 'quick2', tournament: 'tourney' }[ctx.mode] || 'menu';
  const stack = [{ name: ENTRY }];
  let match = null;
  let matchCfg = null;
  let result = null;

  let pm = null; // pre-match screen token (cancels its auto-start)
  function render() {
    pm = null;
    if (match) {
      match.destroy();
      match = null;
    }
    result = null;
    clear(root);
    header('menu');
    const top = stack[stack.length - 1];
    const el = SCREENS[top.name](top.opts || {});
    el.classList.add('g-soccer-enter');
    root.append(el);
  }
  function open(name, opts) {
    sfx.play('tap');
    stack.push({ name, opts });
    render();
  }
  function back() {
    if (stack.length <= 1) return false;
    stack.pop();
    render();
    return true;
  }
  ctx.onBack(() => {
    if (match && !result) {
      askLeave();
      return true;
    }
    if (result) {
      render();
      return true;
    }
    return back();
  });

  // ---------- small UI builders ----------
  function capCanvas(code, side, rim, px) {
    const holder = h('span', { class: 'g-soccer-cap', style: { width: px + 'px', height: px + 'px' } });
    capPreview(code, side, rim, px).then((c) => alive && holder.append(c));
    return holder;
  }
  const flagImg = (code, cls = '') => h('img', { class: `g-soccer-flag ${cls} ${isClub(code) ? 'club' : ''}`, src: flagSrc(code), alt: '', draggable: 'false' });
  function screen(cls, ...kids) {
    return h('div', { class: `screen g-soccer-screen ${cls}` }, ...kids);
  }
  function stagger(el) {
    [...el.children].forEach((c, i) => {
      c.classList.add('g-soccer-rise');
      c.style.animationDelay = `${i * 45}ms`;
    });
    return el;
  }
  function tierBadge(tier, big = false) {
    const st = tierStyle(tier);
    return h('span', { class: `g-soccer-tier ${big ? 'big' : ''}`, style: { background: st.grad } }, h('i', null, st.icon), h('span', null, tierName(tier)));
  }
  function levelBlock() {
    const lv = levelFromXP(S.prof.xp);
    return h(
      'div',
      { class: 'g-soccer-level' },
      h('div', { class: 'g-soccer-lvbadge' }, h('small', null, t('lvl')), h('b', null, lv.level)),
      h(
        'div',
        { class: 'g-soccer-lvbody' },
        h('div', { class: 'g-soccer-lvtop' }, h('span', null, t('careerLevel')), h('span', { class: 'g-soccer-rp' }, icon(h, 'career'), t('rankPts', { n: fmt(S.prof.rp) }))),
        h('div', { class: 'progress g-soccer-bar' }, h('i', { style: { width: `${(100 * lv.into) / lv.need}%` } })),
        h('small', { class: 'g-soccer-xptext' }, t('xpOf', { a: fmt(lv.into), b: fmt(lv.need) })),
      ),
    );
  }

  // ---------- career / cup state ----------
  function ensureCareer() {
    if (!S.career) {
      S.career = { tier: 0, seasonNo: 1, season: C.newSeason(0, S.team, 1) };
      save();
    }
    const se = S.career.season;
    if (se.teams[0] !== S.team) {
      const j = se.teams.indexOf(S.team);
      if (j > 0) se.teams[j] = se.teams[0];
      se.teams[0] = S.team;
    }
    return S.career;
  }
  function ensureCup() {
    if (!S.cup || S.cup.out) {
      S.cup = C.newCup(S.prof.cups, S.team);
      save();
    }
    const j = S.cup.opps.indexOf(S.team);
    if (j >= 0) {
      // the player switched to a team that was in the draw: swap in another rival
      const free = TEAMS.find((x) => x.code !== S.team && !S.cup.opps.includes(x.code));
      S.cup.opps[j] = free.code;
      save();
    }
    return S.cup;
  }
  const cupRoundName = (r) => t(['r16', 'qf', 'sf', 'final'][r]);

  // ---------- screens ----------
  const SCREENS = {
    menu() {
      const ca = ensureCareer();
      const se = ca.season;
      const profile = h(
        'button',
        { class: 'g-soccer-profile', onclick: () => open('shop', { tab: 'teams' }) },
        capCanvas(S.team, 0, S.equip.rim, 66),
        h('div', { class: 'g-soccer-pbody' }, h('small', null, t('yourTeam')), h('b', null, tname(S.team)), h('span', { class: 'g-soccer-change' }, t('change'))),
        h('div', { class: 'g-soccer-trophies' }, icon(h, 'trophy'), h('b', null, S.prof.titles + S.prof.cups)),
      );
      const careerCard = h(
        'button',
        { class: 'g-soccer-cta', onclick: () => open('career') },
        h('span', { class: 'g-soccer-cta-ic' }, tierStyle(ca.tier).icon),
        h('span', { class: 'g-soccer-cta-body' }, h('small', null, t('career')), h('b', null, tierName(ca.tier)), h('span', null, t('seasonRound', { s: ca.seasonNo, r: Math.min(se.round + 1, se.rounds.length), n: se.rounds.length }))),
        h('span', { class: 'g-soccer-cta-play' }, icon(h, 'play')),
      );
      const tile = (ic, label, fn) => h('button', { class: 'g-soccer-tile', onclick: fn }, icon(h, ic), h('span', null, label));
      return screen(
        'g-soccer-menu',
        stagger(
          h(
            'div',
            { class: 'stack' },
            profile,
            levelBlock(),
            careerCard,
            h('div', { class: 'g-soccer-tiles' }, tile('user', t('onePlayer'), () => open('quick1')), tile('users', t('twoPlayers'), () => open('quick2')), tile('trophy', t('tournaments'), () => open('tourney'))),
            h(
              'div',
              { class: 'list' },
              listItem('shop', t('shop'), t('shopSub'), () => open('shop')),
              listItem('star', t('trophyRoom'), t('trophyRoomSub'), () => open('profile')),
              listItem('help', t('howTo'), t('howToSub'), () => showHelp()),
            ),
          ),
        ),
      );
    },

    tourney() {
      const ca = ensureCareer();
      const cup = ensureCup();
      const se = ca.season;
      return screen(
        'g-soccer-tourney',
        stagger(
          h(
            'div',
            { class: 'stack' },
            h('h2', { class: 'g-soccer-h' }, t('tournaments')),
            h(
              'button',
              { class: 'g-soccer-bigcard', onclick: () => open('career') },
              h('div', { class: 'g-soccer-bc-top' }, icon(h, 'career', 'gold'), h('b', null, t('career')), tierBadge(ca.tier)),
              h('p', null, t('careerDesc')),
              h('div', { class: 'g-soccer-bc-foot' }, h('span', null, t('seasonRound', { s: ca.seasonNo, r: Math.min(se.round + 1, se.rounds.length), n: se.rounds.length })), h('span', { class: 'btn primary small' }, t('play'))),
            ),
            h(
              'button',
              { class: 'g-soccer-bigcard', onclick: () => open('cup') },
              h('div', { class: 'g-soccer-bc-top' }, icon(h, 'trophy', 'gold'), h('b', null, t('cupN', { n: cup.level + 1 })), h('span', { class: 'g-soccer-pill' }, cupRoundName(Math.min(cup.round, 3)))),
              h('p', null, t('cupDesc')),
              h('div', { class: 'g-soccer-bc-foot' }, h('span', null, t('cupsWon', { n: S.prof.cups })), h('span', { class: 'btn primary small' }, t('play'))),
            ),
            formPicker(),
            levelBlock(),
          ),
        ),
      );
    },

    quick1() {
      return quickScreen(false);
    },
    quick2() {
      return quickScreen(true);
    },

    career() {
      const ca = ensureCareer();
      const se = ca.season;
      const order = C.standings(se);
      const T = se.table;
      const rows = order.map((i, pos) => {
        const r = T[i];
        const zone = pos < 2 ? 'up' : pos === LEAGUE_SIZE - 1 && ca.tier > 0 ? 'down' : '';
        return h(
          'div',
          { class: `g-soccer-tr ${zone} ${i === 0 ? 'me' : ''}` },
          h('span', { class: 'pos' }, pos + 1),
          flagImg(se.teams[i]),
          h('span', { class: 'nm' }, tname(se.teams[i])),
          h('span', null, r.p),
          h('span', null, r.w),
          h('span', null, (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga)),
          h('b', null, r.pts),
        );
      });
      const oppI = C.currentOpponent(se);
      const oppCode = se.teams[oppI];
      const goals = C.seasonGoals(se);
      return screen(
        'g-soccer-career',
        stagger(
          h(
            'div',
            { class: 'stack' },
            h(
              'div',
              { class: 'g-soccer-chead' },
              tierBadge(ca.tier, true),
              h('div', { class: 'g-soccer-cmeta' }, h('span', null, t('seasonN', { n: ca.seasonNo })), h('span', null, t('roundOf', { r: se.round + 1, n: se.rounds.length }))),
            ),
            h(
              'div',
              { class: 'g-soccer-table' },
              h('div', { class: 'g-soccer-tr head' }, h('span', { class: 'pos' }, '#'), h('span', { class: 'fl' }), h('span', { class: 'nm' }, t('team')), h('span', null, t('colP')), h('span', null, t('colW')), h('span', null, t('colGD')), h('b', null, t('colPts'))),
              rows,
            ),
            h('div', { class: 'g-soccer-legend' }, h('span', { class: 'up' }, t('zoneUp')), ca.tier > 0 ? h('span', { class: 'down' }, t('zoneDown')) : null),
            h(
              'div',
              { class: 'g-soccer-next' },
              h('small', null, t('nextMatch')),
              h('div', { class: 'g-soccer-vs' }, capCanvas(S.team, 0, S.equip.rim, 50), h('b', null, t('vs')), capCanvas(oppCode, 1, 'team', 50)),
              h('div', { class: 'g-soccer-vsnames' }, h('span', null, tname(S.team)), h('span', null, tname(oppCode))),
              h('small', { class: 'muted' }, t('firstTo', { n: goals })),
              formPicker(),
              h(
                'button',
                {
                  class: 'btn primary big block',
                  onclick: () =>
                    startMatch({ kind: 'career', teams: [S.team, oppCode], cpu: [false, true], skill: C.seasonSkill(se, oppI), goals }),
                },
                icon(h, 'play'),
                t('play'),
              ),
            ),
          ),
        ),
      );
    },

    cup() {
      const cup = ensureCup();
      const rows = cup.opps.map((code, r) => {
        const st = r < cup.round ? 'done' : r === cup.round ? 'cur' : 'lock';
        return h(
          'div',
          { class: `g-soccer-rung ${st}` },
          flagImg(code),
          h('span', { class: 'g-soccer-rbody' }, h('small', { class: 'rn' }, cupRoundName(r)), h('span', { class: 'nm' }, tname(code))),
          h('span', { class: 'st' }, st === 'done' ? icon(h, 'check') : st === 'lock' ? icon(h, 'lock') : icon(h, 'play')),
        );
      });
      const code = cup.opps[cup.round];
      return screen(
        'g-soccer-cupscr',
        stagger(
          h(
            'div',
            { class: 'stack' },
            h('div', { class: 'g-soccer-cuphead' }, h('div', { class: 'g-soccer-bigtrophy' }, icon(h, 'trophy')), h('b', null, t('cupN', { n: cup.level + 1 })), h('small', null, t('cupsWon', { n: S.prof.cups }))),
            h('div', { class: 'g-soccer-ladder' }, rows.slice().reverse()),
            formPicker(),
            h(
              'button',
              {
                class: 'btn primary big block',
                onclick: () => startMatch({ kind: 'cup', teams: [S.team, code], cpu: [false, true], skill: C.cupSkill(cup), goals: C.cupGoals(cup) }),
              },
              icon(h, 'play'),
              t('playRound', { r: cupRoundName(cup.round) }),
            ),
            h('p', { class: 'small muted g-soccer-center' }, t('cupRule')),
          ),
        ),
      );
    },

    shop(opts) {
      let tab = opts.tab || 'teams';
      const body = h('div', { class: 'g-soccer-shopgrid' });
      const tabs = h('div', { class: 'chips g-soccer-tabs' });
      const TABS = [
        ['teams', t('tabTeams')],
        ['pitch', t('tabPitch')],
        ['ball', t('tabBall')],
        ['rim', t('tabRim')],
      ];
      const hero = h('div', { class: 'g-soccer-hero' });
      function draw() {
        clear(hero);
        if (tab === 'teams')
          hero.append(flagImg(S.team, 'hero'), h('div', { class: 'g-soccer-herotxt' }, h('small', null, isClub(S.team) ? t('yourClub') : t('yourTeam')), h('b', null, tname(S.team))));
        hero.style.display = tab === 'teams' ? '' : 'none';
        clear(tabs);
        for (const [id, label] of TABS)
          tabs.append(
            h('button', { class: `chip ${tab === id ? 'active' : ''}`, onclick: () => ((tab = id), sfx.play('tap'), (stack[stack.length - 1].opts = { tab }), draw()) }, label),
          );
        clear(body);
        const items =
          tab === 'teams'
            ? TEAMS.map((x) => ({ id: x.code, p: x.p, name: tname(x.code), prev: () => flagImg(x.code, 'sq') }))
            : tab === 'pitch'
              ? PITCHES.map((x) => ({ id: x.id, p: x.p, name: t('pitch_' + x.id), prev: () => pitchPreview(x.id, 64, 88) }))
              : tab === 'ball'
                ? BALLS.map((x) => ({ id: x.id, p: x.p, name: t('ball_' + x.id), prev: () => ballPreview(x.id, 76) }))
                : RIMS.map((x) => ({ id: x.id, p: x.p, name: t('rim_' + x.id), prev: () => capCanvas(S.team, 0, x.id, 72) }));
        const ownedList = S.owned[tab];
        const equipped = tab === 'teams' ? S.team : S.equip[tab];
        // owned first, then by price
        items.sort((a, b) => (ownedList.includes(b.id) ? 1 : 0) - (ownedList.includes(a.id) ? 1 : 0) || a.p - b.p);
        items.forEach((it, i) => {
          const owned = ownedList.includes(it.id);
          const on = equipped === it.id;
          const card = h(
            'button',
            {
              class: `g-soccer-item ${on ? 'on' : ''} ${owned ? '' : 'locked'}`,
              style: { animationDelay: `${Math.min(i, 16) * 25}ms` },
              onclick: () => buy(tab, it),
            },
            h('div', { class: 'g-soccer-itprev' }, it.prev()),
            h('span', { class: 'g-soccer-itname' }, it.name),
            on
              ? h('span', { class: 'g-soccer-ittag on' }, icon(h, 'check'), t('inUse'))
              : owned
                ? h('span', { class: 'g-soccer-ittag' }, t('use'))
                : h('span', { class: 'g-soccer-ittag price' }, icon(h, 'coin'), fmt(it.p)),
          );
          body.append(card);
        });
      }
      async function buy(kind, it) {
        const owned = S.owned[kind].includes(it.id);
        if (!owned) {
          if (S.coins < it.p) {
            sfx.play('error');
            toast(t('needCoins', { n: fmt(it.p - S.coins) }));
            return;
          }
          const ok = await modal({
            title: t('buyTitle'),
            body: t('buyText', { item: it.name, n: fmt(it.p) }),
            actions: [
              { label: t('buy'), value: true, primary: true },
              { label: t('cancel'), value: false },
            ],
            dismissible: true,
          });
          if (!ok || !alive) return;
          S.coins -= it.p;
          S.owned[kind].push(it.id);
          sfx.play('coin');
          sfx.vibrate(20);
          refreshCoins();
        } else sfx.play('select');
        if (kind === 'teams') S.team = it.id;
        else S.equip[kind] = it.id;
        save();
        draw();
      }
      draw();
      return screen('g-soccer-shop', h('h2', { class: 'g-soccer-h' }, t('shop')), hero, tabs, body);
    },

    profile() {
      const st = S.stats;
      const pct = st.played ? Math.round((100 * st.wins) / st.played) : 0;
      const ca = ensureCareer();
      const cell = (ic, n, label) => h('div', { class: 'g-soccer-stat' }, h('span', { class: 'g-soccer-sic' }, ic), h('b', null, n), h('small', null, label));
      return screen(
        'g-soccer-profilescr',
        stagger(
          h(
            'div',
            { class: 'stack' },
            h('h2', { class: 'g-soccer-h' }, t('trophyRoom')),
            levelBlock(),
            h('div', { class: 'g-soccer-cabinet' }, cell('🏆', S.prof.titles, t('leagueTitles')), cell('🥇', S.prof.cups, t('cupTitles')), cell('⬆️', S.prof.promos, t('promotions')), cell('👑', S.prof.legends, t('legendTitles'))),
            h('div', { class: 'g-soccer-bestdiv' }, h('small', null, t('bestTier')), tierBadge(Math.max(S.prof.best, ca.tier))),
            h('div', { class: 'section-title' }, t('stats')),
            h(
              'div',
              { class: 'g-soccer-statgrid' },
              cell('⚽', fmt(st.played), t('played')),
              cell('✅', fmt(st.wins), t('wins')),
              cell('❌', fmt(st.losses), t('losses')),
              cell('📊', pct + '%', t('winRate')),
              cell('🥅', fmt(st.gf), t('goalsFor')),
              cell('🧤', fmt(st.ga), t('goalsAgainst')),
              cell('🔥', fmt(st.streak), t('streak')),
              cell('⭐', fmt(st.bestStreak), t('bestStreak')),
            ),
          ),
        ),
      );
    },
  };

  function listItem(ic, title, sub, fn) {
    return h('button', { class: 'list-item', onclick: fn }, h('span', { class: 'li-icon' }, icon(h, ic, 'gold')), h('span', { class: 'li-body' }, h('div', { class: 'li-title' }, title), sub ? h('div', { class: 'li-sub' }, sub) : null), h('span', { class: 'li-right' }, icon(h, 'right', 'chev')));
  }

  function quickScreen(pvp) {
    const q = pvp ? S.pvp : S.quick;
    const others = () => TEAMS.filter((x) => x.code !== S.team);
    let opp = pvp ? (q.p2 !== S.team ? q.p2 : others()[0].code) : others()[(Math.random() * others().length) | 0].code;
    const oppCap = h('div', { class: 'g-soccer-oppcap' });
    const oppName = h('span', null);
    function setOpp(code) {
      opp = code;
      clear(oppCap).append(capCanvas(code, 1, 'team', 70));
      oppName.textContent = tname(code);
      if (pvp) {
        S.pvp.p2 = code;
        save();
      }
    }
    function cycle(d) {
      const list = others();
      const i = list.findIndex((x) => x.code === opp);
      setOpp(list[(i + d + list.length) % list.length].code);
      sfx.play('tap');
    }
    setOpp(opp);
    const chips = (items, get, set) => {
      const wrap = h('div', { class: 'chips g-soccer-chips' });
      const draw = () => {
        clear(wrap);
        for (const [v, label] of items) wrap.append(h('button', { class: `chip ${get() === v ? 'active' : ''}`, onclick: () => (set(v), save(), sfx.play('tap'), draw(), drawReward()) }, label));
      };
      draw();
      return wrap;
    };
    const reward = h('div', { class: 'g-soccer-reward' });
    function drawReward() {
      if (pvp) return;
      const r = C.matchReward('quick', true, 0, { diff: S.quick.diff });
      clear(reward).append(h('span', null, t('winReward')), icon(h, 'coin'), h('b', null, '+' + r.coins));
    }
    drawReward();
    const lenItems = [
      [2, t('goalsN', { n: 2 })],
      [3, t('goalsN', { n: 3 })],
      [5, t('goalsN', { n: 5 })],
      ['t', t('minutes', { n: 3 })],
    ];
    const start = () => {
      const len = q.len;
      startMatch({
        kind: pvp ? 'pvp' : 'quick',
        teams: [S.team, opp],
        cpu: [false, !pvp],
        skill: QUICK_SKILL[S.quick.diff],
        diff: S.quick.diff,
        goals: len === 't' ? 99 : len,
        timed: len === 't' ? 180 : 0,
      });
    };
    return screen(
      'g-soccer-quick',
      stagger(
        h(
          'div',
          { class: 'stack' },
          h('h2', { class: 'g-soccer-h' }, pvp ? t('twoPlayers') : t('quickMatch')),
          h(
            'div',
            { class: 'g-soccer-matchup' },
            h('div', { class: 'g-soccer-side' }, capCanvas(S.team, 0, S.equip.rim, 70), h('small', null, pvp ? t('player', { n: 1 }) : t('you')), h('span', null, tname(S.team))),
            h('div', { class: 'g-soccer-vsbig' }, t('vs')),
            h(
              'div',
              { class: 'g-soccer-side' },
              oppCap,
              h('small', null, pvp ? t('player', { n: 2 }) : t('cpu')),
              oppName,
              pvp
                ? h('div', { class: 'g-soccer-arrows' }, h('button', { class: 'icon-btn', 'aria-label': t('prev'), html: ICON.left, onclick: () => cycle(-1) }), h('button', { class: 'icon-btn', 'aria-label': t('next'), html: ICON.right, onclick: () => cycle(1) }))
                : h('button', { class: 'icon-btn g-soccer-dice', 'aria-label': t('randomTeam'), title: t('randomTeam'), html: ICON.dice, onclick: () => cycle(1 + ((Math.random() * (others().length - 1)) | 0)) }),
            ),
          ),
          pvp ? h('p', { class: 'small muted g-soccer-center' }, t('pvpInfo')) : null,
          pvp ? null : h('div', { class: 'section-title' }, t('difficulty')),
          pvp
            ? null
            : chips(
                [
                  [0, t('easy')],
                  [1, t('medium')],
                  [2, t('hard')],
                ],
                () => S.quick.diff,
                (v) => (S.quick.diff = v),
              ),
          h('div', { class: 'section-title' }, t('length')),
          chips(lenItems, () => q.len, (v) => (q.len = v)),
          formPicker(),
          pvp ? null : reward,
          h('button', { class: 'btn primary big block', onclick: start }, icon(h, 'play'), t('start')),
        ),
      ),
    );
  }

  // ---------- help ----------
  let helpOpen = false;
  async function showHelp() {
    if (helpOpen) return;
    helpOpen = true;
    if (S.seenHelp) sfx.play('tap');
    if (match) match.pause();
    const steps = [
      ['👆', t('help1')],
      ['🎯', t('help2')],
      ['⏱️', t('help3')],
      ['⚽', t('help4')],
      ['🏆', t('help5')],
    ];
    const body = h('div', { class: 'g-soccer-help' }, steps.map(([e, s]) => h('div', { class: 'g-soccer-hrow' }, h('span', { class: 'g-soccer-hic' }, e), h('span', null, s))));
    await modal({ title: t('howTo'), body, actions: [{ label: t('gotIt'), value: true, primary: true }], dismissible: true });
    helpOpen = false;
    if (!S.seenHelp) {
      S.seenHelp = true;
      save();
    }
    if (match && !result && alive) match.resume();
  }

  // ---------- matches ----------
  // Disc colours used in the mini formation diagram.
  const discColors = (code, side) => {
    const k = kitOf(code);
    if (k) return { fill: k.dome[1], ring: k.ring[1] };
    return side === 0 ? { fill: '#e5261c', ring: '#f6c21a' } : { fill: '#1f5fe0', ring: '#e4e8ee' };
  };
  // Mini pitch with both formations (you at the bottom, as in the match).
  function formDiagram(forms, teams) {
    const parts = [
      '<svg viewBox="-4 -4 108 178" class="g-soccer-diag" aria-hidden="true">',
      '<rect x="-3" y="-3" width="106" height="176" rx="7" fill="#5a2c0e"/>',
      '<rect x="0" y="0" width="100" height="170" rx="3" fill="#2f8f3a"/>',
      ...[0, 1, 2, 3, 4, 5].map((i) => `<rect x="0" y="${i * 28.33}" width="100" height="14.17" fill="#37a043" opacity=".55"/>`),
      '<g fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.1"><rect x="1.4" y="1.4" width="97.2" height="167.2"/><path d="M1.4 85H98.6"/><circle cx="50" cy="85" r="14"/><path d="M18 1.4v23h64v-23M18 168.6v-23h64v23"/></g>',
    ];
    for (let side = 0; side < 2; side++) {
      const c = discColors(teams[side], side);
      layoutFormation(forms[side]).forEach(([x, y], i) => {
        const px = side ? 100 - x : x;
        const py = side ? 170 - y : y;
        parts.push(`<circle cx="${px}" cy="${py + 1.2}" r="5.4" fill="rgba(0,0,0,.35)"/><circle cx="${px}" cy="${py}" r="5.2" fill="${c.fill}" stroke="${c.ring}" stroke-width="1.8"/>`);
        if (i === 0) parts.push(`<circle cx="${px}" cy="${py}" r="1.7" fill="#fff"/>`);
      });
    }
    parts.push('<circle cx="50" cy="85" r="2.6" fill="#fff" stroke="#111" stroke-width=".7"/></svg>');
    return h('div', { class: 'g-soccer-diagwrap', html: parts.join('') });
  }

  // "Aleatória" (default) or a locked formation for your side.
  function formPicker() {
    const wrap = h('div', { class: 'chips g-soccer-chips g-soccer-formchips' });
    const draw = () => {
      clear(wrap);
      for (const [v, label] of [[null, t('formRandom')], ...FORMATIONS.map((f) => [f.id, f.id])])
        wrap.append(h('button', { class: `chip ${S.formLock === v ? 'active' : ''}`, onclick: () => ((S.formLock = v), save(), sfx.play('tap'), draw()) }, v === null ? '🎲 ' + label : label));
    };
    draw();
    return h('div', { class: 'g-soccer-formpick' }, h('div', { class: 'section-title' }, t('formation')), wrap, h('small', { class: 'muted' }, t('formLockHint')));
  }

  function startMatch(cfg) {
    sfx.play('select');
    if (match) match.destroy();
    match = null;
    result = null;
    // seeded per match (save seed + match counter + round) so every match differs but is reproducible
    const ca = S.career?.season;
    const round = cfg.kind === 'career' && ca ? ca.round + 10 * ca.tier : cfg.kind === 'cup' && S.cup ? S.cup.round + 10 * S.cup.level : 0;
    const seed = hashSeed(S.seedBase, S.matchNo++, cfg.kind, round, cfg.teams.join('-'));
    const forms = pickFormations(rng(seed), { lock: S.formLock, prev: S.lastForm });
    S.lastForm = forms;
    save();
    showPrematch(cfg, forms, seed);
  }

  function showPrematch(cfg, forms, seed) {
    clear(root);
    header('menu');
    const token = {};
    pm = token;
    const go = () => {
      if (pm !== token || !alive) return;
      pm = null;
      beginMatch(cfg, forms, seed);
    };
    const pvp = cfg.kind === 'pvp';
    const style = ['attacking', 'balanced', 'cautious'][hashSeed(seed, 'style') % 3];
    const cd = h('small', { class: 'muted g-soccer-center' }, '');
    const side = (i, who) =>
      h('div', { class: 'g-soccer-pmside' }, capCanvas(cfg.teams[i], i, i === 0 ? S.equip.rim : 'team', 58), h('b', null, tname(cfg.teams[i])), h('span', { class: 'g-soccer-pmform' }, h('small', null, who), h('i', null, forms[i])));
    const el = screen(
      'g-soccer-prematch',
      stagger(
        h(
          'div',
          { class: 'stack' },
          h('h2', { class: 'g-soccer-h g-soccer-center' }, t('formationVs', { a: forms[0], b: forms[1] })),
          h('div', { class: 'g-soccer-pmrow' }, side(0, pvp ? t('player', { n: 1 }) : t('formYou')), formDiagram(forms, cfg.teams), side(1, pvp ? t('player', { n: 2 }) : t('formRival'))),
          pvp ? null : h('div', { class: 'g-soccer-pmstyle' }, h('small', null, t('rivalStyle')), h('b', null, t('style_' + style))),
          h('button', { class: 'btn primary big block', onclick: go }, icon(h, 'play'), t('kickOffNow')),
          cd,
        ),
      ),
    );
    root.append(el);
    // the match starts by itself after a short look at the formations (tap to skip)
    let n = 5;
    cd.textContent = t('pmStarting', { n });
    const tick = () => {
      if (pm !== token || !alive) return;
      n--;
      if (n <= 0) return go();
      cd.textContent = t('pmStarting', { n });
      later(tick, 1000);
    };
    later(tick, 1000);
  }

  function beginMatch(cfg, forms, seed) {
    clear(root);
    header('match');
    matchCfg = cfg;
    result = null;
    const names = [
      cfg.kind === 'pvp' ? `${t('player', { n: 1 })} · ${tname(cfg.teams[0])}` : tname(cfg.teams[0]),
      cfg.kind === 'pvp' ? `${t('player', { n: 2 })} · ${tname(cfg.teams[1])}` : tname(cfg.teams[1]),
    ];
    match = createMatch(root, ctx, t, {
      teams: cfg.teams,
      names,
      cpu: cfg.cpu,
      skill: cfg.skill || 0,
      goals: cfg.goals,
      timed: cfg.timed || 0,
      pitch: S.equip.pitch,
      ball: S.equip.ball,
      rim: S.equip.rim,
      hint: !S.hinted,
      forms,
      seed,
      onEnd: (res) => onMatchEnd(cfg, res),
    });
  }

  async function askLeave() {
    if (!match || result || match.over) return;
    match.pause();
    const counts = matchCfg.kind === 'career' || matchCfg.kind === 'cup';
    const ok = await modal({
      title: t('leaveTitle'),
      body: counts ? t('leaveLoss') : t('leaveText'),
      actions: [
        { label: t('keepPlaying'), value: false, primary: true },
        { label: t('leave'), value: true, danger: true },
      ],
    });
    if (!alive || !match || result) return;
    if (!ok) {
      match.resume();
      return;
    }
    if (counts && !match.over) applyResult(matchCfg, { score: [0, matchCfg.goals], winner: 1 }, true);
    render();
  }

  // Applies a finished match to the save and returns what to show.
  function applyResult(cfg, res, forfeit = false) {
    const won = res.winner === 0;
    const out = { won, coins: 0, cxp: 0, rp: 0, xp: 0, events: [] };
    const lvBefore = levelFromXP(S.prof.xp).level;
    if (cfg.kind !== 'pvp') {
      const st = S.stats;
      st.played++;
      st.gf += res.score[0];
      st.ga += res.score[1];
      if (won) {
        st.wins++;
        st.streak++;
        st.bestStreak = Math.max(st.bestStreak, st.streak);
      } else {
        st.losses++;
        st.streak = 0;
      }
    }
    const add = (r) => {
      out.coins += r.coins;
      out.cxp += r.cxp;
      out.rp += r.rp;
    };
    if (cfg.kind === 'pvp') {
      out.xp = 5;
    } else {
      out.xp = won ? 20 : 5;
      if (cfg.kind === 'quick' && !forfeit) add(C.matchReward('quick', won, res.score[0], { diff: cfg.diff }));
      if (cfg.kind === 'career') {
        const ca = ensureCareer();
        const se = ca.season;
        if (!forfeit) add(C.matchReward('career', won, res.score[0], { tier: ca.tier }));
        C.playRound(se, res.score[0], res.score[1]);
        if (C.seasonOver(se)) {
          const o = C.seasonOutcome(se);
          const oldTier = ca.tier;
          const newTier = C.nextTier(oldTier, o);
          add(C.seasonReward(oldTier, o));
          if (o.champion) {
            S.prof.titles++;
            out.xp += 50;
            if (C.isLegend(oldTier)) S.prof.legends++;
          }
          if (o.promoted) {
            S.prof.promos++;
            out.xp += 30;
          }
          S.prof.best = Math.max(S.prof.best, newTier);
          out.events.push({ type: 'season', o, oldTier, newTier, pos: o.pos });
          ca.tier = newTier;
          ca.seasonNo++;
          ca.season = C.newSeason(newTier, S.team, ca.seasonNo);
        }
      }
      if (cfg.kind === 'cup') {
        const cup = ensureCup();
        if (!forfeit) add(C.matchReward('cup', won, res.score[0], { level: cup.level, round: cup.round }));
        if (won) {
          cup.round++;
          if (cup.round >= C.CUP_ROUNDS) {
            add(C.cupReward(cup.level));
            S.prof.cups++;
            out.xp += 40;
            out.events.push({ type: 'cupWon', level: cup.level });
            S.cup = C.newCup(S.prof.cups, S.team);
          }
        } else {
          cup.out = true;
          out.events.push({ type: 'cupOut', round: cup.round });
        }
      }
    }
    S.coins += out.coins;
    S.prof.xp += out.cxp;
    S.prof.rp = Math.max(0, S.prof.rp + out.rp);
    const lvAfter = levelFromXP(S.prof.xp).level;
    out.levelUp = lvAfter > lvBefore ? lvAfter : 0;
    if (out.levelUp) {
      let bonus = 0;
      for (let l = lvBefore + 1; l <= lvAfter; l++) bonus += 25 + l * 5;
      S.coins += bonus;
      out.levelBonus = bonus;
    }
    S.hinted = true;
    save();
    if (!forfeit) ctx.addXP?.(out.xp);
    refreshCoins(!forfeit);
    return out;
  }

  function onMatchEnd(cfg, res) {
    if (!alive) return;
    const lvBefore = levelFromXP(S.prof.xp);
    const out = applyResult(cfg, res);
    const humanWon = res.winner === 0;
    if (cfg.kind === 'pvp') sfx.play('win');
    else sfx.play(humanWon ? 'win' : 'lose');
    if (humanWon || cfg.kind === 'pvp') ctx.ui.confetti();
    showResult(cfg, res, out, lvBefore);
  }

  function showResult(cfg, res, out, lvBefore) {
    const pvp = cfg.kind === 'pvp';
    const won = res.winner === 0;
    const title = pvp ? t('playerWins', { n: res.winner + 1 }) : won ? t('victory') : t('defeat');
    const rows = [];
    // season / cup events
    for (const e of out.events) {
      if (e.type === 'season') {
        const lines = [h('b', null, e.o.champion ? t('seasonChampion', { tier: tierName(e.oldTier) }) : t('seasonPos', { n: e.pos }))];
        if (e.newTier > e.oldTier) lines.push(h('span', { class: 'up' }, t('promotedTo', { tier: tierName(e.newTier) })));
        else if (e.newTier < e.oldTier) lines.push(h('span', { class: 'down' }, t('relegatedTo', { tier: tierName(e.newTier) })));
        else lines.push(h('span', null, t('stayIn', { tier: tierName(e.newTier) })));
        rows.push(h('div', { class: `g-soccer-event ${e.o.champion ? 'gold' : ''}` }, h('span', { class: 'ev-ic' }, e.o.champion ? '🏆' : e.newTier > e.oldTier ? '⬆️' : e.newTier < e.oldTier ? '⬇️' : '📋'), h('div', null, lines)));
      }
      if (e.type === 'cupWon') rows.push(h('div', { class: 'g-soccer-event gold' }, h('span', { class: 'ev-ic' }, '🏆'), h('div', null, h('b', null, t('cupChampion', { n: e.level + 1 })), h('span', null, t('cupNext')))));
      if (e.type === 'cupOut') rows.push(h('div', { class: 'g-soccer-event' }, h('span', { class: 'ev-ic' }, '💔'), h('div', null, h('b', null, t('cupOut', { r: cupRoundName(e.round) })), h('span', null, t('cupRetry')))));
    }
    const coinEl = h('b', null, '+0');
    const cxpEl = h('b', null, '+0 XP');
    const bar = h('i', { style: { width: `${(100 * lvBefore.into) / lvBefore.need}%` } });
    const lvNum = h('b', { class: 'g-soccer-rlv' }, lvBefore.level);
    const rewardBox = pvp
      ? null
      : h(
          'div',
          { class: 'g-soccer-rewards' },
          h('div', { class: 'g-soccer-rwrow' }, icon(h, 'coin'), h('span', null, t('coins')), coinEl),
          out.rp ? h('div', { class: 'g-soccer-rwrow' }, icon(h, 'career', 'gold'), h('span', null, t('ranking')), h('b', { class: out.rp < 0 ? 'neg' : '' }, (out.rp > 0 ? '+' : '') + out.rp)) : null,
          h('div', { class: 'g-soccer-rwrow xp' }, h('span', { class: 'g-soccer-lvmini' }, h('small', null, t('lvl')), lvNum), h('div', { class: 'progress g-soccer-bar' }, bar), cxpEl),
          out.levelUp ? h('div', { class: 'g-soccer-lvup' }, '⭐ ', t('levelUp', { n: out.levelUp }), ' ', icon(h, 'coin'), '+' + out.levelBonus) : null,
        );
    const actions = h('div', { class: 'g-soccer-ractions' });
    const toScreen = (name) => {
      while (stack.length > 1 && stack[stack.length - 1].name !== name) stack.pop();
      if (stack[stack.length - 1].name !== name) stack.push({ name });
      render();
    };
    if (cfg.kind === 'career') actions.append(h('button', { class: 'btn primary big block', onclick: () => toScreen('career') }, t('continue')));
    else if (cfg.kind === 'cup') actions.append(h('button', { class: 'btn primary big block', onclick: () => toScreen('cup') }, t('continue')));
    else {
      actions.append(h('button', { class: 'btn primary big block', onclick: () => startMatch(cfg) }, icon(h, 'play'), t('playAgain')));
      actions.append(h('button', { class: 'btn ghost block', onclick: () => render() }, t('back')));
    }
    const panel = h(
      'div',
      { class: `g-soccer-rpanel ${won || pvp ? 'win' : 'lose'}` },
      h('div', { class: 'g-soccer-rcrown' }, won || pvp ? '🏆' : '😓'),
      h('div', { class: 'g-soccer-rtitle' }, title),
      h(
        'div',
        { class: 'g-soccer-rscore' },
        h('span', { class: 'g-soccer-rteam' }, flagImg(cfg.teams[0], 'sq side0'), h('small', null, tname(cfg.teams[0]))),
        h('b', null, `${res.score[0]} - ${res.score[1]}`),
        h('span', { class: 'g-soccer-rteam' }, flagImg(cfg.teams[1], 'sq side1'), h('small', null, tname(cfg.teams[1]))),
      ),
      rows,
      rewardBox,
      actions,
    );
    result = h('div', { class: 'g-soccer-result' }, panel);
    root.append(result);
    if (!pvp) {
      // reward animations
      later(() => countUp(coinEl, 0, out.coins, 900, '+'), 450);
      later(() => {
        countUp(cxpEl, 0, out.cxp, 900, '+', ' XP');
        const after = levelFromXP(S.prof.xp);
        if (out.levelUp) {
          bar.style.width = '100%';
          later(() => {
            lvNum.textContent = after.level;
            lvNum.parentElement.classList.add('pop');
            bar.style.transition = 'none';
            bar.style.width = '0%';
            void bar.offsetWidth;
            bar.style.transition = '';
            bar.style.width = `${(100 * after.into) / after.need}%`;
            sfx.play('levelup');
          }, 700);
        } else bar.style.width = `${(100 * after.into) / after.need}%`;
      }, 700);
      if (out.coins > 0) later(() => sfx.play('coin'), 500);
    }
    if (out.events.some((e) => e.type === 'cupWon' || (e.type === 'season' && e.o.champion))) later(() => ctx.ui.confetti(140), 600);
  }

  // ---------- boot ----------
  render();
  if (!S.seenHelp) later(() => showHelp(), 350);

  return () => {
    alive = false;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (match) match.destroy();
    match = null;
    ctx.setHeaderRight(null);
  };
}
