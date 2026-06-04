// Game Day Manager — Service Worker
// Caches the app shell for full offline use on the sideline

const VERSION = '1.0';
const CACHE = `gdm-v${VERSION}`;

// Everything the app needs to run offline
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Google Fonts — cache on first load
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap',
];

// Install: pre-cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache what we can — fonts may fail on first install if offline
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app shell, network-first for everything else
self.addEventListener('fetch', e => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // App shell + fonts: cache first, fall back to network
  const isShell = url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isShell) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          // Cache successful responses
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => {
          // If completely offline and not cached, return the app shell
          if (url.origin === self.location.origin) {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});

// Let the page ask the SW for the current version
self.addEventListener('message', e => {
  if (e.data === 'GET_VERSION') {
    e.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
