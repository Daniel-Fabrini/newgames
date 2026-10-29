// Card rendering — crisp vector faces (inline SVG), 3D flip, soft shadows, 5:7 proportions.
//
//   import { cardEl, unoCardEl, setFaceDown, setCardState, cardSizePx } from './card.js';
//   const el = cardEl({ r:'K', s:'h', id:'Kh' }, { size:'md', back:'classic' });  // face up
//   const down = cardEl(null);                                                    // face-down placeholder
//   cardEl(card, { faceDown:true }); setFaceDown(el, false)  // show it (instant); anim.flip() animates
//
// Options: size ('xs'|'sm'|'md'|'lg'|'xl' or px number; omit to inherit CSS var --cw from the container),
//          faceDown, back (id from backs.js), deck ('classic'|'fourcolor'|'large'|'fourcolor-large' or
//          { fourColor, largeIndex }), highlight, disabled, selected, lang (aria label), label (override).
import { backSvg, ensureDefs, DEFAULT_BACK } from './backs.js';
import { cardName, getCardLang, isUno } from './decks.js';

export const SIZES = { xs: 40, sm: 56, md: 72, lg: 96, xl: 128 };
export const ASPECT = 7 / 5;

export function cardSizePx(size) {
  return typeof size === 'number' ? size : SIZES[size] || SIZES.md;
}

// ---------- suit glyphs (100×100 box, original curves) ----------
const SUIT_PATH = {
  h: 'M50 92C22 70 5 52 5 33 5 18 16 8 29 8 38 8 46 13 50 22 54 13 62 8 71 8 84 8 95 18 95 33 95 52 78 70 50 92Z',
  d: 'M50 3C57 24 74 40 93 50 74 60 57 76 50 97 43 76 26 60 7 50 26 40 43 24 50 3Z',
  s: 'M50 4C68 28 94 41 94 63 94 77 83 86 70 86 62 86 55 82 51 75 52 86 57 93 66 96L34 96C43 93 48 86 49 75 45 82 38 86 30 86 17 86 6 77 6 63 6 41 32 28 50 4Z',
  c: 'M50 3C63 3 72 12 72 25 72 31 70 36 66 40 69 39 72 38 75 38 87 38 96 47 96 59 96 71 87 80 75 80 66 80 59 76 54 70 54 82 58 91 67 96L33 96C42 91 46 82 46 70 41 76 34 80 25 80 13 80 4 71 4 59 4 47 13 38 25 38 28 38 31 39 34 40 30 36 28 31 28 25 28 12 37 3 50 3Z',
};

const INK = '#1a1c24';
const RED = '#c9202f';
const BLUE4 = '#1d63c9';
const GREEN4 = '#14894a';
const GOLD = '#d4a22f';
const GOLD_D = '#9a6f12';

function suitColor(s, fourColor) {
  if (!fourColor) return s === 'h' || s === 'd' ? RED : INK;
  return { s: INK, h: RED, d: BLUE4, c: GREEN4 }[s];
}

const suitG = (s, cx, cy, size, fill, rot = 0, extra = '') =>
  `<path d="${SUIT_PATH[s]}" fill="${fill}" ${extra} transform="translate(${cx} ${cy}) rotate(${rot}) scale(${size / 100}) translate(-50 -50)"/>`;

// ---------- pip layouts ----------
const PX = 42; // column offset
const PIPS = {
  A: [[0, 0.5]],
  2: [[0, 0], [0, 1]],
  3: [[0, 0], [0, 0.5], [0, 1]],
  4: [[-1, 0], [1, 0], [-1, 1], [1, 1]],
  5: [[-1, 0], [1, 0], [0, 0.5], [-1, 1], [1, 1]],
  6: [[-1, 0], [1, 0], [-1, 0.5], [1, 0.5], [-1, 1], [1, 1]],
  7: [[-1, 0], [1, 0], [0, 0.25], [-1, 0.5], [1, 0.5], [-1, 1], [1, 1]],
  8: [[-1, 0], [1, 0], [0, 0.25], [-1, 0.5], [1, 0.5], [0, 0.75], [-1, 1], [1, 1]],
  9: [[-1, 0], [1, 0], [-1, 1 / 3], [1, 1 / 3], [0, 0.5], [-1, 2 / 3], [1, 2 / 3], [-1, 1], [1, 1]],
  T: [[-1, 0], [1, 0], [0, 1 / 6], [-1, 1 / 3], [1, 1 / 3], [-1, 2 / 3], [1, 2 / 3], [0, 5 / 6], [-1, 1], [1, 1]],
};

