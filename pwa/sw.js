// Service worker template. The build fills in the cache version and file list (see vite.config.ts).
// Paths are relative to this file, so the game works offline from any subfolder.
const CACHE = 'polybound-__VERSION__';
const FILES = __FILES__;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', ...FILES])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('polybound-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Pages: network first so updates show up, falling back to the cached game offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then(cache => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./', { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Built files have content hashes in their names, so the cached copy is always right
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
    return;
  }

  // Fonts: serve the cached copy and refresh it in the background
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE).then(cache => cache.match(request).then(cached => {
        const fresh = fetch(request).then(response => {
          if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
          return response;
        });
        return cached || fresh;
      }))
    );
  }
});
