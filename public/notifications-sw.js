// Dedicated Service Worker for push and call notifications.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'New Notification', body: 'You have a new notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            action,
            data: notificationData,
          });
          return;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_CALL_NOTIFICATION') return;

  const { callerName, callType, sessionId } = event.data;

  event.waitUntil(
    self.registration.showNotification(`Incoming ${callType} call`, {
      body: `${callerName} is calling you`,
      icon: '/pwa-192x192.svg',
      badge: '/pwa-192x192.svg',
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      tag: 'incoming-call',
      requireInteraction: true,
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ],
      data: {
        sessionId,
        callType,
        callerName,
      },
    }),
  );
});
