'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import type { PmoBrandColor, TaskList } from '@/lib/types';
import { ColorPicker, pmoBgClass, pmoFgClass } from './color-picker';
import { IconPicker } from './icon-picker';
import { LucideIcon, type LucideIconKey } from './lucide-icon';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 chars or fewer'),
  projectKey: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/u, '2–6 uppercase letters/digits')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  contributorsCanCreateTasks: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

export function CreateListDialog({
  projectSlug,
  open,
  onOpenChange,
}: {
  projectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [iconName, setIconName] = React.useState<LucideIconKey>('list-todo');
  const [iconColor, setIconColor] = React.useState<PmoBrandColor>('blue');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', projectKey: '', contributorsCanCreateTasks: true },
  });

  // Reset every time the dialog re-opens, so a previously cancelled
  // attempt doesn't leak its name/icon into the next one.
  React.useEffect(() => {
    if (open) {
      form.reset({ name: '', projectKey: '', contributorsCanCreateTasks: true });
      setIconName('list-todo');
      setIconColor('blue');
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return api<TaskList>(apiPaths.pmo.lists.create(projectSlug), {
        method: 'POST',
        body: {
          name: values.name,
          iconName,
          iconColor,
          projectKey: values.projectKey || undefined,
          contributorsCanCreateTasks: values.contributorsCanCreateTasks,
        },
      });
    },
    onSuccess: (list) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.lists(projectSlug) });
      toast.show({ title: 'Task list created', description: list.name, tone: 'success' });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not create task list';
      toast.show({ title: 'Create failed', description: message, tone: 'danger' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-1">
          <DialogTitle>New task list</DialogTitle>
          <DialogDescription>
            Group tasks for a role (Frontend, Backend, Design, …) under its own list with its own
            workflow.
          </DialogDescription>
        </div>

        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-5"
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded ${pmoBgClass(iconColor)}`}
              aria-hidden
            >
              <LucideIcon name={iconName} className={`h-6 w-6 ${pmoFgClass(iconColor)}`} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="task-list-name">Name</Label>
              <Input
                id="task-list-name"
                autoFocus
                placeholder="Frontend Developer"
                invalid={!!form.formState.errors.name}
                {...form.register('name')}
              />
              {form.formState.errors.name ? (
                <p className="text-[12px] text-brand-red">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorPicker value={iconColor} onChange={setIconColor} />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <IconPicker value={iconName} onChange={setIconName} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-list-key">
              Task key prefix <span className="text-ink-3">(optional)</span>
            </Label>
            <Input
              id="task-list-key"
              placeholder="FE"
              maxLength={6}
              invalid={!!form.formState.errors.projectKey}
              {...form.register('projectKey')}
            />
            <p className="text-[12px] text-ink-3">
              2–6 uppercase letters or digits. Becomes the prefix on every task created in this
              list (e.g. <code>FE-12</code>). Auto-derived from the name if left blank.
            </p>
            {form.formState.errors.projectKey ? (
              <p className="text-[12px] text-brand-red">{form.formState.errors.projectKey.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Create list
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
