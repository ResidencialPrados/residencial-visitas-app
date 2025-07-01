const CACHE_NAME = 'resident-cache-v1';
const ASSETS = [
  '/control-visitas/resident/',
  '/control-visitas/resident/index.html',
  '/control-visitas/resident/js/main-resident.js',
  '/control-visitas/resident/css/styles-resident.css',
  '/control-visitas/resident/manifest.json'
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
