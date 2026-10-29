// Table surfaces, seats, piles, HUD pieces, modals, chips, avatars — DOM builders (vanilla).
// Import cards.css once:  ctx.loadCSS(new URL('../_cards/cards.css', import.meta.url))
import { h as h0 } from '../../js/core/ui.js';
import { cardEl, anyCardEl, cardSizePx } from './card.js';
import { getCardLang } from './decks.js';


// h() wrapper: supports CSS custom properties ('--x') inside the style object.
function h(tag, attrs, ...children) {
  const st = attrs && typeof attrs.style === 'object' ? attrs.style : null;
  const el = h0(tag, st ? { ...attrs, style: null } : attrs, ...children);
  if (st) for (const k of Object.keys(st)) (k.startsWith('--') ? el.style.setProperty(k, st[k]) : (el.style[k] = st[k]));
  return el;
}

const reduced = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
const L10N = {
  pt: { close: 'Fechar', ok: 'OK', rules: 'Regras', history: 'Histórico', score: 'Pontos', yourTurn: 'Sua vez', pot: 'Pote', win: 'Vitória', lose: 'Derrota', draw: 'Empate', gotIt: 'Entendi' },
  en: { close: 'Close', ok: 'OK', rules: 'Rules', history: 'History', score: 'Score', yourTurn: 'Your turn', pot: 'Pot', win: 'Victory', lose: 'Defeat', draw: 'Draw', gotIt: 'Got it' },
  es: { close: 'Cerrar', ok: 'OK', rules: 'Reglas', history: 'Historial', score: 'Puntos', yourTurn: 'Tu turno', pot: 'Bote', win: 'Victoria', lose: 'Derrota', draw: 'Empate', gotIt: 'Entendido' },
};
export const tx = (k, lang) => (L10N[lang || getCardLang()] || L10N.en)[k] || k;

// ---------------------------------------------------------------- seats
/**
 * Seat positions around a table (percent of the table box, centre 50/50). Seat 0 = local player at the bottom,
 * going clockwise on screen (bottom → left → top → right). Supported counts: 2,3,4,5,6,8,9 (any 2–9 works).
 * Returns [{ i, x, y, angle, side:'bottom'|'left'|'top'|'right', orient:'h'|'v', tx, ty }]  (tx/ty = unit vector toward centre)
 * opts: { shape:'oval'|'rect', portrait:boolean, rx, ry }
 */
export function seatLayout(n, { shape = 'oval', portrait = false, rx, ry } = {}) {
  const RX = rx ?? (portrait ? 37 : 40);
  const RY = ry ?? (portrait ? 36 : 34);
  const out = [];
  for (let i = 0; i < n; i++) {
    const th = (i * 2 * Math.PI) / n;
    let dx = -Math.sin(th);
    let dy = Math.cos(th);
    if (shape === 'rect') {
      const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
      dx /= m; dy /= m;
    }
    const x = 50 + dx * RX;
    const y = 50 + dy * RY;
    const s = Math.sin(th);
    const c = Math.cos(th);
    const side = i === 0 ? 'bottom' : s > 0.5 ? 'left' : s < -0.5 ? 'right' : c > 0 ? 'bottom' : 'top';
    out.push({ i, x, y, angle: (th * 180) / Math.PI, side, orient: side === 'left' || side === 'right' ? 'v' : 'h', tx: -dx, ty: -dy });
  }
  return out;
}

/**
 * Table surface. opts: { surface:'felt'|'midnight'|'burgundy'|'charcoal', rim:'wood'|'charcoal'|'gold'|'none',
 *  shape:'oval'|'rect', seats: n, portrait: 'auto'|boolean }
 * Returns { el, felt, center, seatsLayer, seatEls:[div], layout, setSurface(), setRim(), setSeats(n), destroy() }
 * Put your hands / chips / avatars into seatEls[i] (absolutely positioned, centred on the seat position).
 */
