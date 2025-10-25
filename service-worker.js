// ====== Service Worker (safe caching) ======
const VERSION = 'v4'; // o'zgartirsangiz, eski keshlar tozalanadi
const STATIC_CACHE = `static-${VERSION}`;

const STATIC_ASSETS = [
  '/',                // agar SPA bo'lsa kerak
  '/index.html',      // mavjud bo'lsa
  '/favicon.ico',
  '/manifest.webmanifest',
  // boshqa local (same-origin) fayllaringizni qo'shing:
  // '/lib/firebase.client.js', '/styles.css', ...
];

// --- install: precache local fayllar
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    try {
      await cache.addAll(STATIC_ASSETS);
    } catch (e) {
      // Ba'zi fayllar yo'q bo'lsa ham installdan yiqilmasin
      // console.warn('Precache warning', e);
    }
  })());
  self.skipWaiting();
});

// --- activate: eski keshlarni o'chirish
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k.startsWith('static-') && k !== STATIC_CACHE) ? caches.delete(k) : null)
    );
    // ixtiyoriy: navigation preload
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
  })());
  self.clients.claim();
});

// --- helper: faqat keshlashga yaroqli javobmi?
function canCache(request, response) {
  // Faqat GET, same-origin va 'basic' (no-cors emas) bo'lsa keshlaymiz
  const sameOrigin = new URL(request.url).origin === self.location.origin;
  return (
    request.method === 'GET' &&
    sameOrigin &&
    response &&
    response.ok &&
    response.type === 'basic'
  );
}

// --- fetch: HTML uchun network-first, staticlar uchun cache-first
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Faqat GET so'rovlarni boshqaramiz
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  // Cross-origin (CDN, Google, Firebase va h.k.) — keshlamaymiz, to'g'ridan-to'g'ri yuboramiz
  if (!sameOrigin) return;

  // HTML sahifalar: network-first
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const netRes = await fetch(request);
        // HTML ham 'basic' bo'lsa keshlash mumkin
        if (canCache(request, netRes)) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, netRes.clone());
        }
        return netRes;
      } catch {
        // oflayn – keshdan
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request) || await cache.match('/index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Boshqa static assetlar (JS/CSS/rasm): cache-first
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const netRes = await fetch(request);
      if (canCache(request, netRes)) {
        try { await cache.put(request, netRes.clone()); } catch (e) { /* yutib yuboramiz */ }
      }
      return netRes;
    } catch {
      // oflayn va keshda yo'q
      return Response.error();
    }
  })());
});
