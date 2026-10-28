// Inline SVG icons (original artwork) for the UI chrome.

const GOLD_DEF = '<defs><linearGradient id="sqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d774"/><stop offset="1" stop-color="#c9971c"/></linearGradient></defs>';

export const ICONS = {
  gold: `<svg viewBox="0 0 32 32"><defs><linearGradient id="sqgb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#d4930c"/></linearGradient></defs>
    <path d="M3 25h12l-2-6H5z" fill="url(#sqgb)" stroke="#7a5200" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M17 25h12l-2-6h-8z" fill="url(#sqgb)" stroke="#7a5200" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M10 18h12l-2-6h-8z" fill="url(#sqgb)" stroke="#7a5200" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M7 20.5h5M21 20.5h5M14 13.5h5" stroke="#fff6c8" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></svg>`,
  mat: `<svg viewBox="0 0 32 32">
    <g stroke="#5a3a1c" stroke-width="1.3"><ellipse cx="9" cy="22" rx="6.5" ry="5" fill="#c99a5e"/><ellipse cx="23" cy="22" rx="6.5" ry="5" fill="#c99a5e"/><ellipse cx="16" cy="13" rx="6.5" ry="5" fill="#d9aa6a"/></g>
    <g fill="none" stroke="#8a5a2a" stroke-width="1.1"><ellipse cx="9" cy="22" rx="2.6" ry="2"/><ellipse cx="23" cy="22" rx="2.6" ry="2"/><ellipse cx="16" cy="13" rx="2.6" ry="2"/></g></svg>`,
  gem: `<svg viewBox="0 0 32 32"><defs><radialGradient id="sqgm" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffb8ff"/><stop offset=".45" stop-color="#c04ee0"/><stop offset="1" stop-color="#5a137a"/></radialGradient></defs>
    <circle cx="16" cy="16" r="11.5" fill="url(#sqgm)" stroke="#3a0a4e" stroke-width="1.3"/><path d="M10 13l6-4 6 4-6 10z" fill="#f2b8ff" opacity=".55"/><circle cx="12" cy="11" r="2.3" fill="#fff" opacity=".8"/></svg>`,
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: `<svg viewBox="0 0 24 24">${GOLD_DEF}<path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9l-5.8 3.2 1.4-6.4L2.7 9.3l6.5-.7z" fill="url(#sqg)" stroke="#7a5200" stroke-width="1" stroke-linejoin="round"/></svg>`,
  starOff: '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9l-5.8 3.2 1.4-6.4L2.7 9.3l6.5-.7z" fill="#26262c" stroke="#3a3a42" stroke-width="1" stroke-linejoin="round"/></svg>',
  bolt: `<svg viewBox="0 0 24 24">${GOLD_DEF}<path d="M13.5 2L5 13.5h5.5L9 22l9-12h-5.6z" fill="url(#sqg)" stroke="#7a5200" stroke-width="1" stroke-linejoin="round"/></svg>`,
  skull: '<svg viewBox="0 0 24 24"><path d="M12 3c-4.7 0-8 3.2-8 7.4 0 2.5 1.2 4.3 3 5.3V19a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.3c1.8-1 3-2.8 3-5.3C20 6.2 16.7 3 12 3z" fill="#f2ead2"/><circle cx="8.7" cy="11" r="2.1" fill="#1a1010"/><circle cx="15.3" cy="11" r="2.1" fill="#1a1010"/><path d="M10 17v3M12 17v3M14 17v3" stroke="#1a1010" stroke-width="1.2"/></svg>',
  soldier: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4.6" fill="#4f7a3a"/><path d="M6.6 7.2h10.8" stroke="#2f4a22" stroke-width="1.6"/><rect x="7.5" y="11" width="9" height="9" rx="3" fill="#3f6fd8"/><rect x="8" y="19" width="3" height="3.5" rx="1" fill="#22335a"/><rect x="13" y="19" width="3" height="3.5" rx="1" fill="#22335a"/></svg>',
  target: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#f7d774" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#f7d774" stroke-width="2"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="#f7d774" stroke-width="2" stroke-linecap="round"/></svg>`,
  infinity: '<svg viewBox="0 0 24 24"><path d="M6.5 8.5c-2 0-3.5 1.6-3.5 3.5s1.5 3.5 3.5 3.5c3.5 0 7.5-7 11-7 2 0 3.5 1.6 3.5 3.5s-1.5 3.5-3.5 3.5c-3.5 0-7.5-7-11-7z" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  help: '<svg viewBox="0 0 24 24"><path d="M9.2 9a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.2-1.5 2.2v.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chest: `<svg viewBox="0 0 48 48">${GOLD_DEF}<rect x="6" y="20" width="36" height="20" rx="3" fill="#8a5a2a" stroke="#3a220c" stroke-width="2"/><path d="M6 21c0-7 6-11 18-11s18 4 18 11z" fill="#a86a32" stroke="#3a220c" stroke-width="2"/><path d="M6 24h36M22 10v30M26 10v30" stroke="url(#sqg)" stroke-width="3"/><rect x="20" y="22" width="8" height="8" rx="1.5" fill="url(#sqg)" stroke="#7a5200"/></svg>`,

  // bottom tabs
  tabBuild: `<svg viewBox="0 0 64 64">${GOLD_DEF}
    <path d="M8 30L32 10l24 20" fill="none" stroke="#7a5200" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8 30L32 10l24 20" fill="none" stroke="url(#sqg)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 28v24h36V28L32 13z" fill="url(#sqg)" stroke="#7a5200" stroke-width="2" stroke-linejoin="round"/>
    <rect x="26" y="36" width="12" height="16" rx="2" fill="#5a3a12" stroke="#3a2208" stroke-width="1.5"/>
    <rect x="41" y="12" width="6" height="11" fill="url(#sqg)" stroke="#7a5200" stroke-width="1.5"/></svg>`,
  tabArmy: `<svg viewBox="0 0 64 64">
    <path d="M14 10h34a5 5 0 0 1 5 5v36a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V12z" fill="#f2deb0" stroke="#7a5a2a" stroke-width="2"/>
    <path d="M13 12a5 5 0 0 0 10 0v-2" fill="#e2c890" stroke="#7a5a2a" stroke-width="2"/>
    <path d="M22 22h22M22 29h22M22 36h16M22 43h12" stroke="#9a7a4a" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M52 12L36 40l-3 7 6-4 16-28z" fill="#ffd36b" stroke="#7a5200" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M33 47l3-7 3 3z" fill="#3a2a1a"/>
    <path d="M51 13c4-3 8-2 8 2-3 0-5 2-6 4" fill="#e8e8f0" stroke="#7a7a8a" stroke-width="1.2"/></svg>`,
  tabMissions: `<svg viewBox="0 0 64 64">
    <rect x="12" y="12" width="36" height="44" rx="4" fill="#c9a46a" stroke="#6a4a22" stroke-width="2"/>
    <rect x="16" y="17" width="28" height="35" rx="2" fill="#fbf2dc"/>
    <rect x="23" y="8" width="14" height="8" rx="2.5" fill="#8a8f99" stroke="#4a4e58" stroke-width="1.6"/>
    <path d="M20 26l3 3 5-6M20 37l3 3 5-6" fill="none" stroke="#2fa36a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M31 27h9M31 38h7" stroke="#9a8a6a" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M56 24L38 50l-2 6 5-3 18-26z" fill="#f2b04a" stroke="#7a4a00" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M56 24l3 3" stroke="#e86a6a" stroke-width="4" stroke-linecap="round"/></svg>`,
  tabMap: `<svg viewBox="0 0 64 64">
    <path d="M32 10l22 11-22 11-22-11z" fill="#5fb4ff" stroke="#1d4f9c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M10 21v18l22 11V32z" fill="#2f6fd0" stroke="#1d4f9c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M54 21v18L32 50V32z" fill="#3f86e8" stroke="#1d4f9c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M22 18l10 5 10-5M20 24l12 6 12-6" fill="none" stroke="#bfe4ff" stroke-width="1.6" opacity=".9"/>
    <rect x="28" y="10" width="8" height="12" rx="1.5" fill="#9ad0ff" stroke="#1d4f9c" stroke-width="1.6"/>
    <path d="M26 10l6-5 6 5z" fill="#1d4f9c"/>
    <circle cx="20" cy="36" r="3" fill="#7cf0b8"/><circle cx="44" cy="38" r="3" fill="#7cf0b8"/></svg>`,

  // heroes
  tank: `<svg viewBox="0 0 64 64">
    <rect x="6" y="38" width="52" height="14" rx="7" fill="#2a3320" stroke="#141a10" stroke-width="2"/>
    <g fill="#55603f" stroke="#141a10" stroke-width="1.4"><circle cx="15" cy="45" r="4"/><circle cx="25" cy="45" r="4"/><circle cx="35" cy="45" r="4"/><circle cx="45" cy="45" r="4"/><circle cx="53" cy="45" r="3"/></g>
    <path d="M9 38l5-9h36l5 9z" fill="#7f9a4a" stroke="#141a10" stroke-width="2" stroke-linejoin="round"/>
    <path d="M22 29c0-6 4-9 10-9s10 3 10 9z" fill="#93b25a" stroke="#141a10" stroke-width="2"/>
    <rect x="40" y="21" width="20" height="5" rx="2" fill="#6f8a3a" stroke="#141a10" stroke-width="1.8"/>
    <path d="M14 33h36" stroke="#a8c46a" stroke-width="1.5" opacity=".7"/>
    <circle cx="30" cy="24" r="2" fill="#f7d774"/></svg>`,
  jet: `<svg viewBox="0 0 64 64">
    <path d="M32 4l4 14 20 14v5l-20-6 2 14 8 6v4l-14-4-14 4v-4l8-6 2-14-20 6v-5l20-14z" fill="#b9c6d4" stroke="#2a3340" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 6l2.5 11h-5z" fill="#7aa4c8"/>
    <ellipse cx="32" cy="22" rx="2.6" ry="6" fill="#4fb0ff" stroke="#1d4f9c" stroke-width="1.2"/>
    <path d="M14 33l6-2M50 33l-6-2" stroke="#f7d774" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  missile: `<svg viewBox="0 0 64 64">
    <path d="M24 46l-6 12 10-6zM40 46l6 12-10-6z" fill="#d6342a" stroke="#5a0e0a" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="25" y="16" width="14" height="36" rx="4" fill="#e8edf2" stroke="#3a4250" stroke-width="2"/>
    <path d="M25 18c0-7 3-12 7-14 4 2 7 7 7 14z" fill="#d6342a" stroke="#5a0e0a" stroke-width="2" stroke-linejoin="round"/>
    <rect x="25" y="34" width="14" height="4" fill="#d6342a"/>
    <path d="M28 52c1 4 2 7 4 9 2-2 3-5 4-9z" fill="#ffb347"/><path d="M30 52c.5 3 1 5 2 6 1-1 1.5-3 2-6z" fill="#fff1b0"/></svg>`,
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `g-squad-ico ${cls}`;
  span.innerHTML = ICONS[name] || '';
  span.setAttribute('aria-hidden', 'true');
  return span;
}

// Rank insignia: chevrons (+ stars after the 5th rank).
export function rankBadge(rank) {
  const span = document.createElement('span');
  span.className = 'g-squad-rank';
  const chev = Math.min(3, (rank % 4) + 1);
  const stars = Math.floor(rank / 4);
  let s = '<svg viewBox="0 0 40 44"><defs><linearGradient id="sqrk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d774"/><stop offset="1" stop-color="#c9971c"/></linearGradient></defs>';
  s += '<path d="M4 4h32v26L20 42 4 30z" fill="#141418" stroke="url(#sqrk)" stroke-width="2.4" stroke-linejoin="round"/>';
  for (let i = 0; i < chev; i++) s += `<path d="M10 ${25 - i * 7}l10 6 10-6" fill="none" stroke="url(#sqrk)" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (let i = 0; i < Math.min(3, stars); i++) s += `<circle cx="${12 + i * 8}" cy="9.5" r="2.3" fill="#f7d774"/>`;
  s += '</svg>';
  span.innerHTML = s;
  return span;
}
