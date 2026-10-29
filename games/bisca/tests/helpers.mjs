import * as R from '../rules.js';
import { chooseAction } from '../ai.js';
import { suitOf, rankOf, pts } from '../deck.js';

export const mulberry = (a) => () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// A bot is view → {type:'play', c} | {type:'swap'}
export const randomBot = (rnd) => (view) => {
  const l = R.legalFor(view.hand, view.trick, view.stockCount === 0);
  return { type: 'play', c: l[Math.floor(rnd() * l.length)] };
};
export const greedyBot = (view) => {
  const l = R.legalFor(view.hand, view.trick, view.stockCount === 0).sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  if (!view.trick.length) return { type: 'play', c: l.find((c) => suitOf(c) !== view.trump && pts(c) === 0) ?? l[0] };
  const win = l.filter((c) => R.trickWinnerPlay(view.trick.concat({ p: view.seat, c }), view.trump).p === view.seat);
  if (win.length) return { type: 'play', c: win[0] };
  return { type: 'play', c: l.slice().sort((a, b) => pts(a) - pts(b) || rankOf(a) - rankOf(b))[0] };
};
export const aiBot = chooseAction;

export function stepBot(s, bots) {
  const v = R.viewFor(s, s.turn);
  const act = bots[s.turn](v);
  if (act.type === 'swap') R.swapSeven(s, s.turn);
  else R.playCard(s, s.turn, act.c);
}
export function playMatch(seed, bots, opts = {}) {
  const s = R.newMatch(opts, seed);
  let guard = 0;
  for (;;) {
    if (++guard > 50000) throw new Error('did not terminate');
    if (s.phase === 'matchEnd') return s;
    if (s.phase === 'roundEnd') { R.nextRound(s); continue; }
    if (s.trick.length === s.n) { R.resolveTrick(s); R.checkInvariants(s); continue; }
    stepBot(s, bots);
  }
}
