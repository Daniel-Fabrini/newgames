// Rankings: season + per-circuit standings, distance to next rank, season history, championship qualification.
import { h, clear } from '../dom.js';
import { topbar, section, pill, bar, seg, fmtN } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { ICON } from '../icons.js';
import { reqView } from './common.js';

export default function rankScreen(app, props = {}) {
  const { t, career: c } = app;
  const el = h('div', { class: 'pk-screen' });
  el.append(topbar(t('rank.title'), { sub: t('season.n', { n: c.season.n }) }));
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);
  let scope = props.scope || 'season';
  const opts = [{ id: 'season', label: t('rank.season') }, ...['local', 'regional', 'intl', 'world'].filter((k) => c.unlocked.includes(k)).map((k) => ({ id: k, label: t('cir.' + k) }))];
  const body = h('div', { class: 'pk-rank-body' });
  const paint = () => {
    clear(body);
    const S = app.C.standings(c, scope);
    const you = S.you;
    // summary card
    const sum = h('div', { class: 'pk-panel gold' });
    sum.append(h('div', { class: 'pk-row sp' }, h('div', {}, h('div', { class: 'pk-kicker' }, t('rank.yourRank')), h('div', { class: 'pk-big' }, `${you.rank}`, h('small', {}, ` / ${S.rows.length}`))), h('div', { style: { textAlign: 'right' } }, h('div', { class: 'pk-kicker' }, t('rank.points')), h('div', { class: 'pk-big gold pk-num' }, fmtN(you.pts)))));
    if (you.above) sum.append(h('div', { class: 'pk-sub', style: { marginTop: '8px' } }, t('rank.toNext', { n: fmtN(you.toNext), name: you.above.name })));
    else sum.append(h('div', { class: 'pk-sub', style: { marginTop: '8px' } }, t('rank.leader')));
    if (you.below) sum.append(h('div', { class: 'pk-sub pk-muted' }, t('rank.below', { name: you.below.name, n: fmtN(you.pts - you.below.pts) })));
    if (S.season) sum.append(h('div', { style: { marginTop: '10px' } }, bar(S.season.events, S.season.length), h('div', { class: 'pk-sub', style: { marginTop: '4px' } }, t('season.progress', { a: S.season.events, b: S.season.length }))));
    body.append(sum);
    // table
    const tbl = h('div', { class: 'pk-panel pk-rk' });
    for (const r of S.rows) {
      const rv = r.isYou ? null : app.RIVAL_BY_ID[r.id];
      tbl.append(
        h('div', { class: 'pk-rk-r' + (r.isYou ? ' you' : '') + (r.rank <= 3 ? ' top' : '') }, h('span', { class: 'pk-rk-n' }, String(r.rank)), avatarEl(r.isYou ? app.heroAvatar() : rv.avatar, { size: 34, frame: r.isYou ? app.heroFrame() : '' }), h('span', { class: 'pk-grow pk-rk-name' }, r.name), h('b', { class: 'pk-num' }, fmtN(r.pts))),
      );
    }
    body.append(section(t('rank.standings')), tbl);
    if (scope === 'season') {
      body.append(section(t('season.goals')));
      const q = app.C.championshipQualification(c);
      const goals = h('div', { class: 'pk-panel' });
      goals.append(h('div', { class: 'pk-h2' }, t('season.goalTitle')), h('div', { class: 'pk-sub', style: { margin: '4px 0 8px' } }, t('season.goalSub', { n: S.season.length })));
      goals.append(goalRow(app, t('season.g1'), c.season.events, S.season.length), goalRow(app, t('season.g2'), c.season.wins, 1), goalRow(app, t('season.g3'), you.rank <= 3 ? 1 : 0, 1));
      body.append(goals);
      if (c.unlocked.includes('intl') || c.qualifiedWorld) {
        body.append(section(t('rank.worldQual')), h('div', { class: 'pk-panel' }, q.qualified ? h('div', { class: 'pk-row' }, h('span', { class: 'pk-obj-i good' }, ICON.check), h('div', { class: 'pk-h2' }, t('rank.qualified'))) : reqView(app, { kind: 'any', children: q.conditions, met: false })));
      }
      if (c.seasonHistory.length) {
        body.append(section(t('season.history')));
        const hist = h('div', { class: 'pk-list' });
        for (const s of c.seasonHistory.slice(0, 8)) hist.append(h('div', { class: 'pk-li static' }, h('span', { class: 'pk-res-p' }, '#' + s.n), h('div', { class: 'pk-grow' }, h('b', {}, t('season.line', { r: s.rank, p: fmtN(s.points) })), h('small', {}, t('season.line2', { e: s.events, w: s.wins }))), s.champion ? pill(t('season.champ'), 'good') : null));
        body.append(hist);
      }
    }
  };
  sc.append(seg(opts, scope, (id) => { scope = id; paint(); }, 'pk-rank-seg'), body);
  paint();
  return { el };
}
function goalRow(app, label, cur, target) {
  const done = cur >= target;
  return h('div', { class: 'pk-req' + (done ? ' met' : '') }, h('span', { class: 'pk-req-i' }, done ? ICON.check : ICON.target), h('div', { class: 'pk-grow' }, h('div', { class: 'pk-req-l' }, label), h('div', { class: 'pk-row', style: { gap: '8px' } }, h('div', { class: 'pk-grow' }, bar(Math.min(cur, target), target)), h('small', { class: 'pk-num pk-muted' }, `${Math.min(cur, target)}/${target}`))));
}
