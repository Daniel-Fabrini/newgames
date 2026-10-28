import { Rng } from '../../utils/random';

/**
 * Klondike solitaire rules engine (pure, UI independent).
 *
 * Rules implemented:
 * - Standard 52-card deck shuffled with a seeded `Rng` (reproducible deals). Seven tableau columns
 *   receive 1..7 cards with only the last one face up; the remaining 24 cards form the stock.
 * - Draw 1 or Draw 3: the stock turns 1 or 3 cards onto the waste. When the stock is empty the
 *   waste is turned back into the stock (unlimited recycles).
 * - Foundations build up by suit from Ace to King; any Ace may start an empty foundation.
 * - Tableau columns build down in alternating colours. Any face-up run (descending, alternating)
 *   can be moved when its first card fits the destination; empty columns accept only a King.
 * - The top card of a foundation may move back to a tableau column.
 * - After a move, a face-down card left on top of a column is turned up automatically.
 * - Standard scoring: waste→tableau +5, to foundation +10, turning a card +5,
 *   foundation→tableau −15, recycling the waste −100 (draw 1) or −20 (draw 3); never below 0.
 *   A time bonus (700 000 / seconds, counting at least 30 s) is added on a win.
 * - Unlimited undo restores the piles and the score (the undo itself counts as a move).
 * - The game is won when all 52 cards are on the foundations.
 */
export const DECK_SIZE = 52;
export const RANKS = 13;
export const TABLEAU_COLUMNS = 7;
export const FOUNDATIONS = 4;

/** Suit order: card id = suitIndex × 13 + (rank − 1). Hearts and diamonds are red. */
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  /** 0..51 — see `SUITS` for the encoding. */
  id: number;
  up: boolean;
}

export type DrawMode = 1 | 3;

export type PileRef =
  | { kind: 'stock' }
  | { kind: 'waste' }
  | { kind: 'foundation'; index: number }
  | { kind: 'tableau'; index: number };

export interface Piles {
  /** Face-down stock; the last element is the top card. */
  stock: Card[];
  /** Face-up waste; the last element is the playable top card. */
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
}

export interface Move {
  from: PileRef;
  to: PileRef;
  /** Number of cards taken from the top of `from` (more than one only between tableau columns). */
  count: number;
}

export type Action = { type: 'draw' } | { type: 'move'; move: Move };

/** Compact undo entry: piles encoded with `encodePiles`. */
export interface Snapshot {
  piles: string;
  score: number;
  recycles: number;
}

export interface GameState extends Piles {
  /** Seed of the deal (restarting the deal reuses it). */
  seed: number;
  draw: DrawMode;
  score: number;
  /** Every action counts: moves, draws, recycles and undos. */
  moves: number;
  recycles: number;
  undos: number;
  history: Snapshot[];
  won: boolean;
}

export const SCORE = {
  wasteToTableau: 5,
  toFoundation: 10,
  flip: 5,
  foundationToTableau: -15,
  recycleDraw1: -100,
  recycleDraw3: -20,
} as const;

export const TIME_BONUS_NUMERATOR = 700_000;
export const TIME_BONUS_MIN_SECONDS = 30;

/* ───────────── Cards ───────────── */

export const suitIndexOf = (id: number): number => Math.floor(id / RANKS);
export const suitOf = (id: number): Suit => SUITS[suitIndexOf(id)] as Suit;
export const rankOf = (id: number): number => (id % RANKS) + 1;
export const isRed = (id: number): boolean => {
  const s = suitIndexOf(id);
  return s === 1 || s === 2;
};
export const cardId = (suit: Suit, rank: number): number => SUITS.indexOf(suit) * RANKS + rank - 1;

/* ───────────── Piles ───────────── */

export const STOCK: PileRef = { kind: 'stock' };
export const WASTE: PileRef = { kind: 'waste' };
export const foundationRef = (index: number): PileRef => ({ kind: 'foundation', index });
export const tableauRef = (index: number): PileRef => ({ kind: 'tableau', index });

export function sameRef(a: PileRef, b: PileRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'stock' || a.kind === 'waste') return true;
  return a.index === (b as { index: number }).index;
}

export function refKey(ref: PileRef): string {
  return ref.kind === 'stock' || ref.kind === 'waste' ? ref.kind : `${ref.kind}-${ref.index}`;
}

