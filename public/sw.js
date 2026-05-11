self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
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
