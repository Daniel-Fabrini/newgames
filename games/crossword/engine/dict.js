// Dictionary helpers shared by the runtime generator (browser / worker) and the
// build scripts (Node). A dictionary source is plain text, one entry per line:
//   PALAVRA | clue | alternative clue ...
// "@1", "@2", "@3" lines open a tier section (1 = everyday words, 3 = hardest).
// The same word may appear in several sections; its clues are merged and each
// clue keeps the tier of the section it was written in.

export const ALPHABETS = {
  pt: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  es: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ',
};

// Grid form of a word: uppercase, no accents, no spaces/hyphens.
// Ç → C everywhere; Ñ is kept only in Spanish.
export function normWord(word, lang) {
  let s = String(word).trim().toUpperCase();
  if (lang === 'es') s = s.replace(/Ñ/g, '\u0001');
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (lang === 'es') s = s.replace(/\u0001/g, 'Ñ');
  return s.replace(/[^A-ZÑ]/g, '');
}

// Normalizes a single typed character for the given language ('' if not a letter).
export function normKey(ch, lang) {
  const s = normWord(ch, lang);
  return s.length === 1 ? s : '';
}

export function parseDict(text, lang) {
  const map = new Map();
  let tier = 1;
  const lines = String(text).split('\n');
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const m = line.match(/^@(\d)\s*$/);
    if (m) {
      tier = +m[1];
      continue;
    }
    const parts = line.split('|').map((s) => s.trim());
    const display = parts.shift();
    const w = normWord(display, lang);
    const clues = parts.filter(Boolean);
    if (!w || !clues.length) continue;
    let e = map.get(w);
    if (!e) {
      e = { w, display, tier, clues: [], line: n + 1 };
      map.set(w, e);
    }
    e.tier = Math.min(e.tier, tier);
    for (const c of clues) if (!e.clues.some((x) => x.t === c)) e.clues.push({ t: c, tier });
  }
  return [...map.values()];
}
