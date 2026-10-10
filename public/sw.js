// Online-first service worker: clears legacy cekorlebu-* caches and provides a
// pass-through fetch listener so Android Chrome enables native "Install app"
// downloads while installed phones always load the latest live network version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.allSettled(names.filter((n) => n.startsWith('cekorlebu-')).map((n) => caches.delete(n)));
    await self.clients.claim();
  })())
);
self.addEventListener('fetch', () => {
  // Pass-through network requests (online-only mode).
});
