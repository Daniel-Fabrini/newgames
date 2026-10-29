// Illustrations for the hub tiles, lobby previews and splash screen.
// Built from gradients, inline SVG, flag images and emoji so they stay
// crisp at any size (all sizes use container query units).

const flag = (code) => new URL(`../../assets/flags/${code}.svg`, import.meta.url).href;

export const TANK_SVG = `<svg viewBox="0 0 120 70" aria-hidden="true">
  <defs><linearGradient id="tk1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a39a5c"/><stop offset="1" stop-color="#5d5730"/></linearGradient>
  <linearGradient id="tk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f8750"/><stop offset="1" stop-color="#4b4626"/></linearGradient></defs>
  <rect x="60" y="17" width="58" height="6" rx="3" fill="#3d3a22"/>
  <path d="M38 14h30c5 0 8 4 8 8v6H32v-6c0-5 2-8 6-8z" fill="url(#tk2)"/>
  <rect x="44" y="9" width="12" height="7" rx="2" fill="#4b4626"/>
  <path d="M10 30h100l-8 14H18z" fill="url(#tk1)"/>
  <rect x="6" y="42" width="108" height="20" rx="10" fill="#2b2a1d"/>
  <g fill="#6d6a55">${[18, 34, 50, 66, 82, 98].map((x) => `<circle cx="${x + 2}" cy="52" r="6"/>`).join('')}</g>
  <g fill="#2b2a1d">${[18, 34, 50, 66, 82, 98].map((x) => `<circle cx="${x + 2}" cy="52" r="2.2"/>`).join('')}</g>
</svg>`;

export const BUS_SVG = `<svg viewBox="0 0 140 80" aria-hidden="true">
  <defs><linearGradient id="bs1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84a"/><stop offset="1" stop-color="#f0a400"/></linearGradient></defs>
  <rect x="6" y="8" width="128" height="58" rx="12" fill="url(#bs1)"/>
  <rect x="6" y="44" width="128" height="8" fill="#e08a00"/>
  <g fill="#2a3d5c">${[16, 40, 64, 88].map((x) => `<rect x="${x}" y="16" width="20" height="20" rx="4"/>`).join('')}<rect x="112" y="16" width="16" height="26" rx="4"/></g>
  <g fill="#9fd4ff" opacity=".55">${[16, 40, 64, 88].map((x) => `<rect x="${x + 2}" y="18" width="7" height="16" rx="2"/>`).join('')}</g>
  <circle cx="34" cy="66" r="11" fill="#222"/><circle cx="34" cy="66" r="5" fill="#bbb"/>
  <circle cx="106" cy="66" r="11" fill="#222"/><circle cx="106" cy="66" r="5" fill="#bbb"/>
  <rect x="128" y="50" width="6" height="6" rx="2" fill="#fff6c2"/>
</svg>`;

export function stickman(color) {
  return `<svg viewBox="0 0 20 34" aria-hidden="true"><circle cx="10" cy="7" r="6.5" fill="${color}"/><path d="M3 16c0-3 3-4.5 7-4.5s7 1.5 7 4.5v8c0 1-1 1.6-2 1.6v6.4a1.5 1.5 0 0 1-3 0V26h-4v6a1.5 1.5 0 0 1-3 0v-6.4c-1 0-2-.6-2-1.6v-8z" fill="${color}"/><circle cx="7.6" cy="5.6" r="1.6" fill="#fff" opacity=".5"/></svg>`;
}

// 5×5 letter grid with two found words highlighted (row 1 "MUNDO", column 4 "SOL").
const LETTERS = ['RAPXE', 'MUNDO', 'TQSLB', 'VEOAK', 'HJLIZ'];

function letterGrid() {
  return `<div class="art-ws"><span class="ws-hl h"></span><span class="ws-hl v"></span>${LETTERS.join('')
    .split('')
    .map((c) => `<i>${c}</i>`)
    .join('')}</div>`;
}

