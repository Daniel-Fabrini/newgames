// Quiz session engine: HUD panel (exit/skip arrows, progress, lives or timer),
// scoring with combo multipliers, lives, spaced-repetition updates and the
// question renderers (multiple choice, "which flag?", spelling, typing,
// matching). Each game mode is a small config object (see main.js).

import { h, clear, rng } from '../../js/core/ui.js';
import { makeOptions, answerText } from './data.js';
import { MASTERED_BOX } from './progress.js';
import { flagCard, lives as livesWidget, floatText, makeScope, restartAnim } from './widgets.js';
import { renderSpell, renderType } from './spell.js';
import { renderMatch } from './match.js';

export const multOf = (streak) => (streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1);
const COMBO_STEPS = new Set([5, 10, 20]);

const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const ICON_SKIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l6 6-6 6M13 6l6 6-6 6"/></svg>';

/*
cfg = {
  lives: 3 | 0,            // 0 = no lives
  regen: 10,               // a streak of this length gives a life back
  timeLimit: 0 | ms,       // time attack
  countdown: bool,         // 3-2-1 before the first question
  speed: 1,                // multiplies feedback delays
  init: { …stats },        // resume a saved run
  next(st) → question | null
  answered(q, ok, st)      // once per answered question (per pair in match)
  skip(q, st)              // the player skipped q (move it to the end…)
  progress(st) → { frac, text, label }
  save?(st)
  exit()                   // HUD back arrow
  end(st, reason)          // 'done' | 'dead' | 'time'
}
question = { c, kind: 'flags'|'caps', qt: 'mc'|'rev'|'spell'|'type'|'match', n, seed?, cs? }
*/
export function playSession(app, view, scope, cfg) {
  const { t, sfx, P, lang } = app;
  const maxLives = cfg.lives || 0;
  const st = Object.assign({ correct: 0, mistakes: 0, streak: 0, lives: maxLives, xp: 0, maxCombo: 0, skips: 0 }, cfg.init || {});
  let ended = false;
  let timeUp = false;
  let paused = false;
  let qscope = null;
  let cur = null; // current question
  let timeLeft = cfg.timeLimit || 0;
  let nextTimer = null;

  // ---------- HUD ----------
  const backBtn = h('button', { class: 'g-flags-hbtn', 'aria-label': t('exit'), title: t('exit'), html: ICON_BACK, onclick: () => cfg.exit() });
  const skipBtn = h('button', { class: 'g-flags-hbtn', 'aria-label': t('skip'), title: t('skip'), html: ICON_SKIP, onclick: () => skip() });
  const counter = h('b', { class: 'g-flags-counter' });
  const sublabel = h('small', { class: 'g-flags-sublabel' });
  const right = maxLives ? livesWidget() : h('div', { class: 'g-flags-score' });
  const line = h('i');
  const hud = h(
    'div',
    { class: 'g-flags-hud' },
    h('div', { class: 'g-flags-navpill' }, backBtn, skipBtn),
    h('div', { class: 'g-flags-hcenter' }, counter, sublabel),
    h('div', { class: 'g-flags-hright' }, right),
    h('div', { class: `g-flags-hline ${cfg.timeLimit ? 'timer' : ''}` }, line),
  );
  const body = h('div', { class: 'g-flags-body' });
  const fx = h('div', { class: 'g-flags-fx' });
  view.append(hud, body, fx);

  let comboEl = null;
  let lastSec = -1;
  function updateHud() {
    if (maxLives) right.set(st.lives, t('livesLeft', { n: st.lives }));
    else right.textContent = '✓ ' + st.correct;
    if (cfg.timeLimit) {
      const sec = Math.max(0, Math.ceil(timeLeft / 1000));
      if (sec !== lastSec) {
        lastSec = sec;
        counter.textContent = `0:${String(sec).padStart(2, '0')}`;
        hud.classList.toggle('g-flags-hurry', sec <= 10);
      }
      line.style.width = (Math.max(0, timeLeft) / cfg.timeLimit) * 100 + '%';
    } else {
      const p = cfg.progress(st);
      line.style.width = Math.round(Math.min(1, p.frac) * 100) + '%';
      counter.textContent = p.text;
      sublabel.textContent = p.label || '';
    }
    if (comboEl) {
      const m = multOf(st.streak);
      comboEl.classList.toggle('show', st.streak >= 2);
      comboEl.classList.toggle('hot', m >= 2);
      comboEl.textContent = st.streak >= 2 ? `🔥${st.streak}${m > 1 ? ` ×${m}` : ''}` : '';
    }
  }

  function burst(text, cls = '') {
    const el = h('div', { class: `g-flags-burst ${cls}` }, text);
    fx.append(el);
    scope.timeout(() => el.remove(), 1300);
  }

  // ---------- scoring ----------
  function good(kind, c) {
    st.correct++;
    st.streak++;
    st.maxCombo = Math.max(st.maxCombo, st.streak);
    const m = multOf(st.streak);
    st.xp += m;
    const r = P.answer(kind, c.code, true);
    sfx.play('success');
    sfx.vibrate(18);
    floatText(scope, fx, `+${m} XP`, 'xp');
    if (COMBO_STEPS.has(st.streak)) {
      burst(t('combo', { m }), 'combo');
      [0, 0.07, 0.14].forEach((d, i) => sfx.tone({ freq: 660 * Math.pow(1.26, i), dur: 0.12, type: 'triangle', vol: 0.25, delay: d + 0.15 }));
      if (comboEl) restartAnim(comboEl, 'g-flags-combo-pop');
    }
    if (r.up && r.box === MASTERED_BOX) floatText(scope, fx, '👑 ' + t('masteredNow'), 'mastered');
    if (maxLives && cfg.regen && st.streak % cfg.regen === 0 && st.lives < maxLives) {
      st.lives++;
      scope.timeout(() => sfx.play('coin'), 250);
      floatText(scope, fx, t('lifeBack'), 'life');
    }
    updateHud();
  }

  // Returns true when the player just lost the last life.
  function bad(kind, c, { mastery = true } = {}) {
    st.mistakes++;
    st.streak = 0;
    if (mastery) P.answer(kind, c.code, false);
    if (maxLives) st.lives = Math.max(0, st.lives - 1);
    sfx.play('error');
    sfx.vibrate([60, 40, 80]);
    restartAnim(view, 'g-flags-hit');
    updateHud();
    return !!maxLives && st.lives === 0;
  }

  function answered(q, ok) {
    if (q === cur) cur.done = true;
    cfg.answered(q, ok, st);
    if (cfg.save) cfg.save(st);
    updateHud();
  }

  function next(delay) {
    if (cur) cur.done = true;
    if (nextTimer) scope.clear(nextTimer);
    nextTimer = scope.timeout(showNext, delay * (cfg.speed || 1));
  }

  function skip() {
    if (!cur || cur.done || ended || timeUp) return;
    cur.done = true;
    st.streak = 0;
    st.skips++;
    sfx.play('whoosh');
    cfg.skip(cur, st);
    if (cfg.save) cfg.save(st);
    body.classList.add('g-flags-skipout');
    if (nextTimer) scope.clear(nextTimer);
    nextTimer = scope.timeout(showNext, 180);
  }

  // Big gold-framed flag (+ combo sticker) used by most question types.
  function prompt(q, labelKey = null) {
    comboEl = h('div', { class: 'g-flags-combo' });
    return [
      labelKey ? h('div', { class: 'g-flags-qlabel' }, t(labelKey)) : null,
      h('div', { class: 'g-flags-stage' }, h('div', { class: 'g-flags-cardin' }, flagCard(q.c), comboEl)),
      q.kind === 'caps' ? h('div', { class: 'g-flags-caption' }, q.c.name[lang]) : null,
    ].filter(Boolean);
  }

  const api = {
    t,
    sfx,
    lang,
    P,
    st,
    good,
    bad,
    answered,
    next,
    prompt,
    burst,
    get qscope() {
      return qscope;
    },
    get timeUp() {
      return timeUp;
    },
  };

  function showNext() {
    nextTimer = null;
    if (ended || timeUp) return;
    if (maxLives && st.lives <= 0) return end('dead');
    const q = cfg.next(st);
    if (!q) return end('done');
    if (qscope) qscope.dispose();
    qscope = makeScope();
    cur = q;
    comboEl = null;
    clear(body);
    body.classList.remove('g-flags-skipout');
    const wrap = h('div', { class: `g-flags-q g-flags-q-${q.qt} ${q.n > 4 ? 'g-flags-many' : ''}` });
    body.append(wrap);
    RENDER[q.qt](api, q, wrap);
    skipBtn.disabled = false;
    updateHud();
  }

  function end(reason) {
    if (ended) return;
    ended = true;
    if (qscope) qscope.dispose();
    cfg.end(st, reason);
  }
  scope.defer(() => qscope && qscope.dispose());

  // ---------- timer (time attack) ----------
  function startTimer() {
    let last = performance.now();
    const tick = (now) => {
      if (ended) return;
      const dt = Math.min(100, now - last);
      last = now;
      if (!paused) timeLeft -= dt;
      const sec = Math.ceil(timeLeft / 1000);
      if (sec !== lastSec && sec <= 5 && sec > 0) sfx.tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.12 });
      if (timeLeft <= 0) {
        timeLeft = 0;
        timeUp = true;
        updateHud();
        body.classList.add('g-flags-locked');
        sfx.play('whistle');
        burst(t('timeUp'), 'timeup');
        scope.timeout(() => end('time'), 1100);
        return;
      }
      updateHud();
      scope.raf(tick);
    };
    scope.raf(tick);
  }

  function countdown(done) {
    const ov = h('div', { class: 'g-flags-countdown' });
    view.append(ov);
    const steps = ['3', '2', '1', t('go')];
    let i = 0;
    const step = () => {
      if (i >= steps.length) {
        ov.remove();
        done();
        return;
      }
      clear(ov).append(h('span', { class: 'g-flags-cd' }, steps[i]));
      sfx.tone({ freq: i < 3 ? 523 : 1046, dur: i < 3 ? 0.1 : 0.25, type: 'triangle', vol: 0.3 });
      i++;
      scope.timeout(step, i === steps.length ? 500 : 700);
    };
    step();
  }

  updateHud();
  const start = () => {
    showNext();
    if (cfg.timeLimit) startTimer();
  };
  if (cfg.countdown) countdown(start);
  else start();

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
  };
}