function validRef(ref: PileRef): boolean {
  if (ref.kind === 'foundation') return Number.isInteger(ref.index) && ref.index >= 0 && ref.index < FOUNDATIONS;
  if (ref.kind === 'tableau') return Number.isInteger(ref.index) && ref.index >= 0 && ref.index < TABLEAU_COLUMNS;
  return ref.kind === 'stock' || ref.kind === 'waste';
}

export function pileOf(p: Piles, ref: PileRef): readonly Card[] {
  switch (ref.kind) {
    case 'stock':
      return p.stock;
    case 'waste':
      return p.waste;
    case 'foundation':
      return p.foundations[ref.index] ?? [];
    case 'tableau':
      return p.tableau[ref.index] ?? [];
  }
}

export function topOf(pile: readonly Card[]): Card | undefined {
  return pile[pile.length - 1];
}

/** Number of face-down cards at the bottom of a tableau column. */
export function faceDownCount(pile: readonly Card[]): number {
  const i = pile.findIndex((c) => c.up);
  return i === -1 ? pile.length : i;
}

export function clonePiles(p: Piles): Piles {
  return {
    stock: p.stock.map((c) => ({ ...c })),
    waste: p.waste.map((c) => ({ ...c })),
    foundations: p.foundations.map((f) => f.map((c) => ({ ...c }))),
    tableau: p.tableau.map((t) => t.map((c) => ({ ...c }))),
  };
}

/* ───────────── Deal ───────────── */

export function dealPiles(seed: number): Piles {
  const rng = new Rng(seed);
  const deck = rng.shuffle(Array.from({ length: DECK_SIZE }, (_, i) => i));
  const tableau: Card[][] = [];
  let k = 0;
  for (let col = 0; col < TABLEAU_COLUMNS; col++) {
    const pile: Card[] = [];
    for (let j = 0; j <= col; j++) pile.push({ id: deck[k++] as number, up: j === col });
    tableau.push(pile);
  }
  const stock = deck.slice(k).map((id) => ({ id, up: false }));
  return { stock, waste: [], foundations: Array.from({ length: FOUNDATIONS }, () => []), tableau };
}

export function newGame(seed: number, draw: DrawMode): GameState {
  return {
    ...dealPiles(seed >>> 0),
    seed: seed >>> 0,
    draw,
    score: 0,
    moves: 0,
    recycles: 0,
    undos: 0,
    history: [],
    won: false,
  };
}

/* ───────────── Rules ───────────── */

/** True when `card` may be placed on a tableau column whose top card is `target` (undefined = empty column). */
export function canStackOnTableau(card: number, target: Card | undefined): boolean {
  if (!target) return rankOf(card) === RANKS;
  return target.up && isRed(card) !== isRed(target.id) && rankOf(target.id) === rankOf(card) + 1;
}

export function canStackOnFoundation(card: number, pile: readonly Card[]): boolean {
  const top = topOf(pile);
  if (!top) return rankOf(card) === 1;
  return suitIndexOf(top.id) === suitIndexOf(card) && rankOf(card) === rankOf(top.id) + 1;
}

/** A movable run: all face up, descending by one and alternating colours. */
export function isValidRun(cards: readonly Card[]): boolean {
  if (cards.length === 0) return false;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i] as Card;
    if (!c.up) return false;
    if (i > 0) {
      const prev = cards[i - 1] as Card;
      if (isRed(prev.id) === isRed(c.id) || rankOf(prev.id) !== rankOf(c.id) + 1) return false;
    }
  }
  return true;
}

export function isLegalMove(p: Piles, move: Move): boolean {
  const { from, to, count } = move;
  if (!validRef(from) || !validRef(to)) return false;
  if (!Number.isInteger(count) || count < 1) return false;
  if (sameRef(from, to)) return false;
  if (from.kind === 'stock' || to.kind === 'stock' || to.kind === 'waste') return false;
  if (from.kind !== 'tableau' && count !== 1) return false;
  const src = pileOf(p, from);
  if (count > src.length) return false;
  const moving = src.slice(src.length - count);
  if (!isValidRun(moving)) return false;
  const lead = moving[0] as Card;
  if (to.kind === 'foundation') {
    if (count !== 1 || from.kind === 'foundation') return false;
    return canStackOnFoundation(lead.id, pileOf(p, to));
  }
  return canStackOnTableau(lead.id, topOf(pileOf(p, to)));
}

