// Chapter map: an endless list of chapter cards (a preview of the scene's
// photo + level tiles), with a big "Continue" button at the top.

import { ICON, coinIcon } from './ui.js';
import { sceneUrl } from './scene.js';

export const PER_CHAPTER = 5;

export function showMap(app, modeId) {
  const { t, h, ctx, cfg } = app;
  const mode = cfg.modes[modeId];
  const tr = app.track(modeId);
  const cur = tr.n;
  const curCh = Math.floor(cur / PER_CHAPTER);
  let destroyed = false;
  const themeOf = (c) => app.sceneOf(modeId, c);

  const totalStars = Object.values(tr.stars).reduce((a, b) => a + b, 0);
  const head = h(
    'div',
    { class: 'g-findit-map-head' },
    h('div', { class: 'g-findit-mode-chip' }, h('span', { html: ICON[mode.icon] || ICON.lens }), t(mode.label)),
    h('div', { class: 'g-findit-spacer' }),
    h('div', { class: 'g-findit-pill' }, h('span', { class: 'g-findit-pill-star', html: ICON.star }), String(totalStars)),
    h('div', { class: 'g-findit-pill' }, h('span', { class: 'g-findit-pill-ico', html: ICON.lens }), String(app.state.hints)),
    h('div', { class: 'g-findit-pill' }, coinIcon(), String(app.state.coins)),
  );
  const curTheme = themeOf(curCh);
  const cont = h(
    'button',
    { class: 'g-findit-btn gold big g-findit-continue', onclick: () => app.startLevel(modeId, cur) },
    h('span', { class: 'g-findit-btn-ico', html: ICON.play }),
    h('span', { class: 'g-findit-continue-txt' }, h('b', null, t('continueAt', { n: cur + 1 })), h('small', null, ctx.pick(curTheme.name))),
  );
  const list = h('div', { class: 'g-findit-chapters' });
  const scroller = h('div', { class: 'g-findit-map screen g-findit-enter' }, head, cont, h('div', { class: 'g-findit-section' }, t('chapters')), list, h('p', { class: 'g-findit-endless' }, t('endless')));
  app.mount(scroller);

  let currentCard = null;
  for (let c = 0; c <= curCh + 1; c++) {
    const theme = themeOf(c);
    const locked = c > curCh;
    let chStars = 0;
    for (let i = 0; i < PER_CHAPTER; i++) chStars += tr.stars[c * PER_CHAPTER + i] || 0;
    const art = h(
      'div',
      { class: 'g-findit-ch-art ready' },
      h('img', { class: 'g-findit-ch-canvas', src: sceneUrl(`${theme.id}_s.webp`), alt: '', loading: 'lazy', decoding: 'async' }),
      h(
        'div',
        { class: 'g-findit-ch-label' },
        h('small', null, t('chapter', { n: c + 1 })),
        h('b', null, ctx.pick(theme.name)),
      ),
      h('div', { class: 'g-findit-ch-stars' }, h('span', { html: ICON.star }), `${chStars}/${PER_CHAPTER * 3}`),
    );
    const levels = h('div', { class: 'g-findit-ch-levels' });
    for (let i = 0; i < PER_CHAPTER; i++) {
      const n = c * PER_CHAPTER + i;
      const st = tr.stars[n] || 0;
      const state = n < cur ? 'done' : n === cur ? 'current' : 'locked';
      levels.append(
        h(
          'button',
          {
            class: `g-findit-lv ${state}`,
            disabled: state === 'locked',
            'aria-label': t('level', { n: n + 1 }),
            onclick: () => {
              ctx.sfx.play('select');
              app.startLevel(modeId, n);
            },
          },
          state === 'locked' ? h('span', { class: 'g-findit-lv-lock', html: ICON.lock }) : h('b', null, String(n + 1)),
          state === 'done' ? h('span', { class: 'g-findit-lv-stars' }, '★'.repeat(st) + '☆'.repeat(3 - st)) : null,
        ),
      );
    }
    const card = h(
      'div',
      { class: `g-findit-ch ${c === curCh ? 'current' : ''} ${locked ? 'locked' : ''}` },
      art,
      locked ? h('div', { class: 'g-findit-ch-locked' }, h('span', { html: ICON.lock }), t('locked')) : levels,
    );
    list.append(card);
    if (c === curCh) currentCard = card;
  }
  requestAnimationFrame(() => {
    if (currentCard && curCh > 0) scroller.scrollTop = Math.max(0, currentCard.offsetTop + currentCard.offsetHeight - scroller.clientHeight + 70);
  });

  return {
    back: () => false,
    destroy() {
      destroyed = true;
      scroller.remove();
    },
  };
}
