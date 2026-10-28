// Fazenda Aventura: entry point. Owns the HUD, bottom bar, sheets, effects and view switching.
// Views: farm (isometric farm), orders (orders and quests), exp (expedition picker), run (expedition map).
import STRINGS from './strings.js';
import { createModel } from './model.js';
import { levelInfo, ITEMS, maxEnergy } from './data.js';
import * as farmView from './farm.js';
import * as runView from './run.js';
import * as ordersView from './orders.js';
import { fmtTime } from './format.js';
import { portrait } from './portraits.js';

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h } = ctx.ui;
  await ctx.loadCSS(new URL('./style.css', import.meta.url));

  const M = createModel(ctx.store, { addXP: (n) => ctx.addXP?.(n) });
  M.tick();
  M.save();
  let dead = false;

  // ------------------------------------------------------------ layout
  const app = h('div', { class: 'g-farm-app' });
  const hud = h('header', { class: 'g-farm-hud' });
  const viewHost = h('div', { class: 'g-farm-view' });
  const bar = h('nav', { class: 'g-farm-bar', role: 'toolbar' });
  const fx = h('div', { class: 'g-farm-fx' });
  app.append(hud, viewHost, bar);
  root.append(app, fx);

  const ui = {};
  ui.coins = h('b', { class: 'g-farm-num' });
  ui.gems = h('b', { class: 'g-farm-num' });
  ui.energy = h('b', { class: 'g-farm-num' });
  ui.energyBar = h('i');
  ui.level = h('b', { class: 'g-farm-lvl' });
  ui.xpBar = h('i');
  ui.coinPill = h('div', { class: 'g-farm-pill', title: t('coins') }, h('span', { class: 'g-farm-coin' }, '🪙'), ui.coins);
  ui.gemPill = h('div', { class: 'g-farm-pill', title: t('gems') }, h('span', { class: 'g-farm-coin' }, '💎'), ui.gems);
  ui.energyPill = h('div', { class: 'g-farm-pill g-farm-energy', title: t('energy') },
    h('span', { class: 'g-farm-coin' }, '⚡'), h('div', { class: 'g-farm-bar-mini' }, ui.energyBar), ui.energy);
  ui.lvlBox = h('div', { class: 'g-farm-lvlbox', title: t('xp', { a: 0, b: 0 }) }, ui.level, h('div', { class: 'g-farm-bar-mini xp' }, ui.xpBar));
  ui.lvlNum = h('b', { class: 'g-farm-avlvl' }, '1');
  const avatar = h('div', { class: 'g-farm-avatar' }, h('span', { class: 'g-farm-avimg', html: portrait('lia') }), ui.lvlNum);
  hud.append(h('div', { class: 'g-farm-hudmain' }, avatar,
    h('div', { class: 'g-farm-hudcol' }, h('div', { class: 'g-farm-hudrow' }, ui.coinPill, ui.gemPill, ui.lvlBox), h('div', { class: 'g-farm-hudrow' }, ui.energyPill))));

  const help = h('button', { class: 'icon-btn g-farm-help', title: t('help'), 'aria-label': t('help'), onclick: () => openHelp() }, '?');
  ctx.setHeaderRight(help);

  // ------------------------------------------------------------ HUD
  let lastLevel = null;
  function hudUpdate() {
    const info = M.levelInfo();
    const max = M.maxEnergy();
    const en = M.energy();
    ui.coins.textContent = fmtNum(M.S.coins);
    ui.gems.textContent = fmtNum(M.S.gems);
    ui.energy.textContent = `${en}/${max}`;
    ui.energyBar.style.width = Math.min(100, (en / max) * 100) + '%';
    ui.level.textContent = t('lvl', { n: info.level });
    ui.lvlNum.textContent = info.level;
    ui.xpBar.style.width = Math.min(100, (info.into / info.need) * 100) + '%';
    ui.lvlBox.title = t('xp', { a: info.into, b: info.need });
    if (lastLevel !== null && info.level > lastLevel) {
      toast(t('levelUp', { n: info.level }));
      ctx.sfx.play('levelup');
      ctx.ui.confetti(40);
    }
    lastLevel = info.level;
  }
  const fmtNum = (n) => Math.floor(n).toLocaleString(ctx.lang === 'en' ? 'en-US' : ctx.lang === 'es' ? 'es-ES' : 'pt-BR');

  // ------------------------------------------------------------ toast, effects
  let toastEl = null, toastTimer = 0;
  function toast(msg, ms = 1900) {
    if (!toastEl) {
      toastEl = h('div', { class: 'g-farm-toast' });
      app.append(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl?.classList.remove('show'), ms);
  }
  const errText = (err) => t('err_' + err);

  const local = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  };
  function floatText(text, cx, cy, cls = '') {
    const [x, y] = local(cx, cy);
    const el = h('div', { class: 'g-farm-float ' + cls, style: { left: x + 'px', top: y + 'px' } }, text);
    fx.append(el);
    el.animate([{ transform: 'translate(-50%,0) scale(0.7)', opacity: 0 }, { transform: 'translate(-50%,-14px) scale(1.05)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-44px) scale(1)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }).onfinish = () => el.remove();
  }
  function flyTo(emoji, cx, cy, target) {
    const [x, y] = local(cx, cy);
    const el = h('div', { class: 'g-farm-fly', style: { left: x + 'px', top: y + 'px' } }, emoji);
    fx.append(el);
    const tr = target?.getBoundingClientRect();
    const [tx, ty] = tr ? local(tr.left + tr.width / 2, tr.top + tr.height / 2) : [x, y - 120];
    el.animate([{ transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1 },
      { transform: `translate(${(tx - x) * 0.5 - 0}px, ${(ty - y) * 0.5 - 40}px) translate(-50%,-50%) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${tx - x}px, ${ty - y}px) translate(-50%,-50%) scale(0.4)`, opacity: 0.2 }],
      { duration: 650, easing: 'cubic-bezier(.45,0,.9,.5)' }).onfinish = () => { el.remove(); target?.classList?.add('pulse'); setTimeout(() => target?.classList?.remove('pulse'), 260); };
  }
  function burst(cx, cy, emoji, n = 4) {
    for (let i = 0; i < n; i++) {
      const jx = (Math.random() - 0.5) * 40, jy = (Math.random() - 0.5) * 20;
      setTimeout(() => flyTo(emoji, cx + jx, cy + jy, bar.querySelector('[data-id="warehouse"]')), i * 70);
    }
  }

  // ------------------------------------------------------------ sheets
  let sheetEl = null, sheetRefresh = null;
  function closeSheet() {
    if (!sheetEl) return false;
    const el = sheetEl;
    sheetEl = null;
    sheetRefresh = null;
    liveList = [];
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
    return true;
  }
  function sheet(title, body, opts = {}) {
    closeSheet();
    const close = () => closeSheet();
    const panel = h('section', { class: 'g-farm-sheet', role: 'dialog', 'aria-modal': 'true' },
      h('header', { class: 'g-farm-sheet-head' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', onclick: close, 'aria-label': t('close') }, '✕')),
      h('div', { class: 'g-farm-sheet-body' }, body));
    const wrap = h('div', { class: 'g-farm-sheetwrap' + (opts.wide ? ' wide' : '') }, h('div', { class: 'g-farm-scrim', onclick: close }), panel);
    root.append(wrap);
    sheetEl = wrap;
    requestAnimationFrame(() => wrap.classList.add('show'));
    ctx.sfx.play('pop');
    return close;
  }

  // Live text inside sheets (timers, gem prices) is registered with env.live and refreshed each second.
  let liveReg = null, liveList = [];
  const sigOf = (node) => node.textContent.replace(/\d+/g, '#') + '|' + node.querySelectorAll('button').length + '|' + node.querySelectorAll('button:disabled').length;
  // A sheet built by build(rerender). Actions call rerender (always rebuilds); the 1s refresh rebuilds only
  // when its structure changes, so buttons are not replaced under the player's finger.
  function dynSheet(title, build) {
    const body = h('div', { class: 'g-farm-dyn' });
    let sig = null;
    const render = (force) => {
      const pending = [];
      const saved = liveReg;
      liveReg = pending;
      const node = build(re);
      liveReg = saved;
      const s = sigOf(node);
      if (force || s !== sig) {
        sig = s;
        body.replaceChildren(node);
        liveList = pending;
      }
    };
    const re = () => render(true);
    render(true);
    const close = sheet(title, body);
    sheetRefresh = () => render(false);
    return close;
  }
  function setLive(el, fn, prop) {
    if (liveReg) liveReg.push([el, fn, prop]);
    if (prop) el.style[prop] = fn();
    else el.textContent = fn();
    return el;
  }

  function openHelp() {
    sheet(t('help'), h('p', { class: 'g-farm-text' }, t('helpBody')), { });
  }

  // ------------------------------------------------------------ bottom bar
  let barBtns = [];
  function setBar(items) {
    bar.replaceChildren();
    barBtns = items.map((it) => {
      const b = h('button', { class: 'g-farm-navbtn' + (it.active ? ' active' : ''), 'data-id': it.id, onclick: it.onclick },
        h('span', { class: 'g-farm-navico' }, it.icon), h('span', { class: 'g-farm-navlbl' }, it.label));
      bar.append(b);
      return b;
    });
  }

  // ------------------------------------------------------------ views
  const env = {
    ctx, t, M, lang: ctx.lang, h, ui: ctx.ui, sfx: ctx.sfx,
    toast, errText, floatText, flyTo, burst, sheet, dynSheet, closeSheet, setBar, live: setLive,
    hud: hudUpdate,
    go: (name, arg) => go(name, arg),
    isDead: () => dead,
    fmtTime, fmtNum,
    barEl: (id) => bar.querySelector(`[data-id="${id}"]`),
    hudEl: (k) => (k === 'coins' ? ui.coinPill : k === 'gems' ? ui.gemPill : ui.lvlBox),
    flyCoins: (cx, cy, n) => {
      floatText('+' + fmtNum(n) + ' 🪙', cx, cy - 10, 'coin');
      flyTo('🪙', cx, cy, ui.coinPill);
    },
    confirm: (opts) => ctx.ui.modal(opts),
    save: () => M.save(),
    rootEl: root,
    layer: viewHost,
  };

  let view = null, viewName = null;
  function go(name, arg) {
    if (dead) return;
    if (name === 'run' && !M.S.run) name = 'exp';
    closeSheet();
    view?.destroy?.();
    view = null;
    viewHost.replaceChildren();
    viewName = name;
    const host = h('div', { class: 'g-farm-viewbox' });
    viewHost.append(host);
    if (name === 'farm') view = farmView.mount(host, env, arg);
    else if (name === 'orders') view = ordersView.mount(host, env, arg);
    else if (name === 'exp') view = runView.mountSelect(host, env, arg);
    else if (name === 'run') view = runView.mountRun(host, env, arg);
    hudUpdate();
  }

  // ------------------------------------------------------------ game loop
  let lastSave = 0;
  const loop = setInterval(() => {
    if (dead) return;
    const events = M.tick();
    for (const ev of events) {
      if (ev.k === 'train') toast(t('trainTitle'));
      if (ev.k === 'ship') toast(t('shipTitle'));
    }
    hudUpdate();
    if (sheetEl) {
      sheetRefresh?.();
      for (const [el, fn, prop] of liveList) if (el.isConnected) (prop ? (el.style[prop] = fn()) : (el.textContent = fn()));
    }
    if (performance.now() - lastSave > 5000) { M.save(); lastSave = performance.now(); }
    view?.tick?.();
  }, 1000);

  ctx.onBack(() => {
    if (sheetEl) { closeSheet(); return true; }
    if (view?.onBack?.()) return true;
    if (viewName !== 'farm') { go('farm'); return true; }
    return false;
  });

  // ------------------------------------------------------------ start
  const first = ctx.mode === 'orders' ? 'orders' : ctx.mode === 'expedition' ? 'exp' : 'farm';
  go(first);
  hudUpdate();

  return () => {
    dead = true;
    clearInterval(loop);
    clearTimeout(toastTimer);
    closeSheet();
    view?.destroy?.();
    M.save();
    ctx.setHeaderRight(null);
    app.remove();
    fx.remove();
  };
}
