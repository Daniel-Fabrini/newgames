import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, describe as desc, parseCards, bestFive, cardStr } from '../engine/eval.js';
import { mulberry32, shuffle, freshDeck } from '../engine/rng.js';

const ev = (s) => evaluate(parseCards(s));
const key = (s) => desc(ev(s)).key;

test('hand categories are recognised', () => {
  assert.equal(key('As Ks Qs Js Ts'), 'royal_flush');
  assert.equal(key('9h 8h 7h 6h 5h'), 'straight_flush');
  assert.equal(key('9h 9d 9s 9c 2d'), 'quads');
  assert.equal(key('Kh Kd Ks 4c 4d'), 'full_house');
  assert.equal(key('Ah 9h 7h 4h 2h'), 'flush');
  assert.equal(key('9h 8d 7s 6c 5d'), 'straight');
  assert.equal(key('Qh Qd Qs 4c 2d'), 'trips');
  assert.equal(key('Jh Jd 4s 4c 2d'), 'two_pair');
  assert.equal(key('Th Td 4s 3c 2d'), 'pair');
  assert.equal(key('Ah Jd 9s 4c 2d'), 'high_card');
});
test('category ordering', () => {
  const order = ['As Ks Qs Js Ts', '9h 8h 7h 6h 5h', '9h 9d 9s 9c 2d', 'Kh Kd Ks 4c 4d', 'Ah 9h 7h 4h 2h', '9h 8d 7s 6c 5d', 'Qh Qd Qs 4c 2d', 'Jh Jd 4s 4c 2d', 'Th Td 4s 3c 2d', 'Ah Jd 9s 4c 2d'];
  for (let i = 0; i < order.length - 1; i++) assert.ok(ev(order[i]) > ev(order[i + 1]), order[i]);
});
test('wheel straight A-2-3-4-5 is the lowest straight, ace-high straight highest', () => {
  assert.equal(key('Ah 2d 3s 4c 5d'), 'straight');
  assert.ok(ev('6h 2d 3s 4c 5d') > ev('Ah 2d 3s 4c 5d'));
  assert.ok(ev('Ah Kd Qs Jc Td') > ev('Kh Qd Js Tc 9d'));
  assert.equal(key('Ah 2h 3h 4h 5h'), 'straight_flush');
  assert.ok(ev('6h 5h 4h 3h 2h') > ev('Ah 2h 3h 4h 5h'));
  // no wraparound straight
  assert.notEqual(key('Qh Kd As 2c 3d'), 'straight');
  assert.notEqual(key('Kh Ad 2s 3c 4d'), 'straight');
});
test('flush vs straight flush in 7 cards; flush and straight present but not same suit', () => {
  assert.equal(key('9h 8h 7h 6h 5h 4h Ad'), 'straight_flush');
  assert.equal(desc(ev('9h 8h 7h 6h 5h 4h Ad')).ranks[0], 7); // 9-high? 9h..5h => top 9 = rank index 7
  assert.equal(key('9h 8h 7h 6h 2h 5d Ad'), 'flush');
  assert.equal(key('9h 8d 7h 6h 5d 4h 2c'), 'straight');
  // flush ranks use only the 5 best flush cards
  assert.ok(ev('Ah Kh 9h 5h 3h 4d 7d') > ev('Ah Kh 9h 5h 2h 4d 7d'));
  assert.equal(ev('Ah Kh 9h 5h 3h 2h 7d'), ev('Ah Kh 9h 5h 3h 2d 7d'));
});
test('kickers decide pairs, trips, quads, high card', () => {
  assert.ok(ev('Ah Ad Ks 4c 2d') > ev('Ah Ad Qs 4c 2d'));
  assert.ok(ev('Ah Ad Ks 4c 3d') > ev('Ah Ad Ks 4c 2d'));
  assert.ok(ev('7h 7d 7s Ac 2d') > ev('7h 7d 7s Kc 2d'));
  assert.ok(ev('7h 7d 7s 7c Ad') > ev('7h 7d 7s 7c Kd'));
  assert.ok(ev('Ah Kd 9s 4c 3d') > ev('Ah Kd 9s 4c 2d'));
  assert.ok(ev('Ah Ad Ks Ks 2d'.replace('Ks Ks', 'Ks Kc')) > ev('Ah Ad Qs Qc Kd'));
  assert.equal(ev('Ah Ad Ks Kc 2d'), ev('Ac As Kh Kd 2h'));
});
test('two pair from three pairs uses the best two and best kicker (7 cards)', () => {
  const a = ev('Ah Ad Kh Kd Qh Qd 2c'); const b = ev('Ah Ad Kh Kd 3c 2d 2s');
  assert.equal(desc(a).key, 'two_pair');
  assert.ok(a > b); // kicker Q beats 3
  assert.equal(a, ev('Ah Ad Kh Kd Qc 7s 2c'));
});
test('full house tie-breaks: trips rank first, then pair; two trips make a boat', () => {
  assert.ok(ev('Kh Kd Ks 2c 2d') > ev('Qh Qd Qs Ac Ad'));
  assert.ok(ev('Kh Kd Ks 3c 3d') > ev('Kh Kd Ks 2c 2d'));
  assert.equal(key('Kh Kd Ks 3c 3d 3s 9d'), 'full_house');
  assert.equal(ev('Kh Kd Ks 3c 3d 3s 9d'), ev('Kh Kd Ks 3c 3d'));
  assert.equal(ev('Kh Kd Ks Qc Qd 2s 2d'), ev('Kh Kd Ks Qc Qd'));
});
test('quads with a pair/trips on board use best kicker', () => {
  assert.equal(ev('9h 9d 9s 9c Ad Ah Ac'), ev('9h 9d 9s 9c Ad'));
});
test('7-card evaluation equals the best of all 21 five-card subsets', () => {
  const rng = mulberry32(42);
  for (let n = 0; n < 3000; n++) {
    const d = shuffle(freshDeck(), rng).slice(0, 7);
    let best = -1;
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) best = Math.max(best, evaluate(d.filter((_, k) => k !== i && k !== j)));
    assert.equal(evaluate(d), best, d.map(cardStr).join(' '));
  }
});
test('category frequencies over random 7-card hands match theory', () => {
  const rng = mulberry32(2024); const N = 200000; const cnt = new Array(9).fill(0);
  for (let n = 0; n < N; n++) { const d = shuffle(freshDeck(), rng); cnt[evaluate(d.slice(0, 7)) >> 20]++; }
  const exp = [0.1741, 0.4380, 0.2350, 0.0483, 0.0462, 0.0303, 0.0260, 0.00168, 0.000311 + 0.0000032];
  exp.forEach((p, i) => { const f = cnt[i] / N; assert.ok(Math.abs(f - p) < Math.max(0.0015, p * 0.12), `cat ${i}: ${f} vs ${p}`); });
});
test('bestFive returns five cards that score as the hand', () => {
  const c = parseCards('Ah Ad Kh Kd Qh Qd 2c');
  const b = bestFive(c); assert.equal(b.length, 5); assert.equal(evaluate(b), evaluate(c));
});
