// Tournament runtime: sit&go, KO, MTT (other tables simulated hand-for-hand with the same engine), duels, championship.
// State `t` is plain JSON (resumable mid-hand). Randomness: every deal / AI decision derives its seed from (t.seed, round, table, action count)
// so a reloaded tournament continues identically. Nobody ever sees hidden cards: AIs get engine.viewFor() only.
import { createHand, applyAction, legalActions, viewFor, publicView } from '../engine/hand.js';
import { evaluate } from '../engine/eval.js';
import { mulberry32, mixSeed, shuffle } from '../engine/rng.js';
import { decide } from '../ai/decide.js';
import { makeProfile, randomProfile } from '../ai/profiles.js';
import { levelAt, payoutLadder, prizeAmounts, placePoints } from './structures.js';
import { fillerName } from './names.js';

/**
 * def: {id, circuit, format, entrants, tableSize, startStack, structure, buyIn, bounty?, mult, fieldSkill:[lo,hi],
 *       rivals:[{id, name, profile(params obj), avatar}]  (specific entrants, filled first), payoutKind?, day2Frac?}
 * opts: {player:{id,name,avatar}, seed}
 */
export function createTournament(def, opts) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(mixSeed(seed, 77));
  const player = opts.player || { id: 'hero', name: 'You', avatar: 'p1' };
  const tableSize = Math.min(def.tableSize || 9, def.entrants);
  const used = new Set([player.name]);
  const ents = [];
  const add = (e) => { ents.push({ idx: ents.length, stack: def.startStack, out: false, place: null, bustedBy: null, ko: 0, table: -1, seat: -1, ...e }); };
  add({ id: player.id, name: player.name, avatar: player.avatar || 'p1', isPlayer: true, rivalId: null, profile: null });
  for (const r of def.rivals || []) { if (ents.length >= def.entrants) break; used.add(r.name); add({ id: r.id, name: r.name, avatar: r.avatar || r.id, isPlayer: false, rivalId: r.rivalId ?? r.id, profile: r.profile }); }
  const [lo, hi] = def.fieldSkill || [3, 6];
  let k = 0;
  while (ents.length < def.entrants) {
    const skill = lo + (hi - lo) * rng();
    const name = fillerName(rng, used);
    add({ id: 'f' + (k++), name, avatar: 'f' + Math.floor(rng() * 12), isPlayer: false, rivalId: null, profile: randomProfile(rng, skill) });
  }
  // seating: shuffled, dealt round-robin to ceil(n / tableSize) tables
  const nTables = Math.ceil(def.entrants / tableSize);
  const order = shuffle(ents.map((e) => e.idx), rng);
  const tables = [];
  for (let i = 0; i < nTables; i++) tables.push({ id: i, seats: new Array(tableSize).fill(-1), buttonSeat: 0 });
  order.forEach((ei, j) => { const tb = tables[j % nTables]; const s = tb.seats.indexOf(-1); tb.seats[s] = ei; ents[ei].table = tb.id; ents[ei].seat = s; });
  for (const tb of tables) { const occ = tb.seats.map((e, i) => (e >= 0 ? i : -1)).filter((i) => i >= 0); tb.buttonSeat = occ[Math.floor(rng() * occ.length)]; }
  const ladder = def.payout || payoutLadder(def.entrants, def.payoutKind || 'auto');
  const pool = (def.buyIn || 0) * def.entrants + (def.guarantee || 0);
  const t = {
    v: 1, defId: def.id, def: JSON.parse(JSON.stringify(stripDef(def))), seed, phase: 'between', round: 0, level: 0, handsInLevel: 0, playerId: player.id,
    entrants: ents, tables, playerTable: ents[0].table, remaining: def.entrants, tableSize,
    ladder, prizePool: pool, prizes: prizeAmounts(pool, ladder), stage: 'day1', hand: null, handTable: -1, lastHand: null,
    stats: {}, agents: {}, busts: [], events: [], totalChips: def.startStack * def.entrants,
    feats: { handsWon: 0, handsPlayed: 0, biggestPot: 0, bluffWins: 0, allInWins: 0, shortStacked: false, comeback: false, bestCat: -1, koList: [], peakStack: def.startStack },
    pending: null, spectate: false,
  };
  t.stage = stageOf(t);
  return t;
}
const stripDef = (d) => { const c = { ...d }; c.rivals = (d.rivals || []).map((r) => ({ id: r.id, rivalId: r.rivalId ?? r.id, name: r.name, avatar: r.avatar })); return c; };

