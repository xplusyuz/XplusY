// LeaderMath Cacheless PWA Service Worker (network-only)
// - Keeps the site installable as a PWA
// - Disables ALL caching (no stale files)
// - Clears any old caches on activate

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
  })());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
