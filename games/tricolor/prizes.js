// Prize / safety-point maths for the ladder modes (pure).
import { LADDER, SAFE_STEPS } from './config.js';

/** prize locked in so far when the player is about to answer 1-based `step` and answers WRONG */
export function prizeOnWrong(step, ladder = LADDER, safe = SAFE_STEPS) {
  let best = 0;
  for (const s of safe) if (s < step) best = ladder[s - 1];
  return best;
}
/** prize when the player stops before answering 1-based `step` (keeps the last answered rung) */
export function prizeOnStop(step, ladder = LADDER) {
  return step <= 1 ? 0 : ladder[Math.min(step, ladder.length + 1) - 2];
}
/** prize when `step` is answered correctly */
export const prizeOnRight = (step, ladder = LADDER) => ladder[step - 1];
export const isSafeStep = (step, safe = SAFE_STEPS) => safe.includes(step);
export const lastSafe = (step, safe = SAFE_STEPS) => safe.filter((s) => s < step).pop() || 0;

/** formatted amount: "R$ 1.000.000" (pt/es) or "R$ 1,000,000" (en) */
export function money(n, lang = 'pt') {
  const sep = lang === 'en' ? ',' : '.';
  return 'R$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
