// Expeditions: the region picker and the fog-of-war map. Tiles open when they touch an open tile;
// covered tiles are cleared with energy. Reaching the exit ends the expedition with rewards.
import { createStage } from './stage.js';
import { P } from './iso.js';
import * as A from './art.js';
import { REGIONS, ITEMS } from './data.js';
import { openWarehouse } from './panels.js';

const ICON = { forest: '🌲', canyon: '🏜️', mine: '❄️', ruins: '🏛️', island: '🏝️' };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ------------------------------------------------------------------ picker
export function mountSelect(host, env) {
  const { t, M, h, toast, errText, setBar, sfx } = env;
  const root = h('div', { class: 'g-farm-picker' });
  host.append(root);
  setBar([
    { id: 'farm', icon: '🌾', label: t('barFarm'), onclick: () => env.go('farm') },
    { id: 'orders', icon: '📜', label: t('barOrders'), onclick: () => env.go('orders') },
    { id: 'warehouse', icon: '📦', label: t('barWarehouse'), onclick: () => openWarehouse(env) },
  ]);
  root.append(h('h2', { class: 'g-farm-h2' }, t('expTitle')), h('p', { class: 'g-farm-text small' }, t('expIntro')));
  if (M.S.run) {
    root.append(h('button', { class: 'g-farm-regcard active', onclick: () => env.go('run') },
      h('span', { class: 'g-farm-regart ' + M.S.run.reg }, ICON[M.S.run.reg]),
      h('span', { class: 'g-farm-regtxt' }, h('b', {}, t('reg_' + M.S.run.reg)), h('small', {}, t('expNo', { n: M.S.run.n }))),
      h('span', { class: 'g-farm-regbtn' }, t('expContinue'))));
  }
  for (const reg of REGIONS) {
    const locked = M.level() < reg.lvl;
    const done = M.S.exp[reg.id] || 0;
    root.append(h('article', { class: 'g-farm-regcard' + (locked ? ' locked' : '') },
      h('span', { class: 'g-farm-regart ' + reg.id }, ICON[reg.id]),
      h('span', { class: 'g-farm-regtxt' },
        h('b', {}, t('reg_' + reg.id)),
        h('small', {}, t('regd_' + reg.id)),
        h('small', { class: 'sub' }, locked ? t('regionLock', { n: reg.lvl }) : t('expDone', { n: done }))),
      h('button', { class: 'btn small primary', disabled: locked || !!M.S.run, onclick: () => {
        const r = M.startRun(reg.id);
        if (!r.ok) return toast(errText(r.err));
        sfx.play('whoosh');
        env.go('run');
      } }, locked ? '🔒' : t('expStart'))));
  }
  return { tick() {}, onBack() { return false; }, destroy() { root.remove(); } };
}

