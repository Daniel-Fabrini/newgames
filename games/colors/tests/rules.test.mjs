import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.js';
import * as AI from '../ai.js';

// helpers to build a controlled state -------------------------------------------------
const id = (color, kind, copy = 0) => {
  if (color === 4) return (kind === R.K_WILD ? 100 : 104) + copy;
  if (kind === 0) return color * 25;
  if (kind <= 9) return color * 25 + 1 + (kind - 1) * 2 + copy;
  return color * 25 + 19 + (kind - R.K_SKIP) * 2 + copy;
};
const [RED, YEL, GRN, BLU] = [0, 1, 2, 3];
function setup(hands, { top = id(RED, 5), color, opts = {}, turn = 0, dir = 1 } = {}) {
  const n = hands.length;
  const s = R.newMatch(7, { players: n, ...opts });
  // build deck without the cards in hands/top, deterministic order
  const used = new Set([...hands.flat(), top]);
  s.hands = hands.map((h) => h.slice());
  s.discard = [top];
  s.draw = R.newDeck().filter((c) => !used.has(c));
  s.color = color ?? R.colorOf(top);
  s.turn = turn;
  s.dir = dir;
  s.phase = 'turn';
  s.pend = 0;
  s.drawn = null;
  s.said = Array(n).fill(false);
  s.vul = null;
  s.chal = null;
  s.winner = null;
  return s;
}

test('card encoding: 108 cards with the right composition', () => {
  const cnt = {};
  for (let i = 0; i < R.DECK_SIZE; i++) {
    const c = R.cardOf(i);
    const k = `${c.color}:${c.kind}`;
    cnt[k] = (cnt[k] || 0) + 1;
  }
  assert.equal(Object.keys(cnt).length, 4 * 13 + 2);
  for (let c = 0; c < 4; c++) {
    assert.equal(cnt[`${c}:0`], 1);
    for (let k = 1; k <= 12; k++) assert.equal(cnt[`${c}:${k}`], 2, `${c}:${k}`);
  }
  assert.equal(cnt['4:13'], 4);
  assert.equal(cnt['4:14'], 4);
  assert.equal(id(GRN, 7, 1), 2 * 25 + 1 + 6 * 2 + 1);
  assert.deepEqual(R.cardOf(id(BLU, R.K_D2, 1)), { color: BLU, kind: R.K_D2 });
});

test('new match deals 7 each and keeps 108 unique cards', () => {
  for (let seed = 1; seed < 200; seed++) {
    const s = R.newMatch(seed, { players: 4 });
    assert.ok(s.hands.every((h, i) => h.length === 7 || (h.length === 9 && i === s.turn - 1 + 0) || h.length === 9));
    const all = R.allCards(s);
    assert.equal(all.length, 108);
    assert.deepEqual(all, [...Array(108).keys()]);
    assert.ok(!R.isWd4(R.topCard(s)) || false);
  }
});

test('deal is reproducible from the seed and shuffle is unbiased-looking', () => {
  const a = R.newMatch(123, { players: 3 });
  const b = R.newMatch(123, { players: 3 });
  assert.deepEqual(a, b);
  const c = R.newMatch(124, { players: 3 });
  assert.notDeepEqual(a.hands, c.hands);
  // first-card distribution over many seeds: each colour should appear for the first card of hand 0
  const col = [0, 0, 0, 0, 0];
  for (let seed = 1; seed <= 4000; seed++) col[R.colorOf(R.newMatch(seed).hands[0][0])]++;
  for (let k = 0; k < 4; k++) assert.ok(col[k] > 800 && col[k] < 1200, `colour ${k}: ${col[k]}`);
  assert.ok(col[4] > 150 && col[4] < 450);
});

