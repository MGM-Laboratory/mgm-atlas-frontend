'use client';

import * as React from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import type { ChatMessage, ChatMessagePage } from '@/lib/types';
import { MessageItem } from './message-item';

interface Props {
  projectSlug: string;
  channelId: string;
  currentUserId: string;
  isManager: boolean;
  onReply: (message: ChatMessage) => void;
}

/**
 * P1: REST polling every 5s. P2 swaps the polling for socket events
 * pushed into the same query cache, so this component stays unchanged.
 *
 * Newest-first cursor pagination: the first page is the latest 50
 * messages; getNextPageParam returns the cursor for older history,
 * which the user fetches by scrolling up.
 */
export function MessageList({
  projectSlug,
  channelId,
  currentUserId,
  isManager,
  onReply,
}: Props) {
  const queryClient = useQueryClient();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: queryKeys.chat.messages(channelId),
    queryFn: ({ pageParam }) =>
      api<ChatMessagePage>(apiPaths.chat.messages(projectSlug, channelId, pageParam, 50)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  });

  // Flatten newest-first pages into oldest-first for display.
  const messages = React.useMemo(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.items);
    return all.slice().reverse();
  }, [query.data]);

  // Auto-scroll to bottom on first load and when new messages arrive
  // while the user is near the bottom (within 80px). Don't yank scroll
  // when they're reading history.
  const wasNearBottomRef = React.useRef(true);
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (wasNearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    // Pull older history when user reaches the top.
    if (el.scrollTop < 80 && query.hasNextPage && !query.isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      void query.fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  };

  // Mark channel as read whenever we render new messages.
  const lastMessageId = messages[messages.length - 1]?.id;
  React.useEffect(() => {
    if (!lastMessageId) return;
    void api(apiPaths.chat.read(projectSlug, channelId), {
      method: 'POST',
      body: { lastReadMessageId: lastMessageId },
    })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.chat.myProjects }))
      .catch(() => {
        /* read marker is best-effort */
      });
  }, [lastMessageId, projectSlug, channelId, queryClient]);

  if (query.isLoading) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-line/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-6 py-4"
    >
      {query.isFetchingNextPage ? (
        <div className="py-2 text-center text-[12px] text-ink-3">Loading older messages…</div>
      ) : null}
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[14px] text-ink-3">
          No messages yet. Say hello.
        </div>
      ) : (
        <ul className="space-y-1">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const sameAuthor =
              prev && prev.author.id === m.author.id && !prev.deletedAt && !m.deletedAt;
            const closeInTime =
              prev &&
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
            return (
              <MessageItem
                key={m.id}
                message={m}
                grouped={Boolean(sameAuthor && closeInTime)}
                currentUserId={currentUserId}
                isManager={isManager}
                onReply={onReply}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
