// Computer players for Buraco. They only ever see a `viewFor(state, seat)` snapshot:
// own hand, all melds, the discard pile and who picked it up, counts — never the other
// hands, the stock order or the mortos. Legality is checked against a shadow state rebuilt
// from that view (other hands/stock/mortos are opaque placeholders).
import * as R from './rules.js';

export const LEVELS = ['easy', 'normal', 'hard'];

function shadowFromView(v) {
  const hands = v.handCounts.map((n, s) => (s === v.seat ? v.hand.slice() : new Array(n).fill(-1)));
  return {
    n: v.n,
    turn: v.seat,
    phase: v.phase,
    cleanOut: v.cleanOut,
    hands,
    stock: new Array(v.stockCount).fill(-1),
    pile: v.pile.slice(),
    mortos: v.mortoLeft.map((c) => (c ? new Array(c).fill(-1) : null)),
    mortoTaken: v.mortoTaken.slice(),
    melds: v.melds,
    nextMeldId: 0,
  };
}

const P = {
  easy: { danger: 0, takeBias: 2.5, wildMeld: false, track: false, noise: 3 },
  normal: { danger: 1, takeBias: 0, wildMeld: true, track: false, noise: 0.4 },
  hard: { danger: 1.5, takeBias: -0.5, wildMeld: true, track: true, noise: 0 },
};

// small deterministic hash noise so easy players are not perfectly consistent
function jitter(id, turnNo, amp) {
  if (!amp) return 0;
  let x = (id * 2654435761 + turnNo * 40503) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0x5bd1e995) >>> 0;
  return ((x % 1000) / 1000 - 0.5) * 2 * amp;
}

