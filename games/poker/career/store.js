// Persistence: versioned, validated, corruption-safe. `store` = ctx.store ({get,set,remove}). Everything JSON.
import { newCareer, CAREER_VERSION } from './career.js';
import { EVENT_BY_ID, CIRCUITS } from './circuits.js';
import { DEFAULT_SELECTED, refreshUnlocks } from './rewards.js';
import { RIVALS } from './rivals.js';

export const KEYS = { career: 'poker.career', backup: 'poker.career.bak', quick: 'poker.quick', prefs: 'poker.prefs' };
const num = (x, d = 0, lo = -Infinity, hi = Infinity) => (typeof x === 'number' && isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

/** Structural validity of a saved tournament (resumable state). */
export function validTournament(t) {
  try {
    if (!isObj(t) || t.v !== 1 || !isObj(t.def) || !Array.isArray(t.entrants) || !Array.isArray(t.tables) || !EVENT_BY_ID[t.defId]) return false;
    if (t.entrants.length !== t.def.entrants || !t.entrants[0] || !t.entrants[0].isPlayer) return false;
    if (!['between', 'hand', 'finished'].includes(t.phase)) return false;
    const alive = t.entrants.filter((e) => !e.out);
    if (t.phase !== 'finished' && alive.length !== t.remaining) return false;
    // each alive entrant seated exactly once, at a real seat
    const seen = new Set();
    for (const tb of t.tables) for (const ei of tb.seats) if (ei >= 0) { if (seen.has(ei) || !t.entrants[ei] || t.entrants[ei].out) return false; seen.add(ei); }
    if (t.phase !== 'finished' && seen.size !== alive.length) return false;
    if (t.phase === 'hand') {
      const h = t.hand; if (!isObj(h) || !Array.isArray(h.players) || !Array.isArray(h.deck) || h.phase !== 'betting' || !Number.isInteger(h.toAct) || h.toAct < 0 || h.toAct >= h.players.length) return false;
      if (h.players.some((p) => !Number.isFinite(p.stack) || p.stack < 0)) return false;
    }
    for (const e of t.entrants) if (!Number.isFinite(e.stack) || e.stack < 0) return false;
    return true;
  } catch (e) { return false; }
}

/** Returns a sanitized career or null. Unknown/invalid parts are repaired from defaults rather than trusted. */
export function validateCareer(raw) {
  try {
    if (!isObj(raw) || raw.v !== CAREER_VERSION) return null;
    const base = newCareer({ name: raw.profile?.name, avatar: raw.profile?.avatar, seed: num(raw.seed, 1), now: num(raw.createdAt, 0) });
    const c = base;
    c.seq = num(raw.seq, 0, 0);
    c.xp = num(raw.xp, 0, 0); c.level = Math.max(1, Math.min(60, Math.floor(num(raw.level, 1, 1))));
    c.rep = num(raw.rep, 0, 0);
    c.unlocked = (Array.isArray(raw.unlocked) ? raw.unlocked : []).filter((k) => CIRCUITS.some((x) => x.id === k));
    if (!c.unlocked.includes('local')) c.unlocked.unshift('local');
    c.qualifiedWorld = !!raw.qualifiedWorld; c.champion = Math.max(0, Math.floor(num(raw.champion, 0)));
    c.titles = (Array.isArray(raw.titles) ? raw.titles : []).filter((id) => EVENT_BY_ID[id]?.title);
    const counts = (src) => { const o = {}; if (isObj(src)) for (const [k, v] of Object.entries(src)) if (EVENT_BY_ID[k] && num(v, 0) > 0) o[k] = Math.floor(v); return o; };
    c.wonEvents = counts(raw.wonEvents); c.playedEvents = counts(raw.playedEvents);
    for (const k of Object.keys(c.stats)) if (k === 'bestPlace') c.stats[k] = raw.stats?.[k] == null ? null : num(raw.stats[k], null, 1); else c.stats[k] = num(raw.stats?.[k], 0, 0);
    for (const k of Object.keys(c.byCircuit)) { const r = raw.byCircuit?.[k]; if (isObj(r)) for (const f of Object.keys(c.byCircuit[k])) c.byCircuit[k][f] = f === 'best' ? (r[f] == null ? null : num(r[f], null, 1)) : num(r[f], 0, 0); }
    for (const k of Object.keys(c.pts)) { const r = raw.pts?.[k]; c.pts[k] = { you: num(r?.you, 0, 0) }; if (isObj(r)) for (const rv of RIVALS) if (r[rv.id] != null) c.pts[k][rv.id] = num(r[rv.id], 0, 0); }
    c.season = { n: Math.max(1, Math.floor(num(raw.season?.n, 1))), events: Math.max(0, Math.floor(num(raw.season?.events, 0))), wins: Math.max(0, Math.floor(num(raw.season?.wins, 0))), best: null };
    c.seasonHistory = (Array.isArray(raw.seasonHistory) ? raw.seasonHistory : []).filter(isObj).slice(0, 30);
    if (isObj(raw.rivals)) for (const rv of RIVALS) if (isObj(raw.rivals[rv.id])) { const r = raw.rivals[rv.id]; c.rivals[rv.id] = { met: num(r.met, 0, 0), beaten: num(r.beaten, 0, 0), lostTo: num(r.lostTo, 0, 0), koByYou: num(r.koByYou, 0, 0), koOnYou: num(r.koOnYou, 0, 0), lastPlace: r.lastPlace == null ? null : num(r.lastPlace, null, 1) }; }
    c.results = (Array.isArray(raw.results) ? raw.results : []).filter((r) => isObj(r) && EVENT_BY_ID[r.eventId]).slice(0, 100);
    c.achievements = {}; if (isObj(raw.achievements)) for (const [k, v] of Object.entries(raw.achievements)) c.achievements[k] = { at: num(v?.at, 0) };
    c.cosmetics = { unlocked: [], selected: { ...DEFAULT_SELECTED, ...(isObj(raw.cosmetics?.selected) ? raw.cosmetics.selected : {}) } };
    c.story = { seen: (Array.isArray(raw.story?.seen) ? raw.story.seen : []).filter((s) => typeof s === 'string') };
    c.flags = { tutorialDone: !!raw.flags?.tutorialDone, coachSeen: (Array.isArray(raw.flags?.coachSeen) ? raw.flags.coachSeen : []).filter((x) => typeof x === 'string').slice(0, 50) };
    c.profile = { name: String(raw.profile?.name || 'Player').slice(0, 18), avatar: String(raw.profile?.avatar || 'p1') };
    refreshUnlocks(c);
    // never lose a selection the player does not own
    for (const [slot, id] of Object.entries(c.cosmetics.selected)) if (id != null && slot !== 'title' && !c.cosmetics.unlocked.includes(slot + ':' + id)) c.cosmetics.selected[slot] = DEFAULT_SELECTED[slot];
    if (c.cosmetics.selected.title && !c.titles.includes(c.cosmetics.selected.title)) c.cosmetics.selected.title = null;
    if (raw.tournament && validTournament(raw.tournament) && raw.tournamentEvent === raw.tournament.defId) { c.tournament = raw.tournament; c.tournamentEvent = raw.tournamentEvent; }
    return c;
  } catch (e) { return null; }
}

export function saveCareer(store, c) {
  try {
    const prev = store.get(KEYS.career, null);
    if (prev && validateCareer(prev)) store.set(KEYS.backup, prev); // keep last good copy
    store.set(KEYS.career, c);
    return true;
  } catch (e) { return false; }
}
/** -> career | null (no save). Falls back to the backup copy when the main save is corrupt. */
export function loadCareer(store) {
  let raw = null;
  try { raw = store.get(KEYS.career, null); } catch (e) { raw = null; }
  if (raw == null) return null;
  let c = validateCareer(raw);
  if (!c) { try { c = validateCareer(store.get(KEYS.backup, null)); } catch (e) { c = null; } if (c) c.tournament = null; }
  return c;
}
export const hasCareer = (store) => { try { return store.get(KEYS.career, null) != null; } catch (e) { return false; } };
/** Reset (UI must confirm first). Removes career and backup. */
export function resetCareer(store) { try { store.remove(KEYS.career); store.remove(KEYS.backup); } catch (e) { /* ignore */ } }

// quick modes stats
const QDEF = () => ({ sitgo: { played: 0, wins: 0, cashes: 0, best: null }, cash: { sessions: 0, hands: 0, biggestPot: 0, bestStack: 0 }, tutorialDone: false });
export function loadQuick(store) { try { const r = store.get(KEYS.quick, null); const d = QDEF(); if (isObj(r)) { Object.assign(d.sitgo, isObj(r.sitgo) ? r.sitgo : {}); Object.assign(d.cash, isObj(r.cash) ? r.cash : {}); d.tutorialDone = !!r.tutorialDone; } return d; } catch (e) { return QDEF(); } }
export function saveQuick(store, q) { try { store.set(KEYS.quick, q); return true; } catch (e) { return false; } }
export function recordQuickSitGo(q, result) { q.sitgo.played++; if (result.place === 1) q.sitgo.wins++; if (result.cashed) q.sitgo.cashes++; q.sitgo.best = q.sitgo.best == null ? result.place : Math.min(q.sitgo.best, result.place); return q; }
