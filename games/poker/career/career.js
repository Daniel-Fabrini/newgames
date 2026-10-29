// Career model: profile, progression, rankings/seasons, achievements, rewards. Pure logic over a JSON career object `c`.
// Progression comes ONLY from recorded tournament results (recordResult / finishEvent). Everything is deterministic given seeds.
import { CIRCUITS, CIRCUIT_BY_ID, EVENTS, EVENT_BY_ID, QUAL_WORLD, COACH_STEPS, buildDef } from './circuits.js';
import { RIVALS, RIVAL_BY_ID } from './rivals.js';
import { evalReq, circuitPlayed, circuitRank } from './req.js';
import { evaluateAchievements, listAchievements } from './achievements.js';
import { refreshUnlocks, DEFAULT_SELECTED, listCosmetics, COSMETICS } from './rewards.js';
import { STORY_BEATS } from './story.js';
import { L } from './text.js';
import { createTournament, simulateToEnd, tournamentResult, human } from '../tournament/tournament.js';
import { placePoints } from '../tournament/structures.js';
import { mulberry32, mixSeed, randomSeed } from '../engine/rng.js';

export const CAREER_VERSION = 1;
export const SEASON_LENGTH = 8; // completed tournaments per season
export const MAX_RESULTS = 100;
export const CIRCUIT_IDS = CIRCUITS.map((c) => c.id);

export function newCareer({ name = 'Player', avatar = 'p1', seed = randomSeed(), now = 0 } = {}) {
  const c = {
    v: CAREER_VERSION, createdAt: now, seed: seed >>> 0, seq: 0,
    profile: { name: String(name).slice(0, 18) || 'Player', avatar },
    xp: 0, level: 1, rep: 0, unlocked: ['local'], qualifiedWorld: false, champion: 0,
    titles: [], wonEvents: {}, playedEvents: {},
    stats: { played: 0, wins: 0, duelWins: 0, finalTables: 0, cashes: 0, bestPlace: null, winnings: 0, ko: 0, hands: 0, handsWon: 0, biggestPot: 0, bluffWins: 0, allInWins: 0, comebacks: 0 },
    byCircuit: Object.fromEntries(CIRCUIT_IDS.map((k) => [k, { played: 0, wins: 0, cashes: 0, finalTables: 0, best: null }])),
    pts: { season: { you: 0 }, local: { you: 0 }, regional: { you: 0 }, intl: { you: 0 }, world: { you: 0 } },
    season: { n: 1, events: 0, wins: 0, best: null }, seasonHistory: [],
    rivals: {}, results: [], achievements: {}, cosmetics: { unlocked: [], selected: { ...DEFAULT_SELECTED } }, story: { seen: [] }, flags: { tutorialDone: false },
    tournament: null,
  };
  c.cosmetics.selected.avatar = avatar || 'p1';
  refreshUnlocks(c);
  return c;
}

// ---------- levels, reputation ----------
export const createCareer = newCareer;
export const xpForLevel = (L_) => 50 * L_ * (L_ - 1);
export const levelFromXp = (xp) => Math.min(60, Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2)));
export function levelInfo(c) {
  const lv = c.level, a = xpForLevel(lv), b = xpForLevel(lv + 1);
  return { level: lv, xp: c.xp, from: a, to: b, progress: lv >= 60 ? 1 : (c.xp - a) / (b - a) };
}
export const REP_TIERS = [
  { min: 0, id: 'unknown', name: L('Desconhecido', 'Unknown', 'Desconocido') },
  { min: 40, id: 'local_name', name: L('Nome Local', 'Local Name', 'Nombre Local') },
  { min: 150, id: 'regional_name', name: L('Nome Regional', 'Regional Name', 'Nombre Regional') },
  { min: 400, id: 'pro', name: L('Profissional', 'Professional', 'Profesional') },
  { min: 900, id: 'elite', name: L('Elite', 'Elite', 'Élite') },
  { min: 1800, id: 'legend', name: L('Lenda Viva', 'Living Legend', 'Leyenda Viva') },
];
export function reputationInfo(c) {
  let i = 0; for (let k = 0; k < REP_TIERS.length; k++) if (c.rep >= REP_TIERS[k].min) i = k;
  const next = REP_TIERS[i + 1] || null;
  return { rep: c.rep, tier: REP_TIERS[i], next, progress: next ? (c.rep - REP_TIERS[i].min) / (next.min - REP_TIERS[i].min) : 1 };
}

