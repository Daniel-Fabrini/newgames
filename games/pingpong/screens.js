// Menu screens: main menu, World Tour, Quick Match, Training and the shop.
import { ARENAS } from './render.js';
import { ITEMS, CATS, CAT_LABEL, ITEM_NAME, ITEM_DESC, find, tourInfo, tourOpponent, arenaNeed, quickTier, QUICK_KEYS } from './data.js';

const OPP_KEYS = ['opponentName0', 'opponentName1', 'opponentName2', 'opponentName3', 'opponentName4', 'opponentName5', 'opponentName6', 'opponentName7', 'opponentName8', 'opponentName9'];
const STYLE_KEY = { chopper: 'styleChopper', smasher: 'styleSmasher', spin: 'styleSpin' };

export function screens(api) {
  const { ctx, t, p } = api;
  const h = ctx.ui.h;

  const head = (title, back) =>
    h('div', { class: 'pp-head' }, back ? h('button', { class: 'pp-back', onclick: back, 'aria-label': t('back') }, '‹') : h('span'), h('div', { class: 'pp-hd-t' }, title), h('span', { class: 'pp-coins' }, '◎ ', String(p.coins)));

  const wrap = (...kids) => h('div', { class: 'pp-screen' }, ...kids);

  function menu() {
    const info = tourInfo(p.fans);
    return wrap(
      h('div', { class: 'pp-hero' }, h('div', { class: 'pp-hero-ball' }), h('div', { class: 'pp-hero-t' }, t('menuTitle')), h('div', { class: 'pp-hero-s' }, t('menuSub'))),
      h(
        'div',
        { class: 'pp-stats' },
        stat(t('fans'), String(p.fans)),
        stat(t('season', { n: info.season }), `${p.wins}V`),
        stat(t('coins'), String(p.coins)),
      ),
      modeCard('trophy', t('tour'), t('tourDesc'), () => api.go('tour')),
      modeCard('user', t('quick'), t('quickDesc'), () => api.go('quick')),
      modeCard('flag', t('training'), t('trainDesc'), () => api.go('training')),
      modeCard('gift', t('shop'), t('shopDesc'), () => api.go('shop')),
    );
  }

  const stat = (k, v) => h('div', { class: 'pp-stat' }, h('b', null, v), h('small', null, k));
  const modeCard = (ic, title, sub, onclick) =>
    h('button', { class: 'pp-card', onclick }, h('span', { class: 'pp-card-ic' }, ic === 'trophy' ? '🏆' : ic === 'user' ? '⚡' : ic === 'flag' ? '🎯' : '🛍'), h('span', { class: 'pp-card-b' }, h('b', null, title), h('small', null, sub)), h('span', { class: 'pp-card-go' }, '›'));

  function tour() {
    const info = tourInfo(p.fans);
    const list = [];
    for (let k = 0; k < 10; k++) {
      const open = k < info.unlocked;
      const opp = tourOpponent(p.fans, k);
      const need = arenaNeed(k, info.season);
      list.push(
        h(
          'button',
          {
            class: `pp-arena ${open ? '' : 'locked'}`,
            disabled: !open,
            onclick: () => api.startTour(k),
            style: { backgroundImage: `linear-gradient(180deg, transparent 25%, rgba(0,0,0,.85)), linear-gradient(160deg, ${ARENAS[k].boards.bg[0]} 0 22%, ${ARENAS[k].boards.bg[2]} 22% 30%, ${ARENAS[k].table} 30% 62%, ${ARENAS[k].floor.a} 62%)` },
          },
          h('span', { class: 'pp-ar-n' }, t('arena', { n: k + 1 })),
          h('span', { class: 'pp-ar-t' }, t(ARENAS[k].key)),
          open
            ? h('span', { class: 'pp-ar-o' }, `${t(OPP_KEYS[opp.nameIdx])} · ${t('tierN', { n: opp.tier })}`)
            : h('span', { class: 'pp-ar-o' }, '🔒 ' + t('fansNeed', { n: need })),
        ),
      );
    }
    const pct = Math.min(100, ((p.fans - (info.season - 1) * 350) / 350) * 100);
    return wrap(
      head(t('tour'), () => api.go('menu')),
      h('div', { class: 'pp-season' }, h('div', { class: 'pp-season-t' }, t('season', { n: info.season }), h('small', null, `${t('fans')}: ${p.fans}`)), h('div', { class: 'pp-bar' }, h('i', { style: { width: pct + '%' } }))),
      h('div', { class: 'pp-arenas' }, list),
    );
  }

  function quick() {
    let level = 1;
    let best = 3;
    const chips = (vals, cur, onpick, labelOf) =>
      h(
        'div',
        { class: 'pp-chips' },
        vals.map((v, i) => h('button', { class: `pp-chip ${v === cur ? 'on' : ''}`, onclick: (e) => onpick(v, e) }, labelOf(v, i))),
      );
    const body = h('div', { class: 'pp-quick' });
    const render = () => {
      body.innerHTML = '';
      body.append(
        h('div', { class: 'pp-sec' }, t('difficulty')),
        chips([0, 1, 2, 3], level, (v) => { level = v; render(); }, (v) => t(QUICK_KEYS[v])),
        h('div', { class: 'pp-sec' }, t('bestOf')),
        chips([3, 5], best, (v) => { best = v; render(); }, (v) => t(v === 3 ? 'bo3' : 'bo5')),
        h('div', { class: 'pp-sub' }, t('tierN', { n: quickTier(level) })),
        h('button', { class: 'pp-cta', onclick: () => api.startQuick({ tier: quickTier(level), bestOf: best, level }) }, t('start')),
      );
    };
    render();
    return wrap(head(t('quick'), () => api.go('menu')), body);
  }

  function training() {
    const card = (drill, ic, title, desc, best) =>
      h(
        'button',
        { class: 'pp-card', onclick: () => api.startDrill(drill) },
        h('span', { class: 'pp-card-ic' }, ic),
        h('span', { class: 'pp-card-b' }, h('b', null, title), h('small', null, desc), h('small', { class: 'pp-best' }, t('bestRally', { n: best }))),
        h('span', { class: 'pp-card-go' }, '›'),
      );
    return wrap(
      head(t('training'), () => api.go('menu')),
      card('serve', '🎾', t('trainServe'), t('trainDesc1'), p.drill.serve),
      card('rally', '🔁', t('trainRally'), t('trainDesc2'), p.drill.rally),
      card('target', '🎯', t('trainTarget'), t('trainDesc3'), p.drill.target),
    );
  }

  function shop() {
    const sections = CATS.map((cat) => {
      const rows = ITEMS[cat].map((it) => {
        const owned = p.own[cat].includes(it.id);
        const on = p.eq[cat] === it.id;
        const name = t(ITEM_NAME[cat][it.id]);
        const bars = it.bars || null;
        const action = on
          ? h('span', { class: 'pp-eq' }, t('equipped'))
          : owned
            ? h('button', { class: 'pp-buy', onclick: () => api.equip(cat, it.id) }, t('equip'))
            : h('button', { class: `pp-buy ${p.coins >= it.cost ? '' : 'dis'}`, onclick: () => api.buy(cat, it.id) }, t('buy', { p: '◎' + it.cost }));
        return h(
          'div',
          { class: `pp-item ${on ? 'on' : ''}` },
          h('div', { class: 'pp-it-ic' }, cat === 'ball' ? h('i', { class: `pp-orb ${it.skin}` }) : cat === 'blade' ? '🏓' : cat === 'rubber' ? '⚫' : '👟'),
          h(
            'div',
            { class: 'pp-it-b' },
            h('b', null, name),
            h('small', null, t(ITEM_DESC[cat][it.id])),
            bars ? h('div', { class: 'pp-bars' }, bars.map((n, i) => h('span', { class: 'pp-bar-row' }, h('small', null, t(['statPower', 'statControl', 'statSpin'][i] || 'statMove')), h('em', null, h('i', { style: { width: n * 20 + '%' } }))))) : null,
          ),
          action,
        );
      });
      return [h('div', { class: 'pp-sec' }, t(CAT_LABEL[cat])), h('div', { class: 'pp-items' }, rows)];
    });
    return wrap(head(t('shop'), () => api.go('menu')), h('div', { class: 'pp-shop' }, sections));
  }

  return { menu, tour, quick, training, shop, head, wrap };
}
