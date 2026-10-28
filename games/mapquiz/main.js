// "Adivinhe o País" — world map geography quiz.
// Modes: guess (pick the name of a highlighted country / flag), find on the map
// (countries, capitals, flags), elimination, endless marathon, daily
// challenge and free exploration. Progress: mastery per country, explorer
// level (endless XP), best results, daily streak.

import STRINGS from './strings.js';
import { MapView, geometry } from './map.js';
import { VIEWS, MAP_W } from './map-data.js';
import { CONTS, PLAYABLE, BY_CODE, pool, contCodes, distractors, dailyQuestions, dayKey, levelInfo, rankIndex, Progress } from './quiz.js';
import { flagUrl } from '../../js/data/countries.js';
import { shuffle } from '../../js/core/ui.js';

const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const line = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const solid = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z';

const ICON = {
  starCoin: solid(
    '<circle cx="12" cy="12" r="11" fill="url(#mq-gold)"/><circle cx="12" cy="12" r="8.7" fill="none" stroke="#7a5608" stroke-opacity=".5"/><path d="M12 6.3l1.7 3.5 3.9.5-2.8 2.7.7 3.8L12 15l-3.5 1.8.7-3.8-2.8-2.7 3.9-.5z" fill="#2b1d00"/>',
  ),
  heart: solid(
    '<path d="M12 21s-7.6-4.6-9.7-9.3C.9 8.2 3.1 4.4 6.8 4.4c2.1 0 3.6 1.2 5.2 3.1 1.6-1.9 3.1-3.1 5.2-3.1 3.7 0 5.9 3.8 4.5 7.3C19.6 16.4 12 21 12 21z" fill="url(#mq-red)"/><path d="M6.4 7.3c-1.2.4-1.9 1.4-2 2.6" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  ),
  bulb: solid(
    '<path d="M12 2.4a6.9 6.9 0 0 0-4 12.5c.7.5 1.1 1.3 1.1 2.1V18h5.8v-1c0-.8.4-1.6 1.1-2.1a6.9 6.9 0 0 0-4-12.5z" fill="url(#mq-gold)"/><rect x="9" y="19" width="6" height="1.8" rx=".9" fill="#d3d5da"/><rect x="9.8" y="21.3" width="4.4" height="1.5" rx=".75" fill="#a2a5ac"/><path d="M9.9 8.4c.4-1.2 1.3-2 2.6-2.2" stroke="#fff" stroke-opacity=".75" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  ),
  star: solid(`<path d="${STAR_PATH}"/>`),
  globe: line('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>'),
  pin: line('<path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  question: line('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17.2h.01"/>'),
  infinity: line('<path d="M12 12c-2-2.7-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.5-1.3 5.5-4zm0 0c2 2.7 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.5 1.3-5.5 4z"/>'),
  target: line('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
  compass: line('<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>'),
  flame: line(
    '<path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.9 3.6-5.6 3.6-9.8 2.9 1.4 5 4.3 5 6.3.8-.6 1.3-1.7 1.4-2.9 1.9 1.5 3 3.8 3 6.4 0 3.6-2.9 6.2-6.5 6.2z"/>',
  ),
  plus: line('<path d="M12 5v14M5 12h14"/>'),
  minus: line('<path d="M5 12h14"/>'),
  fit: line('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'),
  skip: line('<path d="M5 6.5l6.5 5.5L5 17.5zM12.5 6.5l6.5 5.5-6.5 5.5z"/>'),
  close: line('<path d="M6 6l12 12M18 6L6 18"/>'),
  clock: line('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  miss: line('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  trophy: line('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>'),
  labels: line('<path d="M3.5 18l4.5-11 4.5 11M5.2 14h5.6"/><circle cx="17" cy="15" r="2.6"/><path d="M19.6 12v6"/>'),
  play: solid('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  map: line('<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14"/>'),
  flag: line('<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>'),
  capital: line('<path d="M4 20h16M6 20v-8M10 20v-8M14 20v-8M18 20v-8M3 12h18L12 4z"/>'),
  calendar: line('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  check: line('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
};

const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<linearGradient id="mq-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe49a"/><stop offset=".5" stop-color="#e8bf4a"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
<linearGradient id="mq-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7480"/><stop offset="1" stop-color="#d81f3a"/></linearGradient>
</defs></svg>`;

const MODE_ICON = { guess: 'question', find: 'pin', elim: 'target', marathon: 'infinity', explore: 'compass', daily: 'calendar' };

function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const pct = (p) => `${Math.round(p * 100)}%`;
const terrKey = (terr) => (terr ? 't' : 'i');
const betterRound = (a, b) =>
  a.stars > b.stars || (a.stars === b.stars && (a.correct > b.correct || (a.correct === b.correct && a.time < b.time)));
const betterElim = (a, b) => a.stars > b.stars || (a.stars === b.stars && (a.acc > b.acc || (a.acc === b.acc && a.time < b.time)));

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const { h, clear } = ctx.ui;
  const t = ctx.makeT(STRINGS);
  const sfx = ctx.sfx;
  const locale = LOCALES[ctx.lang] || 'pt-BR';
  const P = new Progress(ctx.store);
  const country = (code) => BY_CODE.get(code);
  const nameOf = (c) => ctx.pick((typeof c === 'string' ? country(c) : c).name);
  const capOf = (c) => (c.capital ? ctx.pick(c.capital) : '—');
  const nf = new Intl.NumberFormat(locale);
  geometry();

  root.classList.add('mq-root');
  const defs = h('div', { class: 'mq-defs', html: DEFS });
  const stage = h('div', { class: 'mq-stage' });
  root.append(defs, stage);

  let unmounted = false;
  const globalTimers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      globalTimers.delete(id);
      if (!unmounted) fn();
    }, ms);
    globalTimers.add(id);
    return id;
  };

  // ------------------------------------------------------------ small widgets
  const icon = (name, cls = '') => h('span', { class: `mq-ic ${cls}`, html: ICON[name] });

  function ring(p, size, content, cls = '') {
    const sw = size > 54 ? 5 : 4;
    const r = (size - sw) / 2 - 1;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, p || 0));
    const el = h('span', { class: `mq-ring ${cls}`, style: { width: size + 'px', height: size + 'px' } });
    el.innerHTML =
      `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(227,184,74,.16)" stroke-width="${sw}"/>` +
      `<circle class="mq-ring-bar" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#mq-gold)" stroke-width="${sw}" stroke-linecap="round" ` +
      `stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" ${v < 0.005 ? 'opacity="0"' : ''}/></svg>`;
    el.append(h('span', { class: 'mq-ring-label' }, content));
    const bar = el.querySelector('.mq-ring-bar');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        bar.style.strokeDashoffset = (c * (1 - v)).toFixed(2);
      }),
    );
    return el;
  }

  function starsRow(n, cls = '') {
    const el = h('span', { class: `mq-stars ${cls}`, 'aria-label': `${n}/3` });
    for (let i = 0; i < 3; i++) el.append(h('span', { class: i < n ? 'on' : '', html: ICON.star }));
    return el;
  }

  function thumb(cont) {
    const W = 60;
    const H = 42;
    const dpr = 2;
    const c = h('canvas', { class: 'mq-thumb', width: W * dpr, height: H * dpr, 'aria-hidden': 'true' });
    const g = c.getContext('2d');
    const [x0, y0, x1, y1] = VIEWS[cont];
    const sc = Math.min((W - 4) / (x1 - x0), (H - 4) / (y1 - y0));
    const ox = (W - (x1 - x0) * sc) / 2 - x0 * sc;
    const oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
    const shapes = Object.values(geometry().shapes).filter((s) => s.hasGeo);
    const gold = g.createLinearGradient(x0, y0, x1, y1);
    gold.addColorStop(0, '#fbe49a');
    gold.addColorStop(0.5, '#e8bf4a');
    gold.addColorStop(1, '#b8860b');
    for (const k of [-1, 0, 1]) {
      g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + k * MAP_W * sc), dpr * oy);
      g.fillStyle = 'rgba(255,255,255,0.1)';
      for (const s of shapes) if (cont !== 'world' && country(s.code)?.cont !== cont) g.fill(s.lo, 'evenodd');
      g.fillStyle = gold;
      for (const s of shapes) if (cont === 'world' || country(s.code)?.cont === cont) g.fill(s.lo, 'evenodd');
    }
    return c;
  }

  function hudItem(iconName, value, extra = {}) {
    return h(extra.button ? 'button' : 'div', { class: `mq-hud-item ${extra.cls || ''}`, ...extra.attrs }, icon(iconName, 'mq-hud-ic'), value);
  }

  function floatText(s, text, cls = '') {
    const el = h('div', { class: `mq-float ${cls}` }, text);
    s.el.append(el);
    later(() => el.remove(), 1300);
  }

  function zoomControls(getMap, onFit) {
    const btn = (name, label, fn) =>
      h('button', {
        class: 'mq-round',
        'aria-label': label,
        title: label,
        html: ICON[name],
        onclick: () => {
          sfx.play('tap');
          fn(getMap());
        },
      });
    return h(
      'div',
      { class: 'mq-zoom' },
      btn('plus', t('zoomIn'), (m) => m && m.zoomBy(2)),
      btn('minus', t('zoomOut'), (m) => m && m.zoomBy(0.5)),
      btn('fit', t('resetView'), (m) => m && onFit(m)),
    );
  }

  // ------------------------------------------------------------ screens & navigation
  let cur = null;
  const stack = [];
  let overlay = null;
  const screens = new Set(); // every screen not destroyed yet (incl. ones animating out)

  function makeScreen(cls, title = null) {
    const s = { el: h('div', { class: `mq-screen ${cls}` }), title, timers: new Set(), dead: false, cleanups: [] };
    s.later = (fn, ms) => {
      const id = setTimeout(() => {
        s.timers.delete(id);
        if (!s.dead && !unmounted) fn();
      }, ms);
      s.timers.add(id);
      return id;
    };
    s.kill = () => {
      if (s.dead) return;
      s.dead = true;
      s.timers.forEach(clearTimeout);
      s.timers.clear();
      if (s.onLeave) s.onLeave();
    };
    s.destroy = () => {
      s.kill();
      screens.delete(s);
      s.cleanups.splice(0).forEach((f) => f());
    };
    screens.add(s);
    return s;
  }

  function show(factory, { dir = 'fwd', push = true, replace = false } = {}) {
    closeOverlay();
    if (replace) stack.pop();
    if (push || replace) stack.push(factory);
    const next = factory();
    const prev = cur;
    cur = next;
    next.el.classList.add(dir === 'back' ? 'mq-in-back' : 'mq-in-fwd');
    stage.append(next.el);
    ctx.setTitle(next.title || undefined);
    ctx.setHeaderRight(next.help ? helpButton(next.help) : null);
    if (prev) {
      prev.kill();
      prev.el.classList.add(dir === 'back' ? 'mq-out-back' : 'mq-out-fwd');
      later(() => {
        prev.destroy();
        prev.el.remove();
      }, 330);
    }
    if (next.mounted) next.mounted();
    later(() => next.el.classList.remove('mq-in-back', 'mq-in-fwd'), 420);
  }

  function back() {
    if (stack.length <= 1) return false;
    stack.pop();
    show(stack[stack.length - 1], { dir: 'back', push: false });
    return true;
  }

  function leave() {
    if (!back()) ctx.exit();
  }

  function toMenu() {
    if (stack.length > 1) back();
    else {
      stack.length = 0;
      show(menuScreen, { dir: 'back' });
    }
  }

  function openOverlay(node, onBack = null) {
    closeOverlay();
    overlay = { el: node, onBack };
    cur.el.append(node);
  }

  function closeOverlay() {
    if (!overlay) return;
    const el = overlay.el;
    overlay = null;
    el.classList.add('mq-closing');
    later(() => el.remove(), 200);
  }

  ctx.onBack(() => {
    if (overlay) {
      if (overlay.onBack) overlay.onBack();
      else closeOverlay();
      return true;
    }
    if (cur && cur.onBack) return cur.onBack();
    return back();
  });

  async function confirmQuit() {
    return ctx.ui.modal({
      title: t('quitTitle'),
      body: t('quitText'),
      actions: [
        { label: t('stay'), value: false, primary: true },
        { label: t('quit'), value: true, danger: true },
      ],
      dismissible: true,
    });
  }

  function helpButton(kind) {
    return h('button', {
      class: 'icon-btn g-mapquiz-help',
      'aria-label': t('help'),
      title: t('help'),
      html: ICON.question,
      onclick: () => {
        sfx.play('tap');
        coach(kind, true);
      },
    });
  }

  // first-time tips (and the ? button)
  function coach(kind, force = false, onClose = null) {
    if (!force && P.setting('coach:' + kind, false)) return false;
    P.setSetting('coach:' + kind, true);
    const tips = {
      guess: [
        ['map', t('howGuess1')],
        ['heart', t('howGuess2')],
        ['bulb', t('howGuess3')],
      ],
      find: [
        ['pin', t('howFind1')],
        ['fit', t('howFind2')],
        ['bulb', t('howFind3')],
      ],
      explore: [
        ['compass', t('howExplore1')],
        ['fit', t('howFind2')],
        ['labels', t('howExplore2')],
      ],
    }[kind];
    const close = () => {
      sfx.play('tap');
      closeOverlay();
      if (onClose) onClose();
    };
    const box = h(
      'div',
      { class: 'mq-overlay' },
      h(
        'div',
        { class: 'mq-panel mq-coach' },
        h('div', { class: 'mq-coach-title' }, t('howTitle')),
        tips.map(([ic, text]) => h('div', { class: 'mq-coach-row' }, icon(ic, 'mq-coach-ic'), h('span', null, text))),
        h('button', { class: 'btn primary block', onclick: close }, t('gotIt')),
      ),
    );
    openOverlay(box, close);
    return true;
  }

  // ------------------------------------------------------------ main menu
  function menuScreen() {
    const s = makeScreen('mq-menu screen');
    const lv = levelInfo(P.xp);
    const seen = P.seen.size;
    const mastery = P.masteryPct(['name', 'capital', 'flag', 'map'], 'world');
    const profile = h(
      'div',
      { class: 'mq-panel mq-profile' },
      h(
        'div',
        { class: 'mq-profile-top' },
        ring(lv.progress, 64, h('b', null, lv.level), 'mq-ring-level'),
        h(
          'div',
          { class: 'mq-profile-body' },
          h('div', { class: 'mq-kicker' }, `${t('explorer')} · ${t('levelN', { n: lv.level })}`),
          h('div', { class: 'mq-profile-rank' }, t('rank' + rankIndex(lv.level))),
          h('div', { class: 'mq-bar' }, h('i', { style: { width: (lv.progress * 100).toFixed(1) + '%' } })),
          h('div', { class: 'mq-small' }, `${lv.into} / ${lv.need} XP`),
        ),
      ),
      h(
        'div',
        { class: 'mq-profile-stats' },
        h('div', { class: 'mq-pstat' }, icon('flame'), h('b', null, P.dailyStreak()), h('small', null, t('streak'))),
        h('div', { class: 'mq-pstat' }, icon('globe'), h('b', null, pct(mastery)), h('small', null, t('mastery'))),
        h('div', { class: 'mq-pstat' }, icon('compass'), h('b', null, `${seen}/${PLAYABLE.length}`), h('small', null, t('discovered'))),
      ),
    );

    const today = new Date();
    const res = P.dailyResult();
    const daily = h(
      'button',
      {
        class: `mq-daily ${res ? 'done' : ''}`,
        onclick: () => {
          sfx.play('select');
          show(() => guessScreen({ type: 'daily' }));
        },
      },
      h(
        'span',
        { class: 'mq-daily-cal' },
        h('small', null, new Intl.DateTimeFormat(locale, { month: 'short' }).format(today).replace('.', '')),
        h('b', null, today.getDate()),
      ),
      h(
        'span',
        { class: 'mq-daily-body' },
        h('span', { class: 'mq-kicker' }, t('daily')),
        h('span', { class: 'mq-daily-title' }, new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(today)),
        h('span', { class: 'mq-small' }, res ? t('dailyDone', { time: untilMidnight() }) : t('dailySub')),
      ),
      res ? starsRow(res.stars) : h('span', { class: 'mq-play-pill' }, icon('play'), t('play')),
    );

    const elimStars = CONTS.reduce((a, c) => a + ((P.best(`elim:${c}:i`) || {}).stars || 0), 0);
    const marathon = P.best('marathon');
    const seenP = seen / PLAYABLE.length;
    const modes = [
      ['guess', t('mGuess'), t('mGuessSub'), ring(P.masteryPct(['map', 'flag'], 'world'), 46, pct(P.masteryPct(['map', 'flag'], 'world')))],
      ['find', t('mFind'), t('mFindSub'), ring(P.masteryPct(['name', 'capital', 'flag'], 'world'), 46, pct(P.masteryPct(['name', 'capital', 'flag'], 'world')))],
      ['elim', t('mElim'), t('mElimSub'), ring(elimStars / 21, 46, h('span', { class: 'mq-ring-star' }, elimStars, h('i', { html: ICON.star })))],
      ['marathon', t('mMarathon'), t('mMarathonSub'), h('span', { class: 'mq-record' }, icon('trophy'), h('b', null, marathon ? marathon.score : 0))],
      ['explore', t('mExplore'), t('mExploreSub'), ring(seenP, 46, pct(seenP))],
    ];
    const list = h(
      'div',
      { class: 'list mq-list' },
      modes.map(([id, title, sub, right], i) =>
        h(
          'button',
          {
            class: 'list-item mq-li',
            style: { animationDelay: 60 + i * 45 + 'ms' },
            onclick: () => {
              sfx.play('select');
              if (id === 'marathon') show(() => guessScreen({ type: 'marathon' }));
              else show(() => pickerScreen(id));
            },
          },
          h('span', { class: 'li-icon mq-li-icon', html: ICON[MODE_ICON[id]] }),
          h('span', { class: 'li-body' }, h('span', { class: 'li-title' }, title), h('span', { class: 'li-sub' }, sub)),
          h('span', { class: 'li-right' }, right),
        ),
      ),
    );
    s.el.append(profile, daily, h('div', { class: 'section-title mq-section' }, t('modes')), list);
    return s;
  }

  function untilMidnight() {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.ceil((end - now) / 60000));
    return t('hm', { h: Math.floor(mins / 60), m: mins % 60 });
  }

  // ------------------------------------------------------------ region picker
  function pickerScreen(mode) {
    const titles = { guess: t('mGuess'), find: t('mFind'), elim: t('mElim'), explore: t('mExplore') };
    const subs = { guess: t('mGuessSub'), find: t('mFindSub'), elim: t('mElimSub'), explore: t('mExploreSub') };
    const s = makeScreen('mq-picker screen', titles[mode]);
    const variants =
      mode === 'guess'
        ? [
            ['map', t('vMap'), 'map'],
            ['flag', t('vFlag'), 'flag'],
          ]
        : mode === 'find'
          ? [
              ['name', t('vName'), 'pin'],
              ['capital', t('vCapital'), 'capital'],
              ['flag', t('vFlags'), 'flag'],
            ]
          : null;
    let variant = variants ? P.setting('v:' + mode, variants[0][0]) : 'name';
    if (variants && !variants.some((v) => v[0] === variant)) variant = variants[0][0];
    let terr = P.setting('terr', false);

    const chips = h('div', { class: 'chips mq-chips' });
    const list = h('div', { class: 'list mq-list' });

    function renderChips() {
      clear(chips);
      if (variants)
        for (const [id, label, ic] of variants)
          chips.append(
            h(
              'button',
              {
                class: `chip ${id === variant ? 'active' : ''}`,
                'aria-pressed': String(id === variant),
                onclick: () => {
                  if (variant === id) return;
                  sfx.play('tap');
                  variant = id;
                  P.setSetting('v:' + mode, id);
                  renderChips();
                  renderList();
                },
              },
              icon(ic, 'mq-chip-ic'),
              label,
            ),
          );
      if (mode !== 'explore')
        chips.append(
          h(
            'button',
            {
              class: `chip mq-terr ${terr ? 'active' : ''}`,
              'aria-pressed': String(terr),
              onclick: () => {
                sfx.play('tap');
                terr = !terr;
                P.setSetting('terr', terr);
                renderChips();
                renderList();
              },
            },
            h('span', { class: 'mq-check', html: terr ? ICON.check : '' }),
            t('territories'),
          ),
        );
    }

    function renderList() {
      clear(list);
      CONTS.forEach((cont, i) => {
        let p;
        let sub;
        let stars = null;
        if (mode === 'explore') {
          const codes = contCodes(cont);
          const seen = P.seen;
          const k = codes.filter((c) => seen.has(c)).length;
          p = k / codes.length;
          sub = t('discoveredOf', { n: k, total: codes.length });
        } else {
          const kind = mode === 'elim' ? 'name' : variant;
          const n = pool(cont, { territories: terr, kind }).length;
          p = P.masteryPct(kind, cont, terr);
          const best = P.best(mode === 'elim' ? `elim:${cont}:${terrKey(terr)}` : `${mode}:${variant}:${cont}:${terrKey(terr)}`);
          sub = t('nCountries', { n });
          stars = best ? best.stars : 0;
        }
        if (cont === 'na') sub += ' · ' + t('naSub');
        list.append(
          h(
            'button',
            {
              class: 'list-item mq-li mq-cont',
              style: { animationDelay: 40 + i * 40 + 'ms' },
              onclick: () => start(cont),
            },
            h('span', { class: 'li-icon mq-thumb-wrap' }, thumb(cont)),
            h(
              'span',
              { class: 'li-body' },
              h('span', { class: 'li-title' }, t(cont)),
              h('span', { class: 'li-sub' }, sub),
              stars !== null ? starsRow(stars, 'small') : null,
            ),
            h('span', { class: 'li-right' }, ring(p, 46, pct(p))),
          ),
        );
      });
    }

    function start(cont) {
      sfx.play('select');
      if (mode === 'guess') show(() => guessScreen({ type: 'guess', variant, cont, terr }));
      else if (mode === 'find') show(() => findScreen({ type: 'find', variant, cont, terr }));
      else if (mode === 'elim') show(() => findScreen({ type: 'elim', variant: 'name', cont, terr }));
      else show(() => exploreScreen({ cont }));
    }

    renderChips();
    renderList();
    s.el.append(
      h(
        'div',
        { class: 'mq-picker-head' },
        h('span', { class: 'mq-picker-icon', html: ICON[MODE_ICON[mode]] }),
        h('span', null, h('span', { class: 'mq-picker-title' }, titles[mode]), h('span', { class: 'mq-small' }, subs[mode])),
      ),
      chips,
      h('div', { class: 'section-title mq-section' }, t('chooseRegion')),
      list,
    );
    return s;
  }

  // ------------------------------------------------------------ results
  function results(s, { kicker, title, stars = null, big = null, stats, isNew = false, masteryLine = null, xp, onAgain, sound }) {
    const lvBefore = levelInfo(P.xp);
    const { after } = P.addXP(xp);
    if (ctx.addXP) ctx.addXP(xp);
    const bar = h('i', { style: { width: (lvBefore.progress * 100).toFixed(1) + '%' } });
    const lvLabel = h('b', null, t('levelN', { n: lvBefore.level }));
    const card = h(
      'div',
      { class: 'mq-panel mq-result' },
      h('div', { class: 'mq-kicker' }, kicker),
      h('div', { class: 'mq-result-title' }, title),
      stars !== null ? starsRow(0, 'big') : null,
      big !== null ? h('div', { class: 'mq-result-big' }, big) : null,
      isNew ? h('div', { class: 'mq-badge' }, icon('trophy'), t('newRecord')) : null,
      h(
        'div',
        { class: 'mq-result-stats' },
        stats.map(([label, value]) => h('div', { class: 'mq-rstat' }, h('b', null, value), h('small', null, label))),
      ),
      masteryLine ? h('div', { class: 'mq-small mq-result-line' }, masteryLine) : null,
      h(
        'div',
        { class: 'mq-result-xp' },
        h('span', { class: 'mq-xp-gain' }, `+${xp} XP`),
        h('span', { class: 'mq-xp-level' }, lvLabel, h('span', { class: 'mq-bar' }, bar)),
      ),
      h(
        'div',
        { class: 'mq-result-actions' },
        h(
          'button',
          {
            class: 'btn primary block',
            onclick: () => {
              sfx.play('select');
              onAgain();
            },
          },
          t('playAgain'),
        ),
        h(
          'button',
          {
            class: 'btn block mq-btn-dark',
            onclick: () => {
              sfx.play('tap');
              toMenu();
            },
          },
          t('menu'),
        ),
      ),
    );
    openOverlay(h('div', { class: 'mq-overlay mq-result-wrap' }, card), toMenu);
    sfx.play(sound || (stars === 0 ? 'lose' : 'win'));
    if (stars !== null) {
      const starEls = card.querySelectorAll('.mq-stars.big > span');
      for (let i = 0; i < stars; i++)
        s.later(
          () => {
            starEls[i].classList.add('on', 'mq-star-pop');
            sfx.tone({ freq: 660 + i * 220, dur: 0.14, type: 'triangle', vol: 0.3 });
          },
          450 + i * 280,
        );
      if (stars === 3) s.later(() => ctx.ui.confetti(), 1300);
    }
    s.later(() => {
      if (after.level > lvBefore.level) {
        bar.style.width = '100%';
        s.later(() => {
          lvLabel.textContent = t('levelN', { n: after.level });
          bar.style.transition = 'none';
          bar.style.width = '0%';
          void bar.offsetWidth;
          bar.style.transition = '';
          bar.style.width = (after.progress * 100).toFixed(1) + '%';
          floatText(s, t('explorerUp', { n: after.level }), 'gold');
          sfx.play('levelup');
        }, 650);
      } else bar.style.width = (after.progress * 100).toFixed(1) + '%';
    }, 700);
  }

  // ------------------------------------------------------------ guess (multiple choice) — guess / daily / marathon
  function guessScreen(o) {
    const isDaily = o.type === 'daily';
    const isMarathon = o.type === 'marathon';
    const title = isDaily ? t('mDaily') : isMarathon ? t('mMarathon') : `${t('mGuess')} · ${t(o.cont)}`;
    const s = makeScreen('mq-guess', title);
    s.help = 'guess';
    const st = { i: 0, lives: 3, hints: 1, correct: 0, answered: false, done: false, t0: performance.now(), stage: 1, recent: [], q: null };

    let qs = [];
    if (isDaily) qs = dailyQuestions().map((q) => ({ target: country(q.code), picture: q.picture, options: q.options.map(country) }));
    else if (!isMarathon) {
      const list = pool(o.cont, { territories: o.terr, kind: o.variant });
      const cands = list.length >= 6 ? list : pool('world', { territories: o.terr });
      qs = P.pickQuestions(list, o.variant, Math.min(10, list.length)).map((c) => ({
        target: c,
        picture: o.variant,
        options: shuffle([c, ...distractors(c, cands, Math.random, 0.34)]),
      }));
    }
    const total = isMarathon ? Infinity : qs.length;

    const progEl = h('b');
    const livesEl = h('b');
    const hintsEl = h('b');
    const hintBtn = hudItem('bulb', hintsEl, { button: true, cls: 'mq-hint', attrs: { 'aria-label': t('hint'), title: t('hint'), onclick: () => useHint() } });
    const livesItem = hudItem('heart', livesEl, { cls: 'mq-lives' });
    const hud = h('div', { class: 'mq-panel mq-hud' }, hudItem('starCoin', progEl), livesItem, hintBtn);

    const mapBox = h('div', { class: 'mq-picture-map' });
    const flagImg = h('img', { class: 'mq-picture-flag', alt: '', draggable: 'false' });
    const capText = h('b');
    const capBox = h('div', { class: 'mq-picture-capital' }, icon('capital', 'mq-cap-ic'), h('small', null, t('capital')), capText);
    const tag = h('div', { class: 'mq-picture-tag' });
    const stageBadge = h('div', { class: 'mq-stage-badge' });
    const picture = h('div', { class: 'mq-picture' }, mapBox, h('div', { class: 'mq-picture-frame' }, flagImg), capBox, tag, isMarathon ? stageBadge : null);
    const btns = [0, 1, 2, 3].map((i) => h('button', { class: 'answer-btn mq-answer', onclick: () => choose(i) }));
    const grid = h('div', { class: 'mq-options' }, btns);
    s.el.append(hud, picture, grid);

    let map = null;
    s.cleanups.push(() => map && map.destroy());

    function updateHud() {
      progEl.textContent = isMarathon ? String(st.correct) : `${Math.min(st.i + 1, total)}/${total}`;
      livesEl.textContent = String(st.lives);
      hintsEl.textContent = String(st.hints);
      hintBtn.classList.toggle('empty', st.hints <= 0);
      stageBadge.textContent = t('stage', { n: st.stage });
    }

    function marathonQuestion() {
      const sc = st.correct;
      const stage = sc < 5 ? 1 : sc < 12 ? 2 : sc < 20 ? 3 : sc < 30 ? 4 : 5;
      if (stage > st.stage) {
        st.stage = stage;
        floatText(s, t('stageUp', { n: stage }), 'gold');
        sfx.play('levelup');
        stageBadge.classList.remove('mq-bump');
        void stageBadge.offsetWidth;
        stageBadge.classList.add('mq-bump');
      }
      const base = stage >= 4 ? PLAYABLE : PLAYABLE.filter((c) => c.independent);
      let cands = stage === 1 ? base.filter((c) => c.level === 1) : stage === 2 ? base.filter((c) => c.level <= 2) : base;
      cands = cands.filter((c) => !st.recent.includes(c.code));
      const target = cands[Math.floor(Math.random() * cands.length)];
      st.recent.push(target.code);
      if (st.recent.length > 25) st.recent.shift();
      const pics = stage === 1 ? ['map', 'flag'] : stage === 2 ? ['map', 'flag', 'map'] : ['map', 'flag', 'capital'];
      let picture = pics[Math.floor(Math.random() * pics.length)];
      if (picture === 'capital' && !target.capital) picture = 'map';
      const near = [0, 0.34, 0.67, 1, 1][stage - 1];
      return { target, picture, options: shuffle([target, ...distractors(target, base, Math.random, near)]) };
    }

    function showQuestion() {
      const q = isMarathon ? marathonQuestion() : qs[st.i];
      st.q = q;
      st.answered = false;
      updateHud();
      picture.dataset.kind = q.picture;
      tag.textContent = q.picture === 'flag' ? t('whichFlag') : q.picture === 'capital' ? t('whichCapital') : t('whichCountry');
      if (q.picture === 'flag') {
        flagImg.src = flagUrl(q.target);
        flagImg.parentNode.classList.remove('mq-pop');
        void flagImg.offsetWidth;
        flagImg.parentNode.classList.add('mq-pop');
      } else if (q.picture === 'capital') {
        capText.textContent = capOf(q.target);
        capBox.classList.remove('mq-pop');
        void capBox.offsetWidth;
        capBox.classList.add('mq-pop');
      }
      if (map) {
        map.clearStates();
        if (q.picture === 'map') {
          map.setState(q.target.code, 'gold');
          map.pulse(q.target.code, 'reveal');
          map.focus(q.target.code, { minSize: 2000, pad: 24, dur: st.i === 0 ? 1100 : undefined });
        }
      }
      btns.forEach((b, i) => {
        b.className = 'answer-btn mq-answer mq-swap';
        b.disabled = false;
        b.style.animationDelay = i * 40 + 'ms';
        b.textContent = nameOf(q.options[i]);
        b.classList.toggle('mq-long', b.textContent.length > 18);
      });
      // preload the next flag
      const nq = !isMarathon && qs[st.i + 1];
      if (nq && nq.picture === 'flag') new Image().src = flagUrl(nq.target);
    }

    function choose(i) {
      if (st.answered || st.done) return;
      st.answered = true;
      const q = st.q;
      const pick = q.options[i];
      const ok = pick.code === q.target.code;
      btns.forEach((b) => (b.disabled = true));
      btns[i].classList.add('mq-chosen');
      sfx.play('tap');
      const kind = q.picture === 'flag' ? 'flag' : q.picture === 'capital' ? 'capital' : 'map';
      s.later(() => {
        btns[i].classList.remove('mq-chosen');
        const right = btns[q.options.indexOf(q.target)];
        right.classList.add('correct');
        if (ok) {
          st.correct++;
          sfx.play('success');
          sfx.vibrate(18);
          if (st.correct % 5 === 0 && st.correct > 0 && !isMarathon) sfx.tone({ freq: 1320, dur: 0.12, type: 'triangle', vol: 0.25, delay: 0.16 });
          P.recordAnswer(kind, q.target.code, 'first');
          if (map && q.picture === 'map') {
            map.stopFlash(q.target.code);
            map.setState(q.target.code, 'good');
            map.flash(q.target.code, 'good');
          }
          picture.classList.add('mq-good');
          if (isMarathon && st.correct % 10 === 0 && st.hints < 3) {
            st.hints++;
            floatText(s, t('extraHint'), 'gold');
          }
        } else {
          btns[i].classList.add('wrong');
          st.lives--;
          sfx.play('error');
          sfx.vibrate([40, 50, 40]);
          P.recordAnswer(kind, q.target.code, 'miss');
          picture.classList.add('mq-bad');
          livesItem.classList.remove('mq-hurt');
          void livesItem.offsetWidth;
          livesItem.classList.add('mq-hurt');
          if (map && q.picture === 'map') map.pin(q.target.code, nameOf(q.target), 'reveal', 1500);
        }
        updateHud();
        s.later(
          () => {
            picture.classList.remove('mq-good', 'mq-bad');
            st.i++;
            if (st.lives <= 0 || st.i >= total) finish();
            else showQuestion();
          },
          ok ? 1050 : 1700,
        );
      }, 280);
    }

    function useHint() {
      if (st.answered || st.done) return;
      if (st.hints <= 0) {
        sfx.play('error');
        floatText(s, t('noHints'));
        return;
      }
      const wrong = shuffle(btns.filter((b, i) => st.q.options[i] !== st.q.target && !b.disabled)).slice(0, 2);
      if (!wrong.length) return;
      st.hints--;
      sfx.play('pop');
      sfx.vibrate(12);
      wrong.forEach((b) => {
        b.disabled = true;
        b.classList.add('dim');
      });
      updateHud();
    }

    function finish() {
      st.done = true;
      const time = performance.now() - st.t0;
      const answered = isMarathon ? st.correct + (3 - st.lives) : st.i;
      if (isMarathon) {
        const prev = P.best('marathon');
        const isNew = P.saveBest('marathon', { score: st.correct, stage: st.stage, time }, (a, b) => a.score > b.score);
        results(s, {
          kicker: t('mMarathon'),
          title: t('marathonOver'),
          big: String(st.correct),
          isNew: isNew && st.correct > 0,
          stats: [
            [t('statStage'), st.stage],
            [t('record'), Math.max(st.correct, prev ? prev.score : 0)],
            [t('statTime'), fmtTime(time)],
          ],
          xp: st.correct + st.stage * 2,
          sound: st.correct >= 10 ? 'win' : 'lose',
          onAgain: () => show(() => guessScreen(o), { replace: true }),
        });
        return;
      }
      const finished = st.lives > 0;
      const stars = finished ? st.lives : 0;
      let isNew = false;
      let xp = st.correct + stars * 3;
      if (isDaily) {
        if (P.saveDaily(stars, st.correct)) xp += 10;
      } else isNew = P.saveBest(`guess:${o.variant}:${o.cont}:${terrKey(o.terr)}`, { stars, correct: st.correct, total, time }, betterRound) && stars > 0;
      const titleText = !finished ? t('gameOver') : stars === 3 ? t('perfect') : stars === 2 ? t('great') : t('good');
      results(s, {
        kicker: isDaily ? `${t('mDaily')} · ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date())}` : `${t('mGuess')} · ${t(o.cont)}`,
        title: titleText,
        stars,
        isNew,
        stats: [
          [t('statCorrect'), `${st.correct}/${answered}`],
          [t('statTime'), fmtTime(time)],
          [t('statMistakes'), 3 - st.lives],
        ],
        masteryLine: isDaily ? null : t('masteryLine', { region: t(o.cont), p: Math.round(P.masteryPct(o.variant, o.cont, o.terr) * 100) }),
        xp,
        onAgain: () => show(() => guessScreen(o), { replace: true }),
      });
    }

    s.onBack = () => {
      if (st.done || (st.i === 0 && !st.answered)) return back();
      confirmQuit().then((ok) => ok && !s.dead && leave());
      return true;
    };

    s.mounted = () => {
      map = new MapView(mapBox, { labels: false, markers: 'states', markerBelow: 7 });
      map.fitView('world');
      updateHud();
      if (!isMarathon && !qs.length) return;
      s.later(showQuestion, 120);
      coach('guess', false, () => (st.t0 = performance.now()));
    };
    return s;
  }

  // ------------------------------------------------------------ find on the map — find / elimination
  function findScreen(o) {
    const isElim = o.type === 'elim';
    const kind = isElim ? 'name' : o.variant;
    const title = `${isElim ? t('mElim') : t('mFind')} · ${t(o.cont)}`;
    const s = makeScreen('mq-find', title);
    s.help = 'find';
    const list = pool(o.cont, { territories: o.terr, kind });
    const qs = isElim ? shuffle(list) : P.pickQuestions(list, kind, Math.min(10, list.length));
    const st = {
      i: 0,
      tries: 3,
      hints: isElim ? Math.max(1, Math.round(qs.length / 12)) : 1,
      first: 0,
      found: 0,
      mistakes: 0,
      combo: 0,
      solved: new Set(),
      locked: false,
      done: false,
      t0: performance.now(),
      revealCam: null,
    };

    const progEl = h('b');
    const triesEl = h('b');
    const hintsEl = h('b');
    const timeEl = h('b');
    const hintBtn = hudItem('bulb', hintsEl, { button: true, cls: 'mq-hint', attrs: { 'aria-label': t('hint'), title: t('hint'), onclick: () => useHint() } });
    const triesItem = isElim ? hudItem('miss', triesEl, { cls: 'mq-lives' }) : hudItem('heart', triesEl, { cls: 'mq-lives' });
    const hud = h('div', { class: 'mq-panel mq-hud' }, hudItem('starCoin', progEl), triesItem, isElim ? hudItem('clock', timeEl) : null, hintBtn);
    const promptKicker = h('div', { class: 'mq-kicker' });
    const promptMain = h('div', { class: 'mq-prompt-main' });
    const promptSub = h('div', { class: 'mq-small' });
    const promptFlag = h('img', { class: 'mq-prompt-flag', alt: '', draggable: 'false' });
    const nextBtn = h('button', { class: 'btn primary small mq-next', onclick: () => continueAfterReveal() }, t('next'), icon('skip'));
    const prompt = h('div', { class: 'mq-panel mq-prompt' }, promptFlag, h('div', { class: 'mq-prompt-text' }, promptKicker, promptMain, promptSub), nextBtn);
    const top = h('div', { class: 'mq-find-top' }, hud, prompt);
    const mapBox = h('div', { class: 'mq-find-map' });
    const skipBtn = h('button', { class: 'mq-skip', onclick: () => skip() }, icon('skip'), t('skip'));
    const progressBar = h('i');
    s.el.append(mapBox, top, h('div', { class: 'mq-find-progress' }, progressBar), skipBtn, zoomControls(() => map, (m) => m.fitView(o.cont, { animate: true })));

    let map = null;
    s.cleanups.push(() => map && map.destroy());

    function updateHud() {
      progEl.textContent = isElim ? `${st.found}/${qs.length}` : `${Math.min(st.i + 1, qs.length)}/${qs.length}`;
      triesEl.textContent = String(isElim ? st.mistakes : st.tries);
      hintsEl.textContent = String(st.hints);
      hintBtn.classList.toggle('empty', st.hints <= 0);
      progressBar.style.width = ((st.i / qs.length) * 100).toFixed(1) + '%';
    }

    function tick() {
      timeEl.textContent = fmtTime(performance.now() - st.t0);
      if (!st.done) s.later(tick, 500);
    }

    function setPrompt() {
      const c = qs[st.i];
      prompt.classList.remove('reveal', 'mq-ok');
      prompt.classList.remove('mq-swap');
      void prompt.offsetWidth;
      prompt.classList.add('mq-swap');
      promptFlag.style.display = kind === 'flag' ? '' : 'none';
      if (kind === 'flag') {
        promptFlag.src = flagUrl(c);
        promptKicker.textContent = '';
        promptMain.textContent = '';
        promptSub.textContent = t('findFlag');
      } else if (kind === 'capital') {
        promptKicker.textContent = t('capital');
        promptMain.textContent = capOf(c);
        promptSub.textContent = t('tapCountry');
      } else {
        promptKicker.textContent = t('find');
        promptMain.textContent = nameOf(c);
        promptSub.textContent = '';
      }
      const next = qs[st.i + 1];
      if (next && kind === 'flag') new Image().src = flagUrl(next);
    }

    function onTap(code) {
      if (st.locked || st.done) return;
      const target = qs[st.i];
      if (!code) return;
      if (code !== target.code && st.solved.has(code)) {
        sfx.play('tap');
        map.pin(code, t('already', { name: nameOf(code) }), 'info', 1200);
        return;
      }
      if (code === target.code) correct(code);
      else wrong(code);
    }

    function correct(code) {
      st.locked = true;
      const first = st.tries === 3;
      st.solved.add(code);
      st.found++;
      if (first) {
        st.first++;
        st.combo++;
      } else st.combo = 0;
      P.recordAnswer(kind, code, first ? 'first' : 'late');
      map.setState(code, first ? 'good' : 'ok');
      map.flash(code, 'good');
      map.pin(code, '✓ ' + nameOf(code), 'good', 1300);
      sfx.play('success');
      if (st.combo >= 3) {
        sfx.tone({ freq: 880 + Math.min(12, st.combo) * 55, dur: 0.14, type: 'triangle', vol: 0.25, delay: 0.17 });
        if (st.combo % 3 === 0) floatText(s, t('combo', { n: st.combo }), 'gold');
      }
      sfx.vibrate(18);
      prompt.classList.add('mq-ok');
      updateHud();
      s.later(advance, 900);
    }

    function wrong(code) {
      st.tries--;
      st.mistakes++;
      st.combo = 0;
      map.flash(code, 'bad');
      map.pin(code, nameOf(code), 'bad', 1500);
      sfx.play('error');
      sfx.vibrate([30, 40, 30]);
      prompt.classList.remove('shake');
      void prompt.offsetWidth;
      prompt.classList.add('shake');
      triesItem.classList.remove('mq-hurt');
      void triesItem.offsetWidth;
      triesItem.classList.add('mq-hurt');
      updateHud();
      if (st.tries <= 0) {
        st.locked = true;
        s.later(reveal, 600);
      }
    }

    function reveal() {
      const c = qs[st.i];
      st.locked = true;
      st.combo = 0;
      P.recordAnswer(kind, c.code, 'miss');
      map.setState(c.code, 'miss');
      map.flash(c.code, 'reveal');
      map.pin(c.code, nameOf(c), 'reveal', 0);
      st.revealCam = { ...map.cam };
      const g = geometry().shapes[c.code];
      const tooSmall = g.size * map.cam.s < 18;
      if (!map.isInView(c.code, 40) || tooSmall) {
        sfx.play('whoosh');
        map.focus(c.code, { minSize: 1800 });
      }
      prompt.classList.add('reveal');
      promptFlag.style.display = kind === 'flag' ? '' : 'none';
      promptKicker.textContent = '';
      promptMain.textContent = t('itWas', { name: nameOf(c) });
      promptSub.textContent = kind === 'capital' ? `${t('capital')}: ${capOf(c)}` : '';
      sfx.vibrate(60);
      updateHud();
    }

    function continueAfterReveal() {
      if (st.done || !prompt.classList.contains('reveal')) return;
      sfx.play('tap');
      const c = qs[st.i];
      map.stopFlash(c.code);
      map.clearPins();
      if (st.revealCam) map.flyTo(st.revealCam, 600);
      st.revealCam = null;
      advance();
    }

    function advance() {
      st.i++;
      st.tries = 3;
      if (st.i >= qs.length) return finish();
      st.locked = false;
      setPrompt();
      updateHud();
    }

    function skip() {
      if (st.locked || st.done) return;
      sfx.play('tap');
      st.mistakes++;
      reveal();
    }

    function useHint() {
      if (st.locked || st.done) return;
      if (st.hints <= 0) {
        sfx.play('error');
        floatText(s, t('noHints'));
        return;
      }
      st.hints--;
      updateHud();
      const g = geometry().shapes[qs[st.i].code];
      const size = Math.max(g.b[2] - g.b[0], g.b[3] - g.b[1]);
      const r = Math.max(size * 0.85, 850);
      const ang = Math.random() * Math.PI * 2;
      const off = r * 0.45 * Math.random();
      const cx = g.p[0] + Math.cos(ang) * off;
      const cy = g.p[1] + Math.sin(ang) * off;
      map.fitRect([cx - r * 1.5, cy - r * 1.5, cx + r * 1.5, cy + r * 1.5], { animate: true, pad: 10 });
      map.showArea(cx, cy, r, 5000);
      sfx.play('whoosh');
      floatText(s, t('hintArea'), 'gold');
    }

    function finish() {
      st.done = true;
      st.locked = true;
      const time = performance.now() - st.t0;
      progressBar.style.width = '100%';
      if (isElim) {
        const acc = st.found ? st.found / (st.found + st.mistakes) : 0;
        const stars = acc >= 0.95 ? 3 : acc >= 0.8 ? 2 : acc >= 0.6 ? 1 : 0;
        const isNew = P.saveBest(`elim:${o.cont}:${terrKey(o.terr)}`, { stars, acc, time, correct: st.found }, betterElim) && stars > 0;
        results(s, {
          kicker: title,
          title: stars === 3 ? t('perfect') : stars === 2 ? t('great') : stars === 1 ? t('good') : t('keepGoing'),
          stars,
          isNew,
          stats: [
            [t('statFound'), `${st.found}/${qs.length}`],
            [t('statAccuracy'), pct(acc)],
            [t('statTime'), fmtTime(time)],
          ],
          masteryLine: t('masteryLine', { region: t(o.cont), p: Math.round(P.masteryPct('name', o.cont, o.terr) * 100) }),
          xp: st.found + stars * 3 + Math.round(qs.length / 5),
          onAgain: () => show(() => findScreen(o), { replace: true }),
        });
        return;
      }
      const n = qs.length;
      const ratio = st.first / n;
      const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : ratio >= 0.5 ? 1 : 0;
      const isNew = P.saveBest(`find:${o.variant}:${o.cont}:${terrKey(o.terr)}`, { stars, correct: st.first, total: n, time }, betterRound) && stars > 0;
      results(s, {
        kicker: title,
        title: stars === 3 ? t('perfect') : stars === 2 ? t('great') : stars === 1 ? t('good') : t('keepGoing'),
        stars,
        isNew,
        stats: [
          [t('statFirst'), `${st.first}/${n}`],
          [t('statFound'), `${st.found}/${n}`],
          [t('statTime'), fmtTime(time)],
        ],
        masteryLine: t('masteryLine', { region: t(o.cont), p: Math.round(P.masteryPct(kind, o.cont, o.terr) * 100) }),
        xp: st.found + stars * 3,
        onAgain: () => show(() => findScreen(o), { replace: true }),
      });
    }

    s.onBack = () => {
      if (st.done || (st.i === 0 && st.tries === 3)) return back();
      confirmQuit().then((ok) => ok && !s.dead && leave());
      return true;
    };

    s.mounted = () => {
      map = new MapView(mapBox, { onTap, labels: false });
      map.setActive(list.map((c) => c.code));
      const applyInsets = () => map.setInsets({ top: top.offsetHeight + 14, bottom: 70 });
      applyInsets();
      const ro = new ResizeObserver(applyInsets);
      ro.observe(top);
      s.cleanups.push(() => ro.disconnect());
      map.fitView(o.cont);
      setPrompt();
      updateHud();
      if (isElim) tick();
      coach('find', false, () => (st.t0 = performance.now()));
    };
    return s;
  }

  // ------------------------------------------------------------ explore
  function exploreScreen(o) {
    const s = makeScreen('mq-explore', `${t('mExplore')} · ${t(o.cont)}`);
    s.help = 'explore';
    const codes = contCodes(o.cont);
    let labels = P.setting('labels', true);
    let sel = null;
    let gained = 0;

    const countEl = h('b');
    const bar = h('i');
    const labelsBtn = h('button', {
      class: `mq-round mq-toggle ${labels ? 'on' : ''}`,
      'aria-label': t('names'),
      'aria-pressed': String(labels),
      title: t('names'),
      html: ICON.labels,
      onclick: () => {
        sfx.play('tap');
        labels = !labels;
        P.setSetting('labels', labels);
        labelsBtn.classList.toggle('on', labels);
        labelsBtn.setAttribute('aria-pressed', String(labels));
        map.setLabels(labels);
      },
    });
    const hud = h(
      'div',
      { class: 'mq-panel mq-hud mq-explore-hud' },
      icon('compass', 'mq-hud-ic'),
      h('div', { class: 'mq-explore-count' }, h('div', { class: 'mq-small' }, t('discovered'), ' ', countEl), h('div', { class: 'mq-bar' }, bar)),
      labelsBtn,
    );
    const tip = h('div', { class: 'mq-tip' }, t('tapToExplore'));
    const sheetFlag = h('img', { class: 'mq-sheet-flag', alt: '', draggable: 'false' });
    const sheetName = h('div', { class: 'mq-sheet-name' });
    const sheetNew = h('span', { class: 'mq-badge small' }, t('newCountry'));
    const sheetRows = h('div', { class: 'mq-sheet-rows' });
    const sheet = h(
      'div',
      { class: 'mq-panel mq-sheet' },
      h('button', { class: 'mq-sheet-close', 'aria-label': t('close'), html: ICON.close, onclick: () => deselect() }),
      h('div', { class: 'mq-sheet-head' }, sheetFlag, h('div', null, sheetName, sheetNew)),
      sheetRows,
      h('button', { class: 'btn small mq-btn-dark', onclick: () => sel && map.focus(sel, { minSize: 1500 }) }, icon('target'), t('center')),
    );
    const mapBox = h('div', { class: 'mq-find-map' });
    const zoom = zoomControls(() => map, (m) => m.fitView(o.cont, { animate: true }));
    s.el.append(mapBox, h('div', { class: 'mq-find-top' }, hud), tip, zoom, sheet);

    let map = null;
    s.cleanups.push(() => map && map.destroy());
    s.onLeave = () => {
      if (gained > 0) {
        P.addXP(gained);
        if (ctx.addXP) ctx.addXP(gained);
        gained = 0;
      }
    };

    function updateCount() {
      const seen = P.seen;
      const k = codes.filter((c) => seen.has(c)).length;
      countEl.textContent = `${k}/${codes.length}`;
      bar.style.width = ((k / codes.length) * 100).toFixed(1) + '%';
    }

    function select(code) {
      const c = country(code);
      if (sel && sel !== code) map.setState(sel, 'seen');
      sel = code;
      map.setState(code, 'sel');
      map.flash(code, 'sel', 700);
      sfx.play('select');
      sfx.vibrate(10);
      tip.classList.add('hide');
      const isNew = P.markSeen(code);
      if (isNew) {
        gained++;
        sfx.play('coin');
      }
      sheetNew.style.display = isNew ? '' : 'none';
      sheetFlag.src = flagUrl(c);
      sheetName.textContent = nameOf(c);
      clear(sheetRows);
      const row = (ic, label, value) => h('div', { class: 'mq-sheet-row' }, icon(ic), h('small', null, label), h('b', null, value));
      sheetRows.append(
        row('capital', t('capital'), capOf(c)),
        row('globe', t('continent'), t(c.cont)),
        row('map', t('area'), `${nf.format(Math.round(c.area))} km²`),
      );
      if (!c.independent) sheetRows.append(h('div', { class: 'mq-sheet-tag' }, t('territory')));
      sheet.classList.add('open');
      s.el.classList.add('sheet-open');
      updateCount();
      s.later(() => {
        map.setInsets({ bottom: sheet.offsetHeight + 16 });
        map.ensureVisible(code);
      }, 30);
    }

    function deselect() {
      if (sel) map.setState(sel, 'seen');
      sel = null;
      sheet.classList.remove('open');
      s.el.classList.remove('sheet-open');
      map.setInsets({ bottom: 70 });
    }

    s.mounted = () => {
      map = new MapView(mapBox, {
        onTap: (code) => (code ? select(code) : deselect()),
        labels,
        labelFor: (code) => nameOf(code),
        tapDelay: 180,
      });
      map.setActive(codes);
      const seen = P.seen;
      for (const c of codes) if (seen.has(c)) map.setState(c, 'seen');
      map.setInsets({ top: 74, bottom: 70 });
      map.fitView(o.cont);
      updateCount();
      coach('explore');
    };
    return s;
  }

  // ------------------------------------------------------------ start
  const mode = ctx.mode;
  if (mode === 'guess' || mode === 'find') show(() => pickerScreen(mode));
  else if (mode === 'marathon') show(() => guessScreen({ type: 'marathon' }));
  else show(menuScreen);

  return () => {
    unmounted = true;
    for (const id of globalTimers) clearTimeout(id);
    globalTimers.clear();
    for (const s of [...screens]) s.destroy();
    for (const el of stage.querySelectorAll('.mq-screen')) el.remove();
    ctx.setHeaderRight(null);
  };
}
