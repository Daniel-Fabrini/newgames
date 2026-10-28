/**
 * Water Sort rules engine (pure, UI independent).
 *
 * Rules implemented:
 * - Every bottle holds up to CAPACITY (4) units of liquid; a bottle is a list of colour ids from
 *   the bottom to the top.
 * - A pour moves liquid from a source bottle to a different target bottle. It is legal when the
 *   source is not empty, the target is not full and the target is either empty or has the same
 *   colour on top as the source.
 * - The amount poured is the length of the contiguous run of the top colour in the source,
 *   limited by the free space in the target. One pour is one move.
 * - The level is won when every bottle is either empty or full (4 units) of a single colour.
 * - Undo takes back pours one by one (full history of the level); restart returns to the start.
 */
export const CAPACITY = 4;

/** Colour ids from the bottom of the bottle to the top. */
export type Bottle = readonly number[];
export type Bottles = readonly Bottle[];

export interface Move {
  from: number;
  to: number;
  /** Units poured. */
  amount: number;
  colour: number;
}

export type PourError = 'invalid-bottle' | 'same-bottle' | 'source-empty' | 'target-full' | 'colour-mismatch';

export type PourCheck = { ok: true; amount: number; colour: number } | { ok: false; reason: PourError };

export function topColour(bottle: Bottle): number | null {
  return bottle.length === 0 ? null : (bottle[bottle.length - 1] as number);
}

/** Length of the contiguous run of the top colour (0 for an empty bottle). */
export function topRunLength(bottle: Bottle): number {
  const top = topColour(bottle);
  if (top === null) return 0;
  let n = 0;
  for (let i = bottle.length - 1; i >= 0 && bottle[i] === top; i--) n++;
  return n;
}

export function freeSpace(bottle: Bottle): number {
  return Math.max(0, CAPACITY - bottle.length);
}

/** True when every unit in the bottle has the same colour (empty bottles are uniform too). */
export function isUniform(bottle: Bottle): boolean {
  return bottle.every((c) => c === bottle[0]);
}

/** Empty, or full with a single colour. */
export function isBottleDone(bottle: Bottle): boolean {
  return bottle.length === 0 || (bottle.length === CAPACITY && isUniform(bottle));
}

export function isSolved(bottles: Bottles): boolean {
  return bottles.every(isBottleDone);
}

export function checkPour(bottles: Bottles, from: number, to: number): PourCheck {
  const source = bottles[from];
  const target = bottles[to];
  if (!source || !target || !Number.isInteger(from) || !Number.isInteger(to)) return { ok: false, reason: 'invalid-bottle' };
  if (from === to) return { ok: false, reason: 'same-bottle' };
  const colour = topColour(source);
  if (colour === null) return { ok: false, reason: 'source-empty' };
  const free = freeSpace(target);
  if (free === 0) return { ok: false, reason: 'target-full' };
  const targetTop = topColour(target);
  if (targetTop !== null && targetTop !== colour) return { ok: false, reason: 'colour-mismatch' };
  return { ok: true, amount: Math.min(topRunLength(source), free), colour };
}

/** Applies a legal pour. Returns null (and leaves the input untouched) when the pour is illegal. */
export function pour(bottles: Bottles, from: number, to: number): { bottles: number[][]; move: Move } | null {
  const check = checkPour(bottles, from, to);
  if (!check.ok) return null;
  const next = bottles.map((b) => b.slice());
  const source = next[from] as number[];
  const target = next[to] as number[];
  source.length -= check.amount;
  for (let i = 0; i < check.amount; i++) target.push(check.colour);
  return { bottles: next, move: { from, to, amount: check.amount, colour: check.colour } };
}

/** Reverses a pour produced by `pour` (the poured units are on top of the target). */
export function unpour(bottles: Bottles, move: Move): number[][] | null {
  const source = bottles[move.from];
  const target = bottles[move.to];
  if (!source || !target || move.amount < 1 || target.length < move.amount || source.length + move.amount > CAPACITY) return null;
  for (let i = target.length - move.amount; i < target.length; i++) if (target[i] !== move.colour) return null;
  const next = bottles.map((b) => b.slice());
  (next[move.to] as number[]).length -= move.amount;
  for (let i = 0; i < move.amount; i++) (next[move.from] as number[]).push(move.colour);
  return next;
}

/** Every legal pour (by the rules, including pointless ones). */
export function legalMoves(bottles: Bottles): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  for (let from = 0; from < bottles.length; from++) {
    for (let to = 0; to < bottles.length; to++) if (checkPour(bottles, from, to).ok) out.push({ from, to });
  }
  return out;
}

/**
 * True when there is at least one pour that changes the position in a meaningful way, i.e. not
 * just moving a single-colour bottle into an empty one. Used to tell the player they are stuck.
 */
