'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { useVoiceEnabled } from '@/lib/hooks/use-voice-enabled';
import type { VoiceChannelWithRoster } from '@/lib/voice/types';
import { VoiceRoom } from '@/components/voice/voice-room';

/**
 * Workspace-lobby voice channel page. Any authenticated user can land
 * here — there's no project access gate, just the feature flag.
 *
 * The actual call lifecycle (connect/disconnect) is handled by
 * <VoiceRoom> via the VoiceProvider on mount. The page just resolves
 * the channelId → channel metadata for display.
 */
export default function LobbyVoiceChannelPage() {
  const enabled = useVoiceEnabled();
  const router = useRouter();
  const params = useParams<{ channelId: string }>();
  const channelId = params.channelId;

  useEffect(() => {
    if (!enabled) router.replace('/');
  }, [enabled, router]);

  const lobbyQuery = useQuery({
    queryKey: queryKeys.voice.lobby,
    queryFn: () =>
      api<{ items: VoiceChannelWithRoster[] }>(apiPaths.voice.lobbyChannels()).then(
        (r) => r.items,
      ),
    enabled,
  });

  if (!enabled) return null;

  const channel = lobbyQuery.data?.find((c) => c.id === channelId);

  if (lobbyQuery.isLoading) {
    return (
      <div className="grid h-full place-items-center text-sm text-ink-3">Loading…</div>
    );
  }

  if (!channel) {
    return (
      <div className="grid h-full place-items-center text-sm text-ink-3">
        Voice channel not found.
      </div>
    );
  }

  return (
    <VoiceRoom channelId={channel.id} channelName={channel.name} projectId={null} />
  );
}
