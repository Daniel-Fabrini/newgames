// Poker lobby / career home.
import { h } from '../dom.js';
import { section, panel, pill, btn, bar, fmtN, fmtK, ordinal } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { emblemSVG, trophySVG, suitsDeco } from '../art.js';
import { ICON } from '../icons.js';

export default function home(app) {
  const { t, career: c } = app;
  const el = h('div', { class: 'pk-screen pk-home' });
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);

  if (!c) {
    // no career yet: invitation + quick modes
    sc.append(
      h(
        'div',
        { class: 'pk-hero-welcome' },
        h('div', { class: 'pk-suits-wrap' }, suitsDeco()),
        h('div', { class: 'pk-kicker' }, t('home.kicker')),
        h('h1', { class: 'pk-title' }, 'Poker World Tour'),
        h('p', { class: 'pk-sub' }, t('home.pitch')),
        btn(t('home.startCareer'), () => app.go('welcome'), 'block', ICON.trophy),
      ),
    );
  } else {
    const ps = app.C.profileSummary(c);
    const sel = c.cosmetics.selected;
    const ti = app.C.availableTitles(c).find((x) => x.id === sel.title);
    const circ = app.CIRCUIT_BY_ID[ps.circuit];
    // profile strip
    sc.append(
      h(
        'button',
        { type: 'button', class: 'pk-panel gold tap pk-prof', onclick: () => app.go('profile') },
        avatarEl(app.heroAvatar(), { size: 58, frame: app.heroFrame() }),
        h(
          'div',
          { class: 'pk-grow' },
          h('div', { class: 'pk-h2' }, c.profile.name),
          h('div', { class: 'pk-sub' }, ti && ti.id ? app.tx(ti.name) : app.tx(ps.reputation.tier.name)),
          h('div', { class: 'pk-row', style: { marginTop: '6px', gap: '8px' } }, pill(t('lvl', { n: ps.level.level }), 'gold'), h('div', { class: 'pk-grow' }, bar(ps.level.xp - ps.level.from, ps.level.to - ps.level.from))),
        ),
      ),
    );
    // main CTA
    const running = c.tournament;
    if (running) {
      const ev = app.EVENT_BY_ID[c.tournamentEvent];
      const rem = running.remaining;
      sc.append(
        h(
          'div',
          { class: 'pk-panel gold pk-cta' },
          h('div', { class: 'pk-row' }, h('span', { class: 'pk-emb', html: emblemSVG(ev.circuit, { size: 50 }) }), h('div', { class: 'pk-grow' }, h('div', { class: 'pk-kicker' }, t('home.inProgress')), h('div', { class: 'pk-h2' }, app.tx(ev.name)), h('div', { class: 'pk-sub' }, t('home.progressLine', { rem, total: running.def.entrants })))),
          btn(t('home.resume'), () => app.playEvent(c.tournamentEvent), 'block', ICON.play),
        ),
      );
    } else {
      const rid = app.C.recommendedEvent(c);
      const ev = app.EVENT_BY_ID[rid];
      const st = app.C.eventStatus(c, rid);
      sc.append(
        h(
          'div',
          { class: 'pk-panel gold pk-cta' },
          h('div', { class: 'pk-kicker' }, t('home.recommended')),
          h('button', { type: 'button', class: 'pk-row pk-cta-ev', onclick: () => app.openEvent(rid) }, h('span', { class: 'pk-emb', html: emblemSVG(ev.circuit, { size: 54 }) }), h('div', { class: 'pk-grow' }, h('div', { class: 'pk-h2' }, app.tx(ev.name)), h('div', { class: 'pk-sub' }, app.tx(ev.sub)), h('div', { class: 'pk-row', style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap' } }, pill(t('fmt.' + ev.format), 'gold'), pill(t('players', { n: ev.entrants })), st.played ? pill(t('played', { n: st.played })) : pill(t('new'), 'good'))), h('span', { class: 'pk-chev' }, ICON.arrow)),
          rivalRow(app, ev.rivals.slice(0, 5)),
          btn(t('home.continue'), () => app.openEvent(rid), 'block', ICON.play),
        ),
      );
    }
    // objective
    const ob = app.C.nextObjective(c);
    sc.append(h('div', { class: 'pk-panel pk-obj' }, h('span', { class: 'pk-obj-i' }, ICON.target), h('div', { class: 'pk-grow' }, h('div', { class: 'pk-kicker' }, t('home.objective')), h('div', { class: 'pk-sub pk-txt' }, app.tx(ob.text)))));
    // circuit status
    const ci = app.C.circuitInfo(c, ps.circuit);
    const evs = ci.events.filter((e) => !e.event.special || true);
    const done = evs.filter((e) => e.played > 0).length;
    sc.append(
      h(
        'button',
        { type: 'button', class: 'pk-panel tap', onclick: () => app.go('map') },
        h('div', { class: 'pk-row sp' }, h('div', { class: 'pk-row' }, h('span', { class: 'pk-emb', html: emblemSVG(ps.circuit, { size: 40 }) }), h('div', {}, h('div', { class: 'pk-kicker' }, t('home.circuit')), h('div', { class: 'pk-h2' }, app.tx(circ.name)))), h('span', { class: 'pk-chev' }, ICON.arrow)),
        h('div', { class: 'pk-two', style: { marginTop: '10px' } }, kpi(t('rank.title'), `${ci.rank.rank}/${ci.rank.size}`), kpi(t('rank.points'), fmtN(ci.points))),
        h('div', { style: { marginTop: '10px' } }, bar(done, evs.length), h('div', { class: 'pk-sub', style: { marginTop: '4px' } }, t('home.events', { a: done, b: evs.length }))),
      ),
    );
  }

  // quick play
  sc.append(section(t('home.play')));
  const tiles = h('div', { class: 'pk-tiles' });
  const tile = (icon, title, sub, fn) => h('button', { type: 'button', class: 'pk-tile', onclick: fn }, h('span', { class: 'pk-tile-i' }, icon), h('b', {}, title), h('small', {}, sub));
  tiles.append(tile(ICON.chips, t('mode.quick'), t('mode.quickSub'), () => app.push('setup', { kind: 'quick' })), tile(ICON.users, t('mode.sitgo'), t('mode.sitgoSub'), () => app.push('setup', { kind: 'sitgo' })), tile(ICON.book, t('mode.tutorial'), app.quick.tutorialDone ? t('mode.tutorialDone') : t('mode.tutorialSub'), () => app.playTutorial()));
  sc.append(tiles);
  if (app.hasSitGoRun()) sc.append(h('div', { style: { marginTop: '10px' } }, btn(t('home.resumeSitgo'), () => app.playSitGo({ resume: true }), 'block dark', ICON.play)));
  sc.append(h('div', { class: 'pk-row', style: { marginTop: '10px', gap: '8px' } }, btn(t('rules.title'), () => app.push('rules'), 'ghost sm', ICON.help), c ? null : null));

  if (c) {
    // featured rivals
    const main = app.RIVAL_BY_ID.rafa;
    const featured = ['rafa', ...app.C.listRivals(c).filter((r) => r.id !== 'rafa' && r.met).map((r) => r.id)].slice(0, 6);
    sc.append(section(t('home.rivals'), h('button', { type: 'button', class: 'pk-link', onclick: () => app.go('rivals') }, t('seeAll'))));
    const strip = h('div', { class: 'pk-strip-h' });
    for (const id of featured) {
      const rv = app.C.rivalRecord(c, id);
      strip.append(
        h('button', { type: 'button', class: 'pk-rv-chip', onclick: () => app.push('rivals', { id }) }, avatarEl(rv.met || id === main.id ? rv.avatar : 'unknown', { size: 54, frame: id === 'rafa' ? 'gold' : '' }), h('b', {}, rv.name.split(' ')[0]), h('small', {}, app.tx(rv.nick))),
      );
    }
    sc.append(strip);
    // latest results
    if (c.results.length) {
      sc.append(section(t('home.latest')));
      const list = h('div', { class: 'pk-list' });
      for (const r of c.results.slice(0, 4)) {
        const ev = app.EVENT_BY_ID[r.eventId];
        list.append(h('div', { class: 'pk-res' + (r.won ? ' win' : r.cashed ? ' cash' : '') }, h('span', { class: 'pk-res-p' }, ordinal(r.place, app.lang)), h('div', { class: 'pk-grow' }, h('b', {}, app.tx(ev.name)), h('small', {}, t('res.of', { n: r.entrants }) + ' · +' + fmtK(r.points) + ' ' + t('rank.pts'))), h('span', { class: 'pk-res-z' }, r.prize ? '+' + fmtK(r.prize) : '')));
      }
      sc.append(list);
    }
    // trophies
    if (c.titles.length) {
      sc.append(section(t('home.trophies')));
      const shelf = h('div', { class: 'pk-shelf' });
      for (const id of c.titles.slice(0, 12)) {
        const ev = app.EVENT_BY_ID[id];
        shelf.append(h('div', { class: 'pk-shelf-i', title: app.tx(ev.title) }, h('span', { html: trophySVG(ev.circuit, { size: 54 }) }), h('small', {}, app.tx(ev.title))));
      }
      sc.append(shelf);
    }
  }
  return { el };
}

export function rivalRow(app, ids) {
  const row = h('div', { class: 'pk-rv-row' });
  for (const id of ids) {
    const r = app.RIVAL_BY_ID[id];
    if (!r) continue;
    row.append(h('span', { class: 'pk-rv-mini', title: r.name }, avatarEl(r.avatar, { size: 34 })));
  }
  if (ids.length) row.append(h('small', { class: 'pk-muted' }, app.t('home.rivalsIn')));
  return row;
}
function kpi(label, value) {
  return h('div', { class: 'pk-kpi' }, h('small', {}, label), h('b', {}, String(value)));
}
