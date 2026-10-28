// Bus Jam — get the vehicles out of the parking lot in the right order and
// take every passenger to the vehicle of their color. Endless generated levels.
//
// Modes (ctx.mode): undefined → straight into the current level,
// 'levels' → level map, 'daily' → today's daily challenge.

import STRINGS from './strings.js';
import { generateLevel, dailyLevel, todayKey, levelKind, rewardFor, xpFor, MECHANICS, PALETTE, TYPES } from './logic.js';
import { Game } from './game.js';
import * as art from './art.js';

const PRICES = { undo: 60, shuffle: 90, heli: 120, slot: 150 };
const DEFAULT_BOOSTERS = { undo: 3, shuffle: 2, heli: 1, slot: 1 };
const DAILY = [
  { coins: 50 },
  { coins: 80 },
  { coins: 120 },
  { boost: 'shuffle', n: 2 },
  { coins: 200 },
  { boost: 'heli', n: 1 },
  { coins: 350, boost: 'undo', n: 2 },
];

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h, clear, toast, modal } = ctx.ui;
  // Sounds and vibration only after the first user gesture (browsers block them before).
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const sfx = {
    play: (n) => active() && ctx.sfx.play(n),
    tone: (o) => active() && ctx.sfx.tone(o),
    noise: (o) => active() && ctx.sfx.noise(o),
    vibrate: (p) => active() && ctx.sfx.vibrate(p),
  };
  const store = ctx.store;
  await ctx.loadCSS(new URL('./style.css', import.meta.url));

  // ---------------------------------------------------------- save data
  const S = {
    level: Math.max(1, store.get('level', 1) | 0),
    coins: Math.max(0, store.get('coins', 200) | 0),
    boosters: { ...DEFAULT_BOOSTERS, ...(store.get('boosters', null) || {}) },
    tutorialDone: !!store.get('tutorial', false),
    seen: store.get('seen', {}) || {},
    daily: store.get('daily', { last: null, streak: 0 }) || { last: null, streak: 0 },
    challenge: store.get('challenge', null),
    stars: store.get('stars', {}) || {},
  };
  const save = () => {
    store.set('level', S.level);
    store.set('coins', S.coins);
    store.set('boosters', S.boosters);
    store.set('tutorial', S.tutorialDone);
    store.set('seen', S.seen);
    store.set('daily', S.daily);
    store.set('challenge', S.challenge);
    store.set('stars', S.stars);
  };

  const app = h('div', { class: 'g-busjam-app' });
  root.append(app);
  let game = null;
  let session = null;
  let view = null;
  let dead = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const rafs = new Set();

  const icon = (name, cls = '') => h('span', { class: `g-busjam-ico ${cls}`, html: art.ICONS[name] });
  const coinIco = () => icon('coin', 'coin');

  function destroyGame() {
    if (game) game.destroy();
    game = null;
    session = null;
  }

  // ---------------------------------------------------------- overlays
  function overlay(cls, ...children) {
    const panel = h('div', { class: `g-busjam-panel ${cls}` }, ...children);
    const ov = h('div', { class: 'g-busjam-overlay' }, panel);
    app.append(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    return {
      ov,
      panel,
      close() {
        ov.classList.remove('show');
        ov.classList.add('hide');
        setTimeout(() => ov.remove(), 220);
      },
    };
  }

  // Animated number (coin counters).
  function countUp(el, from, to, ms = 900, onTick) {
    const t0 = performance.now();
    let lastShown = from;
    const step = (now) => {
      if (dead) return;
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(from + (to - from) * e);
      el.textContent = v.toLocaleString(ctx.lang === 'en' ? 'en-US' : ctx.lang === 'es' ? 'es-ES' : 'pt-BR');
      if (v !== lastShown && onTick) onTick(v);
      lastShown = v;
      if (k < 1) {
        const id = requestAnimationFrame(step);
        rafs.add(id);
      }
    };
    const id = requestAnimationFrame(step);
    rafs.add(id);
  }

  function banner(kind, title, sub) {
    if (!session) return;
    const el = h(
      'div',
      { class: `g-busjam-banner ${kind}` },
      kind === 'hard' ? icon('flame') : kind === 'super' ? icon('skull') : kind === 'daily' ? icon('calendar') : icon('crown'),
      h('div', { class: 'g-busjam-banner-text' }, h('b', null, title), sub ? h('small', null, sub) : null),
    );
    session.stage.append(el);
    later(() => el.remove(), 2600);
  }

  // ---------------------------------------------------------- vehicle preview canvas
  function previewCanvas(w, hgt, draw) {
    const c = h('canvas', { class: 'g-busjam-preview' });
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(hgt * dpr);
    c.style.width = w + 'px';
    c.style.height = hgt + 'px';
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    draw(g, dpr);
    return c;
  }

  function drawRoad(g, w, hgt) {
    const gr = g.createLinearGradient(0, 0, 0, hgt);
    gr.addColorStop(0, '#8ccf63');
    gr.addColorStop(1, '#6db94c');
    g.fillStyle = gr;
    art.rrect(g, 0, 0, w, hgt, 16);
    g.fill();
    g.fillStyle = '#b3bac6';
    g.fillRect(0, hgt * 0.3, w, hgt * 0.46);
    g.fillStyle = '#eef1f5';
    g.fillRect(0, hgt * 0.3, w, 3);
    g.fillRect(0, hgt * 0.76 - 3, w, 3);
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 2;
    g.setLineDash([12, 10]);
    g.beginPath();
    g.moveTo(0, hgt * 0.53);
    g.lineTo(w, hgt * 0.53);
    g.stroke();
    g.setLineDash([]);
  }

  function mechanicPreview(id) {
    return previewCanvas(240, 120, (g, dpr) => {
      drawRoad(g, 240, 120);
      const col = PALETTE[(id.length * 3) % PALETTE.length];
      const type = id === 'van' || id === 'bus' || id === 'coach' ? id : id === 'diagonal' ? 'car' : 'van';
      const len = TYPES[type].len;
      const u = Math.min(40, 200 / (len + 0.6));
      const v = { type, seats: TYPES[type].seats };
      const L = len * u * 0.9;
      const W = u * 0.72;
      const ang = id === 'diagonal' ? -Math.PI / 4 : 0;
      const color = id === 'mystery' ? art.MYSTERY : col;
      art.drawVehicle(g, v, 120, 64, ang, L, W, dpr, { color, arrow: true, sprL: L, sprW: W });
      const back = L * (type === 'car' ? -0.31 : -0.37);
      const bx = 120 + Math.cos(ang) * back;
      const by = 64 + Math.sin(ang) * back;
      if (id === 'locked') art.drawLockBadge(g, bx, by, W * 0.3, 3, 0);
      else art.drawBadge(g, bx, by, W * 0.22, color);
    });
  }

  function winArt(def) {
    return previewCanvas(260, 104, (g, dpr) => {
      drawRoad(g, 260, 104);
      const col = PALETTE[def.colors[0]];
      const v = { type: 'bus', seats: 8 };
      art.drawVehicle(g, v, 150, 57, 0, 120, 40, dpr, { color: col, arrow: false, sprL: 120, sprW: 40 });
      art.drawSeats(g, v, 150, 57, 0, 120, 40, col, 8, 0);
      for (let i = 0; i < 3; i++) art.drawPax(g, PALETTE[def.colors[(i + 1) % def.colors.length]], 30 + i * 22, 40 + (i % 2) * 6, 26, dpr, 0, false);
    });
  }

  // ---------------------------------------------------------- boosters
  const BOOST_ICON = { undo: 'undo', shuffle: 'shuffle', heli: 'heli', slot: 'slot' };

  function badgeContent(kind) {
    const n = S.boosters[kind] || 0;
    if (n > 0) return [String(n)];
    return [coinIco(), String(PRICES[kind])];
  }

  function refreshBadges() {
    if (!session) return;
    const set = (el, kind) => {
      clear(el);
      el.append(...badgeContent(kind));
      el.classList.toggle('price', !(S.boosters[kind] > 0));
    };
    set(session.undoBadge, 'undo');
    set(session.boostL.badge, 'shuffle');
    set(session.boostR.badge, 'heli');
    if (game) {
      const n = S.boosters.slot || 0;
      game.slotLabel = n > 0 ? '×' + n : String(PRICES.slot);
      game.slotCoin = !(n > 0);
    }
  }

  async function confirmBuy(kind) {
    const price = PRICES[kind];
    const body = h(
      'div',
      { class: 'g-busjam-buy' },
      h('div', { class: `g-busjam-buy-ico ${kind}` }, icon(BOOST_ICON[kind])),
      h('p', { class: 'modal-text' }, t(kind + 'Desc')),
      h('div', { class: 'g-busjam-have' }, coinIco(), t('youHave', { n: S.coins })),
    );
    if (game) game.paused = true;
    const ok = await modal({
      title: t('buyTitle', { name: t(kind) }),
      body,
      actions: [
        { label: t('buyFor', { n: price }), value: true, primary: true },
        { label: t('cancel'), value: false },
      ],
      dismissible: true,
    });
    if (dead) return false;
    if (game) game.paused = false;
    if (!ok) return false;
    if (S.coins < price) {
      sfx.play('error');
      toast(t('notEnough'));
      return false;
    }
    S.coins -= price;
    S.boosters[kind] = (S.boosters[kind] || 0) + 1;
    sfx.play('coin');
    save();
    refreshBadges();
    return true;
  }

  async function useBooster(kind) {
    if (!game) return false;
    const reason = game.canUse(kind);
    if (reason) {
      sfx.play('error');
      toast(t(reason));
      return false;
    }
    if (!(S.boosters[kind] > 0)) {
      const bought = await confirmBuy(kind);
      if (!bought || !game) return false;
      const again = game.canUse(kind);
      if (again) {
        toast(t(again));
        return false;
      }
    }
    if (kind === 'heli') {
      game.startHeliPick();
      showPick();
      sfx.play('select');
      return true;
    }
    const ok = kind === 'undo' ? game.useUndo() : kind === 'slot' ? game.useSlot() : game.useShuffle();
    if (ok) {
      S.boosters[kind] = Math.max(0, (S.boosters[kind] || 0) - 1);
      save();
      refreshBadges();
      if (kind === 'shuffle') toast(t('shuffled'));
    }
    return ok;
  }

  function showPick() {
    hidePick();
    const el = h(
      'div',
      { class: 'g-busjam-pick' },
      icon('heli'),
      h('span', null, t('heliPick')),
      h('button', {
        class: 'g-busjam-x',
        'aria-label': t('cancel'),
        onclick: () => {
          if (game) game.cancelPick();
          hidePick();
        },
      }, '✕'),
    );
    session.pick = el;
    session.stage.append(el);
  }
  function hidePick() {
    if (session && session.pick) {
      session.pick.remove();
      session.pick = null;
    }
  }

  // ---------------------------------------------------------- tutorial tips
  function tip(key, ms = 0) {
    if (!session) return;
    hideTip();
    const el = h('div', { class: 'g-busjam-tip', onclick: hideTip }, h('span', null, t(key)));
    session.tip = el;
    session.stage.append(el);
    if (ms) later(() => session && session.tip === el && hideTip(), ms);
  }
  function hideTip() {
    if (session && session.tip) {
      const el = session.tip;
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
      session.tip = null;
    }
  }

  // ---------------------------------------------------------- game screen
  function roundBtn(name, label, onclick) {
    return h('button', { class: 'g-busjam-round', 'aria-label': label, title: label, onclick: () => (sfx.play('tap'), onclick()) }, icon(name));
  }

  function boostBtn(kind, color) {
    const badge = h('span', { class: 'g-busjam-badge' });
    const el = h(
      'button',
      {
        class: `g-busjam-boost ${color}`,
        'aria-label': t(kind),
        title: t(kind),
        onclick: () => {
          sfx.play('tap');
          if (game && game.pickMode && kind === 'heli') {
            game.cancelPick();
            hidePick();
            return;
          }
          useBooster(kind);
        },
      },
      icon(BOOST_ICON[kind]),
      badge,
    );
    return { el, badge };
  }

  function playDef(def, kind) {
    destroyGame();
    clear(app);
    view = 'game';
    const title =
      kind === 'daily' ? t('daily') : t('level', { n: def.level });
    const tagText = kind === 'daily' ? null : def.kind === 'super' ? t('superHard') : def.kind === 'hard' ? t('hard') : kind === 'replay' ? t('replay') : null;
    const tag = tagText ? h('small', { class: `g-busjam-tag ${kind === 'replay' ? 'replay' : def.kind}` }, tagText) : null;
    const undoBadge = h('span', { class: 'g-busjam-badge small' });
    const undoBtn = roundBtn('undo', t('undo'), () => useBooster('undo'));
    undoBtn.append(undoBadge);
    const hud = h(
      'div',
      { class: 'g-busjam-hud' },
      undoBtn,
      h('div', { class: 'g-busjam-title' }, h('b', null, title), tag),
      roundBtn('restart', t('restart'), () => playDef(def, kind)),
    );
    const stage = h('div', { class: 'g-busjam-stage' });
    const boostL = boostBtn('shuffle', 'blue');
    const boostR = boostBtn('heli', 'gold');
    app.append(hud, stage);
    session = { def, kind, stage, boostL, boostR, undoBadge, tip: null, pick: null, departs: 0, tutorial: def.level === 1 && kind === 'level' && !S.tutorialDone, tipStep: 0 };
    const sess = session;
    game = new Game(stage, {
      def,
      sfx,
      t,
      hints: sess.tutorial,
      onEvent: (name, data) => {
        if (session === sess) onGameEvent(name, data);
      },
    });
    stage.append(boostL.el, boostR.el);
    if (game.L) placeBoosters(game.L);
    refreshBadges();
    intro(def, kind);
  }

  function placeBoosters(L) {
    if (!session) return;
    for (const [b, x] of [[session.boostL.el, L.boost.left], [session.boostR.el, L.boost.right]]) {
      Object.assign(b.style, { left: x + 'px', top: L.boost.y + 'px', width: L.boost.size + 'px', height: L.boost.size + 'px' });
    }
  }

  async function intro(def, kind) {
    const sess = session;
    const g = game;
    // "New!" card for a mechanic that appears for the first time
    const mech = kind === 'level' ? MECHANICS.find((m) => m.level === def.level && !S.seen[m.id]) : null;
    if (mech) {
      g.paused = true;
      await new Promise((resolve) => {
        const o = overlay(
          'news',
          h('div', { class: 'g-busjam-ribbon' }, t('newTitle')),
          mechanicPreview(mech.id),
          h('h2', { class: 'g-busjam-h2' }, t('new_' + mech.id)),
          h('p', { class: 'g-busjam-p' }, t('new_' + mech.id + '_d')),
          h('button', {
            class: 'btn primary block',
            onclick: () => {
              sfx.play('select');
              o.close();
              resolve();
            },
          }, t('ok')),
        );
        sfx.play('levelup');
      });
      S.seen[mech.id] = true;
      save();
      if (session !== sess) return;
      g.paused = false;
    }
    // daily login reward (after the tutorial)
    if (S.tutorialDone && S.daily.last !== todayKey() && kind !== 'daily') {
      g.paused = true;
      await dailyReward();
      if (session !== sess) return;
      g.paused = false;
    }
    if (kind === 'daily') banner('daily', t('dailyBanner'), t('rewardX', { n: 3 }));
    else if (def.kind === 'super') banner('super', t('superBanner'), t('rewardX', { n: 3 }));
    else if (def.kind === 'hard') banner('hard', t('hardBanner'), t('rewardX', { n: 2 }));
    else if (def.level > 1 && def.level % 20 === 1) banner('theme', t('newScene'), t('theme' + (def.theme % 6)));
    if (def.kind !== 'normal' || kind === 'daily') {
      sfx.play('whistle');
      sfx.vibrate([30, 60, 30]);
    }
    if (sess.tutorial) later(() => session === sess && tip('tip1'), 400);
  }

  function onGameEvent(name, data) {
    const sess = session;
    switch (name) {
      case 'layout':
        placeBoosters(data);
        break;
      case 'move':
        if (sess.tutorial && sess.tipStep === 0) {
          sess.tipStep = 1;
          hideTip();
        }
        break;
      case 'park':
        if (sess.tutorial && sess.tipStep === 1) {
          sess.tipStep = 2;
          tip('tip2', 4200);
        }
        break;
      case 'depart':
        sess.departs++;
        if (sess.tutorial && sess.departs === 1) tip('tip3', 5200);
        if (sess.tutorial && sess.departs === 3) tip('tip4', 5200);
        break;
      case 'bump':
        if (sess.tutorial && !sess.bumpTip) {
          sess.bumpTip = true;
          tip('tip3', 4500);
        }
        break;
      case 'slotsFull':
        toast(t('slotsFull'));
        break;
      case 'locked':
        toast(t('lockedVehicle', { n: data.n }));
        break;
      case 'slotTap':
        sfx.play('tap');
        useBooster('slot');
        break;
      case 'heliPicked':
        S.boosters.heli = Math.max(0, (S.boosters.heli || 0) - 1);
        save();
        refreshBadges();
        hidePick();
        break;
      case 'heliNoSlot':
        toast(t('heliNeedSlot'));
        game.cancelPick();
        hidePick();
        break;
      case 'undo':
        refreshBadges();
        break;
      case 'win':
        onWin(data);
        break;
      case 'fail':
        onFail();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------- win / fail
  function onWin(data) {
    const sess = session;
    const def = sess.def;
    hideTip();
    hidePick();
    sfx.play('win');
    sfx.vibrate([30, 50, 30, 50, 60]);
    ctx.ui.confetti(90);
    const stars = data.boosters === 0 ? 3 : data.boosters === 1 ? 2 : 1;
    let reward;
    let xp;
    if (sess.kind === 'daily') {
      reward = rewardFor(50, 'super');
      xp = 25;
      S.challenge = def.daily;
    } else if (sess.kind === 'replay') {
      reward = 5 + stars * 2;
      xp = 3;
    } else {
      reward = rewardFor(def.level, def.kind) + (stars === 3 ? 10 : 0);
      xp = xpFor(def.kind);
      S.level = Math.max(S.level, def.level + 1);
      if (def.level === 1) S.tutorialDone = true;
    }
    if (sess.kind !== 'daily') S.stars[def.level] = Math.max(S.stars[def.level] || 0, stars);
    const before = S.coins;
    S.coins += reward;
    save();
    ctx.addXP?.(xp);
    later(() => {
      if (session !== sess) return;
      const starsEl = h('div', { class: 'g-busjam-stars' });
      for (let i = 0; i < 3; i++) starsEl.append(h('span', { class: `g-busjam-star ${i < stars ? 'on' : ''}`, style: { animationDelay: 0.25 + i * 0.18 + 's' } }, '★'));
      const rewardNum = h('b', null, '0');
      const totalNum = h('b', null, before.toLocaleString());
      const nextLabel = sess.kind === 'level' ? t('next') : sess.kind === 'daily' ? t('continue') : ctx.mode === 'levels' ? t('toMap') : t('continue');
      const o = overlay(
        'win',
        h('div', { class: 'g-busjam-crown' }, icon('crown')),
        h('div', { class: 'g-busjam-ribbon' }, sess.kind === 'daily' ? t('dailyDoneTitle') : t('winTitle')),
        h('div', { class: 'g-busjam-sub' }, sess.kind === 'daily' ? t('daily') : t('levelDone', { n: def.level })),
        winArt(def),
        starsEl,
        h('div', { class: 'g-busjam-reward' }, h('span', null, t('reward')), h('div', { class: 'g-busjam-amount big' }, coinIco(), '+', rewardNum)),
        h('div', { class: 'g-busjam-reward total' }, h('span', null, t('total')), h('div', { class: 'g-busjam-amount' }, coinIco(), totalNum)),
        h('div', { class: 'g-busjam-actions' },
          h('button', {
            class: 'btn primary big block',
            onclick: () => {
              sfx.play('select');
              o.close();
              if (sess.kind === 'level') playLevel(S.level);
              else if (ctx.mode === 'levels') showMap();
              else playLevel(S.level);
            },
          }, icon('play'), nextLabel),
          ctx.mode === 'levels' && sess.kind === 'level'
            ? h('button', { class: 'btn ghost block', onclick: () => (o.close(), showMap()) }, t('toMap'))
            : null,
        ),
      );
      later(() => {
        let ticks = 0;
        countUp(rewardNum, 0, reward, 800, () => {
          if (ticks++ % 3 === 0) sfx.play('coin');
        });
        later(() => countUp(totalNum, before, S.coins, 900), 850);
      }, 600);
    }, 900);
  }

  function onFail() {
    const sess = session;
    hideTip();
    hidePick();
    sfx.play('lose');
    sfx.vibrate([60, 40, 60]);
    later(() => {
      if (session !== sess || !game || game.over !== 'fail') return;
      const offers = h('div', { class: 'g-busjam-offers' });
      let o = null;
      const kinds = ['shuffle', 'slot', 'undo'].filter((k) => !game.canUse(k));
      for (const k of kinds) {
        offers.append(
          h('button', {
            class: `g-busjam-offer ${k}`,
            onclick: async () => {
              sfx.play('tap');
              const ok = await useBooster(k);
              if (ok && o) o.close();
            },
          },
          h('span', { class: `g-busjam-offer-ico ${k}` }, icon(BOOST_ICON[k])),
          h('span', { class: 'g-busjam-offer-name' }, t(k)),
          h('span', { class: `g-busjam-offer-cost ${S.boosters[k] > 0 ? '' : 'price'}` }, ...badgeContent(k))),
        );
      }
      o = overlay(
        'fail',
        h('div', { class: 'g-busjam-fail-ico' }, icon('warn')),
        h('h2', { class: 'g-busjam-h2' }, t('failTitle')),
        h('p', { class: 'g-busjam-p' }, t('failText')),
        kinds.length ? h('div', { class: 'g-busjam-section' }, t('continueWith')) : null,
        kinds.length ? offers : null,
        h('button', {
          class: 'btn block',
          onclick: () => {
            sfx.play('select');
            o.close();
            playDef(sess.def, sess.kind);
          },
        }, icon('restart'), t('retry')),
      );
    }, 700);
  }

  // ---------------------------------------------------------- daily reward
  function dailyReward() {
    const today = todayKey();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const streak = S.daily.last === todayKey(y) ? (S.daily.streak % 7) + 1 : 1;
    const prize = DAILY[streak - 1];
    return new Promise((resolve) => {
      const grid = h('div', { class: 'g-busjam-days' });
      DAILY.forEach((p, i) => {
        const day = i + 1;
        const cls = day < streak ? 'done' : day === streak ? 'today' : '';
        grid.append(
          h('div', { class: `g-busjam-day ${cls} ${day === 7 ? 'big' : ''}` },
            h('small', null, t('day', { n: day })),
            p.boost && !p.coins ? h('span', { class: `g-busjam-day-ico ${p.boost}` }, icon(BOOST_ICON[p.boost])) : icon(day === 7 ? 'gift' : 'coin', 'coin'),
            h('b', null, p.coins ? String(p.coins) : '×' + p.n),
            day < streak ? h('span', { class: 'g-busjam-day-check' }, icon('check')) : null),
        );
      });
      const o = overlay(
        'daily',
        h('div', { class: 'g-busjam-crown' }, icon('gift')),
        h('div', { class: 'g-busjam-ribbon' }, t('dailyTitle')),
        h('div', { class: 'g-busjam-sub' }, t('dailySub')),
        grid,
        h('button', {
          class: 'btn primary big block',
          onclick: () => {
            S.daily = { last: today, streak };
            if (prize.coins) S.coins += prize.coins;
            if (prize.boost) S.boosters[prize.boost] = (S.boosters[prize.boost] || 0) + prize.n;
            save();
            refreshBadges();
            sfx.play('coin');
            later(() => sfx.play('success'), 160);
            ctx.ui.confetti(60);
            o.close();
            resolve();
          },
        }, t('claim')),
      );
    });
  }

  // ---------------------------------------------------------- level map
  function showMap() {
    destroyGame();
    clear(app);
    view = 'map';
    const cur = S.level;
    const from = Math.max(1, cur - 30);
    const to = cur + 15;
    const list = h('div', { class: 'g-busjam-path' });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'g-busjam-path-line');
    list.append(svg);
    const nodes = [];
    let currentEl = null;
    for (let n = to; n >= from; n--) {
      const kind = levelKind(n);
      const state = n < cur ? 'done' : n === cur ? 'current' : 'locked';
      const off = Math.sin(n * 0.9) * 32;
      const node = h(
        'button',
        {
          class: `g-busjam-node ${state} ${kind}`,
          style: { transform: `translateX(${off}%)` },
          'aria-label': t('level', { n }),
          onclick: () => {
            if (state === 'locked') {
              sfx.play('error');
              return;
            }
            sfx.play('select');
            if (state === 'done') playDef(generateLevel(n), 'replay');
            else playLevel(n);
          },
        },
        state === 'locked' ? icon('lock') : h('b', null, String(n)),
        state === 'done' ? h('small', { class: 'g-busjam-node-stars' }, '★'.repeat(S.stars[n] || 1)) : null,
        kind !== 'normal' ? h('span', { class: `g-busjam-node-badge ${kind}` }, icon(kind === 'super' ? 'skull' : 'flame')) : null,
      );
      list.append(h('div', { class: 'g-busjam-node-row' }, node));
      if ((n - 1) % 20 === 0) list.append(h('div', { class: 'g-busjam-zone' }, h('span', null, t('theme' + (Math.floor((n - 1) / 20) % 6)))));
      nodes.push(node);
      if (state === 'current') currentEl = node;
    }
    const coins = h('b', null, S.coins.toLocaleString());
    const screen = h(
      'div',
      { class: 'g-busjam-map' },
      h('div', { class: 'g-busjam-map-head' },
        h('div', { class: 'g-busjam-map-title' }, icon('crown'), h('b', null, t('levels'))),
        h('div', { class: 'g-busjam-pill' }, coinIco(), coins)),
      h('div', { class: 'g-busjam-map-scroll' }, list),
      h('div', { class: 'g-busjam-map-foot' },
        h('button', { class: 'btn primary big block', onclick: () => (sfx.play('select'), playLevel(cur)) }, icon('play'), t('playLevel', { n: cur }))),
    );
    app.append(screen);
    const scroller = screen.querySelector('.g-busjam-map-scroll');
    requestAnimationFrame(() => {
      if (dead || view !== 'map') return;
      // connect the nodes with a dotted path
      const box = list.getBoundingClientRect();
      svg.setAttribute('width', box.width);
      svg.setAttribute('height', list.scrollHeight);
      let d = '';
      nodes.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const x = r.left - box.left + r.width / 2;
        const y = r.top - box.top + r.height / 2;
        d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      });
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', d);
      svg.append(p);
      if (currentEl) scroller.scrollTop = currentEl.offsetTop - scroller.clientHeight / 2 + 40;
    });
  }

  // ---------------------------------------------------------- daily challenge
  function startDaily() {
    const key = todayKey();
    if (S.challenge === key) {
      destroyGame();
      clear(app);
      view = 'dailyDone';
      const left = h('b', null, '');
      const tick = () => {
        const now = new Date();
        const end = new Date(now);
        end.setHours(24, 0, 0, 0);
        const s = Math.max(0, Math.floor((end - now) / 1000));
        const hh = String(Math.floor(s / 3600)).padStart(2, '0');
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        left.textContent = `${hh}:${mm}:${ss}`;
        if (view === 'dailyDone') later(tick, 1000);
      };
      tick();
      app.append(
        h('div', { class: 'g-busjam-done screen center' },
          h('div', { class: 'g-busjam-panel static' },
            h('div', { class: 'g-busjam-crown' }, icon('calendar')),
            h('div', { class: 'g-busjam-ribbon' }, t('dailyChallenge')),
            h('p', { class: 'g-busjam-p' }, t('dailyDone')),
            h('div', { class: 'g-busjam-countdown' }, t('dailyNext', { t: '' }), left),
            h('button', { class: 'btn primary big block', onclick: () => (sfx.play('select'), playLevel(S.level)) }, icon('play'), t('playLevel', { n: S.level })))),
      );
      return;
    }
    playDef(dailyLevel(key), 'daily');
  }

  function playLevel(n) {
    playDef(generateLevel(n), 'level');
  }

  // ---------------------------------------------------------- back button
  ctx.onBack(() => {
    if (game && game.pickMode) {
      game.cancelPick();
      hidePick();
      return true;
    }
    if (view === 'game' && ctx.mode === 'levels') {
      showMap();
      return true;
    }
    return false;
  });

  // ---------------------------------------------------------- start
  if (ctx.mode === 'levels') showMap();
  else if (ctx.mode === 'daily') startDaily();
  else playLevel(S.level);

  // Test hook (used by automated browser tests; harmless for players).
  root.__busjam = {
    get game() {
      return game;
    },
    get save() {
      return S;
    },
    playLevel,
    showMap,
  };

  return () => {
    dead = true;
    destroyGame();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const id of rafs) cancelAnimationFrame(id);
    rafs.clear();
    delete root.__busjam;
  };
}
