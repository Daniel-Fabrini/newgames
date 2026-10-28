// Practice, League, Quests and Profile tabs + bottom sheets (hearts, streak, shop, guidebook).

import { UNITS, SECTIONS } from './content/index.js';
import { FLAG, primary, display } from './corpus.js';
import { NODES_PER_UNIT } from './lessons.js';
import { mascotSVG, ICON } from './art.js';
import { speakerButton, sentenceView } from './exercises.js';
import { fmtTime } from './runner.js';
import {
  MAX_HEARTS,
  REFILL_COST,
  FREEZE_COST,
  MAX_FREEZES,
  GOALS,
  ACHIEVEMENTS,
  LEAGUE_TIERS,
  QUESTS,
  dayKey,
  addDays,
  weekStartKey,
  parseDay,
} from './progress.js';

const TIER_ICONS = ['🥉', '🥈', '🥇', '💠', '💎', '🔮', '🏅', '👑'];

function heartsRow(app, n) {
  const { h } = app;
  return h(
    'div',
    { class: 'pg-hearts-row' },
    Array.from({ length: MAX_HEARTS }, (_, i) => h('span', { class: i < n ? 'on' : 'off' }, '❤️')),
  );
}

// ---------------------------------------------------------------- sheets
export function heartsSheet(app) {
  const { h, t, S } = app;
  app.sheet({
    title: t('hearts'),
    content: (b, sc) => {
      const timer = h('div', { class: 'pg-muted center' });
      const refill = h('button', { class: 'pg-btn gold big block' }, t('refillFor', { n: REFILL_COST }), ' 💎');
      const render = () => {
        const n = S.hearts();
        app.clear(b);
        timer.textContent = n >= MAX_HEARTS ? t('heartsFull') : t('nextHeartIn', { t: fmtTime(S.nextHeartMs()) });
        refill.disabled = n >= MAX_HEARTS;
        b.append(
          heartsRow(app, n),
          timer,
          h('p', { class: 'pg-muted center small' }, t('heartsInfo')),
          refill,
          h(
            'button',
            {
              class: 'pg-btn dark big block',
              onclick: () => {
                app.closeSheet();
                app.startPractice('mix');
              },
            },
            t('practiceEarnHeart'),
          ),
        );
      };
      refill.onclick = () => {
        if (!S.refill()) return app.toast(t(S.hearts() >= MAX_HEARTS ? 'heartsFull' : 'notEnoughGems'));
        app.sfx.play('levelup');
        app.refreshHud();
        render();
      };
      render();
      sc.every(() => {
        timer.textContent = S.hearts() >= MAX_HEARTS ? t('heartsFull') : t('nextHeartIn', { t: fmtTime(S.nextHeartMs()) });
      }, 1000);
    },
  });
}

export function streakSheet(app) {
  const { h, t, S } = app;
  app.sheet({
    title: t('streak'),
    content: (b) => {
      const n = S.streak();
      b.append(
        h('div', { class: 'pg-streak-big' }, h('span', { class: S.practicedToday() ? '' : 'off' }, '🔥'), h('b', null, n), h('small', null, t('streakDaysShort', { n }))),
        h('p', { class: 'pg-muted center' }, S.practicedToday() ? t('streakSafe') : t('streakTodo')),
        calendar(app),
        h(
          'div',
          { class: 'pg-freeze' },
          h('span', { class: 'pg-fz-ico' }, '❄️'),
          h('div', null, h('b', null, t('freezeTitle')), h('small', null, t('freezeEquipped', { n: S.P.streak.freezes, max: MAX_FREEZES }))),
          h(
            'button',
            {
              class: 'pg-btn gold small',
              disabled: S.P.streak.freezes >= MAX_FREEZES,
              onclick: () => {
                if (!S.buyFreeze()) return app.toast(t(S.P.streak.freezes >= MAX_FREEZES ? 'freezeMax' : 'notEnoughGems'));
                app.sfx.play('coin');
                app.refreshHud();
                streakSheet(app);
              },
            },
            `${FREEZE_COST} 💎`,
          ),
        ),
        h('p', { class: 'pg-muted small center' }, t('bestStreak', { n: S.P.streak.best })),
      );
    },
  });
}

