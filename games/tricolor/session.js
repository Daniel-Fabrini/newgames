// Match state machine for every mode (pure + JSON-serialisable; the UI only renders it).
//
// state = { v, mode, seed, rng, bag, total, step (0-based index of current question), qs[], sel, lifelines,
//           hidden[], aids{crowd,phone}, correct, wrong, points, streak, bestStreak, done, outcome,
//           prize, ms (sum of answer times), catRight{}, opts{}, timeLeft (time mode, seconds), startedAt }
// qs[i] = { id, order[4], pick (display idx|null), res ('right'|'wrong'|'timeout'|null), ms, swapped }
import { MODES, LADDER, SAFE_STEPS, TIME_ATTACK, pointsFor, THEMES } from './config.js';
import { prizeOnWrong, prizeOnStop } from './prizes.js';
import { rngFrom, hashSeed } from './rng.js';
import { drawQuestion, markUsed, presentOrder, viewOf, newSelState } from './select.js';
import { fiftyFifty, crowdVote, offerIdols, idolHint } from './lifelines.js';

const byId = (bank) => {
  if (!bank._idx || bank._idxLen !== bank.length) {
    Object.defineProperty(bank, '_idx', { value: new Map(bank.map((q) => [q.id, q])), configurable: true, writable: true });
    Object.defineProperty(bank, '_idxLen', { value: bank.length, configurable: true, writable: true });
  }
  return bank._idx;
};

/**
 * @param {object} cfg { mode, seed, bank, recent?:[ids], themeId?, timer?:0|20|30, preset?:[{id,order}] }
 * `preset` (daily) supplies the fixed question list.
 */
export function createSession({ mode, seed, bank, recent = [], themeId = null, timer = 0, preset = null, now = Date.now() }) {
  const M = MODES[mode];
  if (!M) throw new Error('unknown mode ' + mode);
  const st = {
    v: 1,
    mode,
    seed: seed >>> 0,
    rng: seed >>> 0,
    bag: [],
    total: M.total,
    step: 0,
    qs: [],
    sel: newSelState(),
    lifelines: { ...M.lifelines },
    hidden: [],
    aids: { crowd: null, phone: null },
    correct: 0,
    wrong: 0,
    points: 0,
    streak: 0,
    bestStreak: 0,
    done: false,
    outcome: null,
    prize: 0,
    ms: 0,
    catRight: {},
    opts: { themeId, timer },
    recent: recent.slice(),
    preset: preset ? preset.map((p) => ({ id: p.id, order: p.order.slice() })) : null,
    timeLeft: mode === 'time' ? TIME_ATTACK.seconds : null,
    startedAt: now,
  };
  if (!advanceTo(st, bank)) {
    st.done = true;
    st.outcome = 'empty';
  }
  return st;
}

const catsFor = (st) => {
  if (st.opts.themeId) return THEMES.find((t) => t.id === st.opts.themeId)?.cats || null;
  return null;
};

// draws & registers the question for st.qs.length (the next step). returns false if none available
function advanceTo(st, bank, forcedD = null) {
  const idx = st.qs.length;
  if (st.preset) {
    const p = st.preset[idx];
    if (!p) return false;
    const q = byId(bank).get(p.id);
    if (!q) return false;
    markUsed(st.sel, q);
    st.qs.push({ id: q.id, order: p.order.slice(), pick: null, res: null, ms: null });
    st.step = idx;
    return true;
  }
  const M = MODES[st.mode];
  const rnd = rngFrom(st);
  const d = forcedD || M.diff(idx + 1, st);
  const q = drawQuestion(bank, st.sel, { d, cats: catsFor(st), maxPerCat: M.maxPerCat, recent: st.recent, rnd });
  if (!q) return false;
  markUsed(st.sel, q);
  const order = presentOrder(q, st, rnd);
  st.qs.push({ id: q.id, order, pick: null, res: null, ms: null });
  st.step = idx;
  st.hidden = [];
  st.aids = { crowd: null, phone: null };
  return true;
}

export const cur = (st) => st.qs[st.qs.length - 1];
export function currentView(st, bank) {
  const e = cur(st);
  if (!e) return null;
  const q = byId(bank).get(e.id);
  return q ? viewOf(q, e.order) : null;
}
export const viewAt = (st, bank, i) => {
  const e = st.qs[i];
  const q = e && byId(bank).get(e.id);
  return q ? viewOf(q, e.order) : null;
};
/** 1-based ladder step of the current question */
export const stepNo = (st) => st.step + 1;

// ---------- lifelines ----------
export const canUse = (st, name) => !st.done && !cur(st).res && (st.lifelines[name] || 0) > 0;