// ---------- events / unlocks ----------
export function circuitUnlocked(c, id) { return c.unlocked.includes(id); }
export function eventStatus(c, id) {
  const e = EVENT_BY_ID[id];
  const cu = circuitUnlocked(c, e.circuit);
  const req = e.req ? evalReq(c, e.req) : null;
  const lvl = e.minLevel ? evalReq(c, { kind: 'level', n: e.minLevel }) : null;
  const ok = cu && (!req || req.met) && (!lvl || lvl.met);
  return { id, event: e, unlocked: ok, circuitUnlocked: cu, req, played: c.playedEvents[id] || 0, wins: c.wonEvents[id] || 0, completed: (c.wonEvents[id] || 0) > 0, locked: !ok };
}
export const listEvents = (c, circuit) => EVENTS.filter((e) => !circuit || e.circuit === circuit).map((e) => eventStatus(c, e.id));
export function circuitInfo(c, id) {
  const ci = CIRCUIT_BY_ID[id]; const evs = listEvents(c, id);
  return { ...ci, unlocked: circuitUnlocked(c, id), unlockReq: ci.unlock ? evalReq(c, ci.unlock) : null, events: evs, played: circuitPlayed(c, id), points: c.pts[id]?.you || 0, rank: circuitRank(c, id), titlesWon: evs.filter((e) => e.completed && e.event.title).length };
}
export function nextCoach(c, trigger) { const seen = c.flags.coachSeen || []; return COACH_STEPS.find((s) => s.trigger === trigger && !seen.includes(s.id)) || null; }
export function markCoach(c, id) { (c.flags.coachSeen ||= []); if (!c.flags.coachSeen.includes(id)) c.flags.coachSeen.push(id); return c; }
export function markTutorialDone(c) { c.flags.tutorialDone = true; evaluateAchievements(c, 0); refreshUnlocks(c); return c; }
export function currentCircuit(c) { return CIRCUIT_IDS.filter((k) => c.unlocked.includes(k)).pop(); }
/** The map for the UI: four nodes with state. */
export function progressionMap(c) {
  const cur = currentCircuit(c);
  return CIRCUITS.map((ci) => ({ id: ci.id, order: ci.order, name: ci.name, unlocked: c.unlocked.includes(ci.id), current: ci.id === cur, completed: ci.id === 'world' ? c.champion > 0 : (c.wonEvents[ci.final] || 0) > 0, unlockReq: ci.unlock ? evalReq(c, ci.unlock) : null, finalEvent: ci.final }));
}
export function championshipQualification(c) {
  const r = evalReq(c, QUAL_WORLD);
  return { qualified: c.qualifiedWorld || r.met, via: (r.children || []).filter((x) => x.met).map((x) => x.id), conditions: r.children || [], label: r.label };
}
/** Suggested next event (never a locked one). */
export function recommendedEvent(c) {
  const cands = listEvents(c).filter((s) => s.unlocked);
  const world = cands.find((s) => s.id === 'world_main' && !s.completed);
  if (world) return world.id;
  const cur = currentCircuit(c);
  const here = cands.filter((s) => s.event.circuit === cur);
  const ci = CIRCUIT_BY_ID[cur];
  const final = here.find((s) => s.id === ci.final && !s.completed);
  if (final) return final.id;
  const unplayed = here.filter((s) => s.played === 0);
  if (unplayed.length) return unplayed[0].id;
  const notWon = here.filter((s) => !s.completed && !s.event.special);
  if (notWon.length) return notWon.sort((a, b) => a.played - b.played)[0].id;
  return (here[0] || cands[0]).id;
}
export function nextObjective(c) {
  const cur = currentCircuit(c);
  if (c.champion > 0) return { id: 'legends', text: L('Defenda o seu estatuto: vença a Taça das Lendas ou o duelo com a Lenda.', 'Defend your status: win the Legends Cup or duel the Legend.', 'Defiende tu estatus: gana la Copa de las Leyendas o el duelo con la Leyenda.') };
  if (cur === 'world') return { id: 'win_world', text: L('Vença o Campeonato Mundial.', 'Win the World Championship.', 'Gana el Campeonato Mundial.') };
  if (cur === 'intl') return { id: 'qualify_world', text: L('Qualifique-se para o Mundial: título internacional, satélite ou top 4 do ranking.', 'Qualify for the Worlds: an International title, the satellite or a top-4 ranking.', 'Clasifícate para el Mundial: título internacional, satélite o top 4 del ranking.') };
  if (cur === 'regional') return { id: 'qualify_intl', text: L('Acumule 220 pontos regionais ou vença o Masters Regional.', 'Earn 220 regional points or win the Regional Masters.', 'Acumula 220 puntos regionales o gana los Másters Regional.') };
  return { id: 'first_title', text: L('Vença o seu primeiro torneio local para abrir o Circuito Regional.', 'Win your first local tournament to open the Regional Tour.', 'Gana tu primer torneo local para abrir el Circuito Regional.') };
}

