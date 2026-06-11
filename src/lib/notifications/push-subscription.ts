'use client';

import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { getServiceWorkerRegistration, registerServiceWorker } from './sw-registration';

interface VapidResponse {
  publicKey: string;
  configured: boolean;
}

export interface SubscribeResult {
  ok: true;
  id: string;
}

export type SubscribeFailure =
  | { ok: false; reason: 'unsupported' }
  | { ok: false; reason: 'not-configured' }
  | { ok: false; reason: 'permission-denied' }
  | { ok: false; reason: 'subscribe-failed'; message: string };

/**
 * Convert the backend's base64url VAPID public key into the Uint8Array
 * shape `PushManager.subscribe()` expects. Spec quirk: the browser
 * wants the raw bytes of the application server key, not the base64
 * string itself.
 */
function urlBase64ToUint8Array(base64UrlString: string): Uint8Array {
  const padding = '='.repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64 = (base64UrlString + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Full subscribe flow: fetch VAPID public key → request browser
 * permission (caller decides when) → register SW → subscribe via
 * PushManager → POST the result to the backend so future pushes have
 * somewhere to land.
 *
 * Idempotent: calling twice from the same browser produces the same
 * `endpoint` and the backend upserts on it. Safe to call on every tab
 * open if you want; one call per "user enabled" is enough.
 */
export async function subscribePush(): Promise<SubscribeResult | SubscribeFailure> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }
  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission-denied' };
  }

  let vapid: VapidResponse;
  try {
    vapid = await api<VapidResponse>(apiPaths.vapidPublicKey());
  } catch (err) {
    return { ok: false, reason: 'subscribe-failed', message: (err as Error).message };
  }
  if (!vapid.configured || !vapid.publicKey) {
    return { ok: false, reason: 'not-configured' };
  }

  await registerServiceWorker();
  const reg = await getServiceWorkerRegistration();
  if (!reg) return { ok: false, reason: 'unsupported' };

  let sub: PushSubscription;
  try {
    // The Push API typings narrow `applicationServerKey` to BufferSource
    // backed by an `ArrayBuffer` specifically; `Uint8Array<ArrayBufferLike>`
    // from atob's output trips that. The runtime accepts it fine — cast.
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey) as BufferSource,
      }));
  } catch (err) {
    return { ok: false, reason: 'subscribe-failed', message: (err as Error).message };
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  // toJSON() returns base64url for the keys on every browser that
  // implements it correctly; fall back to manual encoding when fields
  // are missing (older Chromium on Android does this for `keys`).
  const endpoint = json.endpoint ?? sub.endpoint;
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey('p256dh'));
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey('auth'));

  try {
    const created = await api<{ id: string }>(apiPaths.pushSubscribe(), {
      method: 'POST',
      body: { endpoint, p256dh, auth, userAgent: navigator.userAgent },
    });
    return { ok: true, id: created.id };
  } catch (err) {
    return { ok: false, reason: 'subscribe-failed', message: (err as Error).message };
  }
}

/**
 * Unsubscribe the current browser's push subscription. Best-effort:
 * deletes the row by id on the backend AND calls `sub.unsubscribe()`
 * locally so re-enabling triggers a fresh subscribe flow.
 */
export async function unsubscribePush(subscriptionId: string): Promise<void> {
  await api(apiPaths.pushSubscriptionDelete(subscriptionId), { method: 'DELETE' }).catch(() => {});
  const reg = await getServiceWorkerRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe().catch(() => {});
}
