'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import type { ProjectDetail, SessionUser, TaskList } from '@/lib/types';
import { TaskModal } from '@/components/pmo/task-modal';

/**
 * Intercepting route: matches when the user navigates to
 * `/projects/:slug/lists/:listId/tasks/:taskKey` from a sibling route
 * (Overview / List / Kanban / Gantt). Renders the TaskModal as a
 * Radix Dialog overlay so the underlying view stays visible behind it.
 *
 * Closing the modal calls `router.back()` to return to the prior view
 * without changing the route stack — the URL flips back from
 * `…/tasks/FE-3` to `…/list`.
 */
export default function TaskModalInterceptingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const listId = params.listId as string;
  const taskKey = decodeURIComponent(params.taskKey as string);

  const project = useQuery({
    queryKey: queryKeys.project(slug),
    queryFn: () => api<ProjectDetail>(apiPaths.project(slug)),
  });

  const list = useQuery({
    queryKey: queryKeys.pmo.list(slug, listId),
    queryFn: () => api<TaskList>(apiPaths.pmo.lists.one(slug, listId)),
  });

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<SessionUser>(apiPaths.me()),
  });

  if (!project.data || !list.data) return null;

  return (
    <TaskModal
      projectSlug={slug}
      taskKey={taskKey}
      list={list.data}
      currentUser={me.data ?? null}
      canModerate={project.data.access.isManager}
      isDialog
      onClose={() => router.back()}
    />
  );
}
