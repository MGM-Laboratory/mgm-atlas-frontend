'use client';

import { create } from 'zustand';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface SurfaceState {
  status: SaveStatus;
  lastSavedAt: number | null;
  lastError: string | null;
  // Synchronous flush — must use sendBeacon / fetch keepalive so the
  // request survives page unload. Optional: surfaces with nothing to
  // flush can omit it.
  flushNow?: () => void;
}

interface CoordinatorState {
  surfaces: Record<string, SurfaceState>;
  register(id: string, flushNow: () => void): void;
  unregister(id: string): void;
  setStatus(id: string, status: SaveStatus, error?: string | null): void;
  hasUnsaved(): boolean;
  flushAll(): void;
}

/**
 * Global registry of every editable surface in the app that should
 * survive a tab close. Surfaces register on mount with a `flushNow`
 * callback that performs a synchronous (keepalive) PATCH of their
 * latest state. The before-unload singleton calls `flushAll()` on
 * `visibilitychange === hidden` and `beforeunload`.
 */
export const useSaveCoordinator = create<CoordinatorState>((set, get) => ({
  surfaces: {},
  register: (id, flushNow) =>
    set((s) => ({
      surfaces: {
        ...s.surfaces,
        [id]: { status: s.surfaces[id]?.status ?? 'idle', lastSavedAt: null, lastError: null, flushNow },
      },
    })),
  unregister: (id) =>
    set((s) => {
      if (!(id in s.surfaces)) return s;
      const rest: Record<string, SurfaceState> = {};
      for (const k of Object.keys(s.surfaces)) {
        if (k !== id) rest[k] = s.surfaces[k];
      }
      return { surfaces: rest };
    }),
  setStatus: (id, status, error = null) =>
    set((s) => {
      const cur = s.surfaces[id];
      if (!cur) return s;
      const lastSavedAt = status === 'saved' ? Date.now() : cur.lastSavedAt;
      return {
        surfaces: { ...s.surfaces, [id]: { ...cur, status, lastSavedAt, lastError: error } },
      };
    }),
  hasUnsaved: () => {
    const ss = get().surfaces;
    return Object.values(ss).some(
      (s) => s.status === 'dirty' || s.status === 'saving' || s.status === 'error',
    );
  },
  flushAll: () => {
    const ss = get().surfaces;
    for (const s of Object.values(ss)) {
      try {
        s.flushNow?.();
      } catch {
        // best-effort: each surface owns its own error reporting.
      }
    }
  },
}));
