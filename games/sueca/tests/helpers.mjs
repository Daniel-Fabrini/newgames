import * as R from '../rules.js';
import { chooseCard } from '../ai.js';
import { suitOf, rankOf } from '../deck.js';

export const randomBot = (rnd) => (view) => {
  const l = R.legalFor(view.hand, view.trick);
  return l[Math.floor(rnd() * l.length)];
};
// Naive: win with the lowest winning card, else dump the lowest; lead highest non-trump.
export const greedyBot = (view) => {
  const l = R.legalFor(view.hand, view.trick);
  const asc = l.slice().sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  if (!view.trick.length) return asc[asc.length - 1];
  const cur = R.trickWinnerPlay(view.trick, view.trump);
  const winning = asc.filter((c) => R.trickWinnerPlay(view.trick.concat({ p: view.seat, c }), view.trump).p === view.seat);
  return winning.length ? winning[0] : asc[0];
};
export function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Play a whole match with bots[seat](view) → card. Returns final state.
export function playMatch(seed, bots, opts = {}) {
  const s = R.newMatch(opts, seed);
  let guard = 0;
  for (;;) {
    if (++guard > 20000) throw new Error('did not terminate');
    if (s.phase === 'matchEnd') return s;
    if (s.phase === 'roundEnd') { R.nextRound(s); continue; }
    if (s.trick.length === 4) { R.resolveTrick(s); R.checkInvariants(s); continue; }
    const v = R.viewFor(s, s.turn);
    const c = bots[s.turn](v);
    R.playCard(s, s.turn, c);
  }
}
export function playRound(seed, bots, dealer) {
  return playMatch(seed, bots, { single: true, dealer });
}
