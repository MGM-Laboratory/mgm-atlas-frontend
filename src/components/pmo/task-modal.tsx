'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CalendarRange,
  Flag,
  MoreHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api, apiBeacon } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { useSaveSurface, SaveBadge } from '@/lib/save-coordinator';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { RichTextEditor } from '@/components/rich-text/editor';
import type { SessionUser, Task, TaskList, TaskPriority, TaskStatus } from '@/lib/types';
import { TASK_PRIORITY_LABEL, TASK_PRIORITY_ORDER } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ActivityFeed } from './activity-feed';
import { CommentsThread } from './comments-thread';
import {
  DatePickerPopover,
  formatDueDate,
  isOverdue,
} from './date-picker-popover';
import { MemberPicker, AssigneeStack } from './member-picker';
import { PriorityChip } from './priority-chip';
import { StatusDot, StatusPill } from './status-pill';

/**
 * Big task popup. Used in two surfaces:
 *
 *  - Inside `@modal/(.)tasks/[taskKey]/page.tsx` it renders as a Radix
 *    Dialog overlay over the current view. Closing returns the user to
 *    the route they came from.
 *  - At the non-intercepting `tasks/[taskKey]/page.tsx` it renders the
 *    same content full-page for direct URL hits / share links.
 *
 * Layout: header (key + title) → 2-column body (left: description +
 * comments, right rail: status / assignees / dates / priority /
 * story points / activity feed).
 */
export function TaskModal({
  projectSlug,
  taskKey,
  list,
  currentUser,
  canModerate,
  isDialog,
  onClose,
}: {
  projectSlug: string;
  taskKey: string;
  list: TaskList;
  currentUser: SessionUser | null;
  canModerate: boolean;
  /// `true` when rendered inside the intercepting Dialog slot.
  /// `false` for the standalone /tasks/:key fallback page.
  isDialog: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const task = useQuery({
    queryKey: queryKeys.pmo.taskByKey(projectSlug, taskKey),
    queryFn: () => api<Task>(apiPaths.pmo.tasks.byKey(projectSlug, taskKey)),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.taskByKey(projectSlug, taskKey) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.tasks(projectSlug, list.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.list(projectSlug, list.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.activity(projectSlug, task.data?.id ?? '') });
  };

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      api<Task>(apiPaths.pmo.tasks.one(projectSlug, task.data!.id), {
        method: 'PATCH',
        body,
      }),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      toast.show({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Could not update task',
        tone: 'danger',
      });
    },
  });

  const archive = useMutation({
    mutationFn: async () =>
      api<Task>(
        task.data?.archivedAt
          ? apiPaths.pmo.tasks.unarchive(projectSlug, task.data.id)
          : apiPaths.pmo.tasks.archive(projectSlug, task.data!.id),
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () =>
      api<{ ok: true }>(apiPaths.pmo.tasks.one(projectSlug, task.data!.id), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidate();
      toast.show({ title: 'Task deleted', tone: 'success' });
      handleClose();
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Could not delete',
        tone: 'danger',
      });
    },
  });

  const handleClose = React.useCallback(() => {
    if (onClose) onClose();
    else router.back();
  }, [onClose, router]);

  const body = task.isLoading ? (
    <ModalSkeleton />
  ) : task.isError || !task.data ? (
    <p className="p-8 text-center text-brand-red">Could not load this task.</p>
  ) : (
    <ModalBody
      projectSlug={projectSlug}
      list={list}
      task={task.data}
      currentUser={currentUser}
      canModerate={canModerate}
      onPatch={(body) => patch.mutate(body)}
      onArchive={() => archive.mutate()}
      onDelete={() => {
        if (confirm('Delete this task? This cannot be undone from the UI.')) {
          remove.mutate();
        }
      }}
      onClose={handleClose}
    />
  );

  if (isDialog) {
    return (
      <Dialog open onOpenChange={(open) => !open && handleClose()}>
        <DialogContent size="lg" className="max-h-[92vh] w-[min(1100px,96vw)] p-0">
          {/* Radix requires a title for a11y; we hide visually since the
              modal renders its own heading inside ModalBody. */}
          <DialogTitle className="sr-only">Task details</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="mx-auto max-w-container-wide overflow-hidden rounded-lg border border-line bg-white">
      {body}
    </div>
  );
}

