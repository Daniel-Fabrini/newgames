// Original SVG art: trophies, laurels, chip badge, circuit emblems, suit marks.
let uid = 0;
const TIER = {
  local: ['#f4c58a', '#c07a3f', '#7a4519'],
  regional: ['#f2f2f6', '#b5b8c4', '#6f7384'],
  intl: ['#fff1b8', '#f3c24a', '#b97f0e'],
  world: ['#fff8d8', '#ffd15a', '#c4800a'],
};

export function trophySVG(tier = 'intl', { locked = false, size = 120 } = {}) {
  const [c1, c2, c3] = TIER[tier] || TIER.intl;
  const g = 'pkt' + uid++;
  const world = tier === 'world';
  return `<svg class="pk-trophy ${locked ? 'locked' : ''}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
<defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>
<linearGradient id="${g}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2b12"/><stop offset="1" stop-color="#150f06"/></linearGradient>
<radialGradient id="${g}g" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
${world ? `<g opacity=".9" fill="none" stroke="url(#${g}a)" stroke-width="3" stroke-linecap="round"><path d="M22 96C6 80 6 50 24 30M98 96c16-16 16-46-2-66"/></g><g fill="url(#${g}a)">${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${13 + i * 2.2}" cy="${42 + i * 11}" rx="3.5" ry="7" transform="rotate(${-30 + i * 14} ${13 + i * 2.2} ${42 + i * 11})"/><ellipse cx="${107 - i * 2.2}" cy="${42 + i * 11}" rx="3.5" ry="7" transform="rotate(${30 - i * 14} ${107 - i * 2.2} ${42 + i * 11})"/>`).join('')}</g>` : ''}
<path d="M34 16h52v8c0 22-10 38-26 42-16-4-26-20-26-42z" fill="url(#${g}a)"/>
<path d="M34 24H20c0 18 8 28 20 30M86 24h14c0 18-8 28-20 30" fill="none" stroke="url(#${g}a)" stroke-width="5" stroke-linecap="round"/>
<path d="M52 66h16v14H52z" fill="url(#${g}a)"/>
<path d="M40 80h40l4 10H36z" fill="url(#${g}a)"/>
<rect x="30" y="90" width="60" height="14" rx="3" fill="url(#${g}b)"/><rect x="30" y="90" width="60" height="3" rx="1.500" fill="url(#${g}a)" opacity=".8"/>
<path d="M44 18h6c-1 20 2 34 12 44-13-4-20-18-18-44z" fill="url(#${g}g)"/>
<text x="60" y="49" text-anchor="middle" font-size="26" font-weight="900" fill="#3a2406" opacity=".65" font-family="Nunito,sans-serif">${world ? '★' : '♠'}</text>
</svg>`;
}

export function laurelSVG(size = 80) {
  const g = 'pkl' + uid++;
  return `<svg width="${size}" height="${size}" viewBox="0 0 80 80" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="1" stop-color="#c9971c"/></linearGradient></defs>
<g fill="url(#${g})">${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${14 + i * 1.5}" cy="${56 - i * 8}" rx="3" ry="6.500" transform="rotate(${-35 + i * 12} ${14 + i * 1.5} ${56 - i * 8})"/><ellipse cx="${66 - i * 1.5}" cy="${56 - i * 8}" rx="3" ry="6.500" transform="rotate(${35 - i * 12} ${66 - i * 1.5} ${56 - i * 8})"/>`).join('')}</g></svg>`;
}

/** Circuit emblem (badge). id: local|regional|intl|world|quick */
export function emblemSVG(id, { size = 56, locked = false } = {}) {
  const g = 'pke' + uid++;
  const col = { local: ['#cf8a4a', '#7a4519'], regional: ['#c9ccd8', '#6f7384'], intl: ['#f7d774', '#b97f0e'], world: ['#fff1b8', '#d9890b'], quick: ['#7dd9a8', '#1f7a4f'] }[id] || ['#f7d774', '#b97f0e'];
  const glyph = {
    local: '<path d="M32 18l5 10 11 1.500-8 7.500 2 11L32 42l-10 6 2-11-8-7.500L27 28z" fill="#2a1606" opacity=".75"/>',
    regional: '<path d="M16 44V26l8 8 8-14 8 14 8-8v18z" fill="#2a2a33" opacity=".75"/>',
    intl: '<circle cx="32" cy="32" r="13" fill="none" stroke="#2a1b06" stroke-width="3" opacity=".75"/><path d="M19 32h26M32 19c-8 8-8 18 0 26M32 19c8 8 8 18 0 26" fill="none" stroke="#2a1b06" stroke-width="2.600" opacity=".75"/>',
    world: '<path d="M32 15l4.500 9.500 10.500 1.500-7.600 7.300 1.800 10.400L32 38.600 22.800 43.700l1.800-10.400L17 26l10.500-1.500z" fill="#3a2000" opacity=".8"/>',
    quick: '<path d="M22 24h20v14c0 6-4 8-10 8s-10-2-10-8z" fill="#06301d" opacity=".75"/>',
  }[id];
  return `<svg class="pk-emblem ${locked ? 'locked' : ''}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></linearGradient></defs>
<path d="M32 3l24 9v18c0 16-10 26-24 31C18 56 8 46 8 30V12z" fill="url(#${g})" stroke="#fff6cf" stroke-opacity=".55" stroke-width="1.500"/>${glyph}</svg>`;
}

export function chipBadge(size = 22, color = '#d63a3a') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${color}"/><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2" stroke-dasharray="3.200 2.800"/><circle cx="12" cy="12" r="4.500" fill="#fff" fill-opacity=".14"/></svg>`;
}

export function suitsDeco() {
  return '<svg class="pk-suits" viewBox="0 0 120 30" aria-hidden="true"><g fill="currentColor"><path d="M15 4c4 5 9 8 9 13 0 3-2 5-5 5-2 0-3-1-4-2 .5 3 1 5 3 7h-6c2-2 2.500-4 3-7-1 1-2 2-4 2-3 0-5-2-5-5 0-5 5-8 9-13z" transform="translate(-2,0)"/><path d="M45 5c-4-4-11 0-11 5 0 6 8 10 11 15 3-5 11-9 11-15 0-5-7-9-11-5z" transform="translate(0,-1)"/><path d="M75 3l8 11-8 13-8-13z"/><path d="M105 4a5 5 0 0 0-5 5c0 1 .5 2 1 3a5 5 0 1 0 0 8c1-.2 2-.5 3-1-.3 3-1 5-3 7h8c-2-2-2.700-4-3-7 1 .5 2 .8 3 1a5 5 0 1 0 0-8c.5-1 1-2 1-3a5 5 0 0 0-5-5z" transform="translate(0,-1)"/></g></svg>';
}