const ART = {
  soccer: () => `<div class="art art-soccer"><span class="art-lines"></span><span class="art-emoji c" style="--s:58">⚽</span></div>`,
  squad: () => `<div class="art art-squad"><span class="art-sun"></span><span class="art-ground"></span>
    <span class="art-emoji" style="--s:20;left:8%;top:6%">💥</span><span class="art-svg" style="left:0;right:0;top:24%">${TANK_SVG}</span></div>`,
  mapquiz: () => `<div class="art art-map"><span class="art-emoji c" style="--s:54">🌍</span>
    <img class="art-flag" src="${flag('us')}" style="left:6%;top:12%;--r:-14deg" alt="">
    <img class="art-flag" src="${flag('es')}" style="right:6%;top:16%;--r:12deg" alt="">
    <img class="art-flag" src="${flag('br')}" style="left:6%;top:50%;--r:10deg" alt="">
    <img class="art-flag" src="${flag('fr')}" style="right:6%;top:52%;--r:-10deg" alt=""></div>`,
  flags: () => `<div class="art art-flags">
    <img class="art-flag big" src="${flag('gb')}" style="left:-6%;top:-4%;--r:-8deg" alt="">
    <img class="art-flag big" src="${flag('jm')}" style="right:-10%;top:4%;--r:10deg" alt="">
    <img class="art-flag big" src="${flag('fr')}" style="left:6%;top:34%;--r:6deg" alt="">
    <img class="art-flag big" src="${flag('br')}" style="right:-4%;top:42%;--r:-6deg" alt="">
    <img class="art-flag big" src="${flag('us')}" style="left:-8%;bottom:-6%;--r:8deg" alt="">
    <img class="art-flag big" src="${flag('gb')}" style="right:2%;bottom:-8%;--r:-12deg" alt=""></div>`,
  polyglot: () => `<div class="art art-poly"><span class="art-emoji c" style="--s:56">🦜</span>
    <span class="art-emoji" style="--s:18;left:8%;bottom:10%">📖</span><span class="art-emoji" style="--s:16;right:8%;top:10%">💬</span></div>`,
  busjam: () => `<div class="art art-bus"><span class="art-road"></span>
    <span class="art-svg" style="left:16%;right:4%;top:8%">${BUS_SVG}</span>
    <span class="art-people">${['#a855f7', '#facc15', '#3b82f6', '#22c55e'].map((c) => `<span>${stickman(c)}</span>`).join('')}</span></div>`,
  waldo: () => `<div class="art art-waldo"><span class="art-crowd"></span>
    <span class="art-emoji c" style="--s:46;top:42%">🧑‍🤝‍🧑</span><span class="art-emoji" style="--s:18;right:10%;top:10%">🔎</span></div>`,
  findit: () => `<div class="art art-findit">
    <span class="art-emoji" style="--s:15;left:6%;top:8%">🎈</span><span class="art-emoji" style="--s:15;right:8%;top:10%">🚂</span>
    <span class="art-emoji" style="--s:14;left:8%;bottom:10%">🪀</span><span class="art-emoji" style="--s:14;right:8%;bottom:10%">🎁</span>
    <span class="art-emoji c" style="--s:56">🧸</span></div>`,
  wordsearch: () => `<div class="art art-cross">${letterGrid()}<span class="art-emoji" style="--s:34;right:2%;top:46%">🔍</span></div>`,
  hero: () => `<div class="art art-hero"><span class="art-goal"></span><span class="art-curve"></span>
    <span class="art-emoji" style="--s:30;left:12%;top:52%">⚽</span><span class="art-emoji" style="--s:20;right:12%;top:8%">⭐</span></div>`,
  million: () => `<div class="art art-million"><span class="art-rays"></span><span class="art-money">1.000.000</span>
    <span class="art-emoji c" style="--s:44;top:48%">💰</span></div>`,
  towers: () => `<div class="art art-towers"><span class="art-path"></span>
    <span class="art-emoji" style="--s:38;left:8%;top:14%">🏰</span><span class="art-emoji" style="--s:16;right:10%;top:12%">🫧</span>
    <span class="art-emoji" style="--s:14;right:26%;top:34%">🫧</span><span class="art-emoji" style="--s:12;right:14%;top:48%">🫧</span>
    <span class="art-emoji" style="--s:20;left:46%;top:30%">💥</span></div>`,
  naval: () => `<div class="art art-naval"><span class="art-grid"></span>
    <span class="art-emoji" style="--s:44;left:10%;top:18%">🚢</span><span class="art-emoji" style="--s:20;right:12%;top:10%">💥</span>
    <span class="art-emoji" style="--s:14;right:22%;top:44%">🎯</span></div>`,
  farm: () => `<div class="art art-farm"><span class="art-field"></span>
    <span class="art-emoji" style="--s:20;right:10%;top:6%">☀️</span><span class="art-emoji" style="--s:40;left:6%;top:18%">🚜</span>
    <span class="art-emoji" style="--s:22;right:10%;top:34%">🐄</span><span class="art-emoji" style="--s:14;left:52%;top:20%">🌾</span></div>`,
  pingpong: () => `<div class="art art-pingpong"><span class="art-table"></span>
    <span class="art-emoji" style="--s:46;left:18%;top:16%">🏓</span><span class="art-ball"></span></div>`,
};

// 3D covers (assets/covers/<id>.webp, rendered by tools/covers). Games without one
// fall back to the drawn illustrations above.
const COVERS = new Set(['soccer', 'squad', 'mapquiz', 'flags', 'polyglot', 'busjam', 'waldo', 'findit', 'wordsearch', 'hero', 'million', 'towers', 'naval', 'farm', 'pingpong', 'blocks', 'water', 'snake', 'numbers', 'solitaire', 'checkers', 'domino', 'sudoku', 'g2048', 'crossword', 'mines', 'lights', 'dice', 'stack', 'maze', 'colors', 'blackjack', 'sueca', 'bisca', 'buraco', 'truco', 'poker', 'foosball']);
export const hasCover = (id) => COVERS.has(id);
export const coverUrl = (id) => new URL(`../../assets/covers/${id}.webp`, import.meta.url).href;

