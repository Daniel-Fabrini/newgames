// Static game data for Fazenda Aventura. Names live in strings.js; this file holds numbers and ids.

export const GRID = 16;                                  // farm is GRID x GRID tiles
export const START = { x0: 4, y0: 4, x1: 11, y1: 11 };   // initially unlocked square (inclusive)
export const MAX_PENS_ANIMALS = 6;
export const REGEN_MS = 60e3;                            // +1 energy per minute
export const ENERGY_CAP = 180;

// value = sell price; lvl = first level where it shows up in orders; en = energy when eaten
export const ITEMS = {
  wheat:      { e: '🌾', v: 4,  lvl: 1 },
  carrot:     { e: '🥕', v: 8,  lvl: 2 },
  corn:       { e: '🌽', v: 12, lvl: 4 },
  strawberry: { e: '🍓', v: 18, lvl: 6 },
  pumpkin:    { e: '🎃', v: 30, lvl: 9 },
  egg:        { e: '🥚', v: 6,  lvl: 1 },
  milk:       { e: '🥛', v: 10, lvl: 3 },
  wool:       { e: '🧶', v: 14, lvl: 5 },
  meat:       { e: '🥩', v: 22, lvl: 7 },
  feed:       { e: '🥣', v: 5,  lvl: 2 },
  flour:      { e: '🧂', v: 8,  lvl: 2 },
  plank:      { e: '🟫', v: 12, lvl: 3 },
  bread:      { e: '🍞', v: 26, lvl: 3, en: 15 },
  cake:       { e: '🎂', v: 60, lvl: 6, en: 25 },
  cheese:     { e: '🧀', v: 45, lvl: 4, en: 10 },
  yogurt:     { e: '🍮', v: 28, lvl: 4, en: 12 },
  stew:       { e: '🍲', v: 70, lvl: 5, en: 40 },
  pie:        { e: '🥧', v: 65, lvl: 8, en: 35 },
  wood:       { e: '🪵', v: 3,  lvl: 1 },
  stone:      { e: '🪨', v: 3,  lvl: 1 },
  ore:        { e: '🔩', v: 9,  lvl: 4 },
  herb:       { e: '🌿', v: 12, lvl: 1 },
  mushroom:   { e: '🍄', v: 14, lvl: 1 },
  honey:      { e: '🍯', v: 40, lvl: 1 },
  crystal:    { e: '🔮', v: 50, lvl: 8 },
  coconut:    { e: '🥥', v: 20, lvl: 16 },
  shell:      { e: '🐚', v: 24, lvl: 16 },
};

// Crops are planted on fields. grow = ms until ready.
export const CROPS = {
  wheat:      { grow: 20e3,  yield: 3, cost: 4,  lvl: 1, col: '#e7c04a' },
  carrot:     { grow: 45e3,  yield: 3, cost: 8,  lvl: 2, col: '#ff8a3d' },
  corn:       { grow: 90e3,  yield: 3, cost: 14, lvl: 4, col: '#ffd23f' },
  strawberry: { grow: 180e3, yield: 4, cost: 30, lvl: 6, col: '#ff4d6d' },
  pumpkin:    { grow: 480e3, yield: 3, cost: 60, lvl: 9, col: '#ff9a1f' },
};

// Animal pens (one per type). food: accepted feed, cycle: ms per production cycle.
export const PENS = {
  chicken: { e: '🐔', food: ['wheat', 'feed'], out: 'egg',  cycle: 50e3,  lvl: 1, build: { coins: 80,  wood: 4 },              add: 40,  start: 2 },
  cow:     { e: '🐄', food: ['carrot', 'feed'], out: 'milk', cycle: 120e3, lvl: 3, build: { coins: 200, wood: 12 },             add: 80,  start: 2 },
  sheep:   { e: '🐑', food: ['wheat', 'feed'], out: 'wool', cycle: 150e3, lvl: 5, build: { coins: 260, wood: 14, stone: 4 },  add: 100, start: 2 },
  pig:     { e: '🐖', food: ['corn', 'feed'],   out: 'meat', cycle: 240e3, lvl: 7, build: { coins: 320, wood: 16, stone: 8 },  add: 140, start: 2 },
};

// Production buildings. recipes: in/out maps, t = ms per job.
export const PROD = {
  mill: {
    e: '⚙️', lvl: 2, slots: 2, build: { coins: 120, wood: 8 },
    recipes: [
      { in: { wheat: 2 }, out: { flour: 1 }, t: 20e3, lvl: 2 },
      { in: { wheat: 1, corn: 1 }, out: { feed: 2 }, t: 25e3, lvl: 2 },
    ],
  },
  bakery: {
    e: '🥖', lvl: 3, slots: 2, build: { coins: 200, wood: 12, stone: 6 },
    recipes: [
      { in: { flour: 1, egg: 1 }, out: { bread: 1 }, t: 30e3, lvl: 3 },
      { in: { flour: 2, egg: 2, milk: 1 }, out: { cake: 1 }, t: 100e3, lvl: 6 },
    ],
  },
  dairy: {
    e: '🧈', lvl: 4, slots: 2, build: { coins: 300, wood: 15, stone: 10 },
    recipes: [
      { in: { milk: 2 }, out: { cheese: 1 }, t: 60e3, lvl: 4 },
      { in: { milk: 1, strawberry: 1 }, out: { yogurt: 2 }, t: 40e3, lvl: 4 },
    ],
  },
  sawmill: {
    e: '🪚', lvl: 3, slots: 2, build: { coins: 150, wood: 4, stone: 6 },
    recipes: [
      { in: { wood: 2 }, out: { plank: 1 }, t: 25e3, lvl: 3 },
    ],
  },
  kitchen: {
    e: '🍳', lvl: 5, slots: 3, build: { coins: 400, wood: 20, stone: 20 },
    recipes: [
      { in: { carrot: 2, meat: 1 }, out: { stew: 1 }, t: 75e3, lvl: 5 },
      { in: { pumpkin: 1, flour: 1, egg: 1 }, out: { pie: 1 }, t: 120e3, lvl: 8 },
    ],
  },
};

