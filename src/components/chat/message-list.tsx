'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { cn } from '@/lib/utils';
import type { ChatChannelState, ChatMessage, ChatMessagePage } from '@/lib/types';
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
 * Auto-follow behaviour:
 *   - An IntersectionObserver watches a 1-px sentinel placed at the very
 *     bottom of the content, with `rootMargin` extending the intersection
 *     area 200px below the viewport. Whenever the sentinel intersects
 *     that area we're "following the conversation"; otherwise we're not.
 *   - Each render in follow mode pins to the sentinel via scrollIntoView,
 *     and a ResizeObserver pins again whenever post-layout image / embed
 *     loads grow the content (which used to push new messages above the
 *     fold under the old scroll-math approach).
 *
 * Unread divider:
 *   - We fetch the user's last-read cutoff once per channel via the
 *     /state endpoint and FREEZE it for the rest of the session. A
 *     "New" divider renders above the first message past that cutoff,
 *     and the initial scroll lands on the divider (not on the bottom).
 *   - The existing /read POST is gated until the cutoff is captured so
 *     it can't race-mark-read before we know where the divider goes.
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
  const bottomSentinelRef = React.useRef<HTMLDivElement>(null);
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

  // ─── Channel read-state (drives the unread divider) ──────────────────
  // Always-fresh: refetch on each mount AND on each channelId change
  // (queryKey changes). Captured into state below and then frozen for
  // the rest of the session in this channel.
  const stateQuery = useQuery({
    queryKey: queryKeys.chat.channelState(channelId),
    queryFn: () =>
      api<ChatChannelState>(apiPaths.chat.channelState(projectSlug, channelId)),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // Frozen cutoff per channelId. `undefined` = not yet captured; `null` =
  // captured but the user has never read this channel (so all messages
  // count as unread); string = the cutoff timestamp.
  const [frozenCutoff, setFrozenCutoff] = React.useState<string | null | undefined>(
    undefined,
  );

  // Reset on channel switch.
  React.useEffect(() => {
    setFrozenCutoff(undefined);
  }, [channelId]);

  // Capture once per channel after the state query resolves.
  React.useEffect(() => {
    if (frozenCutoff !== undefined) return;
    if (!stateQuery.data) return;
    setFrozenCutoff(stateQuery.data.lastReadAt);
  }, [stateQuery.data, frozenCutoff]);

  // First message that should appear BELOW the New-messages divider. We
  // skip the user's own messages so the divider doesn't show up just
  // because they posted while in another channel.
  const firstUnreadIndex = React.useMemo(() => {
    if (!frozenCutoff || messages.length === 0) return -1;
    return messages.findIndex(
      (m) => m.createdAt > frozenCutoff && m.author.id !== currentUserId,
    );
  }, [messages, frozenCutoff, currentUserId]);

  // ─── Auto-follow (IntersectionObserver-based) ────────────────────────
  const followBottomRef = React.useRef(true);

  React.useEffect(() => {
    const root = scrollRef.current;
    const target = bottomSentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) followBottomRef.current = entry.isIntersecting;
      },
      // `200px` bottom rootMargin: within 200px of the end of content
      // still counts as "following". Threshold 0 fires the moment any
      // part of the sentinel enters/leaves the area.
      { root, rootMargin: '0px 0px 200px 0px', threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  const scrollToBottom = React.useCallback(() => {
    bottomSentinelRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  // ─── Initial scroll: divider if unread, else bottom ──────────────────
  const [initialScrollDone, setInitialScrollDone] = React.useState(false);
  React.useEffect(() => {
    setInitialScrollDone(false);
  }, [channelId]);

  React.useLayoutEffect(() => {
    if (initialScrollDone) return;
    if (frozenCutoff === undefined) return; // wait for cutoff capture
    if (messages.length === 0) return;
    setInitialScrollDone(true);

    if (firstUnreadIndex >= 0) {
      const divider = document.getElementById(`unread-divider-${channelId}`);
      if (divider) {
        divider.scrollIntoView({ block: 'center' });
        // Don't auto-follow new messages while the user is mid-conversation
        // reading the unread block — they'll scroll down themselves and the
        // IntersectionObserver will re-engage following at the bottom.
        followBottomRef.current = false;
        return;
      }
    }
    scrollToBottom();
  }, [
    initialScrollDone,
    frozenCutoff,
    messages.length,
    firstUnreadIndex,
    channelId,
    scrollToBottom,
  ]);

  // Pin to bottom on subsequent renders (new messages arriving) while
  // following. Skip until the initial scroll has happened so we don't
  // race the divider-positioning code above.
  React.useLayoutEffect(() => {
    if (!initialScrollDone) return;
    if (followBottomRef.current) scrollToBottom();
  }, [messages, scrollToBottom, initialScrollDone]);

  // Images / embeds / link previews finish loading AFTER the layout
  // effect runs — without this observer the new message would push
  // above the fold once it grows. Pin again on any size change.
  React.useEffect(() => {
    const inner = contentRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => {
      if (followBottomRef.current) scrollToBottom();
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  // ─── Scroll handler: only used for triggering pagination ─────────────
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
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

  // ─── Mark channel as read ─────────────────────────────────────────────
  // Gate on cutoff capture so we don't overwrite the server-side last-
  // read before /state has answered with the OLD value.
  const lastMessageId = messages[messages.length - 1]?.id;
  React.useEffect(() => {
    if (frozenCutoff === undefined) return;
    if (!lastMessageId) return;
    void api(apiPaths.chat.read(projectSlug, channelId), {
      method: 'POST',
      body: { lastReadMessageId: lastMessageId },
    })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.chat.myProjects }))
      .catch(() => {
        /* read marker is best-effort */
      });
  }, [frozenCutoff, lastMessageId, projectSlug, channelId, queryClient]);

  // ─── Jump-to-message (search hit / pin click) ────────────────────────
  const jumpAttemptsRef = React.useRef(0);
  React.useEffect(() => {
    if (!jumpToMessageId || messages.length === 0) return;
    const target = document.getElementById(`chat-msg-${jumpToMessageId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('chat-msg-flash');
      setTimeout(() => target.classList.remove('chat-msg-flash'), 1800);
      jumpAttemptsRef.current = 0;
      // Jump disables follow so the new message doesn't snap us back.
      followBottomRef.current = false;
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
          <div className="py-2 text-center text-[12px] text-ink-3">
            Loading older messages…
          </div>
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
              const isFirstUnread = i === firstUnreadIndex;
              return (
                <React.Fragment key={m.id}>
                  {isFirstUnread ? <UnreadDivider channelId={channelId} /> : null}
                  <div
                    id={`chat-msg-${m.id}`}
                    className={cn(isFirstUnread && 'pt-0.5')}
                  >
                    <MessageItem
                      message={m}
                      grouped={Boolean(sameAuthor && closeInTime) && !isFirstUnread}
                      currentUserId={currentUserId}
                      isManager={isManager}
                      onReply={onReply}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </ul>
        )}
        {/* Bottom sentinel for the IntersectionObserver + scrollIntoView
            target. 1-px tall, aria-hidden so screen readers ignore it. */}
        <div ref={bottomSentinelRef} aria-hidden style={{ height: 1 }} />
      </div>
    </div>
  );
}

function UnreadDivider({ channelId }: { channelId: string }) {
  return (
    <li
      id={`unread-divider-${channelId}`}
      aria-label="New messages"
      className="my-3 flex items-center gap-2 px-1"
    >
      <div className="h-px flex-1 bg-brand-red/40" />
      <span className="rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-red">
        New
      </span>
      <div className="h-px flex-1 bg-brand-red/40" />
    </li>
  );
}
