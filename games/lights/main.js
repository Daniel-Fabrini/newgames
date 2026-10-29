// Light Echo — shell entry. Modes: 'classic' | 'fast' | 'expert' (no mode → options overlay).
// Pure rules live in logic.js; this file draws the glowing pads and runs the show/repeat loop.
import STRINGS from './strings.js';
import { MODES, createRun, timing } from './logic.js';

const PALETTE = {
  green: { c: '#35f07a', d: '#0e5a2c' },
  red: { c: '#ff4d5e', d: '#6b1620' },
  yellow: { c: '#ffd23a', d: '#6b5410' },
  blue: { c: '#4d8dff', d: '#17316b' },
  purple: { c: '#b46bff', d: '#431c70' },
  cyan: { c: '#3be3ff', d: '#0f5560' },
};
const LAYOUT = {
  4: ['green', 'red', 'yellow', 'blue'],
  6: ['green', 'yellow', 'red', 'purple', 'blue', 'cyan'],
};
const FREQ = {
  4: [261.63, 329.63, 392.0, 523.25],
  6: [220.0, 261.63, 329.63, 392.0, 440.0, 523.25],
};
const NS = 'http://www.w3.org/2000/svg';

function sectorPath(i, n) {
  const start = n === 4 ? 180 : 240;
  const span = 360 / n;
  const a0 = ((start + i * span) * Math.PI) / 180;
  const a1 = ((start + (i + 1) * span) * Math.PI) / 180;
  const R = 187;
  const r = 69;
  const half = 9; // half of the angular gap in svg units (stroke adds the rest)
  const P = (rad, a) => `${(200 + rad * Math.cos(a)).toFixed(2)} ${(200 + rad * Math.sin(a)).toFixed(2)}`;
  const dO = half / R;
  const dI = half / r;
  return `M ${P(R, a0 + dO)} A ${R} ${R} 0 0 1 ${P(R, a1 - dO)} L ${P(r, a1 - dI)} A ${r} ${r} 0 0 0 ${P(r, a0 + dI)} Z`;
}

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const { h } = ctx.ui;
  const store = ctx.store;
  const safe = (fn, d) => {
    try {
      return fn();
    } catch {
      return d;
    }
  };
  const tone = (o) => ctx.sfx.tone(o);
  const noise = (o) => ctx.sfx.noise(o);
  const vib = (p) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    ctx.sfx.vibrate(p);
  };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let alive = true;
  let timers = [];
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers = timers.filter((x) => x !== id);
      if (alive) fn();
    }, ms);
    timers.push(id);
    return id;
  };
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const saved = safe(() => store.get('cfg', null), null) || {};
  const cfg = { mode: MODES[saved.mode] ? saved.mode : 'classic', strict: !!saved.strict };
  if (MODES[ctx.mode]) cfg.mode = ctx.mode;
  const saveCfg = () => safe(() => store.set('cfg', cfg));
  const getBest = () => safe(() => store.get('best', {}), {}) || {};
  const bestKey = () => `${cfg.mode}:${cfg.strict ? 's' : 'r'}`;

  let run = null;
  let state = 'idle'; // idle | show | input | between | over
  let overlay = null;
  let pads = [];
  let nPads = MODES[cfg.mode].pads;
  const held = new Set();

  // ---- header sound toggle
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

  // ---- DOM
  const pill = (label) => {
    const b = h('b', null, '0');
    return { el: h('div', { class: 'g-lights-pill' }, h('small', null, label), b), b };
  };
  const pScore = pill(t('score'));
  const pStreak = pill(t('streak'));
  const pBest = pill(t('best'));
  const lives = h('div', { class: 'g-lights-lives', 'aria-live': 'polite' });
  const hubLbl = h('small', null, t('round'));
  const hubNum = h('b', null, '1');
  const hubSub = h('small', { style: 'opacity:.7' }, '');
  const hub = h('div', { class: 'g-lights-hub' }, hubLbl, hubNum, hubSub);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 400');
  const board = h('div', { class: 'g-lights-board locked', role: 'group', 'aria-label': t('board') }, svg, hub);
  const status = h('div', { class: 'g-lights-status', role: 'status', 'aria-live': 'polite' }, '');
  const keyHint = h('span', null, '');
  const restartBtn = h('button', { class: 'icon-btn', 'aria-label': t('restart'), onclick: () => openOptions() }, '↺');
  const view = h(
    'div',
    { class: 'g-lights-view' },
    h('div', { class: 'g-lights-hud' }, pScore.el, pStreak.el, pBest.el),
    lives,
    h('div', { class: 'g-lights-stagewrap' }, board),
    status,
    h('div', { class: 'g-lights-foot' }, restartBtn, keyHint),
  );
  root.append(view);

  function buildPads() {
    nPads = MODES[cfg.mode].pads;
    svg.replaceChildren();
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<linearGradient id="g-lights-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>';
    svg.append(defs);
    pads = [];
    for (let i = 0; i < nPads; i++) {
      const name = LAYOUT[nPads][i];
      const pal = PALETTE[name];
      const d = sectorPath(i, nPads);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', 'g-lights-pad');
      p.setAttribute('style', `--c:${pal.c};--d:${pal.d}`);
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', t('pad', { c: t('c_' + name) }));
      p.dataset.i = i;
      const gl = document.createElementNS(NS, 'path');
      gl.setAttribute('d', d);
      gl.setAttribute('class', 'g-lights-gloss');
      svg.append(p);
      svg.append(gl);
      pads.push(p);
    }
    keyHint.textContent = t('keys', { n: nPads });
  }
  buildPads();

  function layout() {
    const w = root.clientWidth;
    const hh = root.clientHeight;
    const size = Math.max(220, Math.min(w - 30, hh - 250, 440));
    board.style.setProperty('--gl-size', size + 'px');
  }
  layout();
  window.addEventListener('resize', layout);

  // ---- helpers
  const popEl = (el) => {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  };
  const setStatus = (txt, cls = '') => {
    status.textContent = txt;
    status.className = 'g-lights-status ' + cls;
  };
  function hud() {
    pScore.b.textContent = run ? run.score : 0;
    pStreak.b.textContent = run ? run.streak : 0;
    const b = getBest()[bestKey()];
    pBest.b.textContent = b ? b.round : 0;
    hubNum.textContent = run ? run.round : 1;
    hubSub.textContent = run && state === 'input' ? `${run.idx}/${run.round}` : '';
    lives.replaceChildren();
    if (!cfg.strict) {
      for (let i = 0; i < 3; i++) {
        const lost = run ? i >= run.lives : false;
        lives.append(h('span', { class: lost ? 'lost' : '', 'aria-hidden': 'true' }, '❤️'));
      }
      lives.setAttribute('aria-label', t('lives', { n: run ? run.lives : 3 }));
    }
  }
  const lock = (on) => board.classList.toggle('locked', on);

  function lightOn(i, dur) {
    pads[i].classList.add('lit');
    const f = FREQ[nPads][i];
    tone({ freq: f, dur: Math.max(0.16, dur), type: 'sine', vol: 0.34 });
    tone({ freq: f * 2, dur: Math.max(0.12, dur * 0.7), type: 'triangle', vol: 0.07 });
  }
  const lightOff = (i) => pads[i].classList.remove('lit');
  function flash(i, ms) {
    lightOn(i, ms / 1000 + 0.04);
    later(() => lightOff(i), ms);
  }

  // ---- flow
  function begin() {
    clearTimers();
    closeOverlay();
    safe(() => store.update('stats', (s) => ({ ...s, plays: (s.plays || 0) + 1 }), {}));
    run = createRun({ mode: cfg.mode, strict: cfg.strict, seed: (Math.random() * 4294967296) >>> 0 });
    state = 'between';
    pads.forEach((p) => p.classList.remove('lit'));
    board.classList.remove('dead');
    hud();
    setStatus(t('watch'));
    lock(true);
    later(playSequence, 700);
  }

  function playSequence() {
    if (!run || run.status !== 'playing') return;
    state = 'show';
    lock(true);
    held.clear();
    const { on, gap } = run.timing();
    const seq = run.seq();
    setStatus(t('watch'));
    hubSub.textContent = '';
    seq.forEach((p, k) => {
      const at = k * (on + gap);
      later(() => lightOn(p, on / 1000), at);
      later(() => lightOff(p), at + on);
    });
    later(() => {
      state = 'input';
      lock(false);
      setStatus(t('yourTurn'), 'good');
      hud();
      vib(12);
    }, seq.length * (on + gap) + 120);
  }

  function press(i) {
    if (state !== 'input' || !run) return;
    const { on } = run.timing();
    const r = run.press(i);
    lightOn(i, 0.28);
    vib(14);
    if (r.result === 'ok') {
      hud();
      return;
    }
    if (r.result === 'round') {
      state = 'between';
      lock(true);
      const prevStep = timing(run.mode, run.round - 1).step;
      const faster = run.timing().step > prevStep;
      popEl(pScore.b);
      popEl(hubNum);
      hud();
      setStatus(faster ? `${t('great')} ${t('speedUp')}` : t('great'), 'good');
      later(() => cascade(), 260);
      later(playSequence, 1250);
      return;
    }
    if (r.result === 'retry') {
      state = 'between';
      lock(true);
      wrong();
      hud();
      setStatus(t('oops'), 'bad');
      later(playSequence, 1500);
      return;
    }
    // over
    state = 'between';
    lock(true);
    wrong();
    hud();
    later(gameOver, 250);
  }

  function release(i) {
    lightOff(i);
  }

  function wrong() {
    tone({ freq: 118, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.3 });
    noise({ dur: 0.25, vol: 0.12, freq: 400, q: 0.5 });
    vib([60, 40, 120]);
    if (!reduced) {
      board.classList.remove('shake');
      void board.offsetWidth;
      board.classList.add('shake');
    }
  }

  function cascade() {
    const n = nPads;
    for (let k = 0; k < n; k++) {
      const p = k;
      later(() => {
        pads[p].classList.add('lit');
        tone({ freq: FREQ[n][k] * 2, dur: 0.1, type: 'triangle', vol: 0.12 });
      }, k * 55);
      later(() => lightOff(p), k * 55 + 130);
    }
  }

  function gameOver() {
    state = 'over';
    const completed = run.completed;
    pads.forEach((p) => p.classList.remove('lit'));
    board.classList.remove('dead');
    void board.offsetWidth;
    if (!reduced) board.classList.add('dead');
    setStatus(t('over'), 'bad');
    ctx.sfx.play('lose');
    // records
    const best = getBest();
    const key = bestKey();
    const prev = best[key];
    const newRec = completed > 0 && (!prev || completed > prev.round || (completed === prev.round && run.score > prev.score));
    if (newRec) {
      best[key] = { round: completed, score: run.score };
      safe(() => store.set('best', best));
    }
    safe(() => store.update('stats', (s) => ({ ...s, bestRound: Math.max(s.bestRound || 0, completed) }), {}));
    ctx.addXP?.(Math.max(1, Math.min(60, 3 + completed * 2)));
    hud();
    later(() => showOverlay('over', { completed, score: run.score, newRec }), reduced ? 200 : 1100);
  }

  // ---- overlay
  function closeOverlay() {
    overlay?.remove();
    overlay = null;
  }
  function openOptions() {
    clearTimers();
    state = 'idle';
    lock(true);
    pads.forEach((p) => p.classList.remove('lit'));
    board.classList.remove('dead');
    setStatus('');
    showOverlay('start', {});
  }
  function showOverlay(kind, info) {
    closeOverlay();
    const best = getBest()[bestKey()];
    const chip = (on, title, sub, onclick) => h('button', { class: 'g-lights-opt' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick }, h('b', null, title), h('span', null, sub));
    const rebuild = () => showOverlay(kind, info);
    const modes = h(
      'div',
      { class: 'g-lights-opts c3' },
      ...['classic', 'fast', 'expert'].map((m) =>
        chip(cfg.mode === m, t(m), t(m + 'Sub'), () => {
          cfg.mode = m;
          saveCfg();
          buildPads();
          hud();
          rebuild();
        }),
      ),
    );
    const styles = h(
      'div',
      { class: 'g-lights-opts c2' },
      ...[false, true].map((s) =>
        chip(cfg.strict === s, t(s ? 'strict' : 'relaxed'), t(s ? 'strictSub' : 'relaxedSub'), () => {
          cfg.strict = s;
          saveCfg();
          hud();
          rebuild();
        }),
      ),
    );
    let head;
    if (kind === 'over') {
      const n = info.completed;
      head = [
        h('h3', null, t('over')),
        h('p', null, n === 0 ? t('reachedZero') : n === 1 ? t('reachedOne') : t('reached', { n })),
        h('p', null, t('pts', { n: info.score })),
        info.newRec ? h('p', { class: 'rec' }, '🏆 ' + t('newRecord')) : best ? h('p', null, t('bestRounds', { n: best.round })) : null,
      ];
    } else {
      head = [h('h3', null, ctx.pick({ pt: 'Siga as Luzes', en: 'Light Echo', es: 'Sigue las Luces' })), h('p', null, best ? t('bestRounds', { n: best.round }) : t('noBest'))];
    }
    const startBtn = h('button', { class: 'btn primary big block', onclick: () => begin() }, kind === 'over' ? t('again') : t('start'));
    overlay = h(
      'div',
      { class: 'g-lights-ov', role: 'dialog' },
      h('div', { class: 'g-lights-card' }, ...head, h('div', { class: 'lbl' }, t('modeLabel')), modes, h('div', { class: 'lbl' }, t('styleLabel')), styles, startBtn),
    );
    view.append(overlay);
    startBtn.focus?.({ preventScroll: true });
  }

  // ---- input
  function padFrom(e) {
    const el = e.target?.closest?.('.g-lights-pad');
    return el ? +el.dataset.i : -1;
  }
  const active = new Map(); // pointerId -> pad
  svg.addEventListener('pointerdown', (e) => {
    const i = padFrom(e);
    if (i < 0) return;
    e.preventDefault();
    if (state !== 'input') {
      if (state === 'show' || state === 'between') {
        vib(8);
      }
      return;
    }
    active.set(e.pointerId, i);
    press(i);
  });
  const up = (e) => {
    const i = active.get(e.pointerId);
    if (i === undefined) return;
    active.delete(e.pointerId);
    later(() => release(i), 90);
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('pointerleave', up);
  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  const keysDown = new Set();
  const onKeyDown = (e) => {
    if (overlay || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= nPads) {
      keysDown.add(e.key);
      press(n - 1);
      e.preventDefault();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target?.classList?.contains('g-lights-pad')) {
      keysDown.add(e.key);
      press(+e.target.dataset.i);
      e.preventDefault();
    }
  };
  const onKeyUp = (e) => {
    if (!keysDown.has(e.key)) return;
    keysDown.delete(e.key);
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= nPads) later(() => release(n - 1), 90);
    else if (e.target?.dataset?.i !== undefined) later(() => release(+e.target.dataset.i), 90);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  ctx.onBack(() => {
    if (!overlay && (state === 'show' || state === 'input' || state === 'between')) {
      openOptions();
      return true;
    }
    return false;
  });

  hud();
  if (MODES[ctx.mode]) {
    setStatus(t('watch'));
    later(begin, 500);
  } else {
    showOverlay('start', {});
  }

  return () => {
    alive = false;
    clearTimers();
    window.removeEventListener('resize', layout);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    ctx.setHeaderRight?.(null);
  };
}
