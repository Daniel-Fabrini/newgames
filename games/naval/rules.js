// Sea Battle — pure game rules: fleets, placement validation, firing, shot rules.
// No DOM here so the AI and the UI share exactly the same logic.

export const N = 10;
export const CELLS = N * N;

// Fleet sets. `touch: false` = ships may not touch, not even diagonally.
export const FLEETS = {
  standard: { sizes: [5, 4, 3, 3, 2], touch: true },
  classic: { sizes: [5, 4, 4, 3, 3, 3, 2, 2, 2, 2], touch: true },
  russian: { sizes: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], touch: false },
};
export const FLEET_IDS = ['standard', 'classic', 'russian'];
// Shot rules: streak = a hit gives another shot; single = strictly one shot per
// turn; salvo = one shot per ship still afloat; multi = fixed burst per turn.
export const RULE_IDS = ['streak', 'single', 'salvo', 'multi'];
export const MULTI_SHOTS = 3;
export const AI_IDS = ['easy', 'medium', 'hard', 'admiral'];

export const COLS = 'ABCDEFGHIJ';
export const cellName = (i) => COLS[i % N] + (((i / N) | 0) + 1);

export function fleetCells(fleetId) {
  return FLEETS[fleetId].sizes.reduce((a, b) => a + b, 0);
}

// Ship class (drives the drawing and the name) for every ship of a fleet.
export function fleetDefs(fleetId) {
  const seen = {};
  return FLEETS[fleetId].sizes.map((len, id) => {
    const k = (seen[len] = (seen[len] || 0) + 1);
    let cls;
    if (len >= 5) cls = 'carrier';
    else if (len === 4) cls = 'battleship';
    else if (len === 3) cls = k % 2 === 0 ? 'submarine' : 'cruiser';
    else if (len === 2) cls = 'destroyer';
    else cls = 'patrol';
    return { id, len, cls, v: k - 1 };
  });
}

export function cellsOf(s) {
  const out = [];
  for (let k = 0; k < s.len; k++) out.push(s.dir === 'h' ? s.r * N + s.c + k : (s.r + k) * N + s.c);
  return out;
}

export function inBounds(s) {
  if (s.r == null || s.c == null || s.r < 0 || s.c < 0) return false;
  return s.dir === 'h' ? s.r < N && s.c + s.len <= N : s.c < N && s.r + s.len <= N;
}

export function neighbors8(i) {
  const r = (i / N) | 0;
  const c = i % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
  return out;
}

// 1 = occupied, 2 = forbidden halo (only for no-touch fleets).
export function occupancy(ships, ignore, touch) {
  const occ = new Uint8Array(CELLS);
  for (const s of ships) {
    if (!s || s === ignore || s.r == null) continue;
    for (const i of cellsOf(s)) occ[i] = 1;
  }
  if (!touch) {
    for (let i = 0; i < CELLS; i++) if (occ[i] === 1) for (const j of neighbors8(i)) if (!occ[j]) occ[j] = 2;
  }
  return occ;
}

export function canPlace(ships, s, touch, ignore = s) {
  if (!inBounds(s)) return false;
  const occ = occupancy(ships, ignore, touch);
  return cellsOf(s).every((i) => occ[i] === 0);
}

// All valid spots for one ship given the ships already placed.
function candidates(ships, def, touch) {
  const occ = occupancy(ships, null, touch);
  const out = [];
  for (const dir of ['h', 'v'])
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const s = { ...def, r, c, dir };
        if (inBounds(s) && cellsOf(s).every((i) => occ[i] === 0)) out.push(s);
      }
  return out;
}

// Random fleet. `spread` forbids touching even when the fleet allows it
// (the stronger AIs use it so their ships are harder to chain).
export function randomFleet(fleetId, rnd = Math.random, spread = false) {
  const defs = fleetDefs(fleetId);
  const touch = FLEETS[fleetId].touch && !spread;
  for (let attempt = 0; attempt < 300; attempt++) {
    const ships = [];
    let ok = true;
    for (const d of defs) {
      const cand = candidates(ships, d, touch);
      if (!cand.length) {
        ok = false;
        break;
      }
      ships.push(cand[Math.floor(rnd() * cand.length)]);
    }
    if (ok) return ships;
  }
  return spread ? randomFleet(fleetId, rnd, false) : null;
}

// Places the ships that are still missing (r == null) around the fixed ones.
export function completeFleet(fleetId, ships, rnd = Math.random) {
  const touch = FLEETS[fleetId].touch;
  for (let attempt = 0; attempt < 200; attempt++) {
    const out = ships.map((s) => ({ ...s }));
    let ok = true;
    for (const s of out) {
      if (s.r != null) continue;
      const cand = candidates(out, { ...s, r: null }, touch);
      if (!cand.length) {
        ok = false;
        break;
      }
      Object.assign(s, cand[Math.floor(rnd() * cand.length)]);
    }
    if (ok) return out;
  }
  return null;
}

// ---------------------------------------------------------------- boards
export function makeBoard(ships, fleetId) {
  const board = {
    fleetId,
    touch: FLEETS[fleetId].touch,
    ships: ships.map((s, id) => ({ id, len: s.len, cls: s.cls, v: s.v || 0, r: s.r, c: s.c, dir: s.dir, hits: 0, sunk: false })),
    map: new Int8Array(CELLS).fill(-1),
    shots: new Uint8Array(CELLS), // 0 unknown · 1 miss · 2 hit
    halo: new Uint8Array(CELLS), // known-empty cells around sunk ships (no-touch fleets)
  };
  board.ships.forEach((s) => cellsOf(s).forEach((i) => (board.map[i] = s.id)));
  return board;
}

