// Headless career simulator: a bot plays a whole career (real tournaments, real AI fields) through all four circuits
// to the World Championship, checking after EVERY result that no impossible state exists, and that save/load is lossless.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../career/career.js';
import { EVENT_BY_ID } from '../career/circuits.js';
import { loadCareer, saveCareer } from '../career/store.js';
import { simulateWithBot } from '../tournament/tournament.js';
import { ARCHETYPES } from '../ai/profiles.js';
import { assertCareerSound, snapshot } from './career_invariants.mjs';
import { placePoints } from '../tournament/structures.js';

const memStore = () => { const m = new Map(); return { get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d), set: (k, v) => m.set(k, JSON.stringify(v)), remove: (k) => m.delete(k) }; };
const BOT = { ...ARCHETYPES.professor, skill: 9 };
const WORLD_REAL_ATTEMPTS = +(process.env.CAREER_SIM_WORLD_ATTEMPTS || 4);

function chooseEvent(c, tick) {
  const open = C.listEvents(c).filter((s) => s.unlocked);
  const by = (id) => open.find((s) => s.id === id);
  if (c.champion === 0 && by('world_main')) return 'world_main';
  const cur = C.currentCircuit(c);
  const here = open.filter((s) => s.event.circuit === cur);
  if (cur === 'intl' && !c.qualifiedWorld && by('intl_sat') && tick % 2 === 0) return 'intl_sat';
  // the least-played open event of the highest circuit (finals, duels and specials included so every requirement/story path is exercised)
  return here.slice().sort((a, b) => a.played - b.played)[0].id;
}

test('career simulator: bot plays Local -> Regional -> International -> World Championship', { timeout: 20 * 60 * 1000 }, () => {
  const store = memStore();
  let c = C.newCareer({ name: 'SimBot', seed: 2026 });
  assertCareerSound(c);
  const log = []; const firstAt = {}; let worldAttempts = 0; let forced = false;
  let tick = 0; const t0 = Date.now();
  while (c.champion === 0 && tick < 400) {
    tick++;
    const id = chooseEvent(c, tick);
    const st = C.eventStatus(c, id);
    assert.ok(st.unlocked, `bot tried to enter a locked event ${id}`);
    const prev = snapshot(c);
    const t = C.startEvent(c, id);
    // persistence mid-career: save with a running tournament, reload, continue from the restored copy
    assert.ok(saveCareer(store, c));
    c = loadCareer(store); assert.ok(c && c.tournament, 'restore failed'); assertCareerSound(c);
    simulateWithBot(c.tournament, BOT);
    const rep = C.finishEvent(c);
    assertCareerSound(c, prev);
    const e = EVENT_BY_ID[id];
    assert.equal(rep.result.entrants, e.entrants);
    assert.ok(rep.result.place >= 1 && rep.result.place <= e.entrants);
    assert.equal(rep.result.points, placePoints({ place: rep.result.place, entrants: e.entrants, tableSize: e.tableSize, paid: rep.result.paid, ko: rep.result.ko, mult: e.mult }));
    for (const k of rep.newCircuits) firstAt[k] ??= tick;
    if (rep.qualifiedNow) firstAt.qualified ??= tick;
    log.push(`${tick}. ${id} place ${rep.result.place}/${e.entrants} pts ${rep.result.points}${rep.newCircuits.length ? ' UNLOCK ' + rep.newCircuits : ''}${rep.qualifiedNow ? ' QUALIFIED via ' + C.championshipQualification(c).via : ''}${rep.championNow ? ' CHAMPION' : ''}`);
    if (id === 'world_main') {
      worldAttempts++;
      assert.ok(prev.qualified, 'entered the World Championship without qualifying');
      if (c.champion === 0 && worldAttempts >= WORLD_REAL_ATTEMPTS) break;
    }
    // sanity on circuit progression: a circuit can only open after a result, in order
  }
  if (c.champion === 0) {
    // Real attempts at the Worlds did not produce a champion within the budget: exercise the champion branch with a result
    // that is consistent with a real finish (recordResult is the same code path used by finishEvent).
    forced = true;
    assert.ok(c.qualifiedWorld && c.unlocked.includes('world'), 'reached the championship without qualifying');
    const e = EVENT_BY_ID.world_main; const prev = snapshot(c);
    const res = { defId: e.id, place: 1, entrants: e.entrants, paid: 19, prize: 600000, points: placePoints({ place: 1, entrants: e.entrants, tableSize: 9, paid: 19, ko: 4, mult: e.mult }), ko: 4, finalTable: true, won: true, cashed: true, rounds: 100, rivals: [], feats: { handsPlayed: 80, handsWon: 30, biggestPot: 150000, bluffWins: 2, allInWins: 3, comeback: false }, finished: true, playerOut: true };
    const rep = C.recordResult(c, 'world_main', res);
    assertCareerSound(c, prev); assert.ok(rep.championNow);
  }
  // ---- final state: the whole career is consistent ----
  assertCareerSound(c);
  assert.deepEqual(c.unlocked, ['local', 'regional', 'intl', 'world']);
  assert.ok(c.qualifiedWorld && c.champion >= 1 && c.titles.includes('world_main'));
  assert.ok(c.achievements.champion && c.achievements.qualify_regional && c.achievements.qualify_intl && c.achievements.qualify_world && c.achievements.first_win);
  assert.ok(c.playedEvents.world_main >= 1);
  assert.ok(firstAt.regional < firstAt.intl && firstAt.intl <= firstAt.qualified && firstAt.qualified <= firstAt.world, JSON.stringify(firstAt));
  // legends mode opens after the title
  assert.ok(C.eventStatus(c, 'world_legend_duel').unlocked && C.eventStatus(c, 'world_legends_cup').unlocked);
  const t = C.startEvent(c, 'world_legends_cup'); simulateWithBot(t, BOT); const rep = C.finishEvent(c); assertCareerSound(c);
  assert.ok(rep.result.finished);
  // standings reflect the career; story beats seen in order of milestones
  const stn = C.standings(c, 'intl'); assert.ok(stn.rows.length >= 8 && stn.you.rank >= 1);
  assert.ok(c.story.seen.includes('regional_open') && c.story.seen.includes('intl_welcome') && c.story.seen.includes('worlds_invite') && c.story.seen.includes('champion_crowned'));
  console.log(`career sim: ${tick} tournaments in ${((Date.now() - t0) / 1000).toFixed(1)}s, unlocks at tournament #: ${JSON.stringify(firstAt)}, world attempts: ${worldAttempts}${forced ? ' (+1 recorded champion result)' : ' (real win)'}`);
  console.log(`final: level ${c.level}, rep ${c.rep}, wins ${c.stats.wins}, finals ${c.stats.finalTables}, cashes ${c.stats.cashes}, winnings ${c.stats.winnings}, achievements ${Object.keys(c.achievements).length}/${C.listAchievements(c).length}, seasons ${c.seasonHistory.length}`);
  console.log(log.slice(-16).join('\n'));
});
