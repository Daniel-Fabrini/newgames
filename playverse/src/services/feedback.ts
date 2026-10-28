import { settingsStore } from './settings';

/**
 * Tactile and audio feedback. Both respect the player's settings and fail silently when the
 * platform does not support them. Sounds are synthesised with Web Audio (no audio files).
 */
export type FeedbackKind = 'tap' | 'select' | 'place' | 'move' | 'merge' | 'clear' | 'error' | 'win' | 'lose' | 'hint' | 'undo';

const VIBRATION: Record<FeedbackKind, number | number[]> = {
  tap: 8,
  select: 10,
  place: 14,
  move: 6,
  merge: 18,
  clear: [16, 40, 24],
  error: [30, 50, 30],
  win: [20, 60, 20, 60, 40],
  lose: [60, 80, 60],
  hint: 12,
  undo: 10,
};

type Tone = { freq: number; to?: number; dur: number; type?: OscillatorType; delay?: number; gain?: number };

const SOUNDS: Record<FeedbackKind, Tone[]> = {
  tap: [{ freq: 660, dur: 0.04, type: 'triangle', gain: 0.05 }],
  select: [{ freq: 520, to: 700, dur: 0.06, type: 'triangle', gain: 0.06 }],
  place: [{ freq: 330, to: 260, dur: 0.08, type: 'sine', gain: 0.09 }],
  move: [{ freq: 420, dur: 0.035, type: 'sine', gain: 0.04 }],
  merge: [{ freq: 440, to: 880, dur: 0.09, type: 'triangle', gain: 0.07 }],
  clear: [
    { freq: 523, dur: 0.08, type: 'triangle', gain: 0.07 },
    { freq: 659, dur: 0.08, type: 'triangle', gain: 0.07, delay: 0.07 },
    { freq: 784, dur: 0.12, type: 'triangle', gain: 0.07, delay: 0.14 },
  ],
  error: [{ freq: 200, to: 140, dur: 0.14, type: 'square', gain: 0.035 }],
  win: [
    { freq: 523, dur: 0.12, type: 'triangle', gain: 0.08 },
    { freq: 659, dur: 0.12, type: 'triangle', gain: 0.08, delay: 0.12 },
    { freq: 784, dur: 0.12, type: 'triangle', gain: 0.08, delay: 0.24 },
    { freq: 1047, dur: 0.3, type: 'triangle', gain: 0.08, delay: 0.36 },
  ],
  lose: [
    { freq: 392, dur: 0.16, type: 'sine', gain: 0.08 },
    { freq: 330, dur: 0.16, type: 'sine', gain: 0.08, delay: 0.16 },
    { freq: 262, dur: 0.3, type: 'sine', gain: 0.08, delay: 0.32 },
  ],
  hint: [{ freq: 880, to: 1175, dur: 0.12, type: 'sine', gain: 0.05 }],
  undo: [{ freq: 600, to: 420, dur: 0.07, type: 'sine', gain: 0.05 }],
};

let audioCtx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => undefined);
  return audioCtx;
}

function playSound(kind: FeedbackKind): void {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const tone of SOUNDS[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + (tone.delay ?? 0);
    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.freq, start);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.06, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}

export function supportsVibration(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Plays the sound and vibration for a game event, according to the settings. */
export function feedback(kind: FeedbackKind): void {
  const { sound, haptics } = settingsStore.get();
  if (haptics && supportsVibration()) {
    try {
      navigator.vibrate(VIBRATION[kind]);
    } catch {
      /* ignore */
    }
  }
  if (sound) {
    try {
      playSound(kind);
    } catch {
      /* ignore */
    }
  }
}
