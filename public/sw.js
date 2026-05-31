/* eslint-disable no-restricted-globals */
/**
 * MGM Atlas service worker.
 *
 * Responsibilities:
 *   - Receive Web Push payloads dispatched by the backend
 *     (PushDispatchService) and surface them as OS notifications.
 *   - Where the browser supports it, attach a `reply` text action so
 *     the user can answer chat mentions inline (Chromium desktop +
 *     Android). When unsupported (Safari, Firefox), the notification
 *     still works — clicks fall through to opening / focusing the tab
 *     with the message input focused (`?focus=input`).
 *   - On click: focus an existing tab if Atlas is already open,
 *     otherwise `clients.openWindow(link)`. The page handles the
 *     postMessage so React Query state survives the focus.
 *   - On inline-reply submit: POST `/api/v1/notifications/:id/quick-reply`
 *     with the typed text. Auth bearer is read from IndexedDB
 *     (the `atlas-auth` DB the page mirrors on login).
 *
 * Wire payload shape (mirrors backend PushPayload):
 *   { title, body, link?, tag?, notificationId?, type?, data? }
 */

const SW_VERSION = 'atlas-sw-2';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Chat notification types that should expose the inline reply ───────
const CHAT_TYPES = new Set(['CHAT_MENTION']);

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = null;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'New notification', body: event.data.text() || '' };
  }

  const title = payload.title || 'MGM Atlas';
  const body = payload.body || '';
  const link = payload.link || '/notifications';
  const tag = payload.tag || (payload.notificationId ? `notif:${payload.notificationId}` : undefined);
  const replyable = Boolean(
    payload.notificationId && payload.type && CHAT_TYPES.has(payload.type),
  );

  const options = {
    body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag,
    renotify: Boolean(tag),
    data: {
      link,
      notificationId: payload.notificationId,
      type: payload.type,
      payload: payload.data,
    },
  };

  if (replyable) {
    // `actions` with `type: 'text'` only renders the inline input on
    // Chromium browsers. Everywhere else the action is silently ignored
    // and the click-anywhere fallback takes over.
    options.actions = [
      { action: 'reply', type: 'text', title: 'Reply', placeholder: 'Type a reply…' },
    ];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const notif = event.notification;
  const data = notif.data || {};
  const link = data.link || '/notifications';
  const notificationId = data.notificationId;

  // Inline-reply submit: send the reply, dismiss the notification,
  // then surface a confirmation on whichever tab is open.
  if (event.action === 'reply' && typeof event.reply === 'string' && notificationId) {
    const text = event.reply.trim();
    notif.close();
    if (!text) return;
    event.waitUntil(submitQuickReply(notificationId, text, link));
    return;
  }

  // Click-anywhere fallback. On non-Chromium browsers we append
  // `?focus=input` so the chat-thread page knows to focus the message
  // composer — closest thing to inline reply on those platforms.
  notif.close();
  const target = data.type && CHAT_TYPES.has(data.type) ? appendFocusInput(link) : link;
  event.waitUntil(focusOrOpen(target, notificationId));
});

self.addEventListener('notificationclose', () => {});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'atlas:sw-version') {
    if (event.ports[0]) event.ports[0].postMessage({ version: SW_VERSION });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────

async function focusOrOpen(link, notificationId) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) {
    const url = new URL(client.url);
    if (url.origin === self.location.origin && 'focus' in client) {
      client.postMessage({ type: 'atlas:notification-click', link, notificationId });
      return client.focus();
    }
  }
  if (self.clients.openWindow) return self.clients.openWindow(link);
  return null;
}

function appendFocusInput(link) {
  try {
    const url = new URL(link, self.location.origin);
    url.searchParams.set('focus', 'input');
    // Preserve hash if any.
    return url.pathname + url.search + url.hash;
  } catch {
    return link;
  }
}

async function submitQuickReply(notificationId, text, link) {
  const sessionId = await readSessionId();
  if (!sessionId) {
    // No session in IDB — fall back to focusing the thread with the
    // input pre-focused so the user can re-send manually.
    return focusOrOpen(appendFocusInput(link), notificationId);
  }
  try {
    const res = await fetch(`/api/v1/notifications/${encodeURIComponent(notificationId)}/quick-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionId}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      // Fall back to opening the thread with input focused so the user
      // can see their reply didn't go through and try again.
      return focusOrOpen(appendFocusInput(link), notificationId);
    }
    // Tell the open Atlas tab (if any) to refresh its chat view so the
    // sent message lands without a polling delay.
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin) {
        client.postMessage({ type: 'atlas:quick-reply-sent', notificationId, link });
      }
    }
  } catch {
    return focusOrOpen(appendFocusInput(link), notificationId);
  }
  return null;
}

async function readSessionId() {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    const req = indexedDB.open('atlas-auth', 1);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('kv', 'readonly');
        const getReq = tx.objectStore('kv').get('sessionId');
        getReq.onsuccess = () => resolve(typeof getReq.result === 'string' ? getReq.result : null);
        getReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}
