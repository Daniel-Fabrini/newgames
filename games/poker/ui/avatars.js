// Original SVG avatar set for Poker World Tour (players, rivals, cosmetics).
// Every id maps to a hand-tuned preset; any unknown id still yields a stable,
// distinct face through a hash of the id, so data can add rivals without UI changes.

const SKINS = ['#f2c9a5', '#e0a97f', '#c68a5b', '#9c6440', '#6d4328', '#f7d9bd', '#3f2717'];
const HAIRC = ['#17110d', '#3a2418', '#6b4423', '#a9763a', '#d8b76a', '#8d8f93', '#e9e4da', '#7a2a1d', '#1c2438'];
const JACKET = ['#26324d', '#3c1f2b', '#1f3a33', '#4a3a1a', '#2b2b30', '#40284f', '#5a1f1f', '#1d3e55', '#303a2a', '#e8e1cf'];
const BGS = [
  ['#1d3b5c', '#0b1a2c'], ['#4d2b43', '#1b0e19'], ['#1e4a3b', '#0a1d17'], ['#5a4417', '#1d1506'],
  ['#3b2f66', '#130f26'], ['#5b2323', '#1e0c0c'], ['#23506a', '#0a1c28'], ['#3f4a22', '#13180a'],
];

const PRESETS = {
  // player-selectable
  p1: { s: 0, hr: 'short', hc: 1, j: 0, bg: 0, acc: [] },
  p2: { s: 2, hr: 'bun', hc: 0, j: 1, bg: 1, acc: ['earring'] },
  p3: { s: 4, hr: 'afro', hc: 0, j: 2, bg: 2, acc: ['glasses'] },
  p4: { s: 1, hr: 'long', hc: 3, j: 3, bg: 3, acc: [] },
  p5: { s: 3, hr: 'slick', hc: 0, j: 4, bg: 4, acc: ['beard'] },
  p6: { s: 5, hr: 'cap', hc: 2, j: 5, bg: 5, acc: [], cap: '#b3262e' },
  p7: { s: 0, hr: 'curly', hc: 7, j: 6, bg: 6, acc: ['shades'] },
  p8: { s: 2, hr: 'bald', hc: 0, j: 7, bg: 7, acc: ['mustache'] },
  p9: { s: 1, hr: 'mohawk', hc: 8, j: 8, bg: 0, acc: ['earring'] },
  p10: { s: 5, hr: 'bob', hc: 4, j: 9, bg: 1, acc: ['glasses'] },
  p11: { s: 6, hr: 'short', hc: 0, j: 0, bg: 2, acc: ['scarf'] },
  unknown: { s: 6, hr: 'bald', hc: 0, j: 4, bg: 2, acc: ['shades'], expr: 'neutral', mystery: true },
  p12: { s: 4, hr: 'fedora', hc: 0, j: 4, bg: 3, acc: [], cap: '#2a2a2f' },
  // rivals (ids match career/rivals.js)
  tito: { s: 2, hr: 'curly', hc: 1, j: 7, bg: 3, acc: [], expr: 'smile' },
  bartholomew: { s: 5, hr: 'bald', hc: 5, j: 3, bg: 7, acc: ['glasses', 'mustache'], expr: 'neutral' },
  ingrid: { s: 5, hr: 'long', hc: 4, j: 7, bg: 6, acc: [], expr: 'stern' },
  rafa: { s: 1, hr: 'slick', hc: 0, j: 4, bg: 5, acc: ['beard'], expr: 'smirk' },
  koji: { s: 5, hr: 'fedora', hc: 0, j: 5, bg: 4, acc: [], cap: '#3b2a5c', expr: 'smirk' },
  elena: { s: 1, hr: 'bun', hc: 1, j: 2, bg: 2, acc: ['glasses'], expr: 'neutral' },
  nadia: { s: 4, hr: 'afro', hc: 0, j: 6, bg: 1, acc: ['earring'], expr: 'smile' },
  celeste: { s: 5, hr: 'bob', hc: 7, j: 9, bg: 4, acc: ['scarf'], expr: 'smirk' },
  jun: { s: 5, hr: 'short', hc: 0, j: 0, bg: 6, acc: [], expr: 'neutral' },
  legend: { s: 1, hr: 'slick', hc: 5, j: 4, bg: 3, acc: ['mustache'], expr: 'stern' },
  mirella: { s: 2, hr: 'bob', hc: 5, j: 1, bg: 1, acc: ['earring'], expr: 'smile' },
};