// ---------- starting / finishing events ----------
export function startEvent(c, eventId, opts = {}) {
  const { seed, player } = typeof opts === 'number' ? { seed: opts } : (opts || {});
  const st = eventStatus(c, eventId);
  if (!st.unlocked) throw new Error('event locked: ' + eventId);
  if (c.tournament) throw new Error('a tournament is already in progress');
  c.seq++;
  const sd = seed ?? mixSeed(c.seed, c.seq, c.stats.played);
  const t = createTournament(buildDef(eventId), { player: { id: 'hero', name: c.profile.name, avatar: c.cosmetics.selected.avatar, ...(player || {}) }, seed: sd });
  c.tournament = t; c.tournamentEvent = eventId;
  return t;
}
/** Record the finished (or player-eliminated) career tournament. Simulates the rest if needed. Returns the report. */
export function finishEvent(c, a, b) {
  const { now = 0 } = (a && typeof a === 'object' ? a : b && typeof b === 'object' ? b : {});
  const t = c.tournament;
  if (!t) throw new Error('no tournament');
  if (!human(t).out) throw new Error('player still in the tournament');
  if (t.phase !== 'finished') simulateToEnd(t);
  const result = tournamentResult(t);
  const report = recordResult(c, c.tournamentEvent, result, { now });
  c.tournament = null; c.tournamentEvent = null;
  return report;
}
/** Leaving a running tournament = forfeit: counts as eliminated in the current position (no free retries by quitting). */
export function forfeitEvent(c, o = {}) {
  const { now = 0 } = o || {};
  const t = c.tournament; if (!t) throw new Error('no tournament');
  const me = human(t);
  if (!me.out) {
    // abandon the live hand (its bets are discarded; entrant stacks are still the start-of-hand values) and drop the player
    me.out = true; me.place = t.remaining; t.remaining -= 1; t.totalChips -= me.stack; me.stack = 0;
    t.hand = null; t.handTable = -1; t.phase = 'between'; t.pending = null; t.forfeited = true;
    for (const tb of t.tables) { const s = tb.seats.indexOf(me.idx); if (s >= 0) tb.seats[s] = -1; }
    if (t.remaining <= 1) { const w = t.entrants.find((x) => !x.out); if (w) { w.place = 1; w.out = true; t.remaining = 1; t.phase = 'finished'; } }
  }
  return finishEvent(c, { now });
}

