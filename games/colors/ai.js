// Color Rush computer players. They only ever look at a seat's public view (own hand + what every
// player can see: the discard pile, counts, public draws/passes) — never at hidden cards.
//   createMemory(seat) → observe(mem, publicEvent, view) keeps a light record for the Hard level.
//   decide(view, level, mem, rand) → { type: 'play'|'draw'|'pass'|'startColor'|'challenge', ... }
import * as R from './rules.js';

export const LEVELS = ['easy', 'normal', 'hard'];
const CALL_P = { easy: 0.5, normal: 0.88, hard: 0.97 }; // chance of remembering to call ONE! in time
const CATCH_P = { easy: 0.3, normal: 0.65, hard: 0.92 }; // chance of catching a forgetful opponent
export const unoCallChance = (level) => CALL_P[level] ?? 0.88;
export const catchChance = (level) => CATCH_P[level] ?? 0.65;

export function createMemory(seat, n = 4) {
  return {
    seat,
    seen: new Set(), // card ids that everybody has seen go by since the last reshuffle
    noColor: Array.from({ length: n }, () => [false, false, false, false]),
    want: Array.from({ length: n }, () => [0, 0, 0, 0]),
  };
}

export function observe(mem, e, view) {
  switch (e.t) {
    case 'flip':
      mem.seen.add(e.card);
      break;
    case 'play': {
      mem.seen.add(e.card);
      const c = R.cardOf(e.card);
      if (c.color === 4) mem.want[e.p][e.color]++;
      else mem.noColor[e.p][c.color] = false;
      break;
    }
    case 'pass':
      if (e.drew && e.color >= 0 && e.color < 4) mem.noColor[e.p][e.color] = true;
      break;
    case 'reshuffle':
      mem.seen = new Set([view.top]);
      break;
    default:
  }
}

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const maxIdx = (arr, rand) => {
  const m = Math.max(...arr);
  return pick(
    arr.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0),
    rand,
  );
};

function colourCounts(ids) {
  const c = [0, 0, 0, 0];
  for (const id of ids) {
    const k = R.colorOf(id);
    if (k < 4) c[k]++;
  }
  return c;
}

function nextOpp(view) {
  return (view.seat + view.dir + view.n * 2) % view.n;
}
function threats(view) {
  return view.counts.map((c, i) => (i !== view.seat && c <= 2 ? i : -1)).filter((i) => i >= 0);
}

function chooseColor(view, level, mem, handAfter, rand) {
  const cc = colourCounts(handAfter);
  if (level === 'easy') return Math.floor(rand() * 4);
  if (level === 'normal' || !mem) return cc.every((v) => v === 0) ? Math.floor(rand() * 4) : maxIdx(cc, rand);
  const nx = nextOpp(view);
  const sc = cc.map((v, i) => v * 2 + (mem.noColor[nx][i] ? 2.5 : 0) - mem.want[nx][i] * 1.5 + (R.cardOf(view.top).color === i ? -0.2 : 0) + rand() * 0.3);
  return maxIdx(sc, rand);
}

// chance (0..1) that the player who just played Wild Draw Four holds a card of prevColor
function pHasColor(view, mem, target, color) {
  const mine = new Set(view.hand);
  let U = 0;
  let uc = 0;
  for (let id = 0; id < R.DECK_SIZE; id++) {
    if (mine.has(id) || (mem && mem.seen.has(id))) continue;
    U++;
    if (R.colorOf(id) === color) uc++;
  }
  const k = Math.min(view.counts[target], U);
  if (k <= 0 || uc === 0) return 0;
  let pNone = 1;
  for (let i = 0; i < k; i++) pNone *= Math.max(0, (U - uc - i) / (U - i));
  let p = 1 - pNone;
  if (mem && mem.noColor[target][color]) p *= 0.35;
  return p;
}

