// App controller: career state, navigation, table flows (career event, sit & go, quick table, tutorial).
import { h, clear } from './dom.js';
import { tabs, overlay, fmtN } from './kit.js';
import { ICON } from './icons.js';
import { createSound } from './sound.js';
import { createTableScreen } from './tablescreen.js';
import { createTournamentSession } from './tsession.js';
import { createCashSession } from './cash.js';
import { fmt } from './table.js';
import * as C from '../career/career.js';
import { loadCareer, saveCareer, validateCareer, resetCareer, loadQuick, saveQuick, recordQuickSitGo, validTournament, KEYS } from '../career/store.js';
import { EVENT_BY_ID, COACH_STEPS, quickSitGoDef, CIRCUIT_BY_ID } from '../career/circuits.js';
import { RIVALS, RIVAL_BY_ID } from '../career/rivals.js';
import { tx } from '../career/text.js';
import * as T from '../tournament/tournament.js';
import { makeProfile, randomProfile } from '../ai/profiles.js';
import { fillerName } from '../tournament/names.js';
import { mulberry32, mixSeed, randomSeed } from '../engine/rng.js';
import { FRAMES } from './avatars.js';

import homeScreen from './screens/home.js';
import mapScreen from './screens/map.js';
import eventScreen from './screens/event.js';
import rivalsScreen from './screens/rivals.js';
import rankScreen from './screens/rank.js';
import profileScreen from './screens/profile.js';
import setupScreen from './screens/setup.js';
import welcomeScreen from './screens/welcome.js';
import rulesScreen from './screens/rules.js';
import { showResults } from './screens/results.js';
import { playMoments } from './screens/moments.js';

const TAB_SCREENS = { home: homeScreen, map: mapScreen, rivals: rivalsScreen, rank: rankScreen, profile: profileScreen };
const SCREENS = { ...TAB_SCREENS, event: eventScreen, setup: setupScreen, welcome: welcomeScreen, rules: rulesScreen };

