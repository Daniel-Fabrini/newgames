// Static game data: towers, enemy tiers, send options, tracks and skins.
// Pure data (no DOM) so the headless balance test can import it.

export const CELL = 40;          // logic units per grid cell
export const COLS = 10;
export const ROWS = 14;
export const WORLD_W = COLS * CELL;
export const WORLD_H = ROWS * CELL;
export const START_LIVES = 20;
export const START_COINS = 170;
export const SEND_STAGGER = 0.35;

// Enemy flags (bit mask)
export const FAST = 1;
export const CAMO = 2;
export const REGEN = 4;

// Enemy tiers. hp = layers at round 1 (scaled per round), armor blocks damage,
// bounty = coins for the popper, leak = lives lost when it reaches the end.
export const TIERS = [
  { id: 0, name: 'tier_gota', hp: 1, speed: 46, armor: 0, bounty: 1, leak: 1, r: 12, body: '#6fe36a', core: '#d8ffd0' },
  { id: 1, name: 'tier_bolha', hp: 2, speed: 50, armor: 0, bounty: 2, leak: 1, r: 13, body: '#56b4ff', core: '#d4efff' },
  { id: 2, name: 'tier_geleia', hp: 3, speed: 52, armor: 0, bounty: 3, leak: 2, r: 14, body: '#ff5d7e', core: '#ffd6df' },
  { id: 3, name: 'tier_mistica', hp: 5, speed: 56, armor: 0, bounty: 4, leak: 2, r: 15, body: '#b07bff', core: '#eadcff' },
  { id: 4, name: 'tier_blindada', hp: 8, speed: 40, armor: 2, bounty: 5, leak: 3, r: 16, body: '#8d9bb3', core: '#e8eef7' },
  { id: 5, name: 'tier_gigante', hp: 14, speed: 42, armor: 1, bounty: 7, leak: 4, r: 18, body: '#ff9a3d', core: '#ffe2bf' },
  { id: 6, name: 'tier_rei', hp: 70, speed: 30, armor: 3, bounty: 40, leak: 10, r: 24, body: '#ffd34a', core: '#fff6c2', boss: true },
];

export const FLAG_NAMES = { [FAST]: 'flag_fast', [CAMO]: 'flag_camo', [REGEN]: 'flag_regen' };

// Hp multiplier that grows forever with the round number.
export function hpScale(round) {
  const x = Math.max(0, round - 1);
  return 1 + 0.1 * x + 0.011 * x * x;
}

export function roundInterval(round) {
  return Math.max(14, 26 - round * 0.3);
}

export function roundIncome(round) {
  return 60 + round * 3;
}

