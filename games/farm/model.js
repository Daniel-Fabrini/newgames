// Game state and rules. Everything time-based stores absolute timestamps, so the farm
// keeps growing while the app is closed. Actions return { ok: true } or { ok: false, err }.
import { isPath, RENOVATE, GRID, START, ITEMS, CROPS, PENS, PROD, DECOR, OBST, REGIONS, GIVERS, CUSTOMERS, QUEST, QUEST_ORDER,
  REGEN_MS, MAX_PENS_ANIMALS, levelInfo, maxEnergy, idx, inBox, unlockCost, fieldCost, kindOf, sizeOf, lvlOf,
  costOf } from './data.js';
import { makeMap } from './expgen.js';
import { rng } from '../../js/core/ui.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MIN = 60e3;

export function createModel(store, hooks = {}) {
  const now = () => Date.now();
  let uidN = 0;
  const uid = () => 'o' + (Date.now() % 1e8).toString(36) + (uidN++);
  const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function fresh(t) {
    const tiles = [];
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      tiles.push({ u: inBox(x, y) && x >= START.x0 && x <= START.x1 && y >= START.y0 && y <= START.y1 ? 1 : 0, f: 0, ob: null, cr: null });
    }
    for (const [x, y] of [[7, 8], [8, 8], [7, 9], [8, 9]]) tiles[idx(x, y)].f = 1;
    // the first wheat is already ripe, so the farm opens golden and ready to harvest
    for (const [x, y] of [[7, 8], [8, 8], [7, 9], [8, 9]]) tiles[idx(x, y)].cr = { id: 'wheat', at: t - CROPS.wheat.grow - 1000 };
    const B = [
      { id: 'house', t: 'house', kind: 'fixed', x: 4, y: 4, w: 2, h: 2 },
      { id: 'barn', t: 'barn', kind: 'barn', x: 10, y: 4, w: 2, h: 2 },
      { id: 'oldhouse', t: 'oldhouse', kind: 'ruin', x: 4, y: 9, w: 2, h: 2 },
      { id: 'coop', t: 'chicken', kind: 'pen', x: 7, y: 4, w: 2, h: 2, cyc: 0, busy: 0, count: 2, st: 2 },
      { id: 'p-hay', t: 'hay', kind: 'prop', x: 9, y: 4, w: 1, h: 1 },
      { id: 'p-crates', t: 'crates', kind: 'prop', x: 9, y: 5, w: 1, h: 1 },
      { id: 'p-barrels', t: 'barrels', kind: 'prop', x: 6, y: 4, w: 1, h: 1 },
    ];
    const used = (x, y) => B.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    const r = rng(91);
    const kinds = ['bush', 'bush', 'bush', 'stump', 'stump', 'rock'];
    for (let y = START.y0; y <= START.y1; y++) for (let x = START.x0; x <= START.x1; x++) {
      const near = (x >= 6 && x <= 9 && y >= 6 && y <= 10);   // keep the field block clear
      const tl = tiles[idx(x, y)];
      if (tl.f || used(x, y) || near || isPath(x, y)) continue;
      if (r() < 0.22) tl.ob = kinds[Math.floor(r() * kinds.length)];
    }
    return {
      v: 2, coins: 120, gems: 5, energy: 100, eAt: t, xp: 0, whUp: 0,
      inv: { wood: 6 }, tiles, nid: 1, renov: false, B,
      stats: {}, qSeq: 0, quests: [], orders: [], train: null, ship: null,
      nextTrain: t + 4 * MIN, nextShip: t + 12 * MIN, exp: {}, run: null,
    };
  }

  let S = (() => {
    const v = store.get('save', null);
    return v && v.v === 2 ? v : fresh(now());
  })();

  const T = (x, y) => S.tiles[idx(x, y)];
  const level = () => levelInfo(S.xp).level;
  const total = () => sum(S.inv);
  const cap = () => 60 + 30 * S.whUp;
  const space = () => cap() - total();
  const fail = (err) => ({ ok: false, err });
  const ok = (extra = {}) => ({ ok: true, ...extra });
  const save = () => store.set('save', S);
  const gemsFor = (ms) => Math.max(1, Math.ceil(ms / MIN));
  const has = (m) => Object.entries(m).every(([k, v]) => (S.inv[k] || 0) >= v);
  const canPay = (c) => S.coins >= (c.coins || 0) && Object.entries(c).every(([k, v]) => k === 'coins' || (S.inv[k] || 0) >= v);
  const pay = (c) => {
    S.coins -= c.coins || 0;
    for (const [k, v] of Object.entries(c)) if (k !== 'coins') { S.inv[k] -= v; drop(k); }
  };
  const give = (m) => { for (const [k, v] of Object.entries(m)) S.inv[k] = (S.inv[k] || 0) + v; };
  const drop = (id) => { if (!S.inv[id]) delete S.inv[id]; };

  function energyTick(t = now()) {
    const max = maxEnergy(level());
    if (S.energy >= max) { S.eAt = t; return; }
    const g = Math.floor((t - S.eAt) / REGEN_MS);
    if (g > 0) {
      S.energy = Math.min(max, S.energy + g);
      S.eAt += g * REGEN_MS;
      if (S.energy >= max) S.eAt = t;
    }
  }

  function gainXP(n, global = true) {
    S.xp += n;
    if (global) hooks.addXP?.(n);
  }

  function bump(type, n = 1) {
    S.stats[type] = (S.stats[type] || 0) + n;
    for (const q of S.quests) if (q.type === type && q.prog < q.target) q.prog = Math.min(q.target, q.prog + n);
  }

  function buildingAt(x, y) {
    return S.B.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null;
  }

  // ------------------------------------------------------------ quests
  function makeQuest(q) {
    const type = QUEST_ORDER[q % QUEST_ORDER.length];
    const d = QUEST[type];
    return {
      id: 'q' + q, type, target: Math.max(1, Math.round(d.base + d.grow * q)), prog: 0,
      giver: GIVERS[q % GIVERS.length],
      reward: { coins: 40 + 12 * q, gems: q % 4 === 3 ? 2 : q % 7 === 0 ? 1 : 0, xp: 8 + q },
    };
  }
  function ensureQuests() {
    while (S.quests.length < 3) S.quests.push(makeQuest(S.qSeq++));
  }

  // ------------------------------------------------------------ orders
  const pool = () => Object.keys(ITEMS).filter((id) => ITEMS[id].lvl <= level());

  function genOrder(t) {
    const L = level(), ids = pool();
    const kinds = 1 + Math.floor(Math.random() * Math.min(3, 1 + L / 4));
    const need = {};
    for (let i = 0; i < kinds; i++) {
      const id = pick(ids);
      need[id] = (need[id] || 0) + 1 + Math.floor(Math.random() * (1 + L / 5));
    }
    const value = Object.entries(need).reduce((a, [k, v]) => a + ITEMS[k].v * v, 0);
    return {
      id: uid(), who: pick(CUSTOMERS), need,
      reward: { coins: Math.round(value * 1.6 + 12), gems: Math.random() < 0.15 ? 1 : 0, xp: 4 + kinds * 3 },
      exp: t + 8 * MIN,
    };
  }
  function genSpecial(kind, t) {
    const L = level(), ids = pool();
    const train = kind === 'train';
    const kinds = train ? 4 + Math.floor(L / 6) : 6 + Math.floor(L / 5);
    const need = {};
    for (let i = 0; i < kinds; i++) {
      const id = pick(ids);
      need[id] = (need[id] || 0) + 1 + Math.floor(Math.random() * (train ? 2 : 3));
    }
    const value = Object.entries(need).reduce((a, [k, v]) => a + ITEMS[k].v * v, 0);
    return {
      id: uid(), kind, who: train ? 'caio' : 'sol', need,
      reward: train ? { coins: Math.round(value * 1.8), gems: 3, xp: 30 } : { coins: Math.round(value * 2.2), gems: 6, xp: 55 },
      leave: t + (train ? 20 * MIN : 45 * MIN),
    };
  }

  // ------------------------------------------------------------ time
  function tick(t = now()) {
    const events = [];
    energyTick(t);
    for (const b of S.B) {
      if (b.kind === 'prod') {
        const P = PROD[b.t];
        while (b.q.length && b.q[0].end <= t) {
          const out = P.recipes[b.q[0].r].out;
          if (sum(out) > space()) break;
          give(out);
          b.q.shift();
          bump('produce', 1);
          events.push({ k: 'prod', b: b.id, out });
        }
      } else if (b.kind === 'pen') {
        const P = PENS[b.t];
        while (b.cyc > 0 && b.busy && t >= b.busy && b.st < b.count * 4) {
          b.st += b.count;
          b.cyc--;
          b.busy = b.cyc > 0 ? b.busy + P.cycle : 0;
        }
      }
    }
    S.orders = S.orders.filter((o) => o.exp > t);
    while (S.orders.length < 3) S.orders.push(genOrder(t));
    if (!S.train && t >= S.nextTrain) { S.train = genSpecial('train', t); S.nextTrain = t + 30 * MIN; events.push({ k: 'train' }); }
    if (S.train && t >= S.train.leave) S.train = null;
    if (!S.ship && t >= S.nextShip) { S.ship = genSpecial('ship', t); S.nextShip = t + 60 * MIN; events.push({ k: 'ship' }); }
    if (S.ship && t >= S.ship.leave) S.ship = null;
    ensureQuests();
    return events;
  }

  // ------------------------------------------------------------ farm actions
  function cropFrac(cr, t = now()) {
    return Math.min(1, (t - cr.at) / CROPS[cr.id].grow);
  }

  function plant(x, y, id) {
    const t = T(x, y), C = CROPS[id];
    if (!t || !t.f || t.cr || t.ob || buildingAt(x, y)) return fail('busy');
    if (level() < C.lvl) return fail('lvl');
    if (S.coins < C.cost) return fail('coins');
    S.coins -= C.cost;
    t.cr = { id, at: now() };
    bump('plant', 1);
    save();
    return ok();
  }

  function harvest(x, y) {
    const t = T(x, y);
    if (!t || !t.cr) return fail('busy');
    const C = CROPS[t.cr.id];
    if (cropFrac(t.cr) < 1) return fail('notReady');
    if (space() < C.yield) return fail('full');
    const id = t.cr.id;
    give({ [id]: C.yield });
    t.cr = null;
    gainXP(1, false);
    bump('harvest', C.yield);
    save();
    return ok({ id, n: C.yield });
  }

  function plow(x, y) {
    const t = T(x, y);
    if (!t || !t.u || t.f || t.ob || buildingAt(x, y) || isPath(x, y)) return fail('busy');
    const fields = S.tiles.filter((q) => q.f).length;
    const c = fieldCost(fields);
    if (S.coins < c) return fail('coins');
    S.coins -= c;
    t.f = 1;
    save();
    return ok();
  }

  function clearObst(x, y) {
    const t = T(x, y);
    if (!t || !t.ob) return fail('busy');
    const O = OBST[t.ob];
    energyTick();
    if (S.energy < O.en) return fail('energy');
    if (space() < sum(O.give)) return fail('full');
    S.energy -= O.en;
    give(O.give);
    t.ob = null;
    gainXP(O.xp, false);
    bump('clear', 1);
    save();
    return ok({ give: O.give });
  }

  function unlockTile(x, y) {
    const t = T(x, y);
    if (!t || t.u) return fail('busy');
    const near = DIRS.some(([dx, dy]) => inBox(x + dx, y + dy) && T(x + dx, y + dy).u);
    if (!near) return fail('adjacent');
    const c = unlockCost(x, y);
    if (S.coins < c) return fail('coins');
    S.coins -= c;
    t.u = 1;
    save();
    return ok();
  }

  function canPlace(id, x, y) {
    const size = sizeOf(id);
    if (level() < lvlOf(id)) return 'lvl';
    for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) {
      if (!inBox(xx, yy)) return 'bounds';
      const t = T(xx, yy);
      if (!t.u || t.f || t.ob || buildingAt(xx, yy) || isPath(xx, yy)) return 'busy';
    }
    if (!canPay(costOf(id))) return 'coins';
    return null;
  }

  function place(id, x, y) {
    const err = canPlace(id, x, y);
    if (err) return fail(err);
    pay(costOf(id));
    const kind = kindOf(id);
    const b = { id: uid(), t: id, kind, x, y, w: sizeOf(id), h: sizeOf(id) };
    if (kind === 'pen') Object.assign(b, { cyc: 0, busy: 0, count: PENS[id].start, st: 0 });
    if (kind === 'prod') b.q = [];
    S.B.push(b);
    bump('build', 1);
    gainXP(10, true);
    save();
    return ok({ b });
  }

  function renovate() {
    if (S.renov) return fail('busy');
    if (level() < RENOVATE.lvl) return fail('lvl');
    const c = { coins: RENOVATE.coins, wood: RENOVATE.wood, stone: RENOVATE.stone };
    if (!canPay(c)) return fail(S.coins < c.coins ? 'coins' : 'stock');
    pay(c);
    S.renov = true;
    bump('build', 1);
    gainXP(30, true);
    save();
    return ok();
  }

  function startJob(bid, ri) {
    const b = S.B.find((q) => q.id === bid);
    const P = PROD[b.t], r = P.recipes[ri];
    if (level() < r.lvl) return fail('lvl');
    if (b.q.length >= P.slots) return fail('slots');
    if (!has(r.in)) return fail('stock');
    for (const [k, v] of Object.entries(r.in)) { S.inv[k] -= v; drop(k); }
    const t = now();
    const start = b.q.length ? b.q[b.q.length - 1].end : t;
    b.q.push({ r: ri, end: start + r.t });
    save();
    return ok();
  }

  function speedJob(bid, i) {
    const b = S.B.find((q) => q.id === bid);
    const job = b.q[i];
    const g = gemsFor(job.end - now());
    if (S.gems < g) return fail('gems');
    S.gems -= g;
    job.end = now();
    save();
    return ok();
  }

  function speedCrop(x, y) {
    const t = T(x, y);
    if (!t.cr) return fail('busy');
    const left = CROPS[t.cr.id].grow * (1 - cropFrac(t.cr));
    const g = gemsFor(left);
    if (S.gems < g) return fail('gems');
    S.gems -= g;
    t.cr.at = now() - CROPS[t.cr.id].grow;
    save();
    return ok();
  }

  function speedPen(bid) {
    const b = S.B.find((q) => q.id === bid);
    if (!b.busy || b.busy <= now()) return fail('busy');
    const g = gemsFor(b.busy - now());
    if (S.gems < g) return fail('gems');
    S.gems -= g;
    b.busy = now();
    save();
    return ok();
  }

  function buyAnimal(bid) {
    const b = S.B.find((q) => q.id === bid);
    if (b.count >= MAX_PENS_ANIMALS) return fail('max');
    if (S.coins < PENS[b.t].add) return fail('coins');
    S.coins -= PENS[b.t].add;
    b.count++;
    save();
    return ok();
  }

  function feedPen(bid) {
    const b = S.B.find((q) => q.id === bid);
    const P = PENS[b.t];
    if (b.cyc >= 3) return fail('queue');
    const food = P.food.find((f) => (S.inv[f] || 0) >= b.count);
    if (!food) return fail('food');
    S.inv[food] -= b.count;
    drop(food);
    b.cyc++;
    if (!b.busy) b.busy = now() + P.cycle;
    bump('feed', 1);
    gainXP(1, false);
    save();
    return ok();
  }

  function collectPen(bid) {
    const b = S.B.find((q) => q.id === bid);
    if (b.st <= 0) return fail('empty');
    const out = PENS[b.t].out;
    const n = Math.min(b.st, space());
    if (n <= 0) return fail('full');
    S.inv[out] = (S.inv[out] || 0) + n;
    b.st -= n;
    bump('collect', n);
    save();
    return ok({ id: out, n });
  }

  function sell(id, n) {
    if ((S.inv[id] || 0) < n) return fail('stock');
    S.inv[id] -= n;
    drop(id);
    S.coins += ITEMS[id].v * n;
    save();
    return ok({ coins: ITEMS[id].v * n });
  }

  function eat(id) {
    const e = ITEMS[id].en;
    if (!e) return fail('nofood');
    if ((S.inv[id] || 0) < 1) return fail('stock');
    energyTick();
    S.inv[id]--;
    drop(id);
    S.energy = Math.min(maxEnergy(level()), S.energy + e);
    save();
    return ok({ en: e });
  }

  function upgradeWh() {
    if (S.whUp >= 10) return fail('max');
    const c = { coins: 100 * (S.whUp + 1), wood: 5 * (S.whUp + 1) };
    if (!canPay(c)) return fail(S.coins < c.coins ? 'coins' : 'stock');
    pay(c);
    S.whUp++;
    save();
    return ok();
  }

  function deliver(oid) {
    const list = [...S.orders, S.train, S.ship].filter(Boolean);
    const o = list.find((q) => q.id === oid);
    if (!o) return fail('gone');
    if (!has(o.need)) return fail('stock');
    for (const [k, v] of Object.entries(o.need)) { S.inv[k] -= v; drop(k); }
    S.coins += o.reward.coins;
    S.gems += o.reward.gems;
    if (S.train?.id === oid) S.train = null;
    else if (S.ship?.id === oid) S.ship = null;
    else S.orders = S.orders.filter((q) => q.id !== oid);
    bump('deliver', 1);
    gainXP(o.reward.xp, true);
    ensureQuests();
    save();
    return ok({ reward: o.reward });
  }

  function claimQuest(qid) {
    const q = S.quests.find((x) => x.id === qid);
    if (!q || q.prog < q.target) return fail('notReady');
    S.coins += q.reward.coins;
    S.gems += q.reward.gems;
    S.quests = S.quests.filter((x) => x.id !== qid);
    gainXP(q.reward.xp, true);
    ensureQuests();
    save();
    return ok({ reward: q.reward });
  }

  // ------------------------------------------------------------ expeditions
  function openTile(run, i, log) {
    const t = run.tiles[i];
    if (t.open) return;
    t.open = true;
    run.ex = i % run.w;
    run.ey = (i / run.w) | 0;
    if (t.item) {
      if (t.item.chest) {
        run.coins += t.item.coins;
        run.gems += t.item.gems;
        log.push({ k: 'chest', coins: t.item.coins, gems: t.item.gems });
      } else {
        run.bag[t.item.id] = (run.bag[t.item.id] || 0) + t.item.n;
        log.push({ k: 'item', id: t.item.id, n: t.item.n });
      }
      t.item = null;
    }
    if (t.goal) run.done = run.won = true;
    const x = i % run.w, y = (i / run.w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= run.w || ny >= run.h) continue;
      const j = ny * run.w + nx;
      if (!run.tiles[j].open && !run.tiles[j].cover) openTile(run, j, log);
    }
  }
  const visibleRun = (run, i) => {
    if (run.tiles[i].open) return true;
    const x = i % run.w, y = (i / run.w) | 0;
    return DIRS.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < run.w && ny < run.h && run.tiles[ny * run.w + nx].open;
    });
  };

  function startRun(regionId) {
    const reg = REGIONS.find((r) => r.id === regionId);
    if (S.run) return fail('active');
    if (level() < reg.lvl) return fail('lvl');
    const n = (S.exp[regionId] || 0) + 1;
    const seed = 1000 + REGIONS.indexOf(reg) * 7919 + n * 104729;
    const map = makeMap(regionId, n, seed);
    const run = { reg: regionId, n, w: map.w, h: map.h, tiles: map.tiles, goal: map.goal, ex: map.sx, ey: map.sy,
      bag: {}, coins: 0, gems: 0, won: false, done: false };
    openTile(run, map.start, []);
    S.run = run;
    save();
    return ok();
  }

  function runOpen(i) {
    const run = S.run;
    if (!run || run.done) return fail('done');
    const t = run.tiles[i];
    if (t.open) return fail('open');
    if (!visibleRun(run, i)) return fail('far');
    const log = [];
    if (t.cover) {
      energyTick();
      if (S.energy < t.hard) return fail('energy');
      S.energy -= t.hard;
      t.cover = null;
      bump('clear', 1);
    }
    openTile(run, i, log);
    save();
    return ok({ log, won: run.won });
  }

  function finishRun(success) {
    const run = S.run;
    if (!run) return fail('none');
    const f = success ? 1 : 0.5;
    const got = {};
    for (const [id, n] of Object.entries(run.bag)) {
      const k = Math.floor(n * f);
      if (k > 0 && space() > 0) {
        const add = Math.min(k, space());
        got[id] = add;
        S.inv[id] = (S.inv[id] || 0) + add;
      }
    }
    S.coins += Math.floor(run.coins * f);
    S.gems += Math.floor(run.gems * f);
    let reward = null;
    if (success) {
      reward = { coins: 50 + 10 * run.n, gems: 1 + Math.floor(run.n / 3), xp: 20 + 3 * run.n };
      S.coins += reward.coins;
      S.gems += reward.gems;
      S.exp[run.reg] = (S.exp[run.reg] || 0) + 1;
      bump('expedition', 1);
      gainXP(reward.xp, true);
    }
    S.run = null;
    ensureQuests();
    save();
    return ok({ got, reward, coins: Math.floor(run.coins * f), gems: Math.floor(run.gems * f) });
  }

  return {
    get S() { return S; },
    now, tick, energy: () => { energyTick(); return S.energy; }, energyTick, maxEnergy: () => maxEnergy(level()),
    level, total, cap, space, has, levelInfo: () => levelInfo(S.xp), cropFrac, T, buildingAt,
    renovate, plant, harvest, plow, clearObst, unlockTile, canPlace, place, startJob, speedJob, speedCrop, speedPen,
    buyAnimal, feedPen, collectPen, sell, eat, upgradeWh, deliver, claimQuest, ensureQuests,
    startRun, runOpen, finishRun, visibleRun, save, pool,
    reset() { S = fresh(now()); save(); },
  };
}
