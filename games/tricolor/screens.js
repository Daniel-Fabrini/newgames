// Menu-type screens: home, mode select, rules, themes, how to play, stats, ranking, achievements, audio, confirm.
import { h } from '../../js/core/ui.js';
import { crest, trophy, stadiumStrip, ico, crowdSil } from './art.js';
import { LADDER, SAFE_STEPS, MODES, THEMES, QUICK_TIMERS, TIME_ATTACK, MIN_BANK_TO_PLAY, MASTERY } from './config.js';
import { money } from './prizes.js';
import { ACHIEVEMENTS, completedThemes, themeDone, hitRate, avgSeconds, liveStreak } from './stats.js';
import { dayKey } from './session.js';
import { CAT_IDS } from './questions/schema.js';

const MODE_ICON = { main: 'trophy', quick: 'bolt', themes: 'list', time: 'clock', daily: 'calendar', expert: 'grad' };
const fmtDur = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const fmtScore = (app, mode, v) => (MODES[mode].ladder ? money(v, app.lang) : `${v} ${app.t('pts')}`);
export { fmtDur };

const iconBtn = (name, label, cls, onclick) => h('button', { class: cls, onclick, html: ico(name) + (label ? `<span>${label}</span>` : '') });
const backRow = (app, title, onBack) =>
  h('div', { class: 'tc-top' }, h('button', { class: 'tc-round', 'aria-label': app.t('back'), onclick: onBack, html: ico('back') }), h('div', { class: 'tc-top-title' }, title), h('span', { class: 'tc-round ghost' }));

export function confirmBox(app, { title, text, yes, no, danger = false }) {
  const s = app.sheets.open({
    title,
    body: h('p', { class: 'tc-sheet-text' }, text),
    actions: [
      { label: no, value: false },
      { label: yes, value: true, primary: true },
    ],
    dismissible: true,
    cls: danger ? 'danger' : '',
  });
  return s.done.then((v) => v === true);
}

// ------------------------------------------------------------------ home
export function home(app) {
  const { t, bank } = app;
  const ok = bank.length >= MIN_BANK_TO_PLAY;
  app.show(
    (el, sc) => {
      const resumeSt = app.getResume();
      el.classList.add('tc-home');
      el.append(
        h('div', { class: 'tc-hero' },
          h('div', { class: 'tc-crest', html: crest({ stars: true }) }),
          h('h1', { class: 'tc-title' }, h('span', { class: 'tc-t1' }, 'TRICOLOR'), h('span', { class: 'tc-t2' }, t('title2'))),
          h('p', { class: 'tc-slogan' }, t('slogan')),
        ),
        h('div', { class: 'tc-stage' },
          h('div', { class: 'tc-banner l' }, h('span', null, t('banner1'))),
          h('div', { class: 'tc-banner r' }, h('span', null, t('banner2'))),
          h('div', { class: 'tc-podium' }, h('div', { class: 'tc-glowring' }), h('div', { class: 'tc-trophy', html: trophy() }), h('div', { class: 'tc-plate' })),
        ),
        h('div', { class: 'tc-homebtns' },
          h('button', { class: 'tc-btn red big play', disabled: !ok, onclick: () => (resumeSt ? askResume(app, resumeSt, () => modes(app)) : modes(app)), html: `<span class="tc-playdot">${ico('play')}</span><b>${resumeSt ? t('continue') : t('play')}</b>` }),
          h('div', { class: 'tc-grid2' },
            iconBtn('hat', t('howto'), 'tc-btn dark small', () => howTo(app)),
            iconBtn('bars', t('ranking'), 'tc-btn dark small', () => ranking(app)),
            iconBtn('trophy', t('achievements'), 'tc-btn dark small', () => achievements(app)),
            iconBtn('bars', t('stats'), 'tc-btn dark small', () => stats(app)),
          ),
          h('p', { class: 'tc-count' }, ok ? t('count', { n: bank.length }) : t('buildingBank', { n: bank.length, min: MIN_BANK_TO_PLAY })),
          h('p', { class: 'tc-unofficial' }, t('unofficial')),
        ),
      );
      void sc;
    },
    { bgMode: 'home', scene: 'menu', back: () => false },
  );
}

