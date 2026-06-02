'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, RotateCcw, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export type RevisionKind = 'note' | 'whiteboard';

interface RevisionAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface RevisionListItem {
  id: string;
  createdAt: string;
  size: number;
  isCheckpoint: boolean;
  author: RevisionAuthor | null;
}

interface Props {
  kind: RevisionKind;
  projectSlug: string;
  /** noteId or whiteboardId — the parent doc whose history we're showing. */
  parentId: string;
  open: boolean;
  onClose: () => void;
  /**
   * Optional preview callback — when present, clicking a revision in the
   * list calls this with the loaded snapshot JSON. Lets the parent show
   * the old content in the live editor (read-only, until Restore is
   * pressed). When absent, the row just shows metadata.
   */
  onPreview?: (snapshot: unknown) => void;
  /**
   * Called after a successful restore. The parent should re-seed its
   * editor from the new snapshot so the user sees the restored state.
   * For collaborative Yjs docs the restored content also propagates to
   * other connected clients on the next edit / save tick.
   */
  onRestored?: (snapshot: unknown) => void;
}

/**
 * Side drawer listing the NoteRevision / WhiteboardRevision rows
 * for the active parent doc. Newest first. Author name + relative
 * timestamp + size + checkpoint badge. Click a row to preview;
 * "Restore" sends a POST that rolls the live snapshot back AND
 * writes a new revision so the restore is itself reversible.
 */
export function RevisionHistoryDrawer({
  kind,
  projectSlug,
  parentId,
  open,
  onClose,
  onPreview,
  onRestored,
}: Props) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const listPath =
    kind === 'note'
      ? apiPaths.pmo.notes.revisions(projectSlug, parentId)
      : apiPaths.pmo.whiteboards.revisions(projectSlug, parentId);

  const listKey = React.useMemo(
    () => ['pmo', kind, 'revisions', projectSlug, parentId] as const,
    [kind, projectSlug, parentId],
  );

  const revisions = useQuery({
    queryKey: listKey,
    queryFn: () => api<{ revisions: RevisionListItem[] }>(listPath),
    enabled: open,
    staleTime: 10_000,
  });

  const previewPath = (revisionId: string) =>
    kind === 'note'
      ? apiPaths.pmo.notes.revision(projectSlug, parentId, revisionId)
      : apiPaths.pmo.whiteboards.revision(projectSlug, parentId, revisionId);

  const restorePath = (revisionId: string) =>
    kind === 'note'
      ? apiPaths.pmo.notes.restoreRevision(projectSlug, parentId, revisionId)
      : apiPaths.pmo.whiteboards.restoreRevision(projectSlug, parentId, revisionId);

  const handlePreview = async (revisionId: string) => {
    setSelectedId(revisionId);
    if (!onPreview) return;
    try {
      const rev = await api<{ contentSnapshot?: unknown; sceneSnapshot?: unknown }>(
        previewPath(revisionId),
      );
      const snapshot = kind === 'note' ? rev.contentSnapshot : rev.sceneSnapshot;
      onPreview(snapshot);
    } catch (err) {
      show({
        title: 'Couldn’t load revision',
        description: err instanceof Error ? err.message : 'Unknown error',
        tone: 'danger',
      });
    }
  };

  const restoreMutation = useMutation({
    mutationFn: async (revisionId: string) => {
      const result = await api<{ contentSnapshot?: unknown; sceneSnapshot?: unknown }>(
        restorePath(revisionId),
        { method: 'POST' },
      );
      return { revisionId, snapshot: kind === 'note' ? result.contentSnapshot : result.sceneSnapshot };
    },
    onMutate: ({}) => {
      // setRestoringId is set imperatively at click time
    },
    onSuccess: ({ snapshot }) => {
      queryClient.invalidateQueries({ queryKey: listKey });
      if (kind === 'note') {
        queryClient.invalidateQueries({ queryKey: queryKeys.pmo.notes(projectSlug) });
        queryClient.invalidateQueries({ queryKey: queryKeys.pmo.note(projectSlug, parentId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.pmo.whiteboards(projectSlug) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.pmo.whiteboard(projectSlug, parentId),
        });
      }
      onRestored?.(snapshot);
      show({
        title: 'Revision restored',
        description: 'A new revision was written so this restore is itself undoable.',
        tone: 'success',
      });
      setRestoringId(null);
    },
    onError: (err: unknown) => {
      show({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        tone: 'danger',
      });
      setRestoringId(null);
    },
  });

  if (!open) return null;

  const items = revisions.data?.revisions ?? [];

  return (
    <aside
      role="dialog"
      aria-label="Revision history"
      className="absolute inset-y-0 right-0 z-20 flex w-[360px] flex-col border-l border-line bg-white shadow-2"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Clock className="h-4 w-4" strokeWidth={2.25} /> History
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-surface-muted"
          aria-label="Close history"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </header>
      <div className="flex-1 overflow-auto">
        {revisions.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-ink-3" strokeWidth={2.25} />
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-ink-3">
            No revisions yet. Edits made from now on will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((rev) => (
              <li
                key={rev.id}
                className={cn(
                  'flex flex-col gap-2 px-4 py-3 hover:bg-surface-muted/60',
                  selectedId === rev.id && 'bg-surface-muted',
                )}
              >
                <button
                  type="button"
                  onClick={() => handlePreview(rev.id)}
                  className="flex flex-1 items-start gap-3 text-left"
                >
                  {rev.author ? (
                    <Avatar
                      name={rev.author.name}
                      src={rev.author.avatarUrl ?? undefined}
                      className="h-7 w-7"
                    />
                  ) : (
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-line text-[10px] text-ink-3">
                      ?
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[12px] font-medium text-ink">
                      {rev.author?.name ?? 'Anonymous'}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-ink-3">
                      <time dateTime={rev.createdAt} title={new Date(rev.createdAt).toLocaleString()}>
                        {relative(rev.createdAt)}
                      </time>
                      <span>· {formatSize(rev.size)}</span>
                      {rev.isCheckpoint ? (
                        <span className="rounded bg-brand-blue-50 px-1 text-[10px] font-medium text-brand-blue">
                          Checkpoint
                        </span>
                      ) : null}
                    </span>
                  </div>
                </button>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={restoreMutation.isPending && restoringId === rev.id}
                    onClick={() => {
                      if (!confirm('Restore this revision? The current content will be replaced (but kept as a new revision so this is reversible).')) return;
                      setRestoringId(rev.id);
                      restoreMutation.mutate(rev.id);
                    }}
                  >
                    {restoreMutation.isPending && restoringId === rev.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
                    )}
                    Restore
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function relative(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
