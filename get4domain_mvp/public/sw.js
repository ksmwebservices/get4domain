self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: data.priority === 'URGENT' ? [200, 100, 200, 100, 200] : [100],
    tag: data.tag || 'get4domain',
    data: { url: data.url || '/admin' },
    actions: data.actions || [],
    requireInteraction: data.priority === 'URGENT',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/admin';
  event.waitUntil(
    clients.openWindow(url)
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
