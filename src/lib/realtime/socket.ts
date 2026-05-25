'use client';

import { io, type Socket } from 'socket.io-client';
import { getStoredSession } from '@/lib/auth-client';

/**
 * Lazy socket.io singleton for the `/chat` namespace.
 *
 * Connects on first call to `getChatSocket()`, reuses the same socket
 * for the lifetime of the tab, auto-reconnects with exponential backoff.
 *
 * If `NEXT_PUBLIC_SOCKET_URL` is not set we derive the socket origin
 * from `NEXT_PUBLIC_API_URL` by stripping the `/api/v1` path. socket.io
 * always uses its own `/socket.io` path under that origin.
 */

let socket: Socket | null = null;

function resolveSocketUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicit) return explicit;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  // Strip a trailing /api/vN if present.
  return apiUrl.replace(/\/api\/v\d+\/?$/, '');
}

export function getChatSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (socket) return socket;

  const session = getStoredSession();
  if (!session) return null;

  socket = io(`${resolveSocketUrl()}/chat`, {
    transports: ['websocket'],
    auth: { token: session.sessionId },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10_000,
  });

  return socket;
}

/** Drop the singleton — used on logout so the next user gets a fresh socket. */
export function disconnectChatSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
