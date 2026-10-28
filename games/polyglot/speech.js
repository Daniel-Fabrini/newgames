// Text-to-speech and speech recognition wrappers.
// In the browser it uses speechSynthesis. Inside the Android app (Capacitor) the
// WebView has no usable voices, so it uses the native TextToSpeech plugin instead.

import { TTS } from './corpus.js';

export function createSpeech() {
  const synth = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
  const Utter = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null;
  const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  const nativeTTS = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.registerPlugin ? cap.registerPlugin('TextToSpeech') : null;
  let nativeLangs = null; // null = unknown yet (assume available)
  let voices = [];
  const listeners = new Set();
  const chosen = new Map();
  let pendingTimer = null;
  let current = null; // { u, onEnd }
  let rec = null;
  let disposed = false;

  const tag = (v) => String(v.lang || '').replace(/_/g, '-').toLowerCase();
  function load() {
    try {
      voices = synth ? synth.getVoices() || [] : [];
    } catch {
      voices = [];
    }
    chosen.clear();
    listeners.forEach((fn) => fn());
  }
  if (nativeTTS) {
    const norm = (l) => String(l).replace(/_/g, '-').toLowerCase();
    nativeTTS
      .getSupportedLanguages()
      .then((r) => {
        nativeLangs = (r && r.languages ? r.languages : []).map(norm);
        listeners.forEach((fn) => fn());
      })
      .catch(() => {
        nativeLangs = null;
      });
  }
  const nativeHas = (lang) => !!nativeTTS && (nativeLangs === null || nativeLangs.some((t) => t === lang || t.startsWith(lang + '-')));
  if (synth && !nativeTTS) {
    load();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', load);
    else synth.onvoiceschanged = load;
  }

  // Best voice for a course language: right language required; then region, quality hints.
  function voiceFor(lang) {
    if (chosen.has(lang)) return chosen.get(lang);
    const want = TTS[lang].toLowerCase();
    let best = null;
    let bestScore = -1e9;
    for (const v of voices) {
      const tg = tag(v);
      if (!(tg === lang || tg.startsWith(lang + '-'))) continue;
      const name = String(v.name || '');
      let s = 0;
      if (tg === want) s += 6;
      if (lang === 'en' && tg === 'en-gb') s += 3;
      if (lang === 'es' && /es-(mx|us|419)/.test(tg)) s += 3;
      if (/google/i.test(name)) s += 4;
      if (/natural|neural|premium|enhanced|online/i.test(name)) s += 3;
      if (v.localService) s += 2;
      if (v.default) s += 1;
      if (/compact|eloquence|espeak|novelty|whisper|bad news|bells|bubbles|zarvox|trinoids|cellos|organ/i.test(name)) s -= 8;
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    chosen.set(lang, best);
    return best;
  }

  function stop() {
    if (nativeTTS) {
      try {
        nativeTTS.stop();
      } catch {
        /* ignore */
      }
    }
    clearTimeout(pendingTimer);
    pendingTimer = null;
    if (current && current.onEnd) {
      const fn = current.onEnd;
      current = null;
      fn();
    }
    current = null;
    try {
      if (synth && (synth.speaking || synth.pending)) synth.cancel();
    } catch {
      /* ignore */
    }
  }

  // Speaks `text` in course language `lang`. opts: { slow, onStart, onEnd }
  function speakNative(text, lang, opts) {
    if (disposed || !nativeHas(lang)) return false;
    const entry = { onEnd: opts.onEnd };
    stop();
    current = entry;
    const finish = () => {
      if (current === entry) {
        current = null;
        opts.onEnd && opts.onEnd();
      }
    };
    opts.onStart && opts.onStart();
    nativeTTS
      .speak({ text: String(text), lang: TTS[lang], rate: opts.slow ? 0.55 : 0.92, pitch: 1.0, volume: 1.0, category: 'ambient', queueStrategy: 0 })
      .then(finish, finish);
    return true;
  }

  function speak(text, lang, opts = {}) {
    if (nativeTTS) return speakNative(text, lang, opts);
    if (!synth || !Utter || disposed) return false;
    const voice = voiceFor(lang);
    if (!voice) return false;
    stop();
    const u = new Utter(String(text).replace(/ /g, ' '));
    u.lang = voice.lang ? String(voice.lang).replace(/_/g, '-') : TTS[lang];
    u.voice = voice;
    u.rate = opts.slow ? 0.55 : 0.92;
    u.pitch = 1;
    const entry = { u, onEnd: opts.onEnd };
    current = entry;
    u.onstart = () => opts.onStart && opts.onStart();
    const done = () => {
      if (current === entry) {
        current = null;
        opts.onEnd && opts.onEnd();
      }
    };
    u.onend = done;
    u.onerror = done;
    // Chrome sometimes drops an utterance queued right after cancel(): give it a beat.
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (disposed || current !== entry) return;
      try {
        synth.speak(u);
      } catch {
        done();
      }
    }, 40);
    return true;
  }

  // ---------- speech recognition ----------
  // listen(lang, { onPartial(text), onResult([alternatives]), onError(code), onEnd() }) → stop function
  function listen(lang, cb = {}) {
    if (!Recognition) {
      cb.onError && cb.onError('unsupported');
      return () => {};
    }
    stopListening();
    let r;
    try {
      r = new Recognition();
    } catch {
      cb.onError && cb.onError('unsupported');
      return () => {};
    }
    rec = r;
    r.lang = TTS[lang];
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = false;
    let finished = false;
    let gotFinal = false;
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      const altsList = [];
      for (let i = 0; i < res.length; i++) altsList.push(res[i].transcript);
      if (res.isFinal) {
        gotFinal = true;
        cb.onResult && cb.onResult(altsList);
      } else cb.onPartial && cb.onPartial(altsList[0] || '');
    };
    r.onerror = (e) => {
      if (finished) return;
      cb.onError && cb.onError(e.error || 'error');
    };
    r.onend = () => {
      if (finished) return;
      finished = true;
      if (rec === r) rec = null;
      if (!gotFinal) cb.onEnd && cb.onEnd();
    };
    try {
      r.start();
    } catch {
      cb.onError && cb.onError('error');
    }
    return () => {
      finished = true;
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      if (rec === r) rec = null;
    };
  }
  function stopListening() {
    if (!rec) return;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
    rec = null;
  }

  return {
    get supported() {
      return !!nativeTTS || !!(synth && Utter);
    },
    canRecognize: !!Recognition,
    has: (lang) => (nativeTTS ? nativeHas(lang) : !!(synth && Utter && voiceFor(lang))),
    voiceName: (lang) => (nativeTTS ? 'Android' : (voiceFor(lang) || {}).name || ''),
    speak,
    stop,
    listen,
    stopListening,
    onVoices(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispose() {
      disposed = true;
      stop();
      stopListening();
      listeners.clear();
      if (synth) {
        if (synth.removeEventListener) synth.removeEventListener('voiceschanged', load);
        else if (synth.onvoiceschanged === load) synth.onvoiceschanged = null;
      }
    },
  };
}
