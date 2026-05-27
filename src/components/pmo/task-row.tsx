'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { useToast } from '@/components/ui/toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Task, TaskList, TaskPriority, TaskStatus } from '@/lib/types';
import { TASK_PRIORITY_LABEL, TASK_PRIORITY_ORDER } from '@/lib/types';
import { AssigneeStack, MemberPicker } from './member-picker';
import { DatePickerPopover, formatDueDate, isOverdue } from './date-picker-popover';
import { PriorityChip } from './priority-chip';
import { StatusDot, StatusPill } from './status-pill';

export function TaskRow({
  projectSlug,
  list,
  task,
  canEdit,
}: {
  projectSlug: string;
  list: TaskList;
  task: Task;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.tasks(projectSlug, list.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.task(projectSlug, task.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.list(projectSlug, list.id) });
  };

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      api<Task>(apiPaths.pmo.tasks.one(projectSlug, task.id), {
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
        task.archivedAt
          ? apiPaths.pmo.tasks.unarchive(projectSlug, task.id)
          : apiPaths.pmo.tasks.archive(projectSlug, task.id),
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () =>
      api<{ ok: true }>(apiPaths.pmo.tasks.one(projectSlug, task.id), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidate();
      toast.show({ title: 'Task deleted', tone: 'success' });
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Could not delete',
        tone: 'danger',
      });
    },
  });

  const completed = !!task.completedAt;
  const overdue = isOverdue(task.dueDate, completed);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 border-b border-line px-3 py-2 transition-colors duration-120 ease-out-soft hover:bg-surface-muted/60',
        task.archivedAt && 'opacity-60',
      )}
    >
      {/* Status pill */}
      <StatusSelect
        list={list}
        currentStatus={task.status}
        canEdit={canEdit}
        onPick={(statusId) => patch.mutate({ statusId })}
      />

      {/* Key */}
      <Link
        href={`/projects/${projectSlug}/lists/${list.id}/tasks/${task.key}` as never}
        className="shrink-0 font-mono text-[11px] text-ink-3 hover:text-ink"
        title="Open task"
      >
        {task.key}
      </Link>

      {/* Title (inline edit on dbl-click) */}
      <InlineTitle
        title={task.title}
        canEdit={canEdit}
        completed={completed}
        onSave={(next) => {
          if (next !== task.title) patch.mutate({ title: next });
        }}
      />

      {/* Right rail */}
      <div className="ml-auto flex items-center gap-2.5">
        <PrioritySelect
          priority={task.priority}
          canEdit={canEdit}
          onPick={(p) => patch.mutate({ priority: p })}
        />

        <MemberPicker
          projectSlug={projectSlug}
          selectedIds={task.assignees.map((a) => a.userId)}
          onToggle={(userId) => {
            const current = task.assignees.map((a) => a.userId);
            const next = current.includes(userId)
              ? current.filter((id) => id !== userId)
              : [...current, userId];
            patch.mutate({ assigneeUserIds: next });
          }}
          align="end"
          trigger={
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors duration-120 ease-out-soft',
                canEdit ? 'hover:bg-line' : 'cursor-default',
              )}
              disabled={!canEdit}
            >
              <AssigneeStack assignees={task.assignees.map((a) => a.user)} />
            </button>
          }
        />

        <DatePickerPopover
          value={task.dueDate ? task.dueDate.slice(0, 10) : null}
          onChange={(next) => patch.mutate({ dueDate: next })}
          align="end"
          label="Due date"
          trigger={
            <button
              type="button"
              disabled={!canEdit}
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] tabular-nums transition-colors duration-120 ease-out-soft',
                canEdit ? 'hover:bg-line' : 'cursor-default',
                overdue ? 'text-brand-red' : 'text-ink-2',
                !task.dueDate && 'text-ink-3',
              )}
              title={task.dueDate ? new Date(task.dueDate).toDateString() : 'Set due date'}
            >
              <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} />
              {task.dueDate ? formatDueDate(task.dueDate) : 'No date'}
            </button>
          }
        />

        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-brand-green" strokeWidth={2.5} />
        ) : null}

        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-grid h-7 w-7 place-items-center rounded text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-line transition-opacity duration-120 ease-out-soft focus-visible:opacity-100"
                aria-label="Task actions"
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onSelect={() => archive.mutate()}>
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
              <DropdownMenuItem
                onSelect={() => {
                  if (confirm('Delete this task? This cannot be undone from the UI.')) {
                    remove.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.25} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

function InlineTitle({
  title,
  canEdit,
  completed,
  onSave,
}: {
  title: string;
  canEdit: boolean;
  completed: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(title);
  React.useEffect(() => setDraft(title), [title]);
  if (editing && canEdit) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim()) onSave(draft.trim());
          else setDraft(title);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setDraft(title);
            setEditing(false);
          }
        }}
        className="h-7 flex-1 text-[14px]"
      />
    );
  }
  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => {
        if (canEdit) setEditing(true);
      }}
      className={cn(
        'flex-1 truncate text-left text-[14px] transition-colors duration-120 ease-out-soft',
        completed ? 'text-ink-3 line-through' : 'text-ink',
        canEdit && 'hover:text-brand-blue',
      )}
    >
      {title}
    </button>
  );
}

function StatusSelect({
  list,
  currentStatus,
  canEdit,
  onPick,
}: {
  list: TaskList;
  currentStatus: TaskStatus;
  canEdit: boolean;
  onPick: (statusId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  if (!canEdit) {
    return (
      <span className="inline-flex items-center" title={currentStatus.name}>
        <StatusDot status={currentStatus} />
      </span>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded p-1 hover:bg-line"
          aria-label={`Status: ${currentStatus.name}`}
          title={currentStatus.name}
        >
          <StatusDot status={currentStatus} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
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

function PrioritySelect({
  priority,
  canEdit,
  onPick,
}: {
  priority: TaskPriority;
  canEdit: boolean;
  onPick: (priority: TaskPriority) => void;
}) {
  const [open, setOpen] = React.useState(false);
  if (!canEdit) {
    return <PriorityChip priority={priority} />;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded p-1 hover:bg-line"
          aria-label={`Priority: ${TASK_PRIORITY_LABEL[priority]}`}
        >
          <PriorityChip priority={priority} />
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
