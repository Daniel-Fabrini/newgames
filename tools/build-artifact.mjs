// Copies the app into a folder ready to publish as a multi-file claude.ai
// artifact (a hosted page with a private link):
//   - index page without <html>/<head>/<body> (the host adds its own skeleton)
//   - fonts inlined into app.css as data: URIs (the host only serves fonts that way)
//   - no service worker / manifest (not available inside the viewer)
//
// Usage: node tools/build-artifact.mjs <outDir>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-artifact'));

const INCLUDE = ['css', 'js', 'games', 'assets'];
const SKIP_DIRS = new Set(['node_modules', 'build', 'tools', 'test', 'tests']);
const SKIP_EXT = new Set(['.md', '.txt', '.map', '.mjs', '.cjs', '.csv']);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const files = [];
function copyDir(rel) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) copyDir(r);
      continue;
    }
    if (SKIP_EXT.has(path.extname(entry.name)) || entry.name === 'package.json' || entry.name === 'package-lock.json') continue;
    if (rel.startsWith(path.join('assets', 'icons')) && entry.name.endsWith('.png')) continue;
    fs.mkdirSync(path.join(out, rel), { recursive: true });
    fs.copyFileSync(path.join(root, r), path.join(out, r));
    files.push(r);
  }
}
INCLUDE.forEach(copyDir);

// Inline the fonts.
const cssPath = path.join(out, 'css', 'app.css');
let css = fs.readFileSync(cssPath, 'utf8');
css = css.replace(/url\('\.\.\/assets\/fonts\/([\w.-]+\.woff2)'\)/g, (m, file) => {
  const data = fs.readFileSync(path.join(root, 'assets', 'fonts', file)).toString('base64');
  return `url(data:font/woff2;base64,${data})`;
});
fs.writeFileSync(cssPath, css);
for (const f of fs.readdirSync(path.join(out, 'assets', 'fonts'))) fs.unlinkSync(path.join(out, 'assets', 'fonts', f));

const page = `<title>NewGames</title>
<meta name="theme-color" content="#12142b">
<link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/app.css">
<div id="app"></div>
<script type="module" src="js/main.js"></script>
`;
fs.writeFileSync(path.join(out, 'index.html'), page);

const published = files.filter((f) => !f.startsWith(path.join('assets', 'fonts')));
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(published, null, 2));
const size = published.reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log(`artifact: ${published.length} files, ${(size / 1024 / 1024).toFixed(2)} MB → ${out}`);
