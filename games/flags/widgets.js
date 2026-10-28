// Small UI building blocks shared by the screens of this game.

import { h } from '../../js/core/ui.js';
import { flagUrl } from '../../js/data/countries.js';

// Timers/listeners owned by one screen, all released by dispose().
export function makeScope() {
  const timers = new Set();
  const rafs = new Set();
  const offs = [];
  const scope = {
    dead: false,
    timeout(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!scope.dead) fn();
      }, ms);
      timers.add(id);
      return id;
    },
    clear(id) {
      clearTimeout(id);
      timers.delete(id);
    },
    raf(fn) {
      const id = requestAnimationFrame((ts) => {
        rafs.delete(id);
        if (!scope.dead) fn(ts);
      });
      rafs.add(id);
      return id;
    },
    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      offs.push(() => target.removeEventListener(type, fn, opts));
    },
    defer(fn) {
      offs.push(fn);
    },
    dispose() {
      if (scope.dead) return;
      scope.dead = true;
      timers.forEach(clearTimeout);
      rafs.forEach(cancelAnimationFrame);
      timers.clear();
      rafs.clear();
      for (const f of offs.splice(0)) {
        try {
          f();
        } catch (e) {
          console.error(e);
        }
      }
    },
  };
  return scope;
}

export function flagImg(c, cls = '') {
  return h('img', { class: cls, src: flagUrl(c), alt: '', draggable: 'false', decoding: 'async' });
}

// A flag shown like a card: rounded, outlined, with a moving cloth shading and
// a gloss highlight. `wave: false` keeps it still.
export function flagCard(c, { cls = '', wave = true } = {}) {
  return h(
    'div',
    { class: `g-flags-card ${wave ? 'g-flags-wave' : ''} ${cls}` },
    h('img', { src: flagUrl(c), alt: '', draggable: 'false' }),
    h('i', { class: 'g-flags-fold', 'aria-hidden': 'true' }),
    h('i', { class: 'g-flags-gloss', 'aria-hidden': 'true' }),
  );
}

export function preload(c) {
  const img = new Image();
  img.src = flagUrl(c);
}

// 2×2 mosaic of flags cropped in a circle.
export function mosaic(countries, cls = '') {
  return h('div', { class: `g-flags-mosaic ${cls}` }, countries.slice(0, 4).map((c) => flagImg(c)));
}

// Progress ring with two arcs: `a` (learned, green) and `b` (mastered, gold).
export function ring({ size = 58, stroke = 5, a = 0, b = 0, inner = null, cls = '', animate = true }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const c = size / 2;
  const arc = (cl, v) =>
    v > 0.001 ? `<circle class="${cl}" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}" data-v="${Math.min(1, v)}" stroke-dasharray="${animate ? 0 : C * Math.min(1, v)} ${C}" transform="rotate(-90 ${c} ${c})"/>` : '';
  const svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="g-flags-ring-track" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}"/>${arc('g-flags-ring-a', a)}${arc('g-flags-ring-b', b)}</svg>`;
  const el = h('div', { class: `g-flags-ring ${cls}`, style: { width: size + 'px', height: size + 'px', '--ring-in': size - stroke * 2 - 6 + 'px' }, html: svg });
  if (inner) el.append(h('div', { class: 'g-flags-ring-in' }, inner));
  if (animate) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.querySelectorAll('circle[data-v]').forEach((ci) => ci.setAttribute('stroke-dasharray', `${C * +ci.dataset.v} ${C}`));
      }),
    );
  }
  return el;
}

export const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2s-7.6-4.7-9.7-9.4C.8 8.3 2.9 4.3 6.7 4.3c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.8 0 5.9 4 4.4 7.5-2.1 4.7-9.7 9.4-9.7 9.4z"/></svg>';