// Towers. base = stats at tier 0, A/B = upgrade paths (3 tiers each).
// Each tier overrides some stats. Only one path may reach tier 3.
export const TOWERS = {
  archer: {
    id: 'archer', name: 'tw_archer', kind: 'arrow', cost: 70, color: '#f0c46a', unlock: 0, pri: 'first',
    base: { range: 118, cd: 0.6, dmg: 1, speed: 420, multi: 1, pierce: 0, armorIgnore: 0 },
    A: [
      { name: 'up_rapid', cost: 60, set: { cd: 0.42 } },
      { name: 'up_rapid', cost: 95, set: { cd: 0.3 } },
      { name: 'up_volley', cost: 150, set: { multi: 3, cd: 0.42 } },
    ],
    B: [
      { name: 'up_sharp', cost: 60, set: { dmg: 2, pierce: 1 } },
      { name: 'up_sharp', cost: 110, set: { dmg: 3, armorIgnore: 1, pierce: 1 } },
      { name: 'up_sharp', cost: 220, set: { dmg: 5, armorIgnore: 2, pierce: 3 } },
    ],
  },
  cannon: {
    id: 'cannon', name: 'tw_cannon', kind: 'shell', cost: 105, color: '#9aa7b8', unlock: 0, pri: 'first',
    base: { range: 104, cd: 1.4, dmg: 3, speed: 260, splash: 34, burnDps: 0, burnDur: 0 },
    A: [
      { name: 'up_iron', cost: 90, set: { splash: 44, dmg: 4 } },
      { name: 'up_iron', cost: 160, set: { splash: 52, dmg: 6 } },
      { name: 'up_iron', cost: 280, set: { splash: 66, dmg: 10, cd: 1.2 } },
    ],
    B: [
      { name: 'up_fire', cost: 90, set: { burnDps: 1, burnDur: 3 } },
      { name: 'up_fire', cost: 160, set: { burnDps: 2, burnDur: 4 } },
      { name: 'up_fire', cost: 260, set: { burnDps: 3, burnDur: 5, cd: 1.0 } },
    ],
  },
  frost: {
    id: 'frost', name: 'tw_frost', kind: 'frost', cost: 115, color: '#8fe9ff', unlock: 0, pri: 'first',
    base: { range: 100, cd: 1.0, dmg: 1, speed: 300, slow: 0.5, slowDur: 1.5, stun: 0, splash: 0 },
    A: [
      { name: 'up_deepfreeze', cost: 90, set: { slow: 0.4, slowDur: 2.2 } },
      { name: 'up_deepfreeze', cost: 150, set: { slow: 0.3, slowDur: 2.6, dmg: 2 } },
      { name: 'up_deepfreeze', cost: 260, set: { slow: 0.2, slowDur: 3, stun: 0.3, cd: 0.8 } },
    ],
    B: [
      { name: 'up_blizzard', cost: 100, set: { splash: 38 } },
      { name: 'up_blizzard', cost: 170, set: { splash: 52, dmg: 2 } },
      { name: 'up_blizzard', cost: 280, set: { splash: 60, dmg: 3, cd: 0.7 } },
    ],
  },
  bolt: {
    id: 'bolt', name: 'tw_bolt', kind: 'bolt', cost: 150, color: '#ffe85a', unlock: 100, pri: 'first',
    base: { range: 98, cd: 1.1, dmg: 3, chain: 3, chainRange: 72, stun: 0 },
    A: [
      { name: 'up_chain', cost: 120, set: { chain: 4 } },
      { name: 'up_chain', cost: 200, set: { chain: 6, dmg: 4 } },
      { name: 'up_chain', cost: 320, set: { chain: 9, dmg: 5, cd: 0.9 } },
    ],
    B: [
      { name: 'up_overload', cost: 120, set: { dmg: 6, chain: 1 } },
      { name: 'up_overload', cost: 210, set: { dmg: 10, cd: 1.4, stun: 0.3, chain: 1 } },
      { name: 'up_overload', cost: 340, set: { dmg: 16, stun: 0.5, cd: 1.4 } },
    ],
  },
  sniper: {
    id: 'sniper', name: 'tw_sniper', kind: 'sniper', cost: 210, color: '#c5d0ff', unlock: 800, pri: 'strong',
    base: { range: 230, cd: 2.2, dmg: 12, speed: 1400, pierce: 0, splash: 0, armorIgnore: 0 },
    A: [
      { name: 'up_perfect', cost: 150, set: { cd: 1.6 } },
      { name: 'up_perfect', cost: 240, set: { dmg: 18 } },
      { name: 'up_perfect', cost: 380, set: { dmg: 26, cd: 1.1 } },
    ],
    B: [
      { name: 'up_silver', cost: 160, set: { pierce: 2, dmg: 14 } },
      { name: 'up_silver', cost: 260, set: { range: 290, dmg: 20, armorIgnore: 3 } },
      { name: 'up_silver', cost: 400, set: { splash: 50, dmg: 30 } },
    ],
  },
  glue: {
    id: 'glue', name: 'tw_glue', kind: 'glue', cost: 95, color: '#9dff5a', unlock: 250, pri: 'first',
    base: { range: 98, cd: 1.1, dmg: 1, speed: 300, slow: 0.35, slowDur: 2.0, shred: 0, shredDur: 4, shredMax: 0, acid: 0, puddle: 0, puddleDur: 0 },
    A: [
      { name: 'up_strongglue', cost: 80, set: { slow: 0.25 } },
      { name: 'up_strongglue', cost: 150, set: { slowDur: 3.5, cd: 0.9 } },
      { name: 'up_strongglue', cost: 280, set: { puddle: 34, puddleDur: 2.5, slow: 0.3 } },
    ],
    B: [
      { name: 'up_corrode', cost: 90, set: { shredMax: 2 } },
      { name: 'up_corrode', cost: 160, set: { shredMax: 3, acid: 1 } },
      { name: 'up_corrode', cost: 260, set: { shredMax: 3, acid: 2, shredDur: 5 } },
    ],
  },
  lantern: {
    id: 'lantern', name: 'tw_lantern', kind: 'lantern', cost: 130, color: '#ffb35a', unlock: 450, pri: 'first',
    base: { range: 96, buff: 0, haste: 0, sorte: 0 },
    A: [
      { name: 'up_magic', cost: 110, set: { buff: 0.3 } },
      { name: 'up_magic', cost: 180, set: { buff: 0.45, haste: 0.12 } },
      { name: 'up_magic', cost: 300, set: { buff: 0.6, haste: 0.2 } },
    ],
    B: [
      { name: 'up_luck', cost: 100, set: { sorte: 0.5 } },
      { name: 'up_luck', cost: 170, set: { sorte: 1.0 } },
      { name: 'up_luck', cost: 280, set: { sorte: 2.0 } },
    ],
  },
};

