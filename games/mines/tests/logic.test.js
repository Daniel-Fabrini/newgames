import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, reveal, toggleFlag, chord, neighbors, mulberry, levelConfig, pack, unpack, DIFFS } from '../logic.js';

const count = (g) => g.mine.reduce((a, b) => a + b, 0);

test('first click is always safe, with its neighbours mine-free', () => {
  for (let seed = 1; seed < 300; seed++) {
    const g = createGame(9, 9, 10);
    const i = seed % 81;
    const r = reveal(g, i, mulberry(seed));
    assert.equal(r.boom, -1);
    assert.equal(g.mine[i], 0);
    for (const j of neighbors(g, i)) assert.equal(g.mine[j], 0);
    assert.equal(count(g), 10);
    assert.ok(g.adj[i] === 0);
  }
});

test('dense board still keeps first cell safe', () => {
  const g = createGame(5, 5, 24);
  reveal(g, 12, mulberry(3));
  assert.equal(g.mine[12], 0);
  assert.equal(count(g), 24);
});

test('adjacent counts are correct', () => {
  const g = createGame(16, 16, 40);
  reveal(g, 0, mulberry(7));
  for (let i = 0; i < 256; i++) {
    if (g.mine[i]) continue;
    assert.equal(g.adj[i], neighbors(g, i).filter((j) => g.mine[j]).length);
  }
});

test('flood fill opens the zero region and its border only', () => {
  const g = createGame(9, 9, 10);
  const r = reveal(g, 40, mulberry(11));
  assert.ok(r.opened.length > 1);
  assert.equal(g.opened, r.opened.length);
  for (const i of r.opened) {
    assert.equal(g.mine[i], 0);
    if (g.adj[i] === 0) for (const j of neighbors(g, i)) assert.equal(g.state[j], 1);
  }
  assert.equal(r.depth[0], 0);
});

test('flags block reveal and cycle; counts follow', () => {
  const g = createGame(9, 9, 10);
  assert.equal(toggleFlag(g, 5), 2);
  assert.equal(g.flags, 1);
  assert.equal(reveal(g, 5).opened.length, 0);
  assert.equal(toggleFlag(g, 5, true), 3);
  assert.equal(g.flags, 0);
  assert.equal(toggleFlag(g, 5, true), 0);
});

test('hitting a mine loses', () => {
  const g = createGame(9, 9, 10);
  reveal(g, 40, mulberry(5));
  const m = g.mine.indexOf(1);
  const r = reveal(g, m);
  assert.equal(r.boom, m);
  assert.equal(g.status, 'lost');
  assert.equal(reveal(g, 0).opened.length, 0);
});

test('winning by opening every safe cell', () => {
  const g = createGame(9, 9, 10);
  reveal(g, 40, mulberry(9));
  let won = g.status === 'won';
  for (let i = 0; i < 81 && !won; i++) if (!g.mine[i] && g.state[i] === 0) won = reveal(g, i).won;
  assert.ok(won);
  assert.equal(g.status, 'won');
  assert.equal(g.flags, 10);
});

test('chording opens neighbours only when flags match', () => {
  const g = createGame(9, 9, 10);
  reveal(g, 40, mulberry(21));
  const n = [...Array(81).keys()].find((i) => g.state[i] === 1 && g.adj[i] > 0 && neighbors(g, i).some((j) => g.state[j] === 0));
  assert.notEqual(n, undefined);
  assert.equal(chord(g, n).ok, false);
  for (const j of neighbors(g, n)) if (g.mine[j]) toggleFlag(g, j);
  const before = g.opened;
  const r = chord(g, n);
  assert.ok(r.ok);
  assert.ok(g.opened >= before);
  assert.equal(r.boom, -1);
});

test('chord with a wrong flag explodes', () => {
  const g = createGame(9, 9, 10);
  reveal(g, 40, mulberry(21));
  const n = [...Array(81).keys()].find((i) => g.state[i] === 1 && g.adj[i] > 0 && neighbors(g, i).some((j) => g.state[j] === 0 && !g.mine[j]) );
  const nb = neighbors(g, n);
  const mines = nb.filter((j) => g.mine[j]);
  const wrong = nb.find((j) => !g.mine[j] && g.state[j] === 0);
  // flag all but one mine plus a wrong cell
  mines.slice(1).forEach((j) => toggleFlag(g, j));
  toggleFlag(g, wrong);
  const r = chord(g, n);
  assert.ok(r.ok);
  assert.ok(r.boom >= 0);
  assert.equal(g.status, 'lost');
});

test('pack/unpack roundtrip', () => {
  const g = createGame(16, 16, 40);
  reveal(g, 100, mulberry(2));
  toggleFlag(g, 0);
  const h = unpack(JSON.parse(JSON.stringify(pack(g))));
  assert.deepEqual(Array.from(h.state), Array.from(g.state));
  assert.deepEqual(Array.from(h.adj), Array.from(g.adj));
  assert.equal(h.opened, g.opened);
  assert.equal(h.flags, g.flags);
});

test('levelConfig grows and stays valid', () => {
  let prev = 0;
  for (let n = 1; n < 60; n++) {
    const c = levelConfig(n);
    assert.ok(c.mines < c.rows * c.cols);
    assert.ok(c.rows * c.cols >= prev);
    prev = c.rows * c.cols;
  }
  assert.ok(DIFFS.hard.mines < DIFFS.hard.rows * DIFFS.hard.cols);
});
