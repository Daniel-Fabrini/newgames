// Match flow for every mode: question screen, lifelines, result screens, ladder, results, review.
import { h } from '../../js/core/ui.js';
import { crest, trophy, crowdSil, avatar, ico } from './art.js';
import { LADDER, SAFE_STEPS, MODES, THEMES, TIME_ATTACK, recentLimit } from './config.js';
import { money, prizeOnWrong, prizeOnStop } from './prizes.js';
import { randSeed } from './rng.js';
import { IDOLS, POS, idolPortrait, idolCard } from './idols.js';
import { createSession, currentView, answer, next, stop, timeUp, cur, canUse, useFifty, useCrowd, usePhone, callIdol, useSwap, summary, scoreOf, serialize, dailyPlan, dayKey, stepNo } from './session.js';
import { recordMatch, recordDaily, pushRecent, xpFor, ACHIEVEMENTS } from './stats.js';
import { confirmBox, fmtScore, fmtDur, modes, stats, lifelineRows } from './screens.js';

const put = (el, ...c) => el.append(...c.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
const L = 'ABCD';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let matchId = 0;

export function startMode(app, mode, opts = {}) {
  const bank = app.bank;
  const lim = recentLimit(bank.length);
  const st =
    mode === 'daily'
      ? createSession({ mode, seed: 1, bank, preset: dailyPlan(dayKey(), bank) })
      : createSession({ mode, seed: randSeed(), bank, recent: app.recent.slice(-lim), themeId: opts.themeId || null, timer: opts.timer || 0 });
  st.opts.dayKey = mode === 'daily' ? dayKey() : null;
  if (st.outcome === 'empty') return app.toast(app.t('noQuestions'));
  app.audio.horn();
  runMatch(app, st, { fresh: true });
}
export const resumeMatch = (app, st) => runMatch(app, st, { fresh: false });

const persist = (app, st) => (st.done ? app.clearResume() : app.saveResume(serialize(st)));

// ------------------------------------------------------------------ the loop
async function runMatch(app, st, { fresh }) {
  const mid = ++matchId;
  const alive = () => !app.unmounted && mid === matchId;
  const M = MODES[st.mode];
  const bank = app.bank;
  persist(app, st);
  let resumedAnswered = !fresh && !!cur(st).res;
  if (M.ladder && !fresh && !resumedAnswered) await ladderView(app, st, stepNo(st) - 1, stepNo(st), { quick: true });
  if (!alive()) return;
  while (!st.done) {
    let out = null;
    if (!resumedAnswered) {
      const r = await questionScreen(app, st, () => persist(app, st), alive);
      if (!alive()) return;
      if (r.kind === 'stop') {
        stop(st);
        break;
      }
      if (r.kind === 'timeup') {
        timeUp(st);
        break;
      }
      out = r.out;
      persist(app, st);
      if (M.ladder) {
        await ladderResult(app, st, out);
        if (!alive()) return;
      }
    }
    resumedAnswered = false;
    if (st.done) break;
    const from = stepNo(st);
    if (!next(st, bank)) break;
    persist(app, st);
    if (M.ladder) {
      await ladderView(app, st, from, stepNo(st));
      if (!alive()) return;
    }
  }
  if (!alive()) return;
  finish(app, st);
}

// ------------------------------------------------------------------ question screen
function questionScreen(app, st, save, alive) {
  const { t, bank, audio } = app;
  const M = MODES[st.mode];
  const v = currentView(st, bank);
  const step = stepNo(st);
  return new Promise((resolve) => {
    app.show(
      (el, sc) => {
        el.classList.add('tc-q', `m-${st.mode}`);
        let sel = null;
        let busy = false;
        let t0 = performance.now();
        const initial = M.lifelines;
        const total = M.total;

        // --- lifelines row / HUD ---
        const lifeBtns = {};
        const row = h('div', { class: 'tc-lifes' });
        const hasLife = Object.values(initial).some((n) => n > 0);
        for (const k of ['fifty', 'crowd', 'phone', 'swap']) {
          if (!initial[k]) continue;
          const b = h('button', { class: 'tc-life', 'aria-label': t(`life.${k}.n`), onclick: () => lifeTap(k), html: k === 'fifty' ? '<b>50:50</b>' : ico(k) });
          lifeBtns[k] = b;
          row.append(b);
        }
        const refreshLives = () => {
          for (const k in lifeBtns) lifeBtns[k].classList.toggle('used', !(st.lifelines[k] > 0));
        };
        const clock = h('div', { class: 'tc-clock' });
        const hud = h('div', { class: 'tc-hud' }, hasLife ? row : null, st.mode === 'time' ? clock : null);
        if (!hasLife && st.mode !== 'time') hud.append(h('div', { class: 'tc-modetag' }, t(`mode.${st.mode}`)));
        const qbar = h('div', { class: 'tc-qbar' }, h('i'));

        // --- chip / panel / answers ---
        const chipTxt = () => (total ? t('qOf', { n: step, m: total }) : t('qCount', { n: st.qs.length }));
        const chip = h('div', { class: 'tc-qchip' }, h('span', null, chipTxt()));
        const qtext = h('div', { class: `tc-qtext ${v.q.length > 150 ? 'xs' : v.q.length > 100 ? 'sm' : ''}` }, v.q);
        const panel = h('div', { class: 'tc-qpanel' }, h('div', { class: 'in' }, qtext));
        const ansEls = v.a.map((a, i) => h('button', { class: 'tc-ans', style: { '--i': i }, onclick: () => pickAns(i), html: `<i>${L[i]})</i><span></span>` }));
        ansEls.forEach((b, i) => (b.querySelector('span').textContent = v.a[i]));
        const answers = h('div', { class: 'tc-answers', role: 'group' }, ansEls);
        st.hidden.forEach((i) => ansEls[i].classList.add('gone'));

        const prizeVal = M.ladder ? money(LADDER[step - 1], app.lang) : `${t('points')} ${st.points}`;
        const prize = h('div', { class: 'tc-prize' }, prizeVal);
        const stakes = M.ladder ? h('div', { class: 'tc-stakes' }, t('stakes', { w: money(prizeOnWrong(step), app.lang), s: money(prizeOnStop(step), app.lang) })) : null;
        const confirmBtn = h('button', { class: 'tc-btn red confirm', disabled: true, onclick: () => confirm() }, t('confirm'));
        const stopBtn = M.ladder ? h('button', { class: 'tc-btn dark stop', onclick: () => askStop() }, t('stop')) : st.mode === 'time' || st.mode === 'daily' || st.mode === 'quick' || st.mode === 'themes' ? h('button', { class: 'tc-btn dark stop', onclick: () => askQuit() }, t('quit')) : null;
        const actions = h('div', { class: 'tc-actions' }, stopBtn, confirmBtn);
        const expBox = h('div', { class: 'tc-explain hidden' });
        put(el, hud, qbar, chip, panel, answers, h('div', { class: 'tc-bottom' }, prize, stakes, actions), expBox);

        // --- timers ---
        let tickId = null;
        if (st.mode === 'time') {
          let last = performance.now();
          const upd = () => {
            clock.innerHTML = `${ico('clock')}<b>${Math.max(0, Math.ceil(st.timeLeft))}s</b><span>${t('hits', { n: st.correct })}</span>`;
            clock.classList.toggle('low', st.timeLeft <= 10);
          };
          upd();
          tickId = sc.every(() => {
            const now = performance.now();
            if (!st.qs.length) return;
            if (!cur(st).res) st.timeLeft -= (now - last) / 1000;
            last = now;
            if (!busy && st.timeLeft <= 0) {
              st.timeLeft = 0;
              upd();
              audio.timeup();
              resolve({ kind: 'timeup' });
              return;
            }
            if (Math.ceil(st.timeLeft) !== +clock.dataset.s) {
              clock.dataset.s = Math.ceil(st.timeLeft);
              if (st.timeLeft <= 10) audio.tick(st.timeLeft <= 5);
            }
            upd();
          }, 200);
        }
        if (st.opts.timer && !st.qs[st.qs.length - 1].res) {
          const total_ms = st.opts.timer * 1000;
          const fill = qbar.firstChild;
          qbar.classList.add('on');
          let lastS = -1;
          const id = sc.every(() => {
            if (busy) return;
            const left = total_ms - (performance.now() - t0);
            fill.style.width = `${Math.max(0, (100 * left) / total_ms)}%`;
            const s = Math.ceil(left / 1000);
            if (s !== lastS && s <= 5 && s > 0) audio.tick(s <= 3);
            lastS = s;
            if (left <= 0) {
              sc.stopEvery(id);
              reveal(null);
            }
          }, 100);
        }

        // --- interactions ---
        function pickAns(i) {
          if (busy || ansEls[i].classList.contains('gone')) return;
          sel = i;
          ansEls.forEach((b, k) => b.classList.toggle('sel', k === i));
          confirmBtn.disabled = false;
          audio.pick();
        }
        function confirm() {
          if (busy || sel === null) return;
          reveal(sel);
        }
        async function reveal(pick) {
          if (busy) return;
          busy = true;
          confirmBtn.disabled = true;
          const ms = performance.now() - t0;
          audio.lock();
          el.classList.add('locked');
          const decisive = M.ladder && step >= 10;
          if (pick !== null) ansEls[pick].classList.add('final');
          if (M.ladder) {
            if (decisive) {
              el.classList.add('tc-suspense');
              audio.scene('suspense', 0.6);
              audio.suspense(2.4);
              await sc.wait(2600);
            } else {
              audio.suspense(1.1);
              await sc.wait(1200);
            }
          } else await sc.wait(450);
          if (sc.dead || !alive()) return;
          const out = answer(st, bank, pick, ms);
          save();
          el.classList.remove('tc-suspense');
          ansEls[v.c].classList.add('right');
          if (!out.right && pick !== null) ansEls[pick].classList.add('bad');
          ansEls.forEach((b, i) => {
            if (i !== v.c && i !== pick) b.classList.add('dim');
          });
          if (out.right) {
            audio.scene('question', 0.6);
            audio.correct();
          } else {
            audio.scene('lose', 0.5);
            audio.wrong();
            app.ctx.sfx.vibrate([60, 40, 90]);
          }
          if (st.mode === 'time') {
            if (out.timePenalty) put(el, h('div', { class: 'tc-float bad' }, `-${out.timePenalty}s`));
            if (out.timeBonus) put(el, h('div', { class: 'tc-float good' }, `+${out.timeBonus}s`));
            if (out.gained) put(el, h('div', { class: 'tc-float gold' }, `+${out.gained}`));
          }
          if (out.gained && st.mode !== 'time') prize.textContent = `${t('points')} ${st.points}  (+${out.gained})`;
          if (M.ladder) {
            await sc.wait(1700);
            if (sc.dead) return;
            return resolve({ kind: 'answer', out });
          }
          if (st.mode === 'time') {
            await sc.wait(out.right ? 650 : 1100);
            if (sc.dead) return;
            return resolve({ kind: 'answer', out });
          }
          // quick / themes / daily: inline explanation + next
          showExplain(v, expBox, t);
          expBox.classList.remove('hidden');
          el.classList.add('explaining');
          const nextBtn = h('button', { class: 'tc-btn red big', onclick: () => resolve({ kind: 'answer', out }) }, out.ended ? t('seeResult') : t('nextQ'));
          expBox.append(nextBtn);
          expBox.scrollIntoView?.({ block: 'nearest' });
        }
        async function askStop() {
          if (busy) return;
          const ok = await confirmBox(app, { title: t('stop.title'), text: t('stop.text', { p: money(prizeOnStop(step), app.lang) }), yes: t('stop.yes'), no: t('stop.no') });
          if (ok && !busy && !sc.dead) resolve({ kind: 'stop' });
        }
        async function askQuit() {
          if (busy) return;
          const ok = await confirmBox(app, { title: t('quit.title'), text: t('quit.text'), yes: t('quit.yes'), no: t('quit.no'), danger: true });
          if (ok && !sc.dead) {
            stop(st);
            resolve({ kind: 'stop' });
          }
        }

        // --- lifelines ---
        function openHelp() {
          if (busy) return;
          const s = app.sheets.open({
            title: t('help.title'),
            body: lifelineRows(app, (k) => (s.close(k)), st.lifelines),
            actions: [{ label: t('close'), value: null }],
          });
          s.done.then((k) => k && useLifeline(k));
        }
        function useLifeline(k) {
          if (busy) return;
          if (k === 'fifty') {
            const hide = useFifty(st, bank);
            if (!hide) return;
            audio.fifty();
            hide.forEach((i) => {
              ansEls[i].classList.add('gone');
              if (sel === i) {
                sel = null;
                ansEls[i].classList.remove('sel');
                confirmBtn.disabled = true;
              }
            });
          } else if (k === 'crowd') {
            const r = useCrowd(st, bank);
            if (!r) return;
            audio.crowdAid();
            showCrowd(r);
          } else if (k === 'phone') {
            const r = usePhone(st, bank);
            if (!r) return;
            audio.pickup();
            phoneFlow(app, st, bank, v, sc);
          } else if (k === 'swap') {
            if (!useSwap(st, bank)) return;
            audio.swap();
            save();
            return resolve({ kind: 'swapped' });
          }
          save();
          refreshLives();
        }
        function showCrowd(r) {
          const bars = h('div', { class: 'tc-crowd' }, r.map((p, i) => h('div', { class: `cb ${p === 0 ? 'gone' : ''}` }, h('b', null, `${p}%`), h('div', { class: 'bar' }, h('i', { style: { height: '0%' } })), h('span', null, L[i]))));
          const s = app.sheets.open({ title: t('life.crowd.n'), body: h('div', null, bars, h('p', { class: 'tc-note' }, t('crowd.note'))), actions: [{ label: t('close'), value: true, primary: true }] });
          requestAnimationFrame(() => requestAnimationFrame(() => [...bars.querySelectorAll('.bar i')].forEach((b, i) => (b.style.height = `${r[i]}%`))));
          void s;
        }
        // reopen results of used lifelines
        const reopen = (k) => {
          if (k === 'crowd' && st.aids.crowd) showCrowd(st.aids.crowd);
          if (k === 'phone' && st.aids.phone) phoneFlow(app, st, bank, v, sc, true);
        };
        function lifeTap(k) {
          if ((k === 'crowd' || k === 'phone') && !(st.lifelines[k] > 0) && st.aids[k]) return busy ? null : reopen(k);
          openHelp();
        }
        refreshLives();

        // --- entrance ---
        audio.scene('question');
        audio.stinger(M.ladder ? step : 4);
        ansEls.forEach((b, i) => sc.later(() => audio.optionIn(i), 350 + i * 130));
        // a resumed, already-answered question never reaches here (handled by the loop)
        void t0;
      },
      { bgMode: 'stands', back: () => (leaveMatch(app, st), true) },
    );
  }).then(async (r) => {
    if (r.kind === 'swapped') return questionScreen(app, st, save, alive);
    return r;
  });
}

function showExplain(v, box, t) {
  box.append(h('p', { class: 'tc-exp' }, v.exp), srcLinks(v.src, t), h('p', { class: 'tc-corr' }, `${t('correctWas')} ${L[v.c]}) ${v.a[v.c]}`));
}
function srcLinks(src, t) {
  return h('div', { class: 'tc-src' }, h('small', null, t('sources')), (src || []).map((s) => h('a', { href: s.u, class: 'tc-srclink', onclick: (e) => { e.preventDefault(); try { window.open(s.u, '_blank', 'noopener,noreferrer'); } catch { /* offline */ } } }, s.n)));
}

async function leaveMatch(app, st) {
  const t = app.t;
  const ok = await confirmBox(app, { title: t('leave.title'), text: t('leave.text'), yes: t('leave.yes'), no: t('leave.no'), danger: true });
  if (ok) {
    matchId++;
    modes(app);
  }
}

// ------------------------------------------------------------------ phone call
const IDOL_TONE_ROLE = (i) => POS[i.pos];
function idolAvatar(i, card = false) {
  return h('div', { class: `tc-avatar ${card ? 'card' : ''}` }, h('img', { src: card ? idolCard(i.id) : idolPortrait(i.id), alt: i.name, draggable: 'false' }));
}
function phoneFlow(app, st, bank, v, sc, reopen = false) {
  const { t, audio } = app;
  const ph = st.aids.phone;
  const lang = app.lang;
  const body = h('div', { class: 'tc-callwrap' });
  const sheet = app.sheets.open({ title: t('call.title'), body, actions: [], dismissible: !!ph.hint, cls: 'call' });
  const foot = h('p', { class: 'tc-calldisc' }, t('call.disclaimer'));
  const ring = (i, hint) => {
    body.replaceChildren(
      h('div', { class: 'tc-callbox' }, h('div', { class: 'tc-frame' }, idolAvatar(i)), h('div', { class: 'tc-wave l' }, ...Array.from({ length: 7 }, () => h('i'))), h('div', { class: 'tc-wave r' }, ...Array.from({ length: 7 }, () => h('i')))),
      h('div', { class: 'tc-callname' }, i.name),
      h('div', { class: 'tc-callrole' }, `${IDOL_TONE_ROLE(i)[lang]} · ${i.years}`),
    );
    const speech = h('div', { class: 'tc-speech' });
    const hang = h('button', { class: 'tc-hang', 'aria-label': t('call.hang'), onclick: () => sheet.close(true), html: ico('phone') });
    body.querySelector('.tc-frame').append(hang);
    body.append(speech, foot);
    const full = idolText(t, hint);
    if (reopen || reduced()) {
      body.classList.add('talking');
      speech.textContent = full;
      return;
    }
    speech.textContent = t('call.calling');
    body.classList.add('ringing');
    audio.ring(2);
    sc.later(() => {
      if (!document.body.contains(speech)) return;
      body.classList.remove('ringing');
      body.classList.add('talking');
      audio.pickup();
      speech.textContent = '';
      let n = 0;
      const id = setInterval(() => {
        if (!document.body.contains(speech)) return clearInterval(id);
        n += 2;
        speech.textContent = full.slice(0, n);
        if (n >= full.length) clearInterval(id);
      }, 28);
      sc.later(() => clearInterval(id), full.length * 20 + 800);
    }, 2300);
  };
  if (ph.hint) return ring(IDOLS.find((x) => x.id === ph.hint.idol), ph.hint);
  // choose one of the 3 offered idols
  body.append(
    h('p', { class: 'tc-sheet-text' }, t('call.choose')),
    h('div', { class: 'tc-offer' }, ph.offer.map((id) => {
      const i = IDOLS.find((x) => x.id === id);
      return h('button', { class: 'tc-idol', 'aria-label': i.name, onclick: () => { audio.tap(); const hint = callIdol(st, bank, id); app.saveResume(serialize(st)); ring(i, hint); } }, idolAvatar(i, true), h('small', null, i.years));
    })),
    foot,
  );
}
function idolText(t, hint) {
  const base = t(`hint.${hint.tone}.${hint.variant}`, { letter: 'ABCD'[hint.letter], ans: hint.answer });
  return hint.clue ? `${base} ${t('hint.ctx', { clue: hint.clue })}` : base;
}

// ------------------------------------------------------------------ ladder screens
function ladderRows(app, hi, climbFrom) {
  const wrap = h('div', { class: 'tc-ladder' });
  for (let i = LADDER.length - 1; i >= 0; i--) {
    const s = i + 1;
    const safe = SAFE_STEPS.includes(s);
    wrap.append(h('div', { class: `tc-rung ${safe ? 'safe' : ''} ${s === 15 ? 'top' : ''} ${s === (climbFrom ?? hi) ? 'cur' : ''} ${s < (climbFrom ?? hi) ? 'past' : ''}`, 'data-s': s }, h('span', { class: 'n' }, s), h('b', null, money(LADDER[i], app.lang)), safe ? h('i', { html: ico('lock') }) : null));
  }
  return wrap;
}
function ladderView(app, st, from, to, { quick = false } = {}) {
  const { t, audio } = app;
  return new Promise((resolve) => {
    app.show(
      (el, sc) => {
        el.classList.add('tc-ladderview');
        const rows = ladderRows(app, to, from >= 1 ? from : 0);
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          resolve();
        };
        put(el, 
          h('div', { class: 'tc-lhead' }, h('div', { class: 'tc-crest sm', html: crest({ stars: true }) }), h('div', { class: 'tc-lt' }, h('b', null, 'TRICOLOR'), h('span', null, t('title2')))),
          rows,
          h('p', { class: 'tc-lfoot' }, t('ladderFoot')),
          h('button', { class: 'tc-btn red', onclick: go }, t('continueBtn')),
        );
        audio.scene('question');
        const cr = rows.querySelector('.cur');
        cr?.scrollIntoView?.({ block: 'center' });
        if (quick || from === to) {
          rows.querySelectorAll('.cur').forEach((x) => x.classList.remove('cur'));
          rows.querySelector(`[data-s="${to}"]`)?.classList.add('cur');
          sc.later(go, 1200);
          return;
        }
        sc.later(() => {
          rows.querySelectorAll('.cur').forEach((x) => x.classList.remove('cur'));
          const nx = rows.querySelector(`[data-s="${to}"]`);
          nx?.classList.add('cur', 'arrive');
          rows.querySelector(`[data-s="${from}"]`)?.classList.add('past');
          audio.climb(to);
          if (SAFE_STEPS.includes(from)) audio.milestone();
        }, 500);
        sc.later(go, SAFE_STEPS.includes(from) ? 2900 : 2100);
      },
      { bgMode: 'stands', back: () => (leaveMatch(app, st), true) },
    );
  });
}