// Month calendar with practiced / frozen days.
function calendar(app) {
  const { h, S } = app;
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const fmt = new Intl.DateTimeFormat(app.locale, { weekday: 'narrow' });
  const monthRaw = new Intl.DateTimeFormat(app.locale, { month: 'long', year: 'numeric' }).format(today);
  const month = monthRaw.charAt(0).toLocaleUpperCase() + monthRaw.slice(1);
  const grid = h('div', { class: 'pg-cal-grid' });
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 0, 1 + i);
    grid.append(h('small', null, fmt.format(d)));
  }
  for (let i = 0; i < offset; i++) grid.append(h('span'));
  const tk = dayKey();
  for (let d = 1; d <= days; d++) {
    const k = dayKey(new Date(today.getFullYear(), today.getMonth(), d));
    const did = S.dayDone(k);
    const fz = S.dayFrozen(k);
    grid.append(h('span', { class: `pg-cal-d ${did ? 'did' : ''} ${fz ? 'fz' : ''} ${k === tk ? 'today' : ''}` }, fz ? '❄' : String(d)));
  }
  return h('div', { class: 'pg-cal' }, h('div', { class: 'pg-cal-month' }, month), grid);
}

export function shopSheet(app) {
  const { h, t, S } = app;
  app.sheet({
    title: t('shop'),
    content: (b) => {
      const item = (icon, title, sub, price, disabled, fn) =>
        h(
          'div',
          { class: 'pg-shopitem' },
          h('span', { class: 'pg-si-ico' }, icon),
          h('div', null, h('b', null, title), h('small', null, sub)),
          h('button', { class: 'pg-btn gold small', disabled, onclick: fn }, `${price} 💎`),
        );
      b.append(
        h('div', { class: 'pg-gembal' }, h('span', null, '💎'), h('b', null, S.P.gems), h('small', null, t('gems'))),
        item('❤️', t('refillHearts'), t('refillHeartsSub'), REFILL_COST, S.hearts() >= MAX_HEARTS, () => {
          if (!S.refill()) return app.toast(t('notEnoughGems'));
          app.sfx.play('levelup');
          app.refreshHud();
          shopSheet(app);
        }),
        item('❄️', t('freezeTitle'), t('freezeEquipped', { n: S.P.streak.freezes, max: MAX_FREEZES }), FREEZE_COST, S.P.streak.freezes >= MAX_FREEZES, () => {
          if (!S.buyFreeze()) return app.toast(t('notEnoughGems'));
          app.sfx.play('coin');
          app.refreshHud();
          shopSheet(app);
        }),
        h('p', { class: 'pg-muted small center' }, t('gemsInfo')),
      );
    },
  });
}

// Inline **bold** and {lang} in tip texts.
function richText(app, text) {
  const { h } = app;
  const s = String(text).replace(/\{lang\}/g, app.inlineName(app.T));
  const out = h('p', { class: 'pg-tip-body' });
  s.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) out.append(h('b', null, part.slice(2, -2)));
    else if (part) out.append(part);
  });
  return out;
}

