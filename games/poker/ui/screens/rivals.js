// Rival gallery + profile.
import { h } from '../dom.js';
import { topbar, section, pill, bar } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { ICON } from '../icons.js';
import { STORY_BEATS } from '../../career/story.js';
import { skillDots } from './event.js';

export default function rivalsScreen(app, props = {}) {
  const { t, career: c } = app;
  const el = h('div', { class: 'pk-screen' });
  if (props.id) return detail(app, el, props);
  el.append(topbar(t('rivals.title'), { sub: t('rivals.sub', { a: app.C.listRivals(c).filter((r) => r.met).length, b: app.RIVALS.length }) }));
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);
  const grid = h('div', { class: 'pk-rv-grid' });
  for (const r of app.C.listRivals(c)) {
    const met = r.met;
    const rec = r.record;
    const card = h(
      'button',
      { type: 'button', class: 'pk-rv' + (met ? '' : ' unmet') + (r.id === 'rafa' ? ' main' : '') + (r.finalBoss ? ' boss' : ''), onclick: () => app.push('rivals', { id: r.id }) },
      avatarEl(met ? r.avatar : 'unknown', { size: 72, frame: r.id === 'rafa' || r.finalBoss ? 'gold' : '' }),
      h('b', {}, met ? r.name : '???'),
      h('small', {}, met ? app.tx(r.nick) : t('rivals.appears', { c: app.tx(app.CIRCUIT_BY_ID[r.circuits[0]].name) })),
      met ? h('div', { class: 'pk-rv-rec' }, h('span', { class: 'w' }, `${rec.beaten}`), h('span', { class: 'sep' }, '-'), h('span', { class: 'l' }, `${rec.lostTo}`)) : h('div', { class: 'pk-rv-rec' }, h('span', { class: 'pk-muted' }, t('rivals.unmet'))),
    );
    if (r.id === 'rafa') card.append(h('span', { class: 'pk-tag' }, t('rivals.main')));
    if (r.finalBoss) card.append(h('span', { class: 'pk-tag boss' }, t('rivals.boss')));
    grid.append(card);
  }
  sc.append(grid);
  return { el };
}

function meter(label, v) {
  return h('div', { class: 'pk-meter' }, h('span', {}, label), h('div', { class: 'pk-bar2' }, h('i', { style: { width: Math.round(v * 100) + '%' } })));
}

function detail(app, el, props) {
  const { t, career: c } = app;
  const r = app.C.rivalRecord(c, props.id);
  const rec = r.record;
  const met = r.met;
  el.append(topbar(met ? r.name : '???', { onBack: () => app.back(), sub: met ? app.tx(r.nick) : '' }));
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);
  sc.append(
    h(
      'div',
      { class: 'pk-panel gold pk-rvhead' },
      avatarEl(met ? r.avatar : 'unknown', { size: 104, frame: 'gold' }),
      h('div', { class: 'pk-h1' }, met ? r.name : t('rivals.unknown')),
      h('div', { class: 'pk-sub' }, met ? `${app.tx(r.nick)} · ${app.tx(r.origin)}` : t('rivals.appears', { c: app.tx(app.CIRCUIT_BY_ID[r.circuits[0]].name) })),
      met ? h('div', { class: 'pk-row', style: { gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '8px' } }, pill(app.tx(r.style), 'gold'), r.id === 'rafa' ? pill(t('rivals.main'), 'bad') : null, r.finalBoss ? pill(t('rivals.boss'), 'bad') : null, h('span', { class: 'pk-skill' }, skillDots(r.profile.skill))) : null,
    ),
  );
  if (!met) {
    sc.append(h('div', { class: 'pk-panel' }, h('div', { class: 'pk-sub' }, t('rivals.hint'))));
    return { el, props };
  }
  sc.append(h('div', { class: 'pk-panel' }, h('div', { class: 'pk-sub pk-txt' }, app.tx(r.blurb)), h('div', { class: 'pk-sub pk-txt pk-muted', style: { marginTop: '8px' } }, app.tx(r.bio))));
  if (r.quotes && r.quotes.length) {
    const q = r.quotes[(rec.met + (c.stats.played || 0)) % r.quotes.length];
    sc.append(h('div', { class: 'pk-panel pk-quote-box' }, h('span', { class: 'pk-q-mark' }, '“'), h('div', { class: 'pk-sub pk-quote' }, app.tx(q))));
  }
  // record
  sc.append(section(t('rivals.record')));
  const tot = rec.beaten + rec.lostTo;
  sc.append(
    h(
      'div',
      { class: 'pk-panel' },
      h('div', { class: 'pk-two' }, kpi(t('rivals.met'), rec.met), kpi(t('rivals.h2h'), `${rec.beaten} - ${rec.lostTo}`), kpi(t('rivals.koBy'), rec.koByYou), kpi(t('rivals.koOn'), rec.koOnYou)),
      tot ? h('div', { style: { marginTop: '10px' } }, bar(rec.beaten, tot, 'good'), h('div', { class: 'pk-sub', style: { marginTop: '4px' } }, t('rivals.h2hNote'))) : null,
    ),
  );
  // style meters (derived from the AI profile)
  const p = r.profile;
  sc.append(section(t('rivals.styleTitle')));
  sc.append(h('div', { class: 'pk-panel' }, meter(t('st.tight'), p.tight), meter(t('st.aggr'), p.aggr), meter(t('st.bluff'), p.bluff), meter(t('st.pos'), p.position), meter(t('st.risk'), p.risk), meter(t('st.skill'), p.skill / 10)));
  // events
  sc.append(section(t('rivals.events')));
  const evs = h('div', { class: 'pk-list' });
  for (const id of r.events) {
    const ev = app.EVENT_BY_ID[id];
    if (!ev) continue;
    const st = app.C.eventStatus(c, id);
    evs.append(h('button', { type: 'button', class: 'pk-li', onclick: () => app.openEvent(id) }, h('span', { class: 'pk-li-i' }, st.locked ? ICON.lock : st.completed ? ICON.trophy : ICON.play), h('div', { class: 'pk-grow' }, h('b', {}, app.tx(ev.name)), h('small', {}, app.tx(app.CIRCUIT_BY_ID[ev.circuit].name))), h('span', { class: 'pk-chev' }, ICON.arrow)));
  }
  sc.append(evs);
  // story beats
  const beats = STORY_BEATS.filter((b) => b.rival === r.id && c.story.seen.includes(b.id));
  if (beats.length) {
    sc.append(section(t('rivals.story')));
    for (const b of beats) sc.append(h('div', { class: 'pk-panel pk-beat' }, h('div', { class: 'pk-kicker' }, app.tx(b.title)), h('div', { class: 'pk-sub pk-txt' }, app.tx(b.text))));
  }
  return { el, props };
}
function kpi(label, value) {
  return h('div', { class: 'pk-kpi' }, h('small', {}, label), h('b', {}, String(value)));
}
