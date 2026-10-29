// Computer player: exact expectation over the 32 hold masks (two-roll lookahead) using
// a "points above par" evaluation of every box, so it also knows what to sacrifice.
import { UPPER, CATS, allowedCats, scoreFor, isFiveOfAKind, FIXED } from './rules.js';

const PAR = { ones: 2.5, twos: 5.5, threes: 8.5, fours: 12, fives: 15.5, sixes: 19, three: 20, four: 12, full: 20, small: 24, large: 22, yahtzee: 14, chance: 22 };

// Value of putting `pts` into `cat`: points above par plus a pull towards the upper bonus.
export function boxValue(cat, pts) {
  let v = pts - PAR[cat];
  const ui = UPPER.indexOf(cat);
  if (ui >= 0) v += (pts - 3 * (ui + 1)) * 0.55;
  return v;
}

function bestBox(sheet, dice) {
  let best = -Infinity;
  let cat = null;
  for (const c of allowedCats(sheet, dice)) {
    const v = boxValue(c, scoreFor(sheet, c, dice));
    if (v > best) {
      best = v;
      cat = c;
    }
  }
  if (isFiveOfAKind(dice) && sheet.scores.yahtzee === FIXED.yahtzee) best += 100;
  return { value: best, cat };
}

export function chooseCategory(sheet, dice) {
  return bestBox(sheet, dice).cat;
}

// Dice multisets are keyed by their face counts in base 6 (counts never exceed 5).
const POW = [1, 6, 36, 216, 1296, 7776];
const keyOf = (arr) => arr.reduce((k, f) => k + POW[f - 1], 0);
function decode(key) {
  const out = [];
  for (let f = 1; f <= 6; f++) {
    const c = Math.floor(key / POW[f - 1]) % 6;
    for (let i = 0; i < c; i++) out.push(f);
  }
  return out;
}

// outcomes of rolling k dice as multisets with probabilities
const OUT = [];
(function build() {
  for (let k = 0; k <= 5; k++) {
    const map = new Map();
    const rec = (left, key) => {
      if (left === 0) return map.set(key, (map.get(key) || 0) + 1);
      for (let f = 1; f <= 6; f++) rec(left - 1, key + POW[f - 1]);
    };
    rec(k, 0);
    const total = 6 ** k;
    OUT[k] = [...map.entries()].map(([key, n]) => ({ key, p: n / total }));
  }
})();

// Returns { held: boolean[5], stop: boolean } for a state with `rollsLeft` > 0.
export function chooseHold(sheet, dice, rollsLeft) {
  const v0 = new Map();
  const V0 = (key) => {
    let v = v0.get(key);
    if (v === undefined) {
      v = bestBox(sheet, decode(key)).value;
      v0.set(key, v);
    }
    return v;
  };
  const memo = [null, new Map(), new Map()];
  const masks = [];
  for (let m = 0; m < 31; m++) masks.push(m);
  // best expected value with r rerolls still available
  const V = (key, r) => {
    if (r === 0) return V0(key);
    let v = memo[r].get(key);
    if (v === undefined) {
      const d = decode(key);
      v = V0(key);
      for (const m of masks) v = Math.max(v, E(d, m, r));
      memo[r].set(key, v);
    }
    return v;
  };
  const E = (d, mask, r) => {
    let kk = 0;
    let n = 0;
    for (let i = 0; i < 5; i++)
      if (mask & (1 << i)) {
        kk += POW[d[i] - 1];
        n++;
      }
    let e = 0;
    for (const o of OUT[5 - n]) e += o.p * V(kk + o.key, r - 1);
    return e;
  };
  const standing = V0(keyOf(dice));
  let bestMask = 31;
  let bestVal = standing;
  for (const m of masks) {
    const e = E(dice, m, rollsLeft);
    if (e > bestVal + 1e-9) {
      bestVal = e;
      bestMask = m;
    }
  }
  return { held: [0, 1, 2, 3, 4].map((i) => !!(bestMask & (1 << i))), stop: bestMask === 31 };
}

export { CATS };
