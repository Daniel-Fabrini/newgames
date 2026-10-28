// Expeditions: the region picker and the fog-of-war map. Tiles open when they touch an open tile;
// covered tiles are cleared with energy. Reaching the exit ends the expedition with rewards.
import { createStage } from './stage.js';
import { P, TW, TH } from './iso.js';
import * as A from './art.js';
import { REGIONS, ITEMS } from './data.js';
import { openWarehouse } from './panels.js';

const PAL_OF = { forest: A.PAL.forest, canyon: A.PAL.canyon, mine: A.PAL.mine, ruins: A.PAL.ruins, island: A.PAL.island };
const GOAL_COL = { forest: '#ffd23f', canyon: '#ff7a3d', mine: '#7fe3ff', ruins: '#d9b3ff', island: '#7fe6d0' };
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
  const BOUNDS = { x0: -H * TW / 2 - 24, y0: -70, x1: W * TW / 2 + 24, y1: (W + H) * TH / 2 + 40 };
  const pal = PAL_OF[run0.reg];
  const wrap = h('div', { class: 'g-farm-stagewrap' });
  host.append(wrap);
  const chip = h('div', { class: 'g-farm-chip run-chip' });
  const hint = h('div', { class: 'g-farm-hintchip' }, t('runHint'));
  wrap.append(chip, hint);
  const idxOf = (x, y) => y * W + x;
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  setBar([
    { id: 'retreat', icon: '🏳️', label: t('runRetreat'), onclick: askRetreat },
    { id: 'bag', icon: '🎒', label: t('runBag'), onclick: openBag },
    { id: 'center', icon: '🎯', label: t('runCenter'), onclick: () => centerOnExplorer() },
  ]);

  function visibleAt(i) {
    return M.visibleRun(M.S.run, i);
  }

  function drawStatic(cc) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = A.hash(x, y, 11);
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      if (run0.reg === 'island' && edge && v > 0.35) A.drawTile(cc, x, y, A.PAL.water, 'water', v);
      else A.drawTile(cc, x, y, pal, 'grass', v);
    }
  }

  function drawDyn(c, time) {
    const run = M.S.run;
    if (!run) return;
    // fog first: flat, under every object
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!visibleAt(idxOf(x, y))) A.drawFog(c, x, y, time);
    }
    const items = [];
    const clearable = M.energy();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idxOf(x, y);
      const tl = run.tiles[i];
      if (!visibleAt(i)) continue;
      const d = x + y + 0.5;
      if (tl.cover) {
        items.push({ d, f: () => {
          A.drawCover(c, x, y, tl.cover, time);
          if (tl.item) A.drawItemOnTile(c, x, y, tl.item.chest ? '🎁' : ITEMS[tl.item.id].e, time);
          if (tl.cover && clearable >= tl.hard) {
            const pulse = 0.5 + 0.5 * Math.sin(time * 4 + x);
            const p = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
            c.beginPath();
            c.moveTo(...p[0]);
            for (let k = 1; k < 4; k++) c.lineTo(...p[k]);
            c.closePath();
            c.strokeStyle = `rgba(255,220,90,${0.35 + 0.5 * pulse})`;
            c.lineWidth = 1.6;
            c.stroke();
          }
        } });
      } else if (tl.goal) {
        items.push({ d, f: () => A.drawGoal(c, x, y, run.reg, GOAL_COL[run.reg], time) });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.f();
    // explorer on top of its last tile
    A.drawAdventurer(c, run.ex, run.ey, time, false);
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

  const stage = createStage(wrap, {
    bounds: BOUNDS,
    focus: { x0: BOUNDS.x0, y0: BOUNDS.y0, x1: BOUNDS.x1, y1: BOUNDS.y1 },
    drawStatic: (cc) => drawStatic(cc),
    drawDynamic: (c, cam, time) => drawDyn(c, time),
    onTap,
  });
  stage.invalidate();
  window.__farmDbg && (window.__farmDbg.stage = stage); // DBG
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
