const CACHE_PREFIX = 'sikim-aforo-sw-';
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-static`;
const AFORO_SCOPE = '/disco/aforo-en-directo';
const STATIC_ASSET_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  const isAforoNavigation = request.mode === 'navigate' && url.pathname.startsWith(AFORO_SCOPE);
  const isStaticAsset = STATIC_ASSET_DESTINATIONS.has(request.destination);

  if (isAforoNavigation) {
    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            void caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        });
      }),
    );
  }
});
