/* eslint-disable no-restricted-globals */
/**
 * MGM Atlas service worker.
 *
 * Responsibilities (Phase 3):
 *   - Receive Web Push payloads dispatched by the backend
 *     (PushDispatchService) and surface them as OS notifications.
 *   - On click: focus an existing tab if Atlas is already open, otherwise
 *     open a new one at the notification's `link` (or `/notifications`
 *     as the fallback inbox).
 *   - Versioned skipWaiting/clients.claim so SW updates take effect on
 *     the next page load without requiring a manual reload.
 *
 * Phase 5 will add the `actions: [{action: 'reply', type: 'text'}]`
 * inline reply where the browser supports it.
 *
 * Wire payload shape (mirrors backend PushPayload):
 *   { title, body, link?, tag?, notificationId?, type?, data? }
 */

const SW_VERSION = 'atlas-sw-1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = null;
  try {
    payload = event.data.json();
  } catch {
    // Backend always sends JSON; if it didn't, fall back to a generic banner
    // rather than dropping the notification silently.
    payload = { title: 'New notification', body: event.data.text() || '' };
  }

  const title = payload.title || 'MGM Atlas';
  const body = payload.body || '';
  const link = payload.link || '/notifications';
  const tag = payload.tag || (payload.notificationId ? `notif:${payload.notificationId}` : undefined);

  const options = {
    body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag,
    // renotify=true on the same tag means a new message in the same
    // chat/task vibrates/sounds again instead of silently replacing.
    renotify: Boolean(tag),
    data: {
      link,
      notificationId: payload.notificationId,
      type: payload.type,
      payload: payload.data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = (event.notification.data && event.notification.data.link) || '/notifications';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Prefer focusing an existing Atlas tab. Match by origin so we
        // don't try to navigate someone's banking tab.
        for (const client of clientList) {
          const url = new URL(client.url);
          if (url.origin === self.location.origin && 'focus' in client) {
            // postMessage so the open page can route to the right place
            // without doing a hard navigation that loses local state.
            client.postMessage({
              type: 'atlas:notification-click',
              link,
              notificationId: event.notification.data && event.notification.data.notificationId,
            });
            return client.focus();
          }
        }
        // No existing Atlas tab — open one at the link target.
        if (self.clients.openWindow) {
          return self.clients.openWindow(link);
        }
        return null;
      }),
  );
});

// Optional: keep a hook for Phase 5 inline reply + future telemetry.
self.addEventListener('notificationclose', () => {
  // intentionally empty for Phase 3
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'atlas:sw-version') {
    event.ports[0] && event.ports[0].postMessage({ version: SW_VERSION });
  }
});
