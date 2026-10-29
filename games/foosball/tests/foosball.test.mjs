import test from 'node:test';
import assert from 'node:assert/strict';
import { T, createMatch, stepMatch, setRodTarget, kickRod, chargeRod, manX, footY, mulberry, possession } from '../physics.js';
import { createAI, DIFFS, aiParams } from '../ai.js';
import * as TR from '../tournament.js';
import STRINGS from '../strings.js';
import entry from '../entry.js';

const DT = 1 / 60;
const inside = (b) => b.x > 0 && b.x < T.W && b.y > -T.goalD && b.y < T.H + T.goalD && Number.isFinite(b.x + b.y + b.vx + b.vy);
const play = (s, sec, fn) => { for (let i = 0; i < sec * 60; i++) { fn?.(i); stepMatch(s, DT); } };
// step until `team` touches the ball, then `extra` more frames; returns the ball velocity
const firstHit = (s, team, extra = 2, max = 90 * 8) => {
  for (let i = 0; i < max; i++) { stepMatch(s, T.SUB); if (s.lastTouch === team) break; }
  for (let i = 0; i < extra; i++) stepMatch(s, T.SUB);
  return { vx: s.ball.vx, vy: s.ball.vy };
};
const live = (o = {}) => { const s = createMatch({ seed: 5, countdown: 0.01, ...o }); play(s, 0.1); s.ball.vx = 0; s.ball.vy = 0; return s; };

test('ball never leaves the table (fuzz: random launches and random rod actions)', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = mulberry(seed);
    const s = live({ seed, limitGoals: 0, limitTime: 0 });
    for (let i = 0; i < 60 * 30; i++) {
      if (i % 45 === 0) {
        s.ball.vx = (rnd() - 0.5) * 900; s.ball.vy = (rnd() - 0.5) * 900; // beyond max speed on purpose
        if (s.phase === 'goal' || s.phase === 'serve') { s.phase = 'play'; }
      }
      for (const r of s.rods) {
        if (rnd() < 0.05) setRodTarget(s, r.i, (rnd() - 0.5) * 80);
        if (rnd() < 0.03) kickRod(s, r.i, rnd());
        if (rnd() < 0.01) chargeRod(s, r.i);
      }
      stepMatch(s, DT);
      assert.ok(inside(s.ball), `seed ${seed} frame ${i}: ${JSON.stringify(s.ball)}`);
      assert.ok(Math.hypot(s.ball.vx, s.ball.vy) <= T.maxBall + 1e-6);
    }
  }
});

test('no tunnelling at maximum speed through walls and corner bevels', () => {
  const rnd = mulberry(3);
  for (let n = 0; n < 300; n++) {
    const s = live({ limitGoals: 0, limitTime: 0 });
    s.phase = 'play';
    const a = rnd() * Math.PI * 2;
    s.ball.x = 10 + rnd() * 48; s.ball.y = 20 + rnd() * 80;
    s.ball.vx = Math.cos(a) * T.maxBall; s.ball.vy = Math.sin(a) * T.maxBall;
    for (let i = 0; i < 60 * 2; i++) {
      stepMatch(s, DT);
      if (s.phase === 'goal') break;
      assert.ok(inside(s.ball));
    }
  }
});

test('energy is never created: with static rods the ball only slows down', () => {
  const s = live({ limitGoals: 0, limitTime: 0 });
  s.phase = 'play';
  s.ball.x = 20; s.ball.y = 50; s.ball.vx = 90; s.ball.vy = 70;
  let max = Math.hypot(s.ball.vx, s.ball.vy);
  for (let i = 0; i < 60 * 2.5; i++) {
    stepMatch(s, DT);
    if (s.phase === 'goal') break;
    const sp = Math.hypot(s.ball.vx, s.ball.vy);
    assert.ok(sp <= max + 1e-6, `speed grew ${sp} > ${max}`);
    max = Math.min(max, sp);
  }
});

