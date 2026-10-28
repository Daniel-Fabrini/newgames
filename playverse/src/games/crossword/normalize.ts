import type { PuzzleLang } from './types';

const BASE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Letters that can appear in answers of each language (Spanish keeps Ñ as a letter of its own). */
export const LETTERS: Record<PuzzleLang, string> = {
  pt: BASE_LETTERS,
  en: BASE_LETTERS,
  es: `${BASE_LETTERS.slice(0, 14)}Ñ${BASE_LETTERS.slice(14)}`,
};

/**
 * Normalises a word to the form used in the grid: uppercase, accents and cedillas removed
 * (Ç → C, Á → A, Ü → U…), anything that is not a letter dropped. In Spanish Ñ is a letter of its
 * own and is kept; in Portuguese and English it becomes N.
 */
export function normalizeAnswer(text: string, lang: PuzzleLang): string {
  const upper = text.normalize('NFC').toUpperCase();
  const strip = (part: string) =>
    part
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '');
  return lang === 'es' ? upper.split('Ñ').map(strip).join('Ñ') : strip(upper);
}

/** Maps a typed key (e.g. "ç", "é", "ñ") to a grid letter of the puzzle language, or null. */
export function normalizeKey(key: string, lang: PuzzleLang): string | null {
  const nfc = key.normalize('NFC');
  if ([...nfc].length !== 1) return null;
  const letter = normalizeAnswer(nfc, lang);
  return letter.length === 1 && LETTERS[lang].includes(letter) ? letter : null;
}

/** True when every character of `answer` is an allowed letter of the language. */
export function isValidAnswer(answer: string, lang: PuzzleLang): boolean {
  if (answer.length === 0) return false;
  for (const ch of answer) if (!LETTERS[lang].includes(ch)) return false;
  return true;
}
