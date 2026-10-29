import STRINGS from './strings.js';
import { createTableScreen } from './ui/tablescreen.js';
import { createSound } from './ui/sound.js';
import { createCashSession } from './ui/cash.js';
import { makeProfile } from './ai/profiles.js';
import { randomSeed } from './engine/rng.js';

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('./style.css', import.meta.url));
  const t = ctx.makeT(STRINGS);
  const prefsData = ctx.store.get('prefs', {}) || {};
  const prefs = {
    get: (k) => prefsData[k],
    set: (k, v) => {
      prefsData[k] = v;
      ctx.store.set('prefs', prefsData);
    },
  };
  root.dataset.theme = 'emerald';
  const sound = createSound(ctx, prefs);
  const ts = createTableScreen(root, { ctx, t, lang: ctx.lang, prefs, sound });
  const hero = { id: 'hero', name: 'Você', avatar: 'p1' };
  const opps = ['shark', 'wall', 'rookie', 'trickster', 'professor'].map((a, i) => ({ id: 'o' + i, name: ['Nova', 'Bruno', 'Kai', 'Lia', 'Dr. Hugo'][i], avatar: 'p' + (i + 2), profile: makeProfile(a) }));
  const sess = createCashSession({ hero, opps, seed: randomSeed(), labels: { blinds: 'Blinds', stack: 'Stack', net: 'Net', hand: 'Mão' } });
  ts.run(sess);
  return () => ts.destroy();
}
