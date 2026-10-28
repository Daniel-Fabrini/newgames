// Small DOM helpers shared by the shell and every game.

// h('div', { class: 'card', onclick: fn, style: { color: 'red' } }, 'text', childNode, [more, nodes])
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

let toastTimer = null;
export function toast(message, ms = 1800) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Shows a modal dialog. Resolves with the `value` of the action pressed
// (or null when dismissed by tapping outside, if `dismissible`).
//   await modal({ title: 'Vitória!', body: 'Você ganhou 3 estrelas', actions: [{ label: 'Próximo', value: 'next', primary: true }] })
export function modal({ title = '', body = null, actions = [{ label: 'OK', value: true, primary: true }], dismissible = false, className = '' } = {}) {
  return new Promise((resolve) => {
    const close = (value) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 180);
      resolve(value);
    };
    const box = h(
      'div',
      { class: `modal ${className}`, role: 'dialog', 'aria-modal': 'true' },
      title ? h('h2', { class: 'modal-title' }, title) : null,
      body === null ? null : typeof body === 'string' ? h('p', { class: 'modal-text' }, body) : body,
      actions.length
        ? h(
            'div',
            { class: 'modal-actions' },
            actions.map((a) =>
              h('button', { class: `btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`, onclick: () => close(a.value) }, a.label),
            ),
          )
        : null,
    );
    const overlay = h('div', { class: 'modal-overlay' }, box);
    if (dismissible) overlay.addEventListener('click', (e) => e.target === overlay && close(null));
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  });
}

// Celebration burst of colored particles over the whole screen.
export function confetti(count = 80) {
  const colors = ['#ffd23f', '#ff5d8f', '#3bceac', '#4d96ff', '#ff8c42', '#b388ff'];
  const layer = h('div', { class: 'confetti-layer' });
  document.body.append(layer);
  for (let i = 0; i < count; i++) {
    const p = h('i', {
      style: {
        left: Math.random() * 100 + 'vw',
        background: colors[i % colors.length],
        animationDelay: Math.random() * 0.4 + 's',
        animationDuration: 1.2 + Math.random() * 1.2 + 's',
        transform: `rotate(${Math.random() * 360}deg)`,
      },
    });
    layer.append(p);
  }
  setTimeout(() => layer.remove(), 3000);
}

// Renders 0–3 stars as a string.
export function stars(n, max = 3) {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
}

// Fisher–Yates shuffle (returns a new array).
export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic PRNG (mulberry32). Useful for seeded level generation.
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Removes accents/case for answer comparison: norm('Brasília') === norm('brasilia')
export function norm(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const loadedCss = new Set();
// Loads a stylesheet once. Pass new URL('./style.css', import.meta.url).
export function loadCSS(url) {
  const href = String(url);
  if (loadedCss.has(href)) return Promise.resolve();
  loadedCss.add(href);
  return new Promise((resolve) => {
    const link = h('link', { rel: 'stylesheet', href });
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.append(link);
  });
}
