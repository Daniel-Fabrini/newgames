// Match pairs: up to 4 flags on the left, their names (or capitals) on the
// right. Tap a flag then a name (either order), or drag one onto the other.
// Correct pairs disappear; a wrong pair shakes and costs a life.

import { h, shuffle } from '../../js/core/ui.js';
import { answerText } from './data.js';
import { flagCard, restartAnim } from './widgets.js';

export function renderMatch(api, q, wrap) {
  const { t, lang } = api;
  const cs = q.cs;
  wrap.append(h('div', { class: 'g-flags-qlabel' }, t(q.kind === 'caps' ? 'matchHintCap' : 'matchHint')));
  const colL = h('div', { class: 'g-flags-mcol' });
  const colR = h('div', { class: 'g-flags-mcol' });
  const grid = h('div', { class: 'g-flags-match', style: { '--rows': String(Math.max(cs.length, 3)) } }, colL, colR);
  wrap.append(grid);

  const cells = [];
  shuffle(cs).forEach((c, i) => {
    const el = h('button', { class: 'g-flags-mcell flag', style: { animationDelay: i * 60 + 'ms' }, 'aria-label': String(i + 1) }, flagCard(c, { wave: false }));
    el._c = c;
    el._side = 'L';
    colL.append(el);
    cells.push(el);
  });
  shuffle(cs).forEach((c, i) => {
    const el = h('button', { class: 'g-flags-mcell name', style: { animationDelay: 120 + i * 60 + 'ms' } }, h('span', null, answerText(c, q.kind, lang)));
    el._c = c;
    el._side = 'R';
    colR.append(el);
    cells.push(el);
  });

  let left = cs.length;
  let locked = false;
  let sel = null;
  let drag = null;

  function select(cell) {
    if (sel) sel.classList.remove('sel');
    sel = cell;
    if (cell) cell.classList.add('sel');
  }

  function usable(cell) {
    return cell && !locked && !api.timeUp && !cell.classList.contains('gone') && !cell.classList.contains('match');
  }

  function tapCell(cell) {
    if (!usable(cell)) return;
    if (!sel) {
      select(cell);
      api.sfx.play('tap');
    } else if (sel === cell) {
      select(null);
    } else if (sel._side === cell._side) {
      select(cell);
      api.sfx.play('tap');
    } else {
      attempt(sel, cell);
    }
  }

  function attempt(a, b) {
    const flagCell = a._side === 'L' ? a : b;
    const nameCell = flagCell === a ? b : a;
    select(null);
    if (flagCell._c === nameCell._c) {
      flagCell.classList.add('match');
      nameCell.classList.add('match');
      api.good(q.kind, flagCell._c);
      api.answered({ ...q, c: flagCell._c }, true);
      api.qscope.timeout(() => {
        flagCell.classList.add('gone');
        nameCell.classList.add('gone');
      }, 450);
      left--;
      if (!left) {
        locked = true;
        api.next(800);
      }
    } else {
      for (const x of [flagCell, nameCell]) {
        x.classList.add('nomatch');
        restartAnim(x, 'shake');
      }
      api.qscope.timeout(() => [flagCell, nameCell].forEach((x) => x.classList.remove('nomatch')), 650);
      if (api.bad(q.kind, flagCell._c)) {
        locked = true;
        api.next(1400);
      }
    }
  }

  // ---------- drag and drop ----------
  function stopDrag() {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.over) drag.over.classList.remove('over');
    drag.cell.classList.remove('lifted');
    drag = null;
  }
  api.qscope.defer(stopDrag);

  for (const cell of cells) {
    cell.addEventListener('pointerdown', (e) => {
      if (!usable(cell) || drag) return;
      drag = { cell, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, ghost: null, over: null };
      try {
        cell.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });
    cell.addEventListener('pointermove', (e) => {
      if (!drag || drag.cell !== cell || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 10) return;
        drag.moved = true;
        const r = cell.getBoundingClientRect();
        drag.w = r.width;
        drag.h = r.height;
        drag.ox = e.clientX - r.left;
        drag.oy = e.clientY - r.top;
        drag.ghost = cell.cloneNode(true);
        drag.ghost.className = cell.className.replace(/\b(sel|lifted)\b/g, '') + ' g-flags-ghost';
        Object.assign(drag.ghost.style, { width: r.width + 'px', height: r.height + 'px', animationDelay: '0ms' });
        document.body.append(drag.ghost);
        cell.classList.add('lifted');
        select(cell);
      }
      drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px) rotate(-3deg) scale(1.04)`;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under && under.closest('.g-flags-mcell');
      const valid = target && target !== cell && target._side !== cell._side && usable(target) ? target : null;
      if (valid !== drag.over) {
        if (drag.over) drag.over.classList.remove('over');
        drag.over = valid;
        if (valid) valid.classList.add('over');
      }
    });
    cell.addEventListener('pointerup', (e) => {
      if (!drag || drag.cell !== cell || e.pointerId !== drag.id) return;
      const d = drag;
      const over = d.over;
      stopDrag();
      if (!d.moved) tapCell(cell);
      else if (over) attempt(cell, over);
      else select(null);
    });
    cell.addEventListener('pointercancel', () => {
      if (drag && drag.cell === cell) stopDrag();
    });
    // Keyboard activation (Enter/Space) — pointer taps are handled above.
    cell.addEventListener('click', (e) => {
      if (e.detail === 0) tapCell(cell);
    });
  }
}
