'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, Check, Inbox } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { NotificationItem, Paginated } from '@/lib/types';
import { cn, formatRelative } from '@/lib/utils';

export function NotificationBell() {
  const qc = useQueryClient();
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<{ unread: number }>(apiPaths.unreadCount()),
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => api<Paginated<NotificationItem>>(apiPaths.notifications(1)),
    enabled: false, // only fetched when popover opens
  });

  const count = unread.data?.unread ?? 0;

  async function markAll() {
    await api(apiPaths.markAllRead(), { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) list.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${count ? ` (${count} unread)` : ''}`}
          className={cn(
            'relative inline-grid h-10 w-10 place-items-center rounded text-ink',
            'hover:bg-surface-muted',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
        >
          <Bell className="h-5 w-5" strokeWidth={2.25} />
          {count > 0 ? (
            <span className="absolute right-1.5 top-1.5 inline-grid min-w-[18px] place-items-center rounded-full bg-brand-red px-1 text-[11px] font-medium leading-none text-white">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-[14px] font-medium text-ink">Notifications</span>
          {count > 0 ? (
            <button
              onClick={markAll}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-blue hover:underline"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {list.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-14 rounded" />
              ))}
            </div>
          ) : (list.data?.items?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-ink-3">
              <Inbox className="h-6 w-6" strokeWidth={2.25} />
              <span className="text-[13px]">You&apos;re all caught up.</span>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {list.data!.items.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <Link
                    href={(n.link ?? '/dashboard') as never}
                    className={cn(
                      'block px-4 py-3 transition-colors hover:bg-surface-muted',
                      n.readAt ? 'opacity-70' : '',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {!n.readAt ? (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-blue" />
                      ) : (
                        <span className="mt-1.5 h-2 w-2 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium text-ink">{n.title}</div>
                        <p className="line-clamp-2 text-[13px] text-ink-2">{n.body}</p>
                        <span className="mt-1 block text-[12px] text-ink-3">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center">
            <Link href={'/notifications' as never}>View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