function hashStr(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

const STYLES = ['short', 'slick', 'bun', 'long', 'curly', 'cap', 'bald', 'mohawk', 'bob', 'afro', 'fedora'];
const ACCS = ['glasses', 'shades', 'beard', 'mustache', 'earring', 'scarf'];

function derive(id) {
  if (PRESETS[id]) return PRESETS[id];
  let x = hashStr(String(id));
  const pick = (n) => {
    x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0;
    return x % n;
  };
  const acc = [];
  if (pick(100) < 45) acc.push(ACCS[pick(ACCS.length)]);
  return { s: pick(SKINS.length), hr: STYLES[pick(STYLES.length)], hc: pick(HAIRC.length), j: pick(JACKET.length), bg: pick(BGS.length), acc, cap: ['#b3262e', '#1d3e55', '#2a2a2f', '#2f5d3a'][pick(4)] };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

let uid = 0;
/** Returns an SVG string. opts: { expr: 'neutral'|'smile'|'smirk'|'stern'|'sad' } */
export function avatarSVG(id, opts = {}) {
  const p = derive(id || 'p1');
  if (p.mystery) {
    return `<svg class="pk-av-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><radialGradient id="pkmy" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="#2b2b33"/><stop offset="1" stop-color="#0c0c10"/></radialGradient></defs><rect width="64" height="64" fill="url(#pkmy)"/><circle cx="32" cy="26" r="11" fill="#444452"/><path d="M10 64c1-13 10-19 22-19s21 6 22 19z" fill="#444452"/><text x="32" y="33" text-anchor="middle" font-size="16" font-weight="900" fill="#c9971c" font-family="Nunito,sans-serif">?</text></svg>`;
  }
  const gid = 'pkav' + uid++;
  const skin = SKINS[p.s];
  const hair = HAIRC[p.hc];
  const hairD = shade(hair, -0.08);
  const jacket = JACKET[p.j];
  const [b1, b2] = BGS[p.bg];
  const expr = opts.expr || p.expr || (hashStr(String(id)) % 3 === 0 ? 'smirk' : hashStr(String(id)) % 3 === 1 ? 'smile' : 'neutral');
  const dark = p.hr === 'bald' ? skin : hair;
  let back = '';
  let front = '';
  switch (p.hr) {
    case 'long':
      back = `<path d="M17 33c0-15 7-23 15-23s15 8 15 23v17c0 3-3 4-6 4H23c-3 0-6-1-6-4Z" fill="${hair}"/>`;
      front = `<path d="M18 31c1-12 8-17 14-17s13 5 14 17c-4-6-9-9-14-9s-10 3-14 9Z" fill="${hair}"/>`;
      break;
    case 'bob':
      back = `<path d="M17 36c0-14 6-22 15-22s15 8 15 22v8c0 2-2 3-4 3H21c-2 0-4-1-4-3Z" fill="${hair}"/>`;
      front = `<path d="M18 30c2-11 8-16 14-16s12 5 14 16c-5-5-9-7-14-7s-9 2-14 7Z" fill="${hair}"/>`;
      break;
    case 'bun':
      back = `<circle cx="32" cy="9.5" r="6" fill="${hair}"/>`;
      front = `<path d="M18.5 30c1-11 7-16 13.500-16s12.500 5 13.500 16c-4-5-8-7.500-13.500-7.500S22.500 25 18.500 30Z" fill="${hair}"/>`;
      break;
    case 'curly':
      back = [[19, 24], [24, 15], [32, 12], [40, 15], [45, 24], [18, 32], [46, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.500" fill="${hair}"/>`).join('');
      front = `<path d="M20 28c2-5 7-7 12-7s10 2 12 7c-4-2-8-3-12-3s-8 1-12 3Z" fill="${hair}"/>`;
      break;
    case 'afro':
      back = `<circle cx="32" cy="24" r="19" fill="${hair}"/>`;
      front = `<path d="M19.500 30c2-6 7-8.500 12.500-8.500S42.500 24 44.500 30c-4-3-8-4.500-12.500-4.500S23.500 27 19.500 30Z" fill="${hair}"/>`;
      break;
    case 'mohawk':
      back = `<path d="M28 6c1-3 7-3 8 0l2 18H26Z" fill="${hair}"/>`;
      front = '';
      break;
    case 'slick':
      front = `<path d="M18.500 29c0-10 6-16 13.500-16s13.500 6 13.500 16c-3-4-6-7-13.500-7s-10.500 3-13.500 7Z" fill="${hair}"/><path d="M24 20c4-3 10-3 15 0" stroke="${shade(hair, 0.16)}" stroke-width="1.400" fill="none" stroke-linecap="round"/>`;
      break;
    case 'cap':
      front = `<path d="M17.500 29c0-11 6-17 14.500-17s14.500 6 14.500 17Z" fill="${p.cap}"/><path d="M15 29.500h22c3 0 6 1 9 3-3 1-6 .8-9 .5H16Z" fill="${shade(p.cap, -0.12)}"/><circle cx="32" cy="14" r="1.500" fill="${shade(p.cap, 0.2)}"/>`;
      back = `<path d="M19 30c0 4 .5 8 1 10h2c0-3 0-7-.5-10Z" fill="${hair}"/>`;
      break;
    case 'fedora':
      front = `<path d="M13 28.500c5 3 13 4 19 4s14-1 19-4c-1-2-4-3-8-4V17c0-4-5-6-11-6s-11 2-11 6v7.500c-4 1-7 2-8 4Z" fill="${p.cap}"/><path d="M21 24.500c7 2 15 2 22 0v3c-7 2-15 2-22 0Z" fill="#c9971c"/>`;
      break;
    case 'bald':
      front = '';
      break;
    default:
      front = `<path d="M18.500 30c0-11 5-17 13.500-17s13.500 6 13.500 17c-2-5-4-8-7-9-5 2-12 2-17 0-2 1-1.500 4-3 9Z" fill="${hair}"/>`;
  }
  const eyeY = 32;
  const eyes = p.acc.includes('shades')
    ? `<rect x="21" y="29.500" width="9" height="5.500" rx="2.200" fill="#0c0c0f"/><rect x="34" y="29.500" width="9" height="5.500" rx="2.200" fill="#0c0c0f"/><path d="M30 31.500h4" stroke="#0c0c0f" stroke-width="1.400"/><path d="M22.500 31h3" stroke="#fff" stroke-opacity=".35" stroke-width="1" stroke-linecap="round"/>`
    : `<ellipse cx="26" cy="${eyeY}" rx="2" ry="${expr === 'smile' ? 1.5 : 2.200}" fill="#1a1410"/><ellipse cx="38" cy="${eyeY}" rx="2" ry="${expr === 'smile' ? 1.5 : 2.200}" fill="#1a1410"/><circle cx="26.700" cy="${eyeY - 0.8}" r=".7" fill="#fff"/><circle cx="38.700" cy="${eyeY - 0.8}" r=".7" fill="#fff"/>`;
  const brow = expr === 'stern'
    ? `<path d="M22.500 27.500l7 1.800M41.500 27.500l-7 1.800" stroke="${dark}" stroke-width="1.800" stroke-linecap="round"/>`
    : `<path d="M22.500 28.200q3.500-2 7-.4M34.500 27.800q3.500-1.600 7 .4" stroke="${dark}" stroke-width="1.700" stroke-linecap="round" fill="none"/>`;
  const mouth = expr === 'smile'
    ? '<path d="M27 41.500q5 4.200 10 0" stroke="#5b2a22" stroke-width="1.800" fill="none" stroke-linecap="round"/>'
    : expr === 'smirk'
      ? '<path d="M28 42q4 1.600 9-1.400" stroke="#5b2a22" stroke-width="1.800" fill="none" stroke-linecap="round"/>'
      : expr === 'sad'
        ? '<path d="M28 43q4-3 8 0" stroke="#5b2a22" stroke-width="1.800" fill="none" stroke-linecap="round"/>'
        : '<path d="M28.500 42h7" stroke="#5b2a22" stroke-width="1.800" stroke-linecap="round"/>';
  let acc = '';
  if (p.acc.includes('glasses')) acc += '<circle cx="26" cy="32" r="5.300" fill="none" stroke="#d9b24f" stroke-width="1.300"/><circle cx="38" cy="32" r="5.300" fill="none" stroke="#d9b24f" stroke-width="1.300"/><path d="M31.300 32h1.400" stroke="#d9b24f" stroke-width="1.300"/>';
  if (p.acc.includes('beard')) acc += `<path d="M20 36c0 10 5 15 12 15s12-5 12-15c-2 4-5 5-8 5h-8c-3 0-6-1-8-5Z" fill="${hairD}"/><path d="M28 41.500q4 2 8 0" stroke="${shade(hair, 0.2)}" stroke-width="1" fill="none"/>`;
  if (p.acc.includes('mustache')) acc += `<path d="M25.500 39.500q3.500-2.500 6.500 0 3-2.500 6.500 0-3.500 3.500-6.500 1.200-3 2.300-6.500-1.200Z" fill="${hairD}"/>`;
  if (p.acc.includes('earring')) acc += '<circle cx="19.500" cy="38" r="1.700" fill="#e6b93c"/>';
  if (p.acc.includes('scarf')) acc += '<path d="M20 52c4 3 9 4 12 4s8-1 12-4l1 6H19Z" fill="#b3262e"/>';
  const collar = p.j === 9 ? '#cfc7b3' : shade(jacket, 0.12);
  return `<svg class="pk-av-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<defs><radialGradient id="${gid}b" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></radialGradient>
<linearGradient id="${gid}j" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(jacket, 0.08)}"/><stop offset="1" stop-color="${shade(jacket, -0.08)}"/></linearGradient>
<clipPath id="${gid}c"><circle cx="32" cy="32" r="32"/></clipPath></defs>
<g clip-path="url(#${gid}c)"><rect width="64" height="64" fill="url(#${gid}b)"/>
${back}
<path d="M6 66c1-10 9-14 17-16l9 4 9-4c8 2 16 6 17 16Z" fill="url(#${gid}j)"/>
<path d="M23 50l9 7 9-7-2-3-7 5-7-5Z" fill="${collar}"/>
<rect x="27.500" y="43" width="9" height="9" rx="3" fill="${shade(skin, -0.07)}"/>
<ellipse cx="32" cy="32" rx="13.500" ry="15.500" fill="${skin}"/>
<ellipse cx="18.500" cy="34" rx="2.200" ry="3.300" fill="${shade(skin, -0.05)}"/><ellipse cx="45.500" cy="34" rx="2.200" ry="3.300" fill="${shade(skin, -0.05)}"/>
${front}${brow}${eyes}
<path d="M32 33.500v5.200q-1.800 1.200-3 .2" stroke="${shade(skin, -0.14)}" stroke-width="1.400" fill="none" stroke-linecap="round"/>
${mouth}${acc}
<ellipse cx="25" cy="22" rx="9" ry="5" fill="#fff" opacity=".05"/></g></svg>`;
}

export const PLAYER_AVATARS = Object.keys(PRESETS);

/** DOM node: round avatar with optional frame class. */
export function avatarEl(id, { size = 44, frame = '', expr, cls = '' } = {}) {
  const d = document.createElement('span');
  d.className = `pk-av ${frame ? 'fr-' + frame : ''} ${cls}`.trim();
  d.style.setProperty('--av', size + 'px');
  d.innerHTML = avatarSVG(id, { expr });
  return d;
}

export const FRAMES = ['none', 'gold', 'emerald', 'ruby', 'royal', 'champion'];
