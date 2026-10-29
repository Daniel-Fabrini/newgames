// Minesweeper — shell entry. Modes: 'easy' | 'medium' | 'hard' (no mode → menu).
// Pure rules live in logic.js; this file does the canvas board, input and screens.
import STRINGS from './strings.js';
import { DIFFS, levelConfig, clampConfig, createGame, reveal, toggleFlag, chord, neighbors, pack, unpack } from './logic.js';

const NUM_COL = [null, '#4aa3ff', '#4fd16b', '#ff5a5a', '#b98aff', '#ff9a3c', '#3fd8d0', '#f0f0f0', '#9a9aa5'];
const XP = { easy: 10, medium: 20, hard: 40, custom: 8 };
const easeBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const { h } = ctx.ui;
  const store = ctx.store;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const safe = (fn, d) => {
    try {
      return fn();
    } catch {
      return d;
    }
  };
  const getBest = () => safe(() => store.get('best', {}), {}) || {};
  const fmtT = (ms) => (ms / 1000).toFixed(1) + 's';

  let alive = true;
  let view = 'menu';
  let hasMenu = ctx.mode == null;
  let timers = [];
  let raf = 0;
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers = timers.filter((x) => x !== id);
      fn();
    }, ms);
    timers.push(id);
    return id;
  };

  // ---- game state
  let g = null;
  let key = 'easy';
  let level = 1;
  let cfg = DIFFS.easy;
  let cs = 32;
  let flagMode = false;
  let startedAt = 0;
  let elapsed = 0;
  let tickId = 0;
  let cursor = { r: 0, c: 0, on: false };
  const anims = new Map(); // idx -> {t0, dur}
  let boomAt = 0;
  let winAt = 0;
  let el = {};

  // ---- sound toggle in header
  const sndBtn = h('button', { class: 'icon-btn', 'aria-label': t('sound'), onclick: () => {
    ctx.sfx.muted = !ctx.sfx.muted;
    syncSnd();
  } });
  const syncSnd = () => {
    sndBtn.textContent = ctx.sfx.muted ? '🔇' : '🔊';
    sndBtn.setAttribute('aria-pressed', String(!ctx.sfx.muted));
  };
  syncSnd();
  ctx.setHeaderRight?.(sndBtn);

  const tone = (o) => ctx.sfx.tone(o);
  const vib = (p) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    ctx.sfx.vibrate(p);
  };

  // ---------------------------------------------------------------- persistence
  function persist() {
    if (!g || g.status !== 'playing') return;
    const el2 = elapsedNow();
    safe(() => store.set('save', { key, level, cfg, elapsed: el2, game: pack(g) }));
  }
  const clearSave = () => safe(() => store.remove('save'));
  const elapsedNow = () => (g && g.status === 'playing' && startedAt ? performance.now() - startedAt : elapsed);

  // ---------------------------------------------------------------- menu
  function showMenu() {
    stopTicking();
    view = 'menu';
    hasMenu = true;
    root.replaceChildren();
    ctx.setTitle?.();
    const best = getBest();
    const lvl = safe(() => store.get('level', 1), 1) || 1;
    const opt = (icon, title, sub, bt, onclick) =>
      h('button', { class: 'g-mines-opt', onclick }, h('div', { class: 'ic' }, icon), h('div', null, h('div', { class: 'tt' }, title), h('div', { class: 'ss' }, sub)), h('div', { class: 'bt' }, bt));
    const dsub = (d) => t('sizeDesc', { r: d.rows, c: d.cols, m: d.mines });
    const bt = (k) => (best[k] ? '⏱ ' + fmtT(best[k]) : '');
    const lc = levelConfig(lvl);
    const custom = safe(() => store.get('custom', null), null) || { rows: 12, cols: 12, mines: 25 };
    const sl = (label, name, min, max, val) => {
      const out = h('output', null, String(val));
      const inp = h('input', { type: 'range', min, max, value: val, 'aria-label': label, oninput: () => (out.textContent = inp.value) });
      inp.dataset.k = name;
      return h('label', null, h('span', null, label), inp, out);
    };
    const sR = sl(t('rows'), 'rows', 5, 30, custom.rows);
    const sC = sl(t('cols'), 'cols', 5, 20, custom.cols);
    const sM = sl(t('mines'), 'mines', 1, 150, custom.mines);
    const view_ = h(
      'div',
      { class: 'g-mines-view g-mines-menu g-mines-in' },
      h('h2', null, t('menuTitle')),
      h('p', { class: 'muted c' }, t('menuSub')),
      opt('🌱', t('easy'), dsub(DIFFS.easy), bt('easy'), () => start('easy')),
      opt('🚩', t('medium'), dsub(DIFFS.medium), bt('medium'), () => start('medium')),
      opt('💀', t('hard'), dsub(DIFFS.hard), bt('hard'), () => start('hard')),
      opt('♾️', t('endless'), dsub(lc), t('levelN', { n: lvl }), () => start('endless')),
      h(
        'div',
        { class: 'g-mines-custom' },
        h('div', { class: 'tt', style: 'font-weight:900;font-size:17px;margin-bottom:4px' }, '⚙️ ' + t('custom')),
        sR,
        sC,
        sM,
        h('button', {
          class: 'btn primary block',
          onclick: () => {
            const c = clampConfig({ rows: +sR.querySelector('input').value, cols: +sC.querySelector('input').value, mines: +sM.querySelector('input').value });
            safe(() => store.set('custom', c));
            start('custom', c);
          },
        }, t('start')),
      ),
    );
    root.append(view_);
  }

  // ---------------------------------------------------------------- game screen
  function buildGame() {
    root.replaceChildren();
    const mineLcd = h('div', { class: 'g-mines-lcd', role: 'status', 'aria-label': t('minesLeft') }, h('small', null, '💣'), h('span', null, '000'));
    const timeLcd = h('div', { class: 'g-mines-lcd', role: 'timer', 'aria-label': t('time') }, h('small', null, '⏱'), h('span', null, '000'));
    const face = h('button', { class: 'g-mines-face', 'aria-label': t('restart'), onclick: () => newGame() }, '🙂');
    const sub = h('div', { class: 'g-mines-sub' });
    const canvas = h('canvas', { role: 'img', 'aria-label': t('board') });
    const stage = h('div', { class: 'g-mines-stage' }, canvas);
    const vp = h('div', { class: 'g-mines-vp', tabindex: '0', role: 'application', 'aria-label': t('board') }, stage);
    const flagBtn = h('button', { class: 'g-mines-flagbtn', 'aria-pressed': 'false', onclick: () => setFlagMode(!flagMode) }, h('span', null, '🚩'), h('span', null, t('flagMode')));
    const zOut = h('button', { class: 'g-mines-sq', 'aria-label': t('zoomOut'), onclick: () => zoomBy(-4) }, '−');
    const zIn = h('button', { class: 'g-mines-sq', 'aria-label': t('zoomIn'), onclick: () => zoomBy(4) }, '+');
    const menuB = h('button', { class: 'g-mines-sq', 'aria-label': t('menu'), style: 'font-size:20px', onclick: () => leaveToMenu() }, '☰');
    const bar = h('div', { class: 'g-mines-bar' }, flagBtn, zOut, zIn, menuB);
    const v = h('div', { class: 'g-mines-view' }, h('div', { class: 'g-mines-hud' }, mineLcd, face, timeLcd), sub, vp, bar);
    root.append(v);
    el = { v, mineLcd: mineLcd.lastChild, timeLcd: timeLcd.lastChild, face, sub, canvas, stage, vp, flagBtn, zOut, zIn, sheet: null };
    attachInput();
  }

  function leaveToMenu() {
    persist();
    showMenu();
  }

  function setFlagMode(on) {
    flagMode = on;
    el.flagBtn?.classList.toggle('on', on);
    el.flagBtn?.setAttribute('aria-pressed', String(on));
    vib(10);
  }

  function start(k, c) {
    key = k;
    if (k === 'endless') {
      level = safe(() => store.get('level', 1), 1) || 1;
      cfg = levelConfig(level);
    } else if (k === 'custom') cfg = c || clampConfig(safe(() => store.get('custom', null), null) || { rows: 12, cols: 12, mines: 25 });
    else cfg = DIFFS[k];
    view = 'game';
    buildGame();
    const sv = safe(() => store.get('save', null), null);
    let resumed = false;
    if (sv && sv.key === k && sv.cfg && sv.cfg.rows === cfg.rows && sv.cfg.cols === cfg.cols && sv.cfg.mines === cfg.mines && sv.game) {
      try {
        g = unpack(sv.game);
        elapsed = sv.elapsed || 0;
        resumed = g.status === 'playing';
      } catch {
        g = null;
      }
    }
    if (!g || !resumed) {
      newGame(true);
      return;
    }
    flagMode = false;
    startedAt = performance.now() - elapsed;
    layoutBoard(true);
    updateHud();
    startTicking();
    ctx.ui.toast(t('resumed'));
  }

  function newGame(initial) {
    clearSave();
    stopTicking();
    g = createGame(cfg.rows, cfg.cols, cfg.mines);
    startedAt = 0;
    elapsed = 0;
    anims.clear();
    boomAt = 0;
    winAt = 0;
    cursor = { r: (cfg.rows / 2) | 0, c: (cfg.cols / 2) | 0, on: false };
    removeSheet();
    setFlagMode(false);
    layoutBoard(true);
    updateHud();
    if (!initial) ctx.sfx.play('whoosh');
  }

  function removeSheet() {
    el.sheet?.remove();
    el.sheet = null;
  }

  // ---------------------------------------------------------------- sizing
  const dpr = () => Math.min(3, window.devicePixelRatio || 1);
  let tiles = null;
  let minCs = 14;
  const MAXCS = 64;
  function limits() {
    const vw = el.vp.clientWidth - 12;
    const vh = el.vp.clientHeight - 12;
    minCs = Math.max(14, Math.floor(Math.min(vw / g.cols, vh / g.rows)));
    return { vw, vh };
  }
  function layoutBoard(fit) {
    if (!g || view !== 'game') return;
    const { vw, vh } = limits();
    if (fit) {
      const f = Math.floor(Math.min(vw / g.cols, vh / g.rows));
      cs = Math.max(30, Math.min(48, f));
      if (cs < 30) cs = 30;
      cs = Math.max(minCs, cs);
    }
    cs = Math.max(minCs, Math.min(MAXCS, cs));
    applySize();
    if (fit) {
      el.vp.scrollLeft = (el.stage.scrollWidth - el.vp.clientWidth) / 2;
      el.vp.scrollTop = 0;
    }
  }
  function applySize() {
    const d = dpr();
    const cv = el.canvas;
    cv.width = Math.round(g.cols * cs * d);
    cv.height = Math.round(g.rows * cs * d);
    cv.style.width = g.cols * cs + 'px';
    cv.style.height = g.rows * cs + 'px';
    tiles = null;
    el.zOut.disabled = cs <= minCs;
    el.zIn.disabled = cs >= MAXCS;
    kick();
  }
  function setZoom(next, fx, fy) {
    next = Math.max(minCs, Math.min(MAXCS, Math.round(next)));
    if (next === cs) return;
    const vp = el.vp;
    const cvl = el.canvas.offsetLeft;
    const cvt = el.canvas.offsetTop;
    const bx = (vp.scrollLeft + fx - cvl) / cs;
    const by = (vp.scrollTop + fy - cvt) / cs;
    cs = next;
    applySize();
    vp.scrollLeft = bx * cs + el.canvas.offsetLeft - fx;
    vp.scrollTop = by * cs + el.canvas.offsetTop - fy;
  }
  function zoomBy(dv) {
    setZoom(cs + dv, el.vp.clientWidth / 2, el.vp.clientHeight / 2);
    vib(6);
  }
  const onResize = () => {
    if (view !== 'game' || !g) return;
    limits();
    cs = Math.max(minCs, cs);
    applySize();
  };
  window.addEventListener('resize', onResize);

  // ---------------------------------------------------------------- drawing
  function makeTiles() {
    const d = dpr();
    const mk = (fn) => {
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(cs * d);
      const x = c.getContext('2d');
      x.scale(d, d);
      fn(x);
      return c;
    };
    const r = cs * 0.2;
    const rr = (x, a, b, w, hh, rad) => {
      x.beginPath();
      x.roundRect ? x.roundRect(a, b, w, hh, rad) : x.rect(a, b, w, hh);
    };
    return {
      hidden: mk((x) => {
        const i = 1.5;
        const gr = x.createLinearGradient(0, 0, 0, cs);
        gr.addColorStop(0, '#3b3b44');
        gr.addColorStop(0.55, '#26262d');
        gr.addColorStop(1, '#17171c');
        x.fillStyle = gr;
        rr(x, i, i, cs - 2 * i, cs - 2 * i, r);
        x.fill();
        x.strokeStyle = 'rgba(243,194,74,0.38)';
        x.lineWidth = 1;
        rr(x, i + 0.5, i + 0.5, cs - 2 * i - 1, cs - 2 * i - 1, r);
        x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.14)';
        x.beginPath();
        x.moveTo(i + r, i + 1.5);
        x.lineTo(cs - i - r, i + 1.5);
        x.stroke();
      }),
      open: mk((x) => {
        x.fillStyle = '#0f0f13';
        rr(x, 1, 1, cs - 2, cs - 2, r * 0.7);
        x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.045)';
        x.lineWidth = 1;
        rr(x, 1.5, 1.5, cs - 3, cs - 3, r * 0.7);
        x.stroke();
      }),
    };
  }

  function drawFlag(x, px, py, wrong) {
    const s = cs;
    x.save();
    x.translate(px, py);
    x.fillStyle = '#c4c4cc';
    x.fillRect(s * 0.42, s * 0.18, s * 0.05, s * 0.62);
    x.fillStyle = '#c9971c';
    x.beginPath();
    x.ellipse(s * 0.445, s * 0.8, s * 0.2, s * 0.06, 0, 0, Math.PI * 2);
    x.fill();
    const gr = x.createLinearGradient(0, s * 0.18, 0, s * 0.58);
    gr.addColorStop(0, '#fff0a8');
    gr.addColorStop(1, '#e3a723');
    x.fillStyle = gr;
    x.beginPath();
    x.moveTo(s * 0.47, s * 0.18);
    x.lineTo(s * 0.8, s * 0.37);
    x.lineTo(s * 0.47, s * 0.57);
    x.closePath();
    x.fill();
    if (wrong) {
      x.strokeStyle = '#ff4a5a';
      x.lineWidth = Math.max(2, s * 0.09);
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(s * 0.18, s * 0.18);
      x.lineTo(s * 0.82, s * 0.82);
      x.moveTo(s * 0.82, s * 0.18);
      x.lineTo(s * 0.18, s * 0.82);
      x.stroke();
    }
    x.restore();
  }

  function drawMine(x, px, py, boom) {
    const s = cs;
    x.save();
    x.translate(px + s / 2, py + s / 2);
    if (boom) {
      const gr = x.createRadialGradient(0, 0, 2, 0, 0, s * 0.7);
      gr.addColorStop(0, 'rgba(255,90,60,0.95)');
      gr.addColorStop(1, 'rgba(120,10,20,0.6)');
      x.fillStyle = gr;
      x.fillRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);
    }
    x.strokeStyle = '#e8e8ee';
    x.lineWidth = Math.max(1.5, s * 0.06);
    x.lineCap = 'round';
    for (let a = 0; a < 4; a++) {
      const an = (a * Math.PI) / 4;
      x.beginPath();
      x.moveTo(Math.cos(an) * s * 0.34, Math.sin(an) * s * 0.34);
      x.lineTo(-Math.cos(an) * s * 0.34, -Math.sin(an) * s * 0.34);
      x.stroke();
    }
    const gr = x.createRadialGradient(-s * 0.07, -s * 0.07, 1, 0, 0, s * 0.26);
    gr.addColorStop(0, '#8a8a95');
    gr.addColorStop(0.35, '#2a2a30');
    gr.addColorStop(1, '#050507');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(0, 0, s * 0.23, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.beginPath();
    x.arc(-s * 0.08, -s * 0.08, s * 0.045, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }

  function draw(now) {
    const cv = el.canvas;
    if (!cv || !g) return false;
    const d = dpr();
    const x = cv.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    if (!tiles) tiles = makeTiles();
    x.fillStyle = '#08080a';
    x.fillRect(0, 0, g.cols * cs, g.rows * cs);
    let active = false;
    const lost = g.status === 'lost';
    const won = g.status === 'won';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 ${Math.round(cs * 0.6)}px Nunito, system-ui, sans-serif`;
    for (let i = 0; i < g.state.length; i++) {
      const r = (i / g.cols) | 0;
      const c = i % g.cols;
      const px = c * cs;
      const py = r * cs;
      const an = anims.get(i);
      let p = 1;
      let pending = false;
      if (an) {
        const tt = (now - an.t0) / an.dur;
        if (tt < 0) {
          pending = true;
          active = true;
        } else if (tt < 1) {
          p = tt;
          active = true;
        }
      }
      const st = g.state[i];
      const isOpen = st === 1 && !pending;
      if (lost && !pending && g.mine[i] && st !== 2 && i !== g.boom) {
        x.drawImage(tiles.open, px, py, cs, cs);
        drawMine(x, px, py, false);
        continue;
      }
      if (lost && !pending && st === 2 && !g.mine[i]) {
        x.drawImage(tiles.hidden, px, py, cs, cs);
        drawFlag(x, px, py, true);
        continue;
      }
      if (isOpen && g.mine[i]) {
        x.drawImage(tiles.open, px, py, cs, cs);
        drawMine(x, px, py, true);
        continue;
      }
      if (isOpen) {
        const sc = reduced ? 1 : p < 1 ? easeBack(p) : 1;
        if (sc !== 1) {
          x.save();
          x.translate(px + cs / 2, py + cs / 2);
          x.scale(sc, sc);
          x.translate(-cs / 2, -cs / 2);
          x.drawImage(tiles.open, 0, 0, cs, cs);
          if (g.adj[i]) {
            x.fillStyle = NUM_COL[g.adj[i]];
            x.fillText(g.adj[i], cs / 2, cs / 2 + cs * 0.04);
          }
          x.restore();
        } else {
          x.drawImage(tiles.open, px, py, cs, cs);
          if (g.adj[i]) {
            x.fillStyle = NUM_COL[g.adj[i]];
            x.fillText(g.adj[i], px + cs / 2, py + cs / 2 + cs * 0.04);
          }
        }
        if (won && winAt) {
          const wv = (now - winAt) / 40 - (r + c);
          const a = Math.max(0, 0.4 - Math.abs(wv) * 0.06);
          if (a > 0) {
            x.fillStyle = `rgba(255,208,90,${a})`;
            x.fillRect(px + 1, py + 1, cs - 2, cs - 2);
          }
          if (wv < 40) active = true;
        }
      } else {
        x.drawImage(tiles.hidden, px, py, cs, cs);
        if (st === 2) {
          const sc = reduced ? 1 : p < 1 ? easeBack(p) : 1;
          if (sc !== 1) {
            x.save();
            x.translate(px + cs / 2, py + cs / 2);
            x.scale(sc, sc);
            x.translate(-cs / 2, -cs / 2);
            drawFlag(x, 0, 0, false);
            x.restore();
          } else drawFlag(x, px, py, false);
        } else if (st === 3) {
          x.fillStyle = '#ffd768';
          x.fillText('?', px + cs / 2, py + cs / 2 + cs * 0.04);
        }
      }
    }
    if (boomAt && !reduced) {
      const tt = (now - boomAt) / 700;
      if (tt < 1) {
        const bx = (g.boom % g.cols) * cs + cs / 2;
        const by = ((g.boom / g.cols) | 0) * cs + cs / 2;
        x.strokeStyle = `rgba(255,140,60,${1 - tt})`;
        x.lineWidth = cs * 0.25 * (1 - tt);
        x.beginPath();
        x.arc(bx, by, cs * (0.4 + tt * 3), 0, Math.PI * 2);
        x.stroke();
        active = true;
      }
    }
    if (cursor.on) {
      x.strokeStyle = '#ffe9a0';
      x.lineWidth = 2.5;
      x.strokeRect(cursor.c * cs + 2, cursor.r * cs + 2, cs - 4, cs - 4);
    }
    return active;
  }

  function frame(now) {
    raf = 0;
    if (!alive || view !== 'game') return;
    const active = draw(now);
    if (active) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && alive && view === 'game') raf = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- HUD / timer
  const pad3 = (n) => String(Math.max(0, Math.min(999, n))).padStart(3, '0');
  function updateHud() {
    if (!g || view !== 'game') return;
    el.mineLcd.textContent = (g.mines - g.flags < 0 ? '-' : '') + String(Math.min(99, Math.abs(g.mines - g.flags))).padStart(g.mines >= 100 ? 3 : 2, '0');
    el.timeLcd.textContent = pad3(Math.floor(elapsedNow() / 1000));
    el.face.textContent = g.status === 'lost' ? '😵' : g.status === 'won' ? '😎' : '🙂';
    const lvl = key === 'endless' ? t('levelN', { n: level }) + ' · ' : '';
    const name = key === 'endless' ? '' : t(key) + ' · ';
    el.sub.replaceChildren(h('b', null, lvl + name), `${g.rows}×${g.cols} · ${coarse ? t('hint') : t('hintDesk')}`);
  }
  function startTicking() {
    stopTicking();
    tickId = setInterval(() => {
      if (g && g.status === 'playing') el.timeLcd.textContent = pad3(Math.floor(elapsedNow() / 1000));
    }, 250);
  }
  function stopTicking() {
    if (tickId) clearInterval(tickId);
    tickId = 0;
  }

  // ---------------------------------------------------------------- actions
  function afterReveal(res, i) {
    if (!startedAt && g.started) {
      startedAt = performance.now() - elapsed;
      startTicking();
    }
    const now = performance.now();
    if (res.opened.length) {
      const big = res.opened.length > 3;
      res.opened.forEach((idx, k) => {
        const dl = reduced ? 0 : Math.min(res.depth[k], 40) * 22;
        anims.set(idx, { t0: now + dl, dur: reduced ? 1 : 240 });
      });
      tone({ freq: 380 + (g.adj[i] || 0) * 50, dur: 0.06, type: 'sine', vol: 0.18 });
      if (big) {
        const n = Math.min(6, 2 + Math.floor(res.opened.length / 6));
        for (let k = 0; k < n; k++) tone({ freq: 460 + k * 70, dur: 0.05, type: 'triangle', vol: 0.1, delay: 0.04 * k + 0.05 });
      }
      vib(big ? [8, 20, 8] : 8);
    }
    if (res.boom >= 0) return lose(res.boom);
    if (res.won) return win();
    persist();
    updateHud();
    kick();
  }

  function lose(boom) {
    const now = performance.now();
    elapsed = startedAt ? now - startedAt : 0;
    stopTicking();
    boomAt = now;
    // wave of mines revealing outward from the explosion
    const br = (boom / g.cols) | 0;
    const bc = boom % g.cols;
    const list = [];
    for (let i = 0; i < g.mine.length; i++) {
      if ((g.mine[i] && g.state[i] !== 2) || (g.state[i] === 2 && !g.mine[i])) list.push([i, Math.hypot(((i / g.cols) | 0) - br, (i % g.cols) - bc)]);
    }
    list.sort((a, b) => a[1] - b[1]);
    list.forEach(([i], k) => anims.set(i, { t0: now + (reduced ? 0 : 250 + Math.min(k, 60) * 25), dur: reduced ? 1 : 200 }));
    ctx.sfx.play('explosion');
    vib([60, 40, 140]);
    if (!reduced) {
      el.vp.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-4px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }], { duration: 380 });
    }
    clearSave();
    safe(() => store.update('stats', (s) => ({ ...s, plays: (s.plays || 0) + 1 }), {}));
    ctx.addXP?.(2);
    updateHud();
    kick();
    later(() => showSheet(false, {}), reduced ? 100 : 900);
  }

  function win() {
    const now = performance.now();
    elapsed = startedAt ? now - startedAt : 0;
    stopTicking();
    winAt = now;
    clearSave();
    let newRec = false;
    const best = getBest();
    if (key !== 'custom' && key !== 'endless' && (!best[key] || elapsed < best[key])) {
      best[key] = Math.round(elapsed);
      safe(() => store.set('best', best));
      newRec = true;
    }
    let xp = key === 'endless' ? 10 + Math.min(40, level * 2) : XP[key];
    if (key === 'endless') {
      safe(() => store.set('level', level + 1));
      safe(() => store.update('bestLevel', (v) => Math.max(v || 0, level), 0));
    }
    safe(() => store.update('stats', (s) => ({ ...s, plays: (s.plays || 0) + 1, wins: (s.wins || 0) + 1 }), {}));
    ctx.addXP?.(xp);
    ctx.sfx.play('win');
    vib([30, 50, 30, 50, 90]);
    ctx.ui.confetti?.();
    updateHud();
    kick();
    later(() => showSheet(true, { newRec }), reduced ? 100 : 700);
  }

  function showSheet(won, o) {
    if (view !== 'game') return;
    removeSheet();
    const best = getBest();
    const primary = key === 'endless' && won ? t('nextLevel') : won ? t('playAgain') : t('retry');
    const btns = h(
      'div',
      { class: 'row', style: 'gap:10px' },
      h('button', { class: 'btn primary big', onclick: () => {
        if (key === 'endless' && won) {
          level = safe(() => store.get('level', level + 1), level + 1);
          cfg = levelConfig(level);
        }
        newGame();
      } }, primary),
      h('button', { class: 'btn ghost big', onclick: () => showMenu() }, t('menu')),
    );
    const sheet = h(
      'div',
      { class: 'g-mines-sheet ' + (won ? 'win' : 'lose'), role: 'dialog', 'aria-live': 'polite' },
      h('h3', null, won ? t('won') : t('lost')),
      h('p', null, won ? `${t('yourTime')}: ${fmtT(elapsed)}` : t('lostSub')),
      ...(won && o.newRec ? [h('p', { class: 'g-mines-rec' }, '🏆 ' + t('newRecord'))] : won && best[key] ? [h('p', null, t('best', { t: fmtT(best[key]) }))] : []),
      btns,
    );
    el.v.append(sheet);
    el.sheet = sheet;
    sheet.querySelector('button')?.focus?.({ preventScroll: true });
  }

  function cellAt(clientX, clientY) {
    const rc = el.canvas.getBoundingClientRect();
    const c = Math.floor((clientX - rc.left) / cs);
    const r = Math.floor((clientY - rc.top) / cs);
    if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) return -1;
    return r * g.cols + c;
  }

  function doFlag(i) {
    const s = toggleFlag(g, i);
    if (s < 0) return false;
    anims.set(i, { t0: performance.now(), dur: reduced ? 1 : 220 });
    if (s === 2) {
      tone({ freq: 760, to: 900, dur: 0.09, type: 'triangle', vol: 0.2 });
      vib(22);
    } else {
      tone({ freq: 420, dur: 0.06, type: 'triangle', vol: 0.14 });
      vib(8);
    }
    persist();
    updateHud();
    kick();
    return true;
  }
  function doOpen(i) {
    if (g.status === 'won' || g.status === 'lost') return;
    if (g.state[i] === 1) return doChord(i);
    if (g.state[i] === 2) return;
    afterReveal(reveal(g, i), i);
  }
  function doChord(i) {
    if (g.state[i] !== 1 || !g.adj[i]) return;
    const res = chord(g, i);
    if (!res.ok) {
      vib(6);
      return;
    }
    afterReveal(res, i);
  }
  function act(i, long) {
    if (i < 0 || !g || g.status === 'won' || g.status === 'lost') return;
    if (g.state[i] === 1) return doChord(i);
    if (long) return doFlag(i);
    if (flagMode) return doFlag(i);
    doOpen(i);
  }

  // ---------------------------------------------------------------- input
  function attachInput() {
    const vp = el.vp;
    const ptrs = new Map();
    let press = null; // {id,x,y,i,long,pan}
    let lpTimer = 0;
    let pinch = null;
    const clearLp = () => {
      clearTimeout(lpTimer);
      lpTimer = 0;
    };
    vp.addEventListener('contextmenu', (e) => e.preventDefault());
    vp.addEventListener('pointerdown', (e) => {
      if (!g) return;
      cursor.on = false;
      vp.setPointerCapture?.(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.pointerType === 'mouse') {
        const i = cellAt(e.clientX, e.clientY);
        if (e.button === 2) return act(i, true);
        if (e.button === 1) return doChord(i);
        press = { id: e.pointerId, x: e.clientX, y: e.clientY, i, long: false, pan: false, mouse: true };
        if (g.status === 'playing' || g.status === 'ready') el.face.textContent = '😮';
        return;
      }
      if (ptrs.size === 2) {
        clearLp();
        press = null;
        const [a, b] = [...ptrs.values()];
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), cs0: cs };
        return;
      }
      const i = cellAt(e.clientX, e.clientY);
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, i, long: false, pan: false };
      if (g.status === 'playing' || g.status === 'ready') el.face.textContent = '😮';
      lpTimer = setTimeout(() => {
        lpTimer = 0;
        if (press && !press.pan) {
          press.long = true;
          act(press.i, true);
        }
      }, 380);
    });
    vp.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rc = vp.getBoundingClientRect();
        setZoom(pinch.cs0 * (d / pinch.d0), (a.x + b.x) / 2 - rc.left, (a.y + b.y) / 2 - rc.top);
        return;
      }
      if (press && press.id === e.pointerId) {
        if (!press.pan && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 9) {
          press.pan = true;
          clearLp();
        }
        if (press.pan) {
          vp.scrollLeft -= dx;
          vp.scrollTop -= dy;
        }
      }
    });
    const end = (e, cancel) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      clearLp();
      if (g && g.status !== 'lost' && g.status !== 'won') el.face.textContent = '🙂';
      const pr = press;
      if (pr && pr.id === e.pointerId) {
        press = null;
        if (!cancel && !pr.pan && !pr.long) {
          const i = pr.mouse ? cellAt(e.clientX, e.clientY) : pr.i;
          if (i === pr.i) act(i, false);
        }
      }
    };
    vp.addEventListener('pointerup', (e) => end(e, false));
    vp.addEventListener('pointercancel', (e) => end(e, true));
    vp.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rc = vp.getBoundingClientRect();
      setZoom(cs * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX - rc.left, e.clientY - rc.top);
    }, { passive: false });
    vp.addEventListener('keydown', (e) => {
      if (!g) return;
      const k = e.key;
      const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
      if (mv) {
        cursor.on = true;
        cursor.r = Math.max(0, Math.min(g.rows - 1, cursor.r + mv[0]));
        cursor.c = Math.max(0, Math.min(g.cols - 1, cursor.c + mv[1]));
        const x0 = cursor.c * cs + el.canvas.offsetLeft;
        const y0 = cursor.r * cs + el.canvas.offsetTop;
        if (x0 < vp.scrollLeft) vp.scrollLeft = x0 - 8;
        if (x0 + cs > vp.scrollLeft + vp.clientWidth) vp.scrollLeft = x0 + cs - vp.clientWidth + 8;
        if (y0 < vp.scrollTop) vp.scrollTop = y0 - 8;
        if (y0 + cs > vp.scrollTop + vp.clientHeight) vp.scrollTop = y0 + cs - vp.clientHeight + 8;
        kick();
        e.preventDefault();
        return;
      }
      const i = cursor.r * g.cols + cursor.c;
      if (k === 'Enter' || k === ' ') {
        cursor.on = true;
        act(i, false);
        e.preventDefault();
      } else if (k === 'f' || k === 'F') {
        cursor.on = true;
        act(i, true);
        e.preventDefault();
      } else if (k === 'c' || k === 'C') doChord(i);
      else if (k === 'r' || k === 'R') newGame();
      kick();
    });
  }

  // ---------------------------------------------------------------- lifecycle
  ctx.onBack(() => {
    if (view === 'game' && hasMenu) {
      persist();
      showMenu();
      return true;
    }
    return false;
  });
  const onHide = () => {
    if (document.hidden) persist();
  };
  document.addEventListener('visibilitychange', onHide);

  const modeMap = { easy: 'easy', medium: 'medium', hard: 'hard' };
  if (modeMap[ctx.mode]) start(modeMap[ctx.mode]);
  else showMenu();

  return () => {
    alive = false;
    persist();
    stopTicking();
    timers.forEach(clearTimeout);
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onHide);
    ctx.setHeaderRight?.(null);
  };
}
