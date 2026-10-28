// The show: 16 questions up the prize ladder with lifelines, timer, the
// "final answer?" confirmation, suspenseful reveals, and the results screen.

import { h } from '../../js/core/ui.js';
import { PRIZES, LAST, TIME_PER_Q, SKIPS, levelD, isMilestone, stakes, money, dealCards, CARD_REMOVES, eliminate, studentAdvice, audienceVotes, fmtInt } from './engine.js';
import { ico, hostSVG } from './art.js';
import { makeStage, studentSVG } from './kit.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const SUIT = { A: '♠', 2: '♥', 3: '♦', K: '♣' };
const RING = 2 * Math.PI * 18;
const oneOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function playShow(app, { league = false } = {}) {
  const { t, lang, pick, fx, sfx } = app;
  const $ = (n, opts) => money(n, lang, opts);
  let leaveAsk = null;

  app.show(
    (el, scope) => {
      const G = {
        i: 0,
        q: null,
        hidden: new Set(),
        used: { cards: false, students: false, audience: false },
        skips: SKIPS,
        usedIds: new Set(),
        lastSet: null,
        accepting: false,
        busy: false,
        revealing: false,
        correct: 0,
        lifelines: 0,
        done: false,
      };
      const timer = { left: TIME_PER_Q, active: false, holds: 0, last: performance.now(), whole: TIME_PER_Q };
      el._gm = G; // read by automated tests

      // ---------- DOM ----------
      const stage = makeStage(scope, { outfit: app.P.outfit, variant: 'game', hostName: t('hostName') });
      const qNum = h('span');
      const qChip = h('button', { class: 'g-million-qchip', 'aria-label': t('ladderTitle'), onclick: () => ladder.open() }, h('span', { html: ico('ladder') }), qNum);
      const worthVal = h('b');
      const worth = h('div', { class: 'g-million-worth' }, h('small', null, t('worth')), worthVal);
      const ringFg = svgEl('circle', { cx: 22, cy: 22, r: 18, class: 'fg', 'stroke-dasharray': RING.toFixed(2), 'stroke-dashoffset': '0' });
      const ringSvg = svgEl('svg', { viewBox: '0 0 44 44' }, svgEl('circle', { cx: 22, cy: 22, r: 18, class: 'bg' }), ringFg);
      const timerNum = h('b', null, TIME_PER_Q);
      const timerEl = h('div', { class: 'g-million-timer', role: 'timer' }, ringSvg, timerNum);
      const head = h('div', { class: 'g-million-qhead' }, qChip, worth, timerEl);

      const qImg = h('img', { class: 'g-million-qimg', alt: '', hidden: true, draggable: 'false' });
      const qText = h('p', { class: 'g-million-qtext' });
      const qCard = h('div', { class: 'g-million-qcard' }, h('span', { class: 'g-million-qglow' }), qImg, qText);

      const optEls = LETTERS.map((L, i) =>
        h(
          'button',
          { class: 'g-million-opt pre', 'data-silent': '', onclick: () => choose(i) },
          h('span', { class: 'g-million-letter' }, L),
          h('span', { class: 'g-million-otext' }),
          h('span', { class: 'g-million-hints' }),
        ),
      );
      const optsEl = h('div', { class: 'g-million-opts' }, optEls);

      const LL = [
        { id: 'cards', icon: 'cards', label: t('llCards') },
        { id: 'students', icon: 'students', label: t('llStudents') },
        { id: 'audience', icon: 'audience', label: t('llAudience') },
        { id: 'skip', icon: 'skip', label: t('llSkip') },
      ];
      const llEls = {};
      const llRow = h(
        'div',
        { class: 'g-million-lls' },
        LL.map((l) => {
          const badge = l.id === 'skip' ? h('b', { class: 'g-million-llbadge' }, SKIPS) : null;
          llEls[l.id] = { btn: h('button', { class: 'g-million-ll', onclick: () => useLifeline(l.id), 'aria-label': l.label }, h('span', { class: 'g-million-llico', html: ico(l.icon) }), h('span', { class: 'g-million-lllabel' }, l.label), badge), badge };
          return llEls[l.id].btn;
        }),
      );

      const wrongVal = h('b');
      const stopVal = h('b');
      const rightVal = h('b');
      const stopBtn = h('button', { class: 'g-million-stop', onclick: () => askStop() }, h('small', null, t('stop')), stopVal);
      const bar = h(
        'div',
        { class: 'g-million-bar' },
        h('div', { class: 'g-million-stake wrong' }, h('small', null, t('ifWrong')), wrongVal),
        stopBtn,
        h('div', { class: 'g-million-stake right' }, h('small', null, t('ifRight')), rightVal),
      );
      const board = h('div', { class: 'g-million-board' }, head, qCard, optsEl, llRow, bar);
      const ladder = buildLadder(scope);
      el.append(stage.el, board, ladder.el);

      // ---------- rendering ----------
      function renderStatus() {
        const st = stakes(G.i);
        qNum.textContent = t('qOf', { n: G.i + 1, total: PRIZES.length });
        worthVal.textContent = $(st.right, { upper: G.i === LAST });
        wrongVal.textContent = $(st.wrong);
        stopVal.textContent = $(st.stop);
        rightVal.textContent = $(st.right);
        stopBtn.disabled = G.i === 0;
        ladder.update(G.i);
        if (G.i === LAST) stage.screen(t('screenFinal'), $(PRIZES[LAST], { upper: true }), 'final');
        else stage.screen(t('screenQ', { n: G.i + 1 }), $(PRIZES[G.i], { upper: true }));
      }

      function renderLifelines() {
        const final = G.i === LAST;
        for (const l of LL) {
          const { btn, badge } = llEls[l.id];
          const used = l.id === 'skip' ? G.skips <= 0 : G.used[l.id];
          btn.classList.toggle('used', used);
          btn.classList.toggle('locked', final && !used);
          if (badge) badge.textContent = G.skips;
        }
      }

      function renderTimer() {
        const frac = Math.max(0, timer.left / TIME_PER_Q);
        ringFg.setAttribute('stroke-dashoffset', (RING * (1 - frac)).toFixed(2));
        timerNum.textContent = Math.ceil(timer.left);
        timerEl.classList.toggle('warn', timer.left <= 15 && timer.left > 5);
        timerEl.classList.toggle('danger', timer.left <= 5);
      }

      // ---------- timer ----------
      scope.every(() => {
        const now = performance.now();
        const dt = (now - timer.last) / 1000;
        timer.last = now;
        if (!timer.active || timer.holds > 0 || document.hidden) return;
        timer.left = Math.max(0, timer.left - dt);
        renderTimer();
        const whole = Math.ceil(timer.left);
        if (whole !== timer.whole) {
          timer.whole = whole;
          if (whole <= 10 && whole > 0) fx.tick(whole <= 5);
          else if (whole % 2 === 0 && (G.i >= 10 || whole <= 20)) fx.heartbeat();
        }
        if (timer.left <= 0) timeUp();
      }, 100);

      // ---------- questions ----------
      async function loadQuestion(skipped = false) {
        G.accepting = false;
        G.busy = true;
        const q = app.pool.pick(levelD(G.i), { exclude: G.usedIds, lastSet: G.lastSet, genChance: G.i === LAST ? 0.05 : 0.14 });
        G.q = q;
        G.usedIds.add(q.id);
        G.lastSet = q.set;
        app.pool.markSeen(q.id);
        G.hidden = new Set();
        renderStatus();
        renderLifelines();
        timer.active = false;
        timer.left = TIME_PER_Q;
        timer.whole = TIME_PER_Q;
        renderTimer();
        board.classList.toggle('final', G.i === LAST);
        optEls.forEach((o, k) => {
          o.className = 'g-million-opt pre';
          o.querySelector('.g-million-otext').textContent = pick(q.a[k]);
          o.querySelector('.g-million-hints').replaceChildren();
          o.disabled = false;
        });
        const text = pick(q.q);
        qText.textContent = text;
        qCard.classList.toggle('long', text.length > 95);
        qCard.classList.toggle('has-img', !!q.img);
        if (q.img) {
          qImg.src = q.img;
          qImg.hidden = false;
        } else {
          qImg.hidden = true;
          qImg.removeAttribute('src');
        }
        qCard.classList.remove('in', 'out');
        void qCard.offsetWidth;
        qCard.classList.add('in');
        if (skipped) stage.say(t('skipNew'), 'happy');
        else if (G.i === LAST) stage.say(t('finalAsk'), 'tense');
        else stage.say(G.i === 0 ? t('firstQ', { prize: $(PRIZES[0]) }) : t('qLine', { n: G.i + 1, prize: $(PRIZES[G.i]) }), 'happy');
        fx.stinger(G.i);
        await scope.wait(skipped ? 250 : 520);
        for (let k = 0; k < 4; k++) {
          optEls[k].classList.remove('pre');
          fx.optionIn(k);
          await scope.wait(skipped ? 110 : 230);
        }
        timer.last = performance.now();
        timer.active = true;
        G.accepting = true;
        G.busy = false;
      }

      async function intro() {
        renderStatus();
        renderLifelines();
        stage.say(league ? t('introLeague') : t('intro'), 'happy');
        fx.applause(1.4, 0.7);
        stage.cheer();
        await scope.wait(1200);
        loadQuestion();
      }

      // ---------- answering ----------
      async function choose(i) {
        if (!G.accepting || G.busy || G.hidden.has(i)) return;
        G.busy = true;
        fx.pick();
        sfx.vibrate(12);
        optEls[i].classList.add('sel');
        timer.holds++;
        stage.say(t('sureQ'), 'tense');
        const ok = await confirmAnswer(i);
        timer.holds--;
        timer.last = performance.now();
        if (scope.dead) return;
        if (!ok || !G.accepting) {
          optEls[i].classList.remove('sel');
          G.busy = false;
          if (G.accepting) stage.say(t('thinkMore'), 'happy');
          return;
        }
        await lockIn(i);
      }

      function confirmAnswer(i) {
        const copy = h('div', { class: 'g-million-opt sel mini' }, h('span', { class: 'g-million-letter' }, LETTERS[i]), h('span', { class: 'g-million-otext' }, pick(G.q.a[i])));
        const s = app.sheets.open({
          title: t('sureTitle'),
          sub: G.i === LAST ? t('sureFinal') : t('sureSub', { prize: $(stakes(G.i).wrong) }),
          body: copy,
          cls: 'confirm',
          actions: [
            { label: t('sureYes'), value: true, primary: true },
            { label: t('sureNo'), value: false },
          ],
        });
        return s.done.then((v) => v === true);
      }

      async function lockIn(i) {
        G.accepting = false;
        G.revealing = true;
        timer.active = false;
        el.classList.add('locked');
        optEls[i].classList.add('locked');
        fx.lock();
        sfx.vibrate(30);
        stage.say(oneOf([t('lock1'), t('lock2'), t('lock3')]), 'tense');
        await scope.wait(450);
        const sus = Math.min(3.8, 1.5 + G.i * 0.15);
        fx.suspense(sus);
        board.classList.add('suspense');
        await scope.wait(sus * 1000);
        board.classList.remove('suspense');
        const right = i === G.q.ok;
        optEls[G.q.ok].classList.add('correct');
        if (right) {
          G.correct++;
          optEls[i].classList.remove('sel');
          fx.correct();
          stage.cheer();
          stage.flash('good');
          stage.say(oneOf([t('right1'), t('right2'), t('right3'), t('right4')]), 'happy');
          sfx.vibrate([20, 40, 30]);
          await scope.wait(1500);
          el.classList.remove('locked');
          G.revealing = false;
          if (G.i === LAST) return win();
          const prev = G.i;
          G.i++;
          if (isMilestone(prev)) {
            fx.milestone();
            stage.cheer(true);
            stage.flash('gold');
            app.ctx.ui.confetti(70);
            stage.say(t('milestone', { prize: $(PRIZES[prev]) }), 'happy');
          }
          await climb(prev, G.i, isMilestone(prev) ? 2300 : 1300);
          loadQuestion();
        } else {
          optEls[i].classList.add('wrong');
          optEls[G.q.ok].classList.add('blink');
          fx.wrong();
          stage.flash('bad');
          qCard.classList.add('shake');
          stage.say(t('wrongLine', { letter: LETTERS[G.q.ok] }), 'sad');
          sfx.vibrate([60, 60, 140]);
          await scope.wait(2800);
          finish('wrong');
        }
      }

      async function timeUp() {
        if (!G.accepting) return;
        G.accepting = false;
        G.revealing = true;
        timer.active = false;
        el.classList.add('locked');
        fx.timeout();
        sfx.vibrate([80, 40, 80]);
        stage.flash('bad');
        stage.say(t('timeLine', { letter: LETTERS[G.q.ok] }), 'sad');
        optEls[G.q.ok].classList.add('correct', 'blink');
        await scope.wait(2800);
        finish('timeout');
      }

      async function askStop() {
        if (!G.accepting || G.busy || G.i === 0) return;
        G.busy = true;
        timer.holds++;
        const v = await app.sheets.open({
          title: t('stopTitle'),
          sub: t('stopText', { prize: $(stakes(G.i).stop) }),
          icon: ico('stop'),
          cls: 'stopq',
          actions: [
            { label: t('stopYes'), value: true, primary: true },
            { label: t('stopNo'), value: false },
          ],
        }).done;
        timer.holds--;
        timer.last = performance.now();
        if (scope.dead) return;
        G.busy = false;
        if (!v || !G.accepting) return;
        G.accepting = false;
        G.revealing = true;
        timer.active = false;
        el.classList.add('locked');
        stage.say(t('stopLine', { prize: $(stakes(G.i).stop) }), 'happy');
        fx.applause(1.4, 0.7);
        stage.cheer();
        await scope.wait(1500);
        optEls[G.q.ok].classList.add('correct', 'blink');
        stage.say(t('wasRight', { letter: LETTERS[G.q.ok] }), 'happy');
        await scope.wait(2200);
        finish('stop');
      }

      leaveAsk = async () => {
        if (G.done || G.revealing || app.sheets.count) return;
        if (G.i === 0 && !G.correct) {
          G.done = true;
          app.leaveFirst();
          return;
        }
        timer.holds++;
        const v = await app.sheets.open({
          title: t('leaveTitle'),
          sub: t('leaveText', { prize: $(stakes(G.i).stop) }),
          actions: [
            { label: t('keepPlaying'), value: false, primary: true },
            { label: t('leave'), value: true, danger: true },
          ],
        }).done;
        timer.holds--;
        timer.last = performance.now();
        if (scope.dead || !v || G.done || G.revealing) return;
        G.accepting = false;
        timer.active = false;
        finish('stop');
      };

      // ---------- lifelines ----------
      async function useLifeline(id) {
        if (!G.accepting || G.busy) return;
        if (G.i === LAST) {
          stage.say(t('noHelpFinal'), 'tense');
          llEls[id].btn.classList.remove('shake');
          void llEls[id].btn.offsetWidth;
          llEls[id].btn.classList.add('shake');
          sfx.play('error');
          return;
        }
        if (id === 'skip' ? G.skips <= 0 : G.used[id]) {
          stage.say(t('llUsed'), 'happy');
          return;
        }
        G.busy = true;
        timer.holds++;
        G.lifelines++;
        sfx.play('select');
        try {
          if (id === 'cards') await cardsLL();
          else if (id === 'students') await studentsLL();
          else if (id === 'audience') await audienceLL();
          else if (id === 'skip') {
            timer.holds--;
            await skipLL();
            return;
          }
        } finally {
          if (id !== 'skip') {
            timer.holds--;
            timer.last = performance.now();
            if (!scope.dead) G.busy = false;
          }
        }
        renderLifelines();
      }

      async function hideOptions(list) {
        for (const k of list) {
          G.hidden.add(k);
          optEls[k].classList.add('gone');
          optEls[k].disabled = true;
          fx.zap();
          await scope.wait(260);
        }
      }

      async function cardsLL() {
        G.used.cards = true;
        renderLifelines();
        stage.say(t('cardsLine'), 'happy');
        const deck = dealCards();
        let chosen = -1;
        const info = h('p', { class: 'g-million-cards-info' }, t('cardsPick'));
        const cardEls = deck.map((v, k) =>
          h(
            'button',
            { class: 'g-million-card', style: { animationDelay: `${k * 70}ms` }, onclick: () => flip(k) },
            h(
              'span',
              { class: 'g-million-card-in' },
              h('span', { class: 'g-million-card-back' }, h('i', { html: ico('star') })),
              h('span', { class: `g-million-card-front ${v === '2' || v === '3' ? 'red' : ''}` }, h('b', null, v), h('i', null, SUIT[v]), h('small', null, t('cardRemoves', { n: CARD_REMOVES[v] }))),
            ),
          ),
        );
        const s = app.sheets.open({ title: t('llCards'), sub: t('cardsSub'), body: h('div', null, h('div', { class: 'g-million-cards' }, cardEls), info), dismissible: false, cls: 'cards' });
        function flip(k) {
          if (chosen >= 0) return;
          chosen = k;
          fx.flip();
          sfx.vibrate(15);
          cardEls[k].classList.add('flipped', 'chosen');
          info.textContent = t(`card${deck[k]}`);
          info.classList.add('on');
          scope.later(() => {
            cardEls.forEach((c, j) => {
              if (j !== k) c.classList.add('flipped', 'dim');
            });
            fx.flip();
          }, 1000);
          scope.later(() => s.close(true), 2700);
        }
        await s.done;
        if (scope.dead) return;
        const n = CARD_REMOVES[deck[chosen]] || 0;
        if (n) {
          stage.say(t('cardsRemoved', { n }), 'happy');
          await hideOptions(eliminate(G.q.ok, G.hidden, n));
        } else stage.say(t('cardsKing'), 'sad');
      }

      async function studentsLL() {
        G.used.students = true;
        renderLifelines();
        stage.say(t('studentsLine'), 'happy');
        const adv = studentAdvice(G.q.d, G.q.ok, G.hidden);
        const items = adv.map((a, k) => {
          const ans = h('div', { class: 'g-million-stu-ans' }, h('span', { class: 'g-million-dots' }, h('i'), h('i'), h('i')));
          const card = h('div', { class: 'g-million-stu', style: { animationDelay: `${k * 90}ms` } }, h('div', { class: 'g-million-stu-av', html: studentSVG(k) }), h('b', { class: 'g-million-stu-name' }, t('student', { n: k + 1 })), ans);
          return { card, ans, a };
        });
        const s = app.sheets.open({
          title: t('llStudents'),
          sub: t('studentsSub'),
          body: h('div', { class: 'g-million-stus' }, items.map((x) => x.card)),
          actions: [{ label: t('thanks'), value: true, primary: true }],
          cls: 'students',
        });
        items.forEach((x, k) =>
          scope.later(() => {
            x.ans.replaceChildren(h('b', { class: 'g-million-stu-letter' }, LETTERS[x.a.pick]), h('small', null, t(`conf_${x.a.conf}`)));
            x.card.classList.add('done');
            fx.optionIn(k);
          }, 1000 + k * 750),
        );
        await s.done;
        if (scope.dead) return;
        const count = [0, 0, 0, 0];
        adv.forEach((a) => count[a.pick]++);
        count.forEach((c, k) => c && addHint(k, 'students', `${c}`));
        stage.say(t('studentsDone'), 'happy');
      }

      async function audienceLL() {
        G.used.audience = true;
        renderLifelines();
        stage.say(t('audienceLine'), 'happy');
        stage.cheer();
        fx.applause(1, 0.5);
        const pct = audienceVotes(G.q.d, G.q.ok, G.hidden);
        const bars = LETTERS.map((L, k) => {
          const fill = h('i');
          const val = h('b', null, '0%');
          return { el: h('div', { class: `g-million-abar ${G.hidden.has(k) ? 'off' : ''}` }, val, h('div', { class: 'g-million-abar-track' }, fill), h('span', { class: 'g-million-abar-l' }, L)), fill, val };
        });
        const s = app.sheets.open({
          title: t('llAudience'),
          sub: t('audienceSub'),
          body: h('div', { class: 'g-million-chart' }, bars.map((b) => b.el)),
          actions: [{ label: t('thanks'), value: true, primary: true }],
          cls: 'audience',
        });
        scope.later(() => {
          bars.forEach((b, k) => {
            b.fill.style.height = `${Math.max(pct[k], 1)}%`;
            countUp(scope, b.val, pct[k], 900, (n) => `${Math.round(n)}%`);
          });
          fx.cheer();
        }, 450);
        await s.done;
        if (scope.dead) return;
        pct.forEach((p, k) => !G.hidden.has(k) && addHint(k, 'audience', `${p}%`));
        stage.say(t('audienceDone'), 'happy');
      }

      async function skipLL() {
        G.skips--;
        renderLifelines();
        G.accepting = false;
        timer.active = false;
        stage.say(t('skipLine'), 'happy');
        fx.whoosh();
        qCard.classList.add('out');
        optEls.forEach((o) => o.classList.add('pre'));
        await scope.wait(450);
        await loadQuestion(true);
      }

      function addHint(k, kind, text) {
        const box = optEls[k].querySelector('.g-million-hints');
        box.append(h('span', { class: `g-million-hint ${kind}` }, h('span', { html: ico(kind === 'students' ? 'students' : 'audience') }), text));
      }

      // ---------- ladder climb ----------
      async function climb(from, to, ms) {
        ladder.update(from);
        ladder.open(true);
        await scope.wait(450);
        ladder.update(to);
        fx.climb(to);
        await Promise.race([scope.wait(ms), ladder.closed()]);
        ladder.close();
        await scope.wait(250);
      }

      // ---------- end ----------
      async function win() {
        G.i = LAST;
        stage.say(t('winLine'), 'happy');
        fx.million();
        stage.cheer(true);
        stage.flash('gold');
        app.ctx.ui.confetti(120);
        await scope.wait(1600);
        finish('win');
      }

      function finish(reason) {
        if (G.done) return;
        G.done = true;
        timer.active = false;
        const st = stakes(G.i);
        const prize = reason === 'win' ? PRIZES[LAST] : reason === 'stop' ? st.stop : st.wrong;
        const answered = G.correct + (reason === 'wrong' || reason === 'timeout' ? 1 : 0);
        const rewards = app.recordGame({ prize, correct: G.correct, answered, lifelines: G.lifelines, win: reason === 'win', league });
        showResults(app, { reason, prize, correct: G.correct, league, ...rewards });
      }

      intro();
    },
    {
      cls: 'g-million-play',
      back: () => {
        if (leaveAsk) leaveAsk();
        return true;
      },
    },
  );

  // Slide-up prize ladder.
  function buildLadder(scope) {
    const rows = PRIZES.map((p, i) =>
      h(
        'div',
        { class: `g-million-rung ${isMilestone(i) ? 'ms' : ''} ${i === LAST ? 'top' : ''}` },
        h('span', { class: 'n' }, i + 1),
        h('span', { class: 'v' }, money(p, lang, { upper: i === LAST })),
        isMilestone(i) || i === LAST ? h('span', { class: 's', html: ico('star') }) : h('span', { class: 's' }),
      ),
    );
    let waiters = [];
    const closeBtn = h('button', { class: 'g-million-x', 'aria-label': t('close'), html: ico('close'), onclick: () => api.close() });
    const panel = h('div', { class: 'g-million-ladder' }, h('div', { class: 'g-million-ladder-head' }, h('b', null, t('ladderTitle')), closeBtn), h('div', { class: 'g-million-rungs' }, rows.slice().reverse()));
    const wrap = h('div', { class: 'g-million-ladder-wrap', onclick: (e) => e.target === wrap && api.close() }, panel);
    const api = {
      el: wrap,
      isOpen: false,
      update(cur) {
        rows.forEach((r, i) => {
          r.classList.toggle('done', i < cur);
          r.classList.toggle('cur', i === cur);
        });
        const curRow = rows[cur];
        if (curRow && api.isOpen) curRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      open(auto = false) {
        api.isOpen = true;
        wrap.classList.add('show');
        wrap.classList.toggle('auto', auto);
        if (!auto) fx.whoosh();
      },
      close() {
        if (!api.isOpen) return;
        api.isOpen = false;
        wrap.classList.remove('show');
        waiters.forEach((w) => w());
        waiters = [];
      },
      closed: () => new Promise((res) => (api.isOpen ? waiters.push(res) : res())),
    };
    app.onBackExtra(() => {
      if (api.isOpen && !wrap.classList.contains('auto')) {
        api.close();
        return true;
      }
      return false;
    }, scope);
    return api;
  }
}

function svgEl(tag, attrs, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  children.forEach((c) => el.append(c));
  return el;
}

export function countUp(scope, el, to, ms, fmt) {
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e);
    if (k < 1) scope.raf(step);
  };
  scope.raf(step);
}