export const DECOR = {
  tree:      { e: '🌳', size: 1, lvl: 1, cost: { coins: 20 } },
  flowers:   { e: '🌸', size: 1, lvl: 1, cost: { coins: 15 } },
  scarecrow: { e: '🎃', size: 1, lvl: 2, cost: { coins: 40, wood: 2 } },
  hay:       { e: '🌾', size: 1, lvl: 2, cost: { coins: 25, wood: 1 } },
  pond:      { e: '💧', size: 2, lvl: 3, cost: { coins: 150, stone: 4 } },
};

// Obstacles on the farm: clearing costs energy and yields materials.
export const OBST = {
  bush:  { en: 2, give: { wood: 1 }, xp: 1 },
  stump: { en: 3, give: { wood: 2 }, xp: 2 },
  rock:  { en: 4, give: { stone: 2 }, xp: 2 },
};

// Expedition covers: hard = energy needed to clear.
export const COVERS = { bush: 1, vine: 1, debris: 2, rock: 2, rubble: 2, palm: 2, ice: 3, boulder: 3 };

export const REGIONS = [
  { id: 'forest', lvl: 1,  covers: ['bush', 'bush', 'debris', 'vine'],   items: [['wood', 3], ['herb', 2], ['mushroom', 2], ['honey', 1]], goal: 'cabin' },
  { id: 'canyon', lvl: 4,  covers: ['rock', 'rubble', 'debris'],         items: [['stone', 3], ['ore', 2]],                              goal: 'totem' },
  { id: 'mine',   lvl: 8,  covers: ['ice', 'boulder', 'rock'],           items: [['ore', 3], ['crystal', 2], ['stone', 1]],              goal: 'gate' },
  { id: 'ruins',  lvl: 12, covers: ['rubble', 'vine', 'debris'],         items: [['crystal', 2], ['ore', 2], ['stone', 2]],              goal: 'obelisk' },
  { id: 'island', lvl: 16, covers: ['palm', 'bush', 'rock'],             items: [['coconut', 3], ['shell', 2], ['honey', 1]],            goal: 'flag' },
];

export const CHARS = {
  zelia:   { bg: '#7a2d4a' },
  teodoro: { bg: '#8a6a2a' },
  lia:     { bg: '#1f6f8b' },
  bento:   { bg: '#4a4a58' },
  marta:   { bg: '#2e6b4f' },
  caio:    { bg: '#6b2d2d' },
  sol:     { bg: '#20507a' },
};
export const GIVERS = ['zelia', 'teodoro', 'lia', 'bento', 'marta'];
export const CUSTOMERS = ['zelia', 'teodoro', 'marta', 'lia', 'bento'];

// Quest types: base target and growth per quest index.
export const QUEST = {
  harvest:    { base: 10, grow: 2 },
  clear:      { base: 4,  grow: 1 },
  build:      { base: 1,  grow: 0.2 },
  deliver:    { base: 1,  grow: 0.3 },
  expedition: { base: 1,  grow: 0.15 },
  produce:    { base: 3,  grow: 1 },
  feed:       { base: 3,  grow: 0.8 },
  collect:    { base: 5,  grow: 1 },
  plant:      { base: 8,  grow: 2 },
};
export const QUEST_ORDER = ['harvest', 'plant', 'clear', 'build', 'produce', 'deliver', 'feed', 'collect', 'expedition'];

// Player level curve: cumulative XP needed for each level.
export function levelInfo(xp) {
  let L = 1, acc = 0;
  for (;;) {
    const need = Math.round(25 * Math.pow(L, 1.2));
    if (xp < acc + need) return { level: L, into: xp - acc, need };
    acc += need;
    L++;
  }
}

export function maxEnergy(level) {
  return Math.min(ENERGY_CAP, 100 + 4 * (level - 1));
}

// Unlocked tile index helpers
export const idx = (x, y) => y * GRID + x;
export function inBox(x, y) {
  return x >= 0 && y >= 0 && x < GRID && y < GRID;
}
export function ringOf(x, y) {
  const { x0, y0, x1, y1 } = START;
  return Math.max(x0 - x, x - x1, y0 - y, y - y1, 0);
}
export function unlockCost(x, y) {
  const r = ringOf(x, y);
  return 60 + 30 * (r - 1);
}
export function fieldCost(fields) {
  return 25 + 5 * fields;
}

export function kindOf(id) {
  if (PENS[id]) return 'pen';
  if (PROD[id]) return 'prod';
  if (DECOR[id]) return 'deco';
  return null;
}
export function sizeOf(id) {
  if (PENS[id] || PROD[id]) return 2;
  return DECOR[id].size;
}
export function lvlOf(id) {
  return (PENS[id] || PROD[id] || DECOR[id]).lvl;
}
export function costOf(id) {
  return PENS[id] ? PENS[id].build : PROD[id] ? PROD[id].build : DECOR[id].cost;
}
export const BUILDABLE = [...Object.keys(PENS), ...Object.keys(PROD), ...Object.keys(DECOR)];