export function createTable(root, opts = {}) {
  const o = { surface: 'felt', rim: 'wood', shape: 'oval', seats: 4, portrait: 'auto', ...opts };
  const el = h('div', { class: 'dt' });
  const felt = h('div', { class: 'dt-felt' });
  const center = h('div', { class: 'dt-center' });
  const seatsLayer = h('div', { class: 'dt-seats' });
  el.append(felt, center, seatsLayer);
  root.append(el);
  const api = { el, felt, center, seatsLayer, seatEls: [], layout: [] };
  const apply = () => {
    el.className = `dt dt-s-${o.surface} dt-rim-${o.rim} dt-${o.shape}`;
  };
  function build() {
    const portrait = o.portrait === 'auto' ? el.clientHeight > el.clientWidth * 1.05 : !!o.portrait;
    api.layout = seatLayout(o.seats, { shape: o.shape, portrait });
    while (api.seatEls.length < o.seats) {
      const s = h('div', { class: 'dt-seat' });
      seatsLayer.append(s);
      api.seatEls.push(s);
    }
    while (api.seatEls.length > o.seats) api.seatEls.pop().remove();
    api.layout.forEach((p, i) => {
      const s = api.seatEls[i];
      s.style.left = p.x + '%';
      s.style.top = p.y + '%';
      s.dataset.side = p.side;
      s.dataset.orient = p.orient;
      s.dataset.seat = String(i);
    });
    el.classList.toggle('is-portrait', portrait);
    api.portrait = portrait;
  }
  apply();
  build();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    let last = '';
    ro = new ResizeObserver(() => {
      const k = o.portrait === 'auto' ? String(el.clientHeight > el.clientWidth * 1.05) : '';
      if (k !== last) { last = k; build(); }
    });
    ro.observe(el);
  }
  Object.assign(api, {
    setSurface(s) { o.surface = s; apply(); build(); },
    setRim(r) { o.rim = r; apply(); build(); },
    setSeats(n) { o.seats = n; build(); },
    seatPoint(i) { const r = el.getBoundingClientRect(); const p = api.layout[i]; return { x: r.left + (r.width * p.x) / 100, y: r.top + (r.height * p.y) / 100 }; },
    destroy() { if (ro) ro.disconnect(); el.remove(); },
  });
  return api;
}

// ---------------------------------------------------------------- piles
/** Draw pile: stacked backs + count badge. el.setCount(n), el.topEl. opts { count, size, back, label, onClick } */
export function deckPile(opts = {}) {
  const o = { count: 52, size: 'md', back: undefined, showCount: true, ...opts };
  const el = h('div', { class: 'dt-pile dt-deck', style: { '--cw': cardSizePx(o.size) + 'px' } });
  const stack = h('div', { class: 'dt-pile-stack' });
  const badge = h('div', { class: 'dt-count' });
  el.append(stack);
  if (o.showCount) el.append(badge);
  if (o.label) el.append(h('div', { class: 'dt-pile-label' }, o.label));
  if (o.onClick) { el.tabIndex = 0; el.setAttribute('role', 'button'); el.addEventListener('click', o.onClick); el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), o.onClick(e))); }
  el.setCount = (n) => {
    o.count = n;
    stack.textContent = '';
    const layers = Math.min(6, Math.max(0, Math.ceil(n / 8)));
    if (n <= 0) {
      stack.append(h('div', { class: 'dt-empty' }));
    } else {
      for (let i = 0; i < layers; i++) {
        const c = cardEl(null, { back: o.back });
        c.removeAttribute('role');
        c.style.position = i ? 'absolute' : 'relative';
        c.style.left = '0';
        c.style.top = '0';
        c.style.translate = `${-i * 0.9}px ${-i * 1.1}px`;
        c.style.boxShadow = i === layers - 1 ? '' : 'none';
        stack.append(c);
        if (i === layers - 1) el.topEl = c;
      }
    }
    badge.textContent = String(n);
    el.setAttribute('aria-label', `${o.label || 'Deck'}: ${n}`);
  };
  el.setCount(o.count);
  return el;
}

const hashStr = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };

/** Discard/play pile showing the top 3 cards with slight natural scatter. el.setCards(cards[]), el.topEl */
export function discardPile(opts = {}) {
  const o = { size: 'md', deck: undefined, back: undefined, lang: undefined, ...opts };
  const el = h('div', { class: 'dt-pile dt-discard', style: { '--cw': cardSizePx(o.size) + 'px' } });
  const empty = h('div', { class: 'dt-empty' });
  el.setCards = (cards, extra = {}) => {
    el.textContent = '';
    el.topEl = null;
    if (!cards.length) { el.append(empty); return; }
    const shown = cards.slice(-3);
    shown.forEach((c, i) => {
      const hsh = hashStr(c.id);
      const c0 = anyCardEl(c, { deck: o.deck, lang: o.lang, faceDown: false, ...extra });
      c0.style.position = i ? 'absolute' : 'relative';
      c0.style.left = '0'; c0.style.top = '0';
      const last = i === shown.length - 1;
      const rot = last && !extra.straight ? ((hsh % 9) - 4) * 0.8 : ((hsh % 13) - 6) * 1.6;
      c0.style.transform = `rotate(${rot}deg) translate(${((hsh >> 3) % 5) - 2}px, ${((hsh >> 5) % 5) - 2}px)`;
      el.append(c0);
      el.topEl = c0;
    });
  };
  el.setCards([]);
  return el;
}

