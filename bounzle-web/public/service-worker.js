const CACHE_NAME = 'bounzle-v1.0.0';
const urlsToCache = [
  '/',
  '/game',
  '/leaderboard',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-256x256.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Cache each URL individually to prevent one failure from breaking all caching
        return Promise.allSettled(
          urlsToCache.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`Failed to cache ${url}:`, err);
              // Don't throw - allow other resources to cache
              return null;
            })
          )
        ).then((results) => {
          // Log results
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          console.log(`Cache install: ${successful} succeeded, ${failed} failed`);
        });
      })
      .catch((err) => {
        console.error('Cache install failed:', err);
        // Don't fail the install - app should still work
      })
  );
  // Force activation of new service worker
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip service worker entirely for:
  // - Non-GET requests (POST, PUT, DELETE, etc.)
  // - API routes
  // - Non-HTTP/HTTPS protocols
  // - WebSocket connections
  // - Next.js internal routes
  if (request.method !== 'GET' || 
      url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/__nextjs_') ||
      !url.protocol.startsWith('http') ||
      url.protocol === 'ws:' ||
      url.protocol === 'wss:') {
    // Don't intercept - let browser handle it
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Cache hit - return response immediately
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache - fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            // For icons and images, be more lenient with response types
            const isImage = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i);
            const isValidResponse = response && 
              response.status === 200 && 
              (response.type === 'basic' || response.type === 'cors' || (isImage && response.type === 'opaque'));

            if (isValidResponse) {
              // Clone the response because it's a stream and can only be consumed once
              const responseToCache = response.clone();

              // Cache in background - don't wait for it
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                })
                .catch((err) => {
                  // Silently fail caching - don't break the app
                  console.warn('Failed to cache resource:', err);
                });
            }

            // Return the response even if we couldn't cache it
            return response;
          })
          .catch((error) => {
            // Network fetch failed - try cache one more time (might have been cached by another request)
            console.warn('Network fetch failed, checking cache again:', error);
            return caches.match(event.request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // No cache and network failed - return a proper error response
              // This prevents the service worker from breaking, but the browser will handle the error
              return new Response(null, {
                status: 408,
                statusText: 'Request Timeout'
              });
            });
          });
      })
      .catch((error) => {
        // Cache match failed - try network directly
        console.warn('Cache match failed, trying network:', error);
        return fetch(event.request).catch((fetchError) => {
          // Both cache and network failed - return error response
          return new Response(null, {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

