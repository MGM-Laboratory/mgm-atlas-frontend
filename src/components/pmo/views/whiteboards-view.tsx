'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Plus, Presentation, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { formatDueDate } from '@/components/pmo/date-picker-popover';
import type { Whiteboard, WhiteboardListItem } from '@/lib/types';

export function WhiteboardsView({ projectSlug }: { projectSlug: string }) {
  const params = useParams();
  const listId = params.listId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const wbHref = (wbId: string) =>
    `/projects/${projectSlug}/lists/${listId}/whiteboards/${wbId}`;

  const q = useQuery({
    queryKey: queryKeys.pmo.whiteboards(projectSlug),
    queryFn: () =>
      api<{ whiteboards: WhiteboardListItem[] }>(apiPaths.pmo.whiteboards.list(projectSlug)),
    staleTime: 15_000,
  });

  const create = useMutation({
    mutationFn: () =>
      api<Whiteboard>(apiPaths.pmo.whiteboards.create(projectSlug), { method: 'POST', body: {} }),
    onSuccess: (wb) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.whiteboards(projectSlug) });
      router.push(wbHref(wb.id));
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not create whiteboard', description: (err as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(apiPaths.pmo.whiteboards.remove(projectSlug, id), { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pmo.whiteboards(projectSlug) }),
    onError: (err) =>
      show({ tone: 'danger', title: 'Delete failed', description: (err as Error).message }),
  });

  const handleDelete = (wb: WhiteboardListItem) => {
    if (window.confirm(`Delete whiteboard “${wb.title}”?`)) remove.mutate(wb.id);
  };

  const items = q.data?.whiteboards ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink-3">
          <Presentation className="h-3.5 w-3.5" strokeWidth={2.25} />
          Whiteboards
          {q.data ? <span className="font-medium text-ink-2">{items.length}</span> : null}
        </div>
        <Button type="button" size="sm" onClick={() => create.mutate()} loading={create.isPending}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          New whiteboard
        </Button>
      </div>

      {q.isLoading ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="h-40 animate-pulse rounded-lg bg-line/70" />
          ))}
        </ul>
      ) : q.isError ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
          Could not load whiteboards.
        </p>
      ) : items.length === 0 ? (
        <button
          type="button"
          onClick={() => create.mutate()}
          className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-muted text-ink-3 transition-colors hover:border-line-strong hover:bg-line/60"
        >
          <Presentation className="h-7 w-7" strokeWidth={2} />
          <span className="text-[13px]">Create your first whiteboard</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((wb) => (
            <li key={wb.id} className="group relative">
              <Link
                href={wbHref(wb.id)}
                className="block overflow-hidden rounded-lg border border-line bg-white transition-shadow duration-120 ease-out-soft hover:shadow-2"
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted">
                  {wb.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={wb.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Presentation className="h-8 w-8 text-ink-4" strokeWidth={1.75} />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-[13px] font-medium text-ink" title={wb.title}>
                    {wb.title}
                  </p>
                  <p className="text-[11px] text-ink-3">Edited {formatDueDate(wb.updatedAt)}</p>
                </div>
              </Link>
              <div className="absolute right-2 top-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Whiteboard actions"
                      className="rounded bg-white/90 p-1 text-ink-4 opacity-0 shadow-1 hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => handleDelete(wb)}
                      className="text-brand-red data-[highlighted]:bg-brand-red-50 data-[highlighted]:text-brand-red"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
