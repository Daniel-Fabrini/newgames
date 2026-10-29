// node --test games/pinball/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, R, SUB, PLUNGE_MAX, flipperGap } from '../sim.js';
import { makeTable, W, H, TABLE_IDS } from '../tables.js';
import { Game, SCORE, rankFor, TILT_LIMIT, BONUS_TIME } from '../rules.js';
import * as Rec from '../records.js';

function rnd(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const settle = (s) => { for (let i = 0; i < 40; i++) s.update(1 / 60); };

test('plunger: weak pulls fall back into the lane, a full pull reaches the playfield', () => {
  for (const id of TABLE_IDS) {
    const weak = new Sim(makeTable(id)); weak.serve(); settle(weak);
    assert.ok(weak.launch(0.1));
    let leftLane = false;
    for (let i = 0; i < 600; i++) { weak.update(1 / 60); const b = weak.balls[0]; if (b && b.x < 345) leftLane = true; }
    assert.equal(leftLane, false);
    const full = new Sim(makeTable(id)); full.serve(); settle(full);
    full.launch(1);
    let reached = false;
    for (let i = 0; i < 600; i++) { full.update(1 / 60); const b = full.balls[0]; if (b && b.x < 340 && b.y < 400) reached = true; }
    assert.ok(reached, id + ' full plunge reaches the playfield');
  }
});

test('fuzz: balls never escape, values stay finite, flippers are never penetrated, balls drain or are saved', () => {
  for (const id of TABLE_IDS) {
    for (let seed = 1; seed <= 40; seed++) {
      const r = rnd(seed * 97 + id.length);
      const s = new Sim(makeTable(id));
      s.serve(); settle(s);
      s.launch(0.65 + r() * 0.35);
      let lost = 0, drained = 0, press = { L: false, R: false }, nextToggle = 0;
      const maxMulti = seed % 5 === 0;
      if (maxMulti) { s.addBall(150, 130, 200, 100); s.addBall(214, 140, -250, 60); }
      for (let i = 0; i < 60 * 40; i++) {
        if (i >= nextToggle) {
          for (const k of ['L', 'R']) { press[k] = r() < 0.5; s.setFlipper(k, press[k]); }
          nextToggle = i + 3 + Math.floor(r() * 40);
        }
        s.update(1 / 60);
        for (const e of s.takeEvents()) { if (e.t === 'drain') { drained++; if (e.lost) lost++; } }
        for (const b of s.balls) {
          assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy), 'finite');
          assert.ok(b.x > -5 && b.x < W + 5 && b.y > -40 && b.y < H + 5, `in bounds ${b.x} ${b.y}`);
          assert.ok(Math.hypot(b.vx, b.vy) <= 1701, 'speed clamp');
          if (!b.ramp) for (const f of s.flippers) { if (f.tx === undefined) continue; assert.ok(flipperGap(b, f) > R - 3.5, `flipper penetration ${flipperGap(b, f).toFixed(2)} at ${id}/${seed}/${i}`); }
        }
        if (s.balls.length === 0) break;
      }
      assert.equal(lost, 0, 'no ball lost outside the table');
      assert.ok(drained >= 1 || s.balls.length > 0);
    }
  }
});

test('max-speed ball cannot tunnel through walls or the flipper', () => {
  const s = new Sim(makeTable('neon'));
  for (const ang of [-1.2, -0.6, 0, 0.6, 1.2, 2.2, 2.9, -2.4]) {
    s.balls.length = 0;
    const b = s.addBall(182, 400, Math.sin(ang) * 1700, -Math.cos(ang) * 1700);
    for (let i = 0; i < 2000; i++) { s.update(1 / 60); if (!s.balls.length) break; assert.ok(b.x > 0 && b.x < 400 && b.y > -30, 'stays inside'); }
  }
  // fast shot straight down onto a flipper that is held up
  const s2 = new Sim(makeTable('neon'));
  s2.setFlipper('L', true);
  for (let i = 0; i < 30; i++) s2.update(1 / 60);
  const f = s2.flippers[0];
  const mx = (f.px + f.tx) / 2, my = (f.py + f.ty) / 2;
  const b2 = s2.addBall(mx, my - 150, 0, 1500);
  let min = 1e9;
  for (let i = 0; i < 120; i++) { s2.update(1 / 60); min = Math.min(min, flipperGap(b2, f)); }
  assert.ok(min > -4, 'never inside the flipper: ' + min);
});

