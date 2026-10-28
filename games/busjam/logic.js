// Pure game logic for "Bus Jam": geometry, level generator and solver.
// No DOM here, so it can be unit-tested in Node.
//
// Lot coordinates: 1 unit = 1 parking cell, origin at the top-left of the lot,
// x to the right, y down. A vehicle is an oriented rectangle (OBB) that can
// only move forward along its direction (8 directions, 0 = up, clockwise).

export const PALETTE = [
  { key: 'red', base: '#f2434f', dark: '#a91d33', light: '#ff9aa0', ink: '#ffffff', sym: 'circle' },
  { key: 'blue', base: '#2f7bff', dark: '#1847b8', light: '#9cc2ff', ink: '#ffffff', sym: 'square' },
  { key: 'green', base: '#28c25a', dark: '#137a37', light: '#94ecae', ink: '#ffffff', sym: 'triangle' },
  { key: 'yellow', base: '#ffcf1f', dark: '#c48d00', light: '#fff0a0', ink: '#5b4100', sym: 'star' },
  { key: 'purple', base: '#9a55ea', dark: '#5f2aa8', light: '#d4b6fb', ink: '#ffffff', sym: 'diamond' },
  { key: 'orange', base: '#ff8317', dark: '#b85300', light: '#ffc58f', ink: '#ffffff', sym: 'plus' },
  { key: 'pink', base: '#ff5fb0', dark: '#bb2f78', light: '#ffc2e2', ink: '#ffffff', sym: 'heart' },
  { key: 'teal', base: '#13c4c4', dark: '#087c80', light: '#98f2f2', ink: '#ffffff', sym: 'moon' },
  { key: 'brown', base: '#a16a3e', dark: '#623b1f', light: '#dcb08b', ink: '#ffffff', sym: 'bolt' },
];

export const TYPES = {
  car: { len: 2, seats: 4 },
  van: { len: 3, seats: 6 },
  bus: { len: 4, seats: 8 },
  coach: { len: 5, seats: 10 },
};

export const SLOTS_OPEN = 4;
export const SLOTS_LOCKED = 1;
export const THEMES = 6; // environment changes every 20 levels
export const MAX_VEHICLES = 30;

const HW = 0.4; // half width of a vehicle footprint (lanes are 1 unit wide)

// Levels where a mechanic first appears (shown with a "New!" card).
export const MECHANICS = [
  { id: 'van', level: 4 },
  { id: 'bus', level: 9 },
  { id: 'diagonal', level: 25 },
  { id: 'mystery', level: 40 },
  { id: 'locked', level: 55 },
  { id: 'coach', level: 70 },
];

// ---------------------------------------------------------------- random
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(a, r) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- geometry
export function dirAngle(d) {
  return ((d * 45 - 90) * Math.PI) / 180;
}
export function dirVec(d) {
  const a = dirAngle(d);
  const x = Math.round(Math.cos(a) * 1e9) / 1e9;
  const y = Math.round(Math.sin(a) * 1e9) / 1e9;
  return [x, y];
}

export function footprint(v, inflate = 0) {
  const [ux, uy] = dirVec(v.dir);
  return { cx: v.cx, cy: v.cy, ux, uy, hl: v.len / 2 - 0.08 + inflate, hw: HW + inflate };
}

// The region a vehicle sweeps when it drives forward forever.
export function sweep(v) {
  const f = footprint(v);
  const D = 80;
  return { cx: f.cx + (f.ux * D) / 2, cy: f.cy + (f.uy * D) / 2, ux: f.ux, uy: f.uy, hl: f.hl + D / 2, hw: f.hw };
}

function radius(o, x, y) {
  return o.hl * Math.abs(o.ux * x + o.uy * y) + o.hw * Math.abs(-o.uy * x + o.ux * y);
}

// Separating-axis test between two oriented boxes.
export function overlap(a, b) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const axes = [a.ux, a.uy, -a.uy, a.ux, b.ux, b.uy, -b.uy, b.ux];
  for (let i = 0; i < 8; i += 2) {
    const x = axes[i];
    const y = axes[i + 1];
    if (Math.abs(dx * x + dy * y) >= radius(a, x, y) + radius(b, x, y) - 1e-6) return false;
  }
  return true;
}

