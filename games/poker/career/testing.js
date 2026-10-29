// Test / QA helpers (harmless: they only call the real recordResult path, so every state they produce is a legal career state).
import { EVENT_BY_ID } from './circuits.js';
import * as C from './career.js';
import { payoutLadder, placePoints } from '../tournament/structures.js';

/** A fabricated but internally consistent tournament result for `eventId` (used for deterministic progression tests / QA jumps). */
export function fakeResult(eventId, place, o = {}) {
  const e = EVENT_BY_ID[eventId]; const n = e.entrants;
  const paid = payoutLadder(n, e.payoutKind || 'auto').length;
  const ko = o.ko || 0;
  const rivals = e.rivals.map((id, k) => {
    const rp = o.rivalPlaces?.[id] ?? (place === 1 ? Math.min(n, 2 + k) : Math.min(n, place + 1 + k));
    return { id, place: rp, beatPlayer: rp < place, playerBeat: rp > place, knockedOutPlayer: !!o.koBy?.includes(id), knockedOutByPlayer: !!o.koOf?.includes(id) };
  });
  const ft = n > e.tableSize && place <= e.tableSize;
  const prize = place <= paid ? Math.round((e.buyIn * n) / Math.max(1, paid)) : 0;
  return { defId: eventId, place, entrants: n, paid, prize, points: placePoints({ place, entrants: n, tableSize: e.tableSize, paid, ko, mult: e.mult }), ko, finalTable: ft, won: place === 1, cashed: place <= paid, rounds: 50, rivals, feats: o.feats || { handsPlayed: 20, handsWon: 5, biggestPot: 500, bluffWins: 0, allInWins: 0, comeback: false }, finished: true, playerOut: true };
}
export const record = (c, eventId, place, o) => C.recordResult(c, eventId, fakeResult(eventId, place, o));

/** Build a career positioned at a stage by recording legal results:
 *  'new' | 'regional' (local title won) | 'intl' | 'world' (qualified, not yet played) | 'champion' | 'legends' */
export function careerAt(stage = 'new', { name = 'QA', seed = 99 } = {}) {
  const c = C.newCareer({ name, seed });
  if (stage === 'new') return c;
  record(c, 'local_cafe', 1);
  if (stage === 'regional') return c;
  for (let i = 0; i < 8 && !c.unlocked.includes('intl'); i++) record(c, 'reg_open', 2);
  if (stage === 'intl') return c;
  record(c, 'intl_open', 1);
  if (stage === 'world') return c;
  record(c, 'world_main', 1);
  return c;
}

/** Test hook: push an existing career forward to 'regional' | 'intl' | 'world_qualified' | 'champion' through legal recorded results. */
export function debugJump(c, stage) {
  if (c.tournament) c.tournament = null;
  const want = { regional: 1, intl: 2, world_qualified: 3, champion: 4 }[stage];
  if (!want) throw new Error('unknown stage ' + stage);
  if (want >= 1 && !c.unlocked.includes('regional')) record(c, 'local_cafe', 1);
  if (want >= 2) for (let i = 0; i < 8 && !c.unlocked.includes('intl'); i++) record(c, 'reg_open', 2);
  if (want >= 3 && !c.qualifiedWorld) record(c, 'intl_open', 1);
  if (want >= 4 && c.champion === 0) record(c, 'world_main', 1);
  return c;
}
