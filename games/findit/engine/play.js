// One level being played: the rendered photo of the scene (pan / zoom), the
// cream tray with the objects to find (icons + names, or a word list), hints,
// timer, feedback effects and the pause sheet.

import { rng } from '../../../js/core/ui.js';
import { SceneView } from './view.js';
import { loadScene, pickGoals, insideAny, distTo, tracePath } from './scene.js';
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

export function playLevel(app, spec) {
  const { ctx, t, h } = app;
  const { sfx } = ctx;
  const kind = spec.kind;
  const timed = true;
  let destroyed = false;
  let view = null;
  let scene = null;
  let goals = [];
  let finished = false;
  let paused = false;
  let openSheet = null;
  const marks = []; // found objects outlined on the photo: { it, t0 }
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
  const canvasHost = h('div', { class: 'g-findit-canvas-host' });
  const loader = h('div', { class: 'g-findit-loader' }, h('div', { class: 'g-findit-loader-ring', html: ICON.lens }), h('div', null, t('preparing')));
  const pauseBtn = h('button', { class: 'g-findit-round g-findit-pause', 'aria-label': t('paused'), html: ICON.pause, onclick: () => openPause() });
  const banner = h('div', { class: 'g-findit-banner' });
  const coach = h('div', { class: 'g-findit-coach' }, t('pinch'));
  const sceneEl = h('div', { class: 'g-findit-scene' }, canvasHost, banner, coach, pauseBtn, loader);
  const trayTitle = h('span', { class: 'g-findit-tray-title' }, kind === 'match' ? t('matchTitle') : t('findTitle'));
  const trayInfo = h('span', { class: 'g-findit-tray-info' });
  let listMode = app.ctx.store.get('trayMode', 'icons') === 'words' ? 'words' : 'icons';
  const modeBtn = h('button', { class: 'g-findit-traymode', 'aria-label': t('trayToggle'), onclick: () => toggleMode() });
  const tiles = h('div', { class: 'g-findit-tiles' });
  const tray = h('div', { class: 'g-findit-tray' }, h('div', { class: 'g-findit-tray-head' }, trayTitle, h('span', { class: 'g-findit-tray-right' }, trayInfo, modeBtn)), tiles);
  const flyLayer = h('div', { class: 'g-findit-fly-layer' });
  const el = h('div', { class: 'g-findit-play g-findit-enter' }, sceneEl, tray, flyLayer);
  app.mount(el);

  // ---- tray
  let slots = []; // { el, key }
  let queue = [];

  function setModeIcon() {
    modeBtn.innerHTML = listMode === 'icons' ? ICON.list : ICON.grid;
    modeBtn.title = t(listMode === 'icons' ? 'showWords' : 'showIcons');
  }

  function toggleMode() {
    sfx.play('tap');
    closePopover();
    listMode = listMode === 'icons' ? 'words' : 'icons';
    app.ctx.store.set('trayMode', listMode);
    buildTray();
  }

  function tileFor(key) {
    const s = slots.find((x) => x.key === key);
    return s ? s.el : null;
  }

  function makeTile(key) {
    const gl = goals[key];
    if (listMode === 'words') {
      const w = h('button', { class: 'g-findit-word', 'aria-label': gl.name }, gl.name);
      if (gl.need > 1) w.append(h('small', null, ` ×${gl.need - gl.shown}`));
      if (gl.shown >= gl.need) w.classList.add('done');
      w.addEventListener('click', () => tilePopover(w, key));
      return w;
    }
    const img = h('img', { class: 'g-findit-tile-img', src: gl.thumb, alt: '', draggable: 'false' });
    const longest = Math.max(...gl.name.split(/\s+/).map((w) => w.length));
    const label = h('span', { class: `g-findit-tile-name${longest > 9 ? ' long' : ''}${longest > 12 ? ' xlong' : ''}` }, gl.name);
    const b = h('button', { class: 'g-findit-tile g-findit-tile-in', 'aria-label': gl.name }, img, label);
    if (gl.need > 1) b.append(h('span', { class: 'g-findit-badge' }, String(gl.need - gl.shown)));
    if (gl.shown >= gl.need) {
      b.classList.add('done');
      b.append(h('span', { class: 'g-findit-check', html: ICON.check }));
    }
    b.addEventListener('click', () => tilePopover(b, key));
    return b;
  }

  function buildTray() {
    tiles.innerHTML = '';
    tiles.className = `g-findit-tiles ${listMode === 'words' ? 'words' : ''}`;
    setModeIcon();
    slots = [];
    queue = [];
    const order = goals.map((g, i) => i);
    if (listMode === 'words') {
      for (const key of order) {
        const tile = makeTile(key);
        slots.push({ el: tile, key });
        tiles.append(tile);
      }
    } else {
      const w = tiles.clientWidth || 340;
      const max = clamp(Math.floor((w + 8) / 70), 3, 6);
      const open = order.filter((k) => goals[k].shown < goals[k].need);
      const first = open.slice(0, max);
      queue = open.slice(max);
      for (const key of first) {
        const tile = makeTile(key);
        slots.push({ el: tile, key });
        tiles.append(tile);
      }
    }
    updateInfo();
  }

  function updateInfo() {
    const done = goals.reduce((a, g) => a + (kind === 'match' ? (g.shown >= g.need ? 1 : 0) : g.shown), 0);
    const total = goals.reduce((a, g) => a + (kind === 'match' ? 1 : g.need), 0);
    const parts = [t('found', { a: done, b: total })];
    if (timed) parts.push('⏱ ' + fmtTime(elapsed()));
    trayInfo.textContent = parts.join('  ·  ');
  }

  function tickTile(key) {
    const gl = goals[key];
    const s = slots.find((x) => x.key === key);
    if (!s) return updateInfo();
    if (listMode === 'words') {
      const fresh = makeTile(key);
      s.el.replaceWith(fresh);
      s.el = fresh;
      fresh.classList.add('g-findit-bump');
      return updateInfo();
    }
    const badge = s.el.querySelector('.g-findit-badge');
    if (badge) badge.textContent = String(Math.max(0, gl.need - gl.shown));
    s.el.classList.remove('g-findit-bump');
    void s.el.offsetWidth;
    s.el.classList.add('g-findit-bump');
    if (gl.shown >= gl.need) {
      s.el.classList.add('done');
      if (!s.el.querySelector('.g-findit-check')) s.el.append(h('span', { class: 'g-findit-check', html: ICON.check }));
      if (queue.length) {
        const next = queue.shift();
        later(() => {
          if (listMode !== 'icons') return;
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
    if (!gl || gl.found >= gl.need) return;
    const hintLabel = app.state.hints > 0 ? `${t('hint')} · ${app.state.hints}` : `${t('hint')} · ${HINT_PRICE}`;
    pop = h(
      'div',
      { class: 'g-findit-popover', 'data-key': String(key) },
      h('img', { class: 'g-findit-pop-img', src: gl.thumb, alt: '' }),
      h('div', { class: 'g-findit-pop-name' }, gl.name),
      h('button', { class: 'g-findit-pop-hint', onclick: (e) => {
        e.stopPropagation();
        closePopover();
        useHint(key);
      } }, h('span', { html: ICON.lens }), hintLabel, app.state.hints <= 0 ? coinIcon() : null),
    );
    el.append(pop);
    const r = tile.getBoundingClientRect(), pr = el.getBoundingClientRect();
    const pw = pop.offsetWidth;
    pop.style.left = clamp(r.left - pr.left + r.width / 2 - pw / 2, 8, pr.width - pw - 8) + 'px';
    pop.style.top = r.top - pr.top - pop.offsetHeight - 10 + 'px';
    pop.style.setProperty('--arrow', r.left - pr.left + r.width / 2 - parseFloat(pop.style.left) + 'px');
  }

  // ---- drawing on top of the photo (world coordinates)
  function drawOver(g, z, tx, ty, tnow) {
    if (!marks.length) return;
    const dpr = view.dpr;
    for (const m of marks) {
      const k = clamp((tnow - m.t0) / 900, 0, 1);
      g.save();
      tracePath(g, m.it);
      g.lineJoin = 'round';
      if (k < 1) {
        // the "found!" flash: gold fill fading, thick glowing outline
        g.fillStyle = `rgba(255, 222, 120, ${0.42 * (1 - k)})`;
        g.fill('evenodd');
        g.shadowColor = 'rgba(255, 200, 60, 0.95)';
        g.shadowBlur = (10 + 18 * (1 - k)) * dpr;
        g.strokeStyle = '#ffe08a';
        g.lineWidth = (2.5 + 3 * (1 - k)) / z;
        g.stroke();
      }
      // persistent marker: thin gold outline with a soft glow
      g.shadowColor = 'rgba(0, 0, 0, 0.6)';
      g.shadowBlur = 3 * dpr;
      g.strokeStyle = 'rgba(247, 215, 116, 0.95)';
      g.lineWidth = 2 / z;
      g.stroke();
      g.restore();
    }
  }
  const animating = (tnow) => marks.some((m) => tnow - m.t0 < 950);

  // ---- effects (screen space)
  function sparkleFx(it) {
    const N = 14;
    const parts = Array.from({ length: N }, (_, i) => ({ a: (i / N) * TAU + Math.random() * 0.3, v: 0.6 + Math.random() * 0.6, c: i % 3 ? '#ffe28a' : '#ffffff' }));
    view.addEffect({
      dur: 900,
      draw(g, k, v) {
        const s = v.worldToScreen(it.c.x, it.c.y);
        const r = Math.max(18, it.s * v.z * 0.5);
        g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        for (const q of parts) {
          const d = r * (0.7 + easeOut(k) * 1.3 * q.v);
          const x = s.x + Math.cos(q.a) * d, y = s.y + Math.sin(q.a) * d;
          const sz = 6 * (1 - k) + 1.5;
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

  function missFx(wx, wy, penalty) {
    view.addEffect({
      dur: 800,
      draw(g, k, v) {
        const s = v.worldToScreen(wx, wy);
        const sc = k < 0.2 ? easeOut(k / 0.2) : 1;
        g.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
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
        g.strokeStyle = '#ff3b5c';
        g.lineWidth = 5;
        g.stroke();
        if (penalty) {
          g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
          g.font = '900 16px Nunito, sans-serif';
          g.textAlign = 'center';
          g.lineWidth = 4;
          g.strokeStyle = 'rgba(0,0,0,0.6)';
          const ty = s.y - 22 - k * 26;
          g.strokeText(t('penalty', { s: PENALTY }), s.x, ty);
          g.fillStyle = '#ff6b81';
          g.fillText(t('penalty', { s: PENALTY }), s.x, ty);
        }
      },
    });
  }

  function ring(g, v, it, ms, scale = 1) {
    const s = v.worldToScreen(it.c.x, it.c.y);
    const r = Math.max(24, it.s * v.z * 0.62 * scale) * (1 + 0.08 * Math.sin(ms / 140));
    g.lineWidth = 4;
    g.strokeStyle = '#ffd34d';
    g.shadowColor = 'rgba(255,200,60,0.9)';
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(s.x, s.y, r, 0, TAU);
    g.stroke();
    return { s, r };
  }

  function lensFx(it) {
    const start = { x: view.w * 0.85, y: view.h * 1.05 };
    view.addEffect({
      dur: 3200,
      draw(g, k, v, ms) {
        const s = v.worldToScreen(it.c.x, it.c.y);
        const a = easeOut(clamp(k / 0.16, 0, 1));
        const fade = k > 0.86 ? 1 - (k - 0.86) / 0.14 : 1;
        const R = clamp(Math.min(v.w, v.h) * 0.22, 58, 92);
        const lx = lerp(start.x, s.x, a), ly = lerp(start.y, s.y, a);
        g.globalAlpha = fade;
        const mz = Math.min(v.z * 2, v.maxZ * 1.4);
        const c = v.screenToWorld(lx, ly);
        g.save();
        g.beginPath();
        g.arc(lx, ly, R, 0, TAU);
        g.clip();
        v.drawWorld(g, mz, lx - c.x * mz, ly - c.y * mz, performance.now());
        g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
        // outline the object inside the lens
        g.save();
        g.setTransform(v.dpr * mz, 0, 0, v.dpr * mz, v.dpr * (lx - c.x * mz), v.dpr * (ly - c.y * mz));
        tracePath(g, it);
        g.lineJoin = 'round';
        g.lineWidth = (3 + Math.sin(ms / 140)) / mz;
        g.strokeStyle = 'rgba(255,214,90,0.95)';
        g.shadowColor = 'rgba(255,200,60,0.9)';
        g.shadowBlur = 10 * v.dpr;
        g.stroke();
        g.restore();
        const gl = g.createLinearGradient(lx - R, ly - R, lx + R, ly + R);
        gl.addColorStop(0, 'rgba(255,255,255,0.26)');
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
        if (g.roundRect) g.roundRect(R + 6, -9, R * 0.95, 18, 9);
        else g.rect(R + 6, -9, R * 0.95, 18);
        g.fill();
        g.fillStyle = '#d9a63a';
        g.fillRect(R + 2, -11, 12, 22);
        g.restore();
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
      },
    });
  }

  function spotFx(it) {
    view.addEffect({
      dur: 3000,
      draw(g, k, v, ms) {
        const s = v.worldToScreen(it.c.x, it.c.y);
        const a = k < 0.12 ? k / 0.12 : k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
        const r = Math.max(40, it.s * v.z * 0.85);
        g.globalAlpha = a;
        g.fillStyle = 'rgba(5,5,12,0.62)';
        g.beginPath();
        g.rect(0, 0, v.w, v.h);
        g.arc(s.x, s.y, r * (1.6 - 0.6 * easeOut(Math.min(1, k * 3))), 0, TAU, true);
        g.fill();
        const { r: pr } = ring(g, v, it, ms, 1.25);
        for (let i = 0; i < 4; i++) {
          const an = ms / 600 + (i * TAU) / 4;
          g.fillStyle = '#fff3c0';
          g.beginPath();
          g.arc(s.x + Math.cos(an) * (pr + 14), s.y + Math.sin(an) * (pr + 14), 3.5, 0, TAU);
          g.fill();
        }
      },
    });
  }

  // ---- fly the icon to the tray
  function fly(it, key, done) {
    const cr = view.canvas.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const s = view.worldToScreen(it.c.x, it.c.y);
    const target = tileFor(key) || trayTitle;
    const tr = target.getBoundingClientRect();
    const x0 = cr.left - er.left + s.x, y0 = cr.top - er.top + s.y;
    const x1 = tr.left - er.left + tr.width / 2, y1 = tr.top - er.top + tr.height / 2 - (listMode === 'icons' ? 8 : 0);
    const size = clamp(it.s * view.z, 44, 96);
    const f = h('img', { class: 'g-findit-fly', src: goals[key].thumb, alt: '' });
    f.style.width = f.style.height = size + 'px';
    flyLayer.append(f);
    const mx = (x0 + x1) / 2 + (x0 < x1 ? -40 : 40), my = Math.min(y0, y1) - 70;
    const end = 40 / size;
    const anim = f.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(0.6)`, opacity: 0.4, offset: 0 },
        { transform: `translate(${x0}px, ${y0 - 18}px) translate(-50%, -50%) scale(1.25)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${mx}px, ${my}px) translate(-50%, -50%) scale(1.05) rotate(-10deg)`, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(${end})`, offset: 1 },
      ],
      { duration: 760, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      f.remove();
      if (!destroyed) done();
    };
  }

  // ---- input
  // A tap counts when it lands on (or close to) a visible part of an object
  // still to be found. Small objects get a more generous radius, but a tap
  // that is clearly on another object is a miss.
  function hitTest(wx, wy) {
    const z = view.z;
    let best = null, bestD = Infinity;
    for (const gl of goals) {
      if (gl.found >= gl.need) continue;
      for (const it of gl.items) {
        if (it.found) continue;
        const d = distTo(it, wx, wy);
        if (d === 0) return { it, gl };
        const tol = (it.s * z < 34 ? 22 : 13) / z;
        if (d < tol && d < bestD) {
          bestD = d;
          best = { it, gl };
        }
      }
    }
    if (!best) return null;
    for (const other of scene.data.items) {
      if (other.k !== best.gl.k && other.n > 400 && insideAny(other, wx, wy)) return null;
    }
    return best;
  }

  function onTap(wx, wy) {
    closePopover();
    if (finished || paused || !scene) return true;
    const hit = hitTest(wx, wy);
    if (!hit) {
      // tapping something already found is harmless
      if (marks.some((m) => insideAny(m.it, wx, wy))) {
        sfx.play('tap');
        return true;
      }
      return false;
    }
    found(hit.it, goals.indexOf(hit.gl));
    return true;
  }

  function found(it, key) {
    progressed();
    const gl = goals[key];
    gl.found++;
    it.found = true;
    marks.push({ it, t0: performance.now() });
    sfx.play('pop');
    sfx.vibrate(22);
    sparkleFx(it);
    view.request();
    if (gl.need > 1 && gl.found < gl.need && !app.seen('twin')) {
      app.markSeen('twin');
      ctx.ui.toast(t('findTwin'));
    }
    later(() => {
      fly(it, key, () => {
        gl.shown++;
        sfx.tone({ freq: 880, to: 1320, dur: 0.12, type: 'triangle', vol: 0.3 });
        tickTile(key);
        checkDone();
      });
    }, 220);
  }

  function onMiss(wx, wy) {
    if (finished || paused) return;
    stats.misses++;
    clock.penalty += PENALTY;
    missFx(wx, wy, true);
    sfx.play('error');
    sfx.vibrate([30, 40, 30]);
    sceneEl.classList.remove('g-findit-shake');
    void sceneEl.offsetWidth;
    sceneEl.classList.add('g-findit-shake');
    const tnow = performance.now();
    stats.recentMisses = stats.recentMisses.filter((x) => tnow - x < 2600);
    stats.recentMisses.push(tnow);
    if (stats.recentMisses.length >= 3) {
      stats.recentMisses = [];
      view.locked = true;
      sceneEl.classList.add('g-findit-locked');
      ctx.ui.toast(t('slowDown'));
      later(() => {
        view.locked = false;
        sceneEl.classList.remove('g-findit-locked');
      }, 1600);
    }
    updateInfo();
  }

  // ---- hints
  function hintTarget(key) {
    const open = goals.map((g, i) => i).filter((i) => goals[i].found < goals[i].need);
    if (!open.length) return null;
    let keys = key !== undefined && open.includes(key) ? [key] : open.filter((i) => slots.some((s) => s.key === i));
    if (!keys.length) keys = open;
    // the most visible copy of the nearest wanted object
    const c = view.center();
    let best = null, bestS = -Infinity;
    for (const k of keys) {
      for (const it of goals[k].items) {
        if (it.found || it.n < 120) continue;
        const sc = Math.log(it.n) * 600 + (it.t ? 800 : 0) - Math.hypot(it.c.x - c.x, it.c.y - c.y);
        if (sc > bestS) {
          bestS = sc;
          best = it;
        }
      }
    }
    return best;
  }

  async function useHint(key) {
    if (finished || !view) return;
    if (app.state.hints <= 0) {
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
    const it = hintTarget(key);
    if (!it) return;
    stats.hints++;
    sfx.play('whoosh');
    const want = clamp(Math.min(view.w, view.h) * 0.22 / Math.max(20, it.s), view.minZ * 1.4, view.maxZ * 0.75);
    const z = clamp(Math.max(view.z, want), view.minZ, view.maxZ);
    view.flyTo(it.c.x, it.c.y, z, 600, () => {
      if (destroyed) return;
      sfx.play('select');
      if (spec.scene.kind === 'outdoor') spotFx(it);
      else lensFx(it);
    });
  }

  function confirmBuy() {
    return new Promise((resolve) => {
      pauseClock();
      openSheet = sheet(app, {
        icon: ICON.lens,
        title: t('noHints'),
        body: h('p', { class: 'g-findit-sheet-text' }, t('buyHintText', { price: HINT_PRICE })),
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
    if (scene && !finished && !document.hidden) clockStart();
  }
  function openPause() {
    if (finished || openSheet || !scene) return;
    sfx.play('tap');
    closePopover();
    pauseClock();
    const body = h(
      'div',
      { class: 'g-findit-pause-stats' },
      h('div', null, h('span', { html: ICON.clock }), fmtTime(elapsed())),
      h('div', null, h('span', { html: ICON.target }), trayInfo.textContent.split('·')[0].trim()),
    );
    const hintLabel = app.state.hints > 0 ? `${t('hint')} · ${app.state.hints}` : `${t('hint')} · ${HINT_PRICE}`;
    const actions = [
      { label: t('resume'), primary: true, onclick: () => {} },
      { label: [h('span', { class: 'g-findit-btn-ico', html: ICON.lens }), hintLabel], onclick: () => later(() => useHint(), 260) },
      { label: t('restart'), onclick: () => app.restart(spec) },
      spec.map ? { label: t('toMap'), onclick: () => app.showMap(spec.modeId) } : { label: t('quit'), onclick: () => ctx.exit() },
    ];
    openSheet = sheet(app, {
      kind: 'pause',
      icon: ICON.pause,
      title: t('paused'),
      subtitle: `${spec.title} · ${spec.subtitle}`,
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
    if (!goals.every((g) => g.shown >= g.need)) return;
    finished = true;
    clockStop();
    const ms = elapsed();
    later(() => app.complete(spec, { ms, misses: stats.misses, hints: stats.hints, found: goals.map((g) => g.k) }), 650);
  }

  // ---- lifecycle
  const onVis = () => {
    if (document.hidden) clockStop();
    else if (!paused && scene && !finished) clockStart();
  };
  document.addEventListener('visibilitychange', onVis);
  let lastProgress = performance.now();
  let nudged = false;
  const infoTimer = setInterval(() => {
    if (destroyed || !scene) return;
    updateInfo();
    if (!nudged && !finished && !paused && !openSheet && performance.now() - lastProgress > 45000) {
      nudged = true;
      coach.textContent = t('idleHint');
      coach.classList.remove('hide');
      coach.classList.add('show');
      const first = tiles.querySelector('.g-findit-tile:not(.done), .g-findit-word:not(.done)');
      if (first) first.classList.add('g-findit-nudge');
      later(() => coach.classList.add('hide'), 6000);
    }
  }, 500);
  const progressed = () => {
    lastProgress = performance.now();
    nudged = false;
    for (const n of tiles.querySelectorAll('.g-findit-nudge')) n.classList.remove('g-findit-nudge');
  };

  function debugHook() {
    if (!window.__FINDIT_TEST__) return;
    const toClient = (x, y) => {
      const r = view.canvas.getBoundingClientRect();
      const s = view.worldToScreen(x, y);
      return { x: r.left + s.x, y: r.top + s.y };
    };
    window.__finditDebug = {
      spec: { modeId: spec.modeId, n: spec.n, scene: spec.scene.id, kind, d: spec.d, count: spec.count },
      goals: () => goals.map((g) => ({ k: g.k, name: g.name, need: g.need, found: g.found, shown: g.shown, thumb: g.thumb })),
      // one point per still-missing object (inside its outline), in world and client coords
      targets: () =>
        goals.flatMap((g) =>
          g.found >= g.need ? [] : g.items.filter((it) => !it.found).sort((a, b) => b.n - a.n).slice(0, g.need - g.found).map((it) => ({ k: g.k, x: it.c.x, y: it.c.y, s: it.s, n: it.n, client: toClient(it.c.x, it.c.y) })),
        ),
      misses: () => {
        // a point on the photo that is not on any target name
        const keys = new Set(goals.map((g) => g.k));
        const it = scene.data.items.find((o) => !keys.has(o.k) && o.n > 3000);
        return it ? { x: it.c.x, y: it.c.y, client: toClient(it.c.x, it.c.y) } : null;
      },
      view: () => ({ z: view.z, minZ: view.minZ, maxZ: view.maxZ, w: view.w, h: view.h, W: scene.data.w, H: scene.data.h }),
      toClient,
      centerOn: (x, y, z) => {
        view.anim = null;
        view.inertia = null;
        view.z = clamp(z || view.z, view.minZ, view.maxZ);
        view.centerOn(x, y);
        view.request();
      },
      hint: (k) => useHint(k),
      hitAt: (x, y) => {
        const r = hitTest(x, y);
        const inside = scene.data.items.filter((o) => insideAny(o, x, y)).map((o) => [o.k, o.n]);
        return { hit: r && r.gl.k, inside };
      },
      elapsed,
      state: () => ({ ...app.state }),
    };
  }

  // ---- build the level
  (async () => {
    await nextFrame();
    if (destroyed) return;
    scene = await loadScene(spec.scene);
    if (destroyed) return;
    const rnd = rng(spec.seed);
    goals = pickGoals(scene.data, { count: spec.count, need: kind === 'match' ? 2 : 1, d: spec.d, rnd, avoid: new Set(spec.avoid || []), lang: ctx.lang });
    for (const it of scene.data.items) it.found = false;
    view = new SceneView(canvasHost, {
      onTap,
      onMiss,
      onZoom: (r) => {
        if (r > 1.25) coach.classList.add('hide');
      },
      onPan: () => closePopover(),
    });
    view.setScene({ W: scene.data.w, H: scene.data.h, img: scene.img, edge: '#0a0a0c', drawOver, animating, startX: scene.data.w * (spec.startX ?? 0.5) });
    debugHook();
    buildTray();
    const c = view.center();
    view.z = view.minZ * 1.15;
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
    if (destroyed) return;
    console.error(e);
    loader.textContent = t('loadError');
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
      if (window.__finditDebug) delete window.__finditDebug;
    },
  };
}
