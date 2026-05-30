'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { useVoiceEnabled } from '@/lib/hooks/use-voice-enabled';
import type { ProjectDetail } from '@/lib/types';
import type { VoiceChannelWithRoster } from '@/lib/voice/types';
import { VoiceLayout } from '@/components/voice/voice-layout';

/**
 * Per-project voice channel page. Renders the project's full channel
 * list sidebar + the voice room in the right pane, so users can
 * navigate to other channels mid-call. Gated by project insider
 * access (matches the chat-conversation guard).
 */
export default function ProjectVoiceChannelPage() {
  const enabled = useVoiceEnabled();
  const router = useRouter();
  const params = useParams<{ slug: string; channelId: string }>();
  const { slug, channelId } = params;

  useEffect(() => {
    if (!enabled) router.replace('/');
  }, [enabled, router]);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(slug),
    queryFn: () => api<ProjectDetail>(apiPaths.project(slug)),
    enabled,
  });

  useEffect(() => {
    const project = projectQuery.data;
    if (project && !project.access.isInsider) {
      router.replace(`/projects/${slug}` as never);
    }
  }, [projectQuery.data, slug, router]);

  const channelsQuery = useQuery({
    queryKey: queryKeys.voice.channels(slug),
    queryFn: () =>
      api<{ items: VoiceChannelWithRoster[] }>(apiPaths.voice.channels(slug)).then(
        (r) => r.items,
      ),
    enabled: enabled && !!projectQuery.data?.access.isInsider,
  });

  if (!enabled) return null;

  if (projectQuery.isLoading || channelsQuery.isLoading) {
    return <div className="h-full animate-pulse bg-surface-muted/40" />;
  }

  const project = projectQuery.data;
  if (!project || !project.access.isInsider) return null;

  const channel = channelsQuery.data?.find((c) => c.id === channelId);
  if (!channel) {
    return (
      <div className="grid h-full place-items-center text-sm text-ink-3">
        Voice channel not found.
      </div>
    );
  }

  return (
    <VoiceLayout
      projectSlug={slug}
      projectTitle={project.title}
      projectId={project.id}
      channelId={channel.id}
      channelName={channel.name}
      channelTopic={channel.topic}
      isManager={project.access.isManager}
    />
  );
}