// How far (lot units) vehicle v can drive forward before touching u.
export function contactDistance(v, u) {
  const a = footprint(v);
  const b = footprint(u);
  const axes = [a.ux, a.uy, -a.uy, a.ux, b.ux, b.uy, -b.uy, b.ux];
  let tIn = -Infinity;
  let tOut = Infinity;
  for (let i = 0; i < 8; i += 2) {
    const x = axes[i];
    const y = axes[i + 1];
    const r = radius(a, x, y) + radius(b, x, y);
    const d = (b.cx - a.cx) * x + (b.cy - a.cy) * y;
    const w = a.ux * x + a.uy * y;
    if (Math.abs(w) < 1e-9) {
      if (Math.abs(d) >= r) return Infinity;
      continue;
    }
    let t1 = (d - r) / w;
    let t2 = (d + r) / w;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tIn = Math.max(tIn, t1);
    tOut = Math.min(tOut, t2);
    if (tIn >= tOut) return Infinity;
  }
  if (tOut <= 0) return Infinity;
  return Math.max(0, tIn);
}

export function corners(o) {
  const vx = -o.uy;
  const vy = o.ux;
  const out = [];
  for (const [s, t] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    out.push([o.cx + o.ux * o.hl * s + vx * o.hw * t, o.cy + o.uy * o.hl * s + vy * o.hw * t]);
  }
  return out;
}

function insideLot(v, cols, rows) {
  const m = 0.02;
  return corners(footprint(v)).every(([x, y]) => x >= m && y >= m && x <= cols - m && y <= rows - m);
}

export function computeBlockers(vs) {
  return vs.map((v) => {
    const s = sweep(v);
    const out = [];
    for (const u of vs) if (u !== v && overlap(s, footprint(u))) out.push(u.id);
    return out;
  });
}

// ---------------------------------------------------------------- level meta
export function levelKind(L) {
  if (L >= 20 && L % 10 === 0) return 'super';
  if (L >= 5 && L % 5 === 0) return 'hard';
  return 'normal';
}

export function themeFor(L) {
  return Math.floor((Math.max(1, L) - 1) / 20) % THEMES;
}

export function rewardFor(L, kind) {
  const base = 20 + Math.min(40, Math.floor(L / 4));
  return kind === 'super' ? base * 3 : kind === 'hard' ? base * 2 : base;
}

export function xpFor(kind) {
  return kind === 'super' ? 30 : kind === 'hard' ? 20 : 10;
}

// Difficulty knobs for level L (endless: values plateau and keep varying).
export function levelParams(L, kindOverride) {
  const r = makeRng(L * 7349 + 917);
  const kind = kindOverride || levelKind(L);
  const base = 1 - Math.exp(-(L - 1) / 70);
  const inBlock = ((L - 1) % 10) / 10; // saw-tooth inside each block of 10
  let d = base + inBlock * 0.08;
  if (kind === 'hard') d += 0.12;
  if (kind === 'super') d += 0.24;
  if (L % 10 === 1 && L > 20) d -= 0.08; // breather after a super-hard level
  d = clamp(d, 0, 1.25);

  let n = Math.round(6 + 17 * Math.min(1, d) + (d > 1 ? 3 : 0) + (r() * 2.4 - 1.2));
  n = clamp(n, L < 3 ? 5 : 6, 26);
  let colors = clamp(Math.round(2 + 6.2 * Math.min(1.1, d) + (r() - 0.5)), 2, PALETTE.length);
  colors = Math.min(colors, Math.max(2, Math.floor(n / 2)));

  let kWin;
  if (d < 0.08) kWin = 2;
  else if (d < 0.25) kWin = r() < 0.5 ? 2 : 3;
  else if (d < 0.5) kWin = r() < 0.2 ? 4 : 3;
  else kWin = r() < 0.45 ? 4 : 3;
  if (kind === 'hard') kWin = L >= 15 ? 4 : 3;
  if (kind === 'super') kWin = 4;
  kWin = Math.min(kWin, SLOTS_OPEN);

  const burstFull = d < 0.08;
  const burstMax = d < 0.3 ? 4 : kind === 'super' ? 2 : 3;
  const oldBias = d < 0.3 ? 0.7 : 0.45;

  const w = { car: 1, van: 0, bus: 0, coach: 0 };
  if (L >= 4) w.van = 0.4;
  if (L >= 9) Object.assign(w, { car: 0.5, van: 0.32, bus: 0.2 });
  if (L >= 40) Object.assign(w, { car: 0.42, van: 0.32, bus: 0.26 });
  if (L >= 70) w.coach = 0.08;

  const diag = L >= 25 ? Math.min(0.24, 0.1 + (L - 25) / 500) : 0;
  const mystery = L >= 40 ? Math.min(0.3, 0.12 + (L - 40) / 600) : 0;
  const locks = L >= 55 ? (kind === 'normal' ? 1 : 2) + (r() < 0.3 ? 1 : 0) : 0;
  const pEdge = clamp(0.85 - d * 0.8, 0.12, 0.85);
  const density = clamp(0.52 + d * 0.28, 0.52, 0.8);

  return { L, kind, d, n, colors, kWin, burstFull, burstMax, oldBias, w, diag, mystery, locks, pEdge, density };
}

