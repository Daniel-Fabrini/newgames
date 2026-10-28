// Farm view: a lush painted isometric farm on a pannable canvas. The playable 16x16 land sits inside
// a decorative world (forest, river) so the screen is always filled. Static scenery is cached in
// chunks; crops, animals, villagers and buildings are drawn every frame.
import { createStage } from './stage.js';
import { P } from './iso.js';
import * as A from './art.js';
import { GRID, ITEMS, CROPS, PENS, PROD, OBST, DECOR, unlockCost, fieldCost, isPath, RENOVATE } from './data.js';
import { fmtTime } from './format.js';
import { openWarehouse, openShop, openProd, openPen } from './panels.js';

const BOUNDS = { x0: -820, y0: -440, x1: 820, y1: 980 };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
const isRiver = (x, y) => x === -4 || x === -3;
const HEIGHT = { barn: 66, house: 62, oldhouse: 56, mill: 86, bakery: 58, dairy: 64, sawmill: 46, kitchen: 58 };

export function mount(host, env) {
  const { t, M, h, toast, errText, floatText, flyTo, dynSheet, closeSheet, setBar, hud, sfx } = env;
  const wrap = h('div', { class: 'g-farm-stagewrap' });
  host.append(wrap);
  const quest = h('button', { class: 'g-farm-chip', onclick: () => env.go('orders', 'quests') });
  const runChip = h('button', { class: 'g-farm-chip run', onclick: () => env.go('run') }, t('hudExpedition'));
  const banner = h('div', { class: 'g-farm-banner' });
  wrap.append(h('div', { class: 'g-farm-light' }), quest, runChip, banner);

  let placing = null;        // { id, size } while choosing a spot
  let lastT = 0;
  const hits = [];           // world rects of buildings drawn last frame
  const anim = new Map();    // pen id -> wandering animals (not saved)
  const DEPTH_BASE = -1e6;

  function refreshStatic() { stage.invalidate(); }
  const unlocked = (x, y) => inGrid(x, y) && M.T(x, y).u === 1;

  // ---------------------------------------------------------------- static world (chunks)
  function tilesIn(rect, mx = 48, up = 90, down = 24) {
    const out = [];
    const a0 = Math.floor((rect.x0 - mx) / 32) - 1, a1 = Math.ceil((rect.x1 + mx) / 32) + 1;
    const b0 = Math.floor((rect.y0 - down) / 16) - 2, b1 = Math.ceil((rect.y1 + up) / 16) + 1;
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
      if ((a + b) & 1) continue;
      const x = (a + b) / 2, y = (b - a) / 2;
      // tile index from the corner: centre is (x + 0.5, y + 0.5)
      out.push([Math.floor(x), Math.floor(y)]);
    }
    return out;
  }

  function drawStatic(cc, rect) {
    const tiles = tilesIn(rect);
    A.paintGround(cc, rect, A.GROUND.grass, tiles);
    const tall = [];
    for (const [x, y] of tiles) {
      const [cx, cy] = A.center(x, y);
      const play = inGrid(x, y);
      const tl = play ? M.T(x, y) : null;
      if (isRiver(x, y)) {
        A.drawWaterTile(cc, x, y, [false, isRiver(x + 1, y) ? false : true, false, isRiver(x - 1, y) ? false : true]);
        continue;
      }
      if (play && tl.u) {
        if (isPath(x, y)) A.drawPathTile(cc, x, y);
        else if (tl.f) A.drawSoilTile(cc, x, y);
        continue;
      }
      // forest floor: a little darker
      cc.fillStyle = 'rgba(30,80,20,0.16)';
      cc.beginPath();
      cc.moveTo(...P(x - 0.02, y - 0.02));
      cc.lineTo(...P(x + 1.02, y - 0.02));
      cc.lineTo(...P(x + 1.02, y + 1.02));
      cc.lineTo(...P(x - 0.02, y + 1.02));
      cc.closePath();
      cc.fill();
      if (x === -2 || x === -5) { A.drawBankStones(cc, x, y); }
      const v = A.hash(x, y, 5), w = A.hash(y, x, 6);
      const frontier = play && DIRS.some(([dx, dy]) => unlocked(x + dx, y + dy));
      if (frontier && v < 0.22) { tall.push([x + y + 0.6, () => A.drawSign(cc, cx + 6, cy + 4)]); continue; }
      const far = Math.max(-x, -y, x - GRID + 1, y - GRID + 1);
      const density = frontier ? 0.2 : play ? 0.34 : far <= 2 ? 0.55 : 0.9;
      if (v < density) {
        const ox = (w - 0.5) * 18, oy = (A.hash(x, y, 7) - 0.5) * 8;
        const s = 0.95 + A.hash(x, y, 8) * 0.35;
        if (A.hash(x, y, 9) < 0.42) tall.push([x + y + 0.5, () => A.drawPine(cc, cx + ox, cy + oy, s * 1.15, w)]);
        else tall.push([x + y + 0.5, () => A.drawTree(cc, cx + ox, cy + oy, s, 0, w)]);
      } else if (v < density + 0.06) {
        tall.push([x + y + 0.5, () => A.drawBush(cc, cx, cy, 1, w, true)]);
      }
    }
    // pen floors and the ruin's ash patch
    for (const b of M.S.B) {
      if (b.kind !== 'pen' && !(b.kind === 'ruin' && !M.S.renov)) continue;
      const pts = [P(b.x + 0.04, b.y + 0.04), P(b.x + b.w - 0.04, b.y + 0.04), P(b.x + b.w - 0.04, b.y + b.h - 0.04), P(b.x + 0.04, b.y + b.h - 0.04)];
      cc.beginPath();
      cc.moveTo(...pts[0]);
      for (let i = 1; i < 4; i++) cc.lineTo(...pts[i]);
      cc.closePath();
      cc.fillStyle = b.kind === 'pen' ? 'rgba(196,150,90,0.8)' : 'rgba(80,70,62,0.85)';
      cc.fill();
      for (let k = 0; k < 26; k++) {
        const [sx, sy] = P(b.x + 0.15 + A.hash(k, b.x, 6) * (b.w - 0.3), b.y + 0.15 + A.hash(b.y, k, 7) * (b.h - 0.3));
        cc.strokeStyle = b.kind === 'pen' ? 'rgba(240,205,100,0.9)' : 'rgba(40,34,30,0.7)';
        cc.lineWidth = 1;
        cc.beginPath();
        cc.moveTo(sx, sy);
        cc.lineTo(sx + 4, sy - 1);
        cc.stroke();
      }
    }
    // wooden fence around the unlocked land
    for (const [x, y] of tiles) {
      if (!unlocked(x, y)) continue;
      const edges = [
        [x, y - 1, P(x, y), P(x + 1, y)],
        [x - 1, y, P(x, y), P(x, y + 1)],
        [x + 1, y, P(x + 1, y), P(x + 1, y + 1)],
        [x, y + 1, P(x, y + 1), P(x + 1, y + 1)],
      ];
      for (const [nx, ny, a, b] of edges) {
        if (unlocked(nx, ny)) continue;
        tall.push([(nx + ny + x + y) / 2 + 0.5, () => A.drawFenceRun(cc, a, b, 2)]);
      }
    }
    tall.sort((p, q) => p[0] - q[0]);
    for (const [, f] of tall) f();
  }

  // ---------------------------------------------------------------- living things
  function animalsFor(b) {
    let arr = anim.get(b.id);
    if (!arr) { arr = []; anim.set(b.id, arr); }
    while (arr.length < b.count) arr.push({ u: 0.7 + Math.random() * 0.9, v: 0.9 + Math.random() * 0.8, tu: 1.2, tv: 1.3, ph: Math.random() * 6, dir: 1, moving: false, wait: Math.random() * 2 });
    arr.length = Math.min(arr.length, b.count);
    return arr;
  }
  function stepAnimals(arr, dt) {
    for (const a of arr) {
      if (a.wait > 0) { a.wait -= dt; a.moving = false; continue; }
      const dx = a.tu - a.u, dy = a.tv - a.v;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) {
        a.tu = 0.55 + Math.random() * 1.2;
        a.tv = 0.85 + Math.random() * 0.95;
        a.wait = 1 + Math.random() * 3;
        a.moving = false;
        continue;
      }
      const sp = 0.32 * dt;
      a.u += (dx / d) * Math.min(sp, d);
      a.v += (dy / d) * Math.min(sp, d);
      a.moving = true;
      const sx = dx - dy;  // screen-space direction
      if (Math.abs(sx) > 0.01) a.dir = sx > 0 ? 1 : -1;
    }
  }

  // Villagers walking along the paths, carrying goods.
  const walkers = [
    { from: [4.5, 6.5], to: [11.4, 6.5], speed: 0.55, look: 0, carry: 'crate', ph: 0 },
    { from: [6.5, 6.6], to: [6.5, 11.4], speed: 0.45, look: 1, carry: 'hay', ph: 3 },
    { from: [11.2, 6.4], to: [4.7, 6.4], speed: 0.4, look: 2, carry: null, ph: 7 },
  ];
  function walkerPos(wk, time) {
    const len = Math.hypot(wk.to[0] - wk.from[0], wk.to[1] - wk.from[1]);
    const period = (len / wk.speed) * 2;
    const ph = ((time + wk.ph * 3) % period) / period;
    const u = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const x = wk.from[0] + (wk.to[0] - wk.from[0]) * u, y = wk.from[1] + (wk.to[1] - wk.from[1]) * u;
    const fwd = ph < 0.5;
    const dxs = (wk.to[0] - wk.from[0]) - (wk.to[1] - wk.from[1]);
    return { x, y, dir: (dxs >= 0) === fwd ? 1 : -1, carry: fwd ? wk.carry : null };
  }

  function drawDyn(c, time) {
    const dt = Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    hits.length = 0;
    const items = [];
    const bubbles = [];
    if (placing) {
      for (let y = 0; y <= GRID - placing.size; y++) for (let x = 0; x <= GRID - placing.size; x++) {
        if (M.canPlace(placing.id, x, y)) continue;
        items.push({ d: DEPTH_BASE, f: () => {
          const pts = [P(x, y), P(x + placing.size, y), P(x + placing.size, y + placing.size), P(x, y + placing.size)];
          c.beginPath();
          c.moveTo(...pts[0]);
          for (let i = 1; i < 4; i++) c.lineTo(...pts[i]);
          c.closePath();
          c.fillStyle = 'rgba(255,236,140,0.22)';
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.85)';
          c.lineWidth = 1.4;
          c.stroke();
        } });
      }
    }
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const tl = M.T(x, y);
      if (!tl.u) continue;
      if (tl.f && tl.cr) {
        const cr = tl.cr;
        items.push({ d: x + y + 0.3, f: () => A.drawCrop(c, x, y, cr.id, M.cropFrac(cr), time) });
      }
      if (tl.ob) {
        const kind = tl.ob, seed = A.hash(x, y, 8);
        items.push({ d: x + y + 0.5, f: () => {
          const [px, py] = A.center(x, y);
          if (kind === 'bush') A.drawBush(c, px, py, 1.15, seed);
          else if (kind === 'stump') A.drawStump(c, px, py, 1.1);
          else A.drawRock(c, px, py, 1.1);
        } });
      }
    }
    const now = M.now();
    for (const b of M.S.B) {
      const d = b.x + b.w / 2 + b.y + b.h / 2;
      const top = P(b.x + b.w / 2, b.y + b.h / 2, (HEIGHT[b.t] || 30) + 10);
      if (b.kind === 'pen') {
        items.push({ d, f: () => drawPen(c, b, time, dt) });
        hits.push({ b, ...rectOf(b, 30) });
        const Pn = PENS[b.t];
        const bt = P(b.x + 1, b.y + 1, 44);
        if (b.st > 0) bubbles.push(() => A.bubble(c, bt[0], bt[1], ITEMS[Pn.out].e, b.st, time));
        else if (b.busy) bubbles.push(() => A.ring(c, bt[0], bt[1] - 10, 1 - Math.max(0, b.busy - now) / Pn.cycle, 9));
        else bubbles.push(() => A.bubble(c, bt[0], bt[1], ITEMS[Pn.food[0]].e, 0, time));
      } else if (b.kind === 'deco') {
        if (b.t === 'pond') items.push({ d: DEPTH_BASE + 10 + b.x + b.y, f: () => A.drawPond(c, b.x, b.y, time) });
        else items.push({ d, f: () => drawDeco(c, b, time) });
        hits.push({ b, ...rectOf(b, b.t === 'pond' ? 4 : 36) });
      } else if (b.kind === 'prop') {
        items.push({ d, f: () => drawProp(c, b) });
        hits.push({ b, ...rectOf(b, 26) });
      } else {
        items.push({ d, f: () => {
          A.drawBuilding(c, b, time, { restored: M.S.renov });
          if (b.kind === 'ruin' && M.S.renov) drawCottageGarden(c, b, time);
        } });
        hits.push({ b, ...rectOf(b, HEIGHT[b.t] || 50) });
        if (b.kind === 'prod' && b.q.length) {
          const job = b.q[0];
          const r = PROD[b.t].recipes[job.r];
          const left = job.end - now;
          if (left <= 0) bubbles.push(() => A.bubble(c, top[0], top[1], ITEMS[Object.keys(r.out)[0]].e, 0, time));
          else bubbles.push(() => A.ring(c, top[0], top[1] - 10, 1 - left / r.t, 10));
        }
        if (b.kind === 'ruin' && !M.S.renov) bubbles.push(() => A.bubble(c, top[0], top[1], '🔨', 0, time));
      }
    }
    for (const wk of walkers) {
      const p = walkerPos(wk, time);
      if (!unlocked(Math.floor(p.x), Math.floor(p.y))) continue;
      const [wx, wy] = P(p.x, p.y);
      items.push({ d: p.x + p.y, f: () => A.drawPerson(c, wx, wy, time, p.dir, wk.look, p.carry) });
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.f();
    for (const f of bubbles) f();
    drawButterflies(c, time);
  }

  function drawButterflies(c, time) {
    for (let k = 0; k < 4; k++) {
      const bx = 6 + 3 * Math.sin(time * 0.21 + k * 1.7), by = 7 + 3 * Math.cos(time * 0.17 + k * 2.3);
      const [wx, wy] = P(bx, by, 22 + Math.sin(time * 2 + k) * 6);
      const flap = Math.abs(Math.sin(time * 14 + k));
      const col = ['#ffd23f', '#ff8fbf', '#ffffff', '#9fd9ff'][k];
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(wx - 2, wy, 2.6 * flap + 0.4, 1.8, -0.4, 0, Math.PI * 2);
      c.ellipse(wx + 2, wy, 2.6 * flap + 0.4, 1.8, 0.4, 0, Math.PI * 2);
      c.fill();
    }
  }

  function rectOf(b, H) {
    const x0 = P(b.x, b.y + b.h)[0], x1 = P(b.x + b.w, b.y)[0];
    const top = P(b.x, b.y, H)[1];
    const bottom = P(b.x + b.w, b.y + b.h)[1] + 4;
    return { x0: x0 - 2, x1: x1 + 2, y0: top, y1: bottom };
  }

  function drawDeco(c, b, time) {
    const [cx, cy] = A.center(b.x, b.y);
    const seed = A.hash(b.x, b.y, 9);
    if (b.t === 'tree') A.drawTree(c, cx, cy, 1.05, time, seed);
    else if (b.t === 'flowers') A.drawFlowerBed(c, cx, cy, time, Math.floor(seed * 5));
    else if (b.t === 'scarecrow') A.drawScarecrow(c, cx, cy, time);
    else if (b.t === 'hay') A.drawHayStack(c, cx, cy);
  }
  function drawProp(c, b) {
    const [cx, cy] = A.center(b.x, b.y);
    if (b.t === 'hay') A.drawHayStack(c, cx, cy);
    else if (b.t === 'crates') A.drawCrates(c, cx, cy);
    else A.drawBarrels(c, cx, cy);
  }
  function drawCottageGarden(c, b, time) {
    const [ax, ay] = P(b.x + b.w + 0.25, b.y + 0.5);
    A.drawFlowerBed(c, ax, ay, time, 2);
    const [bx, by] = P(b.x + 0.5, b.y + b.h + 0.3);
    A.drawFlowerBed(c, bx, by, time, 4);
  }

  function drawPen(c, b, time, dt) {
    const arr = animalsFor(b);
    stepAnimals(arr, dt);
    A.drawPenBack(c, b);
    A.drawPenProps(c, b, b.t);
    const sorted = arr.slice().sort((p, q) => (p.u + p.v) - (q.u + q.v));
    for (const a of sorted) {
      const [wx, wy] = P(b.x + a.u, b.y + a.v, 0);
      A.drawAnimal(c, b.t, wx, wy, a.dir, time, a.ph, a.moving);
    }
    A.drawPenFront(c, b);
  }

  // ---------------------------------------------------------------- placement
  function placeError(id, x, y) {
    return M.canPlace(id, x, y);
  }
  function startPlacing(id) {
    placing = { id, size: id in DECOR ? DECOR[id].size : 2 };
    banner.replaceChildren(
      h('span', {}, t('placed', { name: t(prefixOf(id) + '_' + id) })),
      h('button', { class: 'btn small', onclick: () => stopPlacing() }, t('placeCancel')));
    banner.classList.add('show');
  }
  function stopPlacing() {
    placing = null;
    banner.classList.remove('show');
  }
  const prefixOf = (id) => (id in PENS ? 'pen' : id in PROD ? 'prod' : id === 'house' ? 'fixed' : 'deco');
  env.startPlacing = startPlacing;

  // ---------------------------------------------------------------- input
  function onTap(sx, sy, e) {
    const [wx, wy] = stage.cam.toWorld(sx, sy);
    const p = stage.cam.tileAt(sx, sy);
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (placing) {
      const err = M.canPlace(placing.id, x, y);
      if (err) {
        toast(err === 'coins' ? t('err_coins') : err === 'lvl' ? t('err_lvl') : t('noSpace'));
        return;
      }
      const r = M.place(placing.id, x, y);
      if (!r.ok) return toast(errText(r.err));
      sfx.play('success');
      toast(t('built'));
      floatText('🏗️', e.clientX, e.clientY, 'big');
      stopPlacing();
      refreshStatic();
      hud();
      return;
    }
    for (let i = hits.length - 1; i >= 0; i--) {
      const r = hits[i];
      if (wx >= r.x0 && wx <= r.x1 && wy >= r.y0 && wy <= r.y1) {
        const b = r.b;
        if (b.kind === 'pen') return penTap(b, e);
        if (b.kind === 'prod') return openProd(env, b.id);
        if (b.kind === 'barn') return openWarehouse(env);
        if (b.kind === 'ruin') return M.S.renov ? toast(t('cottageInfo')) : renovSheet();
        if (b.kind === 'deco' || b.kind === 'fixed' || b.kind === 'prop') return toast(t(b.kind === 'deco' ? 'decoInfo' : 'fixedInfo'));
      }
    }
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    tileTap(x, y, e);
  }

  function penTap(b, e) {
    if (b.st > 0) {
      const r = M.collectPen(b.id);
      if (r.ok) {
        sfx.play('coin');
        burst(e, ITEMS[r.id].e, Math.min(3, r.n));
        hud();
        return;
      }
    }
    openPen(env, b.id);
  }

  function burst(e, emoji, n) {
    for (let i = 0; i < n; i++) {
      const jx = (Math.random() - 0.5) * 30;
      setTimeout(() => flyTo(emoji, e.clientX + jx, e.clientY, env.barEl('warehouse')), i * 80);
    }
  }
  // Flies one icon per unit (max 4) from the pointer to the warehouse button.
  function flyItems(e, give) {
    let k = 0;
    for (const [id, n] of Object.entries(give)) {
      for (let i = 0; i < Math.min(n, 3); i++, k++) {
        setTimeout(() => flyTo(ITEMS[id].e, e.clientX + (Math.random() - 0.5) * 24, e.clientY, env.barEl('warehouse')), k * 90);
      }
    }
  }

  function tileTap(x, y, e) {
    const tl = M.T(x, y);
    if (!tl.u) {
      const adj = DIRS.some(([dx, dy]) => M.T(x + dx, y + dy)?.u && inRange(x + dx, y + dy));
      if (!adj) return toast(t('err_adjacent'));
      return unlockSheet(x, y);
    }
    if (tl.ob) return obstSheet(x, y);
    if (tl.f && tl.cr) {
      if (M.cropFrac(tl.cr) >= 1) return harvestTap(x, y, e);
      return cropSheet(x, y);
    }
    if (tl.f) return plantSheet(x, y);
    if (M.buildingAt(x, y)) return;
    return plowSheet(x, y);
  }
  const inRange = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;

  function harvestTap(x, y, e) {
    const r = M.harvest(x, y);
    if (!r.ok) return toast(errText(r.err));
    sfx.play('tap');
    burst(e, ITEMS[r.id].e, 3);
    floatText('+' + r.n, e.clientX, e.clientY - 10, 'gain');
    hud();
  }

  // ---------------------------------------------------------------- tile sheets
  function renovSheet() {
    dynSheet(t('renovTitle'), () => {
      const c = RENOVATE;
      const can = M.level() >= c.lvl && M.S.coins >= c.coins && M.has({ wood: c.wood, stone: c.stone });
      return h('div', { class: 'g-farm-col' },
        h('div', { class: 'g-farm-big-ico' }, '🏚️'),
        h('p', { class: 'g-farm-text' }, t('renovBody')),
        M.level() < c.lvl ? h('p', { class: 'g-farm-text small' }, t('needLvl', { n: c.lvl })) : null,
        h('button', { class: 'btn primary block big', disabled: !can, onclick: (ev) => {
          const r = M.renovate();
          if (!r.ok) return toast(errText(r.err));
          sfx.play('win');
          env.ui.confetti(60);
          floatText(t('renovDone'), ev.clientX, ev.clientY - 30, 'big');
          refreshStatic();
          hud();
          closeSheet();
        } }, t('renovBtn', { c: c.coins, w: c.wood, s: c.stone })));
    });
  }

  function plowSheet(x, y) {
    dynSheet(t('plowTitle'), () => {
      const fields = M.S.tiles.filter((q) => q.f).length;
      const cost = fieldCost(fields);
      return h('div', { class: 'g-farm-col' },
        h('p', { class: 'g-farm-text' }, t('plowInfo')),
        h('button', { class: 'btn primary block big', disabled: M.S.coins < cost, onclick: () => {
          const r = M.plow(x, y);
          if (!r.ok) return toast(errText(r.err));
          sfx.play('pop');
          refreshStatic();
          hud();
          closeSheet();
        } }, t('plowBtn', { c: cost })));
    });
  }

  function unlockSheet(x, y) {
    dynSheet(t('unlockTitle'), () => {
      const cost = unlockCost(x, y);
      return h('div', { class: 'g-farm-col' },
        h('p', { class: 'g-farm-text' }, t('unlockInfo')),
        h('button', { class: 'btn primary block big', disabled: M.S.coins < cost, onclick: () => {
          const r = M.unlockTile(x, y);
          if (!r.ok) return toast(errText(r.err));
          sfx.play('success');
          refreshStatic();
          hud();
          closeSheet();
        } }, t('unlockBtn', { c: cost })));
    });
  }
  function obstSheet(x, y) {
    const kind = M.T(x, y).ob;
    const O = OBST[kind];
    dynSheet(t('obst_' + kind), () => h('div', { class: 'g-farm-col' },
      h('p', { class: 'g-farm-text' }, t('clearInfo') + ' ' + Object.entries(O.give).map(([k, v]) => `${v} ${ITEMS[k].e}`).join('  ')),
      h('button', { class: 'btn primary block big', onclick: (ev) => {
        const r = M.clearObst(x, y);
        if (!r.ok) return toast(errText(r.err));
        sfx.play('hit');
        flyItems(ev, r.give);
        floatText('+' + O.xp + ' XP', ev.clientX, ev.clientY - 30, 'gain');
        hud();
        closeSheet();
      } }, t('clearBtn', { e: O.en }))));
  }

  function plantSheet(x, y) {
    dynSheet(t('sheetPlant'), () => {
      const list = h('div', { class: 'g-farm-list' });
      for (const id of Object.keys(CROPS)) {
        const C = CROPS[id];
        const locked = M.level() < C.lvl;
        const broke = M.S.coins < C.cost;
        list.append(h('button', { class: 'g-farm-row' + (locked ? ' locked' : ''), disabled: locked || broke, onclick: () => {
          const r = M.plant(x, y, id);
          if (!r.ok) return toast(errText(r.err));
          sfx.play('pop');
          hud();
          closeSheet();
        } },
          h('span', { class: 'g-farm-row-ico' }, ITEMS[id].e),
          h('span', { class: 'g-farm-row-body' },
            h('b', {}, t('item_' + id)),
            h('small', {}, locked ? t('needLvl', { n: C.lvl }) : t('growTime', { t: fmtTime(C.grow) }) + ' · ' + t('yieldLine', { c: C.cost, y: C.yield }))),
          h('span', { class: 'g-farm-row-end' }, `🪙${C.cost}`)));
      }
      return list;
    });
  }

  function cropSheet(x, y) {
    dynSheet(t('item_' + M.T(x, y).cr.id), () => {
      const cr = M.T(x, y).cr;
      if (!cr) return h('p', { class: 'g-farm-text' }, '—');
      const C = CROPS[cr.id];
      const left0 = C.grow * (1 - M.cropFrac(cr));
      const gems = Math.max(1, Math.ceil(left0 / 60e3));
      const left = () => {
        const c = M.T(x, y).cr;
        return c ? C.grow * (1 - M.cropFrac(c)) : 0;
      };
      return h('div', { class: 'g-farm-col' },
        h('div', { class: 'g-farm-big-ico' }, ITEMS[cr.id].e),
        env.live(h('p', { class: 'g-farm-text' }), () => t('growing', { t: fmtTime(left()) })),
        h('div', { class: 'g-farm-progress' }, env.live(h('i'), () => ((1 - left() / C.grow) * 100).toFixed(1) + '%', 'width')),
        h('button', { class: 'btn accent block', disabled: M.S.gems < gems, onclick: () => {
          const r = M.speedCrop(x, y);
          if (!r.ok) return toast(errText(r.err));
          sfx.play('success');
          hud();
        } }, t('speedBtn', { g: gems })));
    });
  }

  // ---------------------------------------------------------------- bottom bar and chips
  function openRunOrSelect() {
    env.go(M.S.run ? 'run' : 'exp');
  }
  setBar([
    { id: 'shop', icon: '🛒', label: t('barShop'), onclick: () => openShop(env, startPlacing) },
    { id: 'warehouse', icon: '📦', label: t('barWarehouse'), onclick: () => openWarehouse(env) },
    { id: 'orders', icon: '📜', label: t('barOrders'), onclick: () => env.go('orders') },
    { id: 'exp', icon: '🧭', label: t('barExpedition'), onclick: openRunOrSelect },
  ]);

  function updateChips() {
    const q = M.S.quests[0];
    quest.replaceChildren(h('span', { class: 'g-farm-chip-ico' }, '📜'),
      h('span', { class: 'g-farm-chip-txt' }, q ? `${t('q_' + q.type, { n: q.target })} · ${t('questProg', { p: q.prog, t: q.target })}` : t('noQuests')));
    runChip.style.display = M.S.run ? '' : 'none';
  }

  // ---------------------------------------------------------------- stage
  const stage = createStage(wrap, {
    bounds: BOUNDS,
    focus: P(8.6, 8.4),
    zoom: 1.05,
    maxZ: 2.2,
    bg: '#4f8f34',
    drawStatic,
    drawDynamic: (c, cam, time) => drawDyn(c, time),
    onTap,
  });
  window.__farmDbg && (window.__farmDbg.stage = stage); // DBG
  updateChips();

  return {
    tick() { updateChips(); },
    onBack() {
      if (placing) { stopPlacing(); return true; }
      return false;
    },
    destroy() {
      stage.destroy();
      wrap.remove();
      env.startPlacing = null;
      stopPlacing();
    },
  };
}
