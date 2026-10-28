/**
 * Brazilian draughts engine (pure, UI independent).
 *
 * Variant: international (FMJD) rules on an 8×8 board.
 * - Play on the 32 dark squares; a dark square sits at each player's bottom-left corner.
 * - 12 men each on the first three rows. White (light) moves first.
 * - Men move one square diagonally forward and capture diagonally forward AND backward by jumping
 *   an adjacent opponent piece onto the empty square immediately beyond it.
 * - Kings are "flying": they move any number of empty squares diagonally, and capture an opponent
 *   piece at any distance on a diagonal (only empty squares in between), landing on any empty square
 *   beyond it.
 * - Capturing is mandatory, multi-captures must be completed, and the majority rule applies: the
 *   player must choose a sequence that captures the maximum number of pieces (men and kings count the
 *   same). Among those sequences the choice is free.
 * - Captured pieces are only removed after the whole sequence; until then they stay on the board,
 *   cannot be jumped a second time and block the way (Turkish strike rule). The moving piece's own
 *   starting square counts as empty during the sequence.
 * - A man that ENDS its move on the far row becomes a king. A man that reaches the far row in the
 *   middle of a capture and can continue capturing must continue, and stays a man.
 * - A player with no pieces, or no legal move on their turn, loses.
 * - Draws: threefold repetition of the same position with the same side to move; 40 consecutive
 *   plies (20 moves by each player) in which only kings moved and nothing was captured; agreement.
 *
 * Square numbering follows the standard 1–32 notation. Seen from White, square 1 is the leftmost dark
 * square of the top row (Black/Red's back row) and 32 the rightmost dark square of the bottom row
 * (White's back row). Internally squares are 0-based indices (number − 1).
 */
export type Side = 'w' | 'b';

export const EMPTY = 0;
export const WHITE_MAN = 1;
export const WHITE_KING = 2;
export const BLACK_MAN = -1;
export const BLACK_KING = -2;

export const SQUARES = 32;
export const PIECES_PER_SIDE = 12;
/** Plies without captures or man moves (only kings moving) that end the game in a draw. */
export const QUIET_PLY_LIMIT = 40;
/** Occurrences of the same position (same side to move) that end the game in a draw. */
export const REPETITION_LIMIT = 3;

export type DrawReason = 'repetition' | 'king-moves' | 'agreement';
export type WinReason = 'no-pieces' | 'no-moves';

export interface GameResult {
  /** Winner, or null for a draw. */
  winner: Side | null;
  reason: WinReason | DrawReason;
}

export interface Move {
  from: number;
  /** Landing squares in order: one for a simple move, one per captured piece for a capture. */
  path: number[];
  /** Squares of the captured pieces, in capture order. */
  captures: number[];
  /** Values of the captured pieces (same order as `captures`). */
  captured: number[];
  /** Value of the moving piece before the move. */
  piece: number;
  /** The man ends its move on the far row and becomes a king. */
  promotes: boolean;
}

export interface GameState {
  /** 32 cells: 0 empty, 1 white man, 2 white king, -1 black man, -2 black king. */
  board: number[];
  turn: Side;
  /** Moves played since the initial position (used for history, notation and undo). */
  moves: Move[];
  /** Consecutive plies in which only kings moved without capturing. */
  quietPlies: number;
  /** Position keys since the last irreversible move (capture or man move), current one last. */
  positions: string[];
  result: GameResult | null;
}

/* ───────────── Geometry ───────────── */

/** Row from White's point of view: 0 = top (Black's back row, squares 1–4), 7 = bottom (squares 29–32). */
export const rowOf = (sq: number): number => sq >> 2;
/** Column 0–7 (a–h) from White's point of view. */
export const colOf = (sq: number): number => ((sq & 3) << 1) + (rowOf(sq) % 2 === 0 ? 1 : 0);

/** Index of the dark square at (row, col), or -1 for light squares and off-board coordinates. */
export function squareAt(row: number, col: number): number {
  if (row < 0 || row > 7 || col < 0 || col > 7) return -1;
  if ((row + col) % 2 === 0) return -1;
  return row * 4 + (col >> 1);
}

