// Bisca computer player. It only sees a `view` (viewFor): own hand, the face-up trunfo card and the
// cards played so far. Hidden cards are inferred by counting (nothing is peeked). In the final phase of a
// 2-player game the opponent's hand is exactly the set of unseen cards, so that endgame is solved exactly.
import { suitOf, rankOf, pts, mk } from './deck.js';
import { legalFor, trickWinnerPlay, teamOf, SEVEN } from './rules.js';

export function hyper0(N, k, n) {
  if (k <= 0 || n <= 0) return 1;
  if (N - k < n) return 0;
  let p = 1;
  for (let i = 0; i < n; i++) p *= (N - k - i) / (N - i);
  return p;
}

export const TUNE = { bank: 0.6, nt: 0.08, tb: 4, tr: 0.6, tbEnd: 0.4, trEnd: 0.15, fut: 0.3, bonus: 1.0, bonusEnd: 0.3, later: 0.9, will: 0.35 };

export function analyse(view) {
  const me = view.seat;
  const played = new Set();
  for (const t of view.tricks) for (const x of t.plays) played.add(x.c);
  for (const x of view.trick) played.add(x.c);
  const mine = new Set(view.hand);
  const forced = view.stockCount === 0;
  const certain = Array.from({ length: view.n }, () => []);
  // face-up trunfo: in the stock while it lasts, afterwards with whoever drew it
  const inStock = view.stockCount > 0;
  if (!inStock && view.trumpDrawnBy >= 0 && view.trumpDrawnBy !== me && !played.has(view.trumpCard) && !mine.has(view.trumpCard)) certain[view.trumpDrawnBy].push(view.trumpCard);
  for (const sw of view.swaps) if (sw.seat !== me && !played.has(sw.got) && !mine.has(sw.got) && !certain[sw.seat].includes(sw.got)) certain[sw.seat].push(sw.got);
  const known = new Set();
  for (const l of certain) for (const c of l) known.add(c);
  const unseen = [];
  for (let c = 0; c < 40; c++) if (!played.has(c) && !mine.has(c) && !(inStock && c === view.trumpCard)) unseen.push(c);
  const pool = unseen.filter((c) => !known.has(c));
  const voids = Array.from({ length: view.n }, () => new Set());
  const scan = (plays) => {
    const led = suitOf(plays[0].c);
    for (let i = 1; i < plays.length; i++) if (suitOf(plays[i].c) !== led) voids[plays[i].p].add(led);
  };
  for (const t of view.tricks) if (t.forced) scan(t.plays);
  if (view.trick.length && forced) scan(view.trick);
  return { me, n: view.n, trump: view.trump, forced, unseen, pool, certain, voids, left: view.handSizes, avg: unseen.length ? unseen.reduce((a, c) => a + pts(c), 0) / unseen.length : 0, stockCount: view.stockCount };
}

const beats = (x, best, trump) => (suitOf(x) === suitOf(best) ? rankOf(x) > rankOf(best) : suitOf(x) === trump && suitOf(best) !== trump);

// Chance that seat o (yet to play) holds, and can legally play, a card that beats `best`.
export function pBeat(a, o, best, led) {
  const trump = a.trump;
  const nHand = a.left[o];
  if (nHand <= 0) return 0;
  const cert = a.certain[o];
  const nr = nHand - cert.length;
  if (!a.forced) {
    if (cert.some((x) => beats(x, best, trump))) return 1;
    return 1 - hyper0(a.pool.length, a.pool.filter((x) => beats(x, best, trump)).length, nr);
  }
  // forced phase: must follow suit when able
  const bs = suitOf(best);
  const br = rankOf(best);
  const pool = a.pool.filter((c) => !a.voids[o].has(suitOf(c)));
  const N = pool.length;
  if (led === trump) {
    if (cert.some((x) => suitOf(x) === trump && rankOf(x) > br)) return 1;
    return 1 - hyper0(N, pool.filter((c) => suitOf(c) === trump && rankOf(c) > br).length, nr);
  }
  const ledCards = pool.filter((c) => suitOf(c) === led);
  const certHasLed = cert.some((x) => suitOf(x) === led);
  const pVoid = certHasLed ? 0 : hyper0(N, ledCards.length, nr);
  const trumps = pool.filter((c) => suitOf(c) === trump);
  const N2 = N - ledCards.length;
  const certTrump = cert.filter((x) => suitOf(x) === trump);
  if (bs === trump) {
    const hi = trumps.filter((c) => rankOf(c) > br).length;
    const certBeats = certTrump.some((x) => rankOf(x) > br);
    return Math.min(1, pVoid * (certBeats ? 1 : 1 - hyper0(N2, hi, nr)));
  }
  const certLedBeats = cert.some((x) => suitOf(x) === led && rankOf(x) > br);
  if (certLedBeats) return 1;
  const p1 = 1 - hyper0(N, ledCards.filter((c) => rankOf(c) > br).length, nr);
  const p2 = pVoid * (certTrump.length ? 1 : 1 - hyper0(N2, trumps.length, nr));
  return Math.min(1, p1 + p2);
}

const kappa = (a, c) => {
  if (suitOf(c) === a.trump) return a.forced ? TUNE.tbEnd + TUNE.trEnd * rankOf(c) : TUNE.tb + TUNE.tr * rankOf(c);
  return TUNE.nt * rankOf(c);
};

