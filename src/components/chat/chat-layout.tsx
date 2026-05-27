'use client';

import * as React from 'react';
import Link from 'next/link';
import { Hash, ArrowLeft, Radio, Pin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { useChannelSocket } from '@/lib/realtime/use-channel-socket';
import { Button } from '@/components/ui/button';
import type { ChatChannel, ChatMessage } from '@/lib/types';
import { ChannelList } from './channel-list';
import { ChatSearch } from './chat-search';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';
import { PinPanel } from './pin-panel';
import { TypingIndicator } from './typing-indicator';

interface Props {
  projectSlug: string;
  projectId: string;
  projectTitle: string;
  channelId: string;
  currentUserId: string;
  isManager: boolean;
}

export function ChatLayout({
  projectSlug,
  projectId,
  projectTitle,
  channelId,
  currentUserId,
  isManager,
}: Props) {
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [pinsOpen, setPinsOpen] = React.useState(false);

  // Reuse the channels query the sidebar already fetches.
  const channelsQuery = useQuery({
    queryKey: queryKeys.chat.channels(projectSlug),
    queryFn: () => api<ChatChannel[]>(apiPaths.chat.channels(projectSlug)),
    refetchOnWindowFocus: false,
  });

  const channel = channelsQuery.data?.find((c) => c.id === channelId);

  // Open the live socket for this channel — pushes message / reaction /
  // typing events into the React Query cache and Zustand store so the
  // child components don't need any socket knowledge.
  const { isConnected, sendTypingPing, sendTypingStop } = useChannelSocket({
    projectId,
    channelId,
    currentUserId,
  });

  // Clear the reply draft when switching channels.
  React.useEffect(() => setReplyTo(null), [channelId]);

  return (
    <div className="flex h-full min-h-0">
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
          <div className="ml-auto flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 text-[11px] text-ink-3"
              title={isConnected ? 'Realtime connected' : 'Reconnecting…'}
            >
              <Radio
                className={`h-3 w-3 ${isConnected ? 'text-brand-green' : 'text-ink-4'}`}
                strokeWidth={2.25}
              />
              <span className="hidden md:inline">{isConnected ? 'Live' : 'Offline'}</span>
            </span>
            <ChatSearch projectSlug={projectSlug} projectId={projectId} channelId={channelId} />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Pinned messages"
              onClick={() => setPinsOpen((v) => !v)}
              className={pinsOpen ? 'text-brand-blue' : undefined}
            >
              <Pin className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>
        </header>

        <MessageList
          projectSlug={projectSlug}
          channelId={channelId}
          currentUserId={currentUserId}
          isManager={isManager}
          onReply={setReplyTo}
          live={isConnected}
        />

        <div className="px-6">
          <TypingIndicator channelId={channelId} />
        </div>

        <MessageComposer
          projectSlug={projectSlug}
          channelId={channelId}
          channelName={channel?.name ?? 'channel'}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onTyping={sendTypingPing}
          onTypingStop={sendTypingStop}
        />
      </section>

      <PinPanel
        open={pinsOpen}
        onClose={() => setPinsOpen(false)}
        projectSlug={projectSlug}
        channelId={channelId}
        canModerate={isManager}
      />
    </div>
  );
}
