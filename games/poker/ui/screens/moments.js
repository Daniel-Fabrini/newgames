// Full-screen celebratory moments (skippable): first win, final table, rival knocked out, circuit unlocked,
// qualification, title, champion, story beats, level up, achievements, rewards, season end.
import { h } from '../dom.js';
import { btn, overlay, fmtN, fmtK, ordinal } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { trophySVG, emblemSVG, laurelSVG } from '../art.js';
import { ICON } from '../icons.js';
import { celebrate } from '../fx.js';
import { STORY_BY_ID } from '../../career/story.js';
import { ACH_BY_ID } from '../../career/achievements.js';

export async function playMoments(app, list) {
  const items = list.filter(Boolean);
  for (let i = 0; i < items.length; i++) {
    const skipAll = await one(app, items[i], items.length - i - 1);
    if (skipAll) break;
  }
}

function one(app, m, remaining) {
  const { t } = app;
  return new Promise((resolve) => {
    const ov = overlay(app.root, 'pk-moment');
    const el = ov.el;
    el.append(h('div', { class: 'rays' }));
    const body = build(app, m);
    el.append(body.node);
    const actions = h('div', { class: 'pk-ov-actions pk-in' });
    const done = (skip) => {
      ov.close();
      setTimeout(() => resolve(skip), 200);
    };
    actions.append(btn(body.cta || t('continue'), () => done(false), 'block', ICON.next));
    if (remaining > 0) actions.append(h('button', { type: 'button', class: 'pk-link', onclick: () => done(true) }, t('moment.skip')));
    el.append(actions);
    if (body.fx) {
      const anim = (app.career && app.career.cosmetics.selected.winAnim) || 'chips';
      setTimeout(() => celebrate(app, el, body.fx === true ? anim : body.fx, body.power || 1), 300);
    }
    if (body.sfx) app.sound[body.sfx]?.();
    else app.sound.win();
  });
}

