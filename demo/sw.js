const CACHE_NAME = 'imi-portal-v1';
const OFFLINE_URLS = [
  '/demo/',
  '/demo/index.html',
  '/demo/login.html',
  '/demo/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // eski keshlarni tozalash (agar kerak bo'lsa)
      const keys = await caches.keys();
      await Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch strategy:
// - Normal fayllar uchun: tarmoqga urinadi, muvaffaqiyatsiz bo'lsa keshga murojaat qiladi.
// - HTML navigatsiyalar (sahifa yuklanishi) uchun: tarmoqdan olinmasa offline index.html qaytariladi.
self.addEventListener('fetch', (event) => {
  // faqat GET so'rovlarini qayta ishlaymiz
  if (event.request.method !== 'GET') return;

  // agar bu navigatsiya bo'lsa (sahifa yuklanishi)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // muvaffaqiyatli javobni qaytaramiz va kerak bo'lsa cache-ga qo'yishni qo'shishingiz mumkin
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          // navigation fallback
          const cached = await cache.match('/demo/index.html') || cache.match('/demo/');
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // boshqa resurslar uchun: tarmoq -> kesh fallback
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        // ixtiyoriy: javobni keshga saqlash (statik resurslar uchun foydali)
        // const respClone = resp.clone();
        // caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
