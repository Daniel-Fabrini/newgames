// Local profile, records, ranking, achievements (pure over plain objects; the UI persists with ctx.store).
import { THEMES, MASTERY, themeOfCat, MODES } from './config.js';

export const RANK_SIZE = 10;

export const newProfile = () => ({
  v: 1,
  games: 0,
  completed: 0,
  answered: 0,
  correct: 0,
  bestPrize: 0,
  bestStreak: 0,
  ms: 0,
  wins: 0,
  rightIds: [],
  catRight: {},
  themeRight: {},
  rec: {}, // per mode: { best, bestCorrect, plays }
  ranks: {}, // per mode: top runs
  ach: {}, // id -> timestamp
});

export const sanitizeProfile = (raw) => {
  const p = { ...newProfile(), ...(raw && typeof raw === 'object' ? raw : {}) };
  for (const k of ['rec', 'ranks', 'ach', 'catRight', 'themeRight']) if (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) p[k] = {};
  if (!Array.isArray(p.rightIds)) p.rightIds = [];
  return p;
};

export const ACHIEVEMENTS = [
  { id: 'first', icon: '⚽', test: (p) => p.correct >= 1 },
  { id: 'row10', icon: '🔥', test: (p, s) => s.bestStreak >= 10 || p.bestStreak >= 10 },
  { id: 'step10', icon: '🪜', test: (p, s) => MODES[s.mode]?.ladder && s.reached >= 10 },
  { id: 'million', icon: '🏆', test: (p, s) => s.mode === 'main' && s.outcome === 'won' },
  { id: 'safe', icon: '🔒', test: (p, s) => MODES[s.mode]?.ladder && s.correct >= 5 },
  { id: 'know100', icon: '🧠', test: (p) => p.correct >= 100 },
  { id: 'memory', icon: '📚', test: (p) => p.rightIds.length >= MASTERY.memory },
  { id: 'lib', icon: '🌎', test: (p) => (p.catRight.lib || 0) >= MASTERY.lib },
  { id: 'morumbi', icon: '🏟️', test: (p) => (p.catRight.morumbi || 0) >= MASTERY.morumbi },
  { id: 'perfect10', icon: '💯', test: (p, s) => ['quick', 'themes', 'daily'].includes(s.mode) && s.correct >= 10 },
  { id: 'daily3', icon: '📅', test: (p, s, x) => (x.dailyStreak || 0) >= 3 },
  { id: 'clock15', icon: '⏱️', test: (p, s) => s.mode === 'time' && s.correct >= 15 },
  { id: 'expert8', icon: '🎓', test: (p, s) => s.mode === 'expert' && s.correct >= 8 },
  { id: 'noHelp', icon: '🙌', test: (p, s) => s.mode === 'main' && s.correct >= 10 && s.lifelinesUsed === 0 },
  { id: 'themes8', icon: '⭐', test: (p) => completedThemes(p) >= THEMES.length },
];
export const themeDone = (p, themeId) => (p.themeRight[themeId] || 0) >= MASTERY.theme;
export const completedThemes = (p) => THEMES.filter((t) => themeDone(p, t.id)).length;

/** XP scaled by result (ladder modes by progress, others by correct answers) */
export function xpFor(s) {
  const base = MODES[s.mode]?.ladder ? 6 + s.correct * 2 : 5 + s.correct;
  const bonus = s.outcome === 'won' ? 40 : s.mode === 'daily' ? 6 : 0;
  return Math.max(3, Math.min(90, base + bonus));
}

/**
 * Records a finished match. Mutates & returns { profile, newRecords:[], newAch:[] }.
 * s = summary(session) ; x = { now, dailyStreak }
 */
export function recordMatch(p, s, x = {}) {
  const now = x.now || Date.now();
  const before = { ach: { ...p.ach } };
  p.games++;
  if (s.outcome && !['quit', 'empty'].includes(s.outcome)) p.completed++;
  p.answered += s.answered;
  p.correct += s.correct;
  p.ms += s.ms;
  p.bestStreak = Math.max(p.bestStreak, s.bestStreak);
  if (MODES[s.mode]?.ladder) p.bestPrize = Math.max(p.bestPrize, s.prize);
  if (s.mode === 'main' && s.outcome === 'won') p.wins++;
  const seen = new Set(p.rightIds);
  for (const r of s.review || []) {
    if (r.res !== 'right' || !r.view || seen.has(r.id)) continue;
    seen.add(r.id);
    p.rightIds.push(r.id);
    p.catRight[r.view.cat] = (p.catRight[r.view.cat] || 0) + 1;
    const th = themeOfCat(r.view.cat);
    if (th) p.themeRight[th] = (p.themeRight[th] || 0) + 1;
  }
  const newRecords = [];
  const rec = (p.rec[s.mode] = p.rec[s.mode] || { best: 0, bestCorrect: 0, plays: 0 });
  rec.plays++;
  if (s.score > rec.best) {
    if (rec.best > 0 || s.score > 0) newRecords.push({ kind: 'score', mode: s.mode, value: s.score });
    rec.best = s.score;
  }
  if (s.correct > rec.bestCorrect) rec.bestCorrect = s.correct;
  // local ranking
  const list = (p.ranks[s.mode] = p.ranks[s.mode] || []);
  if (s.score > 0 || s.correct > 0) {
    list.push({ score: s.score, correct: s.correct, answered: s.answered, ms: s.ms, at: now, won: s.outcome === 'won' });
    list.sort((a, b) => b.score - a.score || b.correct - a.correct || a.ms - b.ms);
    list.length = Math.min(list.length, RANK_SIZE);
  }
  const newAch = [];
  for (const a of ACHIEVEMENTS) {
    if (p.ach[a.id]) continue;
    let ok = false;
    try {
      ok = !!a.test(p, s, x);
    } catch {
      ok = false;
    }
    if (ok) {
      p.ach[a.id] = now;
      newAch.push(a.id);
    }
  }
  void before;
  return { profile: p, newRecords, newAch };
}

export const hitRate = (p) => (p.answered ? Math.round((100 * p.correct) / p.answered) : 0);
export const avgSeconds = (p) => (p.answered ? p.ms / p.answered / 1000 : 0);

// ---------- daily ----------
export const newDaily = () => ({ last: null, streak: 0, best: 0, hist: {} });
const prevDay = (key) => {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dailyPlayed = (dl, key) => !!dl.hist[key];
export function recordDaily(dl, key, res) {
  if (dl.hist[key]) return dl; // one scored attempt per day
  dl.hist[key] = { score: res.score, correct: res.correct, total: res.total };
  dl.streak = dl.last === prevDay(key) ? dl.streak + 1 : 1;
  dl.last = key;
  dl.best = Math.max(dl.best, res.score);
  const keys = Object.keys(dl.hist).sort();
  while (keys.length > 60) delete dl.hist[keys.shift()];
  return dl;
}
/** streak still alive today? (played today or yesterday) */
export const liveStreak = (dl, key) => (dl.last === key || dl.last === prevDay(key) ? dl.streak : 0);

// ---------- recent ring buffer ----------
export function pushRecent(list, ids, limit) {
  const out = (list || []).filter((id) => !ids.includes(id)).concat(ids);
  return limit <= 0 ? [] : out.slice(-limit);
}
