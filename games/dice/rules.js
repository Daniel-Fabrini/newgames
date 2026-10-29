// Five-dice poker rules engine: pure, deterministic and JSON-serialisable.
//
// Rule decisions (documented in the in-game rules screen too):
//  * 5 dice, up to 3 rolls per turn, any dice may be held/released between rolls.
//  * 13 turns, one per category. Invalid combination scores 0.
//  * Full House (25) needs exactly 3 + 2. Five of a kind is NOT a Full House on its own;
//    it only counts as one through the Joker rule (below).
//  * Upper bonus: +35 when the six upper boxes add up to 63 or more.
//  * Five of a Kind (Yahtzee box) = 50. Every further five of a kind while that box holds
//    50 earns +100 (never when the box holds 0).
//  * Joker (a five of a kind while the Five-of-a-Kind box is already filled, 50 or 0):
//      1. the matching upper box is mandatory if it is still open;
//      2. otherwise any open lower box, where Full House / Small / Large Straight score
//         their full value (25/30/40);
//      3. otherwise (all lower boxes full) any open upper box, scoring 0 unless it matches.
//  * The dice RNG is mulberry32 and its 32-bit state lives inside the game object, so a
//    saved match resumes with exactly the same future rolls.

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER = ['three', 'four', 'full', 'small', 'large', 'yahtzee', 'chance'];
export const CATS = [...UPPER, ...LOWER];
export const BONUS_NEED = 63;
export const BONUS_PTS = 35;
export const YAHTZEE_BONUS = 100;
export const FIXED = { full: 25, small: 30, large: 40, yahtzee: 50 };
export const MAX_ROLLS = 3;
export const NUM_DICE = 5;

