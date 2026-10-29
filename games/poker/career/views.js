// Read-model helpers requested by the UI (pure functions of the career object). Text is {pt,en,es}.
import * as C from './career.js';
import { CIRCUITS, EVENT_BY_ID, COACH_STEPS } from './circuits.js';
import { RIVALS, RIVAL_BY_ID } from './rivals.js';
import { listAchievements } from './achievements.js';
import { COSMETICS, listCosmetics } from './rewards.js';
import { STORY_BEATS } from './story.js';
import { evalReq } from './req.js';
import { L } from './text.js';

const ICON = { cards: '🃏', book: '📖', coin: '🪙', table: '🍽️', trophy: '🏆', duel: '⚔️', map: '🗺️', globe: '🌍', crown: '👑', target: '🎯', chips: '💰', mask: '🎭', bolt: '⚡', star: '⭐' };
export const profileView = (c) => {
  const li = C.levelInfo(c), rp = C.reputationInfo(c), s = c.stats, sn = C.standings(c, 'season');
  return { name: c.profile.name, avatar: c.profile.avatar, frame: c.cosmetics.selected.frame, level: li.level, xp: c.xp, xpInLevel: c.xp - li.from, xpForNext: li.to - li.from, reputation: c.rep, repTitle: rp.tier.name, repProgress: rp.progress, titles: C.availableTitles(c), selectedTitle: c.cosmetics.selected.title, played: s.played, wins: s.wins, finalTables: s.finalTables, cashes: s.cashes, bestFinish: s.bestPlace, winnings: s.winnings, knockouts: s.ko, circuit: C.currentCircuit(c), rank: sn.you.rank, champion: c.champion > 0 };
};
export function eventView(c, id) {
  const st = C.eventStatus(c, id); const e = st.event;
  const mine = c.results.filter((r) => r.eventId === id);
  const best = mine.length ? mine.reduce((b, r) => (r.place < b.place ? r : b)) : null;
  const state = st.locked ? 'locked' : st.completed ? 'won' : mine.some((r) => r.cashed) ? 'cashed' : st.played ? 'played' : 'available';
  const missing = [];
  if (!st.circuitUnlocked) missing.push({ circuit: e.circuit, label: C.circuitInfo(c, e.circuit).unlockReq?.label });
  if (st.req && !st.req.met) missing.push({ label: st.req.label, cur: st.req.cur, target: st.req.target, children: st.req.children });
  return { id, event: e, unlocked: st.unlocked, state, lockReason: st.unlocked ? null : { req: e.req, missing }, plays: st.played, wins: st.wins, best: best ? { place: best.place, prize: best.prize, points: best.points } : null, recommended: C.recommendedEvent(c) === id };
}
export function circuitView(c, id) {
  const ci = C.circuitInfo(c, id); const def = CIRCUITS.find((x) => x.id === id);
  const finalSt = C.eventStatus(c, def.final);
  return { id, name: def.name, desc: def.desc, unlocked: ci.unlocked, req: ci.unlockReq, progress: { played: ci.played, wins: C.circuitInfo(c, id).events.reduce((s, e) => s + (e.event.format !== 'duel' ? e.wins : 0), 0), points: ci.points, titles: ci.titlesWon }, finalAvailable: finalSt.unlocked, events: ci.events.map((e) => eventView(c, e.id)), rank: ci.rank };
}
export const rankInfo = (c, scope = 'season') => { const s = C.standings(c, scope); return { rank: s.you.rank, of: s.rows.length, points: s.you.pts, toNext: s.you.toNext, above: s.you.above && { name: s.you.above.name, points: s.you.above.pts }, below: s.you.below && { name: s.you.below.name, points: s.you.below.pts } }; };
export const standingsView = (c, scope = 'season') => C.standings(c, scope).rows.map((r) => ({ id: r.id, name: r.name, avatar: r.isYou ? c.profile.avatar : RIVAL_BY_ID[r.id]?.avatar, points: r.pts, isPlayer: r.isYou, rank: r.rank }));
export function seasonView(c) {
  const mine = c.results.filter((r) => r.season === c.season.n);
  const goals = [
    { id: 'play', text: L(`Jogue ${C.SEASON_LENGTH} torneios`, `Play ${C.SEASON_LENGTH} tournaments`, `Juega ${C.SEASON_LENGTH} torneos`), progress: mine.length, target: C.SEASON_LENGTH },
    { id: 'cash', text: L('Fique nos prêmios 3 vezes', 'Cash 3 times', 'Entra en premios 3 veces'), progress: Math.min(3, mine.filter((r) => r.cashed).length), target: 3 },
    { id: 'win', text: L('Vença um torneio', 'Win a tournament', 'Gana un torneo'), progress: Math.min(1, c.season.wins), target: 1 },
  ].map((g) => ({ ...g, done: g.progress >= g.target }));
  return { n: c.season.n, eventsPlayed: c.season.events, eventsTotal: C.SEASON_LENGTH, goals, history: c.seasonHistory };
}
export const achievementsView = (c) => listAchievements(c).map((a) => ({ id: a.id, name: a.name, desc: a.desc, icon: ICON[a.icon] || '🏅', progress: a.cur, target: a.target, done: a.unlocked, at: a.at, rewards: COSMETICS.filter((x) => x.req && x.req.kind === 'achievement' && x.req.id === a.id).map((x) => ({ type: x.slot, id: x.id })) }));
export const rivalsView = (c) => RIVALS.map((r) => {
  const rec = c.rivals[r.id] || { met: 0, beaten: 0, lostTo: 0, koByYou: 0, koOnYou: 0 };
  return { ...r, id: r.id, met: rec.met, beaten: rec.beaten, lostTo: rec.lostTo, h2h: { wins: rec.beaten, losses: rec.lostTo }, koByYou: rec.koByYou, koOnYou: rec.koOnYou, unlocked: rec.met > 0, storyBeats: STORY_BEATS.filter((b) => b.rival === r.id && c.story.seen.includes(b.id)) };
});
const SLOT_OF = { tableTheme: 'theme', cardBack: 'back', deck: 'deck', avatar: 'avatar', frame: 'frame', title: 'title', theme: 'theme', back: 'back', winAnim: 'winAnim', table: 'table' };
const mapSlot = (c, slot) => listCosmetics(c, slot).map((i) => ({ id: i.id, name: i.name, unlocked: i.unlocked, selected: i.selected, req: i.reqInfo ? i.reqInfo.label : null, reqInfo: i.reqInfo }));
export const cosmeticsView = (c) => ({ tableThemes: mapSlot(c, 'theme'), cardBacks: mapSlot(c, 'back'), decks: mapSlot(c, 'deck'), avatars: mapSlot(c, 'avatar'), frames: mapSlot(c, 'frame'), winAnims: mapSlot(c, 'winAnim'), tables: mapSlot(c, 'table'), titles: C.availableTitles(c).map((t) => ({ id: t.id, name: t.name, unlocked: true, selected: c.cosmetics.selected.title === t.id })), selected: { ...c.cosmetics.selected } });
export function equip(c, type, id) { const slot = SLOT_OF[type]; if (!slot) return false; if (slot === 'title') { C.setProfile(c, { title: id }); return c.cosmetics.selected.title === id; } return C.selectCosmetic(c, slot, id); }
export const rankLabel = (c) => rankInfo(c, 'season');
void evalReq; void EVENT_BY_ID; void COACH_STEPS;
