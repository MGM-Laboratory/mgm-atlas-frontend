'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { ProjectNote, ProjectNoteTreeItem, SessionUser } from '@/lib/types';

const NoteEditor = dynamic(
  () => import('@/components/pmo/note-editor').then((m) => m.NoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-ink-3">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
      </div>
    ),
  },
);

interface NoteNode extends ProjectNoteTreeItem {
  children: NoteNode[];
}

function buildTree(notes: ProjectNoteTreeItem[]): NoteNode[] {
  const byId = new Map<string, NoteNode>();
  notes.forEach((n) => byId.set(n.id, { ...n, children: [] }));
  const roots: NoteNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentNoteId ? byId.get(node.parentNoteId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sort = (arr: NoteNode[]) => {
    arr.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    arr.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function NotesView({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<ProjectNoteTreeItem | null>(null);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<SessionUser>(apiPaths.me()),
    staleTime: 5 * 60 * 1000,
  });

  const notesQuery = useQuery({
    queryKey: queryKeys.pmo.notes(projectSlug),
    queryFn: () => api<{ notes: ProjectNoteTreeItem[] }>(apiPaths.pmo.notes.list(projectSlug)),
    staleTime: 15_000,
  });

  const notes = React.useMemo(() => notesQuery.data?.notes ?? [], [notesQuery.data]);
  const tree = React.useMemo(() => buildTree(notes), [notes]);

  // Default selection: first root note once the list loads.
  React.useEffect(() => {
    if (selectedId && notes.some((n) => n.id === selectedId)) return;
    setSelectedId(tree[0]?.id ?? null);
  }, [tree, notes, selectedId]);

  const createNote = useMutation({
    mutationFn: (parentNoteId: string | null) =>
      api<ProjectNote>(apiPaths.pmo.notes.create(projectSlug), {
        method: 'POST',
        body: parentNoteId ? { parentNoteId } : {},
      }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.notes(projectSlug) });
      setSelectedId(note.id);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not create note', description: (err as Error).message }),
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api(apiPaths.pmo.notes.update(projectSlug, id), { method: 'PATCH', body: { title } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.notes(projectSlug) });
      setRenaming(null);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Rename failed', description: (err as Error).message }),
  });

  const removeNote = useMutation({
    mutationFn: (id: string) =>
      api(apiPaths.pmo.notes.remove(projectSlug, id), { method: 'DELETE' }),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.notes(projectSlug) });
      if (selectedId === id) setSelectedId(null);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Delete failed', description: (err as Error).message }),
  });

  const handleDelete = (node: ProjectNoteTreeItem) => {
    const hasChildren = notes.some((n) => n.parentNoteId === node.id);
    const msg = hasChildren
      ? `Delete “${node.title}” and all its sub-pages?`
      : `Delete “${node.title}”?`;
    if (window.confirm(msg)) removeNote.mutate(node.id);
  };

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] gap-4">
      {/* Tree */}
      <aside className="flex w-64 shrink-0 flex-col rounded-lg border border-line bg-surface-muted/40">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">
            Notes
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New page"
            onClick={() => createNote.mutate(null)}
            loading={createNote.isPending && createNote.variables === null}
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {notesQuery.isLoading ? (
            <TreeSkeleton />
          ) : tree.length === 0 ? (
            <button
              type="button"
              onClick={() => createNote.mutate(null)}
              className="w-full rounded border border-dashed border-line px-3 py-6 text-[13px] text-ink-3 hover:border-line-strong hover:bg-white"
            >
              Create your first page
            </button>
          ) : (
            <ul>
              {tree.map((node) => (
                <NoteRow
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onAddChild={(id) => createNote.mutate(id)}
                  onRename={setRenaming}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Editor */}
      <section className="min-w-0 flex-1">
        {selectedId && me.data ? (
          <NoteEditor key={selectedId} projectSlug={projectSlug} noteId={selectedId} user={me.data} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line bg-surface-muted text-[13px] text-ink-3">
            Select a page or create a new one.
          </div>
        )}
      </section>

      <RenameDialog
        node={renaming}
        pending={rename.isPending}
        onOpenChange={(open) => !open && setRenaming(null)}
        onSubmit={(title) => renaming && rename.mutate({ id: renaming.id, title })}
      />
    </div>
  );
}

function NoteRow({
  node,
  depth,
  selectedId,
  onSelect,
  onAddChild,
  onRename,
  onDelete,
}: {
  node: NoteNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
  onRename: (n: ProjectNoteTreeItem) => void;
  onDelete: (n: ProjectNoteTreeItem) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1 rounded px-1.5 py-1 text-[13px]',
          selectedId === node.id ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink hover:bg-white',
        )}
        style={{ paddingLeft: depth * 14 + 6 }}
      >
        <button
          type="button"
          aria-label={hasChildren ? (expanded ? 'Collapse' : 'Expand') : undefined}
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className={cn('flex h-4 w-4 shrink-0 items-center justify-center text-ink-3', !hasChildren && 'invisible')}
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
            strokeWidth={2.25}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2.25} />
          <span className="truncate">{node.title}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Page actions"
              className="shrink-0 rounded p-0.5 text-ink-4 opacity-0 hover:bg-surface-muted hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onAddChild(node.id)}>
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Add sub-page
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRename(node)}>
              <Pencil className="h-4 w-4" strokeWidth={2.25} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete(node)}
              className="text-brand-red data-[highlighted]:bg-brand-red-50 data-[highlighted]:text-brand-red"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasChildren && expanded ? (
        <ul>
          {node.children.map((child) => (
            <NoteRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function RenameDialog({
  node,
  pending,
  onOpenChange,
  onSubmit,
}: {
  node: ProjectNoteTreeItem | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = React.useState('');
  React.useEffect(() => {
    if (node) setTitle(node.title);
  }, [node]);
  const trimmed = title.trim();
  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Rename page</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSubmit(trimmed);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              autoFocus
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!trimmed}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TreeSkeleton() {
  return (
    <div className="space-y-1.5 p-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-line/70" />
      ))}
    </div>
  );
}
