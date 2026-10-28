// Static game data and balance formulas: buildings, troops, heroes, themes,
// enemies, bosses, economy, daily missions. Everything scales forever.

export const SAVE_VERSION = 2;

// ---------------------------------------------------------------- buildings
// Iso footprint (tiles) and position on the base map (top-left tile).
export const BUILDINGS = [
  { id: 'hq', gx: 8, gy: 8, w: 3, h: 3, g: 220, m: 160 },
  { id: 'barracks', gx: 4, gy: 9, w: 2, h: 2, g: 60, m: 30 },
  { id: 'arms', gx: 5, gy: 5, w: 2, h: 2, g: 80, m: 45 },
  { id: 'range', gx: 8, gy: 12, w: 2, h: 2, g: 80, m: 40 },
  { id: 'hospital', gx: 12, gy: 8, w: 2, h: 2, g: 70, m: 40 },
  { id: 'goldmine', gx: 9, gy: 4, w: 2, h: 2, g: 60, m: 50 },
  { id: 'factory', gx: 13, gy: 12, w: 2, h: 2, g: 60, m: 25 },
  { id: 'tower', gx: 15, gy: 4, w: 2, h: 2, g: 120, m: 90 },
];
export const BLDMAP = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
// Hero garages: shown on the base once the hero is unlocked.
export const GARAGES = [
  { id: 'tank', gx: 4, gy: 13, w: 2, h: 2 },
  { id: 'jet', gx: 15, gy: 15, w: 3, h: 2 },
  { id: 'missile', gx: 3, gy: 4, w: 2, h: 2 },
];

const nice = (v) => {
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 10000) return Math.round(v / 50) * 50;
  return Math.round(v / 500) * 500;
};

// Cost to go from `lvl` to `lvl + 1`.
export function bldCost(id, lvl) {
  const b = BLDMAP[id];
  const f = Math.pow(lvl, 1.55);
  return { gold: nice(b.g * f), mat: nice(b.m * f) };
}
export function bldMaxLevel(save, id) {
  return id === 'hq' ? Infinity : save.bld.hq + (id === 'goldmine' || id === 'factory' ? 1 : 0);
}

// Production per hour / storage.
export function goldPerHour(lvl) {
  return Math.round(60 * Math.pow(lvl, 1.2));
}
export function matPerHour(lvl) {
  return Math.round(40 * Math.pow(lvl, 1.2));
}
export function storageHours(hq) {
  return Math.min(12, 5 + hq);
}

// ---------------------------------------------------------------- troops
export function trainCost(t) {
  const rankUp = (t + 1) % 5 === 0;
  return { gold: nice(50 * Math.pow(t + 1, 1.5)), gems: rankUp ? 5 + 5 * Math.floor((t + 1) / 5) : 0 };
}
export function rankOf(t) {
  return Math.floor(t / 5);
}
// Helmet colors per rank (cycles with stars after the last one).
export const RANK_COLORS = ['#4f7a3a', '#3f6fd8', '#2aa6a0', '#8a5cd6', '#d64f7a', '#e0782a', '#c9a227', '#e8e8f0', '#202020'];

// ---------------------------------------------------------------- heroes
export const HEROES = [
  { id: 'tank', gold: 0, gems: 0, c1: '#9bbf4a', c2: '#3e5221' },
  { id: 'jet', gold: 1500, gems: 25, c1: '#5fb4ff', c2: '#1d4f9c' },
  { id: 'missile', gold: 4000, gems: 60, c1: '#ff7a5c', c2: '#8e1f1f' },
];
export const HEROMAP = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export function heroLvlCost(id, lvl) {
  const mul = id === 'tank' ? 1 : id === 'jet' ? 1.15 : 1.3;
  const f = Math.pow(lvl, 1.6) * mul;
  return { gold: nice(110 * f), mat: nice(55 * f) };
}

// Ability numbers. k = damage in "seconds of the squad's current DPS".
export function heroStats(id, lvl, towerLvl = 1) {
  const l = Math.max(0, lvl - 1);
  const pm = 1 + 0.08 * (towerLvl - 1);
  const cm = 1 / (1 + 0.03 * (towerLvl - 1));
  if (id === 'tank') return { cd: (7 + 9 / (1 + 0.12 * l)) * cm, dur: 3 + 3 * (1 - 1 / (1 + 0.18 * l)), k: (1 + 0.35 * l) * pm, radius: 140 };
  if (id === 'jet') return { cd: (6 + 8 / (1 + 0.12 * l)) * cm, k: (2.4 + 0.45 * l) * pm, radius: 85 };
  return { cd: (5 + 7 / (1 + 0.12 * l)) * cm, k: (4 + 0.7 * l) * pm, radius: 150 };
}

