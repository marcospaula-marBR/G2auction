/* Service Worker para PWA instalável, controle de atualização e Web Push Notifications */
const SW_VERSION = 'v3.19.0';

self.addEventListener('install', () => {
  // Não força skipWaiting() automático para permitir sinalização e atualização controlada pela UI
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.caches) {
        const keys = await self.caches.keys();
        await Promise.all(
          keys
            .filter((key) => !key.includes(SW_VERSION))
            .map((key) => self.caches.delete(key))
        );
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Nova Oportunidade no Radar IA',
    body: 'Encontramos um imóvel compatível com os seus critérios.',
    url: '/',
    tag: 'radar-ia-alert',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  const options = {
    body: payload.body,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: payload.tag || 'radar-ia-alert',
    vibrate: [150, 80, 150],
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
