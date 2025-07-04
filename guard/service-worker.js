const CACHE_NAME = 'guardia-cache-v2';
const ASSETS = [
  '/residencial-visitas-app/guard/index.html',
  '/residencial-visitas-app/guard/js/main-guard.js',
  '/residencial-visitas-app/guard/css/styles-guard.css',
  '/residencial-visitas-app/guard/manifest.json',
  // añade aquí otros recursos estáticos que quieras precachear
];

self.addEventListener('install', event => {
  console.log('[SW] Instalando y precacheando…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activado, limpiando viejas cachés…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // 1) Si es navegación (HTML), devolvemos siempre el index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/residencial-visitas-app/guard/index.html')
        .then(resp => resp || fetch(req))
        .catch(() => caches.match('/residencial-visitas-app/guard/index.html'))
    );
    return;
  }

  // 2) Para todo lo demás (CSS, JS, imágenes, manifest…): red primero, cache si falla
  event.respondWith(
    fetch(req)
      .then(networkRes => {
        // opcional: podrías cachear dinámicamente aquí con cache.put()
        return networkRes;
      })
      .catch(() => caches.match(req))
  );
});