export function scoreCard(view, a, c) {
  const me = a.me;
  const n = a.n;
  const trick = view.trick;
  const after = trick.concat({ p: me, c });
  const win = trickWinnerPlay(after, a.trump);
  const led = suitOf(after[0].c);
  const rest = [];
  for (let k = 1; after.length + rest.length < n; k++) rest.push((me + k) % n);
  const others = trick.reduce((s, x) => s + pts(x.c), 0) + rest.length * a.avg * TUNE.fut;
  const pc = pts(c);
  const myTeam = teamOf(me);
  let P;
  if (teamOf(win.p) === myTeam) {
    let safe = 1;
    for (const o of rest) {
      if (teamOf(o) === myTeam) continue;
      let r = pBeat(a, o, win.c, led);
      if (!a.forced && !trick.length) r *= TUNE.will + (1 - TUNE.will) * Math.min(1, (pc + 2) / 8); // opponents rarely spend a trunfo on junk
      safe *= 1 - r;
    }
    P = safe;
  } else {
    const partner = n === 4 ? (me + 2) % 4 : -1;
    if (partner >= 0 && rest.includes(partner)) P = pBeat(a, partner, win.c, led) * (rest.indexOf(partner) < rest.length - 1 ? TUNE.later - 0.2 : TUNE.later);
    else P = 0;
  }
  const bonus = a.forced ? TUNE.bonusEnd : TUNE.bonus;
  return (2 * P - 1) * others - (1 - P) * pc + (win.p === me ? 0 : TUNE.bank) * P * pc + bonus * P - kappa(a, c);
}

// ---- exact endgame for 2 players (stock empty, opponent hand = unseen cards) ----
function solve2(myHand, oppHand, myLead, ledCard, trump) {
  const memo = new Map();
  const key = (m, o, l, led) => m.slice().sort().join(',') + '|' + o.slice().sort().join(',') + '|' + (l ? 1 : 0) + '|' + (led ?? '');
  const rem = (arr, c) => arr.filter((x) => x !== c);
  const resolve = (first, a, b) => {
    // first: 'me' or 'opp' led; a = my card, b = opp card
    const trick = first === 'me' ? [{ p: 0, c: a }, { p: 1, c: b }] : [{ p: 1, c: b }, { p: 0, c: a }];
    const w = trickWinnerPlay(trick, trump).p;
    return { me: w === 0, pts: pts(a) + pts(b) };
  };
  const f = (m, o, l, led) => {
    if (!m.length && !o.length && led == null) return 0;
    const k = key(m, o, l, led);
    if (memo.has(k)) return memo.get(k);
    let best;
    if (led != null) {
      // opponent has led `led`; I answer
      best = -Infinity;
      for (const c of legalFor(m, [{ p: 1, c: led }], true)) {
        const r = resolve('opp', c, led);
        const v = (r.me ? r.pts : -r.pts) + f(rem(m, c), o, r.me, null);
        if (v > best) best = v;
      }
    } else if (l) {
      best = -Infinity;
      for (const c of m) {
        let worst = Infinity;
        for (const d of legalFor(o, [{ p: 0, c }], true)) {
          const r = resolve('me', c, d);
          const v = (r.me ? r.pts : -r.pts) + f(rem(m, c), rem(o, d), r.me, null);
          if (v < worst) worst = v;
        }
        if (worst > best) best = worst;
      }
    } else {
      // opponent leads: they pick the card that is worst for me
      best = Infinity;
      for (const d of o) {
        const v = f(m, rem(o, d), false, d);
        if (v < best) best = v;
      }
    }
    memo.set(k, best);
    return best;
  };
  // best card for me now
  let bestC = -1;
  let bestV = -Infinity;
  const cands = ledCard != null ? legalFor(myHand, [{ p: 1, c: ledCard }], true) : myHand;
  for (const c of cands) {
    let v;
    if (ledCard != null) {
      const r = resolve('opp', c, ledCard);
      v = (r.me ? r.pts : -r.pts) + f(rem(myHand, c), oppHand, r.me, null);
    } else {
      let worst = Infinity;
      for (const d of legalFor(oppHand, [{ p: 0, c }], true)) {
        const r = resolve('me', c, d);
        const val = (r.me ? r.pts : -r.pts) + f(rem(myHand, c), rem(oppHand, d), r.me, null);
        if (val < worst) worst = val;
      }
      v = worst;
    }
    if (v > bestV || (v === bestV && (rankOf(c) < rankOf(bestC) || (rankOf(c) === rankOf(bestC) && c < bestC)))) {
      bestV = v;
      bestC = c;
    }
  }
  return bestC;
}

export function wantsSwap(view) {
  if (!view.opts.swap7 || view.trick.length || view.stockCount < 2) return false;
  const seven = mk(view.trump, SEVEN);
  if (!view.hand.includes(seven) || view.trumpCard === seven) return false;
  return rankOf(view.trumpCard) > SEVEN; // only worth it for the Ace
}

export function chooseCard(view) {
  const forced = view.stockCount === 0;
  const legal = legalFor(view.hand, view.trick, forced);
  if (legal.length === 1) return legal[0];
  const a = analyse(view);
  if (view.n === 2 && forced && view.hand.length <= 6) {
    const opp = 1 - view.seat;
    if (a.unseen.length === view.handSizes[opp]) return solve2(view.hand, a.unseen, !view.trick.length, view.trick.length ? view.trick[0].c : null, view.trump);
  }
  let best = -1;
  let bestV = -Infinity;
  for (const c of legal) {
    const v = scoreCard(view, a, c);
    if (v > bestV + 1e-9 || (Math.abs(v - bestV) <= 1e-9 && (rankOf(c) < rankOf(best) || (rankOf(c) === rankOf(best) && c < best)))) {
      bestV = v;
      best = c;
    }
  }
  return best;
}

export function chooseAction(view) {
  if (wantsSwap(view)) return { type: 'swap' };
  return { type: 'play', c: chooseCard(view) };
}
