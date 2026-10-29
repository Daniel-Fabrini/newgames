// Rules & help: states the exact variant implemented.
import { h } from '../dom.js';
import { topbar, section } from '../kit.js';
import { faceEl } from '../cards.js';

const RANKS = [
  ['royal_flush', 'Ah Kh Qh Jh Th'],
  ['straight_flush', '9s 8s 7s 6s 5s'],
  ['quads', '8c 8d 8h 8s Kd'],
  ['full_house', 'Qh Qd Qs 4c 4d'],
  ['flush', 'Ad Jd 8d 5d 3d'],
  ['straight', '9c 8d 7h 6s 5c'],
  ['trips', '7h 7d 7s Ac 4d'],
  ['two_pair', 'Kh Kd 5s 5c 9d'],
  ['pair', 'Jh Jd Ac 8s 3d'],
  ['high_card', 'Ah Jd 8s 5c 2d'],
];
export default function rulesScreen(app) {
  const { t } = app;
  const el = h('div', { class: 'pk-screen' });
  el.append(topbar(t('rules.title'), { onBack: () => { if (!app.back()) app.ctx.exit(); } }));
  const sc = h('div', { class: 'pk-scroll pk-rules' });
  el.append(sc);
  const para = (k) => h('p', {}, t(k));
  sc.append(section(t('rules.goalT')), h('div', { class: 'pk-panel' }, para('rules.goal')));
  sc.append(section(t('rules.flowT')), h('div', { class: 'pk-panel' }, para('rules.flow1'), para('rules.flow2'), para('rules.flow3')));
  sc.append(section(t('rules.actionsT')), h('div', { class: 'pk-panel' }, ...['fold', 'check', 'call', 'bet', 'raise', 'allin'].map((a) => h('p', {}, h('b', {}, t('act.' + a) + ': '), t('rules.a.' + a)))));
  sc.append(section(t('rules.handsT')));
  const hl = h('div', { class: 'pk-panel pk-hands' });
  RANKS.forEach(([k, cards], i) => {
    const row = h('div', { class: 'pk-hrow' }, h('span', { class: 'pk-hn' }, String(i + 1)), h('b', {}, t('hand.' + k)));
    const cs = h('div', { class: 'pk-hcards' });
    for (const c of cards.split(' ')) cs.append(faceEl(c, { cls: 'ex', small: true }));
    row.append(cs);
    hl.append(row);
  });
  sc.append(hl);
  sc.append(section(t('rules.variantT')), h('div', { class: 'pk-panel' }, ...['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((k) => h('p', {}, t('rules.' + k)))));
  sc.append(section(t('rules.tourT')), h('div', { class: 'pk-panel' }, para('rules.tour1'), para('rules.tour2'), para('rules.tour3')));
  sc.append(section(t('rules.keysT')), h('div', { class: 'pk-panel' }, para('rules.keys')));
  sc.append(h('div', { class: 'pk-sub pk-muted', style: { margin: '14px 0', textAlign: 'center' } }, t('legal.virtual')));
  return { el };
}
