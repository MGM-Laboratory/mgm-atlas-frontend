/**
 * Open-redirect protection for the post-login return URL.
 *
 * The deep-link flow round-trips a `callbackUrl` through the login page
 * and sessionStorage ('auth_callback'); anything user-controllable that
 * ends up in a redirect must pass through here at the point of
 * consumption. Only same-origin, app-internal paths survive:
 *   - must start with a single '/' ('//evil.com' is protocol-relative)
 *   - not an /api route (those return JSON / redirects, not pages)
 *   - not /login itself (would loop)
 *
 * Returns the path unchanged when safe, otherwise null — callers fall
 * back to their default destination ('/dashboard').
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.startsWith('/api/') || raw === '/api') return null;
  if (raw.startsWith('/login')) return null;
  return raw;
}
