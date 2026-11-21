// Get4Domain service worker: Web Push (dashboard) and a minimal offline shell for the whole site.
//
// What it caches: ONLY the offline page and the icon files in SHELL below, fetched at install. Nothing else is ever put in a cache.
// What it never does: cache or answer an API call, a page, a script or an image from the network. A page (HTML) can depend on flags (V3_PUBLIC_ENABLED), noindex rules, the host
// (main site, directory, a business's own address) or a login, so a page is always fetched from the network and its response (status, headers, redirects) reaches the browser untouched.
// When a page cannot be reached at all, the visitor gets the offline page instead of the browser's error.
const CACHE = 'g4d-shell-v3';
const OFFLINE_URL = '/offline.html';
const SHELL = [OFFLINE_URL, '/icons/app-192.png', '/icons/app-512.png'];

self.addEventListener('install', function (event) {
  // one file at a time: a file that is missing on some host must not stop the worker from installing
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
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
    icon: '/icons/app-192.png',
    badge: '/icons/app-192.png',
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

self.addEventListener('fetch', function (event) {
  const req = event.request;
  const url = new URL(req.url);
  // only same-site GET requests are looked at; a POST, another origin, or anything else goes straight to the network as if there were no worker
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // pages: network only; the offline page appears only when the network itself fails (a 404, a 410 or a redirect is an answer and passes through)
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response('You are offline.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }))));
    return;
  }
  // the shell files (and only those) come from the cache first; every other request is not intercepted at all
  if (SHELL.includes(url.pathname) && url.search === '') {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
