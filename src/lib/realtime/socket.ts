'use client';

import { io, type Socket } from 'socket.io-client';
import { getStoredSession } from '@/lib/auth-client';

/**
 * Lazy socket.io singletons for the `/chat` and `/voice` namespaces.
 *
 * Each connects on first call (`getChatSocket()` / `getVoiceSocket()`),
 * reuses the same socket for the lifetime of the tab, auto-reconnects
 * with exponential backoff.
 *
 * If `NEXT_PUBLIC_SOCKET_URL` is not set we derive the socket origin
 * from `NEXT_PUBLIC_API_URL` by stripping the `/api/v1` path. socket.io
 * always uses its own `/socket.io` path under that origin, and the
 * gateway dispatches by namespace (`/chat` vs `/voice`).
 */

let chatSocket: Socket | null = null;
let voiceSocket: Socket | null = null;
let notificationsSocket: Socket | null = null;

function resolveSocketUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicit) return explicit;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  // Strip a trailing /api/vN if present.
  return apiUrl.replace(/\/api\/v\d+\/?$/, '');
}

function makeSocket(namespace: '/chat' | '/voice' | '/notifications'): Socket | null {
  if (typeof window === 'undefined') return null;
  const session = getStoredSession();
  if (!session) return null;
  return io(`${resolveSocketUrl()}${namespace}`, {
    transports: ['websocket'],
    auth: { token: session.sessionId },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10_000,
  });
}

export function getChatSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (chatSocket) return chatSocket;
  chatSocket = makeSocket('/chat');
  return chatSocket;
}

export function getVoiceSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (voiceSocket) return voiceSocket;
  voiceSocket = makeSocket('/voice');
  return voiceSocket;
}

export function getNotificationsSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (notificationsSocket) return notificationsSocket;
  notificationsSocket = makeSocket('/notifications');
  return notificationsSocket;
}

/** Drop the singletons — used on logout so the next user gets fresh sockets. */
export function disconnectChatSocket(): void {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
}

export function disconnectVoiceSocket(): void {
  if (voiceSocket) {
    voiceSocket.disconnect();
    voiceSocket = null;
  }
}

export function disconnectNotificationsSocket(): void {
  if (notificationsSocket) {
    notificationsSocket.disconnect();
    notificationsSocket = null;
  }
}
