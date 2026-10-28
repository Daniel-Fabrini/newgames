// World Flags — flags & capitals quiz.
//   Main menu: player level/XP, quick play (daily challenge, survival, review
//   weak flags), sets (levels, continents, capitals) with progress rings, and
//   learning tools (flashcards, table).
//   Lobby shortcuts (ctx.mode): 'classic' → multiple-choice set picker,
//   'time' → time attack set picker, 'capitals' → capitals set picker.

import STRINGS from './strings.js';
import { h, clear, shuffle } from '../../js/core/ui.js';
import { SETS, setTitle, setDesc, nextSet, BY_CODE, todayKey, dailyQuestions, survivalPicker, TIERS, tierIndex } from './data.js';
import { SAME_FLAG } from './similar.js';
import { createProgress, levelInfo, rankIndex } from './progress.js';
import { makeScope, ring, mosaic, miniStars, preload, icon } from './widgets.js';
import { playSession } from './quiz.js';
import { showResults } from './results.js';
import { showFlashcards, showTable } from './learn.js';

const MODES = ['mc4', 'mc6', 'spell', 'type', 'match', 'time'];
const MODE_QT = { mc4: ['mc', 4], mc6: ['mc', 6], spell: ['spell', 0], type: ['type', 0], match: ['match', 0] };
const MODE_ICON = { mc4: 'grid4', mc6: 'grid6', spell: 'abc', type: 'keyboard', match: 'link', time: 'clock' };
const TIME_STARS = [8, 15, 25];
const DAILY_STARS = [5, 8, 10];
const MAX_SET_STARS = MODES.length * 3;

const countStars = (n, steps) => steps.filter((x) => n >= x).length;

