// Persistent learner state: profile (hearts, gems, streak, quests, league, achievements…)
// and one record per course (path progress, XP, spaced-repetition word strengths).

import { rng } from '../../js/core/ui.js';
import { LANGS6 } from './corpus.js';

export const MAX_HEARTS = 5;
export const HEART_MS = 30 * 60 * 1000;
export const REFILL_COST = 100;
export const FREEZE_COST = 150;
export const MAX_FREEZES = 2;
export const GOALS = [10, 20, 30, 50];
export const OFF_MS = 15 * 60 * 1000;
const DAY = 86400000;

// ---------- dates (local time) ----------
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseDay(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(k, n) {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / DAY);
}
export function weekStartKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dayKey(x);
}
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ---------- levels: grow forever ----------
export function levelInfo(xp) {
  let level = 1;
  let need = 60;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= need) {
    rest -= need;
    level++;
    need = 60 + (level - 1) * 30;
  }
  return { level, into: rest, need };
}

// ---------- quests ----------
export const QUESTS = {
  xp: { icon: '⚡', target: (goal) => Math.max(20, Math.ceil((goal * 1.5) / 5) * 5) },
  lessons: { icon: '📘', target: () => 2 },
  perfect: { icon: '💯', target: () => 1 },
  combo: { icon: '🎯', target: () => 8 },
  listen: { icon: '🎧', target: () => 6, needs: 'listen' },
  speak: { icon: '🎙️', target: () => 4, needs: 'speak' },
  story: { icon: '📖', target: () => 1 },
  minutes: { icon: '⏱️', target: () => 5 },
  words: { icon: '🧠', target: () => 20 },
};

// ---------- achievements ----------
export const ACHIEVEMENTS = [
  { id: 'streak', icon: '🔥', tiers: [3, 7, 14, 30, 100], value: (s) => s.P.streak.best },
  { id: 'xp', icon: '⚡', tiers: [100, 500, 1000, 2500, 5000, 10000], value: (s) => s.P.xp },
  { id: 'words', icon: '🧠', tiers: [10, 50, 100, 250, 500], value: (s) => s.totalWords() },
  { id: 'lessons', icon: '📘', tiers: [1, 10, 25, 50, 100, 250], value: (s) => s.P.stats.lessons },
  { id: 'perfect', icon: '💯', tiers: [1, 5, 15, 30, 60], value: (s) => s.P.stats.perfect },
  { id: 'stories', icon: '📖', tiers: [1, 5, 10, 25], value: (s) => s.P.stats.stories },
  { id: 'combo', icon: '🎯', tiers: [5, 10, 20, 30], value: (s) => s.P.stats.combo },
  { id: 'polyglot', icon: '🌍', tiers: [2, 3, 4, 5], value: (s) => s.coursesStarted().length },
  { id: 'league', icon: '🏆', tiers: [1, 3, 10], value: (s) => s.P.stats.top3 },
  { id: 'legend', icon: '👑', tiers: [1, 2, 3, 4], value: (s) => s.P.stats.legendary },
  { id: 'speak', icon: '🎙️', tiers: [10, 50, 150], value: (s) => s.P.stats.speak },
  { id: 'listen', icon: '🎧', tiers: [10, 50, 200], value: (s) => s.P.stats.listen },
];

// ---------- league ----------
export const LEAGUE_TIERS = 8;
const BOTS = [
  ['Lucía', '👩🏻'], ['Mateo', '🧑🏽'], ['Sofia', '👩🏼'], ['Kenji', '🧑🏻'], ['Amara', '👩🏿'], ['Lukas', '👱🏼‍♂️'], ['Chloé', '👩🏻‍🦰'],
  ['Rafael', '🧔🏽'], ['Giulia', '👩🏽'], ['Noah', '🧒🏼'], ['Aisha', '🧕🏽'], ['Pedro', '👨🏻'], ['Emma', '👧🏼'], ['Yuki', '👩🏻'],
  ['Omar', '👨🏾'], ['Clara', '👩🏼‍🦱'], ['Thiago', '👨🏽‍🦱'], ['Nina', '👩🏾‍🦱'], ['Hugo', '🧑🏼'], ['Valentina', '👩🏽‍🦰'],
  ['Ivan', '🧔🏻'], ['Mei', '👩🏻'], ['Diego', '🧑🏾'], ['Ingrid', '👱🏻‍♀️'], ['Arjun', '👨🏽'], ['Léa', '👩🏼'], ['Marco', '🧔🏼'],
  ['Camila', '👩🏽‍🦱'], ['Felix', '👦🏼'], ['Zoe', '👩🏾'], ['Bruno', '👨🏼'], ['Hana', '👩🏻‍🦱'],
];

