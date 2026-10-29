// Pebolim / Foosball — rod football. Menus, input, HUD, tournament flow; the physics live in physics.js,
// the AI in ai.js, the bracket in tournament.js and the drawing in render.js.
import STRINGS from './strings.js';
import { T, createMatch, stepMatch, setRodTarget, chargeRod, kickRod, possession, timeLeft, clamp } from './physics.js';
import { createAI, DIFFS } from './ai.js';
import * as TR from './tournament.js';
import { createRenderer } from './render.js';

const ICON = {
  sndOn: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9.5v5h4l5 4v-13l-5 4H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sndOff: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9.5v5h4l5 4v-13l-5 4H3z"/><path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trophy: '<svg viewBox="0 0 120 130" width="150" height="162"><defs><linearGradient id="fbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".5" stop-color="#f7d774"/><stop offset="1" stop-color="#b8860b"/></linearGradient></defs><path d="M34 12h52v34c0 18-11 30-26 30S34 64 34 46z" fill="url(#fbg)"/><path d="M34 22H14c0 22 8 34 24 38M86 22h20c0 22-8 34-24 38" fill="none" stroke="url(#fbg)" stroke-width="7" stroke-linecap="round"/><rect x="54" y="74" width="12" height="20" fill="url(#fbg)"/><path d="M36 94h48l6 14H30z" fill="url(#fbg)"/><rect x="26" y="108" width="68" height="14" rx="4" fill="#7a5a14"/><path d="M60 22l5 10 11 1.6-8 7.7 2 11-10-5.4L50 52.3l2-11-8-7.7 11-1.6z" fill="#fff8d6" opacity=".9"/></svg>',
};

const DEF = () => ({
  set: {
    quick: { diff: 'normal' },
    duo: { kind: 'goals', goals: 5, minutes: 3 },
    custom: { diff: 'normal', kind: 'goals', goals: 5, minutes: 3, players: 1 },
    tour: { diff: 'normal' },
  },
  rec: { played: 0, wins: 0, losses: 0, draws: 0, goals: 0, conceded: 0, streak: 0, bestStreak: 0, titles: 0, tours: 0, shots: 0, saves: 0 },
  tour: null,
});