/** Diagonal directions as [dRow, dCol]: 0 up-left, 1 up-right (White's forward), 2 down-left, 3 down-right. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** RAYS[dir][sq] = squares along the diagonal from `sq` (excluding it), nearest first. */
export const RAYS: ReadonlyArray<ReadonlyArray<readonly number[]>> = DIRECTIONS.map(([dr, dc]) =>
  Array.from({ length: SQUARES }, (_, sq) => {
    const out: number[] = [];
    let r = rowOf(sq) + dr;
    let c = colOf(sq) + dc;
    while (squareAt(r, c) >= 0) {
      out.push(squareAt(r, c));
      r += dr;
      c += dc;
    }
    return out;
  }),
);

/** Forward directions of the men of each side. */
const FORWARD: Record<Side, readonly number[]> = { w: [0, 1], b: [2, 3] };

export const opponent = (side: Side): Side => (side === 'w' ? 'b' : 'w');
export const signOf = (side: Side): 1 | -1 => (side === 'w' ? 1 : -1);
export const sideOfPiece = (value: number): Side | null => (value > 0 ? 'w' : value < 0 ? 'b' : null);
export const isKing = (value: number): boolean => value === WHITE_KING || value === BLACK_KING;
/** True when `sq` is the promotion row for `side`. */
export const isPromotionSquare = (sq: number, side: Side): boolean => (side === 'w' ? rowOf(sq) === 0 : rowOf(sq) === 7);

/* ───────────── Positions ───────────── */

export function initialBoard(): number[] {
  return Array.from({ length: SQUARES }, (_, sq) => (sq < 12 ? BLACK_MAN : sq >= 20 ? WHITE_MAN : EMPTY));
}

const KEY_CHARS: Record<number, string> = { [-2]: 'B', [-1]: 'b', 0: '.', 1: 'w', 2: 'W' };

/** Compact position key (board + side to move), used for repetition detection. */
export function positionKey(board: ArrayLike<number>, turn: Side): string {
  let key = '';
  for (let i = 0; i < SQUARES; i++) key += KEY_CHARS[board[i] as number] ?? '?';
  return `${key}:${turn}`;
}

export function countPieces(board: ArrayLike<number>, side: Side): { men: number; kings: number } {
  const sign = signOf(side);
  let men = 0;
  let kings = 0;
  for (let i = 0; i < SQUARES; i++) {
    const v = (board[i] as number) * sign;
    if (v === 1) men++;
    else if (v === 2) kings++;
  }
  return { men, kings };
}

/** Pieces captured so far by `side` (12 minus the opponent's remaining pieces). */
export function capturedBy(board: ArrayLike<number>, side: Side): number {
  const { men, kings } = countPieces(board, opponent(side));
  return PIECES_PER_SIDE - men - kings;
}

/* ───────────── Move generation ───────────── */

const scratch = new Int8Array(SQUARES);

/**
 * Appends to `out` every complete capture sequence of the piece on `from`, keeping only sequences
 * with the maximum number of captures found so far (`best.n`, shared across pieces).
 * `b` is mutated temporarily (the moving piece is lifted) and restored before returning.
 */
