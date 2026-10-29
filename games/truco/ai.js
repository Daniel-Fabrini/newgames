// Truco AI. Works ONLY from a `view` (viewFor in rules.js): own cards + public information.
// It samples ("determinizes") the unseen cards for the other seats, then rolls the hand out with a
// simple, rule-abiding policy to estimate P(my team wins the hand). Hidden cards are never read.
import { RANKS, SUITS, makeDeck, strength, teamOf, handWinner, trickWinner, nextLevel } from './rules.js';

export const PERSONAS = [
  { id: 'zeca', call: 0.76, freq: 0.75, bluff: 0.03, acceptBias: 0.05, raise: 0.86, slow: 0.4 },
  { id: 'marilu', call: 0.64, freq: 0.9, bluff: 0.16, acceptBias: -0.05, raise: 0.74, slow: 0.2 },
  { id: 'tonho', call: 0.7, freq: 0.8, bluff: 0.1, acceptBias: 0, raise: 0.8, slow: 0.3 },
  { id: 'vera', call: 0.72, freq: 0.85, bluff: 0.06, acceptBias: 0.02, raise: 0.82, slow: 0.45 },
];
export const DIFFICULTY = {
  easy: { samples: 8, noise: 0.12 },
  normal: { samples: 22, noise: 0.04 },
  hard: { samples: 40, noise: 0 },
};

const FULL = makeDeck();

// ---------- rollout simulation ----------
function policy(sim, seat) {
  const hand = sim.hands[seat];
  const myTeam = teamOf(seat);
  const m = sim.manilha;
  const sorted = hand.slice().sort((a, b) => strength(a, m) - strength(b, m));
  if (sorted.length === 1) return sorted[0];
  const idx = sim.results.length;
  if (sim.cur.length) {
    let best = -2;
    for (const p of sim.cur) best = Math.max(best, p.hidden ? -1 : strength(p.card, m));
    const w = trickWinner(sim.cur, m);
    if (!w.tie && w.team === myTeam) return sorted[0];
    const beat = sorted.filter((c) => strength(c, m) > best);
    if (beat.length) return beat[0];
    if (w.tie || idx === 0) {
      const eq = sorted.filter((c) => strength(c, m) === best);
      if (eq.length && idx === 0) return eq[0];
    }
    return sorted[0];
  }
  if (idx === 0) return sorted[Math.floor(sorted.length / 2)];
  return sorted[sorted.length - 1];
}

function runOut(sim) {
  for (let guard = 0; guard < 20; guard++) {
    const seat = sim.turn;
    const card = policy(sim, seat);
    sim.hands[seat] = sim.hands[seat].filter((c) => c !== card);
    sim.cur.push({ seat, card, hidden: false });
    if (sim.cur.length === sim.n) {
      const w = trickWinner(sim.cur, sim.manilha);
      sim.results.push(w.team);
      const hw = handWinner(sim.results);
      if (hw !== undefined) return hw;
      sim.leader = w.tie ? sim.leader : w.seat;
      sim.turn = sim.leader;
      sim.cur = [];
    } else sim.turn = (seat + 1) % sim.n;
  }
  return 'none';
}

function unseenPool(view) {
  const seen = new Set(view.own);
  seen.add(view.vira);
  for (const c of view.played) seen.add(c);
  for (const p of view.cur) if (p.card) seen.add(p.card);
  for (const t of view.tricks) for (const p of t.plays) if (p.card) seen.add(p.card);
  return FULL.filter((c) => !seen.has(c));
}

/** Win probability of my team. `candidate` = a play {card, hidden} to make first (turn must be mine) or null. */
export function winProb(view, rnd, samples, candidate = null) {
  const me = view.seat;
  const myTeam = view.team;
  const pool = unseenPool(view);
  const need = [];
  for (let s = 0; s < view.n; s++) {
    if (s === me) continue;
    if (view.mates && view.mates[s]) continue;
    need.push([s, view.cardsLeft[s]]);
  }
  let sum = 0;
  for (let k = 0; k < samples; k++) {
    // partial Fisher-Yates on a copy of the pool
    const p = pool.slice();
    const hands = [];
    hands[me] = view.own.slice();
    if (view.mates) for (const s in view.mates) hands[s] = view.mates[s].slice();
    let pi = 0;
    for (const [s, cnt] of need) {
      for (let i = 0; i < cnt; i++) {
        const j = pi + Math.floor(rnd() * (p.length - pi));
        [p[pi], p[j]] = [p[j], p[pi]];
        pi++;
      }
      hands[s] = p.slice(pi - cnt, pi);
    }
    const sim = {
      n: view.n,
      manilha: view.manilha,
      hands,
      cur: view.cur.map((x) => ({ ...x })),
      results: view.results.slice(),
      leader: view.leader,
      turn: view.turn,
    };
    if (candidate) {
      const seat = sim.turn;
      sim.hands[seat] = sim.hands[seat].filter((c) => c !== candidate.card);
      sim.cur.push({ seat, card: candidate.card, hidden: !!candidate.hidden });
      if (sim.cur.length === sim.n) {
        const w = trickWinner(sim.cur, sim.manilha);
        sim.results.push(w.team);
        const hw0 = handWinner(sim.results);
        if (hw0 !== undefined) {
          sum += hw0 === myTeam ? 1 : hw0 === 'none' ? 0.5 : 0;
          continue;
        }
        sim.leader = w.tie ? sim.leader : w.seat;
        sim.turn = sim.leader;
        sim.cur = [];
      } else sim.turn = (seat + 1) % sim.n;
    }
    const hw = runOut(sim);
    sum += hw === myTeam ? 1 : hw === 'none' ? 0.5 : 0;
  }
  return sum / samples;
}

