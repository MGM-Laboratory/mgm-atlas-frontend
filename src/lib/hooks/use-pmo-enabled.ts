/**
 * Single source of truth for whether the PMO module is mounted on this
 * deploy. Backed by the build-baked NEXT_PUBLIC_PMO_ENABLED. Every PMO
 * route, sidebar entry, and tab MUST consult this so the feature can
 * ship dark and roll out per environment.
 *
 * Returns a plain boolean (not a Promise / Query) — safe to call from
 * RSC, client components, and middleware-ish guards alike.
 */
export function usePmoEnabled(): boolean {
  return isPmoEnabled();
}

/** Non-hook variant for use outside React render trees. */
export function isPmoEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PMO_ENABLED ?? 'false').toLowerCase() === 'true';
}

/**
 * Public WebSocket URL for the Yjs sync sidecar (Phase 8+). Empty string
 * means collab is disabled — callers should fall back to single-edit mode
 * with a warning toast rather than failing.
 */
export function getYjsWsUrl(): string {
  return process.env.NEXT_PUBLIC_YJS_WS_URL ?? '';
}