export function createApp(root, ctx, STRINGS) {
  const t = ctx.makeT(STRINGS);
  const lang = ctx.lang;
  const store = ctx.store;
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const prefsData = (() => {
    try {
      return store.get(KEYS.prefs, {}) || {};
    } catch (e) {
      return {};
    }
  })();
  const prefs = {
    get: (k) => prefsData[k],
    set: (k, v) => {
      prefsData[k] = v;
      try {
        store.set(KEYS.prefs, prefsData);
      } catch (e) {
        /* ignore */
      }
    },
  };
  const sound = createSound(ctx, prefs);

  const app = {
    ctx,
    t,
    lang,
    root,
    prefs,
    sound,
    store,
    h,
    reduce: () => reduceMq.matches,
    tx: (o) => tx(o, lang),
    career: loadCareer(store),
    quick: loadQuick(store),
    stack: [],
    tab: 'home',
    view: null,
    tabsEl: null,
    disposed: false,
    inTable: null,
    C,
    RIVALS,
    RIVAL_BY_ID,
    EVENT_BY_ID,
    CIRCUIT_BY_ID,
  };

  // ---------- layout ----------
  const shell = h('div', { class: 'pk-app' });
  const viewHost = h('div', { class: 'pk-view' });
  const tabHost = h('div', { class: 'pk-tabhost' });
  shell.append(viewHost, tabHost);
  root.append(shell);
  let current = null;

  app.saveCareer = () => {
    if (app.career) saveCareer(store, app.career);
  };
  app.saveQuick = () => saveQuick(store, app.quick);

  app.applyCosmetics = () => {
    const sel = app.career ? app.career.cosmetics.selected : {};
    const theme = sel.theme && sel.theme !== 'green' ? sel.theme : 'green';
    root.dataset.theme = theme;
    root.dataset.back = sel.back || 'classic';
    root.dataset.deck = sel.deck || 'classic';
    root.dataset.table = sel.table || 'oval';
  };
  app.heroName = () => (app.career ? app.career.profile.name : prefs.get('name') || t('you'));
  app.heroAvatar = () => (app.career ? app.career.cosmetics.selected.avatar || app.career.profile.avatar : prefs.get('avatar') || 'p1');
  app.heroFrame = () => {
    const f = app.career ? app.career.cosmetics.selected.frame : 'none';
    return f && f !== 'none' && FRAMES.includes(f) ? f : '';
  };

  function mountView(name, props) {
    if (current && current.destroy) current.destroy();
    clear(viewHost);
    const fn = SCREENS[name];
    const r = fn(app, props || {});
    current = r && r.el ? r : { el: r };
    viewHost.append(current.el);
    app.view = name;
    const isTab = !!TAB_SCREENS[name] && !(props && props.id);
    clear(tabHost);
    if (isTab && app.career) {
      app.tab = name;
      tabHost.append(
        tabs(
          [
            { id: 'home', label: t('tab.home'), icon: ICON.cards },
            { id: 'map', label: t('tab.map'), icon: ICON.map },
            { id: 'rivals', label: t('tab.rivals'), icon: ICON.swords },
            { id: 'rank', label: t('tab.rank'), icon: ICON.chart },
            { id: 'profile', label: t('tab.me'), icon: ICON.user },
          ],
          name,
          (id) => app.go(id),
        ),
      );
    }
    tabHost.hidden = !tabHost.firstChild;
  }
  app.go = (name, props) => {
    app.stack = [];
    mountView(name, props);
  };
  app.push = (name, props) => {
    app.stack.push({ name: app.view, props: current && current.props, scroll: null });
    mountView(name, props);
  };
  app.back = () => {
    const prev = app.stack.pop();
    if (prev) {
      mountView(prev.name, prev.props);
      return true;
    }
    if (app.career && app.view !== 'home') {
      app.go('home');
      return true;
    }
    return false;
  };
  app.refresh = () => mountView(app.view, current && current.props);

  // ---------- dialogs ----------
  app.confirm = (title, text, ok, { danger = false, cancel } = {}) =>
    ctx.ui.modal({ title, body: text, actions: [{ label: cancel || t('cancel2'), value: false }, { label: ok, value: true, primary: !danger, danger }] }).then((v) => !!v);

  // ---------- coach ----------
  const coachSeen = new Set((() => { try { return store.get('coachSeen', []) || []; } catch (e) { return []; } })());
  app.coachProvider = (force = false) => ({
    take(trigger) {
      const step = COACH_STEPS.find((s) => s.trigger === trigger);
      if (!step || (!force && coachSeen.has(step.id))) return null;
      coachSeen.add(step.id);
      try {
        store.set('coachSeen', [...coachSeen]);
      } catch (e) {
        /* ignore */
      }
      return { id: step.id, text: tx(step.text, lang) };
    },
  });

  // ---------- table flows ----------
  const roundText = (names) => (ev) => {
    switch (ev.t) {
      case 'level_up':
        return t('rt.level', { n: ev.level, sb: fmt(ev.blinds.sb), bb: fmt(ev.blinds.bb) });
      case 'bust': {
        if (ev.isPlayer) return null;
        if (ev.rivalId) return t('rt.bustRival', { name: names(ev.id), place: ev.place });
        return null;
      }
      case 'final_table':
        return t('rt.finalTable');
      case 'bubble':
        return t('rt.bubble');
      case 'in_the_money':
        return t('rt.itm');
      case 'player_moved':
        return ev.broken ? t('rt.moved') : t('rt.balanced');
      case 'stage':
        return ev.stage === 'day2' ? t('rt.day2') : ev.stage === 'final' ? t('rt.finalStage') : null;
      default:
        return null;
    }
  };

  const hudLabels = () => ({ blinds: t('hud.blinds'), level: t('hud.level'), players: t('hud.players'), rank: t('hud.rank'), bubble: t('hud.bubble'), inMoney: t('hud.itm'), next: t('hud.next'), ante: t('hud.ante'), avg: t('hud.avg') });

  async function runTable(sessionFactory, runOpts, { onExit } = {}) {
    app.inTable = { leave: null };
    shell.hidden = true;
    const ts = createTableScreen(root, { ctx, t, lang, prefs, sound });
    app.inTable.ts = ts;
    let leaveRequested = false;
    app.inTable.leave = async () => {
      if (leaveRequested) return true;
      const ok = await app.confirm(t('leave.title'), onExit && onExit.text ? onExit.text : t('leave.text'), t('leave.ok'), { danger: true, cancel: t('leave.stay') });
      if (ok) {
        leaveRequested = true;
        ts.destroy();
        return true;
      }
      return false;
    };
    const session = sessionFactory(ts);
    let outcome;
    try {
      outcome = await ts.run(session, runOpts);
    } catch (err) {
      console.error(err);
      outcome = 'error';
    }
    const left = leaveRequested;
    if (!left) ts.destroy();
    shell.hidden = false;
    app.inTable = null;
    return { outcome: left ? 'left' : outcome, session };
  }

  // fast-forward remaining rounds of a tournament with a progress overlay
  async function simulateWithProgress(tour) {
    if (tour.phase === 'finished') return;
    const ov = overlay(root, 'sim');
    const num = h('b', { class: 'pk-sim-n' }, String(tour.remaining));
    const ticker = h('div', { class: 'pk-ticker' });
    ov.el.append(h('div', { class: 'pk-spin' }), h('h2', {}, t('sim.title')), h('p', {}, t('sim.sub')), h('div', { class: 'pk-sim' }, h('small', {}, t('hud.players')), num), ticker);
    let shown = tour.busts.length;
    let guard = 0;
    while (tour.phase !== 'finished' && !app.disposed) {
      const t0 = performance.now();
      while (tour.phase !== 'finished' && performance.now() - t0 < 24) {
        T.startNextHand(tour, { interactive: false });
        if (++guard > 6000) break;
      }
      num.textContent = String(tour.remaining);
      for (; shown < tour.busts.length; shown++) {
        const b = tour.busts[shown];
        const e = tour.entrants.find((x) => x.id === b.id);
        if (e && (e.rivalId || b.place <= 9)) {
          ticker.prepend(h('div', { class: 'pk-tk' }, h('b', {}, b.place + 'º'), h('span', {}, e.name)));
          while (ticker.children.length > 4) ticker.lastChild.remove();
        }
      }
      await new Promise((r) => setTimeout(r, 0));
      if (guard > 6000) break;
    }
    ov.close();
    await new Promise((r) => setTimeout(r, 260));
  }
  app.simulateWithProgress = simulateWithProgress;

  async function showElimination(tour) {
    const me = T.human(tour);
    if (me.place === 1 || tour.phase === 'finished' && me.place === 1) return;
    await playMoments(app, [{ kind: 'bust', place: me.place, entrants: tour.def.entrants, by: me.bustedBy ? tour.entrants.find((x) => x.id === me.bustedBy) : null }]);
  }

  const namesOf = (tour) => (id) => {
    const e = tour.entrants.find((x) => x.id === id);
    return e ? e.name : id;
  };

  // ----- career event -----
  app.playEvent = async (eventId) => {
    const c = app.career;
    if (!c) return;
    let tour = c.tournament;
    const resume = !!tour;
    if (!tour) {
      try {
        tour = C.startEvent(c, eventId, { player: { name: c.profile.name, avatar: app.heroAvatar() } });
      } catch (e) {
        console.error(e);
        return;
      }
      app.saveCareer();
    } else eventId = c.tournamentEvent;
    const ev = EVENT_BY_ID[eventId];
    const names = namesOf(tour);
    // story intro for special events
    if (!resume && ev.story) {
      await playMoments(app, [{ kind: 'story', event: ev, intro: true }]);
    }
    if (!resume && ev.championship) await playMoments(app, [{ kind: 'ceremony', event: ev }]);
    const coachOn = ev.tutorial && !c.flags.tutorialDone;
    const res = await runTable(
      () => createTournamentSession(tour, { heroFrame: app.heroFrame(), L: hudLabels() }),
      {
        onSave: () => app.saveCareer(),
        roundText: roundText(names),
        coach: app.coachProvider(false),
        onHandEnd: () => app.saveCareer(),
        eventName: app.tx(ev.name),
      },
      { onExit: { text: t('leave.career') } },
    );
    if (res.outcome === 'left') {
      // forfeit: counts as eliminated in the current position
      await simulateForfeit(eventId);
      return;
    }
    await finishCareerEvent(eventId);
  };

  async function simulateForfeit(eventId) {
    const c = app.career;
    const tour = c.tournament;
    if (!tour) return app.go('home');
    // let the tournament finish quickly then record
    const report = C.forfeitEvent(c, { now: Date.now() });
    app.saveCareer();
    await presentReport(eventId, report, tour);
  }

  async function finishCareerEvent(eventId) {
    const c = app.career;
    const tour = c.tournament;
    if (!tour) return app.go('home');
    if (!T.human(tour).out) {
      app.saveCareer();
      return app.go('home');
    }
    await showElimination(tour);
    await simulateWithProgress(tour);
    const report = C.finishEvent(c, { now: Date.now() });
    app.saveCareer();
    await presentReport(eventId, report, tour);
  }

  async function presentReport(eventId, report, tour) {
    ctx.addXP?.(Math.max(10, Math.min(80, Math.round(report.xpGain / 6))));
    app.applyCosmetics();
    await showResults(app, { kind: 'career', eventId, report, tour });
    await playMoments(app, momentsFromReport(report, eventId));
    app.go('home');
  }

  // ----- sit & go -----
  app.playSitGo = async ({ seats = 6, difficulty = 'medium', resume = false } = {}) => {
    let tour = null;
    if (resume) {
      const raw = store.get('sitgo.run', null);
      if (raw && validQuickTour(raw)) tour = raw;
    }
    if (!tour) {
      const def = quickSitGoDef(difficulty, seats);
      tour = T.createTournament(def, { player: { id: 'hero', name: app.heroName(), avatar: app.heroAvatar() }, seed: randomSeed() });
    }
    const names = namesOf(tour);
    const save = () => {
      try {
        store.set('sitgo.run', tour);
      } catch (e) {
        /* ignore */
      }
    };
    const res = await runTable(() => createTournamentSession(tour, { heroFrame: app.heroFrame(), L: hudLabels() }), { onSave: save, onHandEnd: save, roundText: roundText(names), coach: app.coachProvider(false) }, { onExit: { text: t('leave.sitgo') } });
    try {
      store.remove('sitgo.run');
    } catch (e) {
      /* ignore */
    }
    if (res.outcome === 'left') return app.go('home');
    if (!T.human(tour).out) return app.go('home');
    await showElimination(tour);
    await simulateWithProgress(tour);
    const result = T.tournamentResult(tour);
    recordQuickSitGo(app.quick, result);
    app.saveQuick();
    ctx.addXP?.(result.place === 1 ? 35 : result.cashed ? 22 : 12);
    await showResults(app, { kind: 'sitgo', result, tour });
    app.go('home');
  };
  const validQuickTour = (raw) => {
    try {
      return raw && raw.v === 1 && raw.def && Array.isArray(raw.entrants) && raw.entrants[0]?.isPlayer && ['between', 'hand'].includes(raw.phase) && (raw.phase !== 'hand' || (raw.hand && Array.isArray(raw.hand.deck)));
    } catch (e) {
      return false;
    }
  };
  app.hasSitGoRun = () => {
    try {
      return validQuickTour(store.get('sitgo.run', null));
    } catch (e) {
      return false;
    }
  };

  // ----- quick cash table / tutorial -----
  const pools = {
    easy: ['tito', 'bartholomew', 'ingrid', 'mirella', 'koji'],
    medium: ['ingrid', 'koji', 'nadia', 'mirella', 'elena', 'bartholomew'],
    hard: ['rafa', 'celeste', 'jun', 'elena', 'nadia', 'koji'],
  };
  function buildOpponents(difficulty, n, rng) {
    const ids = pools[difficulty].slice();
    const out = [];
    while (out.length < n && ids.length) {
      const id = ids.splice(Math.floor(rng() * ids.length), 1)[0];
      const r = RIVAL_BY_ID[id];
      out.push({ id: 'r_' + id, name: r.name, avatar: r.avatar, profile: r.profile, frame: '' });
    }
    return out;
  }
  app.playQuickTable = async ({ stakes = 'low', difficulty = 'medium', tutorial = false } = {}) => {
    const seed = randomSeed();
    const rng = mulberry32(seed);
    const bb = { low: 20, mid: 100, high: 400 }[stakes] || 20;
    const seats = tutorial ? 3 : 5;
    let opps;
    if (tutorial) {
      const used = new Set([app.heroName()]);
      opps = [
        { id: 'r_tito', name: RIVAL_BY_ID.tito.name, avatar: 'tito', profile: makeProfile('rookie', { aggr: 0.3 }) },
        { id: 'f_a', name: fillerName(rng, used), avatar: 'f3', profile: makeProfile('calling_station') },
        { id: 'f_b', name: fillerName(rng, used), avatar: 'f7', profile: makeProfile('rookie') },
      ].slice(0, seats);
    } else opps = buildOpponents(difficulty, seats, rng);
    const hero = { id: 'hero', name: app.heroName(), avatar: app.heroAvatar(), frame: app.heroFrame() };
    const sess = createCashSession({ hero, opps, stack: bb * 100, sb: bb / 2, bb, seed, labels: { blinds: t('hud.blinds'), stack: t('hud.stack'), net: t('hud.net'), hand: t('hud.hand') } });
    let handsDone = 0;
    const res = await runTable(
      () => sess,
      {
        coach: app.coachProvider(tutorial),
        onHandEnd: async () => {
          handsDone++;
          if (sess.heroOut()) {
            const again = await app.confirm(t('quick.bustTitle'), t('quick.bustText'), t('quick.rebuy'), { cancel: t('quick.leave') });
            if (again) sess.rebuy();
          }
        },
        stopWhen: () => (tutorial && handsDone >= 8) || sess.heroOut(),
        tutorial,
        roundText: () => null,
      },
      { onExit: { text: tutorial ? t('leave.tutorial') : t('leave.quick') } },
    );
    const S = sess.S;
    if (!tutorial) {
      app.quick.cash.sessions++;
      app.quick.cash.hands += S.handsPlayed;
      app.quick.cash.biggestPot = Math.max(app.quick.cash.biggestPot, S.biggest);
      app.quick.cash.bestStack = Math.max(app.quick.cash.bestStack, ...S.stacks.slice(0, 1));
      app.saveQuick();
      if (S.handsPlayed >= 10) ctx.addXP?.(10);
    } else if (handsDone >= 8) {
      app.quick.tutorialDone = true;
      app.saveQuick();
      ctx.addXP?.(20);
      await playMoments(app, [{ kind: 'tutorial' }]);
    }
    app.go('home');
  };
  app.playTutorial = () => app.playQuickTable({ tutorial: true, difficulty: 'easy', stakes: 'low' });

  // ---------- helpers for screens ----------
  app.startCareer = ({ name, avatar }) => {
    app.career = C.newCareer({ name, avatar, now: Date.now() });
    app.saveCareer();
    app.applyCosmetics();
  };
  app.resetCareer = () => {
    resetCareer(store);
    app.career = null;
    store.remove?.('sitgo.run');
    app.applyCosmetics();
  };
  app.openEvent = (id) => app.push('event', { id });
  app.fmt = fmtN;

  function momentsFromReport(report, eventId) {
    const list = [];
    const ev = EVENT_BY_ID[eventId];
    const m = report.moments || [];
    if (ev.story) list.push({ kind: 'story', event: ev, outro: true, won: report.result.place === 1 });
    if (m.includes('champion')) list.push({ kind: 'champion', report });
    for (const mo of m) {
      if (mo === 'first_win') list.push({ kind: 'first_win', report });
      else if (mo === 'first_final_table') list.push({ kind: 'first_final', report });
      else if (mo === 'final_table' && !m.includes('first_final_table') && ev.championship) list.push({ kind: 'world_final_table', report });
      else if (mo.startsWith('eliminated_rival:')) list.push({ kind: 'rival_ko', rival: mo.split(':')[1], report });
      else if (mo.startsWith('circuit_unlocked:')) list.push({ kind: 'circuit', circuit: mo.split(':')[1], report });
      else if (mo === 'qualified_world') list.push({ kind: 'qualified', report });
    }
    if (report.titleWon && !report.titleWon.repeat && !m.includes('champion')) list.push({ kind: 'title', report });
    for (const id of report.storyBeats || []) list.push({ kind: 'beat', id });
    if (report.levelUp) list.push({ kind: 'level', report });
    if (report.newAchievements && report.newAchievements.length) list.push({ kind: 'achievements', ids: report.newAchievements });
    if (report.newCosmetics && report.newCosmetics.length) list.push({ kind: 'cosmetics', items: report.newCosmetics });
    if (report.seasonEnded) list.push({ kind: 'season', season: report.seasonEnded });
    return list;
  }

  app.momentsFromReport = momentsFromReport;
  app.playMoments = (list) => playMoments(app, list);
  app.showResults = (o) => showResults(app, o);

  // ---------- back button ----------
  ctx.onBack(() => {
    if (app.inTable) {
      app.inTable.leave().then((left) => {
        /* run() resolves after destroy; nothing else to do */
        return left;
      });
      return true;
    }
    return app.back();
  });

  // ---------- start ----------
  app.start = () => {
    app.applyCosmetics();
    const mode = ctx.mode;
    if (mode === 'quick') return app.go('setup', { kind: 'quick' });
    if (mode === 'sitgo') return app.go('setup', { kind: 'sitgo' });
    if (mode === 'tutorial') {
      app.go('home');
      return app.playTutorial();
    }
    if (mode === 'career') {
      if (!app.career) return app.go('welcome');
      return app.go('home');
    }
    return app.go(app.career ? 'home' : 'home');
  };

  app.destroy = () => {
    app.disposed = true;
    if (current && current.destroy) current.destroy();
    if (app.inTable && app.inTable.ts) app.inTable.ts.destroy();
    shell.remove();
  };
  void mixSeed;
  void randomProfile;
  void validateCareer;
  void validTournament;
  return app;
}
