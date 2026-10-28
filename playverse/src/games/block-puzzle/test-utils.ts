import { SIZE, TRAY_SIZE, hasAnyMove, type GameState } from './engine';

/** Test helper: builds a board from 9 strings ('.' empty, '#' colour 1, '1'–'8' that colour). */
export function boardFrom(rows: readonly string[]): number[] {
  if (rows.length !== SIZE) throw new Error('boardFrom needs 9 rows');
  return rows.flatMap((line) => {
    if (line.length !== SIZE) throw new Error(`bad row: ${line}`);
    return [...line].map((ch) => (ch === '.' ? 0 : ch === '#' ? 1 : Number(ch)));
  });
}

/** Board with holes where (row + col) % 3 === 0: no two holes touch, so only the 1-block piece fits. */
export function isolatedHolesBoard(): number[] {
  return boardFrom(Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => ((r + c) % 3 === 0 ? '.' : '#')).join('')));
}

/** Test helper: state with the given board and tray shape ids (null = empty slot). */
export function stateWith(board: number[], tray: readonly (string | null)[], extra: Partial<GameState> = {}): GameState {
  if (tray.length !== TRAY_SIZE) throw new Error('tray needs 3 slots');
  const pieces = tray.map((shape, i) => (shape ? { id: i + 1, shape } : null));
  return {
    board,
    tray: pieces,
    score: 0,
    combo: 0,
    maxCombo: 0,
    lines: 0,
    placed: 0,
    over: !hasAnyMove(board, pieces),
    rng: 12345,
    nextId: 10,
    ...extra,
  };
}
