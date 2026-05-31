'use client';

import * as React from 'react';
import {
  getPushPermission,
  isPushSupported,
  markEnablePromptDismissed,
  requestPermission,
  shouldShowEnablePrompt,
  type PushPermission,
} from './permission';
import { subscribePush, type SubscribeFailure, type SubscribeResult } from './push-subscription';

interface UsePushPermissionState {
  /** Browser permission state, or 'unsupported' on browsers without the API. */
  permission: PushPermission;
  /** True when the soft-prompt banner is allowed to render. */
  canPrompt: boolean;
  /** Whether a request is currently in flight (banner + subscribe). */
  busy: boolean;
  /** Last subscribe result, exposed so callers can react to failures. */
  lastResult: SubscribeResult | SubscribeFailure | null;
  /** Trigger the permission prompt + push subscribe in one step. */
  enable: () => Promise<SubscribeResult | SubscribeFailure>;
  /** Mark the banner dismissed without changing browser permission. */
  dismiss: () => void;
  /** Re-read state from the browser (after a settings-page toggle, say). */
  refresh: () => void;
}

/**
 * Single hook the bell, the first-event banner, and the settings page
 * all share. Centralising it here means rules like "never re-prompt
 * after dismissal" can't drift between three call sites.
 */
export function usePushPermission(): UsePushPermissionState {
  const [permission, setPermission] = React.useState<PushPermission>(() => {
    if (typeof window === 'undefined') return 'unsupported';
    return getPushPermission();
  });
  const [canPrompt, setCanPrompt] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<SubscribeResult | SubscribeFailure | null>(
    null,
  );

  const refresh = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    setPermission(getPushPermission());
    setCanPrompt(shouldShowEnablePrompt());
  }, []);

  React.useEffect(() => {
    refresh();
    if (typeof window === 'undefined') return;
    // Some browsers fire `permissionchange` on the Notifications
    // permission status; older ones don't. Either way refresh on focus
    // catches changes the user made in browser settings.
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const enable = React.useCallback(async (): Promise<SubscribeResult | SubscribeFailure> => {
    if (!isPushSupported()) {
      const result: SubscribeFailure = { ok: false, reason: 'unsupported' };
      setLastResult(result);
      return result;
    }
    setBusy(true);
    try {
      const next = await requestPermission();
      setPermission(next);
      if (next !== 'granted') {
        if (next === 'denied') markEnablePromptDismissed();
        const result: SubscribeFailure = { ok: false, reason: 'permission-denied' };
        setLastResult(result);
        setCanPrompt(false);
        return result;
      }
      const result = await subscribePush();
      setLastResult(result);
      setCanPrompt(false);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    markEnablePromptDismissed();
    setCanPrompt(false);
  }, []);

  return { permission, canPrompt, busy, lastResult, enable, dismiss, refresh };
}
