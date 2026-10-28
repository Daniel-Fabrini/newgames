// One level being played: scene panel (canvas), round pause button, cream
// tray with the targets, hints, timer, feedback effects and the result panel.

import { rng } from '../../../js/core/ui.js';
import { SceneView } from './view.js';
import { generateLevel } from './gen.js';
import { paintIndoor } from './paint/indoor.js';
import { paintOutdoorBack, paintOutdoorFront } from './paint/outdoor.js';
import { emojiName } from './catalog.js';
import { sheet, coinIcon, ICON } from './ui.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const PENALTY = 5;
const HINT_PRICE = 25;

// ---------------------------------------------------------------- scene building
function buildCanvases(spec) {
  const { W, H, theme, seed } = spec;
  const budget = 6.2e6;
  const bs = Math.min(2, Math.sqrt(budget / (W * H)));
  const front = document.createElement('canvas');
  front.width = Math.round(W * bs);
  front.height = Math.round(H * bs);
  const g = front.getContext('2d');
  g.scale(bs, bs);
  const prnd = rng(seed ^ 0x51ed);
  if (spec.look === 'indoor') {
    const res = paintIndoor(g, W, H, prnd, theme.paint);
    return { front, zones: res.zones, horizon: res.horizon };
  }
  const margin = { x: Math.round(W * 0.12), y: 140 };
  const horizon = Math.round(H * (theme.paint.horizon || 0.28));
  const bh = horizon + 220 + margin.y;
  const bw = W + margin.x * 2;
  const bsb = bs * 0.62;
  const back = document.createElement('canvas');
  back.width = Math.round(bw * bsb);
  back.height = Math.round(bh * bsb);
  const gb = back.getContext('2d');
  gb.scale(bsb, bsb);
  gb.translate(margin.x, margin.y);
  const brnd = rng(seed ^ 0xbac4);
  const bk = paintOutdoorBack(gb, W, H, brnd, theme.paint, margin);
  const fr = paintOutdoorFront(g, W, H, prnd, theme.paint, bk);
  return { front, back, backRect: { x: -margin.x, y: -margin.y, w: bw, h: bh }, zones: fr.zones, horizon };
}

