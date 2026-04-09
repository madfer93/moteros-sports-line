const CACHE_NAME = 'moteros-cache-v3';
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
    const url = new URL(event.request.url);

    // No interceptar peticiones no-HTTP (como WebSockets ws:// o extensiones)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // No interceptar peticiones a Supabase ni a APIs externas como ipapi
    if (url.hostname.includes('supabase.co') || url.hostname.includes('ipapi.co')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request).then(response => {
                    // Retorna de caché si existe, si no, un error limpio en vez de undefined
                    return response || Response.error();
                });
            })
    );
});
