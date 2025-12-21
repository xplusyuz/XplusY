self.addEventListener('install', (e)=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });

const CORE = ['/login.html','/index.html','/admin.html','/api-client.js','/auth-client.js','/manifest.webmanifest'];

self.addEventListener('fetch', (event)=>{
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  event.respondWith((async ()=>{
    const cache = await caches.open('leadermath-core-v1');
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try{
      const res = await fetch(event.request);
      if (event.request.method==='GET' && CORE.includes(url.pathname)) cache.put(event.request, res.clone());
      return res;
    }catch(e){
      const fallback = await cache.match('/index.html');
      return fallback || new Response('Offline', {status:503});
    }
  })());
});