// ---------------------------------------------------------------- generator
function pickType(r, w) {
  const total = w.car + w.van + w.bus + w.coach;
  let x = r() * total;
  for (const k of ['car', 'van', 'bus', 'coach']) {
    x -= w[k];
    if (x <= 0 && w[k] > 0) return k;
  }
  return 'car';
}

function gridFor(p, types) {
  const cells = types.reduce((s, t) => s + TYPES[t].len, 0) * (p.diag ? 1.15 : 1);
  const need = cells / p.density;
  let cols = clamp(Math.round(Math.sqrt(need * 0.64)), 4, 8);
  let rows = clamp(Math.ceil(need / cols), 5, 12);
  if (cols * rows < need && cols < 8) cols++;
  rows = clamp(Math.ceil(need / cols), 5, 12);
  const maxLen = Math.max(...types.map((t) => TYPES[t].len));
  rows = Math.max(rows, maxLen + 1);
  return { cols, rows };
}

function tryPlace(vs, cand, cols, rows) {
  if (!insideLot(cand, cols, rows)) return false;
  const fc = footprint(cand, 0.035);
  for (const u of vs) if (overlap(fc, footprint(u, 0.035))) return false;
  return true;
}

function placeVehicles(p, types, cols, rows, r) {
  const vs = [];
  const sorted = types.slice().sort((a, b) => TYPES[b].len - TYPES[a].len);
  for (let type of sorted) {
    let placed = false;
    for (let attempt = 0; attempt < 260 && !placed; attempt++) {
      if (attempt === 180 && type !== 'car') type = type === 'coach' ? 'bus' : type === 'bus' ? 'van' : 'car';
      const len = TYPES[type].len;
      const cand = { id: vs.length, type, len, seats: TYPES[type].seats, dir: 0, cx: 0, cy: 0 };
      if (r() < p.diag) {
        cand.dir = [1, 3, 5, 7][Math.floor(r() * 4)];
        cand.cx = 0.5 + Math.floor(r() * (cols * 2 - 1)) / 2;
        cand.cy = 0.5 + Math.floor(r() * (rows * 2 - 1)) / 2;
      } else {
        const horiz = r() < (cols >= rows ? 0.55 : 0.42);
        if (horiz) {
          if (len > cols) continue;
          const x = Math.floor(r() * (cols - len + 1));
          const y = Math.floor(r() * rows);
          cand.cx = x + len / 2;
          cand.cy = y + 0.5;
          const towardLeft = cand.cx < cols - cand.cx;
          cand.dir = r() < p.pEdge ? (towardLeft ? 6 : 2) : r() < 0.5 ? 6 : 2;
        } else {
          if (len > rows) continue;
          const x = Math.floor(r() * cols);
          const y = Math.floor(r() * (rows - len + 1));
          cand.cx = x + 0.5;
          cand.cy = y + len / 2;
          const towardTop = cand.cy < rows - cand.cy;
          cand.dir = r() < p.pEdge ? (towardTop ? 0 : 4) : r() < 0.5 ? 0 : 4;
        }
      }
      if (tryPlace(vs, cand, cols, rows)) {
        vs.push(cand);
        placed = true;
      }
    }
  }
  return vs;
}

// Peels exitable vehicles; returns ids that can never leave (cycles).
function stuckIds(vs, blockers) {
  const gone = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    for (const v of vs) {
      if (gone.has(v.id)) continue;
      if (blockers[v.id].every((j) => gone.has(j))) {
        gone.add(v.id);
        progress = true;
      }
    }
  }
  return vs.filter((v) => !gone.has(v.id)).map((v) => v.id);
}

function reindex(vs) {
  vs.forEach((v, i) => (v.id = i));
  return vs;
}

