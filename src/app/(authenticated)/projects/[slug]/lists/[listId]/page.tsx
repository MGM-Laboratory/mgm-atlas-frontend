'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CalendarClock, CalendarDays, CircleDashed } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ListOverview } from '@/lib/types';

export default function ListOverviewPage() {
  const params = useParams();
  const slug = params.slug as string;
  const listId = params.listId as string;

  const overview = useQuery({
    queryKey: queryKeys.pmo.overview(slug, listId),
    queryFn: () => api<ListOverview>(apiPaths.pmo.overview(slug, listId)),
    staleTime: 30_000,
  });

  if (overview.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-line/70" />
        ))}
      </div>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
        Could not load the overview.
      </p>
    );
  }

  const d = overview.data;
  const maxStatus = Math.max(1, ...d.byStatus.map((s) => s.count));
  const maxLoad = Math.max(1, ...d.workload.map((w) => w.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<CircleDashed className="h-5 w-5 text-ink-3" strokeWidth={2.25} />} label="Open tasks" value={d.totalOpen} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5 text-brand-blue" strokeWidth={2.25} />} label="Due today" value={d.dueToday} />
        <SummaryCard icon={<CalendarClock className="h-5 w-5 text-brand-yellow-ink" strokeWidth={2.25} />} label="Due this week" value={d.dueThisWeek} />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5 text-brand-red" strokeWidth={2.25} />}
          label="Overdue"
          value={d.overdue}
          alert={d.overdue > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-[12px] uppercase tracking-[0.12em] text-ink-3">By status</h3>
          {d.byStatus.length === 0 ? (
            <p className="text-[13px] text-ink-3">No tasks yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {d.byStatus.map((s) => (
                <li key={s.statusId} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[13px] text-ink-2">{s.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand-blue"
                      style={{ width: `${(s.count / maxStatus) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[13px] tabular-nums text-ink">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-[12px] uppercase tracking-[0.12em] text-ink-3">Workload</h3>
          {d.workload.length === 0 ? (
            <p className="text-[13px] text-ink-3">No assigned open tasks.</p>
          ) : (
            <ul className="space-y-2.5">
              {d.workload.map((w) => (
                <li key={w.userId} className="flex items-center gap-3">
                  <Avatar src={w.avatarUrl} name={w.name} size={24} />
                  <span className="w-28 shrink-0 truncate text-[13px] text-ink-2">{w.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand-green"
                      style={{ width: `${(w.count / maxLoad) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[13px] tabular-nums text-ink">{w.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-[12px] uppercase tracking-[0.12em] text-ink-3">Recent activity</h3>
        {d.recentActivity.length === 0 ? (
          <p className="text-[13px] text-ink-3">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {d.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 text-[13px]">
                <Avatar src={a.actor?.avatarUrl ?? null} name={a.actor?.name ?? 'System'} size={24} />
                <span className="text-ink">
                  <span className="font-medium">{a.actor?.name ?? 'System'}</span>{' '}
                  <span className="text-ink-2">{humanizeKind(a.kind)}</span>
                </span>
                <span className="ml-auto text-[12px] text-ink-3">
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <Card className={cn('flex items-center gap-3 p-4', alert && 'ring-1 ring-brand-red/30')}>
      <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-muted">{icon}</div>
      <div>
        <p className="text-[22px] font-semibold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-1 text-[12px] text-ink-3">{label}</p>
      </div>
    </Card>
  );
}

function humanizeKind(kind: string): string {
  return kind.toLowerCase().replace(/_/g, ' ');
}
