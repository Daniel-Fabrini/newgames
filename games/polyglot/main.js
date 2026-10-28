// Polyglot — a gamified language course (pt / en / es speakers learning en, es, fr, de, it, pt).
// Structure: main.js (app shell & flow) · path.js (learn tab) · hub.js (other tabs & sheets)
// runner.js (lessons, stories, results) · lessons.js (exercise generation) · exercises.js (renderers)
// progress.js (saved state) · corpus.js (text helpers) · content/ (course data, see CONTENT.md)

import STRINGS from './strings.js';
import { UNITS, SECTIONS, loadUnit } from './content/index.js';
import { LANGS6, FLAG, primary, alts, canon, bare, buildLexicon, tokenize } from './corpus.js';
import { createState, GOALS } from './progress.js';
import { createSpeech } from './speech.js';
import { createGenerator, UNIT_NODES, NODES_PER_UNIT, chunkWordIndexes, nodeChunk } from './lessons.js';
import { runLesson, runStory, showStreak } from './runner.js';
import { mascotSVG, ICON } from './art.js';
import { renderLearn } from './path.js';
import { renderPractice, renderLeague, renderQuests, renderProfile, heartsSheet, streakSheet, shopSheet } from './hub.js';

const COURSE_ORDER = ['en', 'es', 'fr', 'de', 'it', 'pt'];
const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