// "❤ 3" lives counter (as in the mockup) that pulses when a life is lost or won.
export function lives() {
  const heart = h('i', { class: 'g-flags-heart', html: HEART_SVG });
  const num = h('b', null, '');
  const el = h('div', { class: 'g-flags-lives', role: 'img' }, heart, num);
  let shown = null;
  el.set = (n, label) => {
    if (shown !== null && n !== shown) restartAnim(el, n < shown ? 'g-flags-lives-lose' : 'g-flags-lives-gain');
    shown = n;
    num.textContent = String(n);
    el.classList.toggle('empty', n <= 0);
    if (label) el.setAttribute('aria-label', label);
  };
  return el;
}

// Row of 3 stars; `animate` pops the earned ones in sequence.
export function starRow(n, { size = '', animate = false, delay = 300 } = {}) {
  const el = h('div', { class: `g-flags-starrow ${size}` });
  for (let i = 0; i < 3; i++) {
    const on = i < n;
    el.append(h('span', { class: `g-flags-star ${on ? 'on' : ''} ${on && animate ? 'g-flags-star-pop' : ''}`, style: on && animate ? { animationDelay: delay + i * 380 + 'ms' } : null }, '★'));
  }
  return el;
}

// Inline ★★☆ for lists.
export function miniStars(n, max = 3) {
  return h('span', { class: 'g-flags-ministars' }, h('b', null, '★'.repeat(n)), '★'.repeat(Math.max(0, max - n)));
}

// Animated number: counts from `from` to `to`.
export function countUp(scope, el, from, to, ms = 900, fmt = (v) => String(v)) {
  const t0 = performance.now();
  el.textContent = fmt(from);
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) scope.raf(step);
  };
  scope.raf(step);
}

// Text that floats up and fades (e.g. "+20 XP").
export function floatText(scope, parent, text, cls = '') {
  const el = h('div', { class: `g-flags-float ${cls}` }, text);
  parent.append(el);
  scope.timeout(() => el.remove(), 1100);
  return el;
}

export function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// Gold line icons (stroke = currentColor).
const ICON_PATHS = {
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3v3H8z"/>',
  infinity: '<path d="M7 8.5a3.5 3.5 0 1 0 0 7c2.2 0 3.6-1.7 5-3.5s2.8-3.5 5-3.5a3.5 3.5 0 1 1 0 7c-2.2 0-3.6-1.7-5-3.5S9.2 8.5 7 8.5z"/>',
  repeat: '<path d="M4 11a8 8 0 0 1 14.3-4.9L20 8M20 3v5h-5M20 13a8 8 0 0 1-14.3 4.9L4 16M4 21v-5h5"/>',
  cards: '<rect x="3" y="7" width="12" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  grid4: '<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="13" width="8" height="7" rx="2"/><rect x="13" y="13" width="8" height="7" rx="2"/>',
  grid6: '<rect x="3" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="3" y="9.5" width="8" height="5" rx="1.5"/><rect x="13" y="9.5" width="8" height="5" rx="1.5"/><rect x="3" y="16" width="8" height="5" rx="1.5"/><rect x="13" y="16" width="8" height="5" rx="1.5"/>',
  abc: '<rect x="2.5" y="6" width="8.5" height="12" rx="2"/><rect x="13" y="6" width="8.5" height="12" rx="2"/><path d="M4.8 15l1.9-6 1.9 6M5.4 13h2.6M15.5 9v6h2a1.5 1.5 0 0 0 0-3h-2 1.6a1.5 1.5 0 0 0 0-3z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="13" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M18 10h.01M18 13.5h.01M8 16h8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  building: '<path d="M3 21h18M5 21v-9M19 21v-9M9.5 21v-9M14.5 21v-9M2.5 10L12 4l9.5 6z"/>',
  trophy: '<path d="M8 21h8M12 16v5M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  fire: '<path d="M12 22c3.9 0 7-2.9 7-7 0-4.2-3.3-6.5-4.3-10.5C12.6 6.3 11.8 8.6 12 10.8 10.8 10 10 8.6 10 6.8 7.6 8.8 5 11.6 5 15c0 4.1 3.1 7 7 7z"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};

export function icon(name, cls = '') {
  return h('span', {
    class: `g-flags-ic ${cls}`,
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ''}</svg>`,
  });
}