test('flipper swing launches a ball up and toward the table centre; resting ball can be cradled', () => {
  const s = new Sim(makeTable('neon'));
  const f = s.flippers[0];
  settle(s);
  // ball just landed on the lowered flipper
  const b = s.addBall(f.px + 36, f.py - 2);
  for (let i = 0; i < 6; i++) s.update(1 / 60);
  s.setFlipper('L', true);
  let best = 0, bvx = 0;
  for (let i = 0; i < 20; i++) { s.update(1 / 60); if (b.vy < best) { best = b.vy; bvx = b.vx; } }
  assert.ok(best < -700, 'ball shot upward ' + best);
  assert.ok(bvx > 20, 'ball moves toward the centre ' + bvx);
  assert.ok(Math.hypot(b.vx, b.vy) < 1701);
  // cradle: slow ball onto an already raised flipper stays near it
  const s2 = new Sim(makeTable('neon'));
  s2.setFlipper('L', true); settle(s2);
  const g = s2.flippers[0];
  const c = s2.addBall(g.px + 30, g.py - 60, 0, 0);
  for (let i = 0; i < 60 * 3; i++) s2.update(1 / 60);
  assert.ok(c.y > g.py - 40 && c.y < g.py + 5, 'cradled on the flipper ' + c.y);
  assert.ok(Math.hypot(c.vx, c.vy) < 60, 'almost stopped');
});

test('right flipper mirrors the left', () => {
  const s = new Sim(makeTable('neon'));
  const f = s.flippers[1];
  settle(s);
  const b = s.addBall(f.px - 36, f.py - 2);
  for (let i = 0; i < 6; i++) s.update(1 / 60);
  s.setFlipper('R', true);
  let best = 0, bvx = 0;
  for (let i = 0; i < 20; i++) { s.update(1 / 60); if (b.vy < best) { best = b.vy; bvx = b.vx; } }
  assert.ok(best < -700 && bvx < -20, `${bvx} ${best}`);
});

test('bumpers kick the ball; slingshots kick; events emitted', () => {
  const s = new Sim(makeTable('neon'));
  const bp = s.tb.bumpers[0];
  const b = s.addBall(bp.x, bp.y - bp.r - R - 3, 0, 300);
  let ev = [];
  for (let i = 0; i < 60; i++) { s.update(1 / 60); ev.push(...s.takeEvents()); }
  assert.ok(ev.some((e) => e.t === 'bumper' && e.i === 0));
  assert.ok(Math.hypot(b.vx, b.vy) > 200 || b.y < bp.y - 20);
});

test('game: scoring, multiplier and bonus', () => {
  const g = new Game({ table: 'neon', seed: 3 });
  g.phase = 'play';
  g.handle({ t: 'bumper', i: 0 });
  assert.equal(g.score, SCORE.bumper);
  g.mult = 3;
  g.handle({ t: 'standup', i: 0 });
  assert.equal(g.score, SCORE.bumper + SCORE.standup * 3);
  // lanes: complete all three -> multiplier raised, lanes reset
  const g2 = new Game({ table: 'neon', seed: 3 });
  g2.phase = 'play';
  g2.skillOpen = false;
  for (let i = 0; i < 3; i++) g2.handle({ t: 'lane', i });
  assert.equal(g2.mult, 2);
  assert.deepEqual(g2.lanes, [false, false, false]);
  g2.mult = 5;
  g2.raiseMult();
  assert.equal(g2.mult, 5);
});

test('game: combos need consecutive hits inside the window', () => {
  const g = new Game({ table: 'neon', seed: 3 });
  g.phase = 'play';
  for (let i = 0; i < 3; i++) g.handle({ t: 'sling', side: 'L' });
  assert.equal(g.combo, 3);
  assert.ok(g.score > 3 * SCORE.sling);
  g.phase = 'play';
  g.update(2.0);
  assert.equal(g.combo, 0);
  assert.equal(g.stats.maxCombo, 3);
});

test('game: ball counter, bonus collection and game over', () => {
  for (const balls of [3, 5]) {
    const g = new Game({ table: 'neon', balls, seed: 5 });
    for (let n = 1; n <= balls; n++) {
      assert.equal(g.ballNo, n);
      g.phase = 'play'; g.saver = 0;
      g.bonus = 1000; g.mult = 2;
      const before = g.score;
      g.sim.balls.length = 0;
      g.handle({ t: 'drain', id: 1, lost: false });
      assert.equal(g.phase, 'bonus');
      assert.equal(g.bonusInfo.total, 2000);
      g.update(BONUS_TIME + 0.1);
      assert.equal(g.score, before + 2000);
    }
    assert.equal(g.phase, 'over');
  }
});