function makeAcyclic(vs, r) {
  for (let guard = 0; guard < 200; guard++) {
    const blockers = computeBlockers(vs);
    const stuck = stuckIds(vs, blockers);
    if (!stuck.length) return blockers;
    const v = vs[stuck[Math.floor(r() * stuck.length)]];
    if (!v.flipped) {
      v.dir = (v.dir + 4) % 8;
      v.flipped = true;
    } else {
      vs.splice(vs.indexOf(v), 1);
      reindex(vs);
    }
  }
  return null;
}

// Random order in which vehicles can leave (respecting blockers and locks).
export function exitOrder(vs, blockers, r, inLot = null, departed = 0) {
  const remaining = new Set(inLot ? inLot : vs.map((v) => v.id));
  const order = [];
  let out = departed;
  while (remaining.size) {
    const free = [];
    for (const id of remaining) {
      const v = vs[id];
      if ((v.lock || 0) > out) continue;
      if (blockers[id].every((j) => !remaining.has(j))) free.push(id);
    }
    if (!free.length) return null;
    free.sort((a, b) => a - b);
    const pick = free[Math.floor(r() * free.length)];
    remaining.delete(pick);
    order.push(pick);
    out++;
  }
  return order;
}

// Builds a passenger line that can be served with `kWin` slots when vehicles
// leave in `order`. `active` = vehicles already parked [{id, rem}].
function buildQueue(vs, order, kWin, p, r, active0 = []) {
  const active = active0.map((a) => ({ id: a.id, rem: a.rem }));
  const queue = [];
  let next = 0;
  for (;;) {
    while (active.length < kWin && next < order.length) {
      const v = vs[order[next++]];
      active.push({ id: v.id, rem: v.seats });
    }
    if (!active.length) break;
    let idx = 0;
    if (!p.burstFull && active.length > 1 && r() >= p.oldBias) idx = Math.floor(r() * active.length);
    const a = active[idx];
    const burst = p.burstFull ? a.rem : Math.min(a.rem, 1 + Math.floor(r() * p.burstMax));
    for (let i = 0; i < burst; i++) queue.push(vs[a.id].color);
    a.rem -= burst;
    if (!a.rem) active.splice(idx, 1);
  }
  return queue;
}

// Passengers board the earliest parked vehicle of their color.
function boardAll(vs, parked, queue, q) {
  while (q < queue.length) {
    const c = queue[q];
    let k = -1;
    for (let i = 0; i < parked.length; i++) {
      if (vs[parked[i].id].color === c) {
        k = i;
        break;
      }
    }
    if (k < 0) break;
    parked[k].rem--;
    q++;
    if (!parked[k].rem) parked.splice(k, 1);
  }
  return q;
}

// Plays `order` lazily (a vehicle is sent only when the front passenger needs
// one). True when every passenger boards without ever overflowing the slots.
export function simulate(vs, queue, order, slots, parked0 = []) {
  const parked = parked0.map((a) => ({ id: a.id, rem: a.rem }));
  let q = boardAll(vs, parked, queue, 0);
  let next = 0;
  while (q < queue.length) {
    if (next >= order.length || parked.length >= slots) return false;
    const v = vs[order[next++]];
    parked.push({ id: v.id, rem: v.seats });
    q = boardAll(vs, parked, queue, q);
  }
  return true;
}

function tutorialLevel() {
  // Hand-made first level: 6 cars, 2 colors, one blocked car.
  const mk = (id, color, dir, cx, cy) => ({ id, type: 'car', len: 2, seats: 4, color, dir, cx, cy });
  const vehicles = [
    mk(0, 0, 4, 1.5, 4), // red, down, free
    mk(1, 1, 2, 1, 2.5), // blue, right, free
    mk(2, 1, 4, 3.5, 4), // blue, down, free
    mk(3, 0, 4, 1.5, 1), // red, down, blocked by 1 and 0
    mk(4, 0, 0, 0.5, 4), // red, up, blocked by 1
    mk(5, 1, 6, 3, 0.5), // blue, left, blocked by 3
  ];
  const queue = [];
  const push = (c, k) => {
    for (let i = 0; i < k; i++) queue.push(c);
  };
  push(0, 4);
  push(1, 8);
  push(0, 8);
  push(1, 4);
  return {
    level: 1,
    kind: 'normal',
    theme: 0,
    cols: 4,
    rows: 5,
    vehicles,
    blockers: computeBlockers(vehicles),
    queue,
    slots: SLOTS_OPEN,
    locked: SLOTS_LOCKED,
    order: [0, 2, 1, 4, 3, 5],
    colors: [0, 1],
  };
}

