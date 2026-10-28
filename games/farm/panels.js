// Sheets used from the farm: warehouse, shop, production buildings and animal pens.
import { ITEMS, PENS, PROD, DECOR, MAX_PENS_ANIMALS, costOf, lvlOf, kindOf } from './data.js';
import { fmtTime } from './format.js';

const COST_ICON = { coins: '🪙', wood: '🪵', stone: '🪨' };
const costText = (c) => Object.entries(c).map(([k, v]) => `${v}${COST_ICON[k] || ''}`).join('  ');
const recipeText = (m) => Object.entries(m).map(([k, v]) => `${v > 1 ? v : ''}${ITEMS[k].e}`).join(' + ');

export function openWarehouse(env) {
  const { t, M, h, toast, errText, sfx, hud, dynSheet, floatText, fmtNum } = env;
  dynSheet(t('whTitle'), (re) => {
    const total = M.total(), cap = M.cap();
    const wrap = h('div', { class: 'g-farm-col' });
    wrap.append(h('div', { class: 'g-farm-capbar' }, h('i', { style: { width: Math.min(100, (total / cap) * 100) + '%' } }), h('span', {}, t('whCap', { a: total, b: cap }))));
    if (M.S.whUp >= 10) {
      wrap.append(h('p', { class: 'g-farm-text small' }, t('whMax')));
    } else {
      const c = { coins: 100 * (M.S.whUp + 1), wood: 5 * (M.S.whUp + 1) };
      const can = M.S.coins >= c.coins && M.has({ wood: c.wood });
      wrap.append(h('button', { class: 'btn accent block', disabled: !can, onclick: () => {
        const r = M.upgradeWh();
        if (!r.ok) return toast(errText(r.err));
        sfx.play('success');
        hud();
        re();
      } }, t('whUp', { c: c.coins, w: c.wood })));
    }
    const ids = Object.keys(ITEMS).filter((id) => (M.S.inv[id] || 0) > 0).sort((a, b) => ITEMS[b].v - ITEMS[a].v);
    if (!ids.length) wrap.append(h('p', { class: 'g-farm-text' }, t('whEmpty')));
    const list = h('div', { class: 'g-farm-list' });
    for (const id of ids) {
      const n = M.S.inv[id];
      const it = ITEMS[id];
      const row = h('div', { class: 'g-farm-row static' },
        h('span', { class: 'g-farm-row-ico' }, it.e),
        h('span', { class: 'g-farm-row-body' }, h('b', {}, t('item_' + id)), h('small', {}, `× ${fmtNum(n)}`)),
        h('span', { class: 'g-farm-row-acts' },
          it.en ? h('button', { class: 'btn small good', onclick: (ev) => {
            const r = M.eat(id);
            if (!r.ok) return toast(errText(r.err));
            sfx.play('success');
            floatText(t('ate', { e: r.en }), ev.clientX, ev.clientY - 14, 'gain');
            hud();
            re();
          } }, t('whEat', { e: it.en })) : null,
          h('button', { class: 'btn small', onclick: (ev) => {
            const r = M.sell(id, 1);
            if (!r.ok) return toast(errText(r.err));
            sfx.play('coin');
            floatText(t('sold', { c: r.coins }), ev.clientX, ev.clientY - 14, 'coin');
            hud();
            re();
          } }, t('whSell', { v: it.v })),
          n > 1 ? h('button', { class: 'btn small ghost', onclick: (ev) => {
            const r = M.sell(id, n);
            if (!r.ok) return toast(errText(r.err));
            sfx.play('coin');
            floatText(t('sold', { c: r.coins }), ev.clientX, ev.clientY - 14, 'coin');
            hud();
            re();
          } }, `×${n}`) : null));
      list.append(row);
    }
    wrap.append(list);
    return wrap;
  });
}

