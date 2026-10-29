// Player hand (fan/line, auto-fit, selection, keyboard, drag-reorder) + opponent hand.
//
//   const hand = createHand(containerEl, {
//     cards, size:'md'|px, mode:'fan'|'line', arc:true, select:'single'|'multi'|'none',
//     canSelect:(card)=>true, isPlayable:(card)=>true (false → dimmed, not selectable),
//     onChange:(selectedCards)=>{}, onActivate:(card, el)=>{}, onReorder:(cards)=>{},
//     draggable:false, dragToPlay:false, faceDown:false, back, deck, lang, maxRows:1, minStep:0.28, uno:false,
//   });
//   hand.setCards(cards, { animate }) · hand.getCards() · hand.add(card) · hand.remove(id) → el
//   hand.selected() → cards · hand.select(id) / deselect(id) / clearSelection()
//   hand.setPlayable(fn) · hand.sort(opts|fn) · hand.cardEl(id) · hand.layout() · hand.focus() · hand.destroy()
import { anyCardEl, cardSizePx, setCardState, setFaceDown } from './card.js';
import { sortAuto, cardName, getCardLang } from './decks.js';

/**
 * Pure layout maths (unit-tested). Returns positions for n cards of width cw in a container of width W.
 * { step, rows, positions:[{x,y,rot}], width, height }
 */
export function computeLayout({ n, W, cw, mode = 'fan', arc = true, maxRows = 1, minStep = 0.28, maxStep = 0.72, rowGap = 0.78, pad = 0 }) {
  const ch = cw * 1.4;
  if (n <= 0) return { step: 0, rows: 1, positions: [], width: 0, height: ch };
  const avail = Math.max(cw, W - pad * 2);
  const stepFor = (count) => (count <= 1 ? 0 : (avail - cw) / (count - 1));
  let rows = 1;
  while (rows < maxRows && stepFor(Math.ceil(n / rows)) < cw * minStep) rows++;
  const perRow = Math.ceil(n / rows);
  const step = Math.min(cw * maxStep, Math.max(stepFor(perRow), 0));
  const positions = [];
  const useArc = arc && mode === 'fan' && rows === 1 && n >= 3;
  const maxAng = Math.min(16, 2.2 * n);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const idx = i - row * perRow;
    const inRow = row === rows - 1 ? n - row * perRow : perRow;
    const rowW = cw + step * (inRow - 1);
    const x0 = pad + Math.max(0, (avail - rowW) / 2);
    let x = x0 + idx * step;
    let y = row * ch * rowGap * 0.72;
    let rot = 0;
    if (useArc) {
      const t = n === 1 ? 0 : (idx / (n - 1)) * 2 - 1; // -1..1
      rot = t * (maxAng / 2);
      y += t * t * cw * 0.1;
    }
    positions.push({ x, y, rot });
  }
  const height = ch + (rows - 1) * ch * rowGap * 0.72 + (useArc ? cw * 0.1 : 0);
  return { step, rows, positions, width: avail, height };
}

const LABELS = {
  pt: { hand: 'Sua mão', selected: 'selecionada', disabled: 'indisponível' },
  en: { hand: 'Your hand', selected: 'selected', disabled: 'not playable' },
  es: { hand: 'Tu mano', selected: 'seleccionada', disabled: 'no jugable' },
};

