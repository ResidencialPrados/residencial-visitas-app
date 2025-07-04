const CACHE_NAME = 'guard-admin-v2'; // Usa v2 para limpiar caché anterior automáticamente

const urlsToCache = [
  './',
  'index.html',
  'guard-admin/historial.html',
  'css/theme.css',
  'css/styles-guard-admin.css',
  'js/main-guard-admin.js',
  'js/historial-guard-admin.js',
  'manifest.json',
  // Agrega aquí imágenes o íconos si deseas cachearlos
];

// Instalar y cachear archivos iniciales
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

// Activar y eliminar cachés antiguos
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

// Interceptar fetch
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return; // Evita bloquear POST u otros métodos

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Actualizar en segundo plano
          event.waitUntil(
            fetch(event.request)
              .then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse.clone());
                  console.log('[SW] Cache actualizado:', event.request.url);
                });
              })
              .catch(() => {
                console.warn('[SW] Sin conexión para actualizar:', event.request.url);
              })
          );
          return cachedResponse;
        }

        // Si no está en caché, busca en la red
        return fetch(event.request)
          .then(networkResponse => {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              console.log('[SW] Cacheado desde red:', event.request.url);
              return networkResponse;
            });
          })
          .catch(() => {
            // Fallback a index.html solo si es navegación de documento
            if (event.request.mode === 'navigate') {
              return caches.match('index.html');
            }
          });
      })
  );
});
