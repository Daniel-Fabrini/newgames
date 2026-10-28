// Lesson runner, story runner, result and streak screens.

import { shuffle } from '../../js/core/ui.js';
import { primary, display } from './corpus.js';
import { renderExercise, speakerButton, sentenceView } from './exercises.js';
import { wordsInExercise } from './lessons.js';
import { mascotSVG, ICON } from './art.js';
import { levelInfo, dayKey, addDays, MAX_HEARTS, REFILL_COST } from './progress.js';

const PRAISE = ['praise1', 'praise2', 'praise3', 'praise4', 'praise5', 'praise6'];

// Builds the env object exercises need.
function exerciseEnv(app, scope, extra) {
  const { h, t, speech, sfx, T, N } = app;
  return {
    h,
    t,
    T,
    N,
    speech,
    sfx,
    lex: app.lex,
    shuffle: (a) => shuffle(a),
    hint: app.hint,
    inlineName: app.inlineName,
    autoplay: app.S.P.settings.autoplay,
    finePointer: window.matchMedia && window.matchMedia('(pointer: fine)').matches,
    later: scope.later,
    fly: (from, to, label, done) => app.fly(from.getBoundingClientRect(), to, label, done),
    flyRect: (rect, to, label, done) => app.fly(rect, to, label, done),
    ...extra,
  };
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ===================================================================================
// Lesson
// opts: { mode: 'lesson'|'practice'|'endless'|'legend'|'test', exercises, more(), units, gen,
//         hearts: bool, xpBase, perfectBonus, gems, heartReward, maxMistakes, onComplete(result), onFail() }
// ===================================================================================
export function runLesson(app, opts) {
  const { h, t, S, sfx, speech, T } = app;
  const scope = app.screen('pg-lesson');
  const el = scope.el;
  const unitsById = new Map(opts.units.map((u) => [u.id, u]));
  const caps = app.caps();
  const endless = opts.mode === 'endless';
  const L = {
    queue: opts.exercises.map((ex, i) => ({ ...ex, uid: i })),
    pos: 0,
    total: opts.exercises.length,
    solved: new Set(),
    answered: 0,
    correct: 0,
    mistakes: 0,
    run: 0,
    bestRun: 0,
    start: Date.now(),
    nextUid: opts.exercises.length,
    feedback: false,
    finished: false,
  };
  let cur = null;
  let curEx = null;

  // ---------- layout ----------
  const closeBtn = h('button', { class: 'pg-x', 'aria-label': t('close'), html: ICON.close, onclick: () => quit() });
  const bar = h('i');
  const combo = h('div', { class: 'pg-combo' });
  const heartsEl = h('div', { class: 'pg-lhearts' });
  const counter = h('div', { class: 'pg-counter' });
  const head = h(
    'div',
    { class: 'pg-lhead' },
    closeBtn,
    endless ? counter : h('div', { class: 'pg-lprog' }, combo, h('div', { class: 'pg-bar' }, bar)),
    heartsEl,
  );
  const body = h('div', { class: 'pg-lbody' });
  const extrasEl = h('div', { class: 'pg-extras' });
  const checkBtn = h('button', { class: 'pg-btn gold big pg-check', onclick: () => check() }, t('check'));
  const foot = h('div', { class: 'pg-lfoot' }, extrasEl, checkBtn);
  const fb = h('div', { class: 'pg-feedback', role: 'status' });
  el.append(head, body, foot, fb);

  function renderHearts(lost) {
    app.clear(heartsEl);
    if (!opts.hearts) heartsEl.append(h('span', { class: 'pg-heart-ico' }, '❤️'), h('span', { class: 'pg-inf', html: ICON.infinity }));
    else heartsEl.append(h('span', { class: 'pg-heart-ico' }, '❤️'), h('b', null, S.hearts()));
    if (lost) {
      heartsEl.classList.remove('lose');
      void heartsEl.offsetWidth;
      heartsEl.classList.add('lose');
      heartsEl.append(h('span', { class: 'pg-minus' }, '-1'));
    }
  }
  function renderProgress() {
    if (endless) {
      counter.textContent = t('endlessCount', { n: L.correct });
      return;
    }
    bar.style.width = `${Math.max(3, (100 * L.solved.size) / L.total)}%`;
  }
  function renderCombo() {
    if (L.run >= 3) {
      combo.textContent = t('combo', { n: L.run });
      combo.classList.remove('pop');
      void combo.offsetWidth;
      combo.classList.add('pop', 'show');
    } else combo.classList.remove('show');
  }
  renderHearts();
  renderProgress();

  // ---------- exercises ----------
  const env = exerciseEnv(app, scope, {
    changed: () => updateCheck(),
    submit: (res) => handle(res),
    enter: () => onEnter(),
    pauseListening: () => {
      S.pauseListening();
      caps.listen = false;
      app.toast(t('listenOff15'));
      for (let i = L.pos; i < L.queue.length; i++) L.queue[i] = { ...opts.gen.withoutListening(L.queue[i], opts.units), uid: L.queue[i].uid };
      handle({ skip: true });
    },
    pauseSpeaking: (silent) => {
      S.pauseSpeaking();
      caps.speak = false;
      app.toast(t(silent ? 'speakUnavailable' : 'speakOff15'));
      handle({ skip: true });
    },
    micDenied: () => {
      S.P.micDenied = true;
      S.save();
      caps.speak = false;
      app.toast(t('micDenied'));
      handle({ skip: true });
    },
  });

  function show() {
    if (cur && cur.destroy) cur.destroy();
    speech.stop();
    let ex = L.queue[L.pos];
    if (ex.type === 'listen' && !caps.listen) ex = L.queue[L.pos] = { ...opts.gen.withoutListening(ex, opts.units), uid: ex.uid, retry: ex.retry };
    if (ex.type === 'speak' && !caps.speak) ex = L.queue[L.pos] = { ...opts.gen.withoutSpeaking(ex, opts.units), uid: ex.uid, retry: ex.retry };
    curEx = ex;
    cur = renderExercise(ex, env);
    app.clear(body);
    const titleRow = h('div', { class: 'pg-extitle' }, cur.badge || null, h('h2', null, cur.title));
    const wrap = h('div', { class: 'pg-exwrap pg-slide-in' }, titleRow, cur.el);
    body.append(wrap);
    body.scrollTop = 0;
    app.clear(extrasEl);
    for (const x of cur.extras || []) extrasEl.append(h('button', { class: 'pg-btn ghost small', onclick: x.onclick }, x.label));
    checkBtn.style.display = cur.auto ? 'none' : '';
    foot.classList.toggle('auto', !!cur.auto);
    updateCheck();
    scope.later(() => cur && cur.onShow && cur.onShow(), 260);
  }
  function updateCheck() {
    checkBtn.disabled = !(cur && !cur.auto && cur.ready());
  }
  function check() {
    if (!cur || L.feedback || cur.auto || !cur.ready()) return;
    handle(cur.evaluate());
  }

  function handle(res) {
    if (L.feedback || L.finished) return;
    const ex = curEx;
    if (res.skip) {
      L.solved.add(ex.uid);
      renderProgress();
      next();
      return;
    }
    L.feedback = true;
    const ok = !!res.ok;
    if (!res.noPenalty) L.answered++;
    S.P.stats.exercises++;
    if (ok) {
      L.correct++;
      L.solved.add(ex.uid);
      L.run++;
      L.bestRun = Math.max(L.bestRun, L.run);
      S.P.stats.correct++;
      S.P.stats.combo = Math.max(S.P.stats.combo, L.run);
      if (ex.type === 'listen') {
        S.P.stats.listen++;
        app.quest('listen', 1);
      }
      if (ex.type === 'speak') {
        S.P.stats.speak++;
        app.quest('speak', 1);
      }
      app.quest('combo', L.run);
      if (ex.ref) S.clearMistake(T, ex.ref);
      sfx.play('success');
      sfx.vibrate(12);
    } else {
      L.run = 0;
      if (!res.noPenalty) {
        L.mistakes++;
        if (opts.hearts) {
          S.loseHeart();
          renderHearts(true);
          sfx.tone({ freq: 300, to: 120, dur: 0.3, type: 'sine', vol: 0.4, delay: 0.12 });
        }
      }
      S.addMistake(T, ex.ref);
      const again = opts.gen.again(ex, opts.units);
      L.queue.push({ ...again, uid: ex.uid });
      sfx.play('error');
      sfx.vibrate([40, 40, 40]);
    }
    S.save();
    const touched = wordsInExercise(ex, unitsById, T);
    if (touched.length) {
      S.touchWords(T, touched, ok);
      app.quest('words', touched.length);
    }
    cur.reveal(res);
    renderProgress();
    renderCombo();
    showFeedback(ok, res, ex);
  }

  function showFeedback(ok, res, ex) {
    app.clear(fb);
    fb.className = `pg-feedback ${ok ? 'good' : 'bad'}`;
    let title;
    if (!ok) title = res.noPenalty ? t('speakNotQuite') : t('wrongTitle');
    else if (res.almost) title = t('almost');
    else title = t(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    const lines = [];
    if (!ok || res.almost) lines.push(h('div', { class: 'pg-fb-sol' }, res.solution || ''));
    if (ok && res.accent) lines.push(h('div', { class: 'pg-fb-note' }, t('accentNote')), h('div', { class: 'pg-fb-sol' }, res.solution || ''));
    if (res.meaning) lines.push(h('div', { class: 'pg-fb-mean' }, h('b', null, t('meaning') + ' '), res.meaning));
    if (ok && res.matchWrong === 0 && ex.type === 'match') lines.push(h('div', { class: 'pg-fb-note' }, t('flawless')));
    const cont = h('button', { class: `pg-btn big ${ok ? 'good' : 'bad'}`, onclick: () => next() }, t('continue'));
    fb.append(
      h(
        'div',
        { class: 'pg-fb-head' },
        h('span', { class: 'pg-fb-ico', html: ok ? ICON.check : ICON.close }),
        h('div', { class: 'pg-fb-title' }, title),
        res.speakText && speech.has(T) ? speakerButton(app, res.speakText, T) : null,
      ),
      lines,
      cont,
    );
    requestAnimationFrame(() => fb.classList.add('show'));
    if (ok && res.speakText && app.S.P.settings.autoplay && ex.type !== 'pick' && ex.type !== 'choose') scope.later(() => speech.speak(res.speakText, T), 350);
    scope.later(() => cont.focus({ preventScroll: true }), 50);
  }

  function next() {
    if (!L.feedback && L.pos < L.queue.length && !L.queue[L.pos]) return;
    L.feedback = false;
    fb.classList.remove('show');
    speech.stop();
    L.pos++;
    if (opts.hearts && S.hearts() <= 0) return outOfHearts();
    if (opts.maxMistakes != null && L.mistakes > opts.maxMistakes) return testFailed();
    if (L.pos >= L.queue.length) {
      if (endless && opts.more) {
        const more = opts.more();
        more.forEach((ex) => L.queue.push({ ...ex, uid: L.nextUid++ }));
        L.total += more.length;
      }
      if (L.pos >= L.queue.length) return finish();
    }
    show();
  }

  function onEnter() {
    if (L.feedback) {
      const btn = fb.querySelector('.pg-btn');
      if (btn) btn.click();
    } else check();
  }

  // ---------- endings ----------
  function result() {
    const ms = Date.now() - L.start;
    const accuracy = L.answered ? Math.round((100 * L.correct) / Math.max(L.answered, L.correct)) : 100;
    return { ms, accuracy, perfect: L.mistakes === 0, correct: L.correct, bestRun: L.bestRun };
  }
  function finish() {
    if (L.finished) return;
    L.finished = true;
    if (cur && cur.destroy) cur.destroy();
    speech.stop();
    const r = result();
    if (endless && L.correct === 0) {
      app.goHome();
      return;
    }
    const reward = opts.onComplete ? opts.onComplete(r) || {} : {};
    const xp = endless ? Math.min(60, L.correct) : (opts.xpBase || 10) + (r.perfect ? opts.perfectBonus || 0 : 0);
    const gems = (reward.gems != null ? reward.gems : opts.gems || 0) + (r.perfect && !endless ? opts.perfectGems || 0 : 0);
    app.award({ xp, gems, hearts: opts.heartReward || 0, perfect: r.perfect && !endless && opts.mode !== 'practice', lesson: true, ms: r.ms });
    showResults(app, {
      title: reward.title || (endless ? t('endlessDone') : opts.mode === 'practice' ? t('practiceDone') : r.perfect ? t('perfectLesson') : t('lessonDone')),
      xp,
      gems,
      hearts: opts.heartReward || 0,
      accuracy: r.accuracy,
      ms: r.ms,
      extra: reward.extra,
      after: reward.after,
    });
  }
  function testFailed() {
    L.finished = true;
    if (cur && cur.destroy) cur.destroy();
    speech.stop();
    if (opts.onFail) opts.onFail();
    const s2 = app.screen('pg-result');
    s2.el.append(
      h(
        'div',
        { class: 'pg-result-in' },
        h('div', { class: 'pg-result-art', html: mascotSVG({ mood: 'sad' }) }),
        h('h1', { class: 'pg-result-title' }, t('testFailed')),
        h('p', { class: 'pg-result-sub' }, t('testFailedText')),
        h('button', { class: 'pg-btn gold big block', onclick: () => app.goHome() }, t('continue')),
      ),
    );
    sfx.play('lose');
  }

  function outOfHearts() {
    L.finished = true;
    if (cur && cur.destroy) cur.destroy();
    const ov = h('div', { class: 'pg-oohp' });
    const timer = h('div', { class: 'pg-oohp-timer' });
    const tick = () => (timer.textContent = t('nextHeartIn', { t: fmtTime(S.nextHeartMs()) }));
    tick();
    scope.every(tick, 1000);
    ov.append(
      h('div', { class: 'pg-oohp-art', html: mascotSVG({ mood: 'sad' }) }),
      h('h1', null, t('outOfHearts')),
      h('p', null, t('outOfHeartsText')),
      timer,
      h(
        'button',
        {
          class: 'pg-btn gold big block',
          onclick: () => {
            if (!S.refill()) {
              app.toast(t('notEnoughGems'));
              return;
            }
            sfx.play('levelup');
            ov.remove();
            L.finished = false;
            renderHearts();
            app.refreshHud();
            L.pos--;
            next();
          },
        },
        t('refillFor', { n: REFILL_COST }),
        h('span', { class: 'pg-gem-ico' }, ' 💎'),
      ),
      h('button', { class: 'pg-btn dark big block', onclick: () => app.startPractice('mix') }, t('practiceEarnHeart')),
      h('button', { class: 'pg-btn ghost block', onclick: () => app.goHome() }, t('quitLesson')),
    );
    el.append(ov);
    sfx.play('lose');
  }

  let quitting = false;
  async function quit() {
    if (endless) return finish();
    if (quitting || L.finished) return;
    quitting = true;
    const ok = await app.ctx.ui.modal({
      title: t('quitTitle'),
      body: t('quitText'),
      actions: [
        { label: t('keepLearning'), value: false, primary: true },
        { label: t('quitLesson'), value: true, danger: true },
      ],
    });
    quitting = false;
    if (ok && !app.disposed) app.goHome();
  }

  scope.back = () => {
    if (!L.finished) quit();
    else app.goHome();
    return true;
  };
  scope.key = (e) => {
    if (e.key === 'Enter') {
      if (e.target && e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      onEnter();
      return;
    }
    if (L.feedback || !cur || !cur.onKey) return;
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
    if (cur.onKey(e)) e.preventDefault();
  };
  scope.onCleanup(() => {
    if (cur && cur.destroy) cur.destroy();
    speech.stop();
  });
  show();
}

// ===================================================================================
// Results
// ===================================================================================
export function showResults(app, r) {
  const { h, t, S, sfx } = app;
  const scope = app.screen('pg-result');
  const xpNum = h('b', null, '0');
  const cards = [
    h('div', { class: 'pg-rcard xp' }, h('small', null, t('totalXp')), h('div', { class: 'pg-rval' }, h('span', { class: 'pg-rico', html: ICON.bolt }), xpNum)),
  ];
  if (r.accuracy != null) cards.push(h('div', { class: 'pg-rcard acc' }, h('small', null, t('accuracy')), h('div', { class: 'pg-rval' }, '🎯 ', h('b', null, r.accuracy + '%'))));
  if (r.ms != null) cards.push(h('div', { class: 'pg-rcard time' }, h('small', null, t('time')), h('div', { class: 'pg-rval' }, '⏱️ ', h('b', null, fmtTime(r.ms)))));
  const goal = S.P.goal;
  const today = S.todayXP();
  const goalBar = h('i');
  const rewards = [];
  if (r.gems) rewards.push(h('div', { class: 'pg-reward' }, h('span', null, '💎'), t('gemsEarned', { n: r.gems })));
  if (r.hearts) rewards.push(h('div', { class: 'pg-reward' }, h('span', null, '❤️'), t('heartsEarned', { n: r.hearts })));
  for (const x of r.extra || []) rewards.push(h('div', { class: 'pg-reward' }, h('span', null, x.icon), x.text));
  const ups = S.checkAchievements();
  for (const u of ups) rewards.push(h('div', { class: 'pg-reward ach' }, h('span', null, u.a.icon), t('achUnlocked', { name: t('ach_' + u.a.id), n: u.tier })));
  const lvlBefore = levelInfo(S.P.xp - (r.xp || 0)).level;
  const lvl = levelInfo(S.P.xp);
  if (lvl.level > lvlBefore) rewards.push(h('div', { class: 'pg-reward lvl' }, h('span', null, '⭐'), t('levelUp', { n: lvl.level })));
  const goalDone = today >= goal && today - (r.xp || 0) < goal;
  const el = h(
    'div',
    { class: 'pg-result-in' },
    h('div', { class: 'pg-result-art cheer', html: mascotSVG({ mood: 'cheer' }) }),
    h('h1', { class: 'pg-result-title' }, r.title),
    h('div', { class: 'pg-rcards' }, cards),
    h(
      'div',
      { class: 'pg-goalcard' },
      h('div', { class: 'pg-goalrow' }, h('span', null, t('dailyGoal')), h('b', null, `${Math.min(today, goal)}/${goal} XP`)),
      h('div', { class: 'pg-bar' }, goalBar),
      goalDone ? h('div', { class: 'pg-goal-done' }, t('goalReached')) : null,
    ),
    rewards.length ? h('div', { class: 'pg-rewards' }, rewards) : null,
    h(
      'button',
      {
        class: 'pg-btn gold big block',
        onclick: () => {
          if (r.after) r.after();
          else app.afterLesson();
        },
      },
      t('continue'),
    ),
  );
  scope.el.append(el);
  sfx.play('win');
  app.ctx.ui.confetti(goalDone ? 120 : 70);
  // count-up
  const start = performance.now();
  const dur = 900;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    xpNum.textContent = '+' + Math.round((r.xp || 0) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) scope.raf(step);
  };
  scope.raf(step);
  scope.later(() => (goalBar.style.width = `${Math.min(100, (100 * today) / goal)}%`), 300);
  scope.later(() => sfx.play('coin'), 950);
  if (goalDone) scope.later(() => sfx.play('levelup'), 1300);
  scope.back = () => {
    app.afterLesson();
    return true;
  };
  scope.key = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (r.after) r.after();
      else app.afterLesson();
    }
  };
}

