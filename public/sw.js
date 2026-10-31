const CACHE_NAME = 'open-drive-v1';

const APP_SHELL = [
  '/offline',
  // Next.js will cache its own static assets, but we could add root
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude non-GET and Next.js internal requests from custom SW logic
  if (event.request.method !== 'GET' || url.pathname.startsWith('/_next/')) {
    return;
  }

  // Cache-first for /api/thumb/*
  if (url.pathname.startsWith('/api/thumb/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok && networkResponse.status === 200) {
            const cacheControl = networkResponse.headers.get('Cache-Control');
            if (!cacheControl || !cacheControl.includes('no-store')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for /api/folders and /api/drives
  if (url.pathname.startsWith('/api/folders') || url.pathname.startsWith('/api/drives')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok && networkResponse.status === 200) {
            const cacheControl = networkResponse.headers.get('Cache-Control');
            if (!cacheControl || !cacheControl.includes('no-store')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
          }
          return networkResponse;
        }).catch((err) => {
           if (cachedResponse) return cachedResponse;
           throw err;
        });

        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // Network-only for everything else (with offline fallback page for navigation requests)
  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match('/offline');
      }
      return new Response('Network error', { status: 503 });
    })
  );
});
