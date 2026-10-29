// Setup screens for the quick table and the quick sit & go.
import { h } from '../dom.js';
import { topbar, section, btn, seg, fmtN } from '../kit.js';
import { ICON } from '../icons.js';

export default function setupScreen(app, props) {
  const { t } = app;
  const kind = props.kind;
  const el = h('div', { class: 'pk-screen' });
  el.append(topbar(kind === 'quick' ? t('mode.quick') : t('mode.sitgo'), { onBack: () => { if (!app.back()) app.ctx.exit(); } }));
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);
  const q = app.quick;
  const diff = { v: app.prefs.get(kind + '.diff') || 'medium' };
  const diffSeg = seg([{ id: 'easy', label: t('diff.easy'), sub: t('diff.easySub') }, { id: 'medium', label: t('diff.medium'), sub: t('diff.mediumSub') }, { id: 'hard', label: t('diff.hard'), sub: t('diff.hardSub') }], diff.v, (v) => { diff.v = v; app.prefs.set(kind + '.diff', v); });
  if (kind === 'quick') {
    const stakes = { v: app.prefs.get('quick.stakes') || 'low' };
    sc.append(h('div', { class: 'pk-panel gold' }, h('div', { class: 'pk-h2' }, t('quick.title')), h('div', { class: 'pk-sub', style: { marginTop: '4px' } }, t('quick.desc'))));
    sc.append(section(t('quick.stakes')));
    sc.append(seg([{ id: 'low', label: '10 / 20', sub: t('quick.stack', { n: fmtN(2000) }) }, { id: 'mid', label: '50 / 100', sub: t('quick.stack', { n: fmtN(10000) }) }, { id: 'high', label: '200 / 400', sub: t('quick.stack', { n: fmtN(40000) }) }], stakes.v, (v) => { stakes.v = v; app.prefs.set('quick.stakes', v); }));
    sc.append(section(t('diff.title')), diffSeg);
    const c = q.cash;
    sc.append(section(t('setup.stats')), h('div', { class: 'pk-two' }, kpi(t('quick.sessions'), c.sessions), kpi(t('quick.hands'), c.hands), kpi(t('st2.pot'), fmtN(c.biggestPot)), kpi(t('quick.bestStack'), fmtN(c.bestStack))));
    sc.append(h('div', { style: { marginTop: '18px' } }, btn(t('setup.start'), () => app.playQuickTable({ stakes: stakes.v, difficulty: diff.v }), 'block', ICON.play)));
    sc.append(h('div', { class: 'pk-sub pk-muted', style: { marginTop: '10px', textAlign: 'center' } }, t('legal.virtual')));
  } else {
    const seats = { v: app.prefs.get('sitgo.seats') || 6 };
    sc.append(h('div', { class: 'pk-panel gold' }, h('div', { class: 'pk-h2' }, t('sitgo.title')), h('div', { class: 'pk-sub', style: { marginTop: '4px' } }, t('sitgo.desc'))));
    sc.append(section(t('sitgo.seats')));
    sc.append(seg([{ id: 6, label: t('sitgo.n', { n: 6 }), sub: t('sitgo.fast') }, { id: 9, label: t('sitgo.n', { n: 9 }), sub: t('sitgo.full') }], seats.v, (v) => { seats.v = v; app.prefs.set('sitgo.seats', v); }));
    sc.append(section(t('diff.title')), diffSeg);
    const s = q.sitgo;
    sc.append(section(t('setup.stats')), h('div', { class: 'pk-two' }, kpi(t('st2.played'), s.played), kpi(t('st2.wins'), s.wins), kpi(t('st2.cash'), s.cashes), kpi(t('st2.best'), s.best ? s.best + 'º' : '–')));
    if (app.hasSitGoRun()) sc.append(h('div', { style: { marginTop: '14px' } }, btn(t('home.resumeSitgo'), () => app.playSitGo({ resume: true }), 'block dark', ICON.play)));
    sc.append(h('div', { style: { marginTop: '14px' } }, btn(t('setup.start'), () => app.playSitGo({ seats: seats.v, difficulty: diff.v }), 'block', ICON.play)));
    sc.append(h('div', { class: 'pk-sub pk-muted', style: { marginTop: '10px', textAlign: 'center' } }, t('legal.virtual')));
  }
  return { el };
}
function kpi(label, value) {
  return h('div', { class: 'pk-kpi' }, h('small', {}, label), h('b', {}, String(value)));
}