export function askResume(app, st, onNew) {
  const t = app.t;
  const s = app.sheets.open({
    title: t('resume.title'),
    body: h('p', { class: 'tc-sheet-text' }, t('resume.text', { mode: t(`mode.${st.mode}`), n: st.qs.length })),
    actions: [
      { label: t('resume.new'), value: 'new' },
      { label: t('resume.go'), value: 'go', primary: true },
    ],
    dismissible: true,
  });
  s.done.then((v) => {
    if (v === 'go') app.resume(st);
    else if (v === 'new') {
      app.clearResume();
      onNew();
    }
  });
}

// ------------------------------------------------------------------ mode select
export function modes(app) {
  const { t } = app;
  app.show(
    (el) => {
      el.classList.add('tc-modes');
      const row = (id, primary) =>
        h('button', { class: `tc-mode ${primary ? 'primary' : ''}`, onclick: () => enterMode(app, id), html: `<span class="ic">${ico(MODE_ICON[id])}</span><span class="tx"><b>${t(`mode.${id}`)}</b><small>${t(`mode.${id}.sub`)}</small></span>` });
      el.append(
        h('div', { class: 'tc-mhead' },
          h('button', { class: 'tc-round', 'aria-label': t('back'), onclick: () => home(app), html: ico('back') }),
          h('div', { class: 'tc-crest sm', html: crest({ stars: true }) }),
          h('span', { class: 'tc-round ghost' }),
        ),
        h('h2', { class: 'tc-h2' }, t('chooseMode')),
        h('div', { class: 'tc-modelist' }, row('main', true), row('quick'), row('themes'), row('time')),
        h('div', { class: 'tc-modelist two' }, row('daily'), row('expert')),
        h('div', { class: 'tc-striplab' },
          h('div', { html: stadiumStrip() }),
          h('div', { class: 'tc-striptxt' }, h('b', null, 'MORUMBI'), h('small', null, t('morumbiTag'))),
        ),
      );
    },
    { bgMode: 'stands', scene: 'menu', back: () => (home(app), true) },
  );
}

/** a mode chosen from the lobby/menu: resume check → rules / options / themes / daily */
export function enterMode(app, mode) {
  const go = () => {
    if (mode === 'themes') return themesGrid(app);
    if (mode === 'daily') return dailyScreen(app);
    return rules(app, mode);
  };
  const r = app.getResume();
  if (r && r.mode === mode) {
    modes(app); // behind the sheet, so "back" has somewhere to go
    askResume(app, r, go);
    return;
  }
  go();
}

// ------------------------------------------------------------------ rules
function rulesList(app, mode) {
  const { t } = app;
  const M = MODES[mode];
  const items = [];
  if (M.ladder) {
    items.push(t('rules.ladder', { n: M.total }), t('rules.safe', { a: money(LADDER[SAFE_STEPS[0] - 1], app.lang), b: money(LADDER[SAFE_STEPS[1] - 1], app.lang) }), t('rules.wrong'), t('rules.stop'), t('rules.confirm'));
    if (mode === 'expert') items.push(t('rules.expert'));
  } else if (mode === 'time') items.push(t('rules.time', { s: TIME_ATTACK.seconds, p: TIME_ATTACK.wrongPenalty, b: TIME_ATTACK.streakBonus, e: TIME_ATTACK.streakBonusEvery }));
  else if (mode === 'quick') items.push(t('rules.quick'));
  else if (mode === 'themes') items.push(t('rules.themes'));
  else if (mode === 'daily') items.push(t('rules.daily'));
  const L = M.lifelines;
  const names = ['fifty', 'crowd', 'phone', 'swap'].filter((k) => L[k] > 0).map((k) => t(`life.${k}`));
  items.push(names.length ? t('rules.lifelines', { list: names.join(', ') }) : t('rules.nolife'));
  return items;
}

