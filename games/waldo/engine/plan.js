// Levels: which picture, which hidden characters/items to find, how big the playable
// window is, the par time for 3 stars and (later on) a time limit. Everything is
// deterministic: classic level n and the daily level of a date are always the same.

export const CHAPTER_SCENES = 5;
export const HINT_PRICE = 12;
export const DAILY_COINS = 25;

// Pictures in order of difficulty (endless: the list repeats, mirrored every other lap).
export const SCENES = ['beach', 'fair', 'toyshop', 'station', 'harbor', 'castle', 'ski', 'jungle', 'stadium', 'space'];
export const SCENE_KEY = {
  beach: 'sceneBeach',
  fair: 'sceneFair',
  toyshop: 'sceneToyshop',
  station: 'sceneStation',
  harbor: 'sceneHarbor',
  castle: 'sceneCastle',
  ski: 'sceneSki',
  jungle: 'sceneJungle',
  stadium: 'sceneStadium',
  space: 'sceneSpace',
};

// Hidden things. `hero` is always on the list; friends are shuffled in.
export const TARGET_IDS = ['hero', 'dog', 'wizard', 'camera', 'key', 'scroll', 'teddy', 'duck'];
const EASY_FRIENDS = ['dog', 'wizard', 'teddy', 'camera'];
const HARD_FRIENDS = ['key', 'scroll', 'duck'];
export const TARGET_KEY = {
  hero: 'Hero',
  dog: 'Dog',
  wizard: 'Wizard',
  camera: 'Camera',
  key: 'Key',
  scroll: 'Scroll',
  teddy: 'Teddy',
  duck: 'Duck',
};

// cyrb53 string hash
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

function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// idx: 0-based level number (difficulty). Returns the plan; `resolveLevel` finishes it
// once the picture's hit data is known.
export function classicPlan(idx) {
  return { key: `classic-${idx}`, scene: SCENES[idx % SCENES.length], lap: Math.floor(idx / SCENES.length), seed: hash(`wl:${idx}`), lvl: idx, n: targetCount(idx) };
}
export function timedPlan(session, k) {
  const lvl = Math.min(14, 2 + Math.floor(k * 0.7));
  const idx = (session.offset + k) % SCENES.length;
  return { key: `timed-${session.seed}-${k}`, scene: SCENES[idx], lap: session.seed % 2, seed: hash(`wt:${session.seed}:${k}`), lvl, n: 2, timed: true };
}
export function dailyPlan(dateKey) {
  const hv = hash(`wd:${dateKey}`);
  return { key: `daily-${dateKey}`, scene: SCENES[hv % SCENES.length], lap: (hv >>> 8) % 2, seed: hv, lvl: 8, n: 4, daily: true };
}

// hero + 2..5 others, growing with the level
function targetCount(idx) {
  return Math.min(6, 3 + Math.floor(idx / 3));
}

// Picks the friends and the playable window from the picture's hit data.
// meta: { w, h, targets: { id: { x, y, bb:[x0,y0,x1,y1] } } } in the picture's own (unmirrored) coordinates.
export function resolveLevel(plan, meta) {
  const rnd = rngOf(plan.seed);
  const W = meta.w, H = meta.h;
  const lvl = plan.lvl;
  const have = (id) => !!meta.targets[id];
  const shuffle = (a) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const hero = meta.targets.hero;
  // early levels: friends close to the hero (a small playable window); later: anywhere
  let pool = lvl < 6 ? EASY_FRIENDS : lvl < 12 ? EASY_FRIENDS.concat(HARD_FRIENDS) : EASY_FRIENDS.concat(HARD_FRIENDS, HARD_FRIENDS);
  pool = shuffle([...new Set(pool)].filter(have));
  const compact = lvl < 9 && !plan.daily;
  if (compact) {
    const d = (id) => Math.hypot(meta.targets[id].x - hero.x, meta.targets[id].y - hero.y);
    pool.sort((a, b) => d(a) - d(b));
    if (lvl >= 4) pool = shuffle(pool.slice(0, Math.max(plan.n, 4)));
  }
  const ids = ['hero', ...pool.slice(0, Math.max(1, plan.n - 1))];
  // playable window: hugs the targets, never smaller than a growing fraction of the picture
  const minFrac = plan.daily ? 0.85 : Math.min(1, 0.46 + lvl * 0.045);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const id of ids) {
    const b = meta.targets[id].bb;
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  }
  const margin = 260;
  let rw = Math.max(x1 - x0 + margin * 2, W * minFrac);
  let rh = Math.max(y1 - y0 + margin * 2, H * minFrac);
  // keep the picture's aspect
  const asp = W / H;
  if (rw / rh > asp) rh = rw / asp;
  else rw = rh * asp;
  rw = Math.min(rw, W);
  rh = Math.min(rh, H);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let rx = Math.max(0, Math.min(W - rw, cx - rw / 2));
  let ry = Math.max(0, Math.min(H - rh, cy - rh / 2));
  return { ids, region: { x: rx, y: ry, w: rw, h: rh }, par: parTime(plan, ids.length), limit: timeLimit(plan, ids.length) };
}

function parTime(plan, n) {
  if (plan.timed) return 30;
  const per = 15 + Math.min(plan.lvl, 24) * 0.7;
  return Math.round(10 + n * per);
}

// Classic only, from level 7 on: a generous countdown (par x 3.4 + 30 s).
function timeLimit(plan, n) {
  if (plan.timed || plan.daily || plan.lvl < 6) return 0;
  return Math.round(parTime(plan, n) * 3.4 + 30);
}

export function starsFor(seconds, par) {
  if (seconds <= par) return 3;
  if (seconds <= par * 2) return 2;
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
