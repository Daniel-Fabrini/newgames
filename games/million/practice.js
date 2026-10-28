// Practice: pick a theme and answer endless questions with no prize pressure.

import { h } from '../../js/core/ui.js';
import { SETS } from './questions/index.js';
import { GEN_SET } from './gen.js';
import { ico } from './art.js';
import { makeStage } from './kit.js';

const LETTERS = ['A', 'B', 'C', 'D'];
export const MIX = 'mix';
const THEME_ICON = {
  mix: '🎲',
  countries: '🗺️',
  geo: '🌍',
  science: '🔬',
  history: '🏛️',
  sports: '⚽',
  entertainment: '🎬',
  general: '💡',
  nature: '🌿',
  food: '🍲',
  arts: '🎨',
  tech: '💻',
  brazil: '🦜',
  language: '📚',
};
const DIFFS = ['auto', 1, 2, 3, 4];

export function practicePicker(app, { root = false } = {}) {
  const { t } = app;
  app.show(
    (el) => {
      let diff = app.store.get('practiceDiff', 'auto');
      if (!DIFFS.includes(diff)) diff = 'auto';
      const chips = h('div', { class: 'chips g-million-diffs' });
      const renderChips = () =>
        chips.replaceChildren(
          ...DIFFS.map((d) =>
            h(
              'button',
              {
                class: `chip ${d === diff ? 'active' : ''}`,
                onclick: () => {
                  diff = d;
                  app.store.set('practiceDiff', d);
                  renderChips();
                },
              },
              t(`diff_${d}`),
            ),
          ),
        );
      renderChips();
      const themes = [MIX, GEN_SET, ...SETS.filter((s) => app.pool.count(s) > 0)];
      const stats = app.P.practice || {};
      const grid = h(
        'div',
        { class: 'g-million-themes' },
        themes.map((id, i) => {
          const n = app.pool.count(id === MIX ? null : id);
          const best = stats[id] && stats[id].best;
          return h(
            'button',
            { class: 'g-million-theme', style: { animationDelay: `${i * 30}ms` }, onclick: () => practicePlay(app, { theme: id, diff, root }) },
            h('span', { class: 'g-million-theme-ico' }, THEME_ICON[id] || '❓'),
            h('b', null, t(`set_${id}`)),
            h('small', null, id === GEN_SET || id === MIX ? t('endless') : t('nQuestions', { n })),
            best ? h('span', { class: 'g-million-theme-best', html: `${ico('fire')}${best}` }) : null,
          );
        }),
      );
      el.append(
        h(
          'div',
          { class: 'g-million-head' },
          h('div', { class: 'g-million-head-ico', html: ico('book') }),
          h('div', null, h('h2', null, t('practiceTitle')), h('p', null, t('practiceSub'))),
        ),
        h('div', { class: 'g-million-label' }, t('difficulty')),
        chips,
        h('div', { class: 'g-million-label' }, t('chooseTheme')),
        grid,
      );
    },
    {
      cls: 'screen g-million-scroll',
      title: t('practiceTitle'),
      back: () => {
        if (root) return false;
        app.home();
        return true;
      },
    },
  );
}

