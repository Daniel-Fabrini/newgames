// TV-show sound design on top of ctx.sfx.tone / ctx.sfx.noise: stingers,
// drumrolls, applause, crowd reactions, timer ticks and fanfares.

export function makeFx(sfx) {
  const T = (o) => sfx.tone(o);
  const N = (o) => sfx.noise(o);
  const R = Math.random;

  const fx = {
    // Dramatic minor chord when a question appears; rises with the ladder.
    stinger(level = 0) {
      const root = 98 * Math.pow(2, Math.min(level, 15) / 30);
      [1, 1.189, 1.498, 2].forEach((r, i) => T({ freq: root * r, dur: 1.1, type: 'sawtooth', vol: 0.055, delay: i * 0.015, attack: 0.02 }));
      T({ freq: root / 2, dur: 1.3, type: 'sine', vol: 0.4, attack: 0.01 });
      T({ freq: root * 4, to: root * 4.05, dur: 0.9, type: 'triangle', vol: 0.06, delay: 0.05 });
      N({ dur: 0.6, vol: 0.14, freq: 260, q: 0.5 });
    },
    optionIn(i) {
      T({ freq: 494 + i * 110, dur: 0.08, type: 'triangle', vol: 0.16 });
      N({ dur: 0.05, vol: 0.06, freq: 4000, q: 2 });
    },
    pick() {
      T({ freq: 660, to: 880, dur: 0.1, type: 'triangle', vol: 0.25 });
    },
    lock() {
      T({ freq: 90, to: 45, dur: 0.55, type: 'sine', vol: 0.65 });
      N({ dur: 0.35, vol: 0.28, freq: 180, q: 0.6 });
      T({ freq: 220, dur: 0.4, type: 'sawtooth', vol: 0.06 });
    },
    // Drumroll with a rising pad while the answer is being checked.
    suspense(sec = 2) {
      const step = 0.065;
      const n = Math.floor(sec / step);
      for (let i = 0; i < n; i++) N({ dur: 0.05, vol: 0.05 + 0.16 * (i / n), freq: 160 + R() * 90, q: 0.9, delay: i * step });
      T({ freq: 130, to: 262, dur: sec, type: 'triangle', vol: 0.1, attack: 0.3 });
      T({ freq: 131.5, to: 265, dur: sec, type: 'sawtooth', vol: 0.03, attack: 0.3 });
    },
    applause(sec = 1.8, power = 1) {
      const claps = Math.round(46 * sec * power);
      for (let i = 0; i < claps; i++) N({ dur: 0.025 + R() * 0.05, vol: (0.05 + R() * 0.12) * power, freq: 1100 + R() * 3200, q: 1.6, delay: R() * sec });
      N({ dur: sec, vol: 0.07 * power, freq: 1800, q: 0.25 });
    },
    cheer() {
      T({ freq: 420, to: 640, dur: 0.6, type: 'sine', vol: 0.06 });
      T({ freq: 520, to: 760, dur: 0.6, type: 'sine', vol: 0.05, delay: 0.05 });
      N({ dur: 0.9, vol: 0.1, freq: 900, q: 0.4 });
    },
    correct() {
      [523, 659, 784, 1047].forEach((f, i) => T({ freq: f, dur: 0.22, type: 'triangle', vol: 0.32, delay: i * 0.08 }));
      T({ freq: 1568, dur: 0.5, type: 'sine', vol: 0.12, delay: 0.32 });
      fx.applause(1.6, 0.9);
      fx.cheer();
    },
    wrong() {
      T({ freq: 311, to: 300, dur: 0.32, type: 'sawtooth', vol: 0.14 });
      T({ freq: 294, to: 282, dur: 0.32, type: 'sawtooth', vol: 0.14, delay: 0.36 });
      T({ freq: 277, to: 190, dur: 0.95, type: 'sawtooth', vol: 0.14, delay: 0.72 });
      // the crowd's "ohhh"
      T({ freq: 300, to: 210, dur: 1.2, type: 'sine', vol: 0.12, delay: 0.1, attack: 0.15 });
      T({ freq: 380, to: 260, dur: 1.2, type: 'sine', vol: 0.08, delay: 0.12, attack: 0.15 });
      N({ dur: 1.1, vol: 0.1, freq: 520, q: 0.6, delay: 0.1 });
    },
    timeout() {
      T({ freq: 150, dur: 0.8, type: 'sawtooth', vol: 0.22 });
      T({ freq: 157, dur: 0.8, type: 'square', vol: 0.1 });
    },
    tick(urgent) {
      T({ freq: urgent ? 1500 : 1050, dur: 0.035, type: 'square', vol: urgent ? 0.1 : 0.05 });
    },
    heartbeat() {
      T({ freq: 64, to: 44, dur: 0.16, type: 'sine', vol: 0.5 });
      T({ freq: 58, to: 40, dur: 0.16, type: 'sine', vol: 0.36, delay: 0.21 });
    },
    flip() {
      N({ dur: 0.09, vol: 0.25, freq: 3200, q: 1 });
      T({ freq: 820, to: 1300, dur: 0.09, type: 'triangle', vol: 0.12 });
    },
    zap() {
      T({ freq: 900, to: 180, dur: 0.22, type: 'square', vol: 0.07 });
      N({ dur: 0.15, vol: 0.12, freq: 1500, q: 1 });
    },
    whoosh() {
      N({ dur: 0.3, vol: 0.22, freq: 700, q: 0.5 });
    },
    climb(step = 0) {
      T({ freq: 392 * Math.pow(2, step / 12), dur: 0.12, type: 'triangle', vol: 0.22 });
    },
    milestone() {
      [392, 523, 659, 784, 1047].forEach((f, i) => T({ freq: f, dur: 0.24, type: 'square', vol: 0.09, delay: i * 0.09 }));
      [523, 659, 784].forEach((f) => T({ freq: f, dur: 0.9, type: 'triangle', vol: 0.18, delay: 0.5 }));
      fx.applause(2.4, 1.1);
    },
    million() {
      const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      seq.forEach((f, i) => T({ freq: f, dur: 0.26, type: 'square', vol: 0.08, delay: i * 0.11 }));
      seq.forEach((f, i) => T({ freq: f / 2, dur: 0.26, type: 'triangle', vol: 0.22, delay: i * 0.11 }));
      [523, 659, 784, 1047].forEach((f) => T({ freq: f, dur: 1.6, type: 'triangle', vol: 0.14, delay: 0.95 }));
      fx.applause(3.4, 1.3);
      fx.cheer();
    },
    coins(n = 6) {
      for (let i = 0; i < n; i++) T({ freq: 1319 + (i % 3) * 180, dur: 0.07, type: 'square', vol: 0.06, delay: i * 0.07 });
    },
  };
  return fx;
}