// ---------------------------------------------------------------- save
export function defaultSave(now = Date.now()) {
  const bld = {};
  for (const b of BUILDINGS) bld[b.id] = 1;
  return {
    v: SAVE_VERSION,
    gold: 300,
    mat: 150,
    gems: 10,
    level: 1,
    stars: {},
    bld,
    prod: { gold: now, mat: now },
    train: 0,
    heroes: { tank: { own: true, lvl: 1 }, jet: { own: false, lvl: 1 }, missile: { own: false, lvl: 1 } },
    hero: 'tank',
    daily: null,
    stats: { kills: 0, wins: 0, gates: 0, bosses: 0, runs: 0 },
    bestDist: 0,
    supplyT: 0,
    seen: {},
    helpShown: false,
  };
}

export function migrateSave(s, now = Date.now()) {
  const d = defaultSave(now);
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return d;
  const out = { ...d, ...s };
  out.bld = { ...d.bld, ...(s.bld || {}) };
  out.prod = { ...d.prod, ...(s.prod || {}) };
  out.stats = { ...d.stats, ...(s.stats || {}) };
  out.heroes = {};
  for (const k of Object.keys(d.heroes)) out.heroes[k] = { ...d.heroes[k], ...((s.heroes || {})[k] || {}) };
  out.heroes.tank.own = true;
  out.stars = { ...(s.stars || {}) };
  out.seen = { ...(s.seen || {}) };
  if (!out.heroes[out.hero] || !out.heroes[out.hero].own) out.hero = 'tank';
  for (const k of ['gold', 'mat', 'gems', 'train', 'bestDist']) out[k] = Math.max(0, Math.floor(out[k]) || 0);
  out.level = Math.max(1, Math.floor(out.level) || 1);
  for (const k of Object.keys(out.prod)) if (!(out.prod[k] <= now)) out.prod[k] = now;
  return out;
}

// Player stats used by the runner.
export function playerStats(save) {
  const b = save.bld;
  const tr = 1 + 0.05 * save.train;
  return {
    startN: 2 + b.barracks,
    dmg: (1 + 0.1 * (b.arms - 1)) * tr,
    rate: 2.6 * (1 + 0.06 * (b.range - 1)),
    hp: (1 + 0.1 * (b.hospital - 1)) * tr,
    rank: rankOf(save.train),
  };
}

export function powerRating(save) {
  const s = playerStats(save);
  let heroL = 0;
  for (const h of HEROES) if (save.heroes[h.id].own) heroL += save.heroes[h.id].lvl;
  return Math.round(60 * s.dmg * (s.rate / 2.6) * s.hp * (1 + 0.06 * s.startN) * (1 + 0.04 * (save.bld.tower - 1)) + 15 * heroL);
}

// ---------------------------------------------------------------- economy
export function levelReward(level) {
  return { gold: Math.round(40 + 18 * level + 0.1 * level * level), mat: Math.round(15 + 7 * level) };
}
export const STAR_MUL = [0, 1, 1.25, 1.5];
export function killCoin(level) {
  return 1 + Math.floor(level / 12);
}

// Nominal upgrade levels the generator assumes (keeps the curve smooth).
export function nominalStats(level) {
  const u = 0.55 * Math.pow(Math.max(0, level - 1), 0.85);
  return {
    startN: 3 + u,
    dmg: (1 + 0.1 * u) * (1 + 0.05 * u * 0.8),
    rate: 2.6 * (1 + 0.06 * u),
    hp: (1 + 0.1 * u) * (1 + 0.05 * u * 0.8),
  };
}

// ---------------------------------------------------------------- themes
export const THEMES = [
  {
    id: 'city',
    ground: '#5b6a4a', ground2: '#536142', walk: '#8d919b', walk2: '#7a7e88', road: '#4a4e5a', road2: '#30333d',
    line: '#f1e7c4', curbA: '#e7e7ea', curbB: '#d64545', fog: '#e2c3a0', glow: '#ffd59a', dark: 0, ambient: 'dust',
    props: ['building', 'lamp', 'car', 'tree', 'cone', 'building', 'tree'],
  },
  {
    id: 'desert',
    ground: '#dcb877', ground2: '#d0aa69', walk: '#c2a67c', walk2: '#ad916a', road: '#73685a', road2: '#564d42',
    line: '#fff1c9', curbA: '#f2e2c0', curbB: '#c46a2b', fog: '#f7dcaa', glow: '#fff0b8', dark: 0, ambient: 'sand',
    props: ['cactus', 'rock', 'wreck', 'cactus', 'drums', 'skull', 'sign'],
  },
  {
    id: 'snow',
    ground: '#e9eff7', ground2: '#dce5f0', walk: '#c9d3df', walk2: '#b8c3d1', road: '#5a6472', road2: '#3f4753',
    line: '#ffffff', curbA: '#f4f8ff', curbB: '#3d7be0', fog: '#e6eef8', glow: '#ffffff', dark: 0, ambient: 'snow',
    props: ['pine', 'pine', 'snowrock', 'car', 'lamp', 'pine', 'fence'],
  },
  {
    id: 'night',
    ground: '#22332b', ground2: '#1d2d26', walk: '#3d4352', walk2: '#343947', road: '#2d303b', road2: '#1c1e26',
    line: '#d9cf8f', curbA: '#a3a9bd', curbB: '#8a2a3e', fog: '#141a33', glow: '#7c8cff', dark: 0.6, ambient: 'embers',
    props: ['building', 'lamp', 'car', 'tree', 'lamp', 'building', 'cone'],
  },
  {
    id: 'toxic',
    ground: '#4b5b2d', ground2: '#435228', walk: '#5f6652', walk2: '#515846', road: '#363e35', road2: '#242a23',
    line: '#d8ff5a', curbA: '#e6e04a', curbB: '#2b2b2b', fog: '#a5cf5f', glow: '#d0ff66', dark: 0.15, ambient: 'spores',
    props: ['drums', 'deadtree', 'pipe', 'hazard', 'drums', 'deadtree', 'pipe'],
  },
];
export const LEVELS_PER_REGION = 10;
export function regionOf(level) {
  return Math.floor((level - 1) / LEVELS_PER_REGION);
}
export function themeIndex(level) {
  return regionOf(level) % THEMES.length;
}
export function themeFor(level) {
  return THEMES[themeIndex(level)];
}
// Roman numeral suffix for repeated regions (II, III…).
export function roman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) while (n >= v) {
    s += r;
    n -= v;
  }
  return s;
}
export const ENDLESS_ZONE = 3000; // world units per survival zone (300 m)

