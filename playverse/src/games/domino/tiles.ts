/**
 * Double-six domino set: 28 tiles, from 0|0 to 6|6.
 *
 * A tile is identified by a number 0–27 (its index in `TILES`); `TILES[id]` holds its two pip
 * values with the lower one first. Ids keep saves compact and make "every tile exactly once"
 * easy to validate.
 */
export type TileId = number;

export const MAX_PIP = 6;
export const TILE_COUNT = 28;
export const HAND_SIZE = 7;

export const TILES: readonly (readonly [number, number])[] = (() => {
  const out: (readonly [number, number])[] = [];
  for (let a = 0; a <= MAX_PIP; a++) for (let b = a; b <= MAX_PIP; b++) out.push([a, b] as const);
  return out;
})();

export const ALL_TILES: readonly TileId[] = TILES.map((_, i) => i);

export function isTileId(value: unknown): value is TileId {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < TILE_COUNT;
}

/** Id of the tile with the given pips (order does not matter). */
export function tileId(a: number, b: number): TileId {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const id = TILES.findIndex(([x, y]) => x === lo && y === hi);
  if (id < 0) throw new Error(`Invalid tile ${a}|${b}`);
  return id;
}

/** [low, high] pips of a tile. */
export function pipsOf(id: TileId): readonly [number, number] {
  const t = TILES[id];
  if (!t) throw new Error(`Invalid tile id ${id}`);
  return t;
}

export function isDouble(id: TileId): boolean {
  const [a, b] = pipsOf(id);
  return a === b;
}

/** Total pips on the tile (its "weight"). */
export function tileValue(id: TileId): number {
  const [a, b] = pipsOf(id);
  return a + b;
}

export function hasNumber(id: TileId, n: number): boolean {
  const [a, b] = pipsOf(id);
  return a === n || b === n;
}

/** The pip on the other half once `n` is matched (for doubles, `n` itself). */
export function otherHalf(id: TileId, n: number): number {
  const [a, b] = pipsOf(id);
  if (a === n) return b;
  if (b === n) return a;
  throw new Error(`Tile ${a}|${b} has no ${n}`);
}

export function handPips(hand: readonly TileId[]): number {
  return hand.reduce((sum, t) => sum + tileValue(t), 0);
}

/**
 * Ranking used to pick the opening tile when nobody holds a double: heavier tiles first and,
 * between tiles with the same total, the one with the higher number (6|3 beats 5|4).
 */
export function tileRank(id: TileId): number {
  const [a, b] = pipsOf(id);
  return (a + b) * 10 + Math.max(a, b);
}

/** Sort order for hands: by low pip, then high pip (i.e. by id). */
export function sortTiles(tiles: readonly TileId[]): TileId[] {
  return tiles.slice().sort((x, y) => x - y);
}
