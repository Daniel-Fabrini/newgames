// Card-game sound effects synthesised with ctx.sfx.tone / ctx.sfx.noise (so the app mute is honoured).
//   const cs = createCardSfx(ctx);   cs.deal(); cs.flip(); cs.place(); cs.slide(); cs.shuffle(); cs.chipSingle(); cs.chipStack();
//   cs.check(); cs.fold(); cs.win(); cs.lose(); cs.special('skip'|'reverse'|'draw'); cs.yell(level 1..3); cs.select(); cs.error(); cs.turn()
//   cs.enabled = false (in-game sound toggle) · cs.volume = 0..1 · cs.haptics = false
export function createCardSfx(ctx) {
  const S = ctx && ctx.sfx;
  const api = { enabled: true, volume: 1, haptics: true };
  const tone = (o) => api.enabled && S && S.tone && S.tone({ ...o, vol: (o.vol ?? 0.3) * api.volume });
  const noise = (o) => api.enabled && S && S.noise && S.noise({ ...o, vol: (o.vol ?? 0.3) * api.volume });
  const vib = (p) => api.enabled && api.haptics && S && S.vibrate && S.vibrate(p);
  const jit = (v, p = 0.12) => v * (1 + (Math.random() - 0.5) * 2 * p);

  Object.assign(api, {
    deal() {
      noise({ dur: 0.07, vol: 0.2, freq: jit(2600), q: 1.1 });
      tone({ freq: jit(900), to: 500, dur: 0.03, type: 'triangle', vol: 0.05 });
    },
    flip() {
      noise({ dur: 0.05, vol: 0.2, freq: jit(3400), q: 1.4 });
      noise({ dur: 0.06, vol: 0.14, freq: 1700, q: 1, delay: 0.07 });
    },
    place() {
      tone({ freq: jit(190), to: 95, dur: 0.07, type: 'sine', vol: 0.4 });
      noise({ dur: 0.04, vol: 0.22, freq: jit(1800), q: 0.9 });
      vib(8);
    },
    slide() {
      noise({ dur: 0.16, vol: 0.16, freq: jit(1000), q: 0.45 });
    },
    shuffle() {
      for (let i = 0; i < 9; i++) noise({ dur: 0.05, vol: 0.14, freq: jit(2200, 0.3), q: 1, delay: i * 0.055 });
      noise({ dur: 0.12, vol: 0.1, freq: 900, q: 0.5, delay: 0.5 });
    },
    chipSingle() {
      tone({ freq: jit(2300), to: 1700, dur: 0.045, type: 'sine', vol: 0.22 });
      tone({ freq: jit(3500), dur: 0.03, type: 'triangle', vol: 0.1, delay: 0.01 });
      noise({ dur: 0.02, vol: 0.12, freq: 4200, q: 2 });
      vib(6);
    },
    chipStack(n = 5) {
      for (let i = 0; i < n; i++) {
        tone({ freq: jit(2200, 0.2), to: 1600, dur: 0.04, type: 'sine', vol: 0.18, delay: i * 0.045 });
        noise({ dur: 0.02, vol: 0.1, freq: 4000, q: 2, delay: i * 0.045 });
      }
      vib([6, 30, 6]);
    },
    check() {
      tone({ freq: 150, to: 110, dur: 0.06, type: 'sine', vol: 0.45 });
      tone({ freq: 150, to: 110, dur: 0.06, type: 'sine', vol: 0.45, delay: 0.12 });
      noise({ dur: 0.03, vol: 0.15, freq: 1200, q: 1, delay: 0.12 });
    },
    fold() {
      api.slide();
      tone({ freq: 260, to: 140, dur: 0.16, type: 'triangle', vol: 0.12, delay: 0.04 });
    },
    select() {
      tone({ freq: 700, to: 900, dur: 0.05, type: 'triangle', vol: 0.18 });
    },
    error() {
      tone({ freq: 200, to: 130, dur: 0.18, type: 'sawtooth', vol: 0.14 });
      vib(30);
    },
    turn() {
      tone({ freq: 880, dur: 0.07, type: 'sine', vol: 0.14 });
      tone({ freq: 1175, dur: 0.1, type: 'sine', vol: 0.12, delay: 0.07 });
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.3, delay: i * 0.1 }));
      tone({ freq: 1047, dur: 0.6, type: 'sine', vol: 0.15, delay: 0.5 });
      vib([20, 40, 30, 40, 60]);
    },
    lose() {
      [392, 349, 294, 220].forEach((f, i) => tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.26, delay: i * 0.15 }));
      vib([60, 40, 90]);
    },
    special(kind = 'skip') {
      if (kind === 'reverse') {
        tone({ freq: 400, to: 900, dur: 0.14, type: 'triangle', vol: 0.25 });
        tone({ freq: 900, to: 400, dur: 0.14, type: 'triangle', vol: 0.25, delay: 0.14 });
      } else if (kind === 'draw') {
        tone({ freq: 300, to: 200, dur: 0.12, type: 'square', vol: 0.12 });
        tone({ freq: 300, to: 200, dur: 0.12, type: 'square', vol: 0.12, delay: 0.14 });
      } else {
        tone({ freq: 700, to: 300, dur: 0.18, type: 'square', vol: 0.14 });
        noise({ dur: 0.1, vol: 0.12, freq: 2000, delay: 0.02 });
      }
      vib(25);
    },
    /** Call-out punch (Truco / "last card"): 1 = soft, 3 = loud. */
    yell(level = 2) {
      const base = 170 + level * 25;
      tone({ freq: base, to: base * 1.7, dur: 0.16, type: 'sawtooth', vol: 0.1 + level * 0.04 });
      tone({ freq: base * 1.5, to: base * 2.6, dur: 0.18, type: 'square', vol: 0.05 + level * 0.02, delay: 0.02 });
      noise({ dur: 0.14, vol: 0.12 + level * 0.05, freq: 900 + level * 300, q: 0.6, delay: 0.02 });
      if (level >= 2) tone({ freq: base * 2, to: base * 1.2, dur: 0.22, type: 'sawtooth', vol: 0.08 + level * 0.03, delay: 0.17 });
      vib(level >= 3 ? [30, 30, 60] : 25);
    },
  });
  return api;
}
