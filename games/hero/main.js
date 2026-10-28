// Ball Hero — a story-driven soccer puzzle career. Draw passes, curls and
// shots to win decisive match moments, season after season.
//
// Modes (ctx.mode): undefined → main menu, 'career' → season timeline,
// 'daily' → today's challenge, 'training' → free drills.

import STRINGS from './strings.js';
import { createMatch } from './match.js';
import * as LV from './levels.js';
import * as CA from './career.js';
import * as CO from './cosmetics.js';
import { drawAvatar } from './render.js';
import { ico, coinSvg, trophySvg } from './icons.js';
import { COUNTRIES, flagUrl, byCode } from '../../js/data/countries.js';

const DRILL_BALLS = 10;

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h, clear, toast, modal } = ctx.ui;
  await ctx.loadCSS(new URL('./style.css', import.meta.url));

  // Sounds only after the first user gesture (browsers block audio before).
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const sfx = {
    play: (n) => active() && ctx.sfx.play(n),
    tone: (o) => active() && ctx.sfx.tone(o),
    noise: (o) => active() && ctx.sfx.noise(o),
    vibrate: (p) => active() && ctx.sfx.vibrate(p),
  };

  // ------------------------------------------------------------------ save data
  const store = ctx.store;
  const S = {
    hero: { ...CO.DEFAULT_HERO, ...(store.get('hero', null) || {}) },
    coins: Math.max(0, store.get('coins', 150) | 0),
    heroXP: Math.max(0, store.get('heroXP', 0) | 0),
    career: { level: 0, stars: {}, ...(store.get('career', null) || {}) },
    seen: store.get('seen', {}) || {},
    trophies: store.get('trophies', []) || [],
    stats: { goals: 0, air: 0, curl: 0, assists: 0, levels: 0, ...(store.get('stats', null) || {}) },
    daily: { last: null, streak: 0, days: {}, ...(store.get('daily', null) || {}) },
    training: { best: { targets: 0, curl: 0, header: 0 }, ...(store.get('training', null) || {}) },
    helpSeen: !!store.get('helpSeen', false),
  };
  if (!Array.isArray(S.hero.owned)) S.hero.owned = [...CO.DEFAULT_HERO.owned];
  const save = () => {
    store.set('hero', S.hero);
    store.set('coins', S.coins);
    store.set('heroXP', S.heroXP);
    store.set('career', S.career);
    store.set('seen', S.seen);
    store.set('trophies', S.trophies);
    store.set('stats', S.stats);
    store.set('daily', S.daily);
    store.set('training', S.training);
    store.set('helpSeen', S.helpSeen);
  };

  const heroName = () => (S.hero.name || t('defaultName')).toUpperCase();
  const country = () => byCode(S.hero.country) || byCode('BR');
  const cname = (c) => ctx.pick(c.name);
  const loc = ctx.lang === 'en' ? 'en-US' : ctx.lang === 'es' ? 'es-ES' : 'pt-BR';
  const fmt = (n) => Number(n).toLocaleString(loc);

  // ------------------------------------------------------------------ shell bits
  const app = h('div', { class: 'g-hero-app' });
  root.append(app);
  let dead = false;
  let match = null;
  let screen = 'menu';
  let entry = ctx.mode || 'menu';
  let backFn = null;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const coinVal = h('b', null, fmt(S.coins));
  const coinPill = h('div', { class: 'g-hero-coins', html: coinSvg() }, coinVal);
  ctx.setHeaderRight(coinPill);
  function addCoins(n) {
    S.coins += n;
    coinVal.textContent = fmt(S.coins);
    coinPill.classList.remove('bump');
    void coinPill.offsetWidth;
    coinPill.classList.add('bump');
  }

  // hero level (separate from the app level)
  const xpNeed = (lvl) => 120 + (lvl - 1) * 80;
  function heroLvl() {
    let xp = S.heroXP;
    let lvl = 1;
    while (xp >= xpNeed(lvl)) {
      xp -= xpNeed(lvl);
      lvl++;
    }
    return { lvl, cur: xp, need: xpNeed(lvl) };
  }

  function destroyMatch() {
    if (match) match.destroy();
    match = null;
  }

  function setScreen(name, node, back) {
    destroyMatch();
    screen = name;
    backFn = back || null;
    ctx.setTitle();
    clear(app).append(node);
  }

  ctx.onBack(() => {
    const ov = app.querySelector('.g-hero-overlay');
    if (ov && ov.dataset.dismiss) {
      ov.remove();
      return true;
    }
    if (backFn) {
      backFn();
      return true;
    }
    return false;
  });

  // where "back" goes from a top-level screen
  const upFrom = (name) => (entry === name ? null : () => showMenu());

  // ------------------------------------------------------------------ widgets
  function avatarCanvas(w, hgt, opts = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = h('canvas', { class: 'g-hero-avatar' });
    c.width = Math.round(w * dpr);
    c.height = Math.round(hgt * dpr);
    c.style.width = w + 'px';
    c.style.height = hgt + 'px';
    const g = c.getContext('2d');
    const kit = CO.kitById(opts.kit || S.hero.kit);
    const hero = { ...S.hero, ...(opts.over || {}) };
    const look = { ...kit, ...CO.heroLook(hero), num: hero.num, front: opts.front !== false };
    if (opts.bg !== false) {
      const sp = g.createRadialGradient((w * dpr) / 2, hgt * dpr * 0.3, 4, (w * dpr) / 2, hgt * dpr * 0.4, Math.min(w, hgt) * dpr * 0.5);
      sp.addColorStop(0, 'rgba(255,226,140,0.32)');
      sp.addColorStop(1, 'rgba(255,226,140,0)');
      g.fillStyle = sp;
      g.fillRect(0, 0, w * dpr, hgt * dpr);
    }
    if (opts.pair) {
      const sc = opts.scale || hgt / 2.3;
      drawAvatar(g, dpr, w * 0.3, hgt - 10, sc, { ...look, front: true });
      drawAvatar(g, dpr, w * 0.7, hgt - 10, sc, { ...look, front: false });
    } else {
      const sc = opts.scale || hgt / 2.1;
      drawAvatar(g, dpr, w / 2, opts.feetY ?? hgt - 6, sc, look);
    }
    return c;
  }

  function crest(club, size = 44) {
    return h(
      'span',
      { class: 'g-hero-crest', style: { background: `conic-gradient(from 200deg, ${club.colors[0]} 0 50%, ${club.colors[1]} 50% 100%)`, width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.27) + 'px' } },
      h('span', null, club.short),
    );
  }
  function flagImg(c, cls = '') {
    return h('img', { class: `g-hero-flag ${cls}`, src: flagUrl(c), alt: cname(c), draggable: 'false' });
  }
  function starsRow(n, max = 3, cls = '') {
    const r = h('span', { class: `g-hero-stars ${cls}` });
    for (let i = 0; i < max; i++) r.append(h('i', { class: i < n ? 'on' : '', html: ico(i < n ? 'star' : 'starO') }));
    return r;
  }
  function objLabel(L, kind, n) {
    const name = heroName();
    if (kind === 'main') return t(L.goal === 'hero' ? 'obj_hero' : L.goal === 'assist' ? 'obj_assist' : 'obj_score', { name });
    return t('b_' + kind, { n, name });
  }
  function teamTag(side, meta) {
    // side: 'us' | 'them'
    if (meta && meta.intl) {
      const c = side === 'us' ? country() : meta.opp.country;
      return h('span', { class: 'g-hero-tag' }, flagImg(c, 'sm'), h('b', null, cname(c).slice(0, 3).toUpperCase()));
    }
    if (side === 'us') {
      const club = meta ? meta.club : CA.CLUBS[0];
      return h('span', { class: 'g-hero-tag' }, crest(club, 22), h('b', null, club.short));
    }
    const name = meta && meta.opp ? meta.opp.name : '—';
    const short = name
      .replace(/^(Atlético|Real|Sporting|União|Dínamo|Racing|Olímpico|Inter|Athletic|Esporte|Sport|Grêmio|Leões do|Cruzeiro do|AC|Olympique|Dynamo)\s+/i, '')
      .replace(/\s+(FC|EC|AC)$/i, '')
      .slice(0, 3)
      .toUpperCase();
    return h('span', { class: 'g-hero-tag' }, h('span', { class: 'g-hero-crest opp', style: { width: '22px', height: '22px', fontSize: '7px' } }, h('span', null, short)), h('b', null, short));
  }
  function oppName(meta) {
    if (!meta || !meta.opp) return '';
    return meta.opp.kind === 'nation' ? cname(meta.opp.country) : meta.opp.name;
  }

  function overlay(cls, panel, opts = {}) {
    const ov = h('div', { class: `g-hero-overlay ${cls}` }, panel);
    if (opts.dismiss) ov.dataset.dismiss = '1';
    app.append(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    return {
      ov,
      close() {
        ov.classList.remove('show');
        ov.classList.add('hide');
        setTimeout(() => ov.remove(), 220);
      },
    };
  }

  // ------------------------------------------------------------------ MENU
  function showMenu() {
    const lv = heroLvl();
    const i = S.career.level;
    const meta = CA.levelMeta(i, S.hero.country);
    const today = todayKey();
    const dailyDone = !!S.daily.days[today];
    const node = h(
      'div',
      { class: 'screen g-hero-menu' },
      // hero card
      h(
        'button',
        { class: 'g-hero-herocard rise', onclick: () => showLocker() },
        h('span', { class: 'g-hero-bust' }, avatarCanvas(84, 84, { scale: 92, feetY: 176 })),
        h(
          'span',
          { class: 'g-hero-hc-body' },
          h('span', { class: 'g-hero-hc-name' }, heroName(), h('span', { class: 'g-hero-num' }, '#' + S.hero.num)),
          h('span', { class: 'g-hero-hc-club' }, crest(meta.club, 18), meta.club.name, ' · ', t(CA.divisionKey(meta.club.tier))),
          h('span', { class: 'g-hero-xp' }, h('span', { class: 'g-hero-lvl' }, t('heroLevel', { n: lv.lvl })), h('span', { class: 'g-hero-bar' }, h('i', { style: { width: (100 * lv.cur) / lv.need + '%' } })), h('small', null, t('xpOf', { a: lv.cur, b: lv.need }))),
        ),
        h('span', { class: 'g-hero-chev', html: ico('chevron') }),
      ),
      // career CTA
      h(
        'button',
        { class: 'g-hero-cta rise', style: { animationDelay: '40ms' }, onclick: () => showCareer() },
        h('span', { class: 'g-hero-cta-ico', html: ico('ball') }),
        h(
          'span',
          { class: 'g-hero-cta-body' },
          h('small', null, t('menuCareer')),
          h('b', null, t('season', { n: meta.season + 1 }), ' · ', t('matchOf', { k: meta.k + 1, n: CA.SEASON_LEN })),
          h('span', null, `${meta.min}' · ${meta.score[0]}–${meta.score[1]} · ${t('vs')} ${oppName(meta)}`),
        ),
        h('span', { class: 'g-hero-cta-play', html: ico('play') }),
      ),
      h(
        'div',
        { class: 'grid-2 rise', style: { animationDelay: '80ms' } },
        h(
          'button',
          { class: 'g-hero-tile', onclick: () => showDaily() },
          h('span', { class: 'g-hero-tile-ico', html: ico('calendar') }),
          h('b', null, t('menuDaily')),
          h('small', null, dailyDone ? t('doneBadge') + ' ✓' : t('dailyReward', { n: dailyPrize() })),
          !dailyDone ? h('span', { class: 'g-hero-badge' }, t('newBadge')) : null,
        ),
        h(
          'button',
          { class: 'g-hero-tile', onclick: () => showTraining() },
          h('span', { class: 'g-hero-tile-ico', html: ico('cone') }),
          h('b', null, t('menuTraining')),
          h('small', null, t('trainingSub')),
        ),
      ),
      h(
        'div',
        { class: 'list rise', style: { animationDelay: '120ms' } },
        listItem('shirt', t('menuLocker'), t('lockerSub'), () => showLocker()),
        listItem('trophy', t('menuTrophies'), t('trophiesSub'), () => showTrophies(), S.trophies.length ? String(S.trophies.length) : null),
        listItem('help', t('menuHelp'), t('helpSub'), () => showHelp()),
      ),
    );
    setScreen('menu', node, null);
    if (!S.helpSeen) later(() => showHelp(true), 350);
  }

  function listItem(icon, title, sub, onclick, right) {
    return h(
      'button',
      { class: 'list-item g-hero-li', onclick },
      h('span', { class: 'li-icon g-hero-li-ico', html: ico(icon) }),
      h('span', { class: 'li-body' }, h('span', { class: 'li-title' }, title), h('span', { class: 'li-sub' }, sub)),
      h('span', { class: 'li-right' }, right ? h('span', { class: 'g-hero-count' }, right) : null, h('span', { html: ico('chevron') })),
    );
  }

  // ------------------------------------------------------------------ HELP
  function showHelp(first) {
    const steps = ['help1', 'help2', 'help3', 'help4', 'help5'];
    const icons = ['ball', 'curl', 'head', 'target', 'star'];
    const panel = h(
      'div',
      { class: 'g-hero-panel g-hero-help' },
      h('div', { class: 'g-hero-medal', html: ico('whistle') }),
      h('h2', { class: 'g-hero-ptitle' }, t('menuHelp')),
      h('div', { class: 'g-hero-help-demo' }, helpDemo()),
      h(
        'ol',
        { class: 'g-hero-steps' },
        steps.map((k, i) => h('li', null, h('span', { class: 'g-hero-step-ico', html: ico(icons[i]) }), h('span', null, t(k)))),
      ),
      h(
        'button',
        {
          class: 'btn primary block',
          onclick: () => {
            S.helpSeen = true;
            save();
            o.close();
          },
        },
        t('gotIt'),
      ),
    );
    const o = overlay('', panel, { dismiss: !first });
  }
  function helpDemo() {
    return h('div', {
      class: 'g-hero-demo',
      html: `<svg viewBox="0 0 300 150" aria-hidden="true">
        <defs><linearGradient id="hgd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8f3c"/><stop offset="1" stop-color="#3aa047"/></linearGradient></defs>
        <rect width="300" height="150" rx="14" fill="url(#hgd)"/>
        <path d="M30 30h240M80 30v40h140V30" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none"/>
        <rect x="118" y="10" width="64" height="20" fill="none" stroke="#fff" stroke-width="3"/>
        <path d="M118 10h64" stroke="#fff" stroke-opacity=".4" stroke-width="10" stroke-dasharray="1 3"/>
        <circle cx="70" cy="128" r="9" fill="#f3c24a" stroke="#111" stroke-width="2"/>
        <circle cx="228" cy="96" r="9" fill="#f3c24a" stroke="#111" stroke-width="2"/>
        <circle cx="150" cy="96" r="9" fill="#d7263d" stroke="#fff" stroke-width="2"/>
        <path class="g-hero-demo-path" d="M74 120 C 130 120, 180 128, 222 100 C 236 80, 196 40, 170 20" fill="none" stroke="#ffe27a" stroke-width="5" stroke-linecap="round"/>
        <circle class="g-hero-demo-ball" r="5" fill="#fff" stroke="#111"/>
      </svg>`,
    });
  }

  // ------------------------------------------------------------------ CAREER
  function showCareer(season) {
    const cur = S.career.level;
    const curSeason = Math.floor(cur / CA.SEASON_LEN);
    const s = season ?? curSeason;
    const club = CA.clubForSeason(s);
    let seasonStars = 0;
    for (let k = 0; k < CA.SEASON_LEN; k++) seasonStars += S.career.stars[s * CA.SEASON_LEN + k] || 0;
    const done = Math.max(0, Math.min(CA.SEASON_LEN, cur - s * CA.SEASON_LEN));
    const head = h(
      'div',
      { class: 'g-hero-season rise' },
      crest(club, 56),
      h(
        'div',
        { class: 'g-hero-season-body' },
        h('small', null, t('season', { n: s + 1 }), ' · ', t(CA.divisionKey(club.tier))),
        h('b', null, club.name),
        h('div', { class: 'g-hero-bar wide' }, h('i', { style: { width: (100 * done) / CA.SEASON_LEN + '%' } })),
        h('span', { class: 'g-hero-season-meta' }, t('matchOf', { k: Math.min(done + 1, CA.SEASON_LEN), n: CA.SEASON_LEN }), h('span', { class: 'g-hero-sstars', html: ico('star') }, ` ${seasonStars}/${CA.SEASON_LEN * 3}`)),
      ),
    );
    const chips = h('div', { class: 'chips g-hero-seasons' });
    for (let k = 0; k <= curSeason; k++) {
      chips.append(
        h(
          'button',
          {
            class: `chip ${k === s ? 'active' : ''}`,
            onclick: () => {
              sfx.play('select');
              showCareer(k);
            },
          },
          t('seasonShort', { n: k + 1 }),
        ),
      );
    }
    const list = h('div', { class: 'g-hero-timeline' });
    for (let k = 0; k < CA.SEASON_LEN; k++) {
      const i = s * CA.SEASON_LEN + k;
      const meta = CA.levelMeta(i, S.hero.country);
      const stars = S.career.stars[i] || 0;
      const state = i < cur ? 'done' : i === cur ? 'current' : 'locked';
      const node = h(
        'button',
        {
          class: `g-hero-node ${state} ${meta.final || (meta.intl && meta.intl.final) ? 'final' : ''} ${meta.intl ? 'intl' : ''}`,
          style: { animationDelay: k * 30 + 'ms' },
          disabled: state === 'locked',
          onclick: () => startCareer(i),
        },
        h('span', { class: 'g-hero-min' }, `${meta.min}'`),
        h(
          'span',
          { class: 'g-hero-node-body' },
          h('b', null, meta.intl ? flagImg(meta.opp.country, 'xs') : null, `${t('vs')} ${oppName(meta)}`),
          h(
            'small',
            null,
            `${meta.score[0]}–${meta.score[1]} · ${t('venue' + meta.venue)}`,
            meta.trophy ? ` · ${t('final')}: ${t('tr_' + meta.trophy)}` : meta.intl ? ` · ${t('national')}` : '',
          ),
        ),
        h(
          'span',
          { class: 'g-hero-node-right' },
          state === 'locked' ? h('span', { class: 'g-hero-lock', html: ico('lock') }) : state === 'current' ? h('span', { class: 'g-hero-node-play', html: ico('play') }) : starsRow(stars, 3, 'sm'),
          meta.trophy ? h('span', { class: 'g-hero-node-trophy', html: trophySvg(meta.trophy, 26) }) : null,
        ),
      );
      list.append(node);
    }
    const node = h('div', { class: 'screen g-hero-career' }, head, curSeason > 0 ? chips : null, list);
    setScreen('career', node, upFrom('career'));
    ctx.setTitle(t('menuCareer'));
    const curNode = list.querySelector('.current');
    if (curNode) later(() => curNode.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  }

  function startCareer(i) {
    sfx.play('select');
    const meta = CA.levelMeta(i, S.hero.country);
    const go = () => withLevel(() => LV.careerLevel(i), (L) => playLevel({ kind: 'career', idx: i, L, meta }));
    if (meta.story && !S.seen[i]) {
      S.seen[i] = 1;
      save();
      showStory(meta, go);
    } else go();
  }

  // Generates (possibly slow) levels behind a short loading card.
  function withLevel(make, then) {
    const panel = h('div', { class: 'g-hero-loading' }, h('div', { class: 'spinner' }), h('span', null, t('loadingMoment')));
    const o = overlay('soft', panel);
    later(() => {
      const L = make();
      o.ov.remove();
      then(L);
    }, 60);
  }

  function storyParams(meta) {
    const club = meta.club;
    return {
      club: club.name,
      div: t(CA.divisionKey(club.tier)),
      opp: oppName(meta),
      country: cname(country()),
      trophy: meta.trophy ? t('tr_' + meta.trophy) : t('tr_' + CA.seasonTrophy(meta.season)),
      n: meta.season + 1,
      name: heroName(),
    };
  }

  function showStory(meta, onDone) {
    const key = meta.story.key;
    const p = storyParams(meta);
    let art;
    if (key === 'callup' || key === 'intlWindow' || key === 'intlFinal') art = h('div', { class: 'g-hero-story-art flagart' }, flagImg(country(), 'big'));
    else if (key.startsWith('transfer') || key === 'bigClub' || key === 'seasonStart') art = h('div', { class: 'g-hero-story-art' }, crest(meta.club, 92));
    else if (meta.trophy || /Final|final|titleDecider/.test(key)) art = h('div', { class: 'g-hero-story-art', html: trophySvg(meta.trophy || CA.seasonTrophy(meta.season), 96) });
    else art = h('div', { class: 'g-hero-story-art' }, avatarCanvas(120, 120, { scale: 58 }));
    const panel = h(
      'div',
      { class: 'g-hero-panel g-hero-story' },
      h('div', { class: 'g-hero-story-kicker' }, t('season', { n: meta.season + 1 }), ' · ', `${meta.min}'`),
      art,
      h('h2', { class: 'g-hero-ptitle' }, t(`st_${key}_t`, p)),
      h('p', { class: 'g-hero-story-text' }, t(`st_${key}`, p)),
      h(
        'button',
        {
          class: 'btn primary block big',
          onclick: () => {
            o.close();
            onDone();
          },
        },
        t('continue'),
      ),
    );
    const o = overlay('story', panel);
    sfx.play('whoosh');
  }

  // ------------------------------------------------------------------ PLAY
  function playLevel(o) {
    // o: { kind: 'career'|'daily'|'training', idx, L, meta, drill }
    const L = o.L;
    const meta = o.meta || null;
    const home = CO.kitById(S.hero.kit);
    const away = CA.opponentKit((L.seed || 0) + (o.idx || 0), home);
    const gk = CA.keeperKit(home, away);
    let attempts = 1;
    let resolved = false;

    const stage = h('div', { class: 'g-hero-stage' });
    const hud = h('div', { class: 'g-hero-hud' });
    const objs = h('div', { class: 'g-hero-objs' });
    const hint = h('div', { class: 'g-hero-hint' });
    const fxLayer = h('div', { class: 'g-hero-fx' });
    const wrap = h('div', { class: 'g-hero-play' }, stage, hud, objs, hint, fxLayer);
    const parent = o.kind === 'career' ? () => showCareer(Math.floor(o.idx / CA.SEASON_LEN)) : o.kind === 'daily' ? () => showDaily() : () => showTraining();
    setScreen('play', wrap, parent);

    // scoreboard
    const retryBtn = h('button', { class: 'g-hero-round', 'aria-label': t('retry'), html: ico('retry'), onclick: () => retry() });
    if (o.kind === 'training') {
      const sb = h('div', { class: 'g-hero-score train' }, h('span', { class: 'g-hero-tag' }, h('span', { html: ico(o.drill === 'targets' ? 'target' : o.drill === 'curl' ? 'curl' : 'head') }), h('b', null, t('drill_' + o.drill))), h('span', { class: 'g-hero-sb-score' }, ''), h('span', { class: 'g-hero-sb-min' }, ''));
      hud.append(sb);
      o.sbScore = sb.children[1];
      o.sbMin = sb.children[2];
    } else {
      hud.append(
        h(
          'div',
          { class: 'g-hero-score' },
          teamTag('us', meta),
          h('span', { class: 'g-hero-sb-score' }, `${L.score ? L.score[0] : 0}–${L.score ? L.score[1] : 0}`),
          teamTag('them', meta),
          h('span', { class: 'g-hero-sb-min' }, `${L.min || 90}'`),
        ),
        retryBtn,
      );
    }

    // objectives
    const objDefs = o.kind === 'training' ? [] : [['main'], ...(L.bonus || [])];
    const objEls = objDefs.map(([k, n]) => h('span', { class: 'g-hero-obj' }, h('i', { html: ico('starO') }), h('span', null, objLabel(L, k, n))));
    objs.append(...objEls);

    function setHint(text, ms) {
      hint.textContent = text || '';
      hint.classList.toggle('show', !!text);
      if (ms) later(() => hint.classList.remove('show'), ms);
    }

    const tutorial = o.kind === 'career' && L.tut && !(S.career.stars[o.idx] > 0) ? L.tut : null;
    match = createMatch(stage, {
      level: L,
      kits: { home, away, gk },
      heroLook: CO.heroLook(S.hero),
      heroName: heroName(),
      heroNum: S.hero.num,
      sfx,
      t,
      input: false,
      tutorial,
      adText: ['DA GAMES', t('adGame'), t('adBall')],
      onResult: (r) => onResult(r),
      onBanner: (key) => banner(t(key), 'bad'),
      onEvent: (ev) => {
        if (ev.type === 'goal') {
          goalFx();
          const sc = hud.querySelector('.g-hero-score:not(.train) .g-hero-sb-score');
          if (sc && L.score) {
            sc.textContent = `${L.score[0] + 1}–${L.score[1]}`;
            sc.classList.add('pop');
          }
        }
        if (ev.type === 'pass' || ev.type === 'shot') setHint('');
      },
      onHint: (key) => setHint(t(key === 'startAtBall' ? 'hintStartAtBall' : key === 'firstNeedsGoal' ? 'firstNeedsGoal' : 'hintNoTarget'), 2200),
      onState: (st) => {
        if (st === 'drawing') hint.classList.remove('show');
      },
    });
    const m = match;
    root.__heroMatch = m; // test hook

    // watch for first-time chances to prompt the player
    const watch = setInterval(() => {
      if (dead || match !== m) return clearInterval(watch);
      const w = m.world;
      const open = w.flight && w.flight.type !== 'shot' && w.flight.lofted && w.flight.receiver >= 0 && w.flight.z1 > 0.5 && !w.flight.next && w.flight.s / w.flight.curve.len > 0.25;
      if (open && !hint.dataset.first) {
        hint.dataset.first = '1';
        setHint(t('hintFirst'));
      } else if (!open && hint.dataset.first) {
        delete hint.dataset.first;
        hint.classList.remove('show');
      }
    }, 120);

    function start() {
      m.setInput(true);
      if (o.kind === 'training' || attempts > 1 || o.idx < 6 || o.kind === 'daily') setHint(t('hintDraw'), o.idx < 3 && o.kind === 'career' ? 0 : 3500);
    }

    // intro card
    if (o.kind === 'training') {
      updateTrainHud();
      later(start, 400);
    } else showIntro();

    function showIntro() {
      const venue = t('venue' + (L.venue || 'H'));
      const card = h(
        'div',
        { class: 'g-hero-panel g-hero-intro' },
        h('div', { class: 'g-hero-intro-top' }, h('span', { class: 'g-hero-intro-min' }, `${L.min || 90}'`), h('span', null, `${L.score ? L.score[0] : 0}–${L.score ? L.score[1] : 0} · ${venue}`)),
        o.kind === 'daily' ? h('div', { class: 'g-hero-intro-kicker' }, t('dailyTitle')) : null,
        h('div', { class: 'g-hero-intro-vs' }, teamTag('us', meta), h('span', null, t('vs')), teamTag('them', meta)),
        h('div', { class: 'g-hero-intro-label' }, t('objectives')),
        h(
          'ul',
          { class: 'g-hero-objlist' },
          objDefs.map(([k, n], j) => h('li', { class: j === 0 ? 'main' : '' }, h('i', { html: ico('star') }), h('span', null, objLabel(L, k, n)))),
        ),
        h(
          'button',
          {
            class: 'btn primary block big',
            onclick: () => {
              sfx.play('select');
              ov.close();
              start();
            },
          },
          h('span', { html: ico('play') }),
          t('playNow'),
        ),
      );
      const ov = overlay('intro', card);
    }

    function retry() {
      if (resolved && o.kind !== 'training') return;
      attempts++;
      clearResultUI();
      const sc = hud.querySelector('.g-hero-score:not(.train) .g-hero-sb-score');
      if (sc && L.score) {
        sc.textContent = `${L.score[0]}–${L.score[1]}`;
        sc.classList.remove('pop');
      }
      sfx.play('tap');
      m.restart();
      m.setInput(true);
      objEls.forEach((e) => e.classList.remove('ok', 'no'));
      setHint('');
    }

    function clearResultUI() {
      app.querySelectorAll('.g-hero-overlay.result').forEach((e) => e.remove());
      clear(fxLayer);
    }

    function banner(text, kind) {
      const b = h('div', { class: `g-hero-banner ${kind}` }, text);
      fxLayer.append(b);
      later(() => b.remove(), 1700);
    }

    function goalFx() {
      const g = h('div', { class: 'g-hero-goal' }, h('b', null, t('goal')), h('span', null, heroName()));
      fxLayer.append(g);
      later(() => g.classList.add('out'), 1900);
      later(() => g.remove(), 2400);
    }

    // ---------------- results
    function evaluate(r) {
      const mainOk = !!r.goal && (L.goal === 'hero' ? r.hero : L.goal === 'assist' ? r.heroAssist : true);
      const bonus = (L.bonus || []).map(([k, n]) => mainOk && (k === 'passes' ? r.passes <= n : k === 'hero' ? r.hero : !!r[k]));
      return { mainOk, bonus, stars: mainOk ? 1 + bonus.filter(Boolean).length : 0 };
    }

    function onResult(r) {
      if (o.kind === 'training') return trainingResult(r);
      const ev = evaluate(r);
      objEls[0].classList.add(ev.mainOk ? 'ok' : 'no');
      ev.bonus.forEach((b, j) => objEls[j + 1].classList.add(b ? 'ok' : 'no'));
      objEls.forEach((e) => {
        if (e.classList.contains('ok')) e.querySelector('i').innerHTML = ico('star');
      });
      if (ev.mainOk) {
        resolved = true;
        m.setInput(false);
        win(r, ev);
      } else fail(r);
    }

    function fail(r) {
      sfx.play('lose');
      let reason = r.reason;
      let title;
      let tip;
      if (r.goal) {
        title = t(L.goal === 'assist' ? 'failWrongAssist' : 'failWrongScorer');
        tip = t(L.goal === 'assist' ? 'tipWrongAssist' : 'tipWrongScorer', { name: heroName() });
      } else {
        const map = { intercepted: 'Intercepted', blocked: 'Blocked', saved: 'Saved', claimed: 'Claimed', post: 'Post', bar: 'Post', wide: 'Wide', over: 'Over', out: 'Out', nobody: 'Out' };
        const key = map[reason] || 'Saved';
        title = t('fail' + (reason === 'bar' ? 'Bar' : reason === 'nobody' ? 'Nobody' : key));
        tip = t('tip' + (reason === 'blocked' && m.world.def.some((d) => d.wall) ? 'Wall' : key));
      }
      const panel = h(
        'div',
        { class: 'g-hero-panel g-hero-fail' },
        h('div', { class: 'g-hero-fail-title' }, title),
        h('p', { class: 'g-hero-tip' }, tip),
        h('button', { class: 'btn primary block big', onclick: () => retry() }, h('span', { html: ico('retry') }), t('retry')),
        h('button', { class: 'btn ghost block', onclick: () => parent() }, t('back')),
      );
      overlay('result sheet', panel);
    }

    function win(r, ev) {
      const res = applyWin(o, r, ev, attempts);
      sfx.play('win');
      const titles = ['resultTitle1', 'resultTitle2', 'resultTitle3'];
      const stars = h('div', { class: 'g-hero-bigstars' });
      for (let j = 0; j < 3; j++) stars.append(h('i', { class: j < ev.stars ? 'on' : '', style: { animationDelay: 300 + j * 260 + 'ms' }, html: ico('star') }));
      const list = h(
        'ul',
        { class: 'g-hero-objlist result' },
        objDefs.map(([k, n], j) => {
          const ok = j === 0 ? ev.mainOk : ev.bonus[j - 1];
          return h('li', { class: ok ? 'ok' : 'no' }, h('i', { html: ico(ok ? 'check' : 'starO') }), h('span', null, objLabel(L, k, n)));
        }),
      );
      const rewards = h(
        'div',
        { class: 'g-hero-rewards' },
        h('span', { class: 'g-hero-rw', html: coinSvg() }, h('b', null, '+' + res.coins)),
        h('span', { class: 'g-hero-rw xp' }, h('i', { html: ico('star') }), h('b', null, `+${res.heroXP} XP`)),
      );
      const nextBtn =
        o.kind === 'career'
          ? h(
              'button',
              {
                class: 'btn primary block big',
                onclick: () => {
                  const go = () => (o.idx + 1 <= S.career.level ? startCareer(o.idx + 1) : showCareer());
                  if (res.trophies.length) showTrophyReveal(res.trophies, go);
                  else go();
                },
              },
              t('next'),
              h('span', { html: ico('chevron') }),
            )
          : h('button', { class: 'btn primary block big', onclick: () => showDaily() }, t('continue'));
      const panel = h(
        'div',
        { class: 'g-hero-panel g-hero-win' },
        h('div', { class: 'g-hero-medal', html: ico('trophy') }),
        h('h2', { class: 'g-hero-ptitle gold' }, t(titles[ev.stars - 1])),
        stars,
        list,
        rewards,
        nextBtn,
        h(
          'div',
          { class: 'row g-hero-win-row' },
          h(
            'button',
            {
              class: 'btn small',
              onclick: () => {
                resolved = false;
                retry();
              },
            },
            h('span', { html: ico('retry') }),
            t('replay'),
          ),
          o.kind === 'career' ? h('button', { class: 'btn small', onclick: () => showCareer(Math.floor(o.idx / CA.SEASON_LEN)) }, t('toCareer')) : null,
        ),
      );
      later(() => {
        if (match !== m) return;
        overlay('result', panel);
        if (ev.stars === 3) ctx.ui.confetti(70);
      }, 200);
      if (ctx.addXP) ctx.addXP(10 + 5 * ev.stars);
      // pre-generate the next procedural level while the player celebrates
      if (o.kind === 'career') later(() => LV.careerLevel(o.idx + 1), 900);
    }

    // ---------------- training
    function updateTrainHud() {
      if (o.sbScore) o.sbScore.textContent = t('pts', { n: o.score || 0 });
      if (o.sbMin) o.sbMin.textContent = t('ballN', { n: Math.min(DRILL_BALLS, (o.ball || 0) + 1), m: DRILL_BALLS });
    }
    function trainingResult(r) {
      let pts = 0;
      if (r.goal) {
        if (o.drill === 'targets') {
          pts = 1;
          for (const tg of L.targets) if (Math.hypot(r.x - tg.x, r.z - tg.z) < tg.r + 0.15) pts = tg.pts;
          if (pts > 1) {
            const tg = L.targets.find((q) => Math.hypot(r.x - q.x, r.z - q.z) < q.r + 0.15);
            if (tg) tg.hit = true;
          }
        } else if (o.drill === 'curl') pts = 2 + (r.curl ? 1 : 0);
        else pts = 2 + (r.top ? 1 : 0);
        banner('+' + pts, 'good');
        sfx.play('coin');
      }
      o.score = (o.score || 0) + pts;
      o.ball = (o.ball || 0) + 1;
      updateTrainHud();
      if (o.ball >= DRILL_BALLS) {
        later(() => trainingOver(), 500);
        return;
      }
      later(() => {
        if (match !== m) return;
        const nl = LV.drillLevel(o.drill, o.ball, o.seed);
        Object.assign(L, nl);
        m.restart(nl);
        m.setInput(true);
        updateTrainHud();
      }, r.goal ? 200 : 300);
    }
    function trainingOver() {
      const best = S.training.best[o.drill] || 0;
      const isBest = o.score > best;
      if (isBest) S.training.best[o.drill] = o.score;
      const coins = Math.round(o.score * 1.5);
      addCoins(coins);
      S.heroXP += 15;
      save();
      if (ctx.addXP) ctx.addXP(8);
      sfx.play(isBest ? 'win' : 'success');
      const panel = h(
        'div',
        { class: 'g-hero-panel g-hero-win' },
        h('div', { class: 'g-hero-medal', html: ico('cone') }),
        h('h2', { class: 'g-hero-ptitle gold' }, t('drillOver')),
        h('div', { class: 'g-hero-bigscore' }, h('small', null, t('score')), h('b', null, String(o.score)), isBest ? h('span', { class: 'g-hero-badge static' }, t('newRecord')) : h('span', { class: 'muted small' }, t('best', { n: Math.max(best, o.score) }))),
        h('div', { class: 'g-hero-rewards' }, h('span', { class: 'g-hero-rw', html: coinSvg() }, h('b', null, '+' + coins)), h('span', { class: 'g-hero-rw xp' }, h('i', { html: ico('star') }), h('b', null, '+15 XP'))),
        h('button', { class: 'btn primary block big', onclick: () => startDrill(o.drill) }, t('trainAgain')),
        h('button', { class: 'btn ghost block', onclick: () => showTraining() }, t('back')),
      );
      overlay('result', panel);
    }
  }

  // Rewards + progress for a won moment.
  function applyWin(o, r, ev, attempts) {
    const res = { coins: 0, heroXP: 0, trophies: [] };
    void attempts;
    if (r.hero) S.stats.goals++;
    if (r.hero && r.air) S.stats.air++;
    if (r.hero && r.curl) S.stats.curl++;
    if (r.heroAssist) S.stats.assists++;
    if (o.kind === 'career') {
      const prev = S.career.stars[o.idx] || 0;
      const first = o.idx >= S.career.level;
      if (first) {
        res.coins = 40 + 20 * ev.stars;
        res.heroXP = 30 + 15 * ev.stars;
        S.stats.levels++;
        S.career.level = o.idx + 1;
      } else {
        res.coins = 20 * Math.max(0, ev.stars - prev);
        res.heroXP = 10 + 10 * Math.max(0, ev.stars - prev);
      }
      S.career.stars[o.idx] = Math.max(prev, ev.stars);
      // trophies
      const meta = o.meta;
      const has = (key, s) => S.trophies.some((x) => x.key === key && x.s === s);
      if (first && meta.trophy) {
        const tr = { key: meta.trophy, s: meta.season, club: meta.club.id };
        if (meta.intl) tr.country = S.hero.country;
        if (!has(tr.key, tr.s)) {
          S.trophies.push(tr);
          res.trophies.push(tr);
        }
      }
      const s = meta.season;
      if (S.career.level >= (s + 1) * CA.SEASON_LEN) {
        let st = 0;
        for (let k = 0; k < CA.SEASON_LEN; k++) st += S.career.stars[s * CA.SEASON_LEN + k] || 0;
        const award = st >= CA.SEASON_LEN * 3 ? 'goldenBall' : st >= 24 ? 'seasonStar' : null;
        if (award && !has(award, s)) {
          const tr = { key: award, s, club: meta.club.id };
          S.trophies.push(tr);
          res.trophies.push(tr);
        }
      }
    } else if (o.kind === 'daily') {
      const day = o.day;
      const prev = S.daily.days[day] || 0;
      if (!prev) {
        const y = todayKey(-1);
        S.daily.streak = S.daily.last === y ? S.daily.streak + 1 : 1;
        S.daily.last = day;
        res.coins = dailyPrize();
        res.heroXP = 60;
      } else {
        res.coins = 15 * Math.max(0, ev.stars - prev);
        res.heroXP = 10;
      }
      S.daily.days[day] = Math.max(prev, ev.stars);
      // keep the history short
      const keys = Object.keys(S.daily.days).sort();
      while (keys.length > 40) delete S.daily.days[keys.shift()];
    }
    addCoins(res.coins);
    const before = heroLvl().lvl;
    S.heroXP += res.heroXP;
    if (heroLvl().lvl > before) later(() => toast('⭐ ' + t('heroLevel', { n: heroLvl().lvl })), 1600);
    save();
    return res;
  }

  function showTrophyReveal(list, onDone) {
    const tr = list[0];
    const rest = list.slice(1);
    const individual = tr.key === 'goldenBall' || tr.key === 'seasonStar';
    const panel = h(
      'div',
      { class: 'g-hero-panel g-hero-reveal' },
      h('div', { class: 'g-hero-rays' }),
      h('div', { class: 'g-hero-reveal-art', html: trophySvg(tr.key, 140) }),
      h('h2', { class: 'g-hero-ptitle gold' }, individual ? t('seasonDone', { n: tr.s + 1 }) : t('trophyWon')),
      h('p', { class: 'g-hero-story-text' }, t(individual ? 'awardText' : 'trophyWonText', { trophy: t('tr_' + tr.key) })),
      h(
        'button',
        {
          class: 'btn primary block big',
          onclick: () => {
            o.close();
            if (rest.length) showTrophyReveal(rest, onDone);
            else onDone();
          },
        },
        t('continue'),
      ),
    );
    const o = overlay('reveal', panel);
    sfx.play('levelup');
    sfx.vibrate([40, 40, 90]);
    ctx.ui.confetti(110);
  }

  // ------------------------------------------------------------------ DAILY
  function todayKey(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
  function dailyPrize() {
    const yest = todayKey(-1);
    const streak = S.daily.last === yest ? S.daily.streak + 1 : 1;
    return 150 + 25 * Math.min(6, streak - 1);
  }
  function untilMidnight() {
    const now = new Date();
    const mid = new Date(now);
    mid.setHours(24, 0, 0, 0);
    const ms = mid - now;
    const hh = Math.floor(ms / 3600000);
    const mm = Math.floor((ms % 3600000) / 60000);
    return `${hh}h ${String(mm).padStart(2, '0')}m`;
  }

  function showDaily() {
    const day = todayKey();
    const stars = S.daily.days[day] || 0;
    const d = new Date();
    const dateStr = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
    const moment = { min: 85 + (Number(day) % 9), score: [1, 1] };
    const streak = S.daily.last === day || S.daily.last === todayKey(-1) ? S.daily.streak : 0;
    const node = h(
      'div',
      { class: 'screen g-hero-daily' },
      h(
        'div',
        { class: 'g-hero-dailycard rise' },
        h('div', { class: 'g-hero-daily-ico', html: ico('calendar') }),
        h('small', null, dateStr),
        h('h2', { class: 'g-hero-ptitle gold' }, t('dailyTitle')),
        h('div', { class: 'g-hero-daily-moment' }, h('span', { class: 'g-hero-intro-min' }, `${moment.min}'`), h('span', null, `${moment.score[0]}–${moment.score[1]}`)),
        stars ? starsRow(stars, 3, 'lg') : h('p', { class: 'muted' }, t('dailyReward', { n: dailyPrize() })),
        stars ? h('p', { class: 'muted small' }, t('dailyDone')) : null,
        h('button', { class: 'btn primary block big', onclick: () => startDaily() }, h('span', { html: ico('play') }), stars ? t('replay') : t('play')),
        h('div', { class: 'g-hero-daily-foot' }, h('span', null, '🔥 ', t('dailyStreak', { n: streak })), h('span', null, t('dailyNext', { t: untilMidnight() }))),
      ),
    );
    setScreen('daily', node, upFrom('daily'));
    ctx.setTitle(t('menuDaily'));
  }

  function startDaily() {
    sfx.play('select');
    const day = todayKey();
    const d = Math.min(1.2, S.career.level / 30);
    const s = Math.floor(S.career.level / CA.SEASON_LEN);
    const meta = { club: CA.clubForSeason(s), opp: { kind: 'club', name: CA.dailyOpponent(day, s) }, intl: null, season: s };
    withLevel(
      () => LV.dailyLevel(day, d),
      (L) => playLevel({ kind: 'daily', idx: -1, day, L, meta }),
    );
  }

  // ------------------------------------------------------------------ TRAINING
  function showTraining() {
    const drills = [
      { id: 'targets', icon: 'target' },
      { id: 'curl', icon: 'curl' },
      { id: 'header', icon: 'head' },
    ];
    const node = h(
      'div',
      { class: 'screen g-hero-training' },
      h('div', { class: 'g-hero-train-head rise' }, h('span', { html: ico('cone') }), h('div', null, h('b', null, t('menuTraining')), h('small', null, t('trainingSub')))),
      h(
        'div',
        { class: 'stack' },
        drills.map((dr, j) =>
          h(
            'button',
            { class: 'g-hero-drill rise', style: { animationDelay: j * 50 + 'ms' }, onclick: () => startDrill(dr.id) },
            h('span', { class: 'g-hero-drill-ico', html: ico(dr.icon) }),
            h('span', { class: 'g-hero-drill-body' }, h('b', null, t('drill_' + dr.id)), h('small', null, t('drill_' + dr.id + '_sub'))),
            h('span', { class: 'g-hero-drill-best' }, h('small', null, t('best', { n: '' }).replace(/[:\s]+$/, '')), h('b', null, String(S.training.best[dr.id] || 0))),
          ),
        ),
      ),
    );
    setScreen('training', node, upFrom('training'));
    ctx.setTitle(t('menuTraining'));
  }

  function startDrill(kind) {
    sfx.play('select');
    const seed = (Date.now() / 1000) | 0;
    const L = LV.drillLevel(kind, 0, seed);
    playLevel({ kind: 'training', drill: kind, idx: 0, L, seed, ball: 0, score: 0 });
  }

  // ------------------------------------------------------------------ LOCKER
  function showLocker(tab = 'kit') {
    const prev = h('div', { class: 'g-hero-preview' });
    const drawPrev = () => clear(prev).append(avatarCanvas(260, 200, { pair: true, scale: 84 }));
    drawPrev();
    const nameIn = h('input', {
      class: 'g-hero-input',
      maxlength: '12',
      value: S.hero.name,
      placeholder: t('defaultName'),
      oninput: (e) => {
        S.hero.name = e.target.value.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 12);
        save();
      },
    });
    const numVal = h('b', null, String(S.hero.num));
    const setNum = (d) => {
      S.hero.num = ((S.hero.num - 1 + d + 99) % 99) + 1;
      numVal.textContent = S.hero.num;
      save();
      drawPrev();
    };
    const tabs = [
      ['kit', 'tabKit'],
      ['boots', 'tabBoots'],
      ['hair', 'tabHair'],
      ['hairColor', 'tabHairColor'],
      ['skin', 'tabSkin'],
      ['nation', 'tabNation'],
    ];
    const tabRow = h(
      'div',
      { class: 'chips g-hero-tabs' },
      tabs.map(([id, key]) => h('button', { class: `chip ${id === tab ? 'active' : ''}`, onclick: () => showLocker(id) }, t(key))),
    );
    const grid = h('div', { class: 'g-hero-items' });

    const own = (k) => S.hero.owned.includes(k);
    const item = (key, label, price, equipped, swatch, onEquip) => {
      const owned = price === 0 || own(key);
      return h(
        'button',
        {
          class: `g-hero-item ${equipped ? 'on' : ''} ${owned ? 'owned' : ''}`,
          onclick: () => {
            if (owned) {
              onEquip();
              sfx.play('select');
              save();
              showLocker(tab);
              return;
            }
            if (S.coins < price) {
              sfx.play('error');
              toast(t('notEnough'));
              return;
            }
            modal({ title: t('buy'), body: t('buyQ', { item: label, n: fmt(price) }), actions: [{ label: t('cancel'), value: false }, { label: t('buy'), value: true, primary: true }], dismissible: true }).then((ok) => {
              if (!ok || dead) return;
              addCoins(-price);
              S.hero.owned.push(key);
              onEquip();
              save();
              sfx.play('coin');
              toast(t('bought'));
              showLocker(tab);
            });
          },
        },
        swatch,
        h('span', { class: 'g-hero-item-name' }, label),
        h('span', { class: 'g-hero-item-price' }, equipped ? h('span', { class: 'eq' }, h('span', { html: ico('check') }), t('equipped')) : owned ? '' : h('span', { class: 'cost', html: coinSvg() }, fmt(price))),
      );
    };

    if (tab === 'kit') {
      for (const k of CO.KITS) {
        const sw = avatarCanvas(64, 64, { kit: k.id, front: false, scale: 31, feetY: 62, bg: false });
        grid.append(item('kit:' + k.id, t('kit_' + k.id), k.price, S.hero.kit === k.id, h('span', { class: 'g-hero-sw' }, sw), () => (S.hero.kit = k.id)));
      }
    } else if (tab === 'boots') {
      for (const b of CO.BOOTS) grid.append(item('boots:' + b.id, t('boots_' + b.id), b.price, S.hero.boots === b.id, h('span', { class: 'g-hero-sw', html: ico('boot') }, null), () => (S.hero.boots = b.id)));
      grid.querySelectorAll('.g-hero-sw').forEach((e, j) => (e.style.color = CO.BOOTS[j].color));
    } else if (tab === 'hair') {
      for (const hs of CO.HAIRS) {
        const sw = avatarCanvas(64, 64, { over: { hair: hs.id }, scale: 150, feetY: 284, bg: false });
        grid.append(item('hair:' + hs.id, t('hair_' + hs.id), hs.price, S.hero.hair === hs.id, h('span', { class: 'g-hero-sw' }, sw), () => (S.hero.hair = hs.id)));
      }
    } else if (tab === 'hairColor') {
      for (const hc of CO.HAIR_COLORS) grid.append(item('hc:' + hc.id, t('hc_' + hc.id), hc.price, S.hero.hairColor === hc.id, h('span', { class: 'g-hero-sw dot' }, h('i', { style: { background: hc.color } })), () => (S.hero.hairColor = hc.id)));
    } else if (tab === 'skin') {
      CO.SKINS.forEach((c, j) => grid.append(item('skin:' + j, '', 0, S.hero.skin === j, h('span', { class: 'g-hero-sw dot' }, h('i', { style: { background: c } })), () => (S.hero.skin = j))));
    }

    let nationBox = null;
    if (tab === 'nation') {
      const listEl = h('div', { class: 'list g-hero-nations' });
      const all = COUNTRIES.filter((c) => c.independent).sort((a, b) => cname(a).localeCompare(cname(b), loc));
      const render = (q = '') => {
        clear(listEl);
        const nq = q.trim().toLowerCase();
        for (const c of all) {
          if (nq && !cname(c).toLowerCase().includes(nq)) continue;
          listEl.append(
            h(
              'button',
              {
                class: `list-item g-hero-nation ${c.code === S.hero.country ? 'on' : ''}`,
                onclick: () => {
                  S.hero.country = c.code;
                  save();
                  sfx.play('select');
                  showLocker('nation');
                },
              },
              flagImg(c, 'sm'),
              h('span', { class: 'li-body' }, h('span', { class: 'li-title' }, cname(c))),
              c.code === S.hero.country ? h('span', { class: 'li-right', html: ico('check') }) : null,
            ),
          );
        }
      };
      render();
      nationBox = h('div', { class: 'stack' }, h('input', { class: 'g-hero-input search', placeholder: t('searchCountry'), oninput: (e) => render(e.target.value) }), listEl);
    }

    const node = h(
      'div',
      { class: 'screen g-hero-locker' },
      h(
        'div',
        { class: 'g-hero-lockhead rise' },
        prev,
        h(
          'div',
          { class: 'g-hero-fields' },
          h('label', { class: 'g-hero-field' }, h('small', null, t('name')), nameIn),
          h('div', { class: 'g-hero-field' }, h('small', null, t('number')), h('div', { class: 'g-hero-stepper' }, h('button', { class: 'g-hero-round sm', onclick: () => setNum(-1) }, '−'), numVal, h('button', { class: 'g-hero-round sm', onclick: () => setNum(1) }, '+'))),
          h('div', { class: 'g-hero-field' }, h('small', null, t('tabNation')), h('button', { class: 'g-hero-natbtn', onclick: () => showLocker('nation') }, flagImg(country(), 'sm'), h('span', null, cname(country())))),
        ),
      ),
      tabRow,
      nationBox || grid,
    );
    setScreen('locker', node, () => showMenu());
    ctx.setTitle(t('menuLocker'));
  }

  // ------------------------------------------------------------------ TROPHIES
  function showTrophies() {
    const shelf = h('div', { class: 'g-hero-shelf' });
    if (!S.trophies.length) shelf.append(h('div', { class: 'g-hero-empty' }, h('div', { html: trophySvg('regionalCup', 84) }), h('p', { class: 'muted' }, t('emptyCabinet'))));
    for (const tr of S.trophies) {
      const club = CA.CLUBS.find((c) => c.id === tr.club) || CA.CLUBS[0];
      const ct = tr.country ? byCode(tr.country) : null;
      shelf.append(
        h(
          'div',
          { class: 'g-hero-cup' },
          h('div', { class: 'g-hero-cup-art', html: trophySvg(tr.key, 64) }),
          h('b', null, t('tr_' + tr.key)),
          h('small', null, t('seasonShort', { n: tr.s + 1 }), ' · ', ct ? cname(ct) : club.short),
        ),
      );
    }
    const st = S.stats;
    let totalStars = 0;
    for (const k in S.career.stars) totalStars += S.career.stars[k];
    const stat = (icon, label, val) => h('div', { class: 'g-hero-stat' }, h('span', { html: ico(icon) }), h('b', null, fmt(val)), h('small', null, label));
    const seasonsPlayed = Math.floor(S.career.level / CA.SEASON_LEN) + 1;
    const clubs = [];
    for (let s = 0; s < seasonsPlayed; s++) {
      const c = CA.clubForSeason(s);
      if (!clubs.includes(c)) clubs.push(c);
    }
    const node = h(
      'div',
      { class: 'screen g-hero-trophies' },
      h('div', { class: 'section-title' }, t('cabinet')),
      h('div', { class: 'g-hero-cabinet rise' }, shelf),
      h('div', { class: 'section-title' }, t('stats')),
      h(
        'div',
        { class: 'g-hero-stats rise' },
        stat('ball', t('st_goals'), st.goals),
        stat('head', t('st_air'), st.air),
        stat('curl', t('st_curl'), st.curl),
        stat('shirt', t('st_assists'), st.assists),
        stat('star', t('st_stars'), totalStars),
        stat('medal', t('st_levels'), S.career.level),
      ),
      h('div', { class: 'section-title' }, t('clubsTitle')),
      h(
        'div',
        { class: 'g-hero-clubs rise' },
        clubs.map((c) => h('div', { class: 'g-hero-clubchip' }, crest(c, 30), h('span', null, h('b', null, c.name), h('small', null, t(CA.divisionKey(c.tier)))))),
      ),
    );
    setScreen('trophies', node, () => showMenu());
    ctx.setTitle(t('menuTrophies'));
  }

  // ------------------------------------------------------------------ boot
  if (!S.hero.name) S.hero.name = '';
  if (ctx.mode === 'career') showCareer();
  else if (ctx.mode === 'daily') showDaily();
  else if (ctx.mode === 'training') showTraining();
  else showMenu();

  return () => {
    dead = true;
    destroyMatch();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    ctx.setHeaderRight(null);
  };
}