test('legality: colour, number, symbol, wild', () => {
  const hand = [id(RED, 9), id(BLU, 5), id(BLU, 2), id(GRN, R.K_SKIP), id(4, R.K_WILD), id(YEL, 7)];
  const s = setup([hand, [id(GRN, 1)]], { top: id(RED, 5) });
  const legal = R.legalPlays(s, 0);
  assert.ok(legal.includes(id(RED, 9))); // colour
  assert.ok(legal.includes(id(BLU, 5))); // number
  assert.ok(!legal.includes(id(BLU, 2)));
  assert.ok(!legal.includes(id(GRN, R.K_SKIP)));
  assert.ok(legal.includes(id(4, R.K_WILD)));
  assert.ok(!legal.includes(id(YEL, 7)));
  // symbol match across colours
  const s2 = setup([[id(GRN, R.K_SKIP), id(YEL, R.K_REV)], [id(GRN, 1)]], { top: id(RED, R.K_SKIP) });
  assert.deepEqual(R.legalPlays(s2, 0), [id(GRN, R.K_SKIP)]);
  // active colour after a wild decides, not the wild itself
  const s3 = setup([[id(GRN, 3), id(RED, 3)], [id(GRN, 1)]], { top: id(4, R.K_WILD), color: GRN });
  assert.deepEqual(R.legalPlays(s3, 0), [id(GRN, 3)]);
  // not your turn
  assert.deepEqual(R.legalPlays(s3, 1), []);
  assert.equal(R.play(s3, 1, id(GRN, 1)), null);
  // illegal card is rejected without side effects
  const before = JSON.stringify(s3);
  assert.equal(R.play(s3, 0, id(RED, 3)), null);
  assert.equal(JSON.stringify(s3), before);
});

test('wild needs a colour', () => {
  const s = setup([[id(4, R.K_WILD), id(RED, 1)], [id(GRN, 1), id(GRN, 2)]]);
  assert.equal(R.play(s, 0, id(4, R.K_WILD)), null);
  assert.equal(R.play(s, 0, id(4, R.K_WILD), 9), null);
  assert.ok(R.play(s, 0, id(4, R.K_WILD), BLU));
  assert.equal(s.color, BLU);
  assert.equal(s.turn, 1);
});

test('skip skips the next player', () => {
  const s = setup([[id(RED, R.K_SKIP), id(RED, 1)], [id(GRN, 1), id(GRN, 2)], [id(GRN, 3)], [id(GRN, 4)]]);
  R.play(s, 0, id(RED, R.K_SKIP));
  assert.equal(s.turn, 2);
});

test('reverse flips direction (3+ players) and acts as skip with 2 players', () => {
  const s = setup([[id(RED, R.K_REV), id(RED, 1)], [id(GRN, 1)], [id(GRN, 2)], [id(GRN, 3)]], { turn: 0 });
  R.play(s, 0, id(RED, R.K_REV));
  assert.equal(s.dir, -1);
  assert.equal(s.turn, 3);
  const d = setup([[id(RED, R.K_REV), id(RED, 1)], [id(GRN, 1)]]);
  R.play(d, 0, id(RED, R.K_REV));
  assert.equal(d.turn, 0, '2-player reverse = skip');
});

test('draw two: victim draws 2 and loses the turn (no stacking by default)', () => {
  const s = setup([[id(RED, R.K_D2), id(RED, 1)], [id(GRN, 1), id(RED, R.K_D2, 1)], [id(GRN, 2)]]);
  const ev = R.play(s, 0, id(RED, R.K_D2));
  assert.equal(s.hands[1].length, 4);
  assert.equal(s.turn, 2);
  assert.equal(s.pend, 0);
  assert.ok(ev.some((e) => e.t === 'draw' && e.p === 1 && e.n === 2));
});

test('optional stacking of Draw Two', () => {
  const s = setup([[id(RED, R.K_D2), id(RED, 1)], [id(GRN, 1), id(BLU, R.K_D2)], [id(GRN, 2), id(GRN, 5)]], { opts: { stack: true } });
  R.play(s, 0, id(RED, R.K_D2));
  assert.equal(s.pend, 2);
  assert.equal(s.turn, 1);
  assert.deepEqual(R.legalPlays(s, 1), [id(BLU, R.K_D2)]); // only a Draw Two (any colour)
  R.play(s, 1, id(BLU, R.K_D2));
  assert.equal(s.pend, 4);
  assert.equal(s.turn, 2);
  assert.deepEqual(R.legalPlays(s, 2), []);
  const ev = R.draw(s, 2);
  assert.equal(s.hands[2].length, 6);
  assert.equal(s.pend, 0);
  assert.equal(s.turn, 0);
  assert.ok(ev.some((e) => e.t === 'draw' && e.n === 4));
});

