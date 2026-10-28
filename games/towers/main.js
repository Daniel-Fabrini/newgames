// Tower Battles: lobby modes (assault / defense / arena) against a CPU rival.
// Shell contract: mount(root, ctx) returns a cleanup function. See docs/GAME_API.md.

import STRINGS from './strings.js';
import { Match, TICK, geometry } from './sim.js';
import { createBrain } from './ai.js';
import { TOWERS, TOWER_ORDER, SENDS, SKINS, SKIN_ORDER, TRACKS, TIERS, CELL, COLS, ROWS, WORLD_W, WORLD_H, towerStats, stakeFor, FAST, CAMO, REGEN, FLAG_NAMES } from './data.js';
import { BoardRenderer, towerBase, towerHead, drawTrackPreview, buildBackground, blobSprite } from './render.js';
import { defaultMeta, unlockedTowers, unlockedSkin, roman, rankInfo, nextRankAt } from './meta.js';

const MODES = ['assault', 'defense', 'arena'];
const MODE_ICON = { assault: '⚔️', defense: '🏰', arena: '🏆' };
const UP_STATS = ['dmg', 'cd', 'range', 'splash', 'slow', 'chain', 'multi', 'pierce', 'burnDps', 'shredMax', 'acid', 'stun', 'buff', 'haste', 'sorte', 'puddle', 'armorIgnore'];
const STAT_LABEL = {
  dmg: 'st_dmg', cd: 'st_cd', range: 'st_range', splash: 'st_splash', slow: 'st_slow', chain: 'st_chain', multi: 'st_multi',
  pierce: 'st_pierce', burnDps: 'st_burn', shredMax: 'st_shred', acid: 'st_acid', stun: 'st_stun', buff: 'st_buff',
  haste: 'st_haste', sorte: 'st_sorte', puddle: 'st_puddle', armorIgnore: 'st_armor',
};

