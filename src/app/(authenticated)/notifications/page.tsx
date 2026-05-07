'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/components/layout/container';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { NotificationItem, Paginated } from '@/lib/types';
import { cn, formatRelative } from '@/lib/utils';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);

  const list = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => api<Paginated<NotificationItem>>(apiPaths.notifications(page)),
  });

  const markAll = useMutation({
    mutationFn: () => api(apiPaths.markAllRead(), { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api(apiPaths.markRead(id), { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <Container size="lg" className="space-y-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">Notifications</h1>
          <p className="mt-1 text-body-sm text-ink-2">
            Activity across the projects you manage and contribute to.
          </p>
        </div>
        <Button variant="secondary" onClick={() => markAll.mutate()} loading={markAll.isPending}>
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
          Mark all read
        </Button>
      </header>

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="You're all caught up." description="New activity will appear here." />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {list.data!.items.map((n) => (
            <li key={n.id}>
              <Link
                href={(n.link ?? '/dashboard') as never}
                onClick={() => (!n.readAt ? markOne.mutate(n.id) : undefined)}
                className={cn(
                  'flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-muted',
                  n.readAt ? 'opacity-70' : '',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    n.readAt ? 'bg-line-strong' : 'bg-brand-blue',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-ink">{n.title}</div>
                  <p className="mt-1 text-[13px] text-ink-2">{n.body}</p>
                </div>
                <span className="shrink-0 text-[12px] text-ink-3">
                  {formatRelative(n.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {list.data && list.data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-[13px] text-ink-3">
            Page {list.data.meta.page} of {list.data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= list.data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </Container>
  );
}
