// Offline renderer: `node render.mjs [sceneId ...]` -> ../scenes/<id>.png (raw) + json, then encode.py makes webp.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require(require.resolve('playwright', { paths: [process.cwd(), '/usr/lib/node_modules', '/usr/local/lib/node_modules'] })); } })();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.WALDO_OUT || path.join(here, 'out');
fs.mkdirSync(OUT, { recursive: true });
const files = ['core', 'people', 'gen', 'creatures', 'props', 'targets', 'compose'].map((f) => path.join(here, 'art', f + '.js'));
const themeFiles = fs.readdirSync(path.join(here, 'art', 'themes')).filter((f) => f.endsWith('.js')).map((f) => path.join(here, 'art', 'themes', f));
const ids = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--max-old-space-size=4096'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.setContent('<!doctype html><body></body>');
for (const f of [...files, ...themeFiles]) await page.addScriptTag({ path: f });
const all = await page.evaluate(() => Object.keys(WA.THEMES));
const todo = ids.length ? ids : all;
for (const id of todo) {
  const t0 = Date.now();
  const res = await page.evaluate(async (id) => {
    const { canvas, meta } = WA.compose(WA.THEMES[id]);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    return { b64: btoa(s), meta };
  }, id);
  fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(res.b64, 'base64'));
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(res.meta));
  console.log(id, 'done in', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'crowd', res.meta.crowd, 'decoys', res.meta.decoys);
}
await browser.close();