export function rules(app, mode, opts = {}) {
  const { t } = app;
  const M = MODES[mode];
  let timer = opts.timer ?? 0;
  app.show(
    (el, sc) => {
      el.classList.add('tc-rules');
      const chips = h('div', { class: 'tc-chips' });
      if (mode === 'quick') {
        QUICK_TIMERS.forEach((s) => {
          const b = h('button', { class: `tc-chip ${s === timer ? 'on' : ''}`, onclick: () => { timer = s; [...chips.children].forEach((c, i) => c.classList.toggle('on', QUICK_TIMERS[i] === s)); } }, s ? t('timerSec', { s }) : t('noTimer'));
          chips.append(b);
        });
      }
      const body = h('div', { class: 'tc-card' },
        h('h3', null, t('rulesTitle')),
        h('ul', { class: 'tc-ul' }, rulesList(app, mode).map((x) => h('li', null, x))),
        mode === 'quick' ? h('div', { class: 'tc-opt' }, h('b', null, t('timerLabel')), chips) : null,
      );
      const mini = M.ladder ? miniLadder(app) : null;
      el.append(
        backRow(app, t(`mode.${mode}`), () => modes(app)),
        h('div', { class: 'tc-scroll' }, body, mini),
        h('div', { class: 'tc-foot' }, h('button', { class: 'tc-btn red big', onclick: () => app.start(mode, { timer }) }, t('start'))),
      );
      void sc;
    },
    { bgMode: 'stands', scene: 'menu', back: () => (modes(app), true) },
  );
}

function miniLadder(app) {
  const wrap = h('div', { class: 'tc-mini' });
  [...LADDER.keys()].reverse().forEach((i) => {
    const step = i + 1;
    wrap.append(h('div', { class: `tc-mrow ${SAFE_STEPS.includes(step) ? 'safe' : ''} ${step === 15 ? 'top' : ''}` }, h('span', null, step), h('b', null, money(LADDER[i], app.lang)), SAFE_STEPS.includes(step) ? h('i', { html: ico('lock') }) : null));
  });
  return wrap;
}

// ------------------------------------------------------------------ themes
export function themesGrid(app) {
  const { t, bank } = app;
  app.show(
    (el) => {
      el.classList.add('tc-themes');
      const grid = h('div', { class: 'tc-themegrid' });
      for (const th of THEMES) {
        const n = bank.filter((q) => th.cats.includes(q.cat)).length;
        const done = themeDone(app.P, th.id);
        const have = Math.min(app.P.themeRight[th.id] || 0, MASTERY.theme);
        grid.append(
          h('button', { class: `tc-theme ${done ? 'done' : ''}`, disabled: n < 5, onclick: () => app.start('themes', { themeId: th.id }), html: `<span class="ic">${ico(th.icon)}</span><b>${t(`theme.${th.id}`)}</b><small>${t('themeInfo', { n, k: have, m: MASTERY.theme })}</small>${done ? `<i class="ok">${ico('check')}</i>` : ''}` }),
        );
      }
      el.append(backRow(app, t('themesTitle'), () => modes(app)), h('div', { class: 'tc-scroll' }, grid, h('p', { class: 'tc-note' }, t('themesNote', { m: MASTERY.theme }))));
    },
    { bgMode: 'stands', scene: 'menu', back: () => (modes(app), true) },
  );
}

// ------------------------------------------------------------------ daily
export function dailyScreen(app) {
  const { t } = app;
  const key = dayKey();
  const played = app.daily.hist[key];
  app.show(
    (el) => {
      el.classList.add('tc-rules');
      const streak = liveStreak(app.daily, key);
      el.append(
        backRow(app, t('mode.daily'), () => modes(app)),
        h('div', { class: 'tc-scroll' },
          h('div', { class: 'tc-card' },
            h('h3', null, t('dailyToday', { d: new Date().toLocaleDateString(app.lang === 'pt' ? 'pt-BR' : app.lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'long' }) })),
            h('ul', { class: 'tc-ul' }, rulesList(app, 'daily').map((x) => h('li', null, x))),
            h('div', { class: 'tc-kv' },
              h('div', null, h('small', null, t('dailyStreak')), h('b', null, `${streak} 🔥`)),
              h('div', null, h('small', null, t('dailyBest')), h('b', null, app.daily.best || 0)),
            ),
            played ? h('p', { class: 'tc-done' }, t('dailyDone', { s: played.score, c: played.correct, n: played.total })) : null,
          ),
        ),
        h('div', { class: 'tc-foot' }, played ? h('button', { class: 'tc-btn dark big', onclick: () => modes(app) }, t('dailyBack')) : h('button', { class: 'tc-btn red big', onclick: () => app.start('daily') }, t('start'))),
      );
    },
    { bgMode: 'stands', scene: 'menu', back: () => (modes(app), true) },
  );
}

