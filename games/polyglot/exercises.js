// Exercise renderers. Each returns:
//   { el, title, badge, auto, ready(), evaluate(), reveal(res), onShow(), onKey(e), extras, destroy() }
// `auto` exercises (match, speak) submit by themselves through env.submit(res).

import { primary, alts, display, segments, tileText, checkTiles, checkTyped, checkSpoken } from './corpus.js';
import { mascotSVG, ICON } from './art.js';

export function renderExercise(ex, env) {
  const R = {
    pick: pickEx,
    choose: chooseEx,
    match: matchEx,
    tiles: tilesEx,
    listen: ex.mode === 'type' ? listenTypeEx : tilesEx,
    fill: fillEx,
    type: typeEx,
    speak: speakEx,
    reply: replyEx,
  }[ex.type];
  return R(ex, env);
}

// ---------- shared pieces ----------
export function speakerButton(env, text, lang, { slow = false, big = false, label } = {}) {
  const btn = env.h('button', {
    class: `pg-spk ${big ? 'big' : ''} ${slow ? 'slow' : ''}`,
    'aria-label': label || env.t(slow ? 'slower' : 'listen'),
    html: slow ? ICON.turtle : ICON.speaker,
    onclick: (e) => {
      e.stopPropagation();
      play();
    },
  });
  function play() {
    env.speech.speak(text, lang, {
      slow,
      onStart: () => btn.classList.add('on'),
      onEnd: () => btn.classList.remove('on'),
    });
  }
  btn.play = play;
  if (!env.speech.has(lang)) btn.style.display = 'none';
  return btn;
}

// A target-language sentence whose words can be tapped (speaks the word + shows a hint).
export function sentenceView(env, text, lang, { cls = '' } = {}) {
  const { h } = env;
  const wrap = h('div', { class: `pg-sent ${cls}`, lang });
  const segs = segments(display(text, lang));
  let tip = null;
  segs.forEach((g, i) => {
    if (i > 0) wrap.append(g.word ? ' ' : ' ');
    if (g.pre) wrap.append(g.pre);
    if (g.word) {
      const w = h('span', { class: 'pg-w' }, g.word);
      w.addEventListener('click', (e) => {
        e.stopPropagation();
        env.speech.speak(g.word, lang);
        if (tip) tip.remove();
        const gloss = lang === env.T ? env.hint(g.word) : null;
        if (!gloss) return;
        tip = h('span', { class: 'pg-tip' }, gloss);
        w.append(tip);
        const mine = tip;
        env.later(() => mine.remove(), 2200);
      });
      wrap.append(w);
    }
    if (g.post) wrap.append(g.post);
  });
  return wrap;
}

function bubble(env, content, speaker, avatar) {
  const { h } = env;
  return h(
    'div',
    { class: 'pg-bubble-row' },
    avatar || h('div', { class: 'pg-bubble-ava', html: mascotSVG({ mood: 'happy' }) }),
    h('div', { class: 'pg-bubble' }, speaker, content),
  );
}

function newBadge(env, ex) {
  if (ex.retry) return env.h('div', { class: 'pg-badge retry' }, '↺ ', env.t('prevMistake'));
  if (ex.isNew) return env.h('div', { class: 'pg-badge new' }, '✦ ', env.t('newWord'));
  return null;
}

// Numbered option buttons (pick/choose/reply/fill share the selection logic).
function selectable(env, buttons, onSelect) {
  let sel = null;
  buttons.forEach((b, i) =>
    b.addEventListener('click', () => {
      if (b.disabled) return;
      sel = i;
      buttons.forEach((x, j) => x.classList.toggle('is-sel', j === i));
      env.sfx.play('tap');
      onSelect && onSelect(i);
      env.changed();
    }),
  );
  return {
    get sel() {
      return sel;
    },
    choose(i) {
      if (buttons[i] && !buttons[i].disabled) buttons[i].click();
    },
    reveal(answer, ok) {
      buttons.forEach((b) => (b.disabled = true));
      if (buttons[answer]) buttons[answer].classList.add('is-ok');
      if (!ok && sel !== null && buttons[sel]) buttons[sel].classList.add('is-bad');
    },
  };
}
const digitKey = (e) => {
  if (e.key >= '1' && e.key <= '9') return Number(e.key) - 1;
  if (e.key === '0') return 9;
  return -1;
};

