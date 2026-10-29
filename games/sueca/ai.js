// Sueca computer player. It only ever sees a `view` (viewFor): its own hand plus the cards that have
// been played face up. Everything else (where the unseen cards are) is inferred from card counting
// and from revealed voids (a player who did not follow suit has no card of that suit), never peeked.
// The decision is deterministic given the view: each legal card is scored by expected value.
import { suitOf, rankOf, pts } from './deck.js';
import { legalFor, trickWinnerPlay, teamOf, partnerOf } from './rules.js';

// Probability that a hand of n cards drawn from a pool of N holds none of k given cards.
export function hyper0(N, k, n) {
  if (k <= 0 || n <= 0) return 1;
  if (N - k < n) return 0;
  let p = 1;
  for (let i = 0; i < n; i++) p *= (N - k - i) / (N - i);
  return p;
}

export function analyse(view) {
  const played = new Set();
  for (const t of view.tricks) for (const x of t.plays) played.add(x.c);
  for (const x of view.trick) played.add(x.c);
  const mine = new Set(view.hand);
  const unseen = [];
  for (let c = 0; c < 40; c++) if (!played.has(c) && !mine.has(c)) unseen.push(c);
  const voids = [new Set(), new Set(), new Set(), new Set()];
  const scan = (plays) => {
    const led = suitOf(plays[0].c);
    for (let i = 1; i < plays.length; i++) if (suitOf(plays[i].c) !== led) voids[plays[i].p].add(led);
  };
  for (const t of view.tricks) scan(t.plays);
  if (view.trick.length) scan(view.trick);
  const left = [0, 1, 2, 3].map((o) => 10 - view.tricks.length - (view.trick.some((x) => x.p === o) ? 1 : 0));
  const trumpHidden = view.dealer !== view.seat && !played.has(view.trumpCard) && !mine.has(view.trumpCard);
  return { unseen, voids, left, trumpHidden, trump: view.trump, dealer: view.dealer, trumpCard: view.trumpCard, me: view.seat, avg: unseen.length ? unseen.reduce((a, c) => a + pts(c), 0) / unseen.length : 0 };
}

// Chance that seat `o` (yet to play) can and will beat the card `best` in a trick led in suit `led`.
export function pBeat(a, o, best, led) {
  const trump = a.trump;
  const bs = suitOf(best);
  const br = rankOf(best);
  const certain = o === a.dealer && a.trumpHidden ? [a.trumpCard] : [];
  const nr = a.left[o] - certain.length;
  const pool = a.unseen.filter((c) => !(a.trumpHidden && c === a.trumpCard) && !a.voids[o].has(suitOf(c)));
  const N = pool.length;
  if (a.left[o] <= 0) return 0;
  if (led === trump) {
    if (certain.length && rankOf(certain[0]) > br) return 1;
    const hi = pool.filter((c) => suitOf(c) === trump && rankOf(c) > br).length;
    return 1 - hyper0(N, hi, nr);
  }
  const ledCards = pool.filter((c) => suitOf(c) === led);
  const pVoid = hyper0(N, ledCards.length, nr);
  const trumps = pool.filter((c) => suitOf(c) === trump);
  const N2 = N - ledCards.length;
  if (bs === trump) {
    const certainBeats = certain.length && rankOf(certain[0]) > br;
    const hi = trumps.filter((c) => rankOf(c) > br).length;
    return Math.min(1, pVoid * (certainBeats ? 1 : 1 - hyper0(N2, hi, nr)));
  }
  const hiLed = ledCards.filter((c) => rankOf(c) > br).length;
  const p1 = 1 - hyper0(N, hiLed, nr);
  const p2 = pVoid * (certain.length ? 1 : 1 - hyper0(N2, trumps.length, nr));
  return Math.min(1, p1 + p2);
}

export const TUNE = { bank: 0.6, nt: 0.1, tb: 4, tr: 0.6, fut: 0.3, bonus: 0.6, later: 0.9 };
const kappa = (c, trump) => (suitOf(c) === trump ? TUNE.tb + TUNE.tr * rankOf(c) : TUNE.nt * rankOf(c));

export function scoreCard(view, a, c) {
  const me = view.seat;
  const trick = view.trick;
  const after = trick.concat({ p: me, c });
  const win = trickWinnerPlay(after, view.trump);
  const led = suitOf(after[0].c);
  const rest = [];
  for (let k = 1; after.length + rest.length < 4; k++) rest.push((me + k) & 3);
  const others = trick.reduce((s, x) => s + pts(x.c), 0) + rest.length * a.avg * TUNE.fut;
  const pc = pts(c);
  let P;
  if (teamOf(win.p) === teamOf(me)) {
    let safe = 1;
    for (const o of rest) if (teamOf(o) !== teamOf(me)) safe *= 1 - pBeat(a, o, win.c, led);
    P = safe;
  } else {
    const pr = partnerOf(me);
    if (rest.includes(pr)) {
      // partner may still overtake; opponents after the partner may then answer
      let later = TUNE.later;
      if (rest.indexOf(pr) < rest.length - 1) later = 0.7;
      P = pBeat(a, pr, win.c, led) * later;
    } else P = 0;
  }
  return (2 * P - 1) * others - (1 - P) * pc + (win.p === me ? 0 : TUNE.bank) * P * pc + TUNE.bonus * P - kappa(c, view.trump);
}

export function chooseCard(view) {
  const legal = legalFor(view.hand, view.trick);
  if (legal.length === 1) return legal[0];
  const a = analyse(view);
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
