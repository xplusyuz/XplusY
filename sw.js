const CACHE = "orzumall-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./styles.css",
  "./app.js",
  "./login.js",
  "./firebase.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(()=>cached))
  );
});
