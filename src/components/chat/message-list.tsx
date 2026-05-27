'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
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
  /** When true, the socket is pushing updates and we don't need to poll. */
  live?: boolean;
  onReply: (message: ChatMessage) => void;
}

/**
 * Cursor-paginated message list, newest-first. The first page is the
 * latest 50 messages; getNextPageParam returns the cursor for older
 * history, fetched on scroll-up.
 *
 * When `live` is true (socket connected), the realtime layer pushes
 * updates straight into this query cache via `setQueryData`, so we
 * disable the polling fallback. When `live` is false (no Redis, lost
 * connection, etc.) we drop back to 5s polling automatically.
 */
export function MessageList({
  projectSlug,
  channelId,
  currentUserId,
  isManager,
  live,
  onReply,
}: Props) {
  const queryClient = useQueryClient();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const jumpToMessageId = searchParams.get('msg');

  const query = useInfiniteQuery({
    queryKey: queryKeys.chat.messages(channelId),
    queryFn: ({ pageParam }) =>
      api<ChatMessagePage>(apiPaths.chat.messages(projectSlug, channelId, pageParam, 50)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: live ? false : 5000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  });

  // Flatten newest-first pages into oldest-first for display.
  const messages = React.useMemo(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.items);
    return all.slice().reverse();
  }, [query.data]);

  // Auto-follow the bottom of the conversation. We're "following" when the
  // viewport is within 200px of the bottom; once the user scrolls further
  // up to read history we stop following so we don't yank their position.
  // Using a ref (not state) keeps the ResizeObserver below from rebuilding
  // on every scroll.
  const followBottomRef = React.useRef(true);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Snap to bottom on the first load + whenever a new message arrives
  // (length changes) while we're in follow mode.
  React.useLayoutEffect(() => {
    if (followBottomRef.current) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Images / embeds / link previews can finish loading AFTER the layout
  // effect runs — without this observer the message would push above the
  // fold once it grows. Re-pin on any content size change while in follow
  // mode so the newest message always stays visible.
  React.useEffect(() => {
    const inner = contentRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => {
      if (followBottomRef.current) scrollToBottom();
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Loosened the threshold from 80→200px so a half-screen of "reading
    // last few messages" still counts as following the conversation.
    followBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
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

  /**
   * When the URL carries `?msg=<id>` (search hit / pin click), scroll
   * that message into view and flash a highlight ring. If the message
   * isn't yet loaded we keep paging older history until it is, capped
   * at 10 page-fetches so a stale link doesn't loop forever.
   */
  const jumpAttemptsRef = React.useRef(0);
  React.useEffect(() => {
    if (!jumpToMessageId || messages.length === 0) return;
    const target = document.getElementById(`chat-msg-${jumpToMessageId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('chat-msg-flash');
      setTimeout(() => target.classList.remove('chat-msg-flash'), 1800);
      jumpAttemptsRef.current = 0;
      return;
    }
    if (query.hasNextPage && jumpAttemptsRef.current < 10) {
      jumpAttemptsRef.current += 1;
      void query.fetchNextPage();
    }
  }, [jumpToMessageId, messages, query.hasNextPage, query]);

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
      <div ref={contentRef}>
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
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                  5 * 60 * 1000;
              return (
                <div key={m.id} id={`chat-msg-${m.id}`}>
                  <MessageItem
                    message={m}
                    grouped={Boolean(sameAuthor && closeInTime)}
                    currentUserId={currentUserId}
                    isManager={isManager}
                    onReply={onReply}
                  />
                </div>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
