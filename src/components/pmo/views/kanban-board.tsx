'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Search, Settings2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { useSaveSurface, SaveBadge } from '@/lib/save-coordinator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Task, TaskList, TaskStatus } from '@/lib/types';
import { computePosition } from '../fractional-index';
import { KanbanCard } from '../kanban-card';
import { NewTaskRow } from '../new-task-row';
import { StatusManagerDialog } from '../status-manager-dialog';
import { StatusDot } from '../status-pill';

interface Props {
  projectSlug: string;
  list: TaskList;
  canManage: boolean;
}

interface ColumnData {
  status: TaskStatus;
  tasks: Task[];
}

export function KanbanBoard({ projectSlug, list, canManage }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusManagerOpen, setStatusManagerOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filters = { q: debouncedSearch || undefined };
  const tasksQueryKey = queryKeys.pmo.tasks(projectSlug, list.id, filters);

  const tasks = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => api<Task[]>(apiPaths.pmo.tasks.list(projectSlug, list.id, filters)),
    staleTime: 5_000,
  });

  // Local copy for optimistic moves. Sync from server data whenever it
  // arrives, BUT skip any task currently mid-flight so we don't clobber
  // its optimistic state with a possibly-stale server snapshot.
  //
  // This is the fix for the reported "dragged a card but it snapped
  // back" bug: previously `move.onSuccess` invalidated the query,
  // and on the fresh refetch the useEffect would re-seed localTasks
  // from data that hadn't yet observed the move (or had observed the
  // first of two rapid drags but not the second).
  const pendingMoves = React.useRef<Set<string>>(new Set());
  const [localTasks, setLocalTasks] = React.useState<Task[]>([]);
  React.useEffect(() => {
    if (!tasks.data) return;
    setLocalTasks((prev) => {
      if (pendingMoves.current.size === 0) return tasks.data!;
      const prevById = new Map(prev.map((t) => [t.id, t]));
      return tasks.data!.map((t) =>
        pendingMoves.current.has(t.id) ? prevById.get(t.id) ?? t : t,
      );
    });
  }, [tasks.data]);

  const save = useSaveSurface({
    surfaceId: `kanban:${list.id}`,
    // Kanban mutations are real PATCHes that have already been fired
    // (or are about to be) — there is nothing to flush via beacon.
    // The surface registration still gates the beforeunload warning
    // while a move is in-flight.
    flushNow: () => {},
  });

  const columns: ColumnData[] = React.useMemo(() => {
    const orderedStatuses = list.statuses.slice().sort((a, b) => a.order - b.order);
    const byStatus = new Map<string, Task[]>();
    for (const s of orderedStatuses) byStatus.set(s.id, []);
    for (const t of localTasks) {
      if (!byStatus.has(t.statusId)) byStatus.set(t.statusId, []);
      byStatus.get(t.statusId)!.push(t);
    }
    for (const arr of byStatus.values()) {
      arr.sort((a, b) => Number(a.positionInStatus) - Number(b.positionInStatus));
    }
    return orderedStatuses.map((s) => ({ status: s, tasks: byStatus.get(s.id) ?? [] }));
  }, [list.statuses, localTasks]);

  const activeTask = activeId ? localTasks.find((t) => t.id === activeId) : null;

  const sensors = useSensors(
    // 6px activation distance so a click-to-open doesn't accidentally start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = useMutation({
    mutationFn: async ({
      taskId,
      statusId,
      positionInStatus,
    }: {
      taskId: string;
      statusId: string;
      positionInStatus: number;
    }) =>
      api<Task>(apiPaths.pmo.tasks.move(projectSlug, taskId), {
        method: 'PATCH',
        body: { statusId, positionInStatus },
      }),
    onMutate: (vars) => {
      pendingMoves.current.add(vars.taskId);
      save.markSaving();
    },
    onSuccess: (returned, vars) => {
      // Merge the server's authoritative row into every cached page
      // for this list. We deliberately do NOT call invalidateQueries
      // here — that triggers a refetch which can race against a
      // subsequent in-flight move and snap the card back to a pre-
      // move state. setQueryData is idempotent and avoids the round
      // trip entirely.
      queryClient.setQueriesData<Task[]>(
        { queryKey: queryKeys.pmo.tasks(projectSlug, list.id) },
        (cur) => (cur ? cur.map((t) => (t.id === returned.id ? returned : t)) : cur),
      );
      setLocalTasks((cur) => cur.map((t) => (t.id === returned.id ? returned : t)));
      pendingMoves.current.delete(vars.taskId);
      if (pendingMoves.current.size === 0) save.markSaved();
    },
    onError: (err: unknown, vars) => {
      pendingMoves.current.delete(vars.taskId);
      // Roll back THIS task by refetching — only safe now that no
      // other move is in flight for it.
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      save.markError(err instanceof Error ? err.message : `Move failed`);
      toast.show({
        title: 'Move failed',
        description: err instanceof Error ? err.message : `Could not move task ${vars.taskId}`,
        tone: 'danger',
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // Cross-column live preview: when the user drags over a card in a
  // different column, splice the active task into that column's local
  // array so the user sees an immediate visual reorder. The actual PATCH
  // doesn't fire until onDragEnd.
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    setLocalTasks((prev) => {
      const activeTask = prev.find((t) => t.id === activeIdStr);
      if (!activeTask) return prev;

      // Resolve the target column. `over.id` might be:
      // (a) another task in some column (most common)
      // (b) the column's empty droppable ('column:<statusId>')
      let targetStatusId = activeTask.statusId;
      const overTask = prev.find((t) => t.id === overIdStr);
      if (overTask) {
        targetStatusId = overTask.statusId;
      } else if (overIdStr.startsWith('column:')) {
        targetStatusId = overIdStr.slice('column:'.length);
      } else {
        return prev;
      }

      if (activeTask.statusId === targetStatusId) return prev;

      // Move the active task to the target column at the *end* of the
      // visible items for now. handleDragEnd will resolve the precise
      // index based on the drop position.
      return prev.map((t) =>
        t.id === activeIdStr
          ? {
              ...t,
              statusId: targetStatusId,
            }
          : t,
      );
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const activeTaskRow = localTasks.find((t) => t.id === activeIdStr);
    if (!activeTaskRow) return;

    // Resolve target column + insertion index.
    let targetStatusId = activeTaskRow.statusId;
    let targetIndex = -1;

    if (overIdStr.startsWith('column:')) {
      targetStatusId = overIdStr.slice('column:'.length);
      targetIndex = columnsByStatus().get(targetStatusId)?.length ?? 0;
    } else {
      const overTask = localTasks.find((t) => t.id === overIdStr);
      if (!overTask) return;
      targetStatusId = overTask.statusId;
      const targetCol = columnsByStatus().get(targetStatusId) ?? [];
      targetIndex = targetCol.findIndex((t) => t.id === overIdStr);
      if (targetIndex === -1) targetIndex = targetCol.length;
    }

    // Build the target column WITHOUT the active task, then insert it at
    // targetIndex to pin down its neighbours for fractional indexing.
    const colWithoutActive = (columnsByStatus().get(targetStatusId) ?? []).filter(
      (t) => t.id !== activeIdStr,
    );
    const prev = targetIndex > 0 ? colWithoutActive[targetIndex - 1] : undefined;
    const next = colWithoutActive[targetIndex];
    const newPos = computePosition(
      prev ? Number(prev.positionInStatus) : undefined,
      next ? Number(next.positionInStatus) : undefined,
    );

    // Apply optimistic update locally.
    setLocalTasks((items) =>
      items.map((t) =>
        t.id === activeIdStr
          ? {
              ...t,
              statusId: targetStatusId,
              positionInStatus: String(newPos),
            }
          : t,
      ),
    );

    // No-op if nothing actually changed (same status + adjacent slot).
    if (
      activeTaskRow.statusId === targetStatusId &&
      Number(activeTaskRow.positionInStatus) === newPos
    ) {
      return;
    }

    move.mutate({ taskId: activeIdStr, statusId: targetStatusId, positionInStatus: newPos });
  };

  // Build columns lookup from the latest localTasks (helper closures
  // above call this lazily so they don't capture a stale closure).
  const columnsByStatus = () => {
    const m = new Map<string, Task[]>();
    for (const s of list.statuses) m.set(s.id, []);
    for (const t of localTasks) {
      if (!m.has(t.statusId)) m.set(t.statusId, []);
      m.get(t.statusId)!.push(t);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => Number(a.positionInStatus) - Number(b.positionInStatus));
    }
    return m;
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
        {canManage ? (
          <Button variant="ghost" size="sm" onClick={() => setStatusManagerOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            Manage statuses
          </Button>
        ) : null}
        <SaveBadge surfaceId={`kanban:${list.id}`} className="ml-auto" />
      </div>

      {tasks.isLoading ? (
        <KanbanSkeleton statusCount={list.statuses.length} />
      ) : tasks.isError ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
          Could not load tasks.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="-mx-2 flex gap-3 overflow-x-auto pb-3">
            {columns.map((col) => (
              <KanbanColumn
                key={col.status.id}
                projectSlug={projectSlug}
                list={list}
                column={col}
                canCreate={canManage || list.contributorsCanCreateTasks}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <KanbanCard projectSlug={projectSlug} list={list} task={activeTask} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
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

function KanbanColumn({
  projectSlug,
  list,
  column,
  canCreate,
}: {
  projectSlug: string;
  list: TaskList;
  column: ColumnData;
  canCreate: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.status.id}`,
    data: { type: 'column', statusId: column.status.id },
  });

  const ids = column.tasks.map((t) => t.id);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-[280px] shrink-0 flex-col rounded-lg border border-line bg-surface-muted/40',
        isOver && 'ring-2 ring-brand-blue/40',
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot status={column.status} />
          <h3 className="truncate text-[13px] font-medium text-ink">{column.status.name}</h3>
          <span className="text-[11px] tabular-nums text-ink-3">{column.tasks.length}</span>
        </div>
      </header>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        <SortableContext id={column.status.id} items={ids} strategy={verticalListSortingStrategy}>
          {column.tasks.map((t) => (
            <ActiveAwareCard key={t.id} projectSlug={projectSlug} list={list} task={t} />
          ))}
        </SortableContext>
        {column.tasks.length === 0 ? (
          <p className="rounded border border-dashed border-line py-3 text-center text-[11px] text-ink-3">
            Drop tasks here
          </p>
        ) : null}
      </div>

      {/* New task composer */}
      {canCreate ? (
        <div className="border-t border-line">
          <NewTaskRow
            projectSlug={projectSlug}
            listId={list.id}
            statusId={column.status.id}
          />
        </div>
      ) : (
        <div className="px-3 py-2 text-[11px] text-ink-3">
          <Plus className="mr-1 inline h-3 w-3" strokeWidth={2.25} />
          Contributor task creation disabled
        </div>
      )}
    </section>
  );
}

/**
 * Tiny wrapper that drops `dragging=true` on the matched card so we can
 * dim the original slot while DragOverlay paints the drag preview.
 * Reads the active id straight from dnd-kit's internal `useDndMonitor`
 * via a lightweight hook surface (we just consume `useSortable`'s
 * `isDragging` flag from the card itself, no extra wiring needed).
 */
function ActiveAwareCard({
  projectSlug,
  list,
  task,
}: {
  projectSlug: string;
  list: TaskList;
  task: Task;
}) {
  return <KanbanCard projectSlug={projectSlug} list={list} task={task} />;
}

function KanbanSkeleton({ statusCount }: { statusCount: number }) {
  return (
    <div className="-mx-2 flex gap-3 overflow-x-auto pb-3">
      {Array.from({ length: Math.max(3, statusCount) }).map((_, i) => (
        <div key={i} className="w-[280px] shrink-0 rounded-lg border border-line bg-white p-2">
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-line" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-20 animate-pulse rounded bg-line/70" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