/**
 * Centre trick area: one slot per seat, placed on the line from the table centre toward that seat.
 *   const trick = trickArea({ seats: layoutArray, size:'sm' });   trick.place(seat, card, {faceDown})  → card el
 *   trick.slotRect(seat) · trick.clear() → removes cards · trick.cards()
 */
export function trickArea({ seats, size = 'sm', spread = 0.3, deck, back, lang } = {}) {
  const el = h('div', { class: 'dt-trick', style: { '--cw': cardSizePx(size) + 'px' } });
  const slots = seats.map((p, i) => {
    const s = h('div', { class: 'dt-trick-slot', dataset: { seat: i } });
    s.style.left = 50 + (50 - p.x) * -spread * 1.9 * -1 + '%';
    s.style.left = 50 + (p.x - 50) * spread * 2 + '%';
    s.style.top = 50 + (p.y - 50) * spread * 2 + '%';
    el.append(s);
    return s;
  });
  const api = {
    el,
    slots,
    place(seat, card, o = {}) {
      const slot = slots[seat];
      slot.textContent = '';
      const c = anyCardEl(card, { deck, back, lang, faceDown: o.faceDown ?? false });
      const hsh = hashStr(card ? card.id : String(seat));
      c.style.transform = `rotate(${((hsh % 11) - 5) * 1.2}deg)`;
      slot.append(c);
      return c;
    },
    cardEl: (seat) => slots[seat].firstChild,
    slotRect: (seat) => slots[seat].getBoundingClientRect(),
    cards: () => slots.map((s) => s.firstChild).filter(Boolean),
    clear() { slots.forEach((s) => (s.textContent = '')); },
  };
  return api;
}