// ------------------------------------------------------------------ how to play (+ Ajuda do Tricolor)
export function howTo(app) {
  const { t } = app;
  app.show(
    (el) => {
      el.classList.add('tc-rules');
      el.append(
        backRow(app, t('howto'), () => home(app)),
        h('div', { class: 'tc-scroll' },
          h('div', { class: 'tc-card' }, h('h3', null, t('rulesTitle')), h('ul', { class: 'tc-ul' }, rulesList(app, 'main').map((x) => h('li', null, x)))),
          h('h3', { class: 'tc-h3' }, t('help.title')),
          lifelineRows(app, null),
          h('p', { class: 'tc-note' }, t('modesNote')),
        ),
      );
    },
    { bgMode: 'dim', scene: 'menu', back: () => (home(app), true) },
  );
}

const LIFE_ICON = { fifty: 'fifty', crowd: 'crowd', phone: 'phone', swap: 'swap' };
/** rows of the "Ajuda do Tricolor" panel. `onUse(name)` makes the rows tappable; `left` = remaining uses */
export function lifelineRows(app, onUse, left = null) {
  const { t } = app;
  return h('div', { class: 'tc-lrows' },
    ['fifty', 'crowd', 'phone', 'swap'].map((k) => {
      const n = left ? left[k] || 0 : null;
      const off = left && n <= 0;
      const ic = k === 'fifty' ? '<b class="f5">50:50</b>' : ico(LIFE_ICON[k]);
      return h('button', { class: `tc-lrow ${off ? 'off' : ''}`, disabled: !onUse || off, onclick: () => onUse && onUse(k), html: `<span class="ci">${ic}</span><span class="tx"><b>${t(`life.${k}.n`)}</b><small>${t(`life.${k}.d`)}</small></span>${left ? `<em>${n > 0 ? `×${n}` : t('life.used')}</em>` : ''}` });
    }),
  );
}

// ------------------------------------------------------------------ stats / ranking / achievements
export function stats(app) {
  const { t, P } = app;
  app.show(
    (el) => {
      el.classList.add('tc-rules');
      const rows = [
        [t('st.games'), P.games],
        [t('st.completed'), P.completed],
        [t('st.hit'), `${hitRate(P)}%`],
        [t('st.best'), money(P.bestPrize, app.lang)],
        [t('st.answered'), P.answered],
        [t('st.correct'), P.correct],
        [t('st.streak'), P.bestStreak],
        [t('st.avg'), P.answered ? `${avgSeconds(P).toFixed(1)} s` : '—'],
        [t('st.distinct'), P.rightIds.length],
        [t('st.themes'), `${completedThemes(P)}/${THEMES.length}`],
        [t('st.wins'), P.wins],
      ];
      const recs = Object.keys(MODES).map((m) => [t(`mode.${m}`), P.rec[m] ? fmtScore(app, m, P.rec[m].best) : '—']);
      const cats = CAT_IDS.map((c) => [t(`cat.${c}`), P.catRight[c] || 0]).filter((x) => x[1] > 0);
      el.append(
        backRow(app, t('stats'), () => home(app)),
        h('div', { class: 'tc-scroll' },
          h('div', { class: 'tc-panel' }, rows.map(([k, v]) => h('div', { class: 'tc-row' }, h('span', null, k), h('b', null, v)))),
          h('h3', { class: 'tc-h3' }, t('st.records')),
          h('div', { class: 'tc-panel' }, recs.map(([k, v]) => h('div', { class: 'tc-row' }, h('span', null, k), h('b', null, v)))),
          cats.length ? h('h3', { class: 'tc-h3' }, t('st.cats')) : null,
          cats.length ? h('div', { class: 'tc-panel' }, cats.map(([k, v]) => h('div', { class: 'tc-row' }, h('span', null, k), h('b', null, v)))) : null,
          h('p', { class: 'tc-note' }, t('localOnly')),
        ),
      );
    },
    { bgMode: 'dim', scene: 'menu', back: () => (home(app), true) },
  );
}