export function useFifty(st, bank) {
  if (!canUse(st, 'fifty')) return null;
  const v = currentView(st, bank);
  const hide = fiftyFifty(v.c, st.hidden, rngFrom(st));
  st.hidden = [...new Set([...st.hidden, ...hide])];
  st.lifelines.fifty--;
  return hide;
}
export function useCrowd(st, bank) {
  if (!canUse(st, 'crowd')) return null;
  const v = currentView(st, bank);
  st.aids.crowd = crowdVote(v.d, v.c, st.hidden, rngFrom(st));
  st.lifelines.crowd--;
  return st.aids.crowd;
}
/** Uses the lifeline: offers 3 idols (era/role matched); then call callIdol() with the chosen one */
export function usePhone(st, bank) {
  if (!canUse(st, 'phone')) return null;
  const v = currentView(st, bank);
  st.aids.phone = { offer: offerIdols(v, rngFrom(st)), hint: null };
  st.lifelines.phone--;
  return st.aids.phone;
}
export function callIdol(st, bank, idolId) {
  const ph = st.aids.phone;
  if (!ph || ph.hint || !ph.offer.includes(idolId)) return null;
  ph.hint = idolHint(currentView(st, bank), idolId, rngFrom(st));
  return ph.hint;
}

/** Swap: a NEW question of the same step / difficulty / value replaces the current one (old one stays "used"). */
export function useSwap(st, bank) {
  if (!canUse(st, 'swap')) return false;
  const e = cur(st);
  const old = byId(bank).get(e.id);
  const M = MODES[st.mode];
  const rnd = rngFrom(st);
  // same slot in the ladder: undo the category count of the replaced question, keep it in `used`
  st.sel.catCounts[old.cat] = Math.max(0, (st.sel.catCounts[old.cat] || 1) - 1);
  const prevLast = st.qs.length > 1 ? byId(bank).get(st.qs[st.qs.length - 2].id)?.cat || null : null;
  st.sel.lastCat = prevLast;
  const d = M.diff(st.step + 1, st);
  const q = drawQuestion(bank, st.sel, { d, cats: catsFor(st), maxPerCat: M.maxPerCat, recent: st.recent, rnd });
  if (!q) {
    st.sel.catCounts[old.cat] = (st.sel.catCounts[old.cat] || 0) + 1;
    st.sel.lastCat = old.cat;
    return false;
  }
  markUsed(st.sel, q);
  st.qs[st.qs.length - 1] = { id: q.id, order: presentOrder(q, st, rnd), pick: null, res: null, ms: null, swapped: true };
  st.hidden = [];
  st.aids = { crowd: null, phone: null };
  st.lifelines.swap--;
  return true;
}

// ---------- answering ----------
/**
 * Locks the answer of the current question. `pick` = display index (null → timeout/no answer).
 * @returns {{right:boolean, correctIdx:number, step:number, prize?:number, ended:boolean, won?:boolean}}
 */
export function answer(st, bank, pick, ms = 0) {
  const e = cur(st);
  if (st.done || e.res) throw new Error('already answered');
  const v = currentView(st, bank);
  const right = pick !== null && pick === v.c;
  e.pick = pick;
  e.ms = Math.max(0, Math.round(ms));
  e.res = right ? 'right' : pick === null ? 'timeout' : 'wrong';
  st.ms += e.ms;
  const M = MODES[st.mode];
  const step = st.step + 1;
  const out = { right, correctIdx: v.c, step, ended: false };
  if (right) {
    st.correct++;
    st.streak++;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    st.catRight[v.cat] = (st.catRight[v.cat] || 0) + 1;
    if (M.ladder) {
      st.prize = LADDER[step - 1];
      if (step === M.total) {
        st.done = true;
        st.outcome = 'won';
        out.ended = out.won = true;
      }
    } else {
      let bonus = 0;
      if (st.opts.timer && ms >= 0) bonus = Math.max(0, Math.round((st.opts.timer * 1000 - ms) / 1000)) * 2;
      const gained = pointsFor(v.d, bonus, st.mode === 'time' ? st.streak - 1 : 0);
      st.points += gained;
      out.gained = gained;
      if (st.mode === 'time' && st.streak % TIME_ATTACK.streakBonusEvery === 0) {
        st.timeLeft += TIME_ATTACK.streakBonus;
        out.timeBonus = TIME_ATTACK.streakBonus;
      }
      if (st.total && step >= st.total) {
        st.done = true;
        st.outcome = 'finished';
        out.ended = true;
      }
    }
  } else {
    st.wrong++;
    st.streak = 0;
    if (M.ladder) {
      st.prize = prizeOnWrong(step);
      st.done = true;
      st.outcome = 'lost';
      out.ended = true;
      out.prize = st.prize;
    } else if (st.mode === 'time') {
      st.timeLeft = Math.max(0, st.timeLeft - TIME_ATTACK.wrongPenalty);
      out.timePenalty = TIME_ATTACK.wrongPenalty;
    } else if (st.total && step >= st.total) {
      st.done = true;
      st.outcome = 'finished';
      out.ended = true;
    }
  }
  if (st.mode === 'time' && st.timeLeft <= 0 && !st.done) {
    st.done = true;
    st.outcome = 'timeup';
    out.ended = true;
  }
  return out;
}

