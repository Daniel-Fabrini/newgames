// Equipment, profile and World Tour progression (pure data and helpers).
import { STYLES } from './logic.js';

// Equipment: blades (power/control), rubbers (spin), balls (cosmetic trail), shoes (movement).
export const ITEMS = {
  blade: [
    { id: 'std', cost: 0, eq: { power: 1, control: 1 }, bars: [3, 3, 2] },
    { id: 'pow', cost: 150, eq: { power: 1.12, control: 0.9 }, bars: [5, 2, 2] },
    { id: 'ctl', cost: 150, eq: { power: 0.92, control: 1.12 }, bars: [2, 5, 2] },
  ],
  rubber: [
    { id: 'std', cost: 0, eq: { spin: 1, rubber: 1 }, bars: [3, 3, 2] },
    { id: 'turbo', cost: 220, eq: { spin: 1.18, rubber: 1.2 }, bars: [3, 3, 5] },
    { id: 'soft', cost: 120, eq: { spin: 1.05, rubber: 0.95 }, bars: [2, 4, 3] },
  ],
  ball: [
    { id: 'std', cost: 0, skin: 'std' },
    { id: 'fire', cost: 90, skin: 'fire' },
    { id: 'ice', cost: 90, skin: 'ice' },
    { id: 'neon', cost: 120, skin: 'neon' },
  ],
  shoe: [
    { id: 'std', cost: 0, eq: { move: 1 }, bars: [2, 2, 3] },
    { id: 'grip', cost: 120, eq: { move: 1.2 }, bars: [2, 2, 4] },
    { id: 'speed', cost: 250, eq: { move: 1.4 }, bars: [2, 2, 5] },
  ],
};
export const CATS = ['blade', 'rubber', 'ball', 'shoe'];
export const CAT_LABEL = { blade: 'shopBlades', rubber: 'shopRubbers', ball: 'shopBalls', shoe: 'shopShoes' };
export const ITEM_NAME = {
  blade: { std: 'bladeStd', pow: 'bladePow', ctl: 'bladeCtl' },
  rubber: { std: 'rubberStd', turbo: 'rubberSpin', soft: 'rubberSoft' },
  ball: { std: 'ballStd', fire: 'ballFire', ice: 'ballIce', neon: 'ballNeon' },
  shoe: { std: 'shoeStd', grip: 'shoeGrip', speed: 'shoeSpeed' },
};
export const ITEM_DESC = {
  blade: { std: 'bladeStdD', pow: 'bladePowD', ctl: 'bladeCtlD' },
  rubber: { std: 'rubberStdD', turbo: 'rubberSpinD', soft: 'rubberSoftD' },
  ball: { std: 'ballStdD', fire: 'ballFireD', ice: 'ballIceD', neon: 'ballNeonD' },
  shoe: { std: 'shoeStdD', grip: 'shoeGripD', speed: 'shoeSpeedD' },
};

export const SEASON_FANS = 350;
export const ARENA_STEP = 35;

export function defaultProfile() {
  return {
    fans: 0,
    coins: 60,
    wins: 0,
    losses: 0,
    own: { blade: ['std'], rubber: ['std'], ball: ['std'], shoe: ['std'] },
    eq: { blade: 'std', rubber: 'std', ball: 'std', shoe: 'std' },
    bestRally: 0,
    drill: { serve: 0, rally: 0, target: 0 },
  };
}

export function find(cat, id) {
  return ITEMS[cat].find((x) => x.id === id) || ITEMS[cat][0];
}

// Combined stats of the equipped items, used by the simulation.
export function eqFrom(p) {
  const b = find('blade', p.eq.blade).eq;
  const r = find('rubber', p.eq.rubber).eq;
  const s = find('shoe', p.eq.shoe).eq;
  return { power: b.power, control: b.control, spin: r.spin, rubber: r.rubber, move: s.move };
}

export function skinFrom(p) {
  return find('ball', p.eq.ball).skin;
}

// World Tour: fans unlock arenas (ten per season) and raise the opponent tier forever.
export function tourInfo(fans) {
  const season = Math.floor(fans / SEASON_FANS) + 1;
  const inSeason = fans - (season - 1) * SEASON_FANS;
  const unlocked = Math.min(10, Math.floor(inSeason / ARENA_STEP) + 1);
  const tier = 1 + Math.floor(fans / 22);
  return { season, unlocked, tier };
}

export function arenaNeed(k, season) {
  return (season - 1) * SEASON_FANS + k * ARENA_STEP;
}

// Opponent for an arena: name index and style rotate with the arena and season.
export function tourOpponent(fans, k) {
  const { season, tier } = tourInfo(fans);
  return { tier: tier + Math.floor(k / 3), style: STYLES[(season + k) % STYLES.length], nameIdx: (k + season) % 10 };
}

export function quickTier(level) {
  return [0, 3, 7, 12][level] ?? 3;
}

export const QUICK_KEYS = ['diffEasy', 'diffMed', 'diffHard', 'diffPro'];
