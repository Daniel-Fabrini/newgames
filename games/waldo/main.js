// "Cadê o Ruivinho?" — find the one character in a crowded, procedurally
// painted scene. Modes: classic (chapters of 5 scenes, stars for speed),
// timed (2 minutes, as many scenes as possible) and a daily scene with a streak.
// Lobby modes map to ctx.mode: 'classic' | 'timed' | 'daily'.

import STRINGS from './strings.js';
import { icon } from './icons.js';
import { buildScene } from './engine/scene.js';
import { createViewer } from './engine/view.js';
import { drawPortrait, targetPerson } from './engine/people.js';
import { classicPlan, timedPlan, dailyPlan, starsFor, dateKey, yesterdayKey, mmss, makeClock, CHAPTER_SCENES, HINT_PRICE, DAILY_COINS } from './engine/progress.js';

const TIMED_SECONDS = 120;
const TIMED_BONUS = 6;
const WRONG_PENALTY = 3;
const TIP_EVERY = 30;
const START_HINTS = 3;
const THEME_KEY = {
  beach: 'themeBeach',
  station: 'themeStation',
  ski: 'themeSki',
  market: 'themeMarket',
  street: 'themeStreet',
  fair: 'themeFair',
  stadium: 'themeStadium',
  castle: 'themeCastle',
  harbour: 'themeHarbour',
  zoo: 'themeZoo',
  library: 'themeLibrary',
};

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const store = ctx.store;
  const entry = ['classic', 'timed', 'daily'].includes(ctx.mode) ? ctx.mode : null;

  let alive = true;
  let view = null; // 'menu' | 'play'
  let menuEl = null;
  let playEl = null;
  let viewer = null;
  let sess = null;
  let pre = null; // { key, scene } prebuilt scene
  let sceneToken = 0;
  let modalOpen = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  // ---------- storage ----------
  const getCoins = () => store.get('coins', 0);
  const getHints = () => store.get('hints', START_HINTS);
  const getClassic = () => store.get('classic', { idx: 0, run: 0, runStars: 0, stars: 0, scenes: 0, chapters: 0 });
  const getTimedBest = () => store.get('timedBest', { score: 0, scenes: 0 });
  const getDaily = () => store.get('daily', { last: null, streak: 0, best: null, days: {} });

  // ---------- small UI pieces ----------
  const coinPill = h('div', { class: 'g-waldo-pill g-waldo-coinpill' });
  const refreshCoins = () => {
    coinPill.innerHTML = icon('coin') + `<b>${getCoins()}</b>`;
  };
  const addCoins = (n) => {
    store.set('coins', Math.max(0, getCoins() + n));
    refreshCoins();
  };

  function portraitCanvas(size, pose, bg) {
    const c = document.createElement('canvas');
    const d = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size * d);
    c.height = Math.round(size * d);
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    c.className = 'g-waldo-portrait';
    const g = c.getContext('2d');
    g.scale(d, d);
    const grd = g.createRadialGradient(size / 2, size * 0.38, 0, size / 2, size * 0.38, size * 0.62);
    grd.addColorStop(0, bg[0]);
    grd.addColorStop(1, bg[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    g.fillStyle = 'rgba(255,220,120,0.10)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(size / 2, size * 0.38);
      g.lineTo(size / 2 + Math.cos(a) * size, size * 0.38 + Math.sin(a) * size);
      g.lineTo(size / 2 + Math.cos(a + 0.12) * size, size * 0.38 + Math.sin(a + 0.12) * size);
      g.closePath();
      g.fill();
    }
    drawPortrait(g, targetPerson(null, pose), size / 2, size * 0.5, size);
    return c;
  }

  function showCard({ title, stars = null, lines = [], actions = [] }) {
    if (!playEl) return;
    const card = playEl.querySelector('.g-waldo-result');
    clear(card);
    const box = h(
      'div',
      { class: 'g-waldo-card pop-in' },
      h('h2', { class: 'g-waldo-card-title' }, title),
      stars !== null ? h('div', { class: 'g-waldo-stars' }, [0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '', style: { animationDelay: `${0.15 + i * 0.18}s` } }, '★'))) : null,
      lines.filter(Boolean).map((l) => h('p', { class: 'g-waldo-card-line' }, l)),
      h(
        'div',
        { class: 'g-waldo-card-actions' },
        actions.map((a) => h('button', { class: `btn big block ${a.primary ? 'primary' : ''}`, onclick: a.onClick }, a.label)),
      ),
    );
    card.append(box);
    card.classList.add('show');
  }

  function hideCard() {
    if (!playEl) return;
    const card = playEl.querySelector('.g-waldo-result');
    card.classList.remove('show');
    clear(card);
  }

  // ---------- modal and pause helpers ----------
  async function askModal(opts) {
    if (modalOpen) return null;
    modalOpen = true;
    pauseSess();
    const v = await ctx.ui.modal({ dismissible: true, ...opts });
    modalOpen = false;
    if (!alive) return v;
    if (sess && !sess.done && !document.hidden) resumeSess();
    return v;
  }

  function pauseSess() {
    if (!sess || sess.paused) return;
    sess.paused = true;
    sess.clock.pause();
    sess.gameClock && sess.gameClock.pause();
  }

  function resumeSess() {
    if (!sess || !sess.paused) return;
    sess.paused = false;
    sess.clock.resume();
    sess.gameClock && sess.gameClock.resume();
  }

  // ---------- menu ----------
  function showMenu() {
    endPlay();
    view = 'menu';
    ctx.setTitle();
    ctx.setHeaderRight(coinPill);
    refreshCoins();
    const c = getClassic();
    const daily = getDaily();
    const doneToday = !!daily.days[dateKey()];
    const streakN = daily.last === dateKey() || daily.last === yesterdayKey() ? daily.streak : 0;
    const best = getTimedBest();
    const pct = Math.round((c.run / CHAPTER_SCENES) * 100);

    const hero = h(
      'section',
      { class: 'g-waldo-hero' },
      h('div', { class: 'g-waldo-hero-art' }, portraitCanvas(150, 'wave', ['#3d2a0a', '#0a0a0c'])),
      h('div', { class: 'g-waldo-hero-text' }, h('h2', null, t('heroTitle')), h('p', null, t('heroText'))),
    );
    const stats = h(
      'div',
      { class: 'g-waldo-stats' },
      h('div', { class: 'g-waldo-stat' }, h('span', { class: 'g-waldo-stat-ico', html: icon('coin') }), h('b', null, String(getCoins())), h('small', null, t('statCoins'))),
      h(
        'button',
        { class: 'g-waldo-stat g-waldo-stat-btn', onclick: buyHintFromMenu },
        h('span', { class: 'g-waldo-stat-ico', html: icon('search') }),
        h('b', null, String(getHints())),
        h('small', null, t('statHints')),
      ),
      h('div', { class: 'g-waldo-stat' }, h('span', { class: 'g-waldo-stat-ico', html: icon('star') }), h('b', null, String(c.stars)), h('small', null, t('statStars'))),
    );
    const cta = h(
      'button',
      { class: 'btn primary big block g-waldo-cta', onclick: () => startClassic() },
      h('span', { class: 'btn-ico', html: icon('play') }),
      t('continueBtn', { n: c.idx + 1 }),
    );
    const ctaBar = h(
      'div',
      { class: 'g-waldo-chapter' },
      h('div', { class: 'progress' }, h('i', { style: { width: `${pct}%` } })),
      h('small', { class: 'muted' }, `${c.run}/${CHAPTER_SCENES}`),
    );
    const modeCard = (key, ico, title, sub, right, onclick) =>
      h(
        'button',
        { class: 'g-waldo-mode', onclick },
        h('span', { class: 'g-waldo-mode-ico', html: icon(ico) }),
        h('span', { class: 'g-waldo-mode-body' }, h('b', null, title), h('small', null, sub)),
        right ? h('span', { class: 'g-waldo-mode-right' }, right) : h('span', { class: 'g-waldo-mode-chev', html: icon('back') }),
      );
    const modes = h(
      'div',
      { class: 'g-waldo-modes' },
      modeCard('classic', 'search', t('modeClassic'), t('modeClassicSub'), null, () => startClassic()),
      modeCard('timed', 'clock', t('modeTimed'), t('modeTimedSub'), best.scenes ? t('best', { n: best.scenes }) : null, () => startTimed()),
      modeCard(
        'daily',
        'calendar',
        t('modeDaily'),
        t('modeDailySub'),
        doneToday ? h('span', { class: 'g-waldo-done', html: icon('check') }) : streakN ? h('span', { class: 'g-waldo-streak', html: icon('fire') }, streakN) : null,
        () => startDaily(false),
      ),
    );
    menuEl = h(
      'div',
      { class: 'screen g-waldo-menu' },
      hero,
      stats,
      cta,
      ctaBar,
      modes,
      h('button', { class: 'btn ghost block g-waldo-how', onclick: howToPlay }, h('span', { class: 'btn-ico', html: icon('book') }), t('howBtn')),
    );
    root.append(menuEl);
    requestAnimationFrame(() => menuEl && menuEl.classList.add('in'));
  }

  function hideMenu() {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
  }

  function howToPlay() {
    askModal({ title: t('howTitle'), body: t('howText'), actions: [{ label: t('close'), value: true, primary: true }] });
  }

  async function buyHintFromMenu() {
    const ok = await askModal({
      title: t('hintBuyTitle'),
      body: t('hintBuyText', { n: HINT_PRICE }),
      actions: [
        { label: t('buy'), value: true, primary: true },
        { label: t('cancel'), value: false },
      ],
    });
    if (!ok) return;
    if (getCoins() < HINT_PRICE) return ctx.ui.toast(t('noCoins'));
    addCoins(-HINT_PRICE);
    store.set('hints', getHints() + 1);
    refreshMenu();
  }

  function refreshMenu() {
    if (view !== 'menu') return;
    hideMenu();
    showMenu();
  }

  // ---------- play view ----------
  function playView() {
    hideMenu();
    view = 'play';
    ctx.setTitle();
    ctx.setHeaderRight(coinPill);
    refreshCoins();
    playEl = h(
      'div',
      { class: 'g-waldo-play' },
      h('div', { class: 'g-waldo-view' }),
      h(
        'div',
        { class: 'g-waldo-hud' },
        h('div', { class: 'g-waldo-pill g-waldo-hud-left' }),
        h('div', { class: 'g-waldo-hud-right' }, h('div', { class: 'g-waldo-pill g-waldo-hud-time' }), h('button', { class: 'g-waldo-hintbtn', 'aria-label': t('hintBuyTitle'), onclick: useHint }, h('span', { class: 'g-waldo-hint-ico', html: icon('search') }), h('b', { class: 'g-waldo-hint-count' }, String(getHints())))),
      ),
      h('div', { class: 'g-waldo-cap' }),
      h(
        'div',
        { class: 'g-waldo-tray' },
        h('div', { class: 'g-waldo-tray-art' }, portraitCanvas(64, 'stand', ['#3b2a0c', '#101014'])),
        h('div', { class: 'g-waldo-tray-text' }, h('b', { class: 'g-waldo-tray-title' }, t('findTitle')), h('span', { class: 'g-waldo-tray-sub' })),
        h('div', { class: 'g-waldo-tray-side' }),
      ),
      h('div', { class: 'g-waldo-loading' }, h('div', { class: 'spinner' }), h('div', { class: 'muted' }, t('loading'))),
      h('div', { class: 'g-waldo-result' }),
    );
    root.append(playEl);
    const view_ = playEl.querySelector('.g-waldo-view');
    viewer = createViewer(view_, { onTap: handleTap });
  }

  function endPlay() {
    sceneToken++;
    if (sess) {
      sess.done = true;
      sess.paused = true;
      releaseScene(sess.scene);
    }
    sess = null;
    if (pre) {
      releaseScene(pre.scene);
      pre = null;
    }
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
    if (playEl) {
      playEl.remove();
      playEl = null;
    }
  }

  function releaseScene(scene) {
    if (!scene || !scene.canvas) return;
    scene.canvas.width = 0;
    scene.canvas.height = 0;
  }

  function setLoading(on) {
    if (!playEl) return;
    playEl.querySelector('.g-waldo-loading').classList.toggle('show', on);
  }

  function buildPlan(plan) {
    let attempt = 0;
    for (;;) {
      try {
        return buildScene(plan.theme, plan.seed + attempt * 7919, plan.lvl);
      } catch (e) {
        if (++attempt > 3) throw e;
      }
    }
  }

  function prebuild(plan) {
    if (!alive || (pre && pre.key === plan.key)) return;
    later(() => {
      if (!alive || (pre && pre.key === plan.key)) return;
      if (pre) releaseScene(pre.scene);
      pre = null;
      try {
        pre = { key: plan.key, scene: buildPlan(plan) };
      } catch (e) {
        console.error(e);
      }
    }, 250);
  }

  async function startScene(plan) {
    if (!sess || !viewer) return;
    const token = ++sceneToken;
    sess.plan = plan;
    sess.busy = true;
    hideCard();
    setLoading(true);
    let scene = null;
    if (pre && pre.key === plan.key) {
      scene = pre.scene;
      pre = null;
    } else {
      await new Promise((r) => requestAnimationFrame(() => later(r, 30)));
      if (token !== sceneToken || !sess) return;
      scene = buildPlan(plan);
    }
    if (token !== sceneToken || !sess) {
      releaseScene(scene);
      return;
    }
    const old = sess.scene;
    sess.scene = scene;
    viewer.setScene(scene);
    releaseScene(old);
    setLoading(false);
    sess.clock = makeClock();
    sess.penalty = 0;
    sess.found = false;
    sess.busy = false;
    sess.tipIdx = 0;
    sess.nextTip = TIP_EVERY;
    sess.locked = false;
    setTray(false);
    updateHud();
  }

  function setTray(found) {
    if (!playEl) return;
    const sub = playEl.querySelector('.g-waldo-tray-sub');
    const side = playEl.querySelector('.g-waldo-tray-side');
    if (!sess) return;
    if (!found) {
      sub.textContent = t(THEME_KEY[sess.scene.theme] || 'themeBeach');
      sub.className = 'g-waldo-tray-sub';
      clear(side);
    }
  }

  function showTip(i) {
    if (!playEl || !sess) return;
    const sub = playEl.querySelector('.g-waldo-tray-sub');
    sub.textContent = t(['tip1', 'tip2', 'tip3'][i % 3]);
    sub.className = 'g-waldo-tray-sub tip';
  }

  function flashCaption(text) {
    const el = playEl && playEl.querySelector('.g-waldo-cap');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function floatAt(x, y, text, cls) {
    if (!playEl) return;
    const el = h('div', { class: `g-waldo-float ${cls}`, style: { left: `${x}px`, top: `${y}px` } }, text);
    playEl.append(el);
    later(() => el.remove(), 900);
  }

  function updateHud() {
    if (!playEl || !sess || !sess.scene) return;
    const left = playEl.querySelector('.g-waldo-hud-left');
    const time = playEl.querySelector('.g-waldo-hud-time');
    const count = playEl.querySelector('.g-waldo-hint-count');
    count.textContent = String(getHints());
    if (sess.kind === 'classic') {
      const c = getClassic();
      left.textContent = t('sceneLabel', { n: c.run + 1, total: CHAPTER_SCENES });
      time.textContent = mmss(sess.clock.elapsed() + sess.penalty);
    } else if (sess.kind === 'timed') {
      left.textContent = t('timedLabel', { t: mmss(sess.left) });
      time.textContent = t('timedScore', { n: sess.score });
    } else {
      left.textContent = sess.practice ? t('practice') : t('modeDaily');
      time.textContent = mmss(sess.clock.elapsed() + sess.penalty);
    }
  }

  function tick() {
    if (!sess || sess.done || sess.paused || !playEl) return;
    if (!sess.found && sess.scene) {
      const e = sess.clock.elapsed();
      if (e >= sess.nextTip) {
        showTip(sess.tipIdx);
        sess.tipIdx++;
        sess.nextTip += TIP_EVERY;
      }
    }
    if (sess.kind === 'timed') {
      sess.left = TIMED_SECONDS + sess.bonus - sess.gameClock.elapsed() - sess.lost;
      if (sess.left <= 0 && !sess.ended) {
        sess.left = 0;
        endTimed();
      }
    }
    updateHud();
  }

  // ---------- taps ----------
  function handleTap(x, y) {
    if (!sess || sess.done || sess.paused || sess.busy || sess.locked || !sess.scene) return;
    const tg = sess.scene.target;
    const c = viewer.targetCss(tg);
    const r = Math.max(26, viewer.targetRadius(tg) * 1.3);
    if (Math.hypot(x - c.x, y - c.y) <= r) {
      found();
    } else {
      wrongTap(x, y);
    }
  }

  function wrongTap(x, y) {
    sess.locked = true;
    later(() => {
      if (sess) sess.locked = false;
    }, 650);
    viewer.addCross(x, y);
    floatAt(x, y - 26, t('wrongTap'), 'bad');
    ctx.sfx.play('error');
    ctx.sfx.vibrate(40);
    sess.penalty += WRONG_PENALTY;
    if (sess.kind === 'timed') sess.lost += WRONG_PENALTY;
    if (sess.kind === 'timed') floatAt(x, y + 10, t('penalty', { n: WRONG_PENALTY }), 'bad');
    updateHud();
  }

  function found() {
    sess.found = true;
    sess.busy = true;
    const tg = sess.scene.target;
    viewer.addFound(tg);
    ctx.sfx.play('success');
    ctx.sfx.vibrate([20, 40, 20]);
    ctx.ui.confetti(36);
    const sub = playEl.querySelector('.g-waldo-tray-sub');
    sub.textContent = t('foundCap');
    sub.className = 'g-waldo-tray-sub found';
    flashCaption(`${t('foundCap')} ${t(sess.scene.caption)}`);
    if (sess.kind === 'classic') onFoundClassic();
    else if (sess.kind === 'timed') onFoundTimed();
    else onFoundDaily();
  }

  // ---------- classic ----------
  function startClassic() {
    hideMenu();
    endPlay();
    const c = getClassic();
    playView();
    sess = newSession('classic', classicPlan(c.idx));
    startScene(sess.plan);
  }

  function onFoundClassic() {
    const secs = sess.clock.elapsed() + sess.penalty;
    const stars = starsFor(secs, sess.plan.lvl);
    const c = getClassic();
    const runStars = c.runStars + stars;
    const finishedChapter = c.run + 1 >= CHAPTER_SCENES;
    c.idx += 1;
    c.run += 1;
    c.runStars = runStars;
    c.stars += stars;
    c.scenes += 1;
    const coins = 5 + stars * 3;
    addCoins(coins);
    let chapterSummary = null;
    if (finishedChapter) {
      c.chapters += 1;
      chapterSummary = runStars;
      c.run = 0;
      c.runStars = 0;
    }
    store.set('classic', c);
    ctx.addXP?.(10 + stars * 5);
    pauseSess();
    sess.done = true;
    later(() => {
      if (!sess) return;
      if (finishedChapter) {
        showCard({
          title: t('chapterDone'),
          stars: null,
          lines: [t('chapterSummary', { n: chapterSummary }), t('timeLine', { s: secs.toFixed(1) })],
          actions: [
            { label: t('newChapter'), primary: true, onClick: () => startClassic() },
            { label: t('menu'), onClick: () => goMenu() },
          ],
        });
      } else {
        showCard({
          title: t('sceneDone'),
          stars,
          lines: [t('starsOf', { n: stars }), t('timeLine', { s: secs.toFixed(1) }), t('coinsGained', { n: coins })],
          actions: [
            { label: t('nextScene'), primary: true, onClick: () => startClassic() },
            { label: t('menu'), onClick: () => goMenu() },
          ],
        });
      }
      updateHud();
    }, 1400);
    prebuild(classicPlan(c.idx));
  }

  // ---------- timed ----------
  function startTimed() {
    hideMenu();
    endPlay();
    playView();
    const seedSession = { seed: (Math.random() * 1e9) | 0, offset: (Math.random() * 11) | 0 };
    sess = newSession('timed', timedPlan(seedSession, 0));
    sess.ts = seedSession;
    sess.k = 0;
    sess.found = 0;
    sess.score = 0;
    sess.bonus = 0;
    sess.lost = 0;
    sess.left = TIMED_SECONDS;
    sess.gameClock = makeClock();
    startScene(sess.plan);
  }

  function onFoundTimed() {
    const secs = sess.clock.elapsed();
    const add = 100 + Math.max(0, 20 - secs) * 6;
    sess.score += Math.round(add);
    sess.found += 1;
    sess.bonus += TIMED_BONUS;
    addCoins(2);
    ctx.addXP?.(6);
    floatAt(playEl.clientWidth - 72, 74, t('bonus', { n: TIMED_BONUS }), 'good');
    sess.k += 1;
    const next = timedPlan(sess.ts, sess.k);
    prebuild(next);
    later(() => {
      if (sess && sess.kind === 'timed' && !sess.ended) startScene(next);
    }, 1100);
  }

  function endTimed() {
    sess.ended = true;
    sess.done = true;
    pauseSess();
    const best = getTimedBest();
    const isBest = sess.score > best.score;
    if (isBest) store.set('timedBest', { score: sess.score, scenes: sess.found });
    showCard({
      title: t('timeUp'),
      lines: [t('timedSummary', { n: sess.found }), t('timedScore', { n: sess.score }), isBest ? t('newBest') : null],
      actions: [
        { label: t('playAgain'), primary: true, onClick: () => startTimed() },
        { label: t('menu'), onClick: () => goMenu() },
      ],
    });
    updateHud();
  }

  // ---------- daily ----------
  function startDaily(practice) {
    hideMenu();
    endPlay();
    const key = dateKey();
    const d = getDaily();
    if (!practice && d.days[key] !== undefined) {
      // Already played today: show the result (practice replays are not scored).
      playView();
      sess = newSession('daily', dailyPlan(key));
      sess.done = true;
      showCard({
        title: t('dailyDone'),
        lines: [t('timeLine', { s: Number(d.days[key]).toFixed(1) }), t('dailyStreakLine', { n: d.streak }), t('dailyAlready'), t('dailyTomorrow')],
        actions: [
          { label: t('practice'), onClick: () => startDaily(true) },
          { label: t('menu'), primary: true, onClick: () => goMenu() },
        ],
      });
      return;
    }
    playView();
    sess = newSession('daily', dailyPlan(key));
    sess.practice = practice;
    startScene(sess.plan);
  }

  function onFoundDaily() {
    const secs = sess.clock.elapsed() + sess.penalty;
    const key = dateKey();
    let streakN = 0;
    if (!sess.practice) {
      const d = getDaily();
      streakN = d.last === yesterdayKey() ? d.streak + 1 : 1;
      d.days[key] = Math.round(secs * 10) / 10;
      const keys = Object.keys(d.days).sort().slice(-60);
      const kept = {};
      for (const k of keys) kept[k] = d.days[k];
      d.days = kept;
      d.last = key;
      d.streak = streakN;
      d.best = d.best === null || secs < d.best ? Math.round(secs * 10) / 10 : d.best;
      store.set('daily', d);
      addCoins(DAILY_COINS);
      ctx.addXP?.(25);
    }
    pauseSess();
    sess.done = true;
    later(() => {
      if (!sess) return;
      showCard({
        title: t('dailyDone'),
        lines: [t('timeLine', { s: secs.toFixed(1) }), sess.practice ? null : t('dailyStreakLine', { n: streakN }), sess.practice ? null : t('coinsGained', { n: DAILY_COINS })],
        actions: [
          { label: t('menu'), primary: true, onClick: () => goMenu() },
        ],
      });
      updateHud();
    }, 1400);
  }

  // ---------- session ----------
  function newSession(kind, plan) {
    return {
      kind,
      plan,
      scene: null,
      clock: makeClock(),
      gameClock: null,
      penalty: 0,
      lost: 0,
      bonus: 0,
      locked: false,
      busy: false,
      found: false,
      done: false,
      paused: false,
      tipIdx: 0,
      nextTip: TIP_EVERY,
      practice: false,
    };
  }

  function goMenu() {
    if (!alive) return;
    endPlay();
    showMenu();
  }

  async function useHint() {
    if (!sess || sess.done || sess.busy || !sess.scene) return;
    if (getHints() <= 0) {
      const ok = await askModal({
        title: t('hintBuyTitle'),
        body: t('hintBuyText', { n: HINT_PRICE }),
        actions: [
          { label: t('buy'), value: true, primary: true },
          { label: t('cancel'), value: false },
        ],
      });
      if (!ok || !sess) return;
      if (getCoins() < HINT_PRICE) {
        ctx.ui.toast(t('noCoins'));
        return;
      }
      addCoins(-HINT_PRICE);
      store.set('hints', getHints() + 1);
    }
    store.set('hints', getHints() - 1);
    updateHud();
    viewer.focusTarget(sess.scene.target, 2.3, 800);
    viewer.addHint(sess.scene.target, 3.5);
    ctx.sfx.play('pop');
  }

  // ---------- leaving ----------
  ctx.onBack(() => {
    if (modalOpen) return true;
    if (view === 'play' && sess && !sess.done) {
      askModal({
        title: t('leaveTitle'),
        body: t('leaveText'),
        actions: [
          { label: t('keepPlaying'), value: false, primary: true },
          { label: t('leave'), value: true, danger: true },
        ],
      }).then((leave) => {
        if (leave && alive) goMenu();
      });
      return true;
    }
    if (view === 'play') {
      goMenu();
      return true;
    }
    return false;
  });

  const onVisibility = () => {
    if (document.hidden) pauseSess();
    else if (!modalOpen) resumeSess();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const ticker = setInterval(() => alive && tick(), 100);

  // ---------- start ----------
  if (entry === 'classic') startClassic();
  else if (entry === 'timed') startTimed();
  else if (entry === 'daily') startDaily(false);
  else showMenu();

  return () => {
    alive = false;
    clearInterval(ticker);
    document.removeEventListener('visibilitychange', onVisibility);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    endPlay();
    if (pre) releaseScene(pre.scene);
    pre = null;
    ctx.setHeaderRight(null);
  };
}
