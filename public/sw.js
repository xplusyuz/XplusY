/* LeaderMath.UZ Service Worker */
const VERSION = "lm-pwa-v1.0.0";
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.html",
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
  "./assets/js/pwa.js",
  "./content.json",
  "./challenge.json"
];

// Install: pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

function isHTML(req){
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}
function isSameOrigin(url){
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = req.url;

  // Only handle GET
  if (req.method !== "GET") return;

  // Skip cross-origin (CDNs etc.)
  if (!isSameOrigin(url)) return;

  // HTML: network-first (fresh), fallback to cache
  if (isHTML(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
    );
    return;
  }

  // Static assets: cache-first, update in background
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // update quietly
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
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});