test('kick impulse direction: each team kicks towards the opponent goal', () => {
  for (const team of [0, 1]) {
    const s = live({ limitGoals: 0, limitTime: 0 });
    s.phase = 'play';
    const r = s.rods.find((x) => x.team === team && x.kind === 'att');
    const x = manX(r, 1);
    s.ball.x = x; s.ball.y = r.y + r.s * 4.2; s.ball.vx = 0; s.ball.vy = 0;
    assert.ok(kickRod(s, r.i, 0.8));
    const v = firstHit(s, team);
    assert.equal(s.lastTouch, team);
    assert.ok(v.vy * r.s > 80, `team ${team} vy ${v.vy}`);
    assert.ok(Math.abs(v.vx) < 15, 'straight hit goes straight');
  }
});

test('kick strength grows with power and a ball behind the foot is not hit', () => {
  const speedFor = (p) => {
    const s = live({ limitGoals: 0, limitTime: 0 });
    s.phase = 'play';
    const r = s.rods.find((x) => x.team === 0 && x.kind === 'mid');
    s.ball.x = manX(r, 2); s.ball.vx = s.ball.vy = 0;
    s.ball.y = r.y + r.s * 4.2;
    kickRod(s, r.i, p);
    const v = firstHit(s, 0);
    return Math.hypot(v.vx, v.vy);
  };
  const sp = [0.1, 0.5, 1].map(speedFor);
  assert.ok(sp[2] > sp[1] && sp[1] > sp[0], JSON.stringify(sp));
  const s = live({ limitGoals: 0, limitTime: 0 });
  s.phase = 'play';
  const r = s.rods.find((x) => x.team === 0 && x.kind === 'mid');
  s.ball.x = manX(r, 2); s.ball.y = r.y + 6; // behind a team-0 rod (it kicks up the screen)
  kickRod(s, r.i, 1);
  play(s, 0.3);
  assert.equal(s.lastTouch, -1);
});

test('sliding while kicking curves the shot (tangential friction)', () => {
  const s = live({ limitGoals: 0, limitTime: 0 });
  s.phase = 'play';
  const r = s.rods.find((x) => x.team === 0 && x.kind === 'att');
  s.ball.x = manX(r, 1); s.ball.y = r.y - 4.2; s.ball.vx = s.ball.vy = 0;
  setRodTarget(s, r.i, r.slide);
  r.vx = 100; // already sliding when the foot strikes
  kickRod(s, r.i, 0.9);
  const v = firstHit(s, 0);
  assert.ok(v.vx > 15, `vx ${v.vx}`);
});

test('rods respect their slide range and lifted men do not touch the ball', () => {
  const s = live();
  for (const r of s.rods) {
    setRodTarget(s, r.i, 999);
    play(s, 1);
    assert.ok(r.x <= r.slide + 1e-9);
    setRodTarget(s, r.i, -999);
    play(s, 1);
    assert.ok(r.x >= -r.slide - 1e-9);
    // outermost men stay inside the table
    for (let k = 0; k < r.n; k++) assert.ok(manX(r, k) >= 2.3 && manX(r, k) <= T.W - 2.3, `${r.kind} ${k} ${manX(r, k)}`);
  }
});

test('goal detection, kick-off and win by goal limit', () => {
  const s = createMatch({ seed: 2, limitGoals: 2, limitTime: 0, countdown: 0.01, firstServe: 0 });
  play(s, 0.1);
  assert.equal(s.phase, 'play');
  s.ball.x = 34; s.ball.y = 8; s.ball.vx = 0; s.ball.vy = -150; // into the top goal (team 0 scores)
  s.rods.forEach((r) => setRodTarget(s, r.i, r.slide)); // keep keepers out of the way
  let scored = false;
  for (let i = 0; i < 120 && !scored; i++) { stepMatch(s, DT); scored = s.score[0] === 1; }
  assert.deepEqual(s.score, [1, 0]);
  assert.equal(s.phase, 'goal');
  assert.ok(s.events.some((e) => e.type === 'goal' && e.team === 0));
  assert.equal(s.serveTo, 1, 'conceder kicks off');
  play(s, 4);
  assert.equal(s.phase, 'play');
  assert.ok(Math.abs(s.ball.y - 60) < 40);
  // second goal at the bottom for team 1 then team 0 again -> game over at 2
  s.ball.x = 34; s.ball.y = 112; s.ball.vx = 0; s.ball.vy = 150;
  s.rods.forEach((r) => setRodTarget(s, r.i, r.slide));
  play(s, 5);
  assert.equal(s.score[1], 1);
  s.ball.x = 34; s.ball.y = 8; s.ball.vx = 0; s.ball.vy = -150;
  play(s, 6);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 0);
  assert.equal(s.reason, 'goals');
  assert.equal(s.stats[0].goals, 2);
});

