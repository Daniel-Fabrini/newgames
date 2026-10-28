import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Build used by DA Games (`npm run build:embed`, or `node tools/build-pv.mjs` from the repo root):
 * relative base, no service worker, no manifest/icons (DA Games owns those), no source maps.
 * Output: ../games/pv/app/ (committed; DA Games has no build step at runtime).
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Drops the PWA-only tags from index.html: the manifest, the icons and the install metadata. */
function stripPwaTags(): Plugin {
  return {
    name: 'strip-pwa-tags',
    transformIndexHtml: (html) =>
      html
        .replace(/\s*<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g, '')
        .replace(/\s*<meta name="(?:apple-mobile-web-app-[a-z-]+|mobile-web-app-capable|description)"[^>]*>/g, '')
        .replace('<title>PlayVerse</title>', '<title>PlayVerse (DA Games)</title>'),
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), stripPwaTags()],
  publicDir: false,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: fileURLToPath(new URL('../games/pv/app', import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
  },
});
