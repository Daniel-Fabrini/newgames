// App shell: hub screen, hash router, game lifecycle, settings.
//   #             hub
//   #<id>         a game (games/<id>/main.js); #/play/<id> is accepted too
// Plain #name hashes keep links working when the app is embedded (artifact viewers
// only pass simple hashes through).

import { GAMES } from './games.js';
import { LANGS, getLang, setLang, makeT, pick, onLangChange } from './core/i18n.js';
import { createStore, clearAll } from './core/store.js';
import { sfx } from './core/sfx.js';
import { h, clear, toast, modal, confetti, loadCSS } from './core/ui.js';
import STRINGS from './core/strings.js';
import { addXP, levelInfo, totalXP, gameXP, streak, touchStreak, rankFor, lastPlayed, setLastPlayed } from './core/progress.js';

const t = makeT(STRINGS);
const app = document.getElementById('app');

const ICONS = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};

function iconButton(name, label, onclick) {
  return h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick, html: ICONS[name] });
}

const flagSrc = (code) => new URL(`../assets/flags/${code}.svg`, import.meta.url).href;

// ---------- layout ----------
const topbar = h('header', { class: 'topbar' });
const stage = h('main', { id: 'stage' });
app.append(topbar, stage);

let current = null; // { id, cleanup, back }
let loadToken = 0;
let skipBackCheck = false;

function setTopbar({ left = null, title = '', right = null }) {
  clear(topbar);
  const titleEl = h('div', { class: 'topbar-title' }, title);
  const rightEl = h('div', { class: 'topbar-right' }, right);
  topbar.append(left || h('span', { style: { width: '4px' } }), titleEl, rightEl);
  return { titleEl, rightEl };
}

// ---------- routing ----------
function parseRoute() {
  const m = location.hash.match(/^#(?:\/play\/)?([\w-]+)/);
  return m && GAMES.some((g) => g.id === m[1]) ? { view: 'play', id: m[1] } : { view: 'hub' };
}

const gameHash = (id) => `#${id}`;

function navigate(hash) {
  if ((location.hash || '#') === hash) route();
  else location.hash = hash;
}

window.addEventListener('hashchange', () => {
  const r = parseRoute();
  const leavingGame = current && !(r.view === 'play' && r.id === current.id);
  if (leavingGame && !skipBackCheck && current.back) {
    // Android back button: let the game go back to its own menu first.
    let handled = false;
    try {
      handled = current.back() === true;
    } catch (e) {
      console.error(e);
    }
    if (handled) {
      history.pushState(null, '', gameHash(current.id));
      return;
    }
  }
  skipBackCheck = false;
  route();
});

function exitToHub() {
  skipBackCheck = true;
  navigate('#');
}

function route() {
  const r = parseRoute();
  if (r.view === 'play') openGame(r.id);
  else showHub();
}

function unmountCurrent() {
  if (!current) return;
  try {
    if (typeof current.cleanup === 'function') current.cleanup();
  } catch (e) {
    console.error(e);
  }
  current = null;
}

// ---------- hub ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (!current) showHub();
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

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

function ring(progress, size = 64, stroke = 6) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'ring');
  svg.innerHTML = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#ringGrad)" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - progress)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient></defs>`;
  return svg;
}

function profileCard() {
  const info = levelInfo(totalXP());
  const rank = rankFor(info.level);
  const days = streak();
  return h(
    'section',
    { class: 'profile-card rise-in' },
    h('div', { class: 'pc-avatar' }, ring(info.progress, 72, 6), h('span', { class: 'pc-level' }, info.level)),
    h(
      'div',
      { class: 'pc-body' },
      h('div', { class: 'pc-rank' }, pick(rank)),
      h('div', { class: 'pc-title' }, `${t('level')} ${info.level}`),
      h('div', { class: 'progress pc-bar' }, h('i', { style: { width: `${Math.round(info.progress * 100)}%` } })),
      h('div', { class: 'pc-xp' }, `${info.into} / ${info.need} XP · ${t('toNext')}`),
    ),
    h('div', { class: 'pc-streak', title: t('streak') }, h('span', { class: 'pc-fire' }, days ? '🔥' : '💤'), h('b', null, days), h('small', null, t('days'))),
  );
}

function continueCard(g) {
  return h(
    'button',
    {
      class: 'continue-card rise-in',
      style: { background: g.bg },
      onclick: () => {
        sfx.play('select');
        navigate(gameHash(g.id));
      },
    },
    h('span', { class: 'cc-icon', 'aria-hidden': 'true' }, g.icon),
    h('span', { class: 'cc-body' }, h('small', null, t('continue')), h('b', null, pick(g.name))),
    h('span', { class: 'cc-play', 'aria-hidden': 'true' }, '▶'),
  );
}

