// DriftScout Service Worker
// Caches the app shell for offline use — API calls always go to network

const CACHE_NAME = 'driftscout-v1';
const SHELL_ASSETS = [
  '/DriftScout/',
  '/DriftScout/index.html',
  '/DriftScout/fishability.css',
  '/DriftScout/manifest.json',
];

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('SW: caching app shell');
        // Use individual adds so one failure doesn't break everything
        return Promise.allSettled(
          SHELL_ASSETS.map(url => cache.add(url).catch(e => console.warn('Cache miss:', url, e)))
        );
      })
      .then(function() { return self.skipWaiting(); })
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => { console.log('SW: deleting old cache', key); return caches.delete(key); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ── Fetch: shell from cache, API always from network ─────────────────────────
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Always fetch from network: API calls, USGS, weather, Anthropic
  const alwaysNetwork = [
    'yakima-proxy.ljlukelj.workers.dev',
    'waterservices.usgs.gov',
    'api.open-meteo.com',
    'api.anthropic.com',
    'fonts.googleapis.com',
    'cdnjs.cloudflare.com',
  ];

  if (alwaysNetwork.some(domain => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Shell assets: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache successful GET responses for shell assets
        if (response.ok && event.request.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() {
        // Offline fallback — return cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/DriftScout/index.html');
        }
      });
    })
  );
});