function ModalBody({
  projectSlug,
  list,
  task,
  currentUser,
  canModerate,
  onPatch,
  onArchive,
  onDelete,
  onClose,
}: {
  projectSlug: string;
  list: TaskList;
  task: Task;
  currentUser: SessionUser | null;
  canModerate: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const completed = !!task.completedAt;
  const [titleDraft, setTitleDraft] = React.useState(task.title);
  React.useEffect(() => setTitleDraft(task.title), [task.title]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) onPatch({ title: trimmed });
    else setTitleDraft(task.title);
  };

  // Debounce description writes so every keystroke doesn't fire a PATCH.
  const lastDescriptionRef = React.useRef(task.description);
  React.useEffect(() => {
    lastDescriptionRef.current = task.description;
  }, [task.description]);
  const descriptionTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest pending JSON — captured on every keystroke so the
  // beforeunload / unmount flush can send the freshest version.
  const pendingDescription = React.useRef<object | null>(null);
  const surfaceId = `task:${task.id}`;

  const flushDescription = React.useCallback(
    (mode: 'async' | 'beacon') => {
      const next = pendingDescription.current;
      if (next === null) return;
      const prev = JSON.stringify(lastDescriptionRef.current ?? {});
      const nextSerial = JSON.stringify(next);
      if (prev === nextSerial) {
        pendingDescription.current = null;
        save.markSaved();
        return;
      }
      lastDescriptionRef.current = next as Record<string, unknown>;
      pendingDescription.current = null;
      if (mode === 'beacon') {
        apiBeacon(apiPaths.pmo.tasks.one(projectSlug, task.id), { description: next });
        save.markSaved();
      } else {
        onPatch({ description: next });
        save.markSaved();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, task.id, onPatch],
  );

  const save = useSaveSurface({
    surfaceId,
    flushNow: () => flushDescription('beacon'),
  });

  const handleDescriptionChange = (json: object) => {
    pendingDescription.current = json;
    save.markDirty();
    if (descriptionTimer.current) clearTimeout(descriptionTimer.current);
    descriptionTimer.current = setTimeout(() => flushDescription('async'), 800);
  };
  React.useEffect(
    () => () => {
      if (descriptionTimer.current) clearTimeout(descriptionTimer.current);
      flushDescription('beacon');
    },
    [flushDescription],
  );

  return (
    <div className="flex h-full max-h-[92vh] flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <StatusSelect
          list={list}
          currentStatus={task.status}
          onPick={(statusId) => onPatch({ statusId })}
        />
        <span className="font-mono text-[12px] text-ink-3">{task.key}</span>
        <SaveBadge surfaceId={surfaceId} />
        <Input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setTitleDraft(task.title);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            'h-9 flex-1 border-transparent bg-transparent text-[18px] font-semibold shadow-none focus-visible:border-line',
            completed && 'text-ink-3 line-through',
          )}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-grid h-8 w-8 place-items-center rounded text-ink-3 hover:bg-surface-muted"
              aria-label="Task actions"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onSelect={onArchive}>
              {task.archivedAt ? (
                <>
                  <ArchiveRestore className="h-4 w-4" strokeWidth={2.25} /> Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" strokeWidth={2.25} /> Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete}>
              <Trash2 className="h-4 w-4" strokeWidth={2.25} /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={onClose}
          className="inline-grid h-8 w-8 place-items-center rounded text-ink-3 hover:bg-surface-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </header>

      {/* Body: two columns */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_300px]">
        {/* Left: description + comments (scrollable) */}
        <div className="overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-2 text-[12px] uppercase tracking-[0.12em] text-ink-3">Description</h3>
            <RichTextEditor
              value={(task.description as object) ?? {}}
              onChange={handleDescriptionChange}
              placeholder="Add a description. Bold, italic, code, lists, links, images all supported."
              editable
            />
          </section>

          <hr className="my-6 border-line" />

          <CommentsThread
            projectSlug={projectSlug}
            taskId={task.id}
            currentUser={currentUser}
            canModerate={canModerate}
          />
        </div>

        {/* Right rail */}
        <aside className="overflow-y-auto border-t border-line bg-surface-muted/30 px-5 py-5 lg:border-l lg:border-t-0">
          <RightRail
            projectSlug={projectSlug}
            task={task}
            list={list}
            onPatch={onPatch}
          />
          <hr className="my-5 border-line" />
          <ActivityFeed projectSlug={projectSlug} taskId={task.id} />
        </aside>
      </div>
    </div>
  );
}

function RightRail({
  projectSlug,
  task,
  list,
  onPatch,
}: {
  projectSlug: string;
  task: Task;
  list: TaskList;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const overdueDue = isOverdue(task.dueDate, !!task.completedAt);

  return (
    <div className="space-y-4 text-[13px]">
      {/* Assignees */}
      <RailField icon={<Users className="h-3.5 w-3.5" strokeWidth={2.25} />} label="Assignees">
        <MemberPicker
          projectSlug={projectSlug}
          selectedIds={task.assignees.map((a) => a.userId)}
          onToggle={(userId) => {
            const current = task.assignees.map((a) => a.userId);
            const next = current.includes(userId)
              ? current.filter((id) => id !== userId)
              : [...current, userId];
            onPatch({ assigneeUserIds: next });
          }}
          align="end"
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-muted"
            >
              {task.assignees.length === 0 ? (
                <span className="text-[13px] text-ink-3">No one yet</span>
              ) : (
                <span className="flex items-center gap-2">
                  <AssigneeStack assignees={task.assignees.map((a) => a.user)} size={28} />
                  <span className="text-ink">
                    {task.assignees.length}{' '}
                    {task.assignees.length === 1 ? 'person' : 'people'}
                  </span>
                </span>
              )}
            </button>
          }
        />
      </RailField>

      {/* Start date */}
      <RailField icon={<CalendarRange className="h-3.5 w-3.5" strokeWidth={2.25} />} label="Start date">
        <DatePickerPopover
          value={task.startDate ? task.startDate.slice(0, 10) : null}
          onChange={(next) => onPatch({ startDate: next })}
          label="Start date"
          align="end"
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-muted"
            >
              <span className={cn(task.startDate ? 'text-ink' : 'text-ink-3')}>
                {task.startDate ? formatDueDate(task.startDate) : 'Set start date'}
              </span>
            </button>
          }
        />
      </RailField>

      {/* Due date */}
      <RailField icon={<Calendar className="h-3.5 w-3.5" strokeWidth={2.25} />} label="Due date">
        <DatePickerPopover
          value={task.dueDate ? task.dueDate.slice(0, 10) : null}
          onChange={(next) => onPatch({ dueDate: next })}
          label="Due date"
          align="end"
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-muted"
            >
              <span
                className={cn(
                  task.dueDate ? (overdueDue ? 'text-brand-red' : 'text-ink') : 'text-ink-3',
                )}
              >
                {task.dueDate ? formatDueDate(task.dueDate) : 'Set due date'}
              </span>
            </button>
          }
        />
      </RailField>

      {/* Priority */}
      <RailField icon={<Flag className="h-3.5 w-3.5" strokeWidth={2.25} />} label="Priority">
        <PriorityPicker priority={task.priority} onPick={(p) => onPatch({ priority: p })} />
      </RailField>

      {/* Story points */}
      <RailField label="Story points">
        <StoryPointsField
          value={task.storyPoints}
          onChange={(next) => onPatch({ storyPoints: next })}
        />
      </RailField>
    </div>
  );
}

