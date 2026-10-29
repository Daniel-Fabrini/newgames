// Progression map: Local -> Regional -> International -> World Championship (climbing path).
import { h } from '../dom.js';
import { topbar, pill, bar } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { emblemSVG, trophySVG } from '../art.js';
import { ICON } from '../icons.js';
import { reqView } from './common.js';

export default function mapScreen(app) {
  const { t, career: c } = app;
  const el = h('div', { class: 'pk-screen' });
  el.append(topbar(t('map.title'), { sub: t('map.sub') }));
  const sc = h('div', { class: 'pk-scroll pk-map-sc' });
  el.append(sc);
  const map = app.C.progressionMap(c);
  const world = map.find((m) => m.id === 'world');
  const wrap = h('div', { class: 'pk-map' });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'pk-map-path');
  svg.setAttribute('aria-hidden', 'true');
  wrap.append(svg);
  const nodes = [];
  const order = ['world', 'intl', 'regional', 'local'];
  order.forEach((id, idx) => {
    const m = map.find((x) => x.id === id);
    const ci = app.C.circuitInfo(c, id);
    const side = idx % 2 === 0 ? 'r' : 'l';
    const st = m.completed ? 'done' : m.current ? 'current' : m.unlocked ? 'open' : 'locked';
    const node = h('span', { class: `pk-node ${st} ${id === 'world' ? 'big' : ''}`, html: id === 'world' ? trophySVG('world', { size: 84, locked: !m.unlocked }) : emblemSVG(id, { size: 64, locked: !m.unlocked }) });
    if (m.current) node.append(h('span', { class: 'pk-here' }, avatarEl(app.heroAvatar(), { size: 30, frame: app.heroFrame() })));
    nodes.push({ id, node, st });
    const card = h('div', { class: `pk-st ${st}` });
    card.append(
      h('div', { class: 'pk-row sp' }, h('div', {}, h('div', { class: 'pk-kicker' }, app.tx(ci.tag)), h('div', { class: 'pk-h2' }, app.tx(ci.name))), pill(st === 'done' ? t('map.done') : st === 'current' ? t('map.current') : st === 'open' ? t('map.open') : t('map.locked'), st === 'done' ? 'good' : st === 'locked' ? 'lock' : 'gold')),
    );
    if (!m.unlocked) {
      if (id === 'world') {
        const q = app.C.championshipQualification(c);
        card.append(h('div', { class: 'pk-sub', style: { margin: '8px 0 4px' } }, t('map.worldReq')));
        card.append(reqView(app, { kind: 'any', children: q.conditions, met: false }));
      } else if (ci.unlockReq) {
        card.append(h('div', { class: 'pk-sub', style: { margin: '8px 0 4px' } }, t('map.unlockBy')), reqView(app, ci.unlockReq));
      }
    } else {
      const done = ci.events.filter((e) => e.played > 0).length;
      card.append(h('div', { class: 'pk-row', style: { gap: '8px', margin: '8px 0 6px' } }, h('div', { class: 'pk-grow' }, bar(done, ci.events.length)), h('small', { class: 'pk-num pk-muted' }, `${done}/${ci.events.length}`)));
    }
    // events grid
    const grid = h('div', { class: 'pk-evgrid' });
    for (const es of ci.events) {
      const ev = es.event;
      const state = es.completed ? 'won' : es.played ? 'played' : es.unlocked ? 'open' : 'locked';
      const ic = state === 'locked' ? ICON.lock : state === 'won' ? ICON.trophy : ev.special ? ICON.swords : ev.format === 'ko' ? ICON.target : state === 'played' ? ICON.check : ICON.play;
      const b = h('button', { type: 'button', class: `pk-evd ${state} ${ev.circuitFinal ? 'final' : ''}`, 'aria-label': `${app.tx(ev.name)} - ${t('ev.' + state)}`, onclick: () => app.openEvent(es.id) }, ic, h('small', {}, app.tx(ev.name)));
      grid.append(b);
    }
    card.append(grid);
    const row = h('div', { class: `pk-st-row ${side}` }, node, card);
    wrap.append(row);
  });
  // start marker
  wrap.append(h('div', { class: 'pk-start' }, h('span', {}, t('map.start'))));
  sc.append(wrap);

  const draw = () => {
    const r0 = wrap.getBoundingClientRect();
    if (!r0.width) return;
    svg.setAttribute('viewBox', `0 0 ${r0.width} ${r0.height}`);
    svg.setAttribute('width', r0.width);
    svg.setAttribute('height', r0.height);
    svg.textContent = '';
    const pts = nodes.map((n) => {
      const r = n.node.getBoundingClientRect();
      return { x: r.left - r0.left + r.width / 2, y: r.top - r0.top + r.height / 2, st: n.st };
    });
    const startEl = wrap.querySelector('.pk-start');
    const sr = startEl.getBoundingClientRect();
    pts.push({ x: sr.left - r0.left + sr.width / 2, y: sr.top - r0.top + 6, st: 'done' });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const my = (a.y + b.y) / 2;
      const d = `M${b.x},${b.y} C${b.x},${my} ${a.x},${my} ${a.x},${a.y}`;
      // segment is "lit" when the upper node (a) is reachable (unlocked)
      const lit = a.st !== 'locked';
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', 'seg ' + (lit ? 'lit' : 'dim') + (a.st === 'current' || a.st === 'open' ? ' dash' : ''));
      svg.append(p);
    }
  };
  requestAnimationFrame(() => {
    draw();
    // keep the current station in view
    const cur = wrap.querySelector('.pk-node.current') || wrap.querySelector('.pk-node.open');
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
  if (ro) ro.observe(wrap);
  void world;
  void ICON;
  return { el, destroy: () => ro && ro.disconnect() };
}
