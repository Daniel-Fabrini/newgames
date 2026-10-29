// node export.mjs <outdir>  -> writes <outdir>/<id>.json with the collider/element geometry used by the Blender scene
import { makeTable, TABLE_IDS } from '../tables.js';
import fs from 'node:fs';
const out = process.argv[2] || '.';
for (const id of TABLE_IDS) {
  const tb = makeTable(id);
  const o = { id, segs: tb.segs, slings: tb.slings, bumpers: tb.bumpers, posts: tb.posts, flippers: tb.flippers, drops: tb.drops, standups: tb.standups, lanes: tb.lanes, spinner: tb.spinner, ramps: tb.ramps.map((r) => ({ path: r.path, entry: r.entry, exit: r.exit })), inlanes: tb.inlanes, outlanes: tb.outlanes };
  fs.writeFileSync(`${out}/${id}.json`, JSON.stringify(o));
}
