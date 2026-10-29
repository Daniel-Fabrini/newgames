// Tricolor do Milhão — single configuration file (ladder, safety points, modes, lifelines, themes).
// Virtual money only.

export const LADDER = [100, 200, 300, 500, 1000, 2000, 5000, 10000, 20000, 40000, 80000, 150000, 300000, 500000, 1000000];
// 1-based ladder steps that lock a prize when answered correctly (R$ 1.000 and R$ 40.000)
export const SAFE_STEPS = [5, 10];

// difficulty by 1-based step: 1–4 → d1, 5–8 → d2, 9–12 → d3, 13–15 → d4
export const mainDiff = (step) => (step <= 4 ? 1 : step <= 8 ? 2 : step <= 12 ? 3 : 4);
// expert: only d3–d4
export const expertDiff = (step) => (step <= 7 ? 3 : 4);
// 10-question ramp used by quick / themes / daily
const RAMP10 = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4];
export const rampDiff = (step) => RAMP10[Math.min(step, 10) - 1] || 4;
// time attack adapts to what the player has got right so far
export const timeDiff = (step, st) => Math.min(4, 1 + Math.floor((st.correct || 0) / 4));

export const TIME_ATTACK = { seconds: 90, wrongPenalty: 8, streakBonusEvery: 5, streakBonus: 5 };
export const QUICK_TIMERS = [0, 20, 30]; // seconds per question (0 = no timer)

export const LIFELINES = ['fifty', 'crowd', 'phone', 'swap'];

// ladder:true → prize ladder with safety points; otherwise points score.
export const MODES = {
  main: { id: 'main', total: 15, ladder: true, diff: mainDiff, lifelines: { fifty: 1, crowd: 1, phone: 1, swap: 1 }, maxPerCat: 3 },
  quick: { id: 'quick', total: 10, ladder: false, diff: rampDiff, lifelines: { fifty: 1, crowd: 0, phone: 0, swap: 1 }, maxPerCat: 3 },
  themes: { id: 'themes', total: 10, ladder: false, diff: rampDiff, lifelines: { fifty: 1, crowd: 0, phone: 0, swap: 1 }, maxPerCat: 10 },
  time: { id: 'time', total: null, ladder: false, diff: timeDiff, lifelines: { fifty: 0, crowd: 0, phone: 0, swap: 0 }, maxPerCat: 4 },
  daily: { id: 'daily', total: 10, ladder: false, diff: rampDiff, lifelines: { fifty: 0, crowd: 0, phone: 0, swap: 0 }, maxPerCat: 3 },
  expert: { id: 'expert', total: 15, ladder: true, diff: expertDiff, lifelines: { fifty: 1, crowd: 0, phone: 0, swap: 1 }, maxPerCat: 3 },
};
export const MODE_IDS = Object.keys(MODES);

// Points for non-ladder modes
export const pointsFor = (d, speedBonus = 0, streak = 0) => 100 + 50 * (d - 1) + speedBonus + Math.min(streak, 10) * 10;

// Seen-question ring buffer
export const RECENT_MAX = 300;
export const recentLimit = (bankSize) => Math.max(0, Math.min(RECENT_MAX, Math.floor(bankSize * 0.6)));

// The 8 themes of the "Temas das perguntas" grid → 16 bank categories
export const THEMES = [
  { id: 'clube', icon: 'shield', cats: ['fund', 'hist'] },
  { id: 'titulos', icon: 'cup', cats: ['paul', 'bras', 'lib', 'mundial', 'copas'] },
  { id: 'lendas', icon: 'shirt', cats: ['idolos', 'recordes'] },
  { id: 'tecnicos', icon: 'coach', cats: ['tecnicos'] },
  { id: 'morumbi', icon: 'stadium', cats: ['morumbi'] },
  { id: 'rivais', icon: 'swords', cats: ['rivais'] },
  { id: 'curiosidades', icon: 'bulb', cats: ['cultura', 'outras'] },
  { id: 'momentos', icon: 'star', cats: ['jogos', 'elencos'] },
];
export const themeOfCat = (cat) => THEMES.find((t) => t.cats.includes(cat))?.id || null;

export const MIN_BANK_TO_PLAY = 15;
export const MASTERY = { theme: 10, lib: 20, morumbi: 15, memory: 50 };