test('game: ball save returns the ball, does not consume it', () => {
  const g = new Game({ table: 'neon', seed: 5 });
  g.sim.launch(0.9); g.phase = 'play'; g.saver = 5;
  g.sim.balls.length = 0;
  g.handle({ t: 'drain', id: 1 });
  assert.equal(g.phase, 'play');
  assert.equal(g.ballNo, 1);
  assert.equal(g.sim.balls.length, 1);
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  assert.ok(g.sim.balls[0].vy < 0 || g.sim.balls[0].y < 700, 'auto-launched');
});

test('game: tilt after too many nudges kills the flippers and forfeits the bonus', () => {
  const g = new Game({ table: 'neon', seed: 5 });
  g.phase = 'play'; g.saver = 0; g.bonus = 5000;
  g.sim.launch(0.9);
  let n = 0;
  while (!g.tilted && n < 10) { g.nudge(1); n++; }
  assert.ok(g.tilted);
  assert.ok(n <= Math.ceil(TILT_LIMIT) + 1);
  g.pressFlipper('L', true);
  assert.equal(g.sim.flippers[0].on, false);
  for (let i = 0; i < 60 * 10; i++) g.update(1 / 60);
  assert.equal(g.phase === 'bonus' || g.ballNo === 2 || g.phase === 'ready', true);
  assert.ok(g.stats.tilts === 1);
  assert.equal(g.stats.bonus, 0);
});

test('game: nudges decay, a single nudge is harmless', () => {
  const g = new Game({ table: 'neon', seed: 5 });
  g.phase = 'play';
  g.nudge(1); g.update(3); g.nudge(-1); g.update(3); g.nudge(1);
  assert.equal(g.tilted, false);
});

test('multiball bookkeeping', () => {
  const g = new Game({ table: 'neon', seed: 5 });
  g.phase = 'play'; g.saver = 0;
  g.sim.balls.length = 0; g.sim.addBall(182, 300);
  g.mbLit = true;
  g.handle({ t: 'ramp', i: 0 });
  assert.equal(g.multiball, true);
  assert.equal(g.sim.balls.length, 3);
  assert.equal(g.stats.multiballs, 1);
  g.saver = 0;
  g.sim.balls.pop(); g.handle({ t: 'drain', id: 9 });
  assert.equal(g.multiball, true);
  assert.equal(g.phase, 'play');
  g.sim.balls.pop(); g.handle({ t: 'drain', id: 8 });
  assert.equal(g.multiball, false);
  assert.equal(g.phase, 'play');
  const before = g.score;
  g.sim.balls.length = 0; g.handle({ t: 'drain', id: 7 });
  assert.equal(g.phase, 'bonus');
  assert.ok(g.score >= before);
  // jackpot during multiball
  const h = new Game({ table: 'neon', seed: 5 });
  h.phase = 'play'; h.multiball = true;
  const s0 = h.score;
  h.handle({ t: 'ramp', i: 0 });
  assert.ok(h.score - s0 >= SCORE.jackpot);
});

test('drop target bank lights multiball after two completions', () => {
  const g = new Game({ table: 'neon', seed: 5 });
  g.phase = 'play';
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) { g.sim.drops[i].down = true; g.handle({ t: 'drop', i }); }
    g.update(1.6);
    assert.ok(g.sim.drops.every((d) => !d.down), 'bank resets');
  }
  assert.equal(g.stats.banks, 2);
  assert.equal(g.mbLit, true);
});

test('missions complete in order and pay out', () => {
  const g = new Game({ table: 'neon', seed: 5 });
  g.phase = 'play';
  for (let i = 0; i < 3; i++) g.handle({ t: 'bumper', i });
  assert.equal(g.stats.missions, 1);
  assert.equal(g.mi, 1);
  for (let i = 0; i < 3; i++) g.handle({ t: 'ramp', i: 0 });
  assert.equal(g.stats.missions, 2);
  const s = new Game({ table: 'space', seed: 5 });
  s.phase = 'play';
  s.mission('lanes', {}); s.mission('lanes', {});
  assert.equal(s.stats.missions, 1);
});

