// Pinball Pro — persistent records, unlock rules and XP (pure functions, no DOM).
import { UNLOCK, TABLE_IDS } from './tables.js';

export const defaults = () => ({
  best: { neon: 0, space: 0 },
  bestMissions: { neon: 0, space: 0 },
  games: 0,
  missions: 0,
  totalScore: 0,
  unlocked: { neon: true, space: false },
  settings: { balls: 3, shake: false },
  last: 'neon',
});

const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);

export function normalize(raw) {
  const d = defaults();
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = { ...d };
  out.best = { ...d.best };
  out.bestMissions = { ...d.bestMissions };
  for (const id of TABLE_IDS) {
    out.best[id] = num(r.best && r.best[id]);
    out.bestMissions[id] = num(r.bestMissions && r.bestMissions[id]);
  }
  out.games = num(r.games);
  out.missions = num(r.missions);
  out.totalScore = num(r.totalScore);
  out.unlocked = { neon: true, space: !!(r.unlocked && r.unlocked.space) };
  out.settings = { balls: r.settings && r.settings.balls === 5 ? 5 : 3, shake: !!(r.settings && r.settings.shake) };
  out.last = TABLE_IDS.includes(r.last) ? r.last : 'neon';
  if (meetsUnlock(out, 'space')) out.unlocked.space = true;
  return out;
}

export function meetsUnlock(rec, id) {
  const u = UNLOCK[id];
  if (!u) return true;
  return rec.best.neon >= u.score || rec.missions >= u.missions;
}
export function isUnlocked(rec, id) {
  return id === 'neon' || !!rec.unlocked[id] || meetsUnlock(rec, id);
}
export function unlockProgress(rec, id) {
  const u = UNLOCK[id];
  if (!u) return null;
  return { score: Math.min(rec.best.neon, u.score), scoreGoal: u.score, missions: Math.min(rec.missions, u.missions), missionsGoal: u.missions };
}

// result: Game.result(); returns { rec, newRecord, unlockedNow }
export function applyResult(rec0, result) {
  const rec = normalize(JSON.parse(JSON.stringify(rec0)));
  const key = result.missionsMode ? 'bestMissions' : 'best';
  const prev = rec[key][result.table] || 0;
  const newRecord = result.score > prev && result.score > 0;
  if (newRecord) rec[key][result.table] = result.score;
  // the plain best also tracks the highest of both modes for "best per table"
  if (result.missionsMode && result.score > rec.best[result.table]) rec.best[result.table] = result.score;
  rec.games += 1;
  rec.missions += result.stats.missions || 0;
  rec.totalScore += result.score;
  const before = { ...rec.unlocked };
  for (const id of TABLE_IDS) if (meetsUnlock(rec, id)) rec.unlocked[id] = true;
  const unlockedNow = TABLE_IDS.filter((id) => rec.unlocked[id] && !before[id]);
  return { rec, newRecord, unlockedNow };
}

export const xpFor = (score) => Math.max(5, Math.min(80, 5 + Math.floor(score / 4000)));