export function recordResult(c, eventId, result, { now = 0 } = {}) {
  const e = EVENT_BY_ID[eventId]; if (!e) throw new Error('unknown event');
  const circuit = e.circuit;
  const report = { eventId, result, xpGain: 0, levelUp: false, repGain: 0, points: result.points, titleWon: null, newCircuits: [], qualifiedNow: false, championNow: false, seasonEnded: null, newAchievements: [], newCosmetics: [], storyBeats: [], moments: [] };
  const prev = { level: c.level };
  const place = result.place, entrants = result.entrants;
  const pct = entrants > 1 ? (entrants - place) / (entrants - 1) : 1;
  const mult = e.mult;
  const first = c.stats.played === 0;
  // stats
  const s = c.stats; s.played++;
  c.playedEvents[eventId] = (c.playedEvents[eventId] || 0) + 1;
  const bc = c.byCircuit[circuit]; bc.played++;
  s.bestPlace = s.bestPlace == null ? place : Math.min(s.bestPlace, place); bc.best = bc.best == null ? place : Math.min(bc.best, place);
  const isDuel = e.format === 'duel';
  const won = place === 1;
  if (won) { if (isDuel) s.duelWins++; else { s.wins++; bc.wins++; c.season.wins++; } c.wonEvents[eventId] = (c.wonEvents[eventId] || 0) + 1; }
  if (result.cashed && !isDuel) { s.cashes++; bc.cashes++; }
  if (result.finalTable) { s.finalTables++; bc.finalTables++; report.moments.push('final_table'); }
  s.winnings += result.prize; s.ko += result.ko;
  const f = result.feats || {};
  s.hands += f.handsPlayed || 0; s.handsWon += f.handsWon || 0; s.biggestPot = Math.max(s.biggestPot, f.biggestPot || 0);
  s.bluffWins += f.bluffWins || 0; s.allInWins += f.allInWins || 0; if (f.comeback) s.comebacks++;
  if (first) report.moments.push('first_tournament');
  if (won && !isDuel && s.wins === 1) report.moments.push('first_win');
  if (result.finalTable && s.finalTables === 1) report.moments.push('first_final_table');
  // titles
  if (won && e.title && !c.titles.includes(eventId)) { c.titles.push(eventId); report.titleWon = { event: eventId, name: e.title }; report.moments.push('title'); }
  else if (won && e.title) report.titleWon = { event: eventId, name: e.title, repeat: true };
  // xp / rep
  const xpGain = Math.round(e.xp * (0.25 + 0.75 * Math.pow(pct, 1.5)) * (won ? 1.6 : 1)) + result.ko * 5;
  c.xp += xpGain; c.level = levelFromXp(c.xp); report.xpGain = xpGain; report.levelUp = c.level > prev.level ? { from: prev.level, to: c.level } : null; report.level = c.level;
  const repGain = Math.round(e.rep * (pct * pct * 0.6 + (result.cashed ? 0.15 : 0) + (won ? 0.5 : 0) + (result.finalTable ? 0.2 : 0)));
  c.rep += repGain; report.repGain = repGain;
  // points: you + rivals (real finishes for rivals in the field, simulated for others of this circuit)
  const pts = result.points;
  const bump = (tbl, id, v) => { tbl[id] = (tbl[id] || 0) + v; };
  c.season.events++;
  if (circuit !== 'quick') {
    bump(c.pts[circuit], 'you', pts); bump(c.pts.season, 'you', pts);
    const inField = new Map(result.rivals.map((r) => [r.id, r]));
    const rng = mulberry32(mixSeed(c.seed, c.stats.played, 991));
    for (const r of RIVALS) {
      if (!r.circuits.includes(circuit)) continue;
      let rp;
      if (inField.has(r.id)) rp = inField.get(r.id).place || entrants;
      else { const perf = Math.max(0.02, Math.min(0.98, 0.3 + (r.profile.skill - 5) / 11 + (rng() + rng() + rng() - 1.5) * 0.45)); rp = Math.max(1, Math.min(entrants, Math.round((1 - perf) * (entrants - 1)) + 1)); }
      const v = placePoints({ place: rp, entrants, tableSize: 9, paid: result.paid, ko: 0, mult });
      bump(c.pts[circuit], r.id, v); bump(c.pts.season, r.id, v);
    }
  }
  // rivals head to head
  for (const r of result.rivals) {
    const rs = (c.rivals[r.id] ||= { met: 0, beaten: 0, lostTo: 0, koByYou: 0, koOnYou: 0, lastPlace: null });
    rs.met++; if (r.playerBeat) rs.beaten++; if (r.beatPlayer) rs.lostTo++; if (r.knockedOutByPlayer) { rs.koByYou++; report.moments.push('eliminated_rival:' + r.id); } if (r.knockedOutPlayer) rs.koOnYou++;
    rs.lastPlace = r.place;
  }
  // results history
  c.results.unshift({ eventId, circuit, place, entrants, prize: result.prize, points: pts, xp: xpGain, ko: result.ko, at: now, season: c.season.n, won, cashed: result.cashed, finalTable: result.finalTable });
  if (c.results.length > MAX_RESULTS) c.results.length = MAX_RESULTS;
  // champion
  if (e.championship && won) { c.champion++; report.championNow = c.champion === 1; report.moments.push('champion'); }
  // unlock circuits (monotonic)
  for (const ci of CIRCUITS) {
    if (c.unlocked.includes(ci.id)) continue;
    if (ci.id === 'world') continue; // via qualification below
    if (!ci.unlock || evalReq(c, ci.unlock).met) { c.unlocked.push(ci.id); report.newCircuits.push(ci.id); report.moments.push('circuit_unlocked:' + ci.id); }
  }
  if (!c.qualifiedWorld && evalReq(c, QUAL_WORLD).met) { c.qualifiedWorld = true; report.qualifiedNow = true; report.moments.push('qualified_world'); }
  if (c.qualifiedWorld && !c.unlocked.includes('world')) { c.unlocked.push('world'); report.newCircuits.push('world'); report.moments.push('circuit_unlocked:world'); }
  // season rollover
  if (c.season.events >= SEASON_LENGTH) report.seasonEnded = endSeason(c);
  // flags
  if (e.tutorial && !c.flags.tutorialDone) c.flags.tutorialDone = true; // completing the tutorial event (any finish) counts
  // story, achievements, cosmetics
  for (const b of STORY_BEATS) if (!c.story.seen.includes(b.id) && b.when(c, { event: e, result, newCircuits: report.newCircuits, qualifiedNow: report.qualifiedNow, championNow: report.championNow })) { c.story.seen.push(b.id); report.storyBeats.push(b.id); }
  report.newAchievements = evaluateAchievements(c, now);
  report.newCosmetics = refreshUnlocks(c);
  // extra moments / aliases used by the UI
  for (const r of result.rivals) if (r.playerBeat && c.rivals[r.id]?.beaten === 1) report.moments.push('rival_beaten:' + r.id);
  if (e.championship && result.finalTable) report.moments.push('championship_final');
  Object.assign(report, { xp: xpGain, rep: repGain, prize: result.prize, place, entrants, unlockedCircuits: report.newCircuits, achievements: report.newAchievements, rewards: report.newCosmetics.map((x) => ({ type: x.slot, id: x.id })), rivalsDelta: result.rivals.map((r) => ({ id: r.id, beaten: r.playerBeat, lostTo: r.beatPlayer, knockedOutByYou: r.knockedOutByPlayer, knockedOutYou: r.knockedOutPlayer })) });
  return report;
}

