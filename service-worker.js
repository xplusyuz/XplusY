// Lightweight SW: install + activate only, no fetch listener to avoid console warning.
// If you want caching, add a proper fetch handler; leaving it out keeps navigation fast.
self.addEventListener('install', (e)=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ self.clients.claim(); });
