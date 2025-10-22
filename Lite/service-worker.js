/* LeaderMath Service Worker
 * Cache strategies:
 * - App shell (index/admin, manifest, favicon): pre-cache
 * - Navigations (HTML): network-first -> cache fallback (offline)
 * - Firebase/gstatic CDN (JS/CSS): stale-while-revalidate
 * - Images (incl. Firebase Storage): cache-first
 */
const CACHE_VERSION = 'v2025-10-22-01';
const APP_CACHE = `leadermath-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `leadermath-runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.webmanifest',
  './favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![APP_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function isSameOrigin(url) {
  try { return new URL(url, self.location.href).origin === self.location.origin; }
  catch { return false; }
}

function isImageRequest(req) {
  const url = new URL(req.url);
  const ext = url.pathname.split('.').pop().toLowerCase();
  const byExt = ['png','jpg','jpeg','gif','webp','svg','avif','ico'].includes(ext);
  const storageHosts = [
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
    'lh3.googleusercontent.com',
    'xplusy-760fa.firebasestorage.app'
  ];
  const byHost = storageHosts.includes(url.hostname);
  return byExt || byHost || req.destination === 'image';
}

function isCdnAsset(req) {
  const h = new URL(req.url).hostname;
  // firebase & google cdn
  return [
    'www.gstatic.com','gstatic.com','www.googleapis.com',
    'fonts.gstatic.com','fonts.googleapis.com',
    'www.googletagmanager.com','www.google-analytics.com'
  ].some(d => h === d || h.endsWith('.'+d));
}

// Stale-While-Revalidate helper
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  return cached || fetchPromise || new Response('', {status: 504, statusText:'Gateway Timeout'});
}

// Cache-First helper
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (e) {
    return new Response('', {status: 408, statusText:'Offline'});
  }
}

// Network-First helper
async function networkFirst(request, fallbackUrl = './index.html') {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const shell = await caches.match(fallbackUrl);
      if (shell) return shell;
    }
    return new Response('', {status: 408, statusText:'Offline'});
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Navigations (HTML) -> network-first
  if (request.mode === 'navigate' || (request.destination === 'document')) {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  // CDN assets -> stale-while-revalidate
  if (isCdnAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Images (incl Firebase Storage) -> cache-first
  if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Same-origin static (CSS/JS) -> stale-while-revalidate
  if (isSameOrigin(request.url) && ['script','style','font'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default -> network-first
  event.respondWith(networkFirst(request, null));
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});