export function ranking(app, mode = 'main') {
  const { t, P } = app;
  app.show(
    (el) => {
      el.classList.add('tc-rules');
      const list = P.ranks[mode] || [];
      const tabs = h('div', { class: 'tc-chips wrap' }, Object.keys(MODES).map((m) => h('button', { class: `tc-chip ${m === mode ? 'on' : ''}`, onclick: () => ranking(app, m) }, t(`mode.${m}`))));
      const loc = app.lang === 'pt' ? 'pt-BR' : app.lang === 'es' ? 'es-ES' : 'en-US';
      el.append(
        backRow(app, t('ranking'), () => home(app)),
        h('div', { class: 'tc-scroll' },
          tabs,
          list.length
            ? h('div', { class: 'tc-panel' }, list.map((r, i) => h('div', { class: `tc-row rk ${i === 0 ? 'first' : ''}` }, h('i', null, i + 1), h('span', null, h('b', null, fmtScore(app, mode, r.score)), h('small', null, `${r.correct}/${r.answered} · ${fmtDur(r.ms)} · ${new Date(r.at).toLocaleDateString(loc)}`)), r.won ? h('em', null, '🏆') : null)))
            : h('p', { class: 'tc-empty' }, t('rank.empty')),
          h('p', { class: 'tc-note' }, t('localOnly')),
        ),
      );
    },
    { bgMode: 'dim', scene: 'menu', back: () => (home(app), true) },
  );
}

export function achievements(app) {
  const { t, P } = app;
  app.show(
    (el) => {
      el.classList.add('tc-rules');
      const n = ACHIEVEMENTS.filter((a) => P.ach[a.id]).length;
      el.append(
        backRow(app, t('achievements'), () => home(app)),
        h('div', { class: 'tc-scroll' },
          h('p', { class: 'tc-count' }, t('ach.count', { n, m: ACHIEVEMENTS.length })),
          h('div', { class: 'tc-achgrid' }, ACHIEVEMENTS.map((a) => h('div', { class: `tc-ach ${P.ach[a.id] ? 'on' : ''}` }, h('span', { class: 'ai' }, P.ach[a.id] ? a.icon : '🔒'), h('b', null, t(`ach.${a.id}.n`)), h('small', null, t(`ach.${a.id}.d`, { lib: MASTERY.lib, mor: MASTERY.morumbi, mem: MASTERY.memory }))))),
        ),
      );
    },
    { bgMode: 'dim', scene: 'menu', back: () => (home(app), true) },
  );
}

// ------------------------------------------------------------------ audio sheet
export function audioSheet(app) {
  const { t, audio } = app;
  const mk = (ch) => {
    const on = h('input', { type: 'checkbox', class: 'tc-sw', 'aria-label': t(`audio.${ch}`), onchange: (e) => audio.setOn(ch, e.target.checked) });
    on.checked = audio.prefs.on[ch];
    const sl = h('input', { type: 'range', min: 0, max: 100, value: Math.round(audio.prefs[ch] * 100), class: 'tc-range', 'aria-label': t(`audio.${ch}`), oninput: (e) => audio.setPref(ch, e.target.value / 100) });
    return h('div', { class: 'tc-arow' }, h('label', null, on, h('b', null, t(`audio.${ch}`))), sl);
  };
  const mute = h('input', { type: 'checkbox', class: 'tc-sw', onchange: (e) => { audio.setMute(e.target.checked); app.refreshSnd(); } });
  mute.checked = audio.prefs.mute;
  app.sheets.open({
    title: t('audio.title'),
    body: h('div', { class: 'tc-audio' }, h('div', { class: 'tc-arow top' }, h('label', null, mute, h('b', null, t('audio.mute')))), mk('music'), mk('fx'), mk('amb'), h('p', { class: 'tc-note' }, t('audio.note'))),
    actions: [{ label: t('close'), value: true, primary: true }],
  });
}
export { crowdSil };
