// Retires the old caching worker so installed phones always load the latest app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.filter((n) => n.startsWith('cekorlebu-')).map((n) => caches.delete(n)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(clients.map((c) => c.navigate(c.url)));
    } finally {
      await self.registration.unregister();
    }
  })())
);
