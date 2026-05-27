'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowRight,
  Calendar,
  CalendarX,
  CheckCircle2,
  CircleDot,
  Flag,
  Link2,
  Link2Off,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Avatar } from '@/components/ui/avatar';
import type { PaginatedActivity, TaskActivity, TaskActivityKind } from '@/lib/types';

/**
 * Read-only feed of TaskActivity rows for the right rail. One line per
 * event, newest first; collapsible by default to keep the modal tidy.
 */
export function ActivityFeed({
  projectSlug,
  taskId,
}: {
  projectSlug: string;
  taskId: string;
}) {
  const activity = useQuery({
    queryKey: queryKeys.pmo.activity(projectSlug, taskId),
    queryFn: () => api<PaginatedActivity>(apiPaths.pmo.activity(projectSlug, taskId)),
    staleTime: 10_000,
  });

  const items = activity.data?.items ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink-3">
        <Activity className="h-3.5 w-3.5" strokeWidth={2.25} />
        Activity
      </div>
      {activity.isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-line/60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[12px] text-ink-3">No activity yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((ev) => (
            <li key={ev.id} className="flex items-start gap-2 text-[12px] text-ink-2">
              <span className="mt-px shrink-0 text-ink-3">{kindIcon(ev.kind)}</span>
              {ev.actor ? (
                <Avatar src={ev.actor.avatarUrl} name={ev.actor.name} size={24} />
              ) : (
                <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-surface-muted text-[10px] text-ink-3">
                  sys
                </span>
              )}
              <span className="min-w-0 flex-1">
                {renderActivity(ev)}
                <span className="ml-1.5 text-ink-3">· {formatTimeAgo(ev.createdAt)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function kindIcon(kind: TaskActivityKind): React.ReactNode {
  const cls = 'h-3.5 w-3.5';
  switch (kind) {
    case 'CREATED':
      return <Sparkles className={cls} strokeWidth={2.25} />;
    case 'RENAMED':
      return <Pencil className={cls} strokeWidth={2.25} />;
    case 'DESCRIPTION_EDITED':
      return <Pencil className={cls} strokeWidth={2.25} />;
    case 'STATUS_CHANGED':
      return <ArrowRight className={cls} strokeWidth={2.25} />;
    case 'PRIORITY_CHANGED':
      return <Flag className={cls} strokeWidth={2.25} />;
    case 'ASSIGNED':
      return <UserPlus className={cls} strokeWidth={2.25} />;
    case 'UNASSIGNED':
      return <UserMinus className={cls} strokeWidth={2.25} />;
    case 'DUE_DATE_SET':
    case 'START_DATE_SET':
      return <Calendar className={cls} strokeWidth={2.25} />;
    case 'DUE_DATE_CLEARED':
      return <CalendarX className={cls} strokeWidth={2.25} />;
    case 'DEPENDENCY_ADDED':
      return <Link2 className={cls} strokeWidth={2.25} />;
    case 'DEPENDENCY_REMOVED':
      return <Link2Off className={cls} strokeWidth={2.25} />;
    case 'COMMENT_ADDED':
      return <MessageCircle className={cls} strokeWidth={2.25} />;
    case 'ATTACHMENT_ADDED':
      return <Paperclip className={cls} strokeWidth={2.25} />;
    case 'ARCHIVED':
      return <Archive className={cls} strokeWidth={2.25} />;
    case 'UNARCHIVED':
      return <ArchiveRestore className={cls} strokeWidth={2.25} />;
    case 'COMPLETED':
      return <CheckCircle2 className={cls} strokeWidth={2.25} />;
    case 'REOPENED':
      return <CircleDot className={cls} strokeWidth={2.25} />;
    case 'MENTIONED':
      return <UserPlus className={cls} strokeWidth={2.25} />;
    default:
      return <Plus className={cls} strokeWidth={2.25} />;
  }
}

function renderActivity(ev: TaskActivity): React.ReactNode {
  const who = ev.actor ? <strong className="text-ink">{ev.actor.name}</strong> : <span>System</span>;
  const payload = ev.payload as Record<string, unknown>;
  switch (ev.kind) {
    case 'CREATED':
      return <>{who} created this task</>;
    case 'RENAMED':
      return (
        <>
          {who} renamed task to{' '}
          <em>“{(payload.after as string | undefined) ?? 'untitled'}”</em>
        </>
      );
    case 'DESCRIPTION_EDITED':
      return <>{who} edited the description</>;
    case 'STATUS_CHANGED':
      return <>{who} changed status</>;
    case 'PRIORITY_CHANGED':
      return (
        <>
          {who} set priority to <strong>{String(payload.after ?? 'NONE')}</strong>
        </>
      );
    case 'ASSIGNED':
      return <>{who} added an assignee</>;
    case 'UNASSIGNED':
      return <>{who} removed an assignee</>;
    case 'DUE_DATE_SET':
      return (
        <>
          {who} set the due date{' '}
          {payload.after ? (
            <em>{new Date(payload.after as string).toLocaleDateString()}</em>
          ) : null}
        </>
      );
    case 'DUE_DATE_CLEARED':
      return <>{who} cleared the due date</>;
    case 'START_DATE_SET':
      return <>{who} set the start date</>;
    case 'COMMENT_ADDED':
      return <>{who} commented</>;
    case 'MENTIONED':
      return <>{who} mentioned someone</>;
    case 'ATTACHMENT_ADDED':
      return <>{who} added an attachment</>;
    case 'ARCHIVED':
      return <>{who} archived this task</>;
    case 'UNARCHIVED':
      return <>{who} unarchived this task</>;
    case 'COMPLETED':
      return <>{who} marked this done</>;
    case 'REOPENED':
      return <>{who} reopened this task</>;
    case 'DEPENDENCY_ADDED':
      return <>{who} added a dependency</>;
    case 'DEPENDENCY_REMOVED':
      return <>{who} removed a dependency</>;
    default:
      return <>{who} updated this task</>;
  }
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const min = Math.floor((now - then) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