function pips(r, s, col) {
  const list = PIPS[r];
  const size = r === '2' || r === '3' ? 50 : 44;
  return list
    .map(([nx, ny]) => suitG(s, 125 + nx * PX, 78 + ny * 194, size, col, ny > 0.5 ? 180 : 0))
    .join('');
}

// ---------- court cards (original design) ----------
function courtHalf(r, s, fourColor) {
  const col = suitColor(s, fourColor);
  const red = s === 'h' || s === 'd';
  const robe = fourColor ? col : red ? '#b81f30' : '#1d2b52';
  const robe2 = red ? '#1f3f8f' : '#a8202f';
  const skin = '#f4d6b6';
  const line = '#2a2330';
  const hair = r === 'K' ? '#cfc8b8' : r === 'Q' ? '#7a4a22' : '#5a3a1e';
  const o = `stroke="${line}" stroke-width="1.1" stroke-linejoin="round"`;
  let h = '';
  // panel
  h += `<rect x="-57" y="-124" width="114" height="124" fill="${col}" fill-opacity=".07"/>`;
  h += `<path d="M-57 -124 L57 0" stroke="${col}" stroke-opacity=".12" stroke-width="1"/>`;
  // long hair behind (queen)
  if (r === 'Q') h += `<path d="M-19 -92 Q-30 -64 -26 -44 L26 -44 Q30 -64 19 -92Z" fill="${hair}" ${o}/>`;
  // robe
  h += `<path d="M-52 0 L-52 -30 Q-52 -50 -24 -56 L24 -56 Q52 -50 52 -30 L52 0Z" fill="${robe}" ${o}/>`;
  h += `<path d="M-52 0 L-52 -12 Q-26 -20 0 -12 Q26 -20 52 -12 L52 0Z" fill="${robe2}" stroke="${line}" stroke-width=".8"/>`;
  // trim + diamonds
  h += `<rect x="-5" y="-56" width="10" height="44" fill="${GOLD}" stroke="${line}" stroke-width=".7"/>`;
  for (const [x, y] of [[-30, -34], [30, -34], [-18, -22], [18, -22], [-42, -20], [42, -20]]) h += `<path d="M${x} ${y - 5}L${x + 4} ${y}L${x} ${y + 5}L${x - 4} ${y}Z" fill="${GOLD}" stroke="${line}" stroke-width=".6"/>`;
  // collar
  if (r === 'K') {
    h += `<path d="M-36 -52 Q-18 -64 0 -50 Q18 -64 36 -52 L40 -38 Q0 -26 -40 -38Z" fill="#faf6ee" ${o}/>` + [-28, -14, 0, 14, 28].map((x) => `<circle cx="${x}" cy="-40" r="1.6" fill="${line}"/>`).join('');
  } else {
    h += `<path d="M-22 -58 L0 -32 L22 -58Z" fill="#faf6ee" ${o}/>`;
  }
  // neck + head
  h += `<rect x="-7" y="-68" width="14" height="14" fill="${skin}" ${o}/>`;
  h += `<ellipse cx="0" cy="-83" rx="16" ry="19" fill="${skin}" ${o}/>`;
  // hair / beard
  if (r === 'J') h += `<path d="M-17 -84 Q-19 -104 0 -104 Q19 -104 17 -84 Q12 -95 0 -95 Q-12 -95 -17 -84Z" fill="${hair}" ${o}/>`;
  if (r === 'Q') h += `<path d="M-16 -86 Q-14 -102 0 -102 Q14 -102 16 -86 Q8 -94 0 -92 Q-8 -94 -16 -86Z" fill="${hair}" ${o}/>`;
  if (r === 'K') {
    h += `<path d="M-16 -84 Q-18 -58 0 -54 Q18 -58 16 -84 Q10 -72 0 -73 Q-10 -72 -16 -84Z" fill="${hair}" ${o}/>`;
    h += `<path d="M-8 -77 Q0 -81 8 -77" fill="none" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  // face
  h += `<circle cx="-6" cy="-86" r="1.9" fill="${line}"/><circle cx="6" cy="-86" r="1.9" fill="${line}"/>`;
  h += `<path d="M-4 ${r === 'K' ? -69 : -75} Q0 ${r === 'K' ? -67 : -72} 4 ${r === 'K' ? -69 : -75}" fill="none" stroke="${r === 'K' ? '#8a5a4a' : '#a24a40'}" stroke-width="1.4" stroke-linecap="round"/>`;
  if (r !== 'K') h += `<circle cx="-9" cy="-79" r="2.6" fill="#e9967a" fill-opacity=".45"/><circle cx="9" cy="-79" r="2.6" fill="#e9967a" fill-opacity=".45"/>`;
  // headwear
  if (r === 'K') {
    h += `<path d="M-18 -97 L-21 -120 L-10 -109 L0 -125 L10 -109 L21 -120 L18 -97Z" fill="${GOLD}" ${o}/>`;
    h += `<rect x="-18" y="-100" width="36" height="6" rx="1.5" fill="${GOLD}" ${o}/>`;
    h += `<circle cx="-21" cy="-121" r="2.2" fill="${RED}"/><circle cx="0" cy="-126" r="2.4" fill="${BLUE4}"/><circle cx="21" cy="-121" r="2.2" fill="${RED}"/>`;
    h += `<circle cx="-9" cy="-97" r="1.6" fill="${RED}"/><circle cx="0" cy="-97" r="1.6" fill="${BLUE4}"/><circle cx="9" cy="-97" r="1.6" fill="${RED}"/>`;
  } else if (r === 'Q') {
    h += `<path d="M-19 -95 Q-18 -112 -9 -111 L0 -120 L9 -111 Q18 -112 19 -95 Q0 -104 -19 -95Z" fill="${GOLD}" ${o}/>`;
    h += `<circle cx="0" cy="-112" r="3" fill="${RED}" stroke="${line}" stroke-width=".7"/><circle cx="-10" cy="-105" r="1.8" fill="${BLUE4}"/><circle cx="10" cy="-105" r="1.8" fill="${BLUE4}"/>`;
  } else {
    h += `<path d="M-21 -93 Q-26 -112 0 -116 Q24 -114 20 -93 Q0 -100 -21 -93Z" fill="${robe2}" ${o}/>`;
    h += `<path d="M10 -108 Q34 -126 38 -96 Q28 -110 14 -102Z" fill="${GOLD}" ${o}/>`;
    h += `<circle cx="-3" cy="-106" r="2.2" fill="${GOLD}"/>`;
  }
  // corner emblem
  h += suitG(s, -42, -106, 17, col);
  h += suitG(s, 42, -50, 11, col);
  return h;
}

function court(r, s, fourColor) {
  const col = suitColor(s, fourColor);
  const half = courtHalf(r, s, fourColor);
  return (
    `<rect x="62" y="46" width="126" height="258" rx="5" fill="#fffaf0" stroke="${col}" stroke-width="1.6"/>` +
    `<rect x="67" y="51" width="116" height="248" rx="3" fill="none" stroke="${GOLD}" stroke-width=".8"/>` +
    `<g transform="translate(125 175)"><g>${half}</g><g transform="rotate(180)">${half}</g></g>` +
    `<path d="M67 175 H183" stroke="${GOLD}" stroke-width="1"/>`
  );
}

// ---------- ace ----------
function ace(s, col) {
  const big = s === 's' ? 128 : 112;
  return (
    `<circle cx="125" cy="175" r="${s === 's' ? 82 : 74}" fill="none" stroke="${col}" stroke-opacity=".2" stroke-width="1.4"/>` +
    `<circle cx="125" cy="175" r="${s === 's' ? 90 : 82}" fill="none" stroke="${GOLD}" stroke-opacity=".5" stroke-width=".8" stroke-dasharray="2 4"/>` +
    suitG(s, 125, s === 's' ? 172 : 175, big, col)
  );
}

// ---------- joker ----------
function joker(s, fourColor) {
  const red = s === 'r';
  const main = red ? RED : INK;
  const alt = red ? '#1f3f8f' : '#6a5a2a';
  const skin = '#f4d6b6';
  const o = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`;
  let g = `<rect x="52" y="44" width="146" height="262" rx="6" fill="${main}" fill-opacity=".06" stroke="${main}" stroke-width="1.6"/>`;
  g += `<polygon points="${Array.from({ length: 24 }, (_, i) => { const a = (Math.PI * 2 * i) / 24; const r = i % 2 ? 40 : 70; return `${(125 + Math.cos(a) * r).toFixed(1)},${(175 + Math.sin(a) * r).toFixed(1)}`; }).join(' ')}" fill="${GOLD}" fill-opacity=".25" stroke="${GOLD}" stroke-width="1"/>`;
  // collar
  g += `<path d="M78 262 L88 238 L100 258 L112 236 L125 258 L138 236 L150 258 L162 238 L172 262Z" fill="${alt}" ${o}/>`;
  // hat (three points)
  g += `<path d="M92 150 Q80 110 74 86 Q96 96 112 128 Q112 96 125 70 Q138 96 138 128 Q154 96 176 86 Q170 110 158 150Z" fill="${main}" ${o}/>`;
  g += `<path d="M92 150 Q125 164 158 150 L156 142 Q125 154 94 142Z" fill="${GOLD}" ${o}/>`;
  for (const [x, y] of [[74, 84], [125, 66], [176, 84]]) g += `<circle cx="${x}" cy="${y}" r="7" fill="${GOLD}" ${o}/>`;
  // face
  g += `<ellipse cx="125" cy="188" rx="31" ry="38" fill="${skin}" ${o}/>`;
  g += `<path d="M104 178 q6 -7 12 0 M134 178 q6 -7 12 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  g += `<circle cx="125" cy="192" r="5" fill="${RED}"/>`;
  g += `<path d="M104 206 Q125 228 146 206" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
  g += `<circle cx="104" cy="198" r="5" fill="#e9967a" fill-opacity=".5"/><circle cx="146" cy="198" r="5" fill="#e9967a" fill-opacity=".5"/>`;
  // stars
  const st = (cx, cy, r) => `<polygon points="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (Math.PI * i) / 5; const rr = i % 2 ? r * 0.45 : r; return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`; }).join(' ')}" fill="${GOLD}"/>`;
  g += st(70, 150, 7) + st(180, 150, 7) + st(78, 238, 6) + st(172, 238, 6);
  return g;
}

