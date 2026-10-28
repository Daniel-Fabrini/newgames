// Small gold line icons for the game chrome (24x24, currentColor).

const P = {
  search:
    '<circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.2 15.2 20.5 20.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M7.4 9.2a3.4 3.4 0 0 1 2.6-2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>',
  coin:
    '<circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="#1a1102" stroke-opacity=".35" stroke-width="1.4"/><path d="M12 7.6v8.8M9.6 10.2c0-1 1-1.6 2.4-1.6s2.4.6 2.4 1.5c0 2.3-4.8 1-4.8 3.3 0 .9 1 1.6 2.4 1.6s2.4-.6 2.4-1.6" fill="none" stroke="#1a1102" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  star:
    '<path fill="currentColor" d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8 6.6 19.7l1-6.1-4.4-4.3 6.1-.9L12 2.8Z"/>',
  clock:
    '<circle cx="12" cy="12.5" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7.6v5.2l3.4 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 2.6h5.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3.5 9.6h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="7.4" y="12.6" width="3.2" height="3.2" rx=".8" fill="currentColor"/>',
  play: '<path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.9l10.2-6.4a1 1 0 0 0 0-1.7L9.5 4.7A1 1 0 0 0 8 5.6Z"/>',
  book:
    '<path d="M4 5.5C6.5 4.4 9.5 4.6 12 6.2c2.5-1.6 5.5-1.8 8-.7v12.9c-2.5-1.1-5.5-.9-8 .7-2.5-1.6-5.5-1.8-8-.7V5.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 6.2v12.9" stroke="currentColor" stroke-width="2"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  fire: '<path fill="currentColor" d="M12.3 2.5c.4 2.9-1.1 4.3-2.3 5.7C8.8 9.5 8 10.9 8 12.8 8 16.2 10.1 19 12.6 19c2.7 0 4.4-2.1 4.4-4.6 0-2.1-1-3.3-1.9-4.4-.3 1.2-.9 2-1.7 2.4.2-2.6-.3-5.3-.7-6.6-.1-.5-.2-.8-.4-.9Z"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function icon(name, cls = '') {
  const body = P[name] || '';
  return `<svg class="g-waldo-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