function ladderResult(app, st, out) {
  const { t, audio, bank } = app;
  const v = currentView(st, bank);
  return new Promise((resolve) => {
    app.show(
      (el, sc) => {
        const right = out.right;
        el.classList.add('tc-result', right ? 'win' : 'lose');
        const safe = right && SAFE_STEPS.includes(out.step);
        const box = h('div', { class: 'tc-explain flat' });
        showExplain(v, box, t);
        const lastWin = right && out.won;
        put(el, 
          h('div', { class: 'tc-crest md', html: crest({ stars: true }) }),
          h('h2', { class: 'tc-big' }, right ? t('right') : t('wrong')),
          right
            ? h('div', { class: 'tc-hex' }, money(LADDER[out.step - 1], app.lang))
            : h('div', { class: 'tc-hex dark' }, h('small', null, t('youTake')), h('b', null, money(out.prize ?? st.prize, app.lang))),
          safe ? h('div', { class: 'tc-safe', html: ico('lock') + ' ' }, h('span', null, t('safeReached'))) : null,
          box,
          h('button', { class: 'tc-btn red big', onclick: () => resolve() }, lastWin ? t('seeResult') : right ? t('nextQ') : t('seeResult')),
          h('div', { class: 'tc-crowdsil', html: crowdSil(right ? 3 : 9) }),
        );
        audio.scene(right ? 'win' : 'lose', 0.6);
        if (right) {
          app.ctx.ui?.confetti?.(40);
          if (safe) audio.milestone();
        }
        void sc;
      },
      { bgMode: right_bg(out), back: () => (leaveMatch(app, st), true) },
    );
  });
}
const right_bg = (out) => (out.right ? 'gold' : 'dim');

