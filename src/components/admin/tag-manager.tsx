'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { Tag } from '@/lib/types';

export function TagManager() {
  const qc = useQueryClient();
  const { show } = useToast();
  const [editing, setEditing] = React.useState<Tag | 'new' | null>(null);

  const grouped = useQuery({
    queryKey: ['tags', 'grouped'],
    queryFn: () => api<{ category: string; items: Tag[] }[]>(apiPaths.tagsGrouped()),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(apiPaths.tag(id), { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      show({ tone: 'success', title: 'Tag deleted' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Tags</h2>
          <p className="mt-1 text-body-sm text-ink-2">
            Tags appear on the discover dashboard and in filter panels.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          New tag
        </Button>
      </div>

      {grouped.isLoading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (
        <div className="space-y-6">
          {grouped.data!.map((g) => (
            <section key={g.category}>
              <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
                {g.category}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {g.items.map((t) => (
                  <li
                    key={t.id}
                    className="group inline-flex items-center gap-2 rounded-full bg-surface-muted py-1 pl-3 pr-1 text-[13px] text-ink"
                  >
                    {t.name}
                    <button
                      onClick={() => setEditing(t)}
                      aria-label={`Edit ${t.name}`}
                      className="inline-grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                    <button
                      onClick={() => remove.mutate(t.id)}
                      aria-label={`Delete ${t.name}`}
                      className="inline-grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-brand-red-50 hover:text-brand-red"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TagDialog
        tag={editing && editing !== 'new' ? editing : null}
        creating={editing === 'new'}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function TagDialog({
  tag,
  creating,
  onClose,
}: {
  tag: Tag | null;
  creating: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [name, setName] = React.useState(tag?.name ?? '');
  const [category, setCategory] = React.useState(tag?.category ?? '');

  React.useEffect(() => {
    setName(tag?.name ?? '');
    setCategory(tag?.category ?? '');
  }, [tag, creating]);

  const open = creating || !!tag;

  const save = useMutation({
    mutationFn: () =>
      tag
        ? api(apiPaths.tag(tag.id), { method: 'PATCH', body: { name, category } })
        : api(apiPaths.tags(), { method: 'POST', body: { name, category } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      show({ tone: 'success', title: tag ? 'Tag updated' : 'Tag created' });
      onClose();
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Save failed', description: (err as Error).message }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="sm">
        <DialogTitle>{tag ? 'Edit tag' : 'New tag'}</DialogTitle>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} />
          </div>
          <div>
            <Label>Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Phase, Stack, Domain…"
              maxLength={48}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!name.trim() || !category.trim()}
          >
            {tag ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
