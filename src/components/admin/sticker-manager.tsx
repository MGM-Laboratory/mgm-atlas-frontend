'use client';

import * as React from 'react';
import { Loader2, Plus, Trash2, Archive, ArchiveRestore, Upload, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadToPresigned } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { AdminStickerPack, StickerPresignResponse } from '@/lib/types';

/**
 * Admin sticker library. Pack list on the left, sticker grid for the
 * selected pack on the right. Upload via drop zone, click-to-pick, or
 * paste-image. Reuses the chat S3 plumbing — uploads land under
 * `stickers/{packId}/...` so they're cleanly separated from project
 * media and chat attachments.
 *
 * Mutations invalidate both the admin pack list AND the public
 * `/chat/stickers/packs` cache so the picker updates without a
 * reload.
 */
export function StickerManager() {
  const [selectedPackId, setSelectedPackId] = React.useState<string | null>(null);

  const packsQuery = useQuery({
    queryKey: ['admin', 'sticker-packs'],
    queryFn: () => api<AdminStickerPack[]>(apiPaths.adminStickers.packs()),
  });

  React.useEffect(() => {
    if (!selectedPackId && packsQuery.data?.length) {
      const first = packsQuery.data.find((p) => !p.isArchived) ?? packsQuery.data[0];
      setSelectedPackId(first?.id ?? null);
    }
  }, [packsQuery.data, selectedPackId]);

  const packs = packsQuery.data ?? [];
  const selected = packs.find((p) => p.id === selectedPackId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Packs
          </h3>
          <CreatePackButton />
        </div>
        {packsQuery.isLoading ? (
          <div className="grid h-20 place-items-center text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : packs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-4 text-[13px] text-ink-3">
            No packs yet. Create the first one.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {packs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPackId(p.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors',
                    selectedPackId === p.id
                      ? 'bg-white shadow-1'
                      : 'text-ink-2 hover:bg-white/70 hover:text-ink',
                    p.isArchived && 'opacity-60',
                  )}
                >
                  <span className="flex-1 truncate font-medium text-ink">{p.name}</span>
                  <span className="text-[11px] text-ink-3">{p._count?.stickers ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="min-w-0">
        {selected ? (
          <PackPanel pack={selected} key={selected.id} />
        ) : (
          <div className="grid h-40 place-items-center rounded-lg border border-dashed border-line text-[13px] text-ink-3">
            Pick a pack to manage its stickers.
          </div>
        )}
      </section>
    </div>
  );
}

function CreatePackButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api<AdminStickerPack>(apiPaths.adminStickers.packs(), { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sticker-packs'] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'stickers', 'packs'] });
      setOpen(false);
      setName('');
      setDescription('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <h2 className="font-display text-h3 text-ink">New sticker pack</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createMutation.mutate({
              name: name.trim(),
              description: description.trim() || undefined,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pack-name">Name</Label>
            <Input
              id="pack-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Atlas reactions"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-desc">Description (optional)</Label>
            <Input
              id="pack-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Stickers for shipping moments"
            />
          </div>
          {createMutation.isError ? (
            <div className="text-[13px] text-brand-red">
              {(createMutation.error as { body?: { message?: string } })?.body?.message ??
                'Failed to create pack.'}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PackPanel({ pack }: { pack: AdminStickerPack }) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [pendingNames, setPendingNames] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const archiveMutation = useMutation({
    mutationFn: () =>
      api(
        pack.isArchived
          ? apiPaths.adminStickers.unarchivePack(pack.id)
          : apiPaths.adminStickers.archivePack(pack.id),
        { method: 'POST' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sticker-packs'] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'stickers', 'packs'] });
    },
  });

  const deleteStickerMutation = useMutation({
    mutationFn: (stickerId: string) =>
      api(apiPaths.adminStickers.sticker(stickerId), { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sticker-packs'] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'stickers', 'packs'] });
    },
  });

  const uploadOne = async (file: File) => {
    setError(null);
    setPendingNames((p) => [...p, file.name]);
    try {
      const presign = await api<StickerPresignResponse>(
        apiPaths.adminStickers.presignSticker(pack.id),
        {
          method: 'POST',
          body: {
            contentType: file.type || 'image/png',
            contentLength: file.size,
            filename: file.name,
          },
        },
      );
      await uploadToPresigned(presign.uploadUrl, file);
      await api(apiPaths.adminStickers.registerSticker(pack.id), {
        method: 'POST',
        body: {
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
          s3Key: presign.s3Key,
          url: presign.publicUrl,
          mime: presign.contentType,
        },
      });
    } catch (err) {
      setError((err as Error).message ?? 'Upload failed');
    } finally {
      setPendingNames((p) => p.filter((n) => n !== file.name));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sticker-packs'] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'stickers', 'packs'] });
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-h3 text-ink">{pack.name}</h2>
          {pack.description ? (
            <p className="truncate text-[13px] text-ink-3">{pack.description}</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => archiveMutation.mutate()}
          loading={archiveMutation.isPending}
        >
          {pack.isArchived ? (
            <>
              <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={2.25} />
              Restore
            </>
          ) : (
            <>
              <Archive className="h-3.5 w-3.5" strokeWidth={2.25} />
              Archive
            </>
          )}
        </Button>
      </header>

      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          for (const f of e.dataTransfer.files) void uploadOne(f);
        }}
        className={cn(
          'flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-[13px] transition-colors',
          isDragging ? 'border-brand-blue/60 bg-brand-blue/5' : 'border-line bg-surface-muted/40',
        )}
      >
        <Upload className="h-5 w-5 text-ink-3" strokeWidth={2.25} />
        <div className="text-ink-2">Drop sticker images here</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={pack.isArchived}
        >
          or click to upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/webp,image/gif,image/jpeg"
          hidden
          onChange={(e) => {
            for (const f of e.target.files ?? []) void uploadOne(f);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        {pendingNames.length > 0 ? (
          <div className="text-[11px] text-ink-3">
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
            Uploading {pendingNames.length}…
          </div>
        ) : null}
        {error ? <div className="text-[12px] text-brand-red">{error}</div> : null}
      </div>

      {pack.stickers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-center text-[13px] text-ink-3">
          No stickers in this pack yet.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {pack.stickers.map((s) => (
            <div key={s.id} className="group relative aspect-square overflow-hidden rounded border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.name} loading="lazy" className="block h-full w-full object-contain" />
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete sticker "${s.name}"?`)) deleteStickerMutation.mutate(s.id);
                }}
                aria-label="Delete sticker"
                className="absolute right-1 top-1 hidden h-5 w-5 place-items-center rounded-full bg-white/90 text-ink-3 shadow-1 hover:text-brand-red group-hover:grid"
              >
                <X className="h-3 w-3" strokeWidth={2.25} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
