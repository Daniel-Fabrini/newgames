import { MAX_COLOURS } from './levels';

/**
 * Liquid colours and their symbols. Colour ids in the engine index this palette. Each colour also
 * has a distinct symbol so the puzzle never depends on colour vision alone.
 */
export interface LiquidStyle {
  /** Base colour. */
  base: string;
  /** Darker edge of the glossy gradient. */
  shade: string;
  /** Highlight. */
  light: string;
  /** Symbol colour with enough contrast on `base`. */
  ink: string;
  /** SVG content drawn in a 24×24 box. */
  symbol: SymbolName;
}

export type SymbolName =
  | 'circle'
  | 'triangle'
  | 'star'
  | 'plus'
  | 'square'
  | 'diamond'
  | 'heart'
  | 'hexagon'
  | 'cross'
  | 'moon'
  | 'bolt'
  | 'ring';

const DARK_INK = 'rgba(20, 16, 60, 0.78)';
const LIGHT_INK = 'rgba(255, 255, 255, 0.9)';

export const PALETTE: readonly LiquidStyle[] = [
  { base: '#ef4444', shade: '#b91c1c', light: '#fca5a5', ink: LIGHT_INK, symbol: 'circle' },
  { base: '#f97316', shade: '#c2410c', light: '#fdba74', ink: DARK_INK, symbol: 'triangle' },
  { base: '#facc15', shade: '#ca8a04', light: '#fef08a', ink: DARK_INK, symbol: 'star' },
  { base: '#a3e635', shade: '#65a30d', light: '#d9f99d', ink: DARK_INK, symbol: 'plus' },
  { base: '#22c55e', shade: '#15803d', light: '#86efac', ink: LIGHT_INK, symbol: 'square' },
  { base: '#22d3ee', shade: '#0891b2', light: '#a5f3fc', ink: DARK_INK, symbol: 'diamond' },
  { base: '#2f6bff', shade: '#1d3fb0', light: '#60a5fa', ink: LIGHT_INK, symbol: 'heart' },
  { base: '#8b5cf6', shade: '#5b21b6', light: '#c4b5fd', ink: LIGHT_INK, symbol: 'hexagon' },
  { base: '#f472b6', shade: '#be185d', light: '#fbcfe8', ink: DARK_INK, symbol: 'cross' },
  { base: '#92400e', shade: '#5a2408', light: '#c2783a', ink: LIGHT_INK, symbol: 'moon' },
  { base: '#eef2f7', shade: '#a8b3c4', light: '#ffffff', ink: DARK_INK, symbol: 'bolt' },
  { base: '#d61fd6', shade: '#86198f', light: '#f0abfc', ink: LIGHT_INK, symbol: 'ring' },
];

if (PALETTE.length < MAX_COLOURS) throw new Error('Water Sort palette is smaller than MAX_COLOURS');

export function liquid(colour: number): LiquidStyle {
  return PALETTE[colour] ?? (PALETTE[0] as LiquidStyle);
}
