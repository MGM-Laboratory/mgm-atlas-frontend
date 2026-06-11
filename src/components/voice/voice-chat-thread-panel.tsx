'use client';

import * as React from 'react';
import { Loader2, MessageSquare, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { type ChatScope } from '@/lib/chat/scope';
import { useChannelSocket } from '@/lib/realtime/use-channel-socket';
import { Button } from '@/components/ui/button';
import { MessageList } from '@/components/chat/message-list';
import { MessageComposer } from '@/components/chat/message-composer';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import type { ChatMessage } from '@/lib/types';

interface Props {
  /** Voice channel id (NOT the paired ChatChannel id — the panel resolves that itself). */
  voiceChannelId: string;
  /** Voice channel name, shown in the panel header. */
  voiceChannelName: string;
  /** Project the voice channel belongs to. null = workspace lobby. */
  projectId: string | null;
  /** Project slug for the chat components; null = workspace lobby. */
  projectSlug: string | null;
  /** Currently-signed-in user id, threaded to the chat components. */
  currentUserId: string;
  /** Whether the panel is open (parent owns the state). */
  open: boolean;
  /** Close handler for the X button in the header. */
  onClose: () => void;
}

/**
 * Per-voice-channel text thread (§10). Reuses every existing chat
 * component (MessageList, MessageComposer, TypingIndicator) unchanged.
 *
 * Resolves the paired ChatChannel id via GET /voice/channels/:id/thread,
 * then drives the chat surfaces against that id. The thread channel is
 * marked isVoiceThread server-side, so it never appears in the regular
 * chat sidebars. Lobby channels' threads are workspace-global chat
 * channels (projectId = null) and work the same way through the
 * channel-id-keyed chat routes.
 */
export function VoiceChatThreadPanel({
  voiceChannelId,
  voiceChannelName,
  projectId,
  projectSlug,
  currentUserId,
  open,
  onClose,
}: Props) {
  // Closed → render nothing. Keep the component mounted only when
  // visible so the chat socket subscription tears down cleanly.
  if (!open) return null;
  return (
    <ResolvedThreadPanel
      voiceChannelId={voiceChannelId}
      voiceChannelName={voiceChannelName}
      projectId={projectId}
      projectSlug={projectSlug}
      currentUserId={currentUserId}
      onClose={onClose}
    />
  );
}

function ResolvedThreadPanel({
  voiceChannelId,
  voiceChannelName,
  projectId,
  projectSlug,
  currentUserId,
  onClose,
}: {
  voiceChannelId: string;
  voiceChannelName: string;
  projectId: string | null;
  projectSlug: string | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const scope: ChatScope = projectSlug
    ? { kind: 'project', slug: projectSlug }
    : { kind: 'global' };

  const threadQuery = useQuery({
    queryKey: queryKeys.voice.thread(voiceChannelId),
    queryFn: () =>
      api<{ chatChannelId: string; projectId: string | null; projectSlug: string | null }>(
        apiPaths.voice.thread(voiceChannelId),
      ),
    refetchOnWindowFocus: false,
  });

  const chatChannelId = threadQuery.data?.chatChannelId ?? '';

  // Open the chat realtime socket for this thread channel — gives us
  // message/typing/reaction/pin events live.
  const { isConnected, sendTypingPing, sendTypingStop } = useChannelSocket({
    projectId,
    channelId: chatChannelId,
    currentUserId,
  });

  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  React.useEffect(() => setReplyTo(null), [chatChannelId]);

  if (threadQuery.isLoading) {
    return (
      <aside className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-white">
        <PanelHeader title={voiceChannelName} onClose={onClose} />
        <div className="flex flex-1 items-center justify-center text-[13px] text-ink-3">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
        </div>
      </aside>
    );
  }

  if (threadQuery.isError || !chatChannelId) {
    return (
      <aside className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-white">
        <PanelHeader title={voiceChannelName} onClose={onClose} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-[13px] text-ink-3">
          <MessageSquare className="h-6 w-6 text-ink-4" strokeWidth={2} />
          <p>
            Couldn&apos;t load the text thread. It may not exist yet — ask an admin to
            re-run the voice backfill.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-white">
      <PanelHeader
        title={voiceChannelName}
        liveDot={isConnected}
        onClose={onClose}
      />
      <MessageList
        scope={scope}
        channelId={chatChannelId}
        currentUserId={currentUserId}
        isManager={false /* moderator actions defer to Phase 5 of voice */}
        onReply={setReplyTo}
        live={isConnected}
      />
      <div className="px-4">
        <TypingIndicator channelId={chatChannelId} />
      </div>
      <MessageComposer
        scope={scope}
        channelId={chatChannelId}
        channelName={voiceChannelName}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={sendTypingPing}
        onTypingStop={sendTypingStop}
      />
    </aside>
  );
}

function PanelHeader({
  title,
  liveDot,
  onClose,
}: {
  title: string;
  liveDot?: boolean;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <MessageSquare className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
      <h2 className="flex-1 truncate text-[13px] font-medium text-ink-1">{title}</h2>
      {liveDot ? (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-brand-green"
          title="Live"
        />
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close chat panel"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </Button>
    </header>
  );
}
