// Farm view: the isometric farm on a pannable canvas, taps on tiles and buildings, placement mode.
import { createStage } from './stage.js';
import { P, TW, TH } from './iso.js';
import * as A from './art.js';
import { GRID, ITEMS, CROPS, PENS, PROD, OBST, DECOR, unlockCost, fieldCost } from './data.js';
import { fmtTime } from './format.js';
import { openWarehouse, openShop, openProd, openPen } from './panels.js';

const BOUNDS = { x0: -GRID * TW / 2 - 14, y0: -70, x1: GRID * TW / 2 + 14, y1: GRID * TH + 40 };
// The initial view shows the starting land (the 8x8 square) with a little border.
const FOCUS = (() => {
  const pts = [[4, 4], [12, 4], [12, 12], [4, 12]].map(([x, y]) => P(x, y));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs) - 30, x1: Math.max(...xs) + 30, y0: Math.min(...ys) - 70, y1: Math.max(...ys) + 40 };
})();
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function mount(host, env) {
  const { t, M, h, toast, errText, floatText, flyTo, dynSheet, sheet, closeSheet, setBar, hud, sfx, ctx } = env;
  const wrap = h('div', { class: 'g-farm-stagewrap' });
  host.append(wrap);
  const quest = h('button', { class: 'g-farm-chip', onclick: () => env.go('orders', 'quests') });
  const runChip = h('button', { class: 'g-farm-chip run', onclick: () => env.go('run') }, t('hudExpedition'));
  const banner = h('div', { class: 'g-farm-banner' });
  wrap.append(quest, runChip, banner);

  let placing = null;        // { id, size } while choosing a spot
  let lastT = 0;
  const hits = [];           // screen-independent world rects of buildings, drawn last frame
  const anim = new Map();    // pen id -> wandering animals (not saved)
  const DEPTH_BASE = -1e6;

  function refreshStatic() { stage.invalidate(); }

  // ---------------------------------------------------------------- static ground layer
  function drawStatic(cc) {
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const tl = M.T(x, y);
      const v = A.hash(x, y, 1);
      if (!tl.u) {
        A.drawTile(cc, x, y, A.PAL.lock, 'lock', v);
        A.drawLockTint(cc, x, y);
      } else if (tl.f) {
        A.drawTile(cc, x, y, A.PAL.grass, 'soil', v);
      } else {
        A.drawTile(cc, x, y, A.PAL.grass, 'grass', v);
      }
    }
    // paddock dirt under pens
    for (const b of M.S.B) {
      if (b.kind !== 'pen') continue;
      const pts = [P(b.x + 0.06, b.y + 0.06), P(b.x + 1.94, b.y + 0.06), P(b.x + 1.94, b.y + 1.94), P(b.x + 0.06, b.y + 1.94)];
      cc.beginPath();
      cc.moveTo(...pts[0]);
      for (let i = 1; i < 4; i++) cc.lineTo(...pts[i]);
      cc.closePath();
      cc.fillStyle = 'rgba(176,132,76,0.55)';
      cc.fill();
      for (let k = 0; k < 9; k++) {
        const [sx, sy] = P(b.x + 0.2 + A.hash(k, b.x, 6) * 1.6, b.y + 0.2 + A.hash(b.y, k, 7) * 1.6);
        cc.fillStyle = 'rgba(230,190,90,0.7)';
        cc.fillRect(sx, sy, 2, 1);
      }
    }
  }

  // ---------------------------------------------------------------- dynamic layer
  function animalsFor(b) {
    let arr = anim.get(b.id);
    if (!arr) { arr = []; anim.set(b.id, arr); }
    while (arr.length < b.count) arr.push({ u: 0.5 + Math.random(), v: 0.5 + Math.random(), tu: 1, tv: 1, ph: Math.random() * 6, dir: 1, moving: false, wait: Math.random() * 2 });
    arr.length = Math.min(arr.length, b.count);
    return arr;
  }
  function stepAnimals(arr, dt) {
    for (const a of arr) {
      if (a.wait > 0) { a.wait -= dt; a.moving = false; continue; }
      const dx = a.tu - a.u, dy = a.tv - a.v;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) {
        a.tu = 0.3 + Math.random() * 1.4;
        a.tv = 0.3 + Math.random() * 1.4;
        a.wait = Math.random() * 2.5;
        a.moving = false;
        continue;
      }
      const sp = 0.45 * dt;
      a.u += (dx / d) * Math.min(sp, d);
      a.v += (dy / d) * Math.min(sp, d);
      a.moving = true;
      if (Math.abs(dx) > 0.01) a.dir = dx > 0 ? 1 : -1;
    }
  }

  function drawDyn(c, cam, time) {
    const dt = Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    hits.length = 0;
    const items = [];
    if (placing) {
      for (let y = 0; y <= GRID - placing.size; y++) for (let x = 0; x <= GRID - placing.size; x++) {
        if (placeError(placing.id, x, y)) continue;
        items.push({ d: DEPTH_BASE, f: () => {
          const pts = [P(x, y), P(x + placing.size, y), P(x + placing.size, y + placing.size), P(x, y + placing.size)];
          c.beginPath();
          c.moveTo(...pts[0]);
          for (let i = 1; i < 4; i++) c.lineTo(...pts[i]);
          c.closePath();
          c.fillStyle = 'rgba(243,194,74,0.16)';
          c.fill();
          c.strokeStyle = 'rgba(243,194,74,0.55)';
          c.lineWidth = 1;
          c.stroke();
        } });
      }
    }
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const tl = M.T(x, y);
      if (!tl.u) {
        const v = A.hash(x, y, 5);
        if (v > 0.5) items.push({ d: x + y, f: () => A.drawTree(c, ...A.center(x, y), 1, time, v) });
        else if (v > 0.22) items.push({ d: x + y, f: () => A.drawBush(c, ...A.center(x, y), 1.1, '#3a8a40', v) });
        const near = DIRS.some(([dx, dy]) => M.T(x + dx, y + dy)?.u && x + dx >= 0 && y + dy >= 0 && x + dx < GRID && y + dy < GRID);
        if (near) items.push({ d: x + y + 0.5, f: () => A.drawLockPad(c, x, y, time) });
        continue;
      }
      if (tl.f && tl.cr) {
        const cr = tl.cr;
        items.push({ d: x + y + 0.4, f: () => A.drawCrop(c, x, y, cr.id, M.cropFrac(cr), time) });
      }
      if (tl.ob) {
        const kind = tl.ob, seed = A.hash(x, y, 8);
        items.push({ d: x + y + 0.5, f: () => {
          const [px, py] = A.center(x, y);
          if (kind === 'bush') A.drawBush(c, px, py, 1, '#3f9a45', seed);
          else if (kind === 'stump') A.drawStump(c, px, py, 1);
          else A.drawRock(c, px, py, 1.05);
        } });
      }
    }
    for (const b of M.S.B) {
      const d = b.x + b.w / 2 + b.y + b.h / 2;
      if (b.kind === 'pen') {
        items.push({ d, f: () => drawPen(c, b, time, dt) });
        hits.push({ b, ...rectOf(b, 12) });
      } else if (b.kind === 'deco' || b.kind === 'fixed') {
        if (b.t === 'pond') items.push({ d: DEPTH_BASE + 10 + b.x + b.y, f: () => A.drawPond(c, b.x, b.y, time) });
        else items.push({ d, f: () => drawDeco(c, b, time) });
        hits.push({ b, ...rectOf(b, b.t === 'pond' ? 2 : 30) });
      } else {
        items.push({ d, f: () => A.drawBuilding(c, b, time) });
        hits.push({ b, ...rectOf(b, b.t === 'barn' ? 20 : 30) });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.f();
  }

  function rectOf(b, H) {
    const x0 = P(b.x, b.y + b.h)[0], x1 = P(b.x + b.w, b.y)[0];
    const top = Math.min(P(b.x, b.y, H + 14)[1], P(b.x + b.w, b.y + b.h, H + 14)[1], P(b.x, b.y, H + 14)[1]);
    const bottom = P(b.x + b.w, b.y + b.h)[1] + 6;
    return { x0: x0 - 4, x1: x1 + 4, y0: top - 14, y1: bottom };
  }

  function drawDeco(c, b, time) {
    const [cx, cy] = A.center(b.x, b.y);
    const seed = A.hash(b.x, b.y, 9);
    if (b.t === 'tree') A.drawTree(c, cx, cy, 1, time, seed);
    else if (b.t === 'flowers') A.drawFlowers(c, cx, cy, time, Math.floor(seed * 5));
    else if (b.t === 'scarecrow') A.drawScarecrow(c, cx, cy, time);
    else if (b.t === 'hay') A.drawHay(c, cx, cy);
    else if (b.t === 'house') drawHouse(c, b, time);
  }
  function drawHouse(c, b, time) {
    A.drawBuilding(c, b, time);
  }

  function drawPen(c, b, time, dt) {
    const P_ = PENS[b.t];
    const arr = animalsFor(b);
    stepAnimals(arr, dt);
    A.drawHut(c, b.x, b.y);
    A.drawFence(c, b.x, b.y, 2, 2);
    const sorted = arr.slice().sort((p, q) => p.v - q.v);
    for (const a of sorted) {
      const [wx, wy] = P(b.x + a.u, b.y + a.v, 0);
      A.drawAnimal(c, b.t, wx, wy, a.dir, time, a.ph, a.moving);
    }
    const [bx, by] = P(b.x + 1, b.y + 1, 40);
    if (b.st > 0) {
      A.bubble(c, bx, by, ITEMS[P_.out].e, b.st, time);
    } else if (b.busy) {
      const left = b.busy - M.now();
      const frac = 1 - Math.max(0, left) / P_.cycle;
      A.ring(c, bx, by, frac, 8);
    }
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
        if (b.kind === 'deco' || b.kind === 'fixed') return toast(t(b.kind === 'fixed' ? 'fixedInfo' : 'decoInfo'));
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
    dynSheet(t('sheetPlant'), (re) => {
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
      void re;
      return list;
    });
  }

  function cropSheet(x, y) {
    dynSheet(t('item_' + M.T(x, y).cr.id), () => {
      const cr = M.T(x, y).cr;
      if (!cr) return h('p', { class: 'g-farm-text' }, '—');
      const C = CROPS[cr.id];
      const f = M.cropFrac(cr);
      const left = C.grow * (1 - f);
      const gems = Math.max(1, Math.ceil(left / 60e3));
      return h('div', { class: 'g-farm-col' },
        h('div', { class: 'g-farm-big-ico' }, ITEMS[cr.id].e),
        h('p', { class: 'g-farm-text' }, t('growing', { t: fmtTime(left) })),
        h('div', { class: 'g-farm-progress' }, h('i', { style: { width: (f * 100).toFixed(1) + '%' } })),
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
    focus: FOCUS,
    drawStatic: (cc) => drawStatic(cc),
    drawDynamic: (c, cam, time, W, H) => drawDyn(c, cam, time),
    onTap,
  });
  stage.invalidate();
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
