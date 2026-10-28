import { describe, expect, it } from 'vitest';
import { BANKS, bankIndex } from './bank';
import { GEN_MAX_HEIGHT, GEN_MAX_WIDTH, MAX_WORDS, MIN_WORDS, generateLayout, numberWords } from './layout';
import { PRESETS, generatePuzzle, generatedSeed, loadPuzzle, parsePuzzleId, presetPuzzle, validatePreset } from './puzzles';
import { validatePuzzle, type CheckableWord } from './validate';
import { PUZZLE_LANGS, type Puzzle } from './types';

const signature = (p: Puzzle) =>
  `${p.width}x${p.height}|${p.words
    .map((w) => `${w.dir[0]}${w.row},${w.col}${w.answer}`)
    .sort()
    .join(' ')}`;

describe('presets', () => {
  for (const lang of PUZZLE_LANGS) {
    it(`${lang}: has 5 hand-checked presets that pass the strict validator`, () => {
      expect(PRESETS[lang]).toHaveLength(5);
      PRESETS[lang].forEach((spec) => expect(validatePreset(lang, spec)).toEqual([]));
      for (let n = 1; n <= 5; n++) {
        const p = presetPuzzle(lang, n);
        expect(p?.id).toBe(`${lang}-preset-${n}`);
        expect(p?.words.length).toBeGreaterThanOrEqual(MIN_WORDS);
      }
    });
  }

  it('include Ñ crossings in Spanish', () => {
    const answers = PRESETS.es.flatMap((p) => p.words.map((w) => w.answer));
    expect(answers.some((a) => a.includes('Ñ'))).toBe(true);
  });
});

describe('generated puzzles', () => {
  for (const lang of PUZZLE_LANGS) {
    it(`${lang}: the first 200 grids are valid, within limits and all distinct`, () => {
      const seen = new Set<string>();
      for (let n = 1; n <= 200; n++) {
        const p = generatePuzzle(lang, n);
        expect(p, `${lang}-${n}`).not.toBeNull();
        if (!p) continue;
        expect(p.id).toBe(`${lang}-${n}`);
        expect(validatePuzzle(p, { lang, bank: bankIndex(lang), minWords: MIN_WORDS, maxWords: MAX_WORDS }), p.id).toEqual([]);
        expect(p.width).toBeLessThanOrEqual(GEN_MAX_WIDTH);
        expect(p.height).toBeLessThanOrEqual(GEN_MAX_HEIGHT);
        seen.add(signature(p));
      }
      expect(seen.size).toBe(200);
    });
  }

  it('are deterministic: the same id always gives the same grid', () => {
    for (const id of ['pt-1', 'en-57', 'es-1234']) {
      const ref = parsePuzzleId(id);
      expect(ref?.kind).toBe('generated');
      if (!ref) continue;
      expect(generatePuzzle(ref.lang, ref.n)).toEqual(generatePuzzle(ref.lang, ref.n));
    }
    const answers = BANKS.en.map((e) => e.answer);
    expect(generateLayout(answers, 42)).toEqual(generateLayout(answers, 42));
    expect(generateLayout(answers, 42)).not.toEqual(generateLayout(answers, 43));
  });

  it('derive the seed from the language and the number', () => {
    expect(generatedSeed('pt', 1)).not.toBe(generatedSeed('en', 1));
    expect(generatedSeed('pt', 1)).not.toBe(generatedSeed('pt', 2));
    expect(signature(generatePuzzle('pt', 1) as Puzzle)).not.toBe(signature(generatePuzzle('pt', 2) as Puzzle));
  });

  it('respect custom size limits', () => {
    const layout = generateLayout(
      BANKS.pt.map((e) => e.answer),
      7,
      { maxWidth: 8, maxHeight: 8, maxWords: 10 },
    );
    expect(layout).not.toBeNull();
    expect(layout?.width).toBeLessThanOrEqual(8);
    expect(layout?.height).toBeLessThanOrEqual(8);
    expect(layout?.words.length).toBeLessThanOrEqual(10);
  });
});

describe('puzzle ids', () => {
  it('parses preset and generated ids', () => {
    expect(parsePuzzleId('pt-preset-1')).toEqual({ lang: 'pt', kind: 'preset', n: 1 });
    expect(parsePuzzleId('es-42')).toEqual({ lang: 'es', kind: 'generated', n: 42 });
    expect(parsePuzzleId('en-preset-6')).toBeNull();
    expect(parsePuzzleId('fr-1')).toBeNull();
    expect(parsePuzzleId('pt-0')).toBeNull();
    expect(parsePuzzleId('pt-01')).toBeNull();
    expect(parsePuzzleId('pt-preset-x')).toBeNull();
  });

  it('loads puzzles by id and caches them', () => {
    const a = loadPuzzle('en-preset-2');
    expect(a?.lang).toBe('en');
    expect(loadPuzzle('en-preset-2')).toBe(a);
    expect(loadPuzzle('es-9')?.kind).toBe('generated');
    expect(loadPuzzle('nonsense')).toBeNull();
  });
});

