// "Detetive dos Personagens" — find Ruivinho and his friends in giant hand-inked crowd
// pictures. Modes (lobby ids): classic (chapters of 5 scenes, stars for speed), timed
// (2 minutes, as many scenes as possible) and a daily scene with a streak.
// The pictures are rendered offline (see build/) and shipped as WebP + hit-data JSON.

import STRINGS from './strings.js';
import { icon } from './icons.js';
import { SceneView } from './engine/view.js';
import { loadScene, loadMeta, loadImage, keepOnly, spriteUrl, sceneThumbUrl } from './engine/assets.js';
import { SCENES, SCENE_KEY, TARGET_KEY, classicPlan, timedPlan, dailyPlan, resolveLevel, starsFor, dateKey, yesterdayKey, mmss, makeClock, CHAPTER_SCENES, HINT_PRICE, DAILY_COINS } from './engine/plan.js';

const TIMED_SECONDS = 120;
const TIMED_BONUS = 8;
const WRONG_PENALTY = 3;
const TIP_EVERY = 35;
const START_HINTS = 3;
const HINT_RADIUS = 250; // picture units
const HINT_MS = 4200;

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
  let sceneToken = 0;
  let modalOpen = false;
  let hintFx = null;
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

  const nameOf = (id) => t(`name${TARGET_KEY[id]}`);

  // ---------- small UI pieces ----------
  const coinPill = h('div', { class: 'g-waldo-pill g-waldo-coinpill' });
  const refreshCoins = () => {
    coinPill.innerHTML = icon('coin') + `<b>${getCoins()}</b>`;
  };
  const addCoins = (n) => {
    store.set('coins', Math.max(0, getCoins() + n));
    refreshCoins();
  };

  const spr = (name, cls = '', size = 0) => {
    const im = h('img', { class: `g-waldo-spr ${cls}`, src: spriteUrl(name), alt: '', draggable: 'false' });
    if (size) {
      im.style.width = `${size}px`;
      im.style.height = `${size}px`;
    }
    return im;
  };

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
    if (sess && !sess.done && !sess.intro && !document.hidden) resumeSess();
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
      h('div', { class: 'g-waldo-hero-art' }, spr('hero_big.webp', 'g-waldo-hero-img')),
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
    const modeCard = (ico, title, sub, right, onclick) =>
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
      modeCard('search', t('modeClassic'), t('modeClassicSub'), null, () => startClassic()),
      modeCard('clock', t('modeTimed'), t('modeTimedSub'), best.scenes ? t('best', { n: best.scenes }) : null, () => startTimed()),
      modeCard(
        'calendar',
        t('modeDaily'),
        t('modeDailySub'),
        doneToday ? h('span', { class: 'g-waldo-done', html: icon('check') }) : streakN ? h('span', { class: 'g-waldo-streak', html: icon('fire') }, streakN) : null,
        () => startDaily(false),
      ),
    );
    // the album of pictures: reached ones are in colour
    const reached = (i) => c.idx >= SCENES.length || c.idx >= i;
    const gallery = h(
      'section',
      { class: 'g-waldo-gallery' },
      h('h3', { class: 'section-title' }, t('scenesTitle')),
      h(
        'div',
        { class: 'g-waldo-thumbs' },
        SCENES.map((id, i) =>
          h(
            'div',
            { class: `g-waldo-thumb ${reached(i) ? '' : 'locked'}` },
            h('img', { src: sceneThumbUrl(id), alt: '', loading: 'lazy', draggable: 'false' }),
            h('span', null, t(SCENE_KEY[id])),
          ),
        ),
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
      gallery,
      h('button', { class: 'btn ghost block g-waldo-how', onclick: howToPlay }, h('span', { class: 'btn-ico', html: icon('book') }), t('howBtn')),
    );
    root.append(menuEl);
    requestAnimationFrame(() => menuEl && menuEl.classList.add('in'));
    // warm up the first picture of the run
    loadMeta(classicPlan(c.idx).scene).catch(() => {});
    loadImage(classicPlan(c.idx).scene).catch(() => {});
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
        h(
          'div',
          { class: 'g-waldo-hud-right' },
          h('div', { class: 'g-waldo-pill g-waldo-hud-time' }),
          h('button', { class: 'g-waldo-hintbtn', 'aria-label': t('hintBtn'), onclick: useHint }, h('span', { class: 'g-waldo-hint-ico', html: icon('search') }), h('b', { class: 'g-waldo-hint-count' }, String(getHints()))),
        ),
      ),
      h('div', { class: 'g-waldo-cap' }),
      h('button', { class: 'g-waldo-tray', onclick: () => showWanted(false), 'aria-label': t('wantedBtn') }),
      h('div', { class: 'g-waldo-wanted' }),
      h('div', { class: 'g-waldo-loading' }, h('div', { class: 'spinner' }), h('div', { class: 'muted g-waldo-loading-txt' }, t('loading')), h('button', { class: 'btn small g-waldo-retry', onclick: () => sess && startScene(sess.plan) }, t('retryLoad'))),
      h('div', { class: 'g-waldo-result' }),
    );
    root.append(playEl);
    viewer = new SceneView(playEl.querySelector('.g-waldo-view'), { onTap: handleTap, onMiss: handleMiss });
  }

  function endPlay() {
    sceneToken++;
    hintFx = null;
    if (sess) {
      sess.done = true;
      sess.paused = true;
    }
    sess = null;
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
    if (playEl) {
      playEl.remove();
      playEl = null;
    }
  }

  function setLoading(on, error = false) {
    if (!playEl) return;
    const el = playEl.querySelector('.g-waldo-loading');
    el.classList.toggle('show', on);
    el.classList.toggle('error', on && error);
    el.querySelector('.g-waldo-loading-txt').textContent = error ? t('loadError') : t('loading');
  }

  // Wanted tray (bottom): one chip per thing to find.
  function renderTray() {
    if (!playEl || !sess || !sess.targets) return;
    const tray = playEl.querySelector('.g-waldo-tray');
    clear(tray);
    sess.targets.forEach((tg) => {
      tray.append(h('span', { class: `g-waldo-chip ${tg.found ? 'found' : ''}` }, spr(`${tg.id}_t.webp`, 'g-waldo-chip-img'), h('i', { class: 'g-waldo-chip-ck', html: icon('check') })));
    });
    const left = sess.targets.filter((x) => !x.found).length;
    tray.append(h('span', { class: 'g-waldo-tray-n' }, t('leftN', { a: sess.targets.length - left, n: sess.targets.length })));
  }

  // The big "wanted" card: who to find. `first` = it is the level intro (clock waits for Start).
  function showWanted(first) {
    if (!playEl || !sess || !sess.targets || sess.done) return;
    if (!first) {
      if (sess.intro || modalOpen) return;
      pauseSess();
    }
    sess.wantedOpen = true;
    const box = playEl.querySelector('.g-waldo-wanted');
    clear(box);
    const n = sess.targets.length;
    box.append(
      h(
        'div',
        { class: 'g-waldo-poster pop-in' },
        h('div', { class: 'g-waldo-poster-top' }, h('span', { class: 'g-waldo-poster-star', html: icon('star') }), h('h2', null, t('wantedTitle')), h('span', { class: 'g-waldo-poster-star', html: icon('star') })),
        h('p', { class: 'g-waldo-poster-sub' }, t('wantedSub', { n }) + ' · ' + t(SCENE_KEY[sess.plan.scene])),
        h(
          'div',
          { class: `g-waldo-cards n${n}` },
          sess.targets.map((tg) =>
            h(
              'div',
              { class: `g-waldo-wcard ${tg.found ? 'found' : ''}` },
              h('div', { class: 'g-waldo-wcard-art' }, spr(`${tg.id}.webp`, 'g-waldo-wcard-img'), tg.found ? h('i', { class: 'g-waldo-wcard-ck', html: icon('check') }) : null),
              h('b', null, nameOf(tg.id)),
              h('small', null, t(`desc${TARGET_KEY[tg.id]}`)),
            ),
          ),
        ),
        h('button', { class: 'btn primary big block', onclick: () => closeWanted(first) }, first ? t('startBtn') : t('keepPlaying')),
      ),
    );
    box.classList.add('show');
  }

  function closeWanted(first) {
    if (!playEl) return;
    const box = playEl.querySelector('.g-waldo-wanted');
    box.classList.remove('show');
    clear(box);
    if (!sess) return;
    sess.wantedOpen = false;
    if (first && sess.intro) {
      sess.intro = false;
      sess.clock = makeClock();
      if (sess.gameClock) sess.gameClock.resume();
      sess.paused = false;
      sess.nextTip = TIP_EVERY;
    } else if (!sess.done && !modalOpen) resumeSess();
    if (viewer) viewer.request();
  }

  function flashCaption(text, ms = 2600) {
    const el = playEl && playEl.querySelector('.g-waldo-cap');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.style.animationDuration = `${ms}ms`;
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
    const el = sess.clock.elapsed() + sess.penalty;
    if (sess.kind === 'classic') {
      const c = getClassic();
      left.textContent = t('sceneLabel', { n: c.run + 1, total: CHAPTER_SCENES });
      time.textContent = sess.limit ? t('limitLabel', { t: mmss(Math.max(0, sess.limit - el)) }) : mmss(el);
      time.classList.toggle('warn', !!sess.limit && sess.limit - el < 20);
    } else if (sess.kind === 'timed') {
      left.textContent = t('timedLabel', { t: mmss(sess.left) });
      time.textContent = t('timedScore', { n: sess.score });
    } else {
      left.textContent = sess.practice ? t('practice') : t('modeDaily');
      time.textContent = mmss(el);
    }
  }

  function tick() {
    if (!sess || sess.done || sess.paused || !playEl) return;
    if (sess.scene && !sess.intro) {
      const e = sess.clock.elapsed();
      if (e >= sess.nextTip) {
        const left = sess.targets.filter((x) => !x.found);
        if (left.length) flashCaption(t('tipLine', { t: t(`tip${TARGET_KEY[left[sess.tipIdx % left.length].id]}`) }), 4200);
        sess.tipIdx++;
        sess.nextTip += TIP_EVERY;
      }
      if (sess.kind === 'classic' && sess.limit && e + sess.penalty >= sess.limit && !sess.ended) onTimeOut();
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

  // ---------- scenes ----------
  async function startScene(plan, { intro = true } = {}) {
    if (!sess || !viewer) return;
    const token = ++sceneToken;
    sess.plan = plan;
    sess.busy = true;
    sess.scene = null;
    sess.targets = null;
    hideCard();
    setLoading(true);
    let data;
    try {
      data = await loadScene(plan.scene);
    } catch (e) {
      console.error(e);
      if (token === sceneToken && playEl) setLoading(true, true);
      return;
    }
    if (token !== sceneToken || !sess || !viewer) return;
    const { meta, img } = data;
    const lvl = resolveLevel(plan, meta);
    const mirror = plan.lap % 2 === 1;
    const W = meta.w, H = meta.h;
    const flipBB = (b) => (mirror ? [W - b[2], b[1], W - b[0], b[3]] : b.slice());
    const targets = lvl.ids.map((id) => ({ id, bb: flipBB(meta.targets[id].bb), found: false }));
    const rg = lvl.region;
    const region = { x: mirror ? W - (rg.x + rg.w) : rg.x, y: rg.y, w: rg.w, h: rg.h };
    const scene = { W, H, img, mirror, region, marks: [] };
    sess.scene = scene;
    sess.targets = targets;
    sess.par = lvl.par;
    sess.limit = sess.kind === 'classic' ? lvl.limit : 0;
    sess.penalty = 0;
    sess.locked = false;
    sess.tipIdx = 0;
    sess.nextTip = TIP_EVERY;
    sess.ended = false;
    sess.foundCount = 0;
    viewer.setScene(scene);
    if (typeof window.__waldoDebug === 'function') window.__waldoDebug(() => ({ viewer, sess })); // test hook
    setLoading(false);
    renderTray();
    // keep only this picture and the next one in memory
    keepOnly([plan.scene, sess.nextScene || plan.scene]);
    sess.busy = false;
    const showIntro = intro && sess.kind !== 'timed' ? true : intro && sess.first;
    if (showIntro) {
      // the clock waits behind the Wanted card
      sess.intro = true;
      sess.paused = true;
      sess.clock = makeClock();
      sess.clock.pause();
      if (sess.gameClock) sess.gameClock.pause();
      later(() => showWanted(true), 60);
    } else {
      sess.intro = false;
      sess.clock = makeClock();
      sess.paused = false;
      if (sess.gameClock) sess.gameClock.resume();
      flashCaption(sess.targets.map((x) => nameOf(x.id)).join(' · '), 3000);
    }
    sess.first = false;
    updateHud();
  }

  // ---------- taps ----------
  function handleTap(wx, wy) {
    if (!sess || sess.done || sess.paused || sess.busy || sess.locked || !sess.scene || sess.intro) return false;
    const z = viewer.z;
    for (const tg of sess.targets) {
      const [x0, y0, x1, y1] = tg.bb;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const hw = Math.max((x1 - x0) / 2 + 5 / z, 20 / z), hh = Math.max((y1 - y0) / 2 + 5 / z, 20 / z);
      if (Math.abs(wx - cx) <= hw && Math.abs(wy - cy) <= hh) {
        if (tg.found) return true; // already found: nothing happens
        onTargetFound(tg);
        return true;
      }
    }
    return false;
  }

  function handleMiss(wx, wy, sx, sy) {
    if (!sess || sess.done || sess.paused || sess.busy || sess.locked || !sess.scene || sess.intro) return;
    wrongTap(wx, wy, sx, sy);
  }

  function wrongTap(wx, wy, sx, sy) {
    sess.locked = true;
    later(() => {
      if (sess) sess.locked = false;
    }, 500);
    viewer.addEffect({
      dur: 650,
      draw(g, k, v) {
        const p = v.worldToScreen(wx, wy);
        const a = 1 - k;
        const s = 13 + k * 3;
        g.globalAlpha = a;
        g.lineCap = 'round';
        g.lineWidth = 7;
        g.strokeStyle = '#220509';
        g.beginPath();
        g.moveTo(p.x - s, p.y - s);
        g.lineTo(p.x + s, p.y + s);
        g.moveTo(p.x + s, p.y - s);
        g.lineTo(p.x - s, p.y + s);
        g.stroke();
        g.lineWidth = 4;
        g.strokeStyle = '#ff4d5e';
        g.stroke();
      },
    });
    const left = sess.targets.filter((x) => !x.found);
    floatAt(sx, sy - 28, left.length === 1 && left[0].id !== 'hero' ? t('wrongTapItem') : t('wrongTap'), 'bad');
    ctx.sfx.play('error');
    ctx.sfx.vibrate(40);
    sess.penalty += WRONG_PENALTY;
    if (sess.kind === 'timed') {
      sess.lost += WRONG_PENALTY;
      floatAt(sx, sy + 8, t('penalty', { n: WRONG_PENALTY }), 'bad');
    }
    updateHud();
  }
  const now = () => performance.now();

  function onTargetFound(tg) {
    tg.found = true;
    sess.foundCount++;
    const [x0, y0, x1, y1] = tg.bb;
    sess.scene.marks.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: Math.max(26, (x1 - x0) / 2 + 12), ry: Math.max(26, (y1 - y0) / 2 + 10), t0: now() });
    viewer.request();
    renderTray();
    ctx.sfx.play('success');
    ctx.sfx.vibrate([20, 40, 20]);
    const all = sess.targets.every((x) => x.found);
    const p = viewer.worldToScreen((x0 + x1) / 2, (y0 + y1) / 2);
    if (!all) {
      flashCaption(t('foundName', { name: nameOf(tg.id) }), 1800);
      return;
    }
    // everything found
    sess.busy = true;
    ctx.ui.confetti(40);
    flashCaption(t('allFound'), 2000);
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
    sess.nextScene = classicPlan(c.idx + 1).scene;
    startScene(sess.plan);
  }

  function onFoundClassic() {
    const secs = sess.clock.elapsed() + sess.penalty;
    const n = sess.targets.length;
    const stars = starsFor(secs, sess.par);
    const c = getClassic();
    const runStars = c.runStars + stars;
    const finishedChapter = c.run + 1 >= CHAPTER_SCENES;
    c.idx += 1;
    c.run += 1;
    c.runStars = runStars;
    c.stars += stars;
    c.scenes += 1;
    const coins = 3 + n * 2 + stars * 3;
    addCoins(coins);
    let chapterSummary = null;
    if (finishedChapter) {
      c.chapters += 1;
      chapterSummary = runStars;
      c.run = 0;
      c.runStars = 0;
    }
    store.set('classic', c);
    ctx.addXP?.(8 + n * 2 + stars * 5);
    pauseSess();
    sess.done = true;
    // prepare the next picture while the result is shown
    const next = classicPlan(c.idx);
    loadMeta(next.scene).catch(() => {});
    loadImage(next.scene).catch(() => {});
    later(() => {
      if (!sess) return;
      if (finishedChapter) {
        showCard({
          title: t('chapterDone'),
          stars: null,
          lines: [t('chapterSummary', { n: chapterSummary }), t('timeLine', { s: secs.toFixed(1) }), t('coinsGained', { n: coins })],
          actions: [
            { label: t('newChapter'), primary: true, onClick: () => startClassic() },
            { label: t('menu'), onClick: () => goMenu() },
          ],
        });
      } else {
        showCard({
          title: t('sceneDone'),
          stars,
          lines: [t('foundLine', { n }), t('timeLine', { s: secs.toFixed(1) }), t('coinsGained', { n: coins })],
          actions: [
            { label: t('nextScene'), primary: true, onClick: () => startClassic() },
            { label: t('menu'), onClick: () => goMenu() },
          ],
        });
      }
      updateHud();
    }, 1500);
  }

  function onTimeOut() {
    sess.ended = true;
    sess.done = true;
    pauseSess();
    ctx.sfx.play('lose');
    later(() => {
      if (!sess) return;
      showCard({
        title: t('timeOutTitle'),
        lines: [t('timeOutText'), t('foundLine', { n: sess.foundCount })],
        actions: [
          { label: t('retry'), primary: true, onClick: () => startClassic() },
          { label: t('menu'), onClick: () => goMenu() },
        ],
      });
    }, 500);
  }

  // ---------- timed ----------
  function startTimed() {
    hideMenu();
    endPlay();
    playView();
    const seedSession = { seed: (Math.random() * 1e9) | 0, offset: (Math.random() * SCENES.length) | 0 };
    sess = newSession('timed', timedPlan(seedSession, 0));
    sess.ts = seedSession;
    sess.k = 0;
    sess.first = true;
    sess.found = 0;
    sess.score = 0;
    sess.bonus = 0;
    sess.lost = 0;
    sess.left = TIMED_SECONDS;
    sess.gameClock = makeClock();
    sess.nextScene = timedPlan(seedSession, 1).scene;
    startScene(sess.plan);
  }

  function onFoundTimed() {
    const secs = sess.clock.elapsed();
    const add = 100 * sess.targets.length + Math.max(0, 30 - secs) * 6;
    sess.score += Math.round(add);
    sess.found += 1;
    sess.bonus += TIMED_BONUS;
    addCoins(2);
    ctx.addXP?.(6);
    floatAt(playEl.clientWidth - 72, 74, t('bonus', { n: TIMED_BONUS }), 'good');
    sess.k += 1;
    const next = timedPlan(sess.ts, sess.k);
    sess.nextScene = timedPlan(sess.ts, sess.k + 1).scene;
    loadMeta(next.scene).catch(() => {});
    loadImage(next.scene).catch(() => {});
    later(() => {
      if (sess && sess.kind === 'timed' && !sess.ended) startScene(next, { intro: false });
    }, 1000);
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
    sess.nextScene = sess.plan.scene;
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
        title: sess.practice ? t('sceneDone') : t('dailyDone'),
        lines: [t('timeLine', { s: secs.toFixed(1) }), sess.practice ? null : t('dailyStreakLine', { n: streakN }), sess.practice ? null : t('coinsGained', { n: DAILY_COINS })],
        actions: [{ label: t('menu'), primary: true, onClick: () => goMenu() }],
      });
      updateHud();
    }, 1500);
  }

  // ---------- session ----------
  function newSession(kind, plan) {
    return {
      kind,
      plan,
      scene: null,
      targets: null,
      clock: makeClock(),
      gameClock: null,
      penalty: 0,
      lost: 0,
      bonus: 0,
      limit: 0,
      par: 30,
      locked: false,
      busy: false,
      intro: false,
      wantedOpen: false,
      done: false,
      paused: false,
      tipIdx: 0,
      nextTip: TIP_EVERY,
      practice: false,
      first: false,
    };
  }

  function goMenu() {
    if (!alive) return;
    endPlay();
    showMenu();
  }

  // ---------- the magnifier hint ----------
  async function useHint() {
    if (!sess || sess.done || sess.busy || sess.intro || !sess.scene || hintFx) return;
    const left = sess.targets.filter((x) => !x.found);
    if (!left.length) return;
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
    const tg = left[0];
    const [x0, y0, x1, y1] = tg.bb;
    const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
    // the spotlight is off-centre so the player still has to look
    const a = Math.random() * Math.PI * 2;
    const R = HINT_RADIUS;
    const cx = tx + Math.cos(a) * R * 0.38, cy = ty + Math.sin(a) * R * 0.38;
    const zt = Math.min(viewer.maxZ, Math.max(viewer.minZ, (Math.min(viewer.w, viewer.h) * 0.46) / R));
    viewer.flyTo(cx, cy, Math.max(viewer.z, Math.min(zt, viewer.z * 3)), 700);
    ctx.sfx.play('pop');
    hintFx = viewer.addEffect({
      dur: HINT_MS,
      draw(g, k, v, el) {
        const p = v.worldToScreen(cx, cy);
        const r = R * v.z;
        const fade = k < 0.08 ? k / 0.08 : k > 0.82 ? (1 - k) / 0.18 : 1;
        const pulse = 1 + Math.sin(el / 160) * 0.025;
        const rr = r * pulse;
        // darken everything outside the lens
        g.save();
        g.globalAlpha = 0.62 * fade;
        g.fillStyle = '#04040a';
        g.beginPath();
        g.rect(0, 0, v.w, v.h);
        g.arc(p.x, p.y, rr, 0, Math.PI * 2, true);
        g.fill('evenodd');
        g.restore();
        g.globalAlpha = fade;
        // gold lens rim and handle
        g.lineCap = 'round';
        g.lineWidth = 9;
        g.strokeStyle = '#6b4308';
        g.beginPath();
        g.arc(p.x, p.y, rr, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 6;
        g.strokeStyle = '#f7d774';
        g.stroke();
        const hx = p.x + Math.cos(Math.PI * 0.27) * rr, hy = p.y + Math.sin(Math.PI * 0.27) * rr;
        g.lineWidth = 17;
        g.strokeStyle = '#3b2604';
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(hx + rr * 0.55, hy + rr * 0.55);
        g.stroke();
        g.lineWidth = 12;
        g.strokeStyle = '#c9971c';
        g.stroke();
        g.globalAlpha = 1;
      },
      onEnd() {
        hintFx = null;
      },
    });
  }

  // ---------- leaving ----------
  ctx.onBack(() => {
    if (modalOpen) return true;
    if (view === 'play' && sess && sess.wantedOpen && !sess.intro) {
      closeWanted(false);
      return true;
    }
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
    else if (!modalOpen && sess && !sess.intro && !sess.wantedOpen) resumeSess();
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
    keepOnly([]);
    ctx.setHeaderRight(null);
  };
}
