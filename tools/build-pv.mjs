// Builds the vendored PlayVerse source (playverse/) in embed mode into games/pv/app/.
//
//   node tools/build-pv.mjs          (needs `cd playverse && npm ci` once)
//
// Relative base, no service worker, no source maps. The output is committed:
// DA Games has no build step at runtime, and tools/build-android-web.mjs copies
// games/pv/app/ into the APK like any other game folder.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pv = path.join(root, 'playverse');
const out = path.join(root, 'games', 'pv', 'app');

if (!fs.existsSync(path.join(pv, 'node_modules'))) {
  console.error('playverse/node_modules is missing: run `cd playverse && npm ci` first.');
  process.exit(1);
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: pv, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npx', ['tsc', '-b']);
run('npx', ['vite', 'build', '--config', 'vite.embed.config.ts']);

let files = 0;
let bytes = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      files++;
      bytes += fs.statSync(p).size;
    }
  }
})(out);
console.log(`games/pv/app: ${files} files, ${(bytes / 1024).toFixed(0)} KB`);