// ------------------------------------------------------------------ finish + results
function finish(app, st) {
  const { bank, P } = app;
  const sum = summary(st, bank);
  const x = { now: Date.now(), dailyStreak: 0 };
  if (st.mode === 'daily' && st.opts.dayKey) {
    recordDaily(app.daily, st.opts.dayKey, { score: sum.score, correct: sum.correct, total: sum.answered || 10 });
    x.dailyStreak = app.daily.streak;
    app.saveDaily();
  }
  const res = recordMatch(P, sum, x);
  app.saveP();
  if (st.mode !== 'daily') app.setRecent(pushRecent(app.recent, st.sel.used, recentLimit(bank.length)));
  app.clearResume();
  if (sum.answered > 0 || st.mode !== 'time') app.ctx.addXP?.(xpFor(sum));
  matchId++;
  const won = st.outcome === 'won' && st.mode === 'main';
  if (won) congrats(app, st, sum, res);
  else resultsView(app, st, sum, res);
}

function congrats(app, st, sum, res) {
  const { t, audio } = app;
  app.show(
    (el) => {
      el.classList.add('tc-congrats');
      put(el, 
        h('div', { class: 'tc-cup', html: trophy() }),
        h('h2', { class: 'tc-big gold' }, t('congrats')),
        h('p', { class: 'tc-reach' }, t('reached'), h('b', null, t('oneMillion'))),
        h('div', { class: 'tc-champ' }, t('champion')),
        res.newAch.length ? achBox(app, res.newAch) : null,
        h('div', { class: 'tc-congbtns' },
          h('button', { class: 'tc-btn red big', onclick: () => app.start(st.mode) }, t('playAgain')),
          h('button', { class: 'tc-btn dark', onclick: () => stats(app) }, t('seeStats')),
          h('div', { class: 'tc-links' }, h('button', { onclick: () => resultsView(app, st, sum, { newAch: [], newRecords: [] }) }, t('details')), h('button', { onclick: () => reviewView(app, st, sum, () => congrats(app, st, sum, { newAch: [] })) }, t('review'))),
        ),
        h('div', { class: 'tc-crowdsil', html: crowdSil(5) }),
      );
      audio.scene('win', 0.4);
      audio.million();
      app.ctx.ui?.confetti?.(140);
      setTimeout(() => app.ctx.ui?.confetti?.(100), 1200);
    },
    { bgMode: 'gold', back: () => (modes(app), true) },
  );
}

