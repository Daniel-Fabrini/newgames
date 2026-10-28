// Lesson generator: turns loaded unit content into lists of exercises.
// Pure module (no DOM). Exercise descriptors are rendered by exercises.js.

import { shuffle } from '../../js/core/ui.js';
import { alts, primary, tokenize, tileText, canon, bare, segments } from './corpus.js';

// Node layout of every unit on the path.
export const UNIT_NODES = ['words', 'words', 'chest', 'words', 'sentences', 'story', 'sentences2', 'review'];
export const NODES_PER_UNIT = UNIT_NODES.length;
const WORD_CHUNK = { 0: 0, 1: 1, 3: 2 };
const SENT_GROUP = { 0: 0, 1: 1, 3: 2, 4: 3, 6: 4 };
export const nodeChunk = (k) => WORD_CHUNK[k];

const pickN = (arr, n, rnd) => shuffle(arr, rnd).slice(0, n);

export function wordChunks(n) {
  const a = Math.ceil(n / 3);
  const b = a + Math.ceil((n - a) / 2);
  return [
    [0, a],
    [a, b],
    [b, n],
  ];
}
function groups(n, k) {
  const out = [];
  let start = 0;
  for (let g = 0; g < k; g++) {
    const size = Math.floor(n / k) + (g < n % k ? 1 : 0);
    out.push([start, start + size]);
    start += size;
  }
  return out;
}
export function chunkWordIndexes(unit, chunk) {
  const [a, b] = wordChunks(unit.words.length)[chunk];
  return Array.from({ length: b - a }, (_, i) => a + i);
}

const wref = (u, i) => ({ u: u.id, k: 'w', i, item: u.words[i] });
const sref = (u, i) => ({ u: u.id, k: 's', i, item: u.sentences[i] });

// Reply items of the unit's stories, with the line spoken right before them as context.
export function replyRefs(u) {
  const out = [];
  (u.stories || []).forEach((st, si) => {
    let prev = null;
    st.lines.forEach((it, li) => {
      if (it.ask) return;
      if (it.reply) {
        out.push({ u: u.id, k: 'r', i: `${si}.${li}`, item: it, story: st, prev });
        prev = { who: it.who, line: it.reply[it.answer] };
      } else prev = { who: it.who, line: it };
    });
  });
  return out;
}