// ---------- 1. pick the picture ----------
function pickEx(ex, env) {
  const { h, t, T, N } = env;
  const cards = ex.options.map((o, i) =>
    h(
      'button',
      { class: 'pg-card', lang: T },
      h('span', { class: 'pg-card-num' }, i + 1),
      h('span', { class: 'pg-card-emoji' }, o.item.e),
      h('span', { class: 'pg-card-word' }, display(primary(o.item[T]), T)),
    ),
  );
  const s = selectable(env, cards, (i) => env.speech.speak(primary(ex.options[i].item[T]), T));
  const el = h('div', { class: 'pg-ex pg-ex-pick' }, h('div', { class: `pg-cards n${cards.length}` }, cards));
  return {
    el,
    title: t('exPick', { w: primary(ex.ref.item[N]) }),
    badge: newBadge(env, ex),
    ready: () => s.sel !== null,
    evaluate: () => ({ ok: s.sel === ex.answer, solution: primary(ex.ref.item[T]), meaning: primary(ex.ref.item[N]), speakText: primary(ex.ref.item[T]) }),
    reveal: (res) => s.reveal(ex.answer, res.ok),
    onKey: (e) => {
      const i = digitKey(e);
      if (i >= 0) s.choose(i);
      return i >= 0;
    },
  };
}

// ---------- 1b. choose the word (no picture) ----------
function chooseEx(ex, env) {
  const { h, t, T, N } = env;
  const optLang = ex.dir === 'NT' ? T : N;
  const btns = ex.options.map((o, i) =>
    h('button', { class: 'pg-opt', lang: optLang }, h('span', { class: 'pg-opt-num' }, i + 1), h('span', null, display(primary(o.item[optLang]), optLang))),
  );
  const s = selectable(env, btns, (i) => {
    if (optLang === T) env.speech.speak(primary(ex.options[i].item[T]), T);
  });
  const parts = [];
  let spk = null;
  if (ex.dir === 'TN') {
    const word = primary(ex.ref.item[T]);
    spk = speakerButton(env, word, T);
    parts.push(h('div', { class: 'pg-bigword' }, spk, sentenceView(env, word, T, { cls: 'big' })));
  }
  const el = h('div', { class: 'pg-ex pg-ex-choose' }, parts, h('div', { class: 'pg-opts' }, btns));
  return {
    el,
    title: ex.dir === 'NT' ? t('exHowSay', { w: primary(ex.ref.item[N]) }) : t('exMeaning'),
    badge: newBadge(env, ex),
    ready: () => s.sel !== null,
    evaluate: () => ({ ok: s.sel === ex.answer, solution: primary(ex.options[ex.answer].item[optLang]), speakText: primary(ex.ref.item[T]) }),
    reveal: (res) => s.reveal(ex.answer, res.ok),
    onShow: () => spk && env.autoplay && spk.play(),
    onKey: (e) => {
      const i = digitKey(e);
      if (i >= 0) s.choose(i);
      return i >= 0;
    },
  };
}