// A quick heuristic strength tag (for UI hints / tests): count of strong cards
export function strongCount(cards, manilha) {
  return cards.filter((c) => strength(c, manilha) >= 8 || c[0] === manilha).length;
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * Decide an action for the acting seat. Returns {t:'play',card,hidden?} | {t:'truco'} | {t:'accept'} | {t:'run'} | {t:'raise'}.
 * rnd: () => [0,1) — callers pass a PRNG independent from the shuffle (never the deal RNG).
 */
export function decide(view, persona, rnd, diff = DIFFICULTY.normal) {
  const legal = view.legal;
  if (!legal.length) return null;
  const has = (t) => legal.some((a) => a.t === t);
  const mySc = view.score[view.team];
  const opSc = view.score[1 - view.team];
  const samples = diff.samples;
  const noise = () => (diff.noise ? (rnd() - 0.5) * 2 * diff.noise : 0);

  if (view.phase === 'onze') {
    const P = winProb(view, rnd, samples) + noise();
    const thr = opSc >= 9 ? 0.55 : 0.4;
    return P >= thr + persona.acceptBias * 0.5 ? { t: 'accept' } : { t: 'run' };
  }

  if (view.phase === 'bet') {
    const bet = view.bet;
    let P = winProb(view, rnd, samples) + noise();
    P -= 0.03; // the opponent asking is mild evidence of strength
    const level = bet.level;
    let need = (level - view.value) / (2 * level) + persona.acceptBias;
    if (opSc + view.value >= view.target) need = 0.05; // refusing loses the game
    else if (opSc + level >= view.target) need = Math.max(need, 0.45);
    if (mySc + level >= view.target && P > 0.3) need = Math.min(need, P); // winning ends the game for us
    need = clamp(need, 0.05, 0.8);
    if (has('raise')) {
      if (P >= persona.raise && rnd() < persona.freq) return { t: 'raise' };
      if (P < need && level < 9 && rnd() < persona.bluff * 0.5) return { t: 'raise' };
    }
    return P >= need ? { t: 'accept' } : { t: 'run' };
  }

  // phase play
  const plays = legal.filter((a) => a.t === 'play');
  if (view.special === 'ferro') return plays[Math.floor(rnd() * plays.length)]; // blind hand
  // evaluate each card (unique cards, face-up and, if allowed, face-down)
  const scored = plays.map((a) => ({ a, p: winProb(view, rnd, samples, a) + noise(), st: strength(a.card, view.manilha) + (a.hidden ? -0.5 : 0) }));
  scored.sort((x, y) => y.p - x.p || x.st - y.st);
  // among near-equal options prefer the weaker card (keep strength for later), hide only when it costs nothing
  let best = scored[0];
  for (const s of scored) if (s.p >= best.p - 0.01 && s.st < best.st) best = s;
  const Pbest = best.p;

  if (has('truco')) {
    const level = nextLevel(view.value);
    const li = [3, 6, 9, 12].indexOf(level);
    let thr = persona.call + li * 0.025 - clamp(opSc - mySc, -6, 6) * 0.006;
    if (mySc + level >= view.target) thr -= 0.05;
    if (Pbest >= thr) {
      const slow = Pbest > 0.95 && rnd() < persona.slow;
      if (!slow && rnd() < persona.freq) return { t: 'truco' };
    } else if (level <= 6 && Pbest >= 0.22 && Pbest < thr - 0.1 && rnd() < persona.bluff * (view.results.length === 0 ? 0.6 : 1)) {
      return { t: 'truco' }; // bluff
    }
  }
  return best.a.t === 'play' ? { t: 'play', card: best.a.card, ...(best.a.hidden ? { hidden: true } : {}) } : best.a;
}

/** Random-legal player used for fuzzing and benchmarks. */
export function randomAction(view, rnd) {
  const l = view.legal;
  return l[Math.floor(rnd() * l.length)];
}

export { RANKS, SUITS };
