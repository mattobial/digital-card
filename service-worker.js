/* Minimal offline service worker */
const VERSION = 'v1.0.0';
const CACHE_NAME = `card-cache-${VERSION}`;
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-512.png', '/icons/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only GET
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => {
          // Cache only same-origin
          if (new URL(request.url).origin === self.location.origin) {
            cache.put(request, clone);
          }
        });
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
