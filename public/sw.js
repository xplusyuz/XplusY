/* LeaderMath.UZ Service Worker (Optimal) */
// IMPORTANT: bump VERSION on each deploy so clients refresh caches.
const VERSION = "lm-pwa-v1.0.3-20260120"; // har deployda yangila!
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

function isTestJson(req){
  try{
    const u = new URL(req.url);
    return u.pathname.startsWith("/test/") && u.pathname.toLowerCase().endsWith(".json");
  }catch{ return false; }
}

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

  // Only GET, same-origin
  if (req.method !== "GET") return;
  if (!isSameOrigin(req.url)) return;

  // 1) Critical JSON: NETWORK-ONLY (NO CACHE)
  // - /content.json, /challenge.json (site config)
  // - /test/*.json (test payloads)
  // Reason: caching test JSON leads to "Test topilmadi" after updates.
  if (isNeverCache(req) || isTestJson(req)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => res)
        // offline bo'lsa: oxirgi runtime nusxa (agar bor bo'lsa)
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2) HTML: NETWORK-FIRST (fresh), fallback cache/offline
  if (isHTML(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          event.waitUntil(caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)));
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
            const copy = res.clone();
            return caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }).catch(()=>{})
        );
        return cached;
      }
      return fetch(req).then((res) => {
        const copy = res.clone();
        event.waitUntil(caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)));
        return res;
      });
    })
  );
});