// ---------------------------------------------------------------- enemies
export const ZTYPES = {
  walker: { from: 1, hpW: 1, powW: 1, spd: 42, lat: 38, r: 9, w: 18, h: 28, coin: 1 },
  brute: { from: 2, hpW: 7, powW: 5, spd: 30, lat: 26, r: 17, w: 36, h: 46, coin: 4, bar: true },
  runner: { from: 4, hpW: 0.6, powW: 0.8, spd: 120, lat: 70, r: 8, w: 17, h: 27, coin: 1 },
  armored: { from: 8, hpW: 2.6, powW: 1.4, spd: 34, lat: 30, r: 10, w: 20, h: 29, coin: 2 },
  bloater: { from: 13, hpW: 2.2, powW: 3, spd: 30, lat: 28, r: 13, w: 28, h: 30, coin: 2, explodes: true },
  crawler: { from: 18, hpW: 0.7, powW: 1, spd: 95, lat: 60, r: 9, w: 24, h: 15, coin: 1 },
  giant: { from: 26, hpW: 20, powW: 12, spd: 24, lat: 20, r: 26, w: 60, h: 76, coin: 10, bar: true },
};
export const ZORDER = ['walker', 'brute', 'runner', 'armored', 'bloater', 'crawler', 'giant'];
export function newEnemyAt(level) {
  return ZORDER.find((k) => ZTYPES[k].from === level && level > 1) || null;
}

// ---------------------------------------------------------------- bosses
export const BOSSES = [
  { id: 'hulk', from: 1, w: 104, h: 128, r: 42, hpMul: 1, spd: 85, stomp: 1, minion: null },
  { id: 'iron', from: 6, w: 112, h: 132, r: 44, hpMul: 1.2, spd: 72, stomp: 1.1, minion: null },
  { id: 'abom', from: 11, w: 124, h: 118, r: 46, hpMul: 0.95, spd: 70, stomp: 1, minion: { type: 'walker', every: 3.2, count: 4 } },
  { id: 'queen', from: 21, w: 100, h: 142, r: 40, hpMul: 0.9, spd: 92, stomp: 0.9, minion: { type: 'runner', every: 2.6, count: 3 } },
  { id: 'colossus', from: 31, w: 140, h: 170, r: 54, hpMul: 1.35, spd: 60, stomp: 1.4, minion: { type: 'crawler', every: 4, count: 4 } },
];
export const BOSSMAP = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
export function bossFor(level) {
  const fresh = BOSSES.find((b) => b.from === level);
  if (fresh) return fresh;
  const unlocked = BOSSES.filter((b) => b.from <= level);
  return unlocked[(level * 7 + Math.floor(level / 3)) % unlocked.length];
}
export function isMegaLevel(level) {
  return level % LEVELS_PER_REGION === 0;
}

// ---------------------------------------------------------------- daily missions
export const MISSIONS = [
  { id: 'kills', goal: (L) => 120 + 10 * Math.min(L, 40) },
  { id: 'wins', goal: () => 2 },
  { id: 'gates', goal: () => 12 },
  { id: 'ability', goal: () => 5 },
  { id: 'dist', goal: () => 400 },
  { id: 'bosses', goal: () => 2 },
  { id: 'crates', goal: () => 3 },
  { id: 'upgrade', goal: () => 2 },
];
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function missionReward(i, level) {
  // i: slot 0..2
  if (i === 0) return { gold: nice(150 + 30 * level), mat: 0, gems: 0 };
  if (i === 1) return { gold: 0, mat: nice(80 + 15 * level), gems: 0 };
  return { gold: 0, mat: 0, gems: 10 };
}
export const SUPPLY_EVERY = 4 * 3600 * 1000; // free supply crate cooldown (ms)

// Number formatting: 2.5K, 12K, 1.2M
export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 10000) return (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1e6) return Math.floor(n / 1000) + 'K';
  if (n < 1e7) return (Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '') + 'M';
  return Math.floor(n / 1e6) + 'M';
}