export function createGenerator({ T, N, lex, can, rnd = Math.random }) {
  const poolCache = new Map();
  // Word tiles of every sentence of a unit, for distractors.
  function tokenPool(u, lang) {
    const key = u.id + lang;
    if (!poolCache.has(key)) {
      const m = new Map();
      for (const s of u.sentences) for (const tok of tokenize(primary(s[lang]))) {
        const txt = tileText(tok, lang, lex);
        const c = canon(txt, lang);
        if (c && !m.has(c)) m.set(c, txt);
      }
      for (const w of u.words) {
        const p = primary(w[lang]);
        if (tokenize(p).length === 1) {
          const c = canon(p, lang);
          if (c && !m.has(c)) m.set(c, p);
        }
      }
      poolCache.set(key, [...m.values()]);
    }
    return poolCache.get(key);
  }

  function distractorTiles(answerItem, lang, n, units) {
    const exclude = new Set();
    for (const a of alts(answerItem[lang])) for (const tok of tokenize(a)) exclude.add(canon(tok.text, lang));
    const out = [];
    const seen = new Set();
    for (const u of units) {
      for (const txt of shuffle(tokenPool(u, lang), rnd)) {
        const c = canon(txt, lang);
        if (!c || exclude.has(c) || seen.has(c)) continue;
        seen.add(c);
        out.push(txt);
        if (out.length >= n) return out;
      }
    }
    return out;
  }

  // ---------- word exercises ----------
  const tKey = (w) => canon(primary(w.item[T]), T);
  const nKey = (w) => canon(primary(w.item[N]), N);
  function distinctFrom(base, pool, n, needEmoji) {
    const used = new Set(base.map(tKey));
    const usedN = new Set(base.map(nKey));
    const usedE = new Set(base.map((w) => w.item.e));
    const out = [];
    for (const w of shuffle(pool, rnd)) {
      if (needEmoji && (!w.item.e || usedE.has(w.item.e))) continue;
      if (used.has(tKey(w)) || usedN.has(nKey(w))) continue;
      used.add(tKey(w));
      usedN.add(nKey(w));
      if (w.item.e) usedE.add(w.item.e);
      out.push(w);
      if (out.length >= n) break;
    }
    return out;
  }
  function choose(w, pool, dir, isNew) {
    const others = distinctFrom([w], pool, 2, false);
    if (others.length < 2) return null;
    const options = shuffle([w, ...others], rnd);
    return { type: 'choose', dir, ref: w, options, answer: options.indexOf(w), isNew };
  }
  function pick(w, pool, isNew) {
    if (w.item.e) {
      const others = distinctFrom([w], pool, 3, true);
      if (others.length >= 2) {
        const options = shuffle([w, ...others], rnd);
        return { type: 'pick', ref: w, options, answer: options.indexOf(w), isNew };
      }
    }
    return choose(w, pool, 'NT', isNew);
  }
  function match(ws, pool) {
    const base = [];
    for (const w of shuffle(ws, rnd)) {
      if (base.some((b) => tKey(b) === tKey(w) || nKey(b) === nKey(w))) continue;
      base.push(w);
      if (base.length >= 5) break;
    }
    if (base.length < 5) base.push(...distinctFrom(base, pool, 5 - base.length, false));
    if (base.length < 3) return null;
    return { type: 'match', ref: base[0], pairs: base };
  }
  function typeWord(w) {
    const answers = [];
    for (const a of alts(w.item[T])) {
      answers.push(a);
      const b = bare(a, T);
      if (b !== a) answers.push(b);
    }
    return { type: 'type', dir: 'NT', ref: w, prompt: primary(w.item[N]), answers, lang: T, word: true };
  }

  // ---------- sentence exercises ----------
  function tiles(dir, s, units) {
    const lang = dir === 'TN' ? N : T;
    const toks = tokenize(primary(s.item[lang])).map((tok) => tileText(tok, lang, lex));
    const nd = toks.length <= 4 ? 4 : toks.length <= 7 ? 3 : 2;
    const extra = distractorTiles(s.item, lang, nd, units);
    return { type: 'tiles', dir, ref: s, lang, tiles: shuffle([...toks, ...extra], rnd), answers: alts(s.item[lang]) };
  }
  function listen(mode, s, units) {
    const ex = tiles('NT', s, units);
    return { ...ex, type: 'listen', mode };
  }
  // Fill in the blank: hide one content word of the target sentence.
  function fill(s, units) {
    const text = primary(s.item[T]);
    const segs = segments(text);
    const lexBare = new Map(); // canon → word ref
    for (const u of units) u.words.forEach((w, i) => {
      for (const a of alts(w[T])) {
        const b = bare(a, T);
        if (tokenize(b).length === 1) {
          const c = canon(b, T);
          if (!lexBare.has(c)) lexBare.set(c, { u, i, text: b });
        }
      }
    });
    const counts = new Map();
    segs.forEach((g) => counts.set(canon(g.word, T), (counts.get(canon(g.word, T)) || 0) + 1));
    let cands = segs
      .map((g, i) => ({ i, c: canon(g.word, T), len: g.word.length }))
      .filter((x) => x.c && counts.get(x.c) === 1 && lexBare.has(x.c) && x.len >= 2);
    if (!cands.length) cands = segs.map((g, i) => ({ i, c: canon(g.word, T), len: g.word.length })).filter((x) => x.len >= 4 && counts.get(x.c) === 1);
    if (!cands.length) return null;
    cands.sort((a, b) => b.len - a.len);
    const blank = cands[Math.floor(rnd() * Math.min(2, cands.length))];
    const exclude = new Set();
    for (const a of alts(s.item[T])) for (const tok of tokenize(a)) exclude.add(canon(tok.text, T));
    // synonyms of the answer word are not wrong options either
    for (const u of units) for (const w of u.words) {
      const forms = alts(w[T]).map((a) => canon(bare(a, T), T));
      if (forms.includes(blank.c)) forms.forEach((f) => exclude.add(f));
    }
    const answerText = tileText({ text: segs[blank.i].word, initial: segs[blank.i].initial }, T, lex);
    const opts = [];
    const own = [...lexBare.values()].filter((x) => x.u.id === s.u);
    const rest = [...lexBare.values()].filter((x) => x.u.id !== s.u);
    for (const x of [...shuffle(own, rnd), ...shuffle(rest, rnd)]) {
      const c = canon(x.text, T);
      if (exclude.has(c) || opts.some((o) => canon(o, T) === c)) continue;
      opts.push(x.text);
      if (opts.length >= 2) break;
    }
    if (opts.length < 2) return null;
    const options = shuffle([answerText, ...opts], rnd);
    return { type: 'fill', ref: s, segs, blank: blank.i, options, answer: options.indexOf(answerText) };
  }
  function type(dir, s) {
    const lang = dir === 'TN' ? N : T;
    const plang = dir === 'TN' ? T : N;
    return { type: 'type', dir, ref: s, prompt: primary(s.item[plang]), answers: alts(s.item[lang]), lang };
  }
  function speak(s) {
    return { type: 'speak', ref: s, text: primary(s.item[T]), answers: alts(s.item[T]) };
  }
  function reply(r) {
    const options = shuffle(r.item.reply.map((o, j) => ({ o, ok: j === r.item.answer })), rnd);
    return {
      type: 'reply',
      ref: r,
      context: r.prev,
      cast: r.story.cast,
      who: r.item.who,
      options: options.map((x) => x.o),
      answer: options.findIndex((x) => x.ok),
    };
  }

  // Builds one sentence exercise of the requested kind (with graceful fallbacks).
  function sentenceEx(kind, s, units) {
    let ex = null;
    if (kind === 'listenTiles' && can.listen) ex = listen('tiles', s, units);
    else if (kind === 'listenType' && can.listen) ex = listen('type', s, units);
    else if (kind === 'speak' && can.speak) ex = speak(s);
    else if (kind === 'fill') ex = fill(s, units);
    else if (kind === 'typeTN') ex = type('TN', s);
    else if (kind === 'typeNT') ex = type('NT', s);
    else if (kind === 'tilesNT') ex = tiles('NT', s, units);
    if (!ex) ex = kind === 'listenType' || kind === 'typeNT' ? type('TN', s) : tiles(kind === 'tilesNT' || kind === 'speak' ? 'NT' : 'TN', s, units);
    return ex;
  }
  function sentenceRun(kinds, sents, units) {
    return kinds.map((k, j) => sentenceEx(k, sents[j % sents.length], units));
  }

  const L = () => (can.listen ? 'listenTiles' : 'fill');
  const LT = () => (can.listen ? 'listenType' : 'typeTN');
  const SP = () => (can.speak ? 'speak' : 'tilesNT');

  // ---------- public recipes ----------
  // unit: loaded unit; prev: loaded earlier units (most recent first) for distractors/review
  function lesson(kindName, unit, k, prev = []) {
    const units = [unit, ...prev];
    const unitWords = unit.words.map((_, i) => wref(unit, i));
    const pool = [...unitWords, ...prev.slice(0, 3).flatMap((u) => u.words.map((_, i) => wref(u, i)))];
    const sg = groups(unit.sentences.length, 5);
    const group = (g) => {
      const [a, b] = sg[g];
      return Array.from({ length: b - a }, (_, i) => sref(unit, a + i));
    };
    const allS = unit.sentences.map((_, i) => sref(unit, i));
    const out = [];

    if (kindName === 'words') {
      const c = nodeChunk(k);
      const nw = chunkWordIndexes(unit, c).map((i) => unitWords[i]);
      nw.forEach((w, j) => out.push(j % 3 === 2 && !w.item.e ? choose(w, pool, 'TN', true) : pick(w, pool, true)));
      const m = match(nw, unitWords);
      if (m) out.push(m);
      let ss = group(SENT_GROUP[k]);
      if (ss.length < 2) ss = ss.concat(pickN(allS, 2, rnd));
      out.push(...sentenceRun(['tilesTN', L(), 'fill', 'tilesNT', SP(), 'typeTN'], ss, units));
    } else if (kindName === 'sentences') {
      const ss = [...shuffle(group(3), rnd), ...pickN(allS, 8, rnd)];
      out.push(match(pickN(unitWords, 6, rnd), unitWords));
      out.push(...sentenceRun(['tilesTN', 'tilesNT', L(), 'fill', 'typeTN', SP(), 'tilesNT', LT(), 'fill', 'typeNT'], ss, units));
    } else if (kindName === 'sentences2') {
      const ss = [...shuffle(group(4), rnd), ...pickN(allS, 8, rnd)];
      const reps = replyRefs(unit);
      reps.slice(0, 2).forEach((r) => out.push(reply(r)));
      out.push(...sentenceRun(['tilesNT', 'typeNT', LT(), SP(), 'fill', 'tilesTN', L(), 'typeNT', 'tilesNT'], ss, units));
      out.push(choose(pickN(unitWords, 1, rnd)[0], pool, 'TN', false));
    } else if (kindName === 'review') {
      const older = prev.slice(0, 4);
      const ss = [...pickN(allS, 8, rnd), ...older.flatMap((u) => pickN(u.sentences.map((_, i) => sref(u, i)), 1, rnd))];
      const ssh = shuffle(ss, rnd);
      out.push(match(pickN(unitWords, 6, rnd), unitWords));
      const reps = replyRefs(unit);
      if (reps.length) out.push(reply(pickN(reps, 1, rnd)[0]));
      out.push(...sentenceRun(['tilesNT', 'typeNT', LT(), 'fill', SP(), 'tilesNT', 'typeTN', L(), 'typeNT', 'tilesNT', 'fill'], ssh, units));
      if (older.length) out.push(pick(wref(older[0], Math.floor(rnd() * older[0].words.length)), older[0].words.map((_, i) => wref(older[0], i)), false));
    }
    return out.filter(Boolean);
  }

  // Section checkpoint / placement test: hard mix across many units.
  function legend(units, count = 16) {
    const ss = shuffle(units.flatMap((u) => u.sentences.map((_, i) => sref(u, i))), rnd).slice(0, count);
    const out = [];
    const reps = shuffle(units.flatMap((u) => replyRefs(u)), rnd);
    if (reps.length) out.push(reply(reps[0]));
    out.push(...sentenceRun(['typeNT', LT(), 'tilesNT', SP(), 'typeTN', 'fill', 'tilesNT', 'typeNT', L(), 'tilesTN', 'typeNT', 'fill', LT(), 'tilesNT', 'typeNT'], ss, units));
    return shuffle(out.filter(Boolean), rnd).slice(0, count);
  }

  // Practice. mode: mix | words | listen | speak | mistakes ; weak: word refs {u,i}; mistakes: refs
  function practice(mode, units, { weak = [], mistakes = [] } = {}) {
    if (!units.length) return [];
    const byId = new Map(units.map((u) => [u.id, u]));
    const allW = units.flatMap((u) => u.words.map((_, i) => wref(u, i)));
    const weakW = weak.map((r) => byId.get(r.u) && byId.get(r.u).words[r.i] && wref(byId.get(r.u), r.i)).filter(Boolean);
    const allS = units.flatMap((u) => u.sentences.map((_, i) => sref(u, i)));
    const out = [];
    if (mode === 'words') {
      const ws = weakW.length >= 5 ? weakW : [...weakW, ...pickN(allW, 10, rnd)];
      out.push(match(ws.slice(0, 5), allW), match(ws.slice(5, 10).length >= 3 ? ws.slice(5, 10) : pickN(allW, 5, rnd), allW));
      ws.slice(0, 8).forEach((w, j) => out.push(j % 3 === 0 ? typeWord(w) : j % 3 === 1 ? pick(w, allW, false) : choose(w, allW, j % 2 ? 'TN' : 'NT', false)));
    } else if (mode === 'listen') {
      pickN(allS, 10, rnd).forEach((s, j) => out.push(sentenceEx(j % 2 ? 'listenType' : 'listenTiles', s, units)));
    } else if (mode === 'speak') {
      pickN(allS, 8, rnd).forEach((s) => out.push(sentenceEx('speak', s, units)));
    } else if (mode === 'mistakes') {
      for (const r of mistakes.slice(0, 12)) {
        const u = byId.get(r.u);
        if (!u) continue;
        if (r.k === 'w' && u.words[r.i]) {
          const w = wref(u, r.i);
          out.push(rnd() < 0.5 ? typeWord(w) : pick(w, allW, false));
        } else if (r.k === 's' && u.sentences[r.i]) {
          out.push(sentenceEx(shuffle(['tilesNT', 'typeTN', 'fill', 'tilesTN', L()], rnd)[0], sref(u, r.i), units));
        }
      }
    } else {
      const ws = weakW.length ? weakW : pickN(allW, 6, rnd);
      out.push(match(ws.slice(0, 5).length >= 3 ? ws.slice(0, 5) : pickN(allW, 5, rnd), allW));
      ws.slice(0, 3).forEach((w, j) => out.push(j === 0 ? typeWord(w) : choose(w, allW, j === 1 ? 'NT' : 'TN', false)));
      const reps = shuffle(units.flatMap((u) => replyRefs(u)), rnd);
      if (reps.length) out.push(reply(reps[0]));
      out.push(...sentenceRun(shuffle(['tilesNT', 'tilesTN', 'fill', 'typeTN', L(), SP(), 'typeNT', LT()], rnd), pickN(allS, 8, rnd), units));
    }
    return out.filter(Boolean);
  }

  // A fresh copy of an exercise (for "repeat your mistakes at the end").
  function again(ex, units) {
    const s = ex.ref;
    let fresh = null;
    if (ex.type === 'tiles') fresh = tiles(ex.dir, s, units);
    else if (ex.type === 'listen') fresh = listen(ex.mode, s, units);
    else if (ex.type === 'fill') fresh = fill(s, units) || tiles('TN', s, units);
    else if (ex.type === 'pick' || ex.type === 'choose') fresh = { ...ex, options: shuffle(ex.options, rnd) };
    if (fresh && (ex.type === 'pick' || ex.type === 'choose')) fresh.answer = fresh.options.indexOf(ex.options[ex.answer]);
    if (ex.type === 'reply') {
      const options = shuffle(ex.options.map((o, j) => ({ o, ok: j === ex.answer })), rnd);
      fresh = { ...ex, options: options.map((x) => x.o), answer: options.findIndex((x) => x.ok) };
    }
    return { ...(fresh || ex), retry: true, isNew: false };
  }

  // Lesson types that need listening converted when the learner says "can't listen now".
  function withoutListening(ex, units) {
    if (ex.type !== 'listen') return ex;
    return ex.mode === 'type' ? type('TN', ex.ref) : tiles('NT', ex.ref, units);
  }
  function withoutSpeaking(ex, units) {
    return ex.type === 'speak' ? tiles('NT', ex.ref, units) : ex;
  }

  return { lesson, legend, practice, again, withoutListening, withoutSpeaking, typeWord };
}

// Words of a unit that a sentence/word exercise touches (for spaced repetition).
export function wordsInExercise(ex, unitsById, T) {
  const r = ex.ref;
  if (!r) return [];
  if (ex.type === 'match') return ex.pairs.map((w) => ({ u: w.u, i: w.i }));
  if (r.k === 'w') return [{ u: r.u, i: r.i }];
  if (r.k !== 's') return [];
  const u = unitsById.get(r.u);
  if (!u) return [];
  const toks = new Set(tokenize(primary(r.item[T])).map((x) => canon(x.text, T)));
  const out = [];
  u.words.forEach((w, i) => {
    if (alts(w[T]).some((a) => toks.has(canon(bare(a, T), T)))) out.push({ u: u.id, i });
  });
  return out;
}
