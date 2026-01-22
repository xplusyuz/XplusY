/* LeaderMath.UZ — cacheless Service Worker (prevents 206/Range cache errors) */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// No runtime caching: just proxy network (PWA works without caching issues)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
