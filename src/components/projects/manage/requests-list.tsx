'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Hourglass, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { ContributionRequest } from '@/lib/types';
import { formatRelative } from '@/lib/utils';

interface Props {
  projectSlug: string;
}

export function ContributionRequestsList({ projectSlug }: Props) {
  const qc = useQueryClient();
  const { show } = useToast();

  const list = useQuery({
    queryKey: ['project', projectSlug, 'requests'],
    queryFn: () => api<ContributionRequest[]>(apiPaths.projectContributions(projectSlug, 'PENDING')),
  });

  const resolve = useMutation({
    mutationFn: (vars: { id: string; outcome: 'approve' | 'reject'; note?: string }) =>
      api(
        vars.outcome === 'approve'
          ? apiPaths.approveContribution(vars.id)
          : apiPaths.rejectContribution(vars.id),
        { method: 'POST', body: { note: vars.note } },
      ),
    onSuccess: (_, vars) => {
      show({
        tone: vars.outcome === 'approve' ? 'success' : 'neutral',
        title: vars.outcome === 'approve' ? 'Request approved' : 'Request rejected',
      });
      qc.invalidateQueries({ queryKey: ['project', projectSlug, 'requests'] });
      qc.invalidateQueries({ queryKey: ['project', projectSlug] });
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Action failed', description: (err as Error).message }),
  });

  if (list.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if ((list.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        title="No pending requests."
        description="When someone requests to contribute, you'll review them here."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {list.data!.map((req) => (
        <li
          key={req.id}
          className="rounded-lg border border-line bg-white p-5 transition-shadow hover:shadow-1"
        >
          <div className="flex items-start gap-4">
            <Avatar src={req.user?.avatarUrl} name={req.user?.name ?? 'Anonymous'} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium text-ink">{req.user?.name}</span>
                <Badge tone="info">{req.role}</Badge>
                <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <Hourglass className="h-3 w-3" strokeWidth={2.25} />
                  {formatRelative(req.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[14px] text-ink-2">{req.message}</p>
              <span className="mt-1 inline-block text-[12px] text-ink-3">{req.user?.email}</span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => resolve.mutate({ id: req.id, outcome: 'reject' })}
                loading={
                  resolve.isPending && resolve.variables?.id === req.id && resolve.variables.outcome === 'reject'
                }
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => resolve.mutate({ id: req.id, outcome: 'approve' })}
                loading={
                  resolve.isPending && resolve.variables?.id === req.id && resolve.variables.outcome === 'approve'
                }
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                Approve
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
