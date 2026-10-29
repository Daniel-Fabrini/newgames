// Club identities (kits + crests drawn as inline SVG data URLs) and team-name helpers.
// National teams keep using the flags from js/data/countries.js; clubs have codes
// that are not country codes (see CLUBS) and bring their own kit and crest.

import { byCode } from '../../js/data/countries.js';

const star = (cx, cy, R, fill) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.4 : R;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width=".8" stroke-linejoin="round"/>`;
};

const SHIELD = 'M10 28H90V70C90 98 68 114 50 122C32 114 10 98 10 70Z';

// Sao Paulo FC crest (as on the club's shield): white pentagon shield with a thin black outline,
// a black banner with the white SPFC lettering, a red left triangle and a black right triangle
// split by a white vertical stem, and 5 stars above (outer two yellow, the other three red).
// `stars:false` is the simplified version used on the discs.
function spfcCrest(stars) {
  const starsSvg = stars
    ? [
        [225, 34, '#e8202a'],
        [80, 94, '#ffd21f'],
        [178, 94, '#e8202a'],
        [274, 94, '#e8202a'],
        [370, 94, '#ffd21f'],
      ]
        .map(([x, y, c]) => star(x, y, 30, c))
        .join('')
    : '';
  const vb = stars ? '0 0 455 520' : '14 120 427 398';
  const [w, h] = stars ? [182, 208] : [171, 159];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">` +
    starsSvg +
    `<path d="M28 128H427V270L227.5 510L28 270Z" fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="miter"/>` +
    `<rect x="52" y="152" width="351" height="100" fill="#111"/>` +
    `<text x="227.5" y="232" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="92" fill="#fff" textLength="318" lengthAdjust="spacingAndGlyphs">SPFC</text>` +
    `<polygon points="53,272 198,272 198,442" fill="#e8202a"/>` +
    `<polygon points="402,272 257,272 257,442" fill="#111"/>` +
    `</svg>`
  );
}

// Generic (original) club crest: shield in the kit colours with a diagonal sash and a letter.
function genericCrest(club) {
  const [c1, c2] = club.cols;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 24 96 102" width="192" height="204">` +
    `<defs><clipPath id="s"><path d="${SHIELD}"/></clipPath></defs>` +
    `<path d="${SHIELD}" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="7" stroke-linejoin="round"/>` +
    `<g clip-path="url(#s)"><rect x="0" y="20" width="100" height="110" fill="${c1}"/>` +
    `<polygon points="0,70 0,92 100,52 100,30" fill="${c2}"/></g>` +
    `<text x="50" y="86" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="46" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="2.4" paint-order="stroke">${club.letter}</text>` +
    `<path d="${SHIELD}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

// kit.cap overrides the default red/blue dome + ring of the disc sprite.
export const CLUBS = [
  {
    code: 'SPFC',
    name: { pt: 'São Paulo FC', en: 'São Paulo FC', es: 'São Paulo FC' },
    r: 0.9,
    cols: ['#e30613', '#111111'],
    cap: {
      dome: ['#ffffff', '#f2f2f2', '#b9b9b9'],
      well: '#2a0a0c',
      ring: ['#ff8a80', '#d3202a', '#7a0c12'],
      side: '#4a0a0e',
      bands: ['#e30613', '#141414'],
    },
    conf: ['#e30613', '#ffffff', '#111111', '#ffd21f'],
  },
  {
    code: 'TRO',
    name: { pt: 'Tropical FC', en: 'Tropical FC', es: 'Tropical FC' },
    r: 0.74,
    letter: 'T',
    cols: ['#12803a', '#ffd21f'],
    cap: { dome: ['#5fe08a', '#12803a', '#06361a'], well: '#04200f', ring: ['#fff6b0', '#ffd21f', '#a07d00'], side: '#7a5d00' },
  },
  {
    code: 'AUR',
    name: { pt: 'Aurora EC', en: 'Aurora EC', es: 'Aurora EC' },
    r: 0.72,
    letter: 'A',
    cols: ['#6d2bd0', '#ff8a1f'],
    cap: { dome: ['#b58cff', '#6d2bd0', '#2c0f6b'], well: '#150535', ring: ['#ffd2a0', '#ff8a1f', '#a04a00'], side: '#7a3a00' },
  },
  {
    code: 'LIT',
    name: { pt: 'Litoral United', en: 'Litoral United', es: 'Litoral United' },
    r: 0.7,
    letter: 'L',
    cols: ['#2fa8ff', '#0b2a6b'],
    cap: { dome: ['#8fd4ff', '#2fa8ff', '#0b4a96'], well: '#04204a', ring: ['#ffffff', '#cfe0f5', '#6d86a8'], side: '#44587a' },
  },
  {
    code: 'SER',
    name: { pt: 'Serra AC', en: 'Serra AC', es: 'Serra AC' },
    r: 0.68,
    letter: 'S',
    cols: ['#1c1c22', '#ff6a1a'],
    cap: { dome: ['#5a5a66', '#26262d', '#07070a'], well: '#000000', ring: ['#ffc59a', '#ff6a1a', '#8f3300'], side: '#5a2200' },
  },
  {
    code: 'PLA',
    name: { pt: 'Planalto Real', en: 'Real Planalto', es: 'Real Planalto' },
    r: 0.76,
    letter: 'P',
    cols: ['#8a1538', '#f2c14e'],
    cap: { dome: ['#d6527a', '#8a1538', '#3d0618'], well: '#240310', ring: ['#fff0b8', '#f2c14e', '#9a7410'], side: '#6b4e00' },
  },
];

const CLUB_MAP = new Map(CLUBS.map((c) => [c.code, c]));
export const isClub = (code) => CLUB_MAP.has(code);
export const clubOf = (code) => CLUB_MAP.get(code) || null;
export const kitOf = (code) => CLUB_MAP.get(code)?.cap || null;

const urlCache = new Map();
const toUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
// full = with the stars (SPFC); the simple variant is what the discs and watermark use.
export function crestUrl(code, full = true) {
  const key = code + (full ? ':f' : ':s');
  if (urlCache.has(key)) return urlCache.get(key);
  const c = CLUB_MAP.get(code);
  if (!c) return '';
  const svg = code === 'SPFC' ? spfcCrest(full) : genericCrest(c);
  const u = toUrl(svg);
  urlCache.set(key, u);
  return u;
}

export function teamName(code, pick) {
  const c = CLUB_MAP.get(code);
  if (c) return pick(c.name);
  const k = byCode(code);
  return k ? pick(k.name) : code;
}
