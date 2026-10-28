// App shell: splash, home tabs, game lobbies, game lifecycle, settings.
//
// Routes (plain hashes so links survive embedding):
//   # / #home        home (game grid)        #favs     favorites
//   #trophies        achievements            #prefs    settings
//   #<id>            game lobby (or the game itself when lobby: false)
//   #<id>-play       the game                #<id>-play-<mode>  the game in a mode
//   #/play/<id>      legacy: the game directly

import { GAMES, CATEGORIES } from './games.js';
import { APP_NAME, APP_BY } from './config.js';
import { LANGS, getLang, setLang, makeT, pick, onLangChange } from './core/i18n.js';
import { createStore, clearAll } from './core/store.js';
import { sfx } from './core/sfx.js';
import { h, clear, toast, modal, confetti, loadCSS, norm } from './core/ui.js';
import { icon } from './core/icons.js';
import { gameArt, gamePreview, splashCollage } from './core/art.js';
import STRINGS from './core/strings.js';
import { addXP, levelInfo, totalXP, gameXP, streak, touchStreak, rankFor, setLastPlayed } from './core/progress.js';

const t = makeT(STRINGS);
const app = document.getElementById('app');
const prefs = createStore('app');

const flagSrc = (code) => new URL(`../assets/flags/${code}.svg`, import.meta.url).href;
const gameById = (id) => GAMES.find((g) => g.id === id);

// ---------- layout ----------
const topbar = h('header', { class: 'topbar' });
const stage = h('main', { id: 'stage' });
const bottomNav = h('nav', { class: 'bottom-nav', 'aria-label': 'Menu' });
app.append(topbar, stage, bottomNav);

let current = null; // mounted game: { id, mode, cleanup, back }
let loadToken = 0;
let skipBackCheck = false;
const homeState = { cat: 'all', query: '' };

function iconBtn(name, label, onclick, cls = '') {
  return h('button', { class: `icon-btn ${cls}`, 'aria-label': label, title: label, onclick, html: icon(name) });
}

function crownTitle(text) {
  return h('div', { class: 'tb-center' }, h('span', { class: 'tb-crown', html: icon('crown') }), h('div', { class: 'topbar-title' }, text));
}

function setTopbar({ left = null, center = null, right = null, hidden = false }) {
  clear(topbar);
  topbar.hidden = hidden;
  const rightEl = h('div', { class: 'topbar-right' }, right);
  topbar.append(h('div', { class: 'topbar-left' }, left), center || h('div', { class: 'tb-center' }), rightEl);
  return rightEl;
}

function setBottomNav(active) {
  clear(bottomNav);
  bottomNav.hidden = !active;
  if (!active) return;
  const tabs = [
    { id: 'home', hash: '#', icon: 'home', label: t('navHome') },
    { id: 'favs', hash: '#favs', icon: 'heart', label: t('navFavs') },
    { id: 'trophies', hash: '#trophies', icon: 'trophy', label: t('navTrophies') },
    { id: 'prefs', hash: '#prefs', icon: 'gear', label: t('navSettings') },
  ];
  for (const tab of tabs) {
    bottomNav.append(
      h(
        'button',
        {
          class: `bn-item ${tab.id === active ? 'active' : ''}`,
          'aria-current': tab.id === active ? 'page' : null,
          onclick: () => {
            if (tab.id === active) return;
            sfx.play('tap');
            navigate(tab.hash);
          },
        },
        h('span', { class: 'bn-ico', html: icon(tab.icon) }),
        h('span', { class: 'bn-label' }, tab.label),
      ),
    );
  }
}

