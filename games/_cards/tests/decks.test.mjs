import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../decks.js';

const uniq = (a) => new Set(a.map((c) => c.id)).size === a.length;

test('52 deck', () => {
  const d = D.createDeck52();
  assert.equal(d.length, 52); assert.ok(uniq(d));
  assert.equal(D.createDeck52({ jokers: 2 }).length, 54);
  assert.ok(uniq(D.createDeck52({ jokers: 2 })));
});
test('40 deck has no 8,9,10', () => {
  const d = D.createDeck40();
  assert.equal(d.length, 40); assert.ok(uniq(d));
  assert.ok(!d.some((c) => ['8', '9', 'T'].includes(c.r)));
});
test('double deck 108 with 4 jokers, unique ids, two of each', () => {
  const d = D.createDoubleDeck();
  assert.equal(d.length, 108); assert.ok(uniq(d));
  assert.equal(d.filter(D.isJoker).length, 4);
  assert.equal(d.filter((c) => D.code(c) === 'As').length, 2);
});
test('uno deck 108', () => {
  const d = D.createUnoDeck();
  assert.equal(d.length, 108); assert.ok(uniq(d));
  assert.equal(d.filter((c) => c.r === '0').length, 4);
  assert.equal(d.filter((c) => c.r === 'wild4').length, 4);
  assert.equal(d.filter((c) => c.s === 'R' && c.r === 'skip').length, 2);
  assert.equal(d.filter((c) => c.s === 'B' && c.r === '7').length, 2);
});
test('codes', () => {
  assert.equal(D.code({ r: 'A', s: 's' }), 'As');
  assert.deepEqual(D.parseCode('Td'), { r: 'T', s: 'd', id: 'Td' });
  assert.equal(D.parseCode('Td', 1).id, 'Td-1');
});
test('names', () => {
  assert.equal(D.cardName({ r: 'K', s: 'h' }, 'pt'), 'Rei de copas');
  assert.equal(D.cardName({ r: 'T', s: 's' }, 'en'), 'Ten of spades');
  assert.equal(D.cardName({ r: 'J', s: 'c' }, 'es'), 'Sota de tréboles');
  assert.equal(D.suitName('d', 'pt'), 'Ouros');
  assert.equal(D.cardName({ r: 'skip', s: 'R' }, 'en'), 'Red Skip');
});
test('sorting', () => {
  const d = D.sortCards(D.createDeck52());
  assert.equal(d[0].s, 's'); assert.equal(d[0].r, '2'); assert.equal(d[12].r, 'A');
  const t = D.sortCards(D.createDeck40(), { trump: 'd' });
  assert.equal(t[0].s, 'd');
  const r = D.sortCards(D.createDeck52({ jokers: 2 }), { by: 'rank' });
  assert.ok(D.isJoker(r[53]) && r[0].r === '2');
  const o = D.sortCards([{ r: 'A', s: 's' }, { r: '7', s: 's' }, { r: 'K', s: 's' }], { rankOrder: ['2', '3', '4', '5', '6', 'Q', 'J', 'K', '7', 'A'] });
  assert.deepEqual(o.map((c) => c.r), ['K', '7', 'A']);
});