function collectCaptures(b: Int8Array, from: number, out: Move[], best: { n: number }): void {
  const piece = b[from] as number;
  const side: Side = piece > 0 ? 'w' : 'b';
  const sign = piece > 0 ? 1 : -1;
  const king = isKing(piece);
  const path: number[] = [];
  const caps: number[] = [];
  const vals: number[] = [];
  b[from] = EMPTY;

  const explore = (sq: number, mask: number): void => {
    let extended = false;
    for (let d = 0; d < 4; d++) {
      const ray = RAYS[d]?.[sq] as readonly number[];
      if (king) {
        let k = 0;
        while (k < ray.length && b[ray[k] as number] === EMPTY) k++;
        if (k >= ray.length) continue;
        const victim = ray[k] as number;
        const value = b[victim] as number;
        // Own piece, or a piece already captured in this sequence (it stays on the board and blocks).
        if (value * sign > 0 || (mask & (1 << victim)) !== 0) continue;
        for (let j = k + 1; j < ray.length; j++) {
          const land = ray[j] as number;
          if (b[land] !== EMPTY) break;
          extended = true;
          path.push(land);
          caps.push(victim);
          vals.push(value);
          explore(land, mask | (1 << victim));
          path.pop();
          caps.pop();
          vals.pop();
        }
      } else {
        if (ray.length < 2) continue;
        const victim = ray[0] as number;
        const land = ray[1] as number;
        const value = b[victim] as number;
        if (value * sign >= 0 || (mask & (1 << victim)) !== 0 || b[land] !== EMPTY) continue;
        extended = true;
        path.push(land);
        caps.push(victim);
        vals.push(value);
        explore(land, mask | (1 << victim));
        path.pop();
        caps.pop();
        vals.pop();
      }
    }
    if (!extended && caps.length > 0) {
      if (caps.length > best.n) {
        best.n = caps.length;
        out.length = 0;
      }
      if (caps.length === best.n) {
        out.push({
          from,
          path: path.slice(),
          captures: caps.slice(),
          captured: vals.slice(),
          piece,
          promotes: !king && isPromotionSquare(sq, side),
        });
      }
    }
  };

  explore(from, 0);
  b[from] = piece;
}

/**
 * All legal moves for `side` on `board`: the maximal capture sequences when any capture exists
 * (mandatory capture + majority rule), otherwise every simple move.
 */
export function generateMoves(board: ArrayLike<number>, side: Side): Move[] {
  const b = scratch;
  for (let i = 0; i < SQUARES; i++) b[i] = board[i] as number;
  const sign = signOf(side);

  const captures: Move[] = [];
  const best = { n: 0 };
  for (let sq = 0; sq < SQUARES; sq++) if ((b[sq] as number) * sign > 0) collectCaptures(b, sq, captures, best);
  if (captures.length > 0) return captures;

  const moves: Move[] = [];
  for (let sq = 0; sq < SQUARES; sq++) {
    const piece = b[sq] as number;
    if (piece * sign <= 0) continue;
    if (isKing(piece)) {
      for (let d = 0; d < 4; d++) {
        for (const to of RAYS[d]?.[sq] as readonly number[]) {
          if (b[to] !== EMPTY) break;
          moves.push({ from: sq, path: [to], captures: [], captured: [], piece, promotes: false });
        }
      }
    } else {
      for (const d of FORWARD[side]) {
        const to = RAYS[d]?.[sq]?.[0];
        if (to === undefined || b[to] !== EMPTY) continue;
        moves.push({ from: sq, path: [to], captures: [], captured: [], piece, promotes: isPromotionSquare(to, side) });
      }
    }
  }
  return moves;
}

export const destination = (move: Move): number => move.path[move.path.length - 1] as number;

/** Squares visited by the moving piece: [from, ...landings]. */
export const movePath = (move: Move): number[] => [move.from, ...move.path];

export const isCapture = (move: Move): boolean => move.captures.length > 0;

/** Applies a move to a board in place. */
export function applyToBoard(board: number[] | Int8Array, move: Move): void {
  board[move.from] = EMPTY;
  for (const c of move.captures) board[c] = EMPTY;
  board[destination(move)] = move.promotes ? move.piece * 2 : move.piece;
}

/** Reverts `applyToBoard` in place. */
export function revertOnBoard(board: number[] | Int8Array, move: Move): void {
  board[destination(move)] = EMPTY;
  move.captures.forEach((c, i) => {
    board[c] = move.captured[i] as number;
  });
  board[move.from] = move.piece;
}

/** Board before `move` was played, given the board after it. */
export function boardBefore(after: readonly number[], move: Move): number[] {
  const board = after.slice();
  revertOnBoard(board, move);
  return board;
}

/* ───────────── Game flow ───────────── */

export function newGame(): GameState {
  const board = initialBoard();
  return { board, turn: 'w', moves: [], quietPlies: 0, positions: [positionKey(board, 'w')], result: null };
}

