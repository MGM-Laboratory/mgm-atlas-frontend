'use client';

/**
 * Tiny wrapper around the browser's Notification API + a localStorage
 * flag for "user already dismissed our enable prompt." Keeps the
 * permission model in one place so the bell, the banner, and the
 * settings page all derive their UI from the same source of truth.
 *
 * Browser support:
 *   - Chrome / Edge / Firefox (desktop + Android): full Notification API.
 *   - Safari macOS 16+: full Notification API.
 *   - Safari iOS 16.4+: requires installed PWA before
 *     `Notification.requestPermission()` works at all.
 *   - Firefox private mode + some embedded browsers: no
 *     `serviceWorker` — `isPushSupported()` returns false and we
 *     degrade to in-app delivery only.
 */

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

const DISMISSED_KEY = 'atlas_notifications_dismissed_at';

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission(): PushPermission {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermission;
}

/**
 * True when we're allowed to show the soft-prompt banner. We never
 * re-prompt after a user has explicitly dismissed it, even if their
 * browser permission state goes back to `default` (e.g. they cleared
 * site data) — they made an active choice.
 */
export function shouldShowEnablePrompt(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'default') return false;
  return !localStorage.getItem(DISMISSED_KEY);
}

export function markEnablePromptDismissed(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
}

/**
 * Clear the dismissal flag — used from the Settings page when a user
 * who said "Not now" later wants the banner back. Doesn't change the
 * browser permission state (which only the user can grant).
 */
export function clearEnablePromptDismissed(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DISMISSED_KEY);
}

export async function requestPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  return result as PushPermission;
}
