import { CLUBS } from './teams.js';

// Static game data: teams, cosmetics, career tiers and reward formulas.

// Teams use the flags from js/data/countries.js. `p` is the price in coins
// (0 = unlocked from the start), `r` a hidden rating used only to simulate
// CPU-vs-CPU league results and to pick stronger rivals in higher tiers.
// Clubs come first (all unlocked; São Paulo FC is the default); then the national teams.
export const TEAMS = [
  ...CLUBS.map((c) => ({ code: c.code, p: 0, r: c.r, club: true })),
  { code: 'BR', p: 0, r: 0.95 },
  { code: 'AR', p: 0, r: 0.95 },
  { code: 'PT', p: 0, r: 0.85 },
  { code: 'ES', p: 0, r: 0.88 },
  { code: 'MX', p: 0, r: 0.7 },
  { code: 'US', p: 0, r: 0.7 },
  { code: 'UY', p: 150, r: 0.78 },
  { code: 'CO', p: 150, r: 0.75 },
  { code: 'CL', p: 150, r: 0.68 },
  { code: 'PE', p: 150, r: 0.6 },
  { code: 'EC', p: 150, r: 0.62 },
  { code: 'PY', p: 150, r: 0.6 },
  { code: 'CR', p: 150, r: 0.55 },
  { code: 'JP', p: 150, r: 0.72 },
  { code: 'KR', p: 150, r: 0.68 },
  { code: 'AU', p: 150, r: 0.6 },
  { code: 'CA', p: 150, r: 0.58 },
  { code: 'MA', p: 150, r: 0.75 },
  { code: 'SN', p: 150, r: 0.68 },
  { code: 'GH', p: 150, r: 0.6 },
  { code: 'CM', p: 150, r: 0.6 },
  { code: 'NG', p: 150, r: 0.65 },
  { code: 'EG', p: 150, r: 0.58 },
  { code: 'CI', p: 150, r: 0.62 },
  { code: 'TN', p: 150, r: 0.55 },
  { code: 'SA', p: 150, r: 0.52 },
  { code: 'QA', p: 150, r: 0.5 },
  { code: 'IR', p: 150, r: 0.55 },
  { code: 'BE', p: 300, r: 0.8 },
  { code: 'NL', p: 300, r: 0.84 },
  { code: 'HR', p: 300, r: 0.82 },
  { code: 'DK', p: 300, r: 0.72 },
  { code: 'SE', p: 300, r: 0.66 },
  { code: 'CH', p: 300, r: 0.7 },
  { code: 'PL', p: 300, r: 0.66 },
  { code: 'AT', p: 300, r: 0.66 },
  { code: 'TR', p: 300, r: 0.65 },
  { code: 'IE', p: 300, r: 0.58 },
  { code: 'GB-SCT', p: 300, r: 0.6 },
  { code: 'GB-WLS', p: 300, r: 0.6 },
  { code: 'RS', p: 300, r: 0.64 },
  { code: 'CZ', p: 300, r: 0.62 },
  { code: 'NO', p: 300, r: 0.62 },
  { code: 'GR', p: 300, r: 0.58 },
  { code: 'UA', p: 300, r: 0.62 },
  { code: 'FR', p: 500, r: 0.95 },
  { code: 'DE', p: 500, r: 0.9 },
  { code: 'IT', p: 500, r: 0.86 },
  { code: 'GB-ENG', p: 500, r: 0.88 },
];

export const teamByCode = (code) => TEAMS.find((t) => t.code === code) || TEAMS[0];

// Cosmetics. Names live in strings.js under `pitch_<id>`, `ball_<id>`, `rim_<id>`.
export const PITCHES = [
  { id: 'classic', p: 0 },
  { id: 'felt', p: 250 },
  { id: 'night', p: 400 },
  { id: 'sand', p: 500 },
  { id: 'court', p: 600 },
  { id: 'ice', p: 800 },
];
export const BALLS = [
  { id: 'classic', p: 0 },
  { id: 'retro', p: 150 },
  { id: 'rainbow', p: 250 },
  { id: 'neon', p: 350 },
  { id: 'gold', p: 500 },
  { id: 'fire', p: 700 },
];
export const RIMS = [
  { id: 'team', p: 0 },
  { id: 'silver', p: 200 },
  { id: 'carbon', p: 300 },
  { id: 'neon', p: 450 },
  { id: 'gold', p: 600 },
  { id: 'rainbow', p: 800 },
];

// ---------- career ----------
// tier 0..4 = Division 5..1, tier 5 = Champions, tier 6+ = Legend I, II, III…
export const LEAGUE_SIZE = 6; // you + 5 CPU teams, single round robin = 5 rounds
export const CHAMPIONS_TIER = 5;

export function roman(n) {
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let s = '';
  for (const [v, r] of map)
    while (n >= v) {
      s += r;
      n -= v;
    }
  return s;
}

// AI skill grows without limit; the AI module turns it into precision/search depth.
export function tierSkill(tier) {
  if (tier <= CHAMPIONS_TIER) return tier * 0.95;
  return CHAMPIONS_TIER * 0.95 + (tier - CHAMPIONS_TIER) * 0.8;
}
export const tierGoals = (tier) => (tier < 2 ? 2 : 3);

// Visual identity for each tier badge.
export function tierStyle(tier) {
  if (tier >= CHAMPIONS_TIER + 1) return { icon: '👑', color: '#ffd23f', grad: 'linear-gradient(135deg,#ffe27a,#ff9f1c 55%,#ff4f8b)' };
  if (tier === CHAMPIONS_TIER) return { icon: '💎', color: '#b388ff', grad: 'linear-gradient(135deg,#8f5bff,#3d2c8d)' };
  const list = [
    { icon: '🥉', color: '#d08b52', grad: 'linear-gradient(135deg,#c27a45,#6b3a1a)' },
    { icon: '🥈', color: '#c9d1dc', grad: 'linear-gradient(135deg,#9aa6b5,#4b5566)' },
    { icon: '🥇', color: '#ffd23f', grad: 'linear-gradient(135deg,#e2b326,#7a5a00)' },
    { icon: '🏅', color: '#3bceac', grad: 'linear-gradient(135deg,#2bb594,#0d5a4a)' },
    { icon: '🎖️', color: '#5b8cff', grad: 'linear-gradient(135deg,#4d7cff,#1f3a93)' },
  ];
  return list[Math.max(0, tier)];
}

// Career level: XP needed to go from level n to n+1.
export const levelNeed = (n) => 150 + 60 * (n - 1);
export function levelFromXP(xp) {
  let lvl = 1;
  let rest = xp;
  while (rest >= levelNeed(lvl)) {
    rest -= levelNeed(lvl);
    lvl++;
  }
  return { level: lvl, into: rest, need: levelNeed(lvl) };
}

// Quick match difficulty presets (AI skill values).
export const QUICK_SKILL = [0.2, 2.4, 5];
