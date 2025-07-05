// guard-admin/js/service-worker.js

const CACHE_NAME = 'guard-admin-v3'; // sube versión si cambias

const urlsToCache = [
  './',               // equivale a /guard-admin/
  'index.html',
  'pagos.html',
  'historial.html',
  'css/theme.css',
  'css/styles-guard-admin.css',
  'js/main-guard-admin.js',
  'js/pagos.js',
  'js/historial-guard-admin.js',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error('[SW] Install error:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(name => {
        if (name !== CACHE_NAME) return caches.delete(name);
      }))
    )
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        event.waitUntil(
          fetch(event.request)
            .then(resp => caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone())))
            .catch(() => {})
        );
        return cached;
      }
      return fetch(event.request).then(resp =>
        caches.open(CACHE_NAME).then(c => {
          c.put(event.request, resp.clone());
          return resp;
        })
      ).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