export async function guideSheet(app, entry) {
  const { h, t, ctx } = app;
  const T = app.T;
  const N = app.N;
  const sheet = app.sheet({ title: t('guidebook'), cls: 'tall', content: (b) => b.append(h('div', { class: 'pg-spinner' })) });
  await app.ensureUnits();
  const unit = app.units.get(entry.id);
  if (!unit || app.disposed || !sheet.body.isConnected) return;
  const env = { h, t, T, speech: app.speech, hint: app.hint, later: sheet.scope.later };
  const b = sheet.body;
  app.clear(b);
  b.append(h('div', { class: 'pg-guide-head' }, h('span', { class: 'pg-guide-emoji' }, entry.emoji), h('div', null, h('b', null, ctx.pick(entry.title)), h('small', null, ctx.pick(entry.desc)))));
  const tips = unit.tips.filter((tp) => !tp.for || tp.for.includes(T));
  if (tips.length) {
    b.append(h('div', { class: 'pg-h3' }, t('grammarTips')));
    for (const tp of tips) {
      b.append(
        h(
          'div',
          { class: 'pg-tipcard' },
          h('b', { class: 'pg-tip-title' }, ctx.pick(tp.title)),
          richText(app, ctx.pick(tp.body)),
          (tp.examples || []).map((ex) =>
            h('div', { class: 'pg-phrase' }, speakerButton(env, ex[T], T), h('div', null, sentenceView(env, ex[T], T), h('small', null, ex[N]))),
          ),
        ),
      );
    }
  }
  const keys = unit.sentences.filter((s) => s.key);
  if (keys.length) {
    b.append(h('div', { class: 'pg-h3' }, t('keyPhrases')));
    for (const s of keys) {
      const txt = primary(s[T]);
      b.append(h('div', { class: 'pg-phrase' }, speakerButton(env, txt, T), h('div', null, sentenceView(env, txt, T), h('small', null, primary(s[N])))));
    }
  }
  b.append(h('div', { class: 'pg-h3' }, t('wordsTitle')));
  b.append(
    h(
      'div',
      { class: 'pg-wordgrid' },
      unit.words.map((w) => {
        const txt = primary(w[T]);
        return h(
          'button',
          { class: 'pg-wordcell', onclick: () => app.speech.speak(txt, T) },
          h('span', { class: 'pg-wc-e' }, w.e || '•'),
          h('span', { class: 'pg-wc-t', lang: T }, display(txt, T)),
          h('small', null, primary(w[N])),
        );
      }),
    ),
  );
  if (!app.speech.has(T)) b.append(h('p', { class: 'pg-muted small center' }, t('noVoice')));
}