const achBox = (app, ids) =>
  h('div', { class: 'tc-newach' }, ids.map((id) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    return h('div', { class: 'na' }, h('span', null, a.icon), h('div', null, h('small', null, app.t('ach.new')), h('b', null, app.t(`ach.${id}.n`))));
  }));

function resultsView(app, st, sum, res) {
  const { t, audio } = app;
  const M = MODES[st.mode];
  const cats = Object.entries(sum.cats).sort((a, b) => b[1] - a[1]);
  app.show(
    (el) => {
      el.classList.add('tc-results');
      const head =
        st.outcome === 'won' ? t('res.won') : st.outcome === 'stopped' ? t('res.stopped') : st.outcome === 'lost' ? t('res.lost') : st.outcome === 'timeup' || st.outcome === 'exhausted' ? t('res.timeup') : st.outcome === 'quit' ? t('res.quit') : t('res.finished');
      const newRec = res.newRecords?.length;
      put(el, 
        h('div', { class: 'tc-crest md', html: crest({ stars: true }) }),
        h('h2', { class: 'tc-big sm' }, head),
        h('div', { class: 'tc-hex' }, h('small', null, M.ladder ? t('prizeWon') : t('score')), h('b', null, fmtScore(app, st.mode, sum.score))),
        newRec ? h('div', { class: 'tc-newrec' }, '★ ', t('newRecord')) : null,
        h('div', { class: 'tc-resgrid' },
          h('div', null, h('b', null, sum.correct), h('small', null, t('res.correct'))),
          h('div', null, h('b', null, sum.wrong), h('small', null, t('res.wrong'))),
          h('div', null, h('b', null, `${sum.hit}%`), h('small', null, t('res.hit'))),
          h('div', null, h('b', null, fmtDur(sum.ms)), h('small', null, t('res.time'))),
        ),
        st.mode === 'main' || st.mode === 'expert' ? h('p', { class: 'tc-note c' }, t('res.step', { n: sum.reached })) : null,
        cats.length ? h('div', { class: 'tc-catchips' }, cats.map(([c, n]) => h('span', null, `${t(`cat.${c}`)} · ${n}`))) : null,
        res.newAch?.length ? achBox(app, res.newAch) : null,
        h('div', { class: 'tc-congbtns' },
          st.mode !== 'daily' ? h('button', { class: 'tc-btn red big', onclick: () => app.start(st.mode, { themeId: st.opts.themeId, timer: st.opts.timer }) }, t('playAgain')) : null,
          h('button', { class: 'tc-btn dark', onclick: () => modes(app) }, t('otherMode')),
          h('button', { class: 'tc-btn dark', onclick: () => reviewView(app, st, sum, () => resultsView(app, st, sum, { newAch: [], newRecords: [] })) }, t('review')),
        ),
      );
      audio.scene(sum.correct >= (M.total || 10) / 2 ? 'win' : 'lose', 0.8);
      if (res.newAch?.length) audio.ach();
    },
    { bgMode: 'dim', back: () => (modes(app), true) },
  );
}

