// Shared helpers for screens.
import { h } from '../dom.js';
import { bar } from '../kit.js';
import { ICON } from '../icons.js';

/** Render an evalReq() result: label, progress and (for any/all) its children. */
export function reqView(app, r, { compact = false } = {}) {
  if (!r) return null;
  const { t } = app;
  const one = (x) => {
    const lab = x.label ? app.tx(x.label) : '';
    return h(
      'div',
      { class: 'pk-req' + (x.met ? ' met' : '') },
      h('span', { class: 'pk-req-i' }, x.met ? ICON.check : ICON.lock),
      h('div', { class: 'pk-grow' }, h('div', { class: 'pk-req-l' }, lab), x.target > 1 ? h('div', { class: 'pk-row', style: { gap: '8px' } }, h('div', { class: 'pk-grow' }, bar(x.cur, x.target)), h('small', { class: 'pk-num pk-muted' }, `${x.cur}/${x.target}`)) : null, x.detail ? h('small', { class: 'pk-muted' }, t('rank.detail', { rank: x.detail.rank, top: x.detail.top, played: x.detail.played, min: x.detail.minEvents })) : null),
    );
  };
  if ((r.kind === 'any' || r.kind === 'all') && r.children) {
    const wrap = h('div', { class: 'pk-reqs' });
    r.children.forEach((ch, i) => {
      if (i && r.kind === 'any') wrap.append(h('div', { class: 'pk-or' }, t('or')));
      wrap.append(ch.children ? reqView(app, ch) : one(ch));
    });
    return wrap;
  }
  return h('div', { class: 'pk-reqs' }, one(r));
}

export const FORMAT_ICON = { sitgo: 'users', ko: 'target', mtt: 'users', duel: 'swords', satellite: 'bolt', championship: 'crown' };
export function formatPill(app, ev) {
  return app.t('fmt.' + ev.format);
}
