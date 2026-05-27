'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';

/**
 * Inline "+ Add task" composer rendered at the bottom of each status
 * group in the list view. Click → input swap → Enter submits → input
 * resets so multiple tasks can be added in succession.
 */
export function NewTaskRow({
  projectSlug,
  listId,
  statusId,
}: {
  projectSlug: string;
  listId: string;
  statusId: string;
}) {
  const [active, setActive] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const create = useMutation({
    mutationFn: async (text: string) =>
      api<Task>(apiPaths.pmo.tasks.create(projectSlug, listId), {
        method: 'POST',
        body: { title: text, statusId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.tasks(projectSlug, listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.list(projectSlug, listId) });
      setTitle('');
      // Keep input focused so the PM can keep typing tasks.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Create failed',
        description: err instanceof Error ? err.message : 'Could not create task',
        tone: 'danger',
      });
    },
  });

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    create.mutate(trimmed);
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => {
          setActive(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-3 transition-colors duration-120 ease-out-soft hover:bg-surface-muted hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        Add task
      </button>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5')}>
      <Plus className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title and press Enter…"
        className="h-8 flex-1 text-[14px]"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === 'Escape') {
            setTitle('');
            setActive(false);
          }
        }}
        onBlur={() => {
          // Defer so a click on Add button submission still goes through.
          setTimeout(() => {
            if (!title.trim()) setActive(false);
          }, 100);
        }}
        disabled={create.isPending}
      />
    </div>
  );
}
