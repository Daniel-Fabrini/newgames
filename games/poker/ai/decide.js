// Decision engine. Input is a `view` built by engine/hand.js viewFor(): the AI never sees other players' hole cards or the deck.
import { evaluate } from '../engine/eval.js';
import { preflopPct, PCT } from './preflop.js';
import { equity } from './equity.js';
export { equity, preflopPct };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const skill3 = (p) => (p.skill <= 4 ? 0.82 + 0.045 * p.skill : 1); // weak players under-weigh pot odds
const gauss = (rng) => (rng() + rng() + rng() - 1.5) * 0.8165; // ~N(0,~0.5)

function analyze(view) {
  const me = view.players[view.me];
  const others = view.players.filter((p) => p.i !== view.me && !p.folded);
  return { me, others, nOpp: others.length };
}
function lateness(view, profile) {
  const n = view.n; let late;
  if (n === 2) late = 1;
  else {
    const ord = (view.me - view.bbIdx - 1 + n * 2) % n; // 0 = UTG ... n-3 = BTN, n-2 = SB, n-1 = BB
    late = ord === n - 2 ? 0.45 : ord === n - 1 ? 0.55 : ord / Math.max(1, n - 3);
  }
  return 0.5 + (late - 0.5) * (0.3 + 0.7 * profile.position); // unaware players ignore position
}
function boardWetness(board) {
  if (board.length < 3) return 0;
  const suits = [0, 0, 0, 0], ranks = new Set();
  for (const c of board) { suits[c & 3]++; ranks.add(c >> 2); }
  let w = Math.max(...suits) >= 3 ? 0.4 : Math.max(...suits) === 2 ? 0.15 : 0;
  const rs = [...ranks].sort((a, b) => a - b);
  let conn = 0; for (let i = 1; i < rs.length; i++) if (rs[i] - rs[i - 1] <= 2) conn++;
  return clamp(w + conn * 0.15, 0, 1);
}
function drawInfo(hole, board) {
  if (board.length < 3 || board.length > 4) return { flush: false, straight: false };
  const all = hole.concat(board);
  const s = [0, 0, 0, 0]; for (const c of all) s[c & 3]++;
  let flush = false;
  for (let u = 0; u < 4; u++) if (s[u] === 4 && hole.some((c) => (c & 3) === u)) flush = true;
  const mask = all.reduce((m, c) => m | (1 << (c >> 2)), 0) | ((all.some((c) => c >> 2 === 12) ? 1 : 0) ? 0 : 0);
  let straight = false;
  const hm = hole.reduce((m, c) => m | (1 << (c >> 2)), 0);
  for (let lo = 0; lo <= 9; lo++) { // windows of 5: need 4 present incl. a hole card, open-ended if the 4 are consecutive
    const win = 0x1F << lo; const have = mask & win;
    let k = 0; for (let b = lo; b < lo + 5; b++) if (have >> b & 1) k++;
    if (k === 4 && (have & hm)) straight = true;
  }
  return { flush, straight };
}

// range assumptions per opponent, from this hand's public action
function opponentCuts(view, profile, ctx) {
  const stats = ctx.stats || {};
  const cuts = [];
  const hist = view.history;
  for (const p of view.players) {
    if (p.i === view.me || p.folded) continue;
    let cut = 1; let pfRaises = 0, pfCalls = 0, postAgg = 0, postCalls = 0;
    for (const a of hist) {
      if (a.p !== p.i) continue;
      if (a.street === 'preflop') { if (a.type === 'raise' || a.type === 'bet') pfRaises++; else if (a.type === 'call') pfCalls++; }
      else { if (a.type === 'raise' || a.type === 'bet') postAgg++; else if (a.type === 'call') postCalls++; }
    }
    if (pfRaises >= 1) cut = pfRaises >= 3 ? 0.04 : pfRaises === 2 ? 0.1 : 0.28;
    else if (pfCalls >= 1) cut = 0.55;
    else cut = 0.8; // checked big blind / limp
    const narrow = 0.66 + 0.3 * ((10 - profile.skill) / 9); // weak players under-react to aggression
    cut *= Math.pow(narrow, postAgg) * Math.pow(0.9, postCalls);
    const st = stats[p.id];
    if (st && st.hands >= 6 && profile.adapt > 0) {
      const looseness = clamp(0.5 + (st.vpip / st.hands) * 1.1, 0.6, 1.5);
      cut *= 1 + (looseness - 1) * profile.adapt;
    }
    if (p.allIn && view.street !== 'preflop') cut = Math.min(cut, 0.5);
    cuts.push(clamp(cut, 0.04, 1));
  }
  return cuts;
}

