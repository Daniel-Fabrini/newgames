// Lifetime scopes (timers/listeners per view) and overlay sheets living inside the game root.
import { h } from '../../js/core/ui.js';

export function makeScope() {
  const timers = new Set();
  const intervals = new Set();
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
    /** resolves after ms; never resolves once the scope is disposed (stops async flows quietly) */
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
    on(target, ev, fn, opts) {
      target.addEventListener(ev, fn, opts);
      offs.push(() => target.removeEventListener(ev, fn, opts));
    },
    dispose() {
      dead = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      offs.forEach((f) => f());
      timers.clear();
      intervals.clear();
    },
  };
}

export function createSheets(layer) {
  const stack = [];
  function open({ title = '', body = null, actions = [], dismissible = true, cls = '' } = {}) {
    let resolve;
    const done = new Promise((r) => (resolve = r));
    let closed = false;
    const entry = { dismissible, close: (v) => close(v) };
    const box = h(
      'div',
      { class: `tc-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || undefined },
      title ? h('h2', { class: 'tc-sheet-title' }, title) : null,
      body,
      actions.length
        ? h(
            'div',
            { class: 'tc-sheet-actions' },
            actions.map((a) => h('button', { class: `tc-btn ${a.primary ? 'red' : a.gold ? 'gold' : 'dark'}`, onclick: () => close(a.value) }, a.label)),
          )
        : null,
    );
    const overlay = h('div', { class: 'tc-overlay' }, box);
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
    return { el: box, close, done };
  }
  return {
    open,
    get count() {
      return stack.length;
    },
    back() {
      const top = stack[stack.length - 1];
      if (!top) return false;
      if (top.dismissible) top.close(null);
      return true;
    },
    closeAll() {
      [...stack].forEach((s) => s.close(null));
    },
  };
}