// ---------------------------------------------------------------- avatars
const PALETTES = [['#d94f5c', '#ffe3b0'], ['#2f7fd4', '#d9ecff'], ['#2aa56b', '#e0ffe9'], ['#e7a82e', '#3a2a05'], ['#8a4fd0', '#f0e0ff'], ['#e8743a', '#fff0e0'], ['#2fb5b0', '#043b3a'], ['#c9ced8', '#222733']];
const MOTIFS = [
  (a, b) => [30, 22, 14, 6].map((r, i) => `<circle cx="32" cy="32" r="${r}" fill="${i % 2 ? a : b}" fill-opacity="${i % 2 ? 1 : 0.85}"/>`).join(''),
  (a, b) => `<g fill="${b}" fill-opacity=".85"><path d="M-10 22 L22 -10 H34 L-10 34Z"/><path d="M-10 44 L44 -10 H56 L-10 56Z"/><path d="M10 74 L74 10 V22 L22 74Z"/></g>`,
  (a, b) => `<path d="M0 64 L22 24 L36 46 L46 32 L64 64Z" fill="${b}"/><circle cx="46" cy="16" r="7" fill="${b}" fill-opacity=".8"/>`,
  (a, b) => `<polygon points="32,6 55,19 55,45 32,58 9,45 9,19" fill="${b}" fill-opacity=".9"/><polygon points="32,18 45,25 45,39 32,46 19,39 19,25" fill="${a}"/>`,
  (a, b) => Array.from({ length: 12 }, (_, i) => `<path d="M32 32 L32 -2" stroke="${b}" stroke-width="3" stroke-opacity=".7" transform="rotate(${i * 30} 32 32)"/>`).join('') + `<circle cx="32" cy="32" r="12" fill="${b}"/>`,
  (a, b) => [18, 32, 46].map((y) => `<path d="M-2 ${y} Q8 ${y - 9} 16 ${y} T32 ${y} T48 ${y} T66 ${y}" fill="none" stroke="${b}" stroke-width="4" stroke-linecap="round"/>`).join(''),
  (a, b) => `<g fill="${b}" fill-opacity=".85"><rect x="6" y="6" width="24" height="24" rx="3"/><rect x="34" y="34" width="24" height="24" rx="3"/></g><g fill="${b}" fill-opacity=".35"><rect x="34" y="6" width="24" height="24" rx="3"/><rect x="6" y="34" width="24" height="24" rx="3"/></g>`,
  (a, b) => Array.from({ length: 4 }, (_, i) => `<ellipse cx="32" cy="17" rx="7" ry="15" fill="${b}" fill-opacity=".85" transform="rotate(${i * 90} 32 32)"/>`).join('') + `<circle cx="32" cy="32" r="5" fill="${a}"/>`,
];
export const AVATAR_COUNT = 16;
/** Original geometric avatar (id 0–15). Returns an <svg> element-compatible HTML string via avatarEl(). */
export function avatarSvg(id = 0) {
  const i = ((id % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const [a, b] = PALETTES[(i + (i >> 3) * 4) % 8];
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><clipPath id="av${i}"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#av${i})"><rect width="64" height="64" fill="${a}"/>${MOTIFS[i % 8](a, b)}</g></svg>`;
}
export const avatarIdForName = (name = '') => Math.abs(hashStr(String(name))) % AVATAR_COUNT;
export function avatarEl(id = 0, size = 44) {
  const e = h('span', { class: 'dt-avatar', style: { '--as': size + 'px' }, html: avatarSvg(id) });
  return e;
}

/**
 * Player chip. opts { name, avatar:0-15|null, initial, color (ring / team colour), role:'D'|'SB'|'BB'|'dealer'|text,
 *   stack, score, sub, active, folded, size:'sm'|'md', layout:'col'|'row', badge }
 * el.update({...patch})
 */
export function playerChip(opts = {}) {
  const el = h('div', { class: 'dt-chip' });
  const state = { size: 'md', layout: 'col', ...opts };
  const av = h('div', { class: 'dt-chip-av' });
  const info = h('div', { class: 'dt-chip-info' });
  const nameEl = h('div', { class: 'dt-chip-name' });
  const subEl = h('div', { class: 'dt-chip-sub' });
  const roleEl = h('div', { class: 'dt-chip-role' });
  info.append(nameEl, subEl);
  el.append(av, info, roleEl);
  function render() {
    const s = state;
    el.className = `dt-chip dt-chip-${s.size} dt-chip-${s.layout}${s.active ? ' is-active' : ''}${s.folded ? ' is-folded' : ''}`;
    if (s.color) el.style.setProperty('--tc', s.color); else el.style.removeProperty('--tc');
    const px = s.size === 'sm' ? 34 : s.size === 'lg' ? 56 : 44;
    av.textContent = '';
    if (s.avatar !== undefined && s.avatar !== null) av.append(avatarEl(s.avatar, px));
    else av.append(h('span', { class: 'dt-avatar dt-initial', style: { '--as': px + 'px' } }, (s.initial || (s.name || '?')[0] || '?').toUpperCase()));
    nameEl.textContent = s.name || '';
    const bits = [];
    if (s.stack !== undefined && s.stack !== null) bits.push(String(s.stack));
    if (s.score !== undefined && s.score !== null) bits.push(String(s.score));
    if (s.sub) bits.push(s.sub);
    subEl.textContent = bits.join(' · ');
    subEl.hidden = !bits.length;
    roleEl.textContent = s.role === 'dealer' ? 'D' : s.role || '';
    roleEl.hidden = !s.role;
    roleEl.dataset.role = s.role === 'dealer' ? 'D' : s.role || '';
    if (s.name) el.setAttribute('aria-label', `${s.name}${bits.length ? ', ' + bits.join(', ') : ''}${s.active ? ' ●' : ''}`);
  }
  el.update = (patch) => { Object.assign(state, patch); render(); return el; };
  render();
  return el;
}

// ---------------------------------------------------------------- HUD bits
/** Turn indicator pill. el.set(text, { mine:bool, tone }) */
export function turnIndicator(text = '', opts = {}) {
  const el = h('div', { class: 'dt-turn', role: 'status', 'aria-live': 'polite' }, h('i', { class: 'dt-turn-dot' }), h('span', null, text));
  el.set = (t, o = {}) => {
    el.lastChild.textContent = t;
    el.classList.toggle('is-mine', !!o.mine);
    el.hidden = !t;
  };
  el.set(text, opts);
  return el;
}

/** Animated number. Returns promise. */
export function countUp(el, to, { from = Number(el.dataset.val ?? 0), ms = 800, fmt = (v) => String(Math.round(v)) } = {}) {
  const token = (el._cu = (el._cu || 0) + 1);
  el.dataset.val = String(to);
  if (reduced() || from === to || !ms) { el.textContent = fmt(to); return Promise.resolve(); }
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (t) => {
      if (el._cu !== token || !el.isConnected) return res();
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

/** Score panel. rows [{ id, label, value, team(color), sub }]; el.update(rows) animates changed numbers. */
export function scorePanel({ title, rows = [], collapsible = false, collapsed = false, compact = false, lang } = {}) {
  const el = h('div', { class: `dt-panel dt-score${compact ? ' is-compact' : ''}` });
  const head = h('button', { class: 'dt-panel-head', type: 'button', 'aria-expanded': String(!collapsed) }, h('span', null, title || tx('score', lang)), collapsible ? h('i', { class: 'dt-caret' }) : null);
  const body = h('div', { class: 'dt-panel-body' });
  el.append(head, body);
  if (collapsible) head.addEventListener('click', () => { const c = el.classList.toggle('is-collapsed'); head.setAttribute('aria-expanded', String(!c)); });
  else head.disabled = true;
  if (collapsed) el.classList.add('is-collapsed');
  const map = new Map();
  el.update = (next) => {
    const ids = new Set(next.map((r) => r.id ?? r.label));
    for (const [id, r] of map) if (!ids.has(id)) { r.row.remove(); map.delete(id); }
    next.forEach((r) => {
      const id = r.id ?? r.label;
      let m = map.get(id);
      if (!m) {
        const val = h('span', { class: 'dt-score-val' });
        const lab = h('span', { class: 'dt-score-lab' });
        const sub = h('span', { class: 'dt-score-sub' });
        const row = h('div', { class: 'dt-score-row' }, h('i', { class: 'dt-score-dot' }), h('span', { class: 'dt-score-name' }, lab, sub), val);
        body.append(row);
        m = { row, val, lab, sub };
        map.set(id, m);
        val.textContent = String(r.value ?? '');
        val.dataset.val = String(r.value ?? 0);
      }
      m.lab.textContent = r.label;
      m.sub.textContent = r.sub || '';
      m.row.style.setProperty('--tc', r.team || 'var(--dc-gold)');
      m.row.classList.toggle('is-lead', !!r.lead);
      if (typeof r.value === 'number') countUp(m.val, r.value, { ms: 600 }); else m.val.textContent = String(r.value ?? '');
    });
    return el;
  };
  el.update(rows);
  return el;
}

/** Collapsible history log. el.add(text, { tone:'good'|'bad'|'info', round }) · el.clear() */
export function historyLog({ title, collapsed = true, max = 60, lang } = {}) {
  const el = h('div', { class: 'dt-panel dt-log' + (collapsed ? ' is-collapsed' : '') });
  const head = h('button', { class: 'dt-panel-head', type: 'button', 'aria-expanded': String(!collapsed) }, h('span', null, title || tx('history', lang)), h('i', { class: 'dt-caret' }));
  const body = h('div', { class: 'dt-panel-body dt-log-body', role: 'log' });
  el.append(head, body);
  head.addEventListener('click', () => { const c = el.classList.toggle('is-collapsed'); head.setAttribute('aria-expanded', String(!c)); body.scrollTop = body.scrollHeight; });
  el.add = (text, o = {}) => {
    body.append(h('div', { class: `dt-log-line${o.tone ? ' is-' + o.tone : ''}${o.round ? ' is-round' : ''}` }, text));
    while (body.children.length > max) body.firstChild.remove();
    body.scrollTop = body.scrollHeight;
  };
  el.clear = () => { body.textContent = ''; };
  return el;
}

/** Centre banner over `root` for ms. tone: 'gold'|'good'|'bad'. Resolves when hidden. */
export function banner(root, text, { sub = '', tone = 'gold', ms = 1500 } = {}) {
  const el = h('div', { class: `dt-banner is-${tone}`, role: 'status' }, h('b', null, text), sub ? h('span', null, sub) : null);
  root.append(el);
  return new Promise((res) => {
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); res(); }, reduced() ? 0 : 260); }, ms);
  });
}

