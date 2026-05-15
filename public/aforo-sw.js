const CACHE_PREFIX = 'sikim-aforo-sw-';
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-static`;

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

  if (request.mode === 'navigate') {
    return;
  }

  if (isSafeStaticAsset(url, request)) {
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

function isSafeStaticAsset(url, request) {
  const pathname = url.pathname;

  if (pathname.startsWith('/_next/static/')) {
    return ['script', 'style', 'font'].includes(request.destination);
  }

  if (pathname.startsWith('/branding/') || pathname.startsWith('/disco/aforo-en-directo/branding/')) {
    return request.destination === 'image';
  }

  if (pathname === '/favicon.ico') {
    return true;
  }

  return false;
}
