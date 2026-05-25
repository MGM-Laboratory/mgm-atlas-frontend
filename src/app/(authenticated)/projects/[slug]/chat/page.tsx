'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Container } from '@/components/layout/container';
import type { ChatChannel } from '@/lib/types';

/**
 * Project-chat entry point. Resolves the channel list client-side
 * (RSC fetches don't carry the user's session today — see frontend
 * CLAUDE.md auth caveat) and redirects to #general, or the first
 * non-archived channel if for some reason #general is missing.
 */
export default function ProjectChatIndexPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const channelsQuery = useQuery({
    queryKey: queryKeys.chat.channels(slug),
    queryFn: () => api<ChatChannel[]>(apiPaths.chat.channels(slug)),
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!channelsQuery.data) return;
    const target =
      channelsQuery.data.find((c) => c.isGeneral) ??
      channelsQuery.data.find((c) => !c.isArchived);
    if (target) router.replace(`/projects/${slug}/chat/${target.id}` as never);
  }, [channelsQuery.data, router, slug]);

  return (
    <Container size="2xl" className="py-10">
      <div className="h-10 w-40 animate-pulse rounded bg-line/60" />
      <div className="mt-4 h-64 animate-pulse rounded-lg bg-line/40" />
    </Container>
  );
}