function endSeason(c) {
  const tbl = c.pts.season; const you = tbl.you || 0;
  const rows = Object.entries(tbl).filter(([k]) => k !== 'you').map(([k, v]) => ({ id: k, pts: v })).sort((a, b) => b.pts - a.pts);
  const rank = 1 + rows.filter((r) => r.pts > you).length;
  const leader = rows[0] && rows[0].pts > you ? rows[0].id : 'you';
  const sum = { n: c.season.n, events: c.season.events, wins: c.season.wins, points: you, rank, leader, champion: leader === 'you' };
  c.seasonHistory.unshift(sum); if (c.seasonHistory.length > 30) c.seasonHistory.length = 30;
  c.pts.season = { you: 0 }; c.season = { n: c.season.n + 1, events: 0, wins: 0, best: null };
  return sum;
}

// ---------- standings ----------
/** scope: 'season' | circuit id. Rows: {id, name, pts, isYou, rank}. `you` has distances to neighbours. */
export function standings(c, scope = 'season') {
  const tbl = c.pts[scope] || { you: 0 };
  const ids = scope === 'season' ? RIVALS.map((r) => r.id) : RIVALS.filter((r) => r.circuits.includes(scope)).map((r) => r.id);
  const rows = [{ id: 'you', name: c.profile.name, pts: tbl.you || 0, isYou: true }, ...ids.map((id) => ({ id, name: RIVAL_BY_ID[id].name, pts: tbl[id] || 0, isYou: false }))];
  rows.sort((a, b) => b.pts - a.pts || (a.isYou ? 1 : b.isYou ? -1 : 0) || (a.id < b.id ? -1 : 1));
  rows.forEach((r, i) => { r.rank = i + 1; });
  const i = rows.findIndex((r) => r.isYou);
  const you = { rank: i + 1, pts: rows[i].pts, above: rows[i - 1] || null, below: rows[i + 1] || null, toNext: rows[i - 1] ? rows[i - 1].pts - rows[i].pts + 1 : 0 };
  return { scope, rows, you, season: scope === 'season' ? { n: c.season.n, events: c.season.events, length: SEASON_LENGTH } : null };
}
export function rivalRecord(c, id) { const r = RIVAL_BY_ID[id]; const s = c.rivals[id] || { met: 0, beaten: 0, lostTo: 0, koByYou: 0, koOnYou: 0, lastPlace: null }; return { ...r, record: s, met: s.met > 0 }; }
export const listRivals = (c) => RIVALS.map((r) => rivalRecord(c, r.id));

