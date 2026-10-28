// Headless balance test: CPU vs CPU matches on every track, in defense and
// assault modes. Also checks track maps and that the sim runs forever.
// Usage: node games/towers/tests/balance.mjs [matches-per-track=2] [maxMinutes=25]

import { Match, geometry, TICK } from '../sim.js';
import { TRACKS, COLS, ROWS, SENDS, rankForMedals, hpScale } from '../data.js';
import { createBrain } from '../ai.js';

const perTrack = Number(process.argv[2] || 2);
const maxSec = Number(process.argv[3] || 25) * 60;
let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL:', msg); };

// 1. Track validation
for (const tr of TRACKS) {
  if (tr.map.length !== ROWS) fail(`${tr.id}: ${tr.map.length} rows`);
  tr.map.forEach((row, r) => { if (row.length !== COLS) fail(`${tr.id}: row ${r} has ${row.length} cols`); });
  const g = geometry(tr);
  let free = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const idx = r * COLS + c;
    if (tr.map[r][c] === '.' && !g.cells.has(idx)) free++;
    if (tr.map[r][c] !== '.' && g.cells.has(idx)) fail(`${tr.id}: obstacle on path at ${c},${r}`);
  }
  if (free < 15) fail(`${tr.id}: only ${free} buildable cells`);
  console.log(`track ${tr.id.padEnd(8)} path ${g.total.toFixed(0).padStart(5)} units, buildable ${free}`);
}

// 2. Matches
const results = [];
for (const mode of ['defense', 'assault']) {
  for (const tr of TRACKS) {
    for (let k = 0; k < perTrack; k++) {
      const seed = 1000 + k * 17 + tr.id.length;
      const m = new Match({
        track: tr, seed, sending: mode === 'assault', lives: 20,
        sides: [{ ai: createBrain({ skill: 0.6 }) }, { ai: createBrain({ skill: 0.6 }) }],
      });
      const t0 = Date.now();
      let steps = 0;
      while (!m.over && m.time < maxSec) { m.step(TICK); steps++; }
      const wall = (Date.now() - t0) / 1000;
      const a = m.stats(0), b = m.stats(1);
      const winner = m.over ? (m.over.winner === 0 ? 'A' : m.over.winner === 1 ? 'B' : '=') : 'timeout';
      results.push({ mode, track: tr.id, winner, time: m.time, a, b });
      console.log(
        `${mode.padEnd(8)} ${tr.id.padEnd(8)} seed ${seed} -> ${winner} at ${(m.time / 60).toFixed(1)} min ` +
        `| A r${a.round} L${a.lives} T${a.towers} pops ${a.pops} sent ${a.sent} | B r${b.round} L${b.lives} T${b.towers} pops ${b.pops} sent ${b.sent} | ${wall.toFixed(1)}s wall`
      );
      if (wall > 60) fail(`slow match ${wall.toFixed(0)}s`);
    }
  }
}

// 3. Summary
const decisive = results.filter((r) => r.winner === 'A' || r.winner === 'B');
const avgMin = results.reduce((s, r) => s + r.time, 0) / results.length / 60;
const timeouts = results.filter((r) => r.winner === 'timeout').length;
console.log(`\nmatches ${results.length}, decisive ${decisive.length}, timeouts ${timeouts}, avg length ${avgMin.toFixed(1)} min`);
console.log('A wins', results.filter((r) => r.winner === 'A').length, 'B wins', results.filter((r) => r.winner === 'B').length);
console.log('hpScale r10/r20/r40/r60:', [10, 20, 40, 60].map((r) => hpScale(r).toFixed(2)).join(' '));
console.log('rank for medals 0/5/15/30/100:', [0, 5, 15, 30, 100].map(rankForMedals).join(' '));
console.log('sends:', SENDS.map((s) => `${s.id}:${s.cost}`).join(' '));
if (failures) { console.log(`\n${failures} failure(s)`); process.exitCode = 1; }
else console.log('\nall checks passed');