// ---------- routing ----------
function parseRoute() {
  const hash = location.hash.replace(/^#/, '');
  const legacy = hash.match(/^\/play\/(\w+)/);
  if (legacy && gameById(legacy[1])) return { view: 'play', id: legacy[1], mode: null };
  if (!hash || hash === 'home') return { view: 'home' };
  if (hash === 'favs' || hash === 'trophies' || hash === 'prefs') return { view: hash };
  const m = hash.match(/^([a-z]+)(?:-(play)(?:-(\w+))?)?$/);
  if (m && gameById(m[1])) {
    const g = gameById(m[1]);
    if (m[2] || g.lobby === false) return { view: 'play', id: g.id, mode: m[3] || null };
    return { view: 'lobby', id: g.id };
  }
  return { view: 'home' };
}

const lobbyHash = (id) => (gameById(id).lobby === false ? '#' : `#${id}`);
const playHash = (id, mode) => `#${id}-play${mode ? '-' + mode : ''}`;

function navigate(hash) {
  if ((location.hash || '#') === hash) route();
  else location.hash = hash;
}

let prevRoute = null;
window.addEventListener('hashchange', () => {
  const r = parseRoute();
  const leavingGame = current && !(r.view === 'play' && r.id === current.id && r.mode === current.mode);
  if (leavingGame && !skipBackCheck && current.back) {
    // Android back button: let the game go back to its own menu first.
    let handled = false;
    try {
      handled = current.back() === true;
    } catch (e) {
      console.error(e);
    }
    if (handled) {
      history.pushState(null, '', playHash(current.id, current.mode));
      return;
    }
  }
  skipBackCheck = false;
  route();
});

// Goes "up" one level. Uses the browser history when the parent page is the
// previous entry, so the Android back button and ours stay in sync.
function goUp(targetHash) {
  skipBackCheck = true;
  if (prevRoute === targetHash) history.back();
  else navigate(targetHash);
}

let lastHere = null;
function route() {
  const r = parseRoute();
  const here = location.hash || '#';
  if (here !== lastHere) {
    prevRoute = lastHere;
    lastHere = here;
  }
  if (r.view !== 'play') unmountGame();
  if (r.view === 'home' && !splashSeen()) showSplash();
  else if (r.view === 'home') showHome();
  else if (r.view === 'favs') showFavorites();
  else if (r.view === 'trophies') showTrophies();
  else if (r.view === 'prefs') showPrefs();
  else if (r.view === 'lobby') showLobby(r.id);
  else if (r.view === 'play') openGame(r.id, r.mode);
}

function unmountGame() {
  loadToken++;
  if (!current) return;
  try {
    if (typeof current.cleanup === 'function') current.cleanup();
  } catch (e) {
    console.error(e);
  }
  current = null;
}

// ---------- splash ----------
let splashShown = false;
function splashSeen() {
  if (splashShown) return true;
  try {
    return sessionStorage.getItem('ng-splash') === '1';
  } catch {
    return false;
  }
}

function showSplash() {
  setTopbar({ hidden: true });
  setBottomNav(null);
  document.title = APP_NAME;
  const [first, ...rest] = APP_NAME.split(' ');
  const enter = () => {
    sfx.play('select');
    splashShown = true;
    try {
      sessionStorage.setItem('ng-splash', '1');
    } catch {
      /* ignore */
    }
    showHome();
  };
  clear(stage).append(
    h(
      'div',
      { class: 'splash' },
      h('div', { class: 'splash-rays', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'splash-sparkles', 'aria-hidden': 'true' },
        Array.from({ length: 16 }, (_, i) => h('i', { style: { left: `${(i * 37 + 5) % 100}%`, top: `${(i * 53 + 7) % 64}%`, animationDelay: `${(i % 7) * 0.45}s` } })),
      ),
      h(
        'div',
        { class: 'splash-logo' },
        h('span', { class: 'sl-crown', html: icon('crown') }),
        h('h1', { class: 'sl-title' }, h('span', { class: 'sl-1' }, first), rest.length ? h('span', { class: 'sl-2' }, rest.join(' ')) : null),
        h('div', { class: 'sl-ribbon' }, APP_BY),
      ),
      h('div', { class: 'splash-art', html: splashCollage() }),
      h('button', { class: 'btn primary big splash-play', onclick: enter }, t('play'), h('span', { class: 'btn-ico', html: icon('play') })),
    ),
  );
}

// ---------- home tabs ----------
function homeHeader() {
  setTopbar({
    left: iconBtn('user', t('profile'), () => navigate('#trophies'), 'gold round'),
    center: h(
      'div',
      { class: 'tb-center tb-logo' },
      h('span', { class: 'tb-crown big', html: icon('crown') }),
      h('div', { class: 'tb-name' }, APP_NAME),
      h('div', { class: 'tb-by' }, APP_BY),
    ),
    right: iconBtn('gear', t('settings'), () => navigate('#prefs'), 'gold'),
  });
}

function tile(g, i = 0) {
  return h(
    'button',
    {
      class: 'tile rise-in',
      style: { animationDelay: `${i * 35}ms` },
      onclick: () => {
        sfx.play('select');
        navigate(g.lobby === false ? playHash(g.id) : lobbyHash(g.id));
      },
    },
    h('span', { class: 'tile-art', html: gameArt(g.id) }),
    h('span', { class: 'tile-text' }, h('span', { class: 'tile-name' }, pick(g.name)), h('span', { class: 'tile-sub' }, pick(g.sub))),
  );
}

function showHome() {
  document.title = APP_NAME;
  homeHeader();
  setBottomNav('home');

  const grid = h('div', { class: 'tile-grid' });
  const empty = h('p', { class: 'muted empty-search', hidden: true }, t('noResults'));
  const render = () => {
    clear(grid);
    const q = norm(homeState.query);
    const list = GAMES.filter((g) => homeState.cat === 'all' || g.cat === homeState.cat).filter(
      (g) => !q || norm(pick(g.name)).includes(q) || norm(pick(g.sub)).includes(q),
    );
    list.forEach((g, i) => grid.append(tile(g, i)));
    empty.hidden = list.length > 0;
  };

  const input = h('input', {
    id: 'game-search',
    class: 'search-input',
    type: 'search',
    placeholder: t('search'),
    value: homeState.query,
    autocomplete: 'off',
    oninput: (e) => {
      homeState.query = e.target.value;
      render();
    },
  });
  const chips = h('div', { class: 'cat-chips', role: 'tablist' });
  const renderChips = () => {
    clear(chips);
    for (const c of CATEGORIES) {
      chips.append(
        h(
          'button',
          {
            class: `cat-chip ${homeState.cat === c.id ? 'active' : ''}`,
            role: 'tab',
            'aria-selected': String(homeState.cat === c.id),
            onclick: () => {
              sfx.play('tap');
              homeState.cat = c.id;
              renderChips();
              render();
            },
          },
          pick(c.label),
        ),
      );
    }
  };
  renderChips();
  render();

  clear(stage).append(
    h('div', { class: 'screen home' }, h('label', { class: 'search' }, h('span', { class: 'search-ico', html: icon('search') }), input), chips, grid, empty),
  );
}

function favorites() {
  return prefs.get('favorites', []);
}

function toggleFavorite(id) {
  const favs = favorites();
  const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
  prefs.set('favorites', next);
  return next.includes(id);
}

function showFavorites() {
  document.title = `${t('navFavs')} · ${APP_NAME}`;
  homeHeader();
  setBottomNav('favs');
  const favs = GAMES.filter((g) => favorites().includes(g.id));
  const body = favs.length
    ? h('div', { class: 'tile-grid' }, favs.map((g, i) => tile(g, i)))
    : h('div', { class: 'empty-state' }, h('span', { class: 'es-ico', html: icon('heartOutline') }), h('b', null, t('favEmptyTitle')), h('p', null, t('favEmptyText')));
  clear(stage).append(h('div', { class: 'screen' }, h('h2', { class: 'page-title' }, t('navFavs')), body));
}

// ---------- achievements ----------
function plays(id) {
  return prefs.get(`plays:${id}`, 0);
}

function trophiesFor(g) {
  const lvl = gameXP(g.id) > 0 ? levelInfo(gameXP(g.id)).level : 0;
  const rules = [
    { ok: plays(g.id) >= 1, label: t('trFirst') },
    { ok: plays(g.id) >= 10, label: t('trTen') },
    { ok: lvl >= 5, label: t('trLevel', { n: 5 }) },
    { ok: lvl >= 15, label: t('trLevel', { n: 15 }) },
    { ok: lvl >= 30, label: t('trLevel', { n: 30 }) },
  ];
  return rules.map((r, i) => ({ ...r, icon: g.trophies[i] }));
}

function trophyRow(g) {
  return h(
    'div',
    { class: 'trophy-row' },
    trophiesFor(g).map((tr) => h('span', { class: `trophy ${tr.ok ? 'on' : ''}`, title: tr.label }, h('span', { class: 'trophy-ico' }, tr.icon))),
  );
}

async function showTrophyList(g) {
  sfx.play('tap');
  const body = h(
    'div',
    { class: 'trophy-list' },
    trophiesFor(g).map((tr) =>
      h('div', { class: `tl-row ${tr.ok ? 'on' : ''}` }, h('span', { class: 'tl-ico' }, tr.icon), h('span', { class: 'tl-label' }, tr.label), h('span', { class: 'tl-state', html: tr.ok ? '✓' : icon('lock') })),
    ),
  );
  await modal({ title: `${t('trophies')} · ${pick(g.name)}`, body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
}

function profileCard() {
  const info = levelInfo(totalXP());
  const days = streak();
  return h(
    'section',
    { class: 'profile-card' },
    h('div', { class: 'pc-avatar' }, h('span', { class: 'pc-level' }, info.level)),
    h(
      'div',
      { class: 'pc-body' },
      h('div', { class: 'pc-rank' }, pick(rankFor(info.level))),
      h('div', { class: 'pc-title' }, `${t('level')} ${info.level}`),
      h('div', { class: 'progress pc-bar' }, h('i', { style: { width: `${Math.round(info.progress * 100)}%` } })),
      h('div', { class: 'pc-xp' }, `${info.into} / ${info.need} XP`),
    ),
    h('div', { class: 'pc-streak', title: t('streak') }, h('span', { class: 'pc-fire' }, days ? '🔥' : '💤'), h('b', null, days), h('small', null, t('days'))),
  );
}

function showTrophies() {
  document.title = `${t('navTrophies')} · ${APP_NAME}`;
  homeHeader();
  setBottomNav('trophies');
  const unlocked = GAMES.reduce((n, g) => n + trophiesFor(g).filter((x) => x.ok).length, 0);
  clear(stage).append(
    h(
      'div',
      { class: 'screen' },
      h('h2', { class: 'page-title' }, t('navTrophies')),
      profileCard(),
      h('div', { class: 'section-head' }, h('b', null, t('perGame')), h('span', { class: 'gold-text' }, `${unlocked} / ${GAMES.length * 5}`)),
      h(
        'div',
        { class: 'stack' },
        GAMES.map((g) =>
          h(
            'button',
            { class: 'trophy-game', onclick: () => showTrophyList(g) },
            h('span', { class: 'tg-art', html: gameArt(g.id) }),
            h('span', { class: 'tg-body' }, h('b', null, pick(g.name)), trophyRow(g)),
            h('span', { class: 'tg-chev', html: icon('chevron') }),
          ),
        ),
      ),
    ),
  );
}

// ---------- settings ----------
function langSwitch(onChange) {
  const wrap = h('div', { class: 'lang-switch', role: 'group', 'aria-label': t('language') });
  for (const l of LANGS) {
    wrap.append(
      h(
        'button',
        {
          class: l.code === getLang() ? 'active' : '',
          'aria-pressed': String(l.code === getLang()),
          title: l.label,
          onclick: () => {
            sfx.play('tap');
            setLang(l.code);
            onChange && onChange();
          },
        },
        h('img', { src: flagSrc(l.flag), alt: '' }),
        l.short,
      ),
    );
  }
  return wrap;
}

function settingsRows(rerender, { inGame = false } = {}) {
  const sw = (on, fn) =>
    h('button', {
      class: `switch ${on ? 'on' : ''}`,
      role: 'switch',
      'aria-checked': String(on),
      onclick: () => {
        fn();
        sfx.play('tap');
        rerender();
      },
    });
  return [
    h('div', { class: 'settings-row' }, h('span', null, t('language')), langSwitch(rerender)),
    h('div', { class: 'settings-row' }, h('span', null, t('sound')), sw(!sfx.muted, () => (sfx.muted = !sfx.muted))),
    h('div', { class: 'settings-row' }, h('span', null, t('vibration')), sw(sfx.vibration, () => (sfx.vibration = !sfx.vibration))),
    inGame
      ? null
      : h(
          'button',
          {
            class: 'btn danger block',
            onclick: async () => {
              const ok = await modal({
                title: t('resetConfirmTitle'),
                body: t('resetConfirmText'),
                actions: [
                  { label: t('erase'), value: true, danger: true },
                  { label: t('cancel'), value: false },
                ],
              });
              if (ok) {
                const lang = getLang();
                clearAll();
                prefs.set('lang', lang);
                toast(t('resetDone'));
                rerender();
              }
            },
          },
          t('resetProgress'),
        ),
  ].filter(Boolean);
}

function showPrefs() {
  document.title = `${t('navSettings')} · ${APP_NAME}`;
  homeHeader();
  setBottomNav('prefs');
  clear(stage).append(
    h(
      'div',
      { class: 'screen' },
      h('h2', { class: 'page-title' }, t('navSettings')),
      h('div', { class: 'panel' }, settingsRows(() => showPrefs())),
      h('div', { class: 'panel about' }, h('b', null, t('about')), h('p', null, t('aboutText'))),
      h('div', { class: 'footer-note' }, `${APP_NAME} · ${APP_BY}`),
    ),
  );
}

async function openGameSettings() {
  sfx.play('tap');
  const langBefore = getLang();
  const body = h('div', { class: 'stack settings-modal' });
  const render = () => clear(body).append(...settingsRows(render, { inGame: true }));
  render();
  await modal({ title: t('settings'), body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  if (getLang() !== langBefore) {
    if (current) openGame(current.id, current.mode, true); // remount in the new language
    else route();
  }
}

onLangChange(() => {
  if (!current && !document.querySelector('.modal-overlay')) route();
});

// ---------- lobby ----------
function showLobby(id) {
  const g = gameById(id);
  document.title = `${pick(g.name)} · ${APP_NAME}`;
  setBottomNav(null);
  setTopbar({
    left: iconBtn('back', t('back'), () => {
      sfx.play('tap');
      goUp('#');
    }, 'gold round'),
    center: crownTitle(pick(g.name)),
    right: iconBtn('gear', t('settings'), openGameSettings, 'gold round'),
  });

  const isFav = favorites().includes(id);
  const fav = h('button', {
    class: `fav-btn ${isFav ? 'on' : ''}`,
    'aria-label': t('favorite'),
    'aria-pressed': String(isFav),
    html: icon(isFav ? 'heart' : 'heartOutline'),
    onclick: () => {
      const on = toggleFavorite(id);
      sfx.play(on ? 'pop' : 'tap');
      fav.classList.toggle('on', on);
      fav.setAttribute('aria-pressed', String(on));
      fav.innerHTML = icon(on ? 'heart' : 'heartOutline');
      toast(on ? t('favAdded') : t('favRemoved'));
    },
  });

  const play = (mode) => {
    sfx.play('select');
    navigate(playHash(id, mode));
  };

  clear(stage).append(
    h(
      'div',
      { class: 'screen lobby' },
      h(
        'div',
        { class: 'lobby-hero rise-in' },
        h('span', { class: 'lobby-icon', html: gameArt(id) }),
        h('div', { class: 'lobby-titles' }, h('h1', null, pick(g.name)), h('div', { class: 'lobby-sub' }, pick(g.sub))),
        fav,
      ),
      h('div', { class: 'lobby-preview rise-in', html: gamePreview(id) }),
      h('button', { class: 'btn primary big block play-now rise-in', onclick: () => play(null) }, h('span', { class: 'btn-ico', html: icon('play') }), t('playNow')),
      h('p', { class: 'lobby-about' }, pick(g.about)),
      g.modes.length
        ? h(
            'div',
            { class: 'mode-grid', style: { gridTemplateColumns: `repeat(${g.modes.length}, minmax(0, 1fr))` } },
            g.modes.map((m) => h('button', { class: 'mode-btn', onclick: () => play(m.id) }, h('span', { class: 'mode-ico', html: icon(m.icon) }), h('span', null, pick(m.label)))),
          )
        : null,
      h(
        'section',
        { class: 'panel trophies-panel' },
        h('div', { class: 'section-head' }, h('b', null, t('trophies')), h('button', { class: 'link-btn', onclick: () => showTrophyList(g) }, t('seeAll'), h('span', { class: 'link-chev', html: icon('chevron') }))),
        trophyRow(g),
      ),
    ),
  );
}

// ---------- XP feedback ----------
function celebrateXP({ gained, before, after }) {
  const pill = h('div', { class: 'xp-pill' }, h('span', null, '⭐'), `+${gained} XP`);
  document.body.append(pill);
  setTimeout(() => pill.remove(), 1900);
  if (after.level > before.level) {
    setTimeout(() => {
      sfx.play('levelup');
      confetti(90);
      const banner = h(
        'div',
        { class: 'levelup', role: 'status' },
        h('div', { class: 'lu-badge' }, after.level),
        h('div', { class: 'lu-text' }, h('small', null, t('levelUp')), h('b', null, `${t('level')} ${after.level}`), h('span', null, pick(rankFor(after.level)))),
      );
      document.body.append(banner);
      setTimeout(() => banner.classList.add('out'), 2600);
      setTimeout(() => banner.remove(), 3100);
    }, 500);
  }
}

// ---------- games ----------
async function openGame(id, mode = null, force = false) {
  const meta = gameById(id);
  if (!force && current && current.id === id && current.mode === mode) return;
  unmountGame();
  const token = loadToken;
  document.title = `${pick(meta.name)} · ${APP_NAME}`;
  setBottomNav(null);

  const parent = lobbyHash(id);
  const backBtn = iconBtn('back', t('back'), () => {
    sfx.play('tap');
    if (current && current.back) {
      let handled = false;
      try {
        handled = current.back() === true;
      } catch (e) {
        console.error(e);
      }
      if (handled) return;
    }
    goUp(parent);
  }, 'gold round');
  const titleBox = crownTitle(pick(meta.name));
  const titleEl = titleBox.querySelector('.topbar-title');
  const slot = h('div', { class: 'tb-slot' });
  setTopbar({ left: backBtn, center: titleBox, right: [slot, iconBtn('gear', t('settings'), openGameSettings, 'gold round')] });
  clear(stage).append(h('div', { class: 'screen center' }, h('div', { class: 'spinner' }), h('div', { class: 'muted' }, t('loading'))));

  let mod;
  try {
    mod = await meta.load();
  } catch (e) {
    console.error(e);
    if (token !== loadToken) return;
    clear(stage).append(
      h('div', { class: 'screen center' }, h('div', { class: 'big-emoji' }, '😵'), h('p', { class: 'muted' }, t('loadError')), h('button', { class: 'btn primary', onclick: () => openGame(id, mode, true) }, t('retry'))),
    );
    return;
  }
  if (token !== loadToken) return;

  const root = h('div', { class: `game g-${id}` });
  clear(stage).append(root);
  touchStreak();
  setLastPlayed(id);
  prefs.set(`plays:${id}`, plays(id) + 1);
  current = { id, mode, cleanup: null, back: null };
  const entry = current;

  const ctx = {
    id,
    mode,
    lang: getLang(),
    makeT: (strings) => makeT(strings),
    pick,
    store: createStore(`game:${id}`),
    sfx,
    ui: { h, clear, toast, modal, confetti },
    loadCSS,
    setTitle: (text) => {
      titleEl.textContent = text || pick(meta.name);
    },
    setHeaderRight: (node) => {
      clear(slot);
      if (node) slot.append(node);
    },
    onBack: (fn) => {
      entry.back = fn;
    },
    addXP: (amount) => {
      const result = addXP(amount, id);
      if (result.gained) celebrateXP(result);
      return result;
    },
    exit: () => goUp(parent),
  };

  try {
    const cleanup = await mod.mount(root, ctx);
    if (token !== loadToken) {
      if (typeof cleanup === 'function') cleanup();
      return;
    }
    entry.cleanup = cleanup;
  } catch (e) {
    console.error(e);
    clear(root).append(h('div', { class: 'screen center' }, h('div', { class: 'big-emoji' }, '😵'), h('p', { class: 'muted' }, String(e && e.message))));
  }
}

// ---------- boot ----------
route();

if ('serviceWorker' in navigator && location.protocol === 'https:' && !/^(localhost|127\.)/.test(location.hostname)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
