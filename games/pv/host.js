// PlayVerse host — runs one of the 10 PlayVerse games inside DA Games.
//
// The games are the real PlayVerse app (React, vendored in /playverse and built by
// tools/build-pv.mjs into games/pv/app/). Each one runs in a full-size same-origin iframe
// in "embed mode" (?embed=1): only the game page, black & gold theme, no service worker.
//
//   iframe → host   { type: 'pv-ready' }                              page is up
//   iframe → host   { type: 'pv-exit' }                               leave the game (→ lobby)
//   iframe → host   { type: 'pv-result', game, outcome, score, level} a real match/level finished → XP
//   iframe → host   { type: 'pv-handled' }                            answer to pv-back: stayed inside
//   host → iframe   { type: 'pv-back' }                               header / Android back button
//
// Lobby modes (ctx.mode) are passed on as ?mode=<id>; the games use them to preselect or start.

const PV_ID = {
  blocks: 'block-puzzle',
  water: 'water-sort',
  snake: 'snake',
  numbers: 'number-match',
  solitaire: 'solitaire',
  checkers: 'checkers',
  domino: 'domino',
  sudoku: 'sudoku',
  g2048: 'game-2048',
  crossword: 'crossword',
};

// XP per finished match. Abandoned / unfinished runs ("ended", "loss") give little, and results that
// arrive right after another one are ignored, so restarting over and over cannot farm XP.
const XP = { win: 20, level: 25, draw: 10, loss: 5, ended: 6 };
const COOLDOWN_MS = { win: 4000, level: 4000, draw: 12000, loss: 20000, ended: 20000 };
const BACK_TIMEOUT_MS = 700;

export function xpFor(outcome, level, score) {
  if (outcome === 'ended' && score === 0) return 0; // nothing achieved
  if (outcome === 'win') return level ? XP.level : XP.win;
  return XP[outcome] || 0;
}

export function mount(root, ctx, gameId) {
  const pvId = PV_ID[gameId];
  if (!pvId) throw new Error(`Unknown PlayVerse game: ${gameId}`);

  const params = new URLSearchParams({
    embed: '1',
    lang: ctx.lang || 'pt',
    sound: ctx.sfx && ctx.sfx.muted ? '0' : '1',
    haptics: ctx.sfx && ctx.sfx.vibration === false ? '0' : '1',
  });
  if (ctx.mode) params.set('mode', ctx.mode);
  const src = `${new URL('./app/index.html', import.meta.url).href.split('?')[0]}?${params}#/game/${pvId}`;

  const frame = document.createElement('iframe');
  frame.className = 'pv-frame';
  frame.title = 'PlayVerse';
  frame.setAttribute('allow', 'fullscreen');
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#0a0a0c;color-scheme:dark;opacity:0;transition:opacity .25s';
  const loading = document.createElement('div');
  loading.className = 'screen center';
  loading.innerHTML = '<div class="spinner"></div>';
  root.append(loading, frame);

  let ready = false;
  let alive = true;
  let backTimer = 0;
  let lastXP = 0;

  const reveal = () => {
    ready = true;
    frame.style.opacity = '1';
    loading.remove();
  };
  frame.addEventListener('load', () => {
    reveal();
    try {
      frame.focus();
    } catch {
      /* ignore */
    }
  });

  const onMessage = (e) => {
    if (!alive || e.source !== frame.contentWindow) return;
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    switch (d.type) {
      case 'pv-ready':
        reveal();
        break;
      case 'pv-handled':
        clearTimeout(backTimer);
        break;
      case 'pv-exit':
        clearTimeout(backTimer);
        ctx.exit();
        break;
      case 'pv-result': {
        const amount = xpFor(d.outcome, d.level === true, d.score);
        const now = Date.now();
        if (amount > 0 && now - lastXP >= (COOLDOWN_MS[d.level ? 'level' : d.outcome] || 0)) {
          lastXP = now;
          ctx.addXP?.(amount);
        }
        break;
      }
      default:
    }
  };
  window.addEventListener('message', onMessage);

  // Header / Android back: the game decides (close a dialog, leave a match…) and answers
  // 'pv-handled' or 'pv-exit'. If it does not answer, leave anyway so back never gets stuck.
  ctx.onBack(() => {
    if (!ready || !frame.contentWindow) return false;
    clearTimeout(backTimer);
    backTimer = setTimeout(() => alive && ctx.exit(), BACK_TIMEOUT_MS);
    frame.contentWindow.postMessage({ type: 'pv-back' }, '*');
    return true;
  });

  frame.src = src;

  return () => {
    alive = false;
    clearTimeout(backTimer);
    window.removeEventListener('message', onMessage);
    frame.src = 'about:blank';
    frame.remove();
    loading.remove();
  };
}