export const human = (t) => t.entrants[0];
const alive = (t) => t.entrants.filter((e) => !e.out);
export function stageOf(t) {
  if (t.def.format !== 'championship') return t.remaining <= t.tableSize ? 'final' : 'day1';
  if (t.remaining <= t.tableSize) return 'final';
  return t.remaining > t.def.entrants * (t.def.day2Frac || 0.4) ? 'day1' : 'day2';
}
export function blindsNow(t) { return levelAt(t.def.structure, t.level); }
function handsPerLevel(t) { return t.stage === 'final' ? t.def.structure.handsPerLevelFinal : t.def.structure.handsPerLevel; }

/** Public HUD info for the current tournament state. */
export function standing(t) {
  const a = alive(t); const me = human(t);
  const stacks = a.map((e) => e.stack).sort((x, y) => y - x);
  const bl = blindsNow(t), nb = levelAt(t.def.structure, t.level + 1);
  const paid = t.ladder.length;
  return {
    entrants: t.def.entrants, remaining: t.remaining, avgStack: Math.round(t.totalChips / Math.max(1, t.remaining)), level: t.level + 1,
    blinds: bl, nextBlinds: nb, handsToNextLevel: Math.max(0, handsPerLevel(t) - t.handsInLevel), stage: t.stage,
    playerOut: me.out, playerPlace: me.place, playerStack: me.stack, chipRank: me.out ? null : stacks.indexOf(me.stack) + 1,
    tablesLeft: t.tables.length, paid, inMoney: t.remaining <= paid, bubble: t.remaining === paid + 1,
    nextPrize: t.prizes[Math.min(t.remaining, paid) - 1] ?? 0, prizePool: t.prizePool, round: t.round,
    finalTable: t.remaining <= t.tableSize && t.def.entrants > t.tableSize,
  };
}
export function playerTableInfo(t) {
  const tb = t.tables.find((x) => x.id === t.playerTable) || t.tables[0];
  return { id: tb.id, seats: tb.seats.map((ei) => (ei < 0 ? null : t.entrants[ei])) };
}

// ---------- starting rounds / hands ----------
function nextOccupiedSeat(tb, from) { const n = tb.seats.length; for (let k = 1; k <= n; k++) { const s = (from + k) % n; if (tb.seats[s] >= 0) return s; } return from; }

function dealTable(t, tb, round) {
  const bl = blindsNow(t);
  tb.buttonSeat = nextOccupiedSeat(tb, tb.buttonSeat);
  const seats = []; let btnIdx = 0;
  tb.seats.forEach((ei, s) => { if (ei >= 0) { if (s === tb.buttonSeat) btnIdx = seats.length; seats.push(t.entrants[ei]); } });
  if (seats.length < 2) return null;
  const { state, events } = createHand({
    players: seats.map((e) => ({ id: e.id, stack: e.stack })), button: btnIdx, sb: bl.sb, bb: bl.bb, ante: bl.ante,
    seed: mixSeed(t.seed, 1001, round, tb.id), handNo: round,
  });
  return { state, events };
}
const idMaps = new WeakMap();
const entById = (t, id) => { let m = idMaps.get(t); if (!m || m.size !== t.entrants.length) { m = new Map(t.entrants.map((e) => [e.id, e])); idMaps.set(t, m); } return m.get(id); };

