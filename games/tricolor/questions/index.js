// Tricolor do Milhão — question bank loader. One file per bank name (see TRICOLOR_COMMON.md):
//   export default [ { id, q, a, c, cat, d, exp, src, when?, ok }, ... ]
// Records are validated (schema.js); malformed / duplicated ones are skipped with console.warn
// and never crash the game. The playable bank is `getBank()`.
import fund from './fund.js';
import hist from './hist.js';
import paul from './paul.js';
import bras from './bras.js';
import lib from './lib.js';
import mundial from './mundial.js';
import copas from './copas.js';
import idolos from './idolos.js';
import tecnicos from './tecnicos.js';
import morumbi from './morumbi.js';
import jogos from './jogos.js';
import recordes from './recordes.js';
import elencos from './elencos.js';
import rivais from './rivais.js';
import cultura from './cultura.js';
import outras from './outras.js';
import extra1 from './extra1.js';
import { validateBank, CATEGORIES, CAT_IDS } from './schema.js';

export { CATEGORIES, CAT_IDS };
export { validateQuestion, validateBank, bankStats, normText } from './schema.js';

export const FILES = { fund, hist, paul, bras, lib, mundial, copas, idolos, tecnicos, morumbi, jogos, recordes, elencos, rivais, cultura, outras, extra1 };
export const NAMES = Object.keys(FILES);

export function rawEntries() {
  return NAMES.map((file) => ({ file, list: FILES[file] }));
}

let cache = null;
/** Validates everything once; returns { valid, errors, warnings, stats }. */
export function validateAll() {
  return validateBank(rawEntries());
}

/** Playable bank (validated records only). Logs a single warning per skipped record. */
export function getBank({ quiet = false } = {}) {
  if (!cache) {
    cache = validateAll();
    if (!quiet && typeof console !== 'undefined')
      for (const e of cache.errors) console.warn(`[tricolor] question skipped ${e.file}#${e.index} (${e.id}): ${e.msgs.join('; ')}`);
  }
  return cache.valid;
}
export function bankStatsNow() {
  getBank({ quiet: true });
  return cache.stats;
}
/** For tests: replace the bank (array of raw records) */
export function _setBankForTests(list) {
  cache = list ? validateBank(list) : null;
}
