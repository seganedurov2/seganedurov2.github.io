// Service Worker for Emporium — offline cache of shell + assets.
// Registers itself on load and serves cached files when offline.

const CACHE_NAME = 'emporium-v2';
// Paths are resolved against the scope, so the worker also works when the app is
// served from a subpath (e.g. a GitHub Pages project page) instead of the root.
const ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.json',
  './icons.svg'
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS.filter(Boolean)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET requests → network only
  if (request.method !== 'GET') return;

  // API / external → network only
  if (!url.origin.startsWith(location.origin) && url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache only same-origin GET responses that are OK
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigations
        if (request.mode === 'navigate') {
          return caches.match(new URL('./index.html', self.registration.scope).href);
        }
        return new Response('', { status: 408, statusText: 'Offline' });
      })
    })
  );
});
