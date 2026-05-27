'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCheck, CircleDashed } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Card } from '@/components/ui/card';
import type { TaskList, TaskStatusCategory } from '@/lib/types';

/**
 * Phase 1 Overview tab — placeholder content. Wire real widgets (due
 * today, due this week, recent activity, workload per assignee) in
 * Phase 11 once tasks exist.
 */
export default function ListOverviewPage() {
  const params = useParams();
  const slug = params.slug as string;
  const listId = params.listId as string;

  const list = useQuery({
    queryKey: queryKeys.pmo.list(slug, listId),
    queryFn: () => api<TaskList>(apiPaths.pmo.lists.one(slug, listId)),
  });

  if (!list.data) return null;

  const data = list.data;
  const taskCount = data._count?.tasks ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<CircleDashed className="h-5 w-5 text-ink-3" strokeWidth={2.25} />}
          label="Total tasks"
          value={taskCount}
          hint="across every status in this list"
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-brand-blue" strokeWidth={2.25} />}
          label="Statuses"
          value={data.statuses.length}
          hint={`workflow has ${data.statuses.length} step${data.statuses.length === 1 ? '' : 's'}`}
        />
        <SummaryCard
          icon={<CheckCheck className="h-5 w-5 text-brand-green" strokeWidth={2.25} />}
          label="Default status"
          value={data.statuses.find((s) => s.isDefault)?.name ?? '—'}
          hint="status given to new tasks"
        />
      </div>

      <Card className="p-6">
        <h2 className="font-display text-h3 text-ink">Workflow</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          The status columns tasks move through in this list. You can rename, recolor, reorder, or
          add statuses from the List view once tasks ship in Phase 2.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {data.statuses
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <li
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1 text-[13px] text-ink"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${statusDotClass(s.color, s.category)}`}
                  aria-hidden
                />
                {s.name}
                {s.isDefault ? (
                  <span className="ml-1 text-[10px] uppercase tracking-wider text-ink-3">
                    default
                  </span>
                ) : null}
              </li>
            ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-h3 text-ink">Coming soon</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          The other tabs above ship phase by phase. Until then the Overview is your dashboard:
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-[14px] text-ink-2">
          <li>
            <strong>List, Kanban, Timeline</strong> — three views of the same tasks, with inline
            edits and drag-to-move.
          </li>
          <li>
            <strong>Team</strong> — pinned project managers + contributor cards with task counts.
          </li>
          <li>
            <strong>Files</strong> — a Drive-like folder tree backed by S3.
          </li>
          <li>
            <strong>Notes</strong> — collaborative docs with live cursors (BlockNote + Yjs).
          </li>
          <li>
            <strong>Whiteboards</strong> — Excalidraw-powered, exportable as <code>.mgm</code>.
          </li>
          <li>
            <strong>Embed tabs</strong> — pin Figma, Google Docs, Loom, etc. as their own tabs.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-eyebrow uppercase tracking-[0.12em] text-ink-3">{label}</span>
      </div>
      <div className="mt-3 font-display text-display-lg text-ink">{value}</div>
      <p className="mt-1 text-[12px] text-ink-3">{hint}</p>
    </Card>
  );
}

function statusDotClass(color: string, category: TaskStatusCategory): string {
  // Prefer the explicit color token; fall back to category-derived color
  // so a freshly created status with no color set still looks reasonable.
  const lookup: Record<string, string> = {
    blue: 'bg-brand-blue',
    yellow: 'bg-brand-yellow',
    red: 'bg-brand-red',
    green: 'bg-brand-green',
    neutral: 'bg-ink-4',
  };
  if (color in lookup) return lookup[color]!;
  switch (category) {
    case 'TODO':
      return 'bg-ink-4';
    case 'IN_PROGRESS':
      return 'bg-brand-blue';
    case 'DONE':
      return 'bg-brand-green';
    case 'CANCELLED':
      return 'bg-brand-red';
    default:
      return 'bg-ink-4';
  }
}
