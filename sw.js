/* =============================================================================
   MedicineBank Clinical Workstation — Sovereign Service Worker (PWA)
   Strategy: Stale-While-Revalidate with Precache for 100% Offline Clinical Studying
   ============================================================================= */

const CACHE_NAME = 'medicinebank-v2.9';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './flash.html',
  './flashmake.html',
  './imagetool.html',
  './404.html',
  './manifest.json',
  './css/theme.css',
  './js/supabaseClient.js',
  './js/i18n.js',
  './js/vault.js',
  './js/ankiParser.js',
  './fzstd.min.js',
  './favicon.png',
  './favicon.ico',
  './IMG_3083.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache partial fallback:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Stale-While-Revalidate for app assets and vendor CDNs
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(req);

      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(req, networkResponse.clone());
        }
        return networkResponse;
      }).catch((err) => {
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
