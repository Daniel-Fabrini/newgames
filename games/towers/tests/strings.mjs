// Checks that every t('key') used in the game exists in pt, en and es.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import STRINGS from '../strings.js';
import { TOWERS, TIERS, TRACKS, SENDS, SKINS, RANK_NAMES, FLAG_NAMES } from '../data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = ['main.js', 'render.js', 'meta.js', 'data.js'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
const used = new Set();
for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z_0-9]+)'/g)) used.add(m[1]);
for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z_0-9]+)"/g)) used.add(m[1]);
// dynamic keys
for (const id of Object.keys(TOWERS)) { used.add(TOWERS[id].name); used.add('d_' + id); for (const p of ['A', 'B']) for (const u of TOWERS[id][p]) used.add(u.name); }
for (const tr of TRACKS) used.add(tr.name);
for (const tier of TIERS) used.add(tier.name);
for (const k of Object.values(FLAG_NAMES)) used.add(k);
for (const s of SENDS) used.add('send_' + s.id);
for (const s of Object.values(SKINS)) used.add(s.name);
for (const r of RANK_NAMES) used.add(r);
for (const k of ['first', 'last', 'strong', 'maxed']) used.add(k);
for (const k of ['err_path', 'err_blocked', 'err_occupied', 'err_coins', 'err_locked', 'err_max', 'err_send_locked', 'send_none']) used.add(k);
for (const k of ['st_dmg','st_cd','st_range','st_splash','st_slow','st_chain','st_multi','st_pierce','st_burn','st_shred','st_acid','st_stun','st_buff','st_haste','st_sorte','st_puddle','st_armor','st_tier']) used.add(k);
let missing = 0;
for (const k of used) {
  if (k.endsWith('_')) continue; // dynamic prefix, e.g. 'mode_' + id
  for (const lang of ['pt', 'en', 'es']) {
    if (STRINGS[lang][k] === undefined) { console.log('missing', lang, k); missing++; }
  }
}
console.log(`checked ${used.size} keys, missing ${missing}`);
process.exitCode = missing ? 1 : 0;
