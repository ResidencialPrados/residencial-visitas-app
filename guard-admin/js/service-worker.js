const CACHE_NAME = 'guard-admin-v1';
const urlsToCache = [
  'index.html',
  'guard-admin/historial.html',
  'css/theme.css',
  'css/styles-guard-admin.css',
  'js/main-guard-admin.js',
  'js/historial-guard-admin.js',
  'manifest.json',
  // Agrega aquí imágenes o íconos necesarios para historial
];

// Instala el service worker y cachea archivos necesarios
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Archivos cacheados correctamente');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('[SW] Error al cachear durante install', err))
  );
});

// Activa el service worker y limpia cachés viejos si existen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});

// Intercepta fetch para servir archivos cacheados y actualizarlos
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Actualiza en segundo plano
          fetch(event.request)
            .then(networkResponse => {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
              });
            })
            .catch(() => {
              // Sin conexión, no pasa nada
            });
          return cachedResponse; // Devuelve del cache
        }
        // Si no está en caché, trae de red y lo cachea
        return fetch(event.request)
          .then(networkResponse => {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
          .catch(() => caches.match('index.html')); // Fallback si no hay red
      })
  );
});
