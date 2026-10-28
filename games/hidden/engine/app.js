// Hidden-object game shell shared by "hidden" (cozy indoor scenes) and
// "findit" (outdoor panoramas): progress, economy, routing between the
// chapter map and the play screen, results, daily challenge and intros.

import { playLevel } from './play.js';
import { showMap, PER_CHAPTER } from './map.js';
import { sheet, ICON, coinIcon, starRow } from './ui.js';
import { trimGlyphs } from './glyphs.js';

const hash = (str) => {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
};
const difficulty = (n) => 1 - Math.exp(-n / 16);
const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function createGame(root, ctx, cfg) {
  await ctx.loadCSS(new URL('../style.css', import.meta.url));
  if (cfg.css) await ctx.loadCSS(cfg.css);
  const t = ctx.makeT(cfg.strings);
  const { h } = ctx.ui;
  const store = ctx.store;
  root.classList.add('g-hidden-app', `g-hidden-look-${cfg.look}`);
  let screen = null;
  let destroyed = false;

  const app = {
    root,
    ctx,
    t,
    h,
    cfg,
    state: { coins: store.get('coins', 60), hints: store.get('hints', 3) },
    seenMap: store.get('seen', {}),
    mount(el) {
      root.append(el);
    },
    seen(k) {
      return !!app.seenMap[k];
    },
    markSeen(k) {
      if (app.seenMap[k]) return;
      app.seenMap[k] = true;
      store.set('seen', app.seenMap);
    },
    addCoins(n) {
      app.state.coins = Math.max(0, app.state.coins + n);
      store.set('coins', app.state.coins);
    },
    setHints(n) {
      app.state.hints = Math.max(0, n);
      store.set('hints', app.state.hints);
    },
    track(modeId) {
      const tr = store.get('track:' + modeId, null) || {};
      return { n: tr.n || 0, stars: tr.stars || {}, best: tr.best || {} };
    },
    saveTrack(modeId, tr) {
      store.set('track:' + modeId, tr);
    },
    debug(info) {
      if (!window.__HIDDEN_TEST__) return;
      const { level, view, goals } = info;
      const toClient = (x, y) => {
        const r = view.canvas.getBoundingClientRect();
        const s = view.worldToScreen(x, y);
        return { x: r.left + s.x, y: r.top + s.y };
      };
      window.__hiddenDebug = {
        spec: { ...info.spec, theme: info.spec.theme.id, p: info.spec.p },
        goals: () => goals.map((g) => ({ ...g })),
        targets: () => level.props.filter((p) => p.alive && (p.role === 'target' || p.role === 'pair')).map((p) => ({ ch: p.ch, key: p.key, x: p.x, y: p.y, s: p.s, role: p.role, client: toClient(p.x, p.y) })),
        props: () => level.props.length,
        view: () => ({ z: view.z, minZ: view.minZ, maxZ: view.maxZ, w: view.w, h: view.h }),
        toClient,
        centerOn: (x, y, z) => {
          view.anim = null;
          view.z = z || view.z;
          view.centerOn(x, y);
          view.request();
        },
        hint: info.useHint,
        elapsed: info.elapsed,
        state: () => ({ ...app.state }),
      };
    },
  };

  function show(make) {
    if (screen) screen.destroy();
    screen = null;
    screen = make();
  }

  // ---------------------------------------------------------------- levels
  function params(kind, d, n, m, daily) {
    const indoor = cfg.look === 'indoor';
    const p = {
      count: Math.round((indoor ? 175 : 235) + (indoor ? 150 : 170) * d),
      sMin: indoor ? 36 : 34,
      sMax: (indoor ? 74 : 70) - 8 * d,
      tSize: [(indoor ? 46 : 42) - 10 * d, (indoor ? 56 : 52) - 12 * d],
      visible: 0.66,
      skyDensity: indoor ? 0.05 : 0.07,
    };
    if (kind === 'match') p.pairs = 5 + Math.round(5 * d);
    else if (kind === 'findall') {
      const two = n % 3 === 2 && d > 0.25;
      p.groups = two ? 2 : 1;
      p.copies = two ? [5 + Math.round(2 * d), 5 + Math.round(2 * d)] : [7 + Math.round(5 * d)];
    } else if (daily) p.targets = 10;
    else if (m.zen) p.targets = 6 + Math.round(2 * d);
    else p.targets = Math.min(12, 5 + Math.round(5 * d) + (n % PER_CHAPTER === PER_CHAPTER - 1 ? 1 : 0));
    return p;
  }

  function makeSpec(modeId, n, opts = {}) {
    const m = cfg.modes[modeId];
    const T = cfg.themes.length;
    const chapter = Math.floor(n / PER_CHAPTER);
    const themeIdx = opts.themeIdx ?? (chapter + (m.offset || 0)) % T;
    const theme = cfg.themes[themeIdx];
    let d = difficulty(n);
    if (m.zen) d *= 0.45;
    if (opts.daily) d = 0.62;
    const indoor = cfg.look === 'indoor';
    const W = indoor ? Math.round(1000 + 120 * d) : Math.round((1100 + 100 * d) * 2.25);
    const H = indoor ? Math.round(W * 1.42) : Math.round(1100 + 100 * d);
    const title = opts.daily ? t('modeDaily') : m.zen ? t('scene', { n: n + 1 }) : t('level', { n: n + 1 });
    return {
      modeId,
      n,
      theme,
      themeIdx,
      kind: m.kind,
      seed: opts.seed ?? hash(`${cfg.id}|${modeId}|${n}`),
      d,
      W,
      H,
      p: params(m.kind, d, n, m, opts.daily),
      look: cfg.look,
      zen: !!m.zen,
      daily: opts.daily || null,
      map: !!m.map,
      title,
      subtitle: ctx.pick(theme.name),
    };
  }

  app.startLevel = (modeId, n) => {
    const spec = makeSpec(modeId, n);
    show(() => playLevel(app, spec));
  };
  app.restart = (spec) => show(() => playLevel(app, { ...spec }));
  app.showMap = (modeId) => show(() => showMap(app, modeId));

  function parFor(spec) {
    const p = spec.p;
    if (spec.kind === 'match') return 12 + p.pairs * (13 + 6 * spec.d);
    if (spec.kind === 'findall') return 10 + p.copies.reduce((a, b) => a + b, 0) * (6 + 4 * spec.d);
    return 10 + p.targets * (9 + 6 * spec.d);
  }

  // ---------------------------------------------------------------- daily
  function startDaily(force) {
    const key = dateKey();
    const rec = store.get('daily', null) || { last: null, streak: 0, best: {} };
    if (rec.last === key && !force) {
      show(() => dailyDoneScreen(rec));
      return;
    }
    const dayNum = Math.floor(new Date(key + 'T12:00:00').getTime() / 86400000);
    const spec = makeSpec('daily', 0, { daily: key, seed: hash(`${cfg.id}|daily|${key}`), themeIdx: dayNum % cfg.themes.length });
    spec.replay = rec.last === key;
    show(() => playLevel(app, spec));
  }

  function dailyDoneScreen(rec) {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.round((tomorrow - now) / 60000));
    const el = h(
      'div',
      { class: 'g-hidden-map screen g-hidden-enter g-hidden-daily' },
      h(
        'div',
        { class: 'g-hidden-daily-card' },
        h('div', { class: 'g-hidden-sheet-icon', html: ICON.calendar }),
        h('h2', { class: 'g-hidden-sheet-title' }, t('modeDaily')),
        h('p', { class: 'g-hidden-sheet-text' }, t('dailyAgain')),
        rec.best[rec.last] ? starRow(rec.best[rec.last].stars || 0, 3, 'big') : null,
        h(
          'div',
          { class: 'g-hidden-statgrid' },
          h('div', null, h('small', null, t('time')), h('b', null, rec.best[rec.last] ? fmtTime(rec.best[rec.last].ms) : '–')),
          h('div', null, h('small', null, '🔥'), h('b', null, t('streak', { n: rec.streak }))),
        ),
        h('p', { class: 'g-hidden-muted' }, t('nextDaily', { h: Math.floor(mins / 60), m: mins % 60 })),
        h('div', { class: 'g-hidden-sheet-actions' },
          h('button', { class: 'g-hidden-btn gold', onclick: () => ctx.exit() }, t('quit')),
          h('button', { class: 'g-hidden-btn outline', onclick: () => startDaily(true) }, t('playAgain'), h('small', { class: 'g-hidden-muted' }, ' · ' + t('noReward'))),
        ),
      ),
    );
    app.mount(el);
    return { back: () => false, destroy: () => el.remove() };
  }

  // ---------------------------------------------------------------- results
  app.complete = (spec, res) => {
    if (destroyed) return;
    const secs = res.ms / 1000;
    const par = parFor(spec);
    const stars = spec.zen ? 0 : secs <= par ? 3 : secs <= par * 1.8 ? 2 : 1;
    let coins = 0, xp = 0, note = null;
    if (spec.daily) {
      const rec = store.get('daily', null) || { last: null, streak: 0, best: {} };
      if (!spec.replay) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        rec.streak = rec.last === dateKey(y) ? rec.streak + 1 : 1;
        rec.last = spec.daily;
        coins = 40;
        xp = 25;
      }
      const prev = rec.best[spec.daily];
      if (!prev || res.ms < prev.ms) rec.best[spec.daily] = { ms: res.ms, stars };
      // keep the record small
      for (const k of Object.keys(rec.best).sort().slice(0, -30)) delete rec.best[k];
      store.set('daily', rec);
      note = t('streak', { n: rec.streak });
    } else if (spec.zen) {
      const zn = store.get('zen', 0);
      if (spec.n >= zn) store.set('zen', spec.n + 1);
      coins = 6;
      xp = 8;
    } else {
      const tr = app.track(spec.modeId);
      const first = spec.n >= tr.n;
      const prevStars = tr.stars[spec.n] || 0;
      coins = first ? 10 + 5 * stars : 3 + Math.max(0, stars - prevStars) * 5;
      xp = first ? 10 + 2 * stars : 4;
      tr.stars[spec.n] = Math.max(prevStars, stars);
      tr.best[spec.n] = Math.min(tr.best[spec.n] || Infinity, Math.round(res.ms));
      if (first) tr.n = spec.n + 1;
      app.saveTrack(spec.modeId, tr);
      if (first && (spec.n + 1) % PER_CHAPTER === 0) {
        const m = cfg.modes[spec.modeId];
        const next = cfg.themes[(Math.floor((spec.n + 1) / PER_CHAPTER) + (m.offset || 0)) % cfg.themes.length];
        note = t('newChapter', { name: ctx.pick(next.name) });
      }
    }
    if (coins) app.addCoins(coins);
    if (xp) ctx.addXP?.(xp);
    ctx.sfx.play('win');
    ctx.sfx.vibrate([30, 60, 30, 60, 60]);
    ctx.ui.confetti(90);

    const body = h(
      'div',
      { class: 'g-hidden-result' },
      spec.zen ? null : starRow(stars, 3, 'big'),
      h(
        'div',
        { class: 'g-hidden-statgrid' },
        spec.zen ? null : h('div', null, h('small', null, t('time')), h('b', null, fmtTime(res.ms))),
        h('div', null, h('small', null, t('misses')), h('b', null, String(res.misses))),
        h('div', null, h('small', null, t('hintsUsed')), h('b', null, String(res.hints))),
      ),
      coins || xp
        ? h('div', { class: 'g-hidden-reward' }, coins ? h('span', null, `+${coins}`, coinIcon()) : null, xp ? h('span', null, `+${xp} XP`) : null)
        : h('p', { class: 'g-hidden-muted' }, t('noReward')),
      note ? h('div', { class: 'g-hidden-note' }, note) : null,
    );
    const actions = spec.daily
      ? [
          { label: t('quit'), primary: true, onclick: () => ctx.exit() },
          { label: t('playAgain'), onclick: () => startDaily(true) },
        ]
      : spec.zen
        ? [
            { label: [h('span', { class: 'g-hidden-btn-ico', html: ICON.play }), t('nextScene')], primary: true, onclick: () => app.startLevel(spec.modeId, spec.n + 1) },
            { label: t('quit'), onclick: () => ctx.exit() },
          ]
        : [
            { label: [h('span', { class: 'g-hidden-btn-ico', html: ICON.play }), t('nextLevel')], primary: true, onclick: () => app.startLevel(spec.modeId, spec.n + 1) },
            { label: t('toMap'), onclick: () => app.showMap(spec.modeId) },
          ];
    sheet(app, {
      icon: ICON.trophy,
      title: spec.daily ? t('dailyDone') : spec.zen ? t('zenDone') : t('levelDone'),
      subtitle: `${spec.title} · ${spec.subtitle}`,
      body,
      actions,
      dismissible: false,
      cls: 'g-hidden-win',
    });
  };

  // ---------------------------------------------------------------- intros
  app.introFor = (spec) => {
    const modeKey = spec.daily ? 'daily' : spec.zen ? 'zen' : spec.kind;
    const needHow = !app.seen('howto');
    const modeText = { findall: 'introFindall', match: 'introMatch', zen: 'introZen', daily: 'introDaily' }[modeKey];
    const needMode = modeText && !app.seen('intro:' + modeKey);
    if (!needHow && !needMode) return null;
    return (done) => {
      app.markSeen('howto');
      if (modeText) app.markSeen('intro:' + modeKey);
      const tip = (icon, text) => h('div', { class: 'g-hidden-tip' }, h('span', { class: 'g-hidden-tip-ico', html: icon }), h('span', null, text));
      const body = h(
        'div',
        { class: 'g-hidden-tips' },
        needMode ? h('div', { class: 'g-hidden-tip g-hidden-tip-mode' }, h('span', { class: 'g-hidden-tip-ico', html: ICON[cfg.modes[spec.modeId].icon] || ICON.lens }), h('span', null, t(modeText))) : null,
        needHow ? [tip(ICON.hand, t('tipTap')), tip(ICON.pinch, t('tipZoom')), cfg.extraTip ? tip(ICON.map, t(cfg.extraTip)) : null, tip(ICON.lens, t('tipHint')), spec.zen ? null : tip(ICON.clock, t('tipMiss'))] : null,
      );
      return sheet(app, {
        icon: ICON.lens,
        title: needHow ? t('howTitle') : t(cfg.modes[spec.modeId].label),
        body,
        actions: [{ label: t('gotIt'), primary: true }],
        onClose: done,
      });
    };
  };

  // ---------------------------------------------------------------- routing
  ctx.onBack(() => {
    if (!screen) return false;
    return screen.back() === true;
  });
  const mode = ctx.mode && cfg.modes[ctx.mode] ? ctx.mode : null;
  if (!mode) app.startLevel(cfg.defaultMode, app.track(cfg.defaultMode).n);
  else if (cfg.modes[mode].daily) startDaily();
  else if (cfg.modes[mode].zen) app.startLevel(mode, store.get('zen', 0));
  else if (cfg.modes[mode].map) app.showMap(mode);
  else app.startLevel(mode, app.track(mode).n);

  return () => {
    destroyed = true;
    if (screen) screen.destroy();
    screen = null;
    for (const el of root.querySelectorAll('.g-hidden-sheet-wrap')) el.remove();
    trimGlyphs();
    if (window.__hiddenDebug) delete window.__hiddenDebug;
  };
}