// ---------- 4. match pairs ----------
function matchEx(ex, env) {
  const { h, t, T, N, sfx } = env;
  const left = env.shuffle(ex.pairs.map((w, i) => ({ w, i })));
  const right = env.shuffle(ex.pairs.map((w, i) => ({ w, i })));
  let selL = null;
  let selR = null;
  let matched = 0;
  let wrong = 0;
  let busy = false;
  const mk = (x, side) => {
    const lang = side === 'L' ? T : N;
    const b = h('button', { class: 'pg-pair', lang }, display(primary(x.w.item[lang]), lang));
    b.addEventListener('click', () => tap(side, x, b));
    x.btn = b;
    return b;
  };
  const colL = h('div', { class: 'pg-pcol' }, left.map((x) => mk(x, 'L')));
  const colR = h('div', { class: 'pg-pcol' }, right.map((x) => mk(x, 'R')));
  function tap(side, x, b) {
    if (busy || b.classList.contains('done')) return;
    if (side === 'L') {
      env.speech.speak(primary(x.w.item[T]), T);
      if (selL) selL.btn.classList.remove('is-sel');
      selL = selL === x ? null : x;
    } else {
      if (selR) selR.btn.classList.remove('is-sel');
      selR = selR === x ? null : x;
    }
    b.classList.toggle('is-sel', side === 'L' ? selL === x : selR === x);
    sfx.play('tap');
    if (selL && selR) test();
  }
  function test() {
    const a = selL;
    const b = selR;
    selL = selR = null;
    if (a.i === b.i) {
      matched++;
      [a.btn, b.btn].forEach((x) => {
        x.classList.remove('is-sel');
        x.classList.add('is-ok');
      });
      sfx.tone({ freq: 440 + matched * 90, to: 660 + matched * 110, dur: 0.12, type: 'triangle', vol: 0.35 });
      sfx.vibrate(10);
      env.later(() => {
        a.btn.classList.add('done');
        b.btn.classList.add('done');
      }, 260);
      if (matched === ex.pairs.length) env.later(() => env.submit({ ok: true, matchWrong: wrong }), 500);
    } else {
      wrong++;
      busy = true;
      [a.btn, b.btn].forEach((x) => {
        x.classList.remove('is-sel');
        x.classList.add('is-bad');
      });
      sfx.play('error');
      sfx.vibrate([30, 30, 30]);
      env.later(() => {
        a.btn.classList.remove('is-bad');
        b.btn.classList.remove('is-bad');
        busy = false;
      }, 520);
    }
  }
  const el = h('div', { class: 'pg-ex pg-ex-match' }, h('div', { class: 'pg-pairs' }, colL, colR));
  const all = [...left, ...right];
  return {
    el,
    title: t('exMatch'),
    auto: true,
    ready: () => false,
    evaluate: () => ({ ok: true }),
    reveal: () => {},
    onKey: (e) => {
      const i = digitKey(e);
      if (i < 0 || i >= all.length) return false;
      all[i].btn.click();
      return true;
    },
  };
}

