// Word search ("Caça-Palavras") — swipe across the letters to find themed words.
// Endless numbered levels grouped in theme-pack chapters, a daily challenge and
// a 2-minute time attack. Puzzles are generated deterministically (engine.js).
//
// Modes (ctx.mode): undefined / 'levels' → straight into the current level
// (the level map is one tap away in the HUD), 'daily' → today's puzzle,
// 'timed' → time attack.

import STRINGS from './strings.js';
import * as E from './engine.js';
import { PACKS, THEMES } from './themes.js';
import { createBoard, CAP_COLORS } from './board.js';
import { DEFS, icon } from './icons.js';

const PRICES = { letter: 25, spot: 15, reveal: 50 };
const START_COINS = 150;
const BONUS_COINS = 5;
const CHAPTER_COINS = 50;
const TIMED_MS = 120000;
const TIMED_BONUS_S = 10;
const TIMED_HINT_S = 10;

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h, clear, toast } = ctx.ui;
  const sfx = ctx.sfx;
  const store = ctx.store;
  const lang = ['pt', 'en', 'es'].includes(ctx.lang) ? ctx.lang : 'pt';
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR';
  const nm = (o) => (o ? (o[lang] !== undefined ? o[lang] : o.en) : '');
  const fmt = (n) => Number(n).toLocaleString(locale);
  const ico = (name, cls = '') => h('span', { class: `g-wordsearch-ico ${cls}`, html: icon(name) });

  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const LISTS = (await import(`./words-${lang}.js`)).default;

  // ------------------------------------------------------------ lifecycle helpers
  let dead = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const rafs = new Set();
  const raf = (fn) => {
    const id = requestAnimationFrame((ts) => {
      rafs.delete(id);
      if (!dead) fn(ts);
    });
    rafs.add(id);
    return id;
  };
  const docListeners = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    docListeners.push([target, type, fn, opts]);
  };

  // ------------------------------------------------------------ save data
  const S = {
    level: Math.max(1, store.get('level', 1) | 0),
    coins: Math.max(0, store.get('coins', START_COINS) | 0),
    stars: store.get('stars', {}) || {},
    daily: { last: null, streak: 0, best: 0, history: [], ...(store.get('daily', null) || {}) },
    tbest: Math.max(0, store.get('tbest', 0) | 0),
    tut: !!store.get('tut', false),
    tipTarget: !!store.get('tipTarget', false),
    stats: { words: 0, bonus: 0, levels: 0, ...(store.get('stats', null) || {}) },
  };
  const save = (...keys) => keys.forEach((k) => store.set(k, S[k]));

  // ------------------------------------------------------------ shell
  const defs = h('div', { class: 'g-wordsearch-defs', html: DEFS });
  const app = h('div', { class: 'g-wordsearch-app' });
  root.append(defs, app);

  const coinNum = h('b', null, fmt(S.coins));
  const coinPill = h('div', { class: 'g-wordsearch-coins' }, ico('coin'), coinNum);
  let shownCoins = S.coins;
  function showCoins(v = S.coins) {
    shownCoins = v;
    coinNum.textContent = fmt(v);
    coinPill.classList.remove('bump');
    void coinPill.offsetWidth;
    coinPill.classList.add('bump');
  }
  // Header pill counts up to the saved balance (after coins fly in).
  function animateCoins(delay = 0) {
    later(() => {
      const from = shownCoins;
      shownCoins = S.coins;
      countUp(coinNum, from, S.coins, 700);
    }, delay);
  }
  function addCoins(n) {
    S.coins = Math.max(0, S.coins + n);
    save('coins');
  }

  let view = null; // { name, cleanup, el }
  function setView(name, el, cleanup) {
    if (view && view.cleanup) {
      try {
        view.cleanup();
      } catch (e) {
        console.error(e);
      }
    }
    clear(app);
    app.append(el);
    view = { name, el, cleanup };
  }

  // Count-up animation for numbers.
  function countUp(el, from, to, ms, onTick, prefix = '') {
    const t0 = performance.now();
    let last = from;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = prefix + fmt(v);
      if (v !== last && onTick) onTick(v);
      last = v;
      if (k < 1) raf(step);
    };
    raf(step);
  }

  // Coins flying from a point to the header pill.
  function flyCoins(fromEl, count = 6) {
    const a = fromEl.getBoundingClientRect();
    const b = coinPill.getBoundingClientRect();
    if (!b.width) return;
    for (let i = 0; i < count; i++) {
      const c = h('div', { class: 'g-wordsearch-flycoin', html: icon('coin') });
      c.style.left = `${a.left + a.width / 2 - 11}px`;
      c.style.top = `${a.top + a.height / 2 - 11}px`;
      document.body.append(c);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const jx = (Math.random() - 0.5) * 70;
      const jy = (Math.random() - 0.5) * 50;
      const anim = c.animate(
        [
          { transform: 'translate(0,0) scale(.6)', opacity: 0 },
          { transform: `translate(${jx}px, ${jy - 30}px) scale(1.1)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0.9 },
        ],
        { duration: 750 + i * 70, easing: 'cubic-bezier(.5,0,.6,1)', delay: i * 40 },
      );
      anim.onfinish = () => {
        c.remove();
        if (!dead) {
          coinPill.classList.remove('bump');
          void coinPill.offsetWidth;
          coinPill.classList.add('bump');
        }
      };
    }
  }

  function floatText(text, x, y, cls = '') {
    const ar = app.getBoundingClientRect();
    const el = h('div', { class: `g-wordsearch-float ${cls}`, style: { left: `${x - ar.left}px`, top: `${y - ar.top}px` } }, text);
    app.append(el);
    later(() => el.remove(), 1300);
  }

  function chime(k) {
    const scale = [523, 587, 659, 784, 880, 988, 1047, 1175, 1319, 1397, 1568, 1760, 1976];
    const f = scale[Math.min(k, scale.length - 1)];
    sfx.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.32 });
    sfx.tone({ freq: f * 1.5, dur: 0.2, type: 'sine', vol: 0.22, delay: 0.07 });
    sfx.tone({ freq: f * 2, dur: 0.22, type: 'sine', vol: 0.1, delay: 0.12 });
  }
  function missSound() {
    sfx.tone({ freq: 260, to: 170, dur: 0.16, type: 'sine', vol: 0.28 });
  }

  // ------------------------------------------------------------ in-game overlay
  let overlayEl = null;
  function openOverlay(cls, ...children) {
    closeOverlay(true);
    const card = h('div', { class: `g-wordsearch-card ${cls}` }, ...children);
    const ov = h('div', { class: 'g-wordsearch-overlay' }, card);
    app.append(ov);
    overlayEl = ov;
    raf(() => ov.classList.add('show'));
    return card;
  }
  function closeOverlay(instant = false) {
    if (!overlayEl) return;
    const ov = overlayEl;
    overlayEl = null;
    if (instant) ov.remove();
    else {
      ov.classList.remove('show');
      later(() => ov.remove(), 220);
    }
  }

  // ============================================================ play screen
  // Generic puzzle screen used by every mode.
  //   opts: { mode, puzzle, theme, subtitle, hudLeft, hudRight, tools, saved, onChange, onFound, onComplete, tutorial }
  function playScreen(opts) {
    const { puzzle, mode } = opts;
    const words = puzzle.words;
    const P = {
      found: [],
      hinted: new Set(),
      bonus: [],
      hints: 0,
      target: null,
      done: false,
      elapsed: 0,
      since: performance.now(),
    };
    if (opts.saved) {
      P.found = (opts.saved.found || []).filter((i) => i >= 0 && i < words.length);
      (opts.saved.hinted || []).forEach((i) => P.hinted.add(i));
      P.bonus = (opts.saved.bonus || []).filter((k) => puzzle.bonus.some((b) => b.key === k));
      P.hints = opts.saved.hints | 0;
      P.elapsed = opts.saved.ms || 0;
    }
    const elapsed = () => P.elapsed + (P.since ? performance.now() - P.since : 0);
    const snapshot = () => ({ found: P.found.slice(), hinted: [...P.hinted], bonus: P.bonus.slice(), hints: P.hints, ms: Math.round(elapsed()) });

    const el = h('div', { class: `g-wordsearch-play mode-${mode}` });

    // --- HUD: theme name above the grid
    const countTxt = h('b', null, '');
    const progress = h('span', { class: 'g-wordsearch-count' }, ico('check'), countTxt);
    const hud = h(
      'div',
      { class: 'g-wordsearch-hud' },
      h('div', { class: 'g-wordsearch-hud-side' }, opts.hudLeft || null),
      h(
        'div',
        { class: 'g-wordsearch-title' },
        h(
          'div',
          { class: `g-wordsearch-theme ${nm(opts.theme.name).length > 14 ? 'long' : ''}` },
          h('span', { class: 'g-wordsearch-emo' }, opts.theme.emoji),
          h('span', { class: 'g-wordsearch-theme-name' }, nm(opts.theme.name)),
        ),
        h('div', { class: 'g-wordsearch-sub' }, opts.subtitle || ''),
      ),
      h('div', { class: 'g-wordsearch-hud-side right' }, opts.hudRight || coinPill),
    );

    // --- board
    const board = createBoard({
      h,
      size: puzzle.size,
      grid: puzzle.grid,
      sfx,
      onCommit: commit,
      onStart: () => {
        if (tutorialOn) stopTutorial();
      },
    });
    const boardWrap = h('div', { class: 'g-wordsearch-boardwrap' }, board.el);

    // --- word list (cream paper)
    const items = words.map((w, i) =>
      h(
        'button',
        {
          class: 'g-wordsearch-word',
          'data-silent': '',
          onclick: () => setTarget(i),
        },
        h('span', { class: 'g-wordsearch-word-t' }, w.word),
      ),
    );
    const bonusChip = h('span', { class: 'g-wordsearch-bonuschip' }, ico('sparkle'), h('span', null, ''));
    const listHead = h(
      'div',
      { class: 'g-wordsearch-listhead' },
      h('span', { class: 'g-wordsearch-listlabel' }, t('words')),
      puzzle.bonus.length ? bonusChip : null,
      progress,
    );
    const list = h('div', { class: 'g-wordsearch-list' }, items);
    const panel = h('div', { class: 'g-wordsearch-panel' }, listHead, list);

    // --- tools
    const toolsEl = h('div', { class: 'g-wordsearch-tools' });
    const toolBtns = {};
    for (const tool of opts.tools || []) {
      const b = h(
        'button',
        { class: 'g-wordsearch-tool', onclick: () => tool.run(b) },
        h('span', { class: 'g-wordsearch-tool-ico', html: icon(tool.icon) }),
        h('span', { class: 'g-wordsearch-tool-label' }, tool.label),
        tool.price ? h('span', { class: 'g-wordsearch-price' }, ico('coin'), String(tool.price)) : tool.badge ? h('span', { class: 'g-wordsearch-price time' }, tool.badge) : null,
      );
      toolBtns[tool.id] = b;
      toolsEl.append(b);
    }

    el.append(hud, boardWrap, panel, toolsEl);

    // --- restore saved progress
    P.found.forEach((i, order) => {
      board.addFound(words[i], order);
      items[i].classList.add('found');
      items[i].style.setProperty('--col', CAP_COLORS[order % CAP_COLORS.length]);
    });
    board.setNextColor(P.found.length);
    P.hinted.forEach((i) => {
      if (!P.found.includes(i)) board.markHint(words[i].r, words[i].c, true);
    });
    updateCounters(false);

    function updateCounters(bump = true) {
      const n = P.found.length;
      countTxt.textContent = `${n}/${words.length}`;
      progress.classList.toggle('done', n === words.length);
      if (bump) {
        progress.classList.remove('bump');
        void progress.offsetWidth;
        progress.classList.add('bump');
      }
      bonusChip.lastChild.textContent = `${t('bonus')} ${P.bonus.length}/${puzzle.bonus.length}`;
      bonusChip.classList.toggle('done', P.bonus.length > 0 && P.bonus.length === puzzle.bonus.length);
    }

    // --- selection result
    function letterAt(r, c) {
      return puzzle.grid[r * puzzle.size + c];
    }
    function commit(sel) {
      if (P.done) return { type: 'miss' };
      let str = '';
      for (let i = 0; i < sel.len; i++) str += letterAt(sel.r + sel.dr * i, sel.c + sel.dc * i);
      const rev = str.split('').reverse().join('');
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const n = w.key.length;
        if (n !== sel.len) continue;
        const er = w.r + w.dr * (n - 1);
        const ec = w.c + w.dc * (n - 1);
        const fwd = sel.r === w.r && sel.c === w.c && sel.dr === w.dr && sel.dc === w.dc;
        const back = sel.r === er && sel.c === ec && sel.dr === -w.dr && sel.dc === -w.dc;
        if (!fwd && !back) continue;
        if (P.found.includes(i)) {
          toast(t('already'));
          return { type: 'dup' };
        }
        const color = P.found.length;
        later(() => wordFound(i, { color }), 0);
        return { type: 'found', color, index: i };
      }
      const b = puzzle.bonus.find((x) => x.key === str || x.key === rev);
      if (b && !words.some((w) => w.key === b.key)) {
        if (P.bonus.includes(b.key)) {
          toast(t('already'));
          return { type: 'dup' };
        }
        P.bonus.push(b.key);
        S.stats.bonus++;
        save('stats');
        updateCounters(false);
        const mid = board.cellCenter(sel.r + (sel.dr * (sel.len - 1)) / 2, sel.c + (sel.dc * (sel.len - 1)) / 2);
        if (opts.onBonus) opts.onBonus(b, mid);
        else {
          addCoins(BONUS_COINS);
          floatText(`${b.word} +${BONUS_COINS}`, mid.x, mid.y, 'bonus');
          sfx.play('coin');
          showCoins();
          toast(t('bonusFound', { n: BONUS_COINS }));
        }
        sfx.vibrate(20);
        opts.onChange && opts.onChange(snapshot());
        return { type: 'bonus' };
      }
      if (sel.len >= 2) {
        missSound();
        sfx.vibrate([12, 30, 12]);
      }
      return { type: 'miss' };
    }

    function wordFound(i, { color, reveal = false } = {}) {
      if (P.found.includes(i)) return;
      P.found.push(i);
      board.setNextColor(P.found.length);
      board.markHint(words[i].r, words[i].c, false);
      if (P.target === i) setTarget(null, true);
      if (reveal) board.addFound(words[i], color, { animate: true });
      S.stats.words++;
      save('stats');
      chime(P.found.length - 1);
      sfx.vibrate(25);
      flyToList(i, color, reveal ? 380 : 60);
      updateCounters();
      opts.onFound && opts.onFound(i);
      if (P.found.length === words.length) {
        P.done = true;
        P.elapsed = elapsed();
        P.since = 0;
        board.setEnabled(false);
        board.clearSpotlight();
        const quick = mode === 'timed';
        if (!quick)
          later(() => {
            board.celebrate();
            sfx.play('win');
          }, 650);
        later(() => opts.onComplete && opts.onComplete({ hints: P.hints, ms: P.elapsed, bonus: P.bonus.length, words: words.length }), quick ? 750 : 1500);
      } else {
        opts.onChange && opts.onChange(snapshot());
      }
    }

    function flyToList(i, color, delay) {
      const item = items[i];
      const col = CAP_COLORS[color % CAP_COLORS.length];
      item.style.setProperty('--col', col);
      later(() => {
        const pr = panel.getBoundingClientRect();
        const ir = item.getBoundingClientRect();
        if (ir.top < pr.top + 4) panel.scrollTop -= pr.top + 4 - ir.top;
        else if (ir.bottom > pr.bottom - 4) panel.scrollTop += ir.bottom - (pr.bottom - 4);
        const to = item.getBoundingClientRect();
        const from = board.capRect(words[i]);
        const ar = app.getBoundingClientRect();
        const fly = h('div', { class: 'g-wordsearch-fly', style: { left: `${from.x - ar.left}px`, top: `${from.y - ar.top}px` } }, words[i].word);
        fly.style.setProperty('--col', col);
        app.append(fly);
        const dx = to.left + to.width / 2 - from.x;
        const dy = to.top + to.height / 2 - from.y;
        const anim = fly.animate(
          [
            { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
            { transform: 'translate(-50%,-60%) scale(1.25)', opacity: 1, offset: 0.25 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9)`, opacity: 0.85 },
          ],
          { duration: 620, easing: 'cubic-bezier(.45,0,.3,1)' },
        );
        anim.onfinish = () => {
          fly.remove();
          if (dead) return;
          item.classList.add('found', 'just');
          later(() => item.classList.remove('just'), 700);
          sfx.play('pop');
        };
      }, delay);
    }

    // --- hint target (tap a word in the list)
    function setTarget(i, silent = false) {
      if (P.target !== null) items[P.target].classList.remove('target');
      if (i === null || P.target === i || P.found.includes(i)) {
        P.target = null;
        return;
      }
      P.target = i;
      items[i].classList.add('target');
      if (!silent) {
        sfx.play('select');
        toast(t('targetSet', { w: words[i].word }));
      }
    }
    function pickWord(filter = () => true) {
      if (P.target !== null && !P.found.includes(P.target) && filter(P.target)) return P.target;
      const open = words.map((_, i) => i).filter((i) => !P.found.includes(i) && filter(i));
      if (!open.length) return null;
      return open[Math.floor(Math.random() * open.length)];
    }

    // --- hints (callable by the tools)
    const hints = {
      letter() {
        const i = pickWord((k) => !P.hinted.has(k));
        if (i === null) {
          toast(P.found.length === words.length ? t('allFound') : t('firstLetter'));
          return false;
        }
        P.hinted.add(i);
        board.markHint(words[i].r, words[i].c, true);
        pulseItem(i);
        toast(t('firstLetter'));
        return true;
      },
      spot() {
        const i = pickWord();
        if (i === null) {
          toast(t('allFound'));
          return false;
        }
        const w = words[i];
        const n = w.key.length - 1;
        const er = w.r + w.dr * n;
        const ec = w.c + w.dc * n;
        if (w.dr === 0) board.spotlight(w.r, 0, w.r, puzzle.size - 1);
        else if (w.dc === 0) board.spotlight(0, w.c, puzzle.size - 1, w.c);
        else board.spotlight(w.r, w.c, er, ec);
        pulseItem(i);
        toast(t('spotlightOn'));
        return true;
      },
      reveal() {
        const i = pickWord();
        if (i === null) {
          toast(t('allFound'));
          return false;
        }
        wordFound(i, { color: P.found.length, reveal: true });
        return true;
      },
    };
    function pulseItem(i) {
      const it = items[i];
      it.classList.remove('pulse');
      void it.offsetWidth;
      it.classList.add('pulse');
      later(() => it.classList.remove('pulse'), 2600);
    }

    // --- tutorial (first level only)
    let tutorialOn = false;
    let tipEl = null;
    if (opts.tutorial && P.found.length === 0) {
      tutorialOn = true;
      tipEl = h('div', { class: 'g-wordsearch-tip' }, t('tutorial'));
      boardWrap.append(tipEl);
      later(() => tutorialOn && board.demo(words[0]), 500);
    }
    function stopTutorial() {
      tutorialOn = false;
      board.stopDemo();
      if (tipEl) {
        tipEl.classList.add('out');
        const el2 = tipEl;
        later(() => el2.remove(), 300);
        tipEl = null;
      }
    }

    // --- layout: the grid takes what's left after the HUD, list and tools
    function layout() {
      if (!el.isConnected) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const wide = W >= 700 && W > H * 1.15;
      el.classList.toggle('wide', wide);
      let size;
      if (wide) {
        size = Math.min(H - hud.offsetHeight - 36, W - 420, 640);
      } else {
        panel.style.maxHeight = '';
        const cs = getComputedStyle(el);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const gap = parseFloat(cs.rowGap || cs.gap) || 10;
        const pcs = getComputedStyle(panel);
        const natural = listHead.offsetHeight + list.scrollHeight + parseFloat(pcs.paddingTop) + parseFloat(pcs.paddingBottom) + 2;
        const listNatural = Math.min(natural, Math.max(96, H * 0.3));
        const avail = H - padY - hud.offsetHeight - toolsEl.offsetHeight - listNatural - gap * 3;
        size = Math.min(W - 20, 560, avail);
        size = Math.max(size, Math.min(W - 20, 230));
      }
      board.setSize(Math.floor(size));
    }

    function pause() {
      if (P.since) {
        P.elapsed += performance.now() - P.since;
        P.since = 0;
      }
    }
    function resume() {
      if (!P.since && !P.done) P.since = performance.now();
    }

    return {
      el,
      board,
      hints,
      layout,
      pause,
      resume,
      snapshot,
      toolBtns,
      get P() {
        return P;
      },
      destroy() {
        board.destroy();
      },
    };
  }

  // Charges coins for a hint, or complains.
  function pay(price, btn) {
    if (S.coins < price) {
      toast(t('noCoins'));
      sfx.play('error');
      sfx.vibrate([20, 40, 20]);
      if (btn) {
        btn.classList.remove('shake');
        void btn.offsetWidth;
        btn.classList.add('shake');
      }
      return false;
    }
    addCoins(-price);
    showCoins();
    sfx.play('coin');
    return true;
  }

  function coinTools(game, onUsed) {
    const use = (kind, btn) => {
      if (!game.current || game.current.P.done) return;
      const g = game.current;
      if (S.coins < PRICES[kind]) return pay(PRICES[kind], btn);
      if (!S.tipTarget && g.P.target === null) {
        S.tipTarget = true;
        save('tipTarget');
        later(() => toast(t('pickTarget'), 3200), 1900);
      }
      const ok = g.hints[kind]();
      if (ok) {
        pay(PRICES[kind], btn);
        g.P.hints++;
        onUsed && onUsed(g.snapshot());
      }
    };
    return [
      { id: 'letter', icon: 'bulb', label: t('hint'), price: PRICES.letter, run: (b) => use('letter', b) },
      { id: 'spot', icon: 'spot', label: t('spotlight'), price: PRICES.spot, run: (b) => use('spot', b) },
      { id: 'reveal', icon: 'eye', label: t('reveal'), price: PRICES.reveal, run: (b) => use('reveal', b) },
    ];
  }

  // Mounts a play screen as the current view, with resize + visibility handling.
  function mountPlay(name, game, extraCleanup) {
    const g = game.current;
    const onResize = () => g.layout();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => g.layout()) : null;
    setView(name, g.el, () => {
      g.pause();
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onResize);
      g.destroy();
      extraCleanup && extraCleanup();
    });
    if (ro) ro.observe(g.el);
    window.addEventListener('resize', onResize);
    g.layout();
    raf(() => g.layout());
    activeGame = g;
  }

  // Debug hook for automated tests (read-only view of the current puzzle).
  let currentPuzzle = null;
  let activeGame = null;
  window.__wordsearch = {
    get view() {
      return view && view.name;
    },
    get puzzle() {
      const p = currentPuzzle;
      return p && { size: p.size, grid: p.grid.join(''), words: p.words.map((w) => ({ word: w.word, key: w.key, r: w.r, c: w.c, dr: w.dr, dc: w.dc })), bonus: p.bonus.map((b) => b.key) };
    },
    cellCenter: (r, c) => activeGame && activeGame.board.cellCenter(r, c),
    get found() {
      return activeGame ? activeGame.P.found.slice() : [];
    },
    get coins() {
      return S.coins;
    },
    get level() {
      return S.level;
    },
    get timed() {
      return { running: T.running, left: T.left, score: T.score, grids: T.grids };
    },
  };

  // ============================================================ LEVELS
  const levelGame = { current: null };

  function playLevel(level) {
    closeOverlay(true);
    level = Math.max(1, Math.min(level | 0, S.level));
    const puzzle = E.levelPuzzle(level, lang, LISTS);
    currentPuzzle = puzzle;
    const info = puzzle.info;
    const key = `L${level}:${lang}`;
    const cur = store.get('cur', null);
    const saved = cur && cur.key === key ? cur : null;
    const replay = level < S.level;
    const mapBtn = h('button', { class: 'g-wordsearch-round', 'aria-label': t('map'), title: t('map'), onclick: () => showMap() }, h('span', { html: icon('map') }));
    const g = playScreen({
      mode: 'level',
      puzzle,
      theme: info.theme,
      subtitle: `${t('level', { n: level })} · ${nm(info.pack.name)}`,
      hudLeft: mapBtn,
      saved,
      tools: coinTools(levelGame, (snap) => store.set('cur', { key, ...snap })),
      tutorial: level === 1 && !S.tut,
      onChange: (snap) => store.set('cur', { key, ...snap }),
      onFound: () => {
        if (!S.tut) {
          S.tut = true;
          save('tut');
        }
      },
      onComplete: (res) => levelComplete(level, info, res, replay),
    });
    levelGame.current = g;
    mountPlay('level', g, () => {
      if (!g.P.done) store.set('cur', { key, ...g.snapshot() });
    });
    if (replay && !saved) later(() => toast(t('replayInfo')), 400);
  }

  function starsFor(hints) {
    return hints === 0 ? 3 : hints <= 2 ? 2 : 1;
  }

  function levelComplete(level, info, res, replay) {
    store.remove('cur');
    const stars = starsFor(res.hints);
    const prevStars = S.stars[level] | 0;
    S.stars[level] = Math.max(prevStars, stars);
    const frontier = level === S.level;
    let coins = replay ? 5 : 8 + res.words + [0, 0, 5, 10][stars];
    const chapterDone = frontier && level % E.CHAPTER_LEN === 0;
    if (frontier) {
      S.level = level + 1;
      S.stats.levels++;
    }
    addCoins(coins + (chapterDone ? CHAPTER_COINS : 0));
    save('stars', 'level', 'stats');
    ctx.addXP?.(replay ? 5 : Math.min(25, 10 + Math.floor(level / 8)));

    // --- celebration card
    const starEls = [0, 1, 2].map((k) => h('span', { class: `g-wordsearch-star s${k}`, html: icon(k < stars ? 'star' : 'starEmpty') }));
    const coinVal = h('b', null, '+0');
    const rewardRow = h('div', { class: 'g-wordsearch-reward' }, ico('coin', 'big'), coinVal);
    const secs = Math.round(res.ms / 1000);
    const stats = h(
      'div',
      { class: 'g-wordsearch-stats' },
      h('span', null, ico('clock'), `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`),
      h('span', null, ico('check', 'ok'), `${res.words}`),
      res.bonus ? h('span', null, ico('sparkle'), `${res.bonus}`) : null,
    );
    const praise = t('praise').split('|');
    let chapterBox = null;
    if (chapterDone) {
      const nextCh = E.chapterInfo(Math.floor(level / E.CHAPTER_LEN));
      chapterBox = h(
        'div',
        { class: 'g-wordsearch-chapterdone' },
        h('div', { class: 'g-wordsearch-cd-title' }, ico('trophy'), t('chapterDone')),
        h('div', { class: 'g-wordsearch-cd-row' }, h('span', null, t('chapterBonus')), h('b', null, ico('coin'), `+${CHAPTER_COINS}`)),
        h('div', { class: 'g-wordsearch-cd-next', style: { '--pc': nextCh.pack.color } }, h('span', { class: 'g-wordsearch-emo' }, nextCh.pack.emoji), t('nextChapter', { name: nm(nextCh.pack.name) })),
      );
    }
    const nextBtn = h('button', { class: 'btn primary big block', onclick: () => playLevel(S.level) }, t('next'), h('span', { class: 'btn-ico', html: icon('play') }));
    const mapBtn = h('button', { class: 'btn block g-wordsearch-secondary', onclick: () => showMap() }, h('span', { class: 'g-wordsearch-ico', html: icon('map') }), t('backToMap'));
    const card = openOverlay(
      'g-wordsearch-win',
      h('div', { class: 'g-wordsearch-rays', 'aria-hidden': 'true' }),
      h('div', { class: 'g-wordsearch-ribbon' }, t('levelDone')),
      h('div', { class: 'g-wordsearch-wintheme' }, h('span', { class: 'g-wordsearch-emo' }, info.theme.emoji), `${nm(info.theme.name)} · ${t('level', { n: level })}`),
      h('div', { class: 'g-wordsearch-stars' }, starEls),
      h('div', { class: 'g-wordsearch-praise' }, praise[(level * 7) % praise.length]),
      stats,
      rewardRow,
      chapterBox,
      h('div', { class: 'g-wordsearch-actions' }, nextBtn, mapBtn),
    );
    ctx.ui.confetti(chapterDone ? 120 : 70);
    starEls.forEach((s, k) =>
      later(() => {
        s.classList.add('in');
        if (k < stars) sfx.tone({ freq: 660 + k * 220, dur: 0.18, type: 'triangle', vol: 0.35 });
      }, 350 + k * 260),
    );
    later(() => {
      let ticks = 0;
      countUp(coinVal, 0, coins, 800, () => ticks++ % 3 === 0 && sfx.play('coin'), '+');
      flyCoins(rewardRow, 7);
      animateCoins(650);
    }, 1150);
  }

  // ============================================================ LEVEL MAP
  function showMap() {
    closeOverlay(true);
    levelGame.current = null;
    const cur = S.level;
    const curChapter = Math.floor((cur - 1) / E.CHAPTER_LEN);
    let cStart = Math.max(0, curChapter - 3);
    const cEnd = curChapter + 1;

    const totalStars = Object.values(S.stars).reduce((a, b) => a + (b | 0), 0);
    const curInfo = E.levelInfo(cur);
    const top = h(
      'div',
      { class: 'g-wordsearch-maptop' },
      h('div', { class: 'g-wordsearch-chip' }, ico('star'), h('b', null, fmt(totalStars))),
      h('div', { class: 'g-wordsearch-chip' }, h('span', null, t('season', { n: curInfo.season + 1 }))),
      coinPill,
    );
    const scroller = h('div', { class: 'g-wordsearch-mapscroll' });
    const inner = h('div', { class: 'g-wordsearch-mapinner' });
    scroller.append(inner);
    const playBtn = h(
      'button',
      { class: 'btn primary big block g-wordsearch-mapplay', onclick: () => playLevel(S.level) },
      h('span', { class: 'btn-ico', html: icon('play') }),
      t('playLevel', { n: cur }),
    );
    const el = h('div', { class: 'g-wordsearch-mapview' }, top, scroller, h('div', { class: 'g-wordsearch-mapbottom' }, playBtn));
    const onResize = () => render(true);
    setView('map', el, () => window.removeEventListener('resize', onResize));
    window.addEventListener('resize', onResize);

    const GAP = 92;
    const HEAD = 150;
    const SEC = HEAD + E.CHAPTER_LEN * GAP;
    const TOP = 120;

    function smoothPath(pts) {
      if (pts.length < 2) return '';
      let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
      }
      return d;
    }

    function render(keepScroll = false) {
      const prevScroll = scroller.scrollTop;
      clear(inner);
      const W = Math.min(scroller.clientWidth || 360, 620);
      const amp = Math.min(118, W * 0.27);
      const nCh = cEnd - cStart + 1;
      const BOT = cStart > 0 ? 96 : 36;
      const H = TOP + nCh * SEC + BOT;
      inner.style.height = `${H}px`;
      inner.style.width = `${W}px`;
      const nodeX = (lvl) => W / 2 + amp * Math.sin((lvl - 1) * 0.92 + 0.5);
      const secBottom = (ch) => H - BOT - (ch - cStart) * SEC;
      const nodeY = (lvl) => {
        const ch = Math.floor((lvl - 1) / E.CHAPTER_LEN);
        const j = (lvl - 1) % E.CHAPTER_LEN;
        return secBottom(ch) - HEAD - GAP * j - GAP / 2 + 10;
      };

      // chapter backgrounds + plaques
      for (let ch = cStart; ch <= cEnd; ch++) {
        const info = E.chapterInfo(ch);
        const yb = secBottom(ch);
        const locked = info.first > cur;
        const chStars = Array.from({ length: E.CHAPTER_LEN }, (_, j) => S.stars[info.first + j] | 0).reduce((a, b) => a + b, 0);
        const doneCount = Math.max(0, Math.min(E.CHAPTER_LEN, cur - info.first));
        inner.append(
          h('div', {
            class: 'g-wordsearch-sec',
            style: { top: `${yb - SEC}px`, height: `${SEC}px`, '--pc': info.pack.color },
            'data-emoji': info.pack.emoji,
          }),
        );
        inner.append(
          h(
            'div',
            { class: `g-wordsearch-plaque ${locked ? 'locked' : ''} ${doneCount === E.CHAPTER_LEN ? 'done' : ''}`, style: { top: `${yb - HEAD / 2}px`, '--pc': info.pack.color } },
            h('div', { class: 'g-wordsearch-medal' }, h('span', null, info.pack.emoji), locked ? h('i', { html: icon('lock') }) : null),
            h(
              'div',
              { class: 'g-wordsearch-plaque-t' },
              h('small', null, `${t('chapter', { n: ch + 1 })}${info.season ? ' · ' + t('season', { n: info.season + 1 }) : ''}`),
              h('b', null, nm(info.pack.name)),
              h('span', { class: 'g-wordsearch-plaque-p' }, `${doneCount}/${E.CHAPTER_LEN}`, h('em', null, ico('star'), `${chStars}/${E.CHAPTER_LEN * 3}`)),
            ),
          ),
        );
      }

      // path
      const first = cStart * E.CHAPTER_LEN + 1;
      const last = (cEnd + 1) * E.CHAPTER_LEN;
      const pts = [];
      for (let l = first; l <= last; l++) pts.push([nodeX(l), nodeY(l)]);
      const donePts = pts.slice(0, Math.max(0, Math.min(pts.length, cur - first + 1)));
      const svg = `<svg class="g-wordsearch-path" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <path d="${smoothPath(pts)}" class="todo"/>
        <path d="${smoothPath(donePts)}" class="done-glow"/>
        <path d="${smoothPath(donePts)}" class="done"/>
      </svg>`;
      inner.append(h('div', { class: 'g-wordsearch-pathwrap', html: svg }));

      // nodes
      for (let l = first; l <= last; l++) {
        const info = E.levelInfo(l);
        const x = nodeX(l);
        const y = nodeY(l);
        const state = l < cur ? 'done' : l === cur ? 'current' : 'locked';
        const st = S.stars[l] | 0;
        const node = h(
          'button',
          {
            class: `g-wordsearch-node ${state}`,
            style: { left: `${x}px`, top: `${y}px`, '--pc': info.pack.color },
            'aria-label': `${t('level', { n: l })} · ${nm(info.theme.name)}`,
            onclick: () => {
              if (state === 'locked') {
                sfx.play('error');
                toast(t('locked'));
                node.classList.remove('shake');
                void node.offsetWidth;
                node.classList.add('shake');
                return;
              }
              playLevel(l);
            },
          },
          h('span', { class: 'g-wordsearch-node-n' }, state === 'locked' ? h('i', { html: icon('lock') }) : String(l)),
          state === 'done' ? h('span', { class: 'g-wordsearch-node-stars' }, [0, 1, 2].map((k) => h('i', { html: icon(k < st ? 'star' : 'starEmpty') }))) : null,
        );
        const side = x > W / 2 ? 'left' : 'right';
        const label = h(
          'div',
          { class: `g-wordsearch-label ${side} ${state}`, style: { top: `${y}px`, [side === 'left' ? 'right' : 'left']: side === 'left' ? `${W - x + 42}px` : `${x + 42}px` } },
          h('span', { class: 'g-wordsearch-emo' }, info.theme.emoji),
          h('span', null, nm(info.theme.name)),
        );
        inner.append(label, node);
        if (state === 'current') inner.append(h('div', { class: 'g-wordsearch-pin', style: { left: `${x}px`, top: `${y - 52}px` } }, h('span', { html: icon('play') })));
      }

      inner.append(h('div', { class: 'g-wordsearch-ahead', style: { top: '28px' } }, ico('sparkle'), t('moreAhead')));
      if (cStart > 0) {
        inner.append(
          h(
            'button',
            {
              class: 'btn small g-wordsearch-earlier',
              style: { top: `${H - 70}px` },
              onclick: () => {
                cStart = Math.max(0, cStart - 4);
                render(true);
              },
            },
            t('earlier'),
          ),
        );
      }
      if (keepScroll) scroller.scrollTop = prevScroll;
      else scroller.scrollTop = Math.max(0, nodeY(cur) - scroller.clientHeight * 0.55);
    }
    render();
    raf(() => render(true));
  }

  // ============================================================ DAILY
  const dailyGame = { current: null };
  function dayKeyOffset(off) {
    const d = new Date();
    d.setDate(d.getDate() + off);
    return E.todayKey(d);
  }

  function playDaily() {
    closeOverlay(true);
    const date = E.todayKey();
    if (S.daily.last === date) return dailyDone(false);
    const puzzle = E.dailyPuzzle(date, lang, LISTS);
    currentPuzzle = puzzle;
    const key = `D${date}:${lang}`;
    const cur = store.get('dcur', null);
    const saved = cur && cur.key === key ? cur : null;
    const dateTxt = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const streakBadge = h('div', { class: 'g-wordsearch-streak', title: t('streak') }, h('span', { html: icon('flame') }), h('b', null, String(currentStreak())));
    const g = playScreen({
      mode: 'daily',
      puzzle,
      theme: puzzle.theme,
      subtitle: `${t('daily')} · ${dateTxt}`,
      hudLeft: streakBadge,
      saved,
      tools: coinTools(dailyGame, (snap) => store.set('dcur', { key, ...snap })),
      onChange: (snap) => store.set('dcur', { key, ...snap }),
      onComplete: (res) => dailyComplete(date, res),
    });
    dailyGame.current = g;
    mountPlay('daily', g, () => {
      if (!g.P.done) store.set('dcur', { key, ...g.snapshot() });
    });
  }

  function currentStreak() {
    const d = S.daily;
    if (d.last === E.todayKey() || d.last === dayKeyOffset(-1)) return d.streak | 0;
    return 0;
  }

  function dailyComplete(date, res) {
    store.remove('dcur');
    const d = S.daily;
    const streak = d.last === dayKeyOffset(-1) ? (d.streak | 0) + 1 : d.last === date ? d.streak | 0 : 1;
    d.last = date;
    d.streak = streak;
    d.best = Math.max(d.best | 0, streak);
    d.history = [...(d.history || []).filter((x) => x !== date), date].slice(-40);
    save('daily');
    const base = 60;
    const bonus = Math.min(7, streak) * 10;
    addCoins(base + bonus);
    ctx.addXP?.(25);
    dailyDone(true, { base, bonus, res });
  }

  function dailyDone(justFinished, info) {
    closeOverlay(true);
    dailyGame.current = null;
    const d = S.daily;
    const letters = t('week').split('|');
    const week = h('div', { class: 'g-wordsearch-week' });
    for (let off = -6; off <= 0; off++) {
      const day = new Date();
      day.setDate(day.getDate() + off);
      const k = E.todayKey(day);
      const ok = (d.history || []).includes(k);
      week.append(h('div', { class: `g-wordsearch-day ${ok ? 'ok' : ''} ${off === 0 ? 'today' : ''}` }, h('small', null, letters[day.getDay()]), h('span', { html: ok ? icon('check') : '' })));
    }
    const countdown = h('b', { class: 'g-wordsearch-countdown' }, '');
    const tickCd = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const s = Math.max(0, Math.floor((next - now) / 1000));
      const p = (n) => String(n).padStart(2, '0');
      countdown.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
      if (s === 0) later(() => view && view.name === 'dailyDone' && playDaily(), 1200);
    };
    tickCd();
    const iv = setInterval(() => !dead && tickCd(), 1000);
    let rewardBox = null;
    if (justFinished && info) {
      const total = h('b', null, '+0');
      rewardBox = h(
        'div',
        { class: 'g-wordsearch-dreward' },
        h('div', null, h('span', null, t('reward')), h('b', null, ico('coin'), `+${info.base}`)),
        h('div', null, h('span', null, t('streakBonus')), h('b', null, ico('coin'), `+${info.bonus}`)),
        h('div', { class: 'tot' }, h('span', null, t('total')), h('b', null, ico('coin', 'big'), total)),
      );
      later(() => {
        let k = 0;
        countUp(total, 0, info.base + info.bonus, 900, () => k++ % 3 === 0 && sfx.play('coin'), '+');
        flyCoins(total, 8);
        animateCoins(700);
      }, 700);
      ctx.ui.confetti(110);
      sfx.play('win');
    }
    const el = h(
      'div',
      { class: 'g-wordsearch-center' },
      h(
        'div',
        { class: 'g-wordsearch-card static g-wordsearch-dailycard' },
        h('div', { class: 'g-wordsearch-bigico', html: icon('calendar') }),
        h('div', { class: 'g-wordsearch-ribbon' }, justFinished ? t('dailyComplete') : t('dailyDone')),
        h(
          'div',
          { class: 'g-wordsearch-streakrow' },
          h('div', { class: 'g-wordsearch-streakbig' }, h('span', { html: icon('flame') }), h('b', null, String(d.streak | 0)), h('small', null, t('streak'))),
          h('div', { class: 'g-wordsearch-streakbig' }, h('span', { html: icon('trophy') }), h('b', null, String(d.best | 0)), h('small', null, t('bestStreak'))),
        ),
        week,
        rewardBox,
        h('p', { class: 'g-wordsearch-note' }, t('keepStreak')),
        h('div', { class: 'g-wordsearch-next' }, h('span', null, t('nextDaily')), countdown),
        h(
          'div',
          { class: 'g-wordsearch-actions' },
          h('button', { class: 'btn primary big block', onclick: () => playLevel(S.level) }, h('span', { class: 'btn-ico', html: icon('play') }), t('playLevel', { n: S.level })),
        ),
      ),
    );
    setView('dailyDone', el, () => clearInterval(iv));
  }

  // ============================================================ TIME ATTACK
  const timedGame = { current: null };
  const T = { running: false, paused: false, left: TIMED_MS, score: 0, grids: 0, gridNo: 0, used: [], seed: 0, last: 0, loop: 0, lastSec: -1 };

  function timedIntro() {
    closeOverlay(true);
    T.running = false;
    timedGame.current = null;
    const el = h(
      'div',
      { class: 'g-wordsearch-center' },
      h(
        'div',
        { class: 'g-wordsearch-card static g-wordsearch-timedcard' },
        h('div', { class: 'g-wordsearch-bigico', html: icon('clock') }),
        h('div', { class: 'g-wordsearch-ribbon' }, t('timed')),
        h('p', { class: 'g-wordsearch-note' }, t('timedRules')),
        h('div', { class: 'g-wordsearch-bestbox' }, h('span', { html: icon('trophy') }), h('small', null, t('best')), h('b', null, S.tbest ? fmt(S.tbest) : t('noBest'))),
        h('p', { class: 'g-wordsearch-note small' }, t('timedHint')),
        h('div', { class: 'g-wordsearch-actions' }, h('button', { class: 'btn primary big block', onclick: () => startTimed() }, h('span', { class: 'btn-ico', html: icon('play') }), t('start'))),
      ),
    );
    setView('timedIntro', el);
  }

  function startTimed() {
    Object.assign(T, { running: false, paused: false, left: TIMED_MS, score: 0, grids: 0, gridNo: 0, used: [], seed: (Date.now() & 0xffffff) + 1, lastSec: -1 });
    nextTimedGrid();
    // 3-2-1 countdown
    const num = h('div', { class: 'g-wordsearch-count' }, '3');
    const ov = h('div', { class: 'g-wordsearch-overlay show g-wordsearch-countov' }, num);
    app.append(ov);
    timedGame.current.board.setEnabled(false);
    const seq = ['3', '2', '1', t('go')];
    seq.forEach((s, i) =>
      later(() => {
        num.textContent = s;
        num.classList.remove('pop');
        void num.offsetWidth;
        num.classList.add('pop');
        sfx.tone({ freq: i < 3 ? 520 : 880, dur: i < 3 ? 0.12 : 0.25, type: 'triangle', vol: 0.35 });
      }, i * 700),
    );
    later(() => {
      ov.remove();
      if (!timedGame.current) return;
      timedGame.current.board.setEnabled(true);
      T.running = true;
      T.last = performance.now();
      cancelAnimationFrame(T.loop);
      T.loop = raf(timedLoop);
    }, seq.length * 700);
  }

  let timerEl = null;
  let scoreEl = null;
  function nextTimedGrid() {
    T.gridNo++;
    const pool = THEMES.filter((th) => !T.used.includes(th.id));
    const theme = pool[Math.floor(Math.random() * pool.length)];
    T.used = [...T.used, theme.id].slice(-30);
    const puzzle = E.timedPuzzle(T.gridNo, theme.id, T.seed + T.gridNo * 7919, lang, LISTS);
    currentPuzzle = puzzle;
    timerEl = h('b', null, '2:00');
    scoreEl = h('b', null, String(T.score));
    const timerPill = h('div', { class: 'g-wordsearch-timer' }, h('span', { html: icon('clock') }), timerEl);
    const scorePill = h('div', { class: 'g-wordsearch-score', title: t('score') }, h('span', { html: icon('check') }), scoreEl);
    const g = playScreen({
      mode: 'timed',
      puzzle,
      theme,
      subtitle: `${t('timed')} · #${T.gridNo}`,
      hudLeft: scorePill,
      hudRight: timerPill,
      tools: [
        {
          id: 'letter',
          icon: 'bulb',
          label: t('hint'),
          badge: `−${TIMED_HINT_S} s`,
          run: () => {
            if (!T.running || T.paused || !timedGame.current) return;
            if (timedGame.current.hints.letter()) {
              T.left = Math.max(0, T.left - TIMED_HINT_S * 1000);
              const r = timerPill.getBoundingClientRect();
              floatText(`−${TIMED_HINT_S} s`, r.left + r.width / 2, r.bottom + 6, 'bad');
              sfx.play('whoosh');
            }
          },
        },
        {
          id: 'skip',
          icon: 'skip',
          label: t('skip'),
          run: () => {
            if (!T.running || T.paused) return;
            sfx.play('whoosh');
            nextTimedGrid();
          },
        },
        { id: 'pause', icon: 'pause', label: t('pause'), run: () => pauseTimed() },
      ],
      onBonus: (b, mid) => {
        T.left += 3000;
        floatText(`${b.word} +3 s`, mid.x, mid.y, 'bonus');
        sfx.play('coin');
      },
      onFound: () => {
        T.score++;
        scoreEl.textContent = String(T.score);
        scorePill.classList.remove('bump');
        void scorePill.offsetWidth;
        scorePill.classList.add('bump');
      },
      onComplete: () => {
        if (!T.running) return;
        T.grids++;
        T.left += TIMED_BONUS_S * 1000;
        const r = timerPill.getBoundingClientRect();
        floatText(t('bonusTime', { n: TIMED_BONUS_S }), r.left + r.width / 2, r.bottom + 6, 'good');
        sfx.play('success');
        nextTimedGrid();
      },
    });
    // quicker hand-off between grids
    timedGame.current = g;
    mountPlay('timed', g, () => {});
    g.el.classList.add('slide-in');
    updateTimer();
  }

  function updateTimer() {
    if (!timerEl) return;
    const s = Math.max(0, Math.ceil(T.left / 1000));
    timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const pill = timerEl.parentNode;
    pill.classList.toggle('low', s <= 10);
    if (T.running && s <= 5 && s !== T.lastSec && s > 0) {
      sfx.tone({ freq: 980, dur: 0.06, type: 'square', vol: 0.12 });
      sfx.vibrate(15);
    }
    T.lastSec = s;
  }

  function timedLoop(now) {
    if (!T.running) return;
    const dt = Math.min(250, now - T.last);
    T.last = now;
    if (!T.paused) {
      T.left -= dt;
      updateTimer();
      if (T.left <= 0) return endTimed();
    }
    T.loop = raf(timedLoop);
  }

  function pauseTimed() {
    if (!T.running || T.paused) return;
    T.paused = true;
    timedGame.current && timedGame.current.board.setEnabled(false);
    openOverlay(
      'g-wordsearch-pausecard',
      h('div', { class: 'g-wordsearch-bigico', html: icon('pause') }),
      h('div', { class: 'g-wordsearch-ribbon' }, t('paused')),
      h('div', { class: 'g-wordsearch-stats' }, h('span', null, ico('check', 'ok'), String(T.score)), h('span', null, ico('clock'), timerEl ? timerEl.textContent : '')),
      h(
        'div',
        { class: 'g-wordsearch-actions' },
        h('button', { class: 'btn primary big block', onclick: () => resumeTimed() }, h('span', { class: 'btn-ico', html: icon('play') }), t('resume')),
        h(
          'button',
          {
            class: 'btn block g-wordsearch-secondary',
            onclick: () => {
              T.running = false;
              timedIntro();
            },
          },
          t('quit'),
        ),
      ),
    );
  }
  function resumeTimed() {
    closeOverlay();
    T.paused = false;
    T.last = performance.now();
    timedGame.current && timedGame.current.board.setEnabled(true);
  }

  function endTimed() {
    T.running = false;
    T.left = 0;
    updateTimer();
    const g = timedGame.current;
    if (g) g.board.setEnabled(false);
    const record = T.score > S.tbest;
    if (record) {
      S.tbest = T.score;
      save('tbest');
    }
    const coins = T.score * 2 + T.grids * 5;
    addCoins(coins);
    ctx.addXP?.(Math.max(5, Math.min(25, T.score)));
    sfx.play(record ? 'win' : 'lose');
    if (record && T.score > 0) ctx.ui.confetti(100);
    const scoreBig = h('b', null, '0');
    const coinVal = h('b', null, `+${coins}`);
    openOverlay(
      'g-wordsearch-win',
      h('div', { class: 'g-wordsearch-ribbon' }, t('timeUp')),
      record && T.score > 0 ? h('div', { class: 'g-wordsearch-record' }, ico('trophy'), t('newRecord')) : null,
      h('div', { class: 'g-wordsearch-bigscore' }, scoreBig, h('small', null, t('score'))),
      h(
        'div',
        { class: 'g-wordsearch-stats' },
        h('span', null, h('small', null, t('grids')), h('b', null, String(T.grids))),
        h('span', null, h('small', null, t('best')), h('b', null, String(S.tbest))),
      ),
      h('div', { class: 'g-wordsearch-reward' }, ico('coin', 'big'), coinVal),
      h(
        'div',
        { class: 'g-wordsearch-actions' },
        h('button', { class: 'btn primary big block', onclick: () => startTimed() }, h('span', { class: 'btn-ico', html: icon('play') }), t('playAgain')),
        h('button', { class: 'btn block g-wordsearch-secondary', onclick: () => ctx.exit() }, t('quit')),
      ),
    );
    countUp(scoreBig, 0, T.score, 700);
    later(() => {
      if (coins) {
        flyCoins(coinVal, 6);
        animateCoins(650);
      }
    }, 500);
  }

  // ------------------------------------------------------------ visibility / back
  listen(document, 'visibilitychange', () => {
    const g = view && (view.name === 'level' ? levelGame.current : view.name === 'daily' ? dailyGame.current : view.name === 'timed' ? timedGame.current : null);
    if (document.hidden) {
      g && g.pause();
      if (view && view.name === 'timed' && T.running && !T.paused) pauseTimed();
    } else {
      g && g.resume();
    }
  });

  ctx.onBack(() => {
    if (!view) return false;
    if (view.name === 'level') {
      showMap();
      return true;
    }
    if (view.name === 'timed' && T.running && !T.paused) {
      pauseTimed();
      return true;
    }
    return false;
  });

  // ------------------------------------------------------------ start
  if (ctx.mode === 'daily') playDaily();
  else if (ctx.mode === 'timed') timedIntro();
  else playLevel(S.level);

  return () => {
    dead = true;
    T.running = false;
    if (view && view.cleanup) {
      try {
        view.cleanup();
      } catch (e) {
        console.error(e);
      }
    }
    view = null;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const id of rafs) cancelAnimationFrame(id);
    rafs.clear();
    for (const [target, type, fn, opts] of docListeners) target.removeEventListener(type, fn, opts);
    document.querySelectorAll('.g-wordsearch-flycoin').forEach((el) => el.remove());
    try {
      delete window.__wordsearch;
    } catch {
      window.__wordsearch = undefined;
    }
  };
}
