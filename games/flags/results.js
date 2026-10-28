// Animated results: hero medal, stars popping in, counted score, stats,
// XP bar filling up (with level-ups) and the next actions.

import { h } from '../../js/core/ui.js';
import { levelInfo, xpForLevel } from './progress.js';
import { starRow, countUp, icon } from './widgets.js';

/*
r = {
  tone: 'win' | 'lose' | 'time' | 'neutral',
  medal: '🏆', title, subtitle,
  stars: null | 0..3,
  big: { value, label, of? },
  badge: null | text,           // e.g. "New record!"
  stats: [{ icon, label, value }],
  xpBefore, xpGain,
  actions: [{ label, primary, ghost, onclick }],
}
*/
export function showResults(app, view, scope, r) {
  const { t, sfx, ctx } = app;
  view.classList.add('g-flags-results', 'tone-' + r.tone);

  const bigNum = h('span', { class: 'g-flags-bignum' }, '0');
  const xpNum = h('b', null, '+0');
  const lvlEl = h('span', { class: 'g-flags-xplvl' });
  const xpFill = h('i');
  const xpText = h('small', { class: 'g-flags-xptext' });

  const before = levelInfo(r.xpBefore);
  const after = levelInfo(r.xpBefore + r.xpGain);
  lvlEl.textContent = t('levelN', { n: before.level });
  xpFill.style.width = (before.into / before.need) * 100 + '%';
  xpText.textContent = `${before.into} / ${before.need} XP`;

  view.append(
    h(
      'div',
      { class: 'g-flags-reshero' },
      h('div', { class: 'g-flags-medal pop-in' }, r.medal),
      h('h2', { class: 'title-xl' }, r.title),
      r.subtitle ? h('p', { class: 'muted g-flags-ressub' }, r.subtitle) : null,
    ),
    r.stars === null || r.stars === undefined ? null : starRow(r.stars, { size: 'big', animate: true, delay: 350 }),
    h(
      'div',
      { class: 'g-flags-resscore' },
      bigNum,
      r.big.of ? h('span', { class: 'g-flags-of' }, ' / ' + r.big.of) : null,
      h('small', null, r.big.label),
    ),
    r.badge ? h('div', { class: 'g-flags-badge' }, '🏅 ' + r.badge) : null,
    h(
      'div',
      { class: 'g-flags-resstats' },
      r.stats.map((s) => h('div', { class: 'g-flags-resstat' }, icon(s.icon, 'ic'), h('b', null, String(s.value)), h('small', null, s.label))),
    ),
    h(
      'div',
      { class: 'g-flags-xpcard' },
      h('div', { class: 'g-flags-xprow' }, lvlEl, xpNum),
      h('div', { class: 'g-flags-xpbar' }, xpFill),
      xpText,
    ),
    h(
      'div',
      { class: 'g-flags-resactions' },
      r.actions.map((a) => h('button', { class: `btn block ${a.primary ? 'primary big' : ''} ${a.ghost ? 'ghost' : ''}`, onclick: a.onclick }, a.label)),
    ),
  );

  // ---------- choreography ----------
  if (r.tone === 'win' || r.tone === 'time') sfx.play('win');
  else if (r.tone === 'lose') sfx.play('lose');
  if (r.stars) for (let i = 0; i < r.stars; i++) scope.timeout(() => sfx.tone({ freq: 784 * Math.pow(1.19, i), dur: 0.14, type: 'triangle', vol: 0.3 }), 350 + i * 380);
  if (r.stars === 3 || r.badge) scope.timeout(() => ctx.ui.confetti(), 350 + 3 * 380);

  scope.timeout(() => countUp(scope, bigNum, 0, r.big.value, Math.min(1200, 300 + r.big.value * 40)), 250);
  scope.timeout(() => countUp(scope, xpNum, 0, r.xpGain, 900, (v) => `+${v} XP`), 700);

  // XP bar: fill level by level.
  const stages = [];
  for (let L = before.level; L <= after.level; L++) {
    const need = xpForLevel(L);
    const from = L === before.level ? before.into : 0;
    const to = L === after.level ? after.into : need;
    stages.push({ L, from, to, need });
  }
  let si = 0;
  const runStage = () => {
    const s = stages[si];
    if (!s) return;
    const t0 = performance.now();
    const dur = 650;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = s.from + (s.to - s.from) * e;
      xpFill.style.width = (v / s.need) * 100 + '%';
      xpText.textContent = `${Math.round(v)} / ${s.need} XP`;
      if (k < 1) return scope.raf(step);
      si++;
      if (si < stages.length) {
        lvlEl.textContent = t('levelN', { n: s.L + 1 });
        restart(lvlEl, 'g-flags-lvlup');
        sfx.play('levelup');
        if (si === stages.length - 1 && !r.stars) ctx.ui.confetti();
        scope.timeout(runStage, 350);
      }
    };
    scope.raf(step);
  };
  if (r.xpGain > 0) scope.timeout(runStage, 800);
}

function restart(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
