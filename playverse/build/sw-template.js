/* PlayVerse service worker — generated at build time by build/sw-plugin.ts */
const CACHE_VERSION = '__CACHE_VERSION__';
const PRECACHE = __PRECACHE_MANIFEST__;
const CACHE_NAME = `playverse-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, self.registration.scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('playverse-') && key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Network first for the HTML shell so updates arrive quickly; fall back to the cached shell offline.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(new URL('index.html', self.registration.scope).href).then((hit) => hit || Response.error()),
      ),
    );
    return;
  }

  // Hashed build assets are immutable: cache first, then network (and store the result).
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