function sizeRaise(view, L, frac, forceAllInRatio = 0.35) {
  // `to` = total bet this street. Standard: current bet + frac * (pot + call).
  const pot = view.pot;
  let to = Math.round(view.currentBet + Math.max(L.toCall > 0 ? 0 : 0, frac * (pot + L.toCall)));
  if (view.currentBet === 0) to = Math.round(frac * pot);
  to = clamp(to, L.minRaiseTo, L.maxRaiseTo);
  // commit when the remaining stack would be small relative to the pot
  if (L.maxRaiseTo - to <= forceAllInRatio * (pot + to)) return { type: 'allin' };
  return { type: view.currentBet === 0 ? 'bet' : 'raise', to };
}

/** Always returns a legal action. */
export function decide(view, profile, rng, ctx = {}) {
  const L = view.legal;
  if (!L) throw new Error('no legal actions');
  const a = raw(view, profile, rng, ctx, L);
  return legalize(a, L);
}

export function legalize(a, L) {
  const passive = () => (L.canCheck ? { type: 'check' } : { type: 'fold' });
  if (!a) return passive();
  switch (a.type) {
    case 'check': return L.canCheck ? a : { type: L.canCall ? 'fold' : 'check' };
    case 'call': return L.canCall ? a : { type: 'check' };
    case 'fold': return L.canCheck ? { type: 'check' } : a;
    case 'allin': return L.canAllIn ? a : (L.canCall ? { type: 'call' } : { type: 'check' });
    case 'bet': case 'raise': {
      if (!L.canRaise) return L.canCall ? { type: 'call' } : { type: 'check' };
      const to = clamp(Math.round(a.to), L.minRaiseTo, L.maxRaiseTo);
      return { type: L.isBet ? 'bet' : 'raise', to };
    }
    default: return passive();
  }
}

function raw(view, profile, rng, ctx, L) {
  const { me, nOpp } = analyze(view);
  const skill = profile.skill, err = (10 - skill) / 9; // 0 = perfect, 1 = awful
  const tilt = ctx.agent?.tilt || 0;
  const bb = view.bb;
  const stackBB = me.stack / bb;
  const M = me.stack / Math.max(1, view.sb + view.bb + view.ante * view.n);
  const late = lateness(view, profile);
  const press = ctx.pressure || {};
  const icm = ((press.bubble ? 0.07 : press.finalTable ? 0.03 : 0) * (1 - profile.risk) * (me.stack > (press.avgStack || me.stack) ? 1.25 : 0.8));
  const fast = !!ctx.fast;
  // rookies / low skill: occasional blunder - plays a random passive-ish option
  const blunder = Math.max(0, (4 - skill) * 0.035);
  if (blunder > 0 && rng() < blunder) {
    const r = rng();
    if (L.canCheck) return r < 0.8 ? { type: 'check' } : (L.canRaise ? { type: 'bet', to: L.minRaiseTo } : { type: 'check' });
    if (L.toCall <= me.stack * 0.5) return r < 0.7 ? { type: 'call' } : { type: 'fold' };
    return { type: 'fold' };
  }
  const loosen = 1 + tilt * 0.35 * (1 - profile.tiltRes);
  const aggr = clamp(profile.aggr + tilt * 0.2 * (1 - profile.tiltRes), 0, 1);

  if (view.street === 'preflop') return preflop(view, profile, rng, ctx, L, { me, nOpp, M, stackBB, late, icm, err, loosen, aggr, fast });
  return postflop(view, profile, rng, ctx, L, { me, nOpp, M, stackBB, late, icm, err, loosen, aggr, fast });
}