function scorePlay(view, level, mem, id, rand) {
  const c = R.cardOf(id);
  const hand = view.hand;
  const rest = hand.filter((x) => x !== id);
  const cc = colourCounts(hand);
  const nx = nextOpp(view);
  const th = threats(view);
  const nextHot = view.counts[nx] <= 3;
  let s = rand() * 0.6;
  if (c.kind <= 9) s += 1 + c.kind / 6 + (c.color < 4 ? cc[c.color] * 0.5 : 0);
  else if (c.kind === R.K_SKIP || c.kind === R.K_D2) s += 2.2 + (nextHot ? 3 : 0) + (c.color < 4 ? cc[c.color] * 0.3 : 0);
  else if (c.kind === R.K_REV) s += 1.8 + (view.n === 2 ? (nextHot ? 3 : 0) : th.includes(nx) ? 3 : 0) + (c.color < 4 ? cc[c.color] * 0.3 : 0);
  else if (c.kind === R.K_WILD) s -= rest.length <= 2 ? -3 : 4;
  else s -= rest.length <= 2 ? -3.5 : 5.5;
  if (level === 'hard') {
    if (th.length) {
      if (th.includes(nx) && (c.kind === R.K_SKIP || c.kind === R.K_D2 || c.kind === R.K_WD4)) s += 6;
      if (th.length && !th.includes(nx) && view.n > 2 && c.kind === R.K_REV && th.includes((view.seat - view.dir + view.n * 2) % view.n)) s -= 3;
    }
    // prefer to keep the colour we hold most of active; avoid leaving a lone off-colour card stuck
    if (c.color < 4 && rest.length) {
      const rc = colourCounts(rest);
      s += rc[c.color] * 0.4;
    }
    if (mem && c.color < 4 && mem.noColor[nx][c.color]) s += 1.2; // next opponent cannot follow this colour
    // dumping points early matters against a possible fast finish
    s += R.cardPoints(id) / 25;
  }
  return s;
}

function bluffAllowed(view, level, rand) {
  if (!view.opts.challenges) return false;
  if (level === 'hard') {
    const th = threats(view);
    return th.includes(nextOpp(view)) && rand() < 0.35 ? true : rand() < 0.03;
  }
  if (level === 'normal') return rand() < 0.02;
  return false;
}

export function decide(view, level, mem, rand = Math.random) {
  const { seat } = view;
  if (view.phase === 'startColor') return { type: 'startColor', color: chooseColor(view, level, mem, view.hand, rand) };
  if (view.phase === 'challenge') {
    const target = view.chal.target;
    let yes;
    if (level === 'easy') yes = rand() < 0.12;
    else if (level === 'normal') yes = rand() < (view.counts[target] >= 5 ? 0.4 : 0.18);
    else yes = pHasColor(view, mem, target, view.chal.prevColor) * 0.85 + rand() * 0.05 > 0.42;
    return { type: 'challenge', yes };
  }
  let legal = view.legal;
  if (view.phase === 'drawn') {
    const id = view.drawn;
    const isWildCard = id !== null && R.isWild(id);
    if (level === 'hard' && isWildCard && view.hand.length > 3 && !threats(view).length && rand() < 0.6) return { type: 'pass' };
    const color = chooseColor(view, level, mem, view.hand.filter((x) => x !== id), rand);
    return { type: 'play', card: id, color };
  }
  if (view.pend > 0) {
    if (legal.length && (level !== 'easy' || rand() < 0.6)) {
      const id = legal[0];
      return { type: 'play', card: id, color: 0 };
    }
    return { type: 'draw' };
  }
  // wild draw four without a bluff licence: only when the colour is really missing
  const holdsActive = R.holdsColor({ hands: [view.hand], color: view.color }, 0, view.color);
  legal = legal.filter((id) => {
    if (!R.isWd4(id)) return true;
    if (!holdsActive) return true;
    return bluffAllowed(view, level, rand);
  });
  if (!legal.length) return { type: 'draw' };
  if (level === 'easy') {
    const id = pick(legal, rand);
    return { type: 'play', card: id, color: chooseColor(view, level, mem, view.hand.filter((x) => x !== id), rand) };
  }
  // hard: sometimes draw instead of burning the only wild while the hand is still big and nobody is close
  if (level === 'hard' && legal.every((id) => R.isWild(id)) && view.hand.length > 4 && !threats(view).length && rand() < 0.45) return { type: 'draw' };
  let best = legal[0];
  let bs = -Infinity;
  for (const id of legal) {
    const sc = scorePlay(view, level, mem, id, rand);
    if (sc > bs) {
      bs = sc;
      best = id;
    }
  }
  const color = chooseColor(view, level, mem, view.hand.filter((x) => x !== best), rand);
  return { type: 'play', card: best, color };
}