// ---------- 2/3. tiles (translate) and tap-what-you-hear ----------
function tilesEx(ex, env) {
  const { h, t, T, N } = env;
  const listening = ex.type === 'listen';
  const lang = ex.lang;
  const answerLine = h('div', { class: 'pg-answer' });
  const bank = h('div', { class: 'pg-bank' });
  const placed = []; // { slot, tile, text }
  const slots = ex.tiles.map((text, i) => {
    const btn = h('button', { class: 'pg-tile', lang }, text);
    const slot = h('span', { class: 'pg-slot' }, btn);
    btn.addEventListener('click', () => add(i));
    bank.append(slot);
    return { slot, btn, text, used: false };
  });
  function add(i) {
    const s = slots[i];
    if (s.used || locked) return;
    s.used = true;
    s.btn.classList.add('used');
    if (lang === T) env.speech.speak(s.text, T);
    env.sfx.play('tap');
    const tile = h('button', { class: 'pg-tile in', lang }, s.text);
    tile.style.visibility = 'hidden';
    const entry = { s, tile };
    tile.addEventListener('click', () => remove(entry));
    placed.push(entry);
    answerLine.append(tile);
    env.fly(s.btn, tile, s.text, () => (tile.style.visibility = ''));
    env.changed();
  }
  function remove(entry) {
    if (locked) return;
    const idx = placed.indexOf(entry);
    if (idx < 0) return;
    placed.splice(idx, 1);
    env.sfx.play('tap');
    const from = entry.tile.getBoundingClientRect();
    const sibs = placed.map((p) => p.tile);
    const before = sibs.map((e) => e.getBoundingClientRect());
    entry.tile.remove();
    sibs.forEach((e, j) => {
      const a = before[j];
      const b = e.getBoundingClientRect();
      if ((a.left !== b.left || a.top !== b.top) && e.animate) {
        e.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
      }
    });
    env.flyRect(from, entry.s.btn, entry.s.text, () => {
      entry.s.used = false;
      entry.s.btn.classList.remove('used');
    });
    env.changed();
  }
  let locked = false;
  const parts = [];
  let autoBtn = null;
  if (listening) {
    const text = primary(ex.ref.item[T]);
    autoBtn = speakerButton(env, text, T, { big: true });
    parts.push(h('div', { class: 'pg-listen' }, autoBtn, speakerButton(env, text, T, { slow: true, big: true })));
  } else if (ex.dir === 'TN') {
    const text = primary(ex.ref.item[T]);
    autoBtn = speakerButton(env, text, T);
    parts.push(bubble(env, sentenceView(env, text, T), autoBtn));
  } else {
    parts.push(bubble(env, h('div', { class: 'pg-sent', lang: N }, primary(ex.ref.item[N])), null));
  }
  const el = h('div', { class: `pg-ex pg-ex-tiles` }, parts, answerLine, bank);
  const extras = [];
  if (listening) extras.push({ label: t('cantListen'), onclick: () => env.pauseListening() });
  return {
    el,
    title: listening ? t('exTapHear') : t('exWriteIn', { lang: env.inlineName(lang) }),
    badge: newBadge(env, ex),
    extras,
    ready: () => placed.length > 0,
    evaluate: () => {
      const res = checkTiles(
        placed.map((p) => p.s.text),
        ex.answers,
        lang,
      );
      return {
        ok: res.ok,
        solution: display(res.ok ? res.match : ex.answers[0], lang),
        meaning: listening ? primary(ex.ref.item[N]) : null,
        speakText: ex.dir === 'NT' || listening ? primary(ex.ref.item[T]) : null,
      };
    },
    reveal: () => {
      locked = true;
      el.classList.add('locked');
    },
    onShow: () => autoBtn && env.autoplay && autoBtn.play(),
    onKey: (e) => {
      if (e.key === 'Backspace') {
        if (placed.length) remove(placed[placed.length - 1]);
        return true;
      }
      const i = digitKey(e);
      if (i >= 0 && slots[i]) {
        add(i);
        return true;
      }
      return false;
    },
  };
}

// ---------- typing area shared by "type" and "type what you hear" ----------
function typingArea(env, lang, onEnter) {
  const ta = env.h('textarea', {
    class: 'pg-input',
    lang,
    rows: '3',
    placeholder: env.t('typeIn', { lang: env.inlineName(lang) }),
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  });
  ta.addEventListener('input', () => env.changed());
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onEnter();
    }
  });
  return ta;
}

// ---------- 6. type the translation ----------
function typeEx(ex, env) {
  const { h, t, T, N } = env;
  const ta = typingArea(env, ex.lang, () => env.enter());
  let autoBtn = null;
  let prompt;
  if (ex.dir === 'TN') {
    autoBtn = speakerButton(env, ex.prompt, T);
    prompt = bubble(env, sentenceView(env, ex.prompt, T), autoBtn);
  } else {
    prompt = bubble(env, h('div', { class: 'pg-sent', lang: N }, ex.prompt), null);
  }
  const el = h('div', { class: 'pg-ex pg-ex-type' }, prompt, ta);
  return {
    el,
    title: t(ex.word ? 'exTypeWord' : 'exWriteIn', { lang: env.inlineName(ex.lang) }),
    badge: newBadge(env, ex),
    ready: () => ta.value.trim().length > 0,
    evaluate: () => {
      const r = checkTyped(ta.value, ex.answers, ex.lang, env.lex);
      return {
        ok: r.ok,
        almost: r.almost,
        accent: r.accent,
        solution: display(r.ok ? r.match : ex.answers[0], ex.lang),
        speakText: ex.dir === 'NT' ? (r.ok ? r.match : ex.answers[0]) : null,
      };
    },
    reveal: () => {
      ta.readOnly = true;
      ta.blur();
    },
    onShow: () => {
      if (autoBtn && env.autoplay) autoBtn.play();
      if (env.finePointer) ta.focus();
    },
  };
}

