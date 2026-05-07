// Share App Service Worker v8
const CACHE_VERSION = 'share-v8';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot.png'
];

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:"AIzaSyBQaBmm1Ydr8rx2KWop8cQrOn4n30hAixQ",
  authDomain:"lewi-b41e7.firebaseapp.com",
  projectId:"lewi-b41e7",
  storageBucket:"lewi-b41e7.firebasestorage.app",
  messagingSenderId:"411640151338",
  appId:"1:411640151338:web:21b6e8e059b20d69163253"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Share', {
    body: body || 'You have a new notification',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'share-notif'
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('lewshare.vercel.app') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('https://lewshare.vercel.app');
    })
  );
});

// Install - cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - clear old caches
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
      e.request.url.includes('googleapis')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

// Background Sync
self.addEventListener('sync', e => {
  if (e.tag === 'background-sync') {
    e.waitUntil(Promise.resolve());
  }
});