// A small, valid hand-made grid used as the base for the rejection tests:
//   C A S A
//   . . O .
//   . . L U A
const base = (): CheckableWord[] => [
  { number: 1, dir: 'across', row: 0, col: 0, answer: 'CASA' },
  { number: 2, dir: 'down', row: 0, col: 2, answer: 'SOL' },
  { number: 3, dir: 'across', row: 2, col: 2, answer: 'LUA' },
];
const check = (words: CheckableWord[], width = 5, height = 3, extra = {}) => validatePuzzle({ width, height, words }, { lang: 'pt', ...extra });

describe('validator', () => {
  it('accepts a correct small grid', () => {
    expect(check(base())).toEqual([]);
    expect(check(base(), 5, 3, { rows: ['CASA.', '..O..', '..LUA'] })).toEqual([]);
  });

  it('rejects mismatched crossings', () => {
    const words = base();
    words[1] = { ...words[1]!, answer: 'MOL' };
    expect(check(words).join()).toMatch(/crossing mismatch/);
  });

  it('rejects words running side by side', () => {
    // RIO under CASA, touching it in parallel.
    const words = [...base(), { number: 4, dir: 'across' as const, row: 1, col: 3, answer: 'RIO' }];
    const errors = check(words, 6, 3);
    expect(errors.join()).toMatch(/illegal adjacency|touches/);
  });

  it('rejects a word touching the end of another', () => {
    // MAR starts right after CASA on the same row: "CASAMAR" is not a listed word.
    const words = [...base(), { number: 4, dir: 'across' as const, row: 0, col: 4, answer: 'MAR' }];
    expect(check(words, 7, 3).join()).toMatch(/illegal adjacency|touches/);
  });

  it('rejects bad numbering', () => {
    const words = base();
    words[2] = { ...words[2]!, number: 5 };
    expect(check(words).join()).toMatch(/expected number 3/);
    const swapped = base().map((w) => ({ ...w, number: w.number === 1 ? 2 : w.number === 2 ? 1 : 3 }));
    expect(check(swapped).join()).toMatch(/expected number/);
  });

  it('rejects disconnected grids and words that cross nothing', () => {
    const words = [...base(), { number: 4, dir: 'down' as const, row: 0, col: 6, answer: 'MAR' }];
    const errors = check(words, 7, 3);
    expect(errors.join()).toMatch(/does not cross/);
    expect(errors.join()).toMatch(/not connected/);
  });

  it('rejects words outside the grid, oversize grids and invalid letters', () => {
    expect(check(base(), 4, 3).join()).toMatch(/outside/);
    expect(validatePuzzle({ width: 12, height: 5, words: base() }, { lang: 'pt' })).toEqual(['invalid size 12×5']);
    const words = base();
    words[0] = { ...words[0]!, answer: 'CAÑA' };
    expect(check(words).join()).toMatch(/invalid letters/);
  });

  it('rejects empty margins and repeated answers', () => {
    expect(check(base(), 5, 4).join()).toMatch(/row 3 is empty/);
    const words = [...base(), { number: 4, dir: 'down' as const, row: 0, col: 0, answer: 'CASA' }];
    expect(check(words, 5, 4).join()).toMatch(/repeated answer/);
  });

  it('rejects answers that are not in the bank or have a different clue', () => {
    const bank = bankIndex('pt');
    const words = base().map((w) => ({ ...w, clue: bank.get(w.answer)?.clue }));
    expect(check(words, 5, 3, { bank })).toEqual([]);
    words[0] = { ...words[0]!, clue: 'Outra pista' };
    expect(check(words, 5, 3, { bank }).join()).toMatch(/clue does not match/);
    words[1] = { ...words[1]!, answer: 'SOX' };
    words[2] = { ...words[2]!, answer: 'XUA' };
    expect(check(words, 5, 3, { bank }).join()).toMatch(/not in the word bank/);
  });

  it('rejects a drawing that does not match the words (squares that belong to no word)', () => {
    expect(check(base(), 5, 3, { rows: ['CASA.', '..O.X', '..LUA'] }).join()).toMatch(/square 1,4 belongs to no word/);
    expect(check(base(), 5, 3, { rows: ['CASA', '..O.', '..LU'] }).join()).toMatch(/drawing does not match/);
  });

  it('rejects too few words when a minimum is required', () => {
    expect(check(base(), 5, 3, { minWords: MIN_WORDS }).join()).toMatch(/too few words/);
  });

  it('numbers start squares in reading order', () => {
    expect(numberWords(base())).toEqual([1, 2, 3]);
    expect(
      numberWords([
        { row: 0, col: 3 },
        { row: 0, col: 0 },
        { row: 0, col: 0 },
      ]),
    ).toEqual([2, 1, 1]);
  });
});