const rankLow = (id) => R.cardRank(id);
// ---------- hand analysis ----------
// Natural runs (>= 3 consecutive same-suit ranks) available in `ids`; ace low or high.
export function naturalRuns(ids) {
  const out = [];
  for (let s = 0; s < 4; s++) {
    const byRank = new Map();
    for (const id of ids) {
      if (R.isJoker(id) || R.cardSuit(id) !== s) continue;
      const r = R.cardRank(id);
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r).push(id);
    }
    if (byRank.size < 3) continue;
    // slot -> card id; ace may serve slot 1 or 14 (one physical card each, but copies may be two)
    const aceCards = byRank.get(1) || [];
    const slots = (hiAce) => {
      const m = new Map();
      for (const [r, list] of byRank) if (r !== 1) m.set(r, list[0]);
      if (aceCards.length) m.set(hiAce ? 14 : 1, aceCards[0]);
      return m;
    };
    let best = null;
    const tryOne = (m) => {
      const runs = [];
      let cur = [];
      for (let r = 1; r <= 14; r++) {
        if (m.has(r)) cur.push(r);
        else {
          if (cur.length >= 3) runs.push(cur);
          cur = [];
        }
      }
      if (cur.length >= 3) runs.push(cur);
      const total = runs.reduce((a, b) => a + b.length, 0);
      if (!best || total > best.total) best = { total, runs, m };
    };
    tryOne(slots(false));
    if (aceCards.length) tryOne(slots(true));
    if (aceCards.length === 2) {
      // both aces: low one and high one in separate runs
      const m = slots(false);
      m.set(14, aceCards[1]);
      // avoid a 1..14 wrap: handled by dropping the high ace if it would join everything
      if (!(m.has(1) && [...Array(14).keys()].every((i) => m.has(i + 1)))) tryOne(m);
    }
    if (best) {
      for (const run of best.runs) out.push(run.map((r) => best.m.get(r)));
    }
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

function suitRankSets(hand) {
  // per suit: Set of ranks held (natural cards, ace counts as 1 and 14)
  const sets = [new Set(), new Set(), new Set(), new Set()];
  for (const id of hand) {
    if (R.isJoker(id)) continue;
    const s = R.cardSuit(id);
    const r = R.cardRank(id);
    sets[s].add(r);
    if (r === 1) sets[s].add(14);
  }
  return sets;
}

function pileUseful(v, id, rankSets) {
  if (R.isWildCard(id)) return 2;
  const s = R.cardSuit(id);
  const r = R.cardRank(id);
  let u = 0;
  const rs = rankSets[s];
  for (const rr of r === 1 ? [1, 14] : [r]) {
    if (rs.has(rr - 1) || rs.has(rr + 1)) u += 1;
    if (rs.has(rr - 2) || rs.has(rr + 2)) u += 0.4;
  }
  for (const m of v.melds[v.team]) {
    if (m.suit !== s) continue;
    const lo = m.cards[0].r;
    const hi = m.cards[m.cards.length - 1].r;
    if (R.extensions(m, [id]).length) u += 1.5;
    else if (Math.abs(r - lo) <= 1 || Math.abs(r - hi) <= 1) u += 0.3;
  }
  return u;
}

// Cards an opponent seat is known to still hold from lixo pickups.
function inferredHeld(v) {
  const gone = new Set(v.pile);
  for (const t of v.melds) for (const m of t) for (const c of m.cards) gone.add(c.id);
  const res = {};
  for (const tk of v.pileTakes) {
    if (R.teamOf(v.n, tk.seat) === v.team) continue;
    (res[tk.seat] ||= []);
    for (const id of tk.ids) if (!gone.has(id)) res[tk.seat].push(id);
  }
  return res;
}

// ---------- decision: draw or take ----------
function chooseDraw(v, sh, lvl) {
  const prm = P[lvl];
  const canDraw = v.stockCount > 0;
  const plays = R.pilePlays(sh, v.seat);
  if (!plays.length) return canDraw ? { type: 'draw' } : { type: 'stop' };
  const rankSets = suitRankSets(v.hand);
  let useful = 0;
  let wilds = 0;
  for (const id of v.pile) {
    const u = pileUseful(v, id, rankSets);
    useful += Math.min(u, 3);
    if (R.isWildCard(id)) wilds++;
  }
  // best first play
  let bestPlay = null;
  let bestScore = -1e9;
  for (const p of plays) {
    const sc = scorePlay(v, p);
    if (sc > bestScore) {
      bestScore = sc;
      bestPlay = p;
    }
  }
  const afterSize = v.hand.length + v.pile.length;
  const gain = useful * 1.2 + wilds * 3 + (bestScore > 14 ? 3 : 0) + (v.melds[v.team].length === 0 ? 1.5 : 0);
  const cost = Math.max(0, v.pile.length - useful) * 0.55 + Math.max(0, afterSize - 17) * 1.4;
  const net = gain - cost - prm.takeBias;
  const small = v.pile.length <= 2;
  const take = small ? net > 0.4 && bestScore > 8 : net > 2;
  if (!canDraw) {
    // stock empty: take, or end the round when that is better for us
    if (net > 0) return { type: 'take', play: bestPlay };
    return ownLead(v) ? { type: 'stop' } : { type: 'take', play: bestPlay };
  }
  return take ? { type: 'take', play: bestPlay } : { type: 'draw' };
}
function ownLead(v) {
  const val = (team) => v.melds[team].reduce((s, m) => s + R.meldPoints(m) + (R.canastraKind(m) ? 100 : 0), 0);
  return val(v.team) > val(1 - v.team);
}
function scorePlay(v, p) {
  let sc = 0;
  if (p.t === 'add') {
    const m = v.melds[v.team].find((x) => x.id === p.meld);
    const arr = R.extensions(m, p.ids)[0];
    sc = 10 + (arr.cards.length >= 7 ? 12 : 0) - R.wildCount(arr.cards) * 0;
    if (R.wildCount(arr.cards) > R.wildCount(m.cards)) sc -= 6;
  } else {
    const arrs = R.arrangements(p.ids);
    const arr = arrs[0];
    sc = 6 + p.ids.length - R.wildCount(arr.cards) * 9 + R.cardPoints(p.ids[0]) / 10;
  }
  return sc;
}

// ---------- decision: melding ----------
function planMelds(v, sh, prm) {
  const hand = v.hand;
  const team = v.team;
  const myMelds = v.melds[team];
  const hasCan = myMelds.some((m) => R.canastraKind(m));
  const test = (a) => R.checkAction(sh, a);

  // 1) natural cards onto our melds (canastra makers first)
  let best = null;
  for (const m of myMelds) {
    for (const id of hand) {
      if (R.isJoker(id)) continue;
      const list = R.extensions(m, [id]);
      if (!list.length) continue;
      const wi = list.findIndex((a) => R.wildCount(a.cards) === R.wildCount(m.cards));
      if (wi < 0) continue;
      const a = { type: 'add', meld: m.id, ids: [id], arr: wi };
      const sc = (list[wi].cards.length >= 7 ? 100 : 0) + list[wi].cards.length - R.cardPoints(id) * 0.01;
      if ((!best || sc > best.sc) && test(a).ok) best = { a, sc };
    }
  }
  if (best) return best.a;

  // 2) new natural runs
  const runs = naturalRuns(hand);
  for (const run of runs) {
    const a = { type: 'meld', ids: run, arr: 0 };
    if (test(a).ok) return a;
    // maybe leaving a card helps legality (e.g. keep one to discard)
    if (run.length > 3) {
      const b = { type: 'meld', ids: run.slice(0, run.length - 1), arr: 0 };
      if (test(b).ok) return b;
    }
  }

  // 3) wilds
  const wilds = hand.filter(R.isWildCard).sort((a, b) => R.cardPoints(b) - R.cardPoints(a));
  if (wilds.length) {
    // 3a) a dirty canastra from a clean 6-meld when we have none yet
    if (!hasCan) {
      for (const m of myMelds) {
        if (m.cards.length !== 6 || R.wildCount(m.cards)) continue;
        for (const w of wilds) {
          const list = R.extensions(m, [w]);
          if (list.length) {
            const a = { type: 'add', meld: m.id, ids: [w], arr: 0 };
            if (test(a).ok) return a;
          }
        }
      }
    }
    // 3b) bridge a 2-card gap with a spare wild
    const spare = wilds.length;
    const late = v.stockCount <= 12;
    if (prm.wildMeld && (spare >= 2 || late || (hand.length >= 8 && spare >= 1 && myMelds.length === 0))) {
      const cand = wildMeldCandidate(hand, wilds[0]);
      if (cand) {
        const a = { type: 'meld', ids: cand, arr: 0 };
        if (test(a).ok) return a;
      }
    }
    // 3c) late in the round (or close to going out) dump wilds on our melds: they cost 20-50 in hand
    if (late || (hand.length <= 4 && !hasCan)) {
      for (const m of myMelds) {
        if (m.cards.length < (late ? 3 : 5) || R.wildCount(m.cards)) continue;
        for (const w of wilds) {
          if (R.extensions(m, [w]).length) {
            const a = { type: 'add', meld: m.id, ids: [w], arr: 0 };
            if (test(a).ok) return a;
          }
        }
      }
    }
  }
  return null;
}
// Two naturals of one suit within a span of 3 + one wild (the biggest natural cluster first).
function wildMeldCandidate(hand, wild) {
  const nat = hand.filter((x) => !R.isWildCard(x) || (R.isTwo(x) && x !== wild && false));
  let best = null;
  for (let i = 0; i < nat.length; i++) {
    for (let j = i + 1; j < nat.length; j++) {
      const ids = [nat[i], nat[j], wild];
      const arr = R.arrangements(ids)[0];
      if (!arr) continue;
      const sc = R.cardPoints(nat[i]) + R.cardPoints(nat[j]);
      // prefer clusters that can still grow: naturals nearby in hand
      if (!best || sc > best.sc) best = { ids, sc };
    }
  }
  return best ? best.ids : null;
}

// ---------- decision: discard ----------
function chooseDiscard(v, sh, lvl) {
  const prm = P[lvl];
  const hand = v.hand;
  const rankSets = suitRankSets(hand);
  const held = prm.track ? inferredHeld(v) : {};
  const opp = [];
  for (let t = 0; t < 2; t++) if (t !== v.team) opp.push(t);
  const oppSeats = [];
  for (let s = 0; s < v.n; s++) if (R.teamOf(v.n, s) !== v.team) oppSeats.push(s);
  const late = v.stockCount < 14 ? 1 : 0;
  const pileFactor = 1 + v.pile.length * 0.12;
  const scored = hand.map((id) => {
    let keep = 0;
    let danger = 0;
    if (R.isWildCard(id)) {
      keep += R.isJoker(id) ? 60 : 45;
      danger += 8;
    } else {
      const s = R.cardSuit(id);
      const r = R.cardRank(id);
      const rs = rankSets[s];
      for (const rr of r === 1 ? [1, 14] : [r]) {
        if (rs.has(rr - 1)) keep += 4;
        if (rs.has(rr + 1)) keep += 4;
        if (rs.has(rr - 2)) keep += 1.8;
        if (rs.has(rr + 2)) keep += 1.8;
      }
      // a spare same card in hand is worth little
      const copies = hand.filter((x) => x !== id && !R.isJoker(x) && R.cardSuit(x) === s && R.cardRank(x) === r).length;
      if (copies) keep -= 2.5;
      for (const m of v.melds[v.team]) {
        if (m.suit !== s) continue;
        if (R.extensions(m, [id]).length) keep += 8;
        else if (Math.abs(r - m.cards[0].r) <= 2 || Math.abs(r - m.cards[m.cards.length - 1].r) <= 2) keep += 1.5;
      }
      keep -= R.cardPoints(id) * (0.08 + 0.14 * late);
      for (const t of opp) {
        for (const m of v.melds[t]) {
          if (m.suit !== s) continue;
          if (R.extensions(m, [id]).length) danger += m.cards.length >= 6 ? 9 : 5;
        }
      }
      for (const seat of oppSeats) {
        for (const h of held[seat] || []) {
          if (!R.isJoker(h) && R.cardSuit(h) === s && Math.abs(R.cardRank(h) - r) <= 2) danger += 2.5;
        }
      }
      // a card the opponents have just picked up pairs: recently discarded cards of the same rank are safer
      if (v.pile.some((x) => !R.isJoker(x) && R.cardRank(x) === r && R.cardSuit(x) === s)) danger -= 1.5;
    }
    const total = keep + danger * prm.danger * pileFactor + jitter(id, v.turnNo, prm.noise);
    return { id, total };
  });
  scored.sort((a, b) => a.total - b.total || a.id - b.id);
  for (const c of scored) {
    if (R.checkAction(sh, { type: 'discard', id: c.id }).ok) return { type: 'discard', id: c.id };
  }
  return null;
}

// ---------- entry point ----------
export function chooseAction(state, level = 'normal') {
  const lvl = P[level] ? level : 'normal';
  const v = R.viewFor(state, state.turn);
  const sh = shadowFromView(v);
  if (v.phase === 'draw') return chooseDraw(v, sh, lvl);
  const plan = planMelds(v, sh, P[lvl]);
  if (plan) return plan;
  const d = chooseDiscard(v, sh, lvl);
  if (d) return d;
  // last resort (should not happen): any legal action
  for (const id of v.hand) if (R.checkAction(sh, { type: 'discard', id }).ok) return { type: 'discard', id };
  return null;
}
