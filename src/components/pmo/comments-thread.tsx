'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import type { PaginatedComments, SessionUser, TaskComment } from '@/lib/types';
import { CommentComposer } from './comment-composer';
import { CommentItem } from './comment-item';

/**
 * Threaded comment list for a task. Layout is one level deep — replies
 * indent under their parent; replies-to-replies flatten under the
 * original parent (matches what the backend stores in `replyToId` after
 * its flattening pass).
 */
export function CommentsThread({
  projectSlug,
  taskId,
  currentUser,
  canModerate,
}: {
  projectSlug: string;
  taskId: string;
  currentUser: SessionUser | null;
  canModerate: boolean;
}) {
  const [replyTo, setReplyTo] = React.useState<TaskComment | null>(null);

  const comments = useQuery({
    queryKey: queryKeys.pmo.comments(projectSlug, taskId),
    queryFn: () =>
      api<PaginatedComments>(apiPaths.pmo.comments.list(projectSlug, taskId)),
    staleTime: 5_000,
  });

  const grouped = React.useMemo(() => {
    const all = comments.data?.items ?? [];
    const roots = all.filter((c) => !c.replyToId);
    const replies = new Map<string, TaskComment[]>();
    for (const c of all) {
      if (c.replyToId) {
        if (!replies.has(c.replyToId)) replies.set(c.replyToId, []);
        replies.get(c.replyToId)!.push(c);
      }
    }
    return { roots, replies };
  }, [comments.data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink-3">
        <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.25} />
        Comments
        {comments.data ? (
          <span className="font-medium text-ink-2">{comments.data.total}</span>
        ) : null}
      </div>

      {comments.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-line/60" />
          ))}
        </div>
      ) : comments.isError ? (
        <p className="text-[13px] text-brand-red">Could not load comments.</p>
      ) : grouped.roots.length === 0 ? (
        <p className="text-[13px] text-ink-3">
          No comments yet. Be the first — mention teammates with <code>@</code>.
        </p>
      ) : (
        <ul className="space-y-1">
          {grouped.roots.map((root) => (
            <li key={root.id} className="group/comment">
              <CommentItem
                projectSlug={projectSlug}
                taskId={taskId}
                comment={root}
                currentUser={currentUser}
                canModerate={canModerate}
                onReply={(c) => setReplyTo(c)}
              />
              {grouped.replies.get(root.id)?.map((child) => (
                <div key={child.id} className="group/comment">
                  <CommentItem
                    projectSlug={projectSlug}
                    taskId={taskId}
                    comment={child}
                    currentUser={currentUser}
                    canModerate={canModerate}
                    nested
                  />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}

      <CommentComposer
        projectSlug={projectSlug}
        taskId={taskId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        autoFocus={false}
      />
    </div>
  );
}