function defaults() {
  return {
    v: 1,
    course: null,
    goal: 20,
    hearts: MAX_HEARTS,
    heartsAt: Date.now(),
    gems: 200,
    xp: 0,
    streak: { n: 0, best: 0, last: null, freezes: 0, frozen: [], notice: null },
    days: {},
    settings: { autoplay: true, listen: true, speak: true },
    listenOff: 0,
    speakOff: 0,
    micDenied: false,
    quests: null,
    stats: { lessons: 0, perfect: 0, stories: 0, combo: 0, exercises: 0, correct: 0, legendary: 0, speak: 0, listen: 0, top3: 0, ms: 0 },
    ach: {},
    league: null,
    courses: {},
  };
}
function courseDefaults() {
  return { done: {}, legend: {}, xp: 0, words: 0, lessons: 0, srs: {}, mistakes: [], learned: {} };
}

export function createState(store) {
  const now = () => Date.now();
  const d = defaults();
  const saved = store.get('profile', null);
  const P = saved && typeof saved === 'object' ? { ...d, ...saved } : d;
  P.streak = { ...d.streak, ...(P.streak || {}) };
  P.stats = { ...d.stats, ...(P.stats || {}) };
  P.settings = { ...d.settings, ...(P.settings || {}) };
  const courses = new Map();
  const save = () => store.set('profile', P);

  function course(T) {
    if (!courses.has(T)) {
      const c = store.get('course:' + T, null);
      courses.set(T, { ...courseDefaults(), ...(c && typeof c === 'object' ? c : {}) });
    }
    return courses.get(T);
  }
  const saveCourse = (T) => store.set('course:' + T, course(T));

  // ---------- hearts ----------
  function regen() {
    if (P.hearts >= MAX_HEARTS) {
      P.heartsAt = now();
      return;
    }
    const n = Math.floor((now() - P.heartsAt) / HEART_MS);
    if (n > 0) {
      P.hearts = Math.min(MAX_HEARTS, P.hearts + n);
      P.heartsAt += n * HEART_MS;
      if (P.hearts >= MAX_HEARTS) P.heartsAt = now();
      save();
    }
  }
  const S = {
    P,
    save,
    course,
    saveCourse,
    hearts() {
      regen();
      return P.hearts;
    },
    nextHeartMs() {
      regen();
      return P.hearts >= MAX_HEARTS ? 0 : Math.max(0, HEART_MS - (now() - P.heartsAt));
    },
    loseHeart() {
      regen();
      if (P.hearts >= MAX_HEARTS) P.heartsAt = now();
      P.hearts = Math.max(0, P.hearts - 1);
      save();
      return P.hearts;
    },
    addHearts(n) {
      regen();
      P.hearts = Math.min(MAX_HEARTS, P.hearts + n);
      if (P.hearts >= MAX_HEARTS) P.heartsAt = now();
      save();
    },
    refill() {
      if (P.gems < REFILL_COST || S.hearts() >= MAX_HEARTS) return false;
      P.gems -= REFILL_COST;
      P.hearts = MAX_HEARTS;
      P.heartsAt = now();
      save();
      return true;
    },
    buyFreeze() {
      if (P.gems < FREEZE_COST || P.streak.freezes >= MAX_FREEZES) return false;
      P.gems -= FREEZE_COST;
      P.streak.freezes++;
      save();
      return true;
    },
    addGems(n) {
      P.gems += n;
      save();
    },

    // ---------- streak ----------
    // Called on mount: applies streak freezes for missed days or resets the streak.
    checkStreak() {
      const s = P.streak;
      if (!s.last) return null;
      const today = dayKey();
      const gap = daysBetween(s.last, today);
      if (gap <= 1) return null;
      const missed = gap - 1;
      if (s.n > 0 && s.freezes >= missed) {
        s.freezes -= missed;
        for (let i = 1; i <= missed; i++) s.frozen.push(addDays(s.last, i));
        s.frozen = s.frozen.slice(-30);
        s.last = addDays(today, -1);
        s.notice = { type: 'frozen', n: missed };
      } else {
        if (s.n > 0) s.notice = { type: 'lost', n: s.n };
        s.n = 0;
      }
      save();
      return s.notice;
    },
    takeStreakNotice() {
      const n = P.streak.notice;
      if (n) {
        P.streak.notice = null;
        save();
      }
      return n;
    },
    streak() {
      const s = P.streak;
      if (!s.last) return 0;
      return daysBetween(s.last, dayKey()) <= 1 ? s.n : 0;
    },
    practicedToday: () => P.streak.last === dayKey(),
    // Marks today as practiced. Returns { extended, from, to }.
    recordDay() {
      const s = P.streak;
      const today = dayKey();
      if (s.last === today) return { extended: false, from: s.n, to: s.n };
      const from = S.streak();
      s.n = s.last && daysBetween(s.last, today) === 1 ? s.n + 1 : 1;
      s.last = today;
      s.best = Math.max(s.best, s.n);
      save();
      return { extended: true, from, to: s.n };
    },
    dayDone: (k) => (P.days[k] || 0) > 0,
    dayFrozen: (k) => P.streak.frozen.includes(k),

    // ---------- XP ----------
    todayXP: () => P.days[dayKey()] || 0,
    addXP(n, T) {
      const k = dayKey();
      P.xp += n;
      P.days[k] = (P.days[k] || 0) + n;
      const cutoff = addDays(k, -120);
      for (const key of Object.keys(P.days)) if (key < cutoff) delete P.days[key];
      if (T) {
        course(T).xp += n;
        saveCourse(T);
      }
      save();
    },
    weekXP(startKey = weekStartKey()) {
      let s = 0;
      for (let i = 0; i < 7; i++) s += P.days[addDays(startKey, i)] || 0;
      return s;
    },
    level: () => levelInfo(P.xp),

    // ---------- quests ----------
    quests(caps) {
      const today = dayKey();
      if (!P.quests || P.quests.day !== today) {
        const r = rng(hash(today + ':q'));
        const pool = Object.keys(QUESTS).filter((id) => id !== 'xp' && (!QUESTS[id].needs || caps[QUESTS[id].needs]));
        const picked = ['xp'];
        while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
        P.quests = {
          day: today,
          list: picked.map((id) => ({ id, target: QUESTS[id].target(P.goal), p: 0, claimed: false, gems: 10 + Math.floor(r() * 5) * 5 })),
        };
        save();
      }
      return P.quests.list;
    },
    // Progress quests of `type` by `amount` (combo: max value). Returns newly completed quests.
    questEvent(type, amount, caps) {
      const list = S.quests(caps);
      const done = [];
      for (const q of list) {
        if (q.id !== type || q.p >= q.target) continue;
        q.p = type === 'combo' ? Math.max(q.p, Math.min(q.target, amount)) : Math.min(q.target, q.p + amount);
        if (q.p >= q.target) done.push(q);
      }
      save();
      return done;
    },
    claimQuest(q) {
      if (q.claimed || q.p < q.target) return 0;
      q.claimed = true;
      P.gems += q.gems;
      save();
      return q.gems;
    },

    // ---------- achievements ----------
    achievement(a) {
      const v = a.value(S);
      let tier = 0;
      while (tier < a.tiers.length && v >= a.tiers[tier]) tier++;
      return { value: v, tier, next: a.tiers[Math.min(tier, a.tiers.length - 1)], max: tier >= a.tiers.length };
    },
    // Returns achievements whose tier went up since last time (and pays gems for them).
    checkAchievements() {
      const ups = [];
      for (const a of ACHIEVEMENTS) {
        const st = S.achievement(a);
        const had = P.ach[a.id] || 0;
        if (st.tier > had) {
          P.ach[a.id] = st.tier;
          P.gems += 10 * st.tier;
          ups.push({ a, tier: st.tier });
        }
      }
      if (ups.length) save();
      return ups;
    },

    // ---------- league ----------
    league() {
      const wk = weekStartKey();
      if (!P.league) P.league = { week: wk, tier: 0, notice: null };
      const L = P.league;
      if (L.week !== wk) {
        const prevWeek = L.week;
        const userXP = S.weekXP(prevWeek);
        if (userXP > 0 && daysBetween(prevWeek, wk) === 7) {
          const board = S.board(prevWeek, L.tier, 1, userXP);
          const rank = board.findIndex((r) => r.me) + 1;
          const from = L.tier;
          let to = from;
          if (rank <= 5 && from < LEAGUE_TIERS - 1) to = from + 1;
          else if (rank >= 16 && from > 0) to = from - 1;
          const gems = rank === 1 ? 60 : rank === 2 ? 40 : rank === 3 ? 25 : 0;
          P.gems += gems;
          if (rank <= 3) P.stats.top3++;
          L.notice = { rank, from, to, gems };
          L.tier = to;
        }
        L.week = wk;
        save();
      }
      return L;
    },
    // Standings: 19 simulated learners + you. f = fraction of the week elapsed.
    board(week = weekStartKey(), tier = S.league().tier, f = null, userXP = null) {
      const start = parseDay(week).getTime();
      const frac = f == null ? Math.min(1, Math.max(0, (now() - start) / (7 * DAY))) : f;
      const r = rng(hash(week + ':' + tier));
      const names = BOTS.slice();
      const rows = [];
      const base = 70 * (1 + tier * 0.45);
      for (let i = 0; i < 19; i++) {
        const [name, avatar] = names.splice(Math.floor(r() * names.length), 1)[0];
        const lazy = r() < 0.12;
        const target = lazy ? Math.floor(r() * 25) : Math.round(base * (0.25 + r() * r() * 3.2));
        const shape = 0.6 + r() * 1.1;
        const jitter = r();
        const prog = frac <= 0 ? 0 : Math.pow(frac, shape);
        const xp = Math.round(target * Math.min(1, prog * (0.9 + jitter * 0.2)));
        rows.push({ name, avatar, xp });
      }
      rows.push({ me: true, xp: userXP == null ? S.weekXP(week) : userXP });
      rows.sort((a, b) => b.xp - a.xp || (a.me ? -1 : b.me ? 1 : 0));
      return rows;
    },
    takeLeagueNotice() {
      const L = S.league();
      const n = L.notice;
      if (n) {
        L.notice = null;
        save();
      }
      return n;
    },

    // ---------- course progress ----------
    resetCourse(T) {
      courses.delete(T);
      store.remove('course:' + T);
      delete P.courses[T];
      save();
    },
    coursesStarted: () => LANGS6.filter((l) => P.courses[l]),
    markStarted(T) {
      if (!P.courses[T]) {
        P.courses[T] = Date.now();
        save();
      }
    },
    totalWords() {
      let n = 0;
      for (const l of LANGS6) if (P.courses[l]) n += Object.keys(course(l).srs).length;
      return n;
    },

    // ---------- spaced repetition ----------
    strength(T, key) {
      const e = course(T).srs[key];
      if (!e) return 0;
      const [s, ts, reps] = e;
      const half = DAY * Math.pow(2, Math.min(reps, 7));
      return s * Math.pow(0.5, (now() - ts) / half);
    },
    learnWords(T, refs) {
      const c = course(T);
      for (const r of refs) {
        const k = r.u + ':' + r.i;
        if (!c.srs[k]) c.srs[k] = [0.7, now(), 0];
      }
      c.words = Object.keys(c.srs).length;
      saveCourse(T);
    },
    touchWords(T, refs, ok) {
      const c = course(T);
      for (const r of refs) {
        const k = r.u + ':' + r.i;
        if (!c.srs[k]) continue;
        const eff = S.strength(T, k);
        const e = c.srs[k];
        if (ok) c.srs[k] = [Math.min(1, eff + 0.3), now(), e[2] + 1];
        else c.srs[k] = [eff * 0.4, now(), Math.max(0, e[2] - 1)];
      }
      saveCourse(T);
    },
    // Weakest learned words first: [{u, i, s}]
    weakWords(T, n = 10) {
      const c = course(T);
      return Object.keys(c.srs)
        .map((k) => {
          const [u, i] = k.split(':');
          return { u, i: Number(i), s: S.strength(T, k) };
        })
        .sort((a, b) => a.s - b.s)
        .slice(0, n);
    },
    addMistake(T, ref) {
      if (!ref || (ref.k !== 'w' && ref.k !== 's')) return;
      const c = course(T);
      c.mistakes = c.mistakes.filter((m) => !(m.u === ref.u && m.k === ref.k && m.i === ref.i));
      c.mistakes.unshift({ u: ref.u, k: ref.k, i: ref.i });
      c.mistakes = c.mistakes.slice(0, 40);
      saveCourse(T);
    },
    clearMistake(T, ref) {
      const c = course(T);
      const n = c.mistakes.length;
      c.mistakes = c.mistakes.filter((m) => !(m.u === ref.u && m.k === ref.k && m.i === ref.i));
      if (c.mistakes.length !== n) saveCourse(T);
    },

    // ---------- settings / availability ----------
    listenOn: () => P.settings.listen && now() > P.listenOff,
    speakOn: () => P.settings.speak && !P.micDenied && now() > P.speakOff,
    pauseListening() {
      P.listenOff = now() + OFF_MS;
      save();
    },
    pauseSpeaking() {
      P.speakOff = now() + OFF_MS;
      save();
    },
  };
  return S;
}
