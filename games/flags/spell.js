// Spelling questions.
//   easy ('spell'): blanks + a pool of letter tiles (the answer's letters plus
//                   a few extras). Letters are checked one by one; a wrong
//                   tile shakes, is not accepted and costs a life.
//   hard ('type'):  type the whole name on an on-screen keyboard (accents are
//                   not needed) and check at the end.

import { h, norm, shuffle } from '../../js/core/ui.js';
import { answerText } from './data.js';
import { restartAnim } from './widgets.js';

const baseOf = (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const isLetter = (b) => /^[A-Z]$/.test(b);
const compact = (s) => norm(s).replace(/ /g, '');
const COMMON = 'AEIOURSTLNMCDPBGHVKZ';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function buildWords(answer) {
  const words = [];
  let cur = [];
  for (const ch of Array.from(answer)) {
    if (ch === ' ') {
      if (cur.length) words.push(cur);
      cur = [];
      continue;
    }
    const b = baseOf(ch);
    cur.push(isLetter(b) ? { base: b, disp: ch.toUpperCase(), letter: true } : { disp: ch, letter: false });
  }
  if (cur.length) words.push(cur);
  return words;
}

function dontKnowBtn(api, onclick) {
  return h('button', { class: 'btn ghost small g-flags-dunno', onclick }, api.t('dontKnow'));
}

export function renderSpell(api, q, wrap) {
  const { t } = api;
  const answer = answerText(q.c, q.kind, api.lang);
  wrap.append(...api.prompt(q, q.kind === 'caps' ? 'qSpellCap' : 'qSpellFlag'));

  const words = buildWords(answer);
  const slots = [];
  const slotsEl = h('div', { class: 'g-flags-slots' });
  for (const w of words) {
    const we = h('div', { class: 'g-flags-word' });
    for (const s of w) {
      s.el = h('span', { class: s.letter ? 'g-flags-slot' : 'g-flags-slot fixed' }, s.letter ? '' : s.disp);
      we.append(s.el);
      if (s.letter) slots.push(s);
    }
    slotsEl.append(we);
  }
  if (slots.length > 15) slotsEl.classList.add('sm');

  const letters = slots.map((s) => s.base);
  const nExtra = Math.min(5, Math.max(3, Math.round(letters.length * 0.3)));
  const extras = shuffle(COMMON.split('').filter((l) => !letters.includes(l)))
    .concat(shuffle(ALPHA.split('').filter((l) => !letters.includes(l) && !COMMON.includes(l))))
    .slice(0, nExtra);
  const tilesEl = h('div', { class: 'g-flags-tiles' });
  const tiles = shuffle([...letters, ...extras]).map((l, i) => {
    const b = h('button', { class: 'g-flags-tile', style: { animationDelay: i * 18 + 'ms' } }, l);
    b.addEventListener('click', () => tap(b));
    tilesEl.append(b);
    return b;
  });
  if (tiles.length > 21) tilesEl.classList.add('sm');

  let pos = 0;
  let slipped = false;
  let done = false;
  if (slots[0]) slots[0].el.classList.add('cur');

  const dunno = dontKnowBtn(api, () => giveUp());
  wrap.append(h('div', { class: 'g-flags-spellbox' }, slotsEl, tilesEl, dunno));

  function tap(tile) {
    if (done || api.timeUp || tile.classList.contains('used')) return;
    const s = slots[pos];
    if (tile.textContent === s.base) {
      s.el.textContent = s.disp;
      s.el.classList.remove('cur');
      s.el.classList.add('ok');
      tile.classList.add('used');
      api.sfx.tone({ freq: 520 + Math.min(pos, 20) * 28, dur: 0.07, type: 'triangle', vol: 0.3 });
      pos++;
      if (pos >= slots.length) complete();
      else slots[pos].el.classList.add('cur');
    } else {
      restartAnim(tile, 'shake');
      restartAnim(tile, 'g-flags-tile-bad');
      const dead = api.bad(q.kind, q.c, { mastery: !slipped });
      slipped = true;
      if (dead) {
        reveal();
        finish(false, 1800);
      }
    }
  }

  function reveal() {
    if (slots[pos]) slots[pos].el.classList.remove('cur');
    for (let i = pos; i < slots.length; i++) {
      slots[i].el.textContent = slots[i].disp;
      slots[i].el.classList.add('rev');
    }
  }

  function complete() {
    slotsEl.classList.add(slipped ? 'meh' : 'win');
    if (!slipped) api.good(q.kind, q.c);
    else api.sfx.play('pop');
    finish(!slipped, slipped ? 1200 : 1000);
  }

  function giveUp() {
    if (done || api.timeUp) return;
    api.bad(q.kind, q.c, { mastery: !slipped });
    slipped = true;
    reveal();
    finish(false, 2000);
  }

  function finish(ok, delay) {
    done = true;
    tilesEl.classList.add('g-flags-locked');
    dunno.disabled = true;
    api.answered(q, ok);
    api.next(delay);
  }

  // Physical keyboard: typing a letter taps a matching tile.
  api.qscope.on(window, 'keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? baseOf(e.key) : '';
    if (!isLetter(k)) return;
    const tile = tiles.find((b) => !b.classList.contains('used') && b.textContent === k);
    if (tile) tap(tile);
  });
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const ICON_BKSP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M17 9l-6 6M11 9l6 6"/></svg>';

export function renderType(api, q, wrap) {
  const { t } = api;
  const answer = answerText(q.c, q.kind, api.lang);
  wrap.append(...api.prompt(q, q.kind === 'caps' ? 'qTypeCap' : 'qTypeFlag'));

  let typed = '';
  let done = false;
  const txt = h('span', { class: 'g-flags-typedtxt' });
  const ph = h('span', { class: 'g-flags-typedph' }, t('typeHere'));
  const disp = h('div', { class: 'g-flags-typed empty', 'aria-live': 'polite' }, ph, txt, h('i', { class: 'g-flags-caret' }));
  const reveal = h('div', { class: 'g-flags-answerwas' });

  const kb = h('div', { class: 'g-flags-kb' });
  const press = (fn) => (e) => {
    e.preventDefault();
    if (done || api.timeUp) return;
    fn();
  };
  ROWS.forEach((row, ri) => {
    const r = h('div', { class: 'g-flags-kbrow' });
    for (const ch of row) r.append(h('button', { class: 'g-flags-key', onpointerdown: press(() => add(ch)), onclick: (e) => e.detail === 0 && !done && add(ch) }, ch));
    if (ri === 2) r.append(h('button', { class: 'g-flags-key wide', 'aria-label': t('backspace'), html: ICON_BKSP, onpointerdown: press(back), onclick: (e) => e.detail === 0 && !done && back() }));
    kb.append(r);
  });
  const checkBtn = h('button', { class: 'btn primary small g-flags-check', onclick: () => check() }, t('check'));
  const dunno = dontKnowBtn(api, () => giveUp());
  kb.append(
    h(
      'div',
      { class: 'g-flags-kbrow last' },
      dunno,
      h('button', { class: 'g-flags-key space', onpointerdown: press(() => add(' ')), onclick: (e) => e.detail === 0 && !done && add(' ') }, t('space')),
      checkBtn,
    ),
  );
  wrap.append(h('div', { class: 'g-flags-typebox' }, disp, reveal, kb));

  function render() {
    txt.textContent = typed;
    disp.classList.toggle('empty', !typed);
  }
  function add(ch) {
    if (typed.length >= 40) return;
    if (ch === ' ' && (!typed || typed.endsWith(' '))) return;
    typed += ch;
    api.sfx.play('tap');
    render();
  }
  function back() {
    typed = typed.slice(0, -1);
    api.sfx.tone({ freq: 330, dur: 0.04, type: 'triangle', vol: 0.2 });
    render();
  }
  function check() {
    if (done || api.timeUp) return;
    if (!typed.trim()) {
      restartAnim(disp, 'shake');
      return;
    }
    const ok = compact(typed) === compact(answer);
    if (ok) {
      txt.textContent = answer.toUpperCase();
      disp.classList.add('ok');
      api.good(q.kind, q.c);
    } else {
      disp.classList.add('bad');
      restartAnim(disp, 'shake');
      showAnswer();
      api.bad(q.kind, q.c);
    }
    finish(ok, ok ? 1000 : 2300);
  }
  function giveUp() {
    if (done || api.timeUp) return;
    showAnswer();
    disp.classList.add('bad');
    api.bad(q.kind, q.c);
    finish(false, 2300);
  }
  function showAnswer() {
    reveal.textContent = t('answerWas', { a: answer });
    reveal.classList.add('show');
  }
  function finish(ok, delay) {
    done = true;
    kb.classList.add('g-flags-locked');
    api.answered(q, ok);
    api.next(delay);
  }

  api.qscope.on(window, 'keydown', (e) => {
    if (done || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      check();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      back();
    } else if (e.key === ' ') {
      e.preventDefault();
      add(' ');
    } else if (e.key.length === 1) {
      const k = baseOf(e.key);
      if (isLetter(k)) add(k);
    }
  });
}