export const TOWER_ORDER = ['archer', 'cannon', 'frost', 'bolt', 'glue', 'sniper', 'lantern'];

// Stats for a tower with a tiers on path A and b tiers on path B.
export function towerStats(type, a, b) {
  const s = { kind: type.kind, ...type.base };
  for (let i = 0; i < a; i++) Object.assign(s, type.A[i].set);
  for (let i = 0; i < b; i++) Object.assign(s, type.B[i].set);
  return s;
}

// Cost to reach tier (a, b) from nothing, excluding refunds.
export function towerInvested(type, a, b) {
  let c = type.cost;
  for (let i = 0; i < a; i++) c += type.A[i].cost;
  for (let i = 0; i < b; i++) c += type.B[i].cost;
  return c;
}

// Options for sending enemies to the opponent's track (assault / arena).
export const SENDS = [
  { id: 'gota', tier: 0, count: 8, flags: 0, cost: 25, inc: 2, unlock: 1 },
  { id: 'veloz', tier: 0, count: 8, flags: FAST, cost: 45, inc: 3, unlock: 2 },
  { id: 'bolha', tier: 1, count: 6, flags: 0, cost: 60, inc: 4, unlock: 3 },
  { id: 'geleia', tier: 2, count: 5, flags: 0, cost: 110, inc: 7, unlock: 6 },
  { id: 'blindada', tier: 4, count: 3, flags: 0, cost: 220, inc: 12, unlock: 10 },
  { id: 'rei', tier: 6, count: 1, flags: 0, cost: 650, inc: 30, unlock: 15 },
];

