const CACHE_NAME = 'guard-admin-v1';
const urlsToCache = [
  '.',                // index.html
  'index.html',
  'css/theme.css',
  'css/styles-guard-admin.css',
  'js/main-guard-admin.js',
  'manifest.json',
  // Agrega aquí otras rutas necesarias si tienes imágenes o íconos específicos
];

// Instala el service worker y cachea archivos necesarios
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos cacheados correctamente');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activa el service worker y limpia cachés viejos si existen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});

// Intercepta fetch para servir archivos cacheados cuando sea posible
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna desde cache si está disponible
        if (response) {
          return response;
        }
        // Sino, realiza la petición normalmente
        return fetch(event.request);
      })
  );
});
