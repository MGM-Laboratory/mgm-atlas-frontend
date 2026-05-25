'use client';

import * as React from 'react';
import Link from 'next/link';
import { Hash, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import type { ChatChannel, ChatMessage } from '@/lib/types';
import { ChannelList } from './channel-list';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';

interface Props {
  projectSlug: string;
  projectTitle: string;
  channelId: string;
  currentUserId: string;
  isManager: boolean;
}

export function ChatLayout({
  projectSlug,
  projectTitle,
  channelId,
  currentUserId,
  isManager,
}: Props) {
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);

  // Reuse the channels query the sidebar already fetches.
  const channelsQuery = useQuery({
    queryKey: queryKeys.chat.channels(projectSlug),
    queryFn: () => api<ChatChannel[]>(apiPaths.chat.channels(projectSlug)),
    refetchOnWindowFocus: false,
  });

  const channel = channelsQuery.data?.find((c) => c.id === channelId);

  // Clear the reply draft when switching channels.
  React.useEffect(() => setReplyTo(null), [channelId]);

  return (
    <div className="flex h-[calc(100svh-3.5rem)] md:h-[calc(100svh-4rem)]">
      <ChannelList
        projectSlug={projectSlug}
        projectTitle={projectTitle}
        activeChannelId={channelId}
        canManage={isManager}
      />

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex items-center gap-3 border-b border-line px-6 py-3">
          <Link
            href={`/projects/${projectSlug}` as never}
            className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            Project
          </Link>
          <div className="h-4 w-px bg-line" />
          <Hash className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          <h1 className="text-[15px] font-semibold text-ink">{channel?.name ?? 'channel'}</h1>
          {channel?.topic ? (
            <span className="hidden truncate text-[13px] text-ink-3 md:inline">
              · {channel.topic}
            </span>
          ) : null}
        </header>

        <MessageList
          projectSlug={projectSlug}
          channelId={channelId}
          currentUserId={currentUserId}
          isManager={isManager}
          onReply={setReplyTo}
        />

        <MessageComposer
          projectSlug={projectSlug}
          channelId={channelId}
          channelName={channel?.name ?? 'channel'}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      </section>
    </div>
  );
}
