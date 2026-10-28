// Static game data: teams, cosmetics, career tiers and reward formulas.

// Teams use the flags from js/data/countries.js. `c` is the team colour,
// `p` the price in coins (0 = unlocked from the start), `r` a hidden rating
// used only to simulate CPU-vs-CPU league results.
export const TEAMS = [
  { code: 'BR', c: '#f7d417', p: 0, r: 0.95 },
  { code: 'AR', c: '#6cace4', p: 0, r: 0.95 },
  { code: 'PT', c: '#c8102e', p: 0, r: 0.85 },
  { code: 'ES', c: '#c60b1e', p: 0, r: 0.88 },
  { code: 'MX', c: '#0b7a4b', p: 0, r: 0.7 },
  { code: 'US', c: '#1d3c8f', p: 0, r: 0.7 },
  { code: 'UY', c: '#5cbfeb', p: 150, r: 0.78 },
  { code: 'CO', c: '#fcd116', p: 150, r: 0.75 },
  { code: 'CL', c: '#d52b1e', p: 150, r: 0.68 },
  { code: 'PE', c: '#d91023', p: 150, r: 0.6 },
  { code: 'EC', c: '#ffdd00', p: 150, r: 0.62 },
  { code: 'PY', c: '#c4161c', p: 150, r: 0.6 },
  { code: 'CR', c: '#ce1126', p: 150, r: 0.55 },
  { code: 'JP', c: '#1b2a6b', p: 150, r: 0.72 },
  { code: 'KR', c: '#cd2e3a', p: 150, r: 0.68 },
  { code: 'AU', c: '#ffcd00', p: 150, r: 0.6 },
  { code: 'CA', c: '#d80621', p: 150, r: 0.58 },
  { code: 'MA', c: '#c1272d', p: 150, r: 0.75 },
  { code: 'SN', c: '#00853f', p: 150, r: 0.68 },
  { code: 'GH', c: '#006b3f', p: 150, r: 0.6 },
  { code: 'CM', c: '#007a5e', p: 150, r: 0.6 },
  { code: 'NG', c: '#008751', p: 150, r: 0.65 },
  { code: 'EG', c: '#ce1126', p: 150, r: 0.58 },
  { code: 'CI', c: '#ff8200', p: 150, r: 0.62 },
  { code: 'TN', c: '#e70013', p: 150, r: 0.55 },
  { code: 'SA', c: '#006c35', p: 150, r: 0.52 },
  { code: 'QA', c: '#8a1538', p: 150, r: 0.5 },
  { code: 'IR', c: '#239f40', p: 150, r: 0.55 },
  { code: 'BE', c: '#d4001f', p: 300, r: 0.8 },
  { code: 'NL', c: '#ff7f00', p: 300, r: 0.84 },
  { code: 'HR', c: '#d8232a', p: 300, r: 0.82 },
  { code: 'DK', c: '#c8102e', p: 300, r: 0.72 },
  { code: 'SE', c: '#fecc02', p: 300, r: 0.66 },
  { code: 'CH', c: '#d52b1e', p: 300, r: 0.7 },
  { code: 'PL', c: '#dc143c', p: 300, r: 0.66 },
  { code: 'AT', c: '#ed2939', p: 300, r: 0.66 },
  { code: 'TR', c: '#e30a17', p: 300, r: 0.65 },
  { code: 'IE', c: '#169b62', p: 300, r: 0.58 },
  { code: 'GB-SCT', c: '#0f2a5c', p: 300, r: 0.6 },
  { code: 'GB-WLS', c: '#c8102e', p: 300, r: 0.6 },
  { code: 'RS', c: '#c6363c', p: 300, r: 0.64 },
  { code: 'CZ', c: '#d7141a', p: 300, r: 0.62 },
  { code: 'NO', c: '#ba0c2f', p: 300, r: 0.62 },
  { code: 'GR', c: '#0d5eaf', p: 300, r: 0.58 },
  { code: 'UA', c: '#ffd500', p: 300, r: 0.62 },
  { code: 'FR', c: '#1f3a93', p: 500, r: 0.95 },
  { code: 'DE', c: '#e8e8e8', p: 500, r: 0.9 },
  { code: 'IT', c: '#1f5fbf', p: 500, r: 0.86 },
  { code: 'GB-ENG', c: '#f2f2f2', p: 500, r: 0.88 },
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