export function openShop(env, startPlacing) {
  const { t, M, h, dynSheet, closeSheet } = env;
  let tab = 'animals';
  const TABS = [['animals', 'tabAnimals'], ['build', 'tabBuild'], ['deco', 'tabDeco']];
  dynSheet(t('shopTitle'), (re) => {
    const tabs = h('div', { class: 'g-farm-tabs' }, ...TABS.map(([k, key]) =>
      h('button', { class: 'chip' + (tab === k ? ' active' : ''), onclick: () => { tab = k; re(); } }, t(key))));
    const ids = tab === 'animals' ? Object.keys(PENS) : tab === 'build' ? Object.keys(PROD) : Object.keys(DECOR);
    const list = h('div', { class: 'g-farm-list' });
    for (const id of ids) {
      const kind = kindOf(id);
      const icon = (PENS[id] || PROD[id] || DECOR[id]).e;
      const lvl = lvlOf(id);
      const owned = kind !== 'deco' && M.S.B.some((b) => b.t === id);
      const locked = M.level() < lvl;
      const c = costOf(id);
      const affordable = M.S.coins >= (c.coins || 0) && Object.entries(c).every(([k, v]) => k === 'coins' || (M.S.inv[k] || 0) >= v);
      const label = owned ? '✓' : locked ? t('needLvl', { n: lvl }) : t('buy');
      list.append(h('button', { class: 'g-farm-row' + (locked || owned ? ' locked' : ''), disabled: locked || owned || !affordable, onclick: () => {
        closeSheet();
        startPlacing(id);
      } },
        h('span', { class: 'g-farm-row-ico' }, icon),
        h('span', { class: 'g-farm-row-body' },
          h('b', {}, t(prefixOf(id) + '_' + id)),
          h('small', {}, t('desc_' + id)),
          h('small', { class: 'cost' }, costText(c))),
        h('span', { class: 'g-farm-row-end' }, label)));
    }
    return h('div', { class: 'g-farm-col' }, tabs, list);
  });
}
const prefixOf = (id) => (id in PENS ? 'pen' : id in PROD ? 'prod' : 'deco');

export function openProd(env, bid) {
  const { t, M, h, toast, errText, sfx, hud, dynSheet } = env;
  const b0 = M.S.B.find((q) => q.id === bid);
  if (!b0) return;
  const P = PROD[b0.t];
  dynSheet(t('prod_' + b0.t), (re) => {
    const b = M.S.B.find((q) => q.id === bid);
    const now = M.now();
    const wrap = h('div', { class: 'g-farm-col' });
    wrap.append(h('div', { class: 'g-farm-big-ico' }, P.e));
    wrap.append(h('p', { class: 'g-farm-text small' }, t('prodQueue', { a: b.q.length, b: P.slots })));
    const queue = h('div', { class: 'g-farm-list' });
    if (!b.q.length) queue.append(h('p', { class: 'g-farm-text small' }, t('prodEmpty')));
    b.q.forEach((job, i) => {
      const r = P.recipes[job.r];
      const left = job.end - now;
      const gems = Math.max(1, Math.ceil(left / 60e3));
      const remain = () => {
        const x = M.S.B.find((q) => q.id === bid);
        const j = x && x.q[i];
        return j ? j.end - M.now() : 0;
      };
      queue.append(h('div', { class: 'g-farm-row static' },
        h('span', { class: 'g-farm-row-ico' }, recipeText(r.out)),
        h('span', { class: 'g-farm-row-body' },
          env.live(h('b'), () => (remain() > 0 ? t('prodLeft', { t: fmtTime(remain()) }) : t('err_full'))),
          h('small', {}, recipeText(r.in) + ' → ' + recipeText(r.out))),
        i === 0 && left > 0 ? env.live(h('button', { class: 'btn small accent', disabled: M.S.gems < gems, onclick: () => {
          const res = M.speedJob(bid, i);
          if (!res.ok) return toast(errText(res.err));
          sfx.play('success');
          hud();
          re();
        } }), () => t('speedBtn', { g: Math.max(1, Math.ceil(Math.max(0, remain()) / 60e3)) })) : null));
    });
    wrap.append(queue);
    wrap.append(h('h3', { class: 'g-farm-sub' }, t('prodStart')));
    const list = h('div', { class: 'g-farm-list' });
    P.recipes.forEach((r, ri) => {
      const locked = M.level() < r.lvl;
      const ok = !locked && b.q.length < P.slots && M.has(r.in);
      list.append(h('button', { class: 'g-farm-row' + (locked ? ' locked' : ''), disabled: !ok, onclick: () => {
        const res = M.startJob(bid, ri);
        if (!res.ok) return toast(errText(res.err));
        sfx.play('pop');
        hud();
        re();
      } },
        h('span', { class: 'g-farm-row-ico' }, recipeText(r.out)),
        h('span', { class: 'g-farm-row-body' },
          h('b', {}, recipeText(r.in) + ' → ' + recipeText(r.out)),
          h('small', {}, locked ? t('needLvl', { n: r.lvl }) : fmtTime(r.t))),
        h('span', { class: 'g-farm-row-end' }, locked ? '🔒' : '▶')));
    });
    wrap.append(list);
    return wrap;
  });
}

