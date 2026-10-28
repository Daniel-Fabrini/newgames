// Chapter map: an endless list of themed chapter cards (painted thumbnail of
// the scene + level tiles), with a big "Continue" button at the top.

import { rng } from '../../../js/core/ui.js';
import { paintIndoor } from './paint/indoor.js';
import { paintOutdoorBack, paintOutdoorFront } from './paint/outdoor.js';
import { emojiList } from './catalog.js';
import { ICON, coinIcon } from './ui.js';

export const PER_CHAPTER = 5;
const thumbs = new Map();

function renderThumb(look, theme) {
  const key = look + ':' + theme.id;
  if (thumbs.has(key)) return thumbs.get(key);
  const c = document.createElement('canvas');
  if (look === 'indoor') {
    const W = 1000, H = 1420, k = 0.4;
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    paintIndoor(g, W, H, rng(7 + theme.id.length * 131), theme.paint);
  } else {
    const H = 1100, W = 2400, k = 0.2;
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    const margin = { x: 0, y: 0 };
    const back = paintOutdoorBack(g, W, H, rng(11 + theme.id.length * 97), theme.paint, margin);
    paintOutdoorFront(g, W, H, rng(5 + theme.id.length * 53), theme.paint, back);
  }
  thumbs.set(key, c);
  return c;
}

export function showMap(app, modeId) {
  const { t, h, ctx, cfg } = app;
  const mode = cfg.modes[modeId];
  const tr = app.track(modeId);
  const cur = tr.n;
  const curCh = Math.floor(cur / PER_CHAPTER);
  const T = cfg.themes.length;
  let destroyed = false;
  const themeOf = (c) => cfg.themes[(c + (mode.offset || 0)) % T];

  const totalStars = Object.values(tr.stars).reduce((a, b) => a + b, 0);
  const head = h(
    'div',
    { class: 'g-hidden-map-head' },
    h('div', { class: 'g-hidden-mode-chip' }, h('span', { html: ICON[mode.icon] || ICON.lens }), t(mode.label)),
    h('div', { class: 'g-hidden-spacer' }),
    h('div', { class: 'g-hidden-pill' }, h('span', { class: 'g-hidden-pill-star', html: ICON.star }), String(totalStars)),
    h('div', { class: 'g-hidden-pill' }, h('span', { class: 'g-hidden-pill-ico', html: ICON.lens }), String(app.state.hints)),
    h('div', { class: 'g-hidden-pill' }, coinIcon(), String(app.state.coins)),
  );
  const curTheme = themeOf(curCh);
  const cont = h(
    'button',
    { class: 'g-hidden-btn gold big g-hidden-continue', onclick: () => app.startLevel(modeId, cur) },
    h('span', { class: 'g-hidden-btn-ico', html: ICON.play }),
    h('span', { class: 'g-hidden-continue-txt' }, h('b', null, t('continueAt', { n: cur + 1 })), h('small', null, ctx.pick(curTheme.name))),
  );
  const list = h('div', { class: 'g-hidden-chapters' });
  const scroller = h('div', { class: 'g-hidden-map screen g-hidden-enter' }, head, cont, h('div', { class: 'g-hidden-section' }, t('chapters')), list, h('p', { class: 'g-hidden-endless' }, t('endless')));
  app.mount(scroller);

  const pending = [];
  let pumping = false;
  const pump = () => {
    if (pumping) return;
    pumping = true;
    const step = () => {
      if (destroyed || !pending.length) {
        pumping = false;
        return;
      }
      const { holder, theme } = pending.shift();
      try {
        const src = renderThumb(cfg.look, theme);
        const c = document.createElement('canvas');
        c.width = src.width;
        c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        c.className = 'g-hidden-ch-canvas';
        holder.prepend(c);
        holder.classList.add('ready');
      } catch (e) {
        console.error(e);
      }
      setTimeout(step, 16);
    };
    setTimeout(step, 30);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        pending.push({ holder: en.target, theme: en.target.__theme });
        pump();
      }
    },
    { root: scroller, rootMargin: '200px' },
  );

  let currentCard = null;
  for (let c = 0; c <= curCh + 1; c++) {
    const theme = themeOf(c);
    const locked = c > curCh;
    let chStars = 0;
    for (let i = 0; i < PER_CHAPTER; i++) chStars += tr.stars[c * PER_CHAPTER + i] || 0;
    const deco = emojiList(theme.items).slice(0, 3);
    const art = h(
      'div',
      { class: 'g-hidden-ch-art', style: { background: `linear-gradient(135deg, ${theme.card[0]}, ${theme.card[1]})` } },
      h('div', { class: 'g-hidden-ch-deco' }, deco.map((e, i) => h('span', { style: { '--i': i } }, e))),
      h(
        'div',
        { class: 'g-hidden-ch-label' },
        h('small', null, t('chapter', { n: c + 1 })),
        h('b', null, ctx.pick(theme.name)),
      ),
      h('div', { class: 'g-hidden-ch-stars' }, h('span', { html: ICON.star }), `${chStars}/${PER_CHAPTER * 3}`),
    );
    art.__theme = theme;
    const levels = h('div', { class: 'g-hidden-ch-levels' });
    for (let i = 0; i < PER_CHAPTER; i++) {
      const n = c * PER_CHAPTER + i;
      const st = tr.stars[n] || 0;
      const state = n < cur ? 'done' : n === cur ? 'current' : 'locked';
      levels.append(
        h(
          'button',
          {
            class: `g-hidden-lv ${state}`,
            disabled: state === 'locked',
            'aria-label': t('level', { n: n + 1 }),
            onclick: () => {
              ctx.sfx.play('select');
              app.startLevel(modeId, n);
            },
          },
          state === 'locked' ? h('span', { class: 'g-hidden-lv-lock', html: ICON.lock }) : h('b', null, String(n + 1)),
          state === 'done' ? h('span', { class: 'g-hidden-lv-stars' }, '★'.repeat(st) + '☆'.repeat(3 - st)) : null,
        ),
      );
    }
    const card = h(
      'div',
      { class: `g-hidden-ch ${c === curCh ? 'current' : ''} ${locked ? 'locked' : ''}` },
      art,
      locked ? h('div', { class: 'g-hidden-ch-locked' }, h('span', { html: ICON.lock }), t('locked')) : levels,
    );
    list.append(card);
    io.observe(art);
    if (c === curCh) currentCard = card;
  }
  requestAnimationFrame(() => {
    if (currentCard && curCh > 0) scroller.scrollTop = Math.max(0, currentCard.offsetTop + currentCard.offsetHeight - scroller.clientHeight + 70);
  });

  return {
    back: () => false,
    destroy() {
      destroyed = true;
      io.disconnect();
      scroller.remove();
    },
  };
}
