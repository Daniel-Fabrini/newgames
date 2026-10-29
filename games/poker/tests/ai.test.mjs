import test from 'node:test';
import assert from 'node:assert/strict';
import { createHand, applyAction, viewFor, validateAction, legalActions } from '../engine/hand.js';
import { decide } from '../ai/decide.js';
import { equity } from '../ai/equity.js';
import { preflopPct } from '../ai/preflop.js';
import { ARCHETYPES, randomProfile } from '../ai/profiles.js';
import { parseCards } from '../engine/eval.js';
import { mulberry32, shuffle, freshDeck } from '../engine/rng.js';
import { createTournament, simulateWithBot } from '../tournament/tournament.js';
import { makeStructure } from '../tournament/structures.js';

const names = Object.keys(ARCHETYPES);

test('preflop percentile ranks premium hands first', () => {
  const p = (s) => preflopPct(parseCards(s));
  assert.ok(p('As Ah') < p('Ks Kh')); assert.ok(p('Ks Kh') < p('As Ks')); assert.ok(p('As Ks') < p('As Kd'));
  assert.ok(p('7c 2d') > 0.9); assert.ok(p('As Ah') < 0.01);
});
test('equity sanity: AA vs random hand ~85%, 72o vs random ~35%, and board changes it', () => {
  const rng = mulberry32(3);
  const aa = equity(parseCards('As Ah'), [], [1], rng, 4000);
  assert.ok(aa > 0.8 && aa < 0.9, 'AA ' + aa);
  const t = equity(parseCards('7c 2d'), [], [1], rng, 4000);
  assert.ok(t > 0.3 && t < 0.4, '72o ' + t);
  const made = equity(parseCards('As Ah'), parseCards('Ad 7c 2h'), [1], rng, 2000);
  assert.ok(made > 0.95);
  const air = equity(parseCards('2s 3h'), parseCards('Ad Kc Qh Jd 9s'), [1], rng, 2000);
  const kk = equity(parseCards('Ks Kh'), [], [1], rng, 3000);
  assert.ok(air < 0.4 && aa > kk && kk > t, `air ${air} aa ${aa} kk ${kk} t ${t}`);
  // against a tight range (top 5%) AA is much weaker than against random hands
  assert.ok(equity(parseCards('As Ah'), [], [0.05], rng, 3000) < aa);
});
test('AI legality fuzz: thousands of full hands, every action legal, every hand terminates', () => {
  const rng = mulberry32(7);
  let hands = 0, actions = 0;
  for (let h = 0; h < 3000; h++) {
    const n = 2 + Math.floor(rng() * 8);
    const stacks = [...Array(n)].map(() => 1 + Math.floor(rng() * (rng() < 0.35 ? 80 : 4000)));
    const total = stacks.reduce((a, b) => a + b, 0);
    const profs = stacks.map(() => (rng() < 0.2 ? randomProfile(rng, 1 + rng() * 9) : ARCHETYPES[names[Math.floor(rng() * names.length)]]));
    const { state: st } = createHand({ players: stacks.map((s, i) => ({ id: 'p' + i, stack: s })), button: Math.floor(rng() * n), sb: 10 + (h % 3) * 5, bb: 20 + (h % 3) * 10, ante: h % 4 === 0 ? 4 : 0, rng });
    let g = 0;
    while (st.phase === 'betting') {
      const i = st.toAct;
      const a = decide(viewFor(st, i), profs[i], rng, { fast: h % 2 === 0, pressure: { bubble: h % 5 === 0 } });
      assert.equal(validateAction(st, a), null, JSON.stringify(a) + ' ' + JSON.stringify(legalActions(st)));
      applyAction(st, a); actions++;
      assert.ok(++g < 300, 'hand did not terminate');
    }
    assert.equal(st.players.reduce((s, p) => s + p.stack, 0), total);
    hands++;
  }
  assert.equal(hands, 3000); assert.ok(actions > 10000);
});
test('AI never peeks: the decision is identical when opponents\' hole cards and the undealt deck change', () => {
  const rng = mulberry32(21);
  let checked = 0;
  for (let h = 0; h < 120; h++) {
    const n = 2 + Math.floor(rng() * 6);
    const { state: st } = createHand({ players: [...Array(n)].map((_, i) => ({ id: 'p' + i, stack: 1500 })), button: h % n, sb: 10, bb: 20, rng });
    const prof = ARCHETYPES[names[h % names.length]];
    let g = 0;
    while (st.phase === 'betting' && g++ < 200) {
      const i = st.toAct; const seed = 1000 + h * 31 + g;
      const a1 = decide(viewFor(st, i), prof, mulberry32(seed), {});
      // scramble everything the player cannot know: other players' hole cards and the unseen deck
      const clone = JSON.parse(JSON.stringify(st));
      const known = new Set([...clone.players[i].hole, ...clone.board]);
      const unseen = [];
      for (let c = 0; c < 52; c++) if (!known.has(c)) unseen.push(c);
      shuffle(unseen, mulberry32(seed + 5));
      let k = 0;
      for (const p of clone.players) if (p.i !== i) { p.hole = [unseen[k++], unseen[k++]]; }
      const a2 = decide(viewFor(clone, i), prof, mulberry32(seed), {});
      assert.deepEqual(a1, a2);
      checked++;
      applyAction(st, a1);
    }
  }
  assert.ok(checked > 300);
});
test('viewFor exposes only the viewer\'s hole cards and no deck', () => {
  const { state } = createHand({ players: [{ id: 'a', stack: 100 }, { id: 'b', stack: 100 }, { id: 'c', stack: 100 }], button: 0, sb: 1, bb: 2, seed: 4 });
  const v = viewFor(state, 1);
  const json = JSON.stringify(v);
  assert.ok(!('deck' in v)); assert.equal(v.hole.length, 2);
  for (const p of v.players) assert.ok(!('hole' in p));
  assert.ok(!json.includes('"deck"'));
});
test('decision time stays small (well under 30 ms average on node, full iterations)', () => {
  const rng = mulberry32(5); let total = 0, n = 0, max = 0;
  for (let h = 0; h < 60; h++) {
    const { state: st } = createHand({ players: [...Array(6)].map((_, i) => ({ id: 'p' + i, stack: 3000 })), button: h % 6, sb: 10, bb: 20, rng });
    while (st.phase === 'betting') { const t0 = performance.now(); const a = decide(viewFor(st, st.toAct), ARCHETYPES.professor, rng, {}); const dt = performance.now() - t0; total += dt; n++; max = Math.max(max, dt); applyAction(st, a); }
  }
  assert.ok(total / n < 8, 'avg ' + total / n); assert.ok(max < 60, 'max ' + max);
});
test('deterministic: same view + same seed gives the same action', () => {
  const { state } = createHand({ players: [...Array(4)].map((_, i) => ({ id: 'p' + i, stack: 1000 })), button: 0, sb: 10, bb: 20, seed: 9 });
  const v = viewFor(state, state.toAct);
  assert.deepEqual(decide(v, ARCHETYPES.shark, mulberry32(1), {}), decide(v, ARCHETYPES.shark, mulberry32(1), {}));
});
// ---- style recognisability + skill ----
function table(arch, n, H, seed) {
  const rng = mulberry32(seed); const prof = ARCHETYPES[arch]; let vp = 0, pf = 0, bets = 0, calls = 0, seen = 0;
  for (let h = 0; h < H; h++) {
    const { state: st } = createHand({ players: [...Array(n)].map((_, i) => ({ id: 'p' + i, stack: 2000 })), button: h % n, sb: 10, bb: 20, rng });
    while (st.phase === 'betting') applyAction(st, decide(viewFor(st, st.toAct), prof, rng, { fast: true }));
    for (const p of st.players) {
      seen++; const log = st.log.filter((e) => e.t === 'action' && e.p === p.i);
      if (log.some((e) => e.street === 'preflop' && (e.type === 'call' || e.type === 'raise'))) vp++;
      if (log.some((e) => e.street === 'preflop' && e.type === 'raise')) pf++;
      for (const e of log) { if (e.type === 'raise' || e.type === 'bet') bets++; else if (e.type === 'call' || e.type === 'check') calls++; }
    }
  }
  return { vpip: vp / seen, pfr: pf / seen, af: bets / Math.max(1, calls + bets) };
}
test('personalities are recognisable: wall tight/passive, rookie loose/passive, maniac loose/aggressive, shark aggressive', () => {
  const wall = table('wall', 6, 1500, 1), rookie = table('rookie', 6, 1500, 2), maniac = table('maniac', 6, 1500, 3), shark = table('shark', 6, 1500, 4);
  assert.ok(wall.vpip < rookie.vpip, `vpip wall ${wall.vpip} rookie ${rookie.vpip}`);
  assert.ok(wall.vpip < maniac.vpip);
  assert.ok(maniac.pfr > wall.pfr * 1.5, `pfr maniac ${maniac.pfr} wall ${wall.pfr}`);
  assert.ok(maniac.af > rookie.af, `af maniac ${maniac.af} rookie ${rookie.af}`);
  assert.ok(shark.af > wall.af, `af shark ${shark.af} wall ${wall.af}`);
});
function headsUp(a, b, H, seed) {
  const rng = mulberry32(seed); let net = 0; const profs = [ARCHETYPES[a], ARCHETYPES[b]];
  for (let h = 0; h < H; h++) {
    const order = h % 2 ? [1, 0] : [0, 1];
    const { state: st } = createHand({ players: order.map((k) => ({ id: 'p' + k, stack: 2000 })), button: 0, sb: 10, bb: 20, rng });
    while (st.phase === 'betting') { const i = st.toAct; applyAction(st, decide(viewFor(st, i), profs[order[i]], rng, { fast: true })); }
    const me = st.players.find((p) => p.id === 'p0'); net += me.stack - 2000;
  }
  return net / 20 / H * 100; // bb/100
}
test('skill matters: stronger profiles win heads-up against weaker ones (fixed seeds)', () => {
  const r1 = headsUp('legend', 'rookie', 2500, 11);
  const r2 = headsUp('professor', 'calling_station', 2500, 12);
  const r3 = headsUp('rookie', 'professor', 2500, 13);
  assert.ok(r1 > 10, 'legend vs rookie ' + r1);
  assert.ok(r2 > 10, 'professor vs station ' + r2);
  assert.ok(r3 < -10, 'rookie vs professor ' + r3);
});
test('skill matters in tournaments: elite bot finishes better on average than a rookie bot against the same field (fixed seeds)', () => {
  const avgPlace = (hero, N) => {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const def = { id: 'x', format: 'sitgo', entrants: 6, tableSize: 6, startStack: 1500, structure: makeStructure({ bb: 15, handsPerLevel: 12, growth: 1.3 }), buyIn: 100, mult: 1, rivals: [...Array(5)].map((_, k) => ({ id: 'v' + k, name: 'V' + k, profile: ARCHETYPES.balanced })) };
      const t = createTournament(def, { player: { id: 'hero', name: 'Hero' }, seed: 500 + i });
      sum += simulateWithBot(t, ARCHETYPES[hero]).place;
    }
    return sum / N;
  };
  const strong = avgPlace('professor', 50), weak = avgPlace('rookie', 50);
  assert.ok(strong < weak - 0.2, `strong ${strong} weak ${weak}`);
});