// ---------------------------------------------------------------- Practice tab
export function renderPractice(app, sc) {
  const { h, t, S } = app;
  const T = app.T;
  const c = S.course(T);
  const caps = app.caps();
  const n = S.hearts();
  const timer = h('small', null, '');
  const tick = () => (timer.textContent = S.hearts() >= MAX_HEARTS ? t('heartsFull') : t('nextHeartIn', { t: fmtTime(S.nextHeartMs()) }));
  tick();
  sc.every(tick, 1000);
  const learned = Object.keys(c.srs).length;
  const weak = S.weakWords(T, 8).filter((w) => w.s < 0.55);
  const row = (icon, title, sub, fn, disabled) =>
    h(
      'button',
      { class: 'pg-row', onclick: fn, disabled },
      h('span', { class: 'pg-row-ico' }, icon),
      h('span', { class: 'pg-row-body' }, h('b', null, title), h('small', null, sub)),
      h('span', { class: 'pg-chev', html: ICON.chevron }),
    );
  sc.el.append(
    h('div', { class: 'pg-tabtitle' }, h('h1', null, t('practiceHub')), h('p', null, t('practiceHubSub'))),
    h(
      'div',
      { class: 'pg-card pg-heartcard', onclick: () => heartsSheet(app) },
      heartsRow(app, n),
      timer,
    ),
  );
  // personalized review
  const wcard = h(
    'div',
    { class: 'pg-card pg-weak' },
    h('div', { class: 'pg-weak-head' }, h('b', null, t('weakWords')), h('span', { class: 'pg-pillsm' }, t('learnedN', { n: learned }))),
  );
  if (learned) {
    const chips = h('div', { class: 'pg-weak-chips' });
    app.ensureUnits().then(() => {
      if (sc.dead) return;
      for (const w of weak.length ? weak : S.weakWords(T, 6)) {
        const u = app.units.get(w.u);
        if (!u || !u.words[w.i]) continue;
        const word = u.words[w.i];
        chips.append(
          h(
            'span',
            { class: 'pg-wchip' },
            word.e ? h('i', null, word.e) : null,
            primary(word[T]),
            h('span', { class: 'pg-str' }, h('i', { style: { width: Math.round(w.s * 100) + '%' } })),
          ),
        );
      }
    });
    wcard.append(
      chips,
      h('button', { class: 'pg-btn gold block', onclick: () => app.startPractice('words') }, weak.length ? t('reviewWeak', { n: weak.length }) : t('reviewWords')),
    );
  } else wcard.append(h('p', { class: 'pg-muted small' }, t('noWordsYet')));
  sc.el.append(wcard);
  sc.el.append(
    h(
      'div',
      { class: 'pg-rows' },
      row('💪', t('pMix'), t('pMixSub'), () => app.startPractice('mix')),
      row('♾️', t('pEndless'), t('pEndlessSub'), () => app.startPractice('endless')),
      row('🎧', t('pListen'), caps.listen ? t('pListenSub') : t(app.speech.has(T) ? 'listenPaused' : 'noVoice'), () => app.startPractice('listen'), !caps.listen),
      row('🎙️', t('pSpeak'), caps.speak ? t('pSpeakSub') : t(app.speech.canRecognize ? (S.P.micDenied ? 'micDeniedShort' : 'speakPaused') : 'noMic'), () => app.startPractice('speak'), !caps.speak),
      row('🩹', t('pMistakes'), c.mistakes.length ? t('pMistakesSub', { n: c.mistakes.length }) : t('pNoMistakes'), () => app.startPractice('mistakes'), !c.mistakes.length),
    ),
  );
  // stories of unlocked units
  const storyBox = h('div', { class: 'pg-rows' });
  sc.el.append(h('div', { class: 'pg-h3' }, t('storiesTitle')), storyBox);
  const unlocked = app.unlockedUnits().filter((u) => (c.done[u.id] || 0) >= 6);
  if (!unlocked.length) storyBox.append(h('p', { class: 'pg-muted small' }, t('noStoriesYet')));
  app.ensureUnits().then(() => {
    if (sc.dead) return;
    for (const entry of unlocked) {
      const u = app.units.get(entry.id);
      if (!u) continue;
      u.stories.forEach((st, si) =>
        storyBox.append(
          row(
            Object.values(st.cast)[0].emoji,
            display(primary(st.title[T]), T),
            `${app.ctx.pick(entry.title)} · ${primary(st.title[app.N])}`,
            () => app.startStoryReplay(u.id, si),
          ),
        ),
      );
    }
  });
}

// ---------------------------------------------------------------- League tab
export function renderLeague(app, sc) {
  const { h, t, S } = app;
  const L = S.league();
  const board = S.board();
  const wk = weekStartKey();
  const end = parseDay(addDays(wk, 7)).getTime();
  const left = end - Date.now();
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  sc.el.append(
    h(
      'div',
      { class: 'pg-league-head' },
      h('div', { class: `pg-shield t${L.tier}` }, h('span', null, TIER_ICONS[L.tier])),
      h('h1', null, t('leagueName', { name: t('tier' + L.tier) })),
      h('p', null, L.tier < LEAGUE_TIERS - 1 ? t('leaguePromo') : t('leagueTop')),
      h('div', { class: 'pg-pillsm' }, '⏳ ', days > 0 ? t('daysLeft', { d: days, h: hours }) : t('hoursLeft', { h: hours })),
    ),
  );
  if (!S.weekXP()) sc.el.append(h('div', { class: 'pg-card pg-cta' }, h('span', null, '🛡️'), h('p', null, t('leagueJoin'))));
  const list = h('div', { class: 'pg-board' });
  board.forEach((r, i) => {
    const rank = i + 1;
    if (rank === 6 && L.tier < LEAGUE_TIERS - 1) list.append(h('div', { class: 'pg-zone up' }, '▲ ', t('promoZone')));
    if (rank === 16 && L.tier > 0) list.append(h('div', { class: 'pg-zone down' }, '▼ ', t('demoZone')));
    list.append(
      h(
        'div',
        { class: `pg-brow ${r.me ? 'me' : ''} ${rank <= 3 ? 'top' : ''}` },
        h('span', { class: 'pg-rank' }, rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank),
        h('span', { class: 'pg-bava' }, r.me ? h('span', { class: 'pg-bava-me', html: mascotSVG() }) : r.avatar),
        h('span', { class: 'pg-bname' }, r.me ? t('you') : r.name),
        h('span', { class: 'pg-bxp' }, `${r.xp} XP`),
      ),
    );
  });
  sc.el.append(list);
  sc.later(() => {
    const me = list.querySelector('.me');
    if (me && me.offsetTop > sc.body.clientHeight * 0.6) sc.body.scrollTop = me.offsetTop - sc.body.clientHeight / 2;
  }, 50);
}

