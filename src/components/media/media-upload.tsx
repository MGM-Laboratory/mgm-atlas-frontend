'use client';

import * as React from 'react';
import { ImagePlus, Loader2, Trash2, GripVertical, Video } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { motion, Reorder } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, uploadToPresigned } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { bytesHuman, cn } from '@/lib/utils';
import type { MediaType, ProjectMedia } from '@/lib/types';

interface PresignResponse {
  uploadUrl: string;
  expiresIn: number;
  objectKey: string;
  publicUrl: string;
  type: MediaType;
}

interface Props {
  projectId: string;
  /** Existing gallery items, ordered. Index 0 is the thumbnail. */
  items: ProjectMedia[];
  onChange: (items: ProjectMedia[]) => void;
  maxItems?: number;
}

export function MediaUpload({ projectId, items, onChange, maxItems = 10 }: Props) {
  const { show } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const presign = await api<PresignResponse>(apiPaths.presignMedia(projectId), {
        method: 'POST',
        body: { contentType: file.type, contentLength: file.size },
      });
      await uploadToPresigned(presign.uploadUrl, file);
      const next = items.length === 0 ? 0 : items.length;
      const created = await api<ProjectMedia>(apiPaths.registerMedia(projectId), {
        method: 'POST',
        body: { url: presign.publicUrl, type: presign.type, order: next },
      });
      return created;
    },
    onSuccess: (created) => {
      onChange([...items, created]);
    },
    onError: (err) =>
      show({
        tone: 'danger',
        title: 'Upload failed',
        description: (err as Error).message,
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(apiPaths.deleteMedia(projectId, id), { method: 'DELETE' }),
    onSuccess: (_, id) => {
      onChange(items.filter((m) => m.id !== id));
    },
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      api<ProjectMedia[]>(apiPaths.reorderMedia(projectId), {
        method: 'PATCH',
        body: { orderedIds },
      }),
    onSuccess: (data) => onChange(data),
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (items.length >= maxItems + 1) {
      show({ tone: 'warning', title: `Up to ${maxItems} gallery items + 1 thumbnail.` });
      return;
    }
    upload.mutate(file);
  };

  const handleReorder = (next: ProjectMedia[]) => {
    onChange(next);
    reorder.mutate(next.map((m) => m.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          loading={upload.isPending}
          disabled={items.length >= maxItems + 1}
        >
          <ImagePlus className="h-4 w-4" strokeWidth={2.25} />
          Upload media
        </Button>
        <span className="text-[12px] text-ink-3">
          Images up to 10 MB, video up to 100 MB. First item is the thumbnail.
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            'group flex aspect-[16/9] w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-muted text-ink-3',
            'transition-colors hover:bg-line hover:border-line-strong',
          )}
        >
          {upload.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
          ) : (
            <ImagePlus className="h-6 w-6" strokeWidth={2.25} />
          )}
          <span className="text-[13px]">Click to add the project thumbnail</span>
        </button>
      ) : (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={handleReorder}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {items.map((item, idx) => (
            <Reorder.Item key={item.id} value={item} className="list-none">
              <motion.article
                layout
                className="group relative flex items-center gap-3 rounded-lg border border-line bg-white p-2"
              >
                <span className="cursor-grab touch-none text-ink-4 active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-surface-muted">
                  {item.type === 'IMAGE' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-3">
                      <Video className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                  )}
                  {idx === 0 ? (
                    <span className="absolute left-1 top-1 inline-flex h-5 items-center rounded-full bg-brand-blue px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white">
                      Cover
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {item.url.split('/').pop()}
                  </span>
                  <span className="block text-[12px] text-ink-3">
                    {item.type} · {item.sizeBytes ? bytesHuman(item.sizeBytes) : '—'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove media"
                  onClick={() => remove.mutate(item.id)}
                  loading={remove.isPending && remove.variables === item.id}
                  className="text-brand-red hover:bg-brand-red-50 hover:text-brand-red"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              </motion.article>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}
