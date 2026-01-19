/* LeaderMath.UZ Service Worker (Optimal) */
const VERSION = "lm-pwa-v1.0.2-20260117"; // har deployda yangila!
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// JSON'lar hech qachon precache qilinmaydi!
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./logo.png",
  "./assets/css/style.css",
  "./assets/css/ui.css",
  "./assets/css/app.css",
  "./assets/css/bridge.css",
  "./assets/css/pwa.css",
  "./assets/js/core.js",
  "./assets/js/api.js",
  "./assets/js/auth.js",
  "./assets/js/seasons.js",
  "./assets/js/pwa.js"
];

const NEVER_CACHE_PATHS = new Set([
  "/content.json",
  "/challenge.json"
]);

function isHTML(req){
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}
function isSameOrigin(url){
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
}
function isNeverCache(req){
  const u = new URL(req.url);
  return NEVER_CACHE_PATHS.has(u.pathname);
}

// Install: app shell precache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Allow page to trigger immediate activation
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => {
        if (k !== STATIC_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
      })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Range so'rovlar (video/audio) ko'pincha 206 qaytaradi. 206'ni cache.put qila olmaymiz.
  const hasRange = (() => {
    try { return req.headers && req.headers.has("range"); } catch (_) { return false; }
  })();

  function canCache(res) {
    try {
      if (!res) return false;
      // 200 OK (yoki opaque) bo'lsa cache qilamiz, 206 Partial Content bo'lsa yo'q
      if (res.status === 206) return false;
      if (hasRange) return false;
      // opaque (cross-origin) yoki basic (same-origin) bo'lsa OK
      if (res.type === "opaque") return true;
      if (res.type === "basic") return res.status === 200;
      return res.status === 200;
    } catch (_) {
      return false;
    }
  }

  // Only GET, same-origin
  if (req.method !== "GET") return;
  if (!isSameOrigin(req.url)) return;

  // 1) JSON: NETWORK-ONLY (NO CACHE). Offline bo'lsa: oxirgi runtime nusxa fallback.
  if (isNeverCache(req)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          // ixtiyoriy: offline fallback uchun runtime'ga oxirgi nusxani yozib qo'yamiz
          const copy = res.clone();
          event.waitUntil(
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(()=>{})
          );
          return res;
        })
        .catch(() => caches.match(req)) // offline'da oxirgi bor olingan nusxa
    );
    return;
  }

  // 2) HTML: NETWORK-FIRST (fresh), fallback cache/offline
  if (isHTML(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (canCache(res)) {
            const copy = res.clone();
            event.waitUntil(caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)));
          }
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then((m) => m || caches.match("./index.html"))
            .then((m) => m || caches.match("./offline.html"))
        )
    );
    return;
  }

  // 3) Static assets: CACHE-FIRST + background update (tezlik uchun)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        event.waitUntil(
          fetch(req).then((res) => {
            if (canCache(res)) {
              const copy = res.clone();
              return caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            }
            return;
          }).catch(()=>{})
        );
        return cached;
      }
      return fetch(req).then((res) => {
        if (canCache(res)) {
          const copy = res.clone();
          event.waitUntil(caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      });
    })
  );
});