// Generates level L (deterministic). opts: { seed, kind } for daily challenges.
export function generateLevel(L, opts = {}) {
  if (L === 1 && !opts.seed) return tutorialLevel();
  const p = levelParams(L, opts.kind);
  const seed = opts.seed != null ? opts.seed : L * 2654435761;
  const r = makeRng(seed);
  const intro = MECHANICS.find((m) => m.level === L && !opts.seed);

  for (let attempt = 0; attempt < 40; attempt++) {
    const n = Math.max(5, p.n - Math.floor(attempt / 8));
    const types = [];
    for (let i = 0; i < n; i++) types.push(pickType(r, p.w));
    if (intro && intro.id === 'van') types.splice(0, 2, 'van', 'van');
    if (intro && intro.id === 'bus') types.splice(0, 1, 'bus');
    if (intro && intro.id === 'coach') types.splice(0, 1, 'coach');
    const pp = intro && intro.id === 'diagonal' ? { ...p, diag: Math.max(p.diag, 0.28) } : p;
    const { cols, rows } = gridFor(pp, types);
    let vs = placeVehicles(pp, types, cols, rows, r);
    if (vs.length < Math.max(5, Math.round(n * 0.8))) continue;
    vs = reindex(vs);
    const blockers = makeAcyclic(vs, r);
    if (!blockers || vs.length < Math.max(5, Math.round(n * 0.75))) continue;
    vs.forEach((v) => delete v.flipped);
    if (vs.length > MAX_VEHICLES) continue;
    if (intro && intro.id === 'diagonal' && vs.filter((v) => v.dir % 2).length < 2) continue;

    // colors: a seeded subset of the palette, each used at least once
    const colorCount = Math.min(p.colors, Math.floor(vs.length / 2) || 1);
    const palette = shuffleInPlace(PALETTE.map((_, i) => i), r).slice(0, Math.max(2, colorCount));
    const list = [];
    for (let i = 0; i < vs.length; i++) list.push(palette[i % palette.length]);
    shuffleInPlace(list, r);
    vs.forEach((v, i) => (v.color = list[i]));

    const order = exitOrder(vs, blockers, r);
    if (!order) continue;

    // locked vehicles: unlock after `lock` vehicles have left the lot
    let lockCount = p.locks;
    if (intro && intro.id === 'locked') lockCount = Math.max(1, lockCount);
    for (let i = order.length - 1; i >= 3 && lockCount > 0; i--) {
      if (r() < 0.35 || i < order.length / 2) {
        const v = vs[order[i]];
        if (v.lock) continue;
        v.lock = Math.max(2, i - Math.floor(r() * 2));
        lockCount--;
      }
    }
    // mystery vehicles: color hidden while something blocks them
    let mysteries = 0;
    for (const v of vs) {
      if (blockers[v.id].length && !v.lock && r() < (intro && intro.id === 'mystery' ? 0.5 : p.mystery)) {
        v.mystery = true;
        mysteries++;
      }
    }
    if (intro && intro.id === 'mystery' && mysteries < 2) {
      for (const v of vs) if (mysteries < 2 && blockers[v.id].length && !v.lock && !v.mystery) (v.mystery = true), mysteries++;
    }

    for (let kWin = p.kWin; kWin >= 1; kWin--) {
      for (let tryQ = 0; tryQ < 10; tryQ++) {
        const queue = buildQueue(vs, order, kWin, p, r);
        if (simulate(vs, queue, order, SLOTS_OPEN)) {
          return {
            level: L,
            kind: p.kind,
            theme: opts.theme != null ? opts.theme : themeFor(L),
            cols,
            rows,
            vehicles: vs,
            blockers,
            queue,
            slots: SLOTS_OPEN,
            locked: SLOTS_LOCKED,
            order,
            kWin,
            colors: palette,
          };
        }
      }
    }
  }
  // Extremely unlikely: fall back to an easier version of the level.
  return generateLevel(Math.max(2, Math.floor(L / 2)), { seed: (seed ^ 0x5bd1e995) >>> 0, kind: 'normal', theme: themeFor(L) });
}