function aiChoose(t, state, fast, profileOverride) {
  const idx = state.toAct; const id = state.players[idx].id; const e = entById(t, id);
  const view = viewFor(state, idx);
  const rng = mulberry32(mixSeed(t.seed, 2002, state.handNo, state.log.length, idx, e.idx));
  const s = standing(t);
  const ctx = { stats: t.stats, agent: (t.agents[id] ||= { tilt: 0 }), fast, pressure: { bubble: s.bubble, finalTable: s.finalTable, avgStack: s.avgStack, playersLeft: t.remaining, paid: s.paid } };
  return decide(view, profileOverride || e.profile || makeProfile('balanced'), rng, ctx);
}

/** Start the next round: simulate every other table by one hand, then deal the player's table.
 *  opts.interactive=false (or player out without spectate) simulates the whole round and returns hand=null. */
export function startNextHand(t, opts = {}) {
  if (t.phase === 'finished') return { events: [], hand: null };
  if (t.phase === 'hand') throw new Error('hand in progress');
  const interactive = opts.interactive !== false;
  const me = human(t);
  t.round++; t.events = [];
  const round = t.round;
  t.pending = { busts: [] };
  let focus = -1;
  if (interactive && !me.out) focus = t.playerTable;
  else if (interactive && me.out && (opts.spectate || t.spectate)) {
    t.spectate = true;
    const tb = t.tables.slice().sort((a, b) => b.seats.filter((x) => x >= 0).length - a.seats.filter((x) => x >= 0).length || a.id - b.id)[0];
    focus = tb.id; t.playerTable = tb.id;
  }
  for (const tb of t.tables) {
    if (tb.id === focus) continue;
    const h = dealTable(t, tb, round); if (!h) continue;
    while (h.state.phase === 'betting') applyAction(h.state, aiChoose(t, h.state, true));
    applyHandResults(t, h.state, tb);
  }
  if (focus >= 0) {
    const tb = t.tables.find((x) => x.id === focus);
    const h = dealTable(t, tb, round);
    if (h) {
      t.hand = h.state; t.handTable = tb.id; t.phase = 'hand'; t.pending.start = h.events;
      if (h.state.phase === 'done') { // everything was all-in from the blinds/antes: nothing to decide, hand is already over
        const st = h.state; concludeInteractive(t);
        return { events: t.events.slice(), hand: null, handEvents: h.events, instant: true, finishedHand: st };
      }
      return { events: t.events.slice(), hand: t.hand, handEvents: h.events };
    }
  }
  finalizeRound(t);
  return { events: t.events.slice(), hand: null };
}

export function actor(t) {
  if (t.phase !== 'hand' || !t.hand || t.hand.phase !== 'betting') return { kind: null, idx: -1 };
  const idx = t.hand.toAct;
  return { kind: t.hand.players[idx].id === t.playerId ? 'human' : 'ai', idx, id: t.hand.players[idx].id };
}
/** Apply an action for the current actor (human or AI). Concludes the hand + round when the hand ends. */
export function act(t, action) {
  if (t.phase !== 'hand') throw new Error('no hand in progress');
  const ev = applyAction(t.hand, action);
  if (t.hand.phase === 'done') concludeInteractive(t);
  return ev;
}
export function aiAct(t) {
  const a = actor(t);
  if (a.kind !== 'ai') throw new Error('not an AI turn');
  const action = aiChoose(t, t.hand, false);
  const events = act(t, action);
  return { action, events, idx: a.idx };
}
/** Let a bot (profile) play the human seat's current turn: used by headless simulators / tests. */
export function botAct(t, profile) {
  const a = actor(t);
  if (a.kind !== 'human') throw new Error('not the human turn');
  const action = aiChoose(t, t.hand, false, profile);
  return { action, events: act(t, action), idx: a.idx };
}
/** Play the whole tournament headlessly with a bot in the human seat (profile object). */
export function simulateWithBot(t, profile, maxRounds = 5000) {
  let g = 0;
  while (t.phase !== 'finished' && !human(t).out) {
    if (t.phase !== 'hand') startNextHand(t, { interactive: true });
    while (t.phase === 'hand') { const a = actor(t); if (a.kind === 'human') botAct(t, profile); else aiAct(t); }
    if (++g > maxRounds) throw new Error('tournament did not terminate');
  }
  return simulateToEnd(t);
}
export function legal(t) { return t.hand ? legalActions(t.hand) : null; }
export function humanView(t) { return t.hand ? publicView(t.hand, t.hand.players.findIndex((p) => p.id === t.playerId)) : null; }

