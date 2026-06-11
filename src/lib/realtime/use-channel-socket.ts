'use client';

import * as React from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queries';
import type { ChatMessage, ChatMessagePage } from '@/lib/types';
import { getChatSocket } from './socket';
import { usePresenceStore } from './presence-store';

interface UseChannelSocketArgs {
  /** null = workspace-global channel (no project room; auth-only subscribe). */
  projectId: string | null;
  channelId: string;
  currentUserId: string;
}

/**
 * Subscribes to a channel's realtime stream and merges events into the
 * existing React Query caches. The cache shape is the same the polling
 * fallback writes, so the rest of the UI doesn't know it's now live.
 *
 * Returns `{ online, isConnected, ping }`:
 *   - online       — set of userIds currently online in the project
 *   - isConnected  — whether the socket is currently up
 *   - ping(channelId) — throttled typing ping
 *
 * Falls back gracefully when the socket isn't available (server
 * without REDIS_URL, network down, no session): React Query keeps the
 * data fresh via its own staleTime + manual invalidation.
 */
export function useChannelSocket({ projectId, channelId, currentUserId }: UseChannelSocketArgs) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = React.useState(false);
  const lastTypingPingRef = React.useRef(0);

  const addTyping = usePresenceStore((s) => s.addTyping);
  const removeTyping = usePresenceStore((s) => s.removeTyping);
  const setOnline = usePresenceStore((s) => s.setOnline);

  React.useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return;

    const onConnect = () => {
      setIsConnected(true);
      // Global channels subscribe by channelId only — the gateway
      // verifies the channel really is global (or insider for project
      // channels reached by id) and skips the project room.
      socket.emit('chat:subscribe', projectId ? { projectId, channelId } : { channelId });
    };
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    // Already connected from a prior mount? Subscribe now.
    if (socket.connected) onConnect();

    // ─── Messages ─────────────────────────────────────────────────
    const onMessageCreated = (msg: ChatMessage & { clientMessageId?: string }) => {
      if (msg.channelId !== channelId) return;
      queryClient.setQueryData<InfiniteData<ChatMessagePage>>(
        queryKeys.chat.messages(channelId),
        (prev) => {
          if (!prev) return prev;
          // Don't dupe the message if it's our own optimistic echo
          // (we'd still want to reconcile the temp id, P3+).
          const exists = prev.pages.some((p) => p.items.some((m) => m.id === msg.id));
          if (exists) return prev;
          const [first, ...rest] = prev.pages;
          if (!first) return prev;
          return {
            ...prev,
            pages: [{ ...first, items: [msg, ...first.items] }, ...rest],
          };
        },
      );
      // Author's own message: clear our typing-flag for this channel.
      if (msg.author.id === currentUserId) removeTyping(channelId, currentUserId);
    };

    const onMessageEdited = (msg: ChatMessage) => {
      if (msg.channelId !== channelId) return;
      queryClient.setQueryData<InfiniteData<ChatMessagePage>>(
        queryKeys.chat.messages(channelId),
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              items: p.items.map((m) => (m.id === msg.id ? msg : m)),
            })),
          };
        },
      );
    };

    const onMessageDeleted = (msg: ChatMessage) => {
      if (msg.channelId !== channelId) return;
      queryClient.setQueryData<InfiniteData<ChatMessagePage>>(
        queryKeys.chat.messages(channelId),
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              items: p.items.map((m) => (m.id === msg.id ? msg : m)),
            })),
          };
        },
      );
    };

    // ─── Reactions / pins (invalidate — too many shape branches to merge cleanly) ───
    const onReactionChange = (payload: { messageId: string }) => {
      // Pull the message back to grab the fresh reactions list. We
      // could be smarter and patch in-place, but reactions render
      // grouped + sorted, and invalidate is cheap on a live channel.
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(channelId) });
      void payload;
    };
    const onPinChange = () => {
      // Both the inline pinned banner on each message AND the right-side
      // pin panel need to refresh — they read from different queries.
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.pins(channelId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(channelId) });
    };

    // ─── Typing / presence ────────────────────────────────────────
    const onTypingStart = (p: { channelId: string; userId: string; name: string }) => {
      if (p.channelId !== channelId) return;
      if (p.userId === currentUserId) return;
      addTyping(channelId, { userId: p.userId, name: p.name });
    };
    const onTypingStop = (p: { channelId: string; userId: string }) => {
      if (p.channelId !== channelId) return;
      removeTyping(channelId, p.userId);
    };
    const onPresence = (p: { userId: string; online: boolean }) => {
      // Presence is project-scoped; global channels receive no presence
      // events (deliberate v1 scope) so the 'global' bucket stays empty.
      setOnline(projectId ?? 'global', p.userId, p.online);
    };

    // ─── Unread fanout ────────────────────────────────────────────
    const onUnreadUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.myProjects });
    };

    socket.on('message.created', onMessageCreated);
    socket.on('message.edited', onMessageEdited);
    socket.on('message.deleted', onMessageDeleted);
    socket.on('reaction.added', onReactionChange);
    socket.on('reaction.removed', onReactionChange);
    socket.on('pin.added', onPinChange);
    socket.on('pin.removed', onPinChange);
    socket.on('typing.start', onTypingStart);
    socket.on('typing.stop', onTypingStop);
    socket.on('presence.update', onPresence);
    socket.on('unread.update', onUnreadUpdate);

    // Heartbeat — keeps presence flag fresh on the server side.
    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit('presence:heartbeat');
    }, 25_000);
    const typingPrune = setInterval(() => {
      usePresenceStore.getState().pruneExpiredTyping();
    }, 2_000);

    return () => {
      clearInterval(heartbeat);
      clearInterval(typingPrune);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message.created', onMessageCreated);
      socket.off('message.edited', onMessageEdited);
      socket.off('message.deleted', onMessageDeleted);
      socket.off('reaction.added', onReactionChange);
      socket.off('reaction.removed', onReactionChange);
      socket.off('pin.added', onPinChange);
      socket.off('pin.removed', onPinChange);
      socket.off('typing.start', onTypingStart);
      socket.off('typing.stop', onTypingStop);
      socket.off('presence.update', onPresence);
      socket.off('unread.update', onUnreadUpdate);
      if (socket.connected) socket.emit('chat:unsubscribe', { channelId });
    };
  }, [projectId, channelId, currentUserId, queryClient, addTyping, removeTyping, setOnline]);

  /** Composer calls this on input. Debounced server-side; we additionally throttle locally to 2s. */
  const sendTypingPing = React.useCallback(() => {
    const now = Date.now();
    if (now - lastTypingPingRef.current < 2000) return;
    lastTypingPingRef.current = now;
    const socket = getChatSocket();
    if (socket?.connected) socket.emit('typing:ping', { channelId });
  }, [channelId]);

  const sendTypingStop = React.useCallback(() => {
    lastTypingPingRef.current = 0;
    const socket = getChatSocket();
    if (socket?.connected) socket.emit('typing:stop', { channelId });
  }, [channelId]);

  return { isConnected, sendTypingPing, sendTypingStop };
}
