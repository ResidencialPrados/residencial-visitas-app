
const CACHE_NAME = 'visitas-cache-v1';
const assetsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/main.js',
  '/manifest.json'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(assetsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request)
      .then(res => res || fetch(evt.request))
  );
});
