const CACHE_VERSION = 'aforo-v1';
const SHELL_CACHE = `sikim-${CACHE_VERSION}`;
const AFORO_SCOPE = '/disco/aforo-en-directo';
const STATIC_ASSET_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll([
        `${AFORO_SCOPE}`,
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
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
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) || (await caches.match(AFORO_SCOPE));
        }),
    );
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
            void caches.open(SHELL_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        });
      }),
    );
  }
});
