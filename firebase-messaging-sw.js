// Share App Service Worker v18
// FIX #2: Bump version on every deploy to force update
const CACHE_VERSION = 'share-v18';

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

// ── FIX #3 + #49: Background push with high priority + deep link ──
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};

  // FIX #49: Build the correct deep link URL based on notification type
  let link = 'https://lewishare.vercel.app';
  if(data.type === 'msg') link = 'https://lewishare.vercel.app/?tab=dms';
  else if(data.type === 'friend') link = 'https://lewishare.vercel.app/?tab=people';
  else if(data.type === 'like' || data.type === 'post') link = 'https://lewishare.vercel.app/?tab=feed';
  else if(data.type === 'story') link = 'https://lewishare.vercel.app/?tab=feed';

  self.registration.showNotification(title || 'Share', {
    body: body || 'You have a new notification',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    // FIX #3: vibrate for urgency
    vibrate: [200, 100, 200, 100, 200],
    tag: `share-${data.type || 'notif'}-${Date.now()}`,
    // FIX #47: Notifications expire after 1 day (in milliseconds)
    timestamp: Date.now(),
    requireInteraction: false,
    data: { link, type: data.type }
  });
});

// FIX #49: Open correct page when notification is tapped
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data?.link || 'https://lewishare.vercel.app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // If app is already open, focus it and navigate
      for (const c of list) {
        if (c.url.includes('lewishare.vercel.app') && 'focus' in c) {
          c.focus();
          // Post message to app to navigate to right tab
          c.postMessage({ type: 'notification-click', link });
          return;
        }
      }
      // App not open — open it with the correct URL
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});

// ── FIX #1 + #2: INSTALL — cache static assets, skip waiting immediately ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        // Don't fail install if some assets don't cache
        console.warn('Cache addAll partial failure:', err);
      });
    })
  );
  // FIX #1: Skip waiting immediately so new SW activates fast
  self.skipWaiting();
});

// ── ACTIVATE — clean old caches, claim all clients ──
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys =>
    Promise.all(
      keys
        .filter(k => k !== CACHE_VERSION)
        .map(k => {
          console.log('Deleting old cache:', k);
          return caches.delete(k);
        })
    )
  ).then(() => {
    // FIX #1: Claim all clients so the new SW takes over immediately
    return self.clients.claim();
  })
));

// ── FETCH — offline support ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Cache-first for navigation — required for offline support
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(cached =>
        cached || fetch(e.request).catch(() => caches.match('/index.html'))
      )
    );
    return;
  }

  // FIX #5: Skip Firebase, Cloudinary and other external requests — never cache these
  const url = e.request.url;
  if (
    url.includes('firestore') ||
    url.includes('firebase') ||
    url.includes('googleapis') ||
    url.includes('gstatic') ||
    url.includes('cloudinary') ||
    url.includes('fonts.google') ||
    url.includes('api/send-push')
  ) return;

  // Network-first for the SW file itself — always get latest
  if (url.includes('firebase-messaging-sw.js')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first with network fallback for everything else
  e.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(response => {
          if (response && response.ok && response.type === 'basic') {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(() => cached || caches.match('/index.html'));
        return cached || networkFetch;
      })
    )
  );
});

// ── BACKGROUND SYNC ──
self.addEventListener('sync', e => {
  if (e.tag === 'background-sync') {
    e.waitUntil(Promise.resolve());
  }
});

// ── PERIODIC SYNC ──
self.addEventListener('periodicsync', e => {
  if (e.tag === 'periodic-sync') {
    e.waitUntil(Promise.resolve());
  }
});

// ── MESSAGE from app (e.g. to skip waiting on update) ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