test('missions mode ends the game when every mission is done', () => {
  const g = new Game({ table: 'neon', seed: 5, missionsMode: true });
  g.phase = 'play';
  for (const m of g.tb.missions) {
    const goal = m.goal;
    for (let k = 0; k < goal; k++) {
      if (m.type === 'bumperAll') g.handle({ t: 'bumper', i: k });
      else if (m.type === 'combo') { g.combo = goal - 1; g.touch(); }
      else if (m.ev === 'multiball') g.mission('multiball', {});
      else g.mission(m.ev, {});
    }
  }
  assert.equal(g.allClear, true);
  g.sim.balls.length = 0; g.saver = 0;
  g.handle({ t: 'drain', id: 1 });
  g.update(BONUS_TIME + 0.1);
  assert.equal(g.phase, 'over');
});

test('stuck ball gets nudged then re-served', () => {
  const g = new Game({ table: 'neon', seed: 5 });
  g.sim.launch(1); g.phase = 'play'; g.saver = 0;
  g.sim.balls.length = 0;
  const b = g.sim.addBall(182, 440, 0, 0);
  let nudged = false, reserved = false;
  for (let i = 0; i < 60 * 12 && !reserved; i++) {
    for (const x of g.sim.balls) { if (!g.sim.inLane(x)) { x.vx = 0; x.vy = 0; } }
    g.stuck(1 / 60);
    for (const e of g.takeFx()) { if (e.t === 'unstick') nudged = true; if (e.t === 'reserve') reserved = true; }
  }
  assert.ok(nudged && reserved);
  assert.equal(g.sim.balls.length, 1);
  assert.ok(g.sim.inLane(g.sim.balls[0]));
  void b;
});

test('ranks, unlocks, records and XP', () => {
  assert.equal(rankFor(0), 0);
  assert.equal(rankFor(31000), 2);
  assert.equal(rankFor(1e9), 5);
  let rec = Rec.normalize(null);
  assert.equal(Rec.isUnlocked(rec, 'space'), false);
  assert.equal(Rec.isUnlocked(rec, 'neon'), true);
  let r = Rec.applyResult(rec, { table: 'neon', score: 12000, stats: { missions: 2 }, missionsMode: false });
  assert.equal(r.newRecord, true);
  assert.equal(r.rec.best.neon, 12000);
  assert.equal(r.rec.games, 1);
  r = Rec.applyResult(r.rec, { table: 'neon', score: 5000, stats: { missions: 1 }, missionsMode: false });
  assert.equal(r.newRecord, false);
  assert.equal(r.rec.best.neon, 12000);
  assert.deepEqual(r.unlockedNow, []);
  r = Rec.applyResult(r.rec, { table: 'neon', score: 60000, stats: { missions: 0 }, missionsMode: false });
  assert.deepEqual(r.unlockedNow, ['space']);
  assert.equal(Rec.isUnlocked(r.rec, 'space'), true);
  // unlock by missions
  let q = Rec.normalize({ missions: 6 });
  assert.equal(q.unlocked.space, true);
  // persistence round-trip & garbage tolerant
  const round = Rec.normalize(JSON.parse(JSON.stringify(r.rec)));
  assert.deepEqual(round, r.rec);
  const bad = Rec.normalize({ best: { neon: 'x', space: -4 }, games: NaN, settings: { balls: 9 }, last: 'zzz' });
  assert.equal(bad.best.neon, 0); assert.equal(bad.settings.balls, 3); assert.equal(bad.last, 'neon');
  assert.ok(Rec.xpFor(0) >= 5 && Rec.xpFor(1e9) <= 80);
});

test('full random game terminates on both tables with sane results', () => {
  for (const id of TABLE_IDS) {
    for (const seed of [1, 2, 3]) {
      const g = new Game({ table: id, seed, balls: 3 });
      const r = rnd(seed);
      let t = 0, nextToggle = 0, lastPlunge = 0;
      while (g.phase !== 'over' && t < 60 * 60 * 6) {
        if (g.phase === 'ready') { g.plunger(true); if (g.charge > 0.8 + r() * 0.2) g.plunger(false); }
        if (t >= nextToggle) { g.pressFlipper('L', r() < 0.5); g.pressFlipper('R', r() < 0.5); nextToggle = t + 4 + Math.floor(r() * 30); }
        g.update(1 / 60); g.takeFx(); t++;
        assert.ok(Number.isFinite(g.score));
      }
      assert.equal(g.phase, 'over', `${id}/${seed} ends`);
      assert.ok(g.score > 0);
    }
  }
});