// New passenger line for the Shuffle booster, built from the current state so
// the level stays solvable. state: { inLot:[ids], parked:[{id, rem}], departed, slots }
export function reshuffleQueue(def, state, seed) {
  const vs = def.vehicles;
  const r = makeRng(seed);
  const p = { burstFull: false, burstMax: 3, oldBias: 0.6 };
  for (let attempt = 0; attempt < 24; attempt++) {
    const order = exitOrder(vs, def.blockers, r, state.inLot, state.departed);
    if (!order) break;
    const kWin = Math.max(1, Math.min(state.slots - 1, 3) - Math.floor(attempt / 8));
    const queue = buildQueue(vs, order, Math.max(kWin, 1), p, r, state.parked);
    if (simulate(vs, queue, order, state.slots, state.parked)) return queue;
  }
  // Deterministic fallback: serve parked vehicles first, then one at a time.
  const order = exitOrder(vs, def.blockers, () => 0, state.inLot, state.departed) || state.inLot.slice();
  const queue = [];
  for (const a of state.parked) for (let i = 0; i < a.rem; i++) queue.push(vs[a.id].color);
  for (const id of order) for (let i = 0; i < vs[id].seats; i++) queue.push(vs[id].color);
  return queue;
}

// ---------------------------------------------------------------- solver
function popcount(x) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

// Depth-first search over vehicle choices. start: { inLot:[ids], parked:[{id, rem}],
// queue:[colors], slots }. Returns { ok: true, moves }, { ok: false } or
// { ok: null } when the node budget runs out.
export function solve(def, start, budget = 200000) {
  const vs = def.vehicles;
  const n = vs.length;
  const blockMask = def.blockers.map((list) => list.reduce((m, j) => m | (1 << j), 0));
  const queue = start.queue;
  const Q = queue.length;
  const slots = start.slots;
  const seen = new Set();
  let nodes = 0;
  let mask0 = 0;
  for (const id of start.inLot) mask0 |= 1 << id;
  const parked0 = start.parked.map((a) => ({ id: a.id, rem: a.rem }));
  const q0 = boardAll(vs, parked0, queue, 0);

  // first index of each color in the queue from position q (for move ordering)
  const nextIdx = [];
  for (let q = Q; q >= 0; q--) {
    const row = q === Q ? new Array(PALETTE.length).fill(Infinity) : nextIdx[q + 1].slice();
    if (q < Q) row[queue[q]] = q;
    nextIdx[q] = row;
  }

  const keyOf = (mask, parked, q) => {
    const s = parked
      .map((a, i) => [vs[a.id].color, i, a.id, a.rem])
      .sort((x, y) => x[0] - y[0] || x[1] - y[1])
      .map((x) => x[2] + '.' + x[3])
      .join(',');
    return mask + '|' + q + '|' + s;
  };

  const path = [];
  const dfs = (mask, parked, q) => {
    if (q >= Q) return true;
    if (++nodes > budget) throw new Error('budget');
    if (parked.length >= slots) return false;
    const key = keyOf(mask, parked, q);
    if (seen.has(key)) return false;
    seen.add(key);
    const out = n - popcount(mask);
    const cands = [];
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      if (blockMask[i] & mask) continue;
      if ((vs[i].lock || 0) > out) continue;
      cands.push(i);
    }
    const nx = nextIdx[q];
    cands.sort((a, b) => nx[vs[a].color] - nx[vs[b].color] || vs[a].seats - vs[b].seats);
    for (const i of cands) {
      const np = parked.map((a) => ({ id: a.id, rem: a.rem }));
      np.push({ id: i, rem: vs[i].seats });
      const nq = boardAll(vs, np, queue, q);
      path.push(i);
      if (dfs(mask & ~(1 << i), np, nq)) return true;
      path.pop();
    }
    return false;
  };

  try {
    const ok = dfs(mask0, parked0, q0);
    return ok ? { ok: true, moves: path.slice(), nodes } : { ok: false, nodes };
  } catch (e) {
    if (e.message === 'budget') return { ok: null, nodes };
    throw e;
  }
}

// ---------------------------------------------------------------- daily
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailyLevel(key) {
  const seed = Number(key.replace(/-/g, ''));
  const r = makeRng(seed);
  const L = 36 + Math.floor(r() * 30);
  const def = generateLevel(L, { seed: seed * 31 + 7, kind: 'hard', theme: seed % THEMES });
  def.daily = key;
  return def;
}
