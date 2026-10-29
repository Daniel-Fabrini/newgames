import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament, startNextHand, actor, act, aiAct, botAct, simulateToEnd, simulateWithBot, tournamentResult, standing, human, legal, humanView } from '../tournament/tournament.js';
import { makeStructure, payoutLadder, prizeAmounts, placePoints, levelAt } from '../tournament/structures.js';
import { ARCHETYPES } from '../ai/profiles.js';
import { quickCashDef, quickSitGoDef } from '../career/circuits.js';

const mkDef = (o = {}) => ({ id: 'x', format: 'mtt', entrants: 9, tableSize: 9, startStack: 1500, structure: makeStructure({ bb: 30, handsPerLevel: 8 }), buyIn: 100, mult: 1, fieldSkill: [3, 6], rivals: [], ...o });
const aliveChips = (t) => t.entrants.reduce((s, e) => s + e.stack, 0); // busted players hold 0, so this is all chips in play
const sizes = (t) => t.tables.map((tb) => tb.seats.filter((x) => x >= 0).length);

test('payout ladders sum to 1 and prize amounts sum exactly to the pool', () => {
  for (const n of [2, 3, 6, 9, 18, 27, 45, 90, 135]) {
    const l = payoutLadder(n); assert.ok(Math.abs(l.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    for (let i = 1; i < l.length; i++) assert.ok(l[i] <= l[i - 1]);
    const pool = 100 * n + 7; assert.equal(prizeAmounts(pool, l).reduce((a, b) => a + b, 0), pool);
  }
  assert.deepEqual(payoutLadder(2, 'wta'), [1]);
  assert.equal(payoutLadder(135).length, 19);
});
test('placement points increase with finish, win bonus, multiplier', () => {
  const pp = (place, o = {}) => placePoints({ place, entrants: 45, tableSize: 9, paid: 6, ...o });
  for (let p = 2; p <= 45; p++) assert.ok(pp(p - 1) >= pp(p));
  assert.ok(pp(1) > pp(2) + 10);
  assert.ok(pp(1, { mult: 3 }) > pp(1) * 2.9);
  assert.equal(pp(45), 0);
});
test('blind levels increase and extrapolate past the table', () => {
  const s = makeStructure({ bb: 20, levels: 10, handsPerLevel: 8 });
  for (let k = 1; k < 25; k++) assert.ok(levelAt(s, k).bb >= levelAt(s, k - 1).bb);
  assert.ok(levelAt(s, 20).bb > levelAt(s, 9).bb);
  assert.ok(s.levels.some((l) => l.ante > 0));
});
test('sit&go (9): terminates, places form a permutation, chips conserved every round, prizes sum to pool', () => {
  const t = createTournament(mkDef({ format: 'sitgo' }), { player: { id: 'hero', name: 'Hero' }, seed: 5 });
  assert.equal(aliveChips(t), 13500);
  let g = 0;
  while (t.phase !== 'finished') { startNextHand(t, { interactive: false }); assert.equal(aliveChips(t), 13500); assert.ok(++g < 1000); }
  assert.deepEqual(t.entrants.map((e) => e.place).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(t.prizes.reduce((a, b) => a + b, 0), t.prizePool);
  const r = tournamentResult(t); assert.ok(r.place >= 1 && r.place <= 9);
});
test('MTT (45 players): tables always balanced within one, minimal table count, final table, unique places', () => {
  const t = createTournament(mkDef({ entrants: 45, tableSize: 9, startStack: 3000, structure: makeStructure({ bb: 50, handsPerLevel: 9 }) }), { player: { id: 'hero', name: 'Hero' }, seed: 11 });
  assert.deepEqual(sizes(t), [9, 9, 9, 9, 9]);
  let g = 0; const seen = new Set(); let finalSeen = false; let broken = 0;
  while (t.phase !== 'finished') {
    const r = startNextHand(t, { interactive: false });
    for (const e of r.events) { seen.add(e.t); if (e.t === 'table_broken') broken++; if (e.t === 'final_table') finalSeen = true; }
    if (t.phase !== 'finished') {
      const sz = sizes(t);
      assert.ok(Math.max(...sz) - Math.min(...sz) <= 1, 'unbalanced ' + sz);
      assert.equal(t.tables.length, Math.ceil(t.remaining / t.tableSize));
      assert.equal(sz.reduce((a, b) => a + b, 0), t.remaining);
    }
    assert.equal(aliveChips(t), t.totalChips);
    assert.ok(++g < 2000);
  }
  assert.ok(finalSeen && broken >= 3 && seen.has('bust') && seen.has('level_up') && seen.has('bubble'));
  assert.deepEqual(t.entrants.map((e) => e.place).sort((a, b) => a - b), [...Array(45)].map((_, i) => i + 1));
  assert.equal(t.totalChips, 135000);
});
test('MTT: bust-out pacing is believable (field halves well before the end, not all at once)', () => {
  const t = createTournament(mkDef({ entrants: 90, tableSize: 9, startStack: 3000, structure: makeStructure({ bb: 50, handsPerLevel: 9 }) }), { player: { id: 'hero', name: 'Hero' }, seed: 3 });
  const rounds = [];
  while (t.phase !== 'finished') { startNextHand(t, { interactive: false }); rounds.push(t.remaining); }
  const maxDrop = Math.max(...rounds.map((r, i) => (i ? rounds[i - 1] - r : 90 - r)));
  assert.ok(maxDrop <= 10, 'max bust-outs in one round ' + maxDrop);
  assert.ok(rounds.length > 40 && rounds.length < 400, 'rounds ' + rounds.length);
});
test('championship: day 1 / day 2 / final stages and prize structure (135 entrants)', () => {
  const t = createTournament(mkDef({ format: 'championship', entrants: 135, tableSize: 9, startStack: 30000, guarantee: 500000, day2Frac: 0.4, structure: makeStructure({ bb: 200, handsPerLevel: 12, handsPerLevelFinal: 18 }) }), { player: { id: 'hero', name: 'Hero' }, seed: 8 });
  assert.equal(t.stage, 'day1'); assert.equal(t.prizePool, 100 * 135 + 500000);
  const stages = [t.stage]; let g = 0;
  while (t.phase !== 'finished') { const r = startNextHand(t, { interactive: false }); for (const e of r.events) if (e.t === 'stage') stages.push(e.stage); assert.ok(++g < 3000); }
  assert.deepEqual(stages, ['day1', 'day2', 'final']);
});
test('interactive loop: human folds, AI acts, hand ends, next hand starts, state resumable', () => {
  const t = createTournament(mkDef({ format: 'sitgo', entrants: 6, tableSize: 6 }), { player: { id: 'hero', name: 'Hero' }, seed: 2 });
  let hands = 0;
  while (t.phase !== 'finished' && !human(t).out && hands < 400) {
    const r = startNextHand(t);
    if (!r.hand) { hands++; continue; }
    assert.equal(t.phase, 'hand');
    let guard = 0;
    while (t.phase === 'hand') {
      const a = actor(t);
      if (a.kind === 'human') { const L = legal(t); act(t, L.canCheck ? { type: 'check' } : { type: 'fold' }); const v = humanView(t); if (v) for (const p of v.players) if (p.id !== 'hero' && !p.showed) assert.ok(p.hole.every((c) => c === -1)); }
      else aiAct(t);
      assert.ok(++guard < 300);
    }
    hands++;
    assert.ok(t.lastHand);
  }
  assert.ok(human(t).out || t.phase === 'finished');
  const res = simulateToEnd(t);
  assert.ok(res.finished && res.place >= 2); // folding every hand never wins
});
test('resume mid-hand: JSON round-trip continues identically (same results, same state)', () => {
  const mk = () => createTournament(mkDef({ entrants: 18, tableSize: 9, startStack: 3000, structure: makeStructure({ bb: 50, handsPerLevel: 6 }) }), { player: { id: 'hero', name: 'Hero' }, seed: 33 });
  const drive = (t, limitActions) => {
    let n = 0;
    while (t.phase !== 'finished' && !human(t).out) {
      if (t.phase !== 'hand') startNextHand(t);
      while (t.phase === 'hand') { const a = actor(t); if (a.kind === 'human') botAct(t, ARCHETYPES.balanced); else aiAct(t); if (limitActions && ++n >= limitActions && t.phase === 'hand') return t; }
    }
    return t;
  };
  const a = drive(mk(), 0);
  const full = simulateToEnd(a);
  // second run: stop after ~40 actions, serialise, reload, finish
  const b = drive(mk(), 25);
  assert.equal(b.phase, 'hand');
  const restored = JSON.parse(JSON.stringify(b));
  const b2 = drive(restored, 0); const full2 = simulateToEnd(b2);
  assert.deepEqual(full2.place, full.place); assert.deepEqual(full2.points, full.points);
  assert.deepEqual(restored.entrants.map((e) => e.place), a.entrants.map((e) => e.place));
});
test('headless bot completes tournaments and heads-up duels end with places 1 and 2', () => {
  const d = createTournament(mkDef({ format: 'duel', entrants: 2, tableSize: 2, payoutKind: 'wta', rivals: [{ id: 'r_x', name: 'X', profile: ARCHETYPES.shark }] }), { player: { id: 'hero', name: 'Hero' }, seed: 4 });
  const r = simulateWithBot(d, ARCHETYPES.balanced);
  assert.ok(r.place === 1 || r.place === 2);
  assert.equal(r.prize, r.place === 1 ? 200 : 0);
  const three = createTournament(mkDef({ format: 'duel', entrants: 3, tableSize: 3, payoutKind: 'wta' }), { player: { id: 'hero', name: 'Hero' }, seed: 4 });
  assert.deepEqual(simulateWithBot(three, ARCHETYPES.balanced).entrants, 3);
});
test('quick cash table never finishes; busted players rebuy automatically', () => {
  const t = createTournament(quickCashDef('medium', 6), { player: { id: 'hero', name: 'Hero' }, seed: 6 });
  let rebuys = 0, g = 0;
  for (let h = 0; h < 80; h++) {
    const r = startNextHand(t);
    if (r.hand) while (t.phase === 'hand') { if (actor(t).kind === 'human') botAct(t, ARCHETYPES.maniac); else aiAct(t); assert.ok(++g < 20000); }
    for (const e of t.events) if (e.t === 'rebuy') rebuys++;
    assert.notEqual(t.phase, 'finished'); assert.equal(t.remaining, 6);
  }
  assert.ok(rebuys > 0 && t.entrants.every((e) => e.stack > 0 && !e.out));
});
test('quick sit&go definition works for every difficulty', () => {
  for (const d of ['easy', 'medium', 'hard']) {
    const t = createTournament(quickSitGoDef(d, 6), { player: { id: 'hero', name: 'Hero' }, seed: 1 });
    assert.ok(simulateToEnd(t).finished);
  }
});
test('spectating after elimination: AI-only hands on a table until the end', () => {
  const t = createTournament(mkDef({ format: 'sitgo', entrants: 6, tableSize: 6 }), { player: { id: 'hero', name: 'Hero' }, seed: 9 });
  // eliminate hero quickly: shove-bot with the weakest hands is not guaranteed; fold until blinds eat the stack
  let g = 0;
  while (!human(t).out && t.phase !== 'finished' && g++ < 500) { const r = startNextHand(t); if (r.hand) while (t.phase === 'hand') { if (actor(t).kind === 'human') { const L = legal(t); act(t, L.canCheck ? { type: 'check' } : { type: 'fold' }); } else aiAct(t); } }
  assert.ok(human(t).out);
  if (t.phase !== 'finished') {
    const r = startNextHand(t, { spectate: true });
    if (r.hand) { assert.equal(actor(t).kind, 'ai'); while (t.phase === 'hand') aiAct(t); }
    assert.ok(simulateToEnd(t).finished);
  }
});
test('standing() exposes HUD data consistently', () => {
  const t = createTournament(mkDef({ entrants: 27, tableSize: 9 }), { player: { id: 'hero', name: 'Hero' }, seed: 12 });
  const s = standing(t);
  assert.equal(s.remaining, 27); assert.equal(s.tablesLeft, 3); assert.equal(s.avgStack, 1500); assert.equal(s.level, 1);
  assert.ok(s.nextBlinds.bb > s.blinds.bb); assert.equal(s.paid, 4); assert.equal(s.inMoney, false);
});
test('rivals specified by the def are seated and appear in the result', () => {
  const rivals = [{ id: 'r_a', rivalId: 'a', name: 'Alpha', profile: ARCHETYPES.shark }, { id: 'r_b', rivalId: 'b', name: 'Beta', profile: ARCHETYPES.wall }];
  const t = createTournament(mkDef({ format: 'sitgo', rivals }), { player: { id: 'hero', name: 'Hero' }, seed: 4 });
  const res = simulateToEnd(t);
  assert.deepEqual(res.rivals.map((r) => r.id).sort(), ['a', 'b']);
  for (const r of res.rivals) assert.equal(r.playerBeat, r.place > res.place);
});
