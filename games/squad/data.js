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
  return id === 'hq' ? Infinity : save.bld.hq + 2;
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
  const q = Math.sqrt(l);
  if (id === 'tank') return { cd: (7 + 9 / (1 + 0.12 * l)) * cm, dur: 3 + 3 * (1 - 1 / (1 + 0.18 * l)), k: (1 + 0.4 * q) * pm, radius: 140 };
  if (id === 'jet') return { cd: (6 + 8 / (1 + 0.12 * l)) * cm, k: (1.8 + 0.5 * q) * pm, radius: 85 };
  return { cd: (5 + 7 / (1 + 0.12 * l)) * cm, k: (3 + 1.2 * q) * pm, radius: 150 };
}

// ---------------------------------------------------------------- save
export function defaultSave(now = Date.now()) {
  const bld = {};
  for (const b of BUILDINGS) bld[b.id] = 1;
  return {
    v: SAVE_VERSION,
    gold: 300,
    mat: 200,
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
// Every region is a canyon road; the theme tints the pre-rendered rock walls
// (`rock` is a CSS filter applied once at load), the road and the haze.
export const THEMES = [
  {
    id: 'canyon', ground: '#c9a273', ground2: '#a77f52', dark: 0,
    rock: 'none', road: [204, 192, 174], haze: '#f3dcb8', sky: '#f6e3c4', edge: '#7a5a3a',
  },
  {
    id: 'redrock', ground: '#c47a52', ground2: '#9a5134', dark: 0,
    rock: 'hue-rotate(-14deg) saturate(1.45) brightness(0.92)', road: [214, 176, 150], haze: '#f0b98f', sky: '#f7cfa6', edge: '#6e3420',
  },
  {
    id: 'frost', ground: '#dfe7f1', ground2: '#b9c6d6', dark: 0,
    rock: 'saturate(0.15) brightness(1.18) contrast(0.95)', road: [222, 228, 236], haze: '#eef4fb', sky: '#f4f8fd', edge: '#7b8796',
  },
  {
    id: 'dusk', ground: '#5d4a63', ground2: '#3b2e44', dark: 0.45,
    rock: 'hue-rotate(-40deg) saturate(0.8) brightness(0.62)', road: [150, 138, 150], haze: '#9a6f86', sky: '#c88a7a', edge: '#2a1f30',
  },
  {
    id: 'toxic', ground: '#7d8a4a', ground2: '#56602f', dark: 0.1,
    rock: 'hue-rotate(38deg) saturate(0.9) brightness(0.9)', road: [190, 192, 160], haze: '#cfe39a', sky: '#dfeeb0', edge: '#3e4520',
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
export const ENDLESS_ZONE = 100; // metres per survival zone

// ---------------------------------------------------------------- weapons
// Squad weapon tiers. Tier 0 is the starting rifle; pickups on pedestals give
// tiers 1..5 (sprite w0..w4). Beyond the last tier each pickup adds +30% damage.
export const WEAPONS = [
  { id: 'rifle', dmg: 1, rate: 3.2, tracer: '#ffe9a8', w: 1 },
  { id: 'smg', dmg: 1, rate: 5, tracer: '#fff1b0', w: 1 },
  { id: 'ar', dmg: 1.6, rate: 5.5, tracer: '#ffd36b', w: 1.2 },
  { id: 'lmg', dmg: 2.3, rate: 6.5, tracer: '#ffb84a', w: 1.4 },
  { id: 'minigun', dmg: 2.4, rate: 11, tracer: '#ffcf5a', w: 1.3 },
  { id: 'plasma', dmg: 6, rate: 7, tracer: '#6ff6ff', w: 1.8 },
];
export const MAX_TIER = WEAPONS.length - 1;
export function weaponDps(tier) {
  const w = WEAPONS[Math.min(tier, MAX_TIER)];
  return w.dmg * w.rate * Math.pow(1.3, Math.max(0, tier - MAX_TIER));
}

// ---------------------------------------------------------------- statue heroes (in-level allies)
// dpsK: damage per second as a multiple of one soldier's DPS; hp: hits absorbed.
export const STATUES = {
  gunner: { dpsK: 9, rate: 5, hp: 8, splash: 0 },
  heavy: { dpsK: 15, rate: 14, hp: 14, splash: 0 },
  rocket: { dpsK: 12, rate: 0.9, hp: 6, splash: 2.6 },
};
export const STATUE_ORDER = ['gunner', 'heavy', 'rocket'];

// ---------------------------------------------------------------- enemies
// World units are metres. hpW: HP weight (× level HP unit), pow: soldiers killed on contact.
export const ZTYPES = {
  grunt: { from: 1, hpW: 1, pow: 1, spd: 2.5, r: 0.34, coin: 1, spr: 'red', scale: 1 },
  brute: { from: 2, hpW: 22, pow: 5, spd: 1.5, r: 0.8, coin: 8, spr: 'bru', scale: 1, bar: true, big: true },
  shield: { from: 3, hpW: 3, pow: 1, spd: 2.1, r: 0.38, coin: 2, spr: 'shd', scale: 1 },
  runner: { from: 5, hpW: 0.7, pow: 1, spd: 4.6, r: 0.3, coin: 1, spr: 'org', scale: 0.88 },
  elite: { from: 9, hpW: 6, pow: 2, spd: 2.2, r: 0.4, coin: 3, spr: 'blk', scale: 1.08 },
  giant: { from: 16, hpW: 60, pow: 9, spd: 1.25, r: 1.0, coin: 16, spr: 'bru', scale: 1.35, bar: true, big: true },
};
export const ZORDER = ['grunt', 'brute', 'shield', 'runner', 'elite', 'giant'];
export function newEnemyAt(level) {
  return ZORDER.find((k) => ZTYPES[k].from === level && level > 1) || null;
}

// ---------------------------------------------------------------- bosses (end of every level)
export const BOSSES = [
  { id: 'juggernaut', from: 1, hpMul: 1, scale: 1.65, spr: 'bru', spd: 1.2, stomp: 1, minion: null },
  { id: 'warlord', from: 6, hpMul: 1.1, scale: 1.75, spr: 'blkbru', spd: 1.1, stomp: 1.1, minion: { type: 'runner', every: 3, count: 4 } },
  { id: 'titan', from: 11, hpMul: 1.2, scale: 1.9, spr: 'bru', spd: 1.0, stomp: 1.3, minion: { type: 'shield', every: 3.5, count: 3 } },
  { id: 'inferno', from: 21, hpMul: 1.0, scale: 1.75, spr: 'orgbru', spd: 1.3, stomp: 1, minion: { type: 'grunt', every: 2.2, count: 6 } },
  { id: 'colossus', from: 31, hpMul: 1.4, scale: 2.2, spr: 'blkbru', spd: 0.9, stomp: 1.5, minion: { type: 'elite', every: 4, count: 3 } },
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
