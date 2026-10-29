// Tournament lobby: field, structure, payouts, requirements, enter.
import { h } from '../dom.js';
import { topbar, section, panel, pill, btn, fmtN, fmtK, ordinal } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { emblemSVG, trophySVG } from '../art.js';
import { ICON } from '../icons.js';
import { reqView } from './common.js';
import { levelAt, payoutLadder, prizeAmounts } from '../../tournament/structures.js';

export default function eventScreen(app, props) {
  const { t, career: c } = app;
  const ev = app.EVENT_BY_ID[props.id];
  const st = app.C.eventStatus(c, ev.id);
  const el = h('div', { class: 'pk-screen' });
  el.append(topbar(app.tx(ev.name), { onBack: () => app.back(), sub: app.tx(app.CIRCUIT_BY_ID[ev.circuit].name) }));
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);
  const running = c.tournament;
  const thisRunning = running && c.tournamentEvent === ev.id;

  // header
  sc.append(
    h(
      'div',
      { class: 'pk-panel gold pk-evhead' },
      h('div', { class: 'pk-row' }, h('span', { class: 'pk-emb', html: ev.championship ? trophySVG('world', { size: 76 }) : emblemSVG(ev.circuit, { size: 64 }) }), h('div', { class: 'pk-grow' }, h('div', { class: 'pk-h1' }, app.tx(ev.name)), h('div', { class: 'pk-sub' }, app.tx(ev.sub)))),
      h(
        'div',
        { class: 'pk-row', style: { flexWrap: 'wrap', gap: '6px', marginTop: '10px' } },
        pill(t('fmt.' + ev.format), 'gold'),
        pill(t('players', { n: ev.entrants })),
        ev.entrants > ev.tableSize ? pill(t('tables', { n: Math.ceil(ev.entrants / ev.tableSize) })) : null,
        pill(t('ev.stack', { n: fmtK(ev.startStack) })),
        ev.bounty ? pill(t('ev.bounty', { n: fmtK(ev.bounty) }), 'bad') : null,
        ev.title ? pill(t('ev.title'), 'good') : null,
      ),
    ),
  );

  // status / requirement
  if (st.locked) {
    const need = [];
    if (!st.circuitUnlocked) need.push(h('div', { class: 'pk-sub' }, t('ev.circuitLocked', { name: app.tx(app.CIRCUIT_BY_ID[ev.circuit].name) })));
    if (st.req && !st.req.met) need.push(reqView(app, st.req));
    sc.append(h('div', { class: 'pk-panel pk-lockbox' }, h('div', { class: 'pk-row' }, h('span', { class: 'pk-obj-i' }, ICON.lock), h('div', { class: 'pk-h2' }, t('ev.locked'))), h('div', { style: { marginTop: '8px' } }, ...need)));
  } else if (st.played) {
    const last = c.results.find((r) => r.eventId === ev.id);
    sc.append(h('div', { class: 'pk-panel' }, h('div', { class: 'pk-row sp' }, h('div', {}, h('div', { class: 'pk-kicker' }, t('ev.history')), h('div', { class: 'pk-sub' }, t('ev.playedTimes', { n: st.played, w: st.wins }))), last ? pill(t('ev.last', { p: ordinal(last.place, app.lang) }), last.won ? 'good' : last.cashed ? 'gold' : '') : null)));
  }

  // story for special events
  if (ev.story) {
    const r = app.RIVAL_BY_ID[ev.rivals[0]];
    if (r) sc.append(h('div', { class: 'pk-panel pk-story' }, avatarEl(r.avatar, { size: 52, frame: 'gold' }), h('div', { class: 'pk-grow' }, h('div', { class: 'pk-kicker' }, r.name), h('div', { class: 'pk-sub pk-quote' }, '“' + app.tx(ev.story.intro) + '”'))));
  }

  // field
  sc.append(section(t('ev.field')));
  const field = h('div', { class: 'pk-field' });
  for (const id of ev.rivals) {
    const r = app.RIVAL_BY_ID[id];
    if (!r) continue;
    const rec = c.rivals[id];
    field.append(h('button', { type: 'button', class: 'pk-fld', onclick: () => app.push('rivals', { id }) }, avatarEl(rec && rec.met ? r.avatar : r.avatar, { size: 44, frame: 'gold' }), h('div', { class: 'pk-grow' }, h('b', {}, r.name), h('small', {}, app.tx(r.style))), h('span', { class: 'pk-skill' }, skillDots(r.profile.skill))));
  }
  const filler = ev.entrants - ev.rivals.length - 1;
  if (filler > 0) field.append(h('div', { class: 'pk-fld plain' }, h('span', { class: 'pk-fld-n' }, '+' + filler), h('div', { class: 'pk-grow' }, h('b', {}, t('ev.others')), h('small', {}, t('ev.skillRange', { a: ev.fieldSkill[0], b: ev.fieldSkill[1] })))));
  sc.append(field);

  // structure
  sc.append(section(t('ev.structure')));
  const rows = [];
  for (let k = 0; k < 8; k++) {
    const l = levelAt(ev.structure, k);
    rows.push(h('tr', {}, h('td', {}, String(k + 1)), h('td', {}, `${fmtN(l.sb)} / ${fmtN(l.bb)}`), h('td', {}, l.ante ? fmtN(l.ante) : '–')));
  }
  sc.append(
    h(
      'div',
      { class: 'pk-panel' },
      h('div', { class: 'pk-sub', style: { marginBottom: '6px' } }, t('ev.structLine', { n: ev.structure.handsPerLevel, stack: fmtN(ev.startStack), m: Math.round(ev.startStack / ev.structure.levels[0].bb) })),
      h('table', { class: 'pk-tbl' }, h('thead', {}, h('tr', {}, h('th', {}, t('hud.level')), h('th', {}, t('hud.blinds')), h('th', {}, t('hud.ante')))), h('tbody', {}, ...rows)),
      h('div', { class: 'pk-sub pk-muted', style: { marginTop: '6px' } }, t('ev.moreLevels')),
    ),
  );

  // payouts
  const ladder = ev.payoutKind ? payoutLadder(ev.entrants, ev.payoutKind) : payoutLadder(ev.entrants, 'auto');
  const pool = (ev.buyIn || 0) * ev.entrants + (ev.guarantee || 0);
  const prizes = prizeAmounts(pool, ladder);
  sc.append(section(t('ev.payouts'), pill(t('ev.paid', { n: ladder.length }))));
  const pr = h('div', { class: 'pk-panel' }, h('div', { class: 'pk-row sp' }, h('span', { class: 'pk-sub' }, t('ev.pool')), h('b', { class: 'pk-gold pk-num' }, fmtN(pool))));
  prizes.slice(0, 5).forEach((p, i) => pr.append(h('div', { class: 'pk-pay' }, h('span', {}, ordinal(i + 1, app.lang)), h('i', {}), h('b', { class: 'pk-num' }, fmtN(p)))));
  if (ev.bounty) pr.append(h('div', { class: 'pk-sub', style: { marginTop: '6px' } }, t('ev.bountyNote', { n: fmtN(ev.bounty) })));
  if (ev.satellite) pr.append(h('div', { class: 'pk-sub', style: { marginTop: '6px' } }, t('ev.satNote')));
  sc.append(pr);

  // rewards
  sc.append(section(t('ev.rewards')));
  sc.append(h('div', { class: 'pk-two' }, kpi(t('ev.xp'), 'up to ' + ev.xp), kpi(t('ev.rep'), 'up to ' + ev.rep), kpi(t('ev.mult'), '×' + ev.mult), kpi(t('ev.buyin'), fmtK(ev.buyIn))));
  if (ev.championship) sc.append(h('div', { class: 'pk-sub', style: { marginTop: '8px' } }, t('ev.worldDays')));
  sc.append(h('div', { style: { height: '70px' } }));

  // enter bar
  const act = h('div', { class: 'pk-enter' });
  if (st.locked) act.append(btn(t('ev.locked'), () => {}, 'block', ICON.lock));
  else if (running && !thisRunning) act.append(h('div', { class: 'pk-sub', style: { textAlign: 'center', marginBottom: '6px' } }, t('ev.finishFirst', { name: app.tx(app.EVENT_BY_ID[c.tournamentEvent].name) })), btn(t('home.resume'), () => app.playEvent(c.tournamentEvent), 'block', ICON.play));
  else act.append(btn(thisRunning ? t('home.resume') : t('ev.enter'), () => app.playEvent(ev.id), 'block', ICON.play));
  el.append(act);
  const b = act.querySelector('button');
  if (st.locked) b.disabled = true;
  return { el, props };
}

function kpi(label, value) {
  return h('div', { class: 'pk-kpi' }, h('small', {}, label), h('b', {}, String(value)));
}
export function skillDots(skill) {
  const n = Math.round(skill / 2);
  return Array.from({ length: 5 }, (_, i) => h('i', { class: i < n ? 'on' : '' }));
}
