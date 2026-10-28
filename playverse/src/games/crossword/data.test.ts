import { describe, expect, it } from 'vitest';
import { BANKS, bankIndex } from './bank';
import { MAX_LEN, MIN_LEN } from './layout';
import { LETTERS, isValidAnswer, normalizeAnswer, normalizeKey } from './normalize';
import { PUZZLE_LANGS } from './types';

describe('normalisation', () => {
  it('removes Portuguese accents and turns Ç into C', () => {
    expect(normalizeAnswer('coração', 'pt')).toBe('CORACAO');
    expect(normalizeAnswer('açúcar', 'pt')).toBe('ACUCAR');
    expect(normalizeAnswer('avô', 'pt')).toBe('AVO');
    expect(normalizeAnswer('pássaro', 'pt')).toBe('PASSARO');
    expect(normalizeAnswer('mãe', 'pt')).toBe('MAE');
  });

  it('keeps Ñ in Spanish but removes the other accents', () => {
    expect(normalizeAnswer('montaña', 'es')).toBe('MONTAÑA');
    expect(normalizeAnswer('España', 'es')).toBe('ESPAÑA');
    expect(normalizeAnswer('corazón', 'es')).toBe('CORAZON');
    expect(normalizeAnswer('pingüino', 'es')).toBe('PINGUINO');
    // Decomposed input (n + combining tilde) is handled too.
    expect(normalizeAnswer('año', 'es')).toBe('AÑO');
  });

  it('turns Ñ into N outside Spanish and drops spaces, hyphens and apostrophes', () => {
    expect(normalizeAnswer('piñata', 'en')).toBe('PINATA');
    expect(normalizeAnswer('ice-cream', 'en')).toBe('ICECREAM');
    expect(normalizeAnswer("o'clock", 'en')).toBe('OCLOCK');
    expect(normalizeAnswer('guarda chuva', 'pt')).toBe('GUARDACHUVA');
  });

  it('maps typed keys to letters of the puzzle language', () => {
    expect(normalizeKey('a', 'en')).toBe('A');
    expect(normalizeKey('ç', 'pt')).toBe('C');
    expect(normalizeKey('é', 'pt')).toBe('E');
    expect(normalizeKey('ñ', 'es')).toBe('Ñ');
    expect(normalizeKey('Ñ', 'pt')).toBe('N');
    expect(normalizeKey('1', 'en')).toBeNull();
    expect(normalizeKey('Enter', 'en')).toBeNull();
    expect(normalizeKey(' ', 'en')).toBeNull();
  });

  it('accepts only the alphabet of each language', () => {
    expect(isValidAnswer('MONTAÑA', 'es')).toBe(true);
    expect(isValidAnswer('MONTAÑA', 'pt')).toBe(false);
    expect(isValidAnswer('CASA1', 'pt')).toBe(false);
    expect(isValidAnswer('', 'en')).toBe(false);
    expect(LETTERS.es).toHaveLength(27);
    expect(LETTERS.en).toHaveLength(26);
  });
});

describe('word banks', () => {
  for (const lang of PUZZLE_LANGS) {
    describe(lang, () => {
      const bank = BANKS[lang];

      it('has at least 150 entries', () => {
        expect(bank.length).toBeGreaterThanOrEqual(150);
      });

      it('has no duplicated answers', () => {
        const answers = bank.map((e) => e.answer);
        expect(new Set(answers).size).toBe(answers.length);
        expect(bankIndex(lang).size).toBe(answers.length);
      });

      it('has answers of 3 to 9 allowed letters derived from the display form', () => {
        for (const e of bank) {
          expect(e.answer.length, e.answer).toBeGreaterThanOrEqual(MIN_LEN);
          expect(e.answer.length, e.answer).toBeLessThanOrEqual(MAX_LEN);
          expect(isValidAnswer(e.answer, lang), e.answer).toBe(true);
          expect(e.answer).toBe(normalizeAnswer(e.display, lang));
        }
      });

      it('has a real clue for every word, which never contains the answer itself', () => {
        const clues = new Set<string>();
        for (const e of bank) {
          expect(e.clue.trim().length, e.answer).toBeGreaterThan(5);
          expect(normalizeAnswer(e.clue, lang).includes(e.answer) && e.answer.length > 3, `${e.answer}: ${e.clue}`).toBe(false);
          clues.add(e.clue);
        }
        expect(clues.size).toBe(bank.length);
      });

      it('covers a variety of lengths', () => {
        const lengths = new Set(bank.map((e) => e.answer.length));
        for (let n = MIN_LEN; n <= MAX_LEN; n++) expect(lengths.has(n), `length ${n}`).toBe(true);
      });
    });
  }

  it('uses Ñ in some Spanish answers', () => {
    expect(BANKS.es.filter((e) => e.answer.includes('Ñ')).length).toBeGreaterThanOrEqual(8);
  });

  it('is written natively per language rather than translated word for word', () => {
    const pt = new Set(BANKS.pt.map((e) => e.answer));
    const en = new Set(BANKS.en.map((e) => e.answer));
    const sharedPtEn = [...en].filter((a) => pt.has(a)).length;
    expect(sharedPtEn / en.size).toBeLessThan(0.15);
  });
});
