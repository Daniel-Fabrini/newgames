import type { SolitaireMessages } from '../../i18n/pt/solitaire';
import { faceDownCount, pileOf, rankOf, suitOf, topOf, type PileRef, type Piles } from './engine';

/** Localised descriptions of cards and piles (screen-reader labels and announcements). */
export function cardName(t: SolitaireMessages, id: number): string {
  return t.cardName(t.rankNames[rankOf(id) - 1] ?? '', t.suits[suitOf(id)]);
}

export function rankLabel(t: SolitaireMessages, id: number): string {
  return t.rankShort[rankOf(id) - 1] ?? '';
}

/** Destination name used in sentences ("to column 3"). */
export function pileName(t: SolitaireMessages, ref: PileRef): string {
  switch (ref.kind) {
    case 'stock':
      return t.piles.stock;
    case 'waste':
      return t.piles.waste;
    case 'foundation':
      return t.piles.foundation(ref.index + 1);
    case 'tableau':
      return t.piles.column(ref.index + 1);
  }
}

/** Accessible label of a pile, describing its visible contents. */
export function pileLabel(t: SolitaireMessages, p: Piles, ref: PileRef, list: (items: string[]) => string): string {
  const pile = pileOf(p, ref);
  const top = topOf(pile);
  switch (ref.kind) {
    case 'stock':
      return pile.length === 0 && p.waste.length > 0 ? t.labels.stockRecycle : t.labels.stock(pile.length);
    case 'waste':
      return top ? t.labels.waste(pile.length, cardName(t, top.id)) : t.labels.wasteEmpty;
    case 'foundation':
      return top ? t.labels.foundation(ref.index + 1, cardName(t, top.id)) : t.labels.foundationEmpty(ref.index + 1);
    case 'tableau': {
      if (!top) return t.labels.columnEmpty(ref.index + 1);
      const down = faceDownCount(pile);
      return t.labels.column(ref.index + 1, down, list(pile.slice(down).map((c) => cardName(t, c.id))));
    }
  }
}
