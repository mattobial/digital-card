/* Subpath-safe offline service worker for GitHub Pages */
const VERSION = 'v1.0.3';            // bump to invalidate old caches
const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, '/') || '/';
const CACHE_NAME = `card-cache-${VERSION}`;

const ASSETS = [
  `${BASE}`,                         // e.g. /digital-card/
  `${BASE}index.html`,
  `${BASE}styles.css`,
  `${BASE}app.js`,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/favicon.svg`
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
  if (request.method !== 'GET') return;

  // If request is same-origin and path matches our BASE, use cache-first
  const url = new URL(request.url);
  const sameOrigin = url.origin === location.origin;

  if (sameOrigin && url.pathname.startsWith(BASE)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