// Stars for a completed set, from the number of mistakes.
function starsFor(mistakes, total) {
  if (mistakes <= Math.floor(total * 0.02)) return 3;
  if (mistakes <= Math.max(1, Math.floor(total * 0.08))) return 2;
  return 1;
}

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const P = createProgress(ctx.store);
  const app = { ctx, t, P, sfx: ctx.sfx, lang: ctx.lang };
  const entry = ['classic', 'time', 'capitals'].includes(ctx.mode) ? ctx.mode : null;

  let cur = null; // { el, scope }
  let backFn = null;
  let session = null;
  let modalOpen = false;
  let unmounted = false;
  const leaving = new Set();

  // ---------- navigation ----------
  function show(render, { dir = 1, cls = 'screen', title = null, back = null } = {}) {
    session = null;
    if (cur) {
      cur.scope.dispose();
      const old = cur.el;
      old.classList.remove('g-flags-in-r', 'g-flags-in-l');
      old.classList.add(dir >= 0 ? 'g-flags-out-l' : 'g-flags-out-r');
      old.inert = true;
      const id = setTimeout(() => {
        leaving.delete(id);
        old.remove();
      }, 300);
      leaving.add(id);
    }
    const el = h('div', { class: `g-flags-view ${cls} ${dir >= 0 ? 'g-flags-in-r' : 'g-flags-in-l'}` });
    root.append(el);
    const scope = makeScope();
    cur = { el, scope };
    backFn = back;
    ctx.setTitle(title || undefined);
    ctx.setHeaderRight(null);
    render(el, scope);
  }

  ctx.onBack(() => {
    if (modalOpen) return true;
    if (backFn) {
      backFn();
      return true;
    }
    return false;
  });

  // Where "Menu" leads after a round.
  const menuFor = (set) => (dir = -1) => (entry ? pickScreen(entry, dir) : setScreen(set, dir));

  async function confirmLeave(onLeave) {
    if (modalOpen) return;
    modalOpen = true;
    if (session) session.pause();
    const ok = await ctx.ui.modal({
      title: t('leaveTitle'),
      body: t('leaveText'),
      actions: [
        { label: t('keepPlaying'), value: false, primary: true },
        { label: t('leave'), value: true, danger: true },
      ],
      dismissible: true,
    });
    modalOpen = false;
    if (unmounted) return;
    if (ok) onLeave();
    else if (session) session.resume();
  }

  function grantXp(gain) {
    const before = P.xp;
    P.addXp(gain);
    P.countGame();
    if (gain > 0) {
      try {
        ctx.addXP?.(gain);
      } catch (e) {
        console.error(e);
      }
    }
    return before;
  }

  const snapshot = () => P.counts('flags').learned + P.counts('caps').learned;

  function fmtWait(min) {
    if (min < 60) return t('inMin', { n: min });
    if (min < 48 * 60) return t('inHours', { n: Math.ceil(min / 60) });
    return t('inDays', { n: Math.ceil(min / 1440) });
  }

  // ---------- shared menu pieces ----------
  function setItem(set, onclick, mode = null) {
    const s = P.setStats(set);
    let right;
    if (mode === 'time') {
      const r = P.rec(set.id, 'time');
      right = h('div', { class: 'li-right g-flags-liright' }, miniStars(r ? r.s : 0), h('small', null, t('bestShort', { n: r ? r.b : 0 })));
    } else if (mode) {
      const r = P.rec(set.id, mode);
      const run = P.run(set.id, mode);
      right = h('div', { class: 'li-right g-flags-liright' }, miniStars(r ? r.s : 0), run && run.q ? h('small', { class: 'g-flags-resume' }, `▶ ${run.total - run.q.length}/${run.total}`) : null);
    } else {
      right = h('div', { class: 'li-right g-flags-liright' }, h('b', null, icon('star', 'sm'), String(P.setStars(set.id))), h('small', null, '/' + MAX_SET_STARS));
    }
    const sub = [t(set.kind === 'caps' ? 'nCapitals' : 'nFlags', { n: set.items.length }), Math.round(s.pct * 100) + '%'].join(' · ');
    return h(
      'button',
      { class: 'list-item g-flags-setitem', onclick },
      ring({ size: 56, stroke: 4, a: s.pct, b: s.mpct, inner: mosaic(set.icon) }),
      h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, setTitle(t, set)), h('div', { class: 'li-sub' }, sub)),
      right,
    );
  }

  function rowItem(ic, title, sub, onclick, right = null) {
    return h(
      'button',
      { class: 'list-item g-flags-rowitem', onclick },
      h('span', { class: 'g-flags-micon' }, icon(ic)),
      h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, title), sub ? h('div', { class: 'li-sub' }, sub) : null),
      right || h('span', { class: 'li-right g-flags-chev' }, icon('chevron')),
    );
  }

  // ---------- home ----------
  function home(dir = -1) {
    show(
      (el) => {
        el.classList.add('g-flags-home');
        const li = levelInfo(P.xp);
        const fl = P.counts('flags');
        const stat = (ic, v, label) => h('div', { class: 'g-flags-pstat' }, icon(ic, 'sm'), h('b', null, String(v)), h('small', null, label));
        const player = h(
          'div',
          { class: 'g-flags-player card' },
          h(
            'div',
            { class: 'g-flags-ptop' },
            ring({ size: 74, stroke: 5, a: li.into / li.need, cls: 'xp', inner: h('div', { class: 'g-flags-lvl' }, h('small', null, t('lvlShort')), h('b', null, String(li.level))) }),
            h(
              'div',
              { class: 'g-flags-pinfo' },
              h('div', { class: 'g-flags-rank' }, icon('crown', 'sm'), t('rank' + rankIndex(li.level))),
              h('div', { class: 'g-flags-xpbar' }, h('i', { style: { width: (li.into / li.need) * 100 + '%' } })),
              h('div', { class: 'g-flags-xptext' }, t('xpToNext', { a: li.into, b: li.need, n: li.level + 1 })),
            ),
          ),
          h('div', { class: 'g-flags-pstats' }, stat('flag', fl.learned, t('statLearned')), stat('crown', fl.mastered, t('statMastered')), stat('star', P.totalStars(), t('statStars'))),
        );

        const due = reviewItems().length;
        const today = P.dailyToday();
        const streak = P.dailyStreak();
        const tile = (cls, ic, title, sub, badge, onclick) =>
          h(
            'button',
            { class: `g-flags-tile2 ${cls}`, onclick },
            badge ? h('span', { class: 'g-flags-badgeup' }, badge) : null,
            h('span', { class: 'g-flags-tileic' }, icon(ic)),
            h('b', null, title),
            h('small', null, sub),
          );
        const quick = h(
          'div',
          { class: 'g-flags-quick' },
          tile(today ? 'done' : 'hot', 'calendar', t('daily'), today ? t('dailyDoneShort', { n: today.score }) : t('dailyNew'), streak ? '🔥' + streak : null, () => startDaily()),
          tile('', 'infinity', t('survival'), t('bestShort', { n: P.survivalBest('flags') }), null, () => startSurvival('flags')),
          tile(due ? 'hot' : 'done', 'repeat', t('review'), due ? t('weakN', { n: due }) : t('allGood'), due ? String(due) : null, () => startReview()),
        );

        const content = h('div', { class: 'g-flags-tabcontent' });
        const seg = h('div', { class: 'g-flags-seg g-flags-tabs' });
        const tabs = [
          ['flags', t('tabFlags')],
          ['caps', t('tabCapitals')],
          ['learn', t('tabLearn')],
        ];
        let tab = ctx.store.get('tab', 'flags');
        if (!tabs.some(([id]) => id === tab)) tab = 'flags';
        const tabBtns = tabs.map(([id, label]) => {
          const b = h(
            'button',
            {
              class: id === tab ? 'active' : '',
              onclick: () => {
                if (tab === id) return;
                tab = id;
                ctx.store.set('tab', id);
                ctx.sfx.play('tap');
                tabBtns.forEach((x) => x.classList.toggle('active', x === b));
                renderTab();
              },
            },
            label,
          );
          seg.append(b);
          return b;
        });

        function renderTab() {
          clear(content);
          const box = h('div', { class: 'stack fade-in' });
          if (tab === 'flags') {
            box.append(
              h('div', { class: 'section-title' }, t('levels')),
              h('div', { class: 'list' }, SETS.filter((s) => s.group === 'levels').map((s) => setItem(s, () => setScreen(s)))),
              h('div', { class: 'section-title' }, t('continents')),
              h('div', { class: 'list' }, SETS.filter((s) => s.group === 'conts').map((s) => setItem(s, () => setScreen(s)))),
            );
          } else if (tab === 'caps') {
            box.append(
              h('div', { class: 'list' }, rowItem('infinity', t('survivalCaps'), t('bestShort', { n: P.survivalBest('caps') }), () => startSurvival('caps'))),
              h('div', { class: 'section-title' }, t('continents')),
              h('div', { class: 'list' }, SETS.filter((s) => s.group === 'caps').map((s) => setItem(s, () => setScreen(s)))),
            );
          } else {
            const cc = P.counts('caps');
            box.append(
              h(
                'div',
                { class: 'list' },
                rowItem('cards', t('flashcards'), t('flashcardsDesc'), () => fcPicker()),
                rowItem('table', t('table'), t('tableDesc'), () => tableScreen()),
              ),
              h(
                'div',
                { class: 'card g-flags-mastcard' },
                h('div', { class: 'g-flags-masthead' }, icon('crown'), h('b', null, t('masteryTitle'))),
                h('p', { class: 'muted small' }, t('masteryText')),
                h('div', { class: 'g-flags-legend' }, h('span', null, h('i', { class: 'a' }), t('legendLearned')), h('span', null, h('i', { class: 'b' }), t('legendMastered'))),
                h(
                  'div',
                  { class: 'g-flags-mastrows' },
                  h('div', null, h('span', null, t('tabFlags')), h('b', null, `${fl.learned} · ${fl.mastered}`)),
                  h('div', null, h('span', null, t('tabCapitals')), h('b', null, `${cc.learned} · ${cc.mastered}`)),
                ),
              ),
            );
          }
          content.append(box);
        }
        renderTab();
        el.append(player, quick, seg, content);
      },
      { dir, back: null },
    );
  }

  // ---------- set screen ----------
  function setScreen(set, dir = 1) {
    show(
      (el) => {
        const s = P.setStats(set);
        const desc = setDesc(t, set);
        el.append(
          h(
            'div',
            { class: 'card g-flags-sethero' },
            ring({ size: 96, stroke: 6, a: s.pct, b: s.mpct, inner: mosaic(set.icon, 'big') }),
            h(
              'div',
              { class: 'g-flags-shinfo' },
              h('div', { class: 'title-l' }, setTitle(t, set)),
              h('div', { class: 'muted small' }, [t(set.kind === 'caps' ? 'nCapitals' : 'nFlags', { n: set.items.length }), desc].filter(Boolean).join(' · ')),
              h(
                'div',
                { class: 'g-flags-legend' },
                h('span', null, h('i', { class: 'a' }), t('learnedN', { n: s.learned })),
                h('span', null, h('i', { class: 'b' }), t('masteredN', { n: s.mastered })),
              ),
              h('div', { class: 'g-flags-setstars' }, icon('star', 'sm'), `${P.setStars(set.id)} / ${MAX_SET_STARS}`),
            ),
          ),
          h('div', { class: 'section-title' }, t('modes')),
          h('div', { class: 'list' }, MODES.map((m) => modeItem(set, m))),
          h('button', { class: 'btn ghost block g-flags-study', onclick: () => flashScreen(set, () => setScreen(set, -1)) }, icon('cards', 'sm'), t('studySet')),
        );
      },
      { dir, title: setTitle(t, set), back: () => home(-1) },
    );
  }

  function modeItem(set, mode) {
    const r = P.rec(set.id, mode);
    const run = mode !== 'time' && P.run(set.id, mode);
    let sub = t('modeSub_' + mode + (set.kind === 'caps' && mode === 'match' ? 'Cap' : ''));
    if (run) sub = t('continueRun', { n: run.total - run.q.length, total: run.total });
    const right = h('div', { class: 'li-right g-flags-liright' }, miniStars(r ? r.s : 0), mode === 'time' ? h('small', null, t('bestShort', { n: r ? r.b : 0 })) : null);
    const item = rowItem(MODE_ICON[mode], t('mode_' + mode), sub, () => (mode === 'time' ? startTime(set) : startClassic(set, mode)), right);
    if (run) item.classList.add('g-flags-running');
    return item;
  }

  // ---------- lobby shortcut pickers ----------
  function pickScreen(kind, dir = 1) {
    const sets = SETS.filter((s) => (kind === 'capitals' ? s.kind === 'caps' : s.kind === 'flags'));
    const mode = kind === 'time' ? 'time' : 'mc4';
    show(
      (el) => {
        el.append(
          h(
            'div',
            { class: 'g-flags-pickhead card' },
            h('span', { class: 'g-flags-micon big' }, icon(kind === 'time' ? 'clock' : kind === 'capitals' ? 'building' : 'flag')),
            h('div', null, h('div', { class: 'title-l' }, t('pick_' + kind)), h('div', { class: 'muted small' }, t('pickSub_' + kind))),
          ),
          h('div', { class: 'list' }, sets.map((s) => setItem(s, () => (mode === 'time' ? startTime(s) : startClassic(s, 'mc4')), mode))),
        );
      },
      { dir, title: t('pick_' + kind), back: null },
    );
  }

  // ---------- classic modes ----------
  async function startClassic(set, mode, fresh = false) {
    const ret = menuFor(set);
    let run = fresh ? null : P.run(set.id, mode);
    if (fresh) P.clearRun(set.id, mode);
    if (run && (!Array.isArray(run.q) || !run.q.length || !run.q.every((c) => set.items.some((x) => x.code === c)))) {
      P.clearRun(set.id, mode);
      run = null;
    }
    if (run) {
      if (modalOpen) return;
      modalOpen = true;
      const choice = await ctx.ui.modal({
        title: t('resumeTitle'),
        body: t('resumeText', { n: run.total - run.q.length, total: run.total }),
        actions: [
          { label: t('resume'), value: 'resume', primary: true },
          { label: t('restart'), value: 'restart' },
        ],
        dismissible: true,
      });
      modalOpen = false;
      if (unmounted || !choice) return;
      if (choice === 'restart') {
        P.clearRun(set.id, mode);
        run = null;
      }
    }
    if (!run) run = { q: shuffle(set.items.map((c) => c.code)), total: set.items.length, st: null };
    const [qt, n] = MODE_QT[mode];
    const snap = snapshot();
    const leave = () => {
      if (P.run(set.id, mode)) ctx.ui.toast(t('progressSaved'));
      ret(-1);
    };
    show(
      (el, scope) => {
        session = playSession(app, el, scope, {
          lives: 3,
          regen: 10,
          init: run.st,
          next() {
            if (!run.q.length) return null;
            if (qt === 'match') return { qt, kind: set.kind, cs: run.q.slice(0, 4).map((c) => BY_CODE.get(c)) };
            if (run.q[1]) preload(BY_CODE.get(run.q[1]));
            return { qt, n, kind: set.kind, c: BY_CODE.get(run.q[0]) };
          },
          answered(q) {
            const i = run.q.indexOf(q.c.code);
            if (i >= 0) run.q.splice(i, 1);
          },
          skip(q) {
            const codes = q.cs ? q.cs.map((c) => c.code) : [q.c.code];
            for (const code of codes) {
              const i = run.q.indexOf(code);
              if (i >= 0) run.q.push(...run.q.splice(i, 1));
            }
          },
          progress() {
            const done = run.total - run.q.length;
            return { frac: done / run.total, text: `${done}/${run.total}` };
          },
          save(st) {
            run.st = { correct: st.correct, mistakes: st.mistakes, streak: st.streak, lives: st.lives, xp: st.xp, maxCombo: st.maxCombo, skips: st.skips };
            P.saveRun(set.id, mode, run);
          },
          exit: leave,
          end(st, reason) {
            P.clearRun(set.id, mode);
            finishClassic(set, mode, st, reason, run.total, snap);
          },
        });
      },
      { cls: 'g-flags-play', back: leave },
    );
  }

  function finishClassic(set, mode, st, reason, total, snap) {
    const ret = menuFor(set);
    const done = reason === 'done';
    const stars = done ? starsFor(st.mistakes, total) : 0;
    const xpGain = st.xp + (done ? 5 + (stars === 3 ? 5 : 0) : 0);
    const info = P.saveRec(set.id, mode, { stars, best: st.correct });
    const xpBefore = grantXp(xpGain);
    const learned = snapshot() - snap;
    const nx = done ? nextSet(set) : null;
    show(
      (el, scope) =>
        showResults(app, el, scope, {
          tone: done ? 'win' : 'lose',
          medal: done ? (stars === 3 ? '🏆' : '🎉') : '💔',
          title: done ? t('winTitle') : t('loseTitle'),
          subtitle: done ? t('winText', { set: setTitle(t, set) }) : t('loseText'),
          stars: done ? stars : null,
          big: { value: st.correct, of: total, label: t('correctAnswers') },
          badge: done && info.newStars && info.oldStars > 0 ? t('moreStars') : null,
          stats: [
            { icon: 'x', label: t('mistakes'), value: st.mistakes },
            { icon: 'fire', label: t('bestCombo'), value: st.maxCombo },
            { icon: 'flag', label: t('learnedNew'), value: '+' + Math.max(0, learned) },
          ],
          xpBefore,
          xpGain,
          actions: done
            ? [
                nx && { label: t('nextSet', { set: setTitle(t, nx) }), primary: true, onclick: () => startClassic(nx, mode) },
                { label: t('playAgain'), primary: !nx, onclick: () => startClassic(set, mode, true) },
                { label: t('menu'), ghost: true, onclick: () => ret(-1) },
              ].filter(Boolean)
            : [
                { label: t('tryAgain'), primary: true, onclick: () => startClassic(set, mode, true) },
                { label: t('menu'), ghost: true, onclick: () => ret(-1) },
              ],
        }),
      { back: () => ret(-1) },
    );
  }

  // ---------- time attack ----------
  function startTime(set) {
    const ret = menuFor(set);
    const snap = snapshot();
    let deck = shuffle(set.items);
    let di = 0;
    show(
      (el, scope) => {
        session = playSession(app, el, scope, {
          lives: 0,
          timeLimit: 60000,
          countdown: true,
          speed: 0.6,
          next() {
            if (di >= deck.length) {
              deck = shuffle(set.items);
              di = 0;
            }
            const c = deck[di++];
            if (deck[di]) preload(deck[di]);
            return { c, kind: set.kind, qt: 'mc', n: 4 };
          },
          answered() {},
          skip() {},
          progress: () => ({ frac: 0, text: '' }),
          exit: () => confirmLeave(() => ret(-1)),
          end(st) {
            finishTime(set, st, snap);
          },
        });
      },
      { cls: 'g-flags-play', back: () => confirmLeave(() => ret(-1)) },
    );
  }

  function finishTime(set, st, snap) {
    const ret = menuFor(set);
    const stars = countStars(st.correct, TIME_STARS);
    const old = P.rec(set.id, 'time');
    const oldBest = old ? old.b : 0;
    const newBest = st.correct > oldBest && st.correct > 0;
    P.saveRec(set.id, 'time', { stars, best: st.correct });
    const xpGain = st.xp + (newBest ? 5 : 0);
    const xpBefore = grantXp(xpGain);
    const learned = snapshot() - snap;
    show(
      (el, scope) =>
        showResults(app, el, scope, {
          tone: 'time',
          medal: '⏱️',
          title: t('timeTitle'),
          subtitle: stars < 3 ? t('nextStarAt', { n: TIME_STARS[stars] }) : t('timeMax'),
          stars,
          big: { value: st.correct, label: t('correctIn60') },
          badge: newBest ? t('newRecord') : null,
          stats: [
            { icon: 'x', label: t('mistakes'), value: st.mistakes },
            { icon: 'fire', label: t('bestCombo'), value: st.maxCombo },
            { icon: 'trophy', label: t('record'), value: Math.max(oldBest, st.correct) },
            { icon: 'flag', label: t('learnedNew'), value: '+' + Math.max(0, learned) },
          ],
          xpBefore,
          xpGain,
          actions: [
            { label: t('playAgain'), primary: true, onclick: () => startTime(set) },
            { label: t('menu'), ghost: true, onclick: () => ret(-1) },
          ],
        }),
      { back: () => ret(-1) },
    );
  }

  // ---------- survival ----------
  function startSurvival(kind) {
    const snap = snapshot();
    const pick = survivalPicker(kind);
    const ret = (d = -1) => home(d);
    show(
      (el, scope) => {
        session = playSession(app, el, scope, {
          lives: 3,
          regen: 10,
          next: (st) => pick(st.correct),
          answered() {},
          skip() {},
          progress(st) {
            const i = tierIndex(st.correct);
            const from = TIERS[i].from;
            const to = TIERS[i + 1] ? TIERS[i + 1].from : null;
            return { frac: to ? (st.correct - from) / (to - from) : 1, text: String(st.correct), label: t('tier' + i) };
          },
          exit: () => confirmLeave(() => ret(-1)),
          end(st) {
            finishSurvival(kind, st, snap);
          },
        });
      },
      { cls: 'g-flags-play', title: t(kind === 'caps' ? 'survivalCaps' : 'survival'), back: () => confirmLeave(() => ret(-1)) },
    );
  }

  function finishSurvival(kind, st, snap) {
    const info = P.saveSurvival(kind, st.correct);
    const xpGain = st.xp + (info.newBest ? 5 : 0);
    const xpBefore = grantXp(xpGain);
    const learned = snapshot() - snap;
    show(
      (el, scope) =>
        showResults(app, el, scope, {
          tone: info.newBest ? 'win' : 'neutral',
          medal: info.newBest ? '🏆' : '⚡',
          title: t('survivalOver'),
          subtitle: t('reachedTier', { tier: t('tier' + tierIndex(st.correct)) }),
          stars: null,
          big: { value: st.correct, label: t('score') },
          badge: info.newBest ? t('newRecord') : null,
          stats: [
            { icon: 'trophy', label: t('record'), value: Math.max(info.old, st.correct) },
            { icon: 'fire', label: t('bestCombo'), value: st.maxCombo },
            { icon: 'flag', label: t('learnedNew'), value: '+' + Math.max(0, learned) },
          ],
          xpBefore,
          xpGain,
          actions: [
            { label: t('playAgain'), primary: true, onclick: () => startSurvival(kind) },
            { label: t('menu'), ghost: true, onclick: () => home(-1) },
          ],
        }),
      { back: () => home(-1) },
    );
  }

  // ---------- daily challenge ----------
  async function startDaily() {
    let practice = false;
    const today = P.dailyToday();
    if (today) {
      if (modalOpen) return;
      modalOpen = true;
      const ok = await ctx.ui.modal({
        title: t('dailyDoneTitle'),
        body: t('dailyDoneText', { n: today.score }),
        actions: [
          { label: t('practice'), value: true, primary: true },
          { label: t('cancel'), value: false },
        ],
        dismissible: true,
      });
      modalOpen = false;
      if (unmounted || !ok) return;
      practice = true;
    }
    const snap = snapshot();
    const queue = dailyQuestions(todayKey());
    const total = queue.length;
    let answeredN = 0;
    show(
      (el, scope) => {
        session = playSession(app, el, scope, {
          lives: 0,
          next() {
            const q = queue[0];
            if (q && queue[1]) preload(queue[1].c);
            return q ? { ...q } : null;
          },
          answered() {
            queue.shift();
            answeredN++;
          },
          skip() {
            queue.push(queue.shift());
          },
          progress: () => ({ frac: answeredN / total, text: `${answeredN}/${total}` }),
          exit: () => confirmLeave(() => home(-1)),
          end(st) {
            finishDaily(st, practice, snap, total);
          },
        });
      },
      { cls: 'g-flags-play', title: t('daily'), back: () => confirmLeave(() => home(-1)) },
    );
  }

  function finishDaily(st, practice, snap, total) {
    const stars = countStars(st.correct, DAILY_STARS);
    let streak = P.dailyStreak();
    let bonus = 0;
    if (!practice) {
      const r = P.saveDaily({ score: st.correct, xp: st.xp });
      streak = r.streak;
      if (r.first) bonus = 5 + Math.min(streak, 10);
    }
    const xpGain = st.xp + bonus;
    const xpBefore = grantXp(xpGain);
    const learned = snapshot() - snap;
    show(
      (el, scope) =>
        showResults(app, el, scope, {
          tone: stars ? 'win' : 'neutral',
          medal: '📅',
          title: t('dailyTitle'),
          subtitle: practice ? t('dailyPractice') : t('dailyStreak', { n: streak }),
          stars,
          big: { value: st.correct, of: total, label: t('correctAnswers') },
          badge: null,
          stats: [
            { icon: 'fire', label: t('dayStreak'), value: streak },
            { icon: 'zap', label: t('bestCombo'), value: st.maxCombo },
            { icon: 'flag', label: t('learnedNew'), value: '+' + Math.max(0, learned) },
          ],
          xpBefore,
          xpGain,
          actions: [
            { label: t('menu'), primary: true, onclick: () => home(-1) },
            { label: t('practiceAgain'), ghost: true, onclick: () => startDaily() },
          ],
        }),
      { back: () => home(-1) },
    );
  }

  // ---------- review weak flags (spaced repetition) ----------
  function reviewItems() {
    return P.dueList().filter((it) => {
      const c = BY_CODE.get(it.code);
      return c && (it.kind === 'caps' ? !!c.capital : !SAME_FLAG.has(c.code));
    });
  }

  function startReview() {
    const items = reviewItems().slice(0, 15);
    if (!items.length) {
      const m = P.nextDueIn();
      ctx.ui.toast(m ? t('reviewLater', { time: fmtWait(m) }) : t('reviewEmpty'), 2600);
      return;
    }
    const snap = snapshot();
    const queue = items.map((it) => ({ c: BY_CODE.get(it.code), kind: it.kind, box: it.box }));
    const total = queue.length;
    let doneN = 0;
    show(
      (el, scope) => {
        session = playSession(app, el, scope, {
          lives: 0,
          next() {
            const it = queue[0];
            if (!it) return null;
            if (queue[1]) preload(queue[1].c);
            return { c: it.c, kind: it.kind, qt: 'mc', n: it.box >= 2 ? 6 : 4, it };
          },
          answered(q, ok) {
            const i = queue.indexOf(q.it);
            if (i < 0) return;
            queue.splice(i, 1);
            if (ok) doneN++;
            else queue.splice(Math.min(3, queue.length), 0, q.it);
          },
          skip(q) {
            const i = queue.indexOf(q.it);
            if (i >= 0) queue.push(...queue.splice(i, 1));
          },
          progress: () => ({ frac: doneN / total, text: `${doneN}/${total}` }),
          exit: () => confirmLeave(() => home(-1)),
          end(st) {
            finishReview(st, total, snap);
          },
        });
      },
      { cls: 'g-flags-play', title: t('review'), back: () => confirmLeave(() => home(-1)) },
    );
  }

  function finishReview(st, total, snap) {
    const xpGain = st.xp + 3;
    const xpBefore = grantXp(xpGain);
    const learned = snapshot() - snap;
    const more = reviewItems().length;
    show(
      (el, scope) =>
        showResults(app, el, scope, {
          tone: 'win',
          medal: '🧠',
          title: t('reviewTitle'),
          subtitle: more ? t('weakN', { n: more }) : t('reviewAllDone'),
          stars: null,
          big: { value: total, label: t('reviewed') },
          badge: null,
          stats: [
            { icon: 'x', label: t('mistakes'), value: st.mistakes },
            { icon: 'fire', label: t('bestCombo'), value: st.maxCombo },
            { icon: 'flag', label: t('learnedNew'), value: '+' + Math.max(0, learned) },
          ],
          xpBefore,
          xpGain,
          actions: [
            more && { label: t('reviewMore'), primary: true, onclick: () => startReview() },
            { label: t('menu'), primary: !more, ghost: !!more, onclick: () => home(-1) },
          ].filter(Boolean),
        }),
      { back: () => home(-1) },
    );
  }

  // ---------- learning ----------
  function fcPicker(dir = 1) {
    show(
      (el) => {
        el.append(
          h('p', { class: 'muted small g-flags-intro' }, t('fcIntro')),
          h(
            'div',
            { class: 'list' },
            SETS.filter((s) => s.kind === 'flags').map((s) => {
              const known = s.items.filter((c) => P.fcKnows(c.code)).length;
              const frac = known / s.items.length;
              return h(
                'button',
                { class: 'list-item g-flags-setitem', onclick: () => flashScreen(s, () => fcPicker(-1)) },
                ring({ size: 56, stroke: 4, a: frac, inner: mosaic(s.icon) }),
                h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, setTitle(t, s)), h('div', { class: 'li-sub' }, t('fcKnownOf', { n: known, total: s.items.length }))),
                h('span', { class: 'li-right g-flags-chev' }, icon('chevron')),
              );
            }),
          ),
        );
      },
      { dir, title: t('flashcards'), back: () => home(-1) },
    );
  }

  function flashScreen(set, onBack) {
    show((el, scope) => showFlashcards(app, el, scope, set, onBack), { cls: 'g-flags-play', title: setTitle(t, set), back: onBack });
  }

  function tableScreen() {
    show((el, scope) => showTable(app, el, scope), { cls: 'screen g-flags-tableview', title: t('table'), back: () => home(-1) });
  }

  // ---------- start ----------
  if (entry) pickScreen(entry, 1);
  else home(1);

  return () => {
    unmounted = true;
    if (cur) cur.scope.dispose();
    leaving.forEach(clearTimeout);
    leaving.clear();
    P.flush();
    ctx.setHeaderRight(null);
  };
}