// Tracks: map rows use '.' free, '#' obstacle, '~' water/void (not buildable).
// The path comes from waypoints in cell coordinates (axis aligned, may start or
// end one cell outside the board). Path cells are not buildable.
export const TRACKS = [
  {
    id: 'meadow', name: 'tr_meadow', theme: 'meadow', deco: 'tree',
    bg: ['#9be36e', '#3f9a4a'], path: '#f1d089', edge: '#b8864a', grass: '#7fcf5c',
    wp: [[1, -1], [1, 3], [8, 3], [8, 6], [1, 6], [1, 9], [8, 9], [8, 14]],
    map: [
      '.....#....', '...#......', '.........#', '..........', '..#....#..',
      '....#.....', '..........', '..#.....#.', '.........#', '..........',
      '.#....#...', '...#......', '.........#', '..#.......',
    ],
  },
  {
    id: 'desert', name: 'tr_desert', theme: 'desert', deco: 'rock',
    bg: ['#ffd98a', '#d9934a'], path: '#f7e4b4', edge: '#c49a5c', grass: '#e9bf72',
    wp: [[-1, 2], [8, 2], [8, 5], [1, 5], [1, 8], [8, 8], [8, 11], [1, 11], [1, 14]],
    map: [
      '#........#', '....#.....', '..........', '...~~.....', '...~~.....',
      '#.........', '..........', '..........', '.........#', '..#.......',
      '~~........', '..........', '#.....~~..', '........#.',
    ],
  },
  {
    id: 'snow', name: 'tr_snow', theme: 'snow', deco: 'pine',
    bg: ['#f2f9ff', '#9fcbef'], path: '#e3f3ff', edge: '#7ea8cf', grass: '#dcecfa',
    wp: [[8, -1], [8, 3], [1, 3], [1, 6], [7, 6], [7, 9], [2, 9], [2, 12], [9, 12], [9, 14]],
    map: [
      '..~~~~~...', '..~~~~~...', '#........#', '..........', '...#......',
      '#.........', '........#.', '..#.....#.', '#.........', '..........',
      '........#.', '...#......', '..........', '#.........',
    ],
  },
  {
    id: 'lava', name: 'tr_lava', theme: 'lava', deco: 'rock',
    bg: ['#4a1a12', '#b33a12'], path: '#5a3327', edge: '#ff7a1a', grass: '#3b1812',
    wp: [[-1, 1], [7, 1], [7, 10], [2, 10], [2, 4], [5, 4], [5, 7], [4, 7], [4, 14]],
    map: [
      '.....#....', '........##', '...#......', '..........', '#.......~~',
      '........~~', '..........', '........#.', '~~........', '~~........',
      '..........', '......#...', '......#...', '.........#',
    ],
  },
  {
    id: 'sky', name: 'tr_sky', theme: 'sky', deco: 'cloud',
    bg: ['#58c4ff', '#d8f4ff'], path: '#fff3cf', edge: '#ffcf6e', grass: '#8fe08a',
    wp: [[-1, 4], [2, 4], [2, 1], [7, 1], [7, 8], [3, 8], [3, 12], [10, 12]],
    map: [
      '..~~~~~~~~', '..........', '...~~~~.~~', '...~~~~.~~', '...~~~~.~~',
      '~~.~~~~.~~', '~~~~~~~.~~', '~~~~~~~.~~', '~~~.....~~', '~~~.~~~~~~',
      '~~~.~~~~~~', '~~~.~~~~~~', '~~~.......', '....~~~~~~',
    ],
  },
  {
    id: 'swamp', name: 'tr_swamp', theme: 'swamp', deco: 'reed',
    bg: ['#4f7d45', '#1d3b2a'], path: '#8a7040', edge: '#4f4024', grass: '#3b5e35',
    wp: [[4, -1], [4, 2], [1, 2], [1, 6], [8, 6], [8, 9], [2, 9], [2, 14]],
    map: [
      '.....~~~~.', '.....~~~~~', '.....~....', '~.........', '~.........',
      '..........', '..........', '.~~.......', '#.........', '.........~',
      '~~........', '~~........', '#.....~~..', '....~~~~..',
    ],
  },
  {
    id: 'jungle', name: 'tr_jungle', theme: 'jungle', deco: 'palm',
    bg: ['#3fae62', '#14532d'], path: '#c99a5a', edge: '#7a5422', grass: '#2b7a43',
    wp: [[9, -1], [9, 0], [3, 0], [3, 4], [7, 4], [7, 7], [1, 7], [1, 11], [6, 11], [6, 14]],
    map: [
      '###.......', '#.#.#.#.#.', '##..#..###', '#.#.#.###.', '##......##',
      '#...#...#.', '#..#.#...#', '#.......#.', '#.#..#.#.#', '#.###.#...',
      '#.#.##.#.#', '#......###', '#.#.#..#.#', '##.##..##.',
    ],
  },
  {
    id: 'candy', name: 'tr_candy', theme: 'candy', deco: 'candy',
    bg: ['#ffd6ef', '#ff7fc0'], path: '#fbe6b8', edge: '#d0a06a', grass: '#ffb8dc',
    wp: [[-1, 5], [5, 5], [5, 1], [8, 1], [8, 12], [1, 12], [1, 14]],
    map: [
      '..#...#...', '#........#', '~~~~..~~..', '~~#......~', '#........#',
      '......~~..', '~~~~~~~~..', '.#.....#..', '...#.....#', '~~~~~~~~..',
      '#........#', '.#.....#..', '~........~', '....#...#.',
    ],
  },
];

export const SKINS = {
  classic: { id: 'classic', name: 'sk_classic', wall: '#d9b26a', roof: '#8a3b2a', trim: '#f3d27a', glow: '#ffe08a', unlock: 0 },
  candy: { id: 'candy', name: 'sk_candy', wall: '#ffd1ea', roof: '#ff5f9e', trim: '#8af0d0', glow: '#ffb3e0', unlock: 3 },
  royal: { id: 'royal', name: 'sk_royal', wall: '#d6d2e8', roof: '#4b2c8f', trim: '#ffd34a', glow: '#c9a3ff', unlock: 8 },
  neon: { id: 'neon', name: 'sk_neon', wall: '#27303f', roof: '#0c0f18', trim: '#3ff0ff', glow: '#ff3bd1', unlock: 15 },
};

export const SKIN_ORDER = ['classic', 'candy', 'royal', 'neon'];

// Medals / ranks for Arena.
export const RANK_NAMES = ['rk_bronze', 'rk_silver', 'rk_gold', 'rk_platinum', 'rk_diamond', 'rk_master', 'rk_grand', 'rk_legend'];

// Medal total needed to reach level L (L >= 1): 5 * L * (L - 1) / 2 + 0 for L=1.
export function rankForMedals(medals) {
  let L = 1;
  while (medals >= 5 * L * (L + 1) / 2) L++;
  return L;
}

export function stakeFor(level) {
  return 1 + Math.floor((level - 1) / 3);
}
