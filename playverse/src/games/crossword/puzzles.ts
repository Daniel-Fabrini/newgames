import { hashString } from '../../utils/random';
import { BANKS, bankIndex } from './bank';
import { enPresets } from './data/presets.en';
import { esPresets } from './data/presets.es';
import { ptPresets } from './data/presets.pt';
import { GEN_MAX_HEIGHT, GEN_MAX_WIDTH, MAX_WORDS, MIN_WORDS, generateLayout, numberWords } from './layout';
import { validatePuzzle } from './validate';
import { PUZZLE_LANGS, type PlacedWord, type PresetSpec, type Puzzle, type PuzzleLang } from './types';

/**
 * Puzzle catalogue.
 * - `<lang>-preset-<n>`: hand-checked starter grids stored as fixed data (data/presets.<lang>.ts).
 * - `<lang>-<n>`: grid number n of the language, built by the deterministic generator from a seed
 *   derived from the language and n, so the sequence is unbounded and identical on every device.
 * Every puzzle passes the strict validator before it is handed to the game.
 */
export const PRESETS: Record<PuzzleLang, readonly PresetSpec[]> = { pt: ptPresets, en: enPresets, es: esPresets };
export const MAX_GENERATED = 9_999_999;

export const presetId = (lang: PuzzleLang, n: number) => `${lang}-preset-${n}`;
export const generatedId = (lang: PuzzleLang, n: number) => `${lang}-${n}`;

export interface PuzzleRef {
  lang: PuzzleLang;
  kind: 'preset' | 'generated';
  n: number;
}

const ID_PATTERN = /^(pt|en|es)-(preset-)?([1-9]\d{0,6})$/;

export function parsePuzzleId(id: string): PuzzleRef | null {
  const match = ID_PATTERN.exec(id);
  if (!match) return null;
  const lang = match[1] as PuzzleLang;
  const n = Number(match[3]);
  if (match[2]) return n <= PRESETS[lang].length ? { lang, kind: 'preset', n } : null;
  return { lang, kind: 'generated', n };
}

export const isPuzzleId = (id: string) => parsePuzzleId(id) !== null;

function sortWords(words: PlacedWord[]): PlacedWord[] {
  return words.sort((a, b) => (a.dir === b.dir ? a.number - b.number : a.dir === 'across' ? -1 : 1));
}

/** Seed of generated grid n (exported for tests). */
export const generatedSeed = (lang: PuzzleLang, n: number, variant = 0) => hashString(`crossword:${lang}:${n}${variant ? `:${variant}` : ''}`);

/** Builds generated grid n; null only if no valid layout exists (never with the shipped banks). */
export function generatePuzzle(lang: PuzzleLang, n: number): Puzzle | null {
  if (!Number.isInteger(n) || n < 1 || n > MAX_GENERATED) return null;
  const index = bankIndex(lang);
  const answers = BANKS[lang].map((e) => e.answer);
  for (let variant = 0; variant < 4; variant++) {
    const layout = generateLayout(answers, generatedSeed(lang, n, variant), { maxWidth: GEN_MAX_WIDTH, maxHeight: GEN_MAX_HEIGHT });
    if (!layout) continue;
    const numbers = numberWords(layout.words);
    const words = sortWords(
      layout.words.map((w, i) => {
        const entry = index.get(w.answer);
        return { ...w, number: numbers[i] ?? 0, clue: entry?.clue ?? '', display: entry?.display ?? w.answer };
      }),
    );
    const puzzle: Puzzle = { id: generatedId(lang, n), lang, kind: 'generated', n, width: layout.width, height: layout.height, words };
    if (validatePuzzle(puzzle, { lang, bank: index, minWords: MIN_WORDS, maxWords: MAX_WORDS }).length === 0) return puzzle;
  }
  return null;
}

/** Validates a preset spec and returns the errors (empty when valid). Exported for tests. */
export function validatePreset(lang: PuzzleLang, spec: PresetSpec): string[] {
  const height = spec.rows.length;
  const width = height > 0 ? Math.max(...spec.rows.map((r) => [...r].length)) : 0;
  return validatePuzzle({ width, height, words: spec.words }, { lang, bank: bankIndex(lang), rows: spec.rows, minWords: MIN_WORDS, maxWords: MAX_WORDS });
}

export function presetPuzzle(lang: PuzzleLang, n: number): Puzzle | null {
  const spec = PRESETS[lang][n - 1];
  if (!spec || validatePreset(lang, spec).length > 0) return null;
  const index = bankIndex(lang);
  const words = sortWords(spec.words.map((w) => ({ ...w, display: index.get(w.answer)?.display ?? w.answer })));
  return { id: presetId(lang, n), lang, kind: 'preset', n, width: [...(spec.rows[0] ?? '')].length, height: spec.rows.length, words };
}

const cache = new Map<string, Puzzle | null>();

/** Loads (and validates) a puzzle by id, or null when the id is unknown or the data is invalid. */
export function loadPuzzle(id: string): Puzzle | null {
  if (cache.has(id)) return cache.get(id) ?? null;
  const ref = parsePuzzleId(id);
  const puzzle = !ref ? null : ref.kind === 'preset' ? presetPuzzle(ref.lang, ref.n) : generatePuzzle(ref.lang, ref.n);
  if (cache.size > 40) cache.clear();
  cache.set(id, puzzle);
  return puzzle;
}

export function isPuzzleLang(value: unknown): value is PuzzleLang {
  return typeof value === 'string' && (PUZZLE_LANGS as readonly string[]).includes(value);
}