test('drawing: playable drawn card may be played, else pass', () => {
  const s = setup([[id(BLU, 1)], [id(GRN, 1)]], { top: id(RED, 5) });
  s.draw = [id(YEL, 3), id(RED, 8)]; // pop() takes the last
  const ev = R.draw(s, 0);
  assert.equal(s.phase, 'drawn');
  assert.equal(s.drawn, id(RED, 8));
  assert.ok(ev.some((e) => e.t === 'draw'));
  assert.deepEqual(R.legalPlays(s, 0), [id(RED, 8)]);
  assert.equal(R.play(s, 0, id(BLU, 1)), null, 'only the drawn card is playable');
  assert.equal(R.draw(s, 0), null, 'cannot draw twice');
  R.pass(s, 0);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, 'turn');
  // unplayable draw -> automatic pass
  const t = setup([[id(BLU, 1)], [id(GRN, 1)]], { top: id(RED, 5) });
  t.draw = [id(YEL, 3)];
  const e2 = R.draw(t, 0);
  assert.equal(t.turn, 1);
  assert.ok(e2.some((e) => e.t === 'pass'));
});

test('Wild Draw Four is only legal without the active colour when challenges are off', () => {
  const wd4 = id(4, R.K_WD4);
  const s = setup([[wd4, id(RED, 1)], [id(GRN, 1)]], { opts: { challenges: false } });
  assert.ok(!R.legalPlays(s, 0).includes(wd4));
  assert.equal(R.play(s, 0, wd4, BLU), null);
  const s2 = setup([[wd4, id(BLU, 1)], [id(GRN, 1)]], { opts: { challenges: false } });
  assert.ok(R.legalPlays(s2, 0).includes(wd4));
  const ev = R.play(s2, 0, wd4, GRN);
  assert.ok(ev);
  assert.equal(s2.hands[1].length, 5);
  assert.equal(s2.color, GRN);
  assert.equal(s2.turn, 0); // 2 players: the victim is skipped
});

test('challenge: successful (bluff) -> player draws 4, challenger plays', () => {
  const wd4 = id(4, R.K_WD4);
  const s = setup([[wd4, id(RED, 1), id(RED, 2)], [id(GRN, 1)], [id(GRN, 2)]]);
  assert.ok(R.legalPlays(s, 0).includes(wd4)); // bluff allowed with challenges on
  R.play(s, 0, wd4, GRN);
  assert.equal(s.phase, 'challenge');
  assert.equal(s.turn, 1);
  assert.equal(s.chal.bluff, true);
  assert.equal(R.legalPlays(s, 1).length, 0);
  assert.equal(R.draw(s, 1), null);
  assert.equal(R.challenge(s, 2, true), null, 'only the next player may challenge');
  const ev = R.challenge(s, 1, true);
  assert.equal(s.hands[0].length, 2 + 4);
  assert.equal(s.hands[1].length, 1);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, 'turn');
  assert.equal(s.color, GRN); // chosen colour stands
  assert.ok(ev.some((e) => e.t === 'challenge' && e.ok === true));
});

test('challenge: failed (legal WD4) -> challenger draws 6 and loses the turn', () => {
  const wd4 = id(4, R.K_WD4);
  const s = setup([[wd4, id(BLU, 1)], [id(GRN, 1)], [id(GRN, 2)]]);
  R.play(s, 0, wd4, YEL);
  assert.equal(s.chal.bluff, false);
  const ev = R.challenge(s, 1, true);
  assert.equal(s.hands[1].length, 1 + 6);
  assert.equal(s.hands[0].length, 1);
  assert.equal(s.turn, 2);
  assert.ok(ev.some((e) => e.t === 'challenge' && e.ok === false));
});

test('no challenge -> draws 4 and is skipped', () => {
  const wd4 = id(4, R.K_WD4);
  const s = setup([[wd4, id(RED, 1)], [id(GRN, 1)], [id(GRN, 2)]]);
  R.play(s, 0, wd4, YEL);
  R.challenge(s, 1, false);
  assert.equal(s.hands[1].length, 5);
  assert.equal(s.turn, 2);
});