function indexText(r, col, large) {
  const label = r === 'T' ? '10' : r;
  const fs = r === 'T' ? (large ? 58 : 50) : large ? 70 : 58;
  const x = large ? 33 : 30;
  const y = large ? 64 : 56;
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${col}" ${r === 'T' ? 'letter-spacing="-5"' : ''}>${label}</text>`;
}

function faceBody(card, deck) {
  const { r, s } = card;
  const { fourColor, largeIndex } = deck;
  if (r === 'X') {
    const main = s === 'r' ? RED : INK;
    const letters = 'JOKER'.split('').map((ch, i) => `<text x="30" y="${50 + i * 36}" text-anchor="middle" font-size="30" font-weight="900" fill="${main}">${ch}</text>`).join('');
    const mini = (rot) => `<g transform="${rot}">${letters}${`<polygon points="22,236 30,222 38,236" fill="${main}"/>`}</g>`;
    return joker(s, fourColor) + `<g>${letters}</g><g transform="rotate(180 125 175)">${letters}</g>`;
  }
  const col = suitColor(s, fourColor);
  const isCourt = r === 'J' || r === 'Q' || r === 'K';
  const ix = largeIndex ? 33 : 30;
  const iy = largeIndex ? 104 : 86;
  const isz = largeIndex ? 40 : 32;
  const corner = indexText(r, col, largeIndex) + suitG(s, ix, iy, isz, col);
  let center = '';
  if (r === 'A') center = ace(s, col);
  else if (isCourt) center = court(r, s, fourColor);
  else center = pips(r, s, col);
  return `${center}<g>${corner}</g><g transform="rotate(180 125 175)">${corner}</g>`;
}

