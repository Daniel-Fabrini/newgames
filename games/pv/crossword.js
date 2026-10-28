// Crossword (PlayVerse) — thin wrapper, see host.js.
import { mount as mountPv } from './host.js';

export const mount = (root, ctx) => mountPv(root, ctx, 'crossword');
