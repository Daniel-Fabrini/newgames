// Line/solid icons used by the shell (24×24 viewBox, colored with currentColor).

const P = {
  back: '<path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  gear: '<path fill="currentColor" d="M13.9 2.5a1 1 0 0 1 1 .8l.3 1.9c.5.2 1 .5 1.4.8l1.8-.7a1 1 0 0 1 1.2.4l1.9 3.3a1 1 0 0 1-.2 1.3l-1.5 1.2a7 7 0 0 1 0 1.6l1.5 1.2a1 1 0 0 1 .2 1.3l-1.9 3.3a1 1 0 0 1-1.2.4l-1.8-.7c-.4.3-.9.6-1.4.8l-.3 1.9a1 1 0 0 1-1 .8h-3.8a1 1 0 0 1-1-.8l-.3-1.9c-.5-.2-1-.5-1.4-.8l-1.8.7a1 1 0 0 1-1.2-.4L2.3 16a1 1 0 0 1 .2-1.3L4 13.5a7 7 0 0 1 0-1.6L2.5 10.7a1 1 0 0 1-.2-1.3l1.9-3.3a1 1 0 0 1 1.2-.4l1.8.7c.4-.3.9-.6 1.4-.8l.3-1.9a1 1 0 0 1 1-.8h4ZM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"/>',
  user: '<circle cx="12" cy="8" r="4.2" fill="currentColor"/><path fill="currentColor" d="M3.8 20.2c.6-4 4-6.4 8.2-6.4s7.6 2.4 8.2 6.4a1 1 0 0 1-1 1.1H4.8a1 1 0 0 1-1-1.1Z"/>',
  users: '<circle cx="8.5" cy="8.5" r="3.6" fill="currentColor"/><circle cx="16.6" cy="9.4" r="3" fill="currentColor"/><path fill="currentColor" d="M1.8 19.8c.5-3.4 3.3-5.5 6.7-5.5s6.2 2.1 6.7 5.5a.9.9 0 0 1-.9 1H2.7a.9.9 0 0 1-.9-1Z"/><path fill="currentColor" d="M16.2 20.8c.1-.4.2-.7.1-1.1a7 7 0 0 0-2.1-4.2c.8-.4 1.6-.6 2.5-.6 2.9 0 5.2 1.8 5.6 4.7a.9.9 0 0 1-.9 1.1h-5.2Z"/>',
  trophy: '<path fill="currentColor" d="M7 3h10v2h3a1 1 0 0 1 1 1v1.5a4.5 4.5 0 0 1-4.1 4.5A5.5 5.5 0 0 1 13 15.9V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.1A5.5 5.5 0 0 1 7.1 12 4.5 4.5 0 0 1 3 7.5V6a1 1 0 0 1 1-1h3V3Zm10 4v3a2.5 2.5 0 0 0 2-2.5V7h-2ZM5 7v.5A2.5 2.5 0 0 0 7 10V7H5Z"/>',
  home: '<path fill="currentColor" d="M11.3 2.6a1 1 0 0 1 1.4 0l9 8.6a1 1 0 0 1-.7 1.7h-1.6V20a1.5 1.5 0 0 1-1.5 1.5h-3.6v-5.6a1 1 0 0 0-1-1h-2.6a1 1 0 0 0-1 1v5.6H6.1A1.5 1.5 0 0 1 4.6 20v-7.1H3a1 1 0 0 1-.7-1.7l9-8.6Z"/>',
  heart: '<path fill="currentColor" d="M12 21s-8.6-5.1-9.8-10.8C1.4 6.4 3.9 3.6 7.1 3.6c2 0 3.6 1 4.9 2.8 1.3-1.8 2.9-2.8 4.9-2.8 3.2 0 5.7 2.8 4.9 6.6C20.6 15.9 12 21 12 21Z"/>',
  heartOutline: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M12 20s-7.8-4.7-8.9-9.9C2.4 6.7 4.6 4.6 7.2 4.6c1.9 0 3.4 1 4.8 3 1.4-2 2.9-3 4.8-3 2.6 0 4.8 2.1 4.1 5.5C19.8 15.3 12 20 12 20Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  play: '<path fill="currentColor" d="M7 4.6v14.8a1 1 0 0 0 1.5.9l12-7.4a1 1 0 0 0 0-1.8l-12-7.4A1 1 0 0 0 7 4.6Z"/>',
  crown: '<path fill="currentColor" d="M2.5 7.2 7.3 11 11.2 4a.9.9 0 0 1 1.6 0l3.9 7 4.8-3.8a.6.6 0 0 1 1 .6l-2.2 9.7a1 1 0 0 1-1 .8H4.7a1 1 0 0 1-1-.8L1.5 7.8a.6.6 0 0 1 1-.6Z"/><rect x="4.2" y="18.6" width="15.6" height="2.4" rx="1" fill="currentColor"/>',
  flag: '<path fill="currentColor" d="M5 2.5a1 1 0 0 1 1 1V4h11.6a.8.8 0 0 1 .6 1.3L16 8.5l2.2 3.2a.8.8 0 0 1-.6 1.3H6v8a1 1 0 1 1-2 0V3.5a1 1 0 0 1 1-1Z"/>',
  skull: '<path fill="currentColor" d="M12 2.5c5 0 8.5 3.4 8.5 8 0 2.5-1.1 4.4-2.8 5.5v2.5a1.5 1.5 0 0 1-1.5 1.5H15v-2h-1.5v2h-3v-2H9v2H7.8a1.5 1.5 0 0 1-1.5-1.5V16c-1.7-1.1-2.8-3-2.8-5.5 0-4.6 3.5-8 8.5-8Zm-3.4 7a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm6.8 0a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z"/>',
  castle: '<path fill="currentColor" d="M3 4h3v2h2V4h3v2h2V4h3v2h2V4h3v6l-2 2v9h-6v-4a2 2 0 1 0-4 0v4H5v-9l-2-2V4Z"/>',
  question: '<circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.3-1.2.9-1.2 1.7v.5" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.3" fill="#111"/>',
  pin: '<path fill="currentColor" d="M12 2a7.5 7.5 0 0 1 7.5 7.5c0 5.3-6.3 11.4-6.8 11.9a1 1 0 0 1-1.4 0C10.8 20.9 4.5 14.8 4.5 9.5A7.5 7.5 0 0 1 12 2Zm0 4.6a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z"/>',
  infinity: '<path d="M6.8 8.2c-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c3.6 0 6.8-7.6 10.4-7.6 2.1 0 3.8 1.7 3.8 3.8s-1.7 3.8-3.8 3.8c-3.6 0-6.8-7.6-10.4-7.6Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="13" r="8.5" fill="currentColor"/><path d="M12 8.5V13l3 2" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><rect x="9.5" y="1.5" width="5" height="2.4" rx="1" fill="currentColor"/>',
  building: '<path fill="currentColor" d="M12 2 2.5 7v2h19V7L12 2ZM4 10.5h3v7.5H4zm6.5 0h3v7.5h-3zm6.5 0h3v7.5h-3zM2.5 19.5h19V22h-19z"/>',
  stairs: '<path fill="currentColor" d="M15 3h6v18H3v-6h6v-6h6V3Z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3" fill="currentColor"/><rect x="5.5" y="9.5" width="13" height="9" rx="1.2" fill="#111"/><rect x="7" y="2.5" width="2.4" height="4.5" rx="1" fill="currentColor"/><rect x="14.6" y="2.5" width="2.4" height="4.5" rx="1" fill="currentColor"/><rect x="7.5" y="11.5" width="3" height="3" rx=".6" fill="currentColor"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor"/>',
  leaf: '<path fill="currentColor" d="M20.5 3.5S9 2.6 5.3 8.6c-2.3 3.8-.9 7.5-.5 8.3L3 18.7l1.4 1.4 1.9-1.9c.8.4 4.6 1.6 8.3-.7 6-3.7 5.9-14 5.9-14Z"/>',
  pairs: '<rect x="2.5" y="5" width="9" height="13" rx="2.2" fill="currentColor" transform="rotate(-8 7 11.5)"/><rect x="12.5" y="5" width="9" height="13" rx="2.2" fill="currentColor" transform="rotate(8 17 11.5)"/>',
  one: '<text x="12" y="18" text-anchor="middle" font-size="17" font-weight="900" font-family="Nunito, sans-serif" fill="currentColor">1</text>',
  two: '<text x="12" y="18" text-anchor="middle" font-size="17" font-weight="900" font-family="Nunito, sans-serif" fill="currentColor">2</text>',
  three: '<text x="12" y="18" text-anchor="middle" font-size="17" font-weight="900" font-family="Nunito, sans-serif" fill="currentColor">3</text>',
  lock: '<rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}