function newScope(el) {
  const timers = new Set();
  const intervals = new Set();
  const rafs = new Set();
  const cleanups = [];
  let dead = false;
  return {
    el,
    later(fn, ms) {
      if (dead) return 0;
      const id = setTimeout(() => {
        timers.delete(id);
        if (!dead) fn();
      }, ms);
      timers.add(id);
      return id;
    },
    every(fn, ms) {
      if (dead) return 0;
      const id = setInterval(() => !dead && fn(), ms);
      intervals.add(id);
      return id;
    },
    raf(fn) {
      if (dead) return 0;
      const id = requestAnimationFrame((ts) => {
        rafs.delete(id);
        if (!dead) fn(ts);
      });
      rafs.add(id);
      return id;
    },
    onCleanup(fn) {
      cleanups.push(fn);
    },
    get dead() {
      return dead;
    },
    dispose() {
      if (dead) return;
      dead = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      rafs.forEach(cancelAnimationFrame);
      for (const fn of cleanups) {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      }
    },
    back: null,
    key: null,
  };
}

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h, clear, toast } = ctx.ui;
  const N = ctx.lang;
  await ctx.loadCSS(new URL('./style.css', import.meta.url));

  const S = createState(ctx.store);
  const speech = createSpeech();
  const shell = h('div', { class: 'pg-app' });
  const layer = h('div', { class: 'pg-layer' });
  root.append(shell, layer);

  const COURSES = COURSE_ORDER.filter((l) => l !== N);
  if (S.P.course && !COURSES.includes(S.P.course)) S.P.course = null;

  let scope = null;
  let sheetState = null;

  const app = {
    ctx,
    t,
    h,
    clear,
    sfx: ctx.sfx,
    speech,
    S,
    N,
    locale: LOCALES[N] || 'pt-BR',
    COURSES,
    disposed: false,
    units: new Map(),
    lex: { keep: Object.fromEntries(LANGS6.map((l) => [l, new Set()])), vocab: Object.fromEntries(LANGS6.map((l) => [l, new Set()])) },
    questDone: [],
    pendingStreak: null,
    returnTab: 'learn',
    tab: 'learn',
    celebrate: false,
    get T() {
      return S.P.course;
    },
    courseName: (l) => t('lang_' + l),
    inlineName: (l) => t('in_' + l),
    flagSrc: (code) => new URL(`../../assets/flags/${code}.svg`, import.meta.url).href,
    toast: (m) => toast(m),
    caps: () => ({ listen: speech.has(app.T) && S.listenOn(), speak: speech.canRecognize && S.speakOn() }),
  };

  // ---------- screens ----------
  app.screen = (cls = '') => {
    closeSheet();
    if (scope) {
      const old = scope.el;
      scope.dispose();
      old.remove();
    }
    speech.stop();
    const el = h('div', { class: `pg-screen ${cls} pg-enter` });
    shell.append(el);
    scope = newScope(el);
    scope.later(() => el.classList.remove('pg-enter'), 400);
    return scope;
  };

  // ---------- bottom sheets ----------
  function closeSheet() {
    if (!sheetState) return;
    const s = sheetState;
    sheetState = null;
    s.scope.dispose();
    s.overlay.classList.remove('show');
    setTimeout(() => s.overlay.remove(), 220);
  }
  app.closeSheet = closeSheet;
  app.sheet = ({ title, content, cls = '', onClose } = {}) => {
    closeSheet();
    const sc = newScope(null);
    const box = h('div', { class: `pg-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'pg-sheet-grip' }));
    if (title) box.append(h('div', { class: 'pg-sheet-head' }, h('h2', null, title), h('button', { class: 'pg-x small', 'aria-label': t('close'), html: ICON.close, onclick: () => closeSheet() })));
    const bodyEl = h('div', { class: 'pg-sheet-body' });
    box.append(bodyEl);
    const overlay = h('div', { class: 'pg-sheet-ov' }, box);
    overlay.addEventListener('click', (e) => e.target === overlay && closeSheet());
    layer.append(overlay);
    sheetState = { overlay, scope: sc };
    sc.el = bodyEl;
    sc.onCleanup(() => onClose && onClose());
    if (typeof content === 'function') content(bodyEl, sc);
    else if (content) bodyEl.append(content);
    requestAnimationFrame(() => overlay.classList.add('show'));
    return { close: closeSheet, body: bodyEl, scope: sc };
  };

  // ---------- flying word tiles ----------
  app.fly = (rect, to, label, done) => {
    const b = to.getBoundingClientRect();
    if (!document.body.animate || !rect.width || !b.width) {
      done();
      return;
    }
    const ghost = h('div', { class: 'pg-tile pg-fly' }, label);
    Object.assign(ghost.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    layer.append(ghost);
    const anim = ghost.animate(
      [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${(b.left - rect.left) / 2}px, ${(b.top - rect.top) / 2 - 18}px) scale(1.06)`, offset: 0.5 }, { transform: `translate(${b.left - rect.left}px, ${b.top - rect.top}px) scale(1)` }],
      { duration: 240, easing: 'cubic-bezier(.3,.7,.4,1)' },
    );
    let fin = false;
    const end = () => {
      if (fin) return;
      fin = true;
      ghost.remove();
      done();
    };
    anim.onfinish = end;
    anim.oncancel = end;
    setTimeout(end, 400);
  };

  // ---------- content loading ----------
  let allPromise = null;
  app.ensureUnits = () => {
    if (!allPromise) {
      const ready = UNITS.filter((u) => u.ready);
      allPromise = Promise.allSettled(ready.map((u) => loadUnit(u.id))).then((res) => {
        res.forEach((r, i) => {
          if (r.status === 'fulfilled') app.units.set(ready[i].id, r.value);
          else console.warn('polyglot: unit failed to load', ready[i].id, r.reason);
        });
        app.lex = buildLexicon([...app.units.values()]);
        buildHints();
        return app.units;
      });
    }
    return allPromise;
  };
  let hintMap = new Map();
  function buildHints() {
    hintMap = new Map();
    const T = app.T;
    if (!T) return;
    for (const u of app.units.values()) {
      for (const w of u.words) {
        const gloss = primary(w[N]);
        for (const a of alts(w[T])) {
          const b = bare(a, T);
          if (tokenize(b).length !== 1) continue;
          const c = canon(b, T);
          if (!hintMap.has(c)) hintMap.set(c, gloss);
        }
      }
    }
  }
  app.hint = (word) => hintMap.get(canon(word, app.T)) || null;
  // Ready units in course order (registry order), only those that loaded.
  app.readyUnits = () => UNITS.filter((u) => u.ready && (!allPromise || app.units.has(u.id) || app.units.size === 0));
  app.sections = SECTIONS;

  // ---------- course state helpers ----------
  app.unitIndex = (id) => app.readyUnits().findIndex((u) => u.id === id);
  // First incomplete node in the course: { unit, k } or { legend: sectionId } or null when finished.
  app.currentNode = () => {
    const c = S.course(app.T);
    for (const sec of SECTIONS) {
      const us = app.readyUnits().filter((u) => u.section === sec.id);
      if (!us.length) continue;
      for (const u of us) if ((c.done[u.id] || 0) < NODES_PER_UNIT) return { unit: u, k: c.done[u.id] || 0 };
      if (!c.legend[sec.id]) return { legend: sec.id };
    }
    return null;
  };
  app.unlockedUnits = () => {
    const cur = app.currentNode();
    const list = app.readyUnits();
    if (!cur) return list;
    if (cur.legend) return list.filter((u) => u.section <= cur.legend);
    return list.slice(0, Math.max(1, list.indexOf(cur.unit) + 1));
  };
  app.prevUnits = (id) => {
    const list = app.readyUnits();
    const i = list.findIndex((u) => u.id === id);
    return list
      .slice(0, Math.max(0, i))
      .reverse()
      .map((u) => app.units.get(u.id))
      .filter(Boolean);
  };
  app.generator = () => createGenerator({ T: app.T, N, lex: app.lex, can: app.caps() });

  app.quest = (type, amount) => {
    const done = S.questEvent(type, amount, app.caps());
    for (const q of done) app.questDone.push(q);
  };

  app.award = ({ xp = 0, gems = 0, hearts = 0, perfect = false, lesson = false, ms = 0 }) => {
    const T = app.T;
    S.markStarted(T);
    if (xp) {
      S.addXP(xp, T);
      if (ctx.addXP) {
        try {
          ctx.addXP(xp);
        } catch (e) {
          console.error(e);
        }
      }
      app.quest('xp', xp);
    }
    if (gems) S.addGems(gems);
    if (hearts) S.addHearts(hearts);
    if (lesson) {
      S.P.stats.lessons++;
      const c = S.course(T);
      c.lessons++;
      S.saveCourse(T);
      app.quest('lessons', 1);
    }
    if (perfect) {
      S.P.stats.perfect++;
      app.quest('perfect', 1);
    }
    if (ms) {
      S.P.stats.ms += ms;
      app.quest('minutes', ms / 60000);
    }
    const st = S.recordDay();
    if (st.extended) app.pendingStreak = st;
    S.save();
  };
  app.questExtras = () => {
    const list = app.questDone.splice(0);
    return list.map((q) => ({ icon: '🎯', text: t('questDoneLine', { q: app.questText(q) }) }));
  };
  app.questText = (q) => t('q_' + q.id, { n: q.target });

  app.afterLesson = () => {
    if (app.pendingStreak) {
      const st = app.pendingStreak;
      app.pendingStreak = null;
      showStreak(app, st.from, st.to, () => app.goHome(app.returnTab));
    } else app.goHome(app.returnTab);
  };

  // ---------- starting activities ----------
  function needHearts() {
    if (S.hearts() > 0) return true;
    heartsSheet(app);
    return false;
  }
  async function withUnits() {
    await app.ensureUnits();
    buildHints();
    return !app.disposed;
  }

  // node: { unit (registry entry), k } ; replay: already completed
  app.startNode = async (node, replay = false) => {
    const kind = UNIT_NODES[node.k];
    if (kind === 'chest') return;
    if (kind !== 'story' && !needHearts()) return;
    if (!(await withUnits())) return;
    const unit = app.units.get(node.unit.id);
    if (!unit) return toast(t('loadFail'));
    app.returnTab = 'learn';
    const T = app.T;
    if (kind === 'story') {
      // Units with several stories (role-play units) play them back to back.
      const play = (i) =>
        runStory(app, unit, unit.stories[i], {
          onComplete: () => {
            const last = i >= unit.stories.length - 1;
            if (!replay && last) completeNode(node);
            return { xp: replay ? 5 : 10, gems: replay ? 0 : 5, after: last ? undefined : () => play(i + 1) };
          },
        });
      return play(0);
    }
    const gen = app.generator();
    const prev = app.prevUnits(unit.id);
    const exercises = gen.lesson(kind, unit, node.k, prev);
    const review = kind === 'review';
    runLesson(app, {
      mode: 'lesson',
      exercises,
      units: [unit, ...prev],
      gen,
      hearts: true,
      xpBase: replay ? 5 : review ? 15 : 10,
      perfectBonus: replay ? 0 : 5,
      gems: replay ? 0 : review ? 10 : 5,
      perfectGems: replay ? 0 : 5,
      onComplete: () => {
        const extra = [];
        if (!replay) {
          if (kind === 'words') S.learnWords(T, chunkWordIndexes(unit, nodeChunk(node.k)).map((i) => ({ u: unit.id, i })));
          completeNode(node);
          if (review) extra.push({ icon: '🏆', text: t('unitComplete', { name: ctx.pick(node.unit.title) }) });
        }
        return { extra: [...extra, ...app.questExtras()] };
      },
    });
  };
  function completeNode(node) {
    const c = S.course(app.T);
    c.done[node.unit.id] = Math.max(c.done[node.unit.id] || 0, node.k + 1);
    S.saveCourse(app.T);
    app.celebrate = true;
  }
  app.completeNode = completeNode;

  app.startLegend = async (secId, replay = false) => {
    if (!needHearts()) return;
    if (!(await withUnits())) return;
    const units = app.readyUnits().filter((u) => u.section === secId).map((u) => app.units.get(u.id)).filter(Boolean);
    if (!units.length) return;
    const gen = app.generator();
    app.returnTab = 'learn';
    runLesson(app, {
      mode: 'legend',
      exercises: gen.legend(units, 16),
      units,
      gen,
      hearts: true,
      xpBase: replay ? 10 : 40,
      gems: replay ? 0 : 30,
      onComplete: () => {
        const extra = [];
        if (!replay) {
          const c = S.course(app.T);
          c.legend[secId] = true;
          S.saveCourse(app.T);
          S.P.stats.legendary++;
          app.celebrate = true;
          extra.push({ icon: '👑', text: t('sectionComplete', { n: secId }) });
        }
        return { title: t('legendDone'), extra: [...extra, ...app.questExtras()] };
      },
    });
  };

  // Placement / "jump here" test: pass → every unit of the earlier sections is completed.
  app.startTest = async (secId) => {
    if (!(await withUnits())) return;
    const units = app.readyUnits().filter((u) => u.section < secId).map((u) => app.units.get(u.id)).filter(Boolean);
    if (!units.length) return;
    const gen = app.generator();
    app.returnTab = 'learn';
    runLesson(app, {
      mode: 'test',
      exercises: gen.legend(units, 15),
      units,
      gen,
      hearts: false,
      maxMistakes: 3,
      xpBase: 20,
      onComplete: () => {
        const c = S.course(app.T);
        for (const u of app.readyUnits()) if (u.section < secId) c.done[u.id] = NODES_PER_UNIT;
        for (const s of SECTIONS) if (s.id < secId) c.legend[s.id] = true;
        for (const u of units) S.learnWords(app.T, u.words.map((_, i) => ({ u: u.id, i })));
        S.saveCourse(app.T);
        app.celebrate = true;
        return { title: t('testPassed'), extra: [{ icon: '🚀', text: t('jumpedTo', { n: secId }) }, ...app.questExtras()] };
      },
    });
  };

  app.startPractice = async (mode) => {
    if (!(await withUnits())) return;
    const units = app.unlockedUnits().map((u) => app.units.get(u.id)).filter(Boolean);
    if (!units.length) return;
    const gen = app.generator();
    const T = app.T;
    const weak = S.weakWords(T, 10);
    const c = S.course(T);
    const opts = { weak, mistakes: c.mistakes };
    let exercises = gen.practice(mode === 'endless' ? 'mix' : mode, units, opts);
    if (mode === 'mistakes' && exercises.length < 4) exercises = exercises.concat(gen.practice('mix', units, opts)).slice(0, 10);
    if (!exercises.length) return toast(t('nothingToPractice'));
    app.returnTab = app.tab === 'learn' ? 'learn' : 'practice';
    runLesson(app, {
      mode: mode === 'endless' ? 'endless' : 'practice',
      exercises,
      more: () => gen.practice('mix', units, { weak: S.weakWords(T, 10) }),
      units,
      gen,
      hearts: false,
      xpBase: 10,
      heartReward: mode === 'endless' ? 0 : 1,
      onComplete: () => ({ extra: app.questExtras() }),
    });
  };

  app.startStoryReplay = async (unitId, si = 0) => {
    if (!(await withUnits())) return;
    const unit = app.units.get(unitId);
    if (!unit || !unit.stories[si]) return;
    app.returnTab = 'practice';
    runStory(app, unit, unit.stories[si], { onComplete: () => ({ xp: 5, gems: 0 }) });
  };

  app.setCourse = (T) => {
    S.P.course = T;
    S.save();
    buildHints();
  };

  // ---------- HUD & home ----------
  let hudRefs = null;
  app.refreshHud = () => {
    if (!hudRefs || !hudRefs.el.isConnected) return;
    const st = S.streak();
    hudRefs.streak.lastChild.textContent = st;
    hudRefs.streak.classList.toggle('off', !S.practicedToday());
    hudRefs.gems.lastChild.textContent = S.P.gems;
    hudRefs.hearts.lastChild.textContent = S.hearts();
    if (hudRefs.flag) hudRefs.flag.src = app.flagSrc(FLAG[app.T]);
  };
  function hud() {
    const pill = (cls, icon, onclick, label) => h('button', { class: `pg-pill ${cls}`, onclick, 'aria-label': label }, h('span', { class: 'pg-pill-ico' }, icon), h('b', null, ''));
    const flag = h('img', { src: app.flagSrc(FLAG[app.T]), alt: '' });
    const flagBtn = h('button', { class: 'pg-hudflag', 'aria-label': t('switchCourse'), onclick: () => app.openCourses() }, flag);
    const streak = pill('streak', '🔥', () => streakSheet(app), t('streak'));
    const gems = pill('gems', '💎', () => shopSheet(app), t('gems'));
    const hearts = pill('hearts', '❤️', () => heartsSheet(app), t('hearts'));
    const el = h('div', { class: 'pg-hud' }, flagBtn, h('div', { class: 'pg-hud-pills' }, streak, gems, hearts));
    hudRefs = { el, streak, gems, hearts, flag };
    return el;
  }

  const TABS = [
    ['learn', 'home', 'tabLearn', renderLearn],
    ['practice', 'dumbbell', 'tabPractice', renderPractice],
    ['league', 'shield', 'tabLeague', renderLeague],
    ['quests', 'target', 'tabQuests', renderQuests],
    ['profile', 'user', 'tabProfile', renderProfile],
  ];
  app.goHome = (tab = 'learn') => {
    if (!app.T) return app.openCourses({ first: true });
    const sc = app.screen('pg-home');
    const body = h('div', { class: 'pg-tabbody' });
    const bar = h('nav', { class: 'pg-tabs' });
    sc.el.append(hud(), body, bar);
    let sub = null;
    const btns = {};
    for (const [id, icon, label] of TABS) {
      btns[id] = h(
        'button',
        { class: 'pg-tab', onclick: () => setTab(id), 'aria-label': t(label) },
        h('span', { class: 'pg-tab-ico', html: ICON[icon] }),
        h('small', null, t(label)),
      );
      bar.append(btns[id]);
    }
    function setTab(id) {
      if (sub) sub.dispose();
      app.tab = id;
      for (const k in btns) btns[k].classList.toggle('on', k === id);
      clear(body);
      body.scrollTop = 0;
      sub = newScope(body);
      const tabDef = TABS.find((x) => x[0] === id);
      const inner = h('div', { class: `pg-tab-${id} pg-fadein` });
      body.append(inner);
      sub.el = inner;
      sub.body = body;
      tabDef[3](app, sub);
      app.refreshHud();
    }
    sc.onCleanup(() => sub && sub.dispose());
    sc.every(() => app.refreshHud(), 15000);
    sc.back = () => {
      if (app.tab !== 'learn') {
        setTab('learn');
        return true;
      }
      return false;
    };
    app.setTab = setTab;
    setTab(tab);
    showNotices();
  };

  // One-time notices (streak freeze used / lost, league results).
  function showNotices() {
    const sn = S.takeStreakNotice();
    if (sn) {
      app.sheet({
        content: (b) =>
          b.append(
            h('div', { class: 'pg-notice' }, h('div', { class: 'pg-notice-ico' }, sn.type === 'frozen' ? '❄️' : '💔'), h('h2', null, t(sn.type === 'frozen' ? 'freezeUsed' : 'streakLost', { n: sn.n })), h('p', null, t(sn.type === 'frozen' ? 'freezeUsedText' : 'streakLostText')),
              h('button', { class: 'pg-btn gold big block', onclick: () => app.closeSheet() }, t('continue'))),
          ),
      });
      return;
    }
    const ln = S.takeLeagueNotice();
    if (ln) {
      const up = ln.to > ln.from;
      const down = ln.to < ln.from;
      app.sheet({
        content: (b) =>
          b.append(
            h('div', { class: 'pg-notice' }, h('div', { class: 'pg-notice-ico' }, up ? '🚀' : down ? '📉' : '🛡️'), h('h2', null, t('leagueResult', { n: ln.rank })),
              h('p', null, up ? t('promoted', { name: t('tier' + ln.to) }) : down ? t('demoted', { name: t('tier' + ln.to) }) : t('stayed', { name: t('tier' + ln.to) })),
              ln.gems ? h('p', { class: 'pg-gold' }, t('gemsEarned', { n: ln.gems })) : null,
              h('button', { class: 'pg-btn gold big block', onclick: () => app.closeSheet() }, t('continue'))),
          ),
      });
      if (up) ctx.ui.confetti(80);
    }
  }

  // ---------- course picker (first screen) ----------
  app.openCourses = ({ first = false } = {}) => {
    const sc = app.screen('pg-courses');
    const bubbles = ['gb', 'es', 'de', 'fr', 'it'].map((code, i) =>
      h('div', { class: `pg-fbub b${i}` }, h('img', { src: app.flagSrc(code), alt: '' })),
    );
    const hero = h('div', { class: 'pg-hero' }, h('div', { class: 'pg-rays' }), bubbles, h('div', { class: 'pg-hero-mascot', html: mascotSVG({ mood: 'happy', book: true }) }));
    const rows = COURSES.map((l) =>
      h(
        'button',
        { class: `pg-langrow ${l === app.T ? 'cur' : ''}`, onclick: () => chooseCourse(l) },
        h('span', { class: 'pg-rflag' }, h('img', { src: app.flagSrc(FLAG[l]), alt: '' })),
        h('span', { class: 'pg-lname' }, app.courseName(l)),
        h('span', { class: 'pg-chev', html: ICON.chevron }),
      ),
    );
    rows.push(
      h(
        'button',
        { class: 'pg-langrow more', onclick: () => moreLanguages() },
        h('span', { class: 'pg-rflag globe', html: ICON.globe }),
        h('span', { class: 'pg-lname' }, t('moreLangs')),
        h('span', { class: 'pg-chev', html: ICON.chevron }),
      ),
    );
    sc.el.append(h('div', { class: 'pg-courses-in' }, hero, h('p', { class: 'pg-tagline' }, t('tagline')), h('div', { class: 'pg-langlist' }, rows)));
    sc.back = () => {
      if (first || !app.T) return false;
      app.goHome();
      return true;
    };
  };
  function moreLanguages() {
    const soon = [
      ['ja', 'jp'],
      ['ko', 'kr'],
      ['zh', 'cn'],
      ['ru', 'ru'],
      ['nl', 'nl'],
      ['tr', 'tr'],
      ['ar', 'sa'],
      ['sv', 'se'],
    ];
    app.sheet({
      title: t('moreLangsTitle'),
      content: (b) =>
        b.append(
          h('p', { class: 'pg-muted' }, t('moreLangsText')),
          h(
            'div',
            { class: 'pg-langlist soon' },
            soon.map(([l, f]) =>
              h('div', { class: 'pg-langrow disabled' }, h('span', { class: 'pg-rflag' }, h('img', { src: app.flagSrc(f), alt: '' })), h('span', { class: 'pg-lname' }, t('soon_' + l)), h('span', { class: 'pg-soon' }, t('soon'))),
            ),
          ),
        ),
    });
  }
  function chooseCourse(l) {
    app.sfx.play('select');
    const fresh = !S.P.courses[l] && !Object.keys(S.course(l).done).length;
    app.setCourse(l);
    if (fresh) courseIntro(l);
    else app.goHome('learn');
  }

  // New course: daily goal + where to start.
  function courseIntro(l) {
    const sc = app.screen('pg-intro');
    let goal = S.P.goal || 20;
    const goalBtns = GOALS.map((g, i) =>
      h(
        'button',
        {
          class: `pg-goalopt ${g === goal ? 'on' : ''}`,
          onclick: (e) => {
            goal = g;
            S.P.goal = g;
            S.save();
            sc.el.querySelectorAll('.pg-goalopt').forEach((x) => x.classList.toggle('on', x === e.currentTarget));
            app.sfx.play('tap');
          },
        },
        h('b', null, t('goal' + i)),
        h('span', null, t('perDay', { n: g })),
      ),
    );
    const startCard = (icon, title, sub, fn) => h('button', { class: 'pg-startcard', onclick: fn }, h('span', { class: 'pg-sc-ico' }, icon), h('span', null, h('b', null, title), h('small', null, sub)), h('span', { class: 'pg-chev', html: ICON.chevron }));
    const hasSec2 = UNITS.some((u) => u.ready && u.section === 2) && UNITS.some((u) => u.ready && u.section === 1);
    sc.el.append(
      h(
        'div',
        { class: 'pg-intro-in' },
        h('div', { class: 'pg-intro-top' }, h('div', { class: 'pg-intro-mascot', html: mascotSVG({ mood: 'cheer' }) }), h('div', { class: 'pg-speech' }, t('introHello', { lang: app.inlineName(l) }))),
        h('h2', { class: 'pg-h2' }, t('chooseGoal')),
        h('div', { class: 'pg-goalopts' }, goalBtns),
        h('h2', { class: 'pg-h2' }, t('whereStart')),
        startCard('🌱', t('fromScratch'), t('fromScratchSub'), () => app.goHome('learn')),
        hasSec2 ? startCard('🧭', t('findLevel'), t('findLevelSub'), () => app.startTest(2)) : null,
      ),
    );
    sc.back = () => {
      app.openCourses();
      return true;
    };
  }

  // ---------- global input ----------
  const onKey = (e) => {
    if (sheetState) {
      if (e.key === 'Escape') closeSheet();
      return;
    }
    if (scope && scope.key) scope.key(e);
  };
  window.addEventListener('keydown', onKey);
  const offVoices = speech.onVoices(() => {
    if (scope && app.tab === 'practice' && scope.el.classList.contains('pg-home') && app.setTab) app.setTab('practice');
  });

  ctx.onBack(() => {
    if (sheetState) {
      closeSheet();
      return true;
    }
    if (scope && scope.back) return scope.back() === true;
    return false;
  });

  // ---------- boot ----------
  S.checkStreak();
  S.league();
  app.ensureUnits();
  if (app.T) app.goHome('learn');
  else app.openCourses({ first: true });

  return () => {
    app.disposed = true;
    closeSheet();
    if (scope) scope.dispose();
    window.removeEventListener('keydown', onKey);
    offVoices();
    speech.dispose();
  };
}
