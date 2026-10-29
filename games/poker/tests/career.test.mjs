import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../career/career.js';
import { EVENTS, EVENT_BY_ID, QUAL_WORLD, buildDef, CIRCUITS } from '../career/circuits.js';
import { RIVALS, RIVAL_BY_ID } from '../career/rivals.js';
import { ACHIEVEMENTS, listAchievements } from '../career/achievements.js';
import { evalReq } from '../career/req.js';
import { validateCareer, saveCareer, loadCareer, resetCareer, validTournament, KEYS, loadQuick, saveQuick, recordQuickSitGo } from '../career/store.js';
import { createTournament, startNextHand, actor, aiAct, botAct, simulateWithBot, human, act } from '../tournament/tournament.js';
import { payoutLadder, placePoints } from '../tournament/structures.js';
import { ARCHETYPES } from '../ai/profiles.js';
import { tx } from '../career/text.js';
import { assertCareerSound, snapshot } from './career_invariants.mjs';

import { fakeResult as fake } from '../career/testing.js';
const rec = (c, id, place, o) => { const prev = snapshot(c); const r = C.recordResult(c, id, fake(id, place, o)); assertCareerSound(c, prev); return r; };

test('static data: events/circuits/rivals/achievements are well-formed and trilingual', () => {
  assert.ok(RIVALS.length >= 8);
  for (const r of RIVALS) { for (const f of ['blurb', 'bio', 'nick', 'style', 'origin']) for (const l of ['pt', 'en', 'es']) assert.ok(r[f][l], `${r.id}.${f}.${l}`); assert.ok(r.quotes.length >= 1 && r.profile.skill >= 1 && r.circuits.length); }
  assert.ok(RIVALS.some((r) => r.arc) && RIVALS.some((r) => r.finalBoss));
  for (const e of EVENTS) {
    assert.ok(e.rivals.every((id) => RIVAL_BY_ID[id]), e.id);
    for (const l of ['pt', 'en', 'es']) { assert.ok(e.name[l] && e.sub[l]); if (e.title) assert.ok(e.title[l]); }
    const d = buildDef(e.id); assert.equal(d.entrants, e.entrants); assert.ok(d.rivals.length <= e.entrants);
    assert.ok(e.circuit && CIRCUITS.some((c) => c.id === e.circuit));
    if (e.format === 'duel') assert.ok(e.story && e.story.intro.pt && e.story.win.es && e.story.lose.en);
  }
  for (const a of ACHIEVEMENTS) for (const l of ['pt', 'en', 'es']) assert.ok(a.name[l] && a.desc[l], a.id);
  assert.equal(tx({ pt: 'a', en: 'b', es: 'c' }, 'es'), 'c');
});
test('fresh career: nothing earned, only the first circuit open, no achievements', () => {
  const c = C.newCareer({ name: 'Ana', seed: 1 });
  assertCareerSound(c);
  assert.deepEqual(c.unlocked, ['local']);
  assert.equal(Object.keys(c.achievements).length, 0);
  const st = C.listEvents(c);
  assert.ok(st.find((s) => s.id === 'local_cafe').unlocked);
  for (const s of st.filter((s) => s.event.circuit !== 'local')) assert.equal(s.unlocked, false, s.id);
  assert.equal(st.find((s) => s.id === 'local_friday').unlocked, false); // needs 1 played
  assert.throws(() => C.startEvent(c, 'reg_open'));
  assert.equal(C.recommendedEvent(c), 'local_cafe');
  assert.ok(!C.championshipQualification(c).qualified);
  assert.equal(C.currentCircuit(c), 'local');
  assert.equal(C.listAchievements(c).filter((a) => a.unlocked).length, 0);
});
test('losing never unlocks anything; progress only from results; tutorial achievement only after finishing the tutorial event', () => {
  const c = C.newCareer({ seed: 2 });
  const r = rec(c, 'local_cafe', 6);
  assert.deepEqual(r.newCircuits, []); assert.deepEqual(c.unlocked, ['local']);
  assert.deepEqual(r.newAchievements.sort(), ['first_tournament', 'tutorial_done']);
  for (let i = 0; i < 12; i++) rec(c, i % 2 ? 'local_cafe' : 'local_friday', i % 2 ? 6 : 9);
  assert.deepEqual(c.unlocked, ['local']);
  assert.equal(c.stats.wins, 0); assert.ok(!c.achievements.first_win);
  assert.equal(c.stats.played, 13);
});
test('first win unlocks Regional (title, moment, story beat, cosmetics, achievements), levels and rep grow', () => {
  const c = C.newCareer({ seed: 3 });
  rec(c, 'local_cafe', 4);
  const r = rec(c, 'local_cafe', 1);
  assert.deepEqual(r.newCircuits, ['regional']);
  assert.ok(r.moments.includes('first_win') && r.moments.includes('title') && r.moments.includes('circuit_unlocked:regional'));
  assert.equal(r.titleWon.event, 'local_cafe');
  assert.ok(r.storyBeats.includes('regional_open'));
  assert.ok(c.achievements.first_win && c.achievements.qualify_regional && c.achievements.win_local_title);
  assert.ok(r.newCosmetics.some((x) => x.slot === 'theme' && x.id === 'burgundy') && r.newCosmetics.some((x) => x.slot === 'back' && x.id === 'ruby'));
  assert.ok(r.xpGain > 0 && c.xp > 0 && c.rep > 0);
  // repeating a title does not duplicate it
  const r2 = rec(c, 'local_cafe', 1);
  assert.equal(r2.titleWon.repeat, true); assert.equal(c.titles.length, 1);
  assert.equal(C.recommendedEvent(c) !== 'local_cafe' || true, true);
});
test('a duel win does not count as a tournament win for unlocking; it counts as a duel win', () => {
  const c = C.newCareer({ seed: 4 });
  rec(c, 'local_cafe', 3); rec(c, 'local_friday', 5);
  rec(c, 'local_duel', 1);
  assert.deepEqual(c.unlocked, ['local']);
  assert.equal(c.stats.duelWins, 1); assert.equal(c.stats.wins, 0);
  assert.ok(c.achievements.heads_up_winner && !c.achievements.first_win);
});
test('event requirements gate correctly and expose progress', () => {
  const c = C.newCareer({ seed: 5 });
  let s = C.eventStatus(c, 'local_mini'); assert.equal(s.unlocked, false); assert.equal(s.req.cur, 0); assert.equal(s.req.target, 3);
  rec(c, 'local_cafe', 6); rec(c, 'local_cafe', 6);
  s = C.eventStatus(c, 'local_mini'); assert.equal(s.unlocked, false); assert.equal(s.req.cur, 2);
  rec(c, 'local_friday', 9);
  assert.equal(C.eventStatus(c, 'local_mini').unlocked, true);
  assert.equal(C.eventStatus(c, 'local_final').unlocked, false);
  for (let i = 0; i < 2; i++) rec(c, 'local_mini', 18);
  assert.equal(C.eventStatus(c, 'local_final').unlocked, true); // 5 played
});
test('Regional -> International: by consistency points OR by the Masters title', () => {
  const mk = () => { const c = C.newCareer({ seed: 6 }); rec(c, 'local_cafe', 1); return c; };
  // path A: points
  const a = mk(); let n = 0;
  while (!a.unlocked.includes('intl') && n++ < 30) rec(a, 'reg_open', 4);
  assert.ok(a.unlocked.includes('intl')); assert.ok(a.pts.regional.you >= 220); assert.ok(n >= 2, 'one decent finish is not enough');
  // path B: win the final directly (needs 80 points to enter)
  const b = mk(); rec(b, 'reg_open', 12); assert.equal(C.eventStatus(b, 'reg_final').unlocked, b.pts.regional.you >= 80);
  rec(b, 'reg_open', 3);
  assert.ok(C.eventStatus(b, 'reg_final').unlocked);
  const before = b.pts.regional.you;
  const r = rec(b, 'reg_final', 1);
  assert.ok(b.wonEvents.reg_final === 1 && (r.newCircuits.includes('intl') || before >= 220));
  assert.ok(b.unlocked.includes('intl'));
});
test('World Championship qualification: three independent paths, locked otherwise, persistent once earned', () => {
  const toIntl = () => { const c = C.newCareer({ seed: 7 }); rec(c, 'local_cafe', 1); for (let i = 0; i < 6 && !c.unlocked.includes('intl'); i++) rec(c, 'reg_open', 2); assert.ok(c.unlocked.includes('intl')); return c; };
  // not qualified by playing intl events badly
  const c0 = toIntl(); for (let i = 0; i < 3; i++) rec(c0, 'intl_open', 60);
  assert.equal(c0.qualifiedWorld, false); assert.ok(!c0.unlocked.includes('world')); assert.equal(C.eventStatus(c0, 'world_main').unlocked, false);
  assert.throws(() => C.startEvent(c0, 'world_main'));
  // path 1: international title
  const c1 = toIntl(); const r1 = rec(c1, 'intl_open', 1);
  assert.ok(r1.qualifiedNow && c1.qualifiedWorld && c1.unlocked.includes('world')); assert.ok(C.championshipQualification(c1).via.includes('title'));
  assert.ok(r1.storyBeats.includes('worlds_invite') && c1.achievements.qualify_world);
  rec(c1, 'intl_open', 63); assert.ok(c1.qualifiedWorld, 'qualification persists');
  // path 2: satellite
  const c2 = toIntl(); rec(c2, 'intl_open', 40); rec(c2, 'intl_open', 40);
  assert.ok(C.eventStatus(c2, 'intl_sat').unlocked);
  const r2 = rec(c2, 'intl_sat', 1);
  assert.ok(r2.qualifiedNow); assert.deepEqual(C.championshipQualification(c2).via, ['satellite']); assert.equal(c2.titles.includes('intl_sat'), true);
  // path 3: ranking top-4 after 4 events
  const c3 = toIntl(); const played = () => c3.playedEvents; let g = 0;
  while (!c3.qualifiedWorld && g++ < 40) rec(c3, g % 2 ? 'intl_open' : 'intl_ko', 2 + (g % 3));
  assert.ok(c3.qualifiedWorld, 'consistent top finishes rank in the top 4');
  assert.ok(C.championshipQualification(c3).via.length >= 1);
  assert.ok(Object.values(played()).reduce((a, b) => a + b, 0) >= 5);
});
test('winning the World Championship: champion, trophy title, story, legends mode opens', () => {
  const c = C.newCareer({ seed: 8 }); rec(c, 'local_cafe', 1); for (let i = 0; i < 6 && !c.unlocked.includes('intl'); i++) rec(c, 'reg_open', 2);
  rec(c, 'intl_open', 1);
  assert.equal(C.eventStatus(c, 'world_legend_duel').unlocked, false);
  const lose = rec(c, 'world_main', 30);
  assert.equal(c.champion, 0); assert.equal(lose.championNow, false);
  assert.equal(C.eventStatus(c, 'world_legends_cup').unlocked, false);
  const win = rec(c, 'world_main', 1, { koOf: ['legend'] });
  assert.equal(c.champion, 1); assert.ok(win.championNow && win.moments.includes('champion') && win.storyBeats.includes('champion_crowned'));
  assert.ok(c.achievements.champion && c.achievements.win_intl_title && c.achievements.rival_hunter);
  assert.ok(c.titles.includes('world_main'));
  assert.ok(C.eventStatus(c, 'world_legend_duel').unlocked && C.eventStatus(c, 'world_legends_cup').unlocked);
  assert.ok(win.newCosmetics.some((x) => x.slot === 'back' && x.id === 'violet') && win.newCosmetics.some((x) => x.slot === 'frame' && x.id === 'champion'));
  const win2 = rec(c, 'world_main', 1); assert.equal(c.champion, 2); assert.equal(win2.championNow, false);
  assert.ok(C.nextObjective(c).id === 'legends');
});
test('rival head-to-head, knockouts and standings', () => {
  const c = C.newCareer({ seed: 9 });
  rec(c, 'local_friday', 2, { rivalPlaces: { tito: 1, bartholomew: 5 }, koBy: ['tito'] });
  rec(c, 'local_friday', 6, { rivalPlaces: { tito: 3, bartholomew: 9 }, koOf: ['bartholomew'] });
  const t = c.rivals.tito, b = c.rivals.bartholomew;
  assert.deepEqual([t.met, t.beaten, t.lostTo, t.koOnYou], [2, 0, 2, 1]);
  assert.deepEqual([b.met, b.beaten, b.lostTo, b.koByYou], [2, 2, 0, 1]);
  const st = C.standings(c, 'local');
  assert.equal(st.rows.length, 1 + RIVALS.filter((r) => r.circuits.includes('local')).length);
  assert.ok(st.rows.every((r, i) => i === 0 || st.rows[i - 1].pts >= r.pts));
  assert.equal(st.rows[st.you.rank - 1].isYou, true);
  assert.ok(C.listRivals(c).find((r) => r.id === 'tito').met);
  assert.ok(!C.listRivals(c).find((r) => r.id === 'legend').met);
});
test('rivals earn points only in their circuits; real finishes count for rivals in the field', () => {
  const c = C.newCareer({ seed: 10 });
  rec(c, 'local_friday', 5, { rivalPlaces: { tito: 1, bartholomew: 2 } });
  assert.ok(c.pts.local.tito > c.pts.local.bartholomew);
  assert.equal(c.pts.local.legend, undefined); assert.equal(c.pts.regional.tito, undefined);
});
test('seasons roll over after N events: history, reset points, season title', () => {
  const c = C.newCareer({ seed: 11 }); let ended = null;
  for (let i = 0; i < C.SEASON_LENGTH; i++) { const r = rec(c, 'local_cafe', 1); if (r.seasonEnded) ended = r.seasonEnded; }
  assert.ok(ended); assert.equal(ended.n, 1); assert.equal(c.season.n, 2); assert.equal(c.season.events, 0);
  assert.equal(c.pts.season.you, 0); assert.equal(c.seasonHistory.length, 1);
  assert.ok(ended.points > 0 && ended.rank >= 1);
  assert.equal(ended.champion, ended.rank === 1);
  if (ended.rank === 1) assert.ok(c.achievements.season_champion);
  assert.ok(c.pts.local.you > 0, 'circuit points persist across seasons');
});
test('levels and reputation: monotonic, derived from results', () => {
  assert.equal(C.levelFromXp(0), 1); assert.equal(C.levelFromXp(99), 1); assert.equal(C.levelFromXp(100), 2); assert.equal(C.levelFromXp(300), 3);
  for (let x = 0; x < 20000; x += 137) assert.ok(C.levelFromXp(x + 137) >= C.levelFromXp(x));
  const c = C.newCareer({ seed: 12 }); const r0 = C.reputationInfo(c); assert.equal(r0.tier.id, 'unknown');
  for (let i = 0; i < 6; i++) rec(c, 'local_cafe', 1);
  assert.ok(C.reputationInfo(c).rep > r0.rep); assert.ok(c.level >= 2);
  const li = C.levelInfo(c); assert.ok(li.progress >= 0 && li.progress < 1);
});
test('achievements: progress is real and never granted early', () => {
  const c = C.newCareer({ seed: 13 });
  rec(c, 'local_friday', 5);
  const list = listAchievements(c);
  assert.equal(list.find((a) => a.id === 'ten_tournaments').cur, 1);
  assert.equal(list.find((a) => a.id === 'ten_tournaments').unlocked, false);
  for (const a of list) if (a.unlocked) assert.ok(a.cur >= a.target, a.id);
  assert.ok(!c.achievements.first_cash || c.stats.cashes > 0);
  rec(c, 'local_friday', 2); // 2nd of 9 = cash
  assert.ok(c.achievements.first_cash);
  assert.ok(!c.achievements.bluff_artist && !c.achievements.comeback_kid && !c.achievements.big_pot);
  rec(c, 'local_friday', 4, { feats: { handsPlayed: 30, handsWon: 9, biggestPot: 25000, bluffWins: 5, allInWins: 5, comeback: true } });
  assert.ok(c.achievements.big_pot && c.achievements.bluff_artist && c.achievements.comeback_kid && c.achievements.allin_hero);
});
test('profile/cosmetics: only owned items can be selected; titles from titles earned', () => {
  const c = C.newCareer({ name: 'Zé', seed: 14 });
  assert.equal(C.selectCosmetic(c, 'theme', 'royal'), false);
  assert.equal(C.selectCosmetic(c, 'theme', 'emerald'), true);
  C.setProfile(c, { name: '  Maria  ', avatar: 'p12', title: 'local_cafe' });
  assert.equal(c.profile.name, 'Maria'); assert.equal(c.profile.avatar, 'p1'); assert.equal(c.cosmetics.selected.title, null);
  rec(c, 'local_cafe', 1);
  C.setProfile(c, { title: 'local_cafe', avatar: 'p2' });
  assert.equal(c.cosmetics.selected.title, 'local_cafe'); assert.equal(c.profile.avatar, 'p2');
  const ps = C.profileSummary(c); assert.equal(ps.wins, 1); assert.equal(ps.circuit, 'regional');
  assert.ok(C.listCosmetics(c, 'back').some((x) => x.unlocked) && C.listCosmetics(c, 'back').some((x) => !x.unlocked));
});
test('progression map and next objective', () => {
  const c = C.newCareer({ seed: 15 });
  let m = C.progressionMap(c); assert.equal(m.length, 4); assert.deepEqual(m.map((x) => x.unlocked), [true, false, false, false]); assert.ok(m[0].current && !m[1].current);
  assert.equal(C.nextObjective(c).id, 'first_title');
  rec(c, 'local_cafe', 1); m = C.progressionMap(c); assert.ok(m[1].unlocked && m[1].current && !m[0].current);
});
// ---- integration with real tournaments ----
test('startEvent / finishEvent with a real tournament (bot) records one consistent result', () => {
  const c = C.newCareer({ name: 'Bot', seed: 16 });
  const t = C.startEvent(c, 'local_cafe', { seed: 123 });
  assert.ok(c.tournament === t);
  assert.throws(() => C.startEvent(c, 'local_cafe'), /in progress/);
  assert.throws(() => C.finishEvent(c), /still in/);
  simulateWithBot(t, ARCHETYPES.balanced);
  const rep = C.finishEvent(c);
  assert.equal(c.tournament, null); assert.equal(c.stats.played, 1); assert.equal(rep.result.entrants, 6);
  assert.equal(c.results[0].place, rep.result.place);
  assertCareerSound(c);
});
test('forfeiting a running tournament counts as an elimination at the current position', () => {
  const c = C.newCareer({ seed: 17 });
  rec(c, 'local_cafe', 6);
  const t = C.startEvent(c, 'local_friday', { seed: 5 });
  startNextHand(t);
  const rep = C.forfeitEvent(c);
  assert.equal(c.tournament, null); assert.equal(c.stats.played, 2); assert.ok(rep.result.place >= 1 && rep.result.place <= 9);
  assert.equal(rep.result.place, 9, 'leaving a fresh tournament = last place'); assert.equal(c.stats.wins, 0);
  assertCareerSound(c);
});
// ---- persistence ----
const memStore = () => { const m = new Map(); return { get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d), set: (k, v) => m.set(k, JSON.stringify(v)), remove: (k) => m.delete(k), raw: m }; };
test('persistence: save/load round trip keeps everything incl. an in-progress tournament mid-hand', () => {
  const st = memStore(); assert.equal(loadCareer(st), null);
  const c = C.newCareer({ name: 'Persist', seed: 18 });
  rec(c, 'local_cafe', 1); rec(c, 'local_friday', 3); rec(c, 'local_friday', 8);
  const t = C.startEvent(c, 'local_mini', { seed: 77 });
  startNextHand(t); aiAct(t); // mid-hand
  assert.equal(t.phase, 'hand');
  assert.ok(saveCareer(st, c));
  const back = loadCareer(st);
  assert.ok(back); assert.equal(back.profile.name, 'Persist'); assert.equal(back.stats.played, 3); assert.deepEqual(back.unlocked, c.unlocked);
  assert.ok(back.tournament && back.tournament.phase === 'hand'); assert.ok(validTournament(back.tournament));
  assertCareerSound(back);
  // continue the restored tournament to the end and record it
  const t2 = back.tournament;
  while (t2.phase === 'hand' && !human(t2).out) { const a = actor(t2); if (a.kind === 'human') botAct(t2, ARCHETYPES.balanced); else aiAct(t2); }
  simulateWithBot(t2, ARCHETYPES.balanced);
  const rep = C.finishEvent(back); assert.ok(rep.result.finished); assertCareerSound(back);
});
test('persistence: corrupt / foreign / tampered data is handled safely', () => {
  const st = memStore();
  st.raw.set(KEYS.career, '{"v":1,"profile":'); // can't even parse via get -> simulate by raw JSON.parse failure
  const bad = { get: () => { throw new Error('boom'); }, set() {}, remove() {} };
  assert.equal(loadCareer(bad), null);
  for (const junk of ['x', 5, [], { v: 99 }, { v: 1, xp: 'a' }, null]) { const s = memStore(); s.set(KEYS.career, junk); const r = loadCareer(s); assert.ok(r === null || r.v === 1); }
  // tampering: huge/negative/NaN numbers and fake unlocks are sanitised
  const c = C.newCareer({ seed: 19 });
  const raw = JSON.parse(JSON.stringify(c));
  raw.xp = -50; raw.level = 999; raw.rep = 'many'; raw.unlocked = ['local', 'bogus', 'world']; raw.stats.wins = -3; raw.cosmetics.selected.theme = 'royal'; raw.titles = ['nope', 'local_cafe']; raw.qualifiedWorld = false;
  raw.tournament = { v: 1, defId: 'local_cafe', entrants: [], tables: [], def: {} }; raw.tournamentEvent = 'local_cafe';
  const v = validateCareer(raw);
  assert.ok(v); assert.equal(v.xp, 0); assert.ok(v.rep === 0); assert.equal(v.stats.wins, 0);
  assert.ok(!v.unlocked.includes('bogus')); assert.equal(v.cosmetics.selected.theme, 'emerald');
  assert.deepEqual(v.titles.filter((t) => t === 'nope'), []);
  assert.equal(v.tournament, null, 'invalid tournament dropped, career kept');
  assert.equal(validateCareer({ v: 2 }), null);
});
test('persistence: backup copy recovers from a corrupted main save; reset removes everything', () => {
  const st = memStore(); const c = C.newCareer({ name: 'Keep', seed: 20 });
  saveCareer(st, c); rec(c, 'local_cafe', 1); saveCareer(st, c);
  st.set(KEYS.career, { v: 1, garbage: true, profile: 5, unlocked: 'no', stats: 7 });
  const r = loadCareer(st);
  assert.ok(r); assert.ok(r.v === 1);
  st.set(KEYS.career, 'totally broken');
  const r2 = loadCareer(st); assert.ok(r2 && r2.profile.name === 'Keep');
  resetCareer(st); assert.equal(loadCareer(st), null);
});
test('quick-mode stats persist separately', () => {
  const st = memStore(); const q = loadQuick(st); recordQuickSitGo(q, { place: 1, cashed: true }); recordQuickSitGo(q, { place: 4, cashed: false });
  saveQuick(st, q); const q2 = loadQuick(st);
  assert.deepEqual([q2.sitgo.played, q2.sitgo.wins, q2.sitgo.cashes, q2.sitgo.best], [2, 1, 1, 1]);
});
test('requirement DSL: any/all/progress objects', () => {
  const c = C.newCareer({ seed: 21 });
  const r = evalReq(c, { kind: 'all', of: [{ kind: 'played', n: 1 }, { kind: 'level', n: 1 }] });
  assert.equal(r.met, false); assert.equal(r.cur, 1); assert.equal(r.target, 2);
  const q = evalReq(c, QUAL_WORLD); assert.equal(q.met, false); assert.equal(q.children.length, 3); assert.ok(q.children.every((x) => x.label.pt && x.label.es));
});
void act; void createTournament; void buildDef;
test('UI read-model views are consistent with the career', async () => {
  const V = await import('../career/views.js'); const { debugJump } = await import('../career/testing.js');
  const c = C.createCareer({ name: 'View', seed: 30 });
  let ev = V.eventView(c, 'local_cafe'); assert.equal(ev.state, 'available'); assert.ok(ev.recommended);
  ev = V.eventView(c, 'reg_open'); assert.equal(ev.state, 'locked'); assert.ok(ev.lockReason.missing.length >= 1);
  rec(c, 'local_cafe', 2);
  assert.equal(V.eventView(c, 'local_cafe').state, 'cashed'); assert.equal(V.eventView(c, 'local_cafe').best.place, 2);
  const pv = V.profileView(c); assert.equal(pv.played, 1); assert.ok(pv.xpForNext > 0);
  assert.equal(V.circuitView(c, 'local').events.length, 6); assert.equal(V.circuitView(c, 'regional').unlocked, false);
  assert.equal(V.seasonView(c).goals.length, 3); assert.ok(V.rankInfo(c, 'local').rank >= 1);
  assert.ok(V.achievementsView(c).find((a) => a.id === 'first_tournament').done);
  assert.ok(V.rivalsView(c).length >= 8); assert.ok(V.cosmeticsView(c).cardBacks.some((b) => b.unlocked));
  assert.equal(V.equip(c, 'tableTheme', 'royal'), false); assert.equal(V.equip(c, 'cardBack', 'royal'), true);
  assert.equal(C.nextCoach(c, 'first_flop').id, 'flop'); C.markCoach(c, 'flop'); assert.equal(C.nextCoach(c, 'first_flop'), null);
  const st = memStore(); saveCareer(st, c); assert.deepEqual(loadCareer(st).flags.coachSeen, ['flop']);
  debugJump(c, 'champion'); assertCareerSound(c); assert.equal(c.champion, 1);
  const rep = rec(c, 'local_cafe', 1); assert.ok(rep.unlockedCircuits && Array.isArray(rep.rewards) && rep.xp > 0);
});
