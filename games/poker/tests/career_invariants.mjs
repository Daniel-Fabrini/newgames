// Shared invariants: "no impossible career state". Throws (assert) on violation.
import assert from 'node:assert/strict';
import { EVENT_BY_ID, CIRCUITS, QUAL_WORLD } from '../career/circuits.js';
import { levelFromXp, CIRCUIT_IDS } from '../career/career.js';
import { ACHIEVEMENTS } from '../career/achievements.js';
import { isUnlockedCosmetic, COSMETICS } from '../career/rewards.js';
import { evalReq } from '../career/req.js';

export function snapshot(c) { return { xp: c.xp, rep: c.rep, level: c.level, played: c.stats.played, wins: c.stats.wins, unlocked: c.unlocked.slice(), pts: JSON.parse(JSON.stringify(c.pts)), achievements: Object.keys(c.achievements), titles: c.titles.slice(), champion: c.champion, qualified: c.qualifiedWorld, winnings: c.stats.winnings }; }

export function assertCareerSound(c, prev = null) {
  assert.ok(c.unlocked.includes('local'));
  assert.deepEqual(c.unlocked, CIRCUIT_IDS.filter((k) => c.unlocked.includes(k)), 'unlocked circuits keep order');
  // unlock reasons
  const wins = (circ) => Object.entries(c.wonEvents).filter(([id]) => EVENT_BY_ID[id].circuit === circ && EVENT_BY_ID[id].format !== 'duel').reduce((s, [, n]) => s + n, 0);
  if (c.unlocked.includes('regional')) assert.ok(wins('local') >= 1, 'regional unlocked without a local win');
  if (c.unlocked.includes('intl')) assert.ok(c.pts.regional.you >= 220 || c.wonEvents.reg_final > 0, 'intl unlocked without points/title');
  if (c.unlocked.includes('world')) assert.ok(c.qualifiedWorld, 'world unlocked without qualification');
  if (c.qualifiedWorld) assert.ok(c.unlocked.includes('intl'), 'qualified without reaching the international tour');
  // played only in unlocked circuits
  for (const [id, n] of Object.entries(c.playedEvents)) { assert.ok(c.unlocked.includes(EVENT_BY_ID[id].circuit), 'played event of locked circuit ' + id); assert.ok(c.wonEvents[id] === undefined || c.wonEvents[id] <= n); }
  for (const id of Object.keys(c.wonEvents)) assert.ok(c.playedEvents[id] >= c.wonEvents[id]);
  const played = Object.values(c.playedEvents).reduce((a, b) => a + b, 0);
  assert.equal(c.stats.played, played);
  assert.equal(c.stats.wins, Object.entries(c.wonEvents).filter(([id]) => EVENT_BY_ID[id].format !== 'duel').reduce((s, [, n]) => s + n, 0));
  assert.ok(c.stats.wins <= c.stats.played);
  assert.ok(c.stats.finalTables <= c.stats.played && c.stats.cashes <= c.stats.played);
  for (const t of c.titles) { assert.ok(EVENT_BY_ID[t].title); assert.ok(c.wonEvents[t] > 0); }
  if (c.champion > 0) assert.ok(c.wonEvents.world_main > 0);
  if (c.wonEvents.world_main) assert.ok(c.qualifiedWorld);
  assert.equal(c.level, levelFromXp(c.xp));
  assert.ok(c.xp >= 0 && c.rep >= 0 && c.stats.winnings >= 0);
  assert.equal(c.tournament, c.tournament ?? null);
  // achievements: all awarded ones are truly satisfied
  for (const a of ACHIEVEMENTS) if (c.achievements[a.id]) assert.ok((a.cur(c) || 0) >= a.target, 'achievement awarded but not satisfied: ' + a.id);
  // cosmetics: unlocked iff earned; selected ones are owned
  for (const key of c.cosmetics.unlocked) { const [slot, id] = key.split(':'); const it = COSMETICS.find((x) => x.slot === slot && x.id === id); assert.ok(it, key); assert.ok(isUnlockedCosmetic(c, it), 'cosmetic unlocked but not earned: ' + key); }
  for (const [slot, id] of Object.entries(c.cosmetics.selected)) if (id && slot !== 'title') assert.ok(c.cosmetics.unlocked.includes(slot + ':' + id), 'selected cosmetic not owned ' + slot + id);
  assert.ok(c.results.length <= 100);
  for (const r of c.results) { assert.ok(r.place >= 1 && r.place <= r.entrants); }
  for (const circ of CIRCUITS) assert.ok(c.pts[circ.id].you >= 0);
  if (prev) {
    assert.ok(c.xp >= prev.xp && c.rep >= prev.rep && c.level >= prev.level);
    assert.ok(prev.unlocked.every((u) => c.unlocked.includes(u)), 'circuit was re-locked');
    assert.ok(prev.achievements.every((a) => c.achievements[a]), 'achievement lost');
    assert.ok(prev.titles.every((a) => c.titles.includes(a)));
    assert.ok(c.stats.winnings >= prev.winnings && c.champion >= prev.champion);
    if (prev.qualified) assert.ok(c.qualifiedWorld);
    for (const k of ['local', 'regional', 'intl', 'world']) assert.ok(c.pts[k].you >= prev.pts[k].you);
  }
  void QUAL_WORLD; void evalReq;
}
