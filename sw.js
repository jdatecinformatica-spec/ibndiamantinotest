// Service Worker mínimo — permite instalar o app (PWA)
const CACHE = 'ibn-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Rede primeiro; se falhar, tenta cache (páginas principais)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
