// CPU brain. Used for the opponent in assault / defense / arena and by the
// headless balance test (CPU vs CPU). Plans its builds from the wave mix,
// spends on the best-covering tower spots, upgrades the strongest towers and
// (assault / arena) sends groups when it has spare coins and the opponent is
// weak or the send pays back. `skill` (0..1) changes reaction speed, reserve
// and how often it hesitates.

import { TOWERS, TOWER_ORDER, SENDS, COLS, ROWS, TIERS, FAST, CAMO, REGEN, CELL } from './data.js';

// Preferred upgrade path order per tower ('A' or 'B'). Used as a priority list.
const PLAN = {
  archer: 'ABABAB',
  cannon: 'BABABA',
  frost: 'ABABAB',
  bolt: 'ABABAB',
  sniper: 'ABBAAB',
  glue: 'BABABA',
  lantern: 'ABABAB',
};

const HP_UNIT = [1, 2, 3, 5, 8, 14, 70];

export class Brain {
  constructor(skill = 0.6) {
    this.skill = skill;
    this.interval = 0.5 - 0.3 * skill;
    this.reserveMul = 1.25 - 0.45 * skill;
    this.covCache = null;
  }

  think(match, side) {
    if (match.over) return;
    const rnd = match.rnd;
    // Hesitate sometimes: weaker skill makes more mistakes.
    if (rnd() < (1 - this.skill) * 0.25) return;

    const opp = match.sides[1 - side.index];
    this.buildStep(match, side, opp);
    this.upgradeStep(match, side);
    if (match.sending) this.sendStep(match, side, opp);
  }

  // ----------------------------------------------------------- building

  buildStep(match, side, opp) {
    const counts = {};
    for (const t of side.towers) counts[t.type] = (counts[t.type] || 0) + 1;
    const n = side.towers.length;
    const enemyMix = this.mix(side);
    let best = null, bestScore = -Infinity;
    for (const id of TOWER_ORDER) {
      if (!match.unlocked.has(id)) continue;
      const type = TOWERS[id];
      const c = counts[id] || 0;
      let s;
      switch (id) {
        case 'archer': s = 1.0 - 0.1 * c; break;
        case 'cannon': s = 0.95 - 0.12 * c + (enemyMix.clump ? 0.35 : 0); break;
        case 'frost': s = 0.75 - 0.25 * c + (c === 0 && n >= 2 ? 0.45 : 0); break;
        case 'bolt': s = 0.85 - 0.12 * c + (enemyMix.groups > 6 ? 0.3 : 0); break;
        case 'glue': s = 0.6 - 0.2 * c + (enemyMix.armored ? 0.45 : 0); break;
        case 'sniper': s = 0.35 - 0.1 * c + (enemyMix.camo || enemyMix.boss ? 0.6 : 0) + (side.round >= 12 ? 0.2 : 0); break;
        case 'lantern': s = (c === 0 && n >= 5 ? 0.75 : 0.25 - 0.1 * c); break;
        default: s = 0;
      }
      if (s <= 0) continue;
      if (type.cost > side.coins) continue;
      if (s > bestScore) { bestScore = s; best = id; }
    }
    if (!best) return;
    // Save up for the best tower when it is still too expensive for the mid game.
    const cell = this.bestCell(match, side, best);
    if (!cell) return;
    if (side.coins < TOWERS[best].cost) return;
    match.build(side.index, best, cell.col, cell.row);
  }

  mix(side) {
    const enemies = side.enemies;
    let armored = false, camo = false, boss = false, groups = 0;
    const seen = new Set();
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.def.armor >= 2) armored = true;
      if (e.flags & CAMO) camo = true;
      if (e.def.boss) boss = true;
      const key = e.tier * 8 + (e.flags & 7);
      seen.add(key);
    }
    groups = seen.size;
    return { armored, camo, boss, groups, clump: enemies.length > 12 };
  }

  coverage(match) {
    if (this.covCache && this.covCache.track === match.track) return this.covCache;
    const samples = match.geo.samples;
    const cov = { track: match.track, cells: [] };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        cov.cells.push({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, c, r, samples });
      }
    }
    this.covCache = cov;
    return cov;
  }

  bestCell(match, side, typeId) {
    const range = TOWERS[typeId].base.range;
    const r2 = range * range;
    const cov = this.coverage(match);
    let best = null, bestVal = -1;
    for (let i = 0; i < cov.cells.length; i++) {
      const cell = cov.cells[i];
      if (side.grid[cell.r * COLS + cell.c] !== 0) continue;
      let v = 0;
      for (const p of cell.samples) {
        const dx = p.x - cell.x, dy = p.y - cell.y;
        if (dx * dx + dy * dy <= r2) v++;
      }
      // Spread the towers out a little: penalize a cell next to many of ours.
      let near = 0;
      for (const t of side.towers) {
        if (Math.abs(t.col - cell.c) <= 1 && Math.abs(t.row - cell.r) <= 1) near++;
      }
      v -= near * 2;
      if (v > bestVal) { bestVal = v; best = cell; }
    }
    if (!best || bestVal <= 0) return null;
    return best;
  }

  // ----------------------------------------------------------- upgrading

  upgradeStep(match, side) {
    const reserve = (30 + side.round * 2) * this.reserveMul;
    const towers = side.towers.slice().sort((a, b) => b.st.dmg * (1 + b.buff) / b.st.cd - a.st.dmg * (1 + a.buff) / a.st.cd);
    for (const t of towers) {
      const plan = PLAN[t.type] || 'AB';
      for (const path of plan) {
        if (match.upgradeReason(side.index, t.id, path)) continue;
        const tier = path === 'A' ? t.a : t.b;
        const cost = TOWERS[t.type][path][tier].cost;
        if (side.coins < cost + reserve) return;
        match.upgrade(side.index, t.id, path);
        return;
      }
    }
  }

  // ----------------------------------------------------------- sending

  sendStep(match, side, opp) {
    if (side.round < 2) return;
    if (match.time - side.lastSend < 3.5) return;
    const reserve = (50 + side.round * 5) * this.reserveMul;
    const oppTowers = opp.towers.length;
    const oppLives = opp.lives;
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < SENDS.length; i++) {
      const o = SENDS[i];
      if (o.unlock > side.round) continue;
      if (side.coins < o.cost + reserve) continue;
      const unit = HP_UNIT[o.tier] * (o.flags & FAST ? 1.2 : 1) * o.count;
      let score = (o.inc * 8 + unit) / o.cost;
      // Aggressive when the opponent is low on lives or thin on towers.
      if (oppLives <= 8 || oppTowers <= 3) score = unit + o.inc * 4;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) return;
    match.send(side.index, best);
  }
}

export function createBrain(opts) {
  return new Brain(opts && opts.skill !== undefined ? opts.skill : 0.6);
}

export { TIERS };