/** Small toast at the bottom of `root`. */
export function toast(root, text, ms = 1600) {
  let el = root.querySelector(':scope > .dt-toast');
  if (!el) { el = h('div', { class: 'dt-toast', role: 'status', 'aria-live': 'polite' }); root.append(el); }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

/**
 * Coachmark bubble anchored to an element; tap to dismiss. opts { key, store (ctx.store) → show only once, side:'top'|'bottom' }
 * Returns { close } or null if already seen.
 */
export function coachmark(anchor, text, { root = anchor.closest('.game') || document.body, key, store, side = 'top', lang, onDismiss } = {}) {
  if (key && store && store.get('cm:' + key, false)) return null;
  const tip = h('button', { type: 'button', class: `dt-coach is-${side}` }, h('span', null, text), h('em', null, tx('gotIt', lang)));
  root.append(tip);
  const place = () => {
    const a = anchor.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(r.width - tip.offsetWidth - 8, a.left - r.left + a.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (side === 'top' ? a.top - r.top - tip.offsetHeight - 12 : a.bottom - r.top + 12) + 'px';
  };
  requestAnimationFrame(() => { place(); tip.classList.add('show'); });
  const close = () => { if (key && store) store.set('cm:' + key, true); tip.remove(); onDismiss && onDismiss(); };
  tip.addEventListener('click', close);
  return { close, place };
}

// ---------------------------------------------------------------- buttons
/**
 * Action bar. actions [{ id, label, kind:'primary'|'secondary'|'danger', disabled, reason, onClick, hidden, icon }]
 * el.set(id, patch) · el.setAll(actions) · el.btn(id)
 * Disabled buttons stay focusable (aria-disabled) and show `reason` in a tooltip bubble when tapped.
 */
export function actionBar(actions = [], { onDisabled } = {}) {
  const el = h('div', { class: 'dt-actions' });
  const defs = new Map();
  const btns = new Map();
  function paint(a) {
    const b = btns.get(a.id);
    b.className = `dc-btn is-${a.kind || 'secondary'}${a.disabled ? ' is-disabled' : ''}`;
    b.setAttribute('aria-disabled', a.disabled ? 'true' : 'false');
    b.hidden = !!a.hidden;
    b.textContent = '';
    if (a.icon) b.append(h('span', { class: 'dc-btn-ico', html: a.icon }));
    b.append(h('span', null, a.label));
    if (a.disabled && a.reason) b.title = a.reason; else b.removeAttribute('title');
  }
  function add(a) {
    defs.set(a.id, a);
    const b = h('button', { type: 'button' });
    b.addEventListener('click', (e) => {
      const cur = defs.get(a.id);
      if (cur.disabled) {
        if (cur.reason) { onDisabled ? onDisabled(cur.reason, b) : tip(b, cur.reason); }
        return;
      }
      cur.onClick && cur.onClick(e);
    });
    btns.set(a.id, b);
    el.append(b);
    paint(a);
  }
  function tip(b, text) {
    const t = h('div', { class: 'dt-tip', role: 'tooltip' }, text);
    el.append(t);
    const r = b.getBoundingClientRect();
    const rr = el.getBoundingClientRect();
    t.style.left = r.left - rr.left + r.width / 2 + 'px';
    setTimeout(() => t.remove(), 1800);
  }
  actions.forEach(add);
  el.set = (id, patch) => { const a = Object.assign(defs.get(id), patch); paint(a); return el; };
  el.setAll = (next) => { el.textContent = ''; defs.clear(); btns.clear(); next.forEach(add); return el; };
  el.btn = (id) => btns.get(id);
  return el;
}

// ---------------------------------------------------------------- modals
function openModal({ root = document.body, title, body, actions, dismissible = false, className = '', sticky = false, lang }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const close = (v) => {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => { overlay.remove(); prev && prev.focus && prev.focus(); }, reduced() ? 0 : 180);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape' && dismissible) { e.stopPropagation(); close(null); } };
    const acts = (actions && actions.length ? actions : [{ label: tx('ok', lang), value: true, primary: true }]).map((a) =>
      h('button', { type: 'button', class: `dc-btn ${a.primary ? 'is-primary' : a.danger ? 'is-danger' : 'is-secondary'}`, onclick: () => close(a.value) }, a.label));
    const box = h('div', { class: `dt-modal ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
      title ? h('h2', { class: 'dt-modal-title' }, title) : null,
      h('div', { class: 'dt-modal-body' }, typeof body === 'string' ? h('p', null, body) : body),
      h('div', { class: `dt-modal-actions${sticky ? ' is-sticky' : ''}` }, acts));
    const overlay = h('div', { class: `dt-overlay${root === document.body ? ' is-fixed' : ''}` }, box);
    if (dismissible) overlay.addEventListener('click', (e) => e.target === overlay && close(null));
    document.addEventListener('keydown', onKey, true);
    root.append(overlay);
    requestAnimationFrame(() => { overlay.classList.add('show'); (box.querySelector('.is-primary') || box.querySelector('button'))?.focus({ preventScroll: true }); });
    overlay._close = close;
  });
}
export { openModal as modal };

/** Rules/help modal. sections [{ title, text|body:Node, items:[string] }]. Sticky close button. */
export function rulesModal({ root = document.body, title, sections = [], closeLabel, lang } = {}) {
  const body = h('div', { class: 'dt-rules' }, sections.map((s) =>
    h('section', null, s.title ? h('h3', null, s.title) : null, s.text ? h('p', null, s.text) : null, s.body || null, s.items ? h('ul', null, s.items.map((i) => h('li', null, i))) : null)));
  return openModal({ root, title: title || tx('rules', lang), body, className: 'is-rules', sticky: true, dismissible: true, actions: [{ label: closeLabel || tx('close', lang), value: true, primary: true }], lang });
}

/**
 * Result modal. { root, outcome:'win'|'lose'|'draw', title, subtitle, stats:[{label, value:number|string, fmt}],
 *   actions:[{label, value, primary}], confetti:true }  → Promise(value of pressed action)
 */
export function resultModal({ root = document.body, outcome = 'win', title, subtitle, stats = [], actions, confetti = outcome === 'win', lang } = {}) {
  const icons = {
    win: '<svg viewBox="0 0 64 64"><path d="M14 14h36v10c0 10-8 18-18 18S14 34 14 24z" fill="#f3c24a"/><path d="M14 18H6c0 10 5 15 11 16M50 18h8c0 10-5 15-11 16" fill="none" stroke="#f3c24a" stroke-width="4"/><rect x="28" y="42" width="8" height="8" fill="#e0a827"/><rect x="20" y="50" width="24" height="6" rx="2" fill="#f3c24a"/></svg>',
    lose: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="none" stroke="#8e8675" stroke-width="4"/><path d="M22 42c4-6 16-6 20 0M23 26h4M37 26h4" stroke="#8e8675" stroke-width="4" stroke-linecap="round" fill="none"/></svg>',
    draw: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="none" stroke="#cfc8b6" stroke-width="4"/><path d="M20 26h24M20 38h24" stroke="#cfc8b6" stroke-width="4" stroke-linecap="round"/></svg>',
  };
  const statEls = stats.map((s) => {
    const v = h('b', { class: 'dt-res-val' }, typeof s.value === 'number' ? '0' : String(s.value));
    return { s, v, row: h('div', { class: 'dt-res-row' }, h('span', null, s.label), v) };
  });
  const body = h('div', { class: `dt-result is-${outcome}` },
    h('div', { class: 'dt-res-ico', html: icons[outcome] }),
    subtitle ? h('p', { class: 'dt-res-sub' }, subtitle) : null,
    statEls.length ? h('div', { class: 'dt-res-stats' }, statEls.map((x) => x.row)) : null);
  const p = openModal({ root, title: title || tx(outcome, lang), body, className: `is-result is-${outcome}`, actions, lang });
  setTimeout(() => statEls.forEach((x, i) => typeof x.s.value === 'number' && setTimeout(() => countUp(x.v, x.s.value, { ms: 900, fmt: x.s.fmt || ((v) => String(Math.round(v))) }), i * 120)), 250);
  if (confetti) setTimeout(() => burst(root), 250);
  return p;
}

/** Restrained confetti (gold / cream / rose), ~36 pieces. Skipped with reduced motion. */
export function burst(root = document.body, { count = 36, colors = ['#f3c24a', '#fff1b8', '#f6eedb', '#e08a9a', '#7fd1b0'] } = {}) {
  if (reduced()) return Promise.resolve();
  const layer = h('div', { class: 'dt-confetti' });
  root.append(layer);
  const W = root.clientWidth || innerWidth;
  const H = root.clientHeight || innerHeight;
  const anims = [];
  for (let i = 0; i < count; i++) {
    const p = h('i', { style: { background: colors[i % colors.length], left: Math.random() * 100 + '%', width: 5 + Math.random() * 5 + 'px', height: 8 + Math.random() * 8 + 'px' } });
    layer.append(p);
    const dx = (Math.random() - 0.5) * W * 0.5;
    anims.push(p.animate([{ transform: 'translate(0,-20px) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px, ${H * (0.6 + Math.random() * 0.5)}px) rotate(${(Math.random() - 0.5) * 900}deg)`, opacity: 0.9 }], { duration: 1600 + Math.random() * 1400, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' }).finished.catch(() => {}));
  }
  return Promise.all(anims).then(() => layer.remove());
}

// ---------------------------------------------------------------- chips & pot
export const CHIP_COLORS = { 1: ['#ececf0', '#2a2d38'], 5: ['#c9303c', '#fff'], 10: ['#2f6fd0', '#fff'], 25: ['#2a9d5c', '#fff'], 50: ['#e8832a', '#fff'], 100: ['#202126', '#f3c24a'], 500: ['#7a3fb5', '#fff'], 1000: ['#d9a82c', '#2a1d02'], 5000: ['#cfd3da', '#222'] };
export const DEFAULT_DENOMS = [1000, 500, 100, 50, 25, 10, 5, 1];

/** Greedy breakdown of an amount into chip counts: { 100: 2, 25: 1 } (pure). */
export function breakdownChips(amount, denoms = DEFAULT_DENOMS) {
  const out = {};
  let rest = Math.max(0, Math.floor(amount));
  for (const d of [...denoms].sort((a, b) => b - a)) {
    const n = Math.floor(rest / d);
    if (n) { out[d] = n; rest -= n * d; }
  }
  return out;
}

/** Single SVG casino-style chip. */
export function chipEl({ denom = 25, size = 36, label } = {}) {
  const [bg, fg] = CHIP_COLORS[denom] || CHIP_COLORS[1000];
  const txt = label ?? (denom >= 1000 ? denom / 1000 + 'K' : String(denom));
  const fs = String(txt).length > 3 ? 15 : String(txt).length > 2 ? 18 : 22;
  const dashes = Array.from({ length: 8 }, (_, i) => `<rect x="29" y="1" width="6" height="11" rx="1.5" fill="${fg}" fill-opacity=".92" transform="rotate(${i * 45} 32 32)"/>`).join('');
  return h('span', { class: 'dt-chipdisc', style: { width: size + 'px', height: size + 'px' }, html:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${bg}"/>${dashes}<circle cx="32" cy="32" r="21" fill="${bg}" stroke="${fg}" stroke-opacity=".75" stroke-width="1.6"/><circle cx="32" cy="32" r="31" fill="none" stroke="#000" stroke-opacity=".28"/><text x="32" y="${32 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${fg}" font-family="var(--dc-font)">${txt}</text></svg>` });
}

/** Stacks of chips for an amount (or explicit { denom: count }). opts { size, maxPerStack, maxStacks } */
export function chipStack({ amount = 0, chips, size = 28, maxPerStack = 7, maxStacks = 4, denoms } = {}) {
  const map = chips || breakdownChips(amount, denoms);
  const el = h('div', { class: 'dt-chipstack', style: { '--chs': size + 'px' }, 'aria-hidden': 'true' });
  const entries = Object.entries(map).sort((a, b) => b[0] - a[0]).slice(0, maxStacks);
  for (const [d, n] of entries) {
    const col = h('div', { class: 'dt-chipcol' });
    const shown = Math.min(n, maxPerStack);
    for (let i = 0; i < shown; i++) {
      const c = chipEl({ denom: +d, size });
      c.style.bottom = i * size * 0.16 + 'px';
      if (i === shown - 1) c.classList.add('is-top');
      col.append(c);
    }
    col.style.height = size + (shown - 1) * size * 0.16 + 'px';
    el.append(col);
  }
  return el;
}

/** Pot display: chip stacks + animated amount. el.set(amount) */
export function potDisplay({ amount = 0, label, size = 24, lang } = {}) {
  const el = h('div', { class: 'dt-pot' });
  const val = h('b', { class: 'dt-pot-val' }, String(amount));
  let stack = null;
  el.append(h('span', { class: 'dt-pot-lab' }, label || tx('pot', lang)), val);
  el.set = (n) => {
    if (stack) stack.remove();
    stack = n > 0 ? chipStack({ amount: n, size }) : null;
    if (stack) el.prepend(stack);
    countUp(val, n, { ms: 500 });
  };
  el.set(amount);
  return el;
}
