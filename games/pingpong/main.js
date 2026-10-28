// Table Tennis (Ping-Pong 3D) — shell entry. Modes: 'tour' | 'quick' | 'training'.
// Menus, shop and rewards live here; the match and drills run in game.js.
import STRINGS from './strings.js';
import { screens } from './screens.js';
import { createGame } from './game.js';
import { ARENAS } from './render.js';
import { STYLES } from './logic.js';
import { defaultProfile, eqFrom, skinFrom, find, tourInfo, tourOpponent } from './data.js';

const OPP_KEYS = ['opponentName0', 'opponentName1', 'opponentName2', 'opponentName3', 'opponentName4', 'opponentName5', 'opponentName6', 'opponentName7', 'opponentName8', 'opponentName9'];
const DRILLS = {
  serve: { mode: 'serve', firstServer: 0, tier: 0, style: 'chopper', label: 'trainServe' },
  rally: { mode: 'rally', firstServer: 1, tier: 0, style: 'spin', label: 'trainRally' },
  target: { mode: 'target', firstServer: 1, tier: 0, style: 'chopper', label: 'trainTarget' },
};

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const store = ctx.store;
  const base = defaultProfile();
  let saved = null;
  try {
    saved = store.get('profile', null);
  } catch {
    saved = null;
  }
  const p = saved
    ? { ...base, ...saved, own: { ...base.own, ...(saved.own || {}) }, eq: { ...base.eq, ...(saved.eq || {}) }, drill: { ...base.drill, ...(saved.drill || {}) } }
    : base;
  const save = () => {
    try {
      store.set('profile', p);
    } catch {}
  };

  const entry = ['tour', 'quick', 'training'].includes(ctx.mode) ? ctx.mode : null;
  let current = entry || 'menu';
  let modalOpen = false;
  let alive = true;

  const game = createGame({
    root,
    ctx,
    t,
    eq: () => eqFrom(p),
    skinOf: () => skinFrom(p),
    onMatchEnd: (r) => matchEnded(r),
    onDrillEnd: (kind, best) => drillEnded(kind, best),
    restartDrill: (meta) => startDrill(meta.drill),
    exit: () => go(current === 'training' ? 'training' : 'menu'),
  });

  const scr = screens({
    ctx,
    t,
    p,
    go,
    startTour: (k) => startTour(k),
    startQuick: (o) => startQuick(o),
    startDrill: (d) => startDrill(d),
    equip: (cat, id) => {
      p.eq[cat] = id;
      save();
      ctx.sfx.play('select');
      render();
    },
    buy: (cat, id) => {
      const it = find(cat, id);
      if (p.coins < it.cost) {
        ctx.sfx.play('error');
        ctx.ui.toast(t('coins') + ' ◎' + it.cost);
        return;
      }
      p.coins -= it.cost;
      p.own[cat] = [...new Set([...p.own[cat], id])];
      p.eq[cat] = id;
      save();
      ctx.sfx.play('coin');
      render();
    },
  });

  // ---------- views ----------
  function render() {
    if (!alive) return;
    let el;
    if (current === 'tour') el = scr.tour();
    else if (current === 'quick') el = scr.quick();
    else if (current === 'training') el = scr.training();
    else if (current === 'shop') el = scr.shop();
    else el = scr.menu();
    ctx.ui.clear(root);
    root.append(el);
  }

  function go(name) {
    if (game.isRunning()) game.stop();
    ctx.setHeaderRight(null);
    current = name;
    render();
  }

  // ---------- launches ----------
  function launch(cfg, meta) {
    if (game.isRunning()) game.stop();
    ctx.ui.clear(root);
    const pause = ctx.ui.h('button', { class: 'pp-pause', 'aria-label': t('pause'), onclick: openPause }, '❚❚');
    ctx.setHeaderRight(pause);
    game.start({ bestOf: 3, ...cfg, eq: eqFrom(p) }, meta);
  }

  function startTour(k) {
    const info = tourInfo(p.fans);
    if (k >= info.unlocked) return;
    const opp = tourOpponent(p.fans, k);
    current = 'tour';
    launch(
      { mode: 'match', tier: opp.tier, style: opp.style, bestOf: 3, firstServer: Math.random() < 0.5 ? 0 : 1 },
      { type: 'match', kind: 'tour', arena: k, opp: t(OPP_KEYS[opp.nameIdx]), sub: t(ARENAS[k].key), tier: opp.tier },
    );
  }

  function startQuick(o) {
    const arena = Math.floor(Math.random() * 10);
    const style = STYLES[Math.floor(Math.random() * STYLES.length)];
    current = 'quick';
    launch(
      { mode: 'match', tier: o.tier, style, bestOf: o.bestOf, firstServer: Math.random() < 0.5 ? 0 : 1 },
      { type: 'match', kind: 'quick', arena, opp: t('ai'), sub: t('quick'), tier: o.tier, level: o.level },
    );
  }

  function startDrill(kind) {
    const d = DRILLS[kind];
    if (!d) return;
    current = 'training';
    launch(
      { mode: d.mode, firstServer: d.firstServer, tier: d.tier, style: d.style, bestOf: 3 },
      { type: 'training', drill: kind, label: d.label, arena: kind === 'serve' ? 3 : kind === 'rally' ? 6 : 1 },
    );
  }

  // ---------- results ----------
  function matchEnded(r) {
    if (!alive) return;
    const won = r.won;
    const meta = r.meta;
    const tier = meta.tier || 1;
    let fans = 0;
    let coins = 0;
    if (meta.kind === 'tour') {
      fans = won ? 6 + Math.floor(tier / 2) : 1;
      coins = won ? 15 + tier : 4;
    } else {
      coins = won ? 10 + tier : 3;
    }
    p.fans += fans;
    p.coins += coins;
    if (won) p.wins++;
    else p.losses++;
    p.bestRally = Math.max(p.bestRally, r.rallyBest || 0);
    save();
    try {
      ctx.addXP?.(won ? 25 : 8);
    } catch {}
    const score = r.sets.join(' – ');
    const body = [
      t('pointsScore', { a: r.sets[0], b: r.sets[1] }),
      t('rallyLen', { n: r.rallyBest }),
      fans ? t('fansGained', { n: fans }) : null,
      t('coinsGained', { n: coins }),
    ]
      .filter(Boolean)
      .join(' · ');
    modalOpen = true;
    ctx.ui
      .modal({
        title: won ? t('wonMatch') : t('lostMatch'),
        body: `${score}\n${body}`,
        actions: [
          { label: t('playAgain'), value: 'again', primary: true },
          { label: t('menu'), value: 'menu' },
        ],
        dismissible: false,
      })
      .then((v) => {
        modalOpen = false;
        if (!alive) return;
        if (v === 'again') {
          if (meta.kind === 'tour') startTour(meta.arena);
          else startQuick({ tier: meta.tier, bestOf: 3, level: meta.level ?? 1 });
        } else go(meta.kind === 'tour' ? 'tour' : meta.kind === 'quick' ? 'quick' : 'menu');
      });
  }

  function drillEnded(kind, best) {
    if (best > (p.drill[kind] || 0)) p.drill[kind] = best;
    save();
    const coins = Math.max(0, Math.round(best * (kind === 'target' ? 2 : 3)));
    p.coins += coins;
    save();
    return t('coinsGained', { n: coins });
  }

  // ---------- pause ----------
  function openPause() {
    if (modalOpen || !game.isRunning()) return;
    modalOpen = true;
    game.pause(true);
    ctx.ui
      .modal({
        title: t('pause'),
        actions: [
          { label: t('resume'), value: 'resume', primary: true },
          { label: t('quit'), value: 'quit', danger: true },
        ],
        dismissible: true,
      })
      .then((v) => {
        modalOpen = false;
        if (!alive) return;
        if (v === 'quit') {
          ctx.ui
            .modal({
              title: t('leaveTitle'),
              body: t('leaveText'),
              actions: [
                { label: t('keepPlaying'), value: false, primary: true },
                { label: t('leave'), value: true, danger: true },
              ],
              dismissible: true,
            })
            .then((ok) => {
              if (!alive) return;
              if (ok) go(current === 'tour' || current === 'quick' || current === 'training' ? current : 'menu');
              else game.pause(false);
            });
          return;
        }
        game.pause(false);
      });
  }

  // ---------- back ----------
  ctx.onBack(() => {
    if (modalOpen) return true;
    if (game.isRunning()) {
      openPause();
      return true;
    }
    if (current !== 'menu' && current !== entry) {
      go(current === 'shop' ? 'menu' : 'menu');
      return true;
    }
    return false;
  });

  render();

  return () => {
    alive = false;
    game.stop();
    ctx.setHeaderRight(null);
  };
}