const RED = '#e4372f';
const KIND_KEYS = { gk: 'rodGk', def: 'rodDef', mid: 'rodMid', att: 'rodAtt' };
const KEYMAPS = [
  { l: 'KeyA', r: 'KeyD', up: 'KeyW', dn: 'KeyS', kick: 'Space' },
  { l: 'ArrowLeft', r: 'ArrowRight', up: 'ArrowUp', dn: 'ArrowDown', kick: 'Enter' },
];
const fmt = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const { h, clear } = ctx.ui;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };

  // ------------------------------------------------------------------ save
  const S = (() => {
    const d = DEF();
    const s = safe(() => ctx.store.get('save', null), null);
    if (!s || typeof s !== 'object') return d;
    const out = { ...d, ...s };
    out.set = { ...d.set };
    for (const k of Object.keys(d.set)) out.set[k] = { ...d.set[k], ...((s.set || {})[k] || {}) };
    out.rec = { ...d.rec, ...(s.rec || {}) };
    if (out.tour && !Array.isArray(out.tour.rounds)) out.tour = null;
    return out;
  })();
  const save = () => safe(() => ctx.store.set('save', S));

  // ------------------------------------------------------------------ audio
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const snd = {
    play: (n) => active() && ctx.sfx.play(n),
    tone: (o) => active() && ctx.sfx.tone(o),
    noise: (o) => active() && ctx.sfx.noise(o),
    vib: (p) => active() && ctx.sfx.vibrate(p),
  };
  const sndBtn = h('button', { class: 'g-fb-snd', type: 'button', onclick: () => {
    ctx.sfx.muted = !ctx.sfx.muted;
    refreshSnd();
    if (!ctx.sfx.muted) snd.play('select');
  } });
  function refreshSnd() {
    const on = !ctx.sfx.muted;
    sndBtn.innerHTML = on ? ICON.sndOn : ICON.sndOff;
    sndBtn.setAttribute('aria-label', on ? t('soundOn') : t('soundOff'));
    sndBtn.setAttribute('aria-pressed', String(on));
  }
  refreshSnd();
  ctx.setHeaderRight(sndBtn);

  // ------------------------------------------------------------------ shell
  let alive = true;
  let view = 'menu';
  let match = null; // running match controller
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const app = h('div', { class: 'g-fb-app' });
  root.append(app);
  const screen = (node) => { stopMatch(); clear(app); app.append(node); };
  const diffKey = (d) => d;
  const skillOf = (d) => DIFFS[d] ?? 0.5;

  ctx.onBack(() => {
    if (view === 'match') {
      if (!match) return true;
      if (match.paused) { showMenu(); return true; }
      match.pause();
      return true;
    }
    if (view !== 'menu') { showMenu(); return true; }
    return false;
  });

  // ------------------------------------------------------------------ small UI helpers
  const chip = (label, on, fn) => h('button', { class: 'chip' + (on ? ' active' : ''), type: 'button', 'aria-pressed': String(!!on), onclick: fn }, label);
  const row = (label, chips) => h('div', { class: 'g-fb-row' }, h('div', { class: 'g-fb-lab' }, label), h('div', { class: 'chips' }, ...chips));
  const stat = (label, val) => h('div', { class: 'g-fb-st' }, h('b', {}, String(val)), h('small', {}, label));
  const teamName = (id) => (id === TR.YOU.id ? t('you') : ctx.pick(TR.teamOf(id).name));

  function helpCard() {
    return h('div', { class: 'card g-fb-help' },
      h('div', { class: 'section-title' }, t('howTo')),
      h('div', { class: 'g-fb-help-cols' },
        h('div', {}, h('b', {}, '👆 ' + t('touch')), h('ul', {}, ...['h1', 'h2', 'h3'].map((k) => h('li', {}, t(k))))),
        h('div', {}, h('b', {}, '⌨️ ' + t('keyboard')), h('ul', {}, h('li', {}, t('hk1')), h('li', {}, t('hk2')), h('li', {}, t('hk3'))))));
  }

  // ------------------------------------------------------------------ main menu
  function showMenu() {
    view = 'menu';
    ctx.setTitle();
    const r = S.rec;
    const item = (icon, title, sub, fn) => h('button', { class: 'list-item', type: 'button', onclick: () => { snd.play('select'); fn(); } },
      h('span', { class: 'li-icon' }, icon), h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, title), h('div', { class: 'li-sub' }, sub)), h('span', { class: 'li-right' }, '›'));
    const node = h('div', { class: 'screen g-fb-menu' },
      h('div', { class: 'g-fb-hero' }, h('div', { class: 'g-fb-hero-ball' }), h('div', {}, h('div', { class: 'title-l' }, t('menuTitle')), h('div', { class: 'muted small' }, t('menuSub')))),
      h('div', { class: 'list' },
        item('⚽', t('mQuick'), t('mQuickSub'), () => showSetup('quick')),
        item('👥', t('mDuo'), t('mDuoSub'), () => showSetup('duo')),
        item('🏆', t('mTour'), S.tour && !S.tour.champion && !S.tour.eliminated ? t('mTourResume') : t('mTourSub'), () => showTour()),
        item('🛠️', t('mCustom'), t('mCustomSub'), () => showSetup('custom'))),
      h('div', { class: 'g-fb-recs card' },
        stat(t('rWins'), r.wins), stat(t('rGoals'), r.goals), stat(t('rStreak'), r.bestStreak), stat(t('rTitles'), r.titles)),
      helpCard());
    screen(node);
  }

  // ------------------------------------------------------------------ setup
  function showSetup(mode) {
    view = 'setup';
    ctx.setTitle();
    const cfg = S.set[mode];
    const body = h('div', { class: 'stack' });
    const draw = () => {
      clear(body);
      if (mode === 'quick') {
        body.append(h('div', { class: 'muted' }, t('quickRule')));
        body.append(row(t('difficulty'), ['easy', 'normal', 'hard'].map((d) => chip(t('d_' + d), cfg.diff === d, () => { cfg.diff = d; save(); draw(); }))));
      } else if (mode === 'duo' || mode === 'custom') {
        if (mode === 'custom') {
          body.append(row(t('players'), [1, 2].map((n) => chip(t('players' + n), cfg.players === n, () => { cfg.players = n; save(); draw(); }))));
          if (cfg.players === 1) body.append(row(t('difficulty'), ['easy', 'normal', 'hard'].map((d) => chip(t('d_' + d), cfg.diff === d, () => { cfg.diff = d; save(); draw(); }))));
        } else body.append(h('div', { class: 'muted' }, t('duoRule')));
        body.append(row(t('matchType'), ['goals', 'time'].map((k) => chip(t('k_' + k), cfg.kind === k, () => { cfg.kind = k; save(); draw(); }))));
        if (cfg.kind === 'goals') body.append(row(t('firstTo'), [3, 5, 7].map((n) => chip(String(n), cfg.goals === n, () => { cfg.goals = n; save(); draw(); }))));
        else body.append(row(t('minutes'), [1, 3, 5].map((n) => chip(`${n} min`, cfg.minutes === n, () => { cfg.minutes = n; save(); draw(); }))));
      }
    };
    draw();
    const title = { quick: t('mQuick'), duo: t('mDuo'), custom: t('mCustom') }[mode];
    const node = h('div', { class: 'screen g-fb-setup' },
      h('div', { class: 'title-l' }, title),
      h('div', { class: 'card' }, body),
      h('button', { class: 'btn primary big block', type: 'button', onclick: () => startFromSetup(mode) }, t('start')),
      h('button', { class: 'btn ghost block', type: 'button', onclick: showMenu }, t('back')),
      helpCard());
    screen(node);
  }

  function limitsOf(c) {
    return c.kind === 'goals' ? { limitGoals: c.goals, limitTime: 0 } : { limitGoals: 0, limitTime: c.minutes * 60 };
  }
  function startFromSetup(mode) {
    const c = S.set[mode];
    if (mode === 'quick') startMatch({ kind: 'quick', players: 1, skill: skillOf(c.diff), diff: c.diff, limitGoals: 5, limitTime: 180, sudden: false });
    else if (mode === 'duo') startMatch({ kind: 'duo', players: 2, skill: 0.5, ...limitsOf(c), sudden: false });
    else startMatch({ kind: 'custom', players: c.players, skill: skillOf(c.diff), diff: c.diff, ...limitsOf(c), sudden: false });
  }

  // ------------------------------------------------------------------ tournament
  function newTournament(diff) {
    S.tour = TR.createTournament((Date.now() % 100000) + 1, skillOf(diff));
    S.tour.diffName = diff;
    save();
  }
  function showTour() {
    view = 'tour';
    ctx.setTitle();
    const tr = S.tour;
    if (!tr) return showTourSetup();
    if (tr.champion === TR.YOU.id) return showTrophy();
    const names = ['rQF', 'rSF', 'rFinal'];
    const sections = tr.rounds.map((ms, ri) => h('div', { class: 'g-fb-tr-sec' + (ri === tr.round && !tr.eliminated && !tr.champion ? ' cur' : '') },
      h('div', { class: 'section-title' }, t(names[ri])),
      h('div', { class: 'g-fb-tr-grid r' + ri }, ...ms.map((m) => {
        const tm = (id, g) => {
          const info = id ? TR.teamOf(id) : null;
          return h('div', { class: 'g-fb-tm' + (id === TR.YOU.id ? ' you' : '') + (m.winner && m.winner === id ? ' win' : '') + (m.winner && m.winner !== id ? ' lose' : '') },
            h('i', { style: info ? `background:${info.color}` : 'background:#444' }), h('span', {}, id ? teamName(id) : t('tbd')), h('b', {}, g == null ? '' : String(g)));
        };
        return h('div', { class: 'g-fb-match-card' }, tm(m.a, m.ga), tm(m.b, m.gb));
      }))));
    const opp = TR.opponentOf(tr);
    const info = tr.eliminated
      ? h('div', { class: 'card g-fb-tr-info bad' }, h('b', {}, t('eliminated')), h('div', { class: 'muted small' }, tr.champion ? t('champIs', { n: teamName(tr.champion) }) : ''))
      : h('div', { class: 'card g-fb-tr-info' }, h('b', {}, t('nextMatch', { r: t(names[tr.round]) })), h('div', { class: 'muted small' }, t('vs', { n: opp ? teamName(opp) : '' })));
    const node = h('div', { class: 'screen g-fb-tour' },
      h('div', { class: 'title-l' }, t('mTour')),
      info,
      ...sections,
      h('div', { class: 'spacer' }),
      tr.eliminated
        ? h('button', { class: 'btn primary big block', type: 'button', onclick: () => { S.tour = null; save(); showTourSetup(); } }, t('newTour'))
        : h('button', { class: 'btn primary big block', type: 'button', onclick: () => startTourMatch() }, t('playMatch')),
      !tr.eliminated ? h('button', { class: 'btn ghost block', type: 'button', onclick: async () => { if (await ctx.ui.modal({ title: t('newTour'), body: t('newTourAsk'), actions: [{ label: t('cancel'), value: false }, { label: t('newTour'), value: true, danger: true }] })) { S.tour = null; save(); showTourSetup(); } } }, t('newTour')) : null,
      h('button', { class: 'btn ghost block', type: 'button', onclick: showMenu }, t('back')));
    screen(node);
  }
  function showTourSetup() {
    view = 'tour';
    const cfg = S.set.tour;
    const body = h('div', { class: 'stack' });
    const draw = () => {
      clear(body);
      body.append(h('div', { class: 'muted' }, t('tourRule')));
      body.append(row(t('difficulty'), ['easy', 'normal', 'hard'].map((d) => chip(t('d_' + d), cfg.diff === d, () => { cfg.diff = d; save(); draw(); }))));
    };
    draw();
    screen(h('div', { class: 'screen g-fb-setup' },
      h('div', { class: 'title-l' }, t('mTour')),
      h('div', { class: 'card' }, body),
      h('button', { class: 'btn primary big block', type: 'button', onclick: () => { newTournament(cfg.diff); showTour(); } }, t('start')),
      h('button', { class: 'btn ghost block', type: 'button', onclick: showMenu }, t('back')),
      helpCard()));
  }
  function startTourMatch() {
    const tr = S.tour;
    const oppId = TR.opponentOf(tr);
    if (!oppId) return showTour();
    const opp = TR.teamOf(oppId);
    startMatch({ kind: 'tournament', players: 1, skill: TR.opponentSkill(tr, oppId), limitGoals: 5, limitTime: 180, sudden: true, oppKit: opp.color, oppName: teamName(oppId), round: tr.round });
  }
  function showTrophy() {
    view = 'tour';
    const tr = S.tour;
    const node = h('div', { class: 'screen center g-fb-trophy' },
      h('div', { class: 'g-fb-trophy-ico', html: ICON.trophy }),
      h('div', { class: 'title-xl' }, t('champions')),
      h('div', { class: 'muted' }, t('champSub')),
      h('div', { class: 'g-fb-tr-grid' }, ...tr.rounds[2].map((m) => h('div', { class: 'g-fb-match-card' },
        ...[[m.a, m.ga], [m.b, m.gb]].map(([id, g]) => h('div', { class: 'g-fb-tm' + (id === TR.YOU.id ? ' you win' : '') }, h('i', { style: `background:${TR.teamOf(id).color}` }), h('span', {}, teamName(id)), h('b', {}, String(g ?? ''))))))),
      h('button', { class: 'btn primary big block', type: 'button', onclick: () => { S.tour = null; save(); showMenu(); } }, t('continue')));
    screen(node);
    snd.play('win');
    if (!reduced) { ctx.ui.confetti(); later(() => ctx.ui.confetti(), 900); later(() => ctx.ui.confetti(), 1900); }
  }

  // ------------------------------------------------------------------ match
  function stopMatch() {
    if (match) { match.destroy(); match = null; }
  }

  function startMatch(cfg) {
    view = 'match';
    stopMatch();
    ctx.setTitle();
    const s = createMatch({ seed: (Math.random() * 1e9) | 0, limitGoals: cfg.limitGoals, limitTime: cfg.limitTime, sudden: cfg.sudden });
    const twoP = cfg.players === 2;
    const oppKit = cfg.oppKit || '#2f7be4';
    const names = [twoP ? t('p1') : t('you'), cfg.oppName || (twoP ? t('p2') : t('cpu'))];
    const ai = twoP ? null : createAI(1, cfg.skill, s.seed);

    const canvas = h('canvas', { class: 'g-fb-canvas', role: 'img', 'aria-label': t('tableLabel') });
    const stage = h('div', { class: 'g-fb-stage' }, canvas);
    const msg = h('div', { class: 'g-fb-msg', 'aria-live': 'polite' });
    stage.append(msg);
    const el = {};
    const hud = h('div', { class: 'g-fb-hud' },
      h('div', { class: 'g-fb-team t0' }, el.d0 = h('i', { style: `background:${RED}` }), h('span', {}, names[0]), el.s0 = h('b', {}, '0')),
      h('div', { class: 'g-fb-mid' }, el.clock = h('b', {}, '0:00'), el.lim = h('small', {}, '')),
      h('div', { class: 'g-fb-team t1' }, el.s1 = h('b', {}, '0'), h('span', {}, names[1]), el.d1 = h('i', { style: `background:${oppKit}` })),
      h('button', { class: 'g-fb-pausebtn', type: 'button', 'aria-label': t('pause'), html: ICON.pause, onclick: () => ctrl.pause() }));
    const poss = h('div', { class: 'g-fb-poss' }, el.p0 = h('i', { style: `background:${RED}` }), el.pbar = h('div', { class: 'g-fb-pbar' }, el.pfill = h('i', {})), el.p1 = h('i', { style: `background:${oppKit}` }));
    el.pfill.style.background = RED;
    el.pbar.style.background = oppKit;

    // ---- controllers (humans)
    const humans = [];
    const mkHuman = (team, keymaps) => {
      const own = s.rods.filter((r) => r.team === team).map((r) => r.i).sort((a, b) => s.rods[a].y - s.rods[b].y);
      const p = { team, own, sel: team === 0 ? 0 : own.length - 1, auto: true, manualUntil: 0, drag: null, charge: null, keymaps, keyMoving: false, lastLabel: '', ui: {} };
      // start with the attack rod selected
      p.sel = own.findIndex((i) => s.rods[i].kind === 'att');
      return p;
    };
    humans.push(mkHuman(0, twoP ? [KEYMAPS[0]] : [KEYMAPS[0], KEYMAPS[1]]));
    if (twoP) humans.push(mkHuman(1, [KEYMAPS[1]]));
    const rodOf = (p) => s.rods[p.own[p.sel]];

    const mkPad = (p, rot) => {
      const lab = h('span', { class: 'g-fb-rodlab' }, '');
      const sel = (dir) => selectRod(p, dir);
      const upDir = rot ? 1 : -1; // arrow direction as seen on screen
      p.ui.auto = h('button', { class: 'g-fb-auto on', type: 'button', 'aria-pressed': 'true', onclick: () => { p.auto = !p.auto; p.ui.auto.classList.toggle('on', p.auto); p.ui.auto.setAttribute('aria-pressed', String(p.auto)); snd.play('tap'); } }, t('auto'));
      const kick = h('button', { class: 'g-fb-kick', type: 'button', 'aria-label': t('kick') }, h('span', {}, t('kick')), h('small', {}, t('kickHold')));
      kick.addEventListener('pointerdown', (e) => { e.preventDefault(); kick.setPointerCapture?.(e.pointerId); kick.classList.add('down'); kickDown(p); });
      const up = (e) => { kick.classList.remove('down'); kickUp(p); };
      kick.addEventListener('pointerup', up);
      kick.addEventListener('pointercancel', up);
      kick.addEventListener('contextmenu', (e) => e.preventDefault());
      p.ui.label = lab;
      p.ui.kick = kick;
      return h('div', { class: 'g-fb-pad' + (rot ? ' rot' : '') },
        h('div', { class: 'g-fb-padsel' },
          h('button', { class: 'g-fb-arrow', type: 'button', 'aria-label': t('rodUp'), html: ICON.up, onclick: () => sel(upDir) }),
          lab,
          h('button', { class: 'g-fb-arrow', type: 'button', 'aria-label': t('rodDown'), html: ICON.down, onclick: () => sel(-upDir) }),
          p.ui.auto),
        kick);
    };

    const wrap = h('div', { class: 'g-fb-match' + (twoP ? ' two' : '') });
    if (twoP) wrap.append(mkPad(humans[1], true));
    wrap.append(hud, poss, stage);
    wrap.append(mkPad(humans[0], false));
    const pauseEl = h('div', { class: 'g-fb-pause', hidden: true });
    const wrapAll = h('div', { class: 'g-fb-matchwrap' }, wrap, pauseEl);
    screen(wrapAll);

    const renderer = createRenderer(canvas, { reduced });
    renderer.setKits(RED, oppKit);
    let sizeOk = false;
    const fit = () => { sizeOk = renderer.resize(); };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    window.addEventListener('resize', fit);
    requestAnimationFrame(fit);

    // ---- input
    const nowMs = () => performance.now();
    function selectRod(p, dirScreen) {
      const n = p.own.length;
      p.sel = clamp(p.sel + dirScreen, 0, n - 1);
      p.manualUntil = nowMs() + 3500;
      snd.tone({ freq: 700, dur: 0.03, type: 'triangle', vol: 0.05 });
    }
    function kickDown(p) {
      if (!p.charge && s.phase !== 'over') {
        p.charge = { t0: nowMs(), rod: p.own[p.sel] };
        chargeRod(s, p.charge.rod);
      }
    }
    function kickUp(p) {
      if (!p.charge) return;
      const hold = (nowMs() - p.charge.t0) / 1000;
      const power = hold < 0.14 ? 0.55 : 0.55 + 0.45 * clamp((hold - 0.14) / 0.4, 0, 1);
      if (!ctrl.paused && s.phase !== 'over') kickRod(s, p.charge.rod, power);
      p.charge = null;
    }
    const keys = new Set();
    const onKey = (e) => {
      if (view !== 'match' || ctrl.paused) { if (e.code === 'Escape' && view === 'match') ctrl.pause(); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { ctrl.pause(); e.preventDefault(); return; }
      let used = false;
      for (const p of humans) for (const km of p.keymaps) {
        if (e.code === km.l || e.code === km.r) { used = true; if (e.type === 'keydown') keys.add(e.code); else keys.delete(e.code); }
        if (e.code === km.up || e.code === km.dn) { used = true; if (e.type === 'keydown' && !e.repeat) selectRod(p, e.code === km.up ? -1 : 1); }
        if (e.code === km.kick) { used = true; if (e.type === 'keydown') { if (!e.repeat) kickDown(p); } else kickUp(p); }
      }
      if (used) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    const pointers = new Map();
    const zoneOf = (py) => {
      if (!twoP) return humans[0];
      const ty = renderer.toTable(0, py).y;
      return ty < T.H / 2 ? humans[1] : humans[0];
    };
    stage.addEventListener('pointerdown', (e) => {
      if (ctrl.paused || e.target !== canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const p = zoneOf(py);
      if (p.drag) return;
      canvas.setPointerCapture?.(e.pointerId);
      const r = rodOf(p);
      p.drag = { id: e.pointerId, x0: px, y0: py, t0: nowMs(), tx0: r.tx, rod: r.i, mode: '?' };
      pointers.set(e.pointerId, p);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p || !p.drag || ctrl.paused) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const d = p.drag;
      const dx = px - d.x0, dy = py - d.y0;
      if (d.mode === '?' && Math.hypot(dx, dy) > 9) d.mode = Math.abs(dx) >= Math.abs(dy) * 0.8 ? 'slide' : 'swipe';
      const r = s.rods[d.rod];
      if (d.mode === 'slide') {
        setRodTarget(s, d.rod, d.tx0 + (dx / renderer.R.sc) * 1.5);
        p.manualUntil = Math.max(p.manualUntil, nowMs() + 1200);
        // a fast vertical flick while sliding also kicks
        if (Math.abs(dy) > 46 && dy * r.s > 0 && (nowMs() - d.t0) < 380) { kickRod(s, d.rod, 0.85); d.mode = 'done'; }
      } else if (d.mode === 'swipe' && dy * r.s > 22) {
        const v = Math.hypot(dx, dy) / Math.max(40, nowMs() - d.t0);
        kickRod(s, d.rod, clamp(0.45 + v * 0.55, 0.45, 1));
        d.mode = 'done';
      }
    });
    const endPtr = (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      const d = p.drag;
      p.drag = null;
      if (!d || ctrl.paused) return;
      if (d.mode === '?' && nowMs() - d.t0 < 320 && e.type === 'pointerup') {
        // tap: on another own rod's lane selects it, elsewhere kicks the active rod
        const rect = canvas.getBoundingClientRect();
        const py = e.clientY - rect.top;
        let pick = -1, bd = 22;
        p.own.forEach((ri, k) => {
          const dd = Math.abs(renderer.toScreen(0, s.rods[ri].y).y - py);
          if (dd < bd) { bd = dd; pick = k; }
        });
        if (pick >= 0 && pick !== p.sel) { p.sel = pick; p.manualUntil = nowMs() + 2500; snd.tone({ freq: 700, dur: 0.03, type: 'triangle', vol: 0.05 }); }
        else kickRod(s, d.rod, 0.55);
      }
    };
    stage.addEventListener('pointerup', endPtr);
    stage.addEventListener('pointercancel', endPtr);
    stage.addEventListener('contextmenu', (e) => e.preventDefault());

    function updateHuman(p) {
      const now = nowMs();
      const b = s.ball;
      if (p.auto && !p.drag && !p.charge && now >= p.manualUntil) {
        let best = p.sel, bc = 1e9, cur = 1e9;
        p.own.forEach((ri, k) => {
          const r = s.rods[ri];
          const rel = (b.y - r.y) * r.s;
          const cost = rel > -3 ? Math.abs(rel - 3) : 40 - rel;
          if (k === p.sel) cur = cost;
          if (cost < bc) { bc = cost; best = k; }
        });
        if (best !== p.sel && bc < cur - 5) p.sel = best;
      }
      const r = rodOf(p);
      let dir = 0;
      for (const km of p.keymaps) { if (keys.has(km.l)) dir -= 1; if (keys.has(km.r)) dir += 1; }
      if (dir) { setRodTarget(s, r.i, r.x + dir * 30); p.keyMoving = r.i; }
      else if (p.keyMoving !== false) { setRodTarget(s, p.keyMoving, s.rods[p.keyMoving].x); p.keyMoving = false; }
      const lab = t(KIND_KEYS[r.kind]);
      if (lab !== p.lastLabel) { p.lastLabel = lab; p.ui.label.textContent = lab; }
    }

    // ---- sfx / effects from sim events
    function handle(evs) {
      for (const e of evs) {
        if (e.type === 'touch') {
          const k = clamp(e.speed / 220, 0, 1);
          snd.tone({ freq: 520 + e.speed * 2.4, to: 240, dur: 0.05, type: 'square', vol: 0.05 + 0.1 * k });
          snd.noise({ dur: 0.035, vol: 0.04 + 0.08 * k, freq: 2600, q: 1.2 });
          if (e.speed > 110) renderer.sparks(e.x, e.y, 4 + ((e.speed / 40) | 0));
          if (e.speed > 90 && humans.some((p) => p.team === e.team)) snd.vib(e.speed > 150 ? 18 : 8);
        } else if (e.type === 'wall') {
          snd.tone({ freq: 190, to: 130, dur: 0.06, type: 'triangle', vol: 0.05 + 0.06 * clamp(e.speed / 200, 0, 1) });
        } else if (e.type === 'save') {
          snd.tone({ freq: 880, to: 1320, dur: 0.1, type: 'sine', vol: 0.07 });
        } else if (e.type === 'goal') {
          goalFx(e.team);
        } else if (e.type === 'serve') {
          snd.tone({ freq: 2150, dur: 0.22, type: 'sine', vol: 0.08 });
          snd.tone({ freq: 2300, dur: 0.22, type: 'sine', vol: 0.05, delay: 0.02 });
          setMsg('', 0);
        } else if (e.type === 'count') {
          snd.tone({ freq: 660, dur: 0.1, type: 'triangle', vol: 0.07 });
        } else if (e.type === 'overtime') {
          setMsg(t('overtime'), 1800);
          snd.play('levelup');
        } else if (e.type === 'reset') {
          ctx.ui.toast(t('reserve'));
        } else if (e.type === 'over') {
          snd.tone({ freq: 2150, dur: 0.5, type: 'sine', vol: 0.09 });
          snd.tone({ freq: 2260, dur: 0.5, type: 'sine', vol: 0.06, delay: 0.03 });
        }
      }
      evs.length = 0;
    }
    function goalFx(team) {
      const mine = humans.some((p) => p.team === team);
      snd.tone({ freq: 196, to: 180, dur: 0.9, type: 'sawtooth', vol: 0.09 });
      snd.tone({ freq: 294, to: 270, dur: 0.9, type: 'sawtooth', vol: 0.06 });
      snd.noise({ dur: 1.6, vol: 0.12, freq: 900, q: 0.5 });
      snd.noise({ dur: 1.0, vol: 0.08, freq: 1800, q: 0.7, delay: 0.3 });
      snd.vib(mine ? [30, 40, 70, 40, 120] : [60]);
      renderer.burst(team, T.W / 2, team === 0 ? 6 : T.H - 6);
      renderer.goal(team);
      renderer.shake(1.2);
      if (mine && !reduced && !twoP) ctx.ui.confetti();
      setMsg(t('goal'), 2200, team === 0 ? RED : oppKit);
    }
    let msgT = 0;
    function setMsg(text, ms, color) {
      msg.textContent = text;
      msg.style.color = color || '';
      msg.classList.toggle('show', !!text);
      msg.classList.remove('pop'); void msg.offsetWidth; if (text) msg.classList.add('pop');
      msgT = ms ? performance.now() + ms : 0;
    }

    // ---- loop
    const ctrl = { paused: false };
    let raf = 0, last = performance.now(), over = false, overT = 0, lastHud = '';
    function hudUpdate() {
      el.s0.textContent = s.score[0];
      el.s1.textContent = s.score[1];
      const left = timeLeft(s);
      const clockTxt = s.overtime ? 'OT' : s.limitTime ? fmt(left) : fmt(s.clock);
      const limTxt = s.limitGoals ? t('toGoals', { n: s.limitGoals }) + (s.limitTime ? ` · ${fmt(s.limitTime)}` : '') : t('timed');
      const key = clockTxt + limTxt;
      if (key !== lastHud) { lastHud = key; el.clock.textContent = clockTxt; el.lim.textContent = limTxt; }
      el.clock.classList.toggle('low', !s.overtime && !!s.limitTime && left < 10 && s.phase === 'play');
      el.p0.classList.toggle('on', s.lastTouch === 0);
      el.p1.classList.toggle('on', s.lastTouch === 1);
      el.pfill.style.width = `${Math.round(possession(s) * 100)}%`;
      if (s.phase === 'serve' && s.clock === 0 && s.score[0] + s.score[1] === 0) {
        const n = Math.ceil(s.serveT);
        const txt = n > 0 ? String(n) : '';
        if (msg.textContent !== txt) setMsg(txt, 0, '#fff');
      }
      if (msgT && performance.now() > msgT) setMsg('', 0);
    }
    function frame(ts) {
      if (!alive || match !== ctrl) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000));
      last = ts;
      if (!ctrl.paused) {
        if (!over) {
          for (const p of humans) updateHuman(p);
          ai?.update(s, dt);
          stepMatch(s, dt);
          handle(s.events);
          if (s.phase === 'over') { over = true; overT = 0; }
        } else {
          stepMatch(s, dt);
          s.events.length = 0;
          overT += dt;
          if (overT > 1.1) { finishMatch(); return; }
        }
        hudUpdate();
      }
      if (sizeOk) {
        const hi = [];
        for (const p of humans) hi.push(p.own[p.sel]);
        renderer.draw(s, { hi }, ctrl.paused ? 0 : dt);
      }
    }

    ctrl.pause = () => {
      if (ctrl.paused || over) return;
      ctrl.paused = true;
      for (const p of humans) { p.charge = null; p.drag = null; }
      keys.clear();
      pointers.clear();
      snd.play('select');
      clear(pauseEl);
      pauseEl.append(h('div', { class: 'g-fb-pause-card' },
        h('div', { class: 'title-l' }, t('paused')),
        h('div', { class: 'g-fb-pause-score' }, `${s.score[0]} – ${s.score[1]}`),
        h('button', { class: 'btn primary big block', type: 'button', onclick: () => ctrl.resume() }, t('resume')),
        h('button', { class: 'btn block', type: 'button', onclick: () => { restart(); } }, t('restart')),
        h('button', { class: 'btn block', type: 'button', onclick: (e) => { ctx.sfx.muted = !ctx.sfx.muted; refreshSnd(); e.currentTarget.textContent = t(ctx.sfx.muted ? 'soundOff' : 'soundOn'); } }, t(ctx.sfx.muted ? 'soundOff' : 'soundOn')),
        h('button', { class: 'btn ghost block', type: 'button', onclick: () => showMenu() }, t('quit'))));
      pauseEl.hidden = false;
    };
    ctrl.resume = () => {
      ctrl.paused = false;
      pauseEl.hidden = true;
      last = performance.now();
    };
    const restart = () => startMatch(cfg);
    const onVis = () => { if (document.hidden && view === 'match') ctrl.pause(); };
    document.addEventListener('visibilitychange', onVis);
    ctrl.destroy = () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
    ctrl.cfg = cfg;
    match = ctrl;

    function finishMatch() {
      ctrl.destroy();
      match = null;
      showResults(cfg, s, names, oppKit);
    }
    hudUpdate();
    raf = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ results
  function showResults(cfg, s, names, oppKit) {
    view = 'results';
    const [a, b] = s.score;
    const twoP = cfg.players === 2;
    const win0 = s.winner === 0;
    const draw = s.winner === -1;
    const r = S.rec;
    let xp = 0, newRec = [];
    if (!twoP) {
      r.played++;
      r.goals += a;
      r.conceded += b;
      r.shots += s.stats[0].shots;
      r.saves += s.stats[0].saves;
      if (draw) { r.draws++; r.streak = 0; }
      else if (win0) { r.wins++; r.streak++; if (r.streak > r.bestStreak) { r.bestStreak = r.streak; if (r.streak > 1) newRec.push(t('recStreak', { n: r.streak })); } }
      else { r.losses++; r.streak = 0; }
      const mult = 1 + (cfg.skill || 0) * 0.6;
      xp = Math.round(((win0 ? 16 : draw ? 8 : 5) + Math.min(a, 7) * 2) * mult);
    } else {
      r.played++;
      r.goals += a + b;
      xp = 8 + Math.min(a + b, 10);
    }
    let tourNote = null;
    if (cfg.kind === 'tournament' && S.tour) {
      const tr = S.tour;
      const lostRound = tr.round;
      TR.reportPlayer(tr, a, b, win0);
      if (tr.champion === TR.YOU.id) { r.titles++; r.tours++; xp += 60; tourNote = 'champ'; }
      else if (tr.eliminated) { TR.finishAll(tr); r.tours++; tourNote = 'out'; }
      else tourNote = 'next';
      xp += lostRound * 4;
    }
    save();
    ctx.addXP?.(xp);
    snd.play(draw ? 'select' : win0 || twoP ? 'win' : 'lose');
    if ((win0 || twoP) && !draw && !reduced) ctx.ui.confetti();

    const head = twoP ? (draw ? t('draw') : t('wins', { n: win0 ? names[0] : names[1] })) : draw ? t('draw') : win0 ? t('victory') : t('defeat');
    const st = s.stats;
    const posS = Math.round(possession(s) * 100);
    const line = (label, x, y) => h('div', { class: 'g-fb-rs-row' }, h('b', {}, String(x)), h('span', {}, label), h('b', {}, String(y)));
    const reasonTxt = { time: t('rTime'), goals: t('rGoalsLim'), golden: t('rGolden'), coin: t('rGolden') }[s.reason] || '';
    const actions = [];
    if (cfg.kind === 'tournament') {
      actions.push(h('button', { class: 'btn primary big block', type: 'button', onclick: () => showTour() }, tourNote === 'champ' ? t('trophy') : t('continue')));
    } else {
      actions.push(h('button', { class: 'btn primary big block', type: 'button', onclick: () => startMatch(cfg) }, t('rematch')));
      actions.push(h('button', { class: 'btn ghost block', type: 'button', onclick: showMenu }, t('menu')));
    }
    const node = h('div', { class: 'screen center g-fb-results' },
      h('div', { class: 'g-fb-res-head ' + (draw ? 'draw' : win0 || twoP ? 'win' : 'lose') }, head),
      h('div', { class: 'g-fb-res-score' },
        h('div', {}, h('i', { style: `background:${RED}` }), h('small', {}, names[0])),
        h('b', {}, `${a} – ${b}`),
        h('div', {}, h('i', { style: `background:${oppKit}` }), h('small', {}, names[1]))),
      reasonTxt ? h('div', { class: 'muted small' }, reasonTxt) : null,
      h('div', { class: 'card g-fb-rs' },
        line(t('sGoals'), st[0].goals, st[1].goals),
        line(t('sShots'), st[0].shots, st[1].shots),
        line(t('sOnTarget'), st[0].onTarget, st[1].onTarget),
        line(t('sSaves'), st[0].saves, st[1].saves),
        line(t('sPoss'), posS + '%', 100 - posS + '%')),
      newRec.length ? h('div', { class: 'g-fb-newrec' }, '★ ' + newRec.join(' · ')) : null,
      xp ? h('div', { class: 'muted small' }, t('xpGain', { n: xp })) : null,
      tourNote === 'out' ? h('div', { class: 'g-fb-out' }, t('eliminated')) : null,
      h('div', { class: 'spacer' }),
      ...actions);
    screen(node);
  }

  // ------------------------------------------------------------------ boot
  const m = ctx.mode;
  if (m === 'quick' || m === 'duo' || m === 'custom') showSetup(m);
  else if (m === 'tournament') showTour();
  else showMenu();

  return () => {
    alive = false;
    stopMatch();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    ctx.setHeaderRight(null);
  };
}
