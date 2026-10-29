import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.js';
import { chooseAction, naturalRuns } from '../ai.js';

const c = (s, r, d = 0) => d * 54 + s * 13 + (r - 1);

function playGame(seed, n, levels, opts = {}) {
  const st = R.newRound({ n, seed, cleanOut: !!opts.cleanOut, dealer: seed & 3 & (n - 1) });
  const stateLog = [];
  let guard = 0;
  while (st.phase !== 'end') {
    if (++guard > 6000) throw new Error('did not terminate, seed ' + seed);
    const a = chooseAction(st, levels[st.turn % levels.length]);
    assert.ok(a, 'AI returned no action seed ' + seed);
    const chk = R.checkAction(st, a);
    assert.ok(chk.ok, `illegal AI action seed ${seed}: ${JSON.stringify(a)} -> ${chk.code}`);
    const r = R.apply(st, a);
    assert.ok(r.ok);
    // invariants
    if (guard % 7 === 0) invariants(st);
    stateLog.push(a.type);
  }
  invariants(st);
  return { st, actions: stateLog.length };
}
function invariants(st) {
  const all = [...st.hands.flat(), ...st.stock, ...st.pile, ...(st.mortos[0] || []), ...(st.mortos[1] || [])];
  for (const t of st.melds) for (const m of t) {
    assert.ok(m.cards.length >= 3 && m.cards.length <= 13);
    assert.ok(R.wildCount(m.cards) <= 1);
    for (let i = 1; i < m.cards.length; i++) assert.equal(m.cards[i].r, m.cards[i - 1].r + 1);
    for (const k of m.cards) all.push(k.id);
  }
  assert.equal(all.length, 108);
  assert.equal(new Set(all).size, 108);
  for (let team = 0; team < 2; team++) assert.equal(st.mortoTaken[team], st.mortos[team] === null);
}

test('naturalRuns finds runs, ace low/high', () => {
  const runs = naturalRuns([c(1, 3), c(1, 4), c(1, 5), c(0, 12), c(0, 13), c(0, 1), c(2, 9)]);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((r) => r.length), [3, 3]);
});

test('AI fuzz: 4-player games, all levels, always legal and terminating', () => {
  let ends = { bater: 0, stock: 0, stop: 0 };
  const N = 600;
  for (let seed = 1; seed <= N; seed++) {
    const lv = [['easy', 'normal', 'hard', 'normal'], ['normal'], ['hard'], ['easy']][seed % 4];
    const { st } = playGame(seed, 4, lv);
    ends[st.ended.reason]++;
    const sc = R.scoreRound(st);
    assert.equal(sc.length, 2);
    for (const s of sc) assert.equal(s.total, s.meldPts + s.canastraPts + s.bater - s.handPts + s.morto);
    if (st.ended.reason === 'bater') {
      assert.ok(st.mortoTaken[st.ended.team]);
      assert.ok(R.canGoOut(st, st.ended.team));
      assert.equal(sc[st.ended.team].bater, 100);
      assert.equal(sc[1 - st.ended.team].bater, 0);
    }
  }
  console.log('round endings', ends);
});

test('AI fuzz: 2-player duel games', () => {
  for (let seed = 1; seed <= 300; seed++) playGame(seed * 3, 2, ['normal', 'hard']);
});

test('AI fuzz: clean canastra required to go out', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const { st } = playGame(seed + 5000, 4, ['normal'], { cleanOut: true });
    if (st.ended.reason === 'bater') assert.ok(R.teamCanastras(st, st.ended.team).some((m) => R.isClean(m)));
  }
});

test('determinism: same seed -> identical game', () => {
  const a = playGame(77, 4, ['hard', 'normal']);
  const b = playGame(77, 4, ['hard', 'normal']);
  assert.deepEqual(a.st, b.st);
});

test('AI decisions do not depend on hidden information', () => {
  // two states that differ only in cards the seat cannot see must give identical actions
  for (let seed = 1; seed <= 60; seed++) {
    const st = R.newRound({ n: 4, seed });
    let guard = 0;
    while (st.phase !== 'end' && guard++ < 60) {
      const seat = st.turn;
      const twin = JSON.parse(JSON.stringify(st));
      // shuffle the stock, other hands and mortos deterministically (reverse) keeping sizes
      twin.stock.reverse();
      for (let s = 0; s < twin.n; s++) if (s !== seat) twin.hands[s].reverse();
      for (const t of [0, 1]) if (twin.mortos[t]) twin.mortos[t].reverse();
      // swap the hidden cards between the stock and other hands
      const other = (seat + 1) % twin.n;
      if (twin.stock.length && twin.hands[other].length) {
        const x = twin.stock.pop();
        twin.stock.push(twin.hands[other].pop());
        twin.hands[other].push(x);
      }
      const a1 = chooseAction(st, 'hard');
      const a2 = chooseAction(twin, 'hard');
      assert.deepEqual(a1, a2, `hidden info leaked seed ${seed}`);
      R.apply(st, a1);
    }
  }
});

test('AI takes a lixo that completes a meld and never an unusable one', () => {
  const st = R.newRound({ n: 4, seed: 9 });
  st.turn = 0; st.phase = 'draw';
  st.hands[0] = [c(1, 4), c(1, 5), c(1, 9), c(0, 3), c(2, 11), c(3, 13), c(0, 8), c(2, 7), c(3, 5), c(0, 12), c(2, 1)];
  st.pile = [c(0, 5), c(2, 2), c(1, 6), c(3, 9)];
  st.pile = [c(0, 10), c(1, 3), c(1, 6), c(3, 12), c(2, 4)];
  const a = chooseAction(st, 'normal');
  assert.ok(['take', 'draw'].includes(a.type));
  if (a.type === 'take') assert.ok(R.checkAction(st, a).ok);
});