function reviewView(app, st, sum, back) {
  const { t } = app;
  app.show(
    (el) => {
      el.classList.add('tc-rules');
      put(el, 
        h('div', { class: 'tc-top' }, h('button', { class: 'tc-round', 'aria-label': t('back'), onclick: back, html: ico('back') }), h('div', { class: 'tc-top-title' }, t('review')), h('span', { class: 'tc-round ghost' })),
        h('div', { class: 'tc-scroll' }, sum.review.map((r, i) => {
          const v = r.view;
          if (!v) return null;
          const ok = r.res === 'right';
          return h('div', { class: `tc-rev ${ok ? 'ok' : 'ko'}` },
            h('div', { class: 'rq' }, h('i', { html: ico(ok ? 'check' : 'cross') }), h('b', null, `${i + 1}. ${v.q}`)),
            r.pick !== null && r.pick !== v.c ? h('p', { class: 'ya' }, `${t('yourAnswer')} ${L[r.pick]}) ${v.a[r.pick]}`) : r.pick === null ? h('p', { class: 'ya' }, t('noAnswer')) : null,
            h('p', { class: 'ca' }, `${t('correctWas')} ${L[v.c]}) ${v.a[v.c]}`),
            h('p', { class: 'ex' }, v.exp),
            srcLinks(v.src, t),
          );
        }), sum.review.length ? null : h('p', { class: 'tc-empty' }, t('rank.empty'))),
      );
    },
    { bgMode: 'dim', back: () => (back(), true) },
  );
}
