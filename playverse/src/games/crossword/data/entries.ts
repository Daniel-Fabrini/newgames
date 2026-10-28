import { normalizeAnswer } from '../normalize';
import type { BankEntry, PuzzleLang } from '../types';

/** Builds bank entries from `[natural spelling, clue]` pairs, deriving the normalised answer. */
export function bankFrom(lang: PuzzleLang, pairs: ReadonlyArray<readonly [string, string]>): BankEntry[] {
  return pairs.map(([display, clue]) => ({ answer: normalizeAnswer(display, lang), display, clue }));
}