function concludeInteractive(t) {
  const tb = t.tables.find((x) => x.id === t.handTable);
  const st = t.hand;
  trackFeats(t, st);
  applyHandResults(t, st, tb);
  t.lastHand = summarizeHand(t, st);
  t.hand = null; t.handTable = -1;
  finalizeRound(t);
}

function summarizeHand(t, st) {
  const r = st.result;
  const meIdx = st.players.findIndex((p) => p.id === t.playerId);
  return { handNo: st.handNo, board: st.board.slice(), showdown: r.showdown, pots: r.pots, results: r.results, reveals: r.reveals, log: st.log, players: st.players.map((p) => ({ id: p.id, hole: p.hole.slice(), folded: p.folded, showed: p.showed })), playerIdx: meIdx, pot: r.total };
}

function trackFeats(t, st) {
  const f = t.feats; const me = st.players.findIndex((p) => p.id === t.playerId);
  if (me < 0) return;
  const p = st.players[me]; const r = st.result;
  f.handsPlayed++;
  const won = r.pots.some((x) => x.shares.some((s) => s.p === me));
  const gain = p.stack - p.startStack;
  if (won && gain > 0) { f.handsWon++; f.biggestPot = Math.max(f.biggestPot, r.total); }
  if (won && st.players.some((q) => q.allIn && q.i !== me) && r.showdown) f.allInWins++;
  if (r.uncontestedWinner === me && st.board.length >= 3) {
    const cat = evaluate(p.hole.concat(st.board)) >> 20;
    const bet = st.log.some((e) => e.t === 'action' && e.p === me && (e.type === 'bet' || e.type === 'raise') && e.street !== 'preflop');
    if (cat === 0 && bet) f.bluffWins++;
  }
  if (r.showdown && !p.folded) { const cat = evaluate(p.hole.concat(st.board)) >> 20; f.bestCat = Math.max(f.bestCat, cat); }
}

// ---------- results ----------
function applyHandResults(t, st, tb) {
  const r = st.result;
  const hum = st.players.findIndex((p) => p.id === t.playerId);
  updateStats(t, st);
  for (const p of st.players) {
    const e = entById(t, p.id); e.stack = p.stack;
    // tilt tracking
    const ag = (t.agents[p.id] ||= { tilt: 0 });
    const lost = (p.startStack - p.stack) / Math.max(1, t.def.startStack);
    ag.tilt = Math.max(0, Math.min(1, ag.tilt * 0.85 + (lost > 0.25 ? 0.3 : 0)));
  }
  if (hum >= 0) {
    const e = human(t); const f = t.feats; f.peakStack = Math.max(f.peakStack, e.stack);
    const bb = blindsNow(t).bb;
    if (e.stack > 0 && e.stack <= 6 * bb) f.shortStacked = true;
    if (f.shortStacked && e.stack >= t.def.startStack) f.comeback = true;
  }
  for (const p of st.players) {
    if (p.stack > 0) continue;
    // who knocked him out: biggest winner from pots he contributed to
    const credit = new Map();
    for (const pot of r.pots) if (pot.eligible.includes(p.i)) for (const s of pot.shares) if (s.p !== p.i) credit.set(s.p, (credit.get(s.p) || 0) + s.amount);
    let by = null, best = -1; for (const [k, v] of credit) if (v > best) { best = v; by = k; }
    t.pending.busts.push({ id: p.id, startStack: p.startStack, by: by == null ? null : st.players[by].id, table: tb.id });
  }
}
function updateStats(t, st) {
  const seen = new Set(); const pf = new Set(); const raised = new Set();
  for (const e of st.log) {
    if (e.t !== 'action' || e.street !== 'preflop') continue;
    const id = st.players[e.p].id;
    if (e.type === 'call' || e.type === 'raise' || e.type === 'bet') pf.add(id);
    if (e.type === 'raise' || e.type === 'bet') raised.add(id);
  }
  for (const p of st.players) { const s = (t.stats[p.id] ||= { hands: 0, vpip: 0, pfr: 0, bets: 0, calls: 0 }); s.hands++; if (pf.has(p.id)) s.vpip++; if (raised.has(p.id)) s.pfr++; seen.add(p.id); }
  for (const e of st.log) {
    if (e.t !== 'action') continue; const s = t.stats[st.players[e.p].id];
    if (e.type === 'raise' || e.type === 'bet') s.bets++; else if (e.type === 'call') s.calls++;
  }
}

