// Road to a Million — a TV quiz show: 16 questions up a prize ladder to one
// (fictitious) million, with cards, students, audience and skip lifelines.
//   ctx.mode: 'classic' → straight into a game · 'league' → weekly league ·
//   'practice' → theme picker · none → the show's main menu.

import STRINGS from './strings.js';
import { h } from '../../js/core/ui.js';
import { loadQuestions } from './questions/index.js';
import { createPool, levelFromXp, money, fmtInt } from './engine.js';
import { OUTFITS, STUDIOS, studioById, studioVars, divisionBadge, divisionName, DIVISIONS, ico, studioPreview, hostSVG } from './art.js';
import { makeScope, createSheets, makeStage } from './kit.js';
import { makeFx } from './sound.js';
import { loadLeague, standings, weekFraction, timeLeft, matchPoints, PROMOTE, RELEGATE, LEAGUE_SIZE } from './league.js';
import { playShow } from './show.js';
import { practicePicker } from './practice.js';

const PDEF = { coins: 0, xp: 0, games: 0, millions: 0, best: 0, total: 0, correct: 0, answered: 0, lifelines: 0, outfits: ['tux'], studios: ['gold'], outfit: 'tux', studio: 'gold', practice: {} };

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const lang = ctx.lang;
  const entry = ['classic', 'league', 'practice'].includes(ctx.mode) ? ctx.mode : null;
  const pending = new Set(); // shell-level timeouts (view exit animations)
  let unmounted = false;

  const views = h('div', { class: 'g-million-views' });
  const layer = h('div', { class: 'g-million-layer' });
  root.append(h('div', { class: 'g-million-app' }, views, layer));
  views.append(h('div', { class: 'screen center' }, h('div', { class: 'spinner' })));

  // ---------- profile ----------
  const stored = ctx.store.get('profile', {});
  const P = { ...PDEF, ...(stored && typeof stored === 'object' ? stored : {}) };
  for (const k of ['outfits', 'studios']) if (!Array.isArray(P[k])) P[k] = PDEF[k].slice();
  if (!P.practice || typeof P.practice !== 'object') P.practice = {};
  const saveP = () => ctx.store.set('profile', P);

  const applyStudio = () => {
    const vars = studioVars(studioById(P.studio));
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  };
  applyStudio();

  // ---------- header coins ----------
  const coinNum = h('b', null, fmtInt(P.coins, lang));
  const pill = h('div', { class: 'g-million-pill', title: t('coins') }, h('span', { html: ico('coin') }), coinNum);
  ctx.setHeaderRight(pill);
  const refreshCoins = (bump = false) => {
    coinNum.textContent = fmtInt(P.coins, lang);
    if (bump) {
      pill.classList.remove('bump');
      void pill.offsetWidth;
      pill.classList.add('bump');
    }
  };

  const bank = await loadQuestions();
  if (unmounted) return () => {};
  const pool = createPool(bank, ctx.store);
  const fx = makeFx(ctx.sfx);
  const sheets = createSheets(layer);

  // ---------- views ----------
  let cur = null;
  function show(build, { cls = '', title = null, back = null } = {}) {
    sheets.closeAll();
    if (cur) {
      cur.scope.dispose();
      const old = cur.el;
      old.classList.add('g-million-out');
      old.inert = true;
      const id = setTimeout(() => {
        pending.delete(id);
        old.remove();
      }, 280);
      pending.add(id);
    } else views.replaceChildren();
    const el = h('div', { class: `g-million-view ${cls}` });
    views.append(el);
    const scope = makeScope();
    cur = { el, scope, back, extras: [] };
    ctx.setTitle(title || undefined);
    build(el, scope);
    return el;
  }

  ctx.onBack(() => {
    if (sheets.back()) return true;
    if (!cur) return false;
    for (const fn of cur.extras) if (fn()) return true;
    if (cur.back) return cur.back() !== false;
    return false;
  });

  // ---------- league sync ----------
  let pendingClosed = null;
  function syncLeague() {
    const { state, closed } = loadLeague(ctx.store);
    if (closed) {
      pendingClosed = closed;
      if (closed.reward) {
        P.coins += closed.reward;
        saveP();
        refreshCoins(true);
      }
    }
    return state;
  }

  const app = {
    ctx,
    t,
    lang,
    pick: ctx.pick,
    sfx: ctx.sfx,
    fx,
    pool,
    store: ctx.store,
    sheets,
    P,
    saveP,
    show,
    home,
    leagueView,
    onBackExtra: (fn) => cur && cur.extras.push(fn),
    leaveFirst: () => (entry === 'classic' ? ctx.exit() : home()),
    addCoins(n) {
      P.coins += n;
      saveP();
      refreshCoins(true);
    },
    recordGame({ prize, correct, answered, lifelines, win, league }) {
      const coins = correct * 3 + Math.floor(prize / 10000) + (win ? 100 : 0);
      const xp = Math.min(38, 6 + correct * 2) + (win ? 22 : 0);
      const newBest = prize > 0 && prize > P.best;
      P.coins += coins;
      P.xp += xp;
      P.games++;
      P.correct += correct;
      P.answered += answered;
      P.lifelines += lifelines;
      P.total += prize;
      if (win) P.millions++;
      P.best = Math.max(P.best, prize);
      let leaguePts = 0;
      let leagueState = null;
      if (league) {
        leagueState = syncLeague();
        leaguePts = matchPoints(correct);
        leagueState.pts += leaguePts;
        leagueState.games += 1;
        ctx.store.set('league', leagueState);
      }
      saveP();
      pool.flush();
      refreshCoins(true);
      ctx.addXP?.(xp);
      return { coins, xp, newBest, leaguePts, leagueState };
    },
  };

  // ---------- main menu ----------
  function home() {
    const league = syncLeague();
    show(
      (el, scope) => {
        const stage = makeStage(scope, { outfit: P.outfit, variant: 'menu', hostName: t('hostName') });
        stage.screen(t('screenMenu'), money(1e6, lang, { upper: true }), 'final');
        scope.later(() => stage.say([t('hello1'), t('hello2'), t('hello3')][Math.floor(Math.random() * 3)], 'happy'), 300);
        const lv = levelFromXp(P.xp);
        const rows = standings(league, weekFraction());
        const me = rows.find((r) => r.me);
        const profile = h(
          'div',
          { class: 'g-million-prof' },
          h('div', { class: 'g-million-lv' }, h('small', null, t('lvShort')), h('b', null, lv.level)),
          h(
            'div',
            { class: 'g-million-prof-body' },
            h('div', { class: 'g-million-prof-row' }, h('b', null, t('levelN', { n: lv.level })), h('span', null, `${fmtInt(lv.into, lang)} / ${fmtInt(lv.need, lang)} XP`)),
            h('div', { class: 'progress g-million-xpbar' }, h('i', { style: { width: `${Math.round(lv.progress * 100)}%` } })),
          ),
          h('div', { class: 'g-million-prof-best' }, h('small', null, t('bestPrize')), h('b', null, money(P.best, lang))),
        );
        const cards = h(
          'div',
          { class: 'g-million-modes' },
          h(
            'button',
            { class: 'g-million-mode league', onclick: () => leagueView() },
            h('span', { class: 'g-million-mode-art', html: divisionBadge(league.div, 52) }),
            h('b', null, t('leagueTitle')),
            h('small', null, divisionName(league.div, ctx.pick)),
            h('span', { class: 'g-million-mode-tag' }, `#${me.pos} · ${fmtInt(league.pts, lang)} ${t('ptsShort')}`),
          ),
          h(
            'button',
            { class: 'g-million-mode practice', onclick: () => practicePicker(app) },
            h('span', { class: 'g-million-mode-art book', html: ico('book') }),
            h('b', null, t('practiceTitle')),
            h('small', null, t('practiceShort')),
            h('span', { class: 'g-million-mode-tag' }, t('noPressure')),
          ),
        );
        const list = h(
          'div',
          { class: 'list g-million-list' },
          listItem('shop', t('shopTitle'), t('shopSub'), () => shopView()),
          listItem('chart', t('statsTitle'), t('statsSub', { n: fmtInt(P.games, lang) }), () => statsSheet()),
          listItem('help', t('helpTitle'), t('helpSub'), () => helpSheet()),
        );
        el.append(
          stage.el,
          h(
            'div',
            { class: 'g-million-menu-body' },
            profile,
            h('button', { class: 'btn primary big block g-million-playbtn', onclick: () => playShow(app) }, h('span', { class: 'btn-ico', html: ico('play') }), t('play')),
            h('p', { class: 'g-million-playhint' }, t('playHint')),
            cards,
            list,
          ),
        );
        if (pendingClosed) scope.later(() => leagueClosedSheet(), 500);
      },
      { cls: 'g-million-scroll g-million-menu', back: () => false },
    );
  }

  function listItem(icon, title, sub, onclick) {
    return h(
      'button',
      { class: 'list-item g-million-li', onclick },
      h('span', { class: 'li-icon g-million-li-ico', html: ico(icon) }),
      h('span', { class: 'li-body' }, h('span', { class: 'li-title' }, title), h('span', { class: 'li-sub' }, sub)),
      h('span', { class: 'li-right g-million-chev' }, '›'),
    );
  }

  // ---------- league ----------
  function fmtLeft(ms) {
    const m = Math.floor(ms / 60000);
    const d = Math.floor(m / 1440);
    const hh = Math.floor((m % 1440) / 60);
    const mm = m % 60;
    if (d > 0) return t('leftDH', { d, h: hh });
    return t('leftHM', { h: hh, m: mm });
  }

  function leagueView() {
    const state = syncLeague();
    show(
      (el, scope) => {
        const rows = standings(state, weekFraction());
        const me = rows.find((r) => r.me);
        const left = h('span', null, fmtLeft(timeLeft()));
        scope.every(() => (left.textContent = fmtLeft(timeLeft())), 15000);
        const head = h(
          'div',
          { class: 'g-million-lhead' },
          h('div', { class: 'g-million-lbadge', html: divisionBadge(state.div, 84) }),
          h(
            'div',
            { class: 'g-million-lhead-body' },
            h('small', null, t('division')),
            h('h2', null, divisionName(state.div, ctx.pick)),
            h('div', { class: 'g-million-lclock' }, h('span', { html: ico('fire') }), t('weekEnds'), ' ', left),
          ),
        );
        const statRow = h(
          'div',
          { class: 'g-million-lstats' },
          h('div', null, h('b', null, `#${me.pos}`), h('small', null, t('position'))),
          h('div', null, h('b', null, fmtInt(state.pts, lang)), h('small', null, t('points'))),
          h('div', null, h('b', null, state.games), h('small', null, t('gamesWeek'))),
        );
        const table = h('div', { class: 'g-million-table' });
        rows.forEach((r) => {
          const up = r.pos <= PROMOTE;
          const down = state.div > 0 && r.pos > LEAGUE_SIZE - RELEGATE;
          if (r.pos === PROMOTE + 1) table.append(h('div', { class: 'g-million-zone up' }, h('span', null, '▲ ' + t('zoneUp'))));
          if (state.div > 0 && r.pos === LEAGUE_SIZE - RELEGATE + 1) table.append(h('div', { class: 'g-million-zone down' }, h('span', null, '▼ ' + t('zoneDown'))));
          const name = r.me ? t('you') : r.name;
          table.append(
            h(
              'div',
              { class: `g-million-trow ${r.me ? 'me' : ''} ${up ? 'up' : ''} ${down ? 'down' : ''}` },
              h('span', { class: 'pos' }, r.pos),
              h('span', { class: 'av', style: { background: r.color } }, r.me ? h('span', { html: ico('star') }) : name.slice(0, 1)),
              h('span', { class: 'nm' }, name),
              h('span', { class: 'pt' }, fmtInt(r.pts, lang)),
            ),
          );
        });
        const ladder = h(
          'div',
          { class: 'g-million-divs' },
          Array.from({ length: DIVISIONS.length + 1 }, (_, i) =>
            h('div', { class: `g-million-div ${i === state.div ? 'cur' : ''} ${i < state.div ? 'past' : ''}` }, h('span', { html: divisionBadge(i, 38) }), h('small', null, divisionName(i, ctx.pick))),
          ),
        );
        el.append(
          head,
          statRow,
          h('button', { class: 'btn primary big block', onclick: () => playShow(app, { league: true }) }, h('span', { class: 'btn-ico', html: ico('play') }), t('playLeague')),
          h('p', { class: 'g-million-lrules' }, state.div > 0 ? t('leagueRules', { up: PROMOTE, down: RELEGATE }) : t('leagueRulesBronze', { up: PROMOTE }), ' ', t('leaguePtsRule')),
          h('div', { class: 'g-million-label' }, t('standings')),
          table,
          h('div', { class: 'g-million-label' }, t('divisions')),
          ladder,
        );
        if (pendingClosed) scope.later(() => leagueClosedSheet(), 400);
      },
      {
        cls: 'screen g-million-scroll',
        title: t('leagueTitle'),
        back: () => {
          if (entry === 'league') return false;
          home();
          return true;
        },
      },
    );
  }

  async function leagueClosedSheet() {
    const c = pendingClosed;
    if (!c || sheets.count) return;
    pendingClosed = null;
    const title = { up: t('promoted'), down: t('relegated'), stay: t('stayed'), idle: t('idleWeek') }[c.result];
    const body = h(
      'div',
      { class: 'g-million-closed' },
      h('div', { class: `g-million-closed-badge ${c.result}`, html: divisionBadge(c.to, 96) }),
      h('b', null, divisionName(c.to, ctx.pick)),
      c.result !== 'idle' ? h('p', null, t('finalPos', { pos: c.pos, pts: fmtInt(c.pts, lang) })) : h('p', null, t('idleText')),
      c.reward ? h('div', { class: 'g-million-res-chip coin' }, h('span', { html: ico('coin') }), h('b', null, `+${c.reward}`), h('small', null, t('coins'))) : null,
    );
    if (c.result === 'up') {
      fx.milestone();
      ctx.ui.confetti(90);
    } else if (c.result === 'down') ctx.sfx.play('lose');
    else fx.coins(4);
    await sheets.open({ title, sub: t('weekClosed'), body, actions: [{ label: t('ok'), value: true, primary: true }] }).done;
  }

  // ---------- shop ----------
  function shopView(tab = 'studios') {
    show(
      (el) => {
        const tabs = h(
          'div',
          { class: 'chips g-million-tabs' },
          ['studios', 'outfits'].map((id) => h('button', { class: `chip ${id === tab ? 'active' : ''}`, onclick: () => id !== tab && shopView(id) }, t(`tab_${id}`))),
        );
        const items = tab === 'studios' ? STUDIOS : OUTFITS;
        const owned = tab === 'studios' ? P.studios : P.outfits;
        const equipped = tab === 'studios' ? P.studio : P.outfit;
        const grid = h(
          'div',
          { class: 'g-million-shop' },
          items.map((it, i) => {
            const has = owned.includes(it.id);
            const on = equipped === it.id;
            const preview = tab === 'studios' ? h('div', { class: 'g-million-shop-prev', html: studioPreview(it) }) : h('div', { class: 'g-million-shop-prev host', html: hostSVG(it.id, 'happy') });
            const action = on
              ? h('span', { class: 'g-million-shop-on' }, h('span', { html: ico('check') }), t('equipped'))
              : has
                ? h('button', { class: 'btn small', onclick: () => equip(tab, it) }, t('use'))
                : h('button', { class: `btn small primary ${P.coins < it.price ? 'poor' : ''}`, onclick: () => buy(tab, it) }, h('span', { class: 'g-million-cico', html: ico('coin') }), fmtInt(it.price, lang));
            return h('div', { class: `g-million-shop-item ${on ? 'on' : ''}`, style: { animationDelay: `${i * 40}ms` } }, preview, h('b', null, ctx.pick(it.name)), action);
          }),
        );
        el.append(h('div', { class: 'g-million-head' }, h('div', { class: 'g-million-head-ico', html: ico('shop') }), h('div', null, h('h2', null, t('shopTitle')), h('p', null, t('shopText')))), tabs, grid);
      },
      {
        cls: 'screen g-million-scroll',
        title: t('shopTitle'),
        back: () => {
          home();
          return true;
        },
      },
    );
  }

  function equip(tab, it) {
    if (tab === 'studios') {
      P.studio = it.id;
      applyStudio();
    } else P.outfit = it.id;
    saveP();
    ctx.sfx.play('select');
    shopView(tab);
  }

  async function buy(tab, it) {
    if (P.coins < it.price) {
      ctx.ui.toast(t('notEnough', { n: fmtInt(it.price - P.coins, lang) }));
      ctx.sfx.play('error');
      return;
    }
    const ok = await sheets.open({
      title: t('buyTitle'),
      sub: t('buyText', { name: ctx.pick(it.name), price: fmtInt(it.price, lang) }),
      body: tab === 'studios' ? h('div', { class: 'g-million-shop-prev big', html: studioPreview(it) }) : h('div', { class: 'g-million-shop-prev host big', html: hostSVG(it.id, 'happy') }),
      actions: [
        { label: t('buy'), value: true, primary: true },
        { label: t('cancel'), value: false },
      ],
    }).done;
    if (!ok || unmounted) return;
    P.coins -= it.price;
    (tab === 'studios' ? P.studios : P.outfits).push(it.id);
    refreshCoins(true);
    fx.coins(5);
    ctx.ui.toast(t('bought'));
    equip(tab, it);
  }

  // ---------- stats & help ----------
  function statsSheet() {
    const acc = P.answered ? Math.round((P.correct / P.answered) * 100) : 0;
    const lg = syncLeague();
    const rows = [
      [t('stGames'), fmtInt(P.games, lang)],
      [t('stMillions'), fmtInt(P.millions, lang)],
      [t('stBest'), money(P.best, lang)],
      [t('stTotal'), money(P.total, lang)],
      [t('stCorrect'), fmtInt(P.correct, lang)],
      [t('stAccuracy'), `${acc}%`],
      [t('stLifelines'), fmtInt(P.lifelines, lang)],
      [t('stLeague'), divisionName(Math.max(lg.best || 0, lg.div), ctx.pick)],
      [t('stBank'), fmtInt(pool.size, lang)],
    ];
    sheets.open({
      title: t('statsTitle'),
      icon: ico('chart'),
      body: h(
        'div',
        { class: 'g-million-stats' },
        rows.map(([k, v]) => h('div', { class: 'g-million-stat' }, h('span', null, k), h('b', null, v))),
      ),
      actions: [{ label: t('close'), value: true, primary: true }],
    });
  }

  function helpSheet() {
    sheets.open({
      title: t('helpTitle'),
      icon: ico('help'),
      cls: 'help',
      body: h(
        'div',
        { class: 'g-million-help' },
        ['help1', 'help2', 'help3', 'help4', 'help5', 'help6', 'help7'].map((k, i) => h('div', { class: 'g-million-help-row' }, h('span', { class: 'n' }, i + 1), h('p', null, t(k)))),
      ),
      actions: [{ label: t('gotIt'), value: true, primary: true }],
    });
  }

  // ---------- start ----------
  if (entry === 'classic') playShow(app);
  else if (entry === 'league') leagueView();
  else if (entry === 'practice') practicePicker(app, { root: true });
  else home();

  return () => {
    unmounted = true;
    if (cur) cur.scope.dispose();
    sheets.closeAll();
    pending.forEach(clearTimeout);
    pool.flush();
    ctx.setHeaderRight(null);
  };
}
