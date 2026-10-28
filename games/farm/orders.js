// Orders board (regular orders, train and ship) and quests from the characters.
import { ITEMS } from './data.js';
import { portrait } from './portraits.js';
import { fmtTime } from './format.js';
import { openWarehouse } from './panels.js';

export function mount(host, env, arg) {
  const { t, M, h, toast, errText, sfx, hud, setBar, fmtNum, floatText } = env;
  let tab = arg === 'quests' ? 'quests' : 'orders';
  const root = h('div', { class: 'g-farm-orders' });
  host.append(root);
  let sig = '';
  const timers = [];

  setBar([
    { id: 'farm', icon: '🌾', label: t('barFarm'), onclick: () => env.go('farm') },
    { id: 'warehouse', icon: '📦', label: t('barWarehouse'), onclick: () => openWarehouse(env) },
    { id: 'exp', icon: '🧭', label: t('barExpedition'), onclick: () => env.go(M.S.run ? 'run' : 'exp') },
  ]);

  const tabsEl = h('div', { class: 'g-farm-tabs seg' });
  const listEl = h('div', { class: 'g-farm-orderlist' });
  root.append(tabsEl, listEl);

  const who = (id) => t('char_' + id);
  const rewardText = (r) => t('rewardLine', { c: fmtNum(r.coins), g: r.gems, x: r.xp });

  function needChips(need) {
    return h('div', { class: 'g-farm-needs' }, ...Object.entries(need).map(([id, n]) => {
      const have = M.S.inv[id] || 0;
      return h('span', { class: 'g-farm-need' + (have >= n ? ' ok' : '') }, ITEMS[id].e, ' ', `${Math.min(have, n)}/${n}`);
    }));
  }

  function deliverBtn(id, need) {
    const can = M.has(need);
    return h('button', { class: 'btn small primary', disabled: !can, onclick: (ev) => {
      const r = M.deliver(id);
      if (!r.ok) return toast(errText(r.err));
      sfx.play('win');
      floatText(rewardText(r.reward), ev.clientX, ev.clientY - 20, 'gain');
      toast(t('delivered'));
      hud();
      render(true);
    } }, t('deliver'));
  }

  function orderCard(o) {
    const timer = h('small', { class: 'timer' }, '');
    timers.push({ el: timer, at: o.exp, key: 'expires' });
    return h('article', { class: 'g-farm-card' },
      h('div', { class: 'g-farm-card-head' },
        h('span', { class: 'g-farm-portrait', html: portrait(o.who) }),
        h('div', { class: 'g-farm-card-title' }, h('b', {}, t('orderFrom', { who: who(o.who) })), timer)),
      needChips(o.need),
      h('div', { class: 'g-farm-card-foot' }, h('span', { class: 'reward' }, rewardText(o.reward)), deliverBtn(o.id, o.need)));
  }

  function specialCard(s) {
    const timer = h('small', { class: 'timer' }, '');
    timers.push({ el: timer, at: s.leave, key: s.kind === 'train' ? 'trainLeave' : 'shipLeave' });
    return h('article', { class: 'g-farm-card special ' + s.kind },
      h('div', { class: 'g-farm-card-head' },
        h('span', { class: 'g-farm-portrait', html: portrait(s.who) }),
        h('div', { class: 'g-farm-card-title' }, h('b', {}, t(s.kind === 'train' ? 'trainTitle' : 'shipTitle')), timer)),
      h('p', { class: 'g-farm-text small' }, who(s.who)),
      needChips(s.need),
      h('div', { class: 'g-farm-card-foot' }, h('span', { class: 'reward' }, rewardText(s.reward)), deliverBtn(s.id, s.need)));
  }

  function questCard(q) {
    const done = q.prog >= q.target;
    return h('article', { class: 'g-farm-card quest' + (done ? ' done' : '') },
      h('div', { class: 'g-farm-card-head' },
        h('span', { class: 'g-farm-portrait', html: portrait(q.giver) }),
        h('div', { class: 'g-farm-card-title' }, h('b', {}, t('q_' + q.type, { n: q.target })), h('small', {}, t('questFrom', { who: who(q.giver) })))),
      h('div', { class: 'g-farm-progress' }, h('i', { style: { width: (q.prog / q.target * 100).toFixed(1) + '%' } })),
      h('div', { class: 'g-farm-card-foot' },
        h('span', { class: 'reward' }, t('questProg', { p: q.prog, t: q.target }) + ' · ' + rewardText(q.reward)),
        h('button', { class: 'btn small primary', disabled: !done, onclick: (ev) => {
          const r = M.claimQuest(q.id);
          if (!r.ok) return toast(errText(r.err));
          sfx.play('levelup');
          floatText(rewardText(r.reward), ev.clientX, ev.clientY - 20, 'gain');
          hud();
          render(true);
        } }, t('claim'))));
  }

  function render(force) {
    const specials = [M.S.train, M.S.ship].filter(Boolean);
    const newSig = tab + '|' + M.S.orders.map((o) => o.id).join(',') + '|' + specials.map((s) => s.id).join(',') + '|' + M.S.quests.map((q) => q.id + ':' + q.prog).join(',') + '|' + Object.values(M.S.inv).join(',');
    if (!force && newSig === sig) return;
    sig = newSig;
    timers.length = 0;
    tabsEl.replaceChildren(
      h('button', { class: 'chip' + (tab === 'orders' ? ' active' : ''), onclick: () => { tab = 'orders'; render(true); } }, t('tabOrders')),
      h('button', { class: 'chip' + (tab === 'quests' ? ' active' : ''), onclick: () => { tab = 'quests'; render(true); } }, t('tabQuests')));
    const nodes = [];
    if (tab === 'orders') {
      for (const s of specials) nodes.push(specialCard(s));
      for (const o of M.S.orders) nodes.push(orderCard(o));
      if (!nodes.length) nodes.push(h('p', { class: 'g-farm-text' }, t('noOrders')));
    } else {
      for (const q of M.S.quests) nodes.push(questCard(q));
      if (!nodes.length) nodes.push(h('p', { class: 'g-farm-text' }, t('noQuests')));
    }
    listEl.replaceChildren(...nodes);
    tickTimers();
  }

  function tickTimers() {
    const now = M.now();
    for (const tm of timers) {
      const left = tm.at - now;
      tm.el.textContent = tm.key === 'expires' ? t('expires', { t: fmtTime(left) }) : t(tm.key, { t: fmtTime(left) });
    }
  }

  render(true);

  return {
    tick() { render(false); tickTimers(); },
    onBack() { return false; },
    destroy() { root.remove(); },
  };
}
