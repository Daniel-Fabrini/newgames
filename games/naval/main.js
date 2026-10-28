// Sea Battle (Batalha Naval) — place your fleet, then trade fire with the
// computer admiral (4 levels) or a friend on the same phone (pass-and-play).
// Fleets: standard / classic / russian (no touching). Shot rules: hitting
// streak, single shot, salvo, multi-shot. Career with endless ranks, medals,
// ship paints and sea themes.
//
// Modes (ctx.mode): undefined → main menu · '1p' → placement vs AI ·
// '2p' → pass-and-play placement · 'salvo' → placement vs AI with the salvo rule.

import STRINGS from './strings.js';
import * as R from './rules.js';
import { aiShot, learnHabits } from './ai.js';
import { BattleView } from './battle.js';
import { PlacementView } from './placement.js';
import { SKIN_IDS, THEME_IDS, paintWater, paintGrid, paintShip, paintMiss, paintFire } from './render.js';
import { rankInfo, RANK_XP, TOP_RANK, STAR_XP, SKIN_UNLOCK, THEME_UNLOCK, MEDALS, medalsFor, matchXP, insigniaSVG } from './progress.js';

const DEFAULT_SETTINGS = { ai: 'medium', fleet: 'standard', rule: 'streak', skin: 'grey', theme: 'atlantic' };
const DEFAULT_CAREER = { xp: 0, matches: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, shots: 0, hits: 0, sunk: 0, lost: 0, duels: 0, medals: {}, aiWins: {} };

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h, clear, modal } = ctx.ui;
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const store = ctx.store;
  const locale = ctx.lang === 'en' ? 'en-US' : ctx.lang === 'es' ? 'es-ES' : 'pt-BR';
  const fmt = (n) => Math.round(n).toLocaleString(locale);

  // ---------------------------------------------------------------- sound
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const play = (n) => active() && ctx.sfx.play(n);
  const tone = (o) => active() && ctx.sfx.tone(o);
  const noise = (o) => active() && ctx.sfx.noise(o);
  const haptic = (p) => active() && ctx.sfx.vibrate(p);
  const snd = {
    cannon() {
      tone({ freq: 150, to: 42, dur: 0.38, type: 'sine', vol: 0.75 });
      noise({ dur: 0.32, vol: 0.55, freq: 240, q: 0.6 });
      noise({ dur: 0.05, vol: 0.35, freq: 2800, q: 0.8 });
      tone({ freq: 1500, to: 520, dur: 0.5, type: 'sine', vol: 0.045, delay: 0.12 });
    },
    splash() {
      noise({ dur: 0.55, vol: 0.42, freq: 1100, q: 0.5 });
      noise({ dur: 0.3, vol: 0.22, freq: 3200, q: 0.9, delay: 0.05 });
      tone({ freq: 280, to: 90, dur: 0.22, type: 'sine', vol: 0.25 });
    },
    boom(big) {
      play('explosion');
      noise({ dur: big ? 1.1 : 0.65, vol: 0.55, freq: 150, q: 0.4 });
      noise({ dur: 0.25, vol: 0.3, freq: 1500, q: 0.6, delay: 0.04 });
      tone({ freq: 75, to: 28, dur: big ? 1 : 0.55, type: 'sine', vol: 0.6 });
      if (big) noise({ dur: 0.6, vol: 0.25, freq: 600, q: 0.5, delay: 0.35 });
    },
    groan() {
      tone({ freq: 98, to: 40, dur: 1.9, type: 'sawtooth', vol: 0.11, delay: 0.25 });
      tone({ freq: 128, to: 52, dur: 1.6, type: 'triangle', vol: 0.18, delay: 0.4 });
      tone({ freq: 62, to: 34, dur: 1.4, type: 'sine', vol: 0.3, delay: 0.5 });
      noise({ dur: 1.5, vol: 0.16, freq: 420, q: 0.4, delay: 0.3 });
      for (let k = 0; k < 7; k++) tone({ freq: 320 + Math.random() * 500, to: 900 + Math.random() * 500, dur: 0.06, type: 'sine', vol: 0.07, delay: 0.7 + k * 0.17 });
    },
    sonar() {
      tone({ freq: 1320, dur: 0.5, type: 'sine', vol: 0.07 });
      tone({ freq: 1320, dur: 0.45, type: 'sine', vol: 0.025, delay: 0.32 });
    },
    alarm() {
      tone({ freq: 640, to: 470, dur: 0.2, type: 'square', vol: 0.05 });
      tone({ freq: 640, to: 470, dur: 0.2, type: 'square', vol: 0.05, delay: 0.26 });
    },
    pick: () => play('select'),
    place() {
      tone({ freq: 230, to: 120, dur: 0.1, type: 'sine', vol: 0.4 });
      noise({ dur: 0.1, vol: 0.14, freq: 900, q: 0.7 });
    },
    rotate: () => noise({ dur: 0.14, vol: 0.2, freq: 1300, q: 0.7 }),
    bad: () => play('error'),
    whoosh: () => play('whoosh'),
  };

  // ---------------------------------------------------------------- state
  const settings = { ...DEFAULT_SETTINGS, ...(store.get('settings', null) || {}) };
  if (!R.FLEETS[settings.fleet]) settings.fleet = 'standard';
  if (!R.RULE_IDS.includes(settings.rule)) settings.rule = 'streak';
  if (!R.AI_IDS.includes(settings.ai)) settings.ai = 'medium';
  const career = { ...DEFAULT_CAREER, ...(store.get('career', null) || {}) };
  career.medals = career.medals || {};
  career.aiWins = career.aiWins || {};
  let habits = store.get('habits', null);
  let lastShips = store.get('lastShips', null) || {};
  const saveSettings = () => store.set('settings', settings);
  const saveCareer = () => store.set('career', career);
  const rankNow = () => rankInfo(career.xp);
  if (SKIN_UNLOCK[settings.skin] === undefined || SKIN_UNLOCK[settings.skin] > rankNow().idx) settings.skin = 'grey';
  if (THEME_UNLOCK[settings.theme] === undefined || THEME_UNLOCK[settings.theme] > rankNow().idx) settings.theme = 'atlantic';

  const app = h('div', { class: 'g-naval-app' });
  root.append(app);
  let dead = false;
  let screen = null; // { name, destroy, back }
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  function setScreen(name, el, extra = {}) {
    if (screen && screen.destroy) screen.destroy();
    clear(app);
    app.append(el);
    screen = { name, ...extra };
    ctx.setHeaderRight(extra.header || null);
  }

  const rankName = (idx) => t('rank' + idx);
  const rankLabel = (ri) => rankName(ri.idx) + (ri.stars ? ' ' + '★'.repeat(Math.min(ri.stars, 3)) + (ri.stars > 3 ? '+' + (ri.stars - 3) : '') : '');
  const shipName = (cls) => t('ship_' + cls);
  const aiName = (id) => t('ai_' + id);
  const pname = (p) => t('player', { n: p + 1 });

  function helpButton() {
    return h('button', { class: 'icon-btn g-naval-help', 'aria-label': t('rulesTitle'), onclick: showRules }, '?');
  }

  function showRules() {
    const cfg = currentCfg || { fleet: settings.fleet, rule: settings.rule };
    const body = h(
      'div',
      { class: 'g-naval-rules' },
      h('p', null, t('rulesGoal')),
      h('p', null, h('b', null, t('fleet_' + cfg.fleet) + ': '), t('fleetDesc_' + cfg.fleet)),
      h('p', null, h('b', null, t('rule_' + cfg.rule) + ': '), t('ruleDesc_' + cfg.rule)),
      h('p', null, t('rulesPlace')),
      h('p', null, t('rulesFire')),
    );
    modal({ title: t('rulesTitle'), body, actions: [{ label: t('ok'), value: true, primary: true }], dismissible: true });
  }
  let currentCfg = null;

  // ---------------------------------------------------------------- hero canvas (menu)
  function heroCanvas(host) {
    const c = h('canvas', { class: 'g-naval-hero-canvas' });
    host.prepend(c);
    const g = c.getContext('2d');
    let W = 0;
    let H = 0;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    };
    const ro = new ResizeObserver(size);
    ro.observe(host);
    size();
    const t0 = performance.now();
    const ships = [
      { cls: 'battleship', len: 4, dir: 'h', r: 0, c: 0, id: 0 },
      { cls: 'destroyer', len: 2, dir: 'h', r: 0, c: 0, id: 1 },
      { cls: 'submarine', len: 3, dir: 'h', r: 0, c: 0, id: 2 },
    ];
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!W) return;
      const tt = (now - t0) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = Math.min(H * 0.3, W * 0.13);
      paintWater(g, 0, 0, W, H, cs * 0.9, settings.theme, -tt * 2.2, 0);
      const drift = Math.sin(tt * 0.4) * 6;
      paintShip(g, ships[2], W * 0.58 + drift * 0.5, H * 0.08, cs * 0.6, settings.skin, { t: tt, wake: true });
      paintShip(g, ships[1], W * 0.68 - drift, H * 0.5, cs * 0.75, settings.skin, { t: tt, wake: true });
      paintShip(g, ships[0], W * 0.06 + drift, H * 0.22, cs, settings.skin, { t: tt, wake: true });
      const vg = g.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.45, 'rgba(0,0,0,0.05)');
      vg.addColorStop(1, 'rgba(5,5,8,0.92)');
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }

  // ---------------------------------------------------------------- menu
  function chipRow(ids, value, label, onPick, locked = () => false) {
    return h(
      'div',
      { class: 'chips g-naval-chips' },
      ids.map((id) =>
        h(
          'button',
          {
            class: `chip ${id === value ? 'active' : ''}`,
            onclick: () => onPick(id),
          },
          label(id),
          locked(id) ? ' 🔒' : null,
        ),
      ),
    );
  }

  function settingsPanel(onChange, opts = {}) {
    const box = h('div', { class: 'g-naval-setup' });
    const render = () => {
      clear(box);
      if (!opts.noAI) {
        box.append(
          h('div', { class: 'section-title' }, t('opponent')),
          chipRow(R.AI_IDS, settings.ai, aiName, (id) => {
            settings.ai = id;
            saveSettings();
            render();
            onChange && onChange();
          }),
          h('div', { class: 'g-naval-desc' }, t('aiDesc_' + settings.ai)),
        );
      }
      box.append(
        h('div', { class: 'section-title' }, t('fleet')),
        chipRow(R.FLEET_IDS, settings.fleet, (id) => t('fleet_' + id), (id) => {
          settings.fleet = id;
          saveSettings();
          render();
          onChange && onChange();
        }),
        h('div', { class: 'g-naval-desc' }, fleetPreview(settings.fleet), t('fleetDesc_' + settings.fleet)),
        h('div', { class: 'section-title' }, t('rule')),
        chipRow(R.RULE_IDS, opts.rule || settings.rule, (id) => t('rule_' + id), (id) => {
          settings.rule = id;
          opts.rule = null;
          saveSettings();
          render();
          onChange && onChange();
        }),
        h('div', { class: 'g-naval-desc' }, t('ruleDesc_' + (opts.rule || settings.rule))),
      );
    };
    render();
    return box;
  }

  function fleetPreview(fleetId) {
    return h(
      'span',
      { class: 'g-naval-fleetdots' },
      R.FLEETS[fleetId].sizes.map((n) => h('i', { style: { width: n * 7 + 'px' } })),
    );
  }

  function showMenu() {
    currentCfg = null;
    const saved = R.deserialize(store.get('match', null));
    const ri = rankNow();
    const hero = h(
      'div',
      { class: 'g-naval-hero' },
      h(
        'div',
        { class: 'g-naval-hero-info' },
        h('div', { class: 'g-naval-hero-badge', html: insigniaSVG(ri.idx, ri.stars) }),
        h(
          'div',
          { class: 'g-naval-hero-text' },
          h('div', { class: 'g-naval-hero-kicker' }, t('yourRank')),
          h('div', { class: 'g-naval-hero-rank' }, rankLabel(ri)),
          h('div', { class: 'progress g-naval-xpbar' }, h('i', { style: { width: Math.round(ri.pct * 100) + '%' } })),
          h('div', { class: 'g-naval-hero-xp' }, `${fmt(career.xp - ri.from)} / ${fmt(ri.to - ri.from)} XP`, h('span', null, ri.idx < TOP_RANK ? t('nextRank', { rank: rankName(ri.idx + 1) }) : t('nextStar'))),
        ),
      ),
    );
    const el = h(
      'div',
      { class: 'screen g-naval-menu' },
      hero,
      saved
        ? h(
            'button',
            { class: 'btn primary big block g-naval-cta', onclick: () => resumeMatch(saved) },
            h('span', { class: 'g-naval-cta-ico' }, '⚓'),
            h('span', null, t('continueBattle'), h('small', null, saved.cfg.twoP ? t('twoPlayers') : aiName(saved.cfg.ai) + ' · ' + t('turnN', { n: saved.turnNo }))),
          )
        : null,
      h(
        'button',
        { class: `btn ${saved ? '' : 'primary'} big block g-naval-cta`, onclick: () => startSingle() },
        h('span', { class: 'g-naval-cta-ico' }, '🎯'),
        h('span', null, t('battleAI'), h('small', null, aiName(settings.ai) + ' · ' + t('fleet_' + settings.fleet) + ' · ' + t('rule_' + settings.rule))),
      ),
      h(
        'button',
        { class: 'btn block g-naval-cta two', onclick: () => startTwo() },
        h('span', { class: 'g-naval-cta-ico' }, '👥'),
        h('span', null, t('twoPlayers'), h('small', null, t('twoPlayersSub'))),
      ),
      h('div', { class: 'card g-naval-card' }, settingsPanel(() => showMenu())),
      h(
        'div',
        { class: 'grid-3 g-naval-tiles' },
        tile('🎨', t('arsenal'), t('arsenalSub'), showArsenal),
        tile('🎖️', t('medals'), `${Object.keys(career.medals).length}/${MEDALS.length}`, showMedals),
        tile('📊', t('careerTitle'), t('careerSub'), showCareer),
      ),
    );
    setScreen('menu', el, { header: helpButton() });
    const stop = heroCanvas(hero);
    screen.destroy = stop;
  }

  function tile(icon, title, sub, onclick) {
    return h('button', { class: 'g-naval-tile', onclick }, h('span', { class: 'g-naval-tile-ico' }, icon), h('b', null, title), h('small', null, sub));
  }

  // ---------------------------------------------------------------- placement
  function startSingle(ruleOverride = null) {
    const cfg = { fleet: settings.fleet, rule: ruleOverride || settings.rule, ai: settings.ai, twoP: false };
    placementScreen(cfg, 0, (ships) => {
      const ai = R.randomFleet(cfg.fleet, Math.random, cfg.ai === 'hard' || cfg.ai === 'admiral');
      startBattle(cfg, ships, ai);
    }, ruleOverride);
  }

  async function startTwo() {
    const cfg = { fleet: settings.fleet, rule: settings.rule, ai: null, twoP: true };
    currentCfg = cfg;
    if (!(await passScreen(0, t('passPlace')))) return;
    placementScreen(cfg, 0, async (shipsA) => {
      if (!(await passScreen(1, t('passPlace')))) return;
      placementScreen(cfg, 1, async (shipsB) => {
        const m = R.newMatch(cfg, shipsA, shipsB);
        store.set('match', R.serialize(m));
        if (!(await passScreen(0, t('passStart')))) return;
        runBattle(m, true);
      });
    });
  }

  function placementScreen(cfg, player, onDone, ruleOverride = null) {
    currentCfg = cfg;
    const stage = h('div', { class: 'g-naval-stage' });
    const ready = h('button', { class: 'btn primary g-naval-ready', disabled: true, onclick: () => done() }, t('ready'), ' ▶');
    const auto = h('button', { class: 'btn small g-naval-act', onclick: () => view.autoPlace() }, h('span', { class: 'g-naval-act-ico' }, '🎲'), t('auto'));
    const reset = h('button', { class: 'btn small g-naval-act', onclick: () => view.clear() }, h('span', { class: 'g-naval-act-ico' }, '↺'), t('clear'));
    const title = cfg.twoP ? t('placeTitleP', { name: pname(player) }) : t('placeTitle');
    const pill = cfg.twoP
      ? h('div', { class: 'g-naval-pill static' }, t('fleet_' + cfg.fleet) + ' · ' + t('rule_' + cfg.rule))
      : h('button', { class: 'g-naval-pill', onclick: () => changeSetup() }, aiName(cfg.ai) + ' · ' + t('fleet_' + cfg.fleet) + ' · ' + t('rule_' + cfg.rule), h('span', { class: 'g-naval-pill-gear' }, '⚙'));
    const hint = h('div', { class: 'g-naval-hint' }, t('placeHint'), R.FLEETS[cfg.fleet].touch ? null : h('b', null, ' ' + t('noTouchHint')));
    const el = h(
      'div',
      { class: 'g-naval-place' },
      h('div', { class: 'g-naval-place-top' }, h('div', { class: 'g-naval-place-title' }, title), pill),
      hint,
      stage,
      h('div', { class: 'g-naval-place-actions' }, auto, reset, ready),
    );
    let view = null;
    setScreen('place', el, {
      header: helpButton(),
      destroy: () => view && view.destroy(),
      back: () => {
        showMenu();
        return true;
      },
    });
    const key = cfg.fleet + (cfg.twoP ? ':p' + player : '');
    view = new PlacementView(stage, {
      fleetId: cfg.fleet,
      skin: skinFor(player, cfg),
      theme: settings.theme,
      ships: cfg.twoP ? null : lastShips[key],
      snd,
      haptic,
      onChange: (all) => {
        ready.disabled = !all;
        ready.classList.toggle('pulse', all);
      },
    });
    ready.disabled = !view.allPlaced();
    function done() {
      if (!view.allPlaced()) return;
      const ships = view.getShips();
      if (!cfg.twoP) {
        lastShips = { ...lastShips, [key]: ships.map((s) => ({ len: s.len, r: s.r, c: s.c, dir: s.dir })) };
        store.set('lastShips', lastShips);
      }
      play('success');
      onDone(ships);
    }
    function changeSetup() {
      const opts = { rule: ruleOverride };
      const body = settingsPanel(null, opts);
      modal({ title: t('setupTitle'), body, actions: [{ label: t('ok'), value: true, primary: true }], dismissible: true }).then(() => {
        if (dead || !screen || screen.name !== 'place') return;
        startSingle(opts.rule || null);
      });
    }
  }

  function skinFor(player, cfg) {
    if (cfg.twoP) return player === 0 ? settings.skin : settings.skin === 'grey' ? 'silver' : 'grey';
    return player === 0 ? settings.skin : 'enemy';
  }

  // ---------------------------------------------------------------- pass-and-play privacy screen
  function passScreen(player, sub, recap = null) {
    return new Promise((resolve) => {
      const el = h(
        'div',
        { class: 'g-naval-pass' },
        h('div', { class: 'g-naval-pass-ring' }, h('span', null, '⚓')),
        h('div', { class: 'g-naval-pass-kicker' }, t('passTo')),
        h('div', { class: 'g-naval-pass-name' }, pname(player)),
        recap ? h('div', { class: 'g-naval-pass-recap' }, recap) : null,
        h('div', { class: 'g-naval-pass-sub' }, sub),
        h(
          'button',
          {
            class: 'btn primary big',
            onclick: () => {
              play('select');
              resolve(true);
            },
          },
          t('imReady'),
        ),
        h('div', { class: 'g-naval-pass-note' }, t('passNote')),
      );
      setScreen('pass', el, {
        back: () => {
          resolve(false);
          showMenu();
          return true;
        },
      });
    });
  }

  // ---------------------------------------------------------------- battle
  function startBattle(cfg, shipsA, shipsB) {
    const m = R.newMatch(cfg, shipsA, shipsB);
    if (!cfg.twoP) habits = learnHabits(habits, shipsA, R.cellsOf);
    store.set('habits', habits);
    store.set('match', R.serialize(m));
    runBattle(m, true);
  }

  function resumeMatch(m) {
    if (m.cfg.twoP) {
      passScreen(m.turn, t('passResume')).then((ok) => ok && runBattle(m, false, true));
    } else runBattle(m, false);
  }

  function runBattle(m, fresh, skipPass = false) {
    currentCfg = m.cfg;
    const twoP = m.cfg.twoP;
    const isHuman = (p) => twoP || p === 0;
    let viewer = twoP ? m.turn : 0;
    let busy = false;
    let peek = false;
    let alive = true;
    let turnShots = [];
    const isAlive = () => alive && !dead;

    const stage = h('div', { class: 'g-naval-stage' });
    const banner = h('div', { class: 'g-naval-banner' });
    const logList = h('div', { class: 'g-naval-loglist' });
    const logBox = h('div', { class: 'g-naval-log' }, h('div', { class: 'g-naval-log-title' }, t('log')), logList);
    const el = h('div', { class: 'g-naval-battle' }, stage, banner, logBox);
    setScreen('battle', el, {
      header: helpButton(),
      destroy: () => {
        alive = false;
        view.destroy();
      },
      back: () => {
        if (!m.over) {
          store.set('match', R.serialize(m));
          ctx.ui.toast(t('savedBattle'));
        }
        showMenu();
        return true;
      },
    });
    const label = (owner) => {
      if (twoP) return owner === viewer ? t('yourFleet') : t('fleetOf', { name: pname(owner) });
      return owner === 0 ? t('yourFleet') : t('enemyFleet');
    };
    const view = new BattleView(stage, {
      match: m,
      viewer,
      theme: settings.theme,
      skins: [skinFor(0, m.cfg), skinFor(1, m.cfg)],
      label,
      snd,
      haptic,
      onFire: (i) => fireAt(i),
      onSwap: () => {
        if (busy || m.over || !isHuman(m.turn)) return;
        peek = !peek;
        play('whoosh');
        view.setMode(peek ? 'defend' : 'attack');
        updateBanner();
      },
      onLayout: (L) => {
        Object.assign(banner.style, { left: L.banner.x + 'px', top: L.banner.y + 'px', width: L.banner.w + 'px', height: L.banner.h + 'px' });
        Object.assign(logBox.style, { left: L.log.x + 'px', top: L.log.y + 'px', width: L.log.w + 'px', height: L.log.h + 'px' });
      },
    });

    function who(p) {
      if (twoP) return t('pShort', { n: p + 1 });
      return p === 0 ? t('you') : t('cpu');
    }
    function logLine(e, animate) {
      const txt = e.res === 'miss' ? t('logMiss') : e.res === 'hit' ? t('logHit') : t('logSunk', { ship: shipName(e.cls) });
      const row = h('div', { class: `g-naval-logrow ${e.res} p${e.p} ${animate ? 'new' : ''}` }, h('i'), h('b', null, who(e.p)), h('span', { class: 'cell' }, R.cellName(e.i)), h('span', { class: 'res' }, txt));
      logList.prepend(row);
      while (logList.childElementCount > 40) logList.lastChild.remove();
    }
    m.log.slice(-30).forEach((e) => logLine(e, false));

    function pips(n, total) {
      const out = [];
      for (let k = 0; k < total; k++) out.push(h('i', { class: k < n ? 'on' : '' }));
      return h('div', { class: 'g-naval-pips' }, out);
    }
    let turnTotal = m.shotsLeft;
    function updateBanner() {
      clear(banner);
      const humanTurn = isHuman(m.turn);
      banner.className = `g-naval-banner ${humanTurn ? 'mine' : 'enemy'} ${peek ? 'peek' : ''}`;
      let title;
      let sub;
      if (m.over) {
        title = twoP ? t('winsP', { name: pname(m.winner) }) : m.winner === 0 ? t('victory') : t('defeat');
        sub = '';
      } else if (humanTurn) {
        title = twoP ? t('turnOf', { name: pname(m.turn) }) : t('yourTurn');
        if (peek) sub = t('peekHint');
        else if (m.cfg.rule === 'streak') sub = t('subStreak');
        else if (m.cfg.rule === 'single') sub = t('subSingle');
        else sub = t('subShots', { n: m.shotsLeft });
      } else {
        title = t('enemyTurn');
        sub = t('enemyIs', { name: aiName(m.cfg.ai) });
      }
      banner.append(
        h('div', { class: 'g-naval-banner-ico', html: humanTurn ? crosshairSVG : alertSVG }),
        h('div', { class: 'g-naval-banner-text' }, h('b', null, title), sub ? h('small', null, sub) : null),
        (m.cfg.rule === 'salvo' || m.cfg.rule === 'multi') && !m.over ? pips(m.shotsLeft, Math.max(turnTotal, m.shotsLeft)) : h('div', { class: 'g-naval-turnno' }, t('turnN', { n: m.turnNo })),
      );
    }

    function callout(main, sub, kind) {
      const c = h('div', { class: `g-naval-callout ${kind}` }, h('b', null, main), sub ? h('small', null, sub) : null);
      el.append(c);
      later(() => c.remove(), kind === 'sunk' ? 1900 : 900);
    }

    function announce(res, att) {
      const mine = twoP ? att === viewer : att === 0;
      if (res.res === 'miss') callout(t('calloutMiss'), null, 'miss');
      else if (res.res === 'hit') callout(t('calloutHit'), null, mine ? 'hit' : 'hurt');
      else callout(t('calloutSunk'), mine ? t('sunkTheirs', { ship: shipName(res.ship.cls) }) : t('sunkOurs', { ship: shipName(res.ship.cls) }), mine ? 'sunk' : 'sunk lost');
      logLine(m.log[m.log.length - 1], true);
    }

    async function beginTurn(first = false) {
      if (!isAlive()) return;
      store.set('match', R.serialize(m));
      peek = false;
      turnTotal = m.shotsLeft;
      if (isHuman(m.turn)) {
        if (twoP && (!first || !skipPass) && !(first && fresh)) {
          // privacy screen between turns
          const shots = turnShots;
          turnShots = [];
          let recap = null;
          if (shots.length && !first) {
            const hits = shots.filter((s) => s.res !== 'miss').length;
            const sunk = shots.filter((s) => s.res === 'sunk');
            recap = t('recap', { name: pname(1 - m.turn), n: shots.length, hits }) + (sunk.length ? ' ' + t('recapSunk', { ship: shipName(sunk[sunk.length - 1].cls) }) : '');
          }
          view.interactive = false;
          const ok = await new Promise((res) => {
            el.append(passOverlay(m.turn, recap, res));
          });
          if (!ok || !isAlive()) return;
          viewer = m.turn;
          view.setViewer(viewer);
          if (shots.length && !first) {
            view.recap = { owner: viewer, cells: shots.map((s) => s.i), t0: view.t };
            await view.setMode('defend', true);
            updateBanner();
            await view.wait(1500);
            if (!isAlive()) return;
          }
        }
        view.alert = false;
        await view.setMode('attack');
        if (!isAlive()) return;
        view.interactive = true;
        updateBanner();
        snd.sonar();
      } else {
        aiTurn();
      }
    }

    function passOverlay(player, recap, resolve) {
      const ov = h(
        'div',
        { class: 'g-naval-pass overlay' },
        h('div', { class: 'g-naval-pass-ring' }, h('span', null, '⚓')),
        h('div', { class: 'g-naval-pass-kicker' }, t('passTo')),
        h('div', { class: 'g-naval-pass-name' }, pname(player)),
        recap ? h('div', { class: 'g-naval-pass-recap' }, recap) : null,
        h('div', { class: 'g-naval-pass-sub' }, t('passTurn')),
        h(
          'button',
          {
            class: 'btn primary big',
            onclick: () => {
              play('select');
              ov.remove();
              resolve(true);
            },
          },
          t('imReady'),
        ),
        h('div', { class: 'g-naval-pass-note' }, t('passNote')),
      );
      return ov;
    }

    async function fireAt(i) {
      if (busy || m.over || !isHuman(m.turn) || !view.interactive) return;
      const def = m.boards[1 - m.turn];
      if (def.shots[i] || def.halo[i]) {
        snd.bad();
        haptic(12);
        return;
      }
      busy = true;
      view.interactive = false;
      const att = m.turn;
      const res = R.matchFire(m, i);
      if (!res) {
        busy = false;
        view.interactive = true;
        return;
      }
      turnShots.push({ i, res: res.res, cls: res.ship ? res.ship.cls : null });
      updateBanner();
      await view.shoot(att, i, res);
      if (!isAlive()) return;
      announce(res, att);
      if (res.res === 'sunk') await view.sink(1 - att, res.ship);
      if (!isAlive()) return;
      busy = false;
      if (m.over) return finish();
      store.set('match', R.serialize(m));
      if (res.turnEnds) {
        await view.wait(500);
        if (!isAlive()) return;
        R.endTurn(m);
        return beginTurn();
      }
      view.interactive = true;
      updateBanner();
    }

    async function aiTurn() {
      busy = true;
      view.interactive = false;
      view.alert = true;
      updateBanner();
      await view.wait(450);
      if (!isAlive()) return;
      await view.setMode('defend');
      snd.alarm();
      while (isAlive() && !m.over && m.turn === 1) {
        await view.wait(420 + Math.random() * 420);
        if (!isAlive()) return;
        const i = aiShot(m.cfg.ai, R.knowledge(m.boards[0]), Math.random, habits);
        const res = i >= 0 ? R.matchFire(m, i) : null;
        if (!res) break;
        updateBanner();
        await view.shoot(1, i, res);
        if (!isAlive()) return;
        announce(res, 1);
        if (res.res === 'sunk') await view.sink(0, res.ship);
        if (!isAlive()) return;
        updateBanner();
        if (m.over) {
          busy = false;
          return finish();
        }
        if (res.turnEnds) break;
      }
      await view.wait(650);
      if (!isAlive()) return;
      R.endTurn(m);
      busy = false;
      beginTurn();
    }

    async function finish() {
      store.remove('match');
      view.interactive = false;
      view.alert = false;
      updateBanner();
      await view.wait(800);
      if (!isAlive()) return;
      view.reveal = true;
      if (twoP) {
        viewer = m.winner;
        view.setViewer(viewer);
      }
      await view.setMode('attack');
      await view.wait(1100);
      if (!isAlive()) return;
      showResults(m, el);
    }

    Object.assign(testHook, { m, view, fire: (i) => fireAt(i) });
    updateBanner();
    if (fresh && !twoP) {
      callout(t('battleStart'), t('battleStartSub'), 'start');
      play('whistle');
    }
    beginTurn(true);
  }

  // ---------------------------------------------------------------- results
  function showResults(m, battleEl) {
    const twoP = m.cfg.twoP;
    const me = twoP ? m.winner : 0;
    const st = m.stats[me];
    const win = twoP ? true : m.winner === 0;
    const acc = st.shots ? st.hits / st.shots : 0;
    const ev = {
      win,
      twoP,
      ai: m.cfg.ai,
      fleet: m.cfg.fleet,
      rule: m.cfg.rule,
      shots: st.shots,
      hits: st.hits,
      acc,
      sunk: twoP ? m.stats[0].sunk + m.stats[1].sunk : st.sunk,
      lost: m.stats[1 - me].sunk,
      left: R.afloat(m.boards[me]),
      bestRun: twoP ? Math.max(m.stats[0].bestRun, m.stats[1].bestRun) : st.bestRun,
      cells: R.fleetCells(m.cfg.fleet),
    };
    // career bookkeeping
    const before = rankInfo(career.xp);
    career.matches++;
    if (twoP) career.duels++;
    else {
      if (win) {
        career.wins++;
        career.streak++;
        career.bestStreak = Math.max(career.bestStreak, career.streak);
        career.aiWins[m.cfg.ai] = (career.aiWins[m.cfg.ai] || 0) + 1;
      } else {
        career.losses++;
        career.streak = 0;
      }
      career.shots += st.shots;
      career.hits += st.hits;
      career.lost += m.stats[1].sunk;
    }
    career.sunk += ev.sunk;
    const xp = matchXP(ev);
    const newMedals = medalsFor(ev, career).filter((id, k, a) => !career.medals[id] && a.indexOf(id) === k);
    const now = Date.now();
    let medalXP = 0;
    for (const id of newMedals) {
      career.medals[id] = now;
      medalXP += MEDALS.find((x) => x.id === id).xp;
    }
    const gained = xp.total + medalXP;
    career.xp += gained;
    saveCareer();
    const after = rankInfo(career.xp);
    const unlocked = [
      ...SKIN_IDS.filter((id) => SKIN_UNLOCK[id] > before.idx && SKIN_UNLOCK[id] <= after.idx).map((id) => '🎨 ' + t('skin_' + id)),
      ...THEME_IDS.filter((id) => THEME_UNLOCK[id] > before.idx && THEME_UNLOCK[id] <= after.idx).map((id) => '🌊 ' + t('theme_' + id)),
    ];
    ctx.addXP?.(twoP ? 15 : win ? { easy: 15, medium: 20, hard: 25, admiral: 30 }[m.cfg.ai] || 20 : 10);
    if (win) {
      play('win');
      ctx.ui.confetti();
    } else play('lose');

    const title = twoP ? t('winsP', { name: pname(m.winner) }) : win ? t('victory') : t('defeat');
    const sub = twoP ? t('duelSub', { n: m.turnNo }) : win ? t('winSub', { n: Math.ceil(m.turnNo / 2) }) : t('loseSub');
    const xpNum = h('b', { class: 'g-naval-xpnum' }, '+0');
    const bar = h('i', { style: { width: Math.round(before.pct * 100) + '%' } });
    const rankLine = h('div', { class: 'g-naval-res-rank' }, h('span', { class: 'g-naval-res-badge', html: insigniaSVG(before.idx, before.stars) }), h('span', { class: 'g-naval-res-rankname' }, rankLabel(before)));
    const stat = (v, k) => h('div', { class: 'g-naval-stat' }, h('b', null, v), h('small', null, t(k)));
    const panel = h(
      'div',
      { class: `g-naval-res-panel ${win ? 'win' : 'lose'}` },
      h('div', { class: 'g-naval-res-title' }, title),
      h('div', { class: 'g-naval-res-sub' }, sub),
      twoP
        ? h('div', { class: 'g-naval-res-stats' }, stat(m.stats[0].shots, 'statShotsP1'), stat(m.stats[1].shots, 'statShotsP2'), stat(Math.round(acc * 100) + '%', 'statAccWinner'))
        : h(
            'div',
            { class: 'g-naval-res-stats' },
            stat(st.shots, 'statShots'),
            stat(st.hits, 'statHits'),
            stat(Math.round(acc * 100) + '%', 'statAcc'),
            stat(st.sunk + '/' + m.boards[1].ships.length, 'statSunk'),
            stat(m.stats[1].sunk, 'statLost'),
            stat(st.bestRun, 'statRun'),
          ),
      h(
        'div',
        { class: 'g-naval-res-xp' },
        h('div', { class: 'g-naval-res-xphead' }, h('span', null, t('careerXP')), xpNum),
        h(
          'div',
          { class: 'g-naval-res-parts' },
          xp.parts.map(([k, n]) => h('div', null, h('span', null, t(k)), h('b', null, '+' + fmt(n)))),
          newMedals.length ? h('div', null, h('span', null, t('xpMedals')), h('b', null, '+' + fmt(medalXP))) : null,
        ),
        rankLine,
        h('div', { class: 'progress g-naval-xpbar' }, bar),
      ),
      newMedals.length
        ? h(
            'div',
            { class: 'g-naval-res-medals' },
            h('div', { class: 'section-title' }, t('newMedals')),
            h('div', { class: 'g-naval-res-chips' }, newMedals.map((id) => h('span', { class: 'g-naval-medal-chip' }, MEDALS.find((x) => x.id === id).icon + ' ' + t('medal_' + id)))),
          )
        : null,
      unlocked.length
        ? h('div', { class: 'g-naval-res-medals' }, h('div', { class: 'section-title' }, t('unlocked')), h('div', { class: 'g-naval-res-chips' }, unlocked.map((u) => h('span', { class: 'g-naval-medal-chip unlock' }, u))))
        : null,
      h(
        'div',
        { class: 'g-naval-res-actions' },
        h('button', { class: 'btn primary block', onclick: () => (twoP ? startTwo() : startSingle(m.cfg.rule !== settings.rule ? m.cfg.rule : null)) }, t('rematch')),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'btn small g-naval-grow',
              onclick: () => {
                ov.classList.add('peek');
                const back = h('button', { class: 'btn primary small g-naval-peekback', onclick: () => (ov.classList.remove('peek'), back.remove()) }, t('showResults'));
                battleEl.append(back);
              },
            },
            t('viewBoards'),
          ),
          h('button', { class: 'btn small g-naval-grow', onclick: () => showMenu() }, t('menu')),
        ),
      ),
    );
    const ov = h('div', { class: 'g-naval-results' }, panel);
    battleEl.append(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    screen.back = () => {
      showMenu();
      return true;
    };
    // animate XP and rank bar
    const t0 = performance.now();
    const dur = 1400;
    let promoted = false;
    const step = (nowT) => {
      if (dead || !ov.isConnected) return;
      const k = Math.min(1, (nowT - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = career.xp - gained + gained * e;
      xpNum.textContent = '+' + fmt(gained * e);
      const ri = rankInfo(cur);
      bar.style.width = Math.round(ri.pct * 100) + '%';
      if (!promoted && (ri.idx > before.idx || ri.stars > before.stars)) {
        promoted = true;
        rankLine.querySelector('.g-naval-res-badge').innerHTML = insigniaSVG(after.idx, after.stars);
        rankLine.querySelector('.g-naval-res-rankname').textContent = rankLabel(after);
        rankLine.classList.add('promoted');
        rankLine.append(h('span', { class: 'g-naval-promo' }, t('promoted')));
        play('levelup');
      }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------- arsenal (paints & themes)
  function previewCanvas(w, hgt, draw) {
    const c = h('canvas', { class: 'g-naval-prev' });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(hgt * dpr);
    c.style.width = '100%';
    c.style.aspectRatio = `${w} / ${hgt}`;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    draw(g);
    return c;
  }

  function showArsenal() {
    const ri = rankNow();
    const el = h('div', { class: 'screen g-naval-sub' });
    const render = () => {
      clear(el);
      el.append(h('div', { class: 'page-title' }, t('arsenal')), h('div', { class: 'section-title' }, t('paints')));
      el.append(
        h(
          'div',
          { class: 'grid-2' },
          SKIN_IDS.map((id) => {
            const lock = SKIN_UNLOCK[id] > ri.idx;
            const sel = settings.skin === id;
            const cv = previewCanvas(170, 82, (g) => {
              paintWater(g, 0, 0, 170, 82, 20, settings.theme, 3, 0);
              paintShip(g, { cls: 'cruiser', len: 3, dir: 'h', r: 0, c: 0, id: 1 }, 14, 6, 44, id, { t: 0.4, wake: true });
              paintShip(g, { cls: 'destroyer', len: 2, dir: 'h', r: 0, c: 0, id: 2 }, 58, 46, 30, id, { t: 1.2, wake: true });
            });
            return h(
              'button',
              {
                class: `g-naval-item ${sel ? 'sel' : ''} ${lock ? 'locked' : ''}`,
                onclick: () => {
                  if (lock) {
                    play('error');
                    ctx.ui.toast(t('unlockAt', { rank: rankName(SKIN_UNLOCK[id]) }));
                    return;
                  }
                  settings.skin = id;
                  saveSettings();
                  play('select');
                  render();
                },
              },
              cv,
              h('b', null, t('skin_' + id)),
              h('small', null, lock ? '🔒 ' + rankName(SKIN_UNLOCK[id]) : sel ? '✓ ' + t('equipped') : t('tapEquip')),
            );
          }),
        ),
      );
      el.append(h('div', { class: 'section-title' }, t('themes')));
      el.append(
        h(
          'div',
          { class: 'grid-2' },
          THEME_IDS.map((id) => {
            const lock = THEME_UNLOCK[id] > ri.idx;
            const sel = settings.theme === id;
            const cv = previewCanvas(170, 82, (g) => {
              paintWater(g, 0, 0, 170, 82, 17, id, 2, 0);
              paintGrid(g, 0, -4, 17, id, {});
              paintMiss(g, 17 * 2.5, 17 * 1.5 - 4, 17, 0, 1);
              paintMiss(g, 17 * 6.5, 17 * 3.5 - 4, 17, 0, 2);
              paintFire(g, 17 * 4.5, 17 * 2.5 - 4, 17, 0.7, 3, 1);
            });
            return h(
              'button',
              {
                class: `g-naval-item ${sel ? 'sel' : ''} ${lock ? 'locked' : ''}`,
                onclick: () => {
                  if (lock) {
                    play('error');
                    ctx.ui.toast(t('unlockAt', { rank: rankName(THEME_UNLOCK[id]) }));
                    return;
                  }
                  settings.theme = id;
                  saveSettings();
                  play('select');
                  render();
                },
              },
              cv,
              h('b', null, t('theme_' + id)),
              h('small', null, lock ? '🔒 ' + rankName(THEME_UNLOCK[id]) : sel ? '✓ ' + t('equipped') : t('tapEquip')),
            );
          }),
        ),
      );
    };
    render();
    setScreen('arsenal', el, { back: () => (showMenu(), true) });
  }

  // ---------------------------------------------------------------- medals
  function showMedals() {
    const got = Object.keys(career.medals).length;
    const el = h(
      'div',
      { class: 'screen g-naval-sub' },
      h('div', { class: 'page-title' }, t('medals')),
      h('div', { class: 'muted small' }, t('medalsCount', { n: got, total: MEDALS.length })),
      h(
        'div',
        { class: 'list' },
        MEDALS.map((md) => {
          const has = !!career.medals[md.id];
          return h(
            'div',
            { class: `list-item g-naval-medal ${has ? 'has' : 'no'}` },
            h('div', { class: 'g-naval-medal-ico' }, md.icon),
            h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, t('medal_' + md.id)), h('div', { class: 'li-sub' }, t('medalDesc_' + md.id))),
            h('div', { class: 'li-right' }, has ? '✓' : '+' + md.xp),
          );
        }),
      ),
    );
    setScreen('medals', el, { back: () => (showMenu(), true) });
  }

  // ---------------------------------------------------------------- career
  function showCareer() {
    const ri = rankNow();
    const acc = career.shots ? Math.round((career.hits / career.shots) * 100) : 0;
    const winPct = career.wins + career.losses ? Math.round((career.wins / (career.wins + career.losses)) * 100) : 0;
    const stat = (v, k) => h('div', { class: 'g-naval-stat' }, h('b', null, v), h('small', null, t(k)));
    const el = h(
      'div',
      { class: 'screen g-naval-sub' },
      h(
        'div',
        { class: 'card g-naval-careerhead' },
        h('div', { class: 'g-naval-career-badge', html: insigniaSVG(ri.idx, ri.stars) }),
        h('div', { class: 'g-naval-hero-rank' }, rankLabel(ri)),
        h('div', { class: 'progress g-naval-xpbar' }, h('i', { style: { width: Math.round(ri.pct * 100) + '%' } })),
        h('div', { class: 'muted small' }, `${fmt(career.xp)} XP · ` + (ri.idx < TOP_RANK ? t('nextRank', { rank: rankName(ri.idx + 1) }) : t('nextStar'))),
      ),
      h(
        'div',
        { class: 'g-naval-res-stats' },
        stat(fmt(career.matches), 'cBattles'),
        stat(fmt(career.wins), 'cWins'),
        stat(winPct + '%', 'cWinPct'),
        stat(acc + '%', 'statAcc'),
        stat(fmt(career.sunk), 'cSunk'),
        stat(fmt(career.bestStreak), 'cStreak'),
      ),
      h('div', { class: 'section-title' }, t('winsByAI')),
      h(
        'div',
        { class: 'g-naval-aiwins' },
        R.AI_IDS.map((id) => h('div', null, h('b', null, fmt(career.aiWins[id] || 0)), h('small', null, aiName(id)))),
      ),
      h('div', { class: 'section-title' }, t('ranks')),
      h(
        'div',
        { class: 'list g-naval-ranks' },
        RANK_XP.map((xp, idx) =>
          h(
            'div',
            { class: `list-item g-naval-rankrow ${idx === ri.idx ? 'current' : idx > ri.idx ? 'locked' : 'done'}` },
            h('div', { class: 'g-naval-rank-ico', html: insigniaSVG(idx, 0) }),
            h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, rankName(idx)), h('div', { class: 'li-sub' }, fmt(xp) + ' XP' + unlockText(idx))),
            h('div', { class: 'li-right' }, idx <= ri.idx ? '✓' : ''),
          ),
        ),
        h(
          'div',
          { class: 'list-item g-naval-rankrow beyond' },
          h('div', { class: 'g-naval-rank-ico', html: insigniaSVG(TOP_RANK, Math.max(1, ri.stars + (ri.idx === TOP_RANK ? 1 : 0))) }),
          h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, t('beyondTitle')), h('div', { class: 'li-sub' }, t('beyondSub', { xp: fmt(STAR_XP) }))),
        ),
      ),
    );
    setScreen('career', el, { back: () => (showMenu(), true) });
  }

  function unlockText(idx) {
    const parts = [];
    for (const id of SKIN_IDS) if (SKIN_UNLOCK[id] === idx && idx > 0) parts.push('🎨 ' + t('skin_' + id));
    for (const id of THEME_IDS) if (THEME_UNLOCK[id] === idx && idx > 0) parts.push('🌊 ' + t('theme_' + id));
    return parts.length ? ' · ' + parts.join(' · ') : '';
  }

  // ---------------------------------------------------------------- icons
  const crosshairSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
  const alertSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.2" r=".9" fill="currentColor"/></svg>';

  // ---------------------------------------------------------------- back & boot
  ctx.onBack(() => {
    if (screen && screen.back) return screen.back() === true;
    if (screen && screen.name !== 'menu') {
      showMenu();
      return true;
    }
    return false;
  });

  // exposed for automated tests
  const testHook = {};
  root.__naval = {
    hook: testHook,
    get screen() {
      return screen && screen.name;
    },
    settings,
    career,
  };

  if (ctx.mode === '1p') startSingle();
  else if (ctx.mode === '2p') startTwo();
  else if (ctx.mode === 'salvo') startSingle('salvo');
  else showMenu();

  return () => {
    dead = true;
    if (screen && screen.destroy) screen.destroy();
    timers.forEach(clearTimeout);
    timers.clear();
    ctx.setHeaderRight(null);
  };
}
