'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MoreHorizontal, Pencil, Reply, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SessionUser, TaskComment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MarkdownRender } from './markdown-render';

export function CommentItem({
  projectSlug,
  taskId,
  comment,
  currentUser,
  canModerate,
  onReply,
  nested,
}: {
  projectSlug: string;
  taskId: string;
  comment: TaskComment;
  currentUser: SessionUser | null;
  canModerate: boolean;
  onReply?: (c: TaskComment) => void;
  nested?: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(comment.markdown);
  React.useEffect(() => setDraft(comment.markdown), [comment.markdown]);

  const isAuthor = currentUser?.id === comment.author.id;
  const isDeleted = !!comment.deletedAt;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.comments(projectSlug, taskId) });
  };

  const save = useMutation({
    mutationFn: async () =>
      api<TaskComment>(apiPaths.pmo.comments.update(projectSlug, comment.id), {
        method: 'PATCH',
        body: { markdown: draft.trim() },
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Edit failed',
        description: err instanceof Error ? err.message : 'Could not save edit.',
        tone: 'danger',
      });
    },
  });

  const remove = useMutation({
    mutationFn: async () =>
      api<{ ok: true }>(apiPaths.pmo.comments.remove(projectSlug, comment.id), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidate();
      toast.show({ title: 'Comment removed', tone: 'success' });
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Could not delete.',
        tone: 'danger',
      });
    },
  });

  return (
    <div
      className={cn(
        'flex gap-3 rounded px-3 py-2.5 transition-colors duration-120 ease-out-soft',
        nested && 'ml-6 border-l-2 border-line bg-surface-muted/40',
      )}
    >
      <Avatar src={comment.author.avatarUrl} name={comment.author.name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-ink">{comment.author.name}</span>
          <span className="text-[11px] text-ink-3" title={new Date(comment.createdAt).toString()}>
            {formatTimeAgo(comment.createdAt)}
          </span>
          {comment.editedAt ? (
            <span className="text-[11px] text-ink-3">(edited)</span>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="text-[14px]"
              autoFocus
              disabled={save.isPending}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.markdown);
                  setEditing(false);
                }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            {isDeleted ? (
              <em className="text-[13px] text-ink-3">Comment removed</em>
            ) : (
              <MarkdownRender markdown={comment.markdown} className="text-[14px]" />
            )}
          </div>
        )}
      </div>

      {!editing && !isDeleted ? (
        <div className="flex items-start gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity duration-120 ease-out-soft">
          {onReply ? (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="inline-grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-line"
              title="Reply"
              aria-label="Reply"
            >
              <Reply className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          ) : null}
          {isAuthor || canModerate ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-line"
                  aria-label="Comment actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                {isAuthor ? (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" strokeWidth={2.25} /> Edit
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => {
                    if (confirm('Delete this comment?')) remove.mutate();
                  }}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.25} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const d = new Date(then);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
