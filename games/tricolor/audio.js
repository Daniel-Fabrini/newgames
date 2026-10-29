// Tricolor do Milhão audio: synthesised stadium atmosphere (looping filtered-noise "torcida" with swells,
// drum/clap rhythm, tension drone) + sound effects. Everything is generated with WebAudio — no samples,
// no real chants. Three separate buses (music / effects / ambience) with sliders, toggles and a global mute.
// Nothing starts before the first user gesture; scene changes are cross-faded (no restarts per question).
import { audio as sharedContext } from '../../js/core/sfx.js';
import { sanitizePrefs, channelGain, CHANNELS } from './audioprefs.js';

const BUS_SCALE = { music: 0.5, fx: 0.9, amb: 0.65 };
const SCENES = {
  menu: { amb: 0.85, drum: 1, drone: 0 },
  question: { amb: 0.32, drum: 0, drone: 0.5 },
  suspense: { amb: 0.12, drum: 0, drone: 1 },
  win: { amb: 1, drum: 1.15, drone: 0 },
  lose: { amb: 0.2, drum: 0, drone: 0.15 },
  off: { amb: 0, drum: 0, drone: 0 },
};

export function createAudio({ store, isMuted = () => false }) {
  let prefs = sanitizePrefs(store.get('audio', null));
  let ac = null;
  let nodes = null;
  let gesture = false;
  let sceneName = 'off';
  let disposed = false;
  let hidden = false;
  const timers = new Set();
  let schedTimer = null;
  let swellTimer = null;
  let nextBeat = 0;
  let beat = 0;
  let noiseBuf = null;
  const R = Math.random;

  const save = () => store.set('audio', prefs);
  const gainOf = (ch) => (hidden ? 0 : channelGain(prefs, ch, isMuted())) * BUS_SCALE[ch];

  function applyBuses(ramp = 0.15) {
    if (!nodes) return;
    const t = ac.currentTime;
    for (const ch of CHANNELS) nodes.bus[ch].gain.setTargetAtTime(gainOf(ch), t, ramp);
  }
  function applyScene(ramp = 0.9) {
    if (!nodes) return;
    const s = SCENES[sceneName] || SCENES.off;
    const t = ac.currentTime;
    nodes.sc.amb.gain.setTargetAtTime(s.amb, t, ramp);
    nodes.sc.drum.gain.setTargetAtTime(s.drum, t, ramp);
    nodes.sc.drone.gain.setTargetAtTime(s.drone, t, ramp);
    // tension: the drone's filter opens and pitch rises in suspense
    nodes.droneFilter.frequency.setTargetAtTime(sceneName === 'suspense' ? 900 : 360, t, 1.2);
    nodes.droneOscs.forEach((o, i) => o.detune.setTargetAtTime(sceneName === 'suspense' ? 500 + i * 6 : i * 6, t, 2.5));
  }

  function makeNoise() {
    // ~3 s of pink-ish noise, loops seamlessly enough under the filters
    const len = Math.floor(ac.sampleRate * 3);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    // crossfade the loop edges
    const n = Math.floor(ac.sampleRate * 0.15);
    for (let i = 0; i < n; i++) {
      const a = i / n;
      d[i] = d[i] * a + d[len - n + i] * (1 - a);
    }
    return buf;
  }

  function build() {
    ac = sharedContext();
    if (!ac) return false;
    noiseBuf = makeNoise();
    const master = ac.createGain();
    master.gain.value = 1;
    master.connect(ac.destination);
    const bus = {};
    for (const ch of CHANNELS) {
      bus[ch] = ac.createGain();
      bus[ch].gain.value = 0;
      bus[ch].connect(master);
    }
    const sc = { amb: ac.createGain(), drum: ac.createGain(), drone: ac.createGain() };
    sc.amb.connect(bus.amb);
    sc.drum.connect(bus.music);
    sc.drone.connect(bus.music);
    Object.values(sc).forEach((g) => (g.gain.value = 0));
    // crowd: two layers of looping noise with different bands
    const crowdLo = ac.createGain();
    const crowdHi = ac.createGain();
    crowdLo.gain.value = 0.5;
    crowdHi.gain.value = 0.22;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const mk = (freq, q, rate, out) => {
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      src.playbackRate.value = rate;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q;
      src.connect(bp).connect(out);
      src.start(0, R() * 2);
      return src;
    };
    const srcs = [mk(420, 0.55, 1, crowdLo), mk(1250, 0.5, 0.93, crowdHi), mk(240, 0.7, 1.07, crowdLo)];
    crowdLo.connect(lp);
    crowdHi.connect(lp);
    lp.connect(sc.amb);
    // tension drone: two detuned saws + a fifth, slow wobble
    const droneFilter = ac.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 360;
    droneFilter.Q.value = 2;
    const droneOscs = [55, 55.4, 82.4].map((f, i) => {
      const o = ac.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.value = i === 2 ? 0.1 : 0.07;
      o.connect(g).connect(droneFilter);
      o.start();
      return o;
    });
    const lfo = ac.createOscillator();
    const lfoG = ac.createGain();
    lfo.frequency.value = 0.18;
    lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(droneFilter.frequency);
    lfo.start();
    droneFilter.connect(sc.drone);
    nodes = { master, bus, sc, crowdLo, crowdHi, droneFilter, droneOscs, srcs, lfo };
    applyBuses(0.05);
    applyScene(0.05);
    startSchedulers();
    return true;
  }

  // ---- low level voices (routed to the fx bus) ----
  function tone({ freq = 440, to = null, dur = 0.12, type = 'sine', vol = 0.3, delay = 0, attack = 0.008, bus = 'fx' }) {
    if (!nodes || isMuted()) return;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(nodes.bus[bus]);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }
  function noise({ dur = 0.15, vol = 0.3, delay = 0, freq = 1200, q = 0.8, to = null, attack = 0.01, bus = 'fx', type = 'bandpass' }) {
    if (!nodes || isMuted()) return;
    const t0 = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + R() * 0.4;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(attack, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(nodes.bus[bus]);
    src.start(t0, R() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  // ---- drum / clap pattern (music bus, scene "menu"/"win") ----
  const STEP = 60 / 100 / 4; // 100 BPM sixteenth
  function drumStep(i, t) {
    const s = i % 16;
    const bar = Math.floor(i / 16) % 4;
    const dg = nodes.sc.drum;
    void dg;
    const at = Math.max(0, t - ac.currentTime);
    const kick = (v = 0.5) => {
      tone({ freq: 120, to: 48, dur: 0.22, type: 'sine', vol: v, delay: at, bus: 'music' });
      noise({ dur: 0.04, vol: 0.06, freq: 900, q: 1, delay: at, bus: 'music' });
    };
    const clap = (v = 0.22) => noise({ dur: 0.09, vol: v, freq: 1900, q: 1.1, delay: at, bus: 'music' });
    const tom = (f, v = 0.3) => tone({ freq: f, to: f * 0.7, dur: 0.18, type: 'triangle', vol: v, delay: at, bus: 'music' });
    if (s === 0 || s === 6 || s === 10) kick(s === 0 ? 0.55 : 0.4);
    if (s === 4 || s === 12) clap(0.2);
    if (s === 14 && bar % 2 === 1) {
      clap(0.16);
    }
    if (s === 3 || s === 11) tom(180, 0.18);
    if (bar === 3 && (s === 13 || s === 15)) clap(0.18);
    if (s % 2 === 0) noise({ dur: 0.03, vol: 0.03, freq: 6500, q: 2, delay: at, bus: 'music' });
  }
  function startSchedulers() {
    nextBeat = ac.currentTime + 0.1;
    beat = 0;
    schedTimer = setInterval(() => {
      if (!nodes || hidden || disposed) return;
      while (nextBeat < ac.currentTime + 0.18) {
        if ((SCENES[sceneName] || SCENES.off).drum > 0.05 && !isMuted()) drumStep(beat, nextBeat);
        beat++;
        nextBeat += STEP * (sceneName === 'win' ? 0.9 : 1);
      }
    }, 50);
    // crowd swells + mute watching
    let lastMuted = isMuted();
    swellTimer = setInterval(() => {
      if (!nodes || disposed) return;
      const m = isMuted();
      if (m !== lastMuted) {
        lastMuted = m;
        applyBuses(0.1);
      }
      if (hidden || (SCENES[sceneName] || SCENES.off).amb < 0.05) return;
      if (R() < 0.35) swell(0.12 + R() * 0.25, 0.6 + R() * 1.2);
    }, 1800);
  }
  function swell(amount = 0.3, rise = 1) {
    if (!nodes) return;
    const t = ac.currentTime;
    const lo = nodes.crowdLo.gain;
    lo.cancelScheduledValues(t);
    lo.setTargetAtTime(0.5 + amount, t, rise / 3);
    lo.setTargetAtTime(0.5, t + rise + 0.4, rise / 1.5);
    nodes.crowdHi.gain.setTargetAtTime(0.22 + amount * 0.8, t, rise / 3);
    nodes.crowdHi.gain.setTargetAtTime(0.22, t + rise + 0.4, rise / 1.5);
  }

  const api = {
    get prefs() {
      return prefs;
    },
    get ready() {
      return !!nodes;
    },
    /** call from a user gesture (pointerdown/keydown); builds the graph once */
    unlock() {
      gesture = true;
      if (disposed) return;
      if (!nodes) {
        try {
          if (!build()) return;
        } catch (e) {
          console.warn('[tricolor] audio unavailable', e);
          return;
        }
      }
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      applyBuses(0.1);
      applyScene(0.6);
    },
    setPref(ch, v) {
      prefs[ch] = Math.min(1, Math.max(0, +v || 0));
      save();
      applyBuses();
    },
    setOn(ch, on) {
      prefs.on[ch] = !!on;
      save();
      applyBuses();
    },
    setMute(m) {
      prefs.mute = !!m;
      save();
      applyBuses();
    },
    /** cross-fades to a scene: menu | question | suspense | win | lose | off */
    scene(name, ramp = 0.9) {
      sceneName = SCENES[name] ? name : 'off';
      if (nodes) applyScene(ramp);
    },
    get sceneName() {
      return sceneName;
    },
    swell,
    setHidden(h) {
      hidden = h;
      applyBuses(h ? 0.05 : 0.4);
    },
    ensure() {
      return gesture && !!nodes;
    },
    // ---------- effects ----------
    tap() {
      tone({ freq: 1250, to: 820, dur: 0.05, type: 'triangle', vol: 0.18 });
    },
    pick() {
      tone({ freq: 660, to: 880, dur: 0.11, type: 'triangle', vol: 0.22 });
      noise({ dur: 0.05, vol: 0.05, freq: 4200, q: 2 });
    },
    lock() {
      tone({ freq: 96, to: 44, dur: 0.6, type: 'sine', vol: 0.6 });
      noise({ dur: 0.35, vol: 0.2, freq: 190, q: 0.6 });
      tone({ freq: 220, dur: 0.4, type: 'sawtooth', vol: 0.05 });
    },
    stinger(level = 0) {
      const root = 98 * Math.pow(2, Math.min(level, 15) / 30);
      [1, 1.189, 1.498, 2].forEach((r, i) => tone({ freq: root * r, dur: 1.0, type: 'sawtooth', vol: 0.045, delay: i * 0.015, attack: 0.03 }));
      tone({ freq: root / 2, dur: 1.2, type: 'sine', vol: 0.35 });
      noise({ dur: 0.5, vol: 0.1, freq: 260, q: 0.5 });
    },
    optionIn(i) {
      tone({ freq: 494 + i * 110, dur: 0.07, type: 'triangle', vol: 0.12 });
    },
    suspense(sec = 2) {
      const step = 0.07;
      const n = Math.floor(sec / step);
      for (let i = 0; i < n; i++) noise({ dur: 0.05, vol: 0.04 + 0.14 * (i / n), freq: 160 + R() * 90, q: 0.9, delay: i * step });
      tone({ freq: 130, to: 262, dur: sec, type: 'triangle', vol: 0.09, attack: 0.3 });
      for (let k = 0; k < Math.floor(sec / 0.8); k++) api.heartbeat(k * 0.8);
    },
    heartbeat(delay = 0) {
      tone({ freq: 64, to: 44, dur: 0.16, type: 'sine', vol: 0.5, delay });
      tone({ freq: 58, to: 40, dur: 0.16, type: 'sine', vol: 0.34, delay: delay + 0.21 });
    },
    roar(power = 1, sec = 2) {
      // crowd "uuuh" swell: broad noise rising in band + low vowel-ish tones
      noise({ dur: sec, vol: 0.28 * power, freq: 500, to: 1500, q: 0.45, attack: 0.5 });
      noise({ dur: sec * 0.9, vol: 0.18 * power, freq: 1800, q: 0.3, attack: 0.4, delay: 0.05 });
      tone({ freq: 300, to: 420, dur: sec * 0.7, type: 'sine', vol: 0.05 * power, attack: 0.4 });
      swell(0.5 * power, 0.9);
    },
    clapping(sec = 1.6, power = 1) {
      const n = Math.round(30 * sec * power);
      for (let i = 0; i < n; i++) noise({ dur: 0.025 + R() * 0.04, vol: (0.04 + R() * 0.1) * power, freq: 1200 + R() * 3000, q: 1.5, delay: R() * sec });
    },
    correct() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.26, delay: i * 0.08 }));
      tone({ freq: 1568, dur: 0.5, type: 'sine', vol: 0.1, delay: 0.32 });
      api.roar(1, 2.2);
      api.clapping(1.5, 0.8);
    },
    wrong() {
      tone({ freq: 311, to: 300, dur: 0.32, type: 'sawtooth', vol: 0.12 });
      tone({ freq: 294, to: 282, dur: 0.32, type: 'sawtooth', vol: 0.12, delay: 0.36 });
      tone({ freq: 277, to: 190, dur: 0.95, type: 'sawtooth', vol: 0.12, delay: 0.72 });
      // the crowd's "ohhh": falling band
      noise({ dur: 1.4, vol: 0.2, freq: 900, to: 260, q: 0.5, attack: 0.15, delay: 0.1 });
      tone({ freq: 300, to: 200, dur: 1.2, type: 'sine', vol: 0.08, delay: 0.1, attack: 0.15 });
    },
    fifty() {
      tone({ freq: 900, to: 180, dur: 0.22, type: 'square', vol: 0.06 });
      tone({ freq: 700, to: 120, dur: 0.24, type: 'square', vol: 0.05, delay: 0.12 });
      noise({ dur: 0.15, vol: 0.1, freq: 1500, q: 1 });
    },
    crowdAid() {
      noise({ dur: 1.4, vol: 0.2, freq: 600, to: 1400, q: 0.5, attack: 0.4 });
      swell(0.3, 0.8);
    },
    ring(n = 3) {
      for (let k = 0; k < n; k++) {
        tone({ freq: 440, dur: 0.38, type: 'sine', vol: 0.12, delay: k * 1.1 });
        tone({ freq: 480, dur: 0.38, type: 'sine', vol: 0.12, delay: k * 1.1 });
        tone({ freq: 440, dur: 0.38, type: 'sine', vol: 0.12, delay: k * 1.1 + 0.5 });
        tone({ freq: 480, dur: 0.38, type: 'sine', vol: 0.12, delay: k * 1.1 + 0.5 });
      }
    },
    pickup() {
      tone({ freq: 800, to: 500, dur: 0.1, type: 'triangle', vol: 0.18 });
      noise({ dur: 0.06, vol: 0.08, freq: 3000, q: 1 });
    },
    whoosh() {
      noise({ dur: 0.34, vol: 0.18, freq: 500, to: 2600, q: 0.6, attack: 0.15 });
    },
    swap() {
      api.whoosh();
      tone({ freq: 500, to: 900, dur: 0.12, type: 'triangle', vol: 0.12, delay: 0.1 });
    },
    climb(step = 0) {
      tone({ freq: 392 * Math.pow(2, step / 12), dur: 0.12, type: 'triangle', vol: 0.2 });
    },
    milestone() {
      [392, 523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.24, type: 'square', vol: 0.07, delay: i * 0.09 }));
      [523, 659, 784].forEach((f) => tone({ freq: f, dur: 0.9, type: 'triangle', vol: 0.16, delay: 0.5 }));
      api.clapping(2.2, 1);
    },
    million() {
      const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      seq.forEach((f, i) => tone({ freq: f, dur: 0.26, type: 'square', vol: 0.07, delay: i * 0.11 }));
      seq.forEach((f, i) => tone({ freq: f / 2, dur: 0.26, type: 'triangle', vol: 0.2, delay: i * 0.11 }));
      [523, 659, 784, 1047].forEach((f) => tone({ freq: f, dur: 1.8, type: 'triangle', vol: 0.13, delay: 0.95 }));
      api.roar(1.5, 3.4);
      api.clapping(3.4, 1.2);
    },
    ach() {
      [880, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.2, type: 'sine', vol: 0.16, delay: i * 0.08 }));
    },
    tick(urgent) {
      tone({ freq: urgent ? 1500 : 1050, dur: 0.035, type: 'square', vol: urgent ? 0.09 : 0.04 });
    },
    timeup() {
      tone({ freq: 150, dur: 0.8, type: 'sawtooth', vol: 0.2 });
      tone({ freq: 157, dur: 0.8, type: 'square', vol: 0.08 });
    },
    horn() {
      tone({ freq: 330, to: 320, dur: 0.5, type: 'sawtooth', vol: 0.08 });
      tone({ freq: 247, dur: 0.5, type: 'sawtooth', vol: 0.06 });
    },
    dispose() {
      disposed = true;
      clearInterval(schedTimer);
      clearInterval(swellTimer);
      timers.forEach(clearTimeout);
      if (nodes) {
        const t = ac.currentTime;
        try {
          nodes.master.gain.setTargetAtTime(0, t, 0.04);
          const n = nodes;
          setTimeout(() => {
            try {
              n.srcs.forEach((s) => s.stop());
              n.droneOscs.forEach((o) => o.stop());
              n.lfo.stop();
              n.master.disconnect();
            } catch {
              /* already stopped */
            }
          }, 250);
        } catch {
          /* ignore */
        }
      }
      nodes = null;
    },
  };
  // pause when the tab is hidden
  const vis = () => api.setHidden(document.hidden);
  document.addEventListener('visibilitychange', vis);
  const baseDispose = api.dispose;
  api.dispose = () => {
    document.removeEventListener('visibilitychange', vis);
    baseDispose();
  };
  return api;
}
