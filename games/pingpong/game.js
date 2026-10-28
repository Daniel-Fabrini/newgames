// Match and drill controller: owns the stage, the loop, swipe input, announcer,
// sounds and the match / drill rules that sit on top of the simulation.
import { Match, TABLE_Y } from './logic.js';
import { createRenderer, ARENAS, withAlpha } from './render.js';
import { analyzeSwipe } from './swipe.js';

const TARGET_R = 0.2;
const RALLY_GOAL = 20;
const TARGET_TIME = 60;

export function createGame(env) {
  const { root, ctx, t, skinOf } = env;
  let stage = null;
  let canvas = null;
  let fxc = null;
  let fxg = null;
  let hudTop = null;
  let hudAnn = null;
  let hudHint = null;
  let hudStreak = null;
  let renderer = null;
  let match = null;
  let meta = null;
  let raf = 0;
  let last = 0;
  let swing = { player: 0, ai: 0 };
  let stroke = null;
  let annT = 0;
  let excite = 0;
  let paused = false;
  let ended = false;
  let trainState = null;
  let cached = '';
  let hintCache = '';
  let serverAtStart = 0;
  let firstBounce = null;
  let gameEnd = false;
  let serveAnn = false;

  const look = {
    player: { shirt: '#1b4d9e', shirt2: '#f4c542', skin: '#e9b98c', shorts: '#f4f4f6', legs: '#22283f', shoe: '#eeeeee', rubber: '#d6252b', wood: '#c48a3e', hair: '#2b1c10' },
    ai: { shirt: '#f4c542', shirt2: '#c4282c', skin: '#c98e5f', shorts: '#16161c', legs: '#1a1a24', shoe: '#222', rubber: '#16161c', wood: '#8a5a2b', hair: '#0c0c0c' },
  };

  function mkStage() {
    stage = ctx.ui.h('div', { class: 'pp-stage' });
    canvas = ctx.ui.h('canvas', { class: 'pp-canvas' });
    fxc = ctx.ui.h('canvas', { class: 'pp-fx' });
    hudTop = ctx.ui.h('div', { class: 'pp-top' });
    hudStreak = ctx.ui.h('div', { class: 'pp-streak' });
    hudAnn = ctx.ui.h('div', { class: 'pp-ann' });
    hudHint = ctx.ui.h('div', { class: 'pp-hint' });
    stage.append(canvas, fxc, hudTop, hudStreak, hudAnn, hudHint);
    root.append(stage);
    fxg = fxc.getContext('2d');
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', () => (stroke = null));
  }

  function resizeFx() {
    const r = stage.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    fxc.width = Math.round(r.width * d);
    fxc.height = Math.round(r.height * d);
    fxg.setTransform(d, 0, 0, d, 0, 0);
  }

  // ---------- announcer ----------
  function say(text, kind = '') {
    if (!hudAnn) return;
    hudAnn.textContent = text;
    hudAnn.className = `pp-ann show ${kind}`;
    annT = 1.2;
  }

  function hint(text) {
    if (!hudHint) return;
    if (text === hintCache) return;
    hintCache = text;
    hudHint.textContent = text;
    hudHint.classList.toggle('show', !!text);
  }

  // ---------- sounds ----------
  function hitSound(ev) {
    const v = 0.22 + 0.25 * (ev.power || 0.5);
    const s = ctx.sfx;
    if (ev.smash) {
      s.noise({ dur: 0.12, vol: 0.4, freq: 1500, q: 1.1 });
      s.tone({ freq: 420, to: 180, dur: 0.12, type: 'triangle', vol: 0.5 });
      s.vibrate?.(18);
      return;
    }
    if (ev.kind === 'top') s.tone({ freq: 1150, to: 720, dur: 0.07, type: 'triangle', vol: v });
    else if (ev.kind === 'back') s.tone({ freq: 300, to: 210, dur: 0.11, type: 'sine', vol: v });
    else if (ev.kind === 'side') {
      s.noise({ dur: 0.05, vol: 0.18, freq: 2100 });
      s.tone({ freq: 640, dur: 0.05, type: 'triangle', vol: v * 0.9 });
    } else s.tone({ freq: 880, dur: 0.05, type: 'square', vol: v * 0.7 });
  }

  // ---------- rules hooks ----------
  function onEvents() {
    for (const ev of match.events) {
      if (ev.type === 'hit') {
        if (ev.side === 0) swing.player = 1;
        else swing.ai = 1;
        renderer.spark(ev.p[0], ev.p[1], ev.p[2], ev.power || 0.5, ev.side === 0 ? '#ffd768' : '#ffffff');
        hitSound(ev);
        if (ev.smash) {
          renderer.shakeNow(7);
          say(t('smash'), 'gold');
        }
        if (ev.side === 0 && trainState?.kind === 'rally') {
          trainState.streak++;
          updStreak();
        }
      } else if (ev.type === 'bounce') {
        renderer.spark(ev.x, TABLE_Y + 0.01, ev.z, 0.2, '#ffffff', 5);
        ctx.sfx.tone({ freq: 760, to: 520, dur: 0.035, type: 'triangle', vol: 0.12 });
        if (ev.side === 1 && !firstBounce) firstBounce = { x: ev.x, z: ev.z };
      } else if (ev.type === 'cord') {
        ctx.sfx.tone({ freq: 220, dur: 0.06, type: 'square', vol: 0.12 });
      } else if (ev.type === 'let') {
        say(t('letServe'));
      } else if (ev.type === 'serve') {
        ctx.sfx.play('pop');
      } else if (ev.type === 'point') {
        onPoint(ev);
      } else if (ev.type === 'set') {
        onSet(ev);
      } else if (ev.type === 'match') {
        onMatchOver(ev);
      }
    }
    match.events.length = 0;
  }

  const REASON = {
    net: 'netCord',
    out: 'out',
    ownBounce: 'ownBounce',
    doubleBounce: 'doubleBounce',
    serveMiss: 'serveMiss',
  };

  function onPoint(ev) {
    const youWon = ev.winner === 0;
    const reason = ev.reason;
    if (meta.type === 'training') return onDrillPoint(ev);
    if (ev.rally <= 1 && ev.winner === serverAtStart && reason === 'out') say(t('ace'), 'gold');
    else if (reason === 'net') say(t(REASON.net), youWon ? '' : 'bad');
    else if (youWon) say(t('great'), 'good');
    else say(t(REASON[reason] || 'out'), 'bad');
    if (youWon) {
      ctx.sfx.play('success');
      ctx.sfx.noise({ dur: 0.7, vol: 0.18, freq: 900, q: 0.4, delay: 0.05 });
    } else ctx.sfx.tone({ freq: 200, to: 130, dur: 0.2, type: 'sawtooth', vol: 0.2 });
    if (ev.rally >= 8) renderer.shakeNow(3);
  }

  function onSet(ev) {
    const youWon = ev.winner === 0;
    say(t(youWon ? 'wonSet' : 'lostSet'), youWon ? 'gold' : 'bad');
    ctx.sfx.play(youWon ? 'levelup' : 'lose');
  }

  function onMatchOver(ev) {
    gameEnd = true;
    const won = ev.winner === 0;
    ctx.sfx.play(won ? 'win' : 'lose');
    if (won) ctx.sfx.noise({ dur: 1.2, vol: 0.3, freq: 900, q: 0.3 });
    ctx.sfx.vibrate?.(won ? [30, 40, 30] : 60);
    setTimeout(() => {
      if (!ended) env.onMatchEnd({ won, sets: [...match.sets], score: [...match.score], rallyBest: match.rallyBest, meta });
    }, 1400);
  }

  // ---------- drills ----------
  function newTarget() {
    if (!trainState || trainState.kind !== 'target') return;
    trainState.tgt = { x: (Math.random() * 2 - 1) * 0.42, z: -(0.55 + Math.random() * 0.6), r: TARGET_R };
  }

  function onDrillPoint(ev) {
    if (trainState.kind === 'serve') {
      trainState.attempts++;
      const tg = trainState.tgt;
      const ok = firstBounce && Math.abs(firstBounce.x - tg.x) < tg.r && Math.abs(firstBounce.z - tg.z) < tg.r * 1.5;
      if (ok) {
        trainState.hits++;
        say(t('great'), 'good');
        ctx.sfx.play('success');
      } else {
        say(t('out'), 'bad');
        ctx.sfx.play('error');
      }
      firstBounce = null;
      trainState.tgt = pickServeTarget();
      updTrainTop();
      if (trainState.attempts >= 10) finishDrill();
    } else if (trainState.kind === 'rally') {
      trainState.best = Math.max(trainState.best, trainState.streak);
      if (trainState.streak >= RALLY_GOAL) say(t('great'), 'good');
      trainState.streak = 0;
      updStreak();
      updTrainTop();
    } else if (trainState.kind === 'target') {
      // a bounce on the opponent half inside the target scores
      if (ev.reason && firstBounce && trainState.tgt) {
        const tg = trainState.tgt;
        if (Math.abs(firstBounce.x - tg.x) < tg.r && Math.abs(firstBounce.z - tg.z) < tg.r) {
          trainState.hits++;
          trainState.score += 2;
          say(t('great'), 'good');
          ctx.sfx.play('coin');
        }
      }
      firstBounce = null;
      newTarget();
      updTrainTop();
    }
  }

  function pickServeTarget() {
    return { x: (Math.random() * 2 - 1) * 0.42, z: -(0.7 + Math.random() * 0.45), r: TARGET_R };
  }

  function updStreak() {
    if (!hudStreak) return;
    if (trainState?.kind === 'rally') {
      hudStreak.textContent = `${t('streak', { n: trainState.streak })} · ${t('bestRally', { n: trainState.best })}`;
      hudStreak.classList.add('show');
    } else hudStreak.classList.remove('show');
  }

  function updTrainTop() {
    if (!trainState) return;
    const k = trainState.kind;
    let s;
    if (k === 'serve') s = t('hits', { n: trainState.hits }) + ' · ' + t('targets', { n: 10 - trainState.attempts });
    else if (k === 'rally') s = t('bestRally', { n: trainState.best });
    else s = t('score', { n: trainState.score }) + ' · ' + t('timeLeft', { n: Math.ceil(Math.max(0, trainState.left)) });
    hudTop.innerHTML = '';
    hudTop.append(ctx.ui.h('div', { class: 'pp-trainbox' }, ctx.ui.h('div', { class: 'pp-tt' }, t(meta.label)), ctx.ui.h('div', { class: 'pp-ts' }, s)));
  }

  function finishDrill() {
    if (ended) return;
    gameEnd = true;
    const k = trainState.kind;
    let body;
    let best;
    if (k === 'serve') {
      best = trainState.hits;
      body = t('hits', { n: trainState.hits }) + ' / 10';
    } else if (k === 'rally') {
      best = trainState.best;
      body = t('bestRally', { n: trainState.best });
    } else {
      best = trainState.score;
      body = t('score', { n: trainState.score });
    }
    const stat = env.onDrillEnd ? env.onDrillEnd(k, best) : null;
    ctx.ui
      .modal({
        title: t('done'),
        body: stat ? `${body} · ${stat}` : body,
        actions: [
          { label: t('playAgain'), value: 'again', primary: true },
          { label: t('quit'), value: 'quit' },
        ],
        dismissible: true,
      })
      .then((v) => {
        if (ended) return;
        if (v === 'again') env.restartDrill?.(meta);
        else env.exit?.();
      });
  }

  // ---------- input ----------
  function localXY(e) {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    if (paused || gameEnd) return;
    const p = localXY(e);
    stroke = { id: e.pointerId, pts: [{ x: p.x, y: p.y, t: performance.now() / 1000 }], t0: performance.now(), moved: 0 };
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {}
  }

  function onMove(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const p = localXY(e);
    const last = stroke.pts[stroke.pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
    stroke.pts.push({ x: p.x, y: p.y, t: performance.now() / 1000 });
    if (stroke.pts.length > 80) stroke.pts.shift();
  }

  function onUp(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const s = stroke;
    stroke = null;
    if (paused || !match) return;
    const pts = s.pts;
    const first = pts[0];
    const lastP = pts[pts.length - 1];
    const dist = Math.hypot(lastP.x - first.x, lastP.y - first.y);
    const dur = performance.now() - s.t0;
    if (dist < 16 && dur < 380) {
      // tap: toss the ball
      if (match.needsToss) {
        match.toss();
        ctx.sfx.play('pop');
        hint('');
      }
      return;
    }
    if (match.needsToss) {
      hint(t('tossHint'));
      return;
    }
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const an = analyzeSwipe(pts, W, H);
    if (!an) return;
    const tc = match.time - (performance.now() / 1000 - an.contactT) * match.slowmo;
    const res = match.swipe(an.shot, tc);
    if (globalThis.__ppDebug) globalThis.__ppDebug.lastSwipe = { res: res ? { ok: res.ok, q: res.q, reason: res.reason, early: res.early, smash: res.smash, kind: res.kind } : null, shot: an.shot, speed: Math.round(an.speed), dur: Math.round(an.dur * 1000) };
    if (!res) return;
    if (res.ok) {
      swing.player = 1;
      ctx.sfx.vibrate?.(8);
      if (res.q < 0.45) say(t('nice'), '');
      else if (res.q >= 0.8 && !res.smash) say(t('great'), 'good');
    } else if (res.reason === 'timing') {
      say(res.early ? t('early') : t('late'), 'bad');
    }
  }

  // ---------- fx overlay (swipe trail) ----------
  function drawFx(now) {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    fxg.clearRect(0, 0, W, H);
    if (!stroke || stroke.pts.length < 2) return;
    const pts = stroke.pts;
    for (let i = 1; i < pts.length; i++) {
      const k = i / pts.length;
      fxg.strokeStyle = withAlpha('#f7d774', 0.15 + 0.7 * k);
      fxg.lineWidth = 2 + 10 * k;
      fxg.lineCap = 'round';
      fxg.beginPath();
      fxg.moveTo(pts[i - 1].x, pts[i - 1].y);
      fxg.lineTo(pts[i].x, pts[i].y);
      fxg.stroke();
    }
  }

  // ---------- drill target (serve practice / target hitting) ----------
  function drawTarget() {
    if (!trainState?.tgt || !renderer || !fxg) return;
    const tg = trainState.tgt;
    const c = renderer.proj(tg.x, TABLE_Y + 0.002, tg.z);
    const e = renderer.proj(tg.x + tg.r, TABLE_Y + 0.002, tg.z);
    if (!c || !e) return;
    const rad = Math.abs(e[0] - c[0]);
    fxg.beginPath();
    fxg.ellipse(c[0], c[1], rad * 1.5, rad * 0.75, 0, 0, Math.PI * 2);
    fxg.fillStyle = 'rgba(63,200,255,0.25)';
    fxg.fill();
    fxg.lineWidth = 2;
    fxg.strokeStyle = 'rgba(160,230,255,0.9)';
    fxg.stroke();
  }

  // ---------- main loop ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0.016));
    last = now;
    if (paused) return;
    swing.player = Math.max(0, swing.player - dt * 4);
    swing.ai = Math.max(0, swing.ai - dt * 4);
    if (match.phase === 'serveWait') {
      serverAtStart = match.server;
      if (!serveAnn) {
        serveAnn = true;
        if (meta.type === 'match') {
          if (match.matchPoint) say(t('matchPoint'), 'gold');
          else if (match.score[0] === 10 && match.score[1] === 10) say(t('deuce'), 'gold');
        }
      }
    } else serveAnn = false;
    const near = match.phase === 'rally' && match.matchPoint;
    match.slowmo += ((near ? 0.45 : 1) - match.slowmo) * Math.min(1, dt * 4);
    if (trainState?.kind === 'target' && !gameEnd) {
      trainState.left -= dt;
      if (trainState.left <= 0) {
        trainState.left = 0;
        finishDrill();
      }
    }
    match.update(dt);
    onEvents();
    if (match.phase === 'rally') excite += (Math.min(1, match.rally / 10) - excite) * Math.min(1, dt * 2);
    else excite += (0.2 - excite) * Math.min(1, dt * 1.5);
    // trail
    let trail = null;
    if (match.hist.length > 4) {
      trail = [];
      const h = match.hist;
      for (let i = Math.max(0, h.length - 16); i < h.length; i += 2) trail.push(h[i].p);
    }
    renderer.draw(
      { match, look, ballSkin: skinOf(), swing, trail, excite, finger: stroke && stroke.pts.length ? stroke.pts[stroke.pts.length - 1] : null },
      dt,
    );
    drawFx(now);
    drawTarget();
    if (annT > 0) {
      annT -= dt;
      if (annT <= 0) hudAnn.classList.remove('show');
    }
    updateHud();
    if (match.phase === 'serveWait' && match.needsToss) hint(t('tossHint'));
    else if (match.phase === 'toss') hint(t('serveHint'));
    else if (match.phase === 'rally' && match.lastHit === 1) hint(t('swipeHint'));
    else hint('');
  }

  function updateHud() {
    const [a, b] = match.score;
    const srv = match.server;
    const sets = match.sets;
    const key = [a, b, sets[0], sets[1], srv, match.phase === 'point' ? 1 : 0, meta.type === 'training' ? 1 : 0].join('|');
    if (key === cached) return;
    cached = key;
    if (meta.type === 'training') {
      updTrainTop();
      return;
    }
    hudTop.innerHTML = '';
    const h = ctx.ui.h;
    const oppName = meta.opp || t('ai');
    const player = (name, srvOn, cls) =>
      h('div', { class: `pp-pl ${cls}` }, h('i', { class: 'pp-av' }, name.trim().charAt(0).toUpperCase()), h('span', null, name), srvOn ? h('b', { class: 'pp-srv' }) : null);
    const dots = (n) => h('span', { class: 'pp-dots' }, Array.from({ length: Math.ceil((match.cfg.bestOf || 3) / 2) }, (_, i) => h('i', { class: i < n ? 'on' : '' })));
    hudTop.append(
      h('div', { class: 'pp-hl' }, player(t('you'), srv === 0, 'me'), player(oppName, srv === 1, 'ai')),
      h(
        'div',
        { class: 'pp-hr' },
        h('div', { class: 'pp-badges' }, h('b', { class: 'pp-badge me' }, String(a)), h('b', { class: 'pp-badge ai' }, String(b))),
        h('div', { class: 'pp-setrow' }, dots(sets[0]), h('small', null, t('game', { n: match.setNo })), dots(sets[1])),
      ),
    );
  }

  // ---------- public ----------
  function start(cfg, m) {
    stop();
    meta = m;
    ended = false;
    gameEnd = false;
    paused = false;
    cached = '';
    hintCache = '';
    firstBounce = null;
    annT = 0;
    swing = { player: 0, ai: 0 };
    mkStage();
    const arena = ARENAS[m.arena || 0];
    renderer = createRenderer(canvas, arena, t(arena.key));
    resizeFx();
    match = new Match({ ...cfg, eq: env.eq() });
    if (globalThis.__ppDebug) globalThis.__ppDebug.match = match; // test seam
    serverAtStart = match.server;
    if (m.type === 'training') {
      trainState = { kind: m.drill, attempts: 0, hits: 0, streak: 0, best: 0, score: 0, left: TARGET_TIME, tgt: null };
      if (m.drill === 'serve') trainState.tgt = pickServeTarget();
      if (m.drill === 'target') newTarget();
      updTrainTop();
      updStreak();
    } else {
      trainState = null;
    }
    hudAnn.classList.remove('show');
    last = performance.now();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resizeFx);
    return match;
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('resize', resizeFx);
    renderer?.destroy();
    renderer = null;
    stage?.remove();
    stage = null;
    match = null;
    trainState = null;
  }

  function pause(v) {
    paused = v;
  }

  function end() {
    ended = true;
    stop();
  }

  return {
    start,
    stop: end,
    pause,
    isRunning: () => !!match && !ended,
    get match() {
      return match;
    },
    get paused() {
      return paused;
    },
    get ended() {
      return ended;
    },
  };
}