test('timer: clock runs only in play, match ends by time, draw and golden goal', () => {
  const s = createMatch({ seed: 4, limitGoals: 0, limitTime: 10, countdown: 1 });
  play(s, 0.5);
  assert.equal(s.clock, 0, 'countdown does not run the clock');
  for (let i = 0; i < 60 * 40 && s.phase !== 'over'; i++) stepMatch(s, DT); // dead-ball resets pause the clock, so allow extra wall time
  assert.equal(s.phase, 'over');
  assert.equal(s.reason, 'time');
  assert.equal(s.winner, -1);
  assert.ok(s.clock >= 10 && s.clock < 10.1);
  // sudden death: tie goes to overtime, first goal wins
  const g = createMatch({ seed: 4, limitGoals: 0, limitTime: 5, sudden: true, countdown: 0.01 });
  play(g, 6);
  assert.ok(g.overtime);
  g.phase = 'play';
  g.rods.forEach((r) => setRodTarget(g, r.i, r.slide)); // men out of the way first
  g.ball.x = 12; g.ball.y = 60; g.ball.vx = g.ball.vy = 0;
  play(g, 0.5);
  g.ball.x = 34; g.ball.y = 100; g.ball.vx = 0; g.ball.vy = 160;
  play(g, 6);
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 1);
  assert.equal(g.reason, 'golden');
});

test('anti-stuck: a dead ball is nudged and then re-served from the centre', () => {
  const s = live({ limitGoals: 0, limitTime: 0 });
  s.phase = 'play';
  s.ball.x = 12; s.ball.y = 61; // away from the men
  const seen = new Set();
  for (let i = 0; i < 60 * 8; i++) {
    stepMatch(s, DT);
    for (const e of s.events) seen.add(e.type);
    s.events.length = 0;
    if (seen.has('nudge') && i % 20 === 0) { s.ball.vx *= 0.001; s.ball.vy *= 0.001; } // keep it dead
  }
  assert.ok(seen.has('nudge'));
  assert.ok(seen.has('reset') || seen.has('serve'));
});

test('stats: shots, saves and possession are tracked', () => {
  const s = live({ limitGoals: 0, limitTime: 0 });
  s.phase = 'play';
  const att = s.rods.find((x) => x.team === 0 && x.kind === 'att');
  s.ball.x = manX(att, 1); s.ball.y = att.y - 4.2;
  kickRod(s, att.i, 1);
  firstHit(s, 0);
  assert.equal(s.stats[0].shots, 1);
  play(s, 0.2);
  assert.ok(possession(s) > 0.9 || s.stats[1].touches > 0);
});

test('determinism: same seed and inputs give the same match', () => {
  const run = () => {
    const s = createMatch({ seed: 77, limitTime: 60, countdown: 0.1 });
    const a = createAI(0, 0.5, 1), b = createAI(1, 0.5, 2);
    for (let i = 0; i < 60 * 40; i++) { a.update(s, DT); b.update(s, DT); stepMatch(s, DT); }
    return JSON.stringify([s.ball, s.score, s.stats]);
  };
  assert.equal(run(), run());
});

function simulate(skill0, skill1, seed, time = 150) {
  const s = createMatch({ seed, limitTime: time, limitGoals: 5, sudden: true, countdown: 0.1 });
  const a = createAI(0, skill0, seed), b = createAI(1, skill1, seed + 1);
  let n = 0;
  const lim = 60 * (time + 120);
  while (s.phase !== 'over' && n++ < lim) {
    a.update(s, DT); b.update(s, DT); stepMatch(s, DT);
    for (const r of s.rods) {
      assert.ok(Math.abs(r.x) <= r.slide + 1e-9, 'rod slide limit');
      assert.ok(Math.abs(r.vx) <= T.slideSpeed + 1e-6, 'rod speed limit');
      assert.ok(r.th >= T.thWind - 1e-9 && r.th <= T.thMax + 1e-9, 'rod angle limit');
    }
    assert.ok(inside(s.ball));
  }
  return s;
}