/** Game state for an arbitrary position (tests, puzzles). The result is evaluated immediately. */
export function positionState(board: readonly number[], turn: Side, quietPlies = 0): GameState {
  const state: GameState = { board: board.slice(), turn, moves: [], quietPlies, positions: [positionKey(board, turn)], result: null };
  return { ...state, result: evaluateResult(state.board, turn, quietPlies, state.positions, opponent(turn)) };
}

export function legalMoves(state: GameState): Move[] {
  return state.result ? [] : generateMoves(state.board, state.turn);
}

function evaluateResult(board: readonly number[], turn: Side, quietPlies: number, positions: readonly string[], mover: Side): GameResult | null {
  const { men, kings } = countPieces(board, turn);
  if (men + kings === 0) return { winner: mover, reason: 'no-pieces' };
  if (generateMoves(board, turn).length === 0) return { winner: mover, reason: 'no-moves' };
  if (quietPlies >= QUIET_PLY_LIMIT) return { winner: null, reason: 'king-moves' };
  const key = positions[positions.length - 1];
  if (key !== undefined && positions.filter((p) => p === key).length >= REPETITION_LIMIT) return { winner: null, reason: 'repetition' };
  return null;
}

/** Plays a move that must come from `legalMoves(state)`. */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.result) return state;
  const board = state.board.slice();
  applyToBoard(board, move);
  const turn = opponent(state.turn);
  const irreversible = isCapture(move) || !isKing(move.piece);
  const quietPlies = irreversible ? 0 : state.quietPlies + 1;
  const key = positionKey(board, turn);
  const positions = irreversible ? [key] : [...state.positions, key];
  return {
    board,
    turn,
    moves: [...state.moves, move],
    quietPlies,
    positions,
    result: evaluateResult(board, turn, quietPlies, positions, state.turn),
  };
}

const samePath = (move: Move, squares: readonly number[]): boolean =>
  move.from === squares[0] && move.path.length === squares.length - 1 && move.path.every((s, i) => s === squares[i + 1]);

/** Finds the legal move whose visited squares are exactly `squares` ([from, ...landings]). */
export function findMove(state: GameState, squares: readonly number[]): Move | undefined {
  return legalMoves(state).find((m) => samePath(m, squares));
}

/** Plays the move given by its visited squares; null when it is not legal. */
export function play(state: GameState, squares: readonly number[]): GameState | null {
  const move = findMove(state, squares);
  return move ? applyMove(state, move) : null;
}

/** Rebuilds a game from the initial position; null when any move is illegal. */
export function replay(paths: ReadonlyArray<readonly number[]>): GameState | null {
  let state = newGame();
  for (const squares of paths) {
    const next = play(state, squares);
    if (!next) return null;
    state = next;
  }
  return state;
}

/** Ends the game in a draw by agreement (two-player mode). */
export function agreeDraw(state: GameState): GameState {
  if (state.result) return state;
  return { ...state, result: { winner: null, reason: 'agreement' } };
}

/** Side that played the move with index `ply` (White plays the even plies from the initial position). */
export const sideOfPly = (ply: number): Side => (ply % 2 === 0 ? 'w' : 'b');

/* ───────────── Notation & helpers for the UI ───────────── */

/** Standard notation with 1-based squares: "11-15" for a move, "22x15x8" for a capture. */
export function notation(move: Move): string {
  if (!isCapture(move)) return `${move.from + 1}-${destination(move) + 1}`;
  return movePath(move)
    .map((s) => s + 1)
    .join('x');
}

/**
 * Stable piece identities for animations: each piece keeps the id of its starting square.
 * Returns, for every square, the id of the piece on it after `moves` (or -1 when empty).
 */
export function trackPieces(moves: readonly Move[]): number[] {
  const ids = initialBoard().map((v, sq) => (v === EMPTY ? -1 : sq));
  for (const move of moves) {
    const id = ids[move.from] as number;
    ids[move.from] = -1;
    for (const c of move.captures) ids[c] = -1;
    ids[destination(move)] = id;
  }
  return ids;
}

/** Maximum number of pieces captured by the legal moves (0 when no capture is available). */
export function captureCount(moves: readonly Move[]): number {
  return moves[0]?.captures.length ?? 0;
}
