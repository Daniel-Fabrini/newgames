// Seedable PRNG (mulberry32) + Fisher-Yates shuffle. Pure, no globals.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Mix several integers into one 32-bit seed (for per-hand / per-table seeds). */
export function mixSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h ^= (p | 0) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}
/** Real random seed for actual games (never used in tests). */
export function randomSeed() {
  try {
    const c = globalThis.crypto;
    if (c && c.getRandomValues) { const a = new Uint32Array(1); c.getRandomValues(a); return a[0]; }
  } catch (e) { /* fall through */ }
  return (Date.now() ^ (Math.random() * 4294967296)) >>> 0;
}
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
export function freshDeck() { const d = new Array(52); for (let i = 0; i < 52; i++) d[i] = i; return d; }