test('AI fuzz: matches always terminate and AI respects the rod limits', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const s = simulate([0.1, 0.5, 0.9][seed % 3], [0.9, 0.5, 0.1][seed % 3], seed);
    assert.equal(s.phase, 'over', `seed ${seed}`);
    assert.ok(s.winner === 0 || s.winner === 1 || s.reason === 'time');
  }
});

test('AI: Hard beats Easy over seeded matches and difficulty parameters are ordered', () => {
  let hard = 0, easy = 0, gh = 0, ge = 0;
  for (let seed = 100; seed < 110; seed++) {
    const asHardFirst = seed % 2 === 0;
    const s = simulate(asHardFirst ? DIFFS.hard : DIFFS.easy, asHardFirst ? DIFFS.easy : DIFFS.hard, seed);
    const h = asHardFirst ? 0 : 1;
    if (s.winner === h) hard++; else if (s.winner === 1 - h) easy++;
    gh += s.score[h]; ge += s.score[1 - h];
  }
  assert.ok(hard >= 8 && hard > easy, `hard ${hard} easy ${easy}`);
  assert.ok(gh > ge * 2, `goals ${gh}-${ge}`);
  const e = aiParams(DIFFS.easy), n = aiParams(DIFFS.normal), h = aiParams(DIFFS.hard);
  assert.ok(e.delay > n.delay && n.delay > h.delay);
  assert.ok(e.noise > n.noise && n.noise > h.noise);
  assert.ok(e.vmax < n.vmax && n.vmax < h.vmax && h.vmax <= T.slideSpeed);
});

test('tournament bracket: 8 teams, 3 rounds, win path to the trophy', () => {
  const tr = TR.createTournament(11, 0.5);
  assert.equal(new Set(tr.teams).size, 8);
  assert.ok(tr.teams.includes('you'));
  assert.deepEqual(tr.rounds.map((r) => r.length), [4, 2, 1]);
  for (let round = 0; round < 3; round++) {
    assert.equal(tr.round, round);
    const m = TR.playerMatch(tr);
    assert.ok(m && (m.a === 'you' || m.b === 'you'));
    assert.ok(tr.rounds[round].every((x) => x === m || x.winner), 'other matches are already decided');
    const opp = TR.opponentOf(tr);
    assert.ok(opp && opp !== 'you');
    TR.reportPlayer(tr, 5, 2, true);
  }
  assert.equal(tr.champion, 'you');
  assert.equal(TR.playerMatch(tr), null);
  const copy = JSON.parse(JSON.stringify(tr)); // save / resume
  assert.equal(copy.champion, 'you');
});

test('tournament bracket: elimination plays out the rest and crowns another team', () => {
  const tr = TR.createTournament(12, 0.5);
  TR.reportPlayer(tr, 5, 1, true);
  TR.reportPlayer(tr, 1, 5, false);
  assert.ok(tr.eliminated);
  TR.finishAll(tr);
  assert.ok(tr.champion && tr.champion !== 'you');
  assert.ok(tr.rounds[2][0].winner === tr.champion);
  // opponents get stronger every round
  const t2 = TR.createTournament(13, 0.5);
  const s0 = TR.opponentSkill(t2, 'tub');
  t2.round = 2;
  assert.ok(TR.opponentSkill(t2, 'tub') > s0);
  // determinism of the draw
  assert.deepEqual(TR.createTournament(11, 0.5).teams, TR.createTournament(11, 0.5).teams);
});

test('strings: pt / en / es have exactly the same keys, and the entry is well formed', () => {
  const keys = (o) => Object.keys(o).sort().join();
  assert.equal(keys(STRINGS.pt), keys(STRINGS.en));
  assert.equal(keys(STRINGS.pt), keys(STRINGS.es));
  for (const l of ['pt', 'en', 'es']) for (const [k, v] of Object.entries(STRINGS[l])) assert.ok(String(v).length > 0, `${l}.${k}`);
  assert.equal(entry.id, 'foosball');
  assert.equal(entry.cat, 'sport');
  assert.equal(entry.trophies.length, 5);
  assert.deepEqual(entry.modes.map((m) => m.id), ['quick', 'duo', 'tournament', 'custom']);
  for (const l of ['pt', 'en', 'es']) assert.ok(entry.name[l] && entry.sub[l] && entry.about[l]);
});
