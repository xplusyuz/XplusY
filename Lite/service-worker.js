const CACHE='lm-fb-v3_6';
const CORE=['./','./index.html','./index.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./favicon.ico'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))); self.skipWaiting();});
self.addEventListener('activate',e=>{self.clients&&self.clients.claim&&self.clients.claim(); e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE&&caches.delete(k)))))});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url); if(url.origin===location.origin){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{caches.open(CACHE).then(c=>c.put(e.request,res.clone()));return res}).catch(()=>caches.match('./index.html'))));}});