// Streak celebration (shown once a day after the first lesson).
export function showStreak(app, from, to, done) {
  const { h, t, S, sfx } = app;
  const scope = app.screen('pg-streakscr');
  const num = h('div', { class: 'pg-snum' }, String(from));
  const week = h('div', { class: 'pg-week' });
  const today = dayKey();
  const ws = new Date();
  const dow = (ws.getDay() + 6) % 7;
  const fmt = new Intl.DateTimeFormat(app.locale, { weekday: 'narrow' });
  for (let i = 0; i < 7; i++) {
    const k = addDays(today, i - dow);
    const d = new Date();
    d.setDate(d.getDate() + i - dow);
    const isToday = k === today;
    const did = (S.dayDone(k) && k !== today) || S.dayFrozen(k);
    week.append(
      h(
        'div',
        { class: `pg-wd ${did ? 'did' : ''} ${S.dayFrozen(k) ? 'frozen' : ''} ${isToday ? 'today' : ''}` },
        h('small', null, fmt.format(d)),
        h('span', { class: 'pg-wd-dot' }, S.dayFrozen(k) ? '❄️' : did ? '✓' : ''),
      ),
    );
  }
  scope.el.append(
    h(
      'div',
      { class: 'pg-result-in' },
      h('div', { class: 'pg-flame' }, h('div', { class: 'pg-flame-ico' }, '🔥'), num),
      h('h1', { class: 'pg-result-title' }, t('streakDays', { n: to })),
      h('p', { class: 'pg-result-sub' }, t('streakText')),
      week,
      h('button', { class: 'pg-btn gold big block', onclick: done }, t('continue')),
    ),
  );
  scope.later(() => {
    num.textContent = String(to);
    num.classList.add('flip');
    sfx.play('levelup');
    sfx.vibrate([20, 40, 20]);
    const todayEl = week.querySelector('.today');
    if (todayEl) {
      todayEl.classList.add('did', 'pop');
      todayEl.querySelector('.pg-wd-dot').textContent = '✓';
    }
  }, 700);
  scope.back = () => {
    done();
    return true;
  };
  scope.key = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      done();
    }
  };
}

