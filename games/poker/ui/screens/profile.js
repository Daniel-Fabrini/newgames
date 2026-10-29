// Player profile: stats, customization (cosmetics), achievements, results, settings.
import { h, clear } from '../dom.js';
import { topbar, section, pill, bar, seg, btn, fmtN, fmtK, ordinal } from '../kit.js';
import { avatarEl } from '../avatars.js';
import { faceEl, backEl } from '../cards.js';
import { trophySVG } from '../art.js';
import { ICON } from '../icons.js';

const THEME_SW = { emerald: ['#17724b', '#05261a'], midnight: ['#1f4f93', '#091a35'], burgundy: ['#8a2437', '#2e0a13'], onyx: ['#4a5568', '#151a22'], royal: ['#6d2f8f', '#1e0a33'], teal: ['#11766f', '#052725'], sand: ['#9a7b3e', '#382a0e'] };
const ACH_ICON = { cards: ICON.cards, book: ICON.book, coin: ICON.coin, table: ICON.users, trophy: ICON.trophy, duel: ICON.swords, map: ICON.map, globe: ICON.map, crown: ICON.crown, target: ICON.target, chips: ICON.chips, mask: ICON.skull, bolt: ICON.bolt, star: ICON.star };

export default function profileScreen(app) {
  const { t, career: c } = app;
  const el = h('div', { class: 'pk-screen' });
  el.append(topbar(t('prof.title')));
  const sc = h('div', { class: 'pk-scroll' });
  el.append(sc);
  const rebuild = () => {
    clear(sc);
    build();
  };
  const build = () => {
    const ps = app.C.profileSummary(c);
    const sel = c.cosmetics.selected;
    const ti = ps.titles.find((x) => x.id === sel.title);
    // header
    sc.append(
      h(
        'div',
        { class: 'pk-panel gold pk-phead' },
        avatarEl(app.heroAvatar(), { size: 88, frame: app.heroFrame() }),
        h('div', { class: 'pk-row', style: { justifyContent: 'center', gap: '6px' } }, h('div', { class: 'pk-h1' }, c.profile.name), h('button', { type: 'button', class: 'pk-ic', 'aria-label': t('prof.edit'), onclick: editName }, ICON.edit)),
        h('div', { class: 'pk-sub' }, ti && ti.id ? app.tx(ti.name) : app.tx(ps.reputation.tier.name)),
        h('div', { class: 'pk-phead-bars' }, labelBar(t('lvl', { n: ps.level.level }), ps.level.xp - ps.level.from, ps.level.to - ps.level.from, `${fmtN(ps.level.xp)} XP`), labelBar(app.tx(ps.reputation.tier.name), ps.reputation.rep - ps.reputation.tier.min, ps.reputation.next ? ps.reputation.next.min - ps.reputation.tier.min : 1, t('prof.rep', { n: fmtN(ps.reputation.rep) }), 'good')),
      ),
    );
    // stats
    sc.append(section(t('prof.stats')));
    const s = c.stats;
    sc.append(
      h(
        'div',
        { class: 'pk-stats' },
        kpi(t('st2.played'), s.played),
        kpi(t('st2.wins'), s.wins),
        kpi(t('st2.final'), s.finalTables),
        kpi(t('st2.cash'), s.cashes),
        kpi(t('st2.best'), s.bestPlace ? ordinal(s.bestPlace, app.lang) : '–'),
        kpi(t('st2.winnings'), fmtK(s.winnings)),
        kpi(t('st2.ko'), s.ko),
        kpi(t('st2.rivals'), ps.rivalsMet),
        kpi(t('st2.hands'), `${fmtK(s.handsWon)}/${fmtK(s.hands)}`),
        kpi(t('st2.pot'), fmtK(s.biggestPot)),
        kpi(t('st2.titles'), c.titles.length),
        kpi(t('st2.duels'), s.duelWins),
      ),
    );
    // customize
    sc.append(section(t('prof.custom')));
    sc.append(slotRow('avatar', t('cs.avatar'), (it) => avatarEl(it.id, { size: 44 })));
    sc.append(slotRow('frame', t('cs.frame'), (it) => avatarEl(app.heroAvatar(), { size: 40, frame: it.id === 'none' ? '' : it.id })));
    sc.append(slotRow('theme', t('cs.theme'), (it) => h('span', { class: 'pk-sw-prev', style: { background: `radial-gradient(circle at 40% 35%, ${(THEME_SW[it.id] || THEME_SW.emerald)[0]}, ${(THEME_SW[it.id] || THEME_SW.emerald)[1]})` } })));
    sc.append(slotRow('back', t('cs.back'), (it) => h('span', { class: 'pk-bk', 'data-back': it.id }, backEl('prev'))));
    sc.append(slotRow('deck', t('cs.deck'), (it) => h('span', { class: 'pk-deckprev', 'data-deck': it.id }, faceEl('Ah', { small: true, cls: 'prev' }), faceEl('Kd', { small: true, cls: 'prev' }), faceEl('Qc', { small: true, cls: 'prev' }))));
    sc.append(slotRow('winAnim', t('cs.win'), () => h('span', { class: 'pk-win-prev' }, ICON.star)));
    // titles
    const tl = h('div', { class: 'pk-chipsrow' });
    for (const x of ps.titles) {
      const b = h('button', { type: 'button', class: 'pk-chipb' + ((sel.title || null) === x.id ? ' on' : ''), onclick: () => { app.C.setProfile(c, { title: x.id }); app.saveCareer(); rebuild(); } }, app.tx(x.name));
      tl.append(b);
    }
    sc.append(h('div', { class: 'pk-panel' }, h('div', { class: 'pk-h2', style: { marginBottom: '8px' } }, t('cs.title')), tl));
    // achievements
    const ach = app.C.listAchievements(c);
    const doneN = ach.filter((a) => a.unlocked).length;
    sc.append(section(t('prof.ach'), pill(`${doneN}/${ach.length}`, 'gold')));
    const al = h('div', { class: 'pk-list' });
    ach.sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.cur / b.target - a.cur / a.target);
    for (const a of ach) {
      al.append(
        h(
          'div',
          { class: 'pk-ach' + (a.unlocked ? ' done' : '') },
          h('span', { class: 'pk-ach-i' }, a.unlocked ? ICON.trophy : ACH_ICON[a.icon] || ICON.star),
          h('div', { class: 'pk-grow' }, h('b', {}, app.tx(a.name)), h('small', {}, app.tx(a.desc)), h('div', { class: 'pk-row', style: { gap: '8px', marginTop: '4px' } }, h('div', { class: 'pk-grow' }, bar(a.cur, a.target, a.unlocked ? 'good' : '')), h('small', { class: 'pk-num pk-muted' }, a.target > 999 ? `${fmtK(a.cur)}/${fmtK(a.target)}` : `${a.cur}/${a.target}`))),
        ),
      );
    }
    sc.append(al);
    // results
    if (c.results.length) {
      sc.append(section(t('prof.results')));
      const rl = h('div', { class: 'pk-list' });
      for (const r of c.results.slice(0, 12)) {
        const ev = app.EVENT_BY_ID[r.eventId];
        rl.append(h('div', { class: 'pk-res' + (r.won ? ' win' : r.cashed ? ' cash' : '') }, h('span', { class: 'pk-res-p' }, ordinal(r.place, app.lang)), h('div', { class: 'pk-grow' }, h('b', {}, app.tx(ev.name)), h('small', {}, t('res.of', { n: r.entrants }) + ' · +' + fmtK(r.points) + ' ' + t('rank.pts') + (r.ko ? ' · ' + t('res.ko', { n: r.ko }) : ''))), h('span', { class: 'pk-res-z' }, r.prize ? '+' + fmtK(r.prize) : '')));
      }
      sc.append(rl);
    }
    // settings
    sc.append(section(t('prof.settings')));
    const set = h('div', { class: 'pk-panel pk-set2' });
    set.append(toggleRow('sound', t('set.sound')), toggleRow('vibrate', t('set.vibrate')), toggleRow('fast', t('set.fast'), false), toggleRow('auto', t('set.auto')));
    sc.append(set);
    sc.append(h('div', { class: 'pk-row', style: { marginTop: '12px', gap: '8px', flexWrap: 'wrap' } }, btn(t('rules.title'), () => app.push('rules'), 'ghost sm', ICON.help), btn(t('prof.reset'), resetFlow, 'danger sm')));
    sc.append(h('div', { class: 'pk-sub pk-muted', style: { marginTop: '14px', textAlign: 'center' } }, t('legal.virtual')));
  };

  const toggleRow = (key, label, def = true) => {
    const on = app.prefs.get(key) === undefined ? def : app.prefs.get(key) !== false;
    const b = h('button', { type: 'button', class: 'pk-sw' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on) }, h('span', { class: 'pk-sw-l' }, label), h('i', {}));
    b.onclick = () => {
      const nv = b.getAttribute('aria-checked') !== 'true';
      app.prefs.set(key, nv);
      b.setAttribute('aria-checked', String(nv));
      b.classList.toggle('on', nv);
    };
    return b;
  };

  function slotRow(slot, label, preview) {
    const items = app.C.listCosmetics(c, slot);
    const row = h('div', { class: 'pk-panel pk-slot-row' }, h('div', { class: 'pk-h2', style: { marginBottom: '8px' } }, label));
    const strip = h('div', { class: 'pk-cos-strip' });
    for (const it of items) {
      const b = h(
        'button',
        { type: 'button', class: 'pk-cos' + (it.selected ? ' on' : '') + (it.unlocked ? '' : ' locked'), 'aria-pressed': String(it.selected), 'aria-label': app.tx(it.name) + (it.unlocked ? '' : ' - ' + t('ev.locked')) },
        h('span', { class: 'pk-cos-p' }, preview(it)),
        h('small', {}, app.tx(it.name)),
        it.unlocked ? null : h('span', { class: 'pk-cos-lock' }, ICON.lock),
      );
      b.onclick = () => {
        if (!it.unlocked) {
          const reqLab = it.reqInfo && it.reqInfo.label ? app.tx(it.reqInfo.label) : '';
          app.ctx.ui.toast(t('cs.locked', { r: reqLab }));
          return;
        }
        app.C.selectCosmetic(c, slot, it.id);
        app.saveCareer();
        app.applyCosmetics();
        rebuild();
      };
      strip.append(b);
    }
    row.append(strip);
    return row;
  }

  async function editName() {
    const input = h('input', { type: 'text', class: 'pk-input', maxlength: '18', value: c.profile.name, 'aria-label': t('prof.name') });
    const v = await app.ctx.ui.modal({ title: t('prof.name'), body: input, actions: [{ label: t('cancel2'), value: false }, { label: t('save'), value: true, primary: true }] });
    if (v && input.value.trim()) {
      app.C.setProfile(c, { name: input.value });
      app.saveCareer();
      rebuild();
    }
  }
  async function resetFlow() {
    const ok = await app.confirm(t('prof.resetTitle'), t('prof.resetText'), t('prof.resetOk'), { danger: true });
    if (!ok) return;
    const ok2 = await app.confirm(t('prof.resetTitle2'), t('prof.resetText2'), t('prof.resetOk2'), { danger: true });
    if (!ok2) return;
    app.resetCareer();
    app.go('home');
  }
  build();
  void trophySVG;
  return { el };
}
function kpi(label, value) {
  return h('div', { class: 'pk-kpi' }, h('small', {}, label), h('b', {}, String(value)));
}
function labelBar(label, v, max, right, cls = '') {
  return h('div', { class: 'pk-lbar' }, h('div', { class: 'pk-row sp' }, h('b', {}, label), h('small', { class: 'pk-muted' }, right)), bar(v, max, cls));
}
