// Tricolor do Milhão — a private fan quiz about the history of São Paulo FC (unofficial).
//   ctx.mode: main | quick | themes | time | daily | expert → straight into that mode · none → home.
import STRINGS from './strings.js';
import { h } from '../../js/core/ui.js';
import { music } from '../../js/core/music.js';
import { getBank, validateBank } from './questions/index.js';
import { MIN_BANK_TO_PLAY, MODE_IDS } from './config.js';
import { makeScope, createSheets } from './kit.js';
import { createAudio } from './audio.js';
import { stadiumBg, defs, ico } from './art.js';
import { sanitizeProfile, newDaily } from './stats.js';
import { restore } from './session.js';
import * as screens from './screens.js';
import { startMode, resumeMatch } from './play.js';

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  let unmounted = false;

  // ---- bank (real, validated). A test-only hook may supply a fixture when the real bank is tiny. ----
  let bank = getBank();
  let usingFixture = false;
  if (bank.length < MIN_BANK_TO_PLAY && Array.isArray(globalThis.__TRICOLOR_TEST_BANK)) {
    bank = validateBank([{ file: 'fixture', list: globalThis.__TRICOLOR_TEST_BANK }]).valid;
    usingFixture = true;
  }

  const bg = h('div', { class: 'tc-bg', html: stadiumBg(7) });
  const views = h('div', { class: 'tc-views' });
  const layer = h('div', { class: 'tc-layer' });
  const shell = h('div', { class: 'tc-app' }, h('div', { html: defs() }), bg, h('div', { class: 'tc-vignette' }), views, layer);
  root.append(shell);
  const sheets = createSheets(layer);

  const audio = createAudio({ store: ctx.store, isMuted: () => ctx.sfx.muted });
  const gesture = () => audio.unlock();
  root.addEventListener('pointerdown', gesture, true);
  root.addEventListener('keydown', gesture, true);
  music.setLevel(0); // the game has its own music; the shell music stays silent while playing

  const P = sanitizeProfile(ctx.store.get('profile', null));
  const daily = { ...newDaily(), ...(ctx.store.get('daily', null) || {}) };
  if (!daily.hist || typeof daily.hist !== 'object') daily.hist = {};

  // ---- view manager ----
  let cur = null;
  const pending = new Set();
  function show(build, { bgMode = 'stands', back = null, scene = null } = {}) {
    if (unmounted) return null;
    sheets.closeAll();
    if (cur) {
      cur.scope.dispose();
      const old = cur.el;
      old.classList.add('tc-out');
      old.inert = true;
      const id = setTimeout(() => {
        pending.delete(id);
        old.remove();
      }, 240);
      pending.add(id);
    }
    const el = h('div', { class: 'tc-view' });
    views.append(el);
    const scope = makeScope();
    cur = { el, scope, back };
    bg.className = `tc-bg tc-bg-${bgMode}`;
    shell.dataset.bg = bgMode;
    if (scene) audio.scene(scene);
    ctx.setTitle(undefined);
    build(el, scope);
    return el;
  }
  ctx.onBack(() => {
    if (sheets.back()) return true;
    if (!cur) return false;
    if (cur.back) {
      const r = cur.back();
      return r !== false;
    }
    return false;
  });

  // ---- header: sound button ----
  const sndBtn = h('button', { class: 'icon-btn tc-snd', 'aria-label': t('audio.title'), html: ico('sound'), onclick: () => screens.audioSheet(app) });
  ctx.setHeaderRight(sndBtn);
  const refreshSnd = () => (sndBtn.innerHTML = ico(audio.prefs.mute ? 'mute' : 'sound'));

  const app = {
    ctx,
    t,
    lang: ctx.lang,
    root,
    h,
    bank,
    usingFixture,
    audio,
    refreshSnd,
    sheets,
    show,
    P,
    daily,
    saveP: () => ctx.store.set('profile', P),
    saveDaily: () => ctx.store.set('daily', daily),
    get recent() {
      return ctx.store.get('recent', []);
    },
    setRecent: (v) => ctx.store.set('recent', v),
    saveResume: (st) => ctx.store.set('resume', st),
    clearResume: () => ctx.store.remove('resume'),
    getResume: () => {
      const r = restore(ctx.store.get('resume', null), bank);
      return r;
    },
    leave: () => ctx.exit(),
    gotoHome: () => screens.home(app),
    gotoModes: () => screens.modes(app),
    start: (mode, opts) => startMode(app, mode, opts),
    resume: (st) => resumeMatch(app, st),
    toast: (m) => ctx.ui?.toast?.(m),
    get unmounted() {
      return unmounted;
    },
  };
  refreshSnd();

  // ---- entry ----
  if (ctx.mode && MODE_IDS.includes(ctx.mode)) screens.enterMode(app, ctx.mode);
  else screens.home(app);

  return () => {
    unmounted = true;
    root.removeEventListener('pointerdown', gesture, true);
    root.removeEventListener('keydown', gesture, true);
    if (cur) cur.scope.dispose();
    pending.forEach(clearTimeout);
    sheets.closeAll();
    audio.dispose();
  };
}
