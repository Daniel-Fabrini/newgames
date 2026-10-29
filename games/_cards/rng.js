// Seedable PRNG (mulberry32) with serialisable state + Fisher–Yates shuffle.
//   const rng = createRng(12345);           // or createRng() → random seed
//   rng.next()  → float in [0,1)            rng.int(6) → 0..5
//   const saved = rng.state;                // a plain uint32 → JSON-safe
//   rng.state = saved;  (or rng.restore(saved))  → resumes the exact same sequence
//   shuffle(arr, rng)   → NEW shuffled array (fair Fisher–Yates)

/** Cryptographically random uint32 seed (falls back to Date/Math.random). */
export function randomSeed() {
  try {
    const a = new Uint32Array(1);
    (globalThis.crypto || window.crypto).getRandomValues(a);
    return a[0] >>> 0;
  } catch {
    return ((Date.now() ^ (Math.random() * 4294967296)) >>> 0) || 1;
  }
}

/** Hash any string (or number) to a uint32 seed. */
export function seedFrom(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
  const str = String(value);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed = randomSeed()) {
  const initialSeed = seedFrom(seed);
  let s = initialSeed;
  const api = {
    /** float in [0,1) */
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** integer in [0, n) */
    int(n) {
      return Math.floor(api.next() * n);
    },
    /** integer in [min, max] inclusive */
    range(min, max) {
      return min + api.int(max - min + 1);
    },
    chance(p = 0.5) {
      return api.next() < p;
    },
    pick(arr) {
      return arr[api.int(arr.length)];
    },
    shuffle(arr) {
      return shuffle(arr, api);
    },
    /** Serialisable position in the sequence (uint32). */
    get state() {
      return s >>> 0;
    },
    set state(v) {
      s = v >>> 0;
    },
    restore(v) {
      s = v >>> 0;
      return api;
    },
    get seed() {
      return initialSeed;
    },
    /** Math.random-compatible function view of this generator. */
    get fn() {
      return api.next;
    },
    /** Independent generator derived from this one (does advance this one). */
    fork() {
      return createRng(Math.floor(api.next() * 4294967296));
    },
  };
  return api;
}

/** Fisher–Yates; returns a new array. `rng` = createRng() object, a () => float function, or omitted (Math.random). */
export function shuffle(arr, rng) {
  const f = !rng ? Math.random : typeof rng === 'function' ? rng : () => rng.next();
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(f() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

export function shuffleInPlace(a, rng) {
  const f = !rng ? Math.random : typeof rng === 'function' ? rng : () => rng.next();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(f() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
