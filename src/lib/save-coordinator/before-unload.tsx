'use client';

import { useEffect } from 'react';
import { useSaveCoordinator } from './store';

const WARN_MSG =
  'You have unsaved changes that haven’t finished syncing yet. Close anyway?';

/**
 * Mounted once at the authenticated-layout level. Listens for three
 * events that signal "this page is going away" and flushes every
 * registered surface synchronously:
 *
 * - `visibilitychange === hidden` — fires on tab switch, OS-switch,
 *   pulled-down notification shade, and (most importantly) the
 *   first signal of an imminent close on mobile / iOS Safari.
 *   Strictly more reliable than `beforeunload`.
 * - `pagehide` — fires once on actual unload, including BFCache.
 * - `beforeunload` — only place where we can show the user a warning
 *   modal asking "are you sure?".
 *
 * We flush on all three; the flushes are idempotent (the same PATCH
 * is safe to repeat). The browser native warning only shows from
 * `beforeunload`, and only when there is unsaved state.
 */
export function SaveCoordinatorBeforeUnload() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useSaveCoordinator.getState();
      s.flushAll();
      if (s.hasUnsaved()) {
        e.preventDefault();
        e.returnValue = WARN_MSG;
        return WARN_MSG;
      }
      return undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        useSaveCoordinator.getState().flushAll();
      }
    };
    const onPageHide = () => useSaveCoordinator.getState().flushAll();

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);
  return null;
}
