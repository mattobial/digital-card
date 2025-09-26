/* Subpath-safe SW for GitHub Pages */
const VERSION = 'v1.0.5';
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
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === location.origin && url.pathname.startsWith(BASE)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(resp => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
          return resp;
        }).catch(()=>cached);
        return cached||fetchPromise;
      })
    );
  }
});
self.addEventListener('message', (event) => {
  if (event.data==='SKIP_WAITING') self.skipWaiting();
});
