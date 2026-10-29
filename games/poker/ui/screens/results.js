// Tournament results screen (career events and quick sit & go).
import { h } from '../dom.js';
import { btn, bar, pill, fmtN, fmtK, ordinal } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { trophySVG, laurelSVG } from '../art.js';
import { faceEl } from '../cards.js';
import { ICON } from '../icons.js';
import { cardStr } from '../../engine/eval.js';
import { celebrate } from '../fx.js';

export function showResults(app, { kind, report, result, tour, eventId }) {
  const { t } = app;
  const res = report ? report.result : result;
  const won = res.place === 1;
  const ev = eventId ? app.EVENT_BY_ID[eventId] : null;
  return new Promise((resolve) => {
    const el = h('div', { class: 'pk-screen pk-results' });
    app.root.append(el);
    const sc = h('div', { class: 'pk-scroll' });
    el.append(sc);
    const tier = ev ? (ev.championship ? 'world' : ev.circuit) : 'local';
    const head = h(
      'div',
      { class: 'pk-resh ' + (won ? 'won' : res.cashed ? 'cash' : '') },
      won ? h('span', { class: 'pk-in', html: trophySVG(tier, { size: 120 }) }) : h('span', { class: 'pk-in pk-laurel', html: laurelSVG(96) }),
      h('div', { class: 'pk-kicker pk-in' }, ev ? app.tx(ev.name) : t('sg.title')),
      h('div', { class: 'pk-place pk-in' }, ordinal(res.place, app.lang)),
      h('div', { class: 'pk-sub pk-in' }, t('res.of', { n: res.entrants }) + (res.finalTable && !won ? ' · ' + t('res.finalTable') : '') + (res.cashed && !won ? ' · ' + t('res.cashed') : '')),
      won ? h('div', { class: 'pk-win-t pk-in' }, t('res.winner')) : null,
    );
    sc.append(head);
    const grid = h('div', { class: 'pk-two pk-in' }, kpi(t('res.prize'), res.prize ? fmtN(res.prize) : '0', res.prize ? 'gold' : ''), kpi(t('res.points'), report ? '+' + fmtN(res.points) : '–'), kpi(t('res.ko'), res.ko), kpi(t('res.hands'), res.feats ? res.feats.handsPlayed : '–'));
    sc.append(grid);
    if (report) {
      const c = app.career;
      const li = app.C.levelInfo(c);
      sc.append(h('div', { class: 'pk-panel pk-in' }, h('div', { class: 'pk-row sp' }, h('b', {}, t('res.xp', { n: report.xpGain })), pill(t('lvl', { n: li.level }), 'gold')), h('div', { style: { marginTop: '8px' } }, bar(li.xp - li.from, li.to - li.from)), h('div', { class: 'pk-row sp', style: { marginTop: '8px' } }, h('span', { class: 'pk-sub' }, t('res.rep', { n: report.repGain })), report.levelUp ? pill(t('res.levelUp'), 'good') : null)));
    }
    // rivals
    const rivals = (res.rivals || []).filter((r) => r.place != null);
    if (rivals.length) {
      const rl = h('div', { class: 'pk-panel pk-in' }, h('div', { class: 'pk-h2', style: { marginBottom: '8px' } }, t('res.rivals')));
      for (const r of rivals) {
        const rv = app.RIVAL_BY_ID[r.id];
        if (!rv) continue;
        rl.append(h('div', { class: 'pk-rvres' }, avatarEl(rv.avatar, { size: 34 }), h('div', { class: 'pk-grow' }, h('b', {}, rv.name), h('small', {}, t('res.rivalPlace', { p: ordinal(r.place, app.lang) }))), r.knockedOutByPlayer ? pill(t('res.youKo'), 'good') : r.knockedOutPlayer ? pill(t('res.koYou'), 'bad') : r.playerBeat ? pill(t('res.beat'), 'good') : r.beatPlayer ? pill(t('res.lostTo'), 'bad') : null));
      }
      sc.append(rl);
    }
    // decisive hand recap
    const recap = tour ? handRecap(app, tour) : null;
    if (recap) sc.append(recap);
    if (report && report.newCircuits && report.newCircuits.length) {
      sc.append(h('div', { class: 'pk-panel gold pk-in' }, h('div', { class: 'pk-row' }, h('span', { class: 'pk-obj-i good' }, ICON.map), h('div', { class: 'pk-h2' }, t('res.unlocked', { c: report.newCircuits.map((id) => app.tx(app.CIRCUIT_BY_ID[id].name)).join(', ') })))));
    }
    sc.append(h('div', { style: { height: '78px' } }));
    const dock = h('div', { class: 'pk-enter' }, btn(t('continue'), () => { el.remove(); resolve(); }, 'block', ICON.next));
    el.append(dock);
    if (won) {
      const anim = app.career ? app.career.cosmetics.selected.winAnim : 'chips';
      app.sound.fanfare();
      setTimeout(() => celebrate(app, el, anim || 'chips'), 250);
    } else if (res.cashed) app.sound.win();
    else app.sound.lose();
  });
}

function kpi(label, value, cls = '') {
  return h('div', { class: 'pk-kpi ' + cls }, h('small', {}, label), h('b', {}, String(value)));
}

/** Last hand of the tournament: board + the hands that showed down. */
function handRecap(app, tour) {
  const { t } = app;
  const lh = tour.lastHand;
  if (!lh || !lh.board) return null;
  const name = (id) => {
    const e = tour.entrants.find((x) => x.id === id);
    return e ? e.name : id;
  };
  const wrap = h('div', { class: 'pk-panel pk-recap pk-in' }, h('div', { class: 'pk-h2', style: { marginBottom: '8px' } }, t('res.lastHand')));
  const board = h('div', { class: 'pk-recap-board' });
  for (const c of lh.board) board.append(faceEl(cardStr(c), { cls: 'ex', small: true }));
  if (lh.board.length) wrap.append(board);
  const winners = new Set();
  for (const p of lh.pots || []) for (const w of p.winners || []) winners.add(w);
  for (const r of lh.reveals || []) {
    if (!r.hole) continue;
    const pl = lh.players[r.p];
    const row = h('div', { class: 'pk-recap-r' + (winners.has(r.p) ? ' win' : '') });
    const cards = h('div', { class: 'pk-hcards' });
    for (const c of r.hole) cards.append(faceEl(cardStr(c), { cls: 'ex', small: true }));
    row.append(h('div', { class: 'pk-grow' }, h('b', {}, name(pl.id)), h('small', {}, t('hand.' + r.hand))), cards, winners.has(r.p) ? h('span', { class: 'pk-w' }, ICON.trophy) : null);
    wrap.append(row);
  }
  if (!(lh.reveals || []).some((r) => r.hole)) wrap.append(h('div', { class: 'pk-sub' }, t('res.noShow')));
  return wrap;
}
