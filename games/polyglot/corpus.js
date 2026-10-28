// Pure text helpers shared by the engine and by tools/validate.mjs (no DOM here).
// Content conventions are documented in CONTENT.md.

import { norm } from '../../js/core/ui.js';

export const LANGS6 = ['en', 'es', 'pt', 'fr', 'it', 'de'];
export const UI_LANGS = ['pt', 'en', 'es'];
export const TTS = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT', de: 'de-DE' };
export const FLAG = { en: 'gb', es: 'es', pt: 'br', fr: 'fr', it: 'it', de: 'de' };

// "a|b|c" → ['a', 'b', 'c']; the first entry is the main form.
export function alts(v) {
  return String(v == null ? '' : v)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}
export function primary(v) {
  return alts(v)[0] || '';
}

// French typography: thin no-break space before ? ! : ; when shown on screen.
export function display(text, lang) {
  const s = String(text);
  return lang === 'fr' ? s.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ') : s;
}

const EN_CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'],
  [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\b(he|she|it|that|what|where|who|there|here|how)'s\b/g, '$1 is'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\b(i|you|we|they|he|she|it|that)'ll\b/g, '$1 will'],
  [/\b(i|you|we|they|he|she)'d\b/g, '$1 would'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'],
  [/\blet's\b/g, 'let us'],
];

// Comparison key: lowercase, no accents/punctuation, ß→ss, œ→oe, English contractions expanded.
export function canon(s, lang) {
  let x = String(s)
    .replace(/[’‘ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
  if (lang === 'en') for (const [re, rep] of EN_CONTRACTIONS) x = x.replace(re, rep);
  return norm(x);
}

// Like canon but keeps accents (used to warn "pay attention to the accents").
export function accentKey(s) {
  return String(s)
    .replace(/[’‘ʼ`´']/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Splits a sentence into word tokens. Punctuation around words is dropped,
// apostrophes and hyphens inside words are kept ("I'm", "l'eau", "vas-tu").
// `initial` marks words that start a sentence (their capital letter is not meaningful).
export function tokenize(s) {
  const raw = String(s).trim().split(/\s+/);
  const out = [];
  let initial = true;
  for (const r of raw) {
    const opener = /^[¿¡]/.test(r);
    const text = r.replace(/^[¿¡"“”«(\-–—]+/, '').replace(/[.,!?;:"“”»)…]+$/, '');
    if (text) out.push({ text, initial: initial || opener });
    if (/[.!?…]["”»)]*$/.test(r)) initial = true;
    else if (text) initial = false;
  }
  return out;
}
export const words = (s) => tokenize(s).map((x) => x.text);

const ARTICLES = {
  en: /^(the|a|an|to) /i,
  es: /^(el|la|los|las|un|una) /i,
  pt: /^(o|a|os|as|um|uma) /i,
  fr: /^((le|la|les|un|une|des) |l')/i,
  it: /^((il|lo|la|i|gli|le|un|uno|una) |l'|un')/i,
  de: /^(der|die|das|ein|eine) /i,
};
// "la pomme" → "pomme", "to eat" → "eat"
export function bare(w, lang) {
  return String(w).replace(ARTICLES[lang], '').trim();
}

// ---------- per-language token knowledge, built from the loaded units ----------
export function buildLexicon(units) {
  const keep = {}; // words whose capital letter must be kept on tiles (names, German nouns, "I")
  const vocab = {}; // every known word (canon) — used to tell typos from wrong words
  for (const l of LANGS6) {
    keep[l] = new Set();
    vocab[l] = new Set();
  }
  const scanSentence = (v, l, asLexicon) => {
    for (const a of alts(v)) {
      for (const tok of tokenize(a)) {
        vocab[l].add(canon(tok.text, l));
        if ((asLexicon || !tok.initial) && /^\p{Lu}/u.test(tok.text)) keep[l].add(tok.text);
      }
    }
  };
  for (const u of units) {
    for (const w of u.words || []) for (const l of LANGS6) scanSentence(w[l], l, true);
    for (const s of allSentenceLike(u)) for (const l of LANGS6) scanSentence(s[l], l, false);
  }
  return { keep, vocab };
}

// Every 6-language sentence-like entry of a unit (sentences + story lines + reply options).
export function allSentenceLike(u) {
  const out = [...(u.sentences || [])];
  for (const st of u.stories || []) {
    for (const it of st.lines || []) {
      if (it.reply) out.push(...it.reply);
      else if (it.who && !it.ask) out.push(it);
    }
  }
  return out;
}

export function lowerFirst(s) {
  return s ? s[0].toLocaleLowerCase() + s.slice(1) : s;
}

// Text shown on a word tile.
export function tileText(tok, lang, lex) {
  if (!tok.initial) return tok.text;
  if (lang === 'en' && /^I($|')/.test(tok.text)) return tok.text;
  if (lex && lex.keep[lang].has(tok.text)) return tok.text;
  return lowerFirst(tok.text);
}

// Answer checking for typed text. Returns { ok, almost, accent, match }.
export function checkTyped(input, answers, lang, lex) {
  const ci = canon(input, lang);
  if (!ci) return { ok: false, match: answers[0] };
  const cis = ci.replace(/ /g, '');
  let best = null;
  let bestD = 99;
  for (const a of answers) {
    const ca = canon(a, lang);
    if (ca === ci || ca.replace(/ /g, '') === cis) {
      const accent = lang !== 'en' && accentKey(input) !== accentKey(a);
      return { ok: true, accent, match: a };
    }
    const d = lev(ci, ca);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  if (best && bestD === 1 && canon(best, lang).length >= 4) {
    // A one-letter slip is a typo — unless the typed word is another real word.
    const tw = ci.split(' ');
    const bw = canon(best, lang).split(' ');
    let realWord = false;
    if (tw.length === bw.length) {
      const diff = tw.filter((w, i) => w !== bw[i]);
      realWord = diff.length === 1 && lex && lex.vocab[lang].has(diff[0]) && diff[0].length > 1;
    }
    if (!realWord) return { ok: true, almost: true, match: best };
  }
  return { ok: false, match: answers[0] };
}

// Tile answers: exact (normalized) match against any accepted alternative.
export function checkTiles(tiles, answers, lang) {
  const c = canon(tiles.join(' '), lang);
  const cs = c.replace(/ /g, '');
  for (const a of answers) {
    const ca = canon(a, lang);
    if (ca === c || ca.replace(/ /g, '') === cs) return { ok: true, match: a };
  }
  return { ok: false, match: answers[0] };
}

// Speech recognition is fuzzier: accept when most words were heard.
export function checkSpoken(transcripts, answers, lang) {
  let bestScore = 0;
  for (const tr of transcripts) {
    const heard = canon(tr, lang).split(' ').filter(Boolean);
    for (const a of answers) {
      const want = canon(a, lang).split(' ').filter(Boolean);
      if (!want.length) continue;
      const pool = heard.slice();
      let hit = 0;
      for (const w of want) {
        const i = pool.findIndex((x) => x === w || (w.length > 3 && lev(x, w) <= 1));
        if (i >= 0) {
          hit++;
          pool.splice(i, 1);
        }
      }
      bestScore = Math.max(bestScore, hit / want.length);
    }
  }
  return { ok: bestScore >= 0.75, score: bestScore };
}
