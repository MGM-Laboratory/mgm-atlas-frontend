'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Plus, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { TaskList, TaskStatus, TaskStatusCategory } from '@/lib/types';
import { ColorPicker, pmoBgClass } from './color-picker';

interface Draft {
  /// Existing status id, or `tmp:NNN` for ones added in this session.
  id: string;
  /// Original id when it exists in the DB (used to detect deletions).
  originalId?: string;
  name: string;
  color: 'blue' | 'yellow' | 'red' | 'green' | 'neutral';
  category: TaskStatusCategory;
  isDefault: boolean;
}

const CATEGORIES: { value: TaskStatusCategory; label: string }[] = [
  { value: 'TODO', label: 'Todo' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function StatusManagerDialog({
  projectSlug,
  list,
  open,
  onOpenChange,
}: {
  projectSlug: string;
  list: TaskList;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [moveTo, setMoveTo] = React.useState<string>('');
  const nextTmpId = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    const seeded: Draft[] = list.statuses
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        originalId: s.id,
        name: s.name,
        color: normalizeColor(s.color),
        category: s.category,
        isDefault: s.isDefault,
      }));
    setDrafts(seeded);
    setMoveTo(seeded.find((d) => d.isDefault)?.id ?? seeded[0]?.id ?? '');
    nextTmpId.current = 0;
  }, [open, list.statuses]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        statuses: drafts.map((d) => ({
          ...(d.originalId ? { id: d.originalId } : {}),
          name: d.name,
          color: d.color,
          category: d.category,
          isDefault: d.isDefault,
        })),
        moveTasksTo: moveTo && drafts.some((d) => d.originalId === moveTo || d.id === moveTo)
          ? // Map tmp ids back to no-id (server will reject), or pass the
            // existing originalId. We only allow moveTo to be one of the
            // existing originalIds.
            drafts.find((d) => d.id === moveTo)?.originalId ?? moveTo
          : undefined,
      };
      return api<TaskList>(apiPaths.pmo.lists.statuses(projectSlug, list.id), {
        method: 'PATCH',
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.lists(projectSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.list(projectSlug, list.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.tasks(projectSlug, list.id) });
      toast.show({ title: 'Statuses updated', tone: 'success' });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save statuses',
        tone: 'danger',
      });
    },
  });

  const addRow = () => {
    const tmp = `tmp:${nextTmpId.current++}`;
    setDrafts((d) => [
      ...d,
      { id: tmp, name: 'New status', color: 'neutral', category: 'TODO', isDefault: false },
    ]);
  };

  const updateRow = (id: string, patch: Partial<Draft>) => {
    setDrafts((d) => d.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    setDrafts((d) => {
      const next = d.filter((row) => row.id !== id);
      // Ensure at least one default remains.
      if (next.length > 0 && !next.some((r) => r.isDefault)) {
        next[0]!.isDefault = true;
      }
      return next;
    });
  };

  const setDefault = (id: string) => {
    setDrafts((d) => d.map((row) => ({ ...row, isDefault: row.id === id })));
  };

  const removedExistingIds = list.statuses
    .filter((s) => !drafts.some((d) => d.originalId === s.id))
    .map((s) => s.id);
  const showMoveSelector = removedExistingIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <div className="space-y-1">
          <DialogTitle>Manage statuses</DialogTitle>
          <DialogDescription>
            Define the workflow tasks move through in <strong>{list.name}</strong>. Drag to
            reorder; star a row to make it the default for new tasks.
          </DialogDescription>
        </div>

        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          <Reorder.Group axis="y" values={drafts} onReorder={setDrafts} className="space-y-1.5">
            {drafts.map((d) => (
              <DraftRow
                key={d.id}
                draft={d}
                onUpdate={(patch) => updateRow(d.id, patch)}
                onRemove={() => removeRow(d.id)}
                onSetDefault={() => setDefault(d.id)}
                canRemove={drafts.length > 1}
              />
            ))}
          </Reorder.Group>
          <Button type="button" variant="ghost" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Add status
          </Button>
        </div>

        {showMoveSelector ? (
          <div className="space-y-1.5 rounded border border-brand-yellow/40 bg-brand-yellow-50 p-3 text-[13px] text-ink">
            <p>
              You removed <strong>{removedExistingIds.length}</strong> status
              {removedExistingIds.length === 1 ? '' : 'es'}. Existing tasks in those columns will
              move to:
            </p>
            <select
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              className="h-9 w-full rounded border border-line bg-white px-2 text-[13px]"
            >
              {drafts
                .filter((d) => d.originalId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftRow({
  draft,
  onUpdate,
  onRemove,
  onSetDefault,
  canRemove,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
  onRemove: () => void;
  onSetDefault: () => void;
  canRemove: boolean;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={draft}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded border border-line bg-white p-2"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="inline-grid h-7 w-5 cursor-grab place-items-center rounded text-ink-3 hover:bg-line"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>

      <span className={cn('h-3 w-3 shrink-0 rounded-full', pmoBgClass(draft.color))} aria-hidden />

      <Input
        value={draft.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="h-8 flex-1 text-[13px]"
        aria-label="Status name"
      />

      <select
        value={draft.category}
        onChange={(e) => onUpdate({ category: e.target.value as TaskStatusCategory })}
        className="h-8 w-28 rounded border border-line bg-white px-2 text-[12px]"
        aria-label="Status category"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <ColorPicker
        value={draft.color}
        onChange={(c) => onUpdate({ color: c as Draft['color'] })}
        className="ml-1 gap-1"
      />

      <button
        type="button"
        onClick={onSetDefault}
        className={cn(
          'inline-grid h-7 w-7 place-items-center rounded transition-colors duration-120 ease-out-soft',
          draft.isDefault ? 'bg-brand-yellow-50 text-brand-yellow-ink' : 'text-ink-3 hover:bg-line',
        )}
        title={draft.isDefault ? 'Default status' : 'Make default'}
        aria-pressed={draft.isDefault}
      >
        <Star
          className="h-3.5 w-3.5"
          strokeWidth={draft.isDefault ? 0 : 2.25}
          fill={draft.isDefault ? 'currentColor' : 'none'}
        />
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="inline-grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-line disabled:cursor-not-allowed disabled:opacity-30"
        title={canRemove ? 'Remove status' : 'A list needs at least one status'}
        aria-label="Remove status"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </Reorder.Item>
  );
}

function normalizeColor(color: string): 'blue' | 'yellow' | 'red' | 'green' | 'neutral' {
  return ['blue', 'yellow', 'red', 'green', 'neutral'].includes(color)
    ? (color as 'blue' | 'yellow' | 'red' | 'green' | 'neutral')
    : 'neutral';
}
