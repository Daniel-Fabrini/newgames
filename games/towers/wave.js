// Wave generation: an endless, deterministic-per-seed plan of enemy groups.
// Each round adds new tiers and flags, and counts grow linearly. Enemy hp
// grows with hpScale() (see data.js), so the game scales forever.

import { FAST, CAMO, REGEN } from './data.js';

// Returns { entries: [{ t, tier, flags }], length } where t is seconds after the round starts.
export function roundPlan(r, rnd = Math.random) {
  const groups = [];
  const add = (tier, n, flags = 0, gap = 0.7) => {
    if (n > 0) groups.push({ tier, n, flags, gap });
  };

  add(0, 5 + Math.floor(r * 0.9));
  if (r >= 3) add(1, 3 + Math.floor(r * 0.45));
  if (r >= 5) add(0, 3 + Math.floor(r * 0.35), FAST, 0.45);
  if (r >= 7) add(2, 2 + Math.floor(r * 0.3));
  if (r >= 9) add(1, 2 + Math.floor(r * 0.25), REGEN, 0.6);
  if (r >= 10) add(3, 1 + Math.floor(r / 9));
  if (r >= 12) add(4, 1 + Math.floor((r - 8) / 8));
  if (r >= 14) add(2, 2 + Math.floor(r * 0.2), CAMO, 0.6);
  if (r >= 17) add(5, 1 + Math.floor((r - 13) / 6));
  if (r >= 22) add(3, 2 + Math.floor((r - 20) / 5), FAST | CAMO, 0.5);
  if (r >= 25) add(5, 2 + Math.floor((r - 25) / 5), FAST | REGEN, 0.5);
  if (r >= 30) add(4, 2 + Math.floor((r - 30) / 6), CAMO | REGEN, 0.7);
  if (r % 10 === 0) add(6, 1 + Math.floor(r / 30), 0, 0);

  const entries = [];
  let t = 0;
  for (const g of groups) {
    for (let i = 0; i < g.n; i++) {
      const jitter = (rnd() - 0.5) * 0.2;
      entries.push({ t: Math.max(0, t + i * g.gap + jitter), tier: g.tier, flags: g.flags });
    }
    t += g.n * g.gap + 1.2;
  }
  return { entries, length: t };
}