// ------------------------------------------------------------------ map
export function mountRun(host, env) {
  const { t, M, h, toast, errText, sfx, hud, setBar, floatText, flyTo, fmtNum } = env;
  const run0 = M.S.run;
  if (!run0) {
    const box = h('div', { class: 'g-farm-picker' }, h('p', { class: 'g-farm-text' }, t('noRun')));
    host.append(box);
    setBar([{ id: 'exp', icon: '🧭', label: t('barExpedition'), onclick: () => env.go('exp') }]);
    return { tick() {}, onBack() { return false; }, destroy() { box.remove(); } };
  }
  const W = run0.w, H = run0.h;
  const reg = REGIONS.find((r) => r.id === run0.reg);
  const pal = A.GROUND[reg.ground];
  const snow = reg.ground === 'snow';
  const M6 = 7;
  const corners = [P(-M6, -M6), P(W + M6, -M6), P(W + M6, H + M6), P(-M6, H + M6)];
  const BOUNDS = {
    x0: P(-M6 + 3, H + M6 - 3)[0], x1: P(W + M6 - 3, -M6 + 3)[0],
    y0: P(-M6 + 3, -M6 + 3)[1], y1: P(W + M6 - 3, H + M6 - 3)[1],
  };
  void corners;
  const wrap = h('div', { class: 'g-farm-stagewrap' });
  host.append(wrap);
  const chip = h('div', { class: 'g-farm-chip run-chip' });
  const hint = h('div', { class: 'g-farm-hintchip' }, t('runHint'));
  wrap.append(h('div', { class: 'g-farm-light' }), chip, hint);
  const idxOf = (x, y) => y * W + x;
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const isSea = (x, y) => reg.edge === 'sea' && !inMap(x, y);
  const shipAt = [-2.6, Math.round(H * 0.35)];

  setBar([
    { id: 'retreat', icon: '🏳️', label: t('runRetreat'), onclick: askRetreat },
    { id: 'bag', icon: '🎒', label: t('runBag'), onclick: openBag },
    { id: 'center', icon: '🎯', label: t('runCenter'), onclick: () => centerOnExplorer() },
  ]);

  const visibleAt = (i) => M.visibleRun(M.S.run, i);
  // Tiles within two steps of explored ground are shown (clouds only beyond); only neighbours are clearable.
  let seen = new Set(), seenKey = -1;
  function updateSeen() {
    const run = M.S.run;
    if (!run) return;
    let n = 0;
    for (const tl of run.tiles) if (tl.open) n++;
    if (n === seenKey) return false;
    seenKey = n;
    seen = new Set();
    for (let i = 0; i < run.tiles.length; i++) {
      if (!run.tiles[i].open) continue;
      const x = i % W, y = (i / W) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMap(x + dx, y + dy) && Math.abs(dx) + Math.abs(dy) <= 3) seen.add(idxOf(x + dx, y + dy));
    }
    return true;
  }
  const seenAt = (i) => seen.has(i);

  function tilesIn(rect) {
    const out = [];
    const a0 = Math.floor((rect.x0 - 60) / 32) - 1, a1 = Math.ceil((rect.x1 + 60) / 32) + 1;
    const b0 = Math.floor((rect.y0 - 30) / 16) - 2, b1 = Math.ceil((rect.y1 + 120) / 16) + 1;
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
      if ((a + b) & 1) continue;
      out.push([(a + b) / 2, (b - a) / 2]);
    }
    return out;
  }

  function drawStatic(cc, rect) {
    const run = M.S.run;
    const tiles = tilesIn(rect);
    A.paintGround(cc, rect, pal, tiles);
    const tall = [];
    for (const [x, y] of tiles) {
      const [cx, cy] = A.center(x, y);
      if (isSea(x, y)) {
        const deep = Math.max(-x, -y, x - W + 1, y - H + 1) > 2;
        A.drawWaterTile(cc, x, y, [!isSea(x, y - 1), !isSea(x + 1, y), !isSea(x, y + 1), !isSea(x - 1, y)], deep);
        if (!deep && A.hash(x, y, 31) < 0.12) A.rockS(cc, cx, cy + 4, 0.8, '#8c949e');
        continue;
      }
      if (!inMap(x, y)) {
        const v = A.hash(x, y, 5);
        const ox = (A.hash(y, x, 6) - 0.5) * 16;
        if (reg.edge === 'rocks') { if (v < 0.75) tall.push([x + y, () => A.rockS(cc, cx + ox, cy, 1.4 + v * 0.6, v > 0.4 ? '#c98a55' : '#b07040')]); }
        else if (v < 0.85) tall.push([x + y, () => (A.hash(x, y, 9) < 0.55 || snow) ? A.pineS(cc, cx + ox, cy, 1.15, v, snow) : A.treeS(cc, cx + ox, cy, 1.05, v)]);
        continue;
      }
      if (run && !seenAt(idxOf(x, y))) tall.push([x + y - 0.2, () => A.drawCloudTile(cc, x, y)]);
    }
    if (reg.edge === 'sea') {
      const [sx, sy] = P(shipAt[0], shipAt[1]);
      tall.push([shipAt[0] + shipAt[1] + 1, () => A.drawShip(cc, sx, sy, 0, 0.9)]);
    }
    tall.sort((p, q) => p[0] - q[0]);
    for (const [, f] of tall) f();
  }

  function drawDyn(c, time) {
    const run = M.S.run;
    if (!run) return;
    // clouds live in the static layer; rebuild it when the explored area changes
    if (updateSeen()) stage.invalidate();
    const items = [];
    const energy = M.energy();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idxOf(x, y);
      const tl = run.tiles[i];
      if (!seenAt(i)) continue;
      const reach = visibleAt(i);
      const d = x + y + 0.5;
      if (tl.cover) {
        items.push({ d, f: () => {
          if (reach && energy >= tl.hard) {
            const pulse = 0.5 + 0.5 * Math.sin(time * 4 + x);
            const p = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
            c.beginPath();
            c.moveTo(...p[0]);
            for (let k = 1; k < 4; k++) c.lineTo(...p[k]);
            c.closePath();
            c.fillStyle = `rgba(255,240,150,${0.12 + 0.12 * pulse})`;
            c.fill();
            c.strokeStyle = `rgba(255,255,255,${0.45 + 0.4 * pulse})`;
            c.lineWidth = 1.4;
            c.stroke();
          }
          A.drawCover(c, x, y, tl.cover, time, snow);
          if (tl.item) {
            const [cx, cy] = A.center(x, y);
            if (tl.item.chest) A.drawChest(c, cx + 14, cy + 4, time);
            else { c.globalAlpha = 0.95; A.emoji(c, ITEMS[tl.item.id].e, cx + 12, cy - 4 + Math.sin(time * 3 + x) * 1.5, 15); c.globalAlpha = 1; }
          }
        } });
      } else if (tl.goal) {
        items.push({ d, f: () => {
          const [cx, cy] = A.center(x, y);
          const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
          c.beginPath();
          c.ellipse(cx, cy, 26 + pulse * 4, 13 + pulse * 2, 0, 0, Math.PI * 2);
          c.strokeStyle = `rgba(255,236,120,${0.5 + 0.4 * pulse})`;
          c.lineWidth = 3;
          c.stroke();
          A.drawGoldPile(c, cx - 6, cy + 2, 1);
          A.drawChest(c, cx + 12, cy + 6, time, true);
        } });
      }
    }
    items.push({ d: run.ex + run.ey + 0.6, f: () => A.drawExplorer(c, run.ex, run.ey, time) });
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.f();
  }

  function onTap(sx, sy, e) {
    const run = M.S.run;
    if (!run || run.done) return;
    const p = stage.cam.tileAt(sx, sy);
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (!inMap(x, y)) return;
    const i = idxOf(x, y);
    const tl = run.tiles[i];
    if (tl.open) return;
    if (!visibleAt(i)) return toast(t('err_far'));
    if (!tl.cover) return;
    if (M.energy() < tl.hard) return toast(t('energyNeed', { e: tl.hard }));
    const r = M.runOpen(i);
    if (!r.ok) return toast(errText(r.err));
    sfx.play('hit');
    let k = 0;
    for (const ev of r.log) {
      if (ev.k === 'chest') {
        floatText(t('chest', { c: ev.coins }), e.clientX, e.clientY - 20, 'gain');
        if (ev.gems) floatText('+' + ev.gems + ' 💎', e.clientX, e.clientY - 46, 'gain');
      } else {
        const emoji = ITEMS[ev.id].e;
        setTimeout(() => flyTo(emoji, e.clientX, e.clientY, env.barEl('bag')), 80 * k++);
      }
    }
    if (r.won) return win();
    hud();
  }

  // ------------------------------------------------------------ results
  async function win() {
    const run = M.S.run;
    if (!run) return;
    const reward = { coins: 50 + 10 * run.n, gems: 1 + Math.floor(run.n / 3), xp: 20 + 3 * run.n };
    sfx.play('win');
    ctxConfetti();
    const ok = await env.confirm({
      title: t('winTitle'),
      body: t('winBody', { c: fmtNum(reward.coins), g: reward.gems, x: reward.xp }),
      actions: [{ label: t('winBtn'), value: true, primary: true }],
    });
    if (ok) {
      const r = M.finishRun(true);
      hud();
      for (let i = 0; i < 4; i++) setTimeout(() => flyTo('🪙', window.innerWidth / 2, window.innerHeight / 2, env.hudEl('coins')), i * 120);
      if (r.reward) toast(t('winBody', { c: fmtNum(r.reward.coins), g: r.reward.gems, x: r.reward.xp }));
      env.go('exp');
    }
  }
  function ctxConfetti() {
    env.ui.confetti(70);
  }

  async function askRetreat() {
    const ok = await env.confirm({
      title: t('retreatTitle'),
      body: t('retreatBody'),
      dismissible: true,
      actions: [{ label: t('runRetreat'), value: true, danger: true }, { label: t('cancel'), value: false }],
    });
    if (!ok) return;
    const r = M.finishRun(false);
    hud();
    sfx.play('lose');
    if (!r) return;
    env.go('exp');
  }

  function openBag() {
    const run = M.S.run;
    if (!run) return;
    const entries = Object.entries(run.bag).filter(([, n]) => n > 0);
    const list = h('div', { class: 'g-farm-list' });
    for (const [id, n] of entries) {
      list.append(h('div', { class: 'g-farm-row static' }, h('span', { class: 'g-farm-row-ico' }, ITEMS[id].e), h('span', { class: 'g-farm-row-body' }, h('b', {}, t('item_' + id)), h('small', {}, `× ${n}`))));
    }
    if (!entries.length && !run.coins && !run.gems) list.append(h('p', { class: 'g-farm-text small' }, t('bagEmpty')));
    if (run.coins || run.gems) list.append(h('p', { class: 'g-farm-text small' }, t('runCoins', { c: run.coins, g: run.gems })));
    env.sheet(t('runBag'), list);
  }

  function centerOnExplorer() {
    const run = M.S.run;
    if (!run) return;
    const [wx, wy] = A.center(run.ex, run.ey);
    stage.center(wx, wy);
  }

  function updateChip() {
    const run = M.S.run;
    if (!run) return;
    let seen = 0, total = 0;
    for (const tl of run.tiles) { total++; if (tl.open) seen++; }
    chip.replaceChildren(
      h('span', { class: 'g-farm-regart mini ' + run.reg }, ICON[run.reg]),
      h('span', { class: 'g-farm-chip-txt' }, t('runTitle', { r: t('reg_' + run.reg), n: run.n }) + ` · ${Math.round(seen / total * 100)}%`));
  }

  updateSeen();
  const stage = createStage(wrap, {
    bounds: BOUNDS,
    focus: A.center(run0.ex, Math.max(0, run0.ey - 1.5)),
    zoom: 1.15,
    maxZ: 2.2,
    bg: reg.edge === 'sea' ? '#1f9fd0' : reg.edge === 'snow' ? '#dfeef7' : reg.edge === 'rocks' ? '#c98a55' : '#4f8f34',
    drawStatic,
    drawDynamic: (c, cam, time) => drawDyn(c, time),
    onTap,
  });
  stage.invalidate();
  updateChip();

  return {
    tick() {
      if (!M.S.run) { env.go('exp'); return; }
      updateChip();
    },
    onBack() {
      if (!M.S.run) return false;
      env.go('farm');
      return true;
    },
    destroy() {
      stage.destroy();
      wrap.remove();
    },
  };
}
