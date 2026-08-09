// Get4Domain service worker — Web Push (VAPID) + basic offline fallback.
const CACHE = 'g4d-v1';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icon-192.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('push', function (event) {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: data.priority === 'URGENT' ? [200, 100, 200, 100, 200] : [100],
    tag: data.tag || 'get4domain',
    data: { url: data.url || '/dashboard' },
    actions: data.actions || [],
    requireInteraction: data.priority === 'URGENT',
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.openWindow(url));
});

// Network-first for navigations, falling back to the offline page when offline.
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response('Offline', { status: 503 }))),
    );
    return;
  }
  // Other requests: try network, fall back to cache if present.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
