// Inline SVG icons (24×24). Gold fills use the gradients defined once in DEFS
// (#g-ws-gold / #g-ws-coin), injected by main.js at mount.

export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<defs>
<linearGradient id="g-ws-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".45" stop-color="#f7d774"/><stop offset="1" stop-color="#c9971c"/></linearGradient>
<linearGradient id="g-ws-coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f5c843"/><stop offset="1" stop-color="#b8810f"/></linearGradient>
<radialGradient id="g-ws-glow" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff7cf"/><stop offset="1" stop-color="#f3c24a"/></radialGradient>
</defs></svg>`;

const P = {
  coin: '<circle cx="12" cy="12" r="10" fill="url(#g-ws-coin)" stroke="#8a5c05" stroke-width="1.2"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#a8740c" stroke-width="1.1" opacity=".8"/><path d="m12 7.4 1.4 2.9 3.1.4-2.3 2.1.6 3.1L12 14.4l-2.8 1.5.6-3.1-2.3-2.1 3.1-.4Z" fill="#fff6c8" stroke="#a8740c" stroke-width=".6"/>',
  bulb: '<path d="M12 2.2a7 7 0 0 0-4.2 12.6c.7.5 1.2 1.3 1.2 2.2v.6h6v-.6c0-.9.5-1.7 1.2-2.2A7 7 0 0 0 12 2.2Z" fill="url(#g-ws-gold)"/><rect x="9" y="18.4" width="6" height="1.8" rx=".9" fill="#c9971c"/><rect x="9.6" y="20.8" width="4.8" height="1.6" rx=".8" fill="#a8740c"/><path d="M10 8.5a2.6 2.6 0 0 1 2-1.6" stroke="#fffbe6" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  spot: '<path d="M3 21 9.5 9.5 14.5 14.5Z" fill="url(#g-ws-gold)" opacity=".35"/><rect x="10.2" y="3.2" width="7" height="10" rx="2" transform="rotate(45 13.7 8.2)" fill="url(#g-ws-gold)"/><circle cx="9.8" cy="12.2" r="2.2" fill="#fff7cf"/><path d="M17.2 2.6 21.4 6.8" stroke="#c9971c" stroke-width="2" stroke-linecap="round"/>',
  eye: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="url(#g-ws-gold)" stroke-width="2.8"/><path d="m15.5 15.5 5.2 5.2" stroke="url(#g-ws-gold)" stroke-width="3.2" stroke-linecap="round"/><path d="M7.6 9.2a3.2 3.2 0 0 1 2.4-2.2" stroke="#fff7cf" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  map: '<path d="M3 6.2 8.5 4l7 2.2L21 4v13.8L15.5 20l-7-2.2L3 20Z" fill="url(#g-ws-gold)"/><path d="M8.5 4v13.8M15.5 6.2V20" stroke="#8a5c05" stroke-width="1.2" opacity=".55"/><circle cx="12" cy="11" r="1.6" fill="#8a5c05"/>',
  pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.4" fill="url(#g-ws-gold)"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" fill="url(#g-ws-gold)"/>',
  skip: '<path d="M4 5.2v13.6a.8.8 0 0 0 1.2.7L15 12.7a.8.8 0 0 0 0-1.4L5.2 4.5a.8.8 0 0 0-1.2.7Z" fill="url(#g-ws-gold)"/><rect x="16.6" y="4.5" width="3.4" height="15" rx="1.2" fill="url(#g-ws-gold)"/>',
  star: '<path d="m12 2.6 2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8Z" fill="url(#g-ws-gold)" stroke="#a8740c" stroke-width=".8" stroke-linejoin="round"/>',
  starEmpty: '<path d="m12 2.6 2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8Z" fill="#2a2a31" stroke="#5a5242" stroke-width="1" stroke-linejoin="round"/>',
  flame: '<path d="M12.6 2.4c.4 3-1.8 4.4-3.4 6.4C7.4 11 6.6 12.6 6.6 14.6a5.4 5.4 0 0 0 10.8.2c0-2.6-1.4-4.2-2.4-5.6-.2 1.4-.8 2.4-1.8 3 .6-3.4-.2-6.8-1.6-9.8Z" fill="url(#g-ws-gold)"/><path d="M12 13.4c1.6 1.2 2.4 2.4 2.2 3.8A2.3 2.3 0 0 1 9.7 17c-.1-1.4.9-2.4 2.3-3.6Z" fill="#fff7cf"/>',
  clock: '<circle cx="12" cy="13" r="8.6" fill="url(#g-ws-gold)"/><circle cx="12" cy="13" r="6.6" fill="#17171b"/><path d="M12 9v4.2l2.8 1.8" stroke="#f7d774" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="9.6" y="1.6" width="4.8" height="2.4" rx="1" fill="url(#g-ws-gold)"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3" fill="url(#g-ws-gold)"/><rect x="5.4" y="9.4" width="13.2" height="9.2" rx="1.4" fill="#17171b"/><rect x="7" y="2.4" width="2.4" height="4.6" rx="1" fill="#c9971c"/><rect x="14.6" y="2.4" width="2.4" height="4.6" rx="1" fill="#c9971c"/><path d="m8.6 14 2.2 2.2 4.6-4.6" stroke="#f7d774" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.4" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  check: '<path d="m5 12.5 4.4 4.4L19 7.3" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M7 4.6v14.8a1 1 0 0 0 1.5.9l12-7.4a1 1 0 0 0 0-1.8l-12-7.4A1 1 0 0 0 7 4.6Z" fill="currentColor"/>',
  trophy: '<path fill="url(#g-ws-gold)" d="M7 3h10v2h3a1 1 0 0 1 1 1v1.5a4.5 4.5 0 0 1-4.1 4.5A5.5 5.5 0 0 1 13 15.9V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.1A5.5 5.5 0 0 1 7.1 12 4.5 4.5 0 0 1 3 7.5V6a1 1 0 0 1 1-1h3V3Zm10 4v3a2.5 2.5 0 0 0 2-2.5V7h-2ZM5 7v.5A2.5 2.5 0 0 0 7 10V7H5Z"/>',
  sparkle: '<path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z" fill="url(#g-ws-gold)"/>',
};

export function icon(name, cls = '') {
  return `<svg class="g-wordsearch-svg ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}
