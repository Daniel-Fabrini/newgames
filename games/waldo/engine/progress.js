// Scene plans (which theme, seed and difficulty each scene uses), star rules,
// date keys and a small game clock. Deterministic where it matters: classic
// scene n and the daily scene of a date are always the same picture.

import { THEMES } from './themes.js';

export const CHAPTER_SCENES = 5;
export const HINT_PRICE = 12;
export const DAILY_COINS = 25;

// cyrb53: a small, well-mixed 53-bit string hash.
export function hash(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0;
}

export function classicPlan(idx) {
  return { key: `classic-${idx}`, theme: THEMES[idx % THEMES.length], seed: hash(`classic:${idx}`), lvl: idx };
}

export function timedPlan(session, k) {
  return {
    key: `timed-${session.seed}-${k}`,
    theme: THEMES[(session.offset + k) % THEMES.length],
    seed: hash(`timed:${session.seed}:${k}`),
    lvl: Math.floor(k * 0.8),
  };
}

export function dailyPlan(dateKey) {
  const hv = hash(`daily:${dateKey}`);
  return { key: `daily-${dateKey}`, theme: THEMES[hv % THEMES.length], seed: hv, lvl: 4 };
}

// Three stars when found within T seconds, two within 2T, otherwise one.
export function starsFor(seconds, lvl) {
  const T = Math.max(12, 24 - lvl * 0.35);
  if (seconds <= T) return 3;
  if (seconds <= 2 * T) return 2;
  return 1;
}

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function yesterdayKey() {
  return dateKey(new Date(Date.now() - 864e5));
}

export function mmss(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// A pausable clock in seconds.
export function makeClock() {
  let acc = 0;
  let pausedAt = null;
  let last = performance.now();
  return {
    elapsed() {
      const now = pausedAt ?? performance.now();
      return Math.max(0, (now - last - acc) / 1000);
    },
    pause() {
      if (pausedAt === null) pausedAt = performance.now();
    },
    resume() {
      if (pausedAt !== null) {
        acc += performance.now() - pausedAt;
        pausedAt = null;
      }
    },
    get paused() {
      return pausedAt !== null;
    },
  };
}