export function fire(board, i) {
  if (board.shots[i]) return { res: 'repeat' };
  const k = board.map[i];
  if (k < 0) {
    board.shots[i] = 1;
    board.halo[i] = 0;
    return { res: 'miss' };
  }
  board.shots[i] = 2;
  const s = board.ships[k];
  s.hits++;
  if (s.hits >= s.len) {
    s.sunk = true;
    if (!board.touch) for (const c of cellsOf(s)) for (const j of neighbors8(c)) if (!board.shots[j] && board.map[j] < 0) board.halo[j] = 1;
    return { res: 'sunk', ship: s, all: board.ships.every((x) => x.sunk) };
  }
  return { res: 'hit', ship: s };
}

export const afloat = (board) => board.ships.reduce((n, s) => n + (s.sunk ? 0 : 1), 0);
export const unknownCount = (board) => board.shots.reduce((n, v) => n + (v ? 0 : 1), 0);

// What an attacker legitimately knows about the defender's board.
export function knowledge(board) {
  const grid = new Uint8Array(CELLS);
  for (let i = 0; i < CELLS; i++) grid[i] = board.shots[i];
  for (const s of board.ships) if (s.sunk) for (const i of cellsOf(s)) grid[i] = 3;
  for (let i = 0; i < CELLS; i++) if (board.halo[i] && !grid[i]) grid[i] = 4; // shown to everyone as known-empty
  return { grid, remaining: board.ships.filter((s) => !s.sunk).map((s) => s.len), touch: board.touch };
}

// Shots granted at the start of a turn.
export function shotsForTurn(rule, attackerBoard, defenderBoard) {
  let n = 1;
  if (rule === 'salvo') n = Math.max(1, afloat(attackerBoard));
  else if (rule === 'multi') n = MULTI_SHOTS;
  return Math.min(n, unknownCount(defenderBoard));
}

// ---------------------------------------------------------------- match
export function newMatch(cfg, shipsA, shipsB) {
  const m = {
    cfg, // { fleet, rule, ai: null|'easy'.., twoP: bool }
    boards: [makeBoard(shipsA, cfg.fleet), makeBoard(shipsB, cfg.fleet)],
    turn: 0,
    shotsLeft: 0,
    turnNo: 1,
    over: false,
    winner: -1,
    stats: [newStats(), newStats()],
    log: [],
  };
  m.shotsLeft = shotsForTurn(cfg.rule, m.boards[0], m.boards[1]);
  return m;
}

const newStats = () => ({ shots: 0, hits: 0, sunk: 0, run: 0, bestRun: 0 });

// Fires for the player whose turn it is. Returns null for an illegal shot.
export function matchFire(m, i) {
  if (m.over) return null;
  const att = m.turn;
  const def = m.boards[1 - att];
  const out = fire(def, i);
  if (out.res === 'repeat') return null;
  const st = m.stats[att];
  st.shots++;
  if (out.res === 'miss') st.run = 0;
  else {
    st.hits++;
    st.run++;
    st.bestRun = Math.max(st.bestRun, st.run);
    if (out.res === 'sunk') st.sunk++;
  }
  m.log.push({ p: att, i, res: out.res, cls: out.ship ? out.ship.cls : null, t: m.turnNo });
  if (m.log.length > 60) m.log.splice(0, m.log.length - 60);
  if (out.all) {
    m.over = true;
    m.winner = att;
    m.shotsLeft = 0;
    return { ...out, turnEnds: true };
  }
  const rule = m.cfg.rule;
  if (rule === 'streak') m.shotsLeft = out.res === 'miss' ? 0 : 1;
  else if (rule === 'single') m.shotsLeft = 0;
  else m.shotsLeft = Math.min(m.shotsLeft - 1, unknownCount(def));
  return { ...out, turnEnds: m.shotsLeft <= 0 };
}

export function endTurn(m) {
  m.turn = 1 - m.turn;
  m.turnNo++;
  m.shotsLeft = shotsForTurn(m.cfg.rule, m.boards[m.turn], m.boards[1 - m.turn]);
}

// ---------------------------------------------------------------- save / load
export function serialize(m) {
  return {
    cfg: m.cfg,
    turn: m.turn,
    shotsLeft: m.shotsLeft,
    turnNo: m.turnNo,
    over: m.over,
    winner: m.winner,
    stats: m.stats,
    log: m.log.slice(-30),
    boards: m.boards.map((b) => ({
      ships: b.ships.map((s) => ({ len: s.len, cls: s.cls, v: s.v, r: s.r, c: s.c, dir: s.dir })),
      shots: Array.from(b.shots),
    })),
  };
}

export function deserialize(d) {
  if (!d || !d.cfg || !Array.isArray(d.boards) || d.boards.length !== 2 || !FLEETS[d.cfg.fleet]) return null;
  try {
    const m = {
      cfg: d.cfg,
      turn: d.turn | 0,
      shotsLeft: d.shotsLeft | 0,
      turnNo: d.turnNo | 0 || 1,
      over: !!d.over,
      winner: d.winner ?? -1,
      stats: d.stats || [newStats(), newStats()],
      log: d.log || [],
      boards: d.boards.map((bd) => {
        const b = makeBoard(bd.ships, d.cfg.fleet);
        bd.shots.forEach((v, i) => {
          if (v) fire(b, i);
        });
        return b;
      }),
    };
    if (m.over) return null;
    if (m.shotsLeft <= 0) m.shotsLeft = shotsForTurn(m.cfg.rule, m.boards[m.turn], m.boards[1 - m.turn]);
    return m;
  } catch {
    return null;
  }
}
