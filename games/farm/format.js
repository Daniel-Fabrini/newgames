// Small formatting helpers. Durations read like 45s, 3m 05s, 1h 20m.
export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${String(r).padStart(2, '0')}s` : `${m}m`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}h ${String(mm).padStart(2, '0')}m` : `${h}h`;
}
