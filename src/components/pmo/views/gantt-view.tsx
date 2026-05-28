'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { ViewMode, type Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { Search } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { GanttPayload, Task, TaskList } from '@/lib/types';

// gantt-task-react reads from window during render, so it has to be
// client-side only. Avoid SSR mismatch by lazy-loading.
const Gantt = dynamic(() => import('gantt-task-react').then((m) => m.Gantt), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded bg-line" />,
});

interface Props {
  projectSlug: string;
  list: TaskList;
  canManage: boolean;
}

const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'Day', value: ViewMode.Day },
  { label: 'Week', value: ViewMode.Week },
  { label: 'Month', value: ViewMode.Month },
];

/**
 * Per-list gantt chart. Reads the lightweight `gantt` projection from
 * the backend (no rich-text description on the wire) and feeds it into
 * gantt-task-react. Tasks without start AND due dates render as a
 * faded "today→tomorrow" bar so users can drag them onto the timeline
 * to give them dates.
 *
 * Drag a bar end → PATCH /tasks/:id with the new start/due.
 * Click a bar  → opens the Phase 3 task popup via the parallel route.
 */
export function GanttView({ projectSlug, list, canManage }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [viewMode, setViewMode] = React.useState<ViewMode>(ViewMode.Week);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const ganttQ = useQuery({
    queryKey: queryKeys.pmo.gantt(projectSlug, list.id),
    queryFn: () => api<GanttPayload>(apiPaths.pmo.gantt(projectSlug, list.id)),
    staleTime: 10_000,
  });

  const patchDates = useMutation({
    mutationFn: async ({ taskId, body }: { taskId: string; body: Record<string, unknown> }) =>
      api<Task>(apiPaths.pmo.tasks.one(projectSlug, taskId), {
        method: 'PATCH',
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.gantt(projectSlug, list.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.tasks(projectSlug, list.id) });
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Could not update dates',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        tone: 'danger',
      });
    },
  });

  // Map our GanttPayload → gantt-task-react's Task[] shape.
  const ganttTasks: GanttTask[] = React.useMemo(() => {
    if (!ganttQ.data) return [];
    // Build a lookup of FS dependencies grouped by `from`.
    const depsByFrom = new Map<string, string[]>();
    for (const d of ganttQ.data.dependencies) {
      if (!depsByFrom.has(d.fromTaskId)) depsByFrom.set(d.fromTaskId, []);
      depsByFrom.get(d.fromTaskId)!.push(d.toTaskId);
    }
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    return ganttQ.data.tasks
      .filter((t) =>
        debouncedSearch ? t.title.toLowerCase().includes(debouncedSearch) : true,
      )
      .map((t) => {
        const hasDates = !!t.startDate || !!t.dueDate;
        const start = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : today;
        const end = t.dueDate ? new Date(t.dueDate) : t.startDate ? new Date(t.startDate) : tomorrow;
        // Guarantee end > start; otherwise gantt-task-react gets confused.
        const safeEnd = end.getTime() <= start.getTime() ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : end;
        const progress = t.completedAt ? 100 : t.statusCategory === 'IN_PROGRESS' ? 50 : 0;
        return {
          id: t.id,
          name: `${t.key}  ${t.title}`,
          start,
          end: safeEnd,
          progress,
          type: 'task' as const,
          isDisabled: !canManage,
          dependencies: depsByFrom.get(t.id) ?? [],
          styles: !hasDates
            ? {
                backgroundColor: '#e5e7eb',
                backgroundSelectedColor: '#d1d5db',
                progressColor: '#cbd5e1',
                progressSelectedColor: '#94a3b8',
              }
            : t.completedAt
              ? {
                  backgroundColor: '#0f8657',
                  backgroundSelectedColor: '#0d6c47',
                  progressColor: '#23a677',
                  progressSelectedColor: '#198555',
                }
              : undefined,
        };
      });
  }, [ganttQ.data, debouncedSearch, canManage]);

  const handleDateChange = (task: GanttTask) => {
    const original = ganttQ.data?.tasks.find((t) => t.id === task.id);
    if (!original) return;
    const startISO = task.start.toISOString().slice(0, 10);
    const endISO = task.end.toISOString().slice(0, 10);
    const body: Record<string, unknown> = {};
    if (startISO !== (original.startDate?.slice(0, 10) ?? null)) body.startDate = startISO;
    if (endISO !== (original.dueDate?.slice(0, 10) ?? null)) body.dueDate = endISO;
    if (Object.keys(body).length === 0) return;
    patchDates.mutate({ taskId: task.id, body });
  };

  const handleClick = (task: GanttTask) => {
    const original = ganttQ.data?.tasks.find((t) => t.id === task.id);
    if (!original) return;
    router.push(`/projects/${projectSlug}/lists/${list.id}/tasks/${original.key}` as never);
  };

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
        <div className="inline-flex rounded border border-line bg-white p-0.5">
          {VIEW_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setViewMode(m.value)}
              className={cn(
                'rounded px-3 py-1 text-[12px] font-medium transition-colors duration-120 ease-out-soft',
                m.value === viewMode
                  ? 'bg-brand-blue text-white shadow-1'
                  : 'text-ink-2 hover:bg-surface-muted',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {ganttQ.isLoading ? (
        <div className="h-64 animate-pulse rounded bg-line" />
      ) : ganttQ.isError ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
          Could not load timeline.
        </p>
      ) : ganttTasks.length === 0 ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-center text-[13px] text-ink-3">
          No tasks to show. Create one from the List or Kanban tab and it will appear here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            onClick={handleClick}
            listCellWidth=""
            columnWidth={viewMode === ViewMode.Month ? 250 : viewMode === ViewMode.Week ? 100 : 60}
            ganttHeight={Math.min(Math.max(ganttTasks.length * 50 + 60, 240), 720)}
          />
        </div>
      )}

      {/* Footnote */}
      {ganttQ.data && ganttQ.data.tasks.some((t) => !t.startDate && !t.dueDate) ? (
        <p className="text-[12px] text-ink-3">
          Faded bars mark tasks without start/due dates — drag a bar end to set them.
        </p>
      ) : null}
    </div>
  );
}

// Reference so noUnusedParameters doesn't bark when canManage is later passed through.
void Button;
