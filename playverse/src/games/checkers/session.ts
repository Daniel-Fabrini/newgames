import type { DisplayPiece } from './Board';
import { boardBefore, movePath, sideOfPly, trackPieces, type GameState, type Move } from './engine';
import type { CheckersConfig } from './save';

/** UI-side session helpers (pure, tested): undo semantics, abandonment and what the board draws. */
export interface Session {
  config: CheckersConfig;
  game: GameState;
  /** RNG state of the computer opponent. */
  rng: number;
}

/** A piece being moved by the player; `path` holds the landing squares chosen so far. */
export interface Selection {
  from: number;
  path: number[];
}

/** Step-by-step playback of the last move (`step` = index in [from, ...landings]). */
export interface Anim {
  ply: number;
  step: number;
}

/** Number of plies "undo" takes back: vs computer, the player's last move plus the replies after it. */
export function undoPlies(session: Session): number {
  const { moves } = session.game;
  if (session.config.mode === '2p') return moves.length > 0 ? 1 : 0;
  let i = moves.length - 1;
  while (i >= 0 && sideOfPly(i) !== session.config.humanSide) i--;
  return i < 0 ? 0 : moves.length - i;
}

export function humanMoveCount(session: Session): number {
  if (session.config.mode === '2p') return session.game.moves.length;
  return session.game.moves.filter((_, i) => sideOfPly(i) === session.config.humanSide).length;
}

/** Pieces as drawn: animation of the last move, the partial capture being entered, or the position. */
export function displayPieces(game: GameState, anim: Anim | null, selection: Selection | null, candidates: readonly Move[], fresh: boolean): DisplayPiece[] {
  const last = game.moves[game.moves.length - 1];
  if (anim && last && anim.ply === game.moves.length) {
    const before = boardBefore(game.board, last);
    const ids = trackPieces(game.moves.slice(0, -1));
    const path = movePath(last);
    const taken = new Set(last.captures.slice(0, anim.step));
    const out: DisplayPiece[] = [];
    before.forEach((value, sq) => {
      if (value === 0) return;
      const id = ids[sq] as number;
      if (sq === last.from) out.push({ id, sq: path[Math.min(anim.step, path.length - 1)] as number, value });
      else out.push({ id, sq, value, state: taken.has(sq) ? 'taken' : undefined });
    });
    return out;
  }

  const ids = trackPieces(game.moves);
  const partial = selection && selection.path.length > 0 ? candidates[0] : undefined;
  const taken = new Set(partial ? partial.captures.slice(0, selection?.path.length) : []);
  const out: DisplayPiece[] = [];
  game.board.forEach((value, sq) => {
    if (value === 0) return;
    const id = ids[sq] as number;
    if (partial && selection && sq === selection.from) out.push({ id, sq: selection.path[selection.path.length - 1] as number, value });
    else out.push({ id, sq, value, state: taken.has(sq) ? 'taken' : undefined });
  });
  if (fresh && last && last.captures.length > 0) {
    const prevIds = trackPieces(game.moves.slice(0, -1));
    last.captures.forEach((sq, i) => out.push({ id: prevIds[sq] as number, sq, value: last.captured[i] as number, state: 'ghost' }));
  }
  return out;
}
