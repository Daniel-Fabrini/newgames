import { enBank } from './data/en';
import { esBank } from './data/es';
import { ptBank } from './data/pt';
import type { BankEntry, PuzzleLang } from './types';

/** Word banks per puzzle language (each written natively in that language). */
export const BANKS: Record<PuzzleLang, readonly BankEntry[]> = { pt: ptBank, en: enBank, es: esBank };

const indexes = new Map<PuzzleLang, ReadonlyMap<string, BankEntry>>();

/** Answer → entry lookup for a language. */
export function bankIndex(lang: PuzzleLang): ReadonlyMap<string, BankEntry> {
  let index = indexes.get(lang);
  if (!index) {
    const map = new Map<string, BankEntry>();
    for (const entry of BANKS[lang]) if (!map.has(entry.answer)) map.set(entry.answer, entry);
    index = map;
    indexes.set(lang, index);
  }
  return index;
}
