const CACHE_NAME = 'guard-admin-v2'; // Incrementar versión para limpiar cache antiguo

const urlsToCache = [
  './',
  'index.html',
  'guard-admin/historial.html',
  'css/theme.css',
  'css/styles-guard-admin.css',
  'js/main-guard-admin.js',
  'js/historial-guard-admin.js',
  'manifest.json'
];

// Instalar y cachear archivos iniciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos iniciales');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('[SW] Error cacheando en install:', err))
  );
});

// Activar y eliminar caches antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});

// Interceptar fetch
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return; // Ignora POST u otros métodos

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Actualiza cache en segundo plano
          event.waitUntil(
            fetch(event.request)
              .then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse.clone());
                  console.log('[SW] Cache actualizado:', event.request.url);
                });
              })
              .catch(() => {
                console.warn('[SW] Sin conexión, no se actualiza:', event.request.url);
              })
          );
          return cachedResponse;
        }

        // Si no está en cache, obtiene de red y cachea
        return fetch(event.request)
          .then(networkResponse => {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              console.log('[SW] Cacheado desde red:', event.request.url);
              return networkResponse;
            });
          })
          .catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('index.html');
            }
          });
      })
  );
});
