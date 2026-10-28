// Progression helpers: unlocks, ranks, persistence shape.

import { TOWERS, SKINS, rankForMedals, RANK_NAMES } from './data.js';

export function defaultMeta() {
  return { kills: 0, wins: 0, games: 0, medals: 0, skin: 'classic', best: {}, lastTrack: null };
}

export function unlockedTowers(kills) {
  return new Set(Object.values(TOWERS).filter((t) => t.unlock <= kills).map((t) => t.id));
}

export function unlockedSkin(skinId, wins) {
  const s = SKINS[skinId];
  return !!s && s.unlock <= wins;
}

export function roman(n) {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n - 1] || String(n);
}

// Arena rank: 3 divisions per named rank; beyond the named ranks the ladder goes on forever.
export function rankInfo(medals) {
  const level = rankForMedals(medals);
  const idx = Math.floor((level - 1) / 3);
  const div = ((level - 1) % 3) + 1;
  const named = idx < RANK_NAMES.length;
  return { level, idx, div, named, nameKey: named ? RANK_NAMES[idx] : null, nextN: idx - RANK_NAMES.length + 2 };
}

// Medals needed for the next level after `medals`.
export function nextRankAt(level) {
  return 5 * level * (level + 1) / 2 - 0;
}