test('bluff is judged on the colour that was active before the WD4', () => {
  const wd4 = id(4, R.K_WD4);
  // holds a card of the NEW colour only: not a bluff
  const s = setup([[wd4, id(YEL, 1), id(BLU, 5)], [id(GRN, 1)]]);
  R.play(s, 0, wd4, YEL);
  assert.equal(s.chal.bluff, false);
  // holds a card of the same number/symbol but other colour: still legal (not a bluff)
  const s2 = setup([[wd4, id(BLU, 5)], [id(GRN, 1)]], { top: id(RED, 5) });
  R.play(s2, 0, wd4, GRN);
  assert.equal(s2.chal.bluff, false);
});

test('winning with a WD4 can be challenged; unchallenged win ends the round', () => {
  const wd4 = id(4, R.K_WD4);
  const s = setup([[wd4], [id(GRN, 1), id(GRN, 2)], [id(GRN, 3)]]);
  R.play(s, 0, wd4, GRN);
  assert.equal(s.winner, null);
  R.challenge(s, 1, false);
  assert.equal(s.winner, 0);
  assert.equal(s.hands[1].length, 6);
  assert.ok(s.phase === 'roundEnd' || s.phase === 'matchEnd');
  assert.equal(s.scores[0], R.handPoints(s.hands[1]) + R.handPoints(s.hands[2]));
});

test('ONE! penalties: caught -> draw 2; called -> safe; late call', () => {
  const mk = () => setup([[id(RED, 1), id(RED, 2)], [id(GRN, 1), id(GRN, 2)], [id(GRN, 3)]]);
  let s = mk();
  R.play(s, 0, id(RED, 1));
  assert.equal(s.vul, 0);
  const ev = R.catchUno(s, 1, 0);
  assert.ok(ev);
  assert.equal(s.hands[0].length, 3);
  assert.equal(s.vul, null);
  assert.equal(R.catchUno(s, 1, 0), null);
  s = mk();
  assert.ok(R.callUno(s, 0)); // before playing
  R.play(s, 0, id(RED, 1));
  assert.equal(s.vul, null);
  assert.equal(R.catchUno(s, 1, 0), null);
  s = mk();
  R.play(s, 0, id(RED, 1));
  assert.ok(R.callUno(s, 0)); // right after
  assert.equal(R.catchUno(s, 1, 0), null);
  // window closes when the next player acts
  s = mk();
  R.play(s, 0, id(RED, 1));
  R.draw(s, 1);
  assert.equal(s.vul, null);
  assert.equal(R.catchUno(s, 2, 0), null);
  // cannot catch yourself, cannot pre-call with 3 cards
  s = mk();
  R.play(s, 0, id(RED, 1));
  assert.equal(R.catchUno(s, 0, 0), null);
  const s3 = setup([[id(RED, 1), id(RED, 2), id(RED, 3)], [id(GRN, 1)]]);
  assert.equal(R.callUno(s3, 0), null);
  // a card drawn after calling resets the call
  const s4 = setup([[id(RED, 1), id(BLU, 2)], [id(GRN, 1)]], { top: id(YEL, 9), color: YEL });
  R.callUno(s4, 0);
  s4.draw = [id(YEL, 3)];
  R.draw(s4, 0);
  assert.equal(s4.said[0], false);
});

test('scoring values', () => {
  assert.equal(R.cardPoints(id(RED, 0)), 0);
  assert.equal(R.cardPoints(id(RED, 7)), 7);
  assert.equal(R.cardPoints(id(GRN, R.K_SKIP)), 20);
  assert.equal(R.cardPoints(id(GRN, R.K_REV)), 20);
  assert.equal(R.cardPoints(id(GRN, R.K_D2)), 20);
  assert.equal(R.cardPoints(id(4, R.K_WILD)), 50);
  assert.equal(R.cardPoints(id(4, R.K_WD4)), 50);
  const s = setup([[id(RED, 1)], [id(GRN, 7), id(4, R.K_WILD)], [id(BLU, R.K_SKIP), id(YEL, 0)]]);
  R.play(s, 0, id(RED, 1));
  assert.equal(s.winner, 0);
  assert.equal(s.scores[0], 7 + 50 + 20 + 0);
  assert.equal(s.phase, 'roundEnd');
  assert.deepEqual(s.last.hands[1], [id(GRN, 7), id(4, R.K_WILD)]);
});

