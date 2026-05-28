'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import type { ProjectDetail, TaskList } from '@/lib/types';
import { GanttView } from '@/components/pmo/views/gantt-view';

export default function TimelinePage() {
  const params = useParams();
  const slug = params.slug as string;
  const listId = params.listId as string;
  const pmoEnabled = isPmoEnabled();

  const project = useQuery({
    enabled: pmoEnabled,
    queryKey: queryKeys.project(slug),
    queryFn: () => api<ProjectDetail>(apiPaths.project(slug)),
  });
  const list = useQuery({
    enabled: pmoEnabled,
    queryKey: queryKeys.pmo.list(slug, listId),
    queryFn: () => api<TaskList>(apiPaths.pmo.lists.one(slug, listId)),
  });

  if (!pmoEnabled) return <p className="text-ink-2">PMO is not enabled on this deploy.</p>;
  if (project.isLoading || list.isLoading) {
    return <div className="h-64 animate-pulse rounded bg-line" />;
  }
  if (project.isError || !project.data || list.isError || !list.data) {
    return <p className="text-brand-red">Could not load this task list.</p>;
  }
  return (
    <GanttView projectSlug={slug} list={list.data} canManage={project.data.access.isManager} />
  );
}
