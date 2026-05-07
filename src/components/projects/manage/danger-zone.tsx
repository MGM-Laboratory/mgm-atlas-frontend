'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { ProjectDetailInsider } from '@/lib/types';

export function DangerZone({ project }: { project: ProjectDetailInsider }) {
  const router = useRouter();
  const { show } = useToast();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const archive = useMutation({
    mutationFn: () =>
      api(project.archivedAt ? apiPaths.unarchiveProject(project.id) : apiPaths.archiveProject(project.id), {
        method: 'POST',
      }),
    onSuccess: () => {
      show({
        tone: 'success',
        title: project.archivedAt ? 'Project unarchived' : 'Project archived',
      });
      router.refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`/projects/${project.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      show({ tone: 'success', title: 'Project deleted' });
      router.push('/dashboard' as never);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Delete failed', description: (err as Error).message }),
  });

  return (
    <>
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Settings</h2>
          <p className="mt-1 text-body-sm text-ink-2">Irreversible actions live here.</p>
        </div>

        <div className="rounded-lg border border-brand-yellow/40 bg-brand-yellow-50/40 p-5">
          <h3 className="text-[14px] font-medium text-ink">
            {project.archivedAt ? 'Unarchive project' : 'Archive project'}
          </h3>
          <p className="mt-1 text-[13px] text-ink-2">
            {project.archivedAt
              ? 'Returns the project to active status — it will appear in browse and discovery again.'
              : 'Hides the project from active discovery without deleting it. You can unarchive any time.'}
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => archive.mutate()}
            loading={archive.isPending}
          >
            {project.archivedAt ? (
              <>
                <ArchiveRestore className="h-4 w-4" strokeWidth={2.25} />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" strokeWidth={2.25} />
                Archive project
              </>
            )}
          </Button>
        </div>

        <div className="rounded-lg border border-brand-red/40 bg-brand-red-50/40 p-5">
          <h3 className="text-[14px] font-medium text-ink">Delete project</h3>
          <p className="mt-1 text-[13px] text-ink-2">
            Permanently removes the project and its team. Media is retained for 30 days, then purged.
          </p>
          <Button variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
            Delete project
          </Button>
        </div>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent size="sm">
          <DialogTitle>Delete this project?</DialogTitle>
          <DialogDescription>
            This cannot be undone. <span className="font-medium text-ink">{project.title}</span>{' '}
            will be removed from the dashboard immediately.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
