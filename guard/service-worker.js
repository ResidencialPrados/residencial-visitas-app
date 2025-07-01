const CACHE_NAME = 'guardia-cache-v2'; // Incrementa versión para actualizar
const ASSETS = [
  '/residencial-visitas-app/guard/',
  '/residencial-visitas-app/guard/index.html',
  '/residencial-visitas-app/guard/js/main-guard.js',
  '/residencial-visitas-app/guard/css/styles-guard.css',
  '/residencial-visitas-app/guard/manifest.json'
];

// Instalar y precachear los archivos
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cacheando archivos');
        return cache.addAll(ASSETS);
      })
      .catch(err => {
        console.error('[Service Worker] Error al cachear:', err);
      })
      .then(() => self.skipWaiting())
  );
});

// Activar y limpiar caches antiguos
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activado');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Interceptar requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedRes => {
        if (cachedRes) return cachedRes;
        return fetch(event.request)
          .catch(err => {
            console.error('[Service Worker] Error en fetch:', err);
          });
      })
  );
});