function finalizeRound(t) {
  const busts = t.pending.busts; t.pending = null;
  if (t.def.format === 'quick') { // cash-style: busted players rebuy automatically, blinds fixed, never finishes
    for (const b of busts) { const e = entById(t, b.id); e.stack = t.def.startStack; e.rebuys = (e.rebuys || 0) + 1; t.totalChips += t.def.startStack; t.events.push({ t: 'rebuy', id: e.id, isPlayer: e.isPlayer }); }
    t.phase = 'between'; return;
  }
  const before = t.remaining;
  // worse start stack => worse place; ties by id for determinism
  busts.sort((a, b) => a.startStack - b.startStack || (a.id < b.id ? -1 : 1));
  const evs = t.events;
  let place = before;
  const me = human(t);
  for (const b of busts) {
    const e = entById(t, b.id); e.out = true; e.place = place--; e.bustedBy = b.by; e.stack = 0;
    const killer = b.by ? entById(t, b.by) : null; if (killer) killer.ko++;
    t.busts.push({ id: e.id, place: e.place, round: t.round, level: t.level + 1, by: b.by });
    evs.push({ t: 'bust', id: e.id, place: e.place, by: b.by, table: b.table, isPlayer: e.isPlayer, rivalId: e.rivalId });
    if (killer && killer.isPlayer) t.feats.koList.push(e.id);
    for (const tb of t.tables) { const s = tb.seats.indexOf(e.idx); if (s >= 0) tb.seats[s] = -1; }
  }
  t.remaining = before - busts.length;
  if (t.remaining <= 1) {
    const w = alive(t)[0]; if (w) { w.place = 1; w.out = true; }
    t.remaining = 0 + (w ? 1 : 0); t.phase = 'finished'; evs.push({ t: 'finished', winner: w ? w.id : null });
    t.stage = 'final';
    return;
  }
  rebalance(t, evs);
  const prevStage = t.stage; t.stage = stageOf(t);
  if (t.stage !== prevStage) evs.push({ t: 'stage', stage: t.stage });
  if (t.remaining <= t.tableSize && t.def.entrants > t.tableSize && !t._ftSeen) { t._ftSeen = true; evs.push({ t: 'final_table' }); }
  if (t.remaining === t.ladder.length + 1 && t.def.entrants > t.ladder.length + 1) evs.push({ t: 'bubble' });
  if (t.remaining === t.ladder.length) evs.push({ t: 'in_the_money' });
  // level clock
  t.handsInLevel++;
  if (t.handsInLevel >= handsPerLevel(t)) { t.handsInLevel = 0; t.level++; evs.push({ t: 'level_up', level: t.level + 1, blinds: blindsNow(t) }); }
  t.phase = 'between';
}

