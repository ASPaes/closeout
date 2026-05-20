// ─── Close Out Service Worker ───
// Handles: PWA caching (consumer app) + Push notifications (consumer + waiter)

const CACHE_VERSION = 'closeout-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Domains that must NEVER be cached (APIs, auth, realtime)
const NO_CACHE_DOMAINS = [
  'supabase.co',
  'supabase.com',
  'asaas.com',
  'googleapis.com',
  'accounts.google.com',
  'viacep.com.br',
];

// Extensions worth caching (static assets only)
const CACHEABLE_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.ico',
];

// ─── Install: pre-cache essential assets + activate immediately ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches + claim all clients ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: route requests by type ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (POST, PATCH, DELETE, etc.)
  if (request.method !== 'GET') return;

  // 2. Skip API domains — NEVER cache these
  if (NO_CACHE_DOMAINS.some((domain) => url.hostname.includes(domain))) return;

  // 3. Skip chrome-extension, data URIs, etc.
  if (!url.protocol.startsWith('http')) return;

  // 4. Navigation requests (HTML pages) → network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/app') || caches.match(request))
    );
    return;
  }

  // 5. Static assets → stale-while-revalidate
  const isCacheable = CACHEABLE_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
  if (isCacheable) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // 6. Everything else → network only (don't cache)
});

// ─── Push Notifications ───
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'closeout-' + Date.now(),
    renotify: true,
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Close Out', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
