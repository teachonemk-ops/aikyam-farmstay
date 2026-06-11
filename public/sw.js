// Simple PWA Service Worker
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass-through network requests to prevent caching issues during active development
  e.respondWith(fetch(e.request));
});
