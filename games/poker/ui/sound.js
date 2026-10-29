// Poker sound effects built on ctx.sfx.tone / ctx.sfx.noise (app mute + vibration are respected by ctx.sfx).
export function createSound(ctx, prefs) {
  const sfx = ctx.sfx;
  const on = () => prefs.get('sound') !== false;
  const G = 2.2;
  const tone = (o) => on() && sfx.tone?.({ ...o, vol: Math.min(0.9, (o.vol || 0.1) * G) });
  const noise = (o) => on() && sfx.noise?.({ ...o, vol: Math.min(0.9, (o.vol || 0.1) * G) });
  const vib = (p) => prefs.get('vibrate') !== false && sfx.vibrate?.(p);

  const api = {
    chip(n = 1) {
      for (let i = 0; i < Math.min(3, n); i++) {
        noise({ dur: 0.04, vol: 0.18, freq: 4200 + i * 500, q: 6, delay: i * 0.05 });
        tone({ freq: 1900 + i * 160, to: 1500, dur: 0.05, type: 'triangle', vol: 0.07, delay: i * 0.05 });
      }
    },
    deal() {
      noise({ dur: 0.09, vol: 0.2, freq: 1800, q: 0.7 });
    },
    flip() {
      noise({ dur: 0.07, vol: 0.16, freq: 2600, q: 1.2 });
      tone({ freq: 520, to: 340, dur: 0.06, type: 'sine', vol: 0.06, delay: 0.03 });
    },
    check() {
      tone({ freq: 190, to: 130, dur: 0.08, type: 'sine', vol: 0.22 });
      noise({ dur: 0.04, vol: 0.12, freq: 900, q: 2 });
      vib(8);
    },
    fold() {
      noise({ dur: 0.16, vol: 0.14, freq: 1200, q: 0.6 });
    },
    tick() {
      tone({ freq: 880, dur: 0.025, type: 'square', vol: 0.04 });
    },
    turn() {
      tone({ freq: 660, dur: 0.07, type: 'sine', vol: 0.1 });
      tone({ freq: 990, dur: 0.09, type: 'sine', vol: 0.1, delay: 0.07 });
      vib(14);
    },
    raise() {
      api.chip(3);
    },
    allin() {
      api.chip(3);
      [392, 523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'sawtooth', vol: 0.07, delay: 0.08 + i * 0.07 }));
      noise({ dur: 0.5, vol: 0.12, freq: 300, q: 0.5, delay: 0.1 });
      vib([30, 40, 60]);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.12, delay: i * 0.09 }));
      api.chip(3);
      vib([20, 30, 20]);
    },
    lose() {
      tone({ freq: 300, to: 160, dur: 0.4, type: 'sawtooth', vol: 0.08 });
    },
    fanfare() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.12, delay: i * 0.13 }));
      [262, 330, 392].forEach((f, i) => tone({ freq: f, dur: 0.9, type: 'sine', vol: 0.08, delay: 0.5 + i * 0.02 }));
      vib([40, 60, 40, 60, 90]);
    },
    tap() {
      sfx.play?.('tap');
    },
    bust() {
      tone({ freq: 240, to: 90, dur: 0.6, type: 'sawtooth', vol: 0.1 });
      vib([60, 40, 90]);
    },
    byAction(type) {
      if (type === 'fold') api.fold();
      else if (type === 'check') api.check();
      else if (type === 'call') api.chip(2);
      else if (type === 'bet' || type === 'raise') api.raise();
      else if (type === 'allin') api.allin();
      else if (api[type]) api[type]();
    },
  };
  return api;
}