// ---------------------------------------------------------------- Quests tab
export function renderQuests(app, sc) {
  const { h, t, S } = app;
  const list = S.quests(app.caps());
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const left = h('span', null, '');
  const tick = () => {
    const ms = midnight - Date.now();
    left.textContent = t('questsReset', { h: Math.floor(ms / 3600000), m: Math.floor((ms % 3600000) / 60000) });
  };
  tick();
  sc.every(tick, 30000);
  sc.el.append(
    h(
      'div',
      { class: 'pg-tabtitle quests' },
      h('div', { class: 'pg-tt-art', html: mascotSVG({ mood: 'cheer' }) }),
      h('div', null, h('h1', null, t('dailyQuests')), h('p', null, left)),
    ),
  );
  const box = h('div', { class: 'pg-quests' });
  const render = () => {
    app.clear(box);
    for (const q of list) {
      const def = QUESTS[q.id];
      const done = q.p >= q.target;
      const shown = Math.floor(q.p);
      const chest = h(
        'button',
        {
          class: `pg-qchest ${done && !q.claimed ? 'ready' : ''} ${q.claimed ? 'claimed' : ''}`,
          disabled: !done || q.claimed,
          'aria-label': t('claim'),
          onclick: () => {
            const g = S.claimQuest(q);
            if (!g) return;
            chest.classList.add('opening');
            app.sfx.play('coin');
            app.ctx.ui.confetti(40);
            app.toast(t('gemsEarned', { n: g }));
            app.refreshHud();
            sc.later(render, 700);
          },
        },
        q.claimed ? '✅' : '🎁',
      );
      box.append(
        h(
          'div',
          { class: `pg-quest ${done ? 'done' : ''}` },
          h('span', { class: 'pg-q-ico' }, def.icon),
          h(
            'div',
            { class: 'pg-q-body' },
            h('b', null, app.questText(q)),
            h('div', { class: 'pg-qbar' }, h('i', { style: { width: `${Math.min(100, (100 * q.p) / q.target)}%` } }), h('span', null, `${Math.min(shown, q.target)}/${q.target}`)),
          ),
          chest,
        ),
      );
    }
  };
  render();
  sc.el.append(box, h('p', { class: 'pg-muted small center' }, t('questsInfo')));
}