// ---------- seedable RNG (mulberry32, state is a plain uint32) ----------
export function rngNext(state) {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

// ---------- dice helpers ----------
export const sum = (dice) => dice.reduce((a, b) => a + b, 0);

export function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

export const isFiveOfAKind = (dice) => dice.length === NUM_DICE && dice.every((d) => d === dice[0]);

export function longestRun(dice) {
  const c = counts(dice);
  let best = 0;
  let run = 0;
  for (let v = 1; v <= 6; v++) {
    run = c[v] ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

// Plain value of a category for these dice (no Joker, no sheet).
export function rawScore(cat, dice) {
  const c = counts(dice);
  const idx = UPPER.indexOf(cat);
  if (idx >= 0) return (idx + 1) * c[idx + 1];
  const max = Math.max(...c);
  switch (cat) {
    case 'three':
      return max >= 3 ? sum(dice) : 0;
    case 'four':
      return max >= 4 ? sum(dice) : 0;
    case 'full':
      return c.includes(3) && c.includes(2) ? FIXED.full : 0;
    case 'small':
      return longestRun(dice) >= 4 ? FIXED.small : 0;
    case 'large':
      return longestRun(dice) >= 5 ? FIXED.large : 0;
    case 'yahtzee':
      return isFiveOfAKind(dice) ? FIXED.yahtzee : 0;
    case 'chance':
      return sum(dice);
    default:
      throw new Error('unknown category ' + cat);
  }
}

// ---------- sheet ----------
export function createSheet() {
  const scores = {};
  for (const c of CATS) scores[c] = null;
  return { scores, yb: 0 }; // yb = number of Yahtzee bonuses earned
}

export const openCats = (sheet) => CATS.filter((c) => sheet.scores[c] === null);
export const isSheetFull = (sheet) => openCats(sheet).length === 0;
export const upperSum = (sheet) => UPPER.reduce((a, c) => a + (sheet.scores[c] || 0), 0);
export const upperBonus = (sheet) => (upperSum(sheet) >= BONUS_NEED ? BONUS_PTS : 0);
export const lowerSum = (sheet) => LOWER.reduce((a, c) => a + (sheet.scores[c] || 0), 0);
export const yahtzeeBonusPoints = (sheet) => sheet.yb * YAHTZEE_BONUS;
export const totalScore = (sheet) => upperSum(sheet) + upperBonus(sheet) + lowerSum(sheet) + yahtzeeBonusPoints(sheet);

// ---------- Joker ----------
export const isJoker = (sheet, dice) => isFiveOfAKind(dice) && sheet.scores.yahtzee !== null;

// Categories the player may choose for these dice (Joker restricts the choice).
export function allowedCats(sheet, dice) {
  const open = openCats(sheet);
  if (!isJoker(sheet, dice)) return open;
  const upperBox = UPPER[dice[0] - 1];
  if (sheet.scores[upperBox] === null) return [upperBox];
  const lower = open.filter((c) => LOWER.includes(c));
  return lower.length ? lower : open;
}

// Points this category would earn right now (null when it is not allowed or already used).
export function scoreFor(sheet, cat, dice) {
  if (sheet.scores[cat] !== null) return null;
  if (!allowedCats(sheet, dice).includes(cat)) return null;
  if (isJoker(sheet, dice) && LOWER.includes(cat)) {
    if (cat === 'full' || cat === 'small' || cat === 'large') return FIXED[cat];
    if (cat === 'three' || cat === 'four' || cat === 'chance') return sum(dice);
  }
  return rawScore(cat, dice);
}

// {cat: points|null} for every category (null = used or not allowed).
export function potentials(sheet, dice) {
  const out = {};
  for (const c of CATS) out[c] = scoreFor(sheet, c, dice);
  return out;
}

// ---------- game ----------
export function newGame({ players, seed }) {
  return {
    v: 1,
    players: players.map((p) => ({ name: p.name, ai: !!p.ai, sheet: createSheet() })),
    cur: 0,
    turn: 1,
    dice: [1, 2, 3, 4, 5],
    held: [false, false, false, false, false],
    rollsLeft: MAX_ROLLS,
    rng: (seed >>> 0) || 1,
    over: false,
  };
}

export const hasRolled = (g) => g.rollsLeft < MAX_ROLLS;
export const currentSheet = (g) => g.players[g.cur].sheet;

export function roll(g) {
  if (g.over) throw new Error('game over');
  if (g.rollsLeft <= 0) throw new Error('no rolls left');
  if (g.rollsLeft === MAX_ROLLS) g.held = g.held.map(() => false);
  const changed = [];
  for (let i = 0; i < NUM_DICE; i++) {
    if (g.held[i]) continue;
    const [r, s] = rngNext(g.rng);
    g.rng = s;
    g.dice[i] = 1 + Math.floor(r * 6);
    changed.push(i);
  }
  g.rollsLeft--;
  return changed;
}

export function toggleHold(g, i) {
  if (g.over || g.rollsLeft === MAX_ROLLS || g.rollsLeft === 0) return false;
  g.held[i] = !g.held[i];
  return true;
}

export function setHeld(g, mask) {
  if (g.over || g.rollsLeft === MAX_ROLLS || g.rollsLeft === 0) return false;
  g.held = mask.map(Boolean);
  return true;
}

// Fill a category with the current dice. Returns a description of what happened.
export function scoreCategory(g, cat) {
  if (g.over) throw new Error('game over');
  if (!hasRolled(g)) throw new Error('roll first');
  const sheet = currentSheet(g);
  const pts = scoreFor(sheet, cat, g.dice);
  if (pts === null) throw new Error('category not available: ' + cat);
  const five = isFiveOfAKind(g.dice);
  const joker = isJoker(sheet, g.dice);
  const bonusYahtzee = five && sheet.scores.yahtzee === FIXED.yahtzee;
  const hadBonus = upperBonus(sheet) > 0;
  if (bonusYahtzee) sheet.yb++;
  sheet.scores[cat] = pts;
  const result = {
    player: g.cur,
    cat,
    points: pts,
    bonusYahtzee,
    joker,
    yahtzee: cat === 'yahtzee' && pts === FIXED.yahtzee,
    upperBonusUnlocked: !hadBonus && upperBonus(sheet) > 0,
  };
  // advance
  g.cur = (g.cur + 1) % g.players.length;
  if (g.players.every((p) => isSheetFull(p.sheet))) {
    g.over = true;
    g.cur = 0;
  } else if (g.cur === 0) g.turn++;
  g.rollsLeft = MAX_ROLLS;
  g.held = g.held.map(() => false);
  result.over = g.over;
  return result;
}

// Final ranking: [{index, name, ai, total, upper, bonus, lower, yb, rank, winner}]
export function summary(g) {
  const rows = g.players.map((p, index) => ({
    index,
    name: p.name,
    ai: p.ai,
    upper: upperSum(p.sheet),
    bonus: upperBonus(p.sheet),
    lower: lowerSum(p.sheet),
    yb: p.sheet.yb,
    ybPoints: yahtzeeBonusPoints(p.sheet),
    yahtzee: p.sheet.scores.yahtzee === FIXED.yahtzee,
    total: totalScore(p.sheet),
  }));
  const best = Math.max(...rows.map((r) => r.total));
  rows.forEach((r) => {
    r.winner = r.total === best;
    r.rank = 1 + rows.filter((o) => o.total > r.total).length;
  });
  return rows;
}

export const serialize = (g) => JSON.stringify(g);
export const restore = (s) => JSON.parse(s);