// ---------- renderers ----------

function keyIndex(e, n) {
  if (e.ctrlKey || e.metaKey || e.altKey) return -1;
  const k = e.key.toLowerCase();
  let i = '123456'.indexOf(k);
  if (i < 0) i = 'abcdef'.indexOf(k);
  return i >= 0 && i < n ? i : -1;
}

// Multiple choice: big flag, options in a 2-column grid. The tapped option
// fills gold for a moment, then turns green (right) or red (wrong).
function renderChoice(api, q, wrap) {
  const { lang } = api;
  const opts = makeOptions(q.c, q.kind, q.n, lang, q.seed ? rng(q.seed) : Math.random);
  wrap.append(...api.prompt(q, q.kind === 'caps' ? 'qCapital' : null));
  const grid = h('div', { class: 'g-flags-answers' });
  let locked = false;
  const btns = opts.map((c, i) => {
    const b = h('button', { class: 'answer-btn g-flags-ans', style: { animationDelay: 60 + i * 50 + 'ms' } }, h('span', null, answerText(c, q.kind, lang)));
    b.addEventListener('click', () => choose(b, c));
    grid.append(b);
    return b;
  });
  wrap.append(grid);

  function choose(b, c) {
    if (locked || api.timeUp) return;
    locked = true;
    grid.classList.add('g-flags-locked');
    b.classList.add('selected');
    api.sfx.play('tap');
    const ok = c === q.c;
    api.qscope.timeout(() => {
      const right = btns[opts.indexOf(q.c)];
      b.classList.remove('selected');
      if (ok) {
        b.classList.add('correct', 'g-flags-bump');
        api.good(q.kind, q.c);
      } else {
        b.classList.add('wrong', 'shake');
        right.classList.add('correct', 'g-flags-reveal');
        api.bad(q.kind, q.c);
      }
      btns.forEach((x) => x !== b && x !== right && x.classList.add('dim'));
      api.answered(q, ok);
    }, 260);
    api.next(ok ? 1050 : 1900);
  }

  api.qscope.on(window, 'keydown', (e) => {
    const i = keyIndex(e, btns.length);
    if (i >= 0) choose(btns[i], opts[i]);
  });
}

