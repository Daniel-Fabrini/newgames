// Career (endless leagues with promotion/relegation), cup ladder and rewards.
// Pure data functions: main.js stores the returned objects with ctx.store.

import { TEAMS, LEAGUE_SIZE, CHAMPIONS_TIER, tierSkill, tierGoals, teamByCode } from './data.js';
import { shuffle } from '../../js/core/ui.js';

// Circle-method round robin: LEAGUE_SIZE-1 rounds of LEAGUE_SIZE/2 pairings.
function roundRobin(n) {
  const ids = [...Array(n).keys()];
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([ids[i], ids[n - 1 - i]]);
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

// Opponents get stronger (higher rating teams) as the tier rises.
function pickOpponents(myCode, n, tier) {
  const pool = TEAMS.filter((t) => t.code !== myCode);
  const want = Math.min(0.95, 0.55 + tier * 0.07);
  const scored = shuffle(pool).map((t) => ({ t, k: Math.abs(t.r - want) + Math.random() * 0.25 }));
  scored.sort((a, b) => a.k - b.k);
  return scored.slice(0, n).map((x) => x.t.code);
}

export function newSeason(tier, myCode, number) {
  const teams = [myCode, ...pickOpponents(myCode, LEAGUE_SIZE - 1, tier)];
  return {
    tier,
    number,
    teams,
    rounds: roundRobin(LEAGUE_SIZE),
    round: 0,
    table: teams.map(() => ({ p: 0, w: 0, l: 0, gf: 0, ga: 0, pts: 0 })),
    last: null,
  };
}

export function currentOpponent(season) {
  const pair = season.rounds[season.round].find((p) => p.includes(0));
  return pair[0] === 0 ? pair[1] : pair[0];
}

export function seasonSkill(season, oppIndex) {
  const r = teamByCode(season.teams[oppIndex]).r;
  return Math.max(0, tierSkill(season.tier) + (r - 0.7) * 0.8);
}
export const seasonGoals = (season) => tierGoals(season.tier);

function record(table, a, b, ga, gb) {
  const A = table[a];
  const Bt = table[b];
  A.p++;
  Bt.p++;
  A.gf += ga;
  A.ga += gb;
  Bt.gf += gb;
  Bt.ga += ga;
  if (ga > gb) {
    A.w++;
    A.pts += 3;
    Bt.l++;
  } else {
    Bt.w++;
    Bt.pts += 3;
    A.l++;
  }
}

// Records your result and simulates the other matches of the round.
export function playRound(season, myGoals, oppGoals) {
  const n = tierGoals(season.tier);
  const results = [];
  for (const [a, b] of season.rounds[season.round]) {
    if (a === 0 || b === 0) {
      const opp = a === 0 ? b : a;
      record(season.table, 0, opp, myGoals, oppGoals);
      results.push([0, opp, myGoals, oppGoals]);
      continue;
    }
    const ra = teamByCode(season.teams[a]).r;
    const rb = teamByCode(season.teams[b]).r;
    const pa = Math.max(0.15, Math.min(0.85, 0.5 + (ra - rb) * 1.2));
    const aWins = Math.random() < pa;
    const lose = Math.floor(Math.random() * n);
    const ga = aWins ? n : lose;
    const gb = aWins ? lose : n;
    record(season.table, a, b, ga, gb);
    results.push([a, b, ga, gb]);
  }
  season.last = results;
  season.round++;
  return results;
}

export function standings(season) {
  const idx = season.teams.map((_, i) => i);
  const T = season.table;
  idx.sort((a, b) => T[b].pts - T[a].pts || T[b].gf - T[b].ga - (T[a].gf - T[a].ga) || T[b].gf - T[a].gf || a - b);
  return idx;
}

export const seasonOver = (season) => season.round >= season.rounds.length;

// Final position (1-based) and what it means.
export function seasonOutcome(season) {
  const pos = standings(season).indexOf(0) + 1;
  return {
    pos,
    champion: pos === 1,
    promoted: pos <= 2,
    relegated: pos === LEAGUE_SIZE && season.tier > 0,
  };
}

export function nextTier(tier, out) {
  if (out.promoted) return tier + 1;
  if (out.relegated) return Math.max(0, tier - 1);
  return tier;
}

export const isLegend = (tier) => tier > CHAMPIONS_TIER;

// ---------- cup ----------
export const CUP_ROUNDS = 4;
export function newCup(level, myCode) {
  const opps = pickOpponents(myCode, CUP_ROUNDS, Math.min(8, level * 2 + 1));
  // weakest first
  opps.sort((a, b) => teamByCode(a).r - teamByCode(b).r);
  return { level, opps, round: 0, out: false };
}
export const cupSkill = (cup) => 0.4 + cup.level * 0.8 + cup.round * 0.75;
export const cupGoals = (cup) => (cup.round === CUP_ROUNDS - 1 ? 3 : 2);

// ---------- rewards ----------
// kind: 'quick' | 'career' | 'cup'. Returns coins, career XP (cxp) and ranking points (rp).
export function matchReward(kind, won, goals, opts = {}) {
  if (kind === 'quick') {
    const d = opts.diff || 0;
    return won ? { coins: [10, 20, 35][d], cxp: [30, 50, 80][d] + goals * 5, rp: 0 } : { coins: 3, cxp: 10 + goals * 3, rp: 0 };
  }
  if (kind === 'career') {
    const t = opts.tier || 0;
    return won
      ? { coins: 20 + t * 6, cxp: 70 + t * 10 + goals * 8, rp: 15 + t * 3 }
      : { coins: 5 + t, cxp: 20 + goals * 5, rp: -(4 + t) };
  }
  const lv = opts.level || 0;
  const r = opts.round || 0;
  return won ? { coins: 25 + r * 10 + lv * 8, cxp: 60 + r * 10 + lv * 8, rp: 10 + lv * 2 + r * 3 } : { coins: 5, cxp: 20 + goals * 5, rp: 0 };
}

export function seasonReward(tier, out) {
  if (out.champion) return { coins: 120 + tier * 40, cxp: 150 + tier * 30, rp: 60 + tier * 10 };
  if (out.promoted) return { coins: 70 + tier * 25, cxp: 100 + tier * 15, rp: 30 + tier * 5 };
  if (out.relegated) return { coins: 20, cxp: 30, rp: 0 };
  return { coins: 30 + tier * 10, cxp: 50 + tier * 8, rp: 10 };
}

export function cupReward(level) {
  return { coins: 150 + level * 50, cxp: 200 + level * 30, rp: 50 + level * 10 };
}
