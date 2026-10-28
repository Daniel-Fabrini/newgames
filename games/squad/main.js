// Survivor Squad — base building + lane runner-shooter.
// Main screen: isometric base (Build / Army / Missions / Map tabs).
// Core gameplay: the runner (sim.js + render.js).

import STRINGS from './strings.js';
import * as D from './data.js';
import { World } from './sim.js';
import { Renderer } from './render.js';
import { Sprites, drawSpr } from './sprites.js';
import { BaseView, buildingThumb } from './base.js';
import { icon, rankBadge } from './icons.js';
import { rng } from '../../js/core/ui.js';

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const sfx = ctx.sfx;
  const locale = ctx.lang === 'pt' ? 'pt-BR' : ctx.lang === 'es' ? 'es-ES' : 'en-US';
  const num = (n) => Math.floor(n).toLocaleString(locale);
  await ctx.loadCSS(new URL('./style.css', import.meta.url));

  let save = D.migrateSave(ctx.store.get('save', null));
  const persist = () => ctx.store.set('save', save);
  persist();

  let alive = true;
  const timeouts = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timeouts.delete(id);
      if (alive) fn();
    }, ms);
    timeouts.add(id);
    return id;
  };
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  const app = h('div', { class: 'g-squad-app' });
  root.append(app);

  let screen = null;
  let base = null;
  let run = null;
  let sheet = null;
  let raf = 0;
  let lastT = 0;
  let mapObserver = null;

  // =========================================================== helpers
  const now = () => Date.now();
  const fmtTime = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    if (hh > 0) return `${hh}h ${mm}min`;
    return `${mm}min ${s % 60}s`;
  };
  const canAfford = (c) => save.gold >= (c.gold || 0) && save.mat >= (c.mat || 0) && save.gems >= (c.gems || 0);
  const pay = (c) => {
    save.gold -= c.gold || 0;
    save.mat -= c.mat || 0;
    save.gems -= c.gems || 0;
  };
  function costChips(c) {
    const wrap = h('div', { class: 'g-squad-costs' });
    for (const k of ['gold', 'mat', 'gems']) {
      if (!c[k]) continue;
      wrap.append(h('span', { class: `g-squad-cost ${save[k] < c[k] ? 'short' : ''}` }, icon(k), D.fmt(c[k])));
    }
    return wrap;
  }
  function goldBtn(label, onclick, extra = '') {
    return h('button', { class: `g-squad-btn ${extra}`, onclick }, label);
  }
  function refuse(el) {
    sfx.play('error');
    sfx.vibrate(30);
    ctx.ui.toast(t('notEnough'));
    if (el) {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
  }

  // =========================================================== production
  function prodInfo(kind) {
    const lvl = kind === 'gold' ? save.bld.goldmine : save.bld.factory;
    const perH = kind === 'gold' ? D.goldPerHour(lvl) : D.matPerHour(lvl);
    const cap = Math.round(perH * D.storageHours(save.bld.hq));
    const amt = Math.min(cap, ((now() - save.prod[kind]) / 3600000) * perH);
    return { lvl, perH, cap, amt };
  }
  function collect(kind, sx, sy) {
    const p = prodInfo(kind);
    const n = Math.floor(p.amt);
    if (n < 1) return;
    save[kind] += n;
    save.prod[kind] = now();
    persist();
    flyResources(kind, n, sx, sy);
    sfx.play('coin');
    sfx.vibrate(15);
    if (sheet) renderSheet();
  }

  // =========================================================== daily missions
  function ensureDaily() {
    const day = D.dayKey();
    if (save.daily && save.daily.day === day) return save.daily;
    let hs = 7;
    for (const ch of day) hs = (hs * 31 + ch.charCodeAt(0)) | 0;
    const r = rng(hs);
    const pool = D.MISSIONS.slice();
    const list = [];
    while (list.length < 3 && pool.length) {
      const m = pool.splice(Math.floor(r() * pool.length), 1)[0];
      list.push({ id: m.id, goal: m.goal(save.level), prog: 0, claimed: false });
    }
    save.daily = { day, list };
    persist();
    return save.daily;
  }
  function mission(id, amount, asMax = false) {
    ensureDaily();
    for (const m of save.daily.list) {
      if (m.id !== id || m.claimed) continue;
      m.prog = asMax ? Math.max(m.prog, amount) : m.prog + amount;
    }
  }
  const claimable = () => ensureDaily().list.some((m) => !m.claimed && m.prog >= m.goal);

  // =========================================================== flying rewards
  function flyResources(kind, n, sx, sy) {
    const rr = root.getBoundingClientRect();
    const target = (base && base.pills[kind]) || null;
    const pop = h('div', { class: 'g-squad-floattext' }, `+${D.fmt(n)}`);
    pop.style.left = sx + 'px';
    pop.style.top = sy + 'px';
    root.append(pop);
    later(() => pop.remove(), 1000);
    if (!target) return;
    const tr = target.getBoundingClientRect();
    const tx = tr.left - rr.left + 16;
    const ty = tr.top - rr.top + tr.height / 2;
    const count = Math.min(9, 3 + Math.floor(Math.log10(n + 1) * 2));
    for (let i = 0; i < count; i++) {
      const el = icon(kind, 'g-squad-fly');
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
      root.append(el);
      const dx = (Math.random() - 0.5) * 70;
      const dy = (Math.random() - 0.5) * 50;
      if (el.animate) {
        const a = el.animate(
          [
            { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.15)`, opacity: 1, offset: 0.3 },
            { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) scale(.7)`, opacity: 0.9 },
          ],
          { duration: 620 + i * 45, easing: 'cubic-bezier(.45,0,.55,1)' },
        );
        a.onfinish = () => el.remove();
      }
      later(() => el.remove(), 1200);
    }
    later(() => {
      refreshRes();
      target.classList.remove('bump');
      void target.offsetWidth;
      target.classList.add('bump');
    }, 640);
  }

  // =========================================================== loop
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (ts - (lastT || ts)) / 1000));
    lastT = ts;
    try {
      if (screen === 'base' && base) frameBase(dt);
      else if (screen === 'run' && run) frameRun(dt);
    } catch (e) {
      console.error(e);
      cancelAnimationFrame(raf);
    }
  }
  raf = requestAnimationFrame(loop);

  const onResize = () => {
    if (screen === 'base' && base) resizeBase();
    if (screen === 'run' && run) resizeRun();
  };
  window.addEventListener('resize', onResize);
  let ro = null;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(onResize);
    ro.observe(root);
  }

  // =========================================================== BASE
  function resBar() {
    const pills = {};
    const vals = {};
    const el = h('div', { class: 'g-squad-res' });
    for (const k of ['gold', 'mat', 'gems']) {
      vals[k] = h('b', null, D.fmt(save[k]));
      pills[k] = h('div', { class: 'g-squad-pill', title: t(k) }, icon(k), vals[k]);
      el.append(pills[k]);
    }
    el.append(h('button', { class: 'g-squad-plus', 'aria-label': t('supplyTitle'), onclick: openSupply, html: '' }, icon('plus')));
    return { el, pills, vals };
  }
  function refreshRes() {
    if (!base) return;
    for (const k of ['gold', 'mat', 'gems']) base.vals[k].textContent = D.fmt(save[k]);
    refreshDots();
  }

  const TABS = [
    { id: 'build', icon: 'tabBuild', label: 'tabBuild' },
    { id: 'army', icon: 'tabArmy', label: 'tabArmy' },
    { id: 'missions', icon: 'tabMissions', label: 'tabMissions' },
    { id: 'map', icon: 'tabMap', label: 'tabMap' },
  ];
  function tabBar() {
    const el = h('nav', { class: 'g-squad-tabs' });
    const btns = {};
    const dots = {};
    for (const tb of TABS) {
      dots[tb.id] = h('i', { class: 'g-squad-dot' });
      btns[tb.id] = h(
        'button',
        { class: 'g-squad-tab', onclick: () => (sheet && sheet.kind === tb.id ? closeSheet() : openSheet(tb.id)) },
        h('span', { class: 'g-squad-tab-ico' }, icon(tb.icon)),
        h('span', { class: 'g-squad-tab-lbl' }, t(tb.label)),
        dots[tb.id],
      );
      el.append(btns[tb.id]);
    }
    return { el, btns, dots };
  }

  function upgradableSet() {
    const s = new Set();
    for (const b of D.BUILDINGS) {
      const lvl = save.bld[b.id];
      if (lvl < D.bldMaxLevel(save, b.id) && canAfford(D.bldCost(b.id, lvl))) s.add(b.id);
    }
    return s;
  }
  function armyAffordable() {
    if (canAfford(D.trainCost(save.train))) return true;
    for (const hd of D.HEROES) {
      const st = save.heroes[hd.id];
      if (!st.own && canAfford({ gold: hd.gold, gems: hd.gems })) return true;
      if (st.own && canAfford(D.heroLvlCost(hd.id, st.lvl))) return true;
    }
    return false;
  }
  function refreshDots() {
    if (!base) return;
    base.tabs.dots.build.classList.toggle('on', upgradableSet().size > 0);
    base.tabs.dots.army.classList.toggle('on', armyAffordable());
    base.tabs.dots.missions.classList.toggle('on', claimable());
    base.tabs.dots.map.classList.toggle('on', false);
  }

  function showBase(openTab) {
    teardownRun();
    teardownBase();
    screen = 'base';
    clear(app);
    const cv = h('canvas', { class: 'g-squad-basecv' });
    const res = resBar();
    const tabs = tabBar();
    const sheetHost = h('div', { class: 'g-squad-sheethost' });
    const el = h('div', { class: 'g-squad-main fade-in' }, cv, res.el, tabs.el, sheetHost);
    app.append(el);
    const view = new BaseView(cv, {
      onTap: (id) => {
        sfx.play('tap');
        if (id.startsWith('hero:')) openSheet('army', { focus: id.slice(5) });
        else openSheet('build', { focus: id });
      },
      onCollect: (kind, x, y) => collect(kind, x, y),
    });
    base = { el, cv, view, res, pills: res.pills, vals: res.vals, tabs, sheetHost, info: null, infoT: 0 };
    resizeBase();
    view.rebuild(save);
    view.focus('hq');
    refreshDots();
    if (openTab) openSheet(openTab);
    else if (!save.helpShown) later(showWelcome, 450);
  }
  function teardownBase() {
    if (!base) return;
    closeSheet(true);
    base.view.destroy();
    base = null;
  }
  function resizeBase() {
    const w = root.clientWidth || 360;
    const hh = root.clientHeight || 640;
    const top = base.res.el.offsetHeight || 56;
    const bottom = base.tabs.el.offsetHeight || 100;
    base.view.resize(w, hh, dpr(), top, bottom);
  }
  function baseInfo() {
    const bubbles = [];
    for (const [kind, id] of [['gold', 'goldmine'], ['mat', 'factory']]) {
      const p = prodInfo(kind);
      if (p.amt >= Math.max(5, p.cap * 0.03)) bubbles.push({ id, kind, full: p.amt >= p.cap });
    }
    const levels = { ...save.bld };
    for (const hd of D.HEROES) if (save.heroes[hd.id].own) levels['hero:' + hd.id] = save.heroes[hd.id].lvl;
    return { bubbles, upgradable: upgradableSet(), levels };
  }
  function frameBase(dt) {
    base.infoT -= dt;
    if (!base.info || base.infoT <= 0) {
      base.info = baseInfo();
      base.infoT = 0.5;
    }
    base.view.frame(dt, base.info);
  }

  // ----------------------------------------------------------- sheets
  function openSheet(kind, opt = {}) {
    if (!base) return;
    sfx.play('tap');
    closeSheet(true);
    const body = h('div', { class: 'g-squad-sheet-body' });
    const titleKey = { build: 'tabBuild', army: 'tabArmy', missions: 'tabMissions', map: 'tabMap' }[kind];
    const el = h(
      'div',
      { class: `g-squad-sheet g-squad-sheet-${kind}`, role: 'dialog', 'aria-label': t(titleKey) },
      h(
        'div',
        { class: 'g-squad-sheet-head' },
        h('span', { class: 'g-squad-sheet-ico' }, icon(TABS.find((x) => x.id === kind).icon)),
        h('h2', null, t(titleKey)),
        h('button', { class: 'g-squad-x', 'aria-label': t('close'), onclick: () => closeSheet() }, icon('close')),
      ),
      body,
    );
    const scrim = h('div', { class: 'g-squad-scrim', onclick: () => closeSheet() });
    base.sheetHost.append(scrim, el);
    sheet = { kind, el, body, scrim, opt };
    for (const tb of TABS) base.tabs.btns[tb.id].classList.toggle('active', tb.id === kind);
    base.tabs.btns[kind].classList.remove('pulse');
    requestAnimationFrame(() => {
      el.classList.add('open');
      scrim.classList.add('open');
    });
    renderSheet();
    if (opt.focus) {
      const target = body.querySelector(`[data-id="${opt.focus}"]`);
      if (target) {
        target.classList.add('focus');
        later(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260);
      }
    }
  }
  function closeSheet(instant = false) {
    if (!sheet) return;
    const s = sheet;
    sheet = null;
    if (mapObserver) {
      mapObserver.disconnect();
      mapObserver = null;
    }
    if (base) for (const tb of TABS) base.tabs.btns[tb.id].classList.remove('active');
    if (instant) {
      s.el.remove();
      s.scrim.remove();
      return;
    }
    sfx.play('tap');
    s.el.classList.remove('open');
    s.scrim.classList.remove('open');
    later(() => {
      s.el.remove();
      s.scrim.remove();
    }, 260);
  }
  function renderSheet() {
    if (!sheet) return;
    const body = sheet.body;
    const st = body.scrollTop;
    clear(body);
    if (sheet.kind === 'build') renderBuild(body);
    else if (sheet.kind === 'army') renderArmy(body);
    else if (sheet.kind === 'missions') renderMissions(body);
    else renderMap(body);
    body.scrollTop = st;
  }

  // ----------------------------------------------------------- build
  function effectText(id, lvl) {
    const n = lvl + 1;
    switch (id) {
      case 'hq':
        return t('e_hq', { a: lvl, b: n });
      case 'barracks':
        return t('e_barracks', { a: 2 + lvl, b: 2 + n });
      case 'arms':
        return t('e_arms', { a: 10 * (lvl - 1), b: 10 * (n - 1) });
      case 'range':
        return t('e_range', { a: 6 * (lvl - 1), b: 6 * (n - 1) });
      case 'hospital':
        return t('e_hospital', { a: 10 * (lvl - 1), b: 10 * (n - 1) });
      case 'goldmine':
        return t('e_goldmine', { a: num(D.goldPerHour(lvl)), b: num(D.goldPerHour(n)) });
      case 'factory':
        return t('e_factory', { a: num(D.matPerHour(lvl)), b: num(D.matPerHour(n)) });
      default:
        return t('e_tower', { a: 8 * (lvl - 1), b: 8 * (n - 1) });
    }
  }
  function renderBuild(body) {
    const list = h('div', { class: 'g-squad-cards' });
    for (const b of D.BUILDINGS) {
      const id = b.id;
      const lvl = save.bld[id];
      const max = D.bldMaxLevel(save, id);
      const cost = D.bldCost(id, lvl);
      const thumb = h('div', { class: 'g-squad-thumb' }, buildingThumb(id, lvl, 76));
      const info = h(
        'div',
        { class: 'g-squad-info' },
        h('div', { class: 'g-squad-name' }, t('b_' + id), h('span', { class: 'g-squad-lvl' }, t('lv', { n: lvl }))),
        h('div', { class: 'g-squad-desc' }, t('d_' + id)),
        h('div', { class: 'g-squad-eff' }, effectText(id, lvl)),
      );
      if (id === 'goldmine' || id === 'factory') {
        const kind = id === 'goldmine' ? 'gold' : 'mat';
        const p = prodInfo(kind);
        info.append(
          h(
            'div',
            { class: 'g-squad-stock' },
            h('div', { class: 'g-squad-bar' }, h('i', { style: { width: `${(100 * p.amt) / p.cap}%` } })),
            h('span', null, t('stock', { a: num(p.amt), b: num(p.cap) })),
            p.amt >= 1
              ? h(
                  'button',
                  {
                    class: 'g-squad-mini',
                    onclick: (e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      const rr = root.getBoundingClientRect();
                      collect(kind, r.left - rr.left + r.width / 2, r.top - rr.top);
                    },
                  },
                  icon(kind),
                  '+' + D.fmt(p.amt),
                )
              : null,
          ),
        );
      }
      let act;
      if (lvl >= max) {
        act = h('div', { class: 'g-squad-need' }, icon('lock'), t('needHq', { n: lvl - 1 }));
      } else {
        const btn = goldBtn(t('upgrade'), () => {
          if (!canAfford(cost)) return refuse(card);
          pay(cost);
          save.bld[id]++;
          mission('upgrade', 1);
          persist();
          sfx.play('levelup');
          sfx.vibrate(30);
          ctx.ui.toast(t('upgraded', { name: t('b_' + id), n: save.bld[id] }));
          if (base) {
            base.view.rebuild(save);
            base.view.celebrate(id);
            base.info = null;
          }
          refreshRes();
          renderSheet();
        }, canAfford(cost) ? '' : 'dim');
        act = h('div', { class: 'g-squad-act' }, costChips(cost), btn);
      }
      const card = h('div', { class: 'g-squad-card', 'data-id': id }, thumb, h('div', { class: 'g-squad-col' }, info, act));
      list.append(card);
    }
    body.append(list);
  }

  // ----------------------------------------------------------- army
  function renderArmy(body) {
    const s = D.playerStats(save);
    body.append(
      h(
        'div',
        { class: 'g-squad-power' },
        icon('bolt', 'big'),
        h('div', null, h('small', null, t('power')), h('b', null, num(D.powerRating(save)))),
        h(
          'div',
          { class: 'g-squad-statgrid' },
          h('div', null, h('small', null, t('st_start')), h('b', null, s.startN)),
          h('div', null, h('small', null, t('st_dmg')), h('b', null, `+${Math.round((s.dmg - 1) * 100)}%`)),
          h('div', null, h('small', null, t('st_rate')), h('b', null, `+${Math.round((s.rate / 2.6 - 1) * 100)}%`)),
          h('div', null, h('small', null, t('st_hp')), h('b', null, `+${Math.round((s.hp - 1) * 100)}%`)),
        ),
      ),
    );
    // troops
    const tc = D.trainCost(save.train);
    const rank = D.rankOf(save.train);
    const rankUp = (save.train + 1) % 5 === 0;
    const troopCard = h(
      'div',
      { class: 'g-squad-card troop', 'data-id': 'troops' },
      h('div', { class: 'g-squad-thumb rankthumb' }, rankBadge(rank)),
      h(
        'div',
        { class: 'g-squad-col' },
        h(
          'div',
          { class: 'g-squad-info' },
          h('div', { class: 'g-squad-name' }, `${t('troops')} · ${t('rank', { r: rank })}`),
          h('div', { class: 'g-squad-desc' }, t('training', { n: save.train })),
          h('div', { class: 'g-squad-eff' }, t('trainEff', { p: 5 * save.train }) + ` → +${5 * (save.train + 1)}%`),
          h('div', { class: 'g-squad-bar' }, h('i', { style: { width: `${((save.train % 5) / 5) * 100}%` } })),
        ),
        h(
          'div',
          { class: 'g-squad-act' },
          costChips(tc),
          goldBtn(rankUp ? t('promote') : t('train'), () => {
            if (!canAfford(tc)) return refuse(troopCard);
            pay(tc);
            save.train++;
            mission('upgrade', 1);
            persist();
            sfx.play('levelup');
            sfx.vibrate(30);
            if (rankUp) {
              ctx.ui.confetti(60);
              ctx.ui.toast(t('promoted', { r: t('rank', { r: D.rankOf(save.train) }) }));
            }
            refreshRes();
            renderSheet();
          }, canAfford(tc) ? '' : 'dim'),
        ),
      ),
    );
    body.append(troopCard);
    // heroes
    body.append(h('div', { class: 'g-squad-sec' }, t('heroes')));
    for (const hd of D.HEROES) {
      const st = save.heroes[hd.id];
      const hs = D.heroStats(hd.id, st.lvl, save.bld.tower);
      const statLine = [t('cooldown', { s: hs.cd.toFixed(1) })];
      if (hd.id === 'tank') statLine.push(`${hs.dur.toFixed(1)}s`);
      statLine.push(t('abPower', { k: hs.k.toFixed(1) }));
      const isSel = save.hero === hd.id;
      const acts = h('div', { class: 'g-squad-act' });
      const card = h(
        'div',
        { class: `g-squad-hero ${isSel ? 'sel' : ''} ${st.own ? '' : 'locked'}`, 'data-id': hd.id },
        h('div', { class: 'g-squad-hero-art', style: { background: `radial-gradient(circle at 40% 30%, ${hd.c1}, ${hd.c2})` } }, icon(hd.id, 'hero'), st.own ? h('span', { class: 'g-squad-lvl' }, t('lv', { n: st.lvl })) : h('span', { class: 'g-squad-lockb' }, icon('lock'))),
        h(
          'div',
          { class: 'g-squad-col' },
          h('div', { class: 'g-squad-name' }, t('h_' + hd.id), h('small', null, t('br_' + hd.id))),
          h('div', { class: 'g-squad-ab' }, t('ab_' + hd.id)),
          h('div', { class: 'g-squad-desc' }, t('abd_' + hd.id, { s: hs.dur ? hs.dur.toFixed(1) : '' })),
          h('div', { class: 'g-squad-eff' }, statLine.join(' · ')),
          acts,
        ),
      );
      if (!st.own) {
        const c = { gold: hd.gold, gems: hd.gems };
        acts.append(
          costChips(c),
          goldBtn(t('unlock'), () => {
            if (!canAfford(c)) return refuse(card);
            pay(c);
            st.own = true;
            save.hero = hd.id;
            persist();
            sfx.play('win');
            ctx.ui.confetti(80);
            ctx.ui.toast(t('heroUnlocked', { name: t('h_' + hd.id) }));
            if (base) {
              base.view.rebuild(save);
              base.view.celebrate('hero:' + hd.id);
            }
            refreshRes();
            renderSheet();
          }, canAfford(c) ? '' : 'dim'),
        );
      } else {
        const c = D.heroLvlCost(hd.id, st.lvl);
        acts.append(
          h(
            'button',
            {
              class: `g-squad-btn ghost ${isSel ? 'on' : ''}`,
              disabled: isSel,
              onclick: () => {
                save.hero = hd.id;
                persist();
                sfx.play('select');
                renderSheet();
              },
            },
            isSel ? t('selected') : t('select'),
          ),
          costChips(c),
          goldBtn(t('upgrade'), () => {
            if (!canAfford(c)) return refuse(card);
            pay(c);
            st.lvl++;
            mission('upgrade', 1);
            persist();
            sfx.play('levelup');
            sfx.vibrate(30);
            ctx.ui.toast(t('upgraded', { name: t('h_' + hd.id), n: st.lvl }));
            if (base) base.info = null;
            refreshRes();
            renderSheet();
          }, canAfford(c) ? '' : 'dim'),
        );
      }
      body.append(card);
    }
  }

  // ----------------------------------------------------------- missions
  function levelPreview(level, w, hh) {
    const cv = h('canvas', { class: 'g-squad-preview' });
    try {
      const nom = D.nominalStats(level);
      const world = new World({ mode: 'campaign', level, seed: level * 7919 + 13, lo: { ...D.playerStats(save) }, hero: null, pNom: nom.dmg * nom.rate, E0: nom.startN });
      const r = new Renderer(cv, { mode: 'campaign', level, themeIndex: D.themeIndex(level), rank: D.rankOf(save.train), t, preview: true });
      r.resize(w, hh, dpr());
      for (let i = 0; i < 3; i++) world.update(0.016);
      r.frame(world, 0.016);
    } catch (e) {
      console.error(e);
    }
    return cv;
  }
  function renderMissions(body) {
    const L = save.level;
    const th = D.themeFor(L);
    const boss = D.bossFor(L);
    const fresh = D.newEnemyAt(L);
    const w = Math.min(560, (root.clientWidth || 360) - 32);
    const camp = h(
      'div',
      { class: 'g-squad-campaign' },
      levelPreview(L, w, 150),
      h(
        'div',
        { class: 'g-squad-camp-over' },
        h('small', null, `${t('campaign')} · ${t('region', { n: D.regionOf(L) + 1 })}`),
        h('b', null, t('levelUpper', { n: L })),
        h('span', null, t('th_' + th.id)),
      ),
      h(
        'div',
        { class: 'g-squad-camp-foot' },
        h(
          'div',
          { class: 'g-squad-tags' },
          h('span', { class: 'g-squad-tag' }, icon('skull'), D.isMegaLevel(L) ? t('megaBoss') : t('bossOf', { name: t('boss_' + boss.id) })),
          fresh ? h('span', { class: 'g-squad-tag new' }, t('newEnemy')) : null,
        ),
        h('button', { class: 'g-squad-btn big', onclick: () => startRun('campaign', L) }, icon('play'), t('play')),
      ),
    );
    body.append(camp);
    body.append(
      h(
        'div',
        { class: 'g-squad-card survival' },
        h('div', { class: 'g-squad-thumb inf' }, icon('infinity')),
        h(
          'div',
          { class: 'g-squad-col' },
          h('div', { class: 'g-squad-name' }, t('survival')),
          h('div', { class: 'g-squad-desc' }, t('survivalDesc')),
          h('div', { class: 'g-squad-eff' }, t('best', { d: num(save.bestDist) })),
        ),
        h('button', { class: 'g-squad-btn', onclick: () => startRun('endless', 0) }, icon('play'), t('play')),
      ),
    );
    // daily
    const daily = ensureDaily();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    body.append(h('div', { class: 'g-squad-sec' }, t('daily'), h('span', { class: 'g-squad-timer' }, icon('clock'), t('newIn', { t: fmtTime(midnight - new Date()) }))));
    daily.list.forEach((m, i) => {
      const rw = D.missionReward(i, save.level);
      const done = m.prog >= m.goal;
      const rwChips = h('div', { class: 'g-squad-costs reward' });
      for (const k of ['gold', 'mat', 'gems']) if (rw[k]) rwChips.append(h('span', { class: 'g-squad-cost' }, icon(k), D.fmt(rw[k])));
      const row = h(
        'div',
        { class: `g-squad-mission ${m.claimed ? 'claimed' : done ? 'ready' : ''}` },
        h(
          'div',
          { class: 'g-squad-col' },
          h('div', { class: 'g-squad-mtext' }, t('m_' + m.id, { n: num(m.goal) })),
          h('div', { class: 'g-squad-bar' }, h('i', { style: { width: `${Math.min(100, (100 * m.prog) / m.goal)}%` } })),
          h('div', { class: 'g-squad-mfoot' }, h('span', null, `${num(Math.min(m.prog, m.goal))} / ${num(m.goal)}`), rwChips),
        ),
        m.claimed
          ? h('span', { class: 'g-squad-done' }, icon('check'), t('done'))
          : h(
              'button',
              {
                class: `g-squad-btn ${done ? '' : 'dim'}`,
                disabled: !done,
                onclick: (e) => {
                  if (m.claimed || m.prog < m.goal) return;
                  m.claimed = true;
                  for (const k of ['gold', 'mat', 'gems']) save[k] += rw[k] || 0;
                  persist();
                  sfx.play('coin');
                  sfx.vibrate(20);
                  const r = e.currentTarget.getBoundingClientRect();
                  const rr = root.getBoundingClientRect();
                  for (const k of ['gold', 'mat', 'gems']) if (rw[k]) flyResources(k, rw[k], r.left - rr.left + r.width / 2, r.top - rr.top);
                  refreshDots();
                  renderSheet();
                },
              },
              t('claim'),
            ),
      );
      body.append(row);
    });
    body.append(h('button', { class: 'g-squad-btn ghost wide', onclick: showWelcome }, icon('help'), t('howTo')));
  }

  // ----------------------------------------------------------- map
  const mapSprites = new Sprites();
  const regionProps = {
    city: ['tree', 'building', 'car', 'lamp'],
    desert: ['cactus', 'rock', 'wreck', 'skull'],
    snow: ['pine', 'snowrock', 'pine', 'fence'],
    night: ['building_n', 'tree', 'car', 'lamp'],
    toxic: ['deadtree', 'drums', 'pipe', 'hazard'],
  };
  function paintRegion(cv, r, nodes) {
    const th = D.THEMES[r % D.THEMES.length];
    const W = cv.clientWidth || 320;
    const H = cv.clientHeight || 600;
    const k = dpr();
    cv.width = Math.round(W * k);
    cv.height = Math.round(H * k);
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, th.ground);
    gr.addColorStop(1, th.ground2);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const rr = rng(r * 97 + 5);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + rr() * 0.05})`;
      g.beginPath();
      g.ellipse(rr() * W, rr() * H, 20 + rr() * 40, 8 + rr() * 14, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (th.id === 'toxic') {
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(170,240,60,.45)';
        g.beginPath();
        g.ellipse(rr() * W, rr() * H, 30, 10, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // path through nodes
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [lw, col] of [[22, 'rgba(0,0,0,.18)'], [16, th.id === 'snow' ? '#c9d3df' : '#b8925a'], [3, 'rgba(255,255,255,.35)']]) {
      g.strokeStyle = col;
      g.lineWidth = lw;
      if (lw === 3) g.setLineDash([6, 8]);
      g.beginPath();
      nodes.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.setLineDash([]);
    }
    // props
    const kinds = regionProps[th.id];
    const items = [];
    for (let i = 0; i < 26; i++) {
      const x = rr() * W;
      const y = 30 + rr() * (H - 30);
      if (nodes.some((p) => Math.hypot(p.x - x, p.y - y) < 46)) continue;
      items.push({ x, y, kind: kinds[Math.floor(rr() * kinds.length)] });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      const sp = mapSprites.prop(it.kind, th.id, 0);
      if (sp) drawSpr(g, sp, it.x, it.y, it.kind.startsWith('building') ? 0.32 : 0.55);
    }
    if (th.dark > 0.3) {
      g.fillStyle = 'rgba(5,8,25,.35)';
      g.fillRect(0, 0, W, H);
    }
    const vg = g.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(10,10,12,.55)');
    vg.addColorStop(0.12, 'rgba(10,10,12,0)');
    vg.addColorStop(0.9, 'rgba(10,10,12,0)');
    vg.addColorStop(1, 'rgba(10,10,12,.5)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }
  function renderMap(body) {
    const maxR = D.regionOf(save.level) + 1;
    const W = Math.min(560, (root.clientWidth || 360) - 28);
    const NODE_H = 66;
    const H = D.LEVELS_PER_REGION * NODE_H + 40;
    const toPaint = new Map();
    let current = null;
    for (let r = 0; r <= maxR; r++) {
      const th = D.THEMES[r % D.THEMES.length];
      const cyc = Math.floor(r / D.THEMES.length);
      let starsGot = 0;
      for (let i = 1; i <= D.LEVELS_PER_REGION; i++) starsGot += save.stars[r * D.LEVELS_PER_REGION + i] || 0;
      const locked = r * D.LEVELS_PER_REGION + 1 > save.level;
      const cv = h('canvas', { class: 'g-squad-regioncv', style: { height: H + 'px' } });
      const nodes = [];
      const wrap = h('div', { class: `g-squad-region ${locked ? 'locked' : ''}`, style: { height: H + 'px' } }, cv);
      for (let i = 0; i < D.LEVELS_PER_REGION; i++) {
        const lvl = r * D.LEVELS_PER_REGION + i + 1;
        const x = W / 2 + Math.sin(i * 1.15 + r) * W * 0.3;
        const y = 34 + i * NODE_H;
        nodes.push({ x, y });
        const st = save.stars[lvl] || 0;
        const isBoss = D.isMegaLevel(lvl);
        const state = lvl < save.level ? 'done' : lvl === save.level ? 'current' : 'locked';
        const btn = h(
          'button',
          {
            class: `g-squad-node ${state} ${isBoss ? 'boss' : ''}`,
            style: { left: x + 'px', top: y + 'px' },
            'aria-label': t('level', { n: lvl }),
            onclick: () => {
              if (lvl > save.level) {
                sfx.play('error');
                ctx.ui.toast(t('lockedLevel', { n: save.level }));
                return;
              }
              startRun('campaign', lvl);
            },
          },
          state === 'locked' ? icon('lock') : isBoss ? icon('skull') : h('b', null, lvl),
          state !== 'locked' && (st || state === 'done')
            ? h('span', { class: 'g-squad-nstars' }, [0, 1, 2].map((k) => icon(k < st ? 'star' : 'starOff')))
            : null,
        );
        if (state === 'current') current = btn;
        wrap.append(btn);
      }
      const head = h(
        'div',
        { class: 'g-squad-region-head' },
        h('div', null, h('small', null, t('region', { n: r + 1 })), h('b', null, t('th_' + th.id) + (cyc ? ' ' + D.roman(cyc + 1) : ''))),
        h('span', { class: 'g-squad-rstars' }, icon('star'), `${starsGot}/${D.LEVELS_PER_REGION * 3}`),
      );
      body.append(head, wrap);
      toPaint.set(cv, { r, nodes });
    }
    const paint = (cv) => {
      const d = toPaint.get(cv);
      if (!d || d.done) return;
      d.done = true;
      paintRegion(cv, d.r, d.nodes);
    };
    if (window.IntersectionObserver) {
      mapObserver = new IntersectionObserver((entries) => entries.forEach((en) => en.isIntersecting && paint(en.target)), { root: body, rootMargin: '300px' });
      for (const cv of toPaint.keys()) mapObserver.observe(cv);
    } else for (const cv of toPaint.keys()) paint(cv);
    if (current) later(() => current.scrollIntoView({ block: 'center' }), 60);
  }

  // ----------------------------------------------------------- modals
  async function openSupply() {
    sfx.play('tap');
    const bodyEl = h('div', { class: 'g-squad-supply' });
    let tick = 0;
    const render = () => {
      clear(bodyEl);
      const hq = save.bld.hq;
      const ready = now() - save.supplyT >= D.SUPPLY_EVERY;
      const free = { gold: 120 + 50 * hq, mat: 60 + 30 * hq, gems: 2 };
      const chips = h('div', { class: 'g-squad-costs reward' });
      for (const k of ['gold', 'mat', 'gems']) chips.append(h('span', { class: 'g-squad-cost' }, icon(k), D.fmt(free[k])));
      bodyEl.append(
        h(
          'div',
          { class: 'g-squad-supply-box' },
          icon('chest', 'chest'),
          h('b', null, t('freeCrate')),
          chips,
          ready
            ? goldBtn(t('open'), (e) => {
                save.supplyT = now();
                for (const k of ['gold', 'mat', 'gems']) save[k] += free[k];
                persist();
                sfx.play('win');
                ctx.ui.confetti(50);
                const r = e.currentTarget.getBoundingClientRect();
                const rr = root.getBoundingClientRect();
                for (const k of ['gold', 'mat', 'gems']) flyResources(k, free[k], r.left - rr.left + r.width / 2, r.top - rr.top);
                render();
              })
            : h('div', { class: 'g-squad-timer' }, icon('clock'), t('nextIn', { t: fmtTime(D.SUPPLY_EVERY - (now() - save.supplyT)) })),
        ),
        h('div', { class: 'g-squad-sec' }, t('exchange')),
      );
      const offers = [
        { give: 10, get: 'gold', amt: 250 + 150 * hq },
        { give: 10, get: 'mat', amt: 150 + 90 * hq },
      ];
      for (const o of offers) {
        bodyEl.append(
          h(
            'button',
            {
              class: `g-squad-trade ${save.gems < o.give ? 'dim' : ''}`,
              onclick: (e) => {
                if (save.gems < o.give) return refuse(e.currentTarget);
                save.gems -= o.give;
                save[o.get] += o.amt;
                persist();
                sfx.play('coin');
                refreshRes();
                render();
              },
            },
            h('span', { class: 'g-squad-cost' }, icon('gems'), o.give),
            h('span', { class: 'g-squad-arrow' }, '→'),
            h('span', { class: 'g-squad-cost' }, icon(o.get), D.fmt(o.amt)),
          ),
        );
      }
    };
    render();
    const iv = setInterval(() => {
      tick++;
      if (alive) render();
    }, 1000);
    await ctx.ui.modal({ title: t('supplyTitle'), body: bodyEl, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
    clearInterval(iv);
    if (alive) refreshRes();
  }

  async function showWelcome() {
    if (!alive) return;
    const rows = [
      ['soldier', 'help1'],
      ['target', 'help2'],
      ['chest', 'help3'],
      ['skull', 'help4'],
      ['tabBuild', 'help5'],
    ];
    const bodyEl = h('div', { class: 'g-squad-help' }, rows.map(([ic, k]) => h('div', { class: 'g-squad-help-row' }, icon(ic), h('p', null, t(k)))));
    await ctx.ui.modal({ title: t('welcomeTitle'), body: bodyEl, actions: [{ label: t('letsGo'), value: true, primary: true }] });
    if (!alive) return;
    if (!save.helpShown) {
      save.helpShown = true;
      persist();
      if (base && !sheet) base.tabs.btns.missions.classList.add('pulse');
    }
  }

  // =========================================================== RUN
  const HERO_TIP = { tank: 'ab_tank', jet: 'ab_jet', missile: 'ab_missile' };
  function spriteThumb(draw, size = 72) {
    const cv = h('canvas', { class: 'g-squad-sprthumb' });
    const k = dpr();
    cv.width = cv.height = Math.round(size * k);
    cv.style.width = cv.style.height = size + 'px';
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    draw(g, size);
    return cv;
  }

  function startRun(mode, level) {
    teardownBase();
    teardownRun();
    screen = 'run';
    clear(app);
    const lo = D.playerStats(save);
    const heroId = save.hero;
    const hero = { id: heroId, lvl: save.heroes[heroId].lvl, tower: save.bld.tower };
    let pNom;
    let E0;
    let seed;
    if (mode === 'campaign') {
      const nom = D.nominalStats(level);
      pNom = nom.dmg * nom.rate;
      E0 = nom.startN;
      seed = level * 7919 + 13;
    } else {
      pNom = lo.dmg * lo.rate;
      E0 = lo.startN;
      seed = (Date.now() % 1000000007) | 0;
    }
    const world = new World({ mode, level: mode === 'campaign' ? level : 1, seed, lo, hero, pNom, E0, killCoin: D.killCoin(mode === 'campaign' ? level : save.level) });
    const cv = h('canvas', { class: 'g-squad-runcv' });
    const renderer = new Renderer(cv, { mode, level, themeIndex: mode === 'campaign' ? D.themeIndex(level) : 0, rank: lo.rank, t });

    // HUD
    const pauseBtn = h('button', { class: 'g-squad-round', 'aria-label': t('pause'), onclick: () => pauseRun() }, icon('pause'));
    const lvlPill = h('div', { class: 'g-squad-hudpill' });
    const progI = h('i');
    const prog = h('div', { class: 'g-squad-prog' }, progI, h('span', { class: 'g-squad-prog-end' }, icon('skull')));
    const coinVal = h('b', null, '0');
    const coinPill = h('div', { class: 'g-squad-hudpill coin' }, icon('gold'), coinVal);
    const bossName = h('span');
    const bossI = h('i');
    const bossBar = h('div', { class: 'g-squad-bossbar' }, h('div', { class: 'g-squad-bossname' }, icon('skull'), bossName), h('div', { class: 'g-squad-bosshp' }, bossI));
    const buffs = h('div', { class: 'g-squad-buffs' });
    const hint = h('div', { class: 'g-squad-hint' });
    const abBtn = h(
      'button',
      { class: 'g-squad-ability', 'aria-label': t(HERO_TIP[heroId]), onclick: (e) => {
        e.stopPropagation();
        useAbility();
      } },
      h('span', { class: 'g-squad-ab-ring' }),
      icon(heroId, 'hero'),
      h('span', { class: 'g-squad-ab-lbl' }, t('ready')),
    );
    const top = h('div', { class: 'g-squad-hudtop' }, pauseBtn, lvlPill, mode === 'campaign' ? prog : h('div', { class: 'g-squad-distbox' }), coinPill);
    const distBox = mode === 'endless' ? top.children[2] : null;
    if (mode === 'campaign') lvlPill.append(h('b', null, t('levelUpper', { n: level })));
    else lvlPill.append(icon('infinity'), h('b', null, t('survival')));

    // start overlay
    const th = mode === 'campaign' ? D.themeFor(level) : D.THEMES[0];
    const startCard = h('div', { class: 'g-squad-startcard' }, h('small', null, mode === 'campaign' ? `${t('region', { n: D.regionOf(level) + 1 })} · ${t('th_' + th.id)}` : t('best', { d: num(save.bestDist) })), h('b', null, mode === 'campaign' ? t('levelUpper', { n: level }) : t('survival')));
    const sprites = renderer.spr;
    if (mode === 'campaign') {
      const fresh = D.newEnemyAt(level);
      const bossDef = D.bossFor(level);
      if (fresh) {
        startCard.append(
          h(
            'div',
            { class: 'g-squad-intro' },
            spriteThumb((g, s) => {
              const sp = sprites.zombie(fresh, 0, 1, false);
              drawSpr(g, sp, s / 2, s - 6, (s - 12) / Math.max(sp.h, sp.w));
            }, 64),
            h('div', null, h('small', null, t('newEnemy')), h('b', null, t('z_' + fresh)), h('span', null, t('zd_' + fresh))),
          ),
        );
      } else if (bossDef.from === level && level > 1) {
        startCard.append(
          h(
            'div',
            { class: 'g-squad-intro' },
            spriteThumb((g, s) => {
              const sp = sprites.boss(bossDef.id, 0, false);
              drawSpr(g, sp, s / 2, s - 4, (s - 8) / Math.max(sp.h, sp.w));
            }, 64),
            h('div', null, h('small', null, t('newBoss')), h('b', null, t('boss_' + bossDef.id))),
          ),
        );
      }
    }
    const startOv = h(
      'div',
      { class: 'g-squad-start' },
      startCard,
      h('div', { class: 'g-squad-hand' }, h('i'), h('span', null, t('tapToStart'))),
    );
    const el = h('div', { class: 'g-squad-run' }, cv, h('div', { class: 'g-squad-vign' }), top, bossBar, buffs, hint, abBtn, startOv);
    app.append(el);

    run = {
      mode, level, world, renderer, cv, el, startOv, hint, abBtn, bossBar, bossI, bossName, buffs, coinVal, progI, distBox,
      paused: false, ended: false, resultShown: false, sfxT: {}, lastCoins: -1, lastBuff: '', hintQ: [], hintT: 0, drag: null, keys: {}, abilityHinted: false,
      q: { ema: 1 / 60, n: 0, dpr: dpr() },
    };
    resizeRun();
    renderer.frame(world, 0);

    el.addEventListener('pointerdown', onRunDown);
    el.addEventListener('pointermove', onRunMove);
    el.addEventListener('pointerup', onRunUp);
    el.addEventListener('pointercancel', onRunUp);
  }

  function teardownRun() {
    if (!run) return;
    const el = run.el;
    el.removeEventListener('pointerdown', onRunDown);
    el.removeEventListener('pointermove', onRunMove);
    el.removeEventListener('pointerup', onRunUp);
    el.removeEventListener('pointercancel', onRunUp);
    run = null;
  }

  function resizeRun() {
    const w = root.clientWidth || 360;
    const hh = root.clientHeight || 640;
    run.renderer.resize(w, hh, Math.min(dpr(), run.q.dpr));
  }

  function onRunDown(e) {
    if (!run || run.paused || run.resultShown) return;
    if (e.target.closest && e.target.closest('button')) return;
    const w = run.world;
    if (w.state === 'ready') {
      w.start();
      sfx.play('whoosh');
    }
    run.drag = { id: e.pointerId, x0: e.clientX, tx0: w.sq.tx };
    run.el.setPointerCapture?.(e.pointerId);
  }
  function onRunMove(e) {
    if (!run || !run.drag || run.drag.id !== e.pointerId || run.paused) return;
    const dx = e.clientX - run.drag.x0;
    run.world.steer(run.drag.tx0 + (dx / run.renderer.s0) * 1.3);
  }
  function onRunUp(e) {
    if (run && run.drag && run.drag.id === e.pointerId) run.drag = null;
  }
  const onKey = (e) => {
    if (!run || run.resultShown) return;
    const down = e.type === 'keydown';
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') run.keys.l = down;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') run.keys.r = down;
    else if (down && (k === ' ' || k === 'Enter')) {
      if (run.world.state === 'ready') onRunDown({ target: run.el, pointerId: -1, clientX: 0 });
      else useAbility();
      e.preventDefault();
      return;
    } else if (down && (k === 'Escape' || k === 'p' || k === 'P')) {
      pauseRun();
      return;
    } else return;
    if (down && run.world.state === 'ready') onRunDown({ target: run.el, pointerId: -1, clientX: 0 });
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  function useAbility() {
    if (!run || run.paused) return;
    const w = run.world;
    if (w.state === 'ready') return;
    if (w.useAbility()) {
      sfx.vibrate(40);
      run.abBtn.classList.remove('fire');
      void run.abBtn.offsetWidth;
      run.abBtn.classList.add('fire');
      run.abBtn.classList.remove('nudge');
    } else sfx.play('error');
  }

  function showHint(key) {
    if (!run || save.seen['h_' + key]) return;
    save.seen['h_' + key] = 1;
    persist();
    run.hintQ.push(t('hint_' + key));
  }

  async function pauseRun() {
    if (!run || run.paused || run.resultShown) return;
    if (run.world.state === 'won' || run.world.state === 'lost') return;
    run.paused = true;
    run.drag = null;
    run.keys = {};
    sfx.play('tap');
    const r = run;
    const v = await ctx.ui.modal({
      title: t('pause'),
      body: null,
      actions: [
        { label: t('resume'), value: 'resume', primary: true },
        { label: r.mode === 'endless' ? t('quitSurvival') : t('quit'), value: 'quit', danger: true },
      ],
    });
    if (!alive || run !== r) return;
    if (v === 'quit') {
      if (r.mode === 'endless' && r.world.state !== 'ready') {
        r.world.state = 'lost';
        r.world.endT = r.world.t;
        r.paused = false;
        finishRun();
      } else showBase();
      return;
    }
    r.paused = false;
    lastT = 0;
  }
  const onVis = () => {
    if (document.hidden && run && !run.paused && run.world.live) pauseRun();
  };
  document.addEventListener('visibilitychange', onVis);

  function rl(key, ms) {
    const n = performance.now();
    if (n - (run.sfxT[key] || 0) < ms) return false;
    run.sfxT[key] = n;
    return true;
  }
  function handleEvents(events) {
    const w = run.world;
    for (const e of events) {
      switch (e.t) {
        case 'start':
          if (run.startOv.isConnected && !run.startOv.classList.contains('gone')) {
            run.startOv.classList.add('gone');
            const ov = run.startOv;
            later(() => ov.remove(), 400);
          }
          break;
        case 'shoot':
          if (rl('shoot', 150)) sfx.play('shoot');
          break;
        case 'kill':
          if (rl('hit', 70)) sfx.play('hit');
          break;
        case 'boom':
          if (rl('boom', 110)) {
            sfx.play('explosion');
            sfx.vibrate(25);
          }
          break;
        case 'gate':
          if (e.good) {
            sfx.play('success');
            sfx.vibrate(20);
          } else {
            sfx.play('error');
            sfx.vibrate([30, 30, 30]);
          }
          break;
        case 'crate':
          sfx.play('levelup');
          sfx.vibrate(30);
          break;
        case 'lost':
          if (rl('lost', 120)) {
            sfx.vibrate(12);
            if (rl('lostS', 200)) sfx.tone({ freq: 200, to: 90, dur: 0.12, type: 'sawtooth', vol: 0.12 });
          }
          break;
        case 'stomp':
          sfx.play('kick');
          sfx.vibrate(60);
          break;
        case 'bossStart':
          sfx.tone({ freq: 110, to: 55, dur: 0.7, type: 'sawtooth', vol: 0.3 });
          sfx.tone({ freq: 160, to: 70, dur: 0.6, type: 'square', vol: 0.12, delay: 0.1 });
          break;
        case 'bossDie':
          sfx.play('explosion');
          sfx.play('coin');
          sfx.vibrate([50, 30, 90]);
          break;
        case 'ability':
          if (e.id === 'tank') {
            sfx.play('select');
            sfx.tone({ freq: 300, to: 900, dur: 0.3, type: 'triangle', vol: 0.3 });
          } else sfx.play('whoosh');
          break;
        case 'win':
          sfx.play('win');
          ctx.ui.confetti(90);
          break;
        case 'lose':
          sfx.play('lose');
          sfx.vibrate([80, 50, 120]);
          break;
        case 'see': {
          const map = { gate: 'gate', shootGate: 'shootGate', crate: 'crate', barrel: 'barrel', wall: 'wall', brute: 'brute', giant: 'brute', boss: 'boss' };
          if (map[e.what]) showHint(map[e.what]);
          break;
        }
        default:
          break;
      }
    }
    if (!run.abilityHinted && w.hero && w.t > 6 && w.live && w.hero.cd <= 0) {
      run.abilityHinted = true;
      if (!save.seen.h_ability) {
        showHint('ability');
        run.abBtn.classList.add('nudge');
      }
    }
  }

  function updateHud(dt) {
    const w = run.world;
    if (run.mode === 'campaign') run.progI.style.width = `${Math.min(100, (100 * w.sq.z) / w.length)}%`;
    else if (run.distBox) {
      const d = Math.floor(w.sq.z / 10);
      if (d !== run.lastDist) {
        run.lastDist = d;
        run.distBox.textContent = `${num(d)} m`;
        run.distBox.classList.toggle('record', d > save.bestDist && save.bestDist > 0);
      }
    }
    if (w.coins !== run.lastCoins) {
      run.lastCoins = w.coins;
      run.coinVal.textContent = D.fmt(w.coins);
    }
    const b = w.boss;
    const showBoss = b && b.alive && (w.state === 'boss' || b.z - w.sq.z < 1300);
    run.bossBar.classList.toggle('on', !!showBoss);
    run.el.classList.toggle('bossing', !!showBoss);
    if (showBoss) {
      run.bossI.style.width = `${(100 * b.hp) / b.max}%`;
      const nm = b.spec.mega ? t('megaBoss') : t('boss_' + b.spec.id);
      if (run.bossName.textContent !== nm) run.bossName.textContent = nm;
    }
    const hero = w.hero;
    if (hero) {
      const p = hero.cd > 0 ? hero.cd / hero.st.cd : 0;
      run.abBtn.style.setProperty('--p', String(p));
      run.abBtn.classList.toggle('ready', p === 0 && w.live);
      run.abBtn.classList.toggle('shield', w.shieldT > 0);
    }
    const bk = `${w.buff.rate.toFixed(2)}|${w.buff.dmg.toFixed(2)}`;
    if (bk !== run.lastBuff) {
      run.lastBuff = bk;
      clear(run.buffs);
      if (w.buff.rate > 1.001) run.buffs.append(h('span', { class: 'g-squad-buff pop-in' }, icon('bolt'), `+${Math.round((w.buff.rate - 1) * 100)}%`));
      if (w.buff.dmg > 1.001) run.buffs.append(h('span', { class: 'g-squad-buff pop-in' }, icon('target'), `+${Math.round((w.buff.dmg - 1) * 100)}%`));
    }
    // hints
    if (run.hintT > 0) {
      run.hintT -= dt;
      if (run.hintT <= 0) run.hint.classList.remove('on');
    } else if (run.hintQ.length) {
      run.hint.textContent = run.hintQ.shift();
      run.hint.classList.add('on');
      run.hintT = 3;
    }
  }

  function frameRun(dt) {
    const w = run.world;
    // adaptive resolution: keep the frame rate smooth on slower devices
    const q = run.q;
    if (!run.paused && dt > 0) {
      q.ema = q.ema * 0.95 + dt * 0.05;
      if (++q.n > 90 && q.ema > 0.0215 && q.dpr > 1.25) {
        q.dpr = Math.max(1.25, Math.min(dpr(), q.dpr) - 0.25);
        q.n = 0;
        q.ema = 1 / 60;
        resizeRun();
      }
    }
    if (!run.paused) {
      if (run.keys.l || run.keys.r) w.steer(w.sq.tx + (run.keys.r ? 1 : -1) * 460 * dt);
      const steps = Math.max(1, Math.min(3, Math.ceil(dt / (1 / 60) - 0.01)));
      for (let i = 0; i < steps; i++) w.update(dt / steps);
    }
    run.renderer.handle(w.events, w);
    handleEvents(w.events);
    w.events.length = 0;
    run.renderer.frame(w, run.paused ? 0 : dt);
    updateHud(dt);
    if (!run.ended && (w.state === 'won' || w.state === 'lost') && w.t - w.endT > 1.8) finishRun();
  }

  function finishRun() {
    if (!run || run.ended) return;
    run.ended = true;
    const r = run;
    const w = r.world;
    const won = w.state === 'won';
    const L = r.level;
    let stars = 0;
    let gold = 0;
    let mat = 0;
    let gems = 0;
    let xp = 0;
    let record = false;
    const dist = Math.floor(w.sq.z / 10);
    save.stats.runs++;
    save.stats.kills += w.kills;
    save.stats.gates += w.gatesGood;
    save.stats.bosses += w.bossKills;
    mission('kills', w.kills);
    mission('gates', w.gatesGood);
    mission('ability', w.abilityUses);
    mission('bosses', w.bossKills);
    mission('crates', w.crates);
    if (r.mode === 'campaign') {
      if (won) {
        const ratio = w.sq.n / Math.max(1, w.sq.peak);
        stars = ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
        const rw = D.levelReward(L);
        gold = Math.round(rw.gold * D.STAR_MUL[stars]) + w.coins;
        mat = Math.round(rw.mat * D.STAR_MUL[stars]);
        const prev = save.stars[L] || 0;
        if (!prev && D.isMegaLevel(L)) gems += 20;
        if (stars === 3 && prev < 3) gems += 3;
        save.stars[L] = Math.max(prev, stars);
        save.level = Math.max(save.level, L + 1);
        save.stats.wins++;
        mission('wins', 1);
        xp = 15 + Math.min(15, Math.floor(L / 3)) + stars * 2;
      } else {
        gold = w.coins;
        xp = 6;
      }
    } else {
      gold = w.coins + Math.round(dist * 0.4);
      mat = Math.round(dist * 0.15);
      if (dist > save.bestDist) {
        record = save.bestDist > 0 || dist >= 100;
        if (save.bestDist > 0 && dist >= 200) gems += 5;
        save.bestDist = dist;
      }
      mission('dist', dist, true);
      xp = 8 + Math.min(22, Math.floor(dist / 100));
    }
    save.gold += gold;
    save.mat += mat;
    save.gems += gems;
    persist();
    ctx.addXP?.(xp);
    showResults({ won, stars, gold, mat, gems, dist, record });
  }

  function showResults(res) {
    const r = run;
    const w = r.world;
    r.resultShown = true;
    const camp = r.mode === 'campaign';
    const title = camp ? (res.won ? t('victory') : t('defeat')) : t('runOver');
    const starsEl = h('div', { class: 'g-squad-rstarsbig' });
    if (camp && res.won) {
      for (let i = 0; i < 3; i++) {
        const s = icon(i < res.stars ? 'star' : 'starOff', 'bigstar');
        s.style.animationDelay = `${0.25 + i * 0.28}s`;
        starsEl.append(s);
        if (i < res.stars) later(() => sfx.play('pop'), 250 + i * 280);
      }
    }
    const rows = h('div', { class: 'g-squad-rrows' });
    if (camp) rows.append(h('div', null, h('span', null, t('survivors')), h('b', null, `${num(w.sq.n)} / ${num(w.sq.peak)}`)));
    else rows.append(h('div', null, h('span', null, t('distLbl')), h('b', null, `${num(res.dist)} m`)));
    rows.append(h('div', null, h('span', null, t('killsLbl')), h('b', null, num(w.kills))));
    const rewards = h('div', { class: 'g-squad-rewards' });
    const counters = [];
    for (const k of ['gold', 'mat', 'gems']) {
      if (!res[k]) continue;
      const v = h('b', null, '0');
      rewards.append(h('div', { class: 'g-squad-rew' }, icon(k), v));
      counters.push([v, res[k]]);
    }
    const btns = h('div', { class: 'g-squad-rbtns' });
    if (camp) {
      if (res.won) btns.append(h('button', { class: 'g-squad-btn big', onclick: () => startRun('campaign', r.level + 1) }, icon('play'), t('next')));
      else btns.append(h('button', { class: 'g-squad-btn big', onclick: () => startRun('campaign', r.level) }, t('retry')));
    } else btns.append(h('button', { class: 'g-squad-btn big', onclick: () => startRun('endless', 0) }, t('again')));
    btns.append(h('button', { class: 'g-squad-btn ghost', onclick: () => showBase(camp && !res.won ? 'build' : null) }, t('toBase')));
    const card = h(
      'div',
      { class: `g-squad-rcard ${camp && res.won ? 'win' : 'lose'}` },
      h('h2', { class: 'g-squad-rtitle' }, title),
      camp ? h('small', { class: 'g-squad-rsub' }, t('levelUpper', { n: r.level })) : null,
      starsEl,
      res.record ? h('div', { class: 'g-squad-record' }, t('newRecord')) : null,
      rows,
      counters.length ? h('div', { class: 'g-squad-sec' }, t('rewards')) : null,
      rewards,
      camp && !res.won ? h('p', { class: 'g-squad-tip' }, t('upgradeTip')) : null,
      btns,
    );
    const ov = h('div', { class: 'g-squad-result' }, card);
    r.el.append(ov);
    if (res.record) later(() => ctx.ui.confetti(70), 500);
    // count-up
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      later(() => {
        for (const [v, target] of counters) v.textContent = D.fmt(Math.round((target * i) / steps));
        if (i % 4 === 0 && counters.length) sfx.play('coin');
      }, 700 + i * 40);
    }
  }

  // =========================================================== back / start
  ctx.onBack(() => {
    if (screen === 'run' && run) {
      if (run.resultShown) {
        showBase();
        return true;
      }
      pauseRun();
      return true;
    }
    if (sheet) {
      closeSheet();
      return true;
    }
    return false;
  });

  if (ctx.mode === 'campaign') startRun('campaign', save.level);
  else if (ctx.mode === 'survival') startRun('endless', 0);
  else showBase();

  // debug hook for automated tests (?squaddebug)
  if (/squaddebug/.test(location.search)) {
    window.__squad = {
      get world() {
        return run && run.world;
      },
      get renderer() {
        return run && run.renderer;
      },
      get save() {
        return save;
      },
      setSave(s) {
        save = D.migrateSave(s);
        persist();
      },
      startRun,
      showBase,
      openSheet,
    };
  }

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    for (const id of timeouts) clearTimeout(id);
    timeouts.clear();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onVis);
    if (ro) ro.disconnect();
    if (mapObserver) mapObserver.disconnect();
    teardownRun();
    if (base) base.view.destroy();
    base = null;
    if (window.__squad) delete window.__squad;
  };
}