/** Foundation index that accepts `card` (its suit's pile, or the first empty one for an Ace). */
export function foundationFor(p: Piles, card: number): number | null {
  if (rankOf(card) === 1) {
    const empty = p.foundations.findIndex((f) => f.length === 0);
    return empty === -1 ? null : empty;
  }
  const i = p.foundations.findIndex((f) => canStackOnFoundation(card, f));
  return i === -1 ? null : i;
}

/** Every legal card move (draws excluded). */
export function legalMoves(p: Piles): Move[] {
  const sources: Array<{ from: PileRef; counts: number[] }> = [];
  if (p.waste.length) sources.push({ from: WASTE, counts: [1] });
  p.foundations.forEach((f, i) => f.length && sources.push({ from: foundationRef(i), counts: [1] }));
  p.tableau.forEach((col, i) => {
    const up = col.length - faceDownCount(col);
    if (up > 0) sources.push({ from: tableauRef(i), counts: Array.from({ length: up }, (_, k) => k + 1) });
  });
  const targets: PileRef[] = [...Array.from({ length: FOUNDATIONS }, (_, i) => foundationRef(i)), ...Array.from({ length: TABLEAU_COLUMNS }, (_, i) => tableauRef(i))];
  const out: Move[] = [];
  for (const { from, counts } of sources) {
    for (const count of counts) {
      for (const to of targets) {
        const move = { from, to, count };
        if (isLegalMove(p, move)) out.push(move);
      }
    }
  }
  return out;
}

/** Legal destinations for `count` cards taken from `from`. */
export function legalTargets(p: Piles, from: PileRef, count: number): PileRef[] {
  const out: PileRef[] = [];
  for (let i = 0; i < FOUNDATIONS; i++) if (isLegalMove(p, { from, to: foundationRef(i), count })) out.push(foundationRef(i));
  for (let i = 0; i < TABLEAU_COLUMNS; i++) if (isLegalMove(p, { from, to: tableauRef(i), count })) out.push(tableauRef(i));
  return out;
}

export function isComplete(p: Piles): boolean {
  return p.foundations.length === FOUNDATIONS && p.foundations.every((f) => f.length === RANKS);
}

/* ───────────── Pile transitions (no validation, no scoring) ───────────── */

export interface PileStep {
  piles: Piles;
  /** Card turned face up on the source column, if any. */
  flipped: Card | null;
}

function withPile(p: Piles, ref: PileRef, pile: Card[]): Piles {
  switch (ref.kind) {
    case 'stock':
      return { ...p, stock: pile };
    case 'waste':
      return { ...p, waste: pile };
    case 'foundation':
      return { ...p, foundations: p.foundations.map((f, i) => (i === ref.index ? pile : f)) };
    case 'tableau':
      return { ...p, tableau: p.tableau.map((t, i) => (i === ref.index ? pile : t)) };
  }
}

/** Applies a (previously validated) move to the piles, turning up a newly exposed tableau card. */
export function movePiles(p: Piles, move: Move): PileStep {
  const src = pileOf(p, move.from);
  const moving = src.slice(src.length - move.count).map((c) => ({ id: c.id, up: true }));
  let rest = src.slice(0, src.length - move.count);
  let flipped: Card | null = null;
  const top = topOf(rest);
  if (move.from.kind === 'tableau' && top && !top.up) {
    flipped = { id: top.id, up: true };
    rest = [...rest.slice(0, -1), flipped];
  }
  let next = withPile(p, move.from, rest);
  next = withPile(next, move.to, [...pileOf(next, move.to), ...moving]);
  return { piles: next, flipped };
}

/** Turns `draw` cards from the stock onto the waste, or recycles the waste when the stock is empty. */
export function drawPiles(p: Piles, draw: DrawMode): { piles: Piles; recycled: boolean; drawn: Card[] } | null {
  if (p.stock.length === 0) {
    if (p.waste.length === 0) return null;
    const stock = p.waste
      .slice()
      .reverse()
      .map((c) => ({ id: c.id, up: false }));
    return { piles: { ...p, stock, waste: [] }, recycled: true, drawn: [] };
  }
  const n = Math.min(draw, p.stock.length);
  const drawn = p.stock
    .slice(p.stock.length - n)
    .reverse()
    .map((c) => ({ id: c.id, up: true }));
  return { piles: { ...p, stock: p.stock.slice(0, p.stock.length - n), waste: [...p.waste, ...drawn] }, recycled: false, drawn };
}