/** moves on to the next question after an answered one. false when the match ended / no more questions */
export function next(st, bank) {
  if (st.done) return false;
  if (!cur(st).res) throw new Error('current question not answered');
  if (!advanceTo(st, bank)) {
    st.done = true;
    st.outcome = st.mode === 'time' ? 'exhausted' : 'finished';
    return false;
  }
  return true;
}

/** Parar: keep the prize of the last answered rung (ladder modes) — only before answering the current question */
export function stop(st) {
  if (st.done) return st.prize;
  const M = MODES[st.mode];
  if (M.ladder) {
    st.prize = prizeOnStop(st.step + 1);
    st.outcome = 'stopped';
  } else st.outcome = 'quit';
  st.done = true;
  return st.prize;
}
/** time mode: the clock ran out while no question was being judged */
export function timeUp(st) {
  if (!st.done) {
    st.done = true;
    st.outcome = 'timeup';
  }
}

/** score used for records/ranking: R$ for ladder modes, points otherwise (time mode: points) */
export const scoreOf = (st) => (MODES[st.mode].ladder ? st.prize : st.points);

export function summary(st, bank) {
  const idx = byId(bank);
  const answered = st.qs.filter((e) => e.res);
  const cats = {};
  const review = answered.map((e) => {
    const q = idx.get(e.id);
    const v = q ? viewOf(q, e.order) : null;
    if (v) cats[v.cat] = (cats[v.cat] || 0) + 1;
    return { ...e, view: v };
  });
  return {
    mode: st.mode,
    outcome: st.outcome,
    score: scoreOf(st),
    prize: st.prize,
    points: st.points,
    correct: st.correct,
    wrong: st.wrong,
    answered: answered.length,
    hit: answered.length ? Math.round((100 * st.correct) / answered.length) : 0,
    bestStreak: st.bestStreak,
    ms: st.ms,
    avgMs: answered.length ? Math.round(st.ms / answered.length) : 0,
    cats,
    catRight: st.catRight,
    review,
    ids: answered.map((e) => e.id),
    rightIds: review.filter((r) => r.res === 'right').map((r) => r.id),
    steps: st.step + (cur(st)?.res ? 1 : 0),
    reached: st.step + 1,
    lifelinesUsed: Object.keys(MODES[st.mode].lifelines).reduce((n, k) => n + (MODES[st.mode].lifelines[k] - (st.lifelines[k] ?? 0)), 0),
  };
}

/** compact JSON for resume (the bank is looked up by id again) */
export const serialize = (st) => JSON.parse(JSON.stringify(st));
export function restore(raw, bank) {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.qs) || !raw.qs.length || raw.done) return null;
  const idx = byId(bank);
  if (raw.qs.some((e) => !idx.has(e.id))) return null;
  return raw;
}

// ---------- daily ----------
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/**
 * Same 10 questions for everybody on a given day (seed = date). Questions of the previous
 * `depth` days are excluded (computed by replaying those days), then relaxed when the bank is small.
 */
export function dailyPlan(dateKey, bank, depth = 7) {
  const days = [];
  const dt = new Date(dateKey + 'T12:00:00');
  for (let i = depth; i >= 0; i--) {
    const x = new Date(dt);
    x.setDate(x.getDate() - i);
    days.push(dayKey(x));
  }
  const recent = [];
  let plan = [];
  for (const k of days) {
    const st = createSession({ mode: 'daily', seed: hashSeed('tricolor-daily-' + k), bank, recent: recentOnly(recent, bank) });
    const picks = [];
    for (let i = 0; i < MODES.daily.total && !st.done; i++) {
      picks.push({ id: cur(st).id, order: cur(st).order.slice() });
      cur(st).res = 'right'; // simulate an answer so the next question can be drawn
      if (!advanceTo(st, bank)) break;
    }
    plan = picks;
    recent.push(...picks.map((p) => p.id));
    if (recent.length > 60) recent.splice(0, recent.length - 60);
  }
  return plan;
}
// keep recent-day exclusions only while the bank stays large enough (3x the exclusion size)
const recentOnly = (recent, bank) => (bank.length > recent.length + 40 ? recent : recent.slice(-Math.max(0, bank.length - 40)));
