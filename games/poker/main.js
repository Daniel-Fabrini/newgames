// Poker World Tour — Texas Hold'em No-Limit with a career mode (UI shell).
// Engine/AI/tournaments/career live in engine/, ai/, tournament/, career/; all UI lives in ui/.
import STRINGS from './strings.js';
import { createApp } from './ui/app.js';

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  root.classList.add('g-poker');
  const app = createApp(root, ctx, STRINGS);
  try { if (localStorage.getItem('ng:poker:__debug')) window.__pk = app; } catch (e) { /* ignore */ }
  app.start();
  return () => app.destroy();
}
