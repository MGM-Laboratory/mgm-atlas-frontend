'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { getStoredSession } from '@/lib/auth-client';
import type { ProjectDetail } from '@/lib/types';
import { ChatLayout } from '@/components/chat/chat-layout';

/**
 * The actual chat view. Guards access client-side by reading
 * `project.access.isInsider` — viewers/guests are redirected back to
 * the project page so chat URLs are never reachable by them.
 */
export default function ProjectChannelPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const channelId = params.channelId as string;
  const session = getStoredSession();

  const projectQuery = useQuery({
    queryKey: queryKeys.project(slug),
    queryFn: () => api<ProjectDetail>(apiPaths.project(slug)),
    refetchOnWindowFocus: false,
  });

  const project = projectQuery.data;

  React.useEffect(() => {
    if (!project) return;
    if (!project.access.isInsider) {
      router.replace(`/projects/${slug}` as never);
    }
  }, [project, router, slug]);

  if (!session) return null;

  if (!project || !project.access.isInsider) {
    return <div className="h-screen animate-pulse bg-surface-muted/40" />;
  }

  return (
    <ChatLayout
      projectSlug={slug}
      projectTitle={project.title}
      channelId={channelId}
      currentUserId={session.user.id}
      isManager={project.access.isManager}
    />
  );
}
