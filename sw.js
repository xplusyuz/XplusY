const CACHE_NAME='lm-cache-v2';
  const CORE=['/','/index.html','/icons/icon-192.png','/icons/icon-512.png','/offline.html'];
  self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE))); });
  self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))); });
  self.addEventListener('fetch',e=>{
    const req=e.request;
    if(req.mode==='navigate'){
      e.respondWith((async()=>{ try{ const net=await fetch(req); const cache=await caches.open(CACHE_NAME); cache.put(req,net.clone()); return net; }catch{ const cache=await caches.open(CACHE_NAME); return (await cache.match(req))||cache.match('/offline.html'); } })()); return;
    }
    if(['image','document','iframe'].includes(req.destination)){
      e.respondWith((async()=>{ const cache=await caches.open(CACHE_NAME); const cached=await cache.match(req); const fetchP=fetch(req).then(res=>{ cache.put(req,res.clone()); return res; }).catch(()=>cached); return cached||fetchP; })()); return;
    }
    e.respondWith(caches.match(req).then(res=>res||fetch(req)));
  });