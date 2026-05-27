'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Filter, Search, Settings2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task, TaskList } from '@/lib/types';
import { NewTaskRow } from '../new-task-row';
import { StatusManagerDialog } from '../status-manager-dialog';
import { StatusDot } from '../status-pill';
import { TaskRow } from '../task-row';

interface TaskListWithExtras extends TaskList {
  statuses: TaskList['statuses'];
}

export function ListView({
  projectSlug,
  list,
  canManage,
}: {
  projectSlug: string;
  list: TaskListWithExtras;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [statusManagerOpen, setStatusManagerOpen] = React.useState(false);
  const [collapsedStatusIds, setCollapsedStatusIds] = React.useState<Set<string>>(new Set());

  // Debounce search → only fire query when it stops changing for 250ms.
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filters = {
    q: debouncedSearch || undefined,
    includeArchived: includeArchived || undefined,
  };

  const tasks = useQuery({
    queryKey: queryKeys.pmo.tasks(projectSlug, list.id, filters),
    queryFn: () =>
      api<Task[]>(apiPaths.pmo.tasks.list(projectSlug, list.id, filters)),
    staleTime: 5_000,
  });

  // Contributors can create tasks only if the list allows it. Managers / admins
  // can always create. Frontend gate matches backend's contributorsCanCreateTasks.
  const canCreateTasks = canManage || list.contributorsCanCreateTasks;
  const canEditTasks = true; // any insider can edit; backend enforces

  // Group tasks by statusId, sorted by status order. Within each group sort
  // by due date asc with nulls last, then position.
  const grouped = React.useMemo(() => {
    const orderedStatuses = list.statuses.slice().sort((a, b) => a.order - b.order);
    const map = new Map<string, Task[]>();
    for (const s of orderedStatuses) map.set(s.id, []);
    for (const t of tasks.data ?? []) {
      if (!map.has(t.statusId)) map.set(t.statusId, []);
      map.get(t.statusId)!.push(t);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (ad !== bd) return ad - bd;
        return Number(a.positionInStatus) - Number(b.positionInStatus);
      });
    }
    return orderedStatuses.map((s) => ({ status: s, tasks: map.get(s.id) ?? [] }));
  }, [list.statuses, tasks.data]);

  const toggleCollapse = (id: string) => {
    setCollapsedStatusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleArchived = useMutation({
    mutationFn: async (next: boolean) => {
      setIncludeArchived(next);
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.tasks(projectSlug, list.id) });
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            strokeWidth={2.25}
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 pl-8 text-[13px]"
            aria-label="Search tasks"
          />
        </div>
        <Button
          variant={includeArchived ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => toggleArchived.mutate(!includeArchived)}
          aria-pressed={includeArchived}
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={2.25} />
          {includeArchived ? 'Hide archived' : 'Show archived'}
        </Button>
        {canManage ? (
          <Button variant="ghost" size="sm" onClick={() => setStatusManagerOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            Manage statuses
          </Button>
        ) : null}
      </div>

      {/* Status groups */}
      {tasks.isLoading ? (
        <ListSkeleton />
      ) : tasks.isError ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
          Could not load tasks.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ status, tasks: rows }) => {
            const collapsed = collapsedStatusIds.has(status.id);
            return (
              <section
                key={status.id}
                className="overflow-hidden rounded-lg border border-line bg-white"
              >
                <header className="flex items-center gap-2 border-b border-line px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(status.id)}
                    className="inline-grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-surface-muted"
                    aria-label={collapsed ? 'Expand' : 'Collapse'}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-120 ease-out-soft',
                        collapsed && '-rotate-90',
                      )}
                      strokeWidth={2.5}
                    />
                  </button>
                  <StatusDot status={status} />
                  <h3 className="font-medium text-[13px] text-ink">{status.name}</h3>
                  <span className="text-[11px] text-ink-3 tabular-nums">{rows.length}</span>
                </header>

                {!collapsed ? (
                  <>
                    {rows.length === 0 ? (
                      <p className="px-3 py-2.5 text-[12px] text-ink-3">No tasks yet.</p>
                    ) : (
                      rows.map((t) => (
                        <TaskRow
                          key={t.id}
                          projectSlug={projectSlug}
                          list={list}
                          task={t}
                          canEdit={canEditTasks}
                        />
                      ))
                    )}
                    {canCreateTasks ? (
                      <NewTaskRow
                        projectSlug={projectSlug}
                        listId={list.id}
                        statusId={status.id}
                      />
                    ) : null}
                  </>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {canManage ? (
        <StatusManagerDialog
          projectSlug={projectSlug}
          list={list}
          open={statusManagerOpen}
          onOpenChange={setStatusManagerOpen}
        />
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="border-b border-line p-3">
            <div className="h-4 w-32 animate-pulse rounded bg-line" />
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="h-7 animate-pulse rounded bg-line/70" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
