// Share App - Offline Support SW
const CACHE_VERSION = 'share-v9';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot.png'
];

// Install - cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          fetch(url).then(res => { if (res.ok) cache.put(url, res); })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
  ).then(() => self.clients.claim())
));

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firestore') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('gstatic') ||
      e.request.url.includes('cloudinary')) return;

  e.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(response => {
          if (response && response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => cached || caches.match('/index.html'));
        return cached || networkFetch;
      })
    )
  );
});

// Background Sync
self.addEventListener('sync', e => {
  if (e.tag === 'background-sync') {
    e.waitUntil(Promise.resolve());
  }
});

// Periodic Sync
self.addEventListener('periodicsync', e => {
  if (e.tag === 'periodic-sync') {
    e.waitUntil(Promise.resolve());
  }
});