// ===================================================================================
// Story
// ===================================================================================
export function runStory(app, unit, story, { onComplete }) {
  const { h, t, S, sfx, speech, T, N } = app;
  const scope = app.screen('pg-lesson pg-storyscr');
  const el = scope.el;
  const items = story.lines;
  let pos = 0;
  let waiting = false;
  const start = Date.now();
  const bar = h('i');
  const head = h(
    'div',
    { class: 'pg-lhead' },
    h('button', { class: 'pg-x', 'aria-label': t('close'), html: ICON.close, onclick: () => quit() }),
    h('div', { class: 'pg-lprog' }, h('div', { class: 'pg-bar' }, bar)),
    h('div', { class: 'pg-lhearts' }, '📖'),
  );
  const body = h('div', { class: 'pg-lbody pg-story' });
  const cont = h('button', { class: 'pg-btn gold big pg-check', onclick: () => advance() }, t('continue'));
  const foot = h('div', { class: 'pg-lfoot' }, h('div', { class: 'pg-extras' }), cont);
  el.append(head, body, foot);
  const env = exerciseEnv(app, scope, {});

  body.append(
    h(
      'div',
      { class: 'pg-story-title' },
      h('div', { class: 'pg-story-cover' }, Object.values(story.cast).map((c) => h('span', null, c.emoji))),
      h('h2', { lang: T }, display(primary(story.title[T]), T)),
      h('p', null, primary(story.title[N])),
    ),
  );

  function lineEl(who, line) {
    const c = story.cast[who] || { name: '?', emoji: '🙂' };
    const text = primary(line[T]);
    const spk = speakerButton(env, text, T);
    const tr = h('div', { class: 'pg-story-tr' }, primary(line[N]));
    const bub = h('div', { class: 'pg-bubble' }, spk, h('div', null, h('div', { class: 'pg-who' }, c.name), sentenceView(env, text, T)), tr);
    bub.addEventListener('click', () => bub.classList.toggle('show-tr'));
    const row = h('div', { class: `pg-story-line ${Object.keys(story.cast).indexOf(who) % 2 ? 'right' : ''} pg-slide-in` }, h('div', { class: 'pg-bubble-ava emoji' }, c.emoji), bub);
    if (app.S.P.settings.autoplay) scope.later(() => spk.play(), 150);
    return row;
  }
  function progress() {
    bar.style.width = `${Math.max(3, (100 * pos) / items.length)}%`;
  }
  function scrollDown() {
    scope.later(() => body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }), 30);
  }
  function options(list, lang, answer, onRight) {
    const box = h('div', { class: 'pg-opts pg-story-opts pg-slide-in' });
    list.forEach((txt, i) => {
      const b = h('button', { class: 'pg-opt', lang }, h('span', { class: 'pg-opt-num' }, i + 1), h('span', null, display(txt, lang)));
      b.addEventListener('click', () => {
        if (b.disabled) return;
        if (lang === T) speech.speak(txt, T);
        if (i === answer) {
          b.classList.add('ok');
          box.querySelectorAll('button').forEach((x) => (x.disabled = true));
          sfx.play('success');
          sfx.vibrate(12);
          onRight();
        } else {
          b.classList.add('bad', 'shake');
          b.disabled = true;
          sfx.play('error');
          sfx.vibrate([30, 30, 30]);
        }
      });
      box.append(b);
    });
    return box;
  }
  function advance() {
    if (waiting) return;
    if (pos >= items.length) return finish();
    const it = items[pos];
    if (it.ask) {
      waiting = true;
      cont.disabled = true;
      const q = h('div', { class: 'pg-story-q pg-slide-in' }, h('div', { class: 'pg-story-qt' }, '❓ ', it.ask[N] || it.ask.en));
      q.append(
        options(
          it.options.map((o) => o[N] || o.en),
          N,
          it.answer,
          () => {
            waiting = false;
            cont.disabled = false;
          },
        ),
      );
      body.append(q);
    } else if (it.reply) {
      waiting = true;
      cont.disabled = true;
      const c = story.cast[it.who] || { name: '?' };
      const q = h('div', { class: 'pg-story-q pg-slide-in' }, h('div', { class: 'pg-story-qt' }, t('whatSays', { name: c.name })));
      const order = shuffle(it.reply.map((o, i) => i));
      q.append(
        options(
          order.map((i) => primary(it.reply[i][T])),
          T,
          order.indexOf(it.answer),
          () => {
            scope.later(() => {
              q.replaceWith(lineEl(it.who, it.reply[it.answer]));
              waiting = false;
              cont.disabled = false;
              scrollDown();
            }, 500);
          },
        ),
      );
      body.append(q);
    } else {
      body.append(lineEl(it.who, it));
    }
    pos++;
    progress();
    scrollDown();
    if (pos >= items.length && !waiting) cont.textContent = t('finishStory');
  }
  function finish() {
    speech.stop();
    const r = onComplete({ ms: Date.now() - start }) || {};
    S.P.stats.stories++;
    app.quest('story', 1);
    app.award({ xp: r.xp, gems: r.gems, lesson: false, ms: Date.now() - start });
    showResults(app, { title: t('storyDone'), xp: r.xp, gems: r.gems, ms: Date.now() - start, after: r.after });
  }
  let quitting = false;
  async function quit() {
    if (quitting) return;
    quitting = true;
    const ok = await app.ctx.ui.modal({
      title: t('quitTitle'),
      body: t('quitStoryText'),
      actions: [
        { label: t('keepReading'), value: false, primary: true },
        { label: t('quitLesson'), value: true, danger: true },
      ],
    });
    quitting = false;
    if (ok && !app.disposed) app.goHome();
  }
  scope.back = () => {
    quit();
    return true;
  };
  scope.key = (e) => {
    if (e.key === 'Enter' && !cont.disabled) {
      e.preventDefault();
      advance();
    }
  };
  scope.onCleanup(() => speech.stop());
  progress();
  scope.later(() => advance(), 450);
  void MAX_HEARTS;
}