function preflop(view, profile, rng, ctx, L, c) {
  const { me, M, late, icm, err, loosen, aggr, nOpp } = c;
  const bb = view.bb;
  const pct = clamp(preflopPct(view.hole) + gauss(rng) * err * 0.22, 0, 1) / loosen;
  const hist = view.history.filter((h) => h.street === 'preflop');
  const raises = hist.filter((h) => h.type === 'raise' || h.type === 'bet').length; // 0 = unopened
  const limpers = hist.filter((h) => h.type === 'call').length;
  const shortHandedBoost = Math.pow(9 / Math.max(2, view.n), 0.4);
  const tightF = 1.55 - profile.tight * 1.1; // 1.0 at tight=.5
  const openW = clamp((0.07 + 0.27 * late) * shortHandedBoost * tightF, 0.04, 0.85);
  const toCallBB = L.toCall / bb;

  if (raises === 0) {
    // ---- unopened (or limped) pot ----
    if (M <= 9) { // push / fold zone
      const push = clamp((0.07 + 0.95 / Math.max(M, 1.4) * 0.45 + 0.12 * late) * shortHandedBoost * (1.15 - profile.tight * 0.3) * (1 + (profile.risk - 0.5) * 0.3), 0.05, 0.9);
      if (pct <= push - icm * 0.8) return { type: 'allin' };
      return L.canCheck ? { type: 'check' } : { type: 'fold' };
    }
    if (pct <= openW) {
      const sizeBB = (2.1 + 0.9 * (1 - late) + (aggr - 0.5) * 0.6 + limpers) * (me.stack / bb < 25 ? 0.85 : 1);
      if (aggr < 0.3 && pct > openW * 0.55 && rng() < 0.6) return L.canCheck ? { type: 'check' } : { type: 'call' }; // passive limp
      return rawOpen(view, L, sizeBB);
    }
    if (L.canCheck) {
      // BB option vs limpers: iso-raise strong hands
      if (limpers > 0 && pct <= openW * 0.5 && rng() < aggr) return rawOpen(view, L, 3.5 + limpers);
      return { type: 'check' };
    }
    // limp with speculative hands (loose / passive players)
    if (toCallBB <= 1 && pct <= 0.4 * (1.3 - profile.tight) * (1 - aggr * 0.4) && rng() < (1 - profile.tight) * 0.7) return { type: 'call' };
    return { type: 'fold' };
  }

  // ---- facing a raise (level = raises) ----
  const raiser = view.players[view.lastAggressor >= 0 ? view.lastAggressor : 0];
  const st = ctx.stats?.[raiser?.id];
  let cut = raises === 1 ? 0.22 : raises === 2 ? 0.1 : 0.05;
  if (st && st.hands >= 6) cut = clamp(Math.max(0.05, (st.pfr / st.hands) * 1.15) , 0.05, 0.5) * (raises === 1 ? 1 : 0.5);
  if (raiser && raiser.allIn) { const rM = (raiser.stack + raiser.bet) / Math.max(1, view.sb + view.bb + view.ante * view.n); cut = clamp(Math.max(cut, 0.1 + 0.9 / Math.max(rM, 1.5) * 0.45), 0.08, 0.6); }
  if (raiser && raiser.bet >= raiser.stack * 0 + bb * 12 && raises === 1) cut = Math.min(cut, 0.12); // big sizing = tight
  const potBefore = view.pot;
  const req = (L.toCall / (potBefore + L.toCall)) * (skill3(profile));
  const iters = c.fast ? 90 : Math.round(260 * (1 - err * 0.55));
  const cuts = new Array(Math.max(1, Math.min(nOpp, 3))).fill(0).map((_, k) => (k === 0 ? cut : 0.5));
  const eq = clamp(equity(view.hole, [], cuts, rng, iters) + gauss(rng) * err * 0.14, 0, 1);
  const commit = L.toCall / Math.max(1, me.stack + me.bet);
  const margin = 0.05 + profile.tight * 0.06 - aggr * 0.02 + (late < 0.5 ? 0.02 : 0) + (commit > 0.5 ? icm : icm * 0.3) + (commit > 0.6 ? 0.03 * (1 - profile.risk) : 0);
  const valueCut = [0, 0.03, 0.018, 0.012, 0.01][Math.min(raises, 4)] * (0.8 + aggr * 0.8);
  const canReraise = L.canRaise;
  if (canReraise && pct <= valueCut && M > 2) {
    if (rng() < 0.9) return reraise(view, L, raises, late);
  }
  // 3-bet bluff / squeeze with blockers & suited connectors
  if (canReraise && raises === 1 && M > 15 && pct > 0.06 && pct < 0.35 && late > 0.4 && rng() < profile.bluff * aggr * 0.45) return reraise(view, L, raises, late);
  if (canReraise && eq > 0.64 + (raises > 1 ? 0.04 : 0) && rng() < aggr * 0.7 && M > 3) return reraise(view, L, raises, late);
  if (L.toCall >= me.stack) { // call for everything: pure pot odds (+ICM pressure)
    return eq > req + 0.01 + icm + (raiser && raiser.allIn ? 0 : 0.01) ? { type: 'call' } : { type: 'fold' };
  }
  const callCap = 0.5 - profile.tight * 0.25 + (view.me === view.bbIdx ? 0.12 : 0);
  if (eq > req + margin && pct <= callCap) return { type: 'call' };
  // cheap defend from the big blind
  if (view.me === view.bbIdx && L.toCall <= bb * 2.5 && pct <= 0.45 && eq > req - 0.01 * (1 - profile.tight)) return { type: 'call' };
  return { type: 'fold' };
}
function rawOpen(view, L, sizeBB) {
  if (!L.canRaise) return L.canCheck ? { type: 'check' } : { type: 'call' };
  const to = Math.round(sizeBB * view.bb);
  if (to >= L.maxRaiseTo * 0.8) return { type: 'allin' };
  return { type: 'raise', to: Math.max(L.minRaiseTo, to) };
}
function reraise(view, L, raises, late) {
  const mult = late > 0.5 ? 3 : 3.6;
  const to = Math.round(view.currentBet * mult + view.bb * (raises - 1) * 2);
  if (to >= L.maxRaiseTo * 0.45) return { type: 'allin' };
  return { type: 'raise', to: Math.max(L.minRaiseTo, to) };
}

