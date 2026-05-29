'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, KanbanSquare, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { pmoBgClass, pmoFgClass } from './color-picker';
import { LucideIcon } from './lucide-icon';
import type { TaskList } from '@/lib/types';

/**
 * Replaces the old "Task lists" link (which auto-opened the first list)
 * with a popover that lists the project's task lists to pick from,
 * scrollable when there are many.
 */
export function TaskListPicker({ projectSlug }: { projectSlug: string }) {
  const [open, setOpen] = React.useState(false);

  const lists = useQuery({
    enabled: open,
    queryKey: queryKeys.pmo.lists(projectSlug),
    queryFn: () => api<TaskList[]>(apiPaths.pmo.lists.list(projectSlug)),
    staleTime: 30_000,
  });

  const active = (lists.data ?? []).filter((l) => !l.archivedAt);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="lg">
          <KanbanSquare className="h-4 w-4" strokeWidth={2.25} />
          Task lists
          <ChevronDown className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        {lists.isLoading ? (
          <div className="flex items-center justify-center py-6 text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          </div>
        ) : lists.isError ? (
          <p className="px-2 py-4 text-center text-[13px] text-brand-red">Could not load task lists.</p>
        ) : active.length === 0 ? (
          <p className="px-2 py-4 text-center text-[13px] text-ink-3">No task lists yet.</p>
        ) : (
          <ul className="max-h-72 overflow-auto">
            {active.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/projects/${projectSlug}/lists/${l.id}` as never}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded px-2 py-2 text-[14px] text-ink hover:bg-surface-muted"
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded',
                      pmoBgClass(l.iconColor),
                    )}
                  >
                    <LucideIcon name={l.iconName} className={cn('h-4 w-4', pmoFgClass(l.iconColor))} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  {l.projectKey ? (
                    <code className="shrink-0 text-[11px] text-ink-3">{l.projectKey}</code>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
