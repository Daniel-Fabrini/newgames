import {
  TABLEAU_COLUMNS,
  WASTE,
  canStackOnTableau,
  drawPiles,
  faceDownCount,
  foundationFor,
  foundationRef,
  isComplete,
  isLegalMove,
  legalMoves,
  movePiles,
  pileOf,
  rankOf,
  sameRef,
  tableauRef,
  topOf,
  type Card,
  type DrawMode,
  type Move,
  type PileRef,
  type Piles,
} from './engine';

/**
 * Player assistance (pure): the destination chosen when a card is tapped, and hints.
 */

/**
 * Best destination for the card at `index` of `from` (and the cards on top of it):
 * a foundation first (single cards only), then a non-empty column, then an empty column
 * (a King already at the bottom of a column is not moved to another empty column).
 */
export function autoMoveFor(p: Piles, from: PileRef, index: number): Move | null {
  if (from.kind === 'stock') return null;
  const pile = pileOf(p, from);
  if (pile.length === 0) return null;
  // Only the top card of the waste or of a foundation can be played.
  const start = from.kind === 'tableau' ? index : pile.length - 1;
  const card = pile[start];
  if (!card || !card.up) return null;
  const count = pile.length - start;

  if (count === 1 && from.kind !== 'foundation') {
    const f = foundationFor(p, card.id);
    if (f !== null) return { from, to: foundationRef(f), count: 1 };
  }

  let empty: Move | null = null;
  for (let i = 0; i < TABLEAU_COLUMNS; i++) {
    const move: Move = { from, to: tableauRef(i), count };
    if (!isLegalMove(p, move)) continue;
    if (pileOf(p, move.to).length > 0) return move;
    if (!empty && !(from.kind === 'tableau' && start === 0)) empty = move;
  }
  return empty;
}

export type Hint = { kind: 'move'; move: Move } | { kind: 'draw' } | { kind: 'recycle' };

function foundationMoves(p: Piles): Move[] {
  const out: Move[] = [];
  p.tableau.forEach((col, i) => {
    const top = topOf(col);
    if (!top?.up) return;
    const f = foundationFor(p, top.id);
    if (f !== null) out.push({ from: tableauRef(i), to: foundationRef(f), count: 1 });
  });
  const w = topOf(p.waste);
  if (w) {
    const f = foundationFor(p, w.id);
    if (f !== null) out.push({ from: WASTE, to: foundationRef(f), count: 1 });
  }
  return out;
}

function tableauTargets(p: Piles, from: PileRef, count: number): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < TABLEAU_COLUMNS; i++) {
    const move: Move = { from, to: tableauRef(i), count };
    if (isLegalMove(p, move)) out.push(move);
  }
  return out;
}

/** True when a card (not a King at the bottom of a column) is waiting for an empty column. */
function kingWaiting(p: Piles): boolean {
  const w = topOf(p.waste);
  if (w && rankOf(w.id) === 13) return true;
  return p.tableau.some((col) => {
    const down = faceDownCount(col);
    const base = col[down];
    return down > 0 && base !== undefined && rankOf(base.id) === 13;
  });
}

/** Can `card` be played anywhere right now (foundation or a tableau column)? */
function placeable(p: Piles, card: Card): boolean {
  if (foundationFor(p, card.id) !== null) return true;
  return p.tableau.some((col) => canStackOnTableau(card.id, topOf(col)));
}

/**
 * Whether drawing through the stock (and recycling) would ever expose a playable waste card.
 * Simulates up to two full passes without playing anything.
 */
export function stockHasPlayable(p: Piles, draw: DrawMode): boolean {
  const total = p.stock.length + p.waste.length;
  if (total === 0) return false;
  let cur: Piles = p;
  const limit = (Math.ceil(total / draw) + 2) * 2;
  for (let i = 0; i < limit; i++) {
    const step = drawPiles(cur, draw);
    if (!step) return false;
    cur = step.piles;
    const top = topOf(cur.waste);
    if (top && placeable(p, top)) return true;
  }
  return false;
}

/**
 * Suggests a useful legal move, in order of preference:
 * 1. a column card to a foundation when it exposes a face-down card;
 * 2. a whole face-up run to another column when it exposes a face-down card;
 * 3. any card to a foundation;
 * 4. the waste card to a column;
 * 5. a whole column to another one when a King is waiting for the empty column;
 * 6. part of a run to another column when the card underneath can then go to a foundation;
 * 7. drawing (or recycling) when the stock holds a card that can be played.
 * `skip` excludes specific card moves (used by `isStuck` to ignore undoing the move just tried).
 */
export function findHint(p: Piles, draw: DrawMode, skip?: (move: Move) => boolean): Hint | null {
  const keep = (moves: Move[]) => (skip ? moves.filter((m) => !skip(m)) : moves);
  const toFoundation = keep(foundationMoves(p));
  const revealing = toFoundation.find((m) => {
    if (m.from.kind !== 'tableau') return false;
    const col = pileOf(p, m.from);
    return col.length >= 2 && !(col[col.length - 2] as Card).up;
  });
  if (revealing) return { kind: 'move', move: revealing };

  for (let i = 0; i < TABLEAU_COLUMNS; i++) {
    const col = p.tableau[i] as Card[];
    const down = faceDownCount(col);
    if (down === 0 || down === col.length) continue;
    const move = keep(tableauTargets(p, tableauRef(i), col.length - down))[0];
    if (move) return { kind: 'move', move };
  }

  const first = toFoundation[0];
  if (first) return { kind: 'move', move: first };

  if (p.waste.length > 0) {
    const targets = keep(tableauTargets(p, WASTE, 1));
    const move = targets.find((m) => pileOf(p, m.to).length > 0) ?? targets[0];
    if (move) return { kind: 'move', move };
  }

  if (kingWaiting(p)) {
    for (let i = 0; i < TABLEAU_COLUMNS; i++) {
      const col = p.tableau[i] as Card[];
      if (col.length === 0 || faceDownCount(col) > 0 || rankOf((col[0] as Card).id) === 13) continue;
      const move = keep(tableauTargets(p, tableauRef(i), col.length)).find((m) => pileOf(p, m.to).length > 0);
      if (move) return { kind: 'move', move };
    }
  }

  for (let i = 0; i < TABLEAU_COLUMNS; i++) {
    const col = p.tableau[i] as Card[];
    const down = faceDownCount(col);
    for (let start = down + 1; start < col.length; start++) {
      const under = col[start - 1] as Card;
      if (foundationFor(p, under.id) === null) continue;
      const move = keep(tableauTargets(p, tableauRef(i), col.length - start)).find((m) => pileOf(p, m.to).length > 0);
      if (move) return { kind: 'move', move };
    }
  }

  if (stockHasPlayable(p, draw)) return p.stock.length > 0 ? { kind: 'draw' } : { kind: 'recycle' };
  return null;
}

/**
 * True when the game cannot progress any more: there is no useful move (see `findHint`, which also
 * looks through a full stock cycle) and no single legal card move — including moves the hint
 * skips, such as bringing a foundation card back or splitting a run — leads to a position where a
 * useful move appears (other than undoing that same move). Conservative by design: it may miss
 * some hopeless positions, but it should never call a playable game stuck.
 */
export function isStuck(p: Piles, draw: DrawMode): boolean {
  if (isComplete(p)) return false;
  if (findHint(p, draw)) return false;
  for (const move of legalMoves(p)) {
    const next = movePiles(p, move).piles;
    const undoes = (m: Move) => sameRef(m.from, move.to) && sameRef(m.to, move.from) && m.count === move.count;
    if (findHint(next, draw, undoes)) return false;
  }
  return true;
}
