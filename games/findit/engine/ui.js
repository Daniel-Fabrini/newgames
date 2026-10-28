// Small UI pieces for the hidden-object games: gold-framed sheets (pause,
// results, intros), inline SVG icons, coin and star widgets.

import { h } from '../../../js/core/ui.js';

export const ICON = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.6" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.6" fill="currentColor"/></svg>',
  lens: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14.6 14.6 20 20" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M7.2 8.6a3.2 3.2 0 0 1 2.6-2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".7"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 9v4.4l2.8 1.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M9.5 2.8h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 1 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 4.8v14.4a1 1 0 0 0 1.5.9l11.4-7.2a1 1 0 0 0 0-1.7L9.5 3.9A1 1 0 0 0 8 4.8z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3a1 1 0 0 1 1 1v1.5a4.5 4.5 0 0 1-4.1 4.5A5.5 5.5 0 0 1 13 15.9V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.1A5.5 5.5 0 0 1 7.1 12 4.5 4.5 0 0 1 3 7.5V6a1 1 0 0 1 1-1h3V3Zm10 4v3a2.5 2.5 0 0 0 2-2.5V7h-2ZM5 7v.5A2.5 2.5 0 0 0 7 10V7H5Z"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 3.5S9 2.6 5.3 8.6c-2.3 3.8-.9 7.5-.5 8.3L3 18.7l1.4 1.4 1.9-1.9c.8.4 4.6 1.6 8.3-.7 6-3.7 5.9-14 5.9-14Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="3" fill="currentColor"/><rect x="5.5" y="9.5" width="13" height="9" rx="1.2" fill="#18181c"/><rect x="7" y="2.5" width="2.4" height="4.5" rx="1" fill="currentColor"/><rect x="14.6" y="2.5" width="2.4" height="4.5" rx="1" fill="currentColor"/><rect x="7.5" y="11.5" width="3" height="3" rx=".6" fill="currentColor"/></svg>',
  pairs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="9" height="13" rx="2.2" fill="currentColor" transform="rotate(-8 7 11.5)"/><rect x="12.5" y="5" width="9" height="13" rx="2.2" fill="currentColor" transform="rotate(8 17 11.5)"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor"/></svg>',
  hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3.5a1.5 1.5 0 0 1 3 0V11h.5V5a1.5 1.5 0 0 1 3 0v6h.5V7a1.5 1.5 0 0 1 3 0v7.5c0 4-2.7 7-6.6 7-2.7 0-4.2-1.2-5.6-3.3l-2.6-4a1.5 1.5 0 0 1 2.4-1.8L9 14V3.5z"/></svg>',
  pinch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14 4.5 19.5M14 10l5.5-5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 14.5v5.5h5.5M20 9.5V4h-5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6.2 8.5 4l7 2.5L21 4.3v13.5L15.5 20l-7-2.5L3 19.7V6.2Zm6.5-.2v11.6l5 1.8V7.8l-5-1.8Z"/></svg>',
};

export function coinIcon(cls = '') {
  return h('span', { class: `g-findit-coin ${cls}`, 'aria-hidden': 'true' });
}

export function starRow(n, max = 3, cls = '') {
  const row = h('div', { class: `g-findit-stars ${cls}` });
  for (let i = 0; i < max; i++) row.append(h('span', { class: `g-findit-star ${i < n ? 'on' : ''}`, style: { animationDelay: `${0.25 + i * 0.22}s` }, html: ICON.star }));
  return row;
}

// Gold-framed modal panel inside the game root.
// actions: [{ label, primary, onclick }]; returns { close(silent) }.
export function sheet(app, { kind = '', icon, title, subtitle, body, actions = [], onClose, dismissible = true, cls = '' }) {
  let closed = false;
  const close = (silent) => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 220);
    if (!silent && onClose) onClose();
  };
  const panel = h(
    'div',
    { class: `g-findit-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true' },
    icon ? h('div', { class: 'g-findit-sheet-icon', html: icon }) : null,
    title ? h('h2', { class: 'g-findit-sheet-title' }, title) : null,
    subtitle ? h('div', { class: 'g-findit-sheet-sub' }, subtitle) : null,
    body || null,
    actions.length
      ? h(
          'div',
          { class: 'g-findit-sheet-actions' },
          actions.map((a) =>
            h(
              'button',
              {
                class: `g-findit-btn ${a.primary ? 'gold' : 'outline'}`,
                onclick: () => {
                  if (closed) return;
                  app.ctx.sfx.play('tap');
                  if (a.onclick) a.onclick();
                  close();
                },
              },
              a.label,
            ),
          ),
        )
      : null,
  );
  const wrap = h('div', { class: 'g-findit-sheet-wrap' }, panel);
  if (dismissible) wrap.addEventListener('click', (e) => e.target === wrap && close());
  app.root.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  return { close, el: wrap, kind };
}
