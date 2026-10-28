// Interactive letter grid: gold frame + cream paper, swipe selection with a
// rounded capsule that follows the finger and snaps to the 8 directions,
// locked capsules for found words, hint effects (pulsing letter, spotlight)
// and a little tutorial demo. Also supports tap-first / tap-last selection.

export const CAP_COLORS = [
  '#f3c24a',
  '#5bc0eb',
  '#5fd38d',
  '#ff8a6b',
  '#b58cff',
  '#ff8fc7',
  '#35d0c0',
  '#ffad4d',
  '#9fd45a',
  '#7d9bff',
  '#ff7096',
  '#4fd8ee',
  '#e7c84a',
];

const SQ = Math.SQRT2;

export function createBoard({ h, size, grid, sfx, onCommit, onStart }) {
  const frame = h('div', { class: 'g-wordsearch-board' });
  const paper = h('div', { class: 'g-wordsearch-paper', 'data-silent': '' });
  const caps = h('div', { class: 'g-wordsearch-caps' });
  const letters = h('div', { class: 'g-wordsearch-letters', style: { gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` } });
  const fx = h('div', { class: 'g-wordsearch-fx' });
  const cells = grid.map((ch, i) => h('span', { class: 'g-wordsearch-cell', 'data-i': i }, ch));
  letters.append(...cells);
  paper.append(caps, letters, fx);
  frame.append(paper);

  let cs = 30; // cell size in px
  let enabled = true;
  let drag = null; // { r, c, k, n, cap, pointerId, moved }
  let armed = null; // tap-tap selection: { r, c, cap }
  let lastAngle = 0;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  function setSize(px) {
    const pad = Math.max(6, Math.round(px * 0.018));
    const inner = px - pad * 2;
    cs = inner / size;
    frame.style.width = frame.style.height = `${px}px`;
    frame.style.padding = `${pad}px`;
    paper.style.setProperty('--cs', `${cs}px`);
    paper.style.fontSize = `${Math.max(12, cs * 0.54)}px`;
  }

  function capEl(r, c, dr, dc, n, cls = '') {
    const el = h('div', { class: `g-wordsearch-cap ${cls}` });
    placeCap(el, r, c, dr, dc, n);
    return el;
  }

  // Continuous angle so CSS transitions never spin the long way round.
  function contAngle(target, prev) {
    let a = target;
    while (a - prev > 180) a -= 360;
    while (a - prev < -180) a += 360;
    return a;
  }

  function placeCap(el, r, c, dr, dc, n, prevAngle) {
    const len = n * (dr && dc ? SQ : 1);
    let ang = n ? (Math.atan2(dr, dc) * 180) / Math.PI : prevAngle ?? 0;
    if (prevAngle !== undefined) ang = contAngle(ang, prevAngle);
    el.style.setProperty('--r0', r);
    el.style.setProperty('--c0', c);
    el.style.setProperty('--d', len);
    el.style.setProperty('--a', ang);
    return ang;
  }

  function cellsOf(r, c, dr, dc, n) {
    const out = [];
    for (let i = 0; i <= n; i++) out.push((r + dr * i) * size + (c + dc * i));
    return out;
  }

  let selCells = [];
  function markSel(list) {
    for (const i of selCells) cells[i].classList.remove('sel');
    selCells = list;
    for (const i of selCells) cells[i].classList.add('sel');
  }

  function pointToCell(e) {
    const rect = paper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, r: Math.floor(y / cs), c: Math.floor(x / cs) };
  }

  // Snap the drag vector to one of 8 directions, with a little hysteresis.
  function snap(start, x, y, prevK) {
    const dx = (x - (start.c + 0.5) * cs) / cs;
    const dy = (y - (start.r + 0.5) * cs) / cs;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.45) return { k: prevK, dr: 0, dc: 0, n: 0 };
    const ang = Math.atan2(dy, dx);
    let k = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    if (prevK !== null && prevK !== undefined) {
      let diff = Math.abs(ang - (prevK * Math.PI) / 4);
      diff = Math.min(diff, Math.PI * 2 - diff);
      if (diff < (Math.PI / 8) * 1.35) k = prevK;
    }
    const dc = Math.round(Math.cos((k * Math.PI) / 4));
    const dr = Math.round(Math.sin((k * Math.PI) / 4));
    const step = dr && dc ? SQ : 1;
    const proj = (dx * dc + dy * dr) / step;
    let n = Math.max(0, Math.round(proj / step));
    // stay inside the grid
    const lim = (p, d) => (d > 0 ? size - 1 - p : d < 0 ? p : Infinity);
    n = Math.min(n, lim(start.r, dr), lim(start.c, dc));
    return { k, dr, dc, n };
  }

  function tick(n) {
    sfx.tone({ freq: 420 + Math.min(n, 12) * 55, dur: 0.035, type: 'triangle', vol: 0.12 });
    sfx.vibrate(4);
  }

  function onDown(e) {
    if (!enabled || drag) return;
    if (e.button !== undefined && e.button > 0) return;
    const p = pointToCell(e);
    if (p.r < 0 || p.c < 0 || p.r >= size || p.c >= size) return;
    e.preventDefault();
    onStart && onStart();
    // second tap of a tap-tap selection
    if (armed) {
      const dr = p.r - armed.r;
      const dc = p.c - armed.c;
      const aligned = (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) && (dr || dc);
      if (aligned) {
        const n = Math.max(Math.abs(dr), Math.abs(dc));
        const cap = armed.cap;
        armed = null;
        cap.classList.remove('armed');
        lastAngle = placeCap(cap, cap._r, cap._c, Math.sign(dr), Math.sign(dc), n, lastAngle);
        markSel(cellsOf(cap._r, cap._c, Math.sign(dr), Math.sign(dc), n));
        tick(n);
        later(() => finish(cap, cap._r, cap._c, Math.sign(dr), Math.sign(dc), n), 90);
        return;
      }
      const same = p.r === armed.r && p.c === armed.c;
      disarm();
      if (same) return;
    }
    const cap = capEl(p.r, p.c, 0, 0, 0, 'live');
    cap._r = p.r;
    cap._c = p.c;
    cap.style.setProperty('--col', CAP_COLORS[colorIdx % CAP_COLORS.length]);
    caps.append(cap);
    lastAngle = 0;
    drag = { r: p.r, c: p.c, k: null, n: 0, dr: 0, dc: 0, cap, id: e.pointerId, moved: false };
    try {
      paper.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    markSel([p.r * size + p.c]);
    tick(0);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const p = pointToCell(e);
    const s = snap(drag, p.x, p.y, drag.k);
    if (s.n > 0) drag.moved = true;
    if (s.n === drag.n && s.dr === drag.dr && s.dc === drag.dc) return;
    drag.k = s.n ? s.k : drag.k;
    drag.n = s.n;
    drag.dr = s.dr;
    drag.dc = s.dc;
    lastAngle = placeCap(drag.cap, drag.r, drag.c, s.dr, s.dc, s.n, lastAngle);
    markSel(cellsOf(drag.r, drag.c, s.dr, s.dc, s.n));
    tick(s.n);
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    try {
      paper.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (e.type === 'pointercancel') {
      d.cap.remove();
      markSel([]);
      return;
    }
    if (d.n === 0) {
      if (d.moved) {
        d.cap.remove();
        markSel([]);
        return;
      }
      // a plain tap arms the cell: tap another aligned cell to select
      d.cap.classList.add('armed');
      armed = { r: d.r, c: d.c, cap: d.cap };
      return;
    }
    finish(d.cap, d.r, d.c, d.dr, d.dc, d.n);
  }

  function disarm() {
    if (!armed) return;
    armed.cap.remove();
    armed = null;
    markSel([]);
  }

  function finish(cap, r, c, dr, dc, n) {
    const res = onCommit({ r, c, dr, dc, len: n + 1 }) || { type: 'miss' };
    markSel([]);
    cap.classList.remove('live');
    if (res.type === 'found') {
      cap.style.setProperty('--col', CAP_COLORS[res.color % CAP_COLORS.length]);
      cap.classList.add('found', 'lock');
      cap.dataset.word = res.index;
      later(() => cap.classList.remove('lock'), 700);
      waveLetters(cellsOf(r, c, dr, dc, n));
    } else {
      cap.classList.add(res.type === 'bonus' ? 'bonus' : res.type === 'dup' ? 'dup' : 'bad');
      later(() => cap.remove(), res.type === 'bonus' ? 1100 : 520);
    }
  }

  function waveLetters(list) {
    list.forEach((i, k) => {
      const el = cells[i];
      el.classList.remove('wave');
      void el.offsetWidth;
      el.style.animationDelay = `${k * 45}ms`;
      el.classList.add('wave', 'found');
      later(() => el.classList.remove('wave'), 700 + k * 45);
    });
  }

  let colorIdx = 0;

  // Public API -----------------------------------------------------------
  const api = {
    el: frame,
    paper,
    setSize,
    get cellSize() {
      return cs;
    },
    setNextColor(i) {
      colorIdx = i;
    },
    setEnabled(v) {
      enabled = v;
      if (!v) {
        disarm();
        if (drag) {
          drag.cap.remove();
          drag = null;
          markSel([]);
        }
      }
    },
    // Adds a locked capsule for a found word (restore / reveal).
    addFound(w, color, { animate = false } = {}) {
      const n = w.key.length - 1;
      const cap = capEl(w.r, w.c, w.dr, w.dc, n, 'found');
      cap.style.setProperty('--col', CAP_COLORS[color % CAP_COLORS.length]);
      if (animate) {
        cap.classList.add('draw');
        later(() => cap.classList.remove('draw'), 900);
      }
      caps.append(cap);
      const list = cellsOf(w.r, w.c, w.dr, w.dc, n);
      if (animate) later(() => waveLetters(list), 350);
      else list.forEach((i) => cells[i].classList.add('found'));
      return cap;
    },
    capRect(w) {
      // screen rect of the middle of a word, for flying labels
      const n = w.key.length - 1;
      const midR = w.r + (w.dr * n) / 2;
      const midC = w.c + (w.dc * n) / 2;
      const rect = paper.getBoundingClientRect();
      return { x: rect.left + (midC + 0.5) * cs, y: rect.top + (midR + 0.5) * cs };
    },
    cellCenter(r, c) {
      const rect = paper.getBoundingClientRect();
      return { x: rect.left + (c + 0.5) * cs, y: rect.top + (r + 0.5) * cs };
    },
    markHint(r, c, on = true) {
      cells[r * size + c].classList.toggle('hint', on);
    },
    spotlight(r0, c0, r1, c1, ms = 4200) {
      fx.querySelectorAll('.g-wordsearch-spot').forEach((el) => el.remove());
      const el = h('div', { class: 'g-wordsearch-spot' });
      el.style.setProperty('--r0', Math.min(r0, r1));
      el.style.setProperty('--c0', Math.min(c0, c1));
      el.style.setProperty('--rh', Math.abs(r1 - r0) + 1);
      el.style.setProperty('--cw', Math.abs(c1 - c0) + 1);
      fx.append(el);
      later(() => el.classList.add('out'), ms);
      later(() => el.remove(), ms + 500);
    },
    clearSpotlight() {
      fx.querySelectorAll('.g-wordsearch-spot').forEach((el) => el.classList.add('out'));
    },
    // Tutorial: a ghost capsule sweeps across a word with a pointing hand.
    demo(w) {
      api.stopDemo();
      const n = w.key.length - 1;
      const ghost = capEl(w.r, w.c, w.dr, w.dc, 0, 'ghost');
      const hand = h('div', { class: 'g-wordsearch-hand' }, '👆');
      fx.append(ghost, hand);
      let step = 0;
      const run = () => {
        if (!ghost.isConnected) return;
        const k = step % (n + 8);
        const m = Math.min(k, n);
        placeCap(ghost, w.r, w.c, w.dr, w.dc, m, 0);
        ghost.classList.toggle('hide', k > n + 4);
        hand.style.setProperty('--hx', w.c + w.dc * m);
        hand.style.setProperty('--hy', w.r + w.dr * m);
        hand.classList.toggle('hide', k > n + 4);
        step++;
        api._demoTimer = later(run, k === 0 ? 500 : 230);
      };
      run();
    },
    stopDemo() {
      fx.querySelectorAll('.g-wordsearch-hand, .g-wordsearch-cap.ghost').forEach((el) => el.remove());
    },
    shake() {
      frame.classList.remove('shake');
      void frame.offsetWidth;
      frame.classList.add('shake');
    },
    celebrate() {
      cells.forEach((el, i) => {
        el.style.animationDelay = `${((i % size) + Math.floor(i / size)) * 35}ms`;
        el.classList.add('wave');
      });
      later(() => cells.forEach((el) => el.classList.remove('wave')), 1600);
    },
    destroy() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      paper.removeEventListener('pointerdown', onDown);
      paper.removeEventListener('pointermove', onMove);
      paper.removeEventListener('pointerup', onUp);
      paper.removeEventListener('pointercancel', onUp);
      paper.removeEventListener('lostpointercapture', onUp);
    },
  };

  paper.addEventListener('pointerdown', onDown);
  paper.addEventListener('pointermove', onMove);
  paper.addEventListener('pointerup', onUp);
  paper.addEventListener('pointercancel', onUp);
  paper.addEventListener('lostpointercapture', onUp);
  paper.addEventListener('contextmenu', (e) => e.preventDefault());
  return api;
}