export function openPen(env, bid) {
  const { t, M, h, toast, errText, sfx, hud, dynSheet, floatText } = env;
  const b0 = M.S.B.find((q) => q.id === bid);
  if (!b0) return;
  const P = PENS[b0.t];
  dynSheet(t('pen_' + b0.t), (re) => {
    const b = M.S.B.find((q) => q.id === bid);
    const now = M.now();
    const status = () => {
      const x = M.S.B.find((q) => q.id === bid);
      return x.st > 0 ? t('penReady') : x.busy ? t('penBusy', { t: fmtTime(x.busy - M.now()) }) : t('penIdle');
    };
    const wrap = h('div', { class: 'g-farm-col' });
    wrap.append(h('div', { class: 'g-farm-big-ico' }, P.e));
    wrap.append(env.live(h('p', { class: 'g-farm-text' }), status));
    wrap.append(h('p', { class: 'g-farm-text small' }, t('penAnimals', { n: b.count, m: MAX_PENS_ANIMALS }), ' · ',
      t('penQueue', { n: b.cyc }), ' · ', t('penStored', { n: b.st })));
    wrap.append(h('p', { class: 'g-farm-text small' }, t('penFoodList', { f: P.food.map((f) => ITEMS[f].e).join(' ') })));
    const acts = h('div', { class: 'g-farm-col' });
    if (b.st > 0) {
      acts.append(h('button', { class: 'btn primary block big', onclick: (ev) => {
        const r = M.collectPen(bid);
        if (!r.ok) return toast(errText(r.err));
        sfx.play('coin');
        floatText('+' + r.n + ' ' + ITEMS[r.id].e, ev.clientX, ev.clientY - 14, 'gain');
        hud();
        re();
      } }, t('penCollect', { n: b.st })));
    }
    const food = P.food.some((f) => (M.S.inv[f] || 0) >= b.count);
    acts.append(h('button', { class: 'btn good block', disabled: !food || b.cyc >= 3, onclick: () => {
      const r = M.feedPen(bid);
      if (!r.ok) return toast(errText(r.err));
      sfx.play('pop');
      hud();
      re();
    } }, t('penFeed', { n: b.count })));
    if (b.busy) {
      const left = Math.max(0, b.busy - now);
      const gems = Math.max(1, Math.ceil(left / 60e3));
      acts.append(env.live(h('button', { class: 'btn accent block', disabled: M.S.gems < gems, onclick: () => {
        const r = M.speedPen(bid);
        if (!r.ok) return toast(errText(r.err));
        sfx.play('success');
        hud();
        re();
      } }), () => {
        const x = M.S.B.find((q) => q.id === bid);
        return t('speedBtn', { g: Math.max(1, Math.ceil(Math.max(0, (x.busy || 0) - M.now()) / 60e3)) });
      }));
    }
    acts.append(h('button', { class: 'btn block', disabled: b.count >= MAX_PENS_ANIMALS || M.S.coins < P.add, onclick: () => {
      const r = M.buyAnimal(bid);
      if (!r.ok) return toast(errText(r.err));
      sfx.play('pop');
      hud();
      re();
    } }, t('penBuy', { c: P.add })));
    wrap.append(acts);
    return wrap;
  });
}
