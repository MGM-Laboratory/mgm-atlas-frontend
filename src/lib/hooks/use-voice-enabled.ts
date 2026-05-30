/**
 * Single source of truth for whether the voice-chat module is mounted on
 * this deploy. Backed by the build-baked NEXT_PUBLIC_VOICE_ENABLED. Every
 * voice route, sidebar entry, channel-list row, and the persistent voice
 * panel MUST consult this so the feature can ship dark and roll out per
 * environment.
 *
 * Returns a plain boolean (not a Promise / Query) — safe to call from
 * RSC, client components, and middleware-ish guards alike.
 */
export function useVoiceEnabled(): boolean {
  return isVoiceEnabled();
}

/** Non-hook variant for use outside React render trees. */
export function isVoiceEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_VOICE_ENABLED ?? 'false').toLowerCase() === 'true';
}

/**
 * Public LiveKit signaling URL. Empty string means the feature is
 * unavailable on this deploy (Phase 0 ships this empty so the flag
 * being on without LiveKit provisioned still degrades safely). Callers
 * should treat empty as "voice unavailable" rather than failing.
 */
export function getLivekitUrl(): string {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL ?? '';
}