// Temporary drawn art for games that do not have a 3D cover yet.
const EMOJI_ART = { blocks: ['🧱', '#2b6fe0', '#0d2a6b'], water: ['🧪', '#7c3aed', '#2b0d6b'], snake: ['🐍', '#16a34a', '#06361c'], numbers: ['🔢', '#f59e0b', '#6b3a05'], solitaire: ['🃏', '#0f766e', '#04302c'], checkers: ['⚫', '#b91c1c', '#3a0707'], domino: ['🁣', '#0ea5e9', '#06334d'], sudoku: ['🔟', '#6366f1', '#1e1b6b'], g2048: ['🎲', '#f97316', '#5a2105'], crossword: ['✏️', '#e11d48', '#4a0719'] };
const emojiArt = (id) => {
  const [e, a, b] = EMOJI_ART[id] || ['🎮', '#444', '#111'];
  return `<div class="art" style="background:radial-gradient(circle at 50% 38%,${a},${b})"><span class="art-emoji c" style="--s:52">${e}</span></div>`;
};

export function gameArt(id) {
  const legacy = (ART[id] || (() => emojiArt(id)))();
  if (!COVERS.has(id)) return legacy;
  return `${legacy}<img class="cover" src="${coverUrl(id)}" alt="" decoding="async" draggable="false" onerror="this.remove()">`;
}

// Wide preview for the lobby. Soccer gets a drawn table-soccer pitch.
export function gamePreview(id) {
  if (id === 'soccer') {
    const cap = (x, y, fill, rim) =>
      `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="5" rx="17" ry="9" fill="rgba(0,0,0,.35)"/><circle r="16" fill="${rim}"/><circle r="12" fill="${fill}"/><circle cx="-4" cy="-4" r="4" fill="#fff" opacity=".35"/></g>`;
    return `<div class="art art-pitch"><svg viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><pattern id="stripes" width="40" height="190" patternUnits="userSpaceOnUse"><rect width="20" height="190" fill="#2f9e3a"/><rect x="20" width="20" height="190" fill="#38ad43"/></pattern></defs>
      <rect width="320" height="190" fill="url(#stripes)"/>
      <g fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2"><rect x="12" y="10" width="296" height="170"/><line x1="160" y1="10" x2="160" y2="180"/><circle cx="160" cy="95" r="26"/>
      <rect x="12" y="55" width="34" height="80"/><rect x="274" y="55" width="34" height="80"/></g>
      <g stroke="#fff" stroke-width="1.2" opacity=".9"><rect x="0" y="70" width="12" height="50" fill="rgba(255,255,255,.15)"/><rect x="308" y="70" width="12" height="50" fill="rgba(255,255,255,.15)"/></g>
      ${cap(92, 52, '#e53935', '#fbc02d')}${cap(92, 140, '#e53935', '#fbc02d')}${cap(228, 52, '#1e66f5', '#f4f4f4')}${cap(228, 140, '#1e66f5', '#f4f4f4')}
      <g transform="translate(160 95)"><circle r="10" fill="#fff"/><path d="M0-4l4 3-1.5 5h-5L-4-1z" fill="#222"/></g>
    </svg></div>`;
  }
  if (COVERS.has(id)) return `<div class="lobby-cover">${gameArt(id)}</div>`;
  return `<div class="art-wide">${gameArt(id)}</div>`;
}

// Collage for the splash screen.
export function splashCollage() {
  return `<div class="splash-collage">
    <span class="sc-item" style="left:0;top:2%;--s:28;--r:-10deg">⚽</span>
    <span class="sc-svg" style="left:26%;top:0;width:46%;--r:-4deg">${TANK_SVG}</span>
    <span class="sc-flag" style="right:0;top:4%;--r:12deg"><img src="${flag('ca')}" alt=""></span>
    <span class="sc-svg" style="left:-2%;top:30%;width:38%;--r:-8deg">${BUS_SVG}</span>
    <span class="sc-cw" style="right:0;top:30%;--r:8deg">${letterGrid()}</span>
    <span class="sc-flag" style="left:2%;top:62%;--r:-10deg"><img src="${flag('br')}" alt=""></span>
    <span class="sc-item" style="left:27%;top:66%;--s:18;--r:12deg">🧩</span>
    <span class="sc-item" style="left:46%;top:68%;--s:16;--r:0deg">♟️</span>
    <span class="sc-item" style="right:0;top:58%;--s:28;--r:-14deg">🔍</span>
    <span class="sc-item" style="left:30%;top:22%;--s:40;--r:0deg">🦜</span>
  </div>`;
}
