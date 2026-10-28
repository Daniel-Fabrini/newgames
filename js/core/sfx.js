// Synthesized sound effects (Web Audio, no audio files) and vibration.
// Usage: sfx.play('success'); sfx.vibrate(30);

import { createStore } from './store.js';

const prefs = createStore('app');
let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only allow audio after a user gesture: unlock on the first touch.
const unlock = () => {
  audio();
  window.removeEventListener('pointerdown', unlock, true);
};
window.addEventListener('pointerdown', unlock, true);

function tone({ freq = 440, to = null, dur = 0.12, type = 'sine', vol = 0.6, delay = 0, attack = 0.005 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.4, delay = 0, freq = 1200, q = 0.8 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

const PRESETS = {
  tap: () => {
    tone({ freq: 1250, to: 820, dur: 0.045, type: 'triangle', vol: 0.22 });
    noise({ dur: 0.02, vol: 0.08, freq: 3200, q: 1.5 });
  },
  select: () => tone({ freq: 520, to: 780, dur: 0.08, type: 'triangle', vol: 0.35 }),
  success: () => {
    tone({ freq: 660, dur: 0.1, type: 'triangle', vol: 0.4 });
    tone({ freq: 990, dur: 0.16, type: 'triangle', vol: 0.4, delay: 0.08 });
  },
  error: () => tone({ freq: 220, to: 140, dur: 0.22, type: 'sawtooth', vol: 0.25 }),
  coin: () => {
    tone({ freq: 988, dur: 0.06, type: 'square', vol: 0.18 });
    tone({ freq: 1319, dur: 0.18, type: 'square', vol: 0.18, delay: 0.06 });
  },
  pop: () => tone({ freq: 400, to: 900, dur: 0.07, type: 'sine', vol: 0.4 }),
  whoosh: () => noise({ dur: 0.25, vol: 0.3, freq: 800, q: 0.5 }),
  kick: () => {
    tone({ freq: 160, to: 60, dur: 0.12, type: 'sine', vol: 0.7 });
    noise({ dur: 0.05, vol: 0.25, freq: 2500 });
  },
  hit: () => noise({ dur: 0.08, vol: 0.35, freq: 1800, q: 1.2 }),
  shoot: () => tone({ freq: 900, to: 300, dur: 0.06, type: 'square', vol: 0.12 }),
  explosion: () => {
    noise({ dur: 0.5, vol: 0.5, freq: 300, q: 0.4 });
    tone({ freq: 90, to: 40, dur: 0.4, type: 'sine', vol: 0.5 });
  },
  whistle: () => {
    tone({ freq: 2100, dur: 0.18, type: 'sine', vol: 0.25 });
    tone({ freq: 2300, dur: 0.3, type: 'sine', vol: 0.25, delay: 0.2 });
  },
  goal: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.4, delay: i * 0.09 }));
    noise({ dur: 1.2, vol: 0.15, freq: 900, q: 0.3, delay: 0.1 });
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.4, delay: i * 0.1 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.35, delay: i * 0.14 })),
  levelup: () => [440, 554, 659, 880].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'square', vol: 0.15, delay: i * 0.07 })),
};

const lastPlayed = {};

export const sfx = {
  get muted() {
    return prefs.get('muted', false);
  },
  set muted(v) {
    prefs.set('muted', !!v);
  },
  get vibration() {
    return prefs.get('vibration', true);
  },
  set vibration(v) {
    prefs.set('vibration', !!v);
  },
  play(name) {
    if (this.muted) return;
    // The same sound twice within a few ms (e.g. the global click plus a game's
    // own 'tap') plays once.
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < 70) return;
    lastPlayed[name] = now;
    const fn = PRESETS[name];
    try {
      if (fn) fn();
    } catch {
      /* audio not available */
    }
  },
  // Custom tone for games that need their own sounds.
  tone(opts) {
    if (!this.muted) tone(opts);
  },
  noise(opts) {
    if (!this.muted) noise(opts);
  },
  vibrate(pattern = 20) {
    if (!this.vibration) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  },
};
