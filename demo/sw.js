const CACHE_NAME = 'imi-portal-v1';
const OFFLINE_URLS = [
  '/demo/',
  '/demo/index.html',
  '/demo/login.html',
  '/demo/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
self.addEventListener('install', e=> self.skipWaiting());