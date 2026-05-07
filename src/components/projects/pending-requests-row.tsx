'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Hourglass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollRow } from '@/components/ui/scroll-row';
import { ProjectThumbnail } from './project-thumbnail';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { useToast } from '@/components/ui/toast';
import type { ProjectCard as ProjectCardData } from '@/lib/types';
import { formatRelative } from '@/lib/utils';

interface PendingRequest {
  id: string;
  role: string;
  createdAt: string;
  project: ProjectCardData;
}

export function PendingRequestsRow({ items }: { items: PendingRequest[] }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const withdraw = useMutation({
    mutationFn: (id: string) => api(apiPaths.withdrawContribution(id), { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      show({ tone: 'success', title: 'Request withdrawn' });
    },
    onError: () =>
      show({ tone: 'danger', title: 'Could not withdraw', description: 'Try again in a moment.' }),
  });

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Pending requests</h2>
        <p className="mt-1 text-body-sm text-ink-2">
          Waiting on the project manager — you can withdraw anytime.
        </p>
      </div>

      <ScrollRow ariaLabel="Pending requests">
        {items.map((req) => (
          <article
            key={req.id}
            className="flex w-[320px] shrink-0 snap-start flex-col rounded-lg border border-line bg-white p-4"
          >
            <Link href={`/projects/${req.project.slug}` as never} className="block">
              <ProjectThumbnail
                thumbnailUrl={req.project.thumbnailUrl}
                thumbnailType={req.project.thumbnailType}
                alt={req.project.title}
              />
            </Link>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/projects/${req.project.slug}` as never}
                  className="block truncate font-display text-[16px] font-semibold text-ink"
                >
                  {req.project.title}
                </Link>
                <p className="mt-1 text-[13px] text-ink-2">
                  Applied as <span className="font-medium text-ink">{req.role}</span>
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <Hourglass className="h-3 w-3" strokeWidth={2.25} />
                  Pending · {formatRelative(req.createdAt)}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-4 self-start text-brand-red hover:bg-brand-red-50 hover:text-brand-red"
              onClick={() => withdraw.mutate(req.id)}
              loading={withdraw.isPending && withdraw.variables === req.id}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              Withdraw request
            </Button>
          </article>
        ))}
      </ScrollRow>
    </section>
  );
}
