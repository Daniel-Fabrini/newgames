// Global player progression shared by every game: XP → level (no cap),
// per-game XP, and a daily play streak.

import { createStore } from './store.js';

const store = createStore('app');

// XP needed to go from `level` to `level + 1`. Grows linearly, so levels
// keep coming forever but each one takes a bit longer.
export function xpForLevel(level) {
  return 100 + (level - 1) * 40;
}

export function levelInfo(xp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  let need = xpForLevel(level);
  while (rest >= need) {
    rest -= need;
    level++;
    need = xpForLevel(level);
  }
  return { level, into: rest, need, progress: rest / need };
}

export function totalXP() {
  return store.get('xp', 0);
}

export function gameXP(id) {
  return store.get(`xp:${id}`, 0);
}

// Adds XP (to the player and to the game). Returns { gained, before, after }
// where before/after are levelInfo() results.
export function addXP(amount, gameId = null) {
  const gained = Math.max(0, Math.round(Number(amount) || 0));
  const prev = totalXP();
  const before = levelInfo(prev);
  if (!gained) return { gained, before, after: before };
  store.set('xp', prev + gained);
  if (gameId) store.set(`xp:${gameId}`, gameXP(gameId) + gained);
  return { gained, before, after: levelInfo(prev + gained) };
}

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Call when the player opens a game. Consecutive days increase the streak.
export function touchStreak() {
  const today = dayKey();
  const last = store.get('streakDay', null);
  if (last === today) return streak();
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  const next = last === yesterday ? store.get('streak', 0) + 1 : 1;
  store.set('streak', next);
  store.set('streakDay', today);
  store.set('bestStreak', Math.max(next, store.get('bestStreak', 0)));
  return next;
}

export function streak() {
  const last = store.get('streakDay', null);
  if (!last) return 0;
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  return last === today || last === yesterday ? store.get('streak', 0) : 0;
}

export function lastPlayed() {
  return store.get('lastGame', null);
}

export function setLastPlayed(id) {
  store.set('lastGame', id);
}

// Rank names by level band, for the profile card.
const RANKS = [
  { from: 1, pt: 'Novato', en: 'Rookie', es: 'Novato' },
  { from: 5, pt: 'Aprendiz', en: 'Apprentice', es: 'Aprendiz' },
  { from: 10, pt: 'Aventureiro', en: 'Adventurer', es: 'Aventurero' },
  { from: 20, pt: 'Veterano', en: 'Veteran', es: 'Veterano' },
  { from: 35, pt: 'Especialista', en: 'Expert', es: 'Experto' },
  { from: 50, pt: 'Mestre', en: 'Master', es: 'Maestro' },
  { from: 75, pt: 'Grão-Mestre', en: 'Grandmaster', es: 'Gran Maestro' },
  { from: 100, pt: 'Lenda', en: 'Legend', es: 'Leyenda' },
];

export function rankFor(level) {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.from) r = x;
  return r;
}