// ---------- profile ----------
export function availableTitles(c) { return [{ id: null, name: L('Novato', 'Rookie', 'Novato') }, ...c.titles.map((id) => ({ id, name: EVENT_BY_ID[id].title }))]; }
export function setProfile(c, { name, avatar, title } = {}) {
  if (typeof name === 'string' && name.trim()) c.profile.name = name.trim().slice(0, 18);
  if (avatar && c.cosmetics.unlocked.includes('avatar:' + avatar)) { c.profile.avatar = avatar; c.cosmetics.selected.avatar = avatar; }
  if (title !== undefined && (title === null || c.titles.includes(title))) c.cosmetics.selected.title = title;
  return c;
}
export function selectCosmetic(c, slot, id) {
  if (!c.cosmetics.unlocked.includes(slot + ':' + id)) return false;
  c.cosmetics.selected[slot] = id; if (slot === 'avatar') c.profile.avatar = id; return true;
}
export function profileSummary(c) {
  const s = c.stats;
  return { name: c.profile.name, avatar: c.profile.avatar, level: levelInfo(c), reputation: reputationInfo(c), circuit: currentCircuit(c), titles: availableTitles(c), selectedTitle: c.cosmetics.selected.title, tournaments: s.played, wins: s.wins, finalTables: s.finalTables, cashes: s.cashes, bestPlace: s.bestPlace, winnings: s.winnings, ko: s.ko, rivalsMet: Object.values(c.rivals).filter((r) => r.met > 0).length, champion: c.champion > 0, results: c.results };
}
export { listAchievements, listCosmetics, COSMETICS };
