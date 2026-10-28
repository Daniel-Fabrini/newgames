// "Find It Out"-style hidden-object game: huge outdoor panoramas (harbor,
// beach, city, park, market, ski resort…), spotlight hints. Modes: classic,
// match (pairs) and a daily challenge. Shares the engine of games/hidden.

import { createGame } from '../hidden/engine/app.js';
import STRINGS from './strings.js';
import { THEMES } from './themes.js';

const MODES = {
  classic: { kind: 'classic', map: true, label: 'modeClassic', icon: 'lens', offset: 0 },
  match: { kind: 'match', map: true, label: 'modeMatch', icon: 'pairs', offset: 4 },
  daily: { kind: 'classic', daily: true, label: 'modeDaily', icon: 'calendar' },
};

export async function mount(root, ctx) {
  return createGame(root, ctx, {
    id: 'findit',
    look: 'outdoor',
    hint: 'spot',
    strings: STRINGS,
    themes: THEMES,
    modes: MODES,
    defaultMode: 'classic',
    extraTip: 'tipPan',
    css: new URL('./style.css', import.meta.url),
  });
}
