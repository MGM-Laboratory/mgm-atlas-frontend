'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Archive, MoreHorizontal, Plus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import type { TaskList } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { pmoBgClass, pmoFgClass } from './color-picker';
import { CreateListDialog } from './create-list-dialog';
import { ListSettingsDialog } from './list-settings-dialog';
import { LucideIcon } from './lucide-icon';

export function TaskListsSidebar({
  projectSlug,
  canManage,
}: {
  projectSlug: string;
  canManage: boolean;
}) {
  const pmoEnabled = isPmoEnabled();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TaskList | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  const lists = useQuery({
    enabled: pmoEnabled,
    queryKey: queryKeys.pmo.lists(projectSlug),
    queryFn: () => api<TaskList[]>(apiPaths.pmo.lists.list(projectSlug)),
  });

  if (!pmoEnabled) return null;

  const items = lists.data ?? [];
  const active = items.filter((l) => !l.archivedAt);
  const archived = items.filter((l) => !!l.archivedAt);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-eyebrow uppercase tracking-[0.12em] text-ink-3">Task lists</h3>
        {canManage ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-grid h-7 w-7 place-items-center rounded text-ink-3 transition-colors duration-120 ease-out-soft hover:bg-surface-muted hover:text-ink"
            aria-label="Create task list"
            title="Create task list"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {lists.isLoading ? (
        <ul className="space-y-1.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="h-9 animate-pulse rounded bg-line/70" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-ink-3">
          {canManage
            ? 'No task lists yet. Click + to create one for a role (Frontend, Backend, …).'
            : 'No task lists yet.'}
        </p>
      ) : (
        <>
          <ul className="space-y-1">
            {active.map((list) => (
              <ListSidebarRow
                key={list.id}
                projectSlug={projectSlug}
                list={list}
                canManage={canManage}
                onSettings={() => setEditing(list)}
              />
            ))}
          </ul>

          {archived.length > 0 ? (
            <div className="mt-3 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 hover:text-ink"
              >
                <Archive className="h-3 w-3" strokeWidth={2.25} />
                {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
              </button>
              {showArchived ? (
                <ul className="mt-2 space-y-1 opacity-70">
                  {archived.map((list) => (
                    <ListSidebarRow
                      key={list.id}
                      projectSlug={projectSlug}
                      list={list}
                      canManage={canManage}
                      onSettings={() => setEditing(list)}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {canManage ? (
        <CreateListDialog
          projectSlug={projectSlug}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      ) : null}
      {canManage && editing ? (
        <ListSettingsDialog
          projectSlug={projectSlug}
          list={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ListSidebarRow({
  projectSlug,
  list,
  canManage,
  onSettings,
}: {
  projectSlug: string;
  list: TaskList;
  canManage: boolean;
  onSettings: () => void;
}) {
  return (
    <li className="group relative">
      <Link
        href={`/projects/${projectSlug}/lists/${list.id}` as never}
        className={cn(
          'flex items-center gap-2.5 rounded px-2 py-1.5 pr-9 transition-colors duration-120 ease-out-soft',
          'text-[13px] text-ink hover:bg-surface-muted',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded',
            pmoBgClass(list.iconColor),
          )}
          aria-hidden
        >
          <LucideIcon
            name={list.iconName}
            className={cn('h-3.5 w-3.5', pmoFgClass(list.iconColor))}
          />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{list.name}</span>
        {list._count?.tasks ? (
          <span className="text-[11px] text-ink-3 tabular-nums">{list._count.tasks}</span>
        ) : null}
      </Link>
      {canManage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 inline-grid h-7 w-7 place-items-center rounded',
                'text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-line transition-opacity duration-120 ease-out-soft',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              )}
              aria-label="List settings"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onSelect={onSettings}>Settings…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}
