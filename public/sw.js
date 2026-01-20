// LeaderMath Cacheless PWA Service Worker
// Network-only: no runtime caching. Keeps app installable while avoiding stale assets.
// NOTE: Offline mode is intentionally disabled.

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Remove ALL existing caches created by older SW versions
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}

    // Take control of open pages
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  // Pure pass-through to network.
  // This also avoids cache.put() issues with 206 Partial Content / Range requests.
  event.respondWith(fetch(event.request));
});
