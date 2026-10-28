// Audio self-test: plays a beep, then asks the native Android text-to-speech
// (and the WebView's speechSynthesis) to speak, and reports what happened.
// Used by Settings → "Test sound and voice".

import { audio } from './sfx.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function audioDiagnostics(log, lang = 'it-IT', sample = 'Ciao, come stai?') {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  log(`1) App: ${native ? 'Android (nativo)' : 'navegador'}`);

  // Beep through WebAudio (same path as the app's sound effects).
  try {
    const ac = audio();
    if (!ac) log('2) Bipe: AudioContext indisponível');
    else {
      await ac.resume().catch(() => {});
      const o = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0.35;
      o.frequency.value = 660;
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.5);
      log(`2) Bipe tocado (estado ${ac.state}). Você ouviu um "biiip"?`);
    }
  } catch (e) {
    log('2) Bipe: erro ' + (e && e.message));
  }
  await sleep(1200);

  // Native TTS.
  if (native) {
    try {
      const tts = (cap.Plugins && cap.Plugins.TextToSpeech) || cap.registerPlugin('TextToSpeech');
      let langs = [];
      try {
        const r = await tts.getSupportedLanguages();
        langs = (r && r.languages) || [];
        log(`3) Voz nativa: ${langs.length} idiomas (${langs.slice(0, 12).join(', ')}${langs.length > 12 ? '…' : ''})`);
      } catch (e) {
        log('3) getSupportedLanguages falhou: ' + (e && (e.message || e.code || e)));
      }
      const t0 = performance.now();
      try {
        await tts.speak({ text: sample, lang, rate: 0.92, pitch: 1, volume: 1, category: 'ambient', queueStrategy: 0 });
        log(`4) speak(${lang}) terminou em ${Math.round(performance.now() - t0)} ms. Você ouviu "${sample}"?`);
      } catch (e) {
        log(`4) speak(${lang}) ERRO: ${e && (e.message || e.code || e)}`);
      }
    } catch (e) {
      log('3) Plugin de voz indisponível: ' + (e && (e.message || e)));
    }
  } else {
    log('3) (voz nativa só existe no app Android)');
  }
  await sleep(800);

  // WebView / browser speechSynthesis.
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth) log('5) speechSynthesis: indisponível');
  else {
    let n = 0;
    try {
      n = synth.getVoices().length;
    } catch {
      /* ignore */
    }
    log(`5) speechSynthesis: ${n} vozes`);
    if (n) {
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(sample);
        u.lang = lang;
        u.onend = () => {
          log('6) speechSynthesis terminou');
          resolve();
        };
        u.onerror = (e) => {
          log('6) speechSynthesis ERRO: ' + (e && e.error));
          resolve();
        };
        try {
          synth.speak(u);
        } catch (e) {
          log('6) speechSynthesis exceção: ' + (e && e.message));
          resolve();
        }
        setTimeout(resolve, 6000);
      });
    }
  }
  const evs = (typeof window !== 'undefined' && window.__speechLog) || [];
  log('7) Falas recentes do jogo:' + (evs.length ? '' : ' (nenhuma ainda: abra o Poliglota e toque numa palavra)'));
  evs.slice(-10).forEach((e) => log('   ' + e));
  log('— fim do teste —');
}
