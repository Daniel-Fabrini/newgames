// Ball Hero — small inline SVG icons (24×24, currentColor).

const P = {
  ball: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="m12 7.2 3.4 2.5-1.3 4h-4.2l-1.3-4Z"/><path d="M12 7.2V3.2M15.4 9.7l3.8-1.3M14.1 13.7l2.4 3.2M9.9 13.7l-2.4 3.2M8.6 9.7 4.8 8.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  trophy: '<path fill="currentColor" d="M7 3h10v2h3a1 1 0 0 1 1 1v1.5a4.5 4.5 0 0 1-4.1 4.5A5.5 5.5 0 0 1 13 15.9V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.1A5.5 5.5 0 0 1 7.1 12 4.5 4.5 0 0 1 3 7.5V6a1 1 0 0 1 1-1h3V3Zm0 4H5v.5a2.5 2.5 0 0 0 2 2.45V7Zm10 0v2.95a2.5 2.5 0 0 0 2-2.45V7h-2Z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3" fill="currentColor"/><rect x="5.5" y="9.5" width="13" height="9" rx="1.2" fill="#111"/><rect x="7" y="2.5" width="2.4" height="4.5" rx="1.2" fill="currentColor"/><rect x="14.6" y="2.5" width="2.4" height="4.5" rx="1.2" fill="currentColor"/><path d="m9.2 14 2 2 3.8-3.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  cone: '<path fill="currentColor" d="M10.3 3.5h3.4l5.2 15H5.1Z"/><path fill="#111" d="M8.6 9h6.8l.8 2.4H7.8ZM7.1 13.4h9.8l.8 2.4H6.3Z"/><rect x="3" y="18.5" width="18" height="2.5" rx="1.2" fill="currentColor"/>',
  shirt: '<path fill="currentColor" d="M8.5 3 3 5.8l1.9 4.6 2.3-.9V21h9.6V9.5l2.3.9L21 5.8 15.5 3c-.5 1.6-1.8 2.6-3.5 2.6S9 4.6 8.5 3Z"/>',
  help: '<circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.3-1.2.9-1.2 1.7v.5" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.3" fill="#111"/>',
  play: '<path fill="currentColor" d="M7 4.6v14.8a1 1 0 0 0 1.5.9l12-7.4a1 1 0 0 0 0-1.8l-12-7.4A1 1 0 0 0 7 4.6Z"/>',
  retry: '<path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path fill="currentColor" d="M20.5 3.8v5.7h-5.7Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19.5 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  star: '<path fill="currentColor" d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z"/>',
  starO: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="m12 3.4 2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z"/>',
  chevron: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  whistle: '<path fill="currentColor" d="M3 9.5h9.5l1.6-2.2a1 1 0 0 1 .8-.4H21v3h-4.1l-.4 1.1A6 6 0 1 1 3 12.4Z"/><circle cx="9" cy="14" r="2" fill="#111"/>',
  boot: '<path fill="currentColor" d="M4 6h6.5l.8 4.2c2.7.4 5.4 1.3 7.9 2.7 1.3.7 1.8 2.1 1.8 3.4V18H3.5l.5-3.4Z"/><path d="M5 19.5h1.6M9 19.5h1.6M13 19.5h1.6M17 19.5h1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  medal: '<path fill="currentColor" d="M7 2h4l1 4 1-4h4l-3.4 7.3A6 6 0 1 1 10.4 9.3Z"/><circle cx="12" cy="15" r="3.4" fill="#111"/><path fill="currentColor" d="m12 12.6.8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.2Z"/>',
  target: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  curl: '<path d="M4 19c1-7 7-12 15-13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 3.6"/><circle cx="19" cy="6" r="2.6" fill="currentColor"/>',
  head: '<circle cx="11" cy="9" r="5" fill="currentColor"/><path fill="currentColor" d="M4 21c.6-4 3.4-6 7-6s6.4 2 7 6Z"/><circle cx="19.5" cy="4.5" r="2.5" fill="currentColor"/>',
};

export function ico(name, cls = '') {
  return `<svg class="g-hero-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

// Gold coin
export function coinSvg(cls = '') {
  return `<svg class="g-hero-coin ${cls}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="hgc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".5" stop-color="#f3c24a"/><stop offset="1" stop-color="#b97f0e"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#hgc)" stroke="#8a5c05" stroke-width="1"/><circle cx="12" cy="12" r="6.8" fill="none" stroke="#a8730c" stroke-width="1.2"/><path fill="#8a5c05" d="m12 7.6 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4Z"/></svg>`;
}

