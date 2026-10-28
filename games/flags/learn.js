// Learning screens: flashcards (flip, swipe, "I know it / repeat later") and
// the searchable table of every country.

import { h, clear, norm, shuffle } from '../../js/core/ui.js';
import { COUNTRIES, flagUrl } from '../../js/data/countries.js';
import { CONTS } from './data.js';
import { MAX_BOX } from './progress.js';
import { flagCard } from './widgets.js';

function dots(box) {
  const el = h('span', { class: 'g-flags-dots', 'aria-hidden': 'true' });
  for (let i = 0; i < MAX_BOX; i++) el.append(h('i', { class: i < box ? 'on' : '' }));
  return el;
}

// ---------- flashcards ----------
export function showFlashcards(app, view, scope, set, onDone) {
  const { t, sfx, P, lang } = app;
  const caps = set.kind === 'caps';
  view.classList.add('g-flags-fcview');
  let filter = set.items.some((c) => !P.fcKnows(c.code)) ? 'review' : 'all';
  let deck = [];
  let total = 0;
  let known = 0;
  let again = 0;
  let flipped = false;
  let busy = false;

  const chips = h('div', { class: 'g-flags-seg' });
  const stats = h('div', { class: 'g-flags-fcstats' });
  const line = h('i');
  const stage = h('div', { class: 'g-flags-fcstage' });
  const btnAgain = h('button', { class: 'btn g-flags-fcbtn again', onclick: () => mark(false) }, '↺ ' + t('fcRepeat'));
  const btnKnow = h('button', { class: 'btn primary g-flags-fcbtn', onclick: () => mark(true) }, '✓ ' + t('fcKnow'));
  const actions = h('div', { class: 'g-flags-fcactions' }, btnAgain, btnKnow);
  const hint = h('div', { class: 'g-flags-fchint' }, t('fcSwipe'));
  view.append(
    h('div', { class: 'g-flags-hud g-flags-fchud' }, chips, h('div', { class: 'g-flags-hline' }, line)),
    stats,
    stage,
    actions,
    hint,
  );

  function renderChips() {
    clear(chips);
    const unknown = set.items.filter((c) => !P.fcKnows(c.code)).length;
    const mk = (id, label) =>
      h(
        'button',
        {
          class: filter === id ? 'active' : '',
          onclick: () => {
            if (filter === id) return;
            filter = id;
            sfx.play('tap');
            build();
          },
        },
        label,
      );
    chips.append(mk('review', t('fcToReview', { n: unknown })), mk('all', t('fcAll', { n: set.items.length })));
  }

  function build() {
    const items = set.items.filter((c) => filter === 'all' || !P.fcKnows(c.code));
    deck = shuffle(items);
    total = deck.length;
    known = 0;
    again = 0;
    renderCard();
  }

  function updateStats() {
    renderChips();
    line.style.width = total ? (known / total) * 100 + '%' : '100%';
    clear(stats).append(
      h('span', { class: 'ok' }, '✓ ' + known),
      h('span', { class: 'again' }, '↺ ' + again),
      h('span', null, t('fcLeft', { n: deck.length })),
    );
  }

  let card = null;
  function renderCard() {
    updateStats();
    clear(stage);
    flipped = false;
    if (!deck.length) {
      actions.hidden = true;
      hint.hidden = true;
      const all = filter === 'all' || set.items.every((c) => P.fcKnows(c.code));
      stage.append(
        h(
          'div',
          { class: 'g-flags-fcdone pop-in' },
          h('div', { class: 'g-flags-medal' }, '🎉'),
          h('div', { class: 'title-l' }, t('fcDone')),
          h('p', { class: 'muted' }, total ? t('fcDoneText', { n: total }) : t('fcNothing')),
          h('button', { class: 'btn primary block', onclick: () => ((filter = all ? 'all' : 'review'), build()) }, t('fcRestart')),
          h('button', { class: 'btn ghost block', onclick: onDone }, t('back')),
        ),
      );
      if (total) {
        sfx.play('win');
        app.ctx.ui.confetti();
      }
      return;
    }
    actions.hidden = false;
    hint.hidden = false;
    const c = deck[0];
    const box = P.box(set.kind, c.code);
    const front = h(
      'div',
      { class: 'g-flags-fcface front' },
      h('div', { class: 'g-flags-fcflag' }, flagCard(c)),
      caps ? h('div', { class: 'g-flags-fcname' }, c.name[lang]) : null,
      h('div', { class: 'g-flags-fctap' }, t('fcTap')),
    );
    const back = h(
      'div',
      { class: 'g-flags-fcface back' },
      h('div', { class: 'g-flags-fcmini' }, flagCard(c, { wave: false })),
      h('div', { class: 'g-flags-fcname' }, c.name[lang]),
      h('div', { class: 'g-flags-fccap' }, h('small', null, t('capital')), c.capital ? c.capital[lang] : t('noCapital')),
      h('div', { class: 'g-flags-fcmeta' }, h('span', { class: 'g-flags-tag' }, t('cont_' + c.cont)), h('span', { class: 'g-flags-tag' }, t('level', { n: c.level })), dots(box)),
    );
    card = h('div', { class: 'g-flags-fc g-flags-fcin', tabindex: '0' }, h('div', { class: 'g-flags-fcinner' }, front, back));
    stage.append(card);
    bindSwipe(card);
  }

  function flip() {
    if (!card || busy) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
    sfx.play('select');
  }

  function mark(know) {
    if (!card || busy || !deck.length) return;
    busy = true;
    const c = deck[0];
    P.fcMark(c.code, know);
    if (know) {
      known++;
      deck.shift();
      sfx.play('success');
    } else {
      again++;
      P.markWeak(set.kind, c.code);
      deck.push(deck.shift());
      sfx.play('whoosh');
    }
    card.style.transition = 'transform .32s ease-in, opacity .32s';
    card.style.transform = `translateX(${know ? 130 : -130}%) rotate(${know ? 18 : -18}deg)`;
    card.style.opacity = '0';
    scope.timeout(() => {
      busy = false;
      renderCard();
    }, 300);
  }

  function bindSwipe(el) {
    let s = null;
    el.addEventListener('pointerdown', (e) => {
      if (busy) return;
      s = { x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, moved: false };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.style.transition = 'none';
    });
    el.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.id) return;
      s.dx = e.clientX - s.x;
      if (Math.abs(s.dx) > 8) s.moved = true;
      if (!s.moved) return;
      el.style.transform = `translateX(${s.dx}px) rotate(${s.dx / 18}deg)`;
      el.classList.toggle('to-know', s.dx > 60);
      el.classList.toggle('to-again', s.dx < -60);
    });
    const up = (e) => {
      if (!s || e.pointerId !== s.id) return;
      const st = s;
      s = null;
      el.classList.remove('to-know', 'to-again');
      if (!st.moved) {
        el.style.transition = '';
        flip();
        return;
      }
      if (Math.abs(st.dx) > 90) {
        mark(st.dx > 0);
        return;
      }
      el.style.transition = 'transform .25s cubic-bezier(.3,1.5,.6,1)';
      el.style.transform = '';
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip();
      }
    });
  }

  scope.on(window, 'keydown', (e) => {
    if (e.key === 'ArrowRight') mark(true);
    else if (e.key === 'ArrowLeft') mark(false);
    else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) {
      e.preventDefault();
      flip();
    }
  });

  build();
}

