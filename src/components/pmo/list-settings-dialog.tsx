'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import type { PmoBrandColor, TaskList } from '@/lib/types';
import { ColorPicker, pmoBgClass, pmoFgClass } from './color-picker';
import { IconPicker } from './icon-picker';
import { LucideIcon, type LucideIconKey } from './lucide-icon';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  projectKey: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/u, '2–6 uppercase letters/digits')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  contributorsCanCreateTasks: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function ListSettingsDialog({
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
  const router = useRouter();
  const toast = useToast();
  const [iconName, setIconName] = React.useState<LucideIconKey>(list.iconName as LucideIconKey);
  const [iconColor, setIconColor] = React.useState<PmoBrandColor>(list.iconColor);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: list.name,
      projectKey: list.projectKey ?? '',
      contributorsCanCreateTasks: list.contributorsCanCreateTasks,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: list.name,
        projectKey: list.projectKey ?? '',
        contributorsCanCreateTasks: list.contributorsCanCreateTasks,
      });
      setIconName(list.iconName as LucideIconKey);
      setIconColor(list.iconColor);
      setConfirmDelete(false);
    }
  }, [open, list, form]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.lists(projectSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.pmo.list(projectSlug, list.id) });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return api<TaskList>(apiPaths.pmo.lists.one(projectSlug, list.id), {
        method: 'PATCH',
        body: {
          name: values.name,
          iconName,
          iconColor,
          projectKey: values.projectKey || undefined,
          contributorsCanCreateTasks: values.contributorsCanCreateTasks,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.show({ title: 'List updated', tone: 'success' });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not update list';
      toast.show({ title: 'Update failed', description: message, tone: 'danger' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const path = list.archivedAt
        ? apiPaths.pmo.lists.unarchive(projectSlug, list.id)
        : apiPaths.pmo.lists.archive(projectSlug, list.id);
      return api<TaskList>(path, { method: 'POST' });
    },
    onSuccess: () => {
      invalidate();
      toast.show({
        title: list.archivedAt ? 'List unarchived' : 'List archived',
        tone: 'success',
      });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return api<{ ok: true }>(apiPaths.pmo.lists.one(projectSlug, list.id), {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      invalidate();
      toast.show({ title: 'List deleted', tone: 'success' });
      onOpenChange(false);
      router.push(`/projects/${projectSlug}` as never);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not delete list';
      toast.show({ title: 'Delete failed', description: message, tone: 'danger' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-1">
          <DialogTitle>List settings</DialogTitle>
          <DialogDescription>
            Configure how this task list looks and behaves. Renames are visible to everyone in the
            project.
          </DialogDescription>
        </div>

        <form
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
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
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
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
            <Label htmlFor="settings-key">Task key prefix</Label>
            <Input
              id="settings-key"
              maxLength={6}
              invalid={!!form.formState.errors.projectKey}
              {...form.register('projectKey')}
            />
            {form.formState.errors.projectKey ? (
              <p className="text-[12px] text-brand-red">{form.formState.errors.projectKey.message}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded border border-line p-3">
            <div className="pr-4">
              <Label htmlFor="contributors-can-create" className="text-body font-medium">
                Contributors can create tasks
              </Label>
              <p className="mt-1 text-[12px] text-ink-3">
                When off, only project managers and admins can create tasks in this list.
              </p>
            </div>
            <Switch
              id="contributors-can-create"
              checked={form.watch('contributorsCanCreateTasks')}
              onCheckedChange={(v) =>
                form.setValue('contributorsCanCreateTasks', v, { shouldDirty: true })
              }
            />
          </div>

          <DialogFooter className="justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => archiveMutation.mutate()}
                loading={archiveMutation.isPending}
              >
                {list.archivedAt ? (
                  <>
                    <ArchiveRestore className="h-4 w-4" strokeWidth={2.25} />
                    Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" strokeWidth={2.25} />
                    Archive
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant={confirmDelete ? 'danger' : 'ghost'}
                onClick={() => {
                  if (confirmDelete) deleteMutation.mutate();
                  else setConfirmDelete(true);
                }}
                loading={deleteMutation.isPending}
              >
                {confirmDelete ? (
                  <>
                    <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
                    Confirm delete
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                    Delete
                  </>
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