function RailField({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-3">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function StatusSelect({
  list,
  currentStatus,
  onPick,
}: {
  list: TaskList;
  currentStatus: TaskStatus;
  onPick: (statusId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded px-2 py-1 hover:bg-surface-muted"
          aria-label={`Status: ${currentStatus.name}`}
        >
          <StatusDot status={currentStatus} />
          <span className="text-[13px] font-medium text-ink">{currentStatus.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {list.statuses
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick(s.id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors duration-120 ease-out-soft',
                s.id === currentStatus.id ? 'bg-brand-blue-50' : 'hover:bg-surface-muted',
              )}
            >
              <StatusPill status={s} size="sm" />
            </button>
          ))}
      </PopoverContent>
    </Popover>
  );
}

function PriorityPicker({
  priority,
  onPick,
}: {
  priority: TaskPriority;
  onPick: (priority: TaskPriority) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-muted"
          aria-label={`Priority: ${TASK_PRIORITY_LABEL[priority]}`}
        >
          <PriorityChip priority={priority} />
          <span className="text-ink">{TASK_PRIORITY_LABEL[priority]}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {TASK_PRIORITY_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onPick(p);
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors duration-120 ease-out-soft',
              p === priority ? 'bg-brand-blue-50' : 'hover:bg-surface-muted',
            )}
          >
            <PriorityChip priority={p} />
            <span>{TASK_PRIORITY_LABEL[p]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function StoryPointsField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value?.toString() ?? '');
  React.useEffect(() => setDraft(value?.toString() ?? ''), [value]);
  if (editing) {
    return (
      <Input
        type="number"
        min={0}
        max={1000}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = draft.trim() === '' ? null : Number(draft);
          if (n === value) return;
          if (n === null || (Number.isFinite(n) && n >= 0)) onChange(n);
          else setDraft(value?.toString() ?? '');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-8 w-24 text-[13px]"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-surface-muted"
    >
      <span className={cn('text-[13px]', value == null ? 'text-ink-3' : 'text-ink')}>
        {value == null ? 'Not estimated' : `${value} pts`}
      </span>
    </button>
  );
}

void Avatar;

function ModalSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-2/3 animate-pulse rounded bg-line" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
      <div className="h-40 animate-pulse rounded bg-line/70" />
    </div>
  );
}