const faceCache = new Map();
export function faceSvg(card, deck) {
  const key = `${card.r}${card.s}|${deck.fourColor ? 4 : 2}${deck.largeIndex ? 'L' : 'N'}`;
  let v = faceCache.get(key);
  if (!v) {
    v =
      `<svg class="dc-svg" viewBox="0 0 250 350" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
      `<rect width="250" height="350" fill="#fffdf8"/>` +
      `<rect x=".5" y=".5" width="249" height="349" rx="17" fill="none" stroke="#000" stroke-opacity=".16"/>` +
      faceBody(card, deck) +
      `</svg>`;
    faceCache.set(key, v);
  }
  return v;
}

export function normDeck(deck) {
  if (!deck) return { fourColor: false, largeIndex: false };
  if (typeof deck === 'string') return { fourColor: /four|4/.test(deck), largeIndex: /large/.test(deck) };
  return { fourColor: !!deck.fourColor, largeIndex: !!deck.largeIndex };
}

// ---------- UNO-style cards (original look) ----------
export const UNO_HEX = { R: '#df3a49', Y: '#f2b32b', G: '#2aa467', B: '#2e6bdc', W: '#1b1c22' };
const UNO_DARK = { R: '#8f1c2a', Y: '#a8741a', G: '#14663f', B: '#173f96', W: '#000' };
const UNO_SHAPE = {
  R: (c, x, y, s) => `<circle cx="${x}" cy="${y}" r="${s * 0.5}" fill="${c}"/>`,
  Y: (c, x, y, s) => `<polygon points="${x},${y - s * 0.55} ${x + s * 0.55},${y + s * 0.45} ${x - s * 0.55},${y + s * 0.45}" fill="${c}"/>`,
  G: (c, x, y, s) => `<rect x="${x - s * 0.45}" y="${y - s * 0.45}" width="${s * 0.9}" height="${s * 0.9}" rx="${s * 0.12}" fill="${c}"/>`,
  B: (c, x, y, s) => `<polygon points="${x},${y - s * 0.6} ${x + s * 0.6},${y} ${x},${y + s * 0.6} ${x - s * 0.6},${y}" fill="${c}"/>`,
};

function unoIcon(r, cx, cy, sz, fill, stroke = 'none') {
  const u = sz / 100;
  const T = `transform="translate(${cx} ${cy}) scale(${u})"`;
  switch (r) {
    case 'skip':
      return `<g ${T}><circle r="38" fill="none" stroke="${fill}" stroke-width="15"/><path d="M-27 27 L27 -27" stroke="${fill}" stroke-width="15" stroke-linecap="round"/></g>`;
    case 'reverse':
      return `<g ${T} fill="${fill}"><path d="M-34 -6 H20 V-22 L44 -2 L20 18 V2 H-34Z" transform="translate(0 -14) rotate(0)"/><path d="M34 6 H-20 V-10 L-44 10 L-20 30 V14 H34Z" transform="translate(0 6)" /></g>`;
    case 'draw2':
      return `<g ${T}><rect x="-36" y="-34" width="42" height="62" rx="7" fill="${fill}" fill-opacity=".55" transform="rotate(-12)"/><rect x="-8" y="-30" width="42" height="62" rx="7" fill="${fill}" transform="rotate(10)"/></g>`;
    case 'wild4':
      return `<g ${T}>${[[-26, -14, 0], [-8, -20, 1], [10, -18, 2], [28, -10, 3]].map(([x, y, i]) => `<rect x="${x - 15}" y="${y - 24}" width="30" height="46" rx="6" fill="${[UNO_HEX.R, UNO_HEX.Y, UNO_HEX.G, UNO_HEX.B][i]}" stroke="#fff" stroke-width="3" transform="rotate(${-18 + i * 12} ${x} ${y})"/>`).join('')}</g>`;
    default: // wild
      return `<g ${T}><path d="M0 0 L0 -44 A44 44 0 0 1 44 0Z" fill="${UNO_HEX.R}"/><path d="M0 0 L44 0 A44 44 0 0 1 0 44Z" fill="${UNO_HEX.Y}"/><path d="M0 0 L0 44 A44 44 0 0 1 -44 0Z" fill="${UNO_HEX.G}"/><path d="M0 0 L-44 0 A44 44 0 0 1 0 -44Z" fill="${UNO_HEX.B}"/><circle r="44" fill="none" stroke="#fff" stroke-width="5"/></g>`;
  }
}

function unoGlyph(r, cx, cy, size, fill, stroke) {
  if (/^\d$/.test(r)) return `<text x="${cx}" y="${cy + size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="1000" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${size * 0.04}" paint-order="stroke"` : ''}>${r}</text>`;
  return unoIcon(r, cx, cy, size * 1.15, fill);
}

export function unoFaceSvg(card) {
  const { r, s } = card;
  const col = UNO_HEX[s];
  const dark = UNO_DARK[s];
  const wild = s === 'W';
  const small = r === 'draw2' ? '+2' : r === 'wild4' ? '+4' : null;
  const cornerGlyph = (cx, cy) =>
    /^\d$/.test(r) ? `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="42" font-weight="1000" fill="#fff">${r}</text>` : small ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="36" font-weight="1000" fill="#fff">${small}</text>` : r === 'wild' ? unoIcon('wild', cx, cy, 36, '#fff') : unoIcon(r, cx, cy, 34, '#fff');
  const corner = `${cornerGlyph(38, 52)}${wild ? '' : UNO_SHAPE[s]('#fff', 38, 96, 15)}`;
  const mid = /^\d$/.test(r)
    ? unoGlyph(r, 125, 175, 150, col, dark)
    : r === 'draw2'
      ? unoIcon('draw2', 125, 170, 120, col) + `<text x="125" y="268" text-anchor="middle" font-size="40" font-weight="1000" fill="${col}">+2</text>`
      : r === 'wild4'
        ? unoIcon('wild4', 125, 168, 130, '#fff') + `<text x="125" y="272" text-anchor="middle" font-size="42" font-weight="1000" fill="#fff">+4</text>`
        : r === 'wild'
          ? unoIcon('wild', 125, 175, 140, '#fff')
          : unoIcon(r, 125, 175, 120, col);
  const bgCard = wild ? '#17181e' : col;
  const medal = wild
    ? `<circle cx="125" cy="175" r="92" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`
    : `<circle cx="125" cy="175" r="88" fill="#fff"/><circle cx="125" cy="175" r="88" fill="none" stroke="${dark}" stroke-opacity=".25" stroke-width="3"/>`;
  return (
    `<svg class="dc-svg" viewBox="0 0 250 350" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<rect width="250" height="350" fill="#fbfaf6"/>` +
    `<rect x="9" y="9" width="232" height="332" rx="12" fill="${bgCard}"/>` +
    (wild ? '' : `<path d="M9 250 Q125 200 241 262 L241 329 Q241 341 229 341 L21 341 Q9 341 9 329Z" fill="${dark}" fill-opacity=".28"/>`) +
    `<circle cx="125" cy="175" r="130" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="30"/>` +
    medal +
    mid +
    `<g>${corner}</g><g transform="rotate(180 125 175)">${corner}</g>` +
    `</svg>`
  );
}

// ---------- element ----------
const ROLE = 'img';

/** Is the card currently shown face down? */
export const isFaceDown = (el) => el.classList.contains('is-down');

function sizeStyle(el, size) {
  if (size === undefined || size === null) return;
  el.style.setProperty('--cw', cardSizePx(size) + 'px');
}

function build(card, o, uno) {
  ensureDefs();
  const faceDown = o.faceDown ?? !card;
  const el = document.createElement('div');
  el.className = 'dc' + (uno ? ' dc-uno' : '');
  if (card) el.dataset.id = card.id;
  el._card = card || null;
  el._opts = { deck: normDeck(o.deck), back: o.back || DEFAULT_BACK, uno: !!uno, lang: o.lang };
  sizeStyle(el, o.size);
  const inner = document.createElement('div');
  inner.className = 'dc-inner';
  const front = document.createElement('div');
  front.className = 'dc-face dc-front';
  const back = document.createElement('div');
  back.className = 'dc-face dc-back';
  back.innerHTML = backSvg(uno && !o.back ? 'uno' : o.back || DEFAULT_BACK);
  inner.append(front, back);
  el.append(inner);
  if (faceDown) el.classList.add('is-down');
  if (card && !faceDown) fillFront(el);
  applyState(el, o);
  labelCard(el, o);
  return el;
}

function fillFront(el) {
  const front = el.firstChild.firstChild;
  if (front.firstChild || !el._card) return;
  front.innerHTML = el._opts.uno ? unoFaceSvg(el._card) : faceSvg(el._card, el._opts.deck);
}

function labelCard(el, o = {}) {
  const lang = o.lang || el._opts.lang || getCardLang();
  const down = el.classList.contains('is-down');
  if (o.label) el.setAttribute('aria-label', o.label);
  else if (el._card && !down) el.setAttribute('aria-label', cardName(el._card, lang));
  else el.setAttribute('aria-label', { pt: 'Carta virada', en: 'Face-down card', es: 'Carta boca abajo' }[lang] || 'Face-down card');
  if (!el.hasAttribute('role')) el.setAttribute('role', ROLE);
}

function applyState(el, o) {
  el.classList.toggle('is-hl', !!o.highlight);
  el.classList.toggle('is-disabled', !!o.disabled);
  el.classList.toggle('is-selected', !!o.selected);
}

/** Standard (French-suit / joker) card. card = null → anonymous face-down card. */
export function cardEl(card, opts = {}) {
  return build(card, opts, false);
}

/** UNO-style card (colour R/Y/G/B or W). */
export function unoCardEl(card, opts = {}) {
  return build(card, opts, true);
}

/** Builds the right element for any card model. */
export function anyCardEl(card, opts = {}) {
  return build(card, opts, !!card && isUno(card));
}

/** Instantly flips face (no animation). Use anim.flip() to animate. */
export function setFaceDown(el, down = true) {
  if (!down) fillFront(el);
  el.classList.toggle('is-down', !!down);
  labelCard(el);
}

/** Changes which card an element shows (e.g. revealing an opponent's card). Stays face-down unless faceDown:false. */
export function setCard(el, card, { faceDown } = {}) {
  el._card = card;
  if (card) el.dataset.id = card.id;
  else delete el.dataset.id;
  const front = el.firstChild.firstChild;
  front.innerHTML = '';
  if (card && faceDown === false) fillFront(el);
  if (faceDown !== undefined) el.classList.toggle('is-down', !!faceDown);
  labelCard(el);
}

/** Toggle visual states: setCardState(el, { selected, highlight, disabled }) */
export function setCardState(el, st) {
  for (const [k, c] of [['selected', 'is-selected'], ['highlight', 'is-hl'], ['disabled', 'is-disabled']]) if (k in st) el.classList.toggle(c, !!st[k]);
}

/** Changes the back design of an existing card element. */
export function setBack(el, id) {
  el._opts.back = id;
  el.querySelector('.dc-back').innerHTML = backSvg(id);
}

export { backSvg };