// "Which one is the flag of X?": four flags in a 2×2 grid.
function renderReverse(api, q, wrap) {
  const { t, lang } = api;
  const opts = makeOptions(q.c, 'flags', q.n || 4, lang, q.seed ? rng(q.seed) : Math.random);
  wrap.append(h('div', { class: 'g-flags-qlabel' }, t('qWhichFlag')), h('div', { class: 'g-flags-bigname' }, q.c.name[lang]));
  const grid = h('div', { class: 'g-flags-flaggrid' });
  let locked = false;
  const btns = opts.map((c, i) => {
    const b = h('button', { class: 'g-flags-flagopt', style: { animationDelay: 60 + i * 60 + 'ms' }, 'aria-label': String(i + 1) }, flagCard(c, { wave: false }), h('span', { class: 'g-flags-flagname' }, c.name[lang]));
    b.addEventListener('click', () => choose(b, c));
    grid.append(b);
    return b;
  });
  wrap.append(grid);

  function choose(b, c) {
    if (locked || api.timeUp) return;
    locked = true;
    grid.classList.add('g-flags-locked');
    b.classList.add('selected');
    api.sfx.play('tap');
    const ok = c === q.c;
    api.qscope.timeout(() => {
      const right = btns[opts.indexOf(q.c)];
      b.classList.remove('selected');
      grid.classList.add('g-flags-named');
      if (ok) {
        b.classList.add('correct', 'g-flags-bump');
        api.good('flags', q.c);
      } else {
        b.classList.add('wrong', 'shake');
        right.classList.add('correct');
        api.bad('flags', q.c);
      }
      btns.forEach((x) => x !== b && x !== right && x.classList.add('dim'));
      api.answered(q, ok);
    }, 260);
    api.next(ok ? 1150 : 2100);
  }

  api.qscope.on(window, 'keydown', (e) => {
    const i = keyIndex(e, btns.length);
    if (i >= 0) choose(btns[i], opts[i]);
  });
}

const RENDER = {
  mc: renderChoice,
  rev: renderReverse,
  spell: renderSpell,
  type: renderType,
  match: renderMatch,
};
