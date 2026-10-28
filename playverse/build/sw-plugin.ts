import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

function listFiles(dir: string, root = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, root));
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

/**
 * Emits `sw.js` with a precache manifest of every file produced by the build plus the
 * files in `public/`. No runtime dependency is needed and the cache name changes
 * whenever the set of hashed files changes, so old caches are purged on activation.
 */
export function serviceWorkerPlugin(): Plugin {
  let publicDir = '';
  return {
    name: 'playverse-service-worker',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((file) => !file.endsWith('.map'));
      const fromPublic = publicDir ? listFiles(publicDir).filter((f) => f !== 'sw.js') : [];
      const files = ['./', ...new Set([...built, ...fromPublic])].sort();
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
      const source = template
        .replace('__PRECACHE_MANIFEST__', JSON.stringify(files))
        .replace('__CACHE_VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