/* ───────────── Scoring ───────────── */

export function movePoints(move: Move): number {
  if (move.to.kind === 'foundation') return SCORE.toFoundation;
  if (move.from.kind === 'waste' && move.to.kind === 'tableau') return SCORE.wasteToTableau;
  if (move.from.kind === 'foundation' && move.to.kind === 'tableau') return SCORE.foundationToTableau;
  return 0;
}

export function recyclePoints(draw: DrawMode): number {
  return draw === 1 ? SCORE.recycleDraw1 : SCORE.recycleDraw3;
}

/** Bonus added to the score on a win: 700 000 / seconds, counting at least 30 seconds. */
export function timeBonus(durationMs: number): number {
  const seconds = Math.max(TIME_BONUS_MIN_SECONDS, Math.round(Math.max(0, durationMs) / 1000));
  return Math.round(TIME_BONUS_NUMERATOR / seconds);
}

/* ───────────── Game actions ───────────── */

export interface StepResult {
  state: GameState;
  kind: 'move' | 'draw' | 'recycle';
  /** The card move applied (null for draws and recycles). */
  move: Move | null;
  /** Score change before clamping at 0. */
  points: number;
  flipped: Card | null;
  /** Cards turned onto the waste by a draw. */
  drawn: Card[];
  won: boolean;
}

function snapshotOf(s: GameState): Snapshot {
  return { piles: encodePiles(s), score: s.score, recycles: s.recycles };
}

function piles(s: Piles): Piles {
  return { stock: s.stock, waste: s.waste, foundations: s.foundations, tableau: s.tableau };
}

export function applyMove(s: GameState, move: Move): StepResult | null {
  if (s.won || !isLegalMove(s, move)) return null;
  const step = movePiles(piles(s), move);
  const points = movePoints(move) + (step.flipped ? SCORE.flip : 0);
  const won = isComplete(step.piles);
  const state: GameState = {
    ...s,
    ...step.piles,
    score: Math.max(0, s.score + points),
    moves: s.moves + 1,
    history: [...s.history, snapshotOf(s)],
    won,
  };
  return { state, kind: 'move', move, points, flipped: step.flipped, drawn: [], won };
}

export function canDraw(s: Piles): boolean {
  return s.stock.length > 0 || s.waste.length > 0;
}

/** Draws from the stock, or recycles the waste when the stock is empty. Null when both are empty. */
export function draw(s: GameState): StepResult | null {
  if (s.won) return null;
  const step = drawPiles(piles(s), s.draw);
  if (!step) return null;
  const points = step.recycled ? recyclePoints(s.draw) : 0;
  const state: GameState = {
    ...s,
    ...step.piles,
    score: Math.max(0, s.score + points),
    moves: s.moves + 1,
    recycles: s.recycles + (step.recycled ? 1 : 0),
    history: [...s.history, snapshotOf(s)],
  };
  return { state, kind: step.recycled ? 'recycle' : 'draw', move: null, points, flipped: null, drawn: step.drawn, won: false };
}

export function applyAction(s: GameState, action: Action): StepResult | null {
  return action.type === 'draw' ? draw(s) : applyMove(s, action.move);
}

export function canUndo(s: GameState): boolean {
  return !s.won && s.history.length > 0;
}

/** Restores the position and score before the last action. */
export function undo(s: GameState): GameState {
  const snap = s.history[s.history.length - 1];
  if (!snap || s.won) return s;
  const restored = decodePiles(snap.piles);
  if (!restored) return s;
  return {
    ...s,
    ...restored,
    score: snap.score,
    recycles: snap.recycles,
    history: s.history.slice(0, -1),
    moves: s.moves + 1,
    undos: s.undos + 1,
    won: false,
  };
}

/* ───────────── Auto-complete ───────────── */

/** The lowest-ranked exposed card (waste top or column top) that can go to a foundation. */
export function nextFoundationMove(p: Piles): Move | null {
  let best: Move | null = null;
  let bestRank = Infinity;
  const consider = (from: PileRef, card: Card | undefined) => {
    if (!card || !card.up) return;
    const f = foundationFor(p, card.id);
    if (f === null) return;
    const rank = rankOf(card.id);
    if (rank < bestRank) {
      bestRank = rank;
      best = { from, to: foundationRef(f), count: 1 };
    }
  };
  consider(WASTE, topOf(p.waste));
  p.tableau.forEach((col, i) => consider(tableauRef(i), topOf(col)));
  return best;
}

