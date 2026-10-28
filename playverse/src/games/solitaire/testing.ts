import { RANKS, cardId, type Card, type GameState, type Piles, type Suit } from './engine';

/**
 * Helpers for the solitaire tests: cards are written as rank + suit letter
 * ("AS" = Ace of spades, "10H", "QD", "KC").
 */
const SUIT_LETTERS: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const RANK_LETTERS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

export function id(code: string): number {
  const suit = SUIT_LETTERS[code.slice(-1)];
  const r = code.slice(0, -1);
  const rank = RANK_LETTERS[r] ?? Number(r);
  if (!suit || !Number.isInteger(rank) || rank < 1 || rank > RANKS) throw new Error(`bad card code ${code}`);
  return cardId(suit, rank);
}

export const up = (code: string): Card => ({ id: id(code), up: true });
export const down = (code: string): Card => ({ id: id(code), up: false });
export const ups = (...codes: string[]): Card[] => codes.map(up);
export const downs = (...codes: string[]): Card[] => codes.map(down);

/** Foundation holding Ace..`upto` of a suit. */
export function foundation(suit: Suit, upto: number): Card[] {
  return Array.from({ length: upto }, (_, i) => ({ id: cardId(suit, i + 1), up: true }));
}

/** Descending alternating run from `high` to `low`, starting with `first` suit and alternating with `second`. */
export function run(first: Suit, second: Suit, high: number, low: number): Card[] {
  const out: Card[] = [];
  for (let r = high, i = 0; r >= low; r--, i++) out.push({ id: cardId(i % 2 === 0 ? first : second, r), up: true });
  return out;
}

export function makePiles(partial: Partial<Piles> = {}): Piles {
  return {
    stock: partial.stock ?? [],
    waste: partial.waste ?? [],
    foundations: partial.foundations ?? [[], [], [], []],
    tableau: partial.tableau ?? [[], [], [], [], [], [], []],
  };
}

export function makeState(partial: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    draw: 1,
    score: 0,
    moves: 0,
    recycles: 0,
    undos: 0,
    history: [],
    won: false,
    ...makePiles(partial),
    ...partial,
  };
}

/** Column list padded to 7 columns. */
export function columns(...cols: Card[][]): Card[][] {
  return [...cols, ...Array.from({ length: 7 - cols.length }, () => [] as Card[])];
}
