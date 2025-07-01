const CACHE_NAME = 'resident-cache-v1';
const ASSETS = [
  '/control-visitas/resident/',
  '/control-visitas/resident/index.html',
  '/control-visitas/resident/js/main-resident.js',
  '/control-visitas/resident/css/styles-resident.css',
  '/control-visitas/resident/manifest.json'
];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))).then(() => self.skipWaiting())
);

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
);
