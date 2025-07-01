const CACHE_NAME = 'guardia-cache-v1';
const ASSETS = [
  '/control-visitas/guard/',
  '/control-visitas/guard/index.html',
  '/control-visitas/guard/js/main-guard.js',
  '/control-visitas/guard/css/styles-guard.css',
  '/control-visitas/guard/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(res => res || fetch(event.request))
  );
});