// ---------- 3b. type what you hear ----------
function listenTypeEx(ex, env) {
  const { h, t, T, N } = env;
  const text = primary(ex.ref.item[T]);
  const ta = typingArea(env, T, () => env.enter());
  ta.placeholder = t('typeWhatHear');
  const main = speakerButton(env, text, T, { big: true });
  const el = h('div', { class: 'pg-ex pg-ex-ltype' }, h('div', { class: 'pg-listen' }, main, speakerButton(env, text, T, { slow: true, big: true })), ta);
  return {
    el,
    title: t('exTypeHear'),
    badge: newBadge(env, ex),
    extras: [{ label: t('cantListen'), onclick: () => env.pauseListening() }],
    ready: () => ta.value.trim().length > 0,
    evaluate: () => {
      const r = checkTyped(ta.value, ex.answers, T, env.lex);
      return { ok: r.ok, almost: r.almost, accent: r.accent, solution: display(r.ok ? r.match : text, T), meaning: primary(ex.ref.item[N]) };
    },
    reveal: () => {
      ta.readOnly = true;
      ta.blur();
    },
    onShow: () => {
      if (env.autoplay) main.play();
      if (env.finePointer) ta.focus();
    },
  };
}

// ---------- 5. fill in the blank ----------
function fillEx(ex, env) {
  const { h, t, T, N } = env;
  const slot = h('span', { class: 'pg-blank' }, ' ');
  const sent = h('div', { class: 'pg-sent pg-fill-sent', lang: T });
  ex.segs.forEach((g, i) => {
    if (i > 0) sent.append(g.word ? ' ' : ' ');
    if (g.pre) sent.append(g.pre);
    if (i === ex.blank) sent.append(slot);
    else if (g.word) {
      const w = h('span', { class: 'pg-w' }, g.word);
      w.addEventListener('click', () => env.speech.speak(g.word, T));
      sent.append(w);
    }
    if (g.post) sent.append(g.post);
  });
  const btns = ex.options.map((o, i) => h('button', { class: 'pg-chipopt', lang: T }, h('span', { class: 'pg-opt-num' }, i + 1), o));
  const s = selectable(env, btns, (i) => {
    slot.textContent = ex.options[i];
    slot.classList.add('filled');
    env.speech.speak(ex.options[i], T);
  });
  const el = h(
    'div',
    { class: 'pg-ex pg-ex-fill' },
    bubble(env, h('div', null, sent, h('div', { class: 'pg-meaning' }, primary(ex.ref.item[N]))), null),
    h('div', { class: 'pg-chipopts' }, btns),
  );
  return {
    el,
    title: t('exFill'),
    badge: newBadge(env, ex),
    ready: () => s.sel !== null,
    evaluate: () => ({ ok: s.sel === ex.answer, solution: display(primary(ex.ref.item[T]), T), speakText: primary(ex.ref.item[T]) }),
    reveal: (res) => {
      s.reveal(ex.answer, res.ok);
      slot.textContent = ex.options[ex.answer];
      slot.classList.add(res.ok ? 'is-ok' : 'is-bad');
    },
    onKey: (e) => {
      const i = digitKey(e);
      if (i >= 0) s.choose(i);
      return i >= 0;
    },
  };
}

