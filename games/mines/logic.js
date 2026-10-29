// Pure Minesweeper logic (no DOM). Cell states: 0 hidden, 1 open, 2 flag, 3 question.

export const DIFFS = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 30, cols: 16, mines: 99 },
};

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Endless level n (1-based) → board config. */
export function levelConfig(n) {
  const cols = Math.min(16, 8 + Math.ceil((n - 1) / 2));
  const rows = Math.min(30, 8 + (n - 1));
  const density = Math.min(0.21, 0.13 + 0.005 * (n - 1));
  return clampConfig({ rows, cols, mines: Math.round(rows * cols * density) });
}

export function clampConfig({ rows, cols, mines }) {
  rows = Math.max(5, Math.min(40, Math.round(rows)));
  cols = Math.max(5, Math.min(30, Math.round(cols)));
  const max = rows * cols - 10;
  mines = Math.max(1, Math.min(max, Math.round(mines)));
  return { rows, cols, mines };
}

export function createGame(rows, cols, mines) {
  const n = rows * cols;
  return {
    rows,
    cols,
    mines: Math.min(mines, n - 1),
    mine: new Uint8Array(n),
    adj: new Uint8Array(n),
    state: new Uint8Array(n),
    started: false,
    status: 'ready', // ready | playing | won | lost
    opened: 0,
    flags: 0,
    boom: -1,
  };
}

export function neighbors(g, i) {
  const r = (i / g.cols) | 0;
  const c = i % g.cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < g.rows && cc >= 0 && cc < g.cols) out.push(rr * g.cols + cc);
    }
  }
  return out;
}

/** Place mines; the first cell and its neighbours are mine-free when the board has room. */
export function placeMines(g, safe, rnd = Math.random) {
  const n = g.rows * g.cols;
  let banned = new Set([safe, ...neighbors(g, safe)]);
  if (n - banned.size < g.mines) banned = new Set([safe]);
  const pool = [];
  for (let i = 0; i < n; i++) if (!banned.has(i)) pool.push(i);
  for (let k = 0; k < g.mines; k++) {
    const j = k + Math.floor(rnd() * (pool.length - k));
    [pool[k], pool[j]] = [pool[j], pool[k]];
    g.mine[pool[k]] = 1;
  }
  for (let i = 0; i < n; i++) {
    if (g.mine[i]) continue;
    let c = 0;
    for (const j of neighbors(g, i)) c += g.mine[j];
    g.adj[i] = c;
  }
  g.started = true;
  g.status = 'playing';
}

/** Reveal a cell. Returns { opened: [indices in BFS order with depth], boom, won }. */
export function reveal(g, i, rnd = Math.random) {
  const res = { opened: [], boom: -1, won: false, depth: [] };
  if (g.status === 'won' || g.status === 'lost') return res;
  if (g.state[i] === 1 || g.state[i] === 2) return res;
  if (!g.started) placeMines(g, i, rnd);
  if (g.mine[i]) {
    g.state[i] = 1;
    g.boom = i;
    g.status = 'lost';
    res.boom = i;
    return res;
  }
  const queue = [i];
  const depth = new Map([[i, 0]]);
  g.state[i] = 1;
  g.opened++;
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    res.opened.push(c);
    res.depth.push(depth.get(c));
    if (g.adj[c] !== 0) continue;
    for (const j of neighbors(g, c)) {
      if (g.state[j] === 1 || g.state[j] === 2 || g.mine[j]) continue;
      if (g.state[j] === 3) g.state[j] = 0;
      g.state[j] = 1;
      g.opened++;
      depth.set(j, depth.get(c) + 1);
      queue.push(j);
    }
  }
  if (checkWin(g)) res.won = true;
  return res;
}

export function checkWin(g) {
  if (g.status === 'lost') return false;
  if (g.started && g.opened === g.rows * g.cols - g.mines) {
    g.status = 'won';
    for (let i = 0; i < g.state.length; i++) if (g.mine[i] && g.state[i] !== 2) g.state[i] = 2;
    g.flags = g.mines;
    return true;
  }
  return false;
}

/** Cycle hidden → flag → (question) → hidden. Returns the new state or -1 if nothing changed. */
export function toggleFlag(g, i, useQuestion = false) {
  if (g.status === 'won' || g.status === 'lost') return -1;
  const s = g.state[i];
  if (s === 1) return -1;
  if (s === 0) {
    g.state[i] = 2;
    g.flags++;
  } else if (s === 2) {
    g.flags--;
    g.state[i] = useQuestion ? 3 : 0;
  } else g.state[i] = 0;
  return g.state[i];
}

export function flagsAround(g, i) {
  let f = 0;
  for (const j of neighbors(g, i)) if (g.state[j] === 2) f++;
  return f;
}

/** Chord on an open number whose flags match: reveal all other neighbours. */
export function chord(g, i, rnd = Math.random) {
  const res = { opened: [], depth: [], boom: -1, won: false, ok: false };
  if (g.status !== 'playing' || g.state[i] !== 1 || g.adj[i] === 0) return res;
  if (flagsAround(g, i) !== g.adj[i]) return res;
  res.ok = true;
  let d = 0;
  for (const j of neighbors(g, i)) {
    if (g.state[j] !== 0 && g.state[j] !== 3) continue;
    const r = reveal(g, j, rnd);
    for (let k = 0; k < r.opened.length; k++) {
      res.opened.push(r.opened[k]);
      res.depth.push(r.depth[k] + d);
    }
    if (r.boom >= 0 && res.boom < 0) res.boom = r.boom;
    if (r.won) res.won = true;
    d++;
  }
  return res;
}

/** Serialise / restore for resume. */
export function pack(g) {
  return { rows: g.rows, cols: g.cols, mines: g.mines, mine: Array.from(g.mine).join(''), state: Array.from(g.state).join(''), started: g.started };
}
export function unpack(p) {
  const g = createGame(p.rows, p.cols, p.mines);
  g.mine = Uint8Array.from(p.mine.split('').map(Number));
  g.state = Uint8Array.from(p.state.split('').map(Number));
  g.started = !!p.started;
  g.status = g.started ? 'playing' : 'ready';
  for (let i = 0; i < g.mine.length; i++) {
    if (g.state[i] === 1) g.opened++;
    if (g.state[i] === 2) g.flags++;
    if (!g.mine[i]) {
      let c = 0;
      for (const j of neighbors(g, i)) c += g.mine[j];
      g.adj[i] = c;
    }
  }
  return g;
}