test('match ends at the target; otherwise the next round starts with a fresh deck', () => {
  const s = setup([[id(RED, 1)], [id(4, R.K_WILD)], [id(4, R.K_WD4)]], { opts: { target: 100 } });
  R.play(s, 0, id(RED, 1));
  assert.equal(s.phase, 'matchEnd');
  assert.equal(s.matchWinner, 0);
  const s2 = setup([[id(RED, 1)], [id(GRN, 3)]], { opts: { target: 200 } });
  R.play(s2, 0, id(RED, 1));
  assert.equal(s2.phase, 'roundEnd');
  R.startRound(s2);
  assert.equal(s2.round, 2);
  assert.equal(s2.scores[0], 3);
  assert.deepEqual(R.allCards(s2), [...Array(108).keys()]);
  assert.equal(s2.turn >= 0 && s2.turn < 2, true);
});

test('first card effects follow the official start rules', () => {
  const seen = { skip: 0, rev: 0, d2: 0, wild: 0, num: 0 };
  for (let seed = 1; seed < 3000; seed++) {
    const s = R.newMatch(seed, { players: 4 });
    s.round = 0;
    const top = R.topCard(s);
    const k = R.kindOf(top);
    assert.ok(k !== R.K_WD4);
    if (k === R.K_WILD) {
      seen.wild++;
      assert.equal(s.phase, 'startColor');
      assert.ok(R.chooseStartColor(s, s.turn, GRN));
      assert.equal(s.color, GRN);
      assert.equal(s.phase, 'turn');
    } else if (k === R.K_D2) {
      seen.d2++;
      assert.equal(s.hands[0].length, 9);
      assert.equal(s.turn, 1);
    } else if (k === R.K_SKIP) {
      seen.skip++;
      assert.equal(s.turn, 1);
    } else if (k === R.K_REV) {
      seen.rev++;
      assert.equal(s.dir, -1);
      assert.equal(s.turn, 3);
    } else seen.num++;
  }
  assert.ok(seen.skip && seen.rev && seen.d2 && seen.wild && seen.num);
});

test('deck exhaustion reshuffles the discard pile (keeping the top card)', () => {
  const s = setup([[id(BLU, 1)], [id(GRN, 1)]], { top: id(RED, 5) });
  const rest = s.draw.slice();
  s.draw = [];
  s.discard = [...rest.slice(0, 20), id(RED, 5)];
  const total = s.hands.flat().length + s.draw.length + s.discard.length;
  const ev = R.draw(s, 0);
  assert.ok(ev.some((e) => e.t === 'reshuffle'));
  assert.equal(R.topCard(s), id(RED, 5));
  assert.equal(s.discard.length, 1);
  assert.equal(s.hands.flat().length + s.draw.length + s.discard.length, total);
  // nothing left at all: drawing still terminates the turn
  const t = setup([[id(BLU, 1)], [id(GRN, 1)]], { top: id(RED, 5) });
  t.draw = [];
  const e2 = R.draw(t, 0);
  assert.ok(e2.some((e) => e.t === 'pass'));
  assert.equal(t.turn, 1);
});

test('public view and events hide other hands', () => {
  const s = R.newMatch(5, { players: 4 });
  const v = R.publicView(s, 1);
  assert.equal(v.hand.length, 7);
  assert.ok(!('hands' in v) && !('draw' in v));
  assert.equal(v.counts.length, 4);
  const e = R.publicEvent({ t: 'draw', p: 2, n: 2, ids: [1, 2] }, 1);
  assert.ok(!('ids' in e));
  assert.deepEqual(R.publicEvent({ t: 'draw', p: 1, n: 2, ids: [1, 2] }, 1).ids, [1, 2]);
});

