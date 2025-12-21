self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

const CORE = [
  '/index.html','/login.html','/api-utils.js','/auth-utils.js','/manifest.webmanifest'
];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Do not cache API
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  event.respondWith((async () => {
    const cache = await caches.open('leadermath-core-v1');
    const cached = await cache.match(event.request);
    if (cached) return cached;

    try {
      const res = await fetch(event.request);
      if (event.request.method === 'GET' && CORE.includes(url.pathname)) {
        cache.put(event.request, res.clone());
      }
      return res;
    } catch (e) {
      // offline fallback
      if (url.pathname.endsWith('.html')) {
        const fallback = await cache.match('/index.html');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});