export function hasUsefulMove(bottles: Bottles): boolean {
  for (const { from, to } of legalMoves(bottles)) {
    const source = bottles[from] as Bottle;
    const target = bottles[to] as Bottle;
    if (target.length === 0 && isUniform(source)) continue;
    return true;
  }
  return false;
}

/**
 * Checks that a position is well formed: colour ids in [0, paletteSize), no bottle over capacity
 * and exactly CAPACITY units of every colour that appears.
 */
export function isWellFormed(bottles: Bottles, paletteSize: number): boolean {
  const counts = new Map<number, number>();
  for (const b of bottles) {
    if (b.length > CAPACITY) return false;
    for (const c of b) {
      if (!Number.isInteger(c) || c < 0 || c >= paletteSize) return false;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  for (const n of counts.values()) if (n !== CAPACITY) return false;
  return counts.size > 0;
}

/** Distinct colours present in a position. */
export function coloursIn(bottles: Bottles): number[] {
  return [...new Set(bottles.flat())].sort((a, b) => a - b);
}

export function cloneBottles(bottles: Bottles): number[][] {
  return bottles.map((b) => b.slice());
}

export function sameBottles(a: Bottles, b: Bottles): boolean {
  return a.length === b.length && a.every((bottle, i) => {
    const other = b[i] as Bottle;
    return bottle.length === other.length && bottle.every((c, j) => c === other[j]);
  });
}

/* ───────────── Level play state ───────────── */

export interface LevelState {
  level: number;
  /** Start position (for restart and save validation). */
  initial: number[][];
  /** Solver's solution length for the start position. */
  par: number;
  bottles: number[][];
  /** Every pour made in this attempt, in order (undo pops from the end). */
  history: Move[];
  hintsUsed: number;
  won: boolean;
}

export function createLevelState(level: number, initial: Bottles, par: number): LevelState {
  return { level, initial: cloneBottles(initial), par, bottles: cloneBottles(initial), history: [], hintsUsed: 0, won: false };
}

/** Moves made in the current attempt (undone pours are not counted). */
export function movesOf(state: LevelState): number {
  return state.history.length;
}

export type PlayResult = { ok: true; state: LevelState; move: Move; won: boolean } | { ok: false; reason: PourError | 'finished' };

export function playPour(state: LevelState, from: number, to: number): PlayResult {
  if (state.won) return { ok: false, reason: 'finished' };
  const check = checkPour(state.bottles, from, to);
  if (!check.ok) return { ok: false, reason: check.reason };
  const res = pour(state.bottles, from, to);
  if (!res) return { ok: false, reason: 'invalid-bottle' };
  const won = isSolved(res.bottles);
  return { ok: true, move: res.move, won, state: { ...state, bottles: res.bottles, history: [...state.history, res.move], won } };
}

export function canUndo(state: LevelState): boolean {
  return state.history.length > 0 && !state.won;
}

export function undoPour(state: LevelState): LevelState {
  const last = state.history[state.history.length - 1];
  if (!last || state.won) return state;
  const bottles = unpour(state.bottles, last);
  if (!bottles) return state;
  return { ...state, bottles, history: state.history.slice(0, -1) };
}

/** Back to the start position; a restart is a fresh attempt (moves and hints reset). */
export function restartLevel(state: LevelState): LevelState {
  return createLevelState(state.level, state.initial, state.par);
}

export function markHintUsed(state: LevelState): LevelState {
  return { ...state, hintsUsed: state.hintsUsed + 1 };
}

/** Replays `history` from `initial`; returns the final bottles or null when any pour is illegal. */
export function replay(initial: Bottles, history: readonly Pick<Move, 'from' | 'to'>[]): number[][] | null {
  let bottles = cloneBottles(initial);
  for (const m of history) {
    const res = pour(bottles, m.from, m.to);
    if (!res) return null;
    bottles = res.bottles;
  }
  return bottles;
}

/* ───────────── Stars ───────────── */

export interface StarThresholds {
  /** Maximum moves for 3 stars. */
  three: number;
  /** Maximum moves for 2 stars. */
  two: number;
}

/**
 * 3★: at most par + max(2, ⌈15% of par⌉) moves; 2★: at most par + max(6, ⌈50% of par⌉);
 * otherwise 1★. Using any hint caps the result at 2★.
 */
export function starThresholds(par: number): StarThresholds {
  return { three: par + Math.max(2, Math.ceil(par * 0.15)), two: par + Math.max(6, Math.ceil(par * 0.5)) };
}

export const HINT_STAR_CAP = 2;

export function starsFor(moves: number, par: number, hintsUsed: number): number {
  const t = starThresholds(par);
  const stars = moves <= t.three ? 3 : moves <= t.two ? 2 : 1;
  return hintsUsed > 0 ? Math.min(HINT_STAR_CAP, stars) : stars;
}