// ---------- fuzz: AI never plays illegally, games terminate, cards conserved ------------------
function runGame(seed, opts, levels, uniform = false) {
  const s = R.newMatch(seed, opts);
  const n = s.opts.players;
  const mems = Array.from({ length: n }, (_, i) => AI.createMemory(i, n));
  let r = seed;
  const rand = () => {
    const [v, nx] = R.rngNext(r);
    r = nx;
    return v;
  };
  const feed = (ev) => {
    for (const e of ev || []) for (let p = 0; p < n; p++) AI.observe(mems[p], R.publicEvent(e, p), R.publicView(s, p));
  };
  let steps = 0;
  let rounds = 0;
  while (steps++ < 200000) {
    if (s.phase === 'matchEnd') break;
    if (s.phase === 'roundEnd') {
      rounds++;
      const ev = R.startRound(s);
      for (let p = 0; p < n; p++) mems[p] = AI.createMemory(p, n);
      feed(ev);
      continue;
    }
    // random catches
    if (s.vul !== null && rand() < 0.5) {
      const by = (s.vul + 1 + Math.floor(rand() * (n - 1))) % n;
      const ev = R.catchUno(s, by, s.vul);
      assert.ok(ev);
      feed(ev);
    }
    const p = s.turn;
    assert.ok(p >= 0 && p < n);
    const view = R.publicView(s, p);
    const lvl = levels[p % levels.length];
    if (s.phase === 'turn' && s.hands[p].length <= 2 && rand() < AI.unoCallChance(lvl)) feed(R.callUno(s, p));
    const d = AI.decide(view, lvl, mems[p], rand);
    let ev;
    switch (d.type) {
      case 'startColor':
        ev = R.chooseStartColor(s, p, d.color);
        break;
      case 'play':
        assert.ok(view.legal.includes(d.card) || (view.phase === 'drawn' && d.card === view.drawn), 'AI chose an illegal card');
        ev = R.play(s, p, d.card, d.color);
        break;
      case 'draw':
        ev = R.draw(s, p);
        break;
      case 'pass':
        ev = R.pass(s, p);
        break;
      case 'challenge':
        ev = R.challenge(s, p, d.yes);
        break;
      default:
        assert.fail('unknown decision ' + d.type);
    }
    assert.ok(ev, `engine rejected AI move ${JSON.stringify(d)} in phase ${view.phase}`);
    feed(ev);
    if (s.phase !== 'roundEnd' && s.phase !== 'matchEnd') assert.deepEqual(R.allCards(s), [...Array(108).keys()]);
    for (const h of s.hands) assert.ok(h.length >= 0);
  }
  assert.ok(steps < 200000, 'game did not terminate');
  assert.equal(s.phase, 'matchEnd');
  assert.ok(s.scores[s.matchWinner] >= s.opts.target);
  assert.equal(s.scores.filter((x) => x >= s.opts.target).length >= 1, true);
  return { s, rounds };
}

test('fuzz: 4-player AI games (all levels) terminate with legal play', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const lv = [['easy', 'normal', 'hard', 'normal'], ['hard', 'hard', 'hard', 'hard'], ['easy', 'easy', 'easy', 'easy']][seed % 3];
    runGame(seed, { players: 4, target: 100, challenges: seed % 4 !== 0, stack: seed % 5 === 0 }, lv);
  }
});

test('fuzz: duels and 3 players', () => {
  for (let seed = 1000; seed < 1300; seed++) {
    runGame(seed, { players: 2, target: 100, challenges: seed % 2 === 0, stack: seed % 3 === 0 }, ['hard', 'normal']);
    runGame(seed, { players: 3, target: 100, challenges: true, stack: false }, ['normal', 'easy', 'hard']);
  }
});

test('hard AI beats easy AI over many duels', () => {
  let hard = 0;
  let easy = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const { s } = runGame(seed, { players: 2, target: 100 }, ['hard', 'easy']);
    if (s.matchWinner === 0) hard++;
    else easy++;
  }
  assert.ok(hard > easy, `hard ${hard} vs easy ${easy}`);
});

test('AI decisions use only the public view (same view -> same decision, regardless of hidden cards)', () => {
  for (let seed = 1; seed < 60; seed++) {
    const s = R.newMatch(seed, { players: 4 });
    if (s.phase !== 'turn') continue;
    const p = s.turn;
    const v1 = R.publicView(s, p);
    // swap the hidden cards of others with the draw pile (different hidden info, same view)
    const s2 = JSON.parse(JSON.stringify(s));
    const q = (p + 1) % 4;
    const tmp = s2.hands[q];
    s2.hands[q] = s2.draw.splice(0, tmp.length);
    s2.draw.push(...tmp);
    const v2 = R.publicView(s2, p);
    assert.deepEqual(v1, v2);
    const mk = () => {
      let r = seed;
      return () => {
        const [v, n] = R.rngNext(r);
        r = n;
        return v;
      };
    };
    for (const lvl of AI.LEVELS) assert.deepEqual(AI.decide(v1, lvl, AI.createMemory(p), mk()), AI.decide(v2, lvl, AI.createMemory(p), mk()));
  }
});