export function practicePlay(app, { theme, diff, root }) {
  const { t, pick, fx, sfx } = app;
  const sets = theme === MIX ? null : [theme];
  let finishFn = null;
  app.show(
    (el, scope) => {
      const S = { d: diff === 'auto' ? 1 : diff, run: 0, best: 0, right: 0, total: 0, coins: 0, q: null, used: new Set(), accepting: false, lastSet: null, ended: false };
      const stage = makeStage(scope, { outfit: app.P.outfit, variant: 'mini', hostName: t('hostName') });
      stage.screen(t('practiceTitle'), t(`set_${theme}`));
      const streakEl = h('b');
      const scoreEl = h('b');
      const dEl = h('span', { class: 'g-million-dpill' });
      const hud = h(
        'div',
        { class: 'g-million-phud' },
        h('div', { class: 'g-million-pstat fire' }, h('span', { html: ico('fire') }), streakEl),
        h('div', { class: 'g-million-pstat' }, h('span', { html: ico('check') }), scoreEl),
        dEl,
      );
      const qImg = h('img', { class: 'g-million-qimg', alt: '', hidden: true, draggable: 'false' });
      const qText = h('p', { class: 'g-million-qtext' });
      const qCard = h('div', { class: 'g-million-qcard' }, h('span', { class: 'g-million-qglow' }), qImg, qText);
      const optEls = LETTERS.map((L, i) =>
        h('button', { class: 'g-million-opt pre', 'data-silent': '', onclick: () => answer(i) }, h('span', { class: 'g-million-letter' }, L), h('span', { class: 'g-million-otext' }), h('span', { class: 'g-million-hints' })),
      );
      const nextBtn = h('button', { class: 'btn primary block g-million-next', hidden: true, onclick: () => next() }, t('nextQ'));
      const endBtn = h('button', { class: 'btn small g-million-endbtn', onclick: () => finish() }, t('endPractice'));
      const board = h('div', { class: 'g-million-board practice' }, hud, qCard, h('div', { class: 'g-million-opts' }, optEls), h('div', { class: 'g-million-pfoot' }, nextBtn, endBtn));
      el.append(stage.el, board);

      function render() {
        streakEl.textContent = S.run;
        scoreEl.textContent = `${S.right}/${S.total}`;
        dEl.textContent = t(`diff_${S.d}`);
        dEl.dataset.d = S.d;
      }

      async function next() {
        nextBtn.hidden = true;
        S.accepting = false;
        const opts = { sets, exclude: S.used, lastSet: S.lastSet, genChance: theme === MIX ? 0.15 : 0 };
        let q = app.pool.pick(S.d, opts);
        if (!q) {
          // Went through the whole theme in this session: start over.
          S.used.clear();
          q = app.pool.pick(S.d, opts);
        }
        if (!q) {
          stage.say(t('noMore'), 'sad');
          return;
        }
        S.q = q;
        S.used.add(q.id);
        S.lastSet = q.set;
        app.pool.markSeen(q.id);
        render();
        const text = pick(q.q);
        qText.textContent = text;
        qCard.classList.toggle('long', text.length > 95);
        qCard.classList.toggle('has-img', !!q.img);
        if (q.img) {
          qImg.src = q.img;
          qImg.hidden = false;
        } else qImg.hidden = true;
        qCard.classList.remove('in');
        void qCard.offsetWidth;
        qCard.classList.add('in');
        optEls.forEach((o, k) => {
          o.className = 'g-million-opt pre';
          o.querySelector('.g-million-otext').textContent = pick(q.a[k]);
        });
        for (let k = 0; k < 4; k++) {
          await scope.wait(90);
          optEls[k].classList.remove('pre');
        }
        S.accepting = true;
      }

      async function answer(i) {
        if (!S.accepting) return;
        S.accepting = false;
        S.total++;
        const right = i === S.q.ok;
        optEls[S.q.ok].classList.add('correct');
        if (right) {
          S.right++;
          S.run++;
          S.best = Math.max(S.best, S.run);
          S.coins++;
          app.addCoins(1);
          fx.correct();
          stage.cheer();
          stage.say(S.run >= 3 && S.run % 5 === 0 ? t('pStreak', { n: S.run }) : [t('right1'), t('right2'), t('right3'), t('right4')][S.total % 4], 'happy');
          sfx.vibrate(15);
          if (diff === 'auto' && S.run % 3 === 0) S.d = Math.min(4, S.d + 1);
          render();
          await scope.wait(1150);
          next();
        } else {
          optEls[i].classList.add('wrong');
          S.run = 0;
          sfx.play('error');
          sfx.vibrate([40, 40, 60]);
          stage.say(t('pWrong', { letter: LETTERS[S.q.ok] }), 'sad');
          if (diff === 'auto') S.d = Math.max(1, S.d - 1);
          render();
          nextBtn.hidden = false;
        }
      }

      finishFn = async () => {
        if (S.ended) return;
        if (!S.total) {
          S.ended = true;
          practicePicker(app, { root });
          return;
        }
        S.ended = true;
        S.accepting = false;
        app.pool.flush();
        const P = app.P;
        P.practice = P.practice || {};
        const rec = P.practice[theme] || { best: 0, right: 0 };
        const newBest = S.best > rec.best;
        P.practice[theme] = { best: Math.max(rec.best, S.best), right: rec.right + S.right };
        P.correct += S.right;
        P.answered += S.total;
        const xp = Math.min(30, 3 + S.right * 2);
        P.xp += xp;
        app.saveP();
        app.ctx.addXP?.(xp);
        const body = h(
          'div',
          { class: 'g-million-psum' },
          h('div', null, h('b', null, `${S.right}/${S.total}`), h('small', null, t('correctAnswers'))),
          h('div', null, h('b', null, S.best), h('small', null, t('bestStreak'))),
          h('div', null, h('b', null, `+${S.coins}`), h('small', null, t('coins'))),
          h('div', null, h('b', null, `+${xp}`), h('small', null, 'XP')),
        );
        await app.sheets.open({ title: t('practiceDone'), sub: newBest ? t('newStreak') : t(`set_${theme}`), body, actions: [{ label: t('ok'), value: true, primary: true }] }).done;
        practicePicker(app, { root });
      };
      function finish() {
        finishFn && finishFn();
      }

      render();
      stage.say(t('practiceHello'), 'happy');
      next();
    },
    {
      cls: 'g-million-play practice',
      title: t(`set_${theme}`),
      back: () => {
        if (app.sheets.count) return true;
        finishFn && finishFn();
        return true;
      },
    },
  );
}
