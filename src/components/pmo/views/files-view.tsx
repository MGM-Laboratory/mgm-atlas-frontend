'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Download,
  File as FileIcon,
  FileArchive,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Music,
  Pencil,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { api, uploadToPresigned } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { isApiError } from '@/lib/api/error';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { bytesHuman, cn } from '@/lib/utils';
import type { ProjectFile, ProjectFilesResponse } from '@/lib/types';

/// Custom drag payload so an internal move can be told apart from an OS
/// file drop (the latter exposes a 'Files' entry in dataTransfer.types).
const DRAG_MIME = 'application/x-pmo-file-id';

const errMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong';

export function FilesView({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [folderId, setFolderId] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<ProjectFile | null>(null);
  const [newFolderOpen, setNewFolderOpen] = React.useState(false);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const [uploadActive, setUploadActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(0);
  const dragDepth = React.useRef(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const filesQuery = useQuery({
    queryKey: queryKeys.pmo.files(projectSlug, folderId),
    queryFn: () =>
      api<ProjectFilesResponse>(apiPaths.pmo.files.list(projectSlug, folderId ?? undefined)),
    staleTime: 15_000,
  });

  const invalidate = React.useCallback(
    (id: string | null = folderId) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.files(projectSlug, id) }),
    [queryClient, projectSlug, folderId],
  );

  // ── mutations ──────────────────────────────────────────────────────────
  const createFolder = useMutation({
    mutationFn: (name: string) =>
      api<ProjectFile>(apiPaths.pmo.files.createFolder(projectSlug), {
        method: 'POST',
        body: { name, parentFolderId: folderId ?? undefined },
      }),
    onSuccess: () => {
      invalidate();
      setNewFolderOpen(false);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not create folder', description: errMessage(err) }),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<ProjectFile>(apiPaths.pmo.files.update(projectSlug, id), {
        method: 'PATCH',
        body: { name },
      }),
    onSuccess: () => {
      invalidate();
      setRenaming(null);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Rename failed', description: errMessage(err) }),
  });

  const move = useMutation({
    mutationFn: ({ id, parentFolderId }: { id: string; parentFolderId: string | null }) =>
      api<ProjectFile>(apiPaths.pmo.files.update(projectSlug, id), {
        method: 'PATCH',
        body: { parentFolderId },
      }),
    onSuccess: () => invalidate(),
    onError: (err) => show({ tone: 'danger', title: 'Move failed', description: errMessage(err) }),
  });

  const removeFile = async (item: ProjectFile) => {
    if (!window.confirm(`Delete ${item.isFolder ? 'folder' : 'file'} “${item.name}”?`)) return;
    try {
      await api(apiPaths.pmo.files.remove(projectSlug, item.id), { method: 'DELETE' });
      invalidate();
    } catch (err) {
      // A non-empty folder is rejected with 400 until force=1 is passed.
      if (isApiError(err) && err.status === 400 && item.isFolder) {
        if (window.confirm(`“${item.name}” isn’t empty. Delete it and everything inside?`)) {
          try {
            await api(apiPaths.pmo.files.remove(projectSlug, item.id, true), { method: 'DELETE' });
            invalidate();
          } catch (forceErr) {
            show({ tone: 'danger', title: 'Delete failed', description: errMessage(forceErr) });
          }
        }
        return;
      }
      show({ tone: 'danger', title: 'Delete failed', description: errMessage(err) });
    }
  };

  // ── uploads ────────────────────────────────────────────────────────────
  const uploadFiles = React.useCallback(
    async (files: File[], targetFolderId: string | null) => {
      if (!files.length) return;
      setUploading((n) => n + files.length);
      for (const file of files) {
        try {
          const contentType = file.type || 'application/octet-stream';
          const presign = await api<{ uploadUrl: string; s3Key: string; url: string }>(
            apiPaths.pmo.files.presign(projectSlug),
            {
              method: 'POST',
              body: {
                filename: file.name,
                contentType,
                contentLength: file.size,
                parentFolderId: targetFolderId ?? undefined,
              },
            },
          );
          await uploadToPresigned(presign.uploadUrl, file, undefined, contentType);
          await api<ProjectFile>(apiPaths.pmo.files.register(projectSlug), {
            method: 'POST',
            body: {
              name: file.name,
              s3Key: presign.s3Key,
              mime: contentType,
              bytes: file.size,
              parentFolderId: targetFolderId ?? undefined,
            },
          });
        } catch (err) {
          show({ tone: 'danger', title: `Couldn’t upload ${file.name}`, description: errMessage(err) });
        } finally {
          setUploading((n) => n - 1);
        }
      }
      invalidate(targetFolderId);
    },
    [projectSlug, show, invalidate],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    void uploadFiles(files, folderId);
  };

  // ── drag & drop ──────────────────────────────────────────────────────────
  const hasOsFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  const onZoneDragEnter = (e: React.DragEvent) => {
    if (!hasOsFiles(e)) return;
    dragDepth.current += 1;
    setUploadActive(true);
  };
  const onZoneDragOver = (e: React.DragEvent) => {
    if (hasOsFiles(e)) e.preventDefault();
  };
  const onZoneDragLeave = (e: React.DragEvent) => {
    if (!hasOsFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setUploadActive(false);
  };
  const onZoneDrop = (e: React.DragEvent) => {
    dragDepth.current = 0;
    setUploadActive(false);
    if (e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    void uploadFiles(Array.from(e.dataTransfer.files), folderId);
  };

  const onItemDragStart = (e: React.DragEvent, item: ProjectFile) => {
    e.dataTransfer.setData(DRAG_MIME, item.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onFolderDropMove = (e: React.DragEvent, targetId: string | null) => {
    const id = e.dataTransfer.getData(DRAG_MIME);
    setDropTarget(null);
    if (!id || id === targetId) return;
    e.preventDefault();
    e.stopPropagation();
    move.mutate({ id, parentFolderId: targetId });
  };

  const data = filesQuery.data;
  const items = data?.items ?? [];
  const breadcrumb = data?.breadcrumb ?? [];

  return (
    <div
      className="relative space-y-5"
      onDragEnter={onZoneDragEnter}
      onDragOver={onZoneDragOver}
      onDragLeave={onZoneDragLeave}
      onDrop={onZoneDrop}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          trail={breadcrumb}
          onNavigate={setFolderId}
          dropTarget={dropTarget}
          onCrumbDragOver={(e, id) => {
            if (e.dataTransfer.types.includes(DRAG_MIME)) {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget(id ?? '__root__');
            }
          }}
          onCrumbDrop={onFolderDropMove}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setNewFolderOpen(true)}
          >
            <FolderPlus className="h-4 w-4" strokeWidth={2.25} />
            New folder
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading > 0}
          >
            <Upload className="h-4 w-4" strokeWidth={2.25} />
            Upload
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPick} />
        </div>
      </div>

      {/* Body */}
      {filesQuery.isLoading ? (
        <FilesSkeleton />
      ) : filesQuery.isError ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
          Could not load files.
        </p>
      ) : items.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-muted text-ink-3',
            'transition-colors hover:border-line-strong hover:bg-line/60',
          )}
        >
          <Upload className="h-7 w-7" strokeWidth={2} />
          <span className="text-[13px]">Drop files here or click to upload</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <FileCard
              key={item.id}
              item={item}
              isDropTarget={dropTarget === item.id}
              onOpen={() => {
                if (item.isFolder) setFolderId(item.id);
                else if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
              }}
              onDragStart={(e) => onItemDragStart(e, item)}
              onDragEnd={() => setDropTarget(null)}
              onDragOver={(e) => {
                if (item.isFolder && e.dataTransfer.types.includes(DRAG_MIME)) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTarget(item.id);
                }
              }}
              onDragLeave={() => setDropTarget((cur) => (cur === item.id ? null : cur))}
              onDrop={(e) => {
                if (item.isFolder) onFolderDropMove(e, item.id);
              }}
              onRename={() => setRenaming(item)}
              onMoveToRoot={
                item.parentFolderId !== null
                  ? () => move.mutate({ id: item.id, parentFolderId: null })
                  : undefined
              }
              onDelete={() => removeFile(item)}
            />
          ))}
        </ul>
      )}

      {/* Upload drop overlay */}
      {uploadActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-brand-blue bg-brand-blue/5">
          <span className="rounded-full bg-brand-blue px-4 py-2 text-[13px] font-medium text-white">
            Drop to upload
          </span>
        </div>
      ) : null}

      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        pending={createFolder.isPending}
        onSubmit={(name) => createFolder.mutate(name)}
      />
      <RenameDialog
        node={renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
        pending={rename.isPending}
        onSubmit={(name) => renaming && rename.mutate({ id: renaming.id, name })}
      />
    </div>
  );
}

