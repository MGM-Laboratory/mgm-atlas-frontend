'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Globe, Volume2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { getStoredSession } from '@/lib/auth-client';
import { getVoiceSocket } from '@/lib/realtime/socket';
import type { VoiceChannelWithRoster } from '@/lib/voice/types';
import { VoiceChannelRow } from './voice-channel-row';
import { CreateVoiceChannelButton } from './voice-channel-actions';
import { VoiceRoom } from './voice-room';

interface Props {
  channelId: string;
  channelName: string;
  channelTopic: string | null;
}

/**
 * Workspace-lobby voice page layout. Sidebar lists all lobby channels
 * (no project context), main pane shows VoiceRoom for the active one.
 * Same shape as the per-project VoiceLayout so the switching UX feels
 * identical.
 */
export function VoiceLobbyLayout({ channelId, channelName, channelTopic }: Props) {
  const isAdmin = getStoredSession()?.user.isAdmin === true;
  const queryClient = useQueryClient();
  const lobbyQuery = useQuery({
    queryKey: queryKeys.voice.lobby,
    queryFn: () =>
      api<{ items: VoiceChannelWithRoster[] }>(apiPaths.voice.lobbyChannels()).then(
        (r) => r.items,
      ),
    refetchOnWindowFocus: false,
  });

  // Subscribe to lobby-level voice events so the sidebar avatar stacks
  // stay live (someone joins/leaves another lobby channel → we refetch).
  React.useEffect(() => {
    const socket = getVoiceSocket();
    if (!socket) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.voice.lobby });
    };
    const onConnect = () => {
      socket.emit('voice:subscribe.lobby');
    };
    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('voice.roster.update', invalidate);
    socket.on('voice.channel.created', invalidate);
    socket.on('voice.channel.updated', invalidate);
    socket.on('voice.channel.archived', invalidate);
    return () => {
      socket.off('connect', onConnect);
      socket.off('voice.roster.update', invalidate);
      socket.off('voice.channel.created', invalidate);
      socket.off('voice.channel.updated', invalidate);
      socket.off('voice.channel.archived', invalidate);
    };
  }, [queryClient]);

  const channels = (lobbyQuery.data ?? []).filter((c) => !c.archivedAt);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface-muted/40">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Workspace
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <Globe className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
            Voice Lobby
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-3">
          <div className="flex items-center justify-between gap-2 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            <span>Channels</span>
            {isAdmin ? <CreateVoiceChannelButton label="New lobby voice channel" /> : null}
          </div>
          <ul className="mt-1 space-y-0.5">
            {channels.map((c) => (
              <li key={c.id}>
                <VoiceChannelRow
                  channel={c}
                  href={`/voice/${c.id}`}
                  isActive={c.id === channelId}
                  canManage={isAdmin}
                />
              </li>
            ))}
            {channels.length === 0 && !lobbyQuery.isLoading ? (
              <li className="px-2 py-1.5 text-[12px] text-ink-3">
                {isAdmin ? 'No lobby channels yet. Click + to add one.' : 'No lobby channels yet.'}
              </li>
            ) : null}
          </ul>
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex items-center gap-3 border-b border-line px-6 py-3">
          <Link
            href={'/' as never}
            className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            Home
          </Link>

          <div className="h-4 w-px bg-line" />
          <Volume2 className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          <h1 className="text-[15px] font-semibold text-ink">{channelName}</h1>
          {channelTopic ? (
            <span className="hidden truncate text-[13px] text-ink-3 md:inline">
              · {channelTopic}
            </span>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <VoiceRoom
            channelId={channelId}
            channelName={channelName}
            projectId={null}
            projectSlugOrId={null}
            canModerate={isAdmin}
          />
        </div>
      </section>
    </div>
  );
}
