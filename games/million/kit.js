// Shared UI pieces: lifetime scopes, in-game sheets, the TV studio stage.

import { h } from '../../js/core/ui.js';
import { hostSVG } from './art.js';

// A scope owns timers, intervals, rAFs and listeners of one view; dispose()
// cancels them all. wait() never resolves after dispose, which quietly stops
// any async flow that was running in the view.
export function makeScope() {
  const timers = new Set();
  const intervals = new Set();
  const rafs = new Set();
  const offs = [];
  let dead = false;
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  return {
    get dead() {
      return dead;
    },
    later,
    cancel(id) {
      clearTimeout(id);
      timers.delete(id);
    },
    wait: (ms) => new Promise((res) => later(res, ms)),
    every(fn, ms) {
      const id = setInterval(() => !dead && fn(), ms);
      intervals.add(id);
      return id;
    },
    stopEvery(id) {
      clearInterval(id);
      intervals.delete(id);
    },
    raf(fn) {
      const id = requestAnimationFrame((ts) => {
        rafs.delete(id);
        if (!dead) fn(ts);
      });
      rafs.add(id);
      return id;
    },
    on(target, ev, fn, opts) {
      target.addEventListener(ev, fn, opts);
      offs.push(() => target.removeEventListener(ev, fn, opts));
    },
    dispose() {
      dead = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      rafs.forEach(cancelAnimationFrame);
      offs.forEach((f) => f());
      timers.clear();
      intervals.clear();
      rafs.clear();
    },
  };
}

// Bottom-sheet / centered dialog living inside the game root.
// Returns { el, close(value), done: Promise }.
export function createSheets(layer) {
  const stack = [];
  function open({ title = '', sub = '', body = null, actions = [], dismissible = true, cls = '', icon = '' } = {}) {
    let resolve;
    const done = new Promise((r) => (resolve = r));
    const box = h(
      'div',
      { class: `g-million-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true' },
      icon ? h('div', { class: 'g-million-sheet-ico', html: icon }) : null,
      title ? h('h2', { class: 'g-million-sheet-title' }, title) : null,
      sub ? h('p', { class: 'g-million-sheet-sub' }, sub) : null,
      body,
      actions.length
        ? h(
            'div',
            { class: 'g-million-sheet-actions' },
            actions.map((a) => h('button', { class: `btn ${a.primary ? 'primary' : a.danger ? 'danger' : ''} ${a.cls || ''}`, onclick: () => close(a.value) }, a.label)),
          )
        : null,
    );
    const overlay = h('div', { class: 'g-million-overlay' }, box);
    const entry = { close: (v) => close(v), dismissible };
    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 220);
      resolve(value);
    }
    if (dismissible) overlay.addEventListener('click', (e) => e.target === overlay && close(null));
    layer.append(overlay);
    stack.push(entry);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
    // Keyboard: Enter/Space activate the focused primary action.
    const primary = box.querySelector('.g-million-sheet-actions .btn.primary');
    if (primary) setTimeout(() => !closed && primary.focus({ preventScroll: true }), 60);
    return { el: box, close, done };
  }
  return {
    open,
    get count() {
      return stack.length;
    },
    // Back button: closes the top dismissible sheet. Returns true if a sheet is open.
    back() {
      const top = stack[stack.length - 1];
      if (!top) return false;
      if (top.dismissible) top.close(null);
      return true;
    },
    closeAll() {
      stack.slice().forEach((s) => s.close(null));
    },
  };
}

// The TV studio: back wall with LED dots, a screen, sweeping spotlights, the
// host with a speech bubble and the audience.
export function makeStage(scope, { outfit, variant = 'game', mood = 'happy', hostName = '' } = {}) {
  const host = h('div', { class: 'g-million-host', html: hostSVG(outfit, mood) });
  const svg = host.firstElementChild;
  const text = h('p', { class: 'g-million-bubble-text' });
  const bubble = h('div', { class: 'g-million-bubble' }, h('b', null, hostName), text);
  const screen = h('div', { class: 'g-million-screen' });
  const crowd = h('div', { class: 'g-million-crowd' }, h('i', { class: 'r1' }), h('i', { class: 'r2' }));
  const el = h(
    'div',
    { class: `g-million-stage v-${variant}` },
    h('div', { class: 'g-million-wall' }),
    h('div', { class: 'g-million-arch' }),
    screen,
    h('i', { class: 'g-million-beam b1' }),
    h('i', { class: 'g-million-beam b2' }),
    h('i', { class: 'g-million-beam b3' }),
    h('i', { class: 'g-million-beam b4' }),
    h('div', { class: 'g-million-floor' }),
    crowd,
    host,
    bubble,
  );
  let talkT = 0;
  const api = {
    el,
    say(msg, mood) {
      if (mood) api.mood(mood);
      text.textContent = msg;
      bubble.classList.remove('pop');
      void bubble.offsetWidth;
      bubble.classList.add('pop', 'on');
      svg.classList.add('talking');
      if (talkT) scope.cancel(talkT);
      talkT = scope.later(() => svg.classList.remove('talking'), Math.min(2600, 380 + msg.length * 38));
    },
    mood(m) {
      svg.classList.remove('mood-happy', 'mood-tense', 'mood-sad');
      svg.classList.add(`mood-${m}`);
    },
    cheer(big = false) {
      crowd.classList.remove('cheer', 'big');
      void crowd.offsetWidth;
      crowd.classList.add('cheer');
      if (big) crowd.classList.add('big');
    },
    flash(kind) {
      el.classList.remove('flash-good', 'flash-bad', 'flash-gold');
      void el.offsetWidth;
      el.classList.add(`flash-${kind}`);
    },
    screen(top, big, cls = '') {
      screen.className = `g-million-screen ${cls}`;
      screen.replaceChildren(h('small', null, top), h('b', null, big));
    },
    outfit(id) {
      host.innerHTML = hostSVG(id, 'happy');
    },
  };
  return api;
}

// A university student avatar (three variations).
export function studentSVG(i) {
  const v = [
    { skin: '#f1c7a1', hair: '#3a2416', shirt: '#4d96ff', long: false },
    { skin: '#c98d64', hair: '#151010', shirt: '#ff6fb1', long: true },
    { skin: '#8d5a3b', hair: '#0e0b09', shirt: '#2fd27a', long: false },
  ][i % 3];
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 64c1-12 10-18 22-18s21 6 22 18Z" fill="${v.shirt}"/>
    ${v.long ? `<path d="M15 34c-2-14 6-22 17-22s19 8 17 22l-2 10H17Z" fill="${v.hair}"/>` : ''}
    <ellipse cx="32" cy="32" rx="13" ry="14.5" fill="${v.skin}"/>
    <path d="M19 30c0-9 6-14 13-14s13 5 13 14c-3-5-8-7-13-7s-10 2-13 7Z" fill="${v.hair}"/>
    <circle cx="27" cy="33" r="1.8" fill="#1b1210"/><circle cx="37" cy="33" r="1.8" fill="#1b1210"/>
    <path d="M27 39q5 4 10 0" fill="none" stroke="#7a2b20" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 4 10 13l22 9 22-9Z" fill="#141418" stroke="#f3c24a" stroke-width="1.2"/>
    <path d="M18 16v6c4 3 10 4 14 4s10-1 14-4v-6l-14 6Z" fill="#202027"/>
    <path d="M52 13v10" stroke="#f3c24a" stroke-width="1.6"/><circle cx="52" cy="24" r="2.2" fill="#f3c24a"/>
  </svg>`;
}
