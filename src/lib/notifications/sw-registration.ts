'use client';

/**
 * Service worker registration + the bridge channel that lets the SW
 * tell open pages "user clicked a notification, focus this link."
 *
 * Registration is best-effort: if the browser doesn't support service
 * workers (private mode in some browsers, certain embedded webviews)
 * we just no-op and the rest of the app continues unaffected — push
 * silently degrades to in-app delivery only.
 */

const SW_URL = '/sw.js';

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Registers /sw.js at scope `/`. Idempotent — repeated calls return the
 * same promise, so it's safe to call from any layout/component.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (registrationPromise) return registrationPromise;
  registrationPromise = navigator.serviceWorker
    .register(SW_URL, { scope: '/' })
    .then((reg) => reg)
    .catch((err) => {
      console.warn('[atlas] service worker registration failed:', err);
      return null;
    });
  return registrationPromise;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? null;
}

/**
 * Subscribe to the SW's notification-click channel. The SW posts
 * `{ type: 'atlas:notification-click', link, notificationId? }` when a
 * user clicks a notification while Atlas is open in a tab. The handler
 * routes inside the SPA rather than doing a hard navigation, which
 * preserves React Query cache and any in-flight UI state.
 */
export function onNotificationClick(
  handler: (msg: { link: string; notificationId?: string }) => void,
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const listener = (event: MessageEvent) => {
    const data = event.data as
      | { type?: string; link?: string; notificationId?: string }
      | undefined;
    if (!data || data.type !== 'atlas:notification-click' || !data.link) return;
    handler({ link: data.link, notificationId: data.notificationId });
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