// ---------- table ----------
export function showTable(app, view, scope) {
  const { t, sfx, P, lang } = app;
  let cont = 'all';
  let query = '';
  const input = h('input', { class: 'g-flags-search', type: 'search', placeholder: t('search'), 'aria-label': t('search'), autocomplete: 'off', spellcheck: 'false' });
  const chipsEl = h('div', { class: 'chips g-flags-contchips' });
  const count = h('div', { class: 'g-flags-count' });
  const list = h('div', { class: 'g-flags-tlist' });
  const empty = h('div', { class: 'g-flags-empty', hidden: true }, '🔎 ' + t('noResults'));
  view.append(h('div', { class: 'g-flags-tablehead' }, input, chipsEl, count), list, empty);

  const opts = [['all', t('allConts')], ...CONTS.map((c) => [c, t('cont_' + c)])];
  const chipBtns = opts.map(([id, label]) => {
    const b = h(
      'button',
      {
        class: 'chip' + (id === cont ? ' active' : ''),
        onclick: () => {
          cont = id;
          sfx.play('tap');
          chipBtns.forEach((x) => x.classList.toggle('active', x === b));
          filter();
        },
      },
      label,
    );
    chipsEl.append(b);
    return b;
  });

  const rows = [...COUNTRIES]
    .sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang))
    .map((c) => {
      const box = Math.max(P.box('flags', c.code), 0);
      const el = h(
        'button',
        { class: 'g-flags-trow', onclick: () => details(c) },
        h('span', { class: 'g-flags-tflag' }, h('img', { src: flagUrl(c), alt: '', loading: 'lazy', decoding: 'async' })),
        h('span', { class: 'g-flags-tbody' }, h('b', null, c.name[lang]), h('small', null, c.capital ? c.capital[lang] : '—')),
        dots(box),
      );
      el._key = norm([c.name[lang], c.name.en, c.capital ? c.capital[lang] : ''].join(' '));
      el._c = c;
      list.append(el);
      return el;
    });

  function filter() {
    const qn = norm(query);
    let n = 0;
    for (const r of rows) {
      const show = (cont === 'all' || r._c.cont === cont) && (!qn || r._key.includes(qn));
      r.hidden = !show;
      if (show) n++;
    }
    count.textContent = t('nCountries', { n });
    empty.hidden = n > 0;
  }
  input.addEventListener('input', () => {
    query = input.value;
    filter();
  });
  filter();

  async function details(c) {
    sfx.play('tap');
    const body = h(
      'div',
      { class: 'g-flags-detail' },
      h('div', { class: 'g-flags-detailflag' }, flagCard(c)),
      h('div', { class: 'g-flags-fccap' }, h('small', null, t('capital')), c.capital ? c.capital[lang] : t('noCapital')),
      h('div', { class: 'g-flags-fcmeta' }, h('span', { class: 'g-flags-tag' }, t('cont_' + c.cont)), h('span', { class: 'g-flags-tag' }, c.independent ? t('level', { n: c.level }) : t('territory'))),
      h('div', { class: 'g-flags-mastline' }, h('span', null, t('mastery')), dots(P.box('flags', c.code))),
    );
    await app.ctx.ui.modal({ title: c.name[lang], body, actions: [{ label: t('close'), value: true, primary: true }], dismissible: true, className: 'g-flags-modal' });
  }
}
