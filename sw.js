// sw.js
const VER = "v1";
const CORE = [
  "/", "/index.html",
  "/router.js"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(VER).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VER).map(k=>caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e)=>{
  const url = new URL(e.request.url);
  // Network-first for partials
  if(url.pathname.includes("/partials/") && url.pathname.endsWith(".html")){
    e.respondWith(
      fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(VER).then(c=>c.put(e.request, copy));
        return res;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }
  // Cache-first for others
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res=>{
      if(res.ok) caches.open(VER).then(c=>c.put(e.request, res.clone()));
      return res;
    }).catch(()=>cached))
  );
});