const CACHE_NAME = 'moteros-cache-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/catalogo.html',
    '/admin.html',
    '/pos/tienda-01.html',
    '/pos/tienda-alcala.html',
    '/pos/tienda-jordan.html',
    '/pos/tienda-digital.html',
    '/pos/tienda-eventos.html',
    '/css/pos.css',
    '/css/style.css',
    '/js/config.js',
    '/js/pos.js',
    '/js/offline-db.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/dexie/dist/dexie.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Instale el Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: Cache Open');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Active el Service Worker y limpie caches antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Estrategia de Cache: Network First, falling back to cache
self.addEventListener('fetch', event => {
    // No interceptar peticiones a Supabase (manejo manual en js/offline-db.js)
    if (event.request.url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