// ---------------------------------------------------------------- Profile tab
export function renderProfile(app, sc) {
  const { h, t, S, ctx } = app;
  const T = app.T;
  const lv = S.level();
  sc.el.append(
    h(
      'div',
      { class: 'pg-prof-head' },
      h('div', { class: 'pg-prof-ava', html: mascotSVG({ mood: 'happy' }) }, h('span', { class: 'pg-lvl' }, lv.level)),
      h(
        'div',
        { class: 'pg-prof-txt' },
        h('h1', null, t('levelN', { n: lv.level })),
        h('div', { class: 'pg-bar' }, h('i', { style: { width: `${(100 * lv.into) / lv.need}%` } })),
        h('small', null, t('xpToNext', { a: lv.into, b: lv.need })),
      ),
    ),
  );
  const stat = (icon, val, label) => h('div', { class: 'pg-stat' }, h('span', null, icon), h('b', null, val), h('small', null, label));
  const st = S.P.stats;
  const acc = st.exercises ? Math.round((100 * st.correct) / st.exercises) : 0;
  sc.el.append(
    h(
      'div',
      { class: 'pg-stats' },
      stat('🔥', S.streak(), t('statStreak')),
      stat('🏅', S.P.streak.best, t('statBest')),
      stat('⚡', S.P.xp, t('statXp')),
      stat('🧠', S.totalWords(), t('statWords')),
      stat('📘', st.lessons, t('statLessons')),
      stat('🎯', acc + '%', t('statAccuracy')),
    ),
  );
  // weekly chart
  const chart = h('div', { class: 'pg-chart' });
  const fmt = new Intl.DateTimeFormat(app.locale, { weekday: 'short' });
  const vals = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(dayKey(), -i);
    vals.push({ k, v: S.P.days[k] || 0, d: parseDay(k) });
  }
  const max = Math.max(S.P.goal, ...vals.map((x) => x.v));
  for (const x of vals) {
    chart.append(
      h(
        'div',
        { class: `pg-col ${x.v >= S.P.goal ? 'hit' : ''}` },
        h('span', { class: 'pg-col-v' }, x.v || ''),
        h('div', { class: 'pg-col-track' }, h('i', { style: { height: `${(100 * x.v) / max}%` } }), h('span', { class: 'pg-gl', style: { bottom: `${(100 * S.P.goal) / max}%` } })),
        h('small', null, fmt.format(x.d).replace('.', '')),
      ),
    );
  }
  sc.el.append(h('div', { class: 'pg-card' }, h('div', { class: 'pg-h3 in' }, t('weekXp')), chart));
  // daily goal
  const goals = h(
    'div',
    { class: 'pg-goalopts compact' },
    GOALS.map((g, i) =>
      h(
        'button',
        {
          class: `pg-goalopt ${g === S.P.goal ? 'on' : ''}`,
          onclick: () => {
            S.P.goal = g;
            S.save();
            app.sfx.play('tap');
            app.setTab('profile');
          },
        },
        h('b', null, t('goal' + i)),
        h('span', null, t('perDay', { n: g })),
      ),
    ),
  );
  sc.el.append(h('div', { class: 'pg-h3' }, t('dailyGoal')), goals);
  // achievements
  const grid = h('div', { class: 'pg-achs' });
  for (const a of ACHIEVEMENTS) {
    const s = S.achievement(a);
    grid.append(
      h(
        'button',
        { class: `pg-ach ${s.tier ? 'got' : ''}`, onclick: () => achSheet(app, a) },
        h('span', { class: 'pg-ach-medal' }, a.icon, s.tier ? h('em', null, s.tier) : null),
        h('b', null, t('ach_' + a.id)),
        h('span', { class: 'pg-achbar' }, h('i', { style: { width: `${s.max ? 100 : Math.min(100, (100 * s.value) / s.next)}%` } })),
        h('small', null, s.max ? t('maxed') : `${Math.min(s.value, s.next)}/${s.next}`),
      ),
    );
  }
  sc.el.append(h('div', { class: 'pg-h3' }, t('achievements')), grid);
  // courses
  const courses = h('div', { class: 'pg-rows' });
  for (const l of app.COURSES) {
    const c = S.course(l);
    if (!S.P.courses[l] && l !== T) continue;
    const ready = UNITS.filter((u) => u.ready);
    const doneU = ready.filter((u) => (c.done[u.id] || 0) >= NODES_PER_UNIT).length;
    courses.append(
      h(
        'button',
        {
          class: `pg-row ${l === T ? 'cur' : ''}`,
          onclick: () => {
            app.setCourse(l);
            app.goHome('learn');
          },
        },
        h('span', { class: 'pg-rflag sm' }, h('img', { src: app.flagSrc(FLAG[l]), alt: '' })),
        h('span', { class: 'pg-row-body' }, h('b', null, app.courseName(l)), h('small', null, t('courseLine', { xp: c.xp, u: doneU, total: UNITS.length }))),
        h('span', { class: 'pg-chev', html: ICON.chevron }),
      ),
    );
  }
  courses.append(
    h(
      'button',
      { class: 'pg-row', onclick: () => app.openCourses() },
      h('span', { class: 'pg-row-ico' }, '➕'),
      h('span', { class: 'pg-row-body' }, h('b', null, t('addCourse'))),
      h('span', { class: 'pg-chev', html: ICON.chevron }),
    ),
  );
  sc.el.append(h('div', { class: 'pg-h3' }, t('myCourses')), courses);
  // settings
  const sw = (on, label, sub, fn, disabled) =>
    h(
      'div',
      { class: 'pg-setrow' },
      h('div', null, h('b', null, label), sub ? h('small', null, sub) : null),
      h('button', {
        class: `pg-switch ${on ? 'on' : ''}`,
        role: 'switch',
        'aria-checked': String(on),
        'aria-label': label,
        disabled,
        onclick: () => {
          fn();
          S.save();
          app.sfx.play('tap');
          app.setTab('profile');
        },
      }),
    );
  const P = S.P;
  sc.el.append(
    h('div', { class: 'pg-h3' }, t('settings')),
    h(
      'div',
      { class: 'pg-card pg-settings' },
      sw(P.settings.autoplay, t('setAutoplay'), t('setAutoplaySub'), () => (P.settings.autoplay = !P.settings.autoplay)),
      sw(P.settings.listen, t('setListen'), app.speech.has(T) ? t('voiceLine', { v: app.speech.voiceName(T) }) : t('noVoice'), () => {
        P.settings.listen = !P.settings.listen;
        P.listenOff = 0;
      }),
      sw(
        P.settings.speak && !P.micDenied,
        t('setSpeak'),
        app.speech.canRecognize ? (P.micDenied ? t('micDeniedShort') : t('setSpeakSub')) : t('noMic'),
        () => {
          if (P.micDenied) {
            P.micDenied = false;
            P.settings.speak = true;
          } else P.settings.speak = !P.settings.speak;
          P.speakOff = 0;
        },
        !app.speech.canRecognize,
      ),
    ),
    h(
      'button',
      {
        class: 'pg-btn ghost danger block',
        onclick: async () => {
          const ok = await ctx.ui.modal({
            title: t('resetCourseTitle'),
            body: t('resetCourseText', { lang: app.courseName(T) }),
            actions: [
              { label: t('reset'), value: true, danger: true },
              { label: t('cancel'), value: false },
            ],
          });
          if (!ok || app.disposed) return;
          S.resetCourse(T);
          app.goHome('learn');
        },
      },
      t('resetCourse'),
    ),
  );
  void SECTIONS;
}

function achSheet(app, a) {
  const { h, t, S } = app;
  const s = S.achievement(a);
  app.sheet({
    content: (b) =>
      b.append(
        h(
          'div',
          { class: 'pg-notice' },
          h('div', { class: `pg-ach-medal big ${s.tier ? 'got' : ''}` }, a.icon),
          h('h2', null, t('ach_' + a.id)),
          h('p', null, t('achd_' + a.id, { n: s.max ? a.tiers[a.tiers.length - 1] : s.next })),
          h('div', { class: 'pg-tiers' }, a.tiers.map((x, i) => h('span', { class: i < s.tier ? 'on' : '' }, x))),
          h('button', { class: 'pg-btn gold big block', onclick: () => app.closeSheet() }, t('continue')),
        ),
      ),
  });
}