function rebalance(t, evs) {
  const size = (tb) => tb.seats.filter((x) => x >= 0).length;
  const needed = Math.ceil(t.remaining / t.tableSize);
  const move = (ei, to) => {
    const e = t.entrants[ei]; const from = t.tables.find((x) => x.id === e.table);
    from.seats[from.seats.indexOf(ei)] = -1;
    const free = []; to.seats.forEach((x, i) => { if (x < 0) free.push(i); });
    const rng = mulberry32(mixSeed(t.seed, 3003, t.round, ei));
    const s = free[Math.floor(rng() * free.length)];
    to.seats[s] = ei; e.table = to.id; e.seat = s;
    if (e.isPlayer) { t.playerTable = to.id; evs.push({ t: 'player_moved', from: from.id, to: to.id, seat: s }); }
  };
  while (t.tables.length > needed) {
    // break the smallest table (highest id on ties); keep the player's table unless it's the only candidate
    const cand = t.tables.slice().sort((a, b) => size(a) - size(b) || b.id - a.id);
    const br = cand[0];
    evs.push({ t: 'table_broken', table: br.id, players: size(br), playerAffected: br.id === t.playerTable });
    const members = br.seats.filter((x) => x >= 0);
    t.tables.splice(t.tables.indexOf(br), 1);
    for (const ei of members) {
      const target = t.tables.slice().sort((a, b) => size(a) - size(b) || a.id - b.id)[0];
      const e = t.entrants[ei]; e.table = br.id; // temp, to let move() find source
      br.seats[br.seats.indexOf(ei)] = -1; // remove from broken table
      const free = []; target.seats.forEach((x, i) => { if (x < 0) free.push(i); });
      const rng = mulberry32(mixSeed(t.seed, 3004, t.round, ei));
      const s = free[Math.floor(rng() * free.length)];
      target.seats[s] = ei; e.table = target.id; e.seat = s;
      if (e.isPlayer) { t.playerTable = target.id; evs.push({ t: 'player_moved', from: br.id, to: target.id, seat: s, broken: true }); }
    }
  }
  for (;;) {
    const sorted = t.tables.slice().sort((a, b) => size(b) - size(a) || a.id - b.id);
    const big = sorted[0], small = sorted[sorted.length - 1];
    if (size(big) - size(small) < 2) break;
    const members = big.seats.filter((x) => x >= 0);
    const pool = members.filter((ei) => !t.entrants[ei].isPlayer);
    const rng = mulberry32(mixSeed(t.seed, 3005, t.round, big.id));
    const cands = pool.length ? pool : members;
    move(cands[Math.floor(rng() * cands.length)], small);
    evs.push({ t: 'balanced', from: big.id, to: small.id });
  }
}

/** Fast-forward everything (no interaction). Returns when finished. */
export function simulateToEnd(t, maxRounds = 5000) {
  if (t.phase === 'hand') { while (t.phase === 'hand') { const a = actor(t); if (a.kind === 'human') { const L = legal(t); act(t, L.canCheck ? { type: 'check' } : { type: 'fold' }); } else aiAct(t); } }
  let g = 0;
  while (t.phase !== 'finished') { startNextHand(t, { interactive: false }); if (++g > maxRounds) throw new Error('tournament did not terminate'); }
  return tournamentResult(t);
}

export function isFinished(t) { return t.phase === 'finished'; }

/** Final (or current, if the player is out) result for the human. Only meaningful once human.out. */
export function tournamentResult(t) {
  const me = human(t);
  const place = me.place; const entrants = t.def.entrants;
  const paid = t.ladder.length;
  const ko = me.ko;
  const prize = (place && place <= paid ? t.prizes[place - 1] : 0) + (t.def.bounty ? ko * t.def.bounty : 0);
  const points = place ? placePoints({ place, entrants, tableSize: t.tableSize, paid, ko, mult: t.def.mult || 1 }) : 0;
  const rivals = t.entrants.filter((e) => e.rivalId).map((e) => ({
    id: e.rivalId, place: e.place, beatPlayer: place != null && e.place != null && e.place < place, playerBeat: place != null && e.place != null && e.place > place,
    knockedOutPlayer: me.bustedBy === e.id, knockedOutByPlayer: e.bustedBy === me.id,
  }));
  return { defId: t.defId, place, entrants, paid, prize, points, ko, finalTable: place != null && place <= t.tableSize && entrants > t.tableSize, won: place === 1, cashed: place != null && place <= paid, rounds: t.round, rivals, feats: JSON.parse(JSON.stringify(t.feats)), finished: t.phase === 'finished', playerOut: me.out };
}