// ---------- speaking ----------
function speakEx(ex, env) {
  const { h, t, T } = env;
  const spk = speakerButton(env, ex.text, T);
  const status = h('div', { class: 'pg-mic-status' }, t('tapToSpeak'));
  const heard = h('div', { class: 'pg-heard' });
  let stop = null;
  let attempts = 0;
  let done = false;
  const mic = h('button', { class: 'pg-mic', 'aria-label': t('tapToSpeak'), html: ICON.mic });
  mic.addEventListener('click', () => {
    if (done) return;
    if (stop) {
      stop();
      stop = null;
      mic.classList.remove('rec');
      status.textContent = t('tapToSpeak');
      return;
    }
    env.speech.stop();
    env.sfx.play('tap');
    mic.classList.add('rec');
    status.textContent = t('listening');
    heard.textContent = '';
    const session = {};
    env.later(() => {
      // Some engines never answer (offline, no service): give up after a while.
      if (stop && stop.session === session) {
        stop();
        stop = null;
        mic.classList.remove('rec');
        status.textContent = t('noSpeech');
      }
    }, 9000);
    stop = env.speech.listen(T, {
      onPartial: (txt) => (heard.textContent = txt),
      onResult: (list) => {
        stop = null;
        mic.classList.remove('rec');
        heard.textContent = list[0] || '';
        const r = checkSpoken(list, ex.answers, T);
        if (r.ok) {
          done = true;
          env.submit({ ok: true, solution: display(ex.text, T) });
        } else {
          attempts++;
          env.sfx.play('error');
          mic.classList.add('shake');
          env.later(() => mic.classList.remove('shake'), 400);
          if (attempts >= 3) {
            done = true;
            env.submit({ ok: false, noPenalty: true, solution: display(ex.text, T) });
          } else status.textContent = t('tryAgainSpeak');
        }
      },
      onEnd: () => {
        stop = null;
        mic.classList.remove('rec');
        if (!done) status.textContent = t('noSpeech');
      },
      onError: (code) => {
        stop = null;
        mic.classList.remove('rec');
        if (code === 'no-speech' || code === 'aborted') {
          status.textContent = t('noSpeech');
          return;
        }
        done = true;
        if (code === 'not-allowed' || code === 'service-not-allowed') env.micDenied();
        else env.pauseSpeaking(true);
      },
    });
    stop.session = session;
  });
  const el = h(
    'div',
    { class: 'pg-ex pg-ex-speak' },
    bubble(env, sentenceView(env, ex.text, T), spk),
    h('div', { class: 'pg-mic-wrap' }, mic, status, heard),
  );
  return {
    el,
    title: t('exSpeak'),
    badge: newBadge(env, ex),
    auto: true,
    extras: [{ label: t('cantSpeak'), onclick: () => env.pauseSpeaking() }],
    ready: () => false,
    evaluate: () => ({ ok: false }),
    reveal: () => (done = true),
    onShow: () => env.autoplay && spk.play(),
    destroy: () => stop && stop(),
  };
}

// ---------- choose the reply (dialogue) ----------
function replyEx(ex, env) {
  const { h, t, T, N } = env;
  const parts = [];
  let ctxSpk = null;
  if (ex.context) {
    const who = ex.cast[ex.context.who] || { name: '?', emoji: '🙂' };
    const text = primary(ex.context.line[T]);
    ctxSpk = speakerButton(env, text, T);
    parts.push(
      bubble(
        env,
        h('div', null, h('div', { class: 'pg-who' }, who.name), sentenceView(env, text, T)),
        ctxSpk,
        h('div', { class: 'pg-bubble-ava emoji' }, who.emoji),
      ),
    );
  }
  const me = ex.cast[ex.who] || { name: '?', emoji: '🙂' };
  const btns = ex.options.map((o, i) => h('button', { class: 'pg-opt', lang: T }, h('span', { class: 'pg-opt-num' }, i + 1), h('span', null, display(primary(o[T]), T))));
  const s = selectable(env, btns, (i) => env.speech.speak(primary(ex.options[i][T]), T));
  const el = h(
    'div',
    { class: 'pg-ex pg-ex-reply' },
    parts,
    h('div', { class: 'pg-reply-who' }, h('span', { class: 'pg-reply-ava' }, me.emoji), t('whatSays', { name: me.name })),
    h('div', { class: 'pg-opts' }, btns),
  );
  const correct = ex.options[ex.answer];
  return {
    el,
    title: t('exReply'),
    badge: newBadge(env, ex),
    ready: () => s.sel !== null,
    evaluate: () => ({ ok: s.sel === ex.answer, solution: display(primary(correct[T]), T), meaning: primary(correct[N]), speakText: primary(correct[T]) }),
    reveal: (res) => s.reveal(ex.answer, res.ok),
    onShow: () => ctxSpk && env.autoplay && ctxSpk.play(),
    onKey: (e) => {
      const i = digitKey(e);
      if (i >= 0) s.choose(i);
      return i >= 0;
    },
  };
}

export { alts, tileText };
