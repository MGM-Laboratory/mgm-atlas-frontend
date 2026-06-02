'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSaveCoordinator } from './store';

export interface UseSaveSurfaceOptions {
  surfaceId: string;
  /**
   * Synchronous flush callback — runs on `visibilitychange === hidden`,
   * `beforeunload`, and component unmount. MUST do its network call
   * via `apiBeacon()` (fetch keepalive) or `navigator.sendBeacon` so
   * the request survives page teardown.
   */
  flushNow: () => void;
}

/**
 * Registers an editable surface (note / whiteboard / kanban list /
 * task description) with the global `SaveCoordinator`. The returned
 * helpers let the surface push status transitions; the coordinator
 * uses them to drive the SaveBadge and the beforeunload warning.
 */
export function useSaveSurface({ surfaceId, flushNow }: UseSaveSurfaceOptions) {
  const register = useSaveCoordinator((s) => s.register);
  const unregister = useSaveCoordinator((s) => s.unregister);
  const setStatus = useSaveCoordinator((s) => s.setStatus);

  const ref = useRef(flushNow);
  ref.current = flushNow;

  useEffect(() => {
    register(surfaceId, () => ref.current());
    return () => {
      // Final flush on unmount — this is the bug fix for "clear
      // debounce timer on unmount before the PATCH fires."
      try {
        ref.current();
      } catch {
        // surface state already reflects the failure.
      }
      unregister(surfaceId);
    };
  }, [surfaceId, register, unregister]);

  return useMemo(
    () => ({
      markDirty: () => setStatus(surfaceId, 'dirty'),
      markSaving: () => setStatus(surfaceId, 'saving'),
      markSaved: () => setStatus(surfaceId, 'saved'),
      markError: (msg: string) => setStatus(surfaceId, 'error', msg),
    }),
    [surfaceId, setStatus],
  );
}
