// very simple SW
self.addEventListener('install', (e)=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ self.clients.claim(); });
self.addEventListener('fetch', ()=>{});