function showHub() {
  loadToken++;
  unmountCurrent();
  document.title = 'NewGames';
  setTopbar({
    left: h('span', { style: { width: '8px' } }),
    title: h('span', { class: 'logo', html: 'New<b>Games</b>' }),
    right: [langSwitch(), iconButton('gear', t('settings'), openSettings)],
  });

  const last = GAMES.find((g) => g.id === lastPlayed());
  const grid = h('div', { class: 'game-grid' });
  GAMES.forEach((g, i) => {
    const lvl = gameXP(g.id) > 0 ? levelInfo(gameXP(g.id)).level : 0;
    grid.append(
      h(
        'button',
        {
          class: 'game-card rise-in',
          style: { background: g.bg, animationDelay: `${i * 40}ms` },
          onclick: () => {
            sfx.play('select');
            navigate(gameHash(g.id));
          },
        },
        h('span', { class: 'gc-shine', 'aria-hidden': 'true' }),
        h('span', { class: 'gc-icon', 'aria-hidden': 'true' }, g.icon),
        lvl ? h('span', { class: 'gc-tag' }, `${t('lvl')} ${lvl}`) : null,
        h('span', { class: 'gc-name' }, pick(g.name)),
        h('span', { class: 'gc-desc' }, pick(g.desc)),
      ),
    );
  });

  let install = null;
  if (!isStandalone()) {
    if (deferredInstall) {
      install = h(
        'div',
        { class: 'install-banner' },
        h('span', { style: { fontSize: '28px' } }, '📲'),
        h('span', { class: 'ib-text' }, t('install')),
        h('button', {
          class: 'btn small primary',
          onclick: async () => {
            deferredInstall.prompt();
            await deferredInstall.userChoice.catch(() => {});
            deferredInstall = null;
            showHub();
          },
        }, t('installBtn')),
      );
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      install = h('div', { class: 'install-banner' }, h('span', { style: { fontSize: '28px' } }, '📲'), h('span', { class: 'ib-text' }, t('iosInstall')));
    }
  }

  const screen = h(
    'div',
    { class: 'screen hub' },
    profileCard(),
    install,
    last ? continueCard(last) : null,
    h('div', { class: 'section-title' }, t('allGames')),
    grid,
    h('div', { class: 'footer-note' }, `${GAMES.length} ${t('games')} · PT · EN · ES`),
  );
  clear(stage).append(screen);
}

async function openSettings() {
  sfx.play('tap');
  const body = h('div', { class: 'stack', style: { textAlign: 'left' } });
  const render = () => {
    clear(body);
    const sw = (on, fn) =>
      h('button', {
        class: `switch ${on ? 'on' : ''}`,
        role: 'switch',
        'aria-checked': String(on),
        onclick: () => {
          fn();
          render();
        },
      });
    body.append(
      h('div', { class: 'settings-row' }, t('language'), langSwitch(() => render())),
      h('div', { class: 'settings-row' }, t('sound'), sw(!sfx.muted, () => (sfx.muted = !sfx.muted))),
      h('div', { class: 'settings-row' }, t('vibration'), sw(sfx.vibration, () => (sfx.vibration = !sfx.vibration))),
      h('button', {
        class: 'btn danger block',
        style: { marginTop: '8px' },
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
            createStore('app').set('lang', lang);
            toast(t('resetDone'));
          }
        },
      }, t('resetProgress')),
      h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, h('b', null, t('about') + ': '), t('aboutText')),
    );
  };
  render();
  await modal({ title: t('settings'), body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true });
  if (!current) showHub();
}

onLangChange(() => {
  if (!current) showHub();
});

// ---------- XP feedback ----------
function celebrateXP({ gained, before, after }) {
  const pill = h('div', { class: 'xp-pill' }, h('span', null, '⭐'), `+${gained} XP`);
  document.body.append(pill);
  setTimeout(() => pill.remove(), 1900);
  if (after.level > before.level) {
    setTimeout(() => {
      sfx.play('levelup');
      confetti(90);
      const rank = rankFor(after.level);
      const banner = h(
        'div',
        { class: 'levelup', role: 'status' },
        h('div', { class: 'lu-badge' }, after.level),
        h('div', { class: 'lu-text' }, h('small', null, t('levelUp')), h('b', null, `${t('level')} ${after.level}`), h('span', null, pick(rank))),
      );
      document.body.append(banner);
      setTimeout(() => banner.classList.add('out'), 2600);
      setTimeout(() => banner.remove(), 3100);
    }, 500);
  }
}

// ---------- games ----------
async function openGame(id) {
  const meta = GAMES.find((g) => g.id === id);
  const token = ++loadToken;
  unmountCurrent();
  document.title = `${pick(meta.name)} · NewGames`;

  const backBtn = iconButton('back', t('back'), () => {
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
    exitToHub();
  });
  const { titleEl, rightEl } = setTopbar({ left: backBtn, title: pick(meta.name) });
  clear(stage).append(h('div', { class: 'screen center' }, h('div', { class: 'spinner' }), h('div', { class: 'muted' }, t('loading'))));

  let mod;
  try {
    mod = await meta.load();
  } catch (e) {
    console.error(e);
    if (token !== loadToken) return;
    clear(stage).append(
      h('div', { class: 'screen center' }, h('div', { class: 'big-emoji' }, '😵'), h('p', { class: 'muted' }, t('loadError')),
        h('button', { class: 'btn primary', onclick: () => openGame(id) }, t('retry'))),
    );
    return;
  }
  if (token !== loadToken) return;

  const root = h('div', { class: `game g-${id}` });
  clear(stage).append(root);
  touchStreak();
  setLastPlayed(id);
  current = { id, cleanup: null, back: null };
  const entry = current;

  const ctx = {
    id,
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
      clear(rightEl);
      if (node) rightEl.append(node);
    },
    onBack: (fn) => {
      entry.back = fn;
    },
    addXP: (amount) => {
      const result = addXP(amount, id);
      if (result.gained) celebrateXP(result);
      return result;
    },
    exit: exitToHub,
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