export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);
  const { h, clear, toast, modal } = ctx.ui;
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const store = ctx.store;

  // ------------------------------------------------------------ save data
  const meta = { ...defaultMeta(), ...(store.get('meta', null) || {}) };
  if (!SKINS[meta.skin] || !unlockedSkin(meta.skin, meta.wins)) meta.skin = 'classic';
  const saveMeta = () => store.set('meta', meta);

  // Sound helpers: sfx may be silent before the first gesture, that is fine.
  const play = (name) => { try { ctx.sfx.play(name); } catch (e) { /* ignore */ } };
  let lastSfx = {};
  const throttled = (name, gap = 0.06) => {
    const now = performance.now() / 1000;
    if (lastSfx[name] && now - lastSfx[name] < gap) return;
    lastSfx[name] = now;
    play(name);
  };

  // ------------------------------------------------------------ DOM skeleton
  const app = h('div', { class: 'tw-app' });
  root.append(app);

  // Menu
  const menu = h('div', { class: 'tw-screen tw-menu' });
  const heroCanvas = h('canvas', { class: 'tw-hero' });
  const statsLine = h('div', { class: 'tw-stats' });
  const modeGrid = h('div', { class: 'tw-modes' });
  const skinRow = h('div', { class: 'tw-chips' });
  const towerGrid = h('div', { class: 'tw-tower-list' });
  menu.append(
    h('div', { class: 'tw-hero-wrap' }, heroCanvas, h('div', { class: 'tw-hero-sub' }, t('menu_sub'))),
    statsLine,
    h('div', { class: 'tw-sec' }, modeGrid),
    h('div', { class: 'tw-sec-title' }, t('menu_skins')),
    skinRow,
    h('div', { class: 'tw-sec-title' }, t('menu_towers')),
    towerGrid,
  );

  // Track picker
  const pick = h('div', { class: 'tw-screen tw-pick' });
  const pickHead = h('div', { class: 'tw-pick-head' });
  const rankCard = h('div', { class: 'tw-rank' });
  const trackGrid = h('div', { class: 'tw-tracks' });
  pick.append(pickHead, rankCard, h('button', { class: 'btn primary block tw-rand', onclick: () => startFromPick(TRACKS[Math.floor(Math.random() * TRACKS.length)]) }, '🎲 ' + t('random_track')), trackGrid);

  // Match
  const matchWrap = h('div', { class: 'tw-screen tw-match' });
  const oppCanvas = h('canvas', { class: 'tw-mini' });
  const oppInfo = h('div', { class: 'tw-oppinfo' });
  const oppBox = h('div', { class: 'tw-opp' }, oppCanvas, oppInfo);
  const hudLives = h('span', { class: 'tw-pill' });
  const hudCoins = h('span', { class: 'tw-pill coin' });
  const hudWave = h('span', { class: 'tw-pill wave' });
  const btnCall = h('button', { class: 'tw-btn small', onclick: () => callWave() });
  const btnSpeed = h('button', { class: 'tw-btn small', onclick: () => toggleSpeed() });
  const btnPause = h('button', { class: 'tw-btn small icon', onclick: () => openPause() }, '❚❚');
  const hud = h('div', { class: 'tw-hud' }, h('div', { class: 'tw-hud-row' }, hudLives, hudCoins, hudWave), h('div', { class: 'tw-hud-row' }, btnCall, btnSpeed, btnPause));
  const boardWrap = h('div', { class: 'tw-board' });
  const boardCanvas = h('canvas', { class: 'tw-canvas' });
  const banner = h('div', { class: 'tw-banner' });
  boardWrap.append(boardCanvas, banner);
  const panel = h('div', { class: 'tw-panel' });
  const sendBar = h('div', { class: 'tw-sendbar' });
  matchWrap.append(oppBox, hud, boardWrap, panel, sendBar);

  // Overlays (pause, result)
  const overlay = h('div', { class: 'tw-overlay' });
  root.append(menu, pick, matchWrap, overlay);

  // ------------------------------------------------------------ state
  let screen = 'menu';
  let match = null;
  let mode = null;
  let track = null;
  let stake = 0;
  let rankBefore = null;
  let paused = false;
  let selected = null;      // tower id
  let placing = null;       // tower type id
  let hover = { col: -1, row: -1 };
  let pointerDown = null;
  let rafId = 0;
  let last = performance.now();
  let uiTimer = 0;
  let endTimer = 0;
  let resultShown = false;
  let bannerTimer = 0;
  let disposed = false;
  let board = new BoardRenderer(boardCanvas);
  const mini = new BoardRenderer(oppCanvas, { mini: true });
  mini.resize(62, 88);
  const shopCards = {};
  let panelMode = null;     // 'shop' | 'tower'
  const sendBtns = [];
  let towerPanelKey = '';

  root.__towers = { get match() { return match; }, startMatch: (m, tr) => startMatch(m, tr) };

  // ------------------------------------------------------------ helpers
  const showScreen = (name) => {
    screen = name;
    menu.style.display = name === 'menu' ? '' : 'none';
    pick.style.display = name === 'pick' ? '' : 'none';
    matchWrap.style.display = name === 'match' ? '' : 'none';
    if (name !== 'match') { closeOverlay(); }
    if (name === 'menu') renderMenu();
    if (name === 'pick') renderPick();
  };

  const unlocked = () => unlockedTowers(meta.kills);
  const rankOf = () => rankInfo(meta.medals);

  const fmtStat = (k, v) => {
    switch (k) {
      case 'cd': return `${Math.round(v * 100) / 100}s`;
      case 'slow': return `${Math.round((1 - v) * 100)}%`;
      case 'buff': case 'haste': case 'sorte': return `${Math.round(v * 100)}%`;
      case 'burnDps': case 'acid': return `${v}/s`;
      case 'stun': return `${v}s`;
      case 'shredMax': return `${v}×`;
      default: return String(v);
    }
  };

  const upgradeDiff = (typeId, a, b, path) => {
    const type = TOWERS[typeId];
    const before = towerStats(type, a, b);
    const after = towerStats(type, a + (path === 'A' ? 1 : 0), b + (path === 'B' ? 1 : 0));
    const out = [];
    for (const k of UP_STATS) {
      const x = before[k] ?? 0, y = after[k] ?? 0;
      if (x !== y) out.push(`${t(STAT_LABEL[k])} ${fmtStat(k, x)} → ${fmtStat(k, y)}`);
    }
    return out;
  };

  const towerName = (id) => t(TOWERS[id].name);
  const enemyName = (tier, flags) => {
    const parts = [t(TIERS[tier].name)];
    for (const f of [FAST, CAMO, REGEN]) if (flags & f) parts.unshift(t(FLAG_NAMES[f]));
    return parts.join(' ');
  };

  // Draws a tower icon (base + head) into a canvas element of css size `size`.
  const towerIcon = (typeId, size = 44) => {
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    const g = c.getContext('2d');
    const K = (size * dpr) / 46;
    const base = towerBase(typeId, meta.skin, K);
    g.drawImage(base, 0, 0, c.width, c.height);
    if (TOWERS[typeId].kind !== 'lantern') {
      const head = towerHead(typeId, meta.skin, K);
      g.drawImage(head, 0, 0, c.width, c.height);
    }
    return c;
  };

  // ------------------------------------------------------------ menu
  function renderMenu() {
    clear(statsLine).append(
      h('span', null, t('menu_stats', { k: meta.kills, w: meta.wins })),
      h('span', { class: 'tw-rank-chip' }, `${MODE_ICON.arena} ${t('arena_rank', { r: rankName(rankOf()) })}`),
    );
    clear(modeGrid);
    for (const m of MODES) {
      modeGrid.append(h('button', { class: 'tw-mode', onclick: () => chooseMode(m) },
        h('span', { class: 'tw-mode-ico' }, MODE_ICON[m]),
        h('span', { class: 'tw-mode-body' }, h('b', null, t('mode_' + m)), h('small', null, t('mode_' + m + '_d')))));
    }
    clear(skinRow);
    for (const id of SKIN_ORDER) {
      const ok = unlockedSkin(id, meta.wins);
      const chip = h('button', {
        class: 'tw-chip' + (meta.skin === id ? ' on' : '') + (ok ? '' : ' lock'),
        onclick: () => {
          if (!ok) { toast(t('menu_skin_unlock', { n: SKINS[id].unlock })); return; }
          meta.skin = id; saveMeta(); renderMenu();
        },
      }, (ok ? '' : '🔒 ') + t(SKINS[id].name));
      skinRow.append(chip);
    }
    clear(towerGrid);
    const un = unlocked();
    for (const id of TOWER_ORDER) {
      const type = TOWERS[id];
      const ok = un.has(id);
      const pct = Math.min(100, Math.round((meta.kills / Math.max(1, type.unlock)) * 100));
      towerGrid.append(h('div', { class: 'tw-tcard' + (ok ? '' : ' lock') },
        h('div', { class: 'tw-tcard-ico' }, towerIcon(id, 44)),
        h('div', { class: 'tw-tcard-body' },
          h('b', null, towerName(id) + (ok ? '' : ' 🔒')),
          h('small', null, ok ? t('d_' + id.replace('tw_', '')) : t('menu_unlock_at', { n: type.unlock })),
          ok ? null : h('div', { class: 'tw-prog' }, h('i', { style: { width: pct + '%' } })),
        ),
        h('div', { class: 'tw-tcard-cost' }, String(type.cost)),
      ));
    }
    requestDraw();
    drawHero();
  }

  function drawHero() {
    const canvas = heroCanvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 340, hh = canvas.clientHeight || 170;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
    const tr = TRACKS[0];
    const bg = buildBackground(tr, w, hh, dpr);
    const g = canvas.getContext('2d');
    g.drawImage(bg.canvas, 0, 0);
    const K = bg.scale * dpr;
    g.setTransform(K, 0, 0, K, bg.ox * dpr, bg.oy * dpr);
    const towers = [['archer', 3, 4], ['cannon', 6, 7], ['frost', 4, 9], ['bolt', 7, 2]];
    for (const [id, c, r] of towers) {
      const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
      const L = 46;
      g.drawImage(towerBase(id, meta.skin, K), x - L / 2, y - L / 2, L, L);
      if (TOWERS[id].kind !== 'lantern') g.drawImage(towerHead(id, meta.skin, K), x - L / 2, y - L / 2, L, L);
    }
    const geo = geometry(tr);
    const blobs = [[0, 1, 0], [1, 1, 0], [2, 2, 0], [4, 1, 0], [3, 1, 0]];
    blobs.forEach(([tier, flags], i) => {
      const s = (i * 150 + 40) % geo.total;
      let k = 0; while (k < geo.len.length - 1 && geo.cum[k + 1] < s) k++;
      const f = (s - geo.cum[k]) / geo.len[k];
      const x = geo.px[k] + (geo.px[k + 1] - geo.px[k]) * f, y = geo.py[k] + (geo.py[k + 1] - geo.py[k]) * f;
      const sp = blobSprite(tier, flags, K);
      const size = TIERS[tier].r * 2 + 18;
      g.drawImage(sp, x - size / 2, y - size / 2, size, size);
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  const rankName = (ri) => (ri.named ? `${t(ri.nameKey)} ${roman(ri.div)}` : `${t('rk_next', { n: ri.nextN })} ${roman(ri.div)}`);

  function chooseMode(m) {
    mode = m;
    showScreen('pick');
  }

  // ------------------------------------------------------------ track picker
  function renderPick() {
    clear(pickHead).append(
      h('button', { class: 'tw-back', onclick: () => showScreen('menu'), 'aria-label': 'back' }, '‹'),
      h('div', { class: 'tw-pick-title' }, MODE_ICON[mode] + ' ' + t('mode_' + mode)),
      h('div', { class: 'tw-pick-sub' }, t('choose_track')),
    );
    clear(rankCard);
    if (mode === 'arena') {
      const ri = rankOf();
      const st = Math.min(meta.medals, stakeFor(ri.level));
      const need = Math.max(0, nextRankAt(ri.level) - meta.medals);
      rankCard.append(
        h('div', { class: 'tw-rank-main' }, h('span', { class: 'tw-rank-badge' }, '🏅'), h('div', null, h('b', null, rankName(ri)), h('small', null, t('arena_medals', { n: meta.medals }) + ' · ' + t('arena_next', { n: need })))),
        h('div', { class: 'tw-rank-stake' }, st > 0 ? t('arena_stake', { n: st }) : t('arena_stake_none')),
      );
      rankCard.style.display = '';
    } else {
      rankCard.style.display = 'none';
    }
    clear(trackGrid);
    for (const tr of TRACKS) {
      const cv = h('canvas', { class: 'tw-tprev' });
      const best = meta.best[tr.id] || 0;
      trackGrid.append(h('button', { class: 'tw-tcard-track', onclick: () => startFromPick(tr) },
        cv,
        h('div', { class: 'tw-tname' }, t(tr.name)),
        h('small', null, best ? t('best_wave', { n: best }) : t('no_record')),
      ));
      requestAnimationFrame(() => drawTrackPreview(cv, tr));
    }
  }

  function startFromPick(tr) {
    startMatch(mode, tr);
  }

  // ------------------------------------------------------------ match setup
  function startMatch(m, tr) {
    mode = m;
    track = tr;
    meta.lastTrack = tr.id;
    const ri = rankOf();
    stake = m === 'arena' ? Math.min(meta.medals, stakeFor(ri.level)) : 0;
    rankBefore = { medals: meta.medals, level: ri.level };
    const skill = m === 'arena' ? Math.min(0.95, 0.45 + 0.025 * ri.level) : 0.6;
    match = new Match({
      track: tr,
      seed: (Math.random() * 1e9) | 0,
      sending: m !== 'defense',
      unlocked: [...unlocked()],
      sides: [{ skin: meta.skin, ai: null }, { skin: 'royal', ai: createBrain({ skill }) }],
    });
    match.mode = m;
    board.setTrack(tr);
    mini.setTrack(tr);
    board.bg = null; mini.bg = null;
    paused = false;
    selected = null;
    placing = null;
    resultShown = false;
    endTimer = 0;
    bannerTimer = 0;
    buildPanelShell();
    buildSendBar();
    showScreen('match');
    setBanner(t('roundStart', { n: 1 }), 1.4);
    last = performance.now();
    root.__match = match;
    saveMeta();
  }

  function buildSendBar() {
    clear(sendBar);
    sendBtns.length = 0;
    if (!match.sending) {
      sendBar.style.display = 'none';
      return;
    }
    sendBar.style.display = '';
    sendBar.append(h('div', { class: 'tw-sendhead' }, t('sendBar')));
    SENDS.forEach((opt, i) => {
      const dot = h('i', { class: 'tw-dot', style: { background: TIERS[opt.tier].body } });
      const btn = h('button', { class: 'tw-send', onclick: () => sendIdx(i) },
        dot,
        h('span', { class: 'tw-send-name' }, t('send_' + opt.id)),
        h('span', { class: 'tw-send-cost' }, '◉ ' + opt.cost),
        h('span', { class: 'tw-send-inc' }, '+' + opt.inc),
      );
      sendBtns.push({ btn, opt, i });
      sendBar.append(btn);
    });
  }

  function buildPanelShell() {
    clear(panel);
    panelMode = null;
    for (const k of Object.keys(shopCards)) delete shopCards[k];
    towerPanelKey = '';
  }

  // Shop: tower cards. Tower panel: shown when a tower is selected.
  function renderShop() {
    panel.classList.remove('tall');
    if (panelMode !== 'shop') {
      panelMode = 'shop';
      clear(panel);
      const row = h('div', { class: 'tw-shop' });
      for (const id of TOWER_ORDER) {
        const type = TOWERS[id];
        const card = h('button', { class: 'tw-card', onclick: () => pickType(id) },
          towerIcon(id, 40),
          h('span', { class: 'tw-card-name' }, towerName(id)),
          h('span', { class: 'tw-card-cost' }, '◉ ' + type.cost),
          h('span', { class: 'tw-card-lock' }, '🔒 ' + type.unlock),
        );
        shopCards[id] = card;
        row.append(card);
      }
      const hint = h('div', { class: 'tw-hint' }, t('place'));
      panel.append(row, hint);
      shopCards.hint = hint;
    }
    const un = match ? [...unlocked()] : [];
    const coins = match ? match.sides[0].coins : 0;
    for (const id of TOWER_ORDER) {
      const card = shopCards[id];
      const ok = un.includes(id);
      card.classList.toggle('lock', !ok);
      card.classList.toggle('dim', ok && coins < TOWERS[id].cost);
      card.classList.toggle('on', placing === id);
      card.querySelector('.tw-card-lock').style.display = ok ? 'none' : '';
    }
    shopCards.hint.textContent = placing ? t('place') : t('shop');
    shopCards.hint.classList.toggle('placing', !!placing);
  }

  function renderTowerPanel(tw) {
    const type = TOWERS[tw.type];
    const key = `${tw.id}|${tw.a}|${tw.b}|${tw.pri}`;
    if (panelMode !== 'tower' || towerPanelKey !== key) {
      towerPanelKey = key;
      panelMode = 'tower';
      panel.classList.add('tall');
      clear(panel);
      const head = h('div', { class: 'tw-tp-head' },
        towerIcon(tw.type, 40),
        h('div', { class: 'tw-tp-title' }, h('b', null, towerName(tw.type)), h('small', null, `${t('st_tier')} ${tw.a}·${tw.b}`)),
        h('button', { class: 'tw-btn small danger', onclick: () => sellSelected() }, t('sellFor', { n: Math.floor(tw.invested * 0.7) })),
        h('button', { class: 'tw-btn small icon', onclick: () => { selected = null; towerPanelKey = ''; renderPanelNow(); } }, '✕'),
      );
      const statsLine = h('div', { class: 'tw-tp-stats' });
      const ups = h('div', { class: 'tw-tp-ups' });
      for (const path of ['A', 'B']) {
        const cur = path === 'A' ? tw.a : tw.b;
        const btn = h('button', { class: 'tw-up', dataset: { path }, onclick: () => upgradeSelected(path) });
        ups.append(btn);
      }
      const pri = h('div', { class: 'tw-pri' }, h('span', null, t('targeting')));
      for (const p of ['first', 'last', 'strong']) {
        if (type.kind === 'lantern') break;
        pri.append(h('button', { class: 'tw-chip small' + (tw.pri === p ? ' on' : ''), onclick: () => { match.setPriority(0, tw.id, p); towerPanelKey = ''; renderPanelNow(); } }, t(p)));
      }
      panel.append(head, statsLine, ups, pri);
      tw._ui = { statsLine, ups };
    }
    const ui = tw._ui;
    if (!ui) return;
    const st = tw.st;
    const parts = [];
    if (type.kind === 'lantern') {
      parts.push(`${t('st_buff')} ${fmtStat('buff', st.buff)}`, `${t('st_haste')} ${fmtStat('haste', st.haste)}`, `${t('st_range')} ${st.range}`);
    } else {
      parts.push(`${t('st_dmg')} ${st.dmg}`, `${t('st_cd')} ${fmtStat('cd', st.cd)}`, `${t('st_range')} ${st.range}`);
    }
    ui.statsLine.textContent = parts.join(' · ');
    const btns = ui.ups.querySelectorAll('.tw-up');
    btns.forEach((btn) => {
      const path = btn.dataset.path;
      const tier = path === 'A' ? tw.a : tw.b;
      const other = path === 'A' ? tw.b : tw.a;
      const ok = !match.upgradeReason(0, tw.id, path);
      const maxed = tier >= 3 || (tier + 1 === 3 && other >= 3);
      const name = maxed && tier >= 3 ? t('maxed') : `${t(type[path][tier]?.name || 'up_rapid')} ${roman(tier + 1)}`;
      const cost = tier < 3 ? type[path][tier].cost : '';
      const diff = tier < 3 ? upgradeDiff(tw.type, tw.a, tw.b, path).slice(0, 2).join(' · ') : '';
      btn.className = 'tw-up' + (ok ? '' : ' off') + (path === 'B' ? ' b' : ' a');
      btn.textContent = '';
      btn.append(h('b', null, `${path} · ${name}`), h('small', null, tier < 3 ? `◉ ${cost}  ${diff}` : t('maxed')));
    });
  }

  function renderPanelNow() {
    if (selected) {
      const tw = match.findTower(0, selected);
      if (tw) { renderTowerPanel(tw); return; }
      selected = null;
    }
    towerPanelKey = '';
    renderShop();
  }

  // ------------------------------------------------------------ actions
  function pickType(id) {
    if (!match || match.over) return;
    if (!unlocked().has(id)) { toast(t('err_locked', { n: TOWERS[id].unlock })); play('error'); return; }
    selected = null;
    placing = placing === id ? null : id;
    towerPanelKey = '';
    renderPanelNow();
  }

  function tryBuild(col, row) {
    if (!placing || !match || match.over) return;
    const res = match.build(0, placing, col, row);
    if (res.ok) {
      play('tap');
      board.consume([{ type: 'build', side: 0, x: res.tower.x, y: res.tower.y }], 0);
    } else {
      const onPath = match.geo.cells.has(row * COLS + col);
      const msg = onPath ? 'err_path' : { blocked: 'err_blocked', occupied: 'err_occupied', coins: 'err_coins', locked: 'err_locked' }[res.reason] || 'err_blocked';
      toast(t(msg, { n: TOWERS[placing].unlock }));
      play('error');
      if (col >= 0 && row >= 0 && col < COLS && row < ROWS) {
        board.consume([{ type: 'hit', side: 0, x: (col + 0.5) * CELL, y: (row + 0.5) * CELL }], 0);
      }
    }
    renderPanelNow();
  }

  function selectTowerAt(x, y) {
    let best = null, bd = 26 * 26;
    for (const tw of match.sides[0].towers) {
      const d = (tw.x - x) ** 2 + (tw.y - y) ** 2;
      if (d < bd) { bd = d; best = tw; }
    }
    selected = best ? best.id : null;
    if (best) placing = null;
    towerPanelKey = '';
    renderPanelNow();
  }

  function upgradeSelected(path) {
    if (!selected || !match) return;
    const reason = match.upgradeReason(0, selected, path);
    if (reason) {
      toast(t(reason === 'coins' ? 'err_coins' : 'err_max'));
      play('error');
      return;
    }
    match.upgrade(0, selected, path);
    play('levelup');
    towerPanelKey = '';
    renderPanelNow();
  }

  function sellSelected() {
    if (!selected || !match) return;
    const r = match.sell(0, selected);
    if (r.ok) { toast(t('sold')); play('coin'); }
    selected = null;
    towerPanelKey = '';
    renderPanelNow();
  }

  function sendIdx(i) {
    if (!match || match.over) return;
    const reason = match.sendReason(0, i);
    if (reason) {
      if (reason === 'locked') toast(t('err_send_locked', { n: SENDS[i].unlock }));
      else if (reason === 'coins') toast(t('err_coins'));
      else toast(t('send_none'));
      play('error');
      return;
    }
    match.send(0, i);
    play('whoosh');
  }

  function callWave() {
    if (!match || match.over) return;
    const r = match.callRound(0);
    if (r.ok) { play('coin'); }
  }

  function toggleSpeed() {
    if (!match) return;
    match.speed = match.speed === 1 ? 2 : 1;
    btnSpeed.textContent = (match.speed === 2 ? '2×' : '1×');
    btnSpeed.classList.toggle('on', match.speed === 2);
    play('tap');
  }

  function setBanner(text, secs = 1.6, cls = '') {
    banner.textContent = text;
    banner.className = 'tw-banner show ' + cls;
    bannerTimer = secs;
  }

  // ------------------------------------------------------------ pause / result overlay
  function openPause() {
    if (!match || match.over) return;
    paused = true;
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'tw-sheet' },
      h('div', { class: 'tw-sheet-title' }, t('pause_title')),
      h('button', { class: 'tw-btn primary block', onclick: () => closeOverlay() }, '▶ ' + t('resume')),
      h('button', { class: 'tw-btn block', onclick: () => { closeOverlay(); showScreen('pick'); } }, t('changeTrack')),
      h('button', { class: 'tw-btn block', onclick: () => { closeOverlay(); showScreen('menu'); } }, t('toMenu')),
    ));
    overlay.classList.add('show');
  }

  function closeOverlay() {
    overlay.classList.remove('show');
    overlay.innerHTML = '';
    if (match && !match.over && screen === 'match') paused = false;
    resultShown = resultShown && match && match.over;
  }

  function showResult() {
    if (resultShown || !match) return;
    resultShown = true;
    paused = true;
    const w = match.over.winner;
    const ps = match.sides[0], pr = match.sides[1];
    const won = w === 0, draw = w === -1;
    const oldKills = meta.kills;
    const oldWins = meta.wins;
    // Results
    meta.games++;
    meta.kills += ps.pops;
    if (won) meta.wins++;
    const waves = ps.round;
    if (waves > (meta.best[track.id] || 0)) meta.best[track.id] = waves;
    let medalChange = 0;
    if (mode === 'arena') {
      if (won) medalChange = stake > 0 ? stake : 1;
      else if (!draw) medalChange = -stake;
      meta.medals = Math.max(0, meta.medals + medalChange);
    }
    const xp = 10 + (won ? 20 : 0) + Math.min(30, waves);
    let xpRes = null;
    try { xpRes = ctx.addXP?.(xp); } catch (e) { /* shell missing: ignore */ }
    saveMeta();
    const ri = rankOf();
    const newTowers = TOWER_ORDER.filter((id) => TOWERS[id].unlock > oldKills && TOWERS[id].unlock <= meta.kills);
    const newSkins = SKIN_ORDER.filter((id) => SKINS[id].unlock > oldWins && SKINS[id].unlock <= meta.wins);
    if (won) play('win'); else if (draw) play('whistle'); else play('lose');
    if (won) board.consume([{ type: 'boom', side: 0, x: WORLD_W / 2, y: WORLD_H / 2, r: 60, kind: 'x' }], 0);
    const rows = [
      [t('res_waves'), waves], [t('res_pops'), ps.pops], [t('res_sent'), ps.sent],
      [t('res_towers'), ps.towers.length], [t('res_time'), t('minutes', { n: Math.max(1, Math.round(match.time / 60)) })],
    ];
    const lines = [];
    if (mode === 'arena') {
      lines.push(h('div', { class: 'tw-res-line' }, `${t('res_medals')}: ${meta.medals} (${medalChange >= 0 ? '+' : ''}${medalChange})`));
      if (ri.level > rankBefore.level) lines.push(h('div', { class: 'tw-res-line good' }, t('res_new_rank', { r: rankName(ri) })));
      else lines.push(h('div', { class: 'tw-res-line' }, t('res_rank_down', { r: rankName(ri) })));
    }
    lines.push(h('div', { class: 'tw-res-line' }, `${t('res_xp')}: +${xp}${xpRes && xpRes.gained ? '' : ''}`));
    for (const id of newTowers) lines.push(h('div', { class: 'tw-res-line good' }, t('res_unlock_tower', { n: towerName(id) })));
    for (const id of newSkins) lines.push(h('div', { class: 'tw-res-line good' }, t('res_unlock_skin', { n: t(SKINS[id].name) })));
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'tw-sheet tw-result ' + (won ? 'won' : draw ? 'draw' : 'lost') },
      h('div', { class: 'tw-sheet-title big' }, won ? t('win') : draw ? t('draw') : t('lose')),
      h('div', { class: 'tw-sheet-sub' }, won ? t('winSub') : draw ? t('drawSub') : t('loseSub')),
      h('div', { class: 'tw-res-grid' }, ...rows.map(([k, v]) => h('div', { class: 'tw-res-cell' }, h('small', null, k), h('b', null, String(v))))),
      h('div', { class: 'tw-res-lines' }, ...lines),
      h('div', { class: 'tw-res-btns' },
        h('button', { class: 'tw-btn primary block', onclick: () => { overlay.classList.remove('show'); startMatch(mode, track); } }, '↻ ' + t('rematch')),
        h('button', { class: 'tw-btn block', onclick: () => { overlay.classList.remove('show'); showScreen('pick'); } }, t('changeTrack')),
        h('button', { class: 'tw-btn block', onclick: () => { overlay.classList.remove('show'); showScreen('menu'); } }, t('toMenu')),
      ),
    ));
    overlay.classList.add('show');
  }

  // ------------------------------------------------------------ per-frame
  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'round':
          if (ev.side === 0) { setBanner(t('roundStart', { n: ev.round }), 1.3); play('whistle'); }
          break;
        case 'send':
          if (ev.side === 0) { setBanner(t('send_sent', { n: SENDS[ev.opt].count, name: t('send_' + SENDS[ev.opt].id) }), 1.6, 'good'); }
          else { setBanner(t('send_received', { n: SENDS[ev.opt].count, name: t('send_' + SENDS[ev.opt].id) }), 1.8, 'bad'); board.shake = Math.max(board.shake, 4); play('whistle'); }
          break;
        case 'pop':
          if (ev.side === 0) throttled('pop', 0.05);
          if (ev.boss && ev.side === 0) play('explosion');
          break;
        case 'leak':
          if (ev.side === 0) { throttled('error', 0.3); }
          else { throttled('tap', 0.2); }
          break;
        case 'boom':
          if (ev.side === 0) throttled('explosion', 0.12);
          break;
        case 'bolt':
          if (ev.side === 0) throttled('shoot', 0.1);
          break;
        case 'hit':
          if (ev.side === 0) throttled('hit', 0.08);
          break;
        case 'sell':
          break;
        case 'over':
          endTimer = 1.1;
          break;
        default: break;
      }
    }
    board.consume(events, 0);
    mini.consume(events, 1);
  }

  function refreshHud() {
    if (!match) return;
    const me = match.sides[0], op = match.sides[1];
    hudLives.textContent = '♥ ' + Math.max(0, me.lives);
    hudCoins.textContent = '◉ ' + me.coins;
    const sec = Math.max(0, Math.ceil(me.timer));
    hudWave.textContent = t('wave', { n: me.round }) + ' · ' + t('nextWave', { s: sec });
    const inc = (me.round ? 60 + me.round * 3 : 0) + me.sendIncome;
    btnCall.textContent = t('callWave');
    btnCall.disabled = match.over || me.timer <= 0;
    btnSpeed.textContent = match.speed === 2 ? '2×' : '1×';
    oppInfo.innerHTML = '';
    oppInfo.append(
      h('b', null, t(mode === 'arena' || mode === 'assault' ? 'rival' : 'cpu')),
      h('span', null, `♥ ${Math.max(0, op.lives)} · ◉ ${op.coins}`),
      h('small', null, `${t('wave', { n: op.round })} · ${t('income')} +${(60 + op.round * 3) + op.sendIncome}`),
    );
    for (const { btn, opt } of sendBtns) {
      const locked = me.round < opt.unlock;
      const ok = !locked && me.coins >= opt.cost;
      btn.classList.toggle('lock', locked);
      btn.classList.toggle('dim', !locked && !ok);
      btn.querySelector('.tw-send-cost').textContent = locked ? t('send_locked', { n: opt.unlock }) : '◉ ' + opt.cost;
    }
    renderPanelNow();
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (screen === 'match' && match) {
      if (!paused && !match.over) match.update(dt);
      const events = match.drainEvents();
      if (events.length) handleEvents(events);
      board.resize(boardWrap.clientWidth || 360, boardWrap.clientHeight || 400);
      board.tick(dt);
      mini.tick(dt);
      board.setTrack(match.track);
      board.render(match, match.sides[0], {
        placing,
        hoverCol: hover.col, hoverRow: hover.row,
        hoverOk: placing ? !match.canBuild(0, placing, hover.col, hover.row) : false,
        selected,
      });
      mini.renderMini(match, match.sides[1]);
      if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) banner.classList.remove('show'); }
      if (match.over) {
        endTimer -= dt;
        if (endTimer <= 0 && !resultShown) showResult();
      }
      uiTimer -= dt;
      if (uiTimer <= 0) { uiTimer = 0.12; refreshHud(); }
    }
    rafId = requestAnimationFrame(frame);
  }

  function requestDraw() { /* frame loop runs continuously while mounted */ }

  // ------------------------------------------------------------ input
  boardCanvas.addEventListener('pointerdown', (e) => {
    if (!match || match.over) return;
    boardCanvas.setPointerCapture?.(e.pointerId);
    pointerDown = { x: e.clientX, y: e.clientY, moved: false };
    const p = board.toWorld(e.clientX, e.clientY);
    hover = { col: Math.floor(p.x / CELL), row: Math.floor(p.y / CELL) };
  });
  boardCanvas.addEventListener('pointermove', (e) => {
    if (!match) return;
    const p = board.toWorld(e.clientX, e.clientY);
    hover = { col: Math.floor(p.x / CELL), row: Math.floor(p.y / CELL) };
    if (pointerDown && Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 10) pointerDown.moved = true;
  });
  const endPress = (e) => {
    if (!match || !pointerDown) return;
    const p = board.toWorld(e.clientX, e.clientY);
    const moved = pointerDown.moved;
    pointerDown = null;
    if (match.over) return;
    if (placing) {
      if (p.x >= 0 && p.y >= 0 && p.x < WORLD_W && p.y < WORLD_H) {
        const col = Math.floor(p.x / CELL), row = Math.floor(p.y / CELL);
        if (match.sides[0].grid[row * COLS + col] === 2) { placing = null; selectTowerAt(p.x, p.y); }
        else tryBuild(col, row);
      }
      return;
    }
    if (!moved) selectTowerAt(p.x, p.y);
  };
  boardCanvas.addEventListener('pointerup', endPress);
  boardCanvas.addEventListener('pointercancel', () => { pointerDown = null; });
  boardCanvas.addEventListener('pointerleave', () => { hover = { col: -1, row: -1 }; });

  const onKey = (e) => {
    if (screen !== 'match') return;
    if (e.key === 'Escape') { if (placing) { placing = null; renderPanelNow(); } else if (overlay.classList.contains('show')) closeOverlay(); else openPause(); }
    if (e.key === ' ') { e.preventDefault(); if (overlay.classList.contains('show')) closeOverlay(); else openPause(); }
    const n = Number(e.key);
    if (n >= 1 && n <= TOWER_ORDER.length) pickType(TOWER_ORDER[n - 1]);
  };
  window.addEventListener('keydown', onKey);
  const onVis = () => { if (document.hidden && match && !match.over && screen === 'match') openPause(); };
  document.addEventListener('visibilitychange', onVis);

  // Shell back button
  ctx.onBack(() => {
    if (screen === 'match') {
      if (overlay.classList.contains('show') && !resultShown) { closeOverlay(); return true; }
      if (resultShown) { showScreen('menu'); return true; }
      if (overlay.classList.contains('show')) { closeOverlay(); return true; }
      openPause();
      return true;
    }
    if (screen === 'pick') { showScreen('menu'); return true; }
    return false;
  });

  // Shell header: none needed. Keep the top bar clean.
  ctx.setHeaderRight(null);

  // ------------------------------------------------------------ start
  const startMode = ctx.mode;
  if (MODES.includes(startMode)) {
    mode = startMode;
    showScreen('pick');
  } else {
    showScreen('menu');
  }
  rafId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    try { delete root.__towers; delete root.__match; } catch (e) { /* ignore */ }
  };
}