function postflop(view, profile, rng, ctx, L, c) {
  const { me, nOpp, late, icm, err, loosen, aggr, fast } = c;
  const board = view.board;
  const cuts = opponentCuts(view, profile, ctx);
  const iters = Math.round((fast ? 70 : 340) * (1 - err * 0.5) / (1 + 0.35 * (nOpp - 1)) );
  const cap = cuts.length; // everyone still in
  const eq = clamp(equity(view.hole, board, cuts, rng, Math.max(40, iters)) + gauss(rng) * err * 0.17, 0, 1);
  const wet = boardWetness(board);
  const draws = drawInfo(view.hole, board);
  const drawy = draws.flush || draws.straight;
  const pot = view.pot;
  const stack = me.stack;
  const pfAggressor = view.history.filter((h) => h.street === 'preflop' && (h.type === 'raise' || h.type === 'bet')).pop()?.p === view.me;
  const spr = stack / Math.max(1, pot);

  if (L.toCall === 0) {
    // ---- may bet or check ----
    const valueThr = 0.60 - aggr * 0.08 + (cap - 1) * 0.04;
    if (L.canRaise) {
      if (eq >= valueThr) {
        const trap = eq > 0.9 && board.length < 5 && rng() < (1 - aggr) * 0.4 * (1 - wet);
        if (trap) return { type: 'check' };
        const frac = eq > 0.85 ? 0.7 + wet * 0.3 : eq > 0.7 ? 0.55 + wet * 0.3 : 0.4 + wet * 0.2;
        const thin = eq < 0.66 && rng() > aggr + 0.3; // thin value: sometimes check
        if (!thin) return sizeRaise(view, L, clamp(frac + (rng() - 0.5) * 0.15, 0.25, 1.1));
      }
      // continuation bet
      if (pfAggressor && view.street === 'flop' && cap <= 2 && rng() < 0.3 + aggr * 0.45 + (late > 0.5 ? 0.05 : 0)) {
        if (eq > 0.3 || rng() < profile.bluff * 1.4 + 0.1) return sizeRaise(view, L, 0.33 + wet * 0.3);
      }
      // semi-bluff
      if (drawy && cap <= 2 && rng() < 0.15 + profile.bluff * aggr * 1.1) return sizeRaise(view, L, 0.55 + rng() * 0.2);
      // pure bluff
      if (eq < 0.35 && cap <= 2 && spr > 0.7 && rng() < profile.bluff * 0.22 * (0.5 + late)) return sizeRaise(view, L, 0.5 + rng() * 0.25);
    }
    return { type: 'check' };
  }

  // ---- facing a bet ----
  const toCall = L.toCall;
  const req = (toCall / (pot + toCall)) * skill3(profile);
  const commit = toCall / Math.max(1, stack + me.bet);
  const bigBet = toCall > pot * 0.9;
  let margin = 0.04 + profile.tight * 0.05 - aggr * 0.015 + (bigBet ? 0.04 * (1 - profile.risk) : 0);
  if (commit > 0.5 || toCall >= stack) margin += icm;
  if (drawy && view.street !== 'river' && toCall < stack) margin -= 0.04; // implied odds
  margin -= (loosen - 1) * 0.1;
  const aggAdapt = (() => { // exploit very aggressive opponents by calling a little wider
    const st = ctx.stats?.[view.players[view.lastAggressor]?.id];
    if (!st || st.hands < 8 || profile.adapt <= 0) return 0;
    const af = st.bets / Math.max(1, st.calls);
    return af > 2 ? 0.035 * profile.adapt : af < 0.4 ? -0.03 * profile.adapt : 0;
  })();
  margin -= aggAdapt;
  // raise for value / semi-bluff / bluff
  if (L.canRaise && toCall < stack) {
    if (eq > 0.78 && rng() < 0.45 + aggr * 0.5) return sizeRaise(view, L, 0.7 + wet * 0.3);
    if (eq > 0.9 && rng() < 0.9) return sizeRaise(view, L, 0.85);
    if (drawy && view.street !== 'river' && cap === 1 && eq > req && rng() < profile.bluff * aggr * 0.5) return sizeRaise(view, L, 0.75);
    if (eq < 0.22 && cap === 1 && view.street !== 'river' && rng() < profile.bluff * 0.07 * (0.5 + late)) return sizeRaise(view, L, 0.8);
  }
  if (toCall >= stack) return eq > req + 0.01 + icm ? { type: 'call' } : { type: 'fold' };
  return eq > req + margin ? { type: 'call' } : { type: 'fold' };
}