function kick(txt) {
  return h('div', { class: 'pk-ov-kicker pk-in' }, txt);
}
function build(app, m) {
  const { t } = app;
  const tr = (k, p) => t(k, p);
  const box = (...kids) => h('div', { class: 'pk-mbody' }, ...kids);
  switch (m.kind) {
    case 'story': {
      const ev = m.event;
      const r = app.RIVAL_BY_ID[ev.rivals[0]];
      const text = m.intro ? ev.story.intro : m.won ? ev.story.win : ev.story.lose;
      return { node: box(kick(m.intro ? tr('moment.duelIntro') : m.won ? tr('moment.duelWin') : tr('moment.duelLose')), h('div', { class: 'pk-in', style: { margin: '14px 0' } }, avatarEl(r.avatar, { size: 112, frame: 'gold' })), h('h2', { class: 'pk-in' }, r.name), h('p', { class: 'pk-in pk-quote' }, '“' + app.tx(text) + '”')), cta: m.intro ? tr('moment.letsPlay') : null, fx: !m.intro && m.won, sfx: m.intro ? 'turn' : m.won ? 'win' : 'lose' };
    }
    case 'champion': {
      const c = app.career;
      const s = c.stats;
      return {
        node: box(kick(tr('moment.champKick')), h('div', { class: 'pk-in', html: trophySVG('world', { size: 170 }) }), h('h2', { class: 'pk-in' }, tr('moment.champ')), h('p', { class: 'pk-in' }, tr('moment.champText', { name: c.profile.name })), h('div', { class: 'pk-two pk-in', style: { marginTop: '14px' } }, kpi(tr('st2.played'), s.played), kpi(tr('st2.wins'), s.wins), kpi(tr('st2.titles'), c.titles.length), kpi(tr('st2.winnings'), fmtK(s.winnings)))),
        fx: 'gold_rain',
        power: 1.6,
        sfx: 'fanfare',
        cta: tr('moment.champCta'),
      };
    }
    case 'first_win':
      return { node: box(kick(tr('moment.firstWinK')), h('div', { class: 'pk-in', html: trophySVG('local', { size: 140 }) }), h('h2', { class: 'pk-in' }, tr('moment.firstWin')), h('p', { class: 'pk-in' }, tr('moment.firstWinText'))), fx: true, sfx: 'fanfare' };
    case 'first_final':
      return { node: box(kick(tr('moment.finalK')), h('div', { class: 'pk-in', html: laurelSVG(120) }), h('h2', { class: 'pk-in' }, tr('moment.first_final')), h('p', { class: 'pk-in' }, tr('moment.first_finalText'))), fx: 'chips' };
    case 'world_final_table':
      return { node: box(kick(tr('moment.worldK')), h('div', { class: 'pk-in', html: trophySVG('world', { size: 130 }) }), h('h2', { class: 'pk-in' }, tr('moment.worldFinal')), h('p', { class: 'pk-in' }, tr('moment.worldFinalText'))), fx: 'spotlight' };
    case 'rival_ko': {
      const r = app.RIVAL_BY_ID[m.rival];
      return { node: box(kick(tr('moment.koK')), h('div', { class: 'pk-in pk-ko' }, avatarEl(r.avatar, { size: 112, frame: 'gold' }), h('span', { class: 'pk-ko-x' }, ICON.x)), h('h2', { class: 'pk-in' }, tr('moment.ko', { name: r.name })), h('p', { class: 'pk-in pk-quote' }, '“' + app.tx(r.quotes[0]) + '”')), fx: 'chips', power: 0.6 };
    }
    case 'circuit': {
      const ci = app.CIRCUIT_BY_ID[m.circuit];
      return { node: box(kick(tr('moment.circuitK')), h('div', { class: 'pk-in', html: m.circuit === 'world' ? trophySVG('world', { size: 140 }) : emblemSVG(m.circuit, { size: 130 }) }), h('h2', { class: 'pk-in' }, app.tx(ci.name)), h('p', { class: 'pk-in' }, app.tx(ci.desc))), fx: 'chips', cta: tr('moment.seeMap') };
    }
    case 'qualified':
      return { node: box(kick(tr('moment.qualK')), h('div', { class: 'pk-in', html: trophySVG('world', { size: 150 }) }), h('h2', { class: 'pk-in' }, tr('moment.qual')), h('p', { class: 'pk-in' }, tr('moment.qualText')), h('p', { class: 'pk-in pk-quote' }, '“' + app.tx(app.RIVAL_BY_ID.legend.quotes[0]) + '”')), fx: 'spotlight', sfx: 'fanfare' };
    case 'title': {
      const ev = app.EVENT_BY_ID[m.report.titleWon.event];
      return { node: box(kick(tr('moment.titleK')), h('div', { class: 'pk-in', html: trophySVG(ev.championship ? 'world' : ev.circuit, { size: 150 }) }), h('h2', { class: 'pk-in' }, app.tx(ev.title)), h('p', { class: 'pk-in' }, tr('moment.titleText', { e: app.tx(ev.name) }))), fx: true, sfx: 'fanfare' };
    }
    case 'beat': {
      const b = STORY_BY_ID[m.id];
      const r = b && b.rival ? app.RIVAL_BY_ID[b.rival] : null;
      return { node: box(kick(tr('moment.storyK')), r ? h('div', { class: 'pk-in', style: { margin: '10px 0' } }, avatarEl(r.avatar, { size: 96, frame: 'gold' })) : null, h('h2', { class: 'pk-in' }, b ? app.tx(b.title) : ''), h('p', { class: 'pk-in' }, b ? app.tx(b.text) : '')), sfx: 'turn' };
    }
    case 'level':
      return { node: box(kick(tr('moment.levelK')), h('div', { class: 'pk-in pk-lvl' }, h('b', {}, String(m.report.level))), h('h2', { class: 'pk-in' }, tr('moment.level', { n: m.report.level })), h('p', { class: 'pk-in' }, tr('moment.levelText'))), fx: 'chips', power: 0.5 };
    case 'achievements': {
      const list = h('div', { class: 'pk-in pk-mlist' });
      for (const id of m.ids) {
        const a = ACH_BY_ID[id];
        if (!a) continue;
        list.append(h('div', { class: 'pk-ach done' }, h('span', { class: 'pk-ach-i' }, ICON.trophy), h('div', { class: 'pk-grow' }, h('b', {}, app.tx(a.name)), h('small', {}, app.tx(a.desc)))));
      }
      return { node: box(kick(tr('moment.achK')), h('h2', { class: 'pk-in' }, tr('moment.ach', { n: m.ids.length })), list), fx: 'chips', power: 0.4 };
    }
    case 'cosmetics': {
      const list = h('div', { class: 'pk-in pk-mlist' });
      for (const it of m.items) list.append(h('div', { class: 'pk-ach done' }, h('span', { class: 'pk-ach-i' }, ICON.star), h('div', { class: 'pk-grow' }, h('b', {}, app.tx(it.name)), h('small', {}, tr('cs.' + (it.slot === 'winAnim' ? 'win' : it.slot))))));
      return { node: box(kick(tr('moment.rewK')), h('h2', { class: 'pk-in' }, tr('moment.rew')), list, h('p', { class: 'pk-in pk-sub' }, tr('moment.rewHint'))), fx: 'chips', power: 0.4 };
    }
    case 'season': {
      const s = m.season;
      return { node: box(kick(tr('moment.seasonK', { n: s.n })), h('div', { class: 'pk-in', html: s.champion ? trophySVG('intl', { size: 130 }) : laurelSVG(110) }), h('h2', { class: 'pk-in' }, s.champion ? tr('moment.seasonChamp') : tr('moment.seasonEnd', { r: ordinal(s.rank, app.lang) })), h('p', { class: 'pk-in' }, tr('moment.seasonText', { p: fmtN(s.points), e: s.events, w: s.wins }))), fx: s.champion ? true : false };
    }
    case 'bust': {
      const e = m.by;
      const rv = e && e.rivalId ? app.RIVAL_BY_ID[e.rivalId] : null;
      return { node: box(kick(tr('moment.bustK')), h('div', { class: 'pk-in', html: laurelSVG(96) }), h('h2', { class: 'pk-in' }, tr('moment.bust', { p: ordinal(m.place, app.lang) })), h('p', { class: 'pk-in' }, tr('moment.bustOf', { n: m.entrants })), e ? h('div', { class: 'pk-in pk-bustby' }, avatarEl(e.avatar, { size: 46, frame: rv ? 'gold' : '' }), h('div', {}, h('small', {}, tr('moment.bustBy')), h('b', {}, e.name))) : null), sfx: 'bust', cta: tr('moment.bustCta') };
    }
    case 'ceremony': {
      const row = h('div', { class: 'pk-in pk-cer' });
      for (const id of m.event.rivals.slice(0, 7)) row.append(avatarEl(app.RIVAL_BY_ID[id].avatar, { size: 44, frame: 'gold' }));
      const lg = app.RIVAL_BY_ID.legend;
      return { node: box(kick(tr('moment.cerK')), h('div', { class: 'pk-in', html: trophySVG('world', { size: 130 }) }), h('h2', { class: 'pk-in' }, tr('moment.cer')), h('p', { class: 'pk-in' }, tr('moment.cerText', { n: m.event.entrants })), row, h('p', { class: 'pk-in pk-quote' }, '“' + app.tx(lg.quotes[0]) + '” — ' + lg.name)), fx: 'spotlight', sfx: 'turn', cta: tr('moment.cerCta') };
    }
    case 'tutorial':
      return { node: box(kick(tr('moment.tutK')), h('div', { class: 'pk-in', html: laurelSVG(120) }), h('h2', { class: 'pk-in' }, tr('moment.tut')), h('p', { class: 'pk-in' }, tr('moment.tutText'))), fx: 'chips', power: 0.6 };
    default:
      return { node: box() };
  }
}
function kpi(label, value) {
  return h('div', { class: 'pk-kpi' }, h('small', {}, label), h('b', {}, String(value)));
}