export function createHand(container, opts = {}) {
  const o = { mode: 'fan', arc: true, select: 'single', size: undefined, maxRows: 1, minStep: 0.28, ...opts };
  const lang = () => o.lang || getCardLang();
  let cards = (o.cards || []).slice();
  const slots = new Map(); // id → slot el
  const selectedIds = new Set();
  let playable = o.isPlayable || null;
  let focusId = null;
  let destroyed = false;
  let ro = null;
  let lastW = 0;

  const root = document.createElement('div');
  root.className = 'dh' + (o.draggable || o.dragToPlay ? ' is-draggable' : '');
  root.setAttribute('role', 'listbox');
  root.setAttribute('aria-label', (LABELS[lang()] || LABELS.en).hand);
  if (o.select === 'multi') root.setAttribute('aria-multiselectable', 'true');
  const stage = document.createElement('div');
  stage.className = 'dh-stage';
  root.append(stage);
  container.append(root);
  if (o.size !== undefined) root.style.setProperty('--cw', cardSizePx(o.size) + 'px');

  const cw = () => parseFloat(getComputedStyle(root).getPropertyValue('--cw')) || cardSizePx(o.size);
  const isOk = (c) => !playable || playable(c) !== false;

  function makeSlot(card) {
    const slot = document.createElement('div');
    slot.className = 'dh-slot';
    slot.dataset.id = card.id;
    slot.setAttribute('role', 'option');
    slot.tabIndex = -1;
    const el = anyCardEl(card, { faceDown: o.faceDown, back: o.back, deck: o.deck, lang: o.lang });
    el.removeAttribute('role');
    slot.append(el);
    slot._card = card;
    slot._el = el;
    slots.set(card.id, slot);
    stage.append(slot);
    return slot;
  }

  function refreshStates() {
    const L = LABELS[lang()] || LABELS.en;
    for (const c of cards) {
      const slot = slots.get(c.id);
      if (!slot) continue;
      const ok = isOk(c);
      const sel = selectedIds.has(c.id);
      slot.classList.toggle('is-off', !ok);
      setCardState(slot._el, { disabled: !ok, selected: sel });
      slot.setAttribute('aria-selected', sel ? 'true' : 'false');
      if (!ok) slot.setAttribute('aria-disabled', 'true');
      else slot.removeAttribute('aria-disabled');
      const base = cardName(c, lang());
      slot.setAttribute('aria-label', base + (sel ? `, ${L.selected}` : !ok ? `, ${L.disabled}` : ''));
    }
  }

  function layout() {
    if (destroyed) return;
    const W = root.clientWidth || container.clientWidth || 320;
    lastW = W;
    const w = cw();
    const sinMax = Math.sin((Math.min(16, 2.2 * cards.length) / 2) * (Math.PI / 180));
    const pad = o.arc && o.mode === 'fan' && cards.length >= 3 ? w * 1.4 * sinMax + 2 : 2;
    const L = computeLayout({ n: cards.length, W, cw: w, mode: o.mode, arc: o.arc, maxRows: o.maxRows, minStep: o.minStep, pad });
    const lift = w * 0.34;
    stage.style.height = L.height + lift + 'px';
    stage.style.width = W + 'px';
    cards.forEach((c, i) => {
      const slot = slots.get(c.id);
      const p = L.positions[i];
      slot.style.zIndex = String(i + 1);
      slot.style.transformOrigin = '50% 100%';
      slot.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y + lift).toFixed(1)}px) rotate(${p.rot.toFixed(2)}deg)`;
      slot._rot = p.rot;
    });
    root._layout = L;
  }

  function sync(animate = true) {
    const ids = new Set(cards.map((c) => c.id));
    for (const [id, slot] of slots) {
      if (!ids.has(id)) {
        slot.remove();
        slots.delete(id);
        selectedIds.delete(id);
      }
    }
    for (const c of cards) if (!slots.has(c.id)) makeSlot(c);
    // keep DOM order = card order (tab order)
    for (const c of cards) stage.append(slots.get(c.id));
    if (!animate) root.classList.add('is-instant');
    refreshStates();
    layout();
    updateTabindex();
    if (!animate) requestAnimationFrame(() => root.classList.remove('is-instant'));
  }

  function updateTabindex() {
    if (!cards.length) return;
    if (!focusId || !slots.has(focusId)) focusId = (cards.find((c) => isOk(c)) || cards[0]).id;
    for (const [id, slot] of slots) slot.tabIndex = id === focusId ? 0 : -1;
  }

  const emitChange = () => o.onChange && o.onChange(api.selected());

  function toggle(card, forceState) {
    if (!isOk(card) || (o.canSelect && o.canSelect(card) === false)) return false;
    const was = selectedIds.has(card.id);
    const want = forceState === undefined ? !was : forceState;
    if (want === was) return was;
    if (want) {
      if (o.select === 'single') selectedIds.clear();
      selectedIds.add(card.id);
    } else selectedIds.delete(card.id);
    refreshStates();
    emitChange();
    return want;
  }

  function activate(card) {
    if (!isOk(card)) return;
    const slot = slots.get(card.id);
    o.onActivate && o.onActivate(card, slot && slot._el);
  }

  function clickCard(card) {
    focusId = card.id;
    updateTabindex();
    if (!isOk(card)) {
      o.onDisabledTap && o.onDisabledTap(card);
      return;
    }
    if (o.select === 'none') return activate(card);
    if (o.select === 'single' && selectedIds.has(card.id)) return activate(card);
    toggle(card);
  }

  // ----- pointer handling (click + drag) -----
  let drag = null;
  function onPointerDown(e) {
    const slot = e.target.closest('.dh-slot');
    if (!slot || e.button > 0) return;
    drag = { slot, id: slot.dataset.id, x0: e.clientX, y0: e.clientY, moved: false, pid: e.pointerId, base: slot.style.transform };
    if (o.draggable || o.dragToPlay) {
      try { root.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!(o.draggable || o.dragToPlay)) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 10) {
      drag.moved = true;
      drag.slot.classList.add('is-drag');
      const sel = selectedIds.has(drag.id);
      drag.wasSel = sel;
    }
    if (drag.moved) {
      drag.slot.style.transform = `${drag.base} translate(${dx}px, ${dy}px)`;
      if (o.draggable) {
        const rect = stage.getBoundingClientRect();
        const w = cw();
        const L = root._layout;
        const rel = e.clientX - rect.left - w / 2;
        let idx = L.step > 0 ? Math.round((rel - (L.positions[0]?.x || 0)) / L.step) : 0;
        idx = Math.max(0, Math.min(cards.length - 1, idx));
        const from = cards.findIndex((c) => c.id === drag.id);
        if (idx !== from && Math.abs(dy) < w * 1.2) {
          const [c] = cards.splice(from, 1);
          cards.splice(idx, 0, c);
          reflowWhileDragging();
        }
      }
    }
  }
  function reflowWhileDragging() {
    // re-layout every slot except the dragged one (it follows the pointer)
    const dragging = drag && drag.slot;
    const w = cw();
    const sinMax = Math.sin((Math.min(16, 2.2 * cards.length) / 2) * (Math.PI / 180));
    const pad = o.arc && o.mode === 'fan' && cards.length >= 3 ? w * 1.4 * sinMax + 2 : 2;
    const L = computeLayout({ n: cards.length, W: lastW, cw: w, mode: o.mode, arc: o.arc, maxRows: o.maxRows, minStep: o.minStep, pad });
    const lift = w * 0.34;
    root._layout = L;
    cards.forEach((c, i) => {
      const slot = slots.get(c.id);
      const p = L.positions[i];
      slot.style.zIndex = String(i + 1);
      const t = `translate(${p.x.toFixed(1)}px, ${(p.y + lift).toFixed(1)}px) rotate(${p.rot.toFixed(2)}deg)`;
      if (slot === dragging) drag.base = t;
      else slot.style.transform = t;
    });
  }
  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    try { root.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const card = cards.find((c) => c.id === d.id);
    if (!card) return;
    if (d.moved) {
      d.slot.classList.remove('is-drag');
      const dy = e.clientY - d.y0;
      if (o.dragToPlay && dy < -cw() * 1.1 && isOk(card)) {
        layout();
        activate(card);
        return;
      }
      layout();
      if (o.draggable && o.onReorder) o.onReorder(cards.slice());
      return;
    }
    clickCard(card);
  }
  function onPointerCancel() {
    if (!drag) return;
    drag.slot.classList.remove('is-drag');
    drag = null;
    layout();
  }
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerCancel);
  root.addEventListener('dblclick', (e) => {
    const slot = e.target.closest('.dh-slot');
    if (slot && o.select === 'multi') {
      const c = cards.find((x) => x.id === slot.dataset.id);
      if (c) activate(c);
    }
  });

  // ----- keyboard -----
  root.addEventListener('keydown', (e) => {
    const slot = e.target.closest('.dh-slot');
    if (!slot) return;
    const i = cards.findIndex((c) => c.id === slot.dataset.id);
    const move = (to) => {
      to = Math.max(0, Math.min(cards.length - 1, to));
      focusId = cards[to].id;
      updateTabindex();
      slots.get(focusId).focus();
      e.preventDefault();
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(cards.length - 1);
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.shiftKey && o.draggable) { /* reserved */ }
    else if (e.key === ' ') {
      e.preventDefault();
      if (o.select === 'none') activate(cards[i]);
      else if (!isOk(cards[i])) o.onDisabledTap && o.onDisabledTap(cards[i]);
      else toggle(cards[i]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = cards[i];
      if (!isOk(c)) return o.onDisabledTap && o.onDisabledTap(c);
      if (o.select === 'none' || (o.select === 'single' && selectedIds.has(c.id)) || o.select === 'multi') activate(c);
      else toggle(c, true);
    } else if (e.key === 'Escape') api.clearSelection();
  });
  root.addEventListener('focusin', (e) => {
    const slot = e.target.closest && e.target.closest('.dh-slot');
    if (slot) {
      focusId = slot.dataset.id;
      updateTabindex();
    }
  });

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      if (root.clientWidth !== lastW) layout();
    });
    ro.observe(root);
  }

  const api = {
    el: root,
    setCards(next, { animate = true } = {}) {
      cards = next.slice();
      sync(animate);
      return api;
    },
    getCards: () => cards.slice(),
    add(card, index = cards.length) {
      cards.splice(index, 0, card);
      sync(true);
      return slots.get(card.id)._el;
    },
    remove(id) {
      const slot = slots.get(id);
      const el = slot && slot._el;
      cards = cards.filter((c) => c.id !== id);
      // detach element for fly animations: caller may use rect before removal
      sync(true);
      return el;
    },
    selected: () => cards.filter((c) => selectedIds.has(c.id)),
    select: (id) => {
      const c = cards.find((x) => x.id === id);
      return c ? toggle(c, true) : false;
    },
    deselect: (id) => {
      const c = cards.find((x) => x.id === id);
      if (c) toggle(c, false);
    },
    clearSelection() {
      if (!selectedIds.size) return;
      selectedIds.clear();
      refreshStates();
      emitChange();
    },
    setPlayable(fn) {
      playable = fn;
      for (const id of [...selectedIds]) {
        const c = cards.find((x) => x.id === id);
        if (c && !isOk(c)) selectedIds.delete(id);
      }
      refreshStates();
      updateTabindex();
    },
    setFaceDown(down) {
      o.faceDown = down;
      for (const s of slots.values()) setFaceDown(s._el, down);
      refreshStates();
    },
    sort(by) {
      cards = typeof by === 'function' ? cards.slice().sort(by) : sortAuto(cards, by || {});
      sync(true);
      o.onReorder && o.onReorder(cards.slice());
    },
    cardEl: (id) => (slots.get(id) ? slots.get(id)._el : null),
    slotEl: (id) => slots.get(id) || null,
    rectOf: (id) => (slots.get(id) ? slots.get(id)._el.getBoundingClientRect() : null),
    layout,
    focus() {
      const s = slots.get(focusId);
      if (s) s.focus();
    },
    setSize(size) {
      o.size = size;
      root.style.setProperty('--cw', cardSizePx(size) + 'px');
      layout();
    },
    destroy() {
      destroyed = true;
      if (ro) ro.disconnect();
      root.remove();
      slots.clear();
    },
  };
  sync(false);
  return api;
}

/** Button helper: a "sort" button that cycles suit/rank order on a hand. Returns the <button>. */
export function sortButton(hand, { label = 'Sort', sortOpts = [{ by: 'suit' }, { by: 'rank' }], className = 'dc-btn' } = {}) {
  let i = 0;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', () => {
    hand.sort(sortOpts[i % sortOpts.length]);
    i++;
  });
  return b;
}

/**
 * Face-down opponent hand. orientation: 'top'|'bottom' (horizontal fan) or 'left'|'right' (vertical stack,
 * cards rotated 90°). maxSpan = px available along the main axis (default 220).
 *   const opp = createOpponentHand(el, { count: 7, size: 'xs', orientation: 'left', maxSpan: 200 });
 *   opp.setCount(6)
 */
export function createOpponentHand(container, opts = {}) {
  const o = { count: 0, size: 'xs', orientation: 'top', maxSpan: 220, badge: true, back: undefined, ...opts };
  const root = document.createElement('div');
  root.className = 'doh';
  const w = cardSizePx(o.size);
  root.style.setProperty('--cw', w + 'px');
  const stage = document.createElement('div');
  stage.className = 'doh-stage';
  const badge = document.createElement('div');
  badge.className = 'doh-badge';
  root.append(stage);
  if (o.badge) root.append(badge);
  container.append(root);
  const els = [];

  function layout() {
    const n = o.count;
    const vertical = o.orientation === 'left' || o.orientation === 'right';
    const ch = w * 1.4;
    const along = vertical ? ch : w; // size of card along the main axis after rotation
    const cross = vertical ? w : ch;
    const step = n <= 1 ? 0 : Math.min(along * 0.42, (o.maxSpan - along) / (n - 1));
    const span = along + step * Math.max(0, n - 1);
    root.style.width = (vertical ? cross : span) + 'px';
    root.style.height = (vertical ? span : cross) + 'px';
    stage.style.width = root.style.width;
    stage.style.height = root.style.height;
    els.forEach((el, i) => {
      const slot = el.parentNode;
      if (vertical) {
        // rotate 90° about card centre, then place
        const dx = (cross - w) / 2 - 0;
        slot.style.transform = `translate(${cross / 2 - w / 2}px, ${i * step + (along - ch) / 2}px) rotate(${o.orientation === 'left' ? 90 : -90}deg)`;
      } else {
        slot.style.transform = `translate(${i * step}px, 0) rotate(${o.orientation === 'bottom' ? 180 : 0}deg)`;
      }
      slot.style.zIndex = String(i + 1);
    });
    badge.textContent = String(n);
  }

  function setCount(n) {
    o.count = n;
    while (els.length < n) {
      const slot = document.createElement('div');
      slot.className = 'doh-slot';
      const el = anyCardEl(null, { back: o.back, size: undefined });
      el.removeAttribute('role');
      slot.append(el);
      stage.append(slot);
      els.push(el);
    }
    while (els.length > n) els.pop().parentNode.remove();
    layout();
  }
  setCount(o.count);
  return {
    el: root,
    setCount,
    get count() {
      return o.count;
    },
    /** Element of the i-th card (default last) — useful as a fly origin when it plays/draws. */
    cardEl: (i = els.length - 1) => els[i] || null,
    rect: () => root.getBoundingClientRect(),
    destroy: () => root.remove(),
  };
}