// ---------------------------------------------------------------- the screen
export function playLevel(app, spec) {
  const { ctx, t, h } = app;
  const { sfx } = ctx;
  const kind = spec.kind;
  const timed = !spec.zen;
  let destroyed = false;
  let view = null;
  let level = null;
  let goals = [];
  let finished = false;
  let paused = false;
  let openSheet = null;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  // ---- timer
  const clock = { acc: 0, t0: 0, running: false, penalty: 0 };
  const clockStart = () => {
    if (!clock.running && !finished) {
      clock.t0 = performance.now();
      clock.running = true;
    }
  };
  const clockStop = () => {
    if (clock.running) {
      clock.acc += performance.now() - clock.t0;
      clock.running = false;
    }
  };
  const elapsed = () => clock.acc + (clock.running ? performance.now() - clock.t0 : 0) + clock.penalty * 1000;
  const stats = { misses: 0, hints: 0, recentMisses: [] };

  // ---- DOM
  const canvasHost = h('div', { class: 'g-hidden-canvas-host' });
  const loader = h('div', { class: 'g-hidden-loader' }, h('div', { class: 'g-hidden-loader-ring', html: ICON.lens }), h('div', null, t('preparing')));
  const pauseBtn = h('button', { class: 'g-hidden-round g-hidden-pause', 'aria-label': t('paused'), html: ICON.pause, onclick: () => openPause() });
  const banner = h('div', { class: 'g-hidden-banner' });
  const coach = h('div', { class: 'g-hidden-coach' }, t('pinch'));
  const sceneEl = h('div', { class: 'g-hidden-scene' }, canvasHost, banner, coach, pauseBtn, loader);
  const trayTitle = h('span', { class: 'g-hidden-tray-title' }, kind === 'match' ? t('matchTitle') : kind === 'findall' ? t('findAllTitle') : t('findTitle'));
  const trayInfo = h('span', { class: 'g-hidden-tray-info' });
  const tiles = h('div', { class: 'g-hidden-tiles' });
  const tray = h('div', { class: 'g-hidden-tray' }, h('div', { class: 'g-hidden-tray-head' }, trayTitle, trayInfo), tiles);
  const flyLayer = h('div', { class: 'g-hidden-fly-layer' });
  const el = h('div', { class: 'g-hidden-play g-hidden-enter' }, sceneEl, tray, flyLayer);
  app.mount(el);

  // ---- tray model
  let slots = []; // { el, key } for classic-like modes
  let queue = []; // goal keys waiting for a slot
  let matchSlot = null, pips = [];
  let selected = null, selectFx = null;

  function tileFor(key) {
    if (kind === 'match') return pips[key] ? pips[key].el : matchSlot;
    const s = slots.find((x) => x.key === key);
    return s ? s.el : null;
  }

  function makeTile(key) {
    const gl = goals[key];
    const b = h('button', { class: 'g-hidden-tile g-hidden-tile-in', 'aria-label': emojiName(gl.ch, ctx.lang) }, h('span', { class: 'g-hidden-tile-e' }, gl.ch));
    if (gl.need > 1) b.append(h('span', { class: 'g-hidden-badge' }, String(gl.need - gl.shown)));
    b.addEventListener('click', () => tilePopover(b, key));
    return b;
  }

  function buildTray() {
    tiles.innerHTML = '';
    slots = [];
    if (kind === 'match') {
      matchSlot = h('button', { class: 'g-hidden-tile g-hidden-hand', 'aria-label': t('hint') }, h('span', { class: 'g-hidden-tile-e' }, '?'));
      matchSlot.addEventListener('click', () => tilePopover(matchSlot, selected ? selected.key : -1));
      const pipBox = h('div', { class: 'g-hidden-pips' });
      pips = goals.map(() => {
        const p = h('span', { class: 'g-hidden-pip' });
        pipBox.append(p);
        return { el: p };
      });
      tiles.append(matchSlot, pipBox);
    } else {
      const w = tiles.clientWidth || 340;
      const max = kind === 'findall' ? goals.length : clamp(Math.floor((w + 8) / 62), 3, 6);
      const order = goals.map((g, i) => i);
      const first = order.slice(0, max);
      queue = order.slice(max);
      for (const key of first) {
        const tile = makeTile(key);
        slots.push({ el: tile, key });
        tiles.append(tile);
      }
    }
    updateInfo();
  }

  function updateInfo() {
    const done = goals.reduce((a, g) => a + (kind === 'match' ? (g.shown >= 2 ? 1 : 0) : g.shown), 0);
    const total = goals.reduce((a, g) => a + (kind === 'match' ? 1 : g.need), 0);
    const parts = [t('found', { a: done, b: total })];
    if (timed) parts.push('⏱ ' + fmtTime(elapsed()));
    trayInfo.textContent = parts.join('  ·  ');
  }

  function tickTile(key) {
    const gl = goals[key];
    if (kind === 'match') {
      const p = pips[key];
      if (p) {
        p.el.textContent = gl.ch;
        p.el.classList.add('on');
      }
      matchSlot.classList.remove('active');
      matchSlot.querySelector('.g-hidden-tile-e').textContent = '?';
      updateInfo();
      return;
    }
    const s = slots.find((x) => x.key === key);
    if (!s) return updateInfo();
    const badge = s.el.querySelector('.g-hidden-badge');
    if (badge) badge.textContent = String(Math.max(0, gl.need - gl.shown));
    s.el.classList.remove('g-hidden-bump');
    void s.el.offsetWidth;
    s.el.classList.add('g-hidden-bump');
    if (gl.shown >= gl.need) {
      s.el.classList.add('done');
      if (!s.el.querySelector('.g-hidden-check')) s.el.append(h('span', { class: 'g-hidden-check', html: ICON.check }));
      if (queue.length) {
        const next = queue.shift();
        later(() => {
          const tile = makeTile(next);
          s.el.replaceWith(tile);
          s.el = tile;
          s.key = next;
        }, 750);
      }
    }
    updateInfo();
  }

  // ---- popover on a tile: name + hint
  let pop = null;
  function closePopover() {
    if (pop) {
      pop.remove();
      pop = null;
    }
  }
  function tilePopover(tile, key) {
    sfx.play('tap');
    const wasOpen = pop && pop.dataset.key === String(key);
    closePopover();
    if (wasOpen) return;
    const gl = goals[key];
    if (key !== -1 && (!gl || gl.found >= gl.need)) return;
    const hintLabel = spec.zen ? t('hintFree') : app.state.hints > 0 ? `${t('hint')} · ${app.state.hints}` : `${t('hint')} · ${HINT_PRICE}`;
    pop = h(
      'div',
      { class: 'g-hidden-popover', 'data-key': String(key) },
      gl ? h('div', { class: 'g-hidden-pop-name' }, emojiName(gl.ch, ctx.lang)) : null,
      h('button', { class: 'g-hidden-pop-hint', onclick: (e) => {
        e.stopPropagation();
        closePopover();
        useHint(key === -1 ? undefined : key);
      } }, h('span', { html: ICON.lens }), hintLabel, !spec.zen && app.state.hints <= 0 ? coinIcon() : null),
    );
    el.append(pop);
    const r = tile.getBoundingClientRect(), pr = el.getBoundingClientRect();
    const pw = pop.offsetWidth;
    pop.style.left = clamp(r.left - pr.left + r.width / 2 - pw / 2, 8, pr.width - pw - 8) + 'px';
    pop.style.top = r.top - pr.top - pop.offsetHeight - 10 + 'px';
    pop.style.setProperty('--arrow', r.left - pr.left + r.width / 2 - parseFloat(pop.style.left) + 'px');
  }

  // ---- effects
  function ringFx(p, color = '#7CF0B8') {
    const N = 12;
    const parts = Array.from({ length: N }, (_, i) => ({ a: (i / N) * TAU + Math.random() * 0.3, v: 0.6 + Math.random() * 0.6, c: i % 3 ? '#ffe28a' : '#ffffff' }));
    view.addEffect({
      dur: 900,
      draw(g, k, v) {
        const s = v.worldToScreen(p.x, p.y);
        const r = Math.max(20, p.s * v.z * 0.62);
        const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        g.globalAlpha = a;
        g.lineWidth = 4;
        g.strokeStyle = color;
        g.shadowColor = 'rgba(0,0,0,0.5)';
        g.shadowBlur = 6;
        g.beginPath();
        g.arc(s.x, s.y, r * (1 + 0.1 * easeOut(k)), -Math.PI / 2, -Math.PI / 2 + TAU * easeOut(Math.min(1, k * 2.2)));
        g.stroke();
        g.shadowBlur = 0;
        for (const q of parts) {
          const d = r * (0.8 + easeOut(k) * 1.4 * q.v);
          const x = s.x + Math.cos(q.a) * d, y = s.y + Math.sin(q.a) * d;
          const sz = 6 * (1 - k) + 1;
          g.fillStyle = q.c;
          g.beginPath();
          g.moveTo(x, y - sz);
          g.lineTo(x + sz * 0.3, y - sz * 0.3);
          g.lineTo(x + sz, y);
          g.lineTo(x + sz * 0.3, y + sz * 0.3);
          g.lineTo(x, y + sz);
          g.lineTo(x - sz * 0.3, y + sz * 0.3);
          g.lineTo(x - sz, y);
          g.lineTo(x - sz * 0.3, y - sz * 0.3);
          g.closePath();
          g.fill();
        }
      },
    });
  }

  function missFx(wx, wy, soft, penalty) {
    view.addEffect({
      dur: 800,
      draw(g, k, v) {
        const s = v.worldToScreen(wx, wy);
        const sc = k < 0.2 ? easeOut(k / 0.2) : 1;
        const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        g.globalAlpha = a;
        g.translate(s.x, s.y);
        g.scale(sc, sc);
        g.lineCap = 'round';
        const d = 11;
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(-d, -d);
        g.lineTo(d, d);
        g.moveTo(d, -d);
        g.lineTo(-d, d);
        g.stroke();
        g.strokeStyle = soft ? '#8a8a96' : '#ff3b5c';
        g.lineWidth = 5;
        g.stroke();
        if (penalty) {
          g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
          g.font = '900 16px Nunito, sans-serif';
          g.textAlign = 'center';
          g.lineWidth = 4;
          g.strokeStyle = 'rgba(0,0,0,0.6)';
          g.strokeText(t('penalty', { s: PENALTY }), s.x, s.y - 22 - k * 26);
          g.fillStyle = '#ff6b81';
          g.fillText(t('penalty', { s: PENALTY }), s.x, s.y - 22 - k * 26);
        }
      },
    });
  }

  function selectionFx(p) {
    return view.addEffect({
      dur: Infinity,
      draw(g, ms, v) {
        const s = v.worldToScreen(p.x, p.y);
        const r = Math.max(22, p.s * v.z * 0.7) * (1 + 0.08 * Math.sin(ms / 160));
        g.lineWidth = 4;
        g.strokeStyle = '#ffd34d';
        g.shadowColor = 'rgba(255,200,60,0.9)';
        g.shadowBlur = 12;
        g.beginPath();
        g.arc(s.x, s.y, r, 0, TAU);
        g.stroke();
      },
    });
  }

  function lensFx(p) {
    const start = { x: view.w * 0.85, y: view.h * 1.05 };
    view.addEffect({
      dur: 3000,
      draw(g, k, v, ms) {
        const s = v.worldToScreen(p.x, p.y);
        const a = easeOut(clamp(k / 0.16, 0, 1));
        const fade = k > 0.86 ? 1 - (k - 0.86) / 0.14 : 1;
        const R = clamp(Math.min(v.w, v.h) * 0.2, 54, 86);
        const lx = lerp(start.x, s.x, a), ly = lerp(start.y, s.y, a);
        g.globalAlpha = fade;
        // magnified content
        const mz = Math.min(v.z * 2.1, v.maxZ * 1.6);
        const c = v.screenToWorld(lx, ly);
        g.save();
        g.beginPath();
        g.arc(lx, ly, R, 0, TAU);
        g.clip();
        v.drawWorld(g, mz, lx - c.x * mz, ly - c.y * mz, performance.now(), v.w, v.h);
        g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
        const pr = Math.max(16, p.s * mz * 0.62) * (1 + 0.07 * Math.sin(ms / 140));
        const ts = { x: lx + (s.x - lx) * (mz / v.z), y: ly + (s.y - ly) * (mz / v.z) };
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(255,214,90,0.95)';
        g.beginPath();
        g.arc(ts.x, ts.y, pr, 0, TAU);
        g.stroke();
        const gl = g.createLinearGradient(lx - R, ly - R, lx + R, ly + R);
        gl.addColorStop(0, 'rgba(255,255,255,0.28)');
        gl.addColorStop(0.45, 'rgba(255,255,255,0)');
        g.fillStyle = gl;
        g.fillRect(lx - R, ly - R, R * 2, R * 2);
        g.restore();
        // handle
        g.save();
        g.translate(lx, ly);
        g.rotate(Math.PI / 4);
        const hg = g.createLinearGradient(0, -9, 0, 9);
        hg.addColorStop(0, '#6b3f1d');
        hg.addColorStop(0.5, '#a8662e');
        hg.addColorStop(1, '#4a2a12');
        g.fillStyle = hg;
        g.beginPath();
        g.roundRect ? g.roundRect(R + 6, -9, R * 0.95, 18, 9) : g.rect(R + 6, -9, R * 0.95, 18);
        g.fill();
        g.fillStyle = '#d9a63a';
        g.fillRect(R + 2, -11, 12, 22);
        g.restore();
        // golden rim
        const rg = g.createLinearGradient(lx - R, ly - R, lx + R, ly + R);
        rg.addColorStop(0, '#f7d774');
        rg.addColorStop(0.5, '#c9971c');
        rg.addColorStop(1, '#f2c94c');
        g.lineWidth = 9;
        g.strokeStyle = rg;
        g.shadowColor = 'rgba(0,0,0,0.5)';
        g.shadowBlur = 10;
        g.beginPath();
        g.arc(lx, ly, R + 3, 0, TAU);
        g.stroke();
        g.shadowBlur = 0;
        g.lineWidth = 1.5;
        g.strokeStyle = 'rgba(80,50,0,0.8)';
        g.beginPath();
        g.arc(lx, ly, R - 1, 0, TAU);
        g.stroke();
      },
    });
  }

  function spotFx(p) {
    view.addEffect({
      dur: 2800,
      draw(g, k, v, ms) {
        const s = v.worldToScreen(p.x, p.y);
        const a = k < 0.12 ? k / 0.12 : k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
        const r = Math.max(34, p.s * v.z * 0.95);
        g.globalAlpha = a;
        g.fillStyle = 'rgba(5,5,12,0.6)';
        g.beginPath();
        g.rect(0, 0, v.w, v.h);
        g.arc(s.x, s.y, r * (1.6 - 0.6 * easeOut(Math.min(1, k * 3))), 0, TAU, true);
        g.fill();
        const pr = r * (1 + 0.1 * Math.sin(ms / 130));
        g.lineWidth = 4;
        g.strokeStyle = '#ffd34d';
        g.shadowColor = 'rgba(255,200,60,0.9)';
        g.shadowBlur = 14;
        g.beginPath();
        g.arc(s.x, s.y, pr, 0, TAU);
        g.stroke();
        for (let i = 0; i < 4; i++) {
          const an = ms / 600 + (i * TAU) / 4;
          const x = s.x + Math.cos(an) * (pr + 14), y = s.y + Math.sin(an) * (pr + 14);
          g.fillStyle = '#fff3c0';
          g.beginPath();
          g.arc(x, y, 3.5, 0, TAU);
          g.fill();
        }
      },
    });
  }

  // ---- fly to tray
  function fly(p, key, done) {
    const cr = view.canvas.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const s = view.worldToScreen(p.x, p.y);
    const target = tileFor(key) || trayTitle;
    const tr = target.getBoundingClientRect();
    const x0 = cr.left - er.left + s.x, y0 = cr.top - er.top + s.y;
    const x1 = tr.left - er.left + tr.width / 2, y1 = tr.top - er.top + tr.height / 2;
    const size = clamp(p.s * view.z, 30, 84);
    const f = h('span', { class: 'g-hidden-fly' }, p.ch);
    f.style.fontSize = size + 'px';
    flyLayer.append(f);
    const mx = (x0 + x1) / 2 + (x0 < x1 ? -40 : 40), my = Math.min(y0, y1) - 70;
    const end = 36 / size;
    const anim = f.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1)`, offset: 0 },
        { transform: `translate(${x0}px, ${y0 - 18}px) translate(-50%, -50%) scale(1.35)`, offset: 0.18 },
        { transform: `translate(${mx}px, ${my}px) translate(-50%, -50%) scale(1.05) rotate(-12deg)`, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(${end})`, offset: 1 },
      ],
      { duration: 720, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      f.remove();
      if (!destroyed) done();
    };
  }

  // ---- input handling
  function candidates() {
    if (!level) return [];
    return level.props.filter((p) => p.alive && (p.role === 'target' || p.role === 'pair'));
  }
  function hitTest(wx, wy) {
    let best = null, bestK = Infinity;
    const tol = 22 / view.z;
    for (const p of candidates()) {
      const r = Math.max(p.s * 0.56, tol);
      const d = Math.hypot(wx - p.x, wy - p.y);
      if (d <= r && d / r < bestK) {
        best = p;
        bestK = d / r;
      }
    }
    return best;
  }

  function onTap(wx, wy) {
    closePopover();
    if (finished || paused) return true;
    const p = hitTest(wx, wy);
    if (!p) return false;
    if (kind === 'match') matchTap(p);
    else found(p);
    return true;
  }

  function found(p) {
    progressed();
    const gl = goals[p.key];
    gl.found++;
    p.role = 'found';
    p.pop = performance.now();
    p.dieAfterPop = true;
    sfx.play('pop');
    sfx.vibrate(22);
    ringFx(p);
    later(() => {
      fly(p, p.key, () => {
        gl.shown++;
        sfx.tone({ freq: 880, to: 1320, dur: 0.12, type: 'triangle', vol: 0.3 });
        tickTile(p.key);
        checkDone();
      });
    }, 200);
  }

  function matchTap(p) {
    if (!selected) {
      selected = p;
      selectFx = selectionFx(p);
      matchSlot.querySelector('.g-hidden-tile-e').textContent = p.ch;
      matchSlot.classList.add('active');
      sfx.play('select');
      sfx.vibrate(12);
      if (!app.seen('twin')) {
        app.markSeen('twin');
        ctx.ui.toast(t('findTwin'));
      }
      return;
    }
    if (selected === p) {
      clearSelection();
      sfx.play('tap');
      return;
    }
    if (selected.key === p.key) {
      progressed();
      const a = selected, b = p;
      clearSelection(true);
      const gl = goals[a.key];
      gl.found = 2;
      for (const q of [a, b]) {
        q.role = 'found';
        q.pop = performance.now();
        q.dieAfterPop = true;
        ringFx(q);
      }
      sfx.play('success');
      sfx.vibrate([18, 40, 18]);
      later(() => {
        let n = 0;
        for (const q of [a, b])
          fly(q, a.key, () => {
            if (++n === 2) {
              gl.shown = 2;
              tickTile(a.key);
              checkDone();
            }
          });
      }, 200);
      return;
    }
    // mismatch
    clearSelection();
    penalize(p.x, p.y, true);
    ctx.ui.toast(t('mismatch'));
  }

  function clearSelection(keepSlot) {
    if (selectFx) selectFx.done = true;
    selectFx = null;
    selected = null;
    if (!keepSlot && matchSlot) {
      matchSlot.classList.remove('active');
      matchSlot.querySelector('.g-hidden-tile-e').textContent = '?';
    }
    view.request();
  }

  function onMiss(wx, wy) {
    if (finished || paused) return;
    penalize(wx, wy, false);
  }

  function penalize(wx, wy) {
    stats.misses++;
    if (spec.zen) {
      missFx(wx, wy, true, false);
      sfx.play('tap');
      return;
    }
    clock.penalty += PENALTY;
    missFx(wx, wy, false, true);
    sfx.play('error');
    sfx.vibrate([30, 40, 30]);
    sceneEl.classList.remove('g-hidden-shake');
    void sceneEl.offsetWidth;
    sceneEl.classList.add('g-hidden-shake');
    const tnow = performance.now();
    stats.recentMisses = stats.recentMisses.filter((x) => tnow - x < 2600);
    stats.recentMisses.push(tnow);
    if (stats.recentMisses.length >= 3) {
      stats.recentMisses = [];
      view.locked = true;
      sceneEl.classList.add('g-hidden-locked');
      ctx.ui.toast(t('slowDown'));
      later(() => {
        view.locked = false;
        sceneEl.classList.remove('g-hidden-locked');
      }, 1600);
    }
    updateInfo();
  }

  // ---- hints
  let zenHintReady = 0;
  function hintTarget(key) {
    const alive = candidates();
    if (!alive.length) return null;
    if (kind === 'match') {
      if (selected) return alive.find((q) => q !== selected && q.key === selected.key) || null;
      return alive[Math.floor(Math.random() * alive.length)];
    }
    let list = key !== undefined ? alive.filter((q) => q.key === key) : alive.filter((q) => slots.some((s) => s.key === q.key));
    if (!list.length) list = alive;
    const c = view.center();
    list.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    return list[0];
  }

  async function useHint(key) {
    if (finished || !view) return;
    if (spec.zen) {
      const left = Math.ceil((zenHintReady - performance.now()) / 1000);
      if (left > 0) {
        ctx.ui.toast(t('hintWait', { s: left }));
        return;
      }
      zenHintReady = performance.now() + 8000;
    } else if (app.state.hints <= 0) {
      if (app.state.coins < HINT_PRICE) {
        sfx.play('error');
        ctx.ui.toast(t('noCoins'));
        return;
      }
      const ok = await confirmBuy();
      if (!ok || destroyed) return;
      app.addCoins(-HINT_PRICE);
      sfx.play('coin');
    } else app.setHints(app.state.hints - 1);
    const p = hintTarget(key);
    if (!p) return;
    stats.hints++;
    sfx.play('whoosh');
    const z = clamp(Math.max(view.z, view.minZ * 1.9), view.minZ, view.maxZ * 0.8);
    view.flyTo(p.x, p.y, z, 560, () => {
      if (destroyed) return;
      sfx.play('select');
      if (app.cfg.hint === 'lens') lensFx(p);
      else spotFx(p);
    });
  }

  function confirmBuy() {
    return new Promise((resolve) => {
      pauseClock();
      openSheet = sheet(app, {
        icon: ICON.lens,
        title: t('noHints'),
        body: h('p', { class: 'g-hidden-sheet-text' }, t('buyHintText', { price: HINT_PRICE })),
        actions: [
          { label: [t('buy'), ' · ', String(HINT_PRICE), coinIcon()], primary: true, onclick: () => resolve(true) },
          { label: t('cancel'), onclick: () => resolve(false) },
        ],
        onClose: () => {
          openSheet = null;
          resumeClock();
          resolve(false);
        },
      });
    });
  }

  // ---- pause
  function pauseClock() {
    paused = true;
    clockStop();
  }
  function resumeClock() {
    paused = false;
    if (level && !finished && !document.hidden) clockStart();
  }
  function openPause() {
    if (finished || openSheet || !level) return;
    sfx.play('tap');
    closePopover();
    pauseClock();
    const body = h(
      'div',
      { class: 'g-hidden-pause-stats' },
      timed ? h('div', null, h('span', { html: ICON.clock }), fmtTime(elapsed())) : null,
      h('div', null, h('span', { html: ICON.target }), trayInfo.textContent.split('·')[0].trim()),
    );
    const hintLabel = spec.zen ? t('hintFree') : app.state.hints > 0 ? `${t('hint')} · ${app.state.hints}` : `${t('hint')} · ${HINT_PRICE}`;
    const actions = [
      { label: t('resume'), primary: true, onclick: () => {} },
      { label: [h('span', { class: 'g-hidden-btn-ico', html: ICON.lens }), hintLabel], onclick: () => later(() => useHint(), 260) },
      { label: t('restart'), onclick: () => app.restart(spec) },
      spec.map ? { label: t('toMap'), onclick: () => app.showMap(spec.modeId) } : { label: t('quit'), onclick: () => ctx.exit() },
    ];
    openSheet = sheet(app, {
      kind: 'pause',
      icon: ICON.pause,
      title: t('paused'),
      subtitle: spec.title,
      body,
      actions,
      onClose: () => {
        openSheet = null;
        resumeClock();
      },
    });
  }

  // ---- completion
  function checkDone() {
    if (finished) return;
    const done = goals.every((g) => g.shown >= g.need);
    if (!done) return;
    finished = true;
    clockStop();
    const ms = elapsed();
    later(() => app.complete(spec, { ms, misses: stats.misses, hints: stats.hints }), 450);
  }

  // ---- visibility / lifecycle
  const onVis = () => {
    if (document.hidden) clockStop();
    else if (!paused && level && !finished) clockStart();
  };
  document.addEventListener('visibilitychange', onVis);
  // idle nudge: point at the tray (hints live there) after a long search
  let lastProgress = performance.now();
  let nudged = false;
  const infoTimer = setInterval(() => {
    if (destroyed || !level) return;
    updateInfo();
    if (!nudged && !finished && !paused && !openSheet && performance.now() - lastProgress > 45000) {
      nudged = true;
      coach.textContent = t('idleHint');
      coach.classList.remove('hide');
      coach.classList.add('show');
      const first = tiles.querySelector('.g-hidden-tile:not(.done)');
      if (first) first.classList.add('g-hidden-nudge');
      later(() => coach.classList.add('hide'), 6000);
    }
  }, 500);
  const progressed = () => {
    lastProgress = performance.now();
    nudged = false;
    for (const n of tiles.querySelectorAll('.g-hidden-nudge')) n.classList.remove('g-hidden-nudge');
  };

  // ---- build the level
  (async () => {
    await nextFrame();
    if (destroyed) return;
    const cv = buildCanvases(spec);
    level = generateLevel({ seed: spec.seed, theme: spec.theme, kind, zones: cv.zones, W: spec.W, H: spec.H, p: spec.p });
    goals = level.goals.map((g) => ({ ...g, shown: 0 }));
    if (destroyed) return;
    view = new SceneView(canvasHost, {
      onTap,
      onMiss,
      onZoom: (r) => {
        if (r > 1.25) coach.classList.add('hide');
      },
      onPan: () => closePopover(),
    });
    view.setScene({
      W: spec.W,
      H: spec.H,
      front: cv.front,
      back: cv.back,
      backRect: cv.backRect,
      parallax: 0.78,
      props: level.props,
      variant: spec.theme.variant || 'shadow',
      edge: spec.theme.edge || '#0a0a0c',
      fit: spec.look === 'indoor' ? 'cover' : 'height',
      startX: spec.W * 0.5,
    });
    app.debug({ spec, level, view, goals, useHint, elapsed });
    buildTray();
    // intro: settle from a slight zoom
    const c = view.center();
    view.z = view.minZ * 1.18;
    view.centerOn(c.x, c.y);
    view.flyTo(c.x, c.y, view.minZ, 900);
    loader.classList.add('hide');
    later(() => loader.remove(), 400);
    banner.append(h('b', null, spec.title), h('span', null, spec.subtitle));
    const firstTime = !app.seen('pinch');
    const go = () => {
      banner.classList.add('show');
      later(() => banner.classList.remove('show'), 2200);
      if (firstTime) {
        coach.classList.add('show');
        later(() => coach.classList.add('hide'), 7000);
      }
      app.markSeen('pinch');
    };
    const intro = app.introFor(spec);
    if (intro) {
      pauseClock();
      openSheet = intro(() => {
        openSheet = null;
        go();
        resumeClock();
      });
    } else {
      go();
      clockStart();
    }
  })().catch((e) => {
    console.error(e);
    loader.textContent = String(e && e.message);
  });

  return {
    back() {
      if (pop) {
        closePopover();
        return true;
      }
      if (openSheet) {
        if (openSheet.kind !== 'pause') {
          openSheet.close();
          return true;
        }
        // Back while paused leaves the level.
        if (spec.map) {
          app.showMap(spec.modeId);
          return true;
        }
        return false;
      }
      if (finished) {
        if (spec.map) {
          app.showMap(spec.modeId);
          return true;
        }
        return false;
      }
      openPause();
      return true;
    },
    closeSheet() {
      if (openSheet) openSheet.close(true);
    },
    destroy() {
      destroyed = true;
      for (const id of timers) clearTimeout(id);
      clearInterval(infoTimer);
      document.removeEventListener('visibilitychange', onVis);
      if (openSheet) openSheet.close(true);
      if (view) view.destroy();
      el.remove();
    },
  };
}