// ── breadcrumb ─────────────────────────────────────────────────────────────

function Breadcrumb({
  trail,
  onNavigate,
  dropTarget,
  onCrumbDragOver,
  onCrumbDrop,
}: {
  trail: { id: string; name: string }[];
  onNavigate: (id: string | null) => void;
  dropTarget: string | null;
  onCrumbDragOver: (e: React.DragEvent, id: string | null) => void;
  onCrumbDrop: (e: React.DragEvent, id: string | null) => void;
}) {
  const crumbClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] text-ink-3 hover:text-ink',
      active && 'bg-brand-blue/10 text-brand-blue',
    );
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-0.5" aria-label="Folder path">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        onDragOver={(e) => onCrumbDragOver(e, null)}
        onDragLeave={(e) => e.stopPropagation()}
        onDrop={(e) => onCrumbDrop(e, null)}
        className={crumbClass(dropTarget === '__root__')}
      >
        <Home className="h-3.5 w-3.5" strokeWidth={2.25} />
        Files
      </button>
      {trail.map((c, i) => {
        const isLast = i === trail.length - 1;
        return (
          <React.Fragment key={c.id}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-4" strokeWidth={2.25} />
            <button
              type="button"
              onClick={() => onNavigate(c.id)}
              onDragOver={(e) => onCrumbDragOver(e, c.id)}
              onDragLeave={(e) => e.stopPropagation()}
              onDrop={(e) => onCrumbDrop(e, c.id)}
              className={cn(crumbClass(dropTarget === c.id), isLast && 'font-medium text-ink')}
            >
              <span className="max-w-[160px] truncate">{c.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ── file / folder card ───────────────────────────────────────────────────

function FileCard({
  item,
  isDropTarget,
  onOpen,
  onRename,
  onMoveToRoot,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  item: ProjectFile;
  isDropTarget: boolean;
  onOpen: () => void;
  onRename: () => void;
  onMoveToRoot?: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <li>
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDoubleClick={onOpen}
        className={cn(
          'group relative flex h-full cursor-pointer flex-col gap-2 rounded-lg border border-line bg-white p-3',
          'transition-shadow duration-120 ease-out-soft hover:shadow-2',
          isDropTarget && item.isFolder && 'border-brand-blue ring-2 ring-brand-blue/30',
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <FileGlyph item={item} />
          <ItemMenu
            item={item}
            onOpen={onOpen}
            onRename={onRename}
            onMoveToRoot={onMoveToRoot}
            onDelete={onDelete}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink" title={item.name}>
            {item.name}
          </p>
          <p className="truncate text-[11px] text-ink-3">
            {item.isFolder ? 'Folder' : `${item.mime ?? 'file'} · ${bytesHuman(item.bytes ?? 0)}`}
          </p>
        </div>
        {item.uploadedBy ? (
          <div className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] text-ink-3">
            <Avatar src={item.uploadedBy.avatarUrl} name={item.uploadedBy.name} size={24} />
            <span className="truncate">{item.uploadedBy.name}</span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function FileGlyph({ item }: { item: ProjectFile }) {
  const Icon = item.isFolder ? Folder : iconForMime(item.mime);
  const tone = item.isFolder ? 'text-brand-blue' : 'text-ink-3';
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md',
        item.isFolder ? 'bg-brand-blue/10' : 'bg-surface-muted',
      )}
    >
      <Icon className={cn('h-5 w-5', tone)} strokeWidth={2} />
    </div>
  );
}

function ItemMenu({
  item,
  onOpen,
  onRename,
  onMoveToRoot,
  onDelete,
}: {
  item: ProjectFile;
  onOpen: () => void;
  onRename: () => void;
  onMoveToRoot?: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="File actions"
          onClick={(e) => e.stopPropagation()}
          className="rounded p-1 text-ink-4 opacity-0 transition-opacity hover:bg-surface-muted hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {!item.isFolder && item.url ? (
          <DropdownMenuItem asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer" download>
              <Download className="h-4 w-4" strokeWidth={2.25} />
              Download
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onOpen}>
            <Folder className="h-4 w-4" strokeWidth={2.25} />
            Open
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="h-4 w-4" strokeWidth={2.25} />
          Rename
        </DropdownMenuItem>
        {onMoveToRoot ? (
          <DropdownMenuItem onSelect={onMoveToRoot}>
            <Upload className="h-4 w-4" strokeWidth={2.25} />
            Move to top level
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-brand-red data-[highlighted]:bg-brand-red-50 data-[highlighted]:text-brand-red"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── dialogs ────────────────────────────────────────────────────────────────

function NewFolderDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = React.useState('');
  React.useEffect(() => {
    if (open) setName('');
  }, [open]);
  const trimmed = name.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-1">
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>Folders organize files inside this project.</DialogDescription>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSubmit(trimmed);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              autoFocus
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              placeholder="Design assets"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!trimmed}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  node,
  onOpenChange,
  pending,
  onSubmit,
}: {
  node: ProjectFile | null;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = React.useState('');
  React.useEffect(() => {
    if (node) setName(node.name);
  }, [node]);
  const trimmed = name.trim();
  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-1">
          <DialogTitle>Rename {node?.isFolder ? 'folder' : 'file'}</DialogTitle>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSubmit(trimmed);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="rename-name">Name</Label>
            <Input
              id="rename-name"
              autoFocus
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
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

function FilesSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <li key={i} className="h-32 animate-pulse rounded-lg bg-line/70" />
      ))}
    </ul>
  );
}

function iconForMime(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('video/')) return Video;
  if (mime.startsWith('audio/')) return Music;
  if (mime === 'application/pdf' || mime.startsWith('text/')) return FileText;
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z'))
    return FileArchive;
  return FileIcon;
}
