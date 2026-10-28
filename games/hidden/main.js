// "Find Out"-style hidden-object game: cozy, cluttered indoor scenes,
// endless chapters, a magnifier-lens hint. Modes: classic, find-them-all, zen.
// The engine (scene painting, generation, viewer, screens) lives in ./engine
// and is shared with games/findit.

import { createGame } from './engine/app.js';
import STRINGS from './strings.js';
import { THEMES } from './themes.js';

export const HIDDEN_MODES = {
  classic: { kind: 'classic', map: true, label: 'modeClassic', icon: 'lens', offset: 0 },
  findall: { kind: 'findall', map: true, label: 'modeFindall', icon: 'grid', offset: 3 },
  zen: { kind: 'classic', zen: true, label: 'modeZen', icon: 'leaf', offset: 6 },
};

export async function mount(root, ctx) {
  return createGame(root, ctx, {
    id: 'hidden',
    look: 'indoor',
    hint: 'lens',
    strings: STRINGS,
    themes: THEMES,
    modes: HIDDEN_MODES,
    defaultMode: 'classic',
  });
}
