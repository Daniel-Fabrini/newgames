// The interactive table screen: HUD + oval table + action bar + hand log + settings.
// Drives any "session" (cash table or tournament) hand by hand and animates every event.
//
// session contract:
//   startHand() -> { state, events, meta:[{id,name,avatar,frame}] } | null
//   legal() -> legalActions(state) | null        actor() -> {kind:'human'|'ai', idx} | null
//   act(action) -> events[]                        aiAct() -> { action, events }
//   hud() -> [{label,value,gold?}]                 strip() -> string|null (message line)
//   heroOut() -> bool                              roundText(ev) -> string|null
//   bb() -> current big blind

import { h } from './dom.js';
import { createTable, fmt } from './table.js';
import { createActionBar } from './actionbar.js';
import { createDisplay } from './display.js';
import { cardStr, evaluate, describe, bestFive, parseCard } from '../engine/eval.js';
import { cardLabel } from './cards.js';
import { ICON } from './icons.js';

export function createTableScreen(root, deps) {
  const { ctx, t, lang, prefs } = deps;
  const sound = new Proxy(deps.sound, { get: (o, k) => (typeof o[k] === 'function' ? (...a) => (instant ? undefined : o[k](...a)) : o[k]) });
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMq.matches;
  let disposed = false;
  let speed = 1;
  let skipHand = false; // fast-forward the rest of this hand
  let instant = false; // replaying a resumed hand: no waits, no sounds
  const timers = new Set();
  const wait = (ms) =>
    new Promise((res) => {
      if (disposed || instant) return res();
      const k = prefs.get('__turbo') ? 0.02 : skipHand ? 0.12 : prefs.get('fast') ? 0.45 : 1;
      const id = setTimeout(() => {
        timers.delete(id);
        res();
      }, ms * k * speed);
      timers.add(id);
    });

  const screen = h('div', { class: 'pk-screen pk-tscreen' });
  root.append(screen);
  const hud = h('div', { class: 'pk-hud' });
  const strip = h('div', { class: 'pk-strip', hidden: true });
  const tableHost = h('div', { class: 'pk-table-host' });
  const live = h('div', { class: 'pk-sr', 'aria-live': 'polite', role: 'log' });
  screen.append(hud, strip, tableHost, live);
  const table = createTable(tableHost, { t, lang, reduce });
  const bar = createActionBar(screen, { t, prefs, onSound: (type) => sound.byAction(type) });

  // ---- HUD ----
  const btnLog = h('button', { class: 'pk-hud-btn', type: 'button', 'aria-label': t('log'), onclick: () => toggleLog() }, ICON.log);
  const btnSet = h('button', { class: 'pk-hud-btn', type: 'button', 'aria-label': t('settings'), onclick: () => openSettings() }, ICON.gear);
  let hudCells = [];
  function renderHud(cells) {
    hud.textContent = '';
    for (const c of cells) hud.append(h('div', { class: 'pk-hud-cell' + (c.gold ? ' gold' : '') }, h('small', {}, c.label), h('b', {}, String(c.value))));
    hud.append(btnLog, btnSet);
  }
  function setStrip(text) {
    strip.hidden = !text;
    strip.textContent = text || '';
  }

  // ---- hand log ----
  const logs = []; // [{title, lines:[]}]
  let curLog = null;
  const logPanel = h('div', { class: 'pk-log', hidden: true, role: 'dialog', 'aria-label': t('log') });
  screen.append(logPanel);
  function toggleLog(force) {
    const show = force != null ? force : logPanel.hidden;
    logPanel.hidden = !show;
    btnLog.classList.toggle('on', show);
    if (show) paintLog();
  }
  function paintLog() {
    logPanel.textContent = '';
    logPanel.append(
      h('div', { class: 'pk-log-h' }, h('b', {}, t('log')), h('button', { type: 'button', class: 'pk-x', 'aria-label': t('close'), onclick: () => toggleLog(false) }, ICON.x)),
    );
    const body = h('div', { class: 'pk-log-b' });
    for (const g of logs.slice(-3).reverse()) {
      body.append(h('div', { class: 'pk-log-t' }, g.title));
      for (const l of g.lines) body.append(h('div', { class: 'pk-log-l ' + (l.cls || '') }, l.text));
    }
    logPanel.append(body);
  }
  function logLine(text, cls = '') {
    if (!curLog) return;
    curLog.lines.push({ text, cls });
    if (!logPanel.hidden) paintLog();
  }
  function announce(text) {
    live.textContent = text;
  }

  // ---- settings ----
  function openSettings() {
    const body = h('div', { class: 'pk-set' });
    const toggle = (key, label, def = true) => {
      const on = prefs.get(key) !== undefined ? prefs.get(key) !== false : def;
      const b = h('button', { type: 'button', class: 'pk-sw' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on) }, h('span', { class: 'pk-sw-l' }, label), h('i', {}));
      b.onclick = () => {
        const nv = !(b.getAttribute('aria-checked') === 'true');
        prefs.set(key, nv);
        b.setAttribute('aria-checked', String(nv));
        b.classList.toggle('on', nv);
      };
      return b;
    };
    body.append(
      toggle('sound', t('set.sound')),
      toggle('vibrate', t('set.vibrate')),
      toggle('showHandName', t('set.handName'), false),
      toggle('confirmAllIn', t('set.confirmAllin')),
      toggle('confirmFold', t('set.confirmFold')),
      toggle('fast', t('set.fast'), false),
    );
    const tm = h('div', { class: 'pk-sw-row' }, h('span', { class: 'pk-sw-l' }, t('set.timer')));
    const chips = h('div', { class: 'pk-seg' });
    for (const v of [0, 15, 30, 60]) {
      const b = h('button', { type: 'button', class: 'pk-seg-b' + ((prefs.get('timer') || 0) === v ? ' on' : '') }, v ? v + 's' : t('off'));
      b.onclick = () => {
        prefs.set('timer', v);
        chips.querySelectorAll('.pk-seg-b').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      };
      chips.append(b);
    }
    tm.append(chips);
    body.append(tm);
    ctx.ui.modal({ title: t('settings'), body, actions: [{ label: t('close'), value: 1, primary: true }] });
  }

  // ---- coachmarks (tutorial / first events) ----
  let coach = null;
  let coachQ = [];
  let coachEl = null;
  let coachTid = 0;
  function pumpCoach() {
    if (coachEl || !coachQ.length || disposed) return;
    const step = coachQ.shift();
    coachEl = h('div', { class: 'pk-coach', role: 'status' }, h('div', { class: 'pk-grow' }, h('b', {}, t('coach.tip')), step.text), h('button', { type: 'button', onclick: () => dismissCoach() }, t('coach.ok')));
    tableHost.append(coachEl);
    coachTid = setTimeout(() => dismissCoach(), 11000);
    timers.add(coachTid);
  }
  function dismissCoach() {
    clearTimeout(coachTid);
    if (coachEl) coachEl.remove();
    coachEl = null;
    setTimeout(pumpCoach, 450);
  }
  function coachTrigger(trigger) {
    if (!coach) return;
    const s = coach.take(trigger);
    if (!s) return;
    coachQ.push(s);
    pumpCoach();
  }

  // ---- play ----
  let heroIdxCur = -1;
  let disp = null;
  let currentSession = null;

  function heroHandLabel() {
    if (!disp || disp.D.heroIdx < 0 || !prefs.get('showHandName')) return null;
    const s = disp.D.seats[disp.D.heroIdx];
    if (!s.hole || s.folded || disp.D.board.length < 3) return null;
    const cards = s.hole.concat(disp.D.board).map(parseCard);
    return t('hand.' + describe(evaluate(cards)).key);
  }

  function render() {
    const snap = disp.snapshot();
    snap.heroHand = heroHandLabel();
    table.render(snap);
    return snap;
  }

  function nameOf(i) {
    return disp.D.seats[i].meta.name;
  }

  async function step(ev, ctxInfo) {
    const pre = disp.snapshot();
    const d = disp.apply(ev);
    switch (d.kind) {
      case 'deal':
        render();
        sound.deal();
        coachTrigger('first_hand');
        coachTrigger('first_blinds');
        await wait(520);
        break;
      case 'ante':
        render();
        break;
      case 'post':
        render();
        sound.chip(1);
        logLine(t('log.post', { name: nameOf(d.p), what: t('act.' + d.post), amount: fmt(d.amount, true) }));
        await wait(140);
        break;
      case 'action': {
        const who = nameOf(d.p);
        const s = disp.D.seats[d.p];
        render();
        sound.byAction(d.allIn ? 'allin' : d.type);
        const txt =
          d.type === 'fold' ? t('log.fold', { name: who }) : d.type === 'check' ? t('log.check', { name: who }) : d.type === 'call' ? t('log.call', { name: who, amount: fmt(d.amount, true) }) : d.type === 'bet' ? t('log.bet', { name: who, amount: fmt(d.to, true) }) : t('log.raise', { name: who, amount: fmt(d.to, true) });
        logLine(txt + (d.allIn ? ' · ' + t('act.allin') : ''), d.allIn ? 'allin' : '');
        announce(txt + (d.allIn ? ', ' + t('act.allin') : ''));
        if (d.p === disp.D.heroIdx && d.type === 'fold') ctxInfo.heroFolded = true;
        if (d.allIn && s.stack === 0 && !reduce()) table.banner(t('act.allin'), 'allin');
        if (d.allIn) coachTrigger('first_allin');
        await wait(d.p === disp.D.heroIdx ? 220 : d.type === 'fold' ? 260 : 420);
        break;
      }
      case 'street': {
        table.sweepBets(pre);
        sound.chip(2);
        await wait(reduce() ? 0 : 380);
        render();
        sound.flip();
        if (d.street === 'flop') coachTrigger('first_flop');
        const names = { flop: t('street.flop'), turn: t('street.turn'), river: t('street.river') };
        logLine(`${names[d.street]}: ${d.cards.map(cardText).join(' ')}`, 'street');
        announce(`${names[d.street]}: ${d.cards.map((c) => cardLabel(c, lang)).join(', ')}`);
        await wait(d.street === 'flop' ? 650 : 480);
        break;
      }
      case 'uncalled':
        table.ghostChips(table.betCenter ? table.betCenter(d.p) : table.seatCenter(d.p), table.seatCenter(d.p), d.amount, { dur: 380 });
        render();
        logLine(t('log.uncalled', { name: nameOf(d.p), amount: fmt(d.amount, true) }));
        break;
      case 'showdown': {
        table.sweepBets(pre);
        await wait(reduce() ? 0 : 320);
        // human readable hand names for revealed players
        for (const r of d.reveals) {
          if (r.hole && r.hand) disp.D.seats[r.p].handName = t('hand.' + r.hand);
        }
        render();
        sound.flip();
        coachTrigger('first_showdown');
        for (const r of d.reveals) {
          if (r.mucked) logLine(t('log.mucks', { name: nameOf(r.p) }));
          else logLine(t('log.shows', { name: nameOf(r.p), cards: r.hole.map(cardStr).map(cardText).join(' '), hand: t('hand.' + r.hand) }), 'show');
        }
        await wait(1100);
        break;
      }
      case 'award': {
        // highlight the winning five on the board
        if (!d.uncontested) {
          const w = d.winners[0];
          const s = disp.D.seats[w.p];
          if (s.hole && disp.D.board.length >= 5) {
                    const five = bestFive(s.hole.concat(disp.D.board).map(parseCard)).map(cardStr);
            disp.D.winCards = five;
          }
        }
        render();
        for (const w of d.winners) {
          table.awardTo(w.p, w.amount);
          logLine(t('log.wins', { name: nameOf(w.p), amount: fmt(w.amount, true), hand: d.hand ? t('hand.' + d.hand) : '' }).replace(/ \(\)$/, ''), 'win');
        }
        const heroWin = d.winners.find((w) => w.p === disp.D.heroIdx);
        const first = d.winners[0];
        announce(t('log.wins', { name: nameOf(first.p), amount: fmt(first.amount, true), hand: d.hand ? t('hand.' + d.hand) : '' }));
        if (heroWin) sound.win();
        else sound.chip(2);
        ctxInfo.heroWon = ctxInfo.heroWon || !!heroWin;
        ctxInfo.potWon = (ctxInfo.potWon || 0) + (heroWin ? heroWin.amount : 0);
        await wait(d.uncontested ? 900 : 1500);
        break;
      }
      case 'end':
        render();
        break;
      default:
        break;
    }
  }
  const cardText = (c) => {
    const r = c[0] === 'T' ? '10' : c[0];
    return r + { s: '♠', h: '♥', d: '♦', c: '♣' }[c[1]];
  };

  async function playHand(session, r, opts = {}) {
    const info = { heroFolded: false, heroWon: false };
    const meta = r.meta;
    const heroIdx = meta.findIndex((m) => m && m.hero);
    heroIdxCur = heroIdx;
    skipHand = false;
    const startEv = r.events.find((e) => e.t === 'hand_start');
    const holes = heroIdx >= 0 ? r.state.players[heroIdx].hole.slice() : null;
    disp = createDisplay(startEv, { seatMeta: meta, heroIdx, holes });
    curLog = { title: t('log.hand', { n: startEv.handNo }), lines: [] };
    logs.push(curLog);
    if (logs.length > 6) logs.shift();
    renderHud(session.hud());
    setStrip(session.strip ? session.strip() : null);
    bar.wait('');
    // pre-deal render (empty table with blinds markers)
    disp.D.dealt = false;
    render();
    await wait(120);
    instant = !!r.replay;
    for (const ev of r.events) {
      if (ev.t === 'hand_start') continue;
      await step(ev, info);
      if (disposed) return null;
    }
    instant = false;
    // betting loop
    while (r.state.phase === 'betting') {
      if (disposed) return null;
      const a = session.actor();
      if (!a) break;
      disp.D.toAct = a.idx;
      render();
      let events;
      if (a.kind === 'human') {
        sound.turn();
        if (opts.onSave) opts.onSave(session);
        const L = session.legal();
        const bb = session.bb();
        announce(t('yourTurn'));
        coachTrigger('first_turn');
        if (L.toCall > 0) coachTrigger('first_facing_bet');
        const timerSec = prefs.get('timer') || 0;
        const act = await bar.prompt({
          toCall: L.toCall,
          callAmount: L.callAmount,
          callAllIn: L.toCall > 0 && L.callAmount >= L.stack,
          canRaise: !!L.canRaise,
          facing: !L.isBet,
          minTo: L.minRaiseTo,
          maxTo: L.maxRaiseTo,
          heroBet: L.bet,
          pot: L.pot,
          bb,
          timer: timerSec,
        });
        if (!act) return null;
        const action = act.type === 'raise' || act.type === 'bet' ? { type: act.type, to: act.amount } : act.type === 'allin' ? { type: 'allin' } : { type: act.type };
        bar.wait('');
        events = session.act(action);
        if (opts.onSave) opts.onSave(session);
      } else {
        // think time
        const showSkip = info.heroFolded || heroIdx < 0;
        if (showSkip) showSkipButton();
        else bar.wait(t('waiting', { name: nameOf(a.idx) }));
        const think = 380 + Math.random() * 600;
        await wait(think);
        if (disposed) return null;
        events = session.aiAct().events;
      }
      for (const ev of events) {
        await step(ev, info);
        if (disposed) return null;
      }
    }
    skipHand = false;
    disp.D.toAct = -1;
    render();
    return info;
  }

  function showSkipButton() {
    const b = h('button', { type: 'button', class: 'pk-skip' }, ICON.ff, t('skip'));
    b.onclick = () => {
      skipHand = true;
      sound.tap();
    };
    bar.wait(t('foldedWatching'), b);
  }

  function between(session, info) {
    // next-hand pause with a button and an auto timer
    return new Promise((res) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        clearTimeout(tid);
        document.removeEventListener('keydown', key, true);
        res();
      };
      const key = (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'c') {
          e.preventDefault();
          go();
        }
      };
      const auto = prefs.get('auto') !== false;
      const b = h('button', { type: 'button', class: 'pk-next' }, h('span', {}, t('nextHand')), ICON.next);
      b.onclick = go;
      bar.wait('', b);
      const ms = (info && info.heroWon ? 2600 : 2100) * (skipHand ? 0.3 : 1) * (prefs.get('fast') ? 0.6 : 1);
      if (auto && !reduce()) b.style.setProperty('--ms', ms + 'ms'), b.classList.add('auto');
      const tid = auto ? setTimeout(go, ms) : 0;
      timers.add(tid);
      document.addEventListener('keydown', key, true);
    });
  }

  /** Runs hands until the session finishes, the hero is out or the player leaves. */
  async function run(session, opts = {}) {
    currentSession = session;
    coach = opts.coach || null;
    let outcome = 'finished';
    for (;;) {
      if (disposed) return 'quit';
      const r = session.startHand();
      if (!r) break;
      if (r.roundEvents && r.roundEvents.length && opts.onRound) opts.onRound(r.roundEvents);
      const info = await playHand(session, r, opts);
      if (disposed || !info) return 'quit';
      info.round = session.takeRoundEvents ? session.takeRoundEvents() : [];
      renderHud(session.hud());
      setStrip(session.strip ? session.strip() : null);
      if (opts.onHandEnd) await opts.onHandEnd(session, info);
      for (const ev of info.round) {
        if (ev.t === 'level_up') coachTrigger('first_level_up');
        else if (ev.t === 'bubble') coachTrigger('bubble');
      }
      if (opts.roundText) {
        let k = 0;
        for (const ev of info.round) {
          const txt = opts.roundText(ev);
          if (txt && k++ < 3) {
            table.banner(txt);
            await wait(900);
          }
        }
      }
      if (session.heroOut && session.heroOut()) {
        outcome = 'busted';
        await wait(900);
        break;
      }
      if (session.isFinished && session.isFinished()) break;
      if (opts.stopWhen && opts.stopWhen()) {
        outcome = 'stopped';
        break;
      }
      await between(session, info);
    }
    return outcome;
  }

  function destroy() {
    disposed = true;
    timers.forEach(clearTimeout);
    timers.clear();
    bar.destroy();
    table.destroy();
    screen.remove();
  }
  return { run, destroy, table, bar, setStrip, banner: (x) => table.banner(x), get hero() { return heroIdxCur; } };
}
