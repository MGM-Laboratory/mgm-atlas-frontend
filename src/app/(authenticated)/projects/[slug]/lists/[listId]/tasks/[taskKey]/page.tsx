'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/container';
import type { ProjectDetail, SessionUser, TaskList } from '@/lib/types';
import { TaskModal } from '@/components/pmo/task-modal';

/**
 * Non-intercepting fallback. Rendered when the URL is hit directly —
 * e.g. someone pastes a shared task link from Slack. Renders the same
 * TaskModal content inline (not as a Dialog) with a back link.
 */
export default function TaskFullPage() {
  const params = useParams();
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

  if (!project.data || !list.data) {
    return (
      <Container size="2xl" className="py-12">
        <div className="h-32 animate-pulse rounded bg-line" />
      </Container>
    );
  }

  return (
    <Container size="2xl" className="py-6">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${slug}/lists/${listId}/list` as never}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Back to list
          </Link>
        </Button>
      </div>
      <TaskModal
        projectSlug={slug}
        taskKey={taskKey}
        list={list.data}
        currentUser={me.data ?? null}
        canModerate={project.data.access.isManager}
        isDialog={false}
      />
    </Container>
  );
}
