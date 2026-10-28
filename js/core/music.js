// Background music: a generative lounge loop synthesized with Web Audio
// (warm pad, soft bass, plucked arpeggio with echo, light percussion).
// No audio files. Starts after the first tap, pauses when the app is hidden.
//
//   music.enabled = true/false   (saved)
//   music.start()                (safe to call repeatedly)
//   music.setLevel(0..1)         (ducking: 1 menus, lower in games, 0 = silent)

import { audio } from './sfx.js';
import { createStore } from './store.js';

const prefs = createStore('app');

const BPM = 84;
const STEP = 60 / BPM / 4; // a 16th note
const VOLUME = 0.16;

// MIDI chords (I – vi – IV – V in D, with color tones). Each lasts one bar.
const CHORDS = [
  { root: 38, tones: [62, 66, 69, 73, 76] }, // Dmaj9
  { root: 35, tones: [59, 62, 66, 69, 73] }, // Bm9
  { root: 31, tones: [59, 62, 66, 67, 71] }, // Gmaj7
  { root: 33, tones: [61, 64, 67, 69, 74] }, // A13sus-ish
  { root: 38, tones: [62, 66, 69, 71, 76] }, // D6/9
  { root: 30, tones: [57, 61, 64, 66, 69] }, // F#m7
  { root: 31, tones: [59, 62, 66, 69, 74] }, // Gmaj9
  { root: 33, tones: [61, 64, 67, 69, 73] }, // A7
];

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let ac = null;
let out = null; // level gain (ducking)
let bus = null; // instruments → filter → out
let echo = null;
let timer = null;
let step = 0;
let nextTime = 0;
let level = 1;
let rand = mulberry(7);

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build() {
  ac = audio();
  if (!ac) return false;
  out = ac.createGain();
  out.gain.value = 0;
  out.connect(ac.destination);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 3;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  bus = ac.createGain();
  bus.gain.value = 1;
  bus.connect(lp).connect(comp).connect(out);
  // Echo for the pluck: delay with filtered feedback.
  echo = ac.createDelay(1);
  echo.delayTime.value = STEP * 3;
  const fb = ac.createGain();
  fb.gain.value = 0.32;
  const efilt = ac.createBiquadFilter();
  efilt.type = 'lowpass';
  efilt.frequency.value = 2200;
  echo.connect(efilt).connect(fb).connect(echo);
  const ewet = ac.createGain();
  ewet.gain.value = 0.45;
  efilt.connect(ewet).connect(bus);
  return true;
}

function env(g, t, attack, hold, release, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

function pad(chord, t) {
  const dur = STEP * 16;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(700, t);
  f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
  f.frequency.linearRampToValueAtTime(750, t + dur);
  f.connect(bus);
  for (const m of chord.tones.slice(0, 4)) {
    for (const det of [-7, 7]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m - 12);
      o.detune.value = det;
      const g = ac.createGain();
      env(g, t, 0.9, dur - 1.4, 1.3, 0.018);
      o.connect(g).connect(f);
      o.start(t);
      o.stop(t + dur + 0.5);
    }
  }
}

function bass(chord, t, len) {
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz(chord.root);
  const o2 = ac.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = hz(chord.root + 12);
  const g = ac.createGain();
  env(g, t, 0.02, len * 0.5, len * 0.6, 0.22);
  const g2 = ac.createGain();
  g2.gain.value = 0.18;
  o.connect(g).connect(bus);
  o2.connect(g2).connect(g);
  o.start(t);
  o2.start(t);
  o.stop(t + len * 1.3);
  o2.stop(t + len * 1.3);
}

function pluck(m, t, vel) {
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.value = hz(m);
  const o2 = ac.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = hz(m + 12);
  const g = ac.createGain();
  env(g, t, 0.005, 0.02, 0.5, 0.07 * vel);
  const g2 = ac.createGain();
  g2.gain.value = 0.25;
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(bus);
  g.connect(echo);
  o.start(t);
  o2.start(t);
  o.stop(t + 0.6);
  o2.stop(t + 0.6);
}

function hat(t, vol) {
  const len = Math.floor(ac.sampleRate * 0.05);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(hp).connect(g).connect(bus);
  src.start(t);
}

function kick(t) {
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  const g = ac.createGain();
  env(g, t, 0.004, 0.03, 0.25, 0.28);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + 0.35);
}

function schedule(s, t) {
  const bar = Math.floor(s / 16);
  const inBar = s % 16;
  const chord = CHORDS[bar % CHORDS.length];
  const section = Math.floor(bar / 8) % 4; // vary density every 8 bars
  if (inBar === 0) pad(chord, t);
  if (inBar === 0) bass(chord, t, STEP * 6);
  if (inBar === 8) bass(chord, t, STEP * 4);
  if (inBar === 14 && rand() < 0.5) bass(chord, t, STEP * 2);
  if (section > 0) {
    if (inBar === 0 || inBar === 8) kick(t);
    if (inBar % 4 === 2) hat(t, 0.05);
    else if (inBar % 2 === 1 && rand() < 0.35) hat(t, 0.02);
  }
  // Arpeggio on 8ths, sparser in the intro section.
  if (inBar % 2 === 0 && rand() < (section === 0 ? 0.35 : 0.62)) {
    const tones = chord.tones;
    const m = tones[Math.floor(rand() * tones.length)] + (rand() < 0.25 ? 12 : 0);
    pluck(m, t + (rand() < 0.2 ? STEP * 0.5 : 0), 0.6 + rand() * 0.4);
  }
}

function tick() {
  if (!ac) return;
  while (nextTime < ac.currentTime + 0.25) {
    schedule(step, nextTime);
    step++;
    nextTime += STEP;
  }
}

function applyLevel(ramp = 0.8) {
  if (!ac || !out) return;
  const target = music.enabled ? VOLUME * level : 0;
  out.gain.cancelScheduledValues(ac.currentTime);
  out.gain.setTargetAtTime(Math.max(target, 0.0001), ac.currentTime, ramp / 3);
}

export const music = {
  get enabled() {
    return prefs.get('music', true);
  },
  set enabled(v) {
    prefs.set('music', !!v);
    if (v) this.start();
    applyLevel(0.4);
  },
  start() {
    if (!this.enabled) return;
    if (!ac && !build()) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    if (!timer) {
      rand = mulberry(Math.floor(Math.random() * 1e9));
      step = 0;
      nextTime = ac.currentTime + 0.1;
      timer = setInterval(tick, 50);
    }
    applyLevel(2.5);
  },
  setLevel(v) {
    level = Math.max(0, Math.min(1, v));
    applyLevel(0.8);
  },
  pause() {
    if (timer) clearInterval(timer);
    timer = null;
    if (out && ac) out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05);
  },
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) music.pause();
  else if (ac) music.start();
});
