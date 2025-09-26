/* Subpath-safe SW for GitHub Pages (fixed clone errors) */
const VERSION = 'v1.0.6';
const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, '/') || '/';
const CACHE_NAME = `card-cache-${VERSION}`;

const ASSETS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}styles.css`,
  `${BASE}app.js`,
  `${BASE}qrcode.min.js`,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/favicon.svg`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin || !url.pathname.startsWith(BASE)) return;

  // Stale-while-revalidate, but guard clone() usage
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        // Some responses can't be cloned (opaque/streamed) — skip caching those
        const cachable = resp && resp.ok && (resp.type === 'basic' || resp.type === 'default');
        if (cachable) {
          const copy = resp.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {})
          );
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
