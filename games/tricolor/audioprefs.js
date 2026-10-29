// Pure audio preference helpers (sliders/toggles per channel + global mute).
export const CHANNELS = ['music', 'fx', 'amb'];
export const DEFAULT_PREFS = { mute: false, music: 0.55, fx: 0.85, amb: 0.5, on: { music: true, fx: true, amb: true } };
const clamp01 = (n, d) => (typeof n === 'number' && isFinite(n) ? Math.min(1, Math.max(0, n)) : d);
export function sanitizePrefs(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = { mute: !!r.mute, on: {} };
  for (const c of CHANNELS) {
    out[c] = clamp01(r[c], DEFAULT_PREFS[c]);
    out.on[c] = r.on && typeof r.on[c] === 'boolean' ? r.on[c] : true;
  }
  return out;
}
/** effective gain (0..1) of a channel, considering the global mute and the app's own mute */
export const channelGain = (prefs, ch, appMuted = false) => (prefs.mute || appMuted || !prefs.on[ch] ? 0 : prefs[ch]);
