// Hidden-object game shell for "Caça-Objetos": progress, economy, routing
// between the chapter map and the play screen, results, daily challenge and
// intros. Every chapter is one photorealistic rendered scene; its levels pick
// different (and gradually harder) objects to find, and the scenes cycle
// forever with growing difficulty.

import { playLevel } from './play.js';
import { showMap, PER_CHAPTER } from './map.js';
import { sheet, ICON, coinIcon, starRow } from './ui.js';

const hash = (str) => {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
};
// 0 → 1 over the first chapters, then keeps creeping up with every lap
const difficulty = (n) => Math.min(1, 1 - Math.exp(-n / 22));
const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function createGame(root, ctx, cfg) {
  await ctx.loadCSS(cfg.css);
  const t = ctx.makeT(cfg.strings);
  const { h } = ctx.ui;
  const store = ctx.store;
  root.classList.add('g-findit-app');
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
    sceneOf(modeId, chapter) {
      const m = cfg.modes[modeId];
      return cfg.scenes[(chapter + (m.offset || 0)) % cfg.scenes.length];
    },
  };

  function show(make) {
    if (screen) screen.destroy();
    screen = null;
    for (const el of root.querySelectorAll('.g-findit-sheet-wrap')) el.remove();
    screen = make();
  }

  // ---------------------------------------------------------------- levels
  function count(kind, d, n, daily) {
    if (kind === 'match') return 4 + Math.round(3 * d);
    if (daily) return 10;
    return Math.min(12, 5 + Math.round(5 * d) + (n % PER_CHAPTER === PER_CHAPTER - 1 ? 1 : 0));
  }

  function makeSpec(modeId, n, opts = {}) {
    const m = cfg.modes[modeId];
    const chapter = Math.floor(n / PER_CHAPTER);
    const scene = opts.scene || app.sceneOf(modeId, chapter);
    const d = opts.daily ? 0.6 : difficulty(n);
    const title = opts.daily ? t('modeDaily') : t('level', { n: n + 1 });
    // targets already used in this chapter are avoided by the next levels
    const avoid = [];
    if (!opts.daily) {
      const seen = store.get('used:' + modeId, {});
      for (let i = chapter * PER_CHAPTER; i < n; i++) avoid.push(...(seen[i] || []));
    }
    return {
      modeId,
      n,
      scene,
      kind: m.kind,
      seed: opts.seed ?? hash(`findit|${modeId}|${n}`),
      d,
      count: count(m.kind, d, n, opts.daily),
      avoid,
      startX: opts.daily ? 0.5 : [0.5, 0.25, 0.75, 0.4, 0.6][n % PER_CHAPTER],
      daily: opts.daily || null,
      map: !!m.map,
      title,
      subtitle: ctx.pick(scene.name),
    };
  }

  app.startLevel = (modeId, n) => show(() => playLevel(app, makeSpec(modeId, n)));
  app.restart = (spec) => show(() => playLevel(app, { ...spec }));
  app.showMap = (modeId) => show(() => showMap(app, modeId));

  function parFor(spec) {
    if (spec.kind === 'match') return 15 + spec.count * (24 + 12 * spec.d);
    return 12 + spec.count * (11 + 9 * spec.d);
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
    const spec = makeSpec('daily', 0, { daily: key, seed: hash(`findit|daily|${key}`), scene: cfg.scenes[(dayNum * 7) % cfg.scenes.length] });
    spec.replay = rec.last === key;
    show(() => playLevel(app, spec));
  }

  function dailyDoneScreen(rec) {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.round((tomorrow - now) / 60000));
    const el = h(
      'div',
      { class: 'g-findit-map screen g-findit-enter g-findit-daily' },
      h(
        'div',
        { class: 'g-findit-daily-card' },
        h('div', { class: 'g-findit-sheet-icon', html: ICON.calendar }),
        h('h2', { class: 'g-findit-sheet-title' }, t('modeDaily')),
        h('p', { class: 'g-findit-sheet-text' }, t('dailyAgain')),
        rec.best[rec.last] ? starRow(rec.best[rec.last].stars || 0, 3, 'big') : null,
        h(
          'div',
          { class: 'g-findit-statgrid' },
          h('div', null, h('small', null, t('time')), h('b', null, rec.best[rec.last] ? fmtTime(rec.best[rec.last].ms) : '–')),
          h('div', null, h('small', null, '🔥'), h('b', null, t('streak', { n: rec.streak }))),
        ),
        h('p', { class: 'g-findit-muted' }, t('nextDaily', { h: Math.floor(mins / 60), m: mins % 60 })),
        h('div', { class: 'g-findit-sheet-actions' },
          h('button', { class: 'g-findit-btn gold', onclick: () => ctx.exit() }, t('quit')),
          h('button', { class: 'g-findit-btn outline', onclick: () => startDaily(true) }, t('playAgain'), h('small', { class: 'g-findit-muted' }, ' · ' + t('noReward'))),
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
    const stars = secs <= par ? 3 : secs <= par * 1.8 ? 2 : 1;
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
      for (const k of Object.keys(rec.best).sort().slice(0, -30)) delete rec.best[k];
      store.set('daily', rec);
      note = t('streak', { n: rec.streak });
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
      // remember which objects this level used (the chapter's next levels avoid them)
      const used = store.get('used:' + spec.modeId, {});
      used[spec.n] = res.found;
      for (const k of Object.keys(used)) if (+k < spec.n - PER_CHAPTER * 2) delete used[k];
      store.set('used:' + spec.modeId, used);
      if (first && (spec.n + 1) % PER_CHAPTER === 0) {
        const next = app.sceneOf(spec.modeId, Math.floor((spec.n + 1) / PER_CHAPTER));
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
      { class: 'g-findit-result' },
      starRow(stars, 3, 'big'),
      h(
        'div',
        { class: 'g-findit-statgrid' },
        h('div', null, h('small', null, t('time')), h('b', null, fmtTime(res.ms))),
        h('div', null, h('small', null, t('misses')), h('b', null, String(res.misses))),
        h('div', null, h('small', null, t('hintsUsed')), h('b', null, String(res.hints))),
      ),
      coins || xp
        ? h('div', { class: 'g-findit-reward' }, coins ? h('span', null, `+${coins}`, coinIcon()) : null, xp ? h('span', null, `+${xp} XP`) : null)
        : h('p', { class: 'g-findit-muted' }, t('noReward')),
      note ? h('div', { class: 'g-findit-note' }, note) : null,
    );
    const actions = spec.daily
      ? [
          { label: t('quit'), primary: true, onclick: () => ctx.exit() },
          { label: t('playAgain'), onclick: () => startDaily(true) },
        ]
      : [
          { label: [h('span', { class: 'g-findit-btn-ico', html: ICON.play }), t('nextLevel')], primary: true, onclick: () => app.startLevel(spec.modeId, spec.n + 1) },
          { label: t('toMap'), onclick: () => app.showMap(spec.modeId) },
        ];
    sheet(app, {
      icon: ICON.trophy,
      title: spec.daily ? t('dailyDone') : t('levelDone'),
      subtitle: `${spec.title} · ${spec.subtitle}`,
      body,
      actions,
      dismissible: false,
      cls: 'g-findit-win',
    });
  };

  // ---------------------------------------------------------------- intros
  app.introFor = (spec) => {
    const modeKey = spec.daily ? 'daily' : spec.kind;
    const needHow = !app.seen('howto');
    const modeText = { match: 'introMatch', daily: 'introDaily' }[modeKey];
    const needMode = modeText && !app.seen('intro:' + modeKey);
    if (!needHow && !needMode) return null;
    return (done) => {
      app.markSeen('howto');
      if (modeText) app.markSeen('intro:' + modeKey);
      const tip = (icon, text) => h('div', { class: 'g-findit-tip' }, h('span', { class: 'g-findit-tip-ico', html: icon }), h('span', null, text));
      const body = h(
        'div',
        { class: 'g-findit-tips' },
        needMode ? h('div', { class: 'g-findit-tip g-findit-tip-mode' }, h('span', { class: 'g-findit-tip-ico', html: ICON[cfg.modes[spec.modeId].icon] || ICON.lens }), h('span', null, t(modeText))) : null,
        needHow ? [tip(ICON.hand, t('tipTap')), tip(ICON.pinch, t('tipZoom')), tip(ICON.map, t('tipPan')), tip(ICON.list, t('tipList')), tip(ICON.lens, t('tipHint')), tip(ICON.clock, t('tipMiss'))] : null,
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
  else if (cfg.modes[mode].map) app.showMap(mode);
  else app.startLevel(mode, app.track(mode).n);

  return () => {
    destroyed = true;
    if (screen) screen.destroy();
    screen = null;
    for (const el of root.querySelectorAll('.g-findit-sheet-wrap')) el.remove();
    if (window.__finditDebug) delete window.__finditDebug;
  };
}
