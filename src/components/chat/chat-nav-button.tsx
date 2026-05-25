'use client';

import * as React from 'react';
import Link from 'next/link';
import { Hash, MessagesSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ChatOverviewPayload } from '@/lib/types';

/**
 * Header shortcut. Shows a chat icon with a small unread badge; clicking
 * opens a popover listing the user's chat-enabled projects so they can
 * dive straight into a conversation without going through the project page.
 *
 * Falls back to silent (no badge, no fetch on render) for users with no
 * projects — endpoint returns an empty list and that's it.
 */
export function ChatNavButton() {
  const [open, setOpen] = React.useState(false);

  const overview = useQuery({
    queryKey: queryKeys.chat.myProjects,
    queryFn: () => api<ChatOverviewPayload>(apiPaths.chat.myProjects()),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    // Don't error-noisy in dev when the backend is offline.
    retry: false,
  });

  const projects = overview.data?.projects ?? [];
  const totalUnread = projects.reduce((sum, p) => sum + p.unread, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={totalUnread > 0 ? `Chat (${totalUnread} unread)` : 'Chat'}
          className="relative"
        >
          <MessagesSquare className="h-4 w-4" strokeWidth={2.25} />
          {totalUnread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-grid h-4 min-w-4 place-items-center rounded-full bg-brand-blue px-1 text-[10px] font-medium text-white">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <div className="text-[13px] font-medium text-ink">Chat</div>
          <Link
            href={'/chat' as never}
            onClick={() => setOpen(false)}
            className="text-[12px] text-ink-3 hover:text-brand-blue"
          >
            View all →
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-ink-3">
            No project chats yet.
          </div>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {projects.map((p) => {
              const general = p.channels.find((c) => c.isGeneral) ?? p.channels[0];
              return (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.slug}/chat/${general?.id ?? ''}` as never}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-surface-muted"
                  >
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="h-7 w-7 rounded object-cover"
                      />
                    ) : (
                      <div className="grid h-7 w-7 place-items-center rounded bg-surface-muted text-ink-3">
                        <Hash className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">{p.title}</div>
                      <div className="truncate text-[11px] text-ink-3">
                        {p.channels.length} {p.channels.length === 1 ? 'channel' : 'channels'}
                      </div>
                    </div>
                    {p.unread > 0 ? (
                      <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-brand-blue px-1.5 text-[10px] font-medium text-white">
                        {p.unread}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
