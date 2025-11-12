// sw.js (safe pre-cache + offline fallback)
const VER = 'lm-v3';
const OFFLINE_URL = '/offline.html';

// Keshga qo'shish istalgan aktiv assetlar
const CANDIDATES = [
  '/',           // agar admin sahifasi ildizda bo'lsa
  '/index.html', // bo'lsa
  '/admin.html', // admin sahifangiz
  '/manifest.webmanifest', // bo'lsa
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  OFFLINE_URL
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VER);
    // Faqat muvaffaqiyatli javob berganlarini kiritamiz
    const okUrls = [];
    for (const url of CANDIDATES) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res && res.ok) {
          await cache.put(url, res.clone());
          okUrls.push(url);
        }
      } catch (_) { /* yutib yuboramiz — noto‘g‘ri URL kirmaydi */ }
    }
    // OFFLINE sahifa keshda bo'lishi shart
    if (!okUrls.includes(OFFLINE_URL)) {
      const resp = new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1><p>Internet yo‘q. Keyinroq urinib ko‘ring.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }});
      await cache.put(OFFLINE_URL, resp);
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === VER ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

// Navigatsiya so'rovlari: network-first, offline bo'lsa cache yoki OFFLINE
self.addEventListener('fetch', event => {
  const req = event.request;

  // Faqat navigatsiya (HTML) uchun offline fallback
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // muvaffaqiyatli sahifalarni fonida keshga qo'yamiz
        const cache = await caches.open(VER);
        cache.put(req.url, fresh.clone()).catch(()=>{});
        return fresh;
      } catch (e) {
        const cache = await caches.open(VER);
        const cached = await cache.match(req) || await cache.match(OFFLINE_URL);
        return cached;
      }
    })());
    return;
  }

  // Boshqa resurslar uchun: cache-first, so‘ng network
  event.respondWith((async () => {
    const cache = await caches.open(VER);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && (req.method === 'GET')) {
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    } catch (e) {
      return new Response('', { status: 502 });
    }
  })());
});