// Trophy artwork for the cabinet / reveal (gold, with variants).
export function trophySvg(kind, size = 72) {
  const gold = '<linearGradient id="tg-$" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".45" stop-color="#f3c24a"/><stop offset="1" stop-color="#a86f08"/></linearGradient>';
  const id = kind + Math.floor(Math.random() * 1e6);
  const g = gold.replace('$', id);
  const f = `url(#tg-${id})`;
  let body;
  if (kind === 'goldenBall') {
    body = `<circle cx="32" cy="26" r="17" fill="${f}" stroke="#8a5c05" stroke-width="1.5"/><path fill="#8a5c05" opacity=".55" d="m32 17 6 4.4-2.3 7h-7.4l-2.3-7Z"/><path d="M32 17v-8M38 21.4l7.4-2.6M35.7 28.4l4.6 6.4M28.3 28.4l-4.6 6.4M26 21.4l-7.4-2.6" stroke="#8a5c05" stroke-width="1.6" opacity=".55"/><rect x="22" y="46" width="20" height="5" rx="1.5" fill="${f}"/><rect x="18" y="51" width="28" height="8" rx="2" fill="#1b1b1f" stroke="${f}" stroke-width="1.5"/>`;
  } else if (kind === 'seasonStar') {
    body = `<path fill="${f}" stroke="#8a5c05" stroke-width="1.2" d="m32 6 7 14.2 15.6 2.3-11.3 11 2.7 15.6L32 41.7l-14 7.4 2.7-15.6-11.3-11 15.6-2.3Z"/><rect x="26" y="45" width="12" height="6" fill="${f}"/><rect x="18" y="51" width="28" height="8" rx="2" fill="#1b1b1f" stroke="${f}" stroke-width="1.5"/>`;
  } else if (kind === 'league' || kind === 'eliteLeague') {
    body = `<path fill="${f}" stroke="#8a5c05" stroke-width="1.2" d="M20 8h24v4c0 10-5 18-12 20-7-2-12-10-12-20Z"/><path fill="${f}" d="M14 10h6v4h-3c0 5 2 8 5 9l-1 3c-5-1-7-6-7-12Zm36 0h-6v4h3c0 5-2 8-5 9l1 3c5-1 7-6 7-12Z"/><rect x="29" y="32" width="6" height="10" fill="${f}"/><path fill="${f}" d="M22 42h20l3 9H19Z"/><rect x="16" y="51" width="32" height="8" rx="2" fill="#1b1b1f" stroke="${f}" stroke-width="1.5"/><circle cx="32" cy="17" r="4" fill="#8a5c05" opacity=".45"/>`;
  } else if (kind === 'worldChamp' || kind === 'clubWorld') {
    body = `<path fill="${f}" stroke="#8a5c05" stroke-width="1.2" d="M24 50c2-8 1-14-3-20-5-7-3-18 6-22 6-3 13-1 16 5 3 7-1 12-5 16-4 5-4 12-2 21Z"/><circle cx="31" cy="18" r="7" fill="#8a5c05" opacity=".35"/><rect x="16" y="51" width="32" height="8" rx="2" fill="#1b1b1f" stroke="${f}" stroke-width="1.5"/><rect x="18" y="53.5" width="28" height="1.6" fill="${f}" opacity=".8"/>`;
  } else if (kind === 'superCup' || kind === 'nationsCup') {
    body = `<path fill="${f}" stroke="#8a5c05" stroke-width="1.2" d="M18 8h28l-3 18c-1 6-5 9-11 9s-10-3-11-9Z"/><path fill="${f}" d="M30 35h4v8h-4Z"/><ellipse cx="32" cy="46" rx="10" ry="3.5" fill="${f}"/><rect x="18" y="49" width="28" height="10" rx="2" fill="#1b1b1f" stroke="${f}" stroke-width="1.5"/><path d="M22 13h20" stroke="#fff6cf" stroke-width="1.5" opacity=".7"/>`;
  } else {
    // classic cup with handles
    body = `<path fill="${f}" stroke="#8a5c05" stroke-width="1.2" d="M19 7h26v6c0 10-6 17-13 17s-13-7-13-17Z"/><path fill="none" stroke="${f}" stroke-width="3.2" d="M19 10c-6 0-8 3-7 7 1 5 5 7 9 7M45 10c6 0 8 3 7 7-1 5-5 7-9 7"/><rect x="29.5" y="30" width="5" height="9" fill="${f}"/><path fill="${f}" d="M23 39h18l2 10H21Z"/><rect x="17" y="49" width="30" height="10" rx="2" fill="#1b1b1f" stroke="${f}" stroke-width="1.5"/><path d="M24 11h4" stroke="#fff6cf" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
  }
  return `<svg class="g-hero-trophy" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs>${g}</defs>${body}</svg>`;
}
