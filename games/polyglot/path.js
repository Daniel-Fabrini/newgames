// Learn tab: the course path (sections → units → lesson nodes).

import { UNITS, SECTIONS } from './content/index.js';
import { UNIT_NODES, NODES_PER_UNIT } from './lessons.js';
import { mascotSVG, ICON } from './art.js';
import { guideSheet } from './hub.js';

const WAVE = [0, 1, 1.55, 1, 0, -1, -1.55, -1];
const LESSON_KS = [0, 1, 3, 4, 6];
const XP_FOR = { words: 10, sentences: 10, sentences2: 10, review: 15, story: 10 };

export function renderLearn(app, sc) {
  const { h, t, S, ctx } = app;
  const T = app.T;
  const c = S.course(T);
  const root = sc.el;
  const cur = app.currentNode();
  const curSection = cur ? (cur.legend ? cur.legend : cur.unit.section) : 99;
  let currentEl = null;
  let openPop = null;
  let unitNo = 0;

  // Daily goal strip
  const today = S.todayXP();
  const goalBar = h('i', { style: { width: `${Math.min(100, (100 * today) / S.P.goal)}%` } });
  root.append(
    h(
      'button',
      { class: 'pg-goalstrip', onclick: () => app.setTab('quests') },
      h('span', { class: 'pg-gs-ico', html: ICON.bolt }),
      h('span', { class: 'pg-gs-txt' }, t('dailyGoal')),
      h('span', { class: 'pg-bar' }, goalBar),
      h('b', null, `${Math.min(today, S.P.goal)}/${S.P.goal}`),
    ),
  );

  function closePop() {
    if (openPop) {
      openPop.remove();
      openPop = null;
    }
  }

  function popover(row, x, { title, sub, btn, locked, onclick }) {
    closePop();
    const arrow = h('span', { class: 'pg-pop-arrow', style: { left: `calc(50% + ${x}px)` } });
    const pop = h(
      'div',
      { class: `pg-pop ${locked ? 'locked' : ''}` },
      arrow,
      h('div', { class: 'pg-pop-title' }, title),
      sub ? h('div', { class: 'pg-pop-sub' }, sub) : null,
      h('button', { class: `pg-btn ${locked ? 'dark' : 'gold'} block`, disabled: locked, onclick }, btn),
    );
    row.after(pop);
    openPop = pop;
    app.sfx.play('tap');
    sc.later(() => {
      const r = pop.getBoundingClientRect();
      const b = sc.body.getBoundingClientRect();
      if (r.bottom > b.bottom - 8) sc.body.scrollBy({ top: r.bottom - b.bottom + 24, behavior: 'smooth' });
    }, 30);
  }

  function nodeButton(kind, status, extraCls = '') {
    let icon;
    if (kind === 'chest') icon = status === 'done' ? '✨' : '🎁';
    else if (kind === 'review') icon = ICON.trophy;
    else if (kind === 'story') icon = ICON.book;
    else if (kind === 'legend') icon = '👑';
    else icon = status === 'done' ? ICON.check : status === 'locked' ? ICON.lock : ICON.star;
    const isSvg = icon.startsWith('<svg');
    return h('button', { class: `pg-node ${status} k-${kind} ${extraCls}`, 'aria-label': t('node_' + kind) }, h('span', { class: 'pg-node-ico', html: isSvg ? icon : null }, isSvg ? null : icon));
  }

  for (const sec of SECTIONS) {
    const all = UNITS.filter((u) => u.section === sec.id);
    const ready = all.filter((u) => u.ready);
    const doneUnits = ready.filter((u) => (c.done[u.id] || 0) >= NODES_PER_UNIT).length;
    const locked = sec.id > curSection;
    const canJump = locked && ready.length && UNITS.some((u) => u.ready && u.section < sec.id);
    const secEl = h(
      'div',
      { class: `pg-section ${locked ? 'locked' : ''}` },
      h(
        'div',
        { class: 'pg-sec-head' },
        h('div', { class: 'pg-sec-badge' }, sec.cefr),
        h('div', { class: 'pg-sec-txt' }, h('small', null, t('sectionN', { n: sec.id })), h('b', null, ctx.pick(sec.title)), h('span', null, ctx.pick(sec.desc))),
        h('div', { class: 'pg-sec-prog' }, `${doneUnits}/${all.length}`),
      ),
      canJump
        ? h(
            'button',
            {
              class: 'pg-btn dark small pg-jump',
              onclick: () => jumpSheet(sec),
            },
            '🚀 ',
            t('jumpHere'),
          )
        : null,
    );
    root.append(secEl);

    for (const entry of all) {
      unitNo++;
      if (!entry.ready) {
        root.append(
          h(
            'div',
            { class: 'pg-soon-unit' },
            h('span', { class: 'pg-soon-emoji' }, entry.emoji),
            h('div', null, h('small', null, t('unitN', { n: unitNo })), h('b', null, ctx.pick(entry.title))),
            h('span', { class: 'pg-soon' }, t('soon')),
          ),
        );
        continue;
      }
      const done = c.done[entry.id] || 0;
      const unitIdx = unitNo;
      const block = h('section', { class: 'pg-unit' });
      const banner = h(
        'div',
        { class: 'pg-banner' },
        h('div', { class: 'pg-banner-txt' }, h('small', null, t('sectionUnit', { s: sec.id, n: unitIdx })), h('b', null, ctx.pick(entry.title)), h('span', null, ctx.pick(entry.desc))),
        h('button', { class: 'pg-guide-btn', 'aria-label': t('guidebook'), onclick: () => guideSheet(app, entry) }, h('span', { html: ICON.book }), h('small', null, t('guide'))),
      );
      const nodes = h('div', { class: 'pg-nodes' });
      block.append(banner, nodes);
      const sign = unitIdx % 2 ? 1 : -1;
      UNIT_NODES.forEach((kind, k) => {
        const isCur = cur && !cur.legend && cur.unit.id === entry.id && cur.k === k;
        const status = k < done ? 'done' : isCur ? 'current' : 'locked';
        const x = Math.round(WAVE[k] * 46 * sign);
        const btn = nodeButton(kind, status);
        const row = h('div', { class: 'pg-noderow', style: { transform: `translateX(${x}px)` } }, btn);
        if (isCur) {
          row.append(h('div', { class: 'pg-startbub' }, kind === 'chest' ? t('open') : t('start')));
          row.classList.add('cur');
          currentEl = row;
          const side = x > 0 ? 'left' : x < 0 ? 'right' : sign > 0 ? 'left' : 'right';
          row.append(h('div', { class: 'pg-path-frog', style: { [side]: '-112px' }, html: mascotSVG({ mood: 'happy' }) }));
        }
        if (k === 2 && !isCur) row.append(h('div', { class: 'pg-deco', style: { [sign > 0 ? 'left' : 'right']: '-128px' } }, entry.emoji));
        btn.addEventListener('click', () => onNode(entry, k, kind, status, row, x, btn));
        nodes.append(row);
      });
      root.append(block);
    }

    if (ready.length) {
      const isCur = cur && cur.legend === sec.id;
      const status = c.legend[sec.id] ? 'done' : isCur ? 'current' : 'locked';
      const btn = nodeButton('legend', status, 'big');
      const row = h('div', { class: 'pg-noderow legend' }, btn);
      if (isCur) {
        row.append(h('div', { class: 'pg-startbub' }, t('start')));
        row.classList.add('cur');
        currentEl = row;
      }
      btn.addEventListener('click', () => {
        if (openPop && openPop.previousSibling === row) return closePop();
        popover(row, 0, {
          title: t('legendTitle', { n: sec.id }),
          sub: status === 'locked' ? t('lockedText') : t('legendSub'),
          btn: status === 'locked' ? t('locked') : status === 'done' ? t('practiceAgainXp', { xp: 10 }) : t('startXp', { xp: 40 }),
          locked: status === 'locked',
          onclick: () => app.startLegend(sec.id, status === 'done'),
        });
      });
      root.append(h('div', { class: 'pg-legend-wrap' }, row));
    }
  }

  if (!cur) {
    root.append(
      h(
        'div',
        { class: 'pg-coursedone' },
        h('div', { class: 'pg-cd-art', html: mascotSVG({ mood: 'cheer' }) }),
        h('b', null, t('courseDone')),
        h('span', null, t('courseDoneSub')),
      ),
    );
  }

  function onNode(entry, k, kind, status, row, x, btn) {
    if (openPop && openPop.previousSibling === row) return closePop();
    const node = { unit: entry, k };
    if (kind === 'chest') {
      if (status === 'current') return openChest(node, btn);
      return popover(row, x, {
        title: t('node_chest'),
        sub: status === 'done' ? t('chestOpened') : t('lockedText'),
        btn: status === 'done' ? t('completed') : t('locked'),
        locked: true,
      });
    }
    const li = LESSON_KS.indexOf(k);
    const title = kind === 'review' ? t('unitReview') : kind === 'story' ? t('node_story') : t('lessonOf', { n: li + 1, total: LESSON_KS.length });
    if (status === 'locked') return popover(row, x, { title, sub: t('lockedText'), btn: t('locked'), locked: true });
    popover(row, x, {
      title,
      sub: status === 'done' ? t('completed') : ctx.pick(entry.title),
      btn: status === 'done' ? (kind === 'story' ? t('readAgain') : t('practiceAgainXp', { xp: 5 })) : t('startXp', { xp: XP_FOR[kind] }),
      onclick: () => app.startNode(node, status === 'done'),
    });
  }

  function openChest(node, btn) {
    btn.classList.add('opening');
    app.sfx.play('pop');
    app.sfx.vibrate(20);
    sc.later(() => {
      const gems = 15 + Math.floor(Math.random() * 4) * 5;
      app.S.addGems(gems);
      app.completeNode(node);
      app.sfx.play('coin');
      app.ctx.ui.confetti(50);
      app.refreshHud();
      app.sheet({
        content: (b) =>
          b.append(
            h(
              'div',
              { class: 'pg-notice' },
              h('div', { class: 'pg-notice-ico chest' }, '🎁'),
              h('h2', null, t('chestTitle')),
              h('p', { class: 'pg-gold big' }, `+${gems} 💎`),
              h('button', { class: 'pg-btn gold big block', onclick: () => app.closeSheet() }, t('continue')),
            ),
          ),
        onClose: () => !app.disposed && app.setTab('learn'),
      });
    }, 650);
  }

  function jumpSheet(sec) {
    app.sheet({
      title: t('jumpTitle', { n: sec.id }),
      content: (b) =>
        b.append(
          h('div', { class: 'pg-notice' }, h('div', { class: 'pg-notice-ico' }, '🚀'), h('p', null, t('jumpText', { n: sec.id })), h('button', { class: 'pg-btn gold big block', onclick: () => app.startTest(sec.id) }, t('startTest'))),
        ),
    });
  }

  sc.el.addEventListener('click', (e) => {
    if (openPop && !e.target.closest('.pg-pop') && !e.target.closest('.pg-node')) closePop();
  });

  // Scroll to the current node (and celebrate a freshly unlocked one).
  sc.later(() => {
    if (!currentEl) return;
    const body = sc.body;
    const r = currentEl.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    body.scrollTop += r.top - b.top - b.height * 0.42;
    if (app.celebrate) {
      app.celebrate = false;
      currentEl.classList.add('celebrate');
      app.sfx.play('pop');
    }
  }, 30);
}
