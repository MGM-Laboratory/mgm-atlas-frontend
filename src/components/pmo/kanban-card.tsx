'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckCircle2, MessageSquare } from 'lucide-react';
import type { Task, TaskList } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AssigneeStack } from './member-picker';
import { formatDueDate, isOverdue } from './date-picker-popover';
import { PriorityChip } from './priority-chip';

interface Props {
  projectSlug: string;
  list: TaskList;
  task: Task;
  /** True while *this* card is the one being dragged. */
  dragging?: boolean;
  /** True when shown inside <DragOverlay> (no transforms applied). */
  overlay?: boolean;
}

/**
 * Sortable card body. Wrapped by useSortable to wire drag events.
 * Clicking the card opens the task detail popup via Phase 3's parallel
 * route, so the same URL pattern works from List and Kanban views.
 */
export function KanbanCard({ projectSlug, list, task, dragging, overlay }: Props) {
  const sortable = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style: React.CSSProperties = overlay
    ? { cursor: 'grabbing' }
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: dragging ? 0 : 1,
      };

  const completed = !!task.completedAt;
  const overdue = isOverdue(task.dueDate, completed);

  const cardInner = (
    <article
      className={cn(
        'rounded-md border border-line bg-white p-3 shadow-1 transition-shadow duration-120 ease-out-soft',
        'hover:shadow-2 hover:border-line-strong',
        overlay && 'shadow-3 ring-2 ring-brand-blue/40',
        task.archivedAt && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
            <code className="font-mono">{task.key}</code>
            <PriorityChip priority={task.priority} />
          </div>
          <p
            className={cn(
              'mt-0.5 line-clamp-3 text-[14px] font-medium leading-snug',
              completed ? 'text-ink-3 line-through' : 'text-ink',
            )}
          >
            {task.title}
          </p>
        </span>
      </div>

      {(task.dueDate || task.assignees.length > 0 || completed) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            {task.dueDate ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] tabular-nums',
                  overdue ? 'text-brand-red' : 'text-ink-3',
                )}
                title={new Date(task.dueDate).toDateString()}
              >
                <Calendar className="h-3 w-3" strokeWidth={2.25} />
                {formatDueDate(task.dueDate)}
              </span>
            ) : null}
            {completed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" strokeWidth={2.5} />
            ) : null}
          </div>
          {task.assignees.length > 0 ? (
            <AssigneeStack assignees={task.assignees.map((a) => a.user)} size={24} />
          ) : null}
        </div>
      )}
    </article>
  );

  if (overlay) {
    return <div className="w-[280px]">{cardInner}</div>;
  }

  // Wrap the card so the *entire* card is the drag handle, but the
  // inner Link still navigates on a plain click. dnd-kit distinguishes
  // drag vs click via the activationConstraint on the sensor.
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      className="cursor-grab"
    >
      <Link
        href={`/projects/${projectSlug}/lists/${list.id}/tasks/${task.key}` as never}
        // Stop propagation so clicks don't trigger the sortable's pointer-down
        // handlers (sensors already gate by distance, but this is belt-and-braces).
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        {cardInner}
      </Link>
    </div>
  );
}

// Suppress dead-code warning if MessageSquare is later removed from this file.
void MessageSquare;
