const CACHE_NAME = 'am-dashboard-v42';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './app.js',
        './manifest.json',
        './icon.svg',
        './icon-192.png',
        './icon-512.png',
        './sfx/access-granted.wav'
      ]);
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode === 'navigate' || req.destination === 'document' || req.destination === 'script' || req.destination === 'style') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(caches.match(req).then(response => response || fetch(req)));
});