// ---------- results ----------
export function showResults(app, R) {
  const { t, lang, fx } = app;
  const win = R.reason === 'win';
  const good = win || R.reason === 'stop';
  app.show(
    (el, scope) => {
      const amount = h('div', { class: 'g-million-res-amount' }, money(0, lang));
      const chips = h(
        'div',
        { class: 'g-million-res-chips' },
        h('div', { class: 'g-million-res-chip coin' }, h('span', { html: ico('coin') }), h('b', null, `+${R.coins}`), h('small', null, t('coins'))),
        h('div', { class: 'g-million-res-chip xp' }, h('span', { html: ico('star') }), h('b', null, `+${R.xp}`), h('small', null, 'XP')),
        R.league ? h('div', { class: 'g-million-res-chip league' }, h('span', { html: ico('trophy') }), h('b', null, `+${R.leaguePts}`), h('small', null, t('leaguePts'))) : null,
      );
      const coinsRain = win
        ? h(
            'div',
            { class: 'g-million-rain', 'aria-hidden': 'true' },
            Array.from({ length: 26 }, (_, i) => h('i', { html: ico('coin'), style: { left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.35}s`, animationDuration: `${2.6 + (i % 5) * 0.4}s` } })),
          )
        : null;
      const card = h(
        'div',
        { class: `g-million-res ${win ? 'win' : good ? 'good' : 'bad'}` },
        h('div', { class: 'g-million-res-rays' }),
        coinsRain,
        h('div', { class: 'g-million-res-host', html: hostSVG(app.P.outfit, good ? 'happy' : 'sad') }),
        h('h2', { class: 'g-million-res-title' }, t(`res_${R.reason}`)),
        h('p', { class: 'g-million-res-sub' }, t('resSub', { n: R.correct, total: PRIZES.length })),
        h('div', { class: 'g-million-res-label' }, t('youTake')),
        amount,
        R.newBest ? h('div', { class: 'g-million-res-best' }, h('span', { html: ico('star') }), t('newBest')) : null,
        chips,
        R.leagueState ? h('p', { class: 'g-million-res-league' }, t('leagueTotal', { pts: fmtInt(R.leagueState.pts, lang) })) : null,
        h(
          'div',
          { class: 'g-million-res-actions' },
          h('button', { class: 'btn primary big block', onclick: () => playShow(app, { league: R.league }) }, h('span', { class: 'btn-ico', html: ico('play') }), t('playAgain')),
          h('button', { class: 'btn block', onclick: () => (R.league ? app.leagueView() : app.home()) }, R.league ? t('toLeague') : t('toMenu')),
        ),
      );
      el.append(card);
      scope.later(() => {
        if (R.prize > 0) fx.coins(win ? 12 : 6);
        countUp(scope, amount, R.prize, win ? 2200 : 1300, (n) => money(n >= R.prize ? R.prize : Math.round(n / 100) * 100, lang, { upper: win }));
      }, 350);
      if (win) {
        fx.million();
        [600, 1700, 2900].forEach((ms) => scope.later(() => app.ctx.ui.confetti(110), ms));
      } else if (good) fx.applause(1.6, 0.7);
      else app.sfx.play('lose');
    },
    {
      cls: 'g-million-resview',
      back: () => {
        if (R.league) app.leagueView();
        else app.home();
        return true;
      },
    },
  );
}