/**
 * Deterministic finishing sequence, available once every tableau card is face up: cards go to the
 * foundations and the stock is drawn as needed. Returns null when finishing would require
 * recycling the waste (or when the game cannot be finished this way).
 */
export function autoCompletePlan(s: GameState): Action[] | null {
  if (s.won) return null;
  if (s.tableau.some((col) => col.some((c) => !c.up))) return null;
  let p: Piles = piles(s);
  const actions: Action[] = [];
  for (let guard = 0; guard < DECK_SIZE * 4; guard++) {
    if (isComplete(p)) return actions.length > 0 ? actions : null;
    const move = nextFoundationMove(p);
    if (move) {
      actions.push({ type: 'move', move });
      p = movePiles(p, move).piles;
      continue;
    }
    if (p.stock.length === 0) return null;
    const step = drawPiles(p, s.draw);
    if (!step) return null;
    actions.push({ type: 'draw' });
    p = step.piles;
  }
  return null;
}

export function canAutoComplete(s: GameState): boolean {
  return autoCompletePlan(s) !== null;
}

/* ───────────── Encoding & integrity ───────────── */

const CODE_BASE = 0xc0;
const SEPARATOR = ',';

/** Compact encoding (one character per card, piles separated by commas) used for undo snapshots. */
export function encodePiles(p: Piles): string {
  return [p.stock, p.waste, ...p.foundations, ...p.tableau]
    .map((pile) => pile.map((c) => String.fromCharCode(CODE_BASE + c.id + (c.up ? DECK_SIZE : 0))).join(''))
    .join(SEPARATOR);
}

export function decodePiles(text: string): Piles | null {
  if (typeof text !== 'string') return null;
  const parts = text.split(SEPARATOR);
  if (parts.length !== 2 + FOUNDATIONS + TABLEAU_COLUMNS) return null;
  const decoded: Card[][] = [];
  for (const part of parts) {
    const pile: Card[] = [];
    for (let i = 0; i < part.length; i++) {
      const code = part.charCodeAt(i) - CODE_BASE;
      if (code < 0 || code >= DECK_SIZE * 2) return null;
      pile.push({ id: code % DECK_SIZE, up: code >= DECK_SIZE });
    }
    decoded.push(pile);
  }
  const p: Piles = {
    stock: decoded[0] as Card[],
    waste: decoded[1] as Card[],
    foundations: decoded.slice(2, 2 + FOUNDATIONS),
    tableau: decoded.slice(2 + FOUNDATIONS),
  };
  return p;
}

/**
 * Integrity check of a position: exactly the 52 distinct cards, face-down stock, face-up waste,
 * foundations built by suit from the Ace, and tableau columns with face-down cards under a valid
 * face-up run. Returns null when valid, otherwise a description of the problem.
 */
export function checkPiles(p: Piles): string | null {
  if (p.foundations.length !== FOUNDATIONS) return 'expected 4 foundations';
  if (p.tableau.length !== TABLEAU_COLUMNS) return 'expected 7 tableau columns';
  const all = [p.stock, p.waste, ...p.foundations, ...p.tableau].flat();
  if (all.length !== DECK_SIZE) return 'expected 52 cards';
  const seen = new Set<number>();
  for (const c of all) {
    if (!Number.isInteger(c.id) || c.id < 0 || c.id >= DECK_SIZE) return 'invalid card';
    if (seen.has(c.id)) return 'duplicate card';
    seen.add(c.id);
  }
  if (p.stock.some((c) => c.up)) return 'stock cards must be face down';
  if (p.waste.some((c) => !c.up)) return 'waste cards must be face up';
  for (const f of p.foundations) {
    for (let i = 0; i < f.length; i++) {
      const c = f[i] as Card;
      if (!c.up || rankOf(c.id) !== i + 1 || suitIndexOf(c.id) !== suitIndexOf((f[0] as Card).id)) return 'invalid foundation';
    }
  }
  for (const col of p.tableau) {
    if (col.length === 0) continue;
    const down = faceDownCount(col);
    if (down === col.length) return 'tableau top card must be face up';
    if (!isValidRun(col.slice(down))) return 'invalid tableau run';
  }
  return null;
}
