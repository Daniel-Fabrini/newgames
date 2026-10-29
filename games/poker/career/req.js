// Requirement evaluation against a career object. Returns {met, cur, target, label, children?}
import { EVENT_BY_ID, CIRCUIT_BY_ID, describeReq } from './circuits.js';
import { RIVALS } from './rivals.js';

export const circuitPlayed = (c, circuit) => Object.entries(c.playedEvents).reduce((s, [id, n]) => s + (circuit && EVENT_BY_ID[id]?.circuit !== circuit ? 0 : n), 0);
/** wins excluding duel events (a "win" = a tournament win) */
export const circuitWins = (c, circuit) => Object.entries(c.wonEvents).reduce((s, [id, n]) => { const e = EVENT_BY_ID[id]; return s + (e && e.circuit === circuit && e.format !== 'duel' ? n : 0); }, 0);
/** distinct title events won in a circuit (title events only; satellites/duels excluded) */
export const circuitTitles = (c, circuit) => Object.keys(c.wonEvents).filter((id) => { const e = EVENT_BY_ID[id]; return e && e.circuit === circuit && e.title && !e.satellite && e.format !== 'duel' && c.wonEvents[id] > 0; }).length;
/** roster rows for a circuit's standings (player + assigned rivals), sorted by points */
export function circuitRank(c, circuit) {
  const tbl = c.pts[circuit] || {};
  const you = tbl.you || 0;
  const rivals = RIVALS.filter((r) => r.circuits.includes(circuit));
  const above = rivals.filter((r) => (tbl[r.id] || 0) > you).length;
  return { rank: above + 1, size: rivals.length + 1, you };
}
export function evalReq(c, req) {
  if (!req) return { met: true, cur: 1, target: 1, label: null };
  const label = describeReq(req);
  const mk = (cur, target) => ({ met: cur >= target, cur: Math.min(cur, target), target, label, kind: req.kind, id: req.id });
  switch (req.kind) {
    case 'played': return mk(circuitPlayed(c, req.circuit), req.n);
    case 'points': return mk(c.pts[req.circuit]?.you || 0, req.n);
    case 'title': return mk(c.wonEvents[req.event] > 0 ? 1 : 0, 1);
    case 'titles': return mk(circuitTitles(c, req.circuit), req.n);
    case 'wins': return mk(circuitWins(c, req.circuit), req.n);
    case 'level': return mk(c.level, req.n);
    case 'rank': {
      const pl = circuitPlayed(c, req.circuit); const r = circuitRank(c, req.circuit);
      const ok = pl >= req.minEvents && r.rank <= req.top;
      return { met: ok, cur: ok ? 1 : 0, target: 1, label, kind: 'rank', id: req.id, detail: { played: pl, minEvents: req.minEvents, rank: r.rank, top: req.top } };
    }
    case 'qualified': return mk(c.qualifiedWorld ? 1 : 0, 1);
    case 'champion': return mk(c.champion > 0 ? 1 : 0, 1);
    case 'achievement': return mk(c.achievements[req.id] ? 1 : 0, 1);
    case 'unlocked': return mk(c.unlocked.includes(req.circuit) ? 1 : 0, 1);
    case 'any': { const ch = req.of.map((r) => evalReq(c, r)); return { met: ch.some((x) => x.met), cur: ch.some((x) => x.met) ? 1 : 0, target: 1, label, kind: 'any', children: ch }; }
    case 'all': { const ch = req.of.map((r) => evalReq(c, r)); return { met: ch.every((x) => x.met), cur: ch.filter((x) => x.met).length, target: ch.length, label, kind: 'all', children: ch }; }
    default: return { met: false, cur: 0, target: 1, label, kind: req.kind };
  }
}
export const circuitUnlockReq = (id) => CIRCUIT_BY_ID[id]?.unlock;
