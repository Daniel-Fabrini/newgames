// "Caça-Objetos": a classic hidden-object game played on photorealistic
// scenes (rendered offline in Blender from CC0 Poly Haven assets, see
// build3d/). Cosy interiors and outdoor places alternate as chapters; every
// level picks a different set of objects and the places come back harder.
// Modes: classic, match (find both copies) and a daily challenge.

import { createGame } from './engine/app.js';
import STRINGS from './strings.js';
import { SCENES } from './scenes/index.js';

const MODES = {
  classic: { kind: 'classic', map: true, label: 'modeClassic', icon: 'lens', offset: 0 },
  match: { kind: 'match', map: true, label: 'modeMatch', icon: 'pairs', offset: 3 },
  daily: { kind: 'classic', daily: true, label: 'modeDaily', icon: 'calendar' },
};

export async function mount(root, ctx) {
  return createGame(root, ctx, {
    id: 'findit',
    strings: STRINGS,
    scenes: SCENES,
    modes: MODES,
    defaultMode: 'classic',
    css: new URL('./style.css', import.meta.url),
  });
}